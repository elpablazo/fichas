// Builds log rows (pure). Units are always recomputed from the plan table (§10.1).
import { computeStatus } from './status';
import { normalize } from './swaps';
import type { LogItem, LogRow, LogSource, PlanData, Status, SwapRule, Units } from './types';
import { addUnits, subUnitsFloor, sumUnits, unitsOfItems } from './units';

export interface BuildLogInput {
  id: string;
  plan_id: string;
  plan: PlanData;
  rules: SwapRule[];
  day: string;
  slot: string; // slot key or 'extra'
  title: string;
  items: LogItem[];
  source: LogSource;
  recipe_id?: string | null;
  now: number;
  eaten_at?: number;
  /** Effective target of the slot ({} for extras). */
  target: Units;
  /** Existing non-deleted logs of the same day and slot (excluding this one). */
  slotLogs: LogRow[];
}

export function buildLog(input: BuildLogInput): LogRow {
  const { plan, rules, items, slot, target } = input;
  const raw = unitsOfItems(items, plan);
  const allFree = items.length > 0 && items.every((i) => i.free);
  const kind = allFree ? 'free' : 'meal';
  let status: Status;
  let units: Units;
  if (kind === 'free') {
    status = 'free';
    units = {};
  } else if (slot === 'extra') {
    status = 'extra';
    units = raw;
  } else {
    const prior = sumUnits(input.slotLogs.filter((l) => l.kind === 'meal' && !l.deleted_at).map((l) => l.raw_units));
    const remainingBefore = subUnitsFloor(target, normalize(prior, target, rules));
    units = normalize(raw, remainingBefore, rules);
    status = computeStatus(addUnits(prior, raw), target, rules).status;
  }
  return {
    id: input.id,
    plan_id: input.plan_id,
    day: input.day,
    slot,
    kind,
    title: input.title,
    items,
    raw_units: raw,
    units,
    target: slot === 'extra' ? {} : { ...target },
    status,
    source: input.source,
    recipe_id: input.recipe_id ?? null,
    eaten_at: input.eaten_at ?? input.now,
    created_at: input.now,
    updated_at: input.now,
    deleted_at: null,
    rev: 0,
  };
}

export function buildSkip(input: Pick<BuildLogInput, 'id' | 'plan_id' | 'day' | 'slot' | 'now' | 'target'>): LogRow {
  return {
    id: input.id,
    plan_id: input.plan_id,
    day: input.day,
    slot: input.slot,
    kind: 'skip',
    title: '',
    items: [],
    raw_units: {},
    units: {},
    target: { ...input.target },
    status: 'skip',
    source: 'suggestion',
    recipe_id: null,
    eaten_at: input.now,
    created_at: input.now,
    updated_at: input.now,
    deleted_at: null,
    rev: 0,
  };
}

/** Remaining target of a slot after its existing meal logs. */
export function remainingTarget(target: Units, slotLogs: LogRow[], rules: SwapRule[]): Units {
  const prior = sumUnits(slotLogs.filter((l) => l.kind === 'meal' && !l.deleted_at).map((l) => l.raw_units));
  return subUnitsFloor(target, normalize(prior, target, rules));
}
