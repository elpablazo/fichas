// UI state: route, selected day, open sheet, toast, suggestion cycling and the post-log celebration.
import { computed, signal } from '@preact/signals';
import type { LogItem, TypeKey } from '../../shared/domain/types';

/** Old Story URLs (including past push links) map to their new homes. */
export function canonical(path: string): string {
  if (path === '/historia') return '/progreso';
  if (path.startsWith('/historia/')) return `/progreso/${path.slice('/historia/'.length)}`;
  return path;
}

export const route = signal(canonical(location.pathname));
if (route.value !== location.pathname) history.replaceState(null, '', route.value);
export const kitchenSlot = signal<string | null>(null);
export const pushSlot = signal<string | null>(null);

export function navigate(path: string, replace = false): void {
  const next = canonical(path);
  if (next === route.value) return;
  if (replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
  route.value = next;
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => {
  route.value = canonical(location.pathname);
  sheet.value = null;
});

/** The day shown on Hoy; null follows the current app day. */
export const selectedDay = signal<string | null>(null);
export function selectDay(day: string | null): void {
  selectedDay.value = day;
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  // Coming back after a while starts again on today, like opening the app.
  else if (hiddenAt && Date.now() - hiddenAt > 30 * 60_000) selectedDay.value = null;
});

export type SheetState =
  | { kind: 'weighin'; id?: string }
  | { kind: 'season-recap'; id: string; mode?: 'recap' | 'report' }
  | { kind: 'meal'; slot: string; day?: string }
  | {
      kind: 'describe';
      slot?: string;
      day?: string;
      text?: string;
      items?: LogItem[];
      title?: string;
      recipeId?: string | null;
      /** A photo chosen inside the tap that opened the sheet (iOS needs the picker in the gesture). */
      photo?: File;
      /** check: "¿Qué se te antoja?" (see if a craving fits before eating). */
      mode?: 'log' | 'check';
    }
  | { kind: 'compose'; slot: string; day?: string; items?: LogItem[]; title?: string; logId?: string }
  | { kind: 'token'; type: TypeKey; day?: string }
  | { kind: 'install' }
  | { kind: 'day-close'; day: string }
  | { kind: 'day'; day: string }
  | { kind: 'food'; id: string }
  | { kind: 'plant'; day: string }
  | { kind: 'species'; id: string }
  | { kind: 'stamps' }
  | { kind: 'style' }
  | { kind: 'whats-new'; since?: string | null }
  | { kind: 'export-meals' }
  | { kind: 'eating' }
  | null;

export const sheet = signal<SheetState>(null);
export function openSheet(s: SheetState): void {
  sheet.value = s;
}
export function closeSheet(): void {
  sheet.value = null;
}

/**
 * Opens Describe with the keyboard up. iOS only shows the keyboard for focus() inside the tap, and the
 * sheet renders a moment later: focus a hidden proxy input now; the sheet's input takes focus on mount.
 */
export function openDescribe(s: Omit<Extract<SheetState, { kind: 'describe' }>, 'kind'> = {}): void {
  if (!s.items?.length && !s.photo) document.getElementById('focus-proxy')?.focus({ preventScroll: true });
  sheet.value = { kind: 'describe', ...s };
}

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
  until: number;
  ms: number;
}
export const toast = signal<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;
export function showToast(text: string, undo?: () => void): void {
  const ms = undo ? 5000 : 2400;
  toastId++;
  toast.value = { id: toastId, text, undo, until: Date.now() + ms, ms };
  clearTimeout(toastTimer);
  const id = toastId;
  toastTimer = setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, ms);
}
export function hideToast(): void {
  toast.value = null;
}

/** "Otra" position per slot. */
export const otherIndex = signal<Record<string, number>>({});

/** Keeps the meal card on the slot just logged while its tokens pop. */
export const celebrate = signal<{ slotKey: string; until: number; at: number } | null>(null);
let celebrateTimer: ReturnType<typeof setTimeout> | undefined;
export function startCelebration(slotKey: string, ms = 1800): void {
  const at = Date.now();
  celebrate.value = { slotKey, until: at + ms, at };
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    celebrate.value = null;
  }, ms);
}

/** Connection state (the tab bar says when there is none; logs still save locally). */
export const online = signal(navigator.onLine);
addEventListener('online', () => {
  online.value = true;
});
addEventListener('offline', () => {
  online.value = false;
});

/** When a log's coins took off: the tubes wait for them to land before rising. */
export const landing = signal(0);

export const isStandalone = computed(
  () =>
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true,
);

/** Keyboard users get focus rings; taps never leave one behind. */
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow')) document.documentElement.dataset.kbd = '';
  },
  true,
);
document.addEventListener('pointerdown', () => delete document.documentElement.dataset.kbd, true);
