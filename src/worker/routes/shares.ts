// Links for the nutritionist (docs/05-fichas-2.md §9). The owner creates, lists and revokes them (session);
// anyone with a link sees the read-only journal at /n/<token> until it expires or is revoked.
import { Hono } from 'hono';
import { z } from 'zod';
import { journalCopy } from '../../client/copy/more';
import { appDay, appMinutes, daysBetween } from '../../shared/domain/day';
import { buildJournal } from '../../shared/domain/journal';
import type { LogRow, PlanRow } from '../../shared/domain/types';
import { type AppEnv, apiError } from '../lib/http';
import { gonePage, journalPage } from '../lib/journal-page';
import { allow } from '../lib/ratelimit';
import { newToken, sha256Hex } from '../lib/session';

const DAY = 86_400_000;
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const CreateShare = z
  .object({ from: Day, to: Day, valid_days: z.number().int().min(1).max(90).default(30) })
  .refine((b) => b.from <= b.to && daysBetween(b.from, b.to) < 92, { message: 'Invalid range.' });

export interface ShareInfo {
  id: string;
  from: string;
  to: string;
  created_at: number;
  expires_at: number;
  views: number;
}

export const shares = new Hono<AppEnv>();

shares.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, from_day AS "from", to_day AS "to", created_at, expires_at, views FROM shares
     WHERE revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 20`,
  )
    .bind(Date.now())
    .all<ShareInfo>();
  return c.json({ shares: rows.results });
});

shares.post('/', async (c) => {
  const parsed = CreateShare.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_request', 'Invalid range.');
  if (!(await allow(c.env.DB, `share:${c.get('session').id}`, 20)))
    return apiError(c, 429, 'rate_limited', 'Try later.');
  const token = newToken();
  const now = Date.now();
  const share: ShareInfo = {
    id: crypto.randomUUID(),
    from: parsed.data.from,
    to: parsed.data.to,
    created_at: now,
    expires_at: now + parsed.data.valid_days * DAY,
    views: 0,
  };
  await c.env.DB.prepare(
    'INSERT INTO shares (id, token_hash, from_day, to_day, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(share.id, await sha256Hex(token), share.from, share.to, share.created_at, share.expires_at)
    .run();
  return c.json({ ...share, token }, 201);
});

shares.delete('/:id', async (c) => {
  await c.env.DB.prepare('UPDATE shares SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(Date.now(), c.req.param('id'))
    .run();
  return c.body(null, 204);
});

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

/** GET /n/<token>: the journal page. Unknown, revoked and expired links all look the same. */
export async function journalResponse(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const gone = (status = 404) => new Response(gonePage(), { status, headers: PAGE_HEADERS });
  if (request.method !== 'GET' && request.method !== 'HEAD') return gone(405);
  const token = new URL(request.url).pathname.slice(3);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return gone();
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await allow(env.DB, `journal:${ip}`, 300))) return gone(429);
  const share = await env.DB.prepare(
    'SELECT id, from_day, to_day FROM shares WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?',
  )
    .bind(await sha256Hex(token), Date.now())
    .first<{ id: string; from_day: string; to_day: string }>();
  if (!share) return gone();
  ctx.waitUntil(
    env.DB.prepare('UPDATE shares SET views = views + 1, last_viewed_at = ? WHERE id = ?')
      .bind(Date.now(), share.id)
      .run(),
  );
  const [settings, plans, logs] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('tz','day_start_hour')"),
    env.DB.prepare("SELECT * FROM plans WHERE status IN ('active','archived') AND confirmed_at IS NOT NULL"),
    env.DB.prepare('SELECT * FROM logs WHERE day >= ? AND day <= ? AND deleted_at IS NULL').bind(
      share.from_day,
      share.to_day,
    ),
  ]);
  const stored = Object.fromEntries((settings?.results ?? []).map((r) => [r.key, JSON.parse(r.value as string)]));
  const tz = (stored.tz as string | undefined) ?? env.TZ_DEFAULT;
  const dayStart = (stored.day_start_hour as number | undefined) ?? 4;
  const now = Date.now();
  const journal = buildJournal({
    logs: (logs?.results ?? []).map((r) => ({
      ...r,
      items: JSON.parse(r.items as string),
      raw_units: {},
      units: {},
      target: {},
    })) as unknown as LogRow[],
    plans: (plans?.results ?? []).map((r) => ({ ...r, data: JSON.parse(r.data as string) })) as unknown as PlanRow[],
    from: share.from_day,
    to: share.to_day,
    today: appDay(now, tz, dayStart),
    nowMinutes: appMinutes(now, tz, dayStart),
    tz,
    dayStartHour: dayStart,
  });
  return new Response(request.method === 'HEAD' ? null : journalPage(journal, journalCopy.kicker), {
    headers: PAGE_HEADERS,
  });
}
