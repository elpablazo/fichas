import { daysBetween } from './day';
import { isOccasion, isProvisional, slotState } from './status';
import type { AchievementRow, LogRow, PlanRow, TypeKey, WeighinRow } from './types';
import { TYPE_KEYS } from './types';

/** Reports aggregate slot-days against the immutable target recorded in each log. */
export function seasonReport(
  plan: PlanRow,
  logs: LogRow[],
  weights: WeighinRow[],
  achievements: AchievementRow[],
  today: string,
) {
  const from = plan.starts_on ?? today;
  const to = plan.ends_on && plan.ends_on < today ? plan.ends_on : today;
  const meals = logs.filter(
    (l) => l.plan_id === plan.id && !l.deleted_at && l.day >= from && l.day <= to && isOccasion(l),
  );
  const days = new Map<string, number>();
  for (const l of meals) days.set(l.day, (days.get(l.day) ?? 0) + 1);
  const extras = new Map<string, { type: TypeKey; slot: string; occasions: number; units: number }>();
  const recordExtra = (type: TypeKey, slot: string, units: number) => {
    if (units < 0.5) return;
    const key = `${slot}:${type}`,
      prev = extras.get(key);
    extras.set(key, { type, slot, occasions: (prev?.occasions ?? 0) + 1, units: (prev?.units ?? 0) + units });
  };
  const slots = plan.data.slots.map((slot) => {
    const groups = new Map<string, LogRow[]>();
    for (const l of meals.filter((l) => l.slot === slot.key)) groups.set(l.day, [...(groups.get(l.day) ?? []), l]);
    let counted = 0,
      on = 0;
    for (const group of groups.values()) {
      if (group.some(isProvisional)) continue;
      const target = group[0]!.target;
      const state = slotState(group, target, plan.data.swaps);
      counted++;
      if (state.status === 'on') on++;
      for (const type of TYPE_KEYS) recordExtra(type, slot.key, (state.normalized[type] ?? 0) - (target[type] ?? 0));
    }
    return {
      key: slot.key,
      label: slot.label,
      counted,
      on,
      percentOn: counted ? Math.round((on / counted) * 100) : null,
    };
  });
  const extraDays = new Map<string, LogRow[]>();
  for (const l of meals.filter((l) => l.slot === 'extra' && !isProvisional(l)))
    extraDays.set(l.day, [...(extraDays.get(l.day) ?? []), l]);
  for (const group of extraDays.values())
    for (const type of TYPE_KEYS)
      recordExtra(
        type,
        'extra',
        group.reduce((sum, l) => sum + (l.units[type] ?? 0), 0),
      );
  return {
    season: plan.season ?? 1,
    from,
    to,
    totalDays: Math.max(0, daysBetween(from, to) + 1),
    flowers: days.size,
    fullDays: [...days.values()].filter((n) => n >= 2).length,
    meals: meals.length,
    pending: meals.filter(isProvisional).length,
    slots,
    extras: [...extras.values()].sort((a, b) => b.occasions - a.occasions || b.units - a.units),
    weights: weights
      .filter((w) => !w.deleted_at && w.day >= from && w.day <= to)
      .sort((a, b) => a.day.localeCompare(b.day) || a.created_at - b.created_at),
    stamps: achievements.filter((a) => a.kind === 'stamp' && a.season === plan.season).length,
  };
}
export type SeasonReport = ReturnType<typeof seasonReport>;
