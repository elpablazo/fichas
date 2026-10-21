// "Tus platos": fingerprints, upsert on log, titles, and the owner's preferred equivalents.
import { shortName } from './format';
import { mainType } from './items';
import { capitalize, norm } from './text';
import type { Equivalent, LogItem, LogRow, PlanData, RecipeRow, TypeKey } from './types';
import { equivalentById, totalUnits, unitsOfItem } from './units';

function baseName(label: string): string {
  return norm(
    label.replace(/^\s*[\d½¼¾⅓⅔.,/]+\s*(tz|tza|cda|cdta|g|ml|reb|lata|latas|paquete|barra|disparo)?\s*/i, ''),
  );
}

/** Sorted equivalent ids / normalized labels of the non-free items. */
export function fingerprint(items: LogItem[]): string {
  const keys = items.filter((i) => !i.free).map((i) => i.equivalent_id ?? `x:${baseName(i.label)}`);
  return [...new Set(keys)].sort().join('|');
}

/** Title from the 2 largest items: "Pollo con tortillas". */
export function autoTitle(items: LogItem[], plan: PlanData | null): string {
  const named = items
    .filter((i) => !i.free)
    .map((i) => {
      const e = plan ? equivalentById(plan, i.equivalent_id) : undefined;
      const name = e ? shortName(e.food) : baseName(i.label);
      return { name, size: totalUnits(unitsOfItem(i, plan)), type: mainType(i, plan) };
    })
    .sort((a, b) => b.size - a.size || protFirst(a.type) - protFirst(b.type));
  const [a, b] = named;
  if (!a) return items[0]?.label ? capitalize(baseName(items[0].label)) : '';
  if (!b || b.name === a.name) return capitalize(a.name);
  return capitalize(`${a.name} con ${b.name}`);
}

function protFirst(t: TypeKey | null): number {
  return t === 'protein_poa' ? 0 : t === 'carb_sg' ? 1 : 2;
}

/** New or updated recipe after a meal log. Returns the row to write. */
export function upsertRecipe(existing: RecipeRow | undefined, log: LogRow, now: number, id: string): RecipeRow {
  const slotCounts = { ...(existing?.slot_counts ?? {}) };
  slotCounts[log.slot] = (slotCounts[log.slot] ?? 0) + 1;
  return {
    id: existing?.id ?? id,
    title: existing?.title || log.title,
    items: log.items,
    fingerprint: existing?.fingerprint ?? fingerprint(log.items),
    slot_counts: slotCounts,
    times: (existing?.times ?? 0) + 1,
    last_used_at: now,
    favorite: existing?.favorite ?? 0,
    hidden: existing?.hidden ?? 0,
    origin: existing?.origin ?? 'log',
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    rev: existing?.rev ?? 0,
  };
}

/** Usage counts of equivalents from meal logs (most-used first per type). */
export function equivalentUsage(logs: LogRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) {
    if (l.deleted_at || l.kind !== 'meal') continue;
    for (const i of l.items) if (i.equivalent_id) m.set(i.equivalent_id, (m.get(i.equivalent_id) ?? 0) + 1);
  }
  return m;
}

/** Preferred equivalent for a type: history → slot example → first table equivalent of that type. */
export function preferredEquivalent(
  plan: PlanData,
  usage: Map<string, number>,
  slotKey: string | null,
): (t: TypeKey) => Equivalent | undefined {
  return (t) => {
    let best: Equivalent | undefined;
    let bestN = 0;
    for (const e of plan.equivalents) {
      if (e.type !== t) continue;
      const n = usage.get(e.id) ?? 0;
      if (n > bestN) {
        best = e;
        bestN = n;
      }
    }
    if (best) return best;
    const slot = plan.slots.find((s) => s.key === slotKey);
    for (const it of slot?.example?.items ?? []) {
      const e = equivalentById(plan, it.options[0]?.equivalent_id);
      if (e?.type === t) return e;
    }
    for (const s of plan.slots) {
      for (const it of s.example?.items ?? []) {
        const e = equivalentById(plan, it.options[0]?.equivalent_id);
        if (e?.type === t) return e;
      }
    }
    return plan.equivalents.find((e) => e.type === t && e.source !== 'owner');
  };
}
