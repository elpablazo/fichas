// The season's garden as a living landscape (docs/05-fichas-2.md §9): a sky that follows the hour, hills with the
// greenhouse, one planter box per week with a plant per day, and the life that arrives as the season's flowers grow
// (butterflies, a tree, bees, birds, a pond, fireflies). Nothing leaves during a season.
import '../styles/garden.css';
import { useState } from 'preact/hooks';
import { addDays, daysBetween, localParts, weekday } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import type { PlanRow } from '../../shared/domain/types';
import { type Ecosystem, ecosystem } from '../../shared/game/ecosystem';
import { flowerModel } from '../../shared/game/garden';
import { fullDots, weekDots } from '../../shared/game/momentum';
import { a11y, dates, gameCopy, stageLabels } from '../copy/es-MX';
import { gardenCopy } from '../copy/more';
import { gardenLogs } from '../game';
import { now } from '../state/clock';
import { levelBefore } from '../state/selectors';
import { settings } from '../state/signals';
import { openSheet } from '../state/ui';
import { Bee, Butterfly, Plant } from './Plant';
import { weekStart } from './WeekStrip';

const PAGE_WEEKS = 5;
type Phase = 'dawn' | 'day' | 'dusk' | 'night';

function phaseAt(hour: number): Phase {
  return hour >= 20 || hour < 6 ? 'night' : hour < 8 ? 'dawn' : hour < 18 ? 'day' : 'dusk';
}

function Sun({ phase }: { phase: Phase }) {
  if (phase === 'night')
    return (
      <g>
        {[
          [40, 18],
          [92, 30],
          [150, 14],
          [204, 34],
          [250, 12],
          [118, 44],
          [24, 46],
          [276, 40],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i % 3 ? 1 : 1.5}
            fill="#fff7d6"
            class="anim-twinkle"
            style={`animation-delay:${i * 330}ms`}
          />
        ))}
        <path d="M330 14a15 15 0 1 0 9 27a13 13 0 0 1-9-27Z" fill="#f6efd2" stroke="#c9bf95" stroke-width="1.2" />
      </g>
    );
  const low = phase !== 'day';
  const y = low ? 50 : 30;
  const fillColor = low ? '#ffa364' : '#ffd259';
  return (
    <g>
      <g class="eco-sun-rays" style={`transform-origin: 322px ${y}px`}>
        {Array.from({ length: 10 }, (_, i) => (
          <path
            key={i}
            d={`M322 ${y - 19}L322 ${y - 25}`}
            stroke={fillColor}
            stroke-width="2.4"
            stroke-linecap="round"
            transform={`rotate(${i * 36} 322 ${y})`}
            opacity="0.7"
          />
        ))}
      </g>
      <circle cx="322" cy={y} r="13" fill={fillColor} stroke={low ? '#e07a3c' : '#e8a91a'} stroke-width="1.4" />
      <circle cx="317" cy={y - 5} r="4" fill="#ffffff" opacity="0.35" />
    </g>
  );
}

function Cloud({ x, y, s, d, o }: { x: number; y: number; s: number; d: number; o: number }) {
  return (
    <g class="eco-cloud" style={`--d:${d}s;--o:${o}s`}>
      <path
        transform={`translate(${x} ${y}) scale(${s})`}
        d="M8 18C2 18 0 13 4 10C3 4 11 2 14 6C17 0 28 1 29 8C35 7 38 12 35 16C34 18 32 18 30 18Z"
        fill="#ffffff"
        class="cloud"
      />
    </g>
  );
}

function Greenhouse({ x, y, night }: { x: number; y: number; night: boolean }) {
  const glass = night ? '#ffd77a' : 'rgba(255,255,255,0.62)';
  return (
    <g transform={`translate(${x} ${y})`}>
      {night && <circle cx="22" cy="14" r="30" fill="#ffd77a" opacity="0.16" />}
      <path
        d="M0 26V10L22 0L44 10V26Z"
        fill={glass}
        stroke="var(--plant-line)"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <path
        d="M11 26V5M22 26V0M33 26V5M0 17H44"
        stroke="var(--plant-line)"
        stroke-width="0.9"
        fill="none"
        opacity="0.75"
      />
      <rect
        x="18.5"
        y="16"
        width="7"
        height="10"
        fill={night ? '#f5b941' : 'rgba(255,255,255,0.4)'}
        stroke="var(--plant-line)"
        stroke-width="1"
      />
      <circle cx="6.5" cy="22.5" r="3" fill="var(--leaf-2)" opacity="0.85" />
      <circle cx="37.5" cy="22" r="3.4" fill="var(--leaf)" opacity="0.85" />
    </g>
  );
}

function Tree({ x, y, s, bees }: { x: number; y: number; s: number; bees: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-3 0C-2 -12 -3 -22 -1 -32H3C4 -22 3 -12 4 0Z"
        fill="#8a5a3b"
        stroke="var(--wood-line)"
        stroke-width="1.2"
      />
      <path d="M0 -20L-11 -27" stroke="#8a5a3b" stroke-width="2.6" stroke-linecap="round" />
      <g stroke="var(--plant-line)" stroke-width="1.3">
        <circle cx="-11" cy="-38" r="12" fill="var(--leaf)" />
        <circle cx="11" cy="-40" r="13" fill="var(--leaf)" />
        <circle cx="0" cy="-51" r="14" fill="var(--leaf-2)" />
      </g>
      <circle cx="-5" cy="-56" r="4" fill="#ffffff" opacity="0.22" />
      {bees && (
        <g transform="translate(-12 -27)">
          <path d="M0 0V3" stroke="var(--wood-line)" stroke-width="1" />
          <path
            d="M-4.5 4C-5 9 -3 13 0 13C3 13 5 9 4.5 4C3 2.5 -3 2.5 -4.5 4Z"
            fill="#f2b01e"
            stroke="#7f5600"
            stroke-width="1"
          />
          <path d="M-4.6 7H4.6M-3.8 10H3.8" stroke="#7f5600" stroke-width="0.8" />
          <circle cx="0" cy="11" r="1" fill="#3b2412" />
        </g>
      )}
    </g>
  );
}

function Birdhouse({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0V-18" stroke="#8a5a3b" stroke-width="2.4" />
      <path d="M-7 -18V-28H7V-18Z" fill="#e8a05c" stroke="var(--wood-line)" stroke-width="1.2" />
      <path
        d="M-9 -27L0 -34L9 -27Z"
        fill="#c8653d"
        stroke="var(--wood-line)"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <circle cx="0" cy="-23" r="2.2" fill="#3b2412" />
    </g>
  );
}

function Backdrop({ phase, eco }: { phase: Phase; eco: Ecosystem }) {
  const night = phase === 'night';
  return (
    <svg class="garden-backdrop" viewBox="0 0 360 132" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {eco.has.has('fireflies') && !night && (
        <path
          d="M40 132A140 110 0 0 1 320 132"
          fill="none"
          stroke="url(#garden-rainbow)"
          stroke-width="9"
          opacity="0.32"
        />
      )}
      <defs>
        <linearGradient id="garden-rainbow" x1="0" x2="1">
          <stop offset="0" stop-color="#f783ac" />
          <stop offset="0.3" stop-color="#ffd43b" />
          <stop offset="0.6" stop-color="#69db7c" />
          <stop offset="1" stop-color="#74c0fc" />
        </linearGradient>
      </defs>
      <Sun phase={phase} />
      <Cloud x={30} y={20} s={1} d={90} o={-20} />
      <Cloud x={150} y={34} s={0.75} d={120} o={-70} />
      <path class="hill-far" d="M0 94C40 76 92 72 140 82C190 92 230 66 290 70C320 72 342 80 360 86V132H0Z" />
      <Greenhouse x={56} y={72} night={night} />
      <path class="hill-near" d="M0 110C60 94 118 100 176 103C240 106 290 90 360 99V132H0Z" />
      {eco.has.has('birds') && <Birdhouse x={256} y={104} />}
      {eco.has.has('tree') && <Tree x={306} y={102} s={0.6 + eco.tree * 0.4} bees={eco.has.has('bees')} />}
    </svg>
  );
}

/** The bottom edge: grass, and the pond once it arrives. */
function Front({ eco, night }: { eco: Ecosystem; night: boolean }) {
  return (
    <svg class="garden-front" viewBox="0 0 360 34" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M0 14C60 6 120 10 180 9C240 8 300 4 360 10V34H0Z" class="hill-near" />
      {eco.has.has('pond') && (
        <g>
          <ellipse
            cx="62"
            cy="21"
            rx="40"
            ry="9"
            fill={night ? '#1d4a63' : '#8fd0ea'}
            stroke="var(--plant-line)"
            stroke-width="1.2"
          />
          <ellipse cx="54" cy="19" rx="14" ry="2.4" fill="#ffffff" opacity="0.4" />
          <ellipse cx="80" cy="22" rx="7" ry="2.6" fill="var(--leaf-2)" stroke="var(--plant-line)" stroke-width="0.9" />
          <ellipse cx="40" cy="24" rx="6" ry="2.2" fill="var(--leaf)" stroke="var(--plant-line)" stroke-width="0.9" />
          <g transform="translate(80 18)" class="eco-frog">
            <ellipse cx="0" cy="0" rx="5" ry="3.6" fill="#5cb85c" stroke="var(--plant-line)" stroke-width="0.9" />
            <circle cx="-2.4" cy="-3" r="1.7" fill="#5cb85c" stroke="var(--plant-line)" stroke-width="0.8" />
            <circle cx="2.4" cy="-3" r="1.7" fill="#5cb85c" stroke="var(--plant-line)" stroke-width="0.8" />
            <circle cx="-2.4" cy="-3.2" r="0.7" fill="#1b1b1b" />
            <circle cx="2.4" cy="-3.2" r="0.7" fill="#1b1b1b" />
          </g>
        </g>
      )}
      <path
        d="M110 14l-2-7M113 14l1-8M116 14l3-6M196 12l-2-6M199 12l1-7M202 12l2-5M318 11l-1-6M321 11l2-6M300 12l-2-5"
        stroke="var(--leaf-2)"
        stroke-width="1.6"
        stroke-linecap="round"
        class="eco-grass"
      />
    </svg>
  );
}

/** Visitors moving around the scene. */
function Life({ eco, phase }: { eco: Ecosystem; phase: Phase }) {
  const night = phase === 'night';
  return (
    <div class="garden-life" aria-hidden="true">
      {eco.has.has('butterflies') &&
        !night &&
        [
          ['12%', '46%', 19, 0],
          ['58%', '64%', 23, -7],
        ].map(([left, top, d, o]) => (
          <svg
            key={left}
            class="eco-wander"
            style={`left:${left};top:${top};--d:${d}s;--o:${o}s`}
            width="30"
            height="30"
            viewBox="-15 -15 30 30"
            overflow="visible"
            aria-hidden="true"
          >
            <Butterfly x={0} y={0} size={15} />
          </svg>
        ))}
      {eco.has.has('bees') &&
        !night &&
        [['74%', '20%', 11, -3]].map(([left, top, d, o]) => (
          <svg
            key={left}
            class="eco-wander is-small"
            style={`left:${left};top:${top};--d:${d}s;--o:${o}s`}
            width="18"
            height="18"
            viewBox="-9 -9 18 18"
            overflow="visible"
            aria-hidden="true"
          >
            <Bee x={0} y={0} size={10} />
          </svg>
        ))}
      {eco.has.has('birds') &&
        !night &&
        [
          [16, 26, -4],
          [30, 30, -17],
        ].map(([y, d, o]) => (
          <svg
            key={y}
            class="eco-bird"
            style={`--y:${y}px;--d:${d}s;--o:${o}s`}
            width="16"
            height="10"
            viewBox="0 0 16 10"
            aria-hidden="true"
          >
            <path
              class="eco-flap"
              d="M1 6Q4.5 1 8 6Q11.5 1 15 6"
              fill="none"
              stroke="#2c3a33"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        ))}
      {eco.has.has('fireflies') &&
        night &&
        [
          ['14%', '38%', 5, 0],
          ['33%', '58%', 7, -2],
          ['52%', '30%', 6, -4],
          ['71%', '52%', 8, -1],
          ['86%', '72%', 6, -3],
          ['24%', '80%', 7, -5],
        ].map(([left, top, d, o]) => (
          <span key={left} class="eco-firefly" style={`left:${left};top:${top};--d:${d}s;--o:${o}s`} />
        ))}
    </div>
  );
}

export function GardenScene({ plan, today, flowers }: { plan: PlanRow; today: string; flowers: number }) {
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
  const phase = phaseAt(localParts(now.value, settings.value.tz).hour);
  const eco = ecosystem(flowers);
  const strong = fullDots(weekDots(logs, today)) >= 5;
  const rows = Array.from({ length: Math.min(PAGE_WEEKS, weeks - page * PAGE_WEEKS) }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(first, (page * PAGE_WEEKS + r) * 7 + c)),
  );
  return (
    <section
      class={`garden garden-${phase}`}
      data-testid="garden"
      data-phase={phase}
      aria-label={fill(gardenCopy.bedLabel, { n: plan.season ?? 1 })}
    >
      <Backdrop phase={phase} eco={eco} />
      <div class="garden-beds">
        <div class="garden-week-head" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 0].map((w) => (
            <span key={w}>{dates.initials[w]}</span>
          ))}
        </div>
        {rows.map((days, r) => (
          <div key={days[0]} class="planter">
            <div class="planter-box" aria-hidden="true" />
            <div class="relative grid grid-cols-7">
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
                    {m.today && <span class="garden-today-glow anim-shimmer" aria-hidden="true" />}
                    <span class="relative">
                      <Plant stage={m.stage} species={m.species} size={46} ground={false} sway={m.today} />
                      {(m.stage === 'full' || m.stage === 'gold') && (
                        <svg
                          class="pointer-events-none absolute -top-1 left-0"
                          width="46"
                          height="30"
                          viewBox="0 0 46 30"
                          overflow="visible"
                          aria-hidden="true"
                        >
                          {m.stage === 'gold' ? <Butterfly x={34} y={10} size={14} /> : <Bee x={34} y={12} size={11} />}
                        </svg>
                      )}
                    </span>
                    <span class={`stake num${m.today ? ' is-today' : ''}`}>{Number(d.slice(8))}</span>
                  </button>
                );
              })}
            </div>
            {strong && r === rows.length - 1 && page === currentPage && (
              <svg
                class="pointer-events-none absolute inset-x-0 -top-3 z-[2] h-8 w-full"
                viewBox="0 0 300 32"
                overflow="visible"
                aria-hidden="true"
              >
                <Butterfly x={60} y={14} size={16} monarch />
                <Butterfly x={210} y={10} size={14} monarch />
              </svg>
            )}
          </div>
        ))}
        {pages > 1 && (
          <div class="relative z-[1] mt-1 flex items-center justify-between px-1">
            <button
              type="button"
              class="btn btn-neutral btn-sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
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
      </div>
      <Front eco={eco} night={phase === 'night'} />
      <Life eco={eco} phase={phase} />
      {strong && <p class="sr-only">{gardenCopy.monarch}</p>}
    </section>
  );
}
