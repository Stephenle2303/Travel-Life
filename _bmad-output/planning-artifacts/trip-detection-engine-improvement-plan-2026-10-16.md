# Travel Life automatic trip recognition: party proposal

Date: 2026-10-16 (Asia/Bangkok).
Status: concrete planning proposal; application code and detector rules unchanged.
Superseded for implementation by [the complete V1.1 contract](../specs/spec-trip-detection-engine-v1-1/SPEC.md)
and its companions. Keep this exploratory proposal for rationale only; its deferred
algorithm choices are resolved in the canonical contract.
Input: owner's Trip Detection Engine V1.1 requirement and subsequent direction to
deliver a solid automatic experience with very few review/confirmation actions.

## Product outcome

Connect the library, let the engine reconstruct privately, and reveal recognizable
trips with real local memories. Ordinary life stays out of the travel record.
Strong results need no per-trip confirmation. A small optional review surface
contains only useful unresolved episodes, never every low-quality cluster.
Incomplete evidence must remain incomplete; automatic recognition does not verify
owner presence. Correction and manual entry remain available.

## Findings from current code

- `apps/mobile/src/reconstruction/engine.ts`, `reconstructV1`: spatial support
  becomes visits, and each unblocked visit can seed an inferred journey. There
  is no five-photo eligibility, base-distance qualification, learned routine
  veto, or auto-recognition decision before that journey is created. The current
  baseline was designed to produce drafts, so this is a product-contract gap.
- The same function splits/joins using visit gaps and a 30-day cap. Its weak-time
  path keeps same-day visits separate. Native imports set `hasPreciseOffset` to
  false, making that path consequential for the actual product. This can
  fragment a same-day multi-place episode. It is a code-supported failure mode,
  not a claim that any particular private trip has been inspected.
- `apps/mobile/src/reconstruction/repository.ts`, `loadDurableReveal`: the latest
  completed run is selected without a trip-qualification predicate. Statistics
  count all reconstructed journeys/places/countries. Candidate output becomes
  the primary record rather than remaining an internal detection intermediate.
- `apps/mobile/src/reveal/projection.ts`, `projectReveal`: durable journeys are
  mapped directly to display records; `inferred` becomes the visible Inferred
  status. Any nonempty ready record enables replay eligibility in this model.
- `apps/mobile/src/photo-access/native-adapter.ts`, `candidateFromMetadata`:
  creation time is used without capture-source provenance; the civil day is
  derived in the phone's current timezone; precise offset is always false;
  source origin and platform duplicate family are null; support eligibility is
  true. The engine therefore cannot yet prove several promised filtering rules.
- Production reconstruction input currently has no learned, date-scoped base
  model or routine classifier. The pure engine's optional usual-area flag is
  not a substitute for either.
- Current duplicate/correction machinery in `repository.ts` is more developed
  than older architecture notes. Preserve it and test its remapping under the
  new detector; do not restart correction persistence from an old snapshot.

No private library content was read. The reported UI dissatisfaction is valid
product evidence; the exact false-positive count remains unmeasured.

## Decisions the party recommends

1. Separate internal candidates from trips eligible for the primary Atlas.
2. Learn temporal home/routine context automatically when evidence is strong;
   request a single base clarification only when that context is ambiguous.
3. Recognize an away episode before assigning its media and destination groups.
4. Require independent location corroboration and five distinct eligible photos
   for automatic recognition. Videos may attach without meeting that threshold.
5. Treat the supplied score as a reproducible baseline/diagnostic, and compare it
   against evidence-profile decisions before choosing the production policy.
6. Evaluate precision, recoverable-trip recall, and review burden together. A
   near-empty map cannot pass merely because its precision is high.

Items 2 and 5 refine the pasted requirement. They are proposals, not silently
approved changes to its unknown-base rule or exact score-based classification.
The existing decisions remain authoritative until a versioned engine contract
records the chosen replacements.

## Evidence and normalization

Retain media kind, capture-time source/precision, native instant where reliable,
original offset/civil day where available, GPS accuracy/provenance, source-origin
certainty, duplicate/burst support group, and metadata revision. Keep unknown
values explicit. Use native creation time as a fallback with its documented
semantics, not as invented EXIF or upload time. Do not replace historical local
days with the current device timezone. An absolute instant can establish elapsed
order without establishing the original local calendar day.

Prefer metadata already available on device. Add a bounded native capability
spike for Android/iOS capture metadata, screenshot/source flags and duplicate
signals before promising those fields. Missing platform flags are unknown, not
proof of a download or original capture. Known screenshots/downloads cannot
support automatic recognition; legitimate owner-attached media remain usable.

Use stable source IDs for reimport idempotency. Use verified duplicate identity
where available; identical metadata alone does not prove that two images are
copies. Conservative near-identical timestamp/location groups may collapse
independent location support without deleting or asserting pixel duplication.
Unknown duplicate independence cannot be exploited to meet the photo gate.
Avoid full-library image hashing as a mandatory startup step.

GPS fixes must have usable spatial bounds. Unknown accuracy requires stronger
context; the current 5 km admissibility threshold is not itself a trust guarantee.
Distance eligibility uses an observed away anchor and all applicable bases,
with an uncertainty margin: a central estimate beyond 50 km is insufficient if
plausible position error crosses the boundary. No GPS-less asset establishes a
place. Impossible jumps or conflicting duplicate geotags are quarantined from
automatic support rather than repaired with convenient coordinates.

## Temporal bases and routines

Maintain multiple base candidates with effective date intervals. A current home
must not be applied to a trip from before a move. Secondary residences count only
in their applicable periods; uncertainty between plausible bases uses the nearest
applicable alternative for conservative distance testing.

Base learning uses recurrence across separated ordinary-life periods, evidence
before/after excursions, and location stability. Photo volume, one long stay,
or the most photographed city cannot establish a home. Provisional development
eligibility for an automatically usable base requires observations in at least
three separated weeks spanning 90 days, corroborating ordinary-life context,
and no unresolved competing residence pattern. These are testable starting
parameters, not measured truths; the native-data spike and evaluation can reject
them. Sparse/selected libraries must not be treated as full behavior coverage.

When that bar is unmet, keep a private candidate and ask one high-value question
such as confirming a likely base and its period. Do not ask the user to rescue
every trip. If they skip it, preserve evidence and manual access; withhold
automatic confirmation that depends on an unknown base.

Routine detection is separate from base detection. Repeated short excursions
from a base with comparable weekday/time patterns can identify commutes/work
locations. Repetition alone cannot veto a destination: annual holidays, family
visits and irregular business travel remain travel candidates. Routine vetoes
must cite temporal recurrence and episode context, with confidence, support,
effective period and detector version. A routine route does not become a drawn
or claimed travel route. Evidence used to assess a candidate must not manufacture
its own rarity or establish its own base/routine veto.

## Episode recognition

Pipeline: normalize evidence -> support/session grouping -> temporal base/routine
context -> away-episode candidates -> hard gates -> qualification -> media
membership -> destination grouping -> atomic private Atlas publication.

Reuse existing spatial clustering for support grouping after checking its scale;
its 5 km places are not automatically cities. Detect destination groups within an
episode, never merge unrelated trips because their country or city matches.

Use states for ordinary context, possible departure, supported away episode,
possible return, and completed/open episode. Missing photos are absence of
observation, not observed return. Two silent days cannot create a home boundary.
Strong coherent away observations can form a recognized episode without a
photographed return; preserve an unknown return date. Conversely, long silent
intervals cannot connect arbitrary trips indefinitely. Compare continuity and
separation hypotheses using bases, intervening observations, temporal span and
spatial plausibility; unresolved relationships stay internal or become one useful
review item. A resource/processing cap never defines a semantic trip boundary.

Day trips qualify. Separate same-day destinations can share an episode even
when within-day order is unknown; do not invent a Tokyo -> Kyoto ordering from
source IDs. Tokyo/Kyoto/Osaka can be one episode with three supported destinations,
including silent days when continuity is sufficiently supported. Independent
visits to Japan remain separate episodes. Return-to-base evidence is evaluated
for reliability; one suspicious home geotag must not split a holiday.

Sessions group a short time/space burst into one support opportunity. Configured
session thresholds must be versioned and tested for jitter, midnight and boundary
conditions. Two sessions are not a universal eligibility rule: a same-day outing
can qualify through independently corroborated distinct locations. Twenty burst
copies at one spot cannot corroborate one another. Distinct-location corroboration
must be time/spatially plausible and independent of duplicate/burst support.

## Qualification and score-policy comparison

Hard gates for automatic recognition: reliable date-scoped base context; trusted
away destination at least 50 km from every applicable base; five distinct eligible
photos; independent location corroboration; no confident routine veto; no unresolved
critical time/location contradiction; no overriding owner rejection/boundary.
Owner-confirmed/manual trips bypass those auto gates while retaining honest
destination evidence and all owner decisions.

Preserve the supplied +30/+10/+45/+15/+15/+10/+5/-55 formula, clamp 0-100,
and store each signal and reason under a named baseline policy. Country bonus
requires trusted country resolution for all relevant bases and the destination;
unknown/border ambiguity cannot become foreign. The score is not a probability.

The proposed production comparator recognizes explicit evidence profiles:

- Corroborated away day trip: independent sessions or coherent independent
  places, five photos, nonroutine away context, and sufficient episode coherence.
- Corroborated longer trip: coherent away observations across separated sessions,
  sufficient boundary/continuity evidence, five photos and no competing episode.
- Corroborated repeat trip: the same safety conditions hold without requiring
  novelty. Annual repeat holidays cannot lose recognition merely by becoming rare
  destinations no longer. Distance/country alone never establishes a profile.

These profiles must be formalized into pure predicates and tested, not implemented
as vague 'coherence' flags. The short spike produces their exact operational
thresholds from obtainable metadata; the baseline is executable independently.
Until that happens, this is a sound architectural plan but not an approved exact
replacement algorithm. Hold the production classifier choice until comparative
evidence exists. Never bypass a hard gate with a profile or a high score.

The original 60 km/one-session/new-place case remains suggested under the baseline.
Known routine 55 km cases fail regardless of score. Five same-day photos establish
photo eligibility only. An obvious well-supported repeat domestic holiday may
pass the proposed profile while falling below 70 in the baseline; record that
deliberate policy difference in acceptance results.

## Persistence, correction and the primary experience

Keep evidence quality, episode-boundary uncertainty, qualification, owner review
state and source availability separate. Internal states distinguish insufficient
evidence from known not-travel, rejected and pending-remap records. Do not use
NOT_TRIP to mean 'we do not know.' AUTO_CONFIRMED, if retained for compatibility,
means engine-qualified, never owner-verified. Prefer owner-facing 'Detected' and
'Reviewed by you', with concise evidence information reachable on demand.

Version normalized metadata, base/routine context, detector parameters and the
decision independently. Keep stable episode identity separate from an exact set
of media IDs. Match successors through canonical support overlap plus temporal,
spatial and boundary constraints; preserve lineage for additions, splits and
merges. Overlap alone cannot transfer a correction to a different episode.
Ambiguous remapping preserves the last owner-approved projection and blocks the
affected candidate, rather than silently overwriting it or blocking every trip.

Query primary Atlas/Timeline/counts/replay from the same qualified projection.
Plot only individually supported destinations, including within manually confirmed
trips; a trip-level decision cannot validate an unsupported city. Sharing continues
to require an owner-selected preview and explicit publishing. No inferred routes.
Existing map context, gallery paging and local preview permissions remain intact.

The normal reveal contains detected trips with useful photos and date context,
not a long list of generic Inferred cards. Suppress candidate noise before the
UI boundary. Review is optional and deduplicated by episode: ask about a base,
a consequential split/merge, or a promising ambiguous trip. Show a small set at a
time with a dismissible summary; never hide a large workload behind pagination
and call it low burden. Repeated imports cannot re-ask a resolved question.
Place labels require trusted local naming data or owner claims; existing coarse
country geometry must not be presented as a city-name service.

## Ordered delivery and release evidence

1. **Baseline and metadata feasibility.** Instrument safe aggregate dispositions,
   publication counts, and false-trip categories; make the supplied 15 fixtures
   executable against a pure policy adapter. Verify obtainable native metadata
   on iOS/Android and define exact base/routine/session/profile predicates. Output:
   a versioned engine contract and a testable threshold registry.
2. **Evidence and temporal context.** Implement normalization corrections,
   support independence and persisted temporal bases/routines. Refresh old
   metadata only when needed and only under current permission. Output: reliable
   inputs and context, tested with moves, secondary homes, holidays and limited
   source scope. No claim of improved trips from plumbing checks alone.
3. **Episode and qualification engine.** Build the pure episode states, hard
   gates, baseline score and profile comparator. Add destinations and conservative
   GPS-less membership after qualification. Output: complete candidate decisions,
   with reasons, input/version provenance and uncertainty dimensions.
4. **Safe persistence and experience.** Integrate durable identity/corrections,
   atomic publication and the common qualified query; implement the small optional
   review flow and replace candidate-driven counts/replay eligibility. Output:
   end-to-end owner flow with no mandatory per-trip confirmation.
5. **Shadow comparison and recoverable migration.** Run old/new detectors locally
   on the same authorized evidence without altering the live map. Produce private
   old/new IDs, counts, reasons, destination changes and correction mappings; expose
   only redacted aggregates externally. Preserve an encrypted/private-storage-safe
   local snapshot of the previous derived projection and version references.
   Switching the legacy live projection requires explicit approval. Roll back
   publication to the prior generation without deleting media or rewinding newer
   owner edits; reconcile those revisions before rollback publication.

Do not ship only a query filter as the finished improvement: it could empty the
Atlas without recovering meaningful trips. These packages are an ordered engine
delivery, with a complete automatic-reveal acceptance checkpoint at the end.

## Acceptance and measurement

Keep all 15 pasted cases and listed boundaries as baseline policy tests, including
the exact score-70/score-45 outcomes, five-photo cutoff, foreign-to-all-bases gate,
videos, duplicate independence, manual preservation and repeated-library import.
Where the proposed policy intentionally differs, test both expected results and
record the reason; do not silently rewrite the source acceptance criteria.

Add regressions for same-day uncertain ordering without fragmentation; annual
return holidays; 60 km commutes; one 90-day holiday not becoming a base; moving
homes; two active residences; unknown accuracy near 50 km; one wrong home geotag;
travel across midnight/date line; changing device timezone; reused downloaded
images; unknown provenance; GPS-less bracket conflicts; trips longer than a
processing cap; sparse silence versus a real return; restricted permissions;
incremental/full parity; successor identity and corrections; interrupted rebuilds;
query-level filtering and count/replay consistency.

Use a small owner-authorized local evaluation as delivery evidence, not a new
pre-launch market-research gate. Sampling must include current displayed trips,
new detections, withheld candidates and a sample of library periods with no
detection. Reviewing only displayed trips cannot measure recall. Tune and hold
out at library/person level where possible to avoid near-duplicate leakage.
Consent to import does not authorize uploading private evidence for evaluation.

Proposed product targets: at least 95% precision for automatically shown trips;
at least 90% recall within the explicitly labeled evidence-eligible trip subset;
at most 5% of those trips requiring an owner action. Report TP/FP/FN, denominators,
person/library slices, all-trip coverage, review questions per library, base-setup
actions and cases unresolved after review. Also measure false split/merge rates,
unsupported destinations, correction churn, import/runtime and memory budgets.
These targets are proposed acceptance goals, not measured results. Small datasets
must show counts and uncertainty; 19/20 correct is not proof of population 95%
precision. Do not use the diagnostic score as a confidence percentage.

Run pure engine tests, repository/migration/correction/query integration tests,
mobile typecheck/lint/tests, root `npm run check`, and physical Android/iOS
automatic-reveal flows. A synthetic pass or clean native log cannot establish
reconstruction quality or low user effort.

## Remaining concrete uncertainty

Native metadata availability and the exact profile thresholds require the first
delivery spike; real automatic precision/recall/review burden require labeled
evidence. Photo libraries cannot always establish presence, original source,
historical home or exact trip boundaries. The engine must abstain in those cases
without turning abstention into a queue of mandatory owner tasks.
