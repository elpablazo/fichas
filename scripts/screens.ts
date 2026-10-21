// Visual QA: seeds a local preview with a realistic fortnight and captures every screen (iPhone 13, light and dark).
// Local only: requires `npx vite preview --port 4173` on a disposable local D1 (`scripts/e2e-reset.ts`).
// Screenshots go to ignored private/tmp/screens/.
import { mkdirSync, readFileSync } from 'node:fs';
import { devices, type Page, webkit } from '@playwright/test';
import { addDays } from '../src/shared/domain/day';
import { itemLabel } from '../src/shared/domain/format';
import { buildLog } from '../src/shared/domain/log';
import type { LogItem, LogRow, UnitName } from '../src/shared/domain/types';
import { equivalentById } from '../src/shared/domain/units';
import { seedPlan as plan } from '../tests/plan-fixture';

const BASE = process.env.SCREENS_URL ?? 'http://localhost:4173';
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error('screens.ts only runs against a local preview');
const OUT = 'private/tmp/screens';
const TODAY = '2026-10-23';
const code = readFileSync('.dev.vars', 'utf8').match(/OWNER_PAIRING_CODE="([^"]+)"/)?.[1] ?? '';

const item = (id: string, qty: number, unit?: UnitName): LogItem => {
  const e = equivalentById(plan, id);
  if (!e) throw new Error(id);
  const u = unit ?? e.unit;
  return {
    label: itemLabel(e.food, qty, u),
    qty,
    unit: u,
    equivalent_id: id,
    units: {},
    estimated: false,
    assumed_qty: false,
    free: false,
  };
};
const MEALS: Record<string, [string, LogItem[]]> = {
  desayuno: [
    'Huevos con tortillas',
    [
      item('carb_sg.tortilla_de_maiz', 2),
      item('protein_poa.huevo', 3),
      item('veg.verdura_cocida', 0.5),
      item('fat_sp.aceite_vegetal', 1),
      item('fat_sp.aguacate', 0.3333),
    ],
  ],
  colacion_1: [
    'Latte, manzana y chocolate',
    [item('dairy.leche_de_vaca_descremada', 1), item('fruit.manzana', 1), item('fat_cp.chocolate_sin_azucar', 0.5)],
  ],
  comida: [
    'Pollo con tortillas y verdura',
    [
      item('carb_sg.tortilla_de_maiz', 2),
      item('protein_poa.pollo', 120, 'g'),
      item('veg.verdura_cocida', 1),
      item('fruit.pera', 0.5),
      item('fat_sp.aceite_vegetal', 2),
    ],
  ],
  colacion_2: ['Manzana', [item('fruit.manzana', 1)]],
  cena: [
    'Tacos de pollo',
    [
      item('carb_sg.tortilla_de_maiz', 3),
      item('protein_poa.pollo', 90, 'g'),
      item('veg.verdura_cocida', 0.5),
      item('fat_sp.aceite_vegetal', 2),
    ],
  ],
};
let n = 0;
function log(day: string, slot: string, over = 0): LogRow {
  const [title, items0] = MEALS[slot] ?? ['', []];
  const items = over
    ? items0.map((i) => (i.equivalent_id === 'carb_sg.tortilla_de_maiz' ? item(i.equivalent_id, i.qty + over) : i))
    : items0;
  const at = Date.parse(
    `${day}T${({ desayuno: '11', colacion_1: '13', comida: '17', colacion_2: '19', cena: '21' })[slot] ?? '12'}:05:00-06:00`,
  );
  return buildLog({
    id: `screens-${day}-${slot}-${++n}`,
    plan_id: 'plan-2026-10-08',
    plan,
    rules: plan.swaps,
    day,
    slot,
    title,
    items,
    source: 'suggestion',
    now: at,
    target: plan.slots.find((s) => s.key === slot)?.target ?? {},
    slotLogs: [],
  });
}

async function seed(page: Page) {
  const res = await page.request.post(`${BASE}/api/auth/pair`, {
    headers: { 'X-Fichas': '1' },
    data: { code, label: 'screens' },
  });
  if (res.status() !== 204) throw new Error(`pair ${res.status()}`);
  const all = ['desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena'];
  const pattern: Record<number, string[]> = {
    0: all,
    1: ['desayuno', 'comida', 'cena'],
    2: ['desayuno', 'colacion_1', 'comida', 'cena'],
    3: [],
    4: ['comida', 'cena'],
    5: all,
    6: ['desayuno', 'comida'],
  };
  const logs: LogRow[] = [];
  for (let d = addDays('2026-10-08', 0); d < TODAY; d = addDays(d, 1)) {
    const i = (Date.parse(d) / 86400000) % 7;
    for (const s of pattern[i] ?? []) logs.push(log(d, s, d === '2026-10-18' && s === 'cena' ? 1 : 0));
  }
  logs.push(log(TODAY, 'desayuno', 1));
  const weighins = Array.from({ length: 14 }, (_, i) => {
    const day = addDays('2026-09-22', i * 2 + (i > 6 ? 3 : 0));
    const noise = [0.3, -0.2, 0.4, -0.35, 0.1, -0.1, 0.25, -0.3][i % 8] ?? 0;
    return {
      id: `screens-w-${i}`,
      day,
      kg: Math.round((86.4 - 0.075 * (i * 2 + (i > 6 ? 3 : 0)) + noise) * 10) / 10,
      source: day === '2026-10-08' ? 'nutritionist' : 'home',
      created_at: Date.parse(day),
      deleted_at: null,
    };
  });
  const pantry = [
    ['protein_poa.pollo', 'pollo', 'have', 0],
    ['carb_sg.tortilla_de_maiz', 'tortillas', 'have', 1],
    ['protein_poa.huevo', 'huevo', 'have', 0],
    ['fruit.manzana', 'manzana', 'have', 0],
    ['veg.verdura_cocida', 'verduras', 'have', 0],
    ['fat_sp.aceite_vegetal', 'aceite', 'have', 1],
    ['fat_sp.aguacate', 'aguacate', 'have', 0],
    ['protein_poa.atun_drenado', 'atún en lata', 'out', 0],
    [null, 'cebolla', 'have', 0],
  ].map(([id, label, state, staple]) => ({
    id: `pantry:${label}`,
    label,
    equivalent_ids: id ? [id] : [],
    state,
    on_list: state === 'out' ? 1 : 0,
    staple,
    checked_at: 1,
    deleted_at: null,
  }));
  const mutations = [
    ...logs.map((row) => ({ table: 'logs', op: 'upsert', row })),
    ...weighins.map((row) => ({ table: 'weighins', op: 'upsert', row })),
    ...pantry.map((row) => ({ table: 'pantry', op: 'upsert', row })),
    {
      table: 'settings',
      op: 'upsert',
      row: { key: 'onboarding', value: { install_hint: true, notif_asked: [1, 2], token_hint: false } },
    },
  ];
  for (let i = 0; i < mutations.length; i += 150) {
    const r = await page.request.post(`${BASE}/api/sync`, {
      headers: { 'X-Fichas': '1' },
      data: { mutations: mutations.slice(i, i + 150) },
    });
    if (!r.ok()) throw new Error(`sync ${r.status()} ${await r.text()}`);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await webkit.launch();
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      colorScheme: scheme,
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
    });
    const page = await context.newPage();
    if (scheme === 'light') await seed(page);
    else
      await page.request.post(`${BASE}/api/auth/pair`, {
        headers: { 'X-Fichas': '1' },
        data: { code, label: 'screens' },
      });
    await page.clock.install({ time: new Date(`${TODAY}T17:05:00-06:00`) });
    const shot = async (name: string, full = false) => {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${scheme}-${name}.png`, fullPage: full });
    };
    await page.goto(`${BASE}/`);
    await page.locator('[data-card]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500); // rewards evaluation + plant chunk
    await shot('01-today');
    await shot('01b-today-full', true);
    if (scheme === 'dark') {
      await page.getByRole('button', { name: 'Jardín', exact: true }).click();
      await shot('10-garden', true);
      await context.close();
      continue;
    }
    await page.getByTestId('day-card').locator('button').first().click();
    await shot('02-day-sheet');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.locator('[data-card] h2 button').click();
    await shot('03-meal-sheet');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByTestId('describe-open').click();
    await page.getByTestId('describe-input').fill('3 tortillas, 120 g pollo, 1 tz verdura, 1 manzana');
    await page.getByTestId('describe-submit').click();
    await page.getByTestId('preview').waitFor();
    await shot('04-describe-preview');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.locator(`[data-day="${addDays(TODAY, -1)}"]`).click();
    await shot('05-yesterday', true);
    await page.locator(`[data-day="${addDays(TODAY, 1)}"]`).click();
    await page.getByTestId('tomorrow').waitFor();
    await shot('06-tomorrow');
    await page.getByRole('button', { name: 'Ir a hoy' }).click();
    await page.getByRole('button', { name: 'Cocina', exact: true }).click();
    await page.getByTestId('kitchen-ideas').waitFor();
    await shot('07-kitchen', true);
    await page.locator('[data-pantry="pantry:cebolla"] button').nth(1).click();
    await shot('08-food-unlinked');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.locator('[data-pantry="pantry:pollo"] button').nth(1).click();
    await shot('08b-food-linked');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('tab', { name: /^Lista/ }).click();
    await shot('09-kitchen-list');
    await page.getByRole('button', { name: 'Jardín', exact: true }).click();
    await page.getByTestId('garden').waitFor();
    await shot('10-garden');
    await shot('10b-garden-full', true);
    await page.getByTestId('garden').locator('button').filter({ hasText: '23' }).first().click();
    await shot('11-plant-today');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: /estampas$/ }).click();
    await shot('12-stamps');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await shot('13-style');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Progreso', exact: true }).click();
    await page.getByTestId('weight-section').waitFor();
    await shot('14-progress');
    await shot('14b-progress-full', true);
    await page.getByTestId('weight-open').click();
    await shot('15-weighin');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.goto(`${BASE}/progreso/ajustes`);
    await page.waitForTimeout(800);
    await shot('16-settings', true);
    await page.goto(`${BASE}/progreso/plan`);
    await page.waitForTimeout(800);
    await shot('17-plan', true);
    await page.clock.setFixedTime(new Date(`${TODAY}T21:05:00-06:00`));
    await page.goto(`${BASE}/`);
    await page.getByRole('button', { name: 'Cerrar el día', exact: true }).click();
    await page.getByTestId('accept-menu').waitFor({ timeout: 8000 });
    await shot('18-day-close');
    await context.close();
  }
  await browser.close();
  console.log(`screens: saved to ${OUT}/`);
}
await main();
