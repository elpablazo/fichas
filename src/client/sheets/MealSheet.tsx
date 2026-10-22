// A meal, opened from the day's list: what was eaten as dishes (portions editable), when (real time against the
// plan's), the meal against its plan with what caused each difference, and "Agregar algo más".
import { Blocks, Camera, Clock3, Pencil, Trash2 } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { addDays, appMinutes, appMinutesToHhmm, zonedTime } from '../../shared/domain/day';
import { fill, timeLabel } from '../../shared/domain/format';
import { contributorName, mealGaps } from '../../shared/domain/insights';
import { stepOf, withQty } from '../../shared/domain/items';
import { baseTimes } from '../../shared/domain/slots';
import { computeStatus, isProvisional } from '../../shared/domain/status';
import type { LogItem, LogRow, TypeKey, Units } from '../../shared/domain/types';
import { sumUnits } from '../../shared/domain/units';
import { deleteLog, retimeLog, updateLog } from '../actions';
import { DishList } from '../components/DishList';
import { MealPlate } from '../components/MealPlate';
import { Sheet } from '../components/Sheet';
import { VerdictChip } from '../components/Timeline';
import { a11y, buttons, labels, lines, titles } from '../copy/es-MX';
import { describeCopy, mealCopy } from '../copy/more';
import { dayVM } from '../state/selectors';
import { liveLogs, planForDay, plans, settings, today } from '../state/signals';
import { closeSheet, openDescribe, openSheet } from '../state/ui';

function Tile({
  icon,
  label,
  onClick,
  testid,
}: {
  icon: ComponentChildren;
  label: string;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button type="button" class="tile" data-testid={testid} onClick={onClick}>
      <span class="text-accent-ink">{icon}</span>
      {label}
    </button>
  );
}

export default function MealSheet({ slot, day: dayProp }: { slot: string; day?: string }) {
  const day = dayProp ?? today.value;
  const photo = useRef<HTMLInputElement>(null);
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const row = vm?.rows.find((r) => r.key === slot);
  const label =
    slot === 'extra' ? labels.extraSlot : (row?.label ?? plan.data.slots.find((s) => s.key === slot)?.label ?? '');
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const here = dayLogs.filter((l) => l.slot === slot && l.kind !== 'skip');
  const skipped = dayLogs.some((l) => l.slot === slot && l.kind === 'skip');
  const pastDay = day !== today.value ? day : undefined;
  const meals = here.filter((l) => l.kind === 'meal' && !isProvisional(l));
  // The meal against its plan: every log of this meal together, with the target it was logged against.
  const target: Units = meals.find((l) => Object.keys(l.target).length)?.target ?? row?.target ?? {};
  const allItems: LogItem[] = meals.flatMap((l) => l.items);
  const eaten = computeStatus(sumUnits(meals.map((l) => l.raw_units)), target, plan.data.swaps).normalized;
  const gaps = slot !== 'extra' && meals.length ? mealGaps(allItems, plan.data, target) : null;
  const causes: Partial<Record<TypeKey, string>> = {};
  for (const g of gaps?.over ?? [])
    causes[g.type] = g.contributors
      .slice(0, 3)
      .map((c) => contributorName(c))
      .join(' · ');
  for (const g of gaps?.under ?? []) if (!g.contributors.length) causes[g.type] = mealCopy.noneOfType;

  const header = (
    <div class="flex min-w-0 items-center gap-2">
      <h2 class="title truncate">{label}</h2>
      {row?.verdict && <VerdictChip verdict={row.verdict} />}
    </div>
  );

  return (
    <Sheet label={label} onClose={closeSheet} header={header}>
      <input
        ref={photo}
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={lines.photoInput}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) openDescribe({ slot, day: pastDay, photo: file });
        }}
      />
      {skipped && !here.length && <p class="badge mb-3">{lines.skipped}</p>}

      {here.map((l) => (
        <LoggedMeal key={l.id} log={l} />
      ))}

      {gaps && (
        <section class="impact mb-4" data-testid="meal-vs-plan">
          <p class="kicker mb-2">{mealCopy.vsPlan}</p>
          <MealPlate target={target} eaten={eaten} causes={causes} />
        </section>
      )}

      <h3 class="kicker mb-2 px-1">{here.length ? titles.addMore : titles.logMeal}</h3>
      <div class="grid grid-cols-3 gap-2.5">
        <Tile
          icon={<Pencil size={22} aria-hidden="true" />}
          label={buttons.describe}
          testid="tile-describe"
          onClick={() => openDescribe({ slot, day: pastDay })}
        />
        <Tile
          icon={<Camera size={22} aria-hidden="true" />}
          label={buttons.photo}
          onClick={() => photo.current?.click()}
        />
        <Tile
          icon={<Blocks size={22} aria-hidden="true" />}
          label={buttons.compose}
          onClick={() => openSheet({ kind: 'compose', slot, day: pastDay })}
        />
      </div>
    </Sheet>
  );
}

function LoggedMeal({ log }: { log: LogRow }) {
  const plan = planForDay(plans.value, log.day)?.data ?? null;
  const { tz, day_start_hour: dayStart } = settings.value;
  const at = appMinutes(log.eaten_at, tz, dayStart);
  const slotIndex = plan?.slots.findIndex((s) => s.key === log.slot) ?? -1;
  const planned = plan && slotIndex >= 0 ? baseTimes(plan.slots, dayStart)[slotIndex] : undefined;
  const change = (i: number, dir: 1 | -1) => {
    const it = log.items[i];
    if (!it) return;
    const q = Math.max(0, it.qty + dir * stepOf(it, plan));
    const items =
      q > 0 ? log.items.map((x, j) => (j === i ? withQty(x, q, plan) : x)) : log.items.filter((_, j) => j !== i);
    void updateLog(log, items);
  };
  const remove = (i: number) =>
    void updateLog(
      log,
      log.items.filter((_, j) => j !== i),
    );
  const retime = (hhmm: string) => {
    const [h = 0] = hhmm.split(':').map(Number);
    const date = h < dayStart ? addDays(log.day, 1) : log.day;
    void retimeLog(log, Math.min(zonedTime(date, hhmm, tz), Date.now()));
  };
  return (
    <section class="logged mb-4" data-testid="logged-meal">
      <div class="mb-1 flex items-start justify-between gap-2">
        <span class="headline min-w-0 flex-1 pt-1.5">{log.title || labels.free}</span>
        <button type="button" class="icon-btn ghost text-ink-2" aria-label={a11y.remove} onClick={() => deleteLog(log)}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <label class="chip sky-time">
          <Clock3 size={15} strokeWidth={2.6} aria-hidden="true" />
          <span class="num">{timeLabel(at, dayStart)}</span>
          <input
            type="time"
            value={appMinutesToHhmm(at, dayStart)}
            aria-label={describeCopy.whenLabel}
            data-testid="meal-time"
            onChange={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              if (v) retime(v);
            }}
          />
        </label>
        {planned !== undefined && log.slot !== 'extra' && (
          <span class="caption num">{fill(mealCopy.planTime, { time: timeLabel(planned, dayStart) })}</span>
        )}
      </div>
      {isProvisional(log) ? (
        <p class="caption px-1">{lines.pendingPortions}</p>
      ) : (
        <DishList items={log.items} plan={plan} onStep={change} onRemove={remove} />
      )}
    </section>
  );
}
