# Acceptance and evaluation matrix

All scenarios use Given/When/Then. Public automated data is synthetic; owner-case
validation stays local. This supplements, not replaces, parent AC-01..AC-64.
Automated fixture checks establish contract behavior only. Private rows below are
required device outcomes, currently pending, not claimed reproduced inputs.

## Diagnosis and continuous episodes

| ID | Given | When | Then |
| --- | --- | --- | --- |
| TC-01 | Current completed run with several trip fragments | Inspect each proposed edge | Same-generation versions, time class, context and all blockers explain the decision without raw export |
| TC-02 | Failed/skipped/stale rebuild after a policy change | Inspect Atlas and diagnostics | Prior completed generation is identified; no new-engine success claim |
| TC-03 | Four corroborated away blocks under qualifying links | Reconstruct | One trip, four retained destination blocks, one combined eligible album |
| TC-04 | Compatible same-day places with unknown internal order and adequate independent support | Reconstruct | One unordered episode; no manufactured order, session count or elapsed span |
| TC-05 | Compatible instant-bearing and civil-day evidence | Reconstruct | One episode where parent time/link predicates permit; no precision-based partition |
| TC-06 | Incomparable mixed times or contradictory overlapping locations | Reconstruct | Exact uncertainty/conflict reason; no automatic pooled qualification |
| TC-07 | A holiday revisits the same place after another city | Reconstruct | Revisit retained within one qualifying episode |
| TC-08 | Compatible continuous support crosses month or 30-day work chunk | Reconstruct | One semantic trip; truthful observed month range |
| TC-09 | Supported episode with GPS-less memories or unresolved region name | Reconstruct | No boundary from those missing fields; media follows parent unique bracket rules |
| TC-10 | Same-country, same-month holidays with corroborated home return | Reconstruct | Two trips, even when other similarity signals favor merge |
| TC-11 | One isolated home geotag inside an away sequence | Reconstruct | Uncertain affected link, not a proven return or forced continuous merge |
| TC-12 | Gap at 18h, 72h, 10d and immediately above each | Reconstruct with each context combination | Exact parent link/boundary result and reason; conditional rules do not become unconditional |
| TC-13 | Same country/month but a longer ambiguous gap | Reconstruct | No silent merge; unresolved owner-example failure blocks activation or requires tested policy amendment |
| TC-14 | Twelve-day photo-heavy holiday plus dated configured homes | Reconstruct | Holiday cannot become its own rejecting base; both context consumers agree |
| TC-15 | Earlier holiday, later residence in that area | Reconstruct | Later home is not applied to earlier dates |
| TC-16 | Two concurrent homes and selected-library access | Reconstruct | Both configured areas apply; no averaging or absence-based automatic residence learning |
| TC-17 | No applicable home period | Reconstruct | One deduplicated era-setup opportunity; no per-fragment confirmation flood or false automatic classification |
| TC-18 | Owner split/reject/edit/manual trip and changing evidence | Reconstruct | Exact-scope decisions survive; ambiguous remap pins prior effective projection without duplicate publication |
| TC-19 | Same final input via shuffled/full/incremental/repeated imports | Reconstruct | Identical decisions, memberships and stable unchanged identity |
| TC-20 | Qualified episode with several destination dots | Open each dot and list row | Same trip preview and combined album; trip count increments once |

## Home selection and management

| ID | Given | When | Then |
| --- | --- | --- | --- |
| HB-01 | Long journey list | Open Homes from Atlas header | Management reachable without scrolling |
| HB-02 | Candidate journey with accessible photos/videos | Select it | Immediate preview includes observed dates, map, paged grid and areas; nothing saved |
| HB-03 | Multi-area journey whose first visit is not home | Select another area and save | Persist explicitly selected medoid/scope; first visit cannot override it |
| HB-04 | Single-area journey | Open preview | Explicit area choice and final confirmation required |
| HB-05 | Selected area plus other journey areas/GPS-less media | Browse area grid | Area-backed media highlighted; other and unknown-location groups remain distinct |
| HB-06 | Several loaded grid pages and selected area | Open photo/video, then Back/Close | Same area/form/grid position restored; Close fully visible with safe area/large text |
| HB-07 | No qualified journeys, but observed home photos | Add from photos | Canonical observed areas available independently of Atlas trip filter |
| HB-08 | Existing home whose source journey vanished | Open/Edit/Remove | Entry remains manageable; media unavailable state is honest; no source-journey dependency |
| HB-09 | No usable photo candidate | Choose on map | Explicit pin and visible area scope lead to same confirmation without location permission/address service |
| HB-10 | Map tiles unavailable and no usable observed geographic context | Try direct setup | Useful retry/limitation; no blind blank-map save |
| HB-11 | New area or existing 50 km legacy row | Review scope | New 20 km default visible; legacy radius preserved with review notice; no silent resizing |
| HB-12 | Optional/open date endpoints, impossible date or reversed dates | Edit form | Valid inclusive intervals accepted; invalid dates block Save inline |
| HB-13 | All-history or current-home scope | Confirm | All-history explicitly acknowledged; current-home start explicit; journey dates not treated as residence dates |
| HB-14 | Two configured homes with overlapping periods | Save and rebuild | Independent areas apply; neither replaces or averages the other |
| HB-15 | Selected candidate changed after preview | Save observed selection | Typed stale-selection result, reload/reselection, no fallback coordinate |
| HB-16 | Permission revoked or media fails during preview | Load/open media | No stale thumbnail leakage; clear state, safe Back and validated selection rules |
| HB-17 | Unsaved selected area/form | Back or dismiss | No configuration mutation |
| HB-18 | Journey containing home and away media | Save home and rebuild | Only within-scope/date home evidence excluded automatically; away media remains eligible and originals remain |
| HB-19 | Unknown-GPS/date photos and an owner-confirmed record | Rebuild after home update | No guessed home membership or silent destruction of owner decisions |

## Save, publication and device outcomes

| ID | Given | When | Then |
| --- | --- | --- | --- |
| OP-01 | Valid confirmed selection and slow storage | Tap Save repeatedly | Immediate acknowledgement; one idempotent committed operation |
| OP-02 | Rebuild already active | Save a new home | Durable pending revision queues; no lost update or false success from skipped rebuild |
| OP-03 | Several committed Home edits during rebuild | Worker finishes | Newest requested revision recomputes; completion only when it is active |
| OP-04 | Large library | Rebuild | Bounded yielding, responsive Back/navigation, actual phase/count progress; no invented ETA/percentage |
| OP-05 | Process killed after save/before generation commit | Restart | Saved home and pending update retained; prior Atlas shown until resumed completion |
| OP-06 | Storage failure versus reconstruction failure | Save/retry | Typed distinct states; failed storage does not claim saved; failed rebuild does not repeat home insert |
| OP-07 | Evidence/context/correction/source changes during work | Commit | Stale generation cannot publish; queued updates preserved |
| OP-08 | Disconnect/revoke/delete during work | Late task completes | No stale publication; deletion clears home/generation/pending state and cannot be rolled back into existence |
| OP-09 | Migration from supported historical schema including current 30 | Upgrade | Homes/radii preserved, new revisions initialized honestly, tests/version mocks updated |
| OP-10 | New generation and current owner edits | Activate/rollback | Complete atomic projections and latest owner decisions; no partial list/count/media mix |
| OP-11 | Synthetic island/admin-region inputs and unknown naming | Resolve titles | Supported region/country or truthful fallback; naming failure never splits trip; location/month visually separated |
| DV-01 | Owner-labeled four April 2024 fragments | Rebuild/activate validated policy locally | Exactly one automatic holiday, combined eligible media and supported destinations |
| DV-02 | Owner-labeled two September 2025 fragments | Rebuild/activate validated policy locally | Exactly one automatic holiday; Bali/Indonesia title only if verified local geometry supports it |
| DV-03 | Owner-labeled two February 2022 fragments | Rebuild/activate validated policy locally | Exactly one automatic holiday, with historical home context appropriate to that period |
| DV-04 | Owner's Home setup on Android and target iOS device | Preview/select/save/view Atlas | Correct area visibly confirmed; grid/video/Close/Back/progress functional; applicable home noise removed |
| DV-05 | Other affected trips and repeated-holiday negative controls | Compare baseline/candidate locally | No hidden false-merge/omission regression masked by the desired 4/2/2 count reduction |

## Evidence report

For each scenario record implemented/tested/device-pending/blocked and command or
private evidence reference. Never tick owner outcomes using synthetic substitutes
or manual merges. A changed gap policy requires its own versioned edge cases and
comparison record. Capture false splits, false merges, omissions and action burden
with denominators on a labeled local sample. Root/mobile checks and native platform
checks are separate from product-quality evidence; unfinished metrics remain
`not_measured`. Existing parent release targets remain targets, not measured facts.
