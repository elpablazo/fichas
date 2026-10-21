// The day at a glance: one tank per food type. The fill is what's eaten, the number on top is what's left today,
// the notch marks where the meals logged so far should have left it. A meal being described shows as a striped
// layer on top, so "does this fit my day?" is answered by the same picture.
import { Check } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meter } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import type { TypeKey, Units } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { meterCopy, typeLabels } from '../copy/es-MX';

const EPS = 0.125;

interface Props {
  meters: Meter[];
  /** Units a meal being described would add. */
  adding?: Units;
  /** Show the pace notch (meals resolved so far). */
  pace?: boolean;
  size?: 'lg' | 'sm';
  onType?: (t: TypeKey) => void;
  class?: string;
}

function spoken(m: Meter, add: number): string {
  const meta = typeLabels[m.type];
  const eaten = m.eaten + add;
  const over = eaten - m.planned;
  if (over >= EPS) return fill(meterCopy.a11yOver, { type: meta.group, n: formatCount(over) });
  const left = m.planned - eaten;
  if (left < EPS) return fill(meterCopy.a11yFull, { type: meta.group });
  return fill(meterCopy.a11yLeft, { type: meta.group, n: formatCount(left), total: formatCount(m.planned) });
}

export function DayMeter({ meters, adding, pace = false, size = 'lg', onType, class: cls = '' }: Props) {
  // "+n" floats over a tank right after something lands in it.
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
  const tall = size === 'lg' ? 76 : 48;
  return (
    <div
      class={`meter-row ${size === 'sm' ? 'sm' : ''} ${cls}`}
      style={`grid-template-columns: repeat(${meters.length}, minmax(0, 1fr))`}
      data-testid="day-meter"
    >
      {meters.map((m) => {
        const add = adding?.[m.type] ?? 0;
        const after = m.eaten + add;
        const left = m.planned - after;
        const over = after - m.planned;
        const cap = m.planned > 0 ? m.planned : Math.max(after, 1);
        const fillPct = Math.min(1, m.eaten / cap) * 100;
        const addPct = Math.max(0, Math.min(1, after / cap) * 100 - fillPct);
        const mark = pace && m.expected > EPS && m.expected < m.planned - EPS ? (m.expected / cap) * 100 : null;
        const segments = m.planned >= 1 && m.planned <= 12 ? Math.round(m.planned) : 0;
        const changed = add >= EPS;
        const bump = bumps[m.type];
        const top =
          over >= EPS ? (
            <span class="meter-over">+{formatCount(over)}</span>
          ) : left < EPS ? (
            <Check size={size === 'lg' ? 20 : 16} strokeWidth={3.2} class="meter-done" aria-hidden="true" />
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
              <span class="meter-fill" style={`height:${fillPct}%`} />
              {addPct > 0 && <span class="meter-add" style={`bottom:${fillPct}%;height:${addPct}%`} />}
              {segments > 1 && <span class="meter-segs" />}
              {mark !== null && <span class="meter-mark" style={`bottom:${mark}%`} />}
            </span>
            <span class="meter-emoji" aria-hidden="true">
              {typeLabels[m.type].emoji}
            </span>
          </>
        );
        return onType ? (
          <button
            key={m.type}
            type="button"
            class={`meter press t-${m.type}`}
            aria-label={spoken(m, add)}
            onClick={() => onType(m.type)}
          >
            {body}
          </button>
        ) : (
          <span key={m.type} class={`meter t-${m.type}`} role="img" aria-label={spoken(m, add)}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
