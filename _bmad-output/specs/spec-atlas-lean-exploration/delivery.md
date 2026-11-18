# Lean Atlas delivery — 2026-11-09

Status: implemented core UI, acceptance open. The approved SPEC and companions
remain the requirements. Changes were applied to the existing dirty checkout,
without staging, resetting, publishing, or touching owner data.

- Home / Your Atlas / Settings; modal Details contains coverage and totals.
- Compact Map and Timeline render separate content with shared search/year,
  year sheet, a location-unknown path, bounded overlap sheet, and cover batches.
- Atlas-specific actions and safe-area Replay footer, hidden on keyboard events.
- Media-first preview, expandable dates/evidence, gallery return and Edit.
- Navigation handoff carries query, camera, selection and scroll offset; only the
  same provider controller can consume it. No search or coordinates in routes.

Diagnostic implementation: AtlasReveal reports ATLAS_MAP/MAP_STYLE with
MAP_STYLE_UNAVAILABLE on native style failure; ATLAS_PREVIEW/PREVIEW_READ on
selected detail errors; ATLAS_PREVIEW/PREVIEW_MEDIA for failed Timeline cover
batches. The latter two classify errors in memory. Recovery leaves the durable
record unchanged. Stale requests are suppressed. The synthetic locked-database
test asserts classification and checks that the native sentinel reaches neither
the event nor recovery text. The collection recipe remains in
implementation-and-diagnostics.md; Android package is com.anonymous.travellife.
Full cross-layer action correlation and the complete failure matrix remain open.

Evidence: root check 199 tests plus framework/eval smoke; mobile suite 106 suites /
1127 tests before the final responsive map/overlap refinement; subsequent focused
Atlas/owner/onboarding run 55 tests. TypeScript and lint checked after refinement.

Acceptance remained open after the initial implementation. See the continuation
evidence below for the current state.

Continuation plan: use a fixed 24-row page with an in-memory page anchor and
ordinal fallback. Allow map and list together only at a usable effective width.
Paging, layout and anchor resolution are synchronous. Cover reads still use
ATLAS_PREVIEW/PREVIEW_MEDIA at the existing bounded batch boundary, with no new
storage, provider requests, or logging of page anchors.

Selected-preview diagnostic refinement: AtlasReveal emits START and COMPLETE
at ATLAS_PREVIEW/PREVIEW_READ with the same action correlation as the classified
failure. A superseded or disposed pending read terminates at PREVIEW_LIFECYCLE
with SKIPPED and no retry. No extra logs are emitted per Timeline thumbnail.

## Continuation evidence

- At 768 effective logical pixels, Map and Timeline can render side by side.
  The effective width accounts for font scaling. A component test checks both
  panes at wide width and the compact fallback at larger text.
- Timeline mounts at most 24 rows per page, with previous and next controls.
  Its cover read queue is scoped to the current page. In-memory navigation
  restores the page containing the anchor. If the anchor disappears, it uses
  the same ordinal, clamped to the last available journey. Component coverage
  exercises navigation, remount and deletion of the page anchor.
- Restricted access takes precedence over preparation. A queued update failure
  uses the catch-up action instead of stacking rebuild recovery on top of it.
  The map releases page scroll ownership when it unmounts.
- Synthetic style and database failure tests assert closed diagnostics and
  redact error content. The preview failure test checks start-to-failure
  correlation at the Atlas boundary.

Android package was foregrounded on a connected device. A filtered native
accessibility hierarchy confirmed Atlas title, Details, Map, Timeline and
Settings. This is a presence smoke only. The full native walkthrough, viewport
and iOS evidence, and complete cross-layer correlation/fault matrix remain open.
