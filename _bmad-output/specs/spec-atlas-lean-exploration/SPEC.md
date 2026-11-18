---
id: SPEC-atlas-lean-exploration
companions:
  - experience.md
  - state-and-navigation.md
  - implementation-and-diagnostics.md
  - acceptance.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources:
  - ../../implementation-artifacts/atlas-ux-party-review-2026-10-30.md
---

# Lean Atlas exploration

Date: 2026-10-30. Status: specified for implementation; runtime and device acceptance pending.
The owner approved the party proposal including Home. This specification and its
companions define one delivery contract; detailed defaults below are engineering
choices, not claims of native validation. Derived from this folder's decision log.

## Why

Atlas currently puts verbose statistics and explanations ahead of the map, repeats
the full journey list in Map mode and places Replay after that list. The owner
finds the information below Settings cluttered. Restore a recognizable, calm
exploration surface with clear Home/Settings, concise information and reachable
actions while preserving evidence honesty and private history.

## Capabilities

- **CAP-1**
  - **intent:** Owners understand where they are and can reach landing and Settings.
  - **success:** One Your Atlas title, labeled Home and Settings; Home opens the explicit landing and View my Atlas returns without onboarding or new source work.
- **CAP-2**
  - **intent:** Owners understand the scope of visible history without reading a report.
  - **success:** One concise scope summary and Details replace the ready-state paragraph stack; exact filtered totals and separate inferred/manual statistics retain truthful meanings.
- **CAP-3**
  - **intent:** Owners explore journeys geographically or chronologically without duplicate feeds.
  - **success:** Compact Map and Timeline have distinct main content, shared year/search and synchronized selection; unknown locations and overlapping markers remain reachable.
- **CAP-4**
  - **intent:** Owners can replay their history or add a journey without searching a long page.
  - **success:** Eligible ready-state Replay is reachable independent of list length; Add journey stays secondary; Atlas filters never silently change Replay composition.
- **CAP-5**
  - **intent:** Owners recognize a journey, inspect media and reach corrections in context.
  - **success:** Photo-led rows and focused previews show title, period and concise evidence state; media, Edit and details are accessible without explanatory walls.
- **CAP-6**
  - **intent:** Owners understand current work or recovery and can take the useful next action.
  - **success:** One prioritized compact status replaces stacked notices; loading, sparse, blocked, failed, unknown acknowledgement and filter-empty states stay distinct.
- **CAP-7**
  - **intent:** Owners resume exploration after an adjacent task without losing their place.
  - **success:** Home, Settings, Replay, gallery and Edit returns retain valid view/year/query/selection/camera/list position; revoked or cross-owner content is never restored.
- **CAP-8**
  - **intent:** Owners can use a coherent Atlas comfortably across supported sizes and accessibility settings.
  - **success:** Atlas-specific styling, bounded content/media work, reachable safe-area controls, large text and reduced motion pass the acceptance matrix on available native devices; missing platform evidence remains open.

## Constraints

- Follow Living Atlas lean/self-serve principles and Atlas-only navy/glass/cyan styling; preserve decision0013 cartography and its deferred chrome.
- Home is the explicit /welcome destination; automatic / entry resolution remains separate. No permission, import, enrollment or storage write is authorized by opening Home or Details.
- Keep inferred evidence, owner claims, observed dates, missing locations and privacy-visible records distinct. Never invent country totals, travel routes, progress or owner presence.
- Preserve current account/local authority, source removal, corrections, background consent, Replay input/order/soundtrack and deliberate native MP4 sharing. No feature-gate changes.
- Use only the closed diagnostic boundary, exact action correlations and content-free failure classification. Implementation must satisfy the adopted diagnostic policy.
- Scope new styles to Atlas; shared Replay/Share/Settings visuals must not change accidentally. Inspect and preserve concurrent dirty changes.

## Non-goals

- Reconstruction, clustering, sync, storage schema or source-consent redesign; new AI processing, telemetry or cloud transfer.
- Hosted sharing, new map provider, globe/terrain/routes, decorative controls, global tabs or a new statistics dashboard.
- Redesign of landing, Replay editor, Settings tasks or journey correction semantics; their Atlas entry/return integration is in scope.

## Success signal

On a representative phone, an owner opens Atlas, recognizes the map without
scrolling through explanations, finds a journey by year/search, views its media,
returns to the same context and starts Replay without traversing the list.
Home and Settings roundtrips preserve that context. Empty and failed states offer
an understandable recovery. Acceptance evidence distinguishes host checks from
actual Android/iOS observation.

## Assumptions

- A-1: English product copy continues; discussion/document decisions do not add localization scope.
- A-2: Below768 logical px, Map or Timeline owns the main pane; wide mode may show map/list together only when both remain usable. No always-expanded second list on compact Map.
- A-3: Start with16px horizontal gutter,8px spacing rhythm,48px minimum interactive targets and200% text validation; adjust from native evidence without shrinking controls.
- A-4: Ready Replay uses a safe-area bottom action region; the keyboard temporarily replaces that region, which returns on dismissal.
- A-5: Existing full Replay semantics stay unchanged; no filtered Replay mode is introduced.
- A-6: Extend existing ephemeral navigation context for query/list position; do not persist private search, coordinates or IDs in URLs, logs or generic storage.

No blocking product questions remain. Detailed native fit and platform acceptance
are implementation/validation work, not already established outcomes.
