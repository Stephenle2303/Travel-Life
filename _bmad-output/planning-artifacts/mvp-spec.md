---
title: Travel Life working MLP specification
status: working-decisions
revision: 7
updated: 2026-10-07
strategy: build-then-learn
platforms: [ios, android]
---

# Working MLP specification

**Current direction:** Minimum Lovable Product (MLP) supersedes the old MVP
release bar. Decision [0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md)
defines the first loop: a private lifetime map reveal, an owner-previewed replay,
and a deliberately chosen share. The user removed pre-launch market
research/interviews as prerequisites and selected both platforms. See
[decision 0002](../../docs/decisions/0002-mvp-first-delivery.md) for
agent-selected technical defaults and their limitations.

## Promise and scope

Help a traveller reconstruct a useful, correctable record from available photos.
The first loop is **connect → reconstruct → private lifetime reveal → replay →
explore/correct → deliberately share a selected highlight**.

Required P0 scope: shared iOS/Android app; native access/selection; resumable metadata
import; private persistence/deletion; local reconstruction plus optional AI assistance;
map/timeline/details; a private lifetime replay video; supportable counts;
correction/manual exceptions; scheduled background maintenance with foreground
catch-up/rescan; interactive journey or selected-lifetime-highlight publishing and
browser viewing; minimal instrumentation/feedback; beta builds and real-device/browser
checks. P1: static share card and the first post-rollout evidence review.

Excluded: historical Google Photos connector, second source, cloud history backup,
email account signup, precise travelled distance, proven routes, exact unobserved
travel duration, a longer cinematic editor, personality types, recommendations, Pulse,
payments and community. Background maintenance is required in this MLP.

## User flow and UI decisions

1. Explain the local record, available photo access, source limitations and optional
   cloud AI separately. No email/signup wall for the local product.
2. Request broad photo-library permission at the point of import as the primary
   path, then enumerate accessible assets without individual photo selection.
   Offer supported limited/selected-photo import for users who do not want broad
   access; respect their choice without repeated expansion prompts. Denied users
   can still see an example or create a manual entry. If platform/distribution
   rules prevent broad access, disclose that limit and offer supported selection.
   Photo permission does not authorize cloud AI processing. See
   [decision 0003](../../docs/decisions/0003-library-access-default.md).
3. Show import progress/counts and cancel/resume. Report accessible, scanned, geotagged
   and unavailable assets; never equate permission to complete lifetime coverage.
4. Reveal the owner's available lifetime journeys on an interactive map with inferred
   status and source scope, then offer the Travel Life Replay.
5. Use Map and Timeline views with a shared selection and year filter.
6. Journey detail shows observed date span, destinations, media, evidence reasons and
   uncertain photo assignments. A photo can be a trip memory without supporting a visit.
7. Let the owner confirm/reject, rename/edit/regroup, assign or remove photos,
   remove places and add exceptions without reviewing every photo individually.
8. Settings provide automatic-maintenance controls, last checked/updated status,
   foreground catch-up/rescan, AI controls, privacy controls, disconnect and deletion.
9. Share a Journey or selected lifetime highlight by choosing facts and memories,
   previewing the exact content, then deliberately publishing an interactive browser
   link with owner revoke/republish controls. Preview and explicitly export the
   replay video through the native share sheet.
10. Offer lightweight usefulness/error feedback during actual use.

Use readable native-style components, accessible labels and touch targets, light/dark
themes, and a list alternative to the map. Loading, empty, partial, failure, revoked,
unavailable-media and offline states are mandatory. Elaborate visual design is not
a prerequisite; refine it while delivering these screens.

## Minimal data contract

- **Evidence:** stable local ID, source asset reference, media type, available timestamp
  with precision/timezone provenance, nullable GPS and available location accuracy,
  accessible/missing status, evidence category when actually known, normalization
  version and duplicate-family reference. Unknown origin stays unknown; duplicate
  copies are not independent visit support.
- **Place:** stable spatial ID, supporting geotagged evidence, approximate position,
  coarse label and country result or unknown. A place can have multiple visits.
- **Visit:** ID, place ID or unknown, supporting evidence IDs, observed time interval
  and precision, inferred/confirmed/rejected status and reason codes. A geotagged
  visit draft does not prove the owner was physically present.
- **Journey:** ID and identity lineage, ordered visit IDs, observed span, optional
  owner-confirmed bounds/title, inferred/confirmed/owner-entered state, inference
  version and visibility. Confirmation covers reviewed facts at their versions.
- **Photo-to-journey association:** evidence ID, candidate journey ID(s) or
  unassigned, suggested/accepted/rejected state, rule/AI/owner decision source,
  reason codes and evidence/correction versions. Association is distinct from
  photo-to-visit support. Accepted means included in a private draft; it is still
  inferred unless the owner has reviewed it. One photo has at most one accepted
  primary journey; unresolved alternatives do not contribute to counts.
- **Photo-to-visit support:** evidence ID, visit ID, support reason, origin/precision
  limits and evidence version. A trip-only memory has no such link; duplicate-family
  copies contribute at most one independent support unit.
- **Correction:** target ID and stable evidence/association/boundary scope, action,
  owner-entered values, prior value/undo information under retention rules, time,
  version and identity lineage. Replay after inference; surface remapping conflicts
  instead of dropping a correction or applying it to the wrong successor.
- **Usual area:** optional owner-confirmed area and effective period; multiple areas
  and historically unknown periods are allowed. A current home is not retroactive.
- **Import/run:** checkpoint, accessible scope, counts, algorithm/prompt/model versions,
  sanitized latency/cost and failures. Raw evidence traces remain private.
- **Manual journey:** an owner assertion, distinct from engine recovery and photo support.

Store in SQLite with migrations. The Personal Travel Graph is this canonical linked
representation, not a requirement for a graph database. Original media remains in
the source; cache only what the actual UI needs and clear covered caches on deletion.
Document OS backup behavior and use platform data protection; do not call ordinary
SQLite encryption unless encryption has actually been enabled and tested.

## Initial reconstruction rules

These are fixed, versioned `reconstruction-v1` MLP defaults, not validated weights
or calibrated confidence. Keep inferred results reviewable. [Decision 0007](../../docs/decisions/0007-reconstruction-v1-parameters.md)
defines exact comparisons, tie-breaks and boundary examples; M2.1 implements that
contract rather than choosing its values during coding.

### Prepare evidence

- Preserve capture timestamps at their available precision and timezone provenance.
  File-import time is not a substitute for available capture time. Compare time
  intervals; if timezone or date precision makes ordering or a gap indeterminate,
  preserve an uncertain boundary rather than inventing a local day.
- Preserve known provenance and deduplicate copies for support counts. A library
  asset, shared photo or downloaded file can be a memory without proving the owner
  was present. Known unsupported downloads cannot independently establish a visit;
  unknown origin remains uncertain rather than silently becoming original capture.
- Apply exclusions and owner corrections before generating new support or links.
  Missing GPS remains unknown; no unsupported image/location guess supplies it.

### Form places, visits and trip candidates

- Cluster geotagged support units into approximate places using a 5,000 m maximum
  pairwise Haversine separation. Exclude fixes known to be less accurate than
  5,000 m; unknown accuracy remains marked. Sort eligible units by latitude,
  normalized longitude and stable ID, then assign each to an eligible cluster
  minimizing its resulting maximum pairwise distance; tie by smallest member ID.
  Rebuild an affected component from final evidence after a late addition. This
  avoids chains across a city and makes final membership independent of import
  order. A place is not a canonical city or a visit episode.
- Form chronological visit episodes separately from reusable places: a return to
  A after visiting B remains A → B → A, and the same hotel months later is another
  visit. The same-place consecutive observation gap is at most 48 elapsed hours
  when both capture instants and offsets are known, or one recorded civil day
  otherwise, with no
  ordered intervening B or owner boundary. An automatic visit's first-to-last
  observed date difference is capped at 30 days, even with daily photos.
  Unreliable within-day order stays unknown.
- Link adjacent visits into an inferred journey draft at most 72 elapsed hours
  apart when both capture instants and offsets are known, or two recorded civil
  days otherwise, and only while first-to-last observed date difference is at
  most 30 days.
  This is a draft link, never proof of continuity or a forced boundary. Beyond a
  link limit or the 30-day cap, immediately adjacent segments at most 240 elapsed
  hours apart when instants/offsets are known, or ten recorded civil days otherwise,
  get a non-transitive possible-merge relation. Longer gaps remain
  separate drafts that the owner can merge. Missing photos do not determine travel.
- An owner-confirmed return/split is a binding episode boundary until the owner
  changes it. A photo near a usual area is only contextual evidence: an airport,
  transfer, wrong geotag or imported image can appear there without proving return.
  A provisional fifty-kilometre near-home band labels local context only within a
  confirmed area's effective period. Eligible local visit observations cannot
  automatically bridge two nonlocal segments; they may leave a possible merge.
  Known unsupported downloads cannot create that boundary signal. Preserve local excursions;
  without a confirmed area, use neutral candidates rather than asserting travel.
- Transit, long stays, moves and changing residences remain reviewable. Use offline
  country geometry with a versioned dataset; invalid/border coordinates and
  unresolved places may remain unknown with neutral labels.

### Associate photos and apply corrections

- Associate a photo to a candidate journey only when its comparable capture time,
  available location and bounded surrounding context are compatible with that
  journey and no owner boundary or exclusion conflicts. Geotagged evidence may
  support a visit; journey membership alone does not add destination or presence
  support. An eligible geotagged support unit joins an inferred draft through
  its visit when the visit belongs to one journey; possible journey links leave
  photo membership suggested/unresolved. Known unsupported downloads, unusable
  GPS fixes and conflicting duplicate metadata cannot create visit support and
  receive at most a time-bounded memory suggestion. Preserve separate reasons
  for visit support and journey membership in the UI.
- Automatically include a GPS-less photo as an inferred trip memory only when a
  precise capture instant with offset is strictly bracketed by two independent,
  ordered geotagged supports of one journey, each within 24 hours, with no
  compatible competing journey, owner boundary or exclusion. Its location stays
  unknown and it adds no visit support. Otherwise suggest it only when one
  compatible candidate's observed span padded by one calendar day includes the
  photo's capture day and the nearest supporting visit is within three calendar
  days. Day-only or unknown-offset times may suggest but never auto-include.
  Multiple candidates remain unresolved; no capture date remains unassigned.
  Do not require review of every photo or fill a whole date span with assumed members.
- Keep association status separate from who made the decision; suggested,
  accepted and rejected are not calibrated probability bands. Owner assignment,
  exclusion and explicit split/merge constraints take precedence over inference.
  One photo cannot inflate counts through multiple accepted primary journeys.
- Corrections survive restart, rescan and late evidence. Track identity lineage
  when trips split or merge; unresolved correction remapping stays pending instead
  of silently losing an edit. Confirmation applies only to reviewed facts and
  memberships; later photos, destinations and date extensions remain inferred.
- Observed photo span is not departure/return duration; destination sequence is not
  an actual travelled route. Suppress exact travel-day and distance totals initially.
  Count inferred and confirmed/owner-entered facts distinctly; sharing defaults to
  confirmed/owner-entered facts and owner-selected media.

The small M2.4 regression set must encode these expected decisions before engine
implementation; they are product rules, not measured accuracy claims.

| Evidence situation | Expected draft behavior | Unsupported assertion |
| --- | --- | --- |
| Tokyo day 1, Kyoto day 6, no intervening photos | Keep both visits and a bounded possible-merge relation for owner review | Silence proves either one trip or two |
| Trip A, owner-confirmed return, Trip B two days later | Keep two episodes | Short gap overrides the owner boundary |
| One imported home-located image between overseas visits | Keep the home signal uncertain | Coordinates alone prove return |
| A → B → A in one trip, or the same hotel months later | Keep distinct chronological visits to the reusable place | Same place means same visit |
| GPS-less photo precisely bracketed within 24 hours on each side by one journey's independent supports | Include inferred trip memory; location remains unknown | Membership proves a destination |
| GPS-less day-only photo near one bounded candidate | Suggest trip membership; location remains unknown | Date-only support is enough for automatic inclusion |
| GPS-less photo compatible with two candidates | Keep alternatives or leave unassigned | Pick one arbitrarily |
| Companion photo or known unsupported download with plausible metadata | Preserve context and allow illustrative trip media; do not infer owner presence from it | Matching metadata proves a visit |
| Owner moves to a new usual area | Apply each confirmed area only in its effective period | Current home classifies all history |
| Late evidence extends a confirmed journey | Keep reviewed facts confirmed and mark additions inferred | Confirmation automatically covers additions |
| AI response arrives after an edit | Discard or revalidate against current revisions | Stale proposal overwrites the edit |

Refine these defaults from real corrections after rollout. Version rule changes
and test full versus incremental rebuild behavior before applying them to existing
records. See [decision 0006](../../docs/decisions/0006-photo-trip-assignment.md).

## AI contract

Use the initial model snapshot from decision 0002 through a protected server proxy.
The model assists ambiguous eligible visit/journey grouping and plain-language
labels/reasons for already supported candidates. It does not prove owner presence.

Send coarse place labels or neutral place IDs, relative day offsets, support counts
and evidence categories. Derive any needed coarse relationship and hard-boundary
flags locally; send only bounded eligible alternatives. If the privacy-safe summary
cannot distinguish alternatives, retain local ambiguity instead of asking AI to guess.
Keep source asset IDs mapped locally; cloud IDs are opaque per request. No original
images, thumbnails, names, filenames, exact coordinates or
absolute travel dates are included in the MLP AI payload.

Return a strict structured proposal with existing IDs and reason codes. Validate
shape, evidence references, eligible relationships and owner constraints on server
and client; unsupported destinations/dates, invalid outputs and prompt-injection
instructions are rejected. Bind proposals to evidence, correction, rule and consent
revisions; discard or revalidate responses that became stale before application.
AI cannot execute actions, publish records, establish owner presence, convert trip
membership into visit support or override corrections. The inference input is data.

Show the processing explanation and collect opt-in before the request. Declining AI,
provider failure, refusal or exhausted quota uses the local baseline with a visible
AI-skipped state. Use store:false and no request-body logs; disclose actual provider
retention without claiming zero retention. AI is implemented in the MLP, but local
exploration does not become unusable if it is unavailable.

Map providers can receive ordinary map-service traffic when the map is used.
Disclose this separately; do not market the entire app as fully offline/on-device.
The history list and local record remain usable without network access.

## Background maintenance contract

Background photo-library maintenance is required P0 on both platforms after the
initial import, with an enable/disable control. See
[decision 0004](../../docs/decisions/0004-background-maintenance-in-mvp.md).

Persist asset/revision indexes, queued changes, checkpoints and last checked/updated
state. Process new/changed and late historical evidence in bounded work, updating
affected journeys while preserving confirmed/manual records, association decisions,
corrections and exclusions. Expand the affected dependency neighborhood to convergence
or checkpoint it as pending; do not publish a partially reconciled result as final.
Where final evidence, rule version and corrections match, incremental and full
reconstruction must agree. New facts on confirmed journeys stay inferred until reviewed.
Limited permission is not proof of source deletion. Do not download or infer unchanged
media repeatedly; bounded metadata reconciliation is allowed where change feeds are limited.

Workers run from persisted state without UI, checkpoint before expiration and serialize
concurrent work. Disable/disconnect/revocation/deletion stops future scheduling.
System scheduling and user termination can delay updates; expose pending/restricted
states and catch up on foreground resume. Keep manual rescan. No fixed cadence,
immediate new-photo trigger or continuous GPS tracking is promised.

Local updates do not require AI. Background cloud AI needs consent covering automatic
requests and the existing rate/budget controls; otherwise defer enrichment to foreground.
Show an in-app new/updated-journey indicator; push notifications remain optional.
No shared artifact is automatically published or updated.

Verify handlers and actual scheduling separately on physical iOS/Android devices.

## Interactive lifetime sharing and replay contract

Interactive sharing and the Travel Life Replay are required P0. Static cards are
P1. See [decision 0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md).

Choose either one journey or an owner-selected lifetime date/place/media subset,
preview and confirm visible facts, then publish a versioned snapshot and
copy/native-share its URL.
Recipients can explore the map, timeline and selected memories in a browser without
installing the app or signing in. A list works when map services fail. Create Yours
is an optional acquisition path, not a prerequisite for viewing.

Default links are unlisted and accessible to anyone possessing the URL; they can
be forwarded. No public feed, searchable profile or recipient-authentication system
is added. Use a high-entropy token, explicit displayed expiry (thirty-day working
default), owner republish/revoke controls, no-index requests and limited caching.

Publish only selected sanitized fields and approved optimized media derivatives.
Coarse places and month/year or relative day labels are the default preview; any
greater detail is deliberately chosen. Strip EXIF/source IDs/local file references.
Private library storage remains local; the selected remote sharing copy is an
explicit exception, separate from cloud-AI consent.

Use owner-protected snapshot records and private storage with token-checked reads
for both fields and media. Revoke/expiry must block future server access, not merely
hide the page while leaving media URLs public. Background changes never update a
published snapshot automatically. Delete-all also queues remote revocation and
clearly shows pending status while offline; recipients' downloaded copies cannot
be recalled. Protect owner controls and retain pending revocation credentials.

The initial viewer uses React/TypeScript + Vite with Vercel static hosting, the
existing Supabase backend/storage and Google Maps JavaScript for browser map
interaction. These are working defaults, not already configured services.
The mobile app remains the core product.

The P0 replay is a 30–60 second (target 45-second) 720p silent MP4 using only
chronological observed destinations and owner-visible eligible photos. Preview and
cancel before native export; any upload to the hosted highlight is a separate owner
action. It uses destination transitions rather than claiming travelled routes, and
does not require AI narration or music. Sparse or uncertain libraries receive an
honest partial reveal, never synthetic history.

## Rollout instrumentation and hypotheses

Remote analytics are opt-in and use an allowlist: event name, build, platform, coarse
counts/status, anonymous session and timing buckets. Never attach raw media, exact
locations, trip dates, filenames or free-form record contents. Feedback text and
case sharing are separate deliberate submissions with access/retention controls.
Choose a default thirty-day retention for anonymous beta events and enforce deletion;
AI-provider retention is a different policy.

| Hypothesis | Signal in the shipped product |
| --- | --- |
| H1 permission | Explanation → permission → accessible import, with denial/limited-access denominators |
| H2–H3 reconstruction/presence | Rejected/edited journey rates, stated reasons and separately opted-in cases; not complete accuracy estimates |
| H4–H5 value/exploration | Map reveal → replay played/exported → meaningful independent navigation; optional usefulness response |
| H6 identity | Optional profile/share selection and direct feedback; deeper identity features are later |
| H7–H8 sharing/acquisition | Publish/share selected highlight → browser open → optional Create Yours → connection, with attribution limits; static-card signals separate |
| H9 maintenance | Scheduled check/update outcomes, new-evidence opportunities, correction persistence and foreground catch-up; actual timing measured separately |
| H10 retention | Return sessions with new-photo/trip opportunity where known; distinguish no opportunity from no interest |
| H11–H12 intelligence/revenue | Untested in this MLP; do not interpret map engagement as willingness to book/pay |

The operational activation proxy is import completed → map reveal shown → replay played
or journey opened.
Call it a proxy; it does not prove accuracy or meaningful value by itself.
Use correction signals, feedback and observed behavior together to prioritize the next
iteration. Market rollout is the learning mechanism; no recruitment quota or interview
programme blocks development.

## Minimum Lovable Product release checks

- Core flow runs on real iOS and Android devices with accessible sample evidence.
- Permission limits/revocation, missing GPS/media, interrupted background tasks and
  foreground recovery are handled; manual and corrected history survives delta updates.
- Inference is labeled; unsupported AI claims are rejected; photo membership stays
  distinct from visit support, and corrected/manual history survives.
- Local deletion, visibility, credential protection, AI consent and budget limits work.
- Hosted journey links work without installing the app; token/owner isolation, selected
  media access, snapshot stability and remote revoke/expiry/deletion behavior are checked.
- Lifetime replay preview, cancellation, 30–60 second 720p output, playback and native
  export work on both platforms without creating a route/duration claim.
- Applicable software tests and the small engine regression cases pass; actual model
  checks are recorded if the service is enabled.
- Signed builds, service configuration, map keys and feedback/disable controls exist.
- Distribution/access disclosures reflect actual behavior; no unsupported accuracy,
  completeness, zero-retention or route/duration claims.

We do not require a large real-data holdout, trained confidence calibration, a validated
LLM judge, completed interviews or proof of demand before a bounded beta. Those grow
as real evidence arrives. Do not substitute these checks for measured population quality.
