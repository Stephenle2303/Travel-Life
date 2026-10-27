---
title: 'Select committed Replay trips before native video sharing'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '113e5c89feae737dc0facb68569b93f6cf452501'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/diagnostic-implementation-policy.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/implementation-artifacts/review-share-replay-trip-selection-2026-10-26.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Share Replay currently makes the owner choose individual photos and
videos again even though the private Replay already has a committed trip-based
composition. It also sends a newly rendered subset directly to the OS sheet,
without letting the owner watch that exact subset first.

**Approach:** Share Replay will begin with empty trip selection from only the
committed Replay, preserve each selected trip's committed media/order/soundtrack,
privately prepare and preview that exact subset, then require a separate explicit
native-share action.

## Boundaries & Constraints

**Always:** Start empty; show recognizable committed-trip cards with a visible
selection state; use only currently eligible committed media; preserve Replay
trip/media ordering and soundtrack; retain the original private Replay; invalidate
and dispose a previous subset preview when selection changes; preserve the working
trip selection when returning from subset preview; use one correlation per prepare
or export action and the closed, redacted diagnostic contract.

**Never:** Re-open the full trip album, restore excluded media, include a Journey
List trip absent from the committed Replay, auto-publish/upload, expose source
references or native errors, alter share-snapshot/M4.5 infrastructure, or weaken
the concurrent verified cache-handoff guard.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Choose one trip | A committed trip with usable committed media | Build an ordered subset from precisely that trip's committed keys and current soundtrack | Keep original Replay and selected trips |
| Choose all | Multiple eligible committed trips | Subset composition is equivalent to the committed Replay composition | No new album candidates appear |
| Empty/stale scope | No selected trip, or access/privacy changes before preview/export | Preview/share is unavailable; no OS dispatch | Fixed `REPLAY_EXPORT` category/stage, retryable unchanged outcome |
| Preview lifecycle | Selection changes or owner returns | Existing temporary subset preview is invalidated; selection persists on return | Private full Replay remains playable |
| Handoff failure | Exact subset preview is valid but immutable handoff copy fails | Do not open OS sheet; retain subset and full private previews | Existing `SAVE_FAILED / REPLAY_HANDOFF / unchanged` event |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/replay-screen.tsx` -- owns Share Replay state,
  committed-media gate, presentation, subset preparation, and screen-level
  diagnostics. Replace media selection with ordered committed-trip selection;
  do not replace its concurrent handoff-result copy.
- `apps/mobile/src/photo-access/provider.tsx` -- `preparePrivateReplay` can
  prepare an exact caller-ordered subset and preserves its supplied soundtrack;
  `discardPrivateReplay` owns temporary artifact cleanup.
- `apps/mobile/src/replay/types.ts` -- `ReplayManifestInput` supplies groups,
  media, committed membership, ordering, and soundtrack; no schema change is
  needed.
- `apps/mobile/src/components/__tests__/replay-screen.test.tsx` -- replace
  media-level assertions; exercise composition, preview lifecycle, diagnostics,
  and explicit handoff sequencing.
- `apps/mobile/src/replay/renderer.ts` and its test -- existing WIP validates,
  copies, and verifies the native handoff; retain it unchanged unless its public
  call contract requires an additive adaptation.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/src/components/replay-screen.tsx` -- derive ordered eligible
  committed trip candidates and replace per-media selection with accessible,
  recognizable trip cards; add a private subset-preview state and separate share
  action; classify subset preparation and stale/unknown outcomes precisely.
- [x] `apps/mobile/src/components/__tests__/replay-screen.test.tsx` -- update
  media-level tests and add selection/order/music, zero, preview-before-dispatch,
  invalidation/Back, failure/redaction, and correlation assertions.
- [x] `_bmad-output/implementation-artifacts/spec-share-replay-trip-selection.md`
  -- append actual source decisions, test evidence, collection recipe, device
  limitation, and any incident lesson during implementation.
- [x] `docs/development/error-playbook.md` and `docs/project-state.md` -- record
  the verified correction and its remaining owner-device acceptance evidence.

**Acceptance Criteria:**

- Given a private Replay with two committed trips and another visible Journey
  List trip, when Share Replay opens, then it offers only the two committed trips
  and no individual media selector.
- Given a selected trip, when a subset is prepared, then it contains exactly its
  committed eligible media in committed order and the committed soundtrack.
- Given a prepared subset, when the owner taps Share video, then and only then
  does the native handoff begin; selection changes require a new preview.
- Given a failed subset preparation, stale scope, or failed handoff, when the
  failure occurs, then no OS sheet is opened, both private content and a safe
  recovery path remain, and the exact closed diagnostic is emitted without
  private data.
- Given a current Android/iOS build and synthetic-safe Replay, when the owner
  selects a trip, previews it, and shares it, then the actual device confirms
  trip recognition, exact preview, and target-system handoff. Host checks alone
  do not establish this acceptance.

## Implementation Notes

Diagnostic map: screen subset preparation starts as `REPLAY_EXPORT` with a local
correlation and records `REPLAY_OUTPUT` for output verification, `REPLAY_STALE`
for scope loss, or `REPLAY_UNAVAILABLE`/`UNKNOWN` only at the exact known
boundary. `renderer.shareReplayArtifact` retains its existing final
`REPLAY_HANDOFF` classification. The collection recipe is a fresh development
build and the local `Travel Life diagnostic` filter, searching only the action's
correlation; no source/media ID, URI, recipient, or raw native exception is
collected or retained.

### Diagnostic implementation map (2026-10-27)

| Operation / stage | Closed reason and outcome | Source boundary | Safe next action |
| --- | --- | --- | --- |
| `REPLAY_EXPORT / REPLAY_SCOPE` subset-preview start and committed-trip recheck | `START / unchanged`; an empty or superseded selected scope is `REPLAY_SCOPE_INVALID / unchanged` | `ReplayScreen.prepareSharePreview` before `preparePrivateReplay` | Reopen the current private Replay share choices. |
| `REPLAY_EXPORT / REPLAY_STALE` subset provider rejects a changed access/privacy scope | `REPLAY_SCOPE_INVALID / unchanged`, retryable | `PhotoAccessProvider.preparePrivateReplay` propagated through `ReplayScreen.prepareSharePreview` | Return to the trip choices and prepare from current scope. |
| `REPLAY_EXPORT / REPLAY_OUTPUT` subset renderer reports a verified-output failure | `SAVE_FAILED / unchanged`, retryable | `PhotoAccessProvider.preparePrivateReplay` / renderer result | Retain the full private Replay and retry preview. |
| `REPLAY_EXPORT / REPLAY_UNAVAILABLE` subset renderer is not available | `RESTRICTED / unchanged`, retryable | `PhotoAccessProvider.preparePrivateReplay` | Retain selection and full private Replay; retry on an available build. |
| `REPLAY_EXPORT / REPLAY_HANDOFF` explicit OS handoff of the already-previewed subset | existing `SAVE_FAILED / unchanged` for a failed immutable handoff copy | `ReplayScreen.sharePreparedSubset` to `exportPrivateReplay` / `renderer.shareReplayArtifact` | Keep both private previews and retry Share video. |

Each prepare-preview action and each Share video action generates one local
correlation ID. The screen records only the existing closed event fields and
never serializes trip keys, media keys, labels, URIs, recipients, or native
errors. Collection recipe: install a fresh development build, reproduce with
synthetic-safe media, filter the local process for `Travel Life diagnostic`,
then search only the displayed action correlation. Keep the resulting structured
event locally; do not export raw device logs or private media data.

## Spec Change Log

- 2026-10-27: Review tightened the non-frozen implementation detail around
  selection/preparation races, scope revalidation and source-access
  classification. The frozen owner flow and privacy bounds are unchanged.

## Review Triage Log

| Finding | Verdict / route | Evidence |
| --- | --- | --- |
| Edge: leave share review during preparation | high / patch | The captured selection generation was not incremented on abandon, so a late successful preparation could restore `share-preview` after cancellation. |
| Edge: two Preview presses | medium / patch | React state does not synchronously serialize two taps; the immediate single-flight guard was absent. |
| Edge: rapid distinct trip-card taps | medium / patch | Both handlers derived from stale rendered `shareTripKeys` after awaiting cleanup, so one intended selection could be lost. |
| Edge: stale Atlas selection | false | `mobile-screens.tsx` is concurrent M4.5 work, not reached or changed by this Replay route. |
| Edge: non-success publication acknowledgement | low / defer | This is unrelated concurrent M4.5 transport work; no Share Replay caller reaches it. |
| Edge: publication rejection diagnostic | low / defer | This is unrelated concurrent M4.5 controller work; no Share Replay caller reaches it. |
| Edge: delete fence activation race | medium / defer | This is unrelated concurrent M4.5 database work; no Share Replay caller reaches it. |
| Blind: abandon paths omit generation fencing | high / patch | Confirmed duplicate of the first edge finding; close/cancel and review exit require the same preparation fence. |
| Blind: stale selection calculation | medium / patch | Confirmed duplicate of the rapid-card edge finding; selection must update functionally before asynchronous disposal. |
| Blind: state-only preparation guard | medium / patch | Confirmed duplicate of the double-press edge finding; use an immediate ref guard. |
| Blind: navigation during native handoff | high / patch | Back/close could dispose the exact preview URI while `exportPrivateReplay` was copying it; navigation must remain in the share flow until settlement. |
| Blind: provider accepts stale selected keys | high / patch | `preparePrivateReplay` selected from all fresh input memories rather than the current included eligible composition, which can leak a changed scope into a generic failure. |
| Blind: screen soundtrack may differ from committed Replay | maybe-false / defer | The state loaded from the current Replay manifest is normally committed, but the diff alone cannot establish whether a durable working draft can diverge before full Replay replacement. Settle with a provider/session test that changes soundtrack after the parent artifact is prepared. |
| Blind: Select all uses length only | medium / patch | A stale/duplicate key can make a partial selection look complete; compare canonical candidate keys. |
| Blind: `REPLAY_ACCESS` becomes `UNKNOWN` | medium / patch | The source-resolution boundary is known and has a fixed stage, but the new preparation mapping did not give it an exact reason/copy branch. |
| Blind: staged publish reported complete | low / defer | Concurrent M4.5 publication work is outside this Replay-video selection intent and has a separate delivery record. |
| Blind: fenced response mapped to receipt conflict | low / defer | Concurrent M4.5 transport/controller work is outside this Replay-video selection intent and has a separate delivery record. |
| Blind: retry after delete fence is generic unavailable | low / defer | Concurrent M4.5 Edge Function work is outside this Replay-video selection intent and has a separate delivery record. |

The `patch` entries above were corrected and verified before this review closed:
the race entries are covered by four focused screen regressions, refreshed-key
validation by the provider regression, and source access by fixed-copy coverage.

## Design Notes

The full private Replay remains the durable parent. A selected subset is a
short-lived private derivative: selection is trip-level for recognition, while
the renderer receives its inherited committed media keys in order. The preview is
therefore the only artifact eligible for the subsequent explicit native handoff.

## Verification

**Commands:**

- `npm test -- --runInBand src/components/__tests__/replay-screen.test.tsx` from
  `apps/mobile` with the repository-local Jest cache -- expected: trip selection,
  preview lifecycle, diagnostic/redaction regressions pass.
- `npm test -- --runInBand src/components/__tests__/replay-renderer.test.ts` from
  `apps/mobile` with the repository-local Jest cache -- expected: verified
  immutable handoff contract remains green.
- `npm run typecheck` and `npm run lint` from `apps/mobile` -- expected: pass.
- `npm run check` from project root and `git diff --check` -- expected: pass.

**Manual checks:**

- On a fresh Android and iOS build, use synthetic-safe media to select one and
  all committed trips, watch each exact private subset, then open the system
  sheet. Confirm the selected cards are recognizable and no noncommitted trip or
  excluded media appears. Record platform/build freshness and only structured
  diagnostic correlation evidence.

### Implementation evidence (2026-10-27)

- Replaced media buttons with empty-first committed-trip cards. Each card shows
  an eligible committed cover/poster, trip title, date and checkbox state. The
  selected subset follows the committed Replay media/trip order (rather than
  album/manifest order) and keeps the committed soundtrack.
- Added a private `share-preview` state. Preparing a subset is explicit; only
  `Share video` calls the existing verified immutable OS-handoff boundary.
  Changing selection and returning from Preview both dispose the temporary
  preview; Preview Back retains the working trip selection.
- Follow-up race hardening fences every abandoned share flow, uses an immediate
  single-flight preparation guard and ref-backed trip intent, and blocks share
  navigation cleanup until the native handoff settles. The provider now rejects
  selected keys absent from its freshly loaded included/eligible/available scope
  as `REPLAY_STALE`, preserving caller order for valid keys.
- Focused screen suite: 66/66 and provider suite 52/52 passed with the
  repository-local Jest cache,
  including subset order, zero selection, preview-before-handoff, Back,
  handoff concurrency, stale-scope classification, action correlation and
  redaction sentinel checks. Renderer suite: 12/12 passed. Mobile typecheck and
  lint passed. Root `npm run check` passed 25 foundation tests and eval smoke;
  `git diff --check` passed.
- A first focused screen command used a package-root path and omitted the local
  Jest cache, so it stopped at the known sandbox Temp-cache `EPERM` before test
  collection. The corrected repository-local-cache rerun passed; the incident
  is recorded in the error playbook.
- Owner-operated Android/iOS acceptance remains open. Install a fresh build,
  use synthetic-safe media, and collect only the structured action correlation
  through the documented local filter; host tests do not prove card recognition,
  the exact physical preview, or target-system handoff.

### Chapter-only committed-trip correction (2026-10-27)

- Owner evidence showed only Taiwan in Share Replay although the private Replay
  had additional chapters. The card selector was incorrectly derived from the
  nonempty media subset rather than the committed Replay chapter scope.
- TDD RED: the focused screen suite failed when a committed `chapter-only`
  group was absent from `shareableCommittedTrips`. GREEN: 66 screen tests and
  53 provider tests pass after candidate cards derive from ordered included
  groups and provider subset preparation receives the selected group keys.
- The selected preview retains every selected committed chapter, including a
  truthful card-only chapter, while rendering only currently eligible committed
  media. A removed or excluded selected group is still rejected as
  `REPLAY_STALE`. Mobile typecheck and lint pass; owner Android confirmation is
  pending.

### Bounded Share-screen media correction (2026-10-27)

- **Diagnostic map:** `REPLAY_EXPORT / REPLAY_SCOPE / REPLAY_SCOPE_INVALID`
  covers a changed/excluded selected group at
  `PhotoAccessProvider.preparePrivateReplay`. Existing `REPLAY_ACCESS`,
  `REPLAY_OUTPUT`, and `REPLAY_UNAVAILABLE` mappings continue to cover local
  media resolution and renderer/output boundaries. The correction adds no new
  native call or diagnostic payload: it derives selected media from the freshly
  loaded local committed manifest. For owner collection, filter the current
  Android process only for the action's `REPLAY_EXPORT` correlation; never
  export raw media or renderer logs.
- **Regression guarantee:** selecting multiple committed trips must render all
  media committed to every selected trip, even if the Share screen had only
  resolved preview availability for an earlier trip.
- **TDD evidence:** The provider reproducer was RED with a two-trip manifest:
  the renderer received the first trip's media and `[]` for the later trip.
  It is GREEN after fresh-plan derivation; the combined provider and screen
  suites pass 129 tests, and mobile typecheck/lint pass. Device verification
  remains required before claiming the owner-visible video is fixed.

### Independent re-review findings (2026-10-27)

Owner requested verification of the other session's implementation. Four review
lenses inspected the current uncommitted Replay flow against this spec. Scope:
seven screen/provider/renderer/diagnostic and regression-test files, excluding
concurrent M4.5 publishing. Review only: no runtime corrections were applied.
The flow exists, but the following open items supersede the earlier done status.

- [x] [Review][Patch] Card-only selection now gates on selected committed trips rather than media keys; the screen regression exercises the actual Preview action with an empty selected-media list.
- [x] [Review][Patch] Shared native-return helper advances the selection generation before cleanup for `beforeRemove`; visible Back and hardware Back use the same helper.
- [x] [Review][Patch] Subset preparation reads `input.soundtrack`, the committed parent soundtrack, rather than the working editor music state; the card-only action regression asserts its exact custom track.
- [x] [Review][Patch] Stale provider handoff failures now retain `REPLAY_STALE` through the screen's closed `REPLAY_SCOPE_INVALID` diagnostic without serializing the error.
- [x] [Review][Patch] Provider coverage now exercises a successful selected normal plus card-only chapter composition, exact committed media order, and supplied committed soundtrack. This is synthetic-host renderer evidence only.
- [x] [Review][Patch] Export now rechecks refreshed photo access before touching the handoff artifact. The provider regression proves denied scope returns typed `REPLAY_STALE` and does not read the preview file; device reproduction remains required.
- [x] [Review][Defer] Unverified concurrent committed-media exclusion case (`photo-access/provider.tsx:763-767`). Fresh selected-key validation checks eligible/available album membership, including an item with `intent: exclude`, instead of the current committed plan. No ordinary owner path changing that committed media while retaining these share choices was established. Settle with a controlled composition-change/provider integration test before grading this as a reachable defect.

#### Per-layer triage

| Finding | Verdict / route | Verification |
| --- | --- | --- |
| Blind: card-only Preview | medium / patch | Nonempty trip choice can produce empty memoryKeys; line 390 returns without UI recovery. |
| Blind: native Back late result | medium / patch | Both native return handlers omit the generation increment present on the visible Back control. |
| Blind: working soundtrack | medium / patch | Settings Done updates music; Back retains the old video; subset consumes the edited music. |
| Blind: handoff-cache retention | low / rejected | Copies deliberately survive for asynchronous native consumers and OS cache eviction. No concrete disk failure or new retention requirement was established; a new eviction policy is beyond a direct correction in this review. |
| Edge: card-only Preview | medium / patch | Same verified guard defect as Blind. |
| Edge: native Back late result | medium / patch | Same verified generation defect as Blind. |
| Edge: fresh excluded media membership | maybe-false / defer | Membership accepts eligible available intent-excluded items, but a normal retained-selection interleaving remains unproven. |
| Edge: working soundtrack | medium / patch | Same verified working-versus-committed state defect as Blind. |
| Verification: successful provider chapter regression | medium / patch | Provider tests reject stale cases; screen mocks replace the provider and helper coverage cannot prove actual manifest chapters. |
| Verification: card-only Preview | medium / patch | Same verified guard defect. |
| Verification: native Back late result | medium / patch | Visible-button cancellation regression does not invoke either native handler. |
| Acceptance: committed soundtrack | medium / patch | Violates committed soundtrack AC through a reachable Edit/Done/Back flow. |
| Acceptance: access change before dispatch | high / defer | Existing registered-artifact fast path checks lifecycle but not refreshed permission; access-change acceptance remains open. |
| Acceptance: stale handoff diagnostic | medium / patch | Known stale provider error is collapsed by the new catch into UNKNOWN. |

Grouped outcome: five patch action items, two deferred items (one unverified),
one rejected finding. No product decision is required. Runtime changes remain
outside this owner-requested review. No sprint story key was established, so
sprint tracking was not changed.

#### Fresh validation

- Mobile typecheck and lint passed.
- Provider 53/53 and renderer 12/12 tests passed. The initial three-suite run
  failed only the existing durable-cache-open screen test at its 5-second limit
  (130 passed, 1 timeout). Running the screen suite alone with a repository-local
  cache passed 66/66 without changing code or increasing the timeout. Exact cause
  of the first timeout remains unknown; do not report the aggregate run as green.
- Root `npm run check` passed framework integrity, 25 foundation tests and eval
  infrastructure smoke. None of these tests verifies the open action items or
  actual Android/iOS acceptance.

### Review patch completion (2026-10-27)

- `REPLAY_EXPORT / REPLAY_SCOPE`: selected committed group keys are the screen
  continuation gate, including zero-media chapters; selected media remain in
  committed order. `REPLAY_EXPORT / REPLAY_HANDOFF`: provider refreshes current
  photo permission immediately before external handoff and throws a closed stale
  outcome after scope loss. The screen preserves that stale classification as
  `REPLAY_SCOPE_INVALID / REPLAY_STALE / unchanged`; unknown handoff errors
  remain `UNKNOWN / REPLAY_HANDOFF`.
- Focused replay-screen test: 69/69 and provider test: 55/55 pass with
  `.jest-cache-codex`; mobile TypeScript passes. The first rerun failed only a new test's generated label
  assertion (`Card-only trip trip 1`); no runtime code failed, and the exact
  accessible label was corrected before the green rerun.
- Collection recipe remains: fresh Android/iOS development build, synthetic-safe
  media, local `Travel Life diagnostic` filter, then only the action correlation.
  Device recognition, physical preview, permission-change handoff and target
  sheet behavior are still unverified owner-operated acceptance.

### Final review closure (2026-10-27)

All review findings that required an implementation change are closed. The
follow-up patch makes Select all compare the canonical committed-trip key set,
rejects a selected media/group mismatch as `REPLAY_STALE`, refreshes the live
permission and exact registered-artifact membership before native handoff, uses
the committed soundtrack in the Share Preview copy, clears stale card state,
and lets navigation finish even if best-effort preview cleanup fails.

The prior handoff-cache-retention concern remains rejected: asynchronous native
consumers require the verified copy to survive the immediate Share call. The
previously unproven excluded-media interleaving is now covered by the stricter
selected-media/group membership check and its provider regression; no deferred
host-code finding remains. Owner-operated Android/iOS visual and chooser
acceptance is still required and is not represented as a passing host check.

Final host validation: screen 72/72, provider 56/56 and renderer 12/12; mobile
typecheck and lint; root `npm run check` (25 foundation tests plus eval smoke);
and `git diff --check` all passed.

### Share-card bounded-cover correction (2026-10-27)

- **Cause:** The opening Replay manifest intentionally resolves only a bounded
  preview page. Share trip cards used that list directly, so later committed
  trips could have eligible media and export correctly while displaying a
  generic card cover.
- **Correction:** `ReplayScreen` now pages only the committed media needed to
  give each coverless trip one local cover, in batches of 48. These optional
  preview reads update presentation state only; committed membership, media
  order, soundtrack and `preparePrivateReplay` composition remain unchanged.
  A private-source/page failure leaves the truthful fallback card rather than
  hiding or changing a trip.
- **Diagnostic and verification:** This reuses the existing local paged-preview
  boundary; no new native/export fallible boundary or diagnostic payload was
  introduced. The new screen regression starts with a later trip lacking a
  manifest `previewUri`, asserts the private paged read and its rendered video
  poster, and passes with the screen suite at 73/73. Provider 57/57, mobile
  typecheck/lint, root `npm run check`, and `git diff --check` pass. Owner
  Android/iOS visual confirmation remains required.

### Share-card owner re-report correction (2026-10-27)

- **Device-representative cause:** The earlier cover regression modeled only a
  missing URI. On the owner flow, the bounded opening manifest also reports
  later media as `available: false`. The initial cover loader consequently
  never requested that private preview; after it was requested, the card helper
  still read from the opening-page export-memory list instead of the returned
  cover candidate.
- **Correction:** Card-cover discovery now derives local candidates from every
  eligible included trip that lacks a committed resolved item, regardless of
  transient initial availability. `shareableCommittedTrips` uses that local
  candidate result only for its card imagery. Share selection and
  `preparePrivateReplay` continue to use committed group/media scope.
- **Verification:** The focused RED test begins with the second trip's only
  media marked unavailable and without a URI; it proves the page request and
  then its video poster. It is GREEN. Screen 73/73, provider 57/57, mobile
  typecheck/lint, root `npm run check`, and `git diff --check` pass. Reload a
  fresh Android/iOS build and confirm every visible trip card gets its cover.

### Shared trip-card migration (2026-10-27)

- **Scope:** The recognizable Share Replay trip card is now the shared
  `TripListCard` component used by Share Replay, the Edit Replay trip overview,
  and the Atlas Timeline. Existing actions remain intentionally distinct:
  sharing toggles a committed trip, editing opens that trip's media grid, and
  Atlas opens the selected journey preview.
- **Privacy and diagnostics:** The card accepts a caller-owned cover node and
  never resolves media itself. Replay retains its existing paged preview path;
  Atlas requests one existing authorized local preview for every currently
  visible Timeline journey, with at most four reads in flight and no omission
  cap. A failed optional cover leaves the truthful `TRIP` fallback; it does not
  hide the journey or change selection. This is presentation over existing
  provider boundaries, so no new diagnostic operation or payload is added.
- **Verification:** Atlas regression covers two visible journeys with distinct
  photo/video local covers and preserves the selectable card behavior. Replay
  screen regression retains its overview and Share selection coverage. Physical
  Android/iOS visual confirmation is still needed for spacing and thumbnail
  rendering.
