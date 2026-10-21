// Tomorrow's menu (R5: decide before hunger). One tap saves it; each meal cycles through ≤ 3 options.
import { Check, Shuffle } from 'lucide-preact';
import { useState } from 'preact/hooks';
import type { MenuRow } from '../../shared/domain/types';
import { planTomorrow } from '../../shared/game/tomorrow';
import { buttons, todayCopy } from '../copy/es-MX';
import { pick } from '../copy/pick';
import { writeRows } from '../db/outbox';
import { gardenLogs } from '../game';
import { slotNames } from '../state/selectors';
import { liveRecipes, menus, pantry, planForDay, plans } from '../state/signals';
import { showToast } from '../state/ui';

export function TomorrowMenu({
  day,
  onSaved,
  compact = false,
}: {
  day: string;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const plan = planForDay(plans.value, day);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  if (!plan) return null;
  const menu = planTomorrow(plan, day, liveRecipes.value, gardenLogs.value, pantry.value, menus.value, Date.now());
  const saved = menus.value.filter((m) => m.day === day && m.accepted_at && !m.deleted_at);
  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const at = Date.now();
    const rows: MenuRow[] = menu.flatMap((m) => {
      const s = m.options[(choices[m.slot] ?? 0) % Math.max(1, m.options.length)];
      return s
        ? [
            {
              id: `${day}:${m.slot}`,
              day,
              slot: m.slot,
              title: s.title,
              items: s.items,
              recipe_id: s.recipe_id ?? null,
              accepted_at: at,
              updated_at: at,
              deleted_at: null,
              rev: 0,
            },
          ]
        : [];
    });
    try {
      await writeRows(rows.map((row) => ({ table: 'menus', row })));
      showToast(pick('tomorrow.accepted'));
      setChoices({});
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section data-testid="tomorrow">
      <div class="divide">
        {menu.map((m) => {
          const option = m.options[(choices[m.slot] ?? 0) % Math.max(1, m.options.length)];
          const isSaved = saved.some((r) => r.slot === m.slot && option && r.title === option.title);
          return (
            <button
              key={m.slot}
              type="button"
              class="press flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-100"
              disabled={busy || m.options.length < 2}
              onClick={() => setChoices({ ...choices, [m.slot]: (choices[m.slot] ?? 0) + 1 })}
            >
              <span class="min-w-0 flex-1">
                <span class="caption block font-bold">{slotNames.value[m.slot] ?? m.label}</span>
                <span class="block truncate font-bold">{option?.title ?? '—'}</span>
                {!compact && option && (
                  <span class="secondary muted block truncate">
                    {option.items
                      .filter((i) => !i.free)
                      .map((i) => i.label)
                      .join(' · ')}
                  </span>
                )}
              </span>
              {isSaved && (
                <span class="badge leaf">
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                  {todayCopy.planned}
                </span>
              )}
              {m.options.length > 1 && (
                <span class="icon-btn">
                  <Shuffle size={18} aria-hidden="true" />
                  <span class="sr-only">{buttons.change}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        class="btn btn-primary mt-3 w-full"
        disabled={busy || menu.some((m) => !m.options.length)}
        onClick={() => void accept()}
        data-testid="accept-menu"
      >
        <Check size={22} strokeWidth={3} aria-hidden="true" />
        {buttons.accept}
      </button>
    </section>
  );
}

export default TomorrowMenu;
