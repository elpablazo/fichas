// Day view model: everything the Hoy screen shows for any day, as plain serializable data.
// Today's object is cached in localStorage for the snapshot-first render (§12).

import { balanceDay } from '../../shared/domain/balance';
import { appMinutes, daysBetween } from '../../shared/domain/day';
import { amountOf, dayStatus, type Meter, type Pace, type PaceGap } from '../../shared/domain/daystatus';
import { changedIndexes } from '../../shared/domain/fit';
import { dayLong, fill, relativeDay, timeLabel } from '../../shared/domain/format';
import { remainingTarget } from '../../shared/domain/log';
import { equivalentUsage, preferredEquivalent } from '../../shared/domain/recipes';
import { currentSlot, learnedTimes, slotTimings } from '../../shared/domain/slots';
import { computeStatus, isProvisional, type SlotState, slotState } from '../../shared/domain/status';
import { suggest } from '../../shared/domain/suggest';
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

/** How a logged meal compares with its target, in whole facts ("+1 🫓", "−1 🍗"). */
export interface VerdictVM {
  status: 'on' | 'over' | 'under' | 'mixed';
  over: PaceGap[];
  under: PaceGap[];
}

export interface SlotVM {
  key: string;
  label: string;
  time: string;
  state: 'done' | 'skipped' | 'pending' | 'upcoming' | 'current';
  target: Units;
  /** Title of what was logged, or of the day's planned dish. */
  dish: string | null;
  verdict: VerdictVM | null;
  /** Logged while offline; portions still to be counted. */
  provisional: boolean;
  /** Cuadrar el día trims this open meal. */
  adjusted: boolean;
}

/** The one meal that matters right now: decide what to eat (plan) or write down what was eaten (log). */
export interface NowVM {
  key: string;
  label: string;
  time: string;
  phase: 'plan' | 'log';
  /** A dish the owner chose for this meal ("Me late" or tomorrow's menu). */
  planned: SuggestionVM | null;
  /** Plan phase: a real dish that fits (the owner's, the nutritionist's), cycled with "Otra idea". */
  idea: SuggestionVM | null;
  index: number;
  count: number;
  celebrating: boolean;
}

export interface AdviceVM {
  slot: string;
  label: string;
  type: TypeKey;
  n: number;
  /** The same amount as food: "1 tortilla". */
  food: string;
}

export interface StatusVM {
  meters: Meter[];
  pace: Pace;
  ahead: PaceGap[];
  behind: PaceGap[];
  advice: AdviceVM[];
  done: number;
  total: number;
}

export interface DayVM {
  v: 4;
  tz: string;
  dayStartHour: number;
  day: string;
  today: string;
  mode: 'today' | 'past' | 'future';
  title: string;
  subtitle: string;
  seasonLabel: string | null;
  plant: { stage: Stage; species: string; n: number };
  status: StatusVM;
  now: NowVM | null;
  /** Every planned meal in order (the now meal included). */
  rows: SlotVM[];
  extras: { n: number; titles: string[] } | null;
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

/** Suggestions for a slot of the shown day (shared by the now card and tomorrow's menu). */
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

function gaps(deltas: Partial<Record<TypeKey, number>>, sign: 1 | -1): PaceGap[] {
  return TYPE_KEYS.map((t) => ({ type: t, n: (deltas[t] ?? 0) * sign }))
    .filter((g) => g.n >= 0.5 - 1e-6)
    .sort((a, b) => b.n - a.n);
}

const EMPTY_STATUS: StatusVM = { meters: [], pace: 'start', ahead: [], behind: [], advice: [], done: 0, total: 0 };

export function buildDayVM(input: DayInput): DayVM {
  const { plan, day, today } = input;
  const mode: DayVM['mode'] = day === today ? 'today' : day < today ? 'past' : 'future';
  const base: DayVM = {
    v: 4,
    tz: input.tz,
    dayStartHour: input.dayStartHour,
    day,
    today,
    mode,
    title: relativeDay(day, today),
    subtitle: dayLong(day),
    seasonLabel: null,
    plant: { stage: mode === 'future' ? 'soil' : 'seed', species: '', n: 0 },
    status: EMPTY_STATUS,
    now: null,
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

  const status = dayStatus(data, dayLogs, input.balance && mode !== 'future');
  const balance = status.balance;
  const usage = equivalentUsage(input.logs);
  base.status = {
    meters: status.meters,
    pace: status.pace,
    ahead: status.ahead,
    behind: status.behind,
    advice: status.advice.map((a) => {
      const e = preferredEquivalent(data, usage, a.slot)(a.type);
      return {
        ...a,
        label: data.slots.find((s) => s.key === a.slot)?.label ?? '',
        food: e ? amountOf(e, a.n) : '',
      };
    }),
    done: status.done,
    total: status.total,
  };

  const states: SlotState[] = data.slots.map((s) => {
    const slotLogs = dayLogs.filter((l) => l.slot === s.key);
    const snap = slotLogs.find((l) => l.kind === 'meal' || l.kind === 'skip')?.target;
    return slotState(slotLogs, snap && Object.keys(snap).length ? snap : s.target, rules);
  });
  const resolved = states.map((s) => s.resolved);
  const timings = slotTimings(
    data.slots,
    learnedTimes(input.logs, data.slots, today, input.tz, input.dayStartHour),
    input.dayStartHour,
  );
  const nowMin = appMinutes(input.now, input.tz, input.dayStartHour);
  let current: number | null = null;
  let pending: number[] = [];
  if (mode === 'today') {
    const cur = currentSlot(timings, resolved, nowMin);
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
  const nowIndex = mode !== 'today' ? -1 : celebrating >= 0 ? celebrating : current;
  const menuFor = (key: string) =>
    input.menus.find((m) => m.day === day && m.slot === key && m.accepted_at && !m.deleted_at);

  data.slots.forEach((s, i) => {
    const st = states[i] as SlotState;
    const snapTarget = st.logs.find((l) => l.kind === 'meal' || l.kind === 'skip')?.target;
    const target =
      st.resolved && snapTarget && Object.keys(snapTarget).length ? snapTarget : (balance.targets[i] ?? s.target);
    const meals = st.logs.filter((l) => l.kind === 'meal');
    const provisional = meals.length > 0 && meals.every((l) => isProvisional(l));
    let verdict: VerdictVM | null = null;
    if (st.kind === 'meal' && !provisional) {
      const r = computeStatus(st.eaten, target, rules);
      verdict = { status: r.status, over: gaps(r.deltas, 1), under: gaps(r.deltas, -1) };
    }
    const menu = menuFor(s.key);
    base.rows.push({
      key: s.key,
      label: s.label,
      time: timeLabel(timings[i]?.time ?? 0, input.dayStartHour),
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
      target,
      dish: meals.length ? meals.map((l) => l.title).join(' + ') : (menu?.title ?? null),
      verdict,
      provisional,
      adjusted: !st.resolved && balance.adjustments.some((a) => a.slot === s.key),
    });
    if (i !== nowIndex) return;
    const isCelebrating = i === celebrating;
    const phase: NowVM['phase'] = nowMin < (timings[i]?.time ?? 0) ? 'plan' : 'log';
    let idea: SuggestionVM | null = null;
    let count = 0;
    let index = 0;
    if (!isCelebrating && phase === 'plan' && !menu) {
      const list = suggestionsFor(input, s.key, target).filter((x) => x.origin !== 'menu');
      count = list.length;
      index = count ? (input.otherIndex[s.key] ?? 0) % count : 0;
      const chosen = list[index];
      idea = chosen ? suggestionVM(chosen) : null;
    }
    base.now = {
      key: s.key,
      label: s.label,
      time: timeLabel(timings[i]?.time ?? 0, input.dayStartHour),
      phase,
      planned:
        menu && !isCelebrating
          ? suggestionVM({
              title: menu.title,
              items: menu.items,
              recipe_id: menu.recipe_id ?? undefined,
              origin: 'menu',
              changes: [],
              tag: 'menu',
            })
          : null,
      idea,
      index,
      count,
      celebrating: isCelebrating,
    };
  });

  const extras = dayLogs.filter((l) => l.slot === 'extra' && l.kind === 'meal');
  if (extras.length) base.extras = { n: extras.length, titles: extras.map((l) => l.title) };
  base.allDone = mode === 'today' && current === null && celebrating < 0;
  return base;
}
