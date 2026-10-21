// Sync loop (§7): push the outbox, then pull changes since the cursor. Network never blocks the UI.
import { batch, signal } from '@preact/signals';
import type { PullResponse } from '../../shared/api';
import { isProvisional } from '../../shared/domain/status';
import type { LogRow, SyncTable } from '../../shared/domain/types';
import { settingRows } from '../state/signals';
import { db, getLocal, parseRow, setLocal } from './dexie';
import { onWrite } from './outbox';

export const paired = signal<'unknown' | 'yes' | 'no'>('unknown');
export const firstPullDone = signal(false);
export const syncing = signal(false);

const CURSOR = 'sync:cursor';
const BATCH = 200;
let backoff = 1000;
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | null = null;
let again = false;

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('X-Fichas', '1');
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (res.status === 401) paired.value = 'no';
  return res;
}

async function push(): Promise<void> {
  for (;;) {
    const entries = await db.outbox.orderBy('seq').limit(BATCH).toArray();
    if (!entries.length) return;
    const seen = new Set<string>();
    const mutations: { table: SyncTable; op: 'upsert'; row: unknown }[] = [];
    for (const e of entries) {
      const k = `${e.table}:${e.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const row = await db.table(e.table).get(e.id);
      if (row) mutations.push({ table: e.table, op: 'upsert', row });
    }
    const res = await api('/api/sync', { method: 'POST', body: JSON.stringify({ mutations }) });
    if (res.status === 400) {
      // A row the server rejects would block the queue forever: retry one by one, drop only bad rows.
      for (const m of mutations) {
        const one = await api('/api/sync', { method: 'POST', body: JSON.stringify({ mutations: [m] }) });
        if (one.status === 400) reportSyncError(await one.text());
        else if (!one.ok) throw new Error(`push ${one.status}`);
      }
    } else if (!res.ok) throw new Error(`push ${res.status}`);
    const maxSeq = entries[entries.length - 1]?.seq ?? 0;
    await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
  }
}

let reportSyncError: (msg: string) => void = () => {};
export function setSyncErrorReporter(fn: (msg: string) => void): void {
  reportSyncError = fn;
}

async function pull(): Promise<void> {
  let since = await getLocal<number>(CURSOR, 0);
  for (;;) {
    const res = await api(`/api/sync?since=${since}`);
    if (!res.ok) throw new Error(`pull ${res.status}`);
    paired.value = 'yes';
    const body = (await res.json()) as PullResponse;
    const tables = Object.keys(body.changes) as SyncTable[];
    if (tables.length) {
      await db.transaction('rw', [...tables.map((t) => db.table(t)), db.local, db.pending, db.outbox], async () => {
        // Read pending writes inside the same transaction as applying the pull. A tap between
        // a stale outbox snapshot and this transaction must not be overwritten by server state.
        const pendingIds = new Set((await db.outbox.toArray()).map((e) => `${e.table}:${e.id}`));
        for (const t of tables) {
          const rows = (body.changes[t] ?? [])
            .map((r) => parseRow(t, r))
            .filter((r) => !pendingIds.has(`${t}:${t === 'settings' ? r.key : r.id}`));
          if (rows.length) await db.table(t).bulkPut(rows);
          if (t === 'logs')
            for (const raw of rows) {
              const row = raw as unknown as LogRow;
              if (!row.deleted_at && isProvisional(row) && !(await db.pending.get(row.id))) {
                await db.pending.put({
                  id: row.id,
                  text: row.title,
                  slot: row.slot,
                  day: row.day,
                  created_at: row.created_at,
                });
              }
            }
        }
        await setLocal(CURSOR, body.rev);
      });
    } else await setLocal(CURSOR, body.rev);
    since = body.rev;
    if (!body.more) break;
  }
  // The IndexedDB live query may still be publishing its initial empty settings read.
  // Expose the committed local values before enabling controls gated by the first pull.
  const committedSettings = await db.settings.toArray();
  batch(() => {
    settingRows.value = committedSettings;
    firstPullDone.value = true;
  });
}

/** One sync round (push then pull). Concurrent calls coalesce. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    syncing.value = true;
    try {
      do {
        again = false;
        await push();
        await pull();
        const { processPending } = await import('./pending');
        if (await processPending()) again = true;
        const { processPantryPending } = await import('../kitchen');
        // Inventory naming is independent of food sync; a slow provider cannot hold the log outbox.
        void processPantryPending()
          .then((changed) => {
            if (changed) schedule(0);
          })
          .catch(() => {});
      } while (again);
      backoff = 1000;
    } catch {
      if (paired.value !== 'no') schedule(backoff);
      backoff = Math.min(backoff * 2, 60_000);
    } finally {
      syncing.value = false;
      running = null;
    }
  })();
  return running;
}

export function schedule(ms = 400): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

export function startSync(): void {
  onWrite(() => schedule(400));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(0);
  });
  window.addEventListener('online', () => schedule(0));
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 60_000);
  void syncNow();
}

export async function resetCursor(): Promise<void> {
  await setLocal(CURSOR, 0);
}
