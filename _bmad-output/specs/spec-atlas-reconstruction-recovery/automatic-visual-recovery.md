# Automatic discovery of trips without GPS

CAP-4 replaces the date form, per-trip photo picker and Analyze action in
the experimental recovery panel. A trip proposal is the first interaction
in the recovery flow. Discovery may begin after the owner enables on-device
visual processing once for the Local library. The separate gallery permission
controls which media Atlas can access. Enablement is revocable in Settings.
This slice processes photos on the device and uses no external provider.
The [offline landmark index](offline-landmark-index.md) specifies public
source ingestion, automatic regional routing and progressive sampling.

## Discover and recognize

1. **Find episodes from metadata.** After authorized Local import or rebuild,
   evaluate the committed history in pages. Find temporally coherent,
   unassigned capture-like groups and rank them using capture cadence,
   changes from routine and any independent travel clues. Maintain episode
   boundaries across input pages. Nearby geotagged travel can raise priority.
   A group without that signal still gets considered. Exclude protected,
   previously attached or clearly non-capture evidence. Missing GPS and
   volume alone cannot produce a proposal. An unknown availability flag
   permits a local accessibility check inside the bounded media stage.
2. **Choose a representative sample.** Prefer distinct, readable images
   across sessions and days. Deduplicate before analysis. If some references
   fail to open, try other eligible representatives within the same budget.
   Record the sampling and policy versions so replaying a fixed snapshot
   yields the same candidates. Use a bounded queue that makes progress on
   older groups as well as new imports. Resume from verified checkpoints.
3. **Find evidence for multiple stops.** Use a versioned, on-device
   recognizer with a reference source spanning multiple destinations and
   independent views. Combine signage and image evidence within the
   budget. Continue after an accepted match to examine other promising
   sessions. Keep validated hypotheses per evidence family and session,
   including place identity, geographic precision, evidence kind and
   uncertainty. Validate catalog membership and ambiguity before using a
   hypothesis. An image of a landmark on a screen, poster or shared image
   cannot on its own establish where the photo was captured. Keep raw
   imagery, OCR text and model outputs out of logs and diagnostics.
4. **Qualify continuity independently.** Use the accepted place hypotheses
   to seed candidate stops. Evaluate neighboring capture sessions using
   original capture chronology, corroborating observations, plausible
   transitions and effective-dated Home. Check competing trips, conflicts,
   owner decisions and scope. Positive continuity can connect different
   cities or a day excursion to the same trip. A match in one session plus
   a decodable photo in another supplies insufficient continuity. Preserve
   independently qualified trips where the connection is unresolved.
   Derive the observed period from supported observations. When available
   evidence qualifies only a clue, keep the candidate private for further
   eligible evidence or abstain.
   Qualify a city-level proposal when independent sessions corroborate the
   same city and there is positive evidence connecting them to one trip.
   A second named stop is optional. Treat the supported city separately
   from the set of verified stop names and from photo membership.
5. **Determine album membership.** Evaluate eligible items in the qualified
   sessions. Admit a photo with positive evidence of association, such as
   its own supported place or corroborated capture context in a coherent
   session. A similar time or a readable image alone supplies no association.
   Exclude known screenshots, unrelated captures, duplicate copies and
   conflicting or uncertain items. An absent origin flag is unknown.
   Media with unknown origin needs corroboration before inclusion.
   Use visual evidence of scene or capture context where useful and retain
   photos without a named place when their membership is supported. Each
   item's location stays unchanged. Choose covers from the qualified album
   after membership is set.

| Decision | Stored or projected result |
| --- | --- |
| Place match | Evidence reference, validated place and supported precision for the applicable stop. |
| Trip continuity | Ordered supported stop or session references, observed period and applicable trip destination. |
| Album membership | Deterministically ordered, deduplicated evidence references with their membership basis, paged for review. |
| Card covers | A compact subset of the proposed album with diversity across dates or stops when available. |

## Present and confirm

Use the existing Living Atlas Possible trips surface and a quiet Atlas hint.
Show a city-level card as soon as the city and trip qualify through independent
evidence. Continue bounded recognition for unresolved stops.
The card shows a destination at the supported level, the observed period
and recognizable covers. Detail shows supported stop names and opens
the complete paged proposed album. The primary
action is **Confirm trip**. The owner can also dismiss or leave the card for
later. The card cannot affect trip counts, map or Replay before verified
confirmation. A dismissed card stays quiet for unchanged evidence.

Version proposals by source, evidence, effective Home, owner corrections,
privacy revision and recognition policy. Recheck current authorization and
scope before reading media, accepting recognition results, exposing a
proposal and confirming. Version the membership and cover selection with
the proposal. Revalidate the exact reviewed trip, stops and album in the
transaction, then read back their membership and media references before
refreshing Atlas. Retry against the same receipt. Keep the same reviewed
album available from Timeline. On scope withdrawal withhold revoked
evidence immediately and require a current proposal for a changed group.
Supersede an obsolete unconfirmed proposal only after fresh qualification.
An already confirmed trip can receive an explicit reviewable correction
to the same trip. Preserve its existing authority until the correction is
verified. Dismissal stays effective for unchanged evidence.

## Build order and gates

| Slice | Entry point | Exit evidence |
| --- | --- | --- |
| Candidate discovery and scheduler | Extend `visual-place/local-eligibility.ts` and the Local reconstruction repository. Start from existing import/rebuild completion in `photo-access/provider.tsx`. | Synthetic full-history input, no nearby GPS prerequisite, stable results across pages, and safe cancellation and resume. |
| Multi-stop recognition | Extend `visual-place/recovery.ts` to return validated hypotheses across sessions. Compare recognizers and reference coverage with independent views. | Recover supported distinct stops, reject lookalikes and abstain on unknown places. Measure latency and resource use. |
| Continuity and album association | Evaluate stop/session joins and membership separately before staging in the Local provider and repository. | Test multi-stop and distinct outings, with unrelated photos interleaved and qualified photos beyond the cover sample. |
| Review and verified save | Reuse Atlas Possible trips and the repository's owned transaction, scope and receipt patterns. | AC-11 through AC-15 and AC-25 through AC-28. Run physical Android and iOS checks under AC-24. |

The prototype starts in the foreground and resumes across authorized app
sessions. Background execution can reuse the app's scheduled maintenance
after platform validation. Per-photo, per-candidate and per-batch limits
must be configurable and measured before rollout. On exhaustion, checkpoint
remaining work and keep Atlas usable. Keep the rollout gate off while any
required recognition, quality, permission or resource gate is unresolved.

For the blind Android regression, freeze and authorize the Local input.
Run the normal bounded discovery path with no date, place hint or selected
photo IDs. Compare title, supported stops, observed period and album with
the owner review. Check the exact proposed references, stored membership
and rendered thumbnails. Record the outcome separately from synthetic
controls and independent trips withheld from tuning. Include visual-only
landmarks, unknown places, long Home periods, dense events, shared media
and adjacent distinct outings. Freeze numerical thresholds and processing
budgets before holdout scoring. Report landmark precision and recall,
trip precision and recall, album precision and recall, supported stop/day
coverage, abstention, owner actions, latency and peak memory separately.
Store real labels privately. Keep policy and source versions and redacted
aggregate evidence in the delivery record.
