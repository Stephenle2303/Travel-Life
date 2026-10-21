---
title: 'Runtime diagnostic logging contract'
type: 'feature'
created: '2026-10-20'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Travel Life has several independent error handlers. Some write fixed diagnostic labels, some emit raw `Error.message`, and others only show generic recovery copy. A developer cannot reliably trace a failed owner action to its operation, safe cause, and failure boundary; raw native error text can also disclose private data.

**Approach:** Establish one privacy-safe runtime diagnostic contract, route all current app diagnostic events through it, and make direct production `console` logging fail lint. The contract records a closed operation, reason code, optional fixed stage, retryability, durable outcome, and correlation ID; it never serializes source errors or personal data.

## Boundaries & Constraints

**Always:** Preserve owner-safe UI recovery separately from diagnostics. Classify raw errors only in memory, emit a fixed structured event before recovering an unexpected failure, and test the emitted event and redaction. Record expected lifecycle events through the same sink. Apply the rule to foreground owner actions and OS maintenance reconciliation.

**Never:** Log raw `Error.message`, stacks, SQL, source/media IDs, place labels, coordinates, access tokens, lifecycle payloads, or correction data. Do not report normal cancellation, stale-generation suppression, unavailable optional APIs, or already-running work as an unexpected error. Do not change reconstruction, import, correction, migration, or private-record behavior to implement logging.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Owner rebuild fails | Native error contains a private sentinel | One `ATLAS_REBUILD` event has closed reason/stage, retryability and durable outcome; UI stays redacted | Sentinel is absent from event and UI |
| Place save fails | Repository rejects with a native-like message | One `JOURNEY_PLACE_SAVE` event and safe recovery copy | No raw console call or message interpolation |
| Import or retry ends non-complete | Paused, blocked, disconnected, skipped, or durable-read failure | A terminal fixed event identifies the operation and outcome | Expected control-flow states are represented by fixed lifecycle events, not generic errors |
| OS maintenance reconciliation fails | Background task returns a failed reconciliation result | One maintenance operation event is emitted without private error detail | Task result remains compatible with Expo scheduling |

</frozen-after-approval>

## Code Map

- `AGENTS.md` -- durable agent governance; add the runtime diagnostic logging rule without removing existing error-learning instructions.
- `docs/development/error-playbook.md` -- record the raw journey-place logger, sandbox cache boundary, test `act` warning, and any implementation incidents with concrete evidence.
- `apps/mobile/src/diagnostics/app-diagnostics.ts` -- new sole production console boundary; owns closed event types and fixed serialization.
- `apps/mobile/eslint.config.cjs` -- lint boundary that prohibits direct production `console` usage while allowing the diagnostics module and tests.
- `apps/mobile/src/reconstruction/controller.ts` -- reuse error classification and stage handling for rebuild and reconciliation; operation is passed explicitly by callers.
- `apps/mobile/src/photo-access/controller.ts` -- migrate import start, completion, paused/blocked, and failure lifecycle events.
- `apps/mobile/src/photo-access/provider.tsx` -- migrate durable-read and reveal-retry diagnostics; pass foreground and maintenance operations explicitly.
- `apps/mobile/src/maintenance/task.ts` -- emit the fixed OS-maintenance reconciliation outcome without exposing native failure text.
- `apps/mobile/src/components/journey-edit.tsx` -- replace raw error logging and owner-visible raw error text with the fixed correction-save diagnostic and safe recovery copy.
- `apps/mobile/src/components/__tests__/` -- update existing diagnostic assertions and add redaction/lint-boundary regressions.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md`, `docs/development/error-playbook.md` -- add the approved policy and factual incident entries, preserving existing guidance and private-data boundaries.
- [x] `apps/mobile/src/diagnostics/app-diagnostics.ts`, `apps/mobile/eslint.config.cjs` -- implement the typed shared sink and deterministic no-direct-console guard.
- [x] `apps/mobile/src/reconstruction/controller.ts`, `apps/mobile/src/photo-access/controller.ts`, `apps/mobile/src/photo-access/provider.tsx`, `apps/mobile/src/maintenance/task.ts`, `apps/mobile/src/components/journey-edit.tsx` -- migrate diagnostic ownership without altering product-state semantics.
- [x] `apps/mobile/src/components/__tests__/` -- prove fixed event shape, redaction, terminal-path coverage, and the correction-save recovery behavior.

**Acceptance Criteria:**
- Given any unexpected mobile app failure, when it is handled, then exactly one structured, fixed, privacy-safe diagnostic identifies its operation, reason code, stage or explicit null, retryability, durable outcome, and correlation ID before UI recovery.
- Given a caught native error containing a private sentinel, when any migrated path handles it, then the sentinel appears in neither diagnostic output nor owner-facing copy.
- Given a new direct `console` call in production mobile source outside the diagnostics boundary, when lint runs, then lint fails.
- Given a paused, blocked, disconnected, skipped, cancelled, stale, or already-running path, when it is deliberate control flow, then it uses an explicit fixed lifecycle/outcome event and is not mislabeled as a generic unexpected error.
- Given current foreground and OS-maintenance reconciliation paths, when they fail, then diagnostics distinguish their operation without changing SQLite, scheduling, or correction semantics.

## Implementation Notes

Implemented a local-only, closed diagnostic event and migrated every production
mobile console call through its single sink. Expected state transitions emit
fixed lifecycle events; raw error classification remains in memory.

## Spec Change Log

## Review Triage Log

## Design Notes

The runtime sink is intentionally a narrow local boundary rather than a remote telemetry system. The current product has strict private-data constraints and no authorization for external diagnostic transport. A correlation ID is generated locally per action and is not derived from an asset, journey, record, or location identifier.

## Verification Results

- `npm --prefix apps/mobile run test -- --runInBand --cacheDirectory "C:\\Users\\vothi\\Desktop\\Travel Life\\.jest-cache-codex"`: 38 suites / 356 tests passed on the approved host boundary.
- `npm --prefix apps/mobile run typecheck`: passed.
- `npm --prefix apps/mobile run lint`: passed; production source has no direct console call outside the diagnostics boundary.
- `npm run check`: passed (framework integrity, 20 foundation tests, eval smoke).
- `git diff --check`: passed.

## Verification

**Commands:**
- `npm run check` -- expected: foundation framework, tests, and eval smoke pass.
- `npm --prefix apps/mobile run test` -- expected: structured diagnostic and redaction regressions pass; run through the approved host boundary if the known sandbox transform-cache `EPERM` recurs.
- `npm --prefix apps/mobile run typecheck` -- expected: closed diagnostic event types compile.
- `npm --prefix apps/mobile run lint` -- expected: direct production `console` use is rejected and migrated source passes.
- `git diff --check` -- expected: no whitespace errors in touched artifacts.
