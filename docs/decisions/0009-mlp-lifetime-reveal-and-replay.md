# Decision 0009: The MLP is a private lifetime reveal, replay and chosen share

Date: 2026-10-07 (Asia/Bangkok).  
Status: accepted from the user's explicit direction.

## Context

Decision 0008 replaced the Minimum Viable Product release bar with a Minimum
Lovable Product bar, but deliberately left its first experience to be defined.
The user has now defined the intended reaction: when people see their whole
travel life in an interactive map and a video, they should feel "wow" and want
to share it.

## Decision

The first-release promise is a **private Travel Life Reveal**:

1. After an import completes, the owner can explore their available lifetime
   history on an interactive map and chronological timeline.
2. The owner can play a generated **Travel Life Replay**: a short silent video
   that presents the current policy-visible Journey List and its attached
   photos/videos, preserving the list's order, labels and evidence precision.
3. The owner may then create and preview a **selected lifetime highlight** and
   deliberately share its interactive link and/or exported video.

This is not a claim that the app has complete knowledge of a person's life.
The reveal must show available-source coverage and inferred/confirmed status,
preserve uncertainty, avoid invented routes and travel duration, and offer a
useful sparse/partial state when the evidence cannot support a broad replay.

The lifetime map, replay, lifetime-highlight snapshot and both-platform video
export are P0. Static image cards remain P1. The earlier journey-only share
contract remains the safe lower-level mechanism, but a share snapshot must now
support either one journey or an owner-selected lifetime highlight. A full
private history is never published automatically.

## Concrete first-release bar

### Accepted Replay order and trip-separator amendment - 2026-10-23

Private Replay defaults to **oldest first**. The owner may switch the optional
private editor to newest first; this changes only presentation and persists with
the Replay draft. Each visible trip chapter begins with a small local separator
that shows the current policy-visible Journey List label/destination and the
time precision already supported by that record. The card counts within the
chapter budget. It must never manufacture order inside unknown or overlapping
time, exact dates, routes, travel duration, itinerary, presence or observations.
Unknown/incomparable trips retain stable Journey List-relative placement. The
canonical [chapter presentation contract](../../_bmad-output/specs/spec-m4-7-travel-life-replay/chapter-presentation-contract.md)
defines persistence, rendering and validation; this records accepted product
behavior, not implementation or physical-device evidence.

### Accepted sparse chapter amendment - 2026-10-23

The owner accepts shorter chapters when only one or two usable memories exist:
one about4-6 seconds, two about6-10 seconds, enough distinct moments usually
15-20 seconds. These are content-aware targets, not mandatory minimums. Count
titles/transitions inside the chapter and allow useful video to justify longer.
Do not repeat photos, freeze/loop video or add filler to reach a duration.
Total Replay still grows with all scoped trips. This supersedes strict15-20s
per-trip wording below. Exact static5s/8s defaults,3s verified-empty destination
slate and adaptive clip allocation are implementation defaults in the canonical
[timing contract](../../_bmad-output/specs/spec-m4-7-travel-life-replay/timing-contract.md).
No read/access error may be reported as verified empty media. Existing privacy,
source evidence, durable edit and selected-share protections remain.

### Accepted chapter timing and curated memories amendment - 2026-10-23

Later owner direction supersedes the earlier fixed30-60s whole-Replay and
all-media-rendering rules: initially give each scoped trip15-20 seconds and let
the total Replay run as long as needed. Automatically select a meaningful subset
of photos/videos instead of rendering every asset. Every scoped trip remains;
all effective attachments are candidates and originals remain in the album.
The owner requests wise memory-selection criteria, using AI when necessary.

The proposed criteria and evaluation plan are in the canonical
[memory-selection contract](../../_bmad-output/specs/spec-m4-7-travel-life-replay/memory-selection-contract.md).
Personal Keep/Exclude overrides automatic ranking; hard privacy/access/membership
still wins. Proposed18s pacing,4-6 shots, scene-diversity/quality heuristics,
validated short real-video clips and optional local/consented visual AI are
implementation assumptions to evaluate, not proven owner preference or currently
implemented behavior. This also supersedes the prior still-only default when
native motion is supported; honest labelled still fallback remains.

There is no global25-panel/60s gate and no required scope narrowing just for a
large history. Progressively render verified trip chapters with bounded native
work. Long chosen single-file export requires measured storage/assembly/native
sharing gates, not unlimited storage or an arbitrary whole-file32MiB cap.
Photo-library permission and existing metadata-only AI consent do not authorise
provider processing of images/video; purpose-specific opt-in must cover those
actual derivatives and background use. No real private-media call is authorised
by this planning discussion. One-tap watching, durable edits, silent output,
evidence honesty and deliberate exact selected sharing remain.

### Accepted interaction amendment — 2026-10-23

The owner requires a single-action private Replay experience: tap Replay and
play, with preparation performed automatically behind the experience. Remove
mandatory Prepare, configuration and approval steps before private playback.
When preparation is necessary, show a quiet loading state and start playback
automatically when the current valid result is ready. Prepare ahead where native
scheduling permits; never imply that background execution or instant readiness
is guaranteed. Owner edits are optional, reachable from Replay, and must survive
automatic regeneration. Exact editor capabilities remain to be specified; this
does not imply a full video-editing suite. The implementation plan uses trip/media
inclusion and ordering as initial editor assumptions, with local persistence;
these details are not independently owner-approved scope. Sharing/export remains separately
owner-initiated with the existing exact-content preview and privacy protections.
This supersedes conflicting private preparation interaction requirements below
and in the M4.7 drafts. It records product direction, not implemented behavior.

- A completed eligible import opens a map-first reveal covering all visible
  reconstructed journeys, with year filtering, map/timeline synchronization and
  an accessible list fallback.
- The replay renders as a 30--60 second, 720p silent MP4 (target 45 seconds),
  using the policy-visible Journey List and its effective attached media.
  It must be previewable and cancelable before export. It uses
  destination transitions rather than asserting travelled routes; AI narration
  and music are out of scope.
- Before sharing, the owner chooses the journey or lifetime date/place/media
  subset, previews the exact fields and media, and confirms a new versioned
  snapshot. Link publication and native video export are separate explicit
  actions. Link snapshots retain expiry/revoke controls; exported copies cannot
  be recalled.
- If the library has too little or too uncertain evidence for the intended
  reveal, the app states that plainly, shows the available record, and offers
  import, correction or manual-entry next actions. It does not synthesize a
  lifetime story to create the effect. A pending access check or renderer failure
  must not be described as missing travel evidence.

## Accepted Replay amendment — 2026-10-22

The owner reports that Prepare Replay finds nine visible trips but zero usable
attached memories, despite expecting the journeys and their media to supply the
Replay. This amendment supersedes the original observed-chronology preparation
gate and conflicting sampling limits in earlier M4.7 drafts.

- **One source scope:** Private Replay uses the journeys the owner chose to show
  in the current Journey List, including active journey/year filters. With no
  filter, use the full policy-visible list. Use their effective attached photos
  and videos, as exposed by the journey album, respecting membership corrections.
  A visible manual/inferred trip is allowed with its existing provenance.
- **One private action:** Prepare resolves current local media access and composes
  the private preview automatically. It requires no second trip confirmation,
  media-curation step, import or reconstruction. One trip with renderable media
  suffices. A missing capture date or uncertain order does not erase an attachment.
- **Shared access behavior:** Unknown stored availability means resolve access,
  not unavailable. Successful album display is evidence of preview access, not
  proof that the original can be decoded for export. Check both through shared
  local infrastructure and explain actual unsupported/denied/cloud-only outcomes.
- **Complete scope, honest composition:** Every effective attachment enters the
  candidate set. Account for every selected renderable item in the composition;
  do not silently sample trips or media. Visual grouping is allowed and must be
  disclosed. A 30–60 second readable full-scope composition that cannot fit its
  measured limits offers an explicit smaller scope; it never reports sparse
  evidence or silently truncates. Layout bounds are engineering defaults, not
  new evidence rules. Video stills must be labelled if clips are not rendered.
- **Separate sharing:** Private playback does not authorize export or upload.
  Export selection starts empty, offers select-all and individual media controls,
  then renders the exact selection for review and explicit native handoff.
  Existing share eligibility and hosted confirmation/revocation rules remain.
- **Preserve truth:** Use corrected labels and current date precision without
  promoting owner claims to observations. No invented route, presence, exact
  travel duration, date, media, narration or music. Hidden/excluded content and
  effective reject/unassign/move-away corrections remain enforced.

Implementation and acceptance are tracked in the existing
[M4.7 delivery record](../../_bmad-output/implementation-artifacts/spec-m4-7-preview-and-export-the-travel-life-replay.md)
and its canonical spec. This amendment approves behavior and planning; it does
not claim a repaired media pipeline or a successful native replay.

## Consequences

This supersedes the P1 short journey-video scope in decision 0005 and the old
MVP planning artifacts. It promotes story M4.7 and expands M4.5--M4.6 to a
lifetime-highlight share mode. It does not add a research gate or replace the
evidence, correction, consent, privacy, deletion or background-maintenance
requirements already accepted.
