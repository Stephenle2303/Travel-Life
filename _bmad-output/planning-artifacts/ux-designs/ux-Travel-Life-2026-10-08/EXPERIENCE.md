---
name: Travel Life Living Atlas map and navigation
status: historical-proposal
updated: 2026-10-08
scope: Isolated synthetic prototype; design documentation only
sources:
  - .memlog.md
  - imports/README.md
  - ../../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
---

# Living Atlas — proposed map and navigation behavior

**Current authority (2026-10-09):** The agreed, implemented prototype direction
is now the project-wide [Living Atlas design system](../../../../docs/product/design-system.md)
under [decision 0010](../../../../docs/decisions/0010-living-atlas-design-system.md).
This file preserves the 2026-10-08 proposal; use the official system and accepted
product decisions for new UI work. Some navigation ideas were later implemented
in the synthetic prototype, while other proposal details remain unbuilt.


Status: **proposed, not approved**. This is a scoped design delta for the isolated synthetic prototype, not a production UX rewrite or implementation authorization. Visual companion: [DESIGN.md](DESIGN.md).

## Foundation

Make the private lifetime map immediately recognizable, enjoyable to explore, and easy to leave and return to. Preserve the existing welcome → simulated access/import → reveal → correction → replay → selected-highlight loop.

The supplied screenshots and inspected source establish the problem: the current percentage-position contour field is not geographic or gesture-driven, while page navigation is inconsistent. This planning pass includes no browser usability test or interactive mock.

All demo records, dates, photos and future geographic anchors must remain clearly synthetic. Invented demo coordinates are illustration, not evidence of a visit. No inferred routes, presence proof, travel score, completed coverage claim or automatic publishing.

## Information Architecture

Setup retains a clear Back/Home header and a step indication; Atlas / Replay / Highlight navigation appears only after simulated import/reveal eligibility. Preserve sparse and declined-access alternatives rather than bypassing setup.

After entry: **Atlas** owns Map/Timeline and the shared year selection; **Replay** owns the existing local preview; **Highlight** owns the exact owner-selected subset. Desktop exposes the same destinations in a compact top navigation; mobile uses a safe-area bottom bar.

Journey details use contextual Back to their source view. Home returns to the welcome/overview without resetting session data. A separate explicit “Restart demo” action confirms any reset. No duplicate Timeline tab or invented Settings destination.

Navigation preserves year, map camera, selected journey, corrections, expanded/detail context and highlight choices. Browser Back and internal Back must agree; repeated tabs do not accumulate duplicate navigation entries. Deep links respect entry/setup gates and recover missing session context safely. Unsaved rename drafts must be retained or require an explicit discard decision before leaving.

## Voice and Tone

Warm, precise and honest: “Synthetic demo”, “Inferred”, “Owner-reviewed sample”, “Coordinates unavailable”, “Fit records”, “Open journey”, “Return to Atlas”. Do not imply that the app knows every journey or that imported location proves presence.

Coverage copy describes the available sample only. A map-service error is not “No travel history”. Photo-access choices stay explicitly simulated and separate from any map network disclosure.

## Component Patterns

| Component | Behavior contract |
|---|---|
| Geographic map | Drag/pinch on touch; mouse drag and deliberate zoom on desktop; bounded initial world; preserve camera when leaving Atlas. |
| Marker / cluster | Select marker to open preview; click cluster to reveal its overlapping members via zoom or a list when co-located. Cluster only actual visual overlaps. |
| Map control dock | Zoom +/− and Fit records operate on filtered, coordinate-bearing demo points; Fit never requests current location. Explain when no points can be fitted. |
| Map/Timeline switch | Shares year and selection; switches without clearing corrections or highlight choices; Timeline supplies the accessible non-map alternative. |
| Year scrubber | Snaps to existing years; All restores full sample; keyboard arrows and labeled year buttons offer an alternative to dragging. |
| Journey preview sheet | Selection reveals image, title, year and status; expand/collapse smoothly; Open journey enters existing details; close returns focus to source. |
| Journey detail | Preserve existing session-only correction and evidence behavior; Back returns to the same map/timeline context. |
| Navigation header | Back shows the actual destination; Home does not reset; active-page title remains readable at enlarged text. |
| Primary navigation | Atlas / Replay / Highlight after eligibility; current item exposes selected state; blocked action explains why instead of silently doing nothing. |
| State / disclosure panel | Explain loading, failure, sparse/empty and unknown-coordinate cases; offer Retry, Timeline, or access-choice return as appropriate. |
| Replay / Highlight | Replay exit cancels timers; returning does not autoplay. Highlight retains exact subset and preview; navigation never publishes. |

Year changes update markers, list and available count together. Retain selection only when it remains in the filter; otherwise clear it with a concise announcement. Fit filtered records deliberately; ordinary selections do not continually recenter the map.

Unknown coordinates stay in Timeline and counts with a clear label, never at 0,0. Keep current fixture IDs, years and correction semantics; adding geographic anchors requires explicit invented-demo labeling, not reclassification of evidence.

## State Patterns

- **Loading:** stable map frame, progress text and enabled navigation; no endless decorative animation.
- **Map unavailable / offline:** explain the map layer failed, preserve records and selections, offer Retry and Timeline. A locally bundled geographic fallback, if feasible, must be clearly identified.
- **Sparse / one point:** show a sensible regional extent, not extreme zoom; avoid dramatic coverage claims; preserve replay eligibility rules.
- **Empty year / no records:** explain the filter and offer All years; keep navigation reachable and avoid an empty-fit jump.
- **Unknown coordinates:** show records in Timeline with status; map presents only coordinate-bearing sample anchors and states the difference.
- **Simulated photo access denied:** retain the existing declined path and access-choice return; do not launch a real permission request or invent memories.
- **Invalid deep link / missing session:** explain the unavailable context and return through setup or Atlas as appropriate without resetting existing session data.
- **Network boundary:** current `NO_EXTERNAL_EFFECTS.network=false` remains unchanged. Before future map-service use, decide provider, attribution, request/data policy, disclosure and local fallback; permission simulation does not authorize photo/location transmission.

## Interaction Primitives

Everyday controls respond immediately; depress buttons slightly and return crisply. Segment and year selection snap into place using {colors.citrus}. Sheet transitions use short, interruptible motion; reduced-motion uses immediate state changes or a simple dissolve.

Map camera movement is bounded, cancelable and only follows an explicit zoom/fit/cluster action. No idle spin, repeated flyovers, auto-recentering or marker pulsing. Cinematic motion remains confined to lifetime reveal/replay.

Sound defaults off; optional dry clicks require an explicit preference. Restrained haptic ticks only where supported and allowed by device settings; no reliance on vibration or audio for feedback.

## Accessibility Floor

All controls have readable labels, semantic roles, visible focus and selected/disabled states. Target 48px hit areas. Do not rely on color: status includes text/icon and selection includes a ring plus programmatic state.

Keyboard users can reach controls, select years and use Timeline without operating map gestures. Do not trap Tab in the map; avoid hijacking ordinary page scrolling. Provide an explicit map-interaction affordance where needed.

Announce selection, filter results and important errors briefly; do not announce every camera frame. Preview focus enters predictably and returns to the originating marker/list item; dismissible modal expansion supports Escape and no inaccessible background focus.

Verify contrast, 200% text, reduced motion, screen-reader order and touch reachability in implementation. These are acceptance targets, not completed checks.

## Key Flows

Illustrative **synthetic scenario**, not a researched persona: Ari explores the three fictional records already in the prototype.

1. Ari completes simulated access/import and reaches Atlas. A bounded geographic sample view states “Synthetic demo · invented demo coordinates”. No current-location permission appears.
2. Ari selects 2018; map and Timeline agree on the eligible record. Ari chooses Fit records, selects Beacon Bay, expands its memory sheet, then opens existing details.
3. **Climax:** Ari makes an existing session-only correction and uses Back. The atlas now reflects that correction without losing the 2018 filter or camera context; Ari can recognize and explore the available record while its uncertainty remains honest.
4. Ari switches to Replay, previews, then returns to Atlas. Playback stops on exit and Atlas state remains. Ari enters Highlight, selects a subset, leaves and returns; only that subset persists and nothing publishes.
5. If tiles fail, Ari receives a map-specific error and switches to Timeline. Unknown-coordinate records remain available there; photo-access denial retains its own existing recovery path.

## Responsive & Platform

Mobile prioritizes map plus reachable year dock and three-item navigation. Preview expansion leaves clear dismissal and safe-area space; short screens/enlarged text use in-flow cards and scrolling instead of inaccessible overlays.

Desktop prioritizes map with an optional side panel. Zoom/fit controls and attribution remain unobscured. Resize, device rotation and browser navigation must preserve selection and year; do not promise exact cross-platform camera persistence without later validation.

Native production architecture stays separate. Provider selection and any platform adapters are future implementation decisions, not a commitment made by this prototype proposal.

## Inspiration & Anti-patterns

Borrow recognizable geography, map dominance and obvious zoom from reference 1; retain the Living Atlas palette, honest labels and precise selection from reference 2. Reject repeated worlds, pale generic map styling, tiny labels and an abstract plot presented as the key atlas experience.

Sources: [canonical record](.memlog.md), [references](imports/README.md), [model](../../../../apps/prototype/src/data/prototype-model.ts), [fixtures](../../../../apps/prototype/src/data/synthetic-record.ts), [screen flows](../../../../apps/prototype/src/components/prototype-screens.tsx), [MLP decision](../../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md).
