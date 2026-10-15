---
id: SPEC-atlas-map-and-list-refinement
companions:
  - visual-requirements.md
  - experience.md
  - acceptance.md
  - brownfield.md
  - ../spec-atlas-map-journey-preview/SPEC.md
  - ../spec-atlas-map-journey-preview/experience.md
  - ../spec-atlas-map-journey-preview/acceptance.md
  - ../../../docs/product/design-system.md
sources: []
---

> **Canonical contract.** This SPEC and its companions define the Atlas map and journey-list refinement. They derive from the decision log. The adopted journey-preview contract remains mandatory; its capability IDs are unchanged.

# Atlas map and journey-list refinement

## Why

The owner wants a lean, minimalist, professional Atlas. The current screen places explanatory panels and large controls ahead of a small map, renders every point in citrus, and presents journeys as dense button text. The map and memories should lead while evidence, privacy and recovery stay understandable and reachable.

## Capabilities

- **CAP-1**
  - **intent:** The owner can orient quickly and reach map or journey content without scrolling through repeated explanations.
  - **success:** A compact header, honest aggregate summary and quiet filters precede a generous map; flat journey rows follow. Coverage and provider details are reachable through one labelled information action.
- **CAP-2**
  - **intent:** The owner can explore a calm, readable map and identify the selected journey immediately.
  - **success:** Geography uses restrained detail and readable labels; ordinary points remain quiet, selected points use citrus and a distinct shape treatment, and overlaps require an explicit choice.
- **CAP-3**
  - **intent:** The owner can scan and select journeys through a concise chronological list.
  - **success:** Rows group by observed year, show owner title or “Private journey,” observed dates and worded status, and keep uncertain dates, location or ordering explicit. Map and list share filter and selection.
- **CAP-4**
  - **intent:** The owner can recognize, browse or correct a selected journey and resume exploration.
  - **success:** The map preview, bounded paged photo/video viewer and correction return meet the adopted preview contract, preserving valid camera, filter, selection and list position; changed or ambiguous identity closes stale content.
- **CAP-5**
  - **intent:** The owner can use Atlas with dense history, unavailable maps, restricted media or accessibility settings.
  - **success:** Equivalent Timeline access, truthful recovery states, scalable text, screen-reader selection and predictable Back/focus behavior remain usable on iOS and Android.

## Constraints

- Retain the official Living Atlas palette and agreed screen composition. Visual simplification cannot remove provenance, uncertainty, safe correction, source access limits or accessible alternatives.
- Keep MapLibre as renderer. Basemap styling, source capability, licensing and attribution are separate concerns. Demo tiles remain development-only; do not treat this spec as authorization to create a provider account, spend money or select a production service.
- Keep originals, thumbnails, source references, precise coordinates, journey content and gallery membership local. Basemap network traffic carries map requests only. Avoid source media reads during journey-list scrolling.
- All selection and media access bind to the committed projection. Owner claims remain separate from observed evidence. Unknown locations are never plotted; geographic labels are map reference labels, never inferred journey destinations.
- Complete the inherited preview gaps alongside this refinement before declaring the combined exploration flow complete. The earlier four-entry viewer and narrow test pass do not meet paged-gallery acceptance.

## Non-goals

- Replacing MapLibre, choosing a paid/production tile service, geocoding, route drawing, trip-duration claims, or reconstruction algorithm changes.
- Sharing/publishing, background media download, redesigning correction internals, or adding replay/export functionality.
- Redesigning other screens or introducing a new project-wide visual identity.

## Success signal

On a populated device, the owner sees the map before long explanations, recognizes selection immediately, scans concise journey rows, opens associated photos/videos or correction, and returns to the same valid exploration context. With unavailable map tiles, the same journeys and actions remain reachable through Timeline.

## Assumptions

- Default to a map occupying roughly half the usable portrait screen with journeys directly below, rather than a full-screen map with a draggable list. Exact responsive dimensions and typography are working design defaults in the visual companion.
- Display the most recent strictly comparable observed periods first; uncertain chronology remains explicitly uncertain and is never resolved by fabricated dates.
