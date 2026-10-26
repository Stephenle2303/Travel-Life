# Verification and rollout

## Automated acceptance

| ID | Given / when | Then |
|---|---|---|
| F01 | A three-trip request emits first-chapter-ready | UI says first trip ready/finalizing, shows 1 of 3 and progress, and does not expose Share as final output. |
| F02 | Final assembly is deliberately held | The first chapter stays explicitly partial and progress continues; it is never written as prepared final artifact. |
| F03 | Final assembly completes | The UI replaces partial playback with one verified final artifact containing all committed selected memories and included trips. |
| F04 | The first chapter is silent and a custom/default track is selected | UI never claims audio is playing until final-ready; final renderer command maps the selected track and output verification sees exactly one AAC stream. |
| F05 | Final audio mux fails after first chapter | Existing verified Replay remains safe; partial preview is labelled incomplete; Retry/reselect/default recovery is fixed and private. |
| F06 | Edit two trips, including old and new media, then Update | Final immutable request contains both resulting selections; no per-chapter mutable editor reread drops older choices. |
| F07 | A request is cancelled/stale while finalizing | Late chapter/final callbacks cannot replace current playback or cache records. |
| F08 | Mute inline, enter fullscreen, exit fullscreen and replace partial with final | One player listening state and visible accessible speaker label persist; no render/cache invalidation occurs. |
| F09 | Android back/iOS fullscreen dismissal | Returns to inline playback without losing mute, triggering a render, or revealing private details. |
| F10 | Reopen after final-ready | Only matching full verified artifact is reused; a saved partial chapter is never treated as a completed Replay. |

## Required checks

- Focused Replay screen, provider, controller and renderer tests with the
  repository-local Jest cache; add the F01–F10 regressions before implementation.
- Mobile TypeScript, lint, relevant SQLite/cache tests, `git diff --check`, and
  root `npm run check`.
- Inspect fixed diagnostics for closed lifecycle fields only; no raw renderer,
  media, audio filename or private selection data.

## Owner-operated walkthrough

Run separately on Android and iOS with a Replay containing at least two trips,
previously retained media, newly edited media and a valid custom track:

1. Edit both trips; choose a track; return to overview; tap Update Replay once.
2. Confirm early playback, if offered, says it is first-trip-only/finalizing and
   visibly advances without Share being available.
3. Confirm final Replay contains both old and new choices and is audible.
4. Toggle speaker inline, enter fullscreen, toggle again, exit fullscreen, and
   confirm mute state and playback continue without a new render.
5. Reopen Replay and confirm final output is reused only when composition is
   unchanged. Change one choice and repeat; no old/partial video may appear as
   final.

Record device model, OS, app build, result for each step, and any fixed reason
code only. Do not collect or store personal media, source names, locations,
paths, native logs or raw errors.

## Release gate

Do not call this complete because a first chapter plays, a final MP4 has an AAC
stream, or host tests pass. Completion requires F01–F10 and the Android/iOS
owner walkthrough showing truthful partial status, full composition continuity,
audible final output and fullscreen speaker reachability.
