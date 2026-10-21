// "¿Qué comiste?" (log) and "¿Qué se te antoja?" (check). Understanding is live: foods the plan table knows appear
// as they're typed, JEV names the food groups of the rest within a moment, and the meal AI fills their portions
// after a short pause. Below, the same tanks as Today show where the meal lands. One button: Anotar.
import {
  Blocks,
  Camera,
  ChevronDown,
  CircleAlert,
  Clock3,
  Mic,
  Minus,
  Plus,
  SkipForward,
  Square,
  WandSparkles,
  WifiOff,
  X,
} from 'lucide-preact';
import type { ComponentChildren, VNode } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Classified } from '../../shared/ai-schema';
import { dayLong } from '../../shared/domain/format';
import { mainType, stepOf, withQty } from '../../shared/domain/items';
import { knownText, localChips, type ParseResult, parseItems, unknownPhrases } from '../../shared/domain/matcher';
import { autoTitle } from '../../shared/domain/recipes';
import { capitalize, norm } from '../../shared/domain/text';
import type { LogItem, PlanData, RecipeRow, TypeKey } from '../../shared/domain/types';
import { logMeal, logPendingDescription, planDish, skipSlot } from '../actions';
import { classifyRemote, parsePhoto, parseRemote } from '../ai';
import { DayMeter } from '../components/DayMeter';
import { Sheet, SheetLeaving } from '../components/Sheet';
import { a11y, buttons, dates, describeCopy, labels, lines, pools, typeLabels } from '../copy/es-MX';
import { preparePhoto } from '../media/photo';
import { useDictation } from '../media/speech';
import { balanceOn, dayVM, slotNames } from '../state/selectors';
import { liveRecipes, planForDay, plans, today } from '../state/signals';
import { closeSheet, openSheet, pushSlot } from '../state/ui';
import { markUx, record } from '../telemetry';
import { impact, slotRemaining } from './preview';

interface Props {
  slot?: string;
  day?: string;
  text?: string;
  items?: LogItem[];
  title?: string;
  recipeId?: string | null;
  photo?: File;
  mode?: 'log' | 'check';
}

/** A fixed set of items (a dish picked from the owner's own, a photo, or an adjustment): typing unpins it. */
interface Pinned {
  title: string;
  items: LogItem[];
  recipeId: string | null;
  source: 'describe' | 'photo' | 'recent';
  /** Items "Ajustar" changed (highlighted). */
  changed?: Set<number>;
}

type Remote = 'idle' | 'waiting' | 'offline' | 'unavailable' | 'error';
type PhotoState = 'idle' | 'reading' | 'error' | 'empty' | 'offline' | 'unavailable';

const GROUP_TYPE: Record<Classified['groups'][number], TypeKey> = {
  carb: 'carb_sg',
  protein: 'protein_poa',
  legume: 'legume',
  dairy: 'dairy',
  fruit: 'fruit',
  veg: 'veg',
  fat: 'fat_sp',
  nuts: 'fat_cp',
  sugar: 'sugar_sg',
};
const keyOf = (i: LogItem) => i.equivalent_id ?? `x:${norm(i.label)}`;

/** Items with the stepper changes applied (a null quantity removes the item). */
function withEdits(items: LogItem[], edits: Record<string, number | null>, plan: PlanData): LogItem[] {
  return items.flatMap((it) => {
    const k = keyOf(it);
    if (!(k in edits)) return [it];
    const q = edits[k];
    return q === null || q === undefined ? [] : [withQty(it, q, plan)];
  });
}

export default function Describe(props: Props) {
  const mode = props.mode ?? 'log';
  const day = props.day ?? today.value;
  const plan = planForDay(plans.value, day);
  const vm = dayVM.value?.day === day ? dayVM.value : null;
  const [slot, setSlot] = useState(props.slot ?? vm?.now?.key ?? 'extra');
  const [picking, setPicking] = useState(false);
  const [text, setText] = useState(props.text ?? '');
  const [pinned, setPinned] = useState<Pinned | null>(
    props.items?.length
      ? { title: props.title ?? '', items: props.items, recipeId: props.recipeId ?? null, source: 'describe' }
      : null,
  );
  const [remote, setRemote] = useState<{ key: string; result: ParseResult } | null>(null);
  const [remoteState, setRemoteState] = useState<Remote>('idle');
  const [groups, setGroups] = useState<Record<string, Classified>>({});
  const [edits, setEdits] = useState<Record<string, number | null>>({});
  const [photoState, setPhotoState] = useState<PhotoState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const selectedPhoto = useRef<File | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const started = useRef(performance.now());
  const previewed = useRef(false);
  const leaving = useContext(SheetLeaving);
  const frozen = useRef<VNode | null>(null);
  /** The meal-AI request for the current text, so "Anotar" waits for it instead of asking twice. */
  const inflight = useRef<{ key: string; promise: Promise<ParseResult | null> } | null>(null);

  const cancelRequest = () => {
    generation.current++;
    request.current?.abort();
    request.current = null;
  };
  const editText = (value: string) => {
    // A new description cancels anything still reading the old one (a late photo or parse can't overwrite it).
    cancelRequest();
    inflight.current = null;
    setRemoteState('idle');
    if (pinned) setPinned(null);
    selectedPhoto.current = null;
    setPhotoState('idle');
    setEdits({});
    setText(value);
  };
  const dictation = useDictation(editText, () => input.current?.focus({ preventScroll: true }));
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (props.photo) void readPhoto(props.photo);
    else if (!props.items?.length) input.current?.focus({ preventScroll: true });
  }, []);

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

  const data = plan?.data;
  const target = data ? slotRemaining(slot, day, data) : {};
  // Only phrases the table fully knows become rows; a phrase with an unknown word waits for its portions whole
  // ("3 tacos de pollo" is not "30 g pollo").
  const local = useMemo(
    () => (data && !pinned ? parseItems(knownText(text, data), data, target) : null),
    [text, slot, pinned, data],
  );
  const phrases = useMemo(() => (data && !pinned ? unknownPhrases(text, data) : []), [text, pinned, data]);
  const remoteKey = `${slot}|${norm(text)}`;
  const remoteNow = remote?.key === remoteKey ? remote.result : null;
  const dishes: RecipeRow[] = useMemo(
    () =>
      data && !pinned && norm(text).length >= 2
        ? localChips(text, data, liveRecipes.value, slot)
            .flatMap((c) => (c.kind === 'recipe' ? [c.recipe] : []))
            .filter((r) => norm(r.title) !== norm(text))
            .slice(0, 2)
        : [],
    [text, pinned, slot, data],
  );

  // JEV: name the food groups of what the table doesn't know, a moment after typing stops.
  useEffect(() => {
    const missing = phrases.filter((p) => !groups[norm(p)]);
    if (!missing.length) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      void classifyRemote(missing, ctl.signal).then((out) => {
        if (!out?.length) return;
        setGroups((g) => ({ ...g, ...Object.fromEntries(out.map((c) => [norm(c.text), c])) }));
      });
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [phrases.join('|')]);

  // Meal AI: portions for the unknown phrases, after a short pause (the whole text, so dishes decompose).
  useEffect(() => {
    if (!phrases.length || pinned || !data || text.trim().length < 3 || remote?.key === remoteKey) {
      if (!phrases.length && remoteState === 'waiting') setRemoteState('idle');
      return;
    }
    const t = setTimeout(() => void runRemote(), 900);
    return () => clearTimeout(t);
  }, [remoteKey, phrases.length, pinned]);

  function runRemote(): Promise<ParseResult | null> {
    if (inflight.current?.key === remoteKey) return inflight.current.promise;
    const promise = fetchRemote();
    inflight.current = { key: remoteKey, promise };
    return promise;
  }

  async function fetchRemote(): Promise<ParseResult | null> {
    if (!data) return null;
    cancelRequest();
    const token = generation.current;
    const key = remoteKey;
    const t = text.trim();
    if (!navigator.onLine) {
      setRemoteState('offline');
      return null;
    }
    setRemoteState('waiting');
    request.current = new AbortController();
    const r = await parseRemote(t, slot, day, request.current.signal, plan?.id);
    if (token !== generation.current) return null;
    request.current = null;
    if (r.kind === 'ok') {
      setRemote({ key, result: r.result });
      setRemoteState('idle');
      return r.result;
    }
    setRemoteState(r.kind === 'offline' ? 'offline' : r.kind === 'unavailable' ? 'unavailable' : 'error');
    return null;
  }

  async function readPhoto(file: File) {
    dictation.cancel();
    cancelRequest();
    selectedPhoto.current = file;
    setPinned(null);
    setPhotoState('reading');
    const token = generation.current;
    started.current = performance.now();
    if (!navigator.onLine) {
      setPhotoState('offline');
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
        if (!result.result.items.length) return setPhotoState('empty');
        setText(result.result.items.map((item) => item.label).join(', '));
        setEdits({});
        setPinned({ title: result.result.title, items: result.result.items, recipeId: null, source: 'photo' });
        setPhotoState('idle');
        return;
      }
      setPhotoState(result.kind === 'offline' ? 'offline' : result.kind === 'unavailable' ? 'unavailable' : 'error');
    } catch {
      if (token === generation.current) setPhotoState('error');
    }
  }

  // A photo's text mirrors its reviewed items, so what's logged is what's written.
  const photoText =
    pinned?.source === 'photo' && data
      ? withEdits(pinned.items, edits, data)
          .map((i) => i.label)
          .join(', ')
      : null;
  useEffect(() => {
    if (photoText !== null && photoText !== text) setText(photoText);
  }, [photoText]);

  // Sliding out after "Anotar": keep the last frame. Recomputing would count the new meal twice in the preview
  // and spend the first frames after the tap that belong to the logged moment on Hoy.
  if (leaving && frozen.current) return frozen.current;
  if (!plan || !data) return null;
  const slotLabel = slotOptions.find((s) => s.key === slot)?.label ?? '';
  /** The meal's plain name for sentences ("tu colación"); the chip keeps its time when the name repeats. */
  const slotName = slot === 'extra' ? labels.extraSlot : (data.slots.find((s) => s.key === slot)?.label ?? slotLabel);
  const pastDay = day !== today.value ? day : undefined;
  const fromAi = !pinned && !!remoteNow;
  const base: LogItem[] = pinned?.items ?? (remoteNow ? remoteNow.items : (local?.items ?? []));
  const items = withEdits(base, edits, data);
  // Phrases still waiting for portions (shown with JEV's groups while the meal AI works).
  const open = fromAi || pinned ? [] : phrases;
  // Pending phrases are about to be counted (or are): the preview is partial until then.
  const counting = open.length > 0 && (remoteState === 'idle' || remoteState === 'waiting');
  const shown = items.length > 0 || open.length > 0;
  if (items.length && !previewed.current) {
    previewed.current = true;
    markUx('describe:preview');
    record('describe_preview', Math.round(performance.now() - started.current));
  }
  const model = items.length ? impact(items, slot, slotName, target, data, day, balanceOn.value) : null;
  const notFood = open.filter((p) => (groups[norm(p)]?.food ?? 1) < 0.3);
  const unresolved =
    remoteState !== 'idle' && remoteState !== 'waiting' ? open.filter((p) => !notFood.includes(p)) : [];
  const resolved = slotOptions.length && vm?.rows.find((r) => r.key === slot);
  const canSkip =
    mode === 'log' &&
    slot !== 'extra' &&
    !text.trim() &&
    !pinned &&
    resolved &&
    resolved.state !== 'done' &&
    resolved.state !== 'skipped';

  const titleFor = (list: LogItem[]) =>
    pinned?.title || remoteNow?.title || autoTitle(list, data) || capitalize(text.trim());

  const step = (i: number, dir: 1 | -1) => {
    const it = items[i];
    if (!it) return;
    const q = it.qty + dir * stepOf(it, data);
    setEdits({ ...edits, [keyOf(it)]: q > 1e-6 ? q : null });
  };
  const remove = (i: number) => {
    const it = items[i];
    if (it) setEdits({ ...edits, [keyOf(it)]: null });
  };
  const applyFix = () => {
    if (!model?.fix) return;
    setPinned({
      title: titleFor(model.fix.items),
      items: model.fix.items,
      recipeId: pinned?.recipeId ?? null,
      source: pinned?.source ?? 'describe',
      changed: model.fix.changed,
    });
    setEdits({});
  };
  const useDish = (r: RecipeRow) => {
    cancelRequest();
    dictation.cancel();
    setText(r.title);
    setEdits({});
    setPinned({ title: r.title, items: r.items, recipeId: r.id, source: 'recent' });
  };

  const finish = (list: LogItem[], anchor: Element | null) => {
    const fromPush = !pastDay && pushSlot.value === slot;
    const source =
      pinned?.source === 'photo' ? 'photo' : pinned?.source === 'recent' ? 'recent' : fromPush ? 'push' : 'describe';
    if (fromPush) pushSlot.value = null;
    void logMeal({
      slot,
      title: titleFor(list),
      items: list,
      source,
      recipe_id: pinned?.recipeId ?? null,
      // The sheet's button is sliding away; the burst belongs where the logged moment shows (the now card).
      anchor: pastDay ? anchor : null,
      day: pastDay,
    });
    closeSheet();
  };

  const submit = async (anchor: Element | null) => {
    if (submitting) return;
    dictation.cancel();
    if (mode === 'check') {
      if (!items.length) return;
      void planDish(slot, { title: titleFor(items), items, recipe_id: pinned?.recipeId ?? null }, slotName, day);
      closeSheet();
      return;
    }
    // Portions still being counted: wait for them (or keep the description to count later when offline).
    if (open.length && !fromAi) {
      if (!navigator.onLine || remoteState === 'offline') {
        void logPendingDescription(text, slot, day);
        closeSheet();
        return;
      }
      if (remoteState === 'idle' || remoteState === 'waiting') {
        setSubmitting(true);
        const r = await runRemote();
        setSubmitting(false);
        if (r?.items.length) return finish(withEdits(r.items, edits, data), anchor);
        if (!items.length) return;
      }
    }
    if (items.length) finish(items, anchor);
  };

  const message = (icon: ComponentChildren, body: string) => (
    <div class="well mt-3 flex items-start gap-3 px-4 py-3">
      <span class="mt-0.5 text-ink-2">{icon}</span>
      <p class="secondary flex-1">{body}</p>
    </div>
  );

  const header = <h2 class="title">{mode === 'check' ? describeCopy.titleCheck : describeCopy.titleLog}</h2>;

  const footer =
    mode === 'check' ? (
      items.length ? (
        <button
          type="button"
          class="btn btn-primary w-full"
          data-testid="log"
          onClick={(e) => void submit(e.currentTarget)}
        >
          {buttons.like}
        </button>
      ) : undefined
    ) : canSkip ? (
      <button
        type="button"
        class="btn btn-neutral w-full"
        data-testid="skip"
        onClick={() => {
          void skipSlot(slot, day);
          closeSheet();
        }}
      >
        <SkipForward size={18} aria-hidden="true" />
        {buttons.skip}
      </button>
    ) : text.trim() || items.length ? (
      <button
        type="button"
        class="btn btn-primary w-full"
        data-testid="log"
        disabled={submitting || (!items.length && !open.length) || (!items.length && notFood.length === open.length)}
        onClick={(e) => void submit(e.currentTarget)}
      >
        {submitting ? describeCopy.counting : buttons.log}
      </button>
    ) : undefined;

  frozen.current = (
    <Sheet
      label={mode === 'check' ? describeCopy.titleCheck : describeCopy.titleLog}
      onClose={closeSheet}
      header={header}
      footer={footer}
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="chip"
          aria-expanded={picking}
          aria-label={`${a11y.pickSlot}: ${slotLabel}`}
          data-testid="slot-pick"
          onClick={() => setPicking(!picking)}
        >
          {slotLabel}
          <ChevronDown size={16} aria-hidden="true" class={`transition-transform ${picking ? 'rotate-180' : ''}`} />
        </button>
        {pastDay && (
          <span class="badge accent">
            <Clock3 size={12} aria-hidden="true" />
            {pastDay === today.value ? dates.today : dayLong(pastDay)}
          </span>
        )}
      </div>
      {picking && (
        <div class="anim-rise -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          {slotOptions.map((s) => (
            <button
              key={s.key}
              type="button"
              class="chip"
              aria-pressed={slot === s.key}
              onClick={() => {
                setSlot(s.key);
                setPicking(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div class="relative">
        <textarea
          ref={input}
          class="textarea"
          rows={2}
          enterkeyhint="done"
          autoComplete="off"
          maxLength={2000}
          placeholder={describeCopy.placeholder}
          aria-label={pools['describe.placeholder'][0]}
          value={text}
          data-testid="describe-input"
          onInput={(e) => {
            dictation.cancel();
            editText((e.currentTarget as HTMLTextAreaElement).value);
            const el = e.currentTarget as HTMLTextAreaElement;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            // "Listo" on the keyboard only hides it, so the preview is in view before anything is logged.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <span class="absolute right-2 bottom-2 flex gap-1">
          <button
            type="button"
            class="icon-btn"
            data-testid="dictate"
            aria-label={dictation.active ? buttons.stopDictation : buttons.dictate}
            aria-pressed={dictation.active}
            style={
              dictation.active ? 'background: var(--accent); color: var(--on-accent)' : 'background: var(--surface)'
            }
            onClick={() => dictation.toggle(text)}
          >
            {dictation.active ? <Square size={16} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            class="icon-btn"
            style="background: var(--surface)"
            data-testid="compose"
            aria-label={a11y.compose}
            onClick={() => {
              dictation.cancel();
              openSheet({ kind: 'compose', slot, day: pastDay, items: items.length ? items : undefined });
            }}
          >
            <Blocks size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-btn"
            style="background: var(--surface)"
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
      </div>
      {dictation.active && (
        <p class="caption mt-2 flex items-center gap-2" role="status">
          <span class="h-2 w-2 animate-pulse rounded-full bg-accent" />
          {lines.voiceListening}
        </p>
      )}
      {dictation.fallback && <p class="caption mt-2">{lines.voiceKeyboard}</p>}

      {dishes.length > 0 && (
        <div class="mt-3 flex flex-wrap gap-2">
          {dishes.map((r) => (
            <button key={r.id} type="button" class="chip filled" onClick={() => useDish(r)}>
              {r.title}
            </button>
          ))}
        </div>
      )}

      {photoState === 'reading' && (
        <div class="well mt-3 flex items-center gap-3 px-4 py-3" role="status">
          <Thinking />
          <span class="secondary flex-1 font-semibold">{lines.photoReading}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={() => {
              cancelRequest();
              selectedPhoto.current = null;
              setPhotoState('idle');
            }}
          >
            {buttons.discard}
          </button>
        </div>
      )}
      {photoState === 'error' && message(<CircleAlert size={18} aria-hidden="true" />, lines.photoError)}
      {photoState === 'empty' && message(<CircleAlert size={18} aria-hidden="true" />, lines.photoEmpty)}
      {photoState === 'offline' && message(<WifiOff size={18} aria-hidden="true" />, lines.photoOffline)}
      {photoState === 'unavailable' && message(<CircleAlert size={18} aria-hidden="true" />, lines.aiUnavailable)}
      {selectedPhoto.current && ['error', 'offline', 'unavailable'].includes(photoState) && (
        <button
          type="button"
          class="btn btn-neutral btn-sm mt-2"
          onClick={() => {
            if (selectedPhoto.current) void readPhoto(selectedPhoto.current);
          }}
        >
          {buttons.retry}
        </button>
      )}

      {shown && (
        <div data-testid="preview" class="mt-3">
          {pinned?.source === 'photo' && <p class="secondary muted mb-2">{lines.photoReview}</p>}
          <ul class="grid gap-1">
            {items.map((it, i) => (
              <ItemRow
                key={`${keyOf(it)}-${i}`}
                item={it}
                type={mainType(it, data)}
                highlight={!Object.keys(edits).length && !!pinned?.changed?.has(i)}
                onMinus={() => step(i, -1)}
                onPlus={() => step(i, 1)}
                onRemove={() => remove(i)}
              />
            ))}
            {open.map((p) => (
              <PendingRow key={p} text={p} info={groups[norm(p)]} counting={counting} />
            ))}
          </ul>
          {unresolved.length > 0 && (
            <div class="mt-2">
              {message(
                remoteState === 'offline' ? (
                  <WifiOff size={18} aria-hidden="true" />
                ) : (
                  <CircleAlert size={18} aria-hidden="true" />
                ),
                remoteState === 'offline'
                  ? pools['describe.offline'][0]
                  : `${describeCopy.partial.replace('{text}', unresolved.join(', '))}`,
              )}
              {remoteState !== 'offline' && (
                <button
                  type="button"
                  class="btn btn-tonal btn-sm mt-2"
                  onClick={() => openSheet({ kind: 'compose', slot, day: pastDay, items })}
                >
                  {buttons.compose}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {model && (
        <section
          class="well anim-rise mt-4 p-4 transition-opacity"
          style={counting ? 'opacity:.5' : undefined}
          aria-busy={counting}
          data-testid="impact"
        >
          <p class="headline" data-testid="status-line">
            {model.line}
          </p>
          {model.sub && <p class="secondary muted mt-0.5">{model.sub}</p>}
          {model.later && (
            <p class="secondary mt-0.5 font-semibold text-accent-ink" data-testid="day-effect">
              {model.later}
            </p>
          )}
          {mode === 'check' && model.fix && (
            <div class="mt-2 flex items-center gap-2">
              <p class="secondary muted flex-1">{model.fix.hint}</p>
              <button type="button" class="btn btn-tonal btn-sm shrink-0" data-testid="fit" onClick={applyFix}>
                <WandSparkles size={17} aria-hidden="true" />
                {buttons.fit}
              </button>
            </div>
          )}
          <p class="kicker mt-4 mb-2">{mode === 'check' ? describeCopy.impactCheck : describeCopy.impactLog}</p>
          <DayMeter meters={model.meters} adding={model.adding} size="sm" />
        </section>
      )}
    </Sheet>
  );
  return frozen.current;
}

function Thinking() {
  return (
    <span class="flex gap-1" aria-hidden="true">
      {(['carb_sg', 'protein_poa', 'veg'] as const).map((t, i) => (
        <span key={t} class={`tok tok-1 t-${t} anim-think`} style={`--s:22px;animation-delay:${i * 120}ms`}>
          <span class="e">{typeLabels[t].emoji}</span>
        </span>
      ))}
    </span>
  );
}

function ItemRow({
  item,
  type,
  highlight,
  onMinus,
  onPlus,
  onRemove,
}: {
  item: LogItem;
  type: TypeKey | null;
  highlight: boolean;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
}) {
  return (
    <li class="anim-rise flex min-h-12 items-center gap-2.5">
      {item.free || !type ? (
        <span
          class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-black text-ink-3"
          aria-hidden="true"
        >
          0
        </span>
      ) : (
        <span class={`tok tok-1 t-${type}`} style="--s:30px" aria-hidden="true">
          <span class="e">{typeLabels[type].emoji}</span>
        </span>
      )}
      <span class={`min-w-0 flex-1 rounded-lg px-1 font-semibold ${highlight ? 'highlight' : ''}`}>
        {item.label}
        {item.free ? (
          <span class="badge ml-2 align-middle">{describeCopy.free_tag}</span>
        ) : item.assumed_qty || item.estimated ? (
          <span class="badge ml-2 align-middle">{describeCopy.approx}</span>
        ) : null}
      </span>
      {!item.free && (
        <>
          <button
            type="button"
            class="icon-btn"
            style="width:38px;height:38px"
            aria-label={`${a11y.stepDown}: ${item.label}`}
            onClick={onMinus}
          >
            <Minus size={17} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-btn"
            style="width:38px;height:38px"
            aria-label={`${a11y.stepUp}: ${item.label}`}
            onClick={onPlus}
          >
            <Plus size={17} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </>
      )}
      <button
        type="button"
        class="icon-btn ghost -mr-2 text-ink-3"
        aria-label={`${a11y.remove}: ${item.label}`}
        onClick={onRemove}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </li>
  );
}

/** A phrase the table doesn't know: its food groups (JEV) right away, its portions once the meal AI answers. */
function PendingRow({ text, info, counting }: { text: string; info?: Classified; counting: boolean }) {
  const types = info && !info.free ? info.groups.map((g) => GROUP_TYPE[g]) : [];
  const notFood = !!info && info.food < 0.3;
  return (
    <li class="flex min-h-12 items-center gap-2.5" data-testid="pending-phrase">
      <span class="flex shrink-0 -space-x-2" aria-hidden="true">
        {types.length ? (
          types.slice(0, 3).map((t) => (
            <span key={t} class={`tok tok-1 t-${t} anim-pop`} style="--s:30px">
              <span class="e">{typeLabels[t].emoji}</span>
            </span>
          ))
        ) : (
          <span class={`tok tok-0 t-carb_sg ${counting ? 'anim-think' : ''}`} style="--s:30px">
            <span class="e">{info?.free ? '·' : '…'}</span>
          </span>
        )}
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold">{text}</span>
        <span class="caption block">
          {notFood
            ? describeCopy.notFood
            : info?.free
              ? describeCopy.free
              : counting
                ? describeCopy.counting
                : types.map((t) => typeLabels[t].short).join(' · ')}
        </span>
      </span>
    </li>
  );
}
