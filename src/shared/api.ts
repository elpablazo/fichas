// API request/response types and Zod schemas. The client must import from here with `import type` only.
import { z } from 'zod';
import type { PlanDiff } from './domain/diff';
import type { PlanReport } from './domain/plan-ingestion';
import { LogItem, PlanV1, Units } from './domain/plan-schema';
import type { PlanData, SyncTable } from './domain/types';

const id = z.string().min(1).max(120);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ms = z.number().int().nonnegative();
const nullableMs = ms.nullable();
const flag = z.number().int().min(0).max(1);
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const NotificationPreferences = z.object({
  enabled: z.boolean(),
  paused_until: nullableMs,
  quiet: z.tuple([clockTime, clockTime]),
  slots: z.record(z.string().max(60), z.boolean()),
  recap: z.boolean().optional(),
});

export const RowSchemas = {
  logs: z
    .object({
      id,
      plan_id: id,
      day,
      slot: z.string().min(1).max(60),
      kind: z.enum(['meal', 'skip', 'free']),
      title: z.string().max(2000),
      items: z.array(LogItem).max(40),
      raw_units: Units,
      units: Units,
      target: Units,
      status: z.enum(['on', 'over', 'under', 'mixed', 'extra', 'skip', 'free']),
      source: z.enum(['suggestion', 'recent', 'describe', 'compose', 'pantry', 'menu', 'backfill', 'photo', 'push']),
      recipe_id: id.nullable(),
      eaten_at: ms,
      created_at: ms,
      deleted_at: nullableMs,
    })
    .refine(
      (row) => row.title.length <= 200 || (row.kind === 'meal' && row.source === 'describe' && row.items.length === 0),
      {
        message: 'Only a provisional description may exceed the meal-title budget.',
      },
    ),
  recipes: z.object({
    id,
    title: z.string().max(200),
    items: z.array(LogItem).max(40),
    fingerprint: z.string().max(2000),
    slot_counts: z.record(z.string(), z.number().int().nonnegative()),
    times: z.number().int().nonnegative(),
    last_used_at: nullableMs,
    favorite: flag,
    hidden: flag,
    origin: z.enum(['log', 'seed', 'ai']),
    created_at: ms,
    deleted_at: nullableMs,
  }),
  pantry: z.object({
    id,
    label: z.string().max(120),
    equivalent_ids: z.array(z.string().max(120)).max(20),
    state: z.enum(['have', 'out']),
    on_list: flag,
    staple: flag,
    checked_at: ms,
    deleted_at: nullableMs,
  }),
  menus: z.object({
    id: z.string().max(140),
    day,
    slot: z.string().min(1).max(60),
    title: z.string().max(200),
    items: z.array(LogItem).max(40),
    recipe_id: id.nullable(),
    accepted_at: nullableMs,
    deleted_at: nullableMs,
  }),
  weighins: z.object({
    id,
    day,
    kg: z.number().gt(20).lt(400),
    source: z.enum(['nutritionist', 'home']),
    created_at: ms,
    deleted_at: nullableMs,
  }),
  achievements: z.object({
    id: z.string().max(160),
    kind: z.enum(['stamp', 'level', 'unlock', 'surprise']),
    key: z.string().max(80),
    season: z.number().int().nullable(),
    earned_at: ms,
    seen_at: nullableMs,
  }),
  settings: z
    .object({
      key: z.string().min(1).max(60),
      value: z.unknown(),
    })
    .refine((r) => r.key !== 'notifications' || NotificationPreferences.safeParse(r.value).success, {
      message: 'Invalid notification preferences.',
    }),
} as const;

export type WritableTable = keyof typeof RowSchemas;

export const Mutation = z.object({
  table: z.enum(['logs', 'recipes', 'pantry', 'menus', 'weighins', 'achievements', 'settings']),
  op: z.enum(['upsert', 'delete']),
  row: z.record(z.string(), z.unknown()),
});
export const PushBody = z.object({ mutations: z.array(Mutation).max(200) });
export type MutationT = z.infer<typeof Mutation>;

/** Pull response: JSON columns arrive as strings (the worker never re-encodes them). */
export interface PullResponse {
  rev: number;
  more: boolean;
  changes: Partial<Record<SyncTable, Record<string, unknown>[]>>;
}
export interface PushResponse {
  rev: number;
}

export const PairBody = z.object({ code: z.string().min(1).max(200), label: z.string().max(80).default('') });

export interface SessionInfo {
  id: string;
  label: string;
  created_at: number;
  last_seen_at: number;
  current: boolean;
}

export const TelemetryBody = z.object({
  errors: z
    .array(
      z.object({
        id,
        at: ms,
        message: z.string().max(500),
        stack: z.string().max(4000).nullable().optional(),
        ctx: z.string().max(1000).nullable().optional(),
      }),
    )
    .max(50)
    .default([]),
  ux: z
    .array(
      z.object({
        id,
        at: ms,
        name: z.string().max(60),
        ms: z.number().nullable().optional(),
        taps: z.number().int().nullable().optional(),
        ctx: z.string().max(500).nullable().optional(),
      }),
    )
    .max(200)
    .default([]),
});

export const ConfirmBody = z.object({
  plan: PlanV1,
  starts_on: day,
  weighin_kg: z.number().gt(20).lt(400).nullable().optional(),
  resolutions: z.record(z.string(), z.enum(['a', 'b'])).default({}),
  warnings_ack: z.boolean().default(false),
  single_read_ack: z.boolean().default(false),
});

export interface ApiError {
  error: { code: string; message: string };
}
export interface PlanDraftView {
  draft_id: string | null;
  status?: string;
  plan?: PlanData;
  report?: PlanReport;
  diff?: PlanDiff;
}
