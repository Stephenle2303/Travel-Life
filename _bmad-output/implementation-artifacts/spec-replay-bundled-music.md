---
title: Bundled Replay background music
type: feature
created: '2026-10-23'
status: in-review
route: oneshot
---

<frozen-after-approval>

## Intent

The owner explicitly replaces the silent-only Replay decision with bundled instrumental background music. Add one licensed local track, enabled by default, with an on/off control; preview and selected-video export must use the same selection. Do not include original owner-video audio. Music is presentation, never travel evidence. Retain private selection/access boundaries and existing frame timing. No new native dependencies, device/server actions, schema migrations or changes to the concurrent performance plan. Existing dirty source is preserved.

</frozen-after-approval>

## Implementation Notes

- Reuse installed FFmpeg for AAC muxing with video stream copy and installed expo-asset for bundled track resolution. Accept only the fixed bundled track, no arbitrary source URLs.
- Music setting travels through preparePrivateReplay into the manifest and controller key; legacy manifests default to silence. Preview enables audio only for the new music-enabled artifact. Toggle prepares a new artifact so export and preview agree; share selection uses the same setting.
- Verify audio stream count/codec in addition to existing video/duration validation. Test silent compatibility, music mux duration, controller cache separation, and toggle/export behavior.
- Track redistribution/export license must be documented alongside the asset. Keep runtime changes in this story; do not launch Metro/build/install the phone. Device listening acceptance remains owner-operated after host checks.

## Verification

- RED: new controller cache-separation regression failed (one render instead of two).
- GREEN: 57 tests pass across screen, renderer, controller and provider suites.
- TypeScript, lint (zero final warnings), root npm run check and diff whitespace pass.
- Approved-host Android offline export succeeds (1,535 modules), bundling the 2.4 MB OGG and Hermes bytecode. Initial sandbox bytecode write denial is documented in the error playbook.
- Independent review could not run due to reviewer quota; not represented as passed. Manual inspection confirms explicit video/audio mapping, silent legacy behavior, exact-duration muxing and soundtrack-specific cache identity. No commits made because unrelated shared dirty work remains.
- Pending owner device acceptance: restart Metro normally to load the OGG asset config; Replay defaults to music; toggle off then share a selected video and confirm silence; toggle on and confirm music and fade on an exported video. iOS listening/export remains unverified.
