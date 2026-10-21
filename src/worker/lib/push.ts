import { generateRequestDetails } from 'web-push-neo';
import { pushPools as pools } from '../../client/copy/push';
import { NotificationPreferences } from '../../shared/api';
import { addDays, appDay } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import {
  DEFAULT_NOTIFICATIONS,
  decideNudges,
  deliveryAllowed,
  type NotificationRecord,
  type Nudge,
  type NudgeState,
} from '../../shared/domain/nudges';
import type { LogRow, PlanRow } from '../../shared/domain/types';

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  session_id: string;
}
export function supportedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      (host === 'fcm.googleapis.com' ||
        host === 'web.push.apple.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
export async function loadNudgeState(
  env: Env,
  now = Date.now(),
): Promise<{ state: NudgeState; subscriptions: SubscriptionRow[] }> {
  const db = env.DB;
  const settings = (
    await db
      .prepare("SELECT key,value FROM settings WHERE key IN ('notifications','tz','day_start_hour')")
      .all<{ key: string; value: string }>()
  ).results;
  const stored = Object.fromEntries(settings.map((r) => [r.key, JSON.parse(r.value)]));
  const tz = stored.tz ?? env.TZ_DEFAULT;
  const dayStart = stored.day_start_hour ?? 4;
  const day = appDay(now, tz, dayStart);
  const results = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT * FROM plans WHERE status IN ('active','archived') AND starts_on<=? AND (ends_on IS NULL OR ends_on>=?) ORDER BY starts_on DESC LIMIT 1",
      )
      .bind(day, day),
    db.prepare('SELECT * FROM logs WHERE day>=? AND deleted_at IS NULL').bind(addDays(day, -90)),
    db
      .prepare("SELECT * FROM notifications WHERE sent_at>=? OR kind='plan' ORDER BY sent_at")
      .bind(now - 90 * 86400000),
    db.prepare('SELECT MAX(last_seen_at) AS last FROM sessions WHERE revoked_at IS NULL'),
    db.prepare(
      'SELECT p.* FROM push_subscriptions p JOIN sessions s ON s.id=p.session_id WHERE s.revoked_at IS NULL LIMIT 10',
    ),
  ]);
  const rawPlan = results[0]!.results[0] as unknown as PlanRow | undefined;
  const plan = rawPlan
    ? {
        ...rawPlan,
        data: JSON.parse(rawPlan.data as unknown as string),
        source_keys: JSON.parse(rawPlan.source_keys as unknown as string),
      }
    : null;
  const logs = results[1]!.results.map((r) => ({
    ...r,
    items: JSON.parse(r.items as string),
    raw_units: JSON.parse(r.raw_units as string),
    units: JSON.parse(r.units as string),
    target: JSON.parse(r.target as string),
  })) as unknown as LogRow[];
  const subscriptions = results[4]!.results as unknown as SubscriptionRow[];
  return {
    subscriptions,
    state: {
      plan,
      logs,
      notifications: results[2]!.results as unknown as NotificationRecord[],
      preferences: NotificationPreferences.safeParse(stored.notifications).data ?? DEFAULT_NOTIFICATIONS,
      tz,
      dayStart,
      lastSeen: (results[3]!.results[0]?.last as number | null) ?? null,
      hasSubscription: subscriptions.length > 0,
    },
  };
}

function eligible(state: NudgeState, nudge: Nudge, now: number, claimed = false) {
  if (claimed) {
    if (!state.notifications.some((n) => n.id === nudge.id && n.delivery_status === 'reserved')) return false;
    // This attempt already occupies one place in the atomic daily cap.
    state = { ...state, notifications: state.notifications.filter((n) => n.id !== nudge.id) };
  }
  if (nudge.day !== appDay(now, state.tz, state.dayStart) || !deliveryAllowed(state, now)) return false;
  return (
    nudge.kind === 'test' ||
    decideNudges(state, now).some(
      (next) =>
        next.id === nudge.id && next.kind === nudge.kind && next.plan_id === nudge.plan_id && next.slot === nudge.slot,
    )
  );
}

export async function sendNudge(env: Env, nudge: Nudge, subscriptions: SubscriptionRow[], slotLabel = '') {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT || !subscriptions.length) return false;
  const current = await loadNudgeState(env);
  const active = current.subscriptions.filter((s) =>
    subscriptions.some((requested) => requested.id === s.id && requested.session_id === s.session_id),
  );
  if (!active.length || !eligible(current.state, nudge, Date.now())) return false;
  const db = env.DB,
    now = Date.now();
  const key = `push.body.${nudge.kind}` as 'push.body.slot' | 'push.body.plan' | 'push.body.test';
  const previous = (
    await db
      .prepare('SELECT copy_index FROM notifications WHERE copy_key=? ORDER BY sent_at DESC LIMIT 3')
      .bind(key)
      .all<{ copy_index: number }>()
  ).results.map((r) => r.copy_index);
  const candidates = pools[key].map((_, i) => i).filter((i) => !previous.includes(i));
  const hash = [...nudge.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  const copyIndex = candidates[hash % candidates.length] ?? 0;
  const claim = await db
    .prepare(`INSERT INTO notifications (id,kind,day,slot,plan_id,sent_at,acted_at,delivery_status,copy_key,copy_index)
    SELECT ?,?,?,?,?,?,NULL,'reserved',?,? WHERE (SELECT COUNT(*) FROM notifications WHERE day=?)<2 ON CONFLICT(id) DO NOTHING`)
    .bind(nudge.id, nudge.kind, nudge.day, nudge.slot, nudge.plan_id, now, key, copyIndex, nudge.day)
    .run();
  if (!claim.meta.changes) return false;
  const label = slotLabel.trim().split(/\s+/).slice(0, 2).join(' ');
  const titleKey = `push.title.${nudge.kind}` as 'push.title.slot' | 'push.title.plan' | 'push.title.test';
  const payload = {
    title: fill(pools[titleKey][0], { slot: label }),
    body: fill(pools[key][copyIndex]!, { slot: label }),
    url: nudge.url,
    tag: nudge.tag,
  };
  let delivered = false;
  for (const sub of active) {
    if (!supportedEndpoint(sub.endpoint)) continue;
    try {
      const key = JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey;
      const request = await generateRequestDetails(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: { publicKey: env.VAPID_PUBLIC_KEY, privateKey: key.d!, subject: env.VAPID_SUBJECT },
          TTL: 900,
          urgency: 'normal',
        },
      );
      // Encryption and a preceding provider request may outlive the original decision.
      // Read current policy and subscription identity immediately before network dispatch.
      const latest = await loadNudgeState(env);
      if (!eligible(latest.state, nudge, Date.now(), true)) break;
      if (
        !latest.subscriptions.some(
          (s) =>
            s.id === sub.id &&
            s.session_id === sub.session_id &&
            s.endpoint === sub.endpoint &&
            s.p256dh === sub.p256dh &&
            s.auth === sub.auth,
        )
      )
        continue;
      const response = await fetch(request.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 404 || response.status === 410)
        await db.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(sub.id).run();
      else if (response.ok) {
        delivered = true;
        await db
          .prepare('UPDATE push_subscriptions SET last_ok_at=?,fail_count=0 WHERE id=?')
          .bind(Date.now(), sub.id)
          .run();
      } else await db.prepare('UPDATE push_subscriptions SET fail_count=fail_count+1 WHERE id=?').bind(sub.id).run();
    } catch {
      await db.prepare('UPDATE push_subscriptions SET fail_count=fail_count+1 WHERE id=?').bind(sub.id).run();
    }
  }
  await db
    .prepare('UPDATE notifications SET delivery_status=?,delivered_at=? WHERE id=?')
    .bind(delivered ? 'sent' : 'failed', delivered ? Date.now() : null, nudge.id)
    .run();
  console.log(
    JSON.stringify({ event: 'push_delivery', kind: nudge.kind, day: nudge.day, status: delivered ? 'sent' : 'failed' }),
  );
  return delivered;
}
