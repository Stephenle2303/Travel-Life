---
title: MLP implementation readiness
status: working-scope-recorded
revision: 7
updated: 2026-10-07
start_implementation: READY_AFTER_INITIAL_BASELINE_COMMIT
release_ready: false
---

# MLP implementation readiness

**Technical defaults and MLP release scope are recorded.** Decision
[0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md) defines the
private lifetime map reveal, replay video and selected-highlight sharing contract.
The scope is ready for implementation; the active BMAD build workflow still requires
an initial clean repository baseline before it can create delivery artifacts. No
application code has been started.
The user's build-then-learn direction supersedes the previous FAIL finding driven
by the discovery-first plan. Both platforms, a bounded core flow, technical defaults,
inference/correction rules and lightweight eval obligations are recorded in the
[MVP spec](mvp-spec.md), [decision 0002](../../docs/decisions/0002-mvp-first-delivery.md),
[decision 0006](../../docs/decisions/0006-photo-trip-assignment.md),
[decision 0007](../../docs/decisions/0007-reconstruction-v1-parameters.md) and
[M1–M5 backlog](epics.md).

The prior assessment covered technical scope. It is not a completed MLP experience
assessment, a formal BMAD sprint gate or a claim of launch readiness. No app code,
signed build, provider call or deployment was produced by this planning revision.

## Previously resolved technical questions

- User selected iOS and Android, required background maintenance, the private lifetime
  map reveal, replay video and interactive selected-highlight sharing in the MLP.
- Agent-selected shared stack, source, local persistence, model/proxy and map defaults exist.
- Initial trip/place/date/uncertainty rules and correction precedence are explicit.
- Photo membership, visit support, owner boundaries and reviewed facts have separate
  rules; reconstruction v1 fixes bounded windows and ties before M2.1 coding.
- UI flow and required error states are recorded.
- A small pre-release eval mechanism and post-rollout measurement plan exist.
- No interview/recruitment/competitor benchmark/G0 approval is required.

## Resolve while delivering, not through a research epic

| Item | Delivery location |
| --- | --- |
| Actual source fields/permission parity and supported selection behavior | M1.2 |
| Dependency versions, native integration and device builds | M1.1–M1.4 |
| Scheduled delta discovery, worker recovery and correction-preserving reconciliation | M1.5, M2.6, M5.3 |
| Model/service access, secrets, retention disclosure and budget enforcement | M2.2–M2.5 |
| Heuristic edge cases and correction rebuild behavior | M2.4, M4 |
| Implement and verify fixed v1 place ties, episode/association bounds and reviewed examples | M2.1, M2.4 |
| Map configuration and unavailable-map fallback | M3.2, M4.6 |
| Snapshot/storage authorization, browser viewer hosting and revoke/expiry | M4.5–M4.6 |
| Lifetime replay renderer and both-platform export | M4.7 |
| Minimal telemetry/feedback consent, retention and access | M5.1–M5.2 |
| Signing accounts, iOS build route and Android distribution/source policy | M5.4 |
| Actual reliability, costs and remaining errors | M5.3 and rollout |

These items can fail an implementation or release check when actually unmet.
They do not require interviews or proof of demand. Detailed PRD/UX/architecture
documents may be elaborated inside delivery when they add clarity; document count
itself is not a prerequisite.

## Release still pending

Record an initial clean baseline, then complete P0 stories, actual both-platform tests and small regression checks;
configure operational dependencies and verify data/correction/AI safeguards,
background recovery and hosted-journey/media sharing controls.
Do not claim population accuracy from synthetic cases or foundation checks.
No sprint-status or delivery schedule was fabricated in this revision.
