---
title: M7 unified history implementation
status: in-progress
review_loop_iteration: 1
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
created: 2026-10-28
context:
  - ../specs/spec-private-multi-source-history/SPEC.md
  - ../specs/spec-private-multi-source-history/ARCHITECTURE-SPINE.md
---

# Unified history and private Replay

## Review Triage Log (2026-10-29, first complete review)

| Finding | Verdict / route | Verified evidence |
| --- | --- | --- |
| Blind 1: source resume | high / patch | Server increments source generation; native attach rejects the retained config without reconciliation. |
| Blind 2: selected replica | high / patch | saveReplica updates a pointer, but the open recordContext still holds old repositories/media. |
| Blind 3: explicit restore | high / bad_spec | Explicit restore lacks the dirty/job guard of convergence and can replace unsent owner work. |
| Blind 4: rejected controls | medium / patch | Definitive CAS rejection leaves a persisted request that can never succeed, blocking unrelated controls. |
| Blind 5: media receipt recovery | medium / patch | Cached bytes are read before status, preventing reconciliation of verified/active server copies after cache eviction. |
| Blind 6: terminal media jobs | high / bad_spec | A retained unusable queue head blocks every new selection with no reconciled abandon/reprepare path. |
| Blind 7: uncheckpointed derivatives | medium / patch | Preparation can succeed before consent/checkpoint failure, leaving no durable owner for cleanup. |
| Blind 8: replica reclamation | high / bad_spec | Every restore creates a DB; discarded/failed replicas have neither a bounded registry nor reclamation. |
| Blind 9: correlation | medium / patch | History transport omits its supplied header; nested verification generates unrelated action correlations. |
| Blind 10: full SQL command | low / patch | Default harness covers only four files, requiring callers to reconstruct ordered draft dependencies. |
| Blind 11: soundtrack copy | low / patch | Review copy unconditionally claims synchronized custom audio is disabled, even under enabled acknowledged media. |
| Edge 1: source resume | high / patch | Independently traced the same acknowledged generation mismatch as Blind 1. |
| Edge 2: open replica | high / patch | Independently traced stale selected repository/media references after pointer commit as Blind 2. |
| Verification 1: root remount | high / patch | Tests exercise context directly, never the actual PrivateRecordProvider remount with captured repositories. |

Review-loop outcome: every local finding above has a correction and regression
evidence. Source resume is covered at native coordinator and actual SQLite rollback;
context rebind/suspension and deliberate-local intent have direct tests; the mounted
provider test was rechecked by its original reviewer. Explicit restore refuses dirty
and in-flight edits. Control tests separate definitive rejection from malformed
unknown ACK. Media tests cover receipt-first recovery, checkpoint ownership and
abandonment; PG11 verifies tombstones/late requests and retained active copies.
Tracked handle tests refuse selected/pending/transactional connections; SQLite
verifies bounded staging, absent-file recovery, owner-only purge and primary DB
preservation. History/Auth correlation and neutral audio copy are corrected.
FullSuite is the maintained SQL entry point. Physical/service limits below remain
open; no reviewer finding is closed using a device claim.

### Review correction contract and diagnostic map (before fixes)

Keep existing reconstruction parameters, local-only record, exact immutable unknown-
outcome receipts, account/source/privacy fences and disabled gates. Preserve all
unrelated recovered work. Re-derive only the reviewed defective boundaries.

- Explicit restore must refuse dirty or pending local account work with HISTORY_REVIEW
  at HISTORY_READ, including changes arriving while staging; prior pointer/baseline
  stays intact. No replacement/discard workflow is inferred from a restore tap.
- After pointer acknowledgement, rebind an already selected same-owner account context
  only while its original selection intent still holds; a later local choice wins.
  Dispose old media and remount provider state. Test the mounted wrapper, not just
  its helpers. Failures remain at HISTORY_POINTER/HISTORY_STORAGE or fenced/skipped.
- Resume only a server-acknowledged active source generation for the same enrolled
  installation/account. Retire obsolete transfer checkpoints atomically before new
  export; stale requests cannot publish across the fence. HISTORY_STAGE/HISTORY_FENCED
  identifies incompatible scope, HISTORY_STORAGE identifies local transaction failure.
- A closed definitive control rejection may retire only its matching local request;
  unknown/network outcome retains it. Fresh user retry obtains current revisions.
  Never replay a changed request under an old mutation identity.
- Media recovery consults immutable stage/status receipts before requiring local
  bytes. Explicit abandon must reconcile/fence any reserved artifact before releasing
  its local job and derivative; active acknowledged copies stay active. Unknown remote
  outcome retains the job. New cleanup boundaries use PRIVATE_MEDIA/MEDIA_CLEANUP,
  fixed MEDIA_STORAGE/MEDIA_NETWORK/ACCESS outcomes and the same action correlation.
  Preparation owns its file until durable checkpointing; failed transfer of ownership
  removes only the generated derivative, never source originals.
- Account replica cleanup admits only generated account DB namespaces, never the local
  DB. Track staged/active/retired or protected dirty branches durably; reclaim failed
  or superseded clean replicas only after current pointer/selection and connection
  safety checks. Cleanup failure remains inspectable/retryable and cannot erase a
  usable or unsent record. Bound staging before creating more full replicas.
- Carry one generated action correlation through Auth verification and every history
  request; never use owner/mutation identities. Add failure/redaction propagation
  tests. A maintained FullSuite SQL command includes every ordered local draft and
  fixture; synthetic results remain distinct from service/device acceptance.

### Spec Change Log

- Review loop 1 refines recovery, replacement and resource ownership rules above.
  Avoided states: silently orphaned owner edits, permanently fenced enrollment,
  unrecoverable media/control queue head and unlimited private replica accumulation.
  KEEP: accepted privacy fences, old usable record on failure, immutable retry IDs,
  canonical policy, existing local databases and unrelated in-progress changes.

### Reproducible local SQL verification

Run `./scripts/test-private-history-postgres.ps1 -FullSuite` from this checkout.
On this host add `-DockerExe 'C:/Users/vothi/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'`.
The switch owns the ordered draft dependencies and every associated fixture;
custom lists remain available for isolated investigation without FullSuite.
It uses the pinned PostgreSQL image with no network or published ports, validates
all paths before starting, runs synthetic Auth/Storage rollback assertions and
cleans only the container with its matching generated ownership label. Initial
recovery run passed all ten fixture files, including corrections and deletion.
No hosted migration or physical acceptance is implied.

The maintained suite now also includes `m7-media-abandon-draft.sql` last and
`private-history-media-abandon.sql`. All eleven fixture files passed actual local
PostgreSQL on 2026-10-29, including late-stage tombstones, active-copy retention,
reprepare and abandonment after consent withdrawal. The disposable owned container
was stopped by the harness.

### M6-M7 acceptance evidence map

All original ACs remain binding. These are contract checks, not closed physical
acceptance. Review-loop fixes above still require their final integrated rerun.

| Story / binding ACs | Host evidence | Still required externally |
| --- | --- | --- |
| M6.1 / AC-M6.1-1..4 | auth-adapter/controller/storage/screen suites, owner isolation, fixed denial/redaction | SMTP/OTP delivery, actual refresh/expiry/restart on Android/iOS |
| M6.2 / AC-M6.2-1..4 | consent CAS/account-controls SQL, scope/status/panel tests; all upload flags off | consent/source layout and actual scope on phones |
| M6.3 / AC-M6.3-1..4 | semantic transfer, immutable receipts, canonical mapping and retained-schema SQLite fixtures | acknowledged attach/restart with declared synthetic two-device data |
| M6.4 / AC-M6.4-1..3 | separate replica staging, boundary fault/signout/pointer tests, offline-identity regression | second-phone restore/offline content and honest unavailable media |
| M6.5 / AC-M6.5-1..4 | owner session/revocation/consent/deletion SQL; cleanup runtime and protected receipt tests | real Auth refresh/deletion, cleanup schedule, configured retention/backup deadlines |
| M7.1 / AC-M7.1-1..4 | lease/cursor/receipt/backoff SQLite, source-only deferral and headless result tests | actual OS scheduling/expiry, complementary devices, measured timing/bytes |
| M7.2 / AC-M7.2-1..4 | normalized identity/duplicate/permutation merge tests and server ownership checks | actual declared selected-copy evidence and surviving-source playback |
| M7.3 / AC-M7.3-1..4 | shared canonical engine, source-plan CAS/activation and worker runtime fixtures | both physical clients activating the same revision; accuracy remains unmeasured |
| M7.4 / AC-M7.4-1..4 | journal/conflict/resolution SQL, immutable offline mutation tests, selected-resolution SQLite, real conflict decoder | concurrent offline edits on two phones and recognizable native review context |
| M7.5 / AC-M7.5-1..4 | selected derivative preparation, staging/hash/decoder/access tests and private media SQL | authenticated service envelope, retention/cleanup, native upload and source-offline fetch |
| M7.6 / AC-M7.6-1..4 | committed Replay/media/audio adapter and provider permission/export fences | exact second-phone render/playback/share and receiving-phone cached/offline policy |
| M7.7 / AC-M7.7-1..4 | coverage/removal/owner-fact retention SQL and source/panel tests | actual phone layout, source lifecycle races and service cleanup observability |

The owner confirmed a second Android exists in the interrupted chat, but on
2026-10-29 said it cannot be connected now. Host ADB inventory sees one authorized
device. No private media or actual email was used in this recovery; Android/iOS
two-device acceptance stays open. Do not enable gates from host pass counts.

Implement canonical M7.1-M7.7 acceptance without changing reconstruction parameters.
First extract the existing canonical graph/correction helpers into a native-free
module and keep repository public exports compatible. Verify current structural,
family, remap, privacy and engine suites and real SQLite regressions before server use.
This is behavior-preserving substrate work, not a new reconstruction policy.

## Before-code diagnostic map

2026-10-29 activation receipt compatibility (before code): existing SQL/Edge
activation returns `complete` plus artifactId and expectedRevision+1, while native
requires `active`. At `PRIVATE_MEDIA/MEDIA_ACTIVATE`, admit `complete` only when
the saved artifact matches and the revision is a positive safe integer exactly
expectedRevision+1; keep the existing artifact-matched `active` recovery response.
Apply the same check in media-transport.ts and media-upload.ts. Malformed/mismatched
receipts remain MEDIA_SCHEMA/blocked and retain the immutable job and both mutation
identities; unknown acknowledgement remains MEDIA_NETWORK/unknown. Native completion
follows durable active checkpoint and generated-file cleanup. Verify an actual
server-shaped receipt, lost-ACK replay of the exact activation mutation, active
recovery, wrong artifact/revision and redaction with one action correlation. Use
existing closed app diagnostics, no media URI/body/ID logging. Host tests establish
receipt admission only; parent owns hosted/device acceptance. No SQL/deploy change.

Receipt implementation evidence: `media-receipt.ts` is the shared native predicate
used by media-upload.ts and media-transport.ts. It keeps artifact-matched `active`
responses and admits `complete` only with a positive safe revision exactly one
above persisted expectedRevision. Wrong artifact or missing/string/negative/
fractional/unsafe/wrong revision remains MEDIA_SCHEMA at MEDIA_ACTIVATE; checkpoint,
prepared derivative and activation mutation stay retained. Lost-ACK regression
failed before correction, then verified a server-shaped immutable receipt clears
only after durable active checkpoint and cleanup. Both focused media suites pass
30 tests; mobile TypeScript and ESLint of the five affected source/test files pass.
Exact envelope/action correlation, active recovery, single terminal diagnostic and
redaction are covered. No applied migration, server deployment or gate changed;
physical native receipt acceptance remains parent-owned.

| Boundary | Operation/stage | Failure/lifecycle and outcome |
| --- | --- | --- |
| existing canonical helper extraction | existing ATLAS_REBUILD stages | existing remap/structural guards retained; no new logger required |
| source identity normalization | HISTORY_SYNC/HISTORY_SCHEMA | invalid mapping/schema -> blocked, no activation |
| pure canonical worker | HISTORY_SYNC/HISTORY_REBUILD | remap-review vs structural fail-closed; keep prior aggregate |
| aggregate write/CAS | HISTORY_SYNC/HISTORY_ACTIVATE | stale watermark -> skipped/retry; unknown commit -> reconcile |
| correction mutation | HISTORY_SYNC/HISTORY_CORRECTION | version conflict -> retained proposals, unchanged target |
| media upload/verification/activation | PRIVATE_MEDIA copy/decode/stage/verify/activate | closed unsupported/quota/access/stale categories, previous usable manifest retained |
| current account media resolver | PRIVATE_MEDIA fetch/cache | session/fence/unavailable content explicit; no native permission bypass for device assets |

Exact new source/classification map must be expanded before each new runtime
boundary is introduced. Carry one non-identifying action correlation; no raw source
keys, URLs, provider/native messages or media in logs. Collect current app's
[Travel Life diagnostic] HISTORY_SYNC/PRIVATE_MEDIA stages and run synthetic forced
failure/redaction checks. No source-offline/two-device acceptance is claimed here.

## Progress and verification

### Final recovery verification (2026-10-29)

- Root `npm run check`: 90/90 tests, framework integrity and eval smoke pass.
- Mobile Jest: 95/95 suites, 790/790 tests pass with `--testTimeout=15000`;
  final structured result is local-only `.jest-cache-codex/m6-m7-final.json`.
- Actual in-memory SQLite: 102/102 cases pass (9 account cases), including generation
  rollback, replica cap/reclamation, active/local isolation and missing-file recovery.
- Mobile typecheck/lint and shared backend TypeScript check pass. Native-free bundle
  regenerated and freshness guard passes. Expo Doctor passes 21/21 on approved host.
- Actual isolated PostgreSQL FullSuite passes all 11 synthetic rollback fixture files;
  no network/ports or hosted mutation. New abandonment SQL is still a local draft.
- Earlier coverage run measured 72.05% account lines before final review patches;
  it excludes standalone SQLite execution and is not a final coverage/accuracy claim.
  Its first 5-second Replay timeout was followed by a successful declared 15-second
  run; production code was not changed to hide that test timeout.
- All 14 review findings have local correction evidence above. The implementation
  agent exhausted its limit mid-fix; parent inspected the saved tree, finished
  cleanup/proven-rejection handling and direct regression coverage, then ran the
  complete integrated verification. No commit/push/deployment/private upload.
- Status remains in-progress for actual SMTP/Auth/retention, Android/iOS, two-device
  and dirty legacy compatibility limits. The owner cannot connect phone two now.

### Private media boundary map (before implementation)

| Source boundary | Operation/stage | Closed failure/outcome and next action |
| --- | --- | --- |
| private-media runtime configuration | PRIVATE_MEDIA/MEDIA_CONFIG | MEDIA_UNAVAILABLE blocked; verify explicit media gate, never infer decode support |
| exact Auth identity/live SQL fence | PRIVATE_MEDIA/MEDIA_AUTH | ACCOUNT_SESSION or HISTORY_FENCED blocked/skipped; refresh verified owner/session and inspect mapped generation |
| JSON/manifest/binary admission | PRIVATE_MEDIA/MEDIA_SCHEMA | MEDIA_SCHEMA or MEDIA_QUOTA blocked; validate schema/byte/dimension/duration caps, no raw input |
| consented current aggregate membership | PRIVATE_MEDIA/MEDIA_ELIGIBILITY | MEDIA_CONSENT/MEDIA_SCOPE blocked; inspect current policy/consent revisions |
| SQL reservation/immutable receipt | PRIVATE_MEDIA/MEDIA_STAGE | MEDIA_CONFLICT/MEDIA_QUOTA blocked; reconcile exact operation before retry |
| bounded structural/hash verification | PRIVATE_MEDIA/MEDIA_VERIFY | MEDIA_VERIFY blocked; retain prior attachment, never treat claimed MIME/hash as verified bytes |
| pinned decoder asset/init/full decode | PRIVATE_MEDIA/MEDIA_DECODE | MEDIA_UNAVAILABLE/MEDIA_DECODE/MEDIA_BUSY blocked/skipped; full video+audio decode or explicit unavailable; memory/CPU remain unproven until measured |
| immutable private object upload/read-back | PRIVATE_MEDIA/MEDIA_UPLOAD | MEDIA_STORAGE unknown; reconcile exact path/digest before retry; no overwrite |
| SQL trusted verification acknowledgement | PRIVATE_MEDIA/MEDIA_ACK | MEDIA_NETWORK/UNKNOWN unknown; retain reservation, reconcile exact artifact |
| current-scope attachment CAS | PRIVATE_MEDIA/MEDIA_ACTIVATE | MEDIA_CONFLICT/MEDIA_SCOPE blocked, prior usable manifest retained |
| signed private object fetch/cache | PRIVATE_MEDIA/MEDIA_FETCH or MEDIA_CACHE | MEDIA_UNAVAILABLE/MEDIA_STORAGE failed; missing bytes stay explicit, no soundtrack substitution |
| deletion fence/purge queue | PRIVATE_MEDIA/MEDIA_CLEANUP | MEDIA_STORAGE unknown; fence access first and retry deletion idempotently |

One generated `local_<32 hex>` correlation is passed through the request and all
runtime/decoder/RPC boundaries. Mutation/artifact IDs are separate and never logged.
All backend events are closed allowlisted fields; no raw error/decoder output,
request bodies, storage paths, URLs, source/evidence identifiers or media metadata.
Representative synthetic tests force each implemented boundary and verify exact
stage/reason/outcome, single terminal event and secret/content redaction.

Collect matching JWT-gated media function version and current structured
`[Travel Life diagnostic] PRIVATE_MEDIA` events by action correlation. Mobile
collection additionally verifies the installed package/build and process. Keep
private reproduction logs only in ignored local directories; missing logs are a
collection gap. Media stays disabled until actual full-decode envelope, retention,
authentication and two-device playback gates are met. Existing 20 MiB image,
100 MiB video and 2 GiB account values are admission defaults, not measured capacity.

### Source lifecycle retention boundary (before implementation)

- `HISTORY_TRANSFER/HISTORY_DELETE` maps to mobile `historyService.sourceControl`
  and SQL `history_private.control_source`: live-session/account/source generation
  failure is `ACCOUNT_SESSION`/`HISTORY_FENCED`, unchanged; malformed input is
  `HISTORY_SCHEMA`, unchanged; reused mutation with different content is
  `HISTORY_CONFLICT`, unchanged. Network acknowledgement remains unknown and must
  reconcile the receipt. No source key or provider exception is logged.
- `HISTORY_SYNC/HISTORY_SCHEMA` maps to worker source-plan decoding and
  `normalizeSources`: only a server-marked removed source may carry retained
  owner facts without supporting evidence. Removed evidence is not reintroduced.
  Referenced corrections become `pending_remap`; privacy scopes are retained.
  Missing/ambiguous references remain reviewable and cannot become effective facts.
- `HISTORY_SYNC/HISTORY_REBUILD` maps to canonical projection and retained-fact
  handling: surviving source evidence remains rebuildable; unresolved removal
  proposals gate activation with `HISTORY_REVIEW` until review is resolved.
- SQL source removal advances the source fence, clears readable old authority,
  preserves manual/home/owner corrections and immutable privacy revisions in a
  sanitized retained-fact snapshot, and deletes old source/aggregate content in
  the same transaction. Pause/disconnect retain current readable authority while
  fencing old worker plans. Account deletion purges retained snapshots too.
- Collection: matching mobile build/process filter `[Travel Life diagnostic]`
  operation `HISTORY_TRANSFER`, stage `HISTORY_DELETE`; worker structured events
  operation `HISTORY_SYNC`, stages `HISTORY_SCHEMA`/`HISTORY_REBUILD`. Look up the
  one local action correlation; retain private logs only in ignored directories.
  SQL rollback fixtures force session/schema/idempotency/fence boundaries; pure
  fixtures force missing support, retained privacy and redaction. Hosted/device
  collection remains required before physical behavior is accepted.
- Removed-source review uses `source-review` (bounded owner-only pages) and
  `resolve-conflict` mode `archive-source-proposals`. SQL
  `history_private.resolve_removed_source` checks account/source generation and
  expected source snapshot revision under the owner lock. `HISTORY_CONFLICT`
  retains proposals and target; exact receipt retries return the same result.
  Explicit archival retains the sanitized original proposal snapshot for review,
  activates a new snapshot with independent manual/home/manual-privacy facts only,
  and never restores removed source evidence. Map to mobile
  `HISTORY_TRANSFER/HISTORY_DELETE`, unknown network acknowledgement and
  matching receipt reconciliation; the UI must show the actual proposal before
  an owner chooses archival. This is removal-proposal resolution, not a claim
  that general offline correction concurrency is implemented.
- Mobile `history-store` control checkpoints use `HISTORY_TRANSFER/HISTORY_STAGE`,
  `HISTORY_STORAGE` and failed outcome, with no send before durable save.
  `runHistoryControl` keeps the exact mutation across lost acknowledgement and
  status-refresh failure; signout fences publication and matching cleanup.
  Source review reads use `HISTORY_ACK` for transport and `HISTORY_SCHEMA` for
  validated owner-only DTOs. Unknown/malformed acknowledgement is retained.
- UI reference is Living Atlas Settings/Trust panels: Account history → Sources →
  retained owner facts → explicit archival; bounded pages expose all retained facts.
  Removal currently explains its scope but has no item-level affected-history/media
  preview or observed coverage counts. Physical viewport and full M7.7 acceptance
  remain open; the implemented controls are not claimed to close those ACs.

In progress; M6 private schema and initial transfer are separate from M7 aggregate.

### Source retention evidence (2026-10-28)

- CLI-created migration `20261028081801_m7_source_owner_fact_retention.sql`
  passed both actual hosted Postgres aggregate and source-retention fixtures inside
  rollback transactions before application. Parent applied it, reran the retention
  rollback fixture successfully, and redeployed the JWT-gated worker. The merge
  enablement secret remains unset. No private owner media was uploaded.
- Root `npm run check` passed 70 tests; mobile typecheck and lint pass. Focused
  merge/control/review UI suites pass 23 tests, and the real in-memory SQLite
  account suite passes four tests including owner-scoped control checkpoint reuse.
  Source removal is unexposed pending affected-content preview. General concurrent
  correction resolution, media synchronization and owner-operated device acceptance
  remain open. Synthetic fixtures establish contracts, not end-to-end acceptance.

### Media runtime host evidence (2026-10-28, not enablement)

- Sixteen synthetic HTTP/runtime tests pass: exact stage classification, immutable
  upload recovery, unknown verification retention, proven source-fence compensation,
  signed download TTL, cleanup acknowledgement ordering and log redaction.
- The actual pinned factory/WASM adapter locally decoded the synthetic 32×24 JPEG,
  H.264 MP4 and generated two-second AAC-only MP4, rejected a truncated MP4, and
  passed the structural metadata allowlist for all three. The AAC fixture is synthetic
  and contains only a generated 440 Hz tone. `-abort_on empty_output+empty_output_stream`
  is supported by the pinned build. This is local Node evidence, not hosted Edge
  CPU/memory/concurrency, real-media or device playback acceptance.
- Draft SQL is `_bmad-output/implementation-artifacts/m7-private-media-draft.sql`
  (repository relative); parent generated migration
  `20261028084018_m7_private_media_storage.sql` and is performing actual rollback
  verification. No media feature gate is enabled.

### Mobile merge request boundary (before implementation)

Mobile media cache boundary: PRIVATE_MEDIA/MEDIA_AUTH verifies current owner/action;
MEDIA_FETCH requests current authorized manifest and an ephemeral URL; MEDIA_VERIFY
checks exact byte length/hash before cache admission; MEDIA_CACHE commits only after
another action fence. Missing access is blocked, stale action skipped, opaque network
or cache acknowledgement unknown. Cache keys include owner+artifact+revision; cached
bytes must be reverified and authorization refreshed before use. This first resolver
does not promise offline playback. Test cross-owner isolation, corrupted cached bytes,
sign-out during download, and raw-error redaction. Use the sole mobile logger.

Continuation source map (before mobile integration): `media-transport.ts` verifies
the live token owner and action at MEDIA_AUTH (`MEDIA_ACCESS`, skipped); download
authorization and bounded HTTPS fetch use MEDIA_FETCH (`MEDIA_NETWORK`, unknown,
retryable), exact DTO/target/type/hash use MEDIA_VERIFY (`MEDIA_VERIFY`, blocked).
`media-native.ts` uses an app-private bounded cache at MEDIA_CACHE (`MEDIA_STORAGE`,
unknown, retryable), immutable per-write files and matching-only late cleanup.
`record-context.ts` binds each resolver to the selected replica/owner generation;
signout/context switch fences callbacks and final Replay export. Custom soundtrack
resolution uses the exact committed revision and never substitutes bundled audio.
The resolver passes its one local correlation into Edge authorization. Collect the
matching installed process PRIVATE_MEDIA events and matching JWT-gated function
events by that value; synthetic transport/cache fault tests precede device playback.

- HISTORY_TRANSFER/HISTORY_STAGE: persist one owner-scoped operation UUID before
  sending; local checkpoint failure is HISTORY_STORAGE/failed and sends nothing.
- HISTORY_TRANSFER/HISTORY_ACK: authenticated Edge request uses the saved UUID;
  timeout, invalid response or transport failure is HISTORY_NETWORK/unknown and
  retains the UUID for receipt reconciliation. Never log response bodies or tokens.
- HISTORY_TRANSFER/HISTORY_ACK: server-confirmed complete or explicit stale response
  clears only the matching checkpoint after status refresh succeeds. Stale means this operation cannot activate
  against the current plan; the next explicit attempt starts a fresh plan. A prior
  activation may already have been superseded. Fenced/review retain it for review.
  Sign-out fences publication of results and never discards an unknown receipt.
- Collect fixed HISTORY_TRANSFER stage/reason/outcome and correlation ID from the
  mobile diagnostic boundary. Exercise timeout, lost acknowledgement, owner switch,
  malformed response, fixed error/redaction and SQLite checkpoint reuse with synthetic
  values. The service stays disabled until server and device acceptance gates pass.

### Mobile private derivative integration evidence (2026-10-28)

Coordinator map (before implementation): `history-sync.ts` enters HISTORY_LEASE
before native owner/source/generation lease claim/renew/release; SQLite failure is
HISTORY_STORAGE/failed, occupied lease is ALREADY_RUNNING/skipped, expired/lost lease
is HISTORY_FENCED/skipped with its exact outbox retained. HISTORY_AUTH reads live
owner/source/history consent before work; source pause/removal/generation change
blocks. HISTORY_EXPORT creates one semantic plan only when the local digest changed;
HISTORY_STAGE saves its immutable mutation IDs under the lease before sending.
HISTORY_ACK reconciles exact requests and advances only while the same lease/action
still owns the checkpoint; network acknowledgement remains unknown. Five bounded
automatic attempts/backoff retain foreground retry. HISTORY_SCHEDULE maps unavailable
OS slots to lifecycle RESTRICTED/unchanged, never an assertion of background execution.
The same runner coordinates foreground and headless background calls; local enrollment
requires an explicitly acknowledged device attachment and independent automatic-sync
gate. Login alone never enrolls or transfers a local record. Collection filters current
HISTORY_TRANSFER action correlation and exact stage START/terminal; synthetic held
response, lease takeover, independent source and checkpoint tests precede device claims.

Before continuation: cached `provider.loadPreparedReplay` requires live media scope
before native verification and again immediately before returning a cached artifact;
denial stays unavailable. `media-transport` handles only a current same-owner explicit
`ACCOUNT_SESSION` denial as PRIVATE_MEDIA/MEDIA_AUTH blocked, synchronously invoking
the controller's owner fence before awaiting its secure block. Secure-block failure
is ACCOUNT_STORAGE/ACCOUNT_SECURE_DELETE blocked. Transient network, absent media,
consent/source denial and stale-owner responses never invalidate another session.
Native-cache fault tests inject read/write/delete errors and assert fixed cache events,
reverified bytes, current-owner-only access and no raw sentinel serialization.

Selected-upload continuation map (before implementation): `media-upload.ts` persists
one immutable prepared-derivative plan at MEDIA_STAGE before any network request;
checkpoint failures are MEDIA_STORAGE/unknown and never send. MEDIA_AUTH rechecks
owner action/explicit consent; MEDIA_VERIFY reloads exact prepared bytes/hash and
rejects changed or missing content. MEDIA_STAGE reconciles the same stage mutation;
MEDIA_ACK queries the same artifact before retry; MEDIA_UPLOAD retries only its exact
verified bytes; MEDIA_ACTIVATE uses its saved mutation/CAS revision. Transport errors
remain MEDIA_NETWORK/unknown with checkpoint retained, server quota/conflict/schema/
scope categories remain closed blocked categories. MEDIA_CLEANUP deletes only the
generated derivative after activation is durable; failed cleanup retains the plan.
Each entered awaited stage emits START with one local correlation, then one terminal.
Collection uses current installed process PRIVATE_MEDIA stages and matching Edge
correlation; synthetic lost-acknowledgement and checkpoint/fence/redaction tests prove
retry contracts before selected-owner-media or physical-device acceptance.

- Account replica previews now resolve canonical `account:` evidence through the
  JWT-gated private route, verify exact type/length/SHA-256 and cache private bytes.
  Native-library handles are never resolved through this adapter. Same-origin signed
  capabilities expire within 300 seconds and never accompany a bearer-token fetch.
- Cache files use random names in a generated private session directory, bounded to
  256 MiB per selected context. Context change/signout fences results and deletes its
  directory; the next process's first cache access clears orphaned generated sessions.
  Full cache capacity fails explicitly. This session cache does not claim persistent
  airplane-mode availability or measured native decoding/memory capacity.
- Account Replay resolves the exact custom audio revision with no bundled fallback,
  blocks missing committed derivatives, and rechecks live history/media consent plus
  exact active aggregate before accepting a render or export. Pause/disconnect retains
  imported content; removal/deletion or changed authority denies old exports.
- Four focused Jest suites pass 75 tests, including withheld late render/export,
  custom-audio failure, missing committed media, cross-owner cache keys, stale writes,
  byte corruption, URL scope, token-owner races, classification and sentinel redaction.
  Mobile typecheck and lint pass. Root `npm run check` passes 86 tests and eval smoke;
  no reconstruction-accuracy claim. Whitespace check passes.
- The explicit mobile media flag remains false. Mobile preparation/upload of selected
  derivatives, durable multi-source coordinator, full concurrent correction handling,
  affected-content removal preview and physical two-device playback remain required.
  No remote operation, migration application, private upload or device run occurred in
  this continuation. Native filesystem calls remain host-typechecked; on-device cache
  behavior and resource envelope are still acceptance gaps.

### Selected upload and synchronization coordinator continuation (2026-10-28)

Before continuity implementation: local SQL `readable_prior_aggregate` maps
HISTORY_TRANSFER/HISTORY_AUTHORITY to owner/account/consent/deletion fences and
append-only evidence comparison. Prior evidence and all owner/privacy/replay rows
must still be identical; any removal/change is HISTORY_STALE and blocks prior reads.
Only new evidence without changed owner rows may keep the last accepted aggregate
readable while `pendingMerge` is true. No fallback to the initial snapshot may hide
an unreadable prior aggregate. Worker activation still compares the full exact input
plan. Synthetic Postgres rollback must force append, changed privacy, removal,
pause/disconnect, cross-owner and stale pull boundaries before enablement.

Convergence source map: `history-convergence.ts` calls exact durable merge operation
at HISTORY_ACK, refreshes at HISTORY_AUTHORITY, and pulls only an explicitly restored
account replica at HISTORY_PULL. Before replacing a replica it verifies its current
semantic digest against the digest saved on explicit restore; changed/unknown local
account edits are HISTORY_REVIEW and remain intact. A missing replica never opts in
restore merely because login/catch-up succeeded. New merge/pull automation stays
separately disabled; failed/unknown acknowledgements retain merge IDs, previous
authority and dirty replicas. Synthetic changed-authority/dirty/signout tests establish
these orchestration contracts, not physical cross-device convergence or accuracy.

Source-controls continuation map: owner-only `source-impact` SQL pages current source
snapshot facts and current aggregate affected media, at HISTORY_ACK; typed decoding
is HISTORY_SCHEMA. `source-control removed` requires the preview account revision,
source generation/snapshot revision under the same owner lock; HISTORY_CONFLICT
retains every source and previous aggregate. Same mutation receipt retries remain
idempotent. Status coverage counts accepted evidence rows/dates and acknowledged
derivatives separately; unknown scan counts remain unknown. `source-impact` UI uses
actual retained fact values and available private derivative previews; unavailable
media remains explicit. One destructive confirmation states scope, retained independent
facts and URL/offline limits; no source original deletion. Failure/redaction tests and
actual synthetic Postgres rollback precede exposing the gated removal control.

- Selected-copy preparation/upload now has a gated Settings gallery/service, separate
  explicit media consent and custom-audio permission choice. It resolves exact native
  assets, sanitizes image/video with the existing derivative implementation, prepares
  single-stream AAC audio, verifies the private container and persists immutable
  stage/activation identities before sending. Unknown outcomes retain the same job;
  cleanup does not release the checkpoint before activation/derivative deletion.
- `m7-source-media-selection-draft.sql` and
  `../../supabase/tests/private-history-media-selection.sql` passed actual isolated
  local Postgres17 rollback alongside the four existing SQL fixtures, as reported by
  the parent runner. The draft is not a generated/applied hosted migration. Synthetic
  Auth/Storage tables do not establish real Supabase session/object acceptance.
- One owner/source/generation lease now coordinates explicit attachment, foreground
  catch-up and the gated OS task. Lease-checked checkpoints keep exact page mutation
  identities across late responses/restarts; digest-equal local records avoid another
  snapshot. Background retries use five attempts and bounded backoff; foreground may
  explicitly retry. A source generation change, consent loss, stale lease, signout or
  local disconnect stops publication. Local disconnect suspends enrolled catch-up.
  Automatic sync remains disabled by its independent flag; login alone never enrolls.
- Pure coordinator tests pass four scenarios; actual SQLite tests pass six scenarios,
  including lease competition/takeover, matching cleanup and atomic completion.
  The broader account/media/provider regression run passed 183 tests in 20 suites
  before the final coordinator wiring; parent is running the integrated rerun.
  Typecheck passed after wiring; lint's one unused type import was removed.
- Open implementation: general offline correction mutation/conflict resolution,
  coverage/removal preview, worker/aggregate pull scheduling and prior-aggregate
  continuity when new input is pending. The current SQL `same_source_content` status
  rule can hide a prior aggregate before replacement; do not enable automatic merge/
  restore until continuity is resolved without weakening source/privacy fences.
  Gates remain false; no remote operation or real-owner media upload occurred.

### Continuity, convergence and source-impact evidence (2026-10-28)

Correction journal map (before implementation): `correction-journal.ts` computes
typed semantic owner-row changes against the explicitly restored baseline, never
evidence changes or raw SQL. HISTORY_STAGE saves an owner/base-version/source-plan
scoped immutable mutation before send. `correction-propose` SQL validates current
session/account/source snapshot fences and expected global owner-fact version under
the account lock; conflict retains the accepted target and both proposal snapshots.
HISTORY_CORRECTION/HISTORY_CONFLICT is blocked/reviewable; network ACK is unknown and
reconciles the same mutation. Owner resolution is a new mutation with expected
current target version, never timestamp precedence. Worker plan carries current
canonical owner-row overlay; portable domain applies it after identity normalization
before projection under existing remap/structural guards. No changed reconstruction
parameter or accuracy claim. Synthetic diff/CAS/proposal/remap/redaction tests and
actual Postgres rollback establish contracts; physical offline concurrency stays open.

- Prior authority stays readable for append-only evidence while pending merge, with
  exact old evidence and unchanged owner/privacy/Replay rows. Changed privacy,
  removed evidence/sources and account fences deny the old aggregate and suppress
  initial-snapshot fallback. Withdrawing sync retains accepted metadata. Mobile
  observes an unreadable pending aggregate and hides its replica; readable pending
  aggregate remains available.
- Separately gated foreground convergence schedules exact-receipt merge then pulls
  only into an explicitly restored account replica. Semantic baseline digest guards
  unsent account edits; dirty/unknown replicas retain their content as HISTORY_REVIEW.
  Background still uploads enrolled evidence only; full headless merge/pull and
  durable correction journal integration remain open. No automatic flags are enabled.
- Source status reports observed accepted-metadata range/count plus acknowledged and
  pending derivatives; total library coverage remains unknown. Gated removal preview
  pages actual facts and available private media, explains unavailable previews,
  source-original continuity and URL/offline limits, then confirms all-page removal.
  SQL binds expected account/source snapshot revisions and the full immutable preview
  request receipt under the owner lock. Independent owner facts remain retained.
- Parent ran eight actual isolated Postgres17 rollback fixtures successfully with
  source-media, M6-controls, aggregate-continuity and source-impact drafts. Those local
  drafts are not hosted migration/deployment evidence. Two early PG failures exposed
  alias shadowing and old fixture revision compatibility; both were corrected and
  recorded in the playbook, and the final run passed.
- Four focused continuity/source/service/panel suites pass 20 tests; actual account
  SQLite passes six scenarios; mobile typecheck and lint pass. Parent previously ran
  the broader 79-suite/733-test mobile tree before this final slice. Physical viewport,
  native-media upload/playback, cross-device lifecycle and reconstruction accuracy
  remain unverified. General concurrent correction mutation/resolution is next.

### Headless completion and correlation continuation map (before implementation)

- `history-service.action` owns one random `local_<32 hex>` correlation and passes
  it to native synchronization and the authenticated merge transport header. Worker
  diagnostics accept that exact value; operation IDs remain separate and unlogged.
- `history-sync-native.runBackgroundAccountSync` enters the same correction/upload/
  merge/pull runner once with background scheduling. A failed action returns false
  to TaskManager; it cannot report success after a swallowed merge/pull failure.
  Foreground/background contention is ALREADY_RUNNING/skipped. Backoff-deferred
  upload remains deferred and does not trigger an immediate foreground retry.
- `correction-sync.syncOwnerCorrections` wraps local load/save/accept failures as
  HISTORY_STORAGE at HISTORY_STAGE or HISTORY_READ; transport acknowledgement is
  HISTORY_NETWORK/unknown at HISTORY_CORRECTION. Stale owner is HISTORY_FENCED/
  skipped. Content/schema failure remains HISTORY_SCHEMA, and retained proposal
  conflict is HISTORY_CONFLICT. The action emits one terminal without raw errors.
- Collection: confirm current com.anonymous.travellife package and process plus
  matching bundle; filter `[Travel Life diagnostic] HISTORY_TRANSFER` and worker
  HISTORY_SYNC by the one local correlation. Store private raw logs only in ignored
  local diagnostic directories. Synthetic headless/fault/redaction checks establish
  orchestration, not actual OS execution or physical Android/iOS convergence.

Correlation refinement: the existing sole mobile logger's locally generated
`runtime-<base36 time>-<local sequence>` correlation is retained end-to-end. Worker
admission accepts only that bounded exact pattern or `local_<32 hex>` and replaces
all other untrusted values. Neither format derives from owner content or mutation
identity. This avoids adding a native dependency to diagnostic generation.

Resolution continuation map: `history-store.resolveCorrectionJob` records the selected
resolution at HISTORY_STAGE only; it never writes proposed rows into an accepted
baseline. Its exact conflict marker and original row digest survive loss of response,
convergence disabled and restart. `syncOwnerCorrections` recognizes the resolved
marker without resubmitting; convergence compares current rows to those immutable
original rows before replacing. Additional local edits stay HISTORY_REVIEW. Only
`saveReplica` atomically installing a newer authority with the acknowledged owner
revision may clear that matching resolved marker. Owner/account deletion clears the
private correction checkpoint with other owner jobs. SQLite failure remains
HISTORY_STORAGE/failed, stale action skipped, conflict retains prior target/marker.

Initial-authority compatibility map (before implementation): explicit M7 restore
(correction and convergence gates on) must merge the initial source snapshot before
restoring canonical account IDs. M6-only restore remains independent. Store the
baseline authority kind beside its semantic rows. Dirty legacy/unknown initial
baselines are HISTORY_REVIEW at HISTORY_READ and remain intact; never send their
source-local IDs as a canonical correction or silently remap/drop an edit. Clean
initial replicas may merge/pull through the normal digest guard. Missing kind is
unknown/legacy, never presumed canonical. Host refusal/merge-order tests precede
any physical migration claim; explicit compatibility review remains required for
already-edited initial replicas.

### M7 resumed integration evidence (2026-10-29)

Bundle deployment repair map (before implementation): the generated worker module
embeds the exact country dataset compressed at build time. Decompression happens
once at module initialization, before requests; failure leaves the function
unavailable and does not mutate account state. Per-request diagnostics remain the
existing HISTORY_SYNC/HISTORY_CONFIG unavailable/blocked boundary, or gateway
unavailable if initialization fails before the handler; no content is logged.
Compare decompressed data byte-for-byte with source and execute existing worker
and mobile merge regressions. Hosted deployment and a synthetic gateway invocation
are required to establish that the 413 is resolved; local compression is not proof.

- All 33 account Jest suites pass 163 tests, including the real service/transport
  offline identity regression, canonical merge-before-M7-restore ordering, dirty
  legacy baseline refusal, source-unavailable correction convergence and exact
  selected-resolution checkpoint semantics. Maintenance tests additionally verify
  an account failure cannot become TaskManager success; focused run passed 51
  tests in ten suites before the final explicit-restore test was added.
- Actual in-memory account SQLite passes seven tests, including resolved-marker
  retention on pointer rollback, unchanged accepted baseline until authoritative
  pull, matching resolution and deletion cleanup. Native execution remains open.
- Mobile typecheck passes. Native-free history-domain bundle was regenerated;
  worker runtime suite passes 22 tests including correlation validation/redaction
  and bundle freshness. Parent verifies root checks and final backend typing.
- Headless convergence now invokes the same correction/upload/merge/pull runner
  once with the background trigger, preserving upload retry/backoff rather than
  immediately invoking a foreground retry. Source-only read unavailability returns
  a distinct deferred lifecycle; true account-generation/session/consent fences
  still stop work. Failed account work is propagated to the OS result.
- Choosing a competing resolution retains its immutable local branch and selection
  marker until an authoritative pull commits; it never falsely acknowledges the
  proposed branch as accepted. New local edits remain protected by the digest guard.
- Explicit M7 restore combines initial authority before obtaining canonical IDs.
  Already-edited initial/unknown legacy baselines remain intact as HISTORY_REVIEW;
  their semantic ID migration requires explicit compatibility review. This is an
  open compatibility limit, not a silently completed migration.
- Gates remain disabled, no remote operation or owner-media upload occurred. Full
  Android/iOS two-device convergence, native derivative playback/resource envelope,
  source-offline playback, airplane cache behavior, actual viewport acceptance and
  hosted retention/session/object boundaries remain open. Synthetic results do not
  establish reconstruction accuracy or close AC-M7.7-4. Status stays in-progress.

### Replay fragment SQL compatibility diagnostic map (before SQL execution)

- HISTORY_TRANSFER/HISTORY_STAGE: source page grammar and receipt validation;
  HISTORY_SCHEMA blocked for malformed fragment, HISTORY_QUOTA blocked for bounded
  storage, HISTORY_NETWORK unknown for unacknowledged transfer. No local deletion.
- HISTORY_TRANSFER/HISTORY_ACK: source activation atomically checks ordered complete
  fragments and semantic Replay before replacing staged pages; invalid group is
  HISTORY_SCHEMA blocked and prior active authority remains intact.
- HISTORY_SYNC/HISTORY_SCHEMA: typed identity mapping validates codec and full scope;
  invalid codec is HISTORY_SCHEMA, stale source plan HISTORY_STALE, revoked session
  ACCOUNT_SESSION; never log source IDs, raw records or digest inputs.
- HISTORY_SYNC/HISTORY_ACTIVATE: aggregate page group validation/collapse occurs under
  existing worker generation/plan/CAS fence; malformed fragments HISTORY_SCHEMA,
  stale plan HISTORY_STALE and uncertain network acknowledgement UNKNOWN.
- Collection: match current Android package/build and worker revision; filter closed
  HISTORY_TRANSFER/HISTORY_SYNC events by local action correlation only. Synthetic
  SQL and worker fault/redaction cases verify boundaries before owner retry; no SQL,
  media, identifiers or private Replay data leave the device logs.

### Final activation timeout diagnostic map (2026-10-29, before correction)

Actual Android HISTORY_TRANSFER/HISTORY_ACK/HISTORY_NETWORK with unknown outcome
matches hosted PostgreSQL57014. Dashboard raw context identifies
collapse_replay_fragments line13 at IF, the growing-string concatenation/byte check.
Preserve the saved mutation, checkpoint and active authority. Optimize this helper
only: validate each ordered fragment, accumulate byte lengths, then assemble once;
update only pages containing fragments. Existing schema, quota, generation/CAS and
receipt semantics remain unchanged. SQL malformed groups remain HISTORY_SCHEMA;
transport interruption remains unknown until same-mutation reconciliation.
Collection uses closed device events and server SQLSTATE/function/line only, with
no private request/record output. A large synthetic rollback fixture must exercise
activation and exact retry under the hosted eight-second statement budget, alongside
all malformed-fragment and authority-preservation regressions.

Scale failure extended the map to valid_record fragment UTF-16 counting: eight-second
synthetic timeout at its RETURN. Count supplementary code points directly instead
of removing every BMP character; same admission contract and HISTORY_SCHEMA remain.
Existing emoji-limit and Unicode roundtrip tests apply before deployment.

### Activation timeout correction verification and deployment (2026-10-29)

Migration20261029143353 now performs one ordered string_agg after validating every
fragment and accumulating byte lengths. UTF-16 admission counts supplementary code
points directly, preserving the exact JavaScript code-unit limit. Only pages from
the first to last fragment are rewritten. Existing atomic authority/CAS/receipt and
quota guards remain. Three scoped reviewers found no static correctness defects;
verification gaps led to adding aggregate commit/plan reconciliation at scale.

Old helper reproduced eight-second57014. First candidate exposed the additional
regex bottleneck and was corrected before deployment. Full PostgreSQL14 rollback
fixtures pass, including Unicode/malformed-group fences and24MiB exact source and
aggregate activation/reconciliation. Measured local activation1.259s/1.099s;
additional60MiB synthetic rollback probe3.502s/2.699s. These are host timings, not
owner-device latency claims. Root check130 tests/eval smoke pass. Hosted role read
confirms authenticated8s; scoped dry run/apply included this migration only. Live
read-only verification confirms both new definitions, revoked helper access and
8192-emoji acceptance/8193 rejection. Owner same-checkpoint retry remains required.
Review noted maximum envelope and role-specific RPC admission need broader ongoing
acceptance; existing small authenticated page/worker protocol regressions remain.

### Hosted merge CPU exhaustion diagnostic map (2026-10-30, before correction)

Owner sync reaches second HISTORY_REBUILD after identity allocation, then Edge546;
function runtime explicitly reports CPU Time exceeded. Initial source remains saved
and active combined revision is not acknowledged. Preserve operation/checkpoint.
Synthetic CPU profile (500/3000 evidence, identical coordinates) identifies repeated
cluster distance scans and minimax scoring in reconstruction/engine.ts as dominant;
3000 evidence costs1.45s user CPU before Replay/local-source reprojection. Optimize
exact-coordinate repeated distance work without changing membership, uncertainty,
distance thresholds, temporal policy or ID ties. Add differential dense/mixed/
antimeridian/input-order coverage; rerun engine/canonical/worker suites and eval
smoke per evals/README.md. Product accuracy remains not_measured. HISTORY_REBUILD
remains closed stage; CPU termination outside handler remains gateway-unavailable
with unknown outcome, never a claimed rollback. Collect fixed function resource
reason and stage only. Final owner/device merge evidence remains mandatory.

CPU correction diagnostic refinement (before instrumentation): worker-only optional
merge progress emits fixed HISTORY_NORMALIZE, HISTORY_PROJECT,
HISTORY_REPLAY_PROJECT and HISTORY_REPLAY_MAP through the existing closed backend
logger and original action correlation. These identify normalization, canonical
account projection, local Replay projection and support/group remapping respectively.
Domain schema/review failure remains blocked; forced worker termination remains
unknown from the client. No record IDs/counts/CPU traces enter runtime events.
Fault injection at each new stage must verify exact classification, one terminal
outcome, six-field shape, correlation and sentinel redaction before deployment.

Large merge metadata preflight (before correction): source-copy provenance is
required by media selection and source-removal review, but the activation header
currently repeats all copies inside a400k request envelope. Synthetic3000-evidence
coverage must prove this does not block after CPU repair. For oversized metadata,
send a bounded version3 header with sourceCopiesFromPlan=true; trusted commit derives
the exact copy list from its already-fenced immutable source plan and literal
identity mappings. No data truncation. Store metadata under the existing64MiB
owner envelope alongside semantic pages; keep RPC input524288 and page bounds.
HISTORY_METADATA fixed boundary maps to SQL finalize-copy metadata derivation;
missing mapping/schema or quota blocks atomically, stale plan remains skipped,
unknown gateway outcome retains operation. SQL source-copy parity, media/source
review regressions, malformed marker, absent mapping, and quota rollback checks
are required before enabling the header.

### Hosted scale CPU recurrence (2026-10-30, before follow-up)

Current synthetic hosted request reaches HISTORY_NORMALIZE, HISTORY_PROJECT, HISTORY_REPLAY_PROJECT, HISTORY_REPLAY_MAP, then runtime CPU_LIMIT at 23:46:05 UTC. 3000 evidence and 19MB Replay reproduce; no owner record used. Source activation/exact retry pass. Follow-up removes repeated parsing/serialization of already portable validated Replay and discarded allocation-pass output, preserving validation at each public entry and identical identity traversal. Existing diagnostic map remains: HISTORY_REBUILD for allocation, HISTORY_NORMALIZE for final normalized rows, HISTORY_REPLAY_MAP for final support mapping; CPU termination is still unknown outcome. Extend semantic long-Replay parity and mutation/malformed rejection regressions. Add residual HISTORY_METADATA/HISTORY_QUOTA/redaction guard regression from verification review. Hosted success is required before owner retry.


CPU follow-up reached HISTORY_ACTIVATE before forced CPU termination (23:51:14 UTC), so parsing reduction helped but did not close the incident. Synthetic profiler now identifies repeated evidence.find in visit materialization and learned-base lookup as dominant. Replace these exact-ID scans with per-invocation first-match indices, retaining original duplicate-ID behavior, member order, temporal sorting and all uncertainty/threshold rules. Existing HISTORY_PROJECT and HISTORY_REPLAY_PROJECT boundaries map to these modules. Verify frozen-engine full-graph differential cases and canonical regression suites before another hosted test.


Indexed candidate still exhausts CPU at HISTORY_ACTIVATE on hosted large Replay. Source/receipt success is preserved; do not claim merge acceptance. Worker bundle startup currently expands multi-megabyte base64 datasets with Uint8Array.from string iteration plus callback for every byte. Replace only this byte-copy with an indexed charCodeAt loop, preserving exact gzip/JSON bytes verified by existing compressed-dataset roundtrip test. This is initialization work before HISTORY_AUTH; resource termination remains platform unknown. No semantic data changes.


### Combined large Replay/provenance SQL timeout (2026-10-30, before correction)

After startup byte-copy optimization hosted merge no longer terminates on CPU. It reaches HISTORY_ACTIVATE and reports UNKNOWN/503; PostgreSQL57014 at23:58:50 UTC maps exactly to finalize_aggregate_metadata line6, its missing-mapping EXISTS query. Existing metadata fixture lacked a large Replay sharing a source page with evidence; separate large-Replay tests did not execute plan-derived metadata. Add this combined fixture. Materialize only evidence scalar fields once before joining mappings, and derive missing-mapping admission and sourceCopies in one aggregate scan. Preserve exact source plan, literal codec mapping, deterministic copy ordering, quota rollback and CAS/receipt behavior. HISTORY_ACTIVATE/UNKNOWN remains unknown acknowledgement on transport SQL timeout; no generic success or rollback inference. No owner data is involved.


### Follow-up verification and scoped deployment (2026-10-30)

Full mobile99 suites/914 tests and SQLite105 pass; TypeScript/lint and root136/framework/eval smoke pass. Worker57 includes residual metadata overflow correlation/redaction/no-activation regression. Portable Replay validation parses once and rejects changed local handles. First-match evidence indices retain frozen-engine full-graph parity on60 synthetic datasets plus reversal. Startup byte-copy retains exact compressed dataset bytes. One follow-up reviewer verified these changes and the metadata migration; original blind/edge reviewers could not complete due to runtime network/usage failures, so full independent three-layer completion is not claimed.

New combined24MiB Replay/evidence-page fixture fails old provenance helper with57014 and passes materialized evidence scalar helper. Full PostgreSQL15 fixtures pass including exact provenance, media/source controls, absent mapping, quota rollback and same-operation receipt. Migration20261030000041 dry-run/apply included only this file; live definition is materialized and authenticated/anon helper EXECUTE remains false. Hosted3000-evidence/19MB Replay two-session smoke is running. Keep whole M7 spec in-progress; physical device acceptance and broader scope remain open.


### Structured Replay page-write investigation (2026-10-30)

Actual single-statement hosted rollback probe measures source/aggregate collapse14.657s/16.528s; local analogous UUID fixture1.137s/0.982s. A session-only LZ4 probe worsens hosted times28.459s/35.662s, so compression change is rejected. Synthetic stage profiling identifies first large page UPDATE5.389s plus later page updates2.867s, before cumulative validation cost; a split SQL CASE candidate does not close the budget and is rejected. Investigate replacing only the first large page through targeted DELETE/INSERT in the same transaction, preserving PK/content_digest and all receipt/CAS checks; verify no child foreign keys/triggers before any production change. No parent authority can observe an intermediate state. On failure transaction must roll back exact original fragment pages, matching HISTORY_ACTIVATE unknown acknowledgement semantics. Measure candidate in hosted synthetic rollback before adopting it.


### Bounded finalization budget (2026-10-30, before implementation)

Hosted structured collapse repeatedly exceeds8s despite byte-identical local passing checks; targeted reinsert and compression candidates do not close the budget and are not adopted. Official Supabase function-timeout/PostgREST hoisting documentation supports per-RPC settings. Add an authenticated activation-only wrapper and a service-only aggregate-commit wrapper, each statement_timeout60s, delegating to all existing owner/session/plan/CAS/quota/receipt guards. Do not change global/role timeouts or storage encoding. Restrict every other action/phase at the wrapper. Source activation transport gets65s; other history requests stay30s. Merge transport gets120s beneath the hosted150s request ceiling so it can reach commit rather than abort at30s. Timeout remains HISTORY_NETWORK/unknown; retain exact mutation/operation checkpoints and do not restart transfer. Correlation stays the same. Map source wrapper to HISTORY_TRANSFER/HISTORY_ACK and service wrapper to HISTORY_SYNC/HISTORY_ACTIVATE; wrapper guard failure HISTORY_SCHEMA/blocked. Regression matrix: action/phase isolation, anon/owner/session denial, same receipt, timeout scopes/correlation/redaction and frontend interrupted-job retention. These are runtime budget defaults derived from actual hosted timings, not a latency promise or a maximum-quota acceptance claim.


### Bounded finalization deployed and hosted merge acknowledged (2026-10-30)

Migration20261030002113 dry-run/apply included only the two narrow wrappers. Live config confirms both are SECURITY INVOKER, search_path empty, statement_timeout60s; anon source and authenticated worker EXECUTE are false. Worker now routes only activate/commit to the service wrapper. Source transport routes only activate to the authenticated wrapper; other requests remain30s. Tests lock request/correlation identity and65s/120s windows. Full mobile99/916, SQL16, worker57, SQLite105, typecheck/lint and root136/eval smoke pass. Scoped independent review found no bypass or new defect. Hosted synthetic3000 evidence with19MB source Replay now completes source activation/exact retry and merge (85.664s). Same operation/two-session exact-pull checks are still running. Owner and physical two-device acceptance remain open; do not mark whole M7 complete.


Readback continuation (before implementation): hosted merge85.664s succeeded, but the first full pull hit SQL57014. Extend existing restricted60s RPC to action pull (snapshot/aggregate read only) as well as activate; client65s only for these large-record operations, status/page/control remain30s. Delegate to unchanged public history owner/session/snapshot guards, no alternate reader. HISTORY_RESTORE/HISTORY_READ maps to readback boundary; timeout remains unknown and complete remote aggregate is retained. Add exact route/budget/readback parity guard tests and rerun full host smoke. This revises the engineering action whitelist for the wrapper, not privacy or synchronization authority.


Readback scope refinement from correlated evidence: current SQL57014 is readable_prior_aggregate line13, which rebuilds/compares complete old/live rows for every page even when both snapshot IDs are identical. Adopt an immutable-snapshot fast path after live-source existence/removal checks, retaining full row comparison for changed snapshots and the final added-source owner-fact check. Cache the current plan once per call. Do NOT widen readback RPC budgets or route pull to the finalization endpoint; the preceding readback-budget proposal is superseded by this proven redundant scan repair. Source snapshots become immutable at activation under existing receipt/page guards. Verify identical snapshot with large Replay, changed source/privacy/source removal cases and two-session pull parity.


### Final hosted verification (2026-10-30)

Migration20261030003148 applied alone after dry run; live immutable-snapshot fast path is present and helper client EXECUTE remains revoked. Full PostgreSQL16 fixtures pass including changed-source/privacy continuity and30 repeated reads of the same24MiB source snapshot. No pull timeout/route widening was implemented. Final hosted fixture passes:3000 synthetic evidence plus19MB source Replay; exact source activation retry; merge complete86.129s; same operation returns the identical aggregate/revision; two independent Auth sessions each pull all76 pages, produce identical full semantic history, retain3000 distinct evidence IDs and preserve the80 selected memory references in committed reverse order. Synthetic owner deletion is fenced and scheduled purge is pending. This closes the demonstrated host/synthetic sync failure path, not physical owner acceptance or whole M6/M7 readiness.

Final software checks: mobile99 suites/916 tests; SQLite105; worker57 including closed-stage/correlation/sentinel-redaction failures; PostgreSQL16 fixtures; TypeScript/lint; root136/framework/eval smoke. One scoped independent reviewer checked CPU/Replay, metadata, budgets and continuity changes without new findings; the original blind/edge runs did not finish due to runtime limits. No owner evidence was read, no app data/checkpoint was reset, and no Git stage/commit/push occurred. Device collection recipe remains fixed HISTORY_TRANSFER/HISTORY_SYNC/HISTORY_RESTORE events correlated by local action; reload the current bundle and resume the existing Sync account history job. Report operation/stage/reason/outcome only, never raw IDs/content.


### Owner native export lock diagnostic map (2026-10-30, before correction)

Fresh Android action stops after export schema at HISTORY_EXPORT_TRANSACTION/DATABASE_BUSY before HISTORY_EXPORT_LIFECYCLE: writer-reserving BEGIN IMMEDIATE failed; holder is unknown. Export only reads semantic rows, so add optional deferred read mode to the existing owned transaction gate, defaulting all writers to their current immediate mode. Export uses this read snapshot, without network work in its turn. Explicit phase callbacks map HISTORY_EXPORT_BEGIN, HISTORY_EXPORT_COMMIT, HISTORY_EXPORT_ROLLBACK to driver boundaries; preserve DATABASE_BUSY/NATIVE_HANDLE/TRANSACTION/CONSTRAINT classification and sentinel redaction. Never release ownership before rollback settles. Read failure and close precedence remain unchanged; no retry/new mutation is invented. Add a specific busy UI message retaining the saved checkpoint. Real SQLite test must hold an uncommitted writer on another connection and verify export reads the last committed complete snapshot without taking a writer reservation; next export sees committed changes. Add fault tests for begin/commit/rollback phase and closed diagnostics; rerun native/export/service suites and required checks. Device retest remains mandatory, because the native lock holder is unknown.

### Owner replay projection CPU recurrence (2026-10-30, investigation before behavior changes)

Diagnostic refinement before implementation: postpatch owner retry still ends in HTTP546 after HISTORY_REPLAY_PROJECT. Forward the canonical projector's ten existing closed REBUILD_* checkpoints through the account merge profile with fixed HISTORY_PROJECT_ or HISTORY_REPLAY_PROJECT_ prefixes. The worker logger admits only those twenty combinations, keeps the same six-field event and action correlation, and maps exceptions through existing reasons/outcomes. This separates baseline graph, correction mapping, continuity and membership without row counts/IDs/content. Instrumentation adds no I/O or product behavior. Test every allowed phase with sentinel-redaction/correlation failure injection and verify actual domain forwarding; rebuild and deploy only this worker. Keep CPU incident open until actual owner phase evidence and successful acknowledgement.

Detailed owner checkpoint result: all account/source canonical phases complete, then HISTORY_REPLAY_MAP START immediately precedes CPU Time exceeded/546. Correct the demonstrated mapping boundary: preindex final visit evidence to journey membership and intersect target sets for all exact mapped support, preserving target order, complete-support containment, duplicate handling and unique-target requirement. Keep mapped duplicate-family resolution and unresolved Replay review unchanged. Add many-support/many-journey deterministic work regression plus differential mapping parity. Existing HISTORY_REPLAY_MAP and closed failure/redaction tests remain the diagnostic boundary; no private workload extraction. Rebuild/deploy worker and rerun diverse hosted synthetic plus existing checkpoint owner retest.

Post-mapping hosted synthetic now reaches ACTIVATE before cumulative CPU termination. Local sampled synthetic merge spends dominant time in reconstructV1; both account and source projections rescan ordered supports for every GPS-less item to select before/after. Optimize only immutable bracket lookups with time-sorted precise support entries, prefix maximum original index and suffix minimum original index, queried with strict lower/upper bounds. Preserve original support order selection (not chronological nearest), null-to-zero comparison behavior, strict timestamps, missing item date semantics and ambiguous bracket/suggestion priority. Frozen full-graph differential cases and explicit nonchronological/null/equal-time bracket cases must pass; add operation-count guard, retain existing diagnostics. This addresses cumulative request CPU without increasing platform limits or bypassing activation guards.

Profile refinement: binary bracket candidate did not materially reduce total CPU and is rejected/not deployed. Disabled-inlining profiler attributes329 samples to civilDayMillis versus133 reconstructV1. Adopt bounded2048-entry in-memory cache of the exact pure string-to-valid-civil-day result, including null invalid result, clearing on capacity. No row/account IDs or persistent state, no dates in diagnostics. Preserve original regex/Date.parse/roundtrip validation. Regression repeated identical date parsing work, invalid/leap dates, and frozen graph parity; existing PROJECT/REPLAY_PROJECT phase contract remains unchanged.

Fresh owner retry now completes native export BEGIN/read/COMMIT/CLOSE. Correlated Supabase function log for the same local action reports HISTORY_SYNC/HISTORY_REPLAY_PROJECT/START, then CPU Time exceeded and HTTP546 at 11:56:38 Asia/Bangkok. This establishes hosted CPU termination, not a native lock or generic connection timeout. Prior overlapping action reports HISTORY_REPLAY_MAP/HISTORY_REVIEW/blocked; preserve its review semantics. Do not read or export owner rows. Synthetic3000 same-location evidence is insufficient workload coverage.

Investigate source-local canonical projection, repeated account/source projection and Replay support mapping with synthetic diverse location/day/journey/correction shapes. Diagnostic map: existing HISTORY_SYNC/HISTORY_PROJECT and HISTORY_REPLAY_PROJECT identify projectCanonicalHistory calls in history-merge.ts; add closed fixed stage milestones inside canonical projection only if needed to isolate sub-boundary, propagated through history-runtime.ts under the same action correlation. Expected CPU platform termination remains unknown durable outcome, preserve exact merge operation/checkpoint, no reset/retry with new IDs. No change to canonical distances/order/ties, owner corrections, privacy or unresolved Replay review authority. Performance correction requires differential parity against frozen current graph on diverse synthetic shapes, a meaningful workload regression, fault/redaction tests for any added diagnostic, regenerated native-free domain, worker57, mobile account/reconstruction tests, typecheck/lint/root check. Validate representative hosted synthetic execution after local correction; owner retest remains a separate boundary. Preserve unrelated dirty work and do not stage/commit/push.

### Native export correction and verification (2026-10-30)

### GPS-less canonical membership and Replay continuity follow-up (2026-10-30, before correction)

Synthetic mixed-GPS hosted fixture reaches REPLAY_MAP/HISTORY_REVIEW. Read-only local randomUUID allocation reproduces: graph.journeys has one canonical target while GPS-less memberships retain a legacy journey ID absent from that graph. This is a demonstrated consistency defect; review itself is correct. Investigate minimal canonical membership remap from each legacy journey's exact visit support to a unique final journey. Preserve supported/owner/inferred/suggested state, reasons, source evidence and ambiguity; never infer a unique target across a split or override protected owner corrections. Ensure old committed Replay group references can only reconcile through the same unique exact-support mapping; otherwise keep explicit review and all selected choices. No silent selection dropping, broadened privacy or altered spatial/time rules. Diagnostic map: canonical remap is under HISTORY_*_REBUILD_CONTINUITY and account Replay mapping under HISTORY_REPLAY_MAP; unresolved identity remains HISTORY_REVIEW/blocked with existing correlation. Add actual mixed-GPS canonical and normalized Replay regressions, split/ambiguous/protected/privacy cases, full graph invariants and semantic parity outside corrected stale-membership cases. Preserve unrelated work. CPU incident remains independent and open pending detailed owner checkpoints.

Implemented deferred read mode under the existing owned transaction gate, leaving writers immediate. File-backed SQLite regression fails with the original writer reservation and passes with a consistent committed read while another connection holds an uncommitted writer; the next export sees its committed update. BEGIN/COMMIT/ROLLBACK diagnostics identify exact failing boundaries. Rollback failure retains quarantine; observer failure cannot release ownership. Busy recovery copy explicitly preserves the saved checkpoint.

Verification: focused50 tests; full mobile99 suites/921 tests; SQLite106; TypeScript/lint; generated-domain freshness; root136/framework/eval smoke all pass. Scoped independent reviewer reports no concrete findings. Existing local evidence logs are under ignored .local/native-export-*.log. Android closed logs contain only the earlier TRANSACTION failure, with no post-correction action observed. Host bundle freshness check was not executed because automatic approval review hit a usage limit. Next owner step: reload development client, resume existing Sync account history once, and collect only fixed HISTORY_TRANSFER stages/reasons/outcomes with their local correlation. Never reset storage or replace the checkpoint. Device success, actual writer identity and whole M7 acceptance remain open.


CPU recurrence refinement (before correction): synthetic 600-row mixed-precision,
80-place, half-GPS-less projection profile attributes its dominant samples to
engine.ts GPS-less compatible-support materialization (repeated visits.find and
input.find at the nested item/journey/support boundary). The 3000-row version
exceeds the earlier same-coordinate workload by orders of magnitude. Reuse
first-match visit/evidence indices, materialize unchanged per-journey support order
and civil-day summaries once per reconstruction invocation. Preserve strict
before/after predicates, first/last support order, ambiguous bracket/suggestion
semantics and every graph ID. Existing HISTORY_SYNC/HISTORY_PROJECT and
HISTORY_REPLAY_PROJECT identify this engine call; domain exceptions continue
through existing HISTORY_REVIEW/blocked, platform CPU termination remains unknown.
No new asynchronous/fallible I/O boundary or diagnostic category is introduced.
Frozen full-graph differential parity and an executable support-access complexity
regression are required; no owner rows are read.

CPU recurrence local evidence:120 frozen full-graph differential cases match
(60 diverse seeded datasets and reversed enumeration including duplicate IDs,
missing GPS/date/offset, unavailable/excluded/conflicted rows, owner/home boundaries
and grouping constraints). The600-row work guard measures27,009,172 ID accesses
before and9,172 after (<50k). Matching3000-row local baseline graph drops87.162s
to0.383s (~85.7s to0.422s user CPU). Focused engine/account merge70 tests pass.
These are host performance/semantic parity checks; product accuracy not_measured.
Support summaries run only with association candidates and avoid spread min/max.

Collection recipe: deploy only generated native-free domain/current merge worker;
verify source digest/deployed version, then run matching synthetic diverse fixture
with a fresh non-identifying action correlation. Filter actual deployed structured
HISTORY_SYNC events by that correlation; retain only operation/stage/reasonCode/
retryable/durableOutcome/correlationId. Observe PROJECT, REPLAY_PROJECT, REPLAY_MAP
and final acknowledgement. Platform CPU termination remains unknown and requires
exact same-operation reconciliation. Keep synthetic profiler/differential outputs
under ignored .local. Do not export owner rows or raw request logs. Owner reload
and resume of existing saved job remains separate after hosted synthetic success.

Replay-map follow-up investigation (read-only): the diverse synthetic fixture
reaches REPLAY_MAP/HISTORY_REVIEW after the CPU correction. Random-UUID local
allocation reproduces replay-group-needs-review3/3, with one canonical journey,
1500 mapped visit-support IDs and zero missing support, but two journey IDs in
the membership-derived committed refs. constructCanonicalV11Graph remaps only
memberships that have visitByEvidence; GPS-less associated memories have no visit
and retain a legacy journey ID absent from graph.journeys. The Replay mapper
correctly refuses that absent group. This is an existing canonical-membership
integrity defect requiring a separate scoped decision/test, not justification to
suppress review or change owner composition. No behavior correction was made.
A distinct3000-coordinate dense source projector costs~862ms BASELINE_GRAPH and
~937ms user CPU locally. Latest owner termination remains a separate unresolved
CPU recurrence; collect canonical substage diagnostics before further optimization.

Replay CPU exact-boundary refinement (before correction): fresh owner detailed
checkpoints complete all canonical phases and stop after HISTORY_REPLAY_MAP START
with platform CPU termination. Replace only its nested exhaustive target/visit/
evidence scans with an invocation-local inverted visit-evidence-to-journey index
and intersection. Empty/missing/split/overlapping support stays unresolved; all
support must have exactly one target. This remains HISTORY_SYNC/HISTORY_REPLAY_MAP,
HISTORY_REVIEW/blocked for unresolved authority; resource termination remains
unknown. Add exhaustive-reference differential and support-access work regression.

Replay continuity and support-index verification: minimal canonical repair maps
GPS-less associated memberships only when all legacy visits have exactly one
surviving final journey. Protected identity remains unchanged; split, missing and
overlapping support do not map. Legacy committed source Replay IDs reconcile
through this same unique mapping, preserving every selected reference/order;
unknown groups still remain pending/review. Inverted visit-evidence support index
replaces exhaustive per-source-journey scans under existing REPLAY_MAP diagnostics.
Five focused suites/90 tests pass, including mixed-GPS canonical and exact legacy
Replay, split/missing/overlap/protected guards,65 exhaustive-reference intersection
cases and1000-journey/30k-support work regression (1000 visit-support reads total).
Three3000-row randomUUID local runs retain Replay without review after repair.
These are synthetic software checks; owner CPU/Replay acceptance stays open.

Integrated mapping/date-cache verification (2026-10-30):100 mobile suites/929 tests, SQLite106, worker78 including20canonical-phase fault/redaction cases, TypeScript/lint and root157/framework/eval smoke pass. Generated native-free graph is current. Initial CPU repair received3 completed scoped reviews; latest membership/mapping review attempts all failed due usage limits, so independent approval for this increment is not claimed. Parent source inspection verified visit support remains separate from associated media, missing/split/overlap remains unresolved, original selection/order is retained, and fixed diagnostic forwarding remains closed. Exact civil-day result cache is bounded2048, validates invalid/leap days identically, and has120 frozen graph parity cases plus3518-to9 parse work regression. Binary bracket experiment was rejected and is absent. Latest worker deployed through Docker. Hosted photo-Replay fixture and owner retry remain in progress; no success claim until their acknowledgement. No app storage/checkpoint reset or Git stage/commit/push.

Final hosted photo-Replay GREEN:3000 mixed-GPS evidence and80 selected references merge71.558s. Exact operation retry returns same aggregate/revision. Two independent Auth sessions pull all57 pages identically,3000 unique evidence and exact reverse committed Replay order retained. Synthetic deletion fenced with scheduled purge pending. Hosted closed COMPLETE/ACTIVATE and COMPLETE/ACK events observed. Latest owner event on preceding increment is REPLAY_MAP/HISTORY_REVIEW/blocked (05:57:40UTC); no final-cache owner completion observed. Keep that review unresolved and retain all owner choices; request final current-client outcome rather than claim acceptance. Maximum quota/load and physical two-device readiness remain open.

Owner final-cache retry06:06:04UTC logs HISTORY_REVIEW/blocked at REPLAY_MAP followed by CPU termination; client receives unknown NETWORK. Before any semantic change, classify review with fixed stages HISTORY_REVIEW_REPLAY_GROUP, HISTORY_REVIEW_CORRECTION, HISTORY_REVIEW_DUPLICATE. For unmapped committed group, fixed source phase HISTORY_REPLAY_GROUP_ABSENT or HISTORY_REPLAY_GROUP_TARGET identifies whether the normalized group lacks a current/unique legacy source target, versus has a source target but no unique account target. Preserve closed correlation/outcome, no group ID/count/media/error contents. Add actual domain unresolved source-group test plus backend per-review-stage classification/redaction and repeat caller operation retention. No review bypass or data edits. Collect next owner event before choosing recovery behavior.

Review-category deployment verification:82 worker tests,86 focused mobile tests, typing/lint, root161/framework/eval smoke and120 frozen graph parity pass. Docker deploy acknowledged. Hosted isolated one-manual/one-Replay absent-group probe returns409/HISTORY_REVIEW for both identical operation attempts and does not activate an aggregate. Cleanup fenced/purge scheduled. New categories are diagnostic only; original choices/checkpoints remain intact. Await owner current request subtype; no product acceptance claim. Metro start.log is stale; current ADB or matched server correlation is the collection source.

Owner runtime-mvukpa52-h06:10:48UTC confirms REVIEW_CORRECTION plus REPLAY_GROUP_TARGET. Correction review has only two construction sources: retained removed-source owner facts (sourceId field) and canonical pending remap (revisionId field). Refine backend closed categories to HISTORY_REVIEW_RETAINED_SOURCE and HISTORY_REVIEW_CORRECTION_REMAP based on presence only; never emit the field values. Existing generic fallback remains for legacy domain shapes.84 worker tests verify category/retention/correlation/redaction, including retained-source integration. This refines the existing diagnostic map only, without product-state changes or new private evidence access. Root/full mobile semantics already verified; deploy to collect the actual corrective boundary before proposing recovery.

Owner runtime-mvukvcow-i06:15:40UTC confirms CORRECTION_REMAP. Synthetic90-row mixed-precision graph reproduces finalMatches1 and pendingFinalRemaps1 for the same place correction: baseline/confirmed mappings are ambiguous before canonical continuity, while final mapping uniquely succeeds. Before correction: only remove intermediate pending entries when finalMatches contains the exact revision. Final pending, missing/split support and structural/privacy guards remain blocked. Source boundary canonical-projection.ts final-mapping reconciliation; existing HISTORY_*_REBUILD_FINAL_MAPPING diagnostics and REVIEW_CORRECTION_REMAP cover it. Add a failing real-projection/account-merge regression proving unique final mapping clears stale review, plus genuine unresolved regression. Preserve corrections/Replay choices and graph topology; regenerate domain, run targeted/full checks, hosted mixed correction+Replay fixture and owner retest. No data edits/reset.

Additional synthetic RED: same90 native rows with nullable source_origin produce a unique native final correction, but account normalization rewrites null to explicit unknown and changes canonical grouping, causing CORRECTION_REMAP and Replay target mismatch. Existing canonical-core explicitly retains established Android null-classification fallback and distinguishes explicit unknown. Preserve the original nullable provenance value through normalization; never rewrite explicit unknown/download/screenshot or add capture-like provenance. This maintains source/native reconstruction semantics under the binding provenance/version contract. Update the old unknown-origin fixture to explicitly supply unknown, and assert both null-preservation/native-account correction parity and explicit unknown retention. Diagnostic boundary remains NORMALIZE then final remap/replay map; no additional data logging.

Correction CPU profile before optimization:3000 synthetic evidence plus full-journey place correction and Replay reaches546; local disabled-inlining samples identify applyJourneyCorrections visit candidates and cross-visit ambiguity scans (194 samples) plus repeated support validation. Build an invocation-local evidence-to-visit-row-index map only when corrections exist, preserving original row multiplicity, complete support containment, missing/split/overlap failures and visit-ID comparison rules. Use Sets for exact reviewed support partition validation while retaining original sort/length/duplicate guards. No spatial/temporal/provenance or correction semantics change. Add600-visit/3000-support deterministic property-read guard, frozen old/new correction results including invalid/overlapping rows, current correction/privacy suites and hosted full correction+Replay retry. Existing canonical phase diagnostics identify errors; no private evidence extraction.

Final correction/provenance verification:100 mobile suites/931 tests, SQLite106, worker84, TypeScript/lint and root163/framework/eval smoke pass.600-visit support read regression drops2,160,000 to under10k;500 frozen old/new correction outcomes including duplicate/overlap match. Three independent reviews complete; verification gap for mixed resolved/unresolved revisions was patched with same-projection and account-merge assertions and reviewer recheck passed. Existing120 full-graph parity remains valid outside the explicit stale-pending/provenance correction.

Hosted nullable provenance + correction + photo-Replay GREEN:3000 evidence, effective place correction,80 selected references; merge55.157s; exact same-operation retry returns same aggregate/revision. Both independent Auth sessions read all57 pages identically, null provenance/effective correction/3000 unique evidence/exact committed reverse Replay order retained. Synthetic deletion fenced/purge scheduled. Worker version28 ACTIVE updated10:38:20.667UTC (17:38:20.667Bangkok). Last owner17:38:12 REVIEW_CORRECTION_REMAP event is before this deployment; current-version retry is pending. USB reverse restored and owner confirms app visible; no data/checkpoint resets or Git stage/commit/push. Owner/two-device acceptance and max-quota/load remain open.

Owner current-version retry17:53:39Bangkok now passes all correction/Replay review and reaches ACTIVATE, then546/CPU termination. Full local worker probe (not merge-only) with3000 evidence, correction and200Replay references consumes2.031s user CPU; top samples assertPortableReplay443 and utf8Bytes161. Before optimization: memoize only successful portable-body validation by weak value-object key plus exact immutable body string; never cache row validity or mutable parsed objects, continue checking all fields/size/scalars and revalidate every changed body, never cache failure. UTF8 counting may use feature-detected TextEncoder in bounded64Ki-character chunks with surrogate-pair-safe boundaries, otherwise preserve existing manual implementation. Exact UTF8/quota behavior, including lone surrogates and capacity, must match. Map boundaries existing SCHEMA/METADATA/ACTIVATE; diagnostics/redaction unchanged. Add repeat-body/mutation/scalar regression, encoder/fallback Unicode differential + chunk-boundary/quota tests and full-worker profile; regenerate/review/host before owner retest.

CPU continuation verification (2026-11-07): successful Replay-body WeakMap memoization and feature-detected bounded TextEncoder pass100 mobile suites/932 tests, SQLite106, worker84, root163/framework/eval smoke, typing/lint and generated graph freshness. Three scoped source reviewers reported no concrete findings. Full synthetic handleHistoryMerge3000 evidence + correction +200Replay uses1.359s user CPU versus2.031s baseline. Hosted deployment/acceptance remains pending; no owner success claim or checkpoint/data reset.


Hosted200-reference acceptance fails at merge HTTP546 after successful source activation; synthetic account deletion fenced/purge scheduled. Backend failure phase remains unknown pending restored dashboard session. Automatic review rejected GitHub sign-in without specific owner authorization, requested permission/self-login. No further runtime behavior changes justified until correlated phase collected. Local probe with RPC JSON roundtrips uses1.625s user CPU; not hosted acceptance. All observed command/review/collection failures recorded in playbook.


Dashboard access follow-up: owner authorized GitHub sign-in; reached GitHub login successfully, but no active GitHub session exists. Waiting for owner to complete credentials/authentication in retained Chrome tab. Last server test remains HTTP546 at unknown current phase; do not infer ACTIVATE from the older owner run.


Activation diagnostic refinement before implementation (2026-11-07): current synthetic correlation local_8fdd1dc96afd540c83fc7a1a954bd5a5 logs CPU Time exceeded at16:16:53Bangkok immediately after HISTORY_ACTIVATE START; source/canonical/Replay/metadata preparation finish. Map worker activate RPC phases start/page/commit to fixed HISTORY_ACTIVATE_START, HISTORY_ACTIVATE_PAGE, HISTORY_ACTIVATE_COMMIT under the same HISTORY_SYNC correlation, UNKNOWN or NETWORK => unknown/retryable; stale=>skipped; quota/incomplete=>blocked. Source history-runtime.ts rpc calls; allowlist history-diagnostics.ts. Keep original general activation marker for compatibility, emit new phases at each RPC boundary without page index/payload. Collection: dashboard current worker logs last24h, exact synthetic correlation, fixed messages only. Add per-phase injected network/schema/stale failure/redaction tests, deploy diagnostics then reproduce synthetic200 references; no new semantic behavior or private owner retry yet.


ASCII byte-accounting candidate before implementation: current full worker RPC JSON profile reaches activation at1.312s user +0.875s system CPU; source/wire byte counting repeatedly allocates TextEncoder buffers for ASCII structural references. Existing historyWireBytes remains exact authority. Fast-path only strings with no UTF16 code unit above0x7f using native regex; byte count equals character count, enforce quota first. Unicode and surrogate strings use unchanged bounded encoder/manual paths. Add deterministic no-encoder-allocation guard for large ASCII, existing byte/quota parity, profile before keeping; no quota widening or row validity bypass. Stages SCHEMA/METADATA unchanged, closed errors unchanged.


Apply the same exact historyWireBytes counter to backend source-page totals, metadata400000-byte budget, and output-page accounting; export it through generated native-free bundle. This removes redundant full TextEncoder copies at the worker boundary without changing serialized size/quota policy. Existing metadata/quota/redaction tests plus Unicode metadata test must prove bytes rather than UTF16 character length remain authority. Diagnostics stages unchanged.


### Durable CPU split design and diagnostic map (2026-11-07, before implementation)

Version31 current synthetic correlation local_04defffcd1a2a6f34896d2fa0931c20e terminates after HISTORY_ACTIVATE_START; root cause remains cumulative request CPU. Introduce service-only private merge checkpoint, selected by server from operationId (client cannot submit phase/content). PREPARE reads and validates exact immutable source snapshots, allocates mappings, and stores a serializable prepared domain snapshot in bounded immutable pages. Prepared snapshot retains original source evidence/corrections/provenance but replaces original Replay JSON with an empty portable placeholder only after validation; normalized Replay contains full exact selections with bounded allocated IDs. Store all typed mapping tuples needed to resolve the original structural journey IDs; no selection/order/correction lost. BUILD reloads this trusted normalized snapshot, runs the unchanged canonical/correction/Replay merge core, stages output via existing aggregate RPCs, and seals ready state. FINALIZE commits staged output with existing CAS, without repeating reconstruction. Existing synchronous domain API composes prepare+build and must remain semantically identical; store no functions/Map/Set, reconstruct strict lookups from immutable tuples.

Checkpoint header freezes generation, account revision, source plan, owner revision, preferred Replay source, domain digest; per-request and every page write/read/seal rechecks live session/consent/fences and exact plan. Immutable paged content digests acknowledge identical retries and reject changed pages; state advances only after complete page cardinality. Concurrent exact retries may compute twice but cannot replace data; no lease assumption or rollback claim. Service-only RPC/table grants, no authenticated/anonymous access. Header/page size and count/total quotas bounded; account deletion cascades checkpoint content. Expired/stale staging is never activated and is cleaned within scoped maintenance; domain mismatch requires new operation/reconciliation, never silent reinterpretation. Lost ack resumes same operation; completed aggregate receipt wins. Client loops on fixed progress with same action correlation, validates response and operation, checks owner fence before/after every request; COMPLETE alone releases durable merge operation. Legacy branch unchanged.

Diagnostic map: HISTORY_SYNC/HISTORY_PREPARE for snapshot preparation; HISTORY_CHECKPOINT_WRITE and HISTORY_CHECKPOINT_READ for bounded immutable persistence; HISTORY_CHECKPOINT_SEAL for manifest/state advance; HISTORY_REBUILD + existing canonical phases for prepared reconstruction; ACTIVATE_START/PAGE/COMMIT for aggregate writes. Network/UNKNOWN=>unknown retryable preserving operation; schema=>blocked, stale/cancelled=>skipped, fenced/consent=>blocked; no page index/job IDs/records/metadata in diagnostics. Collection uses exact local action correlation in current deployed worker, only closed events. Required tests: synchronous/prepared graph+rows+Replay parity, malformed checkpoint/missing mapping rejection, restart after each phase/lostack, concurrent immutable retries, source/revision/domain/deletion fences, service-only RLS, quota+redaction, automatic mobile continuation cancellation/crossowner, SQL full rollback suite and hosted synthetic exactretry/two-session200Replay. Keep M7 in-progress.


Review triage (durable split): confirmed stale prepared-body retention can consume replacement quota; patch SQL with content-free stale receipts and immediate scoped purge. Confirmed missing non-Replay identity tuples are not rejected (manual+command reproduction); strengthen prepared-domain validation and regressions. Verification gaps accepted: add account journal ownerChanges+ownerRevision restart scenario and two valid owners with same operation/page isolation fixture. Client stale-operation clearing predates this change and is necessary after explicit HISTORY_STALE rejection; clarify prior shorthand: COMPLETE clears a successful merge operation, while a known HISTORY_STALE retires an invalid operation so a future attempt obtains a new UUID. UNKNOWN/NETWORK/cancellation never clear/rebase it; no owner evidence/source-upload checkpoint is cleared. This resolves contradictory wording with the existing tested stale lifecycle and domain mismatch new-operation requirement; preserve implementation rather than leave retries permanently bound to an invalid operation.


Durable split final integrated evidence:101mobile suites/956tests, SQLite106, root197/framework/evalsmoke, strictbackendtypecheck, generatedfreshness and17actualPostgreSQL rollbackfixtures pass. Three scoped independent reviews delivered findings; confirmed mappingcompleteness/staleartifactquota issues andownerjournal/twoowner regressiongaps patched and verified. Client knownSTALE retires invalidoperation and automaticallyretries one newUUID; secondSTALE stops, UNKNOWNretains exactcurrentUUID. Legacyorphanstaging is tombstoned/retired without touching sourcefacts; activeaggregate receiptwins. Migration20261107140000 deployedalone withCLI filequery transaction+exactmigrationhistory. Worker deployment/hosted200Replay acceptance inprogress. Local3k200ReplayCPU preparation376–421ms, build921–1078ms; no hosted/owner success claim yet.


Checkpoint hosted recurrence: local_5656cf8c94ac02ee8366dbfb38ff5b0f PREPARE returns200/CHECKPOINTED; BUILD reaches ACTIVATE_START thenCPU546 at21:17:07Bangkok. LocalprofileexcludedSDK/networkcost;246separate16KiB checkpoint reads addavoidableperrequestwork. Beforechange: add service-only read-batch checkpoint action, count1–8/page bounds and exactkeys. Wrapper invokesexisting guarded read under one database transaction/accountlock for eachrequestedpage, returnsorderedchunkarray only, abortswithsameclosederrorifanypageinvalid. Maximum8*400kbytesresponse bound; no externalclientaccess. Existingread remainscompatible. Workerreads up-to8chunksperRPC, eachchunknonempty<=16384, exactcount, cumulative64MiB; preservecorrelationREAD stage andNETWORK/SCHEMA/STALEclassifications. Newimmutablemigrationafteralreadydeployedcheckpointmigration, fullSQLsuite +twoownerbatchread/failedrange/fences/grants fixture, nodebatchcontinuation/corruption/redaction tests, stricttyping. Noownerdata/reset/reviewbypass.


Concurrent receipt edge beforepatch: originalcheckpointSQL returns an authoritative complete receipt fromanyaction if anothercontinuationcommits betweenstatusandread/write. Worker currentlyexpectsrecords forreadbatch andwouldmisclassifythatreceiptasSCHEMA. Propagate validatedcomplete checkpointreceipt toouterhandler immediately, retainingouteroperation/revision/pages validation andsamecorrelation; noextraRPC orcanonicalwork. Addraceinjection readbatchcomplete andmalformedreceipt regressions. StageCHECKPOINT_READ reasonCOMPLETE forauthoritativecompletion, NETWORKunknown forinvalidreceipt. NoSQLorclientcontractchange.


Readback recurrence beforepatch: batchedhosted3000/correction200Replay mergecomplete184.201s, exactretry succeeds, but firstsessionpull after20/97pages returnsPostgREST57014. Canonicalcommitcollapseswirefragments intoone semanticReplayrow; this read can exceeddefaultSQLbudget. Addnarrow public.travel_life_history_read invoker with60s timeout foraggregatepull only, delegateunchangedpublichistoryguards; clientaggregatepull65s, allotherread/status remain30s andsourceactivation65s. No role/globaltimeoutwidening, schema/consent/session/source/ownerrevisionguardsunchanged. Diagnostic HISTORY_TRANSFER/HISTORY_PULL/HISTORY_READ_TIMEOUT forSQL57014 orclosedreadtimeout response, retryabletrue/outcomeunknown, no rawPostgRESTmessage. Map history-transfer.createHistoryTransport -> history-service logger/copy, retaincurrentreplica/checkpoint. Testsinvoker/grants/action/session/parity/fences plusclientrouting/budget/failure-redaction; fullSQL andhostedtwo-sessionreadbackneeded.

Hosted final result (2026-11-07): worker34 completes3000 synthetic evidence +effective place correction +200 Replay references in197.575s; exact retry retains aggregate/revision; two independent Auth sessions read all97pages identically with3000 unique evidence, null provenance, correction and exact reverse Replay selection retained. Synthetic account deletion fenced; scheduled purge pending.101 mobile suites/958tests, root199/framework/eval smoke, strict mobile/backend typing, lint and17 PostgreSQL fixtures pass; generated native-free bundle current. Owner retry requested; actual owner completion and physical two-device acceptance remain open. No owner storage/source checkpoint reset, Git stage/commit/push, or unrelated migration deployment.

Owner retest result: runtime-mw6ijdz6-6, server commit COMPLETE/HTTP200 at21:45:35Bangkok, followed by device HISTORY_TRANSFER/HISTORY_AUTHORITY/COMPLETE/durableOutcome complete after refreshed account status. This closes the reported owner Sync CPU/ack failure for this operation. Saved revision0 was observed before completion; do not infer current failure from the prior label. Two-session hosted full readback remainsverified; actual physical second-device restore and entireM7 acceptance remainopen, so overallspecstatus staysin-progress.


### View account session remount repair diagnostic map (2026-11-07, beforeimplementation)

OwnerViewreturnslogin; currentACCOUNT_RESTORE skip+restart followscontextchange. Makealready-signed-in controller.restore idempotent withclosedACCOUNT_RESTORE/ACCOUNT_SESSION/SKIPPED lifecycle; donot transientlyclearauthenticatedowner. Existingforeground/getVerifiedSession validationandexplicitdenial/signout fencesremain. Reproduce usingrealcontroller and providerremount, provingselection/signedIn/credentials survive andexplicitlogoutstillfences. Viewaction falliblemap: HISTORY_TRANSFER/HISTORY_OPEN_AUTH ACCOUNT_SESSION; HISTORY_OPEN_REPLICA HISTORY_INCOMPLETE orclassifiedstorage; HISTORY_OPEN_SCOPE HISTORY_STALE; HISTORY_OPEN_BIND classifiednative/storage; unknownknownstage remainsUNKNOWN. Useonelocalopenactioncorrelation, fixed6fields only. Add failure/redactiontests andnormalopen/remountregression; noauthprovider/rawerrorslogging. KeepwholeM7inprogress.


Viewrepairverification: REDshowsgetLocalOwner nullafterremountrestore+cleanup; GREENskipsauthenticatedrestorewithsingleSKIPPEDterminalinsidequeue. ActualAccountScreen/PrivateRecordProvider/PhotoAccessProvider/contextintegration retainsaccountrepository/ownerthroughremount; deliberateSignoutstillblocks/deletescredentials/disposesmedia. Deferredfirstrestore+queuedsecondreadsSDKonceandneverlosesowneraftergrant. Fouropenboundaryfailure/redactioncasespass.102mobile suites/965tests, root199/framework/evalsmoke, typing/lint, generatedfreshnesspass;3scopedreviewscompletedwithoutconcretefinding. Optionalqueued-gapreviewcoveredbynewdeferredtest. NoSQL/serverchange; phonebundlereloadedforownerretest, whichremainsrequired. Priorbugmayhavedurablyblockedcredentials; ownernormalemailverificationrequiredinthatcase, nevermanuallyunblockorrewritetokens.

### Active BMAD continuation: ensure the View repair reaches the phone

The owner still returns to login. Latest runtime-mw6jgt5l-9 restore is SKIPPED at
ACCOUNT_SECURE_READ and runtime-mw6jgt8b-b completes; the latest action has none of
the new HISTORY_OPEN_* events. Current controller source has the signed-in restore
guard and openAccount source has the new stages. The running Metro stdout says:
"Metro is running in CI mode, reloads are disabled. Remove CI=true to enable watch mode."
The parent launched this task's Metro PID9704 with CI=1, so prior incremental-bundle
claims were insufficient and the owner exercised stale code. Source fix/integration
coverage remains valid, but physical acceptance is open.

Current bounded tasks and acceptance:
- [ ] Validate the existing restore/open diagnostic correction and its tests, without
  changing authentication authority or unrelated dirty files. Add a concise developer
  warning in apps/mobile/README.md about CI mode disabling reloads and the supported
  interactive dev-client/watch command. Reuse Expo tooling; add no dependencies.
- [ ] Parent restarts only its verified Expo PID9704 (expected CLI args and port8081),
  with CI removed from the CHILD environment, IPv4-first localhost, --dev-client,
  --localhost, --port8081 and --clear. Clear only Metro transform cache, never app data.
- [ ] Prove watch mode is enabled from startup output; request the actual Android
  bundle from the observed dev-client URL using the local Expo/Metro URL, assert
  HISTORY_OPEN_AUTH and HISTORY_OPEN_BIND occur in its code and inspect the compiled
  signed-in restore guard in memory. Emit only fixed booleans/hash, no bundle/env
  contents. Deliver that bundle to the connected phone over existing USB reverse.
- [ ] Rerun relevant controller/context/screen integration and root checks if edits
  warrant; current full102 suites/965 tests, typing/lint and root199 are recorded.
- [ ] Collect closed current build diagnostics for the owner's next View: expect
  HISTORY_OPEN_AUTH/REPLICA/SCOPE/BIND with COMPLETE, and authenticated restore
  ACCOUNT_SESSION/SKIPPED instead of SECURE_READ; verify owner remains authenticated.
  Old credential block may require ordinary owner email verification once. Never
  unblock or synthesize credentials. Physical owner View success is the final gate.

Diagnostic map: no new production event schema. Use existing six-field open and
restore events introduced in this repair; transport/build collection failures are
recorded here/playbook and cannot be interpreted as product failures. Cache reset
is a developer transform cache operation, not a user-history reset. Bind/open
failures remain fixed typed categories, redacted and correlated. Whole M7 stays
in-progress; this continuation has one goal: View works on the actual phone.

Owner update 2026-11-08: View account history now opens while retaining sign-in after watch-mode bundle delivery. New report concerns Check saved history: source wires this to historyService.refresh, and current device correlations end AUTH/COMPLETE plus ACCOUNT_REFRESH/ACCOUNT_SESSION/COMPLETE. It does not render trips. Existing browsing path is View account history then Atlas; actual Atlas trip visibility remains unverified. No data-loss or empty-replica cause established and no storage/auth change made for this report.

### Active BMAD continuation: Replay from account history (2026-11-08)

Observed current device action runtime-mw7clonr-a reaches REPLAY_LOCAL and
REPLAY_OUTPUT_SAVE/DATABASE_BUSY after directory/copy/verify/identity pass. Exact
lock holder remains unknown. Before behavior repair: saveReplayPreparedArtifact
must acquire the existing foreground runOwnedTransaction gate before reading live
lifecycle/run/privacy, displayed scope, prior committed metadata and CAS-writing.
Hold ownership through commit/rollback; queued work rechecks all guards after entry.
No wider timeout, reset, retry loop or composition revision change. Existing fixed
SAVE/typed guard diagnostics remain authoritative. File-backed two-connection test
holds a shared-gate background writer: RED must expose direct busy write; GREEN
waits for settlement, retains concurrent committed choices and atomically writes
cache metadata. A queued scope change must reject with the existing exact guard.
Device replay acceptance and actual lock identity remain separate open evidence.

Review refinement before edits: provider entry emits fixed REPLAY_ACCOUNT or
REPLAY_LOCAL capability stage (no identifiers). Output persistence separates
REPLAY_OUTPUT_DIRECTORY/COPY/VERIFY/IDENTITY/SAVE/CLEANUP at makeDirectoryAsync,
copyAsync, getInfoAsync+nonempty guard, cache identity, repository artifact CAS,
and derivative disposal/deletion. Classify original exceptions in memory before
cleanup; retain public REPLAY_OUTPUT while emitting one original terminal failure.
Recovery cleanup is best effort and cannot replace that original classification;
normal post-save cleanup failures use CLEANUP. Typed account-media reasons retain
their complete closed vocabulary; permission/session/consent/scope/schema/verification
and unavailable failures are blocked, network/storage/unknown retryable. Selected
share preparation receives its existing action correlation. Synthetic output fault,
redaction, exact custom soundtrack handoff and cached-authority revocation tests
precede another owner attempt; current OUTPUT/UNKNOWN is not a proven FS/DB cause.

Goal: prepare existing private Replay from the selected account history without losing committed selection, corrections, or authentication. Owner confirms Timeline trips and View login preservation. Current device failure is REPLAY_RENDER/REPLAY_ACCESS/UNKNOWN (runtime-mw7c01wy-o); precise failing source is not established. Preserve prior verified Sync and unrelated work.

Code map: apps/mobile/src/components/replay-screen.tsx prepare loads manifest then invokes preparePrivateReplay; apps/mobile/src/photo-access/provider.tsx loadReplayManifestInput and preparePrivateReplay conflate manifest, preview, and eligibility boundaries. Selected account repository and media adapter are installed by apps/mobile/src/account/record-context.ts. Inventory concrete implementation paths before reading them.

Diagnostic refinement before edits: cause remains unknown. REPLAY_RENDER shares one
screen action correlation through provider calls. Provider stages map REPLAY_MANIFEST
to repository reads, REPLAY_PREVIEWS to owner-preview resolution, REPLAY_SOUNDTRACK
to soundtrack resolution, REPLAY_ELIGIBILITY to lifecycle/exact selection/availability
guards, REPLAY_ENCODE to renderer entry, and REPLAY_OUTPUT to verification/persistence.
Preserve typed renderer stages and closed MEDIA_ACCESS/NETWORK/STORAGE/SCHEMA reasons;
classify native errors in memory, UNKNOWN stays at the known boundary. Stale lifecycle
is SKIPPED/skipped; denied access blocked; unclassified unchanged/retryable. Emit START
at awaited boundaries and one failure; propagated errors contain closed values only,
and screen does not duplicate provider-recorded failures. No behavior correction is
inferred from the current MEDIA_AUTH denial. Synthetic fault/redaction and correlated
screen tests precede fresh-bundle owner retry using the collection recipe below.

Tasks and acceptance for this bounded continuation:
- [ ] Establish exact failing boundary using closed correlated diagnostics first; if absent add minimal diagnostic stages and synthetic failure tests before claiming a cause.
- [ ] Record detailed operation/stage/reason-to-source map here before behavior edits. REPLAY_RENDER action must share a local correlation through screen/provider fallible boundaries; distinguish manifest read, preview resolution, scope/availability validation and renderer entry. Reuse fixed actionable reasons where accurate; unknown remains unknown. No content/native message logging.
- [ ] Implement only evidence-supported correction, with failing regression then passing test for account-selected repository/media flow and preserved committed choices. No permission/consent bypass or source/checkpoint reset.
- [ ] Verify failure categories/redaction and lifecycle consistency, focused integration tests, mobile typing/lint and root npm run check. Existing generated backend graph should remain untouched unless actually required.
- [ ] Verify actual watch-mode Android bundle freshness and collect matching device diagnostics; physical Replay success remains open until observed. If another owner action is necessary, ask only after the diagnostic patch is delivered.

Collection: current Android com.anonymous.travellife, SDK adb via LOCALAPPDATA, current package PID; parse logcat only in memory and emit the closed six fields through the ignored .local collection helper. Existing Metro watch mode on localhost8081 and USB reverse must be preserved. No raw logs or private evidence in Git. Read relevant playbook lessons first. Whole M7 remains in-progress; do not claim all M7 complete.

Native account-media diagnostic map before instrumentation: createNativeAccountMedia authorized status boundary emits PRIVATE_MEDIA/MEDIA_AUTH with one local correlation per authorization check. Preserve existing boolean authority. Closed denial precedence: !live -> HISTORY_FENCED; inactive status -> MEDIA_ACCESS; missing historyConsent -> HISTORY_CONSENT; missing mediaConsent -> MEDIA_CONSENT; aggregate/snapshot mismatch -> MEDIA_SCOPE; otherwise COMPLETE. All denials skipped, no raw status/IDs in events. Catch mapping remains existing classified network/schema/session behavior. Table-driven native tests force each guard, verify boolean denied, unique terminal reason, identical start/terminal correlation and no synthetic private status data in serialization. This only disambiguates the observed MEDIA_ACCESS; no authorization is bypassed.

### Review Triage Log — account Replay diagnostics (2026-11-08)

Review scope is the active Replay/provider/native diagnostics and relevant tests since the recorded baseline; the full M7 baseline inventory remains archived separately. Whole M7 remains in-progress and physical account Replay acceptance is not complete. All three scoped reviewers reported before triage.

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Blind1 missing excluded candidates block Replay | medium | Guard precedes plan and checks all eligible candidates; selection.ts excludes explicit excluded memories from committed output. Real pre-existing account-composition defect, defer pending current output diagnosis; no owner derivative silently removed. |
| Blind2 cache cap has no eviction | medium | Session cache256MiB is bounded and all refs are resolved; exhaustion is possible. Pre-existing capacity limitation; defer bounded cache policy rather than broadening this incident fix. |
| Blind3 evicted native file double-counts bytes | medium | Missing old.file leaves old.size in used before replacement increments used. Pre-existing native-cache accounting bug; defer explicit regression/correction. |
| Blind4 first chapter before final media authority | high | Callback precedes final accountAuthorized check; remote consent can change during await. Pre-existing publication-fence risk; defer to explicit account Replay privacy follow-up, not a verified owner cause. |
| Blind5 stale final authority leaves chapter files | medium | Stale exit disposes assembled output but not createdChapterUris. Pre-existing cleanup gap; defer scoped ownership-aware cleanup regression. |
| Blind6 no post-persistence account authority | high | Copy/CAS awaits after final authority gate before return. Pre-existing publication-fence risk; defer explicit account Replay privacy follow-up. |
| Blind7 share action correlation omitted | medium | Existing call supplies5args and new optional6th defaults a new correlation; patch same screen action correlation. |
| Blind8 native media uses independent correlations | medium | Native resolver/auth generates new correlations; current provider correlation doesn't propagate there. Pre-existing cross-layer trace limitation; defer optional adapter correlation plumbing with compatibility tests. |
| Blind9 incomplete typed media reason mapping | medium | New helper maps4ofclosedtypedmediareasonset; remaining categories become UNKNOWN. Patch complete closed mapping and tests. |
| Blind10 original output failure discarded | medium | Existing outputcatch replaces FS/DB cause with REPLAY_OUTPUT; new logger therefore emits UNKNOWN. Current owner runtime-mw7cbghr-e reproduces OUTPUT/UNKNOWN after ENCODE. Patch specific output stages plus original cause classification before public replacement. |
| Edge1 first chapter remote revocation | high | Same reachable callback-before-authority await as Blind4. Defer pre-existing account publication-fence risk. |
| Edge2 revoke during persistence | high | Same asynchronous post-gate window as Blind6. Defer pre-existing account publication-fence risk. |
| Edge3 typed media failure becomes unknown | medium | Same closed reason gap as Blind9; patch. |
| Edge4 native refresh correlation split | medium | Native authorization emits its own correlation and history transport another; source confirms existing behavior. Defer pre-existing cross-layer trace plumbing with Blind8. |
| Verification1 successful soundtrack handoff untested | medium | Reviewer demonstrated deleting assignment is not caught by existing rejecting-resolver/adapter-only tests. Patch provider success manifest assertion. |
| Verification2 final cached authority not exercised | medium | Existing test exits at first denial; deleting final gate remains undetected. Patch true-then-false valid-cache regression. |
| Verification-other excluded missing candidate | medium | Same reachable explicit excluded candidate as Blind1, defer pre-existing composition guard correction. |

Current device evidence after source freeze: successful HISTORY_OPEN_BIND runtime-mw7capd3-9 precedes Replay runtime-mw7cbghr-e, which reaches MANIFEST, PREVIEWS, ENCODE and OUTPUT/UNKNOWN. No SOUNDTRACK/native authority events prove account adapter usage for that action. Add fixed provider source stage REPLAY_ACCOUNT/REPLAY_LOCAL; inspect exact output source before behavior correction. This is instrumentation, not a claimed fix.

Prepared-artifact repository map before typed guard instrumentation: reconstruction/repository.ts saveReplayPreparedArtifact preserves fixed public message and throws closed ReplayPreparedArtifactError.diagnosticReason. Lifecycle or published-run/privacy mismatch -> REPLAY_SCOPE_INVALID; displayed snapshot token/privacy mismatch -> REPLAY_MAPPING_INVALID; prepared cache CAS changes!=1 -> REPLAY_RECEIPT_CONFLICT. Provider output-save stage consumes only this explicit allowlist, never arbitrary properties/messages. SQL/native failures remain classified in memory at save boundary. No stale guard is weakened and no automatic retry/reset is introduced. Actual disposable SQLite tests cover disconnected lifecycle, mismatched displayed token, and both insert/update CAS races while retaining newer composition.

Source-transition diagnostic map before instrumentation: recordContext.local preserves behavior and accepts a closed caller stage; emit one HISTORY_TRANSFER/SKIPPED/skipped event only when an active or suspended account context is actually cleared. Stages identify explicit USER_LOCAL, OWNER_CHANGE, AUTH_LOST, SCOPE_CHANGED, AUTHORITY_LOST, UPLOADS_STOPPED, DELETED; suspend has its own SUSPEND stage. Callers: panel default explicit local; root checkOwner -> OWNER_CHANGE; history-service invalid session -> AUTH_LOST (reuse available action correlation); refresh branches choose DELETED/SCOPE_CHANGED/AUTHORITY_LOST; withdraw -> UPLOADS_STOPPED; deletion-service -> DELETED. No private owner IDs or scope signatures logged. Existing guards and local fallback semantics remain unchanged. Tests verify caller stage, no redundant transition on already-local context, fixed payload/redaction, and existing disposal/fencing. Needed because native source REPLAY_LOCAL after successful View is established but actual switch caller is unknown.

Evidence-backed writer correction (2026-11-08): exact owner runtime-mw7clonr-a passes DIRECTORY/COPY/VERIFY/IDENTITY then SAVE/DATABASE_BUSY. saveReplayPreparedArtifact previously read guards and wrote CAS without joining native writer ownership. New two-connection file-backed SQLite RED reproduces errcode5 while another owned writer remains uncommitted. GREEN queues complete guard/read/CAS in existing foreground runOwnedTransaction, waits for that writer, preserves its committed direction and rejects lifecycle changes while queued. No retry loop, timeout increase, credential or user-data reset. Full100AtlasSQLite tests pass; diagnostic suite mobile102/990 before source-transition addition, focused transition5suites34 and typing/lint/root199/framework/evalsmoke pass. Independent follow-up source reviewer finds no concrete blocker, verifies raw connection avoids nesting and exact CAS remains. WholeM7 and device Replay acceptance remain open.

Frozen actual Android routed bundle hash2b3f28b6af2b08d2f4ab48a81040deb50c6e060d228e69a322b352e1c2de254d passes in-memory markers, compiled foreground artifact writer gate and closed context-transition branches. Restarted only com.anonymous.travellife normally through existing USB Metro endpoint to release old native connections; no storage clearing/reinstall. Owner validation requested on this concrete fix. Source transition caller remains unknown until current new diagnostics are observed; do not claim preceding local renders were account Replay acceptance.

Final local verification after context diagnostics and writer correction: mobile102suites/997tests pass, actualAtlasSQLite100pass, root199/framework/evalsmoke pass, mobiletypecheck/lint pass, scoped whitespace pass. Three initial reviewers triaged; follow-up review verifies output correlation/cause propagation, custom soundtrack/cached authority regressions and owned writer/non-nesting/CAS correction with no concrete blocker. Device owner confirmation after restart is pending; source-transition cause stays unknown until new action logs. Preserve overallstatus in-progress and do not commit unrelated dirty work.

Owner Replay writer acceptance (2026-11-08): owner confirms preparation and playback after the foreground-writer correction and ordinary app restart. Current Android runtime-mw7dnuq6-a reaches DIRECTORY/COPY/VERIFY/IDENTITY/SAVE/CLEANUP then REPLAY_RENDER/COMPLETE, durableOutcome complete. This closes the observed prepared-artifact DATABASE_BUSY incident; no storage or checkpoint reset. Software evidence:102mobile suites/997tests,100AtlasSQLite, root199/framework/evalsmoke, typing/lint and scopedreview pass. Source caveat: this action explicitly logs REPLAY_LOCAL. Earlier View runtime-mw7dn9kg-6 completed HISTORY_OPEN_BIND, but no HISTORY_CONTEXT_* switch event is present in current process collection. Therefore account-source continuity remains unknown/unresolved and physical account/two-device Replay acceptance is not established by this successful local playback. Keep wholeM7 in-progress and source-continuity follow-up open; do not conflate writer-incident closure with full account acceptance.

### Active BMAD continuation: retain Supabase account history as Atlas/Replay source (2026-11-08)

Owner explicitly requires View account history -> Atlas/Replay to use restored account replica from Supabase, not local history. Native View runtime-mw7dn9kg-6 completes BIND, but successful Replay runtime-mw7dnuq6-a logs REPLAY_LOCAL; no context-switch event observed. Writer DATABASE_BUSY is fixed and owner-confirmed; preserve that correction. Root cause of source discrepancy remains unknown, not attributed to owner's actions.

Code map: account/record-context.ts builds account repository/media adapter and publishes selection revision; account/root-provider.ts subscribes and spreads these props into PhotoAccessProvider keyed by revision; photo-access/provider.ts initializes repositories from props and emits REPLAY_ACCOUNT vs LOCAL from adapter capability; components/account-history-panel.tsx opens account context, account-screen.tsx Back uses router.back. Exact routes from src/app/_layout.tsx use one PrivateRecordProvider. Inspect current tests including account-view-session, account-root-provider and actual navigation consumer; previous synthetic View test does not prove native retained Stack consumers use same source.

Tasks and acceptance:
- [ ] Read current process closed diagnostics and trace source boundary. If source/caller unknown, add minimal fixed provider binding/mount/source classification at precise boundary with actionable mismatch guard, same local correlation where applicable. Map operation/stage/reason/source and fault/redaction tests here before code. No IDs/paths/tokens/content/native messages logged.
- [ ] Reproduce actual cause with meaningful integration regression proving account database repository AND account media adapter reach Atlas and Replay after View/navigation/remount; distinguish metadata-only absence of authorized media from silent local fallback.
- [ ] Correct evidenced source binding/continuity, preserve explicit local choice, auth loss/privacy fences and record data. Supabase authoritative account replica remains local read model; do not wire mobile directly to private server tables or bypass consent. No owner evidence reupload/reset, raw data inspection or permission change.
- [ ] Run relevant account/provider/navigation regressions, mobile typing/lint, root check, applicable SQLite and scoped review. Keep writer gate and closed cause diagnostics intact. Preserve unrelated dirty checkout and overallM7 in-progress.
- [ ] Freeze source after checks, verify exact served Android bundle, collect current owner account-source Replay stages and actual playback or precise explicit missing-media recovery. Never count REPLAY_LOCAL as account acceptance. Ask owner once only after concrete reviewable fix/diagnostic is delivered if input necessary.

Collection recipe remains current package PID com.anonymous.travellife via SDK adb; logs parsed only in memory into six fixed fields. Allow runtime and local_UUIDhex correlations and null terminal stages. Only existing localhost8081/USBreverse Metro; no appstorage clearing/reinstall, credentials changes or unrelated deployment. Record every observed incident/corrected claim in playbook. Scope frozen facts: account source must stay explicit; private media consent is separate and missing account media cannot silently substitute local history.

Before-code source handoff diagnostic refinement (2026-11-08): source cause remains
unknown. recordContext.openAccount retains its generated action correlation in the
in-memory selected binding; rebind creates its own local correlation. root-provider
maps each selection revision's actual repository props to HISTORY_TRANSFER /
HISTORY_PROVIDER_ACCOUNT or HISTORY_PROVIDER_LOCAL / COMPLETE / complete. The
PhotoAccessProvider mount maps the actual adapter accountAuthorized capability to
HISTORY_CONSUMER_ACCOUNT or HISTORY_CONSUMER_LOCAL / COMPLETE / complete using
the same binding correlation. Unmount emits HISTORY_CONSUMER_UNMOUNT / SKIPPED /
skipped. Root handoff inconsistency (selected account versus repository presence)
uses HISTORY_PROVIDER_BIND / HISTORY_SCHEMA / blocked, nonretryable; it is
diagnostic evidence rather than a speculative storage/source correction. No
owner/database/media identifiers enter these events. Replay retains its action
REPLAY_ACCOUNT/LOCAL stages. Compare the View correlation's root and consumer
events, then any unmount/context transition, against the next Replay source stage.
Collection uses the current package PID/frozen served bundle and approved closed
parser above; missing events remain a collection gap. Distinct local/account test
adapters and account repository manifest/preview probes must demonstrate that
metadata-only missing account media never invokes the local resolver. Host tests
cannot establish the native retained Stack consumer or the owner's actual cause.

Evidence before behavior correction: the actual routed Android compiled bundle
memoizes recordContext.getRepositories() and its spread once with
memo_cache_sentinel, independently of the subscribed numeric revision. View changes
the key but passes the initial local props again. app.json enables React Compiler;
ordinary Jest does not exercise this transformation. Replace the split getter with
one stable external-store binding snapshot containing revision, repository props,
account selection and the local correlation. changed() publishes a new object
atomically after selection/props changes; useSyncExternalStore returns that object
directly to root-provider JSX. Do not suppress the compiler or change storage,
auth or consent. A compiler-enabled integration regression must fail the old split
getter implementation and pass the atomic binding, checking account metadata AND
account media/Replay capabilities. The parent verifies the served compiled function
after freeze. Device source/playback acceptance remains open until new observation.

Implementation evidence: recordContext now publishes a referentially stable atomic
binding snapshot before notifying subscribers; root reads only that subscribed
snapshot for key, repository/media props and diagnostic correlation. No separate
mutable repository getter remains in its render. Source mount/unmount diagnostics
share the View binding correlation. The compiler-enabled test transforms the real
root module with the installed React Compiler and Expo preset, checks that compiler
memo-cache output actually exists, and executes it with synthetic native adapters.
Restoring the split-getter pattern as a temporary mutation reproduces RED: both
consumers remain on Synthetic local home after acknowledged openAccount. The atomic
implementation restores GREEN. Distinct account capability, account manifest and
preview resolver are asserted; consent denial stays MEDIA_CONSENT at PREVIEWS with
one blocked terminal event and no local read/resolver fallback. Deliberate local
choice, actual account subscription/signout fencing, stable snapshot publication,
root binding fault classification and fixed payload redaction pass.

Eight focused suites pass 196 tests, including compiler root, real View/session,
record context, convergence/history service, provider, Replay screen and router
tree. Actual SQLite passes all112 cases, preserving the prepared-artifact writer
correction. Mobile TypeScript and scoped ESLint pass; parent owns root check,
served compiled Android bundle proof and owner acceptance. No history/credential
reset, consent change, deployment or reconstruction-policy change was made.

### Review Triage Log — compiler-safe account binding (2026-11-08)

Scoped artifact includes active binding files since baseline and earlier uncommitted provider context. Blind reviewer completed; edge and verification reviewers failed on service usage limit, so those two independent layers are explicitly incomplete. Parent verified atomic snapshot identity/notifications, direct root subscription, no separate mutable getter in actual compiled bundle, distinct adapter/metadata integration, deliberate local and auth fences. No blanket wholeM7 review claim.

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Blind1 failed repeated open fences former binding | medium | Existing openAccount increments intent before fallible read, without publication on failure. Pre-existing semantics unchanged by snapshot correction; defer binding replacement recovery with regression. |
| Blind2 dispose old media before replacement build | medium | Existing open/rebind disposal precedes fallible build; old binding can be unusable after constructor failure. Defer pre-existing replacement atomicity/cleanup hardening. |
| Blind3 rebind lacks precise diagnostics | medium | Existing rebind reads/build have no own staged catch; new correlation does not classify them. Defer pre-existing diagnostic boundary completion; no failure observed at this path for current compiler incident. |
| Blind4 reconstruction writes missing ownership proxy coverage | high | Existing mutation set excludes stage/reset/prepared writes; current snapshot changes do not alter proxy guards. Defer stale write/mutation accounting audit and concrete source-switch regressions. |
| Blind5 captured reads after owner loss | maybe-false | Raw repository reference lacks source guard, but current provider/screen unmount and publication fences must be traced to establish a reachable owner-visible leak. Defer high-unverified with actual pending-reader consumer reproduction required. |
| Blind6 cleanup failure removes committed artifact | medium | Pre-existing provider output catch includes obsolete-file cleanup after durable save and deletes new bytes on error. Defer committed cleanup boundary repair; source binding patch only adds mount diagnostic there. |
| Blind7 stale final authority leaves chapter files | medium | Carried: same pre-existing source/claim as previous Blind5; deferred cleanup gap remains. |
| Blind8 first chapter before final authority | high | Carried: same pre-existing source/claim as previous Blind4/Edge1; deferred publication fence remains. |
| Blind9 missing derivative generic access category | medium | Existing eligibility guard throws REPLAY_ACCESS rather than typed media subtype. Defer explicit missing-derivative classification; latest actual failure has exact native MEDIA_CONSENT and is independently identified. |
| Blind10 failed replacement/concurrent-open regressions absent | medium | Current compiler regressions cover successful binding, denied media, explicit local, owner loss; no new replacement failure behavior changed. Defer with pre-existing replacement hardening. |

Native compiler-fix acceptance: runtime-mw7o6r8e-m now logs REPLAY_ACCOUNT -> MANIFEST -> SOUNDTRACK; native runtime-mw7o8xhh-o reports MEDIA_AUTH/MEDIA_CONSENT/skipped, then action blocks MEDIA_ACCESS at SOUNDTRACK. This establishes correct account source and a separate explicit media-consent prerequisite, not source fallback. Owner confirms Replay still errors and subsequently authorizes continuing private media storage. Actual selected content must be chosen on-device; do not choose/authorize all owner photos silently. Existing upload UI instructions supplied; await chosen private-copy upload completion, then retry account Replay. Full mobile102suites/1001tests, focused196, actualSQLite112, typing/scopedlint and root199/framework/evalsmoke pass. Actual compiler-enabled Android atomic binding proof hashc9d88a2f6157b7aa1d2f88b61473aabfd0b0d77c72a61cd5aa9f43548db4846c; separate repository getter absent.

### Active continuation: one simple account sync flow (2026-11-08)

Owner rejects the exposed technical sequence. Replace default signed-in controls with one explicit Sync to account action, visible real progress, then Atlas/Replay. One adjacent consent statement covers private history and exactly the media already committed to the account Replay (including permitted custom music); no gallery reselection, library-wide upload, automatic consent from login/background, or separate Check/Restore step. Advanced source/session/manual-media/deletion tools remain accessible under Details. Use Living Atlas lean Settings patterns and existing upload/checkpoint protocols. Prior manual-gallery instructions are superseded.

Implementation tasks/acceptance: compose refresh/consent/history convergence+restore/committed Replay media upload/account binding into one foreground workflow; preserve owner fences, corrections, exact unknown-upload job IDs, explicit prior local choice outside this action, acknowledged copies and scoped failures. Media mapping uses authoritative account replica committed plan, canonical account evidence IDs, and this installation's source-media mapping; skip already acknowledged copies, reconcile matching saved jobs, never overwrite unrelated saved selections. Missing/other-device media is explicit, not local fallback. Copy consent is owner initiated only. On completion navigate to Atlas using account binding; no fake percentage or premature success.

Diagnostic map before code: HISTORY_TRANSFER/ACCOUNT_SYNC_WAIT for existing active work, ACCOUNT_SYNC_CONSENT/HISTORY/MEDIA/OPEN for orchestration. Pass one locally generated correlation into existing history, media, transport and binding actions; preserve exact child classified failure/stage in a closed propagated error and avoid duplicate terminal logging. New PRIVATE_MEDIA/MEDIA_REPLAY_SCOPE maps replica/committed plan validation, MEDIA_REPLAY_MAPPING maps paged source identity/scope guards, MEDIA_STAGE and existing copy/encode/upload/ack stages map preparation and exact durable job resumption. Missing local source/media -> MEDIA_UNAVAILABLE; stale plan/source -> MEDIA_SCOPE; conflicting saved unrelated job -> MEDIA_CONFLICT; auth loss -> ACCOUNT_SESSION/MEDIA_ACCESS; unknown remains exact known stage. Never log private IDs/refs/media, raw errors or bodies. Collection remains current package closed six-field parser, runtime/local UUID correlations; freeze source+verify compiled bundle before owner action.

Checks: meaningful committed selection/duplicate omission/resume/scope and fault-redaction tests; orchestration explicit consent/order/no premature completion/failure stop/owner loss tests; screen one primary action/default advanced controls hidden; mobile typing/lint/root check and relevant SQLite/provider regressions. User acceptance on actual phone still required. Two previous independent review layers are unavailable because service quota was exhausted; implement directly and record review limitation rather than fabricate review. WholeM7 remains in-progress; no commit/push/storage reset/deployment of unrelated work.

Committed-media preparation refinement before edit: the one-flow uploader intentionally stores only committed Replay assets. Account preparePrivateReplay must likewise resolve only that composition; resolving every album candidate would issue requests for thousands of deliberately unsynchronized items. Compute required keys from immutable committed metadata (availability=true planning), narrow by explicit requested trip/memory scope, pass null preview refs for non-required account items and mark those unavailable for render planning. Keep exact input index/order and explicit missing required media -> MEDIA_UNAVAILABLE at REPLAY_ELIGIBILITY. Local editor preview paging remains bounded48 and unchanged. Regression verifies excluded refs are null/not requested and required missing derivatives still block. No account authorization bypass, local fallback or owner-choice rewrite.

Committed soundtrack continuity before edit: ReplayScreen.prepare defaulted soundtrack from pre-load React music state, then set state from manifest asynchronously. First open therefore passed bundled music even when account manifest held a committed custom revision. Synthetic first-open regression RED confirms wrong supplied soundtrack. Default preparation must use freshly read committed manifest soundtrack (bundled only if no committed track), while explicit Update Replay arguments retain their existing meaning. Existing correlated REPLAY_SOUNDTRACK boundary and exact revision resolver remain unchanged. No content/URI logging or audio substitution.

Simple-flow implementation/verification (2026-11-08): default Account now has one Sync to account primary action and collapsed Details; consent text covers history plus only committed Replay viewing copies/permitted soundtrack, states originals remain local and server-readable private storage. Workflow waits for active work, explicitly enables missing scopes once, converges/restores history, syncs current committed account media, then publishes account binding and opens Atlas only while that screen remains focused. Exact unknown upload job is reconciled; unrelated jobs retained. Authoritative media mapping checks every page/scope, acknowledgement counts remain measured, and final consent/source guard prevents false Ready. Account rendering nulls refs outside required composition (no thousands of excluded fetches), rejects missing required copies explicitly, and first open keeps the committed soundtrack rather than stale bundled state. Original source/writer corrections remain.

Evidence: full106mobile suites/1024tests pass, actualSQLite112pass, root199/framework/evalsmoke pass, mobiletyping/lint pass. New closed history/media failure propagation tests retain exact DATABASE_BUSY at MEDIA_REPLAY_MANIFEST and redaction. Scoped tracked/new-file whitespace passed (no-index exit1 with empty --check output denotes differences, not whitespace). Active implementation diff .local/simple-sync-active.diff uses pre-change snapshots where available and recorded baseline for other files; no staging/commit/push. Parent manually reviewed task ordering, consent, source scope, exact retry ownership, error propagation and navigation completion; independent review remains limited by previously exhausted reviewer quota, not claimed passed. Actual Android bundle hashcff6786d8e2f2bdc2261aa96cce82f389af830917a449a28f50056f4be85135c verifies explicit one-button consent, focused completion, Details, committed media scope and atomic source binding. Reopened only app normally; actual owner one-tap sync/upload/Atlas acceptance requested and remains pending. Prior manual-gallery question is superseded. WholeM7 status remains in-progress.

### Active one-button Sync incident: source media mapping SQL timeout (2026-11-08)

Current Android runtime-mw7qurne-8 completes consent and history, then PRIVATE_MEDIA/MEDIA_REPLAY_MAPPING/MEDIA_NETWORK/unknown. Supabase current authenticated log inspection shows HTTP500 travel_life_history and Postgres57014 statement timeout in history_private.pre_account_controls line21, specifically the sourceCopies/evidence count query. No owner records, credentials or raw traces exported; only safe function/SQLSTATE/query-shape classifications retained. Root is a bounded-read query failure, not a missing user step. Owner should not retry until correction is concrete.

Before code: keep same public/private wrapper chain, session/account/source/current-plan/privacy checks and grants. Replace source-media count/page enumeration with one materialized thin eligible set per request. Extract sourceCopies/privacy from large aggregate metadata once, materialize canonical evidence once, hash anti-join blocked IDs, compute count and sorted24-item page from the same set. Preserve all row/order/kind/day/expectedRevision/audio semantics; read committed soundtrack JSON once. Do not widen global or read timeouts or reset owner data. New immutable migration replaces only inner pre_account_controls implementation, preserving non-source-media delegation and outer controls.

Diagnostics: direct source-media PostgREST57014 -> HISTORY_READ_TIMEOUT with exact MEDIA_REPLAY_MAPPING_SQL_TIMEOUT boundary; an explicitly expired own client read timer -> same reason at MEDIA_REPLAY_MAPPING_DEADLINE. Preserve through private action/one-flow closed error, retryable unknown, one initiating correlation and no raw PostgREST body/message. Other operations retain existing budgets. Tests force both failure types and redaction. Actual Postgres synthetic3000evidence + large incompressible metadata/Replay must reproduce old budget failure and pass optimized count/page under same budget, plus privacy/page/custom audio/owner/source/grant preservation; run full rollback suite. Deploy only this migration transactionally with matching migration history after checks, never unrelated queued migrations. Native one-button upload/Atlas acceptance still required.

### Source-media timeout review and verification continuation (2026-11-08)

Three independent BMAD reviewers completed against scoped88,472-byte diff. Triage:
- Late consent cleanup and abandon cleanup owner fence: high, patch. Guard immediately after final await, retain PRIVATE_MEDIA/MEDIA_ACCESS/skipped closed lifecycle classification; two deferred cleanup tests preserve replacement-owner selection and its actual backing map.
- HTTP401/403 precedence and rejected session provider normalization: medium, pre-existing transport boundaries, deferred to transport hardening below. Existing account service/action classifiers remain; no current timeout is attributed to Auth.
- Metadata "detoast once" claim: low, patch comment to accurately state compact projections extracted once per request outside row loops. Actual unchanged5s regression measures the optimized query; no claim of a single physical TOAST expansion.
- Per-page rescan means complete pagination remains O(pages*records): medium, retained existing API contract; patch verification with all125 sequential pages and honest total timing. A targeted versioned mapping API remains separate optimization, not a new untested contract in this fix.
- Only first/last mapping pages measured: medium, patch full sequential count/page coverage in synthetic scale fixture, separate120s total fixture block after unchanged5s request regression.
- Excluded-field malformed shapes untested: low, patch independently hidden/excluded/both, including overlapping privacy membership and legacy JSON membership parity.
- Nonzero attachment revisions untested: medium, patch real SQL evidence7/soundtrack11/unattached0 through public RPC. Verification reviewer independently confirmed same gap.
- SQL timeout propagation only tested at transport: medium, already patched dedicated service test with one closed diagnostic, initiating correlation, SQL boundary and propagated diagnosticRecorded failure. Distinct own deadline separately tested in transport; no raw messages logged.
- Fragmented Replay soundtrack candidate: false positive; aggregate activation calls collapse_replay_fragments before becoming readable, so active rows retain canonical semantic kind=replay. Reviewer rechecked and discarded.

Current validation: full mobile106 suites/1027 tests PASS before final two cleanup race cases; affected3 suites/32 tests PASS including those races and timeout propagation. Typecheck and lint PASS. Root199/framework/eval smoke PASS after required generated source-digest refresh. Full PostgreSQL19 fixtures PASS including attached revisions and both privacy fields; full sequential benchmark additionally running. Exact single migration prepared for transactional deployment, with no unrelated migration or Edge worker deployment. Android actual compiled bundle contains simple Sync flow plus both mapping timeout diagnostic stages; final post-guard hash will be recaptured. Whole M7 and owner-device acceptance remain in-progress.

Follow-up reviewer confirmed attachment/shape/pagination/race patches, and found required SQL response assertions using <> could silently accept missing/null fields. Changed scale assertions to IS DISTINCT FROM; no runtime function change. Exact final fixture rerun required after the in-flight full-suite benchmark.

Deployment verified: applied only20261108190000_m7_linear_source_media in one transaction with its exact migration-history record. Live read-only pg_proc metadata confirms compact mapping/privacy/audio, SECURITY DEFINER, empty search_path, no authenticated/anon direct inner EXECUTE; no runtime timeout setting added. Final NULL-sensitive SQL assertions pass6 focused fixture files, scale2.551s. Full19 suite including all125 pages passes, sequential86.317s synthetic local. Android final compiled proof SHA2560550bd7c7b62648aa7e078d9d869dca20a284427a2cbd0640233a6e3738bc0a8 confirms simple flow, atomic binding and exact SQL/deadline categories. Stop code changes while awaiting owner retry; prior action is failed mapping with history retained. Native upload and automatic Atlas opening are still open, not claimed fixed.

Continuation2026-11-09: USB connected/app process present, but Metro listener and reverse absent; previous Sync terminal diagnostics no longer retained, so completion remains unknown. Restored hidden watch-mode Expo8081 and USB reverse, actual Android compiled proof matches frozen0550bd7c7b62648aa7e078d9d869dca20a284427a2cbd0640233a6e3738bc0a8. Reopened existing app via development link; fresh closed account/history authority COMPLETE diagnostics observed, no retained ACCOUNT_SYNC/PRIVATE_MEDIA terminal result. No product code or server changes, no reinstall/storage clear. Need fresh owner one-button action to establish media/Atlas outcome; old action not declared successful or rolled back.

### Mapping transport failure discrimination (2026-11-09, before implementation)
Current native action runtime-mw8h2r6x-7 completes history, starts MEDIA_REPLAY_MAPPING, then44s later emits MEDIA_NETWORK/unknown. Supabase current last60min unified logs show no error5xx records; visible history and Auth requests are200. This does not establish the cause of the failing request. Keep cause unknown; prior SQL repair is deployed but this new transport failure is unresolved. No media upload started in this action.

Smallest diagnostic correction: source-media createHistoryTransport retains one action correlation and closed HistoryTransferError.boundary through private-media-service.mapped for all known reasons, not only SQL timeout. Add fixed MEDIA_REPLAY_MAPPING_CONFIG, SESSION_READ, SESSION_UNAVAILABLE, REQUEST, RESPONSE_JSON, HTTP_AUTH, HTTP_RETRY, HTTP_REJECT, RESPONSE_SHAPE, RESPONSE_ERROR stages. Failures remain their closed existing reason and unknown/blocked outcomes; own timer keeps existing DEADLINE, SQL57014 keeps SQL_TIMEOUT. Classify HTTP401/403 before payload parsing so Auth failures cannot become generic JSON/network. Rejected session providers normalize without raw details. Non-source-media behavior and all request budgets unchanged. Tests force each boundary with private sentinels, preserve redaction and action propagation; verify actual Android bundle before requesting one fresh owner reproduction. No speculative server/database changes or retries.

Correlated root-category refinement BEFORE recovery change: same runtime-mw8h2r6x-7 shows repeated ACCOUNT_REFRESH/ACCOUNT_SESSION/COMPLETE followed ACCOUNT_REFRESH/ACCOUNT_PROVIDER/ACCOUNT_NETWORK/failed immediately before MEDIA_NETWORK. Source is controller.getVerifiedSession() live auth.getUser/getSession verification, which returns null on transient network; transport maps live-fence null to HISTORY_NETWORK. Underlying network interruption cause remains unknown, not a proven SQL/backend failure.

Recovery: for source-media ONLY and an explicit owner fence still current, a null verified session may perform exactly one additional verified-session read. Check current fence immediately before retry and after await; do not reuse cached tokens, authorize absent owner, retry explicit owner mismatch or bypass server auth/session guards. Final null retains precise SESSION_UNAVAILABLE, changed owner fences, rejected provider stays classified SESSION_READ. Two attempts maximum, no automatic writes/upload retry, existing RPC30s deadline unchanged (as before session verification precedes request timer). Forced tests null->verified, null->null, signout between reads, wrong-owner session and unchanged non-source routes; session controller's existing closed diagnostics show each attempt with same initiating correlation. This recovers the observed read-only transient safely; final failure remains explicit, no success claim without native evidence.

### Session-recovery independent review triage (2026-11-09)
All three context-free reviewers completed before triage. Baseline diff includes earlier uncommitted M7 code; the current continuation is source-media diagnostics/session-read recovery, not a claim to finish every M7 feature.
Patch findings: high stale source-media response/error can be misclassified after owner changes; medium403 authorization denial must not invalidate valid sign-in; medium malformed429/5xx must retain retryable HTTP category; medium semantic source-media page parser lacks exact shape boundary; high first mapping page must match initial account generation/replica before targets authorize; medium soundtrack unavailability path needs service-level verification; medium late local cleanup/installation/pending reads can overwrite replacement-owner progress. All fit existing preserve-owner/privacy/precise-diagnostic requirements.
Before patch diagnostic map refinements: source-media current-fence checks before session and after awaited session/fetch/JSON (also catch) take precedence as HISTORY_FENCED -> MEDIA_ACCESS/skipped, never Auth invalidation. HTTP401 remains ACCOUNT_SESSION at HTTP_AUTH; HTTP403 uses existing ACCESS reason at new closed MEDIA_REPLAY_MAPPING_HTTP_FORBIDDEN, blocked/nonretryable, no signout. Retryable HTTP429/5xx with malformed/null response retains HISTORY_NETWORK/HTTP_RETRY/unknown (SQL57014 still SQL_TIMEOUT). Typed ACCESS propagates via AccountSyncStepError; no new telemetry envelope. mediaSelectionPage parsing failure maps MEDIA_SCHEMA/RESPONSE_SHAPE/blocked; read failure itself retains its typed transport stage. First page scope mismatch stays MEDIA_SCOPE/MAPPING/blocked before authorization/upload. Owner fence after each fallible awaited local seam emits MEDIA_ACCESS/skipped without touching replacement state. Tests must force delayed response/error/signout,403 no invalidation, malformed HTTP retry, semantic invalid mapping, changed first aggregate and required custom-track missing/mismatch.
Deferred pre-existing findings: empty Replay skips an unrelated pending upload; soundtrack durable receipt recovery can require unavailable local original before reconciliation; full mapping retains/rescans all source pages; managed boolean can hide a different nested cleanup failure; manual choose page lacks requested-page equality; completed-checkpoint activation acknowledgement validation differs. Record separately with verification needed; none establishes current network root cause. Current source-media session recovery never retries writes or uploads.

Security-review scope applied: native bearer sessions remain in existing protected storage; no new credential cache or log data. Source-media session retry is read-only, max2 fresh verifications with current-owner checks, same correlation; backend Auth/session/RLS remains unchanged. HTTP401 invalid-session handling and403 permission-denied handling separated. No new endpoint/dependency/browser HTML/cookie path; CSRF/CSP/wallet/dependency-upgrade examples in generic skill do not apply to this bounded native transport change. Project closed-log contract overrides generic raw-server-error examples.

Review completion before owner retry: all three independent reviewers returned; each finding triaged above or explicitly deferred. Re-engaged original implementation agent for smallest patches. Follow-up verification reviewer read exact final code/tests and confirmed every requested patch, no remaining concrete defect in this scope; reviewer did not rerun tests. Root independently inspected final transport/mapping/error translation, ran scoped whitespace guard and security review. Focused2 suites83 tests PASS; final root check199/framework/eval smoke PASS, typecheck/lint PASS. Full106-suite mobile verification still finishing at this checkpoint; no new server deployment/migration needed. Exact Android bundle17a5ae89b8bbf053943862763986eb366ea518924b54fa7cb70f27a2994e2f3e has the frozen simple flow, fresh-session recovery and closed timeout markers. No raw evidence/credentials logged. Native completion remains open; retain wholeM7 in-progress and preserve all unrelated changes/no commit per user authority.

Collection recipe: with the one connected owner Android device, .local/monitor-current-sync.cjs extracts only the six closed diagnostic fields from current app PID, with locally calculated event age; no raw log export. Follow the initiating ACCOUNT_SYNC_WAIT correlation through consent/history/media/open, include same-correlation ACCOUNT_REFRESH outcomes for verified-session reads, and inspect exact mapping failure boundary. Do not clear logs/storage or restart a running owner action. SQL stage maps to existing source-media function, SESSION stages map to controller.getVerifiedSession/auth adapter; REQUEST/HTTP/JSON/SHAPE map to history-transfer and mediaSelectionPage. Root retries no upload/write automatically.

Final106 mobile suites/1084 tests PASS; focused2/83, root199/framework/eval smoke,
TypeScript/lint/scoped whitespace PASS. Three independent reviews and follow-up
exact-patch verification completed; specified pre-existing issues deferred.
Frozen Android bundle17a5ae89b8bbf053943862763986eb366ea518924b54fa7cb70f27a2994e2f3e.

Native continuation observation: frozen bundle17a5ae89... owner action runtime-mw8hnajd-7 completes consent/history, proceeds through source-media mapping, then actual native media copy/decode/encode/verify and server upload workflow. Repeated PRIVATE_MEDIA/MEDIA_CLEANUP/COMPLETE/durable complete outcomes are observed with the same initiating correlation; this is acknowledged per-copy progress, not whole-sync completion. No failure observed so far; leave app/code unchanged and continue until final ACCOUNT_SYNC_OPEN terminal plus owner UI evidence. No private identifiers or media inspected/exported.

### Media-service503 after acknowledged copies (2026-11-09, before implementation)
Frozen bundle17a5... native action runtime-mw8hnajd-7 passes mapping and many actual copy/decode/upload/activate/cleanup completions. Owner observed22/31. Later same-correlation MEDIA_STAGE/MEDIA_NETWORK/unknown occurs; preceding ACCOUNT_REFRESH/ACCOUNT_SESSION is COMPLETE. Supabase invocation record proves POST travel-life-private-media503 at07:00:16 after earlier200 activations; new runtime boot07:00:10 has no matching handler MEDIA_CONFIG start visible. Exact service failure cause is unknown; do not call it CPU/SQL/session failure. All previously acknowledged copies and one pending immutable job must be retained; no whole-Sync acceptance yet.

Diagnostic map BEFORE code: createMediaTransport request/response boundaries -> PRIVATE_MEDIA with existing MEDIA_NETWORK and closed MEDIA_SERVICE_REQUEST, MEDIA_SERVICE_HTTP_RETRY, MEDIA_SERVICE_BOOT, MEDIA_SERVICE_WORKER_LIMIT, MEDIA_SERVICE_RESPONSE_JSON, MEDIA_SERVICE_DEADLINE, MEDIA_SERVICE_SESSION, MEDIA_SERVICE_AUTH, MEDIA_SERVICE_SCHEMA. Classify only explicit response code BOOT_ERROR/WORKER_ERROR or WORKER_LIMIT when present, never infer from503 alone; other429/5xx -> HTTP_RETRY. Own signal expiry -> DEADLINE. Raw errors/body/message/headers never logged/rendered. Preserve fixed backend semantic errors and session invalidation only for proven ACCOUNT_SESSION. Changed owner fences outrank transport response/error. Existing non-service download handling unaffected except owner-fence correctness where needed. One initiating correlation retained.

Bounded recovery, same simple button: private-media-service.runJob may reconcile exactly once after a typed retryable service transport failure, using the already persisted immutable job. Reload and validate current owner's job, require same stage/activate mutation IDs, target,manifest/digest,source/account generations and URI; progress artifactId/active may advance. Never prepare new media or allocate replacement mutation IDs, never retry conflict/consent/quota/schema/access/storage/unknown categories or malformed success acknowledgement. Re-enter existing runPrivateMediaUpload which checks permission and stage/status/activation receipts; backend idempotency reconciles unknown acknowledgement. Stage MEDIA_RECONCILE START before retry, same correlation; first failed attempt stays honest unknown, second outcome explicit. After two failures retain exact checkpoint and expose retry; no unbounded retry, no automatic abandonment/deletion/overwrite. Already acknowledged copies remain skipped by mapping revisions.

Tests: transport503/429 malformed body/explicit boot/limit, request/deadline/session/auth/stale/redaction with synthetic sentinels; native workflow mocked lost stage/activation acknowledgement reconciling same IDs/derivative, exactly one extra attempt, second failure retains checkpoint, owner/consent fence before retry, unrelated pending job cannot replace, no repeated preparation/acknowledged copies. Existing SQL media receipt tests prove exact immutable retry semantics; no server change proposed without cause evidence. Scoped delivery uses media-transport.ts/private-media-service.ts/app-diagnostics.ts and account-media-transport/account-private-media-service tests. Full existing declared contexts and diagnostic policy remain authoritative. Current spec stays in-progress.

Recovery scope refinement: auto reconciliation only in the one-button syncReplay path (uploadSelection when manual=false and its pending-job branch), not manual Details upload/resume. Eligible typed boundaries are HTTP_RETRY/BOOT/WORKER_LIMIT/REQUEST/DEADLINE with MEDIA_NETWORK; no speculative auth/session retry. During recovery checkpoint loading disable managed suppression so exact new MEDIA_RECONCILE storage/fence/conflict failure is logged; restore managed only when entering second already-instrumented runPrivateMediaUpload. Require no stale UI update. No extra manual action or progress copy change.

Same-job safety verified on deployed function metadata (wrapper delegates to exact-digest receipt inner; live session/consent preserved, no direct authenticated grants) and4 local PostgreSQL rollback fixtures. Raw worker503 cause remains unknown; this is bounded resilience, not a CPU/SQL fix. Initial wrapper-only marker check was corrected to follow delegation; no user records inspected.

Closed Android log count for runtime-mw8hnajd-7 retains original ACCOUNT_SYNC_WAIT start and exactly30 PRIVATE_MEDIA/MEDIA_CLEANUP COMPLETE durable acknowledgements before terminal MEDIA_STAGE network failure; owner-reported total31. Therefore30/31 saved, one final checkpoint pending. This is stronger than earlier owner22/31 observation. Re-entry must skip30 acknowledged revisions and use exact saved final job. No user record content or source/media identifiers accessed.

Transport map refinement before finalizing patch: explicit backend error MEDIA_NETWORK on HTTP429/5xx is retryable MEDIA_SERVICE_HTTP_RETRY too, so observed503 can recover whether gateway/plain or closed worker JSON. BOOT_ERROR alone maps BOOT; WORKER_ERROR maps separate fixed MEDIA_SERVICE_WORKER_ERROR (worker runtime failure does not prove boot). Own timer expired during session verification maps MEDIA_SERVICE_SESSION_DEADLINE, not eligible for job replay because send has not started. Parsed nonretryable non-OK HTTP fallback maps MEDIA_SERVICE_HTTP_REJECT, distinct from JSON decode failure. Add corresponding redaction/eligibility cases; no new status codes exposed to UI.

Implementation evidence: `createMediaTransport.request` classifies the fixed service stages and keeps the current-owner fence before using a verified session, after fetch, and after response parsing, including rejections. Object download keeps its existing validation and byte bounds. `runPrivateMediaUpload` emits the classified first failure under the initiating correlation. `private-media-service.runJob` uses the shared `canAdvancePrivateMediaJob` predicate from `media-upload.ts`, also used by `history-store.savePrivateMediaJob`, to accept only the exact checkpoint and forward receipt progress. Recovery read/storage failure emits PRIVATE_MEDIA/MEDIA_RECONCILE/MEDIA_STORAGE retryable unknown, a malformed checkpoint emits MEDIA_SCHEMA blocked, a missing/replaced checkpoint emits MEDIA_CONFLICT blocked, and owner loss emits MEDIA_ACCESS skipped. The existing upload runner rechecks consent and source/account generation before any request in the second attempt. A second eligible transport failure keeps the saved job and surfaces that failure. Manual Details resume remains single-attempt.

Focused RED before runtime edits reproduced 15 failing assertions across the two affected suites, including unknown HTTP categorization, late deadline acceptance and first-attempt termination. Focused GREEN from `apps/mobile` ran `npx --no-install jest --runInBand --cacheDirectory .jest-cache --testPathPattern 'account-(media-(transport|upload|cache|native)|private-media-service)\.test'` with five suites and 108 tests passing after the transport refinement. Cases cover HTTP429/503 and explicit platform codes, service versus session deadlines, stale-owner precedence, malformed success, stage/activation response loss, current consent, storage failure, changed mutation/digest/URI, no repeated preparation and exact bounded reuse. Redaction checks use synthetic response/request/session and media sentinels. The device/service cause and owner completion remain open.

Collection recipe for the owner retry: verify the exact routed Android Metro bundle and new closed stage markers before the action. Use `.local/monitor-current-sync.cjs` for the current `com.anonymous.travellife` PID and follow the one initiating ACCOUNT_SYNC_WAIT correlation through PRIVATE_MEDIA, ACCOUNT_REFRESH and ACCOUNT_SYNC_OPEN. If an eligible failure recurs, look for its precise service stage, MEDIA_RECONCILE START and the final acknowledgement or exact second failure. Match the timeframe against the `travel-life-private-media` invocation status and any closed handler stage when available. Retain only the six closed fields and aggregate acknowledgement counts. Keep the existing pending job and observe owner Atlas navigation before claiming completion. Absence of a handler event leaves the underlying service cause unknown.

### Media receipt recovery review triage (2026-11-09)
Three independent reviewers completed. The scoped baseline diff includes earlier uncommitted M7 surfaces; re-review carries forward the existing deferrals for pending soundtrack requiring original and manual picker page mismatch. Review artifact omitted already-present media-receipt.ts, an artifact completeness gap, not a missing workspace module; add it to refreshed review diff. No Git stage/commit.

Patch before behavior changes: request JSON parse loss on2xx means acknowledgement unknown, eligible MEDIA_SERVICE_RESPONSE_JSON for one exact-job reconcile; malformed decoded status/receipt remains MEDIA_SCHEMA blocked/nonretryable with no reconcile. Non2xx unparseable status retains HTTP_AUTH, HTTP_RETRY or HTTP_REJECT as appropriate; only literal string backend reason/status values accepted, never String coercion of JSON. Explicit backend MEDIA_BUSY -> existing ALREADY_RUNNING, new MEDIA_SERVICE_UPLOAD_LEASE stage, skipped/not auto-replayed, preserve exact job. This is expected live lease work, not generic network. Add precise no-activation/no-clear tests for malformed statuses and no-retry lease test. Preserve typed AccountSyncStepError from nested permitted status by letting private action diagnose it once at original reason/stage; no manual action promise rejection or generic fallback. Preserve typed MEDIA_UNAVAILABLE/MEDIA_SCHEMA from derivative read, no auto-replay. SQLite regression verifies valid active advance then artifact replacement/active rewind rejected across stored read; true owner/receipt persistence, not just mocks. Add real transport synthetic546 worker-limit case through service reconcile and same immutable IDs. All remain same one-button flow.

Deferred: unsignalable session/body await may remain pending despite AbortSignal (existing behavior; do not claim hard wall clock cancellation); complete transport deadline race needs separate owner/session side-effect analysis. Final off-then-on consent revision and stale positive attachment availability require versioned authority validation (existing current-status booleans, not introduced here); record separately, don't claim all-M7 readiness. Pending soundtrack original requirement/manual page mismatch retain prior deferrals. Review-only Bash brace and Windows literal wildcard searches failed before reads, corrected to explicit paths or directory -g; no changes from failed commands. Focused108, SQLite112, type/lint, root199,4 PostgreSQL fixtures pass before final review corrections.

Review corrections verified in four affected mobile Jest suites (111 tests) and
the focused actual SQLite checkpoint test. Real service transport injected HTTP
546 WORKER_LIMIT and unreadable HTTP 200 during activation. Both reconcile with
one identical activation request, one stage mutation, one derivative and the
original correlation. Explicit MEDIA_BUSY records ALREADY_RUNNING at
MEDIA_SERVICE_UPLOAD_LEASE, skipped and nonretryable, and retains the checkpoint
without reconciliation or cleanup. HTTP 400 with unreadable JSON remains
HTTP_REJECT. Array error, status, upload and abandon fields are rejected without
coercion. Nested permitted-status failures keep their typed stage once, with
manual resume returning false, and derivative reads retain MEDIA_UNAVAILABLE or
MEDIA_SCHEMA. The in-memory SQLite fixture commits staged then active receipt
state, rejects artifact replacement and active rewind, and reads back the exact
committed job through the real store. This fixture does not reopen a database.

Final exact-patch review refinement BEFORE edit: media-upload cleanup must preserve an existing typed AccountMediaError reason (owner fence MEDIA_ACCESS/skipped; malformed derivative MEDIA_SCHEMA/blocked) at MEDIA_CLEANUP rather than reclassifying MEDIA_STORAGE. No extra replay/deletion. Verify a fenced clear preserves the active checkpoint with one closed skipped diagnostic. Move synthetic MEDIA_BUSY service integration from activation POST to actual PUT after staged status, matching server upload lease. Assert one PUT, no activation or replay, durable job retained. Real546 and2xx JSON ack-loss paths and SQLite monotonic checks otherwise independently verified. Review-only brace-expanded path command failed before read and was corrected with directory -g; no mutation.

Final review closure for software scope: the exact-patch reviewer found cleanup's typed-error flattening and wrong synthetic lease request placement, then hit its usage limit. Parent corrected and independently verified both. Cleanup RED had2 expected failures (typed ACCESS/SCHEMA became STORAGE); GREEN focused5 suites123 tests pass, including actual synthetic PUT409/no activation/retry, real transport546 and unreadable2xx exact-job recovery. Full106/1123 passed before the final one-line cleanup correction; final affected5/123, SQLite112, root199/framework/eval smoke, typecheck/lint and scoped whitespace pass. Four PostgreSQL receipt fixtures and live wrapper/inner receipt metadata verified. Review artifact refreshed with pre-existing receipt helper and all11 affected/required code-test files. Final Android bundle732093b79e21a8aa270ace4dbd4035d0c1d90546edc088458156d6796674a046 verified; existing app normally reopened, data/checkpoint untouched. No server deploy or Git mutation. Native30/31 still pending owner retry; wholeM7 remains in-progress.

Owner rerun on frozen bundle 732093b7 reached ACCOUNT_SYNC_OPEN COMPLETE, durable complete, with account provider and consumer binding complete. No terminal error occurred in the Sync correlation. The action did not emit a separate final-copy upload receipt in the captured log. Subsequent MEDIA_UNAVAILABLE preview fetches used separate correlations. Owner-visible Atlas navigation and Replay playback remain to verify.

Owner confirmed Atlas opened automatically after Sync and Replay played successfully on the account-bound Android flow. Owner-visible acceptance for this incident is complete. No separate final-copy receipt was observed.

Restore progress scope. Settings follows the Living Atlas responsive-work pattern used by AccountSyncPanel. The existing HISTORY_TRANSFER correlation and error classifier remain the diagnostic boundary. HISTORY_AUTH/HISTORY_ACK cover preparation and optional merge, HISTORY_PULL covers validated page download, HISTORY_REPLICA_STAGE/HISTORY_REBUILD cover on-device preparation, and HISTORY_READ/HISTORY_AUTHORITY/HISTORY_POINTER cover validation and publication. Existing reason codes, retryability and durable outcomes apply. Progress remains in UI state. On device 1ffb1e75, verify the active Metro bundle and filter closed app events for the restore action correlation.

Restore progress verification passed 53 tests across transfer, panel and restore integration, plus mobile typecheck and the foundation check. The panel shows percentage only for downloaded pages. Local processing shows ongoing activity until completion. Owner viewport and restore acceptance are pending.

Cross-device playback follow-up. The observed Android Replay spent about 107 seconds in preview resolution. Bound parallel preview resolution to three workers per request and preserve indexed results, ordered callbacks and owner fences. Existing PRIVATE_MEDIA MEDIA_FETCH, MEDIA_VERIFY and MEDIA_CACHE diagnostics cover per-item authorization, verification and storage. An unavailable item remains an unavailable placeholder. A changed owner context rejects the request with MEDIA_ACCESS. No new diagnostics fields. Collect only closed diagnostic events on the receiving Android process and compare matched cold preview stages on a later owner run.

Rendered Replay storage is a separate delivery item. Bind a private rendered artifact to the account, current aggregate and committed composition, including soundtrack and privacy revision. Admit only a verified complete output for that identity. Require fresh authorization on download and invalidate on consent, composition or aggregate changes. Use local rendering when a valid artifact is absent. Existing evidence and soundtrack targets do not implement those semantics.

  Host verification for parallel previews: 19 focused adapter, cache and native-media tests passed, mobile typecheck passed, and the foundation check passed all 199 tests. The concurrency regression verifies a fourth request starts only after one of the first three completes and callbacks remain ordered. The stale-owner regression verifies a resolved preview cannot publish after scope changes. Owner-device timing is pending. Cross-device rendered artifact storage remains open.
## Restore the last Atlas source on launch

The replica survives process exit, while the selected source was process-local. Persist the explicit source choice in account control storage and restore it after account hydration. Open only the saved owner's eligible replica through the existing scope checks. Existing installations can record their choice by opening account history once. An explicit switch to device history clears the preference. Use the existing HISTORY_TRANSFER correlation and open stages. HISTORY_OPEN_PREFERENCE covers preference reads and writes, with HISTORY_STORAGE for storage failures. Verify through a cold Android launch and compare the fixed HISTORY_PROVIDER_ACCOUNT and HISTORY_OPEN_BIND events.

## Review device history before syncing

Atlas offers a source switch between the device record and the restored account record. Timeline, journey editing and Replay follow the selected source. Switching calls the existing fenced account bind or local selection and carries the existing HISTORY_OPEN stages and correlation. Opening an unavailable account replica stays on the current source and offers Account recovery. Account history transfer starts only from explicit account actions. Remove foreground and OS account upload triggers while preserving local maintenance and saved transfer checkpoints. A deliberate sync attaches an unregistered device before export.
