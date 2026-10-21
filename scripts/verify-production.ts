// Production smoke test: never writes meals/recipes/settings. AI mode uses provider calls/counters.
// Usage: node --import tsx scripts/verify-production.ts [--photo private/evals/plate.jpg]

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import type { PullResponse } from '../src/shared/api';

const ORIGIN = 'https://fichas.toolco.workers.dev';
const photoFlag = process.argv.indexOf('--photo');
const photoPath = photoFlag < 0 ? null : process.argv[photoFlag + 1];
const code = readFileSync('private/pairing-code.txt', 'utf8').trim();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  const expectedVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  let health = await context.request.get(`${ORIGIN}/api/health`);
  // A newly deployed Worker can take a short time to propagate to the serving location.
  await expect
    .poll(
      async () => {
        health = await context.request.get(`${ORIGIN}/api/health`);
        expect(health.status()).toBe(200);
        return (await health.json()).version;
      },
      { timeout: 45_000, intervals: [1000, 2000, 5000] },
    )
    .toBe(expectedVersion);
  const healthBody = (await health.json()) as { version: string; planReading: boolean };
  expect((await context.request.get(`${ORIGIN}/api/sync?since=0`)).status()).toBe(401);
  expect((await context.request.get(`${ORIGIN}/api/plans/plan-2026-10-08/files/0`)).status()).toBe(401);
  const manifest = await context.request.get(`${ORIGIN}/manifest.webmanifest`);
  expect((await manifest.json()).display).toBe('standalone');
  expect(health.headers()['content-security-policy']).toContain("default-src 'self'");
  // New M2 auto-processing must not turn this read-only smoke test into a food-data write.
  await page.route('**/api/telemetry', (route) => route.fulfill({ status: 204 }));
  if (!photoPath) await page.route('**/api/ai/*', (route) => route.abort());
  await page.route('**/api/ai/pantry', (route) => route.abort());
  await page.route('**/api/ai/ideas', (route) => route.abort());
  await page.route('**/api/sync', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { error: { code: 'smoke_read_only' } } })
      : route.continue(),
  );
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(ORIGIN);
      break;
    } catch (error) {
      if (attempt === 2 || !String(error).includes('net::ERR_EMPTY_RESPONSE')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  await page.getByLabel('Tu clave').fill(code);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('[data-card]')).toBeVisible({ timeout: 15000 });
  const pull: PullResponse = await (await context.request.get(`${ORIGIN}/api/sync?since=0`)).json();
  expect(pull.changes.plans?.filter((plan) => plan.status === 'active')).toHaveLength(1);
  expect(pull.changes.recipes?.length).toBeGreaterThanOrEqual(9);
  const vapid = await context.request.get(`${ORIGIN}/api/push/vapid`);
  expect(vapid.status()).toBe(200);
  expect((await vapid.json()).key).toBe(readFileSync('private/vapid-public.txt', 'utf8').trim());
  await page.waitForFunction(
    async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
  );
  await page.waitForFunction(async () => {
    const cache = await caches.open('fichas-shell');
    return (await cache.keys()).some((request) => new URL(request.url).pathname === '/');
  });
  console.log('✓ Production health, auth, plan sync, VAPID identity, manifest, headers and service worker');

  await expect(page.getByTestId('day-meter')).toBeVisible();
  // A local preview appears while typing; closing the sheet logs nothing.
  await page.getByTestId('describe-open').click();
  await page.getByTestId('describe-input').fill('2 tortillas');
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByTestId('impact')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto(`${ORIGIN}/progreso/plan`);
  await expect(page.getByRole('heading', { name: 'Mi plan', exact: true })).toBeVisible();
  if (healthBody.planReading) await expect(page.getByTestId('new-plan')).toBeVisible();
  else await expect(page.getByTestId('new-plan')).toHaveCount(0);
  const active = pull.changes.plans!.find((plan) => plan.status === 'active')!;
  const original = await context.request.get(`${ORIGIN}/api/plans/${active.id}/files/0`);
  expect(original.status()).toBe(200);
  expect(original.headers()['x-original-type']).toBe('application/pdf');
  const bytes = Buffer.from(await original.text(), 'base64');
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  if (active.id === 'plan-2026-10-08')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      createHash('sha256').update(readFileSync('private/plans/2026-10-08.pdf')).digest('hex'),
    );
  await page.goto(ORIGIN);
  await expect(page.locator('[data-card]')).toBeVisible();
  console.log('✓ Live Describe preview without logging; original PDF is authenticated and intact');

  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  await expect(page.getByTestId('kitchen')).toBeVisible();
  await expect(page.getByTestId('pantry-input')).toBeEditable();
  await page.getByRole('tab', { name: /^Lista/ }).click();
  await expect(page.getByRole('tab', { name: /^Lista/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Platos', exact: true }).click();
  await expect(page.getByTestId('dishes')).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  console.log('✓ Kitchen, dishes and shopping-list views render with inventory writes and AI blocked');

  // Day navigation: yesterday opens as an editable day, then back to today.
  const yesterday = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLButtonElement>('[data-day]')];
    const today = cells.findIndex((c) => c.getAttribute('aria-current') === 'date');
    return today > 0 ? cells[today - 1]?.dataset.day : null;
  });
  if (yesterday) {
    await page.locator(`[data-day="${yesterday}"]`).click();
    await expect(page.getByRole('heading', { name: 'Ayer', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ir a hoy' }).click();
    await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Jardín', exact: true }).click();
  await expect(page.getByTestId('garden')).toBeVisible();
  await expect(page.getByTestId('herbarium')).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  console.log('✓ Day strip navigation and the garden render');

  await page.goto(`${ORIGIN}/progreso`);
  await expect(page.getByTestId('weight-section')).toBeVisible();
  await expect(page.getByTestId('plan-signal')).toBeVisible();
  await page.getByRole('button', { name: 'Para tu nutri', exact: true }).click();
  await expect(page.getByTestId('story-share')).toBeEnabled();
  mkdirSync('private/tmp', { recursive: true });
  await page
    .getByRole('img', { name: 'Para tu nutri', exact: true })
    .screenshot({ path: 'private/tmp/production-report.png' });
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto(`${ORIGIN}/progreso/ajustes`);
  await expect(page.getByTestId('notification-settings')).toBeVisible();
  console.log('✓ Progress weight/report PNG and notification settings render without changing owner records');
  await page.goto(ORIGIN);
  await expect(page.locator('[data-card]')).toBeVisible();

  if (photoPath) {
    mkdirSync('private/tmp', { recursive: true });
    await page.getByTestId('describe-open').click();
    await expect(page.getByTestId('dictate')).toBeVisible();
    await page.getByTestId('photo-input').setInputFiles(photoPath);
    await expect(page.getByText('Revisa lo detectado antes de anotar.')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('describe-input')).not.toHaveValue('');
    await expect(page.getByTestId('preview')).toContainText('aprox.');
    await page.screenshot({ path: 'private/tmp/production-photo-preview.png', fullPage: true });
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByTestId('describe-open').click();
    // Typing alone triggers both: JEV names the food groups at once, the meal AI counts portions after a pause.
    const classifyResponse = page.waitForResponse((response) => response.url().endsWith('/api/ai/classify'));
    const parseResponse = page.waitForResponse((response) => response.url().endsWith('/api/ai/parse'));
    await page.getByTestId('describe-input').fill('3 tacos de bistec');
    const classified = await classifyResponse;
    expect(classified.status(), 'JEV classify (JEV_API_KEY secret)').toBe(200);
    console.log(`✓ JEV groups: ${JSON.stringify(((await classified.json()) as { items: unknown[] }).items)}`);
    expect((await parseResponse).status()).toBe(200);
    await expect(page.getByTestId('preview')).toContainText('3 tortillas', { timeout: 30000 });
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    const after: PullResponse = await (await context.request.get(`${ORIGIN}/api/sync?since=0`)).json();
    expect(after.changes.logs ?? []).toEqual(pull.changes.logs ?? []);
    expect(after.changes.recipes).toEqual(pull.changes.recipes);
    console.log(
      '✓ Actual production photo and street-food text → JEV + OpenRouter → preview → close; meals/recipes unchanged',
    );
  }

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-card]')).toBeVisible();
  await expect(page.locator('[data-slot]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  await expect(page.getByTestId('pantry-input')).toBeEditable();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  mkdirSync('private/tmp', { recursive: true });
  await page.screenshot({ path: 'private/tmp/production-today.png', fullPage: true });
  console.log('✓ Production shell, plan and meal slots render offline after reload');
  expect(errors).toEqual([]);
} finally {
  await context.setOffline(false);
  await context.request.post(`${ORIGIN}/api/auth/logout`, { headers: { 'X-Fichas': '1' } });
  await browser.close();
}
