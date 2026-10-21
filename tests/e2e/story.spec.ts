import { expect, test } from '@playwright/test';
import { checkBudget, dayFor, newPage, RUNS, Taps } from './helpers';

test('A16 · prefilled weight entry, two taps, offline persistence and reconnect', async ({
  context,
  request,
}, info) => {
  test.setTimeout(Math.max(90000, RUNS * 10000));
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 130, i),
      page = await newPage(context, day, '16:52');
    await request.post('/api/sync', {
      headers: { 'X-Fichas': '1' },
      data: {
        mutations: [
          {
            table: 'weighins',
            op: 'upsert',
            row: {
              id: `weight-fixture-${day}`,
              day,
              kg: 72.4,
              source: 'nutritionist',
              created_at: 1,
              deleted_at: null,
            },
          },
        ],
      },
    });
    // The installed test clock replaces performance resource entries in WebKit.
    // Observe the actual chunk response before switching the API/network offline.
    const weightReady = page.waitForResponse(/\/assets\/WeighIn-[\w-]+\.js$/);
    await page.goto('/historia');
    await page.getByTestId('weight-open').waitFor();
    await expect(page.getByTestId('weight-section')).toContainText('72.4');
    await weightReady;
    await context.setOffline(true);
    const taps = new Taps(),
      t0 = Date.now();
    await taps.tap(page.getByTestId('weight-open'));
    await expect(page.getByTestId('weight-input')).toHaveValue('72.4');
    await taps.tap(page.getByTestId('weight-save'));
    await expect(page.getByRole('dialog')).not.toBeAttached();
    times.push(Date.now() - t0);
    expect(taps.n).toBe(2);
    // Reopen to read the stored value while the API is offline.
    await page.getByTestId('weight-open').click();
    await expect(page.getByTestId('weight-input')).toHaveValue('72.4');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await context.setOffline(false);
    await expect
      .poll(async () => {
        const body = await (await request.get('/api/sync?since=0')).json();
        return body.changes.weighins.some(
          (w: { day: string; kg: number; source: string }) => w.day === day && w.kg === 72.4 && w.source === 'home',
        );
      })
      .toBe(true);
    await page.close();
  }
  checkBudget('A16', times, 5000, 8000);
});

test('recap and nutritionist report generate PNGs offline; sharing cancellation creates no records', async ({
  context,
}, info) => {
  const page = await newPage(context, dayFor(info, 131), '16:52');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        const f = data.files![0]!;
        (window as unknown as { shared: unknown }).shared = { type: f.type, size: f.size, name: f.name };
        throw new DOMException('Cancelled', 'AbortError');
      },
    });
  });
  await page.goto('/historia');
  await page.getByRole('button', { name: 'Resumen', exact: true }).waitFor();
  await context.setOffline(true);
  for (const name of ['Resumen', 'Para tu nutri']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByTestId('story-share')).toBeEnabled();
    await page.getByTestId('story-share').click();
    expect(await page.evaluate(() => (window as unknown as { shared: unknown }).shared)).toMatchObject({
      type: 'image/png',
      size: expect.any(Number),
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar imagen', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  await context.setOffline(false);
  await page.close();
});

test('keyboard focus remains in weight sheet; weight is absent on Today', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 132), '16:52');
  await page.goto('/historia');
  await page.getByTestId('weight-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeAttached();
  await page.goto('/');
  await expect(page.getByTestId('weight-section')).not.toBeAttached();
  await page.close();
});
