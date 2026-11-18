# Shared reconstruction and media rules

## Evidence and Home classification

Bind the build to immutable evidence, privacy, owner-correction and Home
snapshots. Resolve duplicate families and classify using the canonical evidence
under current access. Carry three distinct results through the projection.

| Result | Definition | Automatic behavior |
| --- | --- | --- |
| `home-match` | Valid supported civil day and admissible coordinates. At least one active saved circle contains the point and its stated accuracy margin, when present. | Exclude from automatic trip visit support, qualification, counts, destination votes, cover, album membership and new automatic Replay eligibility. Retain the evidence as private Home context. |
| `outside-home` | Admissible location and valid civil day give a determinate non-match for every applicable Home. This includes dates outside all saved scopes. | Use normal evidence and privacy rules. Being outside a configured radius alone does not satisfy the existing far-away predicates. |
| `home-unknown` | Invalid, missing or conflicting date/location, ineligible duplicate, or an uncertainty interval that crosses an applicable circle. | Do not infer Home, an away fact or a return from this item. Existing evidence qualification governs admissible non-Home visit support. A time-only match stays in private review. |

An applicable Home uses its stored circle and inclusive effective bounds. Take
the union of matched areas across independent homes. Use stable family identity
to avoid duplicate support. Apply the existing place-support validation before
using GPS. With otherwise eligible coordinates and unknown reported accuracy,
use the point for circle inclusion and retain the existing uncertainty. With
known accuracy, use upper and lower distance bounds to separate definite
membership, definite outside and uncertain border cases. A missing or invalid
civil date never inherits the phone's current date or the Home setting's date.

Compute this once before creating the automatic candidate graph, including V1
paths that seed visits or time-only memberships. Keep the full privacy-filtered
evidence available for exact owner-decision remapping and use the protected
reviewed projection only where existing rules authorize it. Do not use Home
filtering as an evidence deletion or override an explicit privacy exclusion.
An item that is definitely Home cannot re-enter an automatic trip through
fallback visits, duplicate copies, suggestions, or joins. Reuse the effective
Home context in continuity and final qualification. Within an applicable
explicit Home scope, a learned frequent location cannot replace it or be
required in addition to it. Where no Home applies, preserve the existing
provisional-base rules and distinguish missing context from a confirmed return.

## Episode assembly

Keep V1 baseline behavior for comparison and existing reviewed support mapping.
Apply the repair in the active shared canonical projection. Order usable
observations by trustworthy civil day and use exact instants only where the
source authorizes comparison. Compatible same-day away observations can share
an unordered block. Stable sorting provides determinism without creating an
order claim. Use the last accepted **observation block** at the edge of an open
episode for time and away-context checks. The episode start and accumulated
support remain available for display and qualification.

Apply these rules in order.

| Boundary | Result |
| --- | --- |
| Explicit owner split, rejection or protected reviewed grouping | Apply existing correction constraints before automatic assembly. A protected group requires an exact remap or the existing review path. |
| Proven time conflict, incompatible spatial/time evidence or ambiguous overlap | Preserve ambiguity or separate candidates under existing conflict rules. Do not fabricate elapsed time, route or order. |
| Corroborated Home return between two away edges | Close the prior episode. Require independent eligible Home support in the same applicable area and same intervening local run. Require two comparable observations at least 60 minutes apart or observations on two consecutive civil days. |
| Single Home observation, evidence only elsewhere in history, or mixed Home/away day without reliable order | May leave continuity uncertain. Cannot establish a return or cause a hard split by itself. For mixed precise evidence, only corroboration proven between the away edges can close the episode. |
| Positive or zero comparable exact gap up to 72 hours | Existing short-link eligibility, using the two adjacent away blocks. |
| Nonnegative comparable civil gap up to two days | Existing short civil-link eligibility, using the two adjacent away blocks. Day-only records do not supply elapsed hours. |
| Nonnegative civil gap through ten days with independently known away context at both edges | Existing away continuation, evaluated on those two blocks. The existing distance predicate is at least 50 km from applicable Home context. Unknown distance and same country alone do not pass. |
| Remaining cases | Keep distinct or uncertain under existing review behavior. A gap over ten days separates observed episodes without claiming a return. |

Keep gaps inclusive at the recorded thresholds. The two short paths and the
known-away path retain the current executable OR relationship after vetoes.
Use the same versioned rules across device and worker; do not change country,
city, month, photo-count or candidate score heuristics in this repair. This
is a bounded delta to the active runtime. The older
[continuity contract](../spec-trip-continuity-and-home-setup/engine-contract.md)
proposes other exact-gap and far-context gates. Adopting those gates requires a
separate policy change and positive/negative comparison. Evaluate the rules
against boundary-level fixtures and the exact reported local holiday before
claiming device acceptance.

A Home return run uses only the current edge interval. Group qualifying
observations by active Home area and consecutive civil-day block, break the
run across another away observation or a missing intervening day, and never
pool different homes to meet corroboration. Unavailable, excluded, conflicting
and duplicate-only media cannot supply independent corroboration. This local
rule replaces corroboration across the full library.

## Journey, cover, album and Replay

Commit one generation that separates visit support, verified trip media,
private suggestions and explicit owner attachments. Compute display label and
map support only from permitted visit evidence or explicit owner place claims.
Use the same qualified trip membership for Timeline, map, statistics and
eligible automatic Replay. Changing place or country within an episode does
not create another list entry. Pagination uses the same stable generation and
does not regroup history.

- Eligible visit support and current authorized explicit owner attachments may
  appear in the default album. Time-only or geographically contradictory
  inference cannot populate default albums, covers or fresh Replay inputs.
  Private suggestions do not become visit support when the owner assigns a
  memory. A definite Home match receives no automatic suggestion.
- Preserve exact committed owner Replay order, selected media, artwork and
  soundtrack when they can be proven under the current scope. An automatic
  Home match cannot enter a new automatic composition. A missing or ambiguous
  existing owner selection follows the existing unavailable/review behavior
  and retains the committed selection for reconciliation. Do not silently
  substitute a different trip or photo, drop an owner selection, or use a
  stale prepared artifact as the current composition.
- Bind every cover and album request to one active history, generation, privacy
  revision, journey and ordered evidence references. Revalidate after native
  resolution and before publishing. Preserve unavailable slots. Discard
  superseded callbacks on switching trip, source, privacy or generation.
  Album membership and adapter identity are separate checks.

## Selected-item wrong-image investigation

The owner saw the mismatch on both cover and gallery. Read-only Android
inspection found two matching candidates with 25 geotagged visit-support
rows inside the displayed destination region, and no time-only members.
The original image and its current metadata remain unavailable for comparison.
That establishes saved associations in the inspected generation. It cannot
identify the asset displayed during the reported interaction.

For one owner-selected visible item, bind the same committed generation and
active scope, then classify in this order.

1. Check the journey and slot against the committed support or attachment. A
   missing, unexpected or stale association identifies the projection or read
   boundary before any media change.
2. Resolve the exact local platform handle or the account evidence/authorized
   copy. Under current permission, compare original asset identity, available
   current metadata and saved evidence on the device. For an account
   derivative, use its verified source binding and integrity metadata. A
   derivative can intentionally omit EXIF. Lack of authorized originals or
   comparable metadata yields unknown, with the precise failed boundary.
3. Check that the cover/album hands the resolved asset for that evidence into
   the intended slot under the same authority. Verify cache/renderer identity
   when the adapter exposes enough evidence. Matching transport alone does
   not prove which image reached the screen.
4. If an exact association and asset agree but metadata conflicts with the
   owner-observed location, preserve evidence provenance and offer existing
   review/correction controls. GPS indicates recorded metadata rather than
   verified owner presence. Fix and regression-test only the boundary
   demonstrated by the selected-item reproduction.

Run this comparison locally in a controlled build. Bound it to the selected
item and its committed association. Ordinary browsing incurs no added EXIF
scan or full-file hashing. Never export identities, paths, EXIF, coordinates,
digests or images. If an independent comparison is unavailable, preserve the
unresolved status and label which check could not run.
