// Reward moments: a card that drops in at the top — a new species with its fact, a level, a stamp, a surprise.
import { useEffect } from 'preact/hooks';
import { stageLabels } from '../copy/es-MX';
import { celebrateBig } from '../feedback/confetti';
import { tick } from '../feedback/haptics';
import { playArpeggio, playBloom, playThunk } from '../feedback/sound';
import { dismissMoment, moment } from '../game';
import { Plant } from './Plant';
import { StampIcon } from './StampIcon';

export default function GameMoment() {
  const m = moment.value;
  useEffect(() => {
    if (!m) return;
    if (m.kind === 'stamp') playThunk();
    else if (m.kind === 'species' || m.kind === 'bloom') playBloom();
    else playArpeggio();
    tick(m.kind === 'level' ? 3 : 1);
    if (m.kind === 'level' || m.kind === 'surprise' || m.rare) celebrateBig(!!m.rare);
  }, [m]);
  if (!m) return null;
  const plant = m.species && (m.kind === 'species' || m.kind === 'bloom');
  return (
    <div
      class="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style="top: calc(12px + var(--safe-top))"
      aria-live="polite"
    >
      <button
        type="button"
        class="card anim-reveal pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden p-3 text-left"
        style="background: linear-gradient(135deg, var(--surface), var(--accent-soft))"
        onClick={dismissMoment}
      >
        {plant ? (
          <span class="shrink-0 rounded-2xl" style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1))">
            <Plant stage="bloom" species={m.species ?? ''} size={64} grow label={stageLabels.bloom} />
          </span>
        ) : (
          <span
            class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface text-accent-ink anim-stamp"
            style={m.kind === 'stamp' ? 'box-shadow: 0 0 0 3px var(--gold); color: var(--gold-ink)' : undefined}
            aria-hidden="true"
          >
            <StampIcon k={m.stamp ?? m.kind} size={28} />
          </span>
        )}
        <span class="min-w-0 flex-1">
          <span class="block font-bold leading-5">{m.text}</span>
          {m.fact && <span class="caption mt-0.5 block">{m.fact}</span>}
        </span>
      </button>
    </div>
  );
}
