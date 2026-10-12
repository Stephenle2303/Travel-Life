---
title: 'Connect the lifetime map and timeline'
type: 'feature'
created: '2026-10-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7285ef593acb2bf3ea049d9c278e9af857bc60a8'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-1-deliver-travel-life-reveal.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M3.1 provides a truthful private map and list, but they are not yet an exploration surface. An owner cannot choose a year, select the same journey from either representation, or use a chronological Timeline when the map is unavailable.

**Approach:** Add one local Atlas exploration state that synchronizes Map and Timeline views, year filtering, and journey selection from a redacted committed-record projection. The unfiltered Atlas represents the full visible local record; Timeline remains usable without map service.

## Boundaries & Constraints

**Always:** Derive stable display IDs, chronological order, coarse year/range labels, ordering uncertainty, and already-coarsened anchors locally from the committed reconstruction. A selected year includes every journey with an observed visit in that year; a journey with no usable year remains visible under All and is labeled `Date unknown`. Keep unknown-coordinate journeys in Timeline only. Retain M3.1 coverage, inferred/reviewed wording, recovery actions, map-provider disclosure, and map/list fallback. Selecting a marker or Timeline card selects the same display journey; a filter that excludes it clears selection. Use words and accessibility state in addition to visual selection.

**Never:** Pass raw journey, visit, evidence, source, media, timestamp, civil-day, filename, exact-coordinate, country, route, duration, or free-text fields into React state, map props, or telemetry. Do not invent within-day order, dates, routes, destinations, a map point, or a journey detail screen. Do not publish, export, invoke AI, alter source data, migrate stored data, or promise map availability.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Full exploration | Completed committed record with dated, map-supported journeys | Map and Timeline show the same visible journeys; All years represents the full record; selections and filters stay synchronized | Timeline remains reachable from Map |
| Weak/unknown records | Journey has unknown date, uncertain ordering, or no coordinate | Timeline labels its uncertainty; it stays visible under All and is never plotted without an anchor | No fabricated order, date, or map point |
| Empty year / dense map | Selected year has no records, or many map anchors exist | Explain empty filter with a reset; all visible records remain accessible through the scrollable Timeline | Map density or map failure never blocks Timeline |
| Lifecycle/reconciliation limit | Restricted, pending, failed, or stale committed record | Preserve M3.1 status and recovery state; do not claim the selected/filter result is final | Clear stale local selection when the record disappears or becomes invalid |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/repository.ts` -- extend the committed-run read boundary to calculate only display-safe chronology and coarse period data before values leave SQLite; preserve lifecycle checks and no raw IDs.
- `apps/mobile/src/reveal/{types,projection}.ts` -- define safe journey display fields and pure filtering/selection helpers; keep coordinate coarsening and forbidden-payload safeguards.
- `apps/mobile/src/photo-access/provider.tsx` -- load/invalidate the durable exploration model using M3.1's lifecycle-generation guard.
- `apps/mobile/src/components/{atlas-reveal,mobile-screens}.tsx` -- add Map/Timeline controls, year selector, selected markers/cards, accessible Timeline fallback, and existing recovery/Replay handoff.
- `apps/mobile/src/components/__tests__/{atlas-reveal,photo-access-provider,reconciliation-repository,owner-flow}.test.tsx` -- cover the matrix and ensure no private projection field reaches the UI boundary.
- `apps/prototype/src/components/{prototype-screens,journey-list,map-canvas}.tsx` -- interaction/composition reference only; do not import synthetic data, artwork, or mapping code.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reconstruction/repository.ts` and `apps/mobile/src/reveal/{types,projection}.ts` -- expose a lifecycle-safe, redacted committed Atlas timeline with stable display IDs, coarse period/year membership, ordering state, and optional coarse anchors; implement shared filter/selection derivation.
- [x] `apps/mobile/src/photo-access/provider.tsx` and `apps/mobile/src/components/{atlas-reveal,mobile-screens}.tsx` -- load the projection, synchronize Map/Timeline/year/selection, fit only filtered anchors, and retain accessible Timeline/recovery paths if map service is unavailable.
- [x] `apps/mobile/src/components/__tests__/{atlas-reveal,photo-access-provider,reconciliation-repository,owner-flow}.test.tsx` -- add pure and UI contracts for synchronized selection/filtering, unknown records, empty filters, map fallback/density, lifecycle invalidation, and redaction.
- [x] `docs/project-state.md` and this spec -- record final checks and device/provider limits without claiming native-map or reconstruction accuracy evidence.

**Acceptance Criteria:**
- Given a completed private record, when the owner switches Map/Timeline, filters by year, or selects a journey, then the visible map markers and chronological cards represent the same filtered record and selected journey on both platforms.
- Given a journey with unknown coordinates, weak date precision, or uncertain order, when the owner explores Atlas, then the Timeline preserves it with an honest label while the map never fabricates a location, order, or trip route.
- Given an empty year, dense map, unavailable map service, or non-final lifecycle state, when the owner explores Atlas, then Timeline and recovery actions remain usable and the app explains the limitation.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- Resolved: stable opaque local display IDs replace changing ordinals, and the
  Atlas remounts when the committed record identity or availability changes so a
  stale selection cannot transfer to another journey.
- Resolved: journeys sharing the only displayed time precision (a year), and
  journeys without a usable year, are labeled `Order uncertain`; internal IDs
  provide deterministic rendering only and never claim chronological evidence.
- Accepted as covered: the Timeline remains rendered and reachable for dense
  anchors and the native-map-unavailable path. Native provider/tile failure and
  physical dense-map behavior remain device-validation limits, not simulated
  capabilities.

## Design Notes

M3.2 makes the official Atlas Map/Timeline and year controls real while preserving M3.1's map-first reveal. It does not deliver journey detail, photo rendering, playback, or export.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal photo-access-provider reconciliation-repository owner-flow` -- expected: all Atlas exploration and lifecycle/redaction contracts pass.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint, and Expo Doctor pass.
- `npm run check` -- expected: repository framework and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Actual (2026-10-12):** Focused Atlas/repository/provider/owner-flow tests passed: 4 suites / 26 tests. The complete mobile check passed 23 suites / 170 tests, TypeScript, Expo lint, and Expo Doctor. These are synthetic/runtime checks only. Native iOS/Android map rendering, provider tile behavior, map density on physical devices, screen-reader behavior on target devices, lifecycle interruption, and reconstruction accuracy remain unverified.
