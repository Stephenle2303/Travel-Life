# Acceptance and verification matrix

| ID | Demonstration or check | Expected result |
| --- | --- | --- |
| A1 | Tap a single visible map point. | Selected state and preview card appear over the map; no Timeline scroll or route change. |
| A2 | Inspect an effective owner title/date claim and an inferred journey without claims. | Card labels owner claim separately from observed span; inferred card uses “Private journey” and no invented destination. |
| A3 | Tap X, then select another point; tap empty map. | X and empty tap dismiss; selecting another point replaces content; viewport and year stay unchanged. |
| A4 | Pan and pinch while a card is open. | Camera moves normally; a gesture does not open a wrong point or trigger navigation. |
| A5 | Tap a point with overlapping journey features. | Owner chooses a candidate; no arbitrary first journey is selected. |
| A6 | Select A, quickly select B while A's preview is pending. | B's card never shows A's title, media, count, or source reference. |
| A7 | Select a journey with an available associated local photo, then one with only video. | A real photo appears for the first; the second shows a safe video poster or labelled placeholder without autoplay; neither uses synthetic imagery or sends media to the tile provider. |
| A8 | Select journeys with no media, revoked permission, cloud-only media, and a missing original. | Honest distinct empty/unavailable state; no automatic cloud download; map stays usable. |
| A9 | Open the gallery, load another page, open a photo, then close photo and gallery. | Bounded mixed-media pages; return to same selected card, map camera, Map choice, and year filter. |
| A10 | Compare visit-support, accepted trip memory, suggested, rejected, and unassigned photos and videos. | Only eligible current associations appear as gallery members; trip-only membership never becomes visit proof; status wording remains accurate. |
| A11 | Revoke access, disconnect the private record, or commit a rebuild while preview/gallery loading. | Stale result is discarded; no cross-journey or post-revocation media display; recovery is explained. |
| A12 | Filter to another year, switch Map/Timeline, or make map tiles unavailable. | Selection clears only when filtered out; Timeline offers equivalent journey selection and media entry without map tiles. |
| A13 | Use Android and iOS with screen reader, large text, and reduced motion. | Close/action and video playback controls are reachable and announced; status is not color-only; focus returns predictably. |
| A14 | Inspect network and telemetry boundaries during preview/gallery use. | Tile provider receives only map requests; no photo or video bytes, source IDs, precise coordinates, journey contents, or gallery membership are transmitted. |
| A15 | Open an associated local video and press Play; background the app, close the item, then reopen it. | Playback begins only after Play, sound is off by default, and playback pauses on background/item close; no automatic cloud download or next-video autoplay occurs. |
| A16 | From a selected map card, open “Review or correct journey,” then return without saving. | Existing correction screen opens for the selected journey; Back restores the same map camera, year, selected point, card, and focus without passing through a reset Atlas route. |
| A17 | Save a title/date edit, then reject, split, or merge a selected journey in separate cases. | Atlas refreshes from committed correction data; a uniquely valid successor may reopen with updated context; removed or ambiguous selection closes safely while viewport and filter remain. |

Automation should cover deterministic selection/state transitions, repository paging/membership, video playback lifecycle, correction return, and stale-result invalidation. Native device verification must cover actual map hit testing, overlays, gestures, photo/video availability, playback, safe areas, and Back behavior on both platforms. Record unavailable platforms as unverified rather than passing. Run mobile checks and root `npm run check` when implementation is delegated; a spec-only task verifies document coherence and links.
