---
title: Lightweight MLP evals, expanded through rollout
status: working-plan
revision: 7
updated: 2026-10-07
product_quality: not_measured
---

# MLP evaluation mechanism

Decision [0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md)
defines the MLP first loop. The engine safety and correction checks below still
apply; replay and sharing checks verify fidelity and privacy, not a subjective
claim that the experience is universally lovable.

Use small engineering checks for the first product, then expand real-data evaluation
from opted-in usage. The existing runner checks trace contracts only. There is still
no implemented engine or measured product benchmark at the time of this plan revision.

**Removed as pre-launch prerequisites:** participant recruitment, interviews,
competitor studies, a large real-data holdout, confidence calibration and an LLM judge.
**Retained inside implementation:** explicit expected behavior, schema/evidence checks,
small regression cases, model fallback and correction/deletion safety.

## Before the first beta

M2.1 creates versioned baseline traces. M2.2–M2.3 implement the bounded model/proposal
path. M2.4 adds a small developer-reviewed regression set. M2.5 caps resources and
verifies failure recovery. M1.5 and M2.6 add scheduled delta discovery and history
reconciliation. No separate research epic precedes these stories.

Use the [MLP spec's decision table](mvp-spec.md#initial-reconstruction-rules) and
[fixed v1 examples](../../docs/decisions/0007-reconstruction-v1-parameters.md#acceptance-examples)
as the minimum case list: 5 km cluster cutoff and ties, 48-hour/one-civil-day
visit boundaries, 72-hour/two-civil-day journey links, 30-day visit and journey
caps, 240-hour/ten-civil-day possible merge, 24-hour GPS-less
automatic bracket and one-day/three-day suggestion limits. Include GPS-less photos
with one/two/no compatible journeys,
shared-trip memories versus unsupported downloads, duplicate families, uncertain
timezones/date precision, sparse gaps, local-photo chains, A → B → A visits,
owner-confirmed boundaries, home-proximate but unconfirmed evidence, date-scoped
usual areas, late additions and stale AI responses. Specify expected trip membership,
visit support, episode boundaries, allowed uncertainty and prohibited assertions.
Use synthetic cases and authorized internal device examples if available. Synthetic
cases are engineering checks, not representative population evidence.

Run objective code checks for:
- valid output shape and evidence IDs;
- no invented place/date/source support or visit support from trip-only media;
- one accepted primary journey per photo and no duplicate-family support inflation;
- separate places from chronological visits, preserving A → B → A;
- explicit owner boundaries, date-scoped usual areas and unresolved assignments;
- inferred versus owner-confirmed state separation;
- preserved corrections and manual records;
- stale AI revision rejection, stable retry/rescan and input-order behavior;
- full versus incremental/background agreement on identical final evidence/rules;
- delayed historical additions, changed assets and permission-scope reconciliation;
- checkpoint/expiration recovery and no lost owner corrections;
- visibility/deletion/share-content consistency;
- snapshot/media owner isolation, token expiry/revocation and no automatic publishing;
- lifetime replay uses chronological observed destinations and owner-visible eligible
  media only, has no invented route/narration/music, and handles sparse/missing media;
- configured model/token/request caps and fallback.

Record baseline/candidate/prompt/model versions, actual case counts, results and
observed latency/cost. If a model/service check is not run, record it as untested.
The first beta can use clearly labeled inferred drafts without a validated confidence
percentage. Do not gate launch on a subjective judge whose validity is unknown.

## During implementation and limited rollout

M5.1 captures allowlisted coarse funnel events. M5.2 accepts optional usefulness/error
feedback. Raw evidence/case sharing needs separate explicit opt-in; normal analytics
must not carry photo contents, exact GPS, trip dates or free-form history.

M5.3 verifies actual device behavior on iOS and Android, including denied/limited/
revoked access, no GPS, missing media, interruption, offline/provider failure, edits
and deletion. Check real-device background scheduling/restriction and force-quit/
relaunch catch-up; a developer-triggered handler test is not proof of production
scheduling. Compare incremental with full reconstruction where inputs/rules match.
Verify hosted links on mobile/desktop browsers without app/login, interaction and
media access, invalid/expired/revoked tokens, remote deletion and private snapshot
stability during background maintenance. Verify 30–60 second 720p replay preview,
cancel, playback and native export on both platforms; it is required P0 MLP behavior.
The local fallback can be exercised without a provider account, but
do not advertise an enabled AI feature before its actual integration has been checked.

## After rollout

M5.5 performs human error-discovery on volunteered cases and chooses the next fixes.
Do not infer complete truth from counts of corrections alone. Start with free-text
notes, adjudicate ambiguity where needed, then stabilize an observed failure taxonomy.

As enough cases accumulate:
1. Version reference labels including unknown and uncertain cases.
2. Split by person/library, keeping duplicates and related journeys together.
3. Preserve tuning/calibration data separately from a future holdout.
4. Compare changed engines on the same cases with counts, slices and uncertainty.
5. Add write-code-eval for observed objective failures.
6. Use write-judge-prompt and validate-evaluator only for an actual subjective need.
7. Use eval-audit as the system becomes substantive; use evaluate-rag only for
   a real retrieval-augmented feature.

Choose later numeric quality gates using observed errors and user costs before
opening holdout results. A growing real benchmark improves future releases; its
absence does not recreate the retired demand-validation gate for the first beta.

## Measurements and honest limits

False visits, photo-membership errors, omission/coverage, split/merge errors,
boundary error, unresolved cases and correction burden remain separate. Missing
GPS is not proof of no visit. Owner-entered corrections
must not inflate pre-correction engine recovery scores. Partially reviewed histories
cannot establish complete lifetime recall.

Report actual sample counts and observed costs. The launch decision is based on
working behavior and a small checked set, with population quality explicitly
unmeasured. Product value, sharing and retention are assessed through rollout.

See [MLP spec](mvp-spec.md), [delivery backlog](epics.md),
[evals README](../../evals/README.md) and
[the broader reconstruction proposal](../../evals/design/reconstruction-plan.md).
The broader proposal is future guidance, not a launch-blocking requirement.
