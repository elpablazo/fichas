import { RowSchemas } from './api';
import { TABLES } from './db-tables';
import { PlanV1 } from './domain/plan-schema';
import { SYNC_TABLES, type SyncTable } from './domain/types';

/** Produces SQL only for a fresh recovery database. No sessions, credentials or transient queues. */
export function restoreSql(input: unknown): { sql: string; counts: Record<string, number> } {
  if (!input || typeof input !== 'object') throw new Error('Invalid backup.');
  const snapshot = input as Record<string, unknown>;
  if (snapshot.schema !== 1 || !Number.isSafeInteger(snapshot.rev) || Number(snapshot.rev) < 0)
    throw new Error('Unsupported backup schema or revision.');
  const quote = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    throw new Error('Invalid SQL value.');
  };
  const lines: string[] = [],
    counts: Record<string, number> = {};
  for (const table of SYNC_TABLES) {
    if (!Array.isArray(snapshot[table])) throw new Error(`Missing ${table}.`);
    const def = TABLES[table];
    const columns = [...def.columns, 'updated_at', 'rev', ...(table === 'plans' ? ['parse_report'] : [])];
    counts[table] = (snapshot[table] as unknown[]).length;
    for (const raw of snapshot[table] as unknown[]) {
      if (!raw || typeof raw !== 'object') throw new Error(`Invalid ${table} row.`);
      const row = raw as Record<string, unknown>;
      const parsed = { ...row };
      for (const col of def.json) if (typeof parsed[col] === 'string') parsed[col] = JSON.parse(parsed[col] as string);
      if (table === 'plans') {
        if (row.status === 'active' || row.status === 'archived') PlanV1.parse(parsed.data);
        if (
          !['active', 'archived', 'draft', 'discarded'].includes(String(row.status)) ||
          typeof row.id !== 'string' ||
          !Array.isArray(parsed.source_keys)
        )
          throw new Error('Invalid plan row.');
      } else RowSchemas[table as Exclude<SyncTable, 'plans'>].parse(parsed);
      if (
        !Number.isSafeInteger(row.rev) ||
        Number(row.rev) > Number(snapshot.rev) ||
        !Number.isSafeInteger(row.updated_at)
      )
        throw new Error('Invalid row revision.');
      lines.push(
        `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((c) => quote(row[c])).join(',')});`,
      );
    }
  }
  lines.push(`UPDATE meta SET value=${quote(snapshot.rev)} WHERE key='rev';`);
  return { sql: lines.join('\n'), counts };
}
