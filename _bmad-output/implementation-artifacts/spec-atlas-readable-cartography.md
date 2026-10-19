---
title: 'Make the private Atlas readable at world and country scale'
type: 'feature'
created: '2026-10-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - 'AGENTS.md'
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
  - '_bmad-output/specs/spec-atlas-cartographic-exploration/SPEC.md'
  - '_bmad-output/specs/spec-atlas-cartographic-exploration/cartographic-design.md'
  - '_bmad-output/specs/spec-atlas-cartographic-exploration/interaction-contract.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The local Atlas is a clearer relief image than before, but its
country lines are raster-thin, it has only seven baked labels, has no visible
Administrative-1 layer, and shows overlapping journeys as indistinguishable
dots. The owner cannot use it to read a place and then explore their memories.

**Approach:** Deliver an offline, layered cartographic surface: public country
boundaries and progressive geographic labels rendered independently of relief
tiles, familiar focal zoom/pan behavior, and visible journey clustering. Start
with data that is locally reproducible; do not represent the bundled 63-region
Vietnam data as the current 34-unit administrative map.

## Boundaries & Constraints

**Always:** Preserve the private qualified-journey projection, coarse anchors,
Winkel Tripel transform, local Map/Timeline and preview/media/correction context.
Use only bundled public geography, fixed-size accessible journey targets, local
label layout and no network requests. Render relief, boundaries, labels and
journeys as separate compatible layers. Keep all names/geometry source-vintage
metadata public and attributable. Maintain existing full-world fit and 1–64
scale; gestures and buttons use one viewport contract.

**Never:** Copy Google map assets/UI, add a provider, send private anchors/media
off-device, infer more precise locations, rewrite historical journey/correction
labels, add roads/POIs/routing/rotation/tilt, or present old Vietnam Admin1
geometry as current. Do not hide journeys if an optional cartographic layer fails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| World view | Bundled Admin0 and label assets | Crisp country lines and a bounded country-label set above relief | Relief remains usable if optional label asset fails |
| Country view | Scale crosses semantic threshold | More relevant locality labels; country line widths remain screen-space stable | Hysteresis avoids repeated show/hide near threshold |
| Dense journeys | Multiple eligible coarse anchors overlap | Visible count cluster opens fit/chooser; all member journeys remain selectable | Exact same anchors use chooser at maximum scale |
| Vietnam Admin1 data absent/unverified | Current 34-unit geometry unavailable | No false current province layer; country/locality context remains readable | About/help states coverage instead of falling back to old 63 regions |
| Gesture interruption | Pinch/pan becomes cancelled/backgrounded | Camera clamps and page gesture lock releases | No dot press or stale preview is emitted |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/local-atlas-map.tsx` -- local relief/tile surface,
  responder camera, journey dots and controls; replace only its map overlays and
  retain failure/fallback behavior.
- `apps/mobile/src/atlas/viewport.ts` and `world-projection.ts` -- canonical
  fitted geometry and normalized Winkel Tripel transform; extend pure helpers,
  never duplicate projection math in a renderer.
- `apps/mobile/src/atlas/map-markers.ts` -- current tap-time overlap lookup;
  replace with reusable deterministic screen-space cluster/hit helpers.
- `scripts/build-atlas-cartography.py` and `build-atlas-tiles.py` -- current
  Natural Earth relief pipeline bakes lines/text; produce compatible public
  overlay assets and remove baked decoration only with replacement coverage.
- `apps/mobile/src/components/__tests__/local-atlas-map.test.tsx` -- existing
  viewport/marker/fallback regression suite; add layer, label, cluster and
  cancellation cases using synthetic public fixtures.
- `apps/mobile/src/components/atlas-reveal.tsx` and `src/atlas/preview-context.ts`
  -- integration boundary for selection and retained context; do not change
  reconstruction or private repository contracts.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/atlas/cartography.ts` and tests -- introduce pure public
  feature, zoom-band, collision, screen-space boundary/label and cluster helpers.
- [x] `scripts/build-atlas-cartography.py`, public assets/manifests and verifier
  -- produce versioned, licensed source metadata and compatible no-text/no-border
  relief plus public country/label overlay assets; fail closed on source mismatch.
- [x] `apps/mobile/src/components/local-atlas-map.tsx` -- render the chosen
  offline vector/overlay solution, semantic labels/boundaries and real clusters;
  retain viewport, fallback and fixed target behavior.
- [x] `apps/mobile/src/components/__tests__/local-atlas-map.test.tsx` -- cover
  progressive labels, collision priority, cluster expansion, hit precedence,
  zoom/pan interruption and legacy relief failure.
- [x] `docs/project-state.md` and `docs/development/error-playbook.md` -- record
  data coverage, verification result and any unexpected renderer/device issue.

**Acceptance Criteria:**
- Given world and country views, when camera scale changes, then country borders
  and labels remain aligned to the common projection and do not scale as raster
  pixels or duplicate at tile seams.
- Given semantic bands and large text, when labels compete for space, then labels
  use deterministic priority, system scaling and backing/halo rather than overlap
  a selected journey, controls or each other.
- Given overlapping eligible journeys, when the map is viewed/tapped, then the
  owner sees a stable count cluster and can reach every real journey without
  fabricated offsets or precision.
- Given pinch, drag, controls, cancellation and Fit world, when interaction
  changes the camera, then it uses the same 1–64 bounded viewport and does not
  accidentally select a journey or leave parent scrolling locked.
- Given Vietnam current Admin1 geometry has not passed source verification, when
  viewing Vietnam, then the app does not call legacy 63-region boundaries current;
  a current 34-unit layer can only ship with pinned provenance and checks.

## Implementation Notes

- User approved continuation on 2026-10-18 after the cartographic exploration
  contract. Existing dirty work is explicitly preserved; this feature is one
  cohesive Atlas exploration delivery, not a provider migration.
- Research-first is required before selecting a native vector renderer. Package
  selection must account for the already-installed development client and prove
  Android/iOS integration rather than assuming a JavaScript-only test proves it.
- Implemented with Expo-compatible `react-native-svg`, not a provider migration.
  Natural Earth Admin0 geometry is generated into public offline paths and its
  explicit source/bounds are checked in. Relief and detail tiles no longer bake
  country lines or text; independently transformed SVG borders and collision-
  managed public labels provide the cartography layer. Vietnam Admin1 remains a
  truthful unavailable state until a current redistributable 34-unit source is
  verified.
- Host verification passed the focused map suite (10 tests), complete mobile
  suite (33 suites / 293 tests), TypeScript, lint, root foundation check,
  whitespace check and public-asset/tile validators. A fresh Android dev build
  compiled native SVG, installed, and was opened on device `2211133G`. Expo
  Doctor is 20/21 due to existing Expo patch-version recommendations; device
  visual, large-text, iOS and finger-gesture acceptance remain manual gates.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| Blind: relief vertical transform disagrees with paths/tiles | high | patch | Confirmed: the base inverse transform omitted the shared 1.6 vertical factor. The base builder and `projectWorldPoint` now use it and public raster/tile verification was rerun. |
| Blind: boundary builder accepts a replaced source archive | medium | patch | Confirmed: the builder previously read the archive without comparing its hash. It now fails if the pinned relief manifest hash differs. |
| Blind: total artwork failure hides journey markers | high | patch | Confirmed: `assetLevel === 'failed'` returned `null` for every cluster. Marker rendering no longer depends on artwork success. |
| Blind: only four locality labels exist | false | reject | The cited data has been replaced with globally distributed public locality context; it is bounded by semantic label budgets rather than a claim to be a complete gazetteer. |
| Blind: zero initial label bounds can overlap | medium | patch | Confirmed: the first render used 0×0. It now uses conservative font-scale-aware bounds until `onTextLayout` provides measured dimensions. |
| Blind: fixed label fonts cannot support 200% text | false | reject | React Native text scales by the system multiplier by default, and the first-pass blocker now incorporates `PixelRatio.getFontScale()`; no cap prevents large text. |
| Blind: greedy cluster membership depends on ID order | medium | patch | Confirmed: the first-cluster loop did not represent overlapping target components. It now forms deterministic 48px connected components and averages their public screen point. |
| Blind: clusters must always fit before chooser | false | reject | The approved contract is explicitly “fit/chooser”; selecting the existing real-journey chooser satisfies that reachable path without inventing an extra camera state. |
| Blind: asynchronous surface origin can jump a first pinch | medium | patch | Confirmed: `measureInWindow` updated origin after gesture sampling. Local touch coordinates now remove that asynchronous dependency. |
| Blind: responder termination is always refused | medium | patch | Confirmed: a parent/OS termination path could be denied. Termination is accepted and `onResponderTerminate` releases the page gesture lock. |
| Blind: obsolete WebP tiles remain after generator changes | low | patch | Confirmed: generated output was only appended. The known generated directory now clears prior `.webp` files before rebuilding the complete manifest. |
| Edge: 33–47px journey targets overlap but remain separate | high | patch | Confirmed: 32px clustering was narrower than the 48px touch target. The component threshold is now 48px. |
| Edge: background interruption can retain page lock | high | patch | Confirmed: there was no AppState cancellation hook. A non-active AppState transition now calls the same release function. |
| Edge: first movement can use a stale measured origin | medium | patch | Same confirmed cause as Blind origin finding; local-coordinate sampling removes it. |
| Verification: clean checkout can omit untracked generated assets | medium | defer | True for this dirty, non-staged tree. The task cannot stage/commit concurrent work; a concrete clean-checkout delivery proof is recorded in deferred work. |
| Verification: overlay alignment is not checked at renderer boundary | medium | patch | Confirmed gap: `boundaryTransform` is now the shared plane/SVG contract and a focused regression asserts the transform calculation. |

## Design Notes

Country/Admin1/locality hierarchy follows the product cartographic companion:
world (<1000 world-width) shows sparse countries; regional/country views add
relevant regional/locality context; local scale expands candidates without
reducing type size. Existing 64x capacity does not itself authorize street maps.

Current Vietnam metadata/geometry is a separate G0 gate. The delivery may ship
global country readability and locality context first, but it must visibly keep
Vietnam Admin1 coverage unavailable until a redistributable current 34-unit
source passes provenance/topology checks. This is a truthful capability boundary,
not a silent permanent deferral.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand local-atlas-map` -- expected:
  boundary/label/cluster and gesture regressions pass outside the known Jest
  cache sandbox limitation.
- `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint`
  -- expected: no new TypeScript/lint failures.
- `npm run check` and `git diff --check` -- expected: foundation/whitespace pass.

**Manual checks:**
- Android and iOS: offline cold start, world-to-Vietnam zoom, double-tap/quick
  zoom/pinch/pan/cancel, dense-dot chooser, 100%/200% text and reduced motion.
- Record source hashes, device/OS/build, coverage status and pass/fail separately;
  unit tests and a Metro load do not prove native gesture, frame-time or visual
  acceptance.
