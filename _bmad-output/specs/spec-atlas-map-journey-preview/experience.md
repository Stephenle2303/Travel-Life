# Interaction and content contract

## Map state and layout

1. Atlas opens in its current Map or Timeline choice with the current year filter. The map is the dominant surface in Map mode.
2. A map point is selected only by an explicit tap or equivalent accessible action. One point maps to one opaque local journey display identity. A selected point receives a visible and accessible selected state.
3. The compact preview card sits above the lower map edge, within safe areas, without moving the scroll position to Timeline. It must leave enough map visible for orientation and another selection. The current fixed-height map may need to grow in Map mode so the card does not consume the whole useful map area. The map does not remount or reset its camera when the card opens, closes, or changes journey.
4. The card has a visible, reachable close button labelled “Close journey preview.” Tapping empty map space closes it. Tapping another point replaces its content. A drag/pinch changes the map without accidentally opening a different journey or dismissing the card; an intentional empty-map tap dismisses it.
5. If multiple journeys occupy the same tappable area, first show a bounded choice of candidate journeys using title/date/status. Do not silently choose the first feature. Selection from that choice opens the corresponding card.
6. Year filtering removes a selected card only if its journey is outside the new filter. Switching Map/Timeline shares selection where possible. Map service failure leaves Timeline and journey content reachable.

## Preview card

| Element | Required behavior |
| --- | --- |
| Title | Show an effective owner title with an “Your title” provenance cue. Otherwise show “Private journey.” Never fabricate a city from coarse coordinates. |
| Time | Show an observed span with its precision, or “Observed date unknown.” If an effective owner date claim exists, label it “Your date” separately. Do not call either a proven trip duration. |
| Status | Show inferred, confirmed, needs review, or pending correction status from the current committed record in words as well as color. Never display unsaved decisions as effective. |
| Media preview | Resolve one suitable, associated, device-accessible photo only after selection. Label it “Associated photo.” If the journey has only video, show a local video poster when safely available or a video placeholder with a play badge; the card does not autoplay. If media is unavailable, cloud-only, revoked, or absent, use a non-fictional placeholder and explanatory text. Never substitute another journey's media. |
| Primary action | Show “See photos and videos” when at least one currently eligible media entry is known. An optional count means eligible associated media entries in the current accessible scope, not all lifetime media. If count cannot be established cheaply, omit it. For zero entries, explain “No accessible associated media yet” without a dead action. |
| Secondary action | “Review or correct journey” opens the existing private correction flow for this selected journey. The action is visually subordinate to media browsing and remains available when no media preview exists. |
| Dismiss | Visible X plus semantic label. Dismiss returns immediately to the same map viewport and filter. |

Loading the card should give immediate selection feedback; text may appear before the preview. A slow or failed media lookup cannot block map interaction. Rapidly tapping A then B must never show A's media or title on B's card.

## Associated media viewer

“See photos and videos” opens a private gallery over the Atlas context. A bounded page of photo thumbnails and video posters or labelled placeholders loads first; more entries load on demand. Tapping a photo opens a larger local image. Tapping a video opens its local player, with an explicit Play action and sound off by default. The player pauses when the app backgrounds, the item changes, or the viewer closes; it does not autoplay the next video. Back or close from an item returns to the gallery; Back or close from the gallery returns to the selected map card and exact camera/year state. The user can then tap another point, dismiss the card, pan, or zoom.

The gallery includes photo and video entries associated with the selected journey under the current committed projection, including eligible visit-support media and accepted journey memories, with association type represented accurately. Suggested, rejected, unassigned, excluded, or conflicting entries are not silently presented as accepted album members. Missing and cloud-only media may retain a clearly labelled unavailable slot if the association is still valid; it must not trigger an automatic network download. Revoked access closes or blocks media display with a route to restore access. A gallery page does not fetch or decode the entire library. Video duration is shown only when source metadata supports it.

## Correction entry and return

“Review or correct journey” opens the existing correction route for the selected opaque journey identity. Returning without saving restores the same Atlas viewport, year filter, Map choice, selected point, and card. After a save, Atlas refreshes from the committed projection before restoring selection. If the corrected journey still resolves to one valid successor, reopen its updated card; if it was rejected, split, merged, or cannot be mapped unambiguously, preserve the viewport and filter but close the card and explain that the journey changed. The correction route must not use the former detail-screen Back chain to reset Atlas state for this map entry path.

## Context and transitions

The preserved Atlas context comprises viewport center/zoom, year filter, Map/Timeline choice, selected opaque journey ID, and card open state. It survives media viewer and correction open/close and app foreground transitions where the committed record remains valid. If a reconstruction or correction replaces the selected journey, reload against the committed successor only when identity can be resolved safely; otherwise close the preview with a plain “This journey changed; choose it again” message. Never bind an old media query to a newly reused or remapped display ID.

If the map is offline or unavailable, the Timeline provides an equivalent selection, card summary, media viewer, and correction action. Media and correction access do not depend on map tiles. A filtered year with no journeys has a clear empty state and a path back to All years.

## Accessibility and visual behavior

Use Living Atlas Rainforest/Fern matte card surfaces, Limestone text, and Citrus for the selected point and primary action. Keep the card legible over moving map tiles, within safe areas and above system navigation. At large text sizes the card may expand or scroll internally without covering the close control. Touch targets meet the design-system target. Opening the card announces its title and observed date; closing returns focus to the selected point or equivalent Timeline control. The media viewer distinguishes photos from videos in labels, exposes Play/Pause and mute controls, and has a predictable focus order and labelled close/Back actions. The correction return restores focus to the selected point or a clear map status message. Reduced motion removes nonessential sheet animation; no action relies on a swipe gesture alone.
