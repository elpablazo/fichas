// Shared table metadata for sync, export and recovery.
import type { SyncTable } from './domain/types';

interface TableDef {
  key: 'id' | 'key';
  columns: string[]; // client-visible columns, excluding updated_at/rev
  json: string[];
  deletable: boolean;
}

export const TABLES: Record<SyncTable, TableDef> = {
  plans: {
    key: 'id',
    columns: [
      'id',
      'season',
      'status',
      'issued_on',
      'starts_on',
      'ends_on',
      'data',
      'source_keys',
      'source_sha256',
      'created_at',
      'confirmed_at',
    ],
    json: ['data', 'source_keys'],
    deletable: false,
  },
  logs: {
    key: 'id',
    columns: [
      'id',
      'plan_id',
      'day',
      'slot',
      'kind',
      'title',
      'items',
      'raw_units',
      'units',
      'target',
      'status',
      'source',
      'recipe_id',
      'eaten_at',
      'created_at',
      'deleted_at',
    ],
    json: ['items', 'raw_units', 'units', 'target'],
    deletable: true,
  },
  recipes: {
    key: 'id',
    columns: [
      'id',
      'title',
      'items',
      'fingerprint',
      'slot_counts',
      'times',
      'last_used_at',
      'favorite',
      'hidden',
      'origin',
      'created_at',
      'deleted_at',
    ],
    json: ['items', 'slot_counts'],
    deletable: true,
  },
  pantry: {
    key: 'id',
    columns: ['id', 'label', 'equivalent_ids', 'state', 'on_list', 'staple', 'checked_at', 'deleted_at'],
    json: ['equivalent_ids'],
    deletable: true,
  },
  menus: {
    key: 'id',
    columns: ['id', 'day', 'slot', 'title', 'items', 'recipe_id', 'accepted_at', 'deleted_at'],
    json: ['items'],
    deletable: true,
  },
  weighins: {
    key: 'id',
    columns: ['id', 'day', 'kg', 'source', 'created_at', 'deleted_at'],
    json: [],
    deletable: true,
  },
  achievements: {
    key: 'id',
    columns: ['id', 'kind', 'key', 'season', 'earned_at', 'seen_at'],
    json: [],
    deletable: false,
  },
  settings: { key: 'key', columns: ['key', 'value'], json: ['value'], deletable: false },
};
