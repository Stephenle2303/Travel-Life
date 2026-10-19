---
title: 'Atlas Obsidian Horizon map interface'
type: 'feature'
created: '2026-10-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0012-dimensional-atlas-and-minimal-list.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-dimensional-polish/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-dimensional-polish/acceptance.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current private Atlas is functionally connected but does not yet
express the owner-approved Obsidian Horizon / Deep Sea Glass world-map interface.
The reference's visual hierarchy needs a real, accessible implementation without
turning decorative route-planning language into claims about the owner's history.

**Approach:** Reskin and reorganize the existing native MapLibre Atlas as a
full-bleed, dark world-map surface with glass controls, local-only search,
filters, zoom/orientation actions, and a selected-journey card. Reuse the current
opaque projection, local preview/media/correction actions, and Timeline fallback.

## Boundaries & Constraints

**Always:** Use only coarse opaque anchors in map features; retain dev-only demo
tiles and release fail-closed behavior; keep search local to the already visible
redacted journey projection; preserve Map/Timeline, year, selection, camera,
overlap, preview, media and correction-return behavior; use the documented
Atlas-only navy/glass/cyan/amber/gold tokens and reduced-motion behavior; provide
labels and non-colour selected/evidence states with reachable native controls.
Deliver the approved 16:9 composition on wide native/tablet layouts; retain the
accepted browser Timeline fallback rather than adding a browser map/provider.

**Never:** Add a provider, dependency, route arcs, terrain, public planning,
fabricated progress/metrics, remote search, private query telemetry, new schema
or reconstruction behavior; reuse the supplied reference artwork/media/copy; or
replace unrelated dirty Atlas, Home-base, continuity or gallery work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Ready, anchored record | Redacted visible journeys with coarse anchors | Dark map, local search/filter controls, opaque cyan/amber markers and one selected card | No private fields reach MapLibre |
| Local search | Visible safe title/place text | Filters only current local projection and clears an excluded selection | Empty result gives a local no-match state; no network request |
| Map unavailable | Missing module, failed style or offline | Timeline and selected-preview actions stay usable | Explain map failure without fabricating history |
| Reduced motion | Preference enabled/unknown | No shimmer, pulse or automatic camera motion | Controls remain fully operable |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` — retain `NativeMap`, coarse
  GeoJSON source, camera state, selection/preview/media/overlap handling; add
  Atlas-scoped visual tokens, local filtering/search and control/card layout.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` — extend the
  MapLibre mock and current privacy, fallback, selection and gesture coverage.
- `apps/mobile/src/components/ui.tsx` — reuse `useReducedMotion`; do not change
  global Living Atlas palette or unrelated components.
- `apps/mobile/src/components/mobile-screens.tsx` and `src/atlas/preview-context.ts`
  — integration boundaries only; preserve existing gesture ownership and return
  context without changing their Home-base/correction behavior.
- `apps/mobile/node_modules/@maplibre/maplibre-react-native/...` — installed
  API evidence only; use existing Map/Camera/GeoJSON circle-layer capability,
  with no package change.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/components/atlas-reveal.tsx` — implement the Atlas-only
  Obsidian Horizon layout, accessible local search/filters, compact controls,
  camera actions and selected-card presentation while retaining privacy/state
  contracts.
- [x] `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` — add focused
  red/green coverage for local filtering, card/control actions, visual state
  tokens, reduced motion and no-private-payload boundaries.
- [x] `docs/project-state.md`, dimensional Atlas acceptance/development record,
  and this spec — attach actual verification and remaining device/provider gates.

**Acceptance Criteria:**
- Given a populated native record, when Atlas opens, then it renders the approved
  navy/glass full-map hierarchy with labelled controls and opaque coarse markers.
- Given a local search/filter changes visible journeys, when it excludes selection,
  then selection/preview clears safely and no request or telemetry is emitted.
- Given a journey is selected, when its card opens, then it exposes real local
  media and Review/correct actions rather than plan/save or invented metrics.
- Given map loading fails or a journey has no anchor, when Atlas is used, then
  Timeline selection and its guarded preview remain available.
- Given reduced motion, when Atlas loads or controls are pressed, then decorative
  shimmer/pulsing and automatic camera animation do not run.

## Implementation Notes

Atlas now owns an Obsidian Horizon map surface without changing the shared
Living Atlas palette: Deep Navy and glass containers frame the existing
development-only MapLibre map; cyan/amber/gold distinguish controls and selected
markers; the card retains the existing local media and correction actions. The
search input normalizes and compares only the already-redacted visible journey
projection. It clears a filtered-out selection synchronously and has no request
or telemetry path. Zoom and reset controls only adjust ephemeral local camera
state. Map selection, Timeline fallback, overlap choice, media, and correction
return continue through the existing guarded paths.

`useReducedMotion` removes the preview fade when reduced motion is enabled or
unknown. Atlas has no shimmer, pulse, or automatic camera motion.

## Spec Change Log

- 2026-10-17: Implemented the approved Atlas-only presentation and focused
  local-search/control/reduced-motion regressions. No provider, dependency,
  schema, reconstruction, or browser-map change was made.

## Review Triage Log

- `edge-case-hunter / native camera controls` — **medium, patch:** `Camera` consumed only `initialViewState`, so the new zoom/reset controls updated local state without moving an already-mounted native camera. Added a typed camera ref using MapLibre `jumpTo` and a focused regression for zoom and reset.
- `verification-gap / native camera controls` — **medium, patch:** the original interaction test only asserted that button presses did not throw. The revised mock exposes the camera ref and asserts the command's center/zoom after both actions.
- `verification-gap / durable country and month summary seam` — **medium, defer:** the missing SQLite-to-Atlas coverage is real, but the country/month summary repository change belongs to the concurrent continuity delivery, not this presentation story. It is recorded in deferred work for that delivery.
- `verification-gap / Home-base rename and removal screen path` — **medium, defer:** the uncovered handlers belong to the concurrent Home-base delivery, not this Atlas presentation story. It is recorded in deferred work.
- `blind-hunter / Timeline view separation` — **medium, defer:** Map mode has intentionally retained the equivalent list since before this presentation change; the current switch hides the map for Timeline rather than creating a separate scroll context. This is a pre-existing Atlas interaction decision and requires a dedicated UX delivery, not a change inferred from this skin work.
- `blind-hunter / border or invalid country evidence` — **medium, defer:** the resolver currently ignores abstaining members despite its comment. This is a real continuity/country-label defect outside the presentation change.
- `blind-hunter / GPS-less base representative` — **medium, defer:** final qualification still uses a place representative rather than coordinate-bearing support. This is a V1.1 qualification defect outside the Atlas UI scope.
- `blind-hunter / source-origin promotion` — **medium, defer:** the qualification adapter overwrites persisted provenance with capture-like data. This is a V1.1 engine safety defect outside the Atlas UI scope.
- `blind-hunter / video membership type` — **medium, defer:** canonical episode construction currently calls every evidence item an image. This belongs to the concurrent engine delivery, not the presentation change.
- `blind-hunter / civil-day session fabrication` — **medium, defer:** the engine adapter uses a day as a temporary session identifier. Its contract requires a proper native session source and this must be resolved by the engine delivery.
- `blind-hunter / configured Home bases omitted from final qualification` — **medium, defer:** the final qualification adapter can disagree with Home-base context. This is a concurrent engine/Home integration defect, not Atlas UI.
- `blind-hunter / stale Home-base list after failed rebuild` — **medium, defer:** saving refreshes Home bases only after rebuild completion, so a failed rebuild leaves the persisted list stale. This belongs to the Home-base flow.
- `blind-hunter / video shown through image component in Home review` — **medium, defer:** the Home review screen does not yet give video-specific preview behavior. That screen belongs to the concurrent Home-base delivery.
- `blind-hunter / unchecked Home UPDATE or DELETE result` — **medium, defer:** a stale Home-area command can currently report success. This is a private repository/Home-base defect outside the Atlas presentation change.
- `blind-hunter / mocked native MapLibre limits` — **false:** mocked unit tests cannot substitute for native hit-target/provider validation, but this story explicitly retains those physical checks as unresolved manual gates; it does not claim they passed or attempt to replace them with a mock.

## Design Notes

The control composition follows the owner-supplied reference, but information is
adapted rather than copied: Map/Timeline, years and evidence state replace public
map modes; card content is an owner-visible title, observed period and committed
review/evidence state. MapLibre remains Mercator rather than Winkel Tripel; no
unapproved provider/style will be introduced to imitate the reference.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal` — passed outside
  the sandbox cache boundary: 1 suite, 22 tests.
- `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint`
  — passed.
- `npm --prefix apps/mobile run check` — 29 suites / 270 tests, typecheck and
  lint passed. Expo Doctor remained 20/21 because of the pre-existing nine Expo
  SDK patch-version recommendations; no dependency change was authorized.
- `npm run check` — passed: framework integrity, 20 foundation tests and eval
  infrastructure smoke. `git diff --check` passed with only line-ending warnings.

**Manual checks:**
- Native Android/iOS portrait, wide/tablet, large text, selected card, local
  search no-match, map failure and reduced-motion behavior; inspect map requests
  to confirm no private query/content leaves the device.
- The wide native 16:9 composition and physical provider/request inspection
  remain unverified. MapLibre's release provider is still intentionally absent,
  so release behavior continues to fail closed.
