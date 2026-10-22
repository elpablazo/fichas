// Lines after a log (§14.5), picked at random so they don't repeat. Loaded at idle, not on first paint: they only
// show once a meal is saved.
export const logPools = {
  'log.onPlan': [
    '¡Eso! {slot} en plan.',
    'Al cien.',
    'Así mero.',
    'Bien ahí.',
    'Exacto, como relojito.',
    'Ni una de más, ni una de menos.',
  ],
  'log.firstOfDay': [
    'Buen arranque.',
    'Primer bocado, anotado.',
    'Arranque redondo.',
    'Día abierto.',
    'Ya empezó lo bueno.',
  ],
  'log.overSmall': [
    'Un {type} de más. Sin drama.',
    '+{n} {emoji}. Anotado, a lo que sigue.',
    'Se coló un {emoji}. Todo bien.',
    'Un poquito arriba. Lo anotaste, eso cuenta.',
    '+{n} {emoji}. Ya quedó anotado.',
  ],
  // Only when cuadrar el día actually trims that type later today.
  'log.overBalanced': [
    'Un {type} de más. Sin drama: el día se cuadra.',
    '+{n} {emoji}. El día se acomoda solo.',
    '+{n} {emoji}. Lo que sigue se ajusta.',
    'Se coló un {emoji}. Se cuadra más tarde.',
    'Un poquito arriba. Tu día se cuadra solo.',
  ],
  'log.overBig': [
    'Día de fiesta. Anotado, eso es lo que cuenta.',
    'Comidón. Anotarlo fue la mejor jugada.',
    'Se vale. Ya quedó registrado.',
    'Anotado sin filtro. Así se hace.',
    'Lo importante ya pasó: lo anotaste.',
  ],
  'log.under': [
    'Te quedó {n} {emoji}. Es tuya si se te antoja.',
    'Sobró {n} {emoji}. Ahí está si la quieres.',
    'Anotado. Queda {n} {emoji}.',
    'Listo. {n} {emoji} sin usar.',
    'Va. Te queda {n} {emoji}.',
  ],
  'log.mixed': [
    'Anotado. Tu día ya lo refleja.',
    'Listo, tal cual.',
    'Anotado. Arriba ves cómo va tu día.',
    'Va, registrado.',
    'Hecho, ya cuenta.',
  ],
  'log.extra': ['Extra anotado.', 'Anotado como extra.', 'Va, extra registrado.', 'Listo, extra.', 'Extra, anotado.'],
  'log.free': [
    'Libre. No cuenta.',
    'Ese es libre.',
    'Libre, como debe ser.',
    'No suma fichas.',
    'Gratis para tu plan.',
  ],
  'log.skip': ['Anotado.', 'Va.', 'Entendido.', 'Listo.', 'Hecho.'],
  'log.undo': ['Deshecho.', 'Listo, deshecho.', 'Como si nada.', 'Va, sin cambios.', 'Ya quedó como antes.'],
  'log.backfill': ['Anotado en ese día.', 'Recuperado.', 'Listo, ese día cuenta.', 'Día completado.', 'Ya quedó.'],
  'log.newDish': [
    'Nuevo plato en tu recetario.',
    'Plato nuevo guardado.',
    'A tu recetario.',
    'Uno más para tu colección.',
    'Guardado. La próxima, un toque.',
  ],
  'log.edited': ['Ajustado.', 'Listo, cambiado.', 'Va, actualizado.', 'Cambio guardado.', 'Hecho.'],
  'log.removed': ['Quitado.', 'Listo, fuera.', 'Ya no está.', 'Va, fuera.', 'Hecho, quitado.'],
} as const;

export type LogPoolKey = keyof typeof logPools;
