// Circular progress (the day ring on Hoy is on the first paint, so it lives apart from the other ui parts).
import type { ComponentChildren } from 'preact';

/** Circular progress; overflow draws a second, lighter lap. */
export function Ring({
  value,
  max,
  size = 44,
  stroke = 4,
  color = 'var(--accent)',
  children,
  class: cls = '',
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ComponentChildren;
  class?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? value / max : 0;
  const first = Math.min(1, ratio);
  const over = Math.min(1, Math.max(0, ratio - 1));
  return (
    <span class={`relative inline-grid place-items-center ${cls}`} style={`width:${size}px;height:${size}px`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        class="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" stroke-width={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${first * c} ${c}`}
          style="transition: stroke-dasharray 420ms var(--out)"
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            stroke-opacity={0.45}
            stroke-width={stroke}
            stroke-linecap="round"
            stroke-dasharray={`${over * c} ${c}`}
            transform={`rotate(-8 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span class="relative">{children}</span>
    </span>
  );
}
