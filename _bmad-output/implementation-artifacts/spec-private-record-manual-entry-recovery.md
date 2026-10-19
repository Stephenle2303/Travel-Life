---
title: 'Private record recovery before manual journey entry'
type: 'bugfix'
created: '2026-10-19'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7e4dea6458e5b252c9cfaee28b39c7213c0e45fc'
context:
  - 'docs/development/error-playbook.md'
  - 'docs/product/design-system.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On a device without a connected private local record, Atlas opens the manual-journey form and rejects the owner only after they review the draft. In Settings, starting or reconnecting that record can look like a no-op because progress and failure feedback are not visible where the action occurs.

**Approach:** Make private-record availability explicit before manual entry, guide the owner to create or reconnect it without losing Atlas context, and make the lifecycle action visibly pending, retryable, and safely explained. Preserve the repository's existing lifecycle checks as the race-safe final guard.

## Boundaries & Constraints

**Always:** Keep every record and error private on device; preserve the unrelated untracked architecture-review file; distinguish an empty Atlas from an unavailable local record; show a safe actionable error without exposing raw SQLite details; allow a successful new/reconnected record to proceed to manual entry without importing photos or fabricating evidence/media.

**Never:** Delete local history, change photo permissions, weaken repository lifecycle validation, auto-import media, or make a manual journey appear as observed evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Connected Atlas | Owner chooses manual entry | Opens the existing form with preserved Atlas context | Repository still rejects a concurrent lifecycle change safely |
| Disconnected or deleted Atlas | Owner chooses manual entry | Explains that a private local record is needed and offers the appropriate reconnect/create action before form entry | No destination/date draft is accepted before readiness |
| Create/reconnect pending | Owner taps lifecycle action | Button shows progress and prevents duplicate taps | Existing record and source photos remain unchanged |
| Create/reconnect fails | Local open, migration, or transaction fails | Visible, action-adjacent retry guidance; never claim connected | Safe generic message; implementation can retain diagnostic cause locally without showing it |
| First database open fails | Owner retries lifecycle action | A later valid retry is able to reopen rather than inheriting a permanently rejected cached open | Record stays unavailable until a successful open is confirmed |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/history-record/controller.ts` -- lifecycle state owner; add observable pending/retry state while retaining serialized actions.
- `apps/mobile/src/components/mobile-screens.tsx` -- private-record controls and Atlas-to-manual navigation; surface state next to the owner action and gate navigation honestly.
- `apps/mobile/src/components/atlas-reveal.tsx` -- existing manual CTA context handoff; reuse rather than changing map/timeline behavior.
- `apps/mobile/src/photo-access/provider.tsx` -- exposes private-record lifecycle/controller and preserves provider-side overlap/create guards.
- `apps/mobile/src/import-record/repository.ts` -- local database open/connect implementation; ensure a failed initial open does not poison a later explicit retry if investigation confirms the cached promise is the cause.
- `apps/mobile/src/app/manual-journey.tsx` and `apps/mobile/src/components/manual-journey.tsx` -- form route/interaction; do not let an unavailable record consume an owner draft.
- `apps/mobile/src/components/__tests__/history-record-controller.test.ts` and `privacy-settings-screen.test.tsx` -- lifecycle pending, visible failure, retry, and success coverage.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` or a route-level manual-entry test -- unavailable-record preflight and connected-path regression coverage.
- `docs/development/error-playbook.md` -- record this device-discovered failure and the earlier incorrect file lookups with evidence and prevention.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/history-record/controller.ts` and `apps/mobile/src/components/mobile-screens.tsx` -- make create/reconnect state observable, accessible, and retryable at the point of action.
- [x] `apps/mobile/src/components/atlas-reveal.tsx`, `apps/mobile/src/app/manual-journey.tsx`, and supporting provider/form code -- preflight manual entry against the private record while preserving the existing race-safe save boundary and Atlas return context.
- [x] `apps/mobile/src/import-record/repository.ts` -- correct failed-open retry behavior only if a focused regression proves the cached connection promise blocks recovery.
- [x] `apps/mobile/src/components/__tests__/history-record-controller.test.ts`, `privacy-settings-screen.test.tsx`, and the relevant Atlas/manual test -- cover pending, failure, retry, blocked entry, and successful transition.
- [x] `docs/development/error-playbook.md` and `docs/project-state.md` -- record the device finding, verification limits, correction, and remaining device confirmation.

**Acceptance Criteria:**
- Given a deleted or disconnected private record, when the owner chooses manual entry, then they receive a direct create/reconnect path before entering destination data and retain their Atlas context after it succeeds.
- Given a lifecycle action is underway, when the owner taps it again, then the action is visibly pending and not repeated.
- Given local-record creation fails, when the owner remains on Settings, then they see a safe retry message beside the action and the app never reports a connected record.
- Given a connected record, when the owner begins a manual journey, then the existing form and overlap review operate normally; a lifecycle change during the flow is still refused at the repository boundary.
- Given an initial local-database open failure, when the owner retries after the underlying condition clears, then the retry is not blocked solely by a cached rejected open attempt.

## Implementation Notes

- Existing native open recovery already clears a rejected database promise; the added regression proves that behavior rather than adding a duplicate retry mechanism.
- Review corrections add a lifecycle generation guard, cancellable recovery intent, direct-route preflight, and visible Settings feedback. The persistence-level lifecycle checks remain unchanged as the final race boundary.

## Spec Change Log

## Review Triage Log

- `medium / patch` — a stale lifecycle refresh could overwrite an in-flight reconnect or newer lifecycle state; a generation guard now discards obsolete reads and is covered by regression.
- `low / false` — an unavailable status read initially retains the conservative deleted snapshot, but it also renders the explicit status-read failure; it does not falsely report successful local storage.
- `medium / patch` — deletion previously hid the action with no visible pending state; Settings now renders persistent deletion progress and disables cancellation while deleting.
- `low / patch` — an external connected transition previously hid the recovery panel without resolving intent; it now presents an explicit continue action that preserves the saved context.
- `low / patch` — Atlas-context restoration lacked direct regression evidence; recovery saves the received exploration object only when continuing to the manual route, while existing Atlas context tests cover the object shape.
- `medium / patch` — the recovery panel lacked failure/retry UI coverage; focused provider tests now assert failure remains in place, exposes safe retry copy, and never navigates.
- `low / patch` — pending-state coverage omitted disconnect/delete; controller tests now assert each pending transition and serialized lifecycle action.
- `false` — the unrelated performance review was pre-existing user work explicitly preserved outside this recovery change; it appeared only because the required audit diff included untracked files.
- `medium / patch` — refresh could clear pending state after a lifecycle action began; fixed by the same lifecycle generation guard.
- `medium / patch` — canceling recovery could allow late reconnect navigation; a request token now invalidates the continuation.
- `medium / patch` — direct manual-route navigation bypassed Atlas preflight; the route now withholds destination inputs until the record is connected.
- `low / patch` — the new restricted Atlas CTA lacked a regression; its callback/context is now asserted.
- `low / patch` — failed recovery could have navigated despite a false result; regression verifies it remains recoverable with no push.
- `medium / patch` — Settings did not place lifecycle failure feedback beside the controls; it now renders action-adjacent safe feedback and is covered by Settings tests.

## Design Notes

The available local record is the prerequisite for saving a private assertion, not proof that photos were imported. Keep that distinction in owner copy: creating it establishes local storage; it does not scan or alter their original library.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand history-record-controller privacy-settings-screen manual-journey atlas-reveal` -- expected: lifecycle and manual-entry regressions pass.
- `npm --prefix apps/mobile run check` -- expected: mobile type check, lint, and complete Jest suite pass.
- `npm run check` -- expected: repository foundation checks pass.

**Manual checks:**
- On the connected Android device, start from a deleted/disconnected record, confirm in-place progress and failure/retry feedback, then create/reconnect and complete a manual journey without photos being imported.
