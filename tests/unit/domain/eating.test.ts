import { describe, expect, it } from 'vitest';
import { hhmmToAppMinutes } from '../../../src/shared/domain/day';
import { eatingSummary } from '../../../src/shared/domain/eating';
import type { LogRow, TypeKey, Units } from '../../../src/shared/domain/types';
import { equivalentById } from '../../../src/shared/domain/units';
import { free, item, log, plan, slotTarget } from '../helpers';

const today = '2026-10-16';
const D = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
const units = (id: string, n: number) => item(id, n * (equivalentById(plan, id)?.qty ?? 1));
const FOOD: Partial<Record<TypeKey, string>> = {
  carb_sg: 'carb_sg.tortilla_de_maiz',
  protein_poa: 'protein_poa.huevo',
  dairy: 'dairy.leche_de_vaca_descremada',
  fruit: 'fruit.fresa',
  veg: 'veg.coliflor',
  fat_sp: 'fat_sp.aceite_vegetal',
  fat_cp: 'fat_cp.almendra',
};
const onPlan = (day: string, slot: string, target: Units = slotTarget(slot), extra: Partial<LogRow> = {}) =>
  log(
    day,
    slot,
    Object.entries(target).map(([t, n]) => units(FOOD[t as TypeKey] ?? '', n ?? 0)),
    extra,
  );
const fullDay = (day: string) => plan.slots.map((s) => onPlan(day, s.key));
const summary = (logs: LogRow[]) =>
  eatingSummary({
    from: D[0] ?? '',
    to: today,
    today,
    logs,
    planOf: () => plan,
    tz: 'America/Mexico_City',
    dayStartHour: 4,
  });

describe('eatingSummary', () => {
  it('one ring per day; today shows but only finished days count for averages', () => {
    const s = summary([...fullDay(D[0] ?? ''), onPlan(D[1] ?? '', 'desayuno'), onPlan(today, 'desayuno')]);
    expect(s.days.map((d) => d.day)).toEqual([...D, today]);
    expect(s.days[0]).toMatchObject({ logged: true, pct: 100, complete: true, exact: true });
    expect(s.days[1]?.logged).toBe(true);
    expect(s.days[1]?.pct).toBeGreaterThan(0);
    expect(s.days[1]?.pct).toBeLessThan(100);
    expect(s.days[2]).toMatchObject({ logged: false, pct: 0 });
    expect(s.days[4]?.logged).toBe(true);
    expect(s.counted).toBe(2);
    expect(s.full).toBe(1);
    // Tortillas: 7 on the full day, 2 at breakfast the next one.
    expect(s.avg.find((a) => a.type === 'carb_sg')).toEqual({ type: 'carb_sg', eaten: 4.5, planned: 7 });
  });

  it('names a meal habit when it happens often, not a one-off', () => {
    const logs = D.flatMap((day, i) => [
      onPlan(day, 'desayuno', i === 0 ? { ...slotTarget('desayuno'), carb_sg: 4 } : slotTarget('desayuno')),
      onPlan(day, 'cena', i < 3 ? { ...slotTarget('cena'), carb_sg: 4 } : slotTarget('cena')),
    ]);
    const s = summary(logs);
    expect(s.habits).toEqual([{ slot: 'cena', type: 'carb_sg', n: 1, times: 3, of: 4 }]);
  });

  it('food outside the meals is a habit of its own', () => {
    const logs = D.flatMap((day, i) => [
      onPlan(day, 'comida'),
      ...(i % 2 ? [log(day, 'extra', [units('carb_cg.pan_dulce', 1)])] : []),
    ]);
    const s = summary(logs);
    const extra = s.habits.filter((h) => h.slot === 'extra').map((h) => [h.type, h.n, h.times, h.of]);
    expect(extra).toEqual([
      ['carb_sg', 1, 2, 4],
      ['fat_sp', 1, 2, 4],
    ]);
  });

  it('real times against the plan, from three meals on; late logs are left out', () => {
    const at = (day: string, hhmm: string) => ({ eaten_at: Date.parse(`${day}T${hhmm}:00-06:00`) });
    const logs = [
      onPlan(D[0] ?? '', 'comida', undefined, at(D[0] ?? '', '17:30')),
      onPlan(D[1] ?? '', 'comida', undefined, at(D[1] ?? '', '17:40')),
      onPlan(D[2] ?? '', 'comida', undefined, at(D[2] ?? '', '17:50')),
      // Logged the next morning as "pendiente": not when it was eaten.
      onPlan(D[3] ?? '', 'comida', undefined, at(D[3] ?? '', '23:59')),
      onPlan(D[0] ?? '', 'cena', undefined, at(D[0] ?? '', '21:30')),
    ];
    const s = summary(logs);
    expect(s.timing).toEqual([{ slot: 'comida', plan: hhmmToAppMinutes('17:00'), real: hhmmToAppMinutes('17:40') }]);
  });

  it('most eaten foods count once per meal; free food is left out', () => {
    const logs = D.map((day) => log(day, 'comida', [units('carb_sg.tortilla_de_maiz', 2), free('café')]));
    logs.push(log(D[0] ?? '', 'cena', [units('carb_sg.tortilla_de_maiz', 1), units('protein_poa.huevo', 2)]));
    const s = summary(logs);
    expect(s.foods.map((f) => [f.label, f.times, f.type])).toEqual([
      ['tortilla de maíz', 5, 'carb_sg'],
      ['huevo', 1, 'protein_poa'],
    ]);
  });
});
