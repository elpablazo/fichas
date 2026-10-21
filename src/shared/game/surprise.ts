import { addDays } from '../domain/day';
import { isOccasion } from '../domain/status';
import type { LogRow } from '../domain/types';

/** Stable across devices and replays; independent of quantities and meal status. */
export function randomFor(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function surpriseLogs(logs: LogRow[], earnedIds: Set<string> = new Set()): LogRow[] {
  const meals = logs.filter(isOccasion).sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id));
  const days = new Set<string>();
  let last = -Infinity;
  const out: LogRow[] = [];
  meals.forEach((l, i) => {
    if (earnedIds.has(l.id)) {
      last = i;
      days.add(l.day);
    } else if (i > 0 && i - last >= 3 && !days.has(l.day) && randomFor(l.id) < 0.12) {
      out.push(l);
      last = i;
      days.add(l.day);
    }
  });
  return out;
}

export function isComeback(log: LogRow, logs: LogRow[]): boolean {
  if (!isOccasion(log)) return false;
  const before = logs.filter((l) => isOccasion(l) && l.day < log.day);
  return before.length > 0 && !before.some((l) => l.day === addDays(log.day, -1));
}

export function calendarPetal(day: string): 'cempasuchil' | 'nochebuena' | null {
  const md = day.slice(5);
  if (md >= '10-28' && md <= '11-02') return 'cempasuchil';
  if (md >= '12-12' || md <= '01-06') return 'nochebuena';
  return null;
}

export function calendarKey(day: string): string | null {
  const petal = calendarPetal(day);
  if (!petal) return null;
  const year = Number(day.slice(0, 4)) - (day.slice(5) <= '01-06' ? 1 : 0);
  return `calendar_${petal}_${year}`;
}
