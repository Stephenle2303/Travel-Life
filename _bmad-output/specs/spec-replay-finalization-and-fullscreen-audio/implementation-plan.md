# Implementation plan

## P0 — Reproduce and choose fullscreen ownership

1. Add a deterministic renderer/provider fixture with three chapters and a
   custom soundtrack. Hold final assembly after first-chapter notification.
2. Establish that chapter output is silent and final assembly carries AAC; do
   not use mocked stream metadata as device listening proof.
3. Prototype the app-owned fullscreen surface using the existing player. Verify
   Android and iOS fullscreen enter/exit, play/pause, mute persistence, source
   replacement, orientation and accessibility. If either platform restarts,
   duplicates, or loses the player, stop and implement the smallest native
   fullscreen mute extension instead.
4. Record the chosen surface and platform evidence in the delivery record before
   touching the primary screen layout.

## P1 — Separate render result from presentation state

Touchpoints: `apps/mobile/src/components/replay-screen.tsx`,
`apps/mobile/src/photo-access/provider.tsx`, `apps/mobile/src/replay/types.ts`.

1. Replace the overloaded `preview-ready` handoff with typed presentation phases
   from `state-and-experience.md`.
2. Create one immutable preparation request after `saveReplayDraft` succeeds;
   pass its committed scope, selection, direction and soundtrack through
   provider/renderer events without rereading a mutable editor state per chapter.
3. Keep the first verified chapter as transient playback only. Preserve its
   count/duration separately from final output; do not install it in the durable
   prepared-artifact cache.
4. Gate Share, Edit-as-final-context and Re-render controls until final-ready.
   Close remains available throughout. A failed finalization retains the partial
   preview only under its explicit failure label and Retry restarts finalization
   from the same immutable request when still current.

## P2 — Make background finalization visible

1. Keep the current progress callback active after first trip ready.
2. Show `First trip ready · finishing X of N trips` and a real percent where
   chapter total is known; use a short indeterminate `Joining your Replay` label
   only for the final mux where no sub-total exists.
3. Replace the player source atomically only after full output verification.
   Preserve mute; seek/start behavior must be explicitly chosen and tested, not
   inferred. The default is restart the final story at 0 with a short final-ready
   acknowledgement, because the partial chapter is not a temporal prefix once
   reuse/short-video duration adjustments occur.
4. Emit only closed render lifecycle diagnostics for `first-trip-ready`,
   `finalizing`, `final-ready`, `finalization-failed`, and stale/cancelled paths.

## P3 — Audio truthfulness and final artifact integrity

1. Retain existing picker validation and durable draft acknowledgement. Label it
   `Track saved for next Replay`, not `audio ready`, until final output exists.
2. Ensure the final assembly consumes the soundtrack from the immutable request.
   Verify its identity includes custom revision/default revision and cannot reuse
   a chapter or full artifact created for another soundtrack.
3. On audio assembly/output failure, keep the previous verified final Replay;
   present a fixed retry/reselect/default recovery. Never replace it with a
   silent final MP4 or retain a partial chapter as the new saved Replay.
4. Keep source-video audio excluded and ensure partial chapters never imply
   custom/default sound is playing.

## P4 — Fullscreen listening control

1. Move `muted` ownership above the inline `VideoView` so it survives source and
   presentation changes.
2. Implement the P0-selected fullscreen owner. It must expose one visible,
   accessible `Mute Replay audio` / `Unmute Replay audio` action within
   fullscreen, plus exit fullscreen and native transport controls where useful.
3. Subscribe to player mute changes so system/native changes remain reflected in
   the visible label. Do not add another track-selection setting in fullscreen.
4. Test screen-reader labels, 48dp target, reduced-motion behavior and Android
   back/IOS dismissal without source replacement or render invocation.

## P5 — Cache, recovery and cleanup

1. Persist only final verified artifact metadata. Existing chapter cache remains
   private reusable input, never the owner-facing final result.
2. On scope/privacy/request invalidation, cancel pending finalization; dispose
   generated transient files only after no current player references them.
3. Verify completed final output survives reopen exactly when its immutable
   identity matches current committed draft. Do not cache partial status across
   restart as final-ready.
4. Update the M4.7 delivery record, error playbook and project state with owner
   evidence; do not call host-only results device acceptance.
