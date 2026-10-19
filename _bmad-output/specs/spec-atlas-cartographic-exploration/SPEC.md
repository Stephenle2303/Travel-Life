---
id: SPEC-atlas-cartographic-exploration
companions:
  - visual-recovery-plan.md
  - google-maps-experience-research.md
  - cartographic-design.md
  - interaction-contract.md
  - data-and-rendering.md
  - acceptance-and-delivery.md
  - google-maps-research.md
  - ../../../docs/product/design-system.md
  - ../../../docs/decisions/0013-reference-faithful-atlas-cartography.md
sources: []
---

# Readable Atlas cartography and familiar exploration

> Canonical contract: read this kernel and every companion together. Planning
> dated 2026-10-18; no application implementation or device acceptance is claimed.

> **Revision after owner rejection:** `visual-recovery-plan.md` supersedes
> conflicting earlier stroke, clustering and delivery defaults. Repair projection
> correctness and obtain actual-renderer visual acceptance before claiming the
> new linework is complete. Google research distinguishes documented SDK behavior
> from unobserved consumer-app details.

## Why

The owner accepts the reference Obsidian composition but rejected the implemented
heavy borders. Country/province readability must coexist with fine reference-like
linework, correct projection and geographic names. The opportunity is a useful
private travel atlas: recognizable geography from world view to local journeys,
with familiar Google Maps-inspired exploration rather than an enlarged picture.

## Capabilities

- **CAP-1**
  - **intent:** Users can distinguish countries and first-level administrative regions at useful viewing scales.
  - **success:** Revised boundary hierarchy, screen-space width and independent geographic alignment pass AC-01 through AC-04 and visual AC-25.
- **CAP-2**
  - **intent:** Users can identify visible countries, provinces and localities without clutter.
  - **success:** Progressive localized labels pass AC-05 through AC-09 and AC-26, including first render, tile changes and large text.
- **CAP-3**
  - **intent:** Users can explore naturally and return from their memories without losing map context.
  - **success:** Real Android/iOS gesture, cancellation and context tests pass AC-10 through AC-14 plus measured responsiveness under AC-27.
- **CAP-4**
  - **intent:** Users can discover and select their qualified journeys even in dense destinations.
  - **success:** Visible clustering, coincident-position selection and real preview behavior pass AC-15 through AC-18.
- **CAP-5**
  - **intent:** Users can trust a reproducible, private, offline cartographic layer with declared coverage and vintage.
  - **success:** Current Vietnam administrative data, licensing, provenance, offline behavior and delivery evidence pass AC-19 through AC-24.

## Constraints

- Preserve the approved Obsidian Horizon palette, relief and Winkel Tripel projection; all geometry, labels and journeys share one geographic transform.
- Country/Admin1 borders and geographic labels must not be baked into a zoomed raster. Retain relief tiles only as the background layer.
- Never copy Google's tiles, labels, styling assets or screenshots. This contract authorizes experience research, not a Google SDK/provider migration or paid account.
- Use public cartographic assets locally. Do not transmit private locations, journeys, source IDs or media to providers or telemetry.
- Keep qualified-journey filtering, coarse anchors, corrections, media access, Map/Timeline and year context intact. Cartographic display data must not rewrite reconstruction or historical journey names.
- Gate Vietnam's current Admin1 geometry on verified freshness and redistribution rights; do not present the bundled old 63-region catalog as current.
- Do not declare delivery from document checks, bundle delivery, fixtures or screenshots alone; Android and iOS interaction evidence remains required.

## Non-goals

- Roads, turn-by-turn navigation, commercial POIs, live traffic, global place search, GPS tracking, historical-boundary playback, 3D terrain, tilt or rotation.
- Reintroducing the deferred decorative search pill, mode dock, compass, route arcs or persistent reference-image card.
- Changing trip recognition, coordinate precision, historical facts, provider architecture or sharing behavior.

## Success signal

On an offline device the owner can start with the whole world, identify Vietnam,
zoom to distinguish its current provincial geography and local names, separate
nearby journey dots, open real memories and return to the same view. Borders and
text remain crisp and readable throughout; Android/iOS evidence satisfies G4.

## Assumptions

- Semantic thresholds, visual values and gesture tuning in companions are proposed engineering defaults, not owner-approved pixel values; G1/G2 validate them.
- Prefer a bundled projected vector overlay over a provider change. The concrete renderer/dependency is deliberately gated by the native feasibility spike.
- The default basemap shows current geography with a declared data date, not geography at each trip's historical date.

## Open Questions

- Engineering gate G0: which redistributable geometry source demonstrably represents Vietnam's post-2025 34-unit structure, including islands and adjusted boundaries? The official catalog proves names/codes, not geometry rights.
- Engineering gate G1: which offline overlay/gesture renderer meets readability and performance targets on both platforms? If none does, present the measured trade-off before changing projection/provider or weakening coverage.
