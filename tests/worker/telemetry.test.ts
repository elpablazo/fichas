import { env } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';
import { api, pair } from './helpers';

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM ux_events'), env.DB.prepare('DELETE FROM client_errors')]);
});

it('diagnostics use a true median, interpolated p90 and only the last seven days', async () => {
  expect((await api('/api/diagnostics')).status).toBe(401);
  const cookie = await pair(),
    at = Date.now();
  const response = await api('/api/telemetry', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      ux: [
        ...[100, 300, 500, 900].map((ms, i) => ({ id: `sample-${i}`, at, name: 'open_to_first_log', ms })),
        { id: 'old-sample', at: at - 8 * 86400000, name: 'open_to_first_log', ms: 60000 },
        { id: 'single', at, name: 'single_sample', ms: 120 },
      ],
      errors: [
        { id: 'current-error', at, message: 'test error' },
        { id: 'old-error', at: at - 8 * 86400000, message: 'old test error' },
      ],
    }),
  });
  expect(response.status).toBe(204);
  const report = (await (await api('/api/diagnostics', { cookie })).json()) as {
    events: { name: string; n: number; p50: number; p90: number }[];
    errors: number;
  };
  expect(report.events.find((e) => e.name === 'open_to_first_log')).toEqual({
    name: 'open_to_first_log',
    n: 4,
    p50: 400,
    p90: 780,
  });
  expect(report.events.find((e) => e.name === 'single_sample')).toMatchObject({ n: 1, p50: 120, p90: 120 });
  expect(report.errors).toBe(1);
});

it('a lost acknowledgement can be retried without duplicating timing samples or errors', async () => {
  const cookie = await pair(),
    at = Date.now();
  const body = JSON.stringify({
    ux: [{ id: 'stable-event', at, name: 'open_to_first_log', ms: 400, taps: 1 }],
    errors: [{ id: 'stable-error', at, message: 'test error' }],
  });
  for (let i = 0; i < 2; i++) expect((await api('/api/telemetry', { method: 'POST', cookie, body })).status).toBe(204);
  const report = (await (await api('/api/diagnostics', { cookie })).json()) as {
    events: { name: string; n: number }[];
    errors: number;
  };
  expect(report.events.find((e) => e.name === 'open_to_first_log')?.n).toBe(1);
  expect(report.errors).toBe(1);
});
