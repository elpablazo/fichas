// Weight trend (docs/03-redesign.md §5). Daily weight is noisy (water, salt, timing), so the app shows a smoothed
// trend, a 28-day rate with its uncertainty and a cautious projection — never the last scale reading as "the" weight.
import { addDays, daysBetween } from './day';
import type { WeighinRow } from './types';

export interface WeightPoint {
  day: string;
  kg: number; // daily mean
  source: 'home' | 'nutritionist';
  rows: WeighinRow[];
}
export interface TrendPoint {
  day: string;
  kg: number;
}
export type WeightSignal = 'none' | 'few' | 'losing' | 'steady' | 'gaining' | 'unclear';

export interface WeightAnalysis {
  points: WeightPoint[];
  /** Smoothed value at every observed day. */
  trend: TrendPoint[];
  latest: WeightPoint | null;
  /** Smoothed value at the latest weigh-in. */
  current: number | null;
  /** kg per week over the rate window (negative = going down), with an 80 % interval. */
  rate: number | null;
  rateLow: number | null;
  rateHigh: number | null;
  /** Rate as a percentage of the current trend per week. */
  ratePct: number | null;
  /** Weekly points for the next four weeks, from the current trend. */
  projection: { day: string; kg: number; low: number; high: number }[];
  signal: WeightSignal;
  /** Going down faster than 1 % per week: worth mentioning to the nutritionist. */
  fast: boolean;
  /** Weigh-ins used for the rate and the days they span. */
  samples: number;
  span: number;
}

/** Local linear smoothing over ±14 days (tricube weights): removes day-to-day noise without the lag of a
 *  moving average, so while you lose weight the trend never sits above your recent weigh-ins. */
const BANDWIDTH = 14;
export const RATE_WINDOW = 28;
const MIN_SAMPLES = 4;
const MIN_SPAN = 10;

// Two-sided 80 % Student t quantiles by degrees of freedom.
const T80 = [0, 3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372];
function t80(df: number): number {
  if (df <= 10) return T80[Math.max(1, df)] ?? 3.078;
  if (df <= 15) return 1.341;
  if (df <= 20) return 1.325;
  if (df <= 30) return 1.31;
  return 1.282;
}

export function dailyPoints(rows: WeighinRow[]): WeightPoint[] {
  const byDay = new Map<string, WeighinRow[]>();
  for (const r of rows) if (!r.deleted_at) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, rs]) => ({
      day,
      kg: rs.reduce((s, r) => s + r.kg, 0) / rs.length,
      source: rs.some((r) => r.source === 'nutritionist') ? 'nutritionist' : 'home',
      rows: rs.sort((a, b) => b.created_at - a.created_at),
    }));
}

export function smooth(points: WeightPoint[]): TrendPoint[] {
  return points.map((p) => {
    let sw = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    let n = 0;
    for (const q of points) {
      const x = daysBetween(p.day, q.day);
      if (Math.abs(x) > BANDWIDTH) continue;
      const w = (1 - (Math.abs(x) / (BANDWIDTH + 1)) ** 3) ** 3;
      sw += w;
      sx += w * x;
      sy += w * q.kg;
      sxx += w * x * x;
      sxy += w * x * q.kg;
      n++;
    }
    const det = sw * sxx - sx * sx;
    // Fewer than 3 nearby weigh-ins: a weighted mean, never an extrapolated line.
    const kg = n >= 3 && det > 1e-9 ? (sy * sxx - sx * sxy) / det : sy / sw;
    return { day: p.day, kg };
  });
}

/** Smoothed value on a day (the latest weigh-in at or before it), or null before the first weigh-in. */
export function trendAt(trend: TrendPoint[], day: string): number | null {
  let v: number | null = null;
  for (const t of trend) {
    if (t.day > day) break;
    v = t.kg;
  }
  return v;
}

export function analyzeWeight(rows: WeighinRow[]): WeightAnalysis {
  const points = dailyPoints(rows);
  const trend = smooth(points);
  const latest = points.at(-1) ?? null;
  const current = trend.at(-1)?.kg ?? null;
  const empty: WeightAnalysis = {
    points,
    trend,
    latest,
    current,
    rate: null,
    rateLow: null,
    rateHigh: null,
    ratePct: null,
    projection: [],
    signal: points.length ? 'few' : 'none',
    fast: false,
    samples: 0,
    span: 0,
  };
  if (!latest || current === null) return empty;
  const from = addDays(latest.day, -(RATE_WINDOW - 1));
  const window = points.filter((p) => p.day >= from);
  const xs = window.map((p) => daysBetween(from, p.day));
  const span = (xs.at(-1) ?? 0) - (xs[0] ?? 0);
  const n = window.length;
  if (n < MIN_SAMPLES || span < MIN_SPAN) return { ...empty, samples: n, span };

  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = window.reduce((s, p) => s + p.kg, 0) / n;
  let sxx = 0;
  let sxy = 0;
  window.forEach((p, i) => {
    const dx = (xs[i] ?? 0) - mx;
    sxx += dx * dx;
    sxy += dx * (p.kg - my);
  });
  const slope = sxy / sxx; // kg per day
  let sse = 0;
  window.forEach((p, i) => {
    const fit = my + slope * ((xs[i] ?? 0) - mx);
    sse += (p.kg - fit) ** 2;
  });
  const se = Math.sqrt(sse / Math.max(1, n - 2) / sxx);
  const t = t80(n - 2);
  const rate = slope * 7;
  const rateLow = (slope - t * se) * 7;
  const rateHigh = (slope + t * se) * 7;
  const ratePct = (rate / current) * 100;

  const signal: WeightSignal =
    rateHigh < 0 && rate <= -0.1
      ? 'losing'
      : rateLow > 0 && rate >= 0.1
        ? 'gaining'
        : rateLow >= -0.3 && rateHigh <= 0.3
          ? 'steady'
          : 'unclear';

  const projection = [7, 14, 21, 28].map((d) => {
    const kg = current + slope * d;
    const half = t * se * d + 0.2;
    return { day: addDays(latest.day, d), kg, low: kg - half, high: kg + half };
  });
  return {
    ...empty,
    rate,
    rateLow,
    rateHigh,
    ratePct,
    projection,
    signal,
    fast: signal === 'losing' && ratePct <= -1,
    samples: n,
    span,
  };
}

/** Nice axis bounds and ticks for kilograms. */
export function weightAxis(values: number[]): { min: number; max: number; ticks: number[] } {
  if (!values.length) return { min: 0, max: 1, ticks: [] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = Math.max(1, hi - lo);
  const step = range <= 2 ? 0.5 : range <= 5 ? 1 : range <= 12 ? 2 : 5;
  const min = Math.floor((lo - step * 0.3) / step) * step;
  const max = Math.ceil((hi + step * 0.3) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  return { min, max, ticks };
}
