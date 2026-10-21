// Garden species (docs/03-redesign.md §5). Each day grows one plant; its species stays secret until it blooms.
// Deterministic by day so every device shows the same garden. No red flowers (anti-shame rule 1).
import { daysBetween } from '../domain/day';
import { calendarPetal, randomFor } from './surprise';

export type FlowerShape =
  | 'radial'
  | 'cluster'
  | 'rose'
  | 'spike'
  | 'cup'
  | 'calla'
  | 'orchid'
  | 'lotus'
  | 'bract'
  | 'nopal';
export type PetalShape = 'ellipse' | 'pointed' | 'round' | 'notched';

export interface Species {
  id: string;
  name: string;
  latin: string;
  fact: string;
  /** Level that adds it to the pool; 0 = rare, -1 = seasonal. */
  level: number;
  shape: FlowerShape;
  petal: PetalShape;
  petals: number;
  layers: number;
  colors: { petal: string; shade: string; center: string };
}

export const SPECIES: Species[] = [
  {
    id: 'margarita',
    name: 'Margarita',
    latin: 'Bellis perennis',
    fact: 'Abre con el sol y se cierra al anochecer.',
    level: 1,
    shape: 'radial',
    petal: 'ellipse',
    petals: 20,
    layers: 1,
    colors: { petal: '#FFFFFF', shade: '#EDE6DD', center: '#F5B82E' },
  },
  {
    id: 'girasol',
    name: 'Girasol',
    latin: 'Helianthus annuus',
    fact: 'De joven, sigue al sol de este a oeste.',
    level: 1,
    shape: 'radial',
    petal: 'pointed',
    petals: 18,
    layers: 2,
    colors: { petal: '#FFC93C', shade: '#F2A81D', center: '#6B4423' },
  },
  {
    id: 'cosmos',
    name: 'Mirasol',
    latin: 'Cosmos bipinnatus',
    fact: 'El cosmos es originario de México.',
    level: 1,
    shape: 'radial',
    petal: 'notched',
    petals: 8,
    layers: 1,
    colors: { petal: '#F7A1C4', shade: '#E77FB0', center: '#F5C13A' },
  },
  {
    id: 'tulipan',
    name: 'Tulipán',
    latin: 'Tulipa',
    fact: 'Sigue creciendo aun después de cortado.',
    level: 1,
    shape: 'cup',
    petal: 'ellipse',
    petals: 3,
    layers: 1,
    colors: { petal: '#E599F7', shade: '#C762E0', center: '#F5C13A' },
  },
  {
    id: 'dalia',
    name: 'Dalia',
    latin: 'Dahlia pinnata',
    fact: 'Es la flor nacional de México.',
    level: 2,
    shape: 'radial',
    petal: 'pointed',
    petals: 12,
    layers: 3,
    colors: { petal: '#F05BA6', shade: '#C2006A', center: '#F7C948' },
  },
  {
    id: 'lavanda',
    name: 'Lavanda',
    latin: 'Lavandula angustifolia',
    fact: 'Su nombre viene del latín lavare: lavar.',
    level: 2,
    shape: 'spike',
    petal: 'round',
    petals: 14,
    layers: 1,
    colors: { petal: '#9775FA', shade: '#7048E8', center: '#B197FC' },
  },
  {
    id: 'nomeolvides',
    name: 'Nomeolvides',
    latin: 'Myosotis',
    fact: 'Su nombre ya es una promesa.',
    level: 2,
    shape: 'cluster',
    petal: 'round',
    petals: 5,
    layers: 5,
    colors: { petal: '#7FB2F0', shade: '#4C8BE0', center: '#FFE066' },
  },
  {
    id: 'campanilla',
    name: 'Campanilla',
    latin: 'Ipomoea purpurea',
    fact: 'Abre por la mañana y cierra por la tarde.',
    level: 4,
    shape: 'radial',
    petal: 'round',
    petals: 5,
    layers: 1,
    colors: { petal: '#6E8BFF', shade: '#4263EB', center: '#FFFFFF' },
  },
  {
    id: 'gerbera',
    name: 'Gerbera',
    latin: 'Gerbera jamesonii',
    fact: 'Es pariente del girasol y la margarita.',
    level: 4,
    shape: 'radial',
    petal: 'ellipse',
    petals: 16,
    layers: 2,
    colors: { petal: '#FF9F6B', shade: '#FF7F50', center: '#5A3A2E' },
  },
  {
    id: 'violeta',
    name: 'Violeta',
    latin: 'Viola odorata',
    fact: 'Le dio su nombre a un color.',
    level: 4,
    shape: 'radial',
    petal: 'round',
    petals: 5,
    layers: 1,
    colors: { petal: '#8E6CEF', shade: '#5F3DC4', center: '#FFD43B' },
  },
  {
    id: 'hortensia',
    name: 'Hortensia',
    latin: 'Hydrangea macrophylla',
    fact: 'Su color cambia según el suelo.',
    level: 6,
    shape: 'cluster',
    petal: 'round',
    petals: 4,
    layers: 9,
    colors: { petal: '#9DB4FF', shade: '#B197FC', center: '#E7F5FF' },
  },
  {
    id: 'alcatraz',
    name: 'Alcatraz',
    latin: 'Zantedeschia aethiopica',
    fact: 'Diego Rivera la pintó una y otra vez.',
    level: 6,
    shape: 'calla',
    petal: 'ellipse',
    petals: 1,
    layers: 1,
    colors: { petal: '#FFFFFF', shade: '#E9E4DA', center: '#F5C13A' },
  },
  {
    id: 'amapola',
    name: 'Amapola dorada',
    latin: 'Eschscholzia californica',
    fact: 'Cierra sus pétalos en los días nublados.',
    level: 6,
    shape: 'radial',
    petal: 'round',
    petals: 4,
    layers: 1,
    colors: { petal: '#FFB238', shade: '#FF8C1A', center: '#F59F00' },
  },
  {
    id: 'rosa',
    name: 'Rosa',
    latin: 'Rosa',
    fact: 'Hay fósiles de rosa de 35 millones de años.',
    level: 8,
    shape: 'rose',
    petal: 'round',
    petals: 13,
    layers: 3,
    colors: { petal: '#FF9EBB', shade: '#F06595', center: '#D6336C' },
  },
  {
    id: 'bugambilia',
    name: 'Bugambilia',
    latin: 'Bougainvillea',
    fact: 'Su color está en las brácteas, no en la flor.',
    level: 8,
    shape: 'bract',
    petal: 'round',
    petals: 3,
    layers: 3,
    colors: { petal: '#E64BB5', shade: '#BE2F94', center: '#FFF9DB' },
  },
  {
    id: 'jacaranda',
    name: 'Jacaranda',
    latin: 'Jacaranda mimosifolia',
    fact: 'Pinta de morado la CDMX en primavera.',
    level: 8,
    shape: 'cluster',
    petal: 'notched',
    petals: 5,
    layers: 7,
    colors: { petal: '#A78BFA', shade: '#7C5CFF', center: '#F3F0FF' },
  },
  {
    id: 'nopal',
    name: 'Flor de nopal',
    latin: 'Opuntia ficus-indica',
    fact: 'Cada flor dura apenas uno o dos días.',
    level: 10,
    shape: 'nopal',
    petal: 'ellipse',
    petals: 10,
    layers: 2,
    colors: { petal: '#FFE066', shade: '#FCC419', center: '#94D82D' },
  },
  {
    id: 'galan',
    name: 'Galán de noche',
    latin: 'Cestrum nocturnum',
    fact: 'Solo perfuma de noche.',
    level: 10,
    shape: 'cluster',
    petal: 'pointed',
    petals: 5,
    layers: 7,
    colors: { petal: '#EEF3C6', shade: '#C9D98B', center: '#A9C24F' },
  },
  {
    id: 'orquidea',
    name: 'Orquídea',
    latin: 'Laelia anceps',
    fact: 'Hay más de 25 mil especies de orquídea.',
    level: 0,
    shape: 'orchid',
    petal: 'ellipse',
    petals: 5,
    layers: 1,
    colors: { petal: '#E599F7', shade: '#AE3EC9', center: '#FFD43B' },
  },
  {
    id: 'loto',
    name: 'Loto',
    latin: 'Nelumbo nucifera',
    fact: 'Sus hojas repelen el agua y el lodo.',
    level: 0,
    shape: 'lotus',
    petal: 'pointed',
    petals: 9,
    layers: 2,
    colors: { petal: '#FFD1E3', shade: '#F783AC', center: '#F5D06F' },
  },
  {
    id: 'magnolia',
    name: 'Magnolia',
    latin: 'Magnolia grandiflora',
    fact: 'Ya existía antes que las abejas.',
    level: 0,
    shape: 'cup',
    petal: 'ellipse',
    petals: 6,
    layers: 2,
    colors: { petal: '#FFF7F0', shade: '#F8C8D8', center: '#E0C46C' },
  },
  {
    id: 'cempasuchil',
    name: 'Cempasúchil',
    latin: 'Tagetes erecta',
    fact: 'Guía a las almas en Día de Muertos.',
    level: -1,
    shape: 'radial',
    petal: 'round',
    petals: 14,
    layers: 4,
    colors: { petal: '#FFA41B', shade: '#F77F00', center: '#E8590C' },
  },
  {
    id: 'nochebuena',
    name: 'Nochebuena',
    latin: 'Euphorbia pulcherrima',
    fact: 'Es de México; lo rosa son hojas.',
    level: -1,
    shape: 'radial',
    petal: 'pointed',
    petals: 7,
    layers: 2,
    colors: { petal: '#F78FB3', shade: '#E8649A', center: '#C8D44E' },
  },
];

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export const RARE_CHANCE = 0.12;
const EPOCH = '2026-01-05'; // a Monday: weeks start on Monday

/** Regular species unlocked at a level, in catalog order. */
export function speciesPool(level: number): Species[] {
  return SPECIES.filter((s) => s.level >= 1 && s.level <= level);
}

function shuffled<T>(list: T[], seed: string): T[] {
  return list
    .map((v, i) => ({ v, k: randomFor(`${seed}:${i}`) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

/**
 * The species a day's plant becomes. Seasonal species own their calendar window; otherwise ~12 % of days
 * are rare, and regular days walk a weekly shuffle of the unlocked pool, so neighbours rarely repeat.
 */
export function speciesFor(day: string, level: number): Species {
  const seasonal = calendarPetal(day);
  if (seasonal) return SPECIES_BY_ID.get(seasonal) as Species;
  if (randomFor(`rare:${day}`) < RARE_CHANCE) {
    const rare = SPECIES.filter((s) => s.level === 0);
    return rare[Math.floor(randomFor(`rare-pick:${day}`) * rare.length)] ?? (rare[0] as Species);
  }
  const pool = speciesPool(Math.max(1, level));
  const n = daysBetween(EPOCH, day);
  const week = Math.floor(n / 7);
  const order = shuffled(pool, `week:${week}:${pool.length}`);
  return order[(((n % 7) + 7) % 7) % order.length] as Species;
}

export function isRare(s: Species): boolean {
  return s.level === 0;
}

export type Stage = 'soil' | 'seed' | 'sprout' | 'bud' | 'bloom' | 'full' | 'gold';
export const BLOOMED: Stage[] = ['bloom', 'full', 'gold'];

/**
 * Growth by the day's logged occasions. A day "counts" at ≥ 2 occasions (R1): a finished day with two blooms.
 * Days without meals stay seeds, never wilted (anti-shame rule 5).
 */
export function plantStage(s: {
  n: number;
  future: boolean;
  closed: boolean;
  casaLlena: boolean;
  redondo: boolean;
}): Stage {
  if (s.future) return 'soil';
  if (s.redondo) return 'gold';
  if (s.casaLlena) return 'full';
  if (s.n >= 3 || (s.closed && s.n >= 2)) return 'bloom';
  if (s.n >= 2 || (s.closed && s.n >= 1)) return 'bud';
  if (s.n >= 1) return 'sprout';
  return 'seed';
}
