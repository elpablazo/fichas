import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/shared/domain/day';
import { flowerModel } from '../../src/shared/game/garden';
import { nextUnlock, UNLOCKS } from '../../src/shared/game/levels';
import { plantStage, RARE_CHANCE, SPECIES, speciesFor, speciesPool } from '../../src/shared/game/species';
import { SPECIES_TEXT, speciesText } from '../../src/shared/game/species-text';
import { log, plan } from './helpers';

function hsl(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

describe('species', () => {
  it('has a varied catalog with unique ids, facts and no red petals (anti-shame rule 1)', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(SPECIES.map((s) => s.shape)).size).toBeGreaterThanOrEqual(8);
    expect(Object.keys(SPECIES_TEXT).sort()).toEqual(SPECIES.map((s) => s.id).sort());
    for (const s of SPECIES) {
      expect(speciesText(s.id).fact.length).toBeLessThanOrEqual(72);
      expect(speciesText(s.id).name).not.toBe(s.id);
      for (const c of [s.colors.petal, s.colors.shade]) {
        const [h, sat, l] = hsl(c);
        const red = (h >= 345 || h <= 12) && sat > 0.55 && l > 0.25 && l < 0.65;
        expect(red, `${s.id} ${c}`).toBe(false);
      }
    }
  });

  it('is deterministic, follows the level pool and owns the seasonal windows', () => {
    expect(speciesFor('2026-10-20', 1).id).toBe(speciesFor('2026-10-20', 1).id);
    expect(speciesFor('2026-10-30', 1).id).toBe('cempasuchil');
    expect(speciesFor('2026-12-24', 3).id).toBe('nochebuena');
    const allowed = new Set([...speciesPool(1).map((s) => s.id), 'orquidea', 'loto', 'magnolia']);
    for (let i = 0; i < 200; i++) {
      const d = addDays('2026-03-01', i);
      expect(allowed.has(speciesFor(d, 1).id), d).toBe(true);
    }
    expect(speciesPool(1)).toHaveLength(4);
    expect(speciesPool(10).length).toBeGreaterThan(speciesPool(2).length);
  });

  it('makes roughly one bloom in eight rare, and neighbours vary', () => {
    let rare = 0;
    let repeats = 0;
    for (let i = 0; i < 1000; i++) {
      const d = addDays('2027-02-01', i);
      const s = speciesFor(d, 10);
      if (s.level === 0) rare++;
      if (s.id === speciesFor(addDays(d, -1), 10).id) repeats++;
    }
    expect(rare / 1000).toBeGreaterThan(RARE_CHANCE - 0.05);
    expect(rare / 1000).toBeLessThan(RARE_CHANCE + 0.05);
    expect(repeats).toBeLessThan(80);
  });

  it('unlocks a new species tier every even level up to ten', () => {
    expect(UNLOCKS.filter((u) => u.kind === 'species').map((u) => u.level)).toEqual([2, 4, 6, 8, 10]);
    expect(nextUnlock(1)?.level).toBe(2);
    expect(nextUnlock(10)).toBeNull();
  });
});

describe('growth stages', () => {
  const base = { future: false, closed: false, casaLlena: false, redondo: false };
  it('grows with each occasion and finishes generously at day end; never wilts', () => {
    expect(plantStage({ ...base, n: 0 })).toBe('seed');
    expect(plantStage({ ...base, n: 1 })).toBe('sprout');
    expect(plantStage({ ...base, n: 2 })).toBe('bud');
    expect(plantStage({ ...base, n: 3 })).toBe('bloom');
    expect(plantStage({ ...base, n: 2, closed: true })).toBe('bloom');
    expect(plantStage({ ...base, n: 1, closed: true })).toBe('bud');
    expect(plantStage({ ...base, n: 0, closed: true })).toBe('seed');
    expect(plantStage({ ...base, n: 5, casaLlena: true })).toBe('full');
    expect(plantStage({ ...base, n: 5, casaLlena: true, redondo: true })).toBe('gold');
    expect(plantStage({ ...base, n: 0, future: true })).toBe('soil');
  });

  it('flower models carry stage, occasions and a stable species', () => {
    const day = '2026-10-13';
    const meal = (slot: string) => log(day, slot, [], { raw_units: { carb_sg: 1 }, units: { carb_sg: 1 } });
    expect(flowerModel(plan, [], day, day).stage).toBe('seed');
    expect(flowerModel(plan, [meal('desayuno')], day, day).stage).toBe('sprout');
    const two = [meal('desayuno'), meal('comida')];
    expect(flowerModel(plan, two, day, day).stage).toBe('bud');
    expect(flowerModel(plan, two, day, addDays(day, 1)).stage).toBe('bloom');
    expect(flowerModel(plan, two, day, day, { closed: true }).stage).toBe('bloom');
    expect(flowerModel(plan, two, day, day).species).toBe(speciesFor(day, 1).id);
    expect(flowerModel(plan, [], addDays(day, 2), day).stage).toBe('soil');
  });
});
