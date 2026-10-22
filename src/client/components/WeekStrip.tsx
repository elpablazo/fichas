// Day navigation: the week (Mon–Sun) around the shown day, each day with its plant. Tap a day to open it.
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import { addDays, weekday } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import { flowerModel } from '../../shared/game/garden';
import { a11y, dates, stageLabels } from '../copy/es-MX';
import { levelBefore } from '../state/selectors';
import { liveLogs, livePlans, planForDay, plans, settings } from '../state/signals';
import { landing, selectDay } from '../state/ui';
import { MiniPlant } from './LazyPlant';

/** Monday of the week that contains a day. */
export function weekStart(day: string): string {
  return addDays(day, -((weekday(day) + 6) % 7));
}

const RANK = ['soil', 'seed', 'sprout', 'bud', 'bloom', 'full', 'gold'];

export function WeekStrip({ day, today }: { day: string; today: string }) {
  const input = useRef<HTMLInputElement>(null);
  // Today's plant pops when a log makes it grow a stage (not when the app opens).
  const seen = useRef<string | null>(null);
  let todayStage: string | null = null;
  const first = livePlans.value.map((p) => p.starts_on ?? today).sort()[0] ?? today;
  const tomorrow = addDays(today, 1);
  const start = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const pick = (d: string) => selectDay(d === today ? null : d);
  const clamp = (d: string) => (d > tomorrow ? today : d < first ? first : d);
  const closed = settings.value.last_closed_day;
  useEffect(() => {
    seen.current = todayStage;
  });
  return (
    <div class="mb-4">
      <div class="flex items-stretch gap-0.5">
        <button
          type="button"
          class="press grid w-8 shrink-0 place-items-center rounded-xl text-ink-3 disabled:opacity-30"
          aria-label={a11y.prevWeek}
          disabled={start <= first}
          onClick={() => pick(clamp(addDays(day, -7)))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div class="grid flex-1 grid-cols-7 gap-0.5" data-nowords>
          {days.map((d) => {
            const plan = planForDay(plans.value, d);
            const disabled = d > tomorrow || d < first || !plan;
            const selected = d === day;
            const m = plan
              ? flowerModel(plan.data, liveLogs.value, d, today, {
                  level: levelBefore(d),
                  closed: d < today || closed === d,
                })
              : null;
            const grew =
              d === today &&
              !!m &&
              seen.current !== null &&
              RANK.indexOf(m.stage) > RANK.indexOf(seen.current) &&
              Date.now() - landing.value < 3000;
            if (d === today) todayStage = m?.stage ?? null;
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-current={d === today ? 'date' : undefined}
                data-day={d}
                class="press relative flex flex-col items-center rounded-2xl pt-1 pb-0.5 transition-colors disabled:opacity-35"
                style={selected ? 'background: var(--accent-soft)' : ''}
                onClick={() => pick(d)}
              >
                {/* Named by content: "lunes 5, 2 comidas, Botón" (the visible "L 5" stays part of the name). */}
                <span
                  class={`text-[11px] font-bold leading-4 ${selected ? 'text-accent-ink' : 'text-ink-2'}`}
                  aria-hidden="true"
                >
                  {dates.initials[weekday(d)]}
                </span>
                <span class="sr-only">{dates.weekdaysLong[weekday(d)]} </span>
                <span
                  class={`num grid h-7 w-7 place-items-center rounded-full text-[15px] font-extrabold ${
                    d === today ? 'text-[color:var(--on-accent)]' : selected ? 'text-accent-ink' : ''
                  }`}
                  style={d === today ? 'background: var(--accent)' : ''}
                >
                  {Number(d.slice(8))}
                </span>
                <span class="sr-only">
                  , {(m?.n ?? 0) === 1 ? a11y.dayMealsOne : fill(a11y.dayMeals, { n: m?.n ?? 0 })}
                  {m ? `, ${stageLabels[m.stage]}` : ''}
                </span>
                <span key={m?.stage} class={d > today ? 'opacity-60' : grew ? 'anim-pop' : ''}>
                  <MiniPlant stage={m?.stage ?? 'soil'} species={m?.species ?? 'margarita'} size={26} />
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          class="press grid w-8 shrink-0 place-items-center rounded-xl text-ink-3 disabled:opacity-30"
          aria-label={a11y.nextWeek}
          disabled={addDays(start, 7) > tomorrow}
          onClick={() => pick(clamp(addDays(day, 7)))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <input
        ref={input}
        type="date"
        class="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        min={first}
        max={tomorrow}
        value={day}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v) pick(clamp(v));
        }}
      />
    </div>
  );
}

/** Opens the native date picker of the strip (older days). */
export function CalendarButton() {
  return (
    <button
      type="button"
      class="icon-btn"
      aria-label={a11y.pickDay}
      onClick={(e) => {
        const input = (e.currentTarget.closest('main') ?? document).querySelector<HTMLInputElement>('input[type=date]');
        if (!input) return;
        try {
          input.showPicker?.();
        } catch {
          input.focus();
          input.click();
        }
      }}
    >
      <CalendarDays size={20} aria-hidden="true" />
    </button>
  );
}
