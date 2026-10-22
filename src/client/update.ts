// A new version is ready: the service worker waits (installed) until the owner taps "Actualizar", then takes over
// and the page reloads once. The installed app also looks for updates when it comes back to the foreground.
import { signal } from '@preact/signals';

export const updateReady = signal(false);
let waiting: ServiceWorker | null = null;
let accepted = false;

export function watchUpdates(reg: ServiceWorkerRegistration): void {
  const offer = (w: ServiceWorker | null) => {
    // Without a controller this is the first install, not an update.
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    updateReady.value = true;
  };
  offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed') offer(w);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (accepted) location.reload();
  });
  let checked = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checked < 30 * 60_000) return;
    checked = Date.now();
    void reg.update().catch(() => {});
  });
}

export function applyUpdate(): void {
  accepted = true;
  updateReady.value = false;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}
