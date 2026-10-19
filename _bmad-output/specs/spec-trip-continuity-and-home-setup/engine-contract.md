# Engine and publication contract

## Current code facts, not a private-device diagnosis

At planning time, `reconstruction/engine.ts` constructs ordered and uncertain
visits in separate paths. The uncertain path can split same-day observations and
same-place revisits. V1 also limits semantic journeys to 30 days.
`mergeContinuousAwayJourneysV11` in `reconstruction/repository.ts` operates on the
resulting journey spans: it requires known away context and a nonnegative gap of
at most ten days. Overlapping fragments fail that predicate. A frequent holiday
can compete as a learned base where no configured home is available.
The repository calls `buildV11Episodes` to store diagnostic links, but persists
and qualifies the V1-derived graph for display. These facts explain failure
opportunities; they do not identify the exact blocker for any reported group.

## W0 decision record

For the currently displayed generation and each proposed adjacent pair record:

| Field | Required interpretation |
| --- | --- |
| Versions | Detector, parameters, normalization, source-scope, evidence, home-context and correction revisions |
| Reference | Private episode/edge keys internally; redacted session tokens in diagnostic view |
| Time | Instant/civil-day/interval/conflicting/incomparable, observed span and measured gap or unknown |
| Context | Applicable base keys/coverage, configured vs learned, candidate excluded or self-base detected |
| Evidence | Independent support counts, location availability, home observations, routine and conflicts |
| Decision | JOIN / BOUNDARY / UNCERTAIN, rule identifier and every blocking reason |
| Publication | Active/completed/stale/failed generation and whether the displayed row belongs to it |

Reason vocabulary includes `owner-boundary`, `owner-rejection`,
`corroborated-home-return`, `isolated-home-observation`, `same-day-unordered`,
`compatible-overlap`, `time-conflict`, `speed-conflict`, `incomparable-time`,
`base-context-missing`, `base-period-uncovered`, `candidate-self-base`,
`context-unstable`, `routine`, `ambiguous-gap`, `gap-over-limit`, and
`correction-remap-pending`. Collect all blockers, not only the first early return.
Unchanged/skipped rebuilds cannot imply that current rows used a new policy.

Diagnostics are local developer/About inspection, not journey-row copy. Normal
UI receives only human-readable limitations. Do not dump media references,
coordinates, exact raw captures or owner labels into console/test artifacts.
For the three owner groups, retain their before/after associations privately;
commit only synthetic reproductions and aggregate validation status.

## Authoritative processing sequence

1. Snapshot normalized native evidence, source scope, corrections and home revision.
2. Resolve capture units, reliable location and time conflicts under parent rules.
3. Build canonical sessions and original-day observations in one stream. A reliable
   capture instant does not require knowledge of its original timezone offset;
   original civil date remains separate. No current-phone-timezone substitution.
4. Compute parent two-pass C0/C1 date-scoped base/routine context. Honor all applicable
   configured homes without averaging them. Do not learn an automatic base from
   limited access or from the candidate holiday used in that evaluation.
5. Remove home/routine support from travel candidates; retain valid observations
   separately for boundary assessment. Filter before building travel episodes.
6. Construct away blocks and evaluate links/boundaries across the full stream.
7. Qualify completed episodes using the exact parent gates/SCORE/DAY/STAY profiles.
8. Resolve supported destinations; attach eligible media independently of visit
   evidence. Persist decisions, membership, lineage and a complete generation.
9. Publish the shared qualified projection atomically after revision validation.

`reconstructV1` remains unchanged as a baseline. Remove the old merger from active
V1.1 grouping once shadow acceptance is satisfied. A React grouping/deduplication
pass is prohibited: it would leave counts, media and owner corrections inconsistent.

## Membership versus order

Compatible same-original-day away observations may share one unordered day block
when no competing home block, conflict or owner boundary exists. Their place
order is unknown; their membership can still be shared. Stable IDs order storage
only. Compatible overlapping spans do not alone imply a boundary or a join:
evaluate their underlying observations, context and conflicts.

An uncertain same-day observation mixing with instant-bearing evidence joins only
when its available original-day/interval information is compatible under the
parent time model. Incomparable or contradictory evidence remains uncertain.
It cannot supply fake elapsed durations, extra sessions or corroboration. Repeated
places, country changes, month crossings and storage chunks do not create boundaries.

## Exact baseline continuity rules

| Situation | Decision |
| --- | --- |
| Explicit owner split/rejection constraint | Preserve boundary/constraint before automatic grouping |
| Corroborated home return | Boundary: upper-bound home distance <=20 km and two independent ordered sessions spanning >=60 min, or corroborated home blocks on two days |
| One isolated home point | Affected link uncertain; not a proven return |
| Comparable away blocks <=18 elapsed hours | Join with compatible base context and passing speed/conflict guards |
| >18 through 72 elapsed hours | Join only if each edge independently meets >=150 km effective distance or trusted foreign-to-all-bases condition; matching applicable context and no intervening home observation/conflict |
| Only comparable original civil days, gap <=2 days | Same far/foreign rule; do not claim elapsed hours |
| Other gaps through ten elapsed/civil days | Uncertain adjacency, not automatic pooled qualification |
| Gaps over ten days | Separate observed episodes without claiming return home |
| Missing GPS/name/offset, photo silence | No invented return or automatic boundary from missing information alone; apply the available time/link rules |

Parent ambiguous-component handling applies: independently qualified blocks may
retain separate observed episodes and one optional question; ambiguous pooling
cannot make weak blocks qualify. The first three reported holidays remain a
release gate if this produces false splits. Do not describe this baseline as a
guaranteed repair of longer photographic gaps.

If W0 finds a policy gap, create an amendment with the observed failure class,
exact additional evidence predicates, new version, boundary values, public
synthetic positive/negative controls and private comparison results. Same country,
same month or lack of home photos alone are not sufficient. Freeze the amendment
before implementation/activation. No threshold is guessed in this planning task.

## Home semantics

An owner area is context, not proof of owner presence or a home return. Its
geographic scope and effective dates are separate from the source journey.
Out-of-area media in that journey stays eligible travel evidence. Within-area
photos are excluded from automatic trip count/support and album membership;
retain originals locally. Preserve explicit owner-created/confirmed trip and
media decisions through the correction rules rather than silently deleting them.
Unknown-date or unknown-GPS photos are not classified home by assumption.

## Titles and consumers

Resolve names after grouping using a versioned offline country/region source with
island coverage, topology and attribution. The coarse current country dataset
does not supply a dependable Bali regional label; acquiring and testing the
replacement is required. Use regional label when supported, otherwise country,
otherwise the existing private unknown-location fallback. Owner-entered labels
are distinct from detected names. Never hardcode the reported holiday's label.

Show destination and month/year on separate text/layout lines. Retain ranges when
observed months differ. All destinations of one episode select the same trip and
combined paged album; show no invented travel route. One qualified projection
drives rows, filters, counts and Replay eligibility. Existing media/preview return
and permission guards apply. Supported destination count may exceed trip count.

## Revision-aware persistence

Implement parent generation/context/lineage/publication responsibilities using
current shared transaction serialization. Allocate migrations after the actual
latest schema (30 at planning time); do not reuse the parent document's historical
schema-28 starting number. Build outside long transactions in bounded batches;
yield/checkpoint at least every 100 units or two seconds.

Save Home changes with a durable context revision and pending rebuild request in
one short transaction. Snapshot and CAS that revision during generation commit.
If a rebuild is busy, coalesce to the newest requested revision and run after the
current promise settles. Never release the serialization/running guard early.
A generation containing an older home revision cannot satisfy this save operation.
Resume a pending request after restart; source changes make it stale and trigger
recomputation. Do not lose queued evidence changes.

Preserve parent exact-support correction matching and pinned projections; lineage
similarity never transfers owner edits. Keep the previous complete Atlas while
building/failing. Legacy comparison, activation and rollback remain revision-bound;
rollback retains latest owner decisions and never restores deleted private data.
