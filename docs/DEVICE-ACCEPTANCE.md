# Remaining device acceptance

Updated: 2026-10-09, America/Mexico_City.

Production: https://fichas.toolco.workers.dev

The software for M1–M8 is present. Automated mobile profiles are not physical iPhone evidence. Keep these gates open until the owner reports the results; do not simulate production meals, plan transitions or elapsed days to satisfy them.

The 0.8.3 follow-up verifies that stale push preparations respect current silence, pauses, meals, plans and subscription changes before dispatch. This software verification does not close the device gates below.

| Gate | Check on the owner's installed iPhone | Evidence needed |
| --- | --- | --- |
| Installation and offline | Install from Safari, open from the Home Screen, enable airplane mode, record a real meal, close/reopen, then reconnect | Meal remains offline and later synchronizes; no duplicate |
| Dictation and photo | Dictate food, edit the transcript, select a plate photo, correct the preview, then approve or discard | Permission/fallback works; only explicit approval records food |
| Notifications | Progreso → Ajustes → Avisos → grant permission → Send test, outside quiet hours and pause | Notification arrives on the installed iPhone |
| Push deep link, A19 | Open a real scheduled meal notification and record that meal | Correct slot opens, recording fits the tap/time budget |
| Three-day notification rules | Use reminders normally for at least three days | Production delivery records show at most two attempts per app day, none during quiet hours; actual receipt is separately confirmed by the owner |
| Progreso, A16 and sharing | Add weights on different dates (Hoy, Ayer, calendar), edit one, inspect trend/rate/projection, generate "Para tu nutri" and "Resumen", share through WhatsApp or Mail | Values and images render correctly; native sharing completes |
| 1.0 redesign on the phone | After the update, "Fichas, renovada" appears once. Change day in the week strip and log yesterday; swipe the suggestion; check "Tu día" balancing after an over-plan breakfast; open a pantry food and change what it counts as; log a weigh-in for yesterday; watch today's plant grow and bloom; check sounds/haptics and dark mode | Every flow works one-handed; primary action above the tab bar; no clipped text at 130 % |
| Accessibility and feedback | Check light/dark mode, 130% text, VoiceOver labels/focus and sound/haptic switches | No clipping, inaccessible controls or unexpected feedback |
| Physical A1–A20 | Check §14.2 against actual phone interactions; A17 requires an actual new plan | Phone tap counts and timings, separate from automated profiles |
| Seven days of real use | Use the app normally for seven consecutive days and inspect Progreso → Ajustes → Diagnóstico | No blocking bug; median open-to-first-log ≤5 seconds |
| Real next plan | Upload the next nutritionist PDF/photos, review every dispute, confirm; inspect the prior season, logs and original | Actual new plan activates with previous history intact |

Production investigation on October 9 found zero active push subscriptions, reminders disabled, zero provider-accepted pushes, one confirmed plan and meals on two distinct app days. These counts establish that push delivery, seven-day use and the real next-plan transition cannot yet be marked accepted.

Device permission is granted through a tap inside the installed app. A deploy cannot grant it. A successful push-provider response is not proof that the owner received or opened the notification. Historical quiet-hour checks must account for the preferences in force when each notification was sent.

Use the safe default exchange rules until the nutritionist confirms the open questions in §19. Original plans, health records, screenshots and private artifacts stay out of GitHub.
