// "Tu día" and "cuadrar el día" (docs/03-redesign.md §3.2–3.3).
// Accounting uses the plan's slot targets: the day total is the nutritionist's, balancing only moves it.
import { computeStatus, slotState } from './status';
import { normalize } from './swaps';
import type { LogRow, PlanData, Rebalance, SwapRule, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';
import { sumUnits } from './units';

/** Types that may be reduced later in the day. Protein, legumes and vegetables are never reduced. */
export const BALANCEABLE: readonly TypeKey[] = [
  'carb_sg',
  'carb_cg',
  'sugar_sg',
  'sugar_cg',
  'fat_sp',
  'fat_cp',
  'fruit',
  'dairy',
];
/** A meal keeps at least this share of its target for each type. */
const KEEP = 0.5;
const EPS = 1e-6;

export interface Adjustment {
  slot: string;
  type: TypeKey;
  from: number;
  to: number;
}

export interface DayBalance {
  /** Effective target per planned slot: the plan's, minus balancing for unresolved slots. */
  targets: Units[];
  adjustments: Adjustment[];
  /** The day's planned totals. */
  planned: Units;
  /** Eaten so far: each resolved slot normalized against its plan target, plus extras. */
  eaten: Units;
  /** Resolved meals + extras − their planned targets, per type (positive = over). */
  net: Units;
  /** Overage that balancing could not (or may not) absorb, ≥ ½ unit. */
  unabsorbed: Units;
  /** Which planned slots are resolved (meal or skip). */
  resolved: boolean[];
}

/** Effective rule: an explicit owner setting wins; then an explicit plan rule; else allowed (owner, 2026-10-09). */
export function balancingEnabled(setting: Rebalance, planRule: Rebalance): boolean {
  if (setting !== 'unknown') return setting === 'allowed';
  return planRule !== 'not_allowed';
}

export function balanceDay(plan: PlanData, dayLogs: LogRow[], rules: SwapRule[], enabled: boolean): DayBalance {
  const live = dayLogs.filter((l) => !l.deleted_at);
  const planned = sumUnits(plan.slots.map((s) => s.target));
  const net: Units = {};
  const parts: Units[] = [];
  const resolved = plan.slots.map((s) => {
    const st = slotState(
      live.filter((l) => l.slot === s.key),
      s.target,
      rules,
    );
    if (!st.resolved) return false;
    const eaten = st.kind === 'meal' ? computeStatus(st.eaten, s.target, rules).normalized : {};
    parts.push(eaten);
    for (const t of TYPE_KEYS) {
      const d = (eaten[t] ?? 0) - (s.target[t] ?? 0);
      if (Math.abs(d) > EPS) net[t] = (net[t] ?? 0) + d;
    }
    return true;
  });
  const extras = normalize(
    sumUnits(live.filter((l) => l.slot === 'extra' && l.kind === 'meal').map((l) => l.raw_units)),
    {},
    rules,
  );
  parts.push(extras);
  for (const t of TYPE_KEYS) if (extras[t]) net[t] = (net[t] ?? 0) + (extras[t] ?? 0);

  const targets = plan.slots.map((s) => ({ ...s.target }));
  const adjustments: Adjustment[] = [];
  const unabsorbed: Units = {};
  const open = plan.slots.map((_, i) => i).filter((i) => !resolved[i]);
  for (const t of TYPE_KEYS) {
    let over = Math.floor(((net[t] ?? 0) + EPS) * 2) / 2;
    if (over < 0.5) continue;
    if (enabled && BALANCEABLE.includes(t)) {
      const cut = new Map<number, number>();
      while (over > EPS) {
        const room = (i: number) => (plan.slots[i]?.target[t] ?? 0) * KEEP - (cut.get(i) ?? 0);
        const pick = (min: number) => {
          let best = -1;
          let bestLeft = 0;
          for (const i of open) {
            if (room(i) < min - EPS) continue;
            const left = (plan.slots[i]?.target[t] ?? 0) - (cut.get(i) ?? 0);
            // Largest current target first; ties go to the later meal.
            if (best < 0 || left > bestLeft + EPS || (Math.abs(left - bestLeft) <= EPS && i > best)) {
              best = i;
              bestLeft = left;
            }
          }
          return best;
        };
        // Whole units whenever they fit (one tortilla, not two halves).
        const whole = over >= 1 - EPS ? pick(1) : -1;
        const i = whole >= 0 ? whole : pick(0.5);
        if (i < 0) break;
        const step = whole >= 0 ? 1 : 0.5;
        cut.set(i, (cut.get(i) ?? 0) + step);
        over -= step;
      }
      for (const [i, c] of [...cut].sort((a, b) => a[0] - b[0])) {
        const slot = plan.slots[i];
        const target = targets[i];
        if (!slot || !target) continue;
        const from = slot.target[t] ?? 0;
        const to = Math.max(0, from - c);
        if (to > EPS) target[t] = to;
        else delete target[t];
        adjustments.push({ slot: slot.key, type: t, from, to });
      }
    }
    if (over >= 0.5 - EPS) unabsorbed[t] = over;
  }
  return { targets, adjustments, planned, eaten: sumUnits(parts), net, unabsorbed, resolved };
}
