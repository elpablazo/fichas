import { describe, expect, it } from 'vitest';
import { balanceDay, balancingEnabled } from '../../../src/shared/domain/balance';
import { item, log, plan, rules } from '../helpers';

const day = '2026-10-15';
const target = (b: ReturnType<typeof balanceDay>, key: string) => b.targets[plan.slots.findIndex((s) => s.key === key)];
const breakfast = (tortillas: number, eggs = 3) =>
  log(day, 'desayuno', [
    item('carb_sg.tortilla_de_maiz', tortillas),
    item('protein_poa.huevo', eggs),
    item('veg.verdura_cocida', 0.5),
    item('fat_sp.aceite_vegetal', 1),
    item('fat_sp.aguacate', 0.3333),
  ]);

describe('cuadrar el día', () => {
  it('moves one extra carb at breakfast to the largest later carb target, in whole units', () => {
    const b = balanceDay(plan, [breakfast(3)], rules, true);
    expect(b.adjustments).toEqual([{ slot: 'cena', type: 'carb_sg', from: 3, to: 2 }]);
    expect(target(b, 'cena')?.carb_sg).toBe(2);
    expect(target(b, 'comida')?.carb_sg).toBe(2);
    expect(b.unabsorbed).toEqual({});
    expect(b.eaten.carb_sg).toBe(3);
    expect(b.planned.carb_sg).toBe(7);
  });

  it('keeps plan targets when disabled and reports the overage as unabsorbed', () => {
    const b = balanceDay(plan, [breakfast(3)], rules, false);
    expect(b.adjustments).toEqual([]);
    expect(target(b, 'cena')?.carb_sg).toBe(3);
    expect(b.unabsorbed.carb_sg).toBe(1);
  });

  it('never takes more than half of a meal; the rest stays as a neutral "+n"', () => {
    const b = balanceDay(plan, [breakfast(6)], rules, true);
    expect(target(b, 'cena')?.carb_sg).toBe(1.5);
    expect(target(b, 'comida')?.carb_sg).toBe(1);
    expect(b.unabsorbed.carb_sg).toBe(1.5);
  });

  it('never reduces protein, legumes or vegetables', () => {
    const b = balanceDay(plan, [breakfast(2, 5)], rules, true);
    expect(b.adjustments).toEqual([]);
    expect(b.unabsorbed.protein_poa).toBe(2);
    expect(target(b, 'comida')?.protein_poa).toBe(4);
  });

  it('nets a light or skipped meal against an overage; unders never carry forward', () => {
    const skip = log(day, 'desayuno', [], { kind: 'skip', raw_units: {}, units: {}, status: 'skip' });
    const lunch = log(day, 'comida', [
      item('carb_sg.tortilla_de_maiz', 3),
      item('protein_poa.pollo', 120, 'g'),
      item('veg.verdura_cocida', 1),
      item('fruit.manzana', 1),
      item('fat_sp.aceite_vegetal', 2),
    ]);
    const b = balanceDay(plan, [skip, lunch], rules, true);
    expect(b.adjustments).toEqual([]);
    expect(target(b, 'cena')?.carb_sg).toBe(3);
    expect(b.net.carb_sg).toBe(-1);
  });

  it('charges extras to the day and decomposes "con grasa" with the plan rules', () => {
    const extra = log(day, 'extra', [item('carb_sg.galleta_maria', 10)]);
    const b = balanceDay(plan, [extra], rules, true);
    expect(target(b, 'cena')?.carb_sg).toBe(2);
    expect(target(b, 'comida')?.carb_sg).toBe(1);

    const flour = log(day, 'desayuno', [
      item('carb_cg.tortilla_de_harina', 2),
      item('protein_poa.huevo', 3),
      item('veg.verdura_cocida', 0.5),
      item('fat_sp.aceite_vegetal', 1),
      item('fat_sp.aguacate', 0.3333),
    ]);
    const f = balanceDay(plan, [flour], rules, true);
    expect(f.adjustments.filter((a) => a.type === 'fat_sp')).toEqual([
      { slot: 'comida', type: 'fat_sp', from: 2, to: 1 },
      { slot: 'cena', type: 'fat_sp', from: 2, to: 1 },
    ]);
    expect(f.adjustments.some((a) => a.type === 'carb_sg')).toBe(false);
  });

  it('never touches resolved meals and ignores deleted logs', () => {
    const dinner = log(day, 'cena', [item('carb_sg.tortilla_de_maiz', 3)]);
    const b = balanceDay(plan, [breakfast(3), dinner], rules, true);
    expect(target(b, 'cena')?.carb_sg).toBe(3);
    expect(target(b, 'comida')?.carb_sg).toBe(1);
    const gone = balanceDay(plan, [{ ...breakfast(3), deleted_at: 1 }], rules, true);
    expect(gone.adjustments).toEqual([]);
  });

  it('follows the owner setting, then an explicit plan rule, else allows', () => {
    expect(balancingEnabled('unknown', 'unknown')).toBe(true);
    expect(balancingEnabled('unknown', 'not_allowed')).toBe(false);
    expect(balancingEnabled('allowed', 'not_allowed')).toBe(true);
    expect(balancingEnabled('not_allowed', 'allowed')).toBe(false);
  });
});
