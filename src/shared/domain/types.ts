// Core domain types shared by client, worker and scripts. Pure TS, no runtime deps.

export const TYPE_KEYS = [
  'carb_sg',
  'carb_cg',
  'protein_poa',
  'legume',
  'dairy',
  'fruit',
  'veg',
  'sugar_sg',
  'sugar_cg',
  'fat_sp',
  'fat_cp',
] as const;
export type TypeKey = (typeof TYPE_KEYS)[number];
export type Units = Partial<Record<TypeKey, number>>;

export const UNIT_NAMES = [
  'pza',
  'tza',
  'cda',
  'cdta',
  'g',
  'ml',
  'reb',
  'lata',
  'paquete',
  'barra',
  'disparo',
  'mitad',
] as const;
export type UnitName = (typeof UNIT_NAMES)[number];

export interface Equivalent {
  id: string; // `${type}.${slug(food)}`
  type: TypeKey;
  food: string; // singular, lowercase Spanish
  qty: number; // amount equal to ONE unit
  unit: UnitName;
  aliases: string[];
  note: string | null;
  source: 'table' | 'example' | 'owner';
  flag: 'check_portion' | null;
}

export interface ExampleOption {
  equivalent_id: string;
  qty: number;
  unit: UnitName;
}
export interface ExampleItem {
  text: string;
  options: ExampleOption[];
}

export interface Slot {
  key: string;
  label: string;
  source_label: string;
  kind: 'meal' | 'snack';
  time: string | null; // HH:MM
  target: Units;
  example: { title: string; items: ExampleItem[] } | null;
}

export interface SwapRule {
  kind: 'decompose' | 'substitute';
  from: TypeKey;
  to: Units;
  confirmed: boolean;
  source: 'default' | 'plan' | 'owner';
}

export type Rebalance = 'unknown' | 'allowed' | 'not_allowed';

export interface PlanData {
  schema: 1;
  issued_on: string | null;
  next_appointment: string | null;
  fluids_ml: number | null;
  exercise: string | null;
  notes: string[];
  slots: Slot[];
  equivalents: Equivalent[];
  free_foods: string[];
  swaps: SwapRule[];
  rules: { rebalance_within_day: Rebalance };
}

export interface LogItem {
  label: string; // what the user sees: "120 g pollo"
  qty: number;
  unit: string;
  equivalent_id: string | null;
  units: Units; // raw units of this item
  estimated: boolean;
  assumed_qty: boolean;
  free: boolean;
}

export type LogKind = 'meal' | 'skip' | 'free';
export type Status = 'on' | 'over' | 'under' | 'mixed' | 'extra' | 'skip' | 'free';
export type LogSource =
  | 'suggestion'
  | 'recent'
  | 'describe'
  | 'compose'
  | 'pantry'
  | 'menu'
  | 'backfill'
  | 'photo'
  | 'push';

export type FitChange =
  | { item_index: number; from_qty: number; to_qty: number }
  | { added: LogItem }
  | { removed_index: number };

export interface Suggestion {
  title: string;
  items: LogItem[];
  recipe_id?: string;
  origin: 'menu' | 'recipe' | 'seed' | 'pantry' | 'ai';
  changes: FitChange[];
  /** Optional tag for the card: classic (most used), nutritionist example, planned menu. */
  tag?: 'classic' | 'seed' | 'menu' | 'new';
}

// ---- Synced rows (D1 ⇄ IndexedDB, JSON columns parsed) ----

export interface SyncMeta {
  updated_at: number;
  rev: number;
}

export type PlanStatus = 'draft' | 'active' | 'archived' | 'discarded';
export interface PlanRow extends SyncMeta {
  id: string;
  season: number | null;
  status: PlanStatus;
  issued_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  data: PlanData;
  source_keys: string[];
  source_sha256: string | null;
  created_at: number;
  confirmed_at: number | null;
}

export interface LogRow extends SyncMeta {
  id: string;
  plan_id: string;
  day: string;
  slot: string; // slot key or 'extra'
  kind: LogKind;
  title: string;
  items: LogItem[];
  raw_units: Units;
  units: Units;
  target: Units;
  status: Status;
  source: LogSource;
  recipe_id: string | null;
  eaten_at: number;
  created_at: number;
  deleted_at: number | null;
}

export interface RecipeRow extends SyncMeta {
  id: string;
  title: string;
  items: LogItem[];
  fingerprint: string;
  slot_counts: Record<string, number>;
  times: number;
  last_used_at: number | null;
  favorite: number;
  hidden: number;
  origin: 'log' | 'seed' | 'ai';
  created_at: number;
  deleted_at: number | null;
}

export interface PantryRow extends SyncMeta {
  id: string;
  label: string;
  equivalent_ids: string[];
  state: 'have' | 'out';
  on_list: number;
  staple: number;
  checked_at: number;
  deleted_at: number | null;
}

export interface MenuRow extends SyncMeta {
  id: string; // `${day}:${slot}`
  day: string;
  slot: string;
  title: string;
  items: LogItem[];
  recipe_id: string | null;
  accepted_at: number | null;
  deleted_at: number | null;
}

export interface WeighinRow extends SyncMeta {
  id: string;
  day: string;
  kg: number;
  source: 'nutritionist' | 'home';
  created_at: number;
  deleted_at: number | null;
}

export interface AchievementRow extends SyncMeta {
  id: string; // `${kind}:${key}:${season ?? 'life'}`
  kind: 'stamp' | 'level' | 'unlock' | 'surprise';
  key: string;
  season: number | null;
  earned_at: number;
  seen_at: number | null;
}

export interface SettingRow extends SyncMeta {
  key: string;
  value: unknown;
}

export interface SyncTables {
  plans: PlanRow;
  logs: LogRow;
  recipes: RecipeRow;
  pantry: PantryRow;
  menus: MenuRow;
  weighins: WeighinRow;
  achievements: AchievementRow;
  settings: SettingRow;
}
export type SyncTable = keyof SyncTables;
export const SYNC_TABLES: SyncTable[] = [
  'plans',
  'logs',
  'recipes',
  'pantry',
  'menus',
  'weighins',
  'achievements',
  'settings',
];
export const CLIENT_WRITABLE: SyncTable[] = [
  'logs',
  'recipes',
  'pantry',
  'menus',
  'weighins',
  'achievements',
  'settings',
];
