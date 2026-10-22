// One food group, opened from its tube: the day's plan laid out meal by meal, what filled it (food by food, so
// "1 🫓 de más" has a reason), and what one ficha of it is in real food.
import { ChevronDown, Leaf } from 'lucide-preact';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { dayStatus } from '../../shared/domain/daystatus';
import { fill, itemLabel } from '../../shared/domain/format';
import { dayContributors } from '../../shared/domain/insights';
import { equivalentUsage } from '../../shared/domain/recipes';
import type { Equivalent, TypeKey } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { Sheet } from '../components/Sheet';
import { FoodIcon, TypeIcon } from '../components/Sprite';
import { buttons, labels, lines, titles, typeLabels } from '../copy/es-MX';
import { groupCopy } from '../copy/more';
import { foodSprite } from '../sprites/food-map';
import { balanceOn, shownDay } from '../state/selectors';
import { liveLogs, planForDay, plans } from '../state/signals';
import { closeSheet } from '../state/ui';

/** "Rinde más" (R16): large volume per unit. */
export function highVolume(e: Equivalent): boolean {
  return (
    (e.unit === 'tza' && e.qty >= 1) ||
    (e.unit === 'pza' && e.qty >= 2) ||
    e.food.includes('palomitas') ||
    (e.type === 'veg' && e.note === 'crudo')
  );
}

/** Notes shown next to an equivalent; calorie notes are never displayed (R13). */
export function visibleNote(e: Equivalent): string | null {
  if (!e.note || /kcal|calor/i.test(e.note)) return null;
  return e.note;
}

export function EquivalentRow({ e }: { e: Equivalent }) {
  const note = visibleNote(e);
  return (
    <li class="flex min-h-12 items-center gap-3 py-2">
      <FoodIcon id={foodSprite(e.food)} type={e.type} size={28} />
      <span class="min-w-0 flex-1">
        <span class="font-semibold">{itemLabel(e.food, e.qty, e.unit, false)}</span>
        {note && <span class="caption ml-2">{note}</span>}
        {e.flag === 'check_portion' && <span class="caption block">{lines.checkPortion}</span>}
      </span>
      {highVolume(e) && (
        <span class="badge leaf shrink-0">
          <Leaf size={12} aria-hidden="true" />
          {labels.moreYield}
        </span>
      )}
    </li>
  );
}

export default function TokenInfo({ type, day: dayProp }: { type: TypeKey; day?: string }) {
  const [all, setAll] = useState(false);
  const day = dayProp ?? shownDay.value;
  const plan = planForDay(plans.value, day);
  if (!plan) return null;
  const data = plan.data;
  const meta = typeLabels[type];
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const status = dayStatus(data, dayLogs, balanceOn.value);
  const m = status.meters.find((x) => x.type === type);
  const usage = equivalentUsage(liveLogs.value);
  const list = data.equivalents
    .filter((e) => e.type === type)
    .map((e, i) => ({ e, i, n: usage.get(e.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.e);
  const shown = all ? list : list.slice(0, 6);
  const name = (key: string) =>
    key === 'extra' ? labels.extraSlot : (data.slots.find((s) => s.key === key)?.label ?? key);
  // The plan meal by meal, as segments of one bar; the bar grows past the plan when the day goes over.
  const shares = data.slots
    .filter((s) => (s.target[type] ?? 0) > 0)
    .map((s) => ({ key: s.key, n: s.target[type] ?? 0 }));
  const planned = m?.planned ?? 0;
  const eaten = m?.eaten ?? 0;
  const scale = Math.max(planned, eaten, 1);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const from = dayContributors(type, dayLogs, data);
  const d = m ? m.eaten - m.expected : 0;
  const pace =
    !m || m.expected < 0.1
      ? null
      : d >= 0.5
        ? fill(groupCopy.ahead, { n: formatCount(d) })
        : d <= -0.5
          ? fill(groupCopy.behind, { n: formatCount(-d) })
          : groupCopy.onPace;
  return (
    <Sheet
      label={meta.group}
      onClose={closeSheet}
      header={
        <h2 class="title flex items-center gap-2.5">
          <TypeIcon type={type} size={34} />
          {meta.group}
        </h2>
      }
    >
      <section class={`impact mb-4 t-${type}`} data-testid="group-day">
        <div class="flex items-baseline justify-between gap-3">
          <p class="display num text-[30px] leading-9">
            {fill(groupCopy.eatenOf, { eaten: formatCount(eaten), planned: formatCount(planned) })}
          </p>
          <p class="secondary font-bold">
            {eaten - planned >= 0.25
              ? fill(groupCopy.over, { n: formatCount(eaten - planned) })
              : planned - eaten < 0.25
                ? groupCopy.full
                : fill(groupCopy.left, { n: formatCount(planned - eaten) })}
          </p>
        </div>
        {pace && <p class="secondary muted">{pace}</p>}
        {shares.length > 0 && (
          <div class="mt-3">
            <div class="group-bar" aria-hidden="true">
              <span class="group-fill" style={`width:${pct(eaten)}`} />
              {eaten > planned && (
                <span class="group-over" style={`left:${pct(planned)};width:${pct(eaten - planned)}`} />
              )}
              {
                shares.reduce<{ at: number; els: JSX.Element[] }>(
                  (acc, s, i) => {
                    acc.at += s.n;
                    if (i < shares.length - 1)
                      acc.els.push(<span key={s.key} class="group-cut" style={`left:${pct(acc.at)}`} />);
                    return acc;
                  },
                  { at: 0, els: [] },
                ).els
              }
              {m && m.expected > 0.1 && m.expected < planned - 0.1 && (
                <span class="group-now" style={`left:${pct(m.expected)}`} />
              )}
            </div>
            <div class="group-legend">
              {shares.map((s) => (
                <span key={s.key} style={`width:${(s.n / scale) * 100}%`}>
                  <b class="num">{formatCount(s.n)}</b> {name(s.key)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {from.length > 0 && (
        <>
          <h3 class="kicker mb-1 px-1">{groupCopy.from}</h3>
          <ul class="mb-4 divide px-1" data-testid="group-from">
            {from.map((c, i) => (
              <li key={`${c.label}-${i}`} class="flex min-h-12 items-center gap-3 py-2">
                <FoodIcon id={foodSprite(c.label)} type={type} size={28} />
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{c.label}</span>
                  <span class="caption block">
                    {c.slot ? name(c.slot) : ''}
                    {c.dish ? ` · ${c.dish}` : ''}
                  </span>
                </span>
                <span class={`ficha t-${type}`}>
                  <TypeIcon type={type} size={15} />
                  <span class="num">{formatCount(c.n)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 class="kicker mb-1 px-1">{fill(titles.tokenInfo, { type: meta.short })}</h3>
      <ul class="divide px-1">
        {shown.map((e) => (
          <EquivalentRow key={e.id} e={e} />
        ))}
      </ul>
      {!all && list.length > 6 && (
        <button type="button" class="btn btn-neutral mt-2 w-full" onClick={() => setAll(true)}>
          {buttons.seeAll}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      )}
    </Sheet>
  );
}
