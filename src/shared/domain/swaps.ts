// Swap normalization (§3.4): eaten types standing in for planned types.
import type { SwapRule, TypeKey, Units } from './types';
import { clean } from './units';

const EPS = 1e-9;

export const DEFAULT_SWAPS: SwapRule[] = [
  { kind: 'decompose', from: 'carb_cg', to: { carb_sg: 1, fat_sp: 1 }, confirmed: false, source: 'default' },
  { kind: 'decompose', from: 'sugar_cg', to: { sugar_sg: 1, fat_sp: 1 }, confirmed: false, source: 'default' },
  { kind: 'substitute', from: 'fat_cp', to: { fat_sp: 1 }, confirmed: false, source: 'default' },
  { kind: 'substitute', from: 'fat_sp', to: { fat_cp: 1 }, confirmed: false, source: 'default' },
];

function entries(u: Units): [TypeKey, number][] {
  return Object.entries(u) as [TypeKey, number][];
}

export function normalize(E: Units, T: Units, rules: SwapRule[]): Units {
  const e: Units = { ...E };
  for (const r of rules) {
    if (r.kind !== 'decompose') continue;
    const surplus = Math.max(0, (e[r.from] ?? 0) - (T[r.from] ?? 0));
    if (surplus > EPS) {
      e[r.from] = (e[r.from] ?? 0) - surplus;
      for (const [k, m] of entries(r.to)) e[k] = (e[k] ?? 0) + surplus * m;
    }
  }
  for (const r of rules) {
    if (r.kind !== 'substitute') continue;
    const first = entries(r.to)[0];
    if (!first) continue;
    const [k, m] = first;
    const surplus = Math.max(0, (e[r.from] ?? 0) - (T[r.from] ?? 0));
    const shortfall = Math.max(0, (T[k] ?? 0) - (e[k] ?? 0));
    const moved = Math.min(surplus, shortfall / m);
    if (moved > EPS) {
      e[r.from] = (e[r.from] ?? 0) - moved;
      e[k] = (e[k] ?? 0) + moved * m;
    }
  }
  return clean(e);
}
