# Cartography approach and integration boundaries

## Recommended candidate, conditional on G1

Generate a styled, projected world base offline from real licensed geographic data, bundle its optimized images with matching projection metadata, and draw local journey overlays through the same transform. Static geography provides relief/lighting/detail without runtime elevation or an external tile service. Borders may be baked at each resolution; labels should use a small curated local layer so they can remain readable at compact/zoomed scales. The G1 proof selects the exact split and records it.

Begin projection calibration with Winkel Tripel (`geoWinkel3`), since the reference explicitly names it. Pin central meridian, rotation, clipping, projection scale/translation, map bounds and output dimensions in one versioned manifest. Derive coastline/border geometry and raster reprojection from that manifest. Raster texture cannot simply be stretched from an equirectangular source into the final world rectangle. Prove resampling/edge transparency and seam registration against vector coastlines.

Use build-time tools for expensive processing. Runtime only needs the approved local image, projection function, small label set and coarse anchors. Evaluate using the same pure projection implementation in both runtimes versus generated lookup metadata with verified error bounds; choose one during G1. Never maintain independent handwritten browser/native geography formulas.

Do not pick a renderer based only on a web screenshot. G1 must demonstrate actual Android and iOS image decoding, overlay registration, gestures, clipping and release asset packaging. If image size/quality cannot meet the proposed budgets, test a small local multiresolution tile pyramid or vector/raster composition. A material renderer change must still meet the same appearance and privacy contract; it does not justify substituting default tiles.

## Researched source candidates

Verified on 2026-10-18; these are candidates, not downloaded/pinned implementation inputs.

| Source | What it supports | Remaining proof |
| --- | --- | --- |
| [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) | Its raster/vector map data is public domain and may be modified and redistributed | Record exact layers, versions, URLs, checksums and any constituent notices |
| [Natural Earth II 1:50m](https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-2/) | Shaded-relief rasters suitable for a styled land base | Blue color grade and coastline alignment; package only optimized derivatives |
| [Natural Earth downloads](https://www.naturalearthdata.com/downloads/) | Geographic vectors and additional raster choices | Select country/coastline resolution and independently verify any bathymetry source; NE-II alone is not proof of the desired ocean shading |
| [D3 geographic projections](https://github.com/d3/d3-geo-projection) | Documents `geoWinkel3` | Pin dependency/license, prove fit to this stylized reference and prove native/runtime or generated-metadata support |
| [D3 projection API](https://d3js.org/d3-geo/projection) | Documents projection transforms, fitting and inversion | Confirm chosen forward/inverse behavior, edge clipping and precision in the installed version |

Natural Earth boundaries are source cartography, not an adjudication of political claims. Record the selected dataset policy and avoid silently combining mismatched border layers. Map labels need not reproduce reference typos. Generated imagery must not invent coastlines or boundaries; source geometry remains authoritative. No image-generation dependency is required by this plan.

## Proposed artifacts and ownership

The following are NEW proposed paths; their existence is not assumed:

- `scripts/atlas-cartography/`: pinned build tooling, source manifest, palette/projection recipe and repeatability check.
- `shared/atlas-cartography/`: generated optimized visual base, projection/label metadata, version/license manifest and shared pure geographic transform.
- App-specific `atlas-world-map` adapters: browser/native image component, input handling and accessibility around the same shared asset and metadata.
- `_bmad-output/implementation-artifacts/atlas-reference-evidence/`: synthetic comparison captures and AC register; local reference/owner evidence remains in ignored storage.

G1 must prove how both Metro projects resolve the shared directory, or choose reproducibly generated app-local copies with a checksum-parity check. Do not introduce an unverified package/workspace layout. Do not commit full unprocessed source raster archives; store their source/version/hash and deterministic retrieval instructions. Verify shipping-asset license and dependency notices before integration.

## Runtime behavior

Default full-world fit is aspect-preserving. Candidate local scale range is 1×–4× with bounded pan; verify detail/readability at G1. Existing deeper native zoom behavior must be inventoried first. If a wider range is needed for the existing journey loop, compare resource/quality costs before fixing the limit. Street-level detail is outside this change.

Project coarse anchors to base-space coordinates, then apply one viewport fit/pan/scale transform to every map layer. Place screen-space hit targets above the transformed coordinates; a marker should not shrink below its target size or become unreachable behind another. Group/cull by viewport without exporting record data. Use independent geographic control fixtures to catch a base/overlay mismatch that a self-consistent but wrong transform test would miss.

Preserve unknown-location Timeline entries, explicit overlap choices, year/search synchronization, in-place existing previews, local authorized media and correction return. Do not redesign the deferred persistent card. Camera restoration needs an adapter/version: old `{center, zoom}` MapLibre state is not interchangeable with image offsets/scale. Keep the existing record-identity guards when changing renderer state.

The accepted world base becomes the Atlas default in release and development. Remove its dependency on the current `__DEV__` demo-style branch and fake/grid geography. MapLibre may stay installed for unrelated uses; do not force a provider/engine migration outside this map. A low-resolution approved local base is the only visual degradation path before explicit map failure/Timeline recovery.

## Brownfield code map

| Current path | Observed issue / required treatment |
| --- | --- |
| `apps/mobile/src/components/atlas-reveal.tsx` | `LocalAtlasCanvas` is a grid with arcs; `NativeMap` uses development tiles; fixed 430-height surface. Replace base/renderer gates and keep record/media guards |
| `apps/mobile/src/atlas/preview-context.ts` and `apps/mobile/src/reveal/types.ts` | Camera/context contract; inventory and version/adapt any renderer state change |
| `apps/mobile/src/components/mobile-screens.tsx` | `EmptyAtlasScreen` is the `/history` consumer; verify the actual installed entry screen |
| `apps/mobile/src/components/ui.tsx` | Generic `Screen` caps width at 640 and centers content. Give Atlas an explicit appropriate layout without changing every other screen |
| `apps/prototype/src/components/map-canvas.tsx` | Fictional shapes and arbitrary anchor formulas; replace cartography and coordinate projection, keep bounded gestures/grouping |
| `apps/prototype/src/components/prototype-screens.tsx` | `/reveal` layout; isolate map-only reference presentation and keep synthetic status explicit |
| `apps/prototype/src/data/synthetic-record.ts` | Fictional stories/anchors cannot silently become real-world claims. Use clearly named public-location test fixtures for geographic verification |
| Atlas and prototype owner-flow tests | Add meaningful projection/state/delivery regressions; replace old fake-geography assumptions |

Known obstacles: `/history` mobile-web failed before mount at Expo SQLite worker bundling; ADB connection/daemon failed in the previous session; Expo Doctor reported patch mismatches. Recheck these states at G0. Keep browser prototype, mobile-web, Android and iOS status separate. Do not clear owner data or recreate databases to unblock visual checks.
