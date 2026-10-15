# Visual requirements

These are implementation defaults within the accepted Living Atlas system. Native units below mean density-independent layout units, not physical pixels. Adapt for safe areas and text scaling while retaining hierarchy.

## Screen composition

| Area | Required presentation |
| --- | --- |
| Header | One “Your Atlas” heading, 26–30 units at default text size; private-state cue and a labelled “About your Atlas” information control. Avoid stacking “Private Atlas” eyebrow and another oversized Atlas title. |
| Summary | One visually compact group of journey/place/supported-country totals when available, with an “Inferred record” cue. Wrap naturally. Never replace missing totals with zero or imply lifetime completeness. |
| Controls | One compact Map/Timeline segmented control and one quiet horizontal year strip. Selected year may use a subtle citrus tint/underline; avoid multiple solid citrus buttons. All controls retain at least 48-unit touch targets. |
| Map | Primary visual surface in Map mode, directly after controls. Default portrait height targets 45–55% of usable screen height, clamped approximately to 300–480 units where space permits. At 390 × 844 with normal text, header, controls, meaningful map geography and the journey section heading appear before scrolling. Small screens/large text may scroll; never shrink type to meet this target. |
| Journeys | A section heading with visible filtered count, quiet year groups and flat rows on the main canvas. No large enclosing panel and no independently scrolling 320-unit list nested inside the page. |
| Footer/navigation | Keep existing Atlas destinations reachable. Unavailable Replay is explanatory secondary content, never the most prominent CTA. Settings, Trust and debug/provider implementation details must not visually dominate exploration. |

Use one coordinated page scroll with a virtualized journey region where required. The map retains its own pan/pinch gesture handling. Do not wrap a large virtualized list in a second same-direction scroll container.

## Palette and hierarchy

- Canvas: Rainforest `#102C26`; card: matte Fern `#21483B`; primary text: Limestone `#F3EEDD`; secondary text and separators: Sage `#B4C6B5` with contrast checked at the actual opacity.
- Citrus `#D8EF69` identifies the selected map point and primary card action. Ordinary rows and ordinary map points do not use solid citrus backgrounds. Clay `#D98763` may identify review attention with accompanying text.
- Default body 15–16 units, secondary metadata 13–14, journey title 16–18 with medium/semibold weight. Typography scales with the OS; avoid all-uppercase paragraphs, heavy borders, gradients, glow and repeated panel shadows.
- Use a compact 4/8-unit spacing rhythm, 16–20 outer horizontal inset and fine separators. Reserve one restrained elevation treatment for the selected card. Flat rows stay visually quiet.

## Basemap art direction

| Layer | Target |
| --- | --- |
| Water and land | Muted Rainforest/Fern-derived shades with enough separation to recognize coastlines. No satellite photography or decorative terrain textures in this iteration. |
| Boundaries | Subtle administrative lines; major boundaries stronger than minor ones. No thick high-contrast outlines competing with journey points. |
| Roads | Suppress minor-road detail at broad zoom. Major roads may emerge quietly at close zoom; avoid bright road shields or traffic overlays. |
| Labels | Clear country/region and major locality labels appropriate to zoom; suppress POIs, retail icons, repetitive minor labels and extraneous labels. Keep enough names for orientation; do not remove all labels in pursuit of minimalism. |
| Journey points | Ordinary point: Sage/Limestone with Rainforest stroke, approximately 8–10 visible units. Selected point: citrus center and a distinct outer ring, approximately 12–14 units. No pulsating glow. Visible size and invisible touch area are separate. |
| Controls | Quiet labelled fit-to-visible action, compact attribution and required provider marks; avoid duplicate zoom widgets when pinch/accessible alternatives suffice. No location-follow or location-permission action is introduced. |

Target a 48-unit interaction area around points. When targets overlap, offer the explicit journey chooser rather than silently returning the first hit. Counted clusters are allowed only if needed for density: they count anchored journeys in the current filter, never media or visits. Expanding a cluster does not select an arbitrary journey; identical anchors still open the chooser. Clustering is a renderer choice, not an additional feature gate.

The final style must reference only sources/layers available to the selected development tile source and keep all required attribution. Do not assume raster tiles can be recolored by editing vector paint properties. Keep a bundled style configuration when the source supports it and avoid deep runtime edits to undocumented upstream layer IDs. If the current source cannot support the target, record that capability gap and retain the development fallback; production service selection stays separate. No new palette for map geography is implied beyond shades derived from the accepted colors.

## Journey row

- A single selectable row, minimum 72 units high at default text size; height grows for long titles, metadata and large text. Full-width hit region, 48-unit minimum for any separate control.
- Primary line: effective owner title, otherwise “Private journey.” Owner title provenance stays available (“Your title” inline or in accessible description/card); never use a made-up city or “Available journey N” as the final product title.
- Secondary line: observed date/span and precision. Show an unknown-date label explicitly. Owner-entered dates remain in the card, separate from observed dates.
- Compact worded status: Inferred, Confirmed, Needs review, Correction pending or Scope review needed, derived from committed state. Unknown location and uncertain order get short visible annotations when applicable. Two lines are the normal case, not a truncation limit that hides necessary status.
- Selected row uses a subtle Fern tint and a fine citrus leading accent; accessible selected state and worded status accompany color. Unselected rows have thin separators rather than button outlines.
- Do not resolve thumbnails for all rows. Use the selected card for local preview imagery. A future thumbnail list requires its own bounded loading contract.

## Selected card

Use the inherited preview contract: one compact card over the lower map edge, reachable X, one associated photo or video placeholder, trustworthy title/dates/status, primary “See photos and videos,” secondary “Review or correct journey.” Remove redundant “Open journey” from this quick card; full detail remains reachable through existing navigation. Start with card text around 18–20 units for the title, rather than the global 38-unit screen heading. Preserve at least a useful upper map region for orientation. At large text sizes permit card scrolling/expansion or accessible Timeline presentation without clipping close/actions or requiring a swipe.
