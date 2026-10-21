// Day view model: everything the Hoy screen shows for any day, as plain serializable data.
// Today's object is cached in localStorage for the snapshot-first render (§12).

import { balanceDay } from '../../shared/domain/balance';
import { appMinutes, daysBetween } from '../../shared/domain/day';
import { changedIndexes } from '../../shared/domain/fit';
import { dayLong, fill, relativeDay, timeLabel } from '../../shared/domain/format';
import { remainingTarget } from '../../shared/domain/log';
import { equivalentUsage, preferredEquivalent } from '../../shared/domain/recipes';
import { currentSlot, learnedTimes, slotTimings } from '../../shared/domain/slots';
import { type SlotState, slotState } from '../../shared/domain/status';
import { suggest } from '../../shared/domain/suggest';
import { type TokenModel, tokensFor } from '../../shared/domain/tokens';
import type {
  LogItem,
  LogRow,
  MenuRow,
  PantryRow,
  PlanRow,
  RecipeRow,
  Suggestion,
  TypeKey,
  Units,
} from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { sumUnits } from '../../shared/domain/units';
import { flowerModel } from '../../shared/game/garden';
import type { Stage } from '../../shared/game/species';
import { labels } from '../copy/es-MX';

export interface SuggestionVM {
  title: string;
  line: string;
  tag: Suggestion['tag'] | null;
  items: LogItem[];
  recipe_id: string | null;
  origin: Suggestion['origin'];
  changed: number[];
}

export interface SlotVM {
  key: string;
  label: string;
  time: string;
  tokens: TokenModel[];
  state: 'done' | 'skipped' | 'pending' | 'upcoming' | 'current';
  status: string | null;
  adjusted: boolean;
  target: Units;
  /** Title of what was logged, or of tomorrow's planned dish. */
  dish: string | null;
}

export interface CardVM extends SlotVM {
  suggestion: SuggestionVM | null;
  index: number;
  count: number;
  celebrating: boolean;
}

export interface GaugeVM {
  type: TypeKey;
  eaten: number;
  planned: number;
}

export interface DayVM {
  v: 3;
  tz: string;
  dayStartHour: number;
  day: string;
  today: string;
  mode: 'today' | 'past' | 'future';
  title: string;
  subtitle: string;
  seasonLabel: string | null;
  plant: { stage: Stage; species: string; n: number };
  progress: { done: number; total: number };
  gauges: GaugeVM[];
  changes: { slot: string; label: string; type: TypeKey; n: number }[];
  card: CardVM | null;
  rows: SlotVM[];
  extras: { tokens: TokenModel[]; n: number; titles: string[] } | null;
  allDone: boolean;
  planId: string | null;
}
/** Kept for the snapshot reader and older imports. */
export type TodayVM = DayVM;

export interface DayInput {
  now: number;
  tz: string;
  dayStartHour: number;
  /** The app day right now. */
  today: string;
  /** The day being shown. */
  day: string;
  plan: PlanRow | null;
  logs: LogRow[]; // recent, non-deleted
  recipes: RecipeRow[];
  menus: MenuRow[];
  pantry: PantryRow[];
  balance: boolean;
  otherIndex: Record<string, number>;
  celebrate: { slotKey: string; until: number } | null;
  focusedSlot?: string | null;
  /** Garden level when the day started (species pool). */
  level: number;
  closed: boolean;
}
export type TodayInput = DayInput;

export function suggestionVM(s: Suggestion): SuggestionVM {
  return {
    title: s.title,
    line: s.items
      .filter((i) => !i.free)
      .map((i) => i.label)
      .join(' · '),
    tag: s.tag ?? null,
    items: s.items,
    recipe_id: s.recipe_id ?? null,
    origin: s.origin,
    changed: [...changedIndexes({ items: s.items, changes: s.changes })],
  };
}

/** Effective (balanced) targets of a day's planned slots. */
export function dayTargets(input: Pick<DayInput, 'plan' | 'logs' | 'day' | 'balance'>): Units[] {
  const plan = input.plan;
  if (!plan) return [];
  return balanceDay(
    plan.data,
    input.logs.filter((l) => l.day === input.day),
    plan.data.swaps,
    input.balance,
  ).targets;
}

/** Suggestions for a slot of the shown day (shared by the card, quick rows and backfill). */
export function suggestionsFor(input: DayInput, slotKey: string, target: Units): Suggestion[] {
  const plan = input.plan;
  if (!plan) return [];
  const dayLogs = input.logs.filter((l) => l.day === input.day && l.slot === slotKey);
  const rules = plan.data.swaps;
  return suggest({
    plan: plan.data,
    rules,
    slotKey,
    day: input.day,
    now: input.now,
    remaining: remainingTarget(target, dayLogs, rules),
    recipes: input.recipes,
    menus: input.menus,
    logs: input.logs,
    pantry: input.pantry,
    preferred: preferredEquivalent(plan.data, equivalentUsage(input.logs), slotKey),
  });
}

export function buildDayVM(input: DayInput): DayVM {
  const { plan, day, today } = input;
  const mode: DayVM['mode'] = day === today ? 'today' : day < today ? 'past' : 'future';
  const base: DayVM = {
    v: 3,
    tz: input.tz,
    dayStartHour: input.dayStartHour,
    day,
    today,
    mode,
    title: relativeDay(day, today),
    subtitle: dayLong(day),
    seasonLabel: null,
    plant: { stage: mode === 'future' ? 'soil' : 'seed', species: '', n: 0 },
    progress: { done: 0, total: 0 },
    gauges: [],
    changes: [],
    card: null,
    rows: [],
    extras: null,
    allDone: false,
    planId: plan?.id ?? null,
  };
  if (!plan) return base;
  const data = plan.data;
  const rules = data.swaps;
  if (plan.season && plan.starts_on) {
    base.seasonLabel = fill(labels.season, { n: plan.season, d: daysBetween(plan.starts_on, day) + 1 });
  }
  const dayLogs = input.logs.filter((l) => l.day === day);
  const flower = flowerModel(data, input.logs, day, today, { level: input.level, closed: input.closed });
  base.plant = { stage: flower.stage, species: flower.species, n: flower.n };

  const balance = balanceDay(data, dayLogs, rules, input.balance && mode !== 'future');
  for (const t of TYPE_KEYS) {
    const planned = balance.planned[t] ?? 0;
    const eaten = balance.eaten[t] ?? 0;
    if (planned > 1e-6 || eaten > 1e-6) base.gauges.push({ type: t, eaten, planned });
  }
  base.changes = balance.adjustments.map((a) => ({
    slot: a.slot,
    label: data.slots.find((s) => s.key === a.slot)?.label ?? '',
    type: a.type,
    n: a.from - a.to,
  }));

  const states: SlotState[] = data.slots.map((s) => {
    const slotLogs = dayLogs.filter((l) => l.slot === s.key);
    const snap = slotLogs.find((l) => l.kind === 'meal' || l.kind === 'skip')?.target;
    return slotState(slotLogs, snap && Object.keys(snap).length ? snap : s.target, rules);
  });
  const resolved = states.map((s) => s.resolved);
  base.progress = { done: resolved.filter(Boolean).length, total: data.slots.length };
  const timings = slotTimings(
    data.slots,
    learnedTimes(input.logs, data.slots, today, input.tz, input.dayStartHour),
    input.dayStartHour,
  );
  let current: number | null = null;
  let pending: number[] = [];
  if (mode === 'today') {
    const cur = currentSlot(timings, resolved, appMinutes(input.now, input.tz, input.dayStartHour));
    current = cur.current;
    pending = cur.pending;
    const focus = data.slots.findIndex((s, i) => s.key === input.focusedSlot && !resolved[i]);
    if (focus >= 0) current = focus;
  } else if (mode === 'past') {
    pending = data.slots.map((_, i) => i).filter((i) => !resolved[i]);
  }
  const celebrating =
    mode === 'today' && input.celebrate && input.celebrate.until > input.now
      ? data.slots.findIndex((s) => s.key === input.celebrate?.slotKey)
      : -1;
  const cardIndex = mode !== 'today' ? -1 : celebrating >= 0 ? celebrating : current;

  data.slots.forEach((s, i) => {
    const st = states[i] as SlotState;
    const snapTarget = st.logs.find((l) => l.kind === 'meal' || l.kind === 'skip')?.target;
    const target =
      st.resolved && snapTarget && Object.keys(snapTarget).length ? snapTarget : (balance.targets[i] ?? s.target);
    const meals = st.logs.filter((l) => l.kind === 'meal');
    const menu =
      mode === 'future'
        ? input.menus.find((m) => m.day === day && m.slot === s.key && m.accepted_at && !m.deleted_at)
        : undefined;
    const vm: SlotVM = {
      key: s.key,
      label: s.label,
      time: timeLabel(timings[i]?.time ?? 0, input.dayStartHour),
      tokens: tokensFor(target, st.kind === 'meal' ? st.normalized : {}),
      state:
        st.kind === 'skip'
          ? 'skipped'
          : st.resolved
            ? 'done'
            : pending.includes(i)
              ? 'pending'
              : i === current
                ? 'current'
                : 'upcoming',
      status: st.status,
      adjusted: !st.resolved && balance.adjustments.some((a) => a.slot === s.key),
      target,
      dish: meals.length ? meals.map((l) => l.title).join(' + ') : (menu?.title ?? null),
    };
    if (i === cardIndex) {
      const isCelebrating = i === celebrating;
      let suggestion: SuggestionVM | null = null;
      let count = 0;
      let index = 0;
      if (!isCelebrating) {
        const list = suggestionsFor(input, s.key, target);
        count = list.length;
        index = count ? (input.otherIndex[s.key] ?? 0) % count : 0;
        const chosen = list[index];
        suggestion = chosen ? suggestionVM(chosen) : null;
      }
      base.card = {
        ...vm,
        state: isCelebrating ? 'done' : 'current',
        suggestion,
        index,
        count,
        celebrating: isCelebrating,
      };
    } else base.rows.push(vm);
  });

  const extras = dayLogs.filter((l) => l.slot === 'extra' && l.kind === 'meal');
  if (extras.length) {
    const eaten = sumUnits(extras.map((l) => l.raw_units));
    base.extras = { tokens: tokensFor({}, eaten), n: extras.length, titles: extras.map((l) => l.title) };
  }
  base.allDone = mode === 'today' && current === null && celebrating < 0;
  return base;
}

/** @deprecated name kept for older call sites. */
export const buildTodayVM = buildDayVM;
