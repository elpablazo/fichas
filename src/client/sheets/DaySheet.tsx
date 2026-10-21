// "Tu día" in detail: the same tanks with their legend, each type in words, each meal's verdict, and how the day
// is being balanced (with its switch).
import { Moon, Scale } from 'lucide-preact';
import { balanceDay } from '../../shared/domain/balance';
import { fill } from '../../shared/domain/format';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { setSetting } from '../actions';
import { adviceLine, paceLines } from '../components/DayCard';
import { DayMeter } from '../components/DayMeter';
import { Plant } from '../components/Plant';
import { Sheet } from '../components/Sheet';
import { VerdictChip } from '../components/Timeline';
import { SwitchRow } from '../components/ui';
import { buttons, lines, typeLabels } from '../copy/es-MX';
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
  const balance = balanceDay(
    data,
    liveLogs.value.filter((l) => l.day === day),
    data.swaps,
    balanceOn.value,
  );
  const unabsorbed = TYPE_KEYS.filter((t) => (balance.unabsorbed[t] ?? 0) >= 0.5);
  const { title, sub } = paceLines(vm);
  return (
    <Sheet label={dayCopy.title} onClose={closeSheet} header={<h2 class="title">{dayCopy.title}</h2>}>
      <div class="mb-4 flex items-center gap-3">
        <Plant stage={vm.plant.stage} species={vm.plant.species} size={64} sway={vm.mode === 'today'} />
        <div class="min-w-0">
          <p class="headline">{title}</p>
          {sub && <p class="secondary muted">{sub}</p>}
        </div>
      </div>

      <h3 class="kicker mb-2 px-1">{dayCopy.types}</h3>
      <div class="well mb-2 px-3 pt-3 pb-3">
        <DayMeter
          meters={vm.status.meters}
          pace={vm.mode !== 'future'}
          onType={(type) => openSheet({ kind: 'token', type })}
        />
      </div>
      <p class="caption mb-1 px-1">{dayCopy.legendLeft}</p>
      <p class="caption mb-3 px-1">{dayCopy.legendMark}</p>
      <ul class="mb-5 divide px-1">
        {vm.status.meters.map((m) => {
          const meta = typeLabels[m.type];
          return (
            <li key={m.type} class="flex items-center justify-between gap-2 py-2.5">
              <span class="font-semibold">
                <span aria-hidden="true">{meta.emoji}</span> {meta.group}
              </span>
              <span class="num secondary font-bold">
                {fill(dayCopy.eatenOf, { eaten: formatCount(m.eaten), planned: formatCount(m.planned) })}
                {m.over >= 0.25 ? (
                  <span class="badge ml-2">{fill(dayCopy.over, { n: formatCount(m.over) })}</span>
                ) : (
                  <span class="caption ml-2">{fill(dayCopy.leftOf, { n: formatCount(m.remaining) })}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 class="kicker mb-2 px-1">{dayCopy.meals}</h3>
      <ul class="mb-5 divide px-1">
        {vm.rows.map((r) => (
          <li key={r.key} class="flex items-center justify-between gap-3 py-2.5">
            <span class="min-w-0">
              <span class="flex items-baseline gap-2">
                <span class="font-bold">{r.label}</span>
                <span class="caption num">{r.time}</span>
              </span>
              {r.state === 'skipped' ? (
                <span class="caption block">{lines.skipped}</span>
              ) : (
                r.dish && <span class="secondary muted block truncate">{r.dish}</span>
              )}
            </span>
            {r.verdict && <VerdictChip verdict={r.verdict} />}
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
          {fill(dayCopy.unabsorbed, { n: formatCount(balance.unabsorbed[t] ?? 0), emoji: typeLabels[t].emoji })}
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
