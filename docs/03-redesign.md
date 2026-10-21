# Fichas 1.0 — Audit and redesign

> **Audience:** the owner, and any agent continuing the build.
> **Status:** audit complete (2026-10-09); redesign implemented in release 1.0.0. §6 checks the build against this audit.
> **Precedence:** the owner's 2026-10-09 brief overrides the roadmap where they conflict (noted inline). The evidence rules in `02-technical-roadmap.md` §2 still apply.

## 1. Audit

Every screen, sheet and component of release 0.8.3 was read line by line and compared with the owner's screenshots. **(O)** marks problems the owner reported.

### S1 · Broken or missing core functions

| # | Where | Problem |
|---|---|---|
| 1 | Today | **(O)** No way to change the day. Past days can't be viewed, logged, edited or skipped; "¿Y ayer?" offers one meal at a time and only "lo de siempre". |
| 2 | Today | **(O)** No day view. "How am I doing today?" has no answer; tokens exist only per meal. The balancing logic existed but was off and dumped the whole difference into the next meal (it could empty a meal). |
| 3 | Kitchen | **(O)** "?" on a pantry chip silently re-queues an AI lookup. No feedback, nothing offline, no way to see or fix what a food counts as. |
| 4 | Weight | **(O)** Today only; the last raw value is presented as "your weight"; no smoothing, rate, projection or "is it working"; entries can't be edited or deleted; native selects start at "—" with 379 options. |
| 5 | Kitchen | "Me falta" renders an empty white card when nothing is missing. |
| 6 | Kitchen | "¿Qué me hago?" is locked to the current meal; you can't plan dinner at lunch. |
| 7 | Global | Focus rings appear after taps (pink rectangles on tabs and segments in the screenshots). |

### S2 · Visual and interaction quality (reads as a draft)

| # | Where | Problem |
|---|---|---|
| 1 | Global | **(O)** Floating text buttons with no container: "Lo de siempre / No me acuerdo", "Estampas · 1", "Estilo", "Anotar peso", "Tu temporada", "Para tu nutriólogo", "Agrega", "Dictar", "Para luego", pause durations. Low contrast and no affordance; disabled "Agrega" looks like placeholder text. |
| 2 | Global | **(O)** Text glyphs as icons (✓ ↻ ✎ ☆ ★ ? × ← →) mixed with Lucide icons; uneven baselines, platform-dependent rendering. Add/edit/missing should be icons. |
| 3 | Tokens | **(O)** Dashed circles with 42 % grey emoji read as "disabled"; 11 loose circles per meal are noise; the "+" badge is 13 px. |
| 4 | Garden | **(O)** One flower shape for every day; nothing grows during the day; nothing to discover; seeds dominate a 35-day grid. |
| 5 | Kitchen | **(O)** Each pantry pill crams three controls (name, ☆, ?); have/out differ by a faint fill; ☆ ("siempre tengo") is unexplained; the add field + two text buttons look unfinished. |
| 6 | Story | Native `<progress>` renders the browser's green/grey bar. |
| 7 | Today | Week dots with "1/7" are tiny, unexplained and read as a score you're failing. |
| 8 | Today | The fixed "Describir" bar floats over content, its label is vague, and it competes with the tab bar. |
| 9 | Meal sheet | Four same-weight grey buttons, no icons or hierarchy; a fake input that opens another sheet. |
| 10 | Global | Sheets vanish without an exit animation; tabs switch with a jump; no screen transitions. |
| 11 | Global | Card paddings (12/16/20), radii and title styles vary by screen; every card has the same weight, so the current meal doesn't lead. |
| 12 | Today | The pending-meal button hides its label in compact mode (an unlabeled checkbox look). |
| 13 | Rewards | Celebrations are a small card with a canvas at the top; sounds are plain sine beeps; day close is an ordinary sheet. |
| 14 | Weight | Thin polyline with min/max labels, no grid or trend; data hidden in `<details>`. |
| 15 | Settings | Pause buttons and time inputs unstyled; "Estilo" a bare row. |

### S3 · Copy, accessibility, consistency

| # | Problem |
|---|---|
| 1 | "nutriólogo" and "nutrióloga" both used. → "tu nutri" everywhere. |
| 2 | "Describir", "Agrega", "Me falta · 0" are vague or inconsistent. |
| 3 | The "?" button's accessible name ("Vincular: …") doesn't match its visible label. |
| 4 | Emoji in empty tokens fall to ≈1.5:1 contrast even though they identify the type. |
| 5 | Fixed 92 px label column and 12 px garden numbers clip or crowd at 130 % text. |
| 6 | The season label disappears in compact mode. |

### Mechanics that punish (removed)

- The "n/7" week fraction → replaced by counts that only grow (flowers, species, meals).
- "pendiente" wording → neutral "Anotar".
- An overage could silently zero the next meal → gentle, capped balancing (§3.3).

## 2. Principles for 1.0

1. **Ten-second sessions.** Open → see the current meal → one tap. The primary action is always in the thumb zone.
2. **One model: the day.** Every day — today, yesterday, any past day, tomorrow's plan — uses the same screen and actions.
3. **Guidance, not bookkeeping.** The app suggests, checks and balances; the pantry is optional context, never inventory work.
4. **Supportive by construction.** No red, no streaks to lose, nothing decreases; overages are neutral facts with a next step.
5. **Every pixel finished.** No floating text buttons, no text-glyph icons, no default browser widgets, every empty state designed.

## 3. Information architecture

```
Tab bar:  Hoy · Cocina · (+) · Jardín · Progreso
          (+) = "Anotar comida": describe (type, dictate, photo, recent) for the open meal of the shown day
```

| Screen | Content |
|---|---|
| **Hoy** | Day title + week strip (tap a day; ‹ › and a calendar for older days; tomorrow is a planning view) → current meal card (one tap "Me lo comí") → one banner (plan renewal, reminders, or the game card: "¿Y ayer?", Monday recap) → "Tu día" (today's plant, type gauges, balancing note) → the day's meals timeline (+ Extra). Past days show the same timeline with one-tap "Anotar" per meal. |
| **Cocina** | Segmented *Despensa / Platos / Lista*. Despensa: "¿Qué me hago?" with a meal picker and ≤ 3 ideas → pantry grouped by food type; one tap toggles have/out, the info button opens what it counts as. Platos: your dishes with favorites. Lista: checklist, empty state, share. |
| **Jardín** | Season garden scene (one plant per day, real species, growth stages, visitors) → level, flowers, species, stamps → Herbario (collection) → Estampas → past seasons → Estilo. |
| **Progreso** | Weight: trend, chart, projection, "¿Funciona tu plan?" → season numbers and shareable report for your nutri → weight history → Mi plan, Ajustes. |

Old `/historia…` URLs (including past push links) redirect to their new homes.

### 3.1 Day navigation
`selectedDay` defaults to the app day and resets when the app returns after 30 min. Past-day logs use source `backfill` and the slot's planned time, so learned meal times stay clean. Days before the first plan are disabled. Tomorrow shows the suggested menu with ⟳ per meal and "Guardar menú".

### 3.2 "Tu día"
Per type: eaten ÷ the day's planned total (normalized with the plan's swap rules). The plant grows with each logged occasion. Tapping opens the day sheet: per-type bars, per-meal breakdown, balancing explanation and its switch.

### 3.3 Cuadrar el día (owner request; overrides roadmap §3.5 default)
- On by default; off in Ajustes; a plan that explicitly forbids it wins.
- Accounting uses the plan's slot targets. Net difference per type = resolved meals + extras − their planned targets (a skipped or light meal offsets an overage).
- Only **overages** are balanced, only in **carbohydrates, sugars, fats, fruit and dairy**. Protein, legumes and vegetables are never reduced (satiety and nutrition).
- Reductions go to the remaining meals, largest target first, whole units when possible, and never more than **half** of a meal's target for that type. What can't be absorbed shows as a neutral "+n hoy". Unders are never carried forward and nothing carries into tomorrow.
- Logged meals keep their target snapshot (database trigger), so history never changes.
- Copy never says "compensar"; it says "cuadrar".

## 4. Design system

**Feel:** warm paper, rosa mexicano, tactile coins, a living garden. Calm surfaces so the food colors carry the screen.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F3F1` | `#121013` | App background |
| `--surface` | `#FFFFFF` | `#1D191F` | Cards, sheets |
| `--surface-2` | `#F1EBE9` | `#28222A` | Wells, chips, tracks |
| `--ink` / `--ink-2` / `--ink-3` | `#1F1720` / `#5F5562` / `#8D838F` | `#F6F0F5` / `#BBB0BC` / `#8E8490` | Text tiers (ink-3, 3.6:1, only for icons, chart marks and placeholders; text uses ink-2) |
| `--line` | `#E9E1E3` | `#322A34` | Hairlines |
| `--accent` | `#E4007C` | same | Primary actions, selection (white text ≥ 4.5:1) |
| `--accent-ink` | `#B8005F` | `#FF7AB8` | Accent text (≥ 4.5:1) |
| `--gold` | `#F2B705` | same | Día redondo, rare finds |
| Food types | carb `#F5A524`, prot `#7C5CFF`, dairy `#3BA3F5`, fruit `#F0525A`, veg `#22B573`, fat `#6E9A2C`, nuts `#A47148`, sugar `#C08CF5`, legume `#B5523B` | same | Coins, gauges only |

- **Type:** system rounded (SF Pro Rounded on iPhone), no web fonts. Display 34/40·800, Title 28/34·800, Headline 20/26·700, Body 17/24·400–600, Subhead 15/20, Footnote 13/18. Tabular numbers.
- **Space:** 4-pt grid (4 8 12 16 20 24 32 40). Screen gutter 16; card padding 16; section gap 24.
- **Shape:** radius 10 chips-small, 14 inputs/tiles, 18 buttons, 24 cards, 30 sheets, full for coins and pills.
- **Elevation:** e1 cards `0 1px 2px /5%, 0 6px 20px /6%`; e2 floating (tab bar, toast, FAB) `0 2px 6px /8%, 0 12px 32px /14%`; e3 sheets.
- **Motion:** `--spring cubic-bezier(.34,1.56,.64,1)`, `--out cubic-bezier(.22,1,.36,1)`; 120/180/260/420 ms. Sheets slide and fade out; tabs cross-fade (View Transitions when supported); coins pop with a 60 ms stagger; plants grow per stage; reduced motion → 150 ms fades, no particles.
- **Components:** primary / tonal / neutral / icon buttons (all with containers, ≥ 44 px, primary 56 px); segmented control with sliding thumb; chips (filter, toggle, input); list rows; switches; steppers with icons; progress bars and rings; bottom sheet with grabber, sticky footer and drag-to-dismiss; toast with undo and timer; empty states with an illustration and one action.
- **Coins (fichas):** grouped per food type in a tinted capsule. Empty = inset socket with a faint emoji; full = raised coin with highlight; half = half coin; extra = coin outside the capsule with a "+" badge. Never color alone: the emoji is always present.
- **Icons:** Lucide only. No text glyphs.
- **Focus:** visible rings only for keyboard input.

## 5. Rewards (habit loop 2.0)

- **Every log:** coins drop into their sockets with marimba notes (synthesized), haptic ticks, and today's plant grows a stage.
- **Variable rewards:** today's species is a secret until it blooms (third occasion, or two by day's end). ~12 % of blooms are rare (orquídea, loto, magnolia). New species unlock with levels; seasonal ones appear for Día de Muertos and Navidad. Each first discovery gets a reveal card with a one-line fact.
- **Collection:** Herbario (23 species), Estampas (12), levels with unlock previews.
- **Visitors:** bees on full days, a butterfly on Día redondo, monarchs when a week has ≥ 5 days with ≥ 2 meals. Missing days stay seeds — never wilted.
- **Day close:** full bloom moment, chord, week of plants, then tomorrow's menu in one tap.
- **Belonging:** the garden is yours, seasons follow your plans, the voice is a CDMX friend.
- Everything still rewards logging, planning and returning — never eating less (R8, R9).

### Weight (owner request; extends roadmap M7)

- Entry: big number with ±0.1 steppers and direct typing, prefilled with the last weigh-in; date chips (Hoy, Ayer, calendar); source (en casa / con tu nutri). Edit and delete from history.
- Trend: local linear smoothing over ±14 days (no lag while losing, unlike a moving average). Rate: least-squares slope over the last 28 days with an 80 % interval (≥ 4 weigh-ins over ≥ 10 days). Projection: 4 weeks, widening band.
- Signal "¿Funciona tu plan?": *bajando* (interval below zero), *estable*, *subiendo*, *aún no se sabe*, or *faltan datos*; very fast loss suggests talking to your nutri. Neutral colors, no goal line. Weight stays out of Today, toasts and push.

## 6. Verification against the audit

Checked at release 1.0.0. Test evidence and production results are in `PROGRESS.md`; browser tests run on WebKit (iPhone 13) and Chromium (Pixel 7, 4× CPU).

| Audit item | Resolution | Evidence |
|---|---|---|
| S1-1 No way to change the day | Week strip with each day's plant, ‹ ›, calendar; past days log, edit and skip with their planned time; tomorrow is a planning view | `redesign.spec` "any day"; A14, A15; production smoke "day strip" |
| S1-2 No day view; balancing could empty a meal | "Tu día" gauges + day sheet; capped balancing (½ of a target at most, never protein/legumes/vegetables), switch in the sheet and Ajustes | `balance.test` (8 cases); `redesign.spec` "cuadrar el día" |
| S1-3 Pantry "?" did nothing | Food sheet: what it counts as, link to any plan food, change the link, AI retry, "siempre tengo", remove | `redesign.spec` "pantry"; A13 |
| S1-4 Weight only today, raw value as "your weight" | Dated entries with edit/delete; trend (local linear), 28-day rate with 80 % interval, projection, "¿Funciona tu plan?" | `weight.test`; `redesign.spec` "weight"; A16 |
| S1-5 Empty "Me falta" card | Lista tab with a designed empty state | `kitchen.spec`; visual QA `09-kitchen-list` |
| S1-6 Ideas locked to the current meal | Meal picker in Cocina; repeated names show their time | A12; visual QA `07-kitchen` |
| S1-7 Focus rings after taps | Rings only after keyboard use | `story.spec` keyboard focus; visual QA |
| S2-1 Floating text buttons | Every action has a container (primary / tonal / neutral / ghost / icon) | Visual QA, light and dark |
| S2-2 Text glyphs as icons | Lucide icons only | Code search: no glyph is used as an icon (→ and × remain only as typography inside text) |
| S2-3 Tokens read as disabled | Coins in tinted capsules; empty = socket with the type emoji; extra coin with a badge | Visual QA `01-today` |
| S2-4 One flower for every day | 23 species, growth stages, rare and seasonal finds, herbarium, visitors | `species.test`; garden snapshots |
| S2-5 Pantry pills | Rows grouped by food type, one-tap have/out, food sheet | A13; visual QA `07-kitchen` |
| S2-6 Native `<progress>` | Custom bars and rings | Visual QA |
| S2-7 "1/7" week dots | Removed; counts only grow; weekly recap counts days, never "n de 7" | Copy lint; code search |
| S2-8 Floating "Describir" bar | Central (+) in the tab bar | All core-loop tests |
| S2-9 Meal sheet without hierarchy | Icon tiles: describe, photo, build, from pantry, skip, extra | A10, A11, A20 |
| S2-10 No exit animations | Sheets slide out (210 ms), tabs cross-fade; reduced motion respected | Visual QA |
| S2-11 Uneven cards; current meal didn't lead | Spacing/radius tokens; the meal card comes first | Visual QA; startup layout test |
| S2-12 Unlabeled pending button | "Anotar" pill with its slot in the name | A10; Lighthouse label/name |
| S2-13 Small celebrations, sine beeps | Marimba synthesis, bloom moments, confetti / papel picado, day-close moment | Day-close tests |
| S2-14 Thin weight line in `<details>` | Chart with trend, projection band, tooltip, legend, history list | Visual QA `14-progress`; dataviz validator |
| S2-15 Unstyled settings | Rows, switches, segmented controls | Visual QA `16-settings` |
| S3-1 "nutriólogo/a" | "tu nutri" everywhere | Copy lint |
| S3-2 Vague labels | "Anotar comida", "Me lo comí", "Lo de siempre", "Para mañana" | Copy lint (button length) |
| S3-3 Names didn't match labels | Content-based names (day cells, pantry rows, menu rows, stamps tile) | Lighthouse `label-content-name-mismatch` = 1 |
| S3-4 Low-contrast emoji and text | Sockets carry the type's color ring and capsule tint, with the emoji still visible; rows have a text alternative; small text uses `--ink-2` (≥ 4.5:1) | Lighthouse accessibility 100 |
| S3-5 Fixed label column, tiny numbers | Flexible layouts; garden numbers ≥ 10 px in `--ink-2` | Visual QA |
| S3-6 Season label lost in compact mode | Season and day in the Jardín header | Visual QA `10-garden` |
| Punishing mechanics | No fractions of a week, no "pendiente", overages are neutral facts; balancing toasts only when balancing really applies | Copy lint (banned words); `redesign.spec` |
