// Rewards are persisted separately from editable logs: earned progress never rolls off or decreases.
import { batch, computed, effect, signal } from '@preact/signals';
import { liveQuery } from 'dexie';
import { addDays, localParts } from '../shared/domain/day';
import { isOccasion, slotState } from '../shared/domain/status';
import type { LogRow } from '../shared/domain/types';
import { levelProgress } from '../shared/game/levels';
import { setSetting } from './actions';
import { db, getLocal, setLocal } from './db/dexie';
import { firstPullDone } from './db/sync';
import { now } from './state/clock';
import { achievements, activePlan, dataReady, planForDay, plans, settings, today, todayLogs } from './state/signals';
import { openSheet, route, sheet, toast } from './state/ui';

export const gardenLogs = signal<LogRow[]>([]);
export const progress = computed(() =>
  levelProgress(achievements.value.filter((a) => a.kind === 'unlock' && a.key.startsWith('xp_')).length),
);
export interface Moment {
  text: string;
  emoji: string;
  kind: 'stamp' | 'level' | 'species' | 'bloom' | 'surprise' | 'comeback';
  species?: string;
  fact?: string;
  rare?: boolean;
}
export const moment = signal<Moment | null>(null);
const moments: Moment[] = [];

let momentTimer: ReturnType<typeof setTimeout> | undefined;

function drainMoments() {
  if (moment.value || !moments.length) return;
  if (toast.value || sheet.value) {
    momentTimer = setTimeout(drainMoments, 500);
    return;
  }
  moment.value = moments.shift() ?? null;
  momentTimer = setTimeout(dismissMoment, moment.value?.fact ? 4200 : 2800);
}
export function dismissMoment() {
  clearTimeout(momentTimer);
  moment.value = null;
  momentTimer = setTimeout(drainMoments, 200);
}

export async function openDayClose(day = today.value) {
  await setLocal(`close:${day}`, true);
  await setSetting('last_closed_day', day);
  openSheet({ kind: 'day-close', day });
}

export const backfillDay = signal<string | null>(null);
export const backfillDismissed = signal<string[]>([]);
export const recapDay = signal<string | null>(null);
const gardenHistoryReady = signal(false);
const presentationDay = signal<string | null>(null);
export const gamePresentationReady = computed(() => gardenHistoryReady.value && presentationDay.value === today.value);
export const hasGameCard = computed(() => {
  const day = backfillDay.value;
  const plan = day ? planForDay(plans.value, day) : null;
  return (
    !!(
      day &&
      plan?.data.slots.some(
        (s) =>
          !backfillDismissed.value.includes(s.key) &&
          !slotState(
            gardenLogs.value.filter((l) => l.day === day && l.slot === s.key),
            s.target,
            plan.data.swaps,
          ).resolved,
      )
    ) || !!recapDay.value
  );
});

export async function dismissBackfill(slot: string) {
  backfillDismissed.value = [...backfillDismissed.value, slot];
  await setLocal(`backfill:${backfillDay.value}`, backfillDismissed.value);
}
export async function dismissRecap() {
  await setLocal(`recap:${recapDay.value}`, true);
  recapDay.value = null;
}

export function startGame() {
  let checkingSeason = false;
  effect(() => {
    const current = activePlan.value,
      day = today.value;
    const previous = plans.value
      .filter((p) => p.ends_on && p.ends_on < day && p.season !== null && p.status === 'archived')
      .sort((a, b) => (b.season ?? 0) - (a.season ?? 0))[0];
    if (
      checkingSeason ||
      !current ||
      !previous ||
      !dataReady.value ||
      (!firstPullDone.value && navigator.onLine) ||
      route.value !== '/' ||
      sheet.value ||
      toast.value
    )
      return;
    checkingSeason = true;
    void getLocal(`recap:season:${previous.id}`, false)
      .then(async (seen) => {
        if (!seen && activePlan.value?.id === current.id && route.value === '/' && !sheet.value && !toast.value) {
          await setLocal(`recap:season:${previous.id}`, true);
          openSheet({ kind: 'season-recap', id: previous.id });
        }
      })
      .catch(() => {})
      .finally(() => {
        checkingSeason = false;
      });
  });
  const boot = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let evaluating = false;
  let rerun = false;
  const queue = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void evaluate(), 1100);
  };
  const evaluate = async () => {
    if (!dataReady.value || !activePlan.value || (!firstPullDone.value && navigator.onLine)) return;
    if (evaluating) {
      rerun = true;
      return;
    }
    evaluating = true;
    try {
      const { evaluateRewards } = await import('./game-eval');
      await evaluateRewards(boot, (m) => moments.push(m));
      drainMoments();
    } catch {
      // Retry on the next data change; meal logging is independent of reward persistence.
    } finally {
      evaluating = false;
      if (rerun) {
        rerun = false;
        queue();
      }
    }
  };
  liveQuery(async () => {
    const result = await db.logs.toArray();
    // Observe every dependency, including pulls and menu acceptance; full history is for lifetime/season rewards.
    await Promise.all([db.achievements.toArray(), db.plans.toArray(), db.menus.toArray(), db.recipes.toArray()]);
    return result;
  }).subscribe({
    next: (all) => {
      batch(() => {
        gardenLogs.value = all;
        gardenHistoryReady.value = true;
      });
      queue();
    },
    error: () => {},
  });

  let openingDay: string | null = null;
  effect(() => {
    if (!dataReady.value || !activePlan.value || (!firstPullDone.value && navigator.onLine)) return;
    const day = today.value;
    queue();
    if (openingDay === day) return;
    openingDay = day;
    void (async () => {
      const yesterday = addDays(day, -1);
      const p = plans.value.find(
        (p) =>
          p.starts_on &&
          p.starts_on <= yesterday &&
          (!p.ends_on || p.ends_on >= yesterday) &&
          (p.status === 'active' || p.status === 'archived'),
      );
      const [dismissed, recapSeen] = await Promise.all([
        getLocal<string[]>(`backfill:${yesterday}`, []),
        getLocal(`recap:${day}`, false),
      ]);
      if (today.value !== day) return;
      batch(() => {
        backfillDismissed.value = dismissed;
        backfillDay.value = p ? yesterday : null;
        recapDay.value = new Date(`${day}T12:00:00Z`).getUTCDay() === 1 && !recapSeen ? day : null;
        presentationDay.value = day;
      });
    })();
  });
  let checkingClose = false;
  effect(() => {
    const p = activePlan.value;
    const day = today.value;
    const ls = todayLogs.value;
    const parts = localParts(now.value, settings.value.tz);
    const completed =
      !!p?.data.slots.length &&
      p.data.slots.every(
        (s) =>
          slotState(
            ls.filter((l) => l.slot === s.key),
            s.target,
            p.data.swaps,
          ).resolved,
      );
    const late = (parts.hour > 21 || (parts.hour === 21 && parts.minute >= 30)) && ls.some(isOccasion);
    if (
      checkingClose ||
      !p ||
      !dataReady.value ||
      (!firstPullDone.value && navigator.onLine) ||
      (!completed && !late) ||
      sheet.value ||
      route.value !== '/'
    )
      return;
    checkingClose = true;
    const closeDay = day;
    setTimeout(() => {
      void (async () => {
        try {
          const current = activePlan.value;
          const ls = todayLogs.value;
          const parts = localParts(now.value, settings.value.tz);
          const completeNow =
            !!current?.data.slots.length &&
            current.data.slots.every(
              (s) =>
                slotState(
                  ls.filter((l) => l.slot === s.key),
                  s.target,
                  current.data.swaps,
                ).resolved,
            );
          const lateNow = (parts.hour > 21 || (parts.hour === 21 && parts.minute >= 30)) && ls.some(isOccasion);
          if (
            (!completeNow && !lateNow) ||
            today.value !== closeDay ||
            sheet.value ||
            route.value !== '/' ||
            settings.value.last_closed_day === closeDay ||
            (await getLocal(`close:${closeDay}`, false))
          )
            return;
          await openDayClose(closeDay);
        } finally {
          checkingClose = false;
        }
      })();
    }, 1300);
  });
}
