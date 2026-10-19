# Cartographic visual contract

## Progressive detail

Use `projectedWorldWidth = fit.width * viewport.scale` in logical screen units.
Do not use tile resolution, device pixel ratio or Google's Mercator zoom numbers
as semantic zoom. Retain the existing full-world minimum and 64x ceiling.

| Band | Projected world width | Boundaries | Eligible names | Maximum labels |
| --- | --- | --- | --- | --- |
| World | < 1,000 | Country | Countries, sparse ocean names | 12 |
| Regional | 1,000 to < 3,000 | Country; Admin1 only for selected region | Countries, selected region, major cities | 24 |
| Country | 3,000 to < 9,000 | Country and Admin1 | Relevant countries, provinces, major cities | 40 |
| Local | >= 9,000 | Country and Admin1 | Province context and more localities | 60 |

Apply 10% hysteresis at band boundaries. Budgets are ceilings, not promises that
every region can be named simultaneously. Culled names become eligible as the
viewport moves/zooms; do not shrink fonts to fit them all. At country/local scale,
prioritize the visible province/locality context over distant country names.
Admin1 means the source's first-order region, not universally a province; a city
locality point is distinct from a centrally governed city administrative area.

## Boundaries

- Country stroke: gold `#E9C46A`, 1.5 logical units in world/regional view,
  1.75 in country view, 2 in local view. Dark casing `#081527`, outer stroke
  width = colored stroke + 2. Rounded joins; deduplicate shared edges.
- Admin1: subdued pale slate-gold, starting candidate `#B8C9CF`, 1 unit at
  country scale and 1.25 local. Use lower visual salience than country borders,
  not reduced contrast below acceptance. Selected region uses cyan 2.5 units.
- These are screen-space widths, never multiplied by camera scale. Relief,
  linework and labels must not change position during raster tile transitions.
- Essential boundary edges must achieve at least 3:1 against their immediate
  backing in the public validation crops. Adjust casing/backing before making
  the entire map brighter. Do not claim the proposed colors already pass.
- Simplify at multiple levels with shared topology; clip visible geometry.
  Preserve coastlines, holes, islands and disputed-boundary source semantics.
  Do not invent an authoritative political position or fill missing divisions.

## Labels

| Level | Default type | Appearance |
| --- | --- | --- |
| Country | 14–16 logical units, semibold | Warm ivory `#E9DDB2`; modest tracking |
| Admin1 | 13–14, medium | `#DDE7EF`, approved proper names with diacritics |
| Locality | 12–14, regular | `#B8C9D4`, distinct from region labels |

All text uses system scaling, a dark halo/backing and minimum 4.5:1 text contrast
against that backing. At 200% text size reduce label density, not text size.
Do not force uppercase or wide tracking onto small Vietnamese/locality names.
Use locale-approved names (`vi` where available), then documented English/source
fallback; no model translation or fabricated local name. Record name provenance.

Country/Admin1 anchors must lie inside a suitable visible polygon component;
centroids outside concave land or inside holes are invalid. Locality anchors come
from public settlement points. Keep feature IDs stable across simplification.

Label collision priority: journey/cluster touch exclusion areas, selected region
label, then band-relevant country/Admin1/locality rank, population/importance and
stable feature ID. Keep at least 6 logical units between label rectangles. Reserve
space for controls and visible preview; hide lower-priority candidates rather
than covering a dot. Selected labels may displace optional labels, never controls.
Use measured text bounds, not character-count estimates. During gestures retain
stable candidate IDs and move their anchors with the camera; relayout at semantic
thresholds or idle, without freezing labels in screen space or visible jumping.

## Background transition

Retain the approved navy/teal shaded relief. Remove existing baked text and baked
borders from base and every raster LOD only when overlay parity passes; switch the
new raster and overlays atomically. No doubled borders, ghost names or appearance
of old boundaries after tile decode failure. Keep an unlabelled low-res relief
fallback and explicit Timeline recovery if the map cannot render.
