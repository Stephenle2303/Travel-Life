---
title: 'M2.4 Add the small engine regression suite'
type: 'feature'
created: '2026-10-11'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f82d6496638ce70e94c1094d7a86473be4064fa7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
  - '{project-root}/evals/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `reconstruction-v1` has a small baseline test set, but its approved spatial, temporal, membership, correction, and determinism boundaries are not yet protected by a developer-reviewed regression suite. A future change could silently convert uncertain evidence into unsupported history.

**Approach:** Add compact synthetic cases and objective invariant helpers around the local reconstruction engine, and correct only behavior that demonstrably conflicts with Decision 0007. Each case will name supported memberships, visit support, journey/merge boundaries, allowed uncertainty, and prohibited claims. Record the optional AI sample as untested because its production kill switch remains off.

## Boundaries & Constraints

**Always:** Use synthetic evidence only; reuse `reconstructV1` as the deterministic subject under test; assert graph IDs, memberships, visit support, dispositions, journey drafts, possible merges, and order stability explicitly. Preserve correction/boundary precedence, duplicate-family protection, date-line normalization, and the separation of journey membership from place/visit support. Compare matching final inputs across permutations and repeated rebuilds. Record exact observed test results and keep `product_quality` unmeasured.

**Never:** Add real owner media, source IDs, filenames, coordinates, dates, traces, or credentials to Git or output. Do not claim population accuracy, calibrated confidence, travel continuity, owner presence, or a live/provider model result. Do not enable AI, alter Supabase configuration, add a migration, or make a background scheduler claim; M2.6 owns actual incremental reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Exact rule cutoffs | Synthetic evidence at and just beyond each v1 spatial/time/span boundary | At-cutoff outcome follows Decision 0007; just-beyond outcome remains separate, suggested, unresolved, or unassigned as applicable | No invented offset, order, duration, presence, or continuity. |
| Uncertain/unsupported evidence | Date-only, missing-date, unknown/poor GPS, duplicate-conflict, unsupported download, or competing GPS-less alternatives | Preserve allowed uncertainty and prohibit place/visit support or automatic membership where evidence is insufficient | Retain an explicit disposition or suggestion; never silently select an alternative. |
| Owner precedence and late arrival | Exclusion/boundary/usual-area correction plus reordered or batched final evidence | Owner constraint survives and matching final input produces the same graph | Retain the prior valid graph semantics; do not remap a correction by convenient identity. |
| Optional AI unavailable | Disabled proxy and synthetic regression execution | Record the model sample as untested while local cases run independently | Do not create a session, network request, or model-quality assertion. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/engine.ts` -- `reconstructV1` is the pure rule target; align only verified deviations from Decision 0007, especially weak-date journey and GPS-less suggestion behavior.
- `apps/mobile/src/reconstruction/types.ts` -- preserve explicit evidence precision, uncertainty, memberships, and possible-merge contracts used by the fixtures.
- `apps/mobile/src/components/__tests__/reconstruction-engine.test.ts` -- existing `e()` synthetic-evidence factory and baseline tests; evolve into the compact table-driven regression suite.
- `apps/mobile/src/reconstruction/{repository,controller}.ts` -- inspect only for repeated-final-rebuild parity; do not claim M2.6 incremental scheduling is implemented.
- `docs/decisions/0007-reconstruction-v1-parameters.md` -- authoritative thresholds, examples, prohibited assertions, and deterministic clustering rules.
- `evals/README.md` and `_bmad-output/planning-artifacts/eval-roadmap.md` -- record that code checks are contract evidence and the disabled AI sample is untested.
- `docs/project-state.md` -- record scope, actual case/check results, and limits without reporting an accuracy metric.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/components/__tests__/reconstruction-engine.test.ts` -- added synthetic, table-driven boundary fixtures and invariant helpers for clustering, visit/journey/merge cutoffs, GPS-less membership, duplicates, ordering, A-to-B-to-A, owner boundaries/usual area, and unsupported/uncertain evidence.
- [x] `apps/mobile/src/reconstruction/{engine,types}.ts` -- made the smallest Decision 0007-aligned fixes exposed by those fixtures; outcomes remain explicit unresolved/suggested states with no unsupported assertions.
- [x] `apps/mobile/src/reconstruction/{repository,controller}.ts` and adjacent tests -- pure final-input rebuild permutations prove stable reversed, batched, and repeated graph construction; M2.6 remains responsible for device-backed incremental/background reconciliation.
- [x] `evals/README.md`, this spec, and `docs/project-state.md` -- recorded regression scope, actual test evidence, `product_quality: not_measured`, and the disabled/untested model sample.

**Acceptance Criteria:**
- Given synthetic cases at every Decision 0007 cutoff and nearby failing value, when `reconstructV1` runs, then output matches the stated deterministic boundary and includes no prohibited travel/presence/order claim.
- Given duplicate, unsupported, date-imprecise, GPS-less, competing, owner-bounded, usual-area, and late-arrival cases, when the graph is rebuilt, then support, membership, uncertainty, and correction precedence remain explicit and stable.
- Given the same final synthetic evidence and correction/rule state in different orders or repeated rebuilds, when results are compared, then canonical places, visits, journeys, memberships, dispositions, and possible merges are equivalent.
- Given the AI kill switch is disabled, when M2.4 verification is recorded, then it reports the model sample as untested and makes no provider or quality claim.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| Weak same-place grouping ignores owner boundaries | medium | patch | A boundary inside a weak visit could be absorbed and later crossed. Weak visits now split at boundaries and the date-only boundary regression passes. |
| Weak visit ordering reads an alphabetic evidence ID | medium | patch | The first ID could differ from the chronological endpoint. Visit start/end helpers now order by valid civil day and only then by precise instant. |
| Weak visits are processed after ordered visits | medium | patch | Mixed precision could expose a fabricated cross-precision relationship. The engine now leaves mixed visits separate without an automatic link or merge, and the regression passes. |
| Weak possible merges require a weak predecessor | false | reject | A cross-precision relation lacks a reliable common ordering basis; the conservative no-merge treatment avoids the unsupported directional claim required by the frozen constraints. |
| GPS-less suggestion checks any support instead of the padded journey span | medium | patch | Sparse valid memories could be lost or outside-span media suggested. The engine now checks both padded first-to-last span containment and the three-day nearest-support limit. |
| Usual-area/boundary checks inspect only one weak observation | medium | carried patch | Same verified weak-visit endpoint defect; visit-wide boundary and usual-area checks now apply. |
| New weak path lacks correction and mixed-precision regression coverage | medium | patch | Focused synthetic cases now cover boundary, usual-area, same-day alternatives, and mixed precision. |
| Same-day weak alternatives could create a directional merge | medium | patch | Same-day alternatives have unknown within-day order; the weak path now produces neither automatic link nor directional merge. |
| Invalid civil days can bypass weak-date limits | medium | patch | Invalid civil dates are rejected from supported visits with an explicit unresolved disposition and a regression case. |
| 5 km reported-accuracy cutoff has no regression case | medium | patch | A focused exact/over-limit accuracy case now verifies that the accepted threshold supports a place and the nearby failing value does not. |
| 50 km usual-area distance cutoff has no executable engine regression | medium | defer | Current reconstruction input contains only the resolved `usualAreaContext` flag; no owner-area center/range model exists in the local record, so this pre-existing classification rule cannot be exercised without the missing model. |
| Verification: same-day weak cross-place journey lacks a test | medium | carried patch | Same verified same-day ordering defect; the focused regression now proves two separate journeys with no merge. |
| Verification: weak-date usual-area block lacks a test | medium | carried patch | Same verified visit-wide usual-area defect; the focused regression now proves separate journeys with no merge. |
| Verification: later weak owner boundary can be bypassed | medium | carried patch | Same verified weak-boundary grouping defect; the focused regression proves the split. |

## Design Notes

Use compact fixture labels that describe behavior rather than a real place or person. The assertions should be readable as a decision table: what supports a visit, what is only a trip-memory suggestion, what remains unresolved, and what cannot be inferred. Keep the suite close to the engine so refactors cannot bypass it.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand reconstruction-engine` -- expected: all synthetic reconstruction regression cases pass.
- `npm --prefix apps/mobile run check` -- expected: complete mobile test, type, lint, and Expo checks pass.
- `npm run check` -- expected: foundation and evaluation-infrastructure checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Review fixture names and expectations for synthetic-only content, explicit uncertainty, no precise personal data, and no quality/provider claim.

Observed 2026-10-11: `npm --prefix apps/mobile test -- --runInBand reconstruction-engine` passed 35/35 synthetic cases. The unrestricted `npm --prefix apps/mobile run check` passed 21 suites / 144 tests, TypeScript, lint, and Expo Doctor 21/21. `npm run check` passed 20 foundation tests and evaluation smoke. `product_quality: not_measured`. The optional model sample remains untested because the kill switch is disabled; no provider request, result, latency, cost, or quality claim was produced. M2.6 owns actual incremental/background reconciliation, which this story does not simulate.
