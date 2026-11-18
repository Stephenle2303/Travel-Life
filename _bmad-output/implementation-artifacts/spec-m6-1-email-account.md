---
title: M6.1 - Enter my account with an email code
type: feature
created: 2026-10-28
status: in-progress
route: dispatch
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
review_loop_iteration: 0
context:
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/sync-contract.md'
  - '{project-root}/docs/development/diagnostic-implementation-policy.md'
---

<frozen-after-approval reason="Owner authorized detailed spec and M6-M7 implementation on 2026-10-28">

## Intent

Enable optional email OTP account entry from Settings, restoring verified native
sessions without modifying existing local history. Local use requires no account.
This is M6.1's implementation; actual provider/device acceptance remains explicit.

## Boundaries and constraints

Use installed Supabase JS 2.95.3 and SecureStore. A dedicated account singleton/key
must never reuse anonymous AI/share auth. Account screen claims signed in only,
never backed up/synced. No history/media upload, deployment or new dependency.
M6.2+ integration may use the exported account service but no account cache exists yet.
Native credentials use bounded generation/chunk secure storage; web is memory-only.
Prevent late verification/refresh from restoring identity after local signout or
disposal. Local signout scope is explicit; persist access-block before revocation
and clear safely even on network failure. Keep failures classified and redacted.

## I/O and edge-case matrix

| Scenario | Input/state | Expected behavior | Recovery |
| --- | --- | --- | --- |
| Optional account | Local user opens app | Existing local entry untouched; Settings offers Account | Return to local Atlas |
| Request code | Valid new/returning email | Generic acknowledgement, no session until verify | Resend with server limits |
| Verify | Configured 6-10 digit code | Verified non-anonymous identity, secure restore | Wrong/expired fixed copy |
| Restart | Complete protected session | Restore and refresh natively | Partial/corrupt storage blocked |
| Signout/race | Pending verification, refresh or network failure | Identity becomes inaccessible immediately; stale persistence cannot revive it | Safe explicit retry |
| Disabled | Account config absent | Honest unavailable state; no request | Keep local use |
| Provider failure | 429, invalid code, raw secret-bearing error | Fixed distinct reason/stage, no provider message/token/email | Retry where appropriate |

</frozen-after-approval>

## Code map

- `apps/mobile/src/account/` is new; account SDK client/controller/secure storage live here.
- `apps/mobile/src/ai/session.ts` and `src/share/owner-service.ts` retain anonymous clients; do not refactor them.
- `apps/mobile/src/components/ui.tsx` supplies Living Atlas panels/actions and reduced motion.
- `apps/mobile/src/components/mobile-screens.tsx` PrivacySettingsScreen adds one account route action.
- `apps/mobile/src/navigation/app-contract.ts`, `src/app/account.tsx` expose the route.
- `apps/mobile/src/diagnostics/app-diagnostics.ts` remains sole console boundary; extend closed unions only.

## Tasks and acceptance

- [x] `src/account/` implement isolated SDK adapter, generation-fenced lifecycle/controller and atomic bounded SecureStore adapter; one AppState refresh subscription and processLock.
- [x] `src/components/account-screen.tsx`, `src/app/account.tsx`, navigation and Settings implement accessible email/code/status/signout flow; use actual fixed state and keyboard-safe layout.
- [x] `.env.example`, mobile README document explicit account enablement config, OTP template/rate/SMTP and physical acceptance steps; never send OTP in host tests.
- [x] `src/components/__tests__/account*.test.ts?(x)` cover every matrix row, storage faults/races and redaction; start with meaningful failing tests.
- [ ] Root check, affected mobile Jest, typecheck/lint and diff validation pass; inspect unrelated dirty files without changing them.

Binding ACs: AC-M6.1-1 through AC-M6.1-4. Account A/B API isolation beyond existing
resources is enforced when sync API exists; this slice must prove credential/key
isolation and reject anonymous identity. Real email/restart/refresh Android/iOS
evidence is required before closing AC-M6.1-4.

## Diagnostic map before coding

All events retain closed fields, one action correlation, no email/code/token/raw errors.

| Operation | Stage/source boundary | Fixed categories | Outcome/retry |
| --- | --- | --- | --- |
| ACCOUNT_REQUEST | ACCOUNT_CONFIG / account service config | ACCOUNT_DISABLED | skipped/no |
| ACCOUNT_REQUEST | ACCOUNT_INPUT / controller validation | ACCOUNT_INPUT | unchanged/no |
| ACCOUNT_REQUEST | ACCOUNT_PROVIDER / signInWithOtp | ACCOUNT_RATE_LIMIT, ACCOUNT_NETWORK, ACCOUNT_PROVIDER, UNKNOWN | failed or blocked/typed |
| ACCOUNT_VERIFY | ACCOUNT_PROVIDER / verifyOtp + verified user validation | ACCOUNT_CODE, ACCOUNT_NETWORK, ACCOUNT_SESSION, ACCOUNT_PROVIDER | unchanged or failed/typed |
| ACCOUNT_RESTORE | ACCOUNT_SECURE_READ / storage/getSession | ACCOUNT_STORAGE, ACCOUNT_SESSION | blocked/retry |
| ACCOUNT_VERIFY, ACCOUNT_REFRESH | ACCOUNT_SECURE_WRITE / storage/setSession | ACCOUNT_STORAGE | blocked/retry |
| ACCOUNT_SIGN_OUT | ACCOUNT_SECURE_DELETE / block marker + clear | ACCOUNT_STORAGE | blocked/retry |
| ACCOUNT_SIGN_OUT | ACCOUNT_PROVIDER / signOut local | ACCOUNT_NETWORK, ACCOUNT_PROVIDER | paused/retry |
| account lifecycle | ACCOUNT_SESSION / generation guards | SKIPPED, ALREADY_RUNNING, COMPLETE | skipped, unchanged or complete/no |

Collection: current Android package `com.anonymous.travellife`, matching Metro/build,
filter `[Travel Life diagnostic]` and ACCOUNT operation with its local correlation;
iOS equivalent current app console. Logs contain fixed enums only. Tests inject
synthetic private sentinels and inspect emitted event/UI payloads.

## Verification

From apps/mobile: focused Jest with `--runInBand --cacheDirectory .jest-cache-codex`,
`npm run typecheck`, `npm run lint`; root `npm run check`. No SDK live OTP call is
authorized as a test. Record provider/device limits honestly.

## Implementation notes

Recovery audit on 2026-10-29 found implementation and matrix coverage present in
the retained working tree. Full mobile verification passed 87 suites/753 tests,
plus 99 SQLite tests, typecheck and lint before the final M7 integration fixes.
Protected storage, provider faults, signout/late work, optional/disabled UI and
session-denial cases have synthetic coverage. These task checks describe host
implementation only; AC-M6.1-4 remains open for actual email delivery, restart,
refresh/expiry and Android/iOS acceptance. No OTP was sent during this audit.

## Spec change log

## Review triage log

### M6.1 core hardening evidence (2026-10-28)

Source lookup refinement: controller.ts run/requestCode/verifyCode/restore/getVerifiedSession/foreground owns validation, closed classification and action correlation. auth-adapter.ts getSession/verifyOtp/persist owns SDK memory generation, protected read/write and provider boundary wrappers. storage.ts owns manifest/chunk validation, access-block and atomic generation activation. service.ts owns isolated client, one AppState listener, native protected credentials, memory-only browser adapter and account-only transport sanitizer. AccountProviderError and AccountStorageError preserve their exact fixed stage without exposing native text.

Reality-review triage: canceled verification and restore now fence SDK memory and protected persistence, including a failed fresh verification following cancellation. Null/anonymous/changed-owner refresh locks identity. Post-commit obsolete chunk cleanup no longer falsely rejects a committed session. Unreachable protected chunks can remain after native cleanup failure; no guaranteed purge claim is made. Disposal fences storage as well as adapter generation. Remote signout failure cannot expose identity and cleanup is attempted even when provider throws.

Installed SDK inspection: auth-js fetch.ts logs raw rejected transport errors. createAccountFetch converts transport rejection to a fixed 503 before that console boundary; a real installed SDK test injects a synthetic private-bearing network exception and proves retryable classification with no console.error. SDK timers/storage/subscribers are not enabled. processLock is retained through a wrapper with negative acquisition timeout because installed 2.95.3 positive-timeout timers emit delayed warnings even after successful acquisition. Pending locks remain pending; no timeout/rollback claim is made.

RED: adapter cancellation and late restore tests initially failed because the invalidate boundary did not exist. GREEN: account-auth-adapter, account-controller and account-storage suites pass 24 tests (focused Jest --runInBand --cacheDirectory .jest-cache-codex), including real adapter/controller cancel-complete-reopen, failed retry after cancellation, private sentinel redaction and exact secure-write event/correlation. Mobile typecheck passed; mobile lint passed. Parent owns final combined/root checks and UI tests; those results are not inferred here.

Collection recipe: verify the current installed com.anonymous.travellife build and matching Metro source before owner action. Android current process console: filter '[Travel Life diagnostic]' plus ACCOUNT_REQUEST/VERIFY/RESTORE/REFRESH/SIGN_OUT; follow the locally generated correlation to its terminal stage and the source lookup above. iOS uses the matching build console. Retain only fixed structured event fields; keep any raw local reproduction outside Git and do not export private logs. Missing transport/current-build correlation is a collection gap, not evidence of product cause.

Open acceptance: no live OTP was sent and no hosted configuration/deployment was performed. Actual SMTP/template/rate behavior, native secure restart/refresh/signout and accessible physical layouts on Android and iOS remain unobserved. AC-M6.1-4 remains open. These core host tests do not establish account sync, backup or whole-M6 acceptance.
