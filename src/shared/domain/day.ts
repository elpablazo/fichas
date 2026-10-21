// App day and local time helpers (§3.6). An app day starts at 04:00 local time.

export const DEFAULT_TZ = 'America/Mexico_City';
export const DAY_MS = 86_400_000;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface LocalParts {
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
}

export function localParts(ms: number, tz = DEFAULT_TZ): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

export function appDay(ms: number, tz = DEFAULT_TZ, dayStartHour = 4): string {
  return localParts(ms - dayStartHour * 3_600_000, tz).date;
}

/** Minutes since the app-day start (04:00 local), 0..1439. */
export function appMinutes(ms: number, tz = DEFAULT_TZ, dayStartHour = 4): number {
  const { hour, minute } = localParts(ms, tz);
  return ((((hour - dayStartHour) * 60 + minute) % 1440) + 1440) % 1440;
}

/** "HH:MM" → app minutes. */
export function hhmmToAppMinutes(hhmm: string, dayStartHour = 4): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (((((h ?? 0) - dayStartHour) * 60 + (m ?? 0)) % 1440) + 1440) % 1440;
}

/** App minutes → "HH:MM". */
export function appMinutesToHhmm(min: number, dayStartHour = 4): string {
  const total = (Math.round(min) + dayStartHour * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseDay(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** b − a in days. */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = parseDay(a);
  const [y2, m2, d2] = parseDay(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  const [y, m, d] = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The instant of a local wall-clock time ("HH:MM" on a calendar day) in a timezone. */
export function zonedTime(day: string, hhmm: string, tz = DEFAULT_TZ): number {
  const [y, m, d] = parseDay(day);
  const [h, min] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h ?? 12, min ?? 0);
  const p = localParts(guess, tz);
  const [py, pm, pd] = parseDay(p.date);
  const wall = Date.UTC(py, pm - 1, pd, p.hour, p.minute);
  return guess - (wall - guess);
}
