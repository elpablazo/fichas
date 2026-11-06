// Cloudflare Clairic (preview): optional, strictly guarded *extraction* fallback.
// Never ask the model for portions, nutrition values, or meal approval.
// https://developers.cloudflare.com/workers-ai/models/clairic/
import { matchText, type ParseResult } from '../../shared/domain/matcher';
import { norm } from '../../shared/domain/text';
import type { PlanData } from '../../shared/domain/types';

interface ClairicResponse {
  answers?: { ingredients?: { type?: string; value?: unknown; confidence?: number } };
  truncated?: boolean;
}

interface ClairicBinding {
  run(model: string, input: { model: string; state: string; fields: Record<string, unknown> }): Promise<ClairicResponse>;
}

/** Reject partial extractions: all words of the original description must be covered. */
export function coversEntireMeal(text: string, phrases: readonly string[]): boolean {
  let rest = norm(text);
  for (const phrase of phrases) {
    const part = norm(phrase);
    if (!part) return false;
    const i = rest.indexOf(part);
    if (i < 0) return false;
    rest = rest.slice(0, i) + ' ' + rest.slice(i + part.length);
  }
  return rest.replace(/\b(de|del|la|el|los|las|y|e|con|en|al|a|un|una|unos|unas)\b/g, ' ').replace(/[\s,+./]/g, '') === '';
}

export async function tryClairicMealParse(env: Env, plan: PlanData, text: string): Promise<ParseResult | null> {
  // An AI binding enables the fallback automatically. Absence degrades gracefully.
  const ai = (env as Env & { AI?: ClairicBinding }).AI;
  if (!ai || text.length > 500) return null;
  const start = Date.now();
  try {
    const out = await Promise.race<ClairicResponse | null>([
      ai.run('@cf/cloudflare/clairic', {
        model: 'clairic',
        state: text,
        fields: {
          ingredients: {
            type: 'list',
            items: 'text',
            instructions: 'Extract EVERY distinct food or drink span exactly as written, in reading order. Each span MUST include its quantity and unit when provided (such as "150g atun"). Do not infer ingredients or quantities or omit any food.',
          },
        },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    const answer = out?.answers?.ingredients;
    if (out?.truncated || !answer || (answer.confidence ?? 0) < 0.9 || !Array.isArray(answer.value)) return null;
    const parts = answer.value.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (!parts.length || parts.length > 20 || parts.length !== answer.value.length || !coversEntireMeal(text, parts)) return null;
    const parsed = matchText(parts.join(', '), plan, []);
    if (!parsed || parsed.items.length !== parts.length) return null;
    return { ...parsed, source: 'ai', model: '@cf/cloudflare/clairic', ms: Date.now() - start, confidence: 'medium' };
  } catch {
    return null; // Cloudflare preview outages must not break meal logging.
  }
}
