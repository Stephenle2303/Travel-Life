---
id: SPEC-recognizable-travel-reconstruction
date: 2026-11-10
status: in-progress
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
companions:
  - delivery.md
  - experience.md
  - inference-and-authority.md
  - delivery-and-diagnostics.md
  - acceptance-and-eval.md
  - ../spec-home-first-journey-integrity/SPEC.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources: []
---

# Recognizable travel reconstruction and first Atlas reveal

[Decision 0017](../../../docs/decisions/0017-trip-merge-review-and-home-search.md)
keeps independently qualified trips separate in Timeline when a plausible
join lacks continuity evidence. Show a Timeline cue for the exact pair and
open a review before any merge is committed.

## Why

The first Atlas should help someone recognize their travel. The existing
detector can mistake routine photos for a trip, split a continuous holiday,
and miss a real outing close to home. A useful reveal needs credible trip
grouping, recognizable media, and a lightweight way to resolve uncertainty.

## Capabilities

- **CAP-1**
  - **intent:** Recognize travel in the first Atlas without completing a review.
  - **success:** A user can skip Home setup, see observed places and a featured reliable trip when one exists, and play that trip with eligible media.
- **CAP-2**
  - **intent:** Distinguish routine activity, nearby outings, and continuous travel.
  - **success:** The local candidate keeps a reviewed continuous holiday together, separates repeated holidays, and handles nearby outings without treating photo volume or a place name as proof.
- **CAP-3**
  - **intent:** Resolve several trips with one optional question.
  - **success:** A question appears only when a safe answer could recover several distinct trips. Answering shows the actual verified changes and allows undo.
- **CAP-4**
  - **intent:** Discover and review possible trips separately.
  - **success:** A plausible outing can be kept through one durable owner decision. It enters the main Timeline and becomes eligible for Replay after successful publication and media checks.
- **CAP-5**
  - **intent:** Improve reconstruction as evidence changes while retaining trusted decisions.
  - **success:** Existing reviewed facts, media provenance, privacy, and exact committed Replay choices survive rebuilds. Changed evidence can surface a review suggestion for an existing owner decision.
- **CAP-6**
  - **intent:** Establish whether local changes and optional AI improve the product.
  - **success:** The old engine, candidate local engine, and any AI variant are compared on the same reviewed cases. AI remains optional and off the default path unless its improvement and safety gates pass.

## Constraints

- Reuse optional Home setup before photo access and editable dated Home areas. The reveal and review stay available without account setup or answers.
- Keep observed places, trip classification, and media association distinct. Preserve explicit Home, privacy, correction, source, and owner authority.
- Publish main Timeline, counts, map trip affordances, and Replay eligibility from one verified generation. Keep Possible trips separate.
- Apply the existing local/account compatibility, consent, and diagnostic gates. Cloud AI requires separate authorization and may only propose from bounded evidence.

## Non-goals

- Replacing the Welcome video, introducing mandatory AI, adding an online location service, or changing native sharing.
- Inferring travel routes, exact departure and return dates, or location from photo appearance.
- Reopening the Vietnam boundary repair or enabling gated Home sync as part of this slice.

## Success signal

On the same reviewed library, the candidate Atlas shows recognizable travel
with fewer false trips and splits while meeting the false-merge and correction
controls. The owner can open one real trip and play it, answer a high-value
question when one exists, or keep a plausible outing from the separate section.

## Assumptions

- The first reveal pairs a lifetime map with one featured reliable trip.
- “Several” initially means three or more distinct newly qualifying trips in a
  valid answer branch. Removals do not reduce that number, and fragment splits
  do not count toward it.
- The first supported question asks whether a recognizable place was usual
  during a stated period. AI trials are separate from default delivery.

## Open questions

- Promotion thresholds and the benefit of AI are evaluation questions. Start
  implementation in shadow mode and freeze the policy only after baseline and
  development results are reviewed.
