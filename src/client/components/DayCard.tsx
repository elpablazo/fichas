// "Tu día": the answer to "¿cómo voy?" in one line, what's left of each food type as tanks, and the one change
// that keeps the day on plan ("Para cuadrar: 1 tortilla menos en la cena").
import { ChevronRight } from 'lucide-preact';
import type { PaceGap } from '../../shared/domain/daystatus';
import { fill } from '../../shared/domain/format';
import type { TypeKey } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { articles, paceCopy, typeLabels } from '../copy/es-MX';
import type { AdviceVM, DayVM } from '../state/today-vm';
import { DayMeter } from './DayMeter';

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
export function paceLines(vm: Pick<DayVM, 'status' | 'mode'>): { title: string; sub: string | null } {
  const s = vm.status;
  const advice = s.advice.length ? adviceLine(s.advice) : null;
  switch (s.pace) {
    case 'start':
      return vm.mode === 'past'
        ? { title: paceCopy.pastStartTitle, sub: paceCopy.pastStartSub }
        : { title: paceCopy.startTitle, sub: null };
    case 'on':
      return s.done === s.total
        ? { title: paceCopy.roundTitle, sub: paceCopy.roundSub }
        : { title: paceCopy.onTitle, sub: paceCopy.onSub };
    case 'ahead':
      return { title: fill(paceCopy.aheadTitle, { list: gapList(s.ahead) }), sub: advice ?? paceCopy.keepSub };
    case 'behind': {
      const top = s.behind[0];
      const meter = s.meters.find((m) => m.type === top?.type);
      return {
        title: fill(paceCopy.behindTitle, { list: gapList(s.behind) }),
        sub:
          top && meter && meter.remaining >= 0.5 && s.done < s.total
            ? fill(paceCopy.behindSub, { n: formatCount(meter.remaining), emoji: typeLabels[top.type].emoji })
            : null,
      };
    }
    default:
      return {
        title: fill(paceCopy.mixedTitle, { over: gapList(s.ahead.slice(0, 1)), under: gapList(s.behind.slice(0, 1)) }),
        sub: advice,
      };
  }
}

export function DayCard({ vm, onOpen, onType }: { vm: DayVM; onOpen: () => void; onType?: (t: TypeKey) => void }) {
  const { title, sub } = paceLines(vm);
  return (
    <section class="card mb-3 px-4 pt-3.5 pb-4" data-testid="day-card" aria-label={title}>
      <button type="button" class="press -mx-1 block w-[calc(100%+8px)] rounded-2xl px-1 text-left" onClick={onOpen}>
        <span class="flex items-center justify-between gap-2">
          <span class="kicker num">{fill(paceCopy.kicker, { n: vm.status.done, total: vm.status.total })}</span>
          <ChevronRight size={20} class="-mr-1 shrink-0 text-ink-3" aria-hidden="true" />
        </span>
        <span class="title mt-0.5 block" data-testid="pace-title">
          {title}
        </span>
        {sub && (
          <span class="secondary muted mt-0.5 block" data-testid="pace-sub">
            {sub}
          </span>
        )}
      </button>
      {vm.status.meters.length > 0 && (
        <p class="caption mt-3 mb-1.5 font-semibold">{vm.mode === 'past' ? paceCopy.leftPast : paceCopy.left}</p>
      )}
      <DayMeter key={vm.day} meters={vm.status.meters} pace={vm.mode !== 'future'} onType={onType} />
    </section>
  );
}
