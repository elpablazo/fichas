// Provider output is validated and converted into LogItems on the Worker.
import { z } from 'zod';
import { TypeKey, Unit } from './domain/plan-schema';

export const AiMeal = z.object({
  title: z.string().max(80),
  confidence: z.enum(['high', 'medium', 'low']),
  items: z
    .array(
      z.object({
        dish: z.string().max(60),
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

// Live food categorization while typing (JEV, docs/04-today-2.md §5). Groups are the plan's food types as people
// name them; portions never come from here.
export const FOOD_GROUPS = ['carb', 'protein', 'legume', 'dairy', 'fruit', 'veg', 'fat', 'nuts', 'sugar'] as const;
export type FoodGroup = (typeof FOOD_GROUPS)[number];

export const ClassifyBody = z.object({
  items: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
});

export interface Classified {
  text: string;
  /** Probability that the phrase is something eaten or drunk. */
  food: number;
  /** Counts as nothing in the plan (water, black coffee, salsa, spices). */
  free: boolean;
  groups: FoodGroup[];
}
