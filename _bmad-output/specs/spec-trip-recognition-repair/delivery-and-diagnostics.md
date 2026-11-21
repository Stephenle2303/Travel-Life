# Delivery, diagnostics and adoption

## Stories (status 2026-11-19)

| Story | Caps | Status | Done when |
| --- | --- | --- | --- |
| M10.1 Benchmark | CAP-1 | **Done** (first pass) | Labels reviewed by owner; baseline frozen on `fbfe8b8`; probe failures reproduced. S15/S17/S20 proven at the unit level only — see [v1-2-comparison.md](v1-2-comparison.md)'s closing notes |
| M10.2 Device baseline | CAP-2 | **Done** (2026-11-20) | Aggregate recorded in project state and below |
| M10.3 No silent loss, clear reasons | CAP-3 | **Done** (2026-11-21) | Closed reasons on every hidden candidate (verified: 0 empty-reason NOT_TRIP on the benchmark); 8-code priority table implemented. The Possible-trip **card UI** (reason sentence + Set Home) is built — real production data, not the dev-preview shadow policy; see below |
| M10.4 Outcome rule | CAP-4 | **Done** | Atlas/Possible/hidden rule with C-3, C-4, C-6 and F-1; 54/54 on the benchmark with and without Home |
| M10.5 Home is required | CAP-5 | **Done** | Engine half (H-1..H-5 in `qualifyTripOutcomeV12`) plus the UI half (onboarding "Skip for now" removed, Settings keep-one-Home, [home-setup.md](home-setup.md)'s Forever/From/Until month-year picker) — done 2026-11-20 once `mobile-screens.tsx` was free |
| M10.6 Capture time | CAP-6 | **Done on Android** | C-12/C-13 wired into `photo-access/native-adapter.ts` using the same native EXIF/offset reader and mapper travel-window's GPS-less detector uses; D-7 unchanged by design. iOS/older builds keep the prior conservative defaults. Done 2026-11-20 — see [detector-v1-2.md](detector-v1-2.md)'s status update |
| M10.7 One detector | CAP-7 | **Half done, remainder deliberately deferred** | Atlas surface consolidated (one call site, `qualifyGraphJourneyV12`, shared lookups); two narrower "reliable" checks (`candidate-projection.ts`, `local-recovery-projection.ts`) switched to v1.2 during the 2026-11-19 code review. The Possible-trips **preview**'s card-grouping policy still reads the separate `candidate-projection.ts` shadow policy — investigated 2026-11-20 and deferred (not blocked): it feeds only the dev-gated comparison preview, not the real owner Possible Trips surface, and replacing it would drop test-covered behavior with no equivalent benchmark safety net; see [consolidation.md](consolidation.md) |
| M10.8 Adoption | CAP-8 | **Done (closed 2026-11-20)** | Pure dry-run diff (`summarizeOutcomeDelta`) and rollback proof (the 4 core v1.1 rule files — `engine.ts`, `engine-v1-1.ts`, `canonical-core.ts`, `canonical-projection.ts` — are byte-unchanged; `qualifyGraphJourneyV11` stays exported and callable) are done and tested. Owner-facing dry-run/activation UI is **descoped, not deferred**: v1.2 was already adopted directly (no feature flag, no gate) at the M10.3/M10.4 call-site switch, so there is no pending activation decision left for such a screen to gate — owner-approved scope reduction, see [sprint-change-proposal-2026-11-20.md](../../planning-artifacts/sprint-change-proposal-2026-11-20.md) |

## Why four pieces were blocked, not skipped (2026-11-19, resolved 2026-11-20)

A second session was actively editing `apps/mobile/src/components/mobile-screens.tsx`,
`apps/mobile/src/diagnostics/app-diagnostics.ts`,
`apps/mobile/src/import-record/repository.ts`,
`apps/mobile/src/photo-access/provider.tsx` and every file under
`apps/mobile/src/travel-window/` throughout the 2026-11-19 work (confirmed by
`git status` at multiple points). Two sessions writing to the same files at
once risks losing one session's work with no clean way to merge it back, so
that session did not touch them. That session's travel-window work merged to
`main` on 2026-11-20 (commit `a13a63c` and ancestors), freeing all of the
above files. Once free:
- M10.5's UI slice (`mobile-screens.tsx`) — **done** same day, see the table.
- M10.6 (`travel-window/` owns the EXIF/offset reader this story needs) —
  **done on Android** same day, reusing that reader rather than building a
  second one.
- M10.8's device-facing dry-run/activation UI (`mobile-screens.tsx`) — still
  **not started**: unblocked, but no longer the next scheduled slice this
  session reached before its own stopping point.
- The closed-reason-code diagnostics this policy would add
  (`app-diagnostics.ts`'s reason-code union) and any further schema change in
  `import-record/repository.ts` beyond what M10.5/M10.6 above already needed
  — still **not started**.

Everything else in this table was implemented in files that session was not
touching: `apps/mobile/src/reconstruction/*` (new `outcome-v1-2.ts`, and
`repository.ts`/`index.ts` import/export wiring), one new diagnostic stage
in `apps/mobile/src/diagnostics/atlas-phase-profile.ts` (see below — that
file is separate from `app-diagnostics.ts` and was not being edited), and
`apps/mobile/scripts/benchmark-lifetime.cjs`.

## Diagnostics actually added (2026-11-19)

- `AtlasProfileStage` (in `atlas-phase-profile.ts`, not `app-diagnostics.ts`)
  gained `REBUILD_QUALIFY`, emitted by `reconstruction/repository.ts`'s
  rebuild immediately before the v1.2 outcome loop. This is the existing
  dev-only (`EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1`) wall-time phase tracer; it
  gives the new qualification pass its own measured phase rather than being
  invisible inside `REBUILD_ACK`.
- No new **production** reason code or failure-path diagnostic was added,
  because:
  1. The call site this story changed (`qualifyGraphJourneyV11` →
     `qualifyGraphJourneyV12` inside the existing rebuild transaction) has
     the same throw/error shape as before (same "Unknown reconstructed
     journey" `Error`, same transaction rollback); no new fallible boundary
     was introduced that the existing `ATLAS_REBUILD` instrumentation did
     not already cover.
  2. The one real invariant this story must hold — a hidden or Possible
     outcome never has an empty reasons list — is enforced by
     `qualifyTripOutcomeV12`'s own control flow (every return path has a
     non-empty `reasons` array except AUTO/USER/REJECTED) and verified by
     21 unit tests plus the benchmark's `silentDrops: 0` result, not by a
     runtime assertion.
- **Done (2026-11-20), now that `app-diagnostics.ts` is free:**
  `AppDiagnosticReasonCode` gained 11 new closed codes mirroring
  detector-v1-2.md's own closed Possible-trip/hidden reason table
  (`HOME_NOT_SET`, `TIME_CONFLICT`, `NO_LOCATION`, `WEAK_LOCATION`,
  `NEAR_HOME`, `FREQUENT_PLACE`, `FEW_PHOTOS`, `SINGLE_MOMENT`,
  `OWNER_VETO`, `NO_AWAY_EVIDENCE`, `NON_CAPTURE_SOURCE`) plus a new
  `REBUILD_QUALIFY_PROFILE` stage and `AtlasPhaseProfile.classification()`
  method (`atlas-phase-profile.ts`). `reconstruction/repository.ts`'s
  per-journey rebuild loop now calls it once per journey
  (`rebuildClassificationReasonCode`, `outcome-v1-2.ts`, mapping
  `reasons[0]` or `COMPLETE` for AUTO/USER-confirmed), giving **M10.2's
  device-aggregate read** a real, content-free, bucketed signal: filter
  Metro's existing `ATLAS_REBUILD_PROFILE` output to `REBUILD_QUALIFY_
  PROFILE` and count lines per `reasonCode` to get the owner's device's
  real classification mix, same collection recipe as before, same
  `EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1` dev gate, no-op in production.
  Verified end-to-end against a real rebuild (a mixed AUTO_CONFIRMED +
  hidden-single-photo scenario correctly emitted `COMPLETE` and
  `NO_AWAY_EVIDENCE`) and with new unit/shape tests
  (`reconstruction-outcome-v1-2.test.ts`, `atlas-phase-profile.test.ts`).
  `ONBOARDING_SETUP`'s required-Home stage turned out to already be fully
  instrumented (`photo-access/controller.ts`'s `requiresHomeSetup`/
  `saveInitialHomes`, built as part of M10.5's UI slice) — this status
  table's 2026-11-19 note was stale, not a real gap.
  **Still blocked on new UI, not on diagnostics:** the Possible-card's own
  "Set Home" action has no code to instrument yet — the v1.2 Possible-trips
  card itself is still the named, deliberately deferred CAP-7/M10.7 gap
  (see consolidation.md); the `HOME_NOT_SET` reason code above is ready for
  it once that card exists.
  **Run 2026-11-20, done:** see the Collection recipe section's new note
  below for the real result.

## Diagnostic map: CAP-3's Possible-trips card UI (2026-11-21, before implementation)

Per the diagnostic implementation policy, defined before building the card.
Reuses the existing `POSSIBLE_TRIP_REVIEW` operation (already in
`app-diagnostics.ts`'s closed operation union, previously used only by the
dev-preview's shadow-token decision path) rather than inventing a new
operation, since it is already the correctly-named operation for this
feature; the shadow path's own stages (`CANDIDATE_*`) are untouched and
keep their separate meaning.

- **New stage `POSSIBLE_TRIPS_LIST_READ`** (`loadPossibleTrips()`, read
  boundary): `reasonCode: 'START'` on entry, `'COMPLETE'` with
  `durableOutcome: 'complete'` on success. A privacy-scope change mid-read
  (the same race every other reveal read already guards) reports
  `'HISTORY_STALE'` with `durableOutcome: 'unchanged'` — an expected
  lifecycle outcome, not a new failure category. Any other failure reports
  `classifyAppDiagnosticError(error)` (existing closed classifier) with
  `durableOutcome: 'failed'`, `retryable` from that classifier. No journey
  id, place, date, reason text or media reaches the log — only the closed
  reason code.
- **New stage `POSSIBLE_TRIP_SET_HOME`** (owner taps "Set Home" on a
  `home-not-set` card): `reasonCode: 'HOME_NOT_SET'` (the code already
  reserved for exactly this, per the 2026-11-20 comment in
  `app-diagnostics.ts`), `durableOutcome: 'complete'`, `retryable: false`.
  Pure navigation signal (to the existing Settings Home flow); no failure
  path — the button is simply not rendered if the navigation callback is
  unavailable.
- **Keep / Reject a Possible trip**: routed through the existing, already
  fully-instrumented `saveJourneyCorrection`/`JourneyCorrectionScreen` path
  (same mechanism the main Atlas's confirm/reject already uses for any
  journey, confirmed or not) — no new diagnostic boundary, by design
  (reusing an existing one, not duplicating it).

**Collection recipe:** same approved local console boundary
(`app-diagnostics.ts`) as every other event; filter to
`"operation":"POSSIBLE_TRIP_REVIEW"` and `"stage":"POSSIBLE_TRIPS_LIST_READ"`
or `"POSSIBLE_TRIP_SET_HOME"`. No new transport, no new collection process.

## CAP-3's Possible-trips card UI: built (2026-11-21)

M10.2's real device data (24 Atlas / 38 Possible / 14 hidden of 76 journeys,
`near-home` alone 42% of all episodes) made this the clear next slice. Built:
- `reconstruction/repository.ts`'s `loadPossibleTrips()`: reads the latest
  completed run's `SUGGESTED` journeys, mirrors `reasons[0]` into the
  card's one reason code, and computes an informational `locatedCount`
  (the `few-photos` sentence's {n}) from the already Home-filtered
  `visit-support` evidence (H-3's graph-level half, closed 2026-11-20) —
  no new persisted field or engine change needed. Registers each
  `displayId` into the same in-memory map `loadDurableReveal` uses, so
  "Review outing" can open the existing `loadJourneyDetail`/
  `saveJourneyCorrection`/`JourneyCorrectionScreen` path verbatim — no new
  write path, no new confirm/reject mechanism (the old dev-preview-only
  `saveCandidateShadowDecision`/`POSSIBLE_TRIP_REVIEW`-shadow-stage path is
  untouched and still used only by that separate, deliberately deferred
  preview, per consolidation.md).
- `reconstruction/possible-trip-copy.ts`: the exact 8 closed card sentences
  from the table below, pure and unit-tested, with a safe generic fallback
  for `owner-veto` (not one of the 8; can appear as `reasons[0]` when every
  Atlas condition holds except an owner veto — an edge case the public
  table doesn't name).
- `components/possible-trips-v12.tsx`: the real card list (period + reason
  sentence + Set Home for `home-not-set` + Review outing), a new
  `AtlasReveal` `possibleTrips` slot independent of the `recognizable` dev
  flag/shadow overlay, wired into the real Atlas screen
  (`mobile-screens.tsx`), always visible regardless of
  `isRecognizableRevealEnabled()`.
- `NON_CAPTURE_ORIGINS` exported from `outcome-v1-2.ts` so the new SQL
  query's `locatedCount` and the engine's own `ownCapture` check share one
  definition.
Verified: 3 new SQLite regressions (list+reason+count, privacy exclusion,
closed-shape-only failure/redaction), 7 new Jest tests (reason-sentence
table + component), full mobile `npm run check` (1615 Jest + 147 SQLite +
typecheck + lint + doctor, all clean), benchmark unchanged (54/54), root
`npm run check` (281/281, eval smoke PASS, history-domain bundle
regenerated for the `PossibleTripSummary` type addition — see the error
playbook, 2026-11-21, for a NULL-handling SQL bug caught and fixed by the
new regression before this was declared done).

## Collection recipe (for what exists today)

Development build on the owner's Android with
`EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1`, via the existing Metro/ADB route
(verify listener address and build freshness first, per the error
playbook). Filter Metro output to `ATLAS_REBUILD_PROFILE`; the `REBUILD_QUALIFY`
phase's START/COMPLETE pair brackets the v1.2 outcome pass. **M10.2's own
aggregate (2026-11-20):** within that same `ATLAS_REBUILD_PROFILE`
correlation, filter further to `stage":"REBUILD_QUALIFY_PROFILE` and count
occurrences of each `reasonCode` — one line per journey, `COMPLETE` for
AUTO_CONFIRMED/USER_CONFIRMED, one of the 11 Possible-trip/hidden codes
otherwise (detector-v1-2.md's table). That count *is* the device's real
classification mix; no further query or schema change is needed.

**Run 2026-11-20, owner's device connected.** Rather than re-run the
`EXPO_PUBLIC_ATLAS_PHASE_PROFILE` Metro-log recipe above (the device's data
was already fully imported and rebuilt from an earlier session today, so a
fresh profiled rebuild would have logged nothing new — the durable-read
check correctly found nothing changed and skipped re-qualifying), read the
*already-persisted* classification straight from the device's private
`travel-life-import-v1.db` (`reconstruction_trip_qualification`, latest
completed `run_id`): pulled read-only via `adb exec-out run-as ... cat`,
queried locally with Node's built-in `node:sqlite`, and the pulled copy
deleted immediately after reading the aggregate — no raw evidence,
coordinates or place labels left this environment, per this project's
privacy rule. 76 journeys total:

| Classification | Reason | Count |
| --- | --- | ---: |
| `AUTO_CONFIRMED` (Atlas) | — | 24 |
| `SUGGESTED` (Possible) | `near-home` | 32 |
| `SUGGESTED` (Possible) | `few-photos` | 4 |
| `SUGGESTED` (Possible) | `frequent-place` | 1 |
| `SUGGESTED` (Possible) | `single-moment` | 1 |
| `NOT_TRIP` (hidden) | `no-away-evidence` | 12 |
| `NOT_TRIP` (hidden) | `non-capture-source` | 2 |

The dominant Possible-trip reason by far is `near-home` (32/76 — 42% of
every detected episode, 84% of all Possible trips): on one real multi-year
photo library, H-3's <50 km Atlas threshold routes nearly half of all
episodes to Possible rather than Atlas or hidden. Read as a calibration
signal, not a defect — the rule is working as specified — but it means
CAP-3's still-unbuilt Possible-trips card (see M10.7 above) is what an
owner would actually see for over a third of their whole history, raising
that card's real priority. No silent drops: every `NOT_TRIP` carried a
populated reason, consistent with the benchmark's 0-empty-reasons
invariant. Collected on a **debug** build with the profiling flag
(reinstalled temporarily over the already-verified-standalone **release**
build to reach the dev-client/Metro path, then the release build was
reinstalled afterward, restoring the prior confirmed state).
`reconstruction_run.rule_version` reads `reconstruction-v1` (the base
engine, decision 0007) — there is still no separately stored outcome-rule
version (v1.1 vs v1.2), per this doc's existing adoption note above.

## Adoption (CAP-8)

V1.1 `persistence.md` generation tables were never built: a rebuild rewrites
the `reconstruction_*` tables in one transaction under `reconstruction_run`
(`rule_version`). v1.2 therefore adopts through the selected policy, not
stored generations.

**Done (pure, tested):**
- `summarizeOutcomeDelta(before, after)` buckets every journey into gained,
  lost, changed or unchanged, keyed however the caller likes (production
  should key by exact support signature, not journey id, since ids can
  churn across a rebuild) — 2 tests.
- Rollback proof: `git diff` on the 4 core v1.1 rule files (`engine.ts`,
  `engine-v1-1.ts`, `canonical-core.ts`, `canonical-projection.ts`) is empty;
  `qualifyGraphJourneyV11` is still exported from `canonical-core.ts` and
  re-exported from `reconstruction/repository.ts` (though no longer called
  from any production path — see [consolidation.md](consolidation.md)).
  Selecting it again at the `repository.ts` rebuild call site reproduces the
  exact v1.1 column of [v1-2-comparison.md](v1-2-comparison.md).

**Not done:**
- A local policy selector recording which detector version is active, and
  rebuilding only when input revisions changed.
- The owner-facing dry-run screen and activation approval.
- Corrections that need remap staying `pending_remap` through an actual
  activation (the underlying `applyJourneyCorrections`/
  `mapFinalCorrectionApplications` machinery is unchanged and already does
  this; what's missing is the UI path that lets the owner trigger and see it).

**Re-examined 2026-11-20, once unblocked:** M10.3/M10.4 did not build a
feature-flagged dual path — the rebuild call site was switched from
`qualifyGraphJourneyV11` to `qualifyGraphJourneyV12` directly, with no stored
policy selector and no gate in front of it. v1.2 has therefore already been
the sole, unconditionally active production rule since that commit; there is
no longer a pending "activate v1.2" decision for an owner-facing dry-run
screen to gate. The three items above stay genuinely not done, but building
them now would be a *transparency* feature (show what a future rule change
would do) rather than the originally-scoped adoption gate, and needs new
persistence (a stored prior-rebuild snapshot to diff against) that does not
exist yet. Left undone rather than built speculatively; revisit when a next
rule change actually needs a dry-run gate, or if the owner asks for this
transparency view on its own.

## Checks run this session

- A `/code-review high` pass (8 finder angles, 1-vote verify) ran before this
  story was declared done, found 10 confirmed issues, fixed 9 in the same
  task and documented 1 as a real, out-of-scope gap (H-3's graph-level half;
  see detector-v1-2.md). Full list in the error playbook, 2026-11-19.
- `apps/mobile`: `npx tsc --noEmit` (0 errors, whole project including the
  concurrent session's in-flight files, both before and after the review
  fixes), targeted Jest (`reconstruction-outcome-v1-2.test.ts` 25/25,
  `reconstruction-engine.test.ts` + `candidate-projection.test.ts` +
  `reconciliation-repository.test.ts` 148/148 total, all passing both before
  and after the review's fixes to `candidate-projection.ts`/
  `local-recovery-projection.ts`).
- `npm run benchmark:lifetime`: PASS, v1.2 54/54, 0 silent drops, 0 false
  Atlas trips, rerun and unchanged after every review fix (exit code 0; the
  script now fails the build if this regresses).
- Root `npm run check`: 281/281 Foundation tests, eval smoke PASS, rerun
  after the review fixes (regenerating
  `supabase/functions/_shared/history-domain.js` via
  `node scripts/build-history-domain.mjs` each time the `reconstruction/`
  source changed its digest; see the error playbook).
- Full mobile `npm run check` (lint/doctor/SQLite) was **not** run, because
  it would exercise the concurrent session's uncommitted, unrelated changes
  under the same command and attribute their state to this work.
