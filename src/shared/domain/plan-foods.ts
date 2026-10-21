// Stable IDs for equivalent food names; portions and preparation text are never changed.
import { FOOD_NAMES } from './food-names';
import { norm, singularCandidates } from './text';
import type { TypeKey, UnitName } from './types';

const synonyms: Partial<Record<TypeKey, Record<string, string>>> = {
  carb_sg: { habanera: 'galleta habanera', salada: 'galleta salada', 'birote sin migajon': 'birote' },
  protein_poa: {
    cottage: 'queso cottage',
    'parmesano rallado': 'queso parmesano rallado',
    'cheddar bajo en grasa': 'queso cheddar bajo en grasa',
    oaxaca: 'queso oaxaca',
    fresco: 'queso fresco',
    blanco: 'queso blanco',
    panela: 'queso panela',
    carne: 'carne de res',
  },
  legume: { 'frijol promedio': 'frijol', 'lenteja cocida': 'lenteja' },
  sugar_sg: {
    'paleta helada de agua pequena': 'paleta helada de agua',
    'arandano seco c/a': 'arándano seco con azúcar',
    'arandano seco c a': 'arándano seco con azúcar',
  },
  fat_sp: { 'cocoa 80': 'cocoa', 'aceite es spray': 'aceite en spray', aceite: 'aceite vegetal' },
};
const words = (text: string) =>
  norm(text.replace(/\bs\/\s*/g, 'sin '))
    .split(' ')
    .filter((w) => !['de', 'en'].includes(w));
function sameWords(a: string, b: string): boolean {
  const left = words(a);
  const right = words(b);
  return (
    left.length === right.length &&
    left.every((word, i) => singularCandidates(word).some((form) => singularCandidates(right[i]!).includes(form)))
  );
}

export function canonicalPlanFood(raw: string, type: TypeKey, unit?: UnitName): string {
  const key = norm(raw);
  const known = FOOD_NAMES[type] ?? [];
  if (type === 'carb_sg' && unit === 'barra' && key === 'cereal') return 'barra de cereal';
  const exact = known.find((food) => norm(food) === key);
  if (exact) return exact;
  for (const [alias, food] of Object.entries(synonyms[type] ?? {})) if (sameWords(alias, key)) return food;
  const same = known.filter((food) => sameWords(food, key));
  if (same.length === 1) return same[0]!;
  if (type === 'protein_poa') {
    const cheeses = known.filter((food) => food.startsWith('queso ') && sameWords(food.slice(6), key));
    if (cheeses.length === 1) return cheeses[0]!;
  }
  if (type === 'veg') {
    // The vocabulary's generic name inherits the printed cooking condition; retain it in food text.
    const base = key.replace(/ (?:cocid[oa]s?|crud[oa]s?)$/, '').replace(/^verdura (?:cocida|cruda)\s+(?=\w)/, '');
    const matches = known.filter((food) => sameWords(food, base));
    if (matches.length === 1) return matches[0]!;
  }
  return raw.trim().toLowerCase();
}
