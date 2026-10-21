import { expect, it } from 'vitest';
import { availableIds, ideasFromPantry, matchPantry, shoppingList, validateIdea } from '../../src/shared/domain/pantry';
import { computeStatus } from '../../src/shared/domain/status';
import type { MenuRow, PantryRow } from '../../src/shared/domain/types';
import { unitsOfItems } from '../../src/shared/domain/units';
import { plan, slotTarget } from './helpers';

const stock = (ids: string[], extra: Partial<PantryRow> = {}): PantryRow => ({
  id: ids.join('+'),
  label: 'Comida',
  equivalent_ids: ids,
  state: 'have',
  on_list: 0,
  staple: 0,
  checked_at: 1,
  deleted_at: null,
  updated_at: 1,
  rev: 0,
  ...extra,
});
const fullIds = [
  'carb_sg.tortilla_de_maiz',
  'protein_poa.pollo',
  'fruit.manzana',
  'veg.verdura_cocida',
  'fat_sp.aceite_vegetal',
];

it('normalizes plurals, aliases and lists locally without treating utensils as food', () => {
  const result = matchPantry('2 tortillas, pechuga y frijoles; sartén\nmarca desconocida', plan);
  expect(result.items).toHaveLength(4);
  expect(result.items[0]?.equivalent_ids).toContain('carb_sg.tortilla_de_maiz');
  expect(result.items[1]?.equivalent_ids).toContain('protein_poa.pollo');
  expect(result.unmatched).toEqual(['marca desconocida']);
});

it('every deterministic idea reaches on and uses only available food or explicit missing markers', () => {
  for (const inventory of [fullIds, fullIds.slice(0, 2), fullIds.slice(1), []]) {
    const have = availableIds(inventory.map((id) => stock([id])));
    const ideas = ideasFromPantry(
      plan,
      slotTarget('comida'),
      inventory.map((id) => stock([id])),
      [],
      [],
    );
    expect(ideas.length).toBeLessThanOrEqual(3);
    if (inventory.length) expect(ideas.length).toBeGreaterThan(0);
    for (const idea of ideas) {
      expect(computeStatus(unitsOfItems(idea.items, plan), slotTarget('comida'), plan.swaps).status).toBe('on');
      for (const item of idea.items)
        expect(have.has(item.equivalent_id!) || idea.missing.includes(item.equivalent_id!)).toBe(true);
      if (inventory.length === fullIds.length) expect(idea.missing).toEqual([]);
    }
  }
});

it('out/deleted rows are unavailable, explicit staples remain available', () => {
  expect(availableIds([stock(fullIds, { state: 'out' })]).size).toBe(0);
  expect(availableIds([stock(fullIds, { deleted_at: 1 })]).size).toBe(0);
  expect(availableIds([stock(fullIds, { state: 'out', staple: 1 })]).size).toBe(fullIds.length);
});

it('rejects AI ideas with unavailable/unknown foods, wrong units or a non-on result', () => {
  const have = new Set(['carb_sg.tortilla_de_maiz']);
  const idea = { title: 'Tortillas', items: [{ equivalent_id: 'carb_sg.tortilla_de_maiz', qty: 2, unit: 'pza' }] };
  expect(validateIdea(idea, plan, { carb_sg: 2 }, have)).not.toBeNull();
  expect(validateIdea(idea, plan, { carb_sg: 3 }, have)).toBeNull();
  expect(validateIdea(idea, plan, { carb_sg: 2 }, new Set())).toBeNull();
  expect(validateIdea({ ...idea, items: [{ ...idea.items[0]!, unit: 'g' }] }, plan, { carb_sg: 2 }, have)).toBeNull();
  expect(
    validateIdea(
      { ...idea, items: [{ ...idea.items[0]!, equivalent_id: 'invented' }] },
      plan,
      { carb_sg: 2 },
      new Set(['invented']),
    ),
  ).toBeNull();
});

it('shopping list combines out items and unmet menu ingredients once; buying clears derived needs', () => {
  const tortilla = fullIds[0]!;
  const menu = {
    day: '2026-10-09',
    slot: 'comida',
    accepted_at: 1,
    deleted_at: null,
    items: [{ equivalent_id: tortilla }],
  } as MenuRow;
  expect(shoppingList(plan, [], [menu, menu], '2026-10-08')).toHaveLength(1);
  expect(shoppingList(plan, [stock([tortilla])], [menu], '2026-10-08')).toHaveLength(0);
  expect(shoppingList(plan, [stock([tortilla], { state: 'out', on_list: 1 })], [menu], '2026-10-08')).toHaveLength(1);
  expect(shoppingList(plan, [], [menu], '2026-10-10')).toHaveLength(0);
});
