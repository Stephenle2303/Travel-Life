---
title: 'Living Atlas interactive prototype redesign'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9fa506fe0b960211cd50b42ae83166c2557600d7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/context.md'
  - '{project-root}/docs/decisions/0009-mlp-lifetime-reveal-and-replay.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The synthetic prototype preserves the required MLP owner flow, but its warm paper journal styling, single-column desktop layout, small constellation, and static cards do not express the requested tactile, precise, cinematic “Living Atlas” product direction.

**Approach:** Apply one consistent dark atlas system across every existing route: a dominant responsive map, compact controls, snapping year scrubber, expandable journey cards, restrained everyday motion, cinematic reveal/replay treatment, and locally bundled synthetic photographic crops.

## Boundaries & Constraints

**Always:** Use rainforest `#102C26`, fern `#21483B`, limestone `#F3EEDD`, sage `#B4C6B5`, citrus `#D8EF69`, and occasional clay `#D98763`; keep contrast, touch targets, list fallback, selected/accessibility states, reduced-motion behavior, and mobile/desktop usability. Preserve all routes, synthetic labels, simulated broad/selected access choices, coverage/uncertainty/provenance language, session-only corrections, replay cancellation, owner-selected preview, sparse/declined states, and local-only/no-external-effects contract. Use only generated fictional imagery stored inside the prototype.

**Never:** Add real permissions, personal evidence, remote image URLs, network/account/persistence/backend/map-provider/video-export/publish behavior, literal routes or duration claims. Avoid cartoons, skeuomorphism, gray gradients, glossy plastic, decorative knobs, exaggerated shadows, constant glow, ornamental nature motifs, or texture behind small text. Citrus is for action, selection, and focus; imagery supplies other color.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Responsive reveal | 390px mobile or 1440px desktop | Map remains dominant; dock, Map/Timeline switch, scrubber, list, and actions stay reachable | No horizontal clipping; list remains the map fallback |
| Everyday interaction | Press, select, scrub year, expand card | Fast depressed/return state, crisp selection, smooth bounded expansion, optional native haptic tick | Reduced motion removes nonessential animation; unsupported haptics are silent |
| Cinematic moment | Reveal or replay starts | Rich imagery and restrained destination transitions carry the emphasis | Replay remains cancellable and states that no media is rendered/exported |
| Limited evidence | Sparse, declined, uncertain, or failed map | Honest synthetic coverage and useful next action remain prominent | Never invent a broader history |

</frozen-after-approval>

## Code Map

- `apps/prototype/src/components/ui.tsx` -- replace palette/shared primitives with the responsive Living Atlas shell, inset panels, focus/press states, motion preference, and tactile feedback adapter.
- `apps/prototype/src/components/prototype-screens.tsx` -- restage every route while retaining tested action labels and owner-flow semantics.
- `apps/prototype/src/components/map-canvas.tsx` -- make the dependency-free atlas dominant with contours, circular markers, shared selection, and accessible fallback boundary.
- `apps/prototype/src/components/journey-list.tsx` -- add controlled smooth expansion, local synthetic crops, and explicit detail navigation.
- `apps/prototype/src/data/synthetic-record.ts` and `src/types/prototype.ts` -- reference bundled fictional crop assets without changing evidence claims.
- `apps/prototype/src/components/__tests__/owner-flow.test.tsx` -- retain flow/privacy tests and cover Map/Timeline state, scrubber, expansion, reduced motion, and local assets.
- `apps/prototype/assets/synthetic/` -- three generated fictional landscape crops; no real person, landmark claim, metadata, or remote URL.
- `apps/prototype/src/app/_layout.tsx`, `app.json`, `package.json`, and lockfile -- align dark system chrome/orientation and add only compatible tactile support if required.
- `apps/prototype/README.md` and `docs/project-state.md` -- record the visual prototype boundary, commands, evidence, and remaining device limitations.

## Tasks & Acceptance

### Approved interactive atlas and navigation delta (2026-10-08)

**Scope:** Extend the isolated synthetic prototype after the owner approved the
proposed Living Atlas map and navigation direction. Keep the existing no-network
contract by using bundled geographic illustration rather than a map service. This
does not alter the frozen first-loop, privacy or production-platform decisions.

**Implementation:**
- [x] `apps/prototype/src/components/map-canvas.tsx` and `src/data/synthetic-record.ts` -- replace percentage-based abstract field with a bundled geographic atlas, explicit fictional demo anchors, pan/zoom/fit controls, year-aware selection, overlap treatment and a clear map/list fallback.
- [x] `apps/prototype/src/components/prototype-screens.tsx`, `ui.tsx`, and `_layout.tsx` -- add compact post-import Atlas / Replay / Highlight navigation plus contextual Home/Back without bypassing setup or resetting session state.
- [x] `apps/prototype/src/types/prototype.ts`, `src/data/prototype-model.ts`, and `src/components/prototype-provider.tsx` -- preserve synthetic fixture IDs, year/filter/selected journey/camera context, corrections, replay cancellation and highlight selection across navigation.
- [x] `apps/prototype/src/components/__tests__/` and `src/data/__tests__/` -- cover geographic-label honesty, shared selection/filter, fit and fallback controls, navigation context, reduced-motion behavior, and no-external-effects invariants.
- [x] `apps/prototype/README.md` and `docs/project-state.md` -- describe the bundled-atlas boundary, future production-provider decision, checks run, and remaining device/browser limits.

**Acceptance criteria:**
- Given the eligible synthetic reveal, when it opens at mobile or desktop width, then it shows recognizable bundled geography, a visible “synthetic demo” label, usable Map/Timeline and year controls, and no network map/service request.
- Given a map marker, cluster/overlap, year, Timeline item or Fit action, when the owner uses it, then the same filtered journey state stays understandable and the action never claims a route, a real visit or device location.
- Given navigation between Atlas, Replay, Highlight, journey details, Home and Back, when the owner returns, then the session's filter, selection, correction and chosen highlight remain until an explicit restart; replay stops when exited and nothing publishes.
- Given reduced motion, unknown coordinates, sparse/declined sample or map rendering failure, when the relevant state occurs, then a readable Timeline/local fallback and recovery action remain available without sound, haptics, map service traffic or fabricated data.

**Execution:**
- [x] `apps/prototype/assets/synthetic/` -- generate and save three matte, tropical/editorial fictional travel crops for cards and replay.
- [x] `apps/prototype/src/components/` -- implement the shared Living Atlas system, responsive layouts, dominant atlas, compact dock/scrubber, expandable cards, and bounded motion/feedback.
- [x] `apps/prototype/src/data/`, `src/types/`, and `src/app/` -- wire local asset metadata and platform presentation without changing prototype state boundaries.
- [x] `apps/prototype/src/components/__tests__/` -- expand behavior/accessibility/privacy coverage for redesigned controls and preferences.
- [x] `apps/prototype/README.md` and `docs/project-state.md` -- document the redesign and verified versus pending checks.

**Acceptance Criteria:**
- Given any existing route, when viewed at mobile and desktop sizes, then it uses the same architectural atlas language without clipping, unreadable texture, or lost controls.
- Given the private reveal, when the owner changes view, year, map selection, or journey card, then selection stays understandable and accessible while the map remains the primary surface.
- Given reduced-motion or unavailable haptics, when controls and replay are used, then the complete flow remains fast and usable without depending on animation, sound, or vibration.
- Given the synthetic/privacy boundary, when source and rendered UI are inspected, then all photographs are local fictional assets and no external capability or production claim was introduced.

## Implementation Notes

- Implemented without a new runtime dependency: React Native layout, accessibility, image, and motion APIs provide the prototype behavior; the haptic adapter intentionally degrades to silence.
- RED evidence: the expanded owner-flow suite initially failed five redesign guarantees (view labels/scrubber, synchronized interaction, limited-state assertion shape, reduced motion, and missing local assets). GREEN evidence: all 22 model/component tests pass after implementation.
- The generated crops are fictional interface assets, not evidence or claims about a real place. Built-in image generation prompts required no people, recognizable landmarks, text, logos, or remote source.
- Jest component coverage is 90.26% lines but below 80% for statements/branches/functions; the Node model suite is run separately and is not included in the Jest aggregate. No repository coverage threshold is configured.

## Spec Change Log

- 2026-10-08: Owner approved implementation of the proposed geographic Living Atlas and navigation delta. Selected bundled/offline geography for the prototype to preserve the existing no-external-effects contract; provider choice and production-native map work remain future decisions.
- 2026-10-08: Highlight now starts unselected and offers an explicit Select all chapters action, so a whole-life synthetic preview is owner-chosen. It remains local-only: no URL, export, or publication is created.
- 2026-10-08: Review follow-up resolved private default highlight selection, selected-photo scope copy, replay-unmount cancellation, reduced-motion error handling, overlap choice controls, map fallback coverage, and expanded local-only checks. Deferred pre-existing hero-media concerns (web stalled-event classification, matchMedia guard, and asset-size budget) because they are outside the approved map/navigation delta.

## Review Triage Log

## Design Notes

Use a wide two-zone desktop reveal (atlas plus compact rail) and a stacked mobile composition. Grain and contour layers belong only in large surfaces. Use modest consistent radii, 1px inset borders, matte fills, strong display type, circular location markers, and image crops with calm editorial framing. Keep control motion around 120–220ms; reserve longer transitions for reveal/replay. Do not add click audio in this pass: sound remains off by default, while native haptic selection may be used only where the platform and device settings allow it.

## Verification

**Commands:**
- `npm --prefix apps/prototype run test` -- all model and rendered owner-flow tests pass.
- `npm --prefix apps/prototype run typecheck` -- TypeScript passes.
- `npm --prefix apps/prototype run lint` -- Expo lint passes without deprecated web shadow styles.
- `npm --prefix apps/prototype run doctor` -- Expo dependency/config checks pass.
- `npm run check` -- root framework, foundation, and eval smoke checks remain green.

**Manual checks:**
- Run `npm run start -- --port 8084`; inspect `/`, `/access`, `/import`, `/reveal`, `/journey/lantern-2014`, `/replay`, `/share`, `/sparse`, and `/declined` at 390×844 and 1440×900, including keyboard/focus, reduced motion, map fallback, and no horizontal overflow.
