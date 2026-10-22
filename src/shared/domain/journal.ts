// The nutritionist's food journal (docs/05-fichas-2.md §9): what was eaten, when, and what wasn't — never fichas
// (counts can be wrong and mislead a professional). Pure: the Worker renders it, tests check it.
import { addDays, appMinutes, dayRange } from './day';
import { groupItems } from './dishes';
import { dayLabel, timeLabel } from './format';
import { baseTimes } from './slots';
import { isProvisional } from './status';
import type { LogRow, PlanRow } from './types';

export interface JournalItem {
  label: string;
  approx: boolean;
}
export interface JournalEntry {
  slot: string;
  /** "Desayuno", "Extra". */
  label: string;
  kind: 'meal' | 'skip' | 'missing';
  /** Real time for meals; plan time for skipped or missing ones ("11:40 am"). */
  time: string | null;
  /** The plan's time for this meal ("11 am"); null for extras. */
  planTime: string | null;
  /** Minutes after (+) or before (−) the plan; null when unknown. */
  offset: number | null;
  title: string;
  dishes: { name: string | null; items: JournalItem[] }[];
  /** App minutes, for ordering. */
  at: number;
}
export interface JournalDay {
  day: string;
  label: string;
  entries: JournalEntry[];
}
export interface SlotPattern {
  label: string;
  planTime: string;
  /** Average real time over the logged days, null without data. */
  avgTime: string | null;
  avgOffset: number | null;
  logged: number;
  skipped: number;
  missing: number;
}
export interface Journal {
  from: string;
  to: string;
  days: JournalDay[];
  /** Days with at least one meal written down. */
  daysLogged: number;
  patterns: SlotPattern[];
}

export interface JournalInput {
  logs: LogRow[];
  plans: PlanRow[];
  from: string;
  to: string;
  today: string;
  /** App minutes now (today's future meals are not "missing" yet). */
  nowMinutes: number;
  tz: string;
  dayStartHour: number;
}

function planFor(plans: PlanRow[], day: string): PlanRow | null {
  const ok = plans
    .filter((p) => (p.status === 'active' || p.status === 'archived') && p.starts_on && p.starts_on <= day)
    .filter((p) => !p.ends_on || p.ends_on >= day)
    .sort((a, b) => (b.starts_on ?? '').localeCompare(a.starts_on ?? ''));
  return ok[0] ?? null;
}

export function buildJournal(input: JournalInput): Journal {
  const { logs, plans, tz, dayStartHour } = input;
  const to = input.to > input.today ? input.today : input.to;
  const live = logs.filter((l) => !l.deleted_at && l.day >= input.from && l.day <= to);
  const days: JournalDay[] = [];
  const bySlot = new Map<
    string,
    { label: string; plan: number; offsets: number[]; times: number[]; skipped: number; missing: number }
  >();
  for (const day of input.from <= to ? dayRange(input.from, to) : []) {
    const plan = planFor(plans, day);
    const slots = plan?.data.slots ?? [];
    const planned = baseTimes(slots, dayStartHour);
    const dayLogs = live.filter((l) => l.day === day);
    const entries: JournalEntry[] = [];
    const entry = (l: LogRow, label: string, planAt: number | null): JournalEntry => {
      const at = appMinutes(l.eaten_at, tz, dayStartHour);
      // A meal written down later for a past day keeps the plan's time: its real time is unknown.
      const known = l.source !== 'backfill';
      return {
        slot: l.slot,
        label,
        kind: 'meal',
        time: known ? timeLabel(at, dayStartHour) : null,
        planTime: planAt === null ? null : timeLabel(planAt, dayStartHour),
        offset: known && planAt !== null ? Math.round(at - planAt) : null,
        title: isProvisional(l) ? l.title : l.title || l.items.map((i) => i.label).join(', '),
        dishes: groupItems(l.items).map((g) => ({
          name: g.name,
          items: g.items.map((i) => ({
            label: l.items[i]?.label ?? '',
            approx: !!(l.items[i]?.estimated || l.items[i]?.assumed_qty),
          })),
        })),
        at,
      };
    };
    slots.forEach((s, i) => {
      const planAt = planned[i] ?? 0;
      const here = dayLogs.filter((l) => l.slot === s.key);
      const meals = here.filter((l) => l.kind === 'meal');
      const stat = bySlot.get(s.label + i) ?? {
        label: s.label,
        plan: planAt,
        offsets: [],
        times: [],
        skipped: 0,
        missing: 0,
      };
      bySlot.set(s.label + i, stat);
      if (meals.length) {
        for (const l of meals) {
          const e = entry(l, s.label, planAt);
          entries.push(e);
          if (e.offset !== null) {
            stat.offsets.push(e.offset);
            stat.times.push(e.at);
          }
        }
      } else if (here.some((l) => l.kind === 'skip')) {
        stat.skipped++;
        entries.push({
          slot: s.key,
          label: s.label,
          kind: 'skip',
          time: null,
          planTime: timeLabel(planAt, dayStartHour),
          offset: null,
          title: '',
          dishes: [],
          at: planAt,
        });
      } else if (day < input.today || planAt + 90 <= input.nowMinutes) {
        stat.missing++;
        entries.push({
          slot: s.key,
          label: s.label,
          kind: 'missing',
          time: null,
          planTime: timeLabel(planAt, dayStartHour),
          offset: null,
          title: '',
          dishes: [],
          at: planAt,
        });
      }
    });
    for (const l of dayLogs.filter((x) => x.slot === 'extra' && x.kind === 'meal'))
      entries.push(entry(l, 'Extra', null));
    entries.sort((a, b) => a.at - b.at);
    days.push({ day, label: dayLabel(day), entries });
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return {
    from: input.from,
    to,
    days: days.reverse(),
    daysLogged: days.filter((d) => d.entries.some((e) => e.kind === 'meal')).length,
    patterns: [...bySlot.values()].map((s) => {
      const avg = mean(s.times);
      const off = mean(s.offsets);
      return {
        label: s.label,
        planTime: timeLabel(s.plan, dayStartHour),
        avgTime: avg === null ? null : timeLabel(Math.round(avg / 5) * 5, dayStartHour),
        avgOffset: off === null ? null : Math.round(off),
        logged: s.times.length,
        skipped: s.skipped,
        missing: s.missing,
      };
    }),
  };
}

/** The default range of a new link: the last n days up to today. */
export function lastDays(today: string, n: number): { from: string; to: string } {
  return { from: addDays(today, 1 - n), to: today };
}
