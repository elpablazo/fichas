import { expect, test } from '@playwright/test';
import { dayFor, newPage, openToday } from './helpers';

test('snapshot keeps the meal position while the recovery card hydrates', async ({ context }) => {
  // The current fixture starts yesterday, so an unresolved recovery card exists.
  const page = await newPage(context, '2026-10-09', '14:00');
  await openToday(page);
  await expect(page.getByTestId('backfill')).toBeVisible();
  await page.waitForFunction(() => {
    const layout = JSON.parse(localStorage.getItem('today:layout') ?? 'null');
    return layout && layout.bannerHeight > 0 && localStorage.getItem('today:snapshot');
  });
  const before = await page.locator('[data-card]').boundingBox();
  expect(before).not.toBeNull();

  let allowPull: () => void = () => {};
  const pullGate = new Promise<void>((resolve) => {
    allowPull = resolve;
  });
  await page.route('**/api/sync?*', async (route) => {
    await pullGate;
    await route.continue();
  });
  try {
    await page.reload();
    await expect(page.locator('[data-card] [data-testid=ate]')).toBeVisible();
    // This readable snapshot must keep the prior compact card and reserved banner space,
    // even before the first pull permits the recovery UI to become interactive.
    await expect(page.getByTestId('backfill')).toHaveCount(0);
    const pending = await page.locator('[data-card]').boundingBox();
    expect(Math.abs(pending!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(pending!.height - before!.height)).toBeLessThanOrEqual(1);
  } finally {
    allowPull();
  }
  await expect(page.getByTestId('backfill')).toBeVisible();
  const after = await page.locator('[data-card]').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
});

test('installed app upgrading from 0.8 shows what is new once; a new device never does', async ({ context }, info) => {
  const fresh = await newPage(context, dayFor(info, 140, 0), '12:00');
  await fresh.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await openToday(fresh);
  await fresh.waitForTimeout(1500);
  await expect(fresh.getByRole('dialog', { name: 'Fichas, renovada' })).toHaveCount(0);
  await fresh.close();

  const page = await newPage(context, dayFor(info, 140, 1), '12:00');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    // A 0.8 Today snapshot, written once before the first 1.0 boot.
    if (!sessionStorage.getItem('e2e:upgraded')) {
      sessionStorage.setItem('e2e:upgraded', '1');
      localStorage.setItem('today:snapshot', JSON.stringify({ v: 2 }));
    }
  });
  await openToday(page);
  const news = page.getByRole('dialog', { name: 'Fichas, renovada' });
  await expect(news).toBeVisible();
  await news.getByRole('button', { name: '¡Vamos!', exact: true }).click();
  await expect(news).toHaveCount(0);
  await page.reload();
  await page.locator('[data-card] [data-testid=ate]').waitFor();
  await page.waitForTimeout(1500);
  await expect(news).toHaveCount(0);
});
