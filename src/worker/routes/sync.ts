import { Hono } from 'hono';
import { PushBody, RowSchemas, type WritableTable } from '../../shared/api';
import { currentRev, pull, REV_BUMP, softDeleteStatement, upsertStatement } from '../lib/db';
import { type AppEnv, apiError } from '../lib/http';

export const sync = new Hono<AppEnv>();

sync.get('/', async (c) => {
  const since = Number(c.req.query('since') ?? 0);
  if (!Number.isFinite(since) || since < 0) return apiError(c, 400, 'bad_request', 'Invalid since.');
  return c.json(await pull(c.env.DB, since));
});

sync.post('/', async (c) => {
  const parsed = PushBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid body.');
  const now = Date.now();
  const db = c.env.DB;
  const stmts: D1PreparedStatement[] = [db.prepare(REV_BUMP)];
  const touchedLogs: { day: string; slot: string; eaten_at: number }[] = [];
  for (const m of parsed.data.mutations) {
    const table = m.table as WritableTable;
    if (m.op === 'delete') {
      const id = typeof m.row.id === 'string' ? m.row.id : null;
      if (!id || table === 'settings' || table === 'achievements')
        return apiError(c, 400, 'bad_request', `Cannot delete from ${table}.`);
      stmts.push(softDeleteStatement(db, table, id, now));
      continue;
    }
    const row = RowSchemas[table].safeParse(m.row);
    if (!row.success)
      return apiError(c, 400, 'invalid_row', `Invalid ${table} row: ${row.error.issues[0]?.path.join('.')}`);
    stmts.push(upsertStatement(db, table, row.data as Record<string, unknown>, now));
    if (table === 'logs') {
      const l = row.data as { day: string; slot: string; eaten_at: number; kind: string; deleted_at: number | null };
      if (l.kind !== 'free' && !l.deleted_at) touchedLogs.push(l);
    }
  }
  // A log within 3 h of a nudge for that slot marks the nudge as acted on (§13 back-off).
  for (const l of touchedLogs) {
    stmts.push(
      db
        .prepare(
          "UPDATE notifications SET acted_at = ? WHERE kind = 'slot' AND day = ? AND slot = ? AND acted_at IS NULL AND sent_at <= ? AND sent_at >= ?",
        )
        .bind(now, l.day, l.slot, l.eaten_at, l.eaten_at - 3 * 3_600_000),
    );
  }
  try {
    await db.batch(stmts);
  } catch (error) {
    if (String(error).includes('log_snapshot_immutable'))
      return apiError(c, 400, 'immutable_snapshot', 'A historical plan or target cannot change.');
    throw error;
  }
  return c.json({ rev: await currentRev(db) });
});
