// The current meal: its coins, a ready dish that fits (swipe for others) and one tap to log it.
import { Check, ChevronRight, Pencil, Scale, Shuffle, Sparkles } from 'lucide-preact';
import { useRef } from 'preact/hooks';
import type { TypeKey } from '../../shared/domain/types';
import { a11y, buttons, labels, lines } from '../copy/es-MX';
import type { CardVM } from '../state/today-vm';
import { eatenOf, TokenRow, tokensA11y } from './Token';

interface Props {
  card: CardVM;
  onAte: (anchor: Element | null) => void;
  onCycle: (dir: 1 | -1) => void;
  onAdjust: () => void;
  onOpen: () => void;
  onToken: (t: TypeKey) => void;
}

export function MealCard({ card, onAte, onCycle, onAdjust, onOpen, onToken }: Props) {
  const s = card.suggestion;
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const well = useRef<HTMLDivElement>(null);
  const down = (e: PointerEvent) => {
    if (card.count < 2) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const move = (e: PointerEvent) => {
    const st = swipe.current;
    if (!st || !well.current) return;
    const dx = e.clientX - st.x;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - st.y))
      well.current.style.transform = `translateX(${dx * 0.35}px)`;
  };
  const up = (e: PointerEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st || !well.current) return;
    const dx = e.clientX - st.x;
    well.current.style.transform = '';
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - st.y)) onCycle(dx < 0 ? 1 : -1);
  };
  return (
    <section class="card mb-4 p-4" data-card aria-label={card.label}>
      <h2 class="title">
        <button
          type="button"
          class="press -mx-1 -mt-1 flex w-[calc(100%+8px)] items-center justify-between gap-2 rounded-2xl px-1 py-1 text-left"
          onClick={onOpen}
        >
          <span>
            {card.label} <span class="font-semibold text-ink-2">{card.time}</span>
          </span>
          <span class="flex items-center gap-1.5">
            {card.adjusted && (
              <span class="badge accent">
                <Scale size={13} aria-hidden="true" />
                <span class="sr-only">{lines.adjusted}</span>
              </span>
            )}
            <ChevronRight size={22} class="text-ink-3" aria-hidden="true" />
          </span>
        </button>
      </h2>
      <TokenRow
        class="mt-2"
        tokens={card.tokens}
        size={card.tokens.length <= 7 ? 30 : card.tokens.length <= 9 ? 27 : card.tokens.length <= 11 ? 24 : 22}
        pop={card.celebrating}
        label={tokensA11y(card.target, eatenOf(card.tokens))}
        onType={onToken}
      />
      {s && !card.celebrating && (
        <div
          ref={well}
          class="well mt-3 touch-pan-y px-4 py-3 transition-transform duration-150"
          data-testid="suggestion"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            swipe.current = null;
            if (well.current) well.current.style.transform = '';
          }}
        >
          <div class="flex items-center justify-between gap-2">
            {s.tag ? (
              <span class="badge accent">
                <Sparkles size={12} aria-hidden="true" />
                {labels.tagsCompact[s.tag]}
              </span>
            ) : (
              <span />
            )}
            {card.count > 1 && (
              <span class="flex gap-1" role="img" aria-label={`${card.index + 1} ${labels.of} ${card.count}`}>
                {Array.from({ length: card.count }, (_, i) => (
                  <span
                    key={i}
                    class="h-1.5 rounded-full transition-all"
                    style={`width:${i === card.index ? 14 : 6}px;background:${i === card.index ? 'var(--accent)' : 'var(--line-2)'}`}
                  />
                ))}
              </span>
            )}
          </div>
          <p class="headline mt-1.5" data-testid="suggestion-title">
            {s.title}
          </p>
          <p class="secondary muted mt-0.5">
            {s.items
              .filter((i) => !i.free)
              .map((it, i, arr) => {
                const idx = s.items.indexOf(it);
                return (
                  <span key={i}>
                    <span class={s.changed.includes(idx) ? 'highlight font-semibold text-ink' : ''}>{it.label}</span>
                    {i < arr.length - 1 ? ' · ' : ''}
                  </span>
                );
              })}
          </p>
        </div>
      )}
      {card.celebrating ? (
        <div class="btn btn-primary anim-pop mt-3 w-full" aria-hidden="true">
          <Check size={26} strokeWidth={3} />
        </div>
      ) : s ? (
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            class="btn btn-primary flex-1"
            data-testid="ate"
            onClick={(e) => onAte(e.currentTarget)}
          >
            <Check size={22} strokeWidth={3} aria-hidden="true" />
            {buttons.ate}
          </button>
          <button
            type="button"
            class="icon-btn lg"
            aria-label={a11y.other}
            title={a11y.other}
            data-testid="other"
            onClick={() => onCycle(1)}
          >
            <Shuffle size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-btn lg"
            aria-label={a11y.adjust}
            title={a11y.adjust}
            data-testid="adjust"
            onClick={onAdjust}
          >
            <Pencil size={21} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button type="button" class="btn btn-tonal mt-3 w-full" data-testid="adjust" onClick={onAdjust}>
          <Pencil size={20} aria-hidden="true" />
          {buttons.compose}
        </button>
      )}
    </section>
  );
}
