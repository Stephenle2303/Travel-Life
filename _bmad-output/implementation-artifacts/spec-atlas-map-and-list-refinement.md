---
title: 'Atlas map and journey-list refinement'
type: 'feature'
created: '2026-10-15'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/context.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-and-list-refinement/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-and-list-refinement/visual-requirements.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-and-list-refinement/experience.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-and-list-refinement/acceptance.md'
  - '{project-root}/_bmad-output/specs/spec-atlas-map-journey-preview/SPEC.md'
---

<frozen-after-approval reason="human-approved scope — change only if the owner renegotiates intent">

## Intent

**Problem:** Atlas currently makes its map too small, its journey list too dense, and its preview flow only partially satisfies the approved local-media and correction-return contract.

**Approach:** Build a map-dominant, layered Living Atlas surface with restrained MapLibre markers, a concise grouped journey list, an in-place preview and a bounded private photo/video gallery. Carry camera, filter, selection, card and list state across valid returns while discarding stale or ambiguous content.

## Boundaries & Constraints

**Always:** Keep MapLibre, opaque display IDs, coarse local anchors and the official Living Atlas palette. Show owner claims separately from observations; use `Private journey` when there is no safe title. Resolve only selected, current, local media pages. Video is muted and stopped until an explicit Play action and pauses on lifecycle/item/viewer exit. Give map-unavailable users equivalent Timeline access and retain accessibility labels/large-text behavior.

**Never:** Select a production basemap provider, send media/source IDs/precise locations/journey content to a map service, infer destinations or routes, silently select overlaps, autoplay/download/publish media, or restore a card whose corrected successor is absent or ambiguous.

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` — controlled map, overlay card, overlap chooser, map/list synchronization and lean journey rows.
- `apps/mobile/src/atlas/preview-context.ts` and `src/components/mobile-screens.tsx` — safe ephemeral map/list return context and lifecycle-gated loaders.
- `apps/mobile/src/reconstruction/repository.ts` and `src/photo-access/{types,native-adapter,provider}.tsx` — stable, deduplicated, paged eligible media reads and guarded local preview resolution.
- `apps/mobile/src/components/journey-media-viewer.tsx` — private gallery/item hierarchy with explicit video play and safe close.
- `apps/mobile/src/app/journey/[id]/correct.tsx` — correction return preserving only valid exploration context.
- focused Atlas/repository/provider/correction tests — deterministic UI, paging, lifecycle and stale-result coverage using synthetic fixtures.

## Tasks & Acceptance

- [x] Replace the vertically heavy Atlas chrome with a compact header, honest aggregate line, quiet filter and ~half-screen map; keep provider/coverage details behind one labelled information action.
- [x] Render unselected MapLibre points in muted Fern/Limestone tones, make the selected point citrus and distinct, preserve camera without remounting, and surface an explicit overlap chooser.
- [x] Add concise latest-first year grouping and redacted rows with title/fallback, observed period, worded status and uncertainty; synchronize map, list, filter and selected preview.
- [x] Replace the four-item inline viewer with a stable, bounded, paged mixed-media gallery and item hierarchy; preserve explicit muted video controls and lifecycle pause.
- [x] Preserve/revalidate map camera, filter, selection, card and list state after gallery or correction return; close stale, changed or ambiguous selection truthfully.
- [x] Add/update synthetic focused tests and run mobile typecheck/lint/tests, repository `npm run check`, and `git diff --check`; record task incidents and update project state with evidence/limits.

## Verification

- `npm --prefix apps/mobile run typecheck` — passed.
- `npm --prefix apps/mobile run lint` — passed.
- `npm --prefix apps/mobile test -- --runInBand atlas-reveal photo-access-provider reconciliation-repository` — passed outside the sandbox after its documented cache EPERM retry (3 suites / 47 tests).
- `npm --prefix apps/mobile run check` — passed 28 suites / 237 tests, TypeScript and lint. Expo Doctor reported the pre-existing 20/21 SDK patch-version drift; this is not treated as a pass for dependency alignment.
- `npm run check` — passed.
- `git diff --check` — passed.
- Native MapLibre gesture/camera capture and correction-return, safe-area/large-text, gallery Back, and video lifecycle remain physical-device checks; they are not inferred from synthetic tests.

</frozen-after-approval>

## Review Triage Log

- `manual / EP-043` — **high, patch:** the viewer's effect depended on a parent-created page-loader closure, so a successful page update could trigger the same request again. Stored the latest loader in a ref and keyed page reads only by the page index; focused tests, typecheck, lint, root check and diff check passed afterwards.
- `blind-hunter`, `edge-case-hunter`, `verification-gap` — **process repaired:** their initial sandbox-path and service-capacity failures are recorded as EP-042; a later retry read the shared diff and produced the findings triaged below.
- `verification-gap / map presses` — **medium, patch:** source presses and overlap choice were untested. Added a mocked MapLibre source test that sends multiple opaque feature IDs, requires an explicit choice, and asserts only the chosen preview loads.
- `verification-gap / gallery` — **medium, patch:** paging and stale-page recovery were untested. Added a gallery-path test for page token forwarding, next-page failure, and explicit retry.
- `blind-hunter / filtered anchors` — **medium, patch:** an empty filtered anchor set incorrectly became a persistent map-module failure. It now shows a scoped Timeline prompt without setting the unavailable flag.
- `blind-hunter / antimeridian` and `edge-case-hunter / same` — **medium, patch:** camera framing used a naïve longitude midpoint. It now unwraps the short antimeridian span before deriving the center.
- `blind-hunter / Timeline preview error` — **low, patch:** Timeline now renders the same changed-journey recovery message as the map card.
- `blind-hunter / gallery retry` — **medium, patch:** gallery failure now exposes Retry and retains the last valid page while retrying.
- `edge-case-hunter / latest-first` — **medium, patch:** durable journey ordering now uses the most recent observed year first.
- `edge-case-hunter / camera restoration` — **false:** the reviewer diff preceded the completed camera-context patch. Current Atlas state records MapLibre region changes and restores the ephemeral camera on map/timeline/correction return.
- `blind-hunter / release style`, `disclosure`, `screen-reader anchors`, `camera refit`, and unused detail route — **false/defer:** release intentionally fails closed without a production provider; the approved design explicitly puts disclosure behind About; Timeline is the labelled accessible selection equivalent; filters must preserve rather than refit a moved camera; and the legacy detail route is outside this refinement.
- `blind-hunter / generated review diff` — **patch:** removed the shared review-only diff after review; it is not a retained artifact.

## Spec Change Log
