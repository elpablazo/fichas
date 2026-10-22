// A meal as dishes: each dish with its fichas, its ingredients nested under it (so "how many carbs came from the
// arepa?" is answered by looking). Tap an ingredient to change its portion or take it out.
import { ChevronDown, Minus, Plus, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { groupItems, isPlainItem } from '../../shared/domain/dishes';
import { mainType } from '../../shared/domain/items';
import type { LogItem, PlanData, TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { formatCount, sumUnits, unitsOfItem } from '../../shared/domain/units';
import { a11y, buttons, describeCopy, labels, typeLabels } from '../copy/es-MX';
import { foodSprite } from '../sprites/food-map';
import { FoodIcon, TypeIcon } from './Sprite';

/** "🫓 2 · 🍗 3": the fichas of an item or a dish, largest first. */
export function Fichas({ units, max = 4 }: { units: Units; max?: number }) {
  const list = TYPE_KEYS.map((t) => ({ t, n: units[t] ?? 0 }))
    .filter((x) => x.n >= 0.125)
    .sort((a, b) => b.n - a.n)
    .slice(0, max);
  if (!list.length) return null;
  return (
    <span
      class="fichas"
      role="img"
      aria-label={list.map((x) => `${formatCount(x.n)} ${typeLabels[x.t].short}`).join(', ')}
    >
      {list.map((x) => (
        <span key={x.t} class={`ficha t-${x.t}`} aria-hidden="true">
          <TypeIcon type={x.t} size={15} />
          <span class="num">{formatCount(x.n)}</span>
        </span>
      ))}
    </span>
  );
}

interface Props {
  items: LogItem[];
  plan: PlanData | null;
  onStep?: (index: number, dir: 1 | -1) => void;
  onRemove?: (index: number) => void;
  /** Items to highlight (portions "Ajustar" changed). */
  highlight?: ReadonlySet<number>;
}

export function DishList({ items, plan, onStep, onRemove, highlight }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const editable = !!onStep;
  const row = (i: number, nested: boolean) => {
    const it = items[i];
    if (!it) return null;
    const type = it.free ? null : mainType(it, plan);
    const units = unitsOfItem(it, plan);
    const isOpen = editable && open === i && !it.free;
    const body = (
      <>
        <FoodIcon id={foodSprite(it.label)} type={type} size={nested ? 26 : 30} />
        <span class={`min-w-0 flex-1 ${highlight?.has(i) ? 'highlight' : ''}`}>
          <span class="font-semibold">{it.label}</span>
          {it.free ? (
            <span class="badge ml-2 align-middle">{describeCopy.free_tag}</span>
          ) : it.assumed_qty || it.estimated ? (
            <span class="badge ml-2 align-middle">{describeCopy.approx}</span>
          ) : null}
        </span>
        <Fichas units={units} max={2} />
        {editable && !it.free && (
          <ChevronDown
            size={16}
            strokeWidth={2.6}
            class={`shrink-0 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        )}
      </>
    );
    return (
      <li key={i} class={`dish-item ${nested ? 'nested' : ''}`} data-testid="item-row">
        {editable && !it.free ? (
          <button
            type="button"
            class="press flex min-h-12 w-full items-center gap-2.5 rounded-xl text-left"
            aria-expanded={isOpen}
            aria-label={`${a11y.edit}: ${it.label}`}
            onClick={() => setOpen(isOpen ? null : i)}
          >
            {body}
          </button>
        ) : (
          <div class="flex min-h-12 items-center gap-2.5">
            {body}
            {editable && onRemove && (
              <button
                type="button"
                class="icon-btn ghost -my-1 text-ink-3"
                aria-label={`${a11y.remove}: ${it.label}`}
                onClick={() => onRemove(i)}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {isOpen && (
          <div class="anim-rise mt-1 mb-2 flex items-center gap-2 pl-9">
            <button
              type="button"
              class="icon-btn"
              style="width:40px;height:40px"
              aria-label={`${a11y.stepDown}: ${it.label}`}
              onClick={() => onStep?.(i, -1)}
            >
              <Minus size={18} strokeWidth={2.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-btn"
              style="width:40px;height:40px"
              aria-label={`${a11y.stepUp}: ${it.label}`}
              onClick={() => onStep?.(i, 1)}
            >
              <Plus size={18} strokeWidth={2.8} aria-hidden="true" />
            </button>
            <span class="flex-1" />
            {onRemove && (
              <button
                type="button"
                class="btn btn-ghost btn-sm text-ink-2"
                aria-label={`${a11y.remove}: ${it.label}`}
                onClick={() => {
                  setOpen(null);
                  onRemove(i);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {buttons.remove}
              </button>
            )}
          </div>
        )}
      </li>
    );
  };
  return (
    <ul class="grid gap-2" data-testid="dish-list">
      {groupItems(items).map((g) =>
        isPlainItem(g, items) ? (
          row(g.items[0] as number, false)
        ) : (
          <li key={`d-${g.items[0]}`} class="dish" data-testid="dish">
            <div class="dish-head">
              <FoodIcon id={foodSprite(g.name ?? '')} type={dishType(g.items, items, plan)} size={30} />
              <span class="min-w-0 flex-1 font-extrabold leading-5">{g.name ?? labels.others}</span>
              <Fichas units={sumUnits(g.items.map((i) => unitsOfItem(items[i] as LogItem, plan)))} />
            </div>
            <ul class="dish-items">{g.items.map((i) => row(i, true))}</ul>
          </li>
        ),
      )}
    </ul>
  );
}

function dishType(indexes: number[], items: LogItem[], plan: PlanData | null): TypeKey | null {
  const units = sumUnits(indexes.map((i) => unitsOfItem(items[i] as LogItem, plan)));
  return TYPE_KEYS.reduce<TypeKey | null>(
    (best, t) => ((units[t] ?? 0) > (best ? (units[best] ?? 0) : 0) ? t : best),
    null,
  );
}
