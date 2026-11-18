# Verification and operational acceptance

## Evidence and commands

Run root `npm run check`; affected mobile Jest suites from apps/mobile with
`--runInBand --cacheDirectory .jest-cache-codex`; mobile typecheck/lint; actual
Postgres transaction/RLS tests and synthetic HTTP/object tests for new server actions.
No missing tool or unexecuted device check is recorded as passing.

Acceptance matrix references all 76 AC IDs in the canonical M6-M9 backlog. Attach
per-story observed results to its delivery record. Required milestone scenarios:

1. Existing local data includes manual journeys, corrections, privacy policies and
   Replay/audio. Before/after migration and restore match semantic snapshots.
2. Two devices contribute complementary and identical evidence; all input orders,
   retries and restart points yield the same normalized aggregate/support counts.
3. Offline conflicting corrections preserve proposals; resolution converges without
   remapping to unrelated trips. A new inferred addition cannot alter reviewed facts.
4. Source phone offline; second phone resolves selected private derivatives/audio
   and exact Replay. Missing media/audio is explicit. Revoke during render blocks export.
5. Account A cannot read/write B's rows, jobs, objects or receipts; anonymous tokens
   are denied. Expired/revoked sessions and account/source fences reject queued work.
6. Deletion races with upload/worker/restore and delayed reconnection; no resurrection.
   Partial cleanup retries and pending retention state remain inspectable.
7. Force every boundary's network/schema/auth/storage/quota/decode/unknown-outcome
   failures; assert fixed classification and correlation, no private sentinels in UI/logs.

Runtime-neutral engine changes require evals/README.md, equivalence/permutation and
correction preservation fixtures. Synthetic checks prove contracts, not population
accuracy; no new model call or fabricated human labels are authorized.

## Diagnostic collection

Each delivery record refines its operation/stage/reason-to-file/function map before
coding. Account operations use `ACCOUNT_REQUEST`, `ACCOUNT_VERIFY`, `ACCOUNT_RESTORE`,
`ACCOUNT_REFRESH`, `ACCOUNT_SIGN_OUT`, with stages for configuration, input, provider,
secure read/write/delete and session validation. Sync operations map receipt,
fence, schema, stage, activate and purge separately. Fixed lifecycle outcomes cover
cancelled/stale/already-running/unavailable states. No raw provider/native exception.

For Android verify current com.anonymous.travellife build and Metro revision, then
filter `[Travel Life diagnostic]` and account/sync operation families from the current
process. For iOS use the matching build's structured console filter. Backend captures
only the same closed fields with validated action correlation; no request-body logs.
One local operation correlation is shared across its layers, never a token/entity ID.
Retain raw/private reproduction material only in ignored private directories.

## Enablement gates

Before a live test, record intended project/region, exact payload classes and consent,
schema/migration version, private object bucket/policies, backup/retention deadlines,
max bytes/jobs, verified log redaction, SMTP sender/template and server rate limits.
Default planned cleanup is active content within 24 hours after fencing; backups
expire within the provider's documented configured window. No guaranteed backup
deadline may be displayed before actual service configuration proves it.

Account configuration is separate from history/media sync configuration. Default
unconfigured services are disabled. Test with synthetic accounts/media first; actual
private libraries need the specified destination and payload authorization.
No public share route or remote media-publication gate is enabled by account work.

## Current official references

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/reference/javascript/auth-signout
- https://supabase.com/docs/guides/auth/auth-smtp
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://developers.google.com/photos/overview/about
- https://developers.google.com/photos/picker/guides/media-items
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

Auth research on 2026-10-28 verified SDK local signout semantics, six-to-ten-digit
configurable OTP, temporary access JWT validity after revocation, native SecureStore
size constraints and SMTP restrictions. Installed SDK versions are retained rather
than upgraded to the latest documentation examples.
