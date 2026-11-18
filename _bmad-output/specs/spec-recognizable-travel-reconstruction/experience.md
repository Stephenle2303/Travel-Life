# First reveal, clarification, and review

Use Living Atlas components and the existing Welcome, photo choice,
Map/Timeline, journey preview and Replay entry. This spec changes the
first reveal and how provisional results are found.

| State | Owner experience |
| --- | --- |
| Fresh setup | Welcome → optional Home bases → existing photo choice → Atlas preparation. Keep multiple dated areas, Skip, later edits, and the existing Local/Account authority indicator. |
| First reliable result | Show the lifetime map and one featured trip with recognizable, authorized media. Primary action **Play this trip** when its eligible media can support playback. Otherwise use **Open trip**. Keep the full Timeline available. |
| Observed places without a reliable trip | Show observed places with distinct styling and no trip or route claims. If there are plausible outings, surface **Possible trips** below the main results. |
| Sparse, unavailable or empty source | Use the existing source recovery or valid empty state. Indicate limited coverage without inventing trips or requiring additional access. |
| Returning or restored history | Open its existing Atlas. A restart, restore, catch-up, or returning Welcome visit does not reset the first-reveal question budget. |

Feature the most recognizable eligible reliable trip using diverse authorized
media and coherent support across independent observations. Break equal ranks
deterministically. Render factual destination and observed date where supported.
An unavailable or uncertain name falls back under the current country/neutral
label policy. A lost media slot never resolves to a different photo. Rank and
fetch bounded previews outside the primary import wait. Preserve the existing
Replay composition, soundtrack and selection. **Play this trip** opens a
private single-trip preview under the current eligibility checks, without
overwriting a committed lifetime Replay.

## One optional question

Show it beside or below the first verified result. It never gates the map,
Timeline or Replay. Example copy is **Was this one of your usual places in
2024?** Show representative photos from the authorized place-period, a supported
label if available, and **Yes**, **No**, **Not sure**, and a dismiss action.
The question uses a specific interval and must be recognizable even without a
place label. Preserve the user's ability to edit explicit Home bases in Settings.

- **Yes** records a dated usual-place observation in the current history.
  It does not create or expand an explicit Home area.
- **No** records that this specific place-period was not usual, so the same
  inference is not repeated. Photos still need independent trip evidence.
- **Not sure** or dismiss uses the one-question budget and changes no trip
  facts. History remains available while an answer is being checked.
- On verified completion, show actual changes with the relevant trip cards.
  Example copy includes **We found three more trips** or **Everyday photos
  were removed from the trip list**. Both may apply even if the total fell.
  Offer **Undo** for the exact answer revision. Never promise a result from
  the uncommitted simulation.
- If evidence changes while the question is open, say **Your Atlas changed.
  You can keep exploring.** Retire the stale question. If acknowledgement
  is unknown, offer **Check again** against the existing receipt.

## Possible trips

Provide a dedicated section or destination from Timeline and the sparse reveal.
Do not interleave candidate cards with the main trip feed or count. Show a
bounded page, recognizable permitted media, observed date and a concise reason
such as **A nearby outing with limited photos**. Keep raw IDs, scores and
developer fields out of product copy.

Opening a card preserves scroll context. **Keep as a trip** creates a scoped
owner decision. After durable readback, move the trip to the main Timeline.
**Not a trip** records a scoped rejection. Closing does not alter evidence.
Available source originals stay private. A candidate with unavailable
thumbnails can use the standard neutral treatment. If identity or authority
changed, refresh the section and keep unrelated decisions intact.

Verify text scaling, screen reader names and focus, safe areas, Android Back,
iOS return, reduced motion, progress feedback, and the empty result in native
device runs.
