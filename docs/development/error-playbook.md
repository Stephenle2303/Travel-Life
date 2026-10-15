# Error and improvement playbook

## Index

| ID | Area / search terms | Lesson | Status |
| --- | --- | --- |
| EP-001 | isolated worktree, node_modules, external Git path | Verify the new worktree's dependency and Git access before using assumed local paths | Fixed; active safeguard |

## EP-001: Isolated worktree did not carry installed dependencies or sandbox Git access

- **Date / task / area:** 2026-10-15; dimensional Atlas implementation; worktree setup.
- **Status:** Fixed; active safeguard.
- **Expected / actual:** The newly created worktree was expected to support the same Git and installed-package reads as the primary checkout. `git` in the sandbox was denied access to the external worktree and `apps/mobile/node_modules` was absent, so guessed declaration-file reads failed.
- **Cause:** Managed worktrees are outside the sandbox writable/read boundary and do not include ignored dependency directories. The pre-existing Jest matcher also expanded `<rootDir>` into an escaped Windows path that failed to discover test files under the `.codex` worktree parent.
- **Correction:** Switched worktree inspection to the approved elevated boundary, installed the lockfile-pinned dependencies, and changed the Jest matcher to a repository-relative glob.
- **Verification:** Git status and source inspection succeed through the elevated worktree boundary. The repository-relative matcher discovers the focused Atlas suite, which passed 17 tests after dependencies were installed.
- **Prevention:** At the start of an isolated-worktree task, inspect Git access and the exact dependency directory before any path-specific read or test command; distinguish missing dependencies from application failures. Keep Jest test globs repository-relative so checkout paths do not affect discovery.
- **Recurrence (2026-10-15):** Before dependencies were installed, a sandboxed `git` inspection again failed with
  `Permission denied` for this isolated worktree. An elevated inspection then
  confirmed the expected baseline and absent dependency directories. Use the
  approved elevated boundary for this worktree's Git/package inspection before
  treating a command failure as an application failure. At that earlier point,
  the focused Atlas test stopped because `jest` was unavailable and root
  checking stopped at missing `ajv`; these were dependency-environment blockers,
  not test results. After the lockfile-pinned dependencies were installed, the
  focused and root checks ran successfully as recorded in the delivery spec.

## Recording and maintenance

Add or update an entry for every agent-caused unexpected command failure before handoff. Keep entries concise, factual, and free of private data. A fixed status requires recorded verification.

## EP-002: Expo Doctor reports pre-existing config and SDK maintenance drift

- **Date / task / area:** 2026-10-15; dimensional Atlas verification; Expo dependencies.
- **Status:** Open; pre-existing dependency alignment issue.
- **Expected / actual:** `npm run doctor` should complete with all checks passing. On 2026-10-16 it reported 19/21: nine Expo SDK patch-version mismatches already declared by the baseline lockfile/package manifest, including `expo`, `expo-router`, and `jest-expo`; and a baseline `ios.icon` reference to the `assets/expo.icon` bundle which the current Doctor cannot accept as a file.
- **Cause:** The isolated baseline commit pins older SDK 57 patch versions than the current Doctor expects, and its committed `app.json` already references the same icon bundle. This Atlas change did not modify dependencies or Expo configuration.
- **Correction:** None in this scoped visual implementation; configuration repair and dependency upgrades require their own compatibility review.
- **Verification:** `git show 0041c0098e0956bb72aebb711e48249ac411bef0:apps/mobile/app.json` confirmed the baseline `ios.icon` reference. Full mobile Jest (25 suites / 190 tests), TypeScript, and lint pass independently. Doctor remains an explicit non-passing maintenance gate.
- **Prevention:** Run Doctor separately and report its result separately from tests/typecheck/lint; verify whether a Doctor finding exists in the baseline before attributing it to a feature change.

## EP-003: Review patch changed accessible labels before its focused tests

- **Date / task / area:** 2026-10-16; dimensional Atlas review fixes; Atlas Jest suite.
- **Status:** Fixed; active safeguard.
- **Expected / actual:** Adding an accessible disambiguator should have retained a passing focused test suite. The first focused rerun failed 2 assertions because they still expected the old exact labels.
- **Cause:** The implementation changed the labels for duplicate-safe journey wording before the matching test expectations and regression cases were updated.
- **Correction:** Updated the existing selection/row expectations and added explicit no-anchor, refreshed-selection, viewport, and duplicate-label regressions.
- **Verification:** `npm test -- --runInBand atlas-reveal` passed 21 tests on 2026-10-16.
- **Prevention:** When changing accessibility labels, update existing exact-label assertions and add a duplicate-content case in the same patch.
- **Recurrence (2026-10-16):** The first complete check rejected synchronous selection reset inside a React effect. The reset is now deferred and cancellable, and the complete check is rerun before handoff. Avoid direct state writes in effect bodies under the repository's React lint rules.
