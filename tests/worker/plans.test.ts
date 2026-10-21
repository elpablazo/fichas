import { env, evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, appDay } from '../../src/shared/domain/day';
import { checkPlan, expandRead, type PlanReport } from '../../src/shared/domain/plan-ingestion';
import { PlanParseV1 } from '../../src/shared/plan-read-schema';
import { readerSchema } from '../../src/worker/lib/plan-ai';
import { completePlanExamples } from '../../src/worker/lib/plan-examples';
import { sha256Hex } from '../../src/worker/lib/session';
import { planRead, seedPlan } from '../plan-fixture';
import { api, pair } from './helpers';

const day = () => appDay(Date.now(), 'America/Mexico_City');
const PDF = btoa('%PDF-1.7\nsynthetic test plan\n%%EOF');
const SHA = 'a'.repeat(64);
const response = (read = planRead()) => Response.json({ choices: [{ message: { content: JSON.stringify(read) } }] });
async function draft(cookie: string, sha = SHA) {
  const res = await api('/api/plans/drafts', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      files: [{ name: 'plan.pdf', type: 'application/pdf', size: atob(PDF).length, sha256: sha }],
    }),
  });
  expect(res.status).toBe(201);
  const { draft_id } = (await res.json()) as { draft_id: string };
  const upload = await api(`/api/plans/drafts/${draft_id}/files/0`, {
    method: 'PUT',
    cookie,
    headers: { 'Content-Type': 'text/plain' },
    body: PDF,
  });
  expect(upload.status).toBe(204);
  return draft_id;
}
async function readDraft(cookie: string, id: string) {
  const res = await api(`/api/plans/drafts/${id}/parse`, { method: 'POST', cookie });
  if (res.status !== 202) return res;
  await runDurableObjectAlarm(env.PLAN_JOBS.getByName(id));
  return api('/api/plans/drafts/latest', { cookie });
}
async function readyDraft(_cookie: string, id: string, report?: Partial<PlanReport>) {
  const plan = expandRead(planRead());
  const row = await env.DB.prepare('SELECT parse_report FROM plans WHERE id=?')
    .bind(id)
    .first<{ parse_report: string }>();
  await env.DB.prepare('UPDATE plans SET data=?,parse_report=? WHERE id=?')
    .bind(
      JSON.stringify(plan),
      JSON.stringify({ ...JSON.parse(row!.parse_report), state: 'ready', warnings: checkPlan(plan), ...report }),
      id,
    )
    .run();
  return plan;
}
const confirm = (cookie: string, id: string, plan: unknown, extra: Record<string, unknown> = {}) =>
  api(`/api/plans/${id}/confirm`, {
    method: 'POST',
    cookie,
    body: JSON.stringify({ plan, starts_on: day(), warnings_ack: true, ...extra }),
  });

beforeEach(async () => {
  await env.DB.batch(
    [
      'DELETE FROM plans',
      'DELETE FROM logs',
      'DELETE FROM ai_cache',
      'DELETE FROM ai_usage',
      'DELETE FROM weighins',
      "DELETE FROM auth_attempts WHERE ip LIKE 'plan-%'",
    ].map((sql) => env.DB.prepare(sql)),
  );
  await env.DB.prepare(`INSERT INTO plans (id,season,status,starts_on,data,source_sha256,created_at,confirmed_at,updated_at,rev)
    VALUES ('old',1,'active',?,?,'old-source',1,1,1,1)`)
    .bind(addDays(day(), -10), JSON.stringify(seedPlan))
    .run();
});
afterEach(() => vi.restoreAllMocks());

describe('plan ingestion and immutable seasons', () => {
  it('uses a simple provider grammar while retaining strict server-side limits', () => {
    expect(JSON.stringify(readerSchema())).not.toMatch(/"(?:maxItems|minItems|maximum|minimum|maxLength|minLength)":/);
    const read = planRead();
    read.slots[0]!.target.carb_sg = 31;
    expect(PlanParseV1.safeParse(read).success).toBe(false);
    read.slots[0]!.target.carb_sg = 2;
    read.equivalent_rows[0]!.qty = 0;
    expect(PlanParseV1.safeParse(read).success).toBe(false);
  });
  it('requires auth and CSRF; rejects unsafe uploads and missing files', async () => {
    expect((await api('/api/plans/drafts/latest')).status).toBe(401);
    expect((await api('/api/plans/old/files/0')).status).toBe(401);
    const cookie = await pair();
    const id = await draft(cookie);
    expect((await api(`/api/plans/drafts/${id}/files/0`, { method: 'PUT', cookie, body: 'evil' })).status).toBe(415);
    expect(
      (await api('/api/plans/drafts', { method: 'POST', cookie, headers: { 'X-Fichas': '0' }, body: '{}' })).status,
    ).toBe(403);
    expect(
      (
        await api('/api/plans/drafts', {
          method: 'POST',
          cookie,
          body: JSON.stringify({ files: [{ name: 'x', type: 'text/html', size: 1, sha256: SHA }] }),
        })
      ).status,
    ).toBe(400);
    const missing = await api('/api/plans/drafts', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ files: [{ name: 'x.pdf', type: 'application/pdf', size: 1, sha256: 'b'.repeat(64) }] }),
    });
    const missingId = ((await missing.json()) as { draft_id: string }).draft_id;
    expect((await readDraft(cookie, missingId)).status).toBe(409);
    expect(
      (
        await api(`/api/plans/drafts/${missingId}/files/0`, {
          method: 'PUT',
          cookie,
          headers: { 'Content-Type': 'text/plain' },
          body: 'abcd',
        })
      ).status,
    ).toBe(400);
  });
  it('reads two providers in parallel, validates outputs, caches and resumes the ready draft', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.plugins).toEqual([{ id: 'file-parser', pdf: { engine: 'native' } }]);
      expect(body.messages[1].content[1].file.file_data).toBe(`data:application/pdf;base64,${PDF}`);
      expect(body.provider.data_collection).toBe('deny');
      return response();
    });
    const cookie = await pair();
    const id = await draft(cookie);
    const res = await readDraft(cookie, id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: PlanReport };
    expect(body.report.state).toBe('ready');
    expect(body.report.single_read).toBe(false);
    expect(body.report.disagreements).toEqual([]);
    const readerCalls = () =>
      fetch.mock.calls.filter(([, init]) => JSON.parse(String(init?.body)).model !== 'test/fast');
    expect(readerCalls()).toHaveLength(2);
    expect((await api('/api/plans/drafts/latest', { cookie })).status).toBe(200);
    await readDraft(cookie, id);
    expect(readerCalls()).toHaveLength(2);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM ai_cache').first<{ n: number }>())?.n).toBe(2);
  });
  it('persists the job before returning; survives eviction and deduplicates a reconnect', async () => {
    const provider = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    const cookie = await pair();
    const id = await draft(cookie);
    const request = () => api(`/api/plans/drafts/${id}/parse`, { method: 'POST', cookie });
    expect((await request()).status).toBe(202);
    expect(provider).not.toHaveBeenCalled();
    const stub = env.PLAN_JOBS.getByName(id);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.get('job')).toMatchObject({ id });
      expect(await state.storage.getAlarm()).not.toBeNull();
    });
    await evictDurableObject(stub);
    expect((await request()).status).toBe(202);
    await runDurableObjectAlarm(stub);
    expect(provider.mock.calls.filter(([, init]) => JSON.parse(String(init?.body)).model !== 'test/fast')).toHaveLength(
      2,
    );
    const latest = (await (await api('/api/plans/drafts/latest', { cookie })).json()) as { report: PlanReport };
    expect(latest.report.state).toBe('ready');
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.get('job')).toBeUndefined();
    });
  });
  it('discarding a queued draft prevents provider calls and never changes the active plan', async () => {
    const provider = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    const cookie = await pair();
    const id = await draft(cookie);
    expect((await api(`/api/plans/drafts/${id}/parse`, { method: 'POST', cookie })).status).toBe(202);
    await api(`/api/plans/${id}/discard`, { method: 'POST', cookie });
    await runDurableObjectAlarm(env.PLAN_JOBS.getByName(id));
    expect(provider).not.toHaveBeenCalled();
    expect((await env.DB.prepare("SELECT id FROM plans WHERE status='active'").first<{ id: string }>())?.id).toBe(
      'old',
    );
  });
  it('a manual retry restores an exhausted alarm without replacing the persisted job', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
    const cookie = await pair();
    const id = await draft(cookie);
    expect((await api(`/api/plans/drafts/${id}/parse`, { method: 'POST', cookie })).status).toBe(202);
    const stub = env.PLAN_JOBS.getByName(id);
    let originalJob: unknown;
    await runInDurableObject(stub, async (_instance, state) => {
      originalJob = await state.storage.get('job');
      await state.storage.deleteAlarm();
    });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 241_000);
    expect((await api(`/api/plans/drafts/${id}/parse`, { method: 'POST', cookie })).status).toBe(202);
    await runInDurableObject(stub, async (_instance, state) => {
      expect(await state.storage.get('job')).toEqual(originalJob);
      expect(await state.storage.getAlarm()).not.toBeNull();
    });
    await runDurableObjectAlarm(stub);
    const latest = (await (await api('/api/plans/drafts/latest', { cookie })).json()) as { report: PlanReport };
    expect(latest.report.state).toBe('ready');
  });
  it('one reader failure is explicit and requires acknowledgement', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      JSON.parse(String(init?.body)).model === 'test/plan-a' ? response() : new Response('', { status: 400 }),
    );
    const cookie = await pair();
    const id = await draft(cookie);
    const read = await readDraft(cookie, id);
    const body = (await read.json()) as { report: PlanReport; plan: unknown };
    expect(body.report.single_read).toBe(true);
    expect((await confirm(cookie, id, body.plan)).status).toBe(409);
    expect((await confirm(cookie, id, body.plan, { single_read_ack: true })).status).toBe(200);
  });
  it('batches unmatched examples once, validates IDs/units, caches and leaves explicit warnings', async () => {
    const a = planRead();
    a.slots.forEach((slot) => {
      slot.example_lines = [];
    });
    a.slots[0]!.example_lines = ['preparación especial de dos tortillas'];
    const b = structuredClone(a);
    const plans = [expandRead(a), expandRead(b)];
    const items = [
      { text: '2 tortillas', options: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: 2, unit: 'pza' }] },
    ];
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('test/fast');
      expect(body.provider.data_collection).toBe('deny');
      expect(JSON.stringify(body)).not.toContain('base64');
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                lines: [
                  { reader: 0, slot: 0, line: 0, items },
                  {
                    reader: 1,
                    slot: 0,
                    line: 0,
                    items: [{ ...items[0], options: [{ ...items[0]!.options[0], equivalent_id: 'invented' }] }],
                  },
                ],
              }),
            },
          },
        ],
      });
    });
    const warnings = await completePlanExamples(env, [a, b], plans, 'https://fichas.test');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(plans[0]!.slots[0]!.example?.items).toEqual(items);
    expect(plans[1]!.slots[0]!.example).toBeNull();
    expect(warnings).toEqual([{ code: 'example', field: 'Desayuno: preparación especial de dos tortillas' }]);
    await completePlanExamples(env, [a, b], [expandRead(a), expandRead(b)], 'https://fichas.test');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('target disagreements block confirmation until resolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const read = planRead();
      if (JSON.parse(String(init?.body)).model === 'test/plan-b') read.slots[2]!.target.carb_sg = 3;
      return response(read);
    });
    const cookie = await pair();
    const id = await draft(cookie);
    const body = (await (await readDraft(cookie, id)).json()) as { report: PlanReport; plan: unknown };
    expect(body.report.disagreements.map((d) => d.id)).toContain('slots.2.target.carb_sg');
    expect((await confirm(cookie, id, body.plan)).status).toBe(409);
    expect((await confirm(cookie, id, body.plan, { resolutions: { 'slots.2.target.carb_sg': 'a' } })).status).toBe(200);
  });
  it('archives the old season atomically, retains snapshots and prevents historical edits', async () => {
    await env.DB.prepare(`INSERT INTO logs (id,plan_id,day,slot,kind,title,target,status,source,eaten_at,created_at,updated_at,rev)
      VALUES ('history','old',?,'comida','meal','test','{"carb_sg":2}','on','suggestion',1,1,1,1)`)
      .bind(addDays(day(), -1))
      .run();
    const cookie = await pair();
    const id = await draft(cookie);
    const plan = await readyDraft(cookie, id);
    plan.slots[2]!.target.carb_sg = 3;
    const confirmed = await confirm(cookie, id, plan, { weighin_kg: 80 });
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ season: 2 });
    expect(
      (await env.DB.prepare("SELECT ends_on FROM plans WHERE id='old'").first<{ ends_on: string }>())?.ends_on,
    ).toBe(addDays(day(), -1));
    expect(await env.DB.prepare("SELECT plan_id,target FROM logs WHERE id='history'").first()).toEqual({
      plan_id: 'old',
      target: '{"carb_sg":2}',
    });
    await expect(env.DB.prepare("UPDATE plans SET data='{}' WHERE id='old'").run()).rejects.toThrow(
      'confirmed_plan_immutable',
    );
    await expect(env.DB.prepare("UPDATE logs SET target='{}' WHERE id='history'").run()).rejects.toThrow(
      'log_snapshot_immutable',
    );
    expect((await env.DB.prepare("SELECT COUNT(*) n FROM plans WHERE status='active'").first<{ n: number }>())?.n).toBe(
      1,
    );
    expect((await api(`/api/plans/${id}/files/0`, { cookie })).status).toBe(200);
    expect(await (await api(`/api/plans/${id}/files/0`, { cookie })).text()).toBe(PDF);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM weighins').first<{ n: number }>())?.n).toBe(1);
    const originalData = (await env.DB.prepare('SELECT data FROM plans WHERE id=?').bind(id).first<{ data: string }>())!
      .data;
    expect((await confirm(cookie, id, seedPlan)).status).toBe(200);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM weighins').first<{ n: number }>())?.n).toBe(1);
    expect((await env.DB.prepare('SELECT data FROM plans WHERE id=?').bind(id).first<{ data: string }>())?.data).toBe(
      originalData,
    );
  });
  it('refuses backdating across current-day logs; tomorrow preserves today', async () => {
    await env.DB.prepare(`INSERT INTO logs (id,plan_id,day,slot,kind,status,source,eaten_at,created_at,updated_at,rev)
      VALUES ('today','old',?,'comida','meal','on','suggestion',1,1,1,1)`)
      .bind(day())
      .run();
    const cookie = await pair();
    const id = await draft(cookie);
    const plan = await readyDraft(cookie, id);
    expect((await confirm(cookie, id, plan)).status).toBe(409);
    expect((await env.DB.prepare("SELECT status FROM plans WHERE id='old'").first<{ status: string }>())?.status).toBe(
      'active',
    );
    expect((await confirm(cookie, id, plan, { starts_on: addDays(day(), 1) })).status).toBe(200);
    expect(
      (await env.DB.prepare("SELECT ends_on FROM plans WHERE id='old'").first<{ ends_on: string }>())?.ends_on,
    ).toBe(day());
  });
  it('detects duplicate originals and discarding never modifies confirmed plans', async () => {
    const cookie = await pair();
    const id = await draft(cookie);
    const plan = await readyDraft(cookie, id);
    await confirm(cookie, id, plan);
    const duplicate = await api('/api/plans/drafts', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        files: [{ name: 'same.pdf', type: 'application/pdf', size: atob(PDF).length, sha256: SHA }],
      }),
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ duplicate_id: id });
    await api(`/api/plans/${id}/discard`, { method: 'POST', cookie });
    expect(
      (await env.DB.prepare('SELECT status FROM plans WHERE id=?').bind(id).first<{ status: string }>())?.status,
    ).toBe('active');
    expect(await sha256Hex(PDF)).toHaveLength(64);
  });
});
