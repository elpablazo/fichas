// Deferred descriptions: replace the original row once, retaining its day, plan and target snapshot.
import { buildLog } from '../../shared/domain/log';
import { fingerprint, upsertRecipe } from '../../shared/domain/recipes';
import { isProvisional } from '../../shared/domain/status';
import { parseRemote } from '../ai';
import { addOptimistic } from '../state/signals';
import { db } from './dexie';

export async function processPending(): Promise<boolean> {
  if (!navigator.onLine) return false;
  // Pull reconstructs pending jobs on another device; never scan the entire meal history here.
  let changed = false;
  for (const pending of await db.pending.toArray()) {
    if (!navigator.onLine) break;
    const prev = await db.logs.get(pending.id);
    if (!prev || prev.deleted_at || !isProvisional(prev)) {
      await db.pending.delete(pending.id);
      continue;
    }
    if ((pending.next_attempt_at ?? 0) > Date.now()) continue;
    const plan = await db.plans.get(prev.plan_id);
    if (!plan) continue;
    const result = await parseRemote(pending.text, pending.slot, pending.day, undefined, prev.plan_id);
    if (result.kind !== 'ok' || !result.result.items.length) {
      const attempts = (pending.attempts ?? 0) + 1;
      await db.pending.update(pending.id, {
        attempts,
        next_attempt_at: Date.now() + Math.min(30_000 * 2 ** Math.min(attempts, 5), 15 * 60_000),
      });
      continue;
    }
    await db.transaction('rw', [db.logs, db.recipes, db.pending, db.outbox], async () => {
      const current = await db.logs.get(prev.id);
      // An edit, undo, delete or another processor wins over a late response.
      if (!current || current.deleted_at || !isProvisional(current) || current.updated_at !== prev.updated_at) return;
      const now = Date.now();
      const row = buildLog({
        id: prev.id,
        plan_id: prev.plan_id,
        plan: plan.data,
        rules: plan.data.swaps,
        day: prev.day,
        slot: prev.slot,
        title: result.result.title,
        items: result.result.items,
        source: prev.source,
        now,
        eaten_at: prev.eaten_at,
        target: prev.target,
        slotLogs: (await db.logs.where('[day+slot]').equals([prev.day, prev.slot]).toArray()).filter(
          (l) => l.id !== prev.id && !l.deleted_at,
        ),
      });
      row.created_at = prev.created_at;
      if (row.kind === 'meal') {
        const fp = fingerprint(row.items);
        const prior = await db.recipes
          .where('fingerprint')
          .equals(fp)
          .filter((r) => !r.deleted_at)
          .first();
        const recipe = upsertRecipe(prior, row, now, crypto.randomUUID());
        row.recipe_id = recipe.id;
        await db.recipes.put(recipe);
        await db.outbox.add({ table: 'recipes', id: recipe.id });
      }
      await db.logs.put(row);
      await db.outbox.add({ table: 'logs', id: row.id });
      await db.pending.delete(row.id);
      addOptimistic([row]);
      changed = true;
    });
  }
  return changed;
}
