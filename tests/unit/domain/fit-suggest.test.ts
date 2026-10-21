import { describe, expect, it } from 'vitest';
import { changedIndexes, fit } from '../../../src/shared/domain/fit';
import { equivalentUsage, fingerprint, preferredEquivalent, upsertRecipe } from '../../../src/shared/domain/recipes';
import { computeStatus } from '../../../src/shared/domain/status';
import { suggest } from '../../../src/shared/domain/suggest';
import type { LogItem, PlanData, RecipeRow } from '../../../src/shared/domain/types';
import { unitsOfItems } from '../../../src/shared/domain/units';
import { item, log, plan, rules, slotTarget } from '../helpers';

const preferred = (slot: string) => preferredEquivalent(plan, new Map(), slot);
const fitCtx = (slot: string, p: PlanData = plan) => ({
  plan: p,
  rules,
  preferred: preferredEquivalent(p, new Map(), slot),
});
const statusOf = (items: LogItem[], slot: string, p: PlanData = plan) =>
  computeStatus(unitsOfItems(items, p), p.slots.find((s) => s.key === slot)?.target ?? {}, rules).status;

function recipe(
  id: string,
  title: string,
  items: LogItem[],
  slot_counts: Record<string, number>,
  extra: Partial<RecipeRow> = {},
): RecipeRow {
  return {
    id,
    title,
    items,
    fingerprint: fingerprint(items),
    slot_counts,
    times: Object.values(slot_counts).reduce((a, b) => a + b, 0),
    last_used_at: null,
    favorite: 0,
    hidden: 0,
    origin: 'log',
    created_at: 0,
    updated_at: 0,
    deleted_at: null,
    rev: 0,
    ...extra,
  };
}

const tacos = [
  item('carb_sg.tortilla_de_maiz', 3),
  item('protein_poa.pollo', 120, 'g'),
  item('veg.verdura_cocida', 1, 'tza'),
  item('fruit.manzana', 1),
  item('fat_sp.aceite_vegetal', 2),
];

describe('fit', () => {
  it('trims an over: 3 tortillas → 2 at comida, change highlighted', () => {
    const r = fit(tacos, slotTarget('comida'), fitCtx('comida'));
    expect(r.items[0]?.qty).toBe(2);
    expect(statusOf(r.items, 'comida')).toBe('on');
    expect(changedIndexes(r).has(0)).toBe(true);
    expect(r.changes).toHaveLength(1);
  });

  it('fills a missing type with the preferred equivalent', () => {
    const r = fit(tacos.slice(0, 3), slotTarget('comida'), fitCtx('comida'));
    expect(statusOf(r.items, 'comida')).toBe('on');
    expect(r.items.some((i) => i.equivalent_id === 'fruit.pera' || i.equivalent_id === 'fruit.manzana')).toBe(true);
  });

  it('removes the oil when tortillas de harina already bring the fat (case 4)', () => {
    const items = [
      item('carb_cg.tortilla_de_harina', 2),
      item('protein_poa.pollo', 120, 'g'),
      item('veg.verdura_cocida', 1, 'tza'),
      item('fruit.manzana', 1),
      item('fat_sp.aceite_vegetal', 2),
    ];
    const r = fit(items, slotTarget('comida'), fitCtx('comida'));
    expect(statusOf(r.items, 'comida')).toBe('on');
    expect(r.items.some((i) => i.equivalent_id === 'fat_sp.aceite_vegetal')).toBe(false);
    expect(r.changes).toContainEqual({ removed_index: 4 });
  });

  it('never adds sugars or "con grasa" carbs', () => {
    const r = fit([], { sugar_sg: 2, carb_cg: 1 }, fitCtx('comida'));
    expect(r.items).toHaveLength(0);
  });

  it('re-portions a usual dish when a new plan changes the target (M3 acceptance)', () => {
    const next: PlanData = {
      ...plan,
      slots: plan.slots.map((s) => (s.key === 'comida' ? { ...s, target: { ...s.target, carb_sg: 3 } } : s)),
    };
    const usual = tacos.map((i, n) => (n === 0 ? { ...i, qty: 2 } : i));
    const r = fit(usual, next.slots.find((s) => s.key === 'comida')?.target ?? {}, fitCtx('comida', next));
    expect(r.items[0]?.qty).toBe(3);
    expect(changedIndexes(r).has(0)).toBe(true);
  });

  it('steps grams by 10 g and keeps estimated items proportional', () => {
    const est: LogItem = {
      label: '2 tacos de pastor',
      qty: 2,
      unit: 'pza',
      equivalent_id: null,
      units: { carb_sg: 2, protein_poa: 2, fat_sp: 1 },
      estimated: true,
      assumed_qty: false,
      free: false,
    };
    const r = fit([est], { carb_sg: 1, protein_poa: 1, fat_sp: 0.5 }, fitCtx('cena'));
    expect(r.items[0]?.qty).toBe(1);
    expect(r.items[0]?.units.carb_sg).toBeCloseTo(1);
    expect(r.items[0]?.label).toBe('1 tacos de pastor');
  });
});

describe('suggest', () => {
  const seeds = plan.slots.map((s) =>
    recipe(
      `seed-${s.key}`,
      s.example?.title ?? s.key,
      (s.example?.items ?? []).map((it) => {
        const o = it.options[0]!;
        return item(o.equivalent_id, o.qty, o.unit);
      }),
      { [s.key]: 0 },
      { origin: 'seed', times: 0 },
    ),
  );
  const base = {
    plan,
    rules,
    day: '2026-10-15',
    now: Date.parse('2026-10-15T23:00:00Z'),
    menus: [],
    logs: [],
    pantry: [],
  };

  it('offers the nutritionist example for a new owner', () => {
    const out = suggest({
      ...base,
      slotKey: 'desayuno',
      remaining: slotTarget('desayuno'),
      recipes: seeds,
      preferred: preferred('desayuno'),
    });
    expect(out[0]?.title).toBe('Huevos con tortillas');
    expect(out[0]?.tag).toBe('seed');
    expect(statusOf(out[0]?.items ?? [], 'desayuno')).toBe('on');
  });

  it('ranks the owner’s usual dish first and re-portions it to the remaining target', () => {
    const usual = recipe('r-tacos', 'Tacos de pollo', tacos, { comida: 12 }, { last_used_at: base.now - 86_400_000 });
    const out = suggest({
      ...base,
      slotKey: 'comida',
      remaining: slotTarget('comida'),
      recipes: [...seeds, usual],
      preferred: preferred('comida'),
    });
    expect(out[0]?.title).toBe('Tacos de pollo');
    expect(out[0]?.tag).toBe('classic');
    expect(out[0]?.items[0]?.qty).toBe(2); // 3 tortillas trimmed to the plan's 2
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('penalizes a dish already eaten today', () => {
    const a = recipe('a', 'Tacos de pollo', tacos, { comida: 3 }, { last_used_at: base.now });
    const bItems = tacos.map((i, n) => (n === 1 ? item('protein_poa.carne_de_res', 120, 'g') : i));
    const b = recipe('b', 'Bistec con tortillas', bItems, { comida: 3 }, { last_used_at: base.now });
    const today = { ...log(base.day, 'desayuno', tacos), recipe_id: 'a' };
    const out = suggest({
      ...base,
      slotKey: 'comida',
      remaining: slotTarget('comida'),
      recipes: [a, b],
      logs: [today],
      preferred: preferred('comida'),
    });
    expect(out[0]?.recipe_id).toBe('b');
  });

  it('never pads a dish with foods it does not have ("Leche" is not offered as leche + piña + chocolate)', () => {
    const milk = recipe('r-leche', 'Leche', [item('dairy.leche_de_vaca_descremada', 1)], { colacion_1: 6 });
    const out = suggest({
      ...base,
      slotKey: 'colacion_1',
      remaining: slotTarget('colacion_1'),
      recipes: [...seeds, milk],
      preferred: preferred('colacion_1'),
    });
    expect(out.map((s) => s.title)).not.toContain('Leche');
    for (const s of out) expect(s.changes.some((c) => 'added' in c)).toBe(false);
  });

  it('builds a dish from preferred equivalents when there is nothing else', () => {
    const out = suggest({
      ...base,
      slotKey: 'cena',
      remaining: slotTarget('cena'),
      recipes: [],
      preferred: preferred('cena'),
    });
    expect(out).toHaveLength(1);
    expect(statusOf(out[0]?.items ?? [], 'cena')).toBe('on');
  });

  it('upserts recipes by fingerprint and learns usage', () => {
    const l = log(base.day, 'comida', tacos);
    const r1 = upsertRecipe(undefined, l, 1, 'new-id');
    expect(r1).toMatchObject({ times: 1, slot_counts: { comida: 1 }, origin: 'log' });
    const r2 = upsertRecipe(r1, l, 2, 'ignored');
    expect(r2).toMatchObject({ id: 'new-id', times: 2, slot_counts: { comida: 2 } });
    expect(equivalentUsage([l]).get('protein_poa.pollo')).toBe(1);
  });
});
