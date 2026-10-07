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
   that moves through the chronological observed destinations and selected,
   eligible memories.
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

- A completed eligible import opens a map-first reveal covering all visible
  reconstructed journeys, with year filtering, map/timeline synchronization and
  an accessible list fallback.
- The replay renders as a 30--60 second, 720p silent MP4 (target 45 seconds),
  using only chronological observed destinations and owner-visible eligible
  memories. It must be previewable and cancelable before export. It uses
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
  lifetime story to create the effect.

## Consequences

This supersedes the P1 short journey-video scope in decision 0005 and the old
MVP planning artifacts. It promotes story M4.7 and expands M4.5--M4.6 to a
lifetime-highlight share mode. It does not add a research gate or replace the
evidence, correction, consent, privacy, deletion or background-maintenance
requirements already accepted.
