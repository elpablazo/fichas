# Implementation progress

Updated: 2026-10-10, America/Mexico_City.

Production: https://fichas.toolco.workers.dev

## Earlier M1 handoff

The previous agent had implemented most of M1 and some M2 client scaffolding. The repository had no commits, the most recent Playwright result was successful, and `docs/DECISIONS.md` contained M1 decisions only. These facts were checked against the actual source and Cloudflare account rather than inferred from the roadmap.

At takeover, Cloudflare reported that Worker `fichas` did not exist. Database `fichas-db` and R2 bucket `fichas-files` already existed, but remote migration `0001_init.sql` was unapplied. `lhci` was named in package scripts without its dependency or configuration.

## M1: deployed; automated acceptance passed; physical iPhone check pending

- Applied the initial migration to production D1.
- Seeded season 1, nine nutritionist dishes and nine default settings idempotently.
- Uploaded the original private PDF as base64 text to R2 under the existing storage decision.
- Created the Worker with static assets and configured the existing private pairing code as a Cloudflare secret after the owner's explicit authorization.
- Added pinned Lighthouse CI and Puppeteer Core dependencies, authenticated mobile audits and local-only report storage. Audit reports can contain plan data and must never be uploaded to public Lighthouse storage.
- Fixed the pending-slot button's accessible name to include its visible label. Added an explicit Lighthouse assertion for this audit even though Lighthouse does not include it in the category score.
- Added `npm run e2e:budgets` and a production smoke test (`npm run verify:production`). The production smoke test reads the plan and verifies offline rendering; it never changes meals, recipes or settings. Its temporary device session is revoked afterward.
- Full offline log persistence and reconnect-to-D1 behavior were verified in local E2E. A proposed temporary production meal test was rejected by automatic approval review and was replaced with the production read-only check.

### Automated evidence

| Check | Result |
| --- | --- |
| Biome and strict TypeScript | Passed |
| Domain unit suite | 72 passed |
| Worker integration suite | 11 passed |
| Mobile E2E | 20 tests passed; one intentionally skipped WebKit service-worker offline case |
| Action budgets | Nine M1 actions, 20 repetitions each on both mobile profiles; 360 measured action runs |
| Offline write and reopen | Passed on Chromium, then synced to local D1 |
| Production health, auth, plan and static assets | Passed |
| Production offline shell and suggestion | Passed |
| Copy lint | 303 strings passed |
| Secret scan | Passed; no secret or PDF included in commit candidates |
| Initial JavaScript | 63.6 KB gzip / 90 KB budget |
| CSS | 6.4 KB gzip / 15 KB budget |
| Precache | 132.1 KB transfer / 400 KB budget |
| Local Lighthouse, mobile, three runs | Performance 100, Accessibility 100, Best Practices 100 |
| Production Lighthouse, mobile, three runs | Performance 100, Accessibility 100, Best Practices 100; label/name audit passed |
| Client asset credential scan | No local credentials found |

All measured action maxima and immediate-feedback assertions passed. Timings below are p50 milliseconds from the automated browser checks, not measurements from the owner's phone. Chromium was throttled to 4x CPU; WebKit used the iPhone 13 profile.

| Action | iPhone WebKit | Pixel Chromium |
| --- | ---: | ---: |
| A1 open current meal | 55 | 117 |
| A2 log suggestion | 60 | 151 |
| A3 choose another and log | 97 | 183 |
| A4 log recent dish | 425 | 447 |
| A8 undo | 259 | 278 |
| A9 change a portion | 485 | 341 |
| A10 skip | 417 | 515 |
| A11 extra from recents | 486 | 522 |
| A20 manually compose | 1002 | 959 |

Deployed Worker version: `c949697e-85ec-4587-82cc-06d40a3a3219`. The production smoke screenshot is stored privately at `private/tmp/production-today.png`; Lighthouse reports are in ignored `.lighthouseci/reports/`.

The owner confirmed an iPhone with iOS 16.4 or later. Installation, physical airplane-mode logging, sound/haptics, dark mode and a VoiceOver spot check remain to be reported by the owner. M1 must not be marked fully accepted until that device check passes. The owner subsequently requested dictation and plate-photo review explicitly; the feature slice below is brought forward while those physical checks remain pending.

## Owner-requested dictation and photo review (0.2.0)

- Replaced the decorative microphone in the Today input with a writing icon. Describe now has a real "Dictar" control: optional Web Speech recognition in `es-MX`, editable transcript, start/stop, permission/error handling, cleanup and keyboard-microphone fallback. Dictation never submits or logs automatically.
- Added "Foto del plato" with camera capture/image selection. Client JPEG resizing strips metadata and limits the upload; no photo is persisted. `/api/ai/photo` authenticates/validates bounded raw JPEG base64 and sends only the image and food/portion table to OpenRouter. No original PDF, name or medical notes are added to the request.
- Photo detections populate editable text and the same review list as Describe. Approximate/assumed markers, quantity steppers, individual removal, text reparsing, explicit "Anotar", and "Descartar" are supported. Cancellation/generation checks prevent stale responses from overwriting corrections. Only an approved preview becomes a food record.
- Implemented `/api/ai/parse` for arbitrary text corrections and composite dishes. Exact local matches bypass AI; text cache includes plan, slot, model and prompt version. Server recomputation and unit validation override model arithmetic; provider retry, combined per-session limits and atomic daily attempt cap are covered by integration tests. Parsing never reads pantry or writes food logs.
- Owner explicitly authorized installing `OPENROUTER_API_KEY` in Cloudflare and sending chosen text/photos plus the portion table to OpenRouter. The secret is now installed; it is absent from client assets. An initial real-provider check was blocked by automatic approval review until this authorization arrived.
- Added the missing 40-case Appendix D fixture and `eval:parse` harness. Live provider tests use the actual production parsing code, keep detailed results under ignored `private/evals/`, and create no meals.

Verified locally: 72 domain tests, 21 Worker integration tests, 36 browser tests passed (one intentional WebKit offline skip), strict TypeScript/Biome, 317 copy strings, secret scan and bundle budgets. Browser coverage includes permission denial/fallback, edited dictation and explicit "Ver porciones" without keyboard submission, photo approval → local D1, rejection, corrections, unclear images, provider failure and stale-response cancellation. Final local mobile Lighthouse: 100 performance, 100 accessibility and 100 best practices in all three runs. Initial JS 63.9 KB gzip, CSS 6.5 KB and precache 134.3 KB.

Live vision identified rice, chicken and broccoli in a public plate photo and returned no foods for a blank image. It confused sweet potato with carrot; estimates remain subject to explicit review. These checks do not establish general photographic accuracy or physical iPhone capture/dictation behavior.

The selected `openai/gpt-6-luna` configuration passed the real 40-case parser thresholds: exact 100%, composite 83.33%, p50 1632 ms, p95 1998 ms, 41 billed attempts and USD 0.02623544 total. Default-reasoning Luna and Haiku baselines did not meet the full thresholds; the report table is in `DECISIONS.md`. Full M2 acceptance still requires provisional offline logging, pending processing and the remaining action budgets.

Cloudflare release: `0.2.0`, Worker version `f48d1580-43b4-4575-a634-c6014832a358`. Production photo → actual OpenRouter → editable detections → discard and street-food text → actual parser → preview → check-only passed without changing food logs or recipes. Production health/auth/plan synchronization/offline shell also passed. Production mobile Lighthouse on this release's feature build: 100 performance, 100 accessibility and 100 best practices in all three runs; final client assets contain no configured credentials. The new microphone/camera actions still need a physical iPhone check. No GitHub push was performed.

## Continuation release 0.2.1

This continuation started from a clean checkout at `e9e04a8` and the deployed 0.2.0 release. M2's real-provider evaluation was already passing, but deferred offline descriptions, Adjust through Describe and A5–A7 repetitions were missing. M3 and later milestones had only schemas and scaffolding.

### M2: deployed; automated acceptance passed; physical iPhone check pending

- Unknown offline descriptions require explicit **Anotar**, immediately count one occasion without fabricated portions, and persist the meal, pending job and outbox atomically.
- Reconnection parses against the original confirmed plan and updates the same log id, preserving day, eaten time, creation time and target snapshot. Failed reads retry with bounded backoff. Pulled provisional rows reconstruct the queue on another device.
- Undo/edit/delete wins over late responses; completed parses upsert a recipe once. Free foods still count as zero occasions. Exact local descriptions bypass AI, and check-only never logs.
- **Ajustar** opens Describe with the existing suggestion and editable ingredients.
- A full browser regression exposed and fixed a lazy-import render/effect race that could leave a sheet blank. Navigation/offline import failures no longer cause unwanted reloads.
- The prior real Appendix D evidence remains valid: the food model/prompt did not change. Physical iPhone acceptance is still pending.

### M3: implemented behind disabled reader configuration; not accepted

- Authenticated PDF/JPEG draft upload, original storage, duplicate detection, parallel independent readers, structured validation, consistency warnings and resumable review.
- Persistent Cloudflare Durable Object job per draft; 202 response after scheduling, automatic alarm retries, manual recovery after exhausted alarms, independent read caching and D1 result storage. Synthetic integration tests cover eviction, reconnect, deduplication, alarm recovery and discard before processing.
- One bounded, cached fast-model fallback for unmatched example lines; unknown IDs/incompatible units are rejected and remaining source lines appear as review warnings.
- Per-field disagreement choices, half-unit target edits, visual diff, source-file download, single-read/warning acknowledgements, Today/Tomorrow start and optional nutritionist weigh-in.
- Atomic archive/activate transition with concurrent-state guards, immutable confirmed plans/log snapshots, idempotent confirmation, historical plans/original files, automatic usual-dish re-portioning, renewal card and a skippable two-second season welcome.
- `eval:plan` is ready for the private current PDF. Candidates: `anthropic/claude-sonnet-5.5` and `google/gemini-2.5-pro`; neither is selected or enabled in production. Both reader vars stay empty, hiding upload and renewal entry points. The original seeded PDF remains available in Mi plan.

At release 0.2.1, automatic approval review had rejected the private-PDF transfer and authorization was pending. The owner subsequently explicitly authorized the transfer and provider credit; the live evaluation and activation are recorded below. Synthetic A17 still does not establish physical-phone latency.

### Automated evidence for 0.2.1

| Check | Result |
| --- | --- |
| Biome and four strict TypeScript projects | Passed |
| Domain unit suite | 79 passed |
| Worker integration suite | 35 passed |
| Final mobile regression | 59 passed; two WebKit service-worker cases intentionally skipped, both passed on Chromium |
| Twenty-repeat action budgets | 520 measured actions across M1, M2 and synthetic A17; all budgets passed; M2/A17 repeated on the final client build |
| Offline deferred description | Long text survives reopening and reconstructed queue; reconnect updates the original row in local D1; undo prevents resurrection |
| New targets and history | Changed Comida automatically shows three tortillas with a highlight; past targets remain intact |
| Copy lint | 358 strings passed |
| Repository/client secret scans | 161 repository candidates and 33 client files passed |
| Initial JavaScript | 66.0 KB gzip / 90 KB budget |
| CSS | 6.5 KB gzip / 15 KB budget |
| Precache | 144.2 KB transfer / 400 KB budget |
| Local mobile Lighthouse, three runs | Performance 100, Accessibility 100, Best Practices 100; label/name audit passed |
| Production mobile Lighthouse, three runs | Performance 100, Accessibility 100, Best Practices 100; label/name audit passed |
| Production smoke | Release 0.2.1, auth/plan/manifest/headers/SW, local Describe/check-only, intact authenticated PDF, offline shell and meal slots passed |

The production smoke encountered a real completed day and verified local Describe instead of a pending-card Adjust button. Adjust's prefilled preview passed local E2E. The first health check saw the previous release during propagation; the final check waited for 0.2.1. Production smoke and audits did not write meals or recipes or call AI.

Final M2/A17 twenty-repeat timings, p50 / maximum milliseconds:

| Action | iPhone WebKit | Pixel Chromium |
| --- | ---: | ---: |
| A5 describe and log | 550 / 692 | 672 / 730 |
| A6 check only | 598 / 645 | 615 / 647 |
| A7 fit preview | 55 / 71 | 52 / 56 |
| A17 synthetic readers | 2842 / 2916 | 2860 / 2892 |

Chromium used 4x CPU throttling; these browser profiles are not physical-phone measurements. A17 uses mocked readers and does not prove real-PDF latency. The unchanged live food parser retains its prior 40-case passing evidence (exact 100%, composite 83.33%, p50 1632 ms, p95 1998 ms).

Applied remote migration `0002_plan_integrity.sql`; deployed release **0.2.1**, Worker version `a8b3ecf9-6ace-4d06-9d7b-a54428479314`, with `PLAN_JOBS` and both plan-reader vars still empty. The original source remains intact in R2. Reports/screenshots remain ignored and private. No GitHub push was performed.

## Remaining roadmap

### October 9 takeover

The previous agent's last commit was `3f7dd79` (M5). Actual Cloudflare production still served **0.5.0**, Worker version `d5ae5526-4425-4aad-ad96-1f9166f3bb95`. The working tree contained an unfinished M6 slice: the missing notification button copy broke TypeScript, push had no integration coverage, and `VAPID_PRIVATE_KEY` was absent from the deployed Worker. The existing generated VAPID identity and all private artifacts were preserved; nothing was uploaded to GitHub.

This continuation completes the M6 software and the independent M7/M8 software work while keeping the physical-device and elapsed-real-use acceptance gates open. Automatic approval review initially rejected installing the private VAPID credential and creating a health-data backup in R2. The owner subsequently explicitly authorized both operations; release 0.8.1 installs the existing key and enables backups. The additive remote `0003_push_delivery.sql` migration has been applied.

| Milestone | Existing groundwork | Still required |
| --- | --- | --- |
| M2: AI describe/check | Text/photo review, local/free/check-only/fit flows, passing real 40-case eval, persistent provisional queue and same-row processing, Adjust through Describe, deployed passing automated budgets/checks | Physical iPhone acceptance |
| M3: plan versions | Upload/draft/read/review/confirm, persistent dual-read jobs, fallback mapping, integrity migration, diff/season welcome/history/originals, renewal card and synthetic coverage | Real next-plan transition and physical A17 |
| M4: habit loop | Deployed day close/tomorrow, garden, stamps, levels/styles, surprises, comeback/backfill and recap; domain/visual fixtures, anti-shame audit and A14–A15 pass | Physical iPhone acceptance |
| M5: kitchen | Deployed Kitchen, local/offline inventory, deterministic/validated AI ideas, shopping list, menu integration and stamp; A12–A13 pass | Physical iPhone acceptance |
| M6: reminders | Priming/settings, authenticated subscriptions/test endpoint, installed VAPID identity, aes128gcm sending, quiet hours/pause/caps/learned times/back-off/renewal, 35 scheduler scenarios and mobile deep links implemented | Installed iPhone permission/subscription, real delivery and three days of production evidence |
| M7: story/check-in | Offline manual weigh-ins, native prefilled wheels, neutral trend, automatic previous-season recap, past gallery, PNG recap/report and JSON export implemented | Physical iPhone A16 and WhatsApp/Mail sharing acceptance |
| M8: hardening | Active weekly private R2 backups, eight-copy retention, first production snapshot and isolated local recovery verified, focus trapping, diagnostics, copy/secret scans implemented | Physical camera/photo/VoiceOver/Dynamic Type review, seven real days of use, real new-plan transition and final phone budgets |

`scheduled()` runs the configured notification scheduler and, independently, the enabled Sunday 03:00 local R2 backup. Push requires an actual device subscription and enabled owner settings. Plan-reader models are active from 0.3.0. Physical acceptance and the real-use gates remain open.

The complete product is not finished: §20 additionally requires a real next-plan transition, real push delivery, seven days of real use and all budgets on the owner's physical phone. No GitHub push has been performed.

## Next implementation point

Collect real iPhone acceptance, three days of delivered-push evidence and seven days of real use, then validate the owner's real next plan. All currently available software work is implemented and deployed; the latest dispatch fix and verification are recorded under **Notification dispatch follow-up (0.8.3)** below. Keep the safe default exchange rules until nutritionist confirmation; browser profiles do not replace physical acceptance.

Owner clarification: both food bought outside (street food, restaurants, takeout) and home cooking must be supported. Pantry is optional and never a prerequisite for logging/checking. Local matching, Composer and the text/photo parsers use the nutritionist equivalents independently of pantry. Integration coverage verifies outside-food parsing while chicken is marked out of stock; the preview approval sync check uses an empty pantry. Kitchen inventory/suggestions are deployed from M5.


## M3 activation (0.3.0)

The owner explicitly authorized sending the full private current PDF to OpenRouter and using provider credit. The original remains ignored and private. The real `plan-dual-3` readers are `anthropic/claude-sonnet-5.5` and `google/gemini-3.1-pro-preview`, both with low reasoning. Both recovered all five targets and times and matched 189/192 equivalent IDs (98.4375%). Every remaining ambiguous/missing equivalent has a dispute or review flag; 19 disputes remain for explicit owner review. Raw read times were 27.060 s and 45.663 s; billed costs USD 0.067158 and 0.086888. These are reader timings, not full A17 phone timings.

Provider grammar omits bounds that Gemini rejects; the full Zod bounds remain enforced on the server. Deterministic food-name canonicalization uses only vocabulary, preserves extracted quantities/units and retains conflicting portions as flagged variants. No golden quantities are inserted. Replay metrics preserve actual provider read times/costs and check the source hash.

Verification: 82 unit tests, 36 Worker tests, 59 browser tests passed (two WebKit service-worker skips covered on Chromium); Biome/four strict TypeScript projects, copy and secret scans, client budgets passed. Local mobile Lighthouse passed all assertions in three runs. Initial JS 66.0 KB gzip, CSS 6.5 KB, precache 144.2 KB. Production smoke verified release 0.3.0, enabled upload entry, auth, intact original PDF, local Describe/check-only and offline rendering without writing food records.

Cloudflare Worker version `d5a5c19b-ac75-446b-b26d-216383d3a6d1`. No GitHub push. M3 software and golden gates pass; the owner's real next plan and physical-phone A17 remain pending. M4 is the next implementation milestone.

## M4 habit loop (0.4.0)

Deployed the skippable day-close bloom and one-tap tomorrow menu; accepted dishes always lead suggestions. Story now has a paginated seasonal garden, persistent levels, eleven stamps, unlocked flower styles and favorites. Surprise/comeback rewards wait for food feedback and preserve Undo. Progress never falls after undo or missing a day; the anti-shame implementation review is recorded in DECISIONS.md. Backfill presents one unresolved meal at a time and preserves its historical day, plan and target. Monday recap uses the previous seven days.

Verification: 97 domain tests, 37 Worker tests and 74 mobile browser tests passed, with three WebKit service-worker cases covered on Chromium. Twenty-repeat budgets measured 600 actions across the existing flows and A14/A15, all passing. Final-build A14 p50/max: iPhone 39/71 ms, Pixel 85/93 ms; A15: iPhone 49/71 ms, Pixel 71/77 ms. Light/dark flower snapshots passed on both profiles. Chromium used 4x CPU throttling; these are browser proxies, not physical-device results.

Biome, four TypeScript projects, copy lint (380 strings), secret scans and bundle budgets passed. Initial JS 71.2 KB gzip, CSS 6.8 KB, precache 154.1 KB. Three local mobile Lighthouse runs scored 100 Performance, Accessibility and Best Practices. Production smoke passed release/auth/plan/original-PDF/offline checks with AI and food-data writes blocked.

Cloudflare Worker version `3f32f63f-ce7e-42cc-ad04-4b956c4fc1c7`, release **0.4.0**. No GitHub push. Physical iPhone/VoiceOver acceptance remains pending; M5 is in progress.

## M5 kitchen (0.5.0)

Kitchen now has immediate stock chips, staples, text/dictation add, deterministic portions and at most three ideas. Unknown food names persist offline and link after reconnect; late responses respect Undo/edits. A synchronous browser journal protects immediate reopening, and pull/outbox reads share a transaction to protect concurrent writes. Shopping combines out items with accepted menu needs. Anotar records explicitly; Para luego fits tomorrow's plan. Kitchen's stamp is visible. Outside-food describe/check/photo/manual logging stays independent of stock.

Two live generic-food checks passed with `openai/gpt-6-luna`, `kitchen-1`: pantry 2314 ms, ideas 2633 ms, USD 0.001397475 total. Provider ideas are validated on both server and client; stale, unavailable or incompatible results are discarded without reordering local ideas. No production inventory or meal was created by evaluation.

Verification: 102 domain tests, 41 Worker tests, 83 mobile browser tests passed (four WebKit service-worker cases covered on Chromium). Final A12/A13 budgets measured 120 actions. A12 p50/max: iPhone 48/99 ms, Pixel 111/130 ms; local idea paint 4/5 and 10/12 ms. A13 p50/max: iPhone 60/111 ms, Pixel 65/120 ms; chip paint 2/15 and 5/23 ms. Fixtures use distinct suite/device date ranges. These are browser proxies with 4x Chromium CPU throttling, not phone measurements.

Biome/four TypeScript projects, copy lint (398 strings), repository/client secret scans and bundle budgets passed. Initial JS 72.8 KB gzip, CSS 6.9 KB, precache 161.5 KB. Three local Lighthouse runs scored 100 in Performance, Accessibility and Best Practices. Production smoke includes read-only Kitchen/shopping and offline Kitchen rendering; AI and synchronization writes are blocked.

Cloudflare Worker version `d5ae5526-4425-4aad-ad96-1f9166f3bb95`, release **0.5.0**. No GitHub push. Physical-phone checks remain pending; M6 is next.

## M6–M8 software continuation (0.8.0)

Deployed release **0.8.0**, Worker version `9da43d49-6a27-4944-a52c-c0f0958ea09b`, to the existing Cloudflare URL. No GitHub push or local commit was performed. The earlier M6 work was repaired and completed; M7 and the independent M8 hardening are now implemented. These milestones are not fully accepted because their physical-device, authorization and real-use gates remain open.

- M6: standalone priming, direct-tap permission, authenticated subscriptions, settings/pause/quiet hours/per-slot controls, aes128gcm push payloads, atomic daily claims, learned timing, inactivity/back-off and renewal reminders. Missing private key returns unavailable. Delivery cleanup, concurrent caps and the precise three-hour acted-on window have integration coverage.
- M7: offline manual weigh-ins with native prefilled controls and Undo, neutral trend, automatic prior-season recap, past gallery, local PNG recap/report and share/download fallback. Reports use historical targets, explicitly exclude unknown provisional portions from percentages, distinguish duplicate slot labels by time, and handle singular/empty text. Weight remains outside Today and rewards.
- M8: consistent versioned exports, eight-copy weekly private R2 backup implementation, isolated local recovery, focus trapping/restoration, accessible controls, diagnostics and operational documentation. `BACKUPS_ENABLED=false` gates cron, API and direct creation pending approval.

| Verification | Result |
| --- | --- |
| Biome and four strict TypeScript projects | Passed |
| Domain tests | 139 passed, including 35 nudge scenarios and story fixtures |
| Worker integration tests | 53 passed, including disabled-backup enforcement |
| Mobile regression | 95 unique cases passed; four intentional WebKit service-worker skips covered on Chromium |
| Action budgets | A1–A20 passed with twenty repetitions per mobile profile; A17 uses mocked readers |
| Story final text/image regression | Seven tests passed after the final PNG caption corrections |
| Copy lint | 458 strings passed |
| Secret scans | 218 repository candidates and 53 final client files passed |
| Initial JS / CSS / precache | 75.6 KB gzip / 6.9 KB gzip / 170.9 KB transfer; all within budget |
| Local mobile Lighthouse | Three runs: Performance 97, Accessibility 100, Best Practices 100 |
| Final production mobile Lighthouse | Three runs: 100 in all three categories; label/name assertion passed |
| Final production smoke | Auth, plan, intact original PDF, Describe/check-only, Kitchen, Story/report PNG, notification settings and offline reload passed |
| Restore CLI | Synthetic snapshot restored in a fresh local D1 database; every table count verified |

The general twenty-repeat browser run passed 93 cases but exposed two A16 test-preparation failures: the installed fake clock hides resource timing entries. Waiting for the actual lazy chunk response fixed the precondition. The focused Story run then passed all seven cases, including both twenty-repeat A16 budgets. Subsequent PNG-only caption changes passed the seven-case final Story regression. The app's service-worker-enabled offline behavior is also covered by the production smoke. No meals, recipes or settings were written by production verification; its temporary sessions and this release's Lighthouse session were revoked.

New twenty-repeat timings, p50 / maximum milliseconds:

| Action | iPhone WebKit | Pixel Chromium |
| --- | ---: | ---: |
| A16 manual weight | 407 / 439 | 466 / 561 |
| A18 reminder activation | 1055 / 1161 | 1098 / 1124 |
| A19 push link and log | 210 / 383 | 521 / 828 |
| A17 mocked plan transition | 2852 / 2970 | 2858 / 2900 |

Chromium used 4x CPU throttling. These are automated profiles, not physical iPhone measurements; permission and push-link tests simulate the browser APIs and do not establish real delivery.

At the initial 0.8.0 handoff, automatic approval review had blocked installing `VAPID_PRIVATE_KEY` and creating a production health-data snapshot in private R2. Separate explicit owner approval requests were pending. Neither operation was retried or performed indirectly before authorization; backups stayed disabled, and recovery used a synthetic local fixture. The authorization and operational checks were subsequently completed in 0.8.1 below.

Artifacts remain ignored/private: `private/tmp/e2e-budget.log`, `private/tmp/e2e-story-budget.log`, `private/tmp/e2e-story-final.log`, `private/tmp/final-worker-tests.log`, `private/tmp/production-verify.log`, `private/tmp/production-report.png`, and `.lighthouseci/reports/`. The original `arch.zip` and private credentials/files were preserved and excluded from commit candidates.

## Authorized activation (0.8.1)

The owner explicitly authorized the pending VAPID and private R2 backup operations, including download and isolated local recovery, and requested proactive continuation without repeated permission questions. Both approval blocks are resolved.

Deployed **0.8.1**, Worker version `8483a049-69ca-42fd-a5b5-c02df991d3b2`, to the existing Cloudflare URL. The existing `VAPID_PRIVATE_KEY` is installed; its signature verifies against the unchanged public identity. `BACKUPS_ENABLED=true` enables the independent weekly Sunday 03:00 local cron and authenticated manual creation, retaining up to eight copies. No GitHub push or local commit was performed.

The first real backup, `backup/2026-10-09.json`, was created in private R2, downloaded with mode 0600 to ignored `private/backups/2026-10-09.json`, validated, and restored into fresh isolated local D1 persistence. Every synced table count matched; confirmed-plan original files remained authenticated and available. Schema/version and absence of session/push credentials, the pairing code and the VAPID private scalar were checked. Production rows were preserved.

Validation: four strict TypeScript projects and production build passed; all 53 Worker tests passed with backups enabled, including the explicit disabled-configuration guard. Biome, repository/client secret scans and bundle budgets passed. The production smoke additionally verifies the deployed public VAPID identity and passed the plan/original-PDF/Describe/Kitchen/Story/settings/offline checks. One initial browser navigation returned `ERR_EMPTY_RESPONSE`; direct HTTP checks returned 200 and the complete browser rerun passed. A permission-review timeout was retried once as permitted; it did not leave any operation blocked.

Final production Lighthouse on 0.8.1 passed three runs at **100 Performance / 100 Accessibility / 100 Best Practices**, including the label/name assertion. The audit warm-up encountered the same transient empty initial response, so verification tools now permit at most three initial GET attempts for that network error. Measured audit navigations and application/HTTP assertions still fail normally. Production smoke, backup verification and Lighthouse temporary sessions were revoked after verification.

Production currently has **zero push subscriptions**, reminder preferences disabled and no delivery history. The server is configured, but device notification permission must be granted inside the installed app; it cannot be supplied by the deployment. Real iPhone delivery/deep links, three days of notification evidence, sharing/VoiceOver/Dynamic Type, physical budgets, seven days of actual use and the real next-plan transition remain the only roadmap acceptance gates. No real-device result or elapsed-use evidence was fabricated.

Activation artifacts: `private/tmp/activation-worker-tests.log`, `private/tmp/backup-verify.log`, `private/tmp/push-production-state.json`, `private/tmp/production-verify.log`, and the private restored database printed by the recovery command. All credentials, backups and reports remain excluded from commit candidates.

## Reliability continuation (0.8.2)

The new takeover verified Cloudflare's actual deployment `8483a049-69ca-42fd-a5b5-c02df991d3b2` (0.8.1), all three configured secret names and no pending D1 migrations. HEAD remained the M5 commit `3f7dd79`; the earlier M6–M8 work was uncommitted and preserved. Read-only production aggregates found zero active push subscriptions, reminders disabled, zero provider-accepted pushes, one confirmed plan and meals on two distinct app days; the query wrote zero rows.

M8 still had software reliability issues despite the previous passing handoff:

- Failed telemetry sends discarded measurements, and a persistent installed-app page measured only its first log. Measurements now persist in the existing local IndexedDB table until acknowledgement, survive reopening, retry on reconnection and use a fresh timer for each foreground visit. Offline provisional descriptions participate too.
- Large error batches could exceed the keepalive body limit. UTF-8 payloads are now bounded to 60,000 bytes, with at most 500 queued events and 20 errors per foreground visit. Stable IDs and server deduplication prevent a lost acknowledgement from inflating sample counts.
- Diagnostics selected the upper middle observation instead of the median for even sample counts. Percentile interpolation now returns the actual median; integration fixtures cover the seven-day filter and retransmission.
- Service-worker installation skipped HTTP-failed assets, allowing an incomplete offline shell to activate. It now rejects HTTP/network failures and HTML SPA fallbacks, repairs invalid cached scripts/styles and preserves the previous shell on failure.
- Production smoke and Lighthouse suppress automation telemetry; their samples no longer enter actual-use diagnostics. The original local Wrangler state was preserved before constructing the fresh browser-test database.
- The full twenty-repeat run passed every action budget and 100 browser cases, but exposed a real initial-settings race in the Chromium permission-denial case. First-pull readiness now publishes the committed local settings in the same signal batch, so the notification switch cannot become enabled with its empty/default state. The denial test seeds the remote state, observes the first enabled frame and supports twenty repetitions.
- Local Lighthouse exposed a snapshot/recovery-card layout shift (CLS 0.154; scores 94/100/94) that the previous optimistic assertion aggregation accepted. Today now preserves its day/plan-specific compact presentation and banner space until recovery data is ready. A blocked-pull regression verifies that the meal stays readable at the same position and height before and after hydration. Lighthouse now requires every measured run to meet the unchanged thresholds.

Final automated regression passed **103 browser cases**, including both new snapshot-layout cases, with four intentional WebKit service-worker skips covered on Chromium. The guarded startup also passed forty permission-denial iterations (twenty per profile), including the first enabled switch state, and both twenty-repeat A1 profiles. The repeated denial fixture now waits for the previous preference change to reach the server before seeding the next iteration. All A1–A20 budgets passed the full twenty-repeat run; A17 still uses mocked readers.

The final snapshot-layout fix passed both geometry regressions and twenty A1 repetitions per profile: WebKit p50/max **59/92 ms**, Chromium (4x CPU throttling) **121/173 ms**.

Final checks: **144 unit tests**, **55 Worker integration tests**, Biome and four strict TypeScript projects passed. Copy lint checked 458 strings; secret scans checked 223 repository candidates and 53 client files. Bundle sizes remain within budget: initial JavaScript 76.2 KB gzip, CSS 6.9 KB gzip and precache 171.6 KB transfer.

Deployed the final **0.8.2** package to https://fichas.toolco.workers.dev, Worker version `e113c4a9-cc39-44e6-beb1-d9b02e195a3d`. Three local and three production mobile Lighthouse runs each scored **100 Performance / 100 Accessibility / 100 Best Practices**, with **CLS 0** and the label/name assertion passed under the stricter aggregation. Final production smoke passed auth, sync, unchanged public VAPID identity, authenticated intact original PDF, Describe/check-only, Kitchen, Story/report PNG, notification settings and offline reload, with owner-data writes and AI blocked. Its session and both release audit sessions were revoked; the final audit session count was verified as zero.

The original local Wrangler state was restored after every local server stopped. All 28 files matched their saved sizes and SHA-256 hashes across restoration; generated test state was archived separately in ignored `private/tmp/`. No local commit or GitHub push was performed. Provider/model configuration, the existing VAPID identity and production owner records were preserved.

Private verification artifacts: `private/tmp/continuation-0.8.2-budgets.log`, `private/tmp/continuation-0.8.2-permission-repeats.log`, `private/tmp/continuation-0.8.2-layout-regression.log`, `private/tmp/continuation-0.8.2-final-e2e.log`, `private/tmp/continuation-0.8.2-worker.log`, `private/tmp/continuation-0.8.2-local-lighthouse-scores.json`, `private/tmp/continuation-0.8.2-production-lighthouse-scores.json`, `private/tmp/continuation-0.8.2-production-smoke.log`, `private/tmp/continuation-0.8.2-deploy.log` and `private/tmp/continuation-0.8.2-local-state-restored.json`. Authenticated Lighthouse reports remain local in `.lighthouseci/reports/`.

The physical and elapsed-use gates remain open. [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md) lists the remaining owner checks; no new plan, meal, device permission or elapsed-use evidence is fabricated.

## Notification dispatch follow-up (0.8.3)

The owner requested further continuation. A read-only Cloudflare query again found zero active push subscriptions, reminders disabled, zero provider-accepted pushes, one confirmed plan and meals on two app days; it wrote zero rows. This leaves the physical and elapsed-use gates open.

The follow-up found a concrete M6 timing gap: admission checks occurred before preparing push requests, while dispatch continued even if quiet hours began, a pause/master switch changed or a subscription was revoked. A delayed cron also evaluated its original scheduled timestamp rather than actual execution time. Nine new regressions reproduced these failures on 0.8.2; all pass with the fix.

- Reminder cron now evaluates actual execution time. The independent authorized backup schedule still uses its scheduled timestamp.
- Delivery reloads current policy and state before reserving an attempt, then again after encryption immediately before each provider request. Current app day, silence, pause, master/per-slot switches, meal resolution, inactivity, confirmed plan and current subscription identity are enforced.
- A reserved attempt is excluded only from its own eligibility check, while the atomic global two-attempt cap remains enforced. A preparation cancelled after reservation remains a failed attempt; retries cannot bypass the cap. If an earlier device's provider accepted the push, that acceptance remains recorded while remaining stale sends stop.
- Only active/archived confirmed plans enter scheduling. Changed subscription keys cancel requests encrypted for the old keys.

Validation: **144 unit tests**, **72 Worker integration tests** and all four strict TypeScript projects passed; Biome, 458-string copy lint, repository/client secret scans and bundle budgets passed. The seventeen added Worker cases include eligible meal and renewal delivery, policy changes during first-request encryption, multiple-device races, updated subscription keys, logged meals, owner activity, plan replacement, the app-day boundary and a delayed cron. The concurrent two-attempt cap and provider failure/expiration tests still pass. Client flows were unchanged; the 103-case browser regression and physical-budget distinctions remain recorded for 0.8.2 above.

Deployed **0.8.3**, Worker version `fd43539b-a74a-4ce6-9778-77c64e9901ae`, to https://fichas.toolco.workers.dev. Final production smoke passed health/version, auth/sync, public VAPID identity, intact authenticated original PDF, Describe/check-only, Kitchen, Story/report PNG, notification settings and offline reload. Verification blocked owner-data writes, telemetry and AI; its temporary session was revoked. No original local-state reset, new remote migration, secret rotation, owner-data edit, commit or GitHub push was performed.

Final production mobile Lighthouse passed all three runs at **100 Performance / 100 Accessibility / 100 Best Practices**, **CLS 0** and the label/name assertion. Its temporary audit session was revoked and zero remaining active audit sessions verified. Initial JavaScript **76.2 KB gzip**, CSS **6.9 KB gzip** and precache **171.6 KB transfer** remain within budget.

Private artifacts: `private/tmp/continuation-0.8.3-production-baseline.log`, `private/tmp/continuation-0.8.3-push-before.log`, `private/tmp/continuation-0.8.3-worker.log`, `private/tmp/continuation-0.8.3-unit.log`, `private/tmp/continuation-0.8.3-lint.log`, `private/tmp/continuation-0.8.3-build.log`, `private/tmp/continuation-0.8.3-deploy.log`, `private/tmp/continuation-0.8.3-production-smoke.log`, `private/tmp/continuation-0.8.3-production-lighthouse-scores.json` and `private/tmp/continuation-0.8.3-audit-session-cleanup.log`.

Next: the actual installed-device acceptance, three-day delivery evidence, seven consecutive real-use days and the owner's real next-plan transition in [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md). No test fixture establishes any of these gates.

## Fichas 1.0 redesign, stage 1 (0.9.0)

The owner asked for a complete audit and redesign (2026-10-09), then for autonomous completion with gradual deployments. The audit, principles, information architecture, design system and verification table are in [03-redesign.md](03-redesign.md); decisions are in [DECISIONS.md](DECISIONS.md#fichas-10-redesign-2026-10-09).

What shipped:

- **Any day.** Week strip with each day's plant, ‹ ›, a calendar, and tomorrow as a planning view. Past days can be logged, edited and skipped (source `backfill`, planned time).
- **"Tu día" and balancing.** Per-type gauges for the day, a day sheet, and capped within-day balancing that is on by default and can be switched off in the sheet or Ajustes.
- **Design system.** New tokens, components and motion; coins in capsules; Lucide icons only; keyboard-only focus rings; designed empty states.
- **Garden.** 23 species with growth stages, a secret daily species, rare and seasonal finds, herbarium, visitors, new stamp "Día cuadrado", marimba sounds, confetti and papel picado.
- **Kitchen.** Ideas per meal, a pantry grouped by food type with a food sheet (what it counts as, manual linking, AI retry, staple, remove), dishes and the shopping list.
- **Weight.** Dated entries with edit and delete, local linear trend, 28-day rate with an 80 % interval, a four-week projection and "¿Funciona tu plan?".

Bugs found and fixed while verifying:

- The current meal was below the fold when a banner showed. The meal card now comes first.
- The weight trend lagged above recent weigh-ins (exponential average). It now uses local linear smoothing.
- `main.anim-fade` created a stacking context that trapped in-page sheets under the tab bar. The fade now fills `backwards`.
- The initial bundle reached 95.6 KB, over the 90 KB budget. Lazy reward evaluation, plant renderer, confetti, tomorrow's menu and split copy bring it to 88.8 KB.
- Lighthouse found week-strip buttons whose names didn't contain their visible text (WCAG 2.5.3). The audit pass also caught small text in `--ink-3` (3.6:1). Day cells, pantry rows, tomorrow's menu, the stamps tile and season start are now named by their content, and all small text uses `--ink-2`.
- "Novedades" opened on new devices and covered first-run cards. It now shows only on installed apps upgrading from 0.8.
- Repeated slot names ("Colación") were ambiguous in Cocina and tomorrow's menu. They now show their time.

### Evidence

| Check | Result |
| --- | --- |
| Unit / Worker suites | 163 / 72 passed |
| Biome, four strict TypeScript projects, copy lint | Passed (667 strings) |
| Browser regression (fresh local D1, WebKit iPhone 13 + Chromium Pixel 7 at 4× CPU) | 105 passed, 4 intentional WebKit service-worker skips |
| Bundle | Initial JS 88.8 KB gzip (≤ 90), CSS 9.5 KB (≤ 15), precache 220.8 KB (≤ 400) |
| Secret scans | Repository and client passed |
| Local Lighthouse, 3 runs | 100 / 100 / 100, CLS 0, LCP ≈ 0.71 s |
| Production Lighthouse, 3 runs | 100 / 100 / 100, CLS 0, LCP ≈ 0.77 s |
| Production smoke | Health/auth/sync/VAPID/headers/SW, Adjust → Describe, check-only and authenticated PDF, Kitchen + dishes + list, day strip and garden, Progress weight/report PNG and notification settings, offline reload. Owner-data writes, AI and telemetry blocked; session revoked. |

Deployed **0.9.0** as Worker version `07de4144-aed2-447d-bae1-1979b8dd8fb2` (previous: `fd43539b-a74a-4ce6-9778-77c64e9901ae`, 0.8.3). No D1 migration was needed. After the production audit, four never-reused `Lighthouse` sessions were revoked: this run's and three left by earlier audits. Only the owner's iPhone and Mac sessions remain active. The work is committed on local branch `redesign-1.0` (`6cac84f`); nothing was pushed to GitHub.

Private artifacts: `private/tmp/redesign-e2e-5.log`, `private/tmp/redesign-0.9.0-local-lighthouse-scores.json`, `private/tmp/redesign-0.9.0-deploy.log`, `private/tmp/redesign-0.9.0-production-smoke.log`, `private/tmp/redesign-0.9.0-production-lighthouse.log`, `private/tmp/redesign-0.9.0-audit-session-cleanup.log`; visual QA screenshots in `private/tmp/screens/`.

Open: the physical-device checks in [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md) (now including the 1.0 checks), and the nutritionist's confirmation of the balancing rules (§3.3 of the redesign).

## Fichas 1.0.0

The second deploy finishes the redesign. Changes since 0.9.0:

- **Relink a pantry food.** "Cambiar" in the food sheet changes what it counts as.
- **Snack names.** Repeated slot names show their time ("Colación · 1 pm") in Cocina, tomorrow's menu and Describe.
- **Accurate balancing toasts.** "Lo cuadramos" appears only when cuadrar el día really trims that type later today.
- **Copy without scores.** The weekly recap counts days logged; the day-close line no longer implies a bad day; level copy has correct agreement and a singular form.
- **Eight new browser tests** for the core 1.0 flows: any-day logging at the planned time, balancing on/off, dated weigh-in edit/delete, and pantry link/relink. They found two cross-test sync races (writes left in a closed page's outbox); the tests now wait for the server.

### Evidence

| Check | Result |
| --- | --- |
| Unit / Worker suites | 163 / 72 passed |
| Biome, four strict TypeScript projects, copy lint | Passed (673 strings) |
| Browser regression | 113 passed, 4 intentional WebKit service-worker skips |
| Twenty-repeat budgets (A1–A20) | All passed. A1 first card p50 82 ms (WebKit) / 219 ms (Chromium 4×); A2 one-tap log 94 / 210 ms; A13 pantry paint 53 / 96 ms |
| Bundle | Initial JS 89.0 KB gzip (≤ 90: little headroom left, so new features should load lazily), CSS 9.5 KB, precache 221.2 KB |
| Secret scans | Repository and client passed |
| Local Lighthouse, 3 runs | 99–100 / 100 / 100, CLS 0 |
| Production Lighthouse, 3 runs | 100 / 100 / 100, CLS 0 |
| Production smoke | All seven checks passed, including day strip, garden and offline reload; writes, AI and telemetry blocked; session revoked |

Deployed **1.0.0** as Worker version `ec68af45-d419-49aa-87b3-fb54c2fa12f6` (previous: `07de4144-aed2-447d-bae1-1979b8dd8fb2`, 0.9.0). Rollback: `npm run cf -- rollback <version-id>`. The production audit session was revoked; only the owner's iPhone and Mac sessions remain active. Commits `6cac84f` (0.9.0) and `e4772cd` (1.0.0) are on local branch `redesign-1.0`; nothing was pushed to GitHub.

Private artifacts: `private/tmp/redesign-e2e-6.log`, `private/tmp/redesign-1.0.0-budgets.log`, `private/tmp/redesign-1.0.0-local-lighthouse-scores.json`, `private/tmp/redesign-1.0.0-deploy.log`, `private/tmp/redesign-1.0.0-production-smoke.log`, `private/tmp/redesign-1.0.0-production-lighthouse-scores.json`, `private/tmp/redesign-1.0.0-audit-session-cleanup.log`; screenshots in `private/tmp/screens/`.

Open:

- **Owner checks on the phone:** the 1.0 row in [DEVICE-ACCEPTANCE.md](DEVICE-ACCEPTANCE.md), plus the earlier physical and elapsed-use gates.
- **Nutritionist:** confirm the balancing rules (redesign §3.3). Cuadrar el día is on by default and can be switched off in the day sheet or Ajustes.
- **Next plan (~2026-10-22):** upload it from Progreso → Mi plan; the renewal card on Hoy points there.

## Fichas 1.1.0

**Exportar comidas.** Ajustes → Tus datos → "Mis comidas para mi nutrióloga": choose a date range (7/15/30 days or any From/To), see a preview, then share, copy or save a `.txt`. It lists dishes and portions per day ("Comida (2:30 pm): Pollo con arroz — 120 g pollo, 1 tza arroz"), never exchange units. The full JSON export stays as "Copia de seguridad completa". Built as a lazy sheet (`sheets/ExportMeals.tsx`) over a pure builder (`shared/domain/export-meals.ts`); initial JS unchanged at 89.0 KB. Unit (3) and browser (1) tests added.

**1.1.1.** Progreso → "Para tu nutri" now opens the same meals export (it used to open the season report image, which listed exchange units). The season report is no longer reachable from the UI; its code (`SeasonRecap` mode `report`) is untouched.

## Fichas 1.2.0 — "¿Cómo voy?"

Hoy rebuilt around two moments (decide before a meal, record after it); spec and audit in [04-today-2.md](04-today-2.md), decisions in DECISIONS.md.

- **Tu día first:** one tank per food group (what's left today, a pace notch, "+n" floats when food lands) and one line in words with the change that keeps the day on plan ("Para cuadrar: 1 tortilla menos en la cena").
- **Now card by the clock:** before a meal, one real dish (fit never adds foods anymore), "Me late" to keep it, "Checar un antojo"; after it, "¿Qué comiste?" (one tap if it was the planned dish).
- **Describe is live:** local matches while typing, JEV food groups for unknown phrases (`/api/ai/classify`), meal AI portions after a pause, the day's tanks as preview, one button.
- **Simpler everywhere:** no coin capsules in the meal list (verdict chips instead), no dish list in the meal sheet, a plain "Ayer quedaron n sin anotar", impersonal copy enforced by copy-lint.
- **Fixed:** photos from the meal sheet never reached Describe; offline descriptions for a past day were logged to today; first-person copy in the day sheet.
- **Tests:** unit 175 (new `daystatus`, suggestion regression, `unknownPhrases`), worker 76 (new JEV suite), browser specs rewritten for the new flows (Chromium; WebKit and the darwin garden snapshots were not runnable in this environment). Initial JS 89.3 / 90 KB gzip.
- **Not done here:** deployment (`npm run deploy`) and a live JEV call — the sandbox had no Cloudflare credentials and could not reach `api.typesafe.ai`; `verify:production` now checks JEV after deploying.
