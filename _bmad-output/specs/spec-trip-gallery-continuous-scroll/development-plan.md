# Implementation and acceptance plan

Status: planned, not implemented. One cohesive gallery behavior fix.

## Evidence and code map

- `apps/mobile/src/components/journey-media-viewer.tsx`: `nextPage` calls
  `setGallery(null)`; the effect calls `setGallery(next)` instead of appending.
  `pageIndex` represents a screen rather than progress through an album. Errors
  replace FlatList; selected media also conditionally unmounts it. These are the
  confirmed causes of replacement and potential offset loss.
- `apps/mobile/src/components/atlas-reveal.tsx`: creates the viewer with detail,
  local previews and a loader closing over journey ID/snapshot token. Its inline
  callback changes identity on render; that must not reset an album session.
- `apps/mobile/src/reconstruction/repository.ts`: `loadJourneyMediaPage` already
  returns 60 items with stable run-bound `media-N` IDs, deterministic ordering,
  a lookahead `hasMore`, and stale-run rejection. Keep this batching contract.
- `apps/mobile/src/photo-access/provider.tsx`: checks lifecycle/generation before
  and after repository/preview resolution. Preserve those guards.
- `apps/mobile/src/reveal/types.ts`: `JourneyMediaPage` is a transport batch,
  not a requirement to replace the visible screen on every fetch.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx`: current paging
  test checks request/retry calls but not retention of old items or scroll state.

## State and loading rules

1. Give each viewer session an explicit identity containing journey ID and
   committed snapshot token, supplied by Atlas. A rerender or changed loader
   function alone must not reset it. A different journey/snapshot starts a new
   empty session and invalidates outstanding callbacks.
2. Model loaded entries, next batch index, `hasMore`, first-load status,
   incremental-load status and error independently. Represent each loaded entry
   together with its preview/reference, keyed by opaque media ID; do not merge
   two parallel arrays independently. Missing previews get explicit unavailable
   placeholders rather than shifting alignment.
3. Load batch zero once. Until it settles show first-load state, not a temporary
   four-memory gallery. When no loader exists, retain the current bounded detail
   fallback and omit Load more; this is an honest partial preview.
4. On Load more, retain all rows and the current list instance. Capture session
   epoch and requested index; set a synchronous in-flight guard so rapid taps
   cannot enqueue duplicates. Disable the footer and show loading feedback.
5. On a current successful result, append new IDs in repository order, deduplicate
   overlapping responses and retain existing entry/preview pairs. Advance the
   next index only on success. An empty last batch ends loading without clearing
   earlier rows. Empty nonterminal/no-progress results show a retryable footer
   error; do not loop or silently claim album completion.
6. Ignore responses after close, invalidation or session change. Under a valid
   immutable snapshot existing positional IDs are sufficient: do not introduce a
   database migration or change reconstruction membership for this fix.

## Scroll, selection and resources

- Keep a single virtualized three-column FlatList with stable keys and a footer
  containing Load more/loading/retry/end state. Appending must not call
  `scrollToOffset(0)`, clear data, change the list key or remount it.
- Track selected media by its stable ID, not an index into the latest batch.
  Show selected media over the retained grid, or restore a stored visible-item
  anchor/offset after layout when returning. Prefer retaining the grid instance.
  Resolve the selected item from the accumulated entries.
- Track a visible-item anchor plus pixel offset as a fallback for layout changes;
  orientation/column-size changes retain the same logical item, not an obsolete
  absolute offset. Keep close/Back actions accessible at large text sizes.
- Retain loaded metadata and local preview references, not full-resolution image
  buffers. Configure a bounded FlatList render window; let cells remount as the
  owner scrolls. Native virtualization may re-resolve a thumbnail from its local
  reference; the item must remain part of the scrollable album.
- Only mount the selected video player, with existing explicit Play/muted start.
  Pause/unmount on item change, Back, background or close. Do not prefetch videos
  or all remaining batches. Release accumulated session state on close.

## Errors and invalidation

- Recoverable page/read failures retain loaded rows and position. Show a footer
  Retry that requests exactly the failed index; successful retry appends once.
- First-page failure has an initial Retry and Close, without a false empty-album
  success state.
- Introduce a small shared typed gallery error code, if required, at the existing
  provider/repository boundaries: `snapshot-changed`, `access-revoked`,
  `load-failed`. The current generic rejection text must not make a stale-run
  failure look recoverable within the same session. Do not expose raw errors.
- Changed snapshots invalidate the gallery and require return/reopen; do not
  append fresh entries to stale ones. Revocation/disconnect blocks display and
  pending publication immediately through existing provider/Atlas gates.

## Ordered delivery tasks

1. **Regression tests first** — add focused `journey-media-viewer.test.tsx` cases
   using synthetic media references and deferred promises; extend the Atlas
   integration test to assert old and new entries coexist.
2. **Session accumulator** — update `journey-media-viewer.tsx` (extract a small
   gallery-state module only if useful) with paired entries, serialized loading,
   successful-only index advancement and request-epoch invalidation.
3. **Continuous interaction** — move loading/retry to FlatList footer; preserve
   the grid and selected-ID/anchor state across loading and media open/Back.
4. **Boundary wiring** — pass journey/snapshot session identity in
   `atlas-reveal.tsx`; preserve existing access checks in provider/repository.
   Add typed error classification only where needed, with no schema changes.
5. **Verification and device delivery** — run mobile tests, TypeScript, lint,
   root `npm run check` and `git diff --check`; update delivery/error records;
   load the verified current development bundle for Android owner acceptance.
   iOS acceptance remains explicit manual work if a device is unavailable.

## Acceptance cases

| ID | Given / action | Required result |
| --- | --- | --- |
| A1 | Valid album, batches 60 + 60 + 17 | Counts accumulate 60, 120, 137; earlier IDs/preview mappings persist; no duplicates; footer ends after final batch. |
| A2 | Scroll near row 20, load next batch | Same row remains visible at the same position; scroll up reaches the first batch and down reaches appended entries. |
| A3 | Batch 0 retained, batch 1 fails then succeeds | Existing cells remain interactive; Retry requests batch 1 again and appends once. |
| A4 | Double tap / repeated footer event during a deferred fetch | One outstanding request; only one append and one next-index advance. |
| A5 | Open early/later photo or video after several loads, then Back | Same accumulated album and row restored; selected media matches its ID/preview; video pauses. |
| A6 | Close/change trip/change snapshot during a deferred fetch | Late result ignored; no media or state leaks into the new session. |
| A7 | Revoked permission or disconnected private record | Media blocked immediately; no late request republishes it. |
| A8 | Empty final batch, repeated batch, missing preview | Retain previous entries, avoid duplicates, preserve pairing; no infinite no-progress fetch loop. |
| A9 | First-load failure / absent loader / no media | Honest distinct states, useful Retry/Close, no preview flicker or false completion. |
| A10 | Large synthetic album, repeated scroll and orientation changes | All loaded IDs remain addressable; render window remains bounded; logical anchor retained; no full-album decode. |
| A11 | Close album | Original Atlas viewport/filter/selected trip retained. |

Native Android/iOS acceptance uses a consented trip with at least three batches:
load to the end, revisit first/middle/final photos repeatedly, open a video and
return, background/foreground, and close to Atlas. Inspect for jumps, blank rows,
wrong media, duplicates and sustained memory growth. Synthetic/component passes
cannot prove native scroll smoothness or physical-device memory behavior.
