import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { PullResponse } from '../../src/shared/api';
import { api, pair } from './helpers';

const logRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  plan_id: 'plan-1',
  day: '2026-10-15',
  slot: 'comida',
  kind: 'meal',
  title: 'Tacos de pollo',
  items: [
    {
      label: '2 tortillas',
      qty: 2,
      unit: 'pza',
      equivalent_id: 'carb_sg.tortilla_de_maiz',
      units: { carb_sg: 2 },
      estimated: false,
      assumed_qty: false,
      free: false,
    },
  ],
  raw_units: { carb_sg: 2 },
  units: { carb_sg: 2 },
  target: { carb_sg: 2 },
  status: 'on',
  source: 'suggestion',
  recipe_id: null,
  eaten_at: 1_791_000_000_000,
  created_at: 1_791_000_000_000,
  deleted_at: null,
  ...extra,
});

async function push(cookie: string, mutations: unknown[]) {
  return api('/api/sync', { method: 'POST', cookie, body: JSON.stringify({ mutations }) });
}
async function pullSince(cookie: string, since: number): Promise<PullResponse> {
  return (await (await api(`/api/sync?since=${since}`, { cookie })).json()) as PullResponse;
}

describe('sync', () => {
  it('round-trips an accepted menu and lifetime rewards idempotently across devices', async () => {
    const cookie = await pair();
    const xp = {
      id: 'unlock:xp_meal-1:life',
      kind: 'unlock',
      key: 'xp_meal-1',
      season: null,
      earned_at: 1,
      seen_at: 1,
    };
    const menu = {
      id: '2026-10-16:comida',
      day: '2026-10-16',
      slot: 'comida',
      title: 'Tacos',
      items: logRow('sample').items,
      recipe_id: null,
      accepted_at: 1,
      deleted_at: null,
    };
    const mutations = [
      { table: 'achievements', op: 'upsert', row: xp },
      { table: 'menus', op: 'upsert', row: menu },
    ];
    expect((await push(cookie, mutations)).status).toBe(200);
    expect((await push(await pair(), mutations)).status).toBe(200);
    const result = await pullSince(cookie, 0);
    expect(result.changes.achievements?.filter((a) => a.id === xp.id)).toHaveLength(1);
    expect(result.changes.menus?.find((m) => m.id === menu.id)?.accepted_at).toBe(1);
    expect((await push(cookie, [{ table: 'achievements', op: 'delete', row: { id: xp.id } }])).status).toBe(400);
  });
  it('round-trips full deferred text while keeping normal meal titles bounded', async () => {
    const cookie = await pair();
    const text = `${'torta de la calle, '.repeat(20)}sin queso`;
    const pending = logRow('long-description', {
      source: 'describe',
      title: text,
      items: [],
      raw_units: {},
      units: {},
      status: 'under',
    });
    expect((await push(cookie, [{ table: 'logs', op: 'upsert', row: pending }])).status).toBe(200);
    expect((await pullSince(cookie, 0)).changes.logs?.find((row) => row.id === pending.id)?.title).toBe(text);
    expect(
      (await push(cookie, [{ table: 'logs', op: 'upsert', row: logRow('long-meal', { title: text }) }])).status,
    ).toBe(400);
    expect(
      (await push(cookie, [{ table: 'logs', op: 'upsert', row: { ...pending, title: 'x'.repeat(2001) } }])).status,
    ).toBe(400);
  });
  it('rejects plan/target changes on existing logs and rolls back the whole batch', async () => {
    const cookie = await pair();
    await push(cookie, [{ table: 'logs', op: 'upsert', row: logRow('immutable') }]);
    const bad = await push(cookie, [
      { table: 'logs', op: 'upsert', row: logRow('must-rollback') },
      { table: 'logs', op: 'upsert', row: logRow('immutable', { target: { carb_sg: 3 } }) },
    ]);
    expect(bad.status).toBe(400);
    expect(
      (await env.DB.prepare("SELECT COUNT(*) n FROM logs WHERE id='must-rollback'").first<{ n: number }>())?.n,
    ).toBe(0);
    expect(
      (await env.DB.prepare("SELECT target FROM logs WHERE id='immutable'").first<{ target: string }>())?.target,
    ).toBe('{"carb_sg":2}');
  });
  it('push → pull round-trips rows with a monotonic rev, idempotently', async () => {
    const cookie = await pair();
    const before = await pullSince(cookie, 0);
    const r1 = await push(cookie, [{ table: 'logs', op: 'upsert', row: logRow('l1') }]);
    expect(r1.status).toBe(200);
    const { rev: rev1 } = (await r1.json()) as { rev: number };
    expect(rev1).toBeGreaterThan(before.rev);

    const r2 = await push(cookie, [{ table: 'logs', op: 'upsert', row: logRow('l1', { title: 'Tacos' }) }]);
    const { rev: rev2 } = (await r2.json()) as { rev: number };
    expect(rev2).toBe(rev1 + 1);

    const p = await pullSince(cookie, rev1 - 1);
    expect(p.changes.logs).toHaveLength(1);
    const row = p.changes.logs?.[0] as Record<string, unknown>;
    expect(row.title).toBe('Tacos');
    expect(row.rev).toBe(rev2);
    expect(typeof row.items).toBe('string'); // JSON columns travel as strings
    expect(JSON.parse(row.items as string)[0].qty).toBe(2);

    const none = await pullSince(cookie, rev2);
    expect(none.changes).toEqual({});
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM logs WHERE id = 'l1'").first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it('soft-deletes and propagates the delete', async () => {
    const cookie = await pair();
    await push(cookie, [{ table: 'logs', op: 'upsert', row: logRow('l2') }]);
    const { rev } = (await (await push(cookie, [{ table: 'logs', op: 'delete', row: { id: 'l2' } }])).json()) as {
      rev: number;
    };
    const p = await pullSince(cookie, rev - 1);
    const row = p.changes.logs?.find((r) => r.id === 'l2');
    expect(row?.deleted_at).toBeTypeOf('number');
  });

  it('rejects invalid rows and server-only tables atomically', async () => {
    const cookie = await pair();
    const bad = await push(cookie, [
      { table: 'logs', op: 'upsert', row: logRow('l3') },
      { table: 'logs', op: 'upsert', row: logRow('l4', { kind: 'feast' }) },
    ]);
    expect(bad.status).toBe(400);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM logs WHERE id IN ('l3','l4')").first<{ n: number }>();
    expect(n?.n).toBe(0);
    expect((await push(cookie, [{ table: 'plans', op: 'upsert', row: { id: 'x' } }])).status).toBe(400);
  });

  it('settings upsert by key; duplicate recipe fingerprints from another device are ignored', async () => {
    const cookie = await pair();
    await push(cookie, [{ table: 'settings', op: 'upsert', row: { key: 'sound', value: false } }]);
    const recipe = (id: string) => ({
      id,
      title: 'Tacos',
      items: [],
      fingerprint: 'carb_sg.tortilla_de_maiz|protein_poa.pollo',
      slot_counts: { comida: 1 },
      times: 1,
      last_used_at: 1,
      favorite: 0,
      hidden: 0,
      origin: 'log',
      created_at: 1,
      deleted_at: null,
    });
    expect((await push(cookie, [{ table: 'recipes', op: 'upsert', row: recipe('ra') }])).status).toBe(200);
    expect((await push(cookie, [{ table: 'recipes', op: 'upsert', row: recipe('rb') }])).status).toBe(200);
    const p = await pullSince(cookie, 0);
    expect(p.changes.settings?.find((s) => s.key === 'sound')?.value).toBe('false');
    expect(p.changes.recipes?.filter((r) => r.fingerprint === recipe('x').fingerprint)).toHaveLength(1);
  });

  it('exports everything for the owner', async () => {
    const cookie = await pair();
    const res = await api('/api/export', { cookie });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(expect.arrayContaining(['plans', 'logs', 'recipes', 'settings']));
  });
});
