import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { PairBody, type SessionInfo } from '../../shared/api';
import { type AppEnv, apiError, clientIp } from '../lib/http';
import { hit, underLimit } from '../lib/ratelimit';
import {
  COOKIE,
  clearCookie,
  codesMatch,
  isSecure,
  newToken,
  requireSession,
  sessionCookie,
  sha256Hex,
} from '../lib/session';

export const auth = new Hono<AppEnv>();

auth.post('/pair', async (c) => {
  // 5 failed attempts per IP per hour (successful pairings are not counted).
  const key = `pair:${clientIp(c)}`;
  if (!(await underLimit(c.env.DB, key, 5))) return apiError(c, 429, 'rate_limited', 'Too many attempts.');
  const parsed = PairBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid body.');
  if (!(await codesMatch(parsed.data.code, c.env.OWNER_PAIRING_CODE ?? ''))) {
    await hit(c.env.DB, key);
    return apiError(c, 401, 'wrong_code', 'Wrong code.');
  }
  const token = newToken();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, token_hash, label, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), await sha256Hex(token), parsed.data.label.slice(0, 80), now, now)
    .run();
  c.header('Set-Cookie', sessionCookie(token, isSecure(c)));
  return c.body(null, 204);
});

auth.use('/logout', requireSession);
auth.post('/logout', async (c) => {
  await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(Date.now(), c.get('session').id).run();
  c.header('Set-Cookie', clearCookie(isSecure(c)));
  return c.body(null, 204);
});

auth.use('/sessions', requireSession);
auth.use('/sessions/*', requireSession);
auth.get('/sessions', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, label, created_at, last_seen_at FROM sessions WHERE revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 20',
  ).all<Omit<SessionInfo, 'current'>>();
  const me = c.get('session').id;
  return c.json({ sessions: rows.results.map((s) => ({ ...s, current: s.id === me })) });
});

auth.post('/sessions/:id/revoke', async (c) => {
  await c.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(Date.now(), c.req.param('id'))
    .run();
  if (c.req.param('id') === c.get('session').id && getCookie(c, COOKIE))
    c.header('Set-Cookie', clearCookie(isSecure(c)));
  return c.body(null, 204);
});
