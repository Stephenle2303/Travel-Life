# Acceptance and verification

All cases use synthetic fixtures for automation. Private device checks record only aggregate outcomes. The adopted preview acceptance A1–A17 also applies; a styling pass cannot waive its missing implementation.

| ID / capability | Given | When | Then |
| --- | --- | --- | --- |
| R1 / CAP-1 | Ready Atlas at 390 × 844 with default text | Open Map | Header, compact summary/filters, meaningful map and journey heading appear before scrolling; no large explanatory panels precede the map. |
| R2 / CAP-1 | Totals available, zero supported countries, or missing totals | Read summary | Values carry inferred/current-record wording; unknown is not rendered as zero; text wraps without overlap. |
| R3 / CAP-1 | Coverage/provider details collapsed | Open and close About your Atlas | Full source-scope, incomplete-history and map-request explanation is one action away; focus/scroll returns to trigger; attribution stayed visible. |
| R4 / CAP-2 | Broad and close zoom with supported style | Explore coastline, roads and labels | Muted geography remains legible, minor detail is restrained, labels orient without overwhelming points, and required attribution remains readable. |
| R5 / CAP-2 | Several ordinary points | Select one then another | Exactly one has citrus/ring selection treatment; ordinary points are quiet and selected state is also accessible. |
| R6 / CAP-2,4 | Overlapping/coincident anchors or cluster | Tap target | Explicit chooser or expansion appears; no first-feature auto-selection; identical anchors remain choosable; count means filtered anchored journeys. |
| R7 / CAP-3 | Owner-titled, untitled, confirmed and pending journeys | Scroll list | Rows show correct safe title and committed worded status without full detail/media loading; no invented place or ordinal product title. |
| R8 / CAP-3 | Long owner title and uncertainty annotations | Render row | Title/metadata scale and wrap; required date/location/order/status information remains reachable; selected row uses restrained accent. |
| R9 / CAP-3 | Multi-year, overlapping and unknown-date journeys | View All years and each year | Each journey appears once in All years; observed-year intersections filter correctly; unknown/uncertain records remain labelled; owner dates do not move groups. |
| R10 / CAP-3,4 | Scrolled list, selected journey and moved camera | Switch Map/Timeline twice | Same valid year/selection/list position and camera restore; switching alone does not reset camera or scroll to selected row. |
| R11 / CAP-4 | Map preview open | Drag/pinch, tap empty map, tap X in separate cases | Gestures preserve selection; empty tap/X dismiss only card; camera/filter remain; close returns focus predictably. |
| R12 / CAP-4 | Selected journey with eligible photo or video-only media | Open card | One real local photo or labelled video placeholder appears, facts retain provenance, X is reachable, media action is primary and correction secondary; no autoplay. |
| R13 / CAP-4 | A loading, then B selected; rebuild/access loss occurs | Resolve A after B or lifecycle change | No stale title, preview, count, error or media from A appears on B or after revocation; current recovery is explained. |
| R14 / CAP-4 | More than one media page, mixed association states | Load pages and inspect members | Stable bounded deduplicated pages contain eligible visit-support/accepted memories only; suggested/rejected/excluded/conflicting associations are not accepted album members. |
| R15 / CAP-4 | Available local photo and video | Open photo, Back; open video, Play, background, Back twice | Item → gallery → selected card hierarchy works; video starts only on Play, muted, pauses on background/close and never plays next automatically. |
| R16 / CAP-4 | Card-origin correction, changed camera/year/list position | Return unchanged or save title/date | Committed updated card/unique valid identity restores camera, filter, choice, position and focus directly. |
| R17 / CAP-4 | Card-origin reject/split/merge/ambiguous remap | Save and return | Refresh committed record first; stale selection closes, valid viewport/filter stays and changed message appears; no ID-equality guess. |
| R18 / CAP-5 | Native module missing, style/tile failure or offline | Open Atlas and retry | Explicit map recovery and same local Timeline/content remain usable; retries do not loop or block media/correction. |
| R19 / CAP-5 | Empty year, sparse, processing or restricted record | Explore recovery | State-specific truthful copy and useful action; no invented records or post-revocation media. |
| R20 / CAP-5 | Narrow device, landscape, large OS text and screen reader | Use map/list/card/info/gallery/correction | No clipped essential control, overlap with safe area/attribution, color-only state or gesture-only action; logical focus and labelled controls. |
| R21 / CAP-5 | Reduced motion enabled | Select/dismiss/change filter | No unnecessary sheet/camera animation; all interactions remain available. |
| R22 / CAP-2,3,4 | Dense synthetic history with 1,000 rows | Scroll, select, filter and inspect requests | Virtualized/otherwise bounded row work; no full-detail or media reads during list scrolling, no full-library decoding; source IDs/media/private journey data absent from tile requests and telemetry. |
| R23 / CAP-1,2 | Development and release configurations | Inspect style/source wiring | Renderer remains MapLibre; no new billing/account/Google-key prerequisite; demo source cannot silently become production configuration; attribution and disclosure match actual source. |

## Implementation verification gates

- Automated: row grouping/filter/unknown ordering and counts; committed summary provenance; map/list state and return; overlap/empty-tap semantics; style contract and selected visual state; async A→B/revocation; media paging/membership; video lifecycle; correction successor/removal; recovery transitions. Tests must assert user behavior, not just snapshots of JSX.
- Visual: capture synthetic populated/selected/dense/empty/large-text screens on iOS and Android. Inspect hierarchy, selected-point contrast, card geography visibility, text overflow, attribution, safe areas and quiet list styling. Compare against the visual companion and official prototype composition.
- Native: exercise actual point hit testing, pan/pinch vs taps, Back, media availability and explicit playback/background pause on both platforms. Missing device results stay unverified; mocked native components cannot establish these cases.
- Boundaries: inspect style sources/requests, local repository paging, URI lifetime and telemetry calls using synthetic evidence. No private screenshots/raw identifiers enter Git.
- Commands after implementation: `npm --prefix apps/mobile run check`, `npm run check`, and `git diff --check`. Report test, typecheck, lint and Expo Doctor outcomes separately; tooling failures do not pass a gate.
- This requirements-only change: verify kernel/companion links, capability IDs, GWT rows, source-claim preservation, root `npm run check` and whitespace. No runtime or device success is inferred from document checks.

## Completion bar

The implementation record must map every R case and inherited A case to evidence or an explicitly pending device check. Do not call the whole feature implemented while bounded full-gallery paging, an actual over-map card, overlap choice, projection invalidation, camera restoration or correction identity handling remains missing. Provider production readiness is separately gated and must not be claimed by a visual refresh.
