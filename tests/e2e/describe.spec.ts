import { expect, type Page, test } from '@playwright/test';
import type { LogRow } from '../../src/shared/domain/types';
import { checkBudget, dayFor, newPage, openToday, RUNS, Taps, toast, warm } from './helpers';

const meal = {
  title: 'Tacos de pollo',
  confidence: 'medium',
  source: 'ai',
  ms: 120,
  items: [
    {
      label: '3 tortillas',
      qty: 3,
      unit: 'pza',
      equivalent_id: 'carb_sg.tortilla_de_maiz',
      units: { carb_sg: 3 },
      estimated: false,
      assumed_qty: false,
      free: false,
    },
    {
      label: '120 g pollo',
      qty: 120,
      unit: 'g',
      equivalent_id: 'protein_poa.pollo',
      units: { protein_poa: 4 },
      estimated: false,
      assumed_qty: true,
      free: false,
    },
    {
      label: '1 manzana',
      qty: 1,
      unit: 'pza',
      equivalent_id: 'fruit.manzana',
      units: { fruit: 1 },
      estimated: false,
      assumed_qty: true,
      free: false,
    },
    {
      label: '1 tz verdura cocida',
      qty: 1,
      unit: 'tza',
      equivalent_id: 'veg.verdura_cocida',
      units: { veg: 2 },
      estimated: false,
      assumed_qty: true,
      free: false,
    },
    {
      label: '2 cdta aceite vegetal',
      qty: 2,
      unit: 'cdta',
      equivalent_id: 'fat_sp.aceite_vegetal',
      units: { fat_sp: 2 },
      estimated: false,
      assumed_qty: true,
      free: false,
    },
  ],
};

async function rows(page: Page, table = 'logs'): Promise<LogRow[]> {
  return page.evaluate(
    (table) =>
      new Promise<LogRow[]>((resolve) => {
        const r = indexedDB.open('fichas');
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction(table).objectStore(table).getAll();
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
        };
      }),
    table,
  );
}

const LUNCH = '3 tortillas, 120 g pollo, 1 manzana, 1 tz verdura y 2 cdta aceite';

test('A5 · describe and log: the app shows it understood at once, AI fills portions (2 taps + input)', async ({
  context,
}, info) => {
  const times: number[] = [];
  const previews: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 5, i);
    const page = await newPage(context, day, '17:20');
    await openToday(page);
    await page.route('**/api/ai/classify', (route) =>
      route.fulfill({
        json: {
          items: [{ text: '3 tacos de pollo de la calle', food: 0.97, free: false, groups: ['carb', 'protein'] }],
        },
      }),
    );
    await page.route('**/api/ai/parse', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      await route.fulfill({ json: meal });
    });
    const taps = new Taps();
    const start = Date.now();
    await taps.tap(page.getByTestId('describe-open'));
    await page.getByTestId('describe-input').fill('3 tacos de pollo de la calle');
    const previewStart = Date.now();
    // Live understanding: the phrase shows at once with its food groups, then real portions replace it.
    const phrase = page.getByTestId('pending-phrase');
    await expect(phrase).toBeVisible({ timeout: 300 });
    await expect(phrase.locator('svg.sprite')).toHaveCount(2);
    await expect(page.getByTestId('preview').locator('li')).toHaveCount(5);
    previews.push(Date.now() - previewStart);
    await expect(page.getByTestId('status-line')).toContainText('de más en tu comida');
    await taps.tap(page.getByTestId('log'));
    await expect(toast(page)).toBeVisible();
    times.push(Date.now() - start);
    expect(taps.n).toBe(2);
    const logs = (await rows(page)).filter((l) => l.day === day && !l.deleted_at);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.title).toBe('Tacos de pollo');
    await page.close();
  }
  checkBudget('A5', times, 10_000, 15_000);
  checkBudget('Preview', previews, 2500, 4500);
});

test('A6 · check a craving before eating: nothing is logged; "Me late" saves it for the meal', async ({
  context,
}, info) => {
  const day = dayFor(info, 6);
  const page = await newPage(context, day, '16:30');
  await openToday(page);
  await page.getByTestId('craving').click();
  await expect(page.getByRole('dialog')).toContainText('¿Qué se te antoja?');
  await page.getByTestId('describe-input').fill(LUNCH);
  await expect(page.getByTestId('impact')).toContainText('Así quedaría tu día');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await rows(page)).filter((l) => l.day === day && !l.deleted_at)).toHaveLength(0);
  await page.getByTestId('craving').click();
  await page.getByTestId('describe-input').fill(LUNCH);
  await page.getByTestId('log').click();
  await expect(page.getByTestId('suggestion')).toContainText('Planeado');
  expect((await rows(page)).filter((l) => l.day === day && !l.deleted_at)).toHaveLength(0);
});

test('A7 · "Ajustar" makes a craving exact (1 tap) and highlights what changed', async ({ context }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 7, i), '16:30');
    await openToday(page);
    await page.getByTestId('craving').click();
    await page.getByTestId('describe-input').fill(LUNCH);
    await expect(page.getByTestId('status-line')).toContainText('de más en tu comida');
    await expect(page.getByTestId('impact')).toContainText('Con 2 tortillas queda justo.');
    const taps = new Taps();
    const start = Date.now();
    await taps.tap(page.getByTestId('fit'));
    await expect(page.getByTestId('status-line')).toHaveText('Justo lo de tu comida');
    await expect(page.getByTestId('preview').locator('.highlight').first()).toContainText('2 tortillas');
    times.push(Date.now() - start);
    expect(taps.n).toBe(1);
    await page.close();
  }
  checkBudget('A7', times, 1000, 2000);
});

test('known text stays local; free food never resolves a meal', async ({ context }, info) => {
  const day = dayFor(info, 80);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  let calls = 0;
  await page.route('**/api/ai/parse', async (route) => {
    calls++;
    await route.abort();
  });
  await page.getByTestId('describe-open').click();
  await page.getByTestId('describe-input').fill('café negro');
  await expect(page.getByTestId('status-line')).toContainText('Libre');
  await page.getByTestId('log').click();
  await expect(toast(page)).toBeVisible();
  expect(calls).toBe(0);
  expect((await rows(page)).find((l) => l.day === day)?.kind).toBe('free');
  await expect(page.locator('[data-card]')).toContainText('Comida');
});

test.describe('offline deferred descriptions', () => {
  test.use({ serviceWorkers: 'allow' });
  test('occasion survives reopening and reconnect updates the same row in D1', async ({ context }, info) => {
    test.skip(info.project.name !== 'pixel', 'Offline SW replay is verified on Chromium');
    const day = dayFor(info, 81);
    const page = await newPage(context, day, '17:20');
    await openToday(page);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    );
    await page.waitForTimeout(1500);
    await context.setOffline(true);
    await page.getByTestId('describe-open').click();
    const text = `una torta de la calle, ${'frijoles y verduras, '.repeat(15)}sin queso`;
    await page.getByTestId('describe-input').fill(text);
    await page.getByTestId('log').click();
    await expect(toast(page)).toContainText('Sin internet');
    const before = (await rows(page)).find((l) => l.day === day)!;
    expect(before.title).toBe(text);
    expect(before.items).toEqual([]);
    expect(before.raw_units).toEqual({});
    await page.reload();
    await expect(page.locator('[data-slot=comida]').getByRole('img', { name: 'Anotado', exact: true })).toBeVisible();
    // Reconstruct the queue from the synced row, as a second device would.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const request = indexedDB.open('fichas');
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('pending', 'readwrite');
            tx.objectStore('pending').clear();
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
    );
    await page.route('**/api/ai/parse', (route) => {
      expect(route.request().postDataJSON().text).toBe(text);
      expect(route.request().postDataJSON().plan_id).toBe(before.plan_id);
      return route.fulfill({ json: meal });
    });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(async () => (await rows(page)).find((l) => l.id === before.id)?.items.length).toBe(5);
    const after = (await rows(page)).find((l) => l.id === before.id)!;
    expect(after.day).toBe(before.day);
    expect(after.plan_id).toBe(before.plan_id);
    expect(after.target).toEqual(before.target);
    expect(after.eaten_at).toBe(before.eaten_at);
    expect((await rows(page)).filter((l) => l.day === day)).toHaveLength(1);
    expect(await rows(page, 'pending')).toHaveLength(0);
    await expect
      .poll(
        async () => {
          const body = await (await page.request.get('/api/sync?since=0')).json();
          return body.changes.logs?.find((l: LogRow) => l.id === before.id)?.items;
        },
        { timeout: 15000 },
      )
      .toBe(JSON.stringify(after.items));
  });
});

test('undo before a deferred parse finishes cannot resurrect the meal', async ({ context }, info) => {
  const day = dayFor(info, 82);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  await warm(page);
  await context.setOffline(true);
  await page.getByTestId('describe-open').click();
  await page.getByTestId('describe-input').fill('una torta de la calle');
  await page.getByTestId('log').click();
  await expect(toast(page)).toBeVisible();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/ai/parse', async (route) => {
    await gate;
    await route.fulfill({ json: meal });
  });
  const request = page.waitForRequest('**/api/ai/parse');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await request;
  await page.getByRole('button', { name: 'Deshacer' }).click();
  release();
  await expect.poll(async () => (await rows(page)).filter((l) => l.day === day && !l.deleted_at).length).toBe(0);
  await expect.poll(async () => (await rows(page, 'pending')).length).toBe(0);
  await page.waitForTimeout(500);
  expect((await rows(page)).filter((l) => l.day === day && !l.deleted_at)).toHaveLength(0);
});
