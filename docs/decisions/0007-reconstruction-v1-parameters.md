# Decision 0007: Fixed reconstruction v1 parameters

Date: 2026-10-07 (Asia/Bangkok).
Status: working MLP implementation defaults selected to resolve decision 0006 before
app development. They are deterministic product rules, not measured accuracy claims.

## Purpose and version

Use one versioned local baseline, `reconstruction-v1`, for initial import,
foreground rescan and background reconciliation. Each run records the parameter
version and final evidence/correction revision. Run the same rules on the same
final input to get the same places, visits, journey drafts and photo associations,
regardless of asset enumeration order. An owner correction takes precedence.

These defaults favor reviewable uncertainty over unsupported location or presence
claims. The 5 km place size and 3-day candidate gap retain the earlier MVP scale;
the 30-day cap prevents long chains, the 10-day possible merge covers a sparse
holiday without asserting continuity, and the 24-hour photo bracket makes automatic
GPS-less inclusion narrow. None of these values comes from measured users.

| Parameter | V1 value | Use |
| --- | ---: | --- |
| Maximum pairwise place separation | 5,000 m | Spatial cluster eligibility |
| Maximum reported GPS accuracy for place support | 5,000 m | Poorer known fixes stay unresolved |
| Same-place visit gap, precise instants with offsets | 48 elapsed hours | Consecutive observations may remain one visit |
| Same-place visit gap, instant unavailable | 1 recorded civil day | Conservative temporal grouping |
| Maximum automatic visit span | 30 calendar-date difference | Prevent one location from becoming a months-long visit |
| Journey link gap, precise instants with offsets | 72 elapsed hours | Candidate link signal |
| Journey link gap, instant unavailable | 2 recorded civil days | Candidate link signal; order can stay uncertain |
| Maximum automatic candidate span | 30 calendar-date difference | Prevent unbounded chains |
| Maximum possible-merge gap, precise instants with offsets | 240 elapsed hours | Reviewable adjacent segment relation only |
| Maximum possible-merge gap, instant unavailable | 10 recorded civil days | Reviewable adjacent segment relation only |
| GPS-less suggestion span padding | 1 calendar day at each end | Candidate search, not claimed trip duration |
| GPS-less suggestion nearest visit | 3 calendar days | Avoid filling a long interval with unrelated media |
| GPS-less automatic bracket | 24 hours before and after | Each independent, ordered anchor must be within this range |
| Optional usual-area band | 50,000 m | Date-scoped local context only |

When both precise instants and offsets are known, gap limits use elapsed time between capture instants;
72 hours includes the endpoint. Otherwise a civil-day gap is the difference
between recorded capture dates: January 1 to January 4 is three days. Candidate
span is last observed date minus first observed date, so January 1 to January 31
is 30 days. A missing
capture date cannot create a visit or automatic journey association. Keep
the geotag as unresolved place evidence for possible manual placement.

When both capture timestamps have usable offsets and time-of-day, retain their
actual order and calculate elapsed hours from the instants. Otherwise
missing, use capture civil-date labels only as weak grouping evidence; do not
manufacture an offset, elapsed duration or within-day order. The smaller
unknown-offset windows above prevent boundary cases from becoming automatic
links. If date precision is coarser than a day, interval ordering conflicts,
or a comparison spans incompatible precision, retain a possible relation or
leave it unresolved. User-confirmed dates/boundaries take precedence.

An owner-confirmed usual area has a center and effective date interval. Classify
nearby context by distance from that center at that date; if several confirmed
areas overlap, use the nearest center, then stable area ID. The 50 km band does
not assert that the owner was home or exclude a local trip.

## Place clusters: deterministic complete-link assignment

1. Validate finite latitude in `[-90, 90]`, longitude in `[-180, 180]` and a
   nonnegative reported accuracy when present. A fix known to
   be worse than 5,000 m does not support a place. Missing accuracy stays marked
   unknown; it can support an inferred place, never verified presence. Known
   unsupported downloads do not independently support a place or visit.
2. Treat duplicate-family copies as one support unit. If their metadata conflict,
   keep the family unresolved until an owner edit; do not select the convenient
   coordinate silently.
3. Sort eligible support units by numeric latitude, normalized longitude
   (`[-180, 180)`), then stable evidence ID. The sort is repeated on the final
   input after affected-component updates; arrival order is irrelevant.
4. For each point in that order, consider an existing cluster only if its
   Haversine distance to **every** member is at most 5,000 m. Compute with
   `R = 6,371,000 m` and normalize longitude difference across the date line.
   Compare distances rounded to the nearest millimetre, including the cutoff.
   Millimetres make comparisons repeatable; they do not claim GPS precision.
5. If several clusters qualify, choose the one with the smallest resulting
   maximum pairwise distance. Break an equal-distance tie by the lexicographically
   smallest stable evidence ID already in the cluster. If none qualify, create
   a new cluster. The representative map coordinate is an observed member that
   minimizes its maximum distance to other members; ties use stable evidence ID.

This is a deterministic complete-link **assignment**, not a claim that every
nearby pair must end up in the same cluster. A-B and B-C can each be near while
A-C exceeds 5 km; all three must not form one place. A spatial index may reduce
work, but it must reproduce these decisions, including across the date line.
Late additions may change an affected cluster. Recompute its connected spatial
dependency component from the final input; keep identity lineage and correction
overlays. If a background work budget expires, leave that component pending and
keep the last consistent result until reconciliation completes.

## Visits and candidate journeys

Within one reusable place, comparable consecutive observations form one visit
while their gap is within the same-place window above, unless an explicitly
ordered visit to another place or an owner split lies between them. An automatic
visit also stops before its first-to-last observed date difference exceeds
30 days; the next segment can have a possible-merge relation. Return to
A after an ordered B creates a new A visit. With unreliable within-day ordering,
keep the visit order unresolved instead of sorting by asset ID as if it were time.
Months-apart stays at the same hotel are separate visits.

Journey candidates need at least one time-bearing eligible visit. Adjacent
nonlocal visits may join an **inferred draft** within the journey link window,
provided no owner boundary intervenes and the first-to-last observed span stays
within 30 days. If no usual area has been confirmed for that period, use the
same windows to form neutral candidates without asserting that they are
away-from-home travel. A one-day local outing can be a candidate.

Eligible visit-support observations within a date-scoped confirmed usual-area
band do not bridge two nonlocal segments. Such a home-proximate observation
between segments blocks an automatic join and leaves a possible-merge relation;
it does not prove return. A known unsupported download cannot create that signal.
Only an owner-confirmed return/split is a hard boundary. Local observations
remain available for owner-created local trips and can be trip memories.

If the link gap or the 30-day span cap is exceeded, keep separate draft segments.
Between immediately adjacent segments whose gap is at most 240 elapsed hours when
both precise instants and offsets are known, or ten recorded civil days otherwise,
record a **possible merge** unless an owner boundary forbids it. This also covers
a cap-forced split with a shorter gap. Possible merges never join transitively;
the owner may merge longer trips explicitly. Larger gaps get no automatic
relation. These limits determine draft presentation, not observed departure or
return dates.

## Photo membership from geotagged evidence

An eligible geotagged support unit with a capture date enters the inferred
journey draft through its visit when that visit is assigned to one journey.
Its duplicate-family copies may appear as media but do not add independent
visit support or journey counts. If its visit has only possible journey links,
leave membership suggested or unresolved; never choose one by asset ID.

A geotagged photo with known unsupported origin, unusable GPS accuracy or
conflicting duplicate metadata cannot create a supported visit. It may receive
the same time-bounded **suggestion** below as GPS-less media, but it is never
automatically accepted from its location alone. Missing capture date stays
unassigned until owner action. An owner can keep such media in a trip without
turning it into evidence that they visited the geotagged place.

## Photo membership without GPS

A photo with no GPS can be included as an inferred trip memory only when it has
a precise capture instant with offset, sits strictly between two independently
supporting, ordered geotagged anchors of the same journey, each anchor is within
24 hours of the photo, no competing journey is compatible, and no owner boundary
or exclusion intervenes. It gains no place or visit-support link.

Otherwise, suggest it or ineligible geotagged media for review only when it has at
least a capture day, exactly
one compatible candidate whose observed span padded by one calendar day contains
that day, and the nearest supporting visit is within three calendar days. Day-only
or unknown-offset timestamps may create a suggestion but never automatic
inclusion. If two journeys qualify, keep alternatives unresolved. If none qualify,
leave the photo unassigned. Manually assigned media can be included without
becoming visit evidence.

## Acceptance examples

| Input | V1 expected result |
| --- | --- |
| Two geotagged points exactly 5,000 m apart | Eligible for one place if the complete-link rule holds |
| Three points A-B = 4 km, B-C = 4 km, A-C = 8 km | Never one three-point place; canonical sort and tie-break determine the two clusters |
| Same evidence enumerated in reverse order or B imported later | Same final memberships as a full rebuild; correction lineage preserved |
| Same place day 1 noon and day 3 noon, known offsets, no intervening B | One visit at the 48-hour cutoff; day 6 noon starts a new visit |
| A day 1, B day 2, A day 3 with reliable order | A → B → A visits |
| Visits day 1 noon and day 4 noon, known offsets, no home/boundary | May form one inferred journey draft at 72 hours; day 1 to day 5 noon alone yields a possible merge |
| Visit day 1 and day 4, missing offset on either side | Separate segments with possible merge; no automatic link |
| Tokyo day 1 noon and Kyoto day 6 noon, known offsets | Separate drafts with possible merge; no asserted continuity |
| Daily photos at one place through day 32 | Split the visit before its observed span exceeds 30 days; adjacent pieces may show possible merge |
| Consecutive multi-place visits through day 32 | Split the journey before its observed span exceeds 30 days; adjacent pieces may show possible merge |
| Owner-confirmed return between two visits one day apart | Two journeys; no possible merge across the owner boundary |
| One eligible near-home photo between nonlocal visits three days apart | No automatic join across it; possible merge remains reviewable |
| GPS-less image precisely bracketed within 24 hours on each side by one trip's independent supports | Accepted inferred trip memory, location unknown |
| GPS-less day-only image near one trip | Suggested memory only |
| GPS-less image compatible with two trips, or no capture date | Alternatives unresolved or unassigned |
| Geotagged support unit with a visit assigned to one draft | Accepted inferred journey membership via that visit; owner presence remains unproven |
| Known downloaded geotagged photo near one draft | At most a time-bounded memory suggestion; its GPS adds no visit support |

## Consequences and review trigger

M2.1 implements these defaults and records trace reasons. M2.4 checks these
examples and nearby boundary values with synthetic evidence, including date-line
clustering, input-order invariance, background/full parity and corrections.
Numbers may change after observed correction/error patterns, with a new rule
version and migration/rebuild checks. Passing those checks establishes
deterministic behavior on the cases, not reconstruction accuracy in the market.
