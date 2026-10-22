// "Tu día": the answer to "¿cómo voy?" in one line, how much of the day's plan is covered (cerrar al 100), what's
// left of each food type as tubes, and the one change that keeps the day on plan ("Para cuadrar: …").
import { ChevronRight } from 'lucide-preact';
import { closing, type PaceGap } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import type { TypeKey } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { articles, meterCopy, paceCopy, typeLabels } from '../copy/es-MX';
import type { AdviceVM, DayVM } from '../state/today-vm';
import { DayMeter } from './DayMeter';
import { Ring } from './Ring';
import { Txt } from './Sprite';

/** "la cena", "el desayuno". */
export function withArticle(label: string): string {
  const key = label.toLowerCase().split(' ')[0] ?? '';
  const art = articles[key] ?? articles[key.normalize('NFD').replace(/[̀-ͯ]/g, '')];
  return art ? `${art} ${label.toLowerCase()}` : label.toLowerCase();
}

/** "a", "a y b", "a, b y c". */
export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return fill(paceCopy.and, { a: parts.slice(0, -1).join(', '), b: parts.at(-1) ?? '' });
}

/** "1 🫓", "1 🫓 y ½ 🥑" (at most two types: one glance). */
export function gapList(gaps: PaceGap[]): string {
  return joinAnd(gaps.slice(0, 2).map((g) => `${formatCount(g.n)} ${typeLabels[g.type].emoji}`));
}

/** "Para cuadrar: 1 tortilla menos en la cena." */
export function adviceLine(advice: AdviceVM[]): string {
  return fill(paceCopy.adviceSub, {
    list: joinAnd(
      advice.map((a) =>
        fill(paceCopy.adviceItem, {
          food: a.food || `${formatCount(a.n)} ${typeLabels[a.type].emoji}`,
          slot: withArticle(a.label),
        }),
      ),
    ),
  });
}

/** Title and subtitle of "Tu día" for any state of any day. */
export function paceLines(vm: Pick<DayVM, 'status' | 'mode' | 'rows'>): { title: string; sub: string | null } {
  const s = vm.status;
  const c = closing(s.meters);
  const advice = s.advice.length ? adviceLine(s.advice) : null;
  const open = vm.rows.filter((r) => r.state !== 'done' && r.state !== 'skipped').length;
  // Late in the day (one meal or none left), the missing groups are what closes it.
  const late = vm.mode === 'today' && s.done > 0 && open <= 1;
  const close = c.missing.length ? fill(paceCopy.closeSub, { list: gapList(c.missing) }) : null;
  // A group already past the whole day's plan says what is over the day (the "+1" on its tube), not how far it
  // runs ahead of the meals so far.
  const ahead = s.ahead.map((g) => {
    const m = s.meters.find((x) => x.type === g.type);
    const over = m ? m.eaten - m.planned : 0;
    return over >= 0.5 ? { ...g, n: Math.min(g.n, over) } : g;
  });
  switch (s.pace) {
    case 'start':
      return vm.mode === 'past'
        ? { title: paceCopy.pastStartTitle, sub: paceCopy.pastStartSub }
        : { title: paceCopy.startTitle, sub: null };
    case 'on':
      if (c.complete) return { title: paceCopy.roundTitle, sub: paceCopy.roundSub };
      return { title: paceCopy.onTitle, sub: (late && close) || paceCopy.onSub };
    case 'ahead':
      if (c.complete) return { title: paceCopy.fullTitle, sub: fill(paceCopy.fullSub, { list: gapList(ahead) }) };
      return {
        title: fill(paceCopy.aheadTitle, { list: gapList(ahead) }),
        sub: advice ?? ((late && close) || paceCopy.keepSub),
      };
    case 'behind': {
      const top = s.behind[0];
      const meter = s.meters.find((m) => m.type === top?.type);
      return {
        title: fill(paceCopy.behindTitle, { list: gapList(s.behind) }),
        sub:
          late && close
            ? close
            : top && meter && meter.remaining >= 0.5 && s.done < s.total
              ? fill(paceCopy.behindSub, { n: formatCount(meter.remaining), emoji: typeLabels[top.type].emoji })
              : close,
      };
    }
    default:
      return {
        title: fill(paceCopy.mixedTitle, { over: gapList(ahead.slice(0, 1)), under: gapList(s.behind.slice(0, 1)) }),
        sub: advice ?? close,
      };
  }
}

/** The pace pointer, drawn like the one on the tubes (for the legend). */
function Pointer() {
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden="true" class="shrink-0">
      <path d="M0 0.5l6.5 5-6.5 5z" fill="var(--ink)" />
      <rect x="5" y="4" width="13" height="3" rx="1.5" fill="var(--ink)" />
    </svg>
  );
}

export function DayCard({ vm, onOpen, onType }: { vm: DayVM; onOpen: () => void; onType?: (t: TypeKey) => void }) {
  const { title, sub } = paceLines(vm);
  const c = closing(vm.status.meters);
  const pace = vm.mode !== 'future';
  const showPointer = pace && vm.status.meters.some((m) => m.expected > 0.1 && m.expected < m.planned - 0.1);
  return (
    <section class="card mb-3 px-4 pt-3.5 pb-3" data-testid="day-card" aria-label={title}>
      <button
        type="button"
        class="press -mx-1 flex w-[calc(100%+8px)] items-center gap-3 rounded-2xl px-1 text-left"
        onClick={onOpen}
      >
        <span class="min-w-0 flex-1">
          <span class="kicker num flex items-center gap-0.5">
            {fill(paceCopy.kicker, { n: vm.status.done, total: vm.status.total })}
            <ChevronRight size={15} strokeWidth={3} class="text-ink-3" aria-hidden="true" />
          </span>
          <span class="title mt-0.5 block" data-testid="pace-title">
            <Txt>{title}</Txt>
          </span>
          {sub && (
            <span class="secondary muted mt-0.5 block" data-testid="pace-sub">
              <Txt>{sub}</Txt>
            </span>
          )}
        </span>
        {pace && vm.status.meters.length > 0 && (
          <Ring
            value={c.pct}
            max={100}
            size={58}
            stroke={7}
            color={c.exact ? 'var(--gold)' : 'var(--accent)'}
            class="shrink-0"
          >
            <span class="display num text-[17px] leading-none" data-testid="day-pct">
              {/* Counts up when a log moves it (a registered --n animates the number). */}
              <span class="ring-count" style={`--n:${c.pct}`} aria-hidden="true" />
              <span class="sr-only">{c.pct}</span>
              <span class="text-[11px]">%</span>
            </span>
          </Ring>
        )}
      </button>
      {vm.status.meters.length > 0 && (
        <div class="caption mt-3 mb-1.5 flex items-center justify-between gap-2 font-semibold">
          <span>{vm.mode === 'past' ? paceCopy.leftPast : paceCopy.left}</span>
          {showPointer && (
            <span class="flex items-center gap-1.5">
              <Pointer />
              {meterCopy.legendNow}
            </span>
          )}
        </div>
      )}
      <DayMeter key={vm.day} meters={vm.status.meters} pace={pace} onType={onType} />
    </section>
  );
}
