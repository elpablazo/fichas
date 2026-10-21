// Slot times, windows and the current slot (§3.6). Day balancing lives in balance.ts.
import { addDays, appMinutes, hhmmToAppMinutes } from './day';
import type { LogRow, Slot } from './types';

const DEFAULT_MEAL_TIMES = ['08:30', '14:30', '20:30'];
/** Learned samples must be within this many minutes of the plan time (filters late "pendiente" logs). */
const LEARN_WINDOW = 180;
const MIN_GAP = 15;

export interface SlotTiming {
  key: string;
  time: number; // app minutes
  start: number; // window start (inclusive), app minutes
  end: number; // window end (exclusive)
}

/** Plan times (or defaults) in app minutes, in slot order. */
export function baseTimes(slots: Slot[], dayStartHour = 4): number[] {
  const out: (number | null)[] = slots.map((s) => (s.time ? hhmmToAppMinutes(s.time, dayStartHour) : null));
  let meal = 0;
  slots.forEach((s, i) => {
    if (out[i] === null && s.kind === 'meal') {
      out[i] = hhmmToAppMinutes(DEFAULT_MEAL_TIMES[Math.min(meal, 2)] ?? '14:30', dayStartHour);
    }
    if (s.kind === 'meal') meal++;
  });
  slots.forEach((_, i) => {
    if (out[i] !== null) return;
    const prev =
      out
        .slice(0, i)
        .reverse()
        .find((v) => v !== null) ?? null;
    const next = out.slice(i + 1).find((v) => v !== null) ?? null;
    out[i] =
      prev !== null && next !== null
        ? (prev + next) / 2
        : prev !== null
          ? prev + 120
          : next !== null
            ? next - 120
            : 600;
  });
  return out as number[];
}

/** Median app-minute of meal logs per slot over the last 14 days (≥ 3 samples). */
export function learnedTimes(
  logs: LogRow[],
  slots: Slot[],
  today: string,
  tz: string,
  dayStartHour = 4,
): Record<string, number> {
  const base = baseTimes(slots, dayStartHour);
  const from = addDays(today, -14);
  const out: Record<string, number> = {};
  slots.forEach((s, i) => {
    const samples = logs
      .filter(
        (l) =>
          !l.deleted_at &&
          l.slot === s.key &&
          l.kind === 'meal' &&
          l.source !== 'backfill' &&
          l.day >= from &&
          l.day < today,
      )
      .map((l) => appMinutes(l.eaten_at, tz, dayStartHour))
      .filter((m) => Math.abs(m - (base[i] ?? m)) <= LEARN_WINDOW)
      .sort((a, b) => a - b);
    if (samples.length >= 3) {
      const mid = Math.floor(samples.length / 2);
      out[s.key] = samples.length % 2 ? (samples[mid] ?? 0) : ((samples[mid - 1] ?? 0) + (samples[mid] ?? 0)) / 2;
    }
  });
  return out;
}

export function slotTimings(slots: Slot[], learned: Record<string, number> = {}, dayStartHour = 4): SlotTiming[] {
  const base = baseTimes(slots, dayStartHour);
  const times = slots.map((s, i) => learned[s.key] ?? base[i] ?? 0);
  for (let i = 1; i < times.length; i++) times[i] = Math.max(times[i] ?? 0, (times[i - 1] ?? 0) + MIN_GAP);
  return slots.map((s, i) => ({
    key: s.key,
    time: times[i] ?? 0,
    start: i === 0 ? 0 : ((times[i - 1] ?? 0) + (times[i] ?? 0)) / 2,
    end: i === slots.length - 1 ? 1440 : ((times[i] ?? 0) + (times[i + 1] ?? 0)) / 2,
  }));
}

export interface CurrentSlot {
  /** Index of the slot whose window contains now. */
  windowIndex: number;
  /** First unresolved slot at or after the window slot, or null when the rest of the day is resolved. */
  current: number | null;
  /** Earlier unresolved slots ("pendiente"). */
  pending: number[];
}

export function currentSlot(timings: SlotTiming[], resolved: boolean[], nowMin: number): CurrentSlot {
  let w = timings.findIndex((t) => nowMin >= t.start && nowMin < t.end);
  if (w < 0) w = timings.length - 1;
  let current: number | null = null;
  for (let i = w; i < timings.length; i++) {
    if (!resolved[i]) {
      current = i;
      break;
    }
  }
  const pending: number[] = [];
  for (let i = 0; i < w; i++) if (!resolved[i]) pending.push(i);
  return { windowIndex: w, current, pending };
}
