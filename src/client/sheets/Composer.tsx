import { Plus } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { makeItem, naturalStep, stepOf, withQty } from '../../shared/domain/items';
import { autoTitle, equivalentUsage, fingerprint } from '../../shared/domain/recipes';
import { normalize } from '../../shared/domain/swaps';
import type { Equivalent, LogItem, TypeKey } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { roundTo, typesOf, unitsOfItems } from '../../shared/domain/units';
import { logMeal, updateLog } from '../actions';
import { Sheet } from '../components/Sheet';
import { TypeIcon } from '../components/Sprite';
import { Stepper } from '../components/Stepper';
import { TokenRow } from '../components/Token';
import { buttons, labels, lines, titles, typeLabels } from '../copy/es-MX';
import { dayVM } from '../state/selectors';
import { liveLogs, planForDay, plans, today } from '../state/signals';
import { closeSheet } from '../state/ui';
import { previewModel, slotRemaining } from './preview';

interface Props {
  slot: string;
  day?: string;
  items?: LogItem[];
  title?: string;
  logId?: string;
}

export default function Composer({ slot, day: dayProp, items: init = [], title: initTitle, logId }: Props) {
  const day = dayProp ?? today.value;
  const plan = planForDay(plans.value, day);
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const [items, setItems] = useState<LogItem[]>(init);
  const [initialFp] = useState(() => fingerprint(init));
  const usage = useMemo(() => equivalentUsage(liveLogs.value), []);
  const data = plan?.data;
  const target = data ? slotRemaining(slot, day, data, logId) : {};
  const targetTypes = typesOf(target);
  const [tab, setTab] = useState<TypeKey | 'others'>(targetTypes[0] ?? 'others');
  const [otherType, setOtherType] = useState<TypeKey | null>(null);
  if (!plan || !data) return null;

  const slotDef = data.slots.find((s) => s.key === slot);
  const slotLabel = slot === 'extra' ? labels.extraSlot : (slotDef?.label ?? '');
  const exampleIds = new Set((slotDef?.example?.items ?? []).flatMap((i) => i.options.map((o) => o.equivalent_id)));
  const foodsFor = (t: TypeKey): Equivalent[] =>
    data.equivalents
      .filter((e) => e.type === t)
      .map((e, i) => ({ e, score: (usage.get(e.id) ?? 0) * 10 + (exampleIds.has(e.id) ? 5 : 0) - i / 1000 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.e);

  const model = previewModel(items, slot, slotLabel, target, data);
  const normalized = normalize(unitsOfItems(items, data), target, data.swaps);
  const missing = (t: TypeKey) => (target[t] ?? 0) - (normalized[t] ?? 0);

  const add = (e: Equivalent) => {
    const i = items.findIndex((x) => x.equivalent_id === e.id);
    let next: LogItem[];
    if (i >= 0) {
      const it = items[i] as LogItem;
      next = items.map((x, j) => (j === i ? withQty(x, it.qty + e.qty, data) : x));
    } else {
      // First tap fills what's missing of that type (≥ 1 unit), so a full meal takes ≤ 8 taps.
      const need = Math.max(1, missing(e.type));
      const s = naturalStep(e.unit, e);
      next = [...items, makeItem(e, Math.max(s, roundTo(need * e.qty, s)))];
    }
    setItems(next);
    if (tab !== 'others') {
      const n2 = normalize(unitsOfItems(next, data), target, data.swaps);
      if ((target[e.type] ?? 0) - (n2[e.type] ?? 0) < 0.25) {
        const nextType = targetTypes.find((t) => (target[t] ?? 0) - (n2[t] ?? 0) >= 0.25);
        if (nextType) setTab(nextType);
      }
    }
  };

  const step = (i: number, dir: 1 | -1) => {
    const it = items[i];
    if (!it) return;
    const q = it.qty + dir * stepOf(it, data);
    setItems(q > 1e-6 ? items.map((x, j) => (j === i ? withQty(x, q, data) : x)) : items.filter((_, j) => j !== i));
  };

  const save = (anchor: Element | null) => {
    if (!items.length) return;
    const title = fingerprint(items) === initialFp && initTitle ? initTitle : autoTitle(items, data);
    const existing = logId ? liveLogs.value.find((l) => l.id === logId) : undefined;
    if (existing) void updateLog(existing, items);
    else void logMeal({ slot, title, items, source: 'compose', anchor, day: day !== today.value ? day : undefined });
    closeSheet();
  };

  const tabTypes: (TypeKey | 'others')[] = [...targetTypes, 'others'];
  const otherTypes = TYPE_KEYS.filter((t) => !targetTypes.includes(t));
  const shownType = tab === 'others' ? otherType : tab;
  const slotTime = vm?.rows.find((r) => r.key === slot)?.time;

  return (
    <Sheet
      label={titles.compose}
      onClose={closeSheet}
      header={
        <h2 class="title truncate">
          {titles.compose}{' '}
          <span class="font-semibold text-ink-2">
            · {slotLabel}
            {slotTime ? ` ${slotTime}` : ''}
          </span>
        </h2>
      }
      footer={
        <>
          {items.length > 0 && (
            <p class="secondary mb-2 font-semibold" data-testid="status-line">
              {model.line}
            </p>
          )}
          <button
            type="button"
            class="btn btn-primary w-full"
            disabled={!items.length}
            data-testid="compose-log"
            onClick={(e) => save(e.currentTarget)}
          >
            {buttons.log}
          </button>
        </>
      }
    >
      {model.tokens.length > 0 && (
        <div class="well mb-3 p-3">
          <TokenRow tokens={model.tokens} size={24} label={model.line} />
        </div>
      )}
      <div class="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1" role="tablist">
        {tabTypes.map((t) => (
          <button key={t} type="button" role="tab" class="chip" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'others' ? (
              labels.others
            ) : (
              <>
                <TypeIcon type={t} size={18} /> {typeLabels[t].short}
              </>
            )}
          </button>
        ))}
      </div>
      {tab === 'others' && (
        <div class="mb-2 flex flex-wrap gap-2">
          {otherTypes.map((t) => (
            <button
              key={t}
              type="button"
              class="chip filled"
              aria-pressed={otherType === t}
              onClick={() => setOtherType(t)}
            >
              <TypeIcon type={t} size={18} /> {typeLabels[t].short}
            </button>
          ))}
        </div>
      )}
      <p class="caption mb-2 px-1">{lines.composeHelp}</p>
      {shownType && (
        <div class="mb-4 flex flex-wrap gap-2" role="tabpanel">
          {foodsFor(shownType).map((e) => (
            <button key={e.id} type="button" class="chip" data-testid="food" onClick={() => add(e)}>
              <Plus size={15} strokeWidth={2.6} class="text-accent-ink" aria-hidden="true" />
              {e.food}
            </button>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div class="grid border-line border-t pt-2">
          {items.map((it, i) => (
            <Stepper
              key={i}
              label={it.label}
              onMinus={() => step(i, -1)}
              onPlus={() => step(i, 1)}
              note={it.estimated ? labels.estimated : null}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
