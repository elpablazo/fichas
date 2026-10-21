/// <reference path="../src/worker/worker-configuration.d.ts" />
// Two bounded real-provider checks using the production Kitchen validators. No production writes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PlanV1 } from '../src/shared/domain/plan-schema';
import { computeStatus } from '../src/shared/domain/status';
import { unitsOfItems } from '../src/shared/domain/units';
import { KITCHEN_PROMPT_VERSION, runIdeasAi, runPantryAi } from '../src/worker/lib/kitchen-ai';

if (!process.env.OPENROUTER_API_KEY) throw new Error('Missing provider key.');
const plan = PlanV1.parse(JSON.parse(readFileSync('seed/plan-2026-10-08.json', 'utf8')));
let calls = 0;
let cost = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  calls++;
  const response = await originalFetch(input, init);
  const result = (await response
    .clone()
    .json()
    .catch(() => ({}))) as { usage?: { cost?: number } };
  cost += result.usage?.cost ?? 0;
  return response;
};
const env = {
  MODEL_FAST: 'openai/gpt-6-luna',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  TZ_DEFAULT: 'America/Mexico_City',
  DB: { prepare: () => ({ bind: () => ({ first: async () => ({ calls: 1 }) }) }) },
} as unknown as Env;
const start = Date.now();
const items = await runPantryAi(
  env,
  plan,
  'Pechuguita, tortillas de maicito, manzanitas, verduritas cocidas y aceite',
  'https://fichas.toolco.workers.dev',
);
const pantryMs = Date.now() - start;
const have = new Set([
  'protein_poa.pollo',
  'carb_sg.tortilla_de_maiz',
  'fruit.manzana',
  'veg.verdura_cocida',
  'fat_sp.aceite_vegetal',
]);
const target = plan.slots.find((s) => s.key === 'comida')!.target;
const ideaStart = Date.now();
const ideas = await runIdeasAi(env, plan, target, have, 'https://fichas.toolco.workers.dev');
const ideasMs = Date.now() - ideaStart;
const mapped = new Set(items.flatMap((i) => i.equivalent_ids));
const pantryPass = [...have].every((id) => mapped.has(id));
const ideasPass =
  ideas.length > 0 &&
  ideas.every(
    (idea) =>
      computeStatus(unitsOfItems(idea.items, plan), target, plan.swaps).status === 'on' &&
      idea.items.every((i) => have.has(i.equivalent_id ?? '')),
  );
mkdirSync('private/evals', { recursive: true });
writeFileSync(
  'private/evals/kitchen-live.json',
  JSON.stringify(
    {
      model: env.MODEL_FAST,
      prompt: KITCHEN_PROMPT_VERSION,
      at: new Date().toISOString(),
      pantryMs,
      ideasMs,
      calls,
      cost,
      pantryPass,
      ideasPass,
      items,
      ideas,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ model: env.MODEL_FAST, pantryPass, ideasPass, pantryMs, ideasMs, calls, cost }));
if (!pantryPass || !ideasPass) process.exitCode = 1;
