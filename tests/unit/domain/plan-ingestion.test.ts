import { describe, expect, it } from 'vitest';
import { diffPlans } from '../../../src/shared/domain/diff';
import {
  checkPlan,
  compareReads,
  expandRead,
  localExampleItems,
  resolveReads,
  unmatchedExamples,
} from '../../../src/shared/domain/plan-ingestion';
import { planRead, seedPlan } from '../../plan-fixture';

describe('plan review', () => {
  it('normalizes equivalent IDs but preserves read amounts and distinct raw/cooked peppers', () => {
    const read = planRead();
    read.equivalent_rows = [
      { type: 'protein_poa', qty: 45, unit: 'g', foods: ['panela'], note: null },
      { type: 'veg', qty: 0.5, unit: 'tza', foods: ['pimiento cocido', 'brócoli cocido'], note: null },
      { type: 'veg', qty: 1, unit: 'tza', foods: ['pimiento crudo'], note: null },
      { type: 'carb_sg', qty: 14, unit: 'pza', foods: ['galletas para sopa', 'couscous'], note: null },
      { type: 'dairy', qty: 1, unit: 'tza', foods: ['leche entera'], note: null },
    ];
    const plan = expandRead(read);
    expect(plan.equivalents.find((e) => e.id === 'protein_poa.queso_panela')).toMatchObject({
      qty: 45,
      food: 'panela',
    });
    expect(plan.equivalents.find((e) => e.id === 'veg.pimiento_cocido')?.qty).toBe(0.5);
    expect(plan.equivalents.find((e) => e.id === 'veg.pimiento_crudo')?.qty).toBe(1);
    expect(plan.equivalents.find((e) => e.id === 'veg.brocoli')?.food).toBe('brócoli cocido');
    expect(plan.equivalents.map((e) => e.id)).toContain('carb_sg.couscous');
    expect(plan.equivalents.map((e) => e.id)).toContain('carb_sg.galleta_para_sopa');
    expect(plan.equivalents.map((e) => e.id)).toContain('dairy.leche_entera');
  });
  it('expands every food and keeps distinct colaciones, times and exact targets', () => {
    const plan = expandRead(planRead());
    expect(plan.slots.map((s) => [s.key, s.time, s.target])).toEqual(
      seedPlan.slots.map((s) => [s.key, s.time, s.target]),
    );
    expect(plan.slots.at(-1)?.label).toBe('Cena');
    expect(plan.equivalents.map((e) => e.id)).toEqual(seedPlan.equivalents.map((e) => e.id));
    expect(plan.swaps.every((s) => !s.confirmed)).toBe(true);
  });
  it('never silently corrects unusual portions or invalid targets, dates and times', () => {
    const read = planRead();
    read.slots[0]!.target.carb_sg = 2.2;
    read.slots[0]!.time = '26:99';
    read.issued_on = '2026-02-31';
    const plan = expandRead(read);
    const warnings = checkPlan(plan);
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'target', field: 'desayuno.carb_sg' },
        { code: 'time', field: 'desayuno' },
        { code: 'date', field: 'issued_on' },
        { code: 'portion', field: 'chía' },
        { code: 'portion', field: 'ajonjolí' },
      ]),
    );
    expect(plan.equivalents.find((e) => e.food === 'chía')?.qty).toBe(7);
    expect(plan.slots[0]?.target.carb_sg).toBe(2.2);
    expect(() => checkPlan({ ...plan, issued_on: 'unreadable' })).not.toThrow();
  });
  it('keeps conflicting same-name portions visible instead of overwriting a read', () => {
    const read = planRead();
    read.equivalent_rows = [
      { type: 'veg', qty: 0.5, unit: 'tza', foods: ['pimiento'], note: null },
      { type: 'veg', qty: 1, unit: 'tza', foods: ['pimiento'], note: null },
      { type: 'carb_sg', qty: 0.3333, unit: 'tza', foods: ['cereal'], note: null },
      { type: 'carb_sg', qty: 1, unit: 'barra', foods: ['cereal'], note: null },
    ];
    const plan = expandRead(read);
    expect(plan.equivalents.filter((e) => e.food === 'pimiento').map((e) => e.qty)).toEqual([0.5, 1]);
    expect(plan.equivalents.filter((e) => e.food === 'pimiento').every((e) => e.flag === 'check_portion')).toBe(true);
    expect(plan.equivalents.find((e) => e.id === 'carb_sg.cereal')?.qty).toBe(0.3333);
    expect(plan.equivalents.find((e) => e.id === 'carb_sg.barra_de_cereal')?.qty).toBe(1);
  });
  it('handles Spanish plurals and prefixes without changing portions or inventing an unclear fruit', () => {
    const read = planRead();
    read.equivalent_rows = [
      { type: 'veg', qty: 0.5, unit: 'tza', foods: ['ejotes', 'champiñones', 'verdura cocida coliflor'], note: null },
      { type: 'protein_poa', qty: 1, unit: 'reb', foods: ['monterrey bajos en grasa'], note: null },
      { type: 'carb_sg', qty: 0.3333, unit: 'pza', foods: ['bolillo s/ migajón'], note: null },
      { type: 'fruit', qty: 1, unit: 'tza', foods: ['frescos'], note: null },
      { type: 'fat_cp', qty: 14, unit: 'pza', foods: ['cacahuates'], note: null },
    ];
    const plan = expandRead(read);
    expect(plan.equivalents.map((e) => e.id)).toEqual([
      'veg.ejote',
      'veg.champinon',
      'veg.coliflor',
      'protein_poa.queso_monterrey_bajo_en_grasa',
      'carb_sg.bolillo_sin_migajon',
      'fruit.frescos',
      'fat_cp.cacahuate',
    ]);
    expect(plan.equivalents.find((e) => e.id === 'fruit.frescos')?.flag).toBe('check_portion');
    expect(plan.equivalents.find((e) => e.id === 'fat_cp.cacahuate')?.qty).toBe(14);
  });
  it('records and resolves each target, time and equivalent disagreement without index drift', () => {
    const a = expandRead(planRead());
    const b = structuredClone(a);
    b.slots[2]!.target.carb_sg = 3;
    b.slots[2]!.time = '16:00';
    b.equivalents[0]!.qty = 0.5;
    b.equivalents.splice(2, 1);
    b.equivalents.push({ ...b.equivalents[1]!, id: 'carb_sg.nuevo', food: 'nuevo' });
    const disagreements = compareReads(a, b);
    expect(disagreements.map((d) => d.id)).toEqual(
      expect.arrayContaining(['slots.2.target.carb_sg', 'slots.2.time', 'equivalents.0']),
    );
    const resolved = resolveReads(a, disagreements, Object.fromEntries(disagreements.map((d) => [d.id, 'b' as const])));
    expect(resolved).toEqual(b);
    expect(a.slots[2]?.target.carb_sg).toBe(2);
  });
  it('diff identifies changed cells, removed slots and food portions', () => {
    const next = structuredClone(seedPlan);
    next.slots[2]!.target.carb_sg = 3;
    next.slots.pop();
    next.equivalents[0]!.qty = 0.5;
    const diff = diffPlans(seedPlan, next);
    expect(diff.slots.find((s) => s.key === 'comida')?.deltas).toEqual({ carb_sg: 1 });
    expect(diff.slots.find((s) => s.key === 'cena')?.removed).toBe(true);
    expect(diff.equivalents).toHaveLength(1);
  });
  it('retains unmatched or partly matched example lines for review without assumed amounts', () => {
    expect(localExampleItems('2 tortillas y alimento sin identificar', seedPlan, seedPlan.slots[0]!.target)).toBeNull();
    expect(localExampleItems('tortillas', seedPlan, seedPlan.slots[0]!.target)).toBeNull();
    expect(localExampleItems('café negro', seedPlan, {})).toEqual([]);
    const read = planRead();
    read.slots[0]!.example_lines.push('2 tortillas y alimento sin identificar');
    expect(unmatchedExamples(read, expandRead(read)).map((r) => r.text)).toContain(
      '2 tortillas y alimento sin identificar',
    );
  });
});
