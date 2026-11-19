---
title: 'Fix foundation CI dependency order'
type: 'bugfix'
created: '2026-11-18'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c37ec11311ee7205ec409aea0c5eb250d408f9c8'
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
- The generated-bundle guard initially passed locally, while the first Windows `npm run check` had one `ARTIFACT_WRITE` failure in the offline-landmark publication test. Two later full root checks passed all 281 tests; the earlier publication cause remains unknown and is not attributed to this change.
- Hosted run 24 confirmed the mobile install completed before the root check, but the root check still failed 2 of 281 tests. The bundle mismatch was caused by hashing platform-specific CRLF/LF source bytes; the generator now normalizes line endings before hashing/transpiling. The regression and full root check pass locally.
- The paired detail benchmark passed score assertions but failed `targetPilotGate` on Ubuntu. Its synthetic fixture's 100,000,000-byte host RSS ceiling made the success case environment-dependent; exact CI RSS was not emitted. The success fixture now uses `Number.MAX_SAFE_INTEGER` and separately asserts quality and host gates; the dedicated overflow case remains.
- The first full mobile check passed 1,314 Jest tests, 141 SQLite tests, typecheck and lint, then Expo Doctor failed its SDK patch-version check (20/21), reporting 15 packages behind its expected versions. The manifest and lockfile now match Expo's compatibility map; the full mobile check passes, including Doctor 21/21.
- Local verification: `npm run check` passes all 281 tests plus eval smoke; `npm --prefix apps/mobile run check` passes 1,314 Jest tests, 141 SQLite tests, typecheck, lint and Expo Doctor 21/21. The required Deno command is not locally runnable because `deno` is unavailable; hosted Foundation Actions remain required before declaring the workflow green.

## Review Triage Log

- false — a separate workflow-order test would duplicate the generated-bundle guard: if this order regresses, the CI guard fails again with the missing TypeScript dependency.
- pending — record the post-change GitHub Actions run after push; local Deno verification is unavailable and hosted root/mobile/Deno results are still required.
- patch — retain the original Windows `ARTIFACT_WRITE` cause as unknown despite two later passing root checks; do not attribute or claim a root cause.
- false — Node/npm lockfile-version documentation is unrelated; no dependency manifests or lockfiles changed, and the workflow continues to pin Node 24.

## Code Map

- `.github/workflows/foundation.yml` -- Foundation job order; mobile dependencies must be installed before the root checks that execute the worker bundle guard.
- `scripts/build-history-domain.mjs` -- `visit` canonicalizes line endings before transpiling and digesting module sources so Windows and Linux source graphs match.
- `supabase/functions/_shared/history-domain.js` -- generated worker artifact; keep its factories and datasets unchanged apart from deterministic regeneration.
- `tests/history-worker-runtime.test.mjs` -- generated graph `--check` and canonical-source-digest regression.
- `tests/offline-landmarks.test.mjs` and `apps/mobile/scripts/benchmark-landmark-details.cjs` -- synthetic target-gate test and host RSS measurement; keep the dedicated low-memory failure case intact.
- `apps/mobile/package.json` and `apps/mobile/package-lock.json` -- keep installed Expo package patches aligned with the SDK compatibility map checked by Expo Doctor.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/build-history-domain.mjs` and `supabase/functions/_shared/history-domain.js` -- normalize source line endings before digesting and transpiling, then regenerate the artifact -- make local and Linux CI output deterministic.
- [x] `tests/history-worker-runtime.test.mjs` -- assert the generated source digest is computed from canonical source text -- catch future cross-platform drift.
- [x] `tests/offline-landmarks.test.mjs` -- make the synthetic success case independent of the host process RSS ceiling -- avoid environment-dependent failures while retaining explicit resource-gate coverage.
- [x] `apps/mobile/package.json` and `apps/mobile/package-lock.json` -- align Expo package patches with the installed SDK compatibility map -- keep the required mobile CI check green.
- [x] `.github/workflows/foundation.yml` -- preserve mobile dependency installation before root checks -- ensure the compiler is available to the generator.

**Acceptance Criteria:**
- Given a checkout with CRLF or LF source files, when the generator runs, then `--check` accepts the same committed bundle on Windows and Ubuntu.
- Given the deterministic synthetic detail fixture, when the candidate meets its quality thresholds, then the success test passes regardless of the test runner's baseline RSS, while the dedicated resource-overflow test still fails the host gate.
- Given the updated workflow, when Foundation CI runs, then root, mobile, and Deno checks all execute and pass.

## Verification

**Commands:**
- `node scripts/build-history-domain.mjs --check` -- expected: current bundle matches normalized source graph.
- `node --test tests/history-worker-runtime.test.mjs tests/offline-landmarks.test.mjs` -- expected: focused generator and synthetic benchmark regressions pass.
- `npm run check` -- expected: all foundation checks pass; report any unrelated Windows-only limitation separately.
- `npm --prefix apps/mobile run check` -- passed all mobile checks, including Expo Doctor 21/21.
- `deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` -- locally unavailable (`deno` not installed); must run in Foundation Actions.
- Hosted Foundation Actions run -- expected: all workflow steps complete successfully.
