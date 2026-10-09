# Living Atlas: interactive map and navigation

Date: 2026-10-08. Designer: Sally, BMAD UX Designer.
Status: proposed, awaiting owner approval. **Design review and plan only.**

## Recommendation

Replace the abstract point diagram with a geographic, explorable atlas. Let rich
cartography and fictional travel imagery provide the energy; keep the controls
precise and quiet. Add consistent navigation so exploring never becomes a dead end.
This proposal applies to the isolated `apps/prototype` deliverable, not production
mobile implementation or the public sharing service.

The requested direction is captured in [DESIGN.md](DESIGN.md) (appearance) and
[EXPERIENCE.md](EXPERIENCE.md) (behavior). These are proposed scoped additions, not
replacements for the accepted MLP/privacy contract. No application code, packages,
map credentials, media, or runtime settings changed in this pass.

## Approval items

1. **Visual/IA:** approve or adjust the vibrant cartographic palette extension and
   Atlas / Replay / Highlight navigation, with Home/Back and Timeline inside Atlas.
2. **Map services and fixtures:** approve clearly labelled geographic demo anchors
   and choose between a licensed network basemap or bundled offline geography.
   A network map can disclose IP/viewport through ordinary map-service requests;
   it is not "fully on-device." Do not send photos, journey names, evidence, precise
   owner coordinates or corrections to a provider as part of this demo.

The current prototype declares `NO_EXTERNAL_EFFECTS.network = false`. If network
tiles are chosen, revise that contract, disclosure, tests and README explicitly.
No API key, paid account or provider adoption is assumed by this plan. Preserve
the local Timeline independently of any provider. Native map implementation remains
a separate platform decision/story, not automatically solved by a browser map.

## Review: what currently holds the experience back

| Finding | Evidence | Proposed response |
|---|---|---|
| The key feature does not behave like a map | [MapCanvas](../../../../apps/prototype/src/components/map-canvas.tsx) positions markers with screen percentages and decorative circles; no geographic coordinates, pan, or zoom | Render recognizable geography with gesture and button controls, shared with the accessible Timeline |
| Low visual differentiation makes exploration feel flat | Current screenshot has nearly identical dark field/panel colors; no coastlines or terrain | Turquoise water, forest/sage land layers, restrained terrain and country labels; photographic selected-memory card |
| The map spends too much room on framing and explanation | Padded panel, nested rounded field, heading and long disclaimer before the map | Map-first layout with compact header/dock, persistent short demo label, expandable coverage explanation |
| Movement between pages is inconsistent | [Root layout](../../../../apps/prototype/src/app/_layout.tsx) hides headers; [screens](../../../../apps/prototype/src/components/prototype-screens.tsx) provide individual forward/return actions | Shared navigation shell with predictable Back/Home and three post-import destinations |
| A geographic implementation needs data and state the diagram never needed | [Types](../../../../apps/prototype/src/types/prototype.ts) have only `marker.x/y`; camera/return context are absent | Explicit synthetic geographic anchors and camera/return state; never reinterpret percentages as latitude/longitude |

This is a screenshot/source review. No new browser prototype or live usability test
was performed. Appearance, accessibility and performance acceptance below are future
checks, not results already achieved.

## 1. Make the map the reason to explore

### Visual proposal

- Keep the existing rainforest/fern shell, limestone text and citrus selection.
  Add a **map-only palette extension**: luminous turquoise water, layered green
  land and warm limestone coastline detail. Exact new tokens are proposals in DESIGN.md.
- Show continents at lifetime scale, region/place labels when zoomed, and restrained
  terrain where it improves orientation. No satellite/style selector is needed for
  the first revision; one excellent map is the goal.
- Fit the available geographic sample points on first reveal. Provide an intentional
  world overview, but do not show repeated world copies like the reference screenshot.
- Circular markers remain the visual signature. Selected marker: crisp citrus ring
  and readable label. Unselected markers: quiet but legible on land and sea. Status
  text/icon is separate from selection; citrus never means "confirmed."
- Let a selected journey's existing synthetic landscape crop occupy a substantial
  card/sheet area. More imagery should not obscure geography or invent evidence.
  Do not place the welcome video or constantly moving media behind the map.

### Essential interactions

| Action | Expected behavior |
|---|---|
| Drag / pinch / zoom buttons | Pan and zoom actual geography; visible +/- controls provide a non-gesture alternative |
| Fit records | Fit the current filtered geographic points, accounting for card/dock occlusion; never request current device location |
| Select a point | Select the same journey in Timeline; show photo, year, status and concise coverage in a compact card |
| Select a cluster | Zoom to its members; if members share a position at maximum useful zoom, show a selectable list rather than an endless zoom |
| Open journey | Expand to existing journey/detail and session-only correction flow; Back returns to the selected point and camera |
| Change year | Snap to All or an available year; update map, count and Timeline together; announce results once after selection settles |
| Switch Map / Timeline | Keep filter and selected journey; Timeline remains a full alternative, not a secondary inaccessible summary |

No route lines, animated aircraft, exact-distance totals, visited-country scores,
unobserved stops, or implied owner-presence claims. Destination exploration creates
the delight; fabricated travel certainty does not.

### Synthetic geographic data

Retain the three existing journey IDs, years and session correction semantics.
Assign deliberately invented demo anchors to recognizable geographic regions only
after approval. The UI must say **"Fictional journeys · demo map positions"** and
selected cards must explain that names/images/positions are illustrative, not
captured visits. Region context must not silently rename or substantiate a journey.
Do not reverse-geocode these anchors into asserted destinations.

Unknown coordinates stay in Timeline with "Location unavailable"; never place
them at 0,0. Counts distinguish available journeys from plotted locations, rather
than assuming one journey equals one destination. Keep current sparse and declined
examples usable without manufacturing additional records.

## 2. Navigation that supports exploration

Proposed primary destinations after the simulated import:

| Label | Existing route | Purpose |
|---|---|---|
| Atlas | `/reveal` | Map/Timeline, years, selected journeys and available-source coverage |
| Replay | `/replay` | Existing explicitly simulated, cancelable replay preview |
| Highlight | `/share` | Choose and preview the exact synthetic subset; no publication |

Mobile: visible icon + text bottom navigation, safe-area padded. Desktop: the same
destinations in a compact top navigation. No hamburger-only primary navigation.
Timeline is an Atlas mode, not a fourth destination.

Use a shared header with a clearly labelled Home action throughout, and Back on
setup, detail and example pages. Home opens Welcome **without resetting** corrections,
filters or highlight choices. After an import, Welcome offers "Return to Atlas";
restarting a demo must be a separate explicit action, if later included.

Before import, show Home/Back plus the existing next-step actions; do not expose
Replay/Highlight as if personal data were ready. Direct entry to a post-import page
must either recover the current demo session or offer "Start the sample walkthrough"
with honest sample labels. Refresh does not imply persistence.

Navigation must preserve year, selected journey, map camera, view mode, card state
and highlight selection for the session. Leaving Replay stops its timer/animation;
entering it is deliberate, not a side effect of browser history. Repeatedly tapping
the active destination does not create duplicate history entries. Browser Back,
visible Back and Android back must have consistent outcomes. Unsaved rename drafts
must not disappear silently when navigating away.

## 3. Responsive composition

```text
Mobile                                   Desktop
Home     Private Atlas / demo label       Home   Atlas   Replay   Highlight
Map | Timeline       All / year dock      Map | Timeline          year dock
+-------------------------------+         +--------------------+-------------+
| Geographic map            + - |         |                    | Selected    |
|                               |         | Geographic map     | journey     |
|                 Fit records   |         |                    | photo/card  |
+-------------------------------+         |           + - Fit  | + coverage  |
Selected journey photo/card               +--------------------+-------------+
Atlas       Replay       Highlight
```

At 390×844, target roughly 55–65% of the usable content region for visible map,
not a fixed pixel promise. Start with a peek card below it; expand only on request.
At 1440×900, target roughly 70% map / 30% detail rail. At short heights or 200%
text, stack or scroll panels without losing map controls, navigation or attribution.
At 320px width, the year dock may scroll horizontally; the page must not.

Keep attribution readable and clickable, outside sheet/control occlusion. Avoid
wheel-zoom hijacking page scroll; enable it only through a deliberate map-focus or
modifier interaction. Touch users can leave the map and scroll the surrounding page.

## 4. Honest states and accessibility

- Map loading: stable space with status, never an empty green panel. Timeline is
  available immediately. Map/network failure: retry plus usable local Timeline;
  not a simulated geographic map advertised as working.
- No year matches: show zero results and "Show all years." One uncertain record:
  a useful single-point view with status, not an expansive fabricated lifetime story.
- Inferred/confirmed status uses text and an icon/shape distinction, not color alone.
  Confirming changes only the prototype session and retains provenance context.
- All essential actions work with keyboard and the list. Provide labelled controls,
  visible focus, selected states, an escape from the map, logical focus restoration
  after card/detail close, and non-disruptive result announcements.
- Target 48px control hit areas; support platform text sizing. Verify normal text
  at 4.5:1 and essential controls/focus at 3:1 against actual land/water/photo crops.
  These are requirements, not measured compliance claims.
- Fast button depression and crisp return; short card transitions. Reduced motion
  removes camera flights and nonessential transitions. Haptic selection ticks are
  optional where supported; silence is valid. No new sound dependency or autoplay.

## 5. Implementation sequence after approval

1. **Resolve the two items in Approval items**, then amend the existing
   [Living Atlas delivery spec](../../../implementation-artifacts/spec-living-atlas-prototype.md)
   with this agreed delta. Do not create a competing product backlog or change
   production architecture through a prototype styling task.
2. **Geographic foundation:** choose an appropriate prototype map renderer and
   licensed basemap, bounded initial camera, data schema, unknown-location behavior
   and list fallback. Add fixture/model tests before replacing MapCanvas.
3. **Explore interactions:** selection, clusters/overlap list, fit, zoom, year dock,
   Timeline synchronization, photo card and accessible equivalents.
4. **Shared navigation:** responsive shell, setup gating, return context, browser
   history, replay cleanup and session-only corrections/highlight preservation.
5. **Visual pass:** consistent map/panel/nav tokens, readable labels, photo crops,
   statuses, focus, reduced motion and small/short viewport behavior.
6. **Verify and hand off:** run root `npm run check` and prototype `npm run check`;
   inspect in the browser and record screenshots, failures and remaining device gaps.

Likely change surface: `map-canvas.tsx`, `prototype-screens.tsx`, `ui.tsx`,
`_layout.tsx`, synthetic fixtures/types/model/provider, and existing flow/model tests.
This is an impact map only; none of those files was changed for this proposal.

## Acceptance checks for the later build

| Scenario | Expected observable result |
|---|---|
| First eligible sample reveal | Recognizable geography and visible demo label; all mapped points fit without being behind panels |
| Drag/pinch/zoom then Fit | Camera changes correctly; Fit restores the filtered point bounds without requesting geolocation |
| Marker, overlapping cluster, year and Timeline selection | Same journey/filter selected everywhere; no hidden old selection or endless cluster zoom |
| Correct a journey then navigate away/back | Title/status persist for this session; camera/year/context return; no durable-save claim |
| Navigate via every primary destination and Home/Back | No dead end, duplicate push loop, unexpected reset or navigation-induced playback |
| Exit Replay / enter Highlight | Replay stops; subset stays explicit; no URL, export, publish or automatic whole-history selection |
| Failed tiles/WebGL, unknown coordinates, sparse/declined sample | Useful list and recovery controls; unknown locations never plotted as real positions |
| 320px wide, 390×844, 844×390 and 1440×900; 200% text | No page overflow or clipped actions; map, sheet, nav and attribution remain usable |
| Keyboard, screen-reader and reduced-motion walkthroughs | Essential actions accessible without gestures; focus restored; no unwanted camera flight or audio |

Capture each viewport at overview, selected marker, expanded card, filtered year,
Timeline and map-error states. Inspect motion start/middle/end and interrupted
transitions, rather than judging only a polished opening frame. Browser checks do
not establish physical iOS/Android gesture, haptics or screen-reader correctness.

## Sources and boundary

- [Decision 0009](../../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md):
  private map → replay → deliberate owner-selected sharing, with honest evidence.
- [Current product context](../../../../docs/product/context.md) and
  [MLP working spec](../../../planning-artifacts/mvp-spec.md): existing product and
  map-service privacy boundaries, not additional research prerequisites.
- [Reference register](imports/README.md): both supplied screenshots, their useful
  contributions and rejected traits. [Capture log](.memlog.md): user direction vs
  designer assumptions.

Open approval items are intentional. No production implementation, provider
evaluation, browser visual QA, measured contrast or usability study is claimed here.
