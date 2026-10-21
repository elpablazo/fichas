# Fichas operations

This runbook covers the core loop, text/photo review, offline descriptions, plan versions, habits, Kitchen, reminders, Progress and backup recovery. From 1.0 the tabs are **Hoy · Cocina · (+) · Jardín · Progreso**; the redesign is described in [03-redesign.md](03-redesign.md).

Production: https://fichas.toolco.workers.dev

Remaining physical-device and elapsed-use gates are listed in [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md).

## Pair and install on iPhone

1. Open the production URL in Safari.
2. Enter the six-word key from local, gitignored `private/pairing-code.txt`.
3. Use Share → Add to Home Screen and open Fichas from its icon.
4. The current meal, tokens and a suggestion come from the nutritionist's plan. Tap the main meal button to record it. Use Undo immediately to revert.

The code is installed as Cloudflare's `OWNER_PAIRING_CODE` secret. It is never embedded in the client build. iPhone push requires iOS 16.4 or later, installation and the installed VAPID identity described below.

## Physical M1 acceptance

Check installation and pairing, then open the installed app in airplane mode, log a meal, close/reopen it and verify the meal remains. Turn airplane mode off and leave the app open briefly to sync. Check dark mode, VoiceOver labels and the sound/haptics switches under Progreso → Ajustes. Logging plays ascending synthesized marimba notes.

Automated browser checks do not replace this physical test. The owner requested the dictation/photo features while this check was pending; physical acceptance remains open.

## Dictation and plate photos

Tap the central **+** ("¿Qué comiste?"). The microphone inside the field starts optional browser speech recognition in Mexican Spanish; the camera beside it opens the plate photo. Review and edit the text, then tap "Ver porciones" or press the keyboard's Done/Enter key to count it. Speech never submits or logs automatically. If browser recognition is unavailable or microphone access is denied, the field stays editable and suggests the keyboard microphone. iPhone's Safari/Home Screen microphone behavior still needs the owner's physical check.

"Foto del plato" opens the camera/image picker. The phone re-encodes the chosen image as JPEG, removes metadata and reduces its longest side to 1280 pixels before analysis. OpenRouter receives that image and the plan's food/portion table; no original PDF, owner name or medical notes are included by the app. Browser speech recognition uses the browser/OS speech service, independently of OpenRouter.

Detections appear in text and an editable list, marked approximate. Use −/+, remove individual foods, or edit the description and press Done/Enter to read the corrections. "Anotar" approves the current list; "Descartar" closes it without creating a meal. Food from home, street vendors and restaurants uses the same flow, regardless of pantry stock. Image analysis can misidentify foods or portions; the review step is required.

The app does not store photos in IndexedDB, D1 or R2. Only approved food text/items are saved. Photos need an internet connection; known-equivalent descriptions and the manual composer work offline. Unknown text shows **Anotar** and **Solo checaba**: Anotar records a provisional occasion without invented portions. It survives reopening and is counted even before parsing. When the app reconnects, it fills the same record using its original plan and target. Failed parsing retries while the app is open; Deshacer cancels the record and its pending request. The app does not finish background work while fully closed. **Ajustar** now opens Describe with the suggestion prefilled.

`OPENROUTER_API_KEY` is a Cloudflare secret, installed after explicit owner authorization. `MODEL_FAST` and `MODEL_VISION` are Wrangler vars. The Worker validates structured output, recomputes known-equivalent units, retries once, caches text by plan/slot/model/prompt, limits combined AI requests to 60/hour/session, and atomically caps provider attempts at 400/day. Photos are never cached.

## Devices and exports

Progreso → Ajustes lists active devices and can revoke other sessions. The export button downloads a JSON snapshot of app data; store it privately. Signing out revokes the current session. Weekly private R2 backups and isolated local recovery are active from 0.8.1, with the owner's explicit authorization.

## Local development and checks

Use Node 22.18 or later. Credentials belong in `.env`; local Worker secrets belong in `.dev.vars`. Example files document the keys without their values. Never stage either real file, `private/`, PDFs, screenshots or audit reports.

This checkout uses `.githooks/pre-commit` to scan for secrets and personal files before local commits. After copying the repository, enable the same hook with `git config core.hooksPath .githooks`.

```sh
npm run db:migrate:local
npm run seed:local
npm run dev
```

```sh
npm run lint
npm test
npm run test:worker
npm run build
npm run e2e:budgets
npm run lhci
npm run copy:lint
npm run size
npm run check:secrets
node --import tsx scripts/check-secrets.ts --client
```

`e2e:budgets` runs 20 iterations per M1/M2 action and synthetic A17 in both mobile profiles; allow about ten minutes. Its server uses the production build and local D1, never production D1. `scripts/e2e-reset.ts` deletes local Wrangler state; do not use it on local data you want to keep.

Lighthouse authenticates against the local preview by default. Run `LHCI_URL=https://fichas.toolco.workers.dev npm run lhci` to audit production with the private pairing key. Production warm-up blocks food sync writes and AI; audit pages also block AI so deferred descriptions cannot resolve during the audit. Reports stay in ignored `.lighthouseci/`; do not configure temporary public storage for this app. The audit pairs a device session and does not revoke it. Afterwards, revoke the audit sessions that were never reused (the owner's devices are untouched):

```sh
npm run cf -- d1 execute fichas-db --remote --command "UPDATE sessions SET revoked_at = unixepoch('now') * 1000 WHERE label = 'Lighthouse' AND revoked_at IS NULL AND last_seen_at = created_at"
```

`npm run verify:production` pairs a temporary device, waits up to 45 seconds for the deployed version, checks the plan, verifies Adjust/check-only and the authenticated original PDF, then reloads offline and revokes its session. When every meal is already recorded, it checks a local Describe preview instead of assuming a pending suggestion. It blocks browser food-data sync writes and, in default mode, AI calls. It does not log a meal or change owner food data.

The smoke test and Lighthouse warm-up retry the initial connection at most three times only for `ERR_EMPTY_RESPONSE`. HTTP/application failures and measured audit navigations still fail normally. The smoke test also checks the installed VAPID public identity.

For an authorized live AI check, use `npm run verify:production -- --photo <local-photo-path>`. It sends the image/table to the configured provider, checks the editable preview and discards it, then checks a generic street-food description without logging. It changes AI usage/cache counters, never food records, and stores the screenshot privately. `npm run eval:parse -- --models <comma-separated-model-ids>` evaluates all 40 Appendix D cases through the production parser; `--cases 35,37,38,40` selects a subset. Evaluation details stay in ignored `private/evals/`; a partial run never satisfies full M2 thresholds.

## Plan versions (M3 active from 0.3.0)

Mi plan offers **Ver original** for the current plan and historical plans. Downloads require a paired session and decode the stored base64 on the phone. Confirmed plans and meal allocation snapshots are protected by database triggers.

The owner authorized the full private-PDF transfer to OpenRouter and provider credit. Selected readers: `anthropic/claude-sonnet-5.5` and `google/gemini-3.1-pro-preview`, prompt `plan-dual-3`, low reasoning. Both passed alone: five targets/times and 98.4375% equivalents; remaining ambiguities require review.

```sh
# Live: sends the authorized private PDF and consumes provider credit.
npm run eval:plan
# Local: recomputes metrics from saved real outputs, preserving read timings/costs.
npm run eval:plan -- --replay
```

The harness stores details in ignored `private/evals/` and verifies the source hash. It creates no meal or plan in production. Replay performs no provider call and is explicitly labeled; it does not establish fresh latency. Source PDFs/photos and reader results must never enter Git or public reports.

With reading activated: Mi plan → Subir plan nuevo → select a PDF or photos → wait for review → resolve every two-chip disagreement → adjust targets and acknowledge indicated portions → Hoy/Mañana → Está bien. Today is unavailable when meals already exist; Tomorrow preserves today's plan. A brief season welcome follows. Usual dishes re-portion from the new targets; old logs and originals remain intact.

A draft's parsing runs in `PLAN_JOBS`, a SQLite Durable Object alarm, independently of the browser. The API returns 202 after scheduling; reopening the upload screen resumes polling for the stored result. Retry reuses completed read caches; discard prevents a queued draft from activating. Failed reads offer retry or a new upload. The cron is separate from ingestion; it now schedules notifications and weekly R2 backups.

## Garden and tomorrow (M4)

After resolving the planned meals, or after 21:30 with a recorded meal, Hoy offers the day-close bloom and tomorrow's dishes. The animation can be skipped. Tap a dish to change it and save the menu in one tap; it leads tomorrow's suggestions. From 21:00 **Cerrar el día** appears on Hoy, and it is always in the "Tu día" sheet. Tomorrow's menu is also reachable by tapping tomorrow in the week strip. Closing the day never blocks further logging or Undo.

Jardín shows the seasonal garden (one plant per day; species stay secret until they bloom), level, flowers, the herbarium of discovered species, stamps and **Estilo**. Favorite dishes live in Cocina → Platos. Older garden pages remain reachable. Missing meals stay neutral; no day removes progress. XP markers are idempotent per recorded occasion and never revoked by undo. Stamps and unlocks sync as achievements; quiet local onboarding avoids replaying old celebrations. Temporary seasonal styles do not overwrite the chosen style.

**¿Y ayer?** presents one unresolved meal at a time. **Lo de siempre** records the usual dish for that historical day/plan/target; skip the prompt if it does not describe what happened. Dismissing the renewal card for today allows the recovery prompt to appear. Day close, menus, rewards and backfill work locally offline, then sync while the app is open.

`e2e:budgets` now includes A14/A15. Physical installation, VoiceOver, light/dark appearance and actual phone timings still require the owner; automated browser checks do not establish them.

## Kitchen (M5, redesigned in 1.0)

Cocina has three tabs: **Despensa** ("¿Qué me hago?" with a meal picker, then foods grouped by type: tap the circle for have/ran out, tap the name for what it counts as, manual linking, "Siempre tengo" or removal), **Platos** (your dishes; the star boosts suggestions; a tap opens it ready to log) and **Lista** (shopping list with share).


Open **Cocina** from the bottom bar, or **Lo que tengo** from a meal's dish list. Add a comma-separated list or dictate it, review the editable text and tap **Agrega**. Known foods link locally. Unknown labels remain as chips, with **?** to retry linking; they are queued while offline and processed after reconnect while the app is open. Naming retries are bounded and independent of meal sync. Add/stock/Undo changes survive immediate reopening through a small browser journal that clears after IndexedDB commits.

Tap a food chip when it runs out; it moves to **Me falta**. The star marks a staple. Marking a starred food out also clears its staple flag. In **Me falta**, check a purchased item to put it back in stock. The list also includes missing foods from accepted upcoming menus.

**¿Qué me hago?** shows at most three ideas against the selected meal's remaining units. Local ideas appear first and label any missing foods. Validated AI ideas may append, using only available foods. **Anotar** explicitly records the dish and earns the kitchen stamp; **Para luego** fits it to tomorrow's plan and saves that meal's menu. Ideas are not automatically recorded.

Inventory limits only Kitchen suggestions. Describe, plate photos, manual dishes and check-only still support home, street, restaurant and takeout food with empty inventory or ingredients marked out. Pantry never changes the nutritionist's targets.

`npm run eval:kitchen` makes two bounded live-provider checks using generic foods and the source equivalent table, without production inventory or meal writes. It uses the authorized OpenRouter key/credit and stores detailed outputs privately. A12/A13 budgets cover one-tap ideas, stock and add actions; local E2E also covers stale/invalid AI, menus/shopping, offline linking and Undo.

## Deploy only to Cloudflare

Wrangler loads `.env` using the `cf` wrapper. The destination is Worker `fichas`, D1 database `fichas-db` and R2 bucket `fichas-files`.

```sh
# Apply only when a new migration is pending.
npm run db:migrate:remote
npm run deploy
npm run verify:production
```

The initial seed has already run. `npm run seed:remote` is idempotent, but it should not be part of every deployment. New plans use the active M3 upload/review flow. Do not upload a modified copy of the existing PDF solely to bypass duplicate detection.

Do not push to GitHub unless the owner authorizes it. Cloudflare deployments work directly from this local checkout.

## Roll back and recover

```sh
npm run cf -- deployments list
npm run cf -- rollback
```

A Worker rollback does not roll back D1 or R2. For database recovery, inspect the required point in time first and use Cloudflare D1 Time Travel restore with the chosen timestamp. Restoring database contents requires explicit owner approval; it can replace newer logs.

```sh
npm run cf -- d1 time-travel info fichas-db
# After choosing and approving the restore point:
npm run cf -- d1 time-travel restore fichas-db --timestamp=<ISO>
```

Weekly JSON snapshots are stored in private R2 under `backup/YYYY-MM-DD.json`; retain eight. They include synced data, plan review reports and one consistent revision. Sessions, tokens, subscriptions, AI caches and credentials are excluded. Original plan files remain at the snapshot's `source_keys` in the existing R2 bucket. Recovery needs those originals too.

Backups are enabled: `BACKUPS_ENABLED=true`, with the owner's explicit authorization on October 9. The cron creates a private R2 snapshot on Sunday at 03:00 in the configured timezone and retains up to eight copies. The same gate controls automatic and manual creation.

Once enabled, `npm run backup:verify` creates today's backup if absent, downloads it into ignored `private/backups/`, verifies confirmed original files and tests recovery in a fresh local D1 database. It never replaces production rows.

```sh
npm run backup:restore -- private/backups/YYYY-MM-DD.json
```

This command always uses `--local` and a new private persistence directory, validates rows/schema/revisions, restores all synced tables and checks row counts. Production replacement still requires selecting and explicitly approving a recovery point. Re-pair devices and reinstall push subscriptions after an actual production recovery; credentials are intentionally absent from snapshots.

The CLI has passed both synthetic recovery and download/recovery of the first real production backup, `backup/2026-10-09.json`. All synced table counts and authenticated confirmed-plan originals were verified. Recovery used a fresh local database; production rows were preserved.

## Rotate the pairing key

Generate a new six-word key locally, retain it only in `private/pairing-code.txt`, and update the `OWNER_PAIRING_CODE` Wrangler secret. Updating this private payload needs authorization for the Cloudflare destination. Update local `.dev.vars` separately if needed. Rotation changes future pairing; revoke existing devices in Settings if they should also lose access.


## Reminders (M6)

On an installed app, a day with three recorded meals unlocks the permission card. Permission is requested only from the tap. Dismissal re-offers after seven days, at most twice. Progreso → Ajustes → Avisos controls master enable, 1/3/7-day pauses, quiet times, per-meal switches and Enviar prueba. Default silence is 22:30–09:00.

The global limit is two notifications per app day, including tests and failed/reserved attempts. A completed/skipped slot, activity within 30 minutes, quiet hours, a pause or a disabled slot suppresses meal reminders. Three ignored reminders for one slot back off seven days. Matching logs within three hours reset the counter. Expired subscriptions are deleted on 404/410. Test notifications also respect silence, pauses and the daily limit.

From 0.8.3, reminder cron uses actual execution time, and each provider request rechecks the current policy after encryption. A meal recorded, plan replaced, pause/quiet hours started or subscription revoked while an attempt is being prepared cancels its remaining sends. Abandoned reservations still count toward the daily attempt cap; they do not trigger a retry storm. Provider acceptance for an earlier device remains recorded, but still does not establish actual phone receipt.

The existing VAPID identity was installed in the Worker with the owner's explicit authorization on October 9. Private files remain ignored; signature verification confirms the public/private pair matches. Do not rotate the identity implicitly, as existing subscriptions depend on it. The authenticated public-key endpoint is now available. Each installed device still needs its own browser permission and subscription.

To reinstall the already authorized identity without printing it:

```sh
npm run cf -- secret put VAPID_PRIVATE_KEY < private/vapid-private.json
```

Physical verification: installed iPhone → enable Avisos → outside silence/pause, Enviar prueba → tap notification → correct slot → one-tap log. Check D1 notification delivery timestamps over three days; provider acceptance alone does not prove the device displayed a notification.

## Progress, weight and sharing (M7, redesigned in 1.0)

Progreso → Anotar peso starts from the last weigh-in; ±0.1 steppers (hold to repeat) or typing, any date (Hoy, Ayer, calendar) and the source (en casa / con tu nutri). It works offline and syncs later; Deshacer reverts it. Tap a record in "Tus registros" to edit or delete it. The headline is the trend (local linear smoothing over ±14 days), not the last reading; the 28-day rate, a four-week projection and "¿Funciona tu plan?" need at least four weigh-ins over ten days. Weight stays in Progreso and the report, never on Hoy, toasts or push.

**Resumen** and **Para tu nutri** generate PNG files on the device. Compartir uses the native share sheet when file sharing is supported; Guardar imagen downloads a PNG. Cancellation creates no records. Season summaries use only their plan's logs and stored target snapshots. Pending descriptions count occasions but are excluded from the percent-in-plan calculation until portions are known. The denominator is recorded slot-days. Additional units aggregate positive slot deviations and unplanned extras by type and slot. The image shows the most frequent additional types and latest weigh-ins; the full JSON export retains all records.

A previous season recap appears once after activation of the next season and remains available in the past-season gallery. Shared recap gardens show up to the most recent 35 days with their date range; overall counts cover the entire season.

Progreso → Ajustes → Diagnóstico displays the last seven days of timing samples and error count. From 0.8.2, pending measurements survive offline operation and reopening in a bounded device-local queue. Successful responses acknowledge stable event IDs; failed sends retry. Each return to the foreground starts a new open-to-first-log measurement without counting background time. Provisional descriptions count too. Production smoke tests and Lighthouse suppress their telemetry to keep actual-use evidence separate.

Physical iPhone share/VoiceOver/Dynamic Type and the roadmap's multi-day real-use checks remain owner acceptance tasks; see [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md).
