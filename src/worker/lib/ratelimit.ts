// Sliding-hour rate limits stored in D1 (single owner: small tables, cheap queries).
const HOUR = 3_600_000;

/** True if `key` has fewer than `limit` recorded hits in the last hour. */
export async function underLimit(db: D1Database, key: string, limit: number, now = Date.now()): Promise<boolean> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM auth_attempts WHERE ip = ? AND at > ?')
    .bind(key, now - HOUR)
    .first<{ n: number }>();
  return (row?.n ?? 0) < limit;
}

export async function hit(db: D1Database, key: string, now = Date.now()): Promise<void> {
  await db.batch([
    db.prepare('INSERT INTO auth_attempts (ip, at) VALUES (?, ?)').bind(key, now),
    db.prepare('DELETE FROM auth_attempts WHERE at < ?').bind(now - 24 * HOUR),
  ]);
}

/** Records a hit for `key` and returns true if it is within `limit` per hour. */
export async function allow(db: D1Database, key: string, limit: number, now = Date.now()): Promise<boolean> {
  if (!(await underLimit(db, key, limit, now))) return false;
  await hit(db, key, now);
  return true;
}
