---
title: 'M1.4 Persist privately and provide disconnect/delete'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '86e38a45176c8baa27730c711b2ad5d6bc4e7ab2'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/decisions/0002-mvp-first-delivery.md'
  - '{project-root}/docs/decisions/0004-background-maintenance-in-mvp.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M1.3 keeps a resumable, local import index but has no canonical private record, owner correction lifecycle, or way to deliberately stop a connection or remove local history. An owner cannot yet distinguish stopping future source reads from erasing the local record.

**Approach:** Extend the existing device-local SQLite database in place with a migration-backed canonical record and lifecycle state. Add a private Settings surface with clearly different disconnect and delete-local-history actions, their consequences, and a destructive-action confirmation.

## Boundaries & Constraints

**Always:** Keep originals in the photo source; retain only normalized local evidence, provenance, uncertainty, imported history placeholders, and correction overlays. Use stable identities, parameterized queries, migration transactions, and explicit error results. Preserve current import paging, deduplication, committed checkpoints, permission/revocation behavior, and future correction lineage. Describe actual backup/data-protection behavior without claiming encryption, deletion outside this device, complete coverage, owner presence, or a background scheduler that M1.5 has not created.

**Never:** Copy, decode, upload, display, log, analyse, or commit media, filenames, URIs, raw EXIF, opaque asset IDs, precise coordinates, raw traces, or real evidence. Do not add cloud sync, AI processing, reconstruction rules, journeys/visits inferred from metadata, a second database, an ORM, automatic permission recovery, or a background worker. Do not treat selected/limited-scope absence as source deletion.

**Decisions:** Private local history may participate in normal OS/device backups and be restored under the platform/account protections that apply; the app must disclose this behavior and must not describe it as encryption. Disconnect retains the complete local private record, opaque source references, and import checkpoints for a later owner-initiated reconnect, while disabling future source reads and maintenance. Delete local history remains the separate action that clears covered local data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upgrade | Existing M1.3 import database | In-place schema migration retains imported source/index state and starts a private lifecycle record | Roll back migration; retry safely without a partial schema |
| Correction overlay | Stable target, scope, owner action and lineage | Persist a revisioned overlay separately from import upserts | Reject malformed targets; never silently remap an ambiguous successor |
| Disconnect | Connected private record | Stop future source/maintenance work and present the chosen retained-data consequence | Keep current local record; no automatic reconnect or source read |
| Delete local history | Owner confirms deletion | Atomically clear all locally covered evidence, history, corrections, checkpoints, lifecycle state, and registered caches | Report failure truthfully; late writes cannot recreate deleted state |
| Revoked access | Permission changes before/after a lifecycle action | Existing private data remains local; no import restarts | Surface access state and require an owner action to reconnect |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- migrate the existing `travel-life-import-v1.db` in place; preserve page commits while exposing a shared lifecycle/storage seam.
- `apps/mobile/src/import-record/{types,coordinator}.ts` and `src/photo-access/{controller,provider}.tsx` -- keep current import/revocation cancellation semantics; gate future imports through lifecycle state without requesting permission.
- `apps/mobile/src/history-record/` -- new canonical record, correction-overlay, lifecycle, and deletion repository/controller modules; no raw-media fields.
- `apps/mobile/src/components/mobile-screens.tsx`, `src/app/settings.tsx`, and `src/navigation/app-contract.ts` -- add the Settings route and owner-facing lifecycle controls while preserving Import and empty Atlas claims.
- `apps/mobile/src/components/__tests__/{import-repository,import-coordinator,owner-flow,navigation-contract,router-tree}.test*` -- extend SQLite, lifecycle, and UI regressions with synthetic data only.
- `apps/mobile/README.md` and `docs/project-state.md` -- document actual storage/backup policy, lifecycle boundaries, verification, and pending device evidence.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/src/history-record/` and `src/import-record/repository.ts` -- add a versioned in-place schema migration, canonical private record, correction overlays, lifecycle state, and atomic disconnect/delete operations without changing M1.3 source-field privacy boundaries.
- [x] `apps/mobile/src/import-record/{types,coordinator}.ts` and `src/photo-access/{controller,provider}.tsx` -- serialize lifecycle changes with imports, prevent late writes after deletion, and require owner action before any renewed import.
- [x] `apps/mobile/src/{app/settings.tsx,components/mobile-screens.tsx,navigation/app-contract.ts}` -- expose a private Settings route with distinct consequence copy, explicit delete confirmation/cancel, recoverable failure state, and no misleading scheduling claim.
- [x] `apps/mobile/src/components/__tests__/` -- add migration, rollback, correction-survival, disconnect, confirmed/cancelled/failed deletion, late-write, privacy-schema, and navigation/UI tests using synthetic values.
- [x] `apps/mobile/{README.md,app.json}` and `docs/project-state.md` -- record the approved backup/data-protection behavior and actual capability limits; apply only the platform configuration needed by that decision.

**Acceptance Criteria:**

- Given an M1.3 local index, when M1.4 opens it, then the in-place migration preserves indexed sources and future import repeats remain deduplicated without erasing correction overlays.
- Given a private canonical record, when an owner disconnects or deletes local history, then the UI makes their distinct retained/deleted data consequences clear; deletion requires confirmation and clears every covered local table/cache without claiming to delete source media or remote copies.
- Given an interrupted import, revoked permission, migration failure, delete failure, or a late page, when lifecycle state changes, then no stale write restores deleted state, access never restarts automatically, and errors stay recoverable and honest.
- Given the M1.4 schema and controls, when tests inspect storage/UI/telemetry seams, then no media, raw EXIF, filenames, URIs, precise coordinates, opaque IDs, or raw evidence are surfaced or logged.

## Implementation Notes

Use the installed Expo SDK 57 `expo-sqlite` seam; research found no need for a new ORM or database dependency. SQLite encryption and native backup exclusion are not claimed until the approved policy is configured and device-validated. No cache currently exists; maintain an explicit empty cache registry so deletion has an auditable covered-data boundary.

Implemented version 2 in the existing SQLite database, including canonical evidence copied from the M1.3 source index, empty-ready inferred-history storage, revisioned correction overlays, a retained disconnect state, and transactional local deletion. Deletion clears the legacy correction-marker table as well as the M1.4 correction overlays, records, checkpoints, and cache registry. The import coordinator reads lifecycle state before any source metadata read and its serial cancellation barrier discards late pages after disconnect or deletion. The Settings route explains normal device-backup restoration, has a cancellable confirmation for deletion, and only says that deletion affects this device's local record. Normal backup requires no app configuration change; `app.json` remains limited to the already-approved media permission configuration.

Verification on 2026-10-10: targeted red/green tests covered the missing Settings route, disconnected metadata import, disconnected photo count, cancelled lifecycle prechecks, correction target/lineage validation, deletion UI cleanup, and overlapping lifecycle actions. Full mobile check passed 83 tests, TypeScript, Expo lint, and Expo Doctor (21/21); coverage was 82.13% statements, 74.37% branches, 80.92% functions, and 86.41% lines. Root `npm run check` passed its 20 foundation tests and evaluation smoke check. Pending manual validation is confined to physical-device SQLite migration/deletion, backup restoration, and iOS behavior.

## Spec Change Log

## Review Triage Log

| Layer | Finding | Verdict | Route and evidence |
| --- | --- | --- | --- |
| verification-gap | Welcome offscreen pause lacks a screen-boundary test. | defer | The changed Welcome is concurrent work outside this private-record story; no M1.4 behavior depends on its scroll boundary. Recorded with the Welcome follow-up. |
| verification-gap | SQLite migration/deletion uses a non-executing mock. | defer | The synthetic SQL contract tests pass, while the required physical-device migration/deletion check remains explicitly pending in the story and project state. |
| verification-gap | Welcome media adapters lack runtime smoke coverage. | defer | The Welcome implementation is concurrent work outside M1.4 and does not affect this story's lifecycle behavior. Recorded with the Welcome follow-up. |
| blind-hunter | Disconnect/delete did not stop a count already in progress. | medium | Real: `stopImport` only cancelled metadata imports, so an active `readPage` loop could continue. Patched `stopImport` to invalidate counts; regression test passes. |
| blind-hunter | Disconnected/deleted records could open the selected-photo picker. | medium | Real: `selectPhotos` had no lifecycle guard. Patched it to require a connected record; regression test passes. |
| blind-hunter | Disconnected/deleted records could open limited-selection management. | medium | Real: `manageLimited` had no lifecycle guard. Patched it to require a connected record; regression test passes. |
| blind-hunter | Disconnected records accepted correction writes. | medium | Real: correction persistence only rejected deletion. Patched it to require the connected lifecycle state; repository regression passes. |
| blind-hunter | Corrections accepted nonexistent targets. | medium | Real: no target existence check was present. Patched canonical/inferred target validation; repository regression passes. |
| blind-hunter | Correction replacement lineage was unverified. | medium | Real: only self-reference was rejected. Patched same-target/scope replacement lookup; repository regression passes. |
| blind-hunter | Deletion retained stale provider counts, selections, and coverage. | medium | Real: SQLite was cleared but provider state was not. Patched deletion callback and coordinator reset; controller regressions pass. |
| blind-hunter | Deleted owners had no UI action to create a new record. | medium | Real: imports correctly blocked a deleted record with no recovery action. Patched an explicit Start a new private record action; Settings regression passes. |
| blind-hunter | Lifecycle actions could overlap. | medium | Real: disconnect/delete/reconnect had no action serialization. Patched a pending-action guard; overlap regression passes. |
| blind-hunter | Welcome used a fixed offscreen threshold. | defer | This is a concurrent Welcome concern, outside the approved M1.4 intent; recorded with the Welcome follow-up. |
| blind-hunter | Private-record schema version was stale. | low | Real: the private record seed used version 1 while database migration is version 2. Patched seed and reconnect values to 2; migration regression passes. |
| blind-hunter | NotFound Return home skips Welcome. | defer | This is a concurrent navigation change, outside M1.4 intent; recorded with the Welcome follow-up. |
| edge-case-hunter | Count could continue after disconnect/delete. | medium | Duplicate confirmed by the targeted in-flight count test; fixed with the shared count interruption patch. |
| edge-case-hunter | A lifecycle precheck could race with start. | medium | Real: token allocation followed the awaited precheck. Patched start to allocate/check the token before source reads; regression passes. |
| edge-case-hunter | A lifecycle precheck could race with selected import. | medium | Real: selected import had the same sequence. Patched and covered with a pending-check cancellation regression. |
| edge-case-hunter | Correction persistence allowed disconnected maintenance. | medium | Duplicate confirmed and fixed by the connected-state correction guard. |
| edge-case-hunter | Correction targets were not validated. | medium | Duplicate confirmed and fixed by stable-target validation. |
| edge-case-hunter | Lifecycle actions could interleave. | medium | Duplicate confirmed and fixed by the pending-action guard and overlap regression. |

## Verification

**Commands:**

- `npm --prefix apps/mobile run check` -- expected: synthetic lifecycle/import tests, TypeScript, lint, and Expo Doctor pass.
- `npm run check` -- expected: root foundation and evaluation-infrastructure smoke checks remain green.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**

- On each available development build, inspect the disconnect and confirmed/cancelled delete flows using only aggregate/synthetic observations; verify deletion does not remove source media and no import starts until the owner acts.
