# Fichas 1.2 — "¿Cómo voy?" Audit and redesign of Hoy

> **Audience:** the owner, and any agent continuing the build.
> **Status:** implemented in release 1.2.0 (2026-10-21). Overrides `03-redesign.md` where they conflict (noted inline).
> **Source:** the owner's 2026-10-21 brief and four screenshots of 1.1.1 (Hoy at 2 pm, the Desayuno sheet, "piña con pollo" in Describe, the day's meals).

## 1. The brief, in one paragraph

Fichas exists to register meals and compare them with the nutritionist's plan: am I eating more or less, which groups are fine, which are over, which are missing. 1.1.1 had the answers somewhere, but buried under information nobody reads. People don't count coins; they need one thing at a time, the right thing at the right moment. There are two moments of use — **deciding** (before a meal: how am I doing, what should I eat) and **recording** (after a meal: write it down fast) — and the interface has to know which one it is.

## 2. Audit of 1.1.1

**(O)** = reported by the owner. Every item is resolved in 1.2 (§6).

| # | Where | Problem |
|---|---|---|
| 1 | Hoy | **(O)** At 2 pm the hero card suggested the 1 pm snack: advice for a meal already eaten. Suggestions and logging shared one card regardless of the clock. |
| 2 | Hoy | **(O)** "Leche · 1 tz leche · 1 tz piña · ½ chocolate" was not a dish anyone eats. Root cause: `suggest()` fitted the owner's dish "Leche" to the snack's target and **added** foods to make it fit (fit allowed up to 3 changes, additions included). The same bug produced "Leche: 90 g carne de res · 2 tortillas…" in the Desayuno sheet. |
| 3 | Hoy | **(O)** "tu clásico" was meaningless; "Me lo comí" logged a dish the owner never chose; ⇄ shuffled unwanted AI picks. |
| 4 | Hoy | **(O)** "¿Y ayer? · Lo de siempre" logged an unknown dish without saying which. |
| 5 | Hoy | **(O)** "Tu día" sat below the suggestion; "0/7 · 0/10" rings didn't say ahead, behind, or what to change. |
| 6 | Hoy | **(O)** Each meal row carried a capsule of coins; reading the day meant counting ~40 coins. |
| 7 | Meal sheet | **(O)** Six "Tus platos" (duplicates, wrong titles, re-portioned past the screen) when the owner came to log. |
| 8 | Describe | **(O)** One bare field and no feedback while typing; JEV not integrated. |
| 9 | Describe | **(O)** "Que cuadre" and "Solo checaba" unclear; "supuse" spoke as "yo". "Contra tu comida" coins had to be counted. |
| 10 | Copy | **(O)** The app spoke in first person: "Supuse", "Te escucho…", "No pude", "Ajusto", "Cuadramos", "Lo leo yo". |
| 11 | Rewards | **(O)** Flowers worked as a record, not as a reward; logging felt flat. |
| 12 | Meal sheet | A photo chosen from the meal sheet never reached Describe (`photo` was not passed through `renderSheet`). |
| 13 | Describe | Offline descriptions for a past day were logged to today. |
| 14 | Day sheet | "Nunca toco proteína…" (first person) and "Mañana, borrón y cuenta nueva" (already rejected in 1.0) were still shipped. |

## 3. "Tu día": one tank per food group

The first card on Hoy. Built on `balanceDay`, so every screen agrees (`shared/domain/daystatus.ts`).

- **Tanks.** One per type the plan uses (or the day touched). Height = the day's plan; fill = eaten (resolved meals normalized with the plan's swaps, plus extras); thin separators = one ficha each, so a full tank reads at a glance without counting. Food colors only here and on coins.
- **Number on top = what's left today** (the decision number: "¿me como otra tortilla?"). A ✓ when it's exactly used; a dark "+n" pill when the whole day is over.
- **Pace notch.** A short dark line at the plan's amount for the meals already resolved: fill above the line = ahead, below = behind. Explained in the day sheet.
- **One line, in words.** `paceLines()`:
  - nothing resolved → "Día en blanco"
  - within ½ of plan everywhere → "Vas en plan" (or "Día redondo" when every meal is in)
  - ahead → "Llevas 1 🫓 de más" + **the change, in food**: "Para cuadrar: 1 tortilla menos en la cena." The amount comes from the owner's most-used equivalent of that type (`amountOf`). Types that are never balanced (protein, legumes, vegetables) say "Lo demás de tu día sigue igual."
  - behind → "Llevas 1 🍗 de menos" + "Aún quedan 6 🍗 para hoy."
  - both → "1 🫓 de más, 1 🍗 de menos" + the balancing line.
- Tanks fill with a spring and float "+n" over each tank that just received food (the reward of every log is seeing the day move).

## 4. The now card: decide before, record after

`buildDayVM` picks the meal that matters (`currentSlot`, unchanged) and its **phase** from the clock:

| Phase | When | Shows | Actions |
|---|---|---|---|
| **plan** | before the meal's (learned) time | "Lo que sigue · Comida 5 pm", the balancing change for this meal ("1 tortilla menos para cuadrar tu día."), one real dish | **Me late** (keeps it as this meal's plan), ⇄ other idea, "Checar un antojo" |
| **log** | from the meal's time | "¿Qué comiste?" / "¿Qué desayunaste?" / "¿Qué cenaste?" and a field-like button "Escribe o dicta" + 📷 | Me la salté. With a planned dish: **Me lo comí** (1 tap) or "Otra cosa". |
| logged | 1.8 s after logging | a stamp (gold when exactly on plan: "Justo en plan"), the meal's verdict, and the level bar moving | — |

- **Me late closes the loop.** It writes the dish as an accepted menu row (`planDish`); at meal time "Me lo comí" logs exactly that. Tomorrow's menu feeds the same path. A one-tap log only ever logs something the owner chose.
- **Ideas are real dishes.** `suggest()` may now change portions or drop a food, never add one (regression test with the owner's "Leche" case). Accepted menus keep priority. No source tag ("tu clásico") is shown; "Planeado" is the only label.
- Older open meals stay in the list with a "+" that opens Describe for that meal — never a blind log.

## 5. Describe: live understanding, JEV, one button

- **Local first, instantly.** `parseItems` runs on every keystroke; known foods appear as rows with their coin, portion and −/+ (no "Ver porciones" step).
- **JEV (TypeSafe System One).** Phrases the table doesn't know (`unknownPhrases`: "chilaquiles", "agua de jamaica") go to `POST /api/ai/classify` 350 ms after typing stops. The Worker asks System One eleven typed yes/no questions per phrase (is it food, is it free, and one per food group) and returns the groups; the row shows 🫓 🥑 immediately with "Calculando porciones…". 70–500 ms, ~US$0.0004 per phrase, cached per normalized phrase in `ai_cache`, 300/hour per session, best effort (a failed phrase is simply left out). JEV never sets portions.
- **Meal AI after a pause.** 900 ms after typing stops, if unknown phrases remain, the existing `/api/ai/parse` (OpenRouter, cached) decomposes the whole text; its items replace the rows. "Anotar" before it answers waits for it; offline it keeps the description to count later (existing deferred path, now with the right day).
- **Impact, with the same picture as Hoy.** A verdict sentence ("Justo lo de tu comida", "+1 🫓 sobre tu comida", "A tu colación le quedan 1 🥜"), the effect on later meals ("La cena queda con 1 tortilla menos."), and small tanks with the new food striped on top. Dimmed while portions are still being counted.
- **Two modes.** `log` ("¿Qué comiste?", footer **Anotar**, or **Me la salté** while empty) and `check` ("¿Qué se te antoja?", from the now card): same preview, plus "Con 2 tortillas queda justo. [Ajustar]" and footer **Me late**. "Que cuadre" and "Solo checaba" are gone: adjusting what was already eaten would falsify the log, and closing the sheet is how you "just check".
- Enter/"Listo" hides the keyboard; it never logs.
- Write, dictate (🎤), photo (📷) or build by hand (▦) from the same field.

## 6. Other changes

- **Meal sheet** (logged meals only): the meal and its verdict, portion steppers, delete, and "Agregar algo más": Describir · Foto · Armar. The dish list, "Lo que tengo", "Extra" and "Me la salté" tiles are gone (each lives where it's needed).
- **Meal list**: one line per meal — indicator, name, time, what was eaten — and a verdict chip ("✓ En plan", "+1 🫓", "−1 🍗"). No coin capsules. Open past meals show "Sin anotar" and a "+".
- **Yesterday**: "Ayer quedaron 3 sin anotar · Ver ayer". Logging happens on that day's screen, with Describe.
- **Copy voice**: the app never speaks as yo/nosotros. Buttons in the owner's voice ("Me lo comí", "Me la salté") stay. `copy-lint` now rejects first-person app phrases ("supuse", "no pude", "te aviso", "ajusto", "cuadramos", …).
- **Rewards**: tanks filling with "+n", a stamp per logged meal (gold when exact), the level bar in the logged moment, the plant in the week strip. Nothing ever decreases; overages remain neutral facts with a next step.
- **What's new** sheet "Fichas, más simple" for devices upgrading from a v2/v3 Today snapshot.

## 7. Interaction budgets (browser tests)

| Flow | Taps | Test |
|---|---|---|
| See how the day is going | 0 | `core-loop` A1 |
| Before a meal: keep the idea | 1 ("Me late") | A2 |
| After it: log the planned dish | 1 ("Me lo comí") | A2 |
| Log anything else | 2 + text | A4, `describe` A5 |
| Check a craving / make it exact | 1 + text / 1 | `describe` A6, A7 |
| Skip | 1 (now card) / 2 (list) | A10 |
| Yesterday: find and log a meal | 2 + text | `game` A15 |

Today's visible-word budget moves from 20 to 25: "¿cómo voy?" in words is the point of the screen (the earlier budget assumed a coin-only answer).

## 8. Configuration

- `JEV_API_KEY` — Worker secret (already set by the owner in Cloudflare). Without it `/api/ai/classify` returns 503 and Describe simply shows no groups.
- `JEV_BASE_URL` (default `https://api.typesafe.ai`) and `JEV_MODEL` (default `jev-latest`) — Wrangler vars, so another compatible JEV endpoint can be used without code changes.
- Production verification (`npm run verify:production -- <photo>`) now asserts that `/api/ai/classify` answers 200 and prints JEV's groups for "3 tacos de bistec".
