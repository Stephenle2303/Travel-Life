# Interaction and state requirements

## Layout and progressive disclosure

1. The ready view opens in Map by default, or the restored Map/Timeline choice. Header, compact summary and filters precede the map; journeys follow it on the same page.
2. “About your Atlas” opens coverage, incomplete-history wording, evidence/presence limitations, observed-versus-owner provenance and the current map-provider request disclosure. Closing returns focus and scroll to its trigger. Required map attribution remains on the map.
3. First connection/import consent and material provider changes retain their existing disclosure requirements. Moving repeated explanation into an information surface does not remove consent or conceal restricted/error state.
4. Timeline mode hides the map surface and puts the same filtered journey list under the controls. Keep the chosen year and valid selection. Returning to Map restores its camera. Avoid a second “Use Timeline” button when the segmented control already supplies it; map failure may expose one clear recovery action.

## List dates, ordering and data

- Use observed years from the committed local projection. List each journey once in All years, grouped under the latest known observed year; a multi-year journey shows its full observed span. A selected year includes a journey only when its supported observed evidence represents that year; a gap between endpoints does not establish evidence in every intervening year. Do not group by owner-entered dates or duplicate multi-year journeys.
- Latest-first is a display preference for comparable periods. Overlapping or weakly ordered journeys keep “Order uncertain”; stable ordering is for rendering, never a claimed sequence. Date-unknown journeys form a separate labelled section. Missing owner titles fall back immediately to “Private journey.”
- Supply title, precision and committed status through a bounded safe list-summary projection. Do not call the full detail/media loader for every row. Preserve opaque identities and redacted map/telemetry boundaries; any added local owner-readable field must be explicitly allowed only at its intended boundary.
- Maintain list position across preview, gallery and correction entry/return. Selection updates the matching visible row without automatically scrolling the page to it or recentering the map. An explicit fit-to-visible action may change camera; card open/close never does.
- If the current projection cannot supply a status, use an honest loading/unavailable label until read; do not silently call a confirmed record inferred. Counts above the list mean distinct journeys in the current filter. Global statistics remain labelled as the available record, not filtered totals.

## Map selection and gestures

- Pinch and drag manipulate the camera without dismissing/choosing a journey. Deliberate empty-map tap closes the card; point tap opens/replaces it. X closes immediately, preserves camera/year and returns focus to the point or matching list control.
- A tap matching multiple journey targets opens a bounded, scrollable chooser containing title, observed dates and status. Explicit choice selects one. Cancelling retains prior valid selection/camera. Unknown-coordinate journeys remain list-only.
- Store camera center, zoom and any supported orientation needed for faithful restoration, filter, view choice, selected opaque ID, card-open state and list position in ephemeral local UI context. Keep source references/media out of navigation parameters and tile requests. Do not key/remount the map on selection or committed list changes.
- Invalidate stale selection/media on permission loss, disconnect, deletion or replaced committed projection. Revalidate identity before returning from background/correction. A unique valid successor may reopen; rejected, split, merged or ambiguous context closes with “This journey changed; choose it again.” Preserve valid viewport/filter and clamp list position to surviving items.

## Preview, media and correction completion

The adopted preview SPEC and its companions remain normative, including all A1–A17 checks. The existing four-entry detail preview does not satisfy the viewer requirement. Implement a selected-journey, stable-order, deduplicated, bounded page contract for eligible associated photos and videos, load more on demand, and distinguish gallery from item view. Back from item goes to gallery; Back from gallery goes to the same selected card. Video requires explicit Play, starts muted, stops on item/viewer close or background, and never advances automatically. No cloud download is introduced.

Correction entered from the card returns directly to preserved Atlas context. Refresh from the committed projection after save before deciding selection validity. Do not rely on display-ID equality alone to infer successor identity. Existing correction logic owns persistence and lineage; this change owns safe presentation and return.

## Recovery and accessibility

| State | Required presentation |
| --- | --- |
| Map module/style/tile load failure | Inline map-unavailable message, reachable Timeline with same filter/content, and bounded explicit retry. Media/correction do not depend on tiles. |
| Offline | Retain local list and permitted media; show map availability accurately without promising cached tiles. |
| Empty year | “No journeys in this year” and All years control; no decorative fabricated points. |
| Sparse record | “No journey revealed yet,” evidence explanation and useful import/recheck/manual path; diagnostics may sit behind local-record details. |
| Processing | One concise updating cue; last safe projection is explicitly identified and stale actions are gated. |
| Restricted/disconnected | Explain source restriction and reconnect route; block revoked media immediately, including already visible items. |
| Changed selected journey | Clear stale card/viewer, retain valid exploration context and show changed message. |

Respect safe areas, keyboard/screen-reader order, minimum targets, platform Back, OS text scaling and reduced motion. Basemap attribution and card close must not overlap. Announce selection with title/date/status; restore focus to the selected control or changed-status message. No task depends on drag, color or animation. Adapt a tall card for small screens rather than covering every usable map interaction area.
