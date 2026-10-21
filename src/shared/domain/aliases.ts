// Alias dictionary (Appendix A minimum set + matcher helpers) and reference portions for sanity checks.
// Keys are plan food names (accented, as in the plan). Matching normalizes accents and plurals.

export const ALIASES: Record<string, string[]> = {
  'tortilla de maíz': ['tortilla', 'tortillas', 'tortilla de maiz'],
  'carne de res': ['carne', 'bistec', 'res', 'carne molida', 'bistec de res'],
  pollo: ['pechuga de pollo', 'pollo deshebrado', 'pechuga'],
  pescado: ['filete de pescado', 'tilapia'],
  'queso panela': ['panela'],
  'pan de caja': ['pan integral', 'pan blanco', 'pan'],
  'bollo de hamburguesa': ['pan de hamburguesa'],
  telera: ['pan de torta'],
  'leche de vaca descremada': ['leche', 'leche light', 'latte', 'leche descremada'],
  'yogurt descremado': ['yogur', 'yogurt natural', 'yogurt natural descremado', 'yogur natural', 'yogurt'],
  'verdura cocida': ['verdura', 'verduras', 'verduras al vapor', 'verdura al vapor', 'verduras cocidas'],
  'aceite vegetal': ['aceite'],
  'crema de cacahuate': ['mantequilla de maní', 'mantequilla de mani', 'peanut butter'],
  refresco: ['coca', 'coca-cola', 'coca cola', 'soda'],
  'refresco zero': ['coca zero', 'coca light', 'refresco light'],
  'agua mineral': ['topo chico', 'agua con gas'],
  café: ['café americano', 'café negro', 'espresso', 'americano'],
  'arroz cocido': ['arroz', 'arroz blanco'],
  frijol: ['frijoles', 'frijoles de la olla'],
  'jitomate saladet': ['jitomate', 'tomate'],
  calabacita: ['calabacitas'],
  plátano: ['plátano tabasco'],
  'pan dulce': ['concha', 'dona', 'cuerno'],
  'avena en hojuelas': ['avena'],
  'galleta maría': ['galletas marías', 'maría'],
  'mango ataúlfo': ['mango'],
  'clara de huevo': ['claras'],
  'atún drenado': ['atún en lata', 'lata de atún'],
};

/** Words that describe preparation without changing the count (matcher skips them). */
export const DESCRIPTORS = [
  'revuelto',
  'cocido',
  'cocida',
  'asado',
  'asada',
  'hervido',
  'hervida',
  'natural',
  'entero',
  'entera',
  'fresco',
  'fresca',
  'picado',
  'picada',
  'rebanado',
  'rallado',
];

/** Condiments that count as zero in practice even when the plan doesn't list them. */
export const ZERO_CONDIMENTS = ['limón', 'limon', 'salsa', 'salsa verde', 'salsa roja', 'chile'];

/** Reference portions per ONE unit (SMAE-style ranges) for the plan-reading sanity check. */
export const REFERENCE_PORTIONS: Record<string, { unit: string; min: number; max: number }> = {
  chía: { unit: 'cda', min: 0.5, max: 3 },
  ajonjolí: { unit: 'cda', min: 0.5, max: 2.5 },
  'arándano seco con azúcar': { unit: 'tza', min: 0.05, max: 0.3 },
  'arroz cocido': { unit: 'tza', min: 0.2, max: 0.5 },
  'tortilla de maíz': { unit: 'pza', min: 1, max: 1 },
  pollo: { unit: 'g', min: 25, max: 40 },
  'carne de res': { unit: 'g', min: 25, max: 40 },
  huevo: { unit: 'pza', min: 1, max: 1 },
  manzana: { unit: 'pza', min: 0.5, max: 1 },
  aguacate: { unit: 'pza', min: 0.25, max: 0.5 },
  'aceite vegetal': { unit: 'cdta', min: 1, max: 1 },
  almendra: { unit: 'pza', min: 8, max: 12 },
  'leche de vaca descremada': { unit: 'tza', min: 1, max: 1 },
};
