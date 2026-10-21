// suggest() (§11.1): up to 3 plan-fitting dishes for a slot, best first.
import { addDays, DAY_MS, weekday } from './day';
import { type FitCtx, fit } from './fit';
import { makeItem, naturalStep } from './items';
import { autoTitle, fingerprint } from './recipes';
import { computeStatus } from './status';
import type {
  Equivalent,
  LogRow,
  MenuRow,
  PantryRow,
  PlanData,
  RecipeRow,
  Suggestion,
  SwapRule,
  TypeKey,
  Units,
} from './types';
import { TYPE_KEYS } from './types';
import { roundTo, typesOf, unitsOfItems } from './units';

export interface SuggestCtx {
  plan: PlanData;
  rules: SwapRule[];
  slotKey: string;
  day: string;
  now: number;
  /** Slot target minus what's already logged in the slot. */
  remaining: Units;
  recipes: RecipeRow[];
  menus: MenuRow[];
  /** Recent non-deleted logs (≥ 28 days). */
  logs: LogRow[];
  pantry: PantryRow[];
  preferred: (t: TypeKey) => Equivalent | undefined;
}

interface Candidate {
  s: Suggestion;
  score: number;
  created: number;
  maxChanges: number;
  fp: string;
}

export function pantryOk(items: { equivalent_id: string | null }[], pantry: PantryRow[]): boolean {
  for (const it of items) {
    if (!it.equivalent_id) continue;
    const p = pantry.find((r) => !r.deleted_at && r.equivalent_ids.includes(it.equivalent_id as string));
    if (p && p.state === 'out' && !p.staple) return false;
  }
  return true;
}

export function suggest(ctx: SuggestCtx): Suggestion[] {
  const { plan, rules, slotKey, day, now, remaining } = ctx;
  if (!typesOf(remaining).length) return [];
  const fitCtx: FitCtx = { plan, rules, preferred: ctx.preferred };
  const wd = weekday(day);
  const since28 = addDays(day, -28);
  const todayRecipeIds = new Set(
    ctx.logs.filter((l) => l.day === day && !l.deleted_at && l.recipe_id).map((l) => l.recipe_id as string),
  );
  const candidates: Candidate[] = [];

  const menu = ctx.menus.find((m) => m.day === day && m.slot === slotKey && m.accepted_at && !m.deleted_at);
  if (menu) {
    candidates.push({
      s: {
        title: menu.title,
        items: menu.items,
        recipe_id: menu.recipe_id ?? undefined,
        origin: 'menu',
        changes: [],
        tag: 'menu',
      },
      score: 100,
      created: 0,
      maxChanges: 3,
      fp: fingerprint(menu.items),
    });
  }

  for (const r of ctx.recipes) {
    if (r.deleted_at || r.hidden || !r.items.length) continue;
    const count = r.slot_counts[slotKey];
    let score: number;
    let maxChanges = 3;
    let tag: Suggestion['tag'];
    if (count && count > 0) {
      const daysSince = r.last_used_at ? Math.max(0, (now - r.last_used_at) / DAY_MS) : Number.POSITIVE_INFINITY;
      const sameWeekday = ctx.logs.some(
        (l) => l.recipe_id === r.id && l.slot === slotKey && !l.deleted_at && l.day >= since28 && weekday(l.day) === wd,
      );
      score =
        10 * Math.log2(1 + count) +
        6 * Math.exp(-daysSince / 14) +
        3 * (sameWeekday ? 1 : 0) +
        4 * (pantryOk(r.items, ctx.pantry) ? 1 : 0) -
        8 * (todayRecipeIds.has(r.id) ? 1 : 0) +
        (r.favorite ? 6 : 0);
      if (count >= 3) tag = 'classic';
    } else if (r.origin === 'seed' && count === 0) {
      score = 5;
      tag = 'seed';
    } else if (r.times > 0) {
      score = 2 * Math.log2(1 + r.times);
      maxChanges = 2;
    } else continue;
    candidates.push({
      s: {
        title: r.title,
        items: r.items,
        recipe_id: r.id,
        origin: r.origin === 'seed' ? 'seed' : 'recipe',
        changes: [],
        tag,
      },
      score,
      created: r.created_at,
      maxChanges,
      fp: r.fingerprint,
    });
  }

  const fitted = candidates.map((c) => {
    const res = fit(c.s.items, remaining, fitCtx);
    const status = computeStatus(unitsOfItems(res.items, plan), remaining, rules).status;
    return {
      c,
      s: { ...c.s, items: res.items, changes: res.changes },
      ok: status === 'on' && res.changes.length <= c.maxChanges,
    };
  });
  let pool = fitted.filter((f) => f.ok);
  if (!pool.length) pool = fitted.filter((f) => f.c.maxChanges === 3);
  // Ties (e.g. the nutritionist's seed dishes) keep the plan's order: first option first.
  pool.sort(
    (a, b) =>
      Number(b.s.origin === 'menu') - Number(a.s.origin === 'menu') ||
      b.c.score - a.c.score ||
      a.c.created - b.c.created,
  );
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of pool) {
    if (seen.has(f.c.fp)) continue;
    seen.add(f.c.fp);
    out.push(f.s);
    if (out.length === 3) break;
  }
  if (!out.length) {
    const built = fromTarget(remaining, ctx);
    if (built) out.push(built);
  }
  return out;
}

/** A dish built from the owner's preferred equivalent of each remaining type. */
export function fromTarget(remaining: Units, ctx: Pick<SuggestCtx, 'plan' | 'preferred'>): Suggestion | null {
  const items = [];
  for (const t of TYPE_KEYS) {
    const need = remaining[t] ?? 0;
    if (need < 0.25) continue;
    const e = ctx.preferred(t);
    if (!e) continue;
    const s = naturalStep(e.unit, e);
    items.push(makeItem(e, Math.max(s, roundTo(need * e.qty, s))));
  }
  if (!items.length) return null;
  return { title: autoTitle(items, ctx.plan), items, origin: 'seed', changes: [] };
}
