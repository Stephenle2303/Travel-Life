---
id: SPEC-trip-detection-engine-v1-1
companions:
  - algorithm.md
  - native-evidence.md
  - persistence.md
  - acceptance.md
  - delivery-plan.md
  - ../../../docs/product/design-system.md
sources:
  - ../../planning-artifacts/trip-detection-engine-improvement-plan-2026-10-16.md
---

> Canonical implementation contract derived from the decision log. This planning
> contract supersedes the earlier exploratory proposal, whose unresolved algorithm
> choices must not be used as implementation defaults. No application changes or
> live migration are performed by this specification.

# Automatic trip recognition V1.1

## Why

The owner sees many inferred journeys and finds the result untrustworthy. Travel
Life must automatically reveal recognizable travel episodes, retain useful media,
and require intervention only for a small minority of genuinely ambiguous cases.
Correctness, useful coverage and owner effort must improve together.

## Capabilities

- **CAP-1**
  - **intent:** The engine can distinguish usable capture evidence from unsupported media.
  - **success:** Both native adapters produce the normalized contract, never download originals for detection, and conservatively count independent photos/location support.
- **CAP-2**
  - **intent:** The engine can distinguish travel from ordinary life throughout a changing residence history.
  - **success:** Date-scoped base/routine predicates produce the specified outcomes for moves, secondary homes, distant commutes, repeated holidays and missing context.
- **CAP-3**
  - **intent:** The owner can receive coherent automatic trips with supported destinations.
  - **success:** Exact episode, hard-gate, score and profile predicates satisfy the source fixtures and extended boundary matrix without treating silence as return home.
- **CAP-4**
  - **intent:** The owner's record can evolve without losing decisions or exposing partial rebuilds.
  - **success:** Atomic qualified generations drive Atlas/Timeline/counts/replay; rejection, manual trips, edits, split/merge and remap behavior survive rebuild and rollback.
- **CAP-5**
  - **intent:** The owner can enjoy a travel reveal without confirming each result.
  - **success:** Recognized trips appear directly; optional, deduplicated questions target high-value ambiguity and primary Atlas queries exclude internal drafts.
- **CAP-6**
  - **intent:** The owner can adopt the improved engine reversibly and assess its actual quality.
  - **success:** Dry-run manifests, revision-bound activation, rollback, correction preservation and honest labeled-quality reports meet the delivery checklist.

## Constraints

- Pure deterministic rules, versioned parameters, current native/SQLite/MapLibre architecture; no provider, vision/LLM call, paid service or upstream dependency patch.
- All automatic paths pass the same base, away-distance, five-photo, independent-location, routine and contradiction gates. Manual/owner-confirmed trips bypass auto gates but do not manufacture coordinates or visited destinations.
- Evidence, normalized metadata and local media stay on device. Public tests are synthetic. Source permissions and lifecycle invalidation apply to every read/publication.
- Owner decisions override detection. Exact-support correction remapping remains authoritative; identity heuristics cannot broaden correction scope.
- Preserve Living Atlas interaction, preview/gallery and correction-return contracts. Sharing still requires an explicitly selected preview and publication.
- Legacy live switching requires explicit approval of a concrete revision-bound dry run. New import operation and migration remain distinct.

## Non-goals

- Proving owner presence, inferring location from image contents, invented travel routes, exact departure/return dates, city-name guessing or public automatic publishing.
- Perfect recovery from missing historical evidence, global image-content deduplication, replacing the map provider or developing Replay rendering in this work.

## Success signal

On both platforms, connect/import -> automatic qualified Atlas -> local trip
memories works without per-trip confirmation; routine photos do not become trips.
All acceptance cases and integration checks pass. Labeled evaluation targets
95% automatic precision, 90% evidence-eligible recall and at most 5% trip-action
rate; these are delivery targets, not established performance. Report base actions,
all-trip omissions, counts and uncertainty as well.

## Assumptions

- The party selects the exact parameters and two profile extensions in algorithm.md
  as engineering defaults for implementation. Learned usable bases and automatic
  classification below score 70 explicitly refine the pasted V1.1 proposal; the
  difference ledger preserves original-policy expectations. They are recommendations
  under the user's planning request, not an assertion of separately approved policy.
- A small local native metadata module is justified by verified installed-library
  omissions; it uses existing platform frameworks and adds no cloud dependency.
- Quality targets may fail on real evidence. Failure requires a new versioned rule
  revision, not fabricated labels, silent threshold changes or unlimited review.

## Open Questions

No unresolved design choice prevents implementation of this selected contract.
Device availability and consent for private labeled evaluation are execution
dependencies. Missing either prevents the corresponding validation claim, not
implementation of the specified synthetic/native fallback behavior.
