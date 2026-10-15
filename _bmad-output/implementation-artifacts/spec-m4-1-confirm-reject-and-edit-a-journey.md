---
title: 'Confirm, reject and edit a journey'
type: 'feature'
created: '2026-10-13'
status: 'ready-for-device-validation'
route: 'dispatch'
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md#story-m41-confirm-reject-and-edit-a-journey'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-3-open-journeys-and-source-linked-memories.md'
---

## Intent

**Problem:** Journey detail shows inferred visits and memories, but its correction action cannot save a review. An owner cannot distinguish facts they accepted from later inference, repair a boundary or association, or rely on that repair after a rescan.

**Approach:** Let the owner review a private journey's specific facts and memberships, then confirm, reject, or edit them. Store scoped owner decisions and identity lineage locally; apply them to one complete reconstruction projection and retain ambiguous remaps for explicit review. Match the agreed photo-led Journey detail and correction composition while replacing its session-only demo behavior.

## Boundaries and decisions

- A journey-level **Confirm shown facts** action records the exact displayed snapshot of title, observed destinations/visits, date claim and accepted primary memory memberships. It never confirms unseen photos, later evidence, new destinations or extended dates. Show reviewed and inferred additions separately after a rebuild.
- Rejecting a journey rejects that candidate grouping and its reviewed associations, not the source photos or independently supported visits. Persist the reviewed support set and the required negative constraint: pairwise cannot-co-member relations for a multi-visit grouping, or forbidden automatic journey membership for a single reviewed visit. The same evidence cannot recreate the rejected claim under a new generated ID. A changed grouping that cannot be mapped exactly stays pending, rather than being accepted or rejected by guess. Rejecting a suggested memory association is narrower than excluding the photo from reconstruction.
- Rename and owner-entered date bounds are owner claims with explicit precision (exact day or approximate interval). Preserve observed first/last evidence dates separately. Never present owner bounds or a destination sequence as observed departure/return times or an actual route.
- Destination removal removes the visit from the owner's journey projection; retain source evidence and any underlying place/visit support. Photo assignment/removal edits journey membership only. A trip-only photo cannot create visit support, destination, country count or an owner-presence claim.
- Split records an explicit owner boundary at a strictly ordered, reviewed visit edge; merge records an explicit owner relationship between two strictly ordered, adjacent owner-visible journeys. A valid owner-initiated save publishes the successor journeys immediately in one transaction. Previously saved journey-wide title, date bounds and confirmation become **pending scope review** on the successors; they are not copied as accepted claims. Reviewed visit and memory facts that still map exactly keep their status. A possible merge or optional AI grouping remains a suggestion until the owner accepts it. The owner may also explicitly merge adjacent journeys beyond `reconstruction-v1`'s ten-day possible-merge window. Support basic split/merge without requiring review of every photo.
- At most one accepted **primary** journey membership exists per evidence/duplicate family. Competing candidates stay unresolved and visible. Reversing an edit creates a new correction revision; it does not erase the earlier owner decision.
- Owner corrections outrank inference and optional AI. Rebuilds must apply stable evidence-, association- and boundary-scoped decisions before publishing a complete graph. A later automatic rebuild with an ambiguous successor mapping keeps the last complete owner-visible projection and queues a **pending remap**; never silently drop or guess an edit. This hold does not apply to a valid owner-initiated split/merge whose successors were previewed and saved atomically.
- Keep all edits local and private. M4.1 does not publish, upload, share, delete originals, add a new manual journey (M4.2), or introduce the hide/exclude/delete controls owned by M4.3. No model provider receives personal evidence.

## Owner flow

1. Open Journey detail from Atlas. Show current inferred/reviewed state, observed span, provenance and uncertainty. The correction entry keeps the selected journey context.
2. Review one bounded section at a time: journey status/title/dates, destinations and split/merge candidates, then current and suggested memories. Each control says whether it changes a journey claim, visit membership or memory membership; source evidence remains available.
   Provide an **Uncertain memories** action from Journey detail that opens a bounded, searchable/pageable list of suggested and unassigned accessible photos. The owner can select a photo, see its available date/location/provenance and competing journey suggestions, and assign it to this journey, move it from another journey, reject its suggestion, or leave it unassigned. No bulk acceptance or review of every photo is required; inaccessible media retain a metadata-only review state.
3. Preview the resulting journey and any affected neighbor before saving a split, merge, rejection or conflicting photo reassignment. A split/merge preview identifies predecessor titles, date bounds and confirmations that will need scope review. For ordinary rename or date edits, show the new value and provenance in place. Explicitly distinguish observed facts from owner-entered claims.
4. Save atomically, return to the corrected detail/Atlas state, and show the new successors at once for an owner-initiated split/merge. Label their inherited journey-wide claims pending until reviewed; the structure and counts reflect the save. A denied, disconnected, deleted, stale or failed write leaves the prior complete view intact with a recovery action.
5. Provide separate review states: **pending scope review** asks how a saved predecessor title/date/confirmation applies to already-visible successors; **pending remap** asks which successor, if any, receives a correction after an ambiguous automatic rebuild. Show bounded candidates and allow the owner to assign, revise or leave a claim pending. Never auto-accept a candidate merely because one exists. The durable state and projection rules are defined below; these are not interchangeable UI labels.

## Data and reconciliation plan

### Identity and exact remapping

- Save canonical evidence IDs (or a resolved duplicate-family support-unit key), the reviewed visit's supporting evidence-ID set, the ordered boundary's two flanking visit support sets, and the journey's reviewed support set at the correction revision. These are local private keys; generated `place:*`, `visit:*`, `journey:*`, display ordinals and route IDs are hints only. Preserve the old/new lineage and rule version for audit.
- Normalize a visit's support set to stable **support-unit keys**: use a durable duplicate-family key only when copies have been verified as one nonconflicting unit; otherwise use the canonical evidence ID for an independent unit. The current reconstruction adapter passes `duplicateFamilyId: null`, so M4.1 must not infer a family from matching names, times or generated IDs. If a later rescan reveals conflicting metadata or a new copy changes a reviewed unit's identity, its support-based mapping is unresolved until owner review. A reviewed association to one specific photo may still map by that photo's unchanged canonical ID, but it cannot resolve the family's visit support or grant two accepted primary memberships.
- An evidence-level decision maps exactly when the same canonical evidence/support-unit key exists. A memory association maps exactly only when that key exists and its target journey has one exact successor. A visit-scoped decision maps exactly when **all** of its reviewed support IDs belong to one successor visit and no reviewed support ID belongs to a competing successor; added evidence in that visit remains inferred. A boundary maps exactly only when its left and right reviewed support sets each map to one distinct, strictly ordered successor visit with no reviewed support split across candidates. Never infer a boundary from asset-ID sort order.
- Treat each reviewed support set as a set of normalized unit keys, with every key present in exactly one eligible successor support set. If even one reviewed key is missing, appears in two successors, or the old set is divided between successors, the scoped correction is **pending remap**; no percentage, majority or representative-ID match is sufficient. A successor may contain additional unreviewed units only if they do not create a competing predecessor match, invalidate a corrected boundary's strict order or turn a reviewed support unit into a conflicting duplicate family. Additional units remain inferred. A same-day/weak-order visit can retain an evidence or visit-scoped decision through exact set containment, but an ordered boundary or merge also needs the strict temporal comparison to remain true; otherwise its structural correction is pending remap.
- A journey-wide title, owner date bound or confirmation maps exactly through an **automatic** rebuild when **all** reviewed supporting visit sets map to one successor journey, no reviewed set maps to another journey, and that successor contains no reviewed support from a different predecessor journey. Newly imported, unreviewed evidence may extend the successor, but remains inferred and does not expand the correction's reviewed scope. An owner-initiated split/merge is different: the validated command creates known successors and publishes them immediately, while affected predecessor-wide claims become pending scope review in the same transaction. The successors use neutral/inferred journey labels and bounds until the owner explicitly assigns or replaces those claims; no successor inherits blanket confirmation. Exact reviewed visit/memory facts remain reviewed.
- A multi-visit rejection maps its reviewed visit sets and cannot-co-member relations **before** journey grouping. It succeeds when every reviewed visit set maps exactly and the prohibited pairings still identify those visits, even though the corrected graph contains no single successor journey spanning them. Each visit may still support a separate candidate where other rules allow it. A one-visit rejection maps by that reviewed visit's exact support set and forbids **automatic membership of that visit in any owner-visible journey**, including one formed later with new evidence. New evidence can form a separate candidate, but cannot pull the rejected visit into it. If new evidence extends the same visit, keep its journey claim pending until the owner reverses or explicitly resolves the rejection. Source-supported visit/place evidence remains available, and no photo is deleted or globally excluded.
- A save-time split/merge validates its full successor projection and pending-scope records, then commits both atomically; failure leaves the predecessor view intact. If a **later automatic** rebuild has a missing, duplicated or divided key, overlapping corrected predecessors, a new duplicate conflict, or incompatible precision/order, record a pending remap with the old scope and bounded candidates. Keep the previous complete owner-visible projection and queued invalidation until the owner resolves it. Same-evidence, same-rule rebuilds must remap exactly; background and full rebuilds with the same final evidence/corrections must reach the same result.

**Normative remap algorithm.** Every visit-, boundary-, grouping- or journey-scoped correction stores nonempty reviewed visit sets `R1 ... Rn` as sorted, distinct typed keys: `E:<canonical-evidence-id>` for an independent support unit or `F:<durable-family-id>` for a verified, nonconflicting duplicate family. An evidence-only decision or trip-memory association also stores its specific canonical photo ID; it does **not** require that photo to have visit support. An association stores reviewed visit sets for its target journey separately from the photo key. For an `F` key, store the reviewed member evidence IDs and support-relevant metadata version. An `E` support key cannot silently become an `F` key, and two saved support keys cannot silently collapse into one current unit. A family is verified only when its durable family ID and all available copies agree on capture-day/instant precision, eligible location/accuracy and origin fields that affect visit support; absent family identity or disagreement is not verification. A new consistent copy may join an existing `F` key, but changes to a reviewed member's identity or support-relevant fields fail support-unit mapping. These private keys and snapshots stay local.

For this mapping, "agree" means exact equality of the import-normalized support tuple: captured civil day, captured instant, offset-precision flag, latitude, longitude, reported accuracy, and source-origin/support eligibility, with `null` compared as a value. Do not use proximity, a rounded map anchor, filename, media similarity or majority agreement to verify a family. A mere media-availability change does not alter the tuple, but an unavailable unit cannot supply a new visit; if a reviewed visit loses that support, Step 2 or 3 fails. Store the tuple's canonical version/fingerprint with the reviewed unit and compare it on rescan.

1. Build the candidate support/visit graph from the final evidence snapshot, applying effective evidence exclusions but **before** journey grouping that could violate owner boundaries or rejections. Build separate lookups for canonical photo IDs and eligible support units; each eligible support unit has its canonical IDs, verified family key if any, and exactly one candidate visit support set. Never derive identity from a generated place, visit or journey ID.
2. For every active correction, resolve **every** saved key. Within a reviewed visit set, `E:id` resolves only to the same canonical ID while it remains an independent eligible support unit with compatible support metadata. `F:id` resolves only to the same verified family with every reviewed member still in that family and compatible; newly added consistent members are allowed. A saved photo key for an evidence-only decision or trip memory resolves by the same canonical photo ID even if it has no GPS, capture day or current media access; availability limits new owner actions, not survival of an existing association. A missing/ineligible support key, missing photo key, unknown or conflicting family, changed support-key type, or two saved support keys resolving to one unit fails this step. Do not substitute a sibling copy or compare by similarity.
3. For each reviewed visit set `Ri`, let `Mi` be its complete resolved current-unit set. Find visits `V` whose support sets contain **all** of `Mi`. Exactly one such `V` must exist, each unit of `Mi` must occur in no other visit, and different reviewed visit sets in this correction must map to different successor visits. A 60/40 division, one missing unit, duplicate placement, or two `Ri` sets collapsing into one visit fails. Extra units in the unique `V` are unreviewed, never part of `Mi` or automatically confirmed. Evidence-only decisions without `Ri` skip this visit-containment step.
4. Apply the correction's scope check: an association needs its specific photo and one valid target journey; a journey-wide claim needs all mapped visits in one successor journey with no competing corrected predecessor; a boundary needs its two mapped visits distinct and strictly ordered; a merge needs the saved adjacency/order; a rejection needs every saved cannot-co-member pair or single-visit prohibition to remain identifiable **without requiring a journey target**. Then check all active corrections together for conflicting primary membership or structural decisions.
5. If **any** correction fails a step, append a `pending_remap` **candidate evaluation** with the failed step and withhold the entire candidate graph and queue acknowledgement. Keep the last completed owner-visible projection and its committed correction applications effective. If all pass, apply every correction to its exact scope and atomically publish the candidate graph, committed applications, lineage, counts and checkpoint. No subset of a correction, majority overlap, or independently exact correction authorizes partial publication.

Process corrections by immutable decision revision and keys within each `Ri` in lexical order. For a stable diagnostic when several failures exist in one step, report `family_conflict` before `nonunique_or_split` before `missing_or_ineligible`; the publication outcome is `pending_remap` for all three. The stored failure is diagnostic only and never changes the no-partial-publication rule.

**Remap precedence for each active correction.** Evaluate these gates in order against one candidate rebuild. The first failed gate yields `pending_remap`; later gates cannot rescue it. A 60/40 overlap fails exactly as a 99/1 overlap does. Do not publish any part of a candidate run if any active correction cannot be applied safely.

| Gate | Required result | Failure result |
| --- | --- | --- |
| 1. Identity | Every reviewed canonical ID or verified support-unit key resolves to exactly one current unit; no reviewed key has a newly conflicting or unverified duplicate family | Pending; never substitute a sibling copy or a generated ID |
| 2. Complete set | For each reviewed visit set `R`, one successor visit `V` contains every key in `R`; no key is missing, duplicated or distributed to another visit | Pending even if most keys match; do not apply a subset |
| 3. Unique target | Each association or journey-wide claim that requires a journey maps to one target, and no different corrected predecessor claims the same reviewed support; rejections map their visit sets and constraints without a journey target | Pending; do not choose by largest overlap, date proximity or asset order |
| 4. Structural relation | Both boundary sides map to distinct visits in the same strict order; a saved merge remains adjacent and does not cross an owner boundary; rejected visit incompatibilities still identify both sides | Pending; weak/same-day/overlapping order cannot be promoted to exact |
| 5. Correction compatibility | The candidate applies all active owner decisions without conflicting accepted primary membership, split/merge constraint or rejection | Pending; owner decisions outrank deterministic and AI proposals |

New evidence outside `R` is allowed only after all gates pass and remains inferred; if it changes order, duplicate identity, or a competing predecessor match, the relevant gate fails. An unchanged canonical photo ID can still preserve its own media-only decision when a family support unit fails Gate 1, but the candidate graph is withheld if that failed unit affects any active correction. No automatic operation may change a failed gate to success by relaxing the reviewed scope.

| Reviewed-set outcome in one candidate rebuild | Decisive gate | Result |
| --- | --- | --- |
| Some keys exact, one missing, duplicated, or mixed into an unverified/conflicting family | 1. Identity | `pending_remap`; no partial acceptance |
| Three support keys: one exact, one changed from independent evidence to a family, one with conflicting family metadata | 1. Identity | `pending_remap` with `family_conflict` diagnostic; exact key is not applied separately and the candidate graph is withheld |
| Every key valid, but the old visit's keys land in two successor visits, including a 60/40 split | 2. Complete set | `pending_remap`; neither successor inherits the correction |
| All keys land in one visit, but two corrected predecessors claim its journey | 3. Unique target | `pending_remap`; no winner selected |
| All keys land uniquely, but a saved boundary loses strict temporal order | 4. Structural relation | `pending_remap`; no inferred order substituted |
| All gates pass and one successor adds unrelated new support | Pass | Reapply only reviewed scope; added support stays inferred |

For a failed gate, persist the failed gate and candidate identities in the private candidate evaluation, with no private IDs in telemetry. Other corrections may be individually exact, but the whole candidate graph remains unpublished until every active correction is safe; the last complete owner-visible projection remains authoritative.

| Case | Candidate evaluation | Committed owner-visible result |
| --- | --- | --- |
| Every typed key, complete reviewed visit set and scope relation maps uniquely | Exact | Publish one new complete projection; reviewed facts remain reviewed, additions remain inferred |
| Any reviewed key is missing, ambiguous or split across successors, even when other keys map exactly | `pending_remap` for the affected correction | Retain the previous complete projection and its effective applications; publish none of the candidate |
| A reviewed independent unit becomes a family, or a family identity/source support tuple is absent or conflicting | `pending_remap` at identity gate | Retain the previous complete projection; do not substitute another copy |
| Multi-visit rejection remaps exactly | Exact cannot-co-member constraints for every reviewed visit pair | Those visits may appear separately but cannot share a journey until explicit owner reversal |
| Single-visit rejection remaps exactly | Exact forbidden automatic membership for that reviewed visit | That visit cannot join any automatic journey, including one with later evidence, until explicit owner reversal |

### Correction state transitions

Persist three distinct records: an immutable **owner decision revision** (action, scope, reviewed support snapshot and replacement link), a **committed application** tied to a completed projection/run (typed state and mapped scope), and a versioned **candidate evaluation** tied to a proposed rebuild (exact or `pending_remap`, cause, source revisions and sequence). An active decision can therefore have an `effective` application in the last committed run and a `pending_remap` evaluation for a newer candidate at the same time. Readers select the last completed projection and its applications; they must never select the latest candidate evaluation as if it were a committed application. The latest candidate evaluation sequence belongs in the editor save token so a resolution cannot ignore newly detected ambiguity. Automatic remapping may append an evaluation but never rewrites the owner's decision or creates a new owner action. An owner replacement/reversal creates a new decision revision and supersedes the previous one. Only the latest active decision per logical target/scope can affect a newly committed projection. Store these as typed fields, not free-text labels.

| State and record | Entry | Owner-visible effect | Exit |
| --- | --- | --- | --- |
| `effective` committed application | Valid owner save or exact automatic remap commits a complete projection | Applies only to its recorded scope; newly added facts stay inferred | A later complete commit replaces this application, or owner reversal/replacement supersedes its decision |
| `pending_scope_review` committed application | Valid owner split/merge makes a predecessor-wide title, bounds or confirmation inapplicable to known successors | Successor structure and counts publish now; affected claims are stored but not shown as accepted | Owner assigns/revises a claim for a named successor or discards it in a later commit |
| `pending_remap` candidate evaluation | A later automatic rebuild cannot identify a unique safe target for an active correction | No candidate graph publishes; the prior committed application and complete projection remain effective, and the queue checkpoint remains unacknowledged | A later candidate maps exactly and commits, or an explicit owner resolution/reversal commits a new complete projection |
| `superseded` owner decision revision | Owner reverses, replaces or discards an earlier decision | No longer applied in a newly committed projection; retained as private provenance | Terminal for that revision |

A pending candidate evaluation may be durable while its graph is withheld. Rechecking it after new evidence is allowed, but only a new complete commit replaces the last effective application. A pending-scope review created by the owner's own structural save never freezes the successor projection. Reversal of a negative constraint or association removes only that correction's effect, then reconstructs from the same evidence/rule version before publishing.

### Negative-constraint identity

- Persist a rejection as a typed owner correction with its reviewed support-unit sets, canonical evidence IDs, correction revision, rule version and source run. The generated journey ID is a display hint. For a multi-visit rejection, persist a **cannot-co-member** relation for every pair of its reviewed visit support sets; this blocks the same grouping through an indirect path or newly inserted visit. For a single-visit rejection, persist its reviewed visit support set with `forbid-automatic-journey-membership`. The constraint is anchored to evidence/support units and visit relationships, never solely a candidate or journey ID; it does not exclude photos or places.
- **Invariant:** Until an explicit owner reversal or replacement commits, no completed owner-visible projection may include a rejected single visit as automatic journey membership, or place two visits from a rejected multi-visit grouping in one journey, even if a rescan, background update, duplicate-family consolidation, deterministic rule or AI proposal changes generated IDs. Apply exact support-set remapping and these constraints before automatic grouping on every rebuild. Added evidence may extend a mapped visit without lifting the prohibition. If a visit divides, support-unit identity conflicts, or either side cannot be remapped exactly, record `pending_remap` and keep the last complete owner-visible projection; never publish a graph that bypasses the constraint. Independent visits and source-supported places remain available.

### Ordering and merge sources

- A visit edge is eligible for split only when the latest supported instant of the left visit is strictly before the earliest supported instant of the right visit, with usable offsets for both, **or** the left visit's latest recorded civil day is strictly before the right visit's earliest recorded civil day. Day-only evidence establishes day order, never within-day order. Missing dates, same-day-only visits, overlapping intervals and incompatible precision do not create an eligible edge; offer date/order correction or narrower visit/memory edits instead. An owner-entered exact date/order can make a boundary eligible only after it is reviewed and saved as a separate owner claim; it never rewrites source timestamps.
- Two journeys are adjacent for a merge when they are consecutive in the owner-visible chronology, have the same strict order rule, have no intervening journey and no owner-confirmed return/boundary. `reconstruction-v1` `possibleMerges` are eligible suggestions when they also pass this validation. Optional AI groupings are review prompts only and use the same validator; AI output cannot authorize a merge. The owner may initiate a longer-gap adjacent merge explicitly, with both journeys and their observed gap shown in the preview. Unknown, same-day, overlapping or nonadjacent journeys cannot be merged in M4.1 until the owner resolves order/overlap; no transitive merge is inferred.

### Atlas totals

- Derive Journey detail, Timeline and Atlas totals from one committed **effective owner-visible projection** after correction application. Journey count includes active inferred/confirmed journeys, reflects a saved owner split as two and merge as one immediately, and excludes a rejected grouping. Pending-scope labels do not delay those structural counts. Do not count a rejected candidate under another generated ID. Label a stale last-complete result as pending only when a later automatic remap is unresolved.
- Place and supported-country counts remain evidence-support counts, independent of journey membership. Rename, owner date edits, memory assignment/removal and destination removal from a journey do not remove an underlying supported place or country from those totals. Split/merge/reject alone do not remove source-supported places/countries. Only an explicit evidence exclusion under M4.3 or a changed eligible support set can change them. All screens must use these same definitions and committed revision; adapt M3.4's raw reconstruction count read when M4.1 implements the owner-visible projection.

### Storage and publication

- Extend the current local schema with typed correction scopes and payload validation for journey status/title/date bounds, visit removal, primary association decisions and explicit boundaries/merges. Store stable evidence and association keys plus source run/revision and lineage; do not rely on a display ordinal or transient route ID as a durable correction target.
- Preserve immutable correction revisions and a current effective decision per target/scope. Define exact reversal semantics and an idempotency key for a retried save. Migrate existing inclusion/label/note overlays without changing their meaning, and include new records in local delete-all cleanup.
- Serialize correction writes with the shared SQLite rebuild connection and reconciliation lease. Recheck lifecycle, selected run/revision, permission and target validity in the write transaction. Stale editors reload before saving; no partial split/merge or duplicate accepted primary membership is committed.
- Apply stable evidence and association decisions before reconstruction where they constrain grouping; apply reviewed journey fields to the resulting projection after a lineage check. Publish the graph, correction projection, remap state, and queue acknowledgement atomically. Retain the previous completed projection when a rebuild fails or a mapping is unresolved.
- Replace the current blanket pause on `target_kind = 'history'` overlays only once each supported scope has a safe mapper. Existing unsupported or ambiguous overlays remain pending, never silently bypassed. Reuse the M2.6 queue/lease and lifecycle suspension rules for foreground and headless maintenance.
- Keep provenance and observed versus owner-entered status in the Journey detail read model. The redacted Atlas route and telemetry carry no evidence IDs, source references, precise coordinates or raw media URIs. Native adapters resolve source references only inside the connected-record boundary.

### Save and race contract

1. The editor loads a private snapshot token containing the committed run ID, canonical evidence revision, latest active owner-decision revision, latest resolution sequence, lifecycle generation and selected stable target keys. Preview is read-only and tied to that token; it never reserves a future write.
2. On Save, abandon the command if the editor was invalidated before the transaction starts. Acquire the same SQLite write serialization used by rebuilds, then begin one immediate transaction. Re-read the connected lifecycle and generation, permission, latest completed run, evidence revision, active owner-decision revision, resolution sequence, target keys and effective negative constraints. Any token mismatch returns `stale_preview` without writing; the UI reloads and asks the owner to review the changed preview. A disconnected/deleted record returns `unavailable`.
3. Recompute the full affected successor projection **inside that transaction** from the current committed input and proposed correction. Validate order, exact target identity, one accepted primary membership per support unit, no conflicting owner boundary, and all new pending-scope rows. Write the correction revision, effective projection/lineage, counts and reconciliation checkpoint together. Recheck lifecycle/generation and the operation's cancellation token before Commit. If any step fails, Rollback leaves the previous completed projection and queue untouched.
4. A foreground/background rebuild and an owner save cannot commit over one another. If the rebuild commits first, the editor token is stale and the save is rejected. If the save commits first, the rebuild must read the new correction revision and rebase; it cannot publish a graph computed from an older revision. A worker that already held the shared guard finishes or aborts before the edit begins. After Commit, closing the editor cannot undo a completed owner save; navigation suppresses stale UI callbacks and reloads the committed result.

An idempotency key scoped to the editor command and owner-decision revision makes a retry return the same committed outcome rather than append a second decision. Disconnect/delete uses the same SQLite boundary: a committed edit is included in the later local cleanup; an edit whose lifecycle check loses the race never commits. A source-permission change that cannot be checked authoritatively at Commit fails closed and leaves the preview unsaved.

**Editor state machine.** A preview has one token and one idempotency key. Only `preview_valid` may enter `saving`; no UI path invokes the repository directly from `editing`, `stale`, `closed` or `unavailable`.

Normal path: `editing -> preview_valid -> saving -> committed`. A rebuild that wins before the save's transaction validation sends `saving -> stale -> editing` only after reload and a new preview. A failed transaction returns to `preview_valid` only when its token is still current. Navigation after Commit suppresses UI callbacks but does not undo `committed`.

| Current state and event | Next state | Durable result |
| --- | --- | --- |
| `editing` + preview succeeds against committed snapshot | `preview_valid` | None; show exact affected facts and revision |
| `preview_valid` + newer run/correction, lifecycle change or changed target before Save | `stale` or `unavailable` | None; discard preview and require reload |
| `preview_valid` + Save | `saving` | Acquire shared guard, then validate token inside transaction |
| `saving` + rebuild committed first or token mismatch | `stale` | Rollback; reload and preview again, never auto-retry the old command |
| `saving` + disconnected/deleted or permission unavailable | `unavailable` | Rollback; no correction or queue acknowledgement |
| `saving` + write/validation failure before Commit | `preview_valid` if token still matches, otherwise `stale` | Rollback; show error and allow a retry with the same idempotency key only while token remains valid |
| `saving` + Commit succeeds | `committed` | Decision, resolution, projection, counts and queue checkpoint are durable together; reload from committed run |
| `saving` + response lost after possible Commit | `saving` until idempotency lookup resolves to `committed` or a verified rollback | Never issue a second decision; identical retry returns the first outcome |
| `editing`/`preview_valid` + editor closes | `closed` | No write |
| `saving` + editor closes | `closed` after cancellation or completion | Cancel before Commit when possible; if Commit already won, keep the durable edit but suppress stale UI publication |

`stale` may return to `editing` only by loading a new snapshot and preview; `unavailable` requires a connected permitted record. A background rebuild queued behind `saving` must consume the committed correction revision after Save. A save queued behind a completed rebuild fails its old preview token and must not silently rebase the owner's choice.

### Uncertain-memory review state

Keep media availability, association, and visit support as separate axes. The review list queries bounded local metadata; it does not download cloud media or promote GPS to owner presence.

| Input state | Review action and result |
| --- | --- |
| Accessible, unassigned photo with stable canonical ID | Owner may explicitly assign it as primary trip memory, even with no GPS or capture date; location/visit support stays absent unless independently eligible. |
| One inferred suggestion | Accept as primary, reject this target only, or leave suggested. Reject does not globally exclude the photo or accept another journey. |
| Two or more competing suggestions | Show alternatives; no default winner. Owner selects one primary target or leaves all unresolved. Save clears conflicting accepted-primary memberships in the same transaction only after preview. |
| Duplicate-family copies with consistent metadata | Review one support unit and show available copies; at most one accepted primary journey for the family. A copy is not independent visit support. |
| Duplicate-family copies with conflicting metadata | Show the conflict. Owner may attach one identifiable accessible copy as trip-only media; family visit support remains unresolved and no family-level automatic acceptance occurs. If the copy/family identity changes on rescan, association remap becomes pending. |
| Inaccessible/cloud-only/removed photo with retained metadata | Show a metadata-only unavailable state and existing association/provenance. Owner may reject a stable suggestion or leave it; a new accepted assignment or reassignment requires the photo to become accessible for identification. Do not fetch/download it in the correction flow. |
| GPS-less or date-less photo | Never infer visit support; a date-less photo is not automatically suggested. If accessible and found through bounded owner search, explicit assignment is a trip-memory choice only. |

**Association transition rules.** For each normalized support unit, store owner primary `P = null | journey` separately from inferred suggestion targets `S` and owner-rejected targets `R`. At most one `P` exists. `S` can contain multiple journeys and never changes `P`; `R` blocks inference for that target until explicit owner reversal. The repository enforces these transitions; a UI label alone does not.

| From -> to | Allowed only when |
| --- | --- |
| `S -> S + J` with `P = null` | Deterministic rules identify J and `J` is not in `R`; suggestion alone never sets `P` |
| `P = null -> P = K`, whether `K` is in `S` or elsewhere | Owner explicitly selects K in a preview; photo is accessible with stable identity; if `K` is in `R`, reversal of that rejection is part of the same save |
| `P = J -> P = K` | Owner explicitly previews transfer; removal from J and assignment to K commit together with family-wide uniqueness, and any rejection of K is reversed in that save |
| `accepted_primary(J) -> unassigned` | Owner explicitly removes J in one save; rejecting a separate suggestion does not remove J |
| `J in S -> J in R` | Owner rejects target J; other suggestions stay unresolved and none becomes accepted automatically |
| `J in R -> J not in R` | Owner explicitly reverses/replaces that target rejection; this does not itself accept J |
| Any owner association + availability change | Association is retained with unavailable/available media state; no new acceptance, removal or transfer occurs automatically |

When the owner accepts K while A remains only a suggestion, `P` becomes K and A is suppressed from active suggestions without being recorded as owner-rejected. If `P` is already A, accepting K requires the explicit `P=A -> P=K` transfer; a `suggested(K)` state is never an implicit removal of A. Forbidden: any inference that sets/moves/clears `P`, transfer without same-transaction removal of the old `P`, acceptance of inaccessible media, family-wide acceptance from conflicting copy metadata, and inferred reversal of a target in `R`. An unresolved duplicate identity or ambiguous journey remap creates `pending_remap` for the affected correction and never silently selects a target. The UI labels these states with words as well as Living Atlas color.

## Acceptance scenarios

| Scenario | Expected result |
| --- | --- |
| Confirm an inferred journey with two reviewed visits; late evidence adds a third | Only the reviewed visits and facts are confirmed; the new visit and memberships remain inferred. |
| Reject a grouping, then rescan the same evidence or run background catch-up | Rejected grouping does not reappear; source evidence and independently supported visits remain available. |
| Rename and enter approximate bounds | Owner title/bounds survive restart; observed span and precision remain separately labeled. |
| Remove a destination or assign a GPS-less/unsupported photo to a journey | Journey view/membership changes; source evidence remains, and the photo adds no visit or place support. |
| Reassign one photo from A to B, including a duplicate family | Only B has accepted primary membership; counts are not inflated by copies. |
| Split/merge a titled, dated or confirmed journey | The save atomically publishes successor journeys and updated Atlas/Timeline counts; predecessor-wide title, bounds and confirmation are pending scope review and are not displayed as accepted on a successor. Reviewed visit/memory facts remain reviewed. |
| Reject a one-visit journey, then import evidence that would join that visit to a new journey | The reviewed visit stays out of automatic owner-visible journey membership; independent new evidence may form a separate candidate, and same-visit additions remain pending until explicit owner resolution. |
| Rescan or incremental rebuild changes a corrected journey's identity | Exact mapping reapplies scoped edits; ambiguous mapping leaves the correction pending with the last consistent projection visible. |
| Reviewed support set partly lands in two successors or a duplicate family becomes conflicting | The affected correction enters `pending_remap`; no majority match, copy-ID substitution or partial projection is published. |
| Added evidence extends one uniquely mapped visit without changing strict order | Reviewed facts stay reviewed, additions stay inferred, and scoped corrections remain effective. If an owner boundary's order becomes weak/overlapping, only an exact owner resolution can release its pending remap. |
| Rebuild after a negative constraint | Reviewed cannot-co-member relations or one-visit membership prohibition apply before grouping, even if generated IDs changed; an uncertain support-unit map holds the previous complete view. |
| Owner split/merge creates successor journeys | The correction revision, successors, pending-scope rows and counts commit together; `pending_scope_review` does not freeze the new projection. |
| Background rebuild encounters an ambiguous correction | A distinct `pending_remap` record and queued work persist; the previous completed projection remains visible until exact remap or owner resolution. |
| Same-day, overlapping or Date unknown visits; split or merge requested | No invented order or saved structural edit; show the uncertainty and offer an owner date/order claim or narrower correction. |
| Suggested or unassigned uncertain photo | Owner can find and assign/reject one photo without opening every photo; membership changes without visit/place support. |
| Remove a destination, then inspect Atlas totals | Journey detail changes; journey total stays the same, while supported place/country totals remain unchanged. A split/merge/reject updates journey totals consistently across Atlas and Timeline. |
| Deterministic or optional-AI merge proposal, or owner-initiated longer-gap merge | All pass the same strict adjacency/order/boundary validator and require owner preview and confirmation; the proposal source is retained as provenance. |
| Save while detail is stale, access is revoked, or disconnect/delete begins | No partial or late write; show a reload/reconnect path without exposing private identifiers. |
| Background rebuild races with an owner save | Whichever obtains the shared write guard first commits against its captured revision; the loser rebases or rejects as stale, never overwriting the correction or acknowledging unprocessed queue work. |
| Inaccessible, competing, duplicate-conflict or GPS-less memory | UI uses the review-state matrix; no unavailable photo is newly accepted, no suggestion wins automatically, and trip-only assignment creates no visit support. |

## Implementation slices

1. **Durable correction contract:** migration, typed command validation, effective revision reads, reversal and delete-all coverage. Establish evidence/association/boundary keys and lineage rules before UI writes.
2. **Projection and reconciliation:** apply corrections through the engine/repository, add exact and ambiguous remap handling, and make foreground/headless rebuilds converge on the same completed result.
3. **Owner review UI:** extend Journey detail with focused correction controls, preview and state labels using Living Atlas tokens and accessible native controls. Preserve Atlas selection/context on return.
4. **Verification:** synthetic repository/engine and UI regressions, migration/lifecycle tests and both-platform device checks. Record actual results in this delivery record and `docs/project-state.md` during implementation.

## Verification plan

- Test the acceptance table with synthetic evidence, including exact same-evidence remap, added evidence in one unique successor, split reviewed support, merged reviewed predecessors, repeated rescan, reversed input order, late split/merge evidence, duplicate families, GPS-less and unsupported photos, stale editor revisions and queued background updates.
- Cover precise ordered visits, distinct civil days, same-day weak visits, overlapping and missing dates, Date unknown journeys, nonadjacent candidates, owner longer-gap merges and AI proposals failing the same validator.
- Check Atlas/Timeline/detail journey totals after confirm, reject, destination removal, split and merge; check that place/country totals stay evidence-based after journey-only edits and change only when their eligible support changes.
- With a titled, dated, confirmed predecessor, verify an owner split/merge commits successors, pending-scope claims and updated counts together; a failed save commits none. Verify a later ambiguous automatic rebuild instead preserves the last complete view with a pending-remap state.
- After one-visit rejection, verify same-evidence rescan, same-visit new evidence and a later candidate that would absorb the rejected visit cannot restore its automatic journey membership; independent new evidence may form a separate candidate. Verify explicit owner reversal/resolution releases only the intended constraint.
- Exercise each correction-state transition and confirm `pending_scope_review` publishes successors while `pending_remap` holds the previous complete projection. Test partial overlap, duplicate-family conflict, added evidence, weak-order boundary invalidation and exact same-evidence remap with no majority fallback.
- Force stale preview, UI invalidation before Save, permission loss, disconnect/delete during a deferred write, transaction failure after the correction row but before projection publish, retry with the same idempotency key, and rebuild/save commit order. Assert no partial rows, stale callbacks, lost queue work or late publication.
- Exercise every uncertain-memory row with separate availability, membership and visit-support assertions, including a newly inaccessible photo, competing suggestions, stable copy selection and a later duplicate-family conflict.
- Keep owner corrections and manual photo associations out of automated reconstruction recovery metrics; synthetic correction cases verify invariants, not product accuracy.
- Drive every editor-state transition, including rebuild-wins and save-wins race orders, lost response/idempotency lookup, close before and after Commit, and stale preview reload. Assert only `preview_valid` can start a save.
- For remap Gate 1-5, use one failing fixture per gate plus a 60/40 partial overlap, one mixed verified/conflicting support-unit set, and a rejected three-visit grouping reconnected through a newly inserted visit. Assert the first failed gate yields `pending_remap` and no candidate run publishes.
- Verify the normative key resolver with independent evidence becoming a family, a new consistent family copy, conflicting family metadata, a reviewed member disappearing, two old keys collapsing to one unit, and a GPS-less existing media association that survives loss of preview access without gaining visit support.
- Assert every allowed memory transition and reject each forbidden transition, including an inferred suggestion for K while J is already accepted; transfer must remove J and accept K in one transaction.
- Check transaction rollback, one accepted primary membership, correction revision/reversal, delete-all cleanup, no late writes after lifecycle invalidation, and last-complete-projection behavior on failed or ambiguous remaps.
- Test screen-reader labels/order, scalable text, correction status without color alone, unavailable media, selected-photo permission and contextual return to Atlas on iOS and Android. Physical-device results must be reported separately from Jest fixtures.
- Run focused tests, `npm --prefix apps/mobile run check`, root `npm run check`, and `git diff --check` when implementation exists. Report Expo Doctor dependency drift separately if it remains. No test result or reconstruction-quality metric is claimed by this planning artifact.

## Planning risks and dependencies

- The current `correction_overlays` schema has only inclusion/label/note scopes, and M2.6 pauses history-target corrections; both need a compatible migration and mapper. Existing M3.4 worktree changes are outside this story.
- Current inferred place/visit/journey IDs are generated from evidence/visit contents by `reconstruction-v1`; the exact-remap rules above, not ID equality, govern lineage. Implementation must prove those rules with rescan and incremental fixtures before enabling history-target overlay reconciliation.
- The current schema has no durable lifecycle generation or typed correction-resolution states, and the reconstruction adapter currently supplies no duplicate-family identity. The migration must add those fields/contracts before relying on the save token or family-scoped remap; unknown family identity remains unresolved rather than guessed.
- The durable source of duplicate-family identity and source-origin/support eligibility is not selected. Family-key remapping and family-based acceptance cannot be claimed implemented until that source, its local migration and mixed-copy cases are specified and verified; the BMAD [M4.1 kernel](../specs/spec-m4-1-journey-corrections/SPEC.md) records this as an open question.
- The prototype demonstrates only session-level confirm/rename. Its composition is authoritative, while split/merge, date precision, photo review and pending-remap states need a restrained extension consistent with the official design system.
- M4.2 manual additions and M4.3 visibility controls depend on this correction foundation. Sharing remains off and no M4.1 action publishes a snapshot.

## Delivery evidence

Initial implementation evidence on 2026-10-13: the mobile flow now previews
confirm/reject decisions, stores a local revision against the loaded completed-run
token and the exact owner-visible fact snapshot, and attempts an immediate local
rebuild. A stale token is refused; a successful rejection is removed from the
rebuilt projection. Failed or ambiguous rebuilds keep the prior complete
projection; ambiguous remaps are recorded as separate candidate evaluations
without demoting the last committed application. Focused UI, provider, controller,
migration, and exact-remap tests pass. Full mobile Jest passed 27 suites / 198
tests, typecheck and lint passed, and root `npm run check` passed. Mobile Expo
Doctor remains 20/21 because six installed Expo SDK 57 patch versions are behind
the expected versions; this work did not alter dependencies. This is not complete
M4.1:
owner title/date/destination/memory edits, split/merge, uncertain-memory review,
family identity, durable owner resolution of pending remaps, full idempotency,
atomic decision-plus-projection commit, device checks, and the broader acceptance
matrix remain outstanding.

### Review Findings (2026-10-13)

- [x] [Review][Patch][High] Confirm and reject are presentation only. The flow now
  previews the exact visible scope, persists a local revision, and shows a completed
  state only after a successful rebuild. If rebuilding is pending, the prior view is
  explicitly retained. `apps/mobile/src/components/journey-correction.tsx`.
- [ ] [Review][Patch][High] Correction persistence and reconstruction integration
  were absent. Basic confirm/reject revisions now map by canonical evidence support
  and trigger a rebuild; split/merge and per-visit negative constraints, complete
  exact lineage, atomic decision-plus-projection commit, and durable owner remap
  resolution are still required. Legacy `correction_overlays` history reconciliation
  remains separately paused. `apps/mobile/src/reconstruction/repository.ts`.
- [ ] [Review][Patch][Medium] Journey edits are absent. Add owner title/date bounds,
  destination and memory membership edits, and reviewed split/merge controls with
  provenance and affected-neighbor preview.
  `apps/mobile/src/components/journey-correction.tsx:34`.
- [ ] [Review][Patch][Medium] Uncertain-memory review is absent; implement bounded
  suggested/unassigned photo review with assign, move, reject, and unresolved states.
- [ ] [Review][Patch][High] Safeguards are partial: the decision preview is bound to
  the loaded run and save checks lifecycle/current-run state in a transaction, with
  rollback and a pending outcome. Full idempotency, one atomic decision-plus-
  projection transaction, lifecycle-generation guards, and comprehensive race
  recovery still need implementation.
- [x] [Review][Patch][Medium] Decision state is keyed to the journey route id, so
  an old screen's saved outcome is not rendered beside a newly selected journey.
- [x] [Review][Patch][Low] Correction-to-detail navigation replaces the existing
  route rather than stacking another detail route.
- [x] [Review][Patch][Medium] Mobile lint now passes for the correction flow.
- [x] [Review][Patch][Medium] Focused correction UI/provider/rebuild tests now cover
  preview-before-save, failed saves, pending projection retry, lifecycle invalidation,
  and split/ambiguous support remaps. Navigation automation and the full story
  acceptance matrix remain to be added.

### Review Findings (2026-10-13, follow-up)

- [ ] [Review][High] The owner decision and updated projection commit in separate
  transactions. `saveJourneyCorrection` commits the revision/application before the
  provider starts a rebuild, so a crash, lifecycle change, or rebuild failure can
  leave a durable decision without its required owner-visible projection, counts, and
  checkpoint. Validate and publish the correction and successor projection through
  one serialized SQLite transaction.
  `apps/mobile/src/reconstruction/repository.ts:209-246`,
  `apps/mobile/src/photo-access/provider.tsx:177-185`.
- [ ] [Review][High] The canonical remap flattens every reviewed evidence key into
  one journey match. It neither stores nor validates each reviewed visit support set,
  so a split visit within one successor journey can be accepted instead of entering
  `pending_remap`; additional evidence is also not labelled or scoped as inferred.
  Persist typed per-visit support sets and apply the normative exact-containment
  checks before publishing.
  `apps/mobile/src/reconstruction/repository.ts:27-58`.
- [ ] [Review][High] Rejection removes an inferred journey after grouping and stores
  no cannot-co-member pairs or one-visit membership prohibition. New evidence can
  make a rejected visit part of a larger candidate, after which the implementation
  either hides that entire candidate or loses the required negative constraint.
  Store the scoped constraint and enforce it before automatic grouping, retaining
  independently supported evidence.
  `apps/mobile/src/reconstruction/repository.ts:15,55-58,350-359`.
- [ ] [Review][High] Retrying an uncertain save is not idempotent. Each attempt
  generates a random revision ID, so a lost response after commit can create a new
  revision that supersedes the original. Add a durable command key and committed
  outcome lookup.
  `apps/mobile/src/reconstruction/repository.ts:241`,
  `apps/mobile/src/components/journey-correction.tsx:38`.
- [ ] [Review][High] Owner edit and uncertainty flows remain unavailable: title/date
  claims, destination membership, photo assign/move/reject, split/merge previews,
  duplicate-family handling, and bounded pending-remap resolution are absent. The
  screen exposes only confirm/reject and already-associated memories.
  `apps/mobile/src/components/journey-correction.tsx:63-102`.
- [ ] [Review][High] A successful rebuild triggers an asynchronous durable-reveal
  refresh. The rejection route can return to Atlas before that refresh settles, while
  `projectReveal` prefers its non-null cached record; Atlas can therefore briefly
  show the removed journey and stale statistics. Await or synchronously coordinate
  the committed durable-reveal refresh before the success route is offered.
  `apps/mobile/src/photo-access/provider.tsx:93-100,177-185`,
  `apps/mobile/src/reveal/projection.ts:16-28`.
- [ ] [Review][Medium] Existing tests use mocks/text checks instead of exercising a
  migrated SQLite database and an actual failed remap/rebuild. They do not prove
  rollback, previous-projection preservation, queued-work retention, family
  conflicts, stale-write ordering, or migration survival across restart.
  `apps/mobile/src/components/__tests__/import-repository.test.ts`,
  `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts`.
- [ ] [Review][Medium] The correction-screen suite passes while emitting repeated
  React `act` errors, so its asynchronous UI assertions are not trustworthy enough
  to close the behavior gaps. Configure the test environment and await every async
  transition before treating the suite as evidence.
  `apps/mobile/src/components/__tests__/journey-correction.test.tsx`.
