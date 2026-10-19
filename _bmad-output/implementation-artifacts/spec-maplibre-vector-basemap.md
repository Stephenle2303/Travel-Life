---
title: 'MapLibre vector basemap integration'
type: 'feature'
created: '2026-10-18'
status: 'implemented-pending-provider-device-acceptance'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
---

<frozen-after-approval reason="human-approved direction — do not modify unless human renegotiates">

## Intent

**Problem:** The Atlas currently owns a custom raster/canvas map and a short hard-coded list of geographic labels. It cannot provide maintained progressive country, Admin1, city, and locality labels or a native map interaction model.

**Approach:** Use the installed MapLibre React Native v11 renderer with a configured MapTiler vector-style URL. Geographic labels and political boundaries come from the provider style and its maintained vector data; Travel Life only supplies private, coarse journey points and selection state.

## Boundaries & Constraints

**Always:** Read the provider style URL from `EXPO_PUBLIC_ATLAS_MAP_STYLE_URL`; use native pan and pinch; keep Map/Timeline, filters, private coarse anchors, journey preview, correction context, and an accurate disclosure. Treat the URL/key as publishable configuration, not source code or a secret; no journey, media, source ID, or precise location is placed in it.

**Never:** Embed a MapTiler key, use demo tiles, hard-code public place labels, copy Google cartography, silently transmit private data, or claim an offline pack/device experience without a separate verified delivery. Do not change reconstruction, persistence, sharing, or journeys' display names.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Configured style | Valid HTTPS MapTiler vector-style URL | Native MapLibre renders provider labels/boundaries and interactive map | Style-load failure exposes Timeline/local recovery instead of a blank map |
| Unconfigured style | Empty/invalid environment value | No provider request; existing local/private recovery remains usable | Explain that map data is unavailable, not that journeys are lost |
| Journey selection | Coarse redacted journey GeoJSON feature | Tap selects one journey; coincident features retain explicit chooser | Ignore malformed/unknown feature IDs |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` -- Atlas composition and current `LocalAtlasMap` call site; correct the online/offline disclosure.
- `apps/mobile/src/components/local-atlas-map.tsx` -- current custom raster, responder and `PUBLIC_LABELS`; preserve only as an explicit no-provider recovery until the external style is configured.
- `apps/mobile/src/atlas/basemap-config.ts` -- new pure, testable configuration boundary; it must not hold a token, URL default, or public label data.
- `apps/mobile/src/components/maplibre-atlas-map.tsx` -- new MapLibre v11 renderer using `Map`, `Camera`, `GeoJSONSource`, and `Layer`.
- `apps/mobile/src/components/__tests__/atlas-reveal.test.tsx` -- existing v11 MapLibre mock and Atlas behavior coverage.
- `apps/mobile/.env.example` -- documents the blank publishable style URL only.
- `apps/mobile/app.json` / `apps/mobile/package.json` -- already contain the MapLibre plugin and v11 dependency; do not add a second map library.

## Tasks & Acceptance

**Execution:**
- [x] Add the configuration parser and tests for disabled, valid HTTPS and invalid values.
- [x] Add a MapLibre v11 vector-map component with native gesture controls, coarse journey GeoJSON, selection and failure callbacks.
- [x] Select it only for an enabled style, retain a truthful recovery path otherwise, and remove hard-coded labels from the configured path.
- [x] Document the build-time configuration and update the map privacy disclosure.
- [x] Extend mocks/regressions and run focused, mobile, and foundation checks.

**Acceptance Criteria:**
- Given a valid configured vector-style URL, when Atlas opens, then it mounts a MapLibre map with native drag/pinch and provider-supplied labels rather than `PUBLIC_LABELS`.
- Given no valid style URL or a style failure, when Atlas opens, then journeys and Timeline remain available and the UI does not make a false offline/no-network claim.
- Given a displayed journey marker, when it is tapped, then its existing preview flow opens; coincident markers still require a deliberate choice.
- Given configuration is inspected, then no key, demo style URL, or hand-authored geographic label list is shipped by this feature.

## Implementation Notes

- The owner's “ok implement” on 2026-10-18 approves MapLibre + MapTiler direction. A provider account/key is still external build configuration; integration must remain inert without it.
- MapLibre receives a full configured vector-style URL and renders only the redacted anchor GeoJSON. When that configuration is absent or a style fails, Atlas now exposes Timeline recovery rather than mounting `LocalAtlasMap`, so the shipped active path no longer relies on `PUBLIC_LABELS`.
- The native renderer preserves camera state through Map/Timeline remounts, reports gesture start/end to the enclosing screen, allows native pan/pinch/double-tap, disables rotation/pitch, and caps zoom at 16.
- Initial focused regression assertions confused the test-wide configured style URL with `mapAvailable={false}`. The correction and prevention are recorded in `docs/development/error-playbook.md`; focused and full mobile suites were rerun afterwards.
- Browser resolution deliberately uses the inert generic component while the `.native.tsx` implementation imports MapLibre. This prevents a native module import from leaking into the browser Timeline recovery path.

## Spec Change Log

## Review Triage Log

| Finding | Decision | Resolution / evidence |
|---|---|---|
| Provider map could be imported by the browser path | Accepted | Native renderer moved to `maplibre-atlas-map.native.tsx`; the browser module is inert and `Platform.OS !== 'web'` gates it. |
| Sparse/no-anchor data could imply a blank map | Accepted | Map mounts only for a visible anchored journey; sparse data retains Timeline/actions and has a regression. |
| Gesture/camera contract was unproven | Accepted | Native `dragPan`, `touchZoom`, `doubleTapZoom`, region callbacks and camera round-trip are asserted in the focused suite. |
| Bad feature IDs, empty presses, small targets and Android rendering were fragile | Accepted | IDs are filtered against visible GeoJSON, empty press clears selection, source gets a 44px target, and Android uses texture rendering. |
| Style failure could trap the enclosing scroll / disclosure understated provider data | Accepted | Failure releases the gesture owner, offers retry/Timeline recovery, and disclosure names viewed-area plus ordinary network metadata. |
| Configuration could accept unintended URLs or tests could hide absence of config | Accepted | Parser permits only HTTPS MapTiler map style URLs with a key; tests cover missing/invalid/valid config and failure retry. |

All code-level review findings are resolved. Physical iOS/Android provider acceptance remains a separate manual gate because this repository has no configured non-demo provider key.

## Design Notes

Provider vector cartography replaces the custom world plane only when configured. Its conventional projection is an intentional trade-off for progressive maintained labels and native map behavior; this feature does not represent it as the same Winkel Tripel projection.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand src/components/__tests__/atlas-reveal.test.tsx` -- expected: Atlas configuration and selection regressions pass.
- `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint` -- expected: native component type and lint checks pass.
- `npm --prefix apps/mobile test -- --runInBand` -- expected: full mobile suite passes.
- `npm run check` -- expected: foundation checks pass.

**Manual checks:**
- Configure a non-demo MapTiler style URL in local build configuration; on Android and iOS, verify pan, pinch, progressive provider labels, marker selection, failure recovery and the provider-request disclosure.
