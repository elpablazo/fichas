import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/shared/domain/day';
import type { MenuRow, PlanRow, RecipeRow } from '../../src/shared/domain/types';
import { flowerModel } from '../../src/shared/game/garden';
import { levelProgress, threshold } from '../../src/shared/game/levels';
import { casaLlena, diaRedondo, fullDots, weekDots } from '../../src/shared/game/momentum';
import { earnedStamps, STAMPS } from '../../src/shared/game/stamps';
import { calendarKey, calendarPetal, isComeback, surpriseLogs } from '../../src/shared/game/surprise';
import { planTomorrow } from '../../src/shared/game/tomorrow';
import { log, plan } from './helpers';

const day = '2026-10-13'; // Tuesday
const p: PlanRow = {
  id: 'plan-2026-10-08',
  season: 1,
  status: 'active',
  issued_on: null,
  starts_on: '2026-10-08',
  ends_on: null,
  data: plan,
  source_keys: [],
  source_sha256: null,
  created_at: 1,
  confirmed_at: 1,
  updated_at: 1,
  rev: 1,
};
const meal = (d = day, slot = 'comida') =>
  log(d, slot, [], {
    kind: 'meal',
    raw_units: { carb_sg: 2 },
    units: { carb_sg: 2 },
    target: { carb_sg: 2 },
    status: 'on',
  });
const complete = (d = day) =>
  plan.slots.map((s) =>
    log(d, s.key, [], { kind: 'meal', raw_units: s.target, units: s.target, target: s.target, status: 'on' }),
  );
const menu = (d: string, slot = 'comida'): MenuRow => ({
  id: `${d}:${slot}`,
  day: d,
  slot,
  title: 'a',
  items: [],
  recipe_id: null,
  accepted_at: 1,
  deleted_at: null,
  updated_at: 1,
  rev: 0,
});

describe('momentum and flowers', () => {
  it('counts occasions including provisional/backfill, excludes free, skip and deletions', () => {
    const ls = [
      meal(),
      { ...meal(), kind: 'free' as const },
      { ...meal(), kind: 'skip' as const },
      { ...meal(), deleted_at: 1 },
      { ...meal(), source: 'backfill' as const },
    ];
    const dots = weekDots(ls, day);
    expect(dots.at(-1)).toMatchObject({ n: 2, state: 'full', today: true });
    expect(fullDots(dots)).toBe(1);
    expect(weekDots([meal()], day).at(-1)?.state).toBe('half');
  });
  it('renders empty/zero as green buds, future seeds, partial and skipped petals', () => {
    expect(flowerModel(plan, [], day, day).petals.every((p) => p.state === 'none')).toBe(true);
    expect(flowerModel(plan, [], addDays(day, 1), day).future).toBe(true);
    const ls = [meal(), { ...meal(day, 'cena'), kind: 'skip' as const }];
    const f = flowerModel(plan, ls, day, day);
    expect(f.petals.filter((p) => p.state === 'open')).toHaveLength(1);
    expect(f.petals.find((p) => p.slot === 'cena')?.state).toBe('skip');
    expect(f.gold).toBe(false);
  });
  it('full requires meals; gold requires on against each historical target, never under', () => {
    const ls = complete();
    expect(casaLlena(plan, ls)).toBe(true);
    expect(diaRedondo(plan, ls, plan.swaps)).toBe(true);
    expect(flowerModel(plan, ls, day, day).gold).toBe(true);
    ls[0] = { ...ls[0]!, raw_units: { fruit: 0.1 }, target: { fruit: 1 } };
    expect(casaLlena(plan, ls)).toBe(true);
    expect(diaRedondo(plan, ls, plan.swaps)).toBe(false);
  });
  it('keeps color tie priority, time order and at most two extra leaves', () => {
    const ls = [
      { ...meal(), raw_units: { protein_poa: 2, carb_sg: 2 } },
      ...Array.from({ length: 3 }, () => meal(day, 'extra')),
    ];
    const f = flowerModel(plan, ls, day, day);
    expect(f.petals.find((p) => p.slot === 'comida')?.type).toBe('carb_sg');
    expect(f.leaves).toBe(2);
    expect(f.petals.map((p) => p.slot)).toEqual(plan.slots.map((s) => s.key));
  });
});

describe('every stamp criterion', () => {
  const earned = (ls = [meal()], ms: MenuRow[] = [], rs: RecipeRow[] = []) => earnedStamps(p, ls, ms, rs);
  it('first, full and round; skip cannot earn full or round', () => {
    expect(earned()).toContain('primer_bocado');
    expect(earned(complete())).toEqual(expect.arrayContaining(['casa_llena', 'dia_redondo']));
    expect(earned(complete().map((l) => ({ ...l, kind: 'skip' as const })))).not.toContain('dia_redondo');
  });
  it('planning is three distinct accepted days, excludes deleted and other seasons', () => {
    expect(earned([], [menu(day), menu(day, 'cena'), menu(addDays(day, 1))])).not.toContain('planeador');
    expect(earned([], [menu(day), menu(addDays(day, 1)), menu(addDays(day, 2))])).toContain('planeador');
    expect(earned([], [menu(day), menu(addDays(day, 1)), { ...menu(addDays(day, 2)), deleted_at: 1 }])).not.toContain(
      'planeador',
    );
  });
  it('comeback after a whole zero day, even across a season boundary', () => {
    const old = { ...meal(addDays(day, -2)), plan_id: 'old' };
    expect(isComeback(meal(), [old, meal()])).toBe(true);
    expect(earned([old, meal()])).toContain('volviste');
    expect(isComeback(meal(), [meal(addDays(day, -1))])).toBe(false);
    expect(isComeback(meal(), [])).toBe(false);
  });
  it('ten two-occasion days, including backfill, earn constancia', () => {
    const ls = Array.from({ length: 10 }, (_, i) => [
      meal(addDays('2026-10-08', i)),
      { ...meal(addDays('2026-10-08', i), 'cena'), source: 'backfill' as const },
    ]).flat();
    expect(earned(ls)).toContain('constancia');
    expect(earned(ls.slice(2))).not.toContain('constancia');
  });
  it('chef requires three actually used new log dishes in the season', () => {
    const rs = Array.from(
      { length: 3 },
      (_, i) =>
        ({ id: `r${i}`, origin: 'log', created_at: Date.parse(`${day}T18:00Z`), deleted_at: null }) as RecipeRow,
    );
    const ls = rs.map((r) => ({ ...meal(), recipe_id: r.id }));
    expect(earned(ls, [], rs)).toContain('chef');
    expect(
      earned(
        ls,
        [],
        rs.map((r) => ({ ...r, origin: 'seed' })),
      ),
    ).not.toContain('chef');
  });
  it('kitchen, honesty overage, weekend and Tuesday tacos', () => {
    const ls = [
      { ...meal(), source: 'pantry' as const, title: 'Tacos', raw_units: { carb_sg: 4 } },
      meal('2026-10-10'),
      meal('2026-10-10', 'cena'),
      meal('2026-10-11'),
      meal('2026-10-11', 'cena'),
    ];
    expect(earned(ls)).toEqual(expect.arrayContaining(['con_lo_que_hay', 'sin_filtro', 'finde', 'martes_de_tacos']));
    expect(earned([meal('2026-10-10'), meal('2026-10-11')])).not.toContain('finde');
    expect(STAMPS.filter((s) => s.hidden)).toHaveLength(3);
  });
});

describe('lifetime levels and surprises', () => {
  it('has all exact thresholds and extends by 130', () => {
    expect(levelProgress(9).level).toBe(1);
    expect(levelProgress(10).level).toBe(2);
    expect(levelProgress(800)).toMatchObject({ level: 14, from: 800, next: 930 });
    expect(threshold(15)).toBe(930);
    expect(levelProgress(1060).level).toBe(16);
  });
  it('1000-log simulation is stable, 8–15%, never first, at most one/day and ≥3 logs apart', () => {
    const ls = Array.from({ length: 1000 }, (_, i) => ({
      ...meal(addDays(day, i)),
      id: `simulation-${i}`,
      created_at: i,
    }));
    const surprises = surpriseLogs(ls);
    expect(surprises.length).toBeGreaterThanOrEqual(80);
    expect(surprises.length).toBeLessThanOrEqual(150);
    expect(surprises[0]?.id).not.toBe(ls[0]?.id);
    expect(new Set(surprises.map((l) => l.day)).size).toBe(surprises.length);
    const indexes = surprises.map((l) => ls.findIndex((m) => m.id === l.id));
    expect(indexes.slice(1).every((i, j) => i - indexes[j]! >= 3)).toBe(true);
    expect(surpriseLogs(ls.map((l) => ({ ...l, status: 'under' })))).toEqual(
      surprises.map((l) => ({ ...l, status: 'under' })),
    );
    expect(surpriseLogs(ls, new Set(surprises.map((l) => l.id)))).toHaveLength(0);
    expect(surpriseLogs(ls.slice(0, 100).map((l) => ({ ...l, day })))).toHaveLength(1);
  });
  it('calendar windows share one year key over New Year', () => {
    expect(calendarPetal('2026-10-27')).toBeNull();
    expect(calendarPetal('2026-11-02')).toBe('cempasuchil');
    expect(calendarPetal('2026-11-03')).toBeNull();
    expect(calendarKey('2027-01-06')).toBe(calendarKey('2026-12-12'));
    expect(calendarPetal('2027-01-07')).toBeNull();
  });
});

it('tomorrow fills every planned slot; accepted menu feeds suggest with fresh fitting', () => {
  const result = planTomorrow(p, day, [], [], [], [], 1);
  expect(result).toHaveLength(plan.slots.length);
  expect(result.every((s) => s.options.length > 0)).toBe(true);
  const m = result[0]!;
  const accepted = { ...menu(day, m.slot), title: m.options[0]!.title, items: m.options[0]!.items };
  expect(planTomorrow(p, day, [], [], [], [accepted], 1)[0]?.options[0]?.origin).toBe('menu');
});

it('an accepted menu wins even over a lifetime favorite or a future device clock', () => {
  const options = planTomorrow(p, day, [], [], [], [], 1);
  const first = options[0]!;
  const s = first.options[0]!;
  const favorite = {
    id: 'favorite',
    title: 'Favorito',
    items: s.items,
    fingerprint: 'favorite',
    slot_counts: { [first.slot]: 100000 },
    times: 100000,
    last_used_at: Date.parse('2099-01-01'),
    favorite: 1,
    hidden: 0,
    origin: 'log',
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
    rev: 0,
  } as RecipeRow;
  const accepted = { ...menu(day, first.slot), title: 'Planeado', items: s.items };
  expect(planTomorrow(p, day, [favorite], [], [], [accepted], 1)[0]?.options[0]?.title).toBe('Planeado');
});
