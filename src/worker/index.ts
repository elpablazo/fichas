// Fichas Worker: JSON API under /api (static assets are served by Workers Static Assets).
import { Hono } from 'hono';
import { scheduledBackup } from './lib/backup';
import { type AppEnv, apiError, csrf, securityHeaders } from './lib/http';
import { runScheduler } from './lib/scheduler';
import { requireSession } from './lib/session';
import { ai } from './routes/ai';
import { auth } from './routes/auth';
import { misc } from './routes/misc';
import { plans } from './routes/plans';
import { push } from './routes/push';
import { journalResponse, shares } from './routes/shares';
import { sync } from './routes/sync';

export { PlanReadJob } from './lib/plan-job';

export const app = new Hono<AppEnv>().basePath('/api');

app.use('*', securityHeaders);
app.use('*', csrf);

app.get('/health', (c) =>
  c.json({ ok: true, version: c.env.APP_VERSION, planReading: !!c.env.MODEL_PLAN_A && !!c.env.MODEL_PLAN_B }),
);
app.route('/auth', auth);
app.use('/ai/*', requireSession);
app.route('/ai', ai);
app.use('/plans/*', requireSession);
app.route('/plans', plans);
app.use('/push/*', requireSession);
app.route('/push', push);
app.use('/shares', requireSession);
app.use('/shares/*', requireSession);
app.route('/shares', shares);

app.use('/sync', requireSession);
app.use('/sync/*', requireSession);
app.use('/export', requireSession);
app.use('/telemetry', requireSession);
app.use('/diagnostics', requireSession);
app.use('/backups', requireSession);
app.use('/backups/*', requireSession);
app.route('/sync', sync);
app.route('/', misc);

app.notFound((c) => apiError(c, 404, 'not_found', 'Not found.'));
app.onError((err, c) => {
  console.error('api_error', err instanceof Error ? err.message : String(err));
  return apiError(c, 500, 'internal', 'Something went wrong.');
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // The nutritionist's journal links live outside /api (no session, a page of their own).
    if (new URL(request.url).pathname.startsWith('/n/')) return journalResponse(request, env, ctx);
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    // A delayed cron must respect the owner's policy at actual execution time.
    ctx.waitUntil(runScheduler(env));
    ctx.waitUntil(scheduledBackup(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
