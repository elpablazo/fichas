// Single-owner auth: pairing code → session token in an HttpOnly cookie, stored hashed.
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv } from './http';
import { apiError } from './http';

export const COOKIE = 'sid';
const SESSION_MAX_AGE = 34_560_000; // 400 days
const TOUCH_EVERY = 5 * 60_000;

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeCode(code: string): string {
  return code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Constant-time comparison of two codes (compares fixed-length digests). */
export async function codesMatch(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(normalizeCode(given)), sha256Hex(normalizeCode(expected))]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0 && normalizeCode(expected).length > 0;
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearCookie(secure: boolean): string {
  return `${COOKIE}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`;
}

export function isSecure(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:';
}

interface SessionRow {
  id: string;
  last_seen_at: number;
}

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return apiError(c, 401, 'unauthorized', 'Pair this device first.');
  const hash = await sha256Hex(token);
  const s = await c.env.DB.prepare('SELECT id, last_seen_at FROM sessions WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(hash)
    .first<SessionRow>();
  if (!s) return apiError(c, 401, 'unauthorized', 'Pair this device first.');
  const now = Date.now();
  if (now - s.last_seen_at > TOUCH_EVERY) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, s.id).run(),
    );
  }
  c.set('session', { id: s.id });
  await next();
};
