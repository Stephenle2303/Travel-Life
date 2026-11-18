---
title: M7 account aggregate worker and persistent mappings
status: in-review
route: dispatch
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
created: 2026-10-28
context:
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/sync-contract.md'
  - '{project-root}/docs/development/diagnostic-implementation-policy.md'
---

<frozen-after-approval>
## Intent

Extend the deployed M6 private history schema with persistent typed source identity
mappings and a server-authoritative merged aggregate. Run the SAME extracted native
canonical policy through the merge domain, then CAS-activate only current inputs.
User authorized existing Supabase fgmcnzxhbrtvjhtafort with synthetic validation.

## Boundaries

Own new M7 SQL migration(s), `supabase/functions/travel-life-history-merge/`, new
`supabase/functions/_shared/history-*` runtime/diagnostic helper files, new
`supabase/tests/private-history-aggregate.sql`, and necessary reproducible build
script for bundling the shared domain. Do not modify mobile source, auth code,
history-contract, M6 migration or its existing tests. Do not deploy; parent integrates
and deploys after reading diff. Preserve disabled public-media/publication gates.
Only introduce fields/actions needed for this worker; no broad private-table grants.

Canonical data comes from complete initial/pending snapshots for each active source.
Read source plan/page inputs through service-role-only functions after verifying the
caller owner/live session against auth.sessions. The EdgeFunction verifies user via
Auth, rejects anonymous/unconfirmed identities and untrusted owner fields. No media
or original library bytes are sent to an external service.

Persistent mapping table unique `(owner,sourceId,kind,localId)` -> random UUID
allocated once, retaining old lineage. The merge domain is being implemented at
`apps/mobile/src/account/history-merge.ts` with APIs below; do not duplicate its
engine or rewrite it. Build/bundle the existing domain for Edge runtime reproducibly
if native TS aliases/JSON imports require adaptation, rather than importing native
repository. Keep generated bundle artifacts tracked only if deployment needs them,
and a check command proves up-to-date source equivalence.

## Domain interface

Expected `collectAccountIdentityKeys(sources)` -> {sourceId,kind,localId}[];
`mergeAccountHistory(sources, {mapIdentity(sourceId,kind,localId):string,
verifiedDuplicates?:{sourceId,evidenceId,digest}[],preferredReplaySourceId?:string})`
returns Promise<{rows,projection,mappings,sourceCopies,review,replay}>. Read current
file before integration; coordinate missing exports through parent, do not edit it.
Only verified original bytes can supply cross-source digest proof; do not manufacture
proof from metadata or derivatives. An empty verifiedDuplicates list is valid.

## Concurrency/API contract

Use explicit `expectedAccountRevision` and exact expected source plan/watermarks;
never ambiguous `expectedRevision`. Receipt, sourceSnapshotRevision and
aggregateRevision are distinct. One account/source generation fence invalidates old
jobs and removal. Map identity allocation itself cannot activate a history.

Add narrow worker actions `plan`, `page`, `map-identities`, `activate`:
plan returns current account generation/revision and ordered latest-complete source
snapshot IDs/generations/pages. page reads only a member of that exact plan.
map-identities validates <=100 typed keys per call and returns stable assigned UUIDs.
activate stages bounded pages/graph metadata and then compares exact current plan
and account revision in one transaction; stale work retains prior active aggregate.
Record immutable aggregate pages and canonical engine versions/digest. A typed
HISTORY_REVIEW result must not silently drop structural/privacy/correction facts.

Expose owner-checked aggregate status/pull via the existing public RPC wrapper
without breaking M6 status/pull. Add `activeAggregate` and `aggregateRevision` to
status; pull may accept an active aggregate UUID and return the same v37 page DTO
envelope. Parent will update mobile to prefer this pointer. Existing first source
Replay remains preferred; new source Replay proposals cannot overwrite it.

## Acceptance

- Given active complementary snapshots, when merging, then only same-owner live-session
  input is used and stable source mapping is preserved through repeated merge.
- Given input changes/removal/concurrent merge, when activation CAS runs, then stale
  or incomplete work cannot replace active aggregate.
- Given untrusted source key/owner/session or anonymous JWT, when actions run, then
  they are denied and no raw private value appears in diagnostics/response errors.
- Given complete aggregate, when owner pulls it, then immutable paginated semantic
  records match staged source/engine version; another account cannot read it.
- Given retry/unknown acknowledgement, when replaying same operation, then stored
  receipts or stable aggregate operation identity prevent duplicate activation.

</frozen-after-approval>

## Diagnostic map before code

HISTORY_SYNC / HISTORY_AUTH -> verified owner/live session -> ACCOUNT_SESSION/blocked.
HISTORY_SYNC / HISTORY_SCHEMA -> plan/mapping/page validation -> HISTORY_SCHEMA/blocked.
HISTORY_SYNC / HISTORY_REBUILD -> shared canonical engine -> HISTORY_REVIEW/blocked.
HISTORY_SYNC / HISTORY_ACTIVATE -> generation/plan/revision CAS -> HISTORY_STALE/skipped.
HISTORY_SYNC / HISTORY_ACK -> network/RPC outcome -> HISTORY_NETWORK/unknown, reconcile.
One validated non-identifying correlation per request, fixed stages/reasons/outcomes,
no bodies/tokens/owner/source IDs/SQL/error stack. Backend logger closed allowlist
and fault/redaction tests are required. Actual project deployment evidence is parent-owned.

## Verification

Live read-only privilege audit (2026-10-28): anon cannot use history_private or
execute either history RPC. Authenticated can call the public owner RPC but not
the worker RPC, and has no SELECT/INSERT/UPDATE/DELETE grants on the nine existing
history_private tables; all nine have RLS enabled. Service role can execute worker
RPC. Supabase advisors report the intentionally exposed SECURITY DEFINER owner
RPC warning and private RLS-without-policy informational notices; ownership and
live-session guards remain required. A snapshot(owner_id,source_id) covering-index
performance advisory was passed to the lifecycle implementation for correction.
These are privilege/configuration observations, not cross-device acceptance.

Write synthetic SQL tests with transaction rollback and fixed assertions; no private
data or live email. Add handler validation/redaction tests using existing root Node
test conventions. Run relevant local checks and report unavailable live verification.

## Implementation notes

### Deployment packaging gate (2026-10-28)

The first disabled-worker API deployment returned HTTP 413 for an 11,327,267-byte
generated bundle containing the full Natural Earth destination dataset. A lossless
gzip/base64 experiment reduced it to 7,251,146 bytes, but the API still returned
413; the experiment was reverted. The full dataset and shared algorithm remain
required. Investigate bounded, integrity-verified asset delivery or a supported
packaging path and validate a disabled hosted request before enablement. Do not
omit geography or assume a size threshold.

Supabase's published limit is 5 MB for server-side bundling and 20 MB for local
CLI bundling: https://supabase.com/kb/troubleshooting/edge-function-bundle-size-issues.
Docker was initially not found on the sandbox PATH.
The published 2-second CPU and 256 MB memory limits also require realistic
workload measurement: https://supabase.com/docs/guides/functions/limits.

Follow-up: Docker Desktop per-user installation was started; local CLI bundling
successfully deployed the function with gateway JWT verification enabled and
HISTORY_MERGE_ENABLED unset (disabled). CLI reports 5.6 MB. An unauthenticated
synthetic request returned HTTP 401. This does not prove authenticated handler
loading, token compatibility or actual workload limits; these remain gates.

Local runtime probe: mount only the shared worker sources and synthetic probe read-only into the official Edge
Runtime container, run the actual shared handler with its server gate disabled,
and send only a synthetic request over loopback. HISTORY_SYNC/HISTORY_CONFIG
must return fixed HISTORY_UNAVAILABLE/blocked with no input or private data in
diagnostics. This proves local Deno module load only; it does not bypass or prove
the deployed gateway, perform authentication, or measure meaningful workloads.
Then exercise the actual merge handler with a fixed synthetic manual journey and
an in-memory mock RPC. Check fixed completion, exact phases, and absence of fixture
content in diagnostics; this tests Deno compatibility, not server/device acceptance.

Observed with official `supabase/edge-runtime:v1.77.4` locally: the disabled
handler returned HTTP 409/HISTORY_UNAVAILABLE; the fixed manual-journey merge
returned HTTP 200 with all expected mock phases and no fixture text in the
collected events. The specifically named probe container was stopped afterward.
Its mock Auth/RPC and main-worker environment do not prove hosted user-worker
limits, real authentication, PostgreSQL interaction or device behavior.

### Diagnostic source map and collection (before implementation)

- HISTORY_AUTH -> history-runtime.ts verified identity; SQL worker_action live auth.sessions/revoked_session/account checks. ACCOUNT_SESSION or HISTORY_FENCED blocked, no transfer.
- HISTORY_SCHEMA -> bounded HTTP body and exact request; SQL plan/page/key schemas. HISTORY_SCHEMA blocked. Inspect fixed stage and synthetic invalid-schema test; never raw payload.
- HISTORY_ACK -> plan/page/map/stage RPC transport or invalid response. HISTORY_NETWORK unknown acknowledgement, reconcile using persisted operationId; no assumed rollback.
- HISTORY_REBUILD -> bundled history-merge canonical policy. HISTORY_REVIEW blocked or HISTORY_SCHEMA blocked, retain active aggregate.
- HISTORY_ACTIVATE -> staged pages/final commit exact account revision and current plan CAS. HISTORY_STALE skipped, HISTORY_INCOMPLETE blocked, HISTORY_CONFLICT blocked; previous active aggregate remains authoritative.
- Collection: parent records deployed function revision, then filter travel-life-history-merge logs for [Travel Life share diagnostic] and HISTORY_SYNC; lookup only returned generated action correlation. No body/token/source/SQL/error logs. Run synthetic sentinels before any private reproduction. This task does not deploy or establish service/device observation.
- Evaluation plan: unchanged shared canonical algorithm; compare generated domain exports against shared source hash and exercise complementary synthetic records, stable mappings, stale activation, fault boundaries/redaction. Product reconstruction quality remains unmeasured.

### Local implementation and observed evidence

- Added migration `20261028065052_m7_private_history_aggregate.sql`, after M6 transfer guards. Service-only worker plan/page/map-identities/activate RPC checks live sessions and fences, persists random identity maps, stages immutable semantic pages and graph metadata, CAS-activates exact account revision/source plan, reconciles lost activation acknowledgement by operation identity, and purges account aggregates/mappings on deletion.
- Plans retain paused/disconnected imports, include state/current source generation, and use the latest acknowledged source revision. Only removed sources leave the input set. Existing M6 public actions delegate unchanged; status adds `activeAggregate`, `aggregateRevision`, `aggregatePages`; aggregate pull accepts `{aggregateId,page}` and returns the v37 page envelope. Parent owns final source-control/typed-record guard migration.
- `travel-life-history-merge` accepts only a caller-generated operationId after Auth verifies the bearer identity. The service-only RPC independently validates auth.sessions on every call. Runtime requires `HISTORY_MERGE_ENABLED=true` plus server URL/service role; absence stays disabled. No media bytes, media activation or public publication was introduced.
- `scripts/build-history-domain.mjs` transpiles the actual shared mobile merge/canonical closure into tracked `_shared/history-domain.js`, embedding the source digest. `node scripts/build-history-domain.mjs --check` proves current source equivalence and rejects native/external imports. Rebuild after any canonical/domain/contract change before deployment.
- Metadata serializes explicit graph/source-copy/review/Replay/privacy arrays, not projection Maps/functions. Any domain review blocks activation and preserves the current aggregate. No unverified duplicate proof is manufactured; verifiedDuplicates is empty until an authorized original-byte proof provider exists.
- Diagnostics use one safe action correlation, fixed non-null stages, exact typed failures, cancellation/stale lifecycle skips, and UNKNOWN for opaque SQL/RPC causes. Transport rejection/late acknowledgement remains unknown durable outcome. The existing backend console sink is reused after the history-specific closed allowlist; raw SDK fetch exceptions become fixed unavailable transport responses.
- Observed: 18 worker Node tests pass, including actual shared-domain projection, metadata shape, stable typed mapping inputs, exact plan forwarding, lost commit receipt reconciliation, every RPC transport boundary, auth/config denial, stale/cancel lifecycle, unknown SQL cause, arbitrary sentinel redaction and direct-console guards. Explicit backend adapter TypeScript check passes.
- Earlier root `npm run check` passed 61 tests before the five additional worker tests; final full check below records current count. No installed local psql/docker/deno executable was found, so actual PostgreSQL transaction execution and Deno Edge loading are not claimed here. Parent will inspect and execute the rollback-only synthetic SQL suite, deploy and collect service/device evidence separately.
- Resource limits: 100 sources/10,000 input pages/64 MiB source rows per invocation; 100 records and 400,000 encoded bytes per staged output page; graph metadata at most 400,000 encoded bytes; SQL additionally limits 20 retained aggregate operations and 64 MiB aggregate pages per account. Exceeding a bound blocks new activation with HISTORY_QUOTA; no scale/latency claim is made. Retained-operation cleanup remains an operational enablement consideration before broader rollout.

Final local verification (2026-10-28): root `npm run check` passes 67 tests, framework integrity and eval infrastructure smoke. Worker suite contributes 18 passing tests. Backend `tsc --noEmit --allowJs --skipLibCheck --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --lib es2023,dom` over history-runtime.ts/history-diagnostics.ts/history-auth.ts passes. Generated-domain `--check` passes. This is ready for parent review and real Postgres/Deno/service validation, not a claim of complete M7/device acceptance. Parent was notified of independent owner-fact preservation during source removal and retained-operation cleanup limits.
