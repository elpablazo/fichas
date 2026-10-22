import { describe, expect, it } from 'vitest';
import { amountOf, closing, dayStatus } from '../../../src/shared/domain/daystatus';
import { equivalentById } from '../../../src/shared/domain/units';
import { item, log, plan } from '../helpers';

const day = '2026-10-15';
const breakfast = (tortillas: number, eggs = 3) =>
  log(day, 'desayuno', [
    item('carb_sg.tortilla_de_maiz', tortillas),
    item('protein_poa.huevo', eggs),
    item('veg.verdura_cocida', 0.5),
    item('fat_sp.aceite_vegetal', 1),
    item('fat_sp.aguacate', 0.3333),
  ]);
const meter = (s: ReturnType<typeof dayStatus>, t: string) => s.meters.find((m) => m.type === t);

describe('dayStatus', () => {
  it('starts with full tanks: one per planned type, nothing eaten, nothing expected', () => {
    const s = dayStatus(plan, [], true);
    expect(s.pace).toBe('start');
    expect(s.done).toBe(0);
    expect(s.total).toBe(5);
    expect(s.meters.map((m) => m.type)).toEqual([
      'carb_sg',
      'protein_poa',
      'dairy',
      'fruit',
      'veg',
      'fat_sp',
      'fat_cp',
    ]);
    expect(meter(s, 'carb_sg')).toMatchObject({ planned: 7, eaten: 0, expected: 0, remaining: 7, over: 0 });
  });

  it('a meal exactly on plan keeps the day on pace', () => {
    const s = dayStatus(plan, [breakfast(2)], true);
    expect(s.pace).toBe('on');
    expect(s.done).toBe(1);
    expect(meter(s, 'carb_sg')).toMatchObject({ eaten: 2, expected: 2, remaining: 5 });
    expect(s.advice).toEqual([]);
  });

  it('one extra tortilla: ahead in carbs, and dinner carries one less', () => {
    const s = dayStatus(plan, [breakfast(3)], true);
    expect(s.pace).toBe('ahead');
    expect(s.ahead).toEqual([{ type: 'carb_sg', n: 1 }]);
    expect(s.advice).toEqual([{ slot: 'cena', type: 'carb_sg', n: 1 }]);
    expect(meter(s, 'carb_sg')).toMatchObject({ eaten: 3, expected: 2, remaining: 4, over: 0 });
  });

  it('a skipped meal is behind, never balanced forward', () => {
    const skip = log(day, 'colacion_1', [], { kind: 'skip', raw_units: {}, units: {}, status: 'skip' });
    const s = dayStatus(plan, [breakfast(2), skip], true);
    expect(s.pace).toBe('behind');
    expect(s.behind.map((g) => g.type)).toEqual(['dairy', 'fruit', 'fat_cp']);
    expect(s.advice).toEqual([]);
  });

  it('extras count toward the day and can push a type over its whole-day total', () => {
    const extra = log(day, 'extra', [item('fat_cp.chocolate_sin_azucar', 1)]);
    const s = dayStatus(plan, [extra], true);
    expect(s.pace).toBe('ahead');
    expect(meter(s, 'fat_cp')).toMatchObject({ planned: 1, eaten: 2, remaining: 0, over: 1 });
  });

  it('says portions as food', () => {
    const tortilla = equivalentById(plan, 'carb_sg.tortilla_de_maiz');
    const oil = equivalentById(plan, 'fat_sp.aceite_vegetal');
    if (!tortilla || !oil) throw new Error('fixture');
    expect(amountOf(tortilla, 1)).toBe('1 tortilla');
    expect(amountOf(tortilla, 2)).toBe('2 tortillas');
    expect(amountOf(oil, 1)).toBe('1 cdta aceite');
  });
});

describe('meal marks and closing the day', () => {
  it('marks where each meal share ends inside a tube', () => {
    const s = dayStatus(plan, [], true);
    // Carbs: desayuno 2, comida 2, cena 3 → marks at 2 and 4 (7 is the top).
    expect(meter(s, 'carb_sg')?.marks).toEqual([
      { slot: 'desayuno', at: 2 },
      { slot: 'comida', at: 4 },
    ]);
    // Dairy only in one meal: no inner marks.
    expect(meter(s, 'dairy')?.marks).toEqual([]);
  });

  it('counts each group the same and caps it at its plan', () => {
    expect(closing([{ type: 'carb_sg', planned: 7, eaten: 0 }]).pct).toBe(0);
    const c = closing([
      { type: 'carb_sg', planned: 4, eaten: 8 },
      { type: 'veg', planned: 4, eaten: 2 },
    ]);
    // carbs 100% (capped), veg 50% → 75%.
    expect(c.pct).toBe(75);
    expect(c.missing).toEqual([{ type: 'veg', n: 2 }]);
    expect(c.complete).toBe(false);
  });

  it('lists catch-up groups first, then the largest gaps', () => {
    const c = closing([
      { type: 'protein_poa', planned: 10, eaten: 4 },
      { type: 'fruit', planned: 3, eaten: 2 },
      { type: 'veg', planned: 4, eaten: 1 },
    ]);
    expect(c.missing.map((g) => g.type)).toEqual(['veg', 'fruit', 'protein_poa']);
  });

  it('is 100 only when every group is covered; exact when nothing is over', () => {
    const full = closing([
      { type: 'carb_sg', planned: 7, eaten: 7 },
      { type: 'veg', planned: 4, eaten: 4.25 },
    ]);
    expect(full).toMatchObject({ pct: 100, complete: true, exact: true });
    const over = closing([
      { type: 'carb_sg', planned: 7, eaten: 8 },
      { type: 'veg', planned: 4, eaten: 4 },
    ]);
    expect(over).toMatchObject({ pct: 100, complete: true, exact: false });
    // Almost there never rounds up to 100.
    expect(closing([{ type: 'veg', planned: 4, eaten: 3.5 }]).pct).toBe(87);
  });
});
