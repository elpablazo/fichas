// "Tu día": today's plant, one gauge per food type (eaten of the day's plan) and the balancing note.
import { ChevronRight, Scale } from 'lucide-preact';
import { fill } from '../../shared/domain/format';
import type { TypeKey } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { articles, labels, stageLabels, titles, todayCopy, typeLabels } from '../copy/es-MX';
import type { DayVM, GaugeVM } from '../state/today-vm';
import { LazyPlant } from './LazyPlant';
import { Ring } from './ui';

const COLOR: Record<TypeKey, string> = {
  carb_sg: 'var(--t-carb)',
  carb_cg: 'var(--t-carb)',
  protein_poa: 'var(--t-prot)',
  legume: 'var(--t-leg)',
  dairy: 'var(--t-dairy)',
  fruit: 'var(--t-fruit)',
  veg: 'var(--t-veg)',
  sugar_sg: 'var(--t-sugar)',
  sugar_cg: 'var(--t-sugar)',
  fat_sp: 'var(--t-fat)',
  fat_cp: 'var(--t-fatp)',
};

/** "la cena", "el desayuno". */
export function withArticle(label: string): string {
  const key = label.toLowerCase().split(' ')[0] ?? '';
  const art = articles[key] ?? articles[key.normalize('NFD').replace(/[̀-ͯ]/g, '')];
  return art ? `${art} ${label.toLowerCase()}` : label.toLowerCase();
}

export function balanceLine(changes: DayVM['changes']): string {
  const parts = changes.map((c) =>
    fill(todayCopy.change, { n: formatCount(c.n), emoji: typeLabels[c.type].emoji, slot: withArticle(c.label) }),
  );
  const joined =
    parts.length <= 1
      ? (parts[0] ?? '')
      : fill(todayCopy.andMore, { a: parts.slice(0, -1).join(', '), b: parts.at(-1) ?? '' });
  return fill(todayCopy.balanced, { changes: joined });
}

export function Gauge({ g, size = 38 }: { g: GaugeVM; size?: number }) {
  const meta = typeLabels[g.type];
  const over = g.eaten - g.planned;
  const label = `${meta.label}: ${formatCount(Math.min(g.eaten, g.planned))} ${labels.of} ${formatCount(g.planned)}${over >= 0.25 ? `, +${formatCount(over)}` : ''}`;
  return (
    <span class="flex flex-col items-center gap-1" role="img" aria-label={label}>
      <span class="relative">
        <Ring
          value={g.planned ? g.eaten : g.eaten ? 1 : 0}
          max={g.planned || 1}
          size={size}
          stroke={3.5}
          color={COLOR[g.type]}
        >
          <span class="text-[16px] leading-none" aria-hidden="true">
            {meta.emoji}
          </span>
        </Ring>
        {over >= 0.25 && (
          <span
            class="num absolute -top-1 -right-2 rounded-full px-1 text-[10px] font-black leading-4"
            style="background: var(--ink); color: var(--bg); box-shadow: 0 0 0 2px var(--surface)"
            aria-hidden="true"
          >
            +{formatCount(over)}
          </span>
        )}
      </span>
      <span class="num text-[12px] font-bold leading-4 text-ink-2" aria-hidden="true">
        {formatCount(Math.min(g.eaten, g.planned))}/{formatCount(g.planned)}
      </span>
    </span>
  );
}

export function DayCard({ vm, onOpen, grow }: { vm: DayVM; onOpen: () => void; grow?: boolean }) {
  const { done, total } = vm.progress;
  return (
    <section class="card mb-4 overflow-hidden" data-testid="day-card">
      <button type="button" class="press flex w-full items-center gap-3 px-4 pt-3.5 text-left" onClick={onOpen}>
        <span
          class="grid h-[52px] w-[52px] shrink-0 place-items-end justify-center overflow-hidden rounded-[18px]"
          style="background: linear-gradient(180deg, var(--sky-2), var(--sky-1))"
          key={`${vm.plant.stage}-${vm.day}`}
        >
          <LazyPlant
            stage={vm.plant.stage}
            species={vm.plant.species}
            size={50}
            sway={vm.mode === 'today'}
            grow={grow}
            label={`${stageLabels[vm.plant.stage]}`}
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="headline block">{titles.yourDay}</span>
          <span class="num caption block font-semibold">{fill(labels.progress, { n: done, total })}</span>
        </span>
        <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
      </button>
      {vm.gauges.length > 0 && (
        <div
          class={`no-scrollbar px-3 pt-3 pb-3 ${vm.gauges.length <= 7 ? 'grid' : 'flex gap-3 overflow-x-auto'}`}
          style={vm.gauges.length <= 7 ? `grid-template-columns: repeat(${vm.gauges.length}, minmax(0, 1fr))` : ''}
        >
          {vm.gauges.map((g) => (
            <Gauge key={g.type} g={g} />
          ))}
        </div>
      )}
      {vm.changes.length > 0 && (
        <button
          type="button"
          class="press flex w-full items-center gap-2 border-line border-t px-4 py-2.5 text-left"
          onClick={onOpen}
          data-testid="balance-note"
        >
          <Scale size={16} class="shrink-0 text-accent-ink" aria-hidden="true" />
          <span class="secondary font-semibold">{balanceLine(vm.changes)}</span>
        </button>
      )}
    </section>
  );
}
