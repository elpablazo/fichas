import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../seed/plan-2026-10-08.json';
import { api, pair } from './helpers';

const DAY = '2026-10-15';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shares'),
    env.DB.prepare('DELETE FROM logs'),
    env.DB.prepare("DELETE FROM auth_attempts WHERE ip LIKE 'share:%' OR ip LIKE 'journal:%'"),
    env.DB.prepare(`INSERT OR REPLACE INTO plans
      (id, season, status, starts_on, data, created_at, confirmed_at, updated_at, rev)
      VALUES ('share-plan', 1, 'active', '2026-10-08', ?, 1, 1, 1, 0)`).bind(JSON.stringify(seed)),
    env.DB.prepare(`INSERT INTO logs (id, plan_id, day, slot, kind, title, items, raw_units, units, target, status,
      source, recipe_id, eaten_at, created_at, updated_at, deleted_at, rev) VALUES
      ('l1', 'share-plan', ?, 'desayuno', 'meal', 'Sándwich de pollo + latte', ?, '{"carb_sg":2}', '{}', '{}', 'over',
       'describe', NULL, ?, 1, 1, NULL, 0)`).bind(
      DAY,
      JSON.stringify([
        {
          label: '2 reb pan de caja',
          qty: 2,
          unit: 'reb',
          equivalent_id: 'carb_sg.pan_de_caja',
          units: { carb_sg: 2 },
          estimated: false,
          assumed_qty: true,
          free: false,
          dish: 'Sándwich de pollo',
        },
        {
          label: '90 g pollo',
          qty: 90,
          unit: 'g',
          equivalent_id: 'protein_poa.pollo',
          units: { protein_poa: 3 },
          estimated: false,
          assumed_qty: false,
          free: false,
          dish: 'Sándwich de pollo',
        },
        {
          label: '1 tz leche <b>',
          qty: 1,
          unit: 'tza',
          equivalent_id: null,
          units: { dairy: 1 },
          estimated: true,
          assumed_qty: true,
          free: false,
          dish: 'Latte',
        },
      ]),
      Date.parse(`${DAY}T11:40:00-06:00`),
    ),
    env.DB.prepare(`INSERT INTO logs (id, plan_id, day, slot, kind, title, items, raw_units, units, target, status,
      source, recipe_id, eaten_at, created_at, updated_at, deleted_at, rev) VALUES
      ('l2', 'share-plan', ?, 'colacion_1', 'skip', '', '[]', '{}', '{}', '{}', 'skip', 'suggestion', NULL, 1, 1, 1, NULL, 0)`).bind(
      DAY,
    ),
  ]);
});

async function create(cookie: string, body: unknown = { from: DAY, to: DAY }) {
  return api('/api/shares', { method: 'POST', cookie, body: JSON.stringify(body) });
}

describe('nutritionist links', () => {
  it('need a session to create, list or revoke', async () => {
    expect((await api('/api/shares')).status).toBe(401);
    expect((await api('/api/shares', { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('show foods and times, never fichas, and escape what they print', async () => {
    const cookie = await pair();
    const res = await create(cookie);
    expect(res.status).toBe(201);
    const share = (await res.json()) as { id: string; token: string };
    expect(share.token.length).toBeGreaterThanOrEqual(40);
    const page = await api(`/n/${share.token}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toContain('text/html');
    expect(page.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(page.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    const html = await page.text();
    expect(html).toContain('Sándwich de pollo');
    expect(html).toContain('90 g pollo');
    expect(html).toContain('11:40 am');
    expect(html).toContain('plan 11 am');
    expect(html).toContain('40 min después');
    expect(html).toContain('Se la saltó');
    expect(html).toContain('1 tz leche &lt;b&gt;');
    expect(html).not.toContain('leche <b>');
    // The app's name aside, nothing about fichas or food groups (counts can be wrong and mislead).
    expect(html.replaceAll('Fichas', '')).not.toMatch(/ficha|carbo|prote|grasa|<script/i);
    // The token is stored hashed: the database never holds the link.
    const row = await env.DB.prepare('SELECT * FROM shares WHERE id = ?')
      .bind(share.id)
      .first<Record<string, unknown>>();
    expect(JSON.stringify(row)).not.toContain(share.token);
    expect(row?.views).toBe(1);
  });

  it('stop working once revoked; unknown links look the same', async () => {
    const cookie = await pair();
    const share = (await (await create(cookie)).json()) as { id: string; token: string };
    const list = (await (await api('/api/shares', { cookie })).json()) as { shares: { id: string }[] };
    expect(list.shares.map((s) => s.id)).toContain(share.id);
    expect((await api(`/api/shares/${share.id}`, { method: 'DELETE', cookie })).status).toBe(204);
    const gone = await api(`/n/${share.token}`);
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain('ya no está disponible');
    expect((await api('/n/not-a-real-token-but-long-enough-0000')).status).toBe(404);
    expect((await api('/n/short')).status).toBe(404);
  });

  it('reject ranges that are backwards or longer than three months', async () => {
    const cookie = await pair();
    expect((await create(cookie, { from: '2026-10-20', to: '2026-10-10' })).status).toBe(400);
    expect((await create(cookie, { from: '2026-01-01', to: '2026-10-10' })).status).toBe(400);
  });
});
