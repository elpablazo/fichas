import { localParts } from '../../shared/domain/day';
import type { SyncTable } from '../../shared/domain/types';
import { TABLES } from './db';

export const BACKUP_SCHEMA = 1;
export const backupsEnabled = (env: Env) => String(env.BACKUPS_ENABLED) === 'true';
export async function exportSnapshot(env: Env, now = Date.now()) {
  const tables = Object.keys(TABLES) as SyncTable[];
  // D1 batch is transactional: rows and the revision belong to one consistent snapshot.
  const results = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT value FROM meta WHERE key='rev'"),
    ...tables.map((t) =>
      env.DB.prepare(
        `SELECT ${TABLES[t].columns.join(',')},updated_at,rev${t === 'plans' ? ',parse_report' : ''} FROM ${t}`,
      ),
    ),
  ]);
  const snapshot: Record<string, unknown> = {
    schema: BACKUP_SCHEMA,
    exported_at: new Date(now).toISOString(),
    version: env.APP_VERSION,
    rev: results[0]!.results[0]?.value ?? 0,
  };
  tables.forEach((table, i) => {
    snapshot[table] = results[i + 1]!.results;
  });
  return snapshot;
}
export async function listBackups(env: Env) {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FILES.list({ prefix: 'backup/', cursor });
    objects.push(...page.objects.filter((o) => /^backup\/\d{4}-\d{2}-\d{2}\.json$/.test(o.key)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects.sort((a, b) => b.key.localeCompare(a.key));
}
export async function createBackup(env: Env, now = Date.now(), tz: string = env.TZ_DEFAULT) {
  if (!backupsEnabled(env)) throw new Error('Backups are disabled.');
  const p = localParts(now, tz);
  const date = p.date;
  const key = `backup/${date}.json`;
  if (!(await env.FILES.head(key))) {
    const snapshot = await exportSnapshot(env, now);
    await env.FILES.put(key, JSON.stringify(snapshot), {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: { etagDoesNotMatch: '*' },
    });
  }
  const objects = await listBackups(env);
  if (objects.length > 8) await env.FILES.delete(objects.slice(8).map((o) => o.key));
  console.log(JSON.stringify({ event: 'backup', date, retained: Math.min(objects.length, 8) }));
  return key;
}
export async function scheduledBackup(env: Env, now: number) {
  if (!backupsEnabled(env)) return;
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key='tz'").first<{ value: string }>();
  const tz = row ? (JSON.parse(row.value) as string) : env.TZ_DEFAULT;
  const p = localParts(now, tz);
  if (new Date(`${p.date}T12:00:00Z`).getUTCDay() === 0 && p.hour === 3) await createBackup(env, now, tz);
}
