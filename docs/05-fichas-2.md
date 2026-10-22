# Fichas 2.0 — "Invernadero"

Spec y decisiones de la versión 2.0 (continúa [04-today-2.md](04-today-2.md)). Cada punto cita la observación del dueño.

## 1. Diseño
Sistema "Invernadero": papel crema, verde invernadero, tipografía de pantalla Fraunces, bordes sólidos con "labio" en botones y tarjetas, claro y oscuro. El rosa pasa a ser un tema más (la migración `theme:v2` cambia el default una vez). Ícono y favicon nuevos (hoja sobre verde). Tokens en `styles/tokens.css`.

## 2. Sprites
Íconos propios de grupo (`#g-<tipo>` inline en `index.html`) y de alimento (`foods.svg`, generado con `npm run gen:sprites`). `Txt` convierte el emoji de grupo en sprite dentro del texto y mantiene cantidad + ícono en una línea. Estampas y momentos usan íconos de línea (`StampIcon`).

## 3. Tu día
Tubos graduados: líquido = lo comido, número = lo que queda hoy, rayas = fichas, líneas largas = fin de cada comida, flecha = lo planeado hasta ahora. Anillo = % del plan cubierto (`closing`), dorado si fue exacto. El titular dice lo que sobra del día (coincide con el "+n" del tubo) y, tarde, qué falta "para cerrar al 100".

## 4. Describir
Un platillo por renglón (cada ingrediente queda en su platillo, `LogItem.dish`); título corto del platillo con IA; la comida se compara con su plan en "monedas" (`MealPlate`) y con el día (tubos en vista previa). Comida y hora de lo comido se eligen con el sol (`SkyTrack`); la hora real se guarda en `eaten_at` y se compara con la del plan. No hay "lo de siempre" ni "que cuadre" al anotar.

## 5. Causas y aprendizaje
`insights.ts`: de dónde vino cada "de más" (comida fuera del plan o comida que se pasó de su parte). Hoja del grupo (tocar un tubo), hoja del día, cierre del día con aprendizaje (`dayLesson`: justos, faltó, de más y por qué, un consejo). `eating.ts` + hoja "Tu alimentación": días al 100 como anillos, día promedio, hábitos por comida, horarios reales, comidas más frecuentes (7 / 30 días / temporada).

## 6. Push
Resumen del día (kind `recap`, migración 0005): ~75 min después de la última comida y antes del silencio, una vez al día, reserva un lugar del tope diario; el enlace lleva el día (`/?recap=AAAA-MM-DD`). Interruptor "Resumen del día" en ajustes.

## 7. Link para la nutrióloga
Tokens con hash (migración 0004), página `/n/<token>` renderizada en el Worker sin script, CSP estricta, límite de tasa. Solo alimentos y horarios, nunca fichas. Hoja "Para tu nutri" (link primero, texto aparte).

## 8. Jardín vivo
Plantas con contorno y sombreado (atributos SVG en kebab-case: Preact 11 ignora `strokeWidth`). Paisaje con cielo por hora, invernadero, macetas por semana, estanque. Ecosistema que solo suma (`ecosystem.ts`): mariposas 3, árbol 5, abejas 7, pájaros 10, estanque 14, luciérnagas 21 flores de la temporada. Herbario con siluetas.

## 9. Momento de anotar
Una ficha por grupo vuela al tubo; el tubo se aplasta y el líquido se mueve; el anillo cuenta hacia arriba (`@property --n`); la planta del día salta al crecer. Todo en un módulo diferido (`feedback/moment`) y respetando `prefers-reduced-motion`. El contexto de audio sigue en el primer pintado (iOS lo desbloquea en el toque).

## 10. Producción
Aviso de actualización con un toque (`sw.ts` espera + `SKIP_WAITING`), "Novedades" por versión (`changelog.ts`, regla en `CLAUDE.md`), píldora sin conexión, frontera de errores de render, momentos de juego que ceden ante hojas, lista de dispositivos colapsada.

## Presupuestos
JS inicial ≤ 90 KB gzip (89.8), CSS ≤ 15 KB (14.2; el CSS del jardín y del momento se carga con su pantalla). Textos de registro y juego se cargan en reposo.

## No verificado en este entorno
IA real (JEV/OpenRouter), WebKit/iPhone, despliegue, y las capturas de referencia del jardín en macOS (se regeneran con `--update-snapshots`; aquí solo existen las de Linux).
