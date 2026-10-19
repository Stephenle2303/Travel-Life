---
id: SPEC-atlas-dimensional-polish
companions:
  - development-plan.md
  - acceptance.md
  - ../../../docs/product/design-system.md
sources:
  - owner-supplied world-map UI reference image (2026-10-16)
---

# Dimensional Atlas and minimal journey list

Status: development plan; application implementation not started by this task.
Date: 2026-10-15. Derived from this folder's decision log and the owner's design discussion.

## Why

The owner wants the Atlas to feel vibrant, professional, lively and attractive through a subtle 3D visual effect, with a simple, minimal, intuitive journey list: trực quan và không làm rối. Depth comes from perspective, color, markers, layered cards and responsive motion. Mountains, valleys and terrain realism are unnecessary. This is a follow-up to the existing map/list refinement, not evidence that its outstanding device checks passed.

## Capabilities

- **CAP-1**
  - **intent:** The owner can explore a visually rich, dimensional map while recognizing places and selection easily.
  - **success:** The map meets D1-D4: rich readable geography, restrained marker depth, one selected emphasis and optional modest perspective; no terrain, decorative routes or continuous effects.
- **CAP-2**
  - **intent:** The owner can scan and select journeys without visual clutter.
  - **success:** D5-D8 demonstrate flat year-grouped rows with safe title, observed period and compact worded state; one tap selects the matching preview; no per-row action toolbar or scrolling media reads.
- **CAP-3**
  - **intent:** The owner can move between map, list, media and correction without losing valid exploration context.
  - **success:** D9-D13 demonstrate shared selection, valid camera and list restoration, explicit overlap choice, interruption of motion and rejection of stale or ambiguous content.
- **CAP-4**
  - **intent:** The owner can explore on small or large screens, with accessibility settings, dense history or map failure.
  - **success:** D14-D18 demonstrate equivalent list access, readable large text, accessible controls, bounded work and honest provider/release behavior on iOS and Android.

## Reference composition refinement

The owner supplied a world-map interface reference on 2026-10-16 and clarified
that it is the direct UI target for Atlas. Recreate its dominant full-map dark
world canvas, upper search/navigation treatment, compact floating map controls,
side filter stack, zoom/orientation controls, and a single focused selected-place
card as original Travel Life components. Preserve the existing private Atlas
contract: local-only journey/place search; Map/Timeline, year and evidence-status
filters; owner title separated from observed period; authorized local media; and
open-media/review-correct actions. Do not reproduce the reference's artwork,
destination media, labels or claims, and do not add public itinerary planning,
routes, generic map modes or unqualified travel totals.

Its authorized Atlas-only design system is **Obsidian Horizon / Deep Sea Glass**:
Deep Navy Void `#0B132B`, Midnight Blue `#1C2541` → `#0B132B`, 75%-opaque
Deep Sea Glass `#131B31`, Luminous Blue `#1F3159`, Cyber Cyan
`#4EA8DE` / `#00B4D8`, Sunset Amber `#F3722C` / `#F8961E`, Cartography Gold
`#E9C46A`, and Secondary text `#8D99AE`. Use the exact design-system rules for
glass, typography, active states and reduced motion. Faint current contours are
decorative geographic context only; journey markers must never be joined into a
route or pulse as an assertion of owner movement.

## Constraints

- Preserve Living Atlas's core palette and matte surfaces. The approved extension is dimensional Atlas styling; exact geographic colors and motion values in the plan are working defaults to validate visually.
- Retain MapLibre and existing source/privacy boundaries. Production provider selection, credentials, billing and deployment are not authorized by this plan. Development styling cannot silently enable demo tiles in release.
- Keep coarse anchors and opaque feature IDs at the map boundary; private titles, dates, media URIs and source identifiers stay local and out of map payloads/telemetry.
- Unknown locations remain list-only. Observed dates govern grouping; owner claims never silently replace observed facts. No invented locations, travel paths, intermediate years or durations.
- Preserve selected-only local media access, explicit video playback, lifecycle invalidation, committed-projection guards and correction identity validation. Visual simplification cannot remove these behaviors.
- Preserve existing dirty-worktree changes. This turn writes planning and decision documents only.

## Non-goals

- Terrain meshes, mountains/valleys, satellite imagery, buildings, globe mode, route arcs or animated travel lines.
- A new map engine/provider, browser map implementation, row photo loading, draggable bottom-sheet framework or a new navigation system. Local-only Atlas search and the specified map controls are in scope.
- Reconstruction changes, database migrations, new sharing/replay capability or correction-engine redesign.

## Success signal

With synthetic populated history, the owner can immediately distinguish the selected map point and row, scan the list, open and dismiss a preview, and return from media/correction without losing valid context. Device captures show a vibrant dimensional map beside or above a quiet list; accessibility and fallback scenarios remain usable. Automated passes alone do not establish visual acceptance.

## Assumptions

- Native mobile is first delivery scope. Wide native layouts use the reference's side-by-side composition when space permits; the current web Timeline fallback remains intact.
- Rows have no thumbnails by default. This prioritizes the owner's minimal-list request and retains bounded selected-only media access; imagery belongs in the selected preview.
- Modest perspective is optional, with a visible flat/depth control. Failure to support pitch must be reported; layering alone is not evidence that perspective acceptance passed.

## Open Questions

- Which production basemap service/style should eventually be used? This pre-existing release dependency does not block local design/implementation investigation. Account creation or paid service selection needs separate direction.
- Exact geographic colors and depth angle are implementation candidates, to be settled through synthetic visual comparison rather than treated as already approved values.
