// Shared logic for previews (Describe, Composer): remaining target, tokens, status line, fix hint.

import { amountOf, dayStatus, type Meter } from '../../shared/domain/daystatus';
import { fit } from '../../shared/domain/fit';
import { fill } from '../../shared/domain/format';
import { remainingTarget } from '../../shared/domain/log';
import { equivalentUsage, preferredEquivalent } from '../../shared/domain/recipes';
import { computeStatus } from '../../shared/domain/status';
import { capitalize } from '../../shared/domain/text';
import { tokensFor } from '../../shared/domain/tokens';
import type { LogItem, LogRow, PlanData, TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount, unitsOfItems } from '../../shared/domain/units';
import { targetFor } from '../actions';
import { withArticle } from '../components/DayCard';
import { describeCopy, lines, pools, typeLabels } from '../copy/es-MX';
import { liveLogs } from '../state/signals';

export function slotRemaining(slot: string, day: string, plan: PlanData, excludeLogId?: string): Units {
  if (slot === 'extra') return {};
  const logs = liveLogs.value.filter((l) => l.day === day && l.slot === slot && l.id !== excludeLogId);
  return remainingTarget(targetFor(slot, day), logs, plan.swaps);
}

export function fitTo(items: LogItem[], target: Units, plan: PlanData, slot: string) {
  return fit(items, target, {
    plan,
    rules: plan.swaps,
    preferred: preferredEquivalent(plan, equivalentUsage(liveLogs.value), slot),
  });
}

export interface PreviewModel {
  tokens: ReturnType<typeof tokensFor>;
  status: 'on' | 'over' | 'under' | 'mixed' | 'extra' | 'free';
  line: string;
  canFit: boolean;
}

function top(deltas: Partial<Record<TypeKey, number>>, sign: 1 | -1): [TypeKey, number] | null {
  let best: [TypeKey, number] | null = null;
  for (const t of TYPE_KEYS) {
    const v = (deltas[t] ?? 0) * sign;
    if (v >= 0.5 && (!best || v > best[1])) best = [t, v];
  }
  return best;
}

export function previewModel(
  items: LogItem[],
  slot: string,
  slotLabel: string,
  target: Units,
  plan: PlanData,
): PreviewModel {
  const raw = unitsOfItems(items, plan);
  if (items.length && items.every((i) => i.free))
    return { tokens: [], status: 'free', line: lines.freeLine, canFit: false };
  if (slot === 'extra') return { tokens: tokensFor({}, raw), status: 'extra', line: lines.extraLine, canFit: false };
  const r = computeStatus(raw, target, plan.swaps);
  const tokens = tokensFor(target, r.normalized);
  if (r.status === 'on') return { tokens, status: 'on', line: pools['describe.fits'][0], canFit: false };
  const fitted = fitTo(items, target, plan, slot);
  // Offer "Que cuadre" only when a small fix (≤ 3 changes) reaches the plan; otherwise it would rewrite the meal.
  const fitOk =
    computeStatus(unitsOfItems(fitted.items, plan), target, plan.swaps).status === 'on' &&
    fitted.changes.length > 0 &&
    fitted.changes.length <= 3;
  if (r.status === 'over') {
    const o = top(r.deltas, 1);
    const meta = o ? typeLabels[o[0]] : null;
    const overText =
      o && meta
        ? o[1] < 1.25
          ? fill(lines.overOne, { type: meta.short })
          : fill(lines.overMany, { n: formatCount(o[1]), emoji: meta.emoji })
        : '';
    const change = fitted.changes.find((c) => 'item_index' in c);
    const fixItem = change && 'item_index' in change ? fitted.items[change.item_index] : undefined;
    const hint = fitOk && fixItem ? ` ${fill(pools['describe.overHint'][0], { fix: fixItem.label })}` : '';
    return { tokens, status: 'over', line: `${overText}${hint}`.trim(), canFit: fitOk };
  }
  if (r.status === 'under') {
    const u = top(r.deltas, -1);
    const meta = u ? typeLabels[u[0]] : typeLabels.fruit;
    return {
      tokens,
      status: 'under',
      line: fill(lines.underLeft, { n: formatCount(u?.[1] ?? 1), emoji: meta.emoji }),
      canFit: fitOk,
    };
  }
  return { tokens, status: 'mixed', line: fill(lines.mixedLine, { slot: slotLabel }), canFit: fitOk };
}

/** What a described meal does: a verdict against its meal (in words and as a plate of sockets), where it lands
 *  in the day's tubes, and what changes later ("La cena queda con 1 tortilla menos"). Same numbers as Today,
 *  computed with the meal added. */
export interface Impact {
  status: PreviewModel['status'];
  line: string;
  /** The meal's plan against what it would bring (normalized with the plan's swaps). Null for extras. */
  plate: { target: Units; eaten: Units } | null;
  later: string | null;
  meters: Meter[];
  adding: Units;
  /** Portions that make the meal exact (check mode), with the first changed item for the hint. */
  fix: { items: LogItem[]; changed: Set<number>; hint: string } | null;
}

function gapText(deltas: Partial<Record<TypeKey, number>>, sign: 1 | -1, max = 2): string {
  const parts = TYPE_KEYS.map((t) => ({ t, n: (deltas[t] ?? 0) * sign }))
    .filter((g) => g.n >= 0.5 - 1e-6)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((g) => `${formatCount(g.n)} ${typeLabels[g.t].emoji}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? '');
}

export function impact(
  items: LogItem[],
  slot: string,
  slotLabel: string,
  target: Units,
  plan: PlanData,
  day: string,
  balancing: boolean,
): Impact {
  const raw = unitsOfItems(items, plan);
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const fake = {
    id: 'preview',
    day,
    slot,
    kind: 'meal',
    title: '',
    source: 'describe',
    raw_units: raw,
    items,
    deleted_at: null,
  } as unknown as LogRow;
  const before = dayStatus(plan, dayLogs, balancing);
  const after = dayStatus(plan, [...dayLogs, fake], balancing);
  const adding: Units = {};
  for (const m of after.meters) {
    const d = m.eaten - (before.meters.find((b) => b.type === m.type)?.eaten ?? 0);
    if (d > 1e-6) adding[m.type] = d;
  }
  // Meters for every type touched, so a food outside the plan (e.g. a sweet) still shows.
  const meters = after.meters.map(
    (m) =>
      before.meters.find((b) => b.type === m.type) ?? {
        ...m,
        eaten: 0,
        expected: 0,
        remaining: m.planned,
        over: 0,
      },
  );
  const had = new Set(before.advice.map((a) => `${a.slot}:${a.type}:${a.n}`));
  const usage = equivalentUsage(liveLogs.value);
  const fresh = after.advice.filter((a) => a.slot !== slot && !had.has(`${a.slot}:${a.type}:${a.n}`));
  const later = fresh.length
    ? fresh
        .map((a) => {
          const e = preferredEquivalent(plan, usage, a.slot)(a.type);
          const label = plan.slots.find((s) => s.key === a.slot)?.label ?? '';
          return fill(describeCopy.later, {
            slot: capitalize(withArticle(label)),
            food: e ? amountOf(e, a.n) : `${formatCount(a.n)} ${typeLabels[a.type].emoji}`,
          });
        })
        .join(' ')
    : null;
  const base = { later, meters, adding, fix: null, plate: null };
  if (items.length && items.every((i) => i.free)) return { ...base, status: 'free', line: describeCopy.free };
  if (slot === 'extra') return { ...base, status: 'extra', line: describeCopy.extra };
  const r = computeStatus(raw, target, plan.swaps);
  const plate = { target, eaten: r.normalized };
  const s = slotLabel.toLowerCase();
  if (r.status === 'on') return { ...base, plate, status: 'on', line: fill(describeCopy.on, { slot: s }) };
  const fitted = fitTo(items, target, plan, slot);
  const fitOk =
    computeStatus(unitsOfItems(fitted.items, plan), target, plan.swaps).status === 'on' &&
    fitted.changes.length > 0 &&
    fitted.changes.length <= 3 &&
    !fitted.changes.some((c) => 'added' in c);
  const changed = new Set<number>();
  for (const c of fitted.changes) if ('item_index' in c) changed.add(c.item_index);
  const first = fitted.changes.find((c) => 'item_index' in c);
  const fixItem = first && 'item_index' in first ? fitted.items[first.item_index] : undefined;
  const fix =
    fitOk && fixItem
      ? { items: fitted.items, changed, hint: fill(describeCopy.fitHint, { fix: fixItem.label }) }
      : null;
  const line =
    r.status === 'under'
      ? fill(describeCopy.under, { slot: s, list: gapText(r.deltas, -1) })
      : r.status === 'over'
        ? fill(describeCopy.over, { list: gapText(r.deltas, 1), slot: s })
        : fill(describeCopy.mixed, { over: gapText(r.deltas, 1, 1), under: gapText(r.deltas, -1, 1) });
  return { ...base, plate, status: r.status, line, fix };
}
