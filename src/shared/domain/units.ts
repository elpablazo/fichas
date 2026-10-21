// Units math (§3.3): conversions, unitsOf, sums and display rounding.
import type { Equivalent, LogItem, PlanData, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';

const ML: Record<string, number> = { tza: 240, cda: 15, cdta: 5, ml: 1 };
const EPS = 1e-6;

/** Converts qty between units. Volume units interconvert; everything else only to itself. */
export function convert(qty: number, from: string, to: string): number | null {
  if (from === to) return qty;
  const a = ML[from];
  const b = ML[to];
  if (a !== undefined && b !== undefined) return (qty * a) / b;
  return null;
}

const indexCache = new WeakMap<PlanData, Map<string, Equivalent>>();
export function equivalentIndex(plan: PlanData): Map<string, Equivalent> {
  let idx = indexCache.get(plan);
  if (!idx) {
    idx = new Map(plan.equivalents.map((e) => [e.id, e]));
    indexCache.set(plan, idx);
  }
  return idx;
}
export function equivalentById(plan: PlanData, id: string | null | undefined): Equivalent | undefined {
  return id ? equivalentIndex(plan).get(id) : undefined;
}

/** Raw units of one item. Recomputed from the plan table when possible; else the stored estimate. */
export function unitsOfItem(item: LogItem, plan: PlanData | null): Units {
  if (item.free) return {};
  if (plan && item.equivalent_id) {
    const e = equivalentById(plan, item.equivalent_id);
    if (e) {
      const q = convert(item.qty, item.unit, e.unit);
      if (q !== null) return { [e.type]: q / e.qty };
    }
  }
  return { ...item.units };
}

export function unitsOfItems(items: LogItem[], plan: PlanData | null): Units {
  return sumUnits(items.map((i) => unitsOfItem(i, plan)));
}

export function addUnits(a: Units, b: Units, k = 1): Units {
  const out: Units = { ...a };
  for (const t of TYPE_KEYS) {
    const v = b[t];
    if (v) out[t] = (out[t] ?? 0) + v * k;
  }
  return clean(out);
}

export function sumUnits(list: Units[]): Units {
  return list.reduce<Units>((acc, u) => addUnits(acc, u), {});
}

/** a − b, floored at 0 per type. */
export function subUnitsFloor(a: Units, b: Units): Units {
  const out: Units = {};
  for (const t of TYPE_KEYS) {
    const v = (a[t] ?? 0) - (b[t] ?? 0);
    if (v > EPS) out[t] = v;
  }
  return out;
}

export function clean(u: Units): Units {
  const out: Units = {};
  for (const t of TYPE_KEYS) {
    const v = u[t];
    if (v !== undefined && Math.abs(v) > EPS) out[t] = v;
  }
  return out;
}

export function totalUnits(u: Units): number {
  let s = 0;
  for (const t of TYPE_KEYS) s += u[t] ?? 0;
  return s;
}

export function typesOf(...us: Units[]): TypeKey[] {
  return TYPE_KEYS.filter((t) => us.some((u) => Math.abs(u[t] ?? 0) > EPS));
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Display rounding for unit counts: nearest ¼ with glyphs. */
export function formatCount(n: number): string {
  const r = roundTo(n, 0.25);
  const whole = Math.floor(r + EPS);
  const frac = r - whole;
  const glyph = frac > 0.7 ? '¾' : frac > 0.4 ? '½' : frac > 0.1 ? '¼' : '';
  if (!glyph) return String(whole);
  return whole ? `${whole}${glyph}` : glyph;
}

/** Display of food quantities: thirds and quarters as glyphs, else ≤ 2 decimals. */
export function formatQty(q: number): string {
  const whole = Math.floor(q + EPS);
  const frac = q - whole;
  const glyphs: [number, string][] = [
    [1 / 4, '¼'],
    [1 / 3, '⅓'],
    [1 / 2, '½'],
    [2 / 3, '⅔'],
    [3 / 4, '¾'],
  ];
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  for (const [v, g] of glyphs) if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${g}` : g;
  return String(Math.round(q * 100) / 100);
}
