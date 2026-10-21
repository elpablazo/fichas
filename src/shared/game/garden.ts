import { hhmmToAppMinutes } from '../domain/day';
import { isOccasion, slotState } from '../domain/status';
import type { LogRow, PlanData, TypeKey } from '../domain/types';
import { sumUnits } from '../domain/units';
import { casaLlena, diaRedondo } from './momentum';
import { BLOOMED, plantStage, type Stage, speciesFor } from './species';

const PRIORITY: TypeKey[] = [
  'carb_sg',
  'protein_poa',
  'fruit',
  'veg',
  'dairy',
  'fat_sp',
  'carb_cg',
  'legume',
  'sugar_sg',
  'sugar_cg',
  'fat_cp',
];
export interface FlowerModel {
  day: string;
  future: boolean;
  today: boolean;
  gold: boolean;
  /** Logged eating occasions that day. */
  n: number;
  stage: Stage;
  /** Species id; revealed in the UI only once the plant blooms. */
  species: string;
  leaves: number;
  petals: { slot: string; state: 'open' | 'skip' | 'none'; type: TypeKey }[];
}

export interface FlowerOptions {
  /** Level the garden had when that day started (species pool). */
  level?: number;
  /** The day was closed with the day-close ritual (or is in the past). */
  closed?: boolean;
}

export function flowerModel(
  plan: PlanData,
  logs: LogRow[],
  day: string,
  today: string,
  opts: FlowerOptions = {},
): FlowerModel {
  const dayLogs = logs.filter((l) => l.day === day && !l.deleted_at);
  const future = day > today;
  const n = dayLogs.filter(isOccasion).length;
  const gold = !future && diaRedondo(plan, dayLogs, plan.swaps);
  const stage = plantStage({
    n,
    future,
    closed: opts.closed ?? day < today,
    casaLlena: !future && casaLlena(plan, dayLogs),
    redondo: gold,
  });
  return {
    day,
    future,
    today: day === today,
    gold,
    n,
    stage,
    species: speciesFor(day, opts.level ?? 1).id,
    leaves: Math.min(2, dayLogs.filter((l) => l.slot === 'extra' && l.kind === 'meal').length),
    petals: [...plan.slots]
      .sort((a, b) => hhmmToAppMinutes(a.time ?? '12:00') - hhmmToAppMinutes(b.time ?? '12:00'))
      .map((s) => {
        const ls = dayLogs.filter((l) => l.slot === s.key);
        const state = slotState(ls, ls.find((l) => l.kind === 'meal')?.target ?? s.target, plan.swaps);
        const units = sumUnits(ls.filter((l) => l.kind === 'meal').map((l) => l.raw_units));
        const type = [...PRIORITY].sort((a, b) => (units[b] ?? 0) - (units[a] ?? 0))[0] ?? 'veg';
        return { slot: s.key, state: state.kind === 'meal' ? 'open' : state.kind === 'skip' ? 'skip' : 'none', type };
      }),
  };
}

export function bloomed(m: Pick<FlowerModel, 'stage'>): boolean {
  return BLOOMED.includes(m.stage);
}
