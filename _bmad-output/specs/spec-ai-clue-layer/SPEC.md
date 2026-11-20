---
id: SPEC-ai-clue-layer
date: 2026-11-19
status: draft
baseline_commit: fbfe8b8
companions:
  - clue-contract.md
  - clue-producers.md
  - background-and-surfacing.md
  - personal-learning.md
  - eval-engine.md
  - delivery-and-diagnostics.md
  - ../spec-trip-recognition-repair/SPEC.md
  - ../spec-trip-recognition-repair/detector-v1-2.md
  - ../spec-trip-recognition-repair/lifetime-benchmark.md
  - ../spec-gps-less-trip-discovery/SPEC.md
  - ../../../docs/decisions/0022-ai-clue-layer-and-learning.md
  - ../../../docs/decisions/0019-gps-less-trip-discovery.md
  - ../../../docs/decisions/0020-trusted-takeout-provenance.md
  - ../../../docs/decisions/0017-trip-merge-review-and-home-search.md
  - ../../../docs/decisions/0018-city-level-possible-trips.md
  - ../../../docs/decisions/0004-background-maintenance-in-mvp.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
  - ../../../evals/README.md
sources:
  - Owner proposal and review in chat, 2026-11-19
---

> **Canonical contract.** [Decision 0022](../../../docs/decisions/0022-ai-clue-layer-and-learning.md)
> is accepted. Implementation starts after M10.7 (one detector).

# AI clue layer and learning

## Why

An opportunity to capture and a pain to remove. After M10 the rule engine
puts clear trips on the Atlas and sends unsure ones to Possible trips with a
reason. Many of those reasons (no location, one moment, a far place seen once,
photos that are not the owner's) are exactly where on-device AI can add
evidence. The owner wants this to happen quietly and to get better from their
corrections. Today the project's AI pieces (sign reading, landmark matching,
Gemini Nano, a disabled cloud path) each keep their own trip state beside the
rule engine, which recreates the multi-engine drift M10 removes. This spec
makes AI an evidence producer for one rule engine, makes learning visible and
reversible, and gates every improvement on measurement.

## Capabilities

- **CAP-1 Clue store**
  - **intent:** AI results are kept as evidence the rest of the system can trust and trace.
  - **success:** Every AI output is a clue record per [clue-contract.md](clue-contract.md) with closed values, provider version and validity; evidence change, privacy exclusion, source loss or provider version change retracts or supersedes it; no AI code writes trips, memberships or classifications.
- **CAP-2 Rules consume clues**
  - **intent:** One rule engine decides with or without clues, and says which clues it used.
  - **success:** The M10 detector reads active clues on rebuild per the consumption table; reasons cite clue kinds in plain words; the same evidence, corrections, Home and clues always give the same result; with zero clues the result equals M10.
- **CAP-3 Background clue pass**
  - **intent:** AI work happens without the owner waiting, and its effect is visible.
  - **success:** The pass starts after a completed rebuild and in maintenance windows ([background-and-surfacing.md](background-and-surfacing.md)), honours budgets and checkpoints, never touches reviewed trips, never removes an Atlas trip by itself, and ends with one short "trips updated" note listing counts only when something changed.
- **CAP-4 Place clues**
  - **intent:** Trips without good location data get a place when evidence agrees.
  - **success:** Existing on-device sign reading, landmark matching, capture-time offset and optional Gemini Nano produce place clues ([clue-producers.md](clue-producers.md)); a place name needs two independent agreeing clues; no benchmark case shows a wrong country.
- **CAP-5 Photo-source clues**
  - **intent:** Photos the owner did not take do not create or enlarge trips.
  - **success:** Each photo gets a source clue (camera, imported, received, screenshot, download, unknown); received, screenshot and download photos stop supporting trips; a change that would lower an Atlas trip creates a review card instead.
- **CAP-6 Same-trip clues**
  - **intent:** Pieces of one holiday are offered for joining.
  - **success:** Possible trips or fragments that likely belong to one trip become merge suggestions under decision 0017; they never auto-merge.
- **CAP-7 Personal learning**
  - **intent:** The owner's corrections change future results on their phone, visibly.
  - **success:** Corrections become personal rules per [personal-learning.md](personal-learning.md), listed in Settings under "What Travel Life learned", each removable; the next rebuild applies them; removing one restores prior behaviour.
- **CAP-8 Eval engine and gate**
  - **intent:** Nothing gets worse without anyone noticing, and improvements are proven before they ship.
  - **success:** The eval engine ([eval-engine.md](eval-engine.md)) scores every rule, clue-producer and promotion version on the benchmark with injected right and wrong clues, frozen hard cases and on-device keep/reject aggregates; a version activates only with no regression and owner approval; promotion classes start off.

## Constraints

- AI outputs are clues only; the M10 one detector is the sole writer of trips,
  memberships and classifications.
- Precedence: owner correction > personal rule > rules with clues > rules alone.
- AI never removes or lowers an Atlas trip on its own and never changes an
  owner-reviewed trip; such clues produce a review card.
- Moving a trip from Possible trips to the Atlas because of clues is off per
  clue class until eval evidence and owner approval enable it.
- On-device models only for photo content (decision 0019). The cloud metadata
  proposal path (`src/ai`, decision 0002) stays off and out of scope.
- Clue values are closed codes or offline gazetteer IDs, never free text.
- Clues are device-local and recomputable; personal rules are owner decisions
  and follow the private sync rules of decision 0015.
- Background work follows platform scheduling (decision 0004); no promise of
  immediate updates; budgets bound battery and storage.
- Corrections are biased labels (missing trips are never corrected); the eval
  never relies on corrections alone.
- Diagnostic implementation policy applies; the map is in
  [delivery-and-diagnostics.md](delivery-and-diagnostics.md).

## Non-goals

- Training or fine-tuning models on the phone or on uploaded owner data.
- Automatic, ungated self-modification of rules, thresholds or models.
- Cloud AI on photos or private evidence; enabling the cloud metadata path.
- New landmark coverage or pack building (owned by the GPS-less and recovery specs).
- Chat, search or recommendations from history.

## Success signal

On the benchmark with M11 enabled, at least one Possible-trip reason class is
resolved by clues with no wrong country, no wrong Atlas removal and no
regression versus M10; on the owner's phone a background pass produces an
"updated" note whose changes the owner can trace to named clues, and a
correction the owner makes visibly changes the next rebuild and can be undone
from Settings.

## Assumptions

- The existing on-device models (ML Kit text recognition, ONNX landmark
  embeddings, ML Kit GenAI prompt) are the initial producers; no new model is
  required for CAP-4..6.
- Gemini Nano availability varies by device; every producer must work without it.
- Same-trip clues can start from deterministic metadata and embedding
  similarity; a learned similarity model is a later version through the gate.
