# Fichas — Technical Roadmap

> **Audience:** an LLM coding agent building the product from an empty repo, with no other context.
> **Status:** Implementation authorized and active. Software through M8 is present; physical-device and real-use acceptance remain open (§20).
> **Precedence:** owner's explicit instructions > this document > your own judgment. Where this document says **MUST**, it is an acceptance criterion.

> **Implementation handoff (2026-10-09):** see [PROGRESS.md](PROGRESS.md) for the recovered state, verification evidence, production deployment and remaining milestone gates. Operational instructions are in [RUNBOOK.md](RUNBOOK.md); the remaining phone checks are in [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md). The owner authorized implementation and Cloudflare deployment; no GitHub push is authorized.

---

## 0. Ground rules for the builder

1. **Priority when trade-offs appear:** (1) speed and low friction, (2) the pull to come back (rewards without anxiety), (3) everything else.
2. **The nutritionist's plan is the source of truth.** Never invent targets, calories, macros or medical advice. The app counts and suggests within the plan.
3. **Interaction budgets (§14.2) and text budgets (§14.3) are acceptance criteria.** A milestone is not done if a budget fails.
4. **Every user-facing string** lives in `src/client/copy/es-MX.ts` and passes `npm run copy:lint` (§14.5).
5. **Build milestone by milestone (§18).** Do not start a milestone before the previous one passes. Report with the template in §18.9.
6. **Ask the owner for inputs only when a milestone needs them (§19), all at once.**
7. **Never commit secrets or personal health data (§15).**
8. **Dependencies:** latest stable versions at build time, exact versions pinned. Set `compatibility_date` to the build date. Where an API named here has changed, follow the current official docs and note it in `docs/DECISIONS.md`.
9. **When this document is silent,** choose the option with fewer taps, fewer words and fewer moving parts; record it as one line in `docs/DECISIONS.md`.
10. **Language:** UI copy in Mexican Spanish (es-MX, casual "tú"). Code, comments, commit messages and docs in English.

---

## 1. Product in one page

- **What:** "Fichas", a single-user installable PWA. It turns the owner's nutritionist plan (food-exchange units per meal) into colored tokens, opens on the current meal with a ready dish that fits, logs meals in one tap, counts any described food against the plan, suggests meals from what's in the kitchen, adopts a new plan every ~15 days with history intact, and makes logging rewarding without shame.
- **Owner:** one person in Mexico City (timezone `America/Mexico_City`), iPhone assumed (design for iOS Safari installed web app; Android must also work). Plan language: Spanish.
- **Core loop:** open → current meal card with tokens + a pre-portioned suggestion → tap ✓ → token "pop" + progress. Everything else is secondary.
- **In scope:** Today (core loop), describe/check with AI, plan upload and versioning (seasons), habit loop (day close, tomorrow's menu, garden, stamps, levels), kitchen (pantry → ideas, shopping list), push nudges, story (recaps, weight check-ins, nutritionist report), offline-first.
- **Food origin (owner clarified):** logging and checking MUST work for home cooking, street food, restaurants and takeout independently of pantry inventory. Kitchen inventory is optional context for meal suggestions; it must never limit which foods can be described, checked or logged. Unknown ingredients or portions are marked estimated/assumed and remain adjustable.
- **Out of scope (v1):** calories/macros, barcode scanning, food-database search UI, chatbot, social/leaderboards, breakable streaks, water and exercise tracking (displayed from the plan only), app-icon badges, multiple users, native apps.

---

## 2. Evidence → design rules

These rules come from the Stage 1 research. They explain *why*; do not "improve" a mechanic in a way that breaks its rule.

| # | Rule | Evidence | Enforced in |
|---|------|----------|-------------|
| R1 | Optimize logging **frequency**, not detail. A day "counts" at ≥2 logged eating occasions. | Harvey 2019 *Obesity* (visits/day, not minutes, predicted loss); Turner-McGrievy 2019 *JAND* (≥2 occasions/day best adherence marker); Burke 2011; Patel 2021 *Obesity* review | §11, §14.2, §14.6 |
| R2 | Logging must survive "bad" meals: no judgment, no red, reward honesty. | Cordeiro 2015 *CHI* (negative nudges make people stop journaling) | §14.5, §14.6 |
| R3 | No breakable streaks; misses roll off; comebacks are celebrated. | Silverman & Barasch 2023 *JCR* (broken streaks reduce re-engagement); Lally 2010 *EJSP* (single misses don't derail habits) | §14.6 |
| R4 | Flexible, not all-or-nothing: each meal is independent; the next meal is a clean slate; self-compassionate copy. | Palascha 2015 (dichotomous thinking → regain); Westenhoefer 1999 (flexible vs rigid control); Adams & Leary 2007 (self-compassion reduces post-slip eating) | §3.5, §14.5 |
| R5 | Decide before hunger: default suggestions, tomorrow's menu, shopping list. | VanEpps 2016 *JMR* (advance ordering → fewer kcal); Wing 1996 *IJO* (meal plans + grocery lists → more loss) | §11 |
| R6 | Make the plan-compliant option the easiest one (defaults, pre-portioning, one-tap fit). | Cadario & Chandon 2020 *Mkt Sci* (behavioral nudges d≈0.39 vs informational d≈0.12); Jachimowicz 2019 (defaults) | §11.2, §14.1 |
| R7 | At most 3 options per choice. | Chernev 2015 *JCP* (overload with hard tasks and effort-minimizing goals) | §11, §14.1 |
| R8 | Rewards are informational and unexpected; never expected, tangible, "earned" prizes. | Deci, Koestner & Ryan 1999 *Psych Bull*; Ryan, Rigby & Przybylski 2006 | §14.6 |
| R9 | Game mechanics only reward logging, planning and coming back. | eClinicalMedicine 2024 meta-analysis (gamified apps ≈ +0.7 kg); Kurtzman 2018 LOSE IT (gamification alone no better than control); Mazeas 2022 *JMIR* | §14.6 |
| R10 | Use fresh starts: every new plan is a new season. | Dai, Milkman & Riis 2014 *Mgmt Sci* | §9, §14.6 |
| R11 | Notifications: few, timed to real meal times, only when needed, decaying. | Bidargaddi 2018 (+3.9% engagement); Klasnja 2019 (effect fades) | §13 |
| R12 | No tempting food imagery; tokens and emoji only. | Boswell & Kober 2016 (food cues/craving predict eating; images as potent as real food) | §14.7 |
| R13 | No calories anywhere. | Simpson & Mazzeo 2017; Levinson 2017 (calorie trackers and ED symptoms); Hahn 2021 (no harm in general population, but no need to add risk) | §14.5 lint |
| R14 | Low burden for years: weight regain is the norm, appetite pushes back. | Anderson 2001 *AJCN*; Polidori 2016; Sumithran 2011 *NEJM*; Thomas 2014 (NWCR) | §14.2 |
| R15 | Text/dictation first; photos optional. | Silverman et al. 2022 *JACR* (photos harder, less logged) | §10, M8 |
| R16 | Prefer high-volume equivalents when showing alternatives ("rinde más"). | Rolls, energy-density literature | §11.6 |

---

## 3. Domain model

### 3.1 Unit types

A **unit** ("ficha") is one exchange of the nutritionist's system. Each unit has a **type**:

| TypeKey | Label (es) | Short | Emoji | Color token |
|---|---|---|---|---|
| `carb_sg` | Carbohidrato sin grasa | carbo | 🫓 | `--t-carb` |
| `carb_cg` | Carbohidrato con grasa | carbo c/grasa | 🥐 | `--t-carb` |
| `protein_poa` | Proteína animal (POA) | prote | 🍗 | `--t-prot` |
| `legume` | Leguminosa (POV) | leguminosa | 🫘 | `--t-leg` |
| `dairy` | Lácteo | lácteo | 🥛 | `--t-dairy` |
| `fruit` | Fruta | fruta | 🍎 | `--t-fruit` |
| `veg` | Verdura | verdura | 🥦 | `--t-veg` |
| `sugar_sg` | Azúcar sin grasa | azúcar | 🍬 | `--t-sugar` |
| `sugar_cg` | Azúcar con grasa | azúcar c/grasa | 🍫 | `--t-sugar` |
| `fat_sp` | Grasa sin proteína | grasa | 🥑 | `--t-fat` |
| `fat_cp` | Grasa con proteína | grasa c/prote | 🥜 | `--t-fatp` |

Mapping from the nutritionist's meal-grid columns (template used in the current PDF):
Carbohidratos `s/g`→`carb_sg`, `c/g`→`carb_cg` · Proteínas `POA`→`protein_poa`, `Leg`→`legume`, `Lácteo`→`dairy` · Vitaminas y minerales `Fruta`→`fruit`, `Verdura`→`veg` · Azúcares `s/g`→`sugar_sg`, `c/g`→`sugar_cg` · Grasas `s/g`→`fat_sp` (sin proteína), `c/g`→`fat_cp` (con proteína).

Display order everywhere: `carb_sg, carb_cg, protein_poa, legume, dairy, fruit, veg, sugar_sg, sugar_cg, fat_sp, fat_cp`.

### 3.2 Plan, slots, equivalents

- **Plan** = one nutritionist document, immutable once confirmed, stored as `PlanV1` JSON (§6.3).
- **Slot** = an eating moment (Desayuno, Colación, Comida, Colación, Cena). Has `key`, `label`, `time`, `target` (units per type), optional nutritionist `example`.
  - `key`: slug of the source label; duplicates get `_1`, `_2` (current plan: `desayuno`, `colacion_1`, `comida`, `colacion_2`, `cena`).
  - `label`: source label with trailing digits removed when unique ("Cena 2" → "Cena"); duplicate labels keep the same text and the UI disambiguates with the time ("Colación · 1 pm").
- **Equivalent** = one food with the portion that equals one unit of its type (e.g., `tortilla de maíz`, 1 `pza` = 1 `carb_sg`). One row per food (a PDF line listing 3 foods becomes 3 equivalents).
- **Free foods** count as zero units.
- **Extra** = an unplanned eating occasion (slot key `extra`); its units count toward the day but have no target.

### 3.3 Units math

```
unitsOf(item):
  if item.equivalent_id:
    e = plan.equivalents[item.equivalent_id]
    q = convert(item.qty, item.unit → e.unit)        // see conversions; fail → treat as estimated
    return { [e.type]: q / e.qty }
  else return item.units                              // AI estimate, flagged estimated=true
```

Conversions: `1 tza = 16 cda`, `1 cda = 3 cdta`, `1 tza = 240 ml`. `g` only converts to `g`; `pza`, `reb`, `lata`, `paquete`, `barra`, `disparo`, `mitad` only to themselves. Store exact numbers; display rounded to the nearest ¼ with glyphs (¼ ½ ¾). Never display more than 2 decimals anywhere.

### 3.4 Swap normalization

Some eaten types can stand in for planned types. Rules live in `plan.swaps`; defaults are inserted at plan creation with `confirmed: false` (the owner confirms with the nutritionist; until then they still apply, and the plan view shows "por confirmar").

| kind | from | to | Meaning |
|---|---|---|---|
| `decompose` | `carb_cg` | `{carb_sg: 1, fat_sp: 1}` | A "con grasa" carb is a carb plus a fat |
| `decompose` | `sugar_cg` | `{sugar_sg: 1, fat_sp: 1}` | Same for sugars |
| `substitute` | `fat_cp` | `{fat_sp: 1}` | Nuts/seeds can fill a regular-fat slot |
| `substitute` | `fat_sp` | `{fat_cp: 1}` | Regular fat can fill a nut/seed slot |

```
normalize(E: Units, T: Units, rules): Units
  E' = copy(E)
  for r in rules where r.kind == 'decompose':
    surplus = max(0, E'[r.from] - (T[r.from] ?? 0))
    if surplus > 0:
      E'[r.from] -= surplus
      for (k, m) in r.to: E'[k] += surplus * m
  for r in rules where r.kind == 'substitute':          // only fills shortfalls
    (k, m) = single entry of r.to
    surplus   = max(0, E'[r.from] - (T[r.from] ?? 0))
    shortfall = max(0, (T[k] ?? 0) - E'[k])
    moved = min(surplus, shortfall / m)
    E'[r.from] -= moved; E'[k] += moved * m
  return E'
```

### 3.5 Status

For a slot with target `T` and the sum of its meal logs `E`: `N = normalize(E, T)`; for every type in `T ∪ N`, `d = N[t] − T[t]`.

- **over**: any `d ≥ 0.5` · **under**: any `d ≤ −0.5` · **on**: neither · **mixed**: both.
- Status labels are information only. They never change colors to red, never trigger sounds of failure, and never reduce rewards for logging.
- `extra` slots: status `extra`. Logs of only free foods: kind `free`, status `free`. Skipped slot: kind `skip`, status `skip`.
- **Eating occasion** = a log with `kind = 'meal'` and total units > 0.
- **Day with flower** = ≥1 occasion. **Week dot full** = ≥2 occasions; half = 1.
- **Casa llena** = every planned slot has ≥1 meal log. **Día redondo** = every planned slot's status is `on`.
- Units never move between slots unless `plan.rules.rebalance_within_day = 'allowed'` (owner-confirmed). Default `'unknown'` behaves as not allowed.
- If `'allowed'` ("cuadrar el día"): the next unresolved planned slot shows its target adjusted by the day's running delta per type (never below 0), marked "↔"; extras are charged to that next slot. The logged `target` snapshot stores the adjusted target.

### 3.6 App day and current slot

- **App day** = local date of `(now − 4 h)` in the owner's timezone (a 00:40 snack belongs to the previous day).
- **Slot time** = learned median log time for that slot over the last 14 days (needs ≥3 samples), else the plan time, else defaults (desayuno 08:30, comida 14:30, cena 20:30; colaciones at the midpoint of their neighbors).
- **Windows:** each slot owns the interval from the midpoint with the previous slot to the midpoint with the next one; the first starts at 04:00, the last ends at 04:00 next day.
- **Current slot** = the first unresolved planned slot whose window contains now; if that slot is resolved, the next unresolved slot. Earlier unresolved slots show a "pendiente" row with a one-tap ✓.
- A slot is **resolved** when it has ≥1 meal or skip log.

### 3.7 Seasons

- Season *n* = the confirmed plan with `season = n`. Active from `starts_on` to `ends_on` (inclusive; `ends_on` is set when the next plan is confirmed).
- New logs take the `plan_id` of the plan active on their app day. Logs are never re-pointed. Each log stores a snapshot of its slot target, so history renders identically forever.
- Season day index = days since `starts_on` + 1.

### 3.8 Worked examples (MUST be unit tests)

Using the seed plan (Appendix A):

1. Every nutritionist example (all options) computes exactly to its slot target → status `on`.
2. Comida: 3 tortillas de maíz + 120 g pollo + 1 tza verdura cocida + 1 manzana + 2 cdta aceite → `carb_sg +1` → `over`.
3. Comida: 2 tortillas de harina + 120 g pollo + 1 tza verdura cocida + 1 manzana → `carb_cg 2` decomposes to `carb_sg 2, fat_sp 2` → `on`.
4. Same as 3 plus 2 cdta aceite → `fat_sp +2` → `over`.
5. Comida with 10 almendras + 1 cdta aceite instead of 2 cdta aceite → `fat_cp 1` substitutes → `on`.
6. Colación 1 with ⅓ aguacate instead of ½ chocolate sin azúcar → `fat_sp 1` substitutes into `fat_cp` → `on`.
7. Colación 2 with café only → kind `free`; slot remains unresolved.
8. Cena with ½ tza arroz cocido (2) + 1 tortilla (1) + 90 g pollo + ½ tza verdura + 2 cdta aceite → `on`.
9. Log at 00:40 on 16 Oct → app day 15 Oct.
10. Breakfast skipped, then 2 meals logged → week dot full; not Casa llena.

---

## 4. Architecture and stack

```
iPhone (installed PWA)
 ├─ UI: Preact + @preact/signals + Tailwind CSS v4
 ├─ Local store: IndexedDB (Dexie) ── renders everything; works offline
 ├─ Outbox ──► POST /api/sync (background, retried)
 └─ Service worker: app-shell precache, push + notificationclick
                │  HTTPS, same origin
Cloudflare Worker (Hono)   +   Workers Static Assets (SPA)
 ├─ D1 (SQLite): plans, logs, recipes, pantry, menus, weigh-ins, achievements, settings, push subs, AI cache
 ├─ KV: original plan files (PDF/images), weekly backups
 ├─ Cron trigger (*/15 min): nudges, plan reminder, weekly backup
 └─ OpenRouter (HTTPS): food-text parsing, plan reading, pantry ideas, photos
```

| Decision | Choice | Why |
|---|---|---|
| Hosting | One Cloudflare Worker serving static assets + `/api/*` | Required stack; one deploy; same origin (no CORS); free tier fits one user |
| Build | Vite + `@cloudflare/vite-plugin` | One config builds client and Worker; dev runs the Worker in workerd with local D1/KV |
| UI | Preact + signals + TypeScript (strict) | React API with ~4 KB runtime; fast cold start on iOS |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), tokens in CSS variables | Small CSS output; predictable for an LLM builder |
| Local data | Dexie (IndexedDB) | Offline-first, live queries, instant reads |
| API | Hono on Workers, Zod validation | Small, typed, Workers-native |
| DB | D1 with SQL migrations (`wrangler d1 migrations`) | Required; plain SQL is transparent and versioned |
| Files | Workers KV (`FILES`) | Write-once files (~2 MB, every 15 days); no payment method needed (R2 may require one) |
| PWA | `vite-plugin-pwa` with `injectManifest` (custom SW) | Precache + push handlers in one SW |
| Push | Web Push + VAPID via a Web-Crypto library (`@pushforge/builder` or equivalent) | Classic `web-push` depends on Node crypto that Workers lack |
| AI | OpenRouter (OpenAI-compatible) with JSON-schema structured outputs | Model choice by eval, swappable via env vars; JEV unused in v1 (§10.8) |
| Icons | `lucide-preact` for UI chrome; emoji for unit types | Tree-shaken SVG; emoji are free, instant, universal |
| Tests | Vitest, `@cloudflare/vitest-pool-workers`, Playwright, Lighthouse CI | Unit, Worker integration, mobile E2E with tap/time budgets |
| Lint/format | Biome | One fast tool |

**Workers Free plan constraints** (design within them): 10 ms CPU per request and per cron run; D1 free: 5 M rows read and 100 k rows written per day, 500 MB per database; 5 cron triggers per account. Keep CPU low: no base64 encoding or large JSON parsing in the Worker (§9.2), no heavy libraries server-side. If CPU-limit errors (1102) appear in logs, tell the owner that Workers Paid (US$5/month) removes them with no code change.

---

## 5. Repository layout

```
/
├─ docs/
│  ├─ 01-product-strategy.html     # Stage 1, for the owner
│  ├─ 02-technical-roadmap.md      # this file
│  ├─ DECISIONS.md                 # one line per decision taken while building
│  └─ RUNBOOK.md                   # owner-facing ops: pairing, new plan, restore (M8)
├─ private/                        # GITIGNORED. Plan PDFs and personal files
├─ migrations/                     # 0001_init.sql, 0002_… (D1)
├─ seed/plan-2026-10-08.json       # Appendix A as PlanV1 JSON
├─ evals/
│  ├─ parse-cases.json             # Appendix D
│  └─ plan-golden.json             # = seed/plan-2026-10-08.json slots + equivalent rows
├─ scripts/                        # seed-plan.ts, copy-lint.ts, eval-parse.ts, eval-plan.ts,
│                                  # gen-vapid.ts, gen-icons.ts, check-secrets.ts
├─ public/                         # icon.svg, generated PNG icons, _headers
├─ src/
│  ├─ shared/                      # pure TS, used by client and worker, 100% unit-tested
│  │  ├─ domain/ types.ts plan-schema.ts units.ts swaps.ts status.ts day.ts slots.ts
│  │  │          suggest.ts fit.ts pantry-solver.ts matcher.ts diff.ts
│  │  ├─ game/   momentum.ts stamps.ts levels.ts surprise.ts garden.ts
│  │  └─ api.ts  (request/response types + Zod schemas)
│  ├─ worker/
│  │  ├─ index.ts                  # Hono app + scheduled()
│  │  ├─ routes/ auth.ts sync.ts ai.ts plans.ts push.ts export.ts telemetry.ts
│  │  └─ lib/    db.ts session.ts openrouter.ts prompts/ plan-ingest.ts push.ts
│  │             scheduler.ts backup.ts ratelimit.ts
│  └─ client/
│     ├─ main.tsx app.tsx router.tsx
│     ├─ db/ dexie.ts sync.ts outbox.ts snapshot.ts
│     ├─ state/ signals.ts selectors.ts clock.ts
│     ├─ screens/ Today.tsx Kitchen.tsx Story.tsx PlanView.tsx PlanReview.tsx Pair.tsx Settings.tsx
│     ├─ sheets/ MealSheet.tsx Describe.tsx Composer.tsx DayClose.tsx Tomorrow.tsx TokenInfo.tsx
│     ├─ components/ Token.tsx TokenRow.tsx MealCard.tsx SlotRow.tsx Flower.tsx Garden.tsx
│     │              WeekDots.tsx StampSheet.tsx LevelBar.tsx Toast.tsx Stepper.tsx Chip.tsx Sheet.tsx TabBar.tsx
│     ├─ feedback/ sound.ts haptics.ts confetti.ts celebrate.ts
│     ├─ copy/ es-MX.ts pick.ts
│     ├─ styles/ tokens.css motion.css app.css
│     └─ sw.ts
├─ tests/ unit/ worker/ e2e/
├─ index.html  vite.config.ts  wrangler.jsonc  tsconfig.json  biome.json  package.json
├─ .gitignore  .env.example  .dev.vars.example
```

---

## 6. Data model

### 6.1 D1 schema — `migrations/0001_init.sql`

Every synced row carries `rev` (global monotonic counter from `meta`), `updated_at` (server ms) and, where deletable, `deleted_at` (soft delete). Timestamps are integer ms since epoch. Dates (`day`, `starts_on`) are `YYYY-MM-DD` app days.

```sql
CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO meta (key, value) VALUES ('rev', 0);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,          -- sha256(token) hex
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE auth_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX auth_attempts_ip_at ON auth_attempts (ip, at);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  season INTEGER,                           -- set on confirm
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived','discarded')),
  issued_on TEXT,
  starts_on TEXT,
  ends_on TEXT,
  data TEXT NOT NULL,                       -- PlanV1 JSON ('{}' while a draft is parsing); immutable after confirm
  source_keys TEXT NOT NULL DEFAULT '[]',   -- KV keys of original files
  source_sha256 TEXT,
  parse_report TEXT NOT NULL DEFAULT '{}',  -- models, timings, disagreements, warnings
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);
CREATE UNIQUE INDEX plans_one_active ON plans (status) WHERE status = 'active';
CREATE INDEX plans_rev ON plans (rev);

CREATE TABLE logs (
  id TEXT PRIMARY KEY,                      -- client UUID
  plan_id TEXT NOT NULL,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,                       -- slot key or 'extra'
  kind TEXT NOT NULL CHECK (kind IN ('meal','skip','free')),
  title TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',         -- LogItem[]
  raw_units TEXT NOT NULL DEFAULT '{}',     -- before swaps
  units TEXT NOT NULL DEFAULT '{}',         -- after swaps (normalized against target)
  target TEXT NOT NULL DEFAULT '{}',        -- snapshot of slot target at log time
  status TEXT NOT NULL CHECK (status IN ('on','over','under','mixed','extra','skip','free')),
  source TEXT NOT NULL CHECK (source IN ('suggestion','recent','describe','compose','pantry','menu','backfill','photo','push')),
  recipe_id TEXT,
  eaten_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX logs_day ON logs (day);
CREATE INDEX logs_rev ON logs (rev);
CREATE INDEX logs_plan ON logs (plan_id);

CREATE TABLE recipes (                      -- "Tus platos"
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  items TEXT NOT NULL,                      -- LogItem[] (real-food quantities, last version eaten)
  fingerprint TEXT NOT NULL,                -- sorted equivalent ids / normalized labels
  slot_counts TEXT NOT NULL DEFAULT '{}',   -- {slotKey: n}
  times INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'log' CHECK (origin IN ('log','seed','ai')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE UNIQUE INDEX recipes_fp ON recipes (fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX recipes_rev ON recipes (rev);

CREATE TABLE pantry (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  equivalent_ids TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('have','out')),
  on_list INTEGER NOT NULL DEFAULT 0,       -- shopping list flag
  staple INTEGER NOT NULL DEFAULT 0,        -- assumed available unless 'out' (aceite, sal…)
  checked_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX pantry_rev ON pantry (rev);

CREATE TABLE menus (                        -- planned meals ("Mañana")
  id TEXT PRIMARY KEY,                      -- `${day}:${slot}`
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  title TEXT NOT NULL,
  items TEXT NOT NULL,
  recipe_id TEXT,
  accepted_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX menus_day ON menus (day);
CREATE INDEX menus_rev ON menus (rev);

CREATE TABLE weighins (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  kg REAL NOT NULL CHECK (kg > 20 AND kg < 400),
  source TEXT NOT NULL CHECK (source IN ('nutritionist','home')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX weighins_rev ON weighins (rev);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,                      -- `${kind}:${key}:${season ?? 'life'}`
  kind TEXT NOT NULL CHECK (kind IN ('stamp','level','unlock','surprise')),
  key TEXT NOT NULL,
  season INTEGER,
  earned_at INTEGER NOT NULL,
  seen_at INTEGER,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);
CREATE INDEX achievements_rev ON achievements (rev);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                      -- JSON
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('slot','plan','test')),
  day TEXT NOT NULL,
  slot TEXT,
  plan_id TEXT,
  sent_at INTEGER NOT NULL,
  acted_at INTEGER                          -- set when a log for that slot arrives within 3 h
);
CREATE INDEX notifications_day ON notifications (day);

CREATE TABLE ai_cache (
  key TEXT PRIMARY KEY,                     -- sha256(job|model|prompt_version|plan_id|normalized input)
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ai_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0);

CREATE TABLE client_errors (id TEXT PRIMARY KEY, at INTEGER NOT NULL, message TEXT NOT NULL, stack TEXT, ctx TEXT);
CREATE TABLE ux_events (id TEXT PRIMARY KEY, at INTEGER NOT NULL, name TEXT NOT NULL, ms INTEGER, taps INTEGER, ctx TEXT);
```

Client-writable through sync: `logs, recipes, pantry, menus, weighins, achievements, settings`. Server-written only: `plans` (via plan endpoints) and every other table.

### 6.2 IndexedDB (Dexie) schema

```ts
db.version(1).stores({
  plans: 'id, status, starts_on, rev',
  logs: 'id, day, [day+slot], plan_id, rev',
  recipes: 'id, fingerprint, last_used_at, rev',
  pantry: 'id, state, rev',
  menus: 'id, day, rev',
  weighins: 'id, day, rev',
  achievements: 'id, kind, season, rev',
  settings: 'key',
  outbox: '++seq, table, id',
  local: 'key',          // sync cursor, today snapshot, copy-picker memory, UI prefs (never synced)
  pending: 'id',         // describe requests waiting for network
});
```

Rows mirror D1 rows with JSON columns already parsed.

### 6.3 PlanV1 (Zod, `src/shared/domain/plan-schema.ts`)

```ts
export const TypeKey = z.enum(['carb_sg','carb_cg','protein_poa','legume','dairy','fruit','veg','sugar_sg','sugar_cg','fat_sp','fat_cp']);
export const Units = z.partialRecord(TypeKey, z.number().min(0).max(30));
export const Unit = z.enum(['pza','tza','cda','cdta','g','ml','reb','lata','paquete','barra','disparo','mitad']);

export const Equivalent = z.object({
  id: z.string(),                        // `${type}.${slug(food)}`, e.g. 'carb_sg.tortilla_de_maiz'
  type: TypeKey,
  food: z.string(),                      // singular, lowercase Spanish: 'tortilla de maíz'
  qty: z.number().positive(),            // amount equal to ONE unit
  unit: Unit,
  aliases: z.array(z.string()).default([]),
  note: z.string().nullable().default(null),
  source: z.enum(['table','example','owner']).default('table'),
  flag: z.enum(['check_portion']).nullable().default(null),   // shown as "revisa con tu nutrióloga"
});

export const ExampleOption = z.object({ equivalent_id: z.string(), qty: z.number().positive(), unit: Unit });
export const ExampleItem = z.object({ text: z.string(), options: z.array(ExampleOption).min(1) }); // options = "pollo/bistec/pescado"

export const Slot = z.object({
  key: z.string(),
  label: z.string(),
  source_label: z.string(),
  kind: z.enum(['meal','snack']),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  target: Units,
  example: z.object({ title: z.string(), items: z.array(ExampleItem) }).nullable(),
});

export const SwapRule = z.object({
  kind: z.enum(['decompose','substitute']),
  from: TypeKey,
  to: Units,
  confirmed: z.boolean(),
  source: z.enum(['default','plan','owner']),
});

export const PlanV1 = z.object({
  schema: z.literal(1),
  issued_on: z.string().nullable(),
  next_appointment: z.string().nullable(),
  fluids_ml: z.number().nullable(),
  exercise: z.string().nullable(),
  notes: z.array(z.string()),
  slots: z.array(Slot).min(1),
  equivalents: z.array(Equivalent).min(1),
  free_foods: z.array(z.string()),
  swaps: z.array(SwapRule),
  rules: z.object({ rebalance_within_day: z.enum(['unknown','allowed','not_allowed']) }),
});
```

(Use the Zod major available at build time; adapt `partialRecord` if the API differs.)

### 6.4 Other shapes

```ts
type LogItem = {
  label: string;                 // what the user sees: "120 g pollo"
  qty: number; unit: string;     // real-food amount
  equivalent_id: string | null;
  units: Units;                  // raw units of this item
  estimated: boolean;            // food not in the plan table; AI analogy
  assumed_qty: boolean;          // amount not stated by the user
  free: boolean;
};
type Suggestion = { title: string; items: LogItem[]; recipe_id?: string; origin: 'menu'|'recipe'|'seed'|'pantry'|'ai'; changes: FitChange[] };
type FitChange = { item_index: number; from_qty: number; to_qty: number } | { added: LogItem } | { removed_index: number };
```

### 6.5 Settings keys (JSON values)

| key | default | notes |
|---|---|---|
| `tz` | `"America/Mexico_City"` | Owner timezone; also used by cron |
| `day_start_hour` | `4` | App-day boundary |
| `sound` / `haptics` | `true` / `true` | |
| `notifications` | `{enabled:false, paused_until:null, quiet:["22:30","09:00"], slots:{}}` | `slots[key]=false` disables one slot |
| `rebalance` | `"unknown"` | Mirrors plan rule; owner sets after asking the nutritionist |
| `style` | `{petal:"clasica", theme:"rosa", token:"clasico", celebration:"confeti"}` | Cosmetic unlocks |
| `onboarding` | `{install_hint:false, notif_asked:[], token_hint:false}` | |
| `last_closed_day` | `null` | Day-close ritual bookkeeping |

---

## 7. Sync protocol

- **Pull:** `GET /api/sync?since=<rev>` → `{ rev, more, changes: { plans:[], logs:[], recipes:[], pantry:[], menus:[], weighins:[], achievements:[], settings:[] } }` with rows where `rev > since`, max 2,000 rows per call (`more: true` → call again).
- **Push:** `POST /api/sync` with `{ mutations: [{ table, op: 'upsert'|'delete', row }] }` (max 200). The server validates each row with Zod, then runs one D1 batch (atomic):
  1. `UPDATE meta SET value = value + 1 WHERE key = 'rev';`
  2. per row: `INSERT … ON CONFLICT(id) DO UPDATE SET …, updated_at = :now, rev = (SELECT value FROM meta WHERE key='rev')`. Deletes set `deleted_at`.
  Returns `{ rev }`. Idempotent by row id; last write wins (single owner).
- **Client:** every write goes to Dexie and the `outbox` in one transaction; UI updates from Dexie immediately. Flush the outbox debounced 400 ms after a write, on `visibilitychange` → visible, on `online`, and every 60 s while visible. Exponential backoff (1 s → 60 s). After a push, pull.
- **Network never blocks UI.** No spinner ever waits on sync.
- **First run on a device:** full pull, then render. Show the pairing screen only if `/api/sync` returns 401.

---

## 8. API surface

All JSON under `/api`. Session cookie required except where noted. Mutating requests require header `X-Fichas: 1` (CSRF guard). Errors: `{ error: { code, message } }` with proper HTTP status.

| Method | Path | Purpose | Request → Response |
|---|---|---|---|
| GET | `/api/health` (no auth) | Liveness | → `{ ok, version }` |
| POST | `/api/auth/pair` (no auth, rate-limited) | Pair a device | `{ code, label }` → 204 + `Set-Cookie: sid` |
| POST | `/api/auth/logout` | Revoke this session | → 204 |
| GET | `/api/sync?since=` | Pull | §7 |
| POST | `/api/sync` | Push | §7 |
| POST | `/api/ai/parse` | Food text → items | `{ text, slot, day }` → `ParseResult` |
| POST | `/api/ai/pantry` | Free text → pantry items | `{ text }` → `{ items: [{ label, equivalent_ids }] }` |
| POST | `/api/ai/ideas` | Dish ideas from pantry | `{ slot, day, have: string[], remaining: Units }` → `{ ideas: Suggestion[] }` |
| POST | `/api/ai/photo` (M8) | Meal photo → items | raw base64 JPEG body, `?slot=` → `ParseResult` |
| POST | `/api/plans/drafts` | Create upload draft | `{ files: [{ name, type, size }] }` → `{ draft_id }` |
| PUT | `/api/plans/drafts/:id/files/:n` | Upload one file | raw base64 text body (`text/plain`) → 204 |
| POST | `/api/plans/drafts/:id/parse` | Read plan (dual read) | → `{ plan, report, diff }` (may take 30–90 s) |
| GET | `/api/plans/drafts/latest` | Resume after disconnect | → `{ draft_id, status, plan?, report?, diff? }` |
| POST | `/api/plans/:id/confirm` | Activate | `{ plan, starts_on, weighin_kg? }` → `{ season, plan }` |
| POST | `/api/plans/:id/discard` | Drop a draft | → 204 |
| GET | `/api/plans/:id/files/:n` | Original file | → bytes with original content type |
| GET | `/api/push/vapid` | VAPID public key | → `{ key }` |
| POST | `/api/push/subscribe` | Save subscription | `PushSubscriptionJSON` → 204 |
| DELETE | `/api/push/subscribe` | Remove | `{ endpoint }` → 204 |
| POST | `/api/push/test` | Send a test push | → 204 |
| GET | `/api/export` | Full JSON export | → all synced tables + plans |
| POST | `/api/telemetry` | Client errors + UX events (batched) | `{ errors:[], ux:[] }` → 204 |

```ts
type ParseResult = {
  title: string; items: LogItem[];
  confidence: 'high'|'medium'|'low';
  source: 'local'|'cache'|'ai'; model?: string; ms: number;
};
```

Rate limits (per session, sliding hour, stored in D1): `auth/pair` 5/IP, `ai/*` 60, `plans/*/parse` 6. Daily AI cap: 400 calls (`ai_usage`); beyond it, AI routes return `429` and the client falls back to local matching + composer.

---

## 9. Plan ingestion and versioning

### 9.1 Flow

1. Owner taps **"Subir plan nuevo"** (Story → Mi plan, or the plan-renewal card/push). File picker accepts `application/pdf,image/*`, multiple files (PDF or photos of the printed plan).
2. Client prepares files: PDFs as-is; images resized to ≤1,600 px long edge, JPEG q=0.8. Client base64-encodes each file.
3. `POST /api/plans/drafts` → `draft_id`; `PUT …/files/:n` with the base64 text as the raw body (Worker stores it in KV `plan-src/<draft_id>/<n>` without decoding or parsing).
4. `POST …/parse`: the Worker builds both OpenRouter request bodies **by string concatenation** around the stored base64 (no JSON parse/encode of the file), sends them in parallel to `MODEL_PLAN_A` and `MODEL_PLAN_B` (§10.4), and uses `ctx.waitUntil` so a client disconnect doesn't lose the result. The draft (status, outputs) is written to D1 as soon as it's ready; the client can resume with `GET …/drafts/latest`.
5. Server post-processing (deterministic):
   - Validate each read against `PlanParseV1` (§10.4); expand `equivalent_rows` into one `Equivalent` per food with ids and aliases (alias dictionary in `src/shared/domain/aliases.ts`); map example texts to `ExampleItem`s with the local matcher (§11.5), falling back to one `MODEL_FAST` call for unmatched lines.
   - Insert default swaps (§3.4) unless the plan states its own; `rules.rebalance_within_day = 'unknown'` unless the plan states it.
   - **Consistency checks** (warnings, never silent fixes): values are multiples of 0.5 in [0, 12]; every target type has ≥1 equivalent; each slot's example sums to its target (after swaps); times parse; portion sanity check against the reference ranges in `aliases.ts` (flag `check_portion`).
   - **Dual-read comparison:** every slot target cell, slot time, and every equivalent row (type, qty, unit, food set). Agreement → accepted. Disagreement → recorded in `report.disagreements` with both values. If one read fails, use the other and mark every field "single read".
   - **Diff vs active plan** (`src/shared/domain/diff.ts`): per slot added/removed/time changed/target deltas per type; equivalents added/removed/qty changed; notes/fluids/exercise changes.
6. **Review screen** (§14.1 PlanReview): token rows per slot with changes highlighted; disagreements shown as two tappable chips ("¿2 o 3?") that MUST be resolved before confirming; any target editable with steppers; equivalents changes collapsed ("12 cambios en equivalentes"); notes; start date chips; optional weigh-in.
7. **Start date default:** "Hoy" if the owner has no meal logs today, else "Mañana". Never earlier than the active plan's `starts_on` + 1 unless the active plan has zero logs (then it is replaced and marked `discarded`).
8. `POST /api/plans/:id/confirm` (one D1 batch): previous active → `archived` with `ends_on = starts_on − 1 day`; draft → `active` with `season = max(season) + 1`, `starts_on`, final `data`, `confirmed_at`; optional weigh-in row (`source: 'nutritionist'`); all with a new `rev`.
9. Client: season transition (§14.6) → Today. Suggestions re-portion automatically through auto-fit (§11.2); no batch migration of recipes is needed.

### 9.2 Integrity rules (MUST be tested)

- Confirmed plans are immutable (`data` never updated after `confirmed_at`).
- Logs keep their `plan_id` and `target` snapshot forever; past days render with their own snapshot.
- Exactly one `active` plan (enforced by the partial unique index).
- Uploading the same file twice is detected by `source_sha256` and offered as "Ya tienes este plan".
- Original files remain downloadable from Mi plan → Planes anteriores.

---

## 10. AI integration

### 10.1 Jobs

| Job | Endpoint | Model var | Input | Output | Latency target | Cache |
|---|---|---|---|---|---|---|
| Parse food text | `/api/ai/parse` | `MODEL_FAST` | text + compact plan table | `ParseResult` | p50 ≤ 2.0 s, p95 ≤ 4.5 s | yes, per plan |
| Normalize pantry text | `/api/ai/pantry` | `MODEL_FAST` | text + compact table | labels + equivalent ids | p50 ≤ 2 s | yes |
| Dish ideas | `/api/ai/ideas` | `MODEL_FAST` | available foods + remaining units | ≤3 dishes | p50 ≤ 3 s | yes, 30 days |
| Read plan (×2) | `/api/plans/drafts/:id/parse` | `MODEL_PLAN_A`, `MODEL_PLAN_B` | PDF/images | `PlanParseV1` | ≤ 90 s total | by file hash |
| Map example lines (fallback) | internal | `MODEL_FAST` | lines + table | ExampleItems | ≤ 5 s | yes |
| Meal photo (M8) | `/api/ai/photo` | `MODEL_VISION` | JPEG | `ParseResult` | p50 ≤ 4 s | no |

The server **always recomputes units** from `equivalent_id` and quantity (§3.3). The model's own unit numbers are used only for items with `equivalent_id = null` (marked `estimated`).

### 10.2 OpenRouter request template

```http
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer ${OPENROUTER_API_KEY}
HTTP-Referer: https://<app host>
X-Title: Fichas
Content-Type: application/json

{
  "model": "<MODEL_*>",
  "messages": [ … ],
  "response_format": { "type": "json_schema", "json_schema": { "name": "<job>", "strict": true, "schema": { … } } },
  "provider": { "require_parameters": true, "data_collection": "deny", "sort": "latency" },
  "temperature": 0,
  "max_tokens": <per job>
}
```

- PDF parts: `{ "type": "file", "file": { "filename": "plan.pdf", "file_data": "data:application/pdf;base64,…" } }` with `"plugins": [{ "id": "file-parser", "pdf": { "engine": "native" } }]` so the model *sees* the page (the meal grid is a visual table; text extraction scrambles it). Images: `{ "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,…" } }`.
- Base URL comes from `OPENROUTER_BASE_URL` (default above) so tests can point to a mock.
- Timeouts: parse 12 s, ideas 15 s, plan 120 s. One retry on network error/5xx/invalid JSON, then fail gracefully.
- Fallbacks: parse failure → local matcher result if any, else composer pre-filled with the text; ideas failure → deterministic ideas only (they are shown first anyway); plan failure → "No pude leerlo. Prueba con fotos." with retry.

### 10.3 Caching

`key = sha256(job | model | PROMPT_VERSION | plan_id | normalize(input))`, where `normalize` lowercases, strips accents and extra spaces. Hits return in ≤ 300 ms (target) and increment `hits`. Bump `PROMPT_VERSION` whenever a prompt changes.

### 10.4 Plan-reading output schema (`PlanParseV1`)

```json
{
  "issued_on": "YYYY-MM-DD|null",
  "next_appointment": "YYYY-MM-DD|null",
  "fluids_ml": 3000,
  "exercise": "string|null",
  "notes": ["string"],
  "slots": [ { "source_label": "Desayuno", "time": "11:00",
               "target": { "carb_sg": 2, "protein_poa": 3, "veg": 1, "fat_sp": 2 },
               "example_lines": ["2 tortillas de maíz", "3 huevos", "1/2 taza de verdura", "1 cdta de aceite + 1/3 de aguacate"] } ],
  "equivalent_rows": [ { "type": "carb_sg", "qty": 0.25, "unit": "tza", "foods": ["amaranto", "arroz cocido", "quinoa cocida"], "note": null } ],
  "free_foods": ["café", "té"]
}
```

Compact rows keep output short (fast). Prompt: Appendix B1. Golden test: reading the current PDF MUST reproduce Appendix A slot targets and times exactly, and ≥ 95% of equivalent rows; any mismatch must appear as a dual-read disagreement or consistency warning (never silently wrong).

### 10.5 Model selection (do this in M2 and M3, record in DECISIONS.md)

1. `GET https://openrouter.ai/api/v1/models`; shortlist models whose `supported_parameters` include `structured_outputs` (and `file`/`image` input for plan/vision jobs).
2. **Fast tier** candidates: the current Gemini Flash-class, Claude Haiku-class and GPT mini-class models. Run `npm run eval:parse -- --models a,b,c` (Appendix D). Pick the cheapest model with exact-case accuracy ≥ 95%, composite-case accuracy ≥ 80%, p50 ≤ 2.0 s, p95 ≤ 4.5 s.
3. **Plan readers:** two strong vision models from different providers that accept PDFs natively (e.g., the current Claude Sonnet-class and Gemini Pro-class). Run `npm run eval:plan` on `private/` PDF; both must pass the golden test alone.
4. Set `MODEL_FAST`, `MODEL_PLAN_A`, `MODEL_PLAN_B`, `MODEL_VISION` as Wrangler vars. Re-run evals when changing models.

### 10.6 Cost guard

Expected cost: < US$2/month (≈150 parses/month on a fast model, 2 plan reads per 15 days). Ask the owner to set a monthly credit limit on the OpenRouter key (e.g., US$10). Daily cap of 400 calls server-side.

### 10.7 Prompts

Appendix B. Spanish-language system prompts for food jobs; English for plan reading. Prompts never include the owner's name.

### 10.8 JEV

JEV (the owner's non-LLM AI) is **not used in v1**; every job works with OpenRouter. If the owner provides JEV docs, evaluate it behind the same `AiProvider` interface (`run(job, input) → output`) for jobs where it might win (speech-to-text, image recognition, embedding-based food matching), using the same eval sets, and adopt it only if it beats the OpenRouter baseline.

---

## 11. Suggestion and fitting engine (`src/shared/domain`)

All functions are pure, deterministic and unit-tested. They run on the client (instant, offline).

### 11.1 `suggest(slotKey, day, ctx) → Suggestion[]` (max 3)

Candidates and base scores:

| Source | Score |
|---|---|
| Accepted menu for `(day, slot)` | +100 (always first) |
| Recipe used in this slot | `10·log2(1+count_in_slot) + 6·e^(−days_since_last/14) + 3·(eaten in this slot on the same weekday in last 28 days) + 4·pantry_ok − 8·(already eaten today)` |
| Seed recipe (nutritionist example) | 5 |
| Recipe from another slot that fits after ≤2 changes | `2·log2(1+times)` |

`pantry_ok` = every item's equivalent is `have`, `staple`, or unknown to the pantry. Every candidate passes through `fit()` against the slot's **remaining** target (target minus what's already logged in that slot). Drop candidates that can't reach `on` with ≤3 changes, unless none remain. Deduplicate by fingerprint. "↻ Otra" cycles the 3; after the third it opens the meal sheet.

### 11.2 `fit(items, target, plan, history) → { items, changes }`

```
repeat up to 3 times:
  N = normalize(sum(unitsOf(items)), target)
  for each type t with |N[t] − target[t]| ≥ 0.25, largest |delta| first:
    if over: take the item contributing most to t; reduce its qty by delta in its own unit,
             rounded to its natural step; if qty ≤ 0, remove it
    if under: if an item of type t exists, increase it; else add the owner's most-used
              equivalent of type t (history → slot example → first equivalent of t) with qty = |delta|·e.qty
never add sugar_* or carb_cg items; never add fat_cp to fill fat_sp (or the reverse) unless already present
```

Natural steps: `pza` → the equivalent's own fraction (⅓, ½) or 1; `tza` → ¼; `cda`/`cdta` → ½; `g` → 10 g; `reb` → 1; others → equivalent qty. Changed quantities are returned so the UI can highlight them.

### 11.3 `ideasFromPantry(have, remaining, ctx) → Suggestion[]` (max 3)

1. For each type `t` with `remaining[t] > 0`: candidates = equivalents of type `t` whose food matches a `have` or `staple` pantry item, ordered by personal use, then table order.
2. Combos: top-2 candidates for the two largest remaining types × top-1 for the others (≤4 combos). Types with no candidate get a "falta 🥦" marker and rank lower.
3. Quantities: `remaining[t] · e.qty` per chosen equivalent.
4. Score: matches an existing recipe +5; ingredient pairs seen together in history +2; all types covered +3.
5. Title: existing recipe title, else `"{proteína} con {carbo}"` (e.g., "Pollo con tortillas"). AI ideas (§10.1) may add creative names; each AI idea is re-validated with `unitsOf` + `fit`, and discarded if it can't reach `on`.
6. Deterministic ideas render in ≤ 300 ms; AI ideas append when ready (never reorder what the owner is looking at).

### 11.4 `planTomorrow(day) → menu`

For each planned slot: top `suggest()` result for that day, excluding a recipe already chosen for another slot of the same day, penalizing items marked `out`. Shown in the day-close ritual; accepting writes `menus` rows with `accepted_at`.

### 11.5 `matchText(text, plan, recipes)` — local fast path

Normalize (lowercase, strip accents, simple singularization), parse quantities (`2`, `dos`, `un/una`, `medio/media`, `½`, `1/2`, `1 1/2`), units (`taza(s)/tz`, `cucharada(s)/cda`, `cucharadita(s)/cdta`, `g/gr/gramos`, `pieza(s)/pza`, `rebanada(s)/reb`, `lata`), match foods against equivalent `food` + `aliases` and recipe titles. If every non-stopword token is consumed → `ParseResult` with `source: 'local'`, `confidence: 'high'`, no network. Otherwise call AI. While typing (debounced 250 ms), show up to 3 local matches as chips.

### 11.6 Token info ("¿a qué equivale?")

Tapping a token shows the top 5 equivalents of that type by personal use, then table order, each with its portion. Items with large volume per unit (`tza ≥ 1`, `pza ≥ 2`, `palomitas`, raw vegetables) carry a small "rinde más" tag (R16). "Ver todo" opens the plan's full list for that type.

---

## 12. PWA requirements

- **Manifest:** `name: "Fichas"`, `short_name: "Fichas"`, `display: "standalone"`, `start_url: "/?src=pwa"`, `scope: "/"`, `background_color`/`theme_color` from tokens (light), `lang: "es-MX"`, icons 192, 512, 512 maskable; plus `apple-touch-icon` 180 and `theme-color` metas for light and dark. Icons generated from `public/icon.svg` (rosa mexicano rounded square with three stacked white tokens) by `scripts/gen-icons.ts`.
- **Service worker** (`src/client/sw.ts`, `injectManifest`): precache the app shell; navigation requests → precached `index.html`; `/api/*` → network only (data lives in IndexedDB); `push` and `notificationclick` handlers (§13). `registerType: 'autoUpdate'`: new versions activate on next launch, with no "update available" prompt.
- **Headers** (`public/_headers`): hashed assets `Cache-Control: public, max-age=31536000, immutable`; `/sw.js` and `/index.html` `no-cache`; security headers (§15).
- **Offline:** every core action (A1–A4, A8–A11, A13–A15, A20) MUST work in airplane mode. Describe offline: run the local matcher; if incomplete, save to `pending` with copy "Sin internet. Lo cuento al rato." and count the occasion immediately (kind `meal`, title = text, units filled when parsed).
- **iOS specifics:** push only works for the installed app (iOS 16.4+), and permission must be requested from a tap. On first open in Safari (not standalone), show a one-time install sheet with the Share → "Agregar a inicio" steps. After install, call `navigator.storage.persist()`.
- **Performance budgets:** initial JS ≤ 90 KB gzip; CSS ≤ 15 KB gzip; precache total ≤ 400 KB; no web fonts (system rounded stack). Lazy-load Kitchen, Story, PlanReview, Describe, DayClose and confetti, prefetched on idle after first paint.
- **Snapshot-first render:** persist the last Today view model in `localStorage` (`today:snapshot`, versioned) and render it synchronously in `main.tsx` before Dexie resolves; reconcile when data arrives. Skip the snapshot if its app day ≠ today.
- **Lighthouse (mobile preset)** MUST score ≥ 95 Performance, ≥ 95 Accessibility, ≥ 95 Best Practices, and pass installability.

---

## 13. Notifications

- **Permission priming:** only after the owner has a day with ≥ 3 logs **and** the app runs standalone. Show a Today card: "¿Te aviso si se te pasa una comida?" [Sí, avísame] [Ahora no]. "Sí" (the tap) → `Notification.requestPermission()` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → `POST /api/push/subscribe`. "Ahora no" → re-offer after 7 days, at most twice in total.
- **Scheduler:** cron `*/15 * * * *` → `scheduled()` loads state and calls the pure function `decideNudges(state, nowUtc) → Push[]`. Rules, all MUST:
  - Owner timezone from settings; respect quiet hours (default 22:30–09:00) and `paused_until`.
  - Slot nudge when: now ∈ [slot_time + 45 min, slot_time + 135 min); slot unresolved; no slot nudge sent today for that slot; < 2 pushes sent today; owner not active in the last 30 min (`sessions.last_seen_at`); slot not backed off; slot not disabled.
  - **Back-off:** a nudge is "ignored" if no log arrives for that slot within 3 h. 3 consecutive ignored nudges for a slot → suppress that slot for 7 days. Any log within 3 h of a nudge resets the counter.
  - **Plan renewal:** when the active plan is ≥ 14 days old and no `plan` push was sent for it → one push at 12:00 local; once more at ≥ 21 days.
  - Never: streak warnings, weight, "no has abierto la app", more than 2 a day, anything during quiet hours.
- **Payload:** `{ title, body, url, tag }`; `tag = "slot:<day>:<slot>"` replaces stale nudges. `url = "/?slot=<key>&src=push"` opens Today focused on that slot with ✓ ready (A19). Copy from §14.5 pools; title ≤ 3 words, body ≤ 8 words.
- **SW:** `push` → `showNotification(title, { body, icon, badge, tag, data: { url } })`; `notificationclick` → focus an existing client and `postMessage({ navigate: url })`, else `clients.openWindow(url)`. No action buttons (unsupported on iOS web push).
- **Sending:** `@pushforge/builder` (or another Web-Crypto Web Push library; verify Workers support at build time). Delete subscriptions on 404/410. Log `notifications` rows; set `acted_at` when a matching log syncs.
- **Settings:** master toggle, pause (1 / 3 / 7 days), per-slot toggles, "Enviar prueba".

---

## 14. Experience spec

### 14.1 Screens and flows

**Tab bar:** `Hoy` · `Cocina` (from M5) · `Historia`. Sheets slide up from the bottom; every sheet closes with a downward swipe or tapping outside. No modal confirmation dialogs anywhere except deleting data; everything else is undoable.

**Pair** (`/emparejar`, first run only): one field "Tu clave", one button "Entrar". Then Today. Then (Safari only) the install sheet.

**Today** (`/`), top to bottom:
1. Header: day ("Jue 15 oct"), season chip ("Temporada 1 · día 8"), week dots (§14.6).
2. Optional single card slot (max one at a time, priority order): plan review pending or plan renewal (plan ≥ 14 days old) > "¿Y ayer?" backfill > Monday recap > notification priming > comeback greeting.
3. **Meal card** for the current slot: label + time with a "›" (tapping the header opens the meal sheet for this slot); target tokens (remaining = hollow, logged = full, extra = "+"); suggestion title + one line of real-food items; primary button "✓ Me lo comí"; secondary "↻ Otra" and "✎ Ajustar" (opens Describe prefilled with the suggestion's items). Tapping a token opens TokenInfo (§11.6).
4. Other slots as compact rows (label, time, token row); done rows show ✓ and full tokens; tapping a row opens the meal sheet for that slot; unresolved past rows show a one-tap "✓".
5. Bottom input "¿Qué vas a comer?" opens Describe with keyboard up. Describe includes optional browser dictation (`es-MX`), with iOS keyboard dictation as fallback, and "Foto del plato". Photo detections appear as editable text/portions; only "Anotar" records them and "Descartar" creates no log. These additions were requested by the owner on 2026-10-08; see `PROGRESS.md` for actual verification.
6. After 20:00, a small "Cerrar el día" link.

**Meal sheet** (tap a slot row or the meal-card header): input at top; if the slot already has logs, they come first with item steppers and a delete control (changes apply live, undoable); up to 6 "Tus platos" for that slot (one tap logs); "Armar" (Composer); "Con lo que tengo" (Kitchen ideas for this slot, from M5); "Me la salté" (skip); "+ Extra" (unplanned occasion).

**Describe** (check or log): text field (`enterkeyhint="done"`); slot chips (default current slot); local match chips while typing; on submit → "thinking tokens" animation ≤ 100 ms → preview: items (assumed amounts marked "supuse", tappable steppers; estimated foods marked "≈"), token comparison vs the slot's remaining target with "+" extras, one status line, buttons "Que cuadre" (auto-fit, shown when not `on`), "Anotar" (primary), "Solo checaba" (text link).

**Composer** (manual/offline): target tokens at top filling live; type tabs for the slot's target types (+ "Otros"); top 8 foods per type by personal use; tap a food = add 1 unit; tap again = +1; steppers on item chips; "Anotar". Title auto-generated from the 2 largest items.

**Kitchen** (`/cocina`, M5): segmented "Tengo" / "Me falta · n". Tengo: pantry chips (tap toggles have/out; out → shopping list), "+ agrega" field (text/dictation → `/api/ai/pantry`), section "¿Qué me hago?" for the current slot with ≤ 3 idea cards ("Anotar" or "Para luego" → menu). Me falta: checklist; checking an item returns it to Tengo.

**Day close** (sheet, §14.6): flower bloom, one line, week dots, "Mañana" card with 5 one-line rows, "Así ✓" / "Cambiar" (tap a row to cycle its alternatives).

**Story** (`/historia`): current season garden; stamps sheet; level bar; "Tus platos" (count → list with favorites); weight (M7); past seasons (M7); links to Mi plan and Ajustes.

**Mi plan** (`/historia/plan`): season and dates; slots with tokens and nutritionist examples; equivalents by type (searchable); free foods; notes; fluids and exercise; swap rules ("por confirmar" / "confirmado"); "Subir plan nuevo"; "Planes anteriores" (read-only, with original files).

**Plan review** (`/plan/nuevo`): §9.1 step 6.

**Ajustes** (`/historia/ajustes`): avisos; sonido; vibración; reglas del plan (rebalance, swaps confirmed); estilo (unlocked cosmetics); dispositivos (sessions, revoke); exportar datos; diagnóstico (p50/p90 of UX events, last 7 days); versión.

### 14.2 Interaction budgets (acceptance criteria)

Taps count user inputs after the start state. Times are wall-clock on an iPhone 12-class device (Playwright: Moto G Power profile with 4× CPU throttle as proxy). p50 is measured over ≥ 20 runs; "hard max" must never be exceeded in tests.

| ID | Action | Start state | Max taps | p50 | Hard max | Instant-feedback requirement |
|---|---|---|---|---|---|---|
| A1 | See current meal's tokens + real-food suggestion | Tap home-screen icon | 0 | 1.0 s | 1.5 s | Snapshot render ≤ 300 ms after JS start |
| A2 | Log the suggested meal | Today | 1 | 2 s | 4 s | Tokens start animating ≤ 100 ms after tap |
| A3 | Log the next suggestion ("↻ Otra" once) | Today | 2 | 4 s | 6 s | Same |
| A4 | Log a recent dish ("Tus platos") | Today | 2 | 5 s | 8 s | Same |
| A5 | Describe and log (typed or dictated) | Today | 3 + input | 10 s | 15 s | Thinking state ≤ 100 ms; preview p50 ≤ 2.5 s |
| A6 | Check without logging | Today | 3 + input | 10 s | 15 s | Same |
| A7 | Fit a preview to the plan | Preview | 1 | 1 s | 2 s | Changed quantities highlighted |
| A8 | Undo the last log | Toast visible | 1 | 1 s | 2 s | Tokens revert ≤ 100 ms |
| A9 | Change a portion of a logged meal | Today | 3 | 6 s | 10 s | Tokens update live |
| A10 | Skip a meal | Today | 2 | 3 s | 5 s | — |
| A11 | Add an extra from recents | Today | 3 | 6 s | 10 s | — |
| A12 | See "¿Qué me hago?" ideas | Today | 1 | 2 s | 4 s | Deterministic ideas ≤ 300 ms |
| A13 | Mark a pantry item out / add an item | Kitchen | 1 per item | 2 s | 4 s | Chip state ≤ 100 ms |
| A14 | Accept tomorrow's menu | Day close | 1 | 3 s | 5 s | — |
| A15 | Backfill a forgotten meal | "¿Y ayer?" card | 1 per meal | 2 s | 4 s | — |
| A16 | Record a weigh-in | Story | 2 | 5 s | 8 s | Wheel prefilled with last value |
| A17 | New plan → active | Mi plan | ≤ 6 + review | 90 s | 180 s | Progress always visible; never a frozen screen |
| A18 | Turn on reminders | Priming card | 2 + OS dialog | 5 s | 8 s | — |
| A19 | Push → logged | Notification | 2 | 4 s | 6 s | Opens on that slot |
| A20 | Compose a new meal manually | Today | ≤ 8 | 15 s | 25 s | Tokens update live |

### 14.3 Text budgets

| Surface | Limit |
|---|---|
| Today (excluding food names, slot and tab labels, numbers, emoji) | ≤ 20 words visible |
| Headlines | ≤ 4 words |
| Toast | ≤ 10 words / 60 characters |
| Button | ≤ 3 words / 16 characters (+ optional icon) |
| Sheet helper text | ≤ 8 words |
| Push | title ≤ 3 words, body ≤ 8 words |
| Day close | ≤ 12 words + menu rows |
| Season recap | ≤ 30 words + numbers |
| Any sentence | ≤ 12 words. No paragraphs in the core loop. |

### 14.4 Feedback and motion

| Moment | Visual | Sound (Web Audio, synthesized) | Haptic |
|---|---|---|---|
| Any tap | `:active` scale .97, ≤ 50 ms | — | — |
| Log (each token) | Fill + scale 1 → 1.28 → 1 (240 ms, `--ease-pop`), 70 ms stagger | Ascending pentatonic notes (C5 D5 E5 G5 A5 C6…), sine, 8 ms attack, 120 ms decay, gain 0.08 | 8 ms per token (`navigator.vibrate`); iOS: one tick via the hidden `<input type="checkbox" switch>` toggle technique when supported, else none |
| Slot `on` | 8-particle sparkle burst in token colors (500 ms) | Final note an octave up | — |
| Extra tokens | "+" tokens appear with a 2× ±4° wiggle (300 ms) | Same notes as any log (never an error sound) | Same |
| Toast | Slides up 180 ms; 2.2 s, or 5 s with "Deshacer" | — | — |
| Surprise / level up | `canvas-confetti` 60 particles, token colors, 1.2 s (lazy-loaded) | Short arpeggio | 3 ticks |
| Stamp earned | Stamp scales 1.6 → 1 with −8° → 0° rotation, 350 ms | Soft "thunk" (low sine, 80 ms) | 1 tick |
| Day close | Petals unfold 120 ms stagger; gold center shimmer if Día redondo | Gentle chord | — |

Reduced motion → crossfades only (150 ms), no scaling, no confetti; sound and haptics follow their own toggles. Audio context is unlocked on the first tap. Animations use transforms/opacity only.

### 14.5 Voice and copy guide

**Who is talking:** a warm, quick-witted friend from CDMX who's on the owner's side. Casual "tú". Plain words. A little playful. Never a coach, never a system.

**Rules**
1. Short: toasts ≤ 10 words; one idea per line.
2. Information + next step, never a verdict ("Un carbo de más. La cena sigue igual.").
3. Praise the behavior (logging, planning, coming back), never the body or eating less.
4. Overages are neutral facts with a calm "+n"; never "excediste", never red.
5. Comebacks are welcomed with zero reference to the gap.
6. Light Mexican colloquialisms ("¡Eso!", "Va", "Al cien", "Sin broncas", "Borrón y cuenta nueva"), max one per line; no forced slang.
7. Emoji: only unit emoji inside lines (🫓 🍎…), plus ✓. No decorative emoji strings.
8. No calories, no diet talk, no medical claims, no "deberías"/"tienes que".

**Do / Don't**

| Moment | Do | Don't |
|---|---|---|
| Over by 1 | "Un carbo de más. Sin drama: borrón y cuenta nueva." | "Excediste tu asignación de carbohidratos." |
| Big meal | "Día de fiesta. Anotado, eso es lo que cuenta." | "Hoy te pasaste mucho. Mañana compénsalo." |
| Under | "Te quedó una 🍎. Es tuya si se te antoja." | "¡Excelente! Comiste menos de lo planeado." |
| Missed days | "¡Volviste! Justo a tiempo para la que sigue." | "Llevas 3 días sin registrar." |
| Reminder | "¿Comida como siempre? Un toque y listo." | "¡No pierdas tu racha! Registra ahora." |
| Error | "No salió. Intenta otra vez." | "Error 500: fallo del servidor." |

**Copy lint (`scripts/copy-lint.ts`, runs in CI and pre-commit):**
- Length limits by key prefix: `toast.*`, `log.*`, `comeback`, `surprise` ≤ 60 chars; `button.*` ≤ 16 chars and ≤ 3 words; `title.*` ≤ 28; `push.title.*` ≤ 24; `push.body.*` ≤ 60; `line.*` ≤ 72.
- Banned (accent- and case-insensitive substrings): `trampa`, `pecado`, `culpa`, `malo`, `mala `, `fallaste`, `fracas`, `excedi`, `exceso`, `prohibid`, `deberías`, `tienes que`, `cuidado`, `advertencia`, `alerta`, `calor`, `kcal`, `racha`, `perdiste`, `no rompas`, `dieta`, `gord`, `flac`, `peso ideal`, `castigo`, `compens`, `macronutri`, `asignaci`, `límite`. Exception: keys under `weight.*` may use "peso".
- At most one "!" per string; no ALL-CAPS words longer than 3 letters.
- Pools for frequent moments (`log.*`, `comeback`, `dayClose.*`, `surprise`, `push.body.*`) have ≥ 5 variants. `pick()` never repeats one of the last 3 variants used for that key.

Full string pools: Appendix C.

### 14.6 Gamification system

**Principles (R1–R3, R8–R10):** gain-framed only; nothing ever decreases; rewards attach to logging, planning, honesty and recovery; unexpected rewards over expected ones; no comparisons; no currency to spend.

**Loop 1 — every log (≤ 1 s): the pop.** §14.4. Copy pool by status: `log.onPlan`, `log.overSmall` (sum of overs ≤ 1), `log.overBig`, `log.under`, `log.mixed`, `log.extra`, `log.free`; `log.firstOfDay` replaces the line for the first occasion of the app day.

**Surprises:** probability 0.12 per meal log, independent of status; never on the first log ever; at most 1 per app day; at least 3 logs since the last one. RNG seeded by log id (testable). Shows confetti + a `surprise` line; recorded as `achievements(kind='surprise')`.

**Loop 2 — every day: day close + tomorrow.**
- Trigger: the last planned slot of the app day becomes resolved; or the first open after 21:30 with ≥ 1 log today; or "Cerrar el día". Once per app day (`last_closed_day`).
- Sequence ≤ 4 s, tap to skip: overlay → today's flower blooms → line (`dayClose.round` / `.full` / `.partial`) → week dots update → "Mañana" card (§11.4). Accept → `tomorrow.accepted` line.

**Week dots (momentum, not a streak):** last 7 app days, today rightmost with a ring. Full = ≥ 2 occasions, half = 1, empty = 0 (light outline, never red). Label "n/7" (full dots). No streak counter exists anywhere.

**Comebacks:** a meal log after ≥ 1 full app day with zero occasions → `comeback` line (always) + "Volviste" stamp (once per season).

**Backfill:** on the first open of an app day, if yesterday has unresolved planned slots, show "¿Y ayer?" with up to 5 rows: "✓ Lo de siempre" (logs the top suggestion, source `backfill`) or "No me acuerdo" (dismisses). Backfilled logs count fully everywhere.

**Monday recap:** first open on Monday: last week's 7 flowers, dots, one line (`week.recap.strong` n ≥ 5, `.ok` 3–4, `.low` ≤ 2). Tap to dismiss.

**Loop 3 — every season: garden, stamps, recap.**

*Garden:* one flower per day of the season (grows if the season runs long). Flower model:
- Petals = planned slots in time order. Petal state: `open` (meal log) colored by the type with the most units in that slot (ties: carb_sg > protein_poa > fruit > veg > dairy > fat_sp > others); `skip` = small neutral dot; `none` = closed green bud petal.
- Center: gold if Día redondo, else warm neutral. Extras: up to 2 leaves on the stem.
- Days with zero logs: all petals closed (a bud). Never wilted, brown or grey-dead.
- Future days: seed mound. Today: gentle sway (±2°, 4 s; off with reduced motion) and a ring.
- Rendered by `Flower.tsx` as SVG from a `FlowerModel` (deterministic; snapshot-tested).

*Stamps* (one sheet per season; each earned once per season):

| key | Name | Emoji | Criterion | Visible |
|---|---|---|---|---|
| `primer_bocado` | Primer bocado | 🥄 | First meal log of the season | yes |
| `casa_llena` | Casa llena | 🏠 | A day where every planned slot has a meal log | yes |
| `dia_redondo` | Día redondo | ⭐ | A day where every planned slot is `on` | yes |
| `planeador` | Planeador | 🗓️ | Accepted tomorrow's menu 3 times | yes |
| `volviste` | Volviste | 👋 | Comeback (see above) | yes |
| `constancia` | Constancia | 🌱 | 10 days in the season with ≥ 2 occasions | yes |
| `chef` | Chef | 🍳 | 3 new dishes added to Tus platos | yes |
| `con_lo_que_hay` | Con lo que hay | 🧺 | Logged a meal from Kitchen ideas | yes (from M5) |
| `sin_filtro` | Sin filtro | 🤝 | Logged a meal ≥ 2 units over its target | hidden |
| `finde` | Finde | 🎉 | ≥ 2 occasions on Saturday and Sunday of one weekend | hidden |
| `martes_de_tacos` | Martes de tacos | 🌮 | Logged a dish with "taco" on a Tuesday | hidden |

Hidden stamps show as "?" until earned. Evaluate after each log and menu acceptance (`src/shared/game/stamps.ts`).

*Season start:* full-screen 2 s moment: "Temporada n" + `season.start` line + a fresh garden of seeds. *Season recap* (M7): garden image + days with flower, meals logged, stamps, highlight line; shareable image.

**Loop 4 — lifetime: levels and unlocks.** XP = lifetime meal logs. Level thresholds: `[0, 10, 25, 50, 80, 120, 170, 230, 300, 380, 470, 570, 680, 800]`, then +130 per level. Level-up → confetti + `level.up` line.

| Level | Unlock |
|---|---|
| 2 | Petal style "Margarita" |
| 3 | Theme "Talavera" (cobalt accents) |
| 4 | Petal style "Dalia" |
| 5 | Celebration "Papel picado" |
| 6 | Petal style "Cempasúchil" |
| 7 | Theme "Noche" |
| 8 | Petal style "Flor de nopal" |
| 9 | Token style "Gema" |
| 10 | Petal style "Nochebuena" |
| 11+ | Alternate accent colors, one per level |

Calendar surprises (for everyone, temporary): 28 Oct–2 Nov cempasúchil petals; 12 Dec–6 Jan nochebuena petals; one `surprise` line on the first open in each window.

**Tus platos (collection with utility):** every meal log upserts a recipe by fingerprint; a new fingerprint shows `log.newDish` once. Cards show emoji tokens, title and "×n". Favorite ★ boosts suggestion score by +6.

**Anti-shame safeguards (MUST, verified by a checklist in M4 and M8):**
1. No red (or "danger" color) on any food, token, flower, day or status.
2. No streak counters, streak freezes, or loss messages anywhere.
3. No reward, sound or copy that celebrates eating under the plan; Día redondo requires `on`, not `under`.
4. Overages shown as neutral "+n" tokens; the next meal's card never changes because of an overage (unless rebalance is owner-allowed).
5. Missed days look like buds and seeds, never dead plants; gaps are never mentioned.
6. Weight never appears in notifications, toasts or Today.
7. Copy lint passes (§14.5).
8. At most 2 pushes a day, quiet hours respected, back-off works.

### 14.7 Visual design system

- **Feel:** warm, playful, Mexican, uncluttered. Rosa mexicano is the single bold accent; everything else stays quiet so the colored tokens carry the screen.
- **Color tokens** (`src/client/styles/tokens.css`), light / dark:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBF7FA` | `#151016` | App background |
| `--surface` | `#FFFFFF` | `#201822` | Cards, sheets |
| `--sunk` | `#F4EAF1` | `#2A202C` | Wells, suggestion box |
| `--ink` | `#241B26` | `#F6EEF5` | Text |
| `--ink-2` | `#6B5E6E` | `#B8ABB8` | Secondary text |
| `--line` | `#EADFE7` | `#3A2E3C` | Hairlines, empty dots |
| `--accent` | `#E4007C` | `#E4007C` | Primary buttons (white text, contrast 4.6:1), today ring, week dots |
| `--accent-text` | `#C2006A` | `#FF5AA8` | Accent-colored text |
| `--gold` | `#F2B705` | `#F2B705` | Día redondo, stamps |
| `--destructive` | `#B42318` | `#F97066` | Delete-data actions only |
| `--t-carb` | `#F5A524` | same | 🫓 |
| `--t-prot` | `#7C5CFF` | same | 🍗 |
| `--t-dairy` | `#3BA3F5` | same | 🥛 |
| `--t-fruit` | `#F0525A` | same | 🍎 |
| `--t-veg` | `#22B573` | same | 🥦 |
| `--t-fat` | `#6E9A2C` | same | 🥑 |
| `--t-fatp` | `#A47148` | same | 🥜 |
| `--t-sugar` | `#C08CF5` | same | 🍬 🍫 |
| `--t-leg` | `#B5523B` | same | 🫘 |

- **Tokens (component):** circle; sizes 16 / 22 / 30 / 40 px. Remaining: tint `color-mix(var(--c) 12%, var(--surface))`, 1.5 px dashed border at 60%, emoji grayscale 70% / opacity .42. Full: tint 28%, 2 px solid border, emoji full color. Extra: full + small ink "+" badge. Half unit: half-filled. Never rely on color alone (emoji always present).
- **Type:** `ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; no web fonts. Scale 34/40 display numbers, 22/28 title, 17/24 body, 15/20 secondary, 13/18 caption; weights 400/700/900; tabular numbers.
- **Shape and space:** radius card 22, sheet 28 (top), button 16, chip/token 999. Spacing 4·8·12·16·20·24·32. Touch targets ≥ 48×48; primary button height 56.
- **Motion tokens:** `--ease-pop: cubic-bezier(.34,1.56,.64,1)`, `--ease-out: cubic-bezier(.22,1,.36,1)`; durations 120/180/240/400 ms.
- **Imagery:** no food photos anywhere. Emoji for unit types; lucide icons for UI chrome; procedural SVG for flowers.
- **Dark mode:** follows the system.
- **Accessibility:** WCAG AA contrast; VoiceOver labels on tokens ("2 de 4 proteínas"), flowers ("Martes: 4 de 5 comidas") and dots; Dynamic Type up to 130% without clipping; focus states visible.

---

## 15. Security, privacy, secrets, environments

- **Auth:** single owner. `OWNER_PAIRING_CODE` (6 random words) entered once per device → session token (32 random bytes, base64url) in cookie `sid`: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=34560000`; stored as SHA-256 in `sessions`. Constant-time comparison; 5 attempts/hour/IP. `last_seen_at` updated at most every 5 min. Devices listed and revocable in Ajustes.
- **CSRF:** SameSite=Lax + required `X-Fichas: 1` header on mutating requests.
- **Headers** (`_headers` for assets, middleware for `/api`): `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- **Privacy:** this is health data. No third-party analytics or trackers. Never log request bodies, food text or plan contents. OpenRouter calls use `data_collection: "deny"`. Plan PDFs (which contain the owner's name) are sent to the plan-reading models only; prompts never add the name.
- **Secrets inventory:**

| Name | Where | Milestone |
|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Local `.env` only (used by wrangler) | M1 |
| `OWNER_PAIRING_CODE` | `wrangler secret`; local `.dev.vars` | M1 |
| `OPENROUTER_API_KEY` | `wrangler secret`; local `.dev.vars` | M2 |
| `VAPID_PRIVATE_KEY` | `wrangler secret`; local `.dev.vars` | M6 |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `MODEL_FAST`, `MODEL_PLAN_A`, `MODEL_PLAN_B`, `MODEL_VISION`, `OPENROUTER_BASE_URL`, `TZ_DEFAULT`, `APP_VERSION` | `wrangler.jsonc` vars | as needed |

- **`.gitignore`** (create first, before any commit): `node_modules/`, `dist/`, `.wrangler/`, `.env`, `.env.*` (except `.env.example`), `.dev.vars`, `private/`, `*.pdf`, `coverage/`, `playwright-report/`, `test-results/`, `.lighthouseci/`, `.DS_Store`.
- **M1 first step:** `git init`; write `.gitignore`; move `Plan alimenticio.pdf` to `private/plans/2026-10-08.pdf`; verify with `git status` that no PDF or secret is staged. `npm run check:secrets` (regex scan for API-key and private-key patterns) runs in pre-commit and CI. If the repo is pushed to GitHub, it must be private.
- **Environments:** local (Vite dev server running the Worker in workerd with local D1/KV, secrets in `.dev.vars`) and production (`workers.dev` URL). No staging.

---

## 16. Testing strategy

| Layer | Tool | Must cover |
|---|---|---|
| Domain unit | Vitest | Units math, conversions, swaps (§3.4), status (§3.8 all cases), app day, slot windows, `suggest`, `fit`, `ideasFromPantry`, `matchText`, plan diff, momentum, stamps, levels, surprise rules (1,000-log simulation: 8–15% surprise rate, ≤ 1/day), garden model, `decideNudges` (table of scenarios incl. quiet hours, back-off, caps, pause, plan renewal) |
| Worker integration | `@cloudflare/vitest-pool-workers` (D1 migrations applied) | Pairing + rate limit; session middleware; sync push/pull idempotency and `rev` ordering; plan draft → confirm → archive integrity (§9.2); AI routes with mocked OpenRouter (cache hit, retry, fallback, daily cap); push subscribe/cleanup on 410; cron handler with fake clock |
| AI evals | `scripts/eval-parse.ts`, `scripts/eval-plan.ts` (real API, run manually) | Appendix D accuracy + latency; plan golden test |
| E2E | Playwright, mobile emulation (iPhone 13 and Pixel 7), against `vite preview` | Every budget A1–A20 with a tap-counting helper and `performance.mark` timings; offline flow (`context.setOffline(true)` → log → online → row in D1); describe with mock AI server; plan upload with mocked readers; push click deep link (simulated `notificationclick`) |
| Copy | `scripts/copy-lint.ts` | §14.5 |
| Performance | Lighthouse CI (`lhci autorun`, mobile) + bundle-size check | §12 budgets |
| Manual device check | Owner's iPhone | Install, pair, offline airplane-mode log, push received and deep link, dark mode, VoiceOver spot check, haptics/sound |

Instrumentation: client code marks `app:js-start`, `today:painted`, `log:tap`, `log:anim-start`, `describe:submit`, `describe:preview`, `ideas:shown`, and records UX events (`open_to_first_log` ms, taps per log) to `ux_events` for real-use budgets.

---

## 17. Deployment and operations

1. **Prereqs:** Node LTS, npm. Wrangler is a dev dependency (`npx wrangler`).
2. **Credentials:** `.env` with `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers" + `D1: Edit`) and `CLOUDFLARE_ACCOUNT_ID`. Load it before wrangler commands (e.g., `node --env-file=.env` wrapper scripts or `dotenv -e .env --`).
3. **Create resources:** `npx wrangler d1 create fichas-db` and `npx wrangler kv namespace create FILES`; paste ids into `wrangler.jsonc`.
4. **`wrangler.jsonc` essentials:** `name: "fichas"`, `main: "src/worker/index.ts"`, `compatibility_date: <build date>`, `assets: { not_found_handling: "single-page-application", run_worker_first: ["/api/*"] }`, `d1_databases` (binding `DB`, `migrations_dir: "migrations"`), `kv_namespaces` (binding `FILES`), `triggers: { crons: ["*/15 * * * *"] }`, `observability: { enabled: true }`, `vars` (§15).
5. **Secrets:** `npx wrangler secret put OWNER_PAIRING_CODE` (generate 6 random words; give them to the owner privately), later `OPENROUTER_API_KEY`, `VAPID_PRIVATE_KEY` (`npm run gen:vapid`).
6. **Migrate:** `npm run db:migrate:remote` (`wrangler d1 migrations apply fichas-db --remote`).
7. **Seed:** `npm run seed:remote` inserts `seed/plan-2026-10-08.json` as season 1, `active`, `starts_on: 2026-10-08`, plus seed recipes (Appendix A) and default settings.
8. **Deploy:** `npm run deploy` (`vite build && wrangler deploy`). Print the URL.
9. **Pair:** owner opens the URL on the iPhone → enters the code → Share → "Agregar a inicio" → opens from the icon.
10. **Rollback:** `npx wrangler rollback`. **DB restore:** `npx wrangler d1 time-travel restore fichas-db --timestamp=<ISO>`.
11. **Backups:** the Sunday 03:00 local cron run writes a JSON export to KV `backup/<YYYY-MM-DD>.json` (keep the last 8). Optional (only if the owner asks): a VPS cron job pulls `/api/export` weekly with a dedicated session.
12. **Monitoring:** Workers Logs (observability) + `client_errors` table, visible in Ajustes → Diagnóstico.

`package.json` scripts: `dev`, `build`, `preview`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `seed:local`, `seed:remote`, `test`, `test:worker`, `e2e`, `lint`, `copy:lint`, `eval:parse`, `eval:plan`, `lhci`, `check:secrets`, `gen:vapid`, `gen:icons`.

---

## 18. Milestones

Each milestone ends deployed to production and verified on the owner's phone. Commit at least once per milestone (git, never pushing unless asked).

### M1 — Core loop: open → see my units → log

**Objective:** a deployed, installable PWA where the owner opens the app and within 1 s sees the current meal's tokens and a real-food dish that fits, logs it with one satisfying tap, works offline, and syncs to D1.

**Tasks**
1. Repo hygiene first (§15): `git init`, `.gitignore`, move the PDF to `private/`, `.env.example`, `.dev.vars.example`, `docs/DECISIONS.md`.
2. Scaffold Vite + Preact + TS (strict) + Tailwind v4 + `@cloudflare/vite-plugin` + Hono Worker; Biome; Vitest; Playwright; `wrangler.jsonc`.
3. Migration `0001_init.sql` (§6.1); seed script; `seed/plan-2026-10-08.json` transcribed from Appendix A and validated with `PlanV1`.
4. `src/shared/domain/*`: types, plan schema, units, swaps, status, day, slots, suggest (menus skipped until M4), fit, matcher, with all §3.8 tests.
5. Auth: Pair screen, `/api/auth/pair`, session middleware, CSRF header.
6. Sync: `/api/sync` GET/POST; Dexie schema; outbox; sync loop; snapshot-first render.
7. Today screen (§14.1) with meal card, slot rows, token info, "Otra", "Ajustar" (opens Composer in M1), "¿Qué vas a comer?" (local matcher + Composer in M1), pendiente rows.
8. Meal sheet: Tus platos for the slot, Armar (Composer), Me la salté, + Extra.
9. Log pipeline: optimistic Dexie write → pop (§14.4) → toast with copy and Deshacer; recipe upsert by fingerprint; seed recipes from Appendix A.
10. Mi plan view (read-only) and minimal Ajustes (sonido, vibración, dispositivos).
11. PWA: manifest, icons, SW (precache, navigation fallback), install sheet, `_headers`.
12. Copy file with M1 strings + copy lint; Playwright budget tests for A1–A4, A8–A11, A20.
13. Deploy (§17), seed production, pair the owner's phone.

**Expected files:** everything under §5 needed by the tasks above; `migrations/0001_init.sql`; `seed/plan-2026-10-08.json`; `tests/unit/domain/*.test.ts`; `tests/worker/{auth,sync}.test.ts`; `tests/e2e/core-loop.spec.ts`.

**Acceptance criteria**
- Budgets A1, A2, A3, A4, A8, A9, A10, A11, A20 pass in Playwright (taps and times) and on the owner's iPhone.
- All §3.8 cases pass; every Appendix A example option computes to its slot target.
- Airplane mode: open → log → close → reopen → still there; back online → row present in D1 (`wrangler d1 execute fichas-db --remote --command "select count(*) from logs"`).
- Lighthouse thresholds (§12); bundle budgets met.
- Copy lint passes; no red anywhere; no word "racha".
- `git log --stat` contains no PDF and no secret.

**Verify:** `npm run lint && npm test && npm run test:worker && npm run e2e && npm run lhci && npm run copy:lint`, then the manual device checklist (§16).

### M2 — Say it, see it (AI describe and check)

**Objective:** the owner types or dictates any food and, in ~2 s, sees how it counts against the current meal, can fit it to the plan in one tap, and log it or just check.

**Tasks:** OpenRouter client (§10.2) with structured outputs, cache, retries, daily cap; `/api/ai/parse` with server-side unit recomputation; prompt B2; Describe sheet (§14.1) with assumed/estimated markers and steppers; "Que cuadre" via `fit()`; offline `pending` queue; eval harness + Appendix D; model selection (§10.5); free-food handling; "Ajustar" on the meal card now opens Describe prefilled.

**Acceptance criteria**
- A5, A6, A7 pass (with mock AI in E2E; real-API latency from `eval:parse`).
- `eval:parse` with the chosen model: exact-case accuracy ≥ 95%, composite ≥ 80%, p50 ≤ 2.0 s, p95 ≤ 4.5 s. Report table committed to `docs/DECISIONS.md`.
- Cache hit ≤ 300 ms server time; local-match inputs never call the network.
- Descriptions of street food and restaurant dishes (including the composite taco and torta cases in Appendix D) work with an empty pantry and with their ingredients marked out of stock. Pantry availability never filters parse results or prevents logging.
- Offline describe → occasion counted immediately → parsed after reconnect.
- The owner provided `OPENROUTER_API_KEY`; key never appears in the client bundle (`grep` the build output).

### M3 — New plan, new season (versioning)

**Objective:** the owner uploads a new plan (PDF or photos) and the app adopts it for the next period in ≤ 90 s with a visual diff; all past plans and logs stay intact; usual dishes re-portion automatically. **Must ship before the owner's next appointment (≈ 22 Oct 2026).**

**Tasks:** §9 end to end (drafts, KV storage, dual read with string-built bodies, post-processing, checks, diff, review screen, confirm transaction, season transition, Planes anteriores with original files); plan-renewal card on Today when the plan is ≥ 14 days old; `eval:plan` golden test on `private/plans/2026-10-08.pdf`.

**Acceptance criteria**
- Golden test passes with both readers (§10.4).
- Integration tests for §9.2 pass (immutability, snapshots, one active plan, duplicate detection).
- After confirming a plan that changes Comida to 3 🫓, the Comida suggestion shows 3 tortillas with the change highlighted, without any manual migration.
- Past days render with their original targets.
- A17 passes on the owner's phone with the real PDF.

### M4 — The game loop

**Objective:** coming back is the best part of the day, with no anxiety.

**Tasks:** day close + flower bloom + Mañana (planTomorrow, menus, acceptance); menus feed `suggest()`; week dots; garden (Flower, Garden); stamps engine + sheet + celebrations; levels + unlocks + Estilo picker; surprises; comebacks; "¿Y ayer?" backfill; Monday recap; Story tab v1.

**Acceptance criteria**
- A14, A15 pass.
- Unit tests for momentum, stamps (every row of the table), levels, surprise simulation, garden models (empty, partial, full, Día redondo, skipped, zero-log bud, future seed).
- Anti-shame checklist (§14.6) passes, signed off in `docs/DECISIONS.md`.
- Visual snapshot tests of flowers in light and dark mode.

### M5 — Kitchen: "¿Qué me hago?" and shopping list

**Objective:** the owner tells the app what's at home and gets ≤ 3 plan-fitting dishes instantly; whatever runs out becomes the shopping list.

**Tasks:** Kitchen tab (§14.1); pantry chips and quick add (`/api/ai/pantry`, prompt B3); staples; `ideasFromPantry` + AI ideas (prompt B4) with validation; "Anotar" / "Para luego"; shopping list ("Me falta") from `out` items and unmet needs of accepted menus; "Con lo que tengo" in the meal sheet; `con_lo_que_hay` stamp.

**Acceptance criteria**
- A12, A13 pass.
- Solver tests: every idea uses only `have`/`staple` foods (or shows a "falta" marker) and reaches `on` within tolerance; AI ideas that fail validation are never shown.
- Deterministic ideas render ≤ 300 ms after opening Kitchen.
- Pantry restrictions apply to Kitchen suggestions only. Describing, checking and recording food bought outside continues to work independently of inventory.

### M6 — Nudges

**Objective:** gentle, timely reminders only when useful.

**Tasks:** §13 end to end: VAPID keys, priming card, subscribe endpoints, cron scheduler with `decideNudges`, payloads and deep links, SW handlers, back-off, quiet hours, pause, per-slot toggles, plan-renewal push, test push.

**Acceptance criteria**
- `decideNudges` scenario table passes (≥ 25 scenarios).
- A18, A19 pass; a real push reaches the owner's iPhone and deep-links to the slot.
- Production logs over 3 days show ≤ 2 pushes/day and none during quiet hours.

### M7 — Story and check-in

**Objective:** see progress over weeks and make nutritionist visits more useful.

**Tasks:** season recap (auto on season change + in Story; shareable PNG via Web Share); weigh-ins (from plan confirm + manual in Story; wheel prefilled; trend chart with nutritionist points as dots, no goal line, no up/down colors); nutritionist report (one-page PNG: plan dates, days with ≥ 2 occasions, meals logged and % `on` per slot, most frequent extras by type and slot, weigh-ins) shared via the share sheet; past seasons gallery; data export (JSON) in Ajustes.

**Acceptance criteria**
- A16 passes. Report numbers match fixtures in unit tests.
- Share works on the owner's iPhone (WhatsApp/Mail).
- Weight appears only in Story and the report.

### M8 — Polish, photo logging, hardening

**Objective:** meet the definition of done.

**Tasks:** optional photo logging (📷 in Describe → `/api/ai/photo`, prompt B5, same preview); full budget re-run on device; accessibility pass (VoiceOver labels, Dynamic Type, contrast); copy audit; anti-shame checklist re-run; weekly KV backups; `RUNBOOK.md` (pair a device, upload a plan, restore, rotate the pairing code); security review (headers, rate limits, secrets scan); final Lighthouse.

Owner-requested implementation order, 2026-10-08: the optional dictation/photo review flow is brought forward alongside the text parser. This does not mark the remaining M2/M8 work or physical-device acceptance complete. Pantry never limits photo or text interpretation.

**Acceptance criteria:** §20.

### 18.9 Milestone report template (send to the owner, ≤ 15 lines)

```
M<n> listo — <one line of what's new>
URL: <production url>
Presupuestos: <IDs> ✓ (p50: A2 1.4 s, A5 2.1 s, …)  |  Falló: <none / list + fix plan>
Cambios vs plan: <none / one line each, also in DECISIONS.md>
Necesito de ti: <inputs for the next milestone, all at once / nothing>
```

---

## 19. Inputs needed from the owner

| Input | Why | Needed at |
|---|---|---|
| Approval of both Stage 1 documents + answers to the open questions (language, plan reading, name, phone) | Locks scope | Before M1 |
| Cloudflare API token ("Edit Cloudflare Workers" template + D1 Edit) and Account ID in `.env` | Create D1/KV, deploy | Start of M1 |
| iPhone/Android and OS version | Push and PWA testing | Start of M1 |
| OpenRouter API key with a monthly credit limit (≈ US$10), in `.env` | AI parsing | Start of M2 |
| Nutritionist answers: "con grasa" = carb + fat? nuts ↔ fats 1:1? can units move between meals in a day? confirm chia 7 cda, sesame 4 cda, dried cranberries ½ tza | Swap rules and rebalance (safe defaults until then) | Any time; used from M2 |
| The next plan PDF/photos when received (~22 Oct) | Real end-to-end test of M3 (the current PDF is enough to build) | M3 |
| JEV docs (optional) | Only if the owner wants JEV evaluated (§10.8) | Any time |
| VPS access (optional) | Off-Cloudflare backup pull | M8, only if asked |

Nothing else (email, VPS) is required.

---

## 20. Definition of done

1. All interaction budgets A1–A20 pass in automated tests **and** on the owner's iPhone.
2. Lighthouse ≥ 95 (Performance, Accessibility, Best Practices) and installable; bundle budgets met.
3. Seven consecutive days of real use with no blocking bug; median `open_to_first_log` ≤ 5 s (Ajustes → Diagnóstico).
4. A real new plan has gone through upload → review → confirm; the previous season, its logs and its original file are intact and viewable.
5. Offline logging verified in airplane mode.
6. Push nudges delivered on the owner's device, following every rule in §13.
7. Copy lint and the anti-shame checklist pass.
8. No secrets or PDFs in git history; `.gitignore` correct; secrets only in Wrangler and local env files.
9. `docs/RUNBOOK.md` and `docs/DECISIONS.md` up to date.
10. Production URL live; weekly backups present in KV.

---

## Appendix A — Seed plan (transcribed from `Plan alimenticio.pdf`, dated 08/10/2026)

Transcribe into `seed/plan-2026-10-08.json` (PlanV1). Fractions as decimals (⅓ = 0.3333, ⅔ = 0.6667). Ids: `${type}.${slug(food)}`.

**Header:** `issued_on: 2026-10-08`, `next_appointment: null`, `fluids_ml: 3000`, `exercise: "5 de 7 días, 45–60 min"`, `notes: ["Ir al médico", "Tomar kéfir"]`, `rules.rebalance_within_day: "unknown"`, swaps: the four defaults in §3.4 with `confirmed: false`.

**Slots**

| key | label | source_label | kind | time | target |
|---|---|---|---|---|---|
| `desayuno` | Desayuno | Desayuno | meal | 11:00 | carb_sg 2, protein_poa 3, veg 1, fat_sp 2 |
| `colacion_1` | Colación | Colación 1 | snack | 13:00 | dairy 1, fruit 1, fat_cp 1 |
| `comida` | Comida | Comida | meal | 17:00 | carb_sg 2, protein_poa 4, fruit 1, veg 2, fat_sp 2 |
| `colacion_2` | Colación | Colación 2 | snack | 19:00 | fruit 1 |
| `cena` | Cena | Cena 2 | meal | 21:00 | carb_sg 3, protein_poa 3, veg 1, fat_sp 2 |

Day totals (for tests): carb_sg 7, protein_poa 10, dairy 1, fruit 3, veg 4, fat_sp 6, fat_cp 1.

**Examples** (`options` separated by "/"; the first option is the default):

- desayuno — "Huevos con tortillas": 2 pza tortilla de maíz · 3 pza huevo · 0.5 tza verdura cocida · 1 cdta aceite vegetal · 0.3333 pza aguacate
- colacion_1 — "Latte, manzana y chocolate": 1 tza leche de vaca descremada · 1 pza manzana · 0.5 pza chocolate sin azúcar
- comida — "Pollo con tortillas y verdura": 2 pza tortilla de maíz · 120 g pollo / carne de res / pescado · 1 tza verdura cocida · 0.5 pza pera / 1 pza manzana · 2 cdta aceite vegetal
- colacion_2 — "Manzana": 1 pza manzana / 0.5 pza mango ataúlfo
- cena — "Hamburguesa casera": 1 pza bollo de hamburguesa / 3 pza tortilla de maíz · 90 g carne de res / pollo · 0.5 tza verdura cocida · 2 cdta aceite vegetal

**Seed recipes** (`origin: 'seed'`, `times: 0`): "Huevos con tortillas"; "Latte, manzana y chocolate"; "Pollo con tortillas y verdura"; "Bistec con tortillas y verdura"; "Pescado con tortillas y verdura"; "Manzana"; "Mango"; "Hamburguesa casera" (bollo + carne de res); "Tacos de pollo" (3 tortillas + 90 g pollo + ½ tza verdura + 2 cdta aceite).

**Equivalents** (one entry per food; `qty unit` equals ONE unit). Rows marked † come from the meal examples, not the table (`source: 'example'`). Rows marked ⚑ get `flag: 'check_portion'`.

| type | qty | unit | foods |
|---|---|---|---|
| carb_sg | 0.25 | tza | amaranto; arroz cocido; quinoa cocida |
| carb_sg | 2 | cda | granola; tapioca; trigo |
| carb_sg | 0.3333 | tza | arroz integral; camote; cereal; couscous |
| carb_sg | 0.5 | tza | avena en hojuelas; pasta cocida; elote desgranado |
| carb_sg | 0.5 | pza | papa cocida |
| carb_sg | 1 | pza | tortilla de maíz |
| carb_sg | 2 | pza | tortilla de nopal |
| carb_sg | 1 | paquete | salmas |
| carb_sg | 2.5 | tza | palomitas |
| carb_sg | 0.3333 | pza | palanqueta de amaranto |
| carb_sg | 0.3333 | pza | birote; bolillo sin migajón; bollo de hamburguesa; telera; bagel |
| carb_sg | 2 | pza | crepa |
| carb_sg | 1 | reb | pan de caja; pan tostado |
| carb_sg | 5 | pza | galleta maría; pretzel; galleta habanera; galleta salada |
| carb_sg | 1 | barra | barra de cereal (note: "menos de 90 kcal" as written in the plan) |
| carb_sg | 0.5 | pza | media noche |
| carb_sg | 14 | pza | galleta para sopa |
| carb_cg | 0.5 | pza | bísquet; cuernito |
| carb_cg | 0.3333 | pza | bigote de chocolate |
| carb_cg | 1 | pza | tortilla de harina; tostada |
| carb_cg | 0.3333 | pza | pan dulce |
| protein_poa | 1 | pza | huevo |
| protein_poa | 2 | pza | clara de huevo |
| protein_poa | 3 | cda | queso cottage; requesón; ricota reducida en grasa; queso parmesano rallado |
| protein_poa | 30 | g | pollo; carne de res; pescado; atún fresco; cecina; salmón; filete de mojarra; arrachera |
| protein_poa | 30 | g | queso panela; queso cheddar bajo en grasa; queso oaxaca; queso de cabra; tofu; queso fresco; queso blanco |
| protein_poa | 0.3333 | lata | atún drenado |
| protein_poa | 3 | pza | sardina |
| protein_poa | 0.5 | pza | chuleta ahumada |
| protein_poa | 2 | reb | pechuga de pavo |
| protein_poa | 1 | reb | queso mozzarella bajo en grasa; queso monterrey bajo en grasa; queso holandés bajo en grasa |
| protein_poa | 5 | pza | camarón |
| protein_poa | 0.6667 | barra | surimi |
| protein_poa | 1 | pza | salchicha |
| dairy | 1 | tza | leche de soya; leche de vaca descremada; yogurt descremado |
| dairy | 0.3333 | tza | leche evaporada |
| legume | 0.5 | tza | alubia; alverjón; frijol; garbanzo; haba; lenteja (cocidos) |
| legume | 0.3333 | tza | soya cocida; frijol molido |
| fruit | 1 | tza | zarzamora; frambuesa; mora; fresa (PDF says "frescos"); melón; papaya; sandía; piña |
| fruit | 18 | pza | uva; cereza |
| fruit | 3 | pza | ciruela; guayaba; plátano dominico |
| fruit | 2 | pza | durazno amarillo; granada china; higo; mandarina; naranja; tuna |
| fruit | 1 | pza | granada roja; manzana; toronja; kiwi |
| fruit | 0.5 | pza | mango ataúlfo; pera; plátano |
| fruit | 12 | pza | lichi |
| fruit | 0.3333 | pza | mamey |
| fruit | 10 | pza | pasita; ciruela pasa |
| veg | 0.5 | tza | coliflor; ejote; pimiento cocido; setas; verdolagas; berenjena; brócoli; calabacita; champiñón; chayote; chícharo (cocidos) |
| veg | 2 | tza | espinaca; flor de calabaza; lechuga; acelga; apio; arúgula; berro; col (crudos) |
| veg | 1 | tza | hongos crudos |
| veg | 0.5 | tza | jícama; zanahoria; betabel; germen |
| veg | 2 | pza | jitomate saladet |
| veg | 1 | tza | pepino; pimiento crudo |
| veg † | 0.5 | tza | verdura cocida (cualquiera) |
| sugar_sg | 2 | cdta | azúcar; leche condensada; mermelada; cátsup; cajeta |
| sugar_sg | 13 | g | ate |
| sugar_sg | 0.5 | tza | gelatina de agua |
| sugar_sg | 3 | pza | gomita; malvavisco |
| sugar_sg | 0.3333 | tza | jugo de frutas |
| sugar_sg | 40 | g | nieve de fruta |
| sugar_sg | 1 | pza | paleta helada de agua (pequeña) |
| sugar_sg | 0.25 | lata | refresco |
| sugar_sg ⚑ | 0.5 | tza | arándano seco con azúcar |
| sugar_cg | 3 | cda | mole |
| sugar_cg | 0.5 | pza | flan; gelatina de leche; natilla; chocolate |
| fat_sp | 0.3333 | pza | aguacate |
| fat_sp | 8 | pza | aceituna sin hueso |
| fat_sp | 1 | cdta | aceite vegetal; aceite de oliva |
| fat_sp | 5 | disparo | aceite en spray |
| fat_sp | 1.5 | cda | coco rallado; cocoa (más de 80%) |
| fat_sp | 0.5 | cda | aderezo |
| fat_sp | 3 | cda | aderezo bajo en grasa |
| fat_sp | 1 | cdta | margarina; mantequilla; mayonesa |
| fat_sp | 1 | cda | crema; crema para café; queso crema |
| fat_sp | 1 | reb | tocino |
| fat_cp ⚑ | 4 | cda | ajonjolí |
| fat_cp | 10 | pza | almendra; avellana |
| fat_cp | 14 | pza | cacahuate |
| fat_cp ⚑ | 7 | cda | chía |
| fat_cp | 1 | cda | harina de ajonjolí; harina de almendra; harina de cacahuate |
| fat_cp | 2 | cdta | crema de cacahuate |
| fat_cp | 7 | mitad | nuez |
| fat_cp | 1 | cda | pepitas sin cáscara; piñón |
| fat_cp | 18 | pza | pistache |
| fat_cp | 4 | cdta | semilla de girasol |
| fat_cp † | 0.5 | pza | chocolate sin azúcar |

**Free foods:** agua, agua mineral, refresco zero, hierbabuena, menta, jamaica (sin azúcar), hierbas de olor, jengibre, té, café, mostaza, salsa de soya, salsa inglesa, pimienta, perejil, sal, vainilla, vinagre, chile en polvo, edulcorante, gelatina light, levadura.

**Aliases (minimum set, `src/shared/domain/aliases.ts`):** tortilla de maíz ← tortilla(s) · carne de res ← carne, bistec, res, carne molida · pollo ← pechuga de pollo, pollo deshebrado · pescado ← filete de pescado, tilapia · queso panela ← panela · pan de caja ← pan integral, pan blanco, pan · bollo de hamburguesa ← pan de hamburguesa · telera ← pan de torta · leche de vaca descremada ← leche, leche light, latte · yogurt descremado ← yogur, yogurt natural · verdura cocida ← verdura(s), verduras al vapor · aceite vegetal ← aceite · crema de cacahuate ← mantequilla de maní, peanut butter · refresco ← coca, coca-cola, soda · refresco zero ← coca zero, coca light, refresco light · agua mineral ← topo chico, agua con gas · café ← café americano, café negro, espresso · arroz cocido ← arroz, arroz blanco · frijol ← frijoles, frijoles de la olla · jitomate saladet ← jitomate, tomate · calabacita ← calabacitas · plátano ← plátano tabasco · pan dulce ← concha, dona, cuerno.

---

## Appendix B — Prompts

Keep prompts in `src/worker/lib/prompts/`, versioned by `PROMPT_VERSION`. JSON schemas are generated from the Zod types.

**B1. Plan reading (system, English):**

```
You transcribe Mexican nutrition plans based on the "Sistema Mexicano de Alimentos Equivalentes" into JSON.
Transcribe exactly what is written. Never infer, round, correct or complete values. Blank = 0.
The document usually contains:
1) A cover: "Fecha" (DD/MM/YYYY), "Próxima cita", "Ejercicio", "Líquidos" (ml), "Notas" (handwritten-style text), "Lista de compras" (ignore if empty).
2) "Tabla de intercambios": boxes per food group. Each line = the portion that equals ONE unit, followed by foods separated by commas,
   e.g. "1/4 tza amaranto, arroz cocido, quinoa cocida" → {type, qty: 0.25, unit: "tza", foods: [...]}.
   Box → type: Carbohidratos sin grasa→carb_sg; Carbohidratos con grasa→carb_cg; Proteínas (POA)→protein_poa;
   Leguminosas (POV)→legume; Lácteos→dairy; Frutas→fruit; Verduras→veg; Azúcar sin grasa→sugar_sg;
   Azúcar con grasa→sugar_cg; Grasas sin proteína→fat_sp; Grasas con proteína→fat_cp; Alimentos libres de energía→free_foods.
3) A meal grid ("Tiempo"): one row per eating moment (label + "Hora") with sub-columns:
   Carbohidratos [s/g→carb_sg, c/g→carb_cg]; Proteínas [POA→protein_poa, Leg→legume, Lácteo→dairy];
   Vitaminas y minerales [Fruta→fruit, Verdura→veg]; Azúcares [s/g→sugar_sg, c/g→sugar_cg]; Grasas [s/g→fat_sp, c/g→fat_cp].
   The small number on the line under a sub-column header is that row's allocation.
   The large bold text inside a cell is the nutritionist's EXAMPLE, not an allocation: copy each example item as a separate string
   in example_lines, in reading order, left to right.
Units: tza, cda, cdta, pza, reb, g, ml, lata, paquete, barra, disparo, mitad. Fractions as decimals (1/3→0.3333, 2 1/2→2.5).
Times as 24h "HH:MM" ("5: 00 pm"→"17:00"). Dates as YYYY-MM-DD.
Return only JSON matching the schema.
```

**B2. Parse food text (system, Spanish):**

```
Eres el contador de porciones de Fichas. Conviertes lo que la persona comió o va a comer en porciones de SU plan.
Reglas:
- Usa la lista de equivalentes de abajo. Para cada alimento elige el equivalente más cercano y devuelve su id.
- Cantidad: usa lo que la persona dijo. Si no lo dijo, asume la porción típica en México y marca assumed_qty=true.
- Platillos (torta, tacos, quesadilla, enchiladas, chilaquiles, pozole, sándwich, ensalada, sopa…): descompón en ingredientes.
- Si un alimento no está en la lista: equivalent_id=null, estima sus porciones por analogía con el equivalente más parecido y marca estimated=true.
- Alimentos libres (lista) → free=true, units vacías.
- No ajustes cantidades para que "quepan" en el plan. Solo cuenta lo que se dijo.
- Nunca calcules calorías ni des consejos.
- title: nombre corto y natural del platillo, máximo 4 palabras.
Responde solo JSON con el esquema.
```
User message: `Comida actual: <slot label>` + `Texto: "<text>"` + the compact table (`id|tipo|porción|alimento|alias` per line) + free foods.

**B3. Pantry text (system, Spanish):** "Convierte esta lista de lo que hay en la cocina en artículos. Para cada uno: label corto en español y los ids de equivalentes que le correspondan (puede ser más de uno, p. ej. 'tortillas' → tortilla de maíz). Ignora utensilios y cosas que no son comida. Responde solo JSON."

**B4. Dish ideas (system, Spanish):** "Propón hasta 3 platillos caseros mexicanos sencillos usando SOLO los alimentos disponibles (más sal, especias, salsas y alimentos libres). Cada platillo debe sumar exactamente las porciones objetivo por tipo usando las cantidades de la lista de equivalentes. Devuelve title (máx. 4 palabras) e items con equivalent_id, qty y unit. Responde solo JSON." The server re-validates every idea (§11.3).

**B5. Meal photo (system, Spanish):** "Identifica los alimentos de la foto y estima cantidades en medidas caseras mexicanas. Mismas reglas y esquema que el contador de porciones (B2). Si algo no se distingue, no lo inventes."

---

## Appendix C — Copy pools (es-MX)

Placeholders: `{slot}` slot label, `{type}` short type label, `{emoji}`, `{n}`, `{name}`, `{unlock}`, `{total}`, `{fix}`.

```ts
export const pools = {
  'log.onPlan': ['¡Eso! {slot} en plan.', 'Al cien.', 'Así mero.', 'Bien ahí.', 'Exacto, como relojito.', 'Ni una de más, ni una de menos.'],
  'log.firstOfDay': ['Buen arranque.', 'Primer bocado, anotado.', 'Arrancamos bien.', 'Día abierto.', 'Ya empezó lo bueno.'],
  'log.overSmall': ['Un {type} de más. Sin drama: borrón y cuenta nueva.', '+{n} {emoji}. Anotado y seguimos.', 'Se coló un {emoji}. Todo bien.', 'Un poquito arriba. Lo anotaste, eso cuenta.', '+{n} {emoji}. Seguimos igual.'],
  'log.overBig': ['Día de fiesta. Anotado, eso es lo que cuenta.', 'Comidón. Anotarlo fue la mejor jugada.', 'Se vale. Ya quedó registrado.', 'Anotado sin filtro. Así se hace.', 'Lo importante ya pasó: lo anotaste.'],
  'log.under': ['Te quedó {n} {emoji}. Es tuya si se te antoja.', 'Sobró {n} {emoji}. Ahí está si la quieres.', 'Anotado. Queda {n} {emoji}.', 'Listo. {n} {emoji} sin usar.', 'Va. Te queda {n} {emoji}.'],
  'log.mixed': ['Anotado. Ahí van tus fichas.', 'Listo, tal cual.', 'Anotado. Checa tus fichas.', 'Va, registrado.', 'Hecho.'],
  'log.extra': ['Extra anotado.', 'Anotado como extra.', 'Va, extra registrado.', 'Listo, extra.', 'Extra, anotado.'],
  'log.free': ['Libre. No cuenta.', 'Ese es libre.', 'Libre, como debe ser.', 'No suma fichas.', 'Gratis para tu plan.'],
  'log.skip': ['Anotado.', 'Va.', 'Entendido.', 'Listo.', 'Hecho.'],
  'log.undo': ['Deshecho.'],
  'log.backfill': ['Ayer, completo.', 'Recuperado.', 'Listo, ayer cuenta.', 'Anotado en ayer.', 'Ayer ya quedó.'],
  'log.newDish': ['Nuevo plato en tu recetario.', 'Plato nuevo guardado.', 'A tu recetario.'],
  'comeback': ['¡Volviste! Justo a tiempo para la que sigue.', 'Aquí seguimos. ¿Qué comiste?', '¡Qué bueno verte! Seguimos.', 'De vuelta. Esto es lo que cuenta.', 'Retomamos sin pendientes.'],
  'dayClose.round': ['Día redondo.', 'Redondito.', 'Día perfecto de fichas.', 'Todo en su lugar.', 'Ni una fuera de lugar.'],
  'dayClose.full': ['Día cerrado. Mañana ya está armado.', 'Listo por hoy.', 'Día completo. A descansar.', 'Cerramos. Mañana, más fácil.', 'Hoy ya quedó.'],
  'dayClose.partial': ['Día cerrado. Cada comida anotada cuenta.', 'Ya cerramos. Mañana seguimos.', 'Buen día de registro.', 'Cerrado. Lo anotado, anotado.', 'Mañana ya está armado.'],
  'tomorrow.accepted': ['Mañana resuelto.', 'Menú listo.', 'Ya no hay que pensarle.'],
  'week.recap.strong': ['Semana sólida: {n} de 7.', '{n} de 7. Eso es constancia.'],
  'week.recap.ok': ['{n} de 7. Buena base.', 'Vamos agarrando ritmo.'],
  'week.recap.low': ['Semana nueva, arrancamos.', 'Esta semana va por la primera.'],
  'season.start': ['Temporada {n}. Plan nuevo, hoja en blanco.', 'Arranca la temporada {n}.'],
  'season.end': ['Temporada {n} completa.', 'Cerraste la temporada {n}.'],
  'stamp.earned': ['Estampa nueva: {name}.', '¡{name}!'],
  'level.up': ['Nivel {n}. Desbloqueaste {unlock}.', '¡Nivel {n}!'],
  'surprise': ['Esa combinación se ve rica.', 'Vas como relojito.', 'Tus fichas te saludan.', 'Llevas {total} comidas anotadas.', 'Chef, ¿eh?', 'Así se arma un hábito.'],
  'push.title.slot': ['{slot}'],
  'push.body.slot': ['¿{slot} como siempre? Un toque y listo.', 'Tu {slot} te espera.', '¿Ya comiste? Anotarlo toma un segundo.', '¿Lo de siempre? Un toque.', '{slot}: ya está lista tu sugerencia.'],
  'push.title.plan': ['¿Plan nuevo?'],
  'push.body.plan': ['Súbelo y arrancamos temporada.', 'Tómale foto y lo leo yo.'],
  'describe.placeholder': ['¿Qué vas a comer?'],
  'describe.thinking': ['Contando fichas…', 'Revisando tu plan…', 'Ya casi…'],
  'describe.fits': ['Cabe exacto.', 'Justo en tu plan.'],
  'describe.overHint': ['Con {fix} queda exacto.'],
  'describe.assumed': ['Supuse esto. Toca para ajustar.'],
  'describe.offline': ['Sin internet. Lo cuento al rato.'],
  'error.generic': ['No salió. Intenta otra vez.'],
  'kitchen.empty': ['¿Qué hay en tu cocina? Dímelo como sea.'],
  'notif.ask': ['¿Te aviso si se te pasa una comida?'],
  'install.hint': ['Agrégala a tu inicio: Compartir → Agregar a inicio.'],
  'backfill.title': ['¿Y ayer?'],
  'plan.renew': ['¿Ya tienes plan nuevo? Súbelo aquí.'],
};
export const buttons = { ate: '✓ Me lo comí', other: '↻ Otra', adjust: '✎ Ajustar', log: 'Anotar', check: 'Solo checaba', fit: 'Que cuadre', skip: 'Me la salté', extra: '+ Extra', accept: 'Así ✓', change: 'Cambiar', usual: '✓ Lo de siempre', forgot: 'No me acuerdo', yesNotif: 'Sí, avísame', notNow: 'Ahora no', planOk: 'Se ve bien ✓', today: 'Hoy', tomorrow: 'Mañana', undo: 'Deshacer', enter: 'Entrar', later: 'Para luego' };
```

---

## Appendix D — Parser eval cases (`evals/parse-cases.json`)

Expected units after normalization against no target (raw units). "Exact" cases must match within ±0.25 per type; "composite" cases within the given ranges.

| # | Input | Expected | Kind |
|---|---|---|---|
| 1 | 2 tortillas de maíz | carb_sg 2 | exact |
| 2 | 3 huevos revueltos con una cucharadita de aceite | protein_poa 3, fat_sp 1 | exact |
| 3 | 120 g de pechuga de pollo | protein_poa 4 | exact |
| 4 | una manzana | fruit 1 | exact |
| 5 | media taza de arroz | carb_sg 2 | exact |
| 6 | 1 taza de arroz integral | carb_sg 3 | exact |
| 7 | un bolillo sin migajón | carb_sg 3 | exact |
| 8 | 2 rebanadas de pan de caja | carb_sg 2 | exact |
| 9 | un plátano | fruit 2 | exact |
| 10 | un mango ataúlfo | fruit 2 | exact |
| 11 | 18 uvas | fruit 1 | exact |
| 12 | una taza de papaya | fruit 1 | exact |
| 13 | una taza de leche descremada | dairy 1 | exact |
| 14 | una taza de yogurt natural descremado | dairy 1 | exact |
| 15 | media taza de frijoles de la olla | legume 1 | exact |
| 16 | un tercio de aguacate | fat_sp 1 | exact |
| 17 | un aguacate entero | fat_sp 3 | exact |
| 18 | 10 almendras | fat_cp 1 | exact |
| 19 | 20 almendras | fat_cp 2 | exact |
| 20 | 2 cucharaditas de crema de cacahuate | fat_cp 1 | exact |
| 21 | café americano | free | exact |
| 22 | coca zero | free | exact |
| 23 | una lata de atún drenado | protein_poa 3 | exact |
| 24 | 90 g de queso panela | protein_poa 3 | exact |
| 25 | 2 tortillas de harina | carb_cg 2 | exact |
| 26 | una tostada | carb_cg 1 | exact |
| 27 | una concha | carb_cg 3 | exact |
| 28 | una taza de verduras al vapor | veg 2 | exact |
| 29 | 5 galletas marías | carb_sg 1 | exact |
| 30 | 2 claras de huevo | protein_poa 1 | exact |
| 31 | una lata de refresco | sugar_sg 4 | exact |
| 32 | media taza de avena con una taza de leche | carb_sg 1, dairy 1 | exact |
| 33 | 1 taza de pepino con limón y chile en polvo | veg 1 | exact |
| 34 | 5 tazas de palomitas naturales | carb_sg 2 | exact |
| 35 | quesadilla de queso oaxaca en tortilla de maíz | carb_sg 1, protein_poa 1–2 | composite |
| 36 | ensalada de lechuga con jitomate | veg 1–2 | composite |
| 37 | torta de jamón con queso y mayonesa | carb_sg 3, protein_poa 1.5–3, fat_sp 1–2 | composite |
| 38 | 3 tacos de bistec | carb_sg 3, protein_poa 2–4 | composite |
| 39 | un vaso de jugo de naranja | sugar_sg 2–4 | composite |
| 40 | un plato de pozole de pollo | carb_sg 1.5–3 (estimated), protein_poa 2–3, veg 0–1 | composite |

Scoring: a case passes when every expected type is within tolerance and no unexpected type exceeds 0.5. Report accuracy for exact and composite sets separately, plus p50/p95 latency and average cost per call.
