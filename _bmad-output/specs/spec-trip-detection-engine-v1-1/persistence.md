# Persistence, ownership and publication

## Existing seams and changes

Reuse `import-record/repository.ts` migrations and shared SQLite transaction gate;
schema is currently28. Allocate consecutive next unused versions at implementation
time. Reuse `reconstruction/controller.ts` lifecycle/generation invalidation and
current correction revision/application tables. Do not rewrite owner history or
replace the legacy detector before a shadow comparison exists.

Keep `reconstructV1` callable as the reference baseline. Add pure functions/modules
for normalization, support units, temporal context, episodes, qualification and
destination/membership projection. The production repository supplies immutable
inputs and persists results; no pure rule calls SQLite/native/UI/provider code.

## Storage contract

Names are target responsibilities; existing equivalent tables may be extended.
Every generation-owned table uses (generation_id, local_id) primary keys and
foreign keys, avoiding the current single-projection delete/replace behavior.

| Table/extension | Required contents |
| --- | --- |
| canonical_evidence extension | normalization version, media kind, native/original instant provenance, local day/time/offset, time conflict, origin/support flags, camera-scoped signature, accuracy, source revision; nullable backfill |
| trip_context_revision | context ID/version, evidence revision, configured-base revision, derived base/routine intervals and support, completeness scope; immutable |
| trip_generation | ID, detector/config versions, evidence/correction/context/source-scope revisions, input digest, state BUILDING/READY/ACTIVE/RETIRED/FAILED, created/completed times |
| trip_episode | generation, episode ID, observed first/last time precision, open/ambiguous boundary flags, classification, score, signal values, gates/reason codes, matched profile, base-context IDs, manual flag |
| trip_destination | generation, destination ID, episode ID, observed medoid snapshot, uncertainty, ordered/unknown sequence, country resolution/version, corroborating support snapshot, plot_eligible |
| trip_membership | generation, episode ID, source evidence ID, support-unit identity/snapshot, inferred/owner/suggested membership, reason, contributes_photo/support booleans |
| trip_lineage | predecessor generation/episode, successor generation/episode, relation unchanged/extend/split/merge/ambiguous, overlap counts, matching revision |
| trip_publication | record_id=1, active_generation, previous_generation, publication_epoch, activated revisions; compare-and-swap pointer |
| trip_migration_manifest | manifest ID, from/to generation, input revisions/digests, all affected private IDs, before/after decisions/destinations/counts/reasons, correction conflicts, approved-state, activated-state |
| trip_review_question | stable question key/type/context or support digest, outcome/dismissal, asked timestamp, evidence digest, resolved correction revision |

Store base/routine intervals as normalized child rows if preferred; JSON snapshots
must have a version and validator. Fields remain private local metadata. Foreign
keys/unique constraints enforce one active pointer, unique memberships and valid
generation references. Existing correction command-key idempotency remains intact.

Do not fabricate old normalized fields during migration: mark legacy_metadata
and refresh under current permission in bounded pages. New schema does not itself
change the primary map. Migration tests update every prior schema-version assertion.

## Build and commit protocol

1. Under shared transaction gate, snapshot evidence revision, correction revisions,
   configured context, source scope/lifecycle and input digest; persist BUILDING.
2. Compute the pure generation outside a long database transaction. Check budget
   every100 units or2 seconds and persist progress. Retain the running controller
   guard until the promise settles even after lifecycle invalidation.
3. Reacquire gate; compare evidence/correction/context/lifecycle/scope revisions.
   A change makes the draft stale: discard publication, retain pending queue work,
   recompute. No partial live output. Disconnect/revoke aborts new publication;
   delete clears private generations through the authorized existing lifecycle.
4. In a short atomic commit, insert validated generation/destination/membership/
   lineage/application rows and mark READY. Input digest plus detector/config
   revisions is unique, so identical final inputs reuse the completed result.
5. For new records after implementation acceptance, atomically activate READY with
   pointer CAS. For legacy records require approved manifest with exactly matching
   revisions. A changed input invalidates approval and requires a new dry run.
6. Acknowledge maintenance queue entries only through the captured source revisions.
   Later changes remain queued. UI reads one active generation plus pinned owner
   projections, never a mixture of partly committed graphs.

## Identity and correction precedence

Existing exact canonical-support/family-tuple correction matching is authoritative.
Owner title/date edits are separate from observed span; manual/confirmed trips
are not downgraded by detector policy. Split/merge boundaries, evidence exclusion,
memory membership and removal retain their existing semantics. Add missing manual
trip entry only as a private owner-created record with explicit title/date and
optional owner-specified destination/media; absence of GPS means Timeline-only.

For unreviewed automatic identity, define overlap on canonical support units.
An old/new pair inherits identity only if old-contained-in-new fraction>=0.8 AND
new-contained-in-old fraction>=0.8, it is a mutual unique best match, same base era,
observed time ranges overlap and no owner boundary/negative constraint conflicts.
Fractions exclude attached GPS-less memories. Empty support cannot match. Ties,
one-to-many and many-to-one allocate new identities with lineage, not guessed
identity inheritance. Unchanged canonical support has exact identity.

Identity matching cannot transfer a reviewed correction. Exact full-support match
of its existing scope is required; additive identity inheritance without exact
scope produces pending_scope_review as currently required. Missing/split/duplicated
scope produces pending_remap, retains the last effective owner projection, and
quarantines overlapping new candidates from duplicate publication. Unrelated
components can publish. Pinned projections retain their own immutable destination/
membership snapshots and are emitted once; revoke still disables media resolution.

Reject constraints are canonical negative grouping relations, not generated IDs.
Preserve their original support groups across place/session repartition. A full
rejected one-group support set cannot auto-seed a candidate; forbidden co-membership
between original groups applies even if new evidence changes visit IDs. Added
photos or new detector versions do not clear those constraints. If canonical
family remapping is ambiguous, quarantine the overlapping candidate rather than
recreate a rejected trip. Rejecting one old grouping need not erase valid owner
split alternatives. Persist every manual/confirmed trip and owner override.

## Shared publication predicate

Create one repository view/query boundary `qualified_trip_projection` selecting
active-generation AUTO_CONFIRMED or USER_CONFIRMED records plus deduplicated pinned
owner-confirmed records. Exclude REJECTED/NOT_TRIP/SUGGESTED/UNCONFIRMED and unresolved
overlapping automatic successors. Map additionally requires destination.plot_eligible
and actual coordinates. Timeline includes owner-confirmed unknown-coordinate trips.

Atlas rows, year filters, trip counts, destination/country statistics and Replay
eligibility use this boundary. Statistics count unique eligible destinations, not
raw support places. Replay consumes only supported destinations with usable order;
unknown order cannot become an invented sequence. Sharing uses immutable owner-
selected snapshots and never auto-publishes these updates. Existing Replay
availability/readiness guards continue to apply; this work does not build export.

Detail/media queries bind opaque display IDs to publication epoch and episode ID.
Use existing coarse anchors, paged12-media reads, local previews, lifecycle guards
and map context. Selection of removed/ambiguous successors clears safely; a unique
valid lineage successor can restore selection. Detection counts cannot authorize
unbounded media reads. No raw source IDs or exact coordinates in screen/list state.

## Legacy dry run and rollback

Run old/new against one frozen normalized snapshot; keep the legacy live projection.
Manifest lists all private affected IDs, classifications, scores/gates, map removals/
additions, split/merge relations and protected correction conflicts. UI/exported
logs expose redacted counts/reasons only. No original/media/history deletion.
Invalid automatic trips are archived in old generations and omitted by the new
active pointer. Manual/confirmed records are never removed by automatic cleanup.

Rollback selects the retained prior derived generation, reapplies the latest owner
correction ledger, validates memberships/permission and publishes a NEW rollback
generation by CAS. Never rewind evidence or owner revisions, blindly reset a
pointer after later edits, or restore private data after deletion. If current owner
decisions cannot map safely, retain their last effective projection and surface one
optional conflict. Keep both generations until explicit recoverable cleanup.

Crash before pointer commit leaves the prior record; crash after commit leaves the
new complete record. Migration resume and repeated activation are idempotent.
