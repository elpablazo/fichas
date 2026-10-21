// Local writes: row + outbox entry in one transaction. The UI reads Dexie, so it updates instantly.
import type { SyncTable, SyncTables } from '../../shared/domain/types';
import { db } from './dexie';

type Listener = () => void;
const listeners = new Set<Listener>();
export function onWrite(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface Write<T extends SyncTable = SyncTable> {
  table: T;
  row: SyncTables[T];
}

function rowId(table: SyncTable, row: { id?: string; key?: string }): string {
  return (table === 'settings' ? row.key : row.id) as string;
}

/** Writes rows locally and queues them for sync (outbox references rows; flush reads the latest version). */
export async function writeRows(writes: Write[]): Promise<void> {
  if (!writes.length) return;
  const tables = [...new Set(writes.map((w) => w.table))].map((t) => db.table(t));
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const w of writes) {
      await db.table(w.table).put(w.row);
      await db.outbox.add({ table: w.table, id: rowId(w.table, w.row as { id?: string; key?: string }) });
    }
  });
  for (const fn of listeners) fn();
}

export function writeRow<T extends SyncTable>(table: T, row: SyncTables[T]): Promise<void> {
  return writeRows([{ table, row } as Write]);
}
