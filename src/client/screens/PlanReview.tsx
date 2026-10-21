import { ChevronLeft } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PlanDraftView } from '../../shared/api';
import { addDays } from '../../shared/domain/day';
import { diffPlans } from '../../shared/domain/diff';
import { dayLong, fill, itemLabel, unitText } from '../../shared/domain/format';
import {
  blockingWarnings,
  checkPlan,
  type PlanDisagreement,
  type PlanWarning,
  resolveReads,
} from '../../shared/domain/plan-ingestion';
import { tokensFor } from '../../shared/domain/tokens';
import type { Equivalent, PlanData, TypeKey } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount, formatQty } from '../../shared/domain/units';
import { PlanDiffCard } from '../components/PlanDiff';
import { SeasonStart } from '../components/SeasonStart';
import { Stepper } from '../components/Stepper';
import { TokenRow, tokensA11y } from '../components/Token';
import { buttons, labels, lines, titles, typeLabels } from '../copy/es-MX';
import { planLines } from '../copy/more';
import { api, syncNow } from '../db/sync';
import { downloadPlanFile, latestDraft, PlanError, parseDraft, uploadPlan } from '../plans';
import { activePlan, liveLogs, today } from '../state/signals';
import { navigate } from '../state/ui';

type Stage = 'choose' | 'preparing' | 'uploading' | 'reading' | 'error' | 'duplicate';
export default function PlanReview() {
  const [draft, setDraft] = useState<PlanDraftView | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [n, setN] = useState(0);
  const [error, setError] = useState(planLines.planReadError as string);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [season, setSeason] = useState<{ n: number; startsOn: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const disposed = useRef(false);
  const activity = useRef(0);
  useEffect(() => {
    disposed.current = false;
    const token = activity.current;
    void latestDraft()
      .then((d) => {
        if (!disposed.current && token === activity.current && d.draft_id) {
          setDraft(d);
          if (d.report?.state === 'reading') setStage('reading');
          else if (d.report?.state === 'error' || d.report?.state === 'uploading') setStage('error');
        }
      })
      .catch(() => {});
    return () => {
      disposed.current = true;
    };
  }, []);
  useEffect(() => {
    if (stage !== 'reading' || draft?.report?.state === 'ready') return;
    const timer = setInterval(() => {
      void latestDraft()
        .then((d) => {
          if (disposed.current || !d.draft_id) return;
          setDraft(d);
          if (d.report?.state === 'ready') setStage('choose');
          else if (d.report?.state === 'error' || Date.now() - (d.report?.started_at ?? Date.now()) > 600_000)
            setStage('error');
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [stage, draft?.draft_id, draft?.report?.state]);

  const failed = (e: unknown) => {
    if (disposed.current) return;
    if (e instanceof PlanError && e.code === 'duplicate') {
      setDuplicate(e.duplicateId ?? null);
      setStage('duplicate');
    } else {
      setError(
        e instanceof PlanError && e.code === 'offline'
          ? lines.planOffline
          : e instanceof PlanError && e.code === 'files'
            ? planLines.planFilesError
            : planLines.planReadError,
      );
      setStage('error');
    }
  };
  const upload = async (files: File[]) => {
    activity.current++;
    try {
      if (draft?.draft_id) await api(`/api/plans/${draft.draft_id}/discard`, { method: 'POST' });
      const result = await uploadPlan(files, (s, index) => {
        if (!disposed.current) {
          setStage(s);
          setN(index);
        }
      });
      if (!disposed.current) {
        setDraft(result);
        setStage(
          result.report?.state === 'ready' ? 'choose' : result.report?.state === 'reading' ? 'reading' : 'error',
        );
      }
    } catch (e) {
      failed(e);
    }
  };
  const busy = ['preparing', 'uploading', 'reading'].includes(stage);
  if (season) return <SeasonStart n={season.n} startsOn={season.startsOn} />;
  return (
    <main class="app-main">
      <header class="mb-4 flex items-center gap-2">
        <button
          type="button"
          class="press grid h-11 w-11 place-items-center rounded-full"
          aria-label={titles.myPlan}
          onClick={() => navigate('/progreso/plan')}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h1 class="title">{titles.planReview}</h1>
      </header>
      {draft?.plan && draft.report?.state === 'ready' ? (
        <Review key={draft.draft_id} draft={draft} onConfirmed={(n, startsOn) => setSeason({ n, startsOn })} />
      ) : (
        <section class="card p-5">
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/*"
            multiple
            class="hidden"
            aria-label={buttons.uploadPlan}
            data-testid="plan-input"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = '';
              if (files.length) void upload(files);
            }}
          />
          {!busy && (
            <>
              <p class="secondary muted mb-2">{planLines.planChoose}</p>
              <p class="caption mb-4">{planLines.planPrivacy}</p>
            </>
          )}
          {busy ? (
            <ReadProgress
              stage={stage as 'preparing' | 'uploading' | 'reading'}
              n={n}
              startedAt={draft?.report?.started_at}
              done={draft?.report?.models.length ?? 0}
            />
          ) : (
            <button
              type="button"
              class="btn btn-primary w-full"
              data-testid="upload-plan"
              onClick={() => input.current?.click()}
            >
              {buttons.uploadPlan}
            </button>
          )}
          {stage === 'error' && (
            <p class="secondary muted mt-3" role="status">
              {error}
            </p>
          )}
          {stage === 'error' && draft?.draft_id && draft.report?.state !== 'uploading' && (
            <button
              type="button"
              class="btn btn-soft mt-3 w-full"
              onClick={() => {
                setStage('reading');
                void parseDraft(draft.draft_id!)
                  .then((d) => {
                    if (!disposed.current) {
                      setDraft(d);
                      setStage(
                        d.report?.state === 'ready' ? 'choose' : d.report?.state === 'reading' ? 'reading' : 'error',
                      );
                    }
                  })
                  .catch(failed);
              }}
            >
              {buttons.retry}
            </button>
          )}
          {stage === 'duplicate' && (
            <div class="mt-3">
              <p class="secondary muted">{planLines.planDuplicate}</p>
              {duplicate && (
                <button
                  type="button"
                  class="btn btn-soft mt-2 w-full"
                  onClick={() => navigate(`/progreso/plan/${duplicate}`)}
                >
                  {buttons.viewPlan}
                </button>
              )}
            </div>
          )}
          {draft?.draft_id && (
            <button
              type="button"
              class="btn btn-text mt-3 w-full"
              onClick={() => {
                void api(`/api/plans/${draft.draft_id}/discard`, { method: 'POST' }).then((r) => {
                  if (r.ok) {
                    setDraft(null);
                    setStage('choose');
                  }
                });
              }}
            >
              {buttons.discard}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

const STEPS = [planLines.planStepPrepare, planLines.planStepUpload, planLines.planStepRead] as const;
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** What is happening right now, how long it has been, and how many of the two readers are done. */
function ReadProgress({
  stage,
  n,
  startedAt,
  done,
}: {
  stage: 'preparing' | 'uploading' | 'reading';
  n: number;
  startedAt?: number;
  done: number;
}) {
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = stage === 'preparing' ? 0 : stage === 'uploading' ? 1 : 2;
  const elapsed = Math.max(
    0,
    now - (stage === 'reading' && startedAt ? Math.min(startedAt, mounted.current) : mounted.current),
  );
  return (
    <div data-testid="plan-progress">
      <div class="read-steps" aria-hidden="true">
        {STEPS.map((label, i) => (
          <div key={label} class="read-step" data-state={i < current ? 'done' : i === current ? 'active' : 'idle'}>
            {label}
          </div>
        ))}
      </div>
      <p role="status" class="font-semibold mt-4">
        {stage === 'preparing'
          ? planLines.planPreparing
          : stage === 'uploading'
            ? fill(planLines.planUploading, { n })
            : planLines.planReading}
      </p>
      {stage === 'reading' && (
        <>
          <p class="secondary muted mt-1">
            {done > 0 ? fill(planLines.planReadersDone, { n: done }) : planLines.planReadersNone}
            <span class="num faint" aria-hidden="true">
              {' · '}
              {clock(elapsed)}
            </span>
          </p>
          <p class="caption mt-3">{elapsed > 150_000 ? planLines.planReadLong : planLines.planReadHint}</p>
          <p class="caption">{planLines.planReadLeave}</p>
        </>
      )}
    </div>
  );
}

function choiceText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') return formatCount(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value))
    return value.map((v) => (typeof v === 'string' ? v : ((v as { label?: string }).label ?? '—'))).join(' · ');
  if (typeof value === 'object' && 'food' in value) {
    const e = value as Equivalent;
    return itemLabel(e.food, e.qty, e.unit, false);
  }
  if (typeof value === 'object' && 'items' in value)
    return (value as { items: { text: string }[] }).items.map((i) => i.text).join(' · ');
  return '—';
}
type Kind = 'same' | 'missing' | 'food' | 'target' | 'other';
const portionOf = (e: Equivalent) => `${formatQty(e.qty)} ${unitText(e.unit, e.qty)}`.trim();
function kindOf(d: PlanDisagreement): Kind {
  if (d.path[0] === 'equivalents') {
    if (d.a == null || d.b == null) return 'missing';
    return choiceText(d.a) === choiceText(d.b) ? 'same' : 'food';
  }
  if (d.path[0] === 'slots' && d.path[2] === 'example') return 'same';
  return d.path[0] === 'slots' && (d.path[2] === 'time' || d.path[2] === 'target') ? 'target' : 'other';
}
/** Readings that agree on what a person sees, or that one reader simply missed, start decided. */
function defaultChoices(disagreements: PlanDisagreement[]): Record<string, 'a' | 'b'> {
  const out: Record<string, 'a' | 'b'> = {};
  for (const d of disagreements) {
    const kind = kindOf(d);
    if (kind === 'same' || kind === 'missing') out[d.id] = d.a != null ? 'a' : 'b';
  }
  return out;
}
function disagreementLabel(d: PlanDisagreement, plan: PlanData): string {
  if (d.path[0] === 'slots' && typeof d.path[1] === 'number') {
    const slot = plan.slots[d.path[1]];
    const name = slot ? `${slot.label}${slot.time ? ` ${slot.time}` : ''}` : d.label.split(' · ')[0]!;
    if (d.path[2] === 'time') return `${name} · ${planLines.planSlotTime}`;
    if (d.path[2] === 'target') {
      const meta = typeLabels[d.path[3] as TypeKey];
      return `${name} · ${meta.emoji} ${meta.label}`;
    }
    return name;
  }
  return labels.planFields[d.label as keyof typeof labels.planFields] ?? d.label;
}
function warningText(w: PlanWarning, plan: PlanData): string {
  const slot = plan.slots.find((s) => w.field === s.key || w.field.startsWith(`${s.key}.`));
  const name = slot ? `${slot.label}${slot.time ? ` ${slot.time}` : ''}` : '';
  const meta = typeLabels[w.field.split('.').pop() as TypeKey];
  if (w.code === 'target') return `${name} · ${meta?.emoji ?? ''} ${planLines.planWarnTarget}`;
  if (w.code === 'equivalent') return `${name} · ${meta?.emoji ?? ''} ${planLines.planWarnEquivalent}`;
  if (w.code === 'time') return `${name}: ${planLines.planWarnTime}`;
  if (w.code === 'sametime') return `${name}: ${planLines.planWarnSame}`;
  if (w.code === 'date')
    return `${labels.planFields[w.field as keyof typeof labels.planFields] ?? w.field}: ${planLines.planWarnDate}`;
  return w.field;
}
const isoDay = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? dayLong(value) : value);

function Choices({
  d,
  value,
  onPick,
  render,
}: {
  d: PlanDisagreement;
  value?: 'a' | 'b';
  onPick: (key: 'a' | 'b') => void;
  render: (value: unknown) => string;
}) {
  return (
    <div class="grid grid-cols-2 gap-2 mt-2">
      {(['a', 'b'] as const).map((key) => (
        <button key={key} type="button" class="choice" aria-pressed={value === key} onClick={() => onPick(key)}>
          <span class="caption">{key === 'a' ? planLines.planChoiceA : planLines.planChoiceB}</span>
          {render(d[key])}
        </button>
      ))}
    </div>
  );
}

function Review({ draft, onConfirmed }: { draft: PlanDraftView; onConfirmed: (n: number, startsOn: string) => void }) {
  const report = draft.report!;
  const [choices, setChoices] = useState<Record<string, 'a' | 'b'>>(() => defaultChoices(report.disagreements));
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [start, setStart] = useState(() =>
    liveLogs.value.some((l) => l.day === today.value) ? addDays(today.value, 1) : today.value,
  );
  const [kg, setKg] = useState('');
  const [warningsAck, setWarningsAck] = useState(false);
  const [singleAck, setSingleAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const resolved = resolveReads(draft.plan!, report.disagreements, choices);
  const plan: PlanData = {
    ...resolved,
    slots: resolved.slots.map((s) => ({
      ...s,
      target: {
        ...s.target,
        ...Object.fromEntries(
          TYPE_KEYS.filter((t) => `${s.key}.${t}` in edits).map((t) => [t, edits[`${s.key}.${t}`]]),
        ),
      },
    })),
  };
  const diff = diffPlans(activePlan.value?.data ?? null, plan);
  const warnings = [...report.warnings, ...checkPlan(plan)].filter(
    (w, i, all) => all.findIndex((v) => v.code === w.code && v.field === w.field) === i,
  );
  const blocking = blockingWarnings(warnings);
  const skipped = warnings.filter((w) => w.code === 'example');
  const kinds = report.disagreements.map((d) => [d, kindOf(d)] as const);
  const same = kinds.filter(([, k]) => k === 'same').map(([d]) => d);
  const missing = kinds.filter(([, k]) => k === 'missing').map(([d]) => d);
  const open = kinds.filter(([, k]) => k !== 'same' && k !== 'missing').map(([d]) => d);
  const undecided = open.filter((d) => !choices[d.id]);
  const pick = (id: string, key: 'a' | 'b') => {
    setChoices({ ...choices, [id]: key });
    setWarningsAck(false);
  };
  const canConfirm =
    report.disagreements.every((d) => choices[d.id]) &&
    (!report.single_read || singleAck) &&
    (!blocking.length || warningsAck);
  const blockers = [
    undecided.length ? fill(planLines.planBlockLeft, { n: undecided.length }) : '',
    blocking.length && !warningsAck ? planLines.planBlockWarn : '',
    report.single_read && !singleAck ? planLines.planBlockSingle : '',
  ].filter(Boolean);
  const save = async () => {
    if (!canConfirm || saving) return;
    setSaving(true);
    setError('');
    try {
      await syncNow();
      const res = await api(`/api/plans/${draft.draft_id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          plan,
          starts_on: start,
          weighin_kg: kg ? Number(kg) : null,
          resolutions: choices,
          warnings_ack: warningsAck,
          single_read_ack: singleAck,
        }),
      });
      if (!res.ok) {
        setError(planLines.planStartConflict);
        return;
      }
      const response = (await res.json()) as { season: number };
      await syncNow();
      onConfirmed(response.season, start);
    } catch {
      setError(lines.planOffline);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div data-testid="plan-review">
      <section class="card mb-4 p-4">
        <p class="font-bold">
          {fill(planLines.planSummary, { slots: plan.slots.length, foods: plan.equivalents.length })}
        </p>
        <p class="secondary muted mt-1">
          {report.single_read ? planLines.planSingleRead : report.disagreements.length === 0 && planLines.planAgree}
        </p>
        {(plan.issued_on || plan.next_appointment) && (
          <p class="caption mt-2">
            {[
              plan.issued_on && `${labels.planFields.issued_on}: ${isoDay(plan.issued_on)}`,
              plan.next_appointment && `${labels.planFields.next_appointment}: ${isoDay(plan.next_appointment)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div class="mt-3 flex flex-wrap gap-2">
          {report.files.map((_, i) => (
            <button
              key={i}
              type="button"
              class="btn btn-soft"
              onClick={() => void downloadPlanFile(draft.draft_id!, i).catch(() => setError(lines.planOffline))}
            >
              {buttons.original}
              {report.files.length > 1 ? ` ${i + 1}` : ''}
            </button>
          ))}
        </div>
      </section>
      {report.disagreements.length > 0 && (
        <section class="card mb-4 p-4" data-testid="plan-disagreements">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-bold">{titles.disagreements}</h2>
            <span class={`badge ${undecided.length ? 'accent' : 'leaf'}`} aria-live="polite">
              {undecided.length ? fill(planLines.planCompareLeft, { n: undecided.length }) : planLines.planCompareDone}
            </span>
          </div>
          {open.length > 0 && <p class="secondary muted mt-1">{planLines.planCompareIntro}</p>}
          {(
            [
              ['target', planLines.planSectionTargets],
              ['food', planLines.planSectionFoods],
              ['other', planLines.planSectionOther],
            ] as const
          ).map(([kind, title]) => {
            const rows = open.filter((d) => kindOf(d) === kind);
            return (
              rows.length > 0 && (
                <div key={kind} class="mt-4">
                  <p class="kicker">{title}</p>
                  {rows.map((d) => (
                    <div key={d.id} class="border-line border-t py-3" data-testid="plan-disagreement">
                      <p class="font-semibold">{disagreementLabel(d, draft.plan!)}</p>
                      <Choices
                        d={d}
                        value={choices[d.id]}
                        onPick={(key) => pick(d.id, key)}
                        render={kind === 'food' ? (v) => portionOf(v as Equivalent) : choiceText}
                      />
                    </div>
                  ))}
                </div>
              )
            );
          })}
          {missing.length > 0 && (
            <details class="mt-4">
              <summary class="press min-h-11 cursor-pointer font-semibold">
                {planLines.planSectionMissing} · {missing.length}
              </summary>
              <p class="caption mb-1">{planLines.planMissingHint}</p>
              {missing.map((d) => {
                const keep = (d.a != null ? 'a' : 'b') as 'a' | 'b';
                const included = choices[d.id] === keep;
                return (
                  <div key={d.id} class="border-line flex items-center justify-between gap-3 border-t py-2">
                    <span class="min-w-0">
                      <span aria-hidden="true">{typeLabels[(d[keep] as Equivalent).type].emoji}</span>{' '}
                      {itemLabel(
                        (d[keep] as Equivalent).food,
                        (d[keep] as Equivalent).qty,
                        (d[keep] as Equivalent).unit,
                        false,
                      )}
                    </span>
                    <button
                      type="button"
                      class="chip shrink-0"
                      aria-pressed={included}
                      onClick={() => pick(d.id, included ? (keep === 'a' ? 'b' : 'a') : keep)}
                    >
                      {included ? planLines.planIncluded : planLines.planExcluded}
                    </button>
                  </div>
                );
              })}
            </details>
          )}
          {same.length > 0 && <p class="caption mt-3">{fill(planLines.planAutoResolved, { n: same.length })}</p>}
        </section>
      )}
      <PlanDiffCard diff={diff} first={!activePlan.value} />
      <section class="card mb-4 p-4" aria-label={titles.slots}>
        {plan.slots.map((s) => (
          <details key={s.key} class="border-line border-b py-3 last:border-b-0">
            <summary class="press min-h-12 cursor-pointer">
              <span class="font-bold">{s.label}</span> <span class="caption">{s.time}</span>
              <TokenRow tokens={tokensFor(s.target, {})} label={tokensA11y(s.target, {})} size={22} class="mt-2" />
            </summary>
            {TYPE_KEYS.map((t) => (
              <Stepper
                key={t}
                label={`${typeLabels[t].emoji} ${typeLabels[t].label}: ${formatCount(s.target[t] ?? 0)}`}
                highlight={!!diff.slots.find((r) => r.key === s.key)?.deltas[t]}
                onMinus={() => {
                  setEdits({ ...edits, [`${s.key}.${t}`]: Math.max(0, (s.target[t] ?? 0) - 0.5) });
                  setWarningsAck(false);
                }}
                onPlus={() => {
                  setEdits({ ...edits, [`${s.key}.${t}`]: Math.min(12, (s.target[t] ?? 0) + 0.5) });
                  setWarningsAck(false);
                }}
              />
            ))}
          </details>
        ))}
      </section>
      {(plan.notes.length > 0 || plan.fluids_ml || plan.exercise) && (
        <section class="card mb-4 p-4">
          <h2 class="font-bold">{titles.notes}</h2>
          {plan.fluids_ml && <p class="secondary mt-2">{fill(lines.fluids, { n: plan.fluids_ml / 1000 })}</p>}
          {plan.exercise && <p class="secondary mt-2">{plan.exercise}</p>}
          {plan.notes.map((note) => (
            <p key={note} class="secondary mt-2">
              {note}
            </p>
          ))}
        </section>
      )}
      {plan.free_foods.length > 0 && (
        <details class="card mb-4 p-4">
          <summary class="press min-h-11 cursor-pointer font-bold">{titles.freeFoods}</summary>
          <p class="secondary mt-2">{plan.free_foods.join(', ')}</p>
        </details>
      )}
      {blocking.length > 0 && (
        <section class="card mb-4 p-4">
          <h2 class="font-bold">{planLines.planCheckTitle}</h2>
          <ul class="secondary mt-2">
            {blocking
              .filter((w) => w.code !== 'portion')
              .map((w) => (
                <li key={`${w.code}:${w.field}`} class="py-1">
                  {warningText(w, plan)}
                </li>
              ))}
            {blocking.some((w) => w.code === 'portion') && (
              <li class="py-1">
                {fill(planLines.planWarnPortions, {
                  foods: blocking
                    .filter((w) => w.code === 'portion')
                    .map((w) => w.field)
                    .join(', '),
                })}
              </li>
            )}
          </ul>
          <label class="press mt-2 flex min-h-12 items-center gap-3">
            <input type="checkbox" checked={warningsAck} onChange={(e) => setWarningsAck(e.currentTarget.checked)} />
            {planLines.planWarningsAck}
          </label>
        </section>
      )}
      {skipped.length > 0 && (
        <details class="card mb-4 p-4">
          <summary class="press min-h-11 cursor-pointer font-semibold">
            {planLines.planExamplesSkipped} · {skipped.length}
          </summary>
          {skipped.map((w) => (
            <p key={w.field} class="caption py-1">
              {w.field}
            </p>
          ))}
        </details>
      )}
      {report.single_read && (
        <label class="press flex min-h-12 items-center gap-3 mb-3">
          <input type="checkbox" checked={singleAck} onChange={(e) => setSingleAck(e.currentTarget.checked)} />
          {planLines.planSingleAck}
        </label>
      )}
      <section class="card mb-4 p-4">
        <h2 class="font-bold mb-3">{titles.startsOn}</h2>
        <div class="flex gap-2">
          {[today.value, addDays(today.value, 1)].map((d, i) => (
            <button
              key={d}
              type="button"
              class="chip"
              aria-pressed={start === d}
              disabled={i === 0 && liveLogs.value.some((l) => l.day === d)}
              onClick={() => setStart(d)}
            >
              {i === 0 ? buttons.today : buttons.tomorrow}
            </button>
          ))}
        </div>
        <label class="caption mt-4 block">
          {planLines.planWeighin}
          <input
            class="field mt-2"
            type="number"
            inputMode="decimal"
            min="20.01"
            max="399.99"
            step="0.1"
            value={kg}
            onInput={(e) => setKg(e.currentTarget.value)}
          />
        </label>
      </section>
      {error && (
        <p class="secondary muted mb-3" role="status">
          {error}
        </p>
      )}
      {blockers.length > 0 && (
        <ul class="secondary muted mb-3" role="status" data-testid="plan-blockers">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        class="btn btn-primary w-full"
        disabled={!canConfirm || saving}
        data-testid="confirm-plan"
        onClick={() => void save()}
      >
        {saving ? planLines.planSaving : buttons.planOk}
      </button>
      <button
        type="button"
        class="btn btn-text mt-2 w-full"
        disabled={saving}
        onClick={() => {
          void api(`/api/plans/${draft.draft_id}/discard`, { method: 'POST' }).then((r) => {
            if (r.ok) navigate('/progreso/plan');
          });
        }}
      >
        {buttons.discard}
      </button>
    </div>
  );
}
