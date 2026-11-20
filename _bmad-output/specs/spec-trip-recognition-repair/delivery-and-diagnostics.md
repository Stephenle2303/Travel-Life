# Delivery, diagnostics and adoption

## Stories (status 2026-11-19)

| Story | Caps | Status | Done when |
| --- | --- | --- | --- |
| M10.1 Benchmark | CAP-1 | **Done** (first pass) | Labels reviewed by owner; baseline frozen on `fbfe8b8`; probe failures reproduced. S15/S17/S20 proven at the unit level only — see [v1-2-comparison.md](v1-2-comparison.md)'s closing notes |
| M10.2 Device baseline | CAP-2 | **Blocked** — needs the owner's phone connected | Aggregate recorded in project state |
| M10.3 No silent loss, clear reasons | CAP-3 | **Done** at the qualification layer | Closed reasons on every hidden candidate (verified: 0 empty-reason NOT_TRIP on the benchmark); 8-code priority table implemented. The Possible-trip **card UI** showing the sentence and a Set Home button is not built — blocked, see below |
| M10.4 Outcome rule | CAP-4 | **Done** | Atlas/Possible/hidden rule with C-3, C-4, C-6 and F-1; 54/54 on the benchmark with and without Home |
| M10.5 Home is required | CAP-5 | **Half done** | Engine half done: H-1..H-5 enforced in `qualifyTripOutcomeV12` (no learned Home, Home photos never support, Forever/dated periods). UI half (onboarding "Skip for now" removal, Settings keep-one-Home, [home-setup.md](home-setup.md)'s period picker) is **blocked**, see below |
| M10.6 Capture time | CAP-6 | **Blocked** | C-12, C-13, D-7 on Android; blocked on the in-flight native capture-metadata work under `travel-window/` (a concurrent session building the same underlying EXIF/offset reader for the GPS-less spec). `outcome-v1-2.ts` already reads `hasPreciseOffset`/`sourceOrigin` and needs no further engine change once that import path populates them |
| M10.7 One detector | CAP-7 | **Half done** | Atlas surface consolidated (one call site, `qualifyGraphJourneyV12`, shared lookups); two narrower "reliable" checks (`candidate-projection.ts`, `local-recovery-projection.ts`) switched to v1.2 during the 2026-11-19 code review. The Possible-trips surface's primary card-grouping policy still reads the separate `candidate-projection.ts` shadow policy — **not done**, see [consolidation.md](consolidation.md) |
| M10.8 Adoption | CAP-8 | **Core done, wiring blocked** | Pure dry-run diff (`summarizeOutcomeDelta`) and rollback proof (the 4 core v1.1 rule files — `engine.ts`, `engine-v1-1.ts`, `canonical-core.ts`, `canonical-projection.ts` — are byte-unchanged; `qualifyGraphJourneyV11` stays exported and callable) are done and tested. Owner-facing dry-run UI and activation/rollback on the owner's device are not built — blocked, see below |

## Why four pieces are blocked, not skipped

A second session was actively editing `apps/mobile/src/components/mobile-screens.tsx`,
`apps/mobile/src/diagnostics/app-diagnostics.ts`,
`apps/mobile/src/import-record/repository.ts`,
`apps/mobile/src/photo-access/provider.tsx` and every file under
`apps/mobile/src/travel-window/` throughout this work (confirmed by `git
status` at multiple points). Two sessions writing to the same files at once
risks losing one session's work with no clean way to merge it back, so this
session did not touch them. That blocks exactly:
- M10.5's UI slice (`mobile-screens.tsx`).
- M10.6 end to end (`travel-window/` owns the same EXIF/offset reading this
  story needs; building a second, separate reader would duplicate and likely
  conflict with that work rather than complete it).
- The closed-reason-code diagnostics this policy would otherwise add
  (`app-diagnostics.ts`'s reason-code union is defined in that one file).
- Any schema change for capture-time/provenance persistence
  (`import-record/repository.ts` owns the migrations).
- M10.8's device-facing dry-run/activation UI (also `mobile-screens.tsx`
  and the schema file).

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
- **Still needed, blocked on `app-diagnostics.ts`:** closed reason codes for
  `home-not-set` lifecycle events, the Possible-card Set Home action, the
  `ATLAS_REBUILD_PROFILE` bucketed classification counts for the owner's
  device (M10.2), and `ONBOARDING_SETUP`'s required-Home stage. These are
  tied to the UI/device stories above, which are blocked for the same reason.

## Collection recipe (for what exists today)

Development build on the owner's Android with
`EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1`, via the existing Metro/ADB route
(verify listener address and build freshness first, per the error
playbook). Filter Metro output to `ATLAS_REBUILD_PROFILE`; the `REBUILD_QUALIFY`
phase's START/COMPLETE pair brackets the v1.2 outcome pass. No reason-coded
production diagnostic exists yet for this story (see above); the read-only
device aggregate query for M10.2 is a separate, still-blocked piece.

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

**Not done (blocked, see above):**
- A local policy selector recording which detector version is active, and
  rebuilding only when input revisions changed.
- The owner-facing dry-run screen and activation approval.
- Corrections that need remap staying `pending_remap` through an actual
  activation (the underlying `applyJourneyCorrections`/
  `mapFinalCorrectionApplications` machinery is unchanged and already does
  this; what's missing is the UI path that lets the owner trigger and see it).

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
