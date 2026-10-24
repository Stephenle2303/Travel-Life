---
id: SPEC-replay-soundtrack-and-month-order
companions:
  - behavior-and-acceptance.md
sources: []
---

# Replay soundtrack and month/year order

## Why

The owner reports silent rendered Replay videos and newest-first playback despite
the agreed oldest-first default. The previous external Music on/off action also
re-rendered the video instead of providing familiar player mute behavior. The
owner selected Happy Moments and wants to replace it with a local audio file
through Edit Replay.

## Capabilities

- **CAP-1**
  - **intent:** Replay includes Happy Moments version 1.4 as its default background soundtrack.
  - **success:** A newly rendered private preview and selected export contain audible music through their duration, with fades and no original clip audio.
- **CAP-2**
  - **intent:** The viewer controls listening with a speaker button on the video player.
  - **success:** Mute/unmute changes immediately without rendering, losing playback position, or changing the exported soundtrack.
- **CAP-3**
  - **intent:** The owner replaces the default soundtrack with their own audio file in Edit Replay.
  - **success:** A valid file up to 5 MB becomes the soundtrack after Done and remains available for subsequent renders; cancellation or rejection preserves the previous selection. The owner can restore Happy Moments.
- **CAP-4**
  - **intent:** Automatic Replay presents trips from oldest to newest by month/year.
  - **success:** Preview and selected-export chapter order use ascending start year/month regardless of Journey List input order or date-overlap flags; same-month ties are stable and unknown times are last. An explicit newest-first edit remains supported.

## Constraints

- Read the companion for exact state, validation, ordering, and verification contracts.
- Playback mute and soundtrack selection are separate state; export always includes the selected soundtrack.
- Audio remains on-device in app-private storage, without uploading to a service or diagnostic logging of names, paths, or content.
- Existing privacy/access revalidation, owner corrections, selected-export scope and video-frame timing remain intact.
- This supersedes silent-only Replay requirements and day-based ordering rules for this presentation. Welcome remains silent; music and ordering do not establish travel evidence.
- Preserve concurrent performance-plan work. This specification does not authorize build/server/device mutations or version-control publication.

## Non-goals

- Cloud music uploads, streaming catalogs, paid music services, multiple default-track browsing, trimming editors, beat-sync or mixing owner-video audio.
- Changing travel reconstruction dates, Journey List ordering, trip membership, or chapter duration.

## Success signal

On an owner-operated device, Replay visibly plays oldest-month-first with audible
Happy Moments; the player speaker button mutes instantly. A chosen valid local
track replaces it after Done and is audible in the exported MP4. Invalid or
oversized selections leave the prior soundtrack usable.

## Assumptions

- Engineering interpretation: 5 MB means 5,000,000 bytes; exactly that size is accepted, larger files rejected. UI displays 5 MB.
- Initial imported formats: MP3, M4A/AAC, WAV and OGG, subject to actual on-device decode support. Unsupported/protected files receive fixed recovery copy.
- A newly mounted preview starts unmuted; re-rendering does not need to preserve playback position. A mute click on the existing player must preserve it.
