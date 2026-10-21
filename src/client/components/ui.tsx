// Small shared building blocks of the design system (docs/03-redesign.md §4).
import { ChevronLeft } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { a11y } from '../copy/es-MX';
import { navigate } from '../state/ui';

/** Large screen title with an optional subtitle, back button and trailing action. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  back?: string;
  right?: ComponentChildren;
}) {
  return (
    <header class="mb-4 flex items-start gap-2">
      {back && (
        <button type="button" class="icon-btn ghost -ml-2 mt-0.5" aria-label={a11y.back} onClick={() => navigate(back)}>
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
      )}
      <div class="min-w-0 flex-1">
        <h1 class="screen-title">{title}</h1>
        {subtitle && <p class="secondary muted mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="mb-2 mt-6 flex min-h-11 items-end justify-between gap-3 px-1">
      <h2 class="section-title">{children}</h2>
      {action}
    </div>
  );
}

/** Segmented control with a sliding thumb. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ComponentChildren }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div class="seg" role="tablist" aria-label={label}>
      <span
        class="seg-thumb"
        aria-hidden="true"
        style={`width:calc((100% - 8px) / ${options.length});transform:translateX(${i * 100}%)`}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A list row that is also a switch. */
export function SwitchRow({
  label,
  help,
  on,
  onChange,
  disabled = false,
  icon,
}: {
  label: string;
  help?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: ComponentChildren;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      class="row press"
      onClick={() => onChange(!on)}
    >
      {icon && <span class="row-icon">{icon}</span>}
      <span class="min-w-0 flex-1">
        <span class="block font-semibold">{label}</span>
        {help && <span class="caption block">{help}</span>}
      </span>
      <span class="switch" aria-hidden="true" />
    </button>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  class: cls = '',
}: {
  value: number;
  max: number;
  label?: string;
  class?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      class={`bar ${cls}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <span style={`width:${pct}%`} />
    </div>
  );
}

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

/** Designed empty state: an illustration, one line and at most one action. */
export function Empty({
  art,
  title,
  text,
  action,
}: {
  art?: ComponentChildren;
  title: ComponentChildren;
  text?: ComponentChildren;
  action?: ComponentChildren;
}) {
  return (
    <div class="flex flex-col items-center px-6 py-8 text-center">
      {art && <div class="mb-3">{art}</div>}
      <p class="headline">{title}</p>
      {text && <p class="secondary muted mt-1 max-w-[30ch]">{text}</p>}
      {action && <div class="mt-4">{action}</div>}
    </div>
  );
}
