// What changed in each version, newest first (the "Novedades" sheet after an update). Every commit with a visible
// change adds a line to the top release; a new version adds a new release (see CLAUDE.md). Checked by copy:lint.

export type ChangeIcon =
  | 'palette'
  | 'tubes'
  | 'ring'
  | 'sun'
  | 'list'
  | 'plate'
  | 'search'
  | 'link'
  | 'bell'
  | 'flower'
  | 'refresh'
  | 'chart'
  | 'spark';

export interface Release {
  version: string;
  date: string;
  title: string;
  items: { icon: ChangeIcon; text: string }[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.0.0',
    date: '2026-10-22',
    title: 'Fichas 2.0',
    items: [
      { icon: 'palette', text: 'Nueva cara: verde invernadero, letras con carácter e íconos propios.' },
      { icon: 'tubes', text: 'Tu día en tubos: la flechita marca lo planeado hasta ahora.' },
      { icon: 'ring', text: 'El anillo de tu día: llévalo al 100 llenando cada grupo.' },
      { icon: 'sun', text: 'Elige la comida moviendo el sol, y la hora en que comiste.' },
      { icon: 'list', text: 'Un platillo por renglón: cada ingrediente queda en su platillo.' },
      { icon: 'plate', text: 'Al anotar ves tu comida contra su plan, lugar por lugar.' },
      { icon: 'search', text: 'Toca un tubo: qué lo llenó y cuánto es una ficha.' },
      { icon: 'refresh', text: 'Cuando hay versión nueva, un toque y se actualiza.' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-21',
    title: 'Fichas, más simple',
    items: [
      { icon: 'tubes', text: 'Arriba, cómo va tu día: lo que te queda de cada grupo.' },
      { icon: 'sun', text: 'Antes de comer, una idea. Después, anotas en segundos.' },
      { icon: 'list', text: 'Escribe como hablas: se entiende mientras escribes.' },
    ],
  },
];

/** "2.0.0" → [2, 0, 0]; missing parts count as 0. */
function parts(v: string): number[] {
  return v.split('.').map((x) => Number.parseInt(x, 10) || 0);
}

export function newer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

/** Releases after the last version this device saw (just the latest when it never recorded one). */
export function releasesSince(seen: string | null): Release[] {
  if (!seen) return CHANGELOG.slice(0, 1);
  return CHANGELOG.filter((r) => newer(r.version, seen));
}
