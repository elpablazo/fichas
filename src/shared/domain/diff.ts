import type { PlanData, TypeKey } from './types';
import { TYPE_KEYS } from './types';

export function diffPlans(previous: PlanData | null, next: PlanData) {
  const keys = [...new Set([...(previous?.slots ?? []).map((s) => s.key), ...next.slots.map((s) => s.key)])];
  const slots = keys
    .map((key) => {
      const a = previous?.slots.find((s) => s.key === key);
      const b = next.slots.find((s) => s.key === key);
      const deltas: Partial<Record<TypeKey, number>> = {};
      for (const t of TYPE_KEYS) {
        const delta = (b?.target[t] ?? 0) - (a?.target[t] ?? 0);
        if (delta) deltas[t] = delta;
      }
      return {
        key,
        label: b?.label ?? a!.label,
        added: !a,
        removed: !b,
        time_changed: a?.time !== b?.time,
        before_time: a?.time ?? null,
        after_time: b?.time ?? null,
        before: a?.target ?? {},
        after: b?.target ?? {},
        deltas,
      };
    })
    .filter((s) => s.added || s.removed || s.time_changed || Object.keys(s.deltas).length);
  const a = new Map((previous?.equivalents ?? []).map((e) => [e.id, e]));
  const b = new Map(next.equivalents.map((e) => [e.id, e]));
  const equivalents = [...new Set([...a.keys(), ...b.keys()])]
    .filter((id) => {
      const x = a.get(id);
      const y = b.get(id);
      return !x || !y || x.qty !== y.qty || x.unit !== y.unit;
    })
    .map((id) => ({ id, before: a.get(id) ?? null, after: b.get(id) ?? null }));
  const details = (['notes', 'fluids_ml', 'exercise', 'free_foods'] as const).filter(
    (key) => JSON.stringify(previous?.[key]) !== JSON.stringify(next[key]),
  );
  return { slots, equivalents, details };
}
export type PlanDiff = ReturnType<typeof diffPlans>;
