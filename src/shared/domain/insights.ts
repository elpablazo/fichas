// "¿Qué lo causó?" (docs/05-fichas-2.md §6): which foods brought each food type, per meal and per day, so a
// "1 🫓 de más" always comes with its reason ("el pan del sándwich"). Pure; numbers match computeStatus.
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

/** "el pan de caja" style short name of a contributor, for "vino de …" lines. */
export function contributorName(c: Contributor): string {
  const name = c.label.replace(/^\s*[\d½¼¾⅓⅔.,/]+\s*(tz|tza|cda|cdta|g|ml|reb|pza|lata|latas|paquete|barra)?\s*/i, '');
  return name || c.label;
}
