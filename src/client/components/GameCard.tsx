// Optional cards on Today: yesterday's open meals and the Monday look back.
import { History, X } from 'lucide-preact';
import { useMemo } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import { slotState } from '../../shared/domain/status';
import { flowerModel } from '../../shared/game/garden';
import { fullDots, weekDots } from '../../shared/game/momentum';
import { a11y, buttons, gameCopy } from '../copy/es-MX';
import { pick } from '../copy/pick';
import { backfillDay, backfillDismissed, dismissBackfill, dismissRecap, gardenLogs, recapDay } from '../game';
import { levelBefore } from '../state/selectors';
import { planForDay, plans, today } from '../state/signals';
import { selectDay } from '../state/ui';
import { MiniPlant } from './LazyPlant';

export function GameCard() {
  const day = backfillDay.value;
  const plan = day ? planForDay(plans.value, day) : null;
  // Yesterday's open meals, said plainly. Logging happens on that day's own screen, never blind.
  const open =
    plan?.data.slots.filter(
      (s) =>
        !backfillDismissed.value.includes(s.key) &&
        !slotState(
          gardenLogs.value.filter((l) => l.day === day && l.slot === s.key),
          s.target,
          plan.data.swaps,
        ).resolved,
    ) ?? [];
  const dots = weekDots(gardenLogs.value, addDays(today.value, -1));
  const n = fullDots(dots);
  const recapLine = useMemo(
    () => pick(n >= 5 ? 'week.recap.strong' : n >= 3 ? 'week.recap.ok' : 'week.recap.low', { n }),
    [n, today.value],
  );
  if (day && plan && open.length) {
    return (
      <section class="card anim-rise mb-3 flex items-center gap-3 p-3" data-testid="backfill">
        <span class="row-icon">
          <History size={19} aria-hidden="true" />
        </span>
        <p class="min-w-0 flex-1 font-bold leading-5" data-testid="backfill-line">
          {open.length === 1 ? gameCopy.backfillOne : fill(gameCopy.backfillMany, { n: open.length })}
        </p>
        <button type="button" class="btn btn-tonal btn-sm shrink-0 px-3" onClick={() => selectDay(day)}>
          {buttons.seeYesterday}
        </button>
        <button
          type="button"
          class="icon-btn ghost -mr-1"
          aria-label={a11y.dismiss}
          title={a11y.dismiss}
          onClick={() => void dismissBackfill(open.map((s) => s.key))}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </section>
    );
  }
  const recap = recapDay.value;
  const p = planForDay(plans.value, addDays(today.value, -1));
  if (!recap || !p) return null;
  return (
    <button
      type="button"
      class="card press anim-rise mb-4 w-full p-3 text-left"
      onClick={() => void dismissRecap()}
      aria-label={recapLine}
    >
      <span class="flex justify-between px-1">
        {weekDots(gardenLogs.value, addDays(recap, -1)).map((d) => {
          const m = flowerModel(planForDay(plans.value, d.day)?.data ?? p.data, gardenLogs.value, d.day, today.value, {
            level: levelBefore(d.day),
          });
          return <MiniPlant key={d.day} stage={m.stage} species={m.species} size={40} />;
        })}
      </span>
      <span class="mt-1 block text-center font-bold">{recapLine}</span>
    </button>
  );
}
