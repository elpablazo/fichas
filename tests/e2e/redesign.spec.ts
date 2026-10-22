// 1.0 redesign flows (docs/03-redesign.md §6): any day, cuadrar el día, dated weigh-ins and pantry linking.
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { addDays } from '../../src/shared/domain/day';
import { itemLabel, shortDate } from '../../src/shared/domain/format';
import { buildLog } from '../../src/shared/domain/log';
import type { LogItem, LogRow, WeighinRow } from '../../src/shared/domain/types';
import { equivalentById } from '../../src/shared/domain/units';
import { seedPlan as plan } from '../plan-fixture';
import { dayFor, describeAndLog, newPage, openToday } from './helpers';

async function rows<T>(page: Page, table: string): Promise<T[]> {
  return page.evaluate(
    (table) =>
      new Promise<T[]>((resolve) => {
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

/** The server's copy (other tests open fresh devices, so local-only writes must reach it first). */
/** Every synced row, following the pull's pages (a long local suite has more than one). */
async function server(request: APIRequestContext) {
  const all = {
    settings: [] as { key: string; value: string }[],
    weighins: [] as { id: string; deleted_at: number | null }[],
  };
  let since = 0;
  for (;;) {
    const body = await (await request.get(`/api/sync?since=${since}`)).json();
    all.settings.push(...(body.changes.settings ?? []));
    all.weighins.push(...(body.changes.weighins ?? []));
    if (!body.more) return all;
    since = body.rev;
  }
}

function item(id: string, qty: number): LogItem {
  const e = equivalentById(plan, id);
  if (!e) throw new Error(id);
  return {
    label: itemLabel(e.food, qty, e.unit),
    qty,
    unit: e.unit,
    equivalent_id: id,
    units: {},
    estimated: false,
    assumed_qty: false,
    free: false,
  };
}

test('any day: log yesterday from the week strip at its planned time; today stays untouched', async ({
  context,
}, info) => {
  const day = dayFor(info, 150);
  const yesterday = addDays(day, -1);
  const page = await newPage(context, day, '16:52');
  await openToday(page);
  await page.locator(`[data-day="${yesterday}"]`).click();
  await expect(page.locator('h1')).toHaveText('Ayer');
  await page.getByRole('button', { name: 'Anotar: Desayuno', exact: true }).click();
  await describeAndLog(page, '2 tortillas, 3 huevos, ½ tz verdura y 2 cdta aceite');
  const logged = async () =>
    (await rows<LogRow>(page, 'logs')).filter((l) => l.day === yesterday && l.slot === 'desayuno' && !l.deleted_at);
  await expect.poll(async () => (await logged()).length).toBe(1);
  const [row] = await logged();
  expect(row?.source).toBe('backfill');
  expect(row?.eaten_at).toBe(Date.parse(`${yesterday}T11:00:00-06:00`));
  expect((await rows<LogRow>(page, 'logs')).filter((l) => l.day === day && !l.deleted_at)).toHaveLength(0);
  await page.getByRole('button', { name: 'Ir a hoy', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Hoy');
  await expect(page.locator('[data-card]')).toBeVisible();
});

test('cuadrar el día: an over breakfast trims later meals; the switch turns it off and back on', async ({
  context,
  request,
}, info) => {
  const day = dayFor(info, 151);
  const row = buildLog({
    id: `e2e-balance-${day}`,
    plan_id: 'plan-2026-10-08',
    plan,
    rules: plan.swaps,
    day,
    slot: 'desayuno',
    title: 'Huevos con tortillas',
    // Two tortillas over the breakfast target.
    items: [item('carb_sg.tortilla_de_maiz', 4), item('protein_poa.huevo', 3)],
    source: 'suggestion',
    now: Date.parse(`${day}T11:00:00-06:00`),
    target: plan.slots.find((s) => s.key === 'desayuno')?.target ?? {},
    slotLogs: [],
  });
  const res = await request.post('/api/sync', {
    headers: { 'X-Fichas': '1' },
    data: { mutations: [{ table: 'logs', op: 'upsert', row }] },
  });
  expect(res.ok()).toBe(true);
  const page = await newPage(context, day, '12:00');
  await openToday(page);
  // "¿Cómo voy?" says it in food: two tortillas over → one less at lunch and one less at dinner.
  const note = page.getByTestId('pace-sub');
  await expect(page.getByTestId('pace-title')).toContainText('de más');
  await expect(note).toContainText('Para cuadrar');
  await expect(note).toContainText('1 tortilla menos en la comida');
  await expect(note).toContainText('1 tortilla menos en la cena');

  const toggle = async (expected: 'true' | 'false') => {
    await page.getByTestId('day-card').locator('button').first().click();
    const sw = page.getByRole('switch', { name: /^Cuadrar el día/ });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', expected);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  };
  await toggle('false');
  await expect(page.getByTestId('day-card')).not.toContainText('Para cuadrar');
  await toggle('true');
  await expect(note).toContainText('Para cuadrar');
  await expect
    .poll(async () => (await server(request)).settings.find((r) => r.key === 'rebalance')?.value)
    .toBe(JSON.stringify('allowed'));
});

test('weight: log yesterday, find it in the history, then delete it', async ({ context, request }, info) => {
  const day = dayFor(info, 152);
  const kg = info.project.name === 'pixel' ? 80.8 : 80.7;
  const page = await newPage(context, day, '09:00');
  await openToday(page);
  await page.getByRole('button', { name: 'Progreso', exact: true }).click();
  await page.getByTestId('weight-open').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Ayer', exact: true }).click();
  await page.getByTestId('weight-input').fill(String(kg));
  await page.getByTestId('weight-save').click();
  await expect(sheet).toHaveCount(0);
  const saved = async () => (await rows<WeighinRow>(page, 'weighins')).find((w) => w.kg === kg);
  await expect.poll(async () => (await saved())?.day).toBe(addDays(day, -1));

  const entry = page
    .getByTestId('weight-history')
    .getByRole('button', { name: `${kg} kg ${shortDate(addDays(day, -1))} · En casa`, exact: true });
  await entry.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar', exact: true }).click();
  await expect(entry).toHaveCount(0);
  await expect.poll(async () => (await saved())?.deleted_at ?? null).not.toBeNull();
  const id = (await saved())?.id;
  await expect
    .poll(async () => (await server(request)).weighins.find((w) => w.id === id)?.deleted_at ?? null)
    .not.toBeNull();
});

test('pantry: link an unknown food to the plan, then change what it counts as', async ({ context, request }, info) => {
  const day = dayFor(info, 153);
  const id = `pantry:e2e-link-${info.project.name}`;
  const res = await request.post('/api/sync', {
    headers: { 'X-Fichas': '1' },
    data: {
      mutations: [
        {
          table: 'pantry',
          op: 'upsert',
          row: {
            id,
            label: 'pechuguita asada',
            equivalent_ids: [],
            state: 'have',
            on_list: 0,
            staple: 0,
            checked_at: 1,
            deleted_at: null,
          },
        },
      ],
    },
  });
  expect(res.ok()).toBe(true);
  const page = await newPage(context, day, '16:52');
  await page.route('**/api/ai/**', (route) => route.fulfill({ status: 503, json: {} }));
  await openToday(page);
  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  const row = page.locator(`[data-pantry="${id}"]`);
  await expect(row).toContainText('Sin equivalente');
  await row.locator('button').nth(1).click();

  const sheet = page.getByRole('dialog');
  await sheet.getByRole('searchbox', { name: 'Busca en tu plan' }).fill('pollo');
  await sheet.getByRole('button', { name: 'pollo', exact: true }).click();
  await expect(sheet).toContainText('En tu plan cuenta como');
  await expect(row).not.toContainText('Sin equivalente');

  await sheet.getByRole('button', { name: 'Cambiar', exact: true }).click();
  await sheet.getByRole('searchbox', { name: 'Busca en tu plan' }).fill('huevo');
  await sheet.getByRole('button', { name: 'huevo', exact: true }).click();
  await expect(sheet).toContainText('En tu plan cuenta como');
  await expect
    .poll(async () => (await rows<{ id: string; equivalent_ids: string[] }>(page, 'pantry')).find((p) => p.id === id))
    .toMatchObject({ equivalent_ids: ['protein_poa.huevo'] });
});

test('export meals: pick a date range and get the dishes, not the exchange units', async ({
  context,
  request,
}, info) => {
  const day = dayFor(info, 153);
  const row = buildLog({
    id: `e2e-export-${day}`,
    plan_id: 'plan-2026-10-08',
    plan,
    rules: plan.swaps,
    day,
    slot: 'comida',
    title: 'Pollo con arroz',
    items: [item('protein_poa.pollo', 120), item('carb_sg.arroz_cocido', 1)],
    source: 'suggestion',
    now: Date.parse(`${day}T14:30:00-06:00`),
    target: plan.slots.find((s) => s.key === 'comida')?.target ?? {},
    slotLogs: [],
  });
  const res = await request.post('/api/sync', {
    headers: { 'X-Fichas': '1' },
    data: { mutations: [{ table: 'logs', op: 'upsert', row }] },
  });
  expect(res.ok()).toBe(true);
  const page = await newPage(context, day, '20:00');
  await openToday(page);
  await page.goto('/progreso/ajustes');
  await page.getByTestId('export-meals').click();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.goto('/progreso');
  await page.getByTestId('nutri-export').click();
  const sheet = page.getByRole('dialog');
  // The link is the main path; the text version sits under "Como texto".
  await sheet.getByTestId('export-text-toggle').click();
  await expect(sheet.getByTestId('export-summary')).toContainText('1 comida en 1 día');
  await expect(sheet).toContainText('Pollo con arroz');
  await expect(sheet).not.toContainText('carb_');
  await sheet.getByTestId('export-to').fill(addDays(day, -3));
  await sheet.getByTestId('export-from').fill(addDays(day, -5));
  await expect(sheet.getByTestId('export-summary')).toContainText('No hay comidas');
  await expect(sheet.getByTestId('export-share')).toHaveCount(0);
});
