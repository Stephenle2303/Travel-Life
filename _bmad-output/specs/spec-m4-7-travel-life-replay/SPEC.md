---
id: SPEC-m4-7-travel-life-replay
updated: '2026-10-24'
companions:
  - timing-contract.md
  - memory-selection-contract.md
  - interaction-contract.md
  - selection-contract.md
  - renderer-contract.md
  - verification-contract.md
  - media-pipeline-contract.md
  - chapter-presentation-contract.md
  - editor-experience.md
  - editor-delivery-and-acceptance.md
  - ../spec-replay-soundtrack-and-month-order/SPEC.md
  - ../spec-replay-soundtrack-and-month-order/behavior-and-acceptance.md
  - ../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
  - ../../../docs/decisions/0014-lean-self-serve-replay-editor.md
  - ../../../docs/product/design-system.md
sources: []
---

# M4.7 private Travel Life Replay

## Why

The owner wants to tap Replay, watch their travels and edit visually when desired.
The current editor exposes a flat list of media operations without thumbnails or
trip context. Complete the private Atlas -> Replay -> optional edit -> chosen-share
loop with recognizable media, simple navigation, automatic preparation, truthful
progress and durable owner choices.

## Capabilities

- **CAP-1**
  - **intent:** The owner can privately replay the current policy-visible Journey List or its chosen scope.
  - **success:** One Replay action uses the album's effective attached photos/videos, resolves unknown local access and retains undated media. No repeated import, reconstruction, private confirmation or mandatory curation precedes playback; unavailable access never appears as zero memories.
- **CAP-2**
  - **intent:** The owner can watch, pause, mute and stop a local Replay without managing preparation.
  - **success:** A current verified artifact plays automatically, or automatic preparation shows truthful progress and plays on readiness. Chapters adapt to actual chosen content: one still about 4-6 seconds, two about 6-10 seconds, normally 15-20 seconds with enough distinct moments; total duration grows with all scoped trips without a 60-second/25-panel cap. Verified progressive playback and exact chosen-sequence export use 1280x720 output with the selected soundtrack. Mute changes listening immediately without re-rendering. Invalid or superseded output cannot play. Work/cache are service-owned with platform-safe background preparation and resumption; limits, cancellation and failures stay distinct.
- **CAP-3**
  - **intent:** The owner can select, review and explicitly export a Replay through native sharing.
  - **success:** Sharing opens a separate empty selection, previews the exact chosen artifact and revalidates at handoff. Private watching/editing never authorizes export. Copy irreversibility is explained; sheet dismissal never means delivery.
- **CAP-4**
  - **intent:** The owner can separately attach the reviewed Replay to a selected shared highlight when publishing is available.
  - **success:** Exact highlight/Replay selection equality, current eligibility and a new deliberate publish confirmation precede M4.5 upload and M4.6 playback. Missing hosted integration stays pending without blocking local export.
- **CAP-5**
  - **intent:** The owner can optionally change private Replay content and presentation while keeping control of their travel record.
  - **success:** Edit retains saved-preview context, browses trips and shows their recognizable photos/video posters with actual-composition checkmarks. Direct selection and separate inspection preserve trip/scroll and durable working intent. Done atomically commits and automatically regenerates with truthful progress; Back retains working choices without committing. Trip/media inclusion, within-trip order, oldest/newest month-year direction and soundtrack stay editable. Explicit choices survive replan/restart and safe remapping; each rendered trip keeps its honest label/time card. Playback requires no editing; evidence, original media and sharing approval never change through Edit.

## Constraints

- Privacy, effective corrections and current scope gate every read, render, reuse and dispatch. Hidden/excluded/stale/rejected/unassigned data cannot enter output. Resolve membership through shared album primitives, not a competing query.
- Journey List order, owner labels, date precision and inferred/manual provenance remain honest. Presentation edits are not observed chronology, travelled routes, trip duration or presence. No narration or fabricated history. Local-first visual selection may use optional provider AI only under purpose-specific private-media consent; this planning task sends no owner evidence.
- Later soundtrack/month-order direction supersedes silent-only and interval-comparability ordering rules: Happy Moments 1.4 or valid local custom audio up to 5 MB; player mute is separate. Chapters sort by supported start month/year, same-month ties stable and unknown times last, with explicit newest-first available. Original clip audio remains excluded; Welcome remains silent. Cards count inside chapter timing and use sanitized local text with no private labels in diagnostics or native command syntax.
- Keep every scoped trip and all eligible attached assets as candidates; automatically choose a diverse meaningful subset for each chapter. Account separately for chosen, editorially not chosen, owner excluded and technically unavailable media; keep the full album intact.
- Durable private drafts and verified caches stay local. Never persist native source URIs, session tokens, native errors or export approval. Source/lifecycle/privacy changes invalidate immediately; native ownership remains serialized until settlement.
- All UI builds/rebuilds reference the official design system. Editor candidates are paged/virtualized with bounded thumbnail work; checkmarks mean chosen output, never merely eligibility. Explicit additions cannot be silently omitted or exclusions auto-backfilled. Working preview is clearly distinguished from committed pixels; no per-tap encoding or technical wizard.
- Native scheduling is opportunistic. No permission prompt, cloud download, disabled-maintenance bypass or promise of instant/continuous background rendering. Both-platform production acceptance remains mandatory.

## Non-goals

- Full video-editing suite, trim/crop/effects/multitrack, new music catalog, recognition-engine changes, automatic publishing, M4.5 hosting/M4.6 viewer implementation, direct gallery-write UI, web/Expo Go encoding, or unlimited instantaneous rendering/storage guarantees.

## Success signal

On physical Android and iOS, tap Replay once and watch; recognize and change
photo/video inclusion in two trips, Done -> watch the exact updated composition,
then reopen/restart with edits and current prepared output retained. Record
E01-E16 and existing R1-R28/AC-M4.7 evidence in the single delivery record, including
truthful progress, usable navigation, scheduled/interrupted preparation, privacy
invalidation, long-sequence recovery and separate exact native sharing. Host checks
alone do not establish visual usability, native acceptance or selection quality.

## Assumptions

- Sparse timing ranges are owner-accepted; exact 5s/8s static defaults, a brief 3s verified-empty slate, normal 15-20s allocation and 4-6-moment curation are starting rules to validate in timing-contract.md. Owner keeps may extend a chapter instead of dropping explicitly chosen memories.
- The first visual editor uses direct inclusion toggles, optional inspection/order/music and durable automatic/explicit trip modes. Three-column adaptive grid, 48-item metadata pages and two thumbnail jobs are initial implementation defaults, not measured UX/performance results; read editor companions. Useful real video snippets/posters remain native gates; labelled unavailable/still behavior must stay honest.
- Candidate local vision/optional multimodal AI and bounded chapter/cache/export budgets are unproven until measured; no provider/model or media upload is authorised merely by this design.
