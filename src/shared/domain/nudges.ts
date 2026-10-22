import { appDay, appMinutes, daysBetween, hhmmToAppMinutes, localParts } from './day';
import { learnedTimes, type SlotTiming, slotTimings } from './slots';
import type { LogRow, PlanRow } from './types';

export interface NotificationSettings {
  enabled: boolean;
  paused_until: number | null;
  quiet: [string, string];
  slots: Record<string, boolean>;
  /** The evening recap of the day (on unless turned off). */
  recap?: boolean;
}
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  paused_until: null,
  quiet: ['22:30', '09:00'],
  slots: {},
};
export interface NotificationRecord {
  id: string;
  kind: 'slot' | 'plan' | 'test' | 'recap';
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
  /** The day the owner last closed with the day-close ritual (no recap needed after it). */
  closedDay?: string | null;
}
export interface Nudge {
  id: string;
  kind: 'slot' | 'plan' | 'test' | 'recap';
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
/**
 * When the day's recap goes out (app minutes): about 75 min after the last meal's (learned) time and never
 * before 7:30 pm, but early enough to land 45 min before quiet hours start. Aligned to the 15-minute cron.
 */
export function recapTime(timings: SlotTiming[], quiet: [string, string], dayStart: number): number {
  const last = timings.at(-1)?.time ?? hhmmToAppMinutes('20:00', dayStart);
  let t = Math.max(last + 75, hhmmToAppMinutes('19:30', dayStart));
  const [from, to] = quiet;
  const quietStart = hhmmToAppMinutes(from, dayStart);
  if (from !== to && t > quietStart - 30) t = Math.max(last + 30, quietStart - 45);
  return Math.round(t / 15) * 15;
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
  // The recap: once a day, if something was eaten and the day wasn't closed yet. It keeps one place in the
  // daily cap for itself, so meal reminders never crowd it out.
  const ate = state.logs.some((l) => !l.deleted_at && l.day === day && l.kind === 'meal');
  const recapPending =
    state.preferences.recap !== false &&
    ate &&
    state.closedDay !== day &&
    !state.notifications.some((n) => n.day === day && n.kind === 'recap');
  const at = recapTime(timings, state.preferences.quiet, state.dayStart);
  if (recapPending && time >= at && time < at + 60) {
    const id = `recap:${day}`;
    const recap: Nudge = {
      id,
      kind: 'recap',
      day,
      slot: null,
      plan_id: plan.id,
      url: `/?recap=${day}&src=push`,
      tag: id,
    };
    return [recap, ...out].slice(0, capacity);
  }
  const slotCapacity = capacity - out.length - (recapPending && time < at ? 1 : 0);
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
    if (out.filter((n) => n.kind === 'slot').length >= slotCapacity) break;
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
