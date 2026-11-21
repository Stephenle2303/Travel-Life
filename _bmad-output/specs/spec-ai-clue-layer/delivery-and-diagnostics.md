# Delivery and diagnostics

## Stories

| Story | Caps | Depends | Done when |
| --- | --- | --- | --- |
| M11.1 Clue store | CAP-1, CAP-2 | **Done** | Validity rules (`clues/store.ts`) and detector consumption (`clues/consumption.ts`: `qualifyTripOutcomeWithClues`, `qualifyGraphJourneyWithClues`) implemented and tested — a clue can lower a trip, never raise one, zero clues equals M10 exactly. SQLite persistence (`migrationV49`'s `travel_clue` table, `loadClues`/`saveClues`/`updateClueStates`) and production wiring (`reconstruction/repository.ts`'s rebuild now calls `qualifyGraphJourneyWithClues`) landed 2026-11-20 once `import-record/repository.ts` was free, verified end-to-end against real SQLite. Still empty in production: no producer exists |
| M11.2 Background pass | CAP-3 | M11.1 | **Core done (2026-11-21).** `runCluePass()` reads real DB state, runs CAP-5's producer, gates the result, commits, and triggers a rebuild — verified end to end against real SQLite. Not done: wiring into the actual `travel-life-library-maintenance-v1` task (so it only ever runs when explicitly called today), budget is a simple per-call cap (no wall-clock timing or cross-call checkpoint cursor), and the owner-facing review-card UI / "trips updated" note do not exist |
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

## M11.2 status (2026-11-21)

Built and verified, independent of any DB orchestration:

- **Schema** (`migrationV51`): `clue_review_card` table — a clue the pass
  held back instead of silently lowering an already-confirmed journey.
  `import-record/repository.ts`'s `loadClueReviewCards`/
  `saveClueReviewCards`/`resolveClueReviewCard` (pure persistence, same
  convention as `travel_clue`). Verified against real SQLite: round-trip,
  state filtering, and that resolving an already-resolved card is a no-op
  (never silently flips a dismissed card to approved or back).
- **The gate itself** (`clues/background-pass.ts`'s `gateCandidateClues`):
  given the current graph/evidence/clues/classifications and a batch of
  freshly computed candidate clues, decides which are safe to activate
  immediately and which must become review cards instead. Resolves a
  clue's subject to the journey it actually supports via
  `journey.visitIds -> visit.evidenceIds` (the same path
  `buildV12CandidateEvidence` reads a journey's own candidate evidence
  from) — not `graph.memberships`, a narrower, separate concept (owner/
  suggested/GPS-less overlay membership) that would have under-counted
  affected journeys. Gates clues **together per affected journey**, not
  one at a time: evaluating each candidate clue alone against only the
  already-stored active clues missed a real case found while testing —
  several of the *same pass's own* new clues can combine to drop a journey
  below the reliable-photo floor even though no single one of them would.
  4 tests cover: safe single-clue activation, the cumulative-effect drop
  (8 clues together), a non-Atlas journey (no gating needed), and
  evidence with no visit-support (always safe).

**Orchestration built (2026-11-21), via a behavior-preserving refactor, not
duplication.** `rebuild()`'s own input assembly (evidence, excluded ids,
privacy filter, configured Homes, stored corrections, the canonical
baseline graph, existing clues, corrected-support keys) was extracted
unchanged into `loadRebuildBaseline()` — a pure cut of the same code, now
called by both `rebuild()` and the new `runCluePass()`. Verified
behavior-preserving by the full existing Jest + SQLite suite staying green
before and after (no test changed to make this pass). `runCluePass()`:
1. Reads `loadRebuildBaseline()`'s output, plus the **already-persisted**
   graph from the last rebuild (visits/journeys read from
   `reconstruction_visit`/`reconstruction_link`) — never recomputed, so it
   never touches `rebuild()`'s own local-recovery branch (a narrow, legacy
   path that conditionally replaces the graph; sidestepped entirely rather
   than reproduced).
2. Finds evidence with no existing clue or pending review card (bounded by
   `budget`, default `visualDiscoveryPhotoAttempts`), runs CAP-5's producer.
3. Gates the result (`gateCandidateClues`), commits safe clues as active
   and unsafe ones as `clue_review_card` rows in one transaction.
4. If anything was activated, calls the ordinary `rebuild()` to reclassify.

**Important finding, not a defect:** CAP-5's *metadata-stage* producer can
never actually need the review-card gate against real evidence. It reads
the exact same `source_origin` column `outcome-v1-2.ts`'s
`NON_CAPTURE_ORIGINS` already reads directly — so whenever the producer
has enough information to emit a confident clue, the base classification
(with zero clues at all) already reflects that same exclusion; the clue is
always a no-op confirmation, never a disagreement. Verified directly:
`runCluePass` tests show a 12-photo journey (some already messaging-sourced
at import) activates every clue with zero review cards, both when the
baseline is AUTO_CONFIRMED (margin holds) and when it's already SUGGESTED
(the messaging exclusion already happened before any clue existed). The
gate's actual protection is proven separately and directly, with synthetic
candidate clues, in `background-pass.test.ts` — it exists for a *future*
producer that can see something the base evidence does not (CAP-4's place
clues, or CAP-5's own later content stage for an `unknown`-origin photo).

**Wired into the real maintenance task (2026-11-21)**: `runCluePass()` now
runs after a completed `reconcileQueued()` inside
`travel-life-library-maintenance-v1`'s own handler, never blocking the
account-sync step queued right behind it.

**Code-reviewed before being called done (2026-11-21), 10 findings fixed:**
a high-effort 8-angle review (same practice as every prior story in this
project) found three real holes in the gate's safety guarantee before it
ever ran on a real device:
1. The gate's evidence→journey resolution only walked visit-support,
   missing `membership:%`-linked evidence (decision 0006's GPS-less/
   date-limited "memories") entirely, and never saw confirmed GPS-less
   (`travel_window_trip`) or visual-place (`visual_place_trip`/
   `visual_place_album`) trips at all — those live outside
   `reconstruction_journey`/`reconstruction_trip_qualification`
   completely. Fixed: `membership:%` links now feed the hand-built graph
   the same way `visit-support` does; evidence belonging to any confirmed
   GPS-less/visual-place trip is now unconditionally held for review
   (`protectedEvidenceIds`) since this gate has no way to dry-run those
   trip types' own classification.
2. The dry-run omitted `frequentPlaceContext`, so a frequent-place journey
   could be judged falsely safe and then silently demoted on the next real
   rebuild. Fixed: the gate now receives the same context the main
   qualification loop builds.
3. A journey with no stored classification row failed *open* (treated as
   safe) via an unchecked cast. Fixed: now fails closed (treated as Atlas,
   gated) — today's reconstruction-engine journeys always have a row, so
   this is a pure safety margin, one that matters the moment #1's fix
   brings in journeys that might not.
Also fixed: the maintenance task's outer catch was double-logging every
failure under a wrong stage and an unrelated correlation id (now silent,
since `runCluePass` already self-reports accurately); the budget loop kept
scanning the whole evidence table after its cap was already met
(`continue` → `break`); `deleteLocalHistory` cleared `travel_clue` but not
`clue_review_card` (now both); three independently-written upsert paths
for `travel_clue`/`clue_review_card` disagreed on conflict behavior (now
aligned to update every column); a malformed `clue_review_card` row was
silently swallowed with zero diagnostic (now reports `CLUE_INVALID` at a
new `CLUE_VALIDATE` stage). Two performance findings (the transaction
holding SQLite's write lock across all the pass's CPU-bound work, and
activation re-running the full baseline load a second time via the
triggered rebuild) are real but deliberately deferred — correctness over
performance for this round; see the error playbook.

Verified: 3 new gate-level unit tests (membership-only evidence, fail-closed
classification, protected-evidence deferral) plus 1 new SQLite end-to-end
test (a GPS-less confirmed trip's evidence is held for review, not
silently activated), full mobile `npm run check` (1630 Jest + 152 SQLite +
typecheck + lint + doctor) and root `npm run check` (281/281 + eval smoke)
clean.

**Still not done:** real wall-clock budget and a resumable checkpoint
cursor (today's budget is a simple per-call item cap, relying on repeated
calls naturally covering more evidence since already-clued subjects are
skipped); the owner-facing review-card screen and the "Travel Life updated
N trips" note; the two deferred performance optimizations above.

## Checks

Mobile `npm run check`, root `npm run check`, the benchmark and clue-variant
gate, producer fixture evals, and the history-domain bundle `--check` when
shared reconstruction sources change.
