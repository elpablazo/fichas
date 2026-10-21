import { expect, type Page, test } from '@playwright/test';
import type { LogRow } from '../../src/shared/domain/types';
import { dayFor, newPage, openToday, toast } from './helpers';

const meal = {
  title: 'Pollo con tortillas',
  confidence: 'medium',
  source: 'ai',
  model: 'test/vision',
  ms: 200,
  items: [
    {
      label: '2 tortillas',
      qty: 2,
      unit: 'pza',
      equivalent_id: 'carb_sg.tortilla_de_maiz',
      units: { carb_sg: 2 },
      estimated: true,
      assumed_qty: true,
      free: false,
    },
    {
      label: '120 g pollo',
      qty: 120,
      unit: 'g',
      equivalent_id: 'protein_poa.pollo',
      units: { protein_poa: 4 },
      estimated: true,
      assumed_qty: true,
      free: false,
    },
  ],
};

async function logs(page: Page, day: string): Promise<LogRow[]> {
  return page.evaluate(
    (day) =>
      new Promise<LogRow[]>((resolve) => {
        const request = indexedDB.open('fichas');
        request.onsuccess = () => {
          const database = request.result;
          const read = database.transaction('logs').objectStore('logs').getAll();
          read.onsuccess = () => {
            resolve(read.result.filter((row: LogRow) => row.day === day && !row.deleted_at));
            database.close();
          };
        };
      }),
    day,
  );
}

const speechMock = `(() => {
  class Speech {
    start() { window.__speech = this; }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }
  window.SpeechRecognition = Speech;
})()`;

test('dictation produces editable text and never submits or logs automatically', async ({ context }, info) => {
  const day = dayFor(info, 70);
  const page = await newPage(context, day, '17:20');
  await page.addInitScript(speechMock);
  await openToday(page);
  let calls = 0;
  await page.route('**/api/ai/**', (route) => {
    calls++;
    return route.fulfill({ status: 503 });
  });
  await page.getByTestId('describe-open').click();
  await page.getByTestId('dictate').click();
  await expect(page.getByTestId('dictate')).toHaveAttribute('aria-pressed', 'true');
  const language = await page.evaluate(`window.__speech.lang`);
  expect(language).toBe('es-MX');
  await page.evaluate(
    `window.__speech.onresult({ results: [{ 0: { transcript: '2 tortillas de maíz' }, isFinal: true }] })`,
  );
  await expect(page.getByTestId('describe-input')).toHaveValue('2 tortillas de maíz');
  expect(await logs(page, day)).toHaveLength(0);
  await page.getByTestId('dictate').click();
  await page.getByTestId('describe-input').fill('3 tortillas de maíz');
  await expect(page.getByTestId('preview')).toContainText('3 tortillas');
  expect(await logs(page, day)).toHaveLength(0);
  expect(calls).toBe(0);
  await page.getByTestId('log').click();
  await expect(toast(page)).toBeVisible();
  await expect.poll(async () => (await logs(page, day)).length).toBe(1);
  expect((await logs(page, day))[0]?.raw_units.carb_sg).toBe(3);
});

test('unsupported dictation keeps the keyboard path usable', async ({ context }, info) => {
  const day = dayFor(info, 71);
  const page = await newPage(context, day, '17:20');
  await page.addInitScript(`window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;`);
  await openToday(page);
  await page.getByTestId('describe-open').click();
  await page.getByTestId('dictate').click();
  await expect(page.getByText('Usa el micrófono de tu teclado.')).toBeVisible();
  await expect(page.getByTestId('describe-input')).toBeFocused();
  await page.getByTestId('describe-input').fill('una manzana');
  await page.getByTestId('describe-input').press('Enter');
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByTestId('describe-input')).not.toBeFocused();
  expect(await logs(page, day)).toHaveLength(0);
});

test('photo → detected text → adjust/remove → explicit approval → D1 sync', async ({ context }, info) => {
  const day = dayFor(info, 72);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  await page.route('**/api/ai/photo?*', async (route) => {
    expect(route.request().headers()['content-type']).toBe('text/plain');
    expect(route.request().postData()).toMatch(/^\/9j\//);
    expect((route.request().postData() ?? '').length).toBeLessThan(1_500_000);
    await route.fulfill({ json: meal });
  });
  const before = await (await page.request.get('/api/sync?since=0')).json();
  await page.getByTestId('describe-open').click();
  await expect(page.getByTestId('photo-input')).toHaveAttribute('capture', 'environment');
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await expect(page.getByText('Revisa lo detectado antes de anotar.')).toBeVisible();
  await expect(page.getByTestId('describe-input')).toHaveValue('2 tortillas, 120 g pollo');
  expect(await logs(page, day)).toHaveLength(0);
  await page.getByRole('button', { name: 'Más: 2 tortillas', exact: true }).click();
  await expect(page.getByTestId('preview')).toContainText('3 tortillas');
  await page.getByRole('button', { name: 'Quitar: 120 g pollo', exact: true }).click();
  await expect(page.getByTestId('preview')).not.toContainText('120 g pollo');
  await expect(page.getByTestId('describe-input')).toHaveValue('3 tortillas');
  await page.getByTestId('log').click();
  await expect(toast(page)).toBeVisible();
  await expect.poll(async () => (await logs(page, day)).length).toBe(1);
  const row = (await logs(page, day))[0]!;
  expect(row.source).toBe('photo');
  expect(row.raw_units).toEqual({ carb_sg: 3 });
  await expect
    .poll(
      async () => {
        const pull = await (await page.request.get(`/api/sync?since=${before.rev}`)).json();
        return pull.changes.logs?.some((entry: { id: string }) => entry.id === row.id);
      },
      { timeout: 15000 },
    )
    .toBe(true);
});

test('discarding a photo creates no meal log', async ({ context }, info) => {
  const day = dayFor(info, 73);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  await page.route('**/api/ai/photo?*', (route) => route.fulfill({ json: meal }));
  await page.getByTestId('describe-open').click();
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await page.getByTestId('preview').waitFor();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await logs(page, day)).toHaveLength(0);
});

test('editing detected text can replace ingredients before approval', async ({ context }, info) => {
  const day = dayFor(info, 74);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  await page.route('**/api/ai/photo?*', (route) => route.fulfill({ json: meal }));
  await page.getByTestId('describe-open').click();
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await page.getByTestId('preview').waitFor();
  await page.getByTestId('describe-input').fill('2 tortillas de maíz y 90 g de pollo');
  await page.getByTestId('describe-input').press('Enter');
  await expect(page.getByTestId('preview')).toContainText('90 g pollo');
  await expect(page.getByTestId('preview')).not.toContainText('120 g pollo');
  expect(await logs(page, day)).toHaveLength(0);
});

test('unclear photos and AI errors never create logs', async ({ context }, info) => {
  const day = dayFor(info, 75);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  let calls = 0;
  await page.route('**/api/ai/photo?*', (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({ json: { ...meal, confidence: 'low', items: [] } })
      : route.fulfill({ status: 503 });
  });
  await page.getByTestId('describe-open').click();
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await expect(page.getByText('No se ve comida. Prueba con otra foto.')).toBeVisible();
  await expect(page.getByTestId('log')).not.toBeVisible();
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await expect(page.getByText('La IA no está disponible. Intenta después.')).toBeVisible();
  expect(await logs(page, day)).toHaveLength(0);
});

test('a late photo result cannot overwrite text edited while reading', async ({ context }, info) => {
  const day = dayFor(info, 76);
  const page = await newPage(context, day, '17:20');
  await openToday(page);
  await page.route('**/api/ai/photo?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: meal }).catch(() => {});
  });
  await page.getByTestId('describe-open').click();
  await page.getByTestId('photo-input').setInputFiles('public/icon-512.png');
  await expect(page.getByText('Viendo tu plato…')).toBeVisible();
  await page.getByTestId('describe-input').fill('una manzana');
  await page.waitForTimeout(700);
  await expect(page.getByTestId('describe-input')).toHaveValue('una manzana');
  await expect(page.getByTestId('preview')).toContainText('manzana');
  await expect(page.getByTestId('preview')).not.toContainText('tortillas');
  expect(await logs(page, day)).toHaveLength(0);
});

test('denied microphone access preserves editable keyboard input', async ({ context }, info) => {
  const day = dayFor(info, 77);
  const page = await newPage(context, day, '17:20');
  await page.addInitScript(speechMock);
  await openToday(page);
  await page.getByTestId('describe-open').click();
  await page.getByTestId('dictate').click();
  await page.evaluate(`window.__speech.onerror({ error: 'not-allowed' })`);
  await expect(page.getByText('Usa el micrófono de tu teclado.')).toBeVisible();
  await expect(page.getByTestId('dictate')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('describe-input').fill('una manzana');
  await page.getByTestId('describe-input').press('Enter');
  await expect(page.getByTestId('preview')).toBeVisible();
  expect(await logs(page, day)).toHaveLength(0);
});
