// Push notification copy (used by the Worker). Checked by copy:lint.
export const pushPools = {
  'push.title.slot': ['{slot}'],
  'push.body.slot': [
    '¿{slot} como siempre? Un toque y listo.',
    'Tu {slot} te espera.',
    '¿Ya comiste? Anotarlo toma un segundo.',
    '¿Lo de siempre? Un toque.',
    '{slot}: ya está lista tu sugerencia.',
  ],
  'push.title.plan': ['¿Plan nuevo?'],
  'push.body.plan': [
    'Súbelo y arranca la temporada.',
    'Tómale foto y Fichas lo lee.',
    'Plan nuevo, temporada nueva.',
    'Un toque y se lee solo.',
    'Súbelo cuando puedas.',
  ],
  'push.title.recap': ['Cierre del día'],
  'push.body.recap.round': [
    'Día redondo. Mira cómo quedó.',
    'Todo en su lugar hoy. Un vistazo.',
    'Día al 100, justo en plan.',
    'Hoy quedó redondo. Ven a verlo.',
    'Día perfecto de plan. Tu resumen.',
  ],
  'push.body.recap.full': [
    'Día al 100. Mira tu resumen.',
    'Llenaste todos los grupos hoy.',
    'Día completo. Un minuto de resumen.',
    'Todo cubierto hoy. Ven a verlo.',
    'Día al 100. Mira qué movió tu día.',
  ],
  'push.body.recap.close': [
    'Para cerrar al 100: {list}.',
    'Te falta {list} para cerrar el día.',
    'Cierra al 100 con {list}.',
    'Tu día va bien. Falta {list}.',
    'A tu día le falta {list}.',
  ],
  'push.title.test': ['Fichas'],
  'push.body.test': ['Así se ven los avisos.'],
} as const;

export type PushPoolKey = keyof typeof pushPools;
