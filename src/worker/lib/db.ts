// D1 helpers: synced table definitions, upserts with a global monotonic `rev`, pulls.

import { TABLES } from '../../shared/db-tables';
import type { SyncTable } from '../../shared/domain/types';

export { TABLES } from '../../shared/db-tables';

export const REV_BUMP = "UPDATE meta SET value = value + 1 WHERE key = 'rev'";
export const REV_NOW = "(SELECT value FROM meta WHERE key = 'rev')";

/** Upsert statement for one row; `updated_at` = server now, `rev` = current global rev. */
export function upsertStatement(
  db: D1Database,
  table: SyncTable,
  row: Record<string, unknown>,
  now: number,
): D1PreparedStatement {
  const def = TABLES[table];
  const cols = def.columns;
  const values = cols.map((c) => {
    const v = row[c];
    if (def.json.includes(c)) return JSON.stringify(v ?? null);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v ?? null;
  });
  const updates = cols
    .filter((c) => c !== def.key)
    .map((c) => `${c} = excluded.${c}`)
    .concat(['updated_at = excluded.updated_at', 'rev = excluded.rev'])
    .join(', ');
  // Recipes also have a unique fingerprint: a concurrent duplicate from another device is ignored.
  const tail = table === 'recipes' ? ' ON CONFLICT DO NOTHING' : '';
  const sql = `INSERT INTO ${table} (${cols.join(', ')}, updated_at, rev) VALUES (${cols.map(() => '?').join(', ')}, ?, ${REV_NOW})
    ON CONFLICT(${def.key}) DO UPDATE SET ${updates}${tail}`;
  return db.prepare(sql).bind(...values, now);
}

export function softDeleteStatement(db: D1Database, table: SyncTable, id: string, now: number): D1PreparedStatement {
  return db
    .prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, rev = ${REV_NOW} WHERE id = ?`)
    .bind(now, now, id);
}

export async function currentRev(db: D1Database): Promise<number> {
  const r = await db.prepare("SELECT value FROM meta WHERE key = 'rev'").first<{ value: number }>();
  return r?.value ?? 0;
}

const PULL_LIMIT = 2000;

/** Rows with rev > since, up to the current rev, max 2,000 per table per call. */
export async function pull(
  db: D1Database,
  since: number,
): Promise<{ rev: number; more: boolean; changes: Record<string, unknown[]> }> {
  const rev = await currentRev(db);
  if (rev <= since) return { rev, more: false, changes: {} };
  const tables = Object.keys(TABLES) as SyncTable[];
  const stmts = tables.map((t) => {
    const def = TABLES[t];
    const where = t === 'plans' ? " AND status != 'draft'" : '';
    return db
      .prepare(
        `SELECT ${def.columns.join(', ')}, updated_at, rev FROM ${t} WHERE rev > ? AND rev <= ?${where} ORDER BY rev LIMIT ${PULL_LIMIT + 1}`,
      )
      .bind(since, rev);
  });
  const results = await db.batch<Record<string, unknown>>(stmts);
  let upTo = rev;
  results.forEach((r) => {
    if (r.results.length > PULL_LIMIT) upTo = Math.min(upTo, Number(r.results[PULL_LIMIT]?.rev ?? rev) - 1);
  });
  const changes: Record<string, unknown[]> = {};
  results.forEach((r, i) => {
    const rows = r.results.filter((row) => Number(row.rev) <= upTo);
    if (rows.length) changes[tables[i] as string] = rows;
  });
  return { rev: Math.max(upTo, since), more: upTo < rev, changes };
}
