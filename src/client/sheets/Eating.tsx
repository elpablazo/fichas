// "Tu alimentación" (docs/05-fichas-2.md §8): the days at 100 as rings, the average day against the plan, what
// each meal tends to bring over or short and when it is eaten, and the most eaten foods. For 7 or 30 days or the
// whole season.
import { Check } from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { eatingSummary } from '../../shared/domain/eating';
import { fill, timeLabel } from '../../shared/domain/format';
import { baseTimes } from '../../shared/domain/slots';
import { formatCount } from '../../shared/domain/units';
import { DayRings } from '../components/DayRings';
import { Sheet } from '../components/Sheet';
import { FoodIcon, Txt, TypeIcon } from '../components/Sprite';
import { Segmented } from '../components/ui';
import { typeLabels } from '../copy/es-MX';
import { eatingCopy } from '../copy/more';
import { gardenLogs } from '../game';
import { foodSprite } from '../sprites/food-map';
import { activePlan, livePlans, planForDay, plans, settings, today } from '../state/signals';
import { closeSheet } from '../state/ui';

type Range = 'd7' | 'd30' | 'season';
/** The longest look back, so a long season stays one screen of rings. */
const MAX_DAYS = 120;

export default function Eating() {
  const [range, setRange] = useState<Range>('d7');
  const day = today.value;
  const plan = activePlan.value;
  const first = livePlans.value.map((p) => p.starts_on ?? day).sort()[0] ?? day;
  const wanted =
    range === 'd7' ? addDays(day, -6) : range === 'd30' ? addDays(day, -29) : (plan?.starts_on ?? addDays(day, -29));
  const from = [wanted, first, addDays(day, -(MAX_DAYS - 1))].sort().at(-1) ?? day;
  const s = useMemo(
    () =>
      eatingSummary({
        from,
        to: day,
        today: day,
        logs: gardenLogs.value,
        planOf: (d) => planForDay(plans.value, d)?.data ?? null,
        tz: settings.value.tz,
        dayStartHour: settings.value.day_start_hour,
      }),
    [from, day, gardenLogs.value, plans.value, settings.value.tz, settings.value.day_start_hour],
  );
  const data = plan?.data;
  const start = settings.value.day_start_hour;
  const short = s.avg
    .filter((a) => a.planned - a.eaten >= 0.5)
    .sort((a, b) => b.planned - b.eaten - (a.planned - a.eaten))[0];
  const over = s.avg
    .filter((a) => a.eaten - a.planned >= 0.5)
    .sort((a, b) => b.eaten - b.planned - (a.eaten - a.planned))[0];
  const times = data ? baseTimes(data.slots, start) : [];
  const meals = [
    ...(data?.slots.map((x, i) => ({ key: x.key, label: x.label, time: times[i] ?? null })) ?? []),
    { key: 'extra', label: eatingCopy.extra, time: null },
  ]
    .map((m) => ({
      ...m,
      habits: s.habits.filter((h) => h.slot === m.key),
      timing: s.timing.find((t) => t.slot === m.key),
      days: s.mealDays[m.key] ?? 0,
    }))
    .filter((m) => m.habits.length || m.timing || (m.key !== 'extra' && m.days >= 2));
  return (
    <Sheet label={eatingCopy.title} onClose={closeSheet} header={<h2 class="title">{eatingCopy.title}</h2>}>
      <div class="mb-4">
        <Segmented
          label={eatingCopy.title}
          value={range}
          onChange={setRange}
          options={[
            { value: 'd7', label: eatingCopy.ranges.d7 },
            { value: 'd30', label: eatingCopy.ranges.d30 },
            { value: 'season', label: eatingCopy.ranges.season },
          ]}
        />
      </div>

      <section class="impact mb-5" data-testid="eating-days">
        <p class="flex items-baseline gap-2">
          <span class="display num text-[34px] leading-none">{s.full}</span>
          <span class="headline">{s.full === 1 ? eatingCopy.fullOne : eatingCopy.full}</span>
        </p>
        {s.full === 0 && <p class="secondary muted mt-1">{eatingCopy.fullNone}</p>}
        <div class="mt-3">
          <DayRings days={s.days} today={day} size={range === 'd7' ? 38 : 32} />
        </div>
      </section>

      {s.counted === 0 ? (
        <p class="secondary muted px-1">{eatingCopy.empty}</p>
      ) : (
        <>
          <h3 class="kicker mb-1 px-1">{eatingCopy.avg}</h3>
          <ul class="mb-2 divide" data-testid="eating-avg">
            {s.avg.map((a) => {
              const scale = Math.max(a.planned, a.eaten, 1);
              return (
                <li key={a.type} class={`flex min-h-13 items-center gap-3 px-1 py-1.5 t-${a.type}`}>
                  <TypeIcon type={a.type} size={28} />
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline justify-between gap-2">
                      <span class="font-bold">{typeLabels[a.type].group}</span>
                      <span class="num secondary font-bold">
                        {fill(eatingCopy.avgOf, { eaten: formatCount(a.eaten), planned: formatCount(a.planned) })}
                      </span>
                    </span>
                    <span class="mini-bar mt-1.5 block" aria-hidden="true">
                      <span style={`width:${(Math.min(a.eaten, a.planned) / scale) * 100}%`} />
                      {a.eaten > a.planned && (
                        <span
                          class="is-over"
                          style={`left:${(a.planned / scale) * 100}%;width:${((a.eaten - a.planned) / scale) * 100}%`}
                        />
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {(short || over) && (
            <div class="mb-5 grid gap-1 px-1" data-testid="eating-insight">
              {short && (
                <p class="secondary font-semibold">
                  <Txt>
                    {fill(eatingCopy.short, {
                      n: formatCount(short.planned - short.eaten),
                      emoji: typeLabels[short.type].emoji,
                    })}
                  </Txt>
                </p>
              )}
              {over && (
                <p class="secondary font-semibold">
                  <Txt>
                    {fill(eatingCopy.over, {
                      n: formatCount(over.eaten - over.planned),
                      emoji: typeLabels[over.type].emoji,
                    })}
                  </Txt>
                </p>
              )}
            </div>
          )}

          {meals.length > 0 && (
            <>
              <h3 class="kicker mb-1 px-1">{eatingCopy.meals}</h3>
              <ul class="mb-5 divide" data-testid="eating-meals">
                {meals.map((m) => {
                  const late = m.timing && Math.abs(m.timing.real - m.timing.plan) >= 20 ? m.timing : null;
                  return (
                    <li key={m.key} class="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-2">
                      <span class="min-w-0 flex-1">
                        <span class="flex items-baseline gap-2">
                          <span class="font-bold">{m.label}</span>
                          {m.time !== null && <span class="caption num">{timeLabel(m.time, start)}</span>}
                        </span>
                        {late && (
                          <span class="caption num block">
                            {fill(eatingCopy.real, { time: timeLabel(late.real, start) })}
                          </span>
                        )}
                      </span>
                      <span class="flex flex-wrap justify-end gap-1.5">
                        {m.habits.map((h) => (
                          <span key={`${h.type}${h.n > 0}`} class="badge">
                            <Txt>
                              {fill(h.n > 0 ? eatingCopy.habitOver : eatingCopy.habitShort, {
                                n: formatCount(Math.abs(h.n)),
                                emoji: typeLabels[h.type].emoji,
                              })}
                            </Txt>
                            <span class="font-semibold text-ink-3">
                              {fill(eatingCopy.habitTimes, { times: h.times, of: h.of })}
                            </span>
                          </span>
                        ))}
                        {!m.habits.length && m.key !== 'extra' && m.days >= 2 && (
                          <span class="badge leaf">
                            <Check size={13} strokeWidth={3.2} aria-hidden="true" />
                            {eatingCopy.mealOn}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {s.foods.length > 0 && (
            <>
              <h3 class="kicker mb-2 px-1">{eatingCopy.foods}</h3>
              <ul class="flex flex-wrap gap-2" data-testid="eating-foods">
                {s.foods.map((f) => (
                  <li key={f.key} class="well flex min-h-11 items-center gap-2 py-1.5 pr-3 pl-2">
                    <FoodIcon id={foodSprite(f.label)} type={f.type} size={26} />
                    <span class="font-semibold first-letter:uppercase">{f.label}</span>
                    <span class="num caption font-bold">{fill(eatingCopy.times, { n: f.times })}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
