import { z } from 'zod';
import { Unit, Units } from './domain/plan-schema';

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const PantryBody = z.object({ text: z.string().trim().min(1).max(2000), day: Day });
export const PantryOutput = z.object({
  items: z
    .array(z.object({ label: z.string().min(1).max(120), equivalent_ids: z.array(z.string().max(120)).max(20) }))
    .max(30),
});
export const IdeasBody = z.object({
  day: Day,
  slot: z.string().min(1).max(60),
  remaining: Units,
  have: z.array(z.string().max(120)).max(500),
});
export const IdeasOutput = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        items: z
          .array(z.object({ equivalent_id: z.string().max(120), qty: z.number().positive().max(10000), unit: Unit }))
          .min(1)
          .max(30),
      }),
    )
    .max(3),
});
