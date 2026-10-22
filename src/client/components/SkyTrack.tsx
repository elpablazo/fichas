// Which meal is this: the day's meals as stops on the sun's path. Tap a stop, or drag the sun (or the moon, after
// dusk) along the sky; it snaps to the nearest meal. The last stop, a star, is for anything outside the plan
// (Extra). The time it was eaten is a separate pill: plan time and real time are different facts.
import { Clock3 } from 'lucide-preact';
import { useRef } from 'preact/hooks';
import { describeCopy } from '../copy/more';
import { tick } from '../feedback/haptics';

export interface SkyStop {
  key: string;
  label: string;
  /** "11 am" (empty for Extra). */
  time: string;
  /** App minutes of the planned time (for the sky's color). */
  minutes: number | null;
}

type Phase = 'dawn' | 'day' | 'afternoon' | 'dusk' | 'night' | 'extra';

/** App minutes count from the day's start hour; 4 am start → 360 is 10 am. */
function phaseOf(minutes: number | null, dayStartHour: number): Phase {
  if (minutes === null) return 'extra';
  const h = (minutes / 60 + dayStartHour) % 24;
  return h < 10 ? 'dawn' : h < 15 ? 'day' : h < 18.5 ? 'afternoon' : h < 20.5 ? 'dusk' : 'night';
}

interface Props {
  stops: SkyStop[];
  value: string;
  onChange: (key: string) => void;
  dayStartHour: number;
  /** The chosen meal in words ("Colación · 1 pm" when the name repeats). */
  slotLabel: string;
  /** "Ahora" or "11:20 am". */
  timeLabel: string;
  /** HH:MM for the time input. */
  timeValue: string;
  onTime: (hhmm: string) => void;
  /** The time pill (logging); checking a craving has no time. */
  showTime: boolean;
}

export function SkyTrack({
  stops,
  value,
  onChange,
  dayStartHour,
  slotLabel,
  timeLabel,
  timeValue,
  onTime,
  showTime,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const n = stops.length;
  const index = Math.max(
    0,
    stops.findIndex((s) => s.key === value),
  );
  const x = (i: number) => (n <= 1 ? 50 : 10 + (i * 80) / (n - 1));
  // Stops sit on a gentle arc: the sun is highest at midday.
  const y = (i: number) => 58 - Math.sin((Math.PI * x(i)) / 100) * 14;
  const selected = stops[index];
  const phase = phaseOf(selected?.minutes ?? null, dayStartHour);
  const icon = phase === 'night' ? 'moon' : phase === 'extra' ? 'star' : 'sun';

  const nearest = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return index;
    const pct = ((clientX - box.left) / box.width) * 100;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - pct) < Math.abs(x(best) - pct)) best = i;
    return best;
  };
  const pick = (i: number) => {
    const s = stops[i];
    if (!s || s.key === value) return;
    tick(1);
    onChange(s.key);
  };

  return (
    <div class="mb-3">
      <div class={`sky sky-${phase}`} data-testid="sky">
        <div class="sky-hills" aria-hidden="true" />
        <div
          ref={track}
          class="sky-track"
          role="radiogroup"
          aria-label={describeCopy.whichMeal}
          data-testid="sky-track"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('.sky-sun')) {
              dragging.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (dragging.current) pick(nearest(e.clientX));
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
        >
          <svg class="sky-path" viewBox="0 0 100 96" preserveAspectRatio="none" aria-hidden="true">
            <path
              d={`M${x(0)} ${y(0)} ${stops.map((_, i) => `L${x(i)} ${y(i)}`).join(' ')}`}
              fill="none"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          {stops.map((s, i) => (
            <label
              key={s.key}
              class={`sky-stop${s.minutes === null ? ' is-extra' : ''}${i === index ? ' is-on' : ''}`}
              style={`left:${x(i)}%;top:${y(i)}px`}
              data-sky={s.key}
            >
              <input
                type="radio"
                name="sky-slot"
                class="sr-only"
                checked={i === index}
                aria-label={s.time ? `${s.label}, ${s.time}` : s.label}
                onChange={() => pick(i)}
              />
              <span class="sky-dot" aria-hidden="true" />
              <span class="sky-name" aria-hidden="true">
                {s.label}
              </span>
              {s.time && (
                <span class="sky-hour num" aria-hidden="true">
                  {s.time}
                </span>
              )}
            </label>
          ))}
          <span class={`sky-sun is-${icon}`} style={`left:${x(index)}%;top:${y(index)}px`} aria-hidden="true">
            {icon === 'sun' ? (
              <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                <g class="sky-rays">
                  {Array.from({ length: 8 }, (_, k) => (
                    <rect key={k} x="18.5" y="1" width="3" height="7" rx="1.5" transform={`rotate(${k * 45} 20 20)`} />
                  ))}
                </g>
                <circle cx="20" cy="20" r="10" class="sky-disc" />
                <circle cx="16.5" cy="16.5" r="3" fill="#fff" opacity=".55" />
              </svg>
            ) : icon === 'moon' ? (
              <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                <path d="M24 6a14 14 0 1 0 10 21A12 12 0 0 1 24 6Z" class="sky-disc" />
                <circle cx="17" cy="22" r="1.8" opacity=".25" />
                <circle cx="22" cy="28" r="1.2" opacity=".25" />
              </svg>
            ) : (
              <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
                <path
                  d="M20 4l4.2 10.2L35 15.5l-8.2 7.2L29.2 34 20 28.2 10.8 34l2.4-11.3L5 15.5l10.8-1.3z"
                  class="sky-disc"
                />
              </svg>
            )}
          </span>
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 px-1">
        <p class="display min-w-0 truncate text-[19px] leading-6" data-testid="slot-pick">
          {slotLabel}
        </p>
        {showTime && (
          <label class="chip sky-time shrink-0">
            <Clock3 size={15} strokeWidth={2.6} aria-hidden="true" />
            <span>{timeLabel}</span>
            <input
              type="time"
              value={timeValue}
              aria-label={describeCopy.whenLabel}
              data-testid="eaten-time"
              onChange={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                if (v) onTime(v);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
