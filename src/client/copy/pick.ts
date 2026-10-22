// Copy picker: random variant from a pool, never one of the last 3 used for that key (§14.5).
import { fill } from '../../shared/domain/format';
import { type PoolKey, pools } from './es-MX';
import type { LogPoolKey, logPools } from './log';

const KEY = 'copy:recent';
let recent: Record<string, number[]> = {};
try {
  recent = JSON.parse(localStorage.getItem(KEY) ?? '{}');
} catch {
  recent = {};
}

export function pick(
  key: PoolKey,
  vars: Record<string, string | number> = {},
  rand: () => number = Math.random,
): string {
  return pickFrom(pools, key, vars, rand);
}

/** The same picker over any set of pools (lazy screens bring their own). */
export function pickFrom<K extends string>(
  set: Record<K, readonly string[]>,
  key: K,
  vars: Record<string, string | number> = {},
  rand: () => number = Math.random,
): string {
  const list = set[key];
  const last = recent[key] ?? [];
  const fresh = list.map((_, i) => i).filter((i) => !last.includes(i));
  const choices = fresh.length ? fresh : list.map((_, i) => i).filter((i) => i !== last[last.length - 1]);
  const pool = choices.length ? choices : [0];
  const i = pool[Math.floor(rand() * pool.length)] ?? 0;
  recent[key] = [...last, i].slice(-3);
  try {
    localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    // storage may be unavailable (private mode); the picker still works in memory
  }
  return fill(list[i] ?? '', vars);
}

let logs: typeof logPools | null = null;
/** The lines after a log; prefetched at idle, so a meal saved later finds them ready. */
export function loadLogCopy(): Promise<typeof logPools> {
  return import('./log').then((m) => (logs = m.logPools));
}

export async function pickLog(key: LogPoolKey, vars: Record<string, string | number> = {}): Promise<string> {
  return pickFrom(logs ?? (await loadLogCopy()), key, vars);
}
