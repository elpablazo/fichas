import { Minus, Plus, X } from 'lucide-preact';
import { a11y } from '../copy/es-MX';

interface Props {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  highlight?: boolean;
  note?: string | null;
  onRemove?: () => void;
}

/** One food line with − / + controls: "− 120 g pollo +". */
export function Stepper({ label, onMinus, onPlus, onRemove, highlight = false, note }: Props) {
  return (
    <div class="flex items-center gap-2 py-1">
      <button type="button" class="icon-btn" aria-label={`${a11y.stepDown}: ${label}`} onClick={onMinus}>
        <Minus size={18} strokeWidth={2.6} aria-hidden="true" />
      </button>
      <div class={`min-w-0 flex-1 rounded-lg px-1.5 py-1 ${highlight ? 'highlight' : ''}`}>
        <span class="font-semibold">{label}</span>
        {note && <span class="badge ml-2 align-middle">{note}</span>}
      </div>
      <button type="button" class="icon-btn" aria-label={`${a11y.stepUp}: ${label}`} onClick={onPlus}>
        <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
      </button>
      {onRemove && (
        <button
          type="button"
          class="icon-btn ghost text-ink-3"
          aria-label={`${a11y.remove}: ${label}`}
          onClick={onRemove}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
