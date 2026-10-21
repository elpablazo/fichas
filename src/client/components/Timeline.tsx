// The day's meals in time order: what's logged, what's left, one-tap "Anotar" for anything still open.
import { Check, ChevronRight, Plus, Scale, SkipForward } from 'lucide-preact';
import { a11y, buttons, labels, lines, titles } from '../copy/es-MX';
import type { DayVM, SlotVM } from '../state/today-vm';
import { eatenOf, TokenRow, tokensA11y } from './Token';

function Indicator({ state }: { state: SlotVM['state'] }) {
  if (state === 'done')
    return (
      <span
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style="background: var(--accent); color: var(--on-accent)"
        role="img"
        aria-label={a11y.logged}
      >
        <Check size={19} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (state === 'skipped')
    return (
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3">
        <SkipForward size={16} aria-hidden="true" />
      </span>
    );
  return (
    <span
      class="h-9 w-9 shrink-0 rounded-full"
      style={state === 'pending' ? 'border: 2px dashed var(--line-2)' : 'border: 2px solid var(--line)'}
    />
  );
}

interface RowProps {
  slot: SlotVM;
  onOpen: () => void;
  onQuickLog?: (anchor: Element | null) => void;
}

export function SlotRow({ slot, onOpen, onQuickLog }: RowProps) {
  const sub = slot.state === 'skipped' ? lines.skipped : slot.dish;
  return (
    <div class="flex items-center gap-3 py-2.5" data-slot={slot.key}>
      <button type="button" class="press flex min-w-0 flex-1 items-start gap-3 rounded-2xl text-left" onClick={onOpen}>
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
          {slot.state !== 'skipped' && slot.tokens.length > 0 && (
            <TokenRow
              class="mt-1.5"
              tokens={slot.tokens}
              size={17}
              label={tokensA11y(slot.target, eatenOf(slot.tokens))}
            />
          )}
        </span>
      </button>
      {slot.state === 'pending' && onQuickLog ? (
        <button
          type="button"
          class="btn btn-tonal btn-sm shrink-0 gap-1.5 px-3"
          aria-label={`${buttons.quickLog}: ${slot.label}`}
          data-testid={`pending-${slot.key}`}
          onClick={(e) => onQuickLog(e.currentTarget)}
        >
          <Check size={17} strokeWidth={3} aria-hidden="true" />
          {buttons.quickLog}
        </button>
      ) : (
        <ChevronRight size={20} class="shrink-0 text-ink-3" aria-hidden="true" />
      )}
    </div>
  );
}

interface Props {
  vm: DayVM;
  onOpen: (slot: string) => void;
  onQuickLog?: (slot: string, anchor: Element | null) => void;
  onExtra?: () => void;
}

export function Timeline({ vm, onOpen, onQuickLog, onExtra }: Props) {
  return (
    <section class="card mb-4 px-4 py-1" aria-label={titles.yourMeals}>
      <h2 class="sr-only">{titles.yourMeals}</h2>
      <div class="divide">
        {vm.rows.map((r) => (
          <SlotRow
            key={r.key}
            slot={r}
            onOpen={() => onOpen(r.key)}
            onQuickLog={onQuickLog ? (a) => onQuickLog(r.key, a) : undefined}
          />
        ))}
        {vm.extras && (
          <div class="flex items-center gap-3 py-2.5" data-slot="extra">
            <button
              type="button"
              class="press flex min-w-0 flex-1 items-start gap-3 text-left"
              onClick={() => onOpen('extra')}
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                <Plus size={18} aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="font-bold">{labels.extraSlot}</span>
                <span class="secondary muted block truncate">{vm.extras.titles.join(' · ')}</span>
                <TokenRow
                  class="mt-1.5"
                  tokens={vm.extras.tokens}
                  size={17}
                  label={tokensA11y({}, eatenOf(vm.extras.tokens))}
                />
              </span>
            </button>
            <ChevronRight size={20} class="shrink-0 text-ink-3" aria-hidden="true" />
          </div>
        )}
        {onExtra && (
          <button
            type="button"
            class="press flex w-full items-center gap-3 py-3 text-left"
            data-testid="extra-row"
            onClick={onExtra}
          >
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2"
              style="box-shadow: inset 0 0 0 1.5px var(--line-2)"
            >
              <Plus size={18} aria-hidden="true" />
            </span>
            <span class="font-semibold text-ink-2">{buttons.extra}</span>
          </button>
        )}
      </div>
    </section>
  );
}
