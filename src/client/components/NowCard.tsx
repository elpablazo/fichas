// The one meal that matters right now. Before its time it helps decide (an idea that fits, "Me late" saves it);
// once its time arrives it asks what was eaten (one tap if it was the planned dish, otherwise write or snap it).
import { Camera, Check, Heart, PencilLine, Search, Shuffle, SkipForward, X } from 'lucide-preact';
import { useRef } from 'preact/hooks';
import { fill } from '../../shared/domain/format';
import { formatCount } from '../../shared/domain/units';
import { a11y, buttons, gameCopy, lines, nowCopy, typeLabels } from '../copy/es-MX';
import { progress } from '../game';
import type { AdviceVM, NowVM, VerdictVM } from '../state/today-vm';
import { VerdictChip } from './Timeline';

interface Props {
  now: NowVM;
  /** Cuadrar el día trims for this meal. */
  advice: AdviceVM[];
  /** The just-logged meal's verdict while celebrating. */
  verdict: VerdictVM | null;
  onDescribe: () => void;
  onPhoto: (file: File) => void;
  onAte: (anchor: Element | null) => void;
  onLike: () => void;
  onUnlike: () => void;
  onOther: () => void;
  onCraving: () => void;
  onSkip: () => void;
}

function ask(label: string): string {
  const k = label.toLowerCase();
  if (k.startsWith('desayuno')) return nowCopy.askBreakfast;
  if (k.startsWith('cena')) return nowCopy.askDinner;
  return nowCopy.askMeal;
}

export function NowCard(p: Props) {
  const { now } = p;
  const photo = useRef<HTMLInputElement>(null);
  const dish = now.planned ?? now.idea;
  const cut = p.advice.length
    ? fill(nowCopy.cut, {
        food: p.advice.map((a) => a.food || `${formatCount(a.n)} ${typeLabels[a.type].emoji}`).join(' y '),
      })
    : null;
  const heading = (
    <p class="kicker num">
      {now.label} · {now.time}
    </p>
  );

  if (now.celebrating) {
    const on = p.verdict?.status === 'on';
    const lv = progress.value;
    const left = lv.next - lv.xp;
    return (
      <section class="card mb-3 p-4" data-card data-phase="done" aria-live="polite">
        <div class="flex items-center gap-4">
          <span
            class="anim-stamp grid h-14 w-14 shrink-0 place-items-center rounded-full"
            style={
              on ? 'background: var(--gold); color: #3a2a00' : 'background: var(--accent); color: var(--on-accent)'
            }
            aria-hidden="true"
          >
            <Check size={30} strokeWidth={3.2} />
          </span>
          <div class="min-w-0 flex-1">
            {heading}
            <p class="title">{on ? nowCopy.onPlan : nowCopy.done}</p>
          </div>
          {p.verdict && !on && <VerdictChip verdict={p.verdict} big />}
        </div>
        <div class="mt-3 flex items-center gap-3">
          <span class="caption shrink-0 font-bold">{fill(gameCopy.level, { n: lv.level })}</span>
          <span class="bar flex-1" style="height:10px">
            <span
              style={`width:${Math.max(4, Math.min(100, ((lv.xp - lv.from) / Math.max(1, lv.next - lv.from)) * 100))}%;background:var(--gold)`}
            />
          </span>
          <span class="caption num shrink-0">
            {left === 1
              ? fill(gameCopy.toNextOneShort, { level: lv.level + 1 })
              : fill(gameCopy.toNextShort, { n: left, level: lv.level + 1 })}
          </span>
        </div>
      </section>
    );
  }

  const dishBox = dish && (
    <div class="well mt-3 px-4 py-3" data-testid="suggestion">
      {now.planned && (
        <p class="caption mb-0.5 flex items-center gap-1 font-bold text-accent-ink">
          <Heart size={13} fill="currentColor" aria-hidden="true" />
          {nowCopy.planned}
        </p>
      )}
      <p class="headline" data-testid="suggestion-title">
        {dish.title}
      </p>
      {dish.line && <p class="secondary muted mt-0.5">{dish.line}</p>}
    </div>
  );

  if (now.phase === 'plan') {
    return (
      <section class="card mb-3 p-4" data-card data-phase="plan" aria-label={`${now.label} ${now.time}`}>
        <p class="kicker">{nowCopy.next}</p>
        <h2 class="title mt-0.5">
          {now.label} <span class="font-semibold text-ink-2">{now.time}</span>
        </h2>
        {cut && (
          <p class="secondary mt-1 font-semibold text-accent-ink" data-testid="now-cut">
            {cut}
          </p>
        )}
        {dishBox}
        <div class="mt-3 flex gap-2">
          {now.planned ? (
            <button type="button" class="btn btn-neutral flex-1" data-testid="unlike" onClick={p.onUnlike}>
              <X size={19} aria-hidden="true" />
              {buttons.change}
            </button>
          ) : (
            <>
              <button
                type="button"
                class="btn btn-tonal flex-1"
                data-testid="like"
                disabled={!now.idea}
                onClick={p.onLike}
              >
                <Heart size={19} aria-hidden="true" />
                {buttons.like}
              </button>
              {now.count > 1 && (
                <button
                  type="button"
                  class="icon-btn lg"
                  aria-label={a11y.other}
                  title={a11y.other}
                  data-testid="other"
                  onClick={p.onOther}
                >
                  <Shuffle size={21} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          class="press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl font-bold text-accent-ink"
          data-testid="craving"
          onClick={p.onCraving}
        >
          <Search size={17} aria-hidden="true" />
          {nowCopy.craving}
        </button>
      </section>
    );
  }

  return (
    <section class="card mb-3 p-4" data-card data-phase="log" aria-label={`${now.label} ${now.time}`}>
      {heading}
      <h2 class="title mt-0.5">{ask(now.label)}</h2>
      {cut && !now.planned && (
        <p class="secondary mt-1 font-semibold text-accent-ink" data-testid="now-cut">
          {cut}
        </p>
      )}
      {now.planned ? (
        <>
          {dishBox}
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="btn btn-primary flex-1"
              data-testid="ate"
              onClick={(e) => p.onAte(e.currentTarget)}
            >
              <Check size={22} strokeWidth={3} aria-hidden="true" />
              {buttons.ate}
            </button>
            <button type="button" class="btn btn-neutral" data-testid="other-thing" onClick={p.onDescribe}>
              {buttons.otherThing}
            </button>
          </div>
        </>
      ) : (
        <div class="ask mt-3">
          <button
            type="button"
            class="press flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
            data-testid="now-describe"
            onClick={p.onDescribe}
          >
            <PencilLine size={20} class="shrink-0 text-accent-ink" aria-hidden="true" />
            <span class="ask-text">{nowCopy.hint}</span>
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-label={buttons.photo}
            data-testid="now-photo"
            onClick={() => photo.current?.click()}
          >
            <Camera size={20} aria-hidden="true" />
          </button>
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
              if (file) p.onPhoto(file);
            }}
          />
        </div>
      )}
      <button
        type="button"
        class="press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl font-bold text-ink-2"
        data-testid="skip"
        onClick={p.onSkip}
      >
        <SkipForward size={17} aria-hidden="true" />
        {buttons.skip}
      </button>
    </section>
  );
}
