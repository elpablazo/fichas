// §3.8 worked examples (MUST be unit tests).
import { describe, expect, it } from 'vitest';
import { appDay } from '../../../src/shared/domain/day';
import { buildSkip } from '../../../src/shared/domain/log';
import { computeStatus, slotState } from '../../../src/shared/domain/status';
import type { LogItem } from '../../../src/shared/domain/types';
import { unitsOfItems } from '../../../src/shared/domain/units';
import { casaLlena, dotState, occasionsOn, weekDots } from '../../../src/shared/game/momentum';
import { free, item, log, plan, rules, slotTarget } from '../helpers';

function product<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((a) => list.map((x) => [...a, x])), [[]]);
}

const status = (slot: string, items: LogItem[]) => computeStatus(unitsOfItems(items, plan), slotTarget(slot), rules);

describe('§3.8 worked examples', () => {
  it('1. every nutritionist example option computes exactly to its slot target', () => {
    let combos = 0;
    for (const slot of plan.slots) {
      const options = (slot.example?.items ?? []).map((it) => it.options);
      for (const combo of product(options)) {
        combos++;
        const items = combo.map((o) => item(o.equivalent_id, o.qty, o.unit));
        const r = computeStatus(unitsOfItems(items, plan), slot.target, rules);
        expect(r.status, `${slot.key}: ${items.map((i) => i.label).join(', ')}`).toBe('on');
        for (const [t, v] of Object.entries(slot.target))
          expect(r.normalized[t as keyof typeof r.normalized]).toBeCloseTo(v, 2);
      }
    }
    expect(combos).toBe(1 + 1 + 6 + 2 + 4);
  });

  const comidaBase = [
    item('protein_poa.pollo', 120, 'g'),
    item('veg.verdura_cocida', 1, 'tza'),
    item('fruit.manzana', 1),
  ];

  it('2. 3 tortillas at comida → carb_sg +1 → over', () => {
    const r = status('comida', [item('carb_sg.tortilla_de_maiz', 3), ...comidaBase, item('fat_sp.aceite_vegetal', 2)]);
    expect(r.status).toBe('over');
    expect(r.deltas.carb_sg).toBeCloseTo(1);
  });

  it('3. 2 tortillas de harina decompose into carb + fat → on', () => {
    const r = status('comida', [item('carb_cg.tortilla_de_harina', 2), ...comidaBase]);
    expect(r.normalized.carb_sg).toBeCloseTo(2);
    expect(r.normalized.fat_sp).toBeCloseTo(2);
    expect(r.status).toBe('on');
  });

  it('4. same plus 2 cdta aceite → fat_sp +2 → over', () => {
    const r = status('comida', [
      item('carb_cg.tortilla_de_harina', 2),
      ...comidaBase,
      item('fat_sp.aceite_vegetal', 2),
    ]);
    expect(r.status).toBe('over');
    expect(r.deltas.fat_sp).toBeCloseTo(2);
  });

  it('5. 10 almendras + 1 cdta aceite fill the fats → on', () => {
    const r = status('comida', [
      item('carb_sg.tortilla_de_maiz', 2),
      ...comidaBase,
      item('fat_cp.almendra', 10),
      item('fat_sp.aceite_vegetal', 1),
    ]);
    expect(r.status).toBe('on');
  });

  it('6. ⅓ aguacate instead of ½ chocolate sin azúcar at colación 1 → on', () => {
    const r = status('colacion_1', [
      item('dairy.leche_de_vaca_descremada', 1),
      item('fruit.manzana', 1),
      item('fat_sp.aguacate', 0.3333),
    ]);
    expect(r.status).toBe('on');
  });

  it('7. café only at colación 2 → kind free; slot stays unresolved', () => {
    const l = log('2026-10-15', 'colacion_2', [free('café')]);
    expect(l.kind).toBe('free');
    expect(l.status).toBe('free');
    const st = slotState([l], slotTarget('colacion_2'), rules);
    expect(st.resolved).toBe(false);
  });

  it('8. cena with ½ tz arroz + 1 tortilla + 90 g pollo + ½ tz verdura + 2 cdta aceite → on', () => {
    const r = status('cena', [
      item('carb_sg.arroz_cocido', 0.5),
      item('carb_sg.tortilla_de_maiz', 1),
      item('protein_poa.pollo', 90),
      item('veg.verdura_cocida', 0.5),
      item('fat_sp.aceite_vegetal', 2),
    ]);
    expect(r.normalized.carb_sg).toBeCloseTo(3);
    expect(r.status).toBe('on');
  });

  it('9. a log at 00:40 on 16 Oct belongs to app day 15 Oct', () => {
    // 2026-10-16 00:40 in Mexico City (UTC−6) = 06:40 UTC
    expect(appDay(Date.parse('2026-10-16T06:40:00Z'), 'America/Mexico_City')).toBe('2026-10-15');
    expect(appDay(Date.parse('2026-10-16T10:00:00Z'), 'America/Mexico_City')).toBe('2026-10-16');
  });

  it('10. breakfast skipped then 2 meals → week dot full, not Casa llena', () => {
    const day = '2026-10-15';
    const logs = [
      buildSkip({ id: 's1', plan_id: 'p', day, slot: 'desayuno', now: 1, target: slotTarget('desayuno') }),
      log(day, 'colacion_1', [
        item('dairy.leche_de_vaca_descremada', 1),
        item('fruit.manzana', 1),
        item('fat_cp.chocolate_sin_azucar', 0.5),
      ]),
      log(day, 'comida', [item('carb_sg.tortilla_de_maiz', 2), ...comidaBase, item('fat_sp.aceite_vegetal', 2)]),
    ];
    expect(occasionsOn(logs, day)).toBe(2);
    expect(dotState(occasionsOn(logs, day))).toBe('full');
    expect(weekDots(logs, day).at(-1)).toMatchObject({ state: 'full', today: true });
    expect(casaLlena(plan, logs)).toBe(false);
  });
});

describe('day totals of the seed plan', () => {
  it('match the plan reading confirmed by the owner', () => {
    const totals: Record<string, number> = {};
    for (const s of plan.slots) for (const [t, v] of Object.entries(s.target)) totals[t] = (totals[t] ?? 0) + (v ?? 0);
    expect(totals).toEqual({ carb_sg: 7, protein_poa: 10, dairy: 1, fruit: 3, veg: 4, fat_sp: 6, fat_cp: 1 });
  });
});
