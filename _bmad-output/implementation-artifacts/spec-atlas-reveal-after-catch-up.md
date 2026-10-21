---
title: 'Recover truthful Atlas visibility after local catch-up'
type: 'bugfix'
created: '2026-10-20'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
context:
  - 'docs/development/error-playbook.md'
  - 'docs/product/context.md'
  - 'docs/product/design-system.md'
  - '_bmad-output/implementation-artifacts/spec-trip-detection-engine-v1-1.md'
  - '_bmad-output/implementation-artifacts/spec-debug-atlas-database-busy.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After an owner runs local catch-up, Atlas can remain empty: no map and no journeys. V29 retroactively classified the owner’s formerly visible V1 projection as `SUGGESTED`, while the primary projection hides it; any failure while refreshing that durable projection is also silently discarded.

**Approach:** Preserve owner-trusted, previously committed legacy journeys in a distinct local continuity state that is visible as an ordinary private Atlas journey but is never represented as newly V1.1 auto-qualified. Keep V1.1 strict for new/re-evaluated trips, await the durable read-back after rebuild/catch-up, and use a single quiet recovery state only for a real read failure.

## Boundaries & Constraints

**Always:** Preserve current committed Atlas/media while work runs; retain a correction-safe private registry of legacy journeys separately from V1.1 classifications; keep raw evidence, IDs, dates, locations, SQL errors and qualification reasons on device; re-read the durable projection before reporting catch-up success; preserve lifecycle/generation invalidation and serialized SQLite access.

**Never:** Add `SUGGESTED`, `UNCONFIRMED`, `NOT_TRIP`, or rejected newly detected candidates to Atlas/Timeline/counts/replay; represent preserved legacy journeys as newly V1.1 auto-qualified; add permanent migration/confidence labels; erase or reinterpret correction lineage; bypass protected remaps; transmit private data; claim device confirmation while ADB is unavailable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Legacy continuity | Owner-trusted V1 journeys existed when V1.1 migration arrived | Migration preserves their stable private identity and their current rebuild projection remains visible as ordinary Atlas entries | Do not classify an unrelated/new candidate as legacy |
| Qualified catch-up | Atomic run contains automatic/user-confirmed journeys | Durable read completes before Atlas says it is caught up; map and Timeline show the redacted primary set plus preserved legacy entries | Retain prior committed view until read-back succeeds |
| Durable-read failure | SQLite/schema/native read fails after completed reconstruction | Existing private Atlas remains visible and a safe recovery message/action appears | Record only a fixed failure category; never swallow it |
| All new candidates unqualified | Last run has zero V1.1-primary journeys and one or more newly withheld candidates | Existing preserved legacy entries remain visible; otherwise sparse Atlas gives one plain recovery action | No draft marker/card/count/replay exposure |
| Owner protection pending | Correction remap/review blocks catch-up | Preserve committed Atlas and direct to the existing review path | No retry that changes correction state |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/photo-access/provider.tsx` -- refreshes durable reveal asynchronously after controller completion and currently swallows read failures; centralize an awaited publication/read-back after rebuild and reconcile.
- `apps/mobile/src/reconstruction/controller.ts` -- owns running/completed/error transitions; expose only fixed safe durable-read outcome to the provider/UI.
- `apps/mobile/src/reconstruction/repository.ts` -- durable Atlas query and rebuild persist/select V1.1 primary journeys; incorporate a distinct legacy-continuity registry only for pre-existing owner-trusted identities, retaining detail/media IDs and current correction boundaries.
- `apps/mobile/src/import-record/repository.ts` -- add a versioned local-only migration that records qualifying pre-V1.1 legacy identities; it must not convert arbitrary future `SUGGESTED` rows into continuity records.
- `apps/mobile/src/reveal/{types,projection}.ts` and `apps/mobile/src/components/{mobile-screens,atlas-reveal}.tsx` -- render a truthful sparse/recovery state while retaining the map-first pattern when a committed qualified set exists.
- `apps/mobile/src/components/__tests__/{photo-access-provider,reconstruction-controller,reconciliation-repository,import-repository,atlas-reveal}.test.tsx` -- protect continuity migration/rebuild, awaited durable publication, read failures, and no new-draft leakage.
- `docs/development/error-playbook.md`, `docs/project-state.md`, and this spec -- record evidence, limits, and device acceptance.

## Tasks & Acceptance

**Execution:**
- [x] Schema/repository -- persist legacy continuity only from the qualifying pre-V1.1 local projection, retain it through future rebuilds when its stable identity remains, and select it with V1.1 primary journeys without claiming it passed V1.1.
- [x] Provider/controller -- make post-rebuild and post-catch-up durable-read completion part of the owner-visible result; preserve last committed state and fixed-safe error handling.
- [x] Atlas UI -- keep preserved journeys visually ordinary; use a quiet recovery action only for an unavailable durable projection, while retaining map/Timeline for a committed set.
- [x] Regression tests and records -- focused host tests (5 suites / 121 tests), the full mobile Jest suite (37 suites / 342 tests), TypeScript, lint, root check, and whitespace audit pass. Expo Doctor remains 20/21 because of the existing nine SDK patch-version recommendations; owner click-and-wait remains.

**Acceptance Criteria:**
- Given a device with owner-trusted V1 journeys, when it migrates and then catches up locally, then the matching legacy journeys remain in the redacted Atlas/Timeline/detail/media projection without a permanent UI label or V1.1 qualification claim.
- Given a completed catch-up with primary or preserved legacy journeys, when the durable projection becomes readable, then Atlas updates from that committed record before success copy is shown.
- Given a durable projection read fails, when the owner remains on Atlas, then the prior committed Atlas stays browseable and the UI identifies recoverability without raw error data.
- Given only new suggested/unconfirmed candidates and no preserved legacy history, when Atlas opens, then it never renders them as journeys, map markers, counts, replay input, or shared data, and it explains the selected next action.

## Implementation Notes

- Owner decision (2026-10-20): formerly visible, correct legacy journeys return as normal private Atlas entries without migration/confidence labels. V1.1 remains strict for new or explicitly re-evaluated automatic journeys.
- Investigation found both a freshness defect (fire-and-forget durable projection read and swallowed errors) and an intentional V1.1 primary qualification boundary. Legacy continuity must be separate from that boundary, not a widened suggestion filter.
- Android device confirmation is presently blocked because the absolute ADB executable cannot start/connect to its daemon; no device-private database was read.

## Spec Change Log

## Review Triage Log

- `high / patch` — V34 originally admitted every historical `SUGGESTED` row. It now requires the latest completed V29 backfill signature, records the source run, and has source-level regressions for all predicates.
- `medium / patch` — Continuity originally overrode all later qualification states. Every durable Atlas/count query now admits it only while the current classification remains `SUGGESTED`; explicit non-primary states remain hidden.
- `false` — An owner rejection does not leave a qualifying journey with an unrestricted correction: reconstruction applies a grouping constraint or removes the matching graph identity, and the tightened predicate excludes non-suggested outcomes.
- `maybe-false / defer` — Generated journey IDs derive from visit identities. The accepted contract preserves only an identity that remains in the committed graph; no proven ID-reuse path exists. A future identity-lineage feature would need a separate product decision.
- `medium / patch` — The migration/projection regression was source-only. It now asserts the full historical migration signature and each consumer predicate; native SQLite fixture execution remains a device acceptance limitation.
- `medium / defer` — Provider-level maintenance ordering is part of the pre-existing maintenance concurrency work in this dirty tree, not introduced by this continuity change; its controller regression already covers `whenIdle` and needs a separately scoped provider test.
- `medium / defer` — A dedicated provider test for retaining an already loaded reveal after native read failure remains desirable; current code retains state because neither failure path clears it, and device acceptance is still required.
- `medium / patch` — Atlas screen discarded the provider rejection from catch-up. It now catches it at the event boundary after the provider has set safe recovery state.
- `low / patch` — Initial read failure promised a previous Atlas even when none had loaded. The copy is now factual and generic.
- `maybe-false / defer` — Retry routes through the existing reconstruction recovery path; a distinct read-only retry needs product/UI direction and is not required to preserve the current committed view.
- `false` — Schema gating on durable read is intentional shared-schema safety for an independently opened reconstruction repository; it runs only when migration is needed and preserves the no-write current-schema fast path.
- `medium / defer` — Migration-list duplication predates this story and is covered by the current-schema tests; centralizing it is a separate repository architecture change.
- `defer` — Benchmark baseline-pin findings concern the pre-existing performance scripts, outside the Atlas-continuity intent.
- `defer` — The generated review diff is a temporary BMAD artifact and is excluded from source/runtime verification; it should be removed or ignored before any commit, which this task was not authorized to make.

## Design Notes

The recovery state is quiet and explicit: the dominant map remains when a committed projection exists; otherwise the owner sees one plain explanation and one appropriate action, never a fabricated world map or draft destination.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand photo-access-provider reconstruction-controller reconciliation-repository atlas-reveal` -- expected: publication, redaction and recovery regressions pass.
- `npm --prefix apps/mobile run check` -- expected: mobile tests, TypeScript and lint complete; record any environment limitation exactly.
- `npm run check` -- expected: repository foundation checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- On an authorized Android/iOS device, owner taps catch-up once and waits for terminal state; verify a qualified record restores map/Timeline, an unqualified record explains the next action, and any prior committed record remains browsable after a read failure.
