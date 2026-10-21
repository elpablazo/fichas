// M1 interaction budgets (§14.2): A1–A4, A8–A11, A20, plus offline logging.
import { expect, test } from '@playwright/test';
import { checkBudget, dayFor, fx, newPage, openToday, popLatency, RUNS, Taps, toast } from './helpers';

const LUNCH = '16:52';

test('A1 · open shows the current meal, its tokens and a dish (0 taps)', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 1), LUNCH);
  await openToday(page); // cold: first pull fills IndexedDB and the snapshot
  await page.waitForTimeout(500);
  const times: number[] = [];
  for (let i = 0; i < Math.max(RUNS, 3); i++) {
    const t0 = Date.now();
    await page.reload();
    await page.locator('[data-card] [data-testid=ate]').waitFor();
    times.push(Date.now() - t0);
    const snapshotMs = await fx(page, (f) => (f.card ?? Number.POSITIVE_INFINITY) - (f.jsStart ?? 0));
    expect(snapshotMs, 'snapshot render after JS start').toBeLessThanOrEqual(300);
  }
  checkBudget('A1', times, 1000, 1500);
  await expect(page.locator('[data-card] h2')).toContainText('Comida');
  await expect(page.locator('[data-card] .tok')).toHaveCount(11);
  await expect(page.getByTestId('ate')).toBeVisible();
});

test('A2 · log the suggested meal (1 tap)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 2, i), LUNCH);
    await openToday(page);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('ate'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(await popLatency(page), 'tokens start animating').toBeLessThanOrEqual(100);
    expect(taps.n).toBe(1);
    await expect(page.locator('[data-card] h2')).toContainText('Colación', { timeout: 4000 });
    await expect(page.locator('[data-slot=comida] .tok-1')).toHaveCount(11);
    await page.close();
  }
  checkBudget('A2', times, 2000, 4000);
});

test('A3 · log the next suggestion after "Otra" (2 taps)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 3, i), LUNCH);
    await openToday(page);
    const first = await page.getByTestId('suggestion-title').innerText();
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('other'));
    const second = await page.getByTestId('suggestion-title').innerText();
    expect(second).not.toBe(first);
    await taps.tap(page.getByTestId('ate'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(await popLatency(page)).toBeLessThanOrEqual(100);
    expect(taps.n).toBe(2);
    await page.close();
  }
  checkBudget('A3', times, 4000, 6000);
});

test('A4 · log a recent dish from "Tus platos" (2 taps)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 4, i), LUNCH);
    await openToday(page);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-card] button').first()); // card header → meal sheet
    await taps.tap(page.getByTestId('dish').first());
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(await popLatency(page)).toBeLessThanOrEqual(100);
    expect(taps.n).toBe(2);
    await page.close();
  }
  checkBudget('A4', times, 5000, 8000);
});

test('A8 · undo the last log (1 tap), tokens revert at once', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 8, i), LUNCH);
    await openToday(page);
    await page.getByTestId('ate').click();
    const undo = page.getByRole('button', { name: 'Deshacer' });
    await undo.waitFor();
    await fx(page, (f) => {
      f.watchHollow = true;
    });
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(undo);
    await expect.poll(() => fx(page, (f) => f.hollow)).not.toBeNull();
    const revert = await fx(page, (f) => (f.hollow ?? Number.POSITIVE_INFINITY) - (f.taps[f.taps.length - 1] ?? 0));
    times.push(Date.now() - t0);
    expect(revert, 'tokens revert').toBeLessThanOrEqual(100);
    expect(taps.n).toBe(1);
    await expect(page.locator('[data-card] h2')).toContainText('Comida', { timeout: 3000 });
    await page.close();
  }
  checkBudget('A8', times, 1000, 2000);
});

test('A9 · change a portion of a logged meal (≤ 3 taps), tokens update live', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 9, i), LUNCH);
    await openToday(page);
    await page.getByTestId('ate').click();
    await expect(page.locator('[data-card] h2')).toContainText('Colación', { timeout: 4000 });
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-slot=comida] button').first());
    await taps.tap(page.getByTestId('logged-meal').getByRole('button', { name: /^Más:/ }).first());
    await expect(page.locator('[data-slot=comida] .tok-x').first()).toBeAttached();
    times.push(Date.now() - t0);
    expect(taps.n).toBeLessThanOrEqual(3);
    await page.close();
  }
  checkBudget('A9', times, 6000, 10000);
});

test('A10 · skip a meal (2 taps)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 10, i), LUNCH);
    await openToday(page);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-slot=desayuno] button').first());
    await taps.tap(page.getByTestId('skip'));
    await expect(page.locator('[data-slot=desayuno]')).toContainText('Te la saltaste');
    times.push(Date.now() - t0);
    expect(taps.n).toBe(2);
    await page.close();
  }
  checkBudget('A10', times, 3000, 5000);
});

test('A11 · add an extra from recents (3 taps)', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 11, i), LUNCH);
    await openToday(page);
    await page.getByTestId('ate').click(); // makes sure there is a recent dish
    await expect(toast(page)).toBeVisible();
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-slot=desayuno] button').first());
    await taps.tap(page.getByTestId('extra'));
    await taps.tap(page.getByTestId('dish').first());
    await expect(page.locator('[data-slot=extra]')).toBeVisible();
    times.push(Date.now() - t0);
    expect(taps.n).toBe(3);
    await page.close();
  }
  checkBudget('A11', times, 6000, 10000);
});

test('A20 · compose a new meal by hand (≤ 8 taps), tokens fill live', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 20, i), LUNCH);
    await openToday(page);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-card] button').first());
    await taps.tap(page.getByRole('button', { name: 'Armar', exact: true }));
    for (const food of ['tortilla de maíz', 'pollo', 'manzana', 'verdura cocida', 'aceite vegetal']) {
      await taps.tap(page.getByTestId('food').filter({ hasText: new RegExp(`^${food}$`) }));
    }
    await expect(page.getByTestId('status-line')).toHaveText(/Cabe exacto|Justo en tu plan/);
    await taps.tap(page.getByTestId('compose-log'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(taps.n).toBeLessThanOrEqual(8);
    await page.close();
  }
  checkBudget('A20', times, 15000, 25000);
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('airplane mode: open → log → reopen → still there; back online → in D1', async ({ context }, info) => {
    test.skip(info.project.name !== 'pixel', 'Service-worker offline replay is verified on Chromium');
    const day = dayFor(info, 30);
    const page = await newPage(context, day, LUNCH);
    await openToday(page);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    );
    await page.waitForTimeout(1500); // precache finished
    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('ate').waitFor();
    await page.getByTestId('ate').click();
    await expect(toast(page)).toBeVisible();
    await page.close();

    const again = await newPage(context, day, '17:30');
    await again.goto('/');
    await expect(again.locator('[data-slot=comida] .tok-1')).toHaveCount(11);
    await context.setOffline(false);
    await again.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect
      .poll(
        async () => {
          const res = await again.request.get('/api/sync?since=0');
          const body = (await res.json()) as { changes: { logs?: { day: string; slot: string }[] } };
          return (body.changes.logs ?? []).some((l) => l.day === day && l.slot === 'comida');
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});
