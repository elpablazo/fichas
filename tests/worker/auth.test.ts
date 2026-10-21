import { describe, expect, it } from 'vitest';
import { api, CODE, pair } from './helpers';

describe('auth', () => {
  it('health needs no session', async () => {
    const res = await api('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('pairs with the code (accent/case/space-insensitive) and sets a secure HttpOnly cookie', async () => {
    const res = await api('/api/auth/pair', {
      method: 'POST',
      body: JSON.stringify({ code: `  ${CODE.toUpperCase().replace('limon', 'limón')} `, label: 'iPhone' }),
      ip: '198.51.100.1',
    });
    expect(res.status).toBe(204);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/^sid=[\w-]{40,};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects a wrong code and rate-limits after 5 attempts per IP per hour', async () => {
    const ip = '198.51.100.2';
    for (let i = 0; i < 5; i++) {
      const r = await api('/api/auth/pair', { method: 'POST', body: JSON.stringify({ code: 'nope' }), ip });
      expect(r.status).toBe(401);
    }
    const blocked = await api('/api/auth/pair', { method: 'POST', body: JSON.stringify({ code: CODE }), ip });
    expect(blocked.status).toBe(429);
  });

  it('requires a session for data routes', async () => {
    expect((await api('/api/sync?since=0')).status).toBe(401);
    expect((await api('/api/sync?since=0', { cookie: 'sid=forged' })).status).toBe(401);
  });

  it('requires the CSRF header on mutating requests', async () => {
    const cookie = await pair();
    const res = await api('/api/sync', {
      method: 'POST',
      cookie,
      headers: { 'X-Fichas': '0' },
      body: JSON.stringify({ mutations: [] }),
    });
    expect(res.status).toBe(403);
  });

  it('lists and revokes devices; logout revokes this session', async () => {
    const a = await pair('192.0.2.10');
    const b = await pair('192.0.2.11');
    const list = (await (await api('/api/auth/sessions', { cookie: a })).json()) as {
      sessions: { id: string; current: boolean }[];
    };
    expect(list.sessions.filter((s) => s.current)).toHaveLength(1);
    const other = (await (await api('/api/auth/sessions', { cookie: b })).json()) as {
      sessions: { id: string; current: boolean }[];
    };
    const bId = other.sessions.find((s) => s.current)?.id;
    expect((await api(`/api/auth/sessions/${bId}/revoke`, { method: 'POST', cookie: a })).status).toBe(204);
    expect((await api('/api/sync?since=0', { cookie: b })).status).toBe(401);
    expect((await api('/api/auth/logout', { method: 'POST', cookie: a })).status).toBe(204);
    expect((await api('/api/sync?since=0', { cookie: a })).status).toBe(401);
  });
});
