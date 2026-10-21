import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { buttons, lines } from '../copy/es-MX';
import { pick } from '../copy/pick';
import { today } from '../state/signals';
import { navigate, showToast } from '../state/ui';
import { Plant } from './Plant';

/** A two-second season welcome. Tap or Escape skips; no data changes depend on this animation. */
export function SeasonStart({ n, startsOn }: { n: number; startsOn: string }) {
  const [line] = useState(() => pick('season.start', { n }));
  const button = useRef<HTMLButtonElement>(null);
  const finish = useCallback(() => {
    if (startsOn === addDays(today.value, 1)) showToast(lines.planTomorrow);
    navigate('/');
  }, [startsOn]);
  useEffect(() => {
    button.current?.focus();
    const timer = setTimeout(finish, 2000);
    return () => clearTimeout(timer);
  }, [finish]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={line}
      class="fixed inset-0 z-60 grid place-items-center bg-surface anim-fade"
      data-testid="season-start"
      onKeyDown={(e) => {
        if (e.key === 'Escape') finish();
        if (e.key === 'Tab') {
          e.preventDefault();
          button.current?.focus();
        }
      }}
    >
      <button ref={button} type="button" class="press w-full max-w-sm p-8 text-center" onClick={finish}>
        <p class="screen-title mb-6">{line}</p>
        <span class="sr-only">{buttons.today}</span>
        <span class="grid grid-cols-5 gap-1" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => (
            <Plant key={i} stage={i % 4 === 0 ? 'sprout' : 'seed'} species="margarita" size={52} />
          ))}
        </span>
      </button>
    </div>
  );
}
