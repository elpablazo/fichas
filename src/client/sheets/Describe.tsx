import { Camera, CircleAlert, CircleCheck, Clock3, Mic, Scale, Square, WandSparkles, WifiOff, X } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { balanceDay } from '../../shared/domain/balance';
import { dayLong } from '../../shared/domain/format';
import { makeItem, stepOf, withQty } from '../../shared/domain/items';
import { type Chip, localChips, matchText, parseItems } from '../../shared/domain/matcher';
import { autoTitle } from '../../shared/domain/recipes';
import type { LogItem, LogRow } from '../../shared/domain/types';
import { unitsOfItems } from '../../shared/domain/units';
import { logMeal, logPendingDescription } from '../actions';
import { parsePhoto, parseRemote } from '../ai';
import { balanceLine } from '../components/DayCard';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { TokenRow } from '../components/Token';
import { a11y, buttons, dates, labels, lines, pools, typeLabels } from '../copy/es-MX';
import { preparePhoto } from '../media/photo';
import { useDictation } from '../media/speech';
import { balanceOn, dayVM, slotNames } from '../state/selectors';
import { liveLogs, liveRecipes, planForDay, plans, today } from '../state/signals';
import { closeSheet, openSheet } from '../state/ui';
import { markUx, record } from '../telemetry';
import { fitTo, previewModel, slotRemaining } from './preview';

interface Props {
  slot?: string;
  day?: string;
  text?: string;
  items?: LogItem[];
  title?: string;
  recipeId?: string | null;
  photo?: File;
}

interface Draft {
  title: string;
  items: LogItem[];
  changed: Set<number>;
  recipeId: string | null;
  source: 'describe' | 'photo';
}

type State =
  | 'idle'
  | 'thinking'
  | 'nomatch'
  | 'offline'
  | 'error'
  | 'photo-reading'
  | 'photo-error'
  | 'photo-empty'
  | 'photo-offline'
  | 'unavailable';

export default function Describe(props: Props) {
  const day = props.day ?? today.value;
  const plan = planForDay(plans.value, day);
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const [slot, setSlot] = useState(props.slot ?? vm?.card?.key ?? 'extra');
  const [text, setText] = useState(props.text ?? '');
  const [chips, setChips] = useState<Chip[]>([]);
  const [draft, setDraft] = useState<Draft | null>(
    props.items?.length
      ? {
          title: props.title ?? '',
          items: props.items,
          changed: new Set(),
          recipeId: props.recipeId ?? null,
          source: 'describe',
        }
      : null,
  );
  const [state, setState] = useState<State>('idle');
  const input = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const selectedPhoto = useRef<File | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const started = useRef(performance.now());

  const cancelRequest = () => {
    generation.current++;
    request.current?.abort();
    request.current = null;
  };
  const editText = (value: string) => {
    cancelRequest();
    selectedPhoto.current = null;
    setText(value);
    setDraft(null);
    setState('idle');
  };
  const dictation = useDictation(editText, () => input.current?.focus({ preventScroll: true }));
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );

  const chipRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (props.photo) void readPhoto(props.photo);
    else if (!props.items?.length) input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [slot]);

  useEffect(() => {
    if (!plan || draft) return;
    const t = setTimeout(() => setChips(localChips(text, plan.data, liveRecipes.value, slot)), 250);
    return () => clearTimeout(t);
  }, [text, slot, draft]);

  const names = slotNames.value;
  const slotOptions = useMemo(
    () =>
      plan
        ? [
            ...plan.data.slots.map((s) => ({ key: s.key, label: names[s.key] ?? s.label })),
            { key: 'extra', label: labels.extraSlot },
          ]
        : [],
    [plan, names],
  );

  const recent = useMemo(
    () =>
      liveRecipes.value
        .filter((r) => !r.hidden && r.times > 0 && r.items.length)
        .sort((a, b) => (b.last_used_at ?? 0) - (a.last_used_at ?? 0))
        .slice(0, 6),
    [],
  );

  if (!plan) return null;
  const data = plan.data;
  const slotLabel = slotOptions.find((s) => s.key === slot)?.label ?? '';
  const target = slotRemaining(slot, day, data);
  const model = draft ? previewModel(draft.items, slot, slotLabel, target, data) : null;
  const pastDay = day !== today.value ? day : undefined;

  // "Does it fit my day?": what logging this would balance later today.
  const dayEffect = (() => {
    if (!draft || !model || model.status !== 'over' || !balanceOn.value || slot === 'extra') return null;
    const raw = unitsOfItems(draft.items, data);
    const fake = { day, slot, kind: 'meal', raw_units: raw, deleted_at: null, items: draft.items } as unknown as LogRow;
    const logs = liveLogs.value.filter((l) => l.day === day);
    const after = balanceDay(data, [...logs, fake], data.swaps, true);
    const before = new Set(
      balanceDay(data, logs, data.swaps, true).adjustments.map((a) => `${a.slot}:${a.type}:${a.to}`),
    );
    const fresh = after.adjustments.filter((a) => !before.has(`${a.slot}:${a.type}:${a.to}`) && a.slot !== slot);
    if (!fresh.length) return null;
    return balanceLine(
      fresh.map((a) => ({
        slot: a.slot,
        label: data.slots.find((s) => s.key === a.slot)?.label ?? '',
        type: a.type,
        n: a.from - a.to,
      })),
    );
  })();

  const show = (title: string, items: LogItem[], source: Draft['source'] = 'describe') => {
    setDraft({ title, items, changed: new Set(), recipeId: null, source });
    setState('idle');
    markUx('describe:preview');
    record('describe_preview', Math.round(performance.now() - started.current));
  };

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    dictation.cancel();
    cancelRequest();
    selectedPhoto.current = null;
    markUx('describe:submit');
    started.current = performance.now();
    const local = matchText(t, data, liveRecipes.value, target);
    if (local) return show(local.title, local.items);
    setState('thinking');
    const token = generation.current;
    request.current = new AbortController();
    const r = await parseRemote(t, slot, day, request.current.signal);
    if (token !== generation.current) return;
    request.current = null;
    if (r.kind === 'ok') return show(r.result.title, r.result.items);
    setState(r.kind === 'offline' ? 'offline' : r.kind === 'unavailable' ? 'nomatch' : 'error');
  };

  async function readPhoto(file: File) {
    dictation.cancel();
    cancelRequest();
    selectedPhoto.current = file;
    setDraft(null);
    setState('photo-reading');
    const token = generation.current;
    started.current = performance.now();
    if (!navigator.onLine) {
      setState('photo-offline');
      return;
    }
    try {
      const jpeg = await preparePhoto(file);
      if (token !== generation.current) return;
      request.current = new AbortController();
      const result = await parsePhoto(jpeg, slot, day, request.current.signal);
      if (token !== generation.current) return;
      request.current = null;
      if (result.kind === 'ok') {
        if (!result.result.items.length) {
          setState('photo-empty');
          return;
        }
        setText(result.result.items.map((item) => item.label).join(', '));
        return show(result.result.title, result.result.items, 'photo');
      }
      setState(result.kind === 'offline' ? 'photo-offline' : result.kind === 'unavailable' ? 'unavailable' : 'error');
    } catch {
      if (token === generation.current) setState('photo-error');
    }
  }

  const useChip = (c: Chip) => {
    cancelRequest();
    dictation.cancel();
    selectedPhoto.current = null;
    setState('idle');
    if (c.kind === 'recipe') {
      setDraft({
        title: c.recipe.title,
        items: c.recipe.items,
        changed: new Set(),
        recipeId: c.recipe.id,
        source: 'describe',
      });
    } else {
      const need = Math.max(1, target[c.eq.type] ?? 1);
      const item = { ...makeItem(c.eq, need * c.eq.qty), assumed_qty: true };
      setDraft({
        title: autoTitle([item], data),
        items: [item],
        changed: new Set(),
        recipeId: null,
        source: 'describe',
      });
    }
    markUx('describe:preview');
  };

  const updateItems = (items: LogItem[], changed = new Set<number>()) => {
    if (!draft) return;
    setDraft({ ...draft, items, changed });
    if (draft.source === 'photo') setText(items.map((item) => item.label).join(', '));
  };

  const step = (i: number, dir: 1 | -1) => {
    if (!draft) return;
    const it = draft.items[i];
    if (!it) return;
    const q = it.qty + dir * stepOf(it, data);
    const items =
      q > 1e-6 ? draft.items.map((x, j) => (j === i ? withQty(x, q, data) : x)) : draft.items.filter((_, j) => j !== i);
    updateItems(items);
  };

  const fitNow = () => {
    if (!draft) return;
    const r = fitTo(draft.items, target, data, slot);
    const changed = new Set<number>();
    for (const c of r.changes) {
      if ('item_index' in c) changed.add(c.item_index);
      else if ('added' in c) changed.add(r.items.indexOf(c.added));
    }
    updateItems(r.items, changed);
  };

  const log = (anchor: Element | null) => {
    if (!draft?.items.length) return;
    const title = draft.title || autoTitle(draft.items, data) || text.trim();
    void logMeal({
      slot,
      title,
      items: draft.items,
      source: draft.source,
      recipe_id: draft.recipeId,
      anchor,
      day: pastDay,
    });
    closeSheet();
  };

  const busy = state === 'thinking' || state === 'photo-reading';
  const header = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div class="field-wrap">
        <input
          ref={input}
          class="field"
          type="text"
          inputMode="text"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={2000}
          autoCorrect="on"
          placeholder={pools['describe.placeholder'][0]}
          aria-label={pools['describe.placeholder'][0]}
          value={text}
          data-testid="describe-input"
          onInput={(e) => {
            dictation.cancel();
            editText((e.currentTarget as HTMLInputElement).value);
          }}
        />
        <span class="field-actions">
          <button
            type="button"
            class="icon-btn"
            data-testid="dictate"
            aria-label={dictation.active ? buttons.stopDictation : buttons.dictate}
            aria-pressed={dictation.active}
            style={dictation.active ? 'background: var(--accent); color: var(--on-accent)' : ''}
            onClick={() => {
              cancelRequest();
              setState('idle');
              dictation.toggle(text);
            }}
          >
            {dictation.active ? <Square size={16} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            class="icon-btn"
            data-testid="take-photo"
            aria-label={buttons.photo}
            onClick={() => {
              dictation.cancel();
              photoInput.current?.click();
            }}
          >
            <Camera size={20} aria-hidden="true" />
          </button>
        </span>
      </div>
      <input
        ref={photoInput}
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={lines.photoInput}
        data-testid="photo-input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void readPhoto(file);
        }}
      />
    </form>
  );

  const footer =
    draft && model ? (
      <div data-testid="preview-actions">
        <div class={`grid gap-2 ${model.canFit ? 'grid-cols-[auto_1fr]' : ''}`}>
          {model.canFit && (
            <button type="button" class="btn btn-tonal" data-testid="fit" onClick={fitNow}>
              <WandSparkles size={19} aria-hidden="true" />
              {buttons.fit}
            </button>
          )}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!draft.items.length}
            data-testid="log"
            onClick={(e) => log(e.currentTarget)}
          >
            {buttons.log}
          </button>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm mt-1 w-full"
          data-testid="check-only"
          onClick={() => {
            record('describe_check', Math.round(performance.now() - started.current));
            closeSheet();
          }}
        >
          {draft.source === 'photo' ? buttons.discard : buttons.check}
        </button>
      </div>
    ) : text.trim() && !dictation.active && !busy && state === 'idle' ? (
      <button type="button" class="btn btn-primary w-full" data-testid="describe-submit" onClick={() => void submit()}>
        {buttons.preview}
      </button>
    ) : undefined;

  const message = (icon: ComponentChildren, text: string) => (
    <div class="well my-2 flex items-start gap-3 px-4 py-3">
      <span class="mt-0.5 text-ink-2">{icon}</span>
      <p class="secondary flex-1">{text}</p>
    </div>
  );

  return (
    <Sheet label={pools['describe.placeholder'][0]} onClose={closeSheet} header={header} footer={footer}>
      {pastDay && (
        <p class="badge accent mb-2">
          <Clock3 size={12} aria-hidden="true" />
          {pastDay === today.value ? dates.today : dayLong(pastDay)}
        </p>
      )}
      <div ref={chipRow} class="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1">
        {slotOptions.map((s) => (
          <button
            key={s.key}
            type="button"
            class="chip"
            aria-pressed={slot === s.key}
            onClick={() => {
              cancelRequest();
              dictation.cancel();
              setSlot(s.key);
              if (state !== 'idle') setState('idle');
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {dictation.active && (
        <p class="caption mb-2 flex items-center gap-2" role="status">
          <span class="h-2 w-2 animate-pulse rounded-full bg-accent" />
          {lines.voiceListening}
        </p>
      )}
      {dictation.fallback && <p class="caption mb-2">{lines.voiceKeyboard}</p>}

      {!draft && !busy && chips.length > 0 && (
        <div class="mb-3 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <button key={i} type="button" class="chip" onClick={() => useChip(c)}>
              {c.kind === 'recipe' ? c.recipe.title : c.eq.food}
            </button>
          ))}
        </div>
      )}
      {!draft && !busy && !text.trim() && state === 'idle' && recent.length > 0 && (
        <section class="mb-2">
          <h3 class="kicker mb-2 px-1">{labels.recent}</h3>
          <div class="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r.id}
                type="button"
                class="chip filled"
                onClick={() => useChip({ kind: 'recipe', recipe: r } as Chip)}
              >
                {r.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {busy && (
        <div class="well my-2 flex items-center gap-3 px-4 py-3" role="status">
          <span class="flex gap-1" aria-hidden="true">
            {(['carb_sg', 'protein_poa', 'veg'] as const).map((t, i) => (
              <span key={t} class={`tok tok-1 t-${t} anim-think`} style={`--s:26px;animation-delay:${i * 120}ms`}>
                <span class="e">{typeLabels[t].emoji}</span>
              </span>
            ))}
          </span>
          <span class="secondary flex-1 font-semibold">
            {state === 'photo-reading' ? lines.photoReading : pools['describe.thinking'][0]}
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => {
              cancelRequest();
              selectedPhoto.current = null;
              setState('idle');
            }}
          >
            {buttons.discard}
          </button>
        </div>
      )}
      {state === 'offline' && (
        <div class="py-1">
          {message(<WifiOff size={18} aria-hidden="true" />, pools['describe.offline'][0])}
          <button
            type="button"
            class="btn btn-primary mt-2 w-full"
            data-testid="pending-log"
            onClick={() => {
              void logPendingDescription(text, slot);
              closeSheet();
            }}
          >
            {buttons.log}
          </button>
          <button type="button" class="btn btn-ghost btn-sm mt-1 w-full" data-testid="check-only" onClick={closeSheet}>
            {buttons.check}
          </button>
        </div>
      )}
      {state === 'error' && message(<CircleAlert size={18} aria-hidden="true" />, pools['error.generic'][0])}
      {state === 'photo-error' && message(<CircleAlert size={18} aria-hidden="true" />, lines.photoError)}
      {state === 'photo-empty' && message(<CircleAlert size={18} aria-hidden="true" />, lines.photoEmpty)}
      {state === 'photo-offline' && message(<WifiOff size={18} aria-hidden="true" />, lines.photoOffline)}
      {state === 'unavailable' && message(<CircleAlert size={18} aria-hidden="true" />, lines.aiUnavailable)}
      {selectedPhoto.current && ['error', 'photo-offline', 'unavailable'].includes(state) && (
        <button
          type="button"
          class="btn btn-neutral btn-sm"
          onClick={() => {
            if (selectedPhoto.current) void readPhoto(selectedPhoto.current);
          }}
        >
          {buttons.retry}
        </button>
      )}
      {state === 'nomatch' && (
        <div class="py-1">
          {message(<CircleAlert size={18} aria-hidden="true" />, lines.noMatch)}
          <button
            type="button"
            class="btn btn-tonal mt-2 w-full"
            onClick={() =>
              openSheet({ kind: 'compose', slot, day: pastDay, items: parseItems(text, data, target).items })
            }
          >
            {buttons.compose}
          </button>
        </div>
      )}

      {draft && model && (
        <div data-testid="preview" class="anim-rise">
          {draft.source === 'photo' && <p class="secondary muted mb-2">{lines.photoReview}</p>}
          <div class="grid">
            {draft.items.map((it, i) =>
              it.free ? (
                <div key={i} class="flex items-center justify-between gap-2 py-1 pl-1">
                  <span class="secondary">
                    {it.label} <span class="badge ml-1">{labels.free}</span>
                  </span>
                  <button
                    type="button"
                    class="icon-btn ghost text-ink-3"
                    aria-label={`${a11y.remove}: ${it.label}`}
                    onClick={() => updateItems(draft.items.filter((_, j) => i !== j))}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <Stepper
                  key={i}
                  label={it.label}
                  highlight={draft.changed.has(i)}
                  note={
                    [it.estimated ? labels.estimated : '', it.assumed_qty ? labels.supposed : '']
                      .filter(Boolean)
                      .join(' ') || null
                  }
                  onRemove={() => updateItems(draft.items.filter((_, j) => i !== j))}
                  onMinus={() => step(i, -1)}
                  onPlus={() => step(i, 1)}
                />
              ),
            )}
          </div>
          {model.tokens.length > 0 && (
            <div class="well mt-3 p-3">
              {slot !== 'extra' && <p class="kicker mb-2">{lines.vsSlot.replace('{slot}', slotLabel)}</p>}
              <TokenRow tokens={model.tokens} size={26} label={model.line} />
            </div>
          )}
          <p class="mt-3 flex items-start gap-2 font-semibold" data-testid="status-line">
            {model.status === 'on' || model.status === 'free' ? (
              <CircleCheck size={20} class="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
            ) : null}
            <span>{model.line}</span>
          </p>
          {dayEffect && (
            <p class="secondary muted mt-1 flex items-start gap-2" data-testid="day-effect">
              <Scale size={16} class="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
              <span>{dayEffect}</span>
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
