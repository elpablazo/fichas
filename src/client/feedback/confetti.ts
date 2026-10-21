// Full-screen celebration: confetti, or papel picado once unlocked (lazy: only reward moments use it).
import { settings } from '../state/signals';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#f5a524', '#7c5cff', '#22b573', '#3ba3f5', '#e4007c', '#f0525a', '#c08cf5'];
const GOLD = ['#f2b705', '#ffd259', '#f5a524', '#fff4cc', '#e4007c'];

/** Full-screen burst: confetti, or papel picado once unlocked. 1.4 s, transforms only, no library. */
export function celebrateBig(gold = false): void {
  if (reduced()) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText = `position:fixed;inset:0;width:${w}px;height:${h}px;z-index:70;pointer-events:none`;
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);
  const papel = settings.value.style.celebration === 'papel';
  const palette = gold ? GOLD : COLORS;
  const parts = Array.from({ length: 90 }, (_, i) => ({
    x: w / 2 + (Math.random() - 0.5) * 60,
    y: h * 0.32,
    vx: (Math.random() - 0.5) * 9,
    vy: -6 - Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: papel ? 9 + Math.random() * 6 : 5 + Math.random() * 4,
    c: palette[i % palette.length] ?? '#e4007c',
  }));
  const start = performance.now();
  const frame = (at: number) => {
    const t = (at - start) / 1400;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t ** 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (papel) {
        // A tiny papel picado flag with a cut-out.
        ctx.fillRect(-p.s / 2, -p.s * 0.35, p.s, p.s * 0.7);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(0, 0, p.s * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (t < 1) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
