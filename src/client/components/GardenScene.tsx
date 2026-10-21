// The season's garden: one plant per day in weekly planter beds, visitors on great days, today in the light.
import { useState } from 'preact/hooks';
import { addDays, daysBetween, weekday } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import type { PlanRow } from '../../shared/domain/types';
import { flowerModel } from '../../shared/game/garden';
import { fullDots, weekDots } from '../../shared/game/momentum';
import { a11y, dates, gameCopy, stageLabels } from '../copy/es-MX';
import { gardenCopy } from '../copy/more';
import { gardenLogs } from '../game';
import { levelBefore } from '../state/selectors';
import { settings } from '../state/signals';
import { openSheet } from '../state/ui';
import { Bee, Butterfly, Plant } from './Plant';
import { weekStart } from './WeekStrip';

const PAGE_WEEKS = 5;

export function GardenScene({ plan, today }: { plan: PlanRow; today: string }) {
  const start = plan.starts_on ?? today;
  const end =
    plan.ends_on ??
    [today, plan.data.next_appointment ?? addDays(start, 14), addDays(start, 14)].sort().at(-1) ??
    today;
  const first = weekStart(start);
  const weeks = Math.max(1, Math.ceil((daysBetween(first, end) + 1) / 7));
  const pages = Math.ceil(weeks / PAGE_WEEKS);
  const currentPage = Math.min(pages - 1, Math.floor(Math.max(0, daysBetween(first, today)) / 7 / PAGE_WEEKS));
  const [page, setPage] = useState(currentPage);
  const logs = gardenLogs.value;
  const closed = settings.value.last_closed_day;
  const hour = new Date().getHours();
  const night = hour >= 20 || hour < 6;
  const strong = fullDots(weekDots(logs, today)) >= 5;
  const rows = Array.from({ length: Math.min(PAGE_WEEKS, weeks - page * PAGE_WEEKS) }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(first, (page * PAGE_WEEKS + r) * 7 + c)),
  );
  return (
    <section
      class="relative overflow-hidden rounded-[22px] px-2 pt-11 pb-2"
      style={`background: linear-gradient(180deg, ${night ? '#2a2550, var(--sky-1)' : 'var(--sky-2), var(--sky-1)'})`}
      data-testid="garden"
      aria-label={fill(gardenCopy.bedLabel, { n: plan.season ?? 1 })}
    >
      {/* Sun or moon */}
      <svg
        class="pointer-events-none absolute top-2 right-3"
        width="34"
        height="34"
        viewBox="0 0 34 34"
        aria-hidden="true"
      >
        {night ? (
          <path d="M22 4a13 13 0 1 0 8 23A11 11 0 0 1 22 4Z" fill="#f6efd2" />
        ) : (
          <circle cx="17" cy="17" r="11" fill="#ffd259" class="anim-shimmer" />
        )}
      </svg>
      <div class="grid grid-cols-7 px-1 pb-1" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <span key={w} class="text-center text-[11px] font-bold text-ink-2">
            {dates.initials[w]}
          </span>
        ))}
      </div>
      {rows.map((days, r) => (
        <div key={days[0]} class="relative mb-2">
          <div class="relative z-[1] grid grid-cols-7">
            {days.map((d) => {
              const inSeason = d >= start && d <= end;
              if (!inSeason) return <span key={d} />;
              const m = flowerModel(plan.data, logs, d, today, {
                level: levelBefore(d),
                closed: d < today || closed === d,
              });
              const label = fill(a11y.flower, {
                day: `${dates.weekdays[weekday(d)]} ${Number(d.slice(8))}`,
                stage: stageLabels[m.stage],
                n: m.n,
              });
              return (
                <button
                  key={d}
                  type="button"
                  class="press relative flex flex-col items-center"
                  aria-label={label}
                  onClick={() => openSheet({ kind: 'plant', day: d })}
                >
                  {m.today && (
                    <span
                      class="absolute top-0 h-[46px] w-[46px] rounded-full anim-shimmer"
                      style="background: radial-gradient(circle, color-mix(in srgb, var(--gold) 45%, transparent), transparent 70%)"
                      aria-hidden="true"
                    />
                  )}
                  <span class="relative">
                    <Plant stage={m.stage} species={m.species} size={46} ground={false} sway={m.today} />
                    {(m.stage === 'full' || m.stage === 'gold') && (
                      <svg
                        class="pointer-events-none absolute -top-1 left-0"
                        width="46"
                        height="30"
                        viewBox="0 0 46 30"
                        aria-hidden="true"
                      >
                        {m.stage === 'gold' ? <Butterfly x={34} y={10} size={14} /> : <Bee x={34} y={12} size={11} />}
                      </svg>
                    )}
                  </span>
                  <span class={`num text-[10px] font-bold leading-3 ${m.today ? 'text-accent-ink' : 'text-ink-2'}`}>
                    {Number(d.slice(8))}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Planter bed */}
          <div
            class="absolute inset-x-0 bottom-3 h-3.5 rounded-full"
            style="background: linear-gradient(180deg, var(--soil), var(--soil-2)); box-shadow: inset 0 2px 0 var(--soil-3)"
            aria-hidden="true"
          />
          {strong && r === rows.length - 1 && page === currentPage && (
            <svg
              class="pointer-events-none absolute inset-x-0 -top-3 z-[2] h-8 w-full"
              viewBox="0 0 300 32"
              aria-hidden="true"
            >
              <Butterfly x={60} y={14} size={16} monarch />
              <Butterfly x={210} y={10} size={14} monarch />
            </svg>
          )}
        </div>
      ))}
      {pages > 1 && (
        <div class="mt-1 flex items-center justify-between px-1">
          <button type="button" class="btn btn-neutral btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {gameCopy.previousDays}
          </button>
          <span class="caption num">
            {page + 1}/{pages}
          </span>
          <button
            type="button"
            class="btn btn-neutral btn-sm"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            {a11y.more}
          </button>
        </div>
      )}
      {strong && <p class="sr-only">{gardenCopy.monarch}</p>}
    </section>
  );
}
