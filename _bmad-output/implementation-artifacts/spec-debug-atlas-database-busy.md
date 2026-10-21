---
title: 'Diagnose Atlas catch-up SQLite busy failure'
type: 'bugfix'
created: '2026-10-20'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context:
  - 'docs/development/error-playbook.md'
  - 'docs/product/context.md'
  - '_bmad-output/implementation-artifacts/spec-local-operation-responsiveness.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Owner-operated Android Atlas catch-up reaches a generic `DATABASE_BUSY` failure after automatic maintenance has reported completion. The current privacy-safe diagnostic identifies the SQLite category but not the write stage, so it cannot distinguish a failed lease acquisition from a later rebuild or outcome write.

**Approach:** Preserve local-only data handling and owner-protection rules while adding a fixed, non-sensitive reconciliation-stage diagnostic and regression coverage. Do not introduce retries or alter reconstruction behavior until the observed stage is known.

</frozen-after-approval>

## Implementation Notes

- Investigation: `reconcileQueued` acquires its write lease before its current catch boundary; `BEGIN IMMEDIATE` contention there therefore reaches the controller as an unqualified `DATABASE_BUSY` error. The rebuild, outcome persistence, and lease release remain separately possible stages.
- Chosen scope: no migration, retry loop, data mutation rule, or background-scheduling change. The device retry stays owner-operated after the refreshed bundle is loaded.
- Added `ReconciliationStageError` with a fixed stage union, moved lease acquisition inside the reconciliation boundary, and preserve the primary stage if best-effort outcome persistence fails. The controller now emits a third, fixed stage argument only for this internal wrapper.
- Verification: focused RED/GREEN tests 51/51; full mobile Jest 37 suites / 338 tests; mobile TypeScript, lint, and root `npm run check` pass. Device-stage confirmation remains open.
- BMAD Blind Hunter was started but did not return findings because its worker hit an account usage limit; independent review remains pending and this diagnostic refinement is not marked done.
- Device evidence identified `DATABASE_BUSY LEASE`. Atlas now awaits the current same-runtime maintenance transition before requesting reconstruction. This is intentionally limited to known foreground work; no SQLite retry, scheduling, data, or reconstruction-rule change was introduced. Focused tests 67/67 and full mobile Jest 37 suites / 339 tests pass, as do TypeScript, lint, and root `npm run check`. The refreshed device confirmation remains open.
- A second device result remained `DATABASE_BUSY LEASE`, so reconstruction now reads the durable OS-maintenance lease before writing. An active maintenance owner returns the existing no-write, safe deferral result. Focused tests 52/52, full mobile Jest 37 suites / 340 tests, TypeScript, lint, and root `npm run check` pass. Device confirmation remains open.
- The result remained busy after a delayed run, so the fixed diagnostic now distinguishes `LEASE_OPEN`, `MAINTENANCE_LEASE_READ`, and `LEASE_WRITE`. Focused tests, full mobile Jest 37 suites / 340 tests, TypeScript, lint, and root `npm run check` pass. A device-stage result is required before a native SQLite mechanism change.
- A `LEASE_WRITE` device result exposed a start-between-read-and-write race. One read-only post-lock maintenance-lease recheck now safely defers that exact background-task case without retrying the transaction. Focused tests 53/53, full mobile Jest 37 suites / 341 tests, TypeScript, lint, and root `npm run check` pass. Device confirmation remains open.
- Cold restart confirmation changed the fixed device result from `DATABASE_BUSY LEASE_WRITE` to `JOURNEY_REMAP REBUILD`, without clearing private-record data. A new process therefore opens SQLite and reaches the rebuild protection gate. This separates the observed stale in-process native lock from the independent owner-remap requirement, but does not establish an automatic lock-recovery correction. Keep this one-shot diagnostic in progress until the lifecycle behavior is either safely repaired or evidenced as development-runtime-only; do not use the protected remap to claim a successful catch-up speed sample.
