import { Hono } from 'hono';
import { z } from 'zod';
import { appDay } from '../../shared/domain/day';
import { deliveryAllowed } from '../../shared/domain/nudges';
import { type AppEnv, apiError } from '../lib/http';
import { loadNudgeState, sendNudge, supportedEndpoint } from '../lib/push';
import { allow } from '../lib/ratelimit';

export const push = new Hono<AppEnv>();
push.get('/vapid', (c) =>
  c.env.VAPID_PUBLIC_KEY && c.env.VAPID_PRIVATE_KEY
    ? c.json({ key: c.env.VAPID_PUBLIC_KEY })
    : apiError(c, 503, 'unavailable', 'Push is unavailable.'),
);
const Sub = z.object({
  endpoint: z.string().url().max(4096).refine(supportedEndpoint),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[\w-]+$/)
      .length(87),
    auth: z
      .string()
      .regex(/^[\w-]+$/)
      .length(22),
  }),
});
push.post('/subscribe', async (c) => {
  const parsed = Sub.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_subscription', 'Invalid subscription.');
  if (!c.env.VAPID_PUBLIC_KEY) return apiError(c, 503, 'unavailable', 'Push is unavailable.');
  const sub = parsed.data;
  try {
    const bytes = Uint8Array.from(atob(sub.keys.p256dh.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    await crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  } catch {
    return apiError(c, 400, 'bad_subscription', 'Invalid subscription key.');
  }
  if (!(await allow(c.env.DB, `push:${c.get('session').id}`, 20)))
    return apiError(c, 429, 'rate_limited', 'Try later.');
  await c.env.DB.prepare(`INSERT INTO push_subscriptions (id,endpoint,p256dh,auth,session_id,created_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,session_id=excluded.session_id,fail_count=0`)
    .bind(crypto.randomUUID(), sub.endpoint, sub.keys.p256dh, sub.keys.auth, c.get('session').id, Date.now())
    .run();
  return c.body(null, 204);
});
push.delete('/subscribe', async (c) => {
  const parsed = z.object({ endpoint: z.string().max(4096) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid endpoint.');
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND session_id=?')
    .bind(parsed.data.endpoint, c.get('session').id)
    .run();
  return c.body(null, 204);
});
push.post('/test', async (c) => {
  const now = Date.now();
  const { state, subscriptions } = await loadNudgeState(c.env, now);
  const current = subscriptions.filter((s) => s.session_id === c.get('session').id);
  if (!current.length) return apiError(c, 409, 'not_subscribed', 'Subscribe this device first.');
  if (!deliveryAllowed(state, now)) return apiError(c, 409, 'quiet_or_paused', 'Try outside quiet hours or pause.');
  const day = appDay(now, state.tz, state.dayStart);
  const sent = await sendNudge(
    c.env,
    {
      id: `test:${day}:${crypto.randomUUID()}`,
      kind: 'test',
      day,
      slot: null,
      plan_id: state.plan?.id ?? null,
      url: '/',
      tag: `test:${day}`,
    },
    current,
  );
  return sent ? c.body(null, 204) : apiError(c, 503, 'unavailable', 'Could not send.');
});
