// A tiny synchronous journal protects inventory when a page closes before its IDB commit.
import type { PantryRow } from '../../shared/domain/types';
import { db } from './dexie';

const KEY = 'pantry:journal:v1';
function read(): PantryRow[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows
      .filter(
        (r): r is PantryRow =>
          !!r &&
          typeof r.id === 'string' &&
          typeof r.label === 'string' &&
          Array.isArray(r.equivalent_ids) &&
          r.equivalent_ids.every((id: unknown) => typeof id === 'string') &&
          ['have', 'out'].includes(r.state) &&
          Number.isFinite(r.checked_at) &&
          Number.isFinite(r.updated_at),
      )
      .slice(-500);
  } catch {
    return [];
  }
}
function save(rows: PantryRow[]) {
  try {
    if (rows.length) localStorage.setItem(KEY, JSON.stringify(rows));
    else localStorage.removeItem(KEY);
  } catch {
    /* IDB remains authoritative if browser storage is unavailable. */
  }
}
export function journalPantry(rows: PantryRow[]) {
  const next = new Map(read().map((r) => [r.id, r]));
  for (const row of rows) next.set(row.id, row);
  save([...next.values()].slice(-500));
}
export function settlePantry(rows: PantryRow[]) {
  const committed = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
  save(read().filter((r) => committed.get(r.id) !== JSON.stringify(r)));
}
export async function restorePantryJournal() {
  const rows = read();
  if (!rows.length) return;
  await db.transaction('rw', [db.pantry, db.outbox, db.local], async () => {
    for (const row of rows) {
      await db.pantry.put(row);
      await db.outbox.add({ table: 'pantry', id: row.id });
      if (!row.deleted_at && !row.equivalent_ids.length)
        await db.local.put({
          key: `pantry-pending:${row.id}`,
          value: { id: row.id, checked: row.checked_at, attempts: 0, next: 0 },
        });
    }
  });
  settlePantry(rows);
}
