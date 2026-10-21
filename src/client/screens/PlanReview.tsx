import { ChevronLeft } from 'lucide-preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PlanDraftView } from '../../shared/api';
import { addDays } from '../../shared/domain/day';
import { diffPlans } from '../../shared/domain/diff';
import { fill, itemLabel } from '../../shared/domain/format';
import { checkPlan, type PlanDisagreement, resolveReads } from '../../shared/domain/plan-ingestion';
import { tokensFor } from '../../shared/domain/tokens';
import type { Equivalent, PlanData, TypeKey } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
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
          <p class="secondary muted mb-2">{planLines.planChoose}</p>
          <p class="caption mb-4">{planLines.planPrivacy}</p>
          {busy ? (
            <p role="status" data-testid="plan-progress" class="font-semibold py-4">
              {stage === 'preparing'
                ? planLines.planPreparing
                : stage === 'uploading'
                  ? fill(planLines.planUploading, { n })
                  : planLines.planReading}
            </p>
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
function disagreementLabel(d: PlanDisagreement): string {
  if (d.path[0] === 'slots' && d.path[2] === 'target')
    return `${d.label.split(' · ')[0]} · ${typeLabels[d.path[3] as TypeKey].emoji}`;
  return labels.planFields[d.label as keyof typeof labels.planFields] ?? d.label;
}

function Review({ draft, onConfirmed }: { draft: PlanDraftView; onConfirmed: (n: number, startsOn: string) => void }) {
  const report = draft.report!;
  const [choices, setChoices] = useState<Record<string, 'a' | 'b'>>({});
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
  const canConfirm =
    report.disagreements.every((d) => choices[d.id]) &&
    (!report.single_read || singleAck) &&
    (!warnings.length || warningsAck);
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
      <div class="mb-3 flex flex-wrap gap-2">
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
      {report.single_read && <p class="secondary muted mb-3">{planLines.planSingleRead}</p>}
      {(plan.issued_on || plan.next_appointment) && (
        <section class="card mb-4 p-4 secondary">
          {plan.issued_on && (
            <p>
              {labels.planFields.issued_on}: {plan.issued_on}
            </p>
          )}
          {plan.next_appointment && (
            <p class="mt-2">
              {labels.planFields.next_appointment}: {plan.next_appointment}
            </p>
          )}
        </section>
      )}
      {report.disagreements.length > 0 && (
        <section class="card mb-4 p-4">
          <h2 class="font-bold mb-2">{titles.disagreements}</h2>
          {report.disagreements.map((d) => (
            <div key={d.id} class="border-line border-t py-3" data-testid="plan-disagreement">
              <p class="font-semibold">{disagreementLabel(d)}</p>
              <div class="grid grid-cols-2 gap-2 mt-2">
                {(['a', 'b'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    class="chip text-left whitespace-normal"
                    aria-pressed={choices[d.id] === key}
                    onClick={() => {
                      setChoices({ ...choices, [d.id]: key });
                      setWarningsAck(false);
                    }}
                  >
                    <span class="caption block">{key === 'a' ? planLines.planChoiceA : planLines.planChoiceB}</span>
                    {choiceText(d[key])}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
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
      <section class="card mb-4 p-4">
        <h2 class="font-bold">{titles.differences}</h2>
        {!diff.slots.length && <p class="secondary muted mt-2">{planLines.planUnchanged}</p>}
        {diff.slots.map((s) => (
          <p key={s.key} class="secondary mt-2">
            {s.label} · {s.added ? `${planLines.planSlotAdded} · ` : s.removed ? `${planLines.planSlotRemoved} · ` : ''}
            {Object.entries(s.deltas)
              .map(([t, n]) => `${n > 0 ? '+' : ''}${formatCount(n)} ${typeLabels[t as TypeKey].emoji}`)
              .join(' · ')}
            {s.time_changed && (
              <span class="caption block">
                {s.before_time ?? '—'} → {s.after_time ?? '—'}
              </span>
            )}
          </p>
        ))}
        <details class="mt-3">
          <summary class="press min-h-11 cursor-pointer caption">
            {fill(planLines.planEquivalentChanges, { n: diff.equivalents.length })}
          </summary>
          {diff.equivalents.map((e) => (
            <p key={e.id} class="secondary muted py-1">
              {e.before ? itemLabel(e.before.food, e.before.qty, e.before.unit, false) : '—'} →{' '}
              {e.after ? itemLabel(e.after.food, e.after.qty, e.after.unit, false) : '—'}
            </p>
          ))}
        </details>
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
      {warnings.length > 0 && (
        <section class="card mb-4 p-4">
          {warnings.map((w) => (
            <p key={`${w.code}:${w.field}`} class="caption mb-2">
              {fill(planLines.planWarning, { field: w.field })}
            </p>
          ))}
          <label class="press flex min-h-12 items-center gap-3">
            <input type="checkbox" checked={warningsAck} onChange={(e) => setWarningsAck(e.currentTarget.checked)} />
            {planLines.planWarningsAck}
          </label>
        </section>
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
