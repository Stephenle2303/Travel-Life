# Atlas UX party review — 2026-10-30

Status: source-grounded review and design proposal, not approved implementation.
Owner reports clutter below Settings and scattered journey information; requested
whole-page BMAD party review. No current phone screenshot or native walkthrough
was inspected; viewport clipping, gesture comfort and visual acceptance remain open.

## Governing references

- docs/product/design-system.md: lean/self-serve, visual decisions, progressive
  disclosure, one task primary per state, safe continuity and device acceptance.
- docs/decisions/0012-dimensional-atlas-and-minimal-list.md and Atlas-only
  Obsidian Horizon / Deep Sea Glass extension. Preserve accepted cartography;
  do not revive deferred decorative docks, routes or globe work.
- _bmad-output/specs/spec-lean-onboarding-and-navigation/experience.md:
  compact preparation, quiet About, reachable Replay and contextual returns.

## Findings and proposed treatment

1. atlas-reveal.tsx:201–210 renders a heading and multiple paragraphs of inferred
   journey/place/country totals, manual count and coverage before exploration.
   Keep one concise scope/coverage summary with Details. Detailed inferred totals,
   manual counts and unavailable-country explanations belong in that disclosure.
   The visible list count must describe its actual filtered set; do not relabel
   inferred totals as verified visits or mix manual entries into inferred totals.
2. Updated after owner correction: current header has Home, Settings and About
   beside the two title labels. Home opens /welcome; View my Atlas dismisses back
   to Atlas without onboarding. Preserve this explicit landing-return capability.
   Propose a quiet labeled Home at left, Your Atlas title, Settings at right;
   place quiet Details beside the summary instead of a third utility button.
   Details should open a bounded sheet rather than insert paragraphs above the map.
3. Search explanation, separate full-size Map/Timeline buttons and year buttons
   occupy several rows. Use a compact segmented view control, concise search and
   compact year selection. Preserve accessible touch targets, labels and selected
   states; keep search privacy details in Details.
4. The full journey list renders in Map and Timeline; Replay follows every row
   (atlas-reveal.tsx:229–245). On phone propose distinct primary content per view:
   Map with selected preview; Timeline with the photo-led list. Keep a visible
   Timeline/count entry, including journeys without coordinates. A compact list
   preview is an alternative if map/list co-presence is desired; never an unbounded
   second feed. Wide layouts can retain map and adjacent list.
5. Make Replay reachable independently of list length, in a safe-area action
   region. It is the ready-state task primary. Add journey is a quieter contextual
   action. Recovery is primary when the page cannot be used. Do not imply that
   Atlas year/search filters redefine Replay's existing committed input scope.
6. Preview puts multiple evidence paragraphs and date fields before a 112px photo;
   Close precedes the media action. Propose recognizable cover, title, concise
   observed period and compact evidence status; media primary, Edit secondary,
   labeled dismiss control, evidence details expandable. Keep owner dates distinct
   from observed dates when both exist. Bound/scroll the sheet for large text.
7. Rows already have reusable cover/title structure; date, status, ordering and
   location warnings are concatenated into one line. Keep title and period,
   compact inferred/owner status, and separate actionable Needs review treatment.
   Do not remove uncertainty to achieve visual simplicity.
8. Atlas navy surfaces currently combine global citrus buttons and green panels/
   rows. Apply an Atlas-scoped token variant for consistent navy/glass/cyan;
   do not recolor shared components across the rest of the app.
9. Pending changes, processing, failure and correction notices can precede the
   map. Present one prioritized compact status with its useful action and Details;
   correction review should lead to affected items instead of a paragraph of
   navigation instructions. Preserve safe existing history while updating.
10. Map recovery contains developer-facing configuration advice. Use concise
    user-facing recovery and Open Timeline; keep configuration details out of the
    product surface. Empty/filter-empty/loading/failure need distinct treatment.

## Proposed phone hierarchy

Home / Your Atlas / Settings → concise scope summary / Details → Map–Timeline and year
→ concise search → dominant map OR photo-led list → reachable Replay.
Selected map item opens a focused preview. Add journey stays quiet and reachable.
Only active work or an actionable issue adds a compact status strip.

## Follow-through and acceptance

This review does not change runtime code or approve a new design. Before delivery,
verify actual Android/iOS small-screen and large-text layouts, safe-area actions,
screen reader/keyboard focus, map versus page gestures, long lists, missing media,
unknown coordinates, overlapping markers, empty filters and offline map recovery.
Validate Settings, Replay, gallery and Edit returns preserve camera, year, query,
selection and scroll where valid. Current source visibly saves selected context
for Settings/Edit; Replay's callback does not explicitly save it, so continuity
requires runtime tracing rather than an unverified loss claim.

Root foundation verification is recorded separately in the chat; it cannot prove
native layout quality. Owner approval and native visual acceptance remain open.
