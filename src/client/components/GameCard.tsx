// Optional cards on Today: yesterday's open meals (one tap each) and the Monday look back.
import { Check, ChevronRight, History, X } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { slotState } from '../../shared/domain/status';
import { flowerModel } from '../../shared/game/garden';
import { fullDots, weekDots } from '../../shared/game/momentum';
import { logMeal } from '../actions';
import { buttons, gameCopy } from '../copy/es-MX';
import { pick } from '../copy/pick';
import { backfillDay, backfillDismissed, dismissBackfill, dismissRecap, gardenLogs, recapDay } from '../game';
import { balanceOn, levelBefore, todayInput } from '../state/selectors';
import { planForDay, plans, today } from '../state/signals';
import { dayTargets, suggestionsFor } from '../state/today-vm';
import { selectDay } from '../state/ui';
import { MiniPlant } from './LazyPlant';

export function GameCard() {
  const [busy, setBusy] = useState(false);
  const day = backfillDay.value;
  const plan = day ? planForDay(plans.value, day) : null;
  const slotIndex =
    plan?.data.slots.findIndex(
      (s) =>
        !backfillDismissed.value.includes(s.key) &&
        !slotState(
          gardenLogs.value.filter((l) => l.day === day && l.slot === s.key),
          s.target,
          plan.data.swaps,
        ).resolved,
    ) ?? -1;
  const slot = plan && slotIndex >= 0 ? plan.data.slots[slotIndex] : undefined;
  const dots = weekDots(gardenLogs.value, addDays(today.value, -1));
  const n = fullDots(dots);
  const recapLine = useMemo(
    () => pick(n >= 5 ? 'week.recap.strong' : n >= 3 ? 'week.recap.ok' : 'week.recap.low', { n }),
    [n, today.value],
  );
  if (day && plan && slot) {
    const input = { ...todayInput.value, day, plan, logs: gardenLogs.value };
    const target =
      dayTargets({ plan, logs: gardenLogs.value, day, balance: balanceOn.value })[slotIndex] ?? slot.target;
    const top = suggestionsFor(input, slot.key, target)[0];
    const usual = async () => {
      if (busy || !top) return;
      setBusy(true);
      try {
        await logMeal({
          slot: slot.key,
          title: top.title,
          items: top.items,
          source: 'backfill',
          recipe_id: top.recipe_id,
          day,
          quiet: true,
        });
        await dismissBackfill(slot.key);
      } finally {
        setBusy(false);
      }
    };
    return (
      <section class="card anim-rise mb-4 p-3" data-testid="backfill">
        <div class="flex items-center gap-3">
          <span class="row-icon">
            <History size={19} aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="font-bold leading-5">{gameCopy.backfill}</h2>
            <p class="caption" data-testid="backfill-slot">
              {slot.label}
            </p>
          </div>
          <button
            type="button"
            class="icon-btn ghost"
            aria-label={buttons.forgot}
            title={buttons.forgot}
            disabled={busy}
            onClick={() => void dismissBackfill(slot.key)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div class="mt-2.5 flex gap-2">
          <button
            type="button"
            class="btn btn-tonal btn-sm flex-1"
            disabled={busy || !top}
            onClick={() => void usual()}
          >
            <Check size={18} strokeWidth={3} aria-hidden="true" />
            {buttons.usual}
          </button>
          <button
            type="button"
            class="btn btn-neutral btn-sm px-3"
            aria-label={buttons.seeYesterday}
            title={buttons.seeYesterday}
            onClick={() => selectDay(day)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
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
