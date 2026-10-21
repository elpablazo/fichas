// Provider output is validated and converted into LogItems on the Worker.
import { z } from 'zod';
import { TypeKey, Unit } from './domain/plan-schema';

export const AiMeal = z.object({
  title: z.string().max(80),
  confidence: z.enum(['high', 'medium', 'low']),
  items: z
    .array(
      z.object({
        food: z.string().min(1).max(120),
        equivalent_id: z.string().max(120).nullable(),
        qty: z.number().positive().max(10000),
        unit: Unit,
        assumed_qty: z.boolean(),
        free: z.boolean(),
        estimated_units: z.array(z.object({ type: TypeKey, units: z.number().min(0).max(30) })).max(11),
      }),
    )
    .max(30),
});

export const ParseBody = z.object({
  text: z.string().trim().min(1).max(2000),
  slot: z.string().min(1).max(60),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plan_id: z.string().min(1).max(120).optional(),
});

export type AiMealData = z.infer<typeof AiMeal>;
