// Core loop budgets (docs/04-today-2.md §7): decide before a meal, write it down after, fix and undo.
import { expect, test } from '@playwright/test';
import { checkBudget, dayFor, describeAndLog, fx, newPage, openToday, popLatency, RUNS, Taps, toast } from './helpers';

/** Before lunch (17:00): the now card helps decide. */
const BEFORE = '16:30';
/** After lunch: the now card asks what was eaten. */
const AFTER = '17:20';
const LUNCH = '2 tortillas, 120 g pollo, 1 manzana, 1 tz verdura y 2 cdta aceite';

test('A1 · open shows "Tu día" and the meal that matters now (0 taps)', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 1), AFTER);
  await openToday(page); // cold: first pull fills IndexedDB and the snapshot
  await page.waitForTimeout(500);
  const times: number[] = [];
  for (let i = 0; i < Math.max(RUNS, 3); i++) {
    const t0 = Date.now();
    await page.reload();
    await page.locator('[data-card]').waitFor();
    times.push(Date.now() - t0);
    const snapshotMs = await fx(page, (f) => (f.card ?? Number.POSITIVE_INFINITY) - (f.jsStart ?? 0));
    expect(snapshotMs, 'snapshot render after JS start').toBeLessThanOrEqual(300);
  }
  checkBudget('A1', times, 1000, 1500);
  await expect(page.getByTestId('pace-title')).toHaveText('Día en blanco');
  await expect(page.getByTestId('day-meter').locator('.meter')).toHaveCount(7);
  await expect(page.locator('[data-card]')).toHaveAttribute('data-phase', 'log');
  await expect(page.locator('[data-card]')).toContainText('Comida');
  await expect(page.locator('[data-card] h2')).toHaveText('¿Qué comiste?');
});

test('A2 · before lunch: "Me late" saves the idea; after lunch it logs in 1 tap', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 2, i), BEFORE);
    await openToday(page);
    await expect(page.locator('[data-card]')).toHaveAttribute('data-phase', 'plan');
    const idea = await page.getByTestId('suggestion-title').innerText();
    await page.getByTestId('like').click();
    await expect(page.getByTestId('suggestion')).toContainText('Planeado');
    await page.clock.fastForward('50:00');
    await expect(page.locator('[data-card]')).toHaveAttribute('data-phase', 'log', { timeout: 5000 });
    await expect(page.getByTestId('suggestion-title')).toHaveText(idea);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('ate'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(await popLatency(page), 'the logged moment starts').toBeLessThanOrEqual(100);
    expect(taps.n).toBe(1);
    await expect(page.locator('[data-slot=comida]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-slot=comida]')).toContainText(idea);
    await page.close();
  }
  checkBudget('A2', times, 2000, 4000);
});

test('A3 · "Otra idea" shows a different real dish (1 tap)', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 3), BEFORE);
  await openToday(page);
  const first = await page.getByTestId('suggestion-title').innerText();
  await page.getByTestId('other').click();
  await expect(page.getByTestId('suggestion-title')).not.toHaveText(first);
});

test('A4 · write what was eaten and log it (2 taps + text), live preview without AI', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 4, i), AFTER);
    await openToday(page);
    await page.route('**/api/ai/**', (route) => route.abort());
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('now-describe'));
    await page.getByTestId('describe-input').fill(LUNCH);
    await expect(page.getByTestId('preview').locator('li')).toHaveCount(5);
    await expect(page.getByTestId('status-line')).toHaveText('Justo lo de tu comida');
    await taps.tap(page.getByTestId('log'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - t0);
    expect(await popLatency(page)).toBeLessThanOrEqual(100);
    expect(taps.n).toBe(2);
    await expect(page.locator('[data-slot=comida]')).toContainText('En plan');
    await page.close();
  }
  checkBudget('A4', times, 5000, 8000);
});

test('A8 · undo the last log (1 tap), the meal reopens at once', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 8, i), AFTER);
    await openToday(page);
    await page.getByTestId('now-describe').click();
    await describeAndLog(page, LUNCH);
    const undo = page.getByRole('button', { name: 'Deshacer' });
    await undo.waitFor();
    await expect(page.locator('[data-slot=comida]')).toHaveAttribute('data-state', 'done');
    await fx(page, (f) => {
      f.watchHollow = true;
    });
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(undo);
    await expect.poll(() => fx(page, (f) => f.hollow)).not.toBeNull();
    const revert = await fx(page, (f) => (f.hollow ?? Number.POSITIVE_INFINITY) - (f.taps[f.taps.length - 1] ?? 0));
    times.push(Date.now() - t0);
    expect(revert, 'meal reopens').toBeLessThanOrEqual(100);
    expect(taps.n).toBe(1);
    await expect(page.locator('[data-card]')).toContainText('Comida', { timeout: 3000 });
    await page.close();
  }
  checkBudget('A8', times, 1000, 2000);
});

test('A9 · change a portion of a logged meal (≤ 3 taps), the verdict updates live', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 9, i), AFTER);
    await openToday(page);
    await page.getByTestId('now-describe').click();
    await describeAndLog(page, LUNCH);
    await expect(page.locator('[data-slot=comida]')).toContainText('En plan');
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.locator('[data-slot=comida] button').first());
    await taps.tap(page.getByTestId('logged-meal').getByRole('button', { name: /^Editar:.*tortilla/ }));
    await taps.tap(page.getByTestId('logged-meal').getByRole('button', { name: /^Más:.*tortilla/ }));
    await expect(page.locator('[data-slot=comida]')).toContainText('de más');
    times.push(Date.now() - t0);
    expect(taps.n).toBeLessThanOrEqual(3);
    await page.close();
  }
  checkBudget('A9', times, 6000, 10000);
});

test('A10 · skip a meal (1 tap from the now card, 2 from the list)', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 10), AFTER);
  await openToday(page);
  const taps = new Taps();
  await taps.tap(page.locator('[data-card]').getByTestId('skip'));
  await expect(page.locator('[data-slot=comida]')).toContainText('Te la saltaste');
  await taps.tap(page.locator('[data-slot=desayuno] button').first());
  await taps.tap(page.getByRole('dialog').getByTestId('skip'));
  await expect(page.locator('[data-slot=desayuno]')).toContainText('Te la saltaste');
  expect(taps.n).toBe(3);
});

test('A11 · add an extra (1 tap + text)', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 11), AFTER);
  await openToday(page);
  await page.getByTestId('extra-row').click();
  await expect(page.getByTestId('slot-pick')).toContainText('Extra');
  await describeAndLog(page, '1 manzana');
  await expect(page.locator('[data-slot=extra]')).toContainText('Manzana');
});

test('A20 · compose a new meal by hand (≤ 8 taps), the verdict fills live', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 20, i), AFTER);
    await openToday(page);
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('now-describe'));
    await taps.tap(page.getByTestId('compose'));
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
    const page = await newPage(context, day, AFTER);
    await openToday(page);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    );
    await page.waitForTimeout(1500); // precache finished
    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('now-describe').click();
    await describeAndLog(page, LUNCH);
    await expect(toast(page)).toBeVisible();
    await page.close();

    const again = await newPage(context, day, '17:40');
    await again.goto('/');
    await expect(again.locator('[data-slot=comida]')).toHaveAttribute('data-state', 'done');
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
