// "Qué cambió": the old plan against the new one, one block per meal, in before → after numbers.
import type { PlanDiff } from '../../shared/domain/diff';
import { fill, unitText } from '../../shared/domain/format';
import { tokensFor } from '../../shared/domain/tokens';
import type { Equivalent, TypeKey } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount, formatQty } from '../../shared/domain/units';
import { labels, titles, typeLabels } from '../copy/es-MX';
import { planLines } from '../copy/more';
import { TokenRow, tokensA11y } from './Token';

const portion = (e: Equivalent) => `${formatQty(e.qty)} ${unitText(e.unit, e.qty)}`.trim();
const signed = (n: number) => `${n > 0 ? '+' : '−'}${formatCount(Math.abs(n))}`;

function Delta({ type, before, after }: { type: TypeKey; before: number; after: number }) {
  const meta = typeLabels[type];
  const delta = after - before;
  return (
    <li class="diff-row">
      <span class="sr-only">{`${meta.label}: de ${formatCount(before)} a ${formatCount(after)}`}</span>
      <span class="diff-type" aria-hidden="true">
        <span class="diff-emoji">{meta.emoji}</span> {meta.label}
      </span>
      <span class="diff-vals num" aria-hidden="true">
        <span class="faint">{formatCount(before)}</span>
        <span class="faint"> → </span>
        <b>{formatCount(after)}</b>
      </span>
      <span class={`diff-delta ${delta > 0 ? 'up' : 'down'}`} aria-hidden="true">
        {signed(delta)}
      </span>
    </li>
  );
}

function Foods({ rows }: { rows: PlanDiff['equivalents'] }) {
  const added = rows.filter((r) => !r.before);
  const gone = rows.filter((r) => !r.after);
  const changed = rows.filter((r) => r.before && r.after);
  const group = (title: string, items: typeof rows) =>
    items.length > 0 && (
      <div class="mt-3">
        <p class="kicker">{title}</p>
        <ul>
          {items.map((r) => {
            const e = (r.after ?? r.before)!;
            return (
              <li key={r.id} class="diff-food">
                <span class="min-w-0">
                  <span aria-hidden="true">{typeLabels[e.type].emoji}</span> {e.food}
                </span>
                <span class="num shrink-0 secondary muted">
                  {r.before && r.after ? `${portion(r.before)} → ${portion(r.after)}` : portion(e)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <details class="mt-4">
      <summary class="press min-h-11 cursor-pointer font-semibold">
        {fill(planLines.planFoodsSummary, { n: rows.length })}
      </summary>
      {group(planLines.planFoodsChanged, changed)}
      {group(planLines.planFoodsNew, added)}
      {group(planLines.planFoodsGone, gone)}
    </details>
  );
}

export function PlanDiffCard({ diff, first }: { diff: PlanDiff; first: boolean }) {
  const nothing = !diff.slots.length && !diff.equivalents.length && !diff.details.length;
  return (
    <section class="card mb-4 p-4" data-testid="plan-diff">
      <h2 class="font-bold">{titles.differences}</h2>
      {first ? (
        <p class="secondary muted mt-2">{planLines.planFirst}</p>
      ) : nothing ? (
        <p class="secondary muted mt-2">{planLines.planUnchanged}</p>
      ) : (
        <>
          <p class="secondary muted mt-1">
            {diff.slots.length ? fill(planLines.planDiffSlots, { n: diff.slots.length }) : planLines.planDiffNone}
          </p>
          {diff.slots.map((s) => {
            const time = s.after_time ?? s.before_time;
            const rows = TYPE_KEYS.filter((t) => s.deltas[t]);
            return (
              <div key={s.key} class="diff-slot">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <h3 class="font-bold">{s.label}</h3>
                  {s.time_changed && s.before_time && s.after_time ? (
                    <span class="caption num">
                      {s.before_time} → <b>{s.after_time}</b>
                    </span>
                  ) : (
                    time && <span class="caption num">{time}</span>
                  )}
                  {(s.added || s.removed) && (
                    <span class="badge">{s.added ? planLines.planSlotAdded : planLines.planSlotRemoved}</span>
                  )}
                </div>
                {s.added || s.removed ? (
                  <TokenRow
                    tokens={tokensFor(s.added ? s.after : s.before, {})}
                    label={tokensA11y(s.added ? s.after : s.before, {})}
                    size={22}
                    class="mt-2"
                  />
                ) : (
                  <ul class="mt-1">
                    {rows.map((t) => (
                      <Delta key={t} type={t} before={s.before[t] ?? 0} after={s.after[t] ?? 0} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {diff.equivalents.length > 0 && <Foods rows={diff.equivalents} />}
          {diff.details.length > 0 && (
            <p class="caption mt-3">
              {planLines.planOtherChanged}: {diff.details.map((k) => labels.planFields[k]).join(', ')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
