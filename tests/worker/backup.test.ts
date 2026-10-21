import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import seed from '../../seed/plan-2026-10-08.json';
import { restoreSql } from '../../src/shared/restore';
import worker from '../../src/worker/index';
import { createBackup, exportSnapshot, listBackups, scheduledBackup } from '../../src/worker/lib/backup';
import { api, pair } from './helpers';

beforeEach(async () => {
  const listed = await listBackups(env);
  if (listed.length) await env.FILES.delete(listed.map((o) => o.key));
});
it('disabled backups neither run from cron nor accept authenticated creation', async () => {
  const disabled = { ...env, BACKUPS_ENABLED: 'false' as const };
  const cookie = await pair();
  await scheduledBackup(disabled, Date.parse('2026-10-11T03:00:00-06:00'));
  await expect(createBackup(disabled)).rejects.toThrow('Backups are disabled');
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request('https://fichas.test/api/backups', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-Fichas': '1' },
    }),
    disabled,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  expect(response.status).toBe(503);
  expect(await listBackups(env)).toHaveLength(0);
});
it('exports one consistent revision without session tokens, push keys or secrets', async () => {
  await pair();
  const snapshot = await exportSnapshot(env);
  expect(snapshot).toMatchObject({
    schema: 1,
    rev: expect.any(Number),
    plans: expect.any(Array),
    logs: expect.any(Array),
  });
  expect(snapshot).not.toHaveProperty('sessions');
  expect(snapshot).not.toHaveProperty('push_subscriptions');
  expect(JSON.stringify(snapshot)).not.toContain(env.OWNER_PAIRING_CODE);
});
it('weekly schedule respects local Sunday 03:00 and writes only once; retains eight backups', async () => {
  const sunday = Date.parse('2026-10-11T03:00:00-06:00');
  await scheduledBackup(env, sunday - 3600000);
  expect(await listBackups(env)).toHaveLength(0);
  await scheduledBackup(env, sunday);
  await scheduledBackup(env, sunday + 15 * 60000);
  expect(await listBackups(env)).toHaveLength(1);
  const original = await env.FILES.get('backup/2026-10-11.json');
  expect((await original!.json<{ schema: number }>()).schema).toBe(1);
  for (let i = 1; i <= 10; i++) await createBackup(env, sunday + i * 7 * 86400000);
  expect(await listBackups(env)).toHaveLength(8);
  expect(await env.FILES.head('backup/2026-10-11.json')).toBeNull();
});
it('backup routes require a session and enforce date/path bounds', async () => {
  expect((await api('/api/backups')).status).toBe(401);
  const cookie = await pair();
  expect((await api('/api/backups', { method: 'POST', cookie })).status).toBe(201);
  const body = (await (await api('/api/backups', { cookie })).json()) as { backups: { date: string }[] };
  expect((await api(`/api/backups/${body.backups[0]!.date}`, { cookie })).status).toBe(200);
  expect((await api('/api/backups/not-a-date', { cookie })).status).toBe(400);
  expect((await api('/api/backups/1999-01-01', { cookie })).status).toBe(404);
});
it('file-backed restore preserves confirmed plan data and detects invalid rows and schema', async () => {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO plans (id,status,season,starts_on,data,source_keys,confirmed_at,created_at,updated_at,rev) VALUES ('backup-plan','active',1,'2026-10-08',?,'[]',1,1,1,0)",
  )
    .bind(JSON.stringify(seed))
    .run();
  const snapshot = await exportSnapshot(env);
  const restore = restoreSql(snapshot);
  expect(restore.counts.plans).toBe(1);
  await env.DB.exec('DELETE FROM plans;');
  await env.DB.exec(restore.sql);
  expect((await env.DB.prepare("SELECT data FROM plans WHERE id='backup-plan'").first<{ data: string }>())!.data).toBe(
    JSON.stringify(seed),
  );
  expect(() => restoreSql({ ...snapshot, schema: 2 })).toThrow();
  expect(() => restoreSql({ ...snapshot, weighins: [{ id: 'invalid', kg: -20 }] })).toThrow();
  expect(() => restoreSql({ ...snapshot, logs: null })).toThrow();
});
