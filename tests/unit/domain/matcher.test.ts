import { describe, expect, it } from 'vitest';
import { knownText, localChips, matchText, parseItems, unknownPhrases } from '../../../src/shared/domain/matcher';
import type { Units } from '../../../src/shared/domain/types';
import { unitsOfItems } from '../../../src/shared/domain/units';
import { plan } from '../helpers';

// Appendix D "exact" cases that the local matcher must resolve without AI.
const local: [string, Units | 'free'][] = [
  ['2 tortillas de maíz', { carb_sg: 2 }],
  ['3 huevos revueltos con una cucharadita de aceite', { protein_poa: 3, fat_sp: 1 }],
  ['120 g de pechuga de pollo', { protein_poa: 4 }],
  ['una manzana', { fruit: 1 }],
  ['media taza de arroz', { carb_sg: 2 }],
  ['1 taza de arroz integral', { carb_sg: 3 }],
  ['un bolillo sin migajón', { carb_sg: 3 }],
  ['2 rebanadas de pan de caja', { carb_sg: 2 }],
  ['un plátano', { fruit: 2 }],
  ['un mango ataúlfo', { fruit: 2 }],
  ['18 uvas', { fruit: 1 }],
  ['una taza de papaya', { fruit: 1 }],
  ['una taza de leche descremada', { dairy: 1 }],
  ['una taza de yogurt natural descremado', { dairy: 1 }],
  ['media taza de frijoles de la olla', { legume: 1 }],
  ['un tercio de aguacate', { fat_sp: 1 }],
  ['un aguacate entero', { fat_sp: 3 }],
  ['10 almendras', { fat_cp: 1 }],
  ['20 almendras', { fat_cp: 2 }],
  ['2 cucharaditas de crema de cacahuate', { fat_cp: 1 }],
  ['café americano', 'free'],
  ['coca zero', 'free'],
  ['una lata de atún drenado', { protein_poa: 3 }],
  ['90 g de queso panela', { protein_poa: 3 }],
  ['2 tortillas de harina', { carb_cg: 2 }],
  ['una tostada', { carb_cg: 1 }],
  ['una concha', { carb_cg: 3 }],
  ['una taza de verduras al vapor', { veg: 2 }],
  ['5 galletas marías', { carb_sg: 1 }],
  ['2 claras de huevo', { protein_poa: 1 }],
  ['una lata de refresco', { sugar_sg: 4 }],
  ['media taza de avena con una taza de leche', { carb_sg: 1, dairy: 1 }],
  ['1 taza de pepino con limón y chile en polvo', { veg: 1 }],
  ['5 tazas de palomitas naturales', { carb_sg: 2 }],
  ['120g pollo', { protein_poa: 4 }],
  ['1 1/2 taza de papaya', { fruit: 1.5 }],
  ['½ tz arroz', { carb_sg: 2 }],
];

describe('matchText (local fast path)', () => {
  for (const [text, expected] of local) {
    it(text, () => {
      const r = matchText(text, plan, []);
      expect(r, `${text} should match locally`).not.toBeNull();
      expect(r?.source).toBe('local');
      const units = unitsOfItems(r?.items ?? [], plan);
      if (expected === 'free') {
        expect(r?.items.every((i) => i.free)).toBe(true);
        expect(units).toEqual({});
      } else {
        expect(Object.keys(units).sort()).toEqual(Object.keys(expected).sort());
        for (const [t, v] of Object.entries(expected)) expect(units[t as keyof Units]).toBeCloseTo(v as number, 1);
      }
    });
  }

  it('leaves dishes and unknown foods to the AI', () => {
    for (const t of [
      'quesadilla de queso oaxaca en tortilla de maíz',
      'ensalada de lechuga con jitomate',
      'torta de jamón con queso y mayonesa',
      '3 tacos de bistec',
      'un vaso de jugo de naranja',
      'un plato de pozole de pollo',
    ]) {
      expect(matchText(t, plan, []), t).toBeNull();
    }
  });

  it('assumes the slot portion when no amount is given and marks it', () => {
    const out = parseItems('pollo con tortillas', plan, { carb_sg: 2, protein_poa: 4 });
    expect(out.complete).toBe(true);
    const pollo = out.items.find((i) => i.equivalent_id === 'protein_poa.pollo');
    expect(pollo?.qty).toBe(120);
    expect(pollo?.assumed_qty).toBe(true);
    const tort = out.items.find((i) => i.equivalent_id === 'carb_sg.tortilla_de_maiz');
    expect(tort?.qty).toBe(2);
  });

  it('matches a saved dish by title', () => {
    const recipe = {
      id: 'r1',
      title: 'Tacos de pollo',
      items: [],
      fingerprint: 'x',
      slot_counts: {},
      times: 3,
      last_used_at: null,
      favorite: 0,
      hidden: 0,
      origin: 'log' as const,
      created_at: 0,
      updated_at: 0,
      deleted_at: null,
      rev: 0,
    };
    expect(matchText('tacos de pollo', plan, [recipe])?.title).toBe('Tacos de pollo');
    expect(localChips('tacos', plan, [recipe])[0]).toMatchObject({ kind: 'recipe' });
  });

  it('prefers the longest food name (mantequilla de maní → crema de cacahuate)', () => {
    const r = matchText('2 cucharaditas de mantequilla de maní', plan, []);
    expect(r?.items[0]?.equivalent_id).toBe('fat_cp.crema_de_cacahuate');
  });
});

describe('unknownPhrases', () => {
  it('returns only the phrases the plan table cannot place, for live categorization', () => {
    expect(unknownPhrases('2 tortillas, huevo con chilaquiles y un agua de jamaica', plan)).toEqual([
      'chilaquiles',
      'un agua de jamaica',
    ]);
    expect(unknownPhrases('3 tacos al pastor + 1 coca', plan)).toEqual(['3 tacos al pastor']);
    expect(unknownPhrases('2 tortillas y 120 g pollo', plan)).toEqual([]);
  });

  it('keeps only fully known phrases for the instant rows ("3 tacos de pollo" is not "30 g pollo")', () => {
    expect(knownText('3 tacos de pollo y 1 manzana', plan)).toBe('1 manzana');
    expect(knownText('2 tortillas, huevo con chilaquiles', plan)).toBe('2 tortillas, huevo');
  });
});
