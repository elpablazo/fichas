import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { addDays } from '../../src/shared/domain/day';
import { seedPlan } from '../plan-fixture';
import { checkBudget, dayFor, newPage, openToday, RUNS, Taps } from './helpers';

test.setTimeout(RUNS > 1 ? 120000 : 30000);

const FOOD = [
  'protein_poa.pollo',
  'carb_sg.tortilla_de_maiz',
  'fruit.manzana',
  'veg.verdura_cocida',
  'fat_sp.aceite_vegetal',
];
async function stock(request: APIRequestContext, ids = FOOD) {
  const old = await (await request.get('/api/sync?since=0')).json();
  const now = Date.now();
  const mutations = (old.changes.pantry ?? [])
    .filter((p: { deleted_at: number | null }) => !p.deleted_at)
    .map((p: { id: string }) => ({ table: 'pantry', op: 'delete', row: { id: p.id } }));
  for (const id of ids) {
    const e = seedPlan.equivalents.find((e) => e.id === id)!;
    mutations.push({
      table: 'pantry',
      op: 'upsert',
      row: {
        id: `fixture:${id}`,
        label: e.food,
        equivalent_ids: [id],
        state: 'have',
        on_list: 0,
        staple: 0,
        checked_at: now,
        updated_at: now,
        deleted_at: null,
        rev: 0,
      },
    });
  }
  expect((await request.post('/api/sync', { headers: { 'X-Fichas': '1' }, data: { mutations } })).status()).toBe(200);
}
async function mockIdeas(page: Page) {
  await page.route('**/api/ai/ideas', (r) => r.fulfill({ json: { ideas: [] } }));
}
const LATENCY = `(() => {
  window.__kitchenFx = { tap: null, idea: null, out: null, added: null };
  document.addEventListener('pointerdown', () => {
    window.__kitchenFx = { tap: performance.now(), idea: null, out: null, added: null };
  }, true);
  new MutationObserver(() => {
    const f = window.__kitchenFx, now = performance.now();
    if (f.tap === null) return;
    if (f.idea === null && document.querySelector('[data-testid=kitchen-idea]')) f.idea = now;
    if (f.out === null && document.querySelector('[data-pantry="fixture:protein_poa.pollo"] [data-state=out]')) f.out = now;
    if (f.added === null && document.querySelector('[data-pantry="pantry:almendra"] [data-state=have]')) f.added = now;
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
})()`;
async function latency(page: Page, key: 'idea' | 'out' | 'added') {
  return page.evaluate((key) => {
    const f = (window as unknown as { __kitchenFx: Record<string, number | null> }).__kitchenFx;
    return f[key] === null || f.tap === null ? Number.POSITIVE_INFINITY : f[key]! - f.tap!;
  }, key);
}

test('A12 · one tap opens deterministic plan-fitting ideas within 300 ms', async ({ context, request }, info) => {
  await stock(request);
  const times: number[] = [],
    paints: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await newPage(context, dayFor(info, 110, i), '16:52');
    await page.addInitScript(LATENCY);
    await mockIdeas(page);
    await openToday(page);
    await page.waitForTimeout(350); // Returning-user idle prefetch, outside the measured action.
    const taps = new Taps(),
      t0 = Date.now();
    await taps.tap(page.getByRole('button', { name: 'Cocina', exact: true }));
    await page.getByTestId('kitchen-idea').first().waitFor();
    times.push(Date.now() - t0);
    paints.push(await latency(page, 'idea'));
    expect(taps.n).toBe(1);
    expect(await page.getByTestId('kitchen-idea').count()).toBeLessThanOrEqual(3);
    await page.close();
  }
  checkBudget('A12', times, 2000, 4000);
  checkBudget('A12 deterministic paint', paints, 300, 300);
});

test('A13 · out and add take one tap each, chip paint within 100 ms; buy and staples persist', async ({
  context,
  request,
}, info) => {
  const times: number[] = [],
    paints: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    await stock(request);
    const page = await newPage(context, dayFor(info, 111, i), '16:52');
    await page.addInitScript(LATENCY);
    await mockIdeas(page);
    await openToday(page);
    await page.getByRole('button', { name: 'Cocina', exact: true }).click();
    const chicken = page.locator('[data-pantry="fixture:protein_poa.pollo"] [data-state]');
    const taps = new Taps(),
      t0 = Date.now();
    await taps.tap(chicken);
    await expect(chicken).toHaveAttribute('data-state', 'out');
    times.push(Date.now() - t0);
    paints.push(await latency(page, 'out'));
    expect(taps.n).toBe(1);
    await page.getByTestId('pantry-input').fill('almendra');
    const addTaps = new Taps(),
      t1 = Date.now();
    await addTaps.tap(page.getByRole('button', { name: 'Agregar', exact: true }));
    await page.locator('[data-pantry="pantry:almendra"]').waitFor();
    times.push(Date.now() - t1);
    paints.push(await latency(page, 'added'));
    expect(addTaps.n).toBe(1);
    await page.getByRole('tab', { name: /^Lista/ }).click();
    // Buying removes the row immediately; check() waits for a checked state on a detached control.
    await page.getByRole('checkbox', { name: 'Ya tengo: pollo' }).click();
    await expect(page.getByRole('checkbox', { name: 'Ya tengo: pollo' })).not.toBeAttached();
    await page.getByRole('tab', { name: 'Despensa', exact: true }).click();
    await expect(chicken).toHaveAttribute('data-state', 'have');
    // "Siempre tengo" lives in the food's sheet (tap its name).
    await page.locator('[data-pantry="fixture:protein_poa.pollo"] button').nth(1).click();
    await page.getByRole('switch', { name: /^Siempre tengo/ }).click();
    await expect(page.getByRole('switch', { name: /^Siempre tengo/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.reload();
    await page.locator('[data-pantry="fixture:protein_poa.pollo"] button').nth(1).click();
    await expect(page.getByRole('switch', { name: /^Siempre tengo/ })).toHaveAttribute('aria-checked', 'true');
    await page.close();
  }
  checkBudget('A13', times, 2000, 4000);
  checkBudget('A13 chip paint', paints, 100, 100);
});

test('Kitchen menus derive missing groceries and explicit logging earns the kitchen stamp', async ({
  context,
  request,
}, info) => {
  await stock(request, ['protein_poa.pollo']);
  const day = dayFor(info, 112),
    page = await newPage(context, day, '16:52');
  await mockIdeas(page);
  await openToday(page);
  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  const idea = page.getByTestId('kitchen-idea').first();
  await expect(idea).toContainText('Falta:');
  await idea.getByRole('button', { name: 'Para mañana', exact: true }).click();
  await page.getByRole('tab', { name: /^Lista/ }).click();
  await expect(page.getByRole('checkbox', { name: /^Ya tengo:/ }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Despensa', exact: true }).click();
  await idea.getByRole('button', { name: 'Anotar', exact: true }).click();
  await expect(page.getByTestId('kitchen')).not.toBeAttached();
  await expect
    .poll(async () => {
      const data = await (await request.get('/api/sync?since=0')).json();
      return (data.changes.logs ?? []).filter(
        (l: { day: string; source: string; deleted_at: number | null }) =>
          l.day === day && l.source === 'pantry' && !l.deleted_at,
      ).length;
    })
    .toBe(1);
  const data = await (await request.get('/api/sync?since=0')).json();
  expect(
    data.changes.menus.some((m: { day: string; slot: string }) => m.day === addDays(day, 1) && m.slot === 'comida'),
  ).toBe(true);
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Jardín', exact: true }).click();
  await page.getByRole('button', { name: /estampas$/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Con lo que hay');
});

test('AI appends valid ideas without reordering; wrong units, unavailable foods and stale results disappear', async ({
  context,
  request,
}, info) => {
  await stock(request, [...FOOD, 'fruit.platano']);
  const page = await newPage(context, dayFor(info, 113), '16:52');
  const items = FOOD.map((id) => {
    const e = seedPlan.equivalents.find((e) => e.id === id)!;
    const target = seedPlan.slots.find((s) => s.key === 'comida')!.target;
    return { equivalent_id: id, qty: (target[e.type] ?? 0) * e.qty, unit: e.unit };
  });
  const banana = seedPlan.equivalents.find((e) => e.id === 'fruit.platano')!;
  const valid = items.map((i) =>
    i.equivalent_id === 'fruit.manzana' ? { equivalent_id: banana.id, qty: banana.qty, unit: banana.unit } : i,
  );
  await page.route('**/api/ai/ideas', async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await r.fulfill({
      json: {
        ideas: [
          { title: 'Otra idea válida', items: valid },
          { title: 'Unidad inventada', items: items.map((i) => ({ ...i, unit: 'kg' })) },
          { title: 'Comida no disponible', items: [{ equivalent_id: 'almendra', qty: 10, unit: 'pza' }] },
        ],
      },
    });
  });
  await openToday(page);
  await page.getByRole('button', { name: 'Cocina', exact: true }).click();
  const first = await page.getByTestId('kitchen-idea').first().locator('h3').innerText();
  await expect(page.getByText('Otra idea válida', { exact: true })).toBeVisible();
  await expect(page.getByTestId('kitchen-idea').first().locator('h3')).toHaveText(first);
  await expect(page.getByText('Unidad inventada', { exact: true })).not.toBeAttached();
  await expect(page.getByText('Comida no disponible', { exact: true })).not.toBeAttached();
  await page.locator('[data-pantry="fixture:protein_poa.pollo"] [data-state]').click();
  await expect(page.getByText('Otra idea válida', { exact: true })).not.toBeAttached();
  await page.waitForTimeout(650);
  await expect(page.getByText('Otra idea válida', { exact: true })).not.toBeAttached();
  await page.screenshot({ path: `private/tmp/kitchen-${info.project.name}.png`, fullPage: true });
});

test.describe('offline pantry', () => {
  test.use({ serviceWorkers: 'allow' });
  test('unknown inventory survives reopen, reconnect fills the same chip; undo prevents resurrection', async ({
    context,
    request,
  }, info) => {
    test.skip(info.project.name === 'iphone', 'WebKit runner lacks offline SW shell; Chromium covers it.');
    await stock(request);
    const page = await newPage(context, dayFor(info, 114), '16:52');
    await mockIdeas(page);
    let calls = 0;
    await page.route('**/api/ai/pantry', (r) => {
      calls++;
      return r.fulfill({ json: { items: [{ label: 'pechuguita', equivalent_ids: ['protein_poa.pollo'] }] } });
    });
    await openToday(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.getByTestId('ate').waitFor();
    await page.getByRole('button', { name: 'Cocina', exact: true }).click();
    await context.setOffline(true);
    await page.getByTestId('pantry-input').fill('pechuguita');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.locator('[data-pantry="pantry:pechuguita"]').waitFor();
    await page.reload();
    await page.locator('[data-pantry="pantry:pechuguita"]').getByText('Sin equivalente').waitFor();
    expect(calls).toBe(0);
    await context.setOffline(false);
    await expect(page.locator('[data-pantry="pantry:pechuguita"]').getByText('Sin equivalente')).not.toBeAttached({
      timeout: 10000,
    });
    await expect(page.locator('[data-pantry="pantry:pechuguita"]')).toHaveCount(1);
    await context.setOffline(true);
    await page.getByTestId('pantry-input').fill('misteriosa');
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await page.locator('[data-pantry="pantry:misteriosa"]').waitFor();
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(page.locator('[data-pantry="pantry:misteriosa"]')).not.toBeAttached();
    const before = calls;
    await context.setOffline(false);
    await page.reload();
    await page.getByTestId('kitchen').waitFor();
    await page.waitForTimeout(800);
    expect(calls).toBe(before);
    await expect(page.locator('[data-pantry="pantry:misteriosa"]')).not.toBeAttached();
  });
});
