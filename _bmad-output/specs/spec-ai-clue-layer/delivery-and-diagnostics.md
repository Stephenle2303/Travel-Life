# Delivery and diagnostics

## Stories

| Story | Caps | Depends | Done when |
| --- | --- | --- | --- |
| M11.1 Clue store | CAP-1, CAP-2 | **Done** | Validity rules (`clues/store.ts`) and detector consumption (`clues/consumption.ts`: `qualifyTripOutcomeWithClues`, `qualifyGraphJourneyWithClues`) implemented and tested — a clue can lower a trip, never raise one, zero clues equals M10 exactly. SQLite persistence (`migrationV49`'s `travel_clue` table, `loadClues`/`saveClues`/`updateClueStates`) and production wiring (`reconstruction/repository.ts`'s rebuild now calls `qualifyGraphJourneyWithClues`) landed 2026-11-20 once `import-record/repository.ts` was free, verified end-to-end against real SQLite. Still empty in production: no producer exists |
| M11.2 Background pass | CAP-3 | M11.1 | **Done (2026-11-21).** `runCluePass()` reads real DB state, runs CAP-5's producer under a wall-clock budget with a resumable cross-call cursor, gates the result, commits, triggers a rebuild, and writes the owner-facing "trips updated" note — wired into the real `travel-life-library-maintenance-v1` task; an owner-facing review-card screen and notice banner exist in the Atlas. Verified end to end against real SQLite |
| M11.3 Place clues | CAP-4 | M11.2 | **Capture-offset done (2026-11-21).** The "Capture offset" sub-producer (wraps the already-persisted `travel_window_capture`, never a new native read) is built and used by CAP-6. Not done: Sign reader, Landmark matcher, optional Nano producer, and the two-independent-clue place combiner — each needs its own producer story; capture-offset alone can never name a place |
| M11.4 Photo-source clues | CAP-5 | M11.2 | Metadata stage; received/screenshot/download stop supporting; review card instead of Atlas removal |
| M11.5 Same-trip clues | CAP-6 | M11.2 | **Done for its one real signal (2026-11-21).** Pairs two Possible trips, or a Possible trip and an adjacent Atlas trip, within 10 days with no corroborated Home return between them, and emits a clue only when both sides' capture offsets agree — the only one of the spec's four signals (same-place, landmark similarity, matching offset, matching camera) with a real producer today. Drives `loadJourneyDetail`'s merge-candidate list directly (replacing a pre-existing, untested, always-on "any 2 other journeys in the run" placeholder); never a silent merge. Recomputed fresh every pass; a pair no longer found is retracted, not left stale |
| M11.6 Personal learning | CAP-7 | M11.1 | **One of seven mappings done (2026-11-21).** Generic `personal_rule` table and the "Settings -> What Travel Life learned" list with Remove are built, and carry the one rule this round has a trigger and consumer for: "Keep or reject a merge suggestion" -> "Pair preference by support signature" -> "Same pair not suggested again" (a new "Not the same trip" button on CAP-6's merge-candidate card). "Reject a Possible trip" already existed before CAP-7 (plain correction, not a personal rule). The other 5 mappings are not built: 2 depend on unbuilt CAP-4 sub-producers (suggested place names, landmark references), 2 depend on unbuilt macro-area destination grouping ("Everyday place," "Place alias"), and the folder-category 3-strikes mapping needs its own cross-trip counter not designed yet |
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
| `CLUE_NOTICE` | updated note | `COMPLETE`, `SKIPPED`, `DATABASE_BUSY`, `TRANSACTION`, `SCHEMA`, `UNKNOWN` | lifecycle; a failure here never fails the already-committed rebuild it follows |

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

**Owner-facing review-card UI and "trips updated" note (2026-11-21).** Two
new, distinct repository surfaces, deliberately sharing their gate inputs
and their `travel_clue` write path with `runCluePass` through two new
helpers (`loadCluePassGateContext`, `writeActiveClue`) rather than a third
and fourth divergent copy of either — the exact bug class the code review
above had just found and fixed:
- `reconstruction/repository.ts`'s `loadPendingClueReviewCards()` (read) and
  `reviewClueCard(cardId, decision)` (approve/dismiss). Approving
  **re-validates the held clue against the live graph and classifications**
  before committing, never trusting the card as it stood when the pass
  created it — a journey id can churn, and the Atlas can change, between
  that pass and the owner's review. Returns `'stale'` (card stays pending,
  nothing is silently applied) when the clue is still unsafe, still
  protected, or no longer resolves to a pending card at all; the owner sees
  this as "no longer available," never as an applied approval. Only a
  `reviewClueCard('approve')` that passes the gate calls the ordinary
  `rebuild()`.
- The "show one note only when something visible changed" note itself: a
  new `clue_pass_notice` table (`migrationV52`, one row, replaced each time;
  `seen` is the owner's own dismissal). `runCluePass`'s triggered rebuild now
  diffs the journey classifications it had before the pass against what the
  rebuild just produced (`summarizeOutcomeDelta`, the same dry-run diff tool
  CAP-8 uses) and writes "Travel Life updated N trip(s)." only when
  gained+lost+changed > 0 — silent clue churn that never moved a journey on
  or off Atlas writes nothing. `import-record/repository.ts` exposes the
  read/dismiss side (`saveCluePassNotice`/`loadCluePassNotice`/
  `dismissCluePassNotice`) the UI actually calls; `runCluePass` writes the
  row directly since it already holds its own write connection mid-pass.
  New `CLUE_NOTICE` diagnostic stage (added this round — the diagnostic map
  above had already named it, but no code reported it yet): `START` →
  `COMPLETE`/`SKIPPED`, or the same closed `DATABASE_BUSY`/`TRANSACTION`/
  `SCHEMA`/`UNKNOWN` reasons every other stage uses on failure. The write is
  still best-effort (a failure here never fails the already-committed
  rebuild it follows), but it is never silent: AGENTS.md's diagnostic policy
  does not allow a fallible boundary with no diagnostic at all.
- UI: `components/clue-review-cards.tsx` (`ClueReviewCardsSection`,
  `CluePassNoticeBanner`) and `clues/review-card-copy.ts`
  (`reviewCardReasonSentence`, same closed-sentence convention as
  `reconstruction/possible-trip-copy.ts` — never exposes a raw reason code).
  Wired into `components/mobile-screens.tsx`'s `EmptyAtlasScreen`, rendered
  above `PossibleTripsV12Section` in the Atlas, reloaded on the same
  `durableReveal` lifecycle.

Verified: 9 new Jest tests for `loadPendingClueReviewCards`/`reviewClueCard`
(dismiss, stale-missing-card, safe approval + rebuild, still-unsafe
approval) and the notice (written on a real classification change, skipped
on none, redacted diagnostic on a write failure); 1 new real-SQLite
end-to-end test reusing the GPS-less fixture (lists the held-back card,
re-validates `stale` on approval while the protecting trip still exists,
dismisses it, and confirms a second approval of the same card is still
`stale`); 6 new Jest tests for the UI components (empty state, reason
sentences, exact approve/dismiss resolution, the stale message, the notice
banner and its dismissal); migration/round-trip/deletion tests for
`clue_pass_notice`. Full mobile `npm run check` (1650 Jest + 153 SQLite +
typecheck + lint + doctor) and root `npm run check` (281/281 + eval smoke)
clean.

**Still not done:** the two deferred performance optimizations above.

**Wall-clock budget and resumable cursor (2026-11-21).** A background-task
invocation is wall-clock limited by the OS, not item-count limited — a slow
producer or a large library could run far longer than one maintenance
window regardless of the item `budget`, and restarting the scan from the
table's start every call could starve evidence near the end indefinitely.
`runCluePass` gained a third parameter, `maxDurationMillis` (default
`cluePassMaxDurationMillis`, 8s, defined in `clues/background-pass.ts`
beside the gate it already lived next to), checked once per row alongside
the existing item `budget` — either cap ends the scan early. A new
`clue_pass_checkpoint` table (`migrationV53`, one row) persists the last
evidence_id the scan considered when it was cut short; the next call
resumes strictly after it (rows ordered deterministically by evidence_id,
since the table's own row order is unspecified), never re-examining
already-covered evidence. Reaching the end of the table on its own (not cut
short) resets the cursor to NULL — a fresh lap next time, not a scan of
nothing forever. `CLUE_PRODUCE`'s diagnostic map had already named
`BUDGET_EXHAUSTED` as a valid reason (from before either budget existed);
it is now actually reported, in place of `COMPLETE`, whenever either cap
ends the scan early.

Verified: 1 new real-SQLite end-to-end test (budget of 1 across 12 calls on
a 12-evidence journey — each call activates exactly one new clue, the
cursor advances every time until the 12th call wraps it to NULL, and a 13th
call finds nothing left); 2 new Jest tests with `Date.now` mocked to
deterministic values (wall-clock cutoff independent of a large item budget,
and resuming strictly after a persisted cursor); migration/deletion
coverage for `clue_pass_checkpoint`. Full mobile `npm run check` (1653 Jest
+ 154 SQLite + typecheck + lint + doctor) and root `npm run check` (281/281
+ eval smoke) clean.

## CAP-4 capture-offset + CAP-6 same-trip built (2026-11-21)

Item 3 of the agreed 4. Scoped down from the full spec during planning (see
the error playbook): CAP-6's 4 corroborating signals all depend on either
unbuilt CAP-4 producers or data this app never captures (device make/model)
— only "matching capture offset" has a real producer, so this round builds
exactly that pair and nothing more.

**CAP-4 capture-offset** (`clues/producers/capture-offset.ts`): same
metadata-stage pattern as CAP-5 — wraps the already-persisted
`travel_window_capture.utc_offset_minutes` (the travel-window GPS-less scan
computes this from EXIF `OffsetTime*`/local-timestamp-vs-UTC already; no new
native read at clue-pass time). Joined to `canonical_evidence` via
`source_ref` (not `evidence_id` — a real, if usually 1:1, distinction).
Never gated (`gateCandidateClues` exists to protect Atlas trip visibility;
this clue carries no place or classification information to protect
against), so it activates directly. Its only reader today is CAP-6.

**CAP-6 same-trip** (`clues/producers/same-trip.ts`): `findSameTripCandidatePairs`
pairs journeys (adjacent classification only — never two Atlas trips, never
a rejected one — within 10 days, sorted by `firstDay` so the gap only grows,
letting the scan break early), `representativeOffsetMinutes` is each
journey's own capture-offset mode (same lowest-wins tie-break as
`travel-window/window-detector.ts`'s `inferHomeOffsetMinutes`, minimum 2
samples), and `sameTripClues` emits one clue per pair whose offsets actually
agree — eligibility alone is never enough. `buildSameTripJourneys` and
`hasCorroboratedHomeReturn` (reusing `applyOwnerConfiguredHomeAreas`'s own
`usualAreaContext`, never a second definition of "home") assemble each
journey's summary and the gap check straight from `runCluePass`'s
already-loaded graph and evidence — no new producer-specific DB schema.
`clueId` is keyed by each side's own earliest-evidence support key (never a
journey id, which churns across rebuilds), so re-emitting the same real
pair updates one row; a pair the fresh pass no longer finds is superseded,
not left stale.

**Important finding, not a defect:** the main v1.1 episode builder
(`engine-v1-1.ts`'s `buildV11Episodes`) already merges any two "away"
evidence blocks within a 10-day gap into one continuous journey *unless* a
corroborated Home visit sits between them — the exact same boundary
condition CAP-6's own eligibility check uses. This means two Possible trips
genuinely exist as separate journeys, with no corroborated return between
them at clue-pass time, almost only when the evidence changed between the
rebuild that formed them and the pass evaluating them (the Home visit was
there, then was removed/corrected) — not a common "two short trips a week
apart" scenario by itself. Confirmed directly while building the
integration test: a fixture with two away clusters and zero Home evidence
between them, however far apart or distinctly located, merged into one
journey every time; only inserting a real corroborated Home visit (two
captures ≥1 hour apart, per `buildV11Episodes`'s own `corroboratesReturn`)
produced two separate journeys.

**`loadJourneyDetail`'s merge-candidate list now reads this clue**
(`sameTripCandidateJourneyIds`): previously an untested placeholder picked
"any 2 other journeys in the current run" unconditionally — a pre-existing
gap, not introduced here, recorded in the error playbook. Resolves a same-
trip clue's evidence keys back to the *other* journey (a family key
expanded to every current member; journeys resolved the same way the gate
resolves evidence to a journey, via `visit-support` and `membership:%`),
never a journey id stored directly in the clue. `journey-correction.tsx`'s
existing "Preview merge with X" flow needed no changes — it already
consumes `detail.mergeCandidates` generically.

Verified: 3 new Jest tests for `captureOffsetClues` (CAP-5's own producer
test shape); 10 new Jest tests for `findSameTripCandidatePairs`/
`representativeOffsetMinutes`/`sameTripClues`; 8 new Jest tests for
`buildSameTripJourneys`/`hasCorroboratedHomeReturn` (membership-only
evidence, fail-closed on missing day/classification, excluded evidence,
Home-area reuse); 1 new real-SQLite end-to-end test (two Possible trips
split by a real corroborated Home visit, offsets matching, clue created,
`mergeCandidates` on each journey names the other, idempotent on replay,
retracted once a Home return reappears). Full mobile `npm run check` (1674
Jest + 155 SQLite + typecheck + lint + doctor) and root `npm run check`
(281/281 + eval smoke) clean.

**Still not done:** Sign reader, Landmark matcher, optional Nano producer,
and the place combiner (CAP-4's remaining sub-producers); the "same place
clue," "landmark-embedding similarity," and "matching camera" signals for
CAP-6 (no device make/model is captured anywhere in this app today); the
two deferred CAP-3 performance optimizations.

## CAP-7 personal learning built for its one real trigger (2026-11-21)

Item 4 of the agreed 4, scoped the same way as items 2 and 3: of
personal-learning.md's 7 correction-to-rule mappings, "Reject a Possible
trip" already existed as a plain correction (not a personal rule), 2 depend
on unbuilt CAP-4 sub-producers, 2 depend on unbuilt macro-area destination
grouping, and the folder-category "ask once after 3 trips" mapping needs
its own cross-trip counter with no design yet. Only "Keep or reject a merge
suggestion" has both a real trigger (CAP-6's merge-candidate card, just
built) and a real consumer (the same-trip producer) ready today — built
end to end, including the generic infrastructure every future rule will
reuse.

- **Schema** (`migrationV54`): `personal_rule` (`rule_id`, `kind` — closed
  to `'pair-preference'` today — `scope_json`, `created_at_millis`).
  `scope_json` for `'pair-preference'` is `{ clueId }`: the rejected
  same-trip clue's own deterministic id (keyed by the pair's stable
  anchors, never a journey id), so a future pass's freshly recomputed
  candidate for the exact same real pair produces the identical id and is
  filtered before it is ever written — no second, separately-maintained
  pair identity.
- **Trigger** (`journey-correction.tsx`): a "Not the same trip" button next
  to each "Preview merge with X" (CAP-6's merge-candidate card), calling
  `reconstruction/repository.ts`'s new `rejectSameTripSuggestion(left,
  right)`. Finds the exact active same-trip clue connecting the two given
  journeys (resolving each journey's own evidence the same way the gate
  does, via `visit-support`/`membership:%` — shared with CAP-6's own
  merge-candidate lookup through a new `journeyEvidenceKeys` helper),
  writes the rule, and supersedes the clue immediately rather than waiting
  for the next pass to notice it is no longer in the fresh set. Returns
  `'stale'` (writes nothing) when the two journeys no longer have an active
  suggestion between them, same "no longer available" convention as every
  other CAP-3-era review action — never a silent no-op, and never routed
  through `journey_correction_revision`'s `'merge'`/`'reject'` actions,
  which this never touches.
- **Consumer** (`runCluePass`): reads every active `'pair-preference'` rule
  and filters the same-trip producer's own freshly computed candidates by
  `clueId` before committing — the existing "not in the fresh set gets
  superseded" logic then retracts a previously active clue for a newly
  rejected pair with no extra code.
- **Settings** (`mobile-screens.tsx`'s `PrivacySettingsScreen`, new
  "What Travel Life learned" section): lists every rule through
  `reviewCardReasonSentence`-style closed copy (`clues/personal-rule-copy.ts`
  — never a raw `kind` or `scope` value reaching the UI) with Remove.
  `import-record/repository.ts` exposes the read/remove side
  (`loadPersonalRules`/`removePersonalRule`); the write side lives in
  `reconstruction/repository.ts` next to the clue it supersedes — same
  split as `saveCluePassNotice`/`loadCluePassNotice`.
- New `PERSONAL_RULE_SAVE` diagnostic operation (`RULE_DERIVE` ->
  `RULE_COMMIT` for rejection, `RULE_REMOVE` for removal) — both stages were
  already named in this doc's diagnostic map before any code reported them;
  wired up this round rather than left as another documented-but-silent gap
  (see the error playbook's recurring lesson on this).

**Found and fixed while wiring the diagnostic:** `rejectSameTripSuggestion`'s
first draft read `loadPublishedRun` *before* opening its transaction, so a
failure there would have thrown with no diagnostic at all — the exact
boundary-type gap the error playbook already names twice this session, just
in a new shape (a read placed outside the `try`, not a documented-but-
unwired stage). Moved inside the transaction, matching `reviewClueCard`'s
own convention, before any test could have passed with it broken.

Verified: 2 new Jest tests for `personalRuleSentence`; 3 new Jest tests for
`rejectSameTripSuggestion` (stale on an unresolved display id, redacted
diagnostic on a failed resolution, stale when no clue connects the pair);
2 new Jest tests for the Settings list (plain-language sentence with no raw
rule kind ever rendered, empty state); 3 new Jest tests for the "Not the
same trip" button (removes the candidate, shows a stale message without
removing it, absent entirely when the callback is not supplied); migration/
round-trip/malformed-row/deletion coverage for `personal_rule`; 1 new
real-SQLite end-to-end test (reject creates the rule and supersedes the
clue, a second rejection of the same pair is a stale no-op, the rule
survives a further pass, removing the rule lets the pair resurface). Full
mobile `npm run check` (1687 Jest + 156 SQLite + typecheck + lint + doctor)
and root `npm run check` (281/281 + eval smoke) clean.

**Still not done:** the other 5 correction-to-rule mappings (2 blocked on
CAP-4, 2 on macro-area grouping, 1 needs its own cross-trip-counter design);
CAP-4's remaining sub-producers; CAP-6's other 3 signals; the two deferred
CAP-3 performance optimizations; M11.7/M11.8 (eval engine and gate).

## Checks

Mobile `npm run check`, root `npm run check`, the benchmark and clue-variant
gate, producer fixture evals, and the history-domain bundle `--check` when
shared reconstruction sources change.
