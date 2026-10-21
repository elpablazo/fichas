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
    'Súbelo y arrancamos temporada.',
    'Tómale foto y lo leo yo.',
    'Plan nuevo, temporada nueva.',
    'Un toque y lo leo.',
    'Súbelo cuando puedas.',
  ],
  'push.title.test': ['Fichas'],
  'push.body.test': ['Así se ven los avisos.'],
} as const;

export type PushPoolKey = keyof typeof pushPools;
