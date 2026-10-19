# Official Google Maps research and adaptation

Evidence: official product/SDK/help documentation reviewed 2026-10-18. No live
Google Maps comparative usability session, reverse engineering, exact font audit
or performance measurement was performed. The following are documented patterns
and explicit Travel Life adaptations, not a claim to reproduce proprietary internals.

| Source and documented pattern | Travel Life decision |
| --- | --- |
| [Android controls/gestures](https://developers.google.com/maps/documentation/android-sdk/controls): pan, pinch, double tap, two-finger tap and one-finger quick zoom; controls can be padded | Implement that familiar 2D gesture vocabulary, preserve accessible buttons and unobscured padding. Deliberately exclude tilt/rotation |
| [Zoom-level styling](https://developers.google.com/maps/documentation/javascript/cloud-customization/zoom-levels): feature style/visibility can change at key zoom levels | Progressive country/Admin1/locality detail; use our projected logical world width, not Google's zoom values |
| [Marker clustering](https://developers.google.com/maps/documentation/javascript/marker-clustering): aggregate dense markers and expand as users zoom | Visible journey counts, deterministic screen-space clustering, fit members or show chooser if inseparable |
| [Advanced markers](https://developers.google.com/maps/documentation/android-sdk/advanced-markers/overview): collision behavior and marker interaction | Our priority/collision rules keep selected journeys usable. This does not import a Google SDK or deprecated beta collision implementation |
| [Boundary styling](https://developers.google.com/maps/documentation/javascript/dds-boundaries/style-polygon): independent boundary stroke/fill styling | Separate administrative line layers from terrain and labels; deliberate country/province hierarchy |
| [Camera/map events](https://developers.google.com/maps/documentation/android-sdk/events): camera movement/idle and object selection are separate events | Separate camera updates, idle label work and tap selection; no accidental dot activation after drag |

Borrow progressive disclosure, stable spatial context, gesture consistency and
clear selection. Do not copy Google colors/UI wholesale: the owner's approved
Obsidian visual remains authoritative. Numeric thresholds, fonts, clustering
radius, inertia and label priorities in this spec are OUR proposed choices.
Google docs describe SDK behavior/patterns, not every current Maps app behavior.

The full Google Maps product includes roads, businesses, directions and live
services that are outside Travel Life's private-lifetime-atlas task. No extracted
Google cartography, scraped names, external geocoding of private anchors, provider
account setup or new place-search promise follows from this research.
