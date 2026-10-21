---
title: 'Reduce repeated destination-label computation'
type: 'refactor'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent">

## Intent

Reduce repeated work in the destination-label computation measured at 10.422 s
in the accepted Android profile. Preserve exact labels, abstentions, duplicate
family eligibility/conflicts, geometry and accuracy margins, SQL and transaction
behavior, corrections, diagnostics and UI. Preserve the authorized dirty tree.
No schema/index/dataset changes, geometry approximation, private-coordinate cache,
dependency, commit, push, reset or reinstall. Compare baseline/candidate using
public synthetic evidence and record the limits of host performance evidence.

</frozen-after-approval>

## Implementation Notes

- Intent gaps: none. Irreversibles: none. Footprint is the existing geometry
  resolver and destination-support grouping, focused tests and a standalone
  synthetic comparison harness, plus this record/project state/error lessons.
  Small behavior-preserving change uses the Build oneshot route.
- Reuse research (`search-first`): existing country resolver, destination-label
  aggregation, TypeScript transpile loader in the reconstruction benchmark and
  synthetic real-SQLite adapter. No new utility dependency or remote service is
  needed; package-registry/MCP/GitHub searches are inapplicable to removing
  repeated work in these existing loops. Read-only investigation agent confirms
  repeated edge cosine calculations and quadratic per-journey array copying.
- Code map: `apps/mobile/src/reconstruction/country-resolver.ts` owns fixed
  geometry, bounded public-ring cache and all border/overlap/accuracy decisions;
  `repository.ts:readDestinationLabels` owns unchanged support SQL and ordered
  grouping; `destination-label.ts` owns the two-independent-family aggregation
  and stays unchanged. Duplicate-family resolver also stays unchanged.
- Plan: test a bound on repeated cosine calls with existing public destination
  results before changing source; hoist point-invariant math within `contains`
  without changing arithmetic expressions, iteration or distance tests; replace
  per-row array spread in destination grouping with append to its local array.
- Acceptance: given public points including borders, antimeridian, poles,
  offshore, invalid values and accuracy variants, candidate resolver outputs
  must equal the isolated pre-change resolver. Given independent/duplicate/
  conflicting families and row permutations, label outputs must match baseline.
  Given existing durable SQLite and correction tests, SQL/results/error stages
  remain unchanged. The invariant-work regression must fail before and pass
  after the math hoist; no timing assertion is used as a correctness gate.
- Evaluation plan: deterministic synthetic CPU comparison, with full baseline
  Git revision, separate isolated module/cache instances, output equality and
  aggregate timing samples. No private evidence, model calls or human labels;
  reconstruction/product accuracy remains unmeasured. Read `evals/README.md`.
- Verification: focused Jest and resolver coverage, full mobile Jest, real
  SQLite integration tests, mobile typecheck/lint, root `npm run check`, task
  diff inspection and blind Build review. Native build/Doctor dependency refresh
  is inapplicable to this dependency-free TypeScript optimization; a fresh owner
  click-and-wait recheck with existing fixed profile stages is required before
  claiming an Android improvement over the earlier sample.
- Repository policy overrides upstream commit/checkpoint defaults: no staging,
  commit or push; retain RED/GREEN evidence here instead.
- Implemented: one latitude scale/margin calculation per tested area, retaining
  every original expression and edge/ring traversal; per-journey grouping now
  appends to local arrays. Geometry dataset, cache bound, family validation,
  SQL, transactions, correction mapping and diagnostics are unchanged.
- TDD: focused destination suite executed 6 tests before source edits: 5 passed,
  the invariant-work regression failed at 4,758 cosine calls versus a 291-area
  upper bound. After hoisting all 6 passed; focused combined coverage is 93.91%
  statements, 89.15% branches, 100% functions and 96.38% lines. The sole cache
  setup failure is separately recorded in the error playbook and is not RED.
- Software checks: full mobile Jest 39 suites / 385 tests, real SQLite 51,
  mobile typecheck/lint, root check (20 tests plus eval smoke), and diff check
  passed. After review, a new repository test additionally passed in its full
  50-test suite: 512 interleaved support rows retain independent ordered arrays
  and exact Bali/Paris labels. Typecheck/lint passed again after that test.
- Comparison command: `node apps/mobile/scripts/benchmark-destination-labels.cjs
  --revision cd889c98946b067cefd8af303a36b09d8fdeedd7`. Final harness requires the
  explicit baseline and compares isolated resolver/aggregator modules against
  the same public dataset. All 499 coordinate and 45 label cases match across
  three cold/warm rounds. Covered country outcomes: 66 resolved, 162 border,
  146 invalid, 125 unresolved; regions 57 known / 9 unknown. Includes 32
  later-ring and 36 region-boundary samples, with 8 verified 250 m transitions
  and 7 verified accuracy-expanded 1,250 m transitions. This preserves current
  contracts, not proof of global geographic truth or reconstruction accuracy.
- Reproducibility: Node v24.21.0 / V8 13.6.233.17-node.53 / Windows x64.
  Candidate resolver SHA256
  `592bfdc60dafaf526d4c46744cba99ede7bfaaea3b8408aa0ffda11e3b06cc4e`;
  unchanged aggregator SHA256
  `9582685400a1608fef4c41a72c3584f6c04bdf7b4029d19ce71f75fd30ea7869`;
  dataset SHA256 `b06df66c4496e5a24faf20ae2c966531be0f1f8e039f5f1288acab0e4cd4e4f2`;
  output SHA256 `b47b2e2957f4e5b764608479268d09c14c660b758d538bea9b8f30fcdf10933f`;
  harness SHA256 `e632c854cadf9ed4dab74276d9a78bb3d5fc8aa22c8ef8a853ef0f236a8c6266`.
- Final host cold baseline/candidate ms: 384.770/340.221, 393.854/391.383,
  403.301/378.878; warm: 345.354/340.707, 345.462/409.166,
  379.323/381.591. These noisy, concurrent-host samples do not demonstrate
  reliable speed improvement. They exclude repository grouping, native/Hermes
  execution, SQL, bundling and UI paint. Do not extrapolate to the 10.422 s
  Android computation sample.
- Native preparation: restored ADB using host execution; replaced only the
  verified project Metro process on 8085 with profiling enabled, verified the
  served resolver contains the math-hoist code and the helper is served,
  restored USB reverse and reopened the installed app through its development
  URL. No native rebuild/install or database inspection/reset. Owner-operated
  recheck and fresh fixed profile timings are pending; do not call this measured
  Android optimization complete until that evidence is available.

## Review Triage Log

- Self-comparison could mislead (medium, patch): harness now requires a full
  baseline revision; no default `parity: true` self-check mode remains.
- Missing geometry boundary slices (medium, patch): expanded public cases and
  asserted actual country outcomes, regions, later rings and border transitions.
- Repository grouping untested by resolver benchmark (medium, patch): added
  real public repository-path test with 512 interleaved rows, exact label
  expectations, independent arrays and complete encounter order. No claim of
  repository scaling measurement is made from the resolver benchmark.
- Dirty candidate identity absent (medium, patch): emits compared source,
  dataset and harness hashes plus runtime/platform/architecture.
- Blind follow-up inspected all four fixes and reported no remaining blockers.
  Reviewer verification is source inspection; parent ran the applicable checks.

## Owner-operated Android result

The owner confirmed `Completed; labels look unchanged`. The fresh app process
contains a separate startup durable read and the owner-operated retry; exclude
startup from the retry interval. Fixed events pair parent retry
`runtime-mvhtcdy6-2`, rebuild `runtime-mvhtcdyw-4`, and subsequent durable read
`runtime-mvhtdd9s-5`. Every phase completes in order; the parent terminal event is
COMPLETE. No raw log, private coordinate or evidence record was saved.

| Interval | Seconds |
| --- | ---: |
| Owner retry START to COMPLETE | 53.420 |
| Rebuild OPEN start to COMMIT complete | 45.749 |
| Rebuild processing | 33.695 |
| Rebuild persistence | 11.566 |
| Durable read OPEN to final PROJECTION complete | 7.642 |
| Destination support query | 0.867 |
| Destination computation | 6.624 |

Destination computation is 3.798 s lower than the earlier 10.422 s Android
sample. This is an observed single-run difference, not a controlled attribution
or representative latency claim. Rebuild phases also differ despite no changes
to their rules/writes; device conditions/cache/scheduling are uncontrolled.
Startup destination computation was separately 6.577 s, not a second owner
recheck. Source/contract parity, unchanged owner-visible labels and completion
are established to the limits documented above; global accuracy is unmeasured.

Temporary profiling was disabled by replacing only the verified profiling Metro
process with the same development server using flag `0`. No commit/push,
reinstall, storage reset, schema update or unrelated source change.
