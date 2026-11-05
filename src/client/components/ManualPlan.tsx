import seed from '../../../seed/plan-2026-10-08.json' with { type: 'json' };
import { useState } from 'preact/hooks';
import type { PlanDraftView } from '../../shared/api';
import type { PlanData, Slot, TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount } from '../../shared/domain/units';
import { Stepper } from './Stepper';
import { buttons, typeLabels } from '../copy/es-MX';
import { planLines } from '../copy/more';
import { api } from '../db/sync';
import { activePlan } from '../state/signals';

// The bundled food table is only a fallback when no previous plan exists.
// Targets start at zero: the app never proposes a diet on the person's behalf.
const reference = seed as unknown as PlanData;
const initialSlots = (): Slot[] => {
  const previous = activePlan.value?.data;
  return (previous?.slots ?? reference.slots).map((slot) => ({
    ...slot,
    target: previous ? { ...slot.target } : {},
    example: previous ? slot.example : null,
  }));
};
const newKey = (slots: Slot[]) => {
  let i = slots.length + 1;
  while (slots.some((s) => s.key === `manual_${i}`)) i++;
  return `manual_${i}`;
};
const dailyTotal = (slots: Slot[]): Units =>
  Object.fromEntries(
    TYPE_KEYS.map((type) => [
      type,
      slots.reduce((sum, slot) => sum + (slot.target[type] ?? 0), 0),
    ]).filter(([, count]) => Number(count) > 0),
  ) as Units;

export function ManualPlan({
  previousDraftId,
  onSaved,
  onCancel,
}: {
  previousDraftId?: string | null;
  onSaved: (draft: PlanDraftView) => void;
  onCancel: () => void;
}) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = dailyTotal(slots);
  const hasTargets = Object.values(totals).some((n) => n > 0);
  const hadPlan = !!activePlan.value;

  const change = (key: string, type: TypeKey, direction: -1 | 1) => {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.key !== key) return slot;
        const n = Math.max(0, Math.min(12, (slot.target[type] ?? 0) + direction * 0.5));
        const target = { ...slot.target };
        if (n === 0) delete target[type];
        else target[type] = n;
        return { ...slot, target, example: n !== (slot.target[type] ?? 0) ? null : slot.example };
      }),
    );
  };
  const rename = (key: string, label: string) =>
    setSlots((current) =>
      current.map((slot) => (slot.key === key ? { ...slot, label, source_label: label } : slot)),
    );

  const save = async () => {
    if (saving || !hasTargets || slots.some((slot) => !slot.label.trim())) return;
    setSaving(true);
    setError('');
    try {
      const previous = activePlan.value?.data;
      const plan: PlanData = {
        schema: 1,
        issued_on: null,
        next_appointment: null,
        fluids_ml: previous?.fluids_ml ?? null,
        exercise: previous?.exercise ?? null,
        notes: previous?.notes ?? [],
        free_foods: previous?.free_foods ?? [],
        equivalents: previous
          ? [
              ...previous.equivalents,
              ...reference.equivalents.filter(
                (food) => !previous.equivalents.some((known) => known.type === food.type),
              ),
            ]
          : reference.equivalents,
        swaps: previous?.swaps ?? [],
        rules: previous?.rules ?? { rebalance_within_day: 'unknown' },
        slots: slots.map((slot) => ({
          ...slot,
          label: slot.label.trim(),
          source_label: slot.source_label.trim(),
          target: Object.fromEntries(Object.entries(slot.target).filter(([, n]) => n > 0)) as Units,
        })),
      };
      if (previousDraftId) {
        const discarded = await api(`/api/plans/${previousDraftId}/discard`, { method: 'POST' });
        if (!discarded.ok) throw new Error('discard');
      }
      const res = await api('/api/plans/drafts/manual', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('manual');
      onSaved((await res.json()) as PlanDraftView);
    } catch {
      setError(planLines.planManualSaveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="manual-plan-editor">
      <section class="card mb-4 p-4">
        <h2 class="font-bold">{planLines.planManualTitle}</h2>
        <p class="secondary muted mt-2">{planLines.planManualHelp}</p>
        <p class="caption mt-2">
          {hadPlan ? planLines.planManualExistingFoods : planLines.planManualReferenceFoods}
        </p>
        {hasTargets && (
          <div class="mt-3 flex flex-wrap gap-2" aria-label={planLines.planManualTotals}>
            {TYPE_KEYS.filter((type) => (totals[type] ?? 0) > 0).map((type) => (
              <span class="badge" key={type}>
                {typeLabels[type].emoji} {formatCount(totals[type] ?? 0)}
              </span>
            ))}
          </div>
        )}
      </section>
      <section class="card mb-4 px-4" aria-label={planLines.planManualMeals}>
        {slots.map((slot, index) => (
          <details key={slot.key} class="border-line border-b py-3 last:border-b-0" open={index === 0}>
            <summary class="press min-h-12 cursor-pointer">
              <span class="font-bold">{slot.label || planLines.planSlotAdded}</span>
              <div class="mt-2">
                <span class="caption">
                  {TYPE_KEYS.filter((type) => (slot.target[type] ?? 0) > 0)
                    .map((type) => `${typeLabels[type].emoji} ${formatCount(slot.target[type] ?? 0)}`)
                    .join(' · ') || planLines.planManualEmpty}
                </span>
              </div>
            </summary>
            <div class="pt-3">
              <label class="caption block">
                {planLines.planManualName}
                <input
                  class="field mt-2"
                  type="text"
                  maxLength={60}
                  value={slot.label}
                  onInput={(e) => rename(slot.key, e.currentTarget.value)}
                />
              </label>
              <div class="mt-3">
                {TYPE_KEYS.map((type) => (
                  <Stepper
                    key={type}
                    label={`${typeLabels[type].emoji} ${typeLabels[type].group}: ${formatCount(slot.target[type] ?? 0)}`}
                    onMinus={() => change(slot.key, type, -1)}
                    onPlus={() => change(slot.key, type, 1)}
                  />
                ))}
              </div>
              {slots.length > 1 && (
                <button
                  type="button"
                  class="btn btn-text mt-3 w-full"
                  onClick={() => setSlots((current) => current.filter((s) => s.key !== slot.key))}
                >
                  {planLines.planManualRemoveMeal}
                </button>
              )}
            </div>
          </details>
        ))}
        {slots.length < 10 && (
          <button
            type="button"
            class="btn btn-soft my-4 w-full"
            onClick={() =>
              setSlots((current) => {
                const label = `${planLines.planSlotAdded} ${current.length + 1}`;
                return [
                  ...current,
                  {
                    key: newKey(current),
                    label,
                    source_label: label,
                    kind: 'meal',
                    time: null,
                    target: {},
                    example: null,
                  },
                ];
              })
            }
          >
            {planLines.planManualAddMeal}
          </button>
        )}
      </section>
      {!hasTargets && <p class="caption mb-3">{planLines.planManualNeedsTarget}</p>}
      {slots.some((slot) => !slot.label.trim()) && <p class="caption mb-3">{planLines.planManualNeedsName}</p>}
      {error && <p class="secondary muted mb-3" role="status">{error}</p>}
      <button
        type="button"
        class="btn btn-primary w-full"
        data-testid="save-manual-plan"
        disabled={saving || !hasTargets || slots.some((slot) => !slot.label.trim())}
        onClick={() => void save()}
      >
        {saving ? planLines.planSaving : planLines.planManualReview}
      </button>
      <button type="button" class="btn btn-text mt-2 w-full" disabled={saving} onClick={onCancel}>
        {buttons.close}
      </button>
    </div>
  );
}
