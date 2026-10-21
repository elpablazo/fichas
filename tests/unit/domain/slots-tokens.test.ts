import { describe, expect, it } from 'vitest';
import { appMinutes, hhmmToAppMinutes } from '../../../src/shared/domain/day';
import { dayLabel, itemLabel, timeLabel } from '../../../src/shared/domain/format';
import { currentSlot, learnedTimes, slotTimings } from '../../../src/shared/domain/slots';
import { tokensFor } from '../../../src/shared/domain/tokens';
import { formatCount, formatQty } from '../../../src/shared/domain/units';
import { item, log, plan } from '../helpers';

const tz = 'America/Mexico_City';
const at = (day: string, hhmm: string) => Date.parse(`${day}T${hhmm}:00-06:00`);

describe('slot windows and the current slot', () => {
  const timings = slotTimings(plan.slots);

  it('uses plan times and midpoint windows from 04:00 to 04:00', () => {
    expect(timings.map((t) => t.time)).toEqual(
      ['11:00', '13:00', '17:00', '19:00', '21:00'].map((h) => hhmmToAppMinutes(h)),
    );
    expect(timings[0]?.start).toBe(0);
    expect(timings[0]?.end).toBe(hhmmToAppMinutes('12:00'));
    expect(timings[2]?.start).toBe(hhmmToAppMinutes('15:00'));
    expect(timings[4]?.end).toBe(1440);
  });

  it('opens on the meal of the hour and lists earlier unresolved slots as pending', () => {
    const now = appMinutes(at('2026-10-15', '16:52'), tz);
    const c = currentSlot(timings, [true, false, false, false, false], now);
    expect(plan.slots[c.current ?? -1]?.key).toBe('comida');
    expect(c.pending).toEqual([1]);
  });

  it('moves on when the window slot is already resolved', () => {
    const now = appMinutes(at('2026-10-15', '16:52'), tz);
    const c = currentSlot(timings, [true, true, true, false, false], now);
    expect(plan.slots[c.current ?? -1]?.key).toBe('colacion_2');
  });

  it('after midnight still belongs to cena of the app day', () => {
    const now = appMinutes(at('2026-10-16', '00:40'), tz);
    const c = currentSlot(timings, [true, true, true, true, false], now);
    expect(plan.slots[c.current ?? -1]?.key).toBe('cena');
  });

  it('learns the median log time after 3 samples, ignoring backfills', () => {
    const logs = ['2026-10-10', '2026-10-11', '2026-10-12'].map((d, i) => ({
      ...log(d, 'desayuno', [item('protein_poa.huevo', 3)]),
      eaten_at: at(d, ['10:30', '10:40', '10:50'][i] as string),
    }));
    logs.push({
      ...log('2026-10-13', 'desayuno', [item('protein_poa.huevo', 3)]),
      eaten_at: at('2026-10-13', '09:00'),
      source: 'backfill',
    });
    const learned = learnedTimes(logs, plan.slots, '2026-10-15', tz);
    expect(learned.desayuno).toBe(hhmmToAppMinutes('10:40'));
    expect(learned.comida).toBeUndefined();
  });
});

describe('tokens', () => {
  it('shows hollow, full and extra tokens in display order', () => {
    const t = tokensFor({ carb_sg: 2, protein_poa: 1 }, { carb_sg: 3, protein_poa: 0.5 });
    expect(t).toEqual([
      { type: 'carb_sg', fill: 1, extra: false, half: false },
      { type: 'carb_sg', fill: 1, extra: false, half: false },
      { type: 'carb_sg', fill: 1, extra: true, half: false },
      { type: 'protein_poa', fill: 0.5, extra: false, half: false },
    ]);
  });
});

describe('formatting', () => {
  it('formats quantities and counts with glyphs, never more than 2 decimals', () => {
    expect(formatQty(0.3333)).toBe('⅓');
    expect(formatQty(2.5)).toBe('2½');
    expect(formatQty(120)).toBe('120');
    expect(formatQty(1.37123)).toBe('1.37');
    expect(formatCount(1.26)).toBe('1¼');
    expect(formatCount(0.5)).toBe('½');
  });

  it('labels items the way people say them', () => {
    expect(itemLabel('tortilla de maíz', 2, 'pza')).toBe('2 tortillas');
    expect(itemLabel('huevo', 3, 'pza')).toBe('3 huevos');
    expect(itemLabel('aguacate', 0.3333, 'pza')).toBe('⅓ aguacate');
    expect(itemLabel('pollo', 120, 'g')).toBe('120 g pollo');
    expect(itemLabel('verdura cocida', 0.5, 'tza')).toBe('½ tz verdura');
    expect(itemLabel('nuez', 7, 'mitad')).toBe('7 mitades de nuez');
    expect(itemLabel('barra de cereal', 1, 'barra')).toBe('1 barra de cereal');
    expect(itemLabel('atún drenado', 1, 'lata')).toBe('1 lata de atún drenado');
    expect(timeLabel(hhmmToAppMinutes('17:00'))).toBe('5 pm');
    expect(timeLabel(hhmmToAppMinutes('11:00'))).toBe('11 am');
    expect(timeLabel(hhmmToAppMinutes('13:30'))).toBe('1:30 pm');
    expect(dayLabel('2026-10-15')).toBe('Jue 15 oct');
  });
});
