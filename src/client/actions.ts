// User actions: optimistic local writes (Dexie + outbox), feedback, undo. Never wait on the network.

import { balanceDay } from '../shared/domain/balance';
import { appMinutesToHhmm, zonedTime } from '../shared/domain/day';
import { fill } from '../shared/domain/format';
import { buildLog, buildSkip } from '../shared/domain/log';
import { fingerprint, upsertRecipe } from '../shared/domain/recipes';
import { baseTimes } from '../shared/domain/slots';
import { computeStatus, isOccasion } from '../shared/domain/status';
import type { LogItem, LogRow, LogSource, MenuRow, RecipeRow, TypeKey, Units } from '../shared/domain/types';
import { TYPE_KEYS } from '../shared/domain/types';
import { addUnits, formatCount, sumUnits, totalUnits } from '../shared/domain/units';
import { nowCopy, typeLabels } from './copy/es-MX';
import { pick } from './copy/pick';
import { db } from './db/dexie';
import { writeRow, writeRows } from './db/outbox';
import { schedule } from './db/sync';
import { sparkle } from './feedback/celebrate';
import { tick } from './feedback/haptics';
import { playTokens, unlockAudio } from './feedback/sound';
import { balanceOn } from './state/selectors';
import { addOptimistic, liveLogs, liveRecipes, menus, planForDay, plans, settings, today } from './state/signals';
import { dayTargets } from './state/today-vm';
import { showToast, startCelebration } from './state/ui';
import { markUx } from './telemetry';

const uid = () => crypto.randomUUID();

/** Every log write: shown immediately (optimistic), then persisted with its outbox entry. */
function writeLog(row: LogRow): Promise<void> {
  addOptimistic([row]);
  return writeRow('logs', row);
}

/** Effective target of a slot on a day: the plan's, balanced by "cuadrar el día" while it's unresolved. */
export function targetFor(slot: string, day: string): Units {
  if (slot === 'extra') return {};
  const plan = planForDay(plans.value, day);
  const i = plan?.data.slots.findIndex((s) => s.key === slot) ?? -1;
  if (!plan || i < 0) return {};
  const targets = dayTargets({ plan, logs: liveLogs.value, day, balance: balanceOn.value });
  return targets[i] ?? plan.data.slots[i]?.target ?? {};
}

/** When a meal recorded for another day was eaten: its planned time that day. */
export function plannedTime(slot: string, day: string): number {
  const plan = planForDay(plans.value, day);
  const slots = plan?.data.slots ?? [];
  const i = slots.findIndex((s) => s.key === slot);
  const { tz, day_start_hour } = settings.value;
  const minutes = i >= 0 ? (baseTimes(slots, day_start_hour)[i] ?? 600) : 600;
  return zonedTime(day, appMinutesToHhmm(minutes, day_start_hour), tz);
}

function largest(deltas: Partial<Record<TypeKey, number>>, sign: 1 | -1): [TypeKey, number] | null {
  let best: [TypeKey, number] | null = null;
  for (const t of TYPE_KEYS) {
    const v = (deltas[t] ?? 0) * sign;
    if (v >= 0.5 && (!best || v > best[1])) best = [t, v];
  }
  return best;
}

/** The friendly line for a fresh log (§14.6 Loop 1). */
export function logLine(
  row: LogRow,
  deltas: Partial<Record<TypeKey, number>>,
  firstOfDay: boolean,
  newDish: boolean,
  slotLabel: string,
  /** Types that cuadrar el día trims in a later meal after this log. */
  balanced: readonly TypeKey[] = [],
): string {
  if (row.kind === 'free') return pick('log.free');
  if (row.slot === 'extra') return pick('log.extra');
  if (firstOfDay) return pick('log.firstOfDay');
  switch (row.status) {
    case 'on':
      return newDish ? pick('log.newDish') : pick('log.onPlan', { slot: slotLabel });
    case 'over': {
      const overSum = Object.values(deltas).reduce((s, v) => s + Math.max(0, v ?? 0), 0);
      const top = largest(deltas, 1);
      if (overSum <= 1 && top) {
        const meta = typeLabels[top[0]];
        return pick(balanced.includes(top[0]) ? 'log.overBalanced' : 'log.overSmall', {
          type: meta.short,
          n: formatCount(top[1]),
          emoji: meta.emoji,
        });
      }
      return pick('log.overBig');
    }
    case 'under': {
      const top = largest(deltas, -1);
      const meta = top ? typeLabels[top[0]] : typeLabels.fruit;
      return pick('log.under', { n: formatCount(top?.[1] ?? 1), emoji: meta.emoji });
    }
    default:
      return pick('log.mixed');
  }
}

export interface LogInput {
  slot: string;
  title: string;
  items: LogItem[];
  source: LogSource;
  recipe_id?: string | null;
  day?: string;
  eatenAt?: number;
  /** No celebration (backfill, edits). */
  quiet?: boolean;
  anchor?: Element | null;
}

export async function logMeal(input: LogInput): Promise<LogRow | null> {
  markUx('log:tap');
  const day = input.day ?? today.value;
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const now = Date.now();
  const past = day !== today.value;
  const slotLogs = liveLogs.value.filter((l) => l.day === day && l.slot === input.slot);
  const row = buildLog({
    id: uid(),
    plan_id: plan.id,
    plan: plan.data,
    rules: plan.data.swaps,
    day,
    slot: input.slot,
    title: input.title,
    items: input.items,
    source: past && input.source !== 'backfill' ? 'backfill' : input.source,
    recipe_id: input.recipe_id ?? null,
    now,
    eaten_at: input.eatenAt ?? (past ? plannedTime(input.slot, day) : undefined),
    target: targetFor(input.slot, day),
    slotLogs,
  });
  const firstOfDay = isOccasion(row) && !liveLogs.value.some((l) => l.day === day && isOccasion(l));
  const writes: Parameters<typeof writeRows>[0] = [];
  let prevRecipe: RecipeRow | undefined;
  let recipe: RecipeRow | undefined;
  if (row.kind === 'meal') {
    const fp = fingerprint(row.items);
    prevRecipe = liveRecipes.value.find((r) => r.fingerprint === fp);
    recipe = upsertRecipe(prevRecipe, row, now, uid());
    if (!prevRecipe && input.title) recipe.title = input.title;
    row.recipe_id = recipe.id;
    writes.push({ table: 'recipes', row: recipe });
  }
  writes.unshift({ table: 'logs', row });

  // Instant feedback first (≤ 100 ms), then persist.
  addOptimistic([row]);
  const units = Math.round(totalUnits(row.raw_units));
  if (!input.quiet) {
    unlockAudio();
    tick(Math.max(1, Math.min(units, 6)));
    if (row.slot !== 'extra' && row.kind === 'meal' && day === today.value) startCelebration(row.slot);
    markUx('log:anim-start');
    // Sound and sparkles start one frame later, so the frame that shows the logged meal paints first
    // (the sparkle reads layout; the synth builds audio nodes).
    const later = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));
    later(() => playTokens(Math.max(1, units), row.status === 'on'));
    if (row.status === 'on') {
      const types = TYPE_KEYS.filter((t) => (row.raw_units[t] ?? 0) > 0);
      later(() => sparkle(input.anchor ?? document.querySelector('[data-card]'), types));
    }
  }
  await writeRows(writes);
  const slotLabel = plan.data.slots.find((s) => s.key === row.slot)?.label ?? '';
  const prior = sumUnits(slotLogs.filter((l) => l.kind === 'meal').map((l) => l.raw_units));
  const { deltas } = computeStatus(addUnits(prior, row.raw_units), row.target, plan.data.swaps);
  const dayLogs = [...liveLogs.value.filter((l) => l.day === day && l.id !== row.id), row];
  const balance = balanceDay(plan.data, dayLogs, plan.data.swaps, balanceOn.value);
  const balanced = balance.adjustments.map((a) => a.type).filter((t) => (balance.unabsorbed[t] ?? 0) < 0.5);
  const line =
    row.source === 'backfill'
      ? pick('log.backfill')
      : logLine(row, deltas, firstOfDay, !prevRecipe && row.kind === 'meal', slotLabel, balanced);
  showToast(line, () => void undoLog(row, prevRecipe, recipe));
  return row;
}

export async function undoLog(
  row: LogRow,
  prevRecipe: RecipeRow | undefined,
  recipe: RecipeRow | undefined,
): Promise<void> {
  const now = Date.now();
  const removed = { ...row, deleted_at: now, updated_at: now };
  addOptimistic([removed]);
  const writes: Parameters<typeof writeRows>[0] = [{ table: 'logs', row: removed }];
  if (prevRecipe) writes.push({ table: 'recipes', row: { ...prevRecipe, updated_at: now } });
  else if (recipe) writes.push({ table: 'recipes', row: { ...recipe, deleted_at: now, updated_at: now } });
  await writeRows(writes);
  await db.pending.delete(row.id);
  showToast(pick('log.undo'));
}

export async function skipSlot(slot: string, day = today.value): Promise<void> {
  const plan = planForDay(plans.value, day);
  if (!plan) return;
  tick(1);
  const row = buildSkip({ id: uid(), plan_id: plan.id, day, slot, now: Date.now(), target: targetFor(slot, day) });
  if (day !== today.value) row.eaten_at = plannedTime(slot, day);
  await writeLog(row);
  showToast(pick('log.skip'), () => void writeLog({ ...row, deleted_at: Date.now(), updated_at: Date.now() }));
}

/** Replace a logged meal's items (portion changes from the meal sheet). Undoable. */
export async function updateLog(prev: LogRow, items: LogItem[]): Promise<void> {
  const plan = planForDay(plans.value, prev.day);
  if (!plan) return;
  if (!items.length) return deleteLog(prev);
  const others = liveLogs.value.filter((l) => l.day === prev.day && l.slot === prev.slot && l.id !== prev.id);
  const next = buildLog({
    id: prev.id,
    plan_id: prev.plan_id,
    plan: plan.data,
    rules: plan.data.swaps,
    day: prev.day,
    slot: prev.slot,
    title: prev.title,
    items,
    source: prev.source,
    recipe_id: prev.recipe_id,
    now: Date.now(),
    eaten_at: prev.eaten_at,
    target: Object.keys(prev.target).length ? prev.target : targetFor(prev.slot, prev.day),
    slotLogs: others,
  });
  next.created_at = prev.created_at;
  await writeLog(next);
  showToast(pick('log.edited'), () => void writeLog({ ...prev, updated_at: Date.now() }));
}

/** When a logged meal was eaten (plan time vs real time). Undoable. */
export async function retimeLog(prev: LogRow, eatenAt: number): Promise<void> {
  if (Math.abs(prev.eaten_at - eatenAt) < 60_000) return;
  await writeLog({ ...prev, eaten_at: eatenAt, updated_at: Date.now() });
  showToast(pick('log.edited'), () => void writeLog({ ...prev, updated_at: Date.now() }));
}

export async function deleteLog(prev: LogRow): Promise<void> {
  const now = Date.now();
  await writeLog({ ...prev, deleted_at: now, updated_at: now });
  showToast(pick('log.removed'), () => void writeLog({ ...prev, deleted_at: null, updated_at: Date.now() }));
}

/** Persist the occasion and retry request atomically. Unknown portions stay empty. */
export async function logPendingDescription(
  text: string,
  slot: string,
  day = today.value,
  eatenAt?: number,
): Promise<void> {
  const plan = planForDay(plans.value, day);
  if (!plan) return;
  markUx('log:tap');
  const now = Date.now();
  const row = buildLog({
    id: uid(),
    plan_id: plan.id,
    plan: plan.data,
    rules: plan.data.swaps,
    day,
    slot,
    // Preserve the full accepted description so another device can reconstruct the same job.
    title: text.trim().slice(0, 2000),
    items: [],
    source: 'describe',
    now,
    eaten_at: eatenAt ?? (day !== today.value ? plannedTime(slot, day) : undefined),
    target: targetFor(slot, day),
    slotLogs: liveLogs.value.filter((l) => l.day === day && l.slot === slot),
  });
  addOptimistic([row]);
  tick(1);
  await db.transaction('rw', [db.logs, db.pending, db.outbox], async () => {
    await db.logs.put(row);
    await db.pending.put({ id: row.id, text: row.title, slot, day, created_at: now });
    await db.outbox.add({ table: 'logs', id: row.id });
  });
  // Wake the sync loop without waiting for connectivity.
  schedule();
  showToast(pick('describe.offline'), () => void undoLog(row, undefined, undefined));
}

/** "Me late": keep a dish as the plan for one meal, so logging it later is one tap. Undoable. */
export async function planDish(
  slot: string,
  dish: { title: string; items: LogItem[]; recipe_id?: string | null },
  slotLabel: string,
  day = today.value,
): Promise<void> {
  const at = Date.now();
  const id = `${day}:${slot}`;
  const prev = menus.value.find((m) => m.id === id);
  const row: MenuRow = {
    id,
    day,
    slot,
    title: dish.title,
    items: dish.items,
    recipe_id: dish.recipe_id ?? null,
    accepted_at: at,
    updated_at: at,
    deleted_at: null,
    rev: prev?.rev ?? 0,
  };
  tick(1);
  await writeRow('menus', row);
  showToast(fill(nowCopy.liked, { slot: slotLabel.toLowerCase() }), () => {
    const undo = prev ?? { ...row, deleted_at: Date.now() };
    void writeRow('menus', { ...undo, updated_at: Date.now() });
  });
}

/** Drop the planned dish of a meal (the idea comes back). Undoable. */
export async function unplanDish(slot: string, day = today.value): Promise<void> {
  const prev = menus.value.find((m) => m.id === `${day}:${slot}` && !m.deleted_at);
  if (!prev) return;
  const at = Date.now();
  await writeRow('menus', { ...prev, deleted_at: at, updated_at: at });
  showToast(nowCopy.unliked, () => void writeRow('menus', { ...prev, updated_at: Date.now() }));
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await writeRow('settings', { key, value, updated_at: Date.now(), rev: 0 });
}
