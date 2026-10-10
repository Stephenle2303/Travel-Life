---
title: 'M1.5 Discover library changes in scheduled background work'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '775b7e9458dbbbb8f932d976b0fc4d2630c3fa41'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/decisions/0004-background-maintenance-in-mvp.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M1.4 has a durable, private record but it only changes during foreground import. Owners cannot choose periodic maintenance that discovers new, changed, deleted, or newly available device-library evidence while preserving access boundaries and corrections.

**Approach:** Add an owner-controlled, initially disabled automatic-maintenance setting. When enabled after an explained completed import, schedule Expo-supported background work and use persisted normalized state to perform bounded, idempotent delta reconciliation without any mounted UI. Foreground activation performs the same permitted catch-up.

## Boundaries & Constraints

**Always:** Reuse the existing local SQLite database, normalized `SourceCandidate` fields, stable asset IDs, lifecycle barriers, and page-size bounds. Store maintenance state, reconciliation checkpoints, source revisions/presence, and a durable change queue for M2.6. Detect source absence as deletion only after a completed full-library reconciliation; limited/selected absence remains an access limit. Preserve canonical evidence, correction overlays, manual/confirmed history placeholders, and local-only processing. Define the Expo task at module scope and persist a paused state before expiration/interruption. Stop/unregister scheduled work when the owner disables it, disconnects, deletes history, or photo access is revoked. The Settings surface must explain its current enabled, pending, restricted, checked, and updated state without claiming an exact schedule.

**Never:** Copy, download, decode, upload, log, analyse, or commit media, filenames, paths, URIs, EXIF, coordinates, opaque source IDs, or raw evidence. Do not auto-enable maintenance, request/expand photo permission, turn selected-picker imports into automatic maintenance, add continuous GPS or cloud/AI work, infer/recompute journeys, replace corrections, or update a published share. Do not promise immediate triggers, fixed cadence, force-quit execution, physical-device validation, or source deletion from a limited scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Owner enables maintenance | Connected record with completed full/limited import and supported scheduler | Persist enabled state, register the named task, and report pending until a run completes | Keep it disabled with a recoverable restricted/error state when registration is unavailable |
| Worker delta page | Connected permitted full/limited scope with old/new stable metadata | Compare normalized identity/revision/availability, upsert only changed rows, queue additions/changes/new availability, and checkpoint each page | Persist paused checkpoint on read failure or expiration; unchanged rows create no event or media work |
| End of reconciliation | Completed full scope versus limited scope | Queue full-scope missing known identities as deletions; never do that for limited scope | Preserve local evidence and report restricted/pending on permission changes |
| Lifecycle or duplicate run | Disable/disconnect/delete/revocation, expiration, or overlapping worker calls | Cancel/unregister where applicable; at most one run writes and a late worker cannot restore deleted/disconnected state | Leave a recoverable checkpoint and durable truthful status |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/{types,repository,coordinator}.ts` -- extend the versioned SQLite contract from schema v2 with maintenance preference/status, reconciliation checkpoints, stable revision/presence state, and a deduplicated change queue; reuse lifecycle-gated transactions and page imports.
- `apps/mobile/src/photo-access/{native-adapter,controller,provider}.tsx` -- reuse native normalized metadata reads, connect foreground activation to permitted catch-up, and notify maintenance after a completed initial import without changing selected-photo semantics.
- `apps/mobile/src/history-record/{types,controller}.ts` -- couple owner disconnect/delete to cancellation of future scheduling while retaining their existing lifecycle guarantees.
- `apps/mobile/src/maintenance/` -- new UI-independent reconcile runner, controller, scheduler adapter, and native module-scope Expo task registration; provide web/test-safe adapter boundaries.
- `apps/mobile/src/app/_layout.tsx` and `app.json` -- load the native task registration early and configure the iOS processing background mode through Expo CNG.
- `apps/mobile/src/components/mobile-screens.tsx` -- add the Settings toggle and honest aggregate maintenance status; leave the concurrent Welcome UI untouched.
- `apps/mobile/src/components/__tests__/` -- extend synthetic repository/coordinator/UI tests and add deterministic maintenance/scheduler tests; task-handler behavior remains distinct from device scheduling proof.
- `apps/mobile/{package.json,package-lock.json,README.md}` and `docs/project-state.md` -- add Expo-compatible scheduler packages and record the runtime/device evidence limits.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/package.json`, `package-lock.json`, and `app.json` -- install Expo SDK 57-compatible `expo-background-task` and `expo-task-manager`; configure native processing support without adding location capability.
- [x] `apps/mobile/src/maintenance/` and `_layout.tsx` -- define the named task at native module scope, implement registration/unregistration/status behind a testable adapter, serialize worker runs, react to expiration, and call a headless persisted reconcile runner.
- [x] `apps/mobile/src/import-record/{types,repository,coordinator}.ts` -- migrate SQLite in place and commit bounded delta pages, durable state/checkpoints, and idempotent M2.6-facing change events while maintaining lifecycle transaction barriers.
- [x] `apps/mobile/src/photo-access/{controller,provider}.tsx` and `src/history-record/{types,controller}.ts` -- enable maintenance only from owner control after an import, perform foreground catch-up on activation, and stop future scheduling for lifecycle/access changes.
- [x] `apps/mobile/src/components/mobile-screens.tsx` -- expose an accessible automatic-maintenance control and truthful current/last-result copy.
- [x] `apps/mobile/src/components/__tests__/` -- cover registration state, no-mounted-UI worker execution, delta/idempotency, full-versus-limited deletion detection, expiry/checkpoints, duplicate-run exclusion, lifecycle cancellation, foreground catch-up, and status UI with synthetic evidence only.
- [x] `apps/mobile/README.md` and `docs/project-state.md` -- document platform-controlled scheduling and required physical-device verification separately from handler tests.

**Acceptance Criteria:**

- Given a completed initial import and a connected private record, when the owner enables automatic maintenance, then a supported iOS/Android task is registered, runs only from persisted state, and Settings shows the owner that scheduling is inexact and controllable.
- Given a permitted background or foreground reconciliation with stable source metadata, when assets are added, changed, made newly available, or absent after a full scan, then only affected normalized records and deterministic change events are written; a repeated unchanged scan writes no duplicate events or media work.
- Given limited access, revocation, expiration, concurrent attempts, disconnect, disable, or deletion, when maintenance runs or resumes, then it does not treat limited absence as deletion, performs no unsafe late write, stops future scheduling where required, and exposes a recoverable pending/restricted state.
- Given the scheduler/task and maintenance storage, when source or test code is inspected, then no raw media, paths, EXIF, coordinates, opaque IDs, or direct logs are introduced, and handler correctness is not presented as OS scheduling evidence.

## Implementation Notes

Research selected Expo BackgroundTask plus TaskManager instead of the deprecated BackgroundFetch API. Expo documents a module-scope task definition, persistent registration, inexact OS-controlled execution, iOS physical-device-only availability, and development-only task triggers. The selected default is owner opt-in after a completed import, preserving the existing privacy-first connection flow.

## Spec Change Log

## Review Triage Log

| Layer | Finding | Verdict | Route and evidence |
| --- | --- | --- | --- |
| Blind and edge review | Existing records did not reliably participate in delta presence tracking. | Fixed | Migration backfills presence and normal imports seed it. |
| Blind review | M1.5 needed a durable cross-runtime run identity and overlapping-worker guard. | Fixed | Schema v5 has a sequence plus renewable, expiring lease; runner contracts cover overlap. |
| Blind and edge review | Offset pagination could turn a transient omission into a deletion. | Fixed | A missing identity needs two completed full scans; limited scans never delete. |
| Blind and edge review | Stable metadata wrote unnecessary evidence updates, while toggle and refresh races were fragile. | Fixed | Comparisons guard canonical writes; controller serializes transitions and writes recheck lifecycle, state, and lease. |
| Verification review | TaskManager behavior and real device persistence needed separate evidence. | Fixed / deferred | Task contracts are tested; physical SQLite migration and iOS/Android scheduling are deferred in project state. |

## Design Notes

The reconciliation runner owns all page/revision comparison and accepts adapters for its repository, photo access, clock, and cancellation signal. The Expo task is intentionally only a thin entry point: it must not instantiate React providers or expose task-manager APIs to SQLite/domain code. A completed full scan advances a run token; only then can its stable IDs identify missing known source references. The later M2.6 consumer receives durable aggregate-safe change events, not media or coordinates.

## Verification

**Commands:**

- `npm --prefix apps/mobile test -- --runInBand` -- expected: synthetic delta, lifecycle, scheduler, and Settings regressions pass.
- `npm --prefix apps/mobile run check` -- expected: tests, TypeScript, lint, and Expo Doctor pass with Expo-compatible packages.
- `npm run check` -- expected: foundation and evaluation smoke checks remain green.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**

- In iOS and Android development builds, enable the control after import, trigger the development-only worker, inspect the aggregate Settings status, revoke access, disconnect/delete, and confirm expected scheduling/task behavior without claiming normal production cadence.
