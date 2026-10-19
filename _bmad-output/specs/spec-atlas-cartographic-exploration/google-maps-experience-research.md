---
type: technical
topic: Google Maps exploration patterns for the reference-faithful Atlas
decision: Adopt documented interaction and progressive-detail principles while retaining the approved reference aesthetic and private offline map
source: Primary Google documentation and TopoJSON documentation
status: complete-with-observation-limitations
updated: 2026-10-18
---

# Google Maps experience research

## Recommendation

Use the reference image for visual hierarchy and Google's documented map
interactions for exploration. These are compatible at the behavior level; they
do not imply identical projection, geographic data or renderer. Retain a single
offline Atlas surface and prove it with country-scale gestures before considering
an engine change. No live consumer Google Maps session was available this run.

## Evidence digest

All sources accessed 2026-10-18. Sources are primary documentation, not independent
measurements; confidence is medium for transfer to Travel Life. Google SDK pages
describe supported behavior, not the consumer application's complete internals.

| Ref | Documented finding | Implication for the plan | Publisher / publication |
| --- | --- | --- | --- |
| [1] | Android supports drag, pinch, double-tap zoom in, two-finger tap zoom out and second-tap-hold vertical zoom. | Match these gestures; buttons remain alternatives. | Google, updated 2026-10-16 |
| [2] | Camera framing uses the map's padded area; bounds fitting considers its usable dimensions. Maps uses Mercator. | Exclude preview/control occlusion when fitting; do not map Google zoom values directly to Winkel Tripel scale. | Google, current documentation; publication date not captured |
| [3] | Style rules vary by key zoom; the page documents transition colors for tilted 3D maps and supported vector style transitions, with raster limitations. | Use scale-dependent styling; smooth transitions are our design choice, not a universal Google rendering guarantee. | Google, updated 2026-10-15 |
| [4] | Historical Beta marker/label collision documentation distinguishes required and optional priorities. The page states that this Beta SDK is deprecated and unavailable for new use. | Use only the conceptual priority pattern for our offline layout; do not adopt the deprecated API. | Google, deprecated Beta documentation; publication date not captured |
| [5] | The Android utility library groups markers by proximity and changes clusters with zoom. | Cluster travel anchors to manage density; exact algorithms/limits require our own testing. | Google, current documentation; publication date not captured |
| [6] | TopoJSON mesh can extract interior boundaries; shared edges appear once. | Generate topology-aware boundary linework instead of stroking each polygon perimeter independently. | TopoJSON maintainers, current repository documentation; publication date not captured |
| [7] | iOS offers configurable map gestures and controls. | Verify iOS separately rather than equating Android completion with platform parity. | Google, current documentation; publication date not captured |

## What follows, and what does not

The gesture checklist comes from Android's documented controls [1], with a
separate iOS verification requirement [7]. Clustering is a documented density
management option [5]; our expand-to-fit behavior is an explicit product choice.

Scale-dependent styling and collision priority support a quiet overview that
reveals detail as space becomes available [3][4]. The proposed muted gold palette,
fine strokes, font sizes and layer order are design judgments from the supplied
reference, not values obtained from Google. No claim is made about Google's
inertia constants, production clustering algorithm or frame-rate guarantees.

Shared-edge mesh generation directly addresses redundant polygon outlines [6].
It is a technical option, not proof of source quality: disputed edges, islands,
administrative freshness, simplification and licenses still need separate checks.

The strongest counterpoint to preserving the custom renderer is the engineering
cost of implementing reliable gestures, LOD and labels. Conversely, switching
to a conventional Mercator map engine cannot automatically preserve the supplied
curved world composition [2]. A measured feasibility spike, rather than either
assumption, determines whether an architecture change is justified.

## Unresolved evidence

Consumer-app live observation, physical device latency, one-handed usability,
screen-reader behavior, offline resilience and native-renderer visual fidelity
remain untested. The roadmap contains explicit tests for these; documentation
research does not replace them. No new Vietnam administrative source was verified.

## Source appendix

| Ref | Source | Supports |
| --- | --- | --- |
| [1] | [Google: Android controls and gestures](https://developers.google.com/maps/documentation/android-sdk/controls) | Gesture repertoire |
| [2] | [Google: Camera and view](https://developers.google.com/maps/documentation/android-sdk/views) | Padding, fit bounds and projection |
| [3] | [Google: Style zoom levels](https://developers.google.com/maps/documentation/android-sdk/cloud-customization/zoom-levels) | Progressive styling |
| [4] | [Google: Marker and label collisions](https://developers.google.com/maps/documentation/android-sdk/manage-marker-label-collisions) | Priority semantics and prerequisites |
| [5] | [Google: Marker clustering utility](https://developers.google.com/maps/documentation/android-sdk/utility/marker-clustering) | Clustering as a density-management pattern |
| [6] | [TopoJSON: Mesh](https://github.com/topojson/topojson-client#topojsonmesh) | Shared-edge extraction |
| [7] | [Google: iOS controls](https://developers.google.com/maps/documentation/ios-sdk/controls) | Platform-specific controls and gestures |

Recheck API prerequisites and platform behavior at implementation kickoff and
before any dependency change. Recheck administrative data at bundle creation.
No SDK version compatibility or measured performance claim is made in this report.
