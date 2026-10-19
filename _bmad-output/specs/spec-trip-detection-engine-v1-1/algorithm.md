# Deterministic algorithm contract

Policy `trip-detector-v1.1`; normalization `capture-evidence-v1.1`; context
`temporal-context-v1.1`; parameter changes require a new revision recorded in each
run. Values below are selected testable defaults, not learned accuracy claims.
All intervals include endpoints unless a strict comparison is stated.

## 1. Units and deterministic ordering

Use R=6,371,000 m Haversine, normalized longitude across the date line and distances
rounded to millimetres as in decision 0007. Retain complete-link support places
with maximum separation 5,000 m. Macro areas use the same canonical assignment
algorithm with 20,000 m maximum separation; they are destination/base regions,
never asserted municipal boundaries. Representatives are observed minimax medoids.
Canonical ties use stable source IDs only for computation, never claimed chronology.

Use native/EXIF capture instants for elapsed ordering independently of whether
original local offset is known. Original civil dates/times are separate fields.
Without an instant, same original civil date can share an unordered day block;
different dates use civil-day differences only when neither has conflicting
interval information. Mixed incomparable values create uncertain relationships.
Do not synthesize local time using the phone's current timezone.

Collapse verified duplicate families and identical nonempty original image unique
IDs scoped to camera identity. Otherwise conservatively group photos with the same
normalized camera identity, capture timestamps within 2 seconds of the group's
first member and pairwise GPS within 100 m. Unknown camera IDs share an unknown
bucket. Sort by capture time then stable ID; use complete-link grouping so chains
cannot absorb unlimited bursts. Missing timestamps cannot count independently.
These are conservative capture units, not a claim of pixel-level duplicates.
Metadata-conflicting verified families supply no automatic support. Originals and
copies remain in storage/media associations. A unit contributes at most one photo.

Sessions partition time-bearing capture units: start a new session if adjacent
elapsed gap >60 minutes, spatial displacement >1,000 m, or first-to-current span
>4 hours. Unknown GPS never starts a spatial session. Comparable local wall times
can group within one original day but never establish elapsed ordering across
offset changes. Day-only units form one unordered session per day/support place.
Do not derive multiple independent sessions from uncertain same-day ordering.

Two reliable geotags corroborate if their capture units differ and either their
ordered sessions differ or they occupy distinct support places separated by
at least 1,000 m. The latter can corroborate one spatially coherent multi-place
session; burst copies cannot. Explicit conflicting coordinates/times fail.

## 2. Reliable location and temporal checks

A supporting unit needs capture-like provenance and usable time under
native-evidence.md. A geotag with known accuracy >1,000 m is not reliable automatic
location support (it may remain weak place evidence). Unknown accuracy uses a
5,000 m policy uncertainty margin; this is a conservative policy buffer, not
a measured error bound. A known accuracy uses that radius. Missing/nonfinite
coordinates do not establish a location. Valid ranges follow decision 0007.

For successive ordered geotags, a jump >20 km with speed >1,500 km/h is a conflict.
Quarantine both sides from automatic episode linking unless other independent
same-place support resolves which is erroneous; resolve only if exactly one side
has at least two independent corroborating units and the other has none. Otherwise
retain the component unconfirmed. A tie must never select the convenient point.
This detects contradictions; it does not infer a flight or a traveled route.

Distance lower bound is max(0, Haversine(observed destination medoid, base medoid)
minus destination uncertainty radius minus base uncertainty radius). Compare
against every applicable primary/secondary base. Effective distance is their
minimum. Exactly 50,000 m lower bound passes; central estimate 50 km with unknown
accuracy does not. Use this same effective distance for the 150 km bonus/profile.

Country is available only if the bundled resolver agrees for the medoid and eight
equally spaced bearings on a circle of radius max(10 km, uncertainty radius),
with no border/unresolved sample. Apply to destination and every relevant base.
This is a conservative resolver policy, not proof of an exact national border.
Unknown anywhere prevents a foreign-to-every-base bonus. No IP/vision inference.

## 3. Temporal base model

First build reliable daily macro-area observations without classifying trips.
Context can use corroborated still-local catalog observations but not screenshots,
known downloads, duplicate conflicts or the candidate's own evidence. For each
episode being assessed, exclude its evidence from context learning (leave-one-
candidate-out), then apply these fixed predicates. Do not iteratively promote
a candidate until it makes its own base/routine model pass.

Execution uses exactly two passes: compute C0 from the final normalized snapshot,
build provisional episodes with C0, then compute C1 separately for each episode
after excluding its units. Re-evaluate that episode once with C1. If applicable
base intervals or its segmentation change, mark context-unstable UNCONFIRMED;
do not loop until a preferred result appears. With no C0 base, build location/day
blocks as unconfirmed candidates only; no unknown distance can make a join qualify.
Score prior rarity against provisional corroborated nonroutine episodes from the
same snapshot, excluding the candidate. All intermediate results are immutable.

Owner-configured bases have explicit effective inclusive dates (open endpoints
allowed); an owner replacement supersedes only the same base/period. They are
authoritative. Owner suppression of an auto-base is a durable negative decision.
All other applicable qualifying bases remain secondary bases; never average them.

For each UTC evaluation day D, an automatic macro base B qualifies in the centered
180-day window [D-90 days,D+90 days] only if all conditions hold:

- >=12 distinct support days, >=4 calendar-month labels, first-last span >=90 days;
  use UTC dates of trustworthy instants for recurrence, explicitly not travel-local
  calendar-day bonuses. Day-only evidence can nominate a base but cannot make it
  automatically usable without reliable elapsed-time context.
- >=3 disjoint B -> away -> B excursions. B endpoints each have corroboration;
  the away block has corroboration and lower-bound distance >=50 km. Each excursion
  lasts <=30 days. Select shortest nonoverlapping intervals first, then earliest
  start, and require selected departure dates >=14 days apart.
- >=50% of B's support days are outside the selected excursion interiors. One
  continuous holiday, however long or photo-heavy, cannot qualify on duration alone.
- >=2 residence support runs, each with >=3 support days spanning >=7 days. Runs
  separate only at a gap >=30 days with no B evidence and >=7 corroborated support
  days at a different macro area inside that gap. Short excursions during one
  long holiday cannot create a second residence period. This deliberately strict
  learning rule often leaves a one-time base clarification preferable to guessing.
- Full library access is available. Limited/selected access can use configured
  bases, but cannot automatically learn absence-based residence context.

Collapse consecutive qualifying days into effective intervals; no extension beyond
those days, no applying today's home to unsupported historical periods. Multiple
qualifying bases are all considered. Primary label = most support days, then
excursions, then stable ID; the primary label does not change nearest-base gates.
If no configured/usable learned base covers every observed episode day, the
episode is UNCONFIRMED/base-context-missing; offer one setup question per uncovered
era, not one per episode. Uncertain move boundaries use all plausible overlapping
bases and withhold classification if context cannot cover the episode.

## 4. Routine veto

Owner-configured routine location/date interval is authoritative. Automatic
routine context uses the 90 days strictly before candidate start, excluding the
candidate and using only applicable bases. A location is routine when:

- >=8 disjoint corroborated base -> location -> base excursions on >=8 distinct
  original local days across >=4 ISO local weeks; each excursion <=18 elapsed hours;
- >=70% of arrivals occur Monday-Friday OR >=70% occur on at most two weekday
  labels (including weekends); and >=70% fall in the same four-hour
  circular local-time band. Enumerate candidate band starts from observed minutes;
  select maximum coverage, then earliest minute. Local times must be known;
- the away location is the same macro area across those excursions.

That routine location cannot establish a trip or its main destination. Strip its
support from candidate qualification; if nothing else can qualify, NOT_TRIP/routine.
Other corroborated nonroutine destinations in a larger holiday can still qualify.
Recurrence alone (>=8 support days/4 weeks) without usable brackets/local time
marks suspected-routine; it is UNCONFIRMED, not a hard fact. Annual/irregular
holidays do not satisfy this veto. Routine routes are internal patterns, not maps.

## 5. Episodes and boundaries

Apply owner splits/exclusions and rejection grouping constraints before automatic
episode grouping. Build same-day away blocks after removing routine/home support.
A base observation is home-proximate if its upper-bound distance to an applicable
base is <=20 km. It becomes a return boundary only with two independent ordered
sessions spanning >=60 minutes, or corroborated home blocks on two distinct days.
One isolated base geotag makes the affected link ambiguous, not a proven return.
Unknown location/offset never proves return.

Join chronological adjacent away blocks with no intervening boundary/conflict:

- <=18 elapsed hours: join when speed guard passes and base context agrees.
  Same original civil day without reliable instants may join as unordered, never
  inventing within-day destination order. A competing same-day base block blocks
  that join until its ordering is resolved.
- >18 and <=72 elapsed hours: join only when each edge block independently has
  effective distance >=150 km OR trusted foreign-to-all-bases country evidence,
  same applicable base set, and no home-proximate observation between. This supports
  multi-city holidays and 1-2 silent days without pretending silence is a return.
- With only comparable original civil days: gap <=2 days may join only by the
  same far/foreign rule; order between distinct days is known, elapsed time is not.
- Other gaps <=10 elapsed/civil days: keep an uncertain adjacency relation.
- Gaps >10 days: keep separate observed episodes without claiming a home return.

No automatic 30-day episode cap; chunking must preserve one semantic episode.
Unknown adjacency between two blocks both independently qualifying can retain
their recognized observed episodes, with one optional merge question and unknown
boundary. If either fragment cannot independently qualify, retain the connected
ambiguous component unconfirmed; do not pad its score by pooling ambiguous support.
This explicit conservative rule may fragment sparse travel; evaluate false-split
rate and revise the version if real evidence fails the release bar.

State transitions are ordinary-context -> away-candidate -> corroborated-episode;
a corroborated return closes observed support, not an exact arrival/departure time.
Without return it remains open-boundary and may still qualify. Linked away evidence
extends the episode, a reliable return/owner split closes it, and uncertain links
do neither. Store observed first/last times separately from unknown trip boundaries.

## 6. Gates, score and selected classification

Before the photo gate, compute conservative compatible photo counts without
persisting final membership: supported nonroutine away photos plus GPS-less capture
units strictly bracketed by two ordered corroborating anchors of this episode,
each <=24 hours away, no compatible competing episode, exclusion or boundary.
Bracketing does not let those photos create location support. Videos add zero.
Home/routine/known unrelated/support-ineligible units add zero.

ALL auto gates: applicable base context; main destination effective distance>=50km;
>=5 eligible photo units; independent reliable geotag corroboration; no remaining
routine-only candidate; no critical unresolved conflict/adjacency affecting pooled
support; no owner veto. Missing information => UNCONFIRMED. Known near-home/routine
or insufficient photos => NOT_TRIP with reason. Rejected remains REJECTED. Manual
or effective owner acceptance => USER_CONFIRMED without running auto gates.

Main destination is the nonroutine away macro area with most independent eligible
photo units, then most sessions, then greatest trustworthy elapsed span, then stable
area ID. A single distant outlier never replaces a supported nearby main area.

Original diagnostic score, clamp 0..100:

| Signal | Points | Exact predicate |
| --- | ---: | --- |
| Away | 30 | Main effective distance >=50 km |
| Far | 10 | Main effective distance >=150 km |
| Foreign | 45 | Trusted destination country differs from every applicable base country |
| New/rare | 15 | At most one nonroutine corroborated prior episode in main macro area in the 365 days before start; exclude candidate itself |
| Sessions | 15 | >=2 independent sessions containing eligible away photos |
| Places | 10 | >=2 corroborated support places, representatives separated >=1 km, within episode |
| Local days | 5 | >=2 distinct known original local calendar days of eligible photos |
| Routine | -55 | Diagnostic presence of a confidently routine proposed main location; veto precedes publication |

Rarity completeness means enumeration of all currently accessible full-library
records for that prior365-day query, not proof of historical lifetime coverage.
Limited/selected or unfinished enumeration makes rarity unknown: award zero.
Unknown foreign/day signals also award zero. No volume bonus.

Selected production predicate: all gates AND any of:

- **SCORE:** diagnostic score >=70;
- **DAY:** >=2 independent away sessions, >=2 corroborated places, trustworthy
  episode span >=4 hours, no suspected routine at those places;
- **STAY:** >=3 independent away sessions, >=2 known local days, trustworthy span
  >=24 hours, no suspected routine at the main destination.

The last two preserve well-evidenced repeat domestic travel without novelty.
Record the matched path; a profile never changes the score or bypasses a gate.
If no auto path: all gates + score45..69 => SUGGESTED; all gates + score<=44 =>
NOT_TRIP/low-signal. A candidate missing ONLY independent corroboration can also
be SUGGESTED if score>=45 and all other gates pass, with an explicit corroboration-
pending reason. This resolves source case6 without publishing weak location
evidence. Other missing gates remain UNCONFIRMED even with score100.
A suspected-routine candidate cannot pass SCORE merely because its profile fails.

## 7. Destinations and membership

After qualification, group away support into macro destinations and attach media.
A destination is plotted only with corroboration of its own support, independent
of the trip-level decision. Unsupported intermediate places remain local evidence,
not map destinations. Same country never merges episodes. Preserve observed
chronology, label unknown order, and never draw implied routes. For synthetic
Tokyo/Kyoto/Osaka fixtures supply three well-separated corroborated regions; in
production call them destination areas unless trusted naming/owner claims exist.

For destination/support-place validation, require >=2 reliable capture units
separated by >=60 known elapsed seconds, and either different sessions OR an
independently supporting other place in the same globally corroborated episode.
For that second branch the other place must itself have >=2 reliable units
separated by >=60 seconds; validate the pair simultaneously without recursive
promotion. This coherent multi-place branch permits five photos across two
sessions/two places. A lone city geotag or30-second burst cannot become a plotted
destination. With unknown elapsed separation, use the different-session branch
only when session independence is supported by reliable distinct capture dates;
do not invent60seconds from missing times. The same predicate defines the two
corroborated places bonus; global episode corroboration remains mandatory.

Geotagged eligible photos attach via their episode; GPS-less automatic membership
uses the strict bracket above. Keep decision0007's unique three-day/day-padding
suggestion for optional media review only. No whole-interval bulk attachment.
Persist excluded/manual memberships and distinguish media from presence evidence.
