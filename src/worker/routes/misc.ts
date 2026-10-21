// Export, telemetry and diagnostics.
import { Hono } from 'hono';
import { TelemetryBody } from '../../shared/api';
import { backupsEnabled, createBackup, exportSnapshot, listBackups } from '../lib/backup';
import { type AppEnv, apiError } from '../lib/http';

export const misc = new Hono<AppEnv>();

misc.get('/export', async (c) => {
  const out = await exportSnapshot(c.env);
  c.header('Content-Disposition', `attachment; filename="fichas-${new Date().toISOString().slice(0, 10)}.json"`);
  return c.json(out);
});

misc.get('/backups', async (c) =>
  c.json({ backups: (await listBackups(c.env)).map((o) => ({ date: o.key.slice(7, 17), size: o.size })) }),
);
misc.post('/backups', async (c) => {
  if (!backupsEnabled(c.env)) return apiError(c, 503, 'backups_disabled', 'Backups are disabled.');
  return c.json({ key: await createBackup(c.env) }, 201);
});
misc.get('/backups/:date', async (c) => {
  const date = c.req.param('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError(c, 400, 'bad_date', 'Invalid backup date.');
  const object = await c.env.FILES.get(`backup/${date}.json`);
  if (!object) return apiError(c, 404, 'not_found', 'Backup not found.');
  c.header('Content-Disposition', `attachment; filename="fichas-${date}.json"`);
  c.header('Content-Type', 'application/json');
  return c.body(object.body);
});

misc.post('/telemetry', async (c) => {
  const parsed = TelemetryBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid body.');
  const db = c.env.DB;
  const stmts = [
    ...parsed.data.errors.map((e) =>
      db
        .prepare('INSERT OR IGNORE INTO client_errors (id, at, message, stack, ctx) VALUES (?, ?, ?, ?, ?)')
        .bind(e.id, e.at, e.message, e.stack ?? null, e.ctx ?? null),
    ),
    ...parsed.data.ux.map((u) =>
      db
        .prepare('INSERT OR IGNORE INTO ux_events (id, at, name, ms, taps, ctx) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(u.id, u.at, u.name, u.ms ?? null, u.taps ?? null, u.ctx ?? null),
    ),
  ];
  if (stmts.length) await db.batch(stmts);
  return c.body(null, 204);
});

/** p50/p90 of UX events over the last 7 days (Ajustes → Diagnóstico). */
misc.get('/diagnostics', async (c) => {
  const since = Date.now() - 7 * 86_400_000;
  const rows = await c.env.DB.prepare(
    'SELECT name, ms FROM ux_events WHERE at > ? AND ms IS NOT NULL ORDER BY name, ms',
  )
    .bind(since)
    .all<{ name: string; ms: number }>();
  const by = new Map<string, number[]>();
  for (const r of rows.results) by.set(r.name, [...(by.get(r.name) ?? []), r.ms]);
  const q = (xs: number[], p: number) => {
    const index = (xs.length - 1) * p;
    const lower = xs[Math.floor(index)] ?? 0;
    return lower + ((xs[Math.ceil(index)] ?? lower) - lower) * (index - Math.floor(index));
  };
  const errors = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM client_errors WHERE at > ?')
    .bind(since)
    .first<{ n: number }>();
  return c.json({
    events: [...by.entries()].map(([name, xs]) => ({ name, n: xs.length, p50: q(xs, 0.5), p90: q(xs, 0.9) })),
    errors: errors?.n ?? 0,
  });
});
