import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/shared/domain/day';
import type { WeighinRow } from '../../../src/shared/domain/types';
import { analyzeWeight, dailyPoints, smooth, trendAt, weightAxis } from '../../../src/shared/domain/weight';

const start = '2026-09-01';
let n = 0;
const w = (day: string, kg: number, source: WeighinRow['source'] = 'home'): WeighinRow => ({
  id: `w${++n}`,
  day,
  kg,
  source,
  created_at: n,
  updated_at: n,
  deleted_at: null,
  rev: 0,
});
// Deterministic "water noise" of up to ±0.4 kg.
const noise = (i: number) => [0.3, -0.2, 0.4, -0.35, 0.1, -0.1, 0.25, -0.3][i % 8] ?? 0;
const series = (perWeek: number, days = 35, every = 2, base = 84) =>
  Array.from({ length: Math.floor(days / every) }, (_, i) =>
    w(addDays(start, i * every), base + (perWeek / 7) * i * every + noise(i)),
  );

describe('weight trend', () => {
  it('needs data before judging: none, then few', () => {
    expect(analyzeWeight([]).signal).toBe('none');
    const few = analyzeWeight([w(start, 80), w(addDays(start, 3), 79.6)]);
    expect(few.signal).toBe('few');
    expect(few.current).not.toBeNull();
    expect(few.rate).toBeNull();
    expect(few.projection).toEqual([]);
  });

  it('detects a steady loss through daily noise and projects four weeks', () => {
    const a = analyzeWeight(series(-0.5));
    expect(a.signal).toBe('losing');
    expect(a.rate).toBeGreaterThan(-0.75);
    expect(a.rate).toBeLessThan(-0.3);
    expect(a.rateHigh).toBeLessThan(0);
    expect(a.projection).toHaveLength(4);
    expect(a.projection[3]!.kg).toBeLessThan(a.current!);
    expect(a.projection[3]!.high - a.projection[3]!.low).toBeGreaterThan(a.projection[0]!.high - a.projection[0]!.low);
    expect(a.fast).toBe(false);
  });

  it('calls a flat series steady and a rising one gaining', () => {
    expect(analyzeWeight(series(0)).signal).toBe('steady');
    expect(analyzeWeight(series(0.6)).signal).toBe('gaining');
  });

  it('flags a fast loss (more than 1 % per week) for the nutritionist', () => {
    const a = analyzeWeight(series(-1.5, 35, 2, 80));
    expect(a.signal).toBe('losing');
    expect(a.fast).toBe(true);
  });

  it('averages same-day weigh-ins, ignores deleted rows and smooths without lag', () => {
    const rows = [w(start, 80), w(start, 81), { ...w(start, 99), deleted_at: 1 }, w(addDays(start, 7), 79)];
    const pts = dailyPoints(rows);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.kg).toBe(80.5);
    // Two weigh-ins: a weighted mean, never an extrapolated line.
    const t = smooth(pts);
    expect(t[0]!.kg).toBeGreaterThan(79);
    expect(t[0]!.kg).toBeLessThan(80.5);
    expect(trendAt(t, addDays(start, 3))).toBe(t[0]!.kg);
    expect(trendAt(t, addDays(start, -1))).toBeNull();
    // A perfectly straight decline is reproduced exactly, including the latest day (no lag).
    const line = dailyPoints(Array.from({ length: 10 }, (_, i) => w(addDays(start, i * 3), 90 - i * 0.3)));
    const lt = smooth(line);
    expect(lt.at(-1)!.kg).toBeCloseTo(90 - 9 * 0.3, 6);
    // Noise shrinks: the trend stays much closer to the true line than the raw weigh-ins.
    const noisy = series(-0.5);
    const truth = (i: number) => 84 + (-0.5 / 7) * i * 2;
    const raw = noisy.reduce((s2, r, i) => s2 + (r.kg - truth(i)) ** 2, 0);
    const smoothed = smooth(dailyPoints(noisy)).reduce((s2, r, i) => s2 + (r.kg - truth(i)) ** 2, 0);
    expect(smoothed).toBeLessThan(raw * 0.6);
  });

  it('marks nutritionist days and builds a readable axis', () => {
    const pts = dailyPoints([w(start, 80, 'nutritionist'), w(start, 80.4)]);
    expect(pts[0]!.source).toBe('nutritionist');
    const axis = weightAxis([78.2, 81.9]);
    expect(axis.min).toBeLessThanOrEqual(78.2);
    expect(axis.max).toBeGreaterThanOrEqual(81.9);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(3);
  });
});
