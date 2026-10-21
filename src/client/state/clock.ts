// A clock signal (refreshes every 30 s and on focus) so Today follows the time of day.
import { signal } from '@preact/signals';

export const now = signal(Date.now());

let started = false;
export function startClock(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    now.value = Date.now();
  }, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') now.value = Date.now();
  });
}
