import { CircleCheck } from 'lucide-preact';
import { buttons } from '../copy/es-MX';
import { hideToast, sheet, toast } from '../state/ui';

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div
      class="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={
        sheet.value ? 'top: calc(12px + var(--safe-top))' : 'bottom: calc(var(--tabbar-h) + 18px + var(--safe-bottom))'
      }
      role="status"
      aria-live="polite"
    >
      <div
        key={t.id}
        class="anim-toast pointer-events-auto relative flex max-w-[528px] flex-1 items-center gap-3 overflow-hidden rounded-[18px] py-1.5 pr-1.5 pl-4"
        style="background: color-mix(in srgb, var(--ink) 94%, transparent); color: var(--bg); box-shadow: var(--e2)"
      >
        <CircleCheck size={20} aria-hidden="true" style="color: var(--gold)" />
        <span class="flex-1 py-2 font-semibold leading-5">{t.text}</span>
        {t.undo && (
          <button
            type="button"
            class="press min-h-11 rounded-[14px] px-3 font-bold"
            style="color: var(--gold)"
            onClick={() => {
              t.undo?.();
              hideToast();
            }}
          >
            {buttons.undo}
          </button>
        )}
        {t.undo && (
          <span
            aria-hidden="true"
            class="absolute bottom-0 left-0 h-[3px] origin-left"
            style={`width:100%;background:var(--gold);opacity:.55;animation:toast-timer ${t.ms}ms linear forwards`}
          />
        )}
      </div>
    </div>
  );
}
