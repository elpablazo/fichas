// One day of the garden: its plant, how it grew, and a way back to that day.
import { ArrowRight } from 'lucide-preact';
import { dayLong, fill } from '../../shared/domain/format';
import { bloomed, flowerModel } from '../../shared/game/garden';
import { SPECIES_BY_ID } from '../../shared/game/species';
import { speciesText } from '../../shared/game/species-text';
import { Plant } from '../components/Plant';
import { Sheet } from '../components/Sheet';
import { buttons, stageLabels } from '../copy/es-MX';
import { gardenCopy } from '../copy/more';
import { gardenLogs } from '../game';
import { levelBefore } from '../state/selectors';
import { planForDay, plans, settings, today } from '../state/signals';
import { closeSheet, navigate, selectDay } from '../state/ui';

export default function PlantInfo({ day }: { day: string }) {
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const m = flowerModel(plan.data, gardenLogs.value, day, today.value, {
    level: levelBefore(day),
    closed: day < today.value || settings.value.last_closed_day === day,
  });
  const sp = bloomed(m) ? SPECIES_BY_ID.get(m.species) : undefined;
  const title = dayLong(day);
  return (
    <Sheet label={title} onClose={closeSheet} header={<h2 class="title first-letter:uppercase">{title}</h2>}>
      <div
        class="mb-4 flex flex-col items-center rounded-[24px] pt-3 pb-5 text-center"
        style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1))"
      >
        <Plant stage={m.stage} species={m.species} size={150} sway={m.today} grow />
        <p class="title">{sp ? speciesText(sp.id).name : stageLabels[m.stage]}</p>
        {sp && <p class="secondary muted italic">{speciesText(sp.id).latin}</p>}
        {sp && <p class="secondary mt-2 max-w-[32ch]">{speciesText(sp.id).fact}</p>}
        {!sp && m.today && <p class="secondary muted mt-1">{gardenCopy.secret}</p>}
        <p class="badge mt-3">
          {m.n === 0
            ? gardenCopy.plantNone
            : m.n === 1
              ? gardenCopy.plantDayOne
              : fill(gardenCopy.plantDay, { n: m.n })}
        </p>
      </div>
      {!m.future && (
        <button
          type="button"
          class="btn btn-tonal w-full"
          onClick={() => {
            selectDay(day === today.value ? null : day);
            closeSheet();
            navigate('/');
          }}
        >
          {buttons.seeDay}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </Sheet>
  );
}
