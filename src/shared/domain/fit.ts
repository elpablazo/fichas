// fit() (§11.2): adjust real-food quantities so a dish matches a target, in ≤ 3 passes.
import { mainType, makeItem, naturalStep, stepOf, unitsPerQty, withQty } from './items';
import { normalize } from './swaps';
import type { Equivalent, FitChange, LogItem, PlanData, SwapRule, TypeKey, Units } from './types';
import { roundTo, typesOf, unitsOfItems } from './units';

export interface FitCtx {
  plan: PlanData;
  rules: SwapRule[];
  /** Owner's preferred equivalent for a type (history → slot example → first of type). */
  preferred: (t: TypeKey) => Equivalent | undefined;
}

export interface FitResult {
  items: LogItem[];
  changes: FitChange[];
}

const NEVER_ADD: TypeKey[] = ['sugar_sg', 'sugar_cg', 'carb_cg'];
const TOL = 0.25;
const EPS = 1e-6;

interface Work {
  item: LogItem;
  orig: number | null;
  removed: boolean;
}

export function fit(items: LogItem[], target: Units, ctx: FitCtx): FitResult {
  const { plan, rules } = ctx;
  let work: Work[] = items.map((item, i) => ({ item, orig: i, removed: false }));
  const live = () => work.filter((w) => !w.removed);
  const current = () =>
    normalize(
      unitsOfItems(
        live().map((w) => w.item),
        plan,
      ),
      target,
      rules,
    );
  const deviation = (n: Units) => typesOf(target, n).reduce((s, t) => s + Math.abs((n[t] ?? 0) - (target[t] ?? 0)), 0);

  const ownType = (w: Work) => mainType(w.item, plan);

  function step(w: Work, rawDelta: number): number {
    const s = stepOf(w.item, plan);
    return Math.max(s, roundTo(rawDelta, s));
  }

  function reduce(t: TypeKey, d: number): boolean {
    let best: Work | null = null;
    let bestUnits = 0;
    let factor = 1; // units of `t` removed per unit of the item's own contributing type
    let srcType: TypeKey = t;
    for (const w of live()) {
      const u = unitsPerQty(w.item, t, plan) * w.item.qty;
      if (u > bestUnits + EPS) {
        best = w;
        bestUnits = u;
      }
    }
    if (!best) {
      for (const w of live()) {
        const own = ownType(w);
        if (!own) continue;
        const rule = rules.find((r) => r.from === own && (r.to[t] ?? 0) > 0);
        const u = unitsPerQty(w.item, own, plan) * w.item.qty;
        if (rule && u > bestUnits + EPS) {
          best = w;
          bestUnits = u;
          factor = rule.to[t] ?? 1;
          srcType = own;
        }
      }
    }
    if (!best) return false;
    const per = unitsPerQty(best.item, srcType, plan);
    if (per <= 0) return false;
    const q = step(best, d / factor / per);
    const next = best.item.qty - q;
    if (next <= EPS) best.removed = true;
    else best.item = withQty(best.item, next, plan);
    return true;
  }

  function increase(t: TypeKey, need: number): boolean {
    let best: Work | null = null;
    let bestUnits = -1;
    let srcType: TypeKey = t;
    for (const w of live()) {
      if (ownType(w) !== t || w.item.free) continue;
      const u = unitsPerQty(w.item, t, plan) * w.item.qty;
      if (u > bestUnits) {
        best = w;
        bestUnits = u;
      }
    }
    if (!best && (t === 'fat_sp' || t === 'fat_cp')) {
      const other: TypeKey = t === 'fat_sp' ? 'fat_cp' : 'fat_sp';
      best = live().find((w) => ownType(w) === other && !w.item.free) ?? null;
      if (best) srcType = other;
    }
    if (best) {
      const per = unitsPerQty(best.item, srcType, plan);
      if (per <= 0) return false;
      best.item = withQty(best.item, best.item.qty + step(best, need / per), plan);
      return true;
    }
    if (NEVER_ADD.includes(t)) return false;
    const e = ctx.preferred(t);
    if (!e) return false;
    const s = naturalStep(e.unit, e);
    const qty = Math.max(s, roundTo(need * e.qty, s));
    work.push({ item: makeItem(e, qty), orig: null, removed: false });
    return true;
  }

  for (let pass = 0; pass < 3; pass++) {
    let progressed = false;
    const order = typesOf(target, current())
      .map((t) => [t, (current()[t] ?? 0) - (target[t] ?? 0)] as const)
      .filter(([, d]) => Math.abs(d) >= TOL)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (!order.length) break;
    for (const [t] of order) {
      const n = current();
      const d = (n[t] ?? 0) - (target[t] ?? 0);
      if (Math.abs(d) < TOL) continue;
      const before = deviation(n);
      const snapshot = work.map((w) => ({ ...w }));
      const applied = d > 0 ? reduce(t, d) : increase(t, -d);
      if (!applied) continue;
      if (deviation(current()) >= before - EPS) {
        work = snapshot;
        continue;
      }
      progressed = true;
    }
    if (!progressed) break;
  }

  const final = work.filter((w) => !w.removed);
  const changes: FitChange[] = [];
  final.forEach((w, idx) => {
    if (w.orig === null) changes.push({ added: w.item });
    else if (Math.abs(w.item.qty - (items[w.orig]?.qty ?? 0)) > EPS) {
      changes.push({ item_index: idx, from_qty: items[w.orig]?.qty ?? 0, to_qty: w.item.qty });
    }
  });
  for (const w of work) if (w.removed && w.orig !== null) changes.push({ removed_index: w.orig });
  return { items: final.map((w) => w.item), changes };
}

/** Indexes (in the fitted list) of items whose quantity changed or that were added. */
export function changedIndexes(result: FitResult): Set<number> {
  const out = new Set<number>();
  for (const c of result.changes) {
    if ('item_index' in c) out.add(c.item_index);
    else if ('added' in c) {
      const i = result.items.indexOf(c.added);
      if (i >= 0) out.add(i);
    }
  }
  return out;
}
