# 0014 — Lean self-serve UX and visual Replay editing

Date: 2026-10-24 (Asia/Bangkok)
Status: accepted owner direction; implementation pending

The owner rejected Replay Edit's text/button list because media cannot be
recognized while adding, removing or replacing it. All UI builds and rebuilds
must reference the [Living Atlas design system](../product/design-system.md),
design from the user's perspective, minimize text and steps, use intuitive
navigation, and move technical preparation behind the task with truthful
updating progress bars/percentages.

Replay editing must feel like editing the video: retain preview context, organize
media by trip, and use the Journey List `See photos` grid pattern with visible
selected/unselected media and direct inclusion control. This supersedes the
earlier agent-selected flat Add/Remove/Replace/Move button-list presentation.
Replay remains one-action playback with optional Edit and separate deliberate
sharing. Source media, trip membership, evidence and privacy gates are unchanged.

Owner-approved amendment (2026-10-24): Edit opens a trip overview. Each trip opens
its complete media gallery; tile taps toggle inclusion and a distinct expand
control opens inspection. Done or Back in the trip retains acknowledged working
edits and returns to the overview. Only overview-level Update Replay commits all
edits and prepares one replacement; unchanged output is reused. This supersedes
the inline trip strip/global Done design. Separate album totals, selected intent
and rendered selection; unknown candidates remain pageable and zero selected
never hides a populated album. Fixed safe-area actions and overflow disclosures
replace clipped rows. Order and soundtrack live once on the overview. See the existing
[interaction contract](../../_bmad-output/specs/spec-m4-7-travel-life-replay/interaction-contract.md)
for detailed behavior and acceptance; it remains part of the sole M4.7 delivery.

Source review confirms the mismatch; this decision does not claim a rendered
UI review, usability validation or implementation. Physical Android/iOS evidence
is required before calling the rebuilt experience accepted.
