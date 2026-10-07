# Decision 0005: Interactive journey links are required

> Superseded in scope by [decision 0009](0009-mlp-lifetime-reveal-and-replay.md):
> replay video and selected lifetime-highlight sharing are now MLP P0. The privacy,
> snapshot, revoke and browser-viewer mechanics below remain in force.

Date: 2026-10-07 (Asia/Bangkok).
Status: interactive journey-link sharing accepted from the user's explicit direction.
Replay scope is superseded by decision 0009.

## Decision and user experience

The first MVP must let a user share an **interactive individual journey by URL**.
Recipients open the link in a browser without installing Travel Life or signing in.
The page offers a journey map, selectable destinations/timeline, selected memories
and an optional Create Yours call to action. This supersedes the earlier decision
to defer hosted web sharing. A static card is an optional additional format.

A public share page here means a hosted viewer reachable by anyone with the link.
Default to an unlisted, unguessable URL, not a searchable public profile or social feed.
A recipient can forward the link; it is not recipient-authenticated private sharing.

Owner flow: choose journey → choose visible places/dates/memories → preview and confirm
selected facts → publish → copy/native-share link → optionally republish or revoke.
No automatic publishing or updating follows background maintenance.

## Snapshot and media boundary

Publish an immutable/versioned snapshot, not a live view into the private library.
By default show coarse destination positions and month/year or relative day labels;
the owner chooses any greater date/location detail in preview. Hide/exclude decisions
apply. Inferred fields retain their status until owner confirmation.

Uploaded content is limited to selected sanitized snapshot fields and explicitly
chosen optimized media derivatives. Originals stay at their source; this small
remote sharing copy is not whole-library photo backup. Strip EXIF/source identifiers
and exclude local file references, hidden places and private history. Photo permission
and cloud-AI consent do not themselves authorize publishing media.

Keep snapshot rows and uploaded derivatives access-controlled. A viewer endpoint
validates a cryptographically random unlisted token (at least 128 bits) and active/
unexpired status before returning content/media. No unrestricted storage bucket
may expose supposedly revocable assets. Reject unsafe text/URLs and enforce owner
authorization on create/update/delete and upload quotas.

Owner controls persist using the existing protected anonymous session on the
publishing installation, without an email signup wall. Do not promise cross-device
recovery if those credentials are lost. Working default link expiry is thirty days,
shown before publishing and owner-adjustable; expired/revoked remote content is
cleaned up under the documented retention policy.

Revoke blocks future server access to snapshot and media. Avoid persistent viewer
caches and request no indexing; neither can erase recipients' saved copies, screenshots
or previously cached social previews. Delete-all must also request remote revocation;
if offline, show remote removal pending and keep the revocation queue/credentials
until acknowledged. Do not claim a local deletion erased remote shares.

## Working implementation choices

- Small read-only React/TypeScript web viewer, Vite build, default static hosting on
  Vercel. This is a viewer, not a second desktop product.
- Google Maps JavaScript API for selectable markers, with restricted browser key,
  attribution and quota configuration. Timeline/memory browsing still works if maps fail.
- Existing Supabase backend extended with owner-protected snapshot records, private
  derivative storage and token-checked read/media endpoints.
- Backend, browser hosting, map quota and storage controls configured inside delivery;
  no account, upload or service deployment occurred in this decision.
- Minimal share-published/link-open/Create Yours events use sanitized internal IDs
  and do not expose URL access tokens or private journey contents in logs.

[Google Maps JavaScript](https://developers.google.com/maps/documentation/javascript/overview)
provides browser map interaction.
[Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
are implementation building blocks; access/revocation behavior still needs testing.

## Stories and release checks

M4.5: publish, manage, republish and revoke journey snapshots (P0).
M4.6: interactive browser viewer and browser-link sharing (P0).
M4.7: replay/video export (now P0 under decision 0009).
M4.4 static card remains P1. Interactive links and replay are required MLP scope.

Verify mobile and desktop browsers, uninstalled-app recipients, map/timeline/memory
interaction, invalid/revoked/expired tokens, media access, cross-owner denial,
snapshot stability during background updates, sanitization and deletion/revocation.
No private journey data may leak through preview metadata or analytics.

## Superseded video scope

The earlier bounded trip-level extension is retained only as decision history.
Decision 0009 defines the current 30–60 second lifetime replay and both-platform
export requirement. Its constraints still apply: no invented routes, mandatory AI
narration or music; publication is explicit; exported copies cannot be revoked.
