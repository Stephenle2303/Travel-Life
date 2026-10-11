---
name: Travel Life Living Atlas map and navigation
description: Proposed vibrant geographic atlas and consistent prototype navigation
status: historical-proposal
updated: 2026-10-08
scope: Isolated synthetic prototype; design documentation only
sources:
  - .memlog.md
  - imports/README.md
  - ../../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
colors:
  rainforest: '#102C26'
  fern: '#21483B'
  limestone: '#F3EEDD'
  sage: '#B4C6B5'
  citrus: '#D8EF69'
  clay: '#D98763'
  map-water: '#207D82'
  map-shallows: '#5FB9AD'
  map-land: '#43856B'
  map-highlands: '#6D9A78'
typography:
  title:
    fontFamily: inherit-current-strong-sans
    fontSize: 28px
    fontWeight: '800'
  body:
    fontSize: 16px
    lineHeight: '1.5'
  label:
    fontSize: 14px
    fontWeight: '700'
  micro:
    fontSize: 12px
rounded:
  panel: 16px
  control: 10px
  marker: 999px
spacing:
  compact: 8px
  standard: 16px
  generous: 24px
components:
  atlas:
    background: '{colors.map-water}'
  panel:
    background: '{colors.fern}'
    foreground: '{colors.limestone}'
    radius: '{rounded.panel}'
  primary-action:
    background: '{colors.citrus}'
    foreground: '{colors.rainforest}'
    radius: '{rounded.control}'
  selected-marker:
    ring: '{colors.citrus}'
---

## Brand & Style

**Current authority (2026-10-09):** The owner adopted the implemented Living
Atlas prototype direction as the project-wide design system in
[decision 0010](../../../../docs/decisions/0010-living-atlas-design-system.md).
Use the [official design system](../../../../docs/product/design-system.md) for
new work. This document remains the 2026-10-08 map/navigation proposal;
particularly, its `map-*` colors were never implemented or accepted as tokens.


Precise personal atlas, richly geographic rather than decorative. Retain the user's Living Atlas palette and the existing prototype's visual identity; the map becomes the main feature, not a diagram inside a card.

Status: proposal only. The four `map-*` color tokens are **ASSUMPTIONS for approval**, not accepted brand changes. No provider, dependency, font installation, or production architecture is selected here.

Use photography in selected memory sheets for tropical variety and personal energy. Photos and coordinates remain labeled synthetic; visual richness must not suggest verified owner presence.

## Colors

Canvas `{colors.rainforest}`; architectural panels `{colors.fern}`; primary type `{colors.limestone}`; supporting type `{colors.sage}`. Citrus `{colors.citrus}` is reserved for selected controls, primary actions, and focus.

Proposed geography: `{colors.map-water}` sea, `{colors.map-shallows}` coastal variation, `{colors.map-land}` land, `{colors.map-highlands}` terrain. Avoid a flat dark silhouette; readable coastlines and regional labels provide orientation. Terrain detail increases only at useful zoom levels.

Clay `{colors.clay}` can support an uncertainty badge, but inferred/confirmed always include text and distinct icons. Unselected points remain visible without competing with selected citrus.

Contrast targets: WCAG AA text and 3:1 essential controls/focus boundaries. These targets are **not measured results**; test proposed map labels and overlays against every underlying map color before implementation acceptance.

## Typography

Inherit the existing strong sans stack; no new font dependency. `{typography.title.fontSize}` headings, `{typography.body.fontSize}` reading copy, `{typography.label.fontSize}` controls. `{typography.micro.fontSize}` only for nonessential short metadata, never primary controls or essential evidence explanations.

Keep geographic labels short and quiet; selected place and year are stronger. Support 200% text enlargement by allowing wrapping and panel growth, not clipped labels or fixed text boxes.

## Layout & Spacing

Desktop: dominant map beside an optional 320–360px journey panel; persistent compact navigation above. Map occupies the remaining width and approximately 65–75% of the available content height, adapting to short windows.

Mobile: header, compact Map/Timeline switch and year dock, then map using remaining safe viewport space. Default selected preview is a compact bottom sheet; expansion must not hide all geography or trap controls beneath browser chrome.

At short heights or enlarged text, allow page scrolling and replace the floating preview with an in-flow card. Do not enforce a viewport minimum that makes navigation inaccessible.

Use `{spacing.standard}` panel padding, `{spacing.compact}` control gaps and `{spacing.generous}` major section spacing. Target 48px touch areas even where marker artwork is smaller.

## Elevation & Depth

Matte fills and crisp inset borders establish layers. The selected sheet can use one restrained shadow; no glossy gradients, constant glow, exaggerated floating panels, or decorative knobs.

Static grain and faint contours belong on large empty canvas areas only. Keep texture away from map labels, small text, imagery, and attribution. Geographic terrain is informative, not a nature ornament.

## Shapes

Panels use `{rounded.panel}`, controls `{rounded.control}`, map markers `{rounded.marker}`. Selected markers gain a citrus ring and text label, not a pulsing halo. Cluster circles show a count; uncertainty badges pair an icon with a word.

## Components

| Component | Proposed visual contract |
|---|---|
| Geographic map | Recognizable coastlines, restrained terrain, bounded initial world view; no repeated world copies. |
| Marker / cluster | Circular location mark; selected ring; labeled status; cluster count visually distinct from visit count. |
| Map control dock | Compact zoom +/− and “Fit records” controls, consistent matte buttons; no GPS/current-location symbol. |
| Map/Timeline switch | Two equal options; citrus selected segment; Timeline remains an Atlas view, not a duplicate global tab. |
| Year scrubber | Snapping years with an explicit All option and visible selected label; large targets and overflow affordance. |
| Journey preview sheet | Lush crop, corrected title, year, uncertainty label, “Open journey”; expandable with clear collapse affordance. |
| Journey detail | Existing evidence, correction, memory and selected-highlight controls; same panel, text and button treatment. |
| Navigation header | Travel Life/Home and contextual Back; concise page title; safe-area spacing. |
| Primary navigation | Atlas / Replay / Highlight after simulated import; icon plus text, active citrus; same destinations on desktop. |
| State / disclosure panel | Plain-language synthetic-data, map-service, empty/error and coverage messages; retry and Timeline alternatives. |
| Replay / Highlight | Existing controls restyled consistently; no new export, publish, access, or sharing capability implied. |

## Do's and Don'ts

- Do preserve IDs, years, corrections, privacy labels and owner-selected sharing semantics.
- Do label invented demo coordinates and illustrative photos; distinguish unknown coordinates from empty history.
- Do make the map vibrant through geography and photos while keeping controls precise.
- Don't draw routes, infer complete coverage, request device GPS, or claim a real journey from demo anchors.
- Don't copy the reference's pale palette, repeated worlds, unrelated header or hidden navigation.
- Don't enable map-service traffic silently: resolve disclosure and local fallback before any implementation.

Sources: [canonical decisions](.memlog.md), [reference register](imports/README.md), [behavior spine](EXPERIENCE.md), [current map](../../../../apps/prototype/src/components/map-canvas.tsx), [current screens](../../../../apps/prototype/src/components/prototype-screens.tsx), [MLP acceptance boundary](../../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md).
