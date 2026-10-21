// The day's meals in order, one line each: what was eaten and a verdict you can read without counting
// ("En plan", "+1 🫓"). Open meals say so and log in one tap; a logged meal opens to edit.
import { Check, ChevronRight, Plus, Scale, SkipForward } from 'lucide-preact';
import { formatCount } from '../../shared/domain/units';
import { a11y, buttons, labels, lines, titles, typeLabels, verdictCopy } from '../copy/es-MX';
import type { DayVM, SlotVM, VerdictVM } from '../state/today-vm';

function Indicator({ state }: { state: SlotVM['state'] }) {
  if (state === 'done')
    return (
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style="background: var(--accent); color: var(--on-accent)"
        role="img"
        aria-label={a11y.logged}
      >
        <Check size={17} strokeWidth={3.2} aria-hidden="true" />
      </span>
    );
  if (state === 'skipped')
    return (
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3">
        <SkipForward size={15} aria-hidden="true" />
      </span>
    );
  return (
    <span
      class="h-8 w-8 shrink-0 rounded-full"
      style={
        state === 'pending'
          ? 'box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-soft)'
          : 'box-shadow: inset 0 0 0 2px var(--line-2)'
      }
    />
  );
}

/** "En plan", or the differences as facts: "+1 🫓", "−1 🍗". */
export function VerdictChip({ verdict, big = false }: { verdict: VerdictVM; big?: boolean }) {
  const style = big ? 'height:32px;font-size:15px;padding:0 12px' : undefined;
  if (verdict.status === 'on')
    return (
      <span class="verdict on" style={style}>
        <Check size={big ? 16 : 13} strokeWidth={3.2} aria-hidden="true" />
        {verdictCopy.on}
      </span>
    );
  const parts = [
    ...verdict.over.slice(0, 2).map((g) => `+${formatCount(g.n)} ${typeLabels[g.type].emoji}`),
    ...verdict.under.slice(0, 2).map((g) => `−${formatCount(g.n)} ${typeLabels[g.type].emoji}`),
  ].slice(0, 2);
  return (
    <span class="verdict num" style={style}>
      {parts.join(' ')}
    </span>
  );
}

interface RowProps {
  slot: SlotVM;
  onOpen: () => void;
  onLog?: () => void;
}

export function SlotRow({ slot, onOpen, onLog }: RowProps) {
  const sub =
    slot.state === 'skipped'
      ? lines.skipped
      : slot.provisional
        ? verdictCopy.pending
        : (slot.dish ?? (slot.state === 'pending' ? lines.notLogged : null));
  const right =
    slot.state === 'pending' && onLog ? (
      <button
        type="button"
        class="icon-btn shrink-0"
        style="background: var(--accent-soft); color: var(--accent-ink)"
        aria-label={`${buttons.quickLog}: ${slot.label}`}
        title={buttons.quickLog}
        data-testid={`pending-${slot.key}`}
        onClick={onLog}
      >
        <Plus size={20} strokeWidth={2.8} aria-hidden="true" />
      </button>
    ) : slot.verdict ? (
      <VerdictChip verdict={slot.verdict} />
    ) : (
      <ChevronRight size={20} class="shrink-0 text-ink-3" aria-hidden="true" />
    );
  return (
    <div class="flex items-center gap-3 py-2" data-slot={slot.key} data-state={slot.state}>
      <button
        type="button"
        class="press flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
        onClick={onOpen}
      >
        <Indicator state={slot.state} />
        <span class="min-w-0 flex-1">
          <span class="flex items-baseline gap-2">
            <span class="font-bold">{slot.label}</span>
            <span class="caption num">{slot.time}</span>
            {slot.adjusted && (
              <span class="text-accent-ink" title={lines.adjusted}>
                <Scale size={13} aria-hidden="true" />
                <span class="sr-only">{lines.adjusted}</span>
              </span>
            )}
          </span>
          {sub && <span class="secondary muted block truncate">{sub}</span>}
        </span>
      </button>
      {right}
    </div>
  );
}

interface Props {
  vm: DayVM;
  /** Opens a logged meal (edit) or starts logging an open one. */
  onOpen: (slot: SlotVM) => void;
  onLog: (slot: string) => void;
  onExtra: () => void;
  onOpenExtras: () => void;
}

export function Timeline({ vm, onOpen, onLog, onExtra, onOpenExtras }: Props) {
  return (
    <section class="card mb-3 px-4 py-1" aria-label={titles.yourMeals}>
      <h2 class="sr-only">{titles.yourMeals}</h2>
      <div class="divide">
        {vm.rows.map((r) => (
          <SlotRow key={r.key} slot={r} onOpen={() => onOpen(r)} onLog={() => onLog(r.key)} />
        ))}
        {vm.extras && (
          <div class="flex items-center gap-3 py-2" data-slot="extra">
            <button
              type="button"
              class="press flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
              onClick={onOpenExtras}
            >
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                <Plus size={17} aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="font-bold">{labels.extraSlot}</span>
                <span class="secondary muted block truncate">{vm.extras.titles.join(' · ')}</span>
              </span>
            </button>
            <ChevronRight size={20} class="shrink-0 text-ink-3" aria-hidden="true" />
          </div>
        )}
        <button
          type="button"
          class="press flex min-h-12 w-full items-center gap-3 py-2 text-left"
          data-testid="extra-row"
          onClick={onExtra}
        >
          <span
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2"
            style="box-shadow: inset 0 0 0 1.5px var(--line-2)"
          >
            <Plus size={17} aria-hidden="true" />
          </span>
          <span class="font-semibold text-ink-2">{buttons.extra}</span>
        </button>
      </div>
    </section>
  );
}
