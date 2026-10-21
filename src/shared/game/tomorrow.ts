import { equivalentUsage, fingerprint, preferredEquivalent } from '../domain/recipes';
import { pantryOk, suggest } from '../domain/suggest';
import type { LogRow, MenuRow, PantryRow, PlanRow, RecipeRow, Suggestion } from '../domain/types';

export function planTomorrow(
  plan: PlanRow,
  day: string,
  recipes: RecipeRow[],
  logs: LogRow[],
  pantry: PantryRow[],
  menus: MenuRow[],
  now: number,
): { slot: string; label: string; options: Suggestion[] }[] {
  const used = new Set<string>();
  const preferred = preferredEquivalent(plan.data, equivalentUsage(logs), null);
  return plan.data.slots.map((s) => {
    const options = suggest({
      plan: plan.data,
      rules: plan.data.swaps,
      slotKey: s.key,
      day,
      now,
      remaining: s.target,
      recipes: recipes.filter((r) => !used.has(r.fingerprint)),
      menus: menus.filter((m) => !used.has(fingerprint(m.items))),
      logs,
      pantry,
      preferred,
    }).sort((a, b) => Number(pantryOk(b.items, pantry)) - Number(pantryOk(a.items, pantry)));
    if (options[0]) used.add(fingerprint(options[0].items));
    return { slot: s.key, label: s.label, options };
  });
}
