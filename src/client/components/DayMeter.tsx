// The day at a glance: one graduated tube per food type. The liquid is what's eaten, the number on top is what's
// left today, the small ticks are fichas, the longer lines are where each meal's share ends, and the pointer marks
// where the meals logged so far should have left it (above it = ahead, a dashed gap below it = behind).
// A meal being described shows as a striped layer on top, so "does this fit my day?" reads the same way.
import { Check } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meter } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import type { TypeKey, Units } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { meterCopy, typeLabels } from '../copy/es-MX';
import { landing } from '../state/ui';
import { TypeIcon } from './Sprite';

const EPS = 0.125;

interface Props {
  meters: Meter[];
  /** Units a meal being described would add. */
  adding?: Units;
  /** Show the meal lines and the pace pointer (a day already under way). */
  pace?: boolean;
  size?: 'lg' | 'sm';
  onType?: (t: TypeKey) => void;
  class?: string;
}

function spoken(m: Meter, add: number, pace: boolean): string {
  const meta = typeLabels[m.type];
  const eaten = m.eaten + add;
  const over = eaten - m.planned;
  const base =
    over >= EPS
      ? fill(meterCopy.a11yOver, { type: meta.group, n: formatCount(over) })
      : m.planned - eaten < EPS
        ? fill(meterCopy.a11yFull, { type: meta.group })
        : fill(meterCopy.a11yLeft, {
            type: meta.group,
            n: formatCount(m.planned - eaten),
            total: formatCount(m.planned),
          });
  if (!pace || m.expected < EPS || add) return base;
  const d = m.eaten - m.expected;
  return `${base}. ${
    d >= 0.5
      ? fill(meterCopy.a11yAhead, { n: formatCount(d) })
      : d <= -0.5
        ? fill(meterCopy.a11yBehind, { n: formatCount(-d) })
        : meterCopy.a11yOnPace
  }`;
}

export function DayMeter({ meters, adding, pace = false, size = 'lg', onType, class: cls = '' }: Props) {
  // "+n" floats over a tube right after something lands in it.
  const prev = useRef<Map<TypeKey, number> | null>(null);
  const [bumps, setBumps] = useState<Partial<Record<TypeKey, number>>>({});
  useEffect(() => {
    const now = new Map(meters.map((m) => [m.type, m.eaten]));
    const before = prev.current;
    prev.current = now;
    if (!before || adding) return;
    const next: Partial<Record<TypeKey, number>> = {};
    for (const [t, v] of now) if (v - (before.get(t) ?? 0) >= EPS) next[t] = v - (before.get(t) ?? 0);
    if (!Object.keys(next).length) return;
    setBumps(next);
    const timer = setTimeout(() => setBumps({}), 1400);
    return () => clearTimeout(timer);
  }, [meters.map((m) => `${m.type}:${m.eaten}`).join('|')]);

  if (!meters.length) return null;
  const lg = size === 'lg';
  // Right after a log the coins are in the air: the liquid rises as they land.
  const receiving = !adding && Date.now() - landing.value < 1500;
  const tall = lg ? 88 : 54;
  return (
    <div
      class={`meter-row ${lg ? '' : 'sm'}${receiving ? ' is-receiving' : ''} ${cls}`}
      style={`grid-template-columns: repeat(${meters.length}, minmax(0, 1fr))`}
      data-testid="day-meter"
    >
      {meters.map((m) => {
        const add = adding?.[m.type] ?? 0;
        const after = m.eaten + add;
        const left = m.planned - after;
        const over = after - m.planned;
        const cap = m.planned > 0 ? m.planned : Math.max(after, 1);
        const pct = (v: number) => Math.max(0, Math.min(1, v / cap)) * 100;
        const fillPct = pct(m.eaten);
        const addPct = Math.max(0, pct(after) - fillPct);
        const showPace = pace && !add && m.expected > EPS && m.expected < m.planned - EPS;
        const nowPct = showPace ? pct(m.expected) : null;
        const behind = showPace && m.expected - m.eaten >= 0.5;
        const segments = m.planned >= 1 && m.planned <= 14 ? Math.round(m.planned) : 0;
        const changed = add >= EPS;
        const bump = bumps[m.type];
        const top =
          over >= EPS ? (
            <span class="meter-over">+{formatCount(over)}</span>
          ) : left < EPS ? (
            <Check size={lg ? 22 : 17} strokeWidth={3.4} class="meter-done" aria-hidden="true" />
          ) : (
            <span class={changed ? 'text-accent-ink' : ''}>{formatCount(left)}</span>
          );
        const body = (
          <>
            <span class="meter-num num" aria-hidden="true">
              {top}
              {bump && (
                <span class="meter-bump anim-float-up" key={bump}>
                  +{formatCount(bump)}
                </span>
              )}
            </span>
            <span
              class={`meter-tank${over >= EPS ? ' is-over' : ''}${changed ? ' is-adding' : ''}`}
              style={`height:${tall}px;--seg:${segments ? `${tall / segments}px` : '0px'}`}
              aria-hidden="true"
            >
              <span class="meter-glass">
                <span class="meter-fill" style={`height:${fillPct}%`} />
                {behind && nowPct !== null && (
                  <span class="meter-gap" style={`bottom:${fillPct}%;height:${nowPct - fillPct}%`} />
                )}
                {addPct > 0 && <span class="meter-add" style={`bottom:${fillPct}%;height:${addPct}%`} />}
                {segments > 1 && <span class="meter-ticks" />}
                {pace &&
                  lg &&
                  m.marks.map((k) => <span key={k.slot} class="meter-meal" style={`bottom:${pct(k.at)}%`} />)}
              </span>
              {nowPct !== null && <span class="meter-now" style={`bottom:${nowPct}%`} />}
            </span>
            <TypeIcon type={m.type} size={lg ? 28 : 20} class="meter-icon" />
          </>
        );
        return onType ? (
          <button
            key={m.type}
            type="button"
            class={`meter press t-${m.type}`}
            data-type={m.type}
            aria-label={spoken(m, add, pace)}
            onClick={() => onType(m.type)}
          >
            {body}
          </button>
        ) : (
          <span
            key={m.type}
            class={`meter t-${m.type}`}
            data-type={m.type}
            role="img"
            aria-label={spoken(m, add, pace)}
          >
            {body}
          </span>
        );
      })}
    </div>
  );
}
