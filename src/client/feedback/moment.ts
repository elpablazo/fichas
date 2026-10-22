// The log moment (docs/05-fichas-2.md §10), loaded at idle: the marimba, a burst on the logged card when the meal is
// on plan, and one coin per food group flying from the meal into its tube, which takes the hit. Motion is skipped
// with reduced motion; the tubes still fill.
import './moment.css';
import type { TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { sparkle } from './celebrate';
import { playTokens } from './sound';

const FLIGHT = 620;

function hit(tank: Element): void {
  tank.classList.remove('is-hit');
  void (tank as HTMLElement).offsetWidth;
  tank.classList.add('is-hit');
  setTimeout(() => tank.classList.remove('is-hit'), 560);
}

function fly(t: TypeKey, from: DOMRect, to: DOMRect, delay: number, tank: Element | null): void {
  const coin = document.createElement('span');
  coin.className = `reward-coin t-${t}`;
  coin.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#g-${t}"/></svg>`;
  const x0 = from.left + from.width / 2 - 14 + (Math.random() - 0.5) * Math.min(80, from.width * 0.5);
  const y0 = from.top + Math.min(from.height / 2, 40) - 14;
  const dx = to.left + to.width / 2 - 14 - x0;
  const dy = to.top + 6 - 14 - y0;
  coin.style.left = `${x0}px`;
  coin.style.top = `${y0}px`;
  document.body.append(coin);
  const anim = coin.animate(
    [
      { transform: 'translate(0, 0) scale(0.4)', opacity: 0 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 56}px) scale(1.15)`, opacity: 1, offset: 0.42 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 1 },
    ],
    { duration: FLIGHT, delay, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'both' },
  );
  anim.onfinish = () => {
    coin.remove();
    if (tank) hit(tank);
  };
  anim.oncancel = () => coin.remove();
}

/** One coin per food group (up to three for big amounts) into the tubes on screen. */
export function coins(anchor: Element | null, units: Units, delay = 0): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const row = document.querySelector('[data-testid=day-meter]');
  if (!row) return;
  const from = (anchor ?? row).getBoundingClientRect();
  let i = 0;
  for (const t of TYPE_KEYS) {
    const n = units[t] ?? 0;
    if (n < 0.25) continue;
    const tank = row.querySelector(`[data-type="${t}"] .meter-tank`);
    if (!tank) continue;
    const to = tank.getBoundingClientRect();
    if (to.bottom < 0 || to.top > innerHeight) continue;
    const k = Math.min(3, Math.max(1, Math.round(n)));
    for (let j = 0; j < k; j++) fly(t, from, to, delay + i++ * 70, j === k - 1 ? tank : null);
  }
}

export function logMoment(o: {
  anchor: Element | null;
  /** Units by tube (the plan's groups). */
  units: Units;
  total: number;
  onPlan: boolean;
  /** Coming from a sheet: let it slide away first. */
  delay: number;
}): void {
  playTokens(Math.max(1, o.total), o.onPlan);
  if (o.onPlan)
    sparkle(
      o.anchor,
      TYPE_KEYS.filter((t) => (o.units[t] ?? 0) > 0),
    );
  coins(o.anchor, o.units, o.delay);
}
