// Momentum (§14.6): week dots, Casa llena, Día redondo. Nothing here ever decreases or shames.
import { addDays } from '../domain/day';
import { isOccasion, slotState } from '../domain/status';
import type { LogRow, PlanData, SwapRule } from '../domain/types';

export type DotState = 'full' | 'half' | 'empty';

export function occasionsOn(logs: LogRow[], day: string): number {
  return logs.filter((l) => l.day === day && isOccasion(l)).length;
}

export function dotState(n: number): DotState {
  return n >= 2 ? 'full' : n === 1 ? 'half' : 'empty';
}

/** Last 7 app days, oldest first, today last. */
export function weekDots(logs: LogRow[], today: string): { day: string; n: number; state: DotState; today: boolean }[] {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const n = occasionsOn(logs, day);
    out.push({ day, n, state: dotState(n), today: i === 0 });
  }
  return out;
}

export function fullDots(dots: { state: DotState }[]): number {
  return dots.filter((d) => d.state === 'full').length;
}

/** Every planned slot has ≥ 1 meal log. */
export function casaLlena(plan: PlanData, dayLogs: LogRow[]): boolean {
  return plan.slots.every((s) => dayLogs.some((l) => l.slot === s.key && l.kind === 'meal' && !l.deleted_at));
}

/** Every planned slot's status is `on` (against each slot's logged target snapshot). */
export function diaRedondo(plan: PlanData, dayLogs: LogRow[], rules: SwapRule[]): boolean {
  return plan.slots.every((s) => {
    const logs = dayLogs.filter((l) => l.slot === s.key && !l.deleted_at);
    const target = logs.find((l) => l.kind === 'meal')?.target ?? s.target;
    return slotState(logs, target, rules).status === 'on';
  });
}
