// Seeds D1 with the 08/10/2026 plan as season 1, the nutritionist's dishes and default settings.
// Also stores the original PDF (base64 text, like uploads) in R2 when it exists in private/.
// Usage: npm run seed:local | npm run seed:remote   (idempotent: existing rows are kept)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { makeItem } from '../src/shared/domain/items';
import { PlanV1 } from '../src/shared/domain/plan-schema';
import { fingerprint } from '../src/shared/domain/recipes';
import { slug } from '../src/shared/domain/text';
import type { LogItem, PlanData } from '../src/shared/domain/types';
import { equivalentById } from '../src/shared/domain/units';

const target = process.argv.includes('--remote') ? '--remote' : '--local';
const PLAN_ID = 'plan-2026-10-08';
const PDF = 'private/plans/2026-10-08.pdf';
const plan = PlanV1.parse(JSON.parse(readFileSync('seed/plan-2026-10-08.json', 'utf8'))) as PlanData;
const now = Date.now();

const sql = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const REV = "(SELECT value FROM meta WHERE key = 'rev')";

function items(spec: [string, number][]): LogItem[] {
  return spec.map(([id, qty]) => {
    const e = equivalentById(plan, id);
    if (!e) throw new Error(`unknown equivalent ${id}`);
    return makeItem(e, qty);
  });
}

const comida = (protein: string): [string, number][] => [
  ['carb_sg.tortilla_de_maiz', 2],
  [protein, 120],
  ['veg.verdura_cocida', 1],
  ['fruit.pera', 0.5],
  ['fat_sp.aceite_vegetal', 2],
];

const seedRecipes: { title: string; slot: string; items: LogItem[] }[] = [
  {
    title: 'Huevos con tortillas',
    slot: 'desayuno',
    items: items([
      ['carb_sg.tortilla_de_maiz', 2],
      ['protein_poa.huevo', 3],
      ['veg.verdura_cocida', 0.5],
      ['fat_sp.aceite_vegetal', 1],
      ['fat_sp.aguacate', 0.3333],
    ]),
  },
  {
    title: 'Latte, manzana y chocolate',
    slot: 'colacion_1',
    items: items([
      ['dairy.leche_de_vaca_descremada', 1],
      ['fruit.manzana', 1],
      ['fat_cp.chocolate_sin_azucar', 0.5],
    ]),
  },
  { title: 'Pollo con tortillas y verdura', slot: 'comida', items: items(comida('protein_poa.pollo')) },
  { title: 'Bistec con tortillas y verdura', slot: 'comida', items: items(comida('protein_poa.carne_de_res')) },
  { title: 'Pescado con tortillas y verdura', slot: 'comida', items: items(comida('protein_poa.pescado')) },
  { title: 'Manzana', slot: 'colacion_2', items: items([['fruit.manzana', 1]]) },
  { title: 'Mango', slot: 'colacion_2', items: items([['fruit.mango_ataulfo', 0.5]]) },
  {
    title: 'Hamburguesa casera',
    slot: 'cena',
    items: items([
      ['carb_sg.bollo_de_hamburguesa', 1],
      ['protein_poa.carne_de_res', 90],
      ['veg.verdura_cocida', 0.5],
      ['fat_sp.aceite_vegetal', 2],
    ]),
  },
  {
    title: 'Tacos de pollo',
    slot: 'cena',
    items: items([
      ['carb_sg.tortilla_de_maiz', 3],
      ['protein_poa.pollo', 90],
      ['veg.verdura_cocida', 0.5],
      ['fat_sp.aceite_vegetal', 2],
    ]),
  },
];

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  tz: 'America/Mexico_City',
  day_start_hour: 4,
  sound: true,
  haptics: true,
  notifications: { enabled: false, paused_until: null, quiet: ['22:30', '09:00'], slots: {} },
  rebalance: 'unknown',
  style: { petal: 'clasica', theme: 'rosa', token: 'clasico', celebration: 'confeti' },
  onboarding: { install_hint: false, notif_asked: [], token_hint: false },
  last_closed_day: null,
};

const hasPdf = existsSync(PDF);
const pdf = hasPdf ? readFileSync(PDF) : null;
const sourceKeys = hasPdf ? [`plan-src/${PLAN_ID}/0`] : [];
const sha = pdf ? createHash('sha256').update(pdf).digest('hex') : null;

const lines: string[] = ["UPDATE meta SET value = value + 1 WHERE key = 'rev';"];
lines.push(
  `INSERT INTO plans (id, season, status, issued_on, starts_on, ends_on, data, source_keys, source_sha256, parse_report, created_at, confirmed_at, updated_at, rev) VALUES (${[
    PLAN_ID,
    1,
    'active',
    plan.issued_on,
    '2026-10-08',
    null,
    JSON.stringify(plan),
    JSON.stringify(sourceKeys),
    sha,
    JSON.stringify({ source: 'seed', files: [{ name: 'plan-2026-10-08.pdf', type: 'application/pdf' }] }),
    now,
    now,
    now,
  ]
    .map(sql)
    .join(', ')}, ${REV}) ON CONFLICT(id) DO NOTHING;`,
);
for (const [i, r] of seedRecipes.entries()) {
  const cols = [
    `seed-${slug(r.title)}`,
    r.title,
    JSON.stringify(r.items),
    fingerprint(r.items),
    JSON.stringify({ [r.slot]: 0 }),
    0,
    null,
    0,
    0,
    'seed',
    now + i,
    now,
    null,
  ];
  lines.push(
    `INSERT INTO recipes (id, title, items, fingerprint, slot_counts, times, last_used_at, favorite, hidden, origin, created_at, updated_at, deleted_at, rev) VALUES (${cols
      .map(sql)
      .join(', ')}, ${REV}) ON CONFLICT DO NOTHING;`,
  );
}
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  lines.push(
    `INSERT INTO settings (key, value, updated_at, rev) VALUES (${sql(key)}, ${sql(JSON.stringify(value))}, ${now}, ${REV}) ON CONFLICT(key) DO NOTHING;`,
  );
}

mkdirSync('private/tmp', { recursive: true });
writeFileSync('private/tmp/seed.sql', `${lines.join('\n')}\n`);
const wrangler = ['./node_modules/wrangler/bin/wrangler.js'];
execFileSync('node', [...wrangler, 'd1', 'execute', 'fichas-db', target, '--file=private/tmp/seed.sql'], {
  stdio: 'inherit',
});

if (pdf) {
  writeFileSync('private/tmp/plan-src-0.b64', pdf.toString('base64'));
  execFileSync(
    'node',
    [
      ...wrangler,
      'r2',
      'object',
      'put',
      `fichas-files/plan-src/${PLAN_ID}/0`,
      target,
      '--file=private/tmp/plan-src-0.b64',
      '--ct=text/plain',
    ],
    { stdio: 'inherit' },
  );
}
console.log(
  `Seeded ${PLAN_ID} (${target}): ${seedRecipes.length} dishes, ${Object.keys(DEFAULT_SETTINGS).length} settings.`,
);
