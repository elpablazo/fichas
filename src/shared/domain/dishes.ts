// Dishes inside a meal (docs/05-fichas-2.md §4): ingredients grouped by the dish they belong to, the meal's
// one-line title, and local understanding of "one dish per line" descriptions. Pure.
import { knownText, parseItems, unknownPhrases } from './matcher';
import { autoTitle } from './recipes';
import { capitalize, norm } from './text';
import type { LogItem, LogRow, PlanData, Units } from './types';

export interface DishGroup {
  /** The dish's name, or null for an item on its own. */
  name: string | null;
  /** Indexes into the meal's items, in order. */
  items: number[];
}

/** Items grouped by dish (first appearance order); items without a dish stand alone. */
export function groupItems(items: readonly LogItem[]): DishGroup[] {
  const out: DishGroup[] = [];
  const byName = new Map<string, DishGroup>();
  items.forEach((it, i) => {
    const name = it.dish?.trim();
    if (!name) {
      out.push({ name: null, items: [i] });
      return;
    }
    const k = norm(name);
    const g = byName.get(k);
    if (g) g.items.push(i);
    else {
      const ng: DishGroup = { name, items: [i] };
      byName.set(k, ng);
      out.push(ng);
    }
  });
  return out;
}

/** A dish whose only ingredient already says it ("1 manzana" in "Manzana") reads as a plain item. */
export function isPlainItem(group: DishGroup, items: readonly LogItem[]): boolean {
  if (!group.name) return true;
  if (group.items.length !== 1) return false;
  const label = norm(items[group.items[0] as number]?.label ?? '');
  const name = norm(group.name);
  return label === name || label.endsWith(` ${name}`) || label.includes(` ${name} `);
}

const lowerFirst = (s: string) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(s) ? s[0]?.toLowerCase() + s.slice(1) : s);

const TITLE_MAX = 46;

/** "Sándwich de pollo + media arepa + latte": the meal in one line, from its dishes (at most three).
 *  Meals without dishes keep the classic two-food title ("Pollo con tortillas"). */
export function mealTitle(items: readonly LogItem[], plan: PlanData | null): string {
  if (!items.some((i) => i.dish)) return autoTitle([...items], plan);
  const parts: string[] = [];
  for (const g of groupItems(items)) {
    const first = items[g.items[0] as number];
    const name = g.name ?? (first ? autoTitle([first], plan) : '');
    if (name && !parts.some((p) => norm(p) === norm(name))) parts.push(name.trim());
  }
  let out = capitalize(parts[0] ?? '');
  for (const p of parts.slice(1, 3)) {
    const next = `${out} + ${lowerFirst(p)}`;
    if (next.length > TITLE_MAX) break;
    out = next;
  }
  return out;
}

/** The lines of a description that hold something (one dish per line). */
export function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s•\-*·]+/, '').trim())
    .filter((l) => l.length > 0);
}

/** The name a typed line gives its dish: as written, without a trailing period or a list of portions. */
export function dishName(line: string, items: readonly LogItem[], plan: PlanData): string {
  const clean = line.replace(/[.;:]+$/, '').trim();
  if (clean.includes(',')) return autoTitle([...items], plan) || capitalize(clean.slice(0, 40));
  return capitalize(clean.slice(0, 60));
}

/** Dishes the owner already logged, by normalized name (latest version wins): typed again, they're instant. */
export function knownDishes(logs: readonly LogRow[]): Map<string, { name: string; items: LogItem[] }> {
  const out = new Map<string, { name: string; items: LogItem[]; at: number }>();
  for (const l of logs) {
    if (l.deleted_at || l.kind !== 'meal') continue;
    for (const g of groupItems(l.items)) {
      if (!g.name) continue;
      const k = norm(g.name);
      const prev = out.get(k);
      if (prev && prev.at >= l.eaten_at) continue;
      out.set(k, { name: g.name, items: g.items.map((i) => l.items[i] as LogItem), at: l.eaten_at });
    }
  }
  return new Map([...out].map(([k, v]) => [k, { name: v.name, items: v.items }]));
}

export interface LineParse {
  /** Items the plan table (or the owner's own dishes) understood, tagged with their line's dish. */
  items: LogItem[];
  /** Phrases that still need JEV and the meal AI. */
  phrases: string[];
}

/** Local understanding of a description. With several lines, each line is one dish: its known foods are
 *  grouped under it (a line with a single food stays a plain item). A line naming a dish the owner logged
 *  before brings that dish back whole. */
export function parseDescription(
  text: string,
  plan: PlanData,
  remaining: Units,
  known: ReadonlyMap<string, { name: string; items: LogItem[] }> = new Map(),
): LineParse {
  const all = lines(text);
  const items: LogItem[] = [];
  const phrases: string[] = [];
  for (const line of all) {
    const mine = known.get(norm(line));
    if (mine) {
      items.push(...mine.items.map((i) => ({ ...i, dish: mine.name })));
      continue;
    }
    const local = parseItems(knownText(line, plan), plan, remaining).items;
    const unknown = unknownPhrases(line, plan);
    phrases.push(...unknown.filter((p) => !phrases.includes(p)));
    const grouped = all.length > 1 && (local.length > 1 || (local.length === 1 && unknown.length > 0));
    const name = grouped ? dishName(line, local, plan) : null;
    items.push(...local.map((i) => (name ? { ...i, dish: name } : i)));
  }
  return { items, phrases: phrases.slice(0, 6) };
}
