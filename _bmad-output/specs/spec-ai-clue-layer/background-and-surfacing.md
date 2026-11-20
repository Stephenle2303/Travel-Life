# Background pass and surfacing (CAP-3)

## When it runs

- After a completed rule rebuild, and in the existing maintenance task
  (`travel-life-library-maintenance-v1`) windows. Platform scheduling decides
  timing; foreground Atlas can resume a paused pass.
- Never while a rebuild, import or account sync holds the write lease.
- Pauses when photo access is lost, the record is disconnected, or the app is
  backgrounded beyond the platform allowance.

## Budget and queue

- Per pass: bounded photos analysed and wall time (initial defaults: 96
  photos, the current `visualDiscoveryPhotoAttempts`, and a new 60-second
  limit; both versioned and tuned through the eval).
- Prefer charging and Wi-Fi for model-heavy producers and pack downloads.
- Queue priority: newest Possible trips by reason (`no-location`,
  `single-moment`, `few-photos`, `near-home`), then travel windows, then Atlas
  trips without a named destination, then photo-source for Atlas support.
- Checkpoint after every committed clue batch; resume continues from the
  checkpoint; a stale checkpoint (evidence revision changed) restarts the
  affected subjects only.

## After the pass

1. Commit clues in one transaction.
2. If any active clue changed, request one rule rebuild.
3. Compare the new result with the previous one and record counts.
4. Show one note only when something visible changed:
   "Travel Life updated 2 trips and named 1 place." Tap opens the changed
   trips. No note for silent clue churn.

## Never

- Remove or lower an Atlas trip (creates a review card instead).
- Change an owner-reviewed, confirmed, rejected or corrected trip.
- Publish, share or add to Replay anything not already selected (decisions
  0005/0009 sharing rules unchanged).
