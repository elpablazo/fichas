// LogItem helpers: creation from equivalents, quantity changes, natural steps.
import { labelFor, relabel } from './format';
import type { Equivalent, LogItem, PlanData, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';
import { convert, equivalentById, unitsOfItem } from './units';

export function makeItem(e: Equivalent, qty: number, assumed = false): LogItem {
  return {
    label: labelFor(e, qty),
    qty,
    unit: e.unit,
    equivalent_id: e.id,
    units: { [e.type]: qty / e.qty },
    estimated: false,
    assumed_qty: assumed,
    free: false,
  };
}

export function freeItem(label: string): LogItem {
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

/** Natural step for steppers and fitting (§11.2). */
export function naturalStep(unit: string, e?: Equivalent): number {
  switch (unit) {
    case 'pza':
      return e && e.unit === 'pza' && e.qty < 1 ? e.qty : 1;
    case 'tza':
      return 0.25;
    case 'cda':
    case 'cdta':
      return 0.5;
    case 'g':
    case 'ml':
      return 10;
    case 'reb':
      return 1;
    default:
      return e && e.unit === unit ? e.qty : 1;
  }
}

export function stepOf(item: LogItem, plan: PlanData | null): number {
  const e = plan ? equivalentById(plan, item.equivalent_id) : undefined;
  return naturalStep(item.unit, e);
}

/** Same item with a new quantity; units and label recomputed. */
export function withQty(item: LogItem, qty: number, plan: PlanData | null): LogItem {
  const q = Math.max(0, Math.round(qty * 10000) / 10000);
  const e = plan ? equivalentById(plan, item.equivalent_id) : undefined;
  if (e && !item.free) {
    const conv = convert(q, item.unit, e.unit);
    if (conv !== null) {
      const sameUnit = item.unit === e.unit;
      return {
        ...item,
        qty: q,
        units: { [e.type]: conv / e.qty },
        label: sameUnit ? labelFor(e, q) : relabel(item, q),
        assumed_qty: false,
      };
    }
  }
  const scale = item.qty > 0 ? q / item.qty : 0;
  const units: Units = {};
  for (const t of TYPE_KEYS) {
    const v = item.units[t];
    if (v) units[t] = v * scale;
  }
  return { ...item, qty: q, units, label: relabel(item, q), assumed_qty: false };
}

/** The main type of an item: its equivalent's type, or its largest estimated type. */
export function mainType(item: LogItem, plan: PlanData | null): TypeKey | null {
  const e = plan ? equivalentById(plan, item.equivalent_id) : undefined;
  if (e) return e.type;
  let best: TypeKey | null = null;
  let max = 0;
  for (const t of TYPE_KEYS) {
    const v = item.units[t] ?? 0;
    if (v > max) {
      max = v;
      best = t;
    }
  }
  return best;
}

/** Units of `type` contributed by one quantity unit of the item (for fitting). */
export function unitsPerQty(item: LogItem, type: TypeKey, plan: PlanData | null): number {
  if (item.qty <= 0) return 0;
  return (unitsOfItem(item, plan)[type] ?? 0) / item.qty;
}
