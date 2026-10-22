# Fichas — guía para agentes

PWA mobile-first en español (es-MX) para anotar comidas y compararlas con el plan de la nutrióloga.
Preact + signals, Tailwind 4, Dexie, Cloudflare Worker (Hono) + D1/R2. Fuente de verdad del diseño:
`docs/05-fichas-2.md` (2.0), `docs/04-today-2.md` (1.2), `docs/03-redesign.md` (1.0), `docs/DECISIONS.md`.

## Regla de cada commit: novedades

**Todo commit con un cambio visible para quien usa la app agrega una línea en `src/client/changelog.ts`**
(la hoja "Novedades" que aparece tras actualizar):

- Si la versión de `package.json` todavía no se publica, agrega el cambio a la entrada de arriba de `CHANGELOG`.
- Si ya se publicó, sube la versión en `package.json` y en `wrangler.jsonc` (`APP_VERSION`) y crea una entrada
  nueva arriba con la misma versión, la fecha y una línea por cambio.
- Una línea corta (≤ 72 caracteres), en tercera persona o impersonal, en lo que la persona ve, no en código.
- `npm test` verifica que la entrada de arriba coincida con la versión de `package.json`; `npm run copy:lint`
  revisa el tono y el largo.

## Antes de cada commit

`npm run lint`, `npx vitest run --project unit`, `npx vitest run --project worker`, `npm run copy:lint`,
`npm run size` (JS inicial ≤ 90 KB gzip: lo nuevo en el primer pintado va lazy o se compensa) y los e2e de lo que
cambiaste (`npx playwright test --project=pixel`; en Linux usa el Chromium de /opt/pw-browsers).

## Principios (del dueño)

- Simplificar. Una cosa a la vez, la correcta en el momento correcto. Lo gráfico gana sobre lo numérico.
- Dos momentos: decidir (antes de comer) y anotar (después, rápido).
- Nada castiga: nada decrece, los excesos son hechos neutros con un siguiente paso.
- Copy sin voz propia: nunca primera persona de la app. Botones en voz del usuario ("Me lo comí") sí.
- No tocar `src/shared/domain/balance.ts` ni el modelo de datos sin pedirlo.
- Verifica visualmente (claro y oscuro, iPhone 13 / Pixel 7), no solo con tests.
