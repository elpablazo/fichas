// Shared Hono types, error responses and security middleware.
import type { Context, MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type AppEnv = {
  Bindings: Env;
  Variables: { session: { id: string } };
};

export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'Cache-Control': 'no-store',
};

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(k, v);
};

/** CSRF guard: mutating requests must carry `X-Fichas: 1` (plus SameSite=Lax cookies). */
export const csrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.header('X-Fichas') !== '1') {
    return apiError(c, 403, 'csrf', 'Missing X-Fichas header.');
  }
  await next();
};

export function clientIp(c: Context): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local';
}
