---
title: 'Dimensional Atlas and minimal journey list'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-2-connect-the-lifetime-map-and-timeline.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-3-open-journeys-and-source-linked-memories.md'
---

<frozen-after-approval reason="human-approved implementation scope">

## Intent

**Problem:** Atlas currently feels flat and its button-heavy Timeline is visually dense. The owner wants a more vibrant, professional, lively map through restrained 3D visual polish and a simple, minimal, intuitive journey list.

**Approach:** Keep the existing private, native Map/Timeline architecture and apply subtle perspective, dimensional custom markers, matte overlay hierarchy, quiet controls, and flat two-line journey rows that share the same selection state.

## Boundaries & Constraints

**Always:** Preserve local-only opaque IDs and coarse anchors, map-unavailable Timeline access, year filtering, uncertainty wording, reduced-motion behavior, and accessible selection state. Use Living Atlas Rainforest/Fern/Limestone/Sage/Citrus/Clay; selection uses Citrus sparingly. Keep maps provider-native with no new credentials, tile provider or external writes.

**Never:** Add terrain, mountains, valleys, satellite imagery, buildings, globe mode, routes, location tracking, row thumbnails, per-row action menus, new schema/migration, or reconstruction changes. Do not send titles, media, raw IDs, evidence, exact coordinates, dates or routes to a map provider.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Populated map | Coarse anchored journeys | Map has a subtle camera perspective, quiet circular markers and a Citrus selected marker; list selection matches | Native map absence retains Timeline |
| Reduced motion | OS preference enabled or unknown | Camera stays flat and no automatic camera animation runs | Controls still change the view immediately |
| Long or uncertain row | Large type, unknown date/location or uncertain order | Flat row wraps and states the exception in words | No clipped core label or fabricated value |
| Filtering and selection | Selected row filtered away | Shared projection clears selection; map/list remain synchronized | Empty year explains reset action |
</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` -- owns `NativeMap`, `mapRegionFor`, map/list selection and all Atlas layout; add scoped map/row presentation here without exposing more data.
- `apps/mobile/src/reveal/{types,projection}.ts` -- shared redacted Atlas state and year filtering; reuse without widening the projection.
- `apps/mobile/src/components/ui.tsx` -- palette and `useReducedMotion`; reuse established semantics and do not restyle unrelated screens.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` -- existing map-fallback, privacy, region, filter and selected-state tests; extend for dimensional controls and minimal rows.
- `apps/mobile/src/components/mobile-screens.tsx` -- host screen; retain existing navigation/detail handoff.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/components/atlas-reveal.tsx` -- add a camera-based 2D/3D presentation toggle, custom layered markers, compact disclosure, map-dominant composition, and flat journey rows while preserving private map boundary and fallback.
- [x] `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` -- cover reduced-motion-safe depth control, selected marker/list synchronization, compact row content and unknown/filtered states using synthetic values.
- [x] `docs/product/design-system.md`, `docs/decisions/0012-dimensional-atlas-and-minimal-list.md`, `docs/project-state.md`, and `docs/development/error-playbook.md` -- record accepted visual extension, implementation evidence and unresolved native/provider limits.

**Acceptance Criteria:**
- Given a populated local Atlas, when the owner selects a map point or journey row and switches 2D/3D, then matching selection remains clear through a Citrus marker/row state and a restrained visual depth treatment without routes or terrain.
- Given a list of ordinary, unknown and uncertain journeys, when the owner scans it at normal or enlarged text, then each row presents a safe title, observed period and only necessary status words in a readable flat layout.
- Given map failure, reduced motion, year filtering or selected-journey removal, when the owner continues exploring, then Timeline remains usable, motion is safe, and stale selection is cleared truthfully.

## Implementation Notes

- The depth control remounts the native map with an `initialCamera` rather than
  calling an animated camera API. Reduced Motion always supplies a zero-pitch
  camera, while Map/Timeline and filtering remain immediate controls.
- The worktree initially had no root or mobile dependency directories. After
  installing its lockfile-pinned dependencies, focused and full verification
  completed; EP-001 records the checkout-access and Jest-discovery safeguard.

- Isolated worktree starts at `0041c0098e0956bb72aebb711e48249ac411bef0`, which uses `react-native-maps` rather than the primary checkout's uncommitted MapLibre work. This delivery keeps the committed native map architecture and does not attempt to import unrelated uncommitted changes.
- Official upstream documentation confirms `react-native-maps` uses a camera for pitch/heading on both platforms, while custom map styling differs by provider. This implementation therefore scopes cross-platform visual depth to camera, custom markers, and app chrome; it does not promise equivalent basemap recoloring.
- The isolated worktree needed its own ignored dependency directories. Device
  confirmation remains separate from the now-passing local checks.

## Spec Change Log

- 2026-10-16: Review patch keeps unknown-coordinate journeys Timeline-only, preserves a coarse explored viewport across a non-animated depth remount, supplies only `initialCamera` when camera presentation is active, restores disclosure before map loading, wraps map controls, and adds non-sensitive accessible item ordinals. Device smoke procedure added; device results remain pending.

## Review Triage Log

| Finding | Verdict | Resolution / evidence |
| --- | --- | --- |
| Empty anchor set mounted a provider-default map | patch | `MapAreaFallback` keeps it Timeline-only; covered by focused test. |
| Removed journey selection could reappear | patch | Effect clears stale component state; refreshed-projection test added. |
| Controls appeared without an active map | patch | Depth controls/disclosure require an available map with anchors. |
| Large text could overflow controls | patch | Control container wraps; mobile device smoke procedure records target validation. |
| Depth change discarded viewport | patch | Coarse ephemeral viewport is captured and becomes the next camera center; regression covered. |
| `initialRegion` and `initialCamera` could conflict | patch | Native map receives only the camera whenever available. |
| Disclosure appeared after provider loading | patch | Disclosure is visible before the native map mounts; no consent gate added. |
| Duplicate safe wording was inaccessible | patch | Screen-reader-only `Atlas item N` disambiguator uses no raw ID or chronology; regression covered. |
| New paths lacked automated tests | patch | Focused suite now covers empty anchors, unavailable/Timeline controls, refresh clearing, viewport, duplicate labels and flat rows. |
| Environment evidence appeared contradictory | patch | EP-001 now distinguishes the pre-install blocker from post-install passing checks. |
| Native map behavior was only mocked | patch | Android/iOS owner-operated smoke procedure added to `apps/mobile/README.md`; actual device result remains pending. |

## Design Notes

The map carries visual energy; controls and the list stay quiet. Use a matte preview layer, one small depth toggle and a selected state that reads without color alone. The list is a recognition tool, not a second dashboard.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal` -- expected: Atlas behavior and privacy regressions pass after dependencies are available.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, lint and Doctor outcomes are reported separately.
- `npm run check` -- expected: foundation checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- On physical iOS and Android devices, inspect marker hit testing, camera perspective, reduced-motion behavior, large text, attribution/controls and Map-to-Timeline fallback.

**Actual (2026-10-16):** Focused `atlas-reveal` passed 21 tests after review
fixes. The final complete mobile Jest suite passed 25 suites / 190 tests;
TypeScript and lint passed. Root `npm run check` and final `git diff --check`
passed. Expo
Doctor remains non-passing at 19/21 checks because the baseline pins nine older
Expo SDK patch versions and references an icon bundle the current Doctor cannot
accept as a file; these unrelated open issues are EP-002. Native/device and provider rendering remain
unverified.
