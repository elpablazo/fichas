import { Check, Lock } from 'lucide-preact';
import { fill } from '../../shared/domain/format';
import { accents, UNLOCKS } from '../../shared/game/levels';
import { setSetting } from '../actions';
import { Sheet } from '../components/Sheet';
import { gameCopy } from '../copy/es-MX';
import { progress } from '../game';
import { settings } from '../state/signals';
import { closeSheet } from '../state/ui';

const SWATCH: Record<string, string> = {
  rosa: '#e4007c',
  talavera: '#1f4fd1',
  noche: 'linear-gradient(135deg, #1c1930 50%, #e4007c 50%)',
  cobalto: '#1f4fd1',
  bosque: '#187749',
  uva: '#7046ac',
  oceano: '#096b87',
  clasico: 'radial-gradient(circle at 35% 30%, #fff 0 25%, #f5c56b 70%)',
  gema: 'linear-gradient(135deg, #7c5cff, #3ba3f5)',
  confeti: 'conic-gradient(#f5a524 0 25%, #7c5cff 0 50%, #22b573 0 75%, #e4007c 0)',
  papel: 'repeating-linear-gradient(90deg, #e4007c 0 8px, #f5a524 8px 16px, #22b573 16px 24px)',
};
const NAMES: Record<string, string> = {
  rosa: gameCopy.rosa,
  talavera: 'Talavera',
  noche: 'Noche',
  clasico: gameCopy.classicTokens,
  gema: 'Gema',
  confeti: gameCopy.confetti,
  papel: 'Papel picado',
};

export default function Style() {
  const style = settings.value.style;
  const n = progress.value.level;
  const groups = [
    { key: 'theme', name: gameCopy.theme, base: ['rosa'], extra: accents(n) },
    { key: 'token', name: gameCopy.token, base: ['clasico'], extra: [] as string[] },
    { key: 'celebration', name: gameCopy.celebration, base: ['confeti'], extra: [] as string[] },
  ] as const;
  return (
    <Sheet label={gameCopy.style} header={<h2 class="title">{gameCopy.style}</h2>} onClose={closeSheet}>
      {groups.map((g) => {
        const unlockable = UNLOCKS.filter((u) => u.kind === g.key);
        const options = [
          ...g.base.map((key) => ({ key, level: 1 })),
          ...unlockable.map((u) => ({ key: u.key, level: u.level })),
          ...g.extra.map((key, i) => ({ key, level: 11 + i })),
        ];
        return (
          <section key={g.key} class="mb-5">
            <h3 class="kicker mb-2 px-1">{g.name}</h3>
            <div class="grid grid-cols-2 gap-2">
              {options.map((o) => {
                const locked = o.level > n;
                const on = style[g.key] === o.key;
                const name =
                  NAMES[o.key] ??
                  (o.key.startsWith('color_')
                    ? fill(gameCopy.color, { n: o.key.slice(6) })
                    : o.key[0]?.toUpperCase() + o.key.slice(1));
                return (
                  <button
                    type="button"
                    key={o.key}
                    disabled={locked}
                    class="press flex min-h-14 items-center gap-3 rounded-[18px] px-3 text-left disabled:opacity-60"
                    style={
                      on
                        ? 'background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent)'
                        : 'background: var(--surface-2)'
                    }
                    aria-pressed={on}
                    onClick={() => void setSetting('style', { ...style, [g.key]: o.key })}
                  >
                    <span
                      class="h-8 w-8 shrink-0 rounded-full"
                      style={`background: ${SWATCH[o.key] ?? `hsl(${(Number(o.key.slice(6)) * 137.5) % 360} 65% 40%)`}`}
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-bold">{name}</span>
                      {locked && <span class="caption block">{fill(gameCopy.level, { n: o.level })}</span>}
                    </span>
                    {locked ? (
                      <Lock size={16} class="text-ink-3" aria-hidden="true" />
                    ) : (
                      on && <Check size={18} strokeWidth={3} class="text-accent-ink" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}
