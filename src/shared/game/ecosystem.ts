// The season's ecosystem (docs/05-fichas-2.md §9): life that arrives in the garden as flowers grow. It only adds —
// nothing leaves during a season — and a new season starts its own garden.

export type EcoKey = 'butterflies' | 'tree' | 'bees' | 'birds' | 'pond' | 'fireflies';

/** Each visitor and the flowers (days with a plant) it waits for, in order. */
export const ECOSYSTEM: readonly { key: EcoKey; at: number }[] = [
  { key: 'butterflies', at: 3 },
  { key: 'tree', at: 5 },
  { key: 'bees', at: 7 },
  { key: 'birds', at: 10 },
  { key: 'pond', at: 14 },
  { key: 'fireflies', at: 21 },
];

export interface Ecosystem {
  has: ReadonlySet<EcoKey>;
  next: { key: EcoKey; at: number } | null;
  /** The tree's growth, 0 (sapling) to 1 (grown). */
  tree: number;
}

export function ecosystem(flowers: number): Ecosystem {
  const tree = ECOSYSTEM.find((e) => e.key === 'tree')?.at ?? 5;
  return {
    has: new Set(ECOSYSTEM.filter((e) => flowers >= e.at).map((e) => e.key)),
    next: ECOSYSTEM.find((e) => flowers < e.at) ?? null,
    tree: Math.min(1, Math.max(0, (flowers - tree) / 16)),
  };
}
