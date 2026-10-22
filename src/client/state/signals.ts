// Live data from IndexedDB as signals. Components read signals; writes go through actions.
import { computed, signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { addDays, appDay, DEFAULT_TZ } from '../../shared/domain/day';
import type {
  AchievementRow,
  LogRow,
  MenuRow,
  PantryRow,
  PlanRow,
  RecipeRow,
  SettingRow,
  WeighinRow,
} from '../../shared/domain/types';
import { db } from '../db/dexie';
import { now } from './clock';

export const plans = signal<PlanRow[]>([]);
export const logs = signal<LogRow[]>([]);
export const recipes = signal<RecipeRow[]>([]);
export const settingRows = signal<SettingRow[]>([]);
export const menus = signal<MenuRow[]>([]);
export const pantry = signal<PantryRow[]>([]);
export const achievements = signal<AchievementRow[]>([]);
export const weighins = signal<WeighinRow[]>([]);
/** True once the first IndexedDB read finished (data may still be empty on a new device). */
export const dataReady = signal(false);
export const planReadingEnabled = signal(false);

export interface Settings {
  tz: string;
  day_start_hour: number;
  sound: boolean;
  haptics: boolean;
  notifications: {
    enabled: boolean;
    paused_until: number | null;
    quiet: [string, string];
    slots: Record<string, boolean>;
    /** The evening recap (on unless turned off). */
    recap?: boolean;
  };
  rebalance: 'unknown' | 'allowed' | 'not_allowed';
  style: { petal: string; theme: string; token: string; celebration: string };
  onboarding: { install_hint: boolean; notif_asked: number[]; token_hint: boolean };
  last_closed_day: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  tz: DEFAULT_TZ,
  day_start_hour: 4,
  sound: true,
  haptics: true,
  notifications: { enabled: false, paused_until: null, quiet: ['22:30', '09:00'], slots: {} },
  rebalance: 'unknown',
  style: { petal: 'clasica', theme: 'invernadero', token: 'clasico', celebration: 'confeti' },
  onboarding: { install_hint: false, notif_asked: [], token_hint: false },
  last_closed_day: null,
};

export const settings = computed<Settings>(() => {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of settingRows.value) out[r.key] = r.value;
  return out as unknown as Settings;
});

export const today = computed(() => appDay(now.value, settings.value.tz, settings.value.day_start_hour));

const LOG_DAYS = 60;

export function startLiveQueries(onError: (e: unknown) => void): Promise<void> {
  const from = addDays(appDay(Date.now()), -LOG_DAYS);
  const pending = new Set<string>();
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });
  const sub = <T>(name: string, query: () => Promise<T>, target: { value: T }) => {
    pending.add(name);
    liveQuery(query).subscribe({
      next: (v) => {
        target.value = v;
        if (pending.delete(name) && pending.size === 0) {
          dataReady.value = true;
          resolveReady();
        }
      },
      error: onError,
    });
  };
  sub('plans', () => db.plans.toArray(), plans);
  sub('logs', () => db.logs.where('day').aboveOrEqual(from).toArray(), logs);
  sub('recipes', () => db.recipes.toArray(), recipes);
  sub('settings', () => db.settings.toArray(), settingRows);
  sub('menus', () => db.menus.where('day').aboveOrEqual(from).toArray(), menus);
  sub('pantry', () => db.pantry.toArray(), pantry);
  sub('achievements', () => db.achievements.toArray(), achievements);
  sub('weighins', () => db.weighins.toArray(), weighins);
  return ready;
}

/** The confirmed plan in force on a day (latest start ≤ day), else the earliest one. */
export function planForDay(all: PlanRow[], day: string): PlanRow | null {
  const confirmed = all.filter((p) => (p.status === 'active' || p.status === 'archived') && p.starts_on);
  const inForce = confirmed
    .filter((p) => (p.starts_on as string) <= day && (!p.ends_on || p.ends_on >= day))
    .sort((a, b) => (b.starts_on as string).localeCompare(a.starts_on as string));
  if (inForce[0]) return inForce[0];
  return confirmed.sort((a, b) => (a.starts_on as string).localeCompare(b.starts_on as string))[0] ?? null;
}

export const activePlan = computed(() => planForDay(plans.value, today.value));
export const livePlans = computed(() => plans.value.filter((p) => p.status === 'active' || p.status === 'archived'));
/**
 * Log writes shown before IndexedDB confirms them, so tokens fill in the same frame as the tap.
 * An entry is ignored once Dexie holds that row at least as new.
 */
export const optimistic = signal<LogRow[]>([]);
export function addOptimistic(rows: LogRow[]): void {
  const now = Date.now();
  // Keep a minute of history: by then IndexedDB has long confirmed the write.
  optimistic.value = [
    ...optimistic.value.filter((o) => now - o.updated_at < 60_000 && !rows.some((r) => r.id === o.id)),
    ...rows,
  ];
}

export const liveLogs = computed(() => {
  const byId = new Map(logs.value.map((l) => [l.id, l]));
  for (const o of optimistic.value) {
    const cur = byId.get(o.id);
    if (!cur || cur.updated_at < o.updated_at) byId.set(o.id, o);
  }
  return [...byId.values()].filter((l) => !l.deleted_at);
});
export const todayLogs = computed(() => liveLogs.value.filter((l) => l.day === today.value));
export const liveRecipes = computed(() => recipes.value.filter((r) => !r.deleted_at));
