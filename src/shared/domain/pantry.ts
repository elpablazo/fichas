// Inventory is optional. These restrictions apply only to Kitchen, never to food logging/checking.
import { ALIASES } from './aliases';
import { makeItem } from './items';
import { autoTitle, equivalentUsage, fingerprint, preferredEquivalent } from './recipes';
import { computeStatus } from './status';
import { norm, singularCandidates } from './text';
import type { Equivalent, LogRow, MenuRow, PantryRow, PlanData, RecipeRow, Suggestion, Units } from './types';
import { equivalentById, typesOf, unitsOfItems } from './units';

export interface PantryItem {
  label: string;
  equivalent_ids: string[];
}
export interface KitchenIdea extends Suggestion {
  missing: string[];
}
const UTENSILS = /^(sarten|olla|cuchara|cuchillo|plato|vaso|servilleta|esponja|detergente)s?$/;

function words(text: string) {
  return norm(text)
    .split(' ')
    .map((w) => singularCandidates(w));
}
function same(a: string, b: string) {
  const aw = words(a);
  const bw = words(b);
  return aw.length === bw.length && aw.every((w, i) => w.some((v) => bw[i]?.includes(v)));
}

export function matchPantry(text: string, plan: PlanData): { items: PantryItem[]; unmatched: string[] } {
  const items: PantryItem[] = [];
  const unmatched: string[] = [];
  for (const raw of text.split(/[,;\n]+|\s+y\s+/i).slice(0, 30)) {
    const label = raw
      .trim()
      .replace(/^\d+(?:[.,]\d+)?\s*(?:kg|g|ml|tazas?|piezas?|latas?|paquetes?)?\s*/i, '')
      .slice(0, 120);
    if (!label || UTENSILS.test(norm(label))) continue;
    const ids = plan.equivalents
      .filter((e) => [e.food, ...e.aliases, ...(ALIASES[e.food] ?? [])].some((a) => same(a, label)))
      .map((e) => e.id)
      .slice(0, 20);
    items.push({ label, equivalent_ids: ids });
    if (!ids.length) unmatched.push(label);
  }
  return { items, unmatched };
}

export function availableIds(pantry: PantryRow[]): Set<string> {
  return new Set(
    pantry.filter((p) => !p.deleted_at && (p.state === 'have' || p.staple)).flatMap((p) => p.equivalent_ids),
  );
}

export function ideasFromPantry(
  plan: PlanData,
  remaining: Units,
  pantry: PantryRow[],
  recipes: RecipeRow[],
  logs: LogRow[],
): KitchenIdea[] {
  const needed = typesOf(remaining).filter((t) => (remaining[t] ?? 0) > 0);
  if (!needed.length) return [];
  const have = availableIds(pantry);
  const usage = equivalentUsage(logs);
  if (!have.size) return [];
  const preferred = preferredEquivalent(plan, usage, null);
  const choices = needed
    .map((type) => {
      const foods = plan.equivalents
        .filter((e) => e.type === type && have.has(e.id))
        .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
      const fallback = preferred(type);
      return { type, foods: foods.length ? foods : fallback ? [fallback] : [], missing: !foods.length };
    })
    .sort((a, b) => (remaining[b.type] ?? 0) - (remaining[a.type] ?? 0));
  if (choices.some((c) => !c.foods.length)) return [];
  const candidates = [];
  for (let a = 0; a < Math.min(2, choices[0]?.foods.length ?? 0); a++) {
    for (let b = 0; b < Math.min(2, choices[1]?.foods.length ?? 1); b++) {
      const selected = choices.map((c, i) => c.foods[i === 0 ? a : i === 1 ? b : 0] as Equivalent);
      const items = selected.map((e) => makeItem(e, (remaining[e.type] ?? 0) * e.qty));
      if (computeStatus(unitsOfItems(items, plan), remaining, plan.swaps).status !== 'on') continue;
      const fp = fingerprint(items);
      const recipe = recipes.find((r) => !r.deleted_at && !r.hidden && r.fingerprint === fp);
      const missing = selected.filter((e) => !have.has(e.id)).map((e) => e.id);
      let score = (recipe ? 5 : 0) + (!missing.length ? 3 : 0);
      for (let i = 0; i < selected.length; i++)
        for (let j = i + 1; j < selected.length; j++) {
          if (
            logs.some(
              (l) =>
                !l.deleted_at &&
                l.items.some((it) => it.equivalent_id === selected[i]?.id) &&
                l.items.some((it) => it.equivalent_id === selected[j]?.id),
            )
          )
            score += 2;
        }
      candidates.push({
        score,
        fp,
        idea: {
          title: recipe?.title ?? autoTitle(items, plan),
          items,
          recipe_id: recipe?.id,
          origin: 'pantry' as const,
          changes: [],
          missing,
        },
      });
    }
  }
  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.fp)) return false;
      seen.add(c.fp);
      return true;
    })
    .slice(0, 3)
    .map((c) => c.idea);
}

/** Provider ideas must use the actual table and available foods, and reach on without inventing units. */
export function validateIdea(
  idea: { title: string; items: { equivalent_id: string; qty: number; unit: string }[] },
  plan: PlanData,
  remaining: Units,
  have: Set<string>,
): KitchenIdea | null {
  if (!idea.items.length || idea.items.some((i) => !have.has(i.equivalent_id) || !Number.isFinite(i.qty) || i.qty <= 0))
    return null;
  const items = [];
  for (const item of idea.items) {
    const e = equivalentById(plan, item.equivalent_id);
    if (!e || item.unit !== e.unit || item.qty > 10000) return null;
    items.push(makeItem(e, item.qty));
  }
  if (computeStatus(unitsOfItems(items, plan), remaining, plan.swaps).status !== 'on') return null;
  return { title: idea.title.trim().split(/\s+/).slice(0, 4).join(' '), items, origin: 'ai', changes: [], missing: [] };
}

export function shoppingList(
  plan: PlanData,
  pantry: PantryRow[],
  menus: MenuRow[],
  day: string,
): { id: string; label: string; equivalent_ids: string[]; row?: PantryRow }[] {
  const out: { id: string; label: string; equivalent_ids: string[]; row?: PantryRow }[] = pantry
    .filter((p) => !p.deleted_at && (p.on_list || p.state === 'out'))
    .map((p) => ({ id: p.id, label: p.label, equivalent_ids: p.equivalent_ids, row: p }));
  const have = availableIds(pantry);
  const missing = new Set(
    menus
      .filter((m) => !m.deleted_at && m.accepted_at && m.day >= day)
      .flatMap((m) => m.items.map((i) => i.equivalent_id).filter((id): id is string => !!id && !have.has(id))),
  );
  const represented = new Set(out.flatMap((p) => p.equivalent_ids));
  for (const id of missing) {
    const e = equivalentById(plan, id);
    if (e && !represented.has(id)) out.push({ id: `need:${id}`, label: e.food, equivalent_ids: [id], row: undefined });
  }
  return out;
}
