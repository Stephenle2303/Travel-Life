---
title: 'Recover the failing durable Atlas read'
type: 'bugfix'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
review_loop_iteration: 0
context:
  - 'docs/development/error-playbook.md'
  - 'docs/product/context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The owner reports repeated schema-recovery failures after performance and subsequent recovery changes. Device fixed diagnostics now show a completed rebuild followed by a failed durable Atlas read. Prior schema-gate call-order tests did not reproduce the native failure.

**Approach:** Establish the loaded bundle and exact failing schema/query boundary through local read-only diagnostics, reproduce it with synthetic real SQLite, and make only the smallest evidence-backed repair. Preserve existing journeys, owner corrections, import metadata, graph rules, and unrelated dirty work. No database copying, app-data clearing, reinstall, performance changes, commits, pushes, or external evidence processing. Validate host checks and deliver the verified bundle before one owner-operated acceptance check. Do not claim device recovery without that result.

</frozen-after-approval>

## Implementation Notes

- The user authorized this recovery approach with `go` after the mixed dirty tree was disclosed. Existing work is retained; task-local snapshots/diffs isolate any edits.
- Source audit: all 33 current migration blocks execute in real SQLite; 136 static repository SQL statements prepare against that schema. The historical v34 continuity table is not referenced by current queries. No speculative schema version bump is justified.
- Device read-only evidence: connected Android process reports `ATLAS_REBUILD COMPLETE`, followed by `ATLAS_REVEAL_RETRY SCHEMA`; `ATLAS_DURABLE_READ SCHEMA` also exists. Native package version alone does not identify a Metro JavaScript bundle.
- Tests to add: execute actual import migration and reconstruction repository methods through an Expo-shaped async adapter backed by node:sqlite, using installed TypeScript transpilation. Cover a fresh database and retained historical upgrades with synthetic evidence, manual journey and correction preservation, rebuild then durable read, and rollback where relevant. Reuse the existing benchmark transpilation pattern; add no dependencies. SQL must execute, not return mocked query results.
- Task scope: `apps/mobile/scripts/atlas-sqlite.test.cjs`, its mobile package test script, and only the production file(s) demonstrated faulty by reproduction; this delivery record plus project state/error playbook. Record every command/tool failure here and in the playbook. Keep the record open if real-device evidence still requires owner input.
- Foundation `npm run check`, full mobile Jest, mobile typecheck/lint, real-SQLite regression, and task diff whitespace checks are required. Synthetic checks establish schema/software compatibility, not trip accuracy or measured performance.
- Investigation update: real retained-schema runs pass; the live read failure remains unlocalized because existing durable-read diagnostics always use `stage: null`. Add a closed durable-read stage union/error wrapper and propagate only that fixed stage through the existing diagnostic boundary in `diagnostics/app-diagnostics.ts`, `reconstruction/repository.ts`, and `photo-access/provider.tsx`. Write failing real-SQLite shape-mismatch and diagnostic privacy tests first. Do not repair, bump, or replay migrations without evidence. An owner-operated failure with the verified diagnostic bundle may be the remaining required input.
- Fresh device evidence after identified-client reload: `ATLAS_DURABLE_READ SCHEMA DURABLE_MANUAL_START_FIELD`. The manual query's required `date_start` column is absent although the schema gate returned successfully. Known native schema signatures are classified in memory to fixed stages; no raw identifier/error leaves the boundary. Next discriminate empty versus retained-row layout using a read-only aggregate, with fixed stage only, before choosing any compatible repair.
- Clean-process device evidence now confirms `DURABLE_MANUAL_EMPTY_LAYOUT`. Authorized repair: shared schema gate must validate manual-table columns even when marker >=33. Healthy layouts remain read-only. For an absent table create the canonical table; for an incompatible empty table, BEGIN IMMEDIATE through existing serialization, recheck shape and zero rows after obtaining the writer, rename it to a fixed retained-schema table, then create canonical manual storage and a working date index. Preserve the original empty table/indexes, every other table/row, and both version markers (including an existing v34 marker). Roll back every schema change on failure. Refuse populated incompatible layouts and pre-existing archive-name conflicts without modifying them. No arbitrary alias/date/value mapping, migration-chain replay, version downgrade, graph/correction change, or data deletion. Use a fixed recovery error name/category; never expose schema text. This restores the existing v33 schema contract, not a new product schema version.
- Repair files additionally include `import-record/repository.ts` (task baseline captured), plus a fixed classifier branch if needed. Use one canonical manual DDL definition shared by v33 migration and targeted recovery; adapt synthetic migration extraction if factoring the constant. Test direct public entry from malformed current-marker shapes, current and v34 markers, zero/nonzero rows, archive conflict, transactional rollback/retry, gate no-write for healthy schema, and unchanged data/corrections. Earlier diagnostic-only empty-layout fixtures should be updated to the now-intended safe recovery behavior; retained/unknown data still fail closed. Re-run all checks and task-local independent review before device recovery.

## Review Triage Log

- Seven independent review findings accepted as test-coverage gaps: direct retained public entries, pre-existing committed projection, pending-remap reads, corrected label/anchor/application after reconciliation, nonempty correction rollback, provider stage propagation, and additional failing stages. Tests expanded to cover these; no rule/query changes made for the findings.
- Root review accepted and fixed native error masking in safety/transaction catches; busy/handle categories and primary error identity are now regression-covered. Final independent review of the expanded task diff found no remaining actionable findings or blockers for the confirmed empty layout.

## Verification

- PASS: 49 real SQLite tests, actual production repository methods against synthetic retained shapes; no private database copied.
- PASS: 38 Jest suites / 373 tests, mobile TypeScript, Expo lint, root foundation/framework/eval-smoke check, CJS syntax, and task whitespace checks.
- PASS: Metro served the exact physical-layout repair module; app reopened on the verified local bundle after final checks. No native dependency/build change was needed for this JavaScript/SQLite patch; Expo Doctor was not rerun.
- PASS, owner acceptance: after the final reviewed bundle launch, the owner confirmed `Atlas loads and the recheck completes`. A matching fresh structured terminal event was not returned by the final logcat read; acceptance is the owner-observed completion, not a fabricated log claim. No commit/push or performance measurement was made.
