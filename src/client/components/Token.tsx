// Fichas as coins: grouped per food type in a tinted capsule. Empty = socket, full = coin, extra = "+" coin.
import { fill } from '../../shared/domain/format';
import { type TokenModel, tokenCounts } from '../../shared/domain/tokens';
import type { TypeKey, Units } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { labels, typeLabels } from '../copy/es-MX';

interface TokenProps {
  t: TokenModel;
  size?: number;
  pop?: boolean;
  delay?: number;
}

export function Token({ t, size = 30, pop = false, delay = 0 }: TokenProps) {
  const fillCls = t.fill === 1 ? 'tok-1' : t.fill === 0.5 ? 'tok-h' : 'tok-0';
  const anim = pop ? (t.extra ? 'anim-wiggle' : t.fill ? 'anim-pop' : '') : '';
  const s = t.half ? Math.round(size * 0.78) : size;
  return (
    <span
      class={`tok t-${t.type} ${fillCls}${t.extra ? ' tok-x' : ''}${anim ? ` ${anim}` : ''}`}
      style={`--s:${s}px;animation-delay:${delay}ms`}
      aria-hidden="true"
    >
      <svg class="e" viewBox="0 0 32 32" aria-hidden="true">
        <use href={`#g-${t.type}`} />
      </svg>
    </span>
  );
}

/** Spoken summary: "2 de 4 protes, 1 de 2 carbos, +1 grasa". */
export function tokensA11y(target: Units, eaten: Units): string {
  return tokenCounts(target, eaten)
    .map((c) => {
      const meta = typeLabels[c.type];
      const base =
        c.total > 0
          ? fill(labels.tokenA11y, { full: formatCount(c.full), total: formatCount(c.total), type: meta.plural })
          : '';
      const extra = c.extra > 0 ? `+${formatCount(c.extra)} ${c.extra > 1 ? meta.plural : meta.short}` : '';
      return [base, extra].filter(Boolean).join(', ');
    })
    .join(', ');
}

/** Eaten units implied by a token list (for labels). */
export function eatenOf(tokens: TokenModel[]): Units {
  const out: Units = {};
  for (const t of tokens) out[t.type] = (out[t.type] ?? 0) + (t.fill === 1 ? 1 : t.fill === 0.5 ? 0.5 : 0);
  return out;
}

function groupLabel(type: TypeKey, tokens: TokenModel[]): string {
  const meta = typeLabels[type];
  let full = 0;
  let total = 0;
  let extra = 0;
  for (const t of tokens) {
    const cap = t.half ? 0.5 : 1;
    if (t.extra) extra += t.fill === 1 ? 1 : 0.5;
    else {
      total += cap;
      full += t.fill === 1 ? cap : t.fill === 0.5 ? cap / 2 : 0;
    }
  }
  const base = total
    ? fill(labels.tokenA11y, { full: formatCount(full), total: formatCount(total), type: meta.plural })
    : '';
  return [meta.label, base, extra ? `+${formatCount(extra)}` : ''].filter(Boolean).join(': ');
}

function groups(tokens: TokenModel[]): { type: TypeKey; tokens: TokenModel[] }[] {
  const out: { type: TypeKey; tokens: TokenModel[] }[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (last && last.type === t.type) last.tokens.push(t);
    else out.push({ type: t.type, tokens: [t] });
  }
  return out;
}

interface RowProps {
  tokens: TokenModel[];
  size?: number;
  pop?: boolean;
  /** Spoken label for the whole row. */
  label: string;
  onType?: (t: TypeKey) => void;
  class?: string;
}

/** Capsules of coins per type. With onType, each capsule is a button that explains the type. */
export function TokenRow({ tokens, size = 30, pop = false, label, onType, class: cls = '' }: RowProps) {
  let i = 0;
  const gap = size >= 26 ? 'gap-2' : 'gap-1.5';
  const capsule = (g: { type: TypeKey; tokens: TokenModel[] }) => {
    const base = g.tokens.filter((t) => !t.extra);
    const extra = g.tokens.filter((t) => t.extra);
    return (
      <>
        {base.length > 0 && (
          <span class={`tokgroup t-${g.type}`}>
            {base.map((t) => (
              <Token key={i} t={t} size={size} pop={pop} delay={i++ * 60} />
            ))}
          </span>
        )}
        {extra.map((t) => (
          <Token key={i} t={t} size={size} pop={pop} delay={i++ * 60} />
        ))}
      </>
    );
  };
  if (!onType) {
    return (
      <div class={`flex flex-wrap items-center ${gap} ${cls}`} role="img" aria-label={label}>
        {groups(tokens).map((g) => (
          <span key={g.type} class="inline-flex items-center gap-1">
            {capsule(g)}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div class={`flex flex-wrap items-center ${gap} ${cls}`}>
      {groups(tokens).map((g) => (
        <button
          key={g.type}
          type="button"
          class="press inline-flex min-h-11 items-center gap-1 rounded-full"
          aria-label={groupLabel(g.type, g.tokens)}
          onClick={() => onType(g.type)}
        >
          {capsule(g)}
        </button>
      ))}
    </div>
  );
}
