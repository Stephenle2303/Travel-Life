# Atlas composition and interaction

## References and precedence

Use the official design system and its private Atlas prototype reference. This
owner-approved lean amendment governs information hierarchy and compact layouts;
decision0013 still governs cartography. Do not revive deferred docks, route arcs,
zoom sliders or decorative map controls. Runtime snapshot: atlas-reveal.tsx,
mobile-screens.tsx, maplibre-atlas-map.native.tsx and trip-list-card.tsx.

## Compact layout (CAP-1–4, CAP-8)

```text
Home               Your Atlas             Settings
N journeys in this view                    Details
[ Map | Timeline ]                    [ All years ]
[ Search journeys                           Clear ]
--- Compact status only when needed --------------
|                                                |
|    MAP, or TIMELINE with recognizable covers    |
|                                                |
|    Selected journey opens a bounded sheet       |
--------------------------------------------------
Add journey                             [ Replay ]
                   device safe area
```

This diagram defines hierarchy, not frozen pixel dimensions or synthetic counts.
At320–430 logical px and normal text the ready screen must show the header, view
controls, a useful map/list region and Replay without vertical page scrolling.
At large text, preserve readable labels and reachable actions; allow appropriate
scrolling/wrapping rather than shrinking text. At360x800/100% text, target at least
40% of the safe-area content height for the map; this is a layout acceptance
target, not a fixed430px map. Landscape uses available height with bounded panes.

- One title: **Your Atlas**. Remove the redundant PRIVATE ATLAS eyebrow.
- **Home** at left and **Settings** at right are quiet labeled utilities. Icons
  supplement labels. At narrow/large text sizes, title may occupy its own row;
  never clip or force three large buttons into one line.
- A single secondary line: **1 journey in this view** / **N journeys in this view**.
  N is the privacy-visible filtered list count, including owner-entered and
  unlocated items. The wording is not an inferred-visit total. Do not show a
  misleading0 while history is loading; hide the count until the set is known.
- **Details** opens a sheet, never inserts paragraphs above the map. No separate
  About button in the header. Essential source/consent explanations remain in
  their owning action flow, not hidden solely here.
- **Map / Timeline** is a segmented view selector with text and selected semantics.
  Timeline displays its count through the shared summary; no duplicated dashboard.
- **All years** / selected year opens a bounded single-select year sheet, current
  years descending plus All years. Selecting closes the sheet; Close cancels.
  Use actual existing year membership semantics, not a new trip boundary rule.
- Search placeholder **Search journeys**; search only the authorized current
  Atlas records. Preserve existing matching unless separately specified. Clear
  button appears when nonempty. No repeated local-search explanatory paragraph.
- Ready task primary **Replay**, secondary **Add journey** in the action region.
  This region reserves layout space instead of covering map attribution or rows.
  Keyboard-active state exposes clear/dismiss affordances and restores actions
  when closed. Do not show a disabled mystery Replay if ineligible: keep the
  concise reason in Details and the relevant empty/recovery action in context.
- Changing view/year/search performs no import, rebuild, sync or render.

## Map and Timeline (CAP-3, CAP-5)

Compact Map shows the map and focused selection, not every journey underneath.
Timeline remains a visible single-tap alternative. When some filtered journeys
have no map anchor, display a compact **N without map locations · View in Timeline**
inside the map context; never invent markers or hide these items from counts.
Timeline shows those same filters and labels unlocated rows **Location unknown**.
The link opens the same filtered Timeline without silently changing year/search.

One marker selects one preview. Overlap opens **Choose a journey** with bounded,
scrollable photo/title/period rows and Close; selecting a row replaces the chooser
with its preview. It must remain usable with many journeys at one location.
Panning/zooming never opens a journey accidentally or scrolls the whole page;
the native map owns active map gestures and releases them on end/cancel/unmount.

Timeline has one vertical list owner and bounded/virtualized rows. Do not eagerly
resolve covers for the entire lifetime history. Use existing authorized media
loaders and bounded near-visible prefetch; canceled/stale results cannot paint a
different journey or account. Missing media retains the row and a neutral cover.

Row hierarchy: recognizable cover; title; observed period; small worded status
(Inferred, Reviewed or Added by you according to actual model mapping). Needs
review is an actionable status near the row, not buried in concatenated prose.
Location unknown/order uncertain remain concise additional status when applicable;
never translate a correction approval into verified physical presence.
Long titles wrap, and accessibility labels include status; no fixed row height
that clips large text. Optional chronological year grouping must not reorder
the existing model or guess uncertain chronology.

At >=768 logical px, map with a restrained adjacent journey list is allowed if
each remains usable at current text size; otherwise retain compact mode. Selected
preview may be a bounded side pane. No duplicate full feed below that layout.

## Details and journey preview (CAP-2, CAP-5)

**Atlas details** is a bounded scrollable sheet with visible Close, modal focus,
and return focus to Details. Sections:

1. **This view**: current year/search summary, visible journey count and unlocated
   count. Render query only on device; never put it in diagnostic payloads.
2. **Available record**: source-appropriate local/account coverage and the short
   qualification **This record may be incomplete.** Do not call an account-backed
   record device-only. Avoid unsupported exhaustive-history or presence claims.
3. **Record totals**: existing inferred journey/place/country metrics, explicitly
   labeled as full-record inferred metrics, separate owner-entered count. Missing
   metrics display Unavailable, never0; supported-country count never says visited.
4. **Evidence & privacy**: photo location does not prove presence; permitted map
   provider disclosure and local search boundary. Existing diagnostics/rebuild
   controls belong in a further technical subsection, only when currently safe.
   Rebuild never runs on opening Details. Replay unavailability belongs here too.

Journey preview: cover/poster, title, observed period and compact worded state;
primary **See photos** (gallery supports video too), secondary **Edit**, quiet
**Evidence details**, visible Close. Video-only journey uses an authorized poster
or honest video fallback, no automatic playback. Missing cover is not missing
journey. No accessible media: show **No photos available**, omit unusable media
primary, retain supported edit/detail actions. Owner-only entries retain existing
edit eligibility; do not add a new editor or imply attached evidence.

Owner-entered dates use **Your dates**; observed span uses **Photo dates** when
both are present. Never collapse conflicting spans into a single apparent fact.
Evidence details holds provenance, location context, uncertainty and correction
details that were previously paragraphs before the cover. Preserve a route to
existing full journey details where it is needed; do not create a dead callback.
Gallery replaces/suspends preview focus; closing gallery returns to the same
preview. Avoid nested active modals competing for screen-reader/native Back.

## Visual and accessibility rules (CAP-8)

Use existing Atlas navy canvas, Deep Sea Glass surfaces, readable white/secondary
text, cyan active/focus controls and restrained amber selected-destination accent.
Gold stays cartographic. Do not use citrus/fern for Atlas chrome; add explicit
Atlas variants without altering shared defaults elsewhere. No new blur dependency:
use an opaque supported fallback with sufficient contrast. Avoid stacked outlines,
gradients on controls, constant glow or repeated card frames.

Use8px rhythm with16px starting gutters,16px sheet/card radii and restrained
typography; these defaults yield to native fit. All controls >=48 logical px touch
targets even when visually quiet. Selected controls include semantics and a
non-color indicator. Focus is visible, modal focus is contained/restored, major
status changes are polite announcements. Per-item progress does not steal focus.
Reduce motion removes camera/card animation; no task relies on motion, color or
sound. Map attribution stays visible. Validate contrast over actual map surfaces.
