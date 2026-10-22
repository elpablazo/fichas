// PlanV1 Zod schema (§6.3). Used by the worker and scripts; the client imports types only.
import { z } from 'zod';
import { TYPE_KEYS, UNIT_NAMES } from './types';

export const TypeKey = z.enum(TYPE_KEYS);
export const Units = z.partialRecord(TypeKey, z.number().min(0).max(30));
export const Unit = z.enum(UNIT_NAMES);

export const Equivalent = z.object({
  id: z.string(),
  type: TypeKey,
  food: z.string(),
  qty: z.number().positive(),
  unit: Unit,
  aliases: z.array(z.string()).default([]),
  note: z.string().nullable().default(null),
  source: z.enum(['table', 'example', 'owner']).default('table'),
  flag: z.enum(['check_portion']).nullable().default(null),
});

export const ExampleOption = z.object({ equivalent_id: z.string(), qty: z.number().positive(), unit: Unit });
export const ExampleItem = z.object({ text: z.string(), options: z.array(ExampleOption).min(1) });

export const Slot = z.object({
  key: z.string(),
  label: z.string(),
  source_label: z.string(),
  kind: z.enum(['meal', 'snack']),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  target: Units,
  example: z.object({ title: z.string(), items: z.array(ExampleItem) }).nullable(),
});

export const SwapRule = z.object({
  kind: z.enum(['decompose', 'substitute']),
  from: TypeKey,
  to: Units,
  confirmed: z.boolean(),
  source: z.enum(['default', 'plan', 'owner']),
});

export const PlanV1 = z.object({
  schema: z.literal(1),
  issued_on: z.string().nullable(),
  next_appointment: z.string().nullable(),
  fluids_ml: z.number().nullable(),
  exercise: z.string().nullable(),
  notes: z.array(z.string()),
  slots: z.array(Slot).min(1),
  equivalents: z.array(Equivalent).min(1),
  free_foods: z.array(z.string()),
  swaps: z.array(SwapRule),
  rules: z.object({ rebalance_within_day: z.enum(['unknown', 'allowed', 'not_allowed']) }),
});

export const LogItem = z.object({
  label: z.string().max(200),
  qty: z.number().min(0).max(10000),
  unit: z.string().max(20),
  equivalent_id: z.string().max(120).nullable(),
  units: Units,
  estimated: z.boolean(),
  assumed_qty: z.boolean(),
  free: z.boolean(),
  dish: z.string().trim().min(1).max(80).optional(),
});
