---
title: Evaluation work across the Travel Life roadmap
status: proposed
updated: 2026-10-06
product_quality: not_measured
---

# Evaluation roadmap

The existing runner verifies trace contracts and synthetic plumbing. There is no
product engine, real benchmark, human label set or validated subjective judge yet.
This document schedules the work needed to earn credible AI claims; it does not
execute an evaluation or select a commercial evaluation service.

Use [the reconstruction proposal](../../evals/design/reconstruction-plan.md) and
[the evaluation README](../../evals/README.md) as the current mechanism.
The story IDs below link to the single [epic backlog](epics.md).

## Sequence and evidence

| Step | Stories | Evaluation work | Deliverable when executed |
| --- | --- | --- | --- |
| Define behavior | 1.3 | Presence/visit/trip units, transit/residence, date precision, owner confirmation, uncertainty | Recorded label policy and worked cases |
| Design the study | 1.4 | Consent, reviewer/adjudication, sufficiently complete references, library/person splits, pre-registered rules | Versioned private-data manifest and public-safe protocol |
| Establish a baseline | 1.5 | Metadata baseline; explicitly disclose manual assistance; retain failed cases | Actual traces, source coverage and observed error/resource report |
| Compare alternatives/value | 1.6 | Same reference history, actual tested alternatives, independent exploration and correction tasks | Paired study results with counts and limitations |
| Instrument the engine | 3.1 | Versioned evidence-to-claim traces and baseline configuration | Reproducible runs; contract compliance |
| Discover errors | 3.2 | Human free-text trace review, diverse sampling, disagreement adjudication | Observed failure taxonomy; dataset splits and gaps |
| Select improvements/checks | 3.3 | Compare simple baseline and justified model candidates on tuning/calibration data | Adopt/reject report; objective rules or calibrated subjective evaluator |
| Measure presence/grouping | 3.4–3.5 | False visits/coverage, useful abstention, split/merge and boundary cases | Task-level reports by evidence/journey slice |
| Assess a frozen candidate | 3.6 | Untouched holdout, baseline/candidate paired comparison, repeat stochastic runs if needed | Pass/fail/inconclusive quality decision with counts/uncertainty |
| Protect corrections | E05 | Confirm/reject/split/merge/manual entry/visibility/rebuild | Deterministic invariants and observed correction effort |
| Test forward updates | E07 | Longitudinal new/changed/deleted evidence, owner edit preservation | Update precision/coverage, resource cost and correction regressions |
| Evaluate future tasks | E08–E11 | Factual identity; human highlight preferences; grounded search; recommendation utility/freshness | New task-specific data/evaluators, not reuse of presence scores |

With no traces, generate-synthetic-data can help cover agreed variation axes.
Domain review is still needed. After real traces exist, use error-discovery.
Write-code-eval handles objective rules. Use write-judge-prompt only for interpretation
that code cannot check, then validate-evaluator against independent human labels.
Use eval-audit once the system has substantive evaluation evidence.
Use evaluate-rag only when a real retrieval-augmented feature exists.

## Initial units and slices to settle in E01

- Evidence item: available source fields, media origin signals when actually available,
  missing/conflicting metadata and duplication.
- Presence/visit claim: place + date precision + supported/uncertain/abstained/confirmed
  state. Owner references can be visited, not visited or unknown.
- Journey: agreed grouping and boundary precision; multiple journeys from one person
  must not leak across train/tuning and holdout via duplicated photos.
- Update sequence: old state, new/changed evidence, corrections and resulting state.
- User task: comprehension, exploration and correction effort; different from model output quality.

Include original geotagged media, missing GPS, legitimate shared trip photos,
unsupported downloads/screenshots, altered/exported media, sparse dates,
multi-stop/day trips, transit, residence changes and timezone conflicts.
Sample real frequencies when known and keep targeted stress cases identifiable.
Do not report synthetic or adversarial slices as representative population estimates.

## Candidate metrics and safeguards

| Question | Candidate measurement | Important safeguard |
| --- | --- | --- |
| Did we invent a visit? | False visits and precision with numerator/denominator | Unknown truth is not a negative; distinguish automatic accepted claims from suggestions |
| How much was recovered? | Visit/trip recall or coverage against owner reference | A partial reference cannot establish complete lifetime recall |
| Is grouping credible? | Split/merge counts, boundary error | Apply agreed semantics and date precision; ambiguous references stay visible |
| Is uncertainty useful? | Answered coverage versus error; suggestion/abstention rate | Abstaining on everything cannot pass by precision alone |
| Does confidence mean anything? | Calibration by band, if confidence is exposed | No fabricated numeric probabilities from uncalibrated scores |
| Do corrections survive? | Rebuild/update regression counts | Owner corrections must not inflate pre-correction engine accuracy |
| Is the experience practical? | Latency/cost/resource distributions and correction time | Report device/library slices, failed runs and missing measurements |
| Does the product add value? | Independent task completion, comparative preference, meaningful revisit | Separate assisted prototype results from automated product performance |

Human labels, reviewer identity and consent references stay private. Share only
non-identifying summary artifacts appropriate to consent. Private engine traces
belong in the ignored evaluation directories; sanitization is not guaranteed by Git ignore.

## Gate policy

E01 records qualitative study rules. After actual error discovery, the team chooses
numeric release limits and cost/latency budgets from user harms and calibration data,
records them in a decision before holdout, and identifies a human decision owner.
This roadmap intentionally provides no arbitrary accuracy target.

For any inference/model/prompt/data-policy change, retain the baseline/candidate
versions, dataset and split versions, evaluator versions, reference-label provenance,
actual command/config, run identity, counts/slices, uncertainty, latency/cost,
observed regressions and a pass/fail/inconclusive decision.
Software tests must also cover deterministic behavior. Neither check replaces the other.

