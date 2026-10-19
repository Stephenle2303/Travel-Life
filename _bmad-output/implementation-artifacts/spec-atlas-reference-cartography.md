---
title: 'Reference-faithful Atlas cartography'
type: 'feature'
created: '2026-10-18'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The visible Atlas surfaces render fictional rounded regions or a grid/tile fallback, not the supplied Obsidian Horizon world-cartography reference. A palette adjustment cannot make those shapes, coastlines, borders, ocean depth, or land texture reference-faithful.

**Approach:** Replace each surface's fictional map base with a shared, bundled world-cartography scene that uses real-world silhouette data and a single geographic projection for the base and safe journey anchors. Deliver the reference's visual map itself first; top search chrome, docks, destination drawer, compass, zoom slider, and route arcs remain deliberately deferred.

## Boundaries & Constraints

**Always:** keep Atlas private/offline and preserve existing Timeline, selection, filtering, media, correction, sparse-state, and accessibility routes; use licensed/bundled assets only; clearly identify prototype fixtures as synthetic; make the same visual asset version available to browser and native adapters; maintain touch targets and a non-map fallback.

**Never:** use remote demo/provider tiles, fabricate personal locations or travelled routes, stretch an equirectangular image into the target shape, replace the required world geometry with abstract blobs, add runtime terrain/globe behavior, delete/reset owner data, or implement the user-deferred chrome.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reference map | Atlas Map with no journeys, sparse state, or provider unavailable | Bundled dark world base is still visible with genuine continental silhouette, deep ocean shading, subtle currents, borders, and labels | Timeline remains reachable; no personal point is invented |
| Geographic journey | Safe coarse latitude/longitude | Anchor follows the base's shared projection and remains selectable with existing overlap behavior | Out-of-range or missing coordinates remain Timeline-only |
| Asset decode failure | Preferred world base cannot load | Verified lower-resolution bundled base renders | Explicit map recovery exposes retry and Timeline; never swap in an abstract map |
| Responsive surface | Desktop, tablet, and phone viewport | Base retains world fit and composition without cropping continents or relying on desktop-only controls | Controls/list keep their accessible layout |

</frozen-after-approval>

## Code Map

- `apps/prototype/src/components/map-canvas.tsx` -- current dependency-free fictional map, pan/zoom/grouping interaction, and its tests' primary rendering target; replace the fictional `Geography` layer and coordinate formula while retaining bounded interaction semantics.
- `apps/prototype/src/components/prototype-screens.tsx` -- `/reveal` host and fallback boundary; do not break its Map/Timeline state ownership.
- `apps/prototype/src/data/synthetic-record.ts` -- synthetic fixture anchors; introduce explicit public real-world fixture locations for projection verification rather than relabeling fictional coordinates as real.
- `apps/mobile/src/components/atlas-reveal.tsx` -- current MapLibre development tile route plus unavailable fallback, selection/preview/state guards, and Map/Timeline shell; migrate the visible base to a bundled map component without weakening those guards.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` -- regression home for fallback visibility, projection, selection, map controls, sparse privacy, and MapLibre demo-style removal.
- `apps/prototype/src/components/__tests__/owner-flow.test.tsx` -- regression home for prototype grouping, synthetic-coordinate disclosure, and bundled Atlas availability.
- `apps/*/package.json` and Metro/Expo config -- verify supported local image/SVG/canvas capability before adding dependencies; avoid an unproved shared-workspace asset resolution scheme.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/atlas-cartography/*` and `shared/atlas-cartography/*` -- create a reproducible local cartography recipe, source/license manifest, projection metadata, and optimized base/fallback assets from a licensed geographic source; include deterministic geometry/asset checks.
- [ ] `apps/prototype/src/components/map-canvas.tsx` and synthetic fixtures/tests -- render the new base through a browser-compatible adapter, project explicit public fixtures and preserve grouped selectable anchors, pan/zoom bounds, Timeline fallback, and no-route disclosure.
- [ ] `apps/mobile/src/components/atlas-reveal.tsx` and a native adapter -- make the accepted local base the default on `/history` across sparse/ready/offline states, use the shared projection for coarse anchors, and remove visual dependency on MapLibre demo tiles without removing existing preview/correction safeguards.
- [ ] `apps/prototype` and `apps/mobile` tests/config -- prove source/asset parity, projection registration, unavailable-asset recovery, privacy/state behavior, and native/browser resolution; retain root foundation checks.
- [ ] `docs/product/design-system.md`, `docs/decisions/`, `docs/project-state.md`, and `docs/development/error-playbook.md` -- record the accepted cartography extension, evidence, and any delivery incident without overwriting unrelated history.

**Acceptance Criteria:**
- Given a map-only capture at the reference framing, when the bundled base renders, then it presents a real-world curved world silhouette with textured blue land, layered deep-blue ocean, fine muted-gold boundaries, sparse legible geography labels, subtle current/contour detail, and a dark vignette; it is not recognizable as the prior abstract/fictitious map.
- Given browser and native Atlas, when their map base version is compared, then their source/projection/asset manifest versions match and their independently projected geographic fixtures register within the documented tolerance.
- Given 1024x639, 1440x900, 1280x720, 768x1024, and 390x844, when viewing the map, then continents remain aspect-correct and globally legible; deferred reference chrome is not used as a reason to obscure a base mismatch.
- Given a ready, sparse, denied, failed, or offline Atlas, when the user opens Map, then the base never performs a map-tile request or needs native MapLibre availability; personal anchors/media still obey the existing state and authorization rules.
- Given a high-resolution asset failure, when Atlas opens, then an approved lower-resolution asset or explicit recovery plus Timeline appears; generic tiles/grid/blob geography never substitutes silently.
- Given the real component visual comparison, when tested before integration completion, then raw reference/actual side-by-side and overlay evidence identifies remaining category mismatches; final visual acceptance is held for the owner rather than inferred from unit tests.

## Implementation Notes

- User explicitly approved implementation after the reference-cartography planning pass and requested a new managed worktree. This is a single cohesive Atlas visual-base goal; deferred chrome is not a second goal.
- No schema, account, provider, deploy, or external-data mutation is authorized. Asset/source additions are reversible repository changes, but licensed source provenance and generated output checksums are mandatory.
- Added the user-supplied reference as the temporary bundled visual master for both surfaces, an offline anchor projection helper, MapLibre-free mobile base, and explicit public projection fixtures for the prototype. This exactly preserves the requested visual, but its embedded utility chrome is decorative until the deferred controls are implemented.
- Both app type checks and root `npm run check` pass. Focused Jest is blocked before test execution by unresolved TypeScript transform setup in this fresh worktree (EP-090); Android/iOS/browser visual acceptance remains pending.

## Spec Change Log

## Review Triage Log

## Design Notes

Prefer a flat, build-time styled world asset plus a pure shared forward projection over a live basemap. That keeps the reference look stable offline and lets markers align without exporting coordinates to a service. The exact renderer and source resolution are a G1 feasibility decision: use the smallest built-in/runtime-supported mechanism proven in both Expo surfaces, not a browser-only image trick.

## Verification

**Commands:**
- `npm run check` -- expected: root framework, foundation, and eval smoke checks pass.
- `npm --prefix apps/prototype test -- --runInBand` -- expected: Atlas/prototype behavior tests pass.
- `npm --prefix apps/mobile test -- --runInBand` -- expected: Atlas state/projection/privacy tests pass.
- `npm --prefix apps/prototype run typecheck` and `npm --prefix apps/mobile run typecheck` -- expected: adapters and shared data type-check.
- `git diff --check` -- expected: no whitespace errors in this worktree.

**Manual checks:**
- Capture raw browser prototype and installed Android/iOS `/history` maps at the required viewports, airplane-mode launch included; compare the unmasked base with the supplied reference and seek owner acceptance before calling visual fidelity complete.
