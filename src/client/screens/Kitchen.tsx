import {
  CalendarPlus,
  Check,
  ChefHat,
  ChevronRight,
  CircleCheckBig,
  Mic,
  Plus,
  Share2,
  ShoppingBasket,
  Square,
  Star,
} from 'lucide-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { fit } from '../../shared/domain/fit';
import { fill } from '../../shared/domain/format';
import { remainingTarget } from '../../shared/domain/log';
import {
  availableIds,
  ideasFromPantry,
  type KitchenIdea,
  shoppingList,
  validateIdea,
} from '../../shared/domain/pantry';
import { equivalentUsage, fingerprint, preferredEquivalent } from '../../shared/domain/recipes';
import { computeStatus } from '../../shared/domain/status';
import { type PantryRow, TYPE_KEYS, type TypeKey } from '../../shared/domain/types';
import { equivalentById, unitsOfItems } from '../../shared/domain/units';
import { logMeal, targetFor } from '../actions';
import { Empty, ScreenHeader, Segmented } from '../components/ui';
import { buttons, gameCopy, lines, titles, typeLabels } from '../copy/es-MX';
import { kitchenCopy } from '../copy/more';
import { writeRow } from '../db/outbox';
import { api } from '../db/sync';
import { addPantry, buyItem, changeStock, inventory } from '../kitchen';
import { useDictation } from '../media/speech';
import { slotNames, todayVM } from '../state/selectors';
import { activePlan, liveLogs, liveRecipes, menus, planForDay, plans, today } from '../state/signals';
import { kitchenSlot, navigate, openDescribe, openSheet, showToast } from '../state/ui';

function typeOf(p: PantryRow, plan: ReturnType<typeof activePlan.peek>): TypeKey | null {
  const id = p.equivalent_ids[0];
  return plan && id ? (equivalentById(plan.data, id)?.type ?? null) : null;
}

export default function Kitchen() {
  const [tab, setTab] = useState<'have' | 'dishes' | 'list'>('have');
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const speech = useDictation(setText, () => field.current?.focus());
  const plan = activePlan.value;
  const day = today.value;
  const vm = todayVM.value;
  const defaultSlot =
    vm?.now?.key ?? vm?.rows.find((r) => r.state === 'pending' || r.state === 'upcoming')?.key ?? null;
  const [picked, setPicked] = useState<string | null>(kitchenSlot.value);
  const slot = picked ?? defaultSlot;
  const stock = inventory.value;
  const target = slot ? targetFor(slot, day) : {};
  const remaining =
    slot && plan
      ? remainingTarget(
          target,
          liveLogs.value.filter((l) => l.day === day && l.slot === slot),
          plan.data.swaps,
        )
      : {};
  const have = availableIds(stock);
  const key = JSON.stringify([plan?.id, day, slot, remaining, [...have].sort()]);
  const [remote, setRemote] = useState<{ key: string; ideas: KitchenIdea[] } | null>(null);
  const deterministic = useMemo(
    () => (plan ? ideasFromPantry(plan.data, remaining, stock, liveRecipes.value, liveLogs.value) : []),
    [key, liveRecipes.value, liveLogs.value],
  );
  const ideas = deterministic.slice();
  if (remote?.key === key)
    for (const idea of remote.ideas) {
      const validated =
        plan &&
        validateIdea(
          {
            title: idea.title,
            items: idea.items.map((i) => ({ equivalent_id: i.equivalent_id ?? '', qty: i.qty, unit: i.unit })),
          },
          plan.data,
          remaining,
          have,
        );
      if (validated && ideas.length < 3 && !ideas.some((s) => fingerprint(s.items) === fingerprint(validated.items)))
        ideas.push(validated);
    }
  const needs = plan ? shoppingList(plan.data, stock, menus.value, day) : [];
  useEffect(() => {
    if (!plan || !slot || !have.size || deterministic.length >= 3 || !navigator.onLine) return;
    const abort = new AbortController();
    void api('/api/ai/ideas', {
      method: 'POST',
      body: JSON.stringify({ day, slot, remaining, have: [...have] }),
      signal: abort.signal,
    })
      .then(async (response) => {
        if (response.ok && !abort.signal.aborted) {
          const body = (await response.json()) as { ideas: KitchenIdea[] };
          if (!abort.signal.aborted) setRemote({ key, ideas: body.ideas });
        }
      })
      .catch(() => {});
    return () => abort.abort();
  }, [key]);
  const add = async () => {
    if (adding || !text.trim()) return;
    speech.cancel();
    setAdding(true);
    const value = text;
    setText('');
    try {
      await addPantry(value);
    } finally {
      setAdding(false);
    }
  };
  const later = async (idea: KitchenIdea) => {
    if (!slot || !plan) return;
    const nextDay = addDays(day, 1);
    const next = planForDay(plans.value, nextDay);
    const s = next?.data.slots.find((s) => s.key === slot);
    if (!next || !s) return;
    const fitted = fit(idea.items, s.target, {
      plan: next.data,
      rules: next.data.swaps,
      preferred: preferredEquivalent(next.data, equivalentUsage(liveLogs.value), slot),
    });
    if (computeStatus(unitsOfItems(fitted.items, next.data), s.target, next.data.swaps).status !== 'on') return;
    const at = Date.now();
    await writeRow('menus', {
      id: `${nextDay}:${slot}`,
      day: nextDay,
      slot,
      title: idea.title,
      items: fitted.items,
      recipe_id: idea.recipe_id ?? null,
      accepted_at: at,
      updated_at: at,
      deleted_at: null,
      rev: 0,
    });
    showToast(kitchenCopy.later);
  };
  const share = async () => {
    const body = needs.map((n) => `• ${n.label}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: kitchenCopy.listShare, text: body });
      else await navigator.clipboard.writeText(body);
    } catch {
      // Cancelled share sheets are not errors.
    }
  };

  // Pantry grouped by food type; unknown foods last.
  const groups = new Map<TypeKey | 'none', PantryRow[]>();
  for (const p of [...stock].sort((a, b) => a.label.localeCompare(b.label, 'es'))) {
    const t = typeOf(p, plan) ?? 'none';
    groups.set(t, [...(groups.get(t) ?? []), p]);
  }
  const order: (TypeKey | 'none')[] = [...TYPE_KEYS, 'none'];
  const slots = plan?.data.slots ?? [];

  return (
    <main class="app-main anim-fade" data-testid="kitchen">
      <ScreenHeader title={titles.kitchen} />
      <div class="mb-4">
        <Segmented
          label={titles.kitchen}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'have', label: kitchenCopy.have },
            { value: 'dishes', label: kitchenCopy.dishes },
            { value: 'list', label: `${kitchenCopy.missing} · ${needs.length}` },
          ]}
        />
      </div>

      {tab === 'dishes' ? (
        <Dishes />
      ) : tab === 'list' ? (
        <section class="card overflow-hidden" data-testid="shopping-list">
          {needs.length ? (
            <>
              <div class="flex items-center justify-between px-4 pt-3">
                <h2 class="headline">{kitchenCopy.listShare}</h2>
                <button type="button" class="btn btn-tonal btn-sm gap-1.5 px-3" onClick={() => void share()}>
                  <Share2 size={16} aria-hidden="true" />
                  {buttons.shareList}
                </button>
              </div>
              <ul class="divide px-4 py-1">
                {needs.map((item) => {
                  const t =
                    plan && item.equivalent_ids[0] ? equivalentById(plan.data, item.equivalent_ids[0])?.type : null;
                  return (
                    <li key={item.id}>
                      <label class="press flex min-h-14 w-full cursor-pointer items-center gap-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={false}
                          class="check"
                          aria-label={fill(kitchenCopy.bought, { food: item.label })}
                          onChange={() => void buyItem(item)}
                        />
                        <span class="flex-1 font-semibold first-letter:uppercase">{item.label}</span>
                        {t && (
                          <span class="text-[18px]" aria-hidden="true">
                            {typeLabels[t].emoji}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <Empty
              art={<CircleCheckBig size={44} class="text-leaf" aria-hidden="true" />}
              title={kitchenCopy.listEmpty}
              text={kitchenCopy.listHint}
            />
          )}
        </section>
      ) : (
        <>
          <section data-testid="kitchen-ideas" class="mb-6">
            <h2 class="section-title mb-2 px-1">{kitchenCopy.ideas}</h2>
            <div class="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pt-0.5 pb-1">
              {slots.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  class="chip"
                  aria-pressed={slot === s.key}
                  onClick={() => {
                    setPicked(s.key);
                    kitchenSlot.value = s.key;
                  }}
                >
                  {slotNames.value[s.key] ?? s.label}
                </button>
              ))}
            </div>
            {!ideas.length && (
              <div class="card">
                <Empty
                  art={<ChefHat size={40} class="text-accent-ink" aria-hidden="true" />}
                  title={slot && Object.keys(remaining).length ? kitchenCopy.empty : kitchenCopy.allDone}
                />
              </div>
            )}
            {ideas.map((idea) => (
              <article key={fingerprint(idea.items)} class="card anim-rise mb-3 p-4" data-testid="kitchen-idea">
                <h3 class="headline">{idea.title}</h3>
                <ul class="mt-2 flex flex-wrap gap-1.5">
                  {idea.items.map((it) => {
                    const missing = !!it.equivalent_id && idea.missing.includes(it.equivalent_id);
                    return (
                      <li
                        key={it.label}
                        class={`badge ${missing ? '' : 'leaf'}`}
                        style={missing ? 'box-shadow: inset 0 0 0 1.5px var(--line-2); background: transparent' : ''}
                      >
                        {!missing && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                        {it.label}
                      </li>
                    );
                  })}
                </ul>
                {idea.missing.length > 0 && (
                  <p class="caption mt-2">
                    {fill(kitchenCopy.missingFood, {
                      foods: idea.missing
                        .map((id) => plan && equivalentById(plan.data, id)?.food)
                        .filter(Boolean)
                        .join(', '),
                    })}
                  </p>
                )}
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm min-h-12 flex-1"
                    disabled={!!busy}
                    onClick={() => {
                      if (!slot || busy) return;
                      setBusy(fingerprint(idea.items));
                      void logMeal({
                        slot,
                        title: idea.title,
                        items: idea.items,
                        source: 'pantry',
                        recipe_id: idea.recipe_id,
                      })
                        .then(() => navigate('/'))
                        .finally(() => setBusy(null));
                    }}
                  >
                    <Check size={18} strokeWidth={3} aria-hidden="true" />
                    {buttons.log}
                  </button>
                  <button
                    type="button"
                    class="btn btn-neutral btn-sm min-h-12"
                    disabled={!!busy}
                    onClick={() => void later(idea)}
                  >
                    <CalendarPlus size={17} aria-hidden="true" />
                    {buttons.later}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section>
            <h2 class="section-title mb-2 px-1">{kitchenCopy.pantryTitle}</h2>
            <form
              class="field-wrap mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <input
                ref={field}
                class="field"
                value={text}
                maxLength={2000}
                placeholder={kitchenCopy.placeholder}
                aria-label={kitchenCopy.addLabel}
                data-testid="pantry-input"
                onInput={(e) => setText(e.currentTarget.value)}
              />
              <span class="field-actions">
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={speech.active ? buttons.stopDictation : buttons.dictate}
                  aria-pressed={speech.active}
                  style={speech.active ? 'background: var(--accent); color: var(--on-accent)' : ''}
                  onClick={() => speech.toggle(text)}
                >
                  {speech.active ? <Square size={16} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
                </button>
                <button
                  type="submit"
                  class="icon-btn"
                  style={text.trim() ? 'background: var(--accent); color: var(--on-accent)' : ''}
                  aria-label={kitchenCopy.add}
                  disabled={adding || !text.trim()}
                >
                  <Plus size={22} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </span>
            </form>
            {speech.fallback && <p class="caption mb-2 px-1">{kitchenCopy.keyboardMic}</p>}
            {!stock.length ? (
              <div class="card">
                <Empty
                  art={<ShoppingBasket size={40} class="text-accent-ink" aria-hidden="true" />}
                  title={kitchenCopy.pantryEmpty}
                  text={kitchenCopy.empty}
                />
              </div>
            ) : (
              <>
                <p class="caption mb-2 px-1">{kitchenCopy.pantryHint}</p>
                {order
                  .filter((t) => groups.has(t))
                  .map((t) => (
                    <section key={t} class="card mb-3 overflow-hidden">
                      <h3 class="kicker flex items-center gap-2 px-4 pt-3 pb-1">
                        <span aria-hidden="true" class="text-[16px]">
                          {t === 'none' ? '❔' : typeLabels[t].emoji}
                        </span>
                        {t === 'none' ? kitchenCopy.unlinked : typeLabels[t].group}
                      </h3>
                      <ul class="divide px-4">
                        {(groups.get(t) ?? []).map((p) => (
                          <PantryItem key={p.id} p={p} />
                        ))}
                      </ul>
                    </section>
                  ))}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/** "Tus platos": every dish you've logged, favorites first. A star boosts it in suggestions; a tap logs it. */
function Dishes() {
  const list = liveRecipes.value
    .filter((r) => !r.hidden && r.items.length && (r.times > 0 || r.origin === 'seed'))
    .sort((a, b) => b.favorite - a.favorite || b.times - a.times || a.title.localeCompare(b.title, 'es'));
  if (!list.length)
    return (
      <div class="card">
        <Empty art={<ChefHat size={40} class="text-accent-ink" aria-hidden="true" />} title={lines.emptyDishes} />
      </div>
    );
  return (
    <section class="card divide overflow-hidden" data-testid="dishes">
      {list.map((r) => (
        <div key={r.id} class="flex items-center gap-1 pr-2">
          <button
            type="button"
            class="row press min-w-0 flex-1"
            onClick={() =>
              openDescribe({
                items: r.items,
                title: r.title,
                recipeId: r.id,
                text: r.items.map((i) => i.label).join(', '),
              })
            }
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline gap-2">
                <span class="truncate font-bold">{r.title}</span>
                {r.times > 0 && <span class="caption num shrink-0">×{r.times}</span>}
              </span>
              <span class="secondary muted block truncate">
                {r.items
                  .filter((i) => !i.free)
                  .map((i) => i.label)
                  .join(' · ')}
              </span>
            </span>
          </button>
          <button
            type="button"
            class="icon-btn ghost"
            aria-label={fill(gameCopy.favorite, { title: r.title })}
            aria-pressed={!!r.favorite}
            onClick={() => void writeRow('recipes', { ...r, favorite: r.favorite ? 0 : 1, updated_at: Date.now() })}
          >
            <Star
              size={20}
              class={r.favorite ? 'text-gold' : 'text-ink-3'}
              fill={r.favorite ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
          </button>
        </div>
      ))}
    </section>
  );
}

function PantryItem({ p }: { p: PantryRow }) {
  const on = p.state === 'have';
  return (
    <li class="flex min-h-14 items-center gap-2" data-pantry={p.id}>
      <button
        type="button"
        class="press grid h-11 w-11 shrink-0 place-items-center rounded-full"
        aria-pressed={on}
        aria-label={fill(kitchenCopy.toggle, { food: p.label })}
        data-state={p.state}
        onClick={() =>
          void changeStock(p, {
            state: on ? 'out' : 'have',
            on_list: on ? 1 : 0,
            staple: on ? 0 : p.staple,
          })
        }
      >
        <span
          class="grid h-7 w-7 place-items-center rounded-full transition-colors"
          style={on ? 'background: var(--leaf); color: #fff' : 'box-shadow: inset 0 0 0 2px var(--line-2)'}
          aria-hidden="true"
        >
          {on && <Check size={17} strokeWidth={3.2} />}
        </span>
      </button>
      <button
        type="button"
        class="press flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => openSheet({ kind: 'food', id: p.id })}
      >
        <span class={`truncate font-semibold first-letter:uppercase ${on ? '' : 'text-ink-2 line-through'}`}>
          {p.label}
        </span>
        {!!p.staple && (
          <Star size={14} class="shrink-0 text-gold" fill="currentColor" aria-label={kitchenCopy.stapleTitle} />
        )}
        {!on && <span class="badge shrink-0">{kitchenCopy.pantryOut}</span>}
        {!p.equivalent_ids.length && <span class="badge accent shrink-0">{kitchenCopy.unnamed}</span>}
        <ChevronRight size={18} class="ml-auto shrink-0 text-ink-3" aria-hidden="true" />
      </button>
    </li>
  );
}
