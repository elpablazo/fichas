import { Blocks, Camera, Pencil, Trash2 } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { stepOf, withQty } from '../../shared/domain/items';
import { isProvisional } from '../../shared/domain/status';
import type { LogRow } from '../../shared/domain/types';
import { deleteLog, updateLog } from '../actions';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { VerdictChip } from '../components/Timeline';
import { a11y, buttons, labels, lines, titles } from '../copy/es-MX';
import { dayVM } from '../state/selectors';
import { liveLogs, planForDay, plans, today } from '../state/signals';
import { closeSheet, openDescribe, openSheet } from '../state/ui';

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
  const photo = useRef<HTMLInputElement>(null);
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const row = vm?.rows.find((r) => r.key === slot);
  const label =
    slot === 'extra' ? labels.extraSlot : (row?.label ?? plan.data.slots.find((s) => s.key === slot)?.label ?? '');
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const here = dayLogs.filter((l) => l.slot === slot && l.kind !== 'skip');
  const skipped = dayLogs.some((l) => l.slot === slot && l.kind === 'skip');
  const pastDay = day !== today.value ? day : undefined;

  const header = (
    <div class="flex min-w-0 items-center gap-2">
      <h2 class="title truncate">
        {label}
        {row && <span class="font-semibold text-ink-2"> {row.time}</span>}
      </h2>
      {row?.verdict && <VerdictChip verdict={row.verdict} />}
    </div>
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
          if (file) openDescribe({ slot, day: pastDay, photo: file });
        }}
      />
      {skipped && !here.length && <p class="badge mb-3">{lines.skipped}</p>}

      {here.map((l) => (
        <LoggedMeal key={l.id} log={l} />
      ))}

      <h3 class="kicker mb-2 px-1">{here.length ? titles.addMore : titles.logMeal}</h3>
      <div class="grid grid-cols-3 gap-2">
        <Tile
          icon={<Pencil size={22} aria-hidden="true" />}
          label={buttons.describe}
          testid="tile-describe"
          onClick={() => openDescribe({ slot, day: pastDay })}
        />
        <Tile
          icon={<Camera size={22} aria-hidden="true" />}
          label={buttons.photo}
          onClick={() => photo.current?.click()}
        />
        <Tile
          icon={<Blocks size={22} aria-hidden="true" />}
          label={buttons.compose}
          onClick={() => openSheet({ kind: 'compose', slot, day: pastDay })}
        />
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
