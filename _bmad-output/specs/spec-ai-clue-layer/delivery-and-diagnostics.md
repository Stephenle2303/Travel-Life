# Delivery and diagnostics

## Stories

| Story | Caps | Depends | Done when |
| --- | --- | --- | --- |
| M11.1 Clue store | CAP-1, CAP-2 | **Done** | Validity rules (`clues/store.ts`) and detector consumption (`clues/consumption.ts`: `qualifyTripOutcomeWithClues`, `qualifyGraphJourneyWithClues`) implemented and tested — a clue can lower a trip, never raise one, zero clues equals M10 exactly. SQLite persistence (`migrationV49`'s `travel_clue` table, `loadClues`/`saveClues`/`updateClueStates`) and production wiring (`reconstruction/repository.ts`'s rebuild now calls `qualifyGraphJourneyWithClues`) landed 2026-11-20 once `import-record/repository.ts` was free, verified end-to-end against real SQLite. Still empty in production: no producer exists |
| M11.2 Background pass | CAP-3 | M11.1 | Scheduling, budget, queue, checkpoints, single rebuild request, "updated" note |
| M11.3 Place clues | CAP-4 | M11.2 | Sign, landmark, offset, optional Nano producers and combiner; visual-place and travel-window trip state retired after parity |
| M11.4 Photo-source clues | CAP-5 | M11.2 | Metadata stage; received/screenshot/download stop supporting; review card instead of Atlas removal |
| M11.5 Same-trip clues | CAP-6 | M11.2 | Pair clues become merge suggestions |
| M11.6 Personal learning | CAP-7 | M11.1 | Rules table, Settings list with Remove, the seven correction mappings |
| M11.7 Eval engine | CAP-8 | M10.1, M11.1 | Clue variants, producer fixtures, frozen hard cases, on-device aggregates, reports |
| M11.8 Gate | CAP-8 | M11.7 | Version and promotion activation with owner approval and rollback |

M11.6 and M11.7 can run alongside M11.2-M11.5. Each story attaches its eval
report, Jest/SQLite/typecheck/lint results and diagnostic evidence.

## Diagnostic map

New operation `AI_CLUE_PASS`; one correlation per pass.

| Stage | Boundary | Reasons | Outcome |
| --- | --- | --- | --- |
| `CLUE_SCHEDULE` | maintenance/foreground start | `START`, `ALREADY_RUNNING`, `PAUSED`, `BLOCKED`, `RESTRICTED` | lifecycle |
| `CLUE_PRODUCE` | each producer batch | `VISUAL_NO_READABLE_TEXT`, `VISUAL_NO_PLACE_MATCH`, `VISUAL_NO_LANDMARK_MATCH`, `VISUAL_PLACE_CONFLICT`, `MEDIA_ACCESS`, `MEDIA_DECODE`, `MODEL_UNAVAILABLE` (new), `BUDGET_EXHAUSTED` (new), `UNKNOWN` | per batch, counts only |
| `CLUE_VALIDATE` | clue record checks | `CLUE_INVALID` (new: non-closed value or bad subject), `HISTORY_STALE` | clue dropped |
| `CLUE_COMMIT` | transaction | `DATABASE_BUSY`, `TRANSACTION`, `SCHEMA`, `UNKNOWN` | retryable per code |
| `CLUE_REBUILD` | rebuild request | `ATLAS_UPDATED`, `SKIPPED`, `UNKNOWN` | durable outcome |
| `CLUE_NOTICE` | updated note | `COMPLETE`, `SKIPPED` | lifecycle |

Operation `ATLAS_REBUILD` adds stage `REBUILD_CLUES` (`SCHEMA`, `UNKNOWN`).
New operation `PERSONAL_RULE_SAVE` with stages `RULE_DERIVE`, `RULE_COMMIT`,
`RULE_REMOVE` (`CONSTRAINT`, `DATABASE_BUSY`, `UNKNOWN`).

Never logged: clue values, place names, OCR text, model output, subjects,
folder names, counts finer than buckets. Redaction tests inject a sentinel
place name and OCR string and assert they never reach logs or diagnostics.

## Collection recipe

As in SPEC-trip-recognition-repair: verified current development build on the
owner's Android, Metro filtered to `AI_CLUE_PASS`, `ATLAS_REBUILD` and
`PERSONAL_RULE_SAVE`, correlation lookup, local retention only.

## Checks

Mobile `npm run check`, root `npm run check`, the benchmark and clue-variant
gate, producer fixture evals, and the history-domain bundle `--check` when
shared reconstruction sources change.
