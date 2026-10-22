// "¿Qué comiste?" (log) and "¿Qué se te antoja?" (check). Pick the meal on the sun's path, write it one dish per
// line (or dictate, or snap it); understanding is live: foods the plan table knows appear as they're typed, JEV
// names the food groups of the rest within a moment, and the meal AI fills their portions and dishes after a short
// pause. Below, the meal against its plan (a plate of sockets) and the same tubes as Today. One button: Anotar.
import { Blocks, Camera, CircleAlert, Clock3, Mic, SkipForward, Square, WandSparkles, WifiOff } from 'lucide-preact';
import type { ComponentChildren, VNode } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Classified } from '../../shared/ai-schema';
import { addDays, appMinutes, appMinutesToHhmm, zonedTime } from '../../shared/domain/day';
import { knownDishes, mealTitle, parseDescription } from '../../shared/domain/dishes';
import { dayLong, fill, timeLabel } from '../../shared/domain/format';
import { stepOf, withQty } from '../../shared/domain/items';
import { localChips, type ParseResult } from '../../shared/domain/matcher';
import { learnedTimes, slotTimings } from '../../shared/domain/slots';
import { capitalize, norm } from '../../shared/domain/text';
import type { LogItem, PlanData, RecipeRow, TypeKey } from '../../shared/domain/types';
import { logMeal, logPendingDescription, planDish, plannedTime, skipSlot } from '../actions';
import { classifyRemote, parsePhoto, parseRemote } from '../ai';
import { DayMeter } from '../components/DayMeter';
import { DishList } from '../components/DishList';
import { MealPlate } from '../components/MealPlate';
import { Sheet, SheetLeaving } from '../components/Sheet';
import { SkyTrack } from '../components/SkyTrack';
import { Txt, TypeIcon } from '../components/Sprite';
import { a11y, buttons, dates, describeCopy, labels, lines, pools, typeLabels } from '../copy/es-MX';
import { preparePhoto } from '../media/photo';
import { useDictation } from '../media/speech';
import { balanceOn, dayVM, slotNames } from '../state/selectors';
import { liveLogs, liveRecipes, planForDay, plans, settings, today } from '../state/signals';
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

/** Items with the portion changes applied; edits are keyed by the list they were made on (a null removes). */
function withEdits(items: LogItem[], edits: Record<string, number | null>, base: string, plan: PlanData): LogItem[] {
  return items.flatMap((it, i) => {
    const k = `${base}#${i}`;
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
  /** When it was eaten, if the owner said so (else now, or the planned time on a past day). */
  const [eatenAt, setEatenAt] = useState<number | null>(null);
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
  const { tz, day_start_hour: dayStart } = settings.value;
  const stops = useMemo(() => {
    if (!plan) return [];
    const timings = slotTimings(
      plan.data.slots,
      learnedTimes(liveLogs.value, plan.data.slots, today.value, tz, dayStart),
      dayStart,
    );
    return [
      ...plan.data.slots.map((s, i) => ({
        key: s.key,
        label: s.label,
        time: timeLabel(timings[i]?.time ?? 0, dayStart),
        minutes: timings[i]?.time ?? 0,
      })),
      { key: 'extra', label: labels.extraSlot, time: '', minutes: null },
    ];
  }, [plan, tz, dayStart]);

  const data = plan?.data;
  const target = data ? slotRemaining(slot, day, data) : {};
  const known = useMemo(() => knownDishes(liveLogs.value), [liveLogs.value]);
  // Only phrases the table fully knows become rows; a phrase with an unknown word waits for its portions whole
  // ("3 tacos de pollo" is not "30 g pollo"). With several lines, each line is one dish.
  const local = useMemo(
    () => (data && !pinned ? parseDescription(text, data, target, known) : null),
    [text, slot, pinned, data, known],
  );
  const phrases = local?.phrases ?? [];
  const remoteKey = `${slot}|${norm(text)}|${text.split('\n').filter((l) => l.trim()).length}`;
  const remoteNow = remote?.key === remoteKey ? remote.result : null;
  const dishes: RecipeRow[] = useMemo(
    () =>
      data && !pinned && norm(text).length >= 2 && !text.includes('\n')
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

  // Meal AI: portions and dishes for the unknown phrases, after a short pause (the whole text, so dishes decompose).
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

  const baseId = pinned ? `p:${pinned.title}:${pinned.items.length}` : remoteNow ? `r:${remoteKey}` : `l:${norm(text)}`;
  // A photo's text mirrors its reviewed items, so what's logged is what's written.
  const photoText =
    pinned?.source === 'photo' && data
      ? withEdits(pinned.items, edits, baseId, data)
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
  /** The meal's plain name for sentences ("tu colación"); the label keeps its time when the name repeats. */
  const slotName = slot === 'extra' ? labels.extraSlot : (data.slots.find((s) => s.key === slot)?.label ?? '');
  const slotLabel = slot === 'extra' ? labels.extraSlot : (names[slot] ?? slotName);
  const pastDay = day !== today.value ? day : undefined;
  const fromAi = !pinned && !!remoteNow;
  const base: LogItem[] = pinned?.items ?? (remoteNow ? remoteNow.items : (local?.items ?? []));
  const items = withEdits(base, edits, baseId, data);
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
  const resolved = vm?.rows.find((r) => r.key === slot);
  const canSkip =
    mode === 'log' &&
    slot !== 'extra' &&
    !text.trim() &&
    !pinned &&
    resolved &&
    resolved.state !== 'done' &&
    resolved.state !== 'skipped';

  // When: now (or the meal's planned time on a past day) unless the owner set it.
  const defaultAt = pastDay ? plannedTime(slot, day) : Date.now();
  const at = eatenAt ?? defaultAt;
  const atMinutes = appMinutes(at, tz, dayStart);
  const setTime = (hhmm: string) => {
    const [h = 0] = hhmm.split(':').map(Number);
    // Before the day starts (e.g. 1 am) it's still this app day, on the next calendar date.
    const date = h < dayStart ? addDays(day, 1) : day;
    const ms = zonedTime(date, hhmm, tz);
    setEatenAt(pastDay ? ms : Math.min(ms, Date.now()));
  };

  const titleFor = (list: LogItem[]) =>
    pinned?.title || remoteNow?.title || mealTitle(list, data) || capitalize(text.trim().split('\n')[0] ?? '');

  const step = (i: number, dir: 1 | -1) => {
    const it = items[i];
    if (!it) return;
    const q = it.qty + dir * stepOf(it, data);
    setEdits({ ...edits, [editKey(i)]: q > 1e-6 ? q : null });
  };
  const remove = (i: number) => {
    if (items[i]) setEdits({ ...edits, [editKey(i)]: null });
  };
  /** The edit key of the i-th shown item (indexes shift as items are removed). */
  const editKey = (shown: number) => {
    let seen = -1;
    for (let j = 0; j < base.length; j++) {
      if (edits[`${baseId}#${j}`] === null) continue;
      seen++;
      if (seen === shown) return `${baseId}#${j}`;
    }
    return `${baseId}#${shown}`;
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
      eatenAt: eatenAt ?? undefined,
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
        void logPendingDescription(text, slot, day, eatenAt ?? undefined);
        closeSheet();
        return;
      }
      if (remoteState === 'idle' || remoteState === 'waiting') {
        setSubmitting(true);
        const r = await runRemote();
        setSubmitting(false);
        if (r?.items.length) return finish(withEdits(r.items, edits, `r:${remoteKey}`, data), anchor);
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
      {pastDay && (
        <p class="badge accent mb-2">
          <Clock3 size={12} aria-hidden="true" />
          {pastDay === today.value ? dates.today : dayLong(pastDay)}
        </p>
      )}
      <SkyTrack
        stops={stops}
        value={slot}
        onChange={setSlot}
        dayStartHour={dayStart}
        slotLabel={slotLabel}
        timeLabel={eatenAt === null && !pastDay ? describeCopy.now : timeLabel(atMinutes, dayStart)}
        timeValue={appMinutesToHhmm(atMinutes, dayStart)}
        onTime={setTime}
        showTime={mode === 'log'}
      />

      <div class="relative">
        <textarea
          ref={input}
          class="textarea"
          rows={2}
          enterkeyhint="enter"
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
            // Return starts the next dish; Return on an empty line hides the keyboard (never logs).
            if (e.key !== 'Enter' || e.shiftKey) return;
            const el = e.currentTarget;
            const before = el.value.slice(0, el.selectionStart ?? el.value.length);
            const line = before.slice(before.lastIndexOf('\n') + 1);
            if (!line.trim()) {
              e.preventDefault();
              if (el.value.endsWith('\n')) editText(el.value.replace(/\n+$/, ''));
              el.blur();
            }
          }}
        />
        <span class="absolute right-2 bottom-2 flex gap-1.5">
          <button
            type="button"
            class={`icon-btn field-btn ${dictation.active ? 'is-live' : ''}`}
            data-testid="dictate"
            aria-label={dictation.active ? buttons.stopDictation : buttons.dictate}
            aria-pressed={dictation.active}
            onClick={() => dictation.toggle(text)}
          >
            {dictation.active ? <Square size={16} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          </button>
          <button
            type="button"
            class="icon-btn field-btn"
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
            class="icon-btn field-btn"
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
      {!text.trim() && !pinned && photoState === 'idle' && <p class="caption mt-2 px-1">{describeCopy.tip}</p>}
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
          {items.length > 0 && (
            <DishList
              items={items}
              plan={data}
              onStep={step}
              onRemove={remove}
              highlight={!Object.keys(edits).length ? pinned?.changed : undefined}
            />
          )}
          {open.length > 0 && (
            <ul class={`grid gap-1 ${items.length ? 'mt-2' : ''}`}>
              {open.map((p) => (
                <PendingRow key={p} text={p} info={groups[norm(p)]} counting={counting} />
              ))}
            </ul>
          )}
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
          class="impact anim-rise mt-4 transition-opacity"
          style={counting ? 'opacity:.5' : undefined}
          aria-busy={counting}
          data-testid="impact"
        >
          {model.plate && <p class="kicker mb-1">{fill(describeCopy.yourMeal, { slot: slotName.toLowerCase() })}</p>}
          <p class="headline" data-testid="status-line">
            <Txt>{model.line}</Txt>
          </p>
          {model.plate && (
            <div class="mt-2.5">
              <MealPlate target={model.plate.target} eaten={model.plate.eaten} />
            </div>
          )}
          {model.later && (
            <p class="secondary mt-2.5 font-semibold text-accent-ink" data-testid="day-effect">
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
          <div class="impact-day mt-4 pt-3">
            <p class="kicker mb-2">{mode === 'check' ? describeCopy.impactCheck : describeCopy.impactLog}</p>
            <DayMeter meters={model.meters} adding={model.adding} size="sm" />
          </div>
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
        <span key={t} class="anim-think" style={`animation-delay:${i * 120}ms`}>
          <TypeIcon type={t} size={22} />
        </span>
      ))}
    </span>
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
            <span key={t} class="anim-pop">
              <TypeIcon type={t} size={28} />
            </span>
          ))
        ) : (
          <span class={`pending-dot ${counting ? 'anim-think' : ''}`}>{info?.free ? '·' : '…'}</span>
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
