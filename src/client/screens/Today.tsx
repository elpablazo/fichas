import { Bell, FileUp, Moon, Undo2, X } from 'lucide-preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { daysBetween, localParts } from '../../shared/domain/day';
import { logMeal } from '../actions';
import { DayCard } from '../components/DayCard';
import { GameCard } from '../components/GameCard';
import { LazyPlant } from '../components/LazyPlant';
import { MealCard } from '../components/MealCard';
import { Timeline } from '../components/Timeline';
import { CalendarButton, WeekStrip } from '../components/WeekStrip';
import { buttons, lines, notificationCopy, pools, titles, todayCopy } from '../copy/es-MX';
import { getLocal, setLocal } from '../db/dexie';
import { gamePresentationReady, hasGameCard, openDayClose } from '../game';
import { lazyView } from '../lazy';
import { canPrime, dismissPriming, enableReminders, pushBusy } from '../notifications';
import { now } from '../state/clock';
import { dayInput, dayVM, shownDay } from '../state/selectors';
import { activePlan, dataReady, planReadingEnabled, today } from '../state/signals';
import { suggestionsFor } from '../state/today-vm';
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
  const plantKey = useRef<string | null>(null);
  useEffect(() => {
    if (vm?.day)
      void getLocal(`renewal:${vm.day}`, false).then((seen) => {
        if (seen) setDismissed(vm.day);
      });
  }, [vm?.day]);
  const key = vm ? `${vm.day}:${vm.plant.stage}` : null;
  const grew = !!key && !!plantKey.current && plantKey.current !== key && plantKey.current.startsWith(`${vm?.day}:`);
  useEffect(() => {
    plantKey.current = key;
  }, [key]);

  const renewal =
    isToday &&
    !!vm &&
    dismissed !== vm.day &&
    planReadingEnabled.value &&
    !!activePlan.value?.starts_on &&
    daysBetween(activePlan.value.starts_on, vm.day) >= 14;
  const priming = isToday && !renewal && !hasGameCard.value && canPrime.value;
  useLayoutEffect(() => {
    if (!vm || !isToday || !layoutReady || !bannerRef.current) return;
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({
          day: vm.day,
          planId: vm.planId,
          bannerHeight: bannerRef.current.getBoundingClientRect().height,
        }),
      );
    } catch {
      // Like the Today snapshot, this is only a startup optimization.
    }
  });
  if (!vm) return <TodaySkeleton />;
  const card = vm.card;
  const evening = isToday && localParts(now.value, vm.tz).hour >= 21;

  const ate = (anchor: Element | null) => {
    if (!card?.suggestion || !dataReady.value) return;
    const s = card.suggestion;
    void logMeal({
      slot: card.key,
      title: s.title,
      items: s.items,
      source: pushSlot.value === card.key ? 'push' : s.origin === 'menu' ? 'menu' : 'suggestion',
      recipe_id: s.recipe_id,
      anchor,
    }).then(() => {
      pushSlot.value = null;
    });
  };
  const cycle = (dir: 1 | -1) => {
    if (!card) return;
    if (card.count <= 1) return openSheet({ kind: 'meal', slot: card.key });
    const next = ((otherIndex.value[card.key] ?? 0) + dir + card.count) % card.count;
    otherIndex.value = { ...otherIndex.value, [card.key]: next };
  };
  const adjust = () => {
    if (!card) return;
    const s = card.suggestion;
    openDescribe({
      slot: card.key,
      items: s?.items ?? [],
      title: s?.title,
      recipeId: s?.recipe_id,
      text: s?.items.map((i) => i.label).join(', '),
    });
  };
  const quickLog = (slotKey: string, anchor: Element | null) => {
    const row = vm.rows.find((r) => r.key === slotKey);
    if (!row || !dataReady.value) return;
    const top = suggestionsFor(dayInput.value, slotKey, row.target)[0];
    if (!top) return openSheet({ kind: 'meal', slot: slotKey, day: isToday ? undefined : day });
    void logMeal({
      slot: slotKey,
      title: top.title,
      items: top.items,
      source: 'suggestion',
      recipe_id: top.recipe_id,
      anchor,
      day,
    });
  };
  const openMeal = (slot: string) => openSheet({ kind: 'meal', slot, day: isToday ? undefined : day });

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
          {isToday && card ? (
            <MealCard
              card={card}
              onAte={ate}
              onCycle={cycle}
              onAdjust={adjust}
              onOpen={() => openSheet({ kind: 'meal', slot: card.key })}
              onToken={(type) => openSheet({ kind: 'token', type })}
            />
          ) : isToday && vm.allDone ? (
            <section class="card anim-rise mb-4 flex flex-col items-center p-5 text-center" data-card>
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
                <section class="card anim-rise mb-4 flex items-center gap-3 p-3" data-testid="renewal">
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
                <section class="card anim-rise mb-4 p-3" data-testid="notification-prime">
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
          <DayCard vm={vm} grow={grew} onOpen={() => openSheet({ kind: 'day', day })} />
          {vm.mode === 'past' && vm.rows.some((r) => r.state === 'pending') && (
            <p class="caption mb-2 px-1">{todayCopy.pastHint}</p>
          )}
          <Timeline
            vm={vm}
            onOpen={openMeal}
            onQuickLog={quickLog}
            onExtra={() => openSheet({ kind: 'meal', slot: 'extra', day: isToday ? undefined : day })}
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
      <div class="card mb-4 h-28" />
      <div class="card h-64" />
    </main>
  );
}
