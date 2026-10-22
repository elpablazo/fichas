import { describe, expect, it } from 'vitest';
import { contributorName, dayLesson } from '../../../src/shared/domain/insights';
import type { TypeKey, Units } from '../../../src/shared/domain/types';
import { equivalentById } from '../../../src/shared/domain/units';
import { item, log, plan, slotTarget } from '../helpers';

const day = '2026-10-15';
/** n units of an equivalent (its portion size times n). */
const units = (id: string, n: number) => item(id, n * (equivalentById(plan, id)?.qty ?? 1));
const tortillas = (n: number) => units('carb_sg.tortilla_de_maiz', n);
const FOOD: Partial<Record<TypeKey, string>> = {
  carb_sg: 'carb_sg.tortilla_de_maiz',
  protein_poa: 'protein_poa.huevo',
  dairy: 'dairy.leche_de_vaca_descremada',
  fruit: 'fruit.fresa',
  veg: 'veg.coliflor',
  fat_sp: 'fat_sp.aceite_vegetal',
  fat_cp: 'fat_cp.almendra',
};
/** A meal exactly on its plan. */
const onPlan = (slot: string, target: Units = slotTarget(slot)) =>
  log(
    day,
    slot,
    Object.entries(target).map(([t, n]) => units(FOOD[t as TypeKey] ?? '', n ?? 0)),
  );

describe('dayLesson', () => {
  it('a day exactly on plan: every group on plan, nothing to fix, repeat it', () => {
    const l = dayLesson(
      plan,
      plan.slots.map((s) => onPlan(s.key)),
    );
    expect(l.good).toEqual(['carb_sg', 'protein_poa', 'dairy', 'fruit', 'veg', 'fat_sp', 'fat_cp']);
    expect(l.missing).toEqual([]);
    expect(l.over).toEqual([]);
    expect(l.tip).toEqual({ kind: 'repeat' });
  });

  it('nothing logged: everything missing, catch-up groups first, the tip starts with vegetables', () => {
    const l = dayLesson(plan, []);
    expect(l.good).toEqual([]);
    expect(l.over).toEqual([]);
    expect(l.missing.slice(0, 2)).toEqual([
      { type: 'veg', n: 4 },
      { type: 'fruit', n: 3 },
    ]);
    // Comida plans the most vegetables (2).
    expect(l.tip).toEqual({ kind: 'missing', type: 'veg', slot: 'comida', n: 2 });
  });

  it('an over day says where it came from and what that meal plans', () => {
    const l = dayLesson(plan, [
      log(day, 'desayuno', [tortillas(4)]),
      log(day, 'comida', [tortillas(3)]),
      log(day, 'cena', [tortillas(3)]),
    ]);
    expect(l.over).toHaveLength(1);
    expect(l.over[0]).toMatchObject({ type: 'carb_sg', n: 3 });
    // Only the meals that went over their share are causes (dinner had its planned 3), merged by food.
    expect(l.over[0]?.from.map((f) => [contributorName(f), f.slot, f.n])).toEqual([['tortillas', 'desayuno', 7]]);
    // Breakfast went 2 over its 2: the tip is about breakfast.
    expect(l.tip).toEqual({ kind: 'over', type: 'carb_sg', slot: 'desayuno', n: 2 });
  });

  it('an over that came outside the meals names that food, not the planned ones', () => {
    const day1 = plan.slots.map((s) => onPlan(s.key));
    const l = dayLesson(plan, [...day1, log(day, 'extra', [units('carb_cg.pan_dulce', 2)])]);
    // Pan dulce counts as carbohidrato + grasa: both over, both from the pan dulce alone.
    expect(l.over.map((g) => [g.type, g.n, g.from.map(contributorName)])).toEqual([
      ['carb_sg', 2, ['pan dulce']],
      ['fat_sp', 2, ['pan dulce']],
    ]);
    expect(l.good).not.toContain('carb_sg');
    expect(l.tip).toEqual({ kind: 'extra', type: 'carb_sg', food: 'pan dulce' });
  });

  it('a meal that went further over than the extras gets the tip', () => {
    const l = dayLesson(plan, [
      ...plan.slots.filter((s) => s.key !== 'cena').map((s) => onPlan(s.key)),
      onPlan('cena', { ...slotTarget('cena'), carb_sg: 6 }),
      log(day, 'extra', [units('carb_sg.galleta_maria', 1)]),
    ]);
    expect(l.over[0]).toMatchObject({ type: 'carb_sg', n: 4 });
    expect(l.tip).toEqual({ kind: 'over', type: 'carb_sg', slot: 'cena', n: 3 });
  });

  it('deleted meals do not count', () => {
    const gone = { ...log(day, 'desayuno', [tortillas(9)]), deleted_at: 1 };
    const l = dayLesson(plan, [gone]);
    expect(l.over).toEqual([]);
    expect(l.good).toEqual([]);
  });
});

describe('contributorName', () => {
  it('drops the amount so it reads as food', () => {
    expect(contributorName({ label: '½ tz arroz cocido', n: 1 })).toBe('arroz cocido');
    expect(contributorName({ label: '2 tortillas de maíz', n: 2 })).toBe('tortillas de maíz');
    expect(contributorName({ label: 'pan', n: 1 })).toBe('pan');
  });
});
