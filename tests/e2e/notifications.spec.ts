import { expect, type Page, test } from '@playwright/test';
import { checkBudget, dayFor, describeAndLog, dismissRenewal, newPage, openToday, RUNS, Taps } from './helpers';

async function mockPush(page: Page, permission = 'granted') {
  await page.addInitScript((result) => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    Object.defineProperty(window, 'PushManager', { value: class {} });
    const notification = {
      permission: 'default',
      requestPermission: () => {
        notification.permission = result;
        return Promise.resolve(result);
      },
    };
    Object.defineProperty(window, 'Notification', { value: notification });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () => null,
            subscribe: async () => ({ toJSON: () => ({ endpoint: 'https://web.push.apple.com/e2e', keys: {} }) }),
          },
        }),
        addEventListener() {},
        register: async () => ({}),
      },
    });
  }, permission);
  await page.route('**/api/push/vapid', (r) => r.fulfill({ json: { key: 'test-key' } }));
  await page.route('**/api/push/subscribe', (r) => r.fulfill({ status: 204 }));
}

test('A18 · activate reminders from priming; permission only after tap', async ({ context, request }, info) => {
  test.setTimeout(Math.max(90000, RUNS * 20000));
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 100, i);
    const page = await newPage(context, day, '16:52');
    await mockPush(page);
    await request.post('/api/sync', {
      headers: { 'X-Fichas': '1' },
      data: {
        mutations: [
          {
            table: 'settings',
            op: 'upsert',
            row: {
              key: 'notifications',
              value: { enabled: false, paused_until: null, quiet: ['22:30', '09:00'], slots: {} },
            },
          },
          {
            table: 'settings',
            op: 'upsert',
            row: { key: 'onboarding', value: { install_hint: true, notif_asked: [], token_hint: false } },
          },
        ],
      },
    });
    // Hide higher-priority cards and provide three real occasions in the local signal.
    await openToday(page);
    await page.evaluate(async () => {
      const connection = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('fichas');
        r.onsuccess = () => resolve(r.result);
      });
      const tx = connection.transaction('local', 'readwrite');
      tx.objectStore('local').put({ key: `renewal:${new Date(Date.now()).toISOString().slice(0, 10)}`, value: true });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      connection.close();
    });
    // Log three occasions on this day; renewal dismissal is independent of the permission budget.
    await dismissRenewal(page);
    for (let n = 0; n < 3; n++) {
      await page.getByTestId('describe-open').click();
      await describeAndLog(page, '1 manzana');
      await page.waitForTimeout(1200);
    }
    const backfill = page.getByTestId('backfill');
    if (await backfill.isVisible()) await backfill.getByRole('button', { name: 'Descartar', exact: true }).click();
    const recap = page.locator('button.card[aria-label]');
    if (await recap.isVisible()) await recap.click();
    await page.getByTestId('notification-prime').waitFor();
    expect(await page.evaluate(() => Notification.permission)).toBe('default');
    const taps = new Taps(),
      t0 = Date.now();
    await taps.tap(page.getByRole('button', { name: 'Sí, avísame', exact: true }));
    await expect(page.getByTestId('notification-prime')).not.toBeAttached();
    await expect
      .poll(async () => {
        const body = await (await request.get('/api/sync?since=0')).json();
        return JSON.parse(body.changes.settings.find((r: { key: string }) => r.key === 'notifications').value).enabled;
      })
      .toBe(true);
    times.push(Date.now() - t0);
    expect(taps.n).toBe(1);
    await page.close();
  }
  checkBudget('A18', times, 5000, 8000);
});

test('A19 · cold push link focuses slot and one tap logs with push source', async ({ context, request }, info) => {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 101, i),
      page = await newPage(context, day, '20:40');
    const t0 = Date.now();
    await page.goto('/?slot=desayuno&src=push');
    await page.getByTestId('now-describe').waitFor();
    await expect(page.locator('[data-card]')).toContainText('Desayuno');
    await expect(page.locator('[data-card] h2')).toHaveText('¿Qué desayunaste?');
    const taps = new Taps();
    await taps.tap(page.getByTestId('now-describe'));
    await page.getByTestId('describe-input').fill('2 tortillas, 3 huevos, ½ tz verdura y 2 cdta aceite');
    await page.getByTestId('impact').waitFor();
    await taps.tap(page.getByTestId('log'));
    await expect(page.locator('[data-card] .anim-stamp').first()).toBeVisible();
    times.push(Date.now() - t0);
    expect(taps.n).toBe(2);
    await expect
      .poll(async () => {
        const body = await (await request.get('/api/sync?since=0')).json();
        return body.changes.logs.some(
          (l: { day: string; slot: string; source: string }) =>
            l.day === day && l.slot === 'desayuno' && l.source === 'push',
        );
      })
      .toBe(true);
    await page.close();
  }
  checkBudget('A19', times, 6000, 9000);
});

test('denied permission keeps reminders off and shows recovery copy', async ({ context, request }, info) => {
  for (let i = 0; i < RUNS; i++) {
    const day = dayFor(info, 102, i);
    const response = await request.post('/api/sync', {
      headers: { 'X-Fichas': '1' },
      data: {
        mutations: [
          {
            table: 'settings',
            op: 'upsert',
            row: {
              key: 'notifications',
              value: { enabled: true, paused_until: null, quiet: ['22:30', '09:00'], slots: {} },
            },
          },
        ],
      },
    });
    expect(response.status()).toBe(200);
    const stored = await (await request.get('/api/sync?since=0')).json();
    expect(
      JSON.parse(stored.changes.settings.find((row: { key: string }) => row.key === 'notifications').value).enabled,
    ).toBe(true);
    const page = await newPage(context, day, '16:52');
    await mockPush(page, 'denied');
    await page.addInitScript(() => {
      const states: string[] = [];
      Object.assign(window, { __notificationInitialStates: states });
      new MutationObserver(() => {
        const toggle = document.querySelector<HTMLButtonElement>(
          '[data-testid="notification-settings"] [role="switch"]',
        );
        if (toggle && !toggle.disabled) states.push(toggle.getAttribute('aria-checked')!);
      }).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await page.goto('/historia/ajustes');
    const toggle = page.getByRole('switch', { name: 'Avisos de comida', exact: true });
    await expect(toggle).toBeEnabled();
    // A new device must show the stored setting at its first enabled frame, before any user tap.
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __notificationInitialStates: string[] }).__notificationInitialStates.length,
        ),
      )
      .toBeGreaterThan(0);
    const initialStates = await page.evaluate(
      () => (window as unknown as { __notificationInitialStates: string[] }).__notificationInitialStates,
    );
    expect(initialStates, `enabled states before the first tap, iteration ${i}`).not.toContain('false');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Revisa los permisos de Fichas.').first()).toBeVisible();
    // Drain this iteration's local preference write before the next remote fixture is installed.
    await expect
      .poll(async () => {
        const stored = await (await request.get('/api/sync?since=0')).json();
        return JSON.parse(stored.changes.settings.find((row: { key: string }) => row.key === 'notifications').value)
          .enabled;
      })
      .toBe(false);
    await page.waitForFunction(async () => {
      const connection = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('fichas');
        request.onsuccess = () => resolve(request.result);
      });
      try {
        return await new Promise<boolean>((resolve) => {
          const request = connection.transaction('outbox').objectStore('outbox').count();
          request.onsuccess = () => resolve(request.result === 0);
        });
      } finally {
        connection.close();
      }
    });
    await page.close();
  }
});
