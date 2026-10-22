// "Tu alimentación" (docs/05-fichas-2.md §8): how a range of days went — the days at 100, the average day against
// the plan per group, what each meal tends to bring over or short, real vs plan times, and the most eaten foods.
// Pure. A day's numbers match its ring (dayStatus + closing); today counts only in the strip, not in averages.
import { appMinutes, dayRange } from './day';
import { closing, dayStatus } from './daystatus';
import { foodName } from './insights';
import { baseTimes } from './slots';
import { computeStatus, isProvisional } from './status';
import type { LogRow, PlanData, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';
import { unitsOfItems } from './units';

const NOTICE = 0.5 - 1e-6;
/** A meal habit is worth saying when it happened at least this often (and at least twice). */
const HABIT = 0.4;

export interface EatingDay {
  day: string;
  /** Something was eaten and logged. */
  logged: boolean;
  /** The day's ring (0–100). */
  pct: number;
  complete: boolean;
  exact: boolean;
}

export interface GroupAverage {
  type: TypeKey;
  /** Per logged day. */
  eaten: number;
  planned: number;
}

export interface MealHabit {
  /** A plan slot key, or 'extra' for food outside the meals. */
  slot: string;
  type: TypeKey;
  /** The usual size when it happens: positive over, negative short. */
  n: number;
  times: number;
  /** Days that meal was logged (for extras: days counted). */
  of: number;
}

export interface MealTiming {
  slot: string;
  /** App minutes. */
  plan: number;
  /** Median of the real times, app minutes. */
  real: number;
}

export interface TopFood {
  key: string;
  label: string;
  type: TypeKey | null;
  times: number;
}

export interface EatingSummary {
  days: EatingDay[];
  /** Finished days with something logged (the base of the averages). */
  counted: number;
  /** Days at 100 (today included once it is). */
  full: number;
  avg: GroupAverage[];
  habits: MealHabit[];
  /** Finished days each meal was logged. */
  mealDays: Record<string, number>;
  timing: MealTiming[];
  foods: TopFood[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

export function eatingSummary(o: {
  from: string;
  to: string;
  today: string;
  logs: readonly LogRow[];
  planOf: (day: string) => PlanData | null;
  tz: string;
  dayStartHour: number;
}): EatingSummary {
  const byDay = new Map<string, LogRow[]>();
  for (const l of o.logs) {
    if (l.deleted_at || l.day < o.from || l.day > o.to) continue;
    byDay.set(l.day, [...(byDay.get(l.day) ?? []), l]);
  }
  const days: EatingDay[] = [];
  const sums = new Map<TypeKey, { eaten: number; planned: number }>();
  const habits = new Map<string, { slot: string; type: TypeKey; sum: number; times: number }>();
  const logged = new Map<string, number>();
  const times = new Map<string, number[]>();
  const foods = new Map<string, TopFood>();
  let counted = 0;
  const habit = (slot: string, type: TypeKey, d: number) => {
    const key = `${slot}:${type}:${d > 0 ? '+' : '-'}`;
    const h = habits.get(key) ?? { slot, type, sum: 0, times: 0 };
    h.sum += d;
    h.times++;
    habits.set(key, h);
  };
  for (const day of dayRange(o.from, o.to)) {
    const plan = o.planOf(day);
    const dayLogs = byDay.get(day) ?? [];
    const meals = dayLogs.filter((l) => l.kind === 'meal');
    const ate = meals.length > 0;
    const c = plan ? closing(dayStatus(plan, dayLogs, false).meters) : null;
    days.push({ day, logged: ate, pct: c?.pct ?? 0, complete: !!c?.complete, exact: !!c?.exact });
    if (!plan || !ate || day >= o.today) continue;
    counted++;
    for (const m of dayStatus(plan, dayLogs, false).meters) {
      const s = sums.get(m.type) ?? { eaten: 0, planned: 0 };
      s.eaten += m.eaten;
      s.planned += m.planned;
      sums.set(m.type, s);
    }
    const planned = new Set(plan.slots.map((s) => s.key));
    for (const s of plan.slots) {
      const slotMeals = meals.filter((l) => l.slot === s.key && !isProvisional(l));
      if (!slotMeals.length) continue;
      logged.set(s.key, (logged.get(s.key) ?? 0) + 1);
      const target: Units = slotMeals[0]?.target ?? s.target;
      const d = computeStatus(
        unitsOfItems(
          slotMeals.flatMap((l) => l.items),
          plan,
        ),
        target,
        plan.swaps,
      ).deltas;
      for (const t of TYPE_KEYS) if (Math.abs(d[t] ?? 0) >= NOTICE) habit(s.key, t, d[t] ?? 0);
    }
    const extra = meals.filter((l) => !planned.has(l.slot) && !isProvisional(l));
    if (extra.length) {
      // Against an empty target: the plan's swaps say it in plan groups (pan dulce = carbohidrato + grasa).
      const u = computeStatus(
        unitsOfItems(
          extra.flatMap((l) => l.items),
          plan,
        ),
        {},
        plan.swaps,
      ).deltas;
      for (const t of TYPE_KEYS) if ((u[t] ?? 0) >= NOTICE) habit('extra', t, u[t] ?? 0);
    }
    for (const l of meals) {
      if (planned.has(l.slot))
        times.set(l.slot, [...(times.get(l.slot) ?? []), appMinutes(l.eaten_at, o.tz, o.dayStartHour)]);
      const seen = new Set<string>();
      for (const it of l.items) {
        if (it.free) continue;
        const e = it.equivalent_id ? plan.equivalents.find((x) => x.id === it.equivalent_id) : undefined;
        const label = e?.food ?? foodName(it.label);
        const key = (it.equivalent_id ?? label).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const f = foods.get(key) ?? { key, label, type: e?.type ?? null, times: 0 };
        f.times++;
        foods.set(key, f);
      }
    }
  }
  const avg: GroupAverage[] = TYPE_KEYS.flatMap((type) => {
    const s = sums.get(type);
    if (!s || !counted || (s.planned < NOTICE && s.eaten < NOTICE)) return [];
    return [{ type, eaten: s.eaten / counted, planned: s.planned / counted }];
  });
  const latest = o.planOf(o.to);
  const timing: MealTiming[] = [];
  if (latest) {
    const base = baseTimes(latest.slots, o.dayStartHour);
    latest.slots.forEach((s, i) => {
      const plan = base[i] ?? 0;
      // Late "pendiente" logs are far from the meal; they say nothing about when it was eaten.
      const xs = (times.get(s.key) ?? []).filter((m) => Math.abs(m - plan) <= 240);
      if (xs.length >= 3) timing.push({ slot: s.key, plan, real: median(xs) });
    });
  }
  return {
    days,
    counted,
    full: days.filter((d) => d.complete).length,
    avg,
    habits: [...habits.values()]
      .map((h) => ({
        slot: h.slot,
        type: h.type,
        n: h.sum / h.times,
        times: h.times,
        of: h.slot === 'extra' ? counted : (logged.get(h.slot) ?? 0),
      }))
      .filter((h) => h.times >= 2 && h.of > 0 && h.times / h.of >= HABIT)
      .sort((a, b) => b.times / b.of - a.times / a.of || Math.abs(b.n) - Math.abs(a.n)),
    mealDays: Object.fromEntries(logged),
    timing,
    foods: [...foods.values()].sort((a, b) => b.times - a.times || a.label.localeCompare(b.label)).slice(0, 6),
  };
}
