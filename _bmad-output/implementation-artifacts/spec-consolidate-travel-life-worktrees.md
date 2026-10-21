---
title: 'Consolidate Travel Life worktrees into one verified delivery'
type: 'chore'
created: '2026-10-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/planning-artifacts/worktree-cleanup-plan-2026-10-21.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Travel Life has five registered worktrees. Main contains the current mixed recovery implementation and delivery records, while three patch-distinct commits remain outside main history. The project cannot safely deliver or retire these worktrees until all current code is reconciled into one known state and verified as a whole.

**Approach:** Preserve every current ref and the complete main working tree, construct one `codex/worktree-consolidation-2026-10-21` candidate from local main, reconcile the unique worktree changes against the candidate without overwriting current accepted behavior, then verify and commit the complete consolidated result as one delivery. Publish, deletion, and managed-worktree retirement remain explicit final actions after the concrete result is available.

## Boundaries & Constraints

**Always:** Retain local main commits `7e4dea6` and `3645895`; preserve current schema-v33 compatibility, private evidence, owner corrections, last committed Atlas/media, closed diagnostics, and owner-approved Atlas load/recheck behavior. Make named preservation refs for every non-ancestor/detached source before reconciliation. Reconcile shared controller, repository, Atlas UI, test, spec, state and error-playbook changes as one coupled candidate. Attribute every unique commit and uncommitted file in a ledger. Run checks from the same candidate tree and tie results to its final SHA.

**Never:** Do not reset, clean, force-push, reinstall, clear app data, delete private data, copy private evidence, or silently replace current files with older worktree versions. Do not treat a clean worktree as integration evidence. Do not resume paused performance optimization or claim device performance. Do not upload diagnostics or private data. Do not publish or retire a worktree until the final result and exact targets are shown to the owner.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Main capture | Modified tracked and approved untracked source, tests, scripts, specs and records | A recoverable checkpoint records the full candidate before branch work | Abort reconciliation if capture cannot be validated; retain source tree untouched |
| Detached responsiveness worktree | `e904e4f` has no named branch | A named preservation ref anchors its two unique commits | Do not retire its checkout until ref and ignored-file audit are confirmed |
| Unique history overlaps current WIP | `aac320e` or `f4699c4` touches Atlas/reconstruction files | Each behavior is compared with current candidate and marked integrated, equivalent, superseded, or deferred | Never blanket cherry-pick, use ours/theirs, or silently drop a behavior |
| Generated/private local data | Jest cache, ignored databases, evidence or credentials | Generated cache is excluded from delivery; needed local-only material remains locally recoverable | Stop before adding a questionable artifact and record its disposition |
| Combined verification failure | Test, typecheck, lint, SQL harness, build, whitespace or review identifies a defect | Repair within the one candidate and rerun affected checks before final verification | Record agent-caused failure in error playbook; unresolved limitations remain explicit |
| Owner device acceptance unavailable | No connected/authorized device or owner has not tapped the final bundle | Software result remains a verified candidate with device checks pending | Do not claim device acceptance or publish as accepted product behavior |

</frozen-after-approval>

## Code Map

- `git worktree list --porcelain`, `git log main..REF`, `git cherry`, and registered worktree status -- source-of-truth inventory; re-read immediately before mutations and retirement.
- `main` at `3645895` -- integration baseline; `7e4dea6` and `3645895` are retained local commits.
- `aac320e` (`codex/dimensional-atlas-polish`) -- one unique dimensional-Atlas/UI commit; compare its Atlas-reveal behavior and decision/spec records to the current candidate.
- `f4699c4` and detached `e904e4f` -- responsiveness changes and later evidence record; anchor the detached history and reconcile only behavior consistent with the performance pause.
- `apps/mobile/src/reconstruction/{controller,engine,repository}.ts` -- coupled lifecycle, deterministic graph, schema and projection behavior; do not overwrite current recovery logic.
- `apps/mobile/src/photo-access/{controller,provider}.tsx`, `apps/mobile/src/import-record/{coordinator,repository,types}.ts`, `apps/mobile/src/maintenance/{controller,task}.ts` -- shared import/reconciliation and diagnostic paths.
- `apps/mobile/src/components/{atlas-reveal,journey-edit,mobile-screens}.tsx`, `src/reveal/{projection,types}.ts`, and their tests -- owner-visible Atlas recovery, queue/review states and regression coverage.
- `apps/mobile/src/diagnostics/app-diagnostics.ts` and `apps/mobile/eslint.config.cjs` -- required sole production console boundary.
- `apps/mobile/scripts/atlas-sqlite.test.cjs` and `apps/mobile/scripts/` -- retained-schema real SQLite contract harness; package scripts must reference it correctly.
- `_bmad-output/implementation-artifacts/spec-*.md`, `docs/project-state.md`, and `docs/development/error-playbook.md` -- authoritative delivery history and incident learning; reconcile to final behavior without erasing historical facts.
- `_bmad-output/planning-artifacts/worktree-cleanup-plan-2026-10-21.md` -- single-delivery disposition ledger and execution constraints.

## Tasks & Acceptance

**Execution:**
- [x] Git inventory and preservation refs -- refresh every checkout/ref/status, identify ownership and ignored-file risks, create recoverable named refs/checkpoint, and verify the original state remains reproducible.
- [x] Integration candidate -- create `codex/worktree-consolidation-2026-10-21` from local main, transfer the captured complete candidate, and produce a source-to-result disposition ledger for all main WIP and unique commits.
- [x] Behavior reconciliation -- compare `aac320e`, `f4699c4`, and `e904e4f` to current source/spec decisions; retain missing accepted behavior without regressing current schema, correction, recovery, diagnostics, or performance-pause constraints.
- [x] Delivery artifacts -- reconcile source, tests, scripts, package configuration, specs, project state and error lessons into one accurate final state; exclude cache/private/local-only artifacts and add only narrow ignore handling if needed.
- [x] Verification and review -- run root checks, complete mobile Jest, real SQLite tests, typecheck, lint, Doctor, whitespace and a combined diff review. Repair all actionable findings in the candidate and record evidence/limitations.
- [x] Candidate completion -- create one final consolidation commit only after checks pass and present its SHA, disposition ledger, review, device evidence status and exact retirement targets for final owner authorization.

**Acceptance Criteria:**
- Given the registered worktrees and dirty main, when consolidation begins, then each source state has a verified recovery path before a candidate mutation occurs.
- Given the final candidate, when compared with each unique source commit and current WIP, then every behavior and artifact has an explicit integrated, equivalent, superseded, deferred, generated or local-only disposition.
- Given the assembled app, when complete software checks run from one checkout, then the resulting records identify one exact branch/tree/SHA and all required automated checks pass or have an evidenced external blocker.
- Given retained private history, corrections, incomplete recovery states and diagnostic failures, when their existing regressions run, then the candidate preserves the applicable privacy, schema, recovery and correction contracts.
- Given the candidate is ready, when a final commit is created, then it is one consolidation commit with no generated cache or private evidence and no unreconciled duplicate WIP remains.

## Implementation Notes

### Consolidation inventory and disposition (2026-10-21)

| Source | Disposition | Evidence / final location |
| --- | --- | --- |
| Local `main` at `3645895` | integrated baseline | Candidate starts at `36458951cb11ca8b384053400e15841b240dccf3`; the retained manual-journey and private-record recovery commits remain ancestors. |
| Main tracked WIP and approved untracked source/tests/scripts/specs/records | integrated | Captured first in named local refs `codex/preserve-main-wip-2026-10-21` and `codex/preserve-main-wip-untracked-2026-10-21`, then restored verbatim on the candidate. Runtime code, SQLite harness, tests, delivery records, state, and error learning remain coupled in this delivery. |
| `aac320e` / `codex/dimensional-atlas-polish` | superseded with accepted behavior retained | The current MapLibre/Living Atlas implementation is later and is protected by current recovery, diagnostics, correction, and retained-schema tests. Its compact private list, Timeline recovery, and owner-context behavior are present in the current `atlas-reveal`/projection tests; its old `react-native-maps` implementation is not replayed. Ref `codex/preserve-dimensional-atlas-aac320e` retains the source. |
| `f4699c4` responsiveness implementation | selectively integrated and deferred | Current engine/repository/projection retain its queue-versus-running contract and bounded write regressions where compatible. The benchmark and its synthetic evidence record are retained. No new performance optimization is started and no device-performance claim is made. |
| Detached `e904e4f` documentation | superseded by current records | Its earlier device evidence is historical; current project state/error playbook have later schema/recovery evidence. Ref `codex/preserve-responsiveness-e904e4f` anchors both detached commits. |
| `.jest-cache-codex/` | generated/local-only | Excluded from the delivery with the narrow root ignore rule. No cache was deleted. |
| Ignored databases, evidence, credentials, and raw traces | local-only | Not staged, copied, or inspected as delivery content. |

The initial sandbox attempt to create Git preservation refs could not create a
`.git` lock. The approved host Git boundary then created and verified the named
local refs. A follow-up PowerShell invocation rendered `stash@{0}` incorrectly
and did not resolve the stash object; the stash itself had already succeeded and
was verified through `refs/stash` before the candidate restore. These were
environment/command-format incidents, not application failures.

## Spec Change Log

## Review Triage Log

- `medium / patch` — current-or-newer import opens skipped the known empty incompatible manual layout; the shared guard and a forward-marker deletion regression now cover it.
- `medium / patch` — local-history deletion left abandoned v34 continuity data; the deletion transaction now drops that table when present and real SQLite coverage verifies it.
- `false` — broad validation of every hypothetical forward-schema incompatibility is not supported by an observed contract; the known manual-layout incompatibility is repaired without speculative migration.
- `medium / patch` — repeated remap failures could accumulate pending candidates; creation is now idempotent per revision.
- `medium / patch` — OS maintenance diagnostics collapsed reconciliation errors to `UNKNOWN`; they now retain the fixed classifier result and stage.
- `false` — a newly queued maintenance action remains serialized through the shared native transaction boundary; no demonstrated writer race survives that boundary.
- `medium / patch` — an empty queue left a stale reconciliation state; the no-update completion is now saved before return.
- `medium / patch` — retained forward-version deletion coverage was missing; it now runs in the real SQLite suite.
- `medium / patch` — import-open layout repair coverage was missing; it now runs through the import entry before deletion.
- `low / patch` — benchmark `--revision` accepted a missing value; it now rejects the invalid invocation.
- `false` — the one-run synthetic benchmark is explicitly not used for a device-performance claim; broader performance measurement is outside the paused scope.
- `medium / patch` — AtlasReveal callback coverage did not prove provider/screen wiring; an owner-screen test now proves queued catch-up invokes reconciliation rather than rebuild.
- `medium / patch` — the first review-fix test fixture used an import-only type while supplying maintenance methods; the fixture now has the narrow maintenance-method intersection and typecheck passes.
- `process limitation` — review layers ran serially because the session had one available subagent slot; all three completed against the same baseline diff after reconstructing it from the shared candidate because system Temp is session-isolated.
- `process limitation (supersedes prior note)` — the final three independent review workers exhausted their usage quotas before returning findings. The candidate was instead audited directly against the full baseline-to-candidate diff: no staged cache/private path, no production console boundary violation, and no whitespace error were found. This is weaker than three returned independent reviews and remains recorded as a review-evidence limitation.

## Design Notes

The existing histories are evidence sources, not merge instructions. The candidate
uses current main as its behavioral baseline because it contains later
owner-confirmed schema recovery and diagnostics. Preservation refs and a full
working-tree checkpoint provide rollback without rewriting any existing branch.

## Verification

**Commands:**
- `git worktree list --porcelain`, `git status --short --branch`, `git log main..REF`, and `git cherry main REF` -- expected: refreshed source inventory and disposition ledger.
- `npm run check` -- expected: framework integrity, foundation tests and eval smoke pass.
- `npm --prefix apps/mobile run test -- --runInBand --cacheDirectory "C:\\Users\\vothi\\Desktop\\Travel Life\\.jest-cache-codex"` -- expected: all mobile suites pass; use approved host boundary if sandbox cache EPERM recurs.
- `npm --prefix apps/mobile run test:sqlite` -- expected: real SQLite schema and retained-record contracts pass.
- `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint` -- expected: types and diagnostics boundary pass.
- `npm --prefix apps/mobile run doctor` -- expected: report actual Expo state; network/registry failure is recorded as an external blocker, not a pass.
- `git diff --check` and `git diff --cached --check` -- expected: no whitespace errors in the complete final change.
- combined diff review against the refreshed local-main baseline -- expected: all unique source changes have a defensible recorded disposition.

**Manual checks:**
- Build/serve the exact candidate bundle and record its branch/SHA. The owner performs Atlas load/recheck, metadata import, correction review and manual-journey flows that are affected by the final combined state; records only safe outcomes. Device acceptance remains pending until this is done.
