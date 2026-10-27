# Share Replay trip selection review

Date: 2026-10-26 (Asia/Bangkok). Scope: owner-requested BMAD party flow review;
no runtime implementation or device acceptance in this record.

## Owner requirement

Share Replay must offer the trips currently used in the private Replay rather
than ask the owner to select photos/videos again. Sharing inherits the committed
Replay composition within each selected trip; media editing belongs in Replay Edit.

## Verified source findings

- `apps/mobile/src/components/replay-screen.tsx`: `shareableCommittedMemories`
  constrains candidates to committed media, but `share-review` flattens them into
  individual numbered photo/video buttons. `shareMemoryKeys` starts empty.
- `exportReplay` renders the chosen media then calls `exportPrivateReplay`
  immediately. There is no separate selected-subset video review before OS handoff.
- `docs/product/design-system.md` requires an exact selected preview before an
  explicit export/publish action and keeps sharing empty by default.

The source confirms the reported selection-unit mismatch. The photo-level
selection model explains current behavior; the historical intent behind that
implementation is not established by this review.

## Flow recommendation

1. Share Replay opens recognizable trip cards from the committed Replay only:
   cover/poster, current trip name, date and visible selection checkmark.
2. Start with no trips selected under the existing privacy default. Offer Select
   all trips and Clear; disable continuation with zero selected trips.
3. Selecting a trip includes exactly its committed Replay media and their order.
   Never expand to the full trip album, restore excluded media, or offer other
   Journey List trips. Preserve committed trip order and soundtrack.
4. Preview the resulting selected Replay privately, then use an explicit Share
   video action to open the OS share sheet. Reuse an identical verified artifact
   when possible. Selection changes invalidate the subset preview.
5. Back retains the current selection during this flow; leaving sharing preserves
   the private Replay. Media changes remain in Edit. Revalidate eligibility and
   privacy before preview/export; never silently replace stale composition.

The trip selection unit is the owner's explicit correction. Card details and
control labels above are recommendations within the existing design system.
Interactive-link publishing remains its separate delivery scope.

## Implementation acceptance / next work

- Two Replay trips and an additional album trip: offer only the two Replay trips.
- Selecting one trip exports its committed subset, never all album media; retain
  excluded-media exclusions, trip/media order and committed soundtrack.
- Selecting all produces the same effective composition as the private Replay.
- Zero selection cannot export; exact subset preview precedes OS dispatch.
- Privacy/source changes prevent exporting stale selection; cancellation/failure
  preserves the private Replay and provides an actionable recovery path.
- Before runtime changes, define the diagnostic map and failure/redaction tests
  under `docs/development/diagnostic-implementation-policy.md` in the delivery
  record. Verify on owner-operated Android/iOS; host tests alone are insufficient.

Status: review recorded; runtime mismatch remains open.

Validation: `npm run check` passed (framework integrity, 25 foundation tests,
eval infrastructure smoke). These checks do not validate the proposed UI or
device sharing behavior.
