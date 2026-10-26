---
title: 'Implement Replay edit save integrity and responsive lean flow'
type: 'bugfix'
created: '2026-10-26'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '790a1fda7695ecd917a890d18d742aa11edd5313'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-replay-edit-save-and-responsiveness/SPEC.md'
---

<frozen-after-approval reason="Owner requested implementation of the detailed spec on 2026-10-26">

## Intent

**Problem:** Normal consecutive trip edits, exclusion and soundtrack selection leave Replay saving awkwardly and Update disabled. Media loads delay recognition and inconsistent Back paths obstruct navigation.

**Approach:** Implement the owner-approved canonical Replay edit integrity/responsiveness contract and every companion in `_bmad-output/specs/spec-replay-edit-save-and-responsiveness/`. Deliver S0-S6 source changes and required host checks; perform S7 evidence collection within available device/owner access, keeping missing physical acceptance explicitly open.

## Boundaries & Constraints

**Always:** Canonical ten capabilities and thirty acceptance cases govern. Preserve existing dirty work and first snapshot it. Keep serialized native ownership, idempotent receipts and exact complete-snapshot readback before rendering. Preserve privacy, full eligible candidate scope, explicit media edits, existing chapter quality/timing, soundtrack and separate sharing. UI stays Living Atlas, lean, recognizable and accessible.

**Never:** Reset/stage/commit/push, clear app storage, overwrite unrelated dirty work, use retired worktrees, upload private evidence, claim native timeout cancellation or native acceptance from host tests. Do not narrow the approved scope to one partial slice merely because implementation is substantial.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Required output | Recovery |
| --- | --- | --- | --- |
| Consecutive edits | Exclude A then edit B | One exact retained composition and update | Retain intent on failed save |
| Held writer | Native save remains unresolved | Reachable navigation, truthful waiting, bounded pending snapshot | Reconcile outcome before retry |
| Pending update | Autosave and selected tasks running | One accepted request, verified immutable render input | No silent omission |
| Album/audio | Slow tile or SQL held during file import | Ready tiles/file state independent from draft write | Scoped retries and settings Back cancel |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/replay-screen.tsx` — current scattered working refs/queue, settings, gallery and Update; preserve player/finalization safeguards.
- `apps/mobile/src/photo-access/provider.tsx` — broad idle waits, native preflight, preview hydration and render/readback boundary.
- `apps/mobile/src/reconstruction/repository.ts` — native token mapping and draft CAS; extend with session ownership/receipts.
- `apps/mobile/src/import-record/repository.ts` — schema36 and all schema gates; additive migration only.
- `apps/mobile/src/database/native-transaction.ts` — existing process gate; evolve ownership without parallel writers.
- `apps/mobile/src/photo-access/native-adapter.ts` — six-lane page resolver; incremental visible-first support.
- `apps/mobile/src/replay/{types,controller,renderer}.ts` — reuse composition/cache/renderer contracts.
- `apps/mobile/src/components/__tests__/`, `apps/mobile/scripts/atlas-sqlite.test.cjs` — current behavior/regression harness.

## Tasks & Acceptance

- [x] S0 baseline/writer inventory and regression tracing boundaries.
- [x] S1 transaction ownership, schema v37 receipt/reconciliation contract and native write checks.
- [x] S2 provider-owned edit session, bounded latest-snapshot scheduler and task boundaries.
- [x] S3 aggregate Update barrier, recovery/Restore paths and immediate Back/Done navigation.
- [x] S4 incremental visible-page preview resolution, bounded six-lane thumbnails and poster cache.
- [x] S5 validated immutable local-audio subdraft with Done/Back semantics.
- [x] S6 lean trip overview/grid, selection and recovery affordances.
- [~] S7 host checks complete; Android/iOS owner acceptance and measured cold-path/lock-holder evidence remain open.

Given A is excluded, when B is edited and Update accepted, then the durable/read-back/rendered composition retains A's exclusion and B's exact choices. Given an unresolved native writer, when recovery threshold is reached, then UI remains navigable and no duplicate mutation or false success occurs. Given a slow tile or local audio copy, when faster media/file work finishes, then readiness is exposed independently from unrelated save work. All remaining AC-01–AC-30 are canonical acceptance, not optional examples.

## Implementation Notes

- User's current `implement` instruction supplies approval of the already reviewed detailed spec; no new product choice remains. Existing dirty files are authorized continuation context and must be preserved. Git status works outside sandbox; sandbox-only status error does not mean Git is unavailable.
- Full approved detail remains in canonical companions; this short dispatch record is the BMAD build execution/status adapter, not a competing product plan. Planning-only non-goals are superseded by the current implementation instruction; version-control publication remains unauthorized.

## Spec Change Log

### Owner escalation 2026-10-26

Resume the existing authorized dirty implementation. Owner still cannot save custom music or consecutive edits; completion requires exact working save, committed readback, new render and owner-visible playback. Previous recovery-receipt diagnosis was unsupported: device recovery still fails after reset with a fresh receipt ID. Investigate actual repository guards with meaningful repository regressions, not provider mocks alone. In particular audit every emitted manifest group against the writer's opaque group map: visible owner-entered journeys are emitted without reconstructed rows, while the map is populated only after a reconstructed-row check. Preserve all visible journeys and allow their scene-only selections/exclusions to round-trip. Do not claim this hypothesis confirmed until reproduced. Root handles device evidence and acceptance; delegate implements and verifies the scoped persistence correction and reports limitations. No version-control publication or data clearing is authorized.

## Review Triage Log

### Escalation review findings, individual triage

| Finding | Verdict and evidence | Action |
| --- | --- | --- |
| Blind 1 revision adoption | high: stage replaces caller CAS with any durable revision before writing, allowing a competing branch to be replaced. | Preserve caller revision; hydrate only missing mapping. |
| Blind 2 generic reset recovery | high: any fixed stale guard enters reset, including mapping/receipt/revision failures; same scope alone does not establish branch ownership. | Remove generic reset/retry; retain explicit Keep recovery. |
| Blind 3 pending audio deletion | high: settings Back can delete candidate already passed to a pending working save. | Fence/disable conflicting sheet actions and transfer candidate ownership before enqueue. |
| Blind 4 mutable settings acknowledgement | high: refs reread after await can differ from the saved values. | Capture exact settings and guard concurrent sheet mutation. |
| Blind 5 selected task restore epoch | high: toggle/select-all native completions can enqueue after Restore. | Check task epoch after waits and before mutation. |
| Blind 6 Check again receipt reconciliation | medium: Check again only reads scheduler memory; repository reconciliation is unused. | Wire bounded receipt readback without replaying unresolved writes. |
| Blind 7 thumbnail privacy invalidation | high: global decoded cache has no invalidation caller. | Invalidate at privacy/lifecycle boundary and clear mounted handles. |
| Blind 8 thumbnail pin count | medium: one unmount resets pins while another consumer is visible. | Reference count pins and test overlapping consumers. |
| Blind 9 unbounded active receipts | medium: active provider session is exempt from pruning and grows with each staged composition. | Bound settled receipts and preserve current revision receipt. |
| Blind 10 decoder-before-readiness | false under later owner direction: local copied-file readiness was explicitly separated from slow native metadata/decode. Renderer verifies final audio; reinstating metadata wait contradicts accepted responsiveness correction. | Retain local readiness and final output verification. |
| Blind 11 repeated full hydration | medium: each noninitial working write rebuilds full manifest and per-trip media reads. | Hydrate only a missing opaque map; retain native scope/CAS checks. |
| Blind 12 scope initialize effect | high: changed scope with pending work throws from uncaught React effect. | Show recoverable scope transition and fence prior tasks. |
| Verification 1 thumbnail coverage | medium: screen mock bypasses lane/eviction/pin behavior entirely. | Add injected-decoder service tests. |
| Verification 2 receipt coverage | medium: real SQLite stage tests omit mutation identity, bypassing receipt branch. | Add real idempotency/conflict/retention/readback cases. |

Independent edge-case review could not complete after capacity and account-limit failures; no clean edge-review pass is claimed. Root continues direct path review and all actionable returned findings within the authorized scope.

All actionable rows above have now been implemented and regression checked. The decoder-readiness finding remains rejected under the later owner direction. Adaptive direct review also reproduced and fixed thumbnail promise-delivery eviction before pinning and eager native-video provider bootstrap. Final verification: 46 Jest suites / 526 tests, 93 real SQLite tests, TypeScript/lint, root check and whitespace pass; Expo Doctor 21/21 on the unchanged dependency set. Device runtime was reloaded once source stabilized; existing Atlas and Replay route are accessible. Keep status in progress until the owner completes custom audio Done, consecutive edits, Update and new-video playback on Android. The device denied ADB touch injection; no synthetic or initial-playback evidence substitutes for this acceptance.

### 2026-10-26 persistence escalation verification

Actual SQLite RED/GREEN confirmed an emitted manual scene without a writer-map identity. Corrected all visible scene registrations and retained exact inclusion, custom soundtrack, order and media through stage, repository recreation, commit and readback. Closed guard diagnostics distinguish scope, mapping, memory, group, automatic scope, receipt, revision and branch without raw data.

Current checks: 45/45 mobile Jest suites, 515/515 tests; 91/91 SQLite tests; mobile TypeScript/lint; Expo Doctor 21/21 after approved network retry; root check. Android initial Atlas/Replay playback verified by screenshot. Device rejected ADB touch injection; owner Done/Update result is pending. Three independent build reviews were dispatched; one capacity failure was retried. This record remains in progress until remaining review fixes and owner acceptance are resolved.

## Verification

### Owner acceptance and consolidation boundary (2026-10-26)

Owner confirmed the actual Android edit/media/exclude/custom-audio Done/Update/new-video flow. The reported normal-path incident is accepted. Canonical S7/G5 and the larger thirty-AC contract are not all complete: the release consolidation review records remaining retained-Auto/overview UX and native fault-recovery gaps explicitly. Preserve `in-progress` for that broader record rather than claiming iOS, timing or every recovery criterion passed. Accepted implementation and bounded reviewed regressions are committed together; obsolete worktrees are tagged and physically retired. See `review-replay-release-consolidation-2026-10-26.md`.

Run meaningful new RED/GREEN regression tests plus affected existing native transaction/provider/screen/adapter/renderer/selection/controller, SQLite, typecheck/lint and root check from correct package roots. Record initial failures and corrections in error-playbook. Native evidence remains owner-operated Android/iOS; never infer it from mocks.

### 2026-10-26 implementation evidence

- `apps/mobile`: `npm run check` passed: 45 Jest suites / 507 tests, 90 SQLite contract tests, TypeScript, lint and Expo Doctor.
- Repository root: `npm run check` passed (framework integrity, 20 foundation tests, eval smoke).
- Replay-specific regression coverage includes bounded coalescing, timeout/public outcome separation, session Update barrier, immediate gallery Done/Back, incremental preview batches, audio validation/subdraft cancellation, receipts and schema v37 migration fixtures.
- Not established: owner-operated Android/iOS save latency, real native lock-holder attribution, real photo/video thumbnail timing, audio import timing or final visual device acceptance. These remain explicit S7 follow-up evidence, not a release claim.

### 2026-10-26 owner-feedback follow-up

- Custom audio now reports readiness after its bounded private copy verifies; decode remains a renderer outcome rather than blocking selection.
- Music/order Done stays in the sheet until its exact working draft acknowledges. A save failure remains there with explicit retry; only then does the trip overview expose Update Replay.
- Replay foreground saves use the existing owned native writer turn directly rather than waiting for unrelated import/maintenance lifecycle completion.
- Verification: Replay screen/provider regressions 95/95, complete mobile Jest via repository-local cache, 90 SQLite contracts, TypeScript, lint, Expo Doctor 21/21, root check and whitespace check pass. The default sandbox Jest cache hit a host `EPERM` transform-cache boundary before tests; this was rerun with the repository-local cache. Device latency, actual output playback and the reported Update Replay return path remain owner validation work.
