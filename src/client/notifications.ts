import { computed, signal } from '@preact/signals';
import { isOccasion } from '../shared/domain/status';
import { setSetting } from './actions';
import { notificationCopy } from './copy/es-MX';
import { api, syncNow } from './db/sync';
import { gardenLogs } from './game';
import { now } from './state/clock';
import { settings } from './state/signals';
import { canonical, celebrate, closeSheet, isStandalone, navigate, pushSlot, selectDay, showToast } from './state/ui';

export const pushBusy = signal(false);
export const pushPermission = signal<NotificationPermission>(
  'Notification' in window ? Notification.permission : 'denied',
);
export const pushSupported = computed(
  () => isStandalone.value && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator,
);
export const canPrime = computed(() => {
  if (!pushSupported.value || pushPermission.value !== 'default' || settings.value.notifications.enabled) return false;
  const asked = settings.value.onboarding.notif_asked ?? [];
  if (asked.length >= 2 || (asked.length && now.value - asked.at(-1)! < 7 * 86400000)) return false;
  const days = new Map<string, number>();
  for (const l of gardenLogs.value.filter(isOccasion)) days.set(l.day, (days.get(l.day) ?? 0) + 1);
  return [...days.values()].some((n) => n >= 3);
});
export async function dismissPriming() {
  const onboarding = settings.value.onboarding;
  await setSetting('onboarding', { ...onboarding, notif_asked: [...onboarding.notif_asked, Date.now()].slice(-2) });
}
export async function enableReminders() {
  if (pushBusy.value) return false;
  if (!pushSupported.value) {
    showToast(notificationCopy.install);
    return false;
  }
  if (!navigator.onLine) {
    showToast(notificationCopy.offline);
    return false;
  }
  pushBusy.value = true;
  try {
    // Permission is requested directly from the tap, before any await (required by iOS).
    const permission =
      Notification.permission === 'default'
        ? Notification.requestPermission()
        : Promise.resolve(Notification.permission);
    pushPermission.value = await permission;
    if (pushPermission.value !== 'granted') {
      showToast(notificationCopy.permissions);
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    const response = await api('/api/push/vapid');
    if (!response.ok) throw new Error('Unavailable');
    const { key } = (await response.json()) as { key: string };
    if (!key) throw new Error('Unavailable');
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    const saved = await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
    if (!saved.ok) throw new Error('Unavailable');
    await setSetting('notifications', { ...settings.value.notifications, enabled: true, paused_until: null });
    showToast(notificationCopy.enabled);
    return true;
  } catch {
    showToast(notificationCopy.retry);
    return false;
  } finally {
    pushBusy.value = false;
  }
}
export async function disableReminders() {
  if (pushBusy.value) return;
  pushBusy.value = true;
  try {
    await setSetting('notifications', { ...settings.value.notifications, enabled: false });
  } catch {
    showToast(notificationCopy.retry);
  } finally {
    pushBusy.value = false;
  }
}
export async function testPush() {
  if (pushBusy.value) return;
  pushBusy.value = true;
  try {
    await syncNow();
    const response = await api('/api/push/test', { method: 'POST' });
    showToast(
      response.ok
        ? notificationCopy.testSent
        : response.status === 409
          ? notificationCopy.later
          : notificationCopy.retry,
    );
  } catch {
    showToast(notificationCopy.retry);
  } finally {
    pushBusy.value = false;
  }
}
export function followPushLink(value: string) {
  let url: URL;
  try {
    url = new URL(value, location.origin);
  } catch {
    return;
  }
  const path = canonical(url.pathname);
  if (url.origin !== location.origin || !['/', '/progreso/plan/nuevo'].includes(path)) return;
  pushSlot.value = path === '/' ? url.searchParams.get('slot') : null;
  celebrate.value = null;
  selectDay(null);
  closeSheet();
  navigate(path);
  history.replaceState(null, '', path);
}
