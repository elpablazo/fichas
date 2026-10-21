import { expect, type Page, test } from '@playwright/test';
import type { PlanDraftView } from '../../src/shared/api';
import { checkPlan, compareReads } from '../../src/shared/domain/plan-ingestion';
import { seedPlan } from '../plan-fixture';
import { checkBudget, dayFor, newPage, openToday, RUNS, Taps } from './helpers';

const PDF = { name: 'new-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsynthetic\n%%EOF') };
function ready(): PlanDraftView {
  return {
    draft_id: 'mock-draft',
    status: 'draft',
    plan: structuredClone(seedPlan),
    report: {
      state: 'ready',
      files: [{ name: 'new-plan.pdf', type: 'application/pdf', size: PDF.buffer.length, sha256: 'a'.repeat(64) }],
      disagreements: [],
      warnings: checkPlan(seedPlan),
      single_read: false,
      models: [
        { model: 'reader-a', ms: 200, ok: true },
        { model: 'reader-b', ms: 200, ok: true },
      ],
    },
  };
}
async function mockPlans(
  page: Page,
  result = ready(),
  options: { resume?: boolean; duplicate?: boolean; fail?: boolean; background?: boolean } = {},
) {
  let done = options.resume ?? false;
  let confirmed = false;
  let started = false;
  let discarded = false;
  const reading = { ...result, plan: undefined, report: { ...result.report!, state: 'reading' } };
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, version: 'test', planReading: true } }));
  await page.route('**/api/plans/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/latest'))
      return route.fulfill({
        json: discarded ? { draft_id: null } : done ? result : started ? reading : { draft_id: null },
      });
    if (path.endsWith('/drafts'))
      return options.duplicate
        ? route.fulfill({ status: 409, json: { duplicate_id: 'plan-2026-10-08' } })
        : route.fulfill({ status: 201, json: { draft_id: 'mock-draft' } });
    if (path.includes('/files/')) {
      expect(route.request().headers()['content-type']).toBe('text/plain');
      expect(route.request().postData()).toBe(PDF.buffer.toString('base64'));
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/parse')) {
      if (options.background) {
        started = true;
        setTimeout(() => {
          done = true;
        }, 2000);
        return route.fulfill({ status: 202, json: reading });
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      done = true;
      return route.fulfill({
        json: options.fail ? { ...result, plan: undefined, report: { ...result.report, state: 'error' } } : result,
      });
    }
    if (path.endsWith('/confirm')) {
      confirmed = true;
      return route.fulfill({ json: { season: 2, plan: route.request().postDataJSON().plan } });
    }
    if (path.endsWith('/discard')) discarded = true;
    return route.fulfill({ status: 204 });
  });
  return () => confirmed;
}

test('A17 · upload → review → confirm (≤ 6 taps + review)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 90, i), '16:52');
    const confirmed = await mockPlans(page);
    await openToday(page);
    await page.goto('/historia/plan');
    await page.getByTestId('new-plan').waitFor();
    const taps = new Taps();
    const start = Date.now();
    await taps.tap(page.getByTestId('new-plan'));
    await page.getByTestId('plan-input').setInputFiles(PDF);
    await expect(page.getByTestId('plan-progress')).toBeVisible();
    await page.getByTestId('plan-review').waitFor();
    await taps.tap(page.getByRole('checkbox', { name: 'Revisé las porciones señaladas.' }));
    await taps.tap(page.getByTestId('confirm-plan'));
    await expect(page.locator('[data-card]')).toBeVisible();
    expect(confirmed()).toBe(true);
    times.push(Date.now() - start);
    expect(taps.n + 1, 'including OS file selection').toBeLessThanOrEqual(6);
    await page.close();
  }
  checkBudget('A17 (mock readers)', times, 90_000, 180_000);
});

test('resume a draft; resolve each disagreement before confirmation', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 91), '16:52');
  const d = ready();
  const b = structuredClone(d.plan!);
  b.slots[2]!.target.carb_sg = 3;
  d.report!.disagreements = compareReads(d.plan!, b);
  await mockPlans(page, d, { resume: true });
  await page.goto('/historia/plan/nuevo');
  await page.getByTestId('plan-review').waitFor();
  await expect(page.getByTestId('confirm-plan')).toBeDisabled();
  await expect(page.getByTestId('plan-blockers')).toContainText('Faltan 1 por decidir');
  await page.getByTestId('plan-disagreement').getByRole('button').last().click();
  await page.getByRole('checkbox', { name: 'Revisé las porciones señaladas.' }).check();
  await expect(page.getByTestId('confirm-plan')).toBeEnabled();
  await expect(page.getByTestId('plan-review')).toContainText('2 → 3');
  const confirm = page.waitForRequest('**/api/plans/mock-draft/confirm');
  await page.getByTestId('confirm-plan').click();
  const request = await confirm;
  expect(request.postDataJSON().plan.slots[2].target.carb_sg).toBe(3);
  expect(request.postDataJSON().resolutions).toEqual({ 'slots.2.target.carb_sg': 'b' });
});

test('duplicate upload links to the existing plan', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 92), '16:52');
  await mockPlans(page, ready(), { duplicate: true });
  await page.goto('/historia/plan/nuevo');
  await page.getByTestId('plan-input').setInputFiles(PDF);
  await expect(page.getByText('Ya tienes este plan.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi plan', exact: true })).toBeVisible();
});

test('a background read resumes after leaving the screen', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 94), '16:52');
  await mockPlans(page, ready(), { background: true });
  await page.goto('/historia/plan/nuevo');
  await page.getByTestId('plan-input').setInputFiles(PDF);
  await expect(page.getByTestId('plan-progress')).toContainText('Leyendo');
  await page.getByRole('button', { name: 'Mi plan', exact: true }).click();
  await page.getByTestId('new-plan').click();
  await expect(page.getByTestId('plan-review')).toBeVisible();
});

test('reader failure offers retry and discard without activating the draft', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 95), '16:52');
  const failed = ready();
  failed.plan = undefined;
  failed.report!.state = 'error';
  const confirmed = await mockPlans(page, failed, { resume: true, fail: true });
  await page.goto('/historia/plan/nuevo');
  await expect(page.getByRole('button', { name: 'Otra vez', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByTestId('upload-plan')).toBeVisible();
  expect(confirmed()).toBe(false);
});

test('confirmed changed targets automatically re-portion the suggestion and keep past targets', async ({
  context,
}, info) => {
  const day = dayFor(info, 93);
  const page = await newPage(context, day, '16:30');
  await openToday(page);
  await page.route('**/api/sync?*', (r) => r.fulfill({ json: { rev: 999999, more: false, changes: {} } }));
  await page.evaluate(
    ({ day, data }) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open('fichas');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['plans', 'recipes'], 'readwrite');
          const store = tx.objectStore('plans');
          const recipes = tx.objectStore('recipes');
          const dishes = recipes.getAll();
          dishes.onsuccess = () => {
            // Start with the nutritionist's usual two-tortilla dish, independent of other test logs.
            for (const recipe of dishes.result) if (recipe.origin !== 'seed') recipes.delete(recipe.id);
          };
          const read = store.get('plan-2026-10-08');
          read.onsuccess = () => {
            const old = read.result;
            store.put({ ...old, status: 'archived', ends_on: `${day.slice(0, 8)}01`, updated_at: Date.now() });
            const next = structuredClone(data);
            next.slots[2]!.target.carb_sg = 3;
            store.put({
              ...old,
              id: 'next-plan',
              season: 2,
              status: 'active',
              data: next,
              starts_on: day,
              ends_on: null,
              updated_at: Date.now(),
              confirmed_at: Date.now(),
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    { day, data: seedPlan },
  );
  await page.reload();
  // Before lunch the idea is the nutritionist's dish, re-portioned to the new plan's three tortillas.
  await expect(page.getByTestId('suggestion')).toContainText('3 tortillas');
  await page.goto('/historia/plan/plan-2026-10-08');
  await expect(page.getByRole('heading', { name: 'Mi plan', exact: true })).toBeVisible();
  const lunch = page.locator('section[aria-label="Tus tiempos"] > div').filter({ hasText: 'Comida' });
  await expect(lunch.locator('.tok').filter({ hasText: '🫓' })).toHaveCount(2);
});
