import { env } from 'cloudflare:test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import seed from '../../seed/plan-2026-10-08.json';
import { api, pair } from './helpers';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ai_cache'),
    env.DB.prepare('DELETE FROM ai_usage'),
    env.DB.prepare("DELETE FROM auth_attempts WHERE ip LIKE 'ai:%'"),
    env.DB.prepare(
      "INSERT OR REPLACE INTO plans (id,status,starts_on,data,created_at,updated_at,rev) VALUES ('kitchen','active','2026-10-08',?,1,1,0)",
    ).bind(JSON.stringify(seed)),
  ]);
});
afterEach(() => vi.restoreAllMocks());
const post = (path: string, cookie: string, body: unknown) =>
  api(`/api/ai/${path}`, { method: 'POST', cookie, body: JSON.stringify(body) });
const upstream = (data: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(data) } }] });

it('pantry normalization authenticates, stays local for aliases and creates no inventory or meals', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  expect((await post('pantry', '', { text: 'pollo', day: '2026-10-08' })).status).toBe(401);
  const cookie = await pair();
  expect((await post('pantry', cookie, { text: 'x'.repeat(2001), day: '2026-10-08' })).status).toBe(400);
  const response = await post('pantry', cookie, { text: 'pollo y tortillas', day: '2026-10-08' });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    source: 'local',
    items: [{ equivalent_ids: ['protein_poa.pollo'] }, { equivalent_ids: ['carb_sg.tortilla_de_maiz'] }],
  });
  expect(fetch).not.toHaveBeenCalled();
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM pantry').first<{ n: number }>())?.n).toBe(0);
});

it('unknown pantry text uses validated IDs and caches the read without writing inventory', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      upstream({ items: [{ label: 'Pechuguita', equivalent_ids: ['protein_poa.pollo', 'invented'] }] }),
    );
  const cookie = await pair();
  const first = await post('pantry', cookie, { text: 'pechuguita del mercado', day: '2026-10-08' });
  expect(await first.json()).toMatchObject({ source: 'ai', items: [{ equivalent_ids: ['protein_poa.pollo'] }] });
  const cached = await post('pantry', cookie, { text: 'pechuguita del mercado', day: '2026-10-08' });
  expect(await cached.json()).toMatchObject({ source: 'cache' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('ideas enforce table arithmetic and availability; empty inventory needs no provider call', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    upstream({
      ideas: [
        { title: 'Tortillas', items: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: 2, unit: 'pza' }] },
        { title: 'No cabe', items: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: 4, unit: 'pza' }] },
        { title: 'Sin pollo', items: [{ equivalent_id: 'protein_poa.pollo', qty: 60, unit: 'g' }] },
      ],
    }),
  );
  const cookie = await pair();
  const body = { day: '2026-10-08', slot: 'comida', remaining: { carb_sg: 2 }, have: ['carb_sg.tortilla_de_maiz'] };
  const response = await post('ideas', cookie, body);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ideas: [{ title: 'Tortillas', items: [{ units: { carb_sg: 2 } }] }] });
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM logs').first<{ n: number }>())?.n).toBe(0);
  await post('ideas', cookie, { ...body, have: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await post('ideas', cookie, { ...body, slot: 'invented' })).status).toBe(400);
});

it('ideas rejects bad shape, wrong table units and unknown IDs', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    upstream({
      ideas: [
        { title: 'Wrong unit', items: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: 2, unit: 'g' }] },
        { title: 'Unknown', items: [{ equivalent_id: 'unknown', qty: 2, unit: 'pza' }] },
      ],
    }),
  );
  const cookie = await pair();
  const body = { day: '2026-10-08', slot: 'comida', remaining: { carb_sg: 2 }, have: ['carb_sg.tortilla_de_maiz'] };
  expect(await (await post('ideas', cookie, body)).json()).toEqual({ ideas: [] });
  fetch.mockResolvedValue(
    upstream({
      ideas: [{ title: 'Malformed', items: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: -1, unit: 'pza' }] }],
    }),
  );
  expect((await post('ideas', cookie, { ...body, remaining: { carb_sg: 3 } })).status).toBe(503);
});
