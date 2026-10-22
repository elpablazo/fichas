// What a meal brings against what its plan asks, one row per food type: the plan's places as sockets, filled by
// what was eaten; anything beyond the plan sits after a divider as extra coins. Read without counting.
import { Check } from 'lucide-preact';
import { fill } from '../../shared/domain/format';
import type { TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { plateCopy, typeLabels } from '../copy/es-MX';
import { TypeIcon } from './Sprite';

const EPS = 0.125;
const MAX_COINS = 8;

/** Coins for n units: whole ones, then a half for the remainder (¼ shows as half, ¾ as one). */
function coins(n: number): number[] {
  const out: number[] = [];
  let left = Math.round(n * 2) / 2;
  while (left >= 1 - 1e-6) {
    out.push(1);
    left -= 1;
  }
  if (left >= 0.5 - 1e-6) out.push(0.5);
  return out;
}

export function MealPlate({ target, eaten }: { target: Units; eaten: Units }) {
  const types = TYPE_KEYS.filter((t: TypeKey) => (target[t] ?? 0) >= EPS || (eaten[t] ?? 0) >= EPS);
  if (!types.length) return null;
  return (
    <ul class="plate" data-testid="plate">
      {types.map((t) => {
        const plan = target[t] ?? 0;
        const ate = eaten[t] ?? 0;
        const inside = Math.min(plan, ate);
        const extra = Math.max(0, ate - plan);
        const missing = Math.max(0, plan - ate);
        const filled = coins(inside);
        const empty = coins(Math.max(0, plan - filled.reduce((s, c) => s + c, 0)));
        const over = coins(extra);
        const meta = typeLabels[t];
        const note =
          extra >= 0.5 - 1e-6
            ? fill(plateCopy.over, { n: formatCount(extra) })
            : missing >= 0.5 - 1e-6
              ? fill(plateCopy.missing, { n: formatCount(missing) })
              : null;
        return (
          <li key={t} class={`plate-row t-${t}`}>
            <TypeIcon type={t} size={22} label={meta.label} />
            <span class="plate-coins" aria-hidden="true">
              {filled.slice(0, MAX_COINS).map((c, i) => (
                <span key={`f${i}`} class={`coin ${c < 1 ? 'half' : ''}`} />
              ))}
              {empty.slice(0, MAX_COINS).map((c, i) => (
                <span key={`e${i}`} class={`coin empty ${c < 1 ? 'half' : ''}`} />
              ))}
              {over.length > 0 && <span class="plate-divider" />}
              {over.slice(0, MAX_COINS).map((c, i) => (
                <span key={`o${i}`} class={`coin extra ${c < 1 ? 'half' : ''}`} />
              ))}
            </span>
            <span class={`plate-note ${note ? '' : 'is-on'}`}>
              {note ?? (
                <>
                  <Check size={14} strokeWidth={3.2} aria-hidden="true" />
                  {plateCopy.on}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
