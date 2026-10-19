# Atlas exploration behavior

## Camera and gesture ownership

One controller owns viewport, projection, clamp, animation and gesture state.
Map interaction locks parent scrolling only while a map gesture is active; release
on completion, cancellation, background and unmount. Controls and preview scrolling
must not be intercepted. Preserve the 1–64 world-fit scale range and measured fit.

| Input | Required result |
| --- | --- |
| One-finger drag | Pan immediately after a logical 8-unit slop; no journey activation on release |
| Two-finger pinch | Continuous focal zoom and translation under the moving finger centroid |
| Double tap | 2x zoom around tap, clamped to maximum |
| Two-finger tap | 0.5x zoom around centroid; distinguish from pinch |
| Double-tap, hold second touch, vertical drag | Quick zoom: down in/up out; proposed multiplier `exp(dy / 180)` |
| + / − | Retain 1.6x / inverse step around unobscured viewport center |
| Fit world | Whole projected world fits current viewport; never clipped by an assumed screen size |

Recognize double tap within 300ms and 24 logical units; two-finger tap finishes
within 250ms with < 8-unit motion. These are tuning defaults. Gesture promotion
single-to-pinch and pinch-to-single rebases anchors with no jump. Cancel an active
inertial/animated camera immediately on new input. Clamp both scale and pan every
frame. Inertial pan uses measured release velocity and bounded decay, without
bouncing outside the world. Reduced motion disables inertia/animated camera.
No rotation, tilt or new current-location permission. Keep accessible zoom/fit
buttons even when touch gestures work; browser wheel/trackpad behavior must be
verified separately if the browser map is delivered.

## Hit testing and regional exploration

Hit priority: control/preview, journey or cluster, visible geographic label, then
empty map. A drag/pinch cannot also be a tap. For overlapping 48-unit hit targets,
choose nearest center; ties use stable IDs or the chooser, not render order.
Tapping a visible region label highlights/fits its public bounds within padded
viewport. It does not silently filter journeys or change the active year. Empty
map tap first dismisses a preview; it must not unexpectedly zoom or select an
invisible polygon. Region hit targets must not steal nearby journey taps.

## Real visible clustering

Current tap-time overlap lookup is not sufficient. Render clusters from the
qualified, year/search-filtered journey projection. Proposed radius: 32 logical
units, independent of raster LOD/device density. Use a deterministic bounded
spatial index, stable membership/IDs and projected screen distance. Never cluster
by a fixed latitude/longitude degree threshold. Count journeys, not photos or
unverified visits. Selected journey remains recognizable and accessible.

Cluster tap fits member bounds with control/preview padding. If identical/coarse
anchors or maximum zoom prevent separation, open the existing journey chooser;
never recursively zoom forever or invent offsets/precise positions. Ordinary dots
remain 8 units, selected 12, with 48-unit touch targets; cluster badges may grow
only enough for a readable count. Announce cluster counts and button purposes.

## Selection and retained context

A journey dot opens its real, dismissible in-place preview, not a fake destination
card or an automatic Timeline navigation. Preserve the approved card content and
secondary media/correction entry points; decorative persistent-card redesign is
not included. X/tap-away restores unselected map. Preview must not block all map
gestures; an in-place lightweight sheet may replace a blocking modal without
changing content semantics. Pan only enough to reveal a selected point if covered.

Keep camera, year, Map/Timeline, search and selection across photos/videos and
correction. Revalidate snapshot/record identity on return; removed or ambiguously
remapped journeys close safely rather than showing stale content. No reset to
world or forced auto-fit on ordinary rerenders/import refresh. Existing local
journey search remains local: do not imply a global Google-style places service.
