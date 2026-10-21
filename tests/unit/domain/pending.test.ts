import { describe, expect, it } from 'vitest';
import { isOccasion, isProvisional, slotState } from '../../../src/shared/domain/status';
import { occasionsOn } from '../../../src/shared/game/momentum';
import { free, log, rules, slotTarget } from '../helpers';

describe('provisional descriptions', () => {
  it('counts and resolves an unparsed occasion without assigning portions', () => {
    const row = log('2026-10-08', 'comida', [], { title: 'una torta de la calle' }, 'describe');
    expect(isProvisional(row)).toBe(true);
    expect(isOccasion(row)).toBe(true);
    expect(occasionsOn([row], row.day)).toBe(1);
    expect(row.raw_units).toEqual({});
    expect(slotState([row], slotTarget('comida'), rules).resolved).toBe(true);
  });
  it('does not count empty, deleted or free-only records', () => {
    expect(isOccasion(log('2026-10-08', 'comida', [], { title: '' }, 'describe'))).toBe(false);
    expect(isOccasion(log('2026-10-08', 'comida', [], { deleted_at: 1 }, 'describe'))).toBe(false);
    const row = log('2026-10-08', 'comida', [free('café')], {}, 'describe');
    expect(isOccasion(row)).toBe(false);
    expect(isProvisional(row)).toBe(false);
  });
});
