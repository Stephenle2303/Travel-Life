---
title: 'Keep the Atlas map visible during local reconciliation'
type: 'bugfix'
created: '2026-10-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** During local reconciliation, Atlas hides its valid prior map projection even when durable journeys with coarse anchors are available. The owner sees a preview card and list but no map, which makes Atlas appear broken.

**Approach:** Keep Map, Timeline, year filtering, and the selected preview usable from the prior durable projection while reconciliation is processing. Retain the warning that results are not final and keep Replay unavailable until reconciliation completes.

</frozen-after-approval>

## Implementation Notes

- The supplied device photo matched the `processing` message from the durable reveal projection. `AtlasReveal` only mounted its map and controls for `ready`, while still rendering a selected preview through the no-map fallback. Allow the existing durable redacted projection to remain explorable for `processing`; Replay remains unavailable because `projectReveal` already supplies its processing-specific reason.
- Updated `apps/mobile/src/components/atlas-reveal.tsx` and its focused synthetic regression. No schema, private-data, provider, or map-service configuration changed.
- The native composition review found that the Android default `GLSurfaceView` is unsuitable for a scrolling screen with React overlays. The map now requests MapLibre's texture-backed view, stops source presses from clearing a just-selected card, and reports a failed style load through the existing Timeline fallback.
- Verification: focused Atlas tests passed 18 cases; the full mobile check passed 29 suites / 240 tests; typecheck, lint, root checks and `git diff --check` passed. A rebuilt Android development client loaded the texture-backed native MapLibre manager and Atlas without filtered runtime errors. Owner visual confirmation remains required for private screen content.

## Review Triage Log

- `blind-hunter / release style` — **false:** release builds deliberately fail closed without a production tile/style provider; this device fix targets the approved development client and does not select an external provider.
- `blind-hunter / source press bubbling` — **medium, patched:** MapLibre source presses can bubble to the map-level empty press. The source now stops propagation, with an assertion in the overlap-selection test.
- `blind-hunter / style failure fallback` — **medium, patched:** a failed native style load could leave a blank map. It now reports unavailable and exposes the existing Timeline fallback, with a regression.
- `blind-hunter / Android surface composition` — **medium, patched:** the default Android surface does not reliably compose with the scroll container and React card. The map now requests the documented texture-backed view; physical composition remains a device check.
- `blind-hunter / map-source test` — **medium, patched:** the source-press test now verifies that propagation is stopped before the journey choice is shown.
- `blind-hunter / full processing interaction matrix` — **low, rejected:** the existing local component state preserves map/list selection through a processing-to-ready rerender; a full native gesture matrix remains physical-device validation rather than mocked coverage.
- `blind-hunter / oneshot acceptance section` — **false:** the active BMAD oneshot route intentionally contains only intent and implementation notes; its focused regression and device rerun are recorded above.
