import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seed from '../../seed/plan-2026-10-08.json';
import type { AiMealData } from '../../src/shared/ai-schema';
import { appDay } from '../../src/shared/domain/day';
import { PlanV1 } from '../../src/shared/domain/plan-schema';
import { mealItems } from '../../src/worker/lib/meal-ai';
import { api, pair } from './helpers';

const plan = PlanV1.parse(seed);

const output: AiMealData = {
  title: 'Tacos de pollo',
  confidence: 'medium',
  items: [
    {
      food: 'tortilla de maíz',
      equivalent_id: 'carb_sg.tortilla_de_maiz',
      qty: 2,
      unit: 'pza',
      assumed_qty: false,
      free: false,
      estimated_units: [{ type: 'fat_sp', units: 20 }],
    },
    {
      food: 'pollo',
      equivalent_id: 'protein_poa.pollo',
      qty: 120,
      unit: 'g',
      assumed_qty: true,
      free: false,
      estimated_units: [],
    },
  ],
};
const upstream = (data: unknown = output) =>
  Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });
const parse = (cookie: string, text = 'dos tacos de pollo de la calle') =>
  api('/api/ai/parse', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ text, slot: 'comida', day: '2026-10-08' }),
  });
const photo = (cookie: string, body = '/9j/AA==') =>
  api('/api/ai/photo?slot=comida&day=2026-10-08', {
    method: 'POST',
    cookie,
    headers: { 'Content-Type': 'text/plain' },
    body,
  });

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ai_cache'),
    env.DB.prepare('DELETE FROM ai_usage'),
    env.DB.prepare("DELETE FROM auth_attempts WHERE ip LIKE 'ai:%'"),
    env.DB.prepare(`INSERT OR REPLACE INTO plans
      (id, season, status, starts_on, data, created_at, updated_at, rev)
      VALUES ('ai-plan', 1, 'active', '2026-10-08', ?, 1, 1, 0)`).bind(JSON.stringify(seed)),
  ]);
});
afterEach(() => vi.restoreAllMocks());

describe('meal AI', () => {
  it('deferred descriptions explicitly use the original confirmed plan after a season change', async () => {
    const archived = structuredClone(seed);
    archived.equivalents.find((e) => e.id === 'protein_poa.pollo')!.qty = 40;
    await env.DB.prepare(`INSERT INTO plans (id,status,starts_on,ends_on,data,confirmed_at,created_at,updated_at,rev)
      VALUES ('original','archived','2026-10-01','2026-10-07',?,1,1,1,0)`)
      .bind(JSON.stringify(archived))
      .run();
    const cookie = await pair();
    const response = await api('/api/ai/parse', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ text: '120 g pollo', slot: 'comida', day: '2026-10-08', plan_id: 'original' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ units: { protein_poa: 3 } }] });
    const bad = await api('/api/ai/parse', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ text: '120 g pollo', slot: 'comida', day: '2026-10-08', plan_id: 'unknown' }),
    });
    expect(bad.status).toBe(400);
  });
  it('requires authentication and CSRF for both routes', async () => {
    expect((await parse('')).status).toBe(401);
    expect((await photo('')).status).toBe(401);
    const cookie = await pair();
    expect(
      (
        await api('/api/ai/photo?slot=comida&day=2026-10-08', {
          method: 'POST',
          cookie,
          headers: { 'X-Fichas': '0' },
          body: '/9j/AA==',
        })
      ).status,
    ).toBe(403);
  });

  it('counts complete local matches without calling the model', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const response = await parse(await pair(), '2 tortillas de maíz');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: 'local', items: [{ units: { carb_sg: 2 } }] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recomputes units, ignores pantry availability, and caches only within the same plan and slot', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream());
    const cookie = await pair();
    await env.DB.prepare(`INSERT OR REPLACE INTO pantry
      (id,label,equivalent_ids,state,checked_at,updated_at,rev)
      VALUES ('empty-chicken','pollo','["protein_poa.pollo"]','out',1,1,0)`).run();
    const response = await parse(cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: 'ai',
      items: [{ units: { carb_sg: 2 }, free: false }, { units: { protein_poa: 4 } }],
    });
    const cached = await parse(cookie, 'DOS   TACOS DE POLLO DE LA CALLE');
    expect(await cached.json()).toMatchObject({ source: 'cache' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM logs').first()).toEqual({ n: 0 });
  });

  it('returns photo detections as estimates without caching, recording meals, or storing an image', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.response_format.type).toBe('json_schema');
      expect(body.provider.data_collection).toBe('deny');
      expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,/9j/AA==');
      return upstream();
    });
    const cookie = await pair();
    expect(await (await photo(cookie)).json()).toMatchObject({
      source: 'ai',
      items: [
        { estimated: true, assumed_qty: true, units: { carb_sg: 2 } },
        { estimated: true, assumed_qty: true, units: { protein_poa: 4 } },
      ],
    });
    await photo(cookie);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_cache').first()).toEqual({ n: 0 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM logs').first()).toEqual({ n: 0 });
    expect((await env.FILES.list()).objects).toHaveLength(0);
  });

  it('rejects invalid and oversized photos before any provider request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const cookie = await pair();
    expect((await photo(cookie, 'not-an-image')).status).toBe(400);
    expect((await photo(cookie, 'A'.repeat(1_500_001))).status).toBe(413);
    expect(
      (
        await api('/api/ai/photo?slot=comida&day=2026-10-08', {
          method: 'POST',
          cookie,
          body: '{}',
        })
      ).status,
    ).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns no detections for an unclear photo instead of inventing foods', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream({ title: '', confidence: 'low', items: [] }));
    expect(await (await photo(await pair())).json()).toMatchObject({ confidence: 'low', items: [] });
  });

  it('retries a provider 5xx once and counts both attempts', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(upstream());
    expect((await photo(await pair())).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await env.DB.prepare('SELECT SUM(calls) AS n FROM ai_usage').first()).toEqual({ n: 2 });
  });

  it('rejects invalid JSON or hallucinated equivalent ids after one retry', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      upstream({
        ...output,
        items: [{ ...output.items[0], equivalent_id: 'invented-equivalent' }],
      }),
    );
    expect((await photo(await pair())).status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('enforces the daily cap and the shared per-session text/photo limit', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(upstream());
    const cookie = await pair();
    await env.DB.prepare('INSERT INTO ai_usage (day,calls) VALUES (?,400)').bind(appDay(Date.now())).run();
    expect((await photo(cookie)).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
    await env.DB.prepare('DELETE FROM ai_usage').run();
    const sessions = (await (await api('/api/auth/sessions', { cookie })).json()) as {
      sessions: { id: string; current: boolean }[];
    };
    const session = sessions.sessions.find((row) => row.current);
    await env.DB.batch(
      Array.from({ length: 60 }, () =>
        env.DB.prepare('INSERT INTO auth_attempts (ip,at) VALUES (?,?)').bind(`ai:${session?.id}`, Date.now()),
      ),
    );
    expect((await photo(cookie)).status).toBe(429);
    expect((await parse(cookie)).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('validates unit compatibility and prevents unknown foods from being treated as free', () => {
    expect(
      mealItems(
        { ...output, items: [{ ...output.items[0]!, food: 'café americano', equivalent_id: null, free: true }] },
        plan,
        false,
      ),
    ).toMatchObject([{ free: true, units: {} }]);
    expect(() => mealItems({ ...output, items: [{ ...output.items[0]!, unit: 'g' }] }, plan, true)).toThrow();
    expect(() =>
      mealItems({ ...output, items: [{ ...output.items[0]!, equivalent_id: null, free: true }] }, plan, true),
    ).toThrow();
    expect(() => mealItems({ ...output, items: [{ ...output.items[0]!, qty: 1000 }] }, plan, true)).toThrow();
    expect(() =>
      mealItems(
        {
          ...output,
          items: [
            {
              ...output.items[0]!,
              equivalent_id: null,
              estimated_units: [
                { type: 'carb_sg', units: 20 },
                { type: 'carb_sg', units: 20 },
              ],
            },
          ],
        },
        plan,
        true,
      ),
    ).toThrow();
  });
});
