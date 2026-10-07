---
title: Travel Life proposed epics and stories
status: proposed
updated: 2026-10-06
planning_method: bmad-party-session
formal_epic_workflow_completed: false
implementation_ready: false
inputDocuments:
  - docs/product/source-analysis.txt
  - docs/product/context.md
  - docs/project-state.md
  - docs/development/workflow.md
  - evals/design/reconstruction-plan.md
---

# Travel Life epics and stories

This is the canonical proposed backlog from the requested BMAD party planning session.
It is not an approved PRD or an implementation authorization. No app has been built.
The formal BMAD epic-creation workflow requires settled requirements and supporting
architecture/UX decisions; those prerequisites are deliberately scheduled in E01.

Phase 0–1 stories have draft acceptance criteria. Phase 2 is provisional. Later
stories are discovery outlines: re-scope them with evidence before implementation.
The [roadmap](roadmap.md) owns sequencing and phase gates; the CSV is a derived
filterable view, not a second backlog to maintain independently.

## Planning conventions

- P0: resolve existential uncertainty first. P1: essential private alpha / static-card beta.
- P2: follow-on maintenance or optional public sharing. P3: evidence-dependent product experiments.
- P4: strategic options; no current delivery commitment.
- S/M/L are relative scope signals, not estimates in days or story points. Split L stories
  into independently useful vertical slices after architecture clarifies complexity.
- All stories are draft or option. Owner roles indicate responsibility, not a named human assignment.
- Dependencies reference earlier story IDs. Epic prerequisites and roadmap gates apply
  in addition; a later story cannot silently bypass its phase gate.
- Prioritization uses user value, uncertainty reduced, dependencies and trust risk.
  Numeric RICE/WSJF scores would fabricate reach/confidence data that we do not yet have.

## Proposed requirement inventory and coverage

These are extracted planning candidates from the source analysis and our recorded
analysis, not requirements falsely attributed to an approved PRD. E01 validates the
entire inventory. OPT items preserve the long-term vision without putting it in MVP.

| ID | Proposed behavior | Coverage |
| --- | --- | --- |
| FR01 | Connect one selected native source with truthful access scope. | E02 |
| FR02 | Normalize evidence and preserve provenance and missing/conflicting fields. | E02, E03 |
| FR03 | Distinguish supported presence, uncertain suggestions and abstention. | E03, E05 |
| FR04 | Reconstruct trips using agreed visit/transit/residence/date semantics. | E03, E05 |
| FR05 | Reveal a scoped travel record with understandable coverage. | E04 |
| FR06 | Explore a linked lifetime map and chronological timeline. | E04 |
| FR07 | Open journeys and available source-linked memories. | E04 |
| FR08 | Show only supportable, consistently counted travel facts. | E04 |
| FR09 | Confirm, reject, edit, split/merge and manually fill exceptions durably. | E05 |
| FR10 | Control permission, disconnect, visibility, exclusion and deletion. | E02, E05 |
| FR11 | Preview and explicitly share selected travel facts. | E06 |
| FR12 | Measure permission, completion, exploration, correction and optional sharing separately. | E01, E06 |
| OPT01 | Maintain history from new/changed evidence without losing corrections. | E07 |
| OPT02 | Test factual identity and annual summaries. | E08 |
| OPT03 | Test controlled replay and highlight selection. | E09 |
| OPT04 | Test history search and useful personal recommendations. | E10 |
| OPT05 | Test fresh world signals with grounding and authorized sources. | E11 |
| OPT06 | Test sustainable premium/commerce value. | E12 |
| OPT07 | Test a bounded collaborative/network need. | E13 |

| ID | Proposed quality constraint | Coverage |
| --- | --- | --- |
| NFR01 | Keep private media, precise personal locations, raw traces and labels out of Git and product telemetry; provider processing follows the recorded data authorization. | E01, E02, E03, E06 |
| NFR02 | Recover from interrupted import/retry and permission changes without duplicate records or lost corrections. | E02, E05, E07 |
| NFR03 | Measure latency, cost and device resource use on agreed slices; set budgets from evidence before release. | E01, E02, E03 |
| NFR04 | Provide accessible navigation and a list alternative to spatial-only exploration, following the future UX contract. | E04, E05 |
| NFR05 | Version tasks, data, model/prompt, evaluators and runs; validate subjective judges against independent human labels when used. | E01, E03; future AI options |
| NFR06 | Separate observation, inference and owner confirmation; label date precision and never fabricate route/duration facts. | E01, E03, E04, E05 |
| NFR07 | Preserve explicit correction and deletion semantics on rebuild and later incremental updates. | E02, E05, E07 |

No application starter, API, database, model provider, numeric quality target,
visual tokens or cloud deployment is specified yet. The architecture/UX handoff
in 1.8–1.9 must supply decisions the implementation stories need.

## Epic overview

| Epic | Phase | Priority | Traveller/team outcome | Prerequisites |
| --- | --- | --- | --- | --- |
| E01 — Prove feasibility and the Travel Life moment | 0 | P0 | Learn whether a narrowly scoped, trustworthy reconstruction is worth building. | None |
| E02 — Connect evidence safely and keep it under user control | 1A | P1 | A traveller can connect one source, import evidence and control its local/remote lifecycle. | G0 |
| E03 — Reconstruct a credible travel history with evaluated uncertainty | 1A | P1 | A traveller receives evidence-supported visits and trip drafts whose limitations are visible. | E02 |
| E04 — Reveal and explore a travel life worth revisiting | 1A | P1 | A traveller can understand the history, explore journeys and recover memories. | E03 |
| E05 — Correct the record and keep the traveller in control | 1A | P1 | A traveller can repair omissions and wrong groupings without losing edits. | E04 |
| E06 — Learn from a private beta and optional sharing | 1B | P1 | Travellers can share a chosen representation safely, while the team measures real product value. | GA |
| E07 — Maintain travel history as new evidence appears | 2 | P2 | A traveller gets reliable updates with minimal effort and no lost corrections. | GB |
| E08 — Express a factual travel identity | 3 | P3 | A traveller can recognize patterns and share a meaningful representation of their history. | G2 |
| E09 — Replay memories when the emotional value is proven | 4 | P3 | A traveller can revisit selected journeys through a controlled replay. | G3 |
| E10 — Test useful personal travel intelligence | 5 | P3 | A traveller can find their history and test suggestions that help future intent. | G2 |
| E11 — Test relevant world signals through Travel Pulse | 6 | P4 | A traveller receives timely information relevant to a real travel interest. | G5 |
| E12 — Test a sustainable business model | 7 | P4 | A traveller can obtain useful premium value or act on travel intent without losing trust. | GB |
| E13 — Explore a network only after sustained product value | 8 | P4 | Travellers gain a demonstrated collaborative benefit with clear visibility controls. | GB, sustained-product-value |

## Common readiness and completion rules

Discovery stories require their recorded inputs and a bounded execution scope.
Participant recruitment, actual private data collection, provider uploads and prototype
coding are future work; this request authorizes planning only. Existing or later
explicit authorization should be honored without duplicate approval rituals.

Implementation requires G0, scoped PRD references, the relevant DESIGN/EXPERIENCE
and architecture decisions, observable acceptance criteria, dependencies complete,
and resolved data-processing boundaries. An AI story also needs its task, baseline,
dataset/version/splits, reference labels/reviewer, applicable metrics and decision rule.
Story 3.2 gathers real error evidence before stable evaluators are chosen.

For delivery, use the [project story template](../../docs/development/story-template.md).
Keep these IDs and add actual implementation/test/eval evidence to this same story record,
or move it to a delivery file with a link here; do not maintain conflicting copies.
BMAD owns scope, ECC owns implementation research/tests/security/verification,
and evals-skills owns failure analysis and evaluator validity.
A software test pass and the foundation smoke check do not establish AI accuracy.

No acceptance criterion below is currently satisfied merely because it is written.
Dates, effort, participants, labels and quality measurements remain unobserved unless
a future execution report says otherwise.

## Epic 1: Prove feasibility and the Travel Life moment

**Phase:** 0 · **Priority:** P0 · **Owner roles:** Mary / John

**Outcome:** Learn whether a narrowly scoped, trustworthy reconstruction is worth building.

**Scope:** Research and a later explicitly authorized bounded experiment; no full application.

**Prerequisites:** None · **Exit gate:** G0 · **Hypotheses:** H1–H5; H7 exploratory

### Story 1.1: Choose the initial study segment

**Status:** draft · **Priority:** P0 · **Relative scope:** S · **Dependencies:** None

As a product team, we want one testable traveller cohort so learning is interpretable.

**Draft acceptance criteria:**

- **AC-1.1-1:** Document selection criteria, geography and recruitment channels; use 10–20 participants as a qualitative planning range, not a statistical claim.
- **AC-1.1-2:** Include variation in library age, evidence quality, travel frequency and source; document exclusions and sampling bias.
- **AC-1.1-3:** Define the study owner, participant contact process and consent boundaries before collecting data.

**AI / evaluation impact:** No engine behavior changes; defines the population and sampling slices.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.2: Validate one native photo source

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.1

As a traveller, I want the promised access to match what my device can actually provide.

**Draft acceptance criteria:**

- **AC-1.2-1:** Research current official platform documentation for iOS and Android; record URLs, access modes, metadata availability and background restrictions.
- **AC-1.2-2:** Define a bounded device experiment covering limited access, cloud-only media, denial, revocation and library changes; distinguish research from tested findings.
- **AC-1.2-3:** Recommend one initial platform/source with evidence and alternatives; do not promise a full historical Google Photos scan.

**AI / evaluation impact:** Source feasibility and missing metadata affect evaluation coverage; no inferred negatives.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.3: Define visits, trips and evidence semantics

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.1, 1.2

As a traveller, I want travel facts to mean something consistent and understandable.

**Draft acceptance criteria:**

- **AC-1.3-1:** Record proposed definitions for visit, trip, transit, residence, destination and observed date span; distinguish observations, inference and owner confirmation.
- **AC-1.3-2:** Walk examples for domestic day trips, multi-stop travel, changing homes, airport transit, sparse photos, shared photos and conflicting timestamps.
- **AC-1.3-3:** Specify unknown/abstained decisions, counting rules, timezone handling, date precision and correction precedence; mark unresolved cases explicitly.

**AI / evaluation impact:** Defines label units, ambiguity and valid denominators; rules remain proposed until tested.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.4: Design consent, reference labels and decision rules

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.1, 1.3

As a study participant, I want control over my evidence and a fair assessment of the result.

**Draft acceptance criteria:**

- **AC-1.4-1:** Define consent for collection, review, storage, optional provider processing and retention separately; keep identifying records and precise locations in ignored private directories.
- **AC-1.4-2:** Define owner-reviewed visit/trip references including unknown and incomplete history, reviewer responsibility and disagreement adjudication.
- **AC-1.4-3:** Specify person/library-level splits and leakage checks; record study decision rules before the confirmatory comparison, with a rationale and incomplete-evidence outcome.

**AI / evaluation impact:** Evaluation protocol: human references, counts, slices, abstentions and uncertainty. No invented labels or thresholds.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.5: Run a bounded reconstruction baseline experiment

**Status:** draft · **Priority:** P0 · **Relative scope:** L · **Dependencies:** 1.2, 1.3, 1.4

As a traveller, I want to see what my existing evidence can realistically recover.

**Draft acceptance criteria:**

- **AC-1.5-1:** When separately authorized to execute, process only consented selected-source samples with a simple metadata baseline; record actual source limitations.
- **AC-1.5-2:** Produce reviewable evidence-to-visit/trip traces and a rough map/timeline or controlled manual presentation; label manual assistance clearly.
- **AC-1.5-3:** Measure false visits, omissions, split/merge errors, correction effort, runtime and cost where observable; preserve unsuccessful cases and report unmeasured quantities.

**AI / evaluation impact:** First real traces for error-discovery; synthetic cases supplement coverage but do not demonstrate product accuracy.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.6: Compare alternatives and test reveal/correction value

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.4, 1.5

As a traveller, I want a record that is more useful than the tools I can already use.

**Draft acceptance criteria:**

- **AC-1.6-1:** Run a consented comparison against available Pastport/Viamem/Pino or a relevant native-photo baseline on the same reference history; record tested versions and unavailable candidates.
- **AC-1.6-2:** Separate emotional response, independent exploration, willingness to maintain, actual correction effort and optional sharing behavior from algorithmic quality.
- **AC-1.6-3:** Counterbalance presentation where practical; distinguish concierge/manual results from automated results and report small-sample limitations and disconfirming findings.

**AI / evaluation impact:** Compare actual outputs; no extrapolation from competitor marketing or assisted prototypes to engine quality.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.7: Create a scoped brief and PRD

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.3, 1.5, 1.6

As a product team, we want a bounded product promise based on what we learned.

**Draft acceptance criteria:**

- **AC-1.7-1:** Use BMAD product-brief then PRD to record the initial segment, source, core loop, explicit exclusions and unresolved decisions.
- **AC-1.7-2:** Replace this backlog's proposed requirement IDs with stable PRD references without losing traceability or silently expanding scope.
- **AC-1.7-3:** Separate private-alpha requirements, beta share-card requirements and optional public web sharing; record accepted success measures and who makes the phase decision.

**AI / evaluation impact:** PRD must name evidence policy and evaluation obligations; no achieved-quality claims.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.8: Create the UX contract for trust and correction

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.7

As a traveller, I want the core journey and its exceptions to feel understandable.

**Draft acceptance criteria:**

- **AC-1.8-1:** Produce DESIGN.md and EXPERIENCE.md through BMAD UX covering trust/permission, processing, reveal, exploration, correction and sharing preview.
- **AC-1.8-2:** Include denied/limited access, empty or sparse history, uncertain dates, inaccessible media, long processing and deletion states.
- **AC-1.8-3:** Specify accessible alternatives to map-only interaction and observable task-success criteria; keep screens conceptual until implementation is authorized.

**AI / evaluation impact:** Test comprehension of uncertainty and correction tasks; perceived trust does not replace correctness.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.9: Record architecture and AI task decisions

**Status:** draft · **Priority:** P0 · **Relative scope:** M · **Dependencies:** 1.2, 1.3, 1.4, 1.7, 1.8

As a delivery team, we want technical decisions that preserve the product's trust promise.

**Draft acceptance criteria:**

- **AC-1.9-1:** Use BMAD architecture to decide platform/stack, source contracts, canonical evidence/history model, persistence and device/server boundaries.
- **AC-1.9-2:** Record per-task deterministic baseline versus model need, provider/data permissions if relevant, provenance, correction precedence and deletion behavior.
- **AC-1.9-3:** Document resumable import, large-library budgets, observability, media references and future delta processing; choose technology from evidence, not the term graph.

**AI / evaluation impact:** Trace contract and task-level evaluation obligations must fit the architecture; calibrated judges are conditional.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

### Story 1.10: Make and record the Phase 0 decision

**Status:** draft · **Priority:** P0 · **Relative scope:** S · **Dependencies:** 1.5, 1.6, 1.7, 1.8, 1.9

As a product owner, I want a clear proceed, narrow, repeat or stop decision before funding the app.

**Draft acceptance criteria:**

- **AC-1.10-1:** Assemble source feasibility, participant/reference counts, comparative findings, error slices, permission behavior and exploration/correction observations.
- **AC-1.10-2:** Apply the recorded study rules; distinguish enough evidence, failure and inconclusive evidence, and document residual risks.
- **AC-1.10-3:** Record the actual product-owner decision and next bounded scope; keep implementation blocked while necessary product decisions remain unresolved.

**AI / evaluation impact:** No averaged vanity score; false visits, coverage and user value each remain visible.

**Validation to record:** Research sources, actual experiment observations and limitations; never mark a study performed from a written protocol.

## Epic 2: Connect evidence safely and keep it under user control

**Phase:** 1A · **Priority:** P1 · **Owner roles:** Winston / Amelia

**Outcome:** A traveller can connect one source, import evidence and control its local/remote lifecycle.

**Scope:** One native platform/source; architecture selected in Phase 0. Accounts and cloud storage only if justified.

**Prerequisites:** G0 · **Exit gate:** GA · **Hypotheses:** H1; source feasibility

### Story 2.1: Establish a minimal mobile delivery slice

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 1.10

As a traveller, I want a reliable starting flow on the selected device.

**Draft acceptance criteria:**

- **AC-2.1-1:** Use the recorded architecture to create the smallest runnable shell with trust, import and history states using synthetic examples.
- **AC-2.1-2:** Document reproducible local commands and applicable CI checks; isolate secrets and private data from source control.
- **AC-2.1-3:** Verify install/start and a smoke journey on the selected device; do not add accounts, a backend or a second platform without a requirement.

**AI / evaluation impact:** Synthetic shell tests are plumbing evidence only.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 2.2: Explain and handle source permissions

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 2.1

As a traveller, I want to understand and control photo access before granting it.

**Draft acceptance criteria:**

- **AC-2.2-1:** Explain purpose, accessed data and actual processing location before requesting access; offer the platform's supported limited mode.
- **AC-2.2-2:** Handle denied, limited, granted and later-revoked access without losing user corrections or pretending all history is visible.
- **AC-2.2-3:** Provide a clear way to change source permissions and show the current access scope; measure permission events without media/location payloads.

**AI / evaluation impact:** Represent permission-induced missing evidence separately from absence of travel.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 2.3: Import metadata with provenance and safe retries

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 2.2

As a traveller, I want my selected library processed without duplicates or repeated work.

**Draft acceptance criteria:**

- **AC-2.3-1:** Normalize selected-source identifiers, available timestamps/location, provenance and media references using the architecture contract; preserve missing/conflicting fields.
- **AC-2.3-2:** Checkpoint processing so interruption/retry neither duplicates evidence nor corrupts the history; detect exact duplicates without inventing unavailable device-origin signals.
- **AC-2.3-3:** Verify empty, sparse, duplicate, timezone-conflicting, cloud-only and large-library cases; report inaccessible assets and source coverage honestly.

**AI / evaluation impact:** Use contract checks and deterministic fixtures for normalization; capture versioned source coverage.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 2.4: Protect, disconnect and delete imported evidence

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 2.3

As a traveller, I want control over the sensitive record derived from my photos.

**Draft acceptance criteria:**

- **AC-2.4-1:** Apply recorded data-location, encryption, access and retention decisions to metadata, history and necessary caches; keep originals at their source where feasible.
- **AC-2.4-2:** Make disconnect and delete-history consequences clear and distinct; deletion clears covered active data/caches and specifies any backup expiry.
- **AC-2.4-3:** Verify isolation if remote accounts exist, and verify the advertised deletion scope on each actual storage component; do not claim erasure beyond the design.

**AI / evaluation impact:** Deletion and access-control rules are deterministic software checks, with trace/log retention included.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 2.5: Show import progress, cancellation and missing-media recovery

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 2.3, 2.4

As a traveller, I want to know what is happening and recover without starting over.

**Draft acceptance criteria:**

- **AC-2.5-1:** Expose meaningful import states and cancel/resume behavior; leave the last consistent history view usable after failure.
- **AC-2.5-2:** When a media reference disappears, preserve supported history and corrections while showing an unavailable-memory state under the recorded retention policy.
- **AC-2.5-3:** Measure end-to-end processing latency, memory/battery effects where available and asset failures on agreed library/device slices; compare with recorded budgets.

**AI / evaluation impact:** Collect performance distributions; asset failure rates and processing completion are distinct from reconstruction quality.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 3: Reconstruct a credible travel history with evaluated uncertainty

**Phase:** 1A · **Priority:** P1 · **Owner roles:** Winston / Amelia; human reviewer designated in E01

**Outcome:** A traveller receives evidence-supported visits and trip drafts whose limitations are visible.

**Scope:** Task-level inference, a simple baseline and observed-error-driven AI; no generic chatbot.

**Prerequisites:** E02 · **Exit gate:** GA · **Hypotheses:** H2–H3

### Story 3.1: Build the reproducible evidence-to-history baseline

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 2.3, 2.4, 1.3

As a traveller, I want each reconstructed fact to have a traceable basis.

**Draft acceptance criteria:**

- **AC-3.1-1:** Implement the agreed deterministic baseline producing versioned evidence, presence decisions, visits and trip drafts without treating every photo as owner presence.
- **AC-3.1-2:** Separate observed, inferred, uncertain and confirmed fields; link each claim to supporting evidence and record absence of support.
- **AC-3.1-3:** Store dataset/run/config versions and runtime/cost with traces in private locations; use the existing trace contract where applicable and version extensions explicitly.

**AI / evaluation impact:** Compare with the Phase 0 baseline; unit tests establish rule behavior, owner labels establish quality.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 3.2: Discover real failure modes and freeze evaluation data

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 3.1, 1.4

As a traveller, I want the team to address the mistakes that actually damage trust.

**Draft acceptance criteria:**

- **AC-3.2-1:** Use error-discovery to sample diverse real traces with designated human review; record free-text errors before stabilizing a taxonomy.
- **AC-3.2-2:** Adjudicate labels and version representative tuning/calibration/holdout datasets; group duplicate media and the same person/library to prevent leakage.
- **AC-3.2-3:** Publish a non-identifying error summary, observed denominators and residual coverage gaps; keep raw traces and labels private.
- **AC-3.2-4:** Use exploratory errors and calibration data to propose critical-failure rules, quality limits and cost/latency budgets with rationale and a named decision owner; record the adopted policy before opening holdout results.

**AI / evaluation impact:** Human review is required evidence; synthetic labels or an LLM's agreement are not ground truth.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 3.3: Evaluate justified AI improvements against the baseline

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 3.2

As a traveller, I want better reconstruction without unnecessary cost or unsupported guesses.

**Draft acceptance criteria:**

- **AC-3.3-1:** Choose a known failure from error analysis and record whether a model is needed, what inputs it may see and the data-processing authorization.
- **AC-3.3-2:** Compare baseline and candidate on the same tuning/calibration cases with counts, error slices, abstention, latency and cost; keep holdout untouched for final selection.
- **AC-3.3-3:** Adopt, revise or reject the candidate with evidence; retaining the deterministic baseline is a valid outcome.

**AI / evaluation impact:** Use write-code-eval for objective rules; write-judge-prompt plus validate-evaluator only when subjective judgment is necessary.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 3.4: Make presence decisions and abstention understandable

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 3.3

As a traveller, I want someone else's photos to stay out of my claimed travel history.

**Draft acceptance criteria:**

- **AC-3.4-1:** Implement the selected evidence policy for visits, uncertain suggestions and abstentions; do not automatically classify all shared photos as invalid.
- **AC-3.4-2:** Exercise unsupported downloads, legitimate shared trip photos, screenshots, conflicting GPS and sparse evidence using reviewed cases.
- **AC-3.4-3:** Expose understandable evidence reasons and a confirm/reject path; do not display calibrated-looking confidence percentages without calibration evidence.

**AI / evaluation impact:** Measure false visits and omission/coverage separately, including unknown references and uncertain-output rates.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 3.5: Group trips with honest dates and destinations

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 3.4, 1.3

As a traveller, I want journeys that resemble my real travel without invented dates or routes.

**Draft acceptance criteria:**

- **AC-3.5-1:** Apply the recorded trip/visit/transit/residence definitions to multi-stop, day-trip, long-stay and sparse-evidence cases.
- **AC-3.5-2:** Show observed span and owner-confirmed bounds distinctly; distinguish destination sequences from actual travelled routes.
- **AC-3.5-3:** Preserve field provenance and support correction of grouping without rewriting source evidence.

**AI / evaluation impact:** Measure split/merge errors and boundary error at the agreed date precision; score uncertain references separately.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 3.6: Run the held-out reconstruction release assessment

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 3.5

As a traveller, I want engine changes assessed before they change my history.

**Draft acceptance criteria:**

- **AC-3.6-1:** Freeze candidate/model/prompt/data/evaluator versions and evaluate against baseline on the untouched person/library holdout; retain unsuccessful and repeat stochastic runs.
- **AC-3.6-2:** Report precision/false visits, coverage, grouping/boundary errors, abstention and cost/latency by important slices with counts and uncertainty.
- **AC-3.6-3:** Apply evidence-derived quality rules established after discovery, detect correction regressions and record pass, fail or inconclusive; block a release with unresolved critical findings.

**AI / evaluation impact:** Validate any judge on independent human labels before using its outputs; contract-smoke success is not a quality result.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 4: Reveal and explore a travel life worth revisiting

**Phase:** 1A · **Priority:** P1 · **Owner roles:** Sally / Amelia

**Outcome:** A traveller can understand the history, explore journeys and recover memories.

**Scope:** Lifetime map, linked timeline, trip details and supportable facts; no cinematic replay.

**Prerequisites:** E03 · **Exit gate:** GA · **Hypotheses:** H4–H5

### Story 4.1: Reveal history with its coverage and uncertainty

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 2.5, 3.6, 1.8

As a traveller, I want a meaningful reveal that does not overstate what was recovered.

**Draft acceptance criteria:**

- **AC-4.1-1:** Present reconstructed history, clearly scoped statistics and accessible navigation using the UX contract.
- **AC-4.1-2:** Show accessed-source scope, missing evidence and draft/confirmed status in plain language; distinguish empty history from an import failure.
- **AC-4.1-3:** Usability-check comprehension, perceived value and an independent first exploration task on the study cohort.

**AI / evaluation impact:** Measure reveal value separately from correctness; count participants/tasks and unresolved confusion.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 4.2: Explore the lifetime map

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 4.1

As a traveller, I want to discover my journeys geographically.

**Draft acceptance criteria:**

- **AC-4.2-1:** Make supported destinations/selectable journeys navigable and connect selections to trip details and timeline.
- **AC-4.2-2:** Distinguish uncertain suggestions and observed destination connections from verified visits/actual routes.
- **AC-4.2-3:** Provide a usable list alternative and the recorded accessibility behavior; handle dense/empty maps and hidden trips.

**AI / evaluation impact:** Displayed places and labels must match the underlying evidence/correction state.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 4.3: Explore the linked timeline and year filters

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 4.1

As a traveller, I want to move through my history in time.

**Draft acceptance criteria:**

- **AC-4.3-1:** Offer chronological journeys and year filtering linked to map selection using the agreed date and timezone semantics.
- **AC-4.3-2:** Display approximate/observed dates and gaps without filling unobserved days; preserve stable selection when filters change.
- **AC-4.3-3:** Verify empty years, cross-year trips and uncertain boundaries with accessible controls.

**AI / evaluation impact:** Test chronological consistency deterministically against records, not AI-generated narratives.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 4.4: Open a trip and revisit its memories

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 4.2, 4.3

As a traveller, I want to see the evidence and memories behind a journey.

**Draft acceptance criteria:**

- **AC-4.4-1:** Display trip destinations, date status, source-linked media and evidence reasons; original media access follows source permissions.
- **AC-4.4-2:** Handle revoked permissions, missing originals and videos/large trips with informative states and defined resource limits.
- **AC-4.4-3:** Make correction entry points available without editing or copying original media.

**AI / evaluation impact:** No new generative story task; source-reference consistency and privacy checks apply.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 4.5: Show factual, consistently counted statistics

**Status:** draft · **Priority:** P1 · **Relative scope:** S · **Dependencies:** 4.4, 1.3

As a traveller, I want my travel statistics to be meaningful and believable.

**Draft acceptance criteria:**

- **AC-4.5-1:** Apply the recorded country/destination/trip counting policy consistently across reveal, map, timeline and detail.
- **AC-4.5-2:** Label observed spans explicitly; omit exact travel days, distance and first/longest claims when evidence cannot support them.
- **AC-4.5-3:** Recalculate counts after confirmation/exclusion/correction and verify boundary cases such as transit and residence.

**AI / evaluation impact:** Objective evaluators verify counts and provenance; arbitrary route distance is excluded.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 5: Correct the record and keep the traveller in control

**Phase:** 1A · **Priority:** P1 · **Owner roles:** Sally / Amelia

**Outcome:** A traveller can repair omissions and wrong groupings without losing edits.

**Scope:** Correction as an exception flow, private visibility and durable owner decisions.

**Prerequisites:** E04 · **Exit gate:** GA · **Hypotheses:** H2–H3; correction burden

### Story 5.1: Confirm or reject a suggested visit/trip

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 4.4, 3.4

As a traveller, I want to confirm a real visit and reject a false one.

**Draft acceptance criteria:**

- **AC-5.1-1:** Offer understandable confirm/reject actions with a visible resulting state and undo policy from UX.
- **AC-5.1-2:** Record owner confirmation separately from inferred evidence; apply resulting count/map/timeline changes consistently.
- **AC-5.1-3:** Ensure a rejected unsupported suggestion does not return on a same-evidence rebuild; retain only what the deletion policy permits.

**AI / evaluation impact:** Add correction-precedence regressions and observe confirmation/rejection task effort.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 5.2: Edit trip bounds and split or merge journeys

**Status:** draft · **Priority:** P1 · **Relative scope:** L · **Dependencies:** 5.1

As a traveller, I want the grouping to match how I experienced the journey.

**Draft acceptance criteria:**

- **AC-5.2-1:** Allow the agreed date/title/destination edits and explicit split/merge actions with clear previews and correction provenance.
- **AC-5.2-2:** Reassign referenced memories consistently without duplicating or discarding them; validate invalid or ambiguous date ranges.
- **AC-5.2-3:** Persist edits through restart and reconstruction of unchanged evidence and test undo/conflicting changes under the architecture rules.

**AI / evaluation impact:** Use deterministic consistency tests plus human grouping labels; manual dates remain owner-confirmed.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 5.3: Fill a missing journey as a manual exception

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 5.2

As a traveller, I want to preserve a real trip when my photos are insufficient.

**Draft acceptance criteria:**

- **AC-5.3-1:** Allow a minimal manual visit/trip with user-entered date precision and destinations under the recorded semantics.
- **AC-5.3-2:** Label the record owner-entered and do not invent supporting photo evidence or count it as engine-recovered history.
- **AC-5.3-3:** Handle overlap with existing inferred trips through a reviewable merge choice and preserve the manual record on rebuild.

**AI / evaluation impact:** Manual additions affect the user's record; do not inflate automated reconstruction recall with corrected outputs.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 5.4: Separate private hiding, inference exclusion and deletion

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 5.1, 2.4

As a traveller, I want distinct controls for what I see, what the engine uses and what is removed.

**Draft acceptance criteria:**

- **AC-5.4-1:** Explain hide-from-view, exclude-from-inference and delete-history consequences using the chosen data policy; implement only the clearly defined controls.
- **AC-5.4-2:** Default sensitive/private trip sharing to off; apply selected visibility consistently to counts, browsing and share previews.
- **AC-5.4-3:** Persist choices across restart/rebuild and verify that deletion removes covered derived records/caches rather than merely hiding them.

**AI / evaluation impact:** Correction/visibility regression cases and data-lifecycle checks are required; no new subjective judge.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 6: Learn from a private beta and optional sharing

**Phase:** 1B · **Priority:** P1 · **Owner roles:** John / Sally / Amelia

**Outcome:** Travellers can share a chosen representation safely, while the team measures real product value.

**Scope:** Static card first. Public sharing is conditional within Phase 1 rather than a prerequisite for private value.

**Prerequisites:** GA · **Exit gate:** GB · **Hypotheses:** H1–H8

### Story 6.1: Preview and export a private-by-default share card

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 5.4, 4.5

As a traveller, I want to share only the travel facts I choose.

**Draft acceptance criteria:**

- **AC-6.1-1:** Provide an explicit opt-in preview with selected trips/facts; private/uncertain content follows the recorded sharing policy.
- **AC-6.1-2:** Export a static card without precise hidden locations or original-media metadata; no upload/publication occurs merely by opening the preview.
- **AC-6.1-3:** Support the native share action and cancellation; note that recipients' copies of exported images cannot be revoked.

**AI / evaluation impact:** Verify content/metadata leakage objectively; shares and downstream acquisition remain distinct metrics.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 6.2: Run the instrumented private beta study

**Status:** draft · **Priority:** P1 · **Relative scope:** M · **Dependencies:** 6.1

As a traveller, I want the team to learn from actual use without collecting my private history.

**Draft acceptance criteria:**

- **AC-6.2-1:** Before beta entry, verify GA evidence and complete source-control, deletion, correction and usability checks on the chosen platform.
- **AC-6.2-2:** Measure minimal consent-aware permission, completion, reveal/exploration, correction and optional-share events without raw media or precise travel data.
- **AC-6.2-3:** Report funnel denominators, failed/abandoned sessions and qualitative tasks; distinguish private value, share intent and actual share behavior.

**AI / evaluation impact:** Observe quality and UX jointly; no product-readiness inference from foundation tests.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 6.3: Add an optional revocable shared web snapshot

**Status:** draft · **Priority:** P2 · **Relative scope:** L · **Dependencies:** 6.2

As a traveller, I want selected recipients to see only a deliberately shared travel summary.

**Draft acceptance criteria:**

- **AC-6.3-1:** Proceed only if beta evidence supports linked sharing and a recorded hosting/auth/retention design exists; record defer as a valid result.
- **AC-6.3-2:** Publish only a previewed, sanitized snapshot with access/expiry/revocation controls appropriate to the chosen audience; private source references remain private.
- **AC-6.3-3:** Verify unauthorized access, indexing/cache behavior and revocation limits; provide a Create Mine path and measure link-view to connection separately.

**AI / evaluation impact:** Priority P2 conditional option. Server/auth security checks apply; no remote service selected by this plan.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 6.4: Decide beta scope and whether to pursue maintenance

**Status:** draft · **Priority:** P1 · **Relative scope:** S · **Dependencies:** 6.2

As a product owner, I want to invest based on trusted usage rather than novelty.

**Draft acceptance criteria:**

- **AC-6.4-1:** Compare observed permission/completion, supported reconstruction, independent exploration and correction burden against recorded beta rules.
- **AC-6.4-2:** Report voluntary sharing/acquisition separately; lack of public sharing alone does not invalidate private product value.
- **AC-6.4-3:** Record proceed, narrow, repeat or stop for automatic maintenance; include outcomes of 6.3 if run without requiring it for this decision.

**AI / evaluation impact:** Quality, trust, value and cost must each be evidenced; dates/sample sizes cannot manufacture certainty.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 7: Maintain travel history as new evidence appears

**Phase:** 2 · **Priority:** P2 · **Owner roles:** Winston / Amelia / John

**Outcome:** A traveller gets reliable updates with minimal effort and no lost corrections.

**Scope:** OS-permitted incremental processing, correction stability and optional notifications.

**Prerequisites:** GB · **Exit gate:** G2 · **Hypotheses:** H9; post-trip retention

### Story 7.1: Process newly available evidence incrementally

**Status:** draft · **Priority:** P2 · **Relative scope:** L · **Dependencies:** 6.4

As a traveller, I want new photos to update my record efficiently.

**Draft acceptance criteria:**

- **AC-7.1-1:** Implement selected-platform foreground/background delta processing with a documented fallback when scheduling or permissions restrict it.
- **AC-7.1-2:** Verify stable checkpoints, retries and no duplicate trips; report when access changes require broader reconsideration.
- **AC-7.1-3:** Compare resource use and new-evidence coverage with full-rebuild references on representative sequences.

**AI / evaluation impact:** Longitudinal replay cases and resource distributions; do not promise always-on background updates.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 7.2: Reconcile changed evidence without losing corrections

**Status:** draft · **Priority:** P2 · **Relative scope:** L · **Dependencies:** 7.1

As a traveller, I want older edits to survive new or changed media.

**Draft acceptance criteria:**

- **AC-7.2-1:** Handle changed/deleted assets, delayed historical uploads and duplicate evidence under recorded retention/merge rules.
- **AC-7.2-2:** Keep owner corrections authoritative; conflicting new evidence creates reviewable proposals rather than silent overwrites.
- **AC-7.2-3:** Verify incremental and full-rebuild results agree where expected and preserve versioned provenance.

**AI / evaluation impact:** Correction-persistence and idempotency are critical regression checks.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 7.3: Review a new chapter and control notifications

**Status:** draft · **Priority:** P2 · **Relative scope:** M · **Dependencies:** 7.2

As a traveller, I want useful updates without false trips or unwanted interruptions.

**Draft acceptance criteria:**

- **AC-7.3-1:** Separate new-trip candidates, confirmed updates and low-evidence abstention according to the validated policy.
- **AC-7.3-2:** Provide confirm/edit/reject and opt-in notifications with privacy-safe text and frequency controls.
- **AC-7.3-3:** Measure false-update rate, acceptance and notification opt-out, and avoid treating notification clicks as successful travel detection.

**AI / evaluation impact:** New-trip precision/coverage assessed on forward sequences, not only static libraries.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

### Story 7.4: Assess trusted maintenance after actual trips

**Status:** draft · **Priority:** P2 · **Relative scope:** M · **Dependencies:** 7.3

As a product owner, I want to know whether maintenance brings travellers back.

**Draft acceptance criteria:**

- **AC-7.4-1:** Follow consenting participants through actual evidence updates; report who had a new-trip opportunity and the follow-up duration.
- **AC-7.4-2:** Measure correction regressions, accepted updates and post-trip return separately from between-trip engagement.
- **AC-7.4-3:** Apply G2 decision rules and record whether identity, replay or another bounded experiment is justified.

**AI / evaluation impact:** Opportunity-adjusted retention and longitudinal quality; calendar inactivity alone is not failure.

**Validation to record:** Applicable behavior/error-path tests, ECC verification, human task evidence and task-level evaluation reports when inference changes. No results yet.

## Epic 8: Express a factual travel identity

**Phase:** 3 · **Priority:** P3 · **Owner roles:** John / Sally

**Outcome:** A traveller can recognize patterns and share a meaningful representation of their history.

**Scope:** Conditional discovery outline; no traveller ranking or unsupported personality claims.

**Prerequisites:** G2 · **Exit gate:** G3 · **Hypotheses:** H6–H8; H10

### Story 8.1: Explore factual patterns and a travel passport

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 7.4

As a traveller, I want a profile that represents my travel meaningfully.

**Draft acceptance criteria / experiment outcomes:**

- **AC-8.1-1:** Test repeat destinations, seasons and year/country views against supportable records and correction rules.
- **AC-8.1-2:** Let people choose visible profile facts; avoid implying more destinations makes a better traveller.
- **AC-8.1-3:** Measure identity resonance and actual revisits beyond curiosity.

**AI / evaluation impact:** Outline; define reference rules before implementation.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

### Story 8.2: Test an annual Travel Life summary

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 8.1

As a traveller, I want a review of a chosen travel year.

**Draft acceptance criteria / experiment outcomes:**

- **AC-8.2-1:** Prototype a factual year summary with incomplete-year and date precision disclosures.
- **AC-8.2-2:** Reuse selected sharing controls and measure revisit/share behavior separately.
- **AC-8.2-3:** Compare incremental value with the existing map/timeline before expanding formats.

**AI / evaluation impact:** Outline; annual counts must be deterministically supported.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

### Story 8.3: Decide whether travel-type labels add value

**Status:** option · **Priority:** P3 · **Relative scope:** S · **Dependencies:** 8.1

As a traveller, I want optional insights that I can correct.

**Draft acceptance criteria / experiment outcomes:**

- **AC-8.3-1:** Run a bounded experiment on interpretable travel-type suggestions without claiming definitive personality.
- **AC-8.3-2:** Explain supporting evidence and allow dismissal/correction.
- **AC-8.3-3:** Defer if factual patterns already serve the need or users find labels reductive.

**AI / evaluation impact:** Outline; subjective criteria require human evaluation and calibrated judges only if justified.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

## Epic 9: Replay memories when the emotional value is proven

**Phase:** 4 · **Priority:** P3 · **Owner roles:** Sally / John

**Outcome:** A traveller can revisit selected journeys through a controlled replay.

**Scope:** Conditional outline; test a small trip/year replay before cinematic lifetime production.

**Prerequisites:** G3 · **Exit gate:** G4 · **Hypotheses:** H4; H7–H10

### Story 9.1: Test a minimal trip or year replay

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 8.2

As a traveller, I want to relive selected memories with little setup.

**Draft acceptance criteria / experiment outcomes:**

- **AC-9.1-1:** Prototype a limited replay from explicitly selected visible media; handle unavailable assets.
- **AC-9.1-2:** Measure completion, repeat use and voluntary sharing against a simpler existing view.
- **AC-9.1-3:** Exclude music licensing/render infrastructure choices until the experiment justifies them.

**AI / evaluation impact:** Outline; media inclusion/privacy checks precede aesthetic judgment.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

### Story 9.2: Evaluate automated highlight selection

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 9.1

As a traveller, I want highlights that feel relevant and safe.

**Draft acceptance criteria / experiment outcomes:**

- **AC-9.2-1:** Collect consented human preferences and exclusion criteria; include sensitive/duplicate/missing media cases.
- **AC-9.2-2:** Compare a simple selector with any AI candidate using the same reviewed examples.
- **AC-9.2-3:** Proceed only if improved relevance warrants processing cost and privacy exposure.

**AI / evaluation impact:** Outline; human preference data and evaluator calibration if a judge is used.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

## Epic 10: Test useful personal travel intelligence

**Phase:** 5 · **Priority:** P3 · **Owner roles:** John / Winston

**Outcome:** A traveller can find their history and test suggestions that help future intent.

**Scope:** Conditional outline; can be tested without replay if retention evidence supports it.

**Prerequisites:** G2 · **Exit gate:** G5 · **Hypotheses:** H10–H11

### Story 10.1: Search personal travel history with evidence

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 7.4

As a traveller, I want answers about my history that I can verify.

**Draft acceptance criteria / experiment outcomes:**

- **AC-10.1-1:** Test a narrow set of useful history queries with cited record fields and uncertainty/abstention.
- **AC-10.1-2:** Do not infer exact dates/days or preferences beyond available records.
- **AC-10.1-3:** Compare retrieval and answer correctness to a non-generative filter/search baseline.

**AI / evaluation impact:** Outline; evaluate-rag only if architecture actually uses retrieval-augmented generation.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

### Story 10.2: Test correctable preferences against a generic baseline

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 10.1

As a traveller, I want preferences that reflect me rather than stereotypes.

**Draft acceptance criteria / experiment outcomes:**

- **AC-10.2-1:** Offer interpretable proposed preferences grounded in history with confirm/edit/dismiss controls.
- **AC-10.2-2:** Compare history-informed suggestions against generic suggestions on the same intent tasks.
- **AC-10.2-3:** Measure usefulness and meaningful saves/planning actions; click-through alone is insufficient.

**AI / evaluation impact:** Outline; paired human utility assessment and preference provenance.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

### Story 10.3: Decide whether recommendations change travel intent

**Status:** option · **Priority:** P3 · **Relative scope:** M · **Dependencies:** 10.2

As a product owner, I want evidence of utility before creating a recommendation platform.

**Draft acceptance criteria / experiment outcomes:**

- **AC-10.3-1:** Observe a defined future-travel intent cohort and report actual action opportunities.
- **AC-10.3-2:** Assess usefulness, diversity, factual support and sensitive-inference risks on reviewed cases.
- **AC-10.3-3:** Record proceed, narrow, repeat or stop for G5; do not presume a retention solution.

**AI / evaluation impact:** Outline; no production recommender or external data service is selected.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

## Epic 11: Test relevant world signals through Travel Pulse

**Phase:** 6 · **Priority:** P4 · **Owner roles:** John / Winston

**Outcome:** A traveller receives timely information relevant to a real travel interest.

**Scope:** Strategic option only; no live collection infrastructure.

**Prerequisites:** G5 · **Exit gate:** G6 · **Hypotheses:** H11

### Story 11.1: Validate one licensed, fresh travel-signal use case

**Status:** option · **Priority:** P4 · **Relative scope:** L · **Dependencies:** 10.3

As a traveller, I want relevant updates I can verify.

**Draft acceptance criteria / experiment outcomes:**

- **AC-11.1-1:** Choose one justified use case and lawful/authorized source with freshness, attribution and removal policy.
- **AC-11.1-2:** Test personal relevance against a non-personalized baseline; treat external content as untrusted data.
- **AC-11.1-3:** Advance only with measurable utility and acceptable operating cost.

**AI / evaluation impact:** Outline; source quality, freshness and grounded personalization need separate evaluations.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

## Epic 12: Test a sustainable business model

**Phase:** 7 · **Priority:** P4 · **Owner roles:** John / Mary

**Outcome:** A traveller can obtain useful premium value or act on travel intent without losing trust.

**Scope:** Strategic option; lightweight willingness-to-pay research can occur earlier, paid features cannot be presumed.

**Prerequisites:** GB · **Exit gate:** G7 · **Hypotheses:** H12

### Story 12.1: Compare premium and intent-based revenue hypotheses

**Status:** option · **Priority:** P4 · **Relative scope:** M · **Dependencies:** 6.4

As a product owner, I want a business model compatible with how people actually use Travel Life.

**Draft acceptance criteria / experiment outcomes:**

- **AC-12.1-1:** Research willingness to pay for evidenced memory/identity value without assuming subscription frequency.
- **AC-12.1-2:** Test commerce only after G5 demonstrates meaningful intent; do not make Pulse a mandatory dependency if another source supplies valid intent.
- **AC-12.1-3:** Before payments/affiliate launch, record pricing, disclosure, security and trust rules plus incremental economics.

**AI / evaluation impact:** Outline; monetize neither private history nor unsupported personalized claims.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

## Epic 13: Explore a network only after sustained product value

**Phase:** 8 · **Priority:** P4 · **Owner roles:** John / Sally

**Outcome:** Travellers gain a demonstrated collaborative benefit with clear visibility controls.

**Scope:** Strategic option only; not required for the core record.

**Prerequisites:** GB, sustained-product-value · **Exit gate:** G8 · **Hypotheses:** H7–H8; new network hypothesis

### Story 13.1: Validate one collaborative travel need

**Status:** option · **Priority:** P4 · **Relative scope:** L · **Dependencies:** 6.4

As a traveller, I want to collaborate only where it improves a real travel task.

**Draft acceptance criteria / experiment outcomes:**

- **AC-13.1-1:** Observe demand for one bounded need such as shared-trip correction or trusted friend discovery.
- **AC-13.1-2:** Define invitation, visibility, removal and abuse controls before any social implementation.
- **AC-13.1-3:** Proceed only if the task creates incremental value over private history and explicit sharing.

**AI / evaluation impact:** Outline; permission and cross-person data isolation checks are prerequisites.

**Validation to record:** Revisit scope and requirements at the preceding evidence gate; record a bounded experiment before promoting this option.

