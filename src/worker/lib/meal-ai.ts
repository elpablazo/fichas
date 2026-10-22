import { z } from 'zod';
import { AiMeal, type AiMealData } from '../../shared/ai-schema';
import { ALIASES, ZERO_CONDIMENTS } from '../../shared/domain/aliases';
import { appDay } from '../../shared/domain/day';
import { itemLabel } from '../../shared/domain/format';
import { freeItem } from '../../shared/domain/items';
import type { ParseResult } from '../../shared/domain/matcher';
import { Units as UnitsSchema } from '../../shared/domain/plan-schema';
import { norm } from '../../shared/domain/text';
import type { LogItem, PlanData, Units } from '../../shared/domain/types';
import { convert, equivalentById } from '../../shared/domain/units';
import { PHOTO_PROMPT, planTable, TEXT_PROMPT } from './prompts/meal';

export class AiFailure extends Error {
  constructor(public code: 'unavailable' | 'daily_cap' | 'upstream') {
    super(code);
  }
}

/** "Sándwich de pollo" as the model named it; empty or generic names leave the item on its own. */
function dishOf(name: string): { dish?: string } {
  const dish = name.trim().replace(/\s+/g, ' ').slice(0, 60);
  return dish ? { dish: dish[0]?.toUpperCase() + dish.slice(1) } : {};
}

/** The model's one-line title, cut at a word boundary; generic titles ("Desayuno mixto") are dropped. */
export function mealTitle(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || /\b(mixt[oa]|variad[oa])\b/i.test(t) || /^(desayuno|comida|cena|colaci[oó]n|almuerzo)$/i.test(t)) return '';
  if (t.length <= 48) return t;
  return `${t.slice(0, 48).replace(/\s+\S*$/, '')}…`;
}

/** Trust the nutritionist table over every unit number supplied by a model. */
export function mealItems(output: AiMealData, plan: PlanData, photo: boolean): LogItem[] {
  return output.items.map((item) => ({ ...mealItem(item, plan, photo), ...dishOf(item.dish) }));
}

function mealItem(item: AiMealData['items'][number], plan: PlanData, photo: boolean): LogItem {
  const equivalent = equivalentById(plan, item.equivalent_id);
  if (item.equivalent_id && !equivalent) throw new Error('Unknown equivalent.');
  if (equivalent) {
    const qty = convert(item.qty, item.unit, equivalent.unit);
    if (qty === null) throw new Error('Incompatible units.');
    return {
      label: itemLabel(equivalent.food, item.qty, item.unit),
      qty: item.qty,
      unit: item.unit,
      equivalent_id: equivalent.id,
      units: UnitsSchema.parse({ [equivalent.type]: qty / equivalent.qty }),
      estimated: photo,
      assumed_qty: photo || item.assumed_qty,
      free: false,
    };
  }
  if (item.free) {
    const freeNames = [...plan.free_foods, ...ZERO_CONDIMENTS].flatMap((name) => [name, ...(ALIASES[name] ?? [])]);
    if (!freeNames.some((name) => norm(name) === norm(item.food))) {
      throw new Error('Unknown free food.');
    }
    return freeItem(item.food);
  }
  const units: Units = {};
  for (const entry of item.estimated_units) units[entry.type] = (units[entry.type] ?? 0) + entry.units;
  UnitsSchema.parse(units);
  if (!Object.values(units).some((n) => n > 0)) throw new Error('Missing estimated units.');
  return {
    label: itemLabel(item.food, item.qty, item.unit, false),
    qty: item.qty,
    unit: item.unit,
    equivalent_id: null,
    units,
    estimated: true,
    assumed_qty: photo || item.assumed_qty,
    free: false,
  };
}

export async function reserveCall(env: Env): Promise<void> {
  // One atomic statement prevents concurrent requests from exceeding the daily cap.
  const row = await env.DB.prepare(`INSERT INTO ai_usage (day, calls) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET calls=calls+1 WHERE calls < 400 RETURNING calls`)
    .bind(appDay(Date.now(), env.TZ_DEFAULT))
    .first();
  if (!row) throw new AiFailure('daily_cap');
}

export async function runMealAi(
  env: Env,
  plan: PlanData,
  slot: string,
  input: { text: string } | { jpeg: string },
  origin: string,
): Promise<ParseResult> {
  const photo = 'jpeg' in input;
  const model = photo ? env.MODEL_VISION : env.MODEL_FAST;
  if (!env.OPENROUTER_API_KEY || !model) throw new AiFailure('unavailable');
  const start = Date.now();
  const context = `Comida actual: ${slot}\n${planTable(plan)}`;
  const messages = photo
    ? [
        { role: 'system', content: PHOTO_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: context },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.jpeg}` } },
          ],
        },
      ]
    : [
        { role: 'system', content: TEXT_PROMPT },
        { role: 'user', content: `${context}\nTexto: ${JSON.stringify(input.text)}` },
      ];
  const body = JSON.stringify({
    model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'meal',
        strict: true,
        schema: z.toJSONSchema(AiMeal, { target: 'draft-7' }),
      },
    },
    provider: { require_parameters: true, data_collection: 'deny', sort: 'latency' },
    reasoning: { effort: 'low', exclude: true },
    // Current fast models can reject temperature; require only shared supported parameters.
    max_tokens: 2200,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    await reserveCall(env);
    try {
      const response = await fetch(`${env.OPENROUTER_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin,
          'X-Title': 'Fichas',
        },
        body,
        signal: AbortSignal.timeout(photo ? 20000 : 12000),
      });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) throw new AiFailure('upstream');
        throw new Error('Retryable provider error.');
      }
      const result = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const output = AiMeal.parse(JSON.parse(result.choices?.[0]?.message?.content ?? ''));
      return {
        title: mealTitle(output.title),
        items: mealItems(output, plan, photo),
        confidence: output.confidence,
        source: 'ai',
        model,
        ms: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof AiFailure || attempt === 1) throw new AiFailure('upstream');
    }
  }
  throw new AiFailure('upstream');
}
