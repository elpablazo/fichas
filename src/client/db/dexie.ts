// IndexedDB (§6.2). Rows mirror D1 rows with JSON columns parsed. Renders everything; works offline.
import Dexie, { type Table } from 'dexie';
import type {
  AchievementRow,
  LogRow,
  MenuRow,
  PantryRow,
  PlanRow,
  RecipeRow,
  SettingRow,
  SyncTable,
  WeighinRow,
} from '../../shared/domain/types';

export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  id: string;
}
export interface LocalEntry {
  key: string;
  value: unknown;
}
export interface PendingDescribe {
  id: string; // log id it fills when parsed
  text: string;
  slot: string;
  day: string;
  created_at: number;
  attempts?: number;
  next_attempt_at?: number;
}

export class FichasDB extends Dexie {
  plans!: Table<PlanRow, string>;
  logs!: Table<LogRow, string>;
  recipes!: Table<RecipeRow, string>;
  pantry!: Table<PantryRow, string>;
  menus!: Table<MenuRow, string>;
  weighins!: Table<WeighinRow, string>;
  achievements!: Table<AchievementRow, string>;
  settings!: Table<SettingRow, string>;
  outbox!: Table<OutboxEntry, number>;
  local!: Table<LocalEntry, string>;
  pending!: Table<PendingDescribe, string>;

  constructor() {
    super('fichas');
    this.version(1).stores({
      plans: 'id, status, starts_on, rev',
      logs: 'id, day, [day+slot], plan_id, rev',
      recipes: 'id, fingerprint, last_used_at, rev',
      pantry: 'id, state, rev',
      menus: 'id, day, rev',
      weighins: 'id, day, rev',
      achievements: 'id, kind, season, rev',
      settings: 'key',
      outbox: '++seq, table, id',
      local: 'key',
      pending: 'id',
    });
  }
}

export const db = new FichasDB();

export const JSON_COLUMNS: Record<SyncTable, string[]> = {
  plans: ['data', 'source_keys'],
  logs: ['items', 'raw_units', 'units', 'target'],
  recipes: ['items', 'slot_counts'],
  pantry: ['equivalent_ids'],
  menus: ['items'],
  weighins: [],
  achievements: [],
  settings: ['value'],
};

/** Parses a pulled row: JSON columns arrive as strings. */
export function parseRow(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const c of JSON_COLUMNS[table]) {
    const v = out[c];
    if (typeof v === 'string') {
      try {
        out[c] = JSON.parse(v);
      } catch {
        out[c] = null;
      }
    }
  }
  return out;
}

export async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const r = await db.local.get(key);
  return r ? (r.value as T) : fallback;
}
export async function setLocal(key: string, value: unknown): Promise<void> {
  await db.local.put({ key, value });
}
