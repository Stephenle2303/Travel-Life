---
title: M6.2-M6.5 private account history transfer
status: in-progress
created: 2026-10-28
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
context:
  - ../specs/spec-private-multi-source-history/SPEC.md
  - ../specs/spec-private-multi-source-history/sync-contract.md
---

# Consented history transfer and restore

The owner authorized M6-M7 implementation and existing project
fgmcnzxhbrtvjhtafort, region ap-south-1, for synthetic validation. Preserve local
data and anonymous AI/share clients. No private library upload is part of tests.

## Diagnostic map before implementation

Confirmed long-reference repair (before code): action runtime-mvtlyklp-3 proves
REPLAY_ARRAY_ITEM_SIZE; actual reconstruction embeds evidence IDs into visit IDs
and visits into journey IDs, so direct committed refs validly exceed 10k. Keep full
semantic IDs/composition. New versioned replay-fragment wire rows split committed
JSON into at most 4096 ordered <=16384-code-unit pieces with shared record/revision/
timestamp. Preserve surrogate pairs; cap UTF-8 bytes before allocating/encoding
against existing64MiB transfer and10000-page quotas. SQL verifies complete exact
groups before activation, then collapses them into semantic replay storage so
existing source/media/journal readers retain authority. Worker/native also decode
before domain/restore; canonical output packs at network boundary. Fail malformed/
mixed/duplicate/missing groups HISTORY_SCHEMA, resource limits HISTORY_QUOTA at
HISTORY_EXPORT/HISTORY_SCHEMA/HISTORY_REBUILD/READ as appropriate, existing action
correlation only. Long mapping keys use worker SHA256+explicit SQL codec namespace,
retaining original IDs in memory for exact remap; existing literal mapping IDs stay
stable. No truncate/dedupe, no reconstruction policy or owner selection change.

Replay array narrowing (pre-change): runtime-mvtltn3h-3 proves the combined ARRAY
guard, not its cause. Split into closed ARRAY_TYPE/ARRAY_COUNT/ARRAY_ITEM_TYPE/
ARRAY_ITEM_SIZE/ARRAY_DUPLICATE stages. Keep type/count/item length/uniqueness
admission unchanged; no array contents, offending key, count or IDs logged. Inspect
writer construction and synthetic cases before deduplicating or broadening anything.
Parent's next precise category remains required if source cannot establish cause.

Array probe verification: 36 focused native export/contract tests and mobile
TypeScript pass; portable bundle regenerated. The source writer obtains distinct
evidence within each journey group but persists direct structural journey IDs.
`engine.ts` constructs visit IDs from all member evidence IDs and canonical-core.ts
constructs journey IDs from visit IDs; thus long legitimate refs are possible.
This source fact is not proof of the actual private row category. Parent collects
the fixed ARRAY suffix before changing the wire representation or any admission
limit. No source/private DB read or owner composition mutation occurred.

Replay validation narrowing (2026-10-29, pre-change): retry runtime-mvtln5pu-3
proves HISTORY_EXPORT_REPLAY_VALIDATE/HISTORY_SCHEMA after every earlier layout
passed. Current writer stores selection/exclusion/order/group arrays, versioned
direction, soundtrack and optional preparedArtifact cache. No private row was read.
Portable normalization removes only the documented cache/local audio handle;
unknown fields remain rejected. Before changing compatibility, distinguish closed
HISTORY_EXPORT_REPLAY_JSON/FIELDS/ARRAYS/DIRECTION/AUDIO/SIZE/ROW failure stages
using typed content-free validator categories. Existing HISTORY_SCHEMA reason and
same action correlation remain; no offending key/value/length/URI is emitted.
Synthetic writer-shaped compositions and native classification/redaction regressions
must pass. Source alone does not prove the actual private row's mismatch; parent
may collect one precise category. Any required server/schema limit change requires
an owning migration/deploy decision, never silently stripping owner choices.

Narrowing verification: both current committed writer shape and an exact synthetic
custom soundtrack composition pass portable export without selection/order/scope
loss. Fixed category failure/redaction tests plus existing contract tests pass
32/32; mobile TypeScript passes and portable bundle regenerated/freshness checked.
The 100k string bound is shared by current SQL, so expanding it locally would not
repair transfer. Legacy `music` is not emitted by the inspected current persistence
writer. Neither possibility is assumed to explain the private row. No grammar,
schema, selection or soundtrack behavior changed; parent needs one exact-category
device retry. Generated backend bundle changed only for typed diagnostic categories
and does not require service deployment for the native reproduction.

2026-10-29 owner-device initial export failure (before instrumentation): current
action runtime-mvtky4by-4q reaches HISTORY_EXPORT then HISTORY_STORAGE; actual cause
is unknown. `history-native.ts::exportLocalHistory/open` will map fixed stages
HISTORY_EXPORT_OPEN/SCHEMA/TRANSACTION/LIFECYCLE, per-kind HISTORY_EXPORT_<KIND>_READ
and _VALIDATE, and HISTORY_EXPORT_CLOSE. Closed reasons distinguish admitted
schema/DTO incompatibility, DATABASE_BUSY, NATIVE_HANDLE, TRANSACTION, CONSTRAINT,
ROW_LIMIT and unknown HISTORY_STORAGE; disconnected lifecycle is HISTORY_FENCED.
Native errors are classified in memory only. Pass existing action stage callback
so source starts/final failure share its existing correlation; emit no row/column/
table names, SQL, IDs, paths, values or native message. Preserve original failure
if closing also fails. Synthetic schema/read/validation/close faults and actual
SQLite fixtures prove classification/redaction only. Parent reproduces one Save
in the matching current Android process, filters exact correlation/stage, and keeps
raw/private logs ignored. No data clearing or speculative schema repair is allowed.

Export probe verification: native export now starts each closed source stage via
the existing action callback and throws a content-free HistorySyncError preserving
that boundary through lease cleanup and the service diagnostic. Synthetic tests
force all eight layout reads, invalid evidence DTO, disconnected lifecycle,
open/schema/read/close failure, busy/handle/transaction/constraint/bridge categories
and secondary-close preservation. Two focused suites pass 26 tests; the actual
SQLite semantic export/replica roundtrip passes 1 targeted case. Mobile TypeScript
and focused ESLint pass. No private DB query, source upload, schema change or app
data reset was performed for investigation. Physical cause remains unknown pending
parent's single fresh-build Save retry with these precise closed diagnostics.

Curl compatibility correction (pre-change): hosted management role also rejects
function-level `SET http.*`. Replace them with checked extension curl setters after
the logging guard and before Vault lookup. Failed initial reset/setter is fixed
`scheduler-config-blocked` without HTTP. A failed post-request reset is
`scheduler-request-unknown`; preserve that unknown acknowledgement rather than
claiming no request occurred. Successful and exceptional requests attempt reset
under the same suppressed logging settings. Reset restores extension defaults,
not an arbitrary caller's curl options; only private cron functions can invoke it.
Never emit raw errors, options, credentials or response content.

2026-10-29 synchronous scheduler alternate (pre-implementation): replace the local
pg_net draft because its hosted PUBLIC request-queue ACL is unresolved. No queued
headers/capabilities may be used. Two private fixed no-argument SECURITY DEFINER
functions use `extensions.http(extensions.http_request)` with runtime Vault reads,
fixed endpoints/names, empty search_path, client execution revoked and bounded curl
connect/total timeouts. Cron stores only fixed function calls. Before secret reads
or HTTP, suppress and verify both client/server DEBUG2 logging; unsafe logging is
`scheduler-logging-blocked`. Missing/ambiguous capabilities are
`scheduler-config-blocked`; connection/extension exceptions remain
`scheduler-request-unknown`; non-2xx is `scheduler-request-unacknowledged`; 2xx is
`scheduler-request-acknowledged` only, not proof of purge completion. These fixed
return strings are the scheduler diagnostic boundary; never persist or emit HTTP
headers/body, SQLERRM, capabilities or raw exception context. Match cron job/run
and Edge version, then inspect only the closed Edge operation correlation/events
for actual cleanup outcome. Synthetic local HTTP mocks prove envelope, privileges,
timeouts and fixed failure/redaction; actual extension/service smoke stays parent
owned. No hosted change is authorized by this local implementation handoff.

Alternate implementation evidence: the local
`m6-m7-cleanup-scheduler-draft.sql` now supersedes its pg_net version. Its header
retains why pg_net was rejected; the prior text is recoverable in ignored review
storage. The two fixed `history_private.run_media_cleanup()` and
`run_account_cleanup()` functions revoke PUBLIC/anon/authenticated/service_role
execution and keep an empty search_path. Their client WARNING setting and runtime
guards precede Vault and HTTP; local curl settings enforce 5-second connection and
30-second total timeouts plus TLS peer/host verification. Only `response.status`
is selected. Fixed acknowledged/unacknowledged/unknown/config/logging results
contain no payload and never imply completed purge. The two cron commands contain
only calls to these functions. No function writes a request queue or response table.

Current signatures and timeout configuration were checked against
[Supabase http documentation](https://supabase.com/docs/guides/database/extensions/http),
[upstream SQL types/functions](https://github.com/pramsey/pgsql-http/blob/master/http--1.7.sql)
and [upstream implementation](https://github.com/pramsey/pgsql-http/blob/master/http.c),
which emits optional request headers at DEBUG2. Parent independently confirmed the
installed extensions schema/signatures. The synchronous alternate intentionally
leaves the unresolved pg_net ownership/ACL incident open and avoids that queue.

`pwsh -NoProfile -File scripts/test-private-history-postgres.ps1 -SchedulerSuite`
passed eight local synthetic fixture files. Updated mock HTTP asserts exact
method/endpoints, distinct runtime Vault capabilities, body `{}`, both timeout/TLS
settings and log suppression. Tests cover denied client execution, logging drift
before HTTP, absent/ambiguous/control-character capabilities, rotation, non-2xx,
hostile HTTP exception/response sentinels, fixed cron text and zero writes to an
intentionally PUBLIC pg_net queue. No real extension networking occurs inside the
network-disabled harness; parent owns hosted deployment and service smoke.

Hosted compatibility correction: parent could not create a function carrying
`SET log_min_messages` because the management postgres role lacks that privilege.
No jobs were created by that failed attempt. The draft now sets only client
WARNING; a pre-secret `current_setting('log_min_messages')` allowlist blocks unsafe
server thresholds rather than trying to change them. Parent observed server
WARNING. Synthetic tests use the harness's privileged session to switch server
DEBUG2 on and prove both fixed functions return `scheduler-logging-blocked` before
HTTP. SchedulerSuite passed eight files again after this correction. Earlier
wording about function-local server WARNING is superseded by this guarded approach.

Hosted curl compatibility correction: parent also observed function creation
denied for `SET http.curlopt_connecttimeout_ms`. All `SET http.*` clauses are now
removed. The draft requires the documented boolean-returning
`extensions.http_reset_curlopt()` and `http_set_curlopt(varchar,varchar)` APIs.
After the logging guard, before Vault, it resets defaults and checks each of four
explicit option setters: CONNECTTIMEOUT_MS 5000, TIMEOUT_MS 30000,
SSL_VERIFYPEER 1 and SSL_VERIFYHOST 2. Any false setup result prevents HTTP. It
resets defaults on configuration failure, success/non-2xx and caught exceptions;
post-request reset failure remains unknown acknowledgement. No options or response
content are serialized. SchedulerSuite passes eight files again, with false-reset/
setter admission and success/exception default-reset assertions added. Parent
confirmed the installed reset API and owns live creation/smoke. Earlier wording
about function-level curl settings is superseded by these checked extension calls.

2026-10-29 scheduler compatibility: the private-media cleanup and account-deletion
cleanup handlers must admit an empty body or a bounded exact empty JSON object
after their existing capability/origin checks. Invalid, nonempty, oversized or
malformed payloads remain blocked at MEDIA_AUTH/HISTORY_AUTH with MEDIA_SCHEMA/
HISTORY_SCHEMA; no cleanup RPC runs. Capability failures stay ACCOUNT_SESSION,
unknown queue/network outcomes remain unknown, and neither body nor secrets enter
logs. Validate both handlers with synthetic fault/redaction tests; a hosted cron
enqueue is not evidence of completed deletion. Collect only closed diagnostics
from the matching deployed function and synthetic scheduler run.

Scheduler compatibility implementation (2026-10-29): both handlers now share
`supabase/functions/_shared/cleanup-request.ts::emptyCleanupRequest`. The parser
admits absent/zero-byte bodies or a JSON empty object within a 64-byte UTF-8 bound,
including surrounding JSON whitespace. It rejects nonempty objects, arrays,
scalars, malformed/trailing JSON, invalid UTF-8, oversized chunks and stream faults.
Existing capability/origin checks precede parsing and every RPC. Rejection remains
the map's fixed schema/auth event; parsed data, capabilities and exceptions never
enter diagnostics. Byte overflow cancels its reader instead of buffering the rest.

Both `{}` regressions first reproduced HTTP 400. After correction, focused
`node --test tests/account-deletion-runtime.test.mjs tests/private-media-runtime.test.mjs`
passes 27/27, including absent-body compatibility, chunked valid JSON, bounded
cancellation, malformed input, capability/origin and synthetic secret/content
redaction. TypeScript of the two cleanup entry graphs passes with the installed
mobile compiler (`--allowJs --allowImportingTsExtensions --moduleResolution bundler
--module esnext --target es2022 --lib 'es2023,dom' --skipLibCheck`). These are host
contract checks only; no migration, function deployment or gate changed. Actual
pg_net execution and completed service deletion remain operational acceptance gaps.

| Boundary/source | Operation/stage | Fixed failure | Retry/outcome |
| --- | --- | --- | --- |
| history transport/config | HISTORY_TRANSFER/ACCOUNT_CONFIG | disabled | skipped/no |
| typed export/validation | HISTORY_TRANSFER/HISTORY_SCHEMA | invalid-schema, unsupported | blocked/no |
| native snapshot read | HISTORY_TRANSFER/HISTORY_EXPORT | storage, lifecycle | failed/typed |
| authenticated RPC/live session | HISTORY_TRANSFER/HISTORY_AUTH | session-required, revoked | blocked/no |
| consent/source RPC | HISTORY_TRANSFER/HISTORY_CONSENT | consent-missing, stale | blocked/no |
| snapshot page RPC | HISTORY_TRANSFER/HISTORY_STAGE | quota, conflict, network | failed or unknown-write/typed |
| receipt/activation RPC | HISTORY_TRANSFER/HISTORY_ACK | stale, conflict, unknown | unchanged/reconcile |
| replica staging/activation | HISTORY_TRANSFER/HISTORY_RESTORE | schema, storage, stale | previous record retained/retry |
| source/account fence | HISTORY_TRANSFER/HISTORY_DELETE | access, conflict, cleanup-pending | blocked/retry |

Only fixed values, never SQL, owner/session/source IDs, evidence or payloads enter
diagnostics. Native faults use the mobile sole boundary; server SQL raises only
fixed categories and does not serialize provider payloads. Collect current
com.anonymous.travellife [Travel Life diagnostic] HISTORY_TRANSFER events by local
correlation; service-side testing uses synthetic transaction assertions and returns
only pass counts. Add exact classifications/redaction tests before enablement.

## Acceptance

M6.2-M6.5 ACs in epics-multi-source.md remain binding. Initial snapshot, pending
contributions and merged aggregates are different authority states. No full SQLite
copy, local database clearing or silent data ownership transfer is allowed.

## Implementation and verification evidence

In progress. Record deployed migration versions, SQL isolation/fence/receipt test
results and native transfer/restore tests here. Physical and email acceptance remain open.

### Replica pointer commit fence (before implementation)

HISTORY_TRANSFER/HISTORY_RESTORE: commit owner replica pointer and source-scope
signature in one SQLite transaction after fresh authority validation. A stale action
is HISTORY_FENCED/skipped; known transaction storage failure is HISTORY_STORAGE/failed;
unknown failures stay UNKNOWN at the known boundary. If sign-out occurs after commit,
remove only the pointer for that exact staged database, never a newer pointer. Before
commit, failure preserves the prior pointer and scope together. Collect fixed HISTORY_RESTORE
events by local correlation and test rollback on injected scope-write failure,
sign-out during write, and delayed cleanup versus a newer pointer in synthetic SQLite.

Synthetic SQLite tests verify rollback on scope failure or an in-transaction fence,
matching-only cleanup, and fixed storage error redaction. The shared classifier now
distinguishes contract schema, known storage, and unknown errors; no owner-device or
full restore diagnostic collection has been performed. Other fallible restore stages
still require boundary-specific diagnostics before enablement.

Legacy or interrupted pointer writes without an accompanying scope signature are
not selectable. `openAccount` retains its existing fixed access failure and asks
for restore; synthetic SQLite must prove the orphan cannot be loaded without
deleting its underlying replica database.

Status response boundary (HISTORY_TRANSFER/HISTORY_SCHEMA): validate source IDs,
states and generation values, plus optional aggregate identity/revision/page count,
before changing visible state or selecting a replica. Malformed data maps to fixed
HISTORY_SCHEMA; previous state stays authoritative. Verify malformed responses with
synthetic fields and redaction; do not log the response body.
Focused tests cover valid status, malformed identities/states, duplicate sources,
invalid aggregate page counts, redaction and 101 retained inactive sources. More
complete server semantic validation remains an outstanding integration gate.

Status refresh lifecycle (HISTORY_TRANSFER/HISTORY_AUTH and HISTORY_RESTORE):
keep the fetched status local until replica-scope reads and invalidation settle,
then recheck the action generation immediately before publishing shared status.
A sign-out or owner switch yields HISTORY_FENCED/skipped; it must not install a
previous owner's status. Synthetic held-scope tests cover this ordering and redaction.
The synthetic held-promise test verifies the publication helper; integration and
owner-device sign-out are still required to establish the entire refresh lifecycle.

Device registration lifecycle (HISTORY_TRANSFER/HISTORY_STAGE/HISTORY_EXPORT):
recheck the owning action before and after registration and before export, and
before persisting a transfer checkpoint. A changed session is HISTORY_FENCED and
must not start a later boundary or persist a new job. Registration may already
have completed remotely; its server installation identity is idempotent on retry.
Verify delayed installation, registration and checkpoint paths with synthetic tests;
this does not prove cancellation of a request already in flight. Synthetic helper
tests cover stale-before-checkpoint and a delayed registration before export; full
service/device integration remains open.

Token acquisition fence (HISTORY_TRANSFER/HISTORY_AUTH): bind every request to
the owner and action generation captured at action start. Verify both after the
async session lookup and immediately before fetch. A mismatched owner or stale
action produces HISTORY_FENCED/skipped, with no request or private logging.
Cover held session lookup, owner mismatch and stale action on both RPC and worker.
Already-sent requests remain subject to server-side session validation.
Synthetic tests verify an owner mismatch for history RPC and sign-out while the
worker token lookup is held; both avoid fetch. Device-level testing remains open.

### Observed session denial fence (before continuation implementation)

`controller.ts` provider classification maps installed SDK `AuthSessionMissingError`
and explicit invalid/expired/revoked token or deleted/banned user codes to
ACCOUNT_SESSION. At ACCOUNT_REFRESH/ACCOUNT_SESSION, observed denial immediately
locks the local owner, invalidates adapter work and persists the secure access block.
Storage-block failure is ACCOUNT_STORAGE at ACCOUNT_SECURE_DELETE, blocked, with
the same action correlation; no provider payload enters diagnostics. Ordinary
retryable network failures keep already unlocked offline history readable.
History API ACCOUNT_SESSION responses must invoke the same local fence before
returning their fixed failure. Test live-user and refresh denial, delayed concurrent
work, durable block failure and synthetic private-sentinel redaction. Collect the
matching app process ACCOUNT_REFRESH and HISTORY_TRANSFER action events as above;
these host tests do not establish actual provider revocation on a physical device.

Session/consent continuation evidence: the local account-controls SQL draft and
rollback fixture pass alongside the six pre-existing account/media/continuity SQL
fixtures using the disposable PostgreSQL harness. Session inventory is bounded
and owner scoped; revocation persists both the application fence and Auth not_after;
consent expectedRevision rejects stale reenabling and receipts replay immutably.
Settings uses the existing Trust panel pattern with a session timestamp, explicit
revocation confirmation and separate withdrawal copy. Contract/UI tests were RED
before implementation and pass afterwards; mobile typecheck/lint pass. Full current
tree checks passed 79 mobile suites/733 tests, 99 SQLite tests and root86 tests.
These counts precede later M7 work and are not final acceptance or hosted migration
proof. No physical session/refresh/layout or account deletion completion is claimed.

### Restore stage refinement (before continuation implementation)

`historyService.restore` uses HISTORY_TRANSFER with HISTORY_AUTH for initial status,
HISTORY_PULL for bounded schema-validated pages, HISTORY_REPLICA_STAGE for insertion
into the new independent database, HISTORY_REBUILD for canonical reconstruction,
HISTORY_READ for the durable reveal, HISTORY_AUTHORITY for current-server comparison,
and HISTORY_POINTER for atomic pointer/scope commit. A current-action fence surrounds
each awaited boundary; stale actions stop before starting the next stage. Transport
keeps its fixed typed categories; existing native schema/busy/transaction/remap
classifications are preserved in memory, with UNKNOWN at the exact known stage
when no category is proven. Diagnostics keep one action correlation and never SQL,
native exceptions, snapshot IDs or source data. Inject failures and stale work at
each boundary; verify pointer commit is never reached on partial restore. The
collection recipe above filters these exact stages in the current app process.

Continuation evidence (2026-10-28): provider-denial, secure-block and history API
regressions were RED before the fix. Four focused account suites passed 35 tests;
the additional six restore stage/fence regressions passed (29 tests across the
controller and service suites). Mobile TypeScript and lint passed; TypeScript was
rerun after removing a redundant narrowed-union comparison. No OTP, remote mutation
or device validation was performed. The service/controller now share local denial
fencing; server session inventory/revocation UI, complete credential deletion and
physical acceptance remain open, not implied by these regressions.

### Remaining account controls: source map before implementation

Keep this as the M6 delivery record. Implement the remaining account/session and
consent controls after the current M7 coordinator implementation returns ownership.
Use the Settings/Trust panel pattern, with one explicit destructive-scope confirmation.

| Boundary/source | Operation/stage | Fixed category and outcome |
| --- | --- | --- |
| history-service session list / owner-only SQL | HISTORY_TRANSFER/HISTORY_SESSION_LIST | ACCOUNT_SESSION blocked; HISTORY_SCHEMA blocked; network unknown |
| durable revoke operation / session SQL | HISTORY_TRANSFER/HISTORY_SESSION_REVOKE | session/generation denied blocked; immutable receipt conflict unchanged; unknown acknowledgement retained |
| versioned consent SQL / native control checkpoint | HISTORY_TRANSFER/HISTORY_CONSENT | stale expected account revision HISTORY_CONFLICT; prior consent unchanged; replay exact receipt first |
| deletion ticket protected persistence | HISTORY_TRANSFER/HISTORY_STAGE | ACCOUNT_STORAGE failed; no request before durable ticket; ticket is not a diagnostic correlation |
| account deletion request / SQL fence | HISTORY_TRANSFER/HISTORY_DELETE | ACCOUNT_REAUTH or ACCOUNT_SESSION blocked; unknown acknowledgement retains exact ticket and mutation |
| capability-only deletion receipt read | HISTORY_TRANSFER/HISTORY_DELETE_STATUS | invalid/unknown ticket returns the same fixed unavailable state; no owner/content existence oracle |
| server deletion cleanup and storage proof | HISTORY_TRANSFER/HISTORY_DELETE_CLEANUP | pending objects stay pending; cleanup failure unknown and retryable |
| server Auth identity purge / acknowledgement | HISTORY_TRANSFER/HISTORY_DELETE_AUTH | fixed provider/storage failure unknown; recheck a lost acknowledgement before completed |

Session inventory exposes only owner-scoped session UUID, timestamps and current
session state; never IPs, user-agent strings or tokens. Revocation advances the
application fence and expires the exact Auth session in one transaction; current
backend live-session checks then reject both stale requests and refresh eligibility.
Official references inspected on 2026-10-28:
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions),
[Auth Session.CheckValidity](https://github.com/supabase/auth/blob/master/internal/models/sessions.go).
The current Auth source checks `NotAfter` during validity evaluation. Local SQL
fixtures can prove the field/fence transaction; actual hosted refresh denial still
requires provider evidence.

Consent changes compare the current account revision under the owner lock and retain
the complete immutable request receipt. Legacy initial consent is accepted only at
revision zero; later changes require expectedRevision. Media cannot be enabled
without history consent. Withdrawing sync retains the disclosed readable history;
withdrawing media fences access and queues the existing private-object cleanup.

Deletion fences precede cleanup. Keep a minimal non-content owner tombstone outside
Auth foreign keys so removing the Auth identity cannot permit an old request to
recreate account data. Wait for proven media cleanup, then purge account metadata and
Auth identity idempotently. Display pending until both are acknowledged. A locally
generated 256-bit receipt capability is stored in protected native storage before
send; only its digest is retained server-side. Its separate bounded RPC returns
fixed pending/completed/unavailable state only, without owner IDs or data, including
after identity removal. Account B cannot enumerate or guess account A's receipt.
Signout and account switching never attach local history or publish private media.

All controls use closed events, one action correlation, precise stages and fixed
recovery copy. Never log session UUIDs, ticket capabilities, email, provider/native
messages or cleanup paths. Synthetic tests must force cross-owner, stale revision,
lost receipt, secure-storage failure, cleanup failure and Auth-delete acknowledgement
loss. Actual SQL runs use the isolated local PostgreSQL harness; provider/device
acceptance remains open until observed. No remote deployment is part of this phase.

### Account controls/deletion implementation evidence (2026-10-28)

- Local drafts `m6-account-controls-draft.sql` and `m6-account-deletion-draft.sql`
  add consent CAS, paged session inventory/revocation, fresh-auth deletion fencing,
  capability-only receipt status and leased metadata/Auth purge. All nine local
  PostgreSQL rollback fixture files passed with synthetic Auth/Storage contracts.
  The account fixture now conditionally expects pending for the full deletion draft;
  its stale-write fence checks remain required. A target session absent or owned by
  another account returns HISTORY_STALE; it does not invalidate a valid caller.
- `deletion.ts` keeps one protected 256-bit receipt and mutation across unknown
  acknowledgement; `deletion-service.ts` stores it with SecureStore before sending,
  locks owner access upon acceptance, clears account checkpoints and signs out.
  Receipt lookup remains available signed out. UI uses Settings/Trust with one
  explicit account deletion confirmation and honest offline/backup limitations.
- `account-deletion-cleanup.ts` waits for existing media cleanup proof, purges fixed
  account metadata tables, deletes the exact Auth identity and acknowledges only
  when SQL confirms identity absence. A missing Auth user reconciles lost deletion
  acknowledgement. Three synthetic runtime tests cover ordering, pending media,
  missing-user retry, lost ACK, caller-secret and hostile response redaction.
- Server diagnostics use existing closed HISTORY_SYNC logger stages
  HISTORY_DELETE_LEASE/CLEANUP/AUTH/ACK, with one local correlation. Native uses
  HISTORY_TRANSFER stages from the source map above. Collect the matching current
  JWT-gated function and app versions; retain content-free events only.
- `EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_CONTROLS_ENABLED=false` and server
  `ACCOUNT_DELETION_ENABLED` remain off. Deploy verified SQL before enabling.
  Schedule JWT+secret account cleanup alongside private-media cleanup; no scheduler
  or provider retention deadline is configured/claimed by local code. Real Auth
  refresh/deletion, receipt gateway, SMTP and Android/iOS acceptance remain open.
  Mobile typecheck/lint pass; five focused deletion orchestration/UI/service tests
  pass after fixing a test-only unstable snapshot mock. No remote mutation occurred.
