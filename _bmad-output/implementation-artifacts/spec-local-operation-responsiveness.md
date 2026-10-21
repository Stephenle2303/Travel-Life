---
title: 'Speed up private Atlas reconstruction'
type: 'feature'
created: '2026-10-19'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
context:
  - 'docs/development/error-playbook.md'
  - 'docs/product/design-system.md'
  - '_bmad-output/planning-artifacts/reviews/2026-10-19-performance-and-responsiveness-architecture-review.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Atlas takes too long to reconstruct a private library and can continue to say “Updating” after work has only been queued. The owner wants the rebuild itself to finish sooner, with a truthful distinction between a running operation and waiting changes.

**Approach:** Benchmark a synthetic library, remove redundant minimax calculations in dense place clustering, and batch the high-volume SQLite projection inserts within the existing atomic transaction. Show queued changes as waiting with an explicit catch-up action, and disable the duplicate action while a rebuild is truly running. Compare synthetic results before and after; retain physical device timing as an explicit acceptance check.

## Boundaries & Constraints

**Always:** Use only synthetic evidence for checked-in benchmarks; preserve the exact graph, one serialized reconstruction, atomic projection and queue acknowledgement, lifecycle guards and last committed Atlas/media; keep SQLite batches under the conservative parameter limit; make actual-running and queued states distinguishable.

**Never:** Change reconstruction, qualification or correction rules, publish partial graphs, run competing SQLite rebuilds, delete history, upload diagnostics, or claim a device latency improvement without measured device evidence. The manual journey rule during an active rebuild stays as it is.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dense synthetic place | Many nearby source records enter reconstruction | The graph is unchanged and minimax representative scores are computed once per candidate | No heuristic shortcut may alter tie or distance rules |
| Projection writes | Thousands of link/disposition rows are committed | Rows use bounded multi-value inserts inside the same transaction | Any failed batch rolls back the full projection and queue acknowledgement |
| Waiting updates | Queue has pending changes but no operation is running | Last committed Atlas remains available with a catch-up action; no “Updating” spinner | Sparse Atlas also offers the action without implying a finished journey |
| Active rebuild | A duplicate catch-up is possible while controller is busy | The action is visibly disabled; no additional transaction starts | Last committed journeys and media remain browsable |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/engine.ts` -- exact deterministic clustering; cache each candidate's minimax score once rather than recomputing it during sort.
- `apps/mobile/src/reconstruction/repository.ts` -- stream bounded link/disposition insert batches with at most 800 parameters and 256,000 value characters per statement, retaining the current transaction boundary and correction remap behavior.
- `apps/mobile/src/import-record/repository.ts` and `apps/mobile/src/import-record/types.ts` -- expose separate aggregate queued-change and unresolved-remap counts so owner actions match the actual pending work.
- `apps/mobile/src/reveal/types.ts` and `apps/mobile/src/reveal/projection.ts` -- distinguish a pending queue from active processing using only local aggregate state.
- `apps/mobile/src/components/atlas-reveal.tsx` -- expose catch-up for waiting changes and disable it during active work; retain map, Timeline and manual-entry behavior.
- `apps/mobile/scripts/benchmark-reconstruction.cjs` -- reproducible synthetic engine timing, with no private library access.
- `apps/mobile/src/components/__tests__/reconstruction-engine.test.ts`, `reconciliation-repository.test.ts`, and `atlas-reveal.test.tsx` -- protect graph semantics, batch limits/rollback and visible states.
- `docs/development/error-playbook.md` and `docs/project-state.md` -- record the device-reported responsiveness gap, scope, verification and outstanding physical measurements.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/mobile/src/reconstruction/engine.ts` and synthetic benchmark -- make dense-place minimax selection cheaper while preserving the deterministic graph and record comparable timings.
- [ ] `apps/mobile/src/reconstruction/repository.ts` -- batch link and disposition inserts below SQLite's conservative parameter limit; preserve atomic rollback and queued-change acknowledgement.
- [ ] Reveal projection, Atlas UI and focused tests -- separate waiting from running, keep the committed Atlas usable, and disable a duplicate catch-up tap while running.
- [ ] Focused and full checks -- confirm existing reconstruction, correction, lifecycle and privacy behavior remains intact.
- [ ] `docs/development/error-playbook.md` and `docs/project-state.md` -- record the observed cause, correction, automated evidence and required Android/iOS measurement run.

**Acceptance Criteria:**
- Given a dense synthetic place, when reconstruction runs before and after the change, then the same deterministic graph is produced with materially less engine time in repeated local measurements.
- Given a large derived graph, when it is committed, then its link and disposition rows use bounded batches and one failed batch rolls back the entire projection.
- Given only queued changes, when Atlas opens, then it displays the last committed state and an actionable catch-up control without claiming a rebuild is running.
- Given an active rebuild, when Atlas opens, then duplicate catch-up is disabled while the previous committed journeys remain browsable.

## Implementation Notes

- The original responsiveness draft proposed phase instrumentation only. The owner clarified that actual speed is the primary outcome; this revised scope includes algorithm and SQLite write improvements. More invasive snapshot transaction changes remain separately reviewable after device measurement.
- The first synthetic dense-place baseline for 2,000 records was 6,438 ms for the pure V1 engine; the initial minimax-score cache returned 688 ms on the same machine. These are single-run developer measurements, not device latency or a full Atlas benchmark.

## Spec Change Log

## Review Triage Log

| Finding | Verdict and evidence | Route |
|---|---|---|
| Blind 1 — accumulated `linkRows` | `medium`: every support row repeats a generated place ID in a full-graph array before the first link write, so memory can grow substantially for a dense library. | patch |
| Blind 2 — oversized single row | `medium`: the payload test only runs after a batch contains one row; a first row over 256,000 characters crosses the native bridge unchecked. | patch |
| Blind 3 — stale persisted running | `false`: the only reconciliation-state `running` write is inside the same SQLite transaction that later commits `complete` or rolls back, so a terminated process cannot commit that intermediate status. The live controller running state remains separate. | reject |
| Blind 4 — remap-only catch-up | `medium`: `pendingCount` adds maintenance queue and unresolved remaps; catch-up alone cannot resolve a remap requiring owner review. | patch |
| Blind 5 — failed queue recovery | `medium`: failed Atlas retry calls plain `rebuild`, which does not consume/acknowledge the maintenance queue. | patch |
| Blind 6 — competing rebuild action | `medium`: while queue changes wait, ready/sparse screens also expose full Rebuild/Recheck, which does not consume the queue. | patch |
| Blind 7 — full-device speed unmeasured | `medium`: current benchmark measures only the synthetic engine, not SQLite/UI/device latency. The lack of an attached device prevents a device claim. | defer device acceptance; do not claim full-device improvement |
| Blind 8 — missing project-state entry | `low`: the state file did not yet contain this implementation; the root task added a current entry with measured and open checks. | patch |
| Edge 1 — oversized single row | `medium`: same boundary as Blind 2; a single huge row bypasses the batch cap. | patch |
| Edge 2 — remap-only pending | `medium`: same aggregate-count/action mismatch as Blind 4. | patch |
| Edge 3 — sparse copy | `low`: a sparse screen without a durable record can claim that the last completed Atlas remains available. | patch |
| Edge 4 — invalid benchmark size | `low`: fractional or invalid input is silently normalized, so a reported evidence count may not match the requested run. | patch |
| Verification 1 — inserted tuples unasserted | `medium`: current mock tests count calls and arguments but never compare flattened link/disposition tuple values with the graph, leaving column-order regressions undetected. | patch |
| Verification other — oversized single row | `medium`: same single-row cap boundary as Blind 2 and Edge 1; the existing long-ID case remains below one-row overflow. | patch |

## Design Notes

Pending queue state must not use an in-progress spinner. A compact waiting panel offers catch-up, while an actual running state names the active local work and disables a redundant request.

## Verification

**Commands:**
- `node apps/mobile/scripts/benchmark-reconstruction.cjs 2000` -- expected: reproducible synthetic dense-place graph/timing; compare with the recorded baseline, not a universal device claim.
- `npm --prefix apps/mobile test -- --runInBand reconstruction-engine reconciliation-repository atlas-reveal` -- expected: graph, batching, rollback and state regressions pass.
- `npm --prefix apps/mobile run check` -- expected: mobile typecheck, lint and complete Jest suite pass.
- `npm run check` -- expected: repository foundation checks pass.

**Manual checks:**
- On Android and iOS, time a full rebuild and queued catch-up over comparable private library sizes using only aggregate durations/counts; confirm the last committed Atlas/media remain browseable and distinguish waiting from active updates.

**Implementation evidence (2026-10-19):**
- Three paired runs of the 2,000-record synthetic benchmark used baseline revision `36458951cb11ca8b384053400e15841b240dccf3` and the working-tree engine. Engine times were 6,454/686, 5,704/750, and 5,875/701 ms (baseline/current). The full graph SHA-256 was `5e639820d6484efba4f07dd7df2787b4ab065d9ed2e2cdbf724ea83c088aee84` in every run. These are local engine timings; country resolution, SQLite, UI and device work are outside that timer.
- Focused Jest: 3 suites, 113 tests passed. Full mobile Jest: 37 suites, 326 tests passed. Mobile TypeScript and lint passed.
- `npm --prefix apps/mobile run check` reached Jest (325 tests passed before the final additional Atlas test), then exposed a new TypeScript inference error that was corrected and verified with a separate passing typecheck. A separate `npm --prefix apps/mobile run doctor` stopped at registry DNS (`ENOTFOUND registry.npmjs.org`), so the combined mobile check is not recorded as passed.
- After independent review, affected suites passed 97 tests; a full approved-host rerun passed 37 suites / 332 tests. Mobile typecheck, lint and `git diff --check` passed. A next-day Doctor retry again stopped before diagnostics at registry DNS `ENOTFOUND`. Root `npm run check` passed. The review triage above records every finding; the incorrect stale-persisted-running claim was rejected after tracing its uncommitted SQLite transaction.
- The final writer streams bounded batches, tests every inserted link/disposition tuple against the returned graph, and rolls back when one row exceeds the bridge cap. Atlas now distinguishes queued work from unresolved correction review, with separate owner-facing actions.
- Physical Android/iOS timings and browse checks remain open. The current Android ADB inventory has no connected device; no iOS device is available in this environment.
