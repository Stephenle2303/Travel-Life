---
title: 'Deliver the Travel Life reveal'
type: 'feature'
created: '2026-10-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'e3a9266e74decb9f41f1fe81608ce675737bf4fd'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m2-6-maintain-journey-history-from-incremental-updates.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app has a private deterministic reconstruction graph but `/history` still shows only an empty-state summary. Owners cannot experience their available lifetime record as the map-first Living Atlas reveal, understand what is inferred or incomplete, or move safely toward Replay.

**Approach:** Replace the foundation Atlas with a private reveal surface that derives a display-safe local model from the committed graph and current source coverage. It will make supported journeys map-first, retain a readable list fallback, offer an availability-only Replay handoff, and provide honest recovery actions for every incomplete state.

## Boundaries & Constraints

**Always:** Use the official Living Atlas hierarchy and local `reconstruction-v1` output; show all visible reconstructed journeys across the available record, inferred/owner-reviewed state when locally represented, source-scope coverage, and uncertainty in words as well as color. Render the map with the native Apple/Google provider through `react-native-maps`, while retaining a local readable history fallback. Keep unknown coordinates in the list, not on an invented map location. Retain the last committed graph during reconciliation; surface pending correction remaps, restricted access, and incomplete coverage. Record only consent-gated, allowlisted coarse reveal/replay/exploration events; local UI remains usable when telemetry is disabled or fails.

**Never:** Copy, upload, log, or expose raw media, source identifiers, filenames, precise coordinates, trip dates, free-form history, routes, durations, countries, or a claim of owner presence/verification. Do not publish/share/export, create a Replay video, invoke AI, require sign-up, submit journey records to the map provider, or treat synthetic prototype geography as production evidence. Explain that the native map provider may receive map viewport/tile requests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Usable reveal | Connected completed local graph with visible journeys | Dominant private map presentation, list fallback, coverage and inferred status, then Replay availability action | Map failure exposes the same local list; no journey is hidden solely by map availability |
| Sparse/empty | Completed graph has no supported journeys or source coverage is limited | Honest partial/empty state with import, correction, or manual-entry next action | No fabricated places, routes, replay, or lifetime claim |
| Processing/restricted | Running, pending correction remap, lifecycle restriction, or recoverable reconstruction error | Keep prior committed display where available and explain the current limitation with catch-up/reconnect/retry action | Never label partial or stale work as final |
| Telemetry unavailable | Consent absent or event sink fails | Reveal and Replay handoff remain available locally | Drop the event safely; no private fallback payload or retry loop |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/mobile-screens.tsx` -- current `/history` foundation view; replace its aggregate-only Atlas body with real reveal-state composition while preserving lifecycle/recovery actions.
- `apps/mobile/src/components/atlas-reveal.tsx` -- new native `react-native-maps` presentation with an accessible local history list fallback; never pass raw evidence rows or source references into props.
- `apps/mobile/src/photo-access/provider.tsx` and `apps/mobile/src/reconstruction/{types,controller,repository}.ts` -- local graph and M2.6 pending/restricted states; add a display-safe read boundary rather than passing private database rows directly to UI.
- `apps/mobile/src/components/ui.tsx` -- Living Atlas primitives, safe-area layout, accessible actions and reduced-motion behavior to reuse.
- `apps/mobile/src/navigation/app-contract.ts` and router tests -- `/history` is the private reveal entry; add only an availability handoff for Replay until its renderer/export story.
- `apps/prototype/src/components/{prototype-screens,map-canvas,journey-list}.tsx` -- composition and fallback reference only; do not import synthetic fixtures, fictional map coordinates, or prototype-only behavior.
- `apps/mobile/src/components/__tests__/{owner-flow,photo-access-provider,reconstruction-controller,reconstruction-engine,navigation-contract}.test.tsx` -- extend with reveal state, display-projection, recovery, telemetry-boundary and Replay-eligibility contracts.
- `apps/mobile/{package.json,app.json}` -- add the map dependency and its native configuration only; do not add provider API keys until required for a chosen release build.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reveal/{types,projection,telemetry}.ts` -- derive a redacted local reveal model and an opt-in allowlisted telemetry boundary; reject private fields and make telemetry failure inert.
- [x] `apps/mobile/{package.json,app.json}` and `apps/mobile/src/components/{mobile-screens,atlas-reveal}.tsx` -- add the native map dependency and render completed, sparse, processing, restricted, pending and failed private reveal states; disclose map-provider viewport requests, retain the local list fallback, and connect local catch-up, import/retry, correction/manual-entry affordances, and Replay availability without publishing or exporting.
- [x] `apps/mobile/src/navigation/{app-contract}.ts` and route shell/tests -- retain `/history` as the reveal entry and provide a typed Replay handoff only when current revealed evidence is eligible.
- [x] `apps/mobile/src/components/__tests__/*` -- cover display projection, all matrix states, no-route/no-verification language, list fallback, opt-in telemetry allowlist/rejection, and Replay eligibility/unavailability.
- [x] `docs/project-state.md` and this spec -- record actual checks and state physical map/device/telemetry limits without calling synthetic output or engagement a quality result.

**Acceptance Criteria:**
- Given a connected completed local graph with visible journeys, when the owner opens Atlas, then the available private lifetime record is map-first with honest coverage and inferred/reviewed labels, a list fallback, and no registration requirement.
- Given sparse, processing, failed, restricted, pending-remap, or unavailable-map evidence, when the owner opens Atlas, then the screen explains the limit and offers a useful local next action without fabricating a broader history.
- Given Replay eligibility, when the owner chooses Replay from the reveal, then the app offers a private availability handoff using observed destinations only; otherwise it explains why Replay is unavailable and offers recovery actions.
- Given telemetry consent is absent or a telemetry sink rejects an event, when reveal/replay/exploration occurs, then private UI behavior is unchanged and no disallowed evidence field is recorded.

## Design Notes

Use the prototype reveal’s emotional sequence—dominant Atlas, coverage/status panel, then Replay invitation—but make every label derive from actual local state. M3.2 owns synchronized map/timeline/year selection and M4.7 owns video rendering/export; M3.1 establishes the reveal entry and its truthful handoff states.

## Implementation Notes

Planning baseline: `e3a9266` (`feat: reconcile local journey updates`). M2.6 may leave owner-history remaps pending; the reveal must make that state clear and never present its graph as final.

## Review Triage Log

| Finding | Verdict | Evidence and route |
| --- | --- | --- |
| Durable query groups a journey while selecting an arbitrary anchor row | medium | Verified: SQLite may choose a non-deterministic representative under the current `GROUP BY`; patch to choose a stable supported anchor. |
| Async durable read can restore reveal data after lifecycle clear | medium | Verified: both durable-read callers set state after resolution without a lifecycle/request guard; patch. |
| Reveal payload check only inspects top-level keys | low | Verified: nested fields bypass it and the task requires a private-field boundary; patch it at the telemetry boundary. |
| Projection can forward an arbitrary map anchor | medium | Verified: only the repository path coarsens anchors; project every anchor through a range-checked coarse boundary. |
| Legacy Atlas panel denies the map and inferred history below the new reveal | medium | Verified in `mobile-screens.tsx`; remove the obsolete foundation-only content. |
| Legacy recovery controls duplicate new reveal controls | medium | Verified in `mobile-screens.tsx`; remove duplicate actions as part of the same obsolete foundation block. |
| Direct Replay route does not determine eligibility | medium | Verified: the route always presents an eligible-sounding handoff; use the local reveal model to show an unavailable state when appropriate. |
| Native map failures other than a failed module load do not auto-switch to list | false | The list fallback control is always visible in a ready reveal, so a failed native surface does not block history access; provider tile failure detection is not exposed by the selected component contract. |
| Initial region may not contain every revealed marker | medium | Verified: it is fixed around the first anchor; patch with a bounding region. |
| `mapAvailable` prop changes are ignored after initial render | low | Verified: state initializes once; patch by synchronizing the prop. |
| Telemetry helper is not invoked from the screen | false | The approved story requires a consent-gated, allowlisted boundary and has no configured consent/sink; the helper is intentionally inert until M5.1 wires the product funnel. |
| Edge-case review reported undecodable content | false | The diff existed and was readable in this session; the reviewer could not access this task's sandbox-specific temporary path, so this is not a product finding. |
| Verification-gap review reported missing content | false | Same sandbox-specific temporary-path limitation; no change finding was produced. |

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand owner-flow photo-access-provider reconstruction-controller reconstruction-engine navigation-contract` -- expected: reveal and recovery contracts pass.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint and Expo Doctor pass.
- `npm run check` -- expected: repository framework and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Actual (2026-10-12):** Focused reveal, access/recovery, navigation, and reconstruction tests passed: 6 suites / 58 tests. TypeScript and Expo lint passed. Native map/device rendering, provider tile requests, platform map configuration, accessibility on real devices, and telemetry delivery remain unverified; telemetry has no configured sink in this story. The browser/Jest fallback was exercised, but it does not prove native map-provider behavior or product-quality outcomes.
