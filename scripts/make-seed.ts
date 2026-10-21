// Builds seed/plan-2026-10-08.json (PlanV1) from the Appendix A transcription of the 08/10/2026 plan.
// Run: npx tsx scripts/make-seed.ts
import { writeFileSync } from 'node:fs';
import { ALIASES } from '../src/shared/domain/aliases';
import { PlanV1 } from '../src/shared/domain/plan-schema';
import { DEFAULT_SWAPS } from '../src/shared/domain/swaps';
import { slug } from '../src/shared/domain/text';
import type { Equivalent, ExampleItem, PlanData, TypeKey, UnitName } from '../src/shared/domain/types';

type Opts = { note?: string; notes?: Record<string, string>; source?: 'example'; flag?: boolean };
type Row = [TypeKey, number, UnitName, string, Opts?];

const T = 0.3333;
const TT = 0.6667;

const rows: Row[] = [
  ['carb_sg', 0.25, 'tza', 'amaranto; arroz cocido; quinoa cocida'],
  ['carb_sg', 2, 'cda', 'granola; tapioca; trigo'],
  ['carb_sg', T, 'tza', 'arroz integral; camote; cereal; couscous'],
  ['carb_sg', 0.5, 'tza', 'avena en hojuelas; pasta cocida; elote desgranado'],
  ['carb_sg', 0.5, 'pza', 'papa cocida'],
  ['carb_sg', 1, 'pza', 'tortilla de maíz'],
  ['carb_sg', 2, 'pza', 'tortilla de nopal'],
  ['carb_sg', 1, 'paquete', 'salmas'],
  ['carb_sg', 2.5, 'tza', 'palomitas'],
  ['carb_sg', T, 'pza', 'palanqueta de amaranto'],
  ['carb_sg', T, 'pza', 'birote; bolillo sin migajón; bollo de hamburguesa; telera; bagel'],
  ['carb_sg', 2, 'pza', 'crepa'],
  ['carb_sg', 1, 'reb', 'pan de caja; pan tostado'],
  ['carb_sg', 5, 'pza', 'galleta maría; pretzel; galleta habanera; galleta salada'],
  ['carb_sg', 1, 'barra', 'barra de cereal', { note: 'menos de 90 kcal' }],
  ['carb_sg', 0.5, 'pza', 'media noche'],
  ['carb_sg', 14, 'pza', 'galleta para sopa'],
  ['carb_cg', 0.5, 'pza', 'bísquet; cuernito'],
  ['carb_cg', T, 'pza', 'bigote de chocolate'],
  ['carb_cg', 1, 'pza', 'tortilla de harina; tostada'],
  ['carb_cg', T, 'pza', 'pan dulce'],
  ['protein_poa', 1, 'pza', 'huevo'],
  ['protein_poa', 2, 'pza', 'clara de huevo'],
  ['protein_poa', 3, 'cda', 'queso cottage; requesón; ricota reducida en grasa; queso parmesano rallado'],
  ['protein_poa', 30, 'g', 'pollo; carne de res; pescado; atún fresco; cecina; salmón; filete de mojarra; arrachera'],
  [
    'protein_poa',
    30,
    'g',
    'queso panela; queso cheddar bajo en grasa; queso oaxaca; queso de cabra; tofu; queso fresco; queso blanco',
  ],
  ['protein_poa', T, 'lata', 'atún drenado'],
  ['protein_poa', 3, 'pza', 'sardina'],
  ['protein_poa', 0.5, 'pza', 'chuleta ahumada'],
  ['protein_poa', 2, 'reb', 'pechuga de pavo'],
  [
    'protein_poa',
    1,
    'reb',
    'queso mozzarella bajo en grasa; queso monterrey bajo en grasa; queso holandés bajo en grasa',
  ],
  ['protein_poa', 5, 'pza', 'camarón'],
  ['protein_poa', TT, 'barra', 'surimi'],
  ['protein_poa', 1, 'pza', 'salchicha'],
  ['dairy', 1, 'tza', 'leche de soya; leche de vaca descremada; yogurt descremado'],
  ['dairy', T, 'tza', 'leche evaporada'],
  ['legume', 0.5, 'tza', 'alubia; alverjón; frijol; garbanzo; haba; lenteja', { note: 'cocido' }],
  ['legume', T, 'tza', 'soya cocida; frijol molido'],
  ['fruit', 1, 'tza', 'zarzamora; frambuesa; mora; fresa; melón; papaya; sandía; piña'],
  ['fruit', 18, 'pza', 'uva; cereza'],
  ['fruit', 3, 'pza', 'ciruela; guayaba; plátano dominico'],
  ['fruit', 2, 'pza', 'durazno amarillo; granada china; higo; mandarina; naranja; tuna'],
  ['fruit', 1, 'pza', 'granada roja; manzana; toronja; kiwi'],
  ['fruit', 0.5, 'pza', 'mango ataúlfo; pera; plátano'],
  ['fruit', 12, 'pza', 'lichi'],
  ['fruit', T, 'pza', 'mamey'],
  ['fruit', 10, 'pza', 'pasita; ciruela pasa'],
  [
    'veg',
    0.5,
    'tza',
    'coliflor; ejote; pimiento cocido; setas; verdolagas; berenjena; brócoli; calabacita; champiñón; chayote; chícharo',
    { note: 'cocido' },
  ],
  [
    'veg',
    2,
    'tza',
    'verdura cruda; espinaca; flor de calabaza; lechuga; acelga; apio; arúgula; berro; col',
    { note: 'crudo' },
  ],
  ['veg', 1, 'tza', 'hongos crudos'],
  ['veg', 0.5, 'tza', 'jícama; zanahoria; betabel; germen'],
  ['veg', 2, 'pza', 'jitomate saladet'],
  ['veg', 1, 'tza', 'pepino; pimiento crudo'],
  ['veg', 0.5, 'tza', 'verdura cocida', { note: 'cualquiera' }],
  ['sugar_sg', 2, 'cdta', 'azúcar; leche condensada; mermelada; cátsup; cajeta'],
  ['sugar_sg', 13, 'g', 'ate'],
  ['sugar_sg', 0.5, 'tza', 'gelatina de agua'],
  ['sugar_sg', 3, 'pza', 'gomita; malvavisco'],
  ['sugar_sg', T, 'tza', 'jugo de frutas'],
  ['sugar_sg', 40, 'g', 'nieve de fruta'],
  ['sugar_sg', 1, 'pza', 'paleta helada de agua', { note: 'pequeña' }],
  ['sugar_sg', 0.25, 'lata', 'refresco'],
  ['sugar_sg', 0.5, 'tza', 'arándano seco con azúcar', { flag: true }],
  ['sugar_cg', 3, 'cda', 'mole'],
  ['sugar_cg', 0.5, 'pza', 'flan; gelatina de leche; natilla; chocolate'],
  ['fat_sp', T, 'pza', 'aguacate'],
  ['fat_sp', 8, 'pza', 'aceituna sin hueso'],
  ['fat_sp', 1, 'cdta', 'aceite vegetal; aceite de oliva'],
  ['fat_sp', 5, 'disparo', 'aceite en spray'],
  ['fat_sp', 1.5, 'cda', 'coco rallado; cocoa', { notes: { cocoa: 'más de 80%' } }],
  ['fat_sp', 0.5, 'cda', 'aderezo'],
  ['fat_sp', 3, 'cda', 'aderezo bajo en grasa'],
  ['fat_sp', 1, 'cdta', 'margarina; mantequilla; mayonesa'],
  ['fat_sp', 1, 'cda', 'crema; crema para café; queso crema'],
  ['fat_sp', 1, 'reb', 'tocino'],
  ['fat_cp', 4, 'cda', 'ajonjolí', { flag: true }],
  ['fat_cp', 10, 'pza', 'almendra; avellana'],
  ['fat_cp', 14, 'pza', 'cacahuate'],
  ['fat_cp', 7, 'cda', 'chía', { flag: true }],
  ['fat_cp', 1, 'cda', 'harina de ajonjolí; harina de almendra; harina de cacahuate'],
  ['fat_cp', 2, 'cdta', 'crema de cacahuate'],
  ['fat_cp', 7, 'mitad', 'nuez'],
  ['fat_cp', 1, 'cda', 'pepitas sin cáscara; piñón'],
  ['fat_cp', 18, 'pza', 'pistache'],
  ['fat_cp', 4, 'cdta', 'semilla de girasol'],
  ['fat_cp', 0.5, 'pza', 'chocolate sin azúcar', { source: 'example' }],
];

const equivalents: Equivalent[] = rows.flatMap(([type, qty, unit, foods, o]) =>
  foods.split(';').map((f) => {
    const food = f.trim();
    return {
      id: `${type}.${slug(food)}`,
      type,
      food,
      qty,
      unit,
      aliases: ALIASES[food] ?? [],
      note: o?.notes?.[food] ?? o?.note ?? null,
      source: o?.source ?? 'table',
      flag: o?.flag ? 'check_portion' : null,
    } satisfies Equivalent;
  }),
);

const ids = new Set<string>();
for (const e of equivalents) {
  if (ids.has(e.id)) throw new Error(`duplicate id ${e.id}`);
  ids.add(e.id);
}

const ex = (text: string, ...options: [string, number, UnitName][]): ExampleItem => ({
  text,
  options: options.map(([equivalent_id, qty, unit]) => {
    if (!ids.has(equivalent_id)) throw new Error(`unknown ${equivalent_id}`);
    return { equivalent_id, qty, unit };
  }),
});

const plan: PlanData = {
  schema: 1,
  issued_on: '2026-10-08',
  next_appointment: null,
  fluids_ml: 3000,
  exercise: '5 de 7 días, 45–60 min',
  notes: ['Ir al médico', 'Tomar kéfir'],
  slots: [
    {
      key: 'desayuno',
      label: 'Desayuno',
      source_label: 'Desayuno',
      kind: 'meal',
      time: '11:00',
      target: { carb_sg: 2, protein_poa: 3, veg: 1, fat_sp: 2 },
      example: {
        title: 'Huevos con tortillas',
        items: [
          ex('2 tortillas de maíz', ['carb_sg.tortilla_de_maiz', 2, 'pza']),
          ex('3 huevos', ['protein_poa.huevo', 3, 'pza']),
          ex('½ taza de verdura', ['veg.verdura_cocida', 0.5, 'tza']),
          ex('1 cdta de aceite', ['fat_sp.aceite_vegetal', 1, 'cdta']),
          ex('⅓ de aguacate', ['fat_sp.aguacate', T, 'pza']),
        ],
      },
    },
    {
      key: 'colacion_1',
      label: 'Colación',
      source_label: 'Colación 1',
      kind: 'snack',
      time: '13:00',
      target: { dairy: 1, fruit: 1, fat_cp: 1 },
      example: {
        title: 'Latte, manzana y chocolate',
        items: [
          ex('1 taza de leche (latte)', ['dairy.leche_de_vaca_descremada', 1, 'tza']),
          ex('1 manzana', ['fruit.manzana', 1, 'pza']),
          ex('½ chocolate sin azúcar', ['fat_cp.chocolate_sin_azucar', 0.5, 'pza']),
        ],
      },
    },
    {
      key: 'comida',
      label: 'Comida',
      source_label: 'Comida',
      kind: 'meal',
      time: '17:00',
      target: { carb_sg: 2, protein_poa: 4, fruit: 1, veg: 2, fat_sp: 2 },
      example: {
        title: 'Pollo con tortillas y verdura',
        items: [
          ex('2 tortillas de maíz', ['carb_sg.tortilla_de_maiz', 2, 'pza']),
          ex(
            '120 g de pollo/bistec/pescado',
            ['protein_poa.pollo', 120, 'g'],
            ['protein_poa.carne_de_res', 120, 'g'],
            ['protein_poa.pescado', 120, 'g'],
          ),
          ex('1 taza de verdura cocida', ['veg.verdura_cocida', 1, 'tza']),
          ex('½ pera o 1 manzana', ['fruit.pera', 0.5, 'pza'], ['fruit.manzana', 1, 'pza']),
          ex('2 cdta de aceite', ['fat_sp.aceite_vegetal', 2, 'cdta']),
        ],
      },
    },
    {
      key: 'colacion_2',
      label: 'Colación',
      source_label: 'Colación 2',
      kind: 'snack',
      time: '19:00',
      target: { fruit: 1 },
      example: {
        title: 'Manzana',
        items: [ex('1 manzana / ½ mango', ['fruit.manzana', 1, 'pza'], ['fruit.mango_ataulfo', 0.5, 'pza'])],
      },
    },
    {
      key: 'cena',
      label: 'Cena',
      source_label: 'Cena 2',
      kind: 'meal',
      time: '21:00',
      target: { carb_sg: 3, protein_poa: 3, veg: 1, fat_sp: 2 },
      example: {
        title: 'Hamburguesa casera',
        items: [
          ex(
            '1 pan de hamburguesa / 3 tortillas de maíz',
            ['carb_sg.bollo_de_hamburguesa', 1, 'pza'],
            ['carb_sg.tortilla_de_maiz', 3, 'pza'],
          ),
          ex('90 g de carne o bistec / pollo', ['protein_poa.carne_de_res', 90, 'g'], ['protein_poa.pollo', 90, 'g']),
          ex('½ taza de verdura', ['veg.verdura_cocida', 0.5, 'tza']),
          ex('2 cdtas de aceite', ['fat_sp.aceite_vegetal', 2, 'cdta']),
        ],
      },
    },
  ],
  equivalents,
  free_foods: [
    'agua',
    'agua mineral',
    'refresco zero',
    'hierbabuena',
    'menta',
    'jamaica sin azúcar',
    'hierbas de olor',
    'jengibre',
    'té',
    'café',
    'mostaza',
    'salsa de soya',
    'salsa inglesa',
    'pimienta',
    'perejil',
    'sal',
    'vainilla',
    'vinagre',
    'chile en polvo',
    'edulcorante',
    'gelatina light',
    'levadura',
  ],
  swaps: DEFAULT_SWAPS,
  rules: { rebalance_within_day: 'unknown' },
};

// Free-food aliases live on a parallel map (free foods are plain strings in PlanV1).
const parsed = PlanV1.parse(plan);
writeFileSync('seed/plan-2026-10-08.json', `${JSON.stringify(parsed, null, 2)}\n`);
console.log(`seed written: ${parsed.slots.length} slots, ${parsed.equivalents.length} equivalents`);
