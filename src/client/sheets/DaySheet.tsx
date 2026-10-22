// "Tu día" in detail: how much of the day's plan is covered, each food group as a labeled bar (tap for its
// breakdown), each meal with its verdict, what moved the day (the foods behind any "de más"), and how the day is
// being balanced (with its switch).
import { ChevronRight, Moon, Scale } from 'lucide-preact';
import { balanceDay } from '../../shared/domain/balance';
import { closing } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import { contributorName, dayContributors } from '../../shared/domain/insights';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { setSetting } from '../actions';
import { adviceLine, paceLines } from '../components/DayCard';
import { Sheet } from '../components/Sheet';
import { Txt, TypeIcon } from '../components/Sprite';
import { VerdictChip } from '../components/Timeline';
import { Ring, SwitchRow } from '../components/ui';
import { buttons, labels, lines, typeLabels } from '../copy/es-MX';
import { dayCopy } from '../copy/more';
import { openDayClose } from '../game';
import { balanceOn, dayVM } from '../state/selectors';
import { liveLogs, planForDay, plans } from '../state/signals';
import { closeSheet, openSheet } from '../state/ui';

export default function DaySheet({ day }: { day: string }) {
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const plan = planForDay(plans.value, day);
  if (!vm || !plan) return null;
  const data = plan.data;
  const dayLogs = liveLogs.value.filter((l) => l.day === day);
  const balance = balanceDay(data, dayLogs, data.swaps, balanceOn.value);
  const unabsorbed = TYPE_KEYS.filter((t) => (balance.unabsorbed[t] ?? 0) >= 0.5);
  const { title, sub } = paceLines(vm);
  const c = closing(vm.status.meters);
  const slotName = (key: string) =>
    key === 'extra' ? labels.extraSlot : (data.slots.find((s) => s.key === key)?.label ?? key);
  const moved = vm.status.ahead.slice(0, 2).map((g) => ({
    gap: g,
    from: dayContributors(g.type, dayLogs, data).slice(0, 3),
  }));
  return (
    <Sheet label={dayCopy.title} onClose={closeSheet} header={<h2 class="title">{dayCopy.title}</h2>}>
      <section class="impact mb-5 flex items-center gap-4" data-testid="day-hero">
        <Ring value={c.pct} max={100} size={84} stroke={9} color={c.exact ? 'var(--gold)' : 'var(--accent)'}>
          <span class="display num text-[24px] leading-none">
            {c.pct}
            <span class="text-[13px]">%</span>
          </span>
        </Ring>
        <div class="min-w-0">
          <p class="title">
            <Txt>{title}</Txt>
          </p>
          {sub && (
            <p class="secondary muted mt-0.5">
              <Txt>{sub}</Txt>
            </p>
          )}
        </div>
      </section>

      <h3 class="kicker mb-1 px-1">{dayCopy.types}</h3>
      <ul class="mb-5 divide" data-testid="day-groups">
        {vm.status.meters.map((m) => {
          const meta = typeLabels[m.type];
          const scale = Math.max(m.planned, m.eaten, 1);
          return (
            <li key={m.type}>
              <button
                type="button"
                class={`press flex min-h-14 w-full items-center gap-3 rounded-2xl px-1 text-left t-${m.type}`}
                onClick={() => openSheet({ kind: 'token', type: m.type, day })}
              >
                <TypeIcon type={m.type} size={30} />
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2">
                    <span class="font-bold">{meta.group}</span>
                    <span class="num secondary font-bold">
                      {fill(dayCopy.eatenOf, { eaten: formatCount(m.eaten), planned: formatCount(m.planned) })}
                      {m.over >= 0.25 && (
                        <span class="badge ml-1.5">{fill(dayCopy.over, { n: formatCount(m.over) })}</span>
                      )}
                    </span>
                  </span>
                  <span class="mini-bar mt-1.5 block" aria-hidden="true">
                    <span style={`width:${(Math.min(m.eaten, m.planned) / scale) * 100}%`} />
                    {m.over > 0 && (
                      <span
                        class="is-over"
                        style={`left:${(m.planned / scale) * 100}%;width:${(m.over / scale) * 100}%`}
                      />
                    )}
                    {m.expected > 0.1 && m.expected < m.planned - 0.1 && (
                      <i style={`left:${(m.expected / scale) * 100}%`} />
                    )}
                  </span>
                </span>
                <ChevronRight size={18} class="shrink-0 text-ink-3" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {moved.some((x) => x.from.length) && (
        <>
          <h3 class="kicker mb-1 px-1">{dayCopy.moved}</h3>
          <ul class="mb-5 grid gap-2" data-testid="day-moved">
            {moved.map(({ gap, from }) => (
              <li key={gap.type} class="well flex items-start gap-3 px-3 py-2.5">
                <TypeIcon type={gap.type} size={26} />
                <span class="min-w-0 flex-1">
                  <span class="block font-bold">
                    <Txt>{fill(dayCopy.overBy, { n: formatCount(gap.n), emoji: typeLabels[gap.type].emoji })}</Txt>
                  </span>
                  <span class="caption block">
                    {fill(dayCopy.cameFrom, {
                      list: from
                        .map((f) => `${contributorName(f)}${f.slot ? ` (${slotName(f.slot).toLowerCase()})` : ''}`)
                        .join(', '),
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 class="kicker mb-1 px-1">{dayCopy.meals}</h3>
      <ul class="mb-5 divide" data-testid="day-meals">
        {vm.rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              class="press flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-1 py-2 text-left"
              onClick={() => openSheet({ kind: 'meal', slot: r.key, day: vm.mode === 'today' ? undefined : day })}
            >
              <span class="min-w-0">
                <span class="flex items-baseline gap-2">
                  <span class="font-bold">{r.label}</span>
                  <span class="caption num">{r.at ?? r.time}</span>
                </span>
                {r.state === 'skipped' ? (
                  <span class="caption block">{lines.skipped}</span>
                ) : (
                  <span class="secondary muted block truncate">{r.dish ?? lines.notLogged}</span>
                )}
              </span>
              {r.verdict && <VerdictChip verdict={r.verdict} />}
            </button>
          </li>
        ))}
      </ul>

      <h3 class="kicker mb-2 px-1">{dayCopy.balanceTitle}</h3>
      <div class="well mb-2 overflow-hidden">
        <SwitchRow
          label={dayCopy.balanceTitle}
          help={balanceOn.value ? dayCopy.balanceOn : dayCopy.balanceOff}
          on={balanceOn.value}
          icon={<Scale size={18} aria-hidden="true" />}
          onChange={(v) => void setSetting('rebalance', v ? 'allowed' : 'not_allowed')}
        />
      </div>
      {balanceOn.value && <p class="caption mb-3 px-1">{dayCopy.balanceRules}</p>}
      {vm.status.advice.length > 0 ? (
        <p class="secondary mb-2 px-1 font-semibold" data-testid="balance-note">
          {adviceLine(vm.status.advice)}
        </p>
      ) : (
        balanceOn.value && <p class="secondary muted mb-2 px-1">{dayCopy.noChanges}</p>
      )}
      {unabsorbed.map((t) => (
        <p key={t} class="secondary muted mb-1 px-1">
          <Txt>
            {fill(dayCopy.unabsorbed, { n: formatCount(balance.unabsorbed[t] ?? 0), emoji: typeLabels[t].emoji })}
          </Txt>
        </p>
      ))}
      <p class="caption mt-3 px-1">{dayCopy.checkNutri}</p>
      {vm.mode === 'today' && (
        <button type="button" class="btn btn-neutral mt-4 w-full" onClick={() => void openDayClose(day)}>
          <Moon size={19} aria-hidden="true" />
          {buttons.closeDay}
        </button>
      )}
    </Sheet>
  );
}
