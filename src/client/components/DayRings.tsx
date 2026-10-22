// Days as rings: how much of each day's plan was covered, gold when it was exact. A week or less is one row with
// each day's initial; longer ranges are a Monday-first calendar. Days still to come in a calendar week show as
// empty dashed circles.
import { addDays, weekday } from '../../shared/domain/day';
import type { EatingDay } from '../../shared/domain/eating';
import { fill, shortDate } from '../../shared/domain/format';
import { dates } from '../copy/es-MX';
import { eatingCopy } from '../copy/more';
import { Ring } from './Ring';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function DayRings({ days, today, size = 34 }: { days: EatingDay[]; today: string; size?: number }) {
  const first = days[0]?.day;
  const last = days.at(-1)?.day;
  if (!first || !last) return null;
  const lead = (weekday(first) + 6) % 7;
  const row = days.length <= 7;
  // A calendar week (from Monday) is completed up to Sunday; a rolling week is just its days.
  const tail = row ? (lead === 0 ? 7 - days.length : 0) : (7 - ((lead + days.length) % 7)) % 7;
  const stroke = size >= 34 ? 5 : 4;
  const initial = (day: string) =>
    row && (
      <span class="day-rings-head" aria-hidden="true">
        {dates.initials[weekday(day)]}
      </span>
    );
  return (
    <div class="day-rings" style={`--ring:${size}px`}>
      {!row &&
        MON_FIRST.map((w, i) => (
          <span key={`h${i}`} class="day-rings-head" aria-hidden="true">
            {dates.initials[w]}
          </span>
        ))}
      {!row && Array.from({ length: lead }, (_, i) => <span key={`l${i}`} aria-hidden="true" />)}
      {days.map((d) => (
        <span key={d.day} class="day-rings-cell">
          {initial(d.day)}
          <span
            role="img"
            class={`day-ring${d.day === today ? ' is-today' : ''}${d.logged ? '' : ' is-empty'}`}
            aria-label={fill(eatingCopy.dayA11y, { date: shortDate(d.day), pct: d.pct })}
          >
            <Ring value={d.pct} max={100} size={size} stroke={stroke} color={d.exact ? 'var(--gold)' : 'var(--accent)'}>
              <span class="num day-ring-n">{Number(d.day.slice(8))}</span>
            </Ring>
          </span>
        </span>
      ))}
      {Array.from({ length: tail }, (_, i) => {
        const d = addDays(last, i + 1);
        return (
          <span key={`t${i}`} class="day-rings-cell" aria-hidden="true">
            {initial(d)}
            <span class="day-ring-future">
              <span class="num day-ring-n">{Number(d.slice(8))}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
