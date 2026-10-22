// Reward copy (moments, day close, menus, seasons): only lazy screens need it, so it stays out of the startup
// bundle. Checked by copy:lint with es-MX.ts.
import { pickFrom } from './pick';

export const gamePools = {
  comeback: [
    '¡Volviste! Justo a tiempo para la que sigue.',
    'Aquí sigue tu día. ¿Qué comiste?',
    '¡Qué bueno verte de vuelta!',
    'De vuelta. Esto es lo que cuenta.',
    'Se retoma sin pendientes.',
  ],
  'dayClose.round': [
    'Día redondo.',
    'Redondito.',
    'Día perfecto de fichas.',
    'Todo en su lugar.',
    'Ni una fuera de lugar.',
  ],
  'dayClose.full': [
    'Día completo. Tu jardín lo nota.',
    'Listo por hoy.',
    'Día completo. A descansar.',
    'Día cerrado. Mañana, más fácil.',
    'Hoy ya quedó.',
  ],
  'dayClose.partial': [
    'Día cerrado. Cada comida anotada cuenta.',
    'Listo por hoy. Mañana sigue.',
    'Buen día de registro.',
    'Cerrado. Lo anotado, anotado.',
    'Lo anotado ya está en tu jardín.',
  ],
  'tomorrow.accepted': ['Mañana resuelto.', 'Menú listo.', 'Ya no hay que pensarle.'],
  'season.start': ['Temporada {n}. Plan nuevo, hoja en blanco.', 'Arranca la temporada {n}.'],
  'season.end': ['Temporada {n} completa.', 'Cerraste la temporada {n}.'],
  'stamp.earned': ['Estampa nueva: {name}.', '¡{name}!'],
  'level.up': ['Nivel {n}. Desbloqueaste {unlock}.', '¡Nivel {n}! Ganaste {unlock}.'],
  'species.new': [
    'Floreció una {name}.',
    '¡Una {name} en tu jardín!',
    'Nueva en tu herbario: {name}.',
    'Tu jardín estrena {name}.',
    'Descubriste la {name}.',
  ],
  'species.rare': ['¡Flor rara! Una {name}.', 'Qué suerte: {name}.', 'Rarísima: {name}.'],
  'species.bloom': [
    'Hoy floreció: {name}.',
    'Tu flor de hoy: {name}.',
    'Abrió tu {name}.',
    'Ya floreció tu {name}.',
    'Una {name} para hoy.',
  ],
  surprise: [
    'Esa combinación se ve rica.',
    'Vas como relojito.',
    'Tus fichas te saludan.',
    'Llevas {total} comidas anotadas.',
    'Chef, ¿eh?',
    'Así se arma un hábito.',
  ],
} as const;

export type GamePoolKey = keyof typeof gamePools;

export function pickGame(key: GamePoolKey, vars: Record<string, string | number> = {}): string {
  return pickFrom(gamePools, key, vars);
}
