// Cierre del día (also where the evening recap push lands): the day's plant in full bloom, how much of the plan it
// covered, a minute of learning (what was on plan, what was missing or over and why, one tip for tomorrow), the week
// of plants, then tomorrow's menu in one tap.
import { Check, Lightbulb } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { CATCH_UP, closing, dayStatus } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import { contributorName, type DayLesson, dayLesson } from '../../shared/domain/insights';
import { formatCount } from '../../shared/domain/units';
import { bloomed, flowerModel } from '../../shared/game/garden';
import { casaLlena, diaRedondo } from '../../shared/game/momentum';
import { speciesText } from '../../shared/game/species-text';
import { withArticle } from '../components/DayCard';
import { Plant } from '../components/Plant';
import { Ring } from '../components/Ring';
import { Sheet } from '../components/Sheet';
import { Txt, TypeIcon } from '../components/Sprite';
import { TomorrowMenu } from '../components/TomorrowMenu';
import { weekStart } from '../components/WeekStrip';
import { buttons, gameCopy, stageLabels, titles, typeLabels } from '../copy/es-MX';
import { pickGame } from '../copy/game';
import { dayCloseCopy } from '../copy/more';
import { celebrateBig } from '../feedback/confetti';
import { playChord } from '../feedback/sound';
import { gardenLogs } from '../game';
import { levelBefore } from '../state/selectors';
import { planForDay, plans, today } from '../state/signals';
import { closeSheet } from '../state/ui';

/** "2 🫓 y 2 🥑 · pan dulce": groups over for the same reason share one line. */
function overRows(over: DayLesson['over']) {
  const rows: { types: string[]; amounts: string; from: string }[] = [];
  for (const g of over) {
    const amount = `${formatCount(g.n)} ${typeLabels[g.type].emoji}`;
    const from = g.from.map((f) => contributorName(f)).join(', ');
    const same = from ? rows.find((r) => r.from === from) : undefined;
    if (same) {
      same.types.push(g.type);
      same.amounts = `${same.amounts} ${dayCloseCopy.and} ${amount}`;
    } else rows.push({ types: [g.type], amounts: amount, from });
  }
  return rows;
}

/** The tip for tomorrow (or for today, when last night's close is opened the next morning). */
function tipLine(tip: DayLesson['tip'], slotName: (key: string) => string, past: boolean): string {
  if (tip.kind === 'repeat') return past ? dayCloseCopy.tipRepeatPast : dayCloseCopy.tipRepeat;
  if (tip.kind === 'extra') return fill(dayCloseCopy.tipExtra, { food: tip.food });
  const vars = { slot: slotName(tip.slot), n: formatCount(tip.n), emoji: typeLabels[tip.type].emoji };
  if (tip.n <= 0) return fill(dayCloseCopy.tipNone, vars);
  // Vegetables and fruit are the ones worth starting a meal with; anything else is what the plan asks for there.
  return fill(
    tip.kind === 'missing' && CATCH_UP.includes(tip.type) ? dayCloseCopy.tipStart : dayCloseCopy.tipPlan,
    vars,
  );
}

export default function DayClose({ day }: { day: string }) {
  const plan = planForDay(plans.value, day);
  const tomorrow = addDays(day, 1);
  const [ready, setReady] = useState(false);
  const logs = gardenLogs.value.filter((l) => l.day === day && !l.deleted_at);
  const [line] = useState(() => {
    if (!plan) return '';
    // "Ni una fuera de lugar" only when nothing went over; the flower itself follows the garden's own rules.
    const exact = closing(dayStatus(plan.data, logs, false).meters).exact;
    return pickGame(
      exact && diaRedondo(plan.data, logs, plan.data.swaps)
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
    playChord();
    if (m && (m.stage === 'full' || m.stage === 'gold')) requestAnimationFrame(() => celebrateBig(m.stage === 'gold'));
    return () => clearTimeout(t);
  }, [day]);
  if (!plan || !m) return null;
  const data = plan.data;
  const c = closing(dayStatus(data, logs, false).meters);
  const lesson = dayLesson(data, logs);
  const species = bloomed(m) ? speciesText(m.species).name : stageLabels[m.stage];
  const slotName = (key: string) => withArticle(data.slots.find((s) => s.key === key)?.label ?? key);
  // Last night's close, opened the next morning: "tomorrow" is today.
  const past = day < today.value;
  const tipText = tipLine(lesson.tip, slotName, past);
  const start = weekStart(day);
  return (
    <Sheet label={dayCloseCopy.title} onClose={closeSheet} header={<h2 class="title">{dayCloseCopy.title}</h2>}>
      <div
        class="relative mb-4 flex flex-col items-center overflow-hidden rounded-[24px] px-4 pt-2 pb-4 text-center"
        style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1)); box-shadow: inset 0 0 0 1.5px var(--line)"
        onClick={() => setReady(true)}
      >
        <Plant stage={m.stage} species={m.species} size={148} grow sway />
        <p class="title mt-1">{line}</p>
        <p class="secondary muted">
          {species} · {m.n === 1 ? gameCopy.xpOne : fill(gameCopy.xp, { n: m.n })}
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

      <section class="impact mb-4" data-testid="day-lesson">
        <div class="flex items-center gap-3">
          <Ring value={c.pct} max={100} size={60} stroke={7} color={c.exact ? 'var(--gold)' : 'var(--accent)'}>
            <span class={`display num leading-none ${c.pct === 100 ? 'text-[15px]' : 'text-[17px]'}`}>
              {c.pct}
              <span class="text-[10px]">%</span>
            </span>
          </Ring>
          <p class="headline min-w-0 flex-1">
            {c.exact
              ? dayCloseCopy.exact
              : c.complete
                ? dayCloseCopy.complete
                : fill(dayCloseCopy.covered, { pct: c.pct })}
          </p>
        </div>
        {lesson.good.length > 0 && (
          <div class="mt-3 flex items-center gap-2">
            <span class="lesson-tag on">
              <Check size={14} strokeWidth={3.2} aria-hidden="true" />
              {dayCloseCopy.good}
            </span>
            <span class="flex flex-wrap gap-1">
              {lesson.good.map((t) => (
                <TypeIcon key={t} type={t} size={24} label={typeLabels[t].group} />
              ))}
            </span>
          </div>
        )}
        {lesson.missing.length > 0 && (
          <div class="mt-2 flex items-start gap-2">
            <span class="lesson-tag">{dayCloseCopy.missing}</span>
            <span class="secondary flex min-w-0 flex-wrap gap-x-3 py-0.5 font-bold">
              {lesson.missing.map((g) => (
                <span key={g.type}>
                  <Txt>{`${formatCount(g.n)} ${typeLabels[g.type].emoji}`}</Txt>
                </span>
              ))}
            </span>
          </div>
        )}
        {overRows(lesson.over).map((row) => (
          <div key={row.types.join()} class="mt-2 flex items-start gap-2">
            <span class="lesson-tag">{dayCloseCopy.over}</span>
            <span class="secondary min-w-0 flex-1 py-0.5">
              <b>
                <Txt>{row.amounts}</Txt>
              </b>
              {row.from && <span class="muted"> · {row.from}</span>}
            </span>
          </div>
        ))}
        <div class="lesson-tip mt-3">
          <Lightbulb size={18} aria-hidden="true" class="shrink-0" />
          <span>
            <b class="mr-1">{past ? dayCloseCopy.today : dayCloseCopy.tomorrow}</b>
            <Txt>{tipText}</Txt>
          </span>
        </div>
      </section>

      {!ready && (
        <button type="button" class="btn btn-neutral w-full" onClick={() => setReady(true)}>
          {past ? buttons.today : buttons.tomorrow}
        </button>
      )}
      {ready && planForDay(plans.value, tomorrow) && (
        <section class="anim-rise">
          <h3 class="title mb-1">{past ? dayCloseCopy.todayMenu : titles.tomorrowMenu}</h3>
          <TomorrowMenu day={tomorrow} compact onSaved={closeSheet} />
        </section>
      )}
    </Sheet>
  );
}
