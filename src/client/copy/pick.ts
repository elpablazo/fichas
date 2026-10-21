// Copy picker: random variant from a pool, never one of the last 3 used for that key (§14.5).
import { fill } from '../../shared/domain/format';
import { type PoolKey, pools } from './es-MX';

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
  const list = pools[key] as readonly string[];
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
