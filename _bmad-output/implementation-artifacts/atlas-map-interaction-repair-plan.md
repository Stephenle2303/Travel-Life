# Atlas map interaction repair plan

Date: 2026-10-18. Status: proposed implementation contract after owner-requested BMAD party diagnosis. Planning only; no interaction fix is claimed by this document.

Execution update: local viewport/touch repair implemented in the active checkout. Five viewport/component tests and the existing Atlas suite pass (27 tests total), along with TypeScript/focused lint and root checks. The image is aspect-fitted; pinch distance and centroid plus buttons update one bounded local viewport. Correction context retains local viewport separately from legacy camera. This first implementation uses native touch/responder events rather than introducing Gesture Handler/Reanimated wiring; frame-rate behavior still needs device profiling. Android deep link was delivered through the verified 8081 Metro instance. Device finger acceptance, clean artwork and accurate geographic overlay registration remain pending; the full plan is not complete.

## Verified problems

`apps/mobile/src/components/atlas-reveal.tsx` currently uses a PanResponder that reads translation only: no pinch-distance, scale or focal-point handling exists. Its `ImageBackground` fills a fixed 430-high viewport with `cover`, cropping the 1024x639 reference on a phone even at minimum scale. Local scale is derived from a MapLibre zoom value and defaults to journey framing. Reset returns to that default rather than a full-world fit. Fixed translation clamps are independent of actual image dimensions. Markers inherit the image scale and use an equirectangular position formula against a stylized curved map. Some visible dots and controls are baked into the source photograph and cannot be selected.

## Required experience

- Open and Fit world show the complete map, centered and aspect-correct, with padding. Empty letterboxed space on tall screens is acceptable. Fit world must work with zero, one or many journeys and after year/search changes.
- Two fingers zoom continuously in both directions around the midpoint between the fingers. The geographic point under that midpoint stays there while scaling, except where boundary clamping is necessary.
- One finger drags the map. Adding or removing a finger during a gesture must not jump the image or trigger a journey selection. Pinch movement may pan concurrently.
- Buttons and pinch operate on the same scale limits and viewport. Minimum is the full-world fit; initial maximum is 4 times that fit, with actual image sharpness checked before delivery. At a limit, buttons expose a disabled state. Reset is renamed Fit world and restores scale 1 with centered translation.
- Small visual dots remain constant screen size (8 ordinary, 12 selected logical units) while each selectable journey has a minimum 48-unit target. Nearby/overlapping targets open a choice rather than obscuring one another. Only real journey overlays are selectable.
- Gestures inside the map own its touch stream; the outer page remains scrollable outside the map. All end, cancel, interruption and navigation paths release any page-scroll lock. Timeline remains reachable.

## Implementation sequence

1. `apps/mobile/src/atlas/viewport.ts` (new): pure measured viewport math. Fit scale = min((viewportWidth - 2*padding)/imageWidth, (viewportHeight - 2*padding)/imageHeight). Center the fitted image. Represent local camera explicitly as versioned scale relative to fit plus pixel translation, independent of MapLibre center/zoom. Derive pan bounds per axis from scaled image extent; center an axis when its image extent is smaller than the viewport. Preserve focal location on zoom using inverse/forward transforms. Define resize behavior by retaining the normalized content point at viewport center and relative zoom; clamp after layout changes.
2. `apps/mobile/src/components/local-atlas-map.tsx` (new): extract the local map from `atlas-reveal.tsx`. Use installed Gesture Handler 2.x composed pan/pinch and Reanimated values, after checking their actual installed API. Establish GestureHandlerRootView in `apps/mobile/src/app/_layout.tsx` if absent. Read focal coordinates after pinch activates; maintain stable gesture baselines across finger-count transitions. Keep per-frame transforms off React state, committing context at gesture completion. Implement buttons through the same math. Coordinate native gestures with the enclosing ScrollView rather than relying only on delayed React scrollEnabled changes.
3. `apps/mobile/src/components/atlas-reveal.tsx`, `src/reveal/types.ts`, `src/atlas/preview-context.ts`: use the explicit local camera contract and actual renderer capability. Old MapLibre camera values must safely reset to full-world fit; do not reinterpret them as pixel offsets. Preserve search/year, preview, media and correction identity guards. Expose Fit world independent of journey availability.
4. Marker rendering: compute overlay positions using the exact fitted image rectangle and the same scale/translation as the base. Render fixed-size targets in viewport space; group by screen-space distance. Do not claim geographic accuracy for the current equirectangular formula over the curved screenshot. Calibrate a real shared projection with independent geographic controls before treating those overlays as correctly registered.
5. Visual asset prerequisite: the current file is a full UI screenshot, including baked dots, routes, search, zoom controls and Tokyo card. Produce the map-only licensed cartographic asset under the existing reference-cartography plan; the screenshot can remain a labelled temporary preview, but its decorative dots cannot count as functional journeys. Do not mask or invent geography behind occluded controls as an accepted geographic source. Preserve the approved appearance while obtaining the clean base.
6. Active delivery: maintain one delivery record and identify which checkout/Metro instance supplies the actual device. Preserve unrelated dirty changes. Mirror the verified repair into the requested worktree with a reviewed patch rather than overwriting the newer active checkout. Do not change renderer defaults in another checkout and assume the device received them.

## Acceptance and evidence

| Case | Required observed result |
| --- | --- |
| Full world | At 390x844 and a tablet viewport, open/Fit world reveals the full image including both edges and Antarctica, without horizontal cropping |
| Pinch | Pinch from 1x to 2x, reverse to 1x, and repeat ten times; no jump, stuck scale or accumulating drift |
| Focal anchor | Away from pan boundaries, a synthetic control point under the pinch midpoint stays within 2 logical units of its expected position |
| Finger transition | Pan, add second finger, pinch, lift one finger, continue pan; no sudden translation or accidental marker press |
| Buttons | + and - change the same scale as pinch; minimum/maximum and Fit world behave consistently |
| Pan bounds | Extreme drags cannot lose the map; undersized axes stay centered and larger axes stay within calculated limits |
| Markers | Small visible dots retain their screen size; 48-unit targets remain usable at every scale; overlap offers each journey |
| Scroll lifecycle | Page scroll works outside map and after cancel, background/resume, preview close and navigation return |
| Context | Correction/media return retains the new camera when valid; old camera and changed layout recover safely |
| Sparse/offline | Full base and Fit world still work without journeys/network; no unauthorized personal marker is shown |

Run pure transform tests and component gesture-event tests that assert actual image transforms, not merely callback invocation. Test touch-count transitions and cancellation. Run focused Atlas/media/correction regressions, mobile typecheck/lint, root npm run check and whitespace validation. Finally exercise actual Android and iOS pinch/pan on installed builds; record platform/build/checkout and evidence separately. Unit tests and screenshots cannot prove multi-touch behavior. Unavailable platform access leaves that gate pending.

## Delivery order

First prove fit/pinch/pan on a map-only technical component with synthetic controls. Then integrate existing journeys and context. Then complete image/marker geographic registration and remove baked nonfunctional UI. Finally verify the installed device experience and get owner acceptance. No additional palette-only or touch-threshold patch closes these criteria.

## Technical references

- Installed dependencies: react-native-gesture-handler ~2.32.0, react-native-reanimated 4.5.1. Match APIs to these versions; current online documentation includes newer APIs.
- Official Gesture Handler gesture composition: https://docs.swmansion.com/react-native-gesture-handler/docs/legacy-gestures/gesture-composition/
- Official pinch behavior/focal-point documentation: https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pinch-gesture/
