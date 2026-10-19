---
title: 'Named private Home bases'
type: 'feature'
created: '2026-10-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
  - '_bmad-output/specs/spec-trip-continuity-and-home-setup/home-base-experience.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A saved Home base is currently only an opaque selected visit plus private center, radius and date scope. The owner cannot see whether it represents Sa Dec or Ho Chi Minh City, manage it confidently, or correct its label without changing the trip engine context.

**Approach:** Persist an optional owner-editable display label and origin with every private Home base. The Home bases screen will require an explicit label when creating a new base, display saved named cards, and provide rename/remove actions. The engine continues to use only the private area, radius and active dates; labels never become detection evidence.

## Boundaries & Constraints

**Always:** Keep labels, centers, dates, radius, origin and IDs in the device-local private database; preserve existing Home records unchanged; retain the 20 km default for new selections; require a non-empty, trimmed owner label; refresh local reconstruction after create, rename or removal; preserve the owner-selected observed area and its media-review step; use the Living Atlas controls and accessible labels.

**Never:** Send a coordinate or label to a network geocoder; infer a city/locality from country geometry; expose exact coordinates or source identifiers in the UI; silently rename existing entries; make labels influence trip qualification or merge rules; delete media/originals when a Home base is removed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| New named base | Owner selects an observed area, enters `Sa Dec, Dong Thap`, and saves | A local 20 km Home base card displays the name and its all-history/date scope; history refreshes | Save stays disabled for blank/whitespace label or no area |
| Multiple bases | Sa Dec and Ho Chi Minh City are both saved | Two independent cards appear; both contexts apply without averaging | Each card remains separately editable/removable |
| Legacy base | Existing v30 row lacks a label | It remains active and displays `Unnamed home base`; owner can rename or remove it | No coordinate/radius/date mutation during migration |
| Rename | Owner edits a saved name only | Same Home base ID, center, radius and dates remain; card updates and refresh is requested | Validation error retains typed text and old saved name |
| Remove | Owner confirms removal | Only that local Home base is deleted; photos and original private history remain | Failure leaves the card visible and reports a retryable message |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- owns schema version/migrations and private configured-home CRUD; add a v31 additive migration and preserve v30 rows.
- `apps/mobile/src/import-record/types.ts` -- extend the private `ConfiguredHomeArea` contract with optional owner label/origin while retaining local-only coordinate boundaries.
- `apps/mobile/src/reconstruction/repository.ts` -- selected journey/visit write gate; accept and persist only validated owner label while keeping its coordinate resolution private.
- `apps/mobile/src/photo-access/provider.tsx` -- expose local list/create/rename/remove commands and coordinate the existing reconstruction refresh without publishing labels.
- `apps/mobile/src/components/mobile-screens.tsx` -- Home bases screen; retain media/area review, add editable label field and saved-card management.
- `apps/mobile/src/components/__tests__/{import-repository,privacy-settings-screen,photo-access-provider}.test.tsx` -- migration, owner flow and refresh/error regressions.
- `apps/mobile/src/reconstruction/engine-v1-1.ts` -- do not change detection semantics; only verify type compatibility.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/import-record/{repository,types}.ts` -- add v31 label/origin columns and typed local CRUD, with v30-to-v31 preservation.
- [x] `apps/mobile/src/reconstruction/repository.ts` and `apps/mobile/src/photo-access/provider.tsx` -- validate trimmed labels, preserve a stable Home ID for rename, and schedule the existing local refresh after create/update/delete.
- [x] `apps/mobile/src/components/mobile-screens.tsx` -- add accessible name input, named Home cards, edit/save/cancel and confirmed removal while retaining selected-area and scope disclosure.
- [x] `apps/mobile/src/components/__tests__/*home*` -- cover all matrix cases, including labels not entering engine inputs or reveal projection.
- [x] `docs/project-state.md` and `docs/development/error-playbook.md` -- record migration/result and any incident from verification.

**Acceptance Criteria:**
- Given an owner selects an observed area and enters `Sa Dec, Dong Thap`, when Save completes, then the saved Home bases list names it without showing coordinates and uses its existing private context on rebuild.
- Given two saved named bases, when the engine rebuilds, then it applies each date-scoped area independently and no label changes automatic trip output.
- Given an upgraded legacy record, when v31 opens, then it remains configured with its old radius/dates and an explicit unnamed state rather than a fabricated location.
- Given a Home base card, when the owner renames or confirms removal, then the change is local, immediate in the screen, resilient to failure, and does not delete source media.

## Implementation Notes

- 2026-10-17: Added schema v31 (`owner_label`, `origin`) and local list/rename/delete support. New names are deliberately owner-entered because the only bundled resolver is country-level; no coordinate is sent to a geocoder.
- 2026-10-17: The Home bases screen now requires a label after an explicit journey/area review, and shows named cards with local rename and confirmed remove flows. Label fields are never passed to reconstruction evidence or reveal projection.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence and route |
|---|---|---|
| Civil day used as session corroboration | false | V1.1 intentionally uses a dated civil block as the conservative normalization unit while explicitly withholding intraday order; it is not represented as a native session claim. |
| Explicit non-capture provenance was overwritten | medium | Verified in the persisted adapter. Patched by retaining `source_origin` locally and deriving non-capture eligibility from it; focused reconciliation and engine suites pass. |
| Video rows counted as photos | false | Final qualification receives the persisted `mediaByEvidence` map and excludes `video`; videos may remain journey members but cannot satisfy the five-photo gate. |
| Distance did not subtract uncertainty radii | low | Real conservative-improvement opportunity in V1.1, but it predates this Home-base labeling story and requires detector-policy evidence; deferred. |
| Undated evidence used date-scoped homes | medium | Verified in canonical configured-distance calculation. Patched to fail closed when the civil day is invalid or absent. |
| Malformed configured radius could be applied | medium | Verified in pure normalization. Patched to reject non-finite/out-of-range radii and invalid home periods. |
| Home-return corroboration was aggregated across different homes | medium | Verified. Patched so return corroboration is calculated independently for each configured home area. |
| Undated rows leaked into routine history | medium | Verified. Patched to use only reliably prior instants and withhold routine inference when chronology is unknown. |
| Null timestamp sorted as a chronological endpoint | medium | Verified. Patched to choose reliable chronological endpoints or return `incomparable-time`. |
| Unqualified candidate projections remain durable internal journeys | low | Existing V1.1 projection separation concern, outside named Home-base intent; private reveal still joins confirmed qualifications only. Deferred for the engine hardening story. |
| Upgrade could lack qualification backfill | false | Migration v29 already backfills every existing reconstruction journey as a private `SUGGESTED` row, preventing an empty Atlas caused by the new join. |
| Continuity IDs could orphan corrections | false | Effective corrections are resolved before the V1.1 projection and their targets are protected from heuristic rewriting; unmatched support aborts reconciliation for owner review. |
| Missing regression coverage for several engine edge cases | medium | The configured-day/radius, per-home return, provenance and chronology fixes are covered by focused suites; broader uncertainty and internal-projection cases are deferred to engine hardening. |
| Invalid civil date persisted for generic Home CRUD | medium | Verified. Patched local CRUD validation and selected-journey save validation to require a real calendar day. |
| Stale journey-detail response could overwrite a newer selection | medium | Verified. Patched a monotonic request guard before publishing preview/media state. |
| Video-only candidate in canonical adapter | false | It cannot gain automatic status because persisted final qualification passes its actual `media_type`; no photo gate bypass occurs. |
| Rename reported refresh after a failed rebuild | medium | Verified. Patched provider status checks and owner-facing recovery wording. |
| Remove reported refresh after a failed rebuild | medium | Verified. Patched provider status checks and owner-facing recovery wording. |
| Persisted provenance-gate verification gap | medium | Verified. The adapter now carries explicit source provenance instead of overwriting it; focused reconciliation coverage passes. A full database-loop fixture remains part of the V1.1 hardening backlog. |

## Design Notes

The repository has no offline city/locality resolver. New bases therefore ask for an owner-entered label rather than fabricating one from the Admin-0 country dataset. This keeps Sa Dec and Ho Chi Minh City accurate, editable and private.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand import-repository privacy-settings-screen photo-access-provider reconstruction-engine` -- expected: Home label/migration/engine-isolation regressions pass.
- `npm --prefix apps/mobile run check` -- expected: tests, TypeScript and lint pass; existing Expo Doctor warnings are reported separately.
- `npm run check` -- expected: foundation and evaluation-infrastructure checks pass.
- `git diff --check` -- expected: no whitespace errors.
