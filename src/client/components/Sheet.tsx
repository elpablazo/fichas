import { X } from 'lucide-preact';
import { type ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';
import { a11y } from '../copy/es-MX';

/** True while the host keeps a closed sheet mounted for its exit animation. */
export const SheetLeaving = createContext(false);

interface Props {
  label: string;
  onClose: () => void;
  header?: ComponentChildren;
  /** Actions pinned under the scrolling content, in the thumb zone. */
  footer?: ComponentChildren;
  children: ComponentChildren;
}

/** Bottom sheet: slides up, closes by dragging the header down, tapping outside, Escape or ×; slides away. */
export function Sheet({ label, onClose, header, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const dragClosed = useRef(false);
  const leaving = useContext(SheetLeaving);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const before = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ) ?? []),
      ].filter((el) => !el.hidden && el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) focusable()[0]?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const controls = focusable(),
        first = controls[0],
        last = controls.at(-1);
      if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [onClose]);

  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (ref.current) ref.current.style.transition = 'none';
  };
  const move = (e: PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y0);
    drag.current.dy = dy;
    ref.current.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0);
    el.style.transition = 'transform 220ms var(--out)';
    if (d.dy > 90 || (d.dy > 24 && velocity > 0.6)) {
      dragClosed.current = true;
      el.style.transform = 'translateY(105%)';
      onClose();
    } else el.style.transform = '';
  };

  return (
    <>
      <div
        class={`sheet-backdrop ${leaving ? 'anim-fade-out pointer-events-none' : 'anim-fade'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        class={`sheet ${leaving ? `pointer-events-none${dragClosed.current ? '' : ' anim-sheet-out'}` : 'anim-sheet'}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={leaving ? 'true' : undefined}
      >
        <div
          class="shrink-0 touch-none px-4 pb-2"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <div class="sheet-grip" />
          <div class="mt-2 flex min-h-11 items-center justify-between gap-2">
            <div class="min-w-0 flex-1">{header}</div>
            <button type="button" class="icon-btn -mr-1" aria-label={a11y.sheetClose} onClick={onClose}>
              <X size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div class="shrink-0 border-line border-t px-4 pt-3 pb-3">{footer}</div>}
      </div>
    </>
  );
}
