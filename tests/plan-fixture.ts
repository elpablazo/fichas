import seed from '../seed/plan-2026-10-08.json' with { type: 'json' };
import type { PlanData } from '../src/shared/domain/types';
import { TYPE_KEYS } from '../src/shared/domain/types';
import type { PlanRead } from '../src/shared/plan-read-schema';

export const seedPlan = seed as unknown as PlanData;
export function planRead(): PlanRead {
  return {
    issued_on: seed.issued_on,
    next_appointment: seed.next_appointment,
    fluids_ml: seed.fluids_ml,
    exercise: seed.exercise,
    notes: [...seed.notes],
    free_foods: [...seed.free_foods],
    slots: seed.slots.map((s) => ({
      source_label: s.source_label,
      time: s.time,
      target: Object.fromEntries(
        TYPE_KEYS.map((t) => [t, (s.target as Partial<Record<string, number>>)[t] ?? 0]),
      ) as PlanRead['slots'][number]['target'],
      example_lines: s.example?.items.map((i) => i.text) ?? [],
    })),
    equivalent_rows: seed.equivalents.map((e) => ({
      type: e.type as PlanRead['equivalent_rows'][number]['type'],
      qty: e.qty,
      unit: e.unit as PlanRead['equivalent_rows'][number]['unit'],
      foods: [e.food],
      note: e.note,
    })),
  };
}
