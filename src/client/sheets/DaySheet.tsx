// "Tu día" in detail: per type, per meal, and how the day is being balanced (with its switch).
import { Moon, Scale } from 'lucide-preact';
import { balanceDay } from '../../shared/domain/balance';
import { fill } from '../../shared/domain/format';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { setSetting } from '../actions';
import { balanceLine } from '../components/DayCard';
import { Plant } from '../components/Plant';
import { Sheet } from '../components/Sheet';
import { eatenOf, TokenRow, tokensA11y } from '../components/Token';
import { SwitchRow } from '../components/ui';
import { buttons, labels, lines, stageLabels, typeLabels } from '../copy/es-MX';
import { dayCopy } from '../copy/more';
import { openDayClose } from '../game';
import { balanceOn, dayVM } from '../state/selectors';
import { liveLogs, planForDay, plans } from '../state/signals';
import { closeSheet } from '../state/ui';

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
  const rows = [...(vm.card ? [vm.card] : []), ...vm.rows].sort(
    (a, b) => data.slots.findIndex((s) => s.key === a.key) - data.slots.findIndex((s) => s.key === b.key),
  );
  const unabsorbed = TYPE_KEYS.filter((t) => (balance.unabsorbed[t] ?? 0) >= 0.5);
  return (
    <Sheet label={dayCopy.title} onClose={closeSheet} header={<h2 class="title">{dayCopy.title}</h2>}>
      <div class="mb-4 flex items-center gap-3">
        <Plant stage={vm.plant.stage} species={vm.plant.species} size={72} sway={vm.mode === 'today'} />
        <div>
          <p class="headline">{stageLabels[vm.plant.stage]}</p>
          <p class="caption num">{fill(labels.progress, { n: vm.progress.done, total: vm.progress.total })}</p>
        </div>
      </div>

      <h3 class="kicker mb-2 px-1">{dayCopy.types}</h3>
      <ul class="well mb-5 divide px-4 py-1">
        {vm.gauges.map((g) => {
          const meta = typeLabels[g.type];
          const over = g.eaten - g.planned;
          return (
            <li key={g.type} class={`t-${g.type} py-2.5`}>
              <div class="mb-1.5 flex items-center justify-between gap-2">
                <span class="font-semibold">
                  <span aria-hidden="true">{meta.emoji}</span> {meta.group}
                </span>
                <span class="num secondary font-bold">
                  {fill(dayCopy.eatenOf, { eaten: formatCount(g.eaten), planned: formatCount(g.planned) })}
                  {over >= 0.25 && <span class="badge ml-2">{fill(dayCopy.over, { n: formatCount(over) })}</span>}
                </span>
              </div>
              <div class="bar" style="background: color-mix(in srgb, var(--c) 14%, var(--surface))">
                <span
                  style={`width:${g.planned ? Math.min(100, (g.eaten / g.planned) * 100) : 100}%;background:var(--c)`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <h3 class="kicker mb-2 px-1">{dayCopy.meals}</h3>
      <ul class="mb-5 divide px-1">
        {rows.map((r) => (
          <li key={r.key} class="py-2.5">
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-bold">{r.label}</span>
              <span class="caption num">{r.time}</span>
            </div>
            {r.dish && <p class="secondary muted truncate">{r.dish}</p>}
            {r.state === 'skipped' ? (
              <p class="caption">{lines.skipped}</p>
            ) : (
              <TokenRow class="mt-1.5" tokens={r.tokens} size={18} label={tokensA11y(r.target, eatenOf(r.tokens))} />
            )}
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
      {vm.changes.length > 0 ? (
        <p class="secondary mb-2 px-1 font-semibold">{balanceLine(vm.changes)}</p>
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
