// Display formatting for items, times and dates (labels come from the copy file).
import { dates, unitLabels } from '../../client/copy/es-MX';
import { addDays, appMinutesToHhmm, weekday } from './day';
import { pluralize } from './text';
import type { Equivalent, LogItem } from './types';
import { formatQty } from './units';

/** Shorter everyday names for display ("verdura cocida" → "verdura"). Matching uses the full name + aliases. */
const SHORT_NAMES: Record<string, string> = {
  'tortilla de maíz': 'tortilla',
  'verdura cocida': 'verdura',
  'aceite vegetal': 'aceite',
  'leche de vaca descremada': 'leche',
  'mango ataúlfo': 'mango',
  'yogurt descremado': 'yogurt',
  'bollo de hamburguesa': 'pan de hamburguesa',
  'arroz cocido': 'arroz',
  'jitomate saladet': 'jitomate',
};

const WORD_UNITS = new Set(['lata', 'paquete', 'barra', 'disparo', 'mitad']);

export function shortName(food: string): string {
  return SHORT_NAMES[food] ?? food;
}

export function unitText(unit: string, qty: number): string {
  const l = unitLabels[unit];
  if (!l) return unit;
  return qty > 1.01 ? l[1] : l[0];
}

/** "120 g pollo", "3 huevos", "⅓ aguacate", "½ tz verdura". */
export function itemLabel(food: string, qty: number, unit: string, short = true): string {
  const name = short ? shortName(food) : food;
  const u = unitText(unit, qty);
  const q = formatQty(qty);
  const plural = qty > 1.01;
  if (!u || name.startsWith(`${unitText(unit, 1)} `)) return `${q} ${plural ? pluralize(name) : name}`;
  if (WORD_UNITS.has(unit)) return `${q} ${u} de ${name}`;
  return `${q} ${u} ${name}`;
}

export function labelFor(e: Equivalent, qty: number): string {
  return itemLabel(e.food, qty, e.unit);
}

/** Replace the leading quantity of a free-text label ("2 tacos de pastor" → "3 tacos de pastor"). */
export function relabel(item: LogItem, qty: number): string {
  const m = item.label.match(/^\s*[\d½¼¾⅓⅔.,/]+\s*(.*)$/);
  const rest = m ? m[1] : item.label;
  return `${formatQty(qty)} ${rest}`.trim();
}

/** "5 pm", "11 am", "1:30 pm" from app minutes. */
export function timeLabel(appMin: number, dayStartHour = 4): string {
  const hhmm = appMinutesToHhmm(appMin, dayStartHour);
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const suffix = h >= 12 ? dates.pm : dates.am;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** "Jue 15 oct". */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${dates.weekdays[weekday(day)]} ${d} ${dates.months[m - 1]}`;
}

/** "viernes 9 de octubre". */
export function dayLong(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return fill(dates.long, {
    weekday: dates.weekdaysLong[weekday(day)] ?? '',
    d,
    month: dates.monthsLong[m - 1] ?? '',
  });
}

/** "Hoy", "Ayer", "Mañana", else "Jue 8 oct". */
export function relativeDay(day: string, today: string): string {
  if (day === today) return dates.today;
  if (day === addDays(today, -1)) return dates.yesterday;
  if (day === addDays(today, 1)) return dates.tomorrow;
  return dayLabel(day);
}

/** "15 oct". */
export function shortDate(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${d} ${dates.months[m - 1]}`;
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}
