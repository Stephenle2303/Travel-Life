---
id: SPEC-m4-7-travel-life-replay
updated: '2026-10-23'
companions:
  - timing-contract.md
  - memory-selection-contract.md
  - interaction-contract.md
  - selection-contract.md
  - renderer-contract.md
  - verification-contract.md
  - media-pipeline-contract.md
  - chapter-presentation-contract.md
  - ../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
  - ../../../docs/product/design-system.md
sources: []
---

# M4.7 private Travel Life Replay

## Why

The owner wants to tap Replay, watch their travels and edit when desired. The current mandatory Prepare screen exposes internal work and has no editor. Complete the private Atlas -> Replay -> optional edit -> chosen-share loop with automatic preparation, keeping failures honest and owner edits durable.

## Capabilities

- **CAP-1**
  - **intent:** The owner can privately replay the current policy-visible Journey List or its chosen scope.
  - **success:** One Replay action uses the album's effective attached photos/videos, resolves unknown local access and retains undated media. No repeated import, reconstruction, private confirmation or mandatory curation precedes playback; unavailable access never appears as zero memories.
- **CAP-2**
  - **intent:** The owner can watch, pause and stop a local silent Replay without managing preparation.
  - **success:** A current verified artifact plays automatically, or preparation starts automatically and playback follows readiness. Chapters adapt to actual selected content: one still about 4-6 seconds, two about 6-10 seconds, normally 15-20 seconds with enough distinct moments; total Replay grows with all scoped trips and has no 60-second/25-panel cap. Verified progressive playback and exact chosen-sequence export use 1280x720 silent output; cancellation, limits and failures remain distinct. Invalid or superseded output cannot play. Work and cache are service-owned, with platform-safe background preparation and resumption.
- **CAP-3**
  - **intent:** The owner can select, review and explicitly export a Replay through native sharing.
  - **success:** Sharing opens a separate empty selection, previews the exact chosen artifact and revalidates at handoff. Private watching/editing never authorizes export. Copy irreversibility is explained; sheet dismissal never means delivery.
- **CAP-4**
  - **intent:** The owner can separately attach the reviewed Replay to a selected shared highlight when publishing is available.
  - **success:** Exact highlight/Replay selection equality, current eligibility and a new deliberate publish confirmation precede M4.5 upload and M4.6 playback. Missing hosted integration stays pending without blocking local export.
- **CAP-5**
  - **intent:** The owner can optionally change private Replay content and presentation while keeping control of their travel record.
  - **success:** The first editor offers Replace/Add/Remove/Reorder over trip/media inclusion and ordering, oldest-first as the default with a newest-first presentation choice, persistent edits, safe remapping on evidence refresh and automatic regeneration after Done. Every rendered trip starts with its private Journey List label/destination and honest time-precision card. Playback is available without opening the editor; editing never changes source evidence or journey corrections.

## Constraints

- Privacy, effective corrections and current scope gate every read, render, reuse and dispatch. Hidden/excluded/stale/rejected/unassigned data cannot enter output. Resolve membership through shared album primitives, not a competing query.
- Journey List order, owner labels, date precision and inferred/manual provenance remain honest. Presentation edits are not observed chronology, travelled routes, trip duration or presence. No narration, music or fabricated history. Local-first visual selection may use optional provider AI only under purpose-specific private-media consent; this planning task sends no owner evidence.
- Oldest/newest ordering and trip cards are private presentation only. Sort only supported chronology; keep unknown, overlapping or otherwise incomparable trips stable relative to the Journey List, and render their available coarse or unknown time rather than manufacture precision. Cards count inside chapter timing and use sanitized local text rendering with no raw private labels in diagnostics or native command syntax.
- Keep every scoped trip and all eligible attached assets as candidates; automatically choose a diverse meaningful subset for each chapter. Account separately for chosen, editorially not chosen, owner excluded and technically unavailable media; keep the full album intact.
- Durable private drafts and verified caches stay local. Never persist native source URIs, session tokens, native errors or export approval. Source/lifecycle/privacy changes invalidate immediately; native ownership remains serialized until settlement.
- Native scheduling is opportunistic. No permission prompt, cloud download, disabled-maintenance bypass or promise of instant/continuous background rendering. Both-platform production acceptance remains mandatory.

## Non-goals

- Full video-editing suite, trim/crop/effects/music, recognition-engine changes, automatic publishing, M4.5 hosting/M4.6 viewer implementation, direct gallery-write UI, web/Expo Go encoding, or unlimited instantaneous rendering/storage guarantees.

## Success signal

On physical Android and iOS, tap Replay once and watch without Prepare, optionally edit and return to a regenerated Replay, then reopen/restart and retain edits. Prove scheduled/interrupted preparation, privacy-safe cache invalidation, long-Replay chapter buffering/storage recovery and separate exact native sharing. Record AC-M4.7-1/2/3 and R1-R18 evidence in the single delivery record.

## Assumptions

- Sparse timing ranges are owner-accepted; exact 5s/8s static defaults, a brief 3s verified-empty slate, normal 15-20s allocation and 4-6-moment curation are starting rules to validate in timing-contract.md. Owner keeps may extend a chapter instead of dropping explicitly chosen memories.
- The first editor offers Replace/Add/Remove/Reorder with durable internal Keep/Exclude/Auto overrides; full editing effects remain deferred. Useful real video snippets are a new native gate; labelled stills are the honest fallback.
- Candidate local vision/optional multimodal AI and bounded chapter/cache/export budgets are unproven until measured; no provider/model or media upload is authorised merely by this design.
