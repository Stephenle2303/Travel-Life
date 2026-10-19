---
id: SPEC-trip-gallery-continuous-scroll
companions:
  - development-plan.md
sources: []
---

# Continuous scrolling in the trip gallery

## Why

The owner expects one scrollable Photos and videos album for a trip. Currently
Load more clears the displayed batch and replaces it, preventing scrolling back
to earlier photos. This plan corrects that interaction while retaining bounded
local loading. Planning only; implementation has not started.

## Capabilities

- **CAP-1**
  - **intent:** Browse all loaded trip photos and videos in one continuous album.
  - **success:** After loading batches of 60, 60 and 17 entries, all 137 remain in order and reachable by scrolling both ways; appending does not move the visible anchor. Load more disappears at the end.
- **CAP-2**
  - **intent:** Open media and return to the same place in the album.
  - **success:** Photo/video Back preserves loaded entries and the visible row; closing the album restores the existing Atlas camera/filter/selection context.
- **CAP-3**
  - **intent:** Continue loading reliably while preserving browsing during recoverable failures.
  - **success:** Repeated taps create one outstanding request, retries load the same failed batch without duplication, and late results cannot leak into a closed/different/stale album. Access revocation blocks media immediately.
- **CAP-4**
  - **intent:** Browse a large trip without retaining every decoded image or active video.
  - **success:** Retain lightweight loaded-entry state, virtualize rendered cells, load only requested batches, and release gallery resources on close. Only the explicitly selected video can play.

## Constraints

- Preserve mixed-media order, association provenance, unavailable placeholders,
  local-only resolution and existing privacy/access/generation gates.
- Preserve the current 60-item repository batches and deterministic order; only
  same-snapshot batches may coexist. Keep stable opaque entry IDs and correct
  entry-to-preview pairing. No schema or reconstruction change is required.
- Keep Load more as an explicit footer action. Old rows remain rendered while
  loading or retrying; never switch back to the four-item preview as a paging
  placeholder. Loading must not replace/remount the list or reset its offset.
- A changed snapshot requires reopening the journey; never combine generations.
  Denied/revoked access must not be treated as a harmless retryable failure.
- Follow the Living Atlas design system and retain the current photo grid.

## Non-goals

- Automatic infinite loading, swipe-carousel navigation, album redesign, or
  durable restoration after album close/app relaunch.
- Changing eligible media, trip membership, destination naming or map behavior.
- Preloading the entire album, downloading cloud originals, or retaining all
  decoded full-resolution media.

## Success signal

On Android and iOS, load three batches, scroll back to the first photo and down
to the final photo, open either and return to its row. No prior batch disappears,
duplicates or jumps occur, and an incremental-load failure leaves earlier media
browsable. Automated tests cover state/races; device checks establish actual
scroll behavior and resource performance.

## Assumptions

- Retention is scoped to one open album session; closing and reopening may start
  from the beginning. Explicit Load more remains the interaction requested.
