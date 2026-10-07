# Reconstruction evaluation proposal

Status: broader future evaluation guidance, not a launch prerequisite. No engine,
real benchmark or calibrated quality thresholds exist. The user selected a working
MVP first; use _bmad-output/planning-artifacts/eval-roadmap.md for the active small
pre-beta checks and post-rollout error-discovery sequence. Grow the fuller proposal
as consented cases accumulate; do not restore a Phase 0 research gate.

## Initial evaluation scope

Choose one narrow task first: e.g. evidence-supported destination/presence decisions.
Separate observed facts from inferred trip boundaries and owner-confirmed history.
Do not start with an undifferentiated score for the whole travel graph.

Three candidate variation axes:
1. Evidence quality: original geotagged media, missing GPS, shared/exported media,
   duplicated sources, inconsistent dates.
2. Journey structure: single destination, multi-stop trip, transit, domestic day
   trip, changing residence, sparse days.
3. Ambiguity/correction: conflicting signals, no support, imported historical
   evidence, user-confirmed correction.

Use the synthetic-data skill with domain review to select realistic combinations;
do not generate arbitrary Cartesian products or label all examples with a model.

## Candidate measures after labels exist

| Question | Candidate measure | Required reference |
| --- | --- | --- |
| Did we incorrectly assert a visit? | False visit count and precision; show denominator | Human-confirmed visited/not-visited/unknown decisions |
| How much known history was recovered? | Recall/coverage over reference visits or trips | A reasonably complete owner-reviewed history |
| Did we group journeys correctly? | Split/merge errors and boundary error | Agreed trip definition and date precision |
| Can we abstain usefully? | Coverage versus error among answered cases | Labels including legitimate uncertainty |
| Does confidence mean anything? | Calibration by confidence band | Sufficient independent labeled cases |
| Does the record stay corrected? | Regressions after new imports/rescans | Explicit correction and merge semantics |
| Is it practical? | Latency distribution, processing cost, correction time | Actual instrumentation and observed user tasks |

Report false positives separately from omissions. Missing GPS is not proof of no
visit. Unknown labels must not be silently treated as negative examples. Country
and destination denominators require agreed counting definitions.

## Data and comparison design

- Consent must cover storage, model processing, review and retention separately
  as applicable. Reference it without committing identifying records.
- Prefer person/library-level splits to prevent the same journey or duplicate
  photos leaking between tuning and holdout. Document exceptions.
- Store dataset and evaluator versions, baseline/candidate identities and seeds
  when available. Include unsuccessful runs; do not select only favorable samples.
- Human notes come before a stable error taxonomy. Adjudicate disagreements.
- If a judge is introduced, measure agreement/error against held-out human labels,
  including false acceptance/rejection; validate again when the judge changes.
- Separate emotional preference and sharing behavior from algorithmic accuracy.
- Record sample counts and uncertainty. A small synthetic set is a development
  tool, not evidence of general performance.

## Exit evidence for the first experiment

A reproducible dataset/run manifest, actual engine traces, owner/reviewer notes,
observed failure modes, a baseline report, and an explicit decision about what to
test next. Thresholds and release gates remain open decisions.
