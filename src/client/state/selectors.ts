// Derived state for screens.
import { computed, effect, signal } from '@preact/signals';
import { balancingEnabled } from '../../shared/domain/balance';
import { appDay } from '../../shared/domain/day';
import { levelProgress } from '../../shared/game/levels';
import { now } from './clock';
import {
  achievements,
  activePlan,
  dataReady,
  liveLogs,
  liveRecipes,
  menus,
  pantry,
  planForDay,
  plans,
  settings,
  today,
} from './signals';
import { buildDayVM, type DayInput, type DayVM } from './today-vm';
import { celebrate, otherIndex, pushSlot, selectedDay } from './ui';

export const rebalance = computed(() => {
  const s = settings.value.rebalance;
  return s !== 'unknown' ? s : (activePlan.value?.data.rules.rebalance_within_day ?? 'unknown');
});
/** "Cuadrar el día": on unless the owner turned it off or the plan forbids it. */
export const balanceOn = computed(() =>
  balancingEnabled(settings.value.rebalance, activePlan.value?.data.rules.rebalance_within_day ?? 'unknown'),
);

/** The day shown on Hoy. */
export const shownDay = computed(() => selectedDay.value ?? today.value);

/** App days on which lifetime XP was earned (one per logged occasion), sorted. */
const xpDays = computed(() =>
  achievements.value
    .filter((a) => a.kind === 'unlock' && a.key.startsWith('xp_'))
    .map((a) => appDay(a.earned_at, settings.value.tz, settings.value.day_start_hour))
    .sort(),
);
/** Garden level when a day started: decides which species may grow that day. */
export function levelBefore(day: string): number {
  const days = xpDays.value;
  let n = 0;
  while (n < days.length && (days[n] as string) < day) n++;
  return levelProgress(n).level;
}

function inputFor(day: string): DayInput {
  return {
    now: now.value,
    tz: settings.value.tz,
    dayStartHour: settings.value.day_start_hour,
    today: today.value,
    day,
    plan: planForDay(plans.value, day),
    logs: liveLogs.value,
    recipes: liveRecipes.value,
    menus: menus.value,
    pantry: pantry.value,
    balance: balanceOn.value,
    otherIndex: otherIndex.value,
    celebrate: celebrate.value,
    focusedSlot: day === today.value ? pushSlot.value : null,
    level: levelBefore(day),
    closed: day < today.value || settings.value.last_closed_day === day,
  };
}

export const todayInput = computed<DayInput>(() => inputFor(today.value));
export const dayInput = computed<DayInput>(() => inputFor(shownDay.value));

const SNAPSHOT_KEY = 'today:snapshot';

export function readSnapshot(): DayVM | null {
  try {
    const vm = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? 'null') as DayVM | null;
    if (vm?.v !== 3) return null;
    if (appDay(Date.now(), vm.tz, vm.dayStartHour) !== vm.day) return null;
    return vm;
  } catch {
    return null;
  }
}

export const snapshot = signal<DayVM | null>(null);

/** Today's view model (snapshot until data is ready). */
export const todayVM = computed<DayVM | null>(() => {
  if (!dataReady.value || !activePlan.value) return snapshot.value;
  return buildDayVM(todayInput.value);
});

/** Slot names that stay distinct when the plan repeats one: "Colación · 1 pm", "Colación · 7 pm". */
export const slotNames = computed<Record<string, string>>(() => {
  const slots = activePlan.value?.data.slots ?? [];
  const vm = todayVM.value;
  const times: Record<string, string> = Object.fromEntries((vm?.rows ?? []).map((r) => [r.key, r.time]));
  if (vm?.card) times[vm.card.key] = vm.card.time;
  const counts = new Map<string, number>();
  for (const s of slots) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  return Object.fromEntries(
    slots.map((s) => [
      s.key,
      (counts.get(s.label) ?? 0) > 1 && times[s.key] ? `${s.label} · ${times[s.key]}` : s.label,
    ]),
  );
});

/** The shown day's view model. */
export const dayVM = computed<DayVM | null>(() => {
  if (shownDay.value === today.value) return todayVM.value;
  if (!dataReady.value) return null;
  return buildDayVM(dayInput.value);
});

let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function persistSnapshots(): void {
  effect(() => {
    const vm = todayVM.value;
    if (!vm || !dataReady.value || vm.card?.celebrating) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(vm));
      } catch {
        // storage full or unavailable: the snapshot is only an optimization
      }
    }, 300);
  });
}
