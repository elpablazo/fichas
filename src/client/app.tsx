import { useEffect, useState } from 'preact/hooks';
import { TabBar } from './components/Chrome';
import { SheetLeaving } from './components/Sheet';
import { Toast } from './components/Toast';
import { UpdateToast } from './components/UpdateToast';
import { paired } from './db/sync';
import { moment } from './game';
import { lazyView } from './lazy';
import { Today } from './screens/Today';
import { dayVM, shownDay } from './state/selectors';
import { today } from './state/signals';
import { openDescribe, route, type SheetState, sheet } from './state/ui';

const Pair = lazyView(() => import('./screens/Pair'));
const Progress = lazyView(() => import('./screens/Progress'));
const Garden = lazyView(() => import('./screens/Garden'));
const Kitchen = lazyView(() => import('./screens/Kitchen'));
const PlanView = lazyView(() => import('./screens/PlanView'));
const PlanReview = lazyView(() => import('./screens/PlanReview'));
const Settings = lazyView(() => import('./screens/Settings'));
const MealSheet = lazyView(() => import('./sheets/MealSheet'));
const Describe = lazyView(() => import('./sheets/Describe'));
const Composer = lazyView(() => import('./sheets/Composer'));
const TokenInfo = lazyView(() => import('./sheets/TokenInfo'));
const InstallSheet = lazyView(() => import('./sheets/InstallSheet'));
const DayClose = lazyView(() => import('./sheets/DayClose'));
const DaySheet = lazyView(() => import('./sheets/DaySheet'));
const FoodInfo = lazyView(() => import('./sheets/FoodInfo'));
const PlantInfo = lazyView(() => import('./sheets/PlantInfo'));
const SpeciesInfo = lazyView(() => import('./sheets/SpeciesInfo'));
const Stamps = lazyView(() => import('./sheets/Stamps'));
const Style = lazyView(() => import('./sheets/Style'));
const WeighIn = lazyView(() => import('./sheets/WeighIn'));
const SeasonRecap = lazyView(() => import('./sheets/SeasonRecap'));
const WhatsNew = lazyView(() => import('./sheets/WhatsNew'));
const ExportMeals = lazyView(() => import('./sheets/ExportMeals'));
const Eating = lazyView(() => import('./sheets/Eating'));
const GameMoment = lazyView(() => import('./components/GameMoment'));

/** The core loop's sheets: fetched right after the first paint, so they open instantly and offline. */
export const PREFETCH_NOW = [Describe, MealSheet, Composer, TokenInfo, DaySheet];
export const PREFETCH = [
  Kitchen,
  Garden,
  Progress,
  GameMoment,
  DayClose,
  PlantInfo,
  FoodInfo,
  WeighIn,
  PlanView,
  Settings,
  InstallSheet,
  SpeciesInfo,
  Stamps,
  Style,
  SeasonRecap,
  ExportMeals,
  Eating,
];

function renderSheet(s: NonNullable<SheetState>) {
  switch (s.kind) {
    case 'weighin':
      return <WeighIn key={`weighin-${s.id ?? 'new'}`} id={s.id} />;
    case 'season-recap':
      return <SeasonRecap key={`${s.id}-${s.mode ?? 'recap'}`} id={s.id} mode={s.mode ?? 'recap'} />;
    case 'meal':
      return <MealSheet key={`meal-${s.slot}-${s.day ?? ''}`} slot={s.slot} day={s.day} />;
    case 'describe':
      return (
        <Describe
          key="describe"
          slot={s.slot}
          day={s.day}
          text={s.text}
          items={s.items}
          title={s.title}
          recipeId={s.recipeId}
          photo={s.photo}
          mode={s.mode}
        />
      );
    case 'compose':
      return (
        <Composer key={`compose-${s.slot}`} slot={s.slot} day={s.day} items={s.items} title={s.title} logId={s.logId} />
      );
    case 'token':
      return <TokenInfo key={`token-${s.type}`} type={s.type} day={s.day} />;
    case 'install':
      return <InstallSheet />;
    case 'day-close':
      return <DayClose key={s.day} day={s.day} />;
    case 'day':
      return <DaySheet key={s.day} day={s.day} />;
    case 'food':
      return <FoodInfo key={s.id} id={s.id} />;
    case 'plant':
      return <PlantInfo key={s.day} day={s.day} />;
    case 'species':
      return <SpeciesInfo key={s.id} id={s.id} />;
    case 'stamps':
      return <Stamps />;
    case 'style':
      return <Style />;
    case 'whats-new':
      return <WhatsNew since={s.since} />;
    case 'export-meals':
      return <ExportMeals />;
    case 'eating':
      return <Eating />;
    default:
      return null;
  }
}

/** Keeps a closed sheet mounted for its exit animation. */
function SheetHost() {
  const s = sheet.value;
  const [shown, setShown] = useState<SheetState>(s);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (s) {
      setShown(s);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const t = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, 210);
    return () => clearTimeout(t);
  }, [s]);
  const current = s ?? shown;
  if (!current) return null;
  return <SheetLeaving.Provider value={!s && leaving}>{renderSheet(current)}</SheetLeaving.Provider>;
}

function addMeal() {
  const vm = dayVM.value;
  const day = shownDay.value;
  if (!vm || vm.mode === 'future') return openDescribe({});
  const isToday = day === today.value;
  // The meal to write down: the one asking now, else the latest open one (a past day falls back to extra).
  const open =
    (vm.now?.phase === 'log' ? vm.now.key : undefined) ??
    [...vm.rows].reverse().find((r) => r.state === 'pending')?.key ??
    vm.now?.key ??
    vm.rows.find((r) => r.state === 'current')?.key;
  openDescribe({ slot: open ?? (isToday ? undefined : 'extra'), day: isToday ? undefined : day });
}

export function App() {
  if (paired.value === 'no') return <Pair />;
  const r = route.value;
  const screen =
    r === '/cocina' ? (
      <Kitchen />
    ) : r === '/jardin' ? (
      <Garden />
    ) : r === '/progreso' ? (
      <Progress />
    ) : r === '/progreso/plan/nuevo' ? (
      <PlanReview />
    ) : r === '/progreso/plan' ? (
      <PlanView />
    ) : r.startsWith('/progreso/plan/') ? (
      <PlanView planId={r.slice('/progreso/plan/'.length)} />
    ) : r === '/progreso/ajustes' ? (
      <Settings />
    ) : (
      <Today />
    );
  return (
    <>
      <input
        id="focus-proxy"
        aria-hidden="true"
        tabIndex={-1}
        class="pointer-events-none fixed top-0 left-0 h-px w-px opacity-0"
        style="font-size:16px"
      />
      {screen}
      <SheetHost />
      <Toast />
      <UpdateToast />
      {moment.value && <GameMoment />}
      <TabBar onAdd={addMeal} />
    </>
  );
}
