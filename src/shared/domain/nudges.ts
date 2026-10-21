import { appDay, appMinutes, daysBetween, localParts } from './day';
import { learnedTimes, slotTimings } from './slots';
import type { LogRow, PlanRow } from './types';

export interface NotificationSettings {
  enabled: boolean;
  paused_until: number | null;
  quiet: [string, string];
  slots: Record<string, boolean>;
}
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  paused_until: null,
  quiet: ['22:30', '09:00'],
  slots: {},
};
export interface NotificationRecord {
  id: string;
  kind: 'slot' | 'plan' | 'test';
  day: string;
  slot: string | null;
  plan_id: string | null;
  sent_at: number;
  acted_at: number | null;
  delivery_status?: 'reserved' | 'sent' | 'failed';
}
export interface NudgeState {
  plan: PlanRow | null;
  logs: LogRow[];
  notifications: NotificationRecord[];
  preferences: NotificationSettings;
  tz: string;
  dayStart: number;
  lastSeen: number | null;
  hasSubscription: boolean;
}
export interface Nudge {
  id: string;
  kind: 'slot' | 'plan' | 'test';
  day: string;
  slot: string | null;
  plan_id: string | null;
  url: string;
  tag: string;
}
const minute = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export function inQuietHours(now: number, tz: string, quiet: [string, string]) {
  const p = localParts(now, tz),
    n = p.hour * 60 + p.minute;
  const [from, to] = quiet.map(minute) as [number, number];
  if (from === to) return false;
  return from < to ? n >= from && n < to : n >= from || n < to;
}
export function deliveryAllowed(state: NudgeState, now: number) {
  const day = appDay(now, state.tz, state.dayStart);
  return (
    state.hasSubscription &&
    state.preferences.enabled &&
    (state.preferences.paused_until ?? 0) <= now &&
    !inQuietHours(now, state.tz, state.preferences.quiet) &&
    state.notifications.filter((n) => n.day === day).length < 2
  );
}
export function backedOff(slot: string, notifications: NotificationRecord[], logs: LogRow[], now: number) {
  let ignored = 0,
    until = 0;
  const history = notifications
    .filter((n) => n.kind === 'slot' && n.slot === slot && (!n.delivery_status || n.delivery_status === 'sent'))
    .sort((a, b) => a.sent_at - b.sent_at);
  for (const n of history) {
    const acted =
      n.acted_at !== null ||
      logs.some(
        (l) =>
          !l.deleted_at &&
          l.kind !== 'free' &&
          l.slot === slot &&
          l.day === n.day &&
          l.eaten_at >= n.sent_at &&
          l.eaten_at <= n.sent_at + 3 * 3600000,
      );
    if (acted) {
      ignored = 0;
      until = 0;
    } else if (now >= n.sent_at + 3 * 3600000) {
      ignored++;
      if (ignored >= 3) until = n.sent_at + 3 * 3600000 + 7 * 86400000;
    }
  }
  return now < until;
}
export function decideNudges(state: NudgeState, now: number): Nudge[] {
  const plan = state.plan;
  if (!plan || !deliveryAllowed(state, now)) return [];
  const day = appDay(now, state.tz, state.dayStart);
  if (!plan.starts_on || day < plan.starts_on || (plan.ends_on && day > plan.ends_on)) return [];
  const capacity = 2 - state.notifications.filter((n) => n.day === day).length;
  const out: Nudge[] = [];
  const p = localParts(now, state.tz);
  const age = daysBetween(plan.issued_on ?? plan.starts_on, day);
  if (p.hour === 12 && p.minute < 15) {
    for (const threshold of [14, 21]) {
      const id = `plan:${plan.id}:${threshold}`;
      if (age >= threshold && !state.notifications.some((n) => n.id === id)) {
        out.push({
          id,
          kind: 'plan',
          day,
          slot: null,
          plan_id: plan.id,
          url: '/progreso/plan/nuevo?src=push',
          tag: id,
        });
        break; // A late first offer and the second offer never arrive together.
      }
    }
  }
  if (state.lastSeen !== null && now - state.lastSeen < 30 * 60000) return out.slice(0, capacity);
  const timings = slotTimings(
    plan.data.slots,
    learnedTimes(state.logs, plan.data.slots, day, state.tz, state.dayStart),
    state.dayStart,
  );
  const time = appMinutes(now, state.tz, state.dayStart);
  for (const s of timings) {
    if (time < s.time + 45 || time >= s.time + 135 || state.preferences.slots[s.key] === false) continue;
    if (
      state.logs.some(
        (l) => !l.deleted_at && l.day === day && l.slot === s.key && (l.kind === 'meal' || l.kind === 'skip'),
      )
    )
      continue;
    if (state.notifications.some((n) => n.day === day && n.kind === 'slot' && n.slot === s.key)) continue;
    if (backedOff(s.key, state.notifications, state.logs, now)) continue;
    const tag = `slot:${day}:${s.key}`;
    out.push({
      id: tag,
      kind: 'slot',
      day,
      slot: s.key,
      plan_id: plan.id,
      tag,
      url: `/?slot=${encodeURIComponent(s.key)}&src=push`,
    });
  }
  return out.slice(0, capacity);
}
