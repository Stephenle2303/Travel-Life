---
title: 'Replay finalization truthfulness and fullscreen audio'
type: 'feature'
created: '2026-10-25'
status: 'implemented-pending-owner-validation'
route: 'dispatch'
baseline_commit: '790a1fda7695ecd917a890d18d742aa11edd5313'
review_loop_iteration: 0
context:
  - 'docs/product/design-system.md'
  - '_bmad-output/specs/spec-replay-finalization-and-fullscreen-audio/SPEC.md'
  - '_bmad-output/specs/spec-replay-finalization-and-fullscreen-audio/state-and-experience.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Replay presents the first silent chapter as a finished private Replay while remaining chapters and the final soundtrack mux continue in the background. It can look as though existing selections disappeared. Native fullscreen removes the only speaker control.

**Approach:** Keep progressive first-trip playback, but make it a clearly labelled finalizing state with live measured progress and no final-only actions. Construct one immutable committed render request, promote only the verified final artifact, and use an app-owned fullscreen view that retains one player and its mute state.

## Boundaries & Constraints

**Always:** Preserve the approved trip-first aggregate Update Replay flow, current privacy/lifecycle gates, soundtrack identity, chapter cache reuse, source-video-audio exclusion, closed diagnostics, and final artifact verification. Keep technical work automatic, copy short, provide known-work percentages, and retain the last safe final Replay after finalization failure. Device proof is mandatory for actual sound and fullscreen continuity.

**Never:** Describe/share/cache a partial chapter as final; re-read mutable editor selection for each chapter; silently export a soundless fallback; reveal media paths/names/native details; add a new encoding pipeline, music catalog, source-video audio, or touch unrelated import/maintenance/diagnostic work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| First chapter | 1 of N chapters verified | `First trip ready · finishing 1 of N`, measured progress, no final controls | Keep Close/playback available. |
| Final ready | All chapters plus AAC mux verify | One final Replay replaces partial playback; Edit/Share return | Persist only final artifact. |
| Final mux failure | Partial chapter exists; final assembly fails | Label partial as incomplete; preserve prior final Replay | Fixed Retry/reselect/default recovery; no cache promotion. |
| Stale/cancel | Request changes during finalization | Late partial/final event ignored | Dispose only no-longer-referenced transient output. |
| Fullscreen | Inline player muted/unmuted | Same player, time/playing/muted state in app-owned fullscreen | One view owns player at a time; native extension fallback only if handoff fails. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/replay-screen.tsx` -- overloaded `preview-ready` first-chapter handoff; owns player overlay, final-only actions and editor aggregate Update. Replace with typed presentation state and app-owned fullscreen handoff; do not alter trip gallery semantics.
- `apps/mobile/src/photo-access/provider.tsx` -- reads one manifest and renders/reuses chapters, emits first chapter, assembles/persists only final output. Extend callback/event contract with immutable request identity and finalization event semantics; retain current cache ownership.
- `apps/mobile/src/replay/types.ts` -- private Replay handles. Add closed progressive presentation/request types only; no source identifiers.
- `apps/mobile/src/replay/renderer.ts` -- chapter render deliberately has no music; final assembly muxes/validates AAC. Preserve this split and make it explicit to caller tests.
- `apps/mobile/src/components/__tests__/replay-screen.test.tsx` -- existing early-first-trip and inline mute tests. Add held-finalization, final gating/replacement, stale and fullscreen handoff coverage.
- `apps/mobile/src/components/__tests__/photo-access-provider.test.tsx` and `replay-renderer.test.ts` -- add request identity/cache and partial-versus-final audio guarantees.
- `docs/development/error-playbook.md`, `docs/project-state.md` -- record result, host limits and device evidence without private details.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/replay/types.ts`, `photo-access/provider.tsx` -- create immutable preparation identity and typed first-trip/finalization events; final cache accepts only final output.
- [x] `apps/mobile/src/components/replay-screen.tsx` -- model resolving/rendering/first-trip-finalizing/final-ready/finalization-failed separately; retain progress after first trip, gate final actions, preserve previous final output on failure, and reject stale callbacks.
- [x] `apps/mobile/src/components/replay-screen.tsx` -- lift one player listening state above source presentation; implement app-owned fullscreen Modal with one `VideoView` at a time, mute action and state/time/playing handoff. Fall back to native extension only after a recorded device failure.
- [x] `apps/mobile/src/components/__tests__/replay-screen.test.tsx` -- cover F01, F02, F03, F05, F07, F08 and F09 with held final assembly and fullscreen handoff doubles.
- [x] `apps/mobile/src/components/__tests__/photo-access-provider.test.tsx`, `replay-renderer.test.ts` -- cover F04, F06 and F10: committed request identity, all selected scope reaches final assembly, partial has no soundtrack and final output maps one AAC track.
- [x] `docs/development/error-playbook.md`, `docs/project-state.md` -- append verified outcome and leave Android/iOS ownership acceptance open until observed.

**Acceptance Criteria:**
- Given a multi-trip Update Replay, when its first chapter completes, then it is visibly partial/finalizing with real continued progress and no Share/Edit/Re-render final actions.
- Given final assembly completes, when the final artifact verifies, then it replaces partial playback and contains the committed aggregate selection and selected soundtrack.
- Given final assembly fails or becomes stale, when a partial exists, then it is never made durable/shareable and a prior verified final Replay remains safe.
- Given mute changes inline, when fullscreen opens/closes or partial becomes final, then the same listening state persists and no preparation/cache invalidation occurs.
- Given a valid custom track, when a partial chapter is shown then final output verifies, then only final-ready claims audible Replay and the output has one verified AAC stream.

## Implementation Notes

- P0 source investigation confirmed `renderReplayChapter` deliberately removes music, provider only persists final output, and current screen prematurely assigns `preview-ready`. `expo-video` native fullscreen cannot host the React speaker overlay on Android or iOS.

## Spec Change Log

## Review Triage Log

## Design Notes

The initial partial surface is a cinematic responsiveness enhancement, not a separate Replay. It says only `First trip ready · finishing X of N`; final-ready is the first point that can promise `Your private Replay` or offer sharing. The app-owned fullscreen modal renders either the inline or fullscreen view—not both—against the same player.

## Verification

**Commands:**
- `npx jest --runInBand --cacheDirectory .jest-cache-codex --runTestsByPath src/components/__tests__/replay-screen.test.tsx src/components/__tests__/photo-access-provider.test.tsx src/components/__tests__/replay-renderer.test.ts` from `apps/mobile` -- expected: all focused regressions pass.
- `npm run typecheck` and `npm run lint` from `apps/mobile` -- expected: pass.
- `npm run check` from repository root and `git diff --check` -- expected: pass.

**Manual checks:**
- Android and iOS owner walkthrough F01–F10: partial status, final aggregate media, audible final track, fullscreen speaker continuity, reopen/cache behavior. Host evidence does not close this gate.
- **2026-10-26 host verification:** focused Replay screen/provider/renderer suites pass 97 tests, including held finalization, final-only action gating, stale callback rejection, prior-final recovery, final AAC custom-track mux, and app-owned fullscreen mute continuity. Mobile `npm run typecheck`, `npm run lint`, repository `npm run check`, and `git diff --check` pass. Android/iOS owner operation remains the only open acceptance evidence.
