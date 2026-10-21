// Derived garden state shared by Jardín and its sheets: one plant per logged day, species counts, discoveries.
import { computed } from '@preact/signals';
import type { LogRow } from '../shared/domain/types';
import { bloomed, type FlowerModel, flowerModel } from '../shared/game/garden';
import { gardenLogs } from './game';
import { levelBefore } from './state/selectors';
import { achievements, planForDay, plans, settings, today } from './state/signals';

/** Flower models for every day with records (any season). */
export const gardenDays = computed(() => {
  const byDay = new Map<string, LogRow[]>();
  for (const l of gardenLogs.value) if (!l.deleted_at) byDay.set(l.day, [...(byDay.get(l.day) ?? []), l]);
  const out = new Map<string, FlowerModel>();
  const closed = settings.value.last_closed_day;
  for (const [day, logs] of byDay) {
    const plan = planForDay(plans.value, day);
    if (!plan || day > today.value) continue;
    out.set(
      day,
      flowerModel(plan.data, logs, day, today.value, {
        level: levelBefore(day),
        closed: day < today.value || closed === day,
      }),
    );
  }
  return out;
});

/** How many days each species bloomed. */
export const speciesCounts = computed(() => {
  const m = new Map<string, number>();
  for (const f of gardenDays.value.values()) if (bloomed(f)) m.set(f.species, (m.get(f.species) ?? 0) + 1);
  return m;
});

/** Species found so far: persisted discoveries plus anything blooming now. Never shrinks. */
export const discovered = computed(() => {
  const ids = new Set(
    achievements.value.filter((a) => a.kind === 'unlock' && a.key.startsWith('species_')).map((a) => a.key.slice(8)),
  );
  for (const id of speciesCounts.value.keys()) ids.add(id);
  return ids;
});
