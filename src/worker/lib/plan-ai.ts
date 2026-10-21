import { z } from 'zod';
import { PlanParseV1, type PlanRead } from '../../shared/plan-read-schema';
import { AiFailure, reserveCall } from './meal-ai';
import { PLAN_PROMPT } from './prompts/plan';

export interface PlanSource {
  type: string;
  base64: string;
}

/** Provider grammars need the shape; numeric/length limits remain enforced by server Zod validation. */
export function readerSchema(value: unknown = z.toJSONSchema(PlanParseV1, { target: 'draft-7' })): unknown {
  if (Array.isArray(value)) return value.map(readerSchema);
  if (!value || typeof value !== 'object') return value;
  const bounds = new Set([
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minItems',
    'maxItems',
    'minLength',
    'maxLength',
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !bounds.has(key))
      .map(([key, child]) => [key, readerSchema(child)]),
  );
}
export async function runPlanReader(
  env: Env,
  model: string,
  sources: PlanSource[],
  origin: string,
): Promise<{ read: PlanRead; ms: number }> {
  if (!env.OPENROUTER_API_KEY || !model) throw new AiFailure('unavailable');
  const started = Date.now();
  // Build around base64 text; do not decode/re-encode original files in the Worker.
  const parts = sources.map((file, i) =>
    file.type === 'application/pdf'
      ? `{"type":"file","file":{"filename":"plan-${i}.pdf","file_data":"data:application/pdf;base64,${file.base64}"}}`
      : `{"type":"image_url","image_url":{"url":"data:${file.type};base64,${file.base64}"}}`,
  );
  const config = JSON.stringify({
    model,
    max_tokens: 14000,
    reasoning: { effort: 'low', exclude: true },
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'nutrition_plan', strict: true, schema: readerSchema() },
    },
    provider: { require_parameters: true, data_collection: 'deny', sort: 'latency' },
    plugins: sources.some((s) => s.type === 'application/pdf')
      ? [{ id: 'file-parser', pdf: { engine: 'native' } }]
      : [],
  });
  const body =
    `${config.slice(0, -1)},"messages":[{"role":"system","content":${JSON.stringify(PLAN_PROMPT)}},` +
    `{"role":"user","content":[{"type":"text","text":"Read this complete plan."},${parts.join(',')}]}]}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await reserveCall(env);
    try {
      const res = await fetch(`${env.OPENROUTER_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': origin,
          'X-Title': 'Fichas',
        },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        if (res.status < 500 && res.status !== 429) throw new AiFailure('upstream');
        throw new Error('retry');
      }
      const result = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return {
        read: PlanParseV1.parse(JSON.parse(result.choices?.[0]?.message?.content ?? '')),
        ms: Date.now() - started,
      };
    } catch (error) {
      if (error instanceof AiFailure || attempt === 1) throw new AiFailure('upstream');
    }
  }
  throw new AiFailure('upstream');
}
