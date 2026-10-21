import { expect, test } from '@playwright/test';
import { addDays } from '../../src/shared/domain/day';
import { buildLog } from '../../src/shared/domain/log';
import type { LogRow } from '../../src/shared/domain/types';
import { seedPlan } from '../plan-fixture';
import { checkBudget, dayFor, dismissRenewal, newPage, openToday, RUNS, Taps } from './helpers';

const log = (day: string, slot: string, _items: unknown[], extra: Partial<LogRow>) => ({
  ...buildLog({
    id: 'fixture',
    plan_id: 'plan-2026-10-08',
    plan: seedPlan,
    rules: seedPlan.swaps,
    day,
    slot,
    title: 'Comida',
    items: [],
    source: 'suggestion',
    now: Date.parse(`${day}T18:00Z`),
    target: seedPlan.slots.find((s) => s.key === slot)?.target ?? {},
    slotLogs: [],
  }),
  ...extra,
});

test('A14 · accept tomorrow in one tap; menu persists and feeds the next day', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 60, i);
    const page = await newPage(context, day, '21:05');
    await openToday(page);
    await page.getByRole('button', { name: 'Cerrar el día', exact: true }).click();
    await page.getByTestId('accept-menu').waitFor();
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByTestId('accept-menu'));
    await expect(page.getByTestId('tomorrow')).not.toBeAttached();
    times.push(Date.now() - t0);
    expect(taps.n).toBe(1);
    await page.clock.setSystemTime(new Date(`${addDays(day, 1)}T16:52:00-06:00`));
    await page.reload();
    await page.getByTestId('ate').waitFor();
    await expect(page.locator('[data-card]')).toContainText('planeado');
    await page.close();
  }
  checkBudget('A14', times, 3000, 5000);
});

test('A15 · backfill one meal with one tap, correct day/plan/target, no duplicate on reload', async ({
  context,
  request,
}, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 61, i);
    const page = await newPage(context, day, '16:52');
    await openToday(page);
    // Renewal has higher priority; dismiss it for this app day to reach the recovery card.
    await dismissRenewal(page);
    await page.getByTestId('backfill').waitFor();
    const firstSlot = await page.getByTestId('backfill-slot').innerText();
    const taps = new Taps();
    const t0 = Date.now();
    await taps.tap(page.getByRole('button', { name: 'Lo de siempre', exact: true }));
    await expect(page.getByTestId('backfill-slot')).not.toHaveText(firstSlot);
    times.push(Date.now() - t0);
    expect(taps.n).toBe(1);
    await page.reload();
    await page.getByTestId('backfill').waitFor();
    await expect(page.getByTestId('backfill-slot')).not.toHaveText(firstSlot);
    const pull = async () => await (await request.get('/api/sync?since=0')).json();
    await expect
      .poll(async () => {
        const body = await pull();
        return (body.changes.logs ?? []).filter(
          (l: { day: string; source: string; deleted_at: number | null }) =>
            l.day === addDays(day, -1) && l.source === 'backfill' && !l.deleted_at,
        ).length;
      })
      .toBe(1);
    const body = await pull();
    const row = body.changes.logs.find(
      (l: { day: string; source: string }) => l.day === addDays(day, -1) && l.source === 'backfill',
    );
    expect(row.plan_id).toBe('plan-2026-10-08');
    expect(row.slot).toBe('desayuno');
    expect(JSON.parse(row.target).carb_sg).toBeGreaterThan(0);
    await page.close();
  }
  checkBudget('A15', times, 2000, 4000);
});

test('progress and stamps persist after undo; favorites and only unlocked styles are usable', async ({
  context,
}, info) => {
  const page = await newPage(context, dayFor(info, 62), '16:52');
  await openToday(page);
  await page.getByTestId('ate').click();
  await page.waitForTimeout(1400); // rewards are persisted after the immediate food feedback
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.getByRole('button', { name: 'Jardín', exact: true }).click();
  await expect(page.getByTestId('garden')).toBeVisible();
  const xp = await page.getByTestId('xp').innerText();
  await page.reload();
  await expect(page.getByTestId('xp')).toHaveText(xp);
  await page.getByRole('button', { name: /estampas$/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Primer bocado');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Estilo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rosa mexicano', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  await page.getByRole('tab', { name: 'Platos', exact: true }).click();
  const favorite = page.getByRole('button', { name: /^Favorito:/ }).first();
  if (await favorite.isVisible()) {
    const before = await favorite.getAttribute('aria-pressed');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  }
});

test('automatic day close after 21:30 preserves undo and opens once per app day', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 64), '21:45');
  await openToday(page);
  await page.getByTestId('ate').click();
  await page.getByRole('dialog', { name: 'Cerrar el día', exact: true }).waitFor();
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByTestId('ate').waitFor();
  await page.waitForTimeout(1600);
  await expect(page.getByRole('dialog')).not.toBeAttached();
});

test('resolving the last planned slot automatically opens the flower even before evening', async ({
  context,
  request,
}, info) => {
  const day = dayFor(info, 65);
  const page = await newPage(context, day, '16:52');
  await openToday(page);
  const rows = seedPlan.slots.map((s, i) => ({
    ...log(day, s.key, [], { kind: 'skip', raw_units: {}, units: {}, status: 'skip' }),
    id: `resolve-${day}-${i}`,
  }));
  const response = await request.post('/api/sync', {
    headers: { 'X-Fichas': '1' },
    data: { mutations: rows.map((row) => ({ table: 'logs', op: 'upsert', row })) },
  });
  expect(response.status()).toBe(200);
  await page.reload();
  await page.getByRole('dialog', { name: 'Cerrar el día', exact: true }).waitFor();
  // The day's own plant comes first; the week of plants follows it.
  await expect(page.getByRole('dialog').locator('[data-flower=bud]').first()).toBeVisible();
});

test('flower snapshots: partial/full/gold/bud/skip/seed, light and dark', async ({ context }, info) => {
  const day = '2026-10-12';
  const page = await newPage(context, day, '16:52');
  await openToday(page);
  // Use a deterministic private local fixture; POST sync is blocked before inserting it.
  await page.route('**/api/sync', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 503, body: '{}' }) : route.continue(),
  );
  const ls = ['2026-10-08', '2026-10-09'].flatMap((d) => {
    const slots = ['desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena'];
    return slots.map((s, i) => ({
      ...log(d, s, [], {
        kind: 'meal',
        raw_units: { carb_sg: 1 },
        units: { carb_sg: 1 },
        target: { carb_sg: 1 },
        status: 'on',
      }),
      id: `visual-${d}-${i}`,
    }));
  });
  ls.push(
    {
      ...log('2026-10-10', 'comida', [], {
        kind: 'meal',
        raw_units: { carb_sg: 2 },
        units: { carb_sg: 2 },
        target: { carb_sg: 2 },
        status: 'on',
      }),
      id: 'visual-partial',
    },
    { ...log('2026-10-10', 'cena', [], { kind: 'skip' }), id: 'visual-skip' },
  );
  ls[0] = { ...ls[0]!, raw_units: { carb_sg: 0.1 }, target: { carb_sg: 1 } };
  await page.evaluate(async (rows) => {
    const request = indexedDB.open('fichas');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['logs'], 'readwrite');
    tx.objectStore('logs').clear();
    for (const row of rows) tx.objectStore('logs').put(row);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, ls);
  await page.reload();
  await page.getByTestId('ate').waitFor();
  await page.getByRole('button', { name: 'Jardín', exact: true }).click();
  await page.getByTestId('garden').waitFor();
  // Two full days bloom; the day with one meal and a skip stays a bud (never wilted).
  await expect(page.getByTestId('garden').locator('[data-flower=flower]')).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await expect(page.getByTestId('garden')).toHaveScreenshot('garden-light.png', { animations: 'disabled' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('garden')).toHaveScreenshot('garden-dark.png', { animations: 'disabled' });
  await page.screenshot({ path: `private/tmp/garden-${info.project.name}.png`, fullPage: true });
});

test.describe('offline game loop', () => {
  test.use({ serviceWorkers: 'allow' });
  test('day close and backfill survive offline reopening without network', async ({ context }, info) => {
    test.skip(
      info.project.name === 'iphone',
      'WebKit Playwright does not run the service-worker offline shell; Chromium covers it.',
    );
    const day = dayFor(info, 63);
    const page = await newPage(context, day, '21:05');
    await openToday(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.getByTestId('ate').waitFor();
    await dismissRenewal(page);
    await page.getByTestId('backfill').waitFor();
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Lo de siempre', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar el día', exact: true }).click();
    await page.getByTestId('accept-menu').click();
    await page.reload();
    await page.getByTestId('ate').waitFor();
    await expect(page.getByRole('dialog')).not.toBeAttached();
    await context.setOffline(false);
  });
});

test('Today stays within 20 visible words with the recovery card', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 66), '20:15');
  await openToday(page);
  await dismissRenewal(page);
  await page.getByTestId('backfill').waitFor();
  const words = await page.locator('main').evaluate((main) => {
    const clone = main.cloneNode(true) as HTMLElement;
    // Excluded by the budget (§14.3): food names, slot labels and times, numbers, emoji, weekday initials.
    for (const el of clone.querySelectorAll(
      '.sr-only, [data-nowords], [data-card] h2, [data-testid=suggestion-title], [data-card] .secondary, [data-slot] .font-bold, [data-slot] .secondary, [data-slot] .caption, [data-testid=backfill-slot]',
    ))
      el.remove();
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? '');
    return texts.join(' ').match(/\p{L}+/gu) ?? [];
  });
  expect(words.length, words.join(' ')).toBeLessThanOrEqual(20);
});
