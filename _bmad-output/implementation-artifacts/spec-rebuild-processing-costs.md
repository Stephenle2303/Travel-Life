---
title: 'Locate and reduce rebuild processing cost'
type: 'refactor'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent">

## Intent

Separate the rebuild-processing interval measured at 33.695 s, identify its
dominant work on the owner's Android recheck, and reduce demonstrably repeated
work if exact output and correction safety can be preserved. Preserve current
graph/qualification rules, corrections, geometry, SQL/transaction ownership,
privacy diagnostics and UI. Keep all existing dirty-worktree changes. No schema,
dependency, dataset, commit, push, install or private-history reset. Require
software parity/review and owner-operated completion evidence before reporting
a device improvement; unresolved product decisions require owner input.

</frozen-after-approval>

## Implementation Notes

- No intent gap or irreversible operation. Initial footprint is existing
  `atlas-phase-profile.ts`, rebuild stage transitions in `repository.ts` and
  synthetic integration assertions. Uses Build oneshot; any optimization beyond
  small output-preserving reuse requires replanning under the same record.
- Reuse/search-first: existing opt-in six-field fixed diagnostic boundary,
  sequential phase helper, real-SQLite enabled/disabled parity fixture and
  reconstruction benchmark. No new utility/dependency or remote research needed.
- Code map: rebuild calls baseline and constrained `reconstructV1`, intermediate
  correction mappers, memory overlay/candidate SQL, owner merges, canonical V1.1
  continuity, membership overlay and final correction mapper. Separate those
  fixed phases without passing records/counts/IDs/errors into the profiler.
  Existing PROCESSING becomes structural preparation; detailed phases plus that
  interval sum to former PROCESSING. Qualification remains interleaved with
  persistence and is not falsely labelled a standalone phase.
- Acceptance: given identical synthetic SQLite inputs, profiling off/on must
  preserve all SQL calls/parameters, results, queue acknowledgement, rollback,
  caller-owned transactions and error identity. Given enabled profiling, each
  successful processing stage completes in fixed order; an interrupted stage
  ends UNKNOWN. Production/not-opted-in remain silent. Native recheck must finish
  and provide paired fixed events before interpreting sub-costs.
- Checks: real SQLite, focused profile/repository tests, mobile typecheck/lint,
  root check, full mobile Jest, diff/security inspection and Build blind review.
  Preserve no-commit policy over upstream checkpoint/commit defaults. Product
  accuracy remains unmeasured; evals README contract applies if optimizing engine
  execution. Prior 499-point geometry parity remains separate evidence.
- RED: new real-SQLite sequence assertion failed because detailed processing
  phases were absent (50 passed / 1 expected failure). GREEN after nine fixed
  transitions and closed stage names: all 51 tests passed. Review additions
  bring SQLite to 52 passing tests, including a populated memory overlay whose
  candidate UPDATE fails: error identity, rollback, unchanged revision/run,
  silent disabled profiling and interrupted-stage UNKNOWN are preserved.
- Full mobile Jest 39 suites / 386 tests, typecheck/lint, root check and diff /
  Node script syntax checks pass. No algorithm optimization has been applied yet.
- Interpretation: PROCESSING now covers structural preparation only; sum it with
  the nine detailed intervals for the new total. MEMORY_OVERLAY includes awaited
  candidate SQL plus matching/validation and is mixed wall time, not pure CPU.
  Additional fixed diagnostic emissions have overhead. Do not expect a new run's
  sum to exactly match the previous 33.695 s or treat it as a speed comparison.
- Owner confirmed the instrumented run completed and journeys look unchanged.
  Paired fixed events: parent retry 54.068 s; rebuild 46.375 s; durable read
  7.663 s. Detailed baseline graph 16.772 s, constrained graph 16.832 s,
  continuity 0.275 s, baseline mapping 0.025 s, final mapping 0.028 s,
  persistence 11.318 s. Graph passes dominate this single run; no private
  evidence/count was exported. Captured with an ignored local safe parser.
- Bounded optimization: compute rejection constraints at the exact original
  position, then reuse baselineGraph only if their array is empty. Nonempty
  constraints still reconstruct. Intervening baseline mapping reads graph
  without mutation; do not reuse mapping results or alter graph IDs. No input
  rules, SQL calls or correction/failure ordering changes. Call-count regression
  failed at two calls when one was expected before the change, then passed.
  Nonempty rejection branch retains two calls and exact constraint payload.
- Optimization verification: 63 real-SQLite tests pass. Eleven isolated
  reference/candidate slices compile the current repository with only the reuse
  branch restored to always-two-pass for reference (exact replacement asserted).
  Compare returned graph, every rebuild/durable-read SQL call+parameter, durable
  reveal, persisted graph and correction applications, engine-call counts,
  error fields/injected identity and rollback. Successful slices: no correction,
  confirm, place, claim, memory assignment, reject, remove-visit and split.
  Malformed rejection and injected memory-write error preserve failure order.
  The separated-visit merge fixture fails closed in both versions; no successful
  merge acceptance is claimed. Existing structural unit checks remain separate.
- Full mobile Jest after reuse: 39 suites / 387 tests pass; typecheck and lint
  pass. Source review and follow-up inspection found no remaining blocker.
  Repository SHA256 `00a7445b52d66ee51cfa61bc9b151e2617b1642d510115e22b72ae901cde9d25`.
  Initial root check remains applicable; later changes are repository source/
  mobile tests, with root check to be repeated at final documentation closure.
- The verified Metro bundle contains the reuse branch; fresh app process opened
  for the final owner click-and-wait measurement. Profiling remains temporarily
  enabled until that capture completes. No install/reset or native build needed
  for this dependency-free JS execution reuse.

## Review Triage Log

- START pairing unverified (medium, patched): integration now asserts the full
  alternating START/COMPLETE sequence through entry to persistence.
- Processing interruption untested (medium, patched): populated-memory injected
  SQL failure proves UNKNOWN active stage, no later phases, rollback and original
  error identity, with identical enabled/disabled SQL calls.
- Mixed wall-time/observer overhead unclear (low, patched): interpretation above
  explicitly distinguishes memory SQL, phase wall times and emission overhead.
- Follow-up blind inspection confirmed all three addressed, no remaining profile
  blockers. The parent ran 52 SQLite tests; reviewer did not independently rerun.
- Reuse review: source-level equivalence and read-only mapper confirmed; required
  real-SQLite parity added above. Blind follow-up found no remaining blocker,
  retaining the successful-merge coverage limitation. Parent ran all 63 tests.

## Final owner-operated Android acceptance

Owner confirmed `Completed; journeys and labels unchanged`. Fresh fixed events
pair retry `runtime-mvhyat8v-2`, rebuild `runtime-mvhyat9q-4` and subsequent
durable read `runtime-mvhybfe7-5`. Every emitted phase is paired and completes;
startup durable read is a separate correlation and excluded from the retry.

| Interval | Before reuse, seconds | After reuse, seconds |
| --- | ---: | ---: |
| Owner retry | 54.068 | 35.890 |
| Rebuild | 46.375 | 28.671 |
| Baseline graph | 16.772 | 16.928 |
| Constrained graph phase | 16.832 | 0.001 |
| Canonical continuity | 0.275 | 0.286 |
| Persistence | 11.318 | 10.861 |
| Durable read | 7.663 | 7.186 |

Observed retry reduction: 18.178 s (about 34%) in this before/after pair. The
constrained phase collapse matches the source change and call-count checks;
other phases vary with uncontrolled device scheduling/cache/thermal conditions.
This is not a representative latency distribution, iOS result or reconstruction
accuracy claim. No private evidence or raw log was saved. Root check and diff
checks passed again after implementation documentation, with full mobile 387
tests and SQLite 63 as above. Temporary profiling disabled after capture through
the verified Metro process; normal app reopened without data reset or reinstall.
No staging, commit or push. Scope complete; later optimization should separately
measure the remaining baseline-graph/persistence work before changing it.
