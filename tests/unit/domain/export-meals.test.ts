import { expect, it } from 'vitest';
import { exportMeals } from '../../../src/shared/domain/export-meals';
import type { PlanRow } from '../../../src/shared/domain/types';
import { free, item, log, plan } from '../helpers';

const p: PlanRow = {
  id: 'plan-2026-10-08',
  season: 1,
  status: 'active',
  starts_on: '2026-10-08',
  ends_on: null,
  issued_on: null,
  source_keys: [],
  source_sha256: null,
  data: plan,
  confirmed_at: 1,
  created_at: 1,
  updated_at: 1,
  rev: 1,
};
const base = { plans: [p], tz: 'America/Mexico_City', dayStartHour: 4 };
const slot = plan.slots[0]?.key ?? '';

it('lists dishes with portions, by day, inside the range only', () => {
  const a = log('2026-10-12', slot, [free('2 hot dogs')], {
    title: 'Hot dog',
    eaten_at: Date.parse('2026-10-12T14:30:00Z'),
  });
  const b = log('2026-10-13', slot, [free('1 tza arroz'), free('120 g pollo')], { title: 'Pollo con arroz' });
  const out = log('2026-10-20', slot, [free('algo')], { title: 'Fuera de rango' });
  const r = exportMeals({ ...base, logs: [b, out, a], from: '2026-10-12', to: '2026-10-13' });
  expect(r.meals).toBe(2);
  expect(r.days).toBe(2);
  expect(r.text).toContain('Hot dog — 2 hot dogs');
  expect(r.text).toContain('Pollo con arroz — 1 tza arroz, 120 g pollo');
  expect(r.text.indexOf('Hot dog')).toBeLessThan(r.text.indexOf('Pollo con arroz'));
  expect(r.text).not.toContain('Fuera de rango');
});

it('skips deleted logs and reports an empty range', () => {
  const gone = log('2026-10-12', slot, [free('x')], { title: 'Borrada', deleted_at: 5 });
  const r = exportMeals({ ...base, logs: [gone], from: '2026-10-12', to: '2026-10-12' });
  expect(r.meals).toBe(0);
  expect(r.text).not.toContain('Borrada');
});

it('shows the plain item label when there is no title, and never exchange units', () => {
  const l = log('2026-10-12', slot, [item('protein_poa.pollo', 120, 'g')], { title: '' });
  const r = exportMeals({ ...base, logs: [l], from: '2026-10-12', to: '2026-10-12' });
  expect(r.text).toContain('pollo');
  expect(r.text).not.toMatch(/carb_|protein_|equivalente/i);
});
