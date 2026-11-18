- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: V1.1 base-distance qualification does not yet deduct retained location or Home-area uncertainty radii.
  evidence: The current threshold compares point distance only; a detector-policy change needs bounded uncertainty inputs and dedicated evaluation before changing automatic trip decisions.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: V1.1 persists unqualified internal journey candidates although the Atlas reveal hides them.
  evidence: `reconstruction_journey` stores candidate projections while `loadDurableReveal` filters to confirmed qualification rows; separating detector candidates requires a migration and correction/remap review.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: Persisted source-provenance qualification needs a full reconciliation-loop fixture.
  evidence: The adapter now preserves explicit non-capture origins and focused tests pass, but the database-loop test double needs a dedicated durable-write assertion before treating this as measured end-to-end coverage.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Add a SQLite-to-Atlas regression for committed country labels and month-range periods.
  evidence: The concurrent continuity change derives those summaries in `loadDurableReveal`, but current tests inject the display record directly and can miss a broken repository association or SQL day projection.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Exercise Home-base rename and confirmed removal from the settings screen through provider rebuild paths.
  evidence: The concurrent Home-base UI renders both actions, but its focused screen test currently covers only creation and direct repository tests do not prove button wiring or confirmation.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Specify and implement a distinct Timeline surface or explicitly retain the map-plus-list behavior.
  evidence: The pre-existing Map/Timeline toggle hides the map but leaves the list continuously mounted; changing that interaction requires a dedicated UX decision.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Fail country labels closed when supported place evidence includes border or invalid resolver results.
  evidence: `resolvePlaceCountryCode` currently ignores abstaining members despite its documented abstention rule.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Complete V1.1 qualification provenance, media-type, session, configured-Home and coordinate-bearing-base integration.
  evidence: The concurrent qualification adapter still promotes source origins, treats episode evidence as images, derives sessions from days, ignores configured Homes at final qualification, and uses a possibly GPS-less representative as a base coordinate.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Make Home-base mutation refresh/error handling and video review behavior truthful.
  evidence: A failed rebuild can leave the Home-base list stale, stale UPDATE/DELETE commands report success, and a video preview is currently rendered through an image component.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-map-visibility.md`
  summary: Replace the development-only MapLibre demonstration tiles with an approved production map-source decision.
  evidence: The visible local fallback is provider-free, but the optional native development enhancement intentionally still uses disclosed MapLibre demo tiles.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-map-visibility.md`
  summary: Deliver the complete wide native Atlas composition with persistent destination drawer, compact utility controls, and orientation tools.
  evidence: The browser prototype has the two-zone map/list composition, while the native screen remains a mobile-first vertical stack.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-readable-cartography.md`
  summary: Prove that all generated offline atlas assets are included by the eventual delivery commit/clean checkout.
  evidence: The active renderer and focused test resolve the generated registry/assets in this explicitly preserved dirty worktree, but this implementation task is not authorized to stage or commit concurrent untracked work; a delivery review must check the complete generated asset set in a clean checkout.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-m4-3-private-visibility-and-exclusion.md`
  summary: Normalize native visit ordering at the split-command adapter and verify an owner split end to end.
  evidence: M4.3 fixture setup exposed persisted reconstruction_visit ordering `ordered` being passed into a split check expecting `chronological`. M4.3 did not change that pre-existing adapter; seeded persisted-split tests prove privacy exclusion/restoration only, not native split acceptance.

## Deferred from: code review of spec-share-replay-trip-selection (2026-10-27)

- Existing `photo-access/provider.tsx:984-986` registered-artifact export bypasses refreshed photo-access checks. The trip-selection patch did not introduce that gate, but the spec's access-change acceptance remains incomplete. Add final scope revalidation and a permission-change integration regression; actual owner-device behavior remains unverified.
- Unverified concurrent committed-media exclusion: `photo-access/provider.tsx:763-767` accepts eligible/available album keys even if marked `intent: exclude`. A normal flow changing committed media while retaining these selected keys was not established; use a controlled composition-change/provider integration test to establish reachability and impact before treating this as a confirmed defect.
- source_spec: `_bmad-output/implementation-artifacts/spec-defer-hosted-sharing-ui.md`
  summary: Confirm on a connected iOS device that hosted-link affordances are absent and the local Replay Share video handoff remains available.
  evidence: Source and host checks establish route removal, but physical iOS navigation and system-share behavior require an available device.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-fix-mobile-ci-privacy-deletion-assertion.md`
  summary: Reconcile M5 launch and beta acceptance criteria with the approved MLP deferral of hosted sharing and browser viewing.
  evidence: The epics overview declares older hosted-sharing wording superseded, but M5.3/M5.4 and the derived backlog still require hosted snapshot/media and browser-viewer deployment.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-fix-mobile-ci-privacy-deletion-assertion.md`
  summary: Resolve M6/M7 future account, retention, restore-selection, and offline revision-activation semantics.
  evidence: A review of concurrently edited P0-next planning raised possible gaps in consent withdrawal, retention, recovery and cross-device activation; the planning owner must confirm intended behavior before implementation.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-fix-mobile-ci-privacy-deletion-assertion.md`
  summary: Confirm the intended M9 Google Photos dependency on the M8 shared connection boundary.
  evidence: The review alleged that M9.1 blocks Photos on Drive work, while the current plan explicitly says M9 depends on M8's shared connection boundary; planning-owner clarification is required.

- source_spec: `spec-m7-unified-history.md`
  summary: Correct account Replay composition availability checks and session cache accounting/capacity without dropping committed media.
  evidence: Independent reviewers show excluded unavailable candidates fail the pre-plan guard; missing cached files retain old size before replacement accounting; all-candidate resolution can exhaust256MiB. Pre-existing defects; synthetic regressions and bounded policy needed.
- source_spec: `spec-m7-unified-history.md`
  summary: Fence progressive and final persisted account Replay publication against remote authority changes and reclaim created chapters on stale exits.
  evidence: Callback precedes final authorization, and asynchronous copy/CAS follows that final check; stale assembled-output disposal omits created chapter files. High pre-existing privacy risk; whole M7 release acceptance remains open.
- source_spec: `spec-m7-unified-history.md`
  summary: Carry initiating Replay action correlation through account media resolver and nested authorization refresh.
  evidence: Existing resolver/auth and history transport generate independent correlations, while new provider events share only screen action correlation. Add compatible optional context propagation and correlation/redaction tests.

- source_spec: `spec-m7-unified-history.md`
  summary: Harden account binding replacement failure recovery and classify every rebind boundary.
  evidence: Existing intent advances and old media disposes before fallible replica/build; failed/concurrent replacement regressions absent. Source compiler fix preserves these semantics; test complete replacement staging/disposal and durable closed diagnostics.
- source_spec: `spec-m7-unified-history.md`
  summary: Audit account repository read/write ownership beyond the existing mutation proxy set.
  evidence: Stage/reset/prepared writes bypass current proxy mutation accounting; captured raw reads lack source fences, but a visible post-signout publication remains unverified due provider/screen fences. Add actual stale callback/pending read tests before claiming a privacy leak fixed.
- source_spec: `spec-m7-unified-history.md`
  summary: Separate committed Replay cleanup failures from artifact persistence rollback and classify absent account derivatives explicitly.
  evidence: Obsolete chapter deletion after durable save enters shared cleanup catch deleting new artifact; missing eligible derivative becomes generic REPLAY_ACCESS. Existing code predates atomic source binding correction and needs failure/CAS/preserved-content regression.

## Deferred from: source-media timeout review (2026-11-08)

- Pre-existing createHistoryTransport session-provider rejection normalization and HTTP401/403 classification precedence need dedicated redaction/Auth regression coverage. Current change is exact source-media SQL/deadline classification; no evidence these caused the native mapping timeout. Preserve owner/session fences and normalize before generic payload parsing in a separate bounded transport fix.
- Source-media API enumerates all24-item pages and rescans the immutable aggregate per page. Current query fix bounds each request and measures complete125-page synthetic flow; a versioned targeted mapping/read session may further reduce total latency. Do not bypass authoritative sourceCopies, privacy membership or revision joins to optimize it.

- source_spec: `spec-m7-unified-history.md`
  summary: Reconcile or explicitly expose saved media work before reporting an empty committed Replay as fully synchronized.
  evidence: Pre-existing empty-plan early return occurs before durable job read; regression should seed an unknown-ack pending job with an empty current Replay and assert honest completion/reconciliation semantics.
- source_spec: `spec-m7-unified-history.md`
  summary: Reconcile an existing soundtrack upload derivative or receipt without requiring the unavailable original first.
  evidence: Existing local soundtrack resolution precedes pending job reconciliation; restart with a durable soundtrack job and missing original needs a focused recovery contract/test.
- source_spec: `spec-m7-unified-history.md`
  summary: Bound retained source mapping data and reduce whole-history enumeration work for small selected Replay scopes.
  evidence: Existing API returns24-item pages and client retains every source page; full125-page synthetic benchmark86.317s is measured,240000-item maximum behavior is not established.
- source_spec: `spec-m7-unified-history.md`
  summary: Track which nested media failure was diagnosed rather than suppressing every later failure with one managed boolean.
  evidence: Existing managed flag covers async prepare/upload and can suppress distinct cleanup/permission failures; force both nested and secondary failure with correlated closed-event assertions.
- source_spec: `spec-m7-unified-history.md`
  summary: Validate manual media picker response page matches the requested page.
  evidence: Pre-existing choose(page) validates shape but not result.page equality; a valid different page must be rejected without displaying wrong memories.
- source_spec: `spec-m7-unified-history.md`
  summary: Validate resumed completed-checkpoint activation acknowledgement with the same contract as normal transfer completion.
  evidence: Pre-existing sendTransferJob completed-request branch returns activation response without the normal expected-status validation; malformed resumed acknowledgement needs regression coverage.

- source_spec: `spec-m7-unified-history.md`
  summary: Bound waits for non-abortable account verification or response parser work without claiming underlying cancellation.
  evidence: Existing 30s AbortSignal does not settle an arbitrary provider/JSON promise; current change classifies observed expiry without a wall-clock guarantee. Reproduce a never-settling read and design a stale completion fence before changing lifecycle.
- source_spec: `spec-m7-unified-history.md`
  summary: Fence final readiness against off-then-on media consent revisions and stale acknowledged attachment availability.
  evidence: Existing final status compares booleans/account/source/aggregate, while withdrawal deletes attachments. Restore consent can match the old booleans, so positive revision from mapping is not a full availability guarantee. Verify actual consent generation or reauthorize selected copies in a separate bounded protocol revision.

- source_spec: `_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md`
  summary: Measure capture-session precision against full eligible chronology and independently corroborated mixed-city evidence.
  evidence: The representative budget can omit bridging captures. The preserved named-route path also ignores competing civic groups and excludes their photos from the album. Compare both cases with reviewed multi-stop and repeat-trip controls before changing arbitration or sampling.
- source_spec: `_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md`
  summary: Evaluate whether a small Home district should suppress a city-level proposal based on the city's public anchor.
  evidence: The existing Home check can withhold support when that anchor is within Home and the named stop is outside it. Use owner-reviewed routine and away captures with district Home settings to establish the desired behavior.
- source_spec: `_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md`
  summary: Establish native Hanoi named-landmark recognition before claiming a full city-level route for that library.
  evidence: The default native visual index is Ewha-only, and the Hanoi provider test injects a landmark observation. A qualified regional artifact and independent native positives are still required.
