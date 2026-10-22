import './styles/app.css';
import { effect } from '@preact/signals';
import { render } from 'preact';
import { setSetting } from './actions';
import { App, PREFETCH, PREFETCH_NOW } from './app';
import { loadPlant } from './components/LazyPlant';
import { db, getLocal, setLocal } from './db/dexie';
import { restorePantryJournal } from './db/pantry-journal';
import { firstPullDone, setSyncErrorReporter, startSync } from './db/sync';
import { setHapticsOn } from './feedback/haptics';
import { prepareAudio, setSoundOn, unlockAudio } from './feedback/sound';
import { startGame } from './game';
import { followPushLink } from './notifications';
import { startClock } from './state/clock';
import { persistSnapshots, readSnapshot, snapshot } from './state/selectors';
import { activePlan, dataReady, planReadingEnabled, settings, startLiveQueries } from './state/signals';
import { isStandalone, openSheet, sheet } from './state/ui';
import { record, reportError, startTelemetry } from './telemetry';
import { watchUpdates } from './update';

performance.mark('app:js-start');

// "Novedades" after an update: the last version this device saw (a device with a Today snapshot but no record
// used the app before versions were recorded; a brand-new device has nothing to compare).
const seenVersion = (() => {
  try {
    const v = localStorage.getItem('version:seen');
    if (v) return v;
    if (localStorage.getItem('today:snapshot')) return '';
    localStorage.setItem('version:seen', __APP_VERSION__);
    return __APP_VERSION__;
  } catch {
    return __APP_VERSION__;
  }
})();

// 1) Snapshot-first: paint the last Today view synchronously (§12).
const snap = readSnapshot();
if (snap) snapshot.value = snap;
render(<App />, document.getElementById('app') as HTMLElement);
// The detailed plants are the first thing worth loading after the meal card is on screen.
requestAnimationFrame(() =>
  setTimeout(() => {
    void Promise.allSettled([loadPlant(), ...PREFETCH_NOW.map((v) => v.prefetch())]).then(() => {
      document.documentElement.dataset.warm = '';
    });
  }, 0),
);

// 2) Then data, sync, telemetry.
startTelemetry();
startClock();
setSyncErrorReporter((msg) => reportError(`sync_rejected: ${msg}`, null, 'sync'));
const ready = startLiveQueries((e) => reportError(String(e), (e as Error)?.stack ?? null, 'dexie'));
persistSnapshots();
void restorePantryJournal()
  .then(startSync)
  .catch(() => startSync());
startGame();
void fetch('/api/health')
  .then((r) => r.json())
  .then((health: { planReading?: boolean }) => {
    planReadingEnabled.value = health.planReading === true;
  })
  .catch(() => {});

// 2.0: the old default theme (rosa mexicano) becomes Invernadero once; picking Rosa again stays possible.
let themeMigrated = false;
effect(() => {
  if (themeMigrated || !dataReady.value || !firstPullDone.value) return;
  themeMigrated = true;
  const style = settings.peek().style;
  void getLocal('theme:v2', false).then((done) => {
    if (done) return;
    void setLocal('theme:v2', true);
    if (style.theme === 'rosa') void setSetting('style', { ...style, theme: 'invernadero' });
  });
});

effect(() => {
  setSoundOn(settings.value.sound);
  setHapticsOn(settings.value.haptics);
  const style = settings.value.style;
  document.documentElement.dataset.theme = style.theme;
  document.documentElement.dataset.token = style.token;
  const color = /^color_(\d+)$/.exec(style.theme);
  if (color) {
    const hue = (Number(color[1]) * 137.508) % 360;
    document.documentElement.style.setProperty('--accent-custom', `hsl(${hue} 65% 32%)`);
    document.documentElement.style.setProperty('--accent-custom-light', `hsl(${hue} 65% 30%)`);
    document.documentElement.style.setProperty('--accent-custom-dark', `hsl(${hue} 65% 76%)`);
  } else {
    for (const name of ['--accent-custom', '--accent-custom-light', '--accent-custom-dark'])
      document.documentElement.style.removeProperty(name);
  }
});

void ready.then(() => {
  requestAnimationFrame(() => {
    performance.mark('today:data');
    record('today_painted', Math.round(performance.now()), null, snap ? 'snapshot' : 'cold');
  });
  if (isStandalone.value) void navigator.storage?.persist?.();
});

// One-time install sheet (Safari on iOS, not installed). Decide only once real settings are known:
// after the first pull on a new device, or from local data when offline.
let installDecided = false;
effect(() => {
  if (installDecided || !dataReady.value || !activePlan.value) return;
  if (!firstPullDone.value && navigator.onLine) return;
  installDecided = true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!ios || isStandalone.value) return;
  // Read the stored value: the settings signal may not have caught up with the pull yet.
  void db.settings.get('onboarding').then((row) => {
    const seen = (row?.value as { install_hint?: boolean } | undefined)?.install_hint;
    if (!seen) openSheet({ kind: 'install' });
  });
});

// One "Novedades" sheet per update, once the data is in and nothing else is open.
let newsDecided = false;
effect(() => {
  if (newsDecided || seenVersion === __APP_VERSION__ || !dataReady.value || !activePlan.value || sheet.value) return;
  newsDecided = true;
  openSheet({ kind: 'whats-new', since: seenVersion || null });
});

// Deep links from notifications: /?slot=<key>&src=push
const params = new URLSearchParams(location.search);
if (params.get('src') === 'push') followPushLink(location.href);
else if (params.has('src')) history.replaceState(null, '', location.pathname);
navigator.serviceWorker?.addEventListener('message', (e: MessageEvent<{ navigate?: string }>) => {
  if (e.data?.navigate) {
    followPushLink(e.data.navigate);
  }
});

document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

// Prefetch secondary views when idle; register the service worker in production.
const idle = (fn: () => void) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1200);
idle(() => {
  for (const v of PREFETCH) void v.prefetch().catch(() => {});
  if (settings.value.sound) prepareAudio();
});
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () =>
      void navigator.serviceWorker
        .register('/sw.js')
        .then(watchUpdates)
        .catch(() => {}),
  );
}
