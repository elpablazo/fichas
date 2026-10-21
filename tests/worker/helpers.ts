import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../src/worker/index';

export const CODE = 'mango nopal tortilla pepino limon cacao';

export async function api(path: string, init: RequestInit & { cookie?: string; ip?: string } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('Cookie', init.cookie);
  if (init.method && init.method !== 'GET') headers.set('X-Fichas', headers.get('X-Fichas') ?? '1');
  headers.set('CF-Connecting-IP', init.ip ?? '203.0.113.1');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`https://fichas.test${path}`, { ...init, headers }), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export async function pair(ip = '203.0.113.9'): Promise<string> {
  const res = await api('/api/auth/pair', { method: 'POST', body: JSON.stringify({ code: CODE, label: 'test' }), ip });
  if (res.status !== 204) throw new Error(`pair failed ${res.status}`);
  return (res.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
}
