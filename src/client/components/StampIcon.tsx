// Stamps and reward moments drawn with the app's own line icons (no platform emoji).
import {
  Award,
  CalendarCheck,
  ChefHat,
  Crown,
  Hand,
  HandHeart,
  House,
  PartyPopper,
  Sandwich,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Star,
  Target,
  Utensils,
} from 'lucide-preact';

const ICONS = {
  primer_bocado: Utensils,
  casa_llena: House,
  dia_redondo: Star,
  dia_cuadrado: Target,
  planeador: CalendarCheck,
  volviste: Hand,
  constancia: Sprout,
  chef: ChefHat,
  con_lo_que_hay: ShoppingBasket,
  sin_filtro: HandHeart,
  finde: PartyPopper,
  martes_de_tacos: Sandwich,
  level: Crown,
  surprise: Sparkles,
  comeback: Hand,
} as const;

export function StampIcon({ k, size = 26 }: { k: string; size?: number }) {
  const Icon = ICONS[k as keyof typeof ICONS] ?? Award;
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />;
}
