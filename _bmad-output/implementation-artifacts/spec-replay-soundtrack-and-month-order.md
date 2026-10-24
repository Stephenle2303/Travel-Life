---
title: 'Replay soundtrack and month/year order'
type: 'feature'
created: '2026-10-24'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7d3f44257d8f8510f2aabb323388fab112f6150f'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-replay-soundtrack-and-month-order/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Replay currently uses the wrong bundled music, re-renders when the listener only needs mute, and can present trips newest-first. It has no safe local custom-soundtrack lifecycle.

**Approach:** Make Happy Moments 1.4 the default render soundtrack, keep listening mute as player-only state, add a private local audio selection draft in Edit Replay, and order chapters from the effective trip start month to the latest month.

## Boundaries & Constraints

**Always:** Render exactly one selected background track with no source-video audio; keep custom audio on-device under generated private names; accept at most 5,000,000 bytes only after an actual readable-file check and decode probe; preserve the last committed selection on cancel, invalid input, stale completion, or Back. Use current Journey List time: owner-confirmed/corrected dates take precedence; otherwise use the metadata-derived dates already displayed on the trip. Sort valid start year/month ascending by default, stable within a month, unknown last; a saved explicit newest-first preference reverses known-month buckets only. Reset automatic selection resets media choices and timeline direction to oldest-first, retains committed custom music, and takes effect through Done; Back commits nothing.

**Never:** Upload personal audio, persist/log a user file name, source URI, MIME, raw native error, or media content; silently fall back to a silent export when the selected soundtrack cannot render; change Journey List facts, corrections, media membership, chapter duration, share approval, or the concurrent replay performance work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Default render | New/private Replay | Happy Moments 1.4 is audible in preview and selected export; player starts unmuted | Fixed recovery if renderer/audio mux fails; no silent substitute |
| Player listening | Preview midway through playback | Speaker control mutes/unmutes immediately; position and artifact remain unchanged | No render/cache action |
| Custom audio | One decodable local audio file at or below 5 MB, then Done | Private copy and content revision persist; next preview/export uses it | Back/cancel keeps committed track |
| Invalid source | Unknown-size, zero-byte, over-limit, inaccessible, or undecodable source | Previous track remains committed | Fixed non-identifying error and retry/default action |
| Reset | Edit contains media/order changes and a committed custom track | Done restores automatic media and oldest-first direction while retaining track | Back leaves every committed value unchanged |
| Chapter order | Corrected/confirmed or metadata-derived trip starts | Month/year order follows effective start month; ties stable, unknown last | No fabricated day or ordering claim |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/replay-screen.tsx` -- player setup and Edit Replay draft UI; replace render-triggering Music action with accessible speaker state and add soundtrack draft controls.
- `apps/mobile/src/photo-access/provider.tsx` -- owns replay preparation/artifact invalidation; extend its boundary with private soundtrack selection, lifecycle cleanup, and exact export use.
- `apps/mobile/src/reconstruction/repository.ts` -- owns durable JSON Replay draft; preserve a committed soundtrack record across reset while persisting direction/media edits.
- `apps/mobile/src/replay/types.ts`, `controller.ts`, `renderer.ts` -- add opaque soundtrack revision/URI boundary, cache identity, input validation/decode, mux and output checks without exposing private metadata.
- `apps/mobile/src/replay/selection.ts` -- replace interval-comparability ordering with effective start-month presentation ordering.
- `apps/mobile/src/components/__tests__/replay-*.test.*`, `photo-access-provider.test.tsx`, `apps/mobile/scripts/atlas-sqlite.test.cjs` -- regressions for audio, Edit commit/cancel/reset, ordering and SQLite reopen.
- `apps/mobile/package.json` and lockfile -- add the Expo SDK 57 `expo-document-picker` integration; use existing legacy FileSystem and FFmpeg rather than introduce another file API.

## Tasks & Acceptance

**Execution:**
- [ ] Add private soundtrack draft/commit/reset APIs and safe cleanup, then integrate Expo document selection, readable-size gate, generated private copy, media decode probe, and cache revision.
- [ ] Update player/UI state so mute is immediate and non-rendering; expose current track, Choose audio file, Use default music, Done, Back and fixed failure recovery.
- [ ] Render Happy Moments or the committed private track as one fading AAC stream; selected export reuses the committed track and never uses personal clip audio.
- [ ] Sort Replay groups by effective start year/month and update cards, plans, exports, draft migration and persistence behavior.
- [ ] Add focused screen/provider/selection/controller/renderer/SQLite regressions.

**Acceptance Criteria:**
- Given a valid custom audio choice, when Done then reopening Replay and selected export use the same private revision; when Reset automatic selection then only media/direction return to automatic defaults.
- Given a player mute action, when invoked twice during playback then no preparation call occurs and the player position remains intact.
- Given trips with owner-confirmed, metadata-derived, same-month and unknown starts, when Replay renders then owner-confirmed values win, valid months follow the saved direction, same-month order is stable, and unknown remains last.

## Implementation Notes

- Research selected `expo-document-picker` ~57.0.3 with `copyToCacheDirectory`, existing `expo-file-system/legacy`, and `munim-ffmpeg`; validate the private copy with media metadata plus a decode-only FFmpeg probe.
- This delivery changes private local draft data and managed dependencies but does not perform external publication, deployment, or device actions. Replaced private audio is deleted only after it is no longer leased by a render/export.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- Focused Replay screen/provider/selection/controller/renderer Jest suites -- expected: all new contracts pass.
- `npm --prefix apps/mobile run test:sqlite` -- expected: draft migration/reopen/reset behavior passes.
- `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint` -- expected: no errors.
- `npm run check` and `git diff --check` -- expected: foundation checks and whitespace pass.

**Manual checks:**
- Owner-operated Android and iOS: hear default/custom exported audio, mute without a restart or render, retain settings across restart, validate month order and Reset/Back semantics.
