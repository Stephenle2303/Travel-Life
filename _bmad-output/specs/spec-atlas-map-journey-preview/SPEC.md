---
id: SPEC-atlas-map-journey-preview
companions:
  - experience.md
  - acceptance.md
  - brownfield.md
  - ../../../docs/product/design-system.md
  - ../../../docs/decisions/0006-photo-trip-assignment.md
sources: []
---

> **Canonical contract.** This SPEC and its companions define the map journey preview, associated media viewer, and correction entry. The companion files carry the interaction, data, and verification details.

# Atlas map journey preview

## Why

The owner can see reconstructed journeys on a map, but tapping a point currently offers little context and the media path pulls them away from map exploration. A selected point should reveal a recognizable private moment and let the owner choose whether to browse its associated photos and videos or correct the journey, then return to the same map position.

## Capabilities

- **CAP-1**
  - **intent:** The owner can select one journey point and inspect it while remaining on the Atlas map.
  - **success:** A compact card appears above the map for the selected journey; selecting a point does not scroll to Timeline or navigate to Journey detail.
- **CAP-2**
  - **intent:** The owner can recognize the selected journey through trustworthy time, title, status, and media context.
  - **success:** The card distinguishes owner title and date claims from observed evidence, shows one accessible associated local photo or a video indicator when present, and states clearly when no preview is available.
- **CAP-3**
  - **intent:** The owner can dismiss a preview or inspect another point without losing their map exploration.
  - **success:** The visible close control and an empty-map tap dismiss the card; selecting another point replaces it; panning and zooming retain the viewport and selected context.
- **CAP-4**
  - **intent:** The owner can browse the selected journey's associated photos and videos and resume map exploration.
  - **success:** “See photos and videos” opens a bounded local media viewer; video playback requires a deliberate tap, and closing the viewer returns to the same year filter, viewport, selected point, and card unless that journey has become unavailable.
- **CAP-5**
  - **intent:** The owner can use the flow when points overlap, media changes availability, or the map is unavailable.
  - **success:** Overlaps require an explicit journey choice, unavailable/stale media never appears under a different journey, and the accessible Timeline retains a path to the same private journey content.
- **CAP-6**
  - **intent:** The owner can enter journey correction from the selected map preview and return to exploration.
  - **success:** A secondary “Review or correct journey” action opens the existing private correction flow; returning restores valid map context, and a changed or removed journey cannot reopen stale content.

## Constraints

- Map anchors are coarse navigation aids, not destination names or proof of owner presence. Do not derive a claimed city from a point. Use an effective owner title if present; otherwise use “Private journey.”
- Observed media span is not trip duration. Show date precision and distinguish an owner date claim from observed dates. Media-to-journey association never becomes visit support merely because a photo or video appears in the card or viewer.
- All media resolution and viewer membership remain local to the device and current accessible source scope. Never send originals, thumbnails, source identifiers, journey IDs, or precise coordinates to a map tile service or analytics. Videos start only on explicit user action and stop when the viewer closes or the app backgrounds.
- Use the official Living Atlas visual and accessibility system. Map interaction must have an equivalent non-map path; large text, screen readers, reduced motion, offline use, and map failure must remain usable.
- Selection, media viewer, and correction return must be bound to the currently committed local projection. Disconnect, permission loss, rebuild, filter change, or stale async results cannot reveal a prior or different journey's media.
- The current development tile style is not licensed as a production map provider. This feature does not make the demo tile service a launch dependency.

## Non-goals

- Automatic reverse geocoding, inferred destination names, route lines, or departure/return duration claims.
- Auto-publishing, sharing, uploading, copying source media into the app, or using fictional demo images as private memories.
- Replacing the existing Journey detail and correction flow; the preview is a quick exploration surface.

## Success signal

On a real device with a populated private Atlas, the owner taps a point, reads its date context and sees an accessible associated preview or an honest empty state. They can open photos and videos, deliberately play a video, or enter correction; closing either flow returns to the same map context when the selected journey remains valid. The same journey remains reachable through Timeline when the map cannot load.
