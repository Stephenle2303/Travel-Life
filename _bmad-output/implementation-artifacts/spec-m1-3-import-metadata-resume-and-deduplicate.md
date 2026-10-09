---
title: 'M1.3 Import metadata, resume and avoid duplicates'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9fa506fe0b960211cd50b42ae83166c2557600d7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/decisions/0003-library-access-default.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M1.2 observes only current scope and a count. An owner cannot yet create a resumable private metadata record or repeat a scan without duplicate source evidence.

**Approach:** Page the permitted scope into a local-only normalized metadata index with durable checkpoints. Show progress and coverage, never media, coordinates, filenames, or a travel claim.

## Boundaries & Constraints

**Always:** Read only current broad, limited, or selected scope; preserve asset IDs as opaque device-local references; record nullable timestamp/location availability without inventing precision, timezone, accuracy, or owner presence. Persist the import checkpoint/index locally, separate import fields from future corrections, never log raw metadata, and label counts as current accessible scope—not lifetime coverage.

**Never:** Upload, decode, or copy media; surface filenames, URIs, IDs, or coordinates; create journeys, infer visits, publish, request broader access, or treat a missing picker ID as stable. Deletion/disconnect, background work, canonical reconstruction storage, and encryption claims are later-story work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Permitted library | Broad or limited scope | Page photo/video metadata and checkpoint each committed page | State the completed scope |
| Picker result | Stable and missing IDs | Import stable IDs; mark missing-ID items unavailable | Do not substitute identity or widen scope |
| Missing/unreadable asset | Null fields, cloud-only, or lookup failure | Preserve missing/unavailable status and continue | Never download media |
| Interruption/revocation | Active import stops | Keep committed pages; pause and recheck before resume | Discard late pages |
| Repeat or large run | Existing IDs, zero or many pages | One source record per ID; responsive observed coverage | Do not remove correction-owned data |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/photo-access/{types,native-adapter,controller,provider}.ts(x)` -- extend M1.2's permission, serial-interruption, and native query boundary with opaque metadata pages/selected IDs.
- `apps/mobile/src/import-record/` -- new normalizer, SQLite schema/repository, and import coordinator; its import index/checkpoint is not M1.4's deletion/correction API.
- `apps/mobile/src/components/mobile-screens.tsx` -- reuse Living Atlas controls for Start/Resume/Cancel and coverage; Atlas remains non-reconstructive.
- `apps/mobile/src/components/__tests__/` -- existing synthetic adapter/controller/provider seams for paging and lifecycle behavior.
- `apps/mobile/package.json`, `package-lock.json`, `README.md`, and `docs/project-state.md` -- add SDK-57 `expo-sqlite` (`~57.0.4`), then document the boundary and checks. Do not change `apps/prototype/`.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/package.json`, `package-lock.json`, `src/import-record/` -- added SDK-matched SQLite and a migration-backed, parameterized checkpoint/index repository with stable-ID upserts and no loggable media fields.
- [x] `apps/mobile/src/photo-access/{types,native-adapter,controller,provider}.ts(x)` -- added normalized source candidates/selected IDs, nullable location/cloud status without paths/EXIF blobs, and permission-aware checkpoints, cancellation, resume, and dedupe.
- [x] `apps/mobile/src/components/mobile-screens.tsx` -- added Start/Resume/Cancel and accessible/scanned/geotagged/unavailable states while retaining M1.2 scope explanations.
- [x] `apps/mobile/src/components/__tests__/` -- covered empty, sparse, large, interrupted/restart, revoked, missing-ID, missing metadata, cloud/unavailable, repeat/dedup runs, correction-marker preservation, and Import coverage UI.
- [x] `apps/mobile/README.md`, `docs/project-state.md` -- documented the local-data boundary, native rebuild/device checks, observed verification, and M1.4 handoff.

**Acceptance Criteria:**

- Given permitted media, when import starts, then only accessible image/video metadata is indexed with nullable timestamp/location/source fields—without upload, location display, or travel conclusion.
- Given interruption, restart, repeat, or a permission change, when import resumes, then committed stable IDs are not duplicated, correction-owned data remains, and stale scope is never read.
- Given empty, sparse, selected, unavailable, or large synthetic sources, when import finishes or pauses, then accessible/scanned/geotagged/unavailable counts are clear and never presented as lifetime coverage.

## Implementation Notes

- Extend the installed Expo media-library adapter, not a second media dependency. SDK 57 has lightweight metadata pages and opaque `Asset` IDs; location is nullable and requires configured Android media-location access.
- M1.3 SQLite holds only the resumable import run/checkpoint and source index. M1.4 owns canonical evidence/history/correction lifecycle, disconnect, and deletion.

## Spec Change Log

## Review Triage Log

- **Blind Hunter — picker import required full/limited access:** **patch.** The coordinator previously inspected and rejected an owner-selected picker result after broad access was denied. It now treats the explicit picker result as its own source, and the import-coordinator test covers denied-library selected import.
- **Blind Hunter — repeated selected import double-counted coverage:** **patch.** Completed selected checkpoints are reset to zero counters before the next run; the repeat test now verifies one indexed source and one scanned record.
- **Blind Hunter — selected import had no running/cancel state:** **patch.** Selected lookup moved inside the coordinator after it publishes `running`; cancellation changes the serial and drops the late result. The test asserts the resulting paused, empty import.
- **Blind Hunter — permission-scope changes showed old coverage:** **patch.** `applyPermission` clears incompatible full/limited coverage before restoring only the newly permitted scope, so current-scope labeling cannot inherit another scope's record.
- **Blind Hunter — offset resume could skip after library changes:** **patch.** A paused full/limited import now safely restarts its observed scan at offset zero and uses stable-ID upserts, rather than claiming a shifted offset is a stable cursor. The restart test asserts the zero offset and reset counters.
- **Blind Hunter — prototype map responder can consume marker taps:** **defer.** This is an earlier synthetic prototype interaction, not changed by M1.3. A new deferred-work entry records the separately scoped correction.
- **Blind Hunter — prototype hero failure persists across source changes:** **defer.** This is outside the M1.3 mobile import surface and was already recorded in `deferred-work.md`.
- **Blind Hunter — Android write-storage permission conflicted with block list:** **patch.** `WRITE_EXTERNAL_STORAGE` was removed from declared permissions and remains explicitly blocked.
- **Blind Hunter — import schema version was unused:** **patch.** The repository now uses a versioned `import_schema_version` migration transaction, rolls it back on error, and retries lazy open after failure.
- **Blind Hunter — project-state next-work handoff was stale:** **patch.** The top-level handoff now calls for M1.3 Android/iOS device verification followed by M1.4, not starting M1.1/M1.2.
- **Blind Hunter — mobile/prototype checks are absent from CI:** **defer.** This predates M1.3 and is already recorded in `deferred-work.md`; adding app dependency installs/jobs is a separate CI story.
- **Edge Case Hunter — repeated selected IDs inflate counters:** **patch.** Independently confirmed and covered by the reset-on-repeat selected-import test.
- **Edge Case Hunter — vanished stable picker IDs were omitted from unavailable:** **patch.** The coordinator derives disappeared stable IDs from the requested ID set versus normalized candidates, increments unavailable, and never writes a substitute row.
- **Edge Case Hunter — cancel during durable checkpoint restore can leave running coverage:** **patch.** Start/import now check their serial immediately after checkpoint read, so an earlier cancel returns before publishing `running`.
- **Edge Case Hunter — denied broad permission blocks the selected path:** **patch.** Independently confirmed; selected imports no longer gate on full/limited scope.
- **Edge Case Hunter — rejected selected lookup/commit can leave no outcome:** **patch.** Lookup/commit errors now become explicit paused coverage; initial checkpoint-read errors are also caught and surfaced as a recoverable paused state, with a regression test.
- **Verification Gap Reviewer — production SQLite was not tested:** **patch.** Added mocked `expo-sqlite` tests for migration initialization, read mapping, parameterized upsert/checkpoint commit, correction-table non-touching, migration rollback, and metadata-commit rollback.
- **Verification Gap Reviewer — prototype browser video adapter is not directly tested:** **defer.** The browser-only adapter belongs to earlier prototype work and is already recorded in `deferred-work.md`; no prototype code changed for M1.3.

## Design Notes

Coverage is evidence about the source, not a progress bar toward a promised life story. Keep controls fast; reserve cinematic treatment for reveal/replay.

## Verification

**Commands:**

- `npm --prefix apps/mobile run check` -- expected: Jest synthetic import/access tests, TypeScript, lint, and Expo Doctor pass.
- `npm run check` -- expected: root foundation and eval smoke remain green.
- `git diff --check` -- expected: no malformed patch whitespace.

**Observed on 2026-10-09:** Mobile `npm run check` passed 47 Jest tests, TypeScript, Expo lint, and Expo Doctor. Root `npm run check` passed 20 foundation tests and eval smoke; `git diff --check` passed. The matrix rows are covered by the registered mobile Jest suites. Physical Android SQLite import and iOS validation remain pending.

**Manual checks:**

- Rebuild Android after adding SQLite; on a consented small sample start, cancel, resume, and repeat import. Record only aggregate coverage, permission, GPS/cloud, and resume observations. iOS remains pending.
