import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addDays, appDay } from '../../src/shared/domain/day';
import { DEFAULT_NOTIFICATIONS, type Nudge } from '../../src/shared/domain/nudges';
import worker from '../../src/worker/index';
import { type SubscriptionRow, sendNudge, supportedEndpoint } from '../../src/worker/lib/push';
import { sha256Hex } from '../../src/worker/lib/session';
import { item, log, plan } from '../unit/helpers';
import { api, pair } from './helpers';

let sub: SubscriptionRow;
beforeEach(async () => {
  const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  env.VAPID_PRIVATE_KEY = JSON.stringify(await crypto.subtle.exportKey('jwk', vapid.privateKey));
  const client = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const b64 = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  Object.assign(env, {
    VAPID_PUBLIC_KEY: b64(new Uint8Array((await crypto.subtle.exportKey('raw', vapid.publicKey)) as ArrayBuffer)),
  });
  sub = {
    id: 'push-device',
    session_id: '',
    endpoint: 'https://web.push.apple.com/test',
    p256dh: b64(new Uint8Array((await crypto.subtle.exportKey('raw', client.publicKey)) as ArrayBuffer)),
    auth: b64(crypto.getRandomValues(new Uint8Array(16))),
  };
  await env.DB.batch([
    env.DB.prepare('DELETE FROM notifications'),
    env.DB.prepare('DELETE FROM push_subscriptions'),
    env.DB.prepare('DELETE FROM plans'),
    env.DB.prepare('DELETE FROM logs'),
    env.DB.prepare('DELETE FROM settings'),
  ]);
  await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true, quiet: ['00:00', '00:00'] });
});
afterEach(() => vi.restoreAllMocks());
// Transport fixtures are manual tests, so they don't require an unresolved meal or inactivity.
const nudge = (id = 'test:delivery'): Nudge => ({
  id,
  kind: 'test',
  day: appDay(Date.now(), env.TZ_DEFAULT),
  slot: null,
  plan_id: null,
  tag: id,
  url: '/?slot=comida&src=push',
});
async function preferences(value: typeof DEFAULT_NOTIFICATIONS) {
  await env.DB.prepare(
    "INSERT INTO settings (key,value,updated_at,rev) VALUES ('notifications',?,?,1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(JSON.stringify(value), Date.now())
    .run();
}
async function subscribe() {
  const cookie = await pair();
  sub.session_id = (await env.DB.prepare('SELECT id FROM sessions WHERE token_hash=?')
    .bind(await sha256Hex(cookie.slice(4)))
    .first<{ id: string }>())!.id;
  const response = await api('/api/push/subscribe', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ endpoint: sub.endpoint, keys: sub }),
  });
  expect(response.status).toBe(204);
  sub.id = (await env.DB.prepare('SELECT id FROM push_subscriptions WHERE endpoint=?')
    .bind(sub.endpoint)
    .first<{ id: string }>())!.id;
  return cookie;
}
async function mealReminder() {
  await subscribe();
  const now = Date.now();
  const day = appDay(now, env.TZ_DEFAULT);
  const dinner = { ...plan, slots: [{ ...plan.slots.find((s) => s.key === 'cena')!, time: '21:00' }] };
  await env.DB.prepare(
    "INSERT INTO plans (id,season,status,issued_on,starts_on,data,created_at,confirmed_at,updated_at,rev) VALUES ('push-plan',1,'active',?,?,?,1,1,1,1)",
  )
    .bind(addDays(day, -1), addDays(day, -1), JSON.stringify(dinner))
    .run();
  await env.DB.prepare('UPDATE sessions SET last_seen_at=?')
    .bind(now - 3600000)
    .run();
  return { ...nudge(`slot:${day}:cena`), kind: 'slot' as const, slot: 'cena', plan_id: 'push-plan' };
}

it('authenticates subscriptions, validates crypto/endpoint and upserts once', async () => {
  expect((await api('/api/push/vapid')).status).toBe(401);
  const cookie = await subscribe();
  expect((await api('/api/push/vapid', { cookie })).status).toBe(200);
  const post = (endpoint: string, key = sub.p256dh) =>
    api('/api/push/subscribe', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ endpoint, keys: { p256dh: key, auth: sub.auth } }),
    });
  expect((await post(sub.endpoint)).status).toBe(204);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM push_subscriptions').first<{ n: number }>())!.n).toBe(1);
  expect((await post('https://attacker.test/private')).status).toBe(400);
  expect((await post(sub.endpoint, 'a'.repeat(87))).status).toBe(400);
  expect(supportedEndpoint('https://web.push.apple.com.attacker.test/a')).toBe(false);
  expect(supportedEndpoint('https://user:pass@web.push.apple.com/a')).toBe(false);
  expect(supportedEndpoint('http://web.push.apple.com/a')).toBe(false);
  expect(supportedEndpoint('https://web.push.apple.com:8080/a')).toBe(false);
});
it('encrypted sending is idempotent and concurrent claims enforce the global two/day cap', async () => {
  await subscribe();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  await Promise.all([
    sendNudge(env, nudge(), [sub], 'Comida'),
    sendNudge(env, nudge(), [sub], 'Comida'),
    sendNudge(env, nudge('second'), [sub]),
    sendNudge(env, nudge('third'), [sub]),
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
  const [endpoint, options] = fetch.mock.calls[0]!;
  expect(endpoint).toBe(sub.endpoint);
  expect(new Headers(options?.headers).get('Authorization')).toContain('vapid');
  expect(new Headers(options?.headers).get('Content-Encoding')).toBe('aes128gcm');
  expect(options?.body).toBeInstanceOf(Uint8Array);
  expect(
    (await env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE delivery_status='sent'").first<{ n: number }>())!
      .n,
  ).toBe(2);
});
it.each([404, 410])('deletes expired subscription on %i and never loops delivery', async (status) => {
  await subscribe();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
  expect(await sendNudge(env, nudge(), [sub])).toBe(false);
  expect(await sendNudge(env, nudge(), [sub])).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM push_subscriptions').first<{ n: number }>())!.n).toBe(0);
  expect(
    (await env.DB.prepare('SELECT delivery_status FROM notifications').first<{ delivery_status: string }>())!
      .delivery_status,
  ).toBe('failed');
});
it('records failed provider attempts without exposing endpoints or payloads in logs', async () => {
  await subscribe();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider unavailable'));
  expect(await sendNudge(env, nudge(), [sub])).toBe(false);
  expect(
    (await env.DB.prepare('SELECT fail_count FROM push_subscriptions').first<{ fail_count: number }>())!.fail_count,
  ).toBe(1);
});
it.each(['disabled', 'paused', 'quiet', 'revoked'] as const)(
  'does not dispatch a prepared push after policy changes: %s',
  async (change) => {
    let now = Date.parse('2026-10-15T22:29:59-06:00');
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await subscribe();
    const prepared = nudge();
    await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true });
    if (change === 'disabled') await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: false });
    if (change === 'paused')
      await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true, paused_until: now + 86400000 });
    if (change === 'quiet') now += 1000;
    if (change === 'revoked')
      await env.DB.prepare('UPDATE sessions SET revoked_at=? WHERE id=?').bind(now, sub.session_id).run();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    expect(await sendNudge(env, prepared, [sub])).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM notifications').first<{ n: number }>())!.n).toBe(0);
  },
);

it('does not dispatch a prepared test on a different app day', async () => {
  let now = Date.parse('2026-10-15T03:59:59-06:00');
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  await subscribe();
  const prepared = nudge();
  now += 1000;
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  expect(await sendNudge(env, prepared, [sub])).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['paused', 'quiet', 'revoked', 'rotated'] as const)(
  'rechecks %s before the next device delivery',
  async (change) => {
    let now = Date.parse('2026-10-15T22:29:59-06:00');
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await subscribe();
    await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true });
    const second = { ...sub, id: 'second-device', endpoint: 'https://web.push.apple.com/second' };
    await env.DB.prepare(
      'INSERT INTO push_subscriptions (id,endpoint,p256dh,auth,session_id,created_at) VALUES (?,?,?,?,?,?)',
    )
      .bind(second.id, second.endpoint, second.p256dh, second.auth, second.session_id, now)
      .run();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (change === 'paused')
        await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true, paused_until: now + 86400000 });
      if (change === 'quiet') now += 1000;
      if (change === 'revoked') await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(second.id).run();
      if (change === 'rotated')
        await env.DB.prepare('UPDATE push_subscriptions SET auth=? WHERE id=?')
          .bind(second.auth === 'x'.repeat(22) ? 'y'.repeat(22) : 'x'.repeat(22), second.id)
          .run();
      return new Response(null, { status: 201 });
    });
    expect(await sendNudge(env, nudge(), [sub, second])).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it('rechecks a pause that starts while the first request is being encrypted', async () => {
  await subscribe();
  const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
  const encryption = vi.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
    await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true, paused_until: Date.now() + 86400000 });
    return encrypt(...args);
  });
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  expect(await sendNudge(env, nudge(), [sub])).toBe(false);
  expect(encryption).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  expect((await env.DB.prepare('SELECT delivery_status FROM notifications').first())!.delivery_status).toBe('failed');
  expect((await env.DB.prepare('SELECT fail_count FROM push_subscriptions').first())!.fail_count).toBe(0);
});

it('a delayed cron does not use its scheduled timestamp to bypass current silence', async () => {
  const now = Date.parse('2026-10-15T22:30:00-06:00');
  vi.spyOn(Date, 'now').mockReturnValue(now);
  await subscribe();
  await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true });
  const day = appDay(now, env.TZ_DEFAULT);
  const dinner = { ...plan, slots: [{ ...plan.slots.find((s) => s.key === 'cena')!, time: '21:00' }] };
  await env.DB.prepare(
    "INSERT INTO plans (id,season,status,issued_on,starts_on,data,created_at,confirmed_at,updated_at,rev) VALUES ('push-plan',1,'active',?,?,?,1,1,1,1)",
  )
    .bind(addDays(day, -1), addDays(day, -1), JSON.stringify(dinner))
    .run();
  await env.DB.prepare('UPDATE sessions SET last_seen_at=?')
    .bind(now - 3600000)
    .run();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  const ctx = createExecutionContext();
  await worker.scheduled({ scheduledTime: now - 15 * 60000, cron: '*/15 * * * *', noRetry() {} }, env, ctx);
  await waitOnExecutionContext(ctx);
  expect(fetch).not.toHaveBeenCalled();
});
it('dispatches an eligible meal reminder and counts its own reservation correctly', async () => {
  const now = Date.parse('2026-10-15T22:00:00-06:00');
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const prepared = await mealReminder();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  const ctx = createExecutionContext();
  await worker.scheduled({ scheduledTime: now, cron: '*/15 * * * *', noRetry() {} }, env, ctx);
  await waitOnExecutionContext(ctx);
  expect(fetch).toHaveBeenCalledTimes(1);
  const saved = await env.DB.prepare('SELECT id,kind,plan_id,delivery_status FROM notifications').first();
  expect(saved).toEqual({ id: prepared.id, kind: 'slot', plan_id: prepared.plan_id, delivery_status: 'sent' });
});

it('dispatches a valid plan-renewal offer even when the owner is active', async () => {
  const now = Date.parse('2026-10-15T12:00:00-06:00');
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const prepared = await mealReminder();
  await env.DB.prepare("UPDATE plans SET issued_on=? WHERE id='push-plan'").bind(addDays(prepared.day, -14)).run();
  await env.DB.prepare('UPDATE sessions SET last_seen_at=?').bind(now).run();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  for (let i = 0; i < 2; i++) {
    const ctx = createExecutionContext();
    await worker.scheduled({ scheduledTime: now, cron: '*/15 * * * *', noRetry() {} }, env, ctx);
    await waitOnExecutionContext(ctx);
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await env.DB.prepare('SELECT id,kind,delivery_status FROM notifications').first()).toEqual({
    id: 'plan:push-plan:14',
    kind: 'plan',
    delivery_status: 'sent',
  });
});

it.each(['meal logged', 'owner active', 'slot disabled', 'plan replaced'] as const)(
  'stops the remaining devices after a meal reminder becomes ineligible: %s',
  async (change) => {
    const now = Date.parse('2026-10-15T22:00:00-06:00');
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const prepared = await mealReminder();
    const second = { ...sub, id: 'second-device', endpoint: 'https://web.push.apple.com/second' };
    await env.DB.prepare(
      'INSERT INTO push_subscriptions (id,endpoint,p256dh,auth,session_id,created_at) VALUES (?,?,?,?,?,?)',
    )
      .bind(second.id, second.endpoint, second.p256dh, second.auth, second.session_id, now)
      .run();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      if (change === 'meal logged') {
        await env.DB.prepare(
          "INSERT INTO logs (id,plan_id,day,slot,kind,status,source,eaten_at,created_at,updated_at,rev) VALUES ('resolved','push-plan',?,'cena','meal','under','suggestion',?,?,?,1)",
        )
          .bind(prepared.day, now, now, now)
          .run();
      }
      if (change === 'owner active') await env.DB.prepare('UPDATE sessions SET last_seen_at=?').bind(now).run();
      if (change === 'slot disabled')
        await preferences({ ...DEFAULT_NOTIFICATIONS, enabled: true, slots: { cena: false } });
      if (change === 'plan replaced') {
        await env.DB.prepare("UPDATE plans SET status='archived',ends_on=? WHERE id='push-plan'")
          .bind(addDays(prepared.day, -1))
          .run();
        await env.DB.prepare(
          "INSERT INTO plans (id,season,status,issued_on,starts_on,data,created_at,confirmed_at,updated_at,rev) SELECT 'next-plan',2,'active',?, ?,data,?,?,?,1 FROM plans WHERE id='push-plan'",
        )
          .bind(prepared.day, prepared.day, now, now, now)
          .run();
      }
      return new Response(null, { status: 201 });
    });
    expect(await sendNudge(env, prepared, [sub, second], 'Cena')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await env.DB.prepare('SELECT delivery_status FROM notifications').first())!.delivery_status).toBe('sent');
  },
);

it('test push respects subscription, disabled, paused and quiet-hour settings', async () => {
  const cookie = await subscribe();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  const prefs = async (value: unknown) =>
    api('/api/sync', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ mutations: [{ table: 'settings', op: 'upsert', row: { key: 'notifications', value } }] }),
    });
  expect((await prefs({ ...DEFAULT_NOTIFICATIONS, quiet: ['99:00', '00:00'] })).status).toBe(400);
  await prefs(DEFAULT_NOTIFICATIONS);
  expect((await api('/api/push/test', { method: 'POST', cookie })).status).toBe(409);
  await prefs({ ...DEFAULT_NOTIFICATIONS, enabled: true, paused_until: Date.now() + 86400000 });
  expect((await api('/api/push/test', { method: 'POST', cookie })).status).toBe(409);
  await prefs({ ...DEFAULT_NOTIFICATIONS, enabled: true, quiet: ['00:00', '00:00'] });
  expect((await api('/api/push/test', { method: 'POST', cookie })).status).toBe(204);
  await api('/api/auth/logout', { method: 'POST', cookie });
  expect((await api('/api/push/vapid', { cookie })).status).toBe(401);
});

it('sync marks only timely nondeleted nonfree slot logs as acting on a reminder', async () => {
  const cookie = await pair(),
    at = Date.now();
  const row = log('2026-10-09', 'comida', [item('carb_sg.tortilla_de_maiz', 1)], { id: 'acted-meal', eaten_at: at });
  for (const [id, sent] of [
    ['timely', at - 3600000],
    ['late', at - 4 * 3600000],
    ['before', at + 60000],
  ] as const) {
    await env.DB.prepare("INSERT INTO notifications (id,kind,day,slot,sent_at) VALUES (?,'slot',?,'comida',?)")
      .bind(id, row.day, sent)
      .run();
  }
  const pushLog = (r: unknown) =>
    api('/api/sync', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ mutations: [{ table: 'logs', op: 'upsert', row: r }] }),
    });
  expect((await pushLog({ ...row, deleted_at: at })).status).toBe(200);
  expect(
    (await env.DB.prepare("SELECT acted_at FROM notifications WHERE id='timely'").first<{ acted_at: number | null }>())!
      .acted_at,
  ).toBeNull();
  expect((await pushLog(row)).status).toBe(200);
  const records = (
    await env.DB.prepare('SELECT id,acted_at FROM notifications').all<{ id: string; acted_at: number | null }>()
  ).results;
  expect(records.find((n) => n.id === 'timely')!.acted_at).not.toBeNull();
  expect(records.find((n) => n.id === 'late')!.acted_at).toBeNull();
  expect(records.find((n) => n.id === 'before')!.acted_at).toBeNull();
});

it('sends the evening recap once, with a line from how the day went', async () => {
  const now = Date.parse('2026-10-15T22:15:00-06:00');
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const prepared = await mealReminder();
  // Dinner logged with less than the plan: the recap says what closes the day.
  await env.DB.prepare(
    `INSERT INTO logs (id,plan_id,day,slot,kind,title,items,raw_units,units,target,status,source,recipe_id,eaten_at,created_at,updated_at,deleted_at,rev)
     VALUES ('dinner','push-plan',?,'cena','meal','Tacos','[]','{"carb_sg":3}','{}','{}','under','describe',NULL,?,1,1,NULL,1)`,
  )
    .bind(prepared.day, now - 3_600_000)
    .run();
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  for (let i = 0; i < 2; i++) {
    const ctx = createExecutionContext();
    await worker.scheduled({ scheduledTime: now, cron: '*/15 * * * *', noRetry() {} }, env, ctx);
    await waitOnExecutionContext(ctx);
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  const saved = await env.DB.prepare('SELECT id,kind,copy_key,delivery_status FROM notifications').all();
  expect(saved.results).toEqual([
    { id: `recap:${prepared.day}`, kind: 'recap', copy_key: 'push.body.recap.close', delivery_status: 'sent' },
  ]);
});
