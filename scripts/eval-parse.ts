/// <reference path="../src/worker/worker-configuration.d.ts" />
// Manual, real-provider eval. Uses the same validated parser as production, without food writes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import cases from '../evals/parse-cases.json';
import { PlanV1 } from '../src/shared/domain/plan-schema';
import type { LogItem, Units } from '../src/shared/domain/types';
import { TYPE_KEYS } from '../src/shared/domain/types';
import { unitsOfItems } from '../src/shared/domain/units';
import { runMealAi } from '../src/worker/lib/meal-ai';
import { PROMPT_VERSION } from '../src/worker/lib/prompts/meal';

function option(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
const models = (option('--models') ?? 'openai/gpt-6-luna').split(',').filter(Boolean);
const selected = option('--cases')?.split(',').map(Number);
const inputs = selected ? cases.filter((row) => selected.includes(row.id)) : cases;
if (!inputs.length || !process.env.OPENROUTER_API_KEY) throw new Error('Cases and OPENROUTER_API_KEY are required.');
const plan = PlanV1.parse(JSON.parse(readFileSync('seed/plan-2026-10-08.json', 'utf8')));
const nativeFetch = globalThis.fetch;
let cost = 0;
let calls = 0;
globalThis.fetch = async (input, init) => {
  calls++;
  const response = await nativeFetch(input, init);
  const result = (await response
    .clone()
    .json()
    .catch(() => ({}))) as { usage?: { cost?: number } };
  cost += result.usage?.cost ?? 0;
  return response;
};
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;

function matches(expected: Record<string, number | number[] | undefined>, actual: Units): boolean {
  return TYPE_KEYS.every((type) => {
    const target = expected[type];
    const value = actual[type] ?? 0;
    if (target === undefined) return value <= 0.5;
    return typeof target === 'number' ? Math.abs(value - target) <= 0.25 : value >= target[0]! && value <= target[1]!;
  });
}

mkdirSync('private/evals', { recursive: true });
for (const model of models) {
  cost = 0;
  calls = 0;
  const env = {
    MODEL_FAST: model,
    MODEL_VISION: model,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    TZ_DEFAULT: 'America/Mexico_City',
    // This only simulates reservation. Evaluation never writes production D1 or logs.
    DB: { prepare: () => ({ bind: () => ({ first: async () => ({ calls: 1 }) }) }) },
  } as unknown as Env;
  const results: {
    id: number;
    kind: string;
    pass: boolean;
    ms: number;
    units?: Units;
    items?: LogItem[];
    error?: string;
  }[] = [];
  for (const row of inputs) {
    const start = Date.now();
    try {
      const result = await runMealAi(env, plan, 'extra', { text: row.text }, 'https://fichas.toolco.workers.dev');
      const units = unitsOfItems(result.items, plan);
      const pass = row.free
        ? result.items.length > 0 && result.items.every((item) => item.free)
        : matches(row.expected, units);
      results.push({ id: row.id, kind: row.kind, pass, ms: Date.now() - start, units, items: result.items });
    } catch {
      results.push({ id: row.id, kind: row.kind, pass: false, ms: Date.now() - start, error: 'upstream' });
    }
    process.stdout.write('.');
  }
  const accuracy = (kind: string) => {
    const subset = results.filter((row) => row.kind === kind);
    return subset.length ? (100 * subset.filter((row) => row.pass).length) / subset.length : null;
  };
  const times = results.map((row) => row.ms);
  const summary = {
    model,
    cases: inputs.length,
    exact: accuracy('exact'),
    composite: accuracy('composite'),
    p50: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    calls,
    cost,
    averageCost: calls ? cost / calls : 0,
    failed: results.filter((row) => !row.pass).map((row) => row.id),
  };
  const passed =
    inputs.length === 40 &&
    summary.exact! >= 95 &&
    summary.composite! >= 80 &&
    summary.p50 <= 2000 &&
    summary.p95 <= 4500;
  const report = { at: new Date().toISOString(), promptVersion: PROMPT_VERSION, summary, passed, results };
  writeFileSync(`private/evals/${model.replaceAll('/', '-')}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n${JSON.stringify(summary)}; full M2 thresholds: ${passed ? 'PASS' : 'NOT MET'}`);
}
