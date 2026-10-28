---
title: Travel Life next scope - one account, multiple evidence sources
status: planned
updated: 2026-10-28
stepsCompleted: [1, 2, 3, 4]
scopeApproval: owner-approved-direction-2026-10-28
inputDocuments:
  - conversation: owner-approved-multi-source-party-recommendation
  - docs/decisions/0015-private-multi-source-travel-history.md
  - _bmad-output/planning-artifacts/mvp-spec.md
  - docs/product/design-system.md
  - docs/development/diagnostic-implementation-policy.md
  - evals/README.md
---

# One account, multiple sources: epics and stories

## Overview

The owner approved the preceding party recommendation and requested its next-scope
epics/stories on 2026-10-28. This is the canonical M6-M9 extension of
[epics.md](epics.md), not a replacement for M1-M5 or a second implementation plan.
All 20 stories below are planned; no account, sync service or connector is implemented
or deployed by this document. P0-next means required for this increment, not a
retroactive gate on the existing local MLP. Story decomposition and operational
defaults are planning choices within the approved direction.

The first complete milestone is M6 + M7: two phones contribute distinct and overlapping
evidence to one history, corrections converge, and the second phone can view/render
the synchronized selection while the source phone is offline. M8 then adds selected
Drive files; M9 adds selected Google Photos memories with explicit missing-location
handling. Local-only use remains available without signup.

## Requirements inventory

### Functional requirements

| ID | Requirement | Owning stories |
| --- | --- | --- |
| FR1 | Email OTP registration/login without a local-use signup wall | M6.1 |
| FR2 | Separate consent for private history sync and media storage | M6.2 |
| FR3 | Attach existing local history without losing corrections or Replay choices | M6.3 |
| FR4 | Restore an acknowledged private history on a new device | M6.4 |
| FR5 | Manage sessions, account switching, revocation and account deletion | M6.1, M6.5 |
| FR6 | Resume device evidence uploads and incremental downloads | M7.1 |
| FR7 | Recognize duplicates while retaining all source references | M7.2 |
| FR8 | Reconstruct one versioned history from combined evidence | M7.3 |
| FR9 | Synchronize corrections and resolve concurrent edits without silent loss | M7.4 |
| FR10 | Store authorized private derivatives for cross-device playback | M7.5 |
| FR11 | Render exact committed Replay selections from synchronized media | M7.6 |
| FR12 | Show per-source coverage/status and separate disconnect from deletion | M6.2, M7.7 |
| FR13 | Connect one or more Google accounts independently of app identity | M8.1, M9.1 |
| FR14 | Import selected Drive files server-side without manual phone downloads | M8.2 |
| FR15 | Recheck only authorized Drive files and recover expired/revoked access | M8.3 |
| FR16 | Use Drive memories in the unified Atlas and Replay | M8.4 |
| FR17 | Import user-selected Google Photos media through Picker | M9.1, M9.2 |
| FR18 | Batch-assign GPS-less memories without inventing visit evidence | M9.3 |
| FR19 | Use selected Photos memories across devices and truthfully manage retention | M9.4 |

### Non-functional requirements

- NFR1: Owner-scoped authorization at every API, row, object and job boundary;
  cross-account access fails even with guessed IDs. OAuth secrets stay server-side,
  mobile session secrets use platform secure storage. TLS and private encrypted
  storage are required; server-readable reconstruction is not end-to-end encryption.
- NFR2: Restart-safe, idempotent writes with durable acknowledgements and reconciliation
  after unknown outcomes. Offline queues, bounded backoff, pagination and job budgets
  prevent whole-library blocking. A timeout is not rollback.
- NFR3: Deletion fences stale clients and jobs before purging. Corrections,
  exclusions, source provenance and uncertainty survive migration and rebuilding.
- NFR4: No raw evidence in diagnostics, Git or external model calls. AI consent stays
  separate. Apply the closed diagnostic contract to mobile, browser OAuth callbacks
  and backend workers. Provider/default infrastructure logs need redaction too.
- NFR5: iOS and Android use platform-permitted background scheduling plus foreground
  catch-up. Actual device evidence is required; no immediate-background-sync promise.
- NFR6: Measure import, sync, render latency and bytes on declared synthetic dataset
  sizes and real test devices. Publish observed values and limits; no invented speed,
  reconstruction accuracy, completion percentage or lifetime-coverage claim.
- NFR7: Declare media byte/count/job quotas, retry ceilings, supported codecs,
  retention and deletion deadlines before enabling each service. Enforce them on the
  server and show actionable limit/partial states. Values are implementation gates,
  not a pricing/payments epic.

### Architecture and migration requirements

- Extend the existing Expo/SQLite/Supabase direction; no greenfield app or graph DB.
  Email OTP is the first account method. Google/Apple login is deferred.
- Keep local-only reconstruction; opt-in accounts receive a server-authoritative,
  versioned aggregate and a local offline replica. Reuse the deterministic engine
  through a runtime-neutral boundary; never import native mobile storage into workers.
- Separate account identity, device installation, provider connection, source asset,
  logical duplicate family, evidence, derived history, correction and media artifact.
  Source keys are scoped to their connection; they are not globally unique photo IDs.
- Merge evidence and correction operations, not independently generated trip lists
  or whole SQLite files. Owner-reviewed facts remain separate from later inference.
- Each accepted aggregate records evidence/correction watermark and engine version;
  atomically activate it only if those inputs remain current. Preserve the previous
  usable history through failed builds. No policy-parameter change is authorized.
- Account sync is private storage, not M4.5/M4.6 publication. Keep the deferred
  publication gate off and use separate data/access paths. Originals remain at source;
  authorized app-owned derivatives support playback. Do not promise original backup.
- No full architecture/API specification existed for this scope at planning time.
  Each story must record its exact schema/API/version and migration contract before
  behavior changes; only introduce entities needed by that story. Provider feasibility
  and infrastructure configuration are gates inside their stories, not assumed done.

### UX requirements

| ID | Testable experience requirement | Owning stories |
| --- | --- | --- |
| UX1 | Keep local entry; request OTP only at sync/restore/add-source intent | M6.1 |
| UX2 | Explain exact upload scope, server processing and media retention before opt-in | M6.2 |
| UX3 | Source cards show observed date coverage, last successful update and partial states; never percent of a person's life | M6.2, M7.7 |
| UX4 | Preserve trip/scroll/selection through async work and returns; use measured or indeterminate progress appropriately | M6.3, M7.6, M8.2, M9.2 |
| UX5 | Show recognizable media for conflict/assignment choices; provide batch actions and undo | M7.4, M9.3 |
| UX6 | Distinguish disconnect, remove imported contributions and delete account; confirm destructive scope once | M6.5, M7.7, M8.3, M9.4 |
| UX7 | Follow Living Atlas/lean self-serve patterns, accessible labels, large text and reduced motion on both platforms | All stories |

Account/source screens extend the accepted design language; they do not invent
prototype functionality. Validate actual phone layouts and focus/Back recovery.

## Epic list and coverage

| Epic | Complete user outcome | Stories | Dependency | Release |
| --- | --- | --- | --- | --- |
| M6 - Keep and restore my private history | Create an account, opt in, preserve/restore existing history, control account data | 5 | Existing local app | next-account |
| M7 - One history and Replay across my devices | Contribute both devices, reconcile evidence/edits, access authorized media | 7 | M6 | next-multi-device |
| M8 - Add memories directly from Google Drive | Select, import, recheck and use Drive files without manually downloading to a phone | 4 | M7 | next-drive |
| M9 - Add selected Google Photos memories | Import chosen memories, resolve missing places and use them across devices | 4 | M8 shared connection boundary | next-photos |

FR and UX coverage is mapped above. NFR1-NFR7 and the delivery contract apply to
every story at its affected boundaries; feature-specific failure cases follow below.
Future-epic functionality is not a prerequisite for completing an earlier epic.

## Common delivery and diagnostic contract

Each story uses one linked delivery record with its exact AC IDs, migration/API
contract, changed files, tests, diagnostic map and acceptance evidence. Read the
error playbook before work; record incidents in the same task. Run root
`npm run check`, affected package typecheck/lint/tests and actual service/device
checks appropriate to the change. Host tests never close physical acceptance.

Before implementation, expand the following planning map into exact fixed codes,
source module/function, safe next action and collection recipe. These names are
proposed operation families, not claims that runtime codes already exist.

| Stories | Operation family / failure stages | Categories and durable outcomes to distinguish |
| --- | --- | --- |
| M6.1, M6.5 | ACCOUNT / request-code, verify, refresh, revoke, delete | invalid/expired, throttled, denied, unavailable, deletion-pending, acknowledged |
| M6.2-M6.4 | HISTORY_TRANSFER / consent, enumerate, stage, acknowledge, restore | consent-missing, incompatible-schema, conflict, quota, unknown-write-outcome |
| M7.1-M7.4 | HISTORY_SYNC / push, deduplicate, reconstruct, apply-correction, activate, pull | access-revoked, stale-input, version-conflict, retryable-network, unknown-commit |
| M7.5-M7.6 | PRIVATE_MEDIA / copy, decode, upload, verify, fetch, render, cleanup | unsupported, quota, source-unavailable, scope-lost, failed-verification, unknown-upload |
| M7.7 | SOURCE_CONTROL / pause, revoke, tombstone, purge | offline, pending, denied, partial-cleanup, completed |
| M8.1-M8.4 | DRIVE_IMPORT / authorize, enumerate-selected, fetch, extract, commit, recheck | cancelled, expired, revoked, unsupported, missing-metadata, rate-limited |
| M9.1-M9.4 | PHOTOS_IMPORT / picker, poll, fetch, retain, associate, cleanup | cancelled, session-expired, revoked, unavailable, missing-location, stale-assignment |

For each new fallible boundary force representative synthetic failures; assert fixed
operation/stage/reason, retryability, durable outcome and one action correlation across
layers. Inject private-content/token/location sentinels and assert none reach logs or
UI serialization. Cancellation, stale work and unavailable optional content are explicit
lifecycle outcomes. Collection recipes identify build/process/service and structured
filters; actual private evidence stays in ignored storage. No generic UNKNOWN can
replace a known source/stage. Security checks and privacy controls ship with each
feature, not as a later hardening epic.

## Epic M6: Keep and restore my private history

### Story M6.1: Enter my account with an email code

As a traveller, I want one email-code flow, so that I can return to my account on another phone without creating a password.

**Depends on:** none (existing local app). **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M6.1-1:** Given a local-only user, when they continue locally, then no account is required and no cloud history upload starts; when they choose sync/restore, then email OTP creates or enters the verified account without a profile wizard.
- **AC-M6.1-2:** Given expired, reused, wrong or repeatedly requested codes, when verification/resend runs, then server limits and safe retry states apply without exposing account existence or credentials in diagnostics; verified sessions survive app restart in secure storage.
- **AC-M6.1-3:** Given account A data, when account B or an unauthenticated client requests any account resource, then access is denied; signout stops work and locks/clears A's account cache and credentials while preserving a separately scoped pre-existing local record.
- **AC-M6.1-4:** Given the production email path, when validating delivery, refresh and expiry on iOS/Android, then real service/device evidence is recorded; SMTP configuration and abuse controls are prerequisites to public enablement.

### Story M6.2: Choose what my account stores

As a traveller, I want to understand and choose sync scope, so that adding a device does not silently upload my private library.

**Depends on:** M6.1. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M6.2-1:** Given a signed-in local user, when they enable sync, then a concise preview identifies the metadata/history/corrections scope, server-readable processing, retention and separate media option; photo permission, login and AI consent do not substitute for this choice.
- **AC-M6.2-2:** Given denied or withdrawn consent, when any queued transfer begins, then it rechecks the current scope and cannot upload unauthorized content; declining retains local use.
- **AC-M6.2-3:** Given the source screen, when opened, then this device appears with accessible/processed counts, observed date range, last successful update and empty/partial/offline states; unobserved years are not claimed covered.
- **AC-M6.2-4:** Given media sync is not yet available, when choosing history sync, then copy truthfully says history-only and does not promise media backup; later media enablement requires its own scope choice.

### Story M6.3: Preserve my existing local record in my account

As an existing user, I want to attach my current record, so that adopting an account does not reset the work I already did.

**Depends on:** M6.2. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M6.3-1:** Given evidence, lineage, manual journeys, corrections, Hide/Exclude and committed Replay selections/order/soundtrack references, when migration completes, then stable account-scoped mappings preserve their semantics; unavailable local media/audio references remain explicit, not falsely playable.
- **AC-M6.3-2:** Given cancellation, process death or an acknowledgement timeout at any batch, when resumed, then durable receipts avoid duplicates and reconcile unknown outcomes; the intact local record remains usable and is not deleted after upload.
- **AC-M6.3-3:** Given an account already holding a snapshot, when a different local record attaches before M7 merging is available, then it is retained separately as a pending contribution without overwriting or silently combining histories; UX states that merging is pending.
- **AC-M6.3-4:** Given synthetic retained-schema and correction fixtures, when migrated and read back, then all approved facts and exclusions match; mismatched schemas fail safely with an actionable diagnostic and no data clearing.

### Story M6.4: Restore my acknowledged history on a new phone

As a returning user, I want to restore a private history, so that losing access to the original phone does not lose my reviewed travel record.

**Depends on:** M6.3. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M6.4-1:** Given an acknowledged compatible snapshot, when a second phone restores it, then Atlas, Timeline, reviewed facts and corrections use that snapshot without requiring original photos to be copied onto the phone.
- **AC-M6.4-2:** Given a partial download or restart, when restoration resumes, then chunks are verified and an incomplete aggregate is never activated; existing local content is not overwritten or mixed across accounts.
- **AC-M6.4-3:** Given only history was synchronized, when opening missing media or Replay, then the app shows media-unavailable state and preserves the trip; after a successful restore, cached history is readable offline.

### Story M6.5: Control my sessions and delete my account data

As an account owner, I want session and deletion controls, so that I can stop access and remove data without losing track of what remains.

**Depends on:** M6.4. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M6.5-1:** Given several sessions, when one is revoked, then subsequent server requests and refreshes from it fail and queued uploads cannot reauthorize themselves; explain that an offline device cannot be remotely wiped instantly.
- **AC-M6.5-2:** Given a reauthenticated deletion request, when accepted, then an account deletion fence first prevents reads/writes/jobs, then metadata, objects and credentials are purged with idempotent retries and visible pending/completed status; a stale device cannot resurrect the deleted account generation.
- **AC-M6.5-3:** Given account switching, when another owner signs in, then caches, jobs and source credentials remain isolated; local data is never silently attached to the new owner.
- **AC-M6.5-4:** Given deletion/retention policy, when enabling the feature, then active storage and backup expiry deadlines are documented and tested where observable; original source files are untouched, and signout, local deletion and account deletion have distinct copy.

## Epic M7: One history and Replay across my devices

### Story M7.1: Contribute evidence from each of my phones

As a traveller, I want both phones to contribute available evidence, so that my history is not limited to one library.

**Depends on:** M6.5. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.1-1:** Given two consenting devices, when each scans, then normalized evidence with source-scoped identity, time precision/timezone and access provenance is accepted into one account; retries do not duplicate contributions.
- **AC-M7.1-2:** Given offline edits/scans and interrupted transfers, when connectivity returns, then durable outbox/cursor checkpoints resume bounded batches; no account-wide database copy or indefinite UI wait is required.
- **AC-M7.1-3:** Given library permission reduction, revoked sessions or account deletion, when work resumes, then current scope/deletion fences apply before upload; temporary source absence is not treated as an instruction to erase reviewed facts.
- **AC-M7.1-4:** Given background execution on each platform, when scheduling is delayed or denied, then foreground catch-up works and last-success status stays truthful; tests cover concurrent uploads and independent cursor progress.

### Story M7.2: Recognize copied photos without losing their sources

As a traveller, I want copied media recognized, so that the same photo does not inflate visits or erase my access to another copy.

**Depends on:** M7.1. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.2-1:** Given verified identical content from two sources, when normalized, then one duplicate family contributes at most one independent evidence unit while retaining both source references and availability states.
- **AC-M7.2-2:** Given coincident timestamps/names or edited/resized copies without strong identity evidence, when comparing, then uncertain matches remain candidates rather than destructive merges; similarity alone cannot suppress distinct photos.
- **AC-M7.2-3:** Given one duplicate copy is missing or removed, when reconciling, then the authorized surviving copy remains usable; conflicting metadata retains provenance and does not silently promote low-confidence values.
- **AC-M7.2-4:** Given synthetic exact, transformed, same-name and cross-account examples, when evaluated, then deterministic results and false-merge checks are recorded; content fingerprints cannot be queried as a cross-user existence oracle.

### Story M7.3: Reconstruct a unified history from combined evidence

As a traveller, I want one coherent history, so that portions of a trip on different phones can form a single supported journey.

**Depends on:** M7.2. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.3-1:** Given complementary evidence on two devices, when rebuilding the account aggregate, then the pinned reconstruction rules process the combined normalized evidence and correction overlay, rather than concatenating device trip lists; source data never implies owner presence automatically.
- **AC-M7.3-2:** Given input-order permutations and equivalent local/account fixtures, when the runtime-neutral engine runs, then normalized results match for the same inputs/version; record regression comparisons under evals/README.md without claiming population accuracy.
- **AC-M7.3-3:** Given evidence or corrections change during a build, when activation is attempted, then stale watermarks prevent activation and schedule bounded reconciliation; failure leaves the previous valid history visible.
- **AC-M7.3-4:** Given a successful aggregate, when both clients pull, then they activate the same revision atomically; preserved correction lineage and ambiguous Needs review states remain inspectable.

### Story M7.4: Keep my corrections consistent across devices

As an owner, I want edits preserved and conflicts visible, so that another phone cannot silently undo my decisions.

**Depends on:** M7.3. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.4-1:** Given an offline correction, when sync resumes, then its stable operation identity and expected target version are reconciled once; inference cannot overwrite owner-confirmed facts, Hide/Exclude, reject, split or merge decisions.
- **AC-M7.4-2:** Given concurrent incompatible changes, when applied, then neither is silently discarded by timestamp; a visible conflict preserves both proposals and lets the owner select a resolution with recognizable trip/media context.
- **AC-M7.4-3:** Given inference changes target lineage, when correction replay occurs, then existing fail-closed versus Needs review policy remains intact; ambiguous remaps never attach to an unrelated trip.
- **AC-M7.4-4:** Given deletion tombstones and delayed devices, when replaying stale changes, then deleted contributions cannot resurrect; undo is a new authorized versioned action, not clearing the fence.

### Story M7.5: Keep private media available away from its source phone

As a traveller, I want authorized viewing copies stored privately, so that I can see my memories when the original phone is offline.

**Depends on:** M7.4. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.5-1:** Given explicit media selection/consent, when preparing upload, then only permitted derivatives are copied/decoded and verified against declared type, size and duration constraints; no originals or unrelated library assets are uploaded by default.
- **AC-M7.5-2:** Given interrupted upload, quota exhaustion or lost acknowledgement, when recovering, then resumable/idempotent staging and verified activation avoid duplicate billing/storage and broken active references; abandoned objects have bounded cleanup.
- **AC-M7.5-3:** Given private stored media, when another account guesses its key or a revoked owner requests it, then access fails; authorized owner access uses bounded-lifetime URLs and does not create public snapshots or permanent public links.
- **AC-M7.5-4:** Given a declared storage/codec/quality policy, when the source phone goes offline, then the second phone can fetch the acknowledged derivatives; unsupported or unsynchronized items remain explicit, and cache eviction does not delete source originals.

### Story M7.6: Play and export the same committed Replay on another phone

As a traveller, I want my Replay choices to travel with me, so that a new phone can render the same selected memories.

**Depends on:** M7.5. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.6-1:** Given a committed manifest, when another device opens it, then included groups, media ordering and soundtrack identity resolve from that manifest; bounded screen thumbnails cannot become composition authority.
- **AC-M7.6-2:** Given built-in or custom audio, when syncing Replay, then built-in versions resolve consistently and custom audio is copied only under explicit media consent and validated support/rights policy; missing audio is disclosed without silent soundtrack substitution.
- **AC-M7.6-3:** Given source phone offline, when rendering an acknowledged synchronized selection on the second phone, then required derivatives are downloaded automatically on demand and exact preview succeeds; airplane-mode playback is promised only for already-cached media/artifacts.
- **AC-M7.6-4:** Given permission/deletion changes or concurrent edits, when rendering/exporting, then the exact authorized revision is rechecked and stale work cannot share; existing deliberate native share-sheet flow remains separate from sync.

### Story M7.7: Understand and control the combined sources

As an owner, I want clear source status and removal controls, so that I can manage my history without guessing what disconnect means.

**Depends on:** M7.6. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M7.7-1:** Given multiple devices, when viewing Sources, then each shows observed contribution coverage, last success, pending/error/paused/offline state and distinct metadata/media progress; progress uses a real denominator or indeterminate state.
- **AC-M7.7-2:** Given disconnect, when confirmed, then new source reads stop while already retained history/media remains under disclosed policy; Remove imported contributions separately previews affected facts/media and deletion consequences.
- **AC-M7.7-3:** Given removal races with imports, renders and offline writes, when accepted, then source-generation fences/tombstones block reinsertion and stale access; surviving duplicate sources and independently owner-entered facts are preserved, with uncertain remaps shown for review.
- **AC-M7.7-4:** Given two physical devices with distinct and duplicate media, when completing account attachment, merge, correction, offline source playback and reconnect-after-delete, then the milestone scenario passes on Android/iOS with recorded versions; unavailable platform evidence remains an open release gate.

## Epic M8: Add memories directly from Google Drive

### Story M8.1: Connect a Google Drive source independently of app login

As an owner, I want to connect the Google accounts holding my files, so that my app login email does not limit available sources.

**Depends on:** M7.7. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M8.1-1:** Given one Travel Life account, when connecting distinct Google accounts, then each becomes an independently revocable source; OAuth does not create or silently switch the Travel Life owner.
- **AC-M8.1-2:** Given an OAuth callback, when validated, then state/PKCE as appropriate, redirect allowlists and owner/session binding prevent account substitution; refresh credentials stay encrypted server-side and never enter logs or ordinary client storage.
- **AC-M8.1-3:** Given Drive Picker and drive.file scope, when selecting files, then only granted files are eligible; selecting a folder must not be treated as a grant to all descendants. Provider cancellation/denial returns safely to Sources.
- **AC-M8.1-4:** Given provider setup, when enabling the connector, then current scopes, verification obligations, quotas and consent-screen behavior are checked with official docs and a real test account; broad drive.readonly and automatic folder crawling remain deferred.

### Story M8.2: Import selected Drive files without phone downloads

As a traveller, I want selected cloud files processed directly, so that I do not need to gather them on a single phone first.

**Depends on:** M8.1. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M8.2-1:** Given explicitly selected authorized files, when import begins, then a bounded backend job fetches them directly from Drive, extracts available metadata and creates private viewing derivatives; the phone handles control/progress, not bulk library transit.
- **AC-M8.2-2:** Given available EXIF and missing/conflicting dates/GPS, when normalizing, then provenance/precision are retained and unknowns remain unknown; upload time and folder names cannot silently become capture time/place.
- **AC-M8.2-3:** Given revoked permissions, unsupported formats, corrupt files or quota/rate limits, when processing, then per-job partial outcomes, resume/cancel and fixed diagnostics are actionable; retries cannot duplicate committed contributions.
- **AC-M8.2-4:** Given malicious file metadata, oversized media or redirected fetches, when ingestion runs, then bounded decoding and trusted-provider fetch controls prevent arbitrary URL access and resource exhaustion; original Drive files remain untouched.

### Story M8.3: Recheck and disconnect only my authorized Drive files

As an owner, I want retained Drive selections maintained honestly, so that changed permissions or files do not silently break my record.

**Depends on:** M8.2. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M8.3-1:** Given granted selected files, when scheduled or manual recheck runs, then only those files are revisited using bounded version/change tracking; new folder children are not discovered without a supported new grant.
- **AC-M8.3-2:** Given file revision, disappearance or revoked access, when reconciling, then versions/provenance and retained-copy policy determine the outcome; loss of access does not fabricate deletion of owner-confirmed travel.
- **AC-M8.3-3:** Given disconnect versus Remove imported contributions, when used, then M7.7 semantics apply to credentials, pending jobs, history and private media; reconnect is explicit and cannot revive tombstoned content automatically.

### Story M8.4: See Drive contributions in my Atlas and Replay

As a traveller, I want imported Drive memories usable everywhere, so that the connector actually expands my travel history.

**Depends on:** M8.3. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M8.4-1:** Given overlapping phone/Drive files and distinct supported evidence, when import settles, then duplicates do not inflate independent support and new evidence enters the versioned account rebuild with corrections preserved.
- **AC-M8.4-2:** Given selected retained Drive derivatives, when another phone opens Atlas/detail or prepares a committed Replay subset, then authorized media resolves without requiring the owner to download originals manually; unavailable content is explicit.
- **AC-M8.4-3:** Given a real test source and both platforms, when testing import, revoke, quota failure, reconnect and removal, then provider/device evidence and measured bytes/latency are recorded; mocks alone do not close connector acceptance.

## Epic M9: Add selected Google Photos memories

### Story M9.1: Choose Google Photos memories explicitly

As a traveller, I want to pick cloud memories, so that I can add them without copying my whole library to a phone.

**Depends on:** M8.4. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M9.1-1:** Given an owner source connection, when starting Photos Picker, then the provider selection/session flow is bound to that owner and selected Google account; login and library permissions do not grant whole-library historical scanning.
- **AC-M9.1-2:** Given cancellation, expired sessions or interrupted app return, when resuming, then bounded polling and state validation produce a safe retry without importing unselected media or switching account ownership.
- **AC-M9.1-3:** Given the connection screen, when explaining coverage, then it says selected photos/videos only, no continuous whole-library scan, and location may be absent; actual current API/policy behavior is revalidated before enablement.

### Story M9.2: Retain selected Photos media through a resumable import

As a traveller, I want chosen media imported while access is valid, so that temporary provider URLs do not become broken permanent memories.

**Depends on:** M9.1. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M9.2-1:** Given completed selection and explicit private-retention consent, when the backend fetches selected items, then paging, authenticated temporary URLs and media readiness are handled within bounded jobs; only verified authorized derivatives become active.
- **AC-M9.2-2:** Given expired URLs, revoked access, restart or unsupported video, when retrying, then supported session recovery or an explicit reselection path is offered; temporary URLs are not stored as durable playback authority and partial completion is reported accurately.
- **AC-M9.2-3:** Given returned metadata/media bytes, when normalized, then missing GPS stays absent and source/API limitations are retained; no assumed EXIF-location recovery, inferred route or unconsented AI geolocation is introduced.
- **AC-M9.2-4:** Given provider retention/deletion policy, when enabling stored derivatives, then its current compatibility with the intended use is documented and enforced; if unsupported, that capability remains disabled with the concrete constraint recorded.

### Story M9.3: Place GPS-less memories into my history in batches

As a traveller, I want to assign selected groups of memories, so that missing GPS does not force me to edit every photo individually.

**Depends on:** M9.2. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M9.3-1:** Given imported GPS-less photos, when selecting a recognizable group, then the owner can attach it to an existing trip or create an owner-entered trip/place with explicit observed/confirmed date semantics; unknown media can remain unassigned.
- **AC-M9.3-2:** Given a suggested association based on time or existing evidence, when displayed, then it is labeled as a suggestion and never counted as independent GPS/presence support; trip membership and visit evidence remain separate.
- **AC-M9.3-3:** Given batch assignment, undo or a concurrent device edit, when saving, then versioned correction rules preserve the exact chosen set and report conflicts; place confirmation is attributed to the owner, not the provider.
- **AC-M9.3-4:** Given mixed missing/known dates and locations, when synthetic regressions run, then no unsupported visit/count is invented; real accuracy remains unmeasured until separately consented evaluation.

### Story M9.4: Enjoy and control Photos memories across devices

As an owner, I want selected Photos memories available and removable across my account, so that they behave consistently with my other sources.

**Depends on:** M9.3. **Priority:** P0-next. **Status:** planned.

**Acceptance criteria:**
- **AC-M9.4-1:** Given retained authorized media and accepted associations, when another phone opens the trip or committed Replay, then media resolves in the chosen ordering without relying on expired Picker URLs or the importing phone.
- **AC-M9.4-2:** Given uncertain duplicates of device/Drive assets, when combining, then conservative M7.2 behavior applies and missing fingerprints do not justify automatic merges; all source provenance remains available.
- **AC-M9.4-3:** Given disconnect, remove-import or account-delete, when processed, then disclosed retention/provider obligations and deletion fences apply to derivatives, associations and queued jobs; remote source originals are not deleted.
- **AC-M9.4-4:** Given real Picker sessions on both platforms, when testing selection, expiration, missing GPS, batch assignment, cross-device playback and deletion, then actual evidence is recorded and no claim of whole-library completeness or autonomous historical scanning appears.

## Delivery order, enablement gates and exclusions

1. M6.1-M6.5 deliver account + consent + recoverable history (media still explicit).
2. M7.1-M7.7 deliver the first complete multi-device milestone. Account history-only
   restore is not misreported as full multi-device Replay acceptance.
3. M8.1-M8.4 deliver selected Drive files end-to-end.
4. M9.1-M9.4 deliver selected Photos memories end-to-end.

Every dependency is earlier in this list. No dates/effort estimates are invented.
Each story includes UI/API/storage/tests for its own capability; split further only
if source inspection reveals a concrete independently testable boundary.

Before production enablement, record the service destination/region, payload scope,
retention/deletion and backup policy, provider approval status, quotas and real-device
evidence in the affected delivery record. Scope approval authorizes this planning;
it is not evidence of configured infrastructure or permission to upload private test
libraries to an unspecified destination. Synthetic development can proceed separately.

Deferred: Google/Apple app sign-in, full Drive/folder crawling, autonomous Google
Photos historical scan, Takeout/archive import, desktop agent, original-resolution
backup, collaborative accounts, payments, E2EE claims, new AI photo processing,
public hosted sharing and recipient browser viewer. Cloud connector files need not
transit the phone, but server fetches and on-demand phone playback downloads still
consume bandwidth/storage. The app cannot recover evidence never made available.

## Planning validation

Completed 2026-10-28: 20 unique story IDs, 76 unique acceptance criteria, 19 FRs
and 7 UX requirements mapped; all explicit dependencies resolve to earlier stories.
The combined CSV has 47 unique rows and all 20 new titles/statuses match. Checked
79 local links across the new backlog/decision and updated planning indexes.
`npm run check` passed: 49 foundation tests, pinned framework integrity (44 skills,
four runtime trees) and eval infrastructure smoke. `git diff --check` passed.

Semantic validation retained the four value/risk boundaries: account restore,
multi-device reconciliation/media, Drive grants, and Photos selection/missing GPS.
Shared source infrastructure is reused by M8/M9 rather than duplicated. Each
story owns end-to-end behavior and failure evidence; none requires future-epic
functionality. The owner delegated construction from the accepted party scope;
routine extraction/decomposition confirmation menus were not additional approvals.

No runtime/device/provider acceptance has been performed for M6-M9. Exact service
contracts and operational settings remain the declared per-story implementation
gates, not unresolved product-scope decisions. Next implementation entry is M6.1
through `bmad-build`, with its account/session contract recorded before coding.
