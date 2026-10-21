import { computed, signal } from '@preact/signals';
import { matchPantry, type PantryItem } from '../shared/domain/pantry';
import { norm, slug } from '../shared/domain/text';
import type { PantryRow } from '../shared/domain/types';
import { kitchenCopy } from './copy/more';
import { db } from './db/dexie';
import { writeRow, writeRows } from './db/outbox';
import { journalPantry, settlePantry } from './db/pantry-journal';
import { api } from './db/sync';
import { activePlan, pantry, today } from './state/signals';
import { showToast } from './state/ui';

const optimistic = signal<PantryRow[]>([]);
export const inventory = computed(() => {
  const rows = new Map(pantry.value.map((p) => [p.id, p]));
  for (const p of optimistic.value) {
    const base = rows.get(p.id);
    // A matching local write or a newer server revision retires the optimistic overlay.
    // Server timestamps can be behind a phone clock; that must not hide another device's update.
    if (!base || (base.checked_at !== p.checked_at && base.rev <= p.rev && Date.now() - p.updated_at < 60000))
      rows.set(p.id, p);
  }
  const plan = activePlan.value?.data;
  return [...rows.values()]
    .filter((p) => !p.deleted_at)
    .map((p) => {
      if (!plan || p.equivalent_ids.every((id) => plan.equivalents.some((e) => e.id === id))) return p;
      const matched = matchPantry(p.label, plan).items[0]?.equivalent_ids ?? [];
      return {
        ...p,
        equivalent_ids: [
          ...new Set([...p.equivalent_ids.filter((id) => plan.equivalents.some((e) => e.id === id)), ...matched]),
        ],
      };
    });
});

function show(rows: PantryRow[]) {
  optimistic.value = [
    ...optimistic.value.filter((p) => Date.now() - p.updated_at < 60000 && !rows.some((r) => r.id === p.id)),
    ...rows,
  ];
}
export async function changeStock(row: PantryRow, updates: Partial<PantryRow>) {
  const at = Date.now();
  const next = { ...row, ...updates, updated_at: at, checked_at: at };
  journalPantry([next]);
  show([next]);
  await writeRow('pantry', next);
  settlePantry([next]);
  showToast(next.state === 'out' ? kitchenCopy.out : kitchenCopy.backHave, () => {
    const restored = { ...row, updated_at: Date.now(), checked_at: Date.now() };
    journalPantry([restored]);
    show([restored]);
    void writeRow('pantry', restored).then(() => settlePantry([restored]));
  });
}

interface PendingPantry {
  id: string;
  checked: number;
  attempts: number;
  next: number;
}
export async function addPantry(text: string): Promise<void> {
  const plan = activePlan.value;
  if (!plan || !text.trim()) return;
  const matched = matchPantry(text, plan.data);
  const before = inventory.value;
  const at = Date.now();
  const rows = matched.items.map((item) => {
    const previous = before.find(
      (p) =>
        norm(p.label) === norm(item.label) ||
        (item.equivalent_ids.length > 0 && p.equivalent_ids.some((id) => item.equivalent_ids.includes(id))),
    );
    return {
      id: previous?.id ?? `pantry:${slug(item.label).slice(0, 100)}`,
      label: item.label,
      equivalent_ids: item.equivalent_ids,
      state: 'have' as const,
      on_list: 0,
      staple: previous?.staple ?? 0,
      checked_at: at,
      updated_at: at,
      deleted_at: null,
      rev: previous?.rev ?? 0,
    };
  });
  journalPantry(rows);
  show(rows);
  await db.transaction('rw', [db.pantry, db.outbox, db.local], async () => {
    for (const row of rows) {
      await db.pantry.put(row);
      await db.outbox.add({ table: 'pantry', id: row.id });
      if (!row.equivalent_ids.length)
        await db.local.put({
          key: `pantry-pending:${row.id}`,
          value: { id: row.id, checked: at, attempts: 0, next: 0 } satisfies PendingPantry,
        });
    }
  });
  settlePantry(rows);
  showToast(kitchenCopy.added, () => {
    const restored = rows.map((row) => ({
      ...(before.find((p) => p.id === row.id) ?? { ...row, deleted_at: Date.now() }),
      updated_at: Date.now(),
      checked_at: Date.now(),
    }));
    journalPantry(restored);
    show(restored);
    void writeRows(restored.map((row) => ({ table: 'pantry', row }))).then(() => settlePantry(restored));
  });
  // The ordinary sync loop will push the inventory and process its persistent naming queue.
  const { schedule } = await import('./db/sync');
  schedule(0);
}

export async function buyItem(item: PantryItem & { id: string; row?: PantryRow }) {
  if (item.row) return changeStock(item.row, { state: 'have', on_list: 0 });
  const at = Date.now();
  const row: PantryRow = {
    id: `pantry:${slug(item.label).slice(0, 100)}`,
    label: item.label,
    equivalent_ids: item.equivalent_ids,
    state: 'have',
    on_list: 0,
    staple: 0,
    checked_at: at,
    updated_at: at,
    deleted_at: null,
    rev: 0,
  };
  journalPantry([row]);
  show([row]);
  await writeRow('pantry', row);
  settlePantry([row]);
}

let running: Promise<boolean> | null = null;
export function processPantryPending(): Promise<boolean> {
  if (running) return running;
  running = (async () => {
    if (!navigator.onLine || !activePlan.value) return false;
    let changed = false;
    const queued = await db.local.where('key').startsWith('pantry-pending:').toArray();
    const due = queued.filter((entry) => {
      const p = entry.value as PendingPantry;
      return p.attempts < 5 && p.next <= Date.now();
    });
    for (const entry of due.slice(0, 1)) {
      const pending = entry.value as PendingPantry;
      const row = await db.pantry.get(pending.id);
      if (!row || row.deleted_at || row.checked_at !== pending.checked || row.equivalent_ids.length) {
        await db.local.delete(entry.key);
        continue;
      }
      if (pending.attempts >= 5 || pending.next > Date.now()) continue;
      try {
        const response = await api('/api/ai/pantry', {
          method: 'POST',
          body: JSON.stringify({ text: row.label, day: today.value }),
          signal: AbortSignal.timeout(26000),
        });
        if (!response.ok) throw new Error('Unavailable');
        const body = (await response.json()) as { items: PantryItem[] };
        const item =
          body.items.find((item) => norm(item.label) === norm(row.label)) ??
          (body.items.length === 1 ? body.items[0] : undefined);
        const latest = await db.pantry.get(row.id);
        if (!latest || latest.deleted_at || latest.checked_at !== row.checked_at) {
          await db.local.delete(entry.key);
          continue;
        }
        const valid =
          item?.equivalent_ids.filter((id) => activePlan.value?.data.equivalents.some((e) => e.id === id)) ?? [];
        if (valid.length) {
          const next = { ...latest, equivalent_ids: valid.slice(0, 20), updated_at: Date.now() };
          show([next]);
          await writeRow('pantry', next);
          await db.local.delete(entry.key);
          changed = true;
        } else await db.local.put({ ...entry, value: { ...pending, attempts: 5 } });
      } catch {
        await db.local.put({
          ...entry,
          value: {
            ...pending,
            attempts: pending.attempts + 1,
            next: Date.now() + Math.min(300000, 15000 * 2 ** pending.attempts),
          },
        });
      }
    }
    return changed;
  })().finally(() => {
    running = null;
  });
  return running;
}

export async function retryPantry(row: PantryRow) {
  await db.local.put({
    key: `pantry-pending:${row.id}`,
    value: { id: row.id, checked: row.checked_at, attempts: 0, next: 0 } satisfies PendingPantry,
  });
  const { schedule } = await import('./db/sync');
  schedule(0);
}

/** Links a pantry food to plan equivalents by hand (no AI needed). */
export async function linkPantry(row: PantryRow, ids: string[]) {
  const at = Date.now();
  const next = { ...row, equivalent_ids: ids.slice(0, 20), updated_at: at, checked_at: at };
  journalPantry([next]);
  show([next]);
  await writeRow('pantry', next);
  settlePantry([next]);
  await db.local.delete(`pantry-pending:${row.id}`);
}

export async function removePantry(row: PantryRow) {
  const at = Date.now();
  const gone = { ...row, deleted_at: at, updated_at: at, checked_at: at };
  journalPantry([gone]);
  show([gone]);
  await writeRow('pantry', gone);
  settlePantry([gone]);
  showToast(kitchenCopy.removed, () => {
    const back = { ...row, deleted_at: null, updated_at: Date.now(), checked_at: Date.now() };
    journalPantry([back]);
    show([back]);
    void writeRow('pantry', back).then(() => settlePantry([back]));
  });
}
