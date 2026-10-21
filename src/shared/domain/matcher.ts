// matchText (§11.5): local, offline food-text parser. Complete matches never touch the network.
import { ALIASES, DESCRIPTORS, ZERO_CONDIMENTS } from './aliases';
import { itemLabel } from './format';
import { freeItem, naturalStep } from './items';
import { autoTitle } from './recipes';
import { capitalize, norm, singularCandidates } from './text';
import type { Equivalent, LogItem, PlanData, RecipeRow, UnitName, Units } from './types';
import { convert, roundTo } from './units';

export interface ParseResult {
  title: string;
  items: LogItem[];
  confidence: 'high' | 'medium' | 'low';
  source: 'local' | 'cache' | 'ai';
  model?: string;
  ms: number;
}

interface Phrase {
  tokens: string[];
  eq?: Equivalent;
  free?: string;
}

const COUNT_UNITS = new Set(['pza', 'reb', 'lata', 'paquete', 'barra', 'disparo', 'mitad']);
const NUM_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  catorce: 14,
  quince: 15,
  dieciocho: 18,
  veinte: 20,
  media: 0.5,
  medio: 0.5,
};
const GLYPHS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const UNIT_WORDS: Record<string, UnitName> = {
  taza: 'tza',
  tz: 'tza',
  tza: 'tza',
  cucharada: 'cda',
  cda: 'cda',
  cucharadita: 'cdta',
  cdta: 'cdta',
  cdita: 'cdta',
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  ml: 'ml',
  mililitro: 'ml',
  pieza: 'pza',
  pza: 'pza',
  rebanada: 'reb',
  reb: 'reb',
  lata: 'lata',
  paquete: 'paquete',
  barra: 'barra',
};
const STOP = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'con',
  'y',
  'e',
  'a',
  'al',
  'en',
  'mas',
  '+',
  'o',
  'mi',
  'unos',
  'unas',
  'sin',
]);
const DESC = new Set(DESCRIPTORS.map(norm));
const isDescriptor = (tok: string) => singularCandidates(tok).some((c) => DESC.has(c));

const phraseCache = new WeakMap<PlanData, Phrase[]>();
function phrases(plan: PlanData): Phrase[] {
  let list = phraseCache.get(plan);
  if (list) return list;
  list = [];
  for (const e of plan.equivalents) {
    const names = new Set([e.food, ...e.aliases, ...(ALIASES[e.food] ?? [])].map(norm));
    for (const name of names) list.push({ tokens: name.split(' '), eq: e });
  }
  for (const f of [...plan.free_foods, ...ZERO_CONDIMENTS]) {
    const names = new Set([f, ...(ALIASES[f] ?? [])].map(norm));
    for (const name of names) list.push({ tokens: name.split(' '), free: f });
  }
  list.sort((a, b) => b.tokens.length - a.tokens.length);
  phraseCache.set(plan, list);
  return list;
}

function tokenMatches(input: string, phraseTok: string): boolean {
  return singularCandidates(input).includes(phraseTok) || singularCandidates(phraseTok).includes(input);
}

function matchPhraseAt(tokens: string[], i: number, plan: PlanData): { phrase: Phrase; len: number } | null {
  for (const p of phrases(plan)) {
    if (i + p.tokens.length > tokens.length) continue;
    let ok = true;
    for (let j = 0; j < p.tokens.length; j++) {
      if (!tokenMatches(tokens[i + j] as string, p.tokens[j] as string)) {
        ok = false;
        break;
      }
    }
    if (ok) return { phrase: p, len: p.tokens.length };
  }
  return null;
}

/** Parses a quantity at i. Returns [value, tokens consumed] or null. */
function parseQty(tokens: string[], i: number): [number, number] | null {
  const t = tokens[i];
  if (t === undefined) return null;
  const next = tokens[i + 1];
  const frac = (s: string | undefined): number | null => {
    if (!s) return null;
    if (GLYPHS[s] !== undefined) return GLYPHS[s] as number;
    const m = s.match(/^(\d+)\/(\d+)$/);
    return m ? Number(m[1]) / Number(m[2]) : null;
  };
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    const f = frac(next);
    if (f !== null && f < 1) return [n + f, 2];
    return [n, 1];
  }
  const f = frac(t);
  if (f !== null) return [f, 1];
  const m = t.match(/^(\d+)([½¼¾⅓⅔])$/);
  if (m) return [Number(m[1]) + (GLYPHS[m[2] as string] ?? 0), 1];
  if (NUM_WORDS[t] !== undefined) {
    const n = NUM_WORDS[t] as number;
    if (next === 'tercio' || next === 'tercios') return [n / 3, 2];
    if (next === 'cuarto' || next === 'cuartos') return [n / 4, 2];
    if (next === 'par' && tokens[i + 2] === 'de') return [2, 3];
    return [n, 1];
  }
  return null;
}

function parseUnit(tok: string | undefined): UnitName | null {
  if (!tok) return null;
  for (const c of singularCandidates(tok)) if (UNIT_WORDS[c]) return UNIT_WORDS[c] as UnitName;
  return null;
}

export interface MatchOutcome {
  /** Every non-stopword token consumed. */
  complete: boolean;
  items: LogItem[];
  /** Tokens not understood. */
  unknown: string[];
}

/**
 * Parses free text into items. Missing amounts assume the slot's remaining target for that type
 * (min 1 unit) and are marked `assumed_qty`.
 */
export function parseItems(text: string, plan: PlanData, remaining: Units = {}): MatchOutcome {
  const tokens = norm(text).split(' ').filter(Boolean);
  const items: LogItem[] = [];
  const unknown: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const start = i;
    let qty: number | null = null;
    let unit: UnitName | null = null;
    const q = parseQty(tokens, i);
    if (q) {
      qty = q[0];
      i += q[1];
    }
    const u = parseUnit(tokens[i]);
    if (u && (qty !== null || tokens[i + 1] === 'de')) {
      unit = u;
      i++;
      if (qty === null) qty = 1;
    }
    if (tokens[i] === 'de' && (qty !== null || unit !== null)) i++;
    const m = i < tokens.length ? matchPhraseAt(tokens, i, plan) : null;
    if (m) {
      i += m.len;
      if (m.phrase.free) {
        items.push(freeItem(m.phrase.free));
        continue;
      }
      const e = m.phrase.eq as Equivalent;
      let itemQty: number;
      let itemUnit: string = e.unit;
      let assumed = false;
      if (qty !== null && unit !== null) {
        if (convert(qty, unit, e.unit) === null) {
          unknown.push(...tokens.slice(start, i));
          continue;
        }
        itemQty = qty;
        itemUnit = unit;
      } else if (qty !== null) {
        if (COUNT_UNITS.has(e.unit)) itemQty = qty;
        else {
          itemQty = qty * e.qty;
          assumed = true;
        }
      } else {
        const need = Math.max(1, remaining[e.type] ?? 1);
        const s = naturalStep(e.unit, e);
        itemQty = Math.max(s, roundTo(need * e.qty, s));
        assumed = true;
      }
      const conv = convert(itemQty, itemUnit, e.unit) as number;
      items.push({
        label: itemLabel(e.food, itemQty, itemUnit),
        qty: itemQty,
        unit: itemUnit,
        equivalent_id: e.id,
        units: { [e.type]: conv / e.qty },
        estimated: false,
        assumed_qty: assumed,
        free: false,
      });
      continue;
    }
    if (qty !== null || unit !== null) {
      // A quantity not followed by a known food.
      unknown.push(...tokens.slice(start, i + 1));
      i++;
      continue;
    }
    const tok = tokens[i] as string;
    if (!STOP.has(tok) && !isDescriptor(tok)) unknown.push(tok);
    i++;
  }
  return { complete: unknown.length === 0 && items.length > 0, items, unknown };
}

/** Full local parse (§11.5). Returns null when the text needs AI. */
export function matchText(
  text: string,
  plan: PlanData,
  recipes: RecipeRow[],
  remaining: Units = {},
): ParseResult | null {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const n = norm(text);
  if (!n) return null;
  const recipe = recipes.find((r) => !r.deleted_at && !r.hidden && norm(r.title) === n);
  const ms = () => (typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0);
  if (recipe) return { title: recipe.title, items: recipe.items, confidence: 'high', source: 'local', ms: ms() };
  const out = parseItems(text, plan, remaining);
  if (!out.complete) return null;
  const title = out.items.every((i) => i.free)
    ? capitalize(out.items.map((i) => i.label).join(', '))
    : autoTitle(out.items, plan);
  return { title: title || capitalize(text.trim()), items: out.items, confidence: 'high', source: 'local', ms: ms() };
}

export type Chip = { kind: 'recipe'; recipe: RecipeRow } | { kind: 'food'; eq: Equivalent };

/** Up to 3 suggestions while typing: recipes by title, then foods by name/alias prefix. */
export function localChips(text: string, plan: PlanData, recipes: RecipeRow[], slotKey?: string): Chip[] {
  const n = norm(text);
  if (n.length < 2) return [];
  const chips: Chip[] = [];
  const rs = recipes
    .filter((r) => !r.deleted_at && !r.hidden && norm(r.title).includes(n))
    .sort((a, b) => (b.slot_counts[slotKey ?? ''] ?? 0) - (a.slot_counts[slotKey ?? ''] ?? 0) || b.times - a.times);
  for (const r of rs.slice(0, 3)) chips.push({ kind: 'recipe', recipe: r });
  const last = n.split(' ').slice(-2).join(' ');
  const seen = new Set<string>();
  for (const e of plan.equivalents) {
    if (chips.length >= 3) break;
    if (seen.has(e.id)) continue;
    const names = [e.food, ...e.aliases].map(norm);
    if (names.some((x) => x.startsWith(last) || x.startsWith(n))) {
      chips.push({ kind: 'food', eq: e });
      seen.add(e.id);
    }
  }
  return chips.slice(0, 3);
}
