# Continuous trips and the Atlas album experience

Status: final planning recommendation from the owner's requested BMAD party.
Date: 2026-10-16. Implementation and device acceptance pending.

## Required fix: shared temporal home context and episode continuity

Planning update requested after the September fragments remained separate. This
section defines delivery requirements against the existing V1.1 contract;
application code and canonical gap thresholds are unchanged by this update.

### Current implementation, verified from repository.ts

Qualification excludes candidate places, selects a place with at least twelve
distinct captured days over the entire library, and ranks by day count then ID.
It uses that place's representative coordinate. Merging instead uses every place
with twelve captured days, including candidate places, and tests distance against
the nearest of those places. These policies disagree. A holiday photographed on
twelve days can become its own base in merging, producing zero away distance.
Conversely a city lived in years later can invalidate an earlier trip there.
Places are small geographic clusters (maximum 5 km separation), so ordinary life
spread around a city may never reach twelve days in any one cluster.

Neither path requires residence periods, return excursions, a date window,
full-library coverage or exclusion of the candidate's evidence in a shared
context model. Neither is a verified detector of the owner's home. No claim is
made that any one of these predicates caused the private September failure.

### Requirements and acceptance

1. **Explain the actual run first.** Persist generation-bound local diagnostics:
   engine revision, completed/failed/stale generation, candidate base counts,
   applicable-base interval coverage, normalized chronology class, adjacency
   relation and all blocking reason codes. Include candidate-self-base,
   no-applicable-base, home-observation, owner-boundary, routine, time-conflict,
   ambiguous-gap and gap-over-limit. Identify each displayed journey with a
   local diagnostic token. Diagnostics must explain this pair's non-join after
   a rebuild without exporting identifiers, coordinates or media. They belong in
   development/About inspection, not the normal journey list.
2. **One shared home-context authority.** Episode construction and qualification
   consume the same date-scoped base set. Use the canonical 20 km macro areas,
   reliable capture units, candidate exclusion and two-pass context evaluation.
   Follow algorithm.md's 180-day window, twelve days/four month labels/ninety-day
   span, corroborated excursions and separated residence runs. Keep those exact
   predicates versioned; do not silently weaken them to make a device example pass.
   Owner-configured dated bases take precedence. Future residences must not
   reclassify earlier travel. A holiday cannot establish the base used to reject
   itself. An uncovered era permits one optional home setup, not per-trip review.
3. **Build episodes before scoring.** Normalize -> sessions -> temporal context
   -> away blocks -> boundaries/adjacencies -> episodes -> qualification -> display.
   Remove the legacy pairwise merge as active grouping authority. Evaluate the
   full chronological stream; unresolved media is not an automatic separator.
   A city, country, calendar month, same-place revisit or 30-day storage chunk
   does not itself end an episode. Deduplicate support and retain media membership
   separately from the evidence establishing travel.
4. **Corroborated boundaries.** Apply explicit owner boundaries first. Follow the
   canonical return rule: home upper-bound distance <=20 km plus two independent
   ordered sessions spanning >=60 minutes, or corroborated home blocks on two
   days. One isolated home point makes a link uncertain; missing GPS and silence
   prove no return. Preserve conflicts instead of choosing convenient timestamps.
5. **Gap policy is explicit.** Implement the canonical <=18-hour rule, conditional
   18–72-hour far/foreign rule, comparable civil-day rule and uncertain adjacency
   up to ten days. Matching destination/month or absence of a home photo alone
   cannot automatically settle a longer gap. The current unconditional ten-day
   merge is superseded when the canonical replacement activates. If the private
   pair falls in a canonical uncertain interval, classify it as a policy gap and
   evaluate a separately versioned rule amendment; do not call canonical delivery
   sufficient to guarantee its automatic merge. Any amendment needs positive
   continuous-trip cases and negative repeated-trip cases before activation.
6. **Destination naming is independent.** Adopt versioned offline country and
   administrative-region polygons covering islands; retain topology and attribution.
   For a coherent supported region show its familiar name plus country, with
   month/year on a distinct line. Country fallback is valid; a missing regional
   lookup cannot split an episode. Display lookup and strict foreign-country
   scoring remain separate. No location may be inferred from the user's example.
7. **Atomic and correction-safe.** Keep the last completed Atlas during rebuild;
   publish grouping, labels, membership and counts together. Remap corrections
   using their exact support semantics, preserving manual splits/merges and
   rejection constraints. Record unresolved remaps without broadening protection
   to unrelated trips. Repeated rebuilds and background updates are idempotent;
   inspect dry-run changes and retain the existing rollback contract.

### Required regression matrix and release evidence

- One synthetic island holiday across multiple cities yields one semantic trip
  under qualifying continuity evidence, including mixed precise/day-only metadata,
  same-place revisits, month crossing, GPS-less memories and storage chunking.
- A twelve-day holiday never becomes the base used to reject itself; dispersed
  city home support can establish one macro area under the full residence rules.
- Historical relocation and two legitimate dated homes use applicable intervals;
  a later home cannot invalidate an earlier holiday. Selected access cannot learn
  absence-based residence; a configured base still works.
- Two trips to the same destination/month with a corroborated home return remain
  separate. One isolated home point, unresolved ordering, conflicts and sparse
  gaps produce their exact reason codes rather than fabricated certainty.
- Test gap edges at 18h, 72h and ten days, including just-above values; prove the
  result against the policy, not against an expectation of unconditional merging.
- Owner split/merge/reject, correction remap, repeated rebuild, interruption,
  background refresh and rollback preserve exact decisions and committed views.
- Public synthetic island coverage yields the supported region/country label;
  missing region data affects the title alone, not membership or trip boundaries.
- Run the canonical acceptance matrix, mobile checks, root check and diff check.
  Then locally inspect the owner's pair's reason codes, perform a device rebuild
  and verify one intended holiday with a supported destination/month. Measure
  false splits, false merges, omissions and action rate on a private labeled sample.
  Synthetic passes alone do not close the September incident.

### Delivery sequence

First add diagnostics and diagnose the current committed pair. Next implement
normalization and shared temporal context, then episode construction and boundary
rules, then independent destination naming and atomic integration. Finish with
the regression matrix, dry-run comparison and owner device acceptance. The strict
base rules may leave sparse eras uncovered; measure that outcome and use one era
setup where needed. Do not substitute repeated per-trip confirmations or an empty
Atlas for acceptance. Regional data acquisition and private device evidence are
execution dependencies; the exact September non-join reason remains unresolved.

## PM and analyst follow-up: island naming and persistent fragmentation

Owner acceptance: one continuous holiday spanning multiple local places must
appear once. A familiar supported destination and month must be visible without
per-trip confirmation. The owner supplied a private September example; do not
copy that personal history into public fixtures or use it as a hardcoded rule.

### Verified findings, 2026-10-16

Directly executed the current TypeScript country resolver using the installed
TypeScript transpiler and Node, with public synthetic sample coordinates:

| Synthetic sample | Actual current result | Required supported naming |
| --- | --- | --- |
| Ubud (-8.5069, 115.2625) | border | Bali / Indonesia |
| Denpasar (-8.65, 115.2167) | unresolved | Bali / Indonesia |
| Kuta (-8.718, 115.168) | unresolved | Bali / Indonesia |
| Jakarta (-6.2088, 106.8456) | resolved IDN | Indonesia |

The current bundled 110m geometry and universal 5 km edge exclusion fail these
island samples. Applying consensus across more samples does not repair geometry
coverage. The current dataset contains country names only, so even a successful
IDN lookup cannot produce the regional name Bali. This is a reproducible code
limitation, independent of the owner's GPS quality. These checks were local and
used no private library, remote geocoder or model provider.

The persistence path still calls reconstructV1, then
mergeContinuousAwayJourneysV11, then qualifies the resulting journeys.
reconstructV11 only maps supplied episodes through a qualification gate; it does
not construct episodes or learn temporal context. Thus the canonical episode
pipeline remains unimplemented despite the earlier UI and merge repairs.

The continuity patch chooses one all-history 12-day base, requires every support
point in each legacy fragment to be >=50 km from its representative, and accepts
only nonoverlapping gaps <=10 days between adjacent journey spans. A mixed
home/away fragment, temporally overlapping fragments, intervening unrelated
fragment, missing/incorrect global base, owner protection or longer gap can
block merging. This identifies concrete failure paths, not the exact reason for
the owner's two rows: that requires a current committed-run diagnostic.

### Agreed delivery refinements

1. Repair offline naming coverage with versioned, adequately detailed country
   geometry and administrative-region names. Validate island/coastal coverage
   before adoption. Use polygon topology that preserves islands and holes;
   distinguish an ocean coastline from uncertainty at a national land border.
   Do not use coordinate rectangles or nearest-country guessing. Show a trusted
   familiar region such as Bali when one region explains the supported trip;
   otherwise fall back to Indonesia or the existing multi-country summary.
   Regional names refine presentation only. Keep the stricter foreign-country
   qualification signal separate from display naming so a coastline lookup
   failure cannot erase a supported label or define an episode boundary.
2. Deliver the existing canonical normalized-evidence -> temporal context ->
   away blocks -> episode -> qualification -> destinations pipeline. Remove the
   global-base postprocessor as the active episode authority. A change of place,
   repeated stay, day or month must not split a continuous episode. Use observed
   corroborated return/owner boundaries and the canonical uncertainty rules.
   The current automatic ten-day merge differs from algorithm.md's uncertain
   adjacency policy; resolve this discrepancy explicitly in the canonical spec
   before activating the replacement. Do not silently expand gap thresholds.
3. Add local decision diagnostics before another owner rerun: committed engine
   and dataset revisions; rebuild success/failure; label-resolution reason; and
   the exact rejected join predicate (context, overlap, return, correction,
   conflict, gap or missing chronology). Keep raw metadata/locations private.
   Inspect those diagnostics to identify the September split; do not assert
   that its GPS is absent or that both rows were rebuilt successfully.
4. Publish one atomic completed projection after naming and episode decisions.
   Ready/progress state must cover loading that projection too, so the owner
   does not receive a completion notice over stale rows. Preserve correction
   identity and album membership across a merge; rollback retains the previous
   committed record.

### Acceptance extension and evaluation plan

- Resolver tests: the three synthetic island samples above; another Indonesian
  island; Taiwan; a small island; an actual international border; ocean and
  invalid coordinates. Interior island naming must succeed without relaxing
  genuine border/ocean abstention. Regional labels must have source/version
  coverage, not a hand-authored exception for this incident.
- End-to-end repository cases: several supported places on one island during
  one away episode -> one trip, familiar region/country label and correct month;
  repeated same-place days; mixed precise/day-only evidence; interleaved spans;
  GPS-less media; irrelevant distant correction; holiday crossing month/year.
- Negative cases: two visits to the same island/month separated by corroborated
  home return -> two trips; owner split preserved; contradictory chronology or
  uncertain long gap cannot automatically pool weak evidence to qualify.
- Diagnostic contract: every non-join and withheld label has a stable reason;
  completed view reflects the newly committed revision. No private coordinates
  or source identifiers enter logs, telemetry, Git or public reports.
- Compare old/new outputs on the same owner-authorized local evidence. Report
  false splits, false merges, destination naming coverage, omissions and owner
  actions alongside precision/recall. Synthetic checks and root eval smoke are
  infrastructure evidence only; private-library quality remains unmeasured.

PM acceptance remains open until the continuous holiday is recognized once on
device and the negative cases remain separate. No application fix or device
acceptance is claimed by this follow-up investigation.

## Owner outcome

One continuous Taiwan holiday across several cities is one trip. Its primary
presentation is `Taiwan` and `October 2025`. Map-dot and list selection immediately
open the same visible preview. `See photos and videos` opens a full-screen album
grid; Back restores the preview and the previous Atlas context.

This document specifies the integrated next delivery. The canonical V1.1 engine
contract and companions remain the algorithm authority except for the explicit
presentation additions here. Do not implement country/month grouping as a
substitute for episode recognition. The owner's Taiwan example supplies a desired
outcome, not permission to inspect or publish that private library.

## Verified implementation gaps

- `reconstruction/engine.ts` creates V1 journeys from place visits, uses a 30-day
  cap, and does not implement the full V1.1 episode/context pipeline. City-level
  places and journeys are different entities and must remain so.
- `reconstruction/repository.ts::qualifyGraphJourneyV11` classifies an existing
  V1 journey after segmentation. Its 12-day global base, synthetic capture-like
  provenance, date-as-session and photo-ratio rarity are temporary recovery
  shortcuts. It does not establish date-scoped bases, routine suppression,
  independent units or real V1.1 episode continuity. Its distance currently uses
  central coordinates without subtracting uncertainty radii.
- `country-resolver.ts` already performs an offline bundled lookup, but returns
  a country code only. Names exist in its dataset. Coarse geometry and border
  abstention must be tested before relying on a Taiwan display label.
- `reveal/projection.ts` supplies `Private journey` and year-level presentation;
  it has no validated place/month summary contract.
- `components/atlas-reveal.tsx` nests the selected preview in the map section
  or inline above the list. Scrolling the list does not move that preview into
  the current viewport.
- `components/journey-media-viewer.tsx` renders thumbnail/text rows inside a
  bounded inline panel with Previous/Next controls, rather than an album screen.

## 1. Recognize an episode, retain its places

Processing order is normalized capture units -> temporal bases/routines ->
chronological away blocks -> continuous episode -> trip qualification ->
destinations/media -> one durable projection. Do not qualify fragments first
and try to fix splits by merging their UI rows.

Use algorithm.md's exact two-pass context and episode rules:

- Owner splits, exclusions and rejection constraints apply first.
- Changing city, support place, country, month or year never independently ends
  a trip. A holiday can revisit a city and can cross a national border.
- Join adjacent ordered away blocks at <=18 hours when the speed guard and
  applicable base context agree, with no intervening conflict/boundary.
- For >18 through 72 hours, join only when both edge blocks pass the existing
  far-or-foreign predicate, the base sets agree and there is no intervening
  home-proximate observation. With comparable civil days only, use the specified
  <=2-day far-or-foreign branch; do not invent elapsed hours.
- A corroborated home return or owner split creates a boundary. A lone home
  point makes the affected link ambiguous. Missing photos never prove return.
- Gaps beyond the join window through 10 days retain an uncertain relationship;
  beyond 10 days keep separate observed episodes. Same country/month cannot
  erase the ambiguity. Two independently qualifying fragments may remain visible
  with a single optional merge question; pooled ambiguous weak evidence cannot
  create an automatic trip. This is the explicit sparse-evidence limit.
- Remove V1's semantic 30-day cap in the V1.1 path. Processing chunks and month
  boundaries cannot split an otherwise qualifying episode.
- Apply all V1.1 hard gates and SCORE/DAY/STAY profiles to the completed episode.
  Repeated domestic holidays can qualify through evidence profiles even without
  novelty. Reuse exact session/unit/destination predicates, not the adapter's
  date or photo-volume approximations.

Expected Taiwan example: independently supported city blocks during one away
episode, with qualifying links and no home return/owner boundary, yield exactly
one trip. All supported cities and associated media remain inside it. If a gap
falls outside the defined continuity evidence, the engine must expose that limit
in a deduplicated optional question rather than silently assert a continuous trip.

## 2. Place and month summaries

Derive a summary in the local repository from supported destinations belonging
to the episode. Use the existing bundled country dataset plus a versioned local
code-to-display-name mapping; do not add a remote geocoder for this requirement.

- One supported country/territory: its familiar display name, e.g. `Taiwan`.
- Two supported countries: `Taiwan & Japan`; three or more: `Multi-country trip`.
  Ordered full destination names are available in detail when chronology permits.
- Unknown/border coordinates cannot contribute a guessed label. If some valid
  destinations remain unresolved, use `Travel` as the automatic summary rather
  than implying a complete single-country itinerary. Detail can show resolved
  destinations and the unresolved portion.
- An explicit owner title overrides the automatic title. A location-only label
  never creates additional visit support or changes trip membership.
- Same-month observed span: `October 2025`; cross-month: `October–November 2025`;
  cross-year: `December 2025–January 2026`; no supported month: `Date unknown`.
- Prefer preserved original capture civil dates. For trustworthy instants without
  local dates, calculate possible civil dates across valid UTC offsets [-14,+14]
  and use the month only if they agree. Near a month boundary, display the possible
  month range; never reinterpret history using today's phone timezone.
- Owner date claims remain separate from the observed span in correction/detail;
  they may drive the concise presentation when explicitly saved. Never show an
  exact trip departure or return merely from first/last photos.

Primary rows and preview use title + month line, optionally a media preview/count.
Move diagnostic counts and inference explanations behind About/details. Keep
Detected/Reviewed status quiet and accessible. Default title is never a technical
place ID, coordinate, generated ordinal or a city guessed from the map anchor.

Extend the redacted reveal types and payload validator deliberately for these
validated display strings; raw dates, source IDs, country lookup inputs, and exact
coordinates remain private. Country/month equality is never a database trip key.

## 3. One preview in the current screen

Map dot, Timeline row and list row invoke one `selectTrip(displayId)` controller.
Render one screen-level native modal/bottom sheet outside the scrolling Atlas
content and MapLibre surface. It is anchored to the viewport and safe area.

- The sheet appears immediately with the selected trip's known title/month and
  a media loading skeleton. Late detail loads cannot change the selection.
- Normal content occupies at most 65% of available screen height; expanded or
  large-text content can use a full-height sheet with internal scrolling. Close
  remains reachable. Underlying Atlas scrolling/interaction is disabled while open.
- Show one permitted local cover when available, title/month, primary album action,
  secondary correction action and Close. Do not wait for a photo to open the sheet.
- Back, Close and backdrop dismissal return to the exact list offset, map camera,
  filter and view. Opening/closing does not scroll the parent or recenter the map.
- Coincident dots open a viewport-level chooser using title/month, then replace it
  with the selected sheet. One episode's multiple destination dots open that same
  episode; they do not create duplicate trips in the list/count.
- Screen-reader focus enters the sheet and returns to its trigger; Android Back
  closes the topmost surface first. Support reduced motion and safe-area insets.
- Associate asynchronous requests with selected opaque ID + generation + request
  token. Dismissal/selection changes invalidate late results; abort work where
  supported. Permission revocation clears media access immediately.

## 4. Full-screen album grid

`See photos and videos` transitions from the sheet to an album route/screen,
preserving the suspended sheet and Atlas return context. It cannot expand an
inline panel or render gallery rows inside the sheet.

- Header: Back, trip title and month. Content: virtualized square-thumbnail grid
  with three columns on ordinary phone widths, adapting to width/accessibility.
  Keep individual targets at least 48 platform units; use two columns if necessary.
- Mixed photos/videos share stable chronological order. Videos show a play badge
  and duration only when supplied by local metadata. Use a local poster when
  supported, otherwise a clear video tile; no automatic video playback.
- Day headers may use preserved civil dates. Uncertain order is explicit and does
  not become fabricated day/time sections. Opaque ID is only a stable tie-break.
- Repository pages have 60 metadata items and one immutable generation token.
  Fetch the next page as scrolling approaches the end; no Previous/Next buttons.
  Resolve thumbnail media only for the visible window plus one viewport ahead,
  with a maximum of 8 concurrent native reads; release off-window resources.
- Keep page identities/count/cursor metadata separate from decoded image resources.
  Revisit older pages without duplicates or lost scroll position. Memberships and
  visit support are unioned by canonical media identity, preserving distinct videos
  and explicitly selected copies according to the existing membership contract.
- Initial loading uses skeleton tiles, further loading uses a footer, retry preserves
  loaded tiles/scroll, and unavailable/cloud-only items use stable placeholders.
  Preserve known unavailable items so gaps do not silently change album order/count.
  No automatic original download. Empty albums have a clear Back action.
- Tapping a tile opens an immersive media viewer with previous/next navigation
  across page boundaries. Back restores that tile's grid position. Video starts
  only on explicit play, muted initially, and pauses on change, Back or background.
- Back from album restores the same preview; Close returns to the same Atlas
  position. Correction is secondary to album browsing and retains the same return
  stack; a changed successor is resolved through existing correction lineage.
- If the generation changes, stop pagination, explain that the trip was updated,
  and provide one refresh. Do not mix memberships from different generations.

## 5. Durable corrections and migration

Implement episode construction in the versioned engine, not in React grouping.
Persist episodes, destination support, qualified status, display summaries and
media memberships atomically. All primary queries, counts and replay use the
same episode projection. Country statistics reflect supported destinations in
visible trips, not every internal reconstruction place.

Rejection and owner splits remain authoritative. A successor that contains several
old trips does not inherit confirmation for newly added support. Preserve reviewed
scope/snapshot separately; apply existing full-support remapping and scope-review
rules, never broaden correction scope. Manual trips remain first-class records.

Do not change existing applied v29 migration SQL. Add any necessary schema in
a new migration after inspecting the actual current schema. Retain the existing
projection while the new generation builds and provide revision-bound local
comparison/rollback for legacy adoption. Candidate replacement only commits after
all correction and input-revision checks succeed.

## 6. Delivery and acceptance

Deliver one integrated feature through these ordered checkpoints; a checkpoint
is not a completed handoff:

1. Replace adapter shortcuts with canonical metadata/context/episode processing;
   add offline names and month summaries with privacy-validator coverage.
2. Persist episode projection and correction/media lineage; compare old/new output
   locally and verify aggregate consistency and rollback.
3. Add the viewport sheet, full-screen grid and viewer with one return stack.
4. Run engine/repository/UI regressions, root and mobile checks, then physical
   device acceptance before declaring the experience complete.

Required scenario matrix (synthetic fixtures publicly; owner example stays private):

| Scenario | Required result |
| --- | --- |
| Supported Taiwan cities with qualifying links in October | One trip; Taiwan / October 2025; all associated memories retained |
| Same city revisited during that episode | Same trip with repeat visit retained |
| Two Taiwan holidays with corroborated home return, even in one month | Two trips with the same display labels; never deduplicated by name/month |
| Continuous Taiwan–Japan episode | One multi-country trip; supported destinations retained |
| Holiday crosses month/year or exceeds 30 days | No calendar/cap split; month range shown |
| <=72-hour silence with canonical far/foreign context | Qualifying continuity without invented home return |
| Longer uncertain gap, isolated home point, contradictory timestamps | Canonical uncertain boundary; no arbitrary country merge |
| Routine commute, duplicates, screenshots, weak GPS | No unsupported automatic trip or inflated photo count |
| Missing original offset at a month boundary | Honest possible month range independent of current device timezone |
| Taiwan inland, coastal, border and unresolved coordinates | Correct local label or explicit abstention; no fabricated city |
| Owner rejection/split/edit followed by automatic merge candidate | Saved scope and boundaries survive; no broadened confirmation |
| List selection several screens below map | Visible sheet immediately, unchanged parent scroll |
| Map selection, overlapping dots, map unavailable | Same visible sheet or chooser and same selection semantics |
| Rapid A -> B selection and close before load | No stale cover/details or reopened dismissed sheet |
| Album with >120 mixed items | Scrolling grid, paging, no duplicate/drop, bounded native thumbnail reads |
| Tap last tile of a page and advance | Viewer crosses page boundary; Back restores correct tile |
| Unavailable media, access revocation, failure/retry, background video | Honest placeholders; safe cancellation; video paused |
| Album -> preview -> Atlas, correction -> Atlas | Original filter, camera, selection and scroll restored |
| Large fonts, small screen, Android Back and screen reader | Reachable close/back, correct focus, no off-screen preview |
| Rebuild during browsing, migration failure, rollback | No mixed generation or lost owner decision |

Run `npm run check` at root and the actual mobile check independently. Fixture
passes establish software behavior only. Measure false splits, false merges,
eligible-trip recall and owner actions together on an authorized local sample.
The owner's continuous Taiwan October holiday should be one trip if its local
evidence supports the defined links; this has not yet been inspected or verified.
An empty Atlas cannot satisfy acceptance merely because false positives vanish.

No remaining UI/product choice needs to be deferred to an implementation spike.
Real evidence availability and device results remain validation dependencies,
not invented successful outcomes.
