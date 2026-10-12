---
title: 'Maintain journey history from incremental updates'
type: 'feature'
created: '2026-10-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'd9cfa0f515052d98299e48ccdd2ad9fcce35dfe6'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m1-5-discover-library-changes-in-scheduled-background-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M1.5 records permitted library additions, changes and confirmed removals locally, but nothing consumes that queue. The owner can therefore see a completed local journey draft that no longer reflects the current permitted evidence, with no honest pending, restricted or update state.

**Approach:** Add a local-only reconciliation coordinator that consumes durable queue snapshots, preserves owner-owned history and corrections, and atomically publishes a deterministic `reconstruction-v1` result only after it reaches a consistent checkpoint. Use the full deterministic rebuild as the correctness fallback for each affected dependency neighborhood; keep incomplete work pending and expose foreground catch-up/rescan without publishing or invoking cloud AI.

## Boundaries & Constraints

**Always:** Reuse the existing private SQLite database, M1.5 maintenance lease/checkpoint and normalized opaque source references. Process only connected, currently permitted local evidence. Preserve correction overlays, stable lineage, inferred/confirmed/rejected/owner-entered history rows, exclusions, owner boundaries, manual records and their photo associations; additions to confirmed records must remain inferred. Keep the last committed graph readable while reconciliation is pending, fails or becomes restricted. Match a full `reconstructV1` result for identical final evidence, correction and rule revisions. Follow the Living Atlas design system for the Atlas/Settings states and make every state clear that no change is published or shared.

**Never:** Copy/upload media, paths, filenames, raw EXIF, precise coordinates, source IDs or traces; silently turn evidence into owner presence; delete owner history to make a rebuild fit; apply a partial graph as final; run automatic cloud AI or use a network/quota result as a requirement for local reconciliation; enable the AI proxy; change scheduler cadence promises; deploy, migrate Supabase or auto-publish/share.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Durable delta | Added, changed or two-scan deleted queue event while connected | Reconcile its affected dependency neighborhood through a revision-bound deterministic result; atomically acknowledge only the covered events and report new/updated counts | Later events remain queued for the next pass |
| Late historical photo | Older permitted evidence changes an earlier visit or grouping | Recompute the dependent history so the final graph equals a full reconstruction, with stable lineage/remapped overlays where unambiguous | Ambiguous owner-target remap remains pending; no owner decision is discarded |
| Expiry/access/lifecycle interruption | Background time expires, access is limited/revoked, disconnected or deletion begins | Preserve the prior committed graph and a durable pending/restricted checkpoint; lifecycle invalidation prevents late publication | Foreground catch-up is offered only when connected and permitted |
| Failure/retry | SQLite transaction or deterministic rebuild fails | Keep queue and prior complete graph intact, then permit an explicit local retry/rescan | Show an honest recoverable error; do not claim completion |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- schema v8, canonical revisions, private lifecycle, `inferred_history`, correction overlays and M1.5's transactional `maintenance_change_queue`; extend in-place rather than creating a second store.
- `apps/mobile/src/import-record/types.ts` and `apps/mobile/src/maintenance/{types,reconcile-runner,controller,task}.ts` -- durable maintenance producer, lease, pause/restriction semantics and foreground/headless entry points; do not make the headless task depend on React.
- `apps/mobile/src/reconstruction/{types,engine,repository,controller}.ts` -- deterministic `reconstructV1`, atomic projection replacement and lifecycle-safe in-memory publication; add the reconciliation boundary here, retaining the existing direct rebuild as an explicit local recovery action.
- `apps/mobile/src/history-record/types.ts` -- correction identity/lineage contract; retain its replacement validation and do not infer target IDs from paths or successor guesses.
- `apps/mobile/src/photo-access/provider.tsx` and `apps/mobile/src/components/mobile-screens.tsx` -- wire completed maintenance to local reconciliation and render compact Atlas/Settings status/actions using the official design system.
- `apps/mobile/src/components/__tests__/{maintenance-reconcile,reconstruction-controller,reconstruction-engine,photo-access-provider,owner-flow}.test.tsx` and `import-repository.test.ts` -- extend synthetic coverage without private fixtures.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/import-record/{repository,types}.ts` -- add an in-place schema migration and repository contract for a lease-protected reconciliation watermark/checkpoint, queue snapshot/acknowledgement and durable aggregate-safe result state; retain queue events on rollback, restriction or lifecycle change.
- [x] `apps/mobile/src/reconstruction/{repository,types,controller}.ts` -- introduce a local reconciliation coordinator that reads a revision-stable queue snapshot, applies effective evidence corrections, preserves protected owner history by checkpointing unmappable changes for review, and atomically replaces projections plus acknowledgement only after a complete result. Preserve the prior graph and pending state on interruption or failure.
- [x] `apps/mobile/src/maintenance/{controller,task}.ts` and `apps/mobile/src/photo-access/provider.tsx` -- hand completed foreground/headless maintenance to the coordinator without overlapping runs; lifecycle cleanup blocks late writes/publication. Keep all reconciliation local and independent of the disabled optional-AI path.
- [x] `apps/mobile/src/components/mobile-screens.tsx` and related state/types -- show last checked/updated, pending, restricted, recoverable error and new/updated inferred journey states; provide foreground catch-up and manual rescan/rebuild where safe, and state that changes remain private and unpublished.
- [x] `apps/mobile/src/components/__tests__/*` -- add sequence regressions for addition/change/two-pass deletion, late historical evidence, correction/boundary/lineage safety, durable resume, transaction failure, lifecycle race, no duplicate associations and incremental/final-full parity.
- [x] `docs/project-state.md` and this spec -- record actual verification and device limits after delivery; retain unknown update timing and reconstruction quality as unmeasured.

**Acceptance Criteria:**
- Given a queued permitted source change, when reconciliation completes, then the owner sees one consistent local graph matching full reconstruction from the same final evidence/rules/corrections, with the processed queue checkpointed and no duplicate journeys or associations.
- Given late historical evidence or a changed neighborhood, when it alters a derived grouping, then inferred lineage and unambiguous correction targets carry forward while confirmed, owner-entered and rejected history remains protected; unresolved remaps visibly remain pending.
- Given background interruption, access restriction, disconnect, deletion or transaction failure, when reconciliation cannot finish, then no partial output is presented as final, no event is falsely acknowledged, and the last consistent history remains available until a safe foreground retry.
- Given an update outcome, when the owner views Atlas or Settings, then last checked/updated and pending/restricted/new/updated state are understandable, a connected owner can catch up or rescan locally, and no change is shared/published or submitted to AI automatically.

## Design Notes

The queue is a durable invalidation signal, not proof that a partial graph is trustworthy. A bounded local full rebuild is permitted as the initial dependency-neighborhood convergence mechanism because its deterministic output is the parity oracle; optimize neighborhood-only computation only after parity remains explicit and tested.

## Implementation Notes

Planning baseline: `d9cfa0f` (`fix: resume reconstruction after reconnect`), following M2.5 at `e3266ab`. The lifecycle controller now invalidates late results; M2.6 must retain that barrier rather than bypass it through maintenance.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand maintenance-reconcile reconstruction-engine reconstruction-controller import-repository photo-access-provider owner-flow` -- expected: all affected local reconciliation sequences pass.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint and Expo Doctor all pass.
- `npm run check` -- expected: repository framework and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Actual (2026-10-12):** the focused reconciliation suite passed 6 suites / 22 tests; `npm --prefix apps/mobile run check` passed 22 suites / 159 tests, TypeScript, Expo lint, and Expo Doctor (21/21); `npm run check` passed its framework, test, and evaluation smoke checks; and `git diff --check` passed. This is synthetic/runtime evidence only. Physical SQLite migration and concurrency, iOS/Android lifecycle interruption, device source changes, OS scheduling, and reconstruction accuracy remain unverified.

## Review Triage Log

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Rescan action is unavailable while automatic maintenance is disabled. | medium | `MaintenanceController.catchUp()` returns before scanning when disabled, so the connected Atlas action does nothing. Rework required. |
| Two-pass deletion remains available canonical evidence. | high | The maintenance deletion queue event does not update `canonical_evidence`; the rebuild therefore retains the source. Rework required. |
| Reconciliation can acknowledge after permission is revoked. | high | The repository checks lifecycle but has no current access boundary before consuming the queue. Rework required. |
| Owner corrections, boundaries, and lineage are not applied/remapped. | high | The deterministic inputs only include evidence exclusion and inferred targets are only flagged unresolved. Rework required. |
| Counts, durable failures, and empty snapshots are misleading or unbounded. | medium | Every graph journey is counted new, failures are in-memory only, and empty reconciliations retain snapshot rows. Rework required. |
| Foreground handoff and paused-task guard lack direct regression coverage. | medium | The maintenance-controller and task tests do not prove the completed callback or paused non-invocation. Add coverage during rework. |

