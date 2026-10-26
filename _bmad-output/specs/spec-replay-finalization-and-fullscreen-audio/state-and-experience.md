# Replay completion state and experience

## Owner-visible states

| State | What the owner sees | Allowed actions | Exit condition |
|---|---|---|---|
| Resolving | `Getting Replay ready` with indeterminate activity | Close | A current immutable composition snapshot is available. |
| Rendering | `Rendering Replay` with measured percentage | Close | First chapter or final output becomes available. |
| First trip ready / finalizing | `First trip ready · finishing 1 of N trips` plus percentage and `Sound will be ready with the full Replay.` | Play/pause, Close, fullscreen; no Share/Edit/Re-render | All selected chapters and final audio mux verify. |
| Final ready | `Your private Replay` | Play/pause, mute, fullscreen, Edit, Share, Re-render | Owner leaves, edits, or starts a new render. |
| Finalization failed after first trip | `The full Replay was not completed. This is only the first trip.` with fixed Retry/Close | Play first trip, Retry finalization, Close | Retry reaches final-ready or fails before preview. |
| Failed before first trip | Existing fixed Replay recovery | Retry/Close/Edit where eligible | New current request starts. |

No state may show `Playing your private Replay`, `Built locally from … selected
memories`, Share, or a final duration for a partial chapter.

## State ownership

`ReplayPreparationRequest` is created once immediately after aggregate draft
commit and contains the committed selection, included trips, direction,
soundtrack revision, snapshot token and privacy revision. It is immutable for
one render generation. The renderer may emit chapter-ready events, but only its
final verified artifact may become the prepared artifact or share candidate.

`ReplayPresentationState` holds:

- generation and immutable request identity;
- phase (`resolving`, `rendering`, `first-trip-ready`, `final-ready`, `failed`);
- verified first-chapter handle, if any;
- verified final handle, if any;
- completed/total work and known chapter count;
- finalization-only error stage; and
- player listening state (`muted`) independent of soundtrack and render state.

The screen must reject any event whose generation or request identity is no
longer current. Cancellation disposes transient chapter output and cannot let a
late final artifact replace the current Replay.

## Progressive render sequence

```mermaid
sequenceDiagram
  participant Owner
  participant Screen
  participant Provider
  participant Renderer
  Owner->>Screen: Update Replay
  Screen->>Provider: commit then create immutable request
  Provider->>Renderer: render chapters for that request
  Renderer-->>Screen: first chapter verified, 1/N
  Screen-->>Owner: First trip ready, finalizing, progress shown
  Renderer-->>Screen: chapter progress and final AAC MP4 verified
  Screen-->>Owner: Final Replay ready; share/edit enabled
```

## Audio and fullscreen rules

An accepted selected file means only that the working soundtrack choice is
durable. It does not claim that the currently displayed media has audio. The
first chapter has no soundtrack by design; its surface therefore explicitly
states that sound arrives with the final Replay. Final-ready requires the muxed
MP4 verification already used by the renderer: one H.264 video stream, one AAC
audio stream, valid duration and no disallowed streams. A device listening test
remains required.

Mute is player-only state. It follows the player through partial-to-final source
replacement and fullscreen entry/exit, never changes the soundtrack revision,
cache identity, render request or sharing artifact. The fullscreen implementation
must be selected by the technical spike: an app-owned fullscreen modal with the
same player if it preserves playback on both platforms, otherwise a minimal
native fullscreen mute control. Do not leave the only speaker control in a React
overlay that native fullscreen removes.
