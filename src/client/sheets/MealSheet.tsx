import { Blocks, Camera, Pencil, Plus, ShoppingBasket, SkipForward, Trash2 } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { fit } from '../../shared/domain/fit';
import { stepOf, withQty } from '../../shared/domain/items';
import { remainingTarget } from '../../shared/domain/log';
import { equivalentUsage, preferredEquivalent } from '../../shared/domain/recipes';
import { computeStatus, isProvisional } from '../../shared/domain/status';
import { tokensFor } from '../../shared/domain/tokens';
import type { LogItem, LogRow, RecipeRow } from '../../shared/domain/types';
import { unitsOfItems } from '../../shared/domain/units';
import { deleteLog, logMeal, skipSlot, targetFor, updateLog } from '../actions';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { TokenRow, tokensA11y } from '../components/Token';
import { a11y, buttons, labels, lines, titles } from '../copy/es-MX';
import { dayVM } from '../state/selectors';
import { liveLogs, liveRecipes, planForDay, plans, today } from '../state/signals';
import { closeSheet, kitchenSlot, navigate, openDescribe, openSheet } from '../state/ui';

function Tile({
  icon,
  label,
  onClick,
  testid,
}: {
  icon: ComponentChildren;
  label: string;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      class="press flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-surface-2 px-2 text-center text-[14px] font-bold leading-4"
      data-testid={testid}
      onClick={onClick}
    >
      <span class="text-accent-ink">{icon}</span>
      {label}
    </button>
  );
}

export default function MealSheet({ slot, day: dayProp }: { slot: string; day?: string }) {
  const day = dayProp ?? today.value;
  const [mode, setMode] = useState<'slot' | 'extra'>(slot === 'extra' ? 'extra' : 'slot');
  const photo = useRef<HTMLInputElement>(null);
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const data = plan.data;
  const key = mode === 'extra' ? 'extra' : slot;
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const slotVM = vm?.card?.key === slot ? vm.card : vm?.rows.find((r) => r.key === slot);
  const slotDef = data.slots.find((s) => s.key === slot);
  const label = mode === 'extra' ? labels.extraSlot : (slotVM?.label ?? slotDef?.label ?? '');
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const here = dayLogs.filter((l) => l.slot === key && l.kind !== 'skip');
  const skipped = dayLogs.find((l) => l.slot === key && l.kind === 'skip');
  const target = mode === 'extra' ? {} : (slotVM?.target ?? targetFor(slot, day));
  const remaining = remainingTarget(target, here, data.swaps);
  const preferred = preferredEquivalent(data, equivalentUsage(liveLogs.value), key);
  const pastDay = day !== today.value ? day : undefined;

  const dishes: { r: RecipeRow; items: LogItem[] }[] = liveRecipes.value
    .filter((r) => !r.hidden && r.items.length && (mode === 'extra' ? r.times > 0 : r.slot_counts[slot] !== undefined))
    .sort((a, b) =>
      mode === 'extra'
        ? (b.last_used_at ?? 0) - (a.last_used_at ?? 0)
        : b.favorite - a.favorite ||
          (b.slot_counts[slot] ?? 0) - (a.slot_counts[slot] ?? 0) ||
          (b.last_used_at ?? 0) - (a.last_used_at ?? 0),
    )
    .slice(0, 6)
    .map((r) => ({
      r,
      items:
        mode === 'extra' || !Object.keys(remaining).length
          ? r.items
          : fit(r.items, remaining, { plan: data, rules: data.swaps, preferred }).items,
    }));

  const header = (
    <h2 class="title truncate">
      {label}
      {mode === 'slot' && slotVM && <span class="font-semibold text-ink-2"> {slotVM.time}</span>}
    </h2>
  );

  return (
    <Sheet label={label} onClose={closeSheet} header={header}>
      <input
        ref={photo}
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={lines.photoInput}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) openDescribe({ slot: key, day: pastDay, photo: file });
        }}
      />
      {skipped && !here.length && <p class="badge mb-3">{lines.skipped}</p>}

      {here.map((l) => (
        <LoggedMeal key={l.id} log={l} />
      ))}

      {dishes.length > 0 && (
        <section class="mb-4">
          <h3 class="kicker mb-2 px-1">{titles.yourDishes}</h3>
          <div class="grid gap-2">
            {dishes.map(({ r, items }) => {
              const units = unitsOfItems(items, data);
              const tokens =
                mode === 'extra'
                  ? tokensFor({}, units)
                  : tokensFor(remaining, computeStatus(units, remaining, data.swaps).normalized);
              return (
                <button
                  key={r.id}
                  type="button"
                  class="press well px-4 py-3 text-left"
                  data-testid="dish"
                  onClick={(e) => {
                    void logMeal({
                      slot: key,
                      title: r.title,
                      items,
                      source: 'recent',
                      recipe_id: r.id,
                      anchor: e.currentTarget,
                      day: pastDay,
                    });
                    closeSheet();
                  }}
                >
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-bold">{r.title}</span>
                    {r.times > 0 && <span class="caption num shrink-0">×{r.times}</span>}
                  </div>
                  <div class="secondary muted mt-0.5 line-clamp-2">{items.map((i) => i.label).join(' · ')}</div>
                  {tokens.length > 0 && (
                    <TokenRow class="mt-2" tokens={tokens} size={16} label={tokensA11y(remaining, units)} />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {!dishes.length && !here.length && <p class="secondary muted mb-4 px-1">{lines.emptyDishes}</p>}

      <div class="grid grid-cols-3 gap-2">
        <Tile
          icon={<Pencil size={22} aria-hidden="true" />}
          label={buttons.describe}
          onClick={() => openDescribe({ slot: key, day: pastDay })}
        />
        <Tile
          icon={<Camera size={22} aria-hidden="true" />}
          label={buttons.photo}
          onClick={() => photo.current?.click()}
        />
        <Tile
          icon={<Blocks size={22} aria-hidden="true" />}
          label={buttons.compose}
          onClick={() => openSheet({ kind: 'compose', slot: key, day: pastDay })}
        />
        {mode === 'slot' && (
          <Tile
            icon={<ShoppingBasket size={22} aria-hidden="true" />}
            label={buttons.fromPantry}
            onClick={() => {
              kitchenSlot.value = slot;
              closeSheet();
              navigate('/cocina');
            }}
          />
        )}
        {mode === 'slot' && !skipped && !here.some((l) => l.kind === 'meal') && (
          <Tile
            icon={<SkipForward size={22} aria-hidden="true" />}
            label={buttons.skip}
            testid="skip"
            onClick={() => {
              void skipSlot(slot, day);
              closeSheet();
            }}
          />
        )}
        {mode === 'slot' && (
          <Tile
            icon={<Plus size={22} aria-hidden="true" />}
            label={buttons.extra}
            testid="extra"
            onClick={() => setMode('extra')}
          />
        )}
      </div>
    </Sheet>
  );
}

function LoggedMeal({ log }: { log: LogRow }) {
  const plan = planForDay(plans.value, log.day)?.data ?? null;
  const change = (i: number, dir: 1 | -1) => {
    const it = log.items[i];
    if (!it) return;
    const q = Math.max(0, it.qty + dir * stepOf(it, plan));
    const items =
      q > 0 ? log.items.map((x, j) => (j === i ? withQty(x, q, plan) : x)) : log.items.filter((_, j) => j !== i);
    void updateLog(log, items);
  };
  return (
    <section
      class="mb-4 rounded-[20px] p-3"
      style="box-shadow: inset 0 0 0 1.5px var(--line)"
      data-testid="logged-meal"
    >
      <div class="mb-1 flex items-center justify-between gap-2 pl-1">
        <span class="font-bold">{log.title || labels.free}</span>
        <button type="button" class="icon-btn ghost text-ink-2" aria-label={a11y.remove} onClick={() => deleteLog(log)}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      {isProvisional(log) && <p class="caption px-1">{lines.pendingPortions}</p>}
      {log.items.map((it, i) =>
        it.free ? (
          <div key={i} class="secondary muted px-1 py-1">
            {it.label} · {labels.free}
          </div>
        ) : (
          <Stepper
            key={i}
            label={it.label}
            onMinus={() => change(i, -1)}
            onPlus={() => change(i, 1)}
            note={it.estimated ? labels.estimated : null}
          />
        ),
      )}
    </section>
  );
}
