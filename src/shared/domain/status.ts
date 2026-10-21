// Slot status (§3.5). Status is information only: it never changes colors to red or reduces rewards.
import { normalize } from './swaps';
import type { LogRow, SwapRule, TypeKey, Units } from './types';
import { sumUnits, totalUnits, typesOf } from './units';

const EPS = 1e-6;

export type PlanStatusValue = 'on' | 'over' | 'under' | 'mixed';

export interface StatusResult {
  status: PlanStatusValue;
  normalized: Units;
  /** N − T per type (negative = still to eat). */
  deltas: Partial<Record<TypeKey, number>>;
}

export function computeStatus(E: Units, T: Units, rules: SwapRule[]): StatusResult {
  const normalized = normalize(E, T, rules);
  const deltas: Partial<Record<TypeKey, number>> = {};
  let over = false;
  let under = false;
  for (const t of typesOf(T, normalized)) {
    const d = (normalized[t] ?? 0) - (T[t] ?? 0);
    deltas[t] = d;
    if (d >= 0.5 - EPS) over = true;
    if (d <= -0.5 + EPS) under = true;
  }
  const status: PlanStatusValue = over && under ? 'mixed' : over ? 'over' : under ? 'under' : 'on';
  return { status, normalized, deltas };
}

/** Sum of overs (for choosing the small/big over copy). */
export function overAmount(deltas: Partial<Record<TypeKey, number>>): number {
  let s = 0;
  for (const v of Object.values(deltas)) if (v && v > 0) s += v;
  return s;
}

/** Unparsed descriptions count as occasions without inventing exchange units. */
export function isProvisional(log: Pick<LogRow, 'kind' | 'source' | 'items' | 'title'>): boolean {
  return log.kind === 'meal' && log.source === 'describe' && log.items.length === 0 && !!log.title.trim();
}

export function isOccasion(log: Pick<LogRow, 'kind' | 'raw_units' | 'deleted_at'> & Partial<LogRow>): boolean {
  return (
    !log.deleted_at &&
    log.kind === 'meal' &&
    (totalUnits(log.raw_units) > EPS || (!!log.items && !!log.source && !!log.title && isProvisional(log as LogRow)))
  );
}

export interface SlotState {
  resolved: boolean;
  /** 'meal' if any meal log, else 'skip' if skipped, else 'free' if only free logs, else 'none'. */
  kind: 'meal' | 'skip' | 'free' | 'none';
  eaten: Units; // raw sum of meal logs
  normalized: Units;
  status: PlanStatusValue | 'skip' | 'free' | null;
  logs: LogRow[];
}

/** State of one planned slot for a day from its (non-deleted) logs. */
export function slotState(logs: LogRow[], target: Units, rules: SwapRule[]): SlotState {
  const live = logs.filter((l) => !l.deleted_at);
  const meals = live.filter((l) => l.kind === 'meal');
  const skipped = live.some((l) => l.kind === 'skip');
  const eaten = sumUnits(meals.map((l) => l.raw_units));
  if (meals.length) {
    const r = computeStatus(eaten, target, rules);
    return { resolved: true, kind: 'meal', eaten, normalized: r.normalized, status: r.status, logs: live };
  }
  if (skipped) return { resolved: true, kind: 'skip', eaten, normalized: {}, status: 'skip', logs: live };
  if (live.length) return { resolved: false, kind: 'free', eaten, normalized: {}, status: 'free', logs: live };
  return { resolved: false, kind: 'none', eaten, normalized: {}, status: null, logs: live };
}
