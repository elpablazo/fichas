// Weight entry: any date, prefilled with the last weigh-in, ±0.1 steppers or typing, home or nutritionist scale.
import { CalendarDays, Minus, Plus, Trash2 } from 'lucide-preact';
import { useRef, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { dayLabel } from '../../shared/domain/format';
import type { WeighinRow } from '../../shared/domain/types';
import { analyzeWeight } from '../../shared/domain/weight';
import { Sheet } from '../components/Sheet';
import { a11y, buttons, dates } from '../copy/es-MX';
import { storyCopy, weightCopy } from '../copy/more';
import { writeRow } from '../db/outbox';
import { today, weighins } from '../state/signals';
import { closeSheet, showToast } from '../state/ui';

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function WeighIn({ id }: { id?: string }) {
  const existing = id ? weighins.value.find((w) => w.id === id && !w.deleted_at) : undefined;
  const live = weighins.value.filter((w) => !w.deleted_at);
  const a = analyzeWeight(live);
  const initial = existing?.kg ?? (a.latest ? round1(a.latest.kg) : null);
  const [kg, setKg] = useState<number | null>(initial);
  const [text, setText] = useState(initial !== null ? initial.toFixed(1) : '');
  const [day, setDay] = useState(existing?.day ?? today.value);
  const [source, setSource] = useState<WeighinRow['source']>(existing?.source ?? 'home');
  const [busy, setBusy] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const repeat = useRef<{
    wait?: ReturnType<typeof setTimeout>;
    every?: ReturnType<typeof setInterval>;
    held?: boolean;
  }>({});
  const valid = kg !== null && kg > 20 && kg < 400;

  const set = (v: number) => {
    const n = round1(Math.min(399.9, Math.max(20.1, v)));
    setKg(n);
    setText(n.toFixed(1));
  };
  const nudge = (d: number) => {
    if (repeat.current.held) {
      repeat.current.held = false;
      return;
    }
    set((kg ?? initial ?? 70) + d);
  };
  // Holding a stepper repeats after a pause; a tap is handled by onClick alone.
  const startRepeat = (d: number) => {
    stopRepeat();
    repeat.current.held = false;
    let value = kg ?? initial ?? 70;
    repeat.current.wait = setTimeout(() => {
      repeat.current.held = true;
      repeat.current.every = setInterval(() => {
        value += d;
        set(value);
      }, 80);
    }, 420);
  };
  const stopRepeat = () => {
    clearTimeout(repeat.current.wait);
    clearInterval(repeat.current.every);
    repeat.current = { held: repeat.current.held };
  };

  const save = async () => {
    if (!valid || busy || kg === null) return;
    setBusy(true);
    try {
      const at = Date.now();
      const row: WeighinRow = {
        id: existing?.id ?? crypto.randomUUID(),
        day,
        kg,
        source,
        created_at: existing?.created_at ?? at,
        deleted_at: null,
        updated_at: at,
        rev: existing?.rev ?? 0,
      };
      await writeRow('weighins', row);
      closeSheet();
      showToast(existing ? weightCopy.updated : storyCopy.saved, () => {
        void writeRow(
          'weighins',
          existing
            ? { ...existing, updated_at: Date.now() }
            : { ...row, deleted_at: Date.now(), updated_at: Date.now() },
        );
      });
    } catch {
      showToast(storyCopy.retry);
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    await writeRow('weighins', { ...existing, deleted_at: Date.now(), updated_at: Date.now() });
    closeSheet();
    showToast(
      weightCopy.deleted,
      () => void writeRow('weighins', { ...existing, deleted_at: null, updated_at: Date.now() }),
    );
  };

  const yesterday = addDays(today.value, -1);
  const other = day !== today.value && day !== yesterday;
  const title = existing ? weightCopy.edit : storyCopy.weigh;
  return (
    <Sheet
      label={title}
      onClose={closeSheet}
      header={<h2 class="title">{title}</h2>}
      footer={
        <button
          type="button"
          class="btn btn-primary w-full"
          data-testid="weight-save"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {buttons.saveWeight}
        </button>
      }
    >
      <div class="flex items-center justify-center gap-4 py-5">
        <button
          type="button"
          class="icon-btn lg"
          aria-label={`${a11y.stepDown} 0.1 ${storyCopy.kg}`}
          onClick={() => nudge(-0.1)}
          onPointerDown={() => startRepeat(-0.1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          <Minus size={24} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <label class="flex items-baseline gap-1.5">
          <input
            class="num w-[4.6ch] bg-transparent text-center text-[52px] font-extrabold leading-none tracking-tight outline-none"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={storyCopy.weight}
            placeholder="0.0"
            data-testid="weight-input"
            value={text}
            onInput={(e) => {
              const v = e.currentTarget.value.replace(',', '.');
              setText(v);
              const n = Number(v);
              setKg(v && Number.isFinite(n) ? round1(n) : null);
            }}
            onBlur={() => kg !== null && setText(kg.toFixed(1))}
          />
          <span class="headline text-ink-2">{storyCopy.kg}</span>
        </label>
        <button
          type="button"
          class="icon-btn lg"
          aria-label={`${a11y.stepUp} 0.1 ${storyCopy.kg}`}
          onClick={() => nudge(0.1)}
          onPointerDown={() => startRepeat(0.1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
          onPointerCancel={stopRepeat}
        >
          <Plus size={24} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>

      <p class="kicker mb-2 px-1">{weightCopy.date}</p>
      <div class="mb-4 flex flex-wrap gap-2">
        <button type="button" class="chip" aria-pressed={day === today.value} onClick={() => setDay(today.value)}>
          {dates.today}
        </button>
        <button type="button" class="chip" aria-pressed={day === yesterday} onClick={() => setDay(yesterday)}>
          {dates.yesterday}
        </button>
        <button
          type="button"
          class="chip"
          aria-pressed={other}
          onClick={() => {
            const input = dateInput.current;
            try {
              input?.showPicker?.();
            } catch {
              input?.focus();
            }
          }}
        >
          <CalendarDays size={16} aria-hidden="true" />
          {other ? dayLabel(day) : weightCopy.otherDay}
        </button>
        <input
          ref={dateInput}
          type="date"
          class="sr-only"
          tabIndex={-1}
          aria-label={weightCopy.date}
          max={today.value}
          value={day}
          onChange={(e) => e.currentTarget.value && setDay(e.currentTarget.value)}
        />
      </div>

      <p class="kicker mb-2 px-1">{weightCopy.source}</p>
      <div class="mb-2 flex flex-wrap gap-2">
        <button type="button" class="chip" aria-pressed={source === 'home'} onClick={() => setSource('home')}>
          {storyCopy.home}
        </button>
        <button
          type="button"
          class="chip"
          aria-pressed={source === 'nutritionist'}
          onClick={() => setSource('nutritionist')}
        >
          {storyCopy.nutritionist}
        </button>
      </div>
      <p class="caption mt-3 px-1">{weightCopy.noise}</p>
      {existing && (
        <button
          type="button"
          class="btn btn-ghost btn-sm mt-3 w-full"
          style="color: var(--destructive)"
          onClick={() => void remove()}
        >
          <Trash2 size={17} aria-hidden="true" />
          {buttons.deleteEntry}
        </button>
      )}
    </Sheet>
  );
}
