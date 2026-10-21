import type { PlanRead } from '../plan-read-schema';
import { ALIASES, REFERENCE_PORTIONS } from './aliases';
import { parseItems } from './matcher';
import { canonicalPlanFood } from './plan-foods';
import { computeStatus } from './status';
import { DEFAULT_SWAPS } from './swaps';
import { slug } from './text';
import type { Equivalent, ExampleItem, PlanData, TypeKey, Units } from './types';
import { TYPE_KEYS } from './types';
import { unitsOfItems } from './units';

export interface PlanWarning {
  code: 'target' | 'equivalent' | 'example' | 'time' | 'portion' | 'date';
  field: string;
}
export interface PlanDisagreement {
  id: string;
  path: (string | number)[];
  label: string;
  a: unknown;
  b: unknown;
}
export interface PlanReport {
  state: 'uploading' | 'reading' | 'ready' | 'error';
  files: { name: string; type: string; size: number; sha256: string }[];
  disagreements: PlanDisagreement[];
  warnings: PlanWarning[];
  single_read: boolean;
  models: { model: string; ms: number; ok: boolean }[];
  started_at?: number;
}

/** Accept a line in full or keep it for review; never silently drop an unmatched ingredient. */
export function localExampleItems(line: string, plan: PlanData, target: Units): ExampleItem[] | null {
  const parsed = parseItems(line, plan, target);
  if (!parsed.complete || parsed.items.some((it) => !it.free && (!it.equivalent_id || it.assumed_qty))) return null;
  const options = parsed.items
    .filter((it) => it.equivalent_id && !it.free)
    .map((it) => ({ equivalent_id: it.equivalent_id!, qty: it.qty, unit: it.unit as Equivalent['unit'] }));
  if (!options.length) return [];
  if (options.length === 1 || /\s[o/]\s/.test(line)) return [{ text: line, options }];
  return parsed.items.flatMap((it) =>
    it.equivalent_id && !it.free
      ? [
          {
            text: it.label,
            options: [{ equivalent_id: it.equivalent_id, qty: it.qty, unit: it.unit as Equivalent['unit'] }],
          },
        ]
      : [],
  );
}

export function unmatchedExamples(read: PlanRead, plan: PlanData) {
  return read.slots.flatMap((slot, s) =>
    slot.example_lines.flatMap((text, l) =>
      localExampleItems(text, plan, plan.slots[s]!.target) === null ? [{ slot: s, line: l, text }] : [],
    ),
  );
}

export function expandRead(read: PlanRead): PlanData {
  const equivalents = new Map<string, Equivalent>();
  for (const row of read.equivalent_rows)
    for (const rawFood of row.foods) {
      const food = rawFood
        .trim()
        .toLowerCase()
        .replace(/\s*<?\s*\d+\s*k?cal\b/g, '')
        .trim();
      const canonical = canonicalPlanFood(food, row.type, row.unit);
      const id = `${row.type}.${slug(canonical)}`;
      const ref = REFERENCE_PORTIONS[canonical];
      const prior = equivalents.get(id);
      const conflict = prior && (prior.qty !== row.qty || prior.unit !== row.unit);
      const unclear =
        /uncertain|ilegib|illegib|dudoso|no claro/i.test(row.note ?? '') ||
        (row.type === 'fruit' && /^frescos?$/i.test(food));
      const uniqueId = conflict ? `${id}_variant_${equivalents.size}` : id;
      if (conflict) prior.flag = 'check_portion';
      equivalents.set(uniqueId, {
        id: uniqueId,
        type: row.type,
        food,
        qty: row.qty,
        unit: row.unit,
        aliases: [...new Set([...(ALIASES[canonical] ?? []), ...(canonical !== food ? [canonical] : [])])],
        note: row.note,
        source: 'table',
        flag:
          conflict || unclear || (ref && (row.unit !== ref.unit || row.qty < ref.min || row.qty > ref.max))
            ? 'check_portion'
            : null,
      });
    }
  const labels = read.slots.map((s) => s.source_label.replace(/\s+\d+$/, '').trim());
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(slug(label), (counts.get(slug(label)) ?? 0) + 1);
  const positions = new Map<string, number>();
  const plan: PlanData = {
    schema: 1,
    issued_on: read.issued_on,
    next_appointment: read.next_appointment,
    fluids_ml: read.fluids_ml,
    exercise: read.exercise,
    notes: read.notes,
    free_foods: [...new Set(read.free_foods)],
    equivalents: [...equivalents.values()],
    swaps: structuredClone(DEFAULT_SWAPS),
    rules: { rebalance_within_day: 'unknown' },
    slots: read.slots.map((s, i) => {
      const base = slug(labels[i] ?? s.source_label);
      const n = (positions.get(base) ?? 0) + 1;
      positions.set(base, n);
      return {
        key: counts.get(base)! > 1 ? `${base}_${n}` : base,
        label: labels[i]!,
        source_label: s.source_label,
        kind: /colaci|snack/i.test(base) ? 'snack' : 'meal',
        time: s.time,
        target: Object.fromEntries(Object.entries(s.target).filter(([, n]) => n > 0)),
        example: null,
      };
    }),
  };
  // An example may supply foods missing from the exchange table. Never infer their unit value here.
  plan.slots.forEach((slot, i) => {
    const items: ExampleItem[] = [];
    for (const line of read.slots[i]!.example_lines) {
      items.push(...(localExampleItems(line, plan, slot.target) ?? []));
    }
    if (items.length) slot.example = { title: slot.label, items };
  });
  return plan;
}

export function checkPlan(plan: PlanData): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  for (const key of ['issued_on', 'next_appointment'] as const) {
    const value = plan[key];
    const date = value ? new Date(`${value}T12:00:00Z`) : null;
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(date?.getTime()) ||
        date?.toISOString().slice(0, 10) !== value)
    )
      warnings.push({ code: 'date', field: key });
  }
  for (const slot of plan.slots) {
    if (slot.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time)) warnings.push({ code: 'time', field: slot.key });
    for (const [type, n] of Object.entries(slot.target) as [TypeKey, number][]) {
      if (n > 12 || Math.abs(n * 2 - Math.round(n * 2)) > 1e-6)
        warnings.push({ code: 'target', field: `${slot.key}.${type}` });
      if (n > 0 && !plan.equivalents.some((e) => e.type === type))
        warnings.push({ code: 'equivalent', field: `${slot.key}.${type}` });
    }
    const items =
      slot.example?.items.map((i) => ({
        ...i.options[0]!,
        label: i.text,
        units: {},
        estimated: false,
        assumed_qty: false,
        free: false,
      })) ?? [];
    if (!items.length || computeStatus(unitsOfItems(items, plan), slot.target, plan.swaps).status !== 'on')
      warnings.push({ code: 'example', field: slot.key });
  }
  for (const e of plan.equivalents) if (e.flag) warnings.push({ code: 'portion', field: e.food });
  return warnings;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function compareReads(a: PlanData, b: PlanData): PlanDisagreement[] {
  const out: PlanDisagreement[] = [];
  const add = (path: (string | number)[], label: string, av: unknown, bv: unknown) => {
    if (!same(av, bv)) out.push({ id: path.join('.'), path, label, a: av, b: bv });
  };
  if (
    !same(
      a.slots.map((s) => s.key),
      b.slots.map((s) => s.key),
    )
  )
    add(['slots'], 'slots', a.slots, b.slots);
  else
    a.slots.forEach((s, i) => {
      const other = b.slots[i]!;
      add(['slots', i, 'time'], s.label, s.time, other.time);
      for (const t of TYPE_KEYS)
        add(['slots', i, 'target', t], `${s.label} · ${t}`, s.target[t] ?? 0, other.target[t] ?? 0);
      add(['slots', i, 'example'], s.label, s.example, other.example);
    });
  const ids = [...new Set([...a.equivalents, ...b.equivalents].map((e) => e.id))];
  let next = a.equivalents.length;
  for (const id of ids) {
    const i = a.equivalents.findIndex((e) => e.id === id);
    const av = i >= 0 ? a.equivalents[i]! : null;
    const bv = b.equivalents.find((e) => e.id === id) ?? null;
    if (!av || !bv || Math.abs(av.qty - bv.qty) > 0.00011 || av.unit !== bv.unit || av.note !== bv.note)
      add(['equivalents', i >= 0 ? i : next++], av?.food ?? bv!.food, av, bv);
  }
  for (const key of ['issued_on', 'next_appointment', 'fluids_ml', 'exercise', 'notes', 'free_foods'] as const)
    add([key], key, a[key], b[key]);
  return out;
}

export function resolveReads(
  base: PlanData,
  disagreements: PlanDisagreement[],
  choices: Record<string, 'a' | 'b'>,
): PlanData {
  const plan = structuredClone(base);
  for (const d of disagreements) {
    const selected = choices[d.id];
    if (!selected) continue;
    let node = plan as unknown as Record<string | number, unknown>;
    for (const key of d.path.slice(0, -1)) node = node[key] as typeof node;
    node[d.path.at(-1)!] = structuredClone(d[selected]);
  }
  plan.equivalents = plan.equivalents.filter(Boolean);
  return plan;
}
