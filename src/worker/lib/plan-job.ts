import { DurableObject } from 'cloudflare:workers';
import { checkPlan, compareReads, expandRead } from '../../shared/domain/plan-ingestion';
import { PlanParseV1 } from '../../shared/plan-read-schema';
import { REV_BUMP, REV_NOW } from './db';
import { runPlanReader } from './plan-ai';
import { completePlanExamples } from './plan-examples';
import { getPlan, reportOf } from './plan-store';
import { PLAN_PROMPT_VERSION } from './prompts/plan';
import { sha256Hex } from './session';

interface Job {
  id: string;
  origin: string;
  token: number;
}

async function perform(env: Env, job: Job): Promise<void> {
  const row = await getPlan(env.DB, job.id);
  if (row?.status !== 'draft') return;
  const report = reportOf(row);
  if (report.state !== 'reading' || report.started_at !== job.token) return;
  const objects = await Promise.all((JSON.parse(row.source_keys) as string[]).map((key) => env.FILES.get(key)));
  if (objects.some((o) => !o)) throw new Error('Missing plan source.');
  const sources = await Promise.all(
    objects.map(async (o, i) => ({ type: report.files[i]!.type, base64: await o!.text() })),
  );
  const models = [env.MODEL_PLAN_A, env.MODEL_PLAN_B];
  const results = await Promise.allSettled(
    models.map(async (model) => {
      const key = await sha256Hex(JSON.stringify(['plan', model, PLAN_PROMPT_VERSION, row.source_sha256]));
      const cached = await env.DB.prepare('SELECT output FROM ai_cache WHERE key=?')
        .bind(key)
        .first<{ output: string }>();
      if (cached) return { read: PlanParseV1.parse(JSON.parse(cached.output)), ms: 0 };
      const result = await runPlanReader(env, model, sources, job.origin);
      // Persist each independent read immediately; an interrupted job reuses completed reads.
      await env.DB.prepare('INSERT OR REPLACE INTO ai_cache (key,job,model,output,created_at) VALUES (?,?,?,?,?)')
        .bind(key, 'plan', model, JSON.stringify(result.read), Date.now())
        .run();
      return result;
    }),
  );
  const valid = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  report.models = results.map((r, i) => ({
    model: models[i]!,
    ok: r.status === 'fulfilled',
    ms: r.status === 'fulfilled' ? r.value.ms : 0,
  }));
  report.state = valid.length ? 'ready' : 'error';
  report.single_read = valid.length === 1;
  const plans = valid.map((result) => expandRead(result.read));
  const exampleWarnings = await completePlanExamples(
    env,
    valid.map((result) => result.read),
    plans,
    job.origin,
  );
  const plan = plans[0] ?? null;
  report.disagreements = plans.length === 2 ? compareReads(plan!, plans[1]!) : [];
  report.warnings = plans.flatMap(checkPlan).concat(exampleWarnings);
  await env.DB.batch([
    env.DB.prepare(REV_BUMP),
    env.DB.prepare(`UPDATE plans SET data=?,parse_report=?,updated_at=?,rev=${REV_NOW}
      WHERE id=? AND status='draft' AND json_extract(parse_report,'$.started_at')=?`).bind(
      plan ? JSON.stringify(plan) : '{}',
      JSON.stringify(report),
      Date.now(),
      row.id,
      job.token,
    ),
  ]);
}

// One object per draft: the alarm owns the read independently of the browser connection.
export class PlanReadJob extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const { id, origin } = (await request.json()) as { id: string; origin: string };
      if (await this.ctx.storage.get<Job>('job')) {
        // A manual retry also recovers a job whose automatic alarm retries were exhausted.
        if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + 1000);
        return new Response(null, { status: 202 });
      }
      const row = await getPlan(this.env.DB, id);
      if (row?.status !== 'draft') return new Response(null, { status: 404 });
      const report = reportOf(row);
      if (report.state === 'ready') return new Response(null, { status: 200 });
      report.state = 'reading';
      const token = Date.now();
      report.started_at = token;
      await this.env.DB.prepare("UPDATE plans SET parse_report=?,updated_at=? WHERE id=? AND status='draft'")
        .bind(JSON.stringify(report), Date.now(), id)
        .run();
      await this.ctx.storage.transaction(async (storage) => {
        await storage.put('job', { id, origin, token } satisfies Job);
        await storage.setAlarm(Date.now() + 1000);
      });
      return new Response(null, { status: 202 });
    });
  }

  override async alarm(info: AlarmInvocationInfo): Promise<void> {
    const job = await this.ctx.storage.get<Job>('job');
    if (!job) return;
    try {
      await perform(this.env, job);
    } catch (error) {
      if (info.retryCount < 6) throw error;
      const row = await getPlan(this.env.DB, job.id);
      if (row?.status === 'draft' && reportOf(row).started_at === job.token) {
        const report = reportOf(row);
        report.state = 'error';
        await this.env.DB.batch([
          this.env.DB.prepare(REV_BUMP),
          this.env.DB.prepare(
            `UPDATE plans SET parse_report=?,updated_at=?,rev=${REV_NOW} WHERE id=? AND status='draft'`,
          ).bind(JSON.stringify(report), Date.now(), job.id),
        ]);
      }
    }
    await this.ctx.storage.delete('job');
  }
}
