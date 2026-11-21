# Project state

## CAP-3 wired into the real maintenance task, then code-reviewed before trusting it (2026-11-21)

Wired `runCluePass()` into the real `travel-life-library-maintenance-v1`
maintenance task (after `reconcileQueued`, never blocking account sync).
Before leaving it live, ran a high-effort 8-angle code review and found
three real holes in the "never silently lower an Atlas trip" gate:

- It only recognized journeys built from `visit-support` — never
  `membership:%`-linked evidence (GPS-less "memories"), and never
  confirmed GPS-less (`travel_window_trip`) or visual-place
  (`visual_place_trip`) trips, which live entirely outside the
  reconstruction engine's own tables. Evidence belonging to those just
  bypassed the gate.
- The dry-run never received the frequent-place context, so a frequent
  spot's journey could look falsely safe.
- A journey with no stored classification failed *open* (treated as safe)
  instead of closed.

All three fixed, plus 7 smaller issues (a double-logged diagnostic with the
wrong stage, a budget loop that scanned the whole library after its cap was
met, `deleteLocalHistory` missing `clue_review_card`, three disagreeing
upsert paths, a silently-swallowed malformed row). Two performance findings
(the transaction holding the write lock too long, and activation
re-loading evidence twice) were deliberately deferred — correctness came
first for something about to run live. Full detail:
[delivery-and-diagnostics.md](../_bmad-output/specs/spec-ai-clue-layer/delivery-and-diagnostics.md),
[error-playbook.md](development/error-playbook.md).

Verified: 3 new gate unit tests, 1 new SQLite end-to-end test, full mobile
`npm run check` (1630 Jest + 152 SQLite + typecheck + lint + doctor) and
root `npm run check` (281/281 + eval smoke) clean. Nothing from this
session has been committed yet.

## CAP-3's background clue pass: core pipeline built end to end (2026-11-21)

Following the refactor-not-duplicate decision below, extracted `rebuild()`'s
own input assembly into a reusable `loadRebuildBaseline()` (verified
behavior-preserving: the full existing test suite stayed green with no
test changes) and built `runCluePass()` on top of it — reads real evidence/
clues, runs CAP-5's producer, gates the result, commits, and triggers a
rebuild, all verified against real SQLite.

**Real finding, not a defect:** CAP-5's current (metadata-stage) producer
can never actually trigger the review-card gate against real evidence,
because it only ever confirms what the base engine's classification
already does directly from the same `source_origin` field. The gate's
actual protection is proven separately with synthetic clues
(`background-pass.test.ts`) and exists for a future producer that can see
something the base evidence cannot (CAP-4's place clues, or a later
CAP-5 content stage for ambiguous photos).

**Still not wired to anything automatic**: `runCluePass()` is not yet
called from the real maintenance task, so it has no live effect on anyone's
Atlas today. That wiring, a real wall-clock/checkpoint budget, and the
owner-facing review-card UI are the remaining pieces. Full detail:
[delivery-and-diagnostics.md](../_bmad-output/specs/spec-ai-clue-layer/delivery-and-diagnostics.md).

Verified: full mobile `npm run check` (1625 Jest + 151 SQLite + typecheck +
lint + doctor) and root `npm run check` (281/281 + eval smoke) clean.

## CAP-3's safety-critical gate built and tested; DB orchestration is the next decision (2026-11-21)

Started CAP-3 (the background clue pass). Built and fully tested, with zero
production effect yet:
- `migrationV51`'s `clue_review_card` table + persistence, for a clue the
  pass must hold back rather than silently lower an Atlas trip
  (background-and-surfacing.md's "never" rule).
- `clues/background-pass.ts`'s `gateCandidateClues` — the actual dry-run
  safety gate. Found and fixed a real design bug while writing its tests:
  gating each candidate clue alone against only the already-stored clues
  missed the case where several of the *same pass's own* new clues
  combine to drop a trip below the reliable-photo floor, even though none
  of them would individually. Now gates all of a pass's clues together per
  affected journey.

**Deliberately stopped before the DB orchestration** (`runCluePass()`,
which would read real evidence/graph/Home state, call CAP-5's producer,
call the gate, and trigger a rebuild) — that piece needs the same
graph-construction `rebuild()` already does internally, and duplicating it
versus refactoring `rebuild()` to expose it is a real tradeoff (drift risk
vs. risk to a core tested path) worth deciding deliberately rather than
picking under momentum. Full detail:
[delivery-and-diagnostics.md](../_bmad-output/specs/spec-ai-clue-layer/delivery-and-diagnostics.md).

Verified: full mobile `npm run check` (1625 Jest + 148 SQLite + typecheck +
lint + doctor) and root `npm run check` (281/281 + eval smoke) clean.

## M11's first clue producer: CAP-5 photo-source built, not yet wired (2026-11-21)

Scoping which clue producer to start with (CAP-4 place / CAP-5 photo-source
/ CAP-6 same-trip), found CAP-5 is the right first slice: its metadata
stage reuses data M10.6 already computes (the folder classifier's
`sourceOrigin`), needs no new on-device model, and its consumption path
(CAP-2) and persistence (M11.1) were already built and tested. Found and
fixed a real latent bug along the way: the clue layer's `'received'` value
never matched the engine's `'messaging'` origin string (two vocabularies
for the same concept, built in separate sessions) — see the error
playbook. Built `clues/producers/photo-source.ts`'s pure
`photoSourceClues()`, verified with 4 new tests including an end-to-end
round-trip proving a messaging-sourced photo is actually excluded from
trip support.

**Deliberately not wired to any live path yet** — same pattern M11.1 used:
build and verify the layer in isolation with zero production effect, then
wire it in as its own slice. Running this producer for real needs CAP-3's
background-pass machinery (queue/budget/checkpoint, and the rule that a
clue lowering an already-Atlas trip must create a review card rather than
silently demote it) — none of that exists yet and is a materially larger
piece of work than the producer itself. Full detail:
[clue-contract.md](../_bmad-output/specs/spec-ai-clue-layer/clue-contract.md).

Verified: full mobile `npm run check` (1621 Jest + 147 SQLite + typecheck +
lint + doctor) and root `npm run check` (281/281 + eval smoke) clean.

## CAP-3's Possible-trips card UI built on real production data (2026-11-21)

Following the owner's approved prioritization (M10.8's dry-run UI closed on
paper — see the sprint change proposal below — in favor of this), built the
real Possible-trips card: one closed reason sentence per card
(`reconstruction/possible-trip-copy.ts`, the exact 8-sentence table from
detector-v1-2.md) and a Set Home action for `home-not-set`, reading the
owner's actual `SUGGESTED` journeys (`reconstruction/repository.ts`'s new
`loadPossibleTrips()`) rather than the old dev-preview-only shadow policy.
"Review outing" reuses the existing confirm/reject journey-correction screen
verbatim — no new write path. Wired into the real Atlas screen
(`mobile-screens.tsx`), visible regardless of the dev-preview flag.

A SQL `NOT IN` NULL-handling bug (silently undercounting the `few-photos`
sentence's located-photo count to 0 for any evidence with no recorded
source origin) was caught by a same-task SQLite regression before this was
declared done — see the error playbook, 2026-11-21.

Verified: 3 new SQLite regressions, 7 new Jest tests, full mobile
`npm run check` (1615 Jest + 147 SQLite + typecheck + lint + doctor) and
root `npm run check` (281/281 + eval smoke) clean, benchmark unchanged
(54/54). Full detail: [delivery-and-diagnostics.md](../_bmad-output/specs/spec-trip-recognition-repair/delivery-and-diagnostics.md).

## M10.8 scope reduction: dry-run UI closed, CAP-3 prioritized (2026-11-20)

BMAD product-manager review (the "John" persona) found M10.8's owner-facing
dry-run/activation screen had no real decision left to gate — v1.2 was
already adopted directly (no feature flag, no stored policy selector) back
at the M10.3/M10.4 call-site switch. Owner approved: close that UI item on
paper (rollback and correction preservation stay proven; see
delivery-and-diagnostics.md) and prioritize CAP-3's Possible-trips card
instead, given M10.2's real-device data below. Full proposal:
[sprint-change-proposal-2026-11-20.md](../_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-20.md).

## M10.2 device baseline collected on the owner's real phone (2026-11-20)

With the phone connected, read the real classification mix off the device's
own SQLite `reconstruction_trip_qualification` table (not a fresh profiled
rebuild — the library was already fully imported/rebuilt earlier today, so
nothing would have changed to re-log; the durable-read check correctly
found no change). Pulled read-only, queried locally, pulled copy deleted —
no raw evidence left this environment. 76 journeys: 24 `AUTO_CONFIRMED`
(Atlas), 38 `SUGGESTED` (Possible: 32 `near-home`, 4 `few-photos`, 1
`frequent-place`, 1 `single-moment`), 14 `NOT_TRIP` (hidden: 12
`no-away-evidence`, 2 `non-capture-source`). Zero silent drops.

Headline finding: `near-home` alone is 42% of every detected episode and
84% of all Possible trips on this one real, multi-year library — the H-3
<50 km Atlas threshold is doing a lot of real-world routing to Possible
rather than Atlas or hidden. Not a bug (the rule runs exactly as specified),
but it raises the real priority of CAP-3/M10.7's still-unbuilt Possible-trips
card, since that's what an owner would see for over a third of their whole
history. Full detail, method and the reinstall-release-afterward note:
[delivery-and-diagnostics.md](../_bmad-output/specs/spec-trip-recognition-repair/delivery-and-diagnostics.md).

Also verified this session: the Android **release** build variant
(`app-release.apk`, debug-signed, all 4 ABIs) genuinely runs standalone —
force-stopped and relaunched via a plain `adb shell am start` (no dev-client
deep link, no Metro reachable) loaded the embedded JS bundle in ~170ms with
no crash. `expo-dev-client` being a regular (non-dev) dependency only
intercepts its own explicit deep-link scheme; a normal app-icon launch is
unaffected.

## Code review of the M10.5/M10.6/M11.1 work: 8 fixed, 2 documented as tracked gaps (2026-11-20)

Before calling the M10/M11 work in the two entries below finished, ran a
`/code-review high` pass (8 parallel finder angles, 1-vote verify) over the
full diff, the same delivery-review step M10.3/M10.4 used. Found 10 issues;
full detail in the error playbook's new top entry.

Fixed: `candidate-projection.ts`'s `usable()` was missing the `'messaging'`
exclusion just added to `outcome-v1-2.ts` (a live gap once real provenance
flows in); the new native EXIF-read boundary had zero diagnostics, violating
AGENTS.md's instrumentation rule (added a page-level bucketed diagnostic);
`clueFromRow`'s `JSON.parse` was unguarded (now returns `null` for a
malformed row instead of aborting the whole rebuild); the rebuild's inline
`travel_clue` query lacked `loadClues()`'s `ORDER BY`; three native-bridge
calls in `candidateFromMetadata` ran sequentially instead of concurrently;
"keep at least one Home" was enforced only in the Settings UI, not at
`provider.tsx`'s shared `removeConfiguredHomeArea` choke point (added there
too, as a backstop for any future second caller).

Documented as known, bounded, currently-inert gaps for CAP-4/5/6 (no clue
producer exists yet to trigger either) rather than fixed in this already-large
pass: `candidate-projection.ts`/`local-recovery-projection.ts`'s own
reliability checks stay clue-blind (call `qualifyGraphJourneyV12` directly,
not the clue-aware wrapper); `correctedKeys` does raw string matching instead
of the canonical remap-aware family-key resolution real corrections use. Both
recorded with their exact fix in `_bmad-output/specs/spec-ai-clue-layer/
clue-contract.md`.

Added regression tests for every fix (messaging-origin exclusion, bucketed
diagnostic emission, malformed-clue skip, last-Home backstop at the provider
layer). Full mobile `npm run check` (1602 Jest + 142 SQLite + typecheck +
lint, all clean) and root `npm run check` green; benchmark unchanged (54/54).
Nothing committed yet.

## M11.1 done end to end: clue SQLite persistence and production wiring (2026-11-20)

With M10's blocked files free (previous entry), continued into M11 per the
owner's earlier "I'll tell you when we can get back to the pending of M10"/
"can do M11's next step (CAP-2) now" direction — M10's reachable pieces are
now substantively done, and `import-record/repository.ts` being free also
unblocks M11.1's persistence, so finished it:

- `migrationV49` adds `travel_clue` (schema version 49): one row per clue,
  `subject_json`/`value_json` holding the closed per-kind shapes
  `clues/types.ts` defines unchanged — this repository never interprets a
  clue, only round-trips it. `loadClues`/`saveClues`/`updateClueStates` on
  `ImportRepository` are pure persistence; `deleteLocalHistory` now clears
  `travel_clue` too, so clues never outlive the private record.
- New `qualifyGraphJourneyWithClues` (`clues/consumption.ts`) mirrors
  `qualifyGraphJourneyV12`'s exact parameter shape (`clues`/`correctedKeys`
  inserted after `homeAreas`) and is now the production rebuild's sole
  qualifier — `reconstruction/repository.ts` reads `travel_clue` and every
  effective correction's `reviewed_support_json` once per rebuild, in place
  of the direct `qualifyGraphJourneyV12` call. `namedPlace` is read but not
  persisted or displayed anywhere yet (no UI reads it; CAP-4 has no
  place-clue producer to populate it).
- Verified **end to end against a real SQLite database**, not just mocks: a
  new `scripts/atlas-sqlite.test.cjs` test hand-inserts a `photo-source`
  clue after a rebuild already classified a journey `AUTO_CONFIRMED`,
  reruns the rebuild, and confirms the classification changes — then
  confirms `deleteLocalHistory` clears the clue. No production behavior
  changes today: `travel_clue` is always empty until a producer exists
  (CAP-4/5/6, not built).
- Found and fixed one real import-ordering cleanup in the same pass: removing
  the direct `qualifyGraphJourneyV12` call from `reconstruction/repository.ts`
  left its import unused; removed (it stays exported via the file's own
  `export { qualifyGraphJourneyV12, ... } from './outcome-v1-2'` re-export,
  a separate statement, for CAP-8 rollback and the other two call sites).

Full mobile `npm run check` (1598 Jest + 142 SQLite + typecheck + lint, all
clean, zero warnings) and root `npm run check` (281 Foundation + eval
smoke) green; lifetime benchmark unaffected (54/54 — the benchmark doesn't
route through `reconstruction/repository.ts`'s SQLite rebuild at all).
Nothing committed yet.

Still open for M11: CAP-3 (background pass), CAP-4/5/6 (clue producers —
nothing emits a real clue yet), CAP-7 (personal learning), CAP-8 (eval
engine) — each needs a new on-device model or new scheduling/eval
infrastructure not yet started. Still open for M10: M10.2 (needs the
owner's phone), the diagnostic-map additions to `app-diagnostics.ts`, H-3's
graph-level half, and M10.8's owner-facing transparency UI (re-scoped, see
delivery-and-diagnostics.md — there's no longer a pending "activate v1.2"
decision for it to gate).

## M10.5 and M10.6 done now that travel-window's files are free; M10.7's remainder deliberately deferred (2026-11-20)

With the concurrent travel-window session's work merged to `main`
(`mobile-screens.tsx`, `import-record/repository.ts`, `photo-access/
provider.tsx`, `app-diagnostics.ts` and `travel-window/*` all free), resumed
M10's blocked pieces per the owner's go-ahead ("the other session is done
the work, you can do now"):

- **M10.5 (Home is required)**: `InitialHomeSetup` in `mobile-screens.tsx`
  now has no "Skip for now" anywhere in first use; the period defaults to
  Forever the moment a place is picked, so adding a Home needs only one tap
  after search; a new `MonthYearField` (year list, then a 12-month grid) and
  `homePeriodLabel` replace the old typed `YYYY-MM`/`YYYY-MM-DD` text fields,
  matching home-setup.md's label table exactly, including keeping an
  existing Home's exact saved days until the owner changes that field.
  Settings' Remove action refuses the owner's last Home base with a message
  instead of a confirm dialog. Closed a real migration gap found while
  wiring this: `requiresHomeSetup`/`resolveEntry`
  (`photo-access/controller.ts`) checked the `home_setup_receipt`
  disposition (`'skipped'` vs `null`), so a record that skipped Home under
  the old flow would never be asked again; fixed to check the actual
  configured Home-area count instead, and `saveHomeSetup` now rejects an
  empty area list outright. Considered, then rejected, hardening
  `deleteConfiguredHomeArea` the same way at the repository layer: a real
  SQLite test (`scripts/atlas-sqlite.test.cjs`) needs the record to reach
  zero Home areas to exercise `hasPendingHomeProjection`, so "keep at least
  one" stays a Settings-UI rule, matching H-4's own wording.
- **M10.6 (capture time, Android)**: `photo-access/native-adapter.ts` now
  calls the same native EXIF/offset reader and `toCaptureRecord` mapper
  travel-window's GPS-less detector already uses, so every imported photo
  gets a real `hasPreciseOffset` (an EXIF offset tag was present) and real
  `sourceOrigin` (camera/imported/messaging/screenshot/download/unknown)
  instead of the previous hardcoded `false`/`null`. `outcome-v1-2.ts` needed
  no further change, as the spec predicted — except one real gap the real
  data exposed: `NON_CAPTURE_ORIGINS` was missing `'messaging'`, so a
  messaging-sourced photo would have counted as full trip support,
  contradicting C-13's "messaging... review-only" (one-line fix). iOS and
  older/Expo-Go builds keep today's conservative defaults unchanged.
- **M10.7's remainder (Possible-trips preview consolidation)**: investigated,
  then **deliberately deferred**, not blocked. `candidate-projection.ts`'s
  non-`'recovery'` algorithm feeds only the dev-gated "Reconstruction
  preview" screen, not the real owner Possible Trips cards (those are
  travel-window's/visual-place's own independent detectors). Replacing it
  with v1.2's `SUGGESTED` would drop test-covered routine-learning/
  `usualPlaceAnswers`/boundary-reason behavior with no equivalent benchmark
  safety net (unlike M10's own `outcome-v1-2.ts`). Left as a named, tracked
  gap in consolidation.md rather than rushed.

New tests: `native-photo-adapter-capture-metadata.test.ts` (4, isolated from
the existing adapter test file because the capture reader is captured once
at module-load time — see the error playbook's new `jest.mock` hoisting
lesson); extended `onboarding-integration.test.tsx`,
`privacy-settings-screen.test.tsx`, `import-repository.test.ts`. Full mobile
`npm run check` (1595 Jest + 141 SQLite + typecheck + lint) and root
`npm run check` (281 Foundation + eval smoke) green; lifetime benchmark
still 54/54, 0 silent drops, 0 false Atlas. Nothing committed yet.

Still open: M10.2 (needs the owner's phone), M10.8's owner-facing dry-run/
activation UI (unblocked, not started), the diagnostic-map additions to
`app-diagnostics.ts`, H-3's graph-level half, and M11's clue persistence
(same files, now also free).

## Journey ordering fixed app-wide; delete a manual journey, both verified live (2026-11-20)

Both follow-ups from the previous entry, built and confirmed live on-device:

- **Ordering.** `loadDurableReveal` (`reconstruction/repository.ts`) now
  interleaves manual journeys with reconstructed ones by actual date
  (newest first) instead of always listing every manual journey after
  every reconstructed one. An undated reconstructed journey still sorts
  last, unchanged. App-wide fix: affects plain "Add journey" entries and
  visual-place confirms exactly the same way, not just travel-window ones.
  New test: `interleaves a manual journey with reconstructed ones by
  actual date...` (`reconciliation-repository.test.ts`).
- **Delete a manual journey.** No deletion path existed anywhere for any
  manual journey before this. Added `removeManualJourney(displayId)`:
  refuses anything that is not `manual:`-prefixed; for a plain entry it
  only deletes `manual_journey`; for a `travel-`-prefixed one it also
  clears `travel_window_album`/`trip`/`disposition`; for a `visual-`
  one it clears `visual_place_album`/`trip`/`review`/`disposition` (and
  its in-memory `visualAlbumTokens` entry) — so the underlying window or
  cluster is free to be offered again rather than staying permanently
  "confirmed" against data that no longer exists. Wired through
  `provider.tsx` (with a `refreshDurableReveal()` after, same as
  `createManualJourney`) and a new "Delete this journey" two-tap confirm
  in `journey-edit.tsx`'s owner-entered section. The owner used it live to
  remove the earlier-flagged wrong "Ewha Womans University" entry.
- Also fixed in passing: travel-window's own `confirm()` never refreshed
  the Atlas after a successful save (unlike `createManualJourney` and
  visual-place's `review()`, both of which already did) — this is why
  Seoul needed a full app relaunch to appear earlier. Now wrapped the same
  way in `provider.tsx`'s `travelWindowDiscovery` construction.

Full `npm run check`: 1,588 Jest tests green (141 SQLite), clean typecheck
except the other active workstream's own unrelated file, lint clean
(same pre-existing unrelated warning). Both fixes confirmed live by the
owner on-device.

**Follow-up (same day):** the owner reported the delete actually completed
(24 journeys afterward, Ewha confirmed gone) but felt slow — stuck showing
"Deleting…" longer than expected. Cause: `removeManualJourney`'s provider
wrapper called a full `refreshDurableReveal()` afterward, re-running the
entire Atlas read (every reconstructed journey's destination-label joins,
etc.) just to reflect one removed entry. Fixed to drop the removed journey
from the existing `durableReveal` state locally instead, the same
optimistic-removal pattern `runPrivacyCommand` already uses for hiding a
journey. `npm run check` green again (1,588 tests); on-device reload clean.
A live timed re-test of delete itself is still open (no second disposable
manual journey to test against without touching real confirmed trips).

## GPS-less confirmed trip verified live end-to-end; two follow-ups found (2026-11-20)

The full Atlas integration (previous entry) is confirmed working on-device,
not just unit-tested: the owner re-confirmed the Seoul-Korea window through
the new search-backed flow and it appeared in the Atlas with its real 458
photos. Found and fixed one real bug in the process: a Save button that
stayed disabled after tapping a search suggestion. Root cause was a classic
controlled-`TextInput` issue — `choosePlace` sets the input's value
programmatically while it still has focus, which can echo back through
`onChangeText` on Android with that same value, and the naive handler
treated that echo as a real edit and cleared the just-made selection.
Fixed by only clearing a selection when the incoming value actually differs
from the one just set (`travel-window-recovery.tsx`).

Two further things the owner noticed, confirmed real but **out of this
pass's scope**, needing their direction before building:
- **Ordering:** a newly confirmed trip (however recent) always sorts below
  every reconstructed journey, never interleaved by date. Confirmed
  pre-existing and not specific to this feature — `reconstruction/
  repository.ts`'s `loadDurableReveal` returns
  `[...journeys.values(), ...manualJourneys]`, a plain concatenation with
  no merged chronological sort. Affects every manual journey app-wide
  (plain "Add journey", visual-place confirms, and now travel-window
  confirms alike), not something introduced here.
- **No delete action for a manual journey.** The owner confirmed "Ewha
  Womans University" (flagged earlier as unrelated to this module) is an
  owner-entered manual journey they want removed, and there is no delete
  path anywhere in the exposed API (`removeConfiguredHomeArea` exists for
  Home areas; nothing equivalent exists for `manual_journey`). A real,
  separate gap, not scoped to decision 0019/0020.

All temporary debug logging from this investigation has been removed. Full
`npm run check`: 1,581 Jest tests green, clean typecheck except the other
active workstream's own unrelated file.

## M11.1 done except persistence: rules now consume clues (2026-11-19)

Added `apps/mobile/src/clues/consumption.ts` (CAP-2) on top of the CAP-1
foundation below: `applyPhotoSourceClues` (a clue can only lower a unit's
support, never raise it — overrides `sourceOrigin` so the engine's existing
own-capture exclusion applies unchanged), `namedPlaceForSubject` (attaches a
`place` clue's name to a Possible trip for display, never changes its
classification) and `qualifyTripOutcomeWithClues`, the one entry point.
`reconstruction/outcome-v1-2.ts` itself was not touched — the integration
lives entirely in `clues/`, so M10's benchmark result (54/54) is unaffected,
confirmed by rerunning it. 13 new tests prove: zero clues reproduces M10
exactly; a clue can take a trip off Atlas; a clue can never put one on
(promotion classes stay off by default); an owner correction always beats a
clue on the same subject; a retracted clue is never applied. 179/179 tests
total, `tsc --noEmit` clean, root `npm run check` 281/281.

No clue producer exists yet to feed this in production (CAP-4/5/6 are not
built), and persistence (M11.1's clue table) stays blocked on
`import-record/repository.ts`, same concurrent-session constraint as M10.

## M11 foundation: clue record contract implemented (2026-11-19)

After M10's review and fixes below, started M11 (decision 0022) with its
safe foundation: `apps/mobile/src/clues/types.ts` and `store.ts` implement
CAP-1's clue record (closed, discriminated by kind: `place`, `photo-source`,
`same-trip`, `capture-offset`, `landmark`, `sign-place`, `sign-script`) and
its validity rules (retraction on unavailable evidence, supersession on
producer-version change, owner corrections always override a clue on the
same subject, independence by producer/session key). Pure, no persistence
yet. 13 unit tests, `tsc --noEmit` clean. Stopped there: CAP-2 (wiring
clues into the outcome rule), the clue producers (CAP-4/5/6) and the
background pass, personal learning and eval engine (CAP-3/7/8) each need
either the schema file blocked by the concurrent travel-window session, a
new on-device model, or new scheduling/eval infrastructure not yet built —
none were started this session.

## GPS-less confirmed trips now become real, visible Atlas journeys (2026-11-20)

Closed a real gap the owner caught: confirming a GPS-less trip
(decision 0019/0020's "Possible trips" card) wrote `travel_window_trip`/
`travel_window_disposition` but had nothing that displayed it anywhere —
the spec's own acceptance line ("the whole trip... available immediately,
including Replay eligibility through the existing gates") was never
implemented. Owner chose full Atlas integration over a lighter
module-local list, explicitly accepting the risk of editing
`reconstruction/repository.ts` while a separate, concurrent session was
mid-implementing `trip-detector-v1.2` there (confirmed low collision risk
in practice: full Jest suite — 1,555 tests — and typecheck stayed green
throughout, in different regions of the same file).

Found the precedent already solved this for the sibling GPS-less feature
(visual-place): a `manual_journey` row (needs real coordinates) plus a
dedicated album-attachment table resolving to `canonical_evidence` by
`source_ref`/asset id, read through three existing `manual:visual-`
branches in `loadJourneyDetail`/`verifyJourneyMediaSnapshot`/
`loadJourneyMediaPage`. Mirrored it exactly for a new `manual:travel-`
prefix: `migrationV48` adds `travel_window_album` (no slot cap, unlike
visual's 512 — decision 0019's membership rule is "deliberately no size
cap"); `storage.ts`'s `confirmWindow` now also creates the `manual_journey`
row and resolves/attaches only trusted member photos (never `reviewIds`)
in one atomic transaction; `travel-window-recovery.tsx`'s "Where were
you?" field now uses the same offline place search
(`reconstruction/owner-place-search.ts`, already used by the unrelated
manual-journey-add feature) instead of free text, with the same broad-
continent fallback, because a real anchor is now required — confirming
without picking a place is disabled. Added `travelAlbumRows` (mirrors
`visualAlbumRows`, minus visual's candidate-shadow staleness check, which
has no equivalent here since this data is never re-edited). Replay stays
withheld for these journeys, same as visual's own owner-entered gate —
not a new gap, matching existing behavior exactly.

New test coverage: `travel-window-storage.test.ts` (album resolution,
chunked for the "no size cap" rule, `date_kind` derivation) and a new
describe block in `reconciliation-repository.test.ts` covering the three
new repository branches (attached-with-photos, Replay withheld,
fails-closed when unattached, paging, stale-token rejection). Full `npm
run check` green except one typecheck error in the *other* session's own
new file (`reconstruction-outcome-v1-2.test.ts`), unrelated and untouched.

**Known gap, not yet resolved:** the four trips the owner already
confirmed before this fix (Huế - Đà Nẵng, Seoul - Korea, Taiwan, Bali -
Indonesia) have no stored coordinates (the old flow was free text) and
were not retroactively migrated — real geocoding of a compound label like
"Huế - Đà Nẵng" against the offline gazetteer is unreliable enough that
guessing felt worse than leaving them as they are. They still won't appear
in the Atlas until re-confirmed through the new search-backed flow.
On-device verification of the new flow itself is pending — the owner's
phone disconnected from USB mid-session.

## trip-detector-v1.2 code review: 9 bugs fixed, 1 documented (2026-11-19)

A `/code-review high` pass on the v1.2 implementation below (8 finder
angles, 1-vote verify) found 10 confirmed issues before the story was
declared done. Fixed in the same task: frequent-place (F-1) could count a
journey as its own prior visit (self-exclusion now by journey identity, not
timestamp, since a journey's context marker and its own computed start can
legitimately differ); `homeCoversAllDays` was vacuously true with no
checkable day; frequent-place only indexed a journey's first-visit place
(a consistent second stop could never trip it); the duplicate-family
tie-break disagreed with v1.1's; `candidate-projection.ts` and
`local-recovery-projection.ts` still called the retired v1.1 qualifier,
letting the Possible-trips/recovery surface disagree with Atlas on the same
journey; an empty-Home case stored a self-contradicting `near-home` reason;
and per-journey qualification scaled as O(journeys × library size) instead
of O(library size) — a real risk at the owner's ~19,000-photo scale.
Documented, not fixed (too large for this pass): H-3's Home-photo exclusion
only applies inside the classifier, not to the graph's own `visit-support`
rows that drive a trip's title/cover/album — see
[detector-v1-2.md](../_bmad-output/specs/spec-trip-recognition-repair/detector-v1-2.md)'s
"Not yet done" list. Full findings: error playbook, 2026-11-19.

After every fix: `tsc --noEmit` clean, 148/148 relevant Jest tests
(25 new + 123 pre-existing, none broken), the lifetime benchmark still
54/54 with 0 silent drops and 0 false Atlas trips (none of the 9 bugs
happened to be exercised by the current benchmark scenarios — a gap worth
closing next), root `npm run check` 281/281.

## trip-detector-v1.2 implemented for the Atlas surface (M10.1/M10.3/M10.4, 2026-11-19)

Decision 0021's engine rules are implemented and benchmarked.
`apps/mobile/src/reconstruction/outcome-v1-2.ts` is the new pure outcome
rule (`qualifyTripOutcomeV12`/`qualifyGraphJourneyV12`), wired as the sole
production call in `reconstruction/repository.ts` in place of
`qualifyGraphJourneyV11`. Benchmark result: **54/54** scenario+Home-mode
matches, **0 silent drops**, **0 false Atlas trips** — up from the frozen
baseline's 22/54, 6 silent drops. Full table:
[v1-2-comparison.md](../_bmad-output/specs/spec-trip-recognition-repair/v1-2-comparison.md).
Fixed while wiring: `reconstruction-v1`'s 5 km place clustering already
merges points 3 km apart, so the "two places ≥1 km apart" corroboration
check compared raw coordinates instead of place ids (see error playbook).

v1.1's own files are byte-unchanged (`git diff` empty on `engine.ts`,
`engine-v1-1.ts`, `canonical-core.ts`, `canonical-projection.ts`,
`candidate-projection.ts`); `qualifyGraphJourneyV11` stays exported, so
selecting it again reproduces the prior result exactly (CAP-8's rollback
requirement). A pure dry-run diff (`summarizeOutcomeDelta`) is implemented
and tested. 21 new unit tests plus the benchmark; `tsc --noEmit` clean on
the whole project; the 69 pre-existing reconstruction/candidate-projection
tests are unaffected; root `npm run check` 281/281.

**Blocked this session, not skipped:** a second session was actively
editing `mobile-screens.tsx`, `app-diagnostics.ts`,
`import-record/repository.ts`, `photo-access/provider.tsx` and all of
`travel-window/` throughout (confirmed by `git status` repeatedly) —
building the same native EXIF/offset capture-metadata reader M10.6 needs.
Two sessions writing the same files risks losing one's work, so this
session left them alone. That blocks: M10.2 (needs the owner's phone),
M10.6 end to end, M10.5's UI half (Home required in onboarding, the period
picker), M10.7's remaining half (Possible-trips still reads the separate
`candidate-projection.ts` shadow policy, not v1.2's `SUGGESTED`), M10.8's
owner-facing dry-run/activation UI, and new closed reason codes in
`app-diagnostics.ts` (one new dev-only phase stage was added instead, in
the separate `atlas-phase-profile.ts`). Full accounting:
[delivery-and-diagnostics.md](../_bmad-output/specs/spec-trip-recognition-repair/delivery-and-diagnostics.md).
Next: a BMAD code review of this diff, then M10.2/M10.5-UI/M10.6/M10.7/M10.8
once the owner's phone is available and/or the concurrent session's files
are free.

## GPS-less trip discovery: "9 journeys" and "no possible trips" both resolved as non-bugs (2026-11-19)

Two further owner reports after the fixes below, investigated with the
owner's explicit go-ahead to look past this module's own boundary:

- **"Now just have 9 journeys"** caused real alarm (looked like data loss).
  The main Atlas/journey list (read-only inspection, no code changed) shows
  **21 journeys** on a fresh "Showing this device history" view — the
  owner confirmed this matches the count from before any of today's fixes.
  The "9" was a one-off transient reading (left unexplained; not
  reproduced), not a regression. No code change was needed or made to the
  reconstruction engine.
- **"No possible trips detected... like the previous version"** is not a
  bug either. Temporary read-only logging (added and removed; counts/typed
  names only, matching this module's own existing exposure level) showed
  the owner has already confirmed all four travel-looking windows found so
  far via the live card itself: Huế - Đà Nẵng, Seoul - Korea, Taiwan, and
  Bali - Indonesia (`travel_window_trip`/`travel_window_disposition`,
  decision 0019/0020). `firstPendingProposal` correctly shows nothing
  because there is currently no undecided window — the detector is working
  as designed. Backfill is still progressing after the `migrationV47` reset
  (10,018+ captures cached and climbing at last check); further undecided
  windows should surface as it reaches more of the library.
- **"Ewha Womans University" still appears in the main Atlas** — directly
  ruled out as a travel-window-module issue by inspecting the confirmed-trip
  rows above: none of them is named "Ewha." Confirms the earlier conclusion
  that this is the reconstruction engine's own output (or a manual journey
  entry), not this module's.
- **Observed in passing, not touched:** `apps/mobile/src/reconstruction/`
  and a new `outcome-v1-2.ts`/`reconstruction-outcome-v1-2.test.ts` are
  being actively, concurrently edited in this same checkout (decision
  0021's detector v1.2, presumably) while this investigation ran.
  `npm run check`'s `tsc --noEmit` currently fails only on that new test
  file (`Map<string, string>` not assignable to
  `ReadonlyMap<string, TripOutcomeClassificationLike>`) — unrelated to
  anything in this entry; flagging for whoever is mid-edit there, not fixed
  here. All of this module's own tests pass in isolation (1,543 Jest + 141
  SQLite).

## GPS-less trip discovery wired live; owner-reported correctness bugs fixed (2026-11-19)

Decision 0019/0020's GPS-less detector was wired into the real app
(`travel-window/production-discovery.ts`, `storage.ts`,
`components/travel-window-recovery.tsx`; schema `migrationV46`). On-device
verification found and fixed two bugs before it worked correctly: a stale
`import_schema_version` marker skipped the new migration's table creation
(added `ensureTravelWindowLayout`, mirroring this file's existing
abandoned-marker-tolerant pattern), and a missing `PRAGMA busy_timeout` on
the new connection failed its first write as `DATABASE_BUSY` (fixed to match
every other independent connection to this file). The owner then confirmed
the live card worked (Korea, a 2-hour shift matching its UTC+9 offset) and
asked to review the window's own photos before naming one; added
`loadPhotos`/`windowPhotoIds` reusing the existing `resolveOwnerPreviews`
owner-preview mechanism, never required to confirm or dismiss.

The owner then reported two further, more serious bugs: already-recognized
GPS trips (Bali, Taiwan 2025) were also being offered for naming, and the
headline omitted the year. Root cause of the first: `CaptureRecord.located`
— the field that is supposed to exclude GPS-evidenced captures from this
GPS-less detector — was hardcoded `false` by every real caller; it was never
actually wired to a GPS check, so a trip entirely of GPS-tagged photos
(already owned by the reconstruction engine) looked GPS-less here and was
re-offered. Fixed by extending the existing native EXIF reader
(`TravelLifeSignageModule.kt`) to also report `hasLocation` (presence only,
reusing the same already-open file read; `ACCESS_MEDIA_LOCATION` was already
declared for the main engine). Added `migrationV47` to clear the
already-cached wrong data (only `travel_window_capture` and the scan cursor;
the owner's actual confirm/dismiss decisions are untouched) so the device
rescans cleanly. Added the year to the story-card headline
(`travel-window/story-card.ts`). Full root cause, native-rebuild notes and
the Metro-staleness incident encountered while verifying are in
`docs/development/error-playbook.md`'s 2026-11-19 entries. `npm run check`
green throughout (1,522 Jest tests at the final pass).

**Flagged for decision 0021 (trip recognition repair), not actioned here:**
while re-verifying on-device, the owner reported a trip labeled "Ehwa" (Ewha
Womans University, Seoul, South Korea) appearing in the main Atlas/journey
list that they say should not be there. Confirmed by code inspection that
`travel-window/`'s module has no path that writes to or displays in that
list — it only ever renders the separate "Possible trips" review card — so
this is the GPS reconstruction engine's own output, not a travel-window
regression. Left untouched per this file's module boundary (decision 0021
owns that engine); worth checking against Finding F11 and the other
production-adapter findings in
[baseline-fbfe8b8.md](../_bmad-output/specs/spec-trip-recognition-repair/baseline-fbfe8b8.md)
when that work resumes.

## M10 accepted; M10.1 lifetime benchmark running (2026-11-19)

Decision 0021 is accepted. `apps/mobile/scripts/benchmark-lifetime.cjs`
(`npm run benchmark:lifetime`) runs the **unmodified** production engine
(`projectCanonicalCandidateHistory`) against synthetic, labeled scenarios and
freezes a baseline: 21/50 scenario+Home-mode combinations matched their
label; 5 hit Finding F1 exactly (a corroborated, all-gates-passing trip
scoring under 70 silently becomes `NOT_TRIP` with an empty reasons list); 0
false Atlas trips. Every abroad scenario regresses from `atlas` to `possible`
when Home is "learned" instead of owner-set, confirming Findings F4/F5. The
run also found a new gap, Finding F11: `qualifyGraphJourneyV11` hardcodes
`captureLike: true` and ignores `sourceOrigin`, so screenshot/download
photos with GPS can still qualify an Atlas trip through that path. Full
table: [baseline-fbfe8b8.md](../_bmad-output/specs/spec-trip-recognition-repair/baseline-fbfe8b8.md).
Coverage so far: scenarios S1-S6, S9-S10, S12-S14, S16, S18-S19 and probe
cases A-H; S8, S11, S15, S17 and S20 (merge, moving-house, correction-survival
and reason-accuracy cases) are the next increment. M10.2 (read-only phone
count) still needs the owner's device connected. M10.3 onward are unstarted.

## AI clue layer and learning planned (M11, 2026-11-19)

The owner proposed a background AI engine after the rule engine that
strengthens results and learns from corrections, and accepted three
refinements ([decision 0022](decisions/0022-ai-clue-layer-and-learning.md)):
AI only adds versioned clues and the same rules re-decide; work is quiet but
changes show as a short "updated" note and never remove an Atlas trip or touch
reviewed trips; learning is automatic personal rules (listed and removable in
Settings) plus gated product versions that need an eval pass and owner
approval. Roadmap epic M11 (eight P1 stories) and
[SPEC-ai-clue-layer](../_bmad-output/specs/spec-ai-clue-layer/SPEC.md) start
after M10.7 and reuse the M10.1 benchmark. Existing sign reading, landmark
matching, capture offset and optional Gemini Nano become clue producers; the
cloud metadata path stays off. Nothing implemented.

## GPS-less trip discovery: Takeout imports trusted for detection (2026-11-19)

Story 1's folder-category breakdown found that 99% of "unknown"-provenance
photos (15,710 of 15,824) came from just one or two distinct top-level
folders, dominated by a bulk Google Photos Takeout import spanning 2012-2023
with explicitly travel-named albums — several times more photos than the
device's actual camera roll. Asked directly, the owner decided this should
count as trusted evidence for *detecting* a trip, not only for review. See
[decision 0020](decisions/0020-trusted-takeout-provenance.md).

Implemented as a new `imported` provenance class (kept distinct from
`camera`, never silently merged) trusted the same way in window formation,
home-offset inference and membership. Verified on-device: camera-trusted
coverage rose from 13% to 89%, candidate windows from 12 to 32, including
**seven new consecutive travel-looking windows from 2022-03-26 to
2022-05-31** (a roughly two-month trip, offset-shift evidence only, no
country named) that the original camera-only rule could not see at all. 173
tests pass; full checks pending before commit.

## Reconstruction engine review: silent trip loss found (2026-11-19)

The owner asked for a review of the lifetime reconstruction engine. All 69
engine and candidate-projection tests pass, but they check rules, not trip
quality. A synthetic probe through `projectCanonicalHistory` and
`qualifyGraphJourneyV11` (scratch only, not committed) found that only
AUTO/USER_CONFIRMED trips reach Atlas, and that:

- a corroborated trip that passes every gate but scores 45-69 falls to
  `NOT_TRIP` with an empty reasons list (2-day domestic trips at 65 km and
  230 km with a configured Home), while an uncorroborated one becomes
  `SUGGESTED`;
- the DAY and STAY paths never fire because `episodeSpanMillis` and
  `supportPlaceSeparationMeters` are never populated, and `sessionId` is the
  civil day, so a one-day trip can never be corroborated;
- with a learned Home, home photos within two days join the trip episode
  (only a configured Home is a boundary), the Home place is then excluded as a
  base, and the trip stays `UNCONFIRMED` (including a 4-day abroad trip);
- the foreign-country bonus exists only with a configured Home, and
  "rare destination" is a photo-count proxy, so an isolated 14-day abroad trip
  with a learned Home is `NOT_TRIP`;
- Home has three definitions across passes, `foreignToEveryBase` has two
  meanings, the routine veto and several V1.1 helpers are unused, and the
  native importer always sends `hasPreciseOffset: false` and no source origin.

These are synthetic results. Whether they explain the owner's real library is
unmeasured. Several are divergences from the V1.1 contract itself (it requires
SUGGESTED for gated 45-69 scores, real sessions and date-scoped bases); V1.1's
staged generation tables were also never built.

The repair is now planned as roadmap epic M10 (eight backlog stories) under
[SPEC-trip-recognition-repair](../_bmad-output/specs/spec-trip-recognition-repair/SPEC.md)
and accepted [decision 0021](decisions/0021-trip-recognition-repair.md):
measure (synthetic lifetime benchmark, read-only device count), conform as
`trip-detector-v1.2`, consolidate to one detector, adopt via an owner-approved
dry run.

Owner direction (same day) replaced the open questions: Home is mandatory
in onboarding and is only what the owner sets there or in Settings (no
learned Home, so "Skip for now" goes, Settings keeps at least one Home, and
no rebuild runs without one; a Home's period is optional, Forever by
default, with optional From/Until month-and-year pickers instead of typed
dates; a hometown is travel unless set as Home); a trip at least 50 km from Home with at least 5
reliably located, corroborated photos shows on Atlas with no score gate;
anything unsure goes to Possible trips showing one concise reason sentence
(eight fixed reasons, including `home-not-set` with a Set Home action).
Regular commutes go to Possible as `frequent-place`, an applied
interpretation the benchmark will measure.

Decision 0021 accepted 2026-11-19. M10.1 (lifetime benchmark) starting.
M10.2 (read-only phone count) needs the owner's device connected.

## GPS-less trip discovery: Story 1 complete, Nano honesty eval passed (2026-11-19)

Story 1's third and last question is answered. The owner correctly pushed
back on an earlier plan to use their own Korea/Sa Đéc photos for this
check — Story 1 is meant to need no owner chores, and a per-owner fixture
could never be re-run by anyone else. Rebuilt as a public fixture instead:
five openly-licensed Wikimedia Commons photos (three Korea, two Vietnam/Sa
Đéc controls), pinned by sha256 in
[nano-honesty-v1.json](../evals/landmarks/nano-honesty-v1.json), pushed only
to the device's own app-private storage. A new native Nano wrapper
(ML Kit `genai-prompt`) ran the spec's exact prompt against each image on the
owner's Xiaomi 15. Result: **zero bluffs on either control** (both answered
UNKNOWN, including the spec's own named Sa Đéc control), and both Korea
images with readable text were named correctly (`SEOUL`); the text-free
palace photo was correctly left unnamed. Story 1's honesty bar passes, but
n=5 is a feasibility check, not an accuracy measurement, and this does not by
itself justify turning the Nano clue on in production. See
[delivery.md](../_bmad-output/specs/spec-gps-less-trip-discovery/delivery.md)
for the full table and caveats.

Getting a working build took real iteration: the library's current release
needs a newer Kotlin compiler than this project uses project-wide (not
changed, to avoid a broader risky bump); its very first `alpha1` release
turned out to pin an old enough Kotlin stdlib to compile, confirmed by
disassembling the actual AAR classes rather than trusting the current docs
(which describe the newer, incompatible release). See the error playbook for
the on-device tooling lessons from pushing files into app-private storage on
this ROM.

## GPS-less trip discovery: Story 1 evidence (2026-11-19)

Disk space and the owner's Xiaomi 15 became available. The native Kotlin
capture reader compiled and ran on-device (full camera-roll scan, 18,962
photos, offset tags/folder/local clock only, no GPS or place data). Story 1 Q1
and Q2 are answered **yes** with real evidence: 33.7% of captures carry an EXIF
offset tag, including a +09:00 (Korea) cluster of 458; the unmodified
window-detector found a travel-looking window on 2026-11-02..11-06 (458
captures, +120min shift — exactly Korea vs. home) via its `offset-shift` clue,
plus three further travel-looking windows from other trips. A new,
session-added local-clock-vs-UTC comparison (Story 1's second clue) also shows
signal on the untagged 66% of the library (partial yes; not yet cross-checked
against window dates). Story 1 Q3 (Gemini Nano honesty test) is not run — it
needs the owner to identify specific Korea/Sa Đéc photos, a real decision only
they can make. A new open question: only 12.9% of captures classify as
`camera` provenance under the current exact-folder-match rule; the cause
(folder naming vs. real library mix) is unresolved and was deliberately not
investigated by inspecting real folder strings. See
[delivery.md](../_bmad-output/specs/spec-gps-less-trip-discovery/delivery.md)
for full figures.

## GPS-less trip discovery spec drafted (2026-11-18)

A BMAD party discussion with the owner produced
[decision 0019](decisions/0019-gps-less-trip-discovery.md) and a draft
[spec](../_bmad-output/specs/spec-gps-less-trip-discovery/SPEC.md). GPS-less
trips are found from metadata first, membership comes from capture provenance,
and a place is named only when two free on-device clues agree. A wrong country
must never appear; the owner can type the place instead. Abroad trips ship
first. Story 1 is an evidence experiment on the owner's Xiaomi 15 (time-offset
tag, capture-time mismatch, on-device Gemini Nano honesty). It is blocked until
the development machine has enough free disk space. The pure decision core
(`apps/mobile/src/travel-window/`, 23 tests) is delivered but not wired into the
app. On 2026-11-19 a native Android capture-metadata reader (offset tags and
storage folder only) and its pure mapper/scan with the `TRAVEL_WINDOW_SCAN`
diagnostic map were added with 50 tests; the Kotlin is not yet compiled because
a fresh Android build needs more disk than is free. Story 1 and app wiring
remain open. See
[delivery.md](../_bmad-output/specs/spec-gps-less-trip-discovery/delivery.md).

## Foundation CI history-bundle check made host-independent (2026-11-19)

The next hosted Foundation run still failed at the history bundle `--check`.
The cause is gzip output that depends on the host: the Windows header OS byte
is 10 and Linux writes 3. The check now compares decompressed packed JSON and
all other bundle bytes exactly, and it normalizes CRLF in the committed file. A
regression test covers a bundle re-gzipped as if on another host, plus stale
data and stale code. Hosted Foundation run 26 (commit `511326c`) passed every
step: root check, mobile check and, for the first time, the Deno contract test.
The earlier Windows `ARTIFACT_WRITE` cause remains unknown.

## Foundation CI follow-up remains open (2026-11-18)

Run 24's two remaining root-check failures are addressed locally. The history
builder now normalizes CRLF/LF before hashing and transpiling; its regenerated
bundle passes the digest regression and the full root `npm run check` (281/281
tests plus eval smoke). The synthetic benchmark success fixture no longer uses
a host-dependent RSS ceiling, while its dedicated resource-gate coverage
remains; its focused test passes. The full mobile check passes 1,314 Jest tests,
141 SQLite tests, typecheck, lint and Expo Doctor (21/21) after aligning the
mobile package lock and manifest with the SDK's patch map. The required Deno
contract test could not run locally because Deno is unavailable; hosted
Foundation Actions must still verify root, mobile and Deno together. The earlier
Windows `ARTIFACT_WRITE` failure did not recur in the two later full root runs,
but its original cause remains unknown. Do not claim the workflow is green
before the hosted run passes.

## Foundation CI dependency order (2026-11-18)

GitHub Actions runs 22 and 23 both stopped in the root generated history-domain
guard because its generator requires the mobile TypeScript package, which CI
installed only after `npm run check`. The workflow now installs mobile
dependencies first. The failing guard passed in the local foundation run after
the dependency was available. The full Windows check had one separate
`ARTIFACT_WRITE` failure in the offline-landmark publication test (280 passed,
1 failed); a same-directory rename probe passed, so its exact cause is unknown
and remains an environment/check limitation, not part of this CI ordering fix.

## Generated history-domain bundle freshness

The foundation check initially rejected a stale generated
`supabase/functions/_shared/history-domain.js` after its mobile TypeScript
source graph changed. Regenerating with `node scripts/build-history-domain.mjs`
updated the checked-in digest artifact; `--check` now passes. This does not
deploy a worker or change runtime behavior. The complete foundation check
passed with all 281 tests and the eval smoke check.

## City-level GPS-less proposals

The Android development preview now shows a city-level **Possible trips**
card as soon as independent supported sessions establish the city and trip
continuity. The existing Seoul recognizer can supply named and civic clues.
Synthetic cases verify the same policy for Hà Nội. Review lists
only verified named stops, and confirmation saves the exact eligible album
with capture locations still unknown. Insufficient or conflicting evidence
continues to abstain. Discovery uses the existing on-device permission.

Synthetic provider and SQLite cases passed. The frozen public comparison
retained two exact multi-stop albums and withheld the single-session Hanoi
holdout. The regional release remains unqualified, and named-place recognition
for the Hà Nội scenario has no demonstrated native path with that pack off.
Mobile Jest (1,314 tests), SQLite (141 tests), TypeScript, Expo lint,
foundation (281 tests) and the
Android development JavaScript bundle passed. ADB saw no device during these
checks. A later USB session loaded the current city policy and started the
authorized Local scan on the owner's Android. Three analyzed groups returned
no recognized place and committed scan progress. Android paused the app
during several attempts, which resumed on returning to Atlas. USB disconnected
during a later eligibility action. After reconnecting and restoring the Metro
route, the next scan settled after 13 acknowledged checkpoints. Six groups
reached recognition, and none returned a usable place. Atlas had no Possible
trips card for the target. Episode-specific sample coverage and owner-device
album acceptance remain open.
[Decision 0018](decisions/0018-city-level-possible-trips.md).

## Automatic regional landmark retrieval

The Android development code can verify a pinned public release, search a
starter index across regions, and acquire a deeper pack after independent
capture sessions agree. The same flow feeds Possible trips and exact album
review in both regions. Consent or scope withdrawal discards stale work.
Transient starter failure preserves the checkpoint. A retryable deep failure
preserves an unresolved episode or keeps its independently qualified album.

Whole-image retrieval produced no exact positive albums in the public cases.
A separate host comparison using agreeing crops and the existing local-detail
verifier produced the exact Seoul and first Hanoi episodes and no false match
in the scored camera controls. A second Hanoi set remained unresolved. Even
the full Vietnam pack and crop policy missed both fresh Tháp Rùa views.
The starter and largest deep artifact exceeded the combined pack budget.
No qualified pack was emitted. The Android flag remains off. The next quality
gate needs wider independent viewpoint coverage, camera reproduction controls,
and a bounded model profile measured on Android.
Final host checks passed 1,295 Jest cases, 139 SQLite cases, TypeScript,
Expo lint, 281 foundation cases and the routed Android JavaScript bundle.
[Frozen benchmark and holdout](../evals/landmarks/README.md#automatic-regional-retrieval).

## Partial Seoul proposal in Possible trips

The Local development preview separates the optional Nami clue from the
qualified stops and album. The owner opens the automatically generated card
and reviews the exact album before confirmation. The separate development
flag uses the current on-device recognizer. The image reference index remains
Ewha-only and Namsan recognition still depends on existing signage support.

The five public partial comparisons reproduced their expected album and clue
results. The wider quality gate still misses genuine Nami coverage. Jest
(1,267 tests), SQLite (138 tests), TypeScript, lint and foundation (281 tests)
passed. Expo Doctor flagged existing SDK 57 patch-version drift.

The owner connected Android and opened the reviewed localhost bundle. Local
eligibility initially blocked recognition on stale evidence. The existing
catch-up action reported an active lease, then an SQLite busy open on retry.
Afterward discovery verified eligibility, opened media and ran the model.
Ten observed recognition batches abstained. The foreground Timeline showed
no Possible trips card after checkpoint activity stopped. The diagnostic
cannot identify whether a particular batch contained the target Seoul photos.
No Seoul proposal or owner album confirmation was verified on the phone.
[Delivery and diagnostics](../_bmad-output/specs/spec-atlas-reconstruction-recovery/delivery-and-diagnostics.md#partial-seoul-proposal-in-possible-trips).

## Partial Seoul proposal and independent membership

Five public fixture episodes reconstructed the expected Seoul proposal
with Ewha and Namsan, four exact album photos and two correct covers.
Nami appeared once as a place-only pending clue in four cases. No
pending Nami source photo entered the proposal album or covers.

The existing scene rule admitted an unnamed GPS-less photo in a
controlled synthetic scene bracket and preserved its unknown location.
It excluded the same-time reproduction, unrelated image and screenshot.
The public Ewha panorama entered the test follow-up sample but did not
clear scene similarity against either anchor. An exploratory scan of
additional campus photographs also failed to meet both anchor
thresholds. This supports the partial proposal structure on the host.
Real GPS-less album recall and Android acceptance remain open.
[Host evidence](../evals/landmarks/README.md#partial-seoul-proposal-and-photo-membership).

## GPS-less multi-view Nami experiment

The same-sample host comparison recognized all three simulated
reproductions when the corresponding original was available. The
genuine GPS-less ferry and zipline photos showed different scenes.
They yielded five mutual correspondences and no usable geometric
model. The mixed genuine and unindexed-copy pair also abstained.
The stricter policy kept the reproduction out of the album and lost
the two Nami photos from the genuine episode. Three public pairs
showing closer views of the same subject also fell short.

The experiment demonstrates a useful known-source copy check and
insufficient geometric coverage for trip recovery. A synthetic
nonplanar control supported a stop through the existing assembler.
The genuine public episode did not. Keep the Android acceptance
gate open. [Multi-view evidence](../evals/landmarks/README.md#nami-multi-view-geometry-comparison).

## Capture evidence split for Nami

The host comparison kept each model match as a private clue. When
the two Nami photos had their own qualifying fixture location
records, the existing assembler produced Ewha, Nami and Namsan
with six exact album members. Foreign coordinates and known copies
stayed out. A nearby located capture did not attach the sampled
GPS-less match.

The rule improved exact results from five to six of ten constructed
cases. It missed the actual Nami stop in three genuine scenarios
with missing or coarse location evidence. An uncaught copy carrying
the same qualifying location signal still entered the album. The
current GPS-less SQL excludes located assets and the available
metadata does not validate original-camera provenance. Keep the
policy experimental. The next candidate needs an independent signal
available for GPS-less media before applying it to the Local library.
[Capture evidence comparison](../evals/landmarks/README.md#nami-capture-evidence-comparison).

## Nami visual detail and copied-image evaluation

The frozen 0.70 detail rule accepted zero of one fresh Nami views,
zero of three prior Nami views and zero of twelve controls. A local
geometry check identified the simulated copies of two indexed images
and missed a borderless crop derived from an unindexed original.

At an exploratory 0.50 threshold, real zipline and ferry photos
produced one Seoul trip across Ewha, Nami and Namsan with six exact
photos. Replacing the ferry photo with the unindexed copy also
produced a Nami stop and put the copy into the album. The Android
gate remains open. Evaluate separate capture context before treating
an image match as trip evidence, and acquire more independent
campaigns for the next quality gate.
[Visual detail evidence](../evals/landmarks/README.md#nami-visual-detail-and-copied-images).

## Nami independent host evaluation

The frozen ferry OCR policy missed all four new landmark views, while
accepting three of four synthetic printed controls. Two plain prints
with different names for the same island produced a false Nami stop and
both entered the six-photo album. The other ferry and Damyang inputs
stayed out. The bounded follow-up could not recover the crowded
episode when no Nami observation survived the first pass.

An after-the-fact check requiring the existing scene verifier to
corroborate Nami text blocked the printed inputs and also suppressed
the original ferry success. Keep the tested Nami OCR policy out of
Android. The next recognizer needs visual evidence for multiple
independent Nami landmarks and adversarial examples with printed
place names. Preserve this set as regression evidence and use fresh
captures for the next holdout.
[Holdout evidence](../evals/landmarks/README.md#nami-independent-host-evaluation).

## Seoul multi-stop host experiment

The local experiment recovered one Seoul proposal with Ewha, Nami and
Namsan and exactly six intended photos on a two-day public fixture with
simulated capture times. DINOv2 identified Ewha and Namsan. Windows OCR
over fixed overlapping tiles, with a narrow spelling tolerance for the
ferry banner, supplied the two Nami observations. Whole-image OCR and
exact tiled OCR both missed Nami. Moving the water-meter image into the
same four-hour sample bucket displaced one ferry photo and removed Nami
from the result. A bounded follow-up on one Nami observation recovered
that photo and restored the exact album. The photographed meter, billing
screenshot and winter Damyang false match stayed out.

This is calibration on public inputs with the deep references loaded
locally. The host candidate has not been integrated into the app. Next
verify the signage and follow-up policy on untouched Nami viewpoints,
lookalikes and printed-media negatives, then verify region routing and
native Android OCR, latency and exact album readback. [Experiment record](../evals/landmarks/README.md#seoul-multi-stop-host-experiment).

## Namsan local landmark pilot

Two licensed Seoul Tourism Archive references complement the Seoul
Institute collection. On the 13-query v3 public follow-up, matching
the spatial layout of DINOv2 patches found 3/3 Namsan views compared
with 1/3 using either scene baseline, with zero Namsan false accepts
on ten non-target photos. This passes a single-landmark host gate.
Both scene baselines still mistake the winter Damyang control for Nami.
Automatic regional routing, trip and album accuracy, and device resources
remain open. The next test needs a combined recognition policy with
independent landmark or signage evidence for Nami and full episodes.
[Namsan pilot evidence](../evals/landmarks/README.md#local-landmark-detail-v3).

## Offline landmark verification pilot

The host benchmark now tests DINOv2 candidates against reviewed competing
references. It rejected a new Damyang-to-Nami false match and retained
three of seven correct positives. The original winter Damyang failure
still reproduces. Four 2020 Namsan references and two 1995 queries are
pinned to item-level licenses from the Seoul Institute. Both Namsan
queries abstained and the reference publisher diversity requirement remains
open. Neither matcher routed the two known regions, so the device
integration gate remains closed. The next candidate needs a distinct
landmark signal and independent modern Namsan views.
[Verifier evidence](../evals/landmarks/README.md#competing-reference-verifier-v2).

## Offline landmark pilot scored

The host tool audited five landmarks against Google Landmarks v2,
Wikidata and Commons, froze 24 public or synthetic inputs, and generated
starter, Korea and Vietnam descriptor packs. With the same nine reference
originals, the deeper DINOv2 index matched seven of eight positive queries
and misidentified one of seven controls. SALAD abstained on all 15 under
the frozen policy. Both starter policies routed zero of two assembled
episodes. The benchmark now counts wrong predictions per photo and checks
for false routes on wholly out-of-index episodes before a pack can qualify.
Namsan has no admitted references after rights and content review.
The quality gate keeps the packs out of the app. Next measure corroboration
and hard negatives on a separate calibration set, then rerun with an
untouched holdout and rights-cleared Namsan coverage. Phone scan time,
resource use and the owner's trip/album acceptance are still open.
[Source audit, commands and results](../evals/landmarks/README.md).

## Multi-stop visual recovery and Vietnamese labels in development

The Atlas reconstruction recovery spec now separates visual stop hypotheses,
trip continuity, album membership and card covers. It requires an automatic
multi-stop proposal and exact album readback after one owner confirmation.
The domestic label slice covers verified city and province names beyond the
current two pilot footprints and preserves supported stops in multi-place
titles and detail. The Local build now carries per-photo visual evidence,
qualifies stops and album attachments independently, and saves the exact
reviewed album with SQLite v45. Historic administrative labels cover the
63-province archive for its conservatively supported 2020–2024 interval.
The urban layer has 42 footprints for 14 locality names. The default
Android scanner remains bounded and development-gated. Public tower views
abstained in image comparison. The new catalog can read verified landmark
signage, but multi-landmark image coverage and physical-device recovery
remain open. The first Android load stalled in destination computation and
exited. The optimized resolver completed the same phase, published Atlas,
and reached the incident window using the normal discovery budget. The
recognizer completed and advanced beyond the window with no place match
or proposal. The owner's trip and album have not passed native acceptance.
[Updated recovery spec](../_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md).

## Native image recognition for automatic trip discovery (2026-11-12)

The Android development scanner now uses a quantized DINOv2 Small model
through Atlas's native Expo module when OCR yields no place or conflict. The
reference catalog covers the Ewha Campus Complex. The Local consent and
confirmation gates remain in effect. The model does not use photo dates or
owner selections as recognition inputs.

The model matched both public independent views excluded from the reference
index and abstained on the different campus scene and three architectural
controls. These were development controls. A broader blind dataset and the
Android proposal are still required. The arm64 debug APK uses a pinned ONNX
runtime and was installed in place over the previous app. Metro served the
updated Android bundle. iOS retains its OCR-only recognizer. Android loaded
the model in two seconds and completed image comparison on the reported
episode in 11 seconds, then advanced with no proposal.

The wider-sample policy now keeps the 32-photo OCR limit and checks up to
96 representatives with the Android image model after OCR abstains. A dense
synthetic episode verifies that the later representatives can supply the
clue and survive SQLite staging and review. The 122 focused mobile tests,
two SQLite discovery controls, TypeScript, lint, and foundation checks passed.
The wider Android pass took 35 seconds for image comparison and abstained.
The next reference version covers both ECC and Pfeiffer Hall in full and
portrait crops and recognizes exact Seoul municipal signage. Three independent
public target views matched. Five comparison views abstained. The corresponding
96-photo Android pass completed image comparison in 36 seconds and staged no
proposal. The latest host verification passed 123 mobile tests, two SQLite
discovery controls, TypeScript, lint, and the foundation check.

The optional dense diagnostic passed a synthetic 471-photo coverage check.
On Android, a metadata-only count found 471 capture-like, available images
with no GPS in the reported window. After a committed-view refresh and a
foreground interruption, the expanded Android pass validated and stored an
image-backed proposal for the incident window. Atlas read it back and displayed
it under Possible trips with Confirm trip. Owner confirmation is pending. The
successful pass used the development-only diagnostic. The default 96-image
pass did not recover this trip.

Owner review then reported that the four-photo album omitted the other stops
and included unrelated media. AC-13 remains unmet. The prior device check
verified proposal visibility and visual recognition only. Source inspection
found that automatic discovery carries one resolved place for the episode and
uses the four-photo review limit as the album membership limit. It selects
decodable media from another session without requiring positive association
with the trip. The individual device asset paths remain unverified.

## Historical geometric recognition pilot for automatic trip discovery (2026-11-12)

The Local development scanner can compare image features against public
references of Ewha Campus Complex when OCR supplies neither an accepted
place nor a conflict. The new recognizer policy allows one fresh automatic
pass under the existing on-device authorization. The existing review flow
requires owner confirmation to add a trip.

The host matcher accepted a cropped reference and rejected a different campus
scene. It missed two independent target views. After reconnecting and waiting
for the Atlas evidence revision to catch up, the Android scan reached the
episode. It spent 467 seconds in recognition, advanced the checkpoint and
staged no proposal. The native model replaces this geometric implementation.
[CAP-4 delivery and diagnostics](../_bmad-output/specs/spec-atlas-reconstruction-recovery/delivery-and-diagnostics.md).

## Android OCR result debug (2026-11-12)

The foreground v4 run showed a sampling v3 checkpoint inside the reported
window before the recognition batch. The correlated batch finished with
VISUAL_NO_PLACE_MATCH, then the checkpoint moved beyond the window with
no proposal. Native OCR returned at least one alphanumeric character, and
none of the processed OCR outputs resolved to an accepted catalog place.
This does not establish whether the sample contained an Ewha sign or what
OCR returned. The visible Local Atlas still had no Possible trips card.
No recognition or sampling behavior changed in this diagnostic update.

## Wider automatic sampling for dense GPS-less trips (2026-11-12)

The Local development scanner retains its original 12 session representatives
and uses up to 32 for dense episodes, with a bounded hourly checkpoint.
The existing episode and dismissal identities remain stable. A synthetic
471-image episode now recovers an OCR clue outside the original sample and
the SQLite resume test rejects malformed coverage. Focused Jest, SQLite,
TypeScript, lint and the foundation check passed.

The fresh Android sampling v3 checkpoint began inside the reported window.
The next recognition batch completed with VISUAL_NO_PLACE_MATCH after about
35 seconds including preview resolution, and the checkpoint advanced past
the window with no proposal. The visible Local Atlas showed no Possible
trips card. Sampling alone has not recovered Seoul. Image-only recognition
remains outside this build pending a measured local recognizer.

## Android automatic discovery follow-up (2026-11-12)

Owner enablement and automatic recognition of multiple candidate groups are
confirmed by retained Android development events. A read-only device probe
showed that the scanner passed the target window without a saved proposal.
The target metadata forms one eligible episode with 11 independent sessions
and no overlap with a confirmed trip. The historical result event combined
three abstention outcomes, so the exact recognition cause remains unknown.
The diagnostic-only v3 policy distinguishes no place match, place conflict
and insufficient episode support. The new version allows one fresh blind
scan under the existing owner authorization. This is still a signage
recognizer, and the Seoul acceptance remains open. The 29 focused mobile
tests, two SQLite discovery controls, TypeScript, lint, and foundation
check passed. Metro served the updated Android bundle over IPv4. After
unlocking, the Android foreground run resumed with the owner setting still
enabled. The v3 checkpoint advanced beyond the incident interval without a
proposal. Several native recognition batches returned VISUAL_NO_PLACE_MATCH.
The visible Local Atlas showed no Possible trips card. The diagnostics
carry no episode identifiers, so they do not establish which recognition
batch corresponds to the reported trip or why the catalog did not match.
The blind Seoul recovery criterion remains unmet.

## Automatic GPS-less trip discovery development build (2026-11-11)

The gated Local Atlas now discovers GPS-less episodes and chooses
representative photos automatically after the owner enables on-device
discovery in Settings. Atlas presents a Possible trips card with a suggested
place, observed dates and photos. Confirmation writes and verifies the
owner-entered trip and album. Dismissal persists for unchanged evidence.
The device-development and owner-consent gates both default off.

Focused Jest and synthetic SQLite controls passed for the six-day paged
episode, independent capture sessions, resume, late access withdrawal,
deduplication, Home overlap, exact save retry and closed diagnostics. The
development recognizer matches a versioned signage catalog using native OCR.
The blind Seoul recovery, image-only recognition, physical iOS checks,
resource measurements and held-out quality remain open.
[CAP-4 delivery and diagnostics](../_bmad-output/specs/spec-atlas-reconstruction-recovery/delivery-and-diagnostics.md).

## Owner-directed recovery for trips without GPS (2026-11-11)

Read-only Android counts confirmed the reported recent interval was imported
and assessed by the current run. The records have no stored GPS, and the
image availability state is unknown. The passive visual hint requires known
availability and nearby travel corroboration. The Local development visual
review now offers a date-range search independently of the passive hint.
It pages eligible photos, resolves them through the existing native preview
path, and analyzes up to four owner-selected photos from one page after
approval. The owner confirms the suggested place before Atlas saves the
private trip and selected album. An inconclusive result leaves the trip
unsaved. Android previously displayed 12 selectable tiles for the reported
period. The updated suggestion-to-confirmation contract passed focused Jest
and SQLite tests, TypeScript, lint and the foundation check. The current
on-device recognizer covers Ewha signage. Actual photo recognition, original
EXIF and broader place-recognition accuracy remain unverified.
[Delivery and diagnostics](../_bmad-output/specs/spec-atlas-reconstruction-recovery/delivery-and-diagnostics.md).

## Atlas reconstruction recovery build (2026-11-11)

The [recovery build](../_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md)
includes observed-date Timeline order, exact-pair review with a dotted cue,
offline typed Home search and verified Sa Đéc and Cần Thơ label controls.
Timeline, detail, album and Replay use the same published-run selector. The
two-connection SQLite fixture browses the saved Atlas while the replacement
writer has uncommitted rows. Late authority loss rolls back the experimental
projection.

The Settings comparison ran baseline and candidate on the same 20,002
synthetic evidence records. A separate opt-in Local development policy
persists eligible pairs with an exact reviewed merge and retry, protects
Replay choices and fences incompatible Account export. The on-device
signage experiment requires exact selected photos and consent, then supports
confirming a private owner-entered album with capture location unknown.
The recognizer currently covers catalogued Ewha signage, and hints require
separately corroborated nearby travel.

The Android arm64 APK built after regenerable ABI cache cleanup and
serializing the failing C++ compilation. It installed after USB reconnection
and opened with the current development bundle. The same-input comparison
completed read-only on 19,429 real Local records in 161.7 seconds.
On the device, typing `Sa Dec` in Settings Home search displayed Sa Đéc with
province context. Android Timeline subsequently displayed 49 trips. A sampled
trip opened its album, showed 18 visible photo tiles and rendered a selected
photo in the full-screen viewer. The Replay checks, Seoul recognition on actual
photos, iOS build and holdout quality remain open. The Local projection and
signage gates default off. The device session enabled only the read-only
comparison and consent-gated signage experiment.

## Atlas reconstruction recovery spec (2026-11-10)

The owner chose a quiet proactive Atlas hint for a promising GPS-less cluster.
AI runs only after the owner selects media and explicitly approves processing.
The [development contract](../_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md)
covers the eight reviewed items, including cross-border grouping, Timeline
merge cues and chronology, searchable Home, verified Vietnam labels, reliable
rebuild and album readback, and full-scale Local comparison. Visual recognition
has its own consent and activation gate. Provider, dataset and measured policy
thresholds remain open.

## Trip merge suggestions and searchable Home bases (2026-11-10)

The owner chose to keep two independently qualified trips visible when the
connection is plausible but lacks supporting evidence, with an optional merge
suggestion. Home base setup must start with typed place search and result
selection. [Decision 0017](decisions/0017-trip-merge-review-and-home-search.md)
records these choices. The continuity thresholds and place dataset remain
open. The owner confirmed that city, province, district, ward, and commune
search is sufficient and requires a visible pair cue on Timeline for merge
suggestions. The exact visual treatment is a design proposal.

## Recognizable travel reconstruction and first reveal (2026-11-10)

The owner chose one optional first-reveal question when an answer could
recover several trips, and a separate Possible trips section. The
[development spec](../_bmad-output/specs/spec-recognizable-travel-reconstruction/SPEC.md)
builds on optional editable Home setup. It defines a versioned local candidate,
first reveal with eligible Replay, scoped review decisions and a held-out
comparison before activation. AI remains a separate optional experiment.
Implementation and product-quality measurements are pending.

Development has started in shadow mode. Candidate engine, controlled reveal
and review components, bounded clarification simulation, and local receipt
storage have executable coverage. An opt-in read-only Settings preview now
compares authorized committed Local history with the candidate. Device
acceptance and production actions remain open. The live Atlas continues on the existing
policy. See the [implementation record](../_bmad-output/specs/spec-recognizable-travel-reconstruction/delivery.md)
for runtime integration and activation gates.

D2 adds an opt-in development Atlas for connected Local history with full
photo access. It shows passive photo observations, a first-use featured trip
with temporary private playback, and separate paged Possible trips. Keep
publishes only an exact compatible grouping. Not a trip records a Local
rejection for the exact candidate; account export is fenced while that receipt
has no portable format. Remaining work includes Keep for candidate-only
regroupings, rejection restoration, D3, the held-out comparison and physical
Android/iOS acceptance. The owner has no device available for this pass.

Android reconnect follow-up: an authorized USB phone loaded the current
development bundle from a separate Metro session with both reconstruction
flags enabled. The foreground accessibility hierarchy confirmed Your Atlas
and Open Settings. Android denied injected taps. Owner-driven navigation
and the actual comparison, playback and review checks remain pending.
The owner opened the read-only comparison. The current Android process
confirmed `ROW_LIMIT` at the committed evidence read. This development
comparison supports up to 4,000 canonical records. The screen now explains the
limit. Use a small isolated fixture for D2 device acceptance while retaining
the owner's full Local history.
During follow-up the Local Timeline briefly showed zero journeys while the
phone's complete run still held 49 qualified journeys. A later preview read
completed and the foreground Android gallery showed an associated thumbnail.
The transient empty view and earlier failure remain unattributed.
The owner requested a direct Android Atlas inspection. Timeline rendered 49
journeys with thumbnails. The durable display order had 16 adjacent date
inversions because it sorts by year and then internal journey ID. Fifteen
trips shared a country and start month with another trip. Chronology and
Timeline density are verified issues. Exact grouping quality remains open.

## Offline regional label defect reproduced (2026-11-09)

An inspected owner photo's original metadata, saved GPS and gallery reference
agreed. Two independent public Sa Dec reference points reproduce the incorrect
Can Tho label in the production resolver and in a direct check of the bundled
Vietnam Admin-1 polygons. The correction belongs to offline regional data or
its confidence policy. The shared resolver now withholds Vietnam Admin-1
labels and uses the country fallback. Public regression points cover the
wrong labels in Sa Dec and Can Tho, with existing unaffected-region
controls retained. Exact province display awaits verified boundaries.

The current CAP-6 replacement recovers only the reviewed Sa Đéc and Cần Thơ
footprints. Owner review reported the loss of useful labels for other domestic
trips. A host comparison at a public Huế city point reproduced the change
from Thừa Thiên Huế in the previous resolver to Vietnam in the current
resolver. General domestic destination coverage remains open.

## Home-first local implementation awaiting device acceptance (2026-11-09)

First-use Home setup now precedes photo choice, with multiple dated areas,
an offline picker and Skip. Local Home editing and the shared reconstruction
repair are implemented. SQLite tracks the committed Home revision and the
gallery has a private development inspection for the selected original.
Foundation, mobile and SQLite checks passed. Exact owner cases, Android/iOS
acceptance and account compatibility negotiation remain open. See the
[delivery record](../_bmad-output/specs/spec-home-first-journey-integrity/delivery.md).

## Home-first journey integrity spec ready for development (2026-11-09)

The owner asked for a development contract after the BMAD discussion. The
[spec](../_bmad-output/specs/spec-home-first-journey-integrity/SPEC.md)
defines optional Home selection before first build, effective Home filtering,
the adjacent-block continuity repair, scoped Local/Account publication and
exact-item media diagnosis. Six capabilities and 30 acceptance cases define
implementation and rollout. The wrong-image incident still needs a matched
asset comparison. Runtime implementation and physical acceptance are pending.

## Home-first onboarding and journey diagnosis (2026-11-09)

The owner is discussing optional, independent Home base selection before
the first automatic build. The current Settings flow still requires a
published trip. The shared continuity engine was shown to measure civil-day
gaps from the start of the accumulated episode and to corroborate Home
returns across distant dates. Read-only Android aggregates match the former
defect at multiple nearby trip boundaries. In the reported album window,
local committed GPS supports the displayed destination, but the owner
recognizes another location in the cover and album. Exact asset resolution
versus original metadata remains open. See the
[investigation](../_bmad-output/implementation-artifacts/home-first-journey-diagnosis-2026-11-09.md).
Foundation checks passed; no behavior or owner data changed.

## Lean Atlas continuation

Wide Map/Timeline composition, bounded 24-row Timeline paging with scoped page
restoration, access-first presentation and selected-preview lifecycle diagnostics
are implemented. Android foreground accessibility smoke confirmed core Atlas
controls. Physical interaction/layout acceptance and the complete fault matrix
remain open. See the [delivery record](../_bmad-output/specs/spec-atlas-lean-exploration/delivery.md).

## Lean Atlas UI implementation — acceptance open (2026-11-09)

Home/Settings, Details, distinct Map/Timeline views, year selection, media-led
preview, provider-scoped return context and a fixed Replay action are implemented.
[Delivery evidence](../_bmad-output/specs/spec-atlas-lean-exploration/delivery.md)
records passing host checks and remaining native and implementation acceptance.
The complete 36-case contract has not been accepted. No owner data or gates changed.

## Lean Atlas specification accepted for implementation (2026-10-30)

Owner agreed with the whole-page Atlas review including visible Home and requested
a detailed spec. [Decision0016](decisions/0016-lean-atlas-exploration.md) records the
direction; [SPEC](../_bmad-output/specs/spec-atlas-lean-exploration/SPEC.md) and four
authored companions define8 capabilities,36 acceptance cases, layout/copy/state
contracts, context preservation, diagnostic mapping and ordered implementation.
Home remains explicit landing return; About becomes Details, map/list content is
focused, Replay stays reachable and uncertainty remains honest. Exact responsive
defaults are labeled assumptions. This supersedes the earlier review's pending
direction status. Runtime implementation and Android/iOS viewport/flow acceptance
remain pending; no app code, gates, owner records or deployment changed.

## Development loader restored; unlock needed (2026-10-30)

Current owner load report coincided with no Metro8081 listener and no USB reverse.
Restored hidden local Expo dev server and Android reverse, verified IPv4 status,
and reopened the installed exp+travel-life development link. Metro delivered the
fresh Android bundle1779 modules. Timestamp-bounded current-process sampling found
no loader/module/native-module/fatal or JS type/reference/syntax markers.
Final device state was keyguard showing rather than resumed Travel Life; owner
unlock/foreground is required to confirm UI. No app code, local record, account
or sync checkpoint was reset. A task-manager registration warning remains
unattributed and is not established as the loading cause.

## Explicit landing return restored (2026-10-30)

Atlas now exposes Home to a dedicated `/welcome` landing route, separate from
automatic startup at `/`. Its View my Atlas action returns directly to the
existing Atlas context without photo setup or onboarding-state writes. Initial
onboarding and returning-user startup remain intact. Four affected suites pass
54 tests; mobile typing/lint, root136/eval smoke and scoped diff checks pass.
Independent source review found no actionable findings. Actual phone stack/Back
and visual confirmation remain unobserved. No commit/push or data reset occurred.
See [repair record](../_bmad-output/implementation-artifacts/spec-atlas-landing-return.md).

## Atlas UX party review (2026-10-30)

Owner requested a whole-page review after finding the information below Settings
cluttered. Source review identifies excessive ready-state statistics, competing
header controls, a full list in Map mode, buried Replay, verbose journey preview
and mixed Atlas/global styling. Proposed hierarchy and native acceptance checks:
[_review record](../_bmad-output/implementation-artifacts/atlas-ux-party-review-2026-10-30.md).
This is a discussion proposal, not an approved redesign or runtime change.
Current phone layout was not inspected. Next: settle the compact information and
Map/Timeline composition, then implement with physical viewport/flow evidence.

## Development app load recovery (2026-10-30)

Owner could not load the app after the sync handoff. Current host evidence showed
Metro stopped and USB reverse absent. Restarted the existing development server
on localhost8081 with IPv4-first resolution, restored USB reverse and opened the
installed development client. IPv4 /status is running; a fresh Android bundle
with1788 modules was delivered and the app activity resumed. Sampled current
process logs contain no native fatal or JS syntax/type/reference fatal marker.
No app code, storage, account or sync checkpoint was reset. Owner-visible UI
acceptance remains pending; server readiness alone does not establish it.

## Hosted sync CPU and finalization repair (2026-10-30)

The resumed correction removes repeated Replay parsing/serialization and exact-ID
scans, optimizes bundle startup, and materializes evidence scalars before source
provenance joins. Source activation and aggregate commit now use restricted
SECURITY INVOKER RPCs with60s function budgets; role/global timeouts stay unchanged.
Mobile final activation waits65s and merge120s, retaining the original saved
mutation/operation on uncertain acknowledgement. No owner checkpoint or data reset.

Hosted synthetic3000-evidence/19MB Replay source upload and exact activation retry
pass; the final merge completes in86.129s. Same-operation retry returns the same
aggregate/revision; two independent sessions pull all76 pages with identical
semantic history,3000 unique evidence rows and retained Replay order. Readback
now skips repeated whole-source comparisons only for identical immutable
snapshots, after live-source/removal checks; changed source/privacy guards remain.
Physical owner/two-device acceptance remains open. Frozen-
engine parity matches60 synthetic datasets and reversed enumeration. Mobile99
suites/916 tests, SQLite105, worker57, PostgreSQL16 fixtures, typing/lint and
root136/framework/eval smoke pass. One scoped reviewer confirmed the follow-ups;
original blind/edge review completion was unavailable due to tool/usage failures.
Evidence is in spec-m7-unified-history.md; the broader M6/M7 delivery stays open.

## Lean onboarding implemented; device acceptance pending (2026-10-30)

Welcome now leads to a concise photo choice and automatic local preparation in
Atlas. Returning entry, scoped durable intent, pause/resume, exact selected-photo
processing, contextual Settings/Back, optional update invitation and gated account
entry are implemented. Review fixes cover lifecycle/native-picker Activity
handling, source shutdown, unknown acknowledgements, selected-only updates and
privacy-safe diagnostic attribution. No commit, push, owner-data reset or
deployment was performed; concurrent dirty account/engine changes are preserved.

Final mobile verification passes 99 suites/913 tests, 105 actual SQLite cases,
TypeScript and lint. Root check passes 136 tests plus framework/eval smoke;
Expo Doctor passes 21/21 and Android Expo export compiles to Hermes bytecode.
Three review layers were triaged; correction audits confirmed the filed lifecycle
and integration gaps resolved. Evidence and the AC matrix are in the
[delivery record](../_bmad-output/implementation-artifacts/spec-lean-onboarding-and-navigation.md).

Native Android isolated-profile first use/permission/Back/viewport/accessibility,
physical iOS, process interruption, measured latency and actual OS scheduling
remain pending. Read-only Android inventory and host mocks do not close these.
Next: owner/device walkthrough using isolated data without clearing the current
record; keep delivery in-review until physical acceptance is established.

## Lean onboarding review corrections (2026-10-30)

The scoped delivery adapter records lifecycle/disposal fences, durable
pause/Continue recovery, truthful metadata acknowledgement, selected-only update
authority, exact diagnostics and lean recovery/UI corrections. The focused gate
passes six suites/141 tests and mobile lint; fresh integrated verification is
separate. Mounted entry, delayed provider publication and Updates consent
interactions are covered. Android isolated-profile/native flow/viewport and
physical iOS acceptance remain pending. This correction pass performed no owner
data reset, external transfer or deployment. See
`_bmad-output/implementation-artifacts/spec-lean-onboarding-and-navigation.md`.

## Final transfer activation timeout correction (2026-10-29)

Hosted57014 context isolated repeated growing Replay assembly; scale verification
also proved per-character Unicode regex overhead. Migration20261029143353 replaces
both without changing quota, authority or immutable transfer recovery. Applied only
this scoped migration; live definitions, helper privacy and Unicode bounds verified.
Root130 and full PostgreSQL14 fixtures pass.24MiB source/aggregate activation took
1.259s/1.099s locally;60MiB additional synthetic rollback probe3.502s/2.699s, below
the authenticated server8s budget. Three scoped static reviewers found no defects.
Actual owner Save reached64/65 before the correction. Resume the same checkpoint;
owner receipt and physical two-device convergence remain unconfirmed. No private
record was read, reset or deleted during the SQL correction.

## Lean onboarding and navigation specification (2026-10-29)

At the owner's request after the BMAD party discussion, the detailed contract is
[_bmad-output/specs/spec-lean-onboarding-and-navigation/SPEC.md](../_bmad-output/specs/spec-lean-onboarding-and-navigation/SPEC.md).
Eleven capabilities and four authored companions specify Welcome → access choice
→ automatic local preparation inside Atlas, contextual Back/Settings, honest
progress/recovery, optional account entry and explicit continued-update enrollment.
The spec defines 36 future acceptance scenarios, source/authority/lifecycle fences,
the diagnostic map and collection recipe, and five ordered implementation slices.
English copy, Settings placement, retry timing and first-run persistence are
explicit engineering defaults. Account enrollment/restore and hosted-sharing
restrictions remain separate; no gates, app code or deployments changed here.

Root `npm run check` passed 130 tests, framework integrity and eval infrastructure
smoke. Artifact links/capability coverage and both specification self-validation
passes are recorded in the spec evidence. Runtime implementation, Android/iOS
viewport/navigation/native scheduling and owner usability acceptance remain
pending; document/foundation passes do not establish an intuitive working UI.
Next work: implement I-1/I-2 persistence and single-run orchestration before
exposing the simplified I-3 UI, then finish I-4/I-5 and the device matrix.

## Owner Save reached final receipt reconciliation (2026-10-29)

After Metro transform-cache rebuild, actual device export passed the long Replay
validation and transfer acknowledged64/65 steps. Final activation returned local
HISTORY_ACK/HISTORY_NETWORK with unknown durable outcome. Same saved operation
must be resumed/reconciled; completion and account authority are not established.
No new transfer, checkpoint deletion or local record clearing was performed.

## Owner long-Replay save compatibility (2026-10-29)

Actual owner diagnostics proved initial Save fails at Replay array item size:
structural journey references exceed the old10k wire bound. Added lossless bounded
Replay fragments at transport boundaries, complete atomic SQL reassembly before
source/aggregate activation, and a distinct SHA256 mapping namespace for long
source-local IDs. Semantic composition/order/soundtrack remain the authority;
metadata stores bounded graph/Replay summaries rather than duplicate bodies.

Migration20261029140350 applied and matching worker deployed. Root130, mobile97
suites/858 tests, SQLite104, PostgreSQL13, mobile/backend typing, lint and bundle
freshness pass. Malformed/missing/mixed/order/Unicode fragments retain previous
authority. Owner Save retry and physical convergence remain unconfirmed. Large
post-sync correction requests still retain the existing explicit journal quota;
no truncation, Replay deletion or local record clearing was performed.

## Development load recovery (2026-10-29)

During owner OTP testing, Metro was not listening and USB reverse was absent.
Started the current dev server on8081, restored Android reverse and opened the
verified exp+travel-life link. Android bundle delivered1786 modules; process runs.
Phone system shade/lock state prevents confirming actual app UI until owner
unlocks/foregrounds it. Preserved all local data and account/media state.

## Device-test code/service closeout; SMTP input required (2026-10-29)

Live Dashboard proved the previous HTTP546 was Memory limit exceeded at
MEDIA_DECODE. Bounded WASM streaming and removal of redundant hash copies now
pass hosted trusted decode: synthetic JPEG, short H264/AAC video and AAC audio
activate and download byte-identically from a second session; another owner and
anonymous access are denied. This does not validate long/large/concurrent media
or physical OS playback. Native receipt handling now accepts SQL complete only
for the saved artifact and exact positive expected revision, preserving active
recovery; focused retry/redaction regressions pass.

Final root128 and full mobile95 suites/825 tests pass. Local development account,
history, corrections, controls, source removal and private media gates are enabled
for the requested device test; hosted matching services are deployed. Latest
synthetic deletion inventory reports4 completed/7 pending; pending upload leases
and scheduled retention remain honest, not claimed complete. No owner media used.

User confirmed no SMTP provider exists. Dashboard SMTP toggle is off and template
editing requires SMTP. The SMTP page is open and docs/development/account-email-setup.md
lists required provider fields and Token templates. Actual email OTP registration
and physical two-device acceptance require those provider credentials and testing.

## Live account/history smoke and remaining email/media setup (2026-10-29)

Worker version11 is active; a corrective migration restores service_role EXECUTE
on the replaced private entrypoint. Live synthetic testing now passes two real
Auth sessions, two source uploads, hosted merge and pull by both sessions;
anonymous RPC access is denied. No owner media was used. Three test accounts
reached durable deletion completed via the deployed cleanup functions.

Cleanup now uses private synchronous http functions with Vault and pg_cron,
bounded checked curl options and pre-secret logging guards, avoiding pg_net's
public queue. Both fixed jobs were installed and their initial requests were
acknowledged. SchedulerSuite8 and root126 pass; actual continuing scheduling is
not inferred from one manual invocation. Additional synthetic media test owners
remain pending cleanup after upload returned HTTP546; stage/cause unproven.

Local ignored development environment now enables account/history convergence,
corrections, controls and source removal for the owner's requested device test;
private media remains off pending HTTP546 investigation. Server history and
account cleanup are enabled. User confirmed no SMTP service exists; setup fields
are documented in docs/development/account-email-setup.md. Actual email delivery
requires provider credentials entered in Supabase. Dashboard log access currently
requires the owner's browser login; no password/OTP is requested in chat.

## M6/M7 device-test preparation (2026-10-29)

Eight previously reviewed drafts are consolidated in the CLI-generated local
M6/M7 migration; FullSuite passes 12 PostgreSQL fixture files against it, and
an executable guard checks the bundle matches the drafts. Cleanup endpoints now
accept bounded empty JSON for Supabase scheduling with capability checks and
redaction intact; 27 focused endpoint tests pass. A local scheduler draft and
synthetic negative/positive PostgreSQL suite cover distinct Vault capabilities,
client queue privileges, fixed endpoints and empty request envelopes. Root check
passes 125 tests and backend typecheck passes. No real scheduling is proven.

The existing Travel Life project lacks the media migration and later M6/M7
schema and functions; pg_cron and pg_net are not installed. A dry-run of the
normal db push refused because three unrelated older local migrations are absent
from remote history. A separate ignored staging workdir contains exactly the
eight matching remote versions and two required M6/M7 migrations; its `--dry-run
--skip-vault` lists only the media and consolidated M6/M7 migrations. The scoped
route was applied successfully; do not use include-all against the main tree.
Private-media, media-cleanup and account-cleanup functions deployed with JWT
verification. History-merge deployment failed with HTTP 413; inventory confirms
its previous version 10 remains active. Its generated bundle is 11,355,792 bytes;
the precise service limit and an accepted compact deployment route remain to verify.
Worker version 11 was deployed via local Docker bundling and a synthetic gated
request returned HISTORY_UNAVAILABLE. pg_cron/pg_net were installed and cleanup
capabilities provisioned, but scheduler preflight discovered PUBLIC access to the
pg_net request queue; a postgres REVOKE left its supabase_admin-owned ACL unchanged.
No scheduler jobs were created and temporary local capability files were removed.
Use provider-supported permission changes or a secure alternative before cleanup.
All feature gates remain disabled. SMTP/template, cleanup operation and real authenticated service
smokes remain unverified; gates remain off. This is not device-test readiness.

## M7 legacy owner edit migration (2026-10-29)

The local M7 implementation now admits a provable dirty initial or legacy
aggregate baseline through an immutable migration checkpoint, typed identity
mapping and the canonical owner correction journal. Original owner revisions
remain conflict guards; accepted local edits remain retained until a verified
canonical pull. Unknown authority, source changes and ambiguous Replay targets
remain protected. Independent review identified and corrected the accepted-pull
guard and concurrent privacy revision collision, with synthetic regressions.

Local checks after review: foundation 116 tests and eval smoke, 103 SQLite cases,
12 PostgreSQL rollback fixture files, 95 mobile suites/807 tests, mobile typing,
lint and shared backend TypeScript passed. Review evidence is in the legacy migration
delivery record. Gates remain disabled; SQL and worker changes are local drafts.
Hosted Auth/worker/receipt checks, real media and two-device Android acceptance
remain open; the owner cannot connect a second device currently. No claim of
production readiness or real-data migration is made.

## M6-M7 interrupted work recovered and reviewed (2026-10-29)

Recovered the failed account/history session and completed its locally implementable
integration review fixes: offline verification preserves unlocked identity; source
resume reconciles acknowledged generations atomically; selected account repositories
rebind after a new replica; temporary owner-pending privacy hides old content while
preserving account intent; explicit restore protects unsent edits. Control recovery
distinguishes definitive server rejection from unknown acknowledgement. Media recovery
checks receipts before cache bytes and supports explicitly reconciled abandonment,
late-stage tombstones and generated-file cleanup. Bounded replica staging/reclamation
closes only safe tracked account connections and preserves active/local histories.

Three independent review lenses produced 14 individually recorded findings; the
existing M7 delivery record contains triage, corrections, diagnostic maps and the
M6-M7 acceptance evidence matrix. The mounted provider remount regression was checked
again by its reviewer. Parent completed remaining patches after the implementation
agent exhausted its usage limit. No worktree reset, commit, push, remote deployment,
actual OTP or owner-media upload occurred.

Root check passes 90 tests plus eval smoke; the maintained `-FullSuite` PostgreSQL
command passes all 11 synthetic rollback fixture files. SQLite passes 102 cases,
including source-generation rollback, bounded replicas and owner-only deletion.
Expo Doctor passes 21/21 on the host after sandbox DNS failure. Final integrated
mobile verification passes 95 suites/790 tests, typecheck/lint and shared backend
TypeScript. The M7 delivery record retains exact commands and failed-attempt history.

All sync/media/control gates remain disabled. The owner cannot connect the second
Android now, so physical two-device/OS/viewport/Replay acceptance remains open, as do
real SMTP/Auth/receipt-gateway/cleanup-retention service checks and iOS. Dirty initial
or unknown legacy account replicas remain preserved as Needs review rather than
silently remapped. M6-M7 is still in progress; host passes do not close those limits.

## M6 account controls/deletion continuation (2026-10-28)

Gated account controls now include owner-scoped session inventory/revocation,
versioned consent withdrawal and fresh-auth account deletion. A protected random
receipt is persisted before deletion, survives signout, and reports pending until
media/metadata and Auth deletion are acknowledged. Local PostgreSQL9 rollback
fixtures and backend cleanup fault tests pass; mobile typecheck/lint and focused
deletion tests pass. The controls and cleanup gates remain off, SQL stays in local
drafts, and actual SMTP/refresh/receipt gateway/identity deletion plus Android/iOS
acceptance remain unobserved. No remote deployment or private upload occurred.

## Gated account continuity and source removal preview (2026-10-28)

Local drafts retain the accepted aggregate through append-only pending evidence while
fencing changed privacy/removal; mobile hides an observed unreadable prior authority.
Foreground merge/pull scheduling guards unsent account edits with semantic baselines
and never implicitly restores into a local-only record. Source coverage and gated
all-page removal preview now show actual facts, derivative availability and separate
metadata/media counts, with full-request preview CAS receipts. Automatic convergence
and removal remain disabled. Parent verified all eight local Postgres rollback
fixtures; four focused mobile suites pass20 tests, account SQLite6, typecheck/lint.
No hosted migrations, owner media uploads or physical acceptance occurred. General
correction conflict journal/resolution and headless merge/pull remain open.

## M6 continuation session and restore fences (2026-10-28)

Confirmed provider session-denial codes and the installed SDK session-missing
error now lock the local owner and persist the secure access block. History API
session denial uses the same fence and returns to the independent local record;
retryable network failure preserves already unlocked offline identity. Restore now
reports exact pull/stage/rebuild/read/authority/pointer boundaries and fences each
awaited step, including signout during staging. Synthetic regressions passed and
mobile typecheck/lint pass. No real OTP, revocation, remote mutation or physical
acceptance was observed. Full M6–M7 delivery remains in progress.

## Account derivative playback substrate (2026-10-28)

Continuation adds selected-copy preparation/upload and the gated gallery, exact
custom-audio consent, immutable SQLite upload receipts and same-source foreground/OS
lease coordination. Automatic history sync remains separately disabled. Actual local
Postgres17 verified the source-media selection draft with five rollback fixtures;
this is synthetic Auth/Storage evidence only. Pure coordinator tests pass four
scenarios and real SQLite six. General correction conflicts, source coverage/removal
preview, prior aggregate continuity under pending input and physical acceptance remain
open. No hosted migration or private media transfer occurred in this continuation.

The account replica now has a gated private-media adapter: canonical account evidence
and the exact custom soundtrack revision resolve through current owner authorization,
byte/hash/type verification and a bounded private session cache. Account Replay blocks
missing committed media and rechecks live media/history consent and active aggregate
before render completion/export. Context changes fence callbacks and cache access.
The explicit media flag remains false; this does not establish synchronized playback.
Four focused suites pass 75 tests; mobile typecheck/lint and root checks (86 tests)
pass. Selected native derivative upload, durable synchronization, concurrent correction
resolution, removal preview and physical two-device/cache acceptance remain open.

## Source removal retention substrate (2026-10-28)

M7 source controls now retain current readable history across pause/disconnect while
fencing old worker plans. Source removal has a tested server fence/purge path that
preserves independent owner trips/home areas and retains dependent corrections and
privacy scopes as inactive review proposals. Explicit versioned archival preserves
the original proposals and allows surviving-source rebuilding. Removal remains
unexposed until its affected-content preview exists. The Account Sources panel
supports pause/disconnect and inspection of retained/archived owner facts, with an
explicit archival confirmation. It does not claim media playback synchronization.

Migration `20261028081801_m7_source_owner_fact_retention.sql` passed hosted rollback
fixtures before application; parent applied it and reran retention rollback tests.
The worker was redeployed with JWT verification and its merge gate still disabled.
Root checks pass 70 tests; mobile typecheck/lint and 23 focused merge/control/UI
tests pass; four account SQLite tests pass. General offline correction convergence,
affected-content removal preview, private media and two-device acceptance remain open.

## Multi-source implementation in progress (2026-10-28)

M6 account and separately consented history transfer, the shared canonical merge,
and a gated M7 worker have local implementations and synthetic coverage. The
existing Supabase project has the account/history schema and worker RPC migrations;
the merge Edge Function is deployed with gateway JWT verification and remains disabled. The initial follow-up migration
blocked source removal; the source-retention section above records its superseding
preservation design and deployed migration. Initial root checks passed 67 tests (now
70 with retention regressions), mobile
typecheck and lint pass, and focused merge/contract tests pass. These are not
two-device or real-media acceptance. The mobile SQLite suite passes 96 synthetic
and local database tests; no physical device result is inferred from it.

The unexposed mobile merge entry point now persists an owner-scoped operation ID
before contacting the worker. It retains the ID for unknown acknowledgements and
failed status refreshes, fences sign-out, and clears a matching checkpoint after a
confirmed result or explicit stale response. Synthetic tests cover retries, redaction,
owner isolation and replica invalidation. The worker remains disabled pending
integration, retention and device acceptance.

Replica pointer and source-scope updates now commit atomically with an action fence;
stale cleanup is limited to the matching staged database. Synthetic SQLite covers
write failure, in-transaction sign-out, newer-pointer preservation and refusal to
select a legacy pointer lacking its scope. Restore's
remaining diagnostic boundaries and actual device lifecycle still need verification.
Account status parsing now rejects malformed source and aggregate identity/state
fields before selection; focused tests also retain support for more than 100
inactive source records. Root checks, mobile typecheck/lint, and focused tests pass.
Status publication now waits for the final owner/action fence after scope reads;
a held-promise unit test covers the fence, while full device sign-out remains open.
Transfer checks the current action before/after source registration and before
checkpointing. The stale-before-checkpoint regression passes; delayed registration
is fenced by a shared helper and tested with a held synthetic registration. Requests
now bind token owner and action generation after asynchronous
token lookup; synthetic RPC/worker tests cover mismatch and sign-out before fetch.
Already-sent requests and physical-device lifecycle still require verification.

Two server-side bundle deployments returned HTTP 413. After Docker Desktop was
started, local CLI bundling deployed the worker successfully (reported bundle
5.6 MB); a synthetic unauthenticated request received HTTP 401. The worker gate
remains disabled. The gateway's compatibility with real account tokens, authenticated
runtime loading, actual CPU/memory and end-to-end behavior remain open.
In a local Supabase Edge Runtime container, the actual shared merge handler loaded,
returned HISTORY_UNAVAILABLE while disabled, and completed a synthetic manual-journey
merge against mock Auth/RPC without exposing fixture text in diagnostics. The probe
container was stopped. This is local Deno evidence, not hosted or device acceptance.

The isolated Supabase Edge decoder probe passed a tiny generated JPEG and H.264
case and rejected a truncated MP4; its endpoint and secret were removed. Realistic
size, duration, concurrency and corruption limits remain unmeasured; media sync is
not enabled. Remaining work includes rollout of the worker integration,
source lifecycle and correction convergence, safe retention/cleanup, media transfer
and offline playback, real authentication delivery and owner-operated two-device
verification. M8/M9 follow M6–M7 and are not implemented.

A local Node decoder ladder additionally passed fixed two-second 720p/1080p H.264
and 720p H.264/AAC synthetic full decode, rejecting three truncated variants. These
are not hosted Edge, real-media, concurrency or long-duration measurements.
The attempted hosted 720p probe deployment was rejected by automatic approval
review due to its disabled gateway JWT verification. It was not deployed and its
new probe secret was removed. A separate JWT-gated probe then showed that its
combined 720p encode/decode test failed at synthetic encoding with an unknown
cause; a pre-encoded two-second 720p H.264/AAC synthetic fixture subsequently
fully decoded and rejected a truncated file (942 ms including setup, 32 MiB WASM
heap). That temporary function and its secret were removed. Neither result proves
real-media, concurrency, user-session or long-duration acceptance.
Another JWT-gated synthetic probe fully decoded a fixed two-second 1080p H.264
fixture and rejected truncation (1,208 ms including setup, 32 MiB WASM heap).
It had no audio; probe and secret were removed. Product media sync remains gated.

## Next scope approved: private multi-source history (2026-10-28)

The owner accepted one account with multiple devices/sources and requested the
next delivery backlog. Decision 0015 records the direction; the canonical
`_bmad-output/planning-artifacts/epics-multi-source.md` defines 20 planned stories
across M6 (account/restore), M7 (unified device history and Replay), M8 (selected
Drive files), and M9 (selected Google Photos memories). The existing `backlog.csv`
contains the derived rows. Local-only use remains account-free.

The first complete milestone is two-device evidence/correction convergence plus
authorized media playback with the source phone offline. Private account sync
does not re-enable hosted M4.5/M4.6 publication. Google Photos selection lacks a
whole-library historical scan and cannot be assumed to provide GPS; Drive folder
crawling is deferred. No app code, service deployment or private upload is part
of this planning task. All M6-M9 device/provider acceptance remains open. Begin
M6.1 when implementation is delegated; resolve exact APIs, retention/quotas and
service configuration inside the owning stories before enabling cloud transfers.

Planning verification: 20 unique new stories and 76 acceptance criteria; all
dependencies point backward, 47 combined CSV rows match the backlog, and 79 local
links resolve. Root `npm run check` passes 49 tests, pinned framework integrity
and eval smoke; whitespace validation passes. These are planning/foundation
checks only. Concurrent privacy-settings test/spec work is outside this task.

## MLP sharing scope correction approved (2026-10-27)

The owner approved the batch scope correction in
`_bmad-output/planning-artifacts/sprint-change-proposal-2026-10-27.md`.
The MLP sharing route is now the exact locally prepared Replay MP4 followed by
an explicit operating-system share-sheet handoff. Gmail, Messenger, Facebook,
and other targets remain device-installed-app dependent; recipient delivery and
saved copies cannot be confirmed or revoked by Travel Life. M4.5/M4.6 hosted
snapshot/media publication and browser viewing are deferred post-MLP. Keep the
remote media gate hard-disabled; no validator, hosting, bucket, link or private
media deployment is authorized by this scope. Fresh Android/iOS share-target
acceptance remains required before claiming physical delivery.

## Android bundle packaging correction pending device validation (2026-10-27)

The committed Replay soundtrack is an OGG asset, but Metro does not include
that extension in its default asset list. `apps/mobile/metro.config.js` now
registers OGG and a root regression verifies the configuration plus the
cross-package share-protocol source. The repository check passes. A clean Expo
Android export must still be obtained successfully, followed by the previously
blocked native Android build and owner-operated share-sheet acceptance; neither
is established by the configuration check.

The connected Android device subsequently installed the debug APK successfully.
Its first launch lacked the required Metro server and therefore could not load
the development bundle; after USB port reversal and Metro startup, the device
log reached `ReactNativeJS: Running "main"` without a resolver or native crash.
This establishes debug-bundle loading only. Unlocking and owner-operated screen
and share-sheet acceptance remain required.

## Hosted-link entry points removed from MLP navigation (2026-10-27)

The owner found a `Publish highlight link` action in the installed debug build
after M4.5/M4.6 hosted sharing had been deferred. The MLP navigation now removes
the Atlas and Replay hosted-link entry points and the Expo `/share` route, while
keeping the exact private Replay preview and local `Share video` system-sheet
handoff. Deferred M4.5/M4.6 implementation remains retained but unreachable;
fresh Android device confirmation after the next build remains required.

The MLP provider also no longer dynamically imports the deferred hosted-sharing
service for startup or history deletion. This is safe because no hosted M4.5/M4.6
service or publication was deployed. The current debug client can receive this
JavaScript-only correction through the active Metro session; a fresh native
build is not required for the navigation change. The owner confirmed the
Android test is complete: the MLP route has no hosted-link publishing action,
the local Replay share flow works, and Gmail receives the shared video. iOS
owner acceptance remains open because no iOS device is currently available.

## Selected snapshot sharing and browser viewer continuation (2026-10-27)

The owner reports preceding trip covers and selected Replay video sharing steps
complete. This records owner acceptance without invented build/platform logs.

M4.5/M4.6 local implementation now includes the empty-first Selected Highlight
screen, separate trip/media choices and exact local derivative preview,
protected publication recovery/session/capability, explicit publication and
management, durable removal before evidence purge, private checked backend SQL
and recipient/range endpoints, plus a responsive React browser viewer with
chronological list and configurable geographic map/fallback. Focused mobile
checks now include a final 15-suite / 210-test rerun spanning share selection,
owner recovery, local derivatives, removal fencing and Atlas/Replay lifecycle
boundaries, alongside root check, mobile typecheck/lint and viewer production
build. The final root `npm run check` passes 47 tests, pinned-framework
integrity and the eval plumbing smoke. Parent real Postgres tests
ran with synthetic data in a rollback transaction, and parent Chrome observed
desktop/mobile list fallback interactions. These are local/synthetic evidence;
the detailed record is `_bmad-output/implementation-artifacts/spec-m4-5-selected-share-snapshot-delivery.md`.

Full feature acceptance remains open. Media publication is hard-disabled until
trusted decoded-media verification is integrated: a reviewable app-owned Node
validator package exists, but automatic approval review rejected configurable
private media egress without a specifically authorized destination/payload. The
next required decision is the app-owned validator host and authorization for
selected sanitized derivative processing. Vercel connection, provider map key,
Supabase deployment/privacy logging/abuse/cleanup configuration, real HTTP
Storage/RLS and Android/iOS walkthrough also remain open. No share schema,
bucket/function/viewer was deployed and no private media was uploaded. Do not
call the feature complete or release-ready from the host checks. The mandated
three independent reviewers also could not start because the shared account
usage limit was reached before any file inspection; this is an open
review-availability blocker, not a clean review outcome.

## Share Replay review corrections complete; device acceptance open (2026-10-27)

The recognisable Share Replay trip-card UI is now shared by Share Replay, the
Edit Replay trip overview, and the Atlas Timeline. Each surface preserves its
existing action semantics. The owner then reported that the shared shell still
lacked its per-trip cover outside Share Replay. Edit Replay now resolves missing
overview covers through the existing bounded local preview page and applies its
local presentation override. Atlas first reads the established private detail
preview and falls back to the first local media page when it has no usable cover
(four concurrent journey reads, no omission cap). Both use the
Share-equivalent thumbnail/poster renderer, so video covers are not sent
directly to an image view. Missing or unavailable optional covers retain an
explicit fallback and the journey stays selectable; the card itself cannot load
source media. Focused Atlas/Replay screen host regressions (111 tests), mobile
typecheck/lint, root `npm run check`, and whitespace validation pass.
Android/iOS visual confirmation remains required.

A subsequent owner report showed Atlas still did not show representative photos.
The verified source cause was not the card renderer: the provider incremented
one lifecycle generation for each independent Timeline detail/gallery read.
Atlas intentionally loads cards concurrently, so sibling reads were falsely
rejected as stale before returning their authorized local URI. Detail and media
page reads now snapshot the current generation and remain independently valid
until an actual private lifecycle invalidation. Provider and Atlas regressions
cover concurrent detail and fallback-page covers (97 focused tests); mobile
typecheck/lint and root `npm run check` pass. No connected Android device/ADB
transport was available for the required fresh physical confirmation.

Share Replay now opens with an empty list of committed Replay trip cards, not a
media reselection grid. A selected trip set prepares an exact private subset
video (including a truthful card-only chapter) before the separate `Share
video` action. The subset inherits the committed media order and soundtrack,
and does not alter the original private Replay.

The review corrections close the card-only Preview gate, native Back late-render
race, working-draft soundtrack leak, stale diagnostic collapse and missing
handoff scope refresh. Before the OS boundary, the provider reloads live access
and validates the registered artifact's exact selected media/group membership;
scope loss is a closed `REPLAY_STALE` outcome and never opens the sheet. Screen
72/72, provider 56/56, renderer 12/12, mobile typecheck/lint, root `npm run
check`, and whitespace validation pass. Android/iOS owner-operated acceptance
for card recognition, exact video playback, permission revocation and the real
system chooser is still outstanding; host checks do not substitute for it.

The owner-reported later-trip title-only scenario was rerun against the current
working tree: provider and Share-screen regression tests pass 129/129, including
the bounded-screen-list case that must render media from both selected trips.
Mobile typecheck, lint, root `npm run check`, and whitespace validation pass.
Fresh owner-operated Android/iOS preview evidence remains required for the
installed build.

Share-trip cards now resolve a local cover for each committed trip that is
missing one from the bounded opening manifest. Cover resolution is presentation
only, uses the existing private paged-preview boundary in batches of at most 48,
and neither changes committed media nor the export composition. The screen
regression passes 73/73 and the provider regression passes 57/57; typecheck,
lint, root check and whitespace validation pass. A fresh owner device must
still confirm that every visible trip card receives its actual thumbnail.

Owner re-report then exposed that a later cover may begin as `available: false`,
not merely lack a URI. The card now pages local cover candidates for every
included committed trip even before that transient availability is resolved,
and consumes the returned URI from the dedicated presentation path. The video
subset remains committed-media-only. The exact unavailable-then-resolved cover
regression passes alongside the 73-screen/57-provider suites; device visual
acceptance remains open until the refreshed app is tested.

## Share Replay trip selection implemented; device acceptance open (2026-10-27)

Share Replay now begins with no selection and presents every eligible committed
Replay chapter as a recognizable trip card, including a truthful card-only trip
whose current usable-media set is empty. Selecting a card retains the committed
trip order and soundtrack; only currently eligible committed media is rendered,
and an uncommitted or excluded Journey List trip cannot enter the subset. The
owner prepares and watches the exact local subset before a separate `Share
video` action reaches the existing verified immutable handoff boundary.
Selection changes dispose the old temporary subset preview; Back from preview
retains trip selection while the original private Replay stays available.

Share subset preparation now derives selected media from a freshly resolved
committed provider manifest for every selected trip, rather than the bounded
editor-preview availability exposed to the Share screen. This prevents later
trip media from becoming title-only in the selected video. Host regression,
typecheck and lint evidence is complete; owner Android preview validation
remains open.

The delivery record maps each subset preparation and final handoff to closed,
correlated `REPLAY_EXPORT` diagnostics. Screen regressions cover empty/default
selection, trip-only scope, exact ordering, chapter-only trip retention,
preview-before-dispatch, return, stale scope classification and redaction; 66
focused screen tests and 53 provider tests cover the additional
cancellation/single-flight/handoff and
fresh-scope races. The earlier 12 renderer tests, mobile typecheck/lint, root
`npm run check` and whitespace passed. The
mobile aggregate script remains unusable in this Windows sandbox without its
local Jest cache and is recorded as an environment limitation, not product-test
evidence. Fresh owner-operated Android and iOS validation is still required for
recognizable cards, exact video preview and actual target-system handoff.

## Replay Gmail handoff and social-share target correction (2026-10-26)

Gemini opening the owner's Replay verifies that the produced video is not
universally empty; the Gmail-specific recipient/import boundary remains
unproven because current ADB diagnostics cannot start. The Android native
Sharesheet now receives a separate app-private MP4 handoff copy that has been
reopened and stream-verified. Persistent Replays also recover their committed
soundtrack before validation, preventing a valid AAC Replay from being treated
as a silent invalid file. Handoff-copy failure retains the private preview and
emits the fixed, content-free `REPLAY_EXPORT / SAVE_FAILED / REPLAY_HANDOFF`
event with the existing per-action correlation.

Gmail, Messenger and Facebook are deliberately not hardcoded as targets:
Android's system Sharesheet shows each only when the installed app declares
support for `video/mp4`. The share screen tells the owner this before handoff.
Host renderer/screen regressions, mobile TypeScript and lint pass; fresh Android
build/device evidence is still required to claim Gmail delivery fixed or any
specific Meta target available.

## Share Replay trip-selection correction reviewed (2026-10-26)

Owner clarified that Share Replay must list trips currently used in Replay,
without asking for photo/video selection again. Source review confirms the
current UI offers individual committed-media buttons instead. The review at
`_bmad-output/implementation-artifacts/review-share-replay-trip-selection-2026-10-26.md`
records trip-level selection inheriting committed media/order/music, the existing
empty-first sharing default, and exact selected-video preview before explicit
OS sharing. Runtime correction and owner device validation remain pending;
this review changes no application behavior.

## Replay empty native-share attachment guard (2026-10-26)

Owner evidence showed Gmail receiving an empty Replay attachment after the
Android share sheet closed. The final OS-dispatch boundary now rechecks local
file existence, positive byte size and the expected MP4 stream structure before
sharing. An invalid file never opens the share sheet; it retains the private
preview, supplies safe recovery copy, and emits the fixed `REPLAY_EXPORT /
SAVE_FAILED / REPLAY_OUTPUT` diagnostic. Renderer and screen regressions pass
(68 assertions), along with mobile typecheck and lint. This guards against a
repeat but does not prove Gmail receipt/device behavior; require one fresh
owner-selected synthetic-safe send after the updated native build is installed.

## M4.5 selected-share implementation in progress (2026-10-26)

The owner approved implementation after the selected-share spec review. The
delivery record at `_bmad-output/implementation-artifacts/spec-m4-5-selected-share-snapshot-delivery.md`
freezes safe resolutions for delete-all fencing, write-once immutable versions,
raw-capability recovery, mutable expiry envelopes and post-activation cancel
semantics. The first mobile contract slice is implemented: a request binds to
one immutable preview digest, changed retries require a new preview, a remote
delete fence wins before activation, and a completed publication requires a
separate explicit revoke. The mobile transport reuses the existing anonymous
Supabase session and rejects malformed or digest-mismatched acknowledgements.

The first backend scaffold adds a private RLS-protected M4.5 schema, owner
delete fence, idempotent begin/activation RPCs and a JWT-protected no-store Edge
Function. It deliberately does not expose direct Storage reads, public buckets,
or an M4.6 recipient viewer. The official SDK-57 image manipulator now re-encodes
an owner-selected image into a new bounded private JPEG, with closed source-free
derivative diagnostics and no original-uri fallback. The raw 256-bit capability
is persisted before a draft can publish through the SecureStore boundary and is
never recreated from public operation data. Selection now starts empty; Select
all is constrained to the currently displayed eligible Journey List candidates,
and a direct toggle cannot add an ineligible journey. Focused Jest evidence: 25
assertions across share selection/operation/transport/derivative/capability/draft/
controller/diagnostic suites, plus mobile TypeScript and lint. Root `npm run check` passes 25 tests,
including static guardrails for JWT/no-store/no-console and private
RLS/fence/service-role server constraints. Deno is not available on this host,
so Edge Function typecheck/local service execution, video derivative processing,
real Storage/RLS integration, deployment and owner device acceptance remain open;
see the error playbook for that tooling boundary.

## Replay owner acceptance and local consolidation (2026-10-26)

Owner confirmed that Android trip/media edits, exclusion, custom audio Done and Update/new-video now work. The primary checkout is the accepted implementation. Three detached Replay variants were semantically audited; desired cache-first, chapter-reuse and streamed playback work is already represented by later main code. Each historical HEAD and tracked WIP has a local recovery tag, the exact old Git pointer was retired without deleting source/dependencies, and only primary main remains registered. See `docs/development/replay-worktree-retirement-2026-10-26.md`.

Four review lenses found bounded corrections for post-timeout/fenced scheduler handling, reclaimed failure previews, prior-video lifetime during Re-render and settings Reset order. These are implemented with regressions. Added coverage proves shared edit-session remount retention and rejection/cleanup of invalid copied audio. The detailed release review distinguishes those fixes from deferred native fault recovery, retained Auto on exclude/re-include, overview shortcuts and broader S7/iOS/measured-performance evidence. Owner normal-flow acceptance must not be expanded into those untested claims. Selected-share next-ticket specs and concurrently edited diagnostic-policy guidance stay outside this Replay consolidation commit.

Final consolidation verification: 47 mobile Jest suites / 539 tests, 93 real SQLite tests, TypeScript/lint, root check and whitespace pass. Expo Doctor passed 21/21 with the same dependencies. Reviewed cleanup and scheduler failure-path corrections have host evidence; new physical acceptance is not inferred from the owner's earlier normal-flow confirmation.

## Mandatory specific diagnostic implementation gate (2026-10-26)

Owner reaffirmed that every implementation must support diagnosis from concrete logs, not broad speculation. Audit verified existing AGENTS mobile closed-event rule, app-diagnostics.ts, direct-console ESLint guard, redaction/classification tests and prior lessons. Added `docs/development/diagnostic-implementation-policy.md` as the mandatory cross-runtime delivery gate: operation/stage/reason-to-source map before coding, targeted failure classification, safe action correlation, exact current-runtime collection recipe and failure/redaction evidence. AGENTS/workflow cover direct work; supported team Build/Build Auto/developer-agent overrides load the same policy and implementation handoffs explicitly carry it into context-free agents. Upstream skills remain unchanged.

M4.5 now declares diagnostics.md and the shared policy as required companions, with AC-25–28 (28 total) for precise boundary logging, correlation, redaction and evidence-based triage. No runtime logger/feature code was changed by this governance task; M4.5 behavioral review findings remain open. Foundation policy-wiring tests guard instruction propagation, not universal runtime coverage. UNKNOWN causes and unresolved device evidence must remain explicit.

Verification: all three customization resolvers load the intended team policy and Build/Build Auto handoff; root `npm run check` passes framework integrity (upstream unchanged), 23 tests including three policy-wiring checks, and eval smoke. Spec companions/source links, six stable capability IDs and continuous AC-01–28 validate; scoped whitespace passes. No mobile/backend runtime execution was needed or claimed for these policy/spec changes.

## M4.5 specification review requires revision (2026-10-26)

Owner requested one review of the selected-share snapshot spec. Independent adversarial, edge-case and structure reviewers plus a dependent prose pass produced `_bmad-output/implementation-artifacts/review-m4-5-selected-share-snapshots-2026-10-26.md`. Review found missing activation/delete-all/privacy fencing, immutable derivative enforcement, token recovery after a lost first response, expiry-envelope semantics, replacement-cancel behavior and other bounded lifecycle/protocol gaps. Overlapping independent findings are retained in the report. Earlier self-validation and root checks did not establish behavioral completeness; the prior unqualified implementation-readiness statement is superseded. Spec contents remain unchanged by this review; next work is bmad-spec revision and race-specific acceptance coverage, then behavioral re-review. These are specification gaps, not observed sharing runtime failures.

## Replay persistence recurrence: confirmed scene mapping defect (2026-10-26)

The owner escalation reopened the edit/save/update acceptance. Previous receipt-reset explanations did not establish the device cause and were corrected in the playbook. Actual SQLite reproduced valid draft staging failing before SQL because owner-entered scene groups were visible in Replay but absent from its writer map. These scenes now retain their stable namespaced identity for included/excluded group persistence; reconstructed scenes without date-support rows reuse the canonical Journey List mapping. No visible scene or eligible media was removed to make the save pass.

Verification: all 45 mobile Jest suites / 515 tests, 91 actual SQLite tests, mobile TypeScript/lint, Expo Doctor 21/21 and root foundation check passed. The new native repository regression covers custom audio, manual scene exclusion/inclusion, consecutive other-trip media editing, order, repository restart and exact commit/readback. Freshness guards now produce fixed diagnostic categories without raw data. A stable Android runtime opens the existing Atlas and plays the current Replay. ADB touch injection is denied, so owner-operated Done and Update/new-video evidence remains pending; initial playback is not claimed as that acceptance. Independent build reviews are running.

### Reviewed escalation follow-up

Build review fixes now preserve caller CAS, remove generic automatic draft reset/retry, and avoid full-manifest hydration when the native map is current. Receipts retain a bounded 32-operation history with actual SQLite idempotency/conflict tests. Check again retains the exact mutation and performs a bounded durable read after native writer settlement, with no repeated mutation and no stale late-callback publication. Music Done captures immutable settings and protects session-owned audio; delayed selection tasks are fenced by restore/scope epochs. Save errors distinguish local failure, conflict and unknown outcome. Thumbnail cache ownership, privacy invalidation, six-lane bounds and same-turn delivery are executed by direct service tests.

Final host evidence after review repairs: 46/46 Jest suites and 526/526 tests, 93/93 real SQLite tests, TypeScript/lint, root check and whitespace checks pass; Expo Doctor passed 21/21 earlier in the unchanged dependency set. The full suite caught eager native video initialization through the provider; lazy loading the poster decoder corrected the router/reduced-motion failures before the final aggregate pass. Two review layers returned actionable findings and were resolved; the third could not complete because of model capacity/account limits, so no clean three-layer pass is claimed. The stable app has been reloaded without data clearing and opened through Atlas to Replay. Owner-operated custom audio Done, consecutive edits and Update/new-video acceptance remain open because the device denies injected touches.

## M4.5 selected-share snapshot specification (2026-10-26)

The next feature specification is prepared at `_bmad-output/specs/spec-m4-5-selected-share-snapshots/SPEC.md`, with owner experience, publication/access/persistence contract, 24 acceptance cases and ordered S0–S7 implementation slices. Its six capabilities cover exact empty-by-default selection/preview, explicit immutable publication, private sanitized media, token-checked recipient access, owner republish/expiry/revoke, durable offline/delete-all removal and uncertain-outcome reconciliation. The single execution adapter is `_bmad-output/implementation-artifacts/spec-m4-5-publish-and-manage-selected-share-snapshots.md`.

Existing decision 0005 supplies anonymous owner protection, at least 128-bit capability tokens and adjustable 30-day default expiry. Proposed quotas, derivative formats, replacement URL and retention defaults are identified as engineering assumptions requiring implementation evidence. M4.6 still owns the responsive browser viewer; public copy/share is withheld until a compatible reachable viewer is configured and tested. Coherence/source-preservation and structural/link validation, root `npm run check` (framework integrity, 20 tests, eval smoke), and scoped whitespace checks pass. No product decision blocks S0/S1; no backend deployment, private upload or application implementation occurred. Replay's outstanding device/save acceptance remains open separately.

## Replay working-save runtime rehydration (2026-10-26)

The Android device emitted immediate stale working-draft failures after a JS
runtime reload because visible Edit state survived while the native repository's
opaque Replay-key map did not. The screen can also retain an earlier working
revision while its durable local draft is current. Replay stage/commit now
rehydrate and validate the current native manifest, then use that current
working revision for the one owner-authorized CAS write. This is not an
automatic mutation retry. Provider and screen regressions cover runtime
rehydration, revision reconciliation, and exclude-trip-A then edit-trip-B scope
retention; mobile TypeScript and lint pass. The development client was restarted
against Metro 8081 without clearing data. A delayed database-busy writer remains
an owner-device investigation item.

## Replay Music Done retry completion (2026-10-26)

Music & order Done now actively retries a rejected background soundtrack draft
write once and closes only after that current choice is acknowledged. This keeps
the visible local audio selection and the durable Replay setting consistent;
if retry fails, the sheet stays open with recovery copy.

## Replay large-album preview responsiveness (2026-10-26)

Replay Edit keeps its bounded 48-item gallery pages, but resolves independent
native preview handles in six ordered local lanes instead of serially. This
improves opening/loading a large trip without decoding all media or changing
selection scope. Host regression verifies order and the concurrency cap; actual
Android/iOS timing remains owner-device acceptance work.

## Replay final-edit snapshot verification (2026-10-26)

Update Replay now takes one complete post-queue owner-edit snapshot and verifies
the resulting durable manifest before rendering. This prevents an earlier media
list from being mixed with later trip exclusions, order, or soundtrack changes,
and fails safely rather than rendering if the readback differs. Provider
regression covers manual video/media selection and excluded-trip restoration.
Host checks are pending; owner device playback is still the acceptance evidence.

## Replay custom-audio immediate local readiness (2026-10-26)

After choosing a valid bounded local audio file, Edit Replay now shows Loaded
as soon as the private file copy has completed rather than waiting behind a
serialized SQLite working-draft write. The draft write remains background work;
its fixed retry copy is explicit if it fails, and Done/Update Replay still
flush it before committing/rendering. Focused screen regression, TypeScript,
and lint pass. The Android development client requested the refreshed bundle
from the restored localhost 8081 route; owner-visible timing confirmation is
still required.

## Replay chapter streaming and reuse (2026-10-25)

Replay automatic rendering now treats each visible trip as a verified private
chapter. It resolves only the trip currently being rendered, plays the first
verified chapter immediately, then buffers the remaining chapters and remuxes
the complete private Replay. Chapter identity excludes the global reconstruction
generation so an unchanged trip can be reused after another trip changes; it
retains the exact selected chapter inputs, order, card tokens and fixed video
format. The final durable file still undergoes current scope/file verification
before Atlas reopens it, and exact selected sharing retains its all-media access
gate.

Host evidence: controller/renderer/screen Replay checks pass, including a held
final-render promise that proves first-trip playback is visible first; TypeScript,
lint and root `npm run check` pass. This does not measure physical Android/iOS
latency or prove playback continuity on device. Owner validation after bundle
reload must cover Update Replay with one changed trip and Atlas -> Replay reuse.

## Replay finalization truthfulness and fullscreen listening (2026-10-25)

Replay now distinguishes a verified first-trip preview from the final private
Replay: the preview says `First trip ready · finishing X of N`, keeps measured
progress and withholds Edit, Share and Re-render until the verified final
artifact replaces it. Partial chapters retain no soundtrack; final assembly
continues to require the verified AAC stream. The player mute state is lifted
above presentation and an app-owned fullscreen modal swaps the view while
retaining that listening state.

The finalization-failure path now keeps an earlier verified Replay private-safe
and playable, while withholding Share/Edit for the failed replacement. Its
partial output is neither saved nor offered for sharing. The app ignores stale
callbacks by preparation generation and clears that retained preview if the
Journey List scope itself becomes stale.

Host evidence: focused Replay screen, provider and renderer suites pass (97
tests), as do mobile TypeScript, lint, root `npm run check`, and whitespace
validation. Android/iOS owner evidence for real audio, fullscreen continuity,
cache/reopen behavior and aggregate media is still open; host checks do not
close that acceptance gate.

## Replay trip editor false conflicts and mock alignment (2026-10-25)

Owner's reported “changed somewhere else” wording exposed two confirmed defects:
cache-only artifact persistence advanced the composition revision, invalidating a
working branch, and the provider mislabeled every storage rejection as a conflict.
Artifact writes now preserve composition revisions and compare revision plus source
JSON before updating, so a concurrent commit cannot be overwritten. Expected stale
guards use a closed typed error; other save failures remain retryable failures.
Historical ambiguous draft mismatches still require an explicit owner choice.

The editor now follows the approved trip-first HTML hierarchy: fixed overview
Back/title and Update footer, visual cover/date/selection/Edited trip rows,
collapsed Music & order, then gallery Back/title/Done above All/Selected/More and
the grid, with a fixed selection/length footer. Duplicate footer Done/Back and
per-tile date text are removed. Done/Back remain reachable during saving and
acknowledge both pending media resolution and the complete latest save queue.
Recovery drains prior work, blocks competing edits, reloads current scope and
confirms intentional working-draft loss. It never renders a replacement by itself.
Old previews are withheld if restored snapshot/privacy scope differs. Select all,
trip-local Undo, inclusion/Auto and music-preserving Reset received regression fixes.

On 2026-10-25 the owner reported Done/next still appeared untappable or slow.
The gallery now gives an immediate fixed `Saving…` acknowledgement at both the
header and trip summary while it waits for local-media resolution or a durable
write; it does not present a disabled Done control. After the owner reported it
still remained in the gallery, Done/Back now return to the overview immediately;
that overview owns the write's saving/retry/conflict state. The overview explains
that Update Replay is unavailable until a trip change exists. The exact physical
latency is still unmeasured: Metro and USB reverse only establish that the device
can receive the current bundle, not that the owner interaction succeeded.

The owner later reported that excluded Da Nang and Lâm Đồng still appeared after
Update Replay and that local audio could not be selected. Replay preparation and
prepared-artifact identity now make the committed included-trip list authoritative,
so an out-of-date group projection cannot reintroduce excluded trips. The audio
picker now preserves a validated local track's playable suffix, catches picker and
copy/probe failures into fixed recovery text, and visibly confirms `Custom audio
ready` before staging it. Owner device confirmation remains required.

Most recently, an owner-device working-draft save reached the fixed Retry state.
The exact native failure is still not exposed in the UI and a read-only device-log
query found no matching entry. Replay draft writes now discard only a recognized
released SQLite handle after it fails; the owner's explicit Retry then opens a
fresh connection, never repeats a mutation automatically. Focused Replay/provider
tests (76), mobile TypeScript/lint, root `npm run check`, and whitespace validation
pass. A device reload and one retry/save confirmation remain required.

The owner then reported prolonged Saving after small Replay edits. A read-only
Android log query had no Travel Life replay/database record, so it could not
identify a native failure. Source tracing confirmed each tap immediately staged a
full durable draft write; rapid edits could queue behind one another. The editor
now coalesces a brief burst into one latest-intent write and flushes immediately
for Done, Update, Back, reset, and Retry. The focused Replay/provider suites now
pass 77 tests; owner device timing and failed-trip-save confirmation remain open.

After that repair, the owner still could not save or Update a Replay. Process-scoped
Android logs then identified the fixed `DATABASE_BUSY` category after each draft
write waited exactly the local SQLite busy timeout. Replay working/committed writes
now wait for the same foreground-import and maintenance writer barriers used by
Atlas and privacy mutations, and retain explicit retry rather than repeating an
owner mutation. The exact lock holder remains unproven; development-runtime reloads
may retain an earlier native connection until the app is fully closed. Focused
Replay/provider tests (78), TypeScript, lint, and the root check now pass. Owner confirmation still requires fully closing
and reopening the development app without clearing storage, then saving one trip
and returning to the overview; this remains open device work, not a completed fix.

Music & order now has an explicit `Back · Music & order · Done` header. Done
flushes its working-draft change before closing and keeps the panel open with
fixed recovery copy if that save fails; it does not generate the Replay itself.
The targeted screen regression passes. Owner-device confirmation remains required.

The initial Android follow-up was invalid because the development client used
stale Metro port 8081 rather than the inspected 8085 server. Its cache-cleared
8081 server, USB-only reverse mapping, IPv4 localhost bridge, and development
client were refreshed without clearing app data. Metro recorded a fresh
1,384-module Android bundle from this checkout. The owner still needs to see
the new loading and loaded-audio states; this delivery-path evidence is not UI
acceptance.

The custom-audio picker failure is now traced: its copied audio-only file was
being rejected by a nonessential FFmpeg-duration preflight before the app could
show `Loaded audio` or stage the choice. Selection now accepts a nonempty,
bounded private copy; the renderer remains the authoritative decode/encode
validation point. New closed diagnostics distinguish picker and render outcomes
without local file data. A focused screen regression makes that metadata probe
fail while requiring the audio to display and stage; the 40-test Replay screen
suite plus mobile TypeScript/lint pass. The connected app was force-stopped and
relaunched with its USB-only 8081 mapping restored, without clearing storage.
Owner confirmation of selection -> Done -> Update Replay remains required.

Host evidence: all 44 mobile Jest suites / 474 tests passed with coverage; after
the final acknowledgement refinement, the Replay screen suite passes 35 tests.
Provider 39 tests, SQLite 90 tests, mobile TypeScript/lint, root `npm run check` and scoped
whitespace checks pass. Broad coverage was 79.51% lines / 73.85% statements;
this is measured host coverage, not an 80% coverage or device-acceptance claim.
Independent source review found ten initial and five follow-up defects; the final
scoped pass reports no actionable findings in those corrections. No commits,
publication, APK installation or private-data reset was performed in this task.
Owner-operated Android/iOS layout and two-trip save/reopen acceptance remain open;
an actually hung native write has not been reproduced or declared fixed.

## Replay trip save acknowledgement feedback (2026-10-24)

Trip Done and Back now visibly acknowledge their prerequisite local working-draft
save. While it is running, the gallery shows Saving trip changes and disables
duplicate navigation. If the write cannot be acknowledged, it remains on the
same trip with fixed retry/conflict guidance rather than appearing unresponsive
or pretending the edit was saved. Focused Replay screen checks pass 24 tests,
as do mobile TypeScript and lint. An owner-device attempt is still needed to
verify the real SQLite write returns to overview after the current bundle reload.

The owner device surfaced an existing working-draft conflict during Done/Back.
The gallery now resolves it in place: Use mine clears only the conflicting
working branch, saves the visible owner selection, and returns to overview;
Use latest reloads the current composition. This avoids the prior dead end in
which navigation first retried the conflict it told the owner to resolve.

The owner then reported the same no-return symptom. Done/Back were issuing a
second working-draft stage after the edit's own stage had already completed,
which could create an avoidable conflict and placed its recovery at the far end
of the scroll. They now await the existing queue only, return to the overview
on acknowledgement, and show retry/conflict controls beside the initiating
buttons. Focused Replay checks pass 25; refreshed owner-device confirmation is
still required.

The owner then re-supplied the approved Bali gallery mock and correctly rejected
the partial implementation. The gallery navigation is now fixed above the
scrolling visual grid as `Back · trip · Done`; its first scroll content is only
All, Selected and More. Conflict state is phrased as a local draft mismatch and
offers Keep (save visible choices) or Discard (restore saved Replay), rather
than implying another person changed it. Host checks pass; exact device layout
still requires owner review after Metro reload.

## Replay custom audio persistence correction (2026-10-25)

Audio selection now reports an oversized file immediately, before copying it.
For an accepted file, the editor says Loading audio, then Saving audio, and only
says Loaded after the working draft has acknowledged that exact local soundtrack.
If staging fails it retains the prior soundtrack and reports a local retryable
failure, so Update Replay cannot silently use an unacknowledged choice. The
provider now also receives the screen's first-trip-ready callback, which it had
previously ignored due to an incomplete contract. Replay screen/provider tests
(84), TypeScript and lint pass. Owner device confirmation after refresh remains
required for the actual file picker, save time and final rendered soundtrack.

Follow-up: custom Replay audio is now explicitly limited to MP3, M4A, AAC, WAV,
or OGG, each up to 5 MB; unsupported input receives an inline explanation before
copying or writing a draft. Update Replay now passes the acknowledged custom
soundtrack rather than a potentially stale render-frame value. Focused screen,
provider, and renderer checks pass 93, including a custom-track-to-AAC-mux
regression. The mobile aggregate script is presently inapplicable in this
sandbox because Jest cannot write its default Temp transform cache; it fails
before test collection. Device audio playback remains owner validation work.

Owner investigation reopened the Replay completion model: after Update, the
app can present a silent first-trip chapter as the private Replay while it is
still rendering later chapters and the final audio mux in the background. This
explains a temporarily incomplete selection and missing audio that later become
correct without another action. The native fullscreen view also omits the
React-owned speaker overlay. These are confirmed source causes, not an accepted
experience; no implementation change was made in this investigation. The next
correction must make partial playback/progress explicit or defer final-ready UI
until the full verified artifact, and provide mute within fullscreen.

The resulting implementation record is
[`SPEC-replay-finalization-and-fullscreen-audio`](../../_bmad-output/specs/spec-replay-finalization-and-fullscreen-audio/SPEC.md): progressive first-trip status, immutable aggregate render request, final-audio verification, fullscreen speaker ownership, F01–F10 automated acceptance and Android/iOS owner walkthrough. It is planning only; no runtime, build or device state changed by creating the record.

## Replay trip gallery parity and active-trip preview loading (2026-10-24)

The owner correctly found the current gallery unlike the approved mock: it had
per-tile Inspect text, too many controls ahead of the media, and could show a
later trip as unresolved placeholders because the initial preview page was
spent on other Replay trips. Opening a trip now primes a bounded local preview
page for that trip. The gallery keeps all candidate tiles visible, has All and
Selected counts, a compact inspect icon, More for secondary trip actions, and
Load more with resolved/total progress below the media. Done trip returns to
the overview; only Update Replay can replace/render the saved Replay. Focused
Replay checks pass 24 tests plus mobile TypeScript and lint. This has not yet
been confirmed on the owner device after bundle reload; the physical vertical
screen stripes in the supplied photo are display-panel damage, separate from
the app layout issue.

## Android metadata import lifecycle recovery (2026-10-24)

Android photo/video/media-location permissions were already granted, but an
invalid cached Expo SQLite handle made the private lifecycle read fail and
caused the Import surface to report no recognized metadata. The native import
repository now opens the per-runtime connection with `useNewConnection: true`;
the existing process-wide transaction serializer preserves writer ordering. On
the same device after a development-client reload, the Import screen showed the
existing completed metadata record: 2,995 scanned, 1,957 geotagged and 0
unavailable. No data reset, permission change or new import was performed.
Focused import/photo-access tests (46), TypeScript, and lint pass. Background
maintenance's separately tracked native-handle recovery remains unresolved.

## Trip-first Replay Edit implementation (2026-10-24)

The approved Replay Edit flow is now implemented as trip overview -> one-trip
gallery -> Done/Back -> overview, with one aggregate Update Replay action. The
gallery retains every eligible candidate before its local preview resolves;
unknown taps show Checking and only join the selection after usable access.
Load more and Retry keep previously visible cells. Per-trip Auto/Restore Auto,
Undo, inclusion and working saves are retained without rendering until Update.

Host evidence: Replay screen regression suite 23/23, SQLite 86/86, mobile
TypeScript/lint, root `npm run check`, and `git diff --check` pass. Review
subagents could not run because the account usage limit was reached; this is not
a clean independent review. Android/iOS owner walkthrough remains required for
album parity, touch targets, viewport clipping and actual device behavior.

## Background maintenance native-handle error containment (2026-10-24)

The current Android Metro log contains a real background-task SQLite native
handle rejection, not a Replay screen render error. The task now redacts and
returns a failed OS-task result instead of leaking raw native details through
TaskManager. The underlying device-specific `prepareAsync` native rejection is
still unresolved and maintenance remains retryable/failed until owner-device
evidence isolates its handle lifecycle; no private database was reset or read.

## Trip-first Replay Edit specification approved (2026-10-24)

Owner approved the trip-first mock and requested its detailed spec. Canonical
M4.7 CAP-5 now separates overview -> trip gallery -> Done/Back -> overview from
overview-level Update Replay. The new trip-first-editor-contract.md specifies
shared effective album reading, unknown-media paging/retry, honest count domains,
authoritative rendered selection/intervals, safe legacy recovery and aggregate
commit/render. Existing editor/interaction companions and decision 0014/design
system reflect that boundary; E23-E40 extend E01-E22 in the sole delivery record.
This is specification work; production implementation, Bali/Taiwan parity and
unassisted Android/iOS viewport/flow acceptance remain open.

## Replay Edit owner review reopened (2026-10-24)

Owner reports Bali zero-selection/missing choices, incomplete Taiwan media,
clipped controls and confusing task scope. Source inspection confirms unknown
media filtered out before preview paging, no visible page retry and an overflowing
action row. Exact private Bali record cause is not established. The trip-first
Party proposal and interactive mock under `_bmad-output/party-mode/` separate
trip-level Done from aggregate Update Replay. These are proposed for review;
production correction and owner acceptance remain open. Earlier passing host
checks do not establish album completeness or usable device layout.

## Replay Edit scroll-owner correction (2026-10-24)

An owner opening Edit exposed a React Native runtime error: the virtualized
media grid sat inside the design-system vertical ScrollView. Edit now uses one
vertical FlatList as its screen scroll owner, with the trip/actions header and
music/navigation footer attached to that list. The horizontal trip strip is
unchanged. Mobile typecheck/lint and the focused Replay screen suite (21 tests)
pass; root `npm run check` also passes. The active development build needs an
owner reload/open of Replay > Edit to establish device behavior.

## Replay prepared-video reuse correction (2026-10-24)

Replay no longer rejects a saved private MP4 because bounded Edit preview
resolution reports a different transient availability state. New prepared
artifacts carry a composition-v2 identity based on committed scope, direction,
soundtrack and replay snapshot; legacy artifacts are locally compatibility-
checked without rendering. The provider's 37 focused tests, TypeScript and lint
pass. This is host evidence only: the owner still needs to reopen the existing
Replay on Android/iOS and confirm that it plays the prior prepared file instead
of showing render progress.

## Replay Edit completion slice (2026-10-24)

Replay Edit now persists a scoped Auto state per trip alongside included-trip
scope and recoverable working drafts. A direct media edit, Clear, or Select all
freezes only that trip; Restore Auto and Undo remain local/recoverable. Select
all resolves every not-yet-loaded candidate in bounded pages before committing
one selection, with visible progress, so unloaded items are never silently
treated as selected. Excluded trips retain their media choices and are also
excluded from the owner sharing candidate list.

Video inspection stays muted and paused at the renderer's actual start point,
and its “Used in Replay” interval mirrors the renderer card/frame allocation
(bounded by local source duration). The renderer accepts a validated interval
for video sources rather than assuming a separate source edit. Working-draft
conflicts now enter the fixed Review changes UI with Reload, Use mine, Use
latest, and Choose again; no native error message crosses the UI.

Host verification: focused Replay tests pass (70), the remaining five mobile
suites pass, SQLite integration passes (86), TypeScript and lint pass, root
`npm run check` passes, and `git diff --check` passes. The aggregate mobile
package script itself remains sandbox-inapplicable because its Jest invocation
uses the protected Temp cache; repository-local-cache test runs are the valid
host evidence.

Android owner acceptance is not complete. A real device (2211133G) is
connected, but the current native debug build cannot finish: after resolving a
confirmed stale Ninja lock, `:app:buildCMakeDebug[x86_64]` crashes in Ninja
with native exceptions before a fresh APK is produced. No app was installed,
no private device data was read or cleared, and no owner walkthrough is
claimed. iOS owner acceptance is also unverified because this Windows host has
no iOS device/runtime. The next work is to recover the native CMake/Ninja build
without deleting unknown state, then have the owner operate the refreshed
Android and an iOS device through Replay > Edit.

An arm64-only assembly was also attempted for the connected physical phone; it
ended without a newer APK or installed app, so it does not weaken that native
build blocker.

For repeatable owner-run device preparation, `apps/mobile/scripts/build-android-device.ps1`
now runs an arm64-only, single-worker Android build, defaults to the temporary
legacy architecture override that avoids the known CMake route, refuses to race
an active known Ninja process, verifies a refreshed APK, and installs only when
the caller explicitly passes `-Install`. It never clears app data.

The script's first owner-run build was successful but Gradle reported the
existing APK as up-to-date. Its timestamp-only check incorrectly rejected that
valid artifact; the script now accepts a nonempty up-to-date APK after Gradle
success and can continue to the explicit install step.

## Replay Edit durable-working continuation (2026-10-24)

Replay Edit now separates a recoverable working branch from the committed Replay
inside the native draft store. Schema v36 adds layout-gated working fields;
working writes and commits run under transactions, commit can compare the
acknowledged working revision, and a successful commit clears only that branch.
An intentional empty working selection survives reopen. Back/native navigation
wait for an acknowledged local save rather than silently claiming retention;
Reset stages automatic defaults and leaves the saved preview untouched until
Done. Cached preview entry also hydrates current editor context, and replacement
keeps the prior verified output until a new output succeeds. Real SQLite (86),
focused Replay screen/provider (54), mobile typecheck/lint, root `npm run check`, and
whitespace checks pass. Editor entry now resolves a bounded first 48 local
preview handles rather than decoding every candidate original, and local video
tiles generate a paused/muted native poster when supported. The larger D4 scope
remains open: Replay-specific album paging/virtualization, trip inclusion and
per-trip Auto modes, used-interval support, conflict-resolution UI, and
unassisted Android/iOS owner acceptance are not claimed by these checks. The
editor also has an immediate Selected view that retains the active trip when
the owner returns to All media; it is not a substitute for required paged
selection beyond the initial screen. A committed Done now prepares through the
owner-draft path rather than the selected-share artifact path, so its verified
replacement remains eligible for private durable replay reuse. Focused Replay
screen coverage is now 19 tests after that lifecycle regression. The editor's
three-column grid is now a bounded `FlatList` (12 initial/batch, window 5) and
the surrounding Screen disables its competing scroll in Edit. It still needs
native cursor-backed album pages rather than treating the retained manifest
metadata list as the final paging source.

Trip inclusion is now a distinct durable draft field: excluding a trip leaves
its selected media choices intact but mutes/locks their checks, while reinclude
restores them. Done refuses an empty Replay scope. The committed and working
JSON retain opaque local journey IDs only; a real SQLite regression proves
working and committed exclusion/reopen behavior. Focused Replay screen coverage
is 20 tests; SQLite 86, typecheck, lint and whitespace checks pass. Used clip
intervals, conflict-resolution UI, cursor-backed album pages and physical owner
acceptance remain open.

The editor now asks the native repository for at most 48 opaque media keys at a
time when the virtual grid reaches its current page boundary. The repository
revalidates lifecycle, published run and privacy revision, resolves source refs
only below the provider boundary, and returns safe local previews keyed by the
opaque Replay token. Page fetch failure leaves existing cells usable. This is a
bounded preview-page path, not yet the final cursor-backed metadata album API.
SQLite 86 and focused Replay screen/provider 56 pass with typecheck, lint and
whitespace checks.

## Replay Edit visual first slice (2026-10-24)

The mobile Replay editor now keeps its saved preview context while presenting a
compact trip strip, direct photo/video inclusion grid, local inspection action,
visible selected count and provisional chapter-duration feedback. Local previews
are transient only: they are not persisted, logged or included in renderer
manifests. Existing Done, privacy gates, soundtrack and direction persistence
remain in place. Focused Replay screen/selection/controller/renderer/provider
tests (72), real SQLite (86), mobile typecheck/lint, root `npm run check` and
diff whitespace pass. This is a partial D4 visual slice only: bounded paging,
video poster extraction, durable working revisions/CAS/remap, trip inclusion,
selected-only browsing and Android/iOS owner usability evidence remain open.
The post-slice review also corrected two P0 paths: Done now passes its exact
committed media selection into preparation, and a stale scope withholds the
editor's prior media/preview instead of leaving a potentially invalid Edit entry.

## Replay Edit review solutions accepted and specified (2026-10-24)

Owner-approved review solutions are incorporated in M4.7 editor companions:
Back preserves all acknowledged working changes including music; selection waits
only for a current chosen manifest; inspector shows the used video interval;
Selected view, optional Trips jump and trip-scoped Restore Auto simplify access.
Excluded trips show inactive checks; duration extension is visible. Review changes
provides explicit remap/conflict recovery while retaining local intent. E17-E22
extend the acceptance matrix and require an unassisted owner task. Soundtrack
lifecycle is synchronized and repeated editor detail in interaction is condensed.
Review gaps are addressed in documentation; implementation and actual Android/iOS
layout, interaction, performance and self-serve acceptance remain open. Earlier
review verdict below is historical, not the current contract status.

## Replay Edit specification re-review (2026-10-24)

Three independent BMAD lenses confirm the main owner direction is represented,
but dispatch readiness remains open. The review records soundtrack Back-policy
conflict, missing pre-manifest selection readiness, underspecified remap/conflict
recovery and excluded-trip/duration ambiguity, plus discoverability/verification
refinements. See the existing M4.7 delivery record and
`_bmad-output/implementation-artifacts/review-replay-edit-spec-2026-10-24.md`.
This review does not fix product contracts or app behavior; earlier document
self-checks did not establish full behavioral coherence or visual usability.

## Detailed Replay Edit specification (2026-10-24)

The existing M4.7 SPEC retains CAP-1..5 and now registers `editor-experience.md`
and `editor-delivery-and-acceptance.md`: full screen composition, actual-output
checkmarks, per-trip automatic/explicit selection, complete-album bulk operations,
working/committed save and Back semantics, truthful progress and recovery.
D4.1-D4.5 and E01-E16 remain inside the sole M4.7 delivery record. Existing
soundtrack/month-year direction is adopted to remove stale silent/day-order
defaults from the kernel. Source boundaries and new API/schema gaps are explicit;
implementation, latency/memory measurements and Android/iOS owner acceptance are
pending. This task changes specifications only and preserves concurrent cache work.
Spec coherence/preservation, five capability IDs, 15 companion links, E01-E16 and
Markdown checks pass; root `npm run check` passes framework integrity, 20 tests
and eval smoke. Runtime/editor acceptance remains unverified.

## Replay durable prepared-artifact correction (2026-10-24)

Owner device evidence showed that returning from Atlas or restarting the app
discarded a rendered Replay and started rendering again. The former cache was
only an in-memory provider map while renderer output lived in the OS cache.
Replay now copies an inspected automatic owner preview into private app document
storage and stores only an opaque file key plus manifest identity, duration and
count in the local Replay draft. On entry it re-reads the current policy-visible
Journey List and media availability, recreates the expected identity, and uses
the saved MP4 only when all gates match and the file exists. A manual Re-render
invalidates the renderer's in-memory result and replaces the durable record;
selected sharing artifacts remain temporary. Native back/swipe from Edit or
sharing returns to the preview instead of popping to Atlas. Focused Replay UI
and controller tests pass with a repository-local Jest cache after the sandbox
Temp cache failed before running tests; TypeScript, renderer/selection tests,
86 SQLite contract tests, and root `npm run check` pass. Device confirmation
of Atlas return and cold-restart reuse is still required.

The Replay preview controls now use one bottom-right row: a speaker icon beside
an explicit fullscreen icon. The conflicting native fullscreen button is hidden
in embedded playback, while fullscreen itself uses Expo Video's supported view
API. Mobile lint, TypeScript and focused Replay-screen tests pass; owner visual
confirmation on the device remains required.

## Lean UX and Replay Edit owner amendment (2026-10-24)

Decision 0014 and `docs/product/design-system.md` now require reference-led,
user-centered, lean self-serve UI for every build/rebuild: concise contextual copy,
few steps, recognizable visual choices, retained navigation and truthful updating
progress bars/percentages. The Replay interaction contract replaces the flat
per-media button list with preview context, a trip strip and a selectable media
grid based on Journey List's See photos. Selection means actual composition
inclusion; preparation runs automatically after Done. Secondary music/order
controls stay compact. The existing M4.7 record remains the sole delivery plan.
Source inspection confirms the current editor lacks thumbnails and trip grouping;
the gallery reference also needs video posters for this use. Design/contracts only:
runtime rebuild and physical Android/iOS visual/usability acceptance remain open.

## Replay soundtrack and month-order specification (2026-10-23)

The owner selected Happy Moments 1.4, requested in-player speaker mute, local
custom soundtrack selection in Edit Replay with a 5 MB limit, and oldest-first
trip presentation using start month/year rather than days. The complete contract
is `_bmad-output/specs/spec-replay-soundtrack-and-month-order/SPEC.md` plus its
behavior companion. This supersedes the earlier bundled-music delivery intent;
current implementation still needs these corrections. Spec only: no app/runtime
changes or device validation were performed.

## Replay bundled music (2026-10-23)

The owner replaced silent-only Replay with bundled instrumental music. Replay
now defaults to the CC0 Meadow Thoughts harp recording, offers music on/off,
and carries that choice into selected exports and the artifact cache identity.
FFmpeg adds a quiet AAC track with fades at final mux; personal source audio is
excluded. No new native dependencies, device install, Metro launch, or port changes.
Android offline export includes the OGG asset; typecheck and root check pass.
Independent review was unavailable due to reviewer quota. Native listening and
export acceptance remain pending; the owner already confirmed the earlier app
startup recovered using normal Windows PowerShell Expo build/device selection.

## Android recovery isolation audit (2026-10-23)

`docs/development/android-startup-trace-2026-10-23.md` supersedes earlier causal
claims below. Metro records a transient Atlas conflict-marker failure at 14:50:57,
before the 15:15 Expo patch update. The conflict writer remains unknown. Recovery
subsequently installed an arm64 debug binary whose default endpoint is 8084,
then removed that endpoint's temporary server/routes without restoring the prior
binary. Port separation did not isolate the shared checkout, build outputs, or
device package. App launchability remains unresolved; closing the launcher was
not a recovery. No runtime mutation was performed in this audit.

## Android startup incident evidence correction (2026-10-23)

Owner still reports an app that cannot open. Recovery observed a missing USB
reverse rule and historical Metro compilation failures; current source has no
conflict markers and the isolated host Android bundle and mobile typecheck pass.
The device remains without a verified Travel Life React surface. Context-not-ready
native soft exceptions do not establish a faulty binary or rule out application
startup code. Earlier root-cause and reinstall-necessity claims are retracted in
the error playbook. Exact cause and authorship of the historical conflict remain
unknown. Next diagnosis must correlate one stable endpoint, fresh device process,
manifest/bundle requests, and first JS execution before choosing a repair.
One owner-approved `:app:installDebug` attempt entered the native C/C++ build but
stopped producing progress and never changed the device package; its wrapper was
stopped without altering the installed app or device data. Treat native-build
diagnosis as a separate bounded blocker rather than repeating installs.
The tracked retry established the build-side cause: packaging all four Android
ABIs exhausts the configured Gradle heap. Recovery now targets only the
connected arm64 device, avoiding a global heap change and the unneeded ABIs.
The arm64 install succeeded, but a localhost-only Metro/USB-reverse recovery
still never delivered an Android bundle to the dev client; its temporary server,
proxy, and 8083/8084 reverse routes were removed. Shared 8081/8082 routes were
left intact. Android device rendering remains unverified; a user-reported
vertical-line display defect is hardware scope, not an app conclusion.

## Replay rendering performance plan (2026-10-23)

The M4.7 delivery record now includes a source-grounded P0-P5 performance plan:
measure the current cold path, optimize its dominant cost, add safe independent
chapter reuse, progressively play verified chapters, then complete recovery and
exact long export acceptance. Provisional targets are 50% lower median cold
completion and multi-trip first-playback latency on matched device fixtures;
unchanged reopen must encode zero chapters and one-trip edits regenerate only
the affected chapter. Fixed-manifest visual comparison, continuous playback,
privacy/access revalidation and both-platform owner evidence gate delivery.
No speedup is measured yet. Existing renderer/card edits remain untouched;
next work is P0 baseline capture against their reconciled source snapshot.

## Replay chapter-card legibility host implementation (2026-10-23)

Replay chapter cards now reserve 48 frames (two seconds at 24fps) from their
existing sparse and normal chapter budgets, including exact export manifests;
they do not add runtime or pad short videos. Rendering resolves the bundled
SIL Open Font License 1.1 Noto Sans Regular asset to a local, filter-safe FFmpeg `fontfile`
path for both title and time overlays, while retaining the closed Unicode-aware
token sanitizer. Focused selection (13 tests) and renderer (6 tests) suites,
TypeScript, and lint pass. Android and iOS owner-operated 720p legibility
validation, including a Vietnamese-labelled chapter, remains pending and is not
inferred from host tests.

## Expo SDK compatibility CI repair (2026-10-23)

The owner-reported GitHub failure reproduced online as nine Expo SDK 57 patch
mismatches. Applied Expo's recommended dependency patch updates and regenerated
the mobile lockfile. Online dependency validation now passes; Expo Doctor is
21/21. Full mobile Jest passes 44 suites/439 tests, SQLite 86 tests, TypeScript,
lint and root foundation checks. CI dependency validation remains enabled.
These are host compatibility results; the previously installed development APK
predates the native patch updates, so physical acceptance is not transferred to
the new dependencies. Existing npm audit advisories remain outside this repair.

## Runtime audit and historical worktree retirement (2026-10-23)

The mobile working tree equals local main `fc72600`, including the three
Replay/audit commits. The installed Android APK hash matches the local build;
Metro runs from this checkout with the connected Travel Life client. Already
loaded JavaScript byte equality is unverified because the complete source-map
request did not finish. All four obsolete worktrees are deregistered and their
Git entry points disabled, with every file preserved. Their commits and the six
backup/consolidation branches are retained as local retired tags. Only main
remains an active local branch/worktree. The retirement record is
`docs/development/worktree-retirement-2026-10-23.md`; explicit authorization and
a fresh audit are required to recover or integrate archived histories.

## GitHub and local-worktree comparison (2026-10-23)

`origin/main` was refreshed and matches the local baseline that preceded the
current Replay delivery. The cartography and destination-label worktree heads
are already ancestors of `main`, and all four secondary worktrees are clean.
Two preserved histories remain outside `main`: dimensional Atlas `aac320e` and
local responsiveness `f4699c4`/`e904e4f`. They were compared before
integration. Dimensional Atlas conflicts with the newer MapLibre/reference
cartography surface; local responsiveness conflicts across fourteen files with
the later accepted performance/privacy delivery `4af3a76`. Both histories stay
preserved in their existing worktrees and named references; neither is applied
because doing so would replace current behavior. The verified Replay delivery
is committed separately as `7820f5d`; local screenshots, review scratch files
and Jest cache remain untracked and excluded from Git.

## Replay ordering and trip-separator specification (2026-10-23)

The owner chose **oldest first** as the default private Replay timeline. The
optional editor will persist a newest-first presentation choice. Every visible
trip chapter will open with a brief local title card containing only the current
private Journey List label/destination and its existing time precision. These
are presentation-only changes: uncertain chronology retains stable Journey
List-relative placement, and cards never imply routes, exact dates, presence or
new observations. The canonical spec and M4.7 delivery plan now require safe
local text rendering, cache invalidation for label/time/order changes, SQLite
reopen/reset tests, and Android/iOS card legibility/order evidence. This is a
plan/spec update; the runtime behavior and device evidence remain pending.

## Replay order and chapter cards implemented (2026-10-23)

Replay now defaults to oldest-first, offers a private newest-first editor choice,
and persists that choice in the existing local Replay draft alongside media
overrides. It restores after reopening, participates in exact manifest/cache
identity, and is used by private playback and exact selected sharing. Only
supported non-overlapping chronology is reordered; unknown/overlapping blocks
retain Journey List-relative order. Each trip chapter now starts with a bounded
one-second local title card using a sanitized current label/destination and
coarse existing time precision inside the accepted chapter budget.

Focused Replay tests (31), the real-SQLite suite (86), TypeScript, lint, full
mobile Jest, root `npm run check`, and `git diff --check` pass. The Android
development APK built successfully for connected device 2211133G and the app
was launched against the existing development server. Owner-operated rendering,
card legibility, order persistence after restart, and exact selected-share output
remain pending; native device evidence is not inferred from the build/install.

## Replay implementation started: automatic local chapter baseline (2026-10-23)

Android development build evidence: `npx expo run:android --device 2211133G`
completed a Debug build successfully, installed it on the connected device, opened
the Travel Life development URL, and Metro bundled `expo-router/entry.js`. This
establishes build/install/launch transport only; owner-operated Replay watch,
edit/reopen, share, and scheduled-preparation acceptance remain pending.

The owner identified a Replay preparation feedback gap on that build: static
startup copy gave no indication that local source resolution and video rendering
were underway. Replay now mirrors the active Atlas update treatment with an
accessible spinner and distinct resolving/rendering labels. The focused screen
regression, TypeScript, and lint pass; the rebuilt Android validation is pending.

The owner then requested a simple percentage indicator. Renderer work now reports
non-identifying private-media and scene counts to Replay, which displays a
determinate accessible progress bar and percentage during composition and final
verification. Focused Replay screen/renderer/controller tests, TypeScript, and
lint pass; the development device reload remains the owner validation step.

M4.7 implementation now starts Replay on entry, autoplays the verified private
artifact, and removes the retired Prepare action and global 25-panel planning
refusal. The local metadata fallback retains every allowed attachment as an
editorial candidate, selects up to six stable day representatives per trip, and
uses the accepted initial 3/5/8/15/16/18/20-second chapter budgets. The renderer
now composes selected moments sequentially at those per-chapter frame budgets
instead of contact sheets plus a fixed global intro/outro.

The first private editor now supports Replace/Add/Remove/Reorder and Done:
committed selections and their order are stored in an additive local SQLite draft
table using internal evidence IDs, then returned to the screen as opaque Replay
tokens and regenerated. The editor does not modify journey evidence. Sharing now opens a separate empty-first
selection/review surface; the owner must explicitly choose the exact private
moments to render before the native share sheet can open. The mobile Jest suite passes
when run in two bounded local-cache batches (the full command exceeds the shell
window), alongside schema unit tests, the 86-case real-SQLite suite, mobile
TypeScript, lint, and root foundation checks. Expo Doctor did not complete inside
the local command window, so it remains unverified.

Replay preparation now passes through one provider-owned `ReplayController`, so a
new request cancels an in-flight older render and provider cleanup disposes the
captured private artifacts. This is host-verified ownership only; native task
handoff, cache reuse, and physical playback remain open acceptance work.

The durable Replay draft now keys each edit by an internal journey-plus-evidence
reference, rather than evidence alone. This preserves independent edits when one
attachment supports more than one visible trip. The real SQLite suite verifies
save/reopen order and keeps these references behind opaque screen tokens.

The private editor also has Reset automatic selection. It deletes only the
local Replay-draft row, regenerates from the current policy-visible Journey List,
and has real SQLite reset/read-back coverage. It never changes journey evidence.

Replay video selections now retain a bounded local moving clip in the native
panel renderer; stills remain single-frame panels. A short video retains only
its measured available frames: it is never padded, frozen, looped, or slowed to
reach a still-image budget. A qualified visible trip with no usable attachment
gets a neutral three-second local slate instead of being relabelled as an empty
Replay. The exact export review remains empty-first but now offers an explicit
Select all moments control alongside individual selections. This is host-tested
only; native decode behavior and actual clip timing still need owner-operated
Android and iOS acceptance.

On 2026-10-23, the full mobile Jest suite passed (44 suites, 433 tests) with the
repository-local cache, the real SQLite suite passed (86 tests), and mobile
TypeScript/lint plus root `npm run check` passed. `git diff --check` has no
whitespace errors. Expo Doctor remains unverified because it has not completed
in this environment; physical Android/iOS watch, edit/reopen, native share, and
scheduled preparation remain the final acceptance gates.
Multi-trip progressive cache/task ownership, video interval validation, AI
evaluation, and physical
Android/iOS R25-R28 acceptance remain pending. The local selector is deliberately
metadata-only; no private media left the device or was sent to a model provider.

## Replay sparse timing and implementation spec (2026-10-23)

The owner accepts shorter sparse chapters and requested the final plan/spec:
one memory about4-6s, two about6-10s, enough distinct content usually15-20s.
No filler; title/transitions count; video and explicit additions can justify
longer. The new timing-contract.md makes exact initial frame budgets, chosen-
source counting, decode-loss recovery and sparse/normal exceptions executable.
CAP-1..5 stay stable; acceptance is R1-R28. Earlier strict15-20s minima are retired.

The single M4.7 delivery record starts with a one-trip automatic watch -> Replace
-> regenerate -> reopen slice, then expands selection, chapter service/background,
editor and exact long export. Product editor labels are Replace/Add/Remove/Reorder;
internal intent persists. Per-trip content fingerprints allow safe unchanged-byte
reuse despite broader history revisions, after current privacy/access checks.
No runtime/model/native work was performed by this spec update. Implementation
and physical Android/iOS acceptance remain pending; next work is D0/D1.

## Replay chapter timing and memory curation (2026-10-23)

The owner now requires15-20 seconds per trip initially, an overall Replay that
grows with all scoped trips, and a wisely selected subset of photos/videos.
This supersedes previous30-60s/global25-panel/all-media-in-pixels and forced
narrowing limits. Decision0009 and the canonical spec are updated; the new
memory-selection-contract.md defines proposed criteria, owner overrides,
local/optional consented AI, video-window validation and an evaluation plan.

Use a progressive verified chapter sequence with bounded work/cache; full chosen
video export is a separate streaming/storage gate. The active delivery plan now
adds curated selection/clip/AI-consent evidence and R19-R24 to the existing
one-tap/editing work.18s,4-6 shots, ranking/defaults and native clip capability
remain implementation proposals/unmeasured; no code/dependency/model processing
was performed in this planning update. Next is D0/D1 plus a local-selector
baseline; model choice follows measured benefit and actual consent boundaries.

## Replay implementation plan (2026-10-23)

The single [M4.7 delivery record](../_bmad-output/implementation-artifacts/spec-m4-7-preview-and-export-the-travel-life-replay.md)
now plans D0 baseline, D1 durable drafts/cache, D2 shared automatic service,
D3 one-action player, D4 optional editor, D5 separate exact share and D6
Android/iOS acceptance, with platform S0 evidence collected alongside host work.
Canonical CAP-1..4 are retained; CAP-5 covers durable optional editing. Read the
new interaction-contract companion for revision/CAS/remap, native task ownership,
cache retention and invalidation. Initial inclusion/order controls are
agent-selected editor defaults; full editing/timing tools are not implied.

This is a planning update only. Provider preparation still bypasses the separate
controller and export directly shares the private preview; selected-export
acceptance is not established. The earlier ephemeral-only/no-schema assumption
is superseded by a justified additive private-draft/cache migration. P>25 remains
an explicit full-scope limit; no sampling/longer-video decision was inferred.
Next work is D0/D1. Both-platform scheduled preparation, one-tap playback,
restart-persistent edits and native export still require implementation/evidence.

## Replay interaction direction (2026-10-23)

The owner explicitly rejects the multi-step Replay preparation flow: tap Replay
and it runs, with optional editing whenever desired. Preparation, media access
resolution, composition and verification belong behind that single action;
there must be no separate mandatory Prepare or review wizard before private
playback. Offer editing from the playback experience and preserve owner edits
when refreshing generated content. Sharing remains a separate deliberate action.
This direction is recorded in decision 0009. The current screen still requires
Prepare and lacks the requested editing experience; implementation and physical
device verification remain pending. Background preparation must respect native
scheduling and must not promise immediate playback when no valid artifact exists.

## M4.7 Replay manifest scope correction (2026-10-22)

The owner then reached Replay and saw `0 visible trips` and `0 attached
memories` immediately after Atlas had shown nine journeys. Replay had reused an
Atlas display-refresh generation as though it were a private data-scope token;
an unrelated detail read advanced that display counter while Replay's manifest
was still loading. Replay now retains its current Journey List manifest across
ordinary Atlas reads and invalidates it only for a privacy mutation or private
record lifecycle loss. The repository remains responsible for current-run and
privacy filtering.

Mobile lint, TypeScript, the focused 87-test provider/Replay/repository suite,
root `npm run check`, and `git diff --check` pass. The corrected Android bundle
has been cold-reloaded and is now on private Atlas; its Replay control may be
below the initial viewport. The owner must now reopen Replay and prepare it once
more to verify the real-device manifest and render result. Export and sharing
have not run; M4.7 remains incomplete.

## M4.7 Replay fixed-stage refresh correction (2026-10-22)

The owner again received the renderer-unavailable message after a device
synthetic encode had completed. The screen classifier depended only on a
JavaScript `instanceof` identity; Fast Refresh can retain an earlier error
prototype and turn a closed access/decode/stale stage into the generic fallback.
It now accepts only the fixed Replay stage vocabulary across that boundary, and
the provider now reports lifecycle loss as stale and unavailable private manifest
or media resolution as access. No native or private error text reaches UI,
diagnostics, or project records.

Mobile lint, TypeScript, and the 38-test focused renderer/screen/provider suite
pass. A fresh physical preparation is required to establish the actual remaining
stage or a real Replay preview; M4.7 is still incomplete.

## M4.7 Android renderer warm-up correction (2026-10-22)

The current Android process emitted an actual `REPLAY_UNAVAILABLE` stage before
private media handling, although an earlier synthetic S0 had shown that the
native module could respond. Real preparation now runs the same closed native
version query before selecting its codec inventory, allowing a freshly started
hybrid module to initialize before any personal media is accessed. A failed
query still fails closed as renderer-unavailable.

Mobile lint, TypeScript, and focused Replay renderer/screen tests pass. The
fresh device reload and owner preparation remain required; no preview, export,
or sharing claim has been established.

## M4.7 codec-discovery fallback correction (2026-10-22)

The same Android device continued to fail at Replay's pre-media renderer gate.
The installed native package documents `libopenh264` as its portable bundled
encoder, but its asynchronous discovery result is advisory rather than proof
that the encoder cannot run. Replay now falls back to that supported encoder
when discovery produces no candidate and uses `nv12` for an Android MediaCodec
selection. This makes FFmpeg's real encode result the gate instead of a codec
reporting race.

Mobile lint, TypeScript, and focused Replay tests pass. Physical real-media
composition still requires confirmation; no output or sharing claim is made.

## M4.7 screen-first manifest-stage correction (2026-10-22)

The exact current Android build passed both development-only native S0 gates,
including a verified local synthetic MP4. This proved that the native renderer,
cache, and an encoder are available on the device. The remaining generic message
was instead from Replay's first manifest/preview read, which preceded the
provider preparation boundary and escaped untyped. That first read now maps to
the closed `REPLAY_ACCESS` stage, with a regression test for the screen-first
path.

Mobile lint, TypeScript, and 39 focused provider/renderer/screen tests pass.
The next physical preparation must establish media access or real composition;
no personal media has been exported or shared.

## M4.7 Replay access-stage correction (2026-10-22)

The prior Android Replay attempt reported renderer unavailability even though
the native renderer module and synthetic encode were present. The failure
occurred before rendering, while resolving the current attached-media handles.
Manifest and handle-resolution rejections now publish the fixed `REPLAY_ACCESS`
stage instead of the renderer-unavailable fallback; raw native details remain
in memory only. The owner-facing copy asks for current local-photo access rather
than incorrectly sending the owner to the synthetic renderer check.

Focused provider and Replay screen tests, TypeScript, and lint pass. The app was
restarted from the private localhost Metro bundle; Atlas shows all nine retained
journeys and the `Explore Replay availability` control. Android denies host
input injection, so the owner must tap that control and `Prepare Replay` for the
next physical observation. No export or sharing action has run.

## M4.7 Atlas Replay-retention recovery (2026-10-22)

An Android owner report found the Replay entry absent while Atlas displayed a
recovery notice and zero journeys, despite saying the last committed journeys
remained available. The durable reader had chosen the newest completed run even
when it was an empty transient pass. It now retains the latest qualified run at
the same evidence revision, then applies the current privacy filter; hidden
journeys cannot return through this fallback. The same selection is used by the
Replay manifest input.

Mobile TypeScript, lint, the 52-case reconstruction repository suite, root
`npm run check`, and `git diff --check` pass. Metro is reachable through the
Android device's localhost tunnel and the new bundle has been loaded. The reload
returned to the normal Welcome route; direct Atlas route verification and the
owner's Replay preparation/preview remain open. The story is not complete.

## M4.7 private Replay preview and deliberate export implementation (2026-10-22)

Replay preparation now resolves the effective Journey List attachments inside
PhotoAccessProvider, keeps their local handles out of React state and diagnostics,
materializes anonymous app-cache inputs, uses every decodable photo/video still
in bounded 1–4 tile panels, and validates an H.264/yuv420p 1280×720 silent MP4
before publishing a local player handle. The preview screen receives only that
artifact URI and coarse counts. Export is a second explicit action from the
verified preview and uses the native OS share sheet; closing the Replay removes
the local artifact lease.

Focused Replay/provider tests (36 assertions), TypeScript, lint and root
`npm run check` pass. The tests use narrow native mocks and do not prove native
composition, playback or sharing. Android owner verification and all iOS S0/
acceptance evidence remain open; the story is not complete until those checks
are observed on physical devices.

## Android development-app load recovery (2026-10-22)

The connected Android development build could not load because its retained LAN
packager address was unreachable. Restarting Expo in ordinary localhost mode
initially bound only IPv6 loopback, which ADB reverse could not reach through
the device's IPv4 loopback endpoint. Expo now runs privately at
`127.0.0.1:8081` using IPv4-first localhost resolution and the device is
connected through ADB reverse. Metro bundled the Expo Router entry successfully
and the owner-visible Welcome screen is loaded. This proves the development
transport and startup path only; the owner still needs to navigate to Replay and
click Prepare Replay for the requested media-parity acceptance evidence.
The development build exposes the synthetic Replay S0 probe only after Prepare
Replay reaches its fail-closed renderer state. It is excluded from release
builds and uses no private media. Android blocks host input injection on this
phone, so the owner must navigate to Replay and tap it; S0 remains unpassed
until its visible terminal state and closed diagnostic outcome are observed.
**Update:** The owner observed `Renderer responded on this phone` and `Check
complete`, passing the synthetic availability response. It does not prove an
encode, output validation, preview, or sharing; therefore no video has been
created and production Replay rendering remains fail-closed. A synthetic MP4
encode plus file/FFprobe validation is now available on the physical device;
its owner result is required before private media composition can begin.
**Update:** The owner confirmed synthetic-video success. Android can now encode
and FFprobe-validate a cache-only MP4, but private attachment materialization,
composition, preview and sharing remain unimplemented and must not be implied.

## M4.7 Replay media parity slice (2026-10-22)

Implemented the first media-gap slice on the retained dirty checkout. Replay's
current-run manifest now preserves effective unknown and undated attached media,
keeps aligned provider-only source references, and resolves them through the same
local adapter path as the Journey album. References are stripped before the
screen receives the manifest. This replaces the prior zero-memory outcome caused
by treating import-time unknown status and null capture date as ineligible.

Real SQLite covers the retained unknown/undated attachment and privacy withholding;
provider coverage proves adapter resolution makes an unknown attachment usable.
Focused provider, Replay and SQLite tests plus TypeScript pass. The native renderer
still correctly reports unavailable until S0 proves encoding; this slice does not
claim preview/export/device acceptance. Next remains full shared-query extraction,
materialization/compositor and physical S0 under the M4.7 delivery record.

## Replay decision amended; media-gap development plan (2026-10-22)

Owner requested the decision update and a solid development plan. Decision 0009
now records current Journey List scope + shared effective album media/access,
automatic private preparation, undated-media retention and a separate empty-first
exact export flow. The M4.7 canonical spec retains CAP-1..4 and adds
media-pipeline-contract.md; epics and the working MLP spec are synchronized.

The single M4.7 delivery record contains D1 shared attachment SQL, D2 shared local
resolution/opaque handles, D3 automatic full-scope composition, parallel synthetic
S0, D4 production preview, D5 deliberate export and D6 both-platform acceptance.
R1–R10 cover the reported nine-trip mismatch, album parity across pages/corrections,
unknown access, null dates, mixed media, fit limits, stale work and exact export.
No reconstruction/schema migration or AI change is planned. Full-scope composition
must not silently sample: the initial four-tile/two-second panel default offers
explicit scope narrowing when a readable 30–60 second artifact cannot fit. This
default is unmeasured; no unlimited-library rendering promise is made.

This turn changes documents only. The production renderer still fails closed;
Android build/module response is not encoding/export acceptance. Native output,
layout readability, provenance and physical iOS remain technical gates. Start
D1–D3 without another product decision; integrate each native platform only after
its S0 evidence, and do not complete M4.7 without both-platform owner acceptance.

Planning validation passes root `npm run check`, whitespace checks, local links,
CAP/AC/task/test mappings and the full panel/frame boundary calculation. Mobile
and physical checks were not rerun for document changes; no runtime fix is claimed.


## Replay owner clarification and open media mismatch (2026-10-22)

Owner clarifies the private Replay source contract: use the journeys they chose
to show in the Journey List and the photos/videos/media attached to those
journeys to construct a meaningful replay. Do not require another independent
trip qualification or attachment-curation step for private preparation. Selected
sharing remains a separate deliberate action under the existing privacy contract.

Owner reports Prepare Replay finds nine visible trips but zero usable attached
memories. Read-only inspection identifies separate album/Replay media queries,
Replay's strict stored-availability check without the album's access resolver,
and a captured-day requirement. These are concrete parity gaps; the exact device
cause remains unverified. Next implementation must share effective album media
scope and resolve access before reporting omissions, then demonstrate the same
selected journeys and accessible media in an owner click-and-wait Replay flow.
This party discussion changes no application source or native acceptance status.


## M4.7 native adapter state (2026-10-22)

`munim-ffmpeg@0.9.2`, `react-native-nitro-modules@0.37.1`, and SDK-57
`expo-sharing` are installed with a fail-closed adapter and synthetic S0 entry
point. The Expo config plugins are declared and Android/iOS native directories
exist. npm reported an install-script approval warning, so binary provenance has
not been independently verified. A physical Android development build now
compiles, links, installs and opens with the module present; the synthetic S0
owner tap, codec result, output verification and share result are still unrun.

Local implementation now includes a current-run/privacy-gated Replay manifest
read, empty-first private export selection/review UI, native-sharing adapter
boundary, and real SQLite coverage. Mobile Jest, the 86-test SQLite suite,
TypeScript and lint pass; root `npm run check` passes. Expo Doctor reaches the
registry and passes 20/21, retaining the existing nine SDK patch-version
mismatches; no SDK update is part of this delivery. Physical Android/iOS
development-build S0 and owner click-and-wait evidence remain required. iOS
environment availability is unproven. **Update:** Android SDK ADB was found
outside PATH, the connected Xiaomi 2211133G (Android 16) accepted a successful
development build with the Munim module linked. The product Replay screen now
sources its scope from the current policy-visible Journey List: one visible trip
with usable attachments is enough, and all effective available photos/videos
from selected visible trips remain in scope. It no longer requires a fresh
permission/import/rebuild action or a two-observed-destination gate. A synthetic
S0 route is open and awaits a reload plus owner acknowledgement of its strengthened visible
terminal state. The previous tap did invoke and complete the synthetic native
query, with the Android loader resolving `libmunimffmpeg.so`; the original UI
feedback was too subtle and has been corrected. This is not a codec/export/share
acceptance result. **Latest Android incident:** repeated development-client deep
links crashed Expo Dev Launcher while it attempted a second React-context setup.
A clean development-build reinstall succeeded and resumed the app without a new
crash; owner replay acceptance remains pending.

## M4.7 spec revision after review (2026-10-22)

Owner requested revising the reviewed M4.7 specification. The delivery draft and
canonical contract now define separate private preview/empty-first selected export,
observed-interval ordering, individual memory membership, deterministic coverage,
quantitative rendering limits, exact-preview binding, native share handoff and
artifact cancellation/retention/startup cleanup. Stable CAP-1..3 are retained;
CAP-4 preserves optional selected-highlight attachment through M4.5/M4.6.
Selection, renderer and verification companions include A1–A10/E1–E9 resolution
trace and AC-M4.7-1/2/3 evidence allocation. The historical review is retained.

The first implementation task is a synthetic, both-platform native feasibility
gate; compatibility and product/device acceptance remain unmeasured. Assumed
defaults include a two-observed-group minimum, at most 12 scenes/stills and
explicit sampling/omission disclosure; they change no reconstruction thresholds.
Root `npm run check` passes framework integrity, 20 foundation tests and eval
smoke. Companion paths, capability IDs/shape, review/source mappings, timing
bounds and whitespace checks pass. Only documentation changed. Delivery record:
`_bmad-output/implementation-artifacts/spec-m4-7-preview-and-export-the-travel-life-replay.md`.
Draft status does not imply owner approval or implementation completion.

## M4.7 Replay spec review (2026-10-22)

The requested M4.7 specification and build planning produced a draft delivery
record plus canonical Replay spec/renderer companion. Owner-requested review
finds the draft is not ready for development: selected export scope, chronological
ordering, per-memory eligibility, resource limits, native save/share semantics,
artifact lifecycle, renderer feasibility and Jest discovery need explicit contracts.
The optional hosted-highlight handoff in the source AC also needs a recorded
disposition. Detailed findings and source evidence:
`_bmad-output/implementation-artifacts/review-m4-7-replay-spec-2026-10-22.md`.
No application source, dependency or native build changes were made. Device
rendering/export remains untested. Next work is to resolve the draft findings
before implementing against it; this review does not approve the specification.

## Accepted-work GitHub main delivery (2026-10-21)

The owner requested scanning and publishing all agreed/completed work before
starting anything new. A fresh origin fetch confirms local main and origin/main
share the consolidation baseline `cd889c9`. All four secondary worktrees are
clean; the consolidation delivery ledger already accounts for their integrated,
superseded and preserved history. The current delivery includes the completed
Atlas phase probes, destination computation optimization, empty-constraint graph
reuse, M4.3 Hide/Exclude/Restore, regressions and their acceptance records.

Fresh verification passes root `npm run check` (20 tests and eval smoke), all
40 mobile Jest suites / 402 tests, 85 real-SQLite tests, TypeScript and cache-free
lint. Expo Doctor reaches the registry and reports 20/21: the same nine existing
SDK patch recommendations remain. No dependency/native build changes are part
of this delivery; no new device or iOS acceptance is claimed. Private data,
credentials and generated caches stay ignored. Publish this recorded snapshot
to main, verify remote equality and a clean checkout, then await new build scope.

## M4.3 private visibility/exclusion accepted on Android (2026-10-21)

Owner-approved whole-journey privacy controls are implemented on the existing dirty
checkout. Schema v34 retains immutable reviewed Hide/Exclude/Restore revisions,
with physical-layout validation for retained current/newer markers. Hide covers
ordinary Atlas/Timeline, visible inferred totals, detail/media and new eligibility;
manual entries support Hide. Exclusion freezes reviewed supporting inputs and
duplicate members for the next reconstruction, while withholding the journey
immediately. Ambiguous successors and new family scope stay protected without
silently broadening excluded inputs; Privacy Settings retains the restore path.

Journey Edit includes accessible consequence/scope confirmation and Settings
includes restore confirmation. Provider serialization and generation guards prevent
stale detail/media/uncertain-memory callbacks from returning after a privacy change.
Native Atlas/Replay withholds raw-graph fallback before durable policy projection.
New future preview selection starts empty and eligibility must be checked afresh.
Existing snapshots and source originals stay unchanged; no sharing service or
Replay exporter was added.

Final parent verification passes 40 Jest suites / 402 tests, 85 real-SQLite
tests, typecheck, lint, root `npm run check` and whitespace checks. Independent
reviews found privacy boundary, storage validation, correction-precedence and
UI gaps; fixes have regressions. A final cancelled list read now reaches the
retry state instead of masquerading as an empty successful result. The checked
Android bundle was served and the installed app reopened without a reset. The
owner confirmed both Hide/Restore and Exclude/Recheck/Restore completed correctly;
the M4.3 delivery record is done. The pre-existing native
split-order adapter mismatch is deferred separately; iOS validation is unavailable.
Synthetic checks do not measure reconstruction accuracy. Next delivery work is
the MLP Replay/selected-sharing flow gated by these privacy controls; static
cards remain P1. Delivery record:
`_bmad-output/implementation-artifacts/spec-m4-3-private-visibility-and-exclusion.md`.
No reset, original deletion, upload, staging, commit or push.

## M4.3 visibility/exclusion audit and draft (2026-10-21)

The owner reports correction/manual-entry device walkthroughs already completed
and authorized moving to M4.3. Read-only audit finds durable evidence-inclusion
overlays consumed during rebuild and existing delete-all, but no complete hide
policy, restore management or common visibility enforcement across detail/media,
Atlas/counts and future preview eligibility. Replay/sharing remain placeholders;
no live share-preview acceptance can be claimed. Epic 4 context refreshed.

Draft delivery record:
`_bmad-output/implementation-artifacts/spec-m4-3-private-visibility-and-exclusion.md`.
Whole-journey scope, hidden-count behavior, reviewed evidence exclusion and
delete-all versus item deletion are explicit owner choices before source changes.
Recommended semantics and alternatives are in the draft. No app/schema/device
changes, commit or push. Performance work remains complete and preserved.

## Rebuild processing cost investigation (2026-10-21)

Authorized Build continues on the retained dirty checkout. Fixed opt-in profile
stages now separate structural preparation, baseline/constrained graph passes,
intermediate/final correction maps, memory overlay, owner merge, continuity and
membership overlay. No graph, correction, SQL/schema or transaction rules change.
Qualification stays within persistence; memory-overlay timing includes awaited
SQL. Detailed phase totals include diagnostic overhead and are not directly
comparable to a prior run's single coarse interval.

52 real-SQLite tests pass, including enabled/disabled call/result parity and a
populated memory-overlay interruption preserving rollback/error identity. Full
mobile Jest 39 suites / 386 tests, typecheck/lint, root check and diff checks
pass. Blind review gaps were addressed and follow-up found no profile blocker.
Owner completed the profile recheck with unchanged journeys. Baseline and
constrained graph passes took 16.772 s and 16.832 s; continuity 0.275 s and
intermediate/final mapping were small. The bounded optimization now computes
rejection constraints at the same point and reuses the baseline only when they
are empty. Nonempty constraints retain a second engine pass. 63 real-SQLite tests
pass, including 11 isolated reference/candidate comparisons of graph, SQL,
applications and failure behavior. Full mobile Jest 39/387, typecheck/lint and
review pass. Successful merge acceptance is not established by the fail-closed
merge parity fixture. Owner confirmed the final optimized Android recheck
completed with journeys/labels unchanged. Paired events measure retry 35.890 s
versus the preceding 54.068 s; rebuild 28.671 s versus 46.375 s, with the
constrained-graph phase falling from 16.832 s to 0.001 s. Baseline graph remains
16.928 s, persistence 10.861 s, durable read 7.186 s. The observed 18.178 s
reduction is one before/after pair, not a representative latency or accuracy
claim. Profiling disabled after capture; normal app reopened. No install/reset,
commit or push. Delivery record:
`_bmad-output/implementation-artifacts/spec-rebuild-processing-costs.md`.

## Destination-label computation optimization (2026-10-21)

The owner authorized a new bounded Build on the existing dirty checkout.
Delivery record: `_bmad-output/implementation-artifacts/spec-destination-label-computation.md`.
The geometry resolver now reuses point-invariant latitude math within each area;
destination support grouping appends rows instead of repeatedly copying growing
arrays. Dataset, geometry decisions, accuracy margins, duplicate-family rules,
SQL/schema/transactions, corrections, diagnostics and UI remain unchanged.

Exact isolated baseline/candidate comparison passed 499 public coordinate and
45 label cases, including region/later-ring and border-threshold transitions.
The work-count regression failed at 4,758 cosine calls before the hoist and
passes the 291-area upper bound afterward. Full mobile Jest passed 39 suites /
385 tests, real SQLite 51, typecheck/lint, root check and whitespace checks.
An additional repository regression passes within its 50-test suite and verifies
512 interleaved support rows preserve per-journey order, independent arrays and
labels. Four blind review verification gaps were patched; follow-up review found
no remaining blockers. Host timings remain noisy and establish no reliable speed
improvement. Product/reconstruction accuracy is unmeasured.

The owner completed the fresh Android click-and-wait recheck and confirmed labels
look unchanged. Matching fixed events measure 53.420 s parent retry, 45.749 s
rebuild and 7.642 s durable read; destination query is 0.867 s and computation
6.624 s, versus 10.422 s in the earlier sample. This 3.798 s observed reduction
is one-run evidence with uncontrolled device/cache conditions, not representative
latency or proof every phase improvement comes from this patch. Temporary
profiling was disabled after capture through the same Metro 8085 development
server. No reinstall, data reset, schema change, staging, commit or push.

## Bounded Atlas phase profiling (2026-10-21)

Following owner-confirmed import/Atlas completion on `cd889c9`, an isolated
opt-in development probe now measures fixed rebuild and durable-read phases.
Delivery record: `_bmad-output/implementation-artifacts/spec-atlas-phase-profiling.md`.
Schema, SQL, transaction ownership, graph rules, corrections and UI are unchanged.
Enabled/disabled real-SQLite comparisons preserve calls, parameters, results,
queued acknowledgement, caller-owned transaction behavior and error identities,
including the manual-layout failure probe. Mobile Jest passes 39 suites / 383
tests; the new helper has 100% statement/branch/function/line coverage. All 51
real-SQLite tests, mobile typecheck/lint, root check and diff checks pass.
Independent review findings were addressed with parity coverage and an explicit
capture procedure; failed phase intervals include rollback/diagnostic cleanup.
Native rebuild/Doctor were not repeated for this dependency-free JS-only probe;
the previously recorded SDK patch mismatches remain. Metro serves the probe with
`EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1` for a fresh-process owner recheck. The owner
confirmed completion, corroborated by fully paired fixed phase events. Parent
retry took 69.292 s: rebuild 57.749 s (processing 40.326 s, persistence 16.916 s)
and durable read 11.478 s. Destination query/label computation accounts for
11.276 s (98.2%) of that read; the rebuild-to-read gap is 0.003 s. This localizes
the earlier post-rebuild tail to `readDestinationLabels`, whose native query and
JavaScript calculation costs remain combined. One instrumented run establishes
neither an improvement nor a representative latency distribution. The profiling
record is complete; next scoped investigation separates those destination costs
before optimizing with unchanged output/evidence semantics. No commit, push,
storage reset or reinstall.

**Destination phase split (2026-10-21):** The next fresh Android recheck
separated `readDestinationLabels` without changing its query, labels, duplicate
validation, SQL calls or error stage. The support query took 1.096 s; subsequent
family validation, grouping and offline destination-label computation took
10.422 s. This isolates the durable-read tail to computation, not a demonstrated
missing SQLite index. The exact computation sub-cost remains unmeasured. Real
SQLite (51), focused Jest (10), typecheck, lint and whitespace checks pass;
two blind reviewers did not return findings before interruption; direct diff
review found only fixed profile-stage transitions and no new payload. No
commit/push/reset/install.

## Consolidated worktree candidate (2026-10-21)

The branch `codex/worktree-consolidation-2026-10-21` combines
the existing main WIP and delivery records with explicit dispositions for unique
worktree history. It preserves named local refs for the original main snapshot,
dimensional Atlas commit, and detached responsiveness history. The current
inspected commit is `cd889c98946b067cefd8af303a36b09d8fdeedd7`; local
`origin/main` resolves to the same commit (no network freshness check in this
inventory pass). The prior candidate `a994c9717c1978fe7754d9cd253acd60846e0272`
differs only in three documentation files, so the recorded application-source
checks still apply. No worktree was retired. Recorded checks include root checks,
38 mobile Jest suites / 377 tests, 50 real-SQLite tests, TypeScript, lint, and
whitespace checks pass. Expo Doctor is 20/21 because of nine pre-existing Expo
SDK patch mismatches. Independent review workers exhausted their account quota
before returning findings; direct full-diff audit found no tracked cache/private
paths or direct production console calls outside the diagnostics boundary. Android
metadata-import and Atlas-recheck acceptance is now owner-confirmed on the final
bundle and corroborated by matching structured completion events. Correction UI,
manual entry, background execution, and iOS were not re-exercised in this pass.

**Post-consolidation inventory:** The checkout was clean at audit start; a new
recovery-only commit would duplicate the already consolidated checkpoint and is
not proposed. Recovery, diagnostics, correction handling, and existing minimax/
bounded-write performance work are all accounted for in the existing delivery
record. Compared with the preserved accepted recovery source, consolidation
also changes import-open schema validation, abandoned-continuity deletion,
pending-candidate idempotency, empty-queue completion, and background diagnostic
classification. Earlier owner acceptance remains valid for that earlier bundle;
the final combined bundle now has Android import/Atlas acceptance as recorded
below. Further performance optimization remains paused. Root `npm run check` passed
again in this documentation-only inventory; mobile checks were not rerun because
application source was unchanged. No Git staging/commit/push, device operation,
or source edit occurred in this pass. The detailed inventory is appended to
`_bmad-output/implementation-artifacts/spec-consolidate-travel-life-worktrees.md`.

**Final-bundle device acceptance:** The owner reconnected/unlocked Android.
Preflight confirms mobile files match `cd889c9` and Metro is running. The USB
route was restored and a fresh app process opened on the verified consolidated
modules (physical-layout recovery, continuity deletion, empty-queue completion).
The owner confirmed `Import and Atlas check both complete`. Matching fixed
diagnostics show `METADATA_IMPORT START -> COMPLETE -> ATLAS_UPDATED` and
`ATLAS_REVEAL_RETRY START -> COMPLETE` in the fresh process. Only documentation
is uncommitted; no new application source, reset, reinstall, commit, or push was
introduced.

**First device timing sample:** Matched correlation IDs and epoch log timestamps
give 41.6 s for metadata import, 104.6 s from import start through its automatic
durable Atlas update, and 65.7 s for the separate owner recheck. The post-import
Atlas interval is 63.0 s; rebuild-complete to parent completion is 11.5 s for the
automatic update and 11.7 s for recheck. These are one-run diagnostic intervals,
not isolated engine/SQL/UI-paint timings, a speed improvement, or a representative
benchmark. The next bounded profiling target is rebuild versus durable-read/
publication cost; keep schema, inference and correction behavior fixed. Evidence
is attached to `spec-local-operation-responsiveness.md`.

## Multi-worktree cleanup planning (2026-10-21)

Read-only Git inventory confirmed five worktrees: main contains 32 modified
tracked files plus untracked source/tests/specs and a generated Jest cache; all
four secondary worktrees are clean. Cartography and destination-label branches
are ancestors of local main. Dimensional Atlas has one unique commit; the detached
responsiveness worktree has two. Local main is two commits ahead of the cached
remote ref; remote freshness was not checked. No commit, merge, push or retirement
was performed. The owner requires one consolidated execution and delivery, with
one integration branch, combined verification/review, and one final consolidation
commit for new changes after authorization. Internal preservation, reconciliation,
verification and retirement steps are not separate stories or approval milestones.
Existing performance work is accounted for within that same plan; optimization
remains paused. Plan:
`_bmad-output/planning-artifacts/worktree-cleanup-plan-2026-10-21.md`.

## Atlas physical-schema compatibility recovery (2026-10-21)

Fresh fixed device diagnostics established that the manual-journey query lacked
`date_start` despite the schema gate succeeding. A clean-process, aggregate-only
probe confirmed the incompatible manual table was empty. Its original creation
cause remains unknown; this does not establish that all mixed WIP came from the
performance request. Current source uses schema v33; earlier v34 continuity
notes below are historical and not the authority for current query compatibility.

The shared schema gate now validates the actual manual columns with a zero-row
query even for current/newer markers. Healthy layouts take no writer. A missing
table is created; an incompatible empty table is rechecked under the serialized
writer, retained with its indexes, then replaced with canonical empty manual
storage and its own date index. Both version markers, evidence, corrections,
committed projections, and unrelated work are preserved. Populated or uncertain
layouts and archive conflicts fail closed. No reconstruction/qualification rule,
performance algorithm, schema version, or private-evidence processing changed.

Verification: 49 real-SQLite integration tests; 38 mobile Jest suites / 373 tests;
mobile TypeScript/lint; root `npm run check`; source syntax and task whitespace
checks pass. Independent review found no remaining blockers after preservation
coverage and native-error classification were strengthened. These results prove
software/schema contracts, not reconstruction accuracy or faster device timing.

The served recovery module was verified, and the app was reopened through its
local development URL after final checks. The owner then confirmed: `Atlas loads
and the recheck completes`. This accepts the repaired Android path. A matching
fresh terminal event was not returned by the final fixed-log read, so completion
is owner-confirmed rather than independently demonstrated by that log capture.
No data reset, reinstall, commit, or push occurred. Performance changes remain paused.

Delivery record: `_bmad-output/implementation-artifacts/spec-atlas-schema-recovery.md`.

## Atlas legacy-continuity recovery (2026-10-20)

Schema v34 takes a one-time local snapshot of V1 journeys that were already in
the committed projection at the V1.1 boundary. During later reconstruction,
only a snapshot identity that still exists in the current committed graph can
join the redacted Atlas, Timeline, detail/media, and aggregate projection;
new `SUGGESTED`/unconfirmed candidates remain withheld. Catch-up and import
completion now await the durable Atlas read-back before reporting owner-visible
success. A failed read keeps the prior projection browseable and uses fixed
safe recovery copy rather than a raw SQLite/native error. Retry contains both
the private-record lifecycle read and its promise, emits a fixed `START` marker
when retry begins, then emits only a coarse terminal category when lifecycle or
rebuild fails; it never exposes a raw SQLite/native exception or private
record. Focused retry coverage passed 2 suites / 48 tests; full mobile Jest
passed 37 suites / 344 tests; mobile TypeScript and lint, root `npm run check`,
and `git diff --check` pass.
The Atlas recovery action is intentionally one owner task: sparse and failed
states both say `Recheck local journey history`; an internal rebuild failure is
not presented as a separate `Retry local reveal` step. Focused Atlas UI tests
(32), TypeScript, and lint pass after this wording correction.

**Shared lifecycle/import repair (2026-10-20):** Android media permission is
still allowed for images and video, but metadata import and Atlas reconstruction
both depend on the import repository's first local lifecycle read. That
repository now opens a fresh Expo SQLite native connection after a React reload,
matching reconstruction's existing handle repair; no private history is
migrated, reset, or deleted. Focused import/lifecycle/Atlas suites passed 88
tests; full mobile Jest passed 37 suites / 344 tests, TypeScript, lint, root
`npm run check`, and `git diff --check` pass. Owner confirmation that the
existing import action and Atlas recheck work remains required.

**Import/recheck contention repair (2026-10-20):** Device logs confirmed the
fresh lifecycle path reaches Atlas retry but returned the fixed `DATABASE_BUSY`
category, indicating a foreground metadata import and Atlas recheck contended
for SQLite writes. Atlas now waits for the complete owner import (including its
automatic rebuild) and local maintenance queue before rebuilding. No timing
coordination is required from the owner. Focused coordination coverage passed
85 tests; full mobile Jest passed 37 suites / 345 tests, TypeScript, lint, root
`npm run check`, and `git diff --check` pass. Device confirmation after reload
is still required.

**Metadata-import recovery (2026-10-20):** Owner feedback exposed a final
fire-and-forget failure path: a completed import's automatic rebuild could
reject without an Import-screen response. The whole import operation now emits
only fixed `START`/terminal diagnostic categories and keeps safe recovery copy
on failure. Focused import/Atlas coverage passed 86 tests; full mobile Jest
passed 37 suites / 346 tests, TypeScript, lint, root `npm run check`, and
`git diff --check` pass. Reload and one owner import tap remain required device
acceptance evidence.
**Runtime diagnostic boundary (2026-10-21):** All foreground and maintenance diagnostics now use one local structured boundary with only operation, fixed reason code, optional fixed stage, retryability, durable outcome, and a local correlation ID. Import, Atlas rebuild/catch-up/retry/durable-read, maintenance, and place-save paths use that boundary; direct production console calls are lint failures. Full mobile Jest passed 38 suites / 356 tests; TypeScript, lint, root `npm run check`, and `git diff --check` pass. This establishes safe observable states, not device acceptance: one owner-operated metadata import on the refreshed bundle remains required.

Expo Doctor remains 20/21 because of the pre-existing nine Expo SDK
patch-version recommendations. Android/iOS owner click-and-wait evidence
remains required. The earlier Android preflight had restored device `9cb47ed9`
and Metro `8085/status`; a later reload attempt found Metro stopped, and its
first restart bound IPv6-only. Metro was restarted with LAN/IPv4 binding and
now returns `packager-status:running` on 8085; ADB reverse
`tcp:8085 tcp:8085` and device connection are confirmed. No automated input is
used. Reload the current bundle and tap Retry once; that result, plus the
coarse retry diagnostic if it fails, is the required acceptance evidence.

## M4.2 manual journey entry (2026-10-19)

Owners can now add a private, explicitly owner-entered journey through a local
offline route. Schema v33 keeps it in `manual_journey`, separate from
reconstruction, evidence, visit-support, and qualification tables. The durable
Atlas/Timeline/detail projection labels it owner-entered, returns no media or
fabricated support, survives rebuild reads, and does not alter recovery counts or
diagnostics. Creation validates the durable read-back before reporting success.

**Schema-open repair (2026-10-20):** Android exposed `no such column:
date_start` when a v32 private record reached the Manual Journey path through
the reconstruction repository. That repository had opened the shared SQLite
file directly, while only the import repository applied v33 migrations. Manual
Journey operations and the durable Atlas projection now ensure the shared
schema before reading `manual_journey`; ordinary correction operations retain
their no-write current-schema startup path. Focused migration/reconciliation
tests and the full mobile suite pass (37 suites / 332 tests). Device re-open
and manual-entry confirmation remain required acceptance checks.

**Android SQLite handle repair (2026-10-20):** The next owner retry reached a
different bare `NativeDatabase.prepareAsync` Java `NullPointerException`.
The signature matches the active Expo SQLite SDK 57 Android cached-handle issue
when the React runtime restarts while its process remains alive. Reconstruction
now opens the shared local database with a fresh native connection; the
existing process-level transaction gate still serializes its writes with import.
The regression was demonstrated RED then GREEN; focused tests pass (43), and
the bounded suite passes 36 of 37 suites / 333 of 334 tests. The remaining
failure is an unrelated uncommitted reconstruction-controller diagnostic-test
change. Android retry is the required acceptance check.

The form supports an offline place result or owner label plus deliberate coarse
point, exact/approximate dates, and an explicit date-range overlap decision. Keep
separate creates a distinct assertion; Edit abandons the draft and opens the
overlapping trip's existing edit route. Atlas exposes the entry from ready,
sparse, and failed states. The full mobile suite passed 37 suites / 313 tests,
TypeScript and lint. Root `npm run check` passed. Expo Doctor remains 20/21 due to the pre-existing
nine Expo SDK patch-version recommendations. Android and iOS create/cancel/
overlap/reopen/rescan/context-return checks remain required device acceptance.

## MapLibre vector-basemap integration (2026-10-18)

Atlas now has an opt-in MapLibre v11 surface backed by a configured MapTiler
vector-style URL. It renders provider-maintained political boundaries and
progressive place labels, while Travel Life supplies only the already-coarsened
private journey GeoJSON and selection state. No provider key, demo URL, public
place-label list, or second map dependency is embedded. The new
`EXPO_PUBLIC_ATLAS_MAP_STYLE_URL` is intentionally blank in `.env.example`;
without a valid HTTPS MapTiler style, or after a style-load failure, Atlas gives
an honest Timeline recovery instead of displaying the legacy hard-coded map.

Focused Atlas coverage (25 tests), full mobile tests (34 suites / 299 tests),
TypeScript, lint, root `npm run check`, and `git diff --check` pass. This is not
device or provider acceptance: an owner-controlled non-demo MapTiler style/key
must be configured and then Android/iOS must verify native pinch/pan, labels,
marker selection, failure recovery, and the provider-request disclosure. Vector
provider detail uses standard map projection rather than claiming the prior
Winkel Tripel visual plane.

**Local Android configuration update (2026-10-18):** The owner supplied a
publishable MapTiler key. It is stored only in ignored `apps/mobile/.env` with
the current `streets-v4-dark` style; the key is not committed. A host-network
style request returned HTTP 200 with a valid style JSON, sources and layers.
Metro was restarted, USB port forwarding reapplied, and the already-installed
Travel Life development client was re-opened on its Atlas route. The filtered
app log contains no new fatal/native/JavaScript failure. This proves local
configuration and startup only, not visual cartography, marker selection, or
physical pinch/pan acceptance; those remain an owner device check.

**Global label follow-up (2026-10-18):** The owner reports that province/city/locality
names remain absent when zooming into China, Mongolia, and other countries, while
Vietnam appears acceptable. Live MapTiler Streets Dark and Outdoor style metadata
both include subdivision labels but stop their state-label layers at zoom 11.
The actual device style/zoom, feature coverage, glyph loading and label collisions
are not yet distinguished. Keep this owner-visible mismatch open; compare matched
viewports across the provider viewer and native app before changing styles.
ADB can reach the owner's Android device, but the latest capture was of Welcome;
Android rejected simulated touch input and a deep link was followed by the lock
screen. Atlas itself has not yet been visually inspected in this diagnostic pass.
The owner need only unlock the phone and leave Atlas showing an affected country;
no ChatGPT image upload is required. No map code or style was changed.

**Global style/data review (2026-10-19):** Live Planet v4 vector-tile samples
at capital locations in 19 countries across six inhabited continents contain
subdivision data, but the configured Streets Dark z7–9 subdivision-label filter
rejects all sampled features in Mongolia, Turkey, Germany, Spain, Egypt, South
Africa, India, Japan, and Australia. Its state-label layers stop at z11 despite
deeper source data. Outdoor v4 repeats the z7–9 filter and also stops state
labels at z11; merely switching to Outdoor is not a verified solution. This is
a confirmed global style/data-schema mismatch for subdivision names, not proof
that city/town glyphs or rendering also fail. The device was locked during this
pass, so same-viewport native acceptance remains open. No map code/style changed.
The same Streets Dark style keeps subdivision borders after labels stop, hides
regular city names at z14 and town/capital names at z16 (the app's maximum
camera zoom), and excludes the tileset's `village` places altogether. Progressive
global naming therefore needs an explicit cross-scale style contract, not only
more zoom range or a default-style swap.

**Android follow-up (2026-10-19):** The owner unlocked the device. Its development
client was at Expo Dev Launcher because Metro was no longer running; Metro and
the ADB reverse route were restored, and Atlas now visibly renders MapLibre.
The captured public map viewport was Québec, not the requested Mongolia; town
names appeared there while subdivision names did not at that high zoom. Scoped
resource logs showed no matching tile/glyph/style errors, which does not prove
every label loads. Mongolia remains unverified on-device. Its sampled Planet v4
subdivision tiles have English names but primary local names containing Mongolian
script, while the current fontstack's requested glyph range lacks U+1800–U+18AF.
This adds a language/font fallback risk to the confirmed zoom/filter defect.
MapTiler Countries `level=1` looks structurally useful but sampled Kenya features
include obsolete province names; it must not be adopted without freshness checks.
No app code or style changed in this diagnostic pass.

**Proposed correction, not implemented:** Keep MapLibre and the configured Planet
v4 vector source. Create an owner-controlled MapTiler style variant that selects
primary subdivisions by data-backed ISO 3166-2 where present, then introduces
finer administrative labels at appropriate zooms without showing every level at
once. Keep city/town context through the app's maximum zoom, add a tested village
band, and use a script-supported language fallback (`name:en` before local `name`
where needed, with verified glyph coverage). Tune density, priority and muted
colors against the accepted Obsidian reference; do not solve omissions by making
all borders/labels heavy. Gate rollout on source/style checks across representative
countries, current administrative-unit checks (including Vietnam and Kenya), and
matched Android/iOS screenshots at world, country and local zoom. A same-viewport
Mongolia device capture remains required before the native symptom is closed.

## Readable cartography and exploration plan (2026-10-18)

Owner accepts the overall map but requests stronger country/province boundaries,
geographic names and Google Maps-inspired behavior. BMAD party/spec produced the
[cartographic exploration contract](../_bmad-output/specs/spec-atlas-cartographic-exploration/SPEC.md):
independent vector boundary and dynamic-label layers over approved Obsidian
relief, progressive detail, real visible journey clusters and familiar 2D gestures.
This is planning only; no app behavior or device result is claimed.

Code/data audit found raster-baked Admin0 borders, only seven base labels, no
Admin1 display layer, and 63 Vietnam regions in the existing destination catalog.
The official post-July-2025 catalog has 34 provincial units. Current UI geometry
freshness/licensing must be verified separately, without rewriting historical
journey/correction data. Five delivery gates and 24 acceptance cases cover source
truth, offline renderer feasibility, readability, context and Android/iOS evidence.
Next authorized build should begin with G0/G1, not another image-resolution patch
or an implicit Google SDK/provider migration.

Planning verification: five paired capabilities, 24 unique acceptance cases, five
gates and seven companion paths validated; whitespace/template checks,
`git diff --check` and root `npm run check` pass (20 foundation tests plus eval
infrastructure smoke). This does not establish native rendering or UX acceptance.

## Zoom-resolution repair (2026-10-18)

The owner reported pixelation after country-level zoom was enabled. The mobile map now overlays visible 512px geographic tiles selected by scale/display density from 4096/8192/16384 world levels. These tiles are freshly projected from the original 10800x5400 Natural Earth relief and country geometry; the 2048px world base is not upscaled to manufacture detail. The 840 WebP tiles total 3,666,258 bytes. The selector culls offscreen tiles and caps active tiles at 48; detail images disable cache accumulation and failed tile decodes retain the base beneath them. Coordinate projection, gestures and small journey overlays are unchanged.

`scripts/check-atlas-tiles.py` verified all 840 hashes/dimensions/asset registry entries and created an ignored public Vietnam before/after comparison. The comparison was visually inspected: coastline/border/relief detail is visibly improved. Root checks, focused tile/map/Atlas tests and mobile focused lint pass; native rendering/memory/frame-time measurements remain separate device gates. This adds resolution to geographic relief/borders, not roads or new location precision.

Final verification: 35 focused tests pass (including visible detail mounts and decode-failure fallback), mobile TypeScript and focused lint pass, root `npm run check` passes. The active Android route bundle returns HTTP 200 and contains `visibleAtlasTiles` plus the Vietnam 16K tile; it contains no screenshot import. ADB delivered the development-client intent to the connected Android app. Physical sharpness and performance still require owner/device observation; intent delivery alone is not that observation.

## Country-level point exploration (2026-10-18)

Owner confirmed panning works but requested deeper zoom for Vietnam journeys. Raised shared pinch/button ceiling from 4x to 64x world fit, with a faster 1.6x button step. Nearby journey choice now depends on 24 logical units of projected screen distance instead of a fixed one-degree geographic bucket, so nearby destinations separate during zoom. Existing coarse anchor precision is retained; zoom does not invent precise locations. Background remains the bundled world raster and becomes softer at deep zoom; streets, city labels and multiresolution cartographic detail are not delivered by this change.

## Continuous trip gallery scroll implementation (2026-10-18)

The owner confirms the destination fix works on device and requests planning for
Photos and videos as one scrollable album. Code inspection confirms Load more
clears/replaces `GalleryPage`, and item view conditionally unmounts the list.
The [gallery scroll contract](../_bmad-output/specs/spec-trip-gallery-continuous-scroll/SPEC.md)
now has an implementation: each 60-item repository batch appends to the same
virtualized local grid, with a Load more/retry footer instead of page replacement.
Earlier media stays available on retry; the selected-media view overlays the grid,
so Back keeps the same album instance. The session key is journey plus snapshot,
not the loader callback, so ordinary parent rerenders do not restart browsing.
Focused isolated gallery tests pass for appending, retained prior items after failure,
retrying the same page, and Back to the retained grid. The physical Android scroll
experience still needs owner confirmation. Broader mobile checks are currently
blocked by unrelated concurrent Atlas work importing a missing `atlas/tile-assets`
module; that work was not changed by this gallery repair.


## Real cartographic base replaces the screenshot (2026-10-18)

The active native Atlas now renders generated Natural Earth 50m country geometry and Natural Earth II shaded relief through Winkel Tripel. The generator never reads the supplied UI screenshot. `world-projection.ts` projects journey anchors through the same equation/scale/dimensions as the generated image. The background contains no application controls, routes, destination card or trip dots. Small selectable overlays retain their screen size; full-world fit, pinch and bounded pan use the measured viewport. Source hashes/license and pinned regeneration instructions accompany the assets. High-resolution PNG is approximately 867 KiB with a local low-resolution decode fallback.

34 focused map/Atlas/owner-flow tests pass; mobile TypeScript and focused lint pass; root checks pass. The previously missing destination-data JSON now exists in the independently updated checkout and owner-flow tests load. The verified Android route bundle (src/app router root, port 8081) contains the generated map and shared projection and no screenshot import. Device deep-link delivery was performed; owner physical pinch/selection and exact visual acceptance remain pending. The generated artwork has real land relief and a dark ocean, but reference ocean-current/detail/lighting fidelity remains unaccepted. Prototype assets were generated identically; prototype integration has not been changed in this repair.

## Destination naming integrated and Android client refreshed (2026-10-18)

The user requested loading the tested destination-label fix onto the connected
Android device. The fix was integrated narrowly into this current schema-31/V1.1
checkout rather than loading the older isolated-worktree baseline. The newer
qualification, Home settings, correction and Atlas work is preserved. A compact
bundled Natural Earth country/region resolver and committed visit-support label
query now provide names such as `Bali, Indonesia` to qualified Atlas trips and
selected trip details. Owner detail titles retain precedence. Existing trip
labels derive at read time; a metadata reimport is not required to test naming.

Current-checkout verification passed 31 mobile suites / 280 tests, TypeScript,
lint, foundation `npm run check` and whitespace checks. The connected development
client was launched successfully through the installed Expo CLI's generated URL
on port 8081. Its process is running and Metro reports an active React Native
Bridgeless connection from the physical Xiaomi device. Filtered current-process
logs showed no matching startup error. These verify delivery/startup; the owner
must still inspect the September 2025 Bali trip and other destinations. No
private database was copied, reset or reimported during this load. Persisted
country statistics can still require the normal rebuild for the new dataset
version; no automatic private rebuild was triggered here.


## Atlas interaction repair planning (2026-10-18)

Earlier broader verification blocker: the active country resolver briefly referenced the not-yet-generated `natural-earth-destinations-5.1.1.json` during destination-data integration. The destination task subsequently generated that asset, passed all 280 current mobile tests and refreshed the physical Android client's JavaScript connection. The missing-dependency blocker is resolved; map interaction and destination correctness still require owner acceptance on device.

Implementation update: the active mobile checkout now uses `local-atlas-map.tsx` and pure viewport math. Full-world fit, touch-distance pinch, drag bounds, shared button scale, fixed-size marker visuals and local viewport correction context are implemented. Focused tests pass 27 cases, mobile TypeScript/focused lint and root foundation checks pass. The verified active Metro is port 8081; ADB forwarding and the development-client deep link reached the connected Android app. Actual native pinch/pan acceptance is pending. The screenshot remains the temporary artwork with embedded decorative UI; real cartographic registration is not claimed. The implementation uses explicit React Native touch/responder math with tested finger transitions; the planned Gesture Handler/Reanimated migration and performance profiling have not been performed.

Owner confirms the reference image is visible and buttons work, but pinch zoom is absent and minimum zoom does not show the whole world. Code inspection confirms translation-only gestures, cover-cropped image fitting, and camera/reset coupling to MapLibre zoom. The [repair plan](../_bmad-output/implementation-artifacts/atlas-map-interaction-repair-plan.md) defines measured full-world fit, simultaneous focal pinch/pan, one viewport state, constant-size selectable markers and actual device gates. The full UI screenshot remains a temporary visual preview with baked decorative controls/dots; clean cartography and proper geographic registration are still required. This party task changed planning/error records only; interaction implementation remains open.

Updated: 2026-10-17 (Asia/Bangkok).

## Atlas recovery retains last committed photos

The Android development bundle is now running again. The observed recovery
screen retained seven locally committed journeys, but a failed rebuild made
their durable Atlas projection non-explorable, which looked like the owner's
photos had disappeared. The Atlas now keeps that committed map, journey list
and photo/video grid available during `failed` recovery, while clearly stating
that the next rebuild did not complete. Focused Atlas verification passed
(22 tests). The cause of the underlying local rebuild failure is not present in
the app-process log and remains under device diagnosis; no private evidence was
read, deleted or exported. Physical reload acceptance is pending.

## Android civil-day continuity correction awaiting device acceptance

The owner rebuilt the private Android record and still observed two September
2025 entries, three April 2024 entries and two February 2022 entries for three
known continuous holidays. The canonical V1.1 builder was still treating
Android creation timestamps as exact instants despite `hasPreciseOffset: false`,
then partitioning every civil-day observation into a separate episode.

The correction now groups compatible mixed-precision observations by civil day,
preserves their uncertain internal order, and uses the existing ten-day
continuation only when both blocks independently measure away from a learned or
owner-configured home context. Repository normalization now carries graph place
IDs (not visit IDs) and computed home distance into that decision. Host
verification: 265 mobile tests, TypeScript and lint pass; Expo Doctor retains
the pre-existing missing iOS icon and nine Expo SDK patch-version warnings.
Physical rebuild acceptance is still required; no private evidence was exported
or added to the repository.

## Named private Home bases implemented awaiting device acceptance

Schema v31 adds an owner-entered local label and origin to each configured Home
base. Existing v30 rows remain active with a null label and display as
`Unnamed home base`; the app does not infer a locality from their coordinates.
The Home bases screen now requires a label for a new observed-area choice and
lists independently named bases with date/radius scope, rename and confirmed
remove actions. These labels never reach reconstruction inputs; only existing
private coordinate, radius and date context affect trip handling. Focused
regressions cover v30 migration, private label CRUD and the journey-review save
flow. Independent review also corrected stale journey-preview publication,
rebuild-status messaging, malformed Home-context validation and explicit
non-capture provenance preservation. Host verification passed: 29 mobile test
suites / 270 tests, TypeScript, lint, the foundation check and whitespace
check. Physical Android acceptance is still required; no private evidence was
exported or added to the repository.

## Atlas reference-direction refinement

The owner supplied a world-map interface reference and clarified that it is the
direct UI target for Travel Life's map: full-bleed dark world geography, upper
search/navigation treatment, compact floating controls, side filter stack,
zoom/orientation control and one selected-place card. The owner then supplied the
**Obsidian Horizon / Deep Sea Glass** visual brief, which is now the authorized
Atlas-only palette, glass, typography and motion extension. Decision 0012, the
Living Atlas design system and the dimensional-Atlas contract require an original
Travel Life implementation of that interface. Its content remains private and
evidence-aware: local-only journey/place search, Map/Timeline, year/evidence
filters, correction and Replay replace public planning, routes, generic map modes
and unqualified visit claims. Implementation remains pending the delivery work,
including existing device/provider gates.

## Continuity and photo-backed Home setup specification

The requested BMAD party refinement is recorded in
[Continuous holidays and Home setup](../_bmad-output/specs/spec-trip-continuity-and-home-setup/SPEC.md),
with engine, Home experience, development-plan and acceptance companions. It
requires actual boundary diagnostics for the three reported 4/2/2 fragment
groups, canonical episodes as the active publication authority, and explicit
area selection with a scoped photo/video preview before Home save. Home
management and candidate areas are independent of qualified journeys; durable
context revisions, queued rebuilds and progress prevent false completion.
The plan preserves the canonical gap policy; if private diagnosis identifies
a longer-gap policy mismatch, a tested versioned amendment is required before
activation. New 20 km home scope and legacy-radius preservation are explicit
planning defaults. This update changes specifications only. Private diagnosis,
implementation, regional-data acquisition and device acceptance remain pending;
`product_quality: not_measured`.

The first implementation slice now makes canonical V1.1 episode grouping the
active source for unreviewed persisted/displayed journeys, rather than retaining
it as diagnostics only. It keeps mixed precise/day-only evidence deterministic,
does not turn a lone configured-home point into a return boundary, and preserves
reviewed journey projections. A focused synthetic regression covers same-day
mixed precision/revisits and a corroborated home-return split. Home setup now
opens the selected journey's local details/photos before saving, requires an
explicit observed-area choice and saves that choice at a new visible 20 km scope
instead of selecting the journey's first visit. Focused 91 mobile tests, typecheck
and lint passed. This is not private-library verification: the April/September/
February boundaries, complete C0/C1 context, native metadata, generation lineage,
offline regional naming and device acceptance remain pending.

## Home context and continuity requirements clarified

The integrated continuous-trips delivery record now specifies the current two
inconsistent home heuristics, shared temporal context, episode boundaries,
generation-bound diagnostics, naming, migration and an explicit regression/release
matrix. Qualification selects the most frequent non-candidate twelve-day place;
merging considers all twelve-day places, including holiday destinations, across
all history. This can make a trip its own base. The exact private September cause
remains unverified. The canonical 72-hour automatic-link / ten-day uncertain-link
policy must be tested explicitly; implementing it alone cannot guarantee merging
a pair with longer ambiguous gaps. This update is requirements planning only.

## PM/analyst investigation: island labels and repeated trip fragments

Direct local execution reproduced an offline resolver coverage defect: synthetic
Ubud returns border, Denpasar/Kuta unresolved, Jakarta IDN. The current country
geometry/edge rule cannot reliably label those island locations and supplies no
regional names. Prior suggestions that the owner's metadata was defective were
not verified. The exact private-run split reason is still unknown; the active
path remains V1 grouping plus a global-base continuity patch, not the canonical
episode pipeline. The existing [integrated delivery record](../_bmad-output/planning-artifacts/continuous-trips-and-album-experience-2026-10-16.md)
now includes the reproducible findings, region/country naming separation,
episode integration requirements, local decision diagnostics and an acceptance
extension. Investigation only: no new runtime changes or private-device accuracy
claim. EP-071 records the incident and outstanding verification.

The first engine correction after that investigation now treats a fragment with
GPS-less associated media as an away fragment when its known geotagged support is
far from every frequent base. It no longer treats a missing coordinate as a home
return and can join adjacent supported Bali-city fragments within the existing
ten-day continuity window. A focused repository regression and TypeScript pass;
private-device confirmation remains pending. Detailed offline Admin-1 geometry
for the visible Bali label is blocked until the public boundary archive can be
acquired through the approval service; no hardcoded location exception was added.

The owner then confirmed that the rebuilt September run still split. A further
continuity defect was fixed: a frequently observed base now uses coordinate-bearing
support from that place rather than its deterministic representative, which can be
GPS-less. This preserves a valid base measurement for automatic multi-city joining;
the added regression simulates that exact condition. It does not fabricate Bali's
regional label, and device rebuild remains the required private acceptance check.

## Continuous trips, immediate preview and album grid (2026-10-16)

The owner requires a continuous multi-city holiday to appear as one trip, concise
location/month summaries (for example Taiwan / October 2025), a preview immediately
visible from either map or list selection, and a full-screen photo/video grid.
The BMAD party's [integrated delivery plan](../_bmad-output/planning-artifacts/continuous-trips-and-album-experience-2026-10-16.md)
specifies episode-first grouping, country naming independent of boundaries,
viewport-level preview, album/viewer return context, correction-safe persistence
and 20 acceptance scenarios. Existing V1.1 exact continuity predicates remain
authoritative; matching country/month alone cannot merge distinct holidays.
Code inspection confirms inline/off-screen preview and row-based gallery causes.
The recovery qualification adapter also substitutes global base/photo-count/date
heuristics for canonical V1.1 predicates; those shortcuts remain to be replaced.
This turn records the complete recommendation; application changes and private
Taiwan-example evaluation have not been performed.

## Automatic trip recognition planning (2026-10-16)

The owner's follow-up rejected partial readiness. The party has now derived the
[canonical V1.1 implementation contract](../_bmad-output/specs/spec-trip-detection-engine-v1-1/SPEC.md)
with six capabilities, five technical companions and 64 acceptance cases. It
selects exact temporal base/routine/session and episode rules, the original score
plus two hard-gated recognition profiles, a local-only native metadata bridge,
generation-based persistence/correction/query contracts, dry-run activation and
rollback. The one-session score45 source case is explicitly a nonpublished
suggestion awaiting corroboration, resolving the source gate contradiction.
Strict automatic bases require separated residence periods; otherwise one era
setup question replaces per-trip confirmation. These are visible planning defaults
and explicit source-policy refinements, not measured quality or a live migration.
The earlier proposal below is exploratory rationale; implementation consumes the
canonical contract. No application behavior has changed in this planning task.

The owner reports too many inferred trips in the primary UI and wants trustworthy
automatic recognition with very few review/confirmation actions. The BMAD party's
[engine improvement proposal](../_bmad-output/planning-artifacts/trip-detection-engine-improvement-plan-2026-10-16.md)
identifies draft-to-Atlas publication, absent base/routine qualification and native
metadata limitations in current code. It proposes temporal bases/routines, episode
recognition, independent evidence gates, qualified queries shared by Atlas/counts/
replay, correction-safe identity and recoverable shadow migration. Automatic base
learning and evidence-profile classification are explicit proposed refinements
to the pasted V1.1 contract; the exact score policy remains a comparison baseline.
No UI implementation, legacy reprocessing or product-quality claim is produced by
this planning record. Next delivery implements the specified native normalization,
pure engine, persistence and complete automatic-reveal integration, followed by
owner-authorized local evaluation and separately approved legacy activation.

## Automatic trip recognition guarded delivery (2026-10-16)

The first guarded V1.1 delivery slice adds an additive pure qualification seam,
private schema v29 qualification rows, and one primary-query predicate shared by
durable reveal and journey counts. Existing V1 inferred rows are backfilled or
rebuilt as private suggestions; only exact owner-confirmed rows are primary-visible
until the complete V1.1 base/routine/native-context pipeline can qualify automatic
trips. This deliberately removes draft noise rather than falsely promoting it.
Focused reconstruction, repository, import-migration and Atlas suites passed
97 tests; mobile TypeScript and root `npm run check` passed. The sandboxed Jest
cache cannot write atomically; the focused suite was rerun on the host. Native
metadata bridge, temporal bases/routines, automatic profile publication, all 64
cases, device checks, and labeled quality evaluation remain unfinished;
`product_quality: not_measured`.

The first device test exposed zero automatic recall, so the owner-confirmed-only
bridge was replaced for future rebuilds by a deterministic local-graph adapter.
It requires a distinct 12-day base, conservative 50 km distance, five eligible
photos and independent support before an inferred graph journey can pass the
V1.1 score path. This is a recovery from the empty-map regression, not a claim
that the full native/context engine or device quality evaluation is complete.

The additive pure gate was further hardened to count only explicitly
capture-like evidence, require actual normalized 4-hour/24-hour spans for the
DAY/STAY profiles, and fail closed for critical conflicts, owner vetoes and
suspected routine context. Focused host reconstruction tests passed 41/41; the
complete mobile suite passed 29 suites / 254 tests with TypeScript and lint, and
the root framework/evaluation checks passed. These are synthetic contract checks:
`product_quality: not_measured`. The canonical date-scoped native normalization,
base/routine/episode pipeline, generation model, 64-case suite, dry run and
private labeled/device evidence are still outstanding.

The qualification boundary now also has a pure date-scoped owner-home-area
normalizer that accepts multiple authoritative local areas (for example, a
Sa Dec period followed by Ho Chi Minh City). It marks only evidence with a
valid local date and coordinate inside an active configured area; that evidence
cannot promote an automatic trip and remains local return context. A synthetic
regression covers both date ranges and confirms the areas are not averaged.
Durable owner-home-area storage, owner editing UI, and repository wiring into
new imports are still not implemented, so this is a tested detector seam rather
than an owner-operable feature. The focused V1.1 suite passed 4 suites / 107
tests, the complete mobile suite passed 29 suites / 256 tests with TypeScript
and lint; Expo Doctor still reports the pre-existing missing iOS icon and nine
SDK patch-version recommendations. Root checks and whitespace validation passed;
`product_quality: not_measured`.

The owner-operable slice now persists date-scoped Home bases in the private
SQLite record and applies them before automatic qualification and continuity
merging. Home-base evidence is excluded from automatic journey membership,
while still providing local return context. The persistent Atlas header opens
Home bases directly. Saving a selected journey now immediately acknowledges
the action, prevents duplicate taps while its private rebuild runs, and reports
either that Atlas is ready or that the configuration saved but the rebuild needs
attention. The focused Home bases/provider regressions (14 tests) and mobile
TypeScript check passed, and the connected Android app was reloaded. Device
confirmation of the private library result remains pending; `product_quality:
not_measured`.

## Dimensional Atlas development plan (2026-10-15)

The owner accepted vibrant, professional 3D visual polish through color,
perspective, markers, cards and responsive motion, explicitly excluding terrain
and mountains/valleys. The journey list must be simple, minimal, intuitive and
uncluttered. [Decision 0012](decisions/0012-dimensional-atlas-and-minimal-list.md)
records that direction. The [spec and development plan](../_bmad-output/specs/spec-atlas-dimensional-polish/SPEC.md)
now define the Atlas-only Obsidian Horizon / Deep Sea Glass extension, four
capabilities, five ordered work packages and 20 acceptance scenarios.
This task changes planning documents only; implementation and device evidence are
pending. Next work starts with installed MapLibre API/style feasibility, then
dimensional styling, bounded safe row summaries/list layout, camera/context
integration and verification. Production basemap selection remains unresolved.

## Atlas map/list refinement (2026-10-15)

The private Atlas now leads with a compact header, inferred-record summary,
Map/Timeline and year controls, then a larger MapLibre surface and flat journey
rows rather than a nested scroll panel. Ordinary anchors are quiet while the
current selection is citrus/ring styled; coincident map hits require an explicit
choice. The selected local preview is rendered over the map (or through the
same Timeline fallback), preserves the redacted opaque selection boundary, and
suppresses stale preview publications. Coverage and tile-request disclosure are
available through the labelled About control. The focused Atlas suite passed 14
tests and mobile TypeScript passed. Native hit-testing, camera gesture fidelity,
safe-area/large-text behavior, and full paged-gallery/correction-successor
validation remain unverified; the existing bounded preview viewer is not proof
of a complete device media flow.

## M4.1b owner title and date claims (2026-10-14)

Owners can now save a private journey title plus either an exact day or an
ordered approximate interval. Schema v20 records these as immutable `claim`
revisions, separate from the observed span and existing confirm/reject
semantics. A claim follows only an exact full-support successor during a
rebuild; a missing, split, or duplicated mapping preserves the last complete
projection and enters pending remap. The claim does not alter evidence,
membership, place/country aggregates, routes, or sharing. The focused mobile
suites passed 5 suites / 55 tests, and mobile TypeScript, Expo lint, and root
`npm run check` passed. The React 19.2-compatible test renderer and awaited
RNTL v14 test interactions resolved EP-011; the full mobile suite passed 27
suites / 213 tests with no console diagnostics. Device SQLite migration and
native owner-input behavior remain unverified.

## M4.1a successor-identity repair (2026-10-14)

M4.1 remains in progress and is now explicitly staged as an epic-sized correction
capability. The confirm/reject foundation persists immutable review revisions and
rebuilds atomically. Schema v18 distinguishes a confirmation applied to a rebuilt
successor journey from a rejection applied as a durable `grouping-constraint` with
no generated journey target. This prevents a rejection from being recorded against
the predecessor journey that the corrected projection removes. The focused mobile
suite passed 4 suites / 73 tests, including the new rejection-application and
migration assertions. TypeScript, Expo lint, and the root foundation checks also
passed; device SQLite migration remains unverified. The broader M4.1 owner-edit, split/merge,
duplicate-family, and pending-remap-resolution work remains outside M4.1a.

## Mandatory error learning (2026-10-13)

The owner requested strict recording and reuse of agent mistakes. `AGENTS.md` now
requires relevant playbook checks before work, same-task incident recording,
verified corrections, explicit unresolved status, and stronger safeguards for
recurrences. `docs/development/error-playbook.md` holds the index, template, and
observed lessons. This provides persistent procedural learning across sessions;
it does not change model weights. Future work must apply relevant lessons and
record newly discovered failures before completion.

## Current stage and user direction

On 2026-10-09 the owner made the agreed Living Atlas prototype direction the
official design system for **all Travel Life UI/UX**. Use
[the canonical system](product/design-system.md) for new mobile, browser, replay,
and sharing work; [decision 0010](decisions/0010-living-atlas-design-system.md)
records the scope. The implemented six-color prototype palette and interaction
language are accepted. The extra geographic colors in the earlier map design
proposal are not official tokens. Next UI delivery should apply this reference
within its story, then validate the specific screen on target devices/browsers;
the synthetic prototype alone does not establish production usability.
Documentation verification on 2026-10-09: changed local links resolved,
`git diff --check` passed, and root `npm run check` passed (framework integrity,
20 foundation tests, and evaluation smoke). No UI code or device behavior changed
in this decision-recording pass.

Later on 2026-10-09, the owner clarified that **all agreed prototype screens**
are the official product UI targets, including the beach/lake video Welcome.
[Decision 0011](decisions/0011-prototype-screens-as-product-ui.md) and the
[design system's screen map](product/design-system.md#official-screen-set)
record the full set and its real-product boundaries. The current `apps/mobile`
Trust → Import → empty Atlas implementation remains a foundation; these screen
targets and the Welcome montage have not yet been integrated there. Next UI
stories should use the map to carry each design into production with actual
permission, import, correction, replay, and sharing behavior.
Documentation links resolved, `git diff --check` exited successfully, and the
root `npm run check` passed (framework integrity, 20 foundation tests, eval
smoke). No production UI integration or device validation is claimed here.

MLP planning for delivery. On 2026-10-07 the user explicitly replaced Minimum
Viable Product with **Minimum Lovable Product (MLP)** as the first-release goal.
Decision 0009 defines that release as a private lifetime interactive map reveal,
replay video and owner-selected sharing experience. The user previously removed pre-launch market research/
interviews as prerequisites: build from available knowledge and collect hypothesis
evidence through rollout. The user selected **both iOS and Android** for first testers.

On 2026-10-07 the user selected permission-based broad photo-library access as
the primary import experience; selected-photo import is an alternative for users
who do not want to grant broad access. See decision 0003. The existing native
implementation default remains; no browser-only switch was requested.

This revision updated planning and recorded implementation defaults. No app code,
provider call, private data collection, remote deployment or signed build exists yet.
No remote, paid plan or credentials were configured.

Validation on 2026-10-07 after recording the import decision: `npm run check`
passed framework integrity, all 20 foundation tests and evaluation-infrastructure
smoke checks. These checks do not verify device photo access or reconstruction quality.
After the photo-rule revision, `npm run check` passed again: 44 pinned skills/four
runtime trees, 20 foundation tests and eval smoke checks. Planning consistency checks
found 27 unique stories, 81 unique acceptance criteria and no broken local links in
the seven changed planning/decision documents. Product accuracy remains unmeasured.
After fixing reconstruction v1 parameters, `npm run check` passed again (44 pinned
skills/four runtime trees, 20 foundation tests and eval smoke). Document checks found
27 unique stories, 81 unique acceptance criteria, no broken links across 11 changed
planning/decision/instruction documents, and all required parameter values present.
These checks validate planning consistency and tooling, not engine behavior or accuracy.

## Established direction

- Mobile travel-history reconstruction from existing evidence, followed by a private
  lifetime map reveal, replay, durable correction and selected-highlight sharing.
- The first product goal is MLP as specified by decision 0009; no discovery-first
  Epic 1 or G0 demand gate.
- One native photo source per platform, with honest coverage and inferred-status labels.
- Broad library access is the primary path; limited/selected-photo access remains optional.
- Background maintenance is required in the first product on both platforms, with foreground
  catch-up and preserved corrections. See decision 0004.
- AI assistance has bounded scope and explicit processing opt-in.
- Keep original media at its source; the derived local record is sensitive.
- Use small engine regressions during delivery and expand real-case evals after rollout.
- Keep photo-to-journey membership distinct from visit support and reviewed facts;
  owner trip boundaries and corrections constrain inference. See decision 0006.

## Foundation delivered

- BMAD 6.12.1 core + method, 29 project-local skills.
- Six ECC 2.2.3 skills and nine evals-skills at the recorded pins.
- Workflow, trace contracts, integrity checks, 20 foundation tests and CI definition.
  See docs/development/setup-verification.md for setup evidence.

## Active planning

- Revision 7: five delivery epics, 27 stories (25 P0, two P1), M-prefixed IDs.
- Canonical backlog: _bmad-output/planning-artifacts/epics.md.
- Working decisions: _bmad-output/planning-artifacts/mvp-spec.md and
  docs/decisions/0002-mvp-first-delivery.md through
  0009-mlp-lifetime-reveal-and-replay.md.
- Shared Expo / React Native / TypeScript, SQLite, bounded OpenAI suggestions via
  a protected Supabase proxy, native map component: agent-selected defaults.
- Interactive browser viewer/published journey or lifetime-highlight snapshots and
  the private replay video are required; selected remote media derivatives are an
  explicit publishing exception to local storage.
- MLP scope is clear. The BMAD build workflow remains paused until an initial clean
  repository baseline is recorded; beta release checks remain pending.
- The earlier 13-epic/49-story proposal is preserved under
  _bmad-output/planning-artifacts/history/2026-10-06-discovery-first/
  and is not the active plan.

## Accepted decisions versus assumptions

Accepted from the user: MLP is the current goal, including its map/replay/selected-share
first loop, no pre-launch research programme, both platforms. The earlier MVP-first
wording is superseded by decisions 0008 and 0009.
Broad library access by default, with selected-photo access as an alternative,
is also user-selected (decision 0003). Background maintenance is user-selected
(decision 0004). Interactive journey-link sharing is required (decision 0005);
decision 0009 promotes the lifetime replay and selected lifetime-highlight sharing
into the MLP core, while the static card stays optional.
The user also accepted the reviewed photo-to-trip rule changes on 2026-10-07;
decision 0006 and MVP spec revision 6 record the behavior. Exact cluster ties and
bounded episode/association windows were fixed by decision 0007 before coding;
M2.1 implements `reconstruction-v1` and M2.4 verifies its boundary examples.
The numeric values and deterministic tie-break are agent-selected starting defaults,
not observed product-performance thresholds.
Starting assumptions/defaults: frequent leisure travellers, English UI, one native
photo source, trip/place heuristics, stack/model/backend, local storage and optional AI.
These are selected to enable implementation, not validated product facts.
See decision 0002 for rationale, source references and operational limits.

## Resolve inside delivery

Native access parity, dependency pins, actual device behavior, signing accounts,
map/provider configuration, source-access distribution rules and model performance
are engineering tasks in M1–M5. Service setup and publication follow actual execution
authorization; no repeated approval is needed for an already authorized step.
Demand, correction burden, usefulness, sharing and retention are rollout hypotheses,
not prerequisites for starting the app.

## Reconstruction rule decision (2026-10-07)

The user requested a second review and then directed us to change the spec according
to its proposal. The historical critique and findings are saved under
_bmad-output/planning-artifacts/reviews/. The MVP-named spec revision 7 and decision 0006 now
separate photo membership from visit support, places from visit episodes, and reviewed
facts from new inferred additions. The spec includes a small behavior decision table;
Decision 0007 now records exact bounded window/tie parameters; the related story
criteria and eval roadmap are aligned. This adds no research gate and no app
implementation began.

## Interactive prototype delivery (2026-10-07)

An isolated `apps/prototype/` Expo Router prototype now provides a synthetic-only,
local-state walkthrough of welcome, a clearly labelled simulated broad-library or
selected-photo access choice, simulated import, private map/list reveal,
year and journey selection, session-only correction, replay preview/cancellation,
selected-highlight preview, and sparse/declined examples. It contains no real
evidence, account, permission request, network call, persistence, map provider,
backend, rendered video, export, or published link.

The access screen explains that local app storage needs no operating-system permission,
while Google Photos is not connected or scanned in the MLP flow. The access UI remains
a prototype interaction only; native permission behavior is still unimplemented.

Observed checks passed: fifteen prototype flow/model/UI tests, TypeScript, Expo lint, and
Expo Doctor (21/21). Root `npm run check` also passed with framework integrity, 20
foundation tests, and eval smoke checks. Physical iOS/Android walkthroughs remain
pending. The prototype does not validate reconstruction accuracy, production privacy
controls, native source access, map providers, video rendering/export, persistence,
or backend/share services.

## Next work

On Android, capture consented GPS and cloud/unavailable observations, then validate
M1.4's disconnect and confirmed/cancelled local-deletion controls in a rebuilt
development client. Perform the equivalent iOS verification on macOS. Record aggregate
observations only. After that device evidence, hand off to M1.5 for scheduled library
maintenance without claiming an OS timing guarantee.

## Living Atlas prototype redesign (2026-10-07)

The isolated `apps/prototype/` owner flow now uses a responsive dark Living Atlas
system across every route. The reveal keeps a dependency-free contour atlas dominant,
adds Map/Timeline and snapping year controls, synchronizes selection with an accessible
expandable list, and uses three generated fictional landscape crops stored locally under
`apps/prototype/assets/synthetic/`. Replay remains cancellable and explicitly renders or
exports nothing. Reduced-motion preference is observed; the optional tactile adapter is
silent because no native haptics dependency was added.

Observed checks passed after the redesign: 22 prototype tests, TypeScript, Expo lint,
Expo Doctor, and the root foundation `npm run check` (44 pinned skills/four runtime
trees, 20 foundation tests, and eval smoke). Jest component coverage reported 90.26%
lines, 76.33% statements, 67.95% branches, and 74.75% functions; there is no configured
aggregate coverage gate and the separate Node model tests are not included in that Jest
report. The requested browser walkthrough could not be completed in this sandbox because
Expo's web launcher could not create its DevTools directory or open the browser. Physical
iOS/Android, 390×844/1440×900 overflow/focus, and reduced-motion device walkthroughs
remain pending; no product-accuracy or production-capability claim follows from these checks.

## Welcome montage and video prototype delivery (2026-10-08)

The isolated prototype's Welcome screen now uses the completed `Your travels. Alive again.` Living Atlas hero. It selects responsive local portrait/wide H.264 clips, remains muted, has an explicit pause/play control, responds to app/background, page-visibility, navigation and scroll visibility, and keeps a bundled poster readable if playback cannot start or fails. Unknown accessibility preference prevents automatic motion; a failed preference lookup uses the safe reduced-motion default while retaining deliberate play. All promotional media is visibly labelled synthetic and is separate from the simulated lifetime replay.

The two 15-second assets in `apps/prototype/assets/video/` are animated-photo montages generated from six fictional editorial stills in `assets/synthetic/hero/`, with slow zooms and short dissolves. They are not Runway or other text-to-video scene-motion output, and they contain no owner images, travel evidence, audio, route claims, export, or publishing. `apps/prototype/scripts/render-travel-hero.py` reproduces the encoded assets when given FFmpeg; its strict decoder verification passed for each 360-frame clip.

Observed on 2026-10-08: 36 prototype tests (12 Node, 24 Jest), TypeScript, Expo lint, Expo Doctor (21/21), static web export, and root `npm run check` passed. Browser QA at 390×844 and 1440×900 confirmed readable CTA/copy, responsive portrait/wide source selection, muted playback, pause control, and the access-flow handoff. The browser frame inspector rendered all six 60-frame groups (0–359) from the portrait decoder; visual review covered the opening/transition groups and final loop boundary with no black frames. Physical iOS/Android behavior, actual device haptics, native background behavior, real scene-motion generation, and user-photo replay/rendering remain unverified/unimplemented.

## Interactive map and navigation design proposal (2026-10-08)

At the user's explicit request, BMAD UX Designer reviewed the two supplied map
screenshots and the isolated prototype's map, navigation, fixtures and local-state
flow. The current atlas is an abstract percentage-position diagram, not a geographic
map; navigation is page-specific with stack headers hidden.

A [proposed review and change plan](../_bmad-output/planning-artifacts/ux-designs/ux-Travel-Life-2026-10-08/REVIEW-PLAN.md),
with paired DESIGN.md and EXPERIENCE.md, describes a vibrant geographic atlas,
pan/zoom/fit, shared year/Timeline selection, photo-led journey exploration, and
consistent Atlas / Replay / Highlight navigation plus Home/Back. It preserves
synthetic-data labels, uncertainty, session-only corrections, simulated access,
cancelable replay and exact owner-selected highlight preview.

This is planning only, not an approved implementation contract. No application
code, dependency, provider configuration or runtime behavior changed. The new
map-only palette, geographic demo anchors and navigation arrangement await approval;
online basemap versus bundled geography also remains unresolved. A network basemap
would require an explicit change to the prototype's no-external-network contract
and map-service disclosure, with local Timeline fallback retained. No live browser
visual/usability validation or new application test run is claimed for this pass.
Next: owner review of the proposal, then amend the existing prototype delivery spec
and implement only after authorization. Production mobile delivery remains separate.

## Bundled atlas and post-import navigation prototype delivery (2026-10-08)

The approved Living Atlas navigation delta is implemented only in the isolated,
synthetic `apps/prototype/` app. Its former abstract field is now an offline,
dependency-free fictional geographic illustration with explicit synthetic-demo labels,
fictional anchors, pan/zoom/fit controls, marker-overlap grouping and an accessible
Timeline fallback. Missing fictional coordinates remain unplotted and expose an
explicit Timeline recovery action; a map-render failure does the same. It makes no map-provider, tile, network, location, route or visit
claim. The prototype now also offers compact Atlas / Replay / Highlight navigation
and contextual Home/Back. These transitions preserve the active in-memory year,
selected journey, correction, camera and highlight state; exiting replay stops it.

The production map-provider decision, native gesture/device validation, physical
mobile and browser responsive walkthroughs, real evidence handling, persistence,
replay rendering/export and publishing remain unimplemented. This bounded visual
prototype is not evidence of product accuracy, map accuracy or production readiness.

## Whole-life highlight preview control (2026-10-08)

The isolated prototype's Highlight step now begins with no chapters selected and
offers an explicit **Select all 3 chapters** control alongside individual chapter
selection and Clear selection. Selecting all shows every synthetic chapter in the
exact local preview, while the screen continues to state that it creates no URL and
publishes nothing; a separate deliberate confirmation would still be required in a
production sharing flow. This supports the whole-travel-life sharing hypothesis
without changing the owner-selection boundary.

Observed on 2026-10-08: 27 prototype tests, TypeScript, and Expo lint passed.
Browser verification at 1440×900 and 390×844 confirmed the empty initial state,
whole-life selection, selected chapter indicators, clear control, and exact preview.
This remains synthetic/local-only; it does not validate live publishing, real media,
or native-device behavior.

## M1.1 shared mobile app foundation (2026-10-08)

`apps/mobile/` now contains the separate Expo SDK 57 shared iOS/Android application.
It introduces the production Trust → Import → empty Atlas flow in the established
Living Atlas visual language, with a recoverable unknown-route screen and typed
local navigation. The empty Atlas makes no map, journey, evidence or inferred-history
claim. Import explains that photo-library access will be requested only in M1.2.
There is no account, permission request, photo enumeration, persistence, network
service, AI processing, map provider, replay or sharing behavior in this story.

Observed on 2026-10-08: the mobile package check passed (8 Jest tests, TypeScript,
Expo lint and Expo Doctor) and the root `npm run check` passed (framework integrity,
20 foundation tests and eval smoke). Browser verification confirmed Trust → Import →
Atlas, explicit Back behavior, and unknown-route recovery at desktop and 390×844 widths.
The review removed destructive template reset behavior, corrected local setup guidance,
and deferred a default-dependency audit before M1.2. Metro started despite a Windows DevTools cache
ACL fallback warning. Android and iOS physical development-build smoke checks remain
pending; no device behavior is claimed.

## M1.2 native photo access implementation (2026-10-08)

The production `apps/mobile/` Import screen now offers owner-initiated broad device-library access and an explicit selected-photo/video picker. A narrow Expo SDK 57 adapter inspects or requests photo/video permission, counts accessible image/video entries in pages using the class-based media query, and opens limited-scope management only on owner action. Screen state holds scope and counts, not raw assets, media URIs, filenames, or coordinates. The app rechecks permission on foreground return and before enumeration; a completed count is recounted on foreground return, while revoked access clears its count and interrupted work remains incomplete. Denial does not trigger repeated permission prompts. Atlas remains empty until evidence import in M1.3.

The configuration declares iOS photo-use text, Android photo/video and media-location read permissions, and blocks unrelated camera, microphone, and write-storage permissions. Expo config introspection confirmed the iOS purpose text. A generated Android manifest showed intended read permissions and removal directives for the blocked permissions; the generated project was removed after inspection. An installed Android merged manifest has not been verified.

Observed checks after independent review: mobile `npm run check` passed 28 Jest tests, TypeScript, lint, and Expo Doctor 21/21; root `npm run check` passed 20 foundation tests and eval-infrastructure smoke. `git diff --check` found no whitespace errors. A desktop and 390px browser smoke check showed the web-unavailable state and empty Atlas, but cannot validate native permissions. Review fixes covered interrupted prompts, permission loss during counting, limited-selection races, selected-count preservation, and scoped-count wording. Earlier prototype/CI findings are recorded in `_bmad-output/implementation-artifacts/deferred-work.md`.

On 2026-10-09, an owner-operated physical Android development build completed the M1.2 permission checks: explicit system picker cancellation/selection, full device-library permission, a completed scoped count of 298 device-visible photos/videos, permission revocation/foreground recovery, and limited selected-photo access. The picker returned one selected item without a stable library ID, which the UI labelled as uncertain. No media, identifiers, filenames, URIs, or location data were recorded. This is device behavior evidence only, not proof of lifetime coverage or reconstruction accuracy. Physical iOS behavior, GPS availability, cloud-only asset behavior, installed merged-manifest inspection, and distribution acceptance of broad media access remain pending. M1.3 must add normalized, durable, resumable metadata import and coverage measurements before any reconstruction claim.

## M1.3 metadata import, resume, and deduplication (2026-10-09)

`apps/mobile` now includes an Expo SDK 57 `expo-sqlite` local-only import index. It pages only the current full or limited device scope, normalizes opaque asset IDs with image/video type, nullable capture and modification times, nullable location availability, and cloud/unavailable status, and commits every page with a resumable checkpoint. The importer uses parameterized SQLite upserts, checks permission before and after every page, discards late pages after cancellation or a permission change, and leaves a separate correction-marker table untouched. Selected results with no stable ID are explicitly unavailable and never substituted with a path or new identity.

The Import screen has Start/Resume/Cancel actions and labels accessible, scanned, geotagged, and unavailable counts as current accessible scope rather than lifetime coverage. The implementation does not upload, decode, copy, expose, or log media, filenames, URIs, coordinates, raw EXIF, journeys, visits, or travel conclusions. M1.4 remains responsible for canonical evidence/history, correction lifecycle, disconnect, and deletion.

On 2026-10-09, the final M1.3 mobile check passed 47 synthetic Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed 20 foundation tests plus the evaluation-infrastructure smoke check, and `git diff --check` found no whitespace errors. Those checks cover empty, sparse, large, interrupted/restarted, revoked, picker-only/missing-ID, missing metadata, cloud/unavailable, repeat/deduplication, SQLite migration and commit rollback, and Import-screen coverage states. They do not validate physical SQLite behavior, real metadata availability, iOS behavior, or reconstruction accuracy.

Synthetic unit coverage exercises empty/sparse, large/repeat/deduplicated, cancelled/resumed, permission-revoked, selected missing-ID, cloud/unavailable, and correction-marker-preservation paths. On 2026-10-09, the owner-operated Android development build completed the consented full-library start, pause, resume, and repeat observations. After a paused, committed 1,000-item checkpoint, resume completed the current scope with aggregate coverage of 2,989 scanned, 1,957 with location metadata available, and 0 unavailable. The owner confirmed a repeat import retained those aggregate totals, and **Recheck accessible photos** independently returned 2,989. The owner also selected one item through the system picker; it had no stable library ID, and selected import completed with 0 scanned, 0 location metadata available, and 1 unavailable, without substituting an identity. While a full-library import was active, the owner backgrounded the app to revoke access in Android Settings; the app paused and did not resume automatically on return. After full access was restored, **Recheck accessible photos** again returned 2,989. No media, IDs, filenames, URIs, timestamps, coordinates, or raw metadata were recorded. Physical iOS validation, cloud-only behavior, and GPS availability remain pending; passing synthetic checks and this device observation do not establish lifetime coverage or reconstruction accuracy.

On 2026-10-09, the Android development build passed `:app:assembleDebug` for the connected phone's arm64 architecture and installed with `adb install -r`. CMake 3.31.6 resolved the earlier NDK linker incompatibility; running Gradle with the installed Java 17 resolved the Prefab configuration failure caused by Java 25's restricted-method warning. Metro bundled 1,464 Android modules and Android reported `com.anonymous.travellife/.MainActivity` in the foreground. Those observations verify build, installation, and JavaScript delivery; the separate owner-operated M1.3 observation above verifies the consented Android import cases. No real photo metadata or location was inspected or recorded here.

## M1.4 private record lifecycle, disconnect, and deletion (2026-10-09)

`apps/mobile` now migrates the existing `travel-life-import-v1.db` in place to hold normalized canonical evidence, empty-ready inferred-history storage, revisioned correction overlays, lifecycle state, and an explicit cache registry. It retains only the established opaque local source reference, media type, nullable timestamps, location availability, and availability state; it does not add original media, paths, filenames, raw EXIF, precise locations, analytics, or logging. The migration preserves M1.3 source/index data and repeat-import deduplication.

The owner chose normal OS/device backup restoration for the local private record. The app documents that the platform and backup account control this behavior and does not claim SQLite encryption. A new private Settings screen makes **Disconnect photo source** distinct from **Delete local history**: disconnect preserves the local record, source references, and checkpoints while blocking further source reads until the owner reconnects; deletion requires confirmation and clears the covered local tables and registered caches without claiming to delete original media or remote copies. No background scheduler exists until M1.5.

On 2026-10-10, mobile `npm run check` passed 83 Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed framework integrity, 20 foundation tests, and the eval-infrastructure smoke check. The mobile coverage command reported 82.13% statements, 74.37% branches, 80.92% functions, and 86.41% lines; no E2E runner is configured. The targeted M1.4 lifecycle, migration, correction target/lineage, disconnected-import and disconnected-count, cancelled lifecycle prechecks, confirmed/cancelled/failed deletion, late-write, stale-UI cleanup, and Settings tests passed. These synthetic checks do not prove physical SQLite migration/deletion, OS backup restoration, iOS behavior, or that a deleted local record cannot later be restored from the owner-selected device backup.

## M2.1 local metadata baseline and history model (2026-10-10)

`apps/mobile` now contains a local-only `reconstruction-v1` baseline. The private SQLite record stores the device-recorded civil capture date, an explicit timestamp-precision marker, and approved coordinate/accuracy values alongside opaque source references. The adapter marks its presently available MediaLibrary time as offset-unknown, so the reconstruction engine uses civil-day comparisons unless a future source can prove a trustworthy capture offset. No coordinate, source ID, media, filename, raw EXIF, trace, or reconstruction result is uploaded, logged, or shown in UI.

The deterministic rebuild persists places, visits, journey drafts, structured uncertainty/dispositions, membership links, possible merges, rule version, and a local evidence revision. It applies the effective inclusion correction, blocks disconnected writes, retains the prior committed database result on failure, and clears the in-memory draft on disconnect/delete. Full, limited, and completed selected imports request this local rebuild; Atlas only reports aggregate local-draft state. Same-place evidence with only a civil date may form an uncertain visit and cannot create an elapsed-time journey.

Observed on 2026-10-10: 19 mobile Jest suites / 100 tests and TypeScript passed. These synthetic checks cover deterministic input ordering, complete-link/date-line handling, exclusions, duplicate-conflict semantics, visit/journey boundaries, GPS-less precise-time bracketing, lifecycle retention, repository migrations, and imported private fields. Physical Android/iOS SQLite migration/rebuild, real capture-offset fidelity, GPS availability/accuracy, duplicate detection, reconstruction quality against owner-reviewed history, and owner boundary controls remain unverified.

## Production video Welcome (2026-10-09)

`apps/mobile` now opens at `/` on the agreed Living Atlas beach/lake video Welcome; Trust moved to `/trust`, followed by the existing Import and empty Atlas screens. The app bundles only the approved portrait/wide promotional montage and poster. They are illustrative and silent, never owner media or a personalized Replay. The Welcome requests no photo permission or network data. It waits for a motion preference before native autoplay, starts still for reduced motion or lookup failure, offers explicit Play/Pause, pauses when inactive or scrolled offscreen, and retains a readable poster and CTA if playback fails.

Observed on 2026-10-10: 74 mobile Jest tests, TypeScript, Expo lint, Expo Doctor 21/21, and root `npm run check` passed. The tests cover Welcome → Trust → Import → empty Atlas, no permission on Welcome, motion preference and lifecycle policy, browser autoplay rejection, failed playback, and CTA survival. Physical iOS/Android video playback, native background behavior, and current desktop/mobile browser layout remain to be checked on target surfaces; synthetic component checks do not establish those behaviors.

## M1.5 scheduled library maintenance (2026-10-10)

`apps/mobile` now adds an owner-controlled, initially disabled automatic-maintenance setting. The SQLite migration advances the existing private record to schema v5 with maintenance preference/status, per-run checkpoint, source presence, a durable renewable lease, and a deduplicated normalized change queue for M2.6. A UI-independent reconciler pages only the currently permitted full or limited photo scope, serializes runs, persists pauses before expiry/read interruption, upserts changed normalized metadata, and queues missing identities as deletion candidates only after two completed full-scope scans. It does not add media copying, paths, filenames, EXIF, coordinates, raw evidence logging, route inference, automatic publishing, cloud work, or permission expansion.

The app registers `travel-life-library-maintenance-v1` through Expo BackgroundTask/TaskManager after the owner enables it following a completed import. iOS processing background mode is configured. Settings states that timing is device-controlled and shows pending, restricted, paused, and completed outcomes; disconnect, delete, disable, and access loss unregister future work. Foreground activation asks an enabled maintenance controller to catch up against the permitted scope. This is handler and local-state implementation only: physical Android/iOS development-build registration, developer-trigger behavior, expiry, revocation, disconnect/delete cancellation, and normal OS cadence are unverified and must be recorded separately. No claim is made for force-quit behavior or scheduled execution.

## M2.2 protected optional AI proxy (2026-10-11)

The repository now contains a disabled-by-default `travel-life-ai-proxy` Supabase Edge Function and a matching mobile contract boundary. The function requires platform JWT verification and an anonymous user, rejects bodies with anything other than allowlisted opaque alternatives, binds request consent/rule/evidence/correction revisions, uses the configured `gpt-5.4-mini-2026-03-17` Responses snapshot with `store:false`, and returns typed skips for disabled, unauthenticated, limited, unavailable, timed-out, refused, and invalid-result paths. It never logs request/response bodies. Private RLS-enabled tables reserve ten requests per anonymous subject/day and a USD 5 deployment-day budget atomically; the public quota RPC is callable only by the Edge Function service context, so a client cannot consume shared budget directly.

The mobile module creates request-scoped opaque references from local candidates, holds the opaque-to-local map only in memory on-device, creates or refreshes an anonymous Supabase session using only a publishable project key, rejects stale revisions and unbounded responses, and does not apply a proposal. Local reconstruction has no dependency on this module. The public mobile configuration leaves the proxy endpoint unset until anonymous-auth abuse controls are verified; server-only secrets and dashboard prerequisites are documented under `supabase/`.

Observed on 2026-10-11: 20 mobile Jest suites / 107 tests, mobile TypeScript/lint/Expo Doctor, and root `npm run check` passed; ten synthetic Deno Edge Function contract tests passed; `git diff --check` passed. The linked `fgmcnzxhbrtvjhtafort` project has both M2.2 migrations applied, `travel-life-ai-proxy` deployed and active with JWT verification enabled, and no linked-project security-advisor warnings. The deployment set `TRAVEL_LIFE_AI_ENABLED=false`, so the endpoint is safe but intentionally inactive. Anonymous-auth/CAPTCHA configuration, a real anonymous mobile session, real provider call, provider cost/latency, physical-device session behavior, reconstruction-quality evaluation, and provider-retention behavior remain unverified.

## M2.3 optional inferred grouping review (2026-10-11)

M2.3 adds a transient local review controller that derives only bounded `possibleMerges` from the deterministic reconstruction graph, minimizes them through the existing opaque M2.2 boundary, and maps validated opaque identifiers back to existing local journey IDs in memory. It never applies a result or changes visit support, presence, corrections, confirmed history, publishing, or the deterministic graph. The Atlas displays inferred proposals and local-safe no-eligibility, declined, stale, and skipped outcomes. Disconnect and deletion clear this review state.

The proxy and mobile validators now require a fixed `labelCode` paired with each structural result (`possible-grouping`, `needs-more-evidence`, or `no-suggestion`); the app supplies the approved local wording and accepts no model-written label text. The production kill switch remains `TRAVEL_LIFE_AI_ENABLED=false`, so the review control shows the disabled/skipped fallback without creating a session or network call. Enabling remains deferred until CAPTCHA/rate protection, publishable configuration, and owner-operated anonymous-session validation are complete.

Observed on 2026-10-11: mobile `npm run check` passed 118 Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed framework integrity, 20 foundation tests, and the evaluation-infrastructure smoke check; `npx --yes deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` passed 10 synthetic protected-proxy contract tests; `git diff --check` passed. Focused reconstruction and AI-controller suites passed 15 synthetic tests, and the review-fix mobile suites passed 21. No real provider call, device flow, anonymous session, or reconstruction-quality result is claimed.

## M2.4 small engine regression suite (2026-10-11)

`reconstruction-v1` now has 35 synthetic developer-reviewed regression cases for
the 5 km place boundary, 48-hour/one-day visits, 72-hour/two-day journeys,
30-day caps, 240-hour/ten-day possible merges, date-line and input-order
determinism, GPS-less membership/suggestions, duplicate and missing-date handling,
owner boundaries, usual-area context, A → B → A, and repeated final rebuilds.
The cases explicitly keep trip-memory membership separate from place and visit
support; they retain unresolved alternatives rather than choosing one silently.

Observed on 2026-10-11: the focused engine suite passed 35/35 synthetic cases; the
unrestricted mobile check passed 21 suites / 144 tests, TypeScript, Expo lint, and
Expo Doctor 21/21. Root `npm run check` passed framework integrity, 20 foundation
tests, and evaluation smoke. `product_quality` remains `not_measured`. The optional AI sample is untested
because `TRAVEL_LIFE_AI_ENABLED=false`; no session, network request, provider
output, latency, cost, or quality claim occurred. M2.6 still owns device-backed
incremental/background reconciliation, so these final-input permutations do not
establish scheduler or physical SQLite behavior.

## M2.5 bounded processing and recovery (2026-10-11)

The disabled optional-AI proxy now opens and settles a private, RLS-protected,
service-role-only operational attempt after its atomic quota reservation. The ledger
contains only a typed outcome, bounded nullable token totals, null cost while no provider
invoice or pricing measurement exists, elapsed milliseconds, and frozen contract/rule/model/prompt
versions. It holds no subject, request or response data, opaque references, evidence,
provider errors, headers, or session material; reservations remain conservative and are
never refunded. Owner cancellation aborts the mobile fetch where supported, clears the
pending preview, rejects late proposals, and keeps the latest local graph usable. The
existing durable import resume and atomic local rebuild controls are surfaced as explicit
local recovery actions.

Verification is synthetic only: proxy contract checks exercise reservation-before-provider,
sanitized settlement, nullable unknowns, typed cancellation and failure; mobile tests cover
cancellation, stale/lifecycle safety, prior-graph retention, and recovery controls. The
server kill switch remains false. No anonymous session, provider call, provider cost or
latency, import timing, physical-device behavior, or reconstruction-quality measurement is
claimed; all remain unknown until a separately authorized smoke test or device evaluation.

## Reconstruction lifecycle race fix (2026-10-12)

The local reconstruction controller now invalidates an awaiting rebuild when disconnect
or deletion clears the in-memory graph. A late completion or failure cannot republish
state after that clear. Rebuilds remain serialized on the shared SQLite connection and
stay suspended until the private record is connected again. Focused controller regressions
cover late success, late failure, notification silence, serialization and lifecycle resume;
the full mobile Jest suite passed 152 tests, with TypeScript,
lint, and the root foundation check also passing. Physical lifecycle interruption and
SQLite transaction behavior remain unverified on devices.

## M2.6 incremental journey reconciliation (2026-10-12)

The mobile foundation now records aggregate local reconciliation state alongside
the existing durable M1.5 queue. A completed permitted maintenance pass invokes
a local `reconstruction-v1` rebuild; the rebuild replaces the inferred projection
and clears queued invalidations in one SQLite transaction. The prior projection
remains readable if the transaction, permission, lifecycle, or worker does not
finish. Atlas and Settings now state pending/caught-up outcomes, provide connected
local catch-up and rescan controls, and explicitly say these changes stay private
and unpublished. The headless task uses the same local boundary and does not call
the optional AI path.

Observed on 2026-10-12: 22 mobile Jest suites / 159 tests, TypeScript, Expo lint,
and Expo Doctor 21/21 passed. This is synthetic/runtime validation only. Physical
SQLite migration, iOS/Android interruption, background scheduling, source changes,
and reconstruction accuracy remain unverified. History-target corrections without
a safe lineage mapper remain pending for owner review; they are never discarded or
applied to a partial rebuilt graph.

## M3.1 private Atlas reveal (2026-10-12)

`/history` now projects the committed local reconstruction graph into a bounded
owner-facing reveal model before it reaches UI. The Living Atlas screen leads with
a native map canvas when local inferred journeys are available, states its normal
viewport/tile-request boundary, and always retains a readable
local list. Sparse, pending reconciliation, restricted access, recoverable failure,
and no-journey states present truthful recovery actions. The Replay handoff is
typed and appears only for eligible revealed journeys; it is an availability screen,
not a renderer, export, publish, or share action. Reveal telemetry is opt-in,
allowlisted to coarse state/count events, and safely ignored when consent or a
sink is unavailable.

The native reconstruction repository now has a committed-run read boundary for
Atlas restoration after restart. Its only map output is journey state plus a
coarsened anchor rounded to one decimal degree; source/evidence identifiers,
capture data, and precise coordinates remain inside the SQLite query and never
reach reveal props or telemetry.

Focused mobile tests passed 6 suites / 58 tests, with TypeScript and Expo lint.
These are synthetic checks. Native iOS/Android map rendering, Apple/Google map
provider requests, native configuration, accessibility, device lifecycle states,
and telemetry delivery are not yet verified. No product-quality or engagement
claim is made from this work.

## M3.2 connected Atlas map and Timeline (2026-10-12)

The private Atlas now derives one redacted local exploration state for Map and
Timeline. The durable read boundary produces only local display ordinals,
coarse observed years, a `Date unknown` label when no year is usable, ordering
uncertainty, and already-coarsened map anchors. Raw journey IDs, evidence,
timestamps, civil days, source references, and precise coordinates remain in
SQLite. A selected year retains every journey with an observed visit in that
year; an excluded selection is cleared. Unknown-coordinate journeys remain in
the chronological Timeline and are never plotted.

Map and Timeline controls, year controls, marker/card selection, selected
accessibility state, empty-year recovery, and a scrollable Timeline fallback
all consume that same projection. The map fits only filtered coarse anchors;
unavailable map service and dense views leave Timeline available. No detail,
route, export, publishing, AI, or source-data change was added.

Observed on 2026-10-12: focused Atlas/repository/provider/owner-flow tests
passed 4 suites / 26 tests; the mobile check passed 23 suites / 170 tests,
TypeScript, Expo lint, and Expo Doctor. This does not validate physical
iOS/Android map rendering, provider tile behavior, real dense-map usability,
target-device screen readers, lifecycle interruption, or reconstruction
accuracy.

## M3.3 private journey detail and source-linked memories (2026-10-13)

Atlas now opens a private journey detail only from an opaque local display ID.
SQLite resolves that ID inside the connected-record boundary, then returns
chronological observed visits, date precision, uncertainty, and separately
worded visit-support versus journey-membership reasons. The Atlas projection,
route parameters, telemetry, and detail text contain no source identifiers,
filenames, precise coordinates, raw timestamps, or media URIs. A bounded
four-item preview resolver receives source references only inside the native
adapter after it rechecks permission and cloud availability; the rendered
preview state has no source identifier. Cloud-only, removed, inaccessible, and
failed previews remain readable unavailable-memory states without a replacement
asset or download. The new detail surface follows the Living Atlas photo-led
composition, returns contextually to Atlas, and links only to the later
non-mutating correction handoff.

Observed on 2026-10-13: focused detail/Atlas/repository/adapter/owner-flow
checks passed 6 suites / 37 tests. Mobile Jest passed 24 suites / 176 tests,
with TypeScript and Expo lint also passing. Expo Doctor reported 20/21 checks:
six pre-existing Expo SDK 57 patch-version mismatches (`@expo/ui`, `expo`,
`expo-router`, `expo-splash-screen`, `expo-dev-client`, and `jest-expo`) need a
separate dependency-maintenance decision; M3.3 did not change dependencies.
This is synthetic and runtime validation only. Physical iOS/Android photo
permission, URI rendering, cloud-only behavior, cache behavior, and lifecycle
interruption remain unverified; no reconstruction-accuracy or owner-presence
claim follows.

## M3.4 supportable travel statistics (2026-10-13)

Atlas now receives a read-only inferred-statistics projection from one captured
completed reconstruction run. The local schema stores a resolved country code
and Natural Earth Admin 0 Countries 1:110m dataset version 5.1.1 only on each
reconstructed place during its atomic rebuild. The bundled resolver uses no map,
AI, geocoding, or network path, and invalid, border-ambiguous, and unresolved
coordinates do not receive a country. The display boundary receives only journey,
place, and supported-country counts; it cannot receive country labels/codes,
coordinates, evidence/source identifiers, dates, routes, distance, duration, or
media. Processing, restricted, failed, and sparse reveal states suppress totals.

Observed on 2026-10-13: focused repository/Atlas/resolver/import/lifecycle-provider
/journey-detail tests passed 6 suites / 44 tests. Mobile Jest passed 25 suites / 183
tests, with TypeScript and Expo lint also passing. Expo Doctor reported 20/21 checks
because six existing Expo SDK 57 patch versions are behind its expected versions; this
feature did not change dependencies. Root `npm run check` passed framework integrity,
20 foundation tests, and evaluation smoke checks; `git diff --check` found no whitespace
errors. This is synthetic validation only. Physical iOS/Android SQLite migration,
resolver performance, screen-reader behavior, lifecycle interruption, and
reconstruction/country-resolution accuracy remain unverified.

## M4.1 journey correction planning (2026-10-13)

The [M4.1 delivery spec](../_bmad-output/implementation-artifacts/spec-m4-1-confirm-reject-and-edit-a-journey.md)
now plans scoped confirm/reject, title and date edits, destination and memory
membership changes, basic split/merge, and pending correction-remap review. It
keeps observed evidence separate from owner-entered claims, preserves the
official Journey detail composition, and requires corrections to survive
restart, rescan, and foreground/background reconstruction without silently
remapping ambiguous identities. The current correction schema and M2.6
history-correction pause are identified as implementation prerequisites.
This is planning only: no correction behavior, migration, UI, test result, or
device validation is claimed. Next work is the durable correction contract,
reconciliation mapper, owner review UI, and their acceptance checks within M4.1.
The plan now defines exact successor mapping from reviewed evidence/visit support
sets, strict split/merge ordering for weak dates, an uncertain-memory assignment
entry, one effective owner-visible journey count alongside evidence-based
place/country counts, and a common validator for deterministic, AI-suggested,
and owner-initiated longer-gap merges. Ambiguous lineage and unknown order remain
pending for owner review.
Owner-initiated split/merge now has a distinct publication rule: validated
successors and counts appear in one atomic save, while predecessor-wide title,
date bounds and confirmation await scope review. Only a later ambiguous
automatic remap holds the last complete view. A rejected single-visit journey
cannot automatically re-enter a journey when new evidence arrives; its source
visit remains available and the owner can explicitly resolve or reverse it.
The M4.1 spec now fixes partial-overlap and duplicate-family remap outcomes,
separates `pending_scope_review` from `pending_remap` as durable correction
states, scopes negative constraints to reviewed support units and visit links,
and defines the save token, shared write guard, rollback and rebuild race rules.
An uncertain-memory state matrix keeps availability, trip membership and visit
support independent. These are planning contracts; the current schema and
adapter do not yet implement their lifecycle-generation or duplicate-family
requirements.
The follow-up planning pass adds ordered remap gates with no partial-match
fallback, a rejection invariant anchored to support-unit sets and pairwise
visit incompatibility, an editor state machine for stale previews and save
races, and a legal/forbidden transition table for uncertain memories. These
are acceptance contracts for M4.1, not implemented behavior.
The latest remap clarification gives explicit first-failure outcomes for partial
and mixed support matches. The memory contract now models suggestion targets,
owner-rejected targets, and the one accepted primary separately; choosing a
different primary requires an explicit atomic transfer when one already exists.
The remap plan now includes a normative typed-key resolver and whole-set
containment algorithm. A mixed exact/ambiguous/conflicting correction is
pending in full; no portion of its candidate graph publishes. Existing
media-only choices map by their canonical photo ID without requiring visit
support, while visit and journey corrections require exact support-unit and
successor-visit mappings.

## M4.1 BMAD spec validation (2026-10-13)

The [BMAD M4.1 kernel](../_bmad-output/specs/spec-m4-1-journey-corrections/SPEC.md)
now adopts the existing delivery record and the accepted design/evidence
decisions as its complete planning contract. Its append-only memlog records a
two-pass coherence and preservation review. The remap rules are conservative
and explicit for keys that can be verified, but family-key remapping is not
implementation-ready: the current adapter passes no duplicate-family ID and
the local schema lacks a durable family identity and explicit source-origin
support field. The BMAD spec leaves the source of those signals as an open
question and the delivery spec marks it as a prerequisite. No correction code,
runtime behavior, device result or accuracy measurement changed in this pass.
The follow-up check found a state-model conflict: a newer `pending_remap`
candidate had been described as replacing an `effective` correction even while
the old completed projection remained visible. The M4.1 contract now keeps
owner decisions, committed applications and candidate evaluations separate.
An ambiguous candidate leaves the prior application effective and publishes no
partial result; a valid owner split/merge instead commits its successors and
`pending_scope_review` claims together. Exact matching, partial overlap,
family/source conflicts and both rejection scopes have an explicit case table
in the delivery spec. Durable family identity remains an open dependency.

The M4.1 implementation has now advanced beyond the initial preview-only panel.
On mobile, Confirm/Reject first show the current visible scope, then persist a
local evidence-support revision and the exact owner-visible snapshot, tied to the
loaded reconstruction run. A successful save immediately attempts a local rebuild;
confirmed/rejected outcomes are shown as applied only after that rebuild succeeds.
Stale runs are refused. A failed exact remap is tracked as a separate durable
candidate evaluation, preserving the last committed application and complete
projection. Focused correction UI/provider/reconstruction/migration tests, mobile
typecheck, and mobile lint passed. The migration is now at schema v16. This is a
partial implementation, not full M4.1: title/date edits, destination and memory
membership, split/merge, uncertain-memory review, family identity, owner resolution
of pending remaps, atomic save-plus-projection, device validation and the complete
acceptance matrix remain outstanding.

Final checks on 2026-10-13: mobile Jest passed 27 suites / 198 tests, TypeScript
and Expo lint passed, and root `npm run check` passed framework integrity, all 20
foundation tests, and evaluation smoke. Mobile `npm run check` stopped at Expo
Doctor (20/21): six existing SDK 57 patch versions are behind the expected
versions; no dependencies were changed for this correction work. No iOS/Android
device run or reconstruction-accuracy result is claimed.

## M4.1 implementation start (2026-10-13)

The owner-facing correction entry point is now wired into the private Journey
screen flow within `apps/mobile`: the details screen exposes a review/correct
action, and a dedicated correction route renders a private, read-only review
panel with explicit Confirm / Reject / Review uncertain memories choices. The UI
keeps source evidence local, preserves no-upload semantics, and uses the
existing private journey data contract rather than publishing a remote correction.
This is a bounded implementation step aligned with the M4.1 direction; it is not
an end-to-end correction engine or a final family-identity remap implementation.
The remaining implementation dependency is the durable duplicate-family/support-unit
identity and exact remap precedence for partial and ambiguous successor cases.
The mobile app and repository tests were re-run after the route and local preview
changes; the reconciliation and photo-access suites both passed.

The 2026-10-13 M4.1 code review found that this remains a UI shell: the
Confirm/Reject controls do not save owner decisions, and the story's durable
correction, reconstruction remap, editing, uncertain-memory, and preview/save
safeguards are not implemented in the reviewed diff. The new screen also fails
mobile lint at `journey-correction.tsx:32` (`react/no-unescaped-entities`), though
mobile TypeScript checking passes. Review findings are tracked in the M4.1 story;
the story remains in progress. No device behavior or durable correction is claimed.

Follow-up implementation added schema v13 for immutable local confirm/reject
revisions, with canonical evidence support snapshots, lifecycle/run freshness
checks, replacement lineage, and delete-all cleanup. The correction route now
uses a durable provider save path and returns to the existing detail route; it
shows a save failure instead of presenting an unsaved selection as completed.
This is only the canonical-evidence slice. The native adapter still has no
verified duplicate-family source, so family-key remapping and automatic
projection reconciliation remain unavailable rather than guessed. Focused import
repository/provider tests passed (19 tests), as did mobile TypeScript and lint.
Physical devices, split/merge, membership editing, negative-constraint grouping,
and exact remap publication are still unimplemented and must remain in progress.

Follow-up M4.1 implementation review on 2026-10-13 retained the story as
in-progress. The confirm/reject slice has focused fixture coverage, but its
revision write and projection rebuild still commit separately; a failed or
interrupted rebuild can leave a durable decision without the required updated
projection. The current remapper flattens support to a journey-level match and
rejection removes candidates after grouping, so it cannot enforce per-visit exact
lineage or negative grouping constraints. Owner edits, uncertain-memory actions,
split/merge, duplicate-family identity, idempotent save commands, and owner
pending-remap resolution remain absent. Six focused suites passed (45 tests),
TypeScript and lint passed, and `git diff --check` passed; the correction UI tests
still emit React `act` warnings. The sandbox blocked Jest cache resolution with the
known Windows temporary-directory EPERM; the approved outside-sandbox run supplied
the passing test result. No device behavior or full M4.1 acceptance is claimed.

The next M4.1 correction increment moved the confirm/reject write and its
successor reconstruction into one SQLite immediate transaction. The repository
now records reviewed visit support sets, so a split or ambiguous successor fails
closed instead of flattening every decision to one journey-level support set.
The command key has a unique durable index: a response-loss retry reads the
already committed decision and does not append a revision or a second projection
run. The provider publishes the graph returned by the committing transaction,
then refreshes the redacted Atlas cache, instead of opening another rebuild.
Focused correction/provider/repository suites passed 32 tests; TypeScript and
Expo lint passed, and `git diff --check` found no whitespace errors. The
journey-correction renderer still emits React `act` diagnostics despite the
tests passing; this remains open in the error playbook. M4.1 remains incomplete:
the pre-grouping negative-constraint engine, typed title/date/destination/memory
claims, split/merge, duplicate-family identity, pending-remap resolution, full
acceptance matrix, and device checks are not claimed.

The correction engine now also consumes effective rejection support sets before
automatic journey grouping. A rejected single visit remains a source-supported
visit but is withheld from automatic journey membership; a rejected reviewed
pair becomes separate automatic journeys and is not offered as a possible merge.
The repository validates exact lineage on the unconstrained graph before it
creates this constrained successor graph, so a split or ambiguous remap rolls
back instead of publishing a constraint that guessed at a successor. Focused
engine, correction, provider, and repository suites passed 64 tests. This does
not complete M4.1's structural editing or typed owner-claim requirements.

M4.1a regression coverage now also proves the correction transaction rolls back
when the projection write fails after a revision is staged, when the selected
run becomes stale before save, and when the connected private record is lost at
the final pre-commit lifecycle guard. In each case no commit is issued. The
focused reconciliation repository suite passed 15 tests; mobile TypeScript and
Expo lint passed. This remains synthetic coverage, not a physical-device result.

The focused M4.1a correction regression set now passes 67 tests across engine,
correction-application, provider, and reconciliation repository suites. The
React `act` diagnostics are traced to an installed incompatible nested test
renderer peer range (`^19.3.0` against the app's React 19.2.3), recorded in the
error playbook, and intentionally left for the framework-version workflow rather
than changing dependencies during this story.

The root `npm run check` also passed: framework integrity matched 44 skills and
four BMAD runtime trees, all 20 foundation tests passed, and eval smoke checks
retained their explicit non-quality result. This does not replace the pending
native device validation for M4.1a.

## M4.1 memory membership corrections (2026-10-14)

The local correction path now stores immutable v21 memory-membership revisions
for assign, move, reject, and unassign decisions. Each revision carries the
selected canonical evidence key and the complete target-journey support set;
the rebuild accepts the target only through the same exact successor mapping
used for other corrections. An assign or move atomically replaces any earlier
owner primary for that evidence, while reject and unassign remove only the
selected membership. The overlay changes neither visit support nor place or
country counts. Journey correction shows opaque memory IDs only and requires a
preview before the local save; inaccessible memories cannot newly assign or
move. Lifecycle and stale-run guards protect the save and the provider only
publishes the committed graph after the redacted Atlas refresh.

Focused correction/provider/repository/migration tests passed 5 suites / 56
tests, and mobile TypeScript and Expo lint passed. This is synthetic coverage.
The bounded uncertain-memory list, competing-target display, durable pending
remap candidates for memory corrections, duplicate-family identity, split/merge,
and device validation remain incomplete.

## M4.1 structural split and merge (2026-10-14)

The local correction schema now migrates through v23 and stores immutable split
and merge revisions with a typed structural payload. A split records the complete
reviewed support for one strictly ordered left visit and rebuilds with an
owner-boundary marker. A merge records two adjacent, strictly ordered single-visit
journeys and rebuilds them as one owner-visible successor. Both writes use the
existing immediate transaction, lifecycle/stale guards, idempotency key, and
redacted Atlas refresh. The owner correction screen previews both operations and
uses only opaque local visit and journey IDs. Save-time validation rejects weak,
same-day/unknown ordering, nonadjacent targets, missing support, and generated-ID
targets. Structural revisions are applied as grouping constraints rather than
being mapped to a generated journey target.

Focused structural, correction UI, provider, migration, and repository suites
passed 6 suites / 60 tests; the complete mobile suite passed 28 suites / 218
tests; mobile TypeScript and Expo lint passed; and root `npm run check` passed.
This is synthetic verification only. M4.1 remains in progress: merge currently
covers adjacent single-visit journeys, predecessor-wide claims still need durable
pending-scope records and owner resolution, the bounded uncertain-memory list and
competing-target view are incomplete, duplicate-family support identity is not
available from the adapter, destination removal and owner remap resolution remain
unimplemented, and physical iOS/Android validation has not been run.

## M4.1 pending scope review (2026-10-14)

Schema v24 adds durable `pending_scope_review` records. A structural split or
merge supersedes only predecessor-wide confirmation and owner title/date
revisions, publishes the structural successor in the same transaction, then
records each affected successor for owner scope review. A successor does not
show the predecessor claim as accepted. Saving a fresh scoped confirmation or
owner claim resolves that successor's pending-scope record. This is distinct
from `pending_remap`, which holds a later ambiguous automatic rebuild.

The complete mobile suite passed 28 suites / 219 tests, and root `npm run
check` passed. Remaining M4.1 work includes destination removal, broad memory
review, duplicate-family identity, remap resolution, integration coverage of
titled predecessors and successor scope records, and device acceptance checks.

## M4.1 destination removal (2026-10-14)

Schema v25 adds a typed `remove-visit` correction revision. The owner selects
one opaque reviewed visit, previews the change, and saves an exact support-set
revision. Rebuild removes that visit only from the selected journey projection;
the visit, canonical evidence, place support, and country support remain in the
underlying reconstruction. The correction is stale/lifecycle guarded and uses
the existing atomic projection transaction. Full mobile verification passed 28
suites / 220 tests, TypeScript, Expo lint, root `npm run check`, and diff
whitespace validation. Remaining M4.1 work is the durable remap-resolution UI
and candidate records, bounded uncertain-memory review with competing targets,
duplicate-family identity, acceptance-matrix integration coverage, and device
checks.

## M4.1 pending-remap owner resolution (2026-10-14)

An ambiguous correction remains withheld from the published projection and is now
visible only on a successor that overlaps its private reviewed support. The
journey review surface explains the bounded remap reason and offers two owner
paths: save a fresh scoped correction for the rebuilt journey, or preview and
discard the old withheld correction. Discarding supersedes only the pending
revision and candidate, then rebuilds and publishes the resulting complete graph
inside one SQLite transaction. It does not delete evidence, visits, places,
memories, or silently accept a successor. Candidate identifiers remain inside
the local repository and never enter the owner-readable detail contract.

Focused UI, provider, reconstruction-repository, and migration suites passed 4
suites / 47 tests, with mobile typecheck and Expo lint passing. This is
synthetic coverage. Remaining M4.1 work is bounded uncertain-memory review and
competing-target display, durable pending-remap handling for memory corrections,
duplicate-family identity when an adapter source is available, broader
acceptance-matrix integration coverage, and physical iOS/Android checks.

## M4.1 uncertain-memory review (2026-10-14)

The journey correction screen now opens a bounded, local page of photos that
lack visit support. Owners may search by observed date, page through at most 12
rows at a time, see availability and coarse location-metadata state, and see how
many journey suggestions exist without exposing other journey identifiers. Each
row retains the existing preview-before-save assign, move, reject, and unassign
flow. A memory-only assignment remains separate from visit, place, country, and
owner-presence support. The database query and all opaque memory mappings remain
on device.

Focused UI, provider, and reconstruction repository suites passed 3 suites / 36
tests, with mobile typecheck and Expo lint passing. This is synthetic coverage.
Remaining M4.1 work includes durable pending-remap handling for memory
corrections, integration coverage for the full acceptance matrix, and physical
iOS/Android checks. Duplicate-family scoped correction remains unavailable until
the import adapter supplies a durable verified family identity and normalized
support tuple.

## M4.1 code-level closure (2026-10-14)

Schema v26 gives memory corrections their own durable pending-remap queue. An
automatic ambiguous memory remap is now retained for owner review and can be
discarded without affecting source evidence or unrelated corrections. The full
M4.1 implementation is ready for physical validation; use
`docs/development/m4-1-device-validation.md` for the private iOS and Android
checks. Duplicate-family scoped correction remains a deliberate unsupported
case until import exposes a durable verified family identity and normalized
support tuple; current independent canonical evidence corrections remain
supported.

## M4.1c verified duplicate-family identity (2026-10-14)

- **Decision implemented:** only an explicit stable identifier provided by a platform integration may form a duplicate family. Expo Media Library currently provides no documented identifier, so normal imports persist `null` and remain independent evidence.
- **Durable behavior:** schema v27 stores private family identity plus a versioned normalized support tuple; schema v28 stores the reviewed family membership and tuple snapshot with each journey or memory correction. A family is usable only when all available members agree exactly. A changed, missing, or conflicting reviewed family fails closed to pending remap and never supplies duplicate visit support.
- **Evidence:** focused family/import/reconstruction tests passed 5 suites / 84 tests; full mobile Jest passed 28 suites / 223 tests; `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint` passed.
- **Remaining device check:** on iOS and Android, determine whether a selected native provider exposes a documented stable family relationship. Record only aggregate capability. If no provider does, the implemented independent-copy path is the intended result.

## Android Atlas sparse-state clarification (2026-10-14)

Android device validation showed a connected local import with 2,989 accessible records and 1,957 available geotag metadata, while Atlas was sparse. The prior sparse heading incorrectly said `No private record yet`; it now says `No journey revealed yet.` so it does not direct an owner to nonexistent Settings controls. Focused owner-flow and Atlas reveal suites (17 tests), typecheck, lint, and `git diff --check` passed. This does not establish why the current private library produces no supported journey; it remains an Android reconstruction/device observation to investigate without recording personal metadata.

## Android sparse Atlas aggregate diagnostics (2026-10-14)

The sparse Atlas now displays aggregate counts from the last completed local reconstruction: evidence assessed and supported, inferred places and visits, and fixed reason buckets for evidence without visit support. The read uses the completed run in SQLite, so the counts survive an app reload, and the UI includes a local recheck action when no completed run is available. It does not expose evidence IDs, precise locations, or media metadata. Focused suites passed 35 tests; full mobile Jest passed 28 suites / 228 tests; mobile typecheck, Expo lint, and root `npm run check` passed. The physical Android result remains unverified: reload the running development build, open the sparse Atlas, and share only the aggregate numbers from **Local evidence check**. Those numbers will determine the next reconstruction fix, if any.

The owner subsequently observed 2,989 assessed, zero supported, zero places, zero visits, and all 2,989 in the broad insufficient-location bucket on Android. The current adapter and repeat-import path can fill coordinates, but the pre-reconstruction M1.3 import retained only a location-present flag. An existing index may therefore need an explicit metadata refresh; the cause remains unverified until the owner reruns Start metadata import and checks the new aggregate. Do not infer that the 1,957 location-present flags are valid coordinates or supported visits.

## Android reload SQLite lock repair (2026-10-14)

The owner saw an uncaught `database is locked` rejection from native SQLite during an Android development reload. The exact call is unknown. The import repository previously began an immediate write transaction on every lazy open, even at the current schema version, while reconstruction used another connection to the same database. Current-schema opens now only read the version, both connections wait up to 30 seconds for an active SQLite writer, and the startup reconciliation read has a handled error state. Fresh installs and older schemas still run the migration transaction. Full mobile Jest passed 28 suites / 234 tests; mobile typecheck and lint and root `npm run check` passed. The device reload and metadata refresh still need physical recheck; this synthetic result does not prove the lock is gone in every OS scheduling case.

## Android Atlas native map manager compatibility (2026-10-14)

The Android development client then reported that the native `Marker` view manager
was undefined. Atlas initially prevented a repeat crash by falling back to Timeline,
but that safeguard recognized only legacy `AIRMap` and `AIRMapMarker` managers.
This app has React Native new architecture enabled; the linked `react-native-maps`
1.27 package uses the Fabric names `RNMapsMapView` and `RNMapsMarker`. The
Fabric-aware gate then exposed a Marker-only Android runtime failure, so Atlas now
uses the native map surface without native Marker children. It centers on the
already-coarsened anchors and retains Timeline as the journey-selection control.
Focused Atlas coverage, mobile typecheck, and lint passed. Reload the JavaScript
bundle to verify this marker-free map; the separate SQLite reload repair still
needs its deliberate concurrent device check.

## Android metadata-refresh result (2026-10-14)

The owner refreshed the current Android accessible scope and Atlas then reported
165 inferred journeys, 67 inferred places, and 5 supported countries from 2,989
device-visible records. This resolves the earlier zero-support result as a stale
local-index outcome for this device. These aggregate counts do not prove exact
journey boundaries, complete coverage, or owner presence. The installed client
also displayed the tested Timeline fallback without a marker crash. The device
then exposed the legacy-only manager-name gate; the Fabric-compatible correction
is ready for a JavaScript reload. An intentionally concurrent reload/import timing
case is still required to fully close the SQLite-lock check.

## Android Atlas MapLibre provider replacement (2026-10-14)

The prior marker-free Google map could not be enabled because Google Maps Platform
reported that this billing profile is in a prohibited territory. The app now removes
`react-native-maps`, the Android Google-key dynamic configuration, and every
Google API-key prerequisite. It uses `@maplibre/maplibre-react-native` 11.5 with
its Expo config plugin and the existing React Native new architecture. The Android
development build uses MapLibre demo tiles solely for device verification; the
native source receives only coarsened local anchor points and contains no evidence,
media, or source identifiers. Its disclosure says that the tile service may receive
viewport and tile requests. A production tile/style provider remains deliberately
unconfigured because MapLibre documents its demo tiles as development-only.

The view renders map points as a local GeoJSON source, supports selection by a
coarsened anchor, and keeps the Timeline fallback if an old development client
lacks the native module. Focused Atlas coverage passed 14 tests with TypeScript
and Expo lint; full mobile Jest passed 28 suites / 235 tests, and root `npm run
check` passed. The fresh debug APK includes `libmaplibre.so` and no Google Maps
package. `npx expo run:android --device 2211133G --no-bundler` built successfully,
installed it, and opened the development deep link on the connected device. The
owner must still validate the visible MapLibre surface. This is not a production
map-service decision or a proof of external-provider privacy behavior.

## Atlas map journey preview specification (2026-10-15)

The owner requested a map-first exploration loop: tapping a journey point should
open a dismissible card over the map with trustworthy date/title context and a
local media preview. “See photos and videos” should open a private gallery and
return to the same map camera, selected point and year filter; X or an empty-map
tap should close the card without taking the owner to Timeline. A secondary
“Review or correct journey” action opens the existing correction flow and must
restore valid map context on return. The planning
contract is [the Atlas journey preview spec](../_bmad-output/specs/spec-atlas-map-journey-preview/SPEC.md)
with interaction, acceptance, and brownfield companions. It distinguishes
owner-provided titles/dates from observed evidence, prohibits invented place
names from coarse anchors, and requires bounded media loading and a Timeline
fallback. The present Journey detail exposes only four preview memories, so a
full associated-media viewer still requires implementation. The owner confirmed
that videos belong in the same gallery and that correction belongs on the card;
those choices are now recorded as acceptance cases. No app code was changed for
this specification.

## Atlas map journey preview implementation (2026-10-15)

Atlas now keeps selected journey context in place, loads the current private
journey projection behind the opaque display ID, and presents a dismissible
Living Atlas preview card rather than requiring the detail route. The card
separates owner claims from observed evidence, has a photos-and-videos entry,
and offers correction directly. A private in-memory return context restores the
Map/Timeline choice, year, and selected opaque ID after backing out of a
map-origin correction. It never holds media source IDs or media data.

The viewer renders only device-local available media returned by the existing
bounded preview resolver. Videos are muted and require an explicit Play action;
they pause on background or viewer close. The current local detail resolver is
still bounded to four associated entries, so this does not establish an
unbounded associated-media album. Focused Atlas/detail tests (19 tests), mobile
TypeScript, Expo lint, root `npm run check`, and `git diff --check` passed.
Physical iOS/Android map hit testing, safe areas, background playback, and
correction return remain unverified.

## Atlas map and journey-list refinement requirements (2026-10-15)

The owner requested detailed requirements for a lean, minimalist, professional
Atlas while retaining MapLibre. The new
[refinement contract](../_bmad-output/specs/spec-atlas-map-and-list-refinement/SPEC.md)
defines compact header/summary/filter controls, a generous quiet map, restrained
selected points, and flat year-grouped journey rows below. Visual, interaction,
brownfield and Given/When/Then acceptance companions capture the detailed work.
The existing journey-preview contract remains mandatory, including paged local
photos/videos, overlap choice, camera preservation and safe correction return.
The current partial viewer and return context are not treated as completed
evidence for those requirements. Basemap styling is separate from MapLibre's
renderer; a production source/provider remains unselected. Portrait sizing and
latest-first comparable ordering are explicit working defaults. This turn changes
requirements only; no app code or device results are added.
Document checks passed for five stable capabilities, 23 acceptance cases and
all companion paths; root `npm run check` and `git diff --check` passed.

## Atlas map and journey-list refinement implementation (2026-10-15)

Atlas now leads with a compact private header, reachable map disclosure, shared
year filter, larger MapLibre surface, muted ordinary anchors, a distinct citrus
selected anchor, explicit overlap choice, an in-place preview, and concise local
journey rows. The redacted fallback title is `Private journey`, not an ordinal or
invented place. The selected gallery now reads stable pages of at most 12 mixed
local associations from the current completed projection; source references are
resolved only by the local photo adapter after explicit entry, and videos remain
muted and stopped until Play. Page reads and preview reads are lifecycle and
generation guarded, so stale or revoked content does not publish.

Focused Atlas, provider, and reconstruction-repository suites passed 47 tests;
mobile typecheck and Expo lint passed; root `npm run check` and `git diff --check`
passed. The Jest sandbox cannot rename its cache files, so focused Jest ran
outside that sandbox after the documented EP-010 retry. Native iOS/Android
validation remains required for actual MapLibre overlap/empty-map hit testing,
the actual MapLibre pan/zoom event and correction-return behavior, safe-area/
large-text layout, gallery Back and video background pause. A production map
provider remains deliberately unselected. The implementation now stores only a
coarse `[longitude, latitude]` plus zoom in ephemeral Atlas context when
MapLibre reports a region change; this is never persisted or sent to the tile
service.

Independent review then added source-press/overlap and gallery page/retry
coverage, corrected latest-first durable ordering, antimeridian framing,
filtered-anchor recovery, Timeline preview errors and gallery retry behavior.
The focused mobile suites now pass 49 tests alongside typecheck, lint, root
checks and whitespace validation. Device interaction remains unverified; it is
not implied by the mocked MapLibre or Expo Video suites.

The final full mobile check passed all 28 suites / 237 tests with TypeScript and
lint. Expo Doctor remains 20/21 because nine Expo SDK packages are one patch
version behind its current recommendation; this pre-existing dependency drift is
recorded separately and was not changed as part of Atlas.

## Android Atlas rebuild and smoke validation (2026-10-15)

The fresh debug Android build installed successfully and loaded the current
Atlas route on the connected physical device. The MapLibre surface initialized
without the prior marker crash. During the first native smoke run, the
OS-invoked maintenance task exposed a real nested SQLite transaction error:
foreground and maintenance repository wrappers can share Expo SQLite's native
connection. A shared transaction gate now serializes every explicit transaction
across import and reconstruction wrappers, including migration. The regression
uses two repository wrappers around one database double; it proves that the
second transaction waits for the first to commit.

Focused device-fix coverage passed 4 suites / 41 tests; the complete mobile
check passed 29 suites / 238 tests, plus typecheck and lint. Expo Doctor remains
20/21 due to the existing nine SDK patch-version recommendations. The rebuilt
device registered the maintenance task and opened Atlas/MapLibre without a
nested-transaction, fatal, React Native, marker, or bundle-load error in
filtered native logs. Android did not execute a new scheduled maintenance
callback during the observed smoke window, so this repair remains a
code-level/device-startup mitigation until that callback is observed. The
registered job was subsequently forced once through Android JobScheduler; it
logged that it was executing and remained active during a bounded observation
window without an error, but its completion was not observed. No
screenshots, raw media, coordinates, or device
identifiers were retained. Direct private UI interaction—point overlap choice,
empty-map dismissal, gallery Back/video pause, and correction return—still
needs owner-performed visual validation because this check deliberately did not
read or capture private screen content.

## Android Atlas processing-map repair (2026-10-15)

The owner photo showed a responsive selected journey card and list but no map.
That was not a MapLibre native-module failure: reconciliation correctly marked
the current record as processing, while Atlas incorrectly hid its existing
durable map projection unless the record was ready. Atlas now keeps a non-empty
durable map/list/filter projection available during processing, with the
not-final warning retained and Replay still unavailable. It also uses MapLibre's
texture-backed Android view so the map composes beneath the React preview card,
stops source presses from bubbling into the empty-map dismiss action, and
switches to the Timeline fallback if style loading fails.

Focused Atlas coverage passed 18 tests with mobile typecheck, Expo lint and
whitespace validation. A physical device rerun remains required to confirm the
visible map beneath the card and its touch/overlay behavior; mocked MapLibre
tests are not proof of native composition or tile rendering.

The follow-up debug APK rebuilt and installed on Android. Filtered native logs
confirmed the texture-backed MapLibre manager loaded and Atlas opened without a
React Native, SQLite, marker, or bundle-load error. The owner still needs to
confirm the rendered map/card composition and touch behavior visually; no
private screen capture was collected for that check.

## Android Atlas gesture and point-selection repair (2026-10-15)

The owner confirmed the texture-backed map is visible, then reported that its
pan/zoom felt unsmooth and that journey-point taps did not open a preview. Atlas
now disables the enclosing screen scroll while the native map owns a touch or a
region gesture, then restores normal page scrolling at gesture end. MapLibre's
pan, pinch, and double-tap zoom are explicit at its 60 FPS target, and the local
coarsened-source hitbox is enlarged for reliable point selection. No map anchor
precision, media reference, or provider configuration changed.

Focused Atlas interaction coverage passed 19 tests; the complete mobile check
passed 29 suites / 241 tests with TypeScript and Expo lint. Expo Doctor remains
20/21 solely due to the existing nine Expo SDK patch-version recommendations.
Physical Android verification is still required: pan/zoom should feel direct,
point taps should open the preview, and scrolling should resume immediately
after leaving the map gesture.

The JavaScript-only repair was then loaded into the connected Android
development client without a native rebuild. Atlas opened with no filtered
fatal, React Native, marker, SQLite-lock, or bundle-load error. The remaining
acceptance evidence is owner-performed touch confirmation; no private screen
capture was taken.

During the follow-up device validation Metro had stopped, leaving the connected
development client with no local bundle to load. Metro was restarted in
development-client mode, port 8081 and the ADB reverse tunnel were restored,
and Android accepted a fresh Atlas launch. This is a recovered development
server lifecycle issue, not evidence of a native Atlas crash; owner visual
confirmation remains required.

## Atlas visible associated-photo repair (2026-10-15)

The owner correctly observed that Atlas did not visibly show photos. The local
media resolver and full-screen viewer existed, but the map card and gallery
rendered only text labels. Atlas now renders the first accessible associated
local photo in the selected journey card and photo thumbnails for the bounded
gallery page; unavailable and video entries retain explicit non-fictional
placeholders and do not trigger a download. Focused Atlas coverage passed 19
tests and the complete mobile suite passed 29 suites / 241 tests with
TypeScript and cache-free lint. A physical Android confirmation is still
required; no private photo was inspected or captured during implementation.

The first Android gallery recheck showed every association as unavailable. The
cause was confirmed: Expo Media Library's `getIsInCloud()` is iOS-only, but the
preview resolver called it on Android; its thrown unsupported-platform error was
mistaken for an unavailable image. The resolver now performs the cloud check on
iOS only and reads permitted Android local URIs directly. Focused Atlas/native
adapter coverage passed 27 tests and the full mobile suite passed 29 suites /
242 tests. The updated bundle still requires an owner device check.

After Android was reauthorized for ADB, the repaired local bundle loaded and
Atlas opened without a filtered app startup error. The owner must now confirm
that selecting a journey and opening its gallery displays local photos; no
private photo content was collected during this validation.

The next owner screenshot showed that previously imported Android media remained
labelled unavailable. Those records carry an `unknown` persisted availability
when their original Android import could not perform the iOS-only cloud probe;
the repository had incorrectly removed their bounded local references before
the current-permission resolver could check them. Atlas now withholds only
confirmed-unavailable sources and attempts the bounded `unknown` set locally.
The gallery distinguishes that transitional state from a confirmed unavailable
asset. A new repository regression proves the source is retained; focused
coverage passed 51 tests and the full mobile suite passed 29 suites / 243
tests, with TypeScript and cache-free Expo lint. Expo Doctor remains 20/21
solely due to the pre-existing nine Expo SDK patch-version recommendations.
The JavaScript-only bundle still needs a physical owner check; no private media
or device identifier is recorded here.

The connected Android development client has now been relaunched with this
unknown-reference correction. The Metro tunnel was restored and a
privacy-filtered, application-process-only startup check found no fatal, React
Native, bundle-load, marker, or SQLite-lock error. This confirms only that the
bundle starts; the owner must still confirm visible photo thumbnails in the
gallery.

## Continuous trips and album interaction implementation (2026-10-16)

Implemented the first V1.1 continuity pass before persistence for unreviewed
graphs: it merges only adjacent fragments that are both at least 50 km from a
frequently observed (12 distinct local days) base and separated by no more
than ten days. It does not use city or country as a grouping key, and it skips
owner-corrected graphs rather than silently remapping corrections. This enables
a continuous multi-city trip while retaining an interruption-safe base check;
the wider canonical base/routine pipeline remains the outstanding release
hardening work in the V1.1 spec.

Atlas durable projection now derives offline coarse country labels and month
ranges entirely on-device. A map-dot or Timeline selection opens one
viewport-level native preview sheet, preserving the underlying Atlas state.
The media action opens a full-screen three-column local album grid with
mixed-media placeholders and returns to the selected journey preview. Gallery
reads are bounded to 60 items per page. Focused host verification passed 49
tests plus TypeScript and cache-free lint; root `npm run check` and
`git diff --check` pass. Android physical confirmation of the sheet position,
grid scrolling, return path, and the owner library's actual continuity result
is still required; no private media or precise location was collected.

The first post-change owner screenshot still showed split October Taiwan rows
and a failed reconstruction state over the prior durable record. The continuity
limit was expanded from 72 hours to ten days while retaining the frequent-base
and far-away gates; a seven-day multi-city regression now passes. The connected
Android client was relaunched against Metro after this correction, and a
privacy-filtered application-process startup check found no fatal, React Native,
SQLite-lock, or bundle-load error. The owner must now invoke the local rebuild
and confirm its actual result; startup success does not prove reconstruction
recall or quality.

The next correction removed the two generic root causes exposed by the device
examples: effective corrections now pin only their exact matched journeys, so
unrelated unreviewed episodes still receive the bounded away-from-base
continuity pass; and a place country label is now a consensus over all of its
supported members rather than a single deterministic representative. Border,
invalid, and conflicting-country evidence abstains rather than inventing a
location. Synthetic regressions and the complete mobile check (29 suites / 252
tests, typecheck and lint) pass. This remains unverified against the private
library until the next local rebuild.

The ready Atlas now also exposes **Rebuild local journey history**. It invokes
the full reconstruction controller rebuild (not the incremental catch-up
queue), so an owner can apply an updated local engine to the already imported
library without waiting for a failure state. Its UI interaction regression and
physical Android rebuild remain required before this is considered device
accepted.

While that rebuild runs, Atlas now presents an explicit busy notice: it says
that saved evidence and trips are being recalculated, retains the last map for
reference, and tells the owner that the map and journey list refresh
automatically when the notice disappears. It intentionally reports no invented
percentage or estimated time because the current local transaction does not
produce reliable phase counts. The focused Atlas UI suite passes 20 tests and
TypeScript passes; the connected Android device must be reauthorized to ADB
before physical confirmation can resume.

## Obsidian Horizon Atlas presentation implementation (2026-10-17)

The private native Atlas now uses its approved Atlas-only Obsidian Horizon /
Deep Sea Glass presentation: a deep-navy map surface, glass local-search and
filter region, labelled local zoom/reset controls, and cyan/amber/gold map
affordances. Search operates exclusively on the currently visible redacted
journey projection and clears a filtered-out card selection without a network
or telemetry path. Existing guarded media, correction return, overlap selection,
coarse MapLibre payload and Timeline fallback remain intact; no provider,
dependency, schema, reconstruction, route, or browser-map capability changed.

Focused Atlas verification passed 22 tests outside the known sandbox Jest cache
boundary. The complete mobile check passed 29 suites / 270 tests, TypeScript and
lint; root `npm run check` and `git diff --check` passed. Expo Doctor remains
20/21 due to the pre-existing nine Expo SDK patch-version recommendations. Native
Android/iOS portrait and wide/tablet visual checks, large text, provider-request
inspection, 1,000-row stress, and production map-provider selection remain
unverified and are not implied by mocked MapLibre tests.

## Obsidian Horizon Atlas visibility correction (2026-10-18)

The new map treatment is now visibly available in the browser-delivered
synthetic prototype at `/reveal`: its bundled local geography uses the approved
Deep Sea Glass palette, cyan/amber selected anchors, gold cartography labels,
glass controls, and the “EXPLORE THE WORLD” map hierarchy. The native Atlas
also retains a provider-free local visual canvas whenever web, production, an
older client, sparse evidence, or a MapLibre style failure makes the optional
native map unavailable. That canvas plots only existing coarse anchors; it
does not request tiles or invent locations. Nonfunctional zoom controls are
hidden on that fallback.

Prototype owner-flow tests (18) and its complete check (27 total Jest tests,
typecheck, lint) pass. Mobile focused Atlas tests (22), mobile typecheck, and
whitespace validation also pass. The browser-native mobile app cannot yet be
visually checked because its existing Expo SQLite worker bundle fails before
the route mounts; Android confirmation remains blocked because the local ADB
daemon cannot start. Neither limitation is presented as proof of product UI.

## Reference-faithful map specification (2026-10-18)

The owner clarified that the map visual must match `World Map.jpg`; they
temporarily deferred the search/utility treatment, left mode dock,
compass/slider, route arcs and polished persistent card. The existing blue
fictional geography/grid canvas remains a visual mismatch, despite earlier
visibility and automated-check claims. It is not an accepted reproduction.

The canonical delivery plan is
[`spec-atlas-reference-cartography`](../_bmad-output/specs/spec-atlas-reference-cartography/SPEC.md),
with visual acceptance, cartography architecture and development-plan
companions. Decision 0013 records scope precedence and permits flat baked
geographic shading while excluding runtime 3D terrain. The proposed approach
uses a licensed bundled world base and a common projection for browser/native
markers; source/renderer suitability remains a measured feasibility gate.

Five gates cover baseline/reference freeze, geographic/rendering proof,
owner-accepted visual master, browser/native integration and actual platform
delivery. Twenty acceptance cases cover visual fidelity, geographic alignment,
state/privacy, offline/release reachability and resources. This turn creates
planning records only; no new cartography is implemented or visually accepted.
Planning validation passed capability/acceptance uniqueness, companion/local
links and template-marker checks. Root `npm run check` passed framework
integrity, 20 foundation tests and eval smoke; whitespace validation passed.

## Owner-confirmed destination anchor (2026-10-18)

Journey correction now supports a private, offline place search and an explicit
owner-confirmed destination anchor. The first bundled result supports `Phú
Quốc, Kiên Giang, Vietnam` (including the unaccented query `Phu Quoc`). Saving
it preserves inferred Kiên Giang and all observed evidence, while the qualified
Atlas projection uses the selected place label and a deliberately coarse marker
anchor. The correction is schema-versioned, remaps only through the existing
stable-support correction contract, and becomes pending review rather than
silently moving after an ambiguous rebuild or split/merge.

Focused correction and migration regressions pass (67 tests), and mobile
TypeScript passes. A fresh arm64 Android debug build was installed over the
existing development app without clearing local data and cold-launched against
the current Travel Life Metro process; no filtered fatal-startup error appeared.
Owner-visible confirmation of the selected marker still remains a manual check.
Full mobile lint is currently blocked by unrelated concurrent cartography
ref-in-render errors.

**Interaction follow-up:** The correction screen now keeps place-result taps
available while the search keyboard is open, and shows the selected place's
confirmation action directly beneath the result. This fixes the owner-reported
inability to choose and confirm a place. Focused correction regression passes
(10/10), mobile TypeScript passes, and the Android development client was
reloaded against a fresh Android bundle. The owner still needs to complete the
real-device choice and save interaction.

**Owner UX correction:** The one-place demonstration catalogue was replaced by
an offline worldwide search over the already-bundled Natural Earth Admin-1
gazetteer, plus the reviewed Phú Quốc island result. Results such as Bali,
Tokyo, Hanoi, and Bangkok are now selectable without sending the query or any
trip data off-device; the marker remains deliberately coarse. The place-save
outcome now appears directly beside confirmation with a direct return to Atlas.
The noisy `Correct location` control was removed from every Timeline row;
owners reach correction through the selected trip preview/detail instead.
Focused correction/search regressions pass (11/11), Atlas regression passes
(22/22), and mobile TypeScript passes. Android reload remains the next device
acceptance check. The Android development client has now received fresh Metro
bundle `bj` (98 ms) and resumed; owner confirmation of the real save and marker
movement remains required.

**Correction entry and persistence follow-up:** The selected journey preview
and detail now name the single contextual action `Correct location`; it saves
the selected Atlas context before navigating to the correction screen. The
action remains absent from every Timeline row. A repository-level regression
now verifies that selecting Phú Quốc persists its offline place ID, display
name, context, and coarse anchor and writes the remappable correction
application; the route regression verifies the selected opaque journey and
Atlas context reach the correction handler. Focused location regressions pass
(71 tests) and mobile TypeScript passes. The Android development app was then
cold-relaunched on device `9cb47ed9` against a fresh local Metro server without
clearing data; its current-process logs contain no bundle or module-loading
error. Owner confirmation of the tap, private save, and marker movement remains
the acceptance check rather than claimed from startup alone.

**Final-identity correction:** A real owner save exposed that a `place`
revision had been applied to a pre-continuity journey ID instead of the final
canonical journey committed for Atlas. The correction is now remapped again
after continuity construction and that final mapping drives both correction
application and owner-confirmed qualification. A regression covers an
intermediate ID replaced by one final canonical successor. Focused
correction/Atlas/search/repository checks pass (74 tests), TypeScript and root
`npm run check` pass, and the existing Android development app was reloaded on
`9cb47ed9` without clearing data; no current-process startup/module error was
observed. The owner must confirm the re-saved place visibly moves the marker
and changes the label; no device data claim is inferred from process startup.

**Owner rejection of final-identity repair (2026-10-18):** The owner re-confirmed
the selected place on Android and reports that the trip still does not change.
The prior correction therefore remains unaccepted; the unresolved cause is
unknown. The correction screen also leaves the old search text after a result
is chosen and separates confirmation into a second panel. BMAD Party is
revisiting the one-task UX and the save-to-projection contract. Next work is to
trace this specific journey through saved revision, application, committed
qualification and durable reveal; a successful build or fixture alone is not
evidence of the visible correction.

**Owner Edit-flow direction (2026-10-18):** The selected trip card should show
`Edit` immediately below `See photos & videos`. `Correct location` is one
independent task inside that common Edit flow, not a competing top-level CTA.
The owner asks for a review of all current Edit UI/UX: lean, low-copy,
intuitive, and self-service. The current all-in-one correction screen remains
under review; no UI implementation or save repair is claimed by this decision.

**Edit-flow plan:** The owner approved five Edit tasks: Location, Name & dates,
Destinations, Photos in this trip, and Trip accuracy. The delivery sequence,
UX states, correction read-back gate, migration needs, tests and
device acceptance are in
`_bmad-output/implementation-artifacts/trip-edit-flow-plan-2026-10-18.md`.
Planning only: the Phú Quốc save failure is still open, and no redesigned
screen or corrected runtime behavior is claimed yet.

**Trip Edit implementation (2026-10-19):** The approved compact Edit hub is
implemented: Location, Name & dates, Destinations, Photos in this trip, and
Trip accuracy open independently from a selected journey. Atlas presents
`Edit` directly below `See photos & videos`; the legacy correction deep link
now uses the same focused Location screen. Selecting an offline place writes
its label back into the field and keeps `Confirm place` in that same panel.
A place correction returns `applied` only after both the final journey detail
and durable Atlas projection match its owner-confirmed place, label, and coarse
anchor. If continuity gives that trip a new opaque ID, the provider accepts
only one durable successor with the exact selected label/anchor and verifies
its detail before reporting success. The focused mobile suite passes 53 tests,
TypeScript and lint pass.
**Android owner acceptance (2026-10-19):** The owner confirmed that the
journey Edit → Location flow works on the physical device: a saved choice moves
the intended marker and persists after reopening. This closes the outstanding
Android acceptance gate for this focused correction flow. It does not establish
iOS behavior, unrelated edit tasks, reconstruction accuracy, or general map
cartography acceptance.

**Device delivery follow-up:** The first post-reload device view revealed a
Dev Launcher `Unable to load script` screen, so earlier process-only evidence
was insufficient. The local Metro status endpoint and ADB reverse mapping were
re-established; cold-launch then visibly rendered Travel Life's Welcome screen
without clearing device data. The device policy rejects automated touch input,
so opening the existing private Atlas and completing the re-save was an
owner-operated acceptance check; the owner subsequently confirmed it works.

## Atlas readable cartography implementation (2026-10-18)

**Owner acceptance supersession:** The owner rejected the border appearance.
The earlier implementation is not visually accepted. Renewed reference review
and official Google gesture/style/camera research are recorded in
`_bmad-output/specs/spec-atlas-cartographic-exploration/visual-recovery-plan.md`
and `google-maps-experience-research.md`. The new plan preserves CAP-1..5 and
adds AC-25..27, replaces heavy global casing, requires shared topology and
scale-specific geometry, and makes native visual evidence a delivery gate.
Source reinspection also disproves the previous projection review: adding a
second 1.6 factor introduced base/marker versus tile/border misalignment. P0
must correct and independently validate it before visual tuning. This turn is
research/planning only; no new application fix or live Google-app test is claimed.

The native offline Atlas now separates cartography from the raster relief:
Natural Earth Admin0 country paths render as a projection-aligned SVG overlay,
with screen-stable gold/cyan boundary casing; public country/locality labels
use deterministic zoom bands, collision avoidance and halos; and co-located
real journey anchors become a visible count cluster that opens the existing
chooser. The relief and deep-zoom tile pyramid no longer bake labels or country
borders, so the overlays remain sharp as camera scale changes. No provider,
network request, road/POI/routing layer, precise location or reconstruction
contract was added.

Vietnam's current provincial layer is explicitly unavailable: its existing
63-region data cannot be presented as the current 34-unit administrative map.
The map instead shows country/locality context and tells the owner that
provincial boundaries are being verified. A current layer remains blocked on
pinned redistributable provenance and topology checks.

Public boundary/relief/tile generators and verifier passed. Focused map tests
(10) and the complete mobile check (33 suites / 293 tests), TypeScript, lint,
root `npm run check`, and whitespace validation passed. A fresh Android dev
build compiled `react-native-svg`, installed the debug APK, and opened on the
connected `2211133G` device. Expo Doctor remains 20/21 due to nine existing
Expo patch-version recommendations; `npm install` also reported 67 existing
dependency audit advisories, deliberately not force-remediated in this visual
feature. Device visual fidelity, real finger gestures, large text, iOS, and
the verified Vietnam Admin1 data gate remain open acceptance checks.

## M4.2 manual journey rerun (2026-10-19)

The private SQLite record now has an additive v33 `manual_journey` store for a
separate owner-entered journey assertion. It stores a one-decimal coarse anchor
and exact or ordered approximate date claim, is deleted with local history, is
read back before reporting success, and is unioned into the redacted Atlas and
detail projection without evidence, visit support, media, inferred totals, or
recovery metrics. The Atlas offers the entry flow from ready, sparse, and
failed states, preserves its context, labels owner-entered records separately,
excludes them from Home-base and correction Edit, and requires overlap review
again inside the write transaction. The full mobile suite passes 37 suites / 313
tests, TypeScript and lint pass, and root `npm run check` passes. Expo Doctor
remains 20/21 because of the existing nine Expo SDK patch-version
recommendations. Android/iOS manual-flow acceptance remains unrun.

## Performance and responsiveness architecture review (2026-10-19)

An architecture review of post-build startup, reconstruction, catch-up, and
owner-save paths finds credible responsiveness risk but no measured device
latency yet. One serialized SQLite transaction reads all evidence, runs
synchronous JavaScript derivation, and persists a complete derived graph through
many awaited writes. This correctly preserves the last committed private Atlas
and prevents overlapping transactions, but it can make a rebuild feel frozen.
The current UI has only a generic running state; in particular, a visible
`Catch up locally` action can be tapped during a running operation even though
the controller intentionally returns without acknowledgement.

The approved architecture direction is a dedicated local-operation
responsiveness story: phase-aware truthful busy state, one-frame acknowledgement,
duplicate-action feedback/coalescing, correction save phases, and local-safe
aggregate timing records. It must retain atomic publication, durable correction
read-back, the stale-result lifecycle guard, and last-committed Atlas/media
browsing. No private-library/device timing, frame-rate, battery, or reconstruction
accuracy was measured. The full rationale and acceptance checks are in
`_bmad-output/planning-artifacts/reviews/2026-10-19-performance-and-responsiveness-architecture-review.md`.

## Private-record manual-entry recovery (2026-10-19)

Atlas now checks private-record availability before opening the manual-journey
form. A deleted record offers an explicit local-storage creation path; a
disconnected record offers reconnect. Both retain the Atlas navigation context,
show in-place progress, disable duplicate lifecycle actions, and show only a
safe retry message on failure. Creating a record is explicitly described as
local storage only: it does not scan, import, or alter photos. The existing
provider and repository save boundary remains the final lifecycle-race guard.

The native repository already cleared a rejected open promise; a regression now
proves a later successful open is not poisoned by the first failed attempt.
Focused host verification passed 7 suites / 80 tests, including lifecycle
pending/failure/retry and the disconnected Atlas preflight. Full mobile
verification passed 37 suites / 320 tests, TypeScript, and lint; Expo Doctor
remains 20/21 due to the existing nine Expo SDK patch-version recommendations.
Root `npm run check` also passed. Android/iOS device confirmation of the
create/reconnect-to-manual-entry flow, including visual pending/error feedback,
remains required.

## Private Atlas reconstruction speed (2026-10-20)

The dense-place minimax representative now scores each candidate once rather
than recomputing the score for every sort comparison. Link and disposition
projection writes use bounded multi-row SQLite inserts in the existing atomic
transaction; neither the inference rules nor the last committed Atlas is
intentionally changed. Atlas distinguishes a queued local update from an
operation actually running, so waiting changes can be caught up while the
committed map and Timeline remain browsable. An active rebuild disables its
duplicate catch-up action.

Three paired runs on the same synthetic 2,000-record dense-place fixture gave
baseline/current pure-engine times of 6,454/686, 5,704/750, and 5,875/701 ms;
the complete graph hash matched in all six runs. This demonstrates an engine
improvement for that synthetic case, not a measured full-build or device speed.
Independent review then tightened the SQLite path to stream bounded batches
rather than retain all links in memory, reject a single oversized row before
the native bridge, and test exact inserted tuples. Reconciliation now exposes
separate aggregate queue and unresolved-remap counts, so an owner correction
that needs review is not presented as a no-op catch-up. A failed queue can
retry through the queue-consuming action. The final host mobile Jest suite
passed 37 suites / 332 tests, TypeScript, lint and whitespace validation
passed, and root `npm run check` passed. Expo Doctor was blocked by registry DNS
`ENOTFOUND`, so the combined mobile check is not claimed as passing. Android
ADB listed no attached device; Android/iOS full-rebuild timing and visual
confirmation remain required. A concurrent, unrelated private-schema migration
change was preserved in the shared worktree; it was not part of this speed task.

Device acceptance has now started but is not complete. On the connected Android
development client, the current Atlas bundle showed the waiting state and the
owner tapped `Catch up locally` once. It entered the updating state, then
returned to waiting with a failed-reveal message in about 20 seconds. This is
not a successful full-device speed measurement; the catch-up failure cause is
still unknown. A focused, privacy-safe diagnostic now logs only a fixed error
category rather than the raw native exception. Its test went RED then GREEN;
the full mobile suite passed 37 suites / 334 tests, TypeScript and lint passed,
and root `npm run check` passed. The private database was not copied for
diagnostics. Two sandbox-started Metro attempts on port 8085 did not answer
host status requests; the current checkout now runs through host networking
and returns `packager-status:running`. ADB still no longer lists the phone, so
the refreshed diagnostic bundle has not yet run on-device. Next:
restore USB debugging, load this exact bundle, retry catch-up once, read the
fixed diagnostic category, fix the identified failure, and only then measure
the successful rebuild and catch-up latency. No Git commit or push was made.

USB debugging was restored: ADB again lists the authorized Android device,
and the current host Metro 8085 status endpoint responds. A cold launch now
shows Expo Dev Launcher with the current 8085 server available, but this phone
rejects ADB-injected taps (`INJECT_EVENTS`). The owner must select that visible
server card before the refreshed bundle and catch-up diagnostic can be
observed; no second catch-up has been triggered yet.

The owner then opened the current Android bundle (1,657 modules, followed by a
one-module diagnostic refresh) and twice tapped Atlas catch-up on request.
Both runs entered the updating state but returned to failed/waiting, so neither
is a successful device speed sample. The first emitted only fixed diagnostic
code `OWNER_REVIEW`; the second emitted `DATABASE_BUSY`. The former covers two
protected-correction branches, so a focused RED/GREEN test split the safe
codes into `HISTORY_REVIEW` and `JOURNEY_REMAP`, but no device run has yet
identified which branch occurred first. The latter identifies SQLite lock
contention without identifying its stage or competing writer. No private
exception text, place, media, or database contents were exported. Owner input
on automatic-maintenance status is pending. The Atlas queue and last committed
record remain untouched; the full-device latency claim remains open.

The owner then confirmed automatic maintenance was enabled and its latest local
check had completed, followed by one more owner-operated retry that again
reported `DATABASE_BUSY`. This does not prove which writer holds SQLite, but
it means an active foreground maintenance check is no longer the assumed cause.
The native reconciliation boundary now returns an internal fixed stage for a
failure at lease acquisition, queue read, rebuild, outcome read/save, or lease
release; the controller logs only the fixed error category and stage, never the
underlying SQLite message. Lease acquisition is included in this boundary and a
best-effort outcome-state write cannot overwrite the original stage. RED/GREEN
stage/privacy regressions passed; full mobile Jest passed 37 suites / 338 tests,
with TypeScript, lint, and root `npm run check` also passing. The refreshed
Android bundle still needs one owner tap to identify the actual fixed stage,
after which only the demonstrated contention path should be corrected. No Git
commit or push was made.

That owner tap reported `DATABASE_BUSY LEASE`: contention occurs before any
reconstruction work begins. App activation can queue automatic maintenance in
the same JavaScript runtime just before the visible Atlas action requests its
own SQLite writer lease. Atlas now waits for that already queued maintenance
transition before requesting its lease; it does not weaken the lease, retry
blindly, or change private history. A RED/GREEN coordination regression passed,
along with focused 67 tests, mobile TypeScript and lint, full mobile Jest (37
suites / 339 tests), and root `npm run check`. This synchronizes known
foreground writers only; a new `DATABASE_BUSY LEASE` after the refreshed device
test would instead point to an OS/native or other external writer. One
owner-operated catch-up on the refreshed bundle remains required; no Git commit
or push was made.

The next device retry still emitted `DATABASE_BUSY LEASE`, so foreground
maintenance coordination alone was insufficient. The reconstruction lease now
first reads the durable OS-maintenance lease. If an active background task owns
it, Atlas treats that as the existing safe “another local catch-up is running”
state and makes no immediate SQLite write, rather than surfacing a failed
catch-up. The owner can keep browsing the committed Atlas while that task
finishes. This does not claim every native lock is explained; a repeated busy
error after this bundle would warrant a separate native-lock investigation.
Focused tests (52), full mobile Jest (37 suites / 340 tests), TypeScript, lint,
and root `npm run check` pass. One owner-operated device retry on the refreshed
bundle remains required; no Git commit or push was made.

The OS-maintenance lease deferral did not yet eliminate a delayed busy outcome.
The safe diagnostic now separates connection open, maintenance-lease read, and
reconciliation-lease write. A device retry must report one of those fixed
stages before altering native SQLite configuration or transaction behavior.
Focused diagnostic tests, TypeScript, lint, full mobile Jest (37 suites / 340
tests), and root `npm run check` pass. No private SQLite message is logged,
exported, or stored in project artifacts.

The refined device result was `DATABASE_BUSY LEASE_WRITE`: no maintenance lease
was visible initially, but a background task can begin between that read and
the foreground write. On this exact busy path Atlas now performs one read-only
recheck for a freshly created maintenance lease. It safely defers if present;
otherwise it preserves the real busy diagnostic without blind transaction
retries. Focused tests (53), full mobile Jest (37 suites / 341 tests),
TypeScript, lint, and root `npm run check` pass. The updated bundle needs one
owner-operated catch-up confirmation; no Git commit or push was made.

The owner then performed that confirmation after a cold Android restart (force
stop and relaunch, with no app data cleared). The fixed safe result changed
from `DATABASE_BUSY LEASE_WRITE` to `JOURNEY_REMAP REBUILD`. This confirms a
fresh process can open the local database and reach the protected remap check;
it does not demonstrate a durable automatic recovery for the prior in-process
native SQLite lock. The remap remains owner-controlled, the committed Atlas is
still browsable, and no successful rebuild-latency claim is made. The
process-lifecycle lock remains an open diagnostic; owner correction review is
separate from performance acceptance.

## Performance scope and private-record regression review (2026-10-20)

The owner reported that, after performance-focused work, metadata import and Atlas/journey reconstruction no longer complete. Review found the active uncommitted change set combines performance changes with schema v34, legacy Atlas continuity, journey qualification/publication changes, SQLite connection lifecycle changes, and correction-remapping behavior. The observed owner-device reconstruction result is `JOURNEY_REMAP REBUILD`, which is an owner-protection gate reached before a new Atlas projection is published; it is not a successful performance result. Metadata-import failure is currently rendered as a safe generic retry message, so its on-device category remains unobserved. Focused synthetic host suites pass (95 tests), but they do not validate the owner's existing private record or correction lineage. Freeze this combined scope; separate recovery/compatibility from performance work and do not alter or clear private history/corrections without an explicit, validated migration plan.

## Performance regression recovery (2026-10-20)

The recovery patch removes the unapproved schema v34 legacy-continuity migration and the corresponding Atlas qualification bypass. Devices already carrying the additive v34 marker are treated as forward-compatible and are not downgraded or re-migrated; the unused table is ignored. Import returns to the original cached connection model, while the reconstruction-only fresh connection for the verified Android released-handle failure remains. A completed metadata import now remains explicitly complete even if the follow-up protected Atlas rebuild needs recovery; the current committed Atlas stays available. The correction-remap safeguard remains intact: it still requires owner review rather than discarding or remapping a correction automatically. Focused recovery checks passed (111 tests), along with mobile typecheck, lint, and whitespace validation. Android owner validation is still required before this is considered repaired: import metadata once, then open/rebuild Atlas and confirm the committed journeys remain visible; report only the fixed diagnostic state if it fails.

The first owner retry exposed a separate acknowledgement defect: Import waited for the lifecycle/database read before rendering any state, so the tap appeared inert while SQLite was delayed. Import now synchronously says `Starting local metadata import…`, disables duplicate start, and renders a preparing state until page import reports progress. A delayed-lifecycle regression plus owner-flow/provider tests (42), typecheck, lint, and whitespace validation pass. The Android bundle must be refreshed before a retry; the prior bundle cannot show this correction.

The next recovery refinement closes a terminal-state gap: lifecycle or SQLite-read failures can be deliberately represented by the import coordinator as a durable paused/blocked coverage state rather than a rejected promise. The controller now replaces the immediate `Starting…` acknowledgement with a safe `paused` retry or `blocked` access message for both full and selected imports, and emits only a fixed diagnostic category. A regression covers a normal initial lifecycle read followed by a protected locked-read pause and confirms private native text is not surfaced. Focused controller/owner/provider tests pass (43); Android owner validation after a bundle refresh remains required. A same-session read-only ADB attempt could not connect to the host daemon, so no on-device error code was captured and no private data was read.

The owner then reported `database busy` from Import. The demonstrated same-runtime race is app activation queuing automatic maintenance while the owner can immediately start a metadata import against the same SQLite file. Full and selected imports now preserve their immediate acknowledgement but wait for that queued maintenance transition before their first repository read/write. This is serialization of a known writer, not a blind SQLite retry: the native busy timeout remains the boundary for a separate/native writer, and no private record, correction, lease, or metadata was changed to recover. A regression proves Import cannot read a metadata page before the maintenance wait settles; focused maintenance/import/provider tests (46), typecheck, lint, whitespace, the complete mobile Jest command, and root `npm run check` pass. The only remaining validation is one owner retry on a refreshed bundle.

That owner retry still reported `database busy`, proving the queued maintenance writer is not sufficient explanation. Recovery inspection found that a busy page commit caused the import coordinator to immediately attempt a second SQLite write merely to save a pause marker. It now retains the last confirmed durable checkpoint, performs no second write after a busy result, excludes the uncommitted page from counts, and presents a safe paused retry state. A regression verifies exactly one attempted write, no retained source, and no rejection when a page commit is busy; focused coordinator/controller/provider suites pass (63). The active external/native writer is still unproven. The next required evidence is one owner retry only after fully stopping and reopening the Android app on a refreshed bundle; no data clear, correction deletion, or Supabase change is justified.

Metadata import subsequently ran, but owner-triggered Atlas catch-up built failed. This is a separate reconciliation path and does not discard the prior committed Atlas. The first live failure did not expose its fixed category on screen, while a same-session read-only ADB diagnostic could not start/connect the host daemon. Catch-up now gives privacy-safe owner guidance for busy local storage, journey-correction remap review, history-correction review, schema recovery, or access; it never includes native error text or private record data. Focused reconstruction/Atlas/provider tests (60), typecheck, lint, and whitespace pass. Reload this bundle and report the fixed on-screen guidance before any reconstruction rule, correction, schema, or native connection change.

The first retry after that change still appeared inert because Catch up waited for an already queued maintenance operation before handing control to reconstruction. Atlas now acknowledges the tap immediately with a waiting notice while preserving the prior committed journeys; it neither claims reconstruction has begun nor takes a writer lease until maintenance settles. A regression proves the acknowledgement does not call rebuild; focused reconstruction/provider/Atlas/maintenance tests (63), typecheck, lint, and whitespace pass. Reload the bundle and tap once: the screen must first show the waiting notice, then complete or expose the fixed safe cause.

That acknowledgement was initially still invisible because the Atlas reveal projection replaced controller text with generic status copy. The projection now preserves the fixed owner-safe reconstruction message for running and error states, and both Atlas and Replay pass it through. A UI regression confirms the queued-maintenance waiting text renders; focused Atlas/controller/provider tests (62), typecheck, lint, and whitespace pass. A refreshed owner tap should now show the waiting state immediately before it either completes or presents the safe cause; no database or correction data has been changed.

The refreshed action now reaches `Updating your Atlas` but then showed a generic durable-read error. Source tracing found `catchUpHistory` could overwrite an already classified reconciliation outcome while attempting a post-rebuild durable Atlas reload. It now preserves any non-complete reconciliation result; if only the durable read fails after a complete reconciliation, it reports a fixed safe storage/schema/connection/access category and retains the last committed Atlas. Reconciliation-status reads are separately recoverable. Focused provider/controller/Atlas tests (62), typecheck, lint, and whitespace pass. One refreshed owner retry must provide the fixed on-screen category before any more targeted repair.

## Runtime diagnostic logging contract (2026-10-20)

Mobile runtime diagnostics now use one local typed console boundary. Every migrated event carries a closed operation and reason code, fixed reconciliation stage or null, retryability, durable outcome, and a locally generated non-record-derived correlation ID. Rebuild, catch-up, metadata import, durable reads, reveal retry, OS maintenance, and journey-place saves no longer log raw native error text; the correction save UI now retains only safe recovery copy. Production mobile lint rejects direct `console` calls outside that boundary. Focused host checks cover structured shape, private-sentinel redaction, import/retry terminal paths, and paused background maintenance. This is local development diagnostics only; it does not send or persist diagnostic events remotely.

Continuation audit added startup reconciliation-status and durable-read error events plus maintenance-controller failure events, so those recoverable UI states no longer discard their fixed cause. The Journey Edit regression suite now holds the unrelated shared reduced-motion lookup pending and no longer emits its React `act(...)` warning. Focused Journey Edit, the complete mobile Jest suite (38 suites / 357 tests), TypeScript, lint, root `npm run check`, and `git diff --check` pass. Device acceptance remains unnecessary for this logging-only change.

## Nonblocking journey-correction remap (2026-10-21)

Final committed-graph ambiguity no longer rolls back an otherwise valid Atlas reconstruction. The local transaction retains the correction as a pending remap candidate, commits and acknowledges the evidence-derived graph, and marks every current displayed journey supported by the reviewed evidence as `Needs review`. The compact label is visible in the Timeline and selected Atlas preview, where the existing Edit → Trip accuracy review flow remains the protected owner action. Structural and pre-final support-validation failures remain fail-closed. Focused reconciliation/Atlas/correction tests passed; final static and repository checks remain to be recorded after this in-progress worktree settles.

**Android startup transport recovery (2026-10-21):** The development app was unable to load because Metro was no longer listening on the configured Android port `8085`, not because of an observed import, Atlas, or private-record failure. A sandbox restart was rejected as invalid when the host status request timed out. Metro is now running from the host and `127.0.0.1:8085/status` returns `packager-status:running`; Android device `9cb47ed9` is connected with `tcp:8085` reverse restored. No app data was cleared or changed. Owner reload acceptance remains required before interpreting any later app screen failure as a bundle/runtime defect.

**Atlas native-lock recovery (2026-10-21):** The refreshed device then reported local storage busy while Atlas updates. This is treated as an in-process native SQLite lock recurrence; current runtime coordination already waits for foreground maintenance/import and checks the durable maintenance lease, but cannot prove an orphaned native handle has released. The connected Travel Life package was force-stopped and relaunched without clearing any storage, import state, correction, or Atlas history. One owner-operated catch-up on the fresh process is the remaining evidence before any further reconstruction or database change.

**Nonblocking correction-remap gap correction (2026-10-21):** Owner evidence exposed that a saved reviewable journey correction still blocked before the final graph because baseline/confirmed mappers used the former fail-closed path. Those intermediate maps now retain ambiguous `confirm`, `claim`, and `place` corrections as pending candidates; Atlas commits and labels every supported current journey `Needs review`. Grouping/structural corrections (`reject`, `split`, `merge`, `remove-visit`) remain protected and fail closed. Focused reconciliation/controller tests (59), mobile TypeScript, lint, and root `npm run check` pass. One fresh-bundle owner Catch up locally action must confirm the durable Atlas and label.

**Direct Atlas schema gate correction (2026-10-21):** The owner then reached the fixed safe schema-recovery state. Investigation found `reconcileQueued → rebuild` could begin a direct writer before `ensureNativeImportSchema`, despite Atlas durable-read already being gated. Direct rebuild now runs the additive local schema gate before its own transaction, while caller-owned correction transactions remain untouched. The regression asserts this call order; focused reconciliation/controller tests (60), mobile TypeScript, lint, and root `npm run check` pass. One owner Catch up locally on the refreshed bundle remains required; no private storage was reset or read externally.

**Queued reconciliation schema gate correction (2026-10-21):** The same schema-recovery state repeated, proving the direct rebuild gate was too late. `reconcileQueued` reads versioned maintenance/reconciliation leases before it calls rebuild, so it now gates schema immediately after opening the native connection and before all lease reads/writes. Direct-rebuild gating remains for other entry points. The regression locks this earlier ordering; focused reconciliation/controller tests (61), mobile TypeScript, lint, and root `npm run check` pass. A refreshed owner catch-up is required; no local history, correction, or import state was cleared.

**Schema-recovery recurrence and scope audit (2026-10-21):** The owner reports the same failure again and disputes isolation of the performance work. Runtime recovery is open, superseding any reading of the previous source corrections as a completed device fix. Current source includes both gates, but this audit has not established the installed bundle or failing schema object/stage. The performance spec forbids changing graph/correction rules; current WIP mixes multiple delivery records and cannot be attributed wholesale to that request. Next work must establish bundle and fixed-stage evidence, exercise retained-schema migration with synthetic real SQLite, and isolate any repair from unrelated performance/correction changes. This party audit changed documentation only; no runtime checks or device operations were performed.

## Consolidation candidate (2026-10-21)

The complete recovery candidate now lives on
`codex/worktree-consolidation-2026-10-21`, based on local main
`36458951cb11ca8b384053400e15841b240dccf3`. Named refs preserve the detached
responsiveness source, dimensional Atlas source, baseline main, and the full
captured main WIP (including its untracked-content parent) before restoration.
Current source is the behavioral baseline: retained-schema recovery, owner
correction review, durable Atlas/media continuity, and privacy-safe diagnostics
must not be replaced by older worktree implementations. The generated root Jest
cache is ignored and remains local-only. Automated checks and owner-operated
device flows are recorded against the final candidate commit; no publish,
worktree retirement, data reset, or performance claim is authorized by this
consolidation record.

## Replay / Edit Replay experience review (2026-10-26)

Owner requested BMAD party investigation and a coherent solution for slow media/audio loading, consecutive trip edits/exclusions and save-related disabled Update Replay. Review record: `_bmad-output/implementation-artifacts/replay-edit-flow-review-2026-10-26.md`. Source confirms unbounded save dependencies, full-manifest stage preflight, whole-page preview settlement and inconsistent Back boundaries. Existing six-lane preview loading, immediate audio-file readiness and final snapshot readback are retained as partial improvements. The SQLite lock holder remains unknown; the reported device issue is open.

Proposal only: one edit session, one in-flight plus one latest pending save, short owned writer transactions, explicit unknown-outcome reconciliation, Update accepting a request during autosave, viewport-prioritized incremental thumbnails and lean settings subdraft UX. No production implementation, Metro/device operation or storage clearing occurred. Replay screen suite rerun passes 49/49 with 15-second per-test timeout after an initial 5-second cache-open timeout; root check passes. Mock syntax/state checks pass; phone layout and actual latency remain unverified. Next delivery should implement the P0 writer/session boundary and validate device behavior before claiming the save incident resolved.

## Share Replay review patches (2026-10-27)

Share Replay now permits a selected committed card-only chapter to prepare, binds
the subset soundtrack to the committed parent rather than a working editor draft,
fences late subset renders on visible and native share-flow return, and preserves
stale handoff failures as a fixed scope diagnostic. The provider refreshes photo
permission before OS handoff. Focused screen regression coverage passes 69/69 and
mobile TypeScript passes. This is host/synthetic evidence only: a fresh
owner-operated Android/iOS build must still confirm recognizable cards, exact
preview, permission-change blocking, and target-system handoff.

## Replay save/responsiveness detailed spec (2026-10-26)

Owner requested a detailed spec and implementation plan following the party review. Canonical contract is `_bmad-output/specs/spec-replay-edit-save-and-responsiveness/SPEC.md`, with experience/state, architecture/persistence, implementation, verification and brownfield/precedence companions. Ten capabilities, thirty acceptance cases and eight ordered slices S0-S7 specify owned native writes and receipts, unified edit session/coalescer, exact aggregate Update, incremental thumbnails, audio subdraft/readiness and lean UI. Scoped overrides allow accepting Update during autosave and immediate context navigation, while preserving durable readback and prior privacy/finalization rules.

BMAD decision log and both self-validation passes are recorded; structural source/companion/ID/coverage validation and root check pass. This is planning complete only: no mobile implementation or new device evidence. The lock holder, initial cold screen-test timeout, native thumbnail feasibility and Android/iOS latency/audio/usability remain implementation investigations. No product-blocking question remains; cache/scheduler/latency defaults are explicit engineering targets. Begin S0/S1, then deliver S2/S3 as one coherent correctness increment before exposing the new Update behavior.

## Replay settings acknowledgement and foreground-save follow-up (2026-10-26)

Following owner device feedback, custom-audio selection now finishes when its bounded private copy is verified, rather than awaiting a nonessential native metadata probe. The Music & order sheet remains visible with `Saving audio` until the exact working draft is acknowledged; failure stays in the same sheet with a retryable `Done`, and only a confirmed draft exposes the updated Replay action. Replay working/commit writes no longer wait for entire import or maintenance lifecycles; the existing foreground owned-transaction gate remains the exclusive native serialization boundary. Focused Replay screen and provider suites pass 95 tests, with mobile lint and TypeScript passing. This does not establish real-device render completion or latency; owner testing of edit, Music Done, Update Replay and playback remains required.

## Replay Update route-retention correction (2026-10-26)

Owner testing then showed Update Replay returning to Audit before its new video appeared. The Replay route now retains Android hardware Back and native `beforeRemove` navigation while the committed Update is in its checking/rendering state, so the renderer stays mounted until it resolves to a Replay result. The focused Replay screen suite passes 51 tests, including the checking-state route guard; mobile TypeScript/lint and root `npm run check` pass. This fixes the identified navigation escape but is not owner-device confirmation of successful video rendering; retest Update Replay through to playback on the installed development client.

## Replay Update stale-draft correction (2026-10-26)

The repeat owner test was diagnosed from a clean Android log: the replacement renderer did not start; `REPLAY_DRAFT_SAVE` returned fixed stage `REPLAY_STALE`. The route guard was therefore not the underlying failure. An in-memory working revision can be older after a JS/dev-runtime reload while the durable native working composition remains exactly the owner's visible choice. Commit now rehydrates and uses that matching durable revision, while preserving a hard conflict if any media, included trip, order, or soundtrack differs. The focused provider suite passes 46 tests with a runtime-reload Update regression; mobile TypeScript/lint pass. A device retest is required to establish actual render/playback completion.

## Replay audio Done stale-revision correction (2026-10-26)

Device logs for a new custom audio confirmed copy success but repeated stale failures during working-draft staging. The stale in-memory revision was only rebased if the native opaque mapping was absent; retained mapping did not imply a current JS revision. Working writes now rebase the durable revision whenever an expected revision is present, and commit continues to verify the complete visible composition before rendering. The focused provider suite passes 47 tests, plus mobile TypeScript/lint. Device retest of custom audio Done then Update Replay remains required.

## Replay stale-working-branch recovery (2026-10-26)

The first revision-rebase correction did not unblock the device; repeated audio Done logs still returned stale stage saves after successful local audio copy. This exposed an obsolete native working branch, not an audio import or renderer problem. On exactly one same-scope stale stage failure, the provider now removes only that recoverable working branch and stages the complete visible owner draft anew. Scope change and repeat failure remain safely blocked. Focused provider tests pass 48, with mobile TypeScript/lint; Android confirmation remains pending.

## Replay stale recovery Fast Refresh boundary and error copy (2026-10-26)

The stale working-branch recovery did not execute for a native stale error crossing the development runtime boundary because class identity was no longer stable. The save boundary now recognizes only the fixed stale code as an additional safe identity and invokes the bounded recovery. Music Done explains a changed Journey List, a reconciling draft, or an unsaved device state without exposing native details, and retains the copied audio in the sheet. Focused Replay/provider suites pass 100 tests with mobile TypeScript/lint. Device confirmation remains pending.

## Replay custom-audio device diagnosis (2026-10-26)

The subsequent device log confirms custom audio import completes; persistence alone returns the fixed stale result. No renderer work begins, so this is not a video-render or audio-format failure. The visible Music error now distinguishes the saved local audio copy from the stale Replay edit state and explains the recovery action without raw database details. The cross-runtime stale-code handling and bounded same-scope recovery need an owner retest on the refreshed client.

## Replay stale-recovery checkpoint diagnostics (2026-10-26)

To locate the remaining device-only draft failure without exposing local media or database details, Replay now emits fixed recovery milestones for manifest read, working-branch reset, and replacement stage, plus a completion outcome. The focused provider suite passes 48 tests and mobile TypeScript/lint pass. Owner retest is still required to identify the last reached milestone and apply the targeted persistence repair.

## Replay custom-audio recovery receipt repair (2026-10-26)

The device checkpoint log isolated the remaining failure to the replacement-stage write after a successful local recovery reset. That write reused an obsolete idempotency receipt identity even though its expected revision had changed, so the native receipt contract correctly rejected it. Recovery now uses a fresh operation ID while preserving the same edit session/version and exact visible selection. The provider regression suite passes 49 tests, plus mobile TypeScript/lint. Owner retest remains required for confirmed Android save, Update Replay, and rendered-video playback.

## Resumed M7 host integration (2026-10-29)

Gated correction and history convergence now share the headless runner without a
second foreground upload; failure propagates to the OS result. Offline live-token
verification preserves the unlocked owner, source-only read restrictions leave
independently authorized account convergence available, selected conflict resolutions
retain an immutable checkpoint until authoritative pull, and explicit M7 restore
merges initial authority before storing a canonical correction baseline. Dirty
legacy/unknown initial replicas are preserved for compatibility review. Account
Jest passes 33 suites/163 tests, actual account SQLite seven, mobile typecheck and
22 worker runtime tests pass; the generated native-free graph is current. Gates
remain disabled, with physical two-device/Android/iOS, native-media, hosted service
and dirty-legacy compatibility acceptance open. No remote operation occurred.

## Owner private-history export contention (2026-10-30)

Correlated Android diagnostics isolate the reported private-history failure to the local export transaction begin, before upload. Export now uses a deferred consistent read under the existing ownership gate, retaining immediate writes and rollback quarantine. A real file-backed SQLite concurrent-writer regression reproduces the old failure and passes the correction. Exact begin/commit/rollback diagnostic stages and checkpoint-preserving busy copy are covered by failure/redaction tests.

Export correction checks pass: mobile99 suites/921 tests, SQLite106, TypeScript/lint, generated-domain freshness and root136/framework/eval smoke. Later owner diagnostics confirm corrected BEGIN/read/COMMIT/CLOSE on device. Native writer identity remains unknown; no app data or checkpoint was cleared. Delivery record remains spec-m7-unified-history.md.

## Hosted Replay mapping CPU investigation (2026-10-30)

Owner retries reach hosted merge but terminate with546/CPU Time exceeded. A varied-place/GPS-less synthetic profile exposed repeated support lookup; ordered immutable support summaries reduce3000-row local projection87.162s to0.383s, with120 frozen graph parity cases and a deterministic complexity regression. Full mobile99 suites/924 tests, worker57 and typing/lint/root136 pass; three scoped reviews found no concrete issue. Worker deployed through Docker after API-source upload413.

Twenty closed canonical checkpoints (worker78 tests) isolate remaining work to HISTORY_REPLAY_MAP. Exact support mapping now uses an inverted index preserving complete-support uniqueness. GPS-less memberships and old Replay groups reconcile only through a unique complete-visit successor; ambiguous/split/missing support remains reviewable. A bounded2048-entry pure civil-day cache removes repeated validation work, reducing local synthetic merge CPU~1.016s to0.562s with120 frozen graph parity cases; repeated-day parse count3518 to9. Binary bracket experiment was rejected and is absent.

Final hosted photo-Replay fixture passes:3000 mixed-GPS evidence,80 selected references, merge71.558s, same-operation retry retains aggregate/revision, two independent Auth sessions read all57 pages identically with3000 unique evidence and committed reverse Replay order. Synthetic account deletion fenced/purge scheduled. Software checks:100 mobile suites/929 tests, SQLite106, worker78, typing/lint and root157/framework/eval smoke. Latest membership/mapping independent reviewers hit usage limits and did not complete; parent source review found no further defect. Latest owner server event on the preceding increment is HISTORY_REPLAY_MAP/HISTORY_REVIEW/blocked; final-cache owner acknowledgement remains unobserved. Do not drop selected Replay or reset the checkpoint to bypass review. Whole owner sync/physical acceptance remains open despite synthetic success.

Owner final-cache retry still logs REVIEW/blocked at Replay mapping followed by CPU termination (06:06:04UTC). Current ADB confirms client NETWORK/unknown; Metro JSONL is stale. Fixed source-group absent/target and review correction/duplicate categories are now deployed to isolate the retained authority issue without reading private IDs.82 worker/86 focused mobile tests, typing/lint, root161 and120 frozen parity pass. Hosted negative synthetic manual/absent-Replay group returns explicit review on exact retry with no activation; cleanup fenced. Await current owner subtype before choosing recovery; no checkpoint or selected Replay was discarded.

Owner06:10:48UTC confirms HISTORY_REVIEW_CORRECTION plus HISTORY_REPLAY_GROUP_TARGET. Backend now distinguishes retained removed-source facts from canonical correction remap using fixed categories and field-presence checks only; values remain private.84 worker tests and current root checks pass; deployment acknowledged. Next evidence is the owner retry's corrective subtype. Existing data/Replay/checkpoints remain unchanged; owner sync is still open.

## Correction remap and nullable provenance repair (2026-10-30)

Owner subtype confirms canonical remap. Reproduced a correction successfully mapped in the final graph but still carrying intermediate pending status; now clear only the same revision's resolved flag and preserve other unresolved revisions. Transport also rewrote nullable Android source_origin to explicit unknown, changing native/account graph semantics; null is now retained and explicit unknown remains unknown. Correction support indexing preserves visit-row multiplicity and all missing/split/overlap guards;600-visit work regression falls from2,160,000 reads to under10k and500 frozen correction outcomes match. Three independent reviews completed, with mixed-revision test gap corrected/rechecked.

Current checks:100 mobile suites/931 tests, SQLite106, worker84, TypeScript/lint and root163/framework/eval smoke pass. Hosted3000 nullable-provenance evidence + effective correction +80 selected Replay references completes55.157s; same-operation retry preserves aggregate/revision; two Auth sessions read all57 pages identically with null provenance, effective correction and exact Replay order retained. Synthetic deletion fenced/purge scheduled. Worker version28 ACTIVE deployed17:38:20.667Bangkok. Owner17:38:12 review predates that deployment; current-version acceptance remains pending. Restored missing USB reverse without restarting healthy Metro; owner confirms app visible. No owner data/checkpoint reset or Git stage/commit/push.

## Private sync CPU continuation (2026-11-07)

Owner's last correlated retry passed correction/Replay review but terminated on CPU after ACTIVATE began. Version29 is now ACTIVE after Docker bundle deployment. Successful immutable Replay-body validation is memoized by weak value-object reference and exact body string; row fields always revalidate. UTF8 accounting uses bounded surrogate-safe TextEncoder chunks where available, with exact native-free fallback. Full synthetic worker3000 evidence/correction/200Replay local user CPU falls2.031s to1.359s.100 mobile suites/932 tests, SQLite106, worker84, root163/framework/eval smoke, typing/lint and generated freshness pass. Three scoped source reviewers report no concrete findings. Hosted200-reference convergence test is running; owner success remains unconfirmed. No owner storage/checkpoint reset or Git stage/commit/push.


Version29 hosted result: source upload and exact activation retry pass; larger200-reference merge returns546. Synthetic cleanup fenced/purge scheduled. Current server phase is unknown because dashboard session expired. Owner authorization/self-login is pending after automatic browser review blocked GitHub sign-in; no workaround attempted. Runtime fix remains open. Additional local worker probe including RPC JSON encode/decode consumes1.625s user CPU; this still does not prove hosted success.


## Resumable private sync repair (2026-11-07)

Single-request workers v29–31 still hit hosted cumulative CPU limits with3000 synthetic evidence/correction/200Replay. New service-only checkpoint splits preparation, canonical build and final CAS into separate authenticated requests, preserving source/owner/domain fences, exactReplay/corrections and unknown-ack operation identity. Client automaticallycontinues progress and retries one explicitly stale operation with newUUID. Private preparedbody releases on complete/stale/expiry, tombstones preventrebase, activeaggregates/sourcefacts remain protected. Migration20261107140000 deployed alone transactionally and newworker deployed; hostedconvergence test running.101mobile suites/956tests, root197/framework/evalsmoke, strictbackend+mobiletyping/lint, SQLite106 and17PostgreSQLfixtures pass. Three scoped reviews yielded concrete tuple/quota fixes andownerjournal/twoowner tests, allchecked. LocalperrequestCPU preparation376–421ms/build921–1078ms excludeshosting. Owner/runtime success remains open; no ownerstorage/sourcecheckpoint reset, stage/commit/push, or unrelatedmigrationdeployment.


Hosted checkpoint refinement: PREPARE returns200/CHECKPOINTED but firstBUILDstillhitCPU atACTIVATE_START due246individualcheckpointreadRPCs. Addedboundedservice-only read-batch action(1–8orderedchunks) reusingeveryoriginalguard; workerreads31batchesinsteadof246RPCs for4MiBartifact. Migration20261107142500 andworker deployed,17SQLfixtures/23checkpointtests/strictbackendtypes/root197 pass, independentsourcereviewfoundnoconcreteissue. Latesthostedtesthasnowreturnedtwoprogressreceipts (PREPARE andBUILDbothcomplete); FINALIZE/two-sessionreadbackstillrunning. A concurrentcompletedreceipt race is additionallyfixedand25checkpointtests/root199pass, pendingfinalworkerrolloutaftercurrentacceptance run. App freshbundle delivered1789modules; sampledlogsafter21:17show nofatal/loadermarkers; noowner-visiblecompletionclaim.


Batchedhostedmergeandimmutableexactretrycompleted184.201s; fullacceptanceremainedopenbecausefirstsessionreadbackafter20/97pageshitSQL57014. NarrowaggregatepullreadRPC60s/client65s nowdeployedasmigration20261107144000; unchangedpublichistorysession/privacy/source/ownerrevisionguarddelegation. NewfixedHISTORY_READ_TIMEOUTdiagnosticisretryableunknownandkeepspreviousreplica. Worker34ACTIVE includeslatestreceipt-racefix; fullhostedtwo-session200Replayruninprogress. Aggregate/source/statusglobalbudgetsunchangedexceptthisexplicitreadfunction. Readbudgetclient/servicefailure-redactiontestsand17SQLfixturespass; finalmobile/rootchecksruninparallel.

Hosted final result (2026-11-07): worker34 completes3000 synthetic evidence +effective place correction +200 Replay references in197.575s; exact retry retains aggregate/revision; two independent Auth sessions read all97pages identically with3000 unique evidence, null provenance, correction and exact reverse Replay selection retained. Synthetic account deletion fenced; scheduled purge pending.101 mobile suites/958tests, root199/framework/eval smoke, strict mobile/backend typing, lint and17 PostgreSQL fixtures pass; generated native-free bundle current. Owner retry requested; actual owner completion and physical two-device acceptance remain open. No owner storage/source checkpoint reset, Git stage/commit/push, or unrelated migration deployment.

Owner-operated Android Sync confirmed (2026-11-07): action runtime-mw6ijdz6-6 completed export, resumable prepare/build and server commit (HTTP200/COMPLETE21:45:35Bangkok). Fresh ADB closed diagnostics then confirm HISTORY_TRANSFER/HISTORY_AUTHORITY/COMPLETE with durableOutcome complete after account-status refresh under the same correlation. Owner's Saved revision0 report occurred while this action was still processing; that always-visible status label is not completion evidence. This confirms the reported owner Sync operation; independent physical second-device restore/playback and fullM7 acceptance remain open. No owner record or source checkpoint reset.


## Account View remount authentication repair (2026-11-07)

Owner observed login after View account history despite successful Sync/revision1. Closedrestore diagnostics and REDrealcontroller test establish providercontext-keyremount ->AccountScreen.restore ->transientownerloss ->cleanupcancellation/credentialblock. Restore now skipsalready-signed-in identity inside its serialized queue; coldbootstrap, liveverification, explicitdenial/signout fences preserved. RealScreen/controller/PhotoAccessProvider integration proves View retainsowner/selection andexplicitSignoutstilldisposes/fences. AddedopenAUTH/REPLICA/SCOPE/BINDdiagnostics, typedfailures andredaction.102mobile suites/965tests, root199/framework/evalsmoke, typing/lint andbundlefreshnesspass; threescopedreviewsfoundnoconcreteissues. Queue-deferredrestore regressionalsopasses. Appbundlehandoff/retestpending; priorerroneouscredentialblockrequiresnormalowneremailverification ifloggedout. Savedserverrevision/sourcefactsandlocalreplicapointersnotreset. WholeM7remainsin-progress.

## Owner account browsing confirmed; Replay diagnosis open (2026-11-08)

Owner confirms View account history retains sign-in and Atlas/Timeline trips are visible. This verifies the bounded View remount repair after correcting task Metro CI mode (reloads disabled) to interactive watch mode; the routed Android bundle was checked for the restore guard and open-stage markers. It does not complete physical second-device or whole M7 acceptance.

Owner next reports Replay could not be prepared. Current device fixed events show PRIVATE_MEDIA/MEDIA_AUTH/MEDIA_ACCESS/skipped before REPLAY_RENDER/REPLAY_ACCESS/UNKNOWN. Exact authorization guard remains unknown. Native denial subtypes and correlated provider boundary diagnostics are being added; no permission, media consent, selection, source checkpoint or user storage is reset or bypassed. Delivery remains spec-m7-unified-history.md. Root199/framework/evalsmoke and native authorization diagnostics10 tests pass; further Replay verification and owner evidence remain open.

## Replay prepared-artifact writer correction (2026-11-08)

Current frozen-bundle owner action runtime-mw7clonr-a proves REPLAY_LOCAL and exact REPLAY_OUTPUT_SAVE/DATABASE_BUSY after directory/copy/file verification/composition identity pass. The earlier generic output catch violated the diagnostic policy by erasing classified cause; fixed source/output substages and typed repository lifecycle/mapping/run/privacy/CAS guards now survive cleanup to one terminal under the same action correlation, with failure/redaction regressions.

The direct prepared-artifact mutation did not join the existing native writer queue. Two real file-backed connections reproduce old SQLITE_BUSY before writer settlement; the correction gates the full guards/read/CAS in a foreground owned transaction. It waits, preserves the other committed composition, and rechecks lifecycle after queue admission. All100AtlasSQLite tests pass; full mobile102/990 passed for diagnostic patch, transition5suites34 and finalmobile typing/lint/root199/framework/evalsmoke pass. Independent follow-up source review finds no concrete blocker. A final full mobile run is in progress for context-transition diagnostics.

Exact routed Android bundle compiled writer gate and context diagnostics were verified (hash2b3f28b6af2b08d2f4ab48a81040deb50c6e060d228e69a322b352e1c2de254d). Restarted only Travel Life normally to release stale native connections; owner Replay validation requested. Actual source switch after preceding View remains unknown, now mapped to closed caller-specific transition events. No owner data, credentials, checkpoints or storage reset. Physical Replay acceptance and wholeM7 remain open, along with recorded pre-existing media cache/composition/publication-fence follow-ups.

Final mobile verification now complete:102suites/997tests pass, replacing the in-progress run above. Physical post-restart Replay validation remains pending; no current owner success claim.

Owner Replay writer acceptance (2026-11-08): owner confirms preparation and playback after the foreground-writer correction and ordinary app restart. Current Android runtime-mw7dnuq6-a reaches DIRECTORY/COPY/VERIFY/IDENTITY/SAVE/CLEANUP then REPLAY_RENDER/COMPLETE, durableOutcome complete. This closes the observed prepared-artifact DATABASE_BUSY incident; no storage or checkpoint reset. Software evidence:102mobile suites/997tests,100AtlasSQLite, root199/framework/evalsmoke, typing/lint and scopedreview pass. Source caveat: this action explicitly logs REPLAY_LOCAL. Earlier View runtime-mw7dn9kg-6 completed HISTORY_OPEN_BIND, but no HISTORY_CONTEXT_* switch event is present in current process collection. Therefore account-source continuity remains unknown/unresolved and physical account/two-device Replay acceptance is not established by this successful local playback. Keep wholeM7 in-progress and source-continuity follow-up open; do not conflate writer-incident closure with full account acceptance.

## Simple account sync owner flow (2026-11-08)

Owner rejected the technical multi-step interface. Signed-in Account now offers one explicit Sync to account action: authorize private scope from adjacent copy, converge/restore history, upload only the media already committed to account Replay using existing exact durable jobs, select account source, then open Atlas. No second gallery selection, Check or Restore is needed in the default path; advanced controls remain in collapsed Details. Live acknowledged-copy progress is shown; failures retain saved operations and exact redacted cause. Playback resolves only required account refs and keeps the committed soundtrack on first open.

Software evidence:106mobile suites/1024tests,112SQLite, root199/framework/evalsmoke, mobiletyping/lint and scopedwhitespace pass. Actual compiled Android bundle verified with one-action/consent/committed-scope/focus/atomic-source markers (hashcff6786d8e2f2bdc2261aa96cce82f389af830917a449a28f50056f4be85135c), app normally reopened without storage reset. Owner one-button Sync acceptance pending. Independent reviewer layers remain limited by service quota; parent scoped source review completed, no broad release/fullM7 acceptance claim. No Git stage/commit/push or unrelated backend deployment.

### One-button account Sync timeout correction (2026-11-08)

Current owner action completed consent/history but source-media mapping timed out
in PostgreSQL pre_account_controls count query (SQLSTATE57014). New migration
20261108190000 projects compact source/privacy/evidence values before joins and
shares eligible rows between count/page; retains every source/session/account
and privacy/revision guard and existing RPC timeout budgets. Transport now carries
specific SQL-timeout versus own-read-deadline stages into one redacted diagnostic.

Evidence: old synthetic query reproduces statement timeout; full19 PostgreSQL
fixtures pass. 3000-evidence/8MiB metadata/4MiB Replay count+page+audio regression
2.419s under5s; complete125-page sequential enumeration86.317s locally (synthetic,
not hosted/device latency). Nonzero evidence/audio revisions and both privacy
fields verified. This remains a per-request optimization; whole enumeration can
still take time. Mobile106 suites/1027 pass, final affected3 suites/32 pass including
two additional old-owner cleanup races; typecheck/lint and root199/framework/eval
smoke pass. Required generated domain digest refreshed, no worker deployment.
Deployment and owner one-button completion still pending at this checkpoint.

Deployment follow-through: only migration20261108190000 applied and recorded;
live function/security metadata verified. Final SQL NULL-sensitive assertion
subset passes6files; final Android compiled proof includes exact timeout stages
and simple Sync. Code is frozen for owner retry; native media upload and automatic
Atlas completion remain unaccepted.

2026-11-09 continuation: restored stopped development Metro/USB transport and
verified unchanged Android bundle plus fresh closed account/history diagnostics.
Previous Sync terminal outcome unavailable in retained log buffer. No code/server
or data reset; owner one-button Sync completion remains pending.

### Source-media session-network recovery (2026-11-09)

Same owner Sync correlation proves ACCOUNT_REFRESH/ACCOUNT_PROVIDER/ACCOUNT_NETWORK
immediately before media mapping fails. Client now permits exactly one extra fresh
verified-session read for source-media with still-current owner fence; no cached
token or write retry. Precise transport categories propagate to one closed diagnostic;
403 permission denial preserves sign-in, stale responses/progress are fenced, and
first mapping authority must match the loaded Replay replica. Committed custom
soundtrack missing/mismatch/acknowledged cases have consumer-level regressions.

BMAD three reviews plus exact-patch follow-up completed. Final106 mobile suites/
1084 tests, focused2/83, root199/framework/eval smoke, typecheck/lint/whitespace pass.
No server change in this continuation. Android bundle frozen; existing app reopened
with data retained. Native Sync/upload/automatic Atlas completion still requires
owner evidence; wholeM7 remains in-progress, deferred issues recorded in its record.

### One-button media receipt recovery (2026-11-09)

Owner action completed history/mapping and30 of31 private copies before final
MEDIA_STAGE lost acknowledgement with matched hosted503. Prior saves confirmed
by same-correlation durable completion events; underlying service503 cause
remains unknown. One-button Sync now reconciles an eligible transport interruption
once using the exact persisted job and existing receipts. Keeps prior saves,
rechecks current ownership/consent, and separates expected upload lease work and
malformed acknowledgement from retryable transport. No server deployment/data
reset. Confirmed live receipt guards and4 PostgreSQL fixtures; full mobile106/1123
before final cleanup classification, final focused5/123, SQLite112, root199,
typecheck/lint/scoped whitespace pass. BMAD review findings patched or recorded
as pre-existing deferrals. Frozen Android bundle verified and app reopened; final
owner Sync/account Atlas and Replay playback acceptance remain open.

Android acceptance follow-up. The owner started Sync on bundle 732093b7 and correlation runtime-mw8wrekk-8 reached ACCOUNT_SYNC_OPEN COMPLETE with durableOutcome complete. HISTORY_OPEN_BIND, HISTORY_CONSUMER_ACCOUNT and HISTORY_PROVIDER_ACCOUNT each completed. This confirms account binding. The captured action did not include a separate final-copy upload receipt, so the prior 30/31 count is not independently updated. Subsequent MEDIA_FETCH/MEDIA_UNAVAILABLE events have separate correlations. Owner confirmation of Atlas navigation and Replay playback is pending.

Owner acceptance confirmed on Android. After the Sync rerun, Atlas opened automatically and Replay played successfully. This closes the owner-visible Sync and playback check for this incident. The exact final media copy count remains unverified.

Settings now shows restore progress beside Restore saved history. Validated download pages drive the measured bar and percentage. Preparation, local rebuild, and final publication show indeterminate activity. The existing success or failure message takes over when work settles. Verification passed 53 focused mobile tests, mobile TypeScript, and the foundation check. Owner observation of the progress on the second device remains pending.

Second Android device. Owner confirmed restored trips and Atlas display and reported slow photos and local Replay preparation. Closed logs confirmed account binding and account-sourced Replay render completion. The action took about 161 seconds, with two preview intervals of about 47 and 60 seconds and about 27 seconds from encode start to the next stage. Current sync stores the composition and eligible private media copies. Each phone prepares and caches the rendered output locally. Preview resolution currently awaits one item at a time with authorization and cache checks. Atlas photo latency itself was not separately measured. Next performance investigation can profile first-view thumbnails and repeated preview preparation.

Account previews now resolve up to three items per call for Atlas and Replay, with original result order and owner scope checks. All 1,132 mobile tests, mobile typecheck and 199 foundation tests passed. Cold timing on the second phone remains open. Final MP4 reuse across devices remains open and requires an authenticated private artifact bound to the current committed composition and aggregate.

Second-device local Atlas recovery. Android reported heap exhaustion after rebuild completion and a destination read failure. Destination support now crosses the SQLite bridge in batches of up to 256 rows. Duplicate-family validation still spans the complete support set. Separate fixed query and computation diagnostics preserve the existing recovery boundary. Focused mobile tests (63), real SQLite tests (112), typecheck and foundation checks passed. Device recovery and the preceding Sync export fence remain separate open checks.

The patched Android bundle was verified through Metro and reopened on the second phone. The new process loaded local history and remained alive for over 90 seconds without a new recorded exit. The last matching onboarding stage was RUN_WAIT. Atlas visibility still needs owner confirmation.

The owner reported continued loading. Device phase timing isolated the first paging plan's destination query. Index-ordered paging reduced the first measured destination query to about 10 seconds. The first destination computation then took about 74 seconds and the projection completed. A second concurrent read reached destination computation before the USB connection dropped. Onboarding completion and visible Atlas remain unconfirmed. The temporary profile override was removed.

After USB reconnection, the owner device reached the completed onboarding checkpoint in about three minutes and the finishing indicator cleared. The owner later reported unresponsive controls. Destination calculation now yields to pending input between short batches. The final privacy read checks remain in place. Focused mobile tests (61), SQLite (112), typecheck and foundation checks passed. Physical touch verification remains open because Android denied ADB input injection.

Cold launch after an account merge bound the local provider because the source choice was process-local. The account control database now records the chosen owner. Startup restores the choice after session hydration and checks replica scope before binding. Older installations must open the already-saved account history once to record the choice. Account suite (432), typecheck and foundation checks passed. Device cold-launch validation remains open.

The owner opened account history and Android recorded a completed account binding. After a cold restart, the new process restored that binding and displayed Atlas and Timeline. The View account history button previously left the owner in Account after a successful bind. It now routes to Atlas on success and retains the existing restore guidance on failure. Twelve focused tests and typecheck passed. The updated button route has host coverage and awaits a physical tap.

The owner confirmed the new button returns to Atlas but reported a blank view. The account binding completed on Android. Aggregate-only inspection of the on-device SQLite copy found retained qualified and manual journeys and a disconnected lifecycle. The Atlas read requires a connected record. The screen now offers explicit reconnect for disconnected account records instead of rendering a sparse Atlas. The existing Settings recovery action remains available. Temporary local SQLite snapshots were removed after inspection. Physical confirmation is pending.

The owner confirmed the trips appeared in Atlas on the second Android device after reconnecting the private record from Settings. The origin of the disconnected flag remains unconfirmed.

The owner reported a rebuild error and difficulty finding Rebuild inside Details. Android recorded completion for all three observed rebuild and reveal actions. The Details sheet remained visible after the action. Rebuild and Recheck now appear directly on Atlas. The 41 Atlas component tests passed. The new placement awaits physical verification.

The owner reported that the rebuilt account Atlas still omitted many trips from the second phone. Aggregate inspection of the local database found a connected record with 19,424 evidence rows and 66 qualified trips in the latest completed run. The prior account replica inspection found 7 qualified and 2 manual trips. The latest retained local-export diagnostics recorded a lifecycle fence before export. Rebuilding the selected account replica does not merge the separate local source. A successful second-device sync and resulting account view remain unverified.

The owner wants to inspect and edit device journeys and Replay before explicitly syncing. Atlas now shows the active source and offers a direct switch to the other source. Foreground, account-edit and OS maintenance triggers no longer send account changes. Explicit sync can attach an unregistered device. The 486 focused tests and foundation check passed. Workspace typecheck reported errors for the concurrent journey-media snapshot and manual home pin changes. The second phone was disconnected, so device verification remains open.

The second Android phone later reported local reconstruction failure. Account and local startup logged SCHEMA at DURABLE_RUN_READ. Read-only account replica inspection found a v39 marker with no home_revision column and only one Home table. Import schema v40 completes that known partial Home layout transactionally, retains the receipt and completed runs, and also accepts the complete v39 layout. The synthetic partial-layout regression, 115 SQLite tests, 23 import tests and the foundation check passed. Android was reopened with the repair and awaits completion evidence.
