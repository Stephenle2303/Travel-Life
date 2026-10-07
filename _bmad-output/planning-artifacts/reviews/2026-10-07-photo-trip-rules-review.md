# Photo-to-trip rules review

Date: 2026-10-07
Status: reviewed recommendations adopted into MVP spec revision 5 by decision 0006.
This remains the historical critique; the MVP spec is the operative rule set.
Scope: MVP spec revision 4, reconstruction data model and rules, related AI/background behavior, M2/M4 stories, eval roadmap, and the previous chat recommendation.
Method: BMAD adversarial, edge-case and document-structure lenses. Independent reviewers examined the same specification. Findings overlap intentionally; they are not counts of unique defects.
Evidence: document analysis and constructed counterexamples only. No engine, real-library benchmark or measured accuracy exists. No implementation was performed.

## Assessment

Keep metadata-first reconstruction, optional bounded AI, honest uncertainty, local fallback and durable corrections. The current rule set is insufficiently specified as the photo-to-trip membership contract. The problem is not finding a better universal numeric cutoff: temporal proximity, spatial proximity, trip membership and owner presence are different judgments.

The three-day rule can chain months of frequent photos into one journey and split a single sparsely photographed holiday. Five kilometres can be a configurable spatial grouping parameter, but it cannot define a visit or trip. The bounded-diameter algorithm is not yet specified. The fifty-kilometre usual-area band needs historical applicability and must not exclude local outings.

The previous chat recommendation also needs qualification. A home-located photo is not an owner-confirmed return. Replacing the three-day cutoff with unlimited continuity creates uncontrolled merging. Strong/possible/user-assigned mixes evidence strength and decision authority; represent those separately.

## Recommended decision flow (proposal)

1. Normalize evidence without creating precision. Preserve capture time, offset/precision, location, source uncertainty and exclusions. Duplicate copies must not count as independent corroboration.
2. Maintain geographic places separately from chronological visits. Returning to the same place produces another visit when the episode differs; A-B-A remains visible.
3. Construct provisional trip segments from comparable time and location evidence. Treat time gaps as candidate-boundary signals. Do not let a chain of frequent local photos establish one trip. Segments can carry a possible-merge relationship; missing photos alone do not authorize joining them. Numerical limits and tie-breaks still need explicit versioned definitions in M2.1.
4. Apply owner-defined episode boundaries and membership constraints. Date-scoped usual areas provide context. Inferred home proximity remains a signal; it does not become a hard trip-end assertion.
5. Attach photos to established candidate episodes. Use comparable capture time, compatible location when present, bounded surrounding context and absence of conflicting boundaries. A GPS-less image can be a tentative trip memory without gaining an invented location. Multiple plausible candidates or weak evidence remain unresolved and accessible for correction.
6. Store photo-to-trip membership separately from photo-to-visit support. Keep association state (suggested/accepted/rejected), decision source (rule/AI/owner), reason codes and evidence version separate. These are proposed states, not calibrated confidence percentages.
7. Give AI only bounded permitted alternatives and the permitted structural context needed to distinguish them. Validate constraints and revisions as well as references. AI can suggest, explain or abstain; it cannot supply evidence absent from the input.
8. Reconcile background changes with stable lineage and scoped corrections. New facts do not inherit an older journey's confirmation. Discard or revalidate stale proposals. Test final incremental results against full reconstruction on matching evidence, rules and corrections.

The UX should automatically show supported draft journeys and isolate uncertain associations for lightweight correction. Do not require confirmation of every photo, and do not silently convert every image inside a broad date range into a verified trip memory. Owner-selected illustrative media can be retained without becoming evidence of a visit.

## Small behavior examples to settle inside delivery

| Constructed case | Expected proposal behavior | Prohibited inference |
| --- | --- | --- |
| Tokyo day 1, Kyoto day 6, no intervening photos | Retain both supported visits; continuity remains a bounded hypothesis or owner decision | Five silent days prove either a new trip or a continuous trip |
| Trip A, explicit owner-confirmed return, trip B two days later | Preserve separate episodes | Short time gap overrides the owner boundary |
| A lone home-located imported image between overseas photos | Retain conflicting source/time evidence for review | Home coordinates alone end the trip |
| Two Tokyo visits months apart | One reusable place, separate chronological visits | Same location means same visit |
| GPS-less photo between compatible observations in one bounded episode | Tentative membership may be proposed; location stays unknown | Membership supplies GPS or a visited-country fact |
| GPS-less photo matching two candidate episodes | Keep unresolved candidates or unassigned state | Arbitrarily choose the nearest episode |
| Shared companion image versus unrelated downloaded image with matching metadata | Preserve origin uncertainty and allow correction | Metadata alone distinguishes owner presence |
| Residence change during imported history | Apply usual-area assertions only in their effective periods | Current home classifies all history |
| Late evidence bridges previously split journeys | Respect explicit split constraints; new association is reviewable | A prior correction silently disappears |
| AI response arrives after an owner correction | Reject or revalidate against the new revision | Old proposal overwrites a newer correction |

These are engineering examples, not a market research gate or a representative accuracy benchmark. Evaluate photo membership errors, split/merge errors, unsupported destination claims, unresolved cases and correction burden separately. Schema-valid output is not enough to prove the intended behavior.

## Findings by lens

Each block records the trigger, concrete recommended guard and consequence. Overlap between lenses is retained rather than deduplicated.

### adversarial

**1. MVP spec / three-calendar-day grouping**

- Trigger: Frequent photos, including local activity, connect months of observations.
- Guard: Recommended: Specify episode-boundary evidence and whether local observations participate; adjacent gaps alone cannot define a trip.
- Consequence: Transitive grouping merges separate trips into one months-long journey.

**2. MVP spec / larger gaps create separate candidates**

- Trigger: Tokyo on day 1 and Kyoto on day 6 belong to one continuous holiday.
- Guard: Recommended: Retain observed segments with an unresolved relationship; use bounded merge rules or owner merge. Uncertainty alone must not merge.
- Consequence: Sparse photography fragments trips; unlimited gap tolerance creates the opposite error.

**3. MVP spec / timestamps and place-days**

- Trigger: Midnight, changing or missing offsets, or date-only timestamps make gaps ambiguous.
- Guard: Recommended: Define the calendar and comparison semantics; preserve uncertain intervals and avoid invented ordering.
- Consequence: Assignments vary with device timezone or implementation choices.

**4. MVP spec / place clustering; Place/visit draft**

- Trigger: The same hotel is visited in January and June or twice within one journey.
- Guard: Recommended: Separate geographic place identity from chronological visit identity; specify episode boundaries.
- Consequence: Separate visits collapse and chronological sequences are lost.

**5. MVP spec / five-kilometre neighborhood and bounded diameter**

- Trigger: A-B and B-C are near, A-C exceeds the bound, and B arrives later.
- Guard: Recommended: Specify diameter, distance calculation, tie-break and deterministic ordering; compare full and incremental results.
- Consequence: Import order changes places and journeys.

**6. MVP spec / optional usual area**

- Trigger: The owner moves, has two homes, or imports history predating the current home.
- Guard: Recommended: Give confirmed usual areas effective periods, permitting multiple areas and unknown applicability.
- Consequence: Current home misclassifies past residence or holidays.

**7. MVP spec / previous recommendation: return-home precedence**

- Trigger: A single home-located image is imported, incorrectly tagged or uncertain in time.
- Guard: Recommended: Separate an owner-confirmed return from home-proximate metadata; only the explicit owner boundary is binding.
- Consequence: A false home signal splits a genuine trip.

**8. MVP spec / data contract; previous membership categories**

- Trigger: A companion's photo is a legitimate memory, or a downloaded image depicts an unvisited place.
- Guard: Recommended: Separate trip association, contribution to location evidence and owner confirmation; no probability implied by category names.
- Consequence: Trip relevance is confused with proof of presence, or legitimate memories are excluded.

**9. MVP spec / missing GPS; previous temporal-bracketing recommendation**

- Trigger: An unlocated photo lies between different trips or has only an ambiguous day timestamp.
- Guard: Recommended: Require comparable time, bounded context, one compatible candidate and no conflicting boundary; otherwise retain candidates or leave unassigned.
- Consequence: Unrelated photos are attached or a location is fabricated.

**10. MVP spec / AI minimized summaries**

- Trigger: Cases with different confirmed boundaries have identical coarse places, offsets and counts.
- Guard: Recommended: Derive constraints locally; send only eligible alternatives and permitted structural constraints, then enforce them locally.
- Consequence: AI cannot recover omitted context and guesses between cases requiring different outcomes.

**11. MVP spec / AI evidence-reference validation**

- Trigger: Real evidence IDs are combined into an unsupported journey or narrative.
- Guard: Recommended: Validate claimed relationships and allowed reason codes, not only existence of IDs; keep narrative reviewable.
- Consequence: Structurally valid output makes an unsupported grouping or claim.

**12. MVP spec / correction overlay; background maintenance**

- Trigger: A corrected target splits, merges or changes identity after new evidence.
- Guard: Recommended: Define correction scope over evidence membership and boundaries, identity lineage and conflict handling.
- Consequence: Corrections disappear or attach to the wrong successor.

**13. MVP spec / confirmed journey; background maintenance**

- Trigger: New evidence adds a destination, photo or date extension to a confirmed journey.
- Guard: Recommended: Confirmation covers reviewed facts and membership versions; additions remain inferred or pending.
- Consequence: Unreviewed additions inherit confirmation and affect future sharing previews.

**14. MVP spec / affected background neighborhoods**

- Trigger: A bridging photo triggers further transitive candidate merges.
- Guard: Recommended: Define dependency expansion and convergence; checkpoint bounded work and keep partial reconciliation visibly pending.
- Consequence: Incremental and full results differ, or background work becomes unbounded.

**15. MVP spec / eval roadmap; M2.4**

- Trigger: Both opposite split/merge outputs satisfy support and schema checks.
- Guard: Recommended: Add expected membership, acceptable ambiguity and prohibited assertions for core cases, including reordered and incremental imports.
- Consequence: Tests pass without specifying the engine's defining behavior.

### edge-case-hunter

**1. _bmad-output/planning-artifacts/mvp-spec.md:92-98**

- Trigger: Timestamp precision or missing timezone makes the three-calendar-day comparison ambiguous.
- Guard: Recommended: Compare explicit time intervals; indeterminate ordering or gap retains an uncertain boundary.
- Consequence: Identical evidence receives different assignments depending on timezone assumptions.

**2. _bmad-output/planning-artifacts/mvp-spec.md:94-98**

- Trigger: Photos revisit the same geographical place before and after another destination.
- Guard: Recommended: Separate reusable place identity from chronological visits; preserve A-B-A episodes.
- Consequence: Repeated visits collapse, losing sequence or assigning photos to the wrong episode.

**3. _bmad-output/planning-artifacts/mvp-spec.md:94-96**

- Trigger: One photo fits multiple nearby clusters whose union exceeds the diameter bound.
- Guard: Recommended: Specify diameter, metric and stable tie-break; verify input-order invariance.
- Consequence: Import order or background additions change place membership and trip boundaries.

**4. _bmad-output/planning-artifacts/mvp-spec.md:97-103**

- Trigger: Frequent photos bridge trips through local activity or an intervening return home.
- Guard: Recommended: Evaluate episode-boundary evidence before linking; unresolved boundaries remain reviewable.
- Consequence: A short-gap chain merges unrelated trips into one long journey.

**5. _bmad-output/planning-artifacts/mvp-spec.md:97-105**

- Trigger: Gap-uncertainty refinement encounters successive sparse trips without reliable return-home evidence.
- Guard: Recommended: Keep bounded candidate episodes and possible-merge relations; uncertainty never authorizes merging alone.
- Consequence: Open-ended continuity merges months of unrelated travel.

**6. _bmad-output/planning-artifacts/mvp-spec.md:99-105**

- Trigger: A traveller changes residence, maintains two usual areas or revisits a former home.
- Guard: Recommended: Usual-area assertions carry effective dates, multiple areas and unknown periods.
- Consequence: Today's home classification rewrites historical travel and residence.

**7. _bmad-output/planning-artifacts/mvp-spec.md:99-105**

- Trigger: A near-home airport, transfer or downloaded home photo appears between trip destinations.
- Guard: Recommended: Distinguish home-proximate evidence from an owner-confirmed episode end.
- Consequence: Incidental near-home evidence splits a continuing journey.

**8. _bmad-output/planning-artifacts/mvp-spec.md:104-107**

- Trigger: A GPS-less photo fits two journeys or lies between geotagged photos separated by weeks.
- Guard: Recommended: Require comparable capture times, bounded context and one compatible candidate; otherwise leave unassigned.
- Consequence: Temporal bracketing attaches unrelated images or arbitrarily chooses a journey.

**9. _bmad-output/planning-artifacts/mvp-spec.md:67-76**

- Trigger: A photo belongs to a journey without a defensible destination assignment.
- Guard: Recommended: Represent journey membership separately from visit support, with uncertainty and owner assignment.
- Consequence: The model fabricates a place or cannot retain a relevant trip photo.

**10. _bmad-output/planning-artifacts/mvp-spec.md:104-105**

- Trigger: Shared or downloaded photos contain valid trip-compatible timestamps and GPS.
- Guard: Recommended: Separate contextual relevance from presence support; preserve association source uncertainty.
- Consequence: Relevant memories incorrectly contribute destinations or owner-presence claims.

**11. _bmad-output/planning-artifacts/mvp-spec.md:73-76,128-130**

- Trigger: Late evidence extends or bridges confirmed and unconfirmed journeys.
- Guard: Recommended: Confirmation covers reviewed facts and membership versions; additions remain inferred.
- Consequence: New evidence inherits confirmation and appears reviewed in future sharing previews.

**12. _bmad-output/planning-artifacts/mvp-spec.md:75-76,128-130**

- Trigger: Reconstruction splits or merges the target of an earlier correction.
- Guard: Recommended: Persist correction scope and lineage; resolve ambiguous remapping before structural changes commit.
- Consequence: Corrections orphan, disappear or attach to the wrong successor.

**13. _bmad-output/planning-artifacts/mvp-spec.md:128-135,158-161**

- Trigger: An AI response completes after evidence changes or the owner edits the journey.
- Guard: Recommended: Bind proposals to evidence, correction and consent revisions; discard or revalidate stale results.
- Consequence: Stale proposals restore obsolete evidence or undo newer grouping.

**14. _bmad-output/planning-artifacts/mvp-spec.md:150-160**

- Trigger: Opaque IDs and day offsets conceal geographic relationships needed for grouping.
- Guard: Recommended: Derive permitted coarse relationship flags locally or withhold grouping when context is absent.
- Consequence: AI groups without discriminating evidence; schema checks cannot detect arbitrary reasoning.

### Document structure

Purpose: help product and engineering readers understand recorded reconstruction behavior and its limits.
Model: Strategic/Context (Pyramid), with reference-style contracts.
Word metrics from the structure review: 2,143 overall; 894 across the four reviewed sections.

| Pass | Original text | Recommended revision | Changes |
| --- | --- | --- | --- |
| structure | Initial reconstruction rules: 313 words mixing operations and interpretation constraints | MOVE existing bullets into Evidence preparation, Place and journey grouping, and Interpretation and correction constraints | No body-word reduction; headings add a few words. Preserve rules and thresholds until separately changed. Do not imply an execution sequence that has not been decided. |
| structure | AI contract: 216 words following 176-word background contract | MOVE AI contract immediately after reconstruction rules | No word reduction. Readers see the whole reconstruction approach before scheduling details. |
| structure | Opening statement that heuristics are configurable and unvalidated | PRESERVE | No word reduction. Keep recommendation status distinct from recorded behavior. |

Three structural recommendations; estimated reduction 0 words (0%). No length target was supplied; no explanatory material is removed.

## Follow-through

The user subsequently asked to adopt the proposal. MVP spec revision 5 and decision 0006 now contain an explicit decision table and separate association/visit model; M2.3/M2.6/M4.1 and M2.4 carry stale-proposal, correction-lineage and regression expectations. Exact bounded parameters remain part of M2.1 delivery. No discovery phase or app implementation was added.
