---
title: 'Interactive Travel Life prototype'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9fa506fe0b960211cd50b42ae83166c2557600d7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/mvp-spec.md'
  - '{project-root}/docs/decisions/0009-mlp-lifetime-reveal-and-replay.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Travel Life has an accepted MLP experience but no runnable interface for the owner to test whether its private lifetime reveal, replay, correction, and selected sharing flow feels coherent.

**Approach:** Build a standalone Expo/React Native prototype with synthetic travel records and interactive local state. It will be a realistic owner-flow test bed that can inform, but does not replace, the later M1–M5 production stories.

## Boundaries & Constraints

**Always:** Preserve the existing M1.1 draft and its reserved `apps/mobile/` path. Keep the prototype self-contained in `apps/prototype/`, with its own lockfile and no root dependency changes. Use only clearly synthetic records. Keep source coverage, inferred versus confirmed facts, and owner-selected sharing visible. Offer a map/list experience, year filtering, journey exploration, a correction interaction, replay preview/cancellation, and selected-highlight preview.

**Never:** Request permissions; read, store, upload, or simulate real library evidence; call AI or a backend; create a public URL; claim a rendered video, native export, map-provider result, background update, or persistent correction. Do not draw routes or assert travel duration from the synthetic record. Do not modify existing planning artifacts, foundation tooling, or the M1.1 delivery draft.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New owner | Welcome then simulated import | Owner sees private/synthetic framing, then a map-first lifetime reveal | No permission, network, or account action |
| Reveal exploration | Year or destination selection | Constellation view, chronological list, and selected journey remain synchronized | List remains usable when map visualization is unavailable |
| Correction | Owner confirms or renames a journey | Prototype visibly updates that journey's owner-reviewed state for the current session | A clear simulated-state label prevents persistence claims |
| Replay | Owner starts then cancels preview | Chronological destination transitions animate and can be stopped | Export is labelled a prototype-only action |
| Sharing | Owner chooses a subset and previews | Exact selected fields and memories are shown before simulated publish | No link or content leaves the device |
| Sparse or declined access | Owner selects an edge-state demo | Honest partial/empty explanation and useful next action are shown | No fabricated lifetime record |

</frozen-after-approval>

## Code Map

- `package.json` -- root framework checks only; do not add mobile dependencies or scripts.
- `_bmad-output/implementation-artifacts/spec-m1-1-create-shared-mobile-app.md` -- preserve; reserves `apps/mobile/` for the later production foundation and defers map/replay dependencies.
- `_bmad-output/planning-artifacts/mvp-spec.md` -- source for the MLP flow, evidence labels, correction, sparse-state, and share-preview constraints.
- `docs/decisions/0009-mlp-lifetime-reveal-and-replay.md` -- requires a truthful map-first reveal, previewable replay, and deliberately selected sharing.
- `apps/prototype/` -- new independent Expo Router TypeScript package and lockfile.
- `apps/prototype/src/data/` -- synthetic record and typed UI contracts; must never resemble a real person’s evidence.
- `apps/prototype/src/components/` -- reusable flow UI, including a replaceable map-canvas interface backed initially by a dependency-free destination visualization.
- `apps/prototype/src/app/` -- Expo Router screens and fallback route; route components compose typed views instead of embedding mock business logic.

## Tasks & Acceptance

**Execution:**
- [x] `apps/prototype/` -- created an isolated Expo Router TypeScript application with local start, test, type-check, lint, and diagnostic commands.
- [x] `apps/prototype/src/data/` and `apps/prototype/src/types/` -- defined a plainly synthetic lifetime record, ephemeral owner actions, and edge-state fixtures.
- [x] `apps/prototype/src/components/` and `apps/prototype/src/app/` -- implemented welcome, a simulated photo-access choice, simulated import, map-first reveal, list/year selection, journey detail/correction, replay preview, selected-highlight preview, and sparse/declined routes.
- [x] `apps/prototype/**/__tests__/` -- covered core navigation, synchronized selection, correction-session update, replay cancellation, no-network/no-permission boundary, and sparse-state behavior.
- [x] `apps/prototype/README.md` -- documented Windows setup, run/check commands, synthetic-data boundary, prototype limitations, and planned production handoff points.
- [x] `docs/project-state.md` and this delivery record -- recorded the completed prototype, observed checks, pending device testing, and the absence of reconstruction or production-service validation.

**Acceptance Criteria:**
- Given the app starts with its sample data, when an owner follows Welcome → Import → Reveal, then they can test the private first-use flow without an account, permission request, network request, or real-data claim.
- Given a selected year or journey, when the owner uses the visualization or chronological list, then the same selection and inferred/confirmed status appear in both views and the detail screen.
- Given a journey correction, replay preview, or selected-highlight choice, when the owner makes or cancels the action, then the interface shows the immediate local prototype result and clearly distinguishes it from production persistence, export, and publication.
- Given sparse history or declined access, when the owner opens that example, then the UI provides an honest limited state and an actionable next step without synthesizing a travel story.
- Given the established foundation checkout, when prototype dependencies are installed, then root `npm run check` remains independent and passes; mobile/device, map-provider, video-export, and backend verification remain explicitly pending.

## Implementation Notes

Research decision: adopt Expo's default TypeScript/Expo Router application template. Use a dependency-free destination visualization behind a `MapCanvas` component for this prototype; Expo Maps is alpha and native map providers need configuration that would distract from testing the flow. `react-native-maps` remains the recorded production default to assess in its owning delivery story.

Review additions: Expo-compatible React Native Testing Library tests exercise the visible welcome/access/import controls, selected-preview rendering, replay timer completion, map-error fallback, invalid detail route, and source-level local-only boundary. The map fallback, status announcements, replay completion, and replace-style returns keep the prototype truthful when a UI path is interrupted.

## Spec Change Log

- 2026-10-07: Implemented the isolated synthetic prototype. This did not alter the frozen owner intent or the M1.1 draft.
- 2026-10-07: Refined the owner-facing visual direction and added a clearly simulated broad-library versus selected-photo access choice. The screen documents that app storage needs no operating-system prompt and Google Photos is not connected. No real permission, local storage, account, or media access was added.

## Review Triage Log

- `verification-gap: external-effects boundary` — medium / patch; the prior literal-object check did not cover UI sources, so the owner-flow tests now click the controls without a fetch and scan the screen source for prohibited client integrations.
- `verification-gap: Welcome → Import → Reveal wiring` — medium / patch; the earlier reducer test could not detect broken callbacks, so rendered control tests now assert the two router destinations.
- `verification-gap: selected-highlight rendering` — medium / patch; a pure selector now supplies the actual preview and a rendered test verifies a newly selected chapter appears there.
- `verification-gap: replay scheduler` — medium / patch; a fake-timer rendered test now observes chapter transition, completion, and return behavior.
- `blind-hunter: replay timer continues at the final chapter` — medium / patch; the reducer now stops at completion, shows a no-export completion notice, and stops scheduling further timers.
- `blind-hunter: stale back navigation after cancellation` — low / patch; return and cancellation paths now replace the current route so a cancelled replay is not revisited through app back navigation.
- `blind-hunter: deep link bypasses simulated import` — false; individual synthetic screens intentionally remain directly testable and have no permission, account, data, or network effects to protect.
- `blind-hunter: unknown journey ID shows another record` — medium / patch; the detail route now returns the recoverable not-found screen before any selection update.
- `blind-hunter: confirmed status conflicts with inferred evidence wording` — false; owner confirmation applies to the reviewed example status while its source-evidence explanation remains explicitly inferred, matching the product correction rule.
- `blind-hunter: sparse route has no sparse data model` — false; the approved prototype requires an honest limited-state example and next action, not a second functional reconstruction dataset.
- `blind-hunter: declined route retains populated in-memory sample` — false; the route displays only its limited-state explanation and intentionally offers the separate synthetic sample path.
- `blind-hunter: unavailable map lacks list fallback` — medium / patch; `MapErrorBoundary` now renders the synchronized chronological list when the constellation component fails.
- `blind-hunter: Keep preview local is a no-op` — low / patch; the misleading primary action was removed because the preview is already local and no publication occurs.
- `blind-hunter: empty highlight can complete` — false; there is no completion or publish action in this prototype and the empty preview explicitly asks for a chapter selection.
- `blind-hunter: tests cover only the reducer` — medium / patch; the focused rendered-flow suite supplements the existing model tests.
- `blind-hunter: selected controls omit accessibility state` — low / patch; map markers, timeline/map controls, year chips, and journey cards now expose selected state.
- `blind-hunter: template dependencies include lint tooling and unused modules` — false; the Expo template pins compatible modules and moving/removing packages would not improve the owner-flow prototype enough to justify compatibility risk.
- `edge-case-hunter: constellation render failure` — medium / patch; covered by the same error boundary and rendered fallback test.
- `edge-case-hunter: selected marker omits fact status` — low / patch; the selected marker now includes its inferred/confirmed label.
- `edge-case-hunter: unknown journey deep link` — medium / patch; covered by the recoverable-route implementation and rendered test.

## Design Notes

The visual direction is a warm, editorial travel journal: high-contrast destination markers and chronological transitions give the reveal a sense of discovery while labels make uncertainty legible. The visualization represents observed destination transitions, never routes travelled between them.

## Verification

**Commands:**
- `npm --prefix apps/prototype run test` -- passed: 7 model/flow tests plus 7 rendered owner-flow tests covering the matrix rows.
- `npm --prefix apps/prototype run typecheck` -- passed.
- `npm --prefix apps/prototype run lint` -- passed.
- `npm --prefix apps/prototype run doctor` -- passed: Expo Doctor reported 21/21 checks passing.
- `npm run check` -- passed: root framework integrity, 20 foundation tests, and eval smoke checks remain green.

**Manual checks:**
- In Expo Go or a compatible development environment, follow the complete sample-data owner flow and each limited-state route. Device-specific claims remain pending until tested on physical iOS and Android devices. This prototype does not validate reconstruction, map providers, replay rendering/export, persistence, backend services, or production sharing.
