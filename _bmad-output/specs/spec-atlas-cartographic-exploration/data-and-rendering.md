# Public data and rendering architecture

## Verified brownfield findings, 2026-10-18

- `scripts/build-atlas-cartography.py`: Natural Earth relief plus Admin0 borders
  baked at width 1; seven geographic labels, not a world/country label system.
- `scripts/build-atlas-tiles.py`: 4K/8K/16K geographic pyramids, no dynamic names
  or Admin1. Current 840 assets total 3,666,258 bytes. Raising image resolution
  cannot supply missing data or collision-aware text.
- `apps/mobile/src/components/local-atlas-map.tsx`: local raster/tile renderer,
  responder-based pan/pinch, fixed-size dots, +/− and fit controls.
- `apps/mobile/src/atlas/visible-tiles.ts`: density-based LOD and maximum 48 active
  tiles. This decoded raster budget is not the complete future overlay budget.
- `apps/mobile/src/atlas/map-markers.ts`: nearby selection is tap-time screen
  distance lookup, not rendered cluster layout.
- `apps/mobile/src/atlas/viewport.ts` and `world-projection.ts`: scale 1–64 and
  normalized Winkel Tripel; keep a single transform across every layer.
- `natural-earth-destinations-5.1.1.json`: 258 countries, 4,589 regions, including
  63 Vietnam regions. It is reconstruction input, not approved current Admin1 UI.

## Data gate G0

The official [Vietnam catalog](https://xaydungchinhsach.chinhphu.vn/bang-danh-muc-va-ma-so-cua-34-tinh-thanh-moi-cac-don-vi-hanh-chinh-cap-xa-moi-11925070418263625.htm)
records 34 provincial units effective 2025-07-01. Pin a verified current catalog
at build time and detect later changes; 34 is the checked planning baseline, not
an eternal constant. A names/codes catalog is not a licensed boundary geometry.

[Natural Earth Admin1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/)
5.1.1 is a candidate global starting layer, not proof of current Vietnam borders.
[geoBoundaries](https://www.geoboundaries.org/) is a candidate alternative with
CC BY 4.0 attribution requirements; its Vietnam epoch/geometry has NOT been
verified in this work. Do not silently select it as current. Public access to a
government file does not itself establish redistribution rights.

For each released country coverage bundle, record source URL, license text,
download/build date, administrative effective date, version/hash, attribution,
feature IDs/codes, localization fields, source political-boundary policy and
known omissions. Audit both names and geometry. For Vietnam require 34 expected
Admin1 codes, merge/adjustment crosswalk, islands, non-self-intersection, gaps and
overlaps against the chosen source's tolerances. A union of old provinces is only
a candidate: boundary adjustments cannot be assumed away. Include HCMC and Hanoi
public fixtures; locality names can remain meaningful even after Admin1 mergers.

Global coverage audit must enumerate included/missing Admin1 and locality data by
country. Sparse or unavailable regions get an honest coverage entry and country
context, not invented names. Vietnam freshness is mandatory before owner release.
Current basemap labels and historical journey labels are separate display domains;
never migrate reconstruction facts/corrections to make the map look consistent.
No historical administrative time slider is included. Expose vintage, coverage
and attribution through map About/help without decorative new controls.

## Layered implementation proposal, subject to G1

1. Keep unlabelled local shaded-relief raster pyramid.
2. Draw deduplicated projected Admin0/Admin1 topology as clipped, scale-appropriate
   vector paths with screen-space strokes.
3. Lay out public geographic text in screen space using measured fonts and stable
   projected anchors. Label selection is independent of raster tile LOD.
4. Render qualified journey clusters/dots, selection and existing preview controls.

Preferred spike: bundled projected vector paths with a native-capable overlay
renderer, public feature chunks and spatial culling. Evaluate existing installed
capabilities before adding dependencies. SVG/native drawing and a UI-thread gesture
stack are candidates, not already selected or installed features. One spike must
prove line widths, Unicode labels, seam alignment, clipping and gesture frame-time
on Android/iOS. Do not add an online provider as an implicit fallback. If the
existing renderer cannot meet the contract, stop at G1 with measured alternatives.

Generate reproducible public-only assets with pinned inputs, hashes, topology
validation, simplification levels, shared seam tests and deterministic IDs. Do
not duplicate the large reconstruction catalog merely to expose map names.
Precompute anchors/importance/spatial indexes; bound visible work rather than
rendering every world polygon/name on every touch event. Cancel stale layout
results by camera/locale/filter generation. Tiles, vectors, labels and points
must be committed as compatible versions; a failed tile leaves unlabelled relief
beneath live overlays, not an obsolete baked-label fallback.

## Proposed budgets and failure contract

G1 must measure a 1,000-synthetic-journey scene on the available Android phone and
a named representative iOS device: p95 gesture frame <= 32ms, p95 idle label layout
<= 80ms, incremental bundled map assets <= 12MiB, combined map working-set target
<= 64MiB. These are acceptance targets, NOT results. Account for decoded tile,
GPU/CPU copies, geometry, labels and caches; active tile count alone proves none.
Tune the existing 48-tile cap down if necessary. If target budgets cannot coexist
with required readability, report the measured trade-off before weakening them.

Offline cold start must show locally bundled map/names/journeys without requests.
Recover from individual tile/optional label failures without hiding journeys;
if a required layer is unavailable, state degraded coverage and retain Timeline.
No hidden fallback to stale Vietnam administrative boundaries. Versioned asset
rollback must roll the compatible layer set together and keep private data intact.
