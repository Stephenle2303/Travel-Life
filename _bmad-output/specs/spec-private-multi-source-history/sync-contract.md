# Account and synchronization contract v1

## Account identity

Use Supabase email OTP with a dedicated `travel-life-account-v1` storage key.
Request and verify are separate operations; request success never means signed in.
Accept configured 6-10 ASCII digits, trim email, reject control characters and bound
lengths. Use generic request acknowledgement, fixed error copy and server rate limits.
Native stores chunks through SecureStore, bounded UTF-8 bytes with a generation
manifest committed last; never serialize session data to AsyncStorage/logs. Use
SDK processLock and one AppState refresh listener. Browser fallback is memory-only.

Session restore is local UI state; authorization requires verified Auth claims and
live session/account fences. Signout immediately hides account data and invalidates
in-flight UI work; a persistent local access-block marker precedes remote logout so
offline/failed logout cannot re-expose credentials after restart. Explicit retry may
finish server revocation; do not claim immediate remote JWT revocation from the SDK.
Anonymous AI/share clients keep their own keys and never attach this email account.

## Identity and canonical records

All opaque wire IDs are UUIDs generated independently of private content; local
source keys travel only in consented DTOs, never diagnostics. The server assigns a
stable account evidence UUID and retains a unique `(owner, source, localKey)` mapping.
Never hash owner media as a global cross-account lookup key.

Wire envelope: `contractVersion: 'travel-life-history-v1'`, `mutationId`,
`accountGeneration`, `sourceId`, `sourceGeneration`, `expectedRevision`, `records`.
Exact action-specific keys and bounded nested schemas reject unknown fields.
No client owner ID is accepted. Media artifacts use a separate binary upload route.

Semantic record kinds (all versioned, owner scoped):

| Kind | Retained fields and authority |
| --- | --- |
| evidence | source mapping, normalized time/day/offset precision, nullable GPS/accuracy, availability, origin, media type, verified duplicate identity, exclusion flags; DTO maps to current engine types |
| correction | original revision/target/lineage IDs, action, expected target revision, target evidence sets, owner values, active/superseded state; preserve full existing journey correction payload semantics |
| manual-journey | stable owner identity, explicitly entered place/time and review status, attached evidence mapping; no generated GPS |
| privacy | Hide/Exclude policy ID/scope/version and restoration lineage; higher privacy restriction is never dropped on ambiguous mapping |
| home-area | owner-reviewed date-scoped place/radius/name with lineage; syncing requires history consent and does not imply presence |
| replay | committed groups, membership/order, direction, soundtrack identity/revision, exact working-versus-committed branch separation; URI is never a cross-device identity |
| media | private artifact identity/digest/type/dimensions/duration/bytes, verified stage, associated evidence/manifest and consent generation |

Before M6.3 coding, derive exact DTO field schemas against the actual v37 tables
and exported domain types, with migration tests for every row kind. Transporting
unvalidated arbitrary table JSON or SQL is forbidden. Schema derivation stays in
one module consumed by export/server/replica, with fixtures proving equivalence.

## API and persistence boundaries

Initial M6 attachment lifecycle: staged source snapshot -> verified complete snapshot
-> initial active restore authority if no active history exists. Distinct later
source snapshots become pending contributions; they cannot replace active history.
M7 canonical builds promote the combined result under AD-4 CAS. Receipts acknowledge
mutations, sourceSnapshotRevision identifies immutable attachment data, and
aggregateRevision identifies activated history; none is substituted for another.

The native durable outbox is keyed by owner/account/source generations and persists
the mutation ID/digest/payload before network transmission. Foreground and background
use one short owned-transaction claim/lease and independent source cursors; network
and rendering occur outside SQLite writer ownership. On resume reconcile unknown
receipts before resending. A denied background slot leaves foreground catch-up pending.

Story ownership: M6.1 owns credential isolation; M6.2 consent and source status;
M6.3 DTO/export/initial-snapshot/live-session server checks; M6.4 separate replica
restore; M6.5 account/session deletion fences; M7.1 durable queue/coordinator;
M7.2 verified duplicate families; M7.3 portable canonical-core extraction/activation;
M7.4 conflict resolution; M7.5 byte-verified private media; M7.6 scoped account media
resolver and exact composition; M7.7 source controls/two-device acceptance.

Native v37 migration includes `journey_memory_correction_revision` independently of
journey correction, plus legacy overlays and full immutable privacy revisions. Typed
remappers traverse every E:/F: support key, family snapshot member, structural
boundary, reviewed-visit set and committed `[journeyId,evidenceId]` pair; display
tokens/run counters and local URIs are not portable identities. Never perform
unstructured string replacement. Account media resolution bypasses native photo
permission only for account-owned authorized derivatives; device assets retain their
original permission checks.

Account API is JWT-protected, HTTPS/no-store, with actions: `status`,
`consent`, `register-source`, `push`, `receipt`, `pull`, `restore`,
`source-control`, `resolve-conflict`, `media-stage`, `media-activate`,
`media-download`, `revoke-session`, `delete-account`, `deletion-status`.
Create tables/actions only when their owning story implements them.

- `status`: verifies live subject/session and returns account generation/revision,
  consent version and active source statuses; no other owner's identifiers.
- `consent`: versioned history/media opt-ins; existing record is unchanged on failure.
- `register-source`: current installation or provider connection; per-source generation.
- `push`: transaction validates session/account/source/consent fences, expected revision,
  exact payload schema and quota. Upserts semantic journal records and immutable
  receipt; response carries accepted revision/watermarks. Conflict returns a fixed
  typed response and preserves both correction proposals where applicable.
- `receipt`: reconciles a mutation by its ID and canonical digest. A client timeout
  checks receipt before retrying; never release reservations from a guessed rollback.
- `pull`/`restore`: pagination is bound to immutable aggregate revision and typed cursor;
  stage a complete account replica then atomically switch its active pointer. Keep
  original local DB and previous account replica usable during failure.
- `source-control`: pause/disconnect retains imported data per disclosed choice;
  remove-import advances source fence before cleanup and rejects obsolete uploads.
- `delete-account`: fresh verified auth, advance irreversible account generation/fence,
  deny work/read, revoke provider credentials, purge active objects/records via retryable
  job. Preserve a minimal non-content deletion fence so old jobs cannot recreate it.
- `revoke-session`: revokes refresh access and application session fence atomically
  with revocation receipt; live backend check rejects still-unexpired JWTs.

Use an unexposed/private SQL schema and narrow RPCs or JWT handler with service-role
calls after verified authorization. No direct client write policies to private tables.
SQL functions revoke PUBLIC execute, qualify names and enforce fixed search_path.
Object access is private and mediated; service-role access is never bundled in mobile.

## Engine, correction and dedup activation

Extract canonical engine/correction functions from native repository without changing
behavior. One job reads a consistent evidence/correction snapshot, applies verified
duplicate-family normalization, structural boundaries, existing grouping/qualification,
owner merges/corrections and final remap policy. Record exact engine versions, input
watermarks and output digest. CAS activation rejects a changed input snapshot.

Concurrent corrections use expected target revision. Same idempotency key+same
content replays acknowledgement; same key+different content conflicts. A conflict
retains both proposals and the last accepted target; owner resolution is a new
versioned mutation. No wall-clock precedence or inference overwrites user facts.
Only proven identical copies merge support; uncertain matches remain candidates.

## Media and resource limits

Engineering beta defaults: 100 semantic records and 512 KiB JSON/request; one
image derivative at most 20 MiB, one video at most 100 MiB, 2 GiB active account media.
Worker attempts are capped at five with bounded exponential backoff; foreground
requests time out after 30 seconds but reconcile their receipt. These are configurable
server limits and must match UI; measure before broadening. App screens never wait
on the entire library for a page or foreground correction.

Media consent binds selected evidence/group and a generation. Native validates
copy/format and metadata removal before uploading. Server validates actual bytes
and decoder results, not client MIME or a claimed hash; then verifies scope again on
activation. Use private staged objects and signed downloads lasting at most five
minutes; each issuance checks live session and active membership. URLs are not
durable references. Unverified artifacts never become playable authority.

Reuse the existing private copy/renderer/decoder work where appropriate without
unlocking its deferred publication APIs. Custom audio has the same consent, format,
quota and availability boundaries as media. Render exact committed selections,
including truthful card-only groups. Local cache fetches only needed media, supports
eviction and marks offline availability; source originals are never removed.

## M8/M9 connector seams

Provider credentials bind source+account and remain server-only. Drive selected-file
grants do not authorize folder descendants. Photos selected-session URLs expire;
fetch supported bytes during authorized sessions, retain only under verified current
provider terms. Missing GPS stays null. Both adapters emit the same validated semantic
records and private media artifacts, then use the same engine/corrections/deletion
contract. No connector can bypass consent by masquerading as an account snapshot.
