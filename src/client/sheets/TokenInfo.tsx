import { ChevronDown, Leaf } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { fill, itemLabel } from '../../shared/domain/format';
import { equivalentUsage } from '../../shared/domain/recipes';
import type { Equivalent, TypeKey } from '../../shared/domain/types';
import { Sheet } from '../components/Sheet';
import { buttons, labels, lines, titles, typeLabels } from '../copy/es-MX';
import { activePlan, liveLogs } from '../state/signals';
import { closeSheet } from '../state/ui';

/** "Rinde más" (R16): large volume per unit. */
export function highVolume(e: Equivalent): boolean {
  return (
    (e.unit === 'tza' && e.qty >= 1) ||
    (e.unit === 'pza' && e.qty >= 2) ||
    e.food.includes('palomitas') ||
    (e.type === 'veg' && e.note === 'crudo')
  );
}

/** Notes shown next to an equivalent; calorie notes are never displayed (R13). */
export function visibleNote(e: Equivalent): string | null {
  if (!e.note || /kcal|calor/i.test(e.note)) return null;
  return e.note;
}

export function EquivalentRow({ e }: { e: Equivalent }) {
  const note = visibleNote(e);
  return (
    <li class="flex min-h-12 items-center justify-between gap-2 py-2">
      <span class="min-w-0">
        <span class="font-semibold">{itemLabel(e.food, e.qty, e.unit, false)}</span>
        {note && <span class="caption ml-2">{note}</span>}
        {e.flag === 'check_portion' && <span class="caption block">{lines.checkPortion}</span>}
      </span>
      {highVolume(e) && (
        <span class="badge leaf shrink-0">
          <Leaf size={12} aria-hidden="true" />
          {labels.moreYield}
        </span>
      )}
    </li>
  );
}

export default function TokenInfo({ type }: { type: TypeKey }) {
  const [all, setAll] = useState(false);
  const plan = activePlan.value;
  if (!plan) return null;
  const usage = equivalentUsage(liveLogs.value);
  const list = plan.data.equivalents
    .filter((e) => e.type === type)
    .map((e, i) => ({ e, i, n: usage.get(e.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.e);
  const shown = all ? list : list.slice(0, 6);
  const meta = typeLabels[type];
  return (
    <Sheet
      label={meta.label}
      onClose={closeSheet}
      header={
        <h2 class="title flex items-center gap-2.5">
          <span class={`tok tok-1 t-${type}`} style="--s:34px" aria-hidden="true">
            <span class="e">{meta.emoji}</span>
          </span>
          {fill(titles.tokenInfo, { type: meta.short })}
        </h2>
      }
    >
      <ul class="divide px-1">
        {shown.map((e) => (
          <EquivalentRow key={e.id} e={e} />
        ))}
      </ul>
      {!all && list.length > 6 && (
        <button type="button" class="btn btn-neutral mt-2 w-full" onClick={() => setAll(true)}>
          {buttons.seeAll}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      )}
    </Sheet>
  );
}
