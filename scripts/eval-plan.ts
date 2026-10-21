/// <reference path="../src/worker/worker-configuration.d.ts" />
// Live plan-reader evaluation. Original document and raw model results remain gitignored.
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { checkPlan, compareReads, expandRead } from '../src/shared/domain/plan-ingestion';
import { PlanV1 } from '../src/shared/domain/plan-schema';
import { norm, singularCandidates } from '../src/shared/domain/text';
import { TYPE_KEYS } from '../src/shared/domain/types';
import { PlanParseV1 } from '../src/shared/plan-read-schema';
import { runPlanReader } from '../src/worker/lib/plan-ai';
import { PLAN_PROMPT_VERSION } from '../src/worker/lib/prompts/plan';

const option = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const models = (option('--models') ?? 'anthropic/claude-sonnet-5.5,google/gemini-3.1-pro-preview').split(',');
if (models.length !== 2 || models[0]!.split('/')[0] === models[1]!.split('/')[0])
  throw new Error('Select two independent readers from different providers.');
const golden = PlanV1.parse(JSON.parse(readFileSync('seed/plan-2026-10-08.json', 'utf8')));
const file = option('--file') ?? 'private/plans/2026-10-08.pdf';
const bytes = readFileSync(file);
const source = bytes.toString('base64');
const sourceHash = createHash('sha256').update(bytes).digest('hex');
const replay = process.argv.includes('--replay');
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required.');
const env = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  TZ_DEFAULT: 'America/Mexico_City',
  DB: { prepare: () => ({ bind: () => ({ first: async () => ({ calls: 1 }) }) }) },
} as unknown as Env;
const fetchReal = globalThis.fetch;
const costs: Record<string, number> = {};
globalThis.fetch = async (url, init) => {
  const model = (JSON.parse(String(init?.body)) as { model: string }).model;
  const res = await fetchReal(url, init);
  const output = (await res
    .clone()
    .json()
    .catch(() => ({}))) as { usage?: { cost?: number } };
  if (!res.ok)
    appendFileSync(
      'private/evals/plan-provider-errors.jsonl',
      `${JSON.stringify({ at: new Date().toISOString(), model, status: res.status, output })}\n`,
    );
  costs[model] = (costs[model] ?? 0) + (output.usage?.cost ?? 0);
  return res;
};
mkdirSync('private/evals', { recursive: true });
const results = await Promise.all(
  models.map(async (model) => {
    try {
      const outputFile = `private/evals/plan-${model.replaceAll('/', '-')}.json`;
      const saved = replay ? JSON.parse(readFileSync(outputFile, 'utf8')) : null;
      if (
        saved &&
        (saved.prompt !== PLAN_PROMPT_VERSION ||
          (saved.source_sha256
            ? saved.source_sha256 !== sourceHash
            : option('--file') || statSync(file).mtimeMs > Date.parse(saved.at)))
      )
        throw new Error('Replay requires the same prompt and unchanged original source.');
      const result = saved
        ? { read: PlanParseV1.parse(saved.read), ms: saved.summary.ms }
        : await runPlanReader(
            env,
            model,
            [{ type: 'application/pdf', base64: source }],
            'https://fichas.toolco.workers.dev',
          );
      if (saved) costs[model] = saved.summary.cost;
      const plan = expandRead(result.read);
      const slotMisses = golden.slots
        .filter((s) => {
          const actual = plan.slots.find((a) => a.key === s.key);
          return (
            !actual ||
            actual.time !== s.time ||
            TYPE_KEYS.some((t) => Math.abs((actual.target[t] ?? 0) - (s.target[t] ?? 0)) > 0.001)
          );
        })
        .map((s) => s.key);
      const equivalentMisses = golden.equivalents
        .filter((e) => {
          const actual = plan.equivalents.find((a) => a.id === e.id);
          return !actual || actual.unit !== e.unit || Math.abs(actual.qty - e.qty) > 0.0002;
        })
        .map((e) => e.id);
      const equivalentAccuracy =
        (100 * (golden.equivalents.length - equivalentMisses.length)) / golden.equivalents.length;
      const passed = !slotMisses.length && plan.slots.length === golden.slots.length && equivalentAccuracy >= 95;
      const summary = {
        model,
        ms: result.ms,
        slots: `${golden.slots.length - slotMisses.length}/${golden.slots.length}`,
        equivalents: equivalentAccuracy,
        cost: costs[model] ?? 0,
        replay,
        passed,
      };
      writeFileSync(
        outputFile,
        `${JSON.stringify(
          {
            at: new Date().toISOString(),
            read_at: saved?.read_at ?? saved?.at ?? new Date().toISOString(),
            source_sha256: sourceHash,
            prompt: PLAN_PROMPT_VERSION,
            summary,
            slotMisses,
            equivalentMisses,
            warnings: checkPlan(plan),
            read: result.read,
            plan,
          },
          null,
          2,
        )}\n`,
      );
      appendFileSync('private/evals/plan-summary-history.jsonl', `${JSON.stringify(summary)}\n`);
      console.log(JSON.stringify(summary));
      return { plan, passed, equivalentMisses };
    } catch {
      console.log(JSON.stringify({ model, error: 'upstream', cost: costs[model] ?? 0, passed: false }));
      return null;
    }
  }),
);
if (results[0] && results[1]) {
  const disagreements = compareReads(results[0].plan, results[1].plan);
  console.log(`Dual-read disagreements: ${disagreements.length}`);
  const uncovered = results.flatMap((result, i) =>
    result!.equivalentMisses
      .filter((id) => {
        const expected = golden.equivalents.find((e) => e.id === id)!;
        const visibleDisagreement = disagreements.some(
          (d) =>
            d.path[0] === 'equivalents' &&
            [d.a, d.b].some((value) => value && typeof value === 'object' && 'id' in value && value.id === id),
        );
        if (visibleDisagreement) return false;
        const head = norm(expected.food).split(' ')[0]!;
        return !result!.plan.equivalents.some(
          (e) =>
            e.type === expected.type &&
            e.flag &&
            singularCandidates(norm(e.food).split(' ')[0]!).some((word) => singularCandidates(head).includes(word)),
        );
      })
      .map((id) => ({ model: models[i], id })),
  );
  console.log(`Golden mismatches without a review signal: ${uncovered.length}`);
  if (uncovered.length) process.exitCode = 1;
}
if (!results.every((r) => r?.passed)) process.exitCode = 1;
