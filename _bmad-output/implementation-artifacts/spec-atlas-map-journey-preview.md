---
title: 'Atlas map journey preview'
type: 'feature'
created: '2026-10-15'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-journey-preview/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-journey-preview/experience.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-journey-preview/acceptance.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Selecting an Atlas map anchor only exposes an “Open journey” route, so an owner loses map context before seeing trustworthy journey or associated-media context. Correction return also resets Atlas rather than safely restoring its map state.

**Approach:** Add a private in-place Atlas preview card, a bounded mixed photo/video viewer, and correction handoff that preserve valid Map/Timeline selection context. Read selected-media data only from the current local committed projection and discard stale results.

## Boundaries & Constraints

**Always:** Keep opaque display IDs, coarse anchors, and source references inside the local repository/provider boundary. Show owner title/date claims separately from observed evidence; use “Private journey” rather than deriving a place from an anchor. Resolve bounded, eligible associated media only after explicit selection; video starts only after a deliberate Play action, remains muted initially, and pauses on background/item/viewer close. Preserve camera, filter, selected point, card state, and focus across viewer/correction return only while the selected record remains valid. Provide equivalent Timeline selection when MapLibre or tiles fail.

**Never:** Send media, source IDs, precise coordinates, journey contents, or gallery membership to map tiles or telemetry; download cloud media; make media membership into visit support; autoplay video; publish/share/export media; use prototype imagery; fabricate routes, destinations, durations, or owner presence; silently choose an overlapping anchor; or reopen a stale/ambiguous successor after a correction.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Select a journey | Current map/timeline journey with committed local record | Preview shows title provenance, observed span, worded status, and photo/video/unavailable context | Slow media cannot block map interaction |
| Rapid or invalid selection | A then B selection, revoke/disconnect/rebuild/filter change | Only B/current selection can publish; filtered, removed, or ambiguous selection closes with a plain changed message | Discard late result; retain valid viewport/filter |
| Browse media | Eligible mixed local associations, page request, photo/video item | Bounded gallery returns to the same card/context; explicit video Play only | No network fetch; unavailable slot remains truthful |
| Correct journey | Return without save or save changing/rejecting/splitting/merging selected journey | Restore exact context for unchanged/unique successor; otherwise retain viewport/filter and close card | Refresh committed projection before deciding selection |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` -- evolve `AtlasReveal`, `NativeMap`, and map camera state from select-plus-open-route into card, overlap, empty-map dismissal, and context-aware selection; do not remount/reset the camera while preview changes.
- `apps/mobile/src/components/mobile-screens.tsx` and `apps/mobile/src/navigation/app-contract.ts` -- provide typed Atlas context handoff/return without navigation parameters containing private source data; current `key` and `router.push` behavior discard context.
- `apps/mobile/src/reveal/{types,projection}.ts` -- retain redacted list/map payloads and add only opaque/current selection helpers; do not place album contents in global Atlas state.
- `apps/mobile/src/reconstruction/repository.ts` -- replace the `loadJourneyDetail` four-row memory limit with a separate committed-projection, stable-order, deduplicated, paged eligible-media read; preserve association provenance and local-only source resolution.
- `apps/mobile/src/photo-access/{types,native-adapter,provider}.tsx` -- extend lifecycle-gated preview resolution to mixed media/video availability and paging. Reuse `durableRevealGate`/`canPublishJourneyDetail`; never publish a result after lifecycle or selection invalidation.
- `apps/mobile/src/components/{journey-detail,journey-correction}.tsx` and `src/app/journey/[id]{,.tsx,/correct.tsx}` -- reuse correction flow but add a map-origin return contract rather than its existing Atlas-resetting Back chain. The existing full detail remains a separate surface.
- `apps/mobile/src/components/__tests__/{atlas-reveal,journey-detail,journey-correction,photo-access-provider,reconciliation-repository}.test.tsx` -- test deterministic card/context/media/correction state transitions with synthetic IDs only.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/mobile/src/reconstruction/repository.ts`, `src/reveal/types.ts`, and `src/photo-access/types.ts` -- define bounded, ordered, deduplicated selected-journey media membership and current-projection identity/result contracts for mixed photos/videos.
- [ ] `apps/mobile/src/photo-access/{native-adapter,provider}.tsx` -- resolve paged local photo/video previews and player lifecycle under existing permission/durable-reveal guards, including stale selection rejection.
- [ ] `apps/mobile/src/components/atlas-reveal.tsx`, `src/reveal/projection.ts`, and UI primitives as needed -- render Living Atlas map/timeline preview card, accessible close/selection/overlap handling, honest empty states, and camera-safe context state.
- [ ] `apps/mobile/src/components/media-viewer.tsx` and associated route/navigation plumbing -- implement a local bounded mixed-media gallery/item viewer with explicit muted video Play and safe Atlas return.
- [ ] `apps/mobile/src/app/journey/[id].tsx`, `src/app/journey/[id]/correct.tsx`, `src/components/mobile-screens.tsx`, and correction components -- establish map-origin correction return and safe unique-successor versus changed-selection behavior.
- [ ] `apps/mobile/src/components/__tests__/` -- cover A→B stale-result suppression, overlap choice, unavailable media, gallery paging, video play/background/close, Timeline fallback, map/viewer/correction return, and corrected/rejected/split/merged selection behavior.
- [ ] `docs/project-state.md`, `docs/development/error-playbook.md`, and this spec -- record verification, device limits, and task incidents without private evidence.

**Acceptance Criteria:**
- Given an eligible selected Atlas journey, when the owner taps its map point or Timeline control, then a card appears without navigating or moving the Timeline and labels observed versus owner-provided facts accurately.
- Given photos/videos are associated and accessible, when the owner opens the viewer, then bounded mixed pages are local-only, a video remains stopped until Play, and close returns to the same valid Atlas card/camera/filter/selection.
- Given media, permission, projection, filter, or selected identity becomes invalid, when an asynchronous result completes, then no old/different media or card content renders and the owner receives an honest recovery state.
- Given the owner enters correction from a selected card, when they return unchanged, then Atlas restores the same valid context; when a save changes identity ambiguously or removes the journey, then it preserves viewport/filter but closes the stale card.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

The compact card uses Living Atlas Fern/Rainforest matte surfaces, Limestone text, Citrus primary action/selection, visible worded status, and a reachable labelled close control. Keep enough map visible for orientation. Large text may make the card internally scrollable but cannot hide close/actions. The gallery is a private overlay over this context, not a detail-route replacement.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal journey-detail journey-correction photo-access-provider reconciliation-repository` -- expected: deterministic preview, current-projection, media, and correction-return contracts pass without React `act` warnings.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint, and Expo Doctor results reported separately.
- `npm run check` -- expected: root framework/evaluation checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- On iOS and Android with local synthetic/private test media, verify map hit testing/overlaps, camera/gesture behavior, safe areas, Back/focus, photo/video availability, muted explicit playback/background pause, and Timeline fallback. Report untested device/platform behavior as unverified.
