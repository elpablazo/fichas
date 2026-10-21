import { expect, it } from 'vitest';
import { seasonReport } from '../../../src/shared/domain/story';
import type { PlanRow, WeighinRow } from '../../../src/shared/domain/types';
import { log, plan } from '../helpers';

const p: PlanRow = {
  id: 'plan-2026-10-08',
  season: 1,
  status: 'active',
  starts_on: '2026-10-08',
  ends_on: '2026-10-15',
  issued_on: null,
  source_keys: [],
  source_sha256: null,
  data: plan,
  confirmed_at: 1,
  created_at: 1,
  updated_at: 1,
  rev: 1,
};
const meal = (day: string, slot: string, extra = {}) =>
  log(day, slot, [], {
    kind: 'meal',
    units: { carb_sg: 1 },
    raw_units: { carb_sg: 1 },
    target: { carb_sg: 1 },
    status: 'on',
    ...extra,
  });
const weight = (day: string, extra = {}): WeighinRow => ({
  id: day,
  day,
  kg: 70,
  source: 'home',
  created_at: 1,
  updated_at: 1,
  deleted_at: null,
  rev: 0,
  ...extra,
});
it('counts fixtures by season, day and slot-day; honors immutable snapshots', () => {
  const logs = [
    meal('2026-10-09', 'comida'),
    meal('2026-10-09', 'cena'),
    meal('2026-10-10', 'comida', { raw_units: { carb_sg: 2 }, units: { carb_sg: 2 } }),
    meal('2026-10-10', 'comida'),
    meal('2026-10-11', 'comida', { deleted_at: 1 }),
    meal('2026-10-11', 'comida', { plan_id: 'other' }),
    meal('2026-10-12', 'comida', { kind: 'skip' }),
    meal('2026-10-12', 'cena', { kind: 'free', units: {}, raw_units: {} }),
    meal('2026-10-16', 'comida'),
    meal('2026-10-07', 'comida'),
  ];
  const report = seasonReport(
    p,
    logs,
    [
      weight('2026-10-10'),
      weight('2026-10-09', { source: 'nutritionist' }),
      weight('2026-10-17'),
      weight('2026-10-11', { deleted_at: 1 }),
    ],
    [],
    '2026-10-20',
  );
  expect(report).toMatchObject({ totalDays: 8, flowers: 2, fullDays: 2, meals: 4, pending: 0 });
  expect(report.slots.find((s) => s.key === 'comida')).toMatchObject({ counted: 2, on: 1, percentOn: 50 });
  expect(report.extras).toEqual([{ type: 'carb_sg', slot: 'comida', occasions: 1, units: 2 }]);
  expect(report.weights.map((w) => w.day)).toEqual(['2026-10-09', '2026-10-10']);
});
it('provisional meals count occasions without inventing a status percentage; extras are separate', () => {
  const pending = meal('2026-10-09', 'comida', { source: 'describe', raw_units: {}, units: {}, items: [] });
  const report = seasonReport(p, [pending, meal('2026-10-09', 'extra')], [], [], '2026-10-09');
  expect(report).toMatchObject({ flowers: 1, fullDays: 1, meals: 2, pending: 1 });
  expect(report.slots.find((s) => s.key === 'comida')?.percentOn).toBe(null);
  expect(report.extras).toEqual([{ type: 'carb_sg', slot: 'extra', occasions: 1, units: 1 }]);
});
