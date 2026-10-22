import { useEffect, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import { bloomed, flowerModel } from '../../shared/game/garden';
import { casaLlena, diaRedondo } from '../../shared/game/momentum';
import { SPECIES_BY_ID } from '../../shared/game/species';
import { speciesText } from '../../shared/game/species-text';
import { setSetting } from '../actions';
import { Plant } from '../components/Plant';
import { Sheet } from '../components/Sheet';
import { TomorrowMenu } from '../components/TomorrowMenu';
import { weekStart } from '../components/WeekStrip';
import { buttons, gameCopy, stageLabels, titles } from '../copy/es-MX';
import { pickGame } from '../copy/game';
import { celebrateBig } from '../feedback/confetti';
import { playChord } from '../feedback/sound';
import { gardenLogs } from '../game';
import { levelBefore } from '../state/selectors';
import { planForDay, plans, today } from '../state/signals';
import { closeSheet } from '../state/ui';

export default function DayClose({ day }: { day: string }) {
  const plan = planForDay(plans.value, day);
  const tomorrow = addDays(day, 1);
  const [ready, setReady] = useState(false);
  const [line] = useState(() => {
    if (!plan) return '';
    const logs = gardenLogs.value.filter((l) => l.day === day && !l.deleted_at);
    return pickGame(
      diaRedondo(plan.data, logs, plan.data.swaps)
        ? 'dayClose.round'
        : casaLlena(plan.data, logs)
          ? 'dayClose.full'
          : 'dayClose.partial',
    );
  });
  const m = plan
    ? flowerModel(plan.data, gardenLogs.value, day, today.value, { level: levelBefore(day), closed: true })
    : null;
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1600);
    void setSetting('last_closed_day', day);
    playChord();
    if (m && (m.stage === 'full' || m.stage === 'gold')) requestAnimationFrame(() => celebrateBig(m.stage === 'gold'));
    return () => clearTimeout(t);
  }, [day]);
  if (!plan || !m) return null;
  const species = bloomed(m) ? SPECIES_BY_ID.get(m.species) : undefined;
  const start = weekStart(day);
  return (
    <Sheet label={buttons.closeDay} onClose={closeSheet} header={<h2 class="title">{buttons.closeDay}</h2>}>
      <div
        class="relative mb-4 flex flex-col items-center overflow-hidden rounded-[24px] px-4 pt-2 pb-4 text-center"
        style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1))"
        onClick={() => setReady(true)}
      >
        <Plant stage={m.stage} species={m.species} size={148} grow sway />
        <p class="title mt-1">{line}</p>
        <p class="secondary muted">
          {species ? speciesText(species.id).name : stageLabels[m.stage]} ·{' '}
          {m.n === 1 ? gameCopy.xpOne : fill(gameCopy.xp, { n: m.n })}
        </p>
        <div class="mt-3 flex gap-1" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i);
            const p = planForDay(plans.value, d);
            const f = p
              ? flowerModel(p.data, gardenLogs.value, d, today.value, { level: levelBefore(d), closed: d <= day })
              : null;
            return (
              <Plant
                key={d}
                stage={d > day ? 'soil' : (f?.stage ?? 'seed')}
                species={f?.species ?? 'margarita'}
                size={34}
              />
            );
          })}
        </div>
      </div>
      {!ready && (
        <button type="button" class="btn btn-neutral w-full" onClick={() => setReady(true)}>
          {buttons.tomorrow}
        </button>
      )}
      {ready && planForDay(plans.value, tomorrow) && (
        <section class="anim-rise">
          <h3 class="title mb-1">{titles.tomorrowMenu}</h3>
          <TomorrowMenu day={tomorrow} compact onSaved={closeSheet} />
        </section>
      )}
    </Sheet>
  );
}
