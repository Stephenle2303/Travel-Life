# Technology and repository reality review

Reviewed 2026-10-28 against the architecture spine, all three declared companions,
actual account implementation, installed package metadata and official Auth docs.
This is source/document inspection, not device or deployed acceptance.

## Verdict

Architecture technology choices are compatible with the repository. No dependency
upgrade is needed. Account implementation has an unresolved high-priority session
cancellation/restoration defect plus refresh-state and persistence-outcome gaps below.
Do not treat architecture compatibility as verified runtime delivery.

## Reality checks

- Installed versions independently read from node_modules package metadata:
  Expo 57.0.31, React Native 0.86.3, Supabase JS 2.95.3, SecureStore 57.0.4 and
  SQLite 57.0.4 match the spine. The installed Auth SDK exports processLock; its
  non-browser fallback is a no-op lock unless an explicit lock is supplied.
- Existing anonymous AI and sharing clients are distinct from the new account
  singleton. Its separate storage key and non-anonymous verified-email checks match
  AD-2. SDK memory-only persistence is a deliberate privacy wrapper; foreground
  refresh must be tested at the wrapper, not inferred from SDK auto-refresh examples.
- Existing reconstruction uses trip-detector-v1.1 and the newly extracted canonical
  modules. AD-5 correctly names existing v1.1 reality rather than creating a second
  cloud engine; equivalence tests remain the necessary behavior proof.
- Account replicas are planned separately from local storage and snapshot/journal
  revisions remain distinct in sync-contract.md. Exact DTO validation is assigned
  before migration; retained native table semantics cannot be established merely
  from these architecture documents.
- SecureStore chunking is justified because native storage may reject large strings.
  Web has an explicit memory-only path, so browser reload persistence is not promised.
  iOS credentials may survive reinstall; uninstall cannot be treated as signout.
- Email OTP request and verification are separate. Configure the template with
  `{{ .Token }}`; signInWithOtp otherwise sends the template's magic-link flow.
  Current provider configuration permits six to ten digits; client accepts that range.
- Explicit local signout matches the SDK API. An unexpired access JWT remains valid
  after refresh revocation, so live session/account fences in AD-2 are required for
  strict server denial. The five-minute signed-object URL residual in AD-11 is honest;
  it must not be claimed revoked immediately by a database fence.
- SMTP/team-address and rate-limit restrictions are documented as enablement gates.
  Current provider settings were not inspected by this reviewer and are not assumed.
- Drive selected-file grants and Photos selected-session/missing-GPS limits match the
  approved provider research. Their APIs/retention remain delivery-time checks.
  No autonomous Photos historical scan or recursive Drive folder grant is assumed.
- Supabase changelog HTML was inspected after the Markdown endpoint was unavailable.
  The October 2026 TLS cipher deprecation affects old unsupported TLS clients; this
  does not require a package upgrade for the declared modern Expo/native target, but
  real supported-device HTTPS tests remain required. No relevant Auth method removal
  was found in the inspected recent entries.

## Actionable implementation findings

### P1: Cancelled verification can sign back in on screen reopening

`controller.ts:141` advances the controller epoch and blocks protected storage when
verification is cancelled. It does not invalidate the adapter's generation or clear
the SDK's in-memory session. A late successful `auth-adapter.ts:43` verification sets
the SDK session and hydrated=true; its blocked persist is a silent no-op. Reopening
AccountScreen invokes restore, and `auth-adapter.ts:19-37` skips protected storage
when hydrated and returns that SDK session. The cancelled identity becomes signed in
again. This also matters after failed remote logout retaining SDK memory. Enforce the
local access fence on every adapter session read or explicitly invalidate/discard
SDK memory on cancellation/signout before a subsequent restore can use it. Test the
real adapter + controller together: cancel pending verify, finish it successfully,
then restore/reopen; owner must stay inaccessible until a fresh approved verification.

### P2: Empty refresh result retains the previously signed-in owner

`controller.ts:151-154` updates only on a valid returned session. A null session with
no error leaves the previous owner and signed-in state active indefinitely; a
cross-owner result is also not explicitly fenced. Distinguish an acknowledged absent
or changed session from temporary network failure. Lock old owner state and emit a
fixed session lifecycle outcome when the SDK no longer has that session. Test null,
anonymous, unverified and changed-owner refresh results, not just thrown failures.

### P2: Old-generation cleanup can report an already committed session as failed

`storage.ts:77-78` commits the new manifest before deleting previous chunks, but any
old-chunk deletion failure rejects setItem as AccountStorageError. The controller
then reports blocked storage although the new credential generation is already the
durable authority. Treat post-commit cleanup separately from failed persistence,
retain retryable cleanup evidence, and verify that restore reads the committed new
generation after injected cleanup failure. Do not retry credential exchange solely
because garbage collection failed after its durable acknowledgement.

## Required evidence before acceptance

Add adapter integration regressions for the findings above and raw-error redaction,
then run account suites, mobile typecheck/lint, root check and actual email/session
tests on Android/iOS. Existing controller-only mocks do not establish SDK memory
and native storage interaction. No runtime test was executed by this reviewer.

## Official sources

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/local-development/cli/config
- https://supabase.com/docs/reference/javascript/auth-signout
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/debugging/error-codes
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://supabase.com/changelog

The latest Expo reference currently describes SDK 58; installed SDK 57 package
metadata was separately checked. No automatic upgrade is proposed.
