// A pantry food: what it counts as in the plan, have / ran out, "siempre tengo", link it, or remove it.
import { Check, Link2, PackageX, Search, Star, Trash2, WandSparkles } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { fill, itemLabel } from '../../shared/domain/format';
import { norm } from '../../shared/domain/text';
import { equivalentById } from '../../shared/domain/units';
import { Sheet } from '../components/Sheet';
import { Segmented, SwitchRow } from '../components/ui';
import { buttons, typeLabels } from '../copy/es-MX';
import { kitchenCopy } from '../copy/more';
import { changeStock, inventory, linkPantry, removePantry, retryPantry } from '../kitchen';
import { activePlan } from '../state/signals';
import { closeSheet, showToast } from '../state/ui';

export default function FoodInfo({ id }: { id: string }) {
  const [q, setQ] = useState('');
  const [relink, setRelink] = useState(false);
  const row = inventory.value.find((p) => p.id === id);
  const plan = activePlan.value?.data;
  if (!row || !plan) return null;
  const eqs = row.equivalent_ids.map((e) => equivalentById(plan, e)).filter((e) => !!e);
  const query = norm(q);
  const results = query
    ? plan.equivalents.filter((e) => norm(`${e.food} ${e.aliases.join(' ')}`).includes(query)).slice(0, 8)
    : [];
  return (
    <Sheet
      label={row.label}
      onClose={closeSheet}
      header={<h2 class="title truncate first-letter:uppercase">{row.label}</h2>}
    >
      <Segmented
        label={row.label}
        value={row.state}
        onChange={(v) =>
          void changeStock(row, { state: v, on_list: v === 'out' ? 1 : 0, staple: v === 'out' ? 0 : row.staple })
        }
        options={[
          {
            value: 'have',
            label: (
              <span class="inline-flex items-center gap-1.5">
                <Check size={16} strokeWidth={3} aria-hidden="true" />
                {kitchenCopy.haveIt}
              </span>
            ),
          },
          {
            value: 'out',
            label: (
              <span class="inline-flex items-center gap-1.5">
                <PackageX size={16} aria-hidden="true" />
                {kitchenCopy.pantryOut}
              </span>
            ),
          },
        ]}
      />

      {eqs.length > 0 && !relink ? (
        <section class="mt-5">
          <div class="mb-1 flex items-center justify-between gap-2 px-1">
            <h3 class="kicker">{kitchenCopy.countsAs}</h3>
            <button type="button" class="btn btn-ghost btn-sm -mr-2 gap-1.5 px-3" onClick={() => setRelink(true)}>
              <Link2 size={16} aria-hidden="true" />
              {kitchenCopy.relink}
            </button>
          </div>
          <ul class="well divide px-4 py-1">
            {eqs.map((e) => (
              <li key={e.id} class="flex items-center gap-3 py-2.5">
                <span class={`tok tok-1 t-${e.type}`} style="--s:30px" aria-hidden="true">
                  <span class="e">{typeLabels[e.type].emoji}</span>
                </span>
                <span class="secondary">
                  {fill(kitchenCopy.oneToken, {
                    type: typeLabels[e.type].short,
                    portion: itemLabel(e.food, e.qty, e.unit, false),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section class="mt-5">
          <h3 class={`kicker px-1 ${relink ? 'mb-2' : 'mb-1'}`}>{kitchenCopy.linkTitle}</h3>
          {!relink && <p class="secondary muted mb-3 px-1">{kitchenCopy.unlinkedHelp}</p>}
          <div class="field-wrap mb-2">
            <input
              class="field"
              type="search"
              placeholder={kitchenCopy.linkSearch}
              aria-label={kitchenCopy.linkSearch}
              value={q}
              onInput={(e) => setQ(e.currentTarget.value)}
            />
            <span class="field-actions" aria-hidden="true">
              <span class="icon-btn">
                <Search size={18} />
              </span>
            </span>
          </div>
          {results.length > 0 && (
            <ul class="mb-2 divide">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    class="press flex min-h-12 w-full items-center gap-3 py-2 text-left"
                    onClick={() => {
                      void linkPantry(row, [e.id]);
                      showToast(kitchenCopy.linked);
                      setQ('');
                      setRelink(false);
                    }}
                  >
                    <span aria-hidden="true">{typeLabels[e.type].emoji}</span>
                    <span class="flex-1 font-semibold">{e.food}</span>
                    <Link2 size={18} class="text-accent-ink" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!relink && (
            <button
              type="button"
              class="btn btn-tonal btn-sm w-full"
              onClick={() => {
                void retryPantry(row);
                showToast(kitchenCopy.aiQueued);
              }}
            >
              <WandSparkles size={17} aria-hidden="true" />
              {buttons.askAi}
            </button>
          )}
        </section>
      )}

      <div class="well mt-5 overflow-hidden">
        <SwitchRow
          label={kitchenCopy.stapleTitle}
          help={kitchenCopy.stapleHelp}
          on={!!row.staple}
          icon={<Star size={18} aria-hidden="true" />}
          onChange={(v) => void changeStock(row, { staple: v ? 1 : 0, state: 'have', on_list: 0 })}
        />
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-sm mt-4 w-full"
        style="color: var(--destructive)"
        onClick={() => {
          void removePantry(row);
          closeSheet();
        }}
      >
        <Trash2 size={17} aria-hidden="true" />
        {kitchenCopy.removePantry}
      </button>
    </Sheet>
  );
}
