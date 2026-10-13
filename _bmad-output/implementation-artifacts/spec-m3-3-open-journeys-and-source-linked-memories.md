---
title: 'Open journeys and source-linked memories'
type: 'feature'
created: '2026-10-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0e8fffd27135b7c231de6d6da4a85a56ffb06351'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-2-connect-the-lifetime-map-and-timeline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Atlas selection currently ends at an anonymous map or Timeline card. An owner cannot inspect the supported visits, available source-linked memories, or the distinct reasons a photo is associated with a journey or supports a destination.

**Approach:** Add a private Journey detail route that loads a bounded, lifecycle-gated detail projection from the local record only after the owner chooses a displayed journey. It follows the official Living Atlas composition and leads back to Atlas and forward to the later correction work without changing data.

## Boundaries & Constraints

**Always:** Keep the M3.2 Atlas projection redacted. Resolve the selected opaque display ID inside a separate local SQLite boundary; expose only owner-readable spans, chronological visit summaries, uncertainty, membership and visit-support reasons, and bounded availability states. Resolve at most a small visible set of media previews only after current permission, connected lifecycle state, and availability checks; downscale/cache previews locally and keep source IDs, URIs, filenames, EXIF, precise coordinates, capture timestamps, and raw evidence out of telemetry, logs, navigation parameters, Atlas state, and Git. Label journey membership separately from destination support, preserve GPS-less/unresolved/unassigned uncertainty, and retain a usable text detail if preview resolution fails.

**Never:** Expand source access, download cloud media, decode an unbounded library, alter source or reconstruction records, automatically confirm/reject/edit history, publish/share/export media, invoke AI, or claim a photo proves owner presence, a route, exact duration, or complete coverage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Open a journey | Selected display ID with a connected committed local record | Show chronological visits, observed span/precision, separate evidence reasons, and a bounded available-memory strip | Return to the existing Atlas state if the record changes before load completes |
| Restricted or stale | Revoked access, disconnected/deleted record, or invalid display ID | Explain why detail cannot be read and offer reconnect or Atlas recovery | No late detail or preview write after lifecycle invalidation |
| Missing media | Cloud-only, removed, unavailable, or preview-read failure | Keep the journey/evidence text and label the memory unavailable | Do not substitute another asset, download it, or expose an error payload |
| Uncertain evidence | GPS-less, unresolved, unassigned, or membership-only evidence | Explain its association and keep it reviewable without calling it visit support | Preserve source uncertainty and correction handoff |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/repository.ts` -- extend the committed-run read boundary with a detail-only local projection; reuse persisted journey/visit/support/membership/disposition links while retaining raw IDs in SQLite.
- `apps/mobile/src/photo-access/native-adapter.ts` and `types.ts` -- add a separate permission-gated, bounded owner-preview resolver; do not widen import metadata reads or selected-photo semantics.
- `apps/mobile/src/photo-access/provider.tsx` -- load/invalidate selected journey detail through the existing lifecycle generation guard.
- `apps/mobile/src/reveal/{types,projection}.ts` -- keep Atlas redaction intact and add only safe route/display helpers for a separately loaded detail model.
- `apps/mobile/src/components/{atlas-reveal,mobile-screens,journey-detail}.tsx` and `src/app/journey/[id].tsx` -- open selected detail, preserve contextual return to Atlas, render Living Atlas photo-led detail and non-mutating correction handoff.
- `apps/mobile/src/navigation/app-contract.ts` -- add the typed private detail route without placing private values in its URL.
- `apps/mobile/src/components/__tests__/{atlas-reveal,reconciliation-repository,native-photo-adapter,owner-flow,journey-detail}.test.tsx` -- cover selection/navigation, redaction, reason separation, lifecycle invalidation, and unavailable media states.
- `apps/prototype/src/components/prototype-screens.tsx` -- composition reference only; do not import fictional assets, data, or prototype persistence.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reconstruction/repository.ts` and `src/reveal/{types,projection}.ts` -- derive a bounded local journey-detail model with separate membership and visit-support explanations, date precision, and media availability; preserve M3.2's aggregate Atlas contract.
- [x] `apps/mobile/src/photo-access/{native-adapter,types,provider}.tsx` -- implement guarded bounded preview resolution and stale-read invalidation without expanding import scans or keeping media references in shared state.
- [x] `apps/mobile/src/navigation/app-contract.ts`, `src/app/journey/[id].tsx`, and `src/components/{atlas-reveal,mobile-screens,journey-detail}.tsx` -- add contextual selection-to-detail navigation, the official detail layout, honest unavailable states, and non-mutating correction entry points.
- [x] `apps/mobile/src/components/__tests__/` -- add deterministic repository, adapter, UI, and owner-flow coverage for every matrix state using synthetic identifiers only.
- [x] `docs/project-state.md` and this spec -- record verification and pending physical device/media behavior without treating synthetic tests as source-access evidence.

**Acceptance Criteria:**
- Given a private Atlas selection, when the owner opens its journey, then chronological visits, observed date span, available memories, and distinct membership/support reasons are shown without exposing raw record data outside the local boundary.
- Given revoked access, a deleted or cloud-only original, a missing asset, or a stale selection, when detail or a preview is requested, then the app keeps a truthful private text state and does not read a replacement or publish data.
- Given uncertain, GPS-less, or unassigned evidence, when the owner reviews detail, then its uncertainty and association are visible and correction actions are reachable without silently changing the record.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- blind-hunter — patch — Detail selection scans raw journey IDs on every open; retain the active opaque-to-local mapping within the repository and resolve the detail from that mapping.
- blind-hunter — patch — Visit rows lack a truthful chronological order; query ordered visit summaries using the committed run.
- blind-hunter — patch — Multiple visit-support records duplicate a visit because the display key includes an index; return one summary per visit.
- blind-hunter — patch — Detail does not expose GPS-less, unresolved, unassigned, date-precision, or membership-only uncertainty required by the approved constraints; extend the bounded projection and tests.
- blind-hunter — false — The route parameter is an opaque display ID, explicitly defined as neither a reconstruction nor a source identifier; it exposes no private source reference or media data.
- blind-hunter — patch — Plain View content can place correction and return controls beyond a phone viewport; use an accessible scroll container.
- blind-hunter — false — M4.1 owns correction implementation; the current Settings action is the available non-mutating correction handoff and does not claim selection-preserving editing.
- blind-hunter — patch — Disk caching creates a local preview copy outside the deletion boundary; retain only a bounded memory cache.
- edge-case-hunter — false — The opaque display ID in navigation state cannot resolve a source reference outside the local record and satisfies the route contract's source-data boundary.
- edge-case-hunter — patch — Separate MAX(run_id) queries can mix two completed reconstructions; bind every detail query to one captured completed run.
- edge-case-hunter — patch — SQLite has no ordered-row guarantee for the visit query; order summaries by available civil day and stable visit ID.
- edge-case-hunter — patch — Membership-only and unresolved/disposition evidence loses its association uncertainty in the detail projection; include only owner-readable reason labels.
- verification-gap — patch — The Atlas action-to-route handoff has no behavior test; assert the selected opaque display ID reaches the typed journey route.
- verification-gap — patch — The provider lifecycle generation checks have no behavior test; defer a detail or preview read, invalidate lifecycle, and assert rejection.
- verification-gap-other — patch — A visit with several supporting photos is rendered repeatedly; group rows by visit before rendering.

## Design Notes

Use the prototype's Journey Detail composition: a clear contextual return, a photo-led but optional header, observed-span and evidence callouts, a memory strip, and calm correction handoff. A missing preview must leave the same readable hierarchy rather than a blank media frame.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal reconciliation-repository native-photo-adapter owner-flow journey-detail` -- expected: private detail, lifecycle, media-availability, and navigation contracts pass.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint, and Expo Doctor pass.
- `npm run check` -- expected: repository framework and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Actual (2026-10-13):** Focused Atlas/detail/repository/adapter/owner-flow tests passed 6 suites / 37 tests. Mobile Jest passed 24 suites / 176 tests; TypeScript and Expo lint passed. Expo Doctor completed 20/21 checks and reported six pre-existing SDK 57 patch-version mismatches, so the full mobile check remains failed until a separate dependency-maintenance decision. Root `npm run check` passed its 20 framework/evaluation tests and smoke check. `git diff --check` passed. These checks do not verify physical iOS/Android photo permission, preview rendering, cloud-only behavior, cache behavior, lifecycle interruption, or reconstruction accuracy.
