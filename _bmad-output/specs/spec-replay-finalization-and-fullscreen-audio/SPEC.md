---
id: SPEC-replay-finalization-and-fullscreen-audio
companions:
  - state-and-experience.md
  - implementation-plan.md
  - verification-and-rollout.md
  - ../spec-m4-7-travel-life-replay/SPEC.md
  - ../spec-m4-7-travel-life-replay/trip-first-editor-contract.md
  - ../spec-replay-soundtrack-and-month-order/SPEC.md
  - ../spec-replay-soundtrack-and-month-order/behavior-and-acceptance.md
  - ../../../docs/product/design-system.md
sources: []
---

# Replay finalization and fullscreen listening

## Why

The owner sees a partial, silent first-trip file presented as a completed Replay
while the remaining trips and soundtrack are still rendering. This makes a
correct eventual result look unstable and can make it appear that earlier
selections disappeared. Native fullscreen also drops the app-owned speaker
control. The Replay must make finalization truthful without adding a technical
workflow for the owner.

## Capabilities

- **CAP-1**
  - **intent:** The owner can tell whether they are watching an early trip preview, a Replay that is still finalizing, or the verified final Replay.
  - **success:** A partial file is never titled or actionable as the completed Replay; it names its completed/total trip count, shows current measured progress, and changes to final-ready only after final output verification.
- **CAP-2**
  - **intent:** The owner receives one final Replay made from the exact aggregate edit they committed.
  - **success:** The final artifact uses one immutable committed composition snapshot—trip scope, selected media, order and soundtrack—and is the only artifact eligible for durable reuse, editing context and sharing.
- **CAP-3**
  - **intent:** The owner can trust the audio status of a Replay and a chosen soundtrack.
  - **success:** An accepted track remains a saved choice, while audible Replay status is claimed only after the final muxed MP4 has exactly one verified AAC stream; a soundless partial chapter says that its soundtrack is still being finalized.
- **CAP-4**
  - **intent:** The owner can mute or unmute playback inline and in fullscreen without affecting the saved soundtrack or rendering.
  - **success:** Fullscreen exposes an accessible mute/unmute control tied to the same player listening state; source replacement and fullscreen return retain the current mute state and playback never triggers a re-render.

## Constraints

- Keep the M4.7 trip-first Edit contract: Update Replay remains the single aggregate commit/render action; no technical confirmation step is added.
- Apply the accepted design system: short contextual copy, immediate acknowledgement, known-work percentage, no premature completion, and real phone usability evidence.
- Preserve privacy boundaries: no source URI, filename, native FFmpeg detail, local audio path or private selection enters UI or diagnostics.
- A progressive chapter is disposable private playback only. It cannot update the durable prepared-artifact record, be shared, or overwrite the final composition.
- Continue excluding original clip audio. Custom/default soundtrack remains local-only and must not silently fall back to a silent final artifact.
- Android and iOS owner operation is required for audio and fullscreen acceptance; host checks only establish contracts.

## Non-goals

- A new video editor, soundtrack catalog, cloud upload, source-video audio, background export service, or a second render pipeline.
- Changing Journey List facts, editor media membership, privacy policy, sharing consent, or chapter-selection rules.

## Success signal

On Android and iOS, after editing two trips and choosing a custom track, the owner
can immediately recognize a first-trip preview as still finalizing, watch measured
progress, then receive one final Replay containing both old and newly edited media
with sound. Fullscreen retains mute/unmute, and Share is unavailable until final
verification completes.

## Assumptions

- Progressive playback remains valuable if, and only if, its partial status is unmistakable; the fallback is to keep the existing loading surface until final-ready.
- An app-owned fullscreen surface is preferred if it can host the same `expo-video` player on Android and iOS without restarting playback; otherwise a minimal platform-native fullscreen mute extension is required.
