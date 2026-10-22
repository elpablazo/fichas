// "Hay una versión nueva · Actualizar": stays at the top until tapped; never interrupts a sheet.
import { Sparkles } from 'lucide-preact';
import { updateCopy } from '../copy/es-MX';
import { sheet } from '../state/ui';
import { applyUpdate, updateReady } from '../update';

export function UpdateToast() {
  if (!updateReady.value || sheet.value) return null;
  return (
    <div
      class="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style="top: calc(10px + var(--safe-top))"
    >
      <div class="toast anim-toast pointer-events-auto flex max-w-[528px] flex-1 items-center gap-3 rounded-[18px] py-1.5 pr-1.5 pl-4">
        <Sparkles size={20} aria-hidden="true" style="color: var(--gold)" />
        <span class="flex-1 py-2 font-semibold leading-5" role="status">
          {updateCopy.ready}
        </span>
        <button
          type="button"
          class="btn btn-sm shrink-0"
          style="background: var(--gold); color: #3a2a00; box-shadow: 0 3px 0 var(--gold-lip)"
          data-testid="update-apply"
          onClick={applyUpdate}
        >
          {updateCopy.apply}
        </button>
      </div>
    </div>
  );
}
