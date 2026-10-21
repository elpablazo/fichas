import seed from '../../seed/plan-2026-10-08.json';
import { itemLabel } from '../../src/shared/domain/format';
import { buildLog } from '../../src/shared/domain/log';
import { DEFAULT_SWAPS } from '../../src/shared/domain/swaps';
import type { LogItem, LogRow, LogSource, PlanData, UnitName } from '../../src/shared/domain/types';
import { equivalentById } from '../../src/shared/domain/units';

export const plan = seed as unknown as PlanData;
export const rules = DEFAULT_SWAPS;

export function item(id: string, qty: number, unit?: UnitName): LogItem {
  const e = equivalentById(plan, id);
  if (!e) throw new Error(`no equivalent ${id}`);
  const u = unit ?? e.unit;
  return {
    label: itemLabel(e.food, qty, u),
    qty,
    unit: u,
    equivalent_id: id,
    units: {},
    estimated: false,
    assumed_qty: false,
    free: false,
  };
}

export function free(label: string): LogItem {
  return {
    label,
    qty: 1,
    unit: 'pza',
    equivalent_id: null,
    units: {},
    estimated: false,
    assumed_qty: false,
    free: true,
  };
}

let n = 0;
export function log(
  day: string,
  slot: string,
  items: LogItem[],
  extra: Partial<LogRow> = {},
  source: LogSource = 'suggestion',
): LogRow {
  const s = plan.slots.find((x) => x.key === slot);
  return {
    ...buildLog({
      id: `log-${++n}`,
      plan_id: 'plan-2026-10-08',
      plan,
      rules,
      day,
      slot,
      title: 't',
      items,
      source,
      now: Date.parse(`${day}T18:00:00Z`),
      target: s?.target ?? {},
      slotLogs: [],
    }),
    ...extra,
  };
}

export const slotTarget = (key: string) => plan.slots.find((s) => s.key === key)?.target ?? {};
