---
title: Restore explicit Home navigation from Atlas
type: bugfix
created: 2026-10-30
status: done
route: oneshot
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
---

<frozen-after-approval>

## Intent

Restore a visible Home action from Atlas to the video landing page. Give that
explicit landing page a View my Atlas action that returns directly to the prior
Atlas context without repeating photo choice or changing the persisted onboarding
state. Keep automatic returning-user startup into Atlas, preserve the initial
fresh-user flow, account authority, privacy and all dirty unrelated changes.
No data reset, import, commit, push or deployment.

</frozen-after-approval>

## Implementation Notes

Investigation: `/` is an automatic entry resolver, so it cannot also be the
explicit Home destination. Add `/welcome` as a separate explicit route; keep `/`
unchanged. Atlas saves existing preview context on Home; explicit landing returns
with dismissTo `/history`. Reuse the existing video Welcome composition and allow
its primary label/behavior to reflect this return task. No intent gaps,
irreversibles, new dependency, storage or network behavior. Small oneshot repair
authorized by the owner's reported mismatch and continue request.

Diagnostic applicability before edits: navigation is synchronous through the
existing route contract; this change adds no fallible storage/native/network
boundary and deliberately performs no presentation write or permission request
when entering/leaving explicit landing. Existing ENTRY_READ/ENTRY_MIGRATE remain
unchanged for automatic startup. Verify route callbacks and no scan/presentation
mutation in the mounted roundtrip test. Collection recipe remains in the parent
onboarding delivery; user-visible device navigation acceptance remains separate.

Launcher recovery: setting UV_CACHE_DIR and TEMP/TMP to existing ignored writable
workspace directories allowed the exact prescribed command to render successfully;
no installed skill or workflow was changed.

Verified: regression first failed because Home was missing, then four affected
Jest suites passed54/54 after implementation and fixture typing correction.
Mobile typecheck/lint and root check136 plus eval smoke pass. Scoped whitespace
check passes. Read-only independent review found no actionable defects; actual
Expo Stack/native Back retention remains device acceptance, not proven by the
mounted route-switch harness. No new runtime fallible boundary/log payload or
private data operation is introduced. Existing dirty changes were preserved.

## Review Triage Log

- No actionable source findings. Native stack retention is an explicit unverified
  device boundary; mounted test proves route/CTA/context handoff and no new setup
  writes, not physical navigation acceptance.
