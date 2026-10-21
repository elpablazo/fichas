// Remote food-text parsing (/api/ai/parse). Local matching always runs first (§11.5).
import type { Classified } from '../shared/ai-schema';
import type { ParseResult } from '../shared/domain/matcher';
import { api } from './db/sync';

export type RemoteParse =
  | { kind: 'ok'; result: ParseResult }
  | { kind: 'offline' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

async function requestParse(path: string, init: RequestInit): Promise<RemoteParse> {
  if (!navigator.onLine) return { kind: 'offline' };
  try {
    const res = await api(path, init);
    if (res.status === 404 || res.status === 429 || res.status === 503) return { kind: 'unavailable' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', result: (await res.json()) as ParseResult };
  } catch {
    return navigator.onLine ? { kind: 'error' } : { kind: 'offline' };
  }
}

export function parseRemote(
  text: string,
  slot: string,
  day: string,
  signal?: AbortSignal,
  planId?: string,
): Promise<RemoteParse> {
  return requestParse('/api/ai/parse', {
    method: 'POST',
    body: JSON.stringify({ text, slot, day, plan_id: planId }),
    signal,
  });
}

export function parsePhoto(jpeg: string, slot: string, day: string, signal?: AbortSignal): Promise<RemoteParse> {
  return requestParse(`/api/ai/photo?slot=${encodeURIComponent(slot)}&day=${day}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: jpeg,
    signal,
  });
}

/** Food groups of phrases while typing (JEV). Best effort: null when offline or unavailable. */
export async function classifyRemote(items: string[], signal?: AbortSignal): Promise<Classified[] | null> {
  if (!items.length || !navigator.onLine) return null;
  try {
    const res = await api('/api/ai/classify', { method: 'POST', body: JSON.stringify({ items }), signal });
    if (!res.ok) return null;
    return ((await res.json()) as { items: Classified[] }).items;
  } catch {
    return null;
  }
}
