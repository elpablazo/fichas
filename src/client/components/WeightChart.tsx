// Weight chart: weigh-ins as gray dots, the smoothed trend as the one emphasized line, a 4-week projection
// as a dashed line in a 10 % band. Crosshair + tooltip on pointer and keyboard; the history list is the table view.
import { useMemo, useRef, useState } from 'preact/hooks';
import { addDays, daysBetween } from '../../shared/domain/day';
import { shortDate } from '../../shared/domain/format';
import { trendAt, type WeightAnalysis, weightAxis } from '../../shared/domain/weight';
import { storyCopy, weightCopy } from '../copy/more';

const W = 340;
const H = 190;
const PAD = { l: 36, r: 12, t: 12, b: 24 };

export type Range = 'm1' | 'm3' | 'all';

export function WeightChart({ a, range }: { a: WeightAnalysis; range: Range }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const last = a.latest?.day ?? '';
  const first = a.points[0]?.day ?? last;
  const from = range === 'all' ? first : ([first, addDays(last, range === 'm1' ? -30 : -91)].sort().at(-1) ?? first);
  const points = a.points.filter((p) => p.day >= from);
  const trend = a.trend.filter((t) => t.day >= from);
  const projection = a.projection;
  const to = projection.at(-1)?.day ?? last;
  const span = Math.max(1, daysBetween(from, to));
  const values = [...points.map((p) => p.kg), ...trend.map((t) => t.kg), ...projection.flatMap((p) => [p.low, p.high])];
  const axis = weightAxis(values);
  const x = (day: string) => PAD.l + (daysBetween(from, day) / span) * (W - PAD.l - PAD.r);
  const y = (kg: number) => PAD.t + ((axis.max - kg) / (axis.max - axis.min || 1)) * (H - PAD.t - PAD.b);
  const path = (pts: { day: string; kg: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.kg).toFixed(1)}`).join('');
  const current = a.trend.at(-1);
  const band =
    projection.length && current
      ? `M${x(current.day)} ${y(current.kg)}${projection.map((p) => `L${x(p.day)} ${y(p.high)}`).join('')}${[
          ...projection,
        ]
          .reverse()
          .map((p) => `L${x(p.day)} ${y(p.low)}`)
          .join('')}Z`
      : '';
  const xTicks = useMemo(() => {
    const out = [from];
    if (span > 20) out.push(addDays(from, Math.round(span / 2)));
    out.push(to);
    return out;
  }, [from, to, span]);

  const pick = (clientX: number) => {
    const el = box.current;
    if (!el || !points.length) return;
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let dist = Number.POSITIVE_INFINITY;
    points.forEach((p, i) => {
      const d = Math.abs(x(p.day) - vx);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };
  const h = hover !== null ? points[hover] : null;
  const ht = h ? trendAt(a.trend, h.day) : null;
  return (
    <figure class="relative m-0">
      <svg
        ref={box}
        viewBox={`0 0 ${W} ${H}`}
        class="block w-full touch-pan-y select-none outline-none"
        role="img"
        aria-label={storyCopy.chart}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users explore the weigh-ins with the arrow keys.
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover(Math.max(0, (hover ?? points.length) - 1));
          if (e.key === 'ArrowRight') setHover(Math.min(points.length - 1, (hover ?? -1) + 1));
          if (e.key === 'Escape') setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        {axis.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" stroke-width={1} />
            <text x={PAD.l - 6} y={y(t) + 3.5} text-anchor="end" font-size="10.5" fill="var(--ink-2)" class="num">
              {t % 1 ? t.toFixed(1) : t}
            </text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text
            key={d}
            x={x(d)}
            y={H - 6}
            text-anchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            font-size="10.5"
            fill="var(--ink-2)"
          >
            {shortDate(d)}
          </text>
        ))}
        {band && <path d={band} fill="var(--accent)" opacity={0.1} />}
        {projection.length > 0 && current && (
          <path
            d={`M${x(current.day)} ${y(current.kg)}${projection.map((p) => `L${x(p.day)} ${y(p.kg)}`).join('')}`}
            fill="none"
            stroke="var(--accent-ink)"
            stroke-width={2}
            stroke-dasharray="4 5"
            stroke-linecap="round"
            opacity={0.8}
          />
        )}
        {h && <line x1={x(h.day)} x2={x(h.day)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" stroke-width={1} />}
        {points.map((p, i) =>
          p.source === 'nutritionist' ? (
            <rect
              key={p.day}
              x={x(p.day) - 4.5}
              y={y(p.kg) - 4.5}
              width={9}
              height={9}
              transform={`rotate(45 ${x(p.day)} ${y(p.kg)})`}
              fill="var(--ink-2)"
              stroke="var(--surface)"
              stroke-width={2}
            />
          ) : (
            <circle
              key={p.day}
              cx={x(p.day)}
              cy={y(p.kg)}
              r={hover === i ? 5.5 : 4}
              fill="var(--ink-3)"
              stroke="var(--surface)"
              stroke-width={2}
            />
          ),
        )}
        {trend.length > 1 && (
          <path
            d={path(trend)}
            fill="none"
            stroke="var(--accent-ink)"
            stroke-width={2.5}
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        )}
        {current && current.day >= from && (
          <circle
            cx={x(current.day)}
            cy={y(current.kg)}
            r={5}
            fill="var(--accent-ink)"
            stroke="var(--surface)"
            stroke-width={2}
          />
        )}
      </svg>
      {h && (
        <div
          class="pointer-events-none absolute top-1 z-10 rounded-[12px] px-2.5 py-1.5 text-[12px] leading-4"
          style={`left: clamp(0px, calc(${(x(h.day) / W) * 100}% - 64px), calc(100% - 128px)); width: 128px; background: var(--ink); color: var(--bg); box-shadow: var(--e2)`}
          role="status"
        >
          <span class="block font-bold">{shortDate(h.day)}</span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full" style="background: var(--ink-3)" />
            <b class="num">
              {h.kg.toFixed(1)} {storyCopy.kg}
            </b>
          </span>
          {ht !== null && (
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-0.5 w-2.5 rounded" style="background: var(--accent-soft)" />
              <span>
                {weightCopy.trend} <b class="num">{ht.toFixed(1)}</b>
              </span>
            </span>
          )}
        </div>
      )}
      <figcaption class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12px] font-semibold text-ink-2">
        <span class="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="var(--ink-3)" />
          </svg>
          {storyCopy.home}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <rect x="1.5" y="1.5" width="7" height="7" transform="rotate(45 5 5)" fill="var(--ink-2)" />
          </svg>
          {storyCopy.nutritionist}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden="true">
            <path d="M1 5H15" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          {weightCopy.trend}
        </span>
        {projection.length > 0 && (
          <span class="inline-flex items-center gap-1.5">
            <svg width="16" height="10" aria-hidden="true">
              <path d="M1 5H15" stroke="var(--accent-ink)" stroke-width="2" stroke-dasharray="3 3" />
            </svg>
            {weightCopy.projected}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
