// Hoy, top to bottom: the week, "¿cómo voy?" (Tu día), the one meal that matters now, then the day's meals.
// One thing at a time: before a meal the app helps decide; after it, it asks what was eaten.
import { Bell, FileUp, Moon, Undo2, X } from 'lucide-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { daysBetween, localParts } from '../../shared/domain/day';
import { logMeal, planDish, skipSlot, unplanDish } from '../actions';
import { DayCard } from '../components/DayCard';
import { GameCard } from '../components/GameCard';
import { LazyPlant } from '../components/LazyPlant';
import { NowCard } from '../components/NowCard';
import { Timeline } from '../components/Timeline';
import { CalendarButton, WeekStrip } from '../components/WeekStrip';
import { buttons, lines, notificationCopy, pools, titles, todayCopy } from '../copy/es-MX';
import { getLocal, setLocal } from '../db/dexie';
import { gamePresentationReady, hasGameCard, openDayClose } from '../game';
import { lazyView } from '../lazy';
import { canPrime, dismissPriming, enableReminders, pushBusy } from '../notifications';
import { now } from '../state/clock';
import { dayVM, shownDay } from '../state/selectors';
import { activePlan, dataReady, planReadingEnabled, today } from '../state/signals';
import type { SlotVM } from '../state/today-vm';
import { navigate, openDescribe, openSheet, otherIndex, pushSlot, selectDay } from '../state/ui';

const TomorrowMenu = lazyView(() => import('../components/TomorrowMenu'));

export function Today() {
  const vm = dayVM.value;
  const day = shownDay.value;
  const isToday = day === today.value;
  const bannerRef = useRef<HTMLDivElement>(null);
  const cachedLayout = useMemo(
    () => (isToday ? readLayout(vm?.day, vm?.planId) : null),
    [vm?.day, vm?.planId, isToday],
  );
  const layoutReady = dataReady.value && gamePresentationReady.value;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (vm?.day)
      void getLocal(`renewal:${vm.day}`, false).then((seen) => {
        if (seen) setDismissed(vm.day);
      });
  }, [vm?.day]);

  const renewal =
    isToday &&
    !!vm &&
    dismissed !== vm.day &&
    planReadingEnabled.value &&
    !!activePlan.value?.starts_on &&
    daysBetween(activePlan.value.starts_on, vm.day) >= 14;
  const priming = isToday && !renewal && !hasGameCard.value && canPrime.value;
  // Measured after paint: a layout read before it would delay the frame that shows a fresh log.
  useEffect(() => {
    if (!vm || !isToday || !layoutReady) return;
    const id = requestAnimationFrame(() => {
      const banner = bannerRef.current;
      if (!banner) return;
      try {
        localStorage.setItem(
          LAYOUT_KEY,
          JSON.stringify({ day: vm.day, planId: vm.planId, bannerHeight: banner.getBoundingClientRect().height }),
        );
      } catch {
        // Like the Today snapshot, this is only a startup optimization.
      }
    });
    return () => cancelAnimationFrame(id);
  });
  if (!vm) return <TodaySkeleton />;
  const nowVM = vm.now;
  const evening = isToday && localParts(now.value, vm.tz).hour >= 21;
  const pastDay = isToday ? undefined : day;

  const ate = (anchor: Element | null) => {
    const dish = nowVM?.planned;
    if (!nowVM || !dish || !dataReady.value) return;
    void logMeal({
      slot: nowVM.key,
      title: dish.title,
      items: dish.items,
      source: pushSlot.value === nowVM.key ? 'push' : 'menu',
      recipe_id: dish.recipe_id,
      anchor,
    }).then(() => {
      pushSlot.value = null;
    });
  };
  const other = () => {
    if (!nowVM || nowVM.count < 2) return;
    otherIndex.value = { ...otherIndex.value, [nowVM.key]: (otherIndex.value[nowVM.key] ?? 0) + 1 };
  };
  const describe = (slot: string, extra: { photo?: File; mode?: 'check' } = {}) =>
    openDescribe({ slot, day: pastDay, ...extra });
  const openRow = (r: SlotVM) =>
    r.state === 'done' || r.state === 'skipped'
      ? openSheet({ kind: 'meal', slot: r.key, day: pastDay })
      : describe(r.key);

  return (
    <main class="app-main anim-fade" id="main">
      <header class="mb-3 flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <h1 class="screen-title">{vm.title}</h1>
          {!isToday && <p class="secondary muted">{vm.subtitle}</p>}
        </div>
        {!isToday && (
          <button type="button" class="btn btn-tonal btn-sm mt-1 gap-1.5 px-3" onClick={() => selectDay(null)}>
            <Undo2 size={16} aria-hidden="true" />
            {buttons.goToday}
          </button>
        )}
        <span class="mt-0.5">
          <CalendarButton />
        </span>
      </header>
      <WeekStrip day={day} today={today.value} />

      {vm.mode === 'future' ? (
        <section class="card mb-4 p-4">
          <h2 class="title mb-1">{titles.tomorrowMenu}</h2>
          <p class="caption mb-2">{todayCopy.futureHint}</p>
          <TomorrowMenu day={vm.day} />
        </section>
      ) : (
        <>
          <DayCard
            vm={vm}
            onOpen={() => openSheet({ kind: 'day', day })}
            onType={(type) => openSheet({ kind: 'token', type })}
          />
          {isToday && nowVM ? (
            <NowCard
              now={nowVM}
              advice={vm.status.advice.filter((a) => a.slot === nowVM.key)}
              verdict={vm.rows.find((r) => r.key === nowVM.key)?.verdict ?? null}
              onDescribe={() => describe(nowVM.key)}
              onPhoto={(photo) => describe(nowVM.key, { photo })}
              onAte={ate}
              onLike={() => nowVM.idea && void planDish(nowVM.key, nowVM.idea, nowVM.label)}
              onUnlike={() => void unplanDish(nowVM.key)}
              onOther={other}
              onCraving={() => describe(nowVM.key, { mode: 'check' })}
              onSkip={() => void skipSlot(nowVM.key)}
            />
          ) : isToday && vm.allDone ? (
            <section class="card anim-rise mb-3 flex flex-col items-center p-5 text-center" data-card>
              <LazyPlant stage={vm.plant.stage} species={vm.plant.species} size={96} sway />
              <h2 class="title mt-1">{titles.allDone}</h2>
              <p class="secondary muted mt-1">{lines.allDoneHelp}</p>
              <button type="button" class="btn btn-primary mt-4 w-full" onClick={() => void openDayClose(vm.day)}>
                <Moon size={20} aria-hidden="true" />
                {buttons.closeDay}
              </button>
            </section>
          ) : null}
          {isToday && (
            <div ref={bannerRef} class="flow-root" data-testid="banner" data-ready={layoutReady ? '' : undefined}>
              {!layoutReady && cachedLayout ? (
                <div aria-hidden="true" style={{ height: `${cachedLayout.bannerHeight}px` }} />
              ) : renewal ? (
                <section class="card anim-rise mb-3 flex items-center gap-3 p-3" data-testid="renewal">
                  <span class="row-icon">
                    <FileUp size={19} aria-hidden="true" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold leading-5">{titles.planRenewal}</p>
                    <p class="caption">{lines.planRenewal}</p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm px-3"
                    onClick={() => navigate('/progreso/plan/nuevo')}
                  >
                    {buttons.upload}
                  </button>
                  <button
                    type="button"
                    class="icon-btn ghost"
                    aria-label={buttons.notNow}
                    onClick={() => {
                      setDismissed(vm.day);
                      void setLocal(`renewal:${vm.day}`, true);
                    }}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </section>
              ) : priming ? (
                <section class="card anim-rise mb-3 p-3" data-testid="notification-prime">
                  <div class="flex items-center gap-3">
                    <span class="row-icon">
                      <Bell size={19} aria-hidden="true" />
                    </span>
                    <p class="min-w-0 flex-1 font-bold leading-5">{pools['notif.ask'][0]}</p>
                    <button
                      type="button"
                      class="icon-btn ghost"
                      aria-label={buttons.notNow}
                      disabled={pushBusy.value}
                      onClick={() => void dismissPriming()}
                    >
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    class="btn btn-tonal btn-sm mt-2.5 w-full"
                    disabled={pushBusy.value}
                    onClick={() => {
                      void enableReminders();
                      void dismissPriming();
                    }}
                  >
                    {notificationCopy.enable}
                  </button>
                </section>
              ) : (
                <GameCard />
              )}
            </div>
          )}
          {vm.mode === 'past' && vm.rows.some((r) => r.state === 'pending') && (
            <p class="caption mb-2 px-1">{todayCopy.pastHint}</p>
          )}
          <Timeline
            vm={vm}
            onOpen={openRow}
            onLog={(slot) => describe(slot)}
            onExtra={() => describe('extra')}
            onOpenExtras={() => openSheet({ kind: 'meal', slot: 'extra', day: pastDay })}
          />
          {evening && !vm.allDone && (
            <button type="button" class="btn btn-neutral mb-4 w-full" onClick={() => void openDayClose(vm.day)}>
              <Moon size={20} aria-hidden="true" />
              {buttons.closeDay}
            </button>
          )}
        </>
      )}
    </main>
  );
}

const LAYOUT_KEY = 'today:layout';
interface TodayLayout {
  day: string;
  planId: string | null;
  bannerHeight: number;
}
function readLayout(day: string | undefined, planId: string | null | undefined): TodayLayout | null {
  try {
    const cached = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null') as TodayLayout | null;
    return cached &&
      cached.day === day &&
      cached.planId === planId &&
      Number.isFinite(cached.bannerHeight) &&
      cached.bannerHeight >= 0 &&
      cached.bannerHeight <= 512
      ? cached
      : null;
  } catch {
    return null;
  }
}

function TodaySkeleton() {
  return (
    <main class="app-main" aria-busy="true">
      <div class="mb-3 h-9 w-24 rounded-xl bg-surface-2" />
      <div class="mb-4 h-[70px] rounded-2xl bg-surface-2" />
      <div class="card mb-3 h-56" />
      <div class="card h-48" />
    </main>
  );
}
