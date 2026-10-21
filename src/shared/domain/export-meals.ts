// Plain-text list of what was eaten (dishes and portions, no exchange units) for a date range. Pure.
import { exportCopy } from '../../client/copy/more';
import { appMinutes } from './day';
import { dayLabel, fill, shortDate, timeLabel } from './format';
import type { LogItem, LogRow, PlanRow } from './types';

export interface ExportInput {
  logs: LogRow[];
  plans: PlanRow[];
  from: string;
  to: string;
  tz: string;
  dayStartHour: number;
}

export interface MealsExport {
  text: string;
  days: number;
  meals: number;
}

const itemText = (i: LogItem) => (i.estimated ? `${i.label} ${exportCopy.approx}` : i.label);

export function exportMeals({ logs, plans, from, to, tz, dayStartHour }: ExportInput): MealsExport {
  const slotLabel = (l: LogRow): string => {
    if (l.slot === 'extra') return exportCopy.extra;
    const plan = plans.find((p) => p.id === l.plan_id);
    return plan?.data.slots.find((s) => s.key === l.slot)?.label ?? exportCopy.extra;
  };

  const byDay = new Map<string, LogRow[]>();
  for (const l of logs) {
    if (l.deleted_at || l.day < from || l.day > to) continue;
    byDay.set(l.day, [...(byDay.get(l.day) ?? []), l]);
  }

  const blocks: string[] = [];
  let meals = 0;
  for (const day of [...byDay.keys()].sort()) {
    const lines: string[] = [];
    for (const l of (byDay.get(day) ?? []).sort((a, b) => a.eaten_at - b.eaten_at)) {
      const label = slotLabel(l);
      if (l.kind === 'skip') {
        lines.push(`• ${label}: ${exportCopy.skipped}`);
        continue;
      }
      meals++;
      const time = timeLabel(appMinutes(l.eaten_at, tz, dayStartHour), dayStartHour);
      const items = l.items.map(itemText).join(', ');
      const title = l.title.trim();
      const dish = title || items;
      const detail = title && items ? ` — ${items}` : '';
      lines.push(`• ${label} (${time}): ${dish}${detail}`);
    }
    if (lines.length) blocks.push(`${dayLabel(day)}\n${lines.join('\n')}`);
  }

  const range = from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
  const head = fill(exportCopy.head, { range });
  return {
    text: blocks.length ? `${head}\n\n${blocks.join('\n\n')}` : head,
    days: blocks.length,
    meals,
  };
}
