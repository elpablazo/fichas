import { balanceDay } from '../domain/balance';
import { addDays, appDay, weekday } from '../domain/day';
import { computeStatus, isOccasion, overAmount } from '../domain/status';
import { type LogRow, type MenuRow, type PlanRow, type RecipeRow, TYPE_KEYS } from '../domain/types';
import { casaLlena, diaRedondo, occasionsOn } from './momentum';
import { isComeback } from './surprise';

export const STAMPS = [
  { key: 'primer_bocado', name: 'Primer bocado', emoji: '🥄', hidden: false },
  { key: 'casa_llena', name: 'Casa llena', emoji: '🏠', hidden: false },
  { key: 'dia_redondo', name: 'Día redondo', emoji: '⭐', hidden: false },
  { key: 'dia_cuadrado', name: 'Día cuadrado', emoji: '⚖️', hidden: false },
  { key: 'planeador', name: 'Planeador', emoji: '🗓️', hidden: false },
  { key: 'volviste', name: 'Volviste', emoji: '👋', hidden: false },
  { key: 'constancia', name: 'Constancia', emoji: '🌱', hidden: false },
  { key: 'chef', name: 'Chef', emoji: '🍳', hidden: false },
  { key: 'con_lo_que_hay', name: 'Con lo que hay', emoji: '🧺', hidden: false },
  { key: 'sin_filtro', name: 'Sin filtro', emoji: '🤝', hidden: true },
  { key: 'finde', name: 'Finde', emoji: '🎉', hidden: true },
  { key: 'martes_de_tacos', name: 'Martes de tacos', emoji: '🌮', hidden: true },
] as const;
export type StampKey = (typeof STAMPS)[number]['key'];

export function earnedStamps(
  plan: PlanRow,
  all: LogRow[],
  menus: MenuRow[],
  recipes: RecipeRow[],
  tz = 'America/Mexico_City',
  dayStart = 4,
): StampKey[] {
  const logs = all.filter((l) => l.plan_id === plan.id && !l.deleted_at);
  const meals = logs.filter(isOccasion);
  const days = [...new Set(meals.map((l) => l.day))];
  const inSeason = (day: string) => !!plan.starts_on && day >= plan.starts_on && (!plan.ends_on || day <= plan.ends_on);
  const tests: Record<StampKey, boolean> = {
    primer_bocado: meals.length > 0,
    casa_llena: days.some((d) =>
      casaLlena(
        plan.data,
        logs.filter((l) => l.day === d),
      ),
    ),
    dia_redondo: days.some((d) =>
      diaRedondo(
        plan.data,
        logs.filter((l) => l.day === d),
        plan.data.swaps,
      ),
    ),
    dia_cuadrado: days.some((d) =>
      cuadrado(
        plan,
        logs.filter((l) => l.day === d),
      ),
    ),
    planeador:
      new Set(menus.filter((m) => !m.deleted_at && m.accepted_at && inSeason(m.day)).map((m) => m.day)).size >= 3,
    volviste: meals.some((l) => isComeback(l, all)),
    constancia: days.filter((d) => occasionsOn(meals, d) >= 2).length >= 10,
    chef:
      new Set(
        recipes
          .filter(
            (r) =>
              !r.deleted_at &&
              r.origin === 'log' &&
              inSeason(appDay(r.created_at, tz, dayStart)) &&
              meals.some((l) => l.recipe_id === r.id),
          )
          .map((r) => r.id),
      ).size >= 3,
    con_lo_que_hay: meals.some((l) => l.source === 'pantry'),
    sin_filtro: meals.some(
      (l) => l.slot !== 'extra' && overAmount(computeStatus(l.raw_units, l.target, plan.data.swaps).deltas) >= 2,
    ),
    finde: days.some((d) => weekday(d) === 6 && occasionsOn(meals, d) >= 2 && occasionsOn(meals, addDays(d, 1)) >= 2),
    martes_de_tacos: meals.some((l) => weekday(l.day) === 2 && /taco/i.test(l.title)),
  };
  return STAMPS.filter((s) => tests[s.key]).map((s) => s.key);
}

/** Every planned meal logged, at least one over its target, and the day still ends within the plan's totals. */
export function cuadrado(plan: PlanRow, dayLogs: LogRow[]): boolean {
  const data = plan.data;
  if (!casaLlena(data, dayLogs)) return false;
  const anyOver = data.slots.some((s) => {
    const meals = dayLogs.filter((l) => l.slot === s.key && l.kind === 'meal' && !l.deleted_at);
    const eaten = meals.reduce<Record<string, number>>((acc, l) => {
      for (const [k, v] of Object.entries(l.raw_units)) acc[k] = (acc[k] ?? 0) + (v ?? 0);
      return acc;
    }, {});
    return computeStatus(eaten, s.target, data.swaps).status === 'over';
  });
  if (!anyOver) return false;
  const { net } = balanceDay(data, dayLogs, data.swaps, true);
  return TYPE_KEYS.every((t) => (net[t] ?? 0) < 0.5);
}
