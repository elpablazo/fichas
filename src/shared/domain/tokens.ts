// Token display model: hollow (to eat), full (eaten), "+" (extra). Half units render half-filled.
import type { TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';

export interface TokenModel {
  type: TypeKey;
  fill: 0 | 0.5 | 1;
  extra: boolean;
  /** A target token worth half a unit. */
  half: boolean;
}

const EPS = 1e-6;

export function tokensFor(target: Units, eaten: Units): TokenModel[] {
  const out: TokenModel[] = [];
  for (const type of TYPE_KEYS) {
    const T = Math.round((target[type] ?? 0) * 2) / 2;
    const E = Math.round((eaten[type] ?? 0) * 2) / 2;
    const n = Math.ceil(T - EPS);
    for (let i = 0; i < n; i++) {
      const cap = Math.min(1, T - i);
      const f = Math.max(0, Math.min(cap, E - i));
      out.push({ type, fill: f >= cap - EPS ? 1 : f > EPS ? 0.5 : 0, extra: false, half: cap < 1 - EPS });
    }
    const extra = E - T;
    const m = Math.ceil(extra - EPS);
    for (let j = 0; j < m; j++) {
      out.push({ type, fill: extra - j >= 1 - EPS ? 1 : 0.5, extra: true, half: false });
    }
  }
  return out;
}

/** Counts for accessibility labels. */
export function tokenCounts(
  target: Units,
  eaten: Units,
): { type: TypeKey; full: number; total: number; extra: number }[] {
  return TYPE_KEYS.filter((t) => (target[t] ?? 0) > EPS || (eaten[t] ?? 0) > EPS).map((t) => {
    const T = target[t] ?? 0;
    const E = eaten[t] ?? 0;
    return { type: t, full: Math.min(T, E), total: T, extra: Math.max(0, E - T) };
  });
}
