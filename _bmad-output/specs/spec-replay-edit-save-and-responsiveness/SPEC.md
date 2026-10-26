---
id: SPEC-replay-edit-save-and-responsiveness
updated: '2026-10-26'
companions:
  - experience-and-state.md
  - architecture-and-persistence.md
  - implementation-plan.md
  - verification-and-rollout.md
  - brownfield-and-precedence.md
  - ../../../docs/product/design-system.md
  - ../spec-m4-7-travel-life-replay/SPEC.md
  - ../spec-replay-soundtrack-and-month-order/SPEC.md
  - ../spec-replay-soundtrack-and-month-order/behavior-and-acceptance.md
  - ../spec-replay-finalization-and-fullscreen-audio/SPEC.md
sources:
  - ../../implementation-artifacts/replay-edit-flow-review-2026-10-26.md
---

# Replay edit integrity, responsiveness and lean navigation

> Canonical contract. Read this kernel and every companion. Scope-specific precedence is explicit in brownfield-and-precedence.md. This is a detailed implementation specification, not evidence that the mobile changes have shipped.

## Why

The owner cannot reliably finish normal consecutive Replay edits: editing a trip, excluding another, choosing audio and tapping Done can leave saves waiting and Update Replay disabled. Gallery and audio loading compound this friction. Preserve the accepted trip-first visual editor while making working edits coherent, saves recoverable, loading incremental and one aggregate update predictable.

## Capabilities

- **CAP-1**
  - **intent:** The owner can edit multiple trips as one recoverable private composition.
  - **success:** Exclude A, edit B, navigate away and return without restoring A or dropping B; restart restores the last acknowledged draft, including music and order.
- **CAP-2**
  - **intent:** The owner can keep navigating while edits save safely.
  - **success:** Save scheduling retains at most one active and one latest pending snapshot; all waiters settle without duplicate writes, false saved status or forced release of native ownership.
- **CAP-3**
  - **intent:** The owner can request one aggregate update without managing autosave.
  - **success:** Update accepts a request during a pending save, includes all selected intent, verifies one immutable durable snapshot and renders one replacement. Repeated taps do not submit another commit/render.
- **CAP-4**
  - **intent:** The owner can recognize and browse large trip albums promptly.
  - **success:** Visible tiles receive incremental previews ahead of offscreen work; slow assets do not block ready tiles, and complete eligible membership, selection, scroll and retry remain available.
- **CAP-5**
  - **intent:** The owner can choose local music and reverse unconfirmed settings easily.
  - **success:** File readiness is distinct from draft persistence; settings Done applies valid settings, settings Back cancels its subdraft, and applied working music survives overview Back and acknowledged-draft restart.
- **CAP-6**
  - **intent:** The owner can recover a slow, failed or conflicting save without losing intent.
  - **success:** Queued, running, definitely failed, conflicting and outcome-unknown operations have distinct safe recovery; navigation remains reachable and late callbacks cannot revive discarded edits.
- **CAP-7**
  - **intent:** The owner can understand the editor through recognizable content and familiar controls.
  - **success:** Fixed Back/title/Done, All/Selected/More, checkmarked media, independent trip inclusion and one aggregate primary action fit target phone widths and large text without instruction-heavy screens.
- **CAP-8**
  - **intent:** The owner can distinguish draft changes, previous playback and a verified updated Replay.
  - **success:** Exact version identity controls playback promotion/cache/share; progressive chapters remain partial, and deliberate selected sharing uses reviewed committed verified output only.
- **CAP-9**
  - **intent:** Existing owners can upgrade without losing valid Replay choices or violating privacy.
  - **success:** Additive migration preserves legacy working/committed selection, order, soundtrack and valid artifacts; current privacy, source-access, lifecycle and correction gates remain authoritative.
- **CAP-10**
  - **intent:** The owner receives a demonstrably smoother end-to-end flow.
  - **success:** The acceptance matrix, contention/race regressions and release-like Android/iOS owner-operated scenarios pass; measured responsiveness meets the declared targets or remains explicitly open.

## Constraints

- Current policy-visible Journey List and effective album attachments remain canonical. Replay exclusion changes presentation only; never alter trip facts, source media or sharing consent. Unknown/undated candidates and explicit owner choices cannot be silently omitted or backfilled.
- Keep one-action Replay, trip overview/gallery, zero-selected trip cards, current chapter timing and Unicode quality, confirmed/corrected month ordering, selected soundtrack, one verified AAC stream and player-only mute. No silent final output fallback or original-video audio mixing.
- Own and serialize all native transactions; release only after actual settlement. A JavaScript deadline is not cancellation of SQLite. Never retry an unresolved mutation without operation/version reconciliation.
- Update renders only after exact complete-snapshot readback; thumbnail readiness cannot redefine composition or cache identity. No per-tap encoding.
- Keep private media/audio/cache local. No private names, paths, tokens, SQL, raw errors or content enter diagnostics. Only the selected audio basename may appear locally to identify a file the owner chose; it is never diagnostic data.
- Preserve one vertical gallery scroll owner, safe-area navigation and distinct include/open/inspect targets. Use short contextual status and real progress, not instructional paragraphs or invented percentages.
- Engineering defaults, limits and validation commands are specified in companions. Device evidence is required; host tests/mockups cannot close the existing save incident.

## Non-goals

- Rebuilding trip reconstruction, replacing the renderer, changing chapter timing/quality, adding a general video editor, cloud music, streaming catalogs, analytics services or a second database.
- Claiming unsaved memory survives OS termination, making a blocked native writer disappear through UI timeout, or publishing/sharing automatically.
- Mobile implementation, build/install/server manipulation, commits/pushes or deployment in this planning-only task.

## Success signal

On Android and iOS, the owner edits A, excludes A, edits B, chooses valid music, taps Done and Update once, then receives an accurately updated audible Replay. Tiles and navigation respond promptly; a held writer produces recoverable truthful state rather than an indefinitely disabled action. Reopen/restart and exact selected sharing preserve the same composition and privacy boundaries.

## Assumptions

- The accepted review solution authorizes this scoped refinement of Update gating, settings subdrafts and visible overview inclusion. Predecessor rules outside those boundaries remain unchanged.
- Latency targets, cache budgets and scheduler constants are initial engineering acceptance targets; none is a measured baseline or guaranteed OS/provider latency.
- No unresolved product question blocks implementation. Native lock attribution, thumbnail capability and real-device performance remain explicit S0/S4/S7 engineering investigations with stop conditions.
