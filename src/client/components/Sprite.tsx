// Fichas' own icons instead of platform emoji: food-type icons are inlined in index.html (first paint), food
// icons come from one precached sheet. Text with the type emoji renders them inline (<Txt>).
import type { ComponentChildren } from 'preact';
import type { TypeKey } from '../../shared/domain/types';
import { typeLabels } from '../copy/es-MX';
import foodsUrl from '../sprites/foods.svg?url';

interface IconProps {
  size?: number;
  class?: string;
  /** Accessible name; without it the icon is decorative. */
  label?: string;
}

function Svg({ href, size = 24, class: cls = '', label }: IconProps & { href: string }) {
  return (
    <svg
      class={`sprite ${cls}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <use href={href} />
    </svg>
  );
}

/** The icon of a food type (tortillas, drumstick, milk…). */
export function TypeIcon({ type, ...p }: IconProps & { type: TypeKey }) {
  return <Svg href={`#g-${type}`} {...p} />;
}

/** A specific food (sprite id from foodSprite()), else its type's icon. */
export function FoodIcon({ id, type, ...p }: IconProps & { id: string | null; type: TypeKey | null }) {
  if (id) return <Svg href={`${foodsUrl}#f-${id}`} {...p} />;
  if (type) return <TypeIcon type={type} {...p} />;
  return <Svg href={`${foodsUrl}#f-plato`} {...p} />;
}

const EMOJI = new Map(Object.entries(typeLabels).map(([t, m]) => [m.emoji as string, t as TypeKey]));
const SPLIT = new RegExp(`(${[...EMOJI.keys()].join('|')})`, 'u');

/** Copy with type emoji ("Llevas 1 🫓 de más") rendered with the type icons, inline with the text. */
export function Txt({ children, size = '1.2em' }: { children: string; size?: string }): ComponentChildren {
  const parts = children.split(SPLIT);
  if (parts.length === 1) return children;
  return parts.map((part, i) => {
    const t = EMOJI.get(part);
    if (!t) return part;
    return (
      <svg
        key={i}
        class="sprite inline-sprite"
        viewBox="0 0 32 32"
        style={`width:${size};height:${size}`}
        role="img"
        aria-label={typeLabels[t].short}
      >
        <use href={`#g-${t}`} />
      </svg>
    );
  });
}
