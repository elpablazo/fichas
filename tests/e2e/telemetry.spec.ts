import { expect, type Page, test } from '@playwright/test';
import { dayFor, describeAndLog, newPage, openToday } from './helpers';

const LUNCH = '2 tortillas, 120 g pollo, 1 manzana, 1 tz verdura y 2 cdta aceite';

interface Queued {
  key: string;
  value: { kind: string; event: { id: string; name?: string; ms?: number; taps?: number } };
}
async function queue(page: Page): Promise<Queued[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('fichas');
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const rows = await new Promise<{ key: string }[]>((resolve) => {
        const request = db.transaction('local').objectStore('local').getAll();
        request.onsuccess = () => resolve(request.result);
      });
      return rows.filter((row) => row.key.startsWith('telemetry:'));
    } finally {
      db.close();
    }
  }) as Promise<Queued[]>;
}
async function visibility(page: Page, value: 'visible' | 'hidden') {
  await page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

test('failed telemetry survives reopening and is retried with the original event IDs', async ({ context }, info) => {
  const day = dayFor(info, 110);
  const page = await newPage(context, day, '17:20');
  let failures = 0;
  await page.route('**/api/telemetry', async (route) => {
    failures++;
    await route.fulfill({ status: 503 });
  });
  await openToday(page);
  await page.getByTestId('now-describe').click();
  await describeAndLog(page, LUNCH);
  await expect.poll(async () => (await queue(page)).some((q) => q.value.event.name === 'open_to_first_log')).toBe(true);
  const event = (await queue(page)).find((q) => q.value.event.name === 'open_to_first_log')!.value.event;
  await visibility(page, 'hidden');
  await expect.poll(() => failures).toBeGreaterThan(0);
  expect((await queue(page)).some((q) => q.value.event.id === event.id)).toBe(true);
  await page.close();

  const again = await newPage(context, day, '17:30');
  const sent: string[] = [];
  await again.route('**/api/telemetry', async (route) => {
    const body = route.request().postDataJSON() as { ux: { id: string }[] };
    sent.push(...body.ux.map((event) => event.id));
    await route.continue();
  });
  await again.goto('/');
  // Let startup record its own event first, so the flush below carries everything queued.
  await expect.poll(async () => (await queue(again)).some((q) => q.value.event.name === 'today_painted')).toBe(true);
  await again.clock.runFor(11_000);
  await expect.poll(() => sent.includes(event.id)).toBe(true);
  await expect.poll(async () => (await queue(again)).length).toBe(0);
  await again.close();
});

test('returning to the app starts a new first-log measurement and excludes time in the background', async ({
  context,
}, info) => {
  const page = await newPage(context, dayFor(info, 111), '17:20');
  await page.route('**/api/telemetry', (route) => route.fulfill({ status: 503 }));
  await openToday(page);
  await page.getByTestId('now-describe').click();
  await describeAndLog(page, LUNCH);
  await expect
    .poll(async () => (await queue(page)).filter((q) => q.value.event.name === 'open_to_first_log').length)
    .toBe(1);
  await page.waitForTimeout(1200);
  await visibility(page, 'hidden');
  await page.clock.runFor(120_000);
  await visibility(page, 'visible');
  await page.getByTestId('extra-row').click();
  await describeAndLog(page, '1 manzana');
  await expect
    .poll(async () => (await queue(page)).filter((q) => q.value.event.name === 'open_to_first_log').length)
    .toBe(2);
  const latest = (await queue(page)).filter((q) => q.value.event.name === 'open_to_first_log').at(-1)!.value.event;
  expect(latest.ms).toBeLessThan(5000);
  expect(latest.taps).toBe(2);
  await page.close();
});

test('large error queues use multiple keepalive requests below the browser byte limit', async ({ context }, info) => {
  const page = await newPage(context, dayFor(info, 112), '16:52');
  const bodies: { bytes: number; errors: number }[] = [];
  await page.route('**/api/telemetry', async (route) => {
    const body = route.request().postData()!;
    bodies.push({ bytes: Buffer.byteLength(body), errors: JSON.parse(body).errors.length });
    await route.fulfill({ status: 204 });
  });
  await openToday(page);
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new ErrorEvent('error', { message: '🧪'.repeat(250), error: { stack: 'x'.repeat(4000) } }));
    }
  });
  await expect.poll(async () => (await queue(page)).filter((q) => q.value.kind === 'error').length).toBe(20);
  await visibility(page, 'hidden');
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  await page.clock.runFor(11_000);
  await expect.poll(() => bodies.reduce((n, body) => n + body.errors, 0)).toBe(20);
  expect(bodies.length).toBeGreaterThan(1);
  expect(bodies.every((body) => body.bytes < 64 * 1024)).toBe(true);
  await expect.poll(async () => (await queue(page)).length).toBe(0);
  await page.close();
});
