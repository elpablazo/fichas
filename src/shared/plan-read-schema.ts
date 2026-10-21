import { z } from 'zod';
import { TypeKey, Unit } from './domain/plan-schema';
import { TYPE_KEYS } from './domain/types';

// Required zero-valued target cells work with strict structured-output providers.
const targets = z.object(
  Object.fromEntries(TYPE_KEYS.map((t) => [t, z.number().min(0).max(30)])) as Record<
    (typeof TYPE_KEYS)[number],
    z.ZodNumber
  >,
);
export const PlanParseV1 = z.object({
  issued_on: z.string().nullable(),
  next_appointment: z.string().nullable(),
  fluids_ml: z.number().nullable(),
  exercise: z.string().nullable(),
  notes: z.array(z.string()).max(40),
  slots: z
    .array(
      z.object({
        source_label: z.string().min(1).max(60),
        time: z.string().nullable(),
        target: targets,
        example_lines: z.array(z.string().max(500)).max(30),
      }),
    )
    .min(1)
    .max(12),
  equivalent_rows: z
    .array(
      z.object({
        type: TypeKey,
        qty: z.number().positive().max(10000),
        unit: Unit,
        foods: z.array(z.string().min(1).max(120)).min(1).max(60),
        note: z.string().max(500).nullable(),
      }),
    )
    .min(1)
    .max(300),
  free_foods: z.array(z.string().max(120)).max(200),
});
export type PlanRead = z.infer<typeof PlanParseV1>;
