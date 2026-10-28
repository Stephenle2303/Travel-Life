---
title: 'Fix mobile CI privacy-deletion assertion'
type: 'bugfix'
created: '2026-10-28'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** GitHub Actions fails in the mobile Jest suite because the privacy-settings screen regression still expects the former local-only deletion copy after MLP scope removal changed the provider's deletion outcome to confirmed remote-link removal.

**Approach:** Align the stale screen assertion with the current closed `complete` deletion outcome while preserving the test's distinct disconnect-versus-delete contract.

</frozen-after-approval>

## Implementation Notes

- Diagnostic delivery map: not applicable. This is a test-only correction; it does not alter a production runtime boundary, diagnostic classification, data handling, or owner-visible behavior.
- Evidence: GitHub Actions run `40620856260` failed `apps/mobile/src/components/__tests__/privacy-settings-screen.test.tsx:154` (one failed test of 604). The provider intentionally returns `complete` after hosted sharing was deferred, and `HistoryRecordController` therefore renders the existing confirmed-removal copy.
- Scope: update only the stale assertion, retain controller coverage for the legacy no-removal-callback outcome, and run the targeted regression plus the CI-equivalent mobile checks available on this host.
- Updated the screen regression to assert the exact existing `complete` outcome. The assertion now guards remote-link-removal confirmation, original-photo preservation, and saved-recipient-copy limitation without changing any production source.
- Review follow-up: added controller coverage proving the `complete` callback settles before local purge and retains the exact limited-removal wording.

## Review Triage Log

- **defer — medium:** M5.3/M5.4 still name deferred hosted snapshot/viewer work despite the current sharing correction. The planning overview says that older wording is superseded, but the acceptance criteria and backlog remain internally inconsistent; this is outside a mobile CI assertion repair.
- **defer — maybe-false:** M6.2-M6.5 and M7.3 need future-scope clarification for withdrawal/local-cache retention, choosing among pending contributions, recovery, and offline revision activation. The reviewed text is a concurrently edited P0-next plan, so its owner must decide whether the stated omissions are intentional before a change is made.
- **defer — maybe-false:** The claimed M9.1 dependency conflict needs a planning-owner decision: the current document explicitly makes M9 depend on M8's shared connection boundary, so the reviewer claim is not established from the cited text alone.
- **patched — low:** The original screen test asserted only copy. Controller coverage now proves the `complete` remote-removal path runs before local purge and retains the owner-facing limitation.
