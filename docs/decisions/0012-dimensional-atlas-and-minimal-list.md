# 0012 — Dimensional Atlas and minimal journey list

Date: 2026-10-15 (Asia/Bangkok).
Status: accepted design direction and direct Atlas visual target; development plan prepared, implementation not started by this design update.

## Context

The owner supplied a map with an adjacent trip list as composition reference, requested a more vibrant and professional 3D effect, then clarified that mountains, valleys and terrain realism are unnecessary. The list must be simple, minimal, intuitive, visually clear and uncluttered. The owner later clarified that the supplied world-map UI is the Atlas's direct UI target: its dominant full-bleed map, floating controls, side filter stack, zoom/orientation controls, and focused selected-place card should define the Travel Life map's composition.

## Decision

Implement the supplied world-map UI's visual hierarchy for Atlas, adapted as an original Travel Life interface: the **Obsidian Horizon / Deep Sea Glass** map system, dark cinematic geography, restrained cyan/amber dimensional markers, a full-bleed map, compact floating controls, a side filter stack, zoom/orientation controls, and a layered selected-journey card. Retain the Living Atlas information hierarchy and evidence language. Use flat, quiet journey rows with safe title, observed dates and compact worded state; preserve map/list synchronization and in-place preview. On wide layouts, show the map, restrained journey column, and one selected-journey card together; on compact layouts, stack the same elements without losing reachability.

Do not pursue terrain, buildings, globe mode or decorative routes for this change. Earlier exploratory terrain/globe ideas were not accepted requirements. Translate the reference's search and filter affordances into local-only private journey/place search, Map/Timeline, year and evidence-status controls. Replace public route-planning, generic map-layer modes, visit counts and Save/Plan Trip actions with private evidence-aware selection, media, correction and Replay controls. The authorized Atlas palette, typography, glass treatment, hover/press behavior and reduced-motion limits are recorded in the Living Atlas design system. Recreate no reference artwork, destination media, labels or travel claims.

## Consequences

The [development contract](../../_bmad-output/specs/spec-atlas-dimensional-polish/SPEC.md) defines five work packages and 20 acceptance cases. It follows the prior refinement without rewriting its historical completion record. MapLibre, coarse/opaque data boundaries, uncertainty, local media handling, correction return and accessible Timeline fallback remain required.

Production basemap selection remains unresolved. This direction authorizes no provider purchase, account setup or private data upload. Native API/style feasibility and physical-device visual/gesture evidence are delivery gates.

Revisit if the owner requests terrain/globe capabilities or native feasibility requires a material change to the agreed effect.
