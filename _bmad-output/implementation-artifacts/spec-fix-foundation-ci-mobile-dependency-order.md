---
title: 'Fix foundation CI dependency order'
type: 'bugfix'
created: '2026-11-18'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Foundation CI runs the root check before installing mobile dependencies. The root check now exercises the generated history-domain guard, whose generator resolves the mobile TypeScript compiler, so CI fails with `Cannot find module 'typescript'`.

**Approach:** Install mobile dependencies before running the root check, preserving the existing check commands and their coverage.

</frozen-after-approval>

## Implementation Notes

- Both latest Foundation checks (runs 22 and 23) failed at `tests/history-worker-runtime.test.mjs:374` because `scripts/build-history-domain.mjs --check` could not resolve mobile `typescript`. Job logs show `npm --prefix apps/mobile ci --ignore-scripts` was skipped after `npm run check` failed.
- Runtime diagnostic mapping is not applicable: this is a CI dependency-order configuration change and introduces no runtime boundary.
- `.github/workflows/foundation.yml` now installs mobile dependencies before `npm run check`.
- The generated-bundle guard passed in the local foundation run. Overall `npm run check` reported 280 passing tests and one unrelated Windows `ARTIFACT_WRITE` failure in the offline-landmark publication test; a same-directory rename probe passed, leaving that failure's cause unknown. Do not attribute it to this workflow change.

## Review Triage Log

- false — a separate workflow-order test would duplicate the generated-bundle guard: if this order regresses, the CI guard fails again with the missing TypeScript dependency.
- pending — record the post-change GitHub Actions run after push; local evidence does not establish the hosted job result.
- patch — clarified the unrelated Windows failure to identify its exact test, final publication call, command, Node/npm versions, successful rename probe and still-unknown native cause.
- false — Node/npm lockfile-version documentation is unrelated; no dependency manifests or lockfiles changed, and the workflow continues to pin Node 24.
