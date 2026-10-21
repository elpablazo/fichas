import { Hono } from 'hono';
import { ParseBody } from '../../shared/ai-schema';
import type { ParseResult } from '../../shared/domain/matcher';
import { matchText } from '../../shared/domain/matcher';
import { matchPantry } from '../../shared/domain/pantry';
import { norm } from '../../shared/domain/text';
import type { PlanData } from '../../shared/domain/types';
import { IdeasBody, PantryBody } from '../../shared/kitchen-schema';
import { type AppEnv, apiError } from '../lib/http';
import { KITCHEN_PROMPT_VERSION, runIdeasAi, runPantryAi } from '../lib/kitchen-ai';
import { AiFailure, runMealAi } from '../lib/meal-ai';
import { PROMPT_VERSION } from '../lib/prompts/meal';
import { allow } from '../lib/ratelimit';
import { sha256Hex } from '../lib/session';

export const ai = new Hono<AppEnv>();

ai.post('/pantry', async (c) => {
  const parsed = PantryBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid pantry list.');
  const plan = await planFor(c.env.DB, parsed.data.day);
  if (!plan) return apiError(c, 400, 'bad_plan', 'No plan.');
  const local = matchPantry(parsed.data.text, plan.data);
  if (!local.unmatched.length) return c.json({ items: local.items, source: 'local' });
  const key = await sha256Hex(
    JSON.stringify(['pantry', c.env.MODEL_FAST, KITCHEN_PROMPT_VERSION, plan.id, norm(parsed.data.text)]),
  );
  const cached = await c.env.DB.prepare('SELECT output FROM ai_cache WHERE key=?')
    .bind(key)
    .first<{ output: string }>();
  if (cached) return c.json({ items: JSON.parse(cached.output), source: 'cache' });
  if (!(await allow(c.env.DB, `ai:${c.get('session').id}`, 60))) return apiError(c, 429, 'rate_limited', 'Try later.');
  try {
    const items = await runPantryAi(c.env, plan.data, parsed.data.text, new URL(c.req.url).origin);
    c.executionCtx.waitUntil(
      c.env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key,job,model,output,created_at) VALUES (?,?,?,?,?)')
        .bind(key, 'pantry', c.env.MODEL_FAST, JSON.stringify(items), Date.now())
        .run(),
    );
    return c.json({ items, source: 'ai' });
  } catch (error) {
    return fail(c, error);
  }
});

ai.post('/ideas', async (c) => {
  const parsed = IdeasBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid ideas request.');
  const plan = await planFor(c.env.DB, parsed.data.day);
  if (!plan?.data.slots.some((s) => s.key === parsed.data.slot)) return apiError(c, 400, 'bad_slot', 'No meal.');
  const have = new Set(parsed.data.have.filter((id) => plan.data.equivalents.some((e) => e.id === id)));
  if (!have.size) return c.json({ ideas: [] });
  const key = await sha256Hex(
    JSON.stringify([
      'ideas',
      c.env.MODEL_FAST,
      KITCHEN_PROMPT_VERSION,
      plan.id,
      [...have].sort(),
      parsed.data.remaining,
    ]),
  );
  const cached = await c.env.DB.prepare('SELECT output FROM ai_cache WHERE key=?')
    .bind(key)
    .first<{ output: string }>();
  if (cached) return c.json({ ideas: JSON.parse(cached.output) });
  if (!(await allow(c.env.DB, `ai:${c.get('session').id}`, 60))) return apiError(c, 429, 'rate_limited', 'Try later.');
  try {
    const ideas = await runIdeasAi(c.env, plan.data, parsed.data.remaining, have, new URL(c.req.url).origin);
    c.executionCtx.waitUntil(
      c.env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key,job,model,output,created_at) VALUES (?,?,?,?,?)')
        .bind(key, 'ideas', c.env.MODEL_FAST, JSON.stringify(ideas), Date.now())
        .run(),
    );
    return c.json({ ideas });
  } catch (error) {
    return fail(c, error);
  }
});

async function planFor(db: D1Database, day: string, planId?: string): Promise<{ id: string; data: PlanData } | null> {
  if (planId) {
    const row = await db
      .prepare("SELECT id, data FROM plans WHERE id=? AND confirmed_at IS NOT NULL AND status IN ('active','archived')")
      .bind(planId)
      .first<{ id: string; data: string }>();
    return row ? { id: row.id, data: JSON.parse(row.data) as PlanData } : null;
  }
  const row = await db
    .prepare(`SELECT id, data FROM plans WHERE status IN ('active','archived')
    AND starts_on <= ? AND (ends_on IS NULL OR ends_on >= ?) ORDER BY starts_on DESC LIMIT 1`)
    .bind(day, day)
    .first<{ id: string; data: string }>();
  return row ? { id: row.id, data: JSON.parse(row.data) as PlanData } : null;
}

function fail(c: Parameters<typeof apiError>[0], error: unknown) {
  const code = error instanceof AiFailure ? error.code : 'upstream';
  return apiError(c, code === 'daily_cap' ? 429 : 503, code, 'Unable to read this meal.');
}

ai.post('/parse', async (c) => {
  const parsed = ParseBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid description.');
  const { text, day, slot, plan_id } = parsed.data;
  const plan = await planFor(c.env.DB, day, plan_id);
  if (!plan || (slot !== 'extra' && !plan.data.slots.some((s) => s.key === slot))) {
    return apiError(c, 400, 'bad_slot', 'No plan for this meal.');
  }
  // Parsing does not read the pantry or modify logs. Only approval in the UI records a meal.
  const local = matchText(text, plan.data, []);
  if (local) return c.json(local);
  const key = await sha256Hex(JSON.stringify(['parse', c.env.MODEL_FAST, PROMPT_VERSION, plan.id, slot, norm(text)]));
  const cached = await c.env.DB.prepare('SELECT output FROM ai_cache WHERE key=?')
    .bind(key)
    .first<{ output: string }>();
  if (cached) {
    c.executionCtx.waitUntil(c.env.DB.prepare('UPDATE ai_cache SET hits=hits+1 WHERE key=?').bind(key).run());
    return c.json({ ...(JSON.parse(cached.output) as ParseResult), source: 'cache', ms: 0 });
  }
  if (!(await allow(c.env.DB, `ai:${c.get('session').id}`, 60))) {
    return apiError(c, 429, 'rate_limited', 'Try later.');
  }
  try {
    const result = await runMealAi(c.env, plan.data, slot, { text }, new URL(c.req.url).origin);
    c.executionCtx.waitUntil(
      c.env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key, job, model, output, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(key, 'parse', c.env.MODEL_FAST, JSON.stringify(result), Date.now())
        .run(),
    );
    return c.json(result);
  } catch (error) {
    return fail(c, error);
  }
});

ai.post('/photo', async (c) => {
  const params = ParseBody.omit({ text: true }).safeParse({ slot: c.req.query('slot'), day: c.req.query('day') });
  if (!params.success) return apiError(c, 400, 'bad_request', 'Invalid meal.');
  if (!c.req.header('Content-Type')?.startsWith('text/plain')) return apiError(c, 415, 'bad_type', 'JPEG required.');
  // Bound streaming input before decoding text. Photos are never stored in D1 or R2.
  const reader = c.req.raw.body?.getReader();
  if (!reader) return apiError(c, 400, 'bad_request', 'Missing photo.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_500_000) {
      await reader.cancel();
      return apiError(c, 413, 'too_large', 'Photo too large.');
    }
    chunks.push(value);
  }
  const decoder = new TextDecoder();
  const jpeg = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
  if (!jpeg.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(jpeg) || jpeg.length % 4 !== 0) {
    return apiError(c, 400, 'bad_photo', 'Invalid JPEG.');
  }
  const { slot, day } = params.data;
  const plan = await planFor(c.env.DB, day);
  if (!plan || (slot !== 'extra' && !plan.data.slots.some((s) => s.key === slot))) {
    return apiError(c, 400, 'bad_slot', 'No plan for this meal.');
  }
  if (!(await allow(c.env.DB, `ai:${c.get('session').id}`, 60))) return apiError(c, 429, 'rate_limited', 'Try later.');
  try {
    return c.json(await runMealAi(c.env, plan.data, slot, { jpeg }, new URL(c.req.url).origin));
  } catch (error) {
    return fail(c, error);
  }
});
