// "¿Cómo voy?" (docs/04-today-2.md §3): the day as one tank per food type, the pace against the meals already
// resolved, and what changes next. Built on balanceDay so Today, Describe and the day sheet always agree.
import { balanceDay, type DayBalance } from './balance';
import { itemLabel } from './format';
import type { Equivalent, LogRow, PlanData, TypeKey } from './types';
import { TYPE_KEYS } from './types';

const EPS = 1e-6;
/** Differences under half a unit are noise (same threshold as a meal's status). */
const NOTICE = 0.5 - EPS;

export interface Meter {
  type: TypeKey;
  /** The day's total in the plan. */
  planned: number;
  /** Logged so far: resolved meals (normalized with the plan's swaps) plus extras. */
  eaten: number;
  /** What the plan asked for in the meals already resolved: where the tank "should" be now. */
  expected: number;
  /** Where each planned meal's share ends, in slot order (the day's total excluded): the tube's meal marks. */
  marks: { slot: string; at: number }[];
  /** planned − eaten, never negative. */
  remaining: number;
  /** eaten − planned, never negative. */
  over: number;
}

/** start: nothing resolved yet · on: every type within ½ of the plan so far. */
export type Pace = 'start' | 'on' | 'ahead' | 'behind' | 'mixed';

export interface PaceGap {
  type: TypeKey;
  n: number;
}

/** "n less of type in slot", from cuadrar el día. */
export interface Advice {
  slot: string;
  type: TypeKey;
  n: number;
}

export interface DayStatus {
  meters: Meter[];
  pace: Pace;
  /** Types ahead of the plan so far, largest first. */
  ahead: PaceGap[];
  /** Types behind the plan so far, largest first. */
  behind: PaceGap[];
  advice: Advice[];
  /** Planned meals resolved (logged or skipped). */
  done: number;
  total: number;
  balance: DayBalance;
}

export function dayStatus(plan: PlanData, dayLogs: LogRow[], balancing: boolean): DayStatus {
  const balance = balanceDay(plan, dayLogs, plan.swaps, balancing);
  const expected: Partial<Record<TypeKey, number>> = {};
  plan.slots.forEach((s, i) => {
    if (!balance.resolved[i]) return;
    for (const t of TYPE_KEYS) if (s.target[t]) expected[t] = (expected[t] ?? 0) + (s.target[t] ?? 0);
  });
  const meters: Meter[] = [];
  for (const t of TYPE_KEYS) {
    const planned = balance.planned[t] ?? 0;
    const eaten = balance.eaten[t] ?? 0;
    if (planned < EPS && eaten < EPS) continue;
    const marks: Meter['marks'] = [];
    let at = 0;
    for (const s of plan.slots) {
      const n = s.target[t] ?? 0;
      if (n < EPS) continue;
      at += n;
      if (at < planned - EPS) marks.push({ slot: s.key, at });
    }
    meters.push({
      type: t,
      planned,
      eaten,
      expected: expected[t] ?? 0,
      marks,
      remaining: Math.max(0, planned - eaten),
      over: Math.max(0, eaten - planned),
    });
  }
  const gaps = (sign: 1 | -1) =>
    TYPE_KEYS.map((t) => ({ type: t, n: (balance.net[t] ?? 0) * sign }))
      .filter((g) => g.n >= NOTICE)
      .sort((a, b) => b.n - a.n);
  const ahead = gaps(1);
  const behind = gaps(-1);
  const started = balance.resolved.some(Boolean) || dayLogs.some((l) => !l.deleted_at && l.slot === 'extra');
  const pace: Pace = !started
    ? 'start'
    : ahead.length && behind.length
      ? 'mixed'
      : ahead.length
        ? 'ahead'
        : behind.length
          ? 'behind'
          : 'on';
  return {
    meters,
    pace,
    ahead,
    behind,
    advice: balance.adjustments.map((a) => ({ slot: a.slot, type: a.type, n: a.from - a.to })),
    done: balance.resolved.filter(Boolean).length,
    total: plan.slots.length,
    balance,
  };
}

/** Groups worth catching up late in the day (more is welcome); the rest stay with their meals. */
export const CATCH_UP: readonly TypeKey[] = ['veg', 'fruit'];

export interface Closing {
  /** 0–100: each planned group counts the same, filled up to its plan (overs never add or subtract). */
  pct: number;
  /** Groups still short of the day's plan, catch-up groups first, then by amount. */
  missing: PaceGap[];
  /** Every planned group reached its plan. */
  complete: boolean;
  /** Complete and nothing over: día redondo. */
  exact: boolean;
}

/** "Cerrar al 100": how much of the day's plan is already covered, and what's still missing. */
export function closing(meters: readonly Pick<Meter, 'type' | 'planned' | 'eaten'>[]): Closing {
  const planned = meters.filter((m) => m.planned >= NOTICE);
  const pct = planned.length
    ? Math.floor((planned.reduce((s, m) => s + Math.min(1, m.eaten / m.planned), 0) / planned.length) * 100 + EPS)
    : 0;
  const missing = planned
    .map((m) => ({ type: m.type, n: m.planned - m.eaten }))
    .filter((g) => g.n >= NOTICE)
    .sort((a, b) => Number(CATCH_UP.includes(b.type)) - Number(CATCH_UP.includes(a.type)) || b.n - a.n);
  const complete = missing.length === 0 && planned.length > 0;
  const exact = complete && meters.every((m) => m.eaten - m.planned < NOTICE);
  return { pct: complete ? 100 : Math.min(99, pct), missing, complete, exact };
}

/** A number of units of one type said as real food: "1 tortilla", "2 cdta aceite", "½ tz arroz". */
export function amountOf(e: Equivalent, units: number): string {
  return itemLabel(e.food, units * e.qty, e.unit);
}
