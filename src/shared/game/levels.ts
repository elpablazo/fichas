// Lifetime levels: XP = logged eating occasions (R9). Levels widen the garden's species pool and unlock cosmetics.
export const THRESHOLDS = [0, 10, 25, 50, 80, 120, 170, 230, 300, 380, 470, 570, 680, 800];

export type UnlockKind = 'species' | 'theme' | 'celebration' | 'token';
export const UNLOCKS: { level: number; kind: UnlockKind; key: string }[] = [
  { level: 2, kind: 'species', key: 'species_2' },
  { level: 3, kind: 'theme', key: 'talavera' },
  { level: 4, kind: 'species', key: 'species_4' },
  { level: 5, kind: 'celebration', key: 'papel' },
  { level: 6, kind: 'species', key: 'species_6' },
  { level: 7, kind: 'theme', key: 'noche' },
  { level: 8, kind: 'species', key: 'species_8' },
  { level: 9, kind: 'token', key: 'gema' },
  { level: 10, kind: 'species', key: 'species_10' },
];

export function threshold(level: number): number {
  return THRESHOLDS[level - 1] ?? 800 + (level - THRESHOLDS.length) * 130;
}

export function levelProgress(xp: number) {
  let level = 1;
  while (xp >= threshold(level + 1)) level++;
  return { level, xp, from: threshold(level), next: threshold(level + 1) };
}

/** The next unlock at or after a level (for the progress preview). */
export function nextUnlock(level: number) {
  return UNLOCKS.find((u) => u.level > level) ?? null;
}

export function accents(level: number) {
  const names = ['cobalto', 'bosque', 'uva', 'oceano'];
  return Array.from({ length: Math.max(0, level - 10) }, (_, i) => names[i] ?? `color_${i + 11}`);
}
