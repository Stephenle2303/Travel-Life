# Replay Edit: trip-first proposal

Status: owner approved the mock/flow and requested detailed specification on
2026-10-24. Absorbed into the canonical M4.7 trip-first-editor-contract.md;
this proposal remains historical source, not the delivery contract. No production
redesign is implemented by this document.
Reference: docs/product/design-system.md; Journey List See photos gallery.

## Confirmed source defects

- replay-screen.tsx filters candidates by boolean `available` before preview-page resolution. Unknown media therefore disappears before the resolver can process it. Resolution overrides are applied after the filter and cannot recover those rows.
- loadNextEditorPreviewPage accepts the filtered displayed array, not the full trip album. End-reached cannot discover hidden unknown media. Errors are swallowed, with no usable retry or visible loading state.
- Initial preview resolution is global (48), rather than the active trip's first page. Later trips can have no resolved media even when their album is populated.
- Replay uses a separate membership query (inferred/owner plus disposition filtering); See photos uses membership:% plus visit support. Album parity is not established. Bali's exact private-record cause remains unverified.
- bulkActions is one non-wrapping flex row with six full-size buttons; its intrinsic width exceeds phone width. Global Done/music/navigation sit after the list content rather than in a reachable task-level footer.
- Cached playback editor selection is recomputed from a partial availability-dependent plan; preparedArtifact stores a count but not an authoritative rendered-media selection. Thus selected counts are not proven equivalent to the existing MP4.

## Proposed task flow

Watch -> Edit Replay (trip overview) -> trip media gallery -> Done (trip overview).
Repeat only for trips the owner wants to edit. Update Replay commits the full
working composition and prepares one replacement. No intermediate trip render.
Back from a gallery also retains acknowledged working edits and returns to the
same overview position. Back from overview returns to the saved video, retaining
the working branch. Done and Update Replay have deliberately different scopes.

Overview: recognizable trip cover, trip name/date, album total and selection
count as separate values, Edited status when changed. A trip with zero selected
still opens its entire eligible album. Zero is displayed only when known; unknown
counts use a checking state. A genuinely zero-media trip stays navigable and
offers its honest empty state, not a broken blank grid.

Gallery: Back / trip title / Done in a fixed header; All and Selected tabs;
three-column recognizable media grid; selected count and duration in a fixed
safe-area footer. Tap selects; distinct expand opens full media/video used
interval. Overflow holds Select all, Restore Auto, Clear, Undo. Each action is
trip-scoped. Inclusion lives on the overview separately from retained selection.
Settings for music/order live once on the overview.

## Required data and state solution

1. Share one policy-aware effective album reader between See photos and Replay.
   Preserve intentional review-only/ineligible items with a reason; never bypass
   privacy or make rejected evidence replay-eligible merely for count parity.
2. Cursor-page metadata for the active trip independently of thumbnail readiness.
   Retain unknown candidates, resolve their local previews in bounded batches,
   prefetch near the end and offer visible Load more/Retry as recovery. Track
   loaded / eligible total / hasMore explicitly. No 48-item lifetime cutoff.
3. Keep eligibility, availability (unknown/resolving/available/unavailable),
   thumbnail readiness and Replay selection as separate states. No false empty
   state while resolving. Unavailable tiles explain access and cannot be falsely
   counted as renderable selections.
4. Persist the authoritative rendered selection/intervals with the verified
   artifact, bound to stable private media references and snapshot/privacy state.
   Hydrate committed output counts from it; keep recoverable draft edits separate.
   Older ambiguous records require local reconciliation, never invented selection.
5. Select all resolves the complete eligible trip scope with honest progress,
   cancellation and an unavailable summary; no partial success disguised as all.
6. Done trip acknowledges its local draft and returns. Update Replay is disabled
   without changes. One aggregate commit/render; failed replacement preserves the
   old video and editable draft. Privacy changes withhold stale media/output.
7. Included zero-selection chapters must have an explicit trip-card-only status
   if retained. Removing a trip is a separate reversible scope action. A Replay
   with no included trip is invalid; a valid trip-card chapter is not blocked only
   because its media selection is empty.

## Acceptance before delivery

- Reconcile owner Bali and Taiwan album media counts/eligibility against See photos
  locally; no raw identifiers, photos or labels in diagnostics or Git fixtures.
- Taiwan-sized synthetic album with unknown media beyond initial page: every
  eligible candidate can be reached, selected, retained after reopen and rendered.
- Zero selected plus nonempty album still opens All; page failure has Retry;
  switching trips retains selection, scroll and paging independently.
- Done trip never invokes rendering. Two changed trips cause one Update Replay
  render; unchanged reopen uses the verified file and authoritative selection.
- Device views at 320/360/390 widths, large text, safe areas and mixed videos:
  no cropped buttons, inaccessible footer, nested vertical lists or hidden actions.
- Owner operates Android/iOS through trip editing and aggregate update before
  self-serve acceptance. Mock and host checks alone cannot establish acceptance.

## Mock

replay-edit-trip-first-2026-10-24.html is an interactive layout/flow proposal.
All media and totals are fictional; rendering progress is explicitly simulated.
Actual source loading, inspection, inclusion and persistence require implementation.
