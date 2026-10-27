# Publication, access and persistence contract

## Source and service boundaries

Brownfield inventory on 2026-10-26: apps/prototype/src/components/prototype-screens.tsx has a synthetic-only ShareView; apps/mobile/src/components/replay-screen.tsx has selected video export. supabase/ currently contains AI-proxy functions/migrations, not snapshot publishing. Reuse current policy-visible Journey List/media contracts and protected auth boundary; do not treat mock UI, stale epic status or private Replay keys as a server share identity.

M4.5 defines an additive versioned protocol. Proposed service locations: mobile sharing module and management surface under apps/mobile/src; dedicated snapshot functions/migrations under supabase. Exact filenames/API signatures are implementation choices, verified against current SDK/runtime. No schema migration number is reserved here; inspect the then-current schema and serialize migrations normally.

## Public schema v1

| Field | Allowed content |
| --- | --- |
| schemaVersion, version | Supported protocol version and immutable snapshot version |
| title, kind | Bounded plain-text title; journey or lifetime-highlight |
| destinations | Snapshot-scoped opaque keys, sanitized names/country labels, named-place centroid, supported date value/precision and inferred/confirmed status |
| chapters | Explicit selected destination/media references and chronological display order; unknown dates last |
| media | Snapshot-scoped opaque keys, verified MIME, dimensions/duration, safe caption and media kind; no storage path or original filename |
| summary | Selected-only counts with existing uncertainty/counting rules |
| expiresAt | Server-authoritative UTC expiry; display localized on clients |

Reject unknown fields and dangling/cross-version references. Bound title to 120 Unicode characters, captions/place labels to 200, facts-only payload to 256 KiB and destinations to 1,000 per version (proposed engineering limits). Reject over-limit input explicitly; do not truncate or change Unicode rendering. No local/source IDs, exact GPS, EXIF, original capture timestamps, device paths, tokens, auth IDs, raw evidence or inference internals are public. User-chosen day dates remain allowed with true source precision. Escape plain text on render and reject executable URLs/HTML; media comes only from controlled derivative endpoints.

## Private ownership and lifecycle

Logical server records: owner-protected share handle, immutable versions, derivative manifest, publish operation/receipt and quota reservation. Persist owner subject server-side, status, active version, server expiry, token digest and idempotency identity. Derivative objects have random object names and belong to one owned version; public opaque keys reveal no source identity. RLS/privileges apply to every exposed table and storage path. Authorize with the verified subject and ownership predicates; an authenticated role alone is insufficient. Privileged functions set a safe search path and narrow grants. Client receives no service-role key.

The public bearer URL uses at least 128 cryptographically random bits. Store only a digest server-side; the owner keeps the raw capability in protected local storage. A lost local capability can be replaced only through an authenticated owner operation that invalidates the previous one; do not recover it from a digest or log it. Proposed URL carries the capability in a fragment; M4.6 exchanges it through a redacted request body/header and removes it from browser history state after reading. Never put bearer tokens in query parameters, access-log paths, analytics, referrers or error reports. Hosting/function logging must be verified for body/header redaction before enablement.

Start an anonymous session only on deliberate publication/management need, with abuse protection configured. Do not couple sharing enablement to the AI kill switch or authorize provider calls. Owner controls require that original protected session; losing it loses control until expiry unless a supported recovery mechanism is later added.

## Atomic publication

1. Build the draft locally from current eligible scope; generate bounded sanitized derivatives locally. Preview the exact output and freeze a private content digest plus privacy/correction/access revision and selection intent.
2. Explicit Publish authorizes this draft. Persist an operation ID and local protected recovery state before network work. Reserve quota atomically; create a non-readable staging version tied to owner/request/content digest. Same request with changed content is rejected.
3. Upload only manifest-allowlisted derivatives to private staging storage. Verify decoded MIME, dimensions, byte lengths and checksums server-side; remove EXIF/container metadata, reject polyglots, unexpected tracks/attachments and unsafe payloads. A client assertion alone is insufficient. No arbitrary remote URL fetching.
4. Recheck current local visibility/access and selection digest immediately before activation. Changed scope invalidates confirmation and requires a new preview; never silently mutate the frozen payload. Network-offline activation cannot continue from a stale background job. This check is a client privacy barrier; the server cannot independently infer private on-device eligibility.
5. Server atomically verifies complete manifest, ownership, quota and expiry, activates one immutable version and records its receipt. A replacement swaps the active pointer in the same transaction. Incomplete versions remain unreadable. A later local privacy change does not mutate an already published version.
6. Acknowledged receipt enables published UI. If the response is lost, query operation status by owner/request, retrieve the original result and reconcile. Retries never create another share or consume a second reservation for the same operation. Cancellation is effective only before activation begins; once reconciliation proves activation, it leaves the published link intact and offers the owner a separate explicit Revoke action. It never guesses remote absence from a timeout.

Storage and SQL cannot share a transaction: staging is private, activation references only verified complete objects, and cleanup handles abandoned objects. Crash/restart resumes or reconciles the same operation. A failed replacement leaves the prior version accessible until its own revoke/expiry.

## Reads, revoke and expiry

Recipient snapshot and media endpoints check the bearer capability, active status, server expiry and exact active version at each request. Return a fixed unavailable response for malformed/unknown/revoked/expired links without disclosing their existence or owner. Owner list/status may distinguish them. Media membership must match the requested snapshot/version; defend against cross-share object probing, traversal and oversized ranges.

Serve media through an authorization-checking proxy, including video range requests; do not issue bearer storage URLs that outlive revoke. Never expose public bucket objects. Revoke atomically marks the share inactive; requests authorized after its acknowledgement are denied, even if cleanup has not run. Already delivered bytes and an in-flight previously authorized response cannot be recalled; state that boundary honestly. Old version endpoints deny reads after replacement.

Use no-store/private cache controls, no service-worker persistence, no indexing and no referrer leakage. M4.6 applies the same policy to viewer HTML/metadata; third-party maps must receive neither capability nor private media. Any intermediary/CDN must obey authorization and cache denial; verify this rather than assuming headers suffice.

Expiry is evaluated server-side on every read, independently of cleanup scheduling and device clock. Revoke wins races with republish/expiry updates: optimistic ownership/version checks prevent activation after revoke. Repeating revoke is idempotent.

## Proposed bounded defaults and retention

These are engineering assumptions to validate/configure during implementation, not published capacity promises. Show actual applicable limits before confirmation. Enforce limits server-side and reserve atomically across concurrent operations; never silently cut selected content.

| Control | Proposed default |
| --- | --- |
| Link expiry | 30 days; adjustable 1–90 whole days from confirmed server time |
| Active links / owner | 20 |
| Media / version | 100; 250 MiB aggregate derivatives; 50 MiB per file |
| Stored bytes / owner | 1 GiB, counting staging, active and retained versions |
| Publish activation rate | 10/hour/owner; edge abuse limits additionally required |
| Images | JPEG, max 1600px long edge, no upscaling, EXIF removed |
| Videos | MP4 H.264/AAC up to 720p; preview reflects selected derivative/clip and audio |
| Abandoned upload cleanup | Within 24h after staging lease expires |
| Replaced/revoked/expired object cleanup | Within 7 days after terminal state |

Do not upload unpreviewed original video/audio or substitute a still silently when video conversion fails. Owner explicitly accepts a labeled fallback or removes that item. Derivative quality/size feasibility must be measured on Android/iOS. No metadata-only model consent authorizes image/video processing by a provider.

Cleanup retries safely and never deletes active-version objects. Quota releases only after storage removal acknowledgement; terminal access denial does not wait for deletion. Retain only minimal owner/operation tombstones needed for reconciliation/removal, with a documented finite retention schedule before enablement. Operational metadata/backups have a separately disclosed provider retention policy; do not promise erasure of infrastructure backups on this timeline.

Delete-all first persists a server owner delete fence and remote-removal intent for every owned share, blocks new publication and activation, and preserves credentials/queue outside the evidence purge until acknowledged. A crash cannot erase that intent. In-flight create/replacement reconciliation must observe the fence and become removal work, never activate. Offline queue execution may retry idempotent revokes; an unacknowledged removal remains pending. Do not silently sign out/delete the remote owner first. Any auth-user deletion must occur only after revocation and required cleanup are acknowledged.

## M4.6 handoff and primary references

M4.6 consumes v1 snapshot/media errors, token exchange, no-cache/no-index policy and expiry/revoke semantics. It owns responsive selectable destination map, chronological timeline, selected-memory browser, list fallback, browser copy/native share, generic or explicitly chosen safe social preview and optional Create Yours. It must open without install/login. Viewer schema incompatibility yields a safe unavailable screen; it never falls back to private/local data. Do not expose copy/share before a compatible HTTPS viewer is deployed and smoke-tested.

Current platform documentation checked 2026-10-26: [private storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog). These support private storage and owner access controls; atomic activation, checked proxy reads and token hygiene are application requirements, not supplied guarantees. Recheck relevant changelog/API behavior at implementation, including the announced TLS cipher deprecation for supported devices.
