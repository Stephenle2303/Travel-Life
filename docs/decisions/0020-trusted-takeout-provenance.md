# Decision 0020 — Trust Google Takeout imports for GPS-less trip detection

Date: 2026-11-19
Status: Accepted by the owner in chat. Implemented.

## Decision

- A photo under a Google Takeout photo export (`.../Takeout/Google Photos/...`,
  matched on that fixed inner path regardless of the timestamped export
  wrapper folder name) is trusted the same way a `DCIM/Camera` capture is:
  for travel-window detection (burst formation, home-offset inference) and
  for trip membership, not only for owner review.
- This is a new `imported` provenance class, kept distinct from `camera` in
  the data model (never silently merged), so a future UI can still say
  whether a photo came from the device's camera or from an imported library.
- Still excluded ahead of this: messaging, screenshot and download folders,
  and any photo carrying GPS (the located engine's territory, not this one).

## Context

Story 1's evidence experiment on the owner's Xiaomi 15 found that only 13%
of the owner's photo library matched the `camera` provenance rule; 99% of
the rest (15,710 of 15,824 "unknown" photos) came from just two distinct
top-level folders. One is a bulk Google Takeout import of the owner's whole
Google Photos history (2012–2023), organized by year and by album, including
explicitly travel-named albums. This is by far the largest source of real
historical travel evidence on the device — several times larger than the
device's own camera roll — and was entirely invisible to window detection
under the original `camera`-only rule.

The owner was asked directly whether to trust this evidence for *detecting*
a trip, not only for manual review, and said yes.

## Consequences

`window-detector.ts`'s burst-formation filter and `inferHomeOffsetMinutes`,
and `membership.ts`'s membership rule, now trust `imported` the same as
`camera`. The match is on the fixed `Takeout/Google Photos` inner path only,
not the export-specific wrapper folder name, so it should generalize to any
owner who did a Google Takeout photo export, not only this one. EXIF offset
reliability for older imported photos (pre-dating the current device) is
unverified — Story 1's offset-tag findings were measured before this change
and may not hold for the newly-trusted population. Reconsider if a future
device/library shows this folder convention produces false positives (e.g.
received-not-owned photos mixed into a Takeout export).

## Verified on-device (2026-11-19)

Rerunning the same Story 1 harness with this change on the owner's library:
camera-trusted coverage rose from 13% (2,449/18,962) to **89%**
(16,916/18,962); `unknown` fell from 15,824 to 1,357, with only one distinct
unrecognized top-level folder left (not investigated, at the owner's
request). Candidate windows rose from 12 to 32. Most new windows stayed
correctly silent (`no-strong-clue`, a burst alone). The previously-found
2024–2026 windows (including the Korea trip) are unchanged. New:
**seven consecutive travel-looking windows from 2022-03-26 to 2022-05-31**,
each via the `offset-shift` clue, with shifts of -840min then -660min
against home (two different negative offsets, not one — consistent with
travel across more than one time zone within the same extended trip, but
this is a clock-shift-only signal; no country is named or implied, per the
spec's own rule that a shift alone never names a place). This two-month
window was completely invisible to the original `camera`-only rule and is
the largest single piece of new evidence this decision produced.
