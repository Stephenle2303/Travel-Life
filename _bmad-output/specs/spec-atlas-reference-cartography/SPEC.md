---
id: SPEC-atlas-reference-cartography
companions:
  - visual-acceptance.md
  - cartography-architecture.md
  - development-plan.md
  - ../../../docs/product/design-system.md
  - ../../../docs/decisions/0013-reference-faithful-atlas-cartography.md
sources: []
---

# Reference-faithful Obsidian Horizon world map

Date: 2026-10-18 (Asia/Bangkok).
State: planning complete; ready for baseline and feasibility work after implementation is delegated. Renderer selection and visual acceptance remain delivery gates, not completed evidence.

## Why

The owner wants the map in `World Map.jpg` reproduced faithfully in Travel Life. The current recolored fictional geography and grid fallback fail that expectation. Deliver the reference's recognizable world geometry, textured blue land, deep shaded oceans, gold borders, coastal light, restrained labels and curved silhouette. The attached image is the visual authority; passing behavior tests alone cannot establish completion.

## Capabilities

- **CAP-1**
  - **intent:** The owner sees the supplied map's geographic composition and visual finish.
  - **success:** AC-V01–V05 pass and the owner accepts the actual map-only comparison. Abstract land shapes, a palette substitution or generic development tiles fail.
- **CAP-2**
  - **intent:** The owner can actually reach the accepted map in the browser prototype and the Android/iOS app.
  - **success:** AC-V06 and AC-D01–D03 demonstrate the same approved visual base at `/reveal` and `/history`, including offline, release, sparse and unavailable-native-map states. Delivery proof identifies each surface and build.
- **CAP-3**
  - **intent:** The owner can continue exploring their private journeys without geographic drift or losing context.
  - **success:** AC-G01–G04 and AC-S01–S04 preserve coarse-anchor placement, selection, filters, overlap choice, Timeline, media/correction return and access revocation under the accepted projection.
- **CAP-4**
  - **intent:** The team can reproduce, measure and review the delivered cartography.
  - **success:** AC-P01–P03 and G0–G4 produce a pinned asset manifest, repeatable build, actual visual comparisons, bounded resource measurements and platform-specific acceptance records. Missing evidence stays pending.

## Constraints

- All companions are required. Decision 0013 supersedes conflicting earlier Atlas scope and placeholder-completion assumptions.
- This request authorizes planning only. No app code, asset generation, dependency install, device mutation or deployment is part of this spec-writing turn.
- Recreate the visual from licensed geographic sources. Keep the supplied screenshot local as a comparison reference; never ship its controls, Tokyo photo, personal-looking points or travel totals as the map.
- Use one geographic projection and viewport transform for raster, borders, labels and journey points. A handwritten rectangular longitude/latitude formula cannot overlay a curved projected base.
- Flat baked land/ocean relief texture is permitted to achieve fidelity. Runtime terrain meshes, elevation APIs and globe mode remain excluded.
- Preserve private/local data boundaries and existing exploration paths. No precise personal coordinates, titles, media or source IDs enter external asset generation, map requests or telemetry.
- Basemap geography is available without personal evidence. Personal markers require the current authorized redacted record; unknown coordinates remain list-only.
- No new paid provider, account, credential or production network map dependency. Retain unrelated worktree changes and owner data.

## Non-goals

- New top search pill, utility icons, full left mode dock, compass/zoom slider, route arcs and polished persistent destination card; these are explicitly deferred.
- Removing existing functional search, selection, preview or recovery actions while deferring their redesign.
- Street-level cartography, a new product navigation system, reconstruction changes, migrations, sharing/replay implementation or photo processing.
- Declaring a prototype screenshot to be proof of mobile delivery or declaring an image-similarity score to be owner acceptance.

## Success signal

The owner compares the actual map-only implementation with the reference at equal dimensions and accepts all six visual categories. The same accepted world base then appears in the browser prototype and installed Android/iOS app, offline and in release conditions, while existing journey/media/correction exploration still works.

## Assumptions

- Phone reset fits the whole world without distortion; bounded local pan/zoom exposes detail. The proposed 1×–4× range and resource budgets in the companions must be proven at G1 before integration.
- Source selection and renderer choice are engineering decisions within these constraints. A material fidelity, platform or interaction compromise returns to the owner with a concrete comparison before proceeding.

## Open Questions

- None needed to write this plan. Exact source/projection parameters, renderer packaging and performance are explicit G1 engineering investigations; map visual approval is a G2 owner decision supported by a working comparison.
