import { z } from 'zod';
import { type KitchenIdea, type PantryItem, validateIdea } from '../../shared/domain/pantry';
import type { PlanData, Units } from '../../shared/domain/types';
import { equivalentById } from '../../shared/domain/units';
import { IdeasOutput, PantryOutput } from '../../shared/kitchen-schema';
import { AiFailure, reserveCall } from './meal-ai';
import { planTable } from './prompts/meal';

export const KITCHEN_PROMPT_VERSION = 'kitchen-1';
const PANTRY_PROMPT =
  'Convierte la lista de comida en artículos. Para cada uno: label corto en español y los ids de equivalentes que correspondan. No inventes ids ni comida. Ignora utensilios. Usa ids vacíos si el alimento no está en la tabla. Responde solo JSON.';
const IDEAS_PROMPT =
  'Propón hasta 3 platillos caseros mexicanos sencillos usando SOLO los ids disponibles, más condimentos libres. Cada platillo suma exactamente las porciones objetivo por tipo usando cantidades de la tabla. Devuelve title (máximo 4 palabras) e items con equivalent_id, qty y unit. Usa la unidad de la tabla. No inventes ids. Responde solo JSON.';

async function run<T>(env: Env, schema: z.ZodType<T>, prompt: string, content: string, origin: string): Promise<T> {
  if (!env.OPENROUTER_API_KEY || !env.MODEL_FAST) throw new AiFailure('unavailable');
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
        body: JSON.stringify({
          model: env.MODEL_FAST,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content },
          ],
          reasoning: { effort: 'low', exclude: true },
          max_tokens: 2200,
          provider: { require_parameters: true, data_collection: 'deny', sort: 'latency' },
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'kitchen', strict: true, schema: z.toJSONSchema(schema, { target: 'draft-7' }) },
          },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) throw new AiFailure('upstream');
        throw new Error('Provider failure');
      }
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return schema.parse(JSON.parse(data.choices?.[0]?.message?.content ?? ''));
    } catch (error) {
      if (error instanceof AiFailure || attempt === 1) throw new AiFailure('upstream');
    }
  }
  throw new AiFailure('upstream');
}

export async function runPantryAi(env: Env, plan: PlanData, text: string, origin: string): Promise<PantryItem[]> {
  const output = await run(
    env,
    PantryOutput,
    PANTRY_PROMPT,
    `${planTable(plan)}\nLista: ${JSON.stringify(text)}`,
    origin,
  );
  return output.items.map((item) => ({
    ...item,
    equivalent_ids: [...new Set(item.equivalent_ids.filter((id) => equivalentById(plan, id)))],
  }));
}

export async function runIdeasAi(
  env: Env,
  plan: PlanData,
  remaining: Units,
  have: Set<string>,
  origin: string,
): Promise<KitchenIdea[]> {
  const output = await run(
    env,
    IdeasOutput,
    IDEAS_PROMPT,
    `${planTable(plan)}\nDisponibles: ${JSON.stringify([...have].sort())}\nObjetivo: ${JSON.stringify(remaining)}`,
    origin,
  );
  return output.ideas
    .map((idea) => validateIdea(idea, plan, remaining, have))
    .filter((idea): idea is KitchenIdea => !!idea);
}
