// "¿Qué lo causó?" (docs/05-fichas-2.md §6): which foods brought each food type, per meal and per day, so a
// "1 🫓 de más" always comes with its reason ("el pan del sándwich"). Pure; numbers match computeStatus.
import { closing, dayStatus } from './daystatus';
import { computeStatus } from './status';
import type { LogItem, LogRow, PlanData, SwapRule, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';
import { unitsOfItem, unitsOfItems } from './units';

const NOTICE = 0.5 - 1e-6;

export interface Contributor {
  label: string;
  /** Units of the type this item brought (raw, before swaps). */
  n: number;
  /** The dish it was part of, if any. */
  dish?: string;
  /** The meal it was logged in (day-level views). */
  slot?: string;
}

export interface TypeGap {
  type: TypeKey;
  /** Eaten − planned, normalized with the plan's swaps (positive = over). */
  delta: number;
  /** The items that brought this type (or a type that counts as it), largest first. */
  contributors: Contributor[];
}

/** Types a swap rule turns into `t` ("carbohidrato con grasa" counts as carbohidrato + grasa). */
function sourcesOf(t: TypeKey, rules: SwapRule[]): TypeKey[] {
  return [t, ...rules.filter((r) => (r.to[t] ?? 0) > 0).map((r) => r.from)];
}

/** Items that brought type t (directly or through a swap), largest first. */
export function contributorsOf(
  t: TypeKey,
  items: readonly LogItem[],
  plan: PlanData | null,
  rules: SwapRule[],
  slot?: string,
): Contributor[] {
  const from = sourcesOf(t, rules);
  return items
    .map((it) => {
      const u = unitsOfItem(it, plan);
      const n = from.reduce((s, k) => s + (u[k] ?? 0), 0);
      return { label: it.label, n, ...(it.dish ? { dish: it.dish } : {}), ...(slot ? { slot } : {}) };
    })
    .filter((c) => c.n > 1e-6)
    .sort((a, b) => b.n - a.n);
}

/** A meal against its target: what went over (with the items that caused it) and what fell short. */
export function mealGaps(
  items: readonly LogItem[],
  plan: PlanData,
  target: Units,
): { over: TypeGap[]; under: TypeGap[] } {
  const rules = plan.swaps;
  const r = computeStatus(unitsOfItems([...items], plan), target, rules);
  const over: TypeGap[] = [];
  const under: TypeGap[] = [];
  for (const t of TYPE_KEYS) {
    const d = r.deltas[t] ?? 0;
    if (d >= NOTICE) over.push({ type: t, delta: d, contributors: contributorsOf(t, items, plan, rules) });
    else if (d <= -NOTICE) under.push({ type: t, delta: d, contributors: contributorsOf(t, items, plan, rules) });
  }
  over.sort((a, b) => b.delta - a.delta);
  under.sort((a, b) => a.delta - b.delta);
  return { over, under };
}

/** Everything that brought a type on a day, meal by meal (the tube's breakdown). */
export function dayContributors(t: TypeKey, dayLogs: readonly LogRow[], plan: PlanData): Contributor[] {
  return dayLogs
    .filter((l) => !l.deleted_at && l.kind === 'meal')
    .flatMap((l) => contributorsOf(t, l.items, plan, plan.swaps, l.slot))
    .sort((a, b) => b.n - a.n);
}

/** Food name without the amount ("½ tz arroz" → "arroz"). */
export function foodName(label: string): string {
  return label.replace(/^\s*[\d½¼¾⅓⅔.,/]+\s*(tz|tza|cda|cdta|g|ml|reb|pza|lata|latas|paquete|barra)?\s*/i, '') || label;
}

/** "el pan de caja" style short name of a contributor, for "vino de …" lines. */
export function contributorName(c: Contributor): string {
  return foodName(c.label);
}

/**
 * What brought a type above plan: everything eaten outside the plan's meals, plus the meals that went over their
 * own share. Food a meal was planned to have is never a cause. Same-named foods are merged, largest first.
 */
export function overCauses(t: TypeKey, dayLogs: readonly LogRow[], plan: PlanData): Contributor[] {
  const meals = dayLogs.filter((l) => !l.deleted_at && l.kind === 'meal');
  const planned = new Set(plan.slots.map((s) => s.key));
  const out: Contributor[] = [];
  for (const l of meals) if (!planned.has(l.slot)) out.push(...contributorsOf(t, l.items, plan, plan.swaps, l.slot));
  for (const s of plan.slots) {
    const items = meals.filter((l) => l.slot === s.key).flatMap((l) => l.items);
    if (!items.length) continue;
    const d = computeStatus(unitsOfItems(items, plan), s.target, plan.swaps).deltas[t] ?? 0;
    if (d >= NOTICE) out.push(...contributorsOf(t, items, plan, plan.swaps, s.key));
  }
  const byName = new Map<string, Contributor>();
  for (const c of out) {
    const key = contributorName(c).toLowerCase();
    const seen = byName.get(key);
    if (seen) seen.n += c.n;
    else byName.set(key, { ...c });
  }
  return [...byName.values()].sort((a, b) => b.n - a.n);
}

export interface DayLesson {
  /** Groups that ended the day on plan. */
  good: TypeKey[];
  /** Groups still short of the day's plan (catch-up groups first). */
  missing: { type: TypeKey; n: number }[];
  /** Groups over the day's plan, with what brought them. */
  over: { type: TypeKey; n: number; from: Contributor[] }[];
  /** One thing for tomorrow, from the biggest gap of today. */
  tip:
    | { kind: 'over'; type: TypeKey; slot: string; n: number }
    | { kind: 'extra'; type: TypeKey; food: string }
    | { kind: 'missing'; type: TypeKey; slot: string; n: number }
    | { kind: 'repeat' };
}

/** The day's minute of learning: what went well, what was missing or over (and why), one tip for tomorrow. */
export function dayLesson(plan: PlanData, dayLogs: readonly LogRow[]): DayLesson {
  const live = dayLogs.filter((l) => !l.deleted_at);
  const status = dayStatus(plan, [...live], false);
  const meters = status.meters;
  const good = meters.filter((m) => m.planned >= NOTICE && Math.abs(m.eaten - m.planned) < NOTICE).map((m) => m.type);
  const missing = closing(meters).missing;
  const over = meters
    .filter((m) => m.over >= NOTICE)
    .sort((a, b) => b.over - a.over)
    .map((m) => {
      const causes = overCauses(m.type, live, plan);
      return {
        type: m.type,
        n: m.over,
        from: (causes.length ? causes : dayContributors(m.type, live, plan)).slice(0, 3),
      };
    });
  const meals = live.filter((l) => l.kind === 'meal');
  const planned = new Set(plan.slots.map((s) => s.key));
  let tip: DayLesson['tip'] = { kind: 'repeat' };
  const top = over[0];
  const short = missing[0];
  if (top) {
    // The meal where that type went over the most, against what came outside the meals.
    let best: { slot: string; d: number } | null = null;
    for (const s of plan.slots) {
      const items = meals.filter((l) => l.slot === s.key).flatMap((l) => l.items);
      if (!items.length) continue;
      const d = computeStatus(unitsOfItems(items, plan), s.target, plan.swaps).deltas[top.type] ?? 0;
      if (d >= NOTICE && (!best || d > best.d)) best = { slot: s.key, d };
    }
    const outside = top.from.filter((c) => c.slot && !planned.has(c.slot));
    const outsideN = outside.reduce((sum, c) => sum + c.n, 0);
    if (outside[0] && outsideN >= (best?.d ?? 0))
      tip = { kind: 'extra', type: top.type, food: contributorName(outside[0]) };
    else {
      const slot =
        best?.slot ?? plan.slots.reduce((a, s) => ((s.target[top.type] ?? 0) > (a.target[top.type] ?? 0) ? s : a)).key;
      tip = { kind: 'over', type: top.type, slot, n: plan.slots.find((s) => s.key === slot)?.target[top.type] ?? 0 };
    }
  } else if (short) {
    const slot = plan.slots.reduce((a, s) => ((s.target[short.type] ?? 0) > (a.target[short.type] ?? 0) ? s : a));
    tip = { kind: 'missing', type: short.type, slot: slot.key, n: slot.target[short.type] ?? 0 };
  }
  return { good, missing, over, tip };
}
