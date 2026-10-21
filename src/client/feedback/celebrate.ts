// Visual rewards: a sparkle burst on the logged card, and a full-screen confetti / papel picado celebration.
import type { TypeKey } from '../../shared/domain/types';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 10 particles in token colors, 560 ms, anchored to an element. */
export function sparkle(anchor: Element | null, types: TypeKey[]): void {
  if (!anchor || reduced()) return;
  const r = anchor.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:0;height:0;z-index:60;pointer-events:none`;
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
    const d = 46 + Math.random() * 36;
    const dot = document.createElement('span');
    const t = types[i % Math.max(1, types.length)] ?? 'carb_sg';
    dot.className = `sparkle-dot t-${t}`;
    dot.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    dot.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    layer.append(dot);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 650);
}
