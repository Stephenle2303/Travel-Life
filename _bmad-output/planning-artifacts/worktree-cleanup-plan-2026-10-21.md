# Travel Life worktree cleanup plan

Date: 2026-10-21. Status: consolidated execution plan, revised to the owner's
single-delivery direction. Inventory below is the earlier planning snapshot and
must be refreshed at execution start.
Request: define a safe strategy with BMAD party mode. This record authorizes no
commit, push, merge, reset, deletion, or worktree retirement by itself.

## Intended result

One execution, one integration branch, one combined review and acceptance package,
and one final consolidation commit for the new combined changes. Existing source
commits remain preserved; no history rewrite is required. Internal checkpoints
below are ordered operations within this same task, not separate stories,
deliveries, implementation approvals, or reasons to stop.

The complete repository state is reconciled together: main's WIP, its two local
commits, unique secondary-worktree changes, tests, scripts, specs and documentation.
Every change is accounted for as integrated, superseded with evidence, preserved
under an existing scope restriction, or generated/local-only. Retired worktrees
remain recoverable. A clean Git status alone is insufficient.

Execution continues through the whole authorized scope and required checks.
Only a concrete unresolved product decision, unavailable required access/device
input, or final publishing/retirement authorization can require owner input;
continue independent work while that input is pending.

## Verified inventory

Git status was read in all five registered worktrees; the four external checkouts
required the approved host boundary. No Git content was changed. Comparisons use
local refs; no fetch occurred, so remote freshness is unknown.

| Worktree / branch | HEAD | Working state | Relationship to local main | Proposed disposition |
| --- | --- | --- | --- | --- |
| Desktop / main | 3645895 | 32 tracked files modified, untracked source/tests/specs/review patches and Jest cache; nothing staged | Two commits ahead of cached origin/main | Preserve complete state; reconcile into the single combined delivery |
| atlas-reference-cartography / codex/atlas-reference-cartography | 448ab96 | Clean | Ancestor of main; zero unique commits | Retirement candidate after ownership and ignored-file audit |
| destination-labels / codex/destination-labels-archive | 34c7564 | Clean | Ancestor of main; zero unique commits | Retirement candidate after ownership and ignored-file audit |
| dimensional-atlas / codex/dimensional-atlas-polish | aac320e | Clean | One unique commit; main has nine commits outside this branch | Compare intended behavior against current UI; port only missing accepted behavior |
| local-operation-responsiveness / detached HEAD | e904e4f | Clean | Two unique commits, f4699c4 and e904e4f; main has two commits outside this history | Anchor on a named branch before any retirement; retain performance work as deferred unless accepted |

`git cherry` reports all three unique commits as patch-distinct from main.
This does not prove their behavior is absent: later commits and current WIP may
contain equivalent or superseding implementations. No stashes were listed.
The current chat has no attached managed worktrees; app-managed retirement must
use the owning chat/attachment where available, not assume this chat can archive them.

Main's two existing commits are 7e4dea6 (manual journey entry) and 3645895
(private-record recovery before manual journey). Retain both in the integration
baseline unless fresh remote history establishes a concrete incompatibility.

## BMAD discussion and tradeoff

- John: make the accepted recovery state deliverable; keep paused performance
  work visible without silently expanding cleanup into a new performance story.
- Winston: preserve the exact combined state before reconciling shared files.
  Integration must reconcile behavior, not merely replay branch history.
- Amelia: preserve attribution in a source-to-result ledger and retain original
  history. The owner selects one final consolidation commit, so review and test
  the complete combined state rather than manufacturing independent deliveries.
- Sally: preserve the owner's accepted Atlas load/recheck behavior and the
  official Living Atlas UI. An older attractive UI commit cannot override later
  interaction and recovery decisions.
- Mary: ancestry, patch equivalence, software checks and device acceptance answer
  different questions. Keep each in the disposition ledger.

Owner direction: one complete plan followed by one consolidated execution and
delivery. Preservation, reconciliation, verification and retirement form a single
workflow. The earlier recommendation to split delivery commits is superseded.

## Fixed scope and conflict rules

- Preserve main's current owner-accepted Atlas recovery as the starting behavior;
  never replace the entire current repository/controller/UI with an older version.
- Account for all unique branch changes. Include accepted behavior that is still
  missing, retain current equivalents, and record why superseded changes are not
  replayed. A commit's date or branch name is not a conflict-resolution rule.
- Keep current physical-schema v33 compatibility as the authority; historical
  v34 notes do not authorize a schema bump or removal of retained evidence.
- Keep unresolved correction review local to the related journeys where designed;
  retain structural correction protection and durable reveal completion.
- Preserve closed, privacy-safe diagnostics and their lint boundary throughout.
- Do not start new performance optimization or claim a speed improvement. The
  existing pause remains binding: inspect existing performance hunks in the same
  reconciliation, retain equivalent/accepted recovery behavior, and preserve any
  still-paused optimization on a named ref with a precise disposition. This is
  archival scope accounting, not a second implementation phase or story.
- Retain the official Living Atlas UI/interaction contract; port an older UI
  change only where it adds missing accepted behavior without regressing it.
- Keep private evidence and generated caches out of delivery. No data reset,
  reinstall, raw diagnostic logging, forced Git update or wholesale file deletion.
- If a genuine behavior conflict cannot be resolved from current decisions/specs,
  present the exact alternatives before changing that behavior. Do not silently
  turn cleanup into a product redesign.

## Execution sequence

### 1. Coordinate and capture

- Identify active chats/processes and their worktree ownership. Ask their owner
  to quiesce writes before snapshotting; do not interrupt another chat implicitly.
  Recheck status/HEAD before and after capture. If they change, refresh inventory.
- Refresh remote refs once execution/network access is authorized; record remote
  divergence without pulling into dirty main.
- Create named preservation refs for current heads, especially detached e904e4f.
- Capture main's staged/unstaged tracked changes and approved untracked source,
  tests, scripts and delivery records in a local recoverable checkpoint. Verify
  that a separate checkout reproduces the captured file state. Record hashes.
- Inspect ignored files separately for needed local artifacts before retirement.
  Keep private evidence, credentials, local databases and raw caches out of Git
  and external uploads. Preserve needed private files only within approved local
  storage. A Git bundle does not capture uncommitted or ignored files.

Exit: every original state is recoverable and the ownership map is recorded.

### 2. Reconcile the complete scope together

For each file/hunk or unique commit record: source worktree/HEAD, delivery record,
purpose, dependencies, current evidence, decision, final location and verification.
Use explicit file lists; do not stage the entire directory blindly.

Coverage checklist for the single combined change, subject to hunk inspection:

| Bucket | Existing delivery record / treatment |
| --- | --- |
| Runtime diagnostic boundary and lint enforcement | spec-runtime-diagnostic-logging.md; include new diagnostic module/tests and matching AGENTS guidance |
| Import/SQLite lifecycle, writer coordination and durable reveal | spec-debug-atlas-database-busy.md and spec-atlas-reveal-after-catch-up.md; reconcile overlapping controller/provider/repository changes |
| Nonblocking correction remap | spec-nonblocking-journey-correction-remap.md; preserve journey-level review semantics and structural protection |
| Physical schema compatibility repair and real SQLite harness | spec-atlas-schema-recovery.md; include scripts and test command with source changes; retain owner-confirmed acceptance scope |
| Legacy Atlas continuity | spec-legacy-atlas-continuity; reconcile with current schema v33 authority, not historical v34 notes |
| Performance changes | spec-local-operation-responsiveness.md and detached commits; resolve within the same scope ledger under the existing pause, preserving original work without starting new optimization |
| Shared project state and incident history | Reconcile to the final implementation; retain historical lessons without presenting superseded state as current |
| Review patches / planning artifacts | Retain useful synthetic/redacted evidence, identify its reviewed baseline, screen content before committing |
| .jest-cache-codex and other generated/local files | Exclude from delivery; make a narrowly scoped ignore change if appropriate; no deletion required to preserve work |

Shared files include reconstruction repository/controller, photo-access provider,
Atlas UI and their tests. Reconcile these as one coupled implementation. The
checklist is for coverage and attribution only; it creates no separate deliveries
or commit boundaries. Keep original snapshots until reconciliation ends.

### 3. Assemble one integration branch

- Use a dedicated `codex/worktree-consolidation-2026-10-21` branch/checkout after
  capture, leaving the source WIP recoverable. Default to local main, retaining
  its two commits; reconcile fresh remote changes without rewriting source history.
- Restore the complete captured candidate state and reconcile all required
  dependencies in this checkout. Do not peel shared-file hunks into independent
  feature branches. Use focused checks while resolving problems, then verify the
  complete final state as the release candidate.
- Compare aac320e and f4699c4 with both main history and the captured final state.
  For each change choose exact commit inclusion, selective port, superseded, or
  deferred. Do not use an unconditional cherry-pick or blanket ours/theirs resolution.
- Do not resume paused performance optimization just to empty a worktree.
  Preserve any inseparable accepted recovery fixes in the integration unit and
  explain which optimization remains deferred.
- Keep source/test/spec changes together. Record provenance when selective ports
  mean the source commit itself is not an ancestor of the final branch.
- Reconcile documentation once around the final behavior, retaining accurate
  incident history and linking the original delivery records from this plan.

### 4. Verify the assembled result

- Inspect the complete candidate file list, combined source diff, private-data
  exclusions and whitespace. When committing is authorized, require
  `git diff --cached --check` for the single final consolidation commit.
- Run root `npm run check` and mobile Jest, real SQLite tests, TypeScript and lint
  from the integration checkout. Run mobile Doctor and report actual blockers
  separately; prior records identify nine Expo patch recommendations, not a pass.
- If inference/evidence rules change during reconciliation, read evals/README.md
  and attach the required plan/results; fixture checks do not prove accuracy.
- Build/bundle the target from that checkout. Record checkout, branch, SHA and
  served bundle identity before claiming delivery.
- Preserve prior owner acceptance as historical evidence. Obtain owner click-and-
  wait confirmation for affected device flows on the assembled bundle: Atlas
  load/recheck, metadata import, correction review and manual journey as applicable.
  Treat unavailable platform/device checks as pending, not implicitly passing.

Exit: final selected behavior is verified at a known SHA; any deferred work and
remaining device/platform evidence are explicit.

All checks must refer to the same assembled tree. Record the candidate tree
identity before device review and verify the final commit contains that tree.
Rerun affected checks if a correction changes it. Do not use earlier per-worktree
test passes as a substitute for combined verification.

### 5. Publish and retire only after acceptance

- Present the single combined diff, disposition ledger, checks and remaining limits
  before the final user decision to merge/push/archive. Planning does not supply
  that authorization.
- After authorization, make one final consolidation commit for the combined new
  changes, retaining source and preservation history. Publish the accepted branch
  through the chosen merge/push route; do not force-push existing branches.
- Once publication is verified, remove redundant WIP from the original checkout
  only after proving it is represented by the accepted result or recoverable
  archives. A clean integration checkout alone does not clean the original main.
  Avoid blanket reset/clean operations and preserve all needed local-only files.
- Before retiring each checkout, verify no active owner, no unpreserved tracked,
  untracked or needed ignored files, and no unaccounted unique commits. Recheck
  live state immediately before acting.
- Use Codex managed-worktree archival through the owning attachment where
  supported; otherwise select the appropriate supported Git retirement procedure
  only with explicit authorization. Never recursively delete a worktree folder.
- Keep deferred work on named recoverable refs with its delivery record. Delete
  branches only through a separate explicit decision after integration/preservation.

## Completion criteria

1. Every registered checkout and local change has an evidenced disposition.
2. Accepted work is on the selected branch; deferred work remains recoverable.
3. No private evidence or generated cache entered delivery commits.
4. Required software checks and applicable owner acceptance are tied to the final state.
5. Selected publishing/retirement actions are authorized and completed; retained
   worktrees have an explicit owner/purpose. No accidental data loss or history rewrite.
6. Main's original uncommitted work is fully accounted for and no duplicate WIP
   remains unintentionally. One combined delivery record and final commit identify
   the outcome; no unfinished cleanup subprojects are created.

## Evidence from this planning pass

Read-only inventory and local ancestry/patch comparison completed. All external
worktrees are clean; main has all observed uncommitted changes. Application checks
have not been rerun as evidence of an integrated application: integration has not
occurred. Root `npm run check` passed during planning: framework integrity,
20 foundation tests and eval infrastructure smoke. These are planning/foundation
checks, not verification of a consolidated mobile application. No application
source edits, Git staging/commits/merges, pushes or retirement occurred.
