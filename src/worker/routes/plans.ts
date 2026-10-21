import { Hono } from 'hono';
import { z } from 'zod';
import { ConfirmBody } from '../../shared/api';
import { addDays, appDay } from '../../shared/domain/day';
import { checkPlan, type PlanReport } from '../../shared/domain/plan-ingestion';
import { PlanV1 } from '../../shared/domain/plan-schema';
import { currentRev, REV_BUMP, REV_NOW } from '../lib/db';
import { type AppEnv, apiError } from '../lib/http';
import { getPlan, reportOf, type StoredPlan, draftView as view } from '../lib/plan-store';
import { allow } from '../lib/ratelimit';
import { sha256Hex } from '../lib/session';

export const plans = new Hono<AppEnv>();
const FilesBody = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(160),
        type: z.enum(['application/pdf', 'image/jpeg']),
        size: z.number().int().min(1).max(5_000_000),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1)
    .max(5),
});
plans.post('/drafts', async (c) => {
  const parsed = FilesBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.files.reduce((s, f) => s + f.size, 0) > 12_000_000)
    return apiError(c, 400, 'bad_files', 'Invalid plan files.');
  if (!(await allow(c.env.DB, `plan-upload:${c.get('session').id}`, 12)))
    return apiError(c, 429, 'rate_limited', 'Try later.');
  const files = parsed.data.files;
  const hash = files.length === 1 ? files[0]!.sha256 : await sha256Hex(JSON.stringify(files.map((f) => f.sha256)));
  const duplicate = await c.env.DB.prepare(
    "SELECT id FROM plans WHERE source_sha256=? AND status IN ('active','archived')",
  )
    .bind(hash)
    .first<{ id: string }>();
  if (duplicate) return c.json({ duplicate_id: duplicate.id }, 409);
  const id = crypto.randomUUID();
  const now = Date.now();
  const report: PlanReport = {
    state: 'uploading',
    files,
    disagreements: [],
    warnings: [],
    single_read: false,
    models: [],
  };
  await c.env.DB.batch([
    c.env.DB.prepare(REV_BUMP),
    c.env.DB.prepare(`INSERT INTO plans
    (id,status,data,source_keys,source_sha256,parse_report,created_at,updated_at,rev)
    VALUES (?,'draft','{}',?,?,?,?,?,${REV_NOW})`).bind(
      id,
      JSON.stringify(files.map((_, i) => `plan-src/${id}/${i}`)),
      hash,
      JSON.stringify(report),
      now,
      now,
    ),
  ]);
  return c.json({ draft_id: id }, 201);
});

plans.put('/drafts/:id/files/:n', async (c) => {
  const row = await getPlan(c.env.DB, c.req.param('id'));
  const n = Number(c.req.param('n'));
  if (row?.status !== 'draft') return apiError(c, 404, 'not_found', 'Draft not found.');
  const report = reportOf(row);
  const file = report.files[n];
  if (!Number.isInteger(n) || n < 0 || !file || report.state !== 'uploading')
    return apiError(c, 409, 'draft_state', 'Draft cannot be uploaded.');
  if (!c.req.header('Content-Type')?.startsWith('text/plain'))
    return apiError(c, 415, 'bad_type', 'Base64 text required.');
  const limit = 4 * Math.ceil(file.size / 3);
  const reader = c.req.raw.body?.getReader();
  if (!reader) return apiError(c, 400, 'bad_file', 'Missing file.');
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return apiError(c, 413, 'too_large', 'File too large.');
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  const body = chunks.join('') + decoder.decode();
  if (
    size !== limit ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(body) ||
    !(file.type === 'application/pdf' ? body.startsWith('JVBERi0') : body.startsWith('/9j/'))
  )
    return apiError(c, 400, 'bad_file', 'Invalid file.');
  const key = `plan-src/${row.id}/${n}`;
  const existing = await c.env.FILES.head(key);
  if (existing) return apiError(c, 409, 'already_uploaded', 'File already uploaded.');
  const saved = await c.env.FILES.put(key, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'text/plain' },
    customMetadata: { type: file.type, sha256: file.sha256, contentHash: await sha256Hex(body) },
  });
  if (!saved) return apiError(c, 409, 'already_uploaded', 'File already uploaded.');
  return c.body(null, 204);
});

plans.get('/drafts/latest', async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT * FROM plans WHERE status='draft' ORDER BY created_at DESC LIMIT 1",
  ).first<StoredPlan>();
  return c.json(row ? await view(c.env.DB, row) : { draft_id: null });
});

plans.post('/drafts/:id/parse', async (c) => {
  const row = await getPlan(c.env.DB, c.req.param('id'));
  if (row?.status !== 'draft') return apiError(c, 404, 'not_found', 'Draft not found.');
  const report = reportOf(row);
  if (report.state === 'ready') return c.json(await view(c.env.DB, row));
  if (report.state === 'reading' && Date.now() - (report.started_at ?? 0) < 240_000)
    return c.json(await view(c.env.DB, row), 202);
  if (!(await allow(c.env.DB, `plan-read:${c.get('session').id}`, 6)))
    return apiError(c, 429, 'rate_limited', 'Try later.');
  const keys = JSON.parse(row.source_keys) as string[];
  const objects = await Promise.all(keys.map((key) => c.env.FILES.get(key)));
  if (objects.some((o) => !o)) return apiError(c, 409, 'missing_files', 'Finish uploading first.');
  const sources = await Promise.all(
    objects.map(async (o, i) => ({ type: report.files[i]!.type, base64: await o!.text() })),
  );
  const hashes = await Promise.all(
    objects.map(async (o, i) => o!.customMetadata?.contentHash ?? (await sha256Hex(sources[i]!.base64))),
  );
  const contentHash = await sha256Hex(hashes.join('|'));
  const duplicate = await c.env.DB.prepare(
    "SELECT id FROM plans WHERE source_sha256=? AND status IN ('active','archived')",
  )
    .bind(contentHash)
    .first<{ id: string }>();
  if (duplicate) return c.json({ duplicate_id: duplicate.id }, 409);
  await c.env.DB.prepare("UPDATE plans SET source_sha256=? WHERE id=? AND status='draft'")
    .bind(contentHash, row.id)
    .run();
  if (!c.env.MODEL_PLAN_A || !c.env.MODEL_PLAN_B || !c.env.OPENROUTER_API_KEY)
    return apiError(c, 503, 'unavailable', 'Plan readers are not configured.');
  const response = await c.env.PLAN_JOBS.getByName(row.id).fetch('https://plan-job/start', {
    method: 'POST',
    body: JSON.stringify({ id: row.id, origin: new URL(c.req.url).origin }),
  });
  if (!response.ok) return apiError(c, 503, 'unavailable', 'Plan job could not start.');
  return c.json(await view(c.env.DB, (await getPlan(c.env.DB, row.id))!), 202);
});

plans.post('/:id/discard', async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare(REV_BUMP),
    c.env.DB.prepare(`UPDATE plans SET status='discarded',updated_at=?,rev=${REV_NOW}
    WHERE id=? AND status='draft'`).bind(Date.now(), c.req.param('id')),
  ]);
  return c.body(null, 204);
});

plans.post('/:id/confirm', async (c) => {
  const parsed = ConfirmBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return apiError(c, 400, 'bad_plan', 'Invalid plan.');
  const row = await getPlan(c.env.DB, c.req.param('id'));
  if (!row) return apiError(c, 404, 'not_found', 'Draft not found.');
  const input = parsed.data;
  if (row.confirmed_at)
    return c.json({ season: row.season, plan: JSON.parse(row.data), rev: await currentRev(c.env.DB) });
  if (row.status !== 'draft') return apiError(c, 409, 'draft_state', 'Draft cannot be confirmed.');
  const report = reportOf(row);
  if (
    report.state !== 'ready' ||
    report.disagreements.some((d) => !input.resolutions[d.id]) ||
    (report.single_read && !input.single_read_ack) ||
    ((report.warnings.length || checkPlan(input.plan).length) && !input.warnings_ack)
  )
    return apiError(c, 409, 'review_required', 'Resolve the review first.');
  const plan = PlanV1.parse(input.plan);
  const slotKeys = plan.slots.map((s) => s.key);
  const equivalentIds = plan.equivalents.map((e) => e.id);
  if (
    new Set(slotKeys).size !== slotKeys.length ||
    new Set(equivalentIds).size !== equivalentIds.length ||
    plan.slots.some((s) =>
      s.example?.items.some((i) => i.options.some((o) => !equivalentIds.includes(o.equivalent_id))),
    )
  )
    return apiError(c, 400, 'bad_plan', 'Plan references are inconsistent.');
  const date = new Date(`${input.starts_on}T12:00:00Z`);
  const today = appDay(Date.now(), c.env.TZ_DEFAULT);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.starts_on ||
    input.starts_on < today ||
    input.starts_on > addDays(today, 1)
  )
    return apiError(c, 400, 'bad_start', 'Use today or tomorrow.');
  const active = await c.env.DB.prepare("SELECT * FROM plans WHERE status='active'").first<StoredPlan>();
  const now = Date.now();
  const guard = crypto.randomUUID();
  const activeId = active?.id ?? '';
  // Guard statements are evaluated inside the SAME transaction as the transition, including concurrent logs/confirmations.
  const stmts = [
    c.env.DB.prepare(REV_BUMP),
    c.env.DB.prepare(`INSERT INTO plan_confirm_guards(id,valid) SELECT ?,CASE WHEN
      EXISTS(SELECT 1 FROM plans WHERE id=? AND status='draft' AND confirmed_at IS NULL)
      AND COALESCE((SELECT id FROM plans WHERE status='active'),'')=?
      AND NOT EXISTS(SELECT 1 FROM logs WHERE deleted_at IS NULL AND day>=?)
      AND NOT EXISTS(SELECT 1 FROM plans WHERE status='active' AND starts_on>=? AND EXISTS
        (SELECT 1 FROM logs WHERE plan_id=plans.id AND deleted_at IS NULL)) THEN 1 ELSE 0 END`).bind(
      guard,
      row.id,
      activeId,
      input.starts_on,
      input.starts_on,
    ),
    c.env.DB.prepare(`UPDATE plans SET status=CASE WHEN starts_on>=? THEN 'discarded' ELSE 'archived' END,
      ends_on=?,updated_at=?,rev=${REV_NOW} WHERE id=? AND status='active'`).bind(
      input.starts_on,
      addDays(input.starts_on, -1),
      now,
      activeId,
    ),
    c.env.DB.prepare(`UPDATE plans SET status='active',season=(SELECT COALESCE(MAX(season),0)+1 FROM plans),
      starts_on=?,issued_on=?,data=?,confirmed_at=?,updated_at=?,rev=${REV_NOW} WHERE id=? AND status='draft'`).bind(
      input.starts_on,
      plan.issued_on,
      JSON.stringify(plan),
      now,
      now,
      row.id,
    ),
  ];
  if (input.weighin_kg != null)
    stmts.push(
      c.env.DB.prepare(`INSERT INTO weighins
    (id,day,kg,source,created_at,updated_at,rev) VALUES (?, ?, ?,'nutritionist',?,?,${REV_NOW})`).bind(
        `plan:${row.id}`,
        input.starts_on,
        input.weighin_kg,
        now,
        now,
      ),
    );
  stmts.push(c.env.DB.prepare('DELETE FROM plan_confirm_guards WHERE id=?').bind(guard));
  try {
    await c.env.DB.batch(stmts);
  } catch {
    return apiError(c, 409, 'start_conflict', 'Dates or plans changed. Review again.');
  }
  const confirmed = (await getPlan(c.env.DB, row.id))!;
  return c.json({ season: confirmed.season, plan, rev: await currentRev(c.env.DB) });
});

plans.get('/:id/files/:n', async (c) => {
  const row = await getPlan(c.env.DB, c.req.param('id'));
  const n = Number(c.req.param('n'));
  if (!row || !Number.isInteger(n) || n < 0 || row.status === 'discarded')
    return apiError(c, 404, 'not_found', 'File not found.');
  const key = (JSON.parse(row.source_keys) as string[])[n];
  const object = key ? await c.env.FILES.get(key) : null;
  if (!object) return apiError(c, 404, 'not_found', 'File not found.');
  const file = reportOf(row).files?.[n];
  c.header('X-Original-Type', file?.type ?? 'application/pdf');
  c.header('Content-Type', 'text/plain');
  // Decoded by the browser for download; the API never exposes files without a session.
  return c.body(object.body);
});
