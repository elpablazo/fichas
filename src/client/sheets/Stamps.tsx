import { Lock } from 'lucide-preact';
import { STAMPS } from '../../shared/game/stamps';
import { Sheet } from '../components/Sheet';
import { StampIcon } from '../components/StampIcon';
import { gameCopy } from '../copy/es-MX';
import { achievements, activePlan } from '../state/signals';
import { closeSheet } from '../state/ui';

export function StampGrid() {
  const season = activePlan.value?.season;
  const earned = new Set(achievements.value.filter((a) => a.kind === 'stamp' && a.season === season).map((a) => a.key));
  return (
    <div class="grid grid-cols-3 gap-2.5">
      {STAMPS.map((s) => {
        const got = earned.has(s.key);
        const secret = s.hidden && !got;
        return (
          <div
            key={s.key}
            class="flex flex-col items-center rounded-[20px] px-2 py-3 text-center"
            style={
              got
                ? 'background: linear-gradient(160deg, var(--gold-soft), var(--surface)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--gold) 45%, transparent)'
                : 'background: var(--surface-2)'
            }
            data-earned={got}
          >
            <span
              class={`grid h-14 w-14 place-items-center rounded-full ${got ? 'anim-stamp' : 'text-ink-3'}`}
              style={
                got
                  ? 'background: var(--surface); color: var(--gold-ink); box-shadow: 0 0 0 3px var(--gold), 0 4px 10px rgb(0 0 0 / 10%)'
                  : 'background: var(--surface-3); opacity: .7'
              }
              aria-hidden="true"
            >
              {secret ? <Lock size={22} /> : <StampIcon k={s.key} />}
            </span>
            <span class={`mt-2 text-[13px] font-bold leading-4 ${got ? '' : 'text-ink-2'}`}>
              {secret ? gameCopy.undiscovered : s.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Stamps() {
  const season = activePlan.value?.season;
  const n = achievements.value.filter((a) => a.kind === 'stamp' && a.season === season).length;
  return (
    <Sheet
      label={gameCopy.stamps}
      header={
        <h2 class="title">
          {gameCopy.stamps} <span class="text-ink-3">· {n}</span>
        </h2>
      }
      onClose={closeSheet}
    >
      <StampGrid />
    </Sheet>
  );
}
