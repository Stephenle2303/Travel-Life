# Adaptive Replay chapter timing

Accepted 2026-10-23: 15-20 seconds is the normal target, not a minimum. One usable
memory is about4-6s; two about6-10s. Titles/transitions count within the chapter.
Useful video can justify longer; never repeat assets or add filler to hit a target.
This contract supersedes strict chapter minima elsewhere. Total Replay duration
is the sum of its chapters with no lifetime cap or trip-count narrowing rule.

## Count the actual chosen content

Apply privacy/membership/access, owner exclusions, automatic duplicate grouping,
curation and original-decode validation before choosing duration. Count distinct
chosen sources, not album size, source-file timestamps, or repeated frames. An
explicit owner-kept similar image remains a deliberate choice and may add dwell.
Twenty near-identical automatic candidates may yield one selected image and a
short chapter. A decode failure can reduce a chapter from two shots to one.

| Actual chosen content | Accepted target | Initial exact static implementation default |
| --- | --- | --- |
| No verified usable media, but a visible trip | Brief honest destination slate; no invented media |3s, an agent-selected assumption |
| One still | About4-6s |5s |
| Two stills | About6-10s |8s total,4s each |
| Three distinct stills | Usually15-20s |15s total,5s each |
| Four distinct stills | Usually15-20s |16s total,4s each |
| Five distinct stills | Usually15-20s |18s total |
| Six distinct stills | Usually15-20s |20s total |
| Useful video or mixed media | Natural validated clip timing can extend the sparse target |Use the allocation rules below; no padding |
| Explicit owner additions exceeding automatic capacity | Preserve eligible owner choices |Extend the chapter visibly; no silent removal |

Exact static defaults, six-shot automatic maximum and the3s empty slate are
engineering starting points, not separately owner-approved stylistic choices.
Normally choose4-6 moments when worthwhile; select fewer if diversity/quality
would suffer. More album files never imply more mandatory shots.

## Concrete allocation

Use24fps throughout. Static target seconds convert to exact integer frames.
Divide available display frames over selected stills in order, with at most one
frame difference. Titles overlay the chosen content; transitions overlap existing
shot time and cannot create additional duration. Do not add a separate4s intro
or5s outro per trip. The exported duration and player duration must agree within
one frame, using the actual timeline rather than summing overlapping transitions.

Selected video windows normally last3-5s. An eligible window may extend to8s to
finish a coherent action, subject to supplied source duration and validated
boundaries. No motion model capability or event-boundary accuracy is assumed;
without a valid extension signal, retain the deterministic short interval. Short
originals can play for their actual duration, even below4s. Do not slow, loop,
stretch or freeze a clip to satisfy a still-photo target.

For a mixed chapter, start with the static target for its chosen-source count.
Allocate actual video frames first, then divide remaining frames among stills.
Each still gets at least2.5s; if this does not fit, raise the chapter duration to
video-frame-total plus minimum still dwell, up to20s for an automatic chapter.
A video-only chapter uses the sum of actual clip frames without stretching to
the static target. This makes a useful video exception explicit and measurable.

If an automatic plan cannot fit20s, shorten eligible unpinned clip windows within
their valid natural interval, then reconsider the lowest-marginal-value Auto item.
Keep candidate/accounting records and compute a new chapter; do not truncate
frames silently. Explicit Keep content is never removed for this limit: extend
that chapter with a visible new duration. No request to edit is needed for the
ordinary automatic path. One source is not selected repeatedly as fake variety.

## Loss, empty states and cache binding

Unknown availability/pending access/native error is not zero memories. Resolve or
show the fixed failure state. A destination slate is allowed only for a qualified
visible trip with a verified empty usable/selected set; it carries the current
coarse label/precision and no fabricated image or presence claim. A privacy-hidden
trip is omitted under the scope policy, not retained as a revealing title slate.

On unreadable Auto media, try another eligible diverse candidate and recompute
chosen count/duration. On a failed owner Keep, retain the override and show its
unavailability without silently substituting. Any exact export selection change
requires a new exact preview/review. Source evidence and original media stay intact.

Include chosen handles/order, crop/clip intervals, allocated frames, coarse labels,
provenance, relevant correction/privacy effects and selector/renderer versions in
the per-trip content fingerprint. Global history/draft revision is a freshness
check, not a reason to re-encode identical safe chapter bytes. Revalidate current
privacy/access/scope first, then reuse unchanged fingerprints. Changing one trip
rebuilds that trip only; a privacy mutation immediately stops any affected player
regardless of cache equality. Sequence order changes can reuse unchanged chapter
bytes while creating a new sequence manifest; export review is always invalidated.

## Required acceptance

- One/two photo-only chapters fall within accepted4-6s/6-10s ranges and exact
  initial defaults; three-six follow their exact frame budgets.
- Title/transition time is counted, no repeated/held-frozen filler, and a burst
  reduced to one chosen item uses sparse timing despite a large album count.
- Valid short/mixed video uses actual intervals; clip extensions are<=8s, automatic
  chapter<=20s, explicit keeps may extend visibly; no out-of-range or sped video.
- Decode loss recalculates timing; access failure is fixed failure rather than
  empty content. Zero-media slate and privacy-hidden exclusion remain distinct.
- Total playback/export duration equals the sum of actual verified chapters, with
  no lifetime cap. Edits persist and affect only relevant chapter fingerprints.
