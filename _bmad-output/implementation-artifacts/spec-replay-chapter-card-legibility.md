---
title: 'Make Replay chapter cards readable in local languages'
type: 'bugfix'
created: '2026-10-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7d3f44257d8f8510f2aabb323388fab112f6150f'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-m4-7-travel-life-replay/chapter-presentation-contract.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Replay chapter cards disappear after one second, which does not give an owner enough time to read the trip information. Their encoded `drawtext` overlay also depends on an unspecified native default font, so local-language labels such as `Thừa Thiên Huế` may render with missing glyphs.

**Approach:** Reserve two seconds of each existing chapter budget for its private title card and use a bundled, license-compatible Unicode font asset through a local, argument-safe FFmpeg font path. Preserve the label exactly after existing sanitization; do not transliterate it or extend the chapter total.

## Boundaries & Constraints

**Always:** Keep the card inside the already selected chapter frame budget; retain current privacy, timing, selection, cache-identity, sanitization, no-route and no-filler contracts; encode text only into private pixels; verify Unicode planning and native command construction with automated tests; record Android/iOS visual validation separately.

**Never:** Change Journey List labels, evidence, media selection, render scope, chapter order, export approval, diagnostics, or add raw owner text to FFmpeg arguments, paths, logs, cache names, or fixtures. Do not use a platform-default font, strip Vietnamese diacritics, pad media to recover time, or claim device legibility from Jest.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Readable private chapter | An eligible trip has a sanitized local label and a normal/sparse frame budget | A 48-frame title card precedes the selected moments; total chapter frames remain unchanged | N/A |
| Vietnamese label | Label is `Thừa Thiên Huế` | The planned token and rendered local `drawtext` filter retain the characters and use the bundled font path | Fixed renderer stage if native encoding fails; never expose native details |
| Very short video | The selected video is shorter than its remaining media allocation | Preserve measured video length only; do not freeze, loop, or extend it after the longer card | Existing decode/output handling applies |
| Restored/external manifest | Card token contains punctuation or unsafe syntax | Reapply current closed sanitization before the FFmpeg boundary while preserving valid Unicode letters | Render a fixed closed failure stage on encode failure |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/replay/selection.ts` -- `chapterFor()` currently assigns the one-second 24-frame card; reuse `sanitizeCardToken()` and keep chapter total frames fixed.
- `apps/mobile/src/replay/renderer.ts` -- builds both `drawtext` filters without a `fontfile`; add the packaged-font resolver and keep its closed-error and native-argument boundary intact.
- `apps/mobile/src/replay/types.ts` -- owns existing sparse/normal chapter frame budgets; do not change those budgets.
- `apps/mobile/src/components/__tests__/replay-selection.test.ts` -- extend chapter-card tests for 48 frames and Vietnamese-token preservation.
- `apps/mobile/src/components/__tests__/replay-renderer.test.ts` -- assert a resolved safe `fontfile`, Unicode token retention, and unchanged card-plus-media total without treating mocks as device proof.
- `_bmad-output/specs/spec-m4-7-travel-life-replay/chapter-presentation-contract.md` -- amend the superseded one-second maximum and document the pinned-font requirement.
- `docs/project-state.md` -- record host verification and outstanding Android/iOS legibility evidence after implementation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/assets/fonts/` and mobile asset configuration -- add one vetted, license-compatible, Unicode-capable sans font and make it available as a local native file to Replay rendering.
- [x] `apps/mobile/src/replay/selection.ts` -- allocate 48 title-card frames within each existing chapter budget, including export manifests, without changing total frames.
- [x] `apps/mobile/src/replay/renderer.ts` -- resolve the packaged font locally and include an escaped `fontfile` in both card text overlays while preserving the existing closed sanitizer and error boundary.
- [x] `apps/mobile/src/components/__tests__/replay-selection.test.ts` and `apps/mobile/src/components/__tests__/replay-renderer.test.ts` -- add regressions for two-second cards, Vietnamese glyph tokens, fixed font selection, and no media-padding regression.
- [x] `_bmad-output/specs/spec-m4-7-travel-life-replay/chapter-presentation-contract.md` and `docs/project-state.md` -- align the authored contract and delivery evidence with the new bounded presentation behavior.

**Acceptance Criteria:**
- Given an eligible sparse or normal trip, when Replay plans or exports its chapter, then its card uses 48 frames and the card plus subsequent media remains exactly within the prior chapter budget.
- Given a card label containing `Thừa Thiên Huế`, when the private chapter is planned and rendered, then the sanitized token retains its Unicode letters and each local text overlay uses the packaged font file.
- Given a short selected video, when the longer card reduces the available media allocation, then Replay retains only measured source frames and never freezes, loops, or lengthens the video.
- Given a native Android or iOS build, when the owner watches Replay at 720p, then the owner can read the two-second card and Vietnamese label; this remains pending until separately observed on each platform.

## Implementation Notes

## Spec Change Log

- 2026-10-23: Increased the private card allocation to 48 frames within the existing chapter budgets and pinned its local renderer to bundled Noto Sans Regular.

## Review Triage Log

- fixed: A no-media chapter lost its remaining slate after the 48-frame card; the renderer now retains the full chapter budget and the regression asserts 48+24 frames.
- fixed: A bundled-font download failure could be recategorized as decode; the resolver now preserves the closed `REPLAY_UNAVAILABLE` stage.
- defer: Host mocks cannot prove Android/iOS glyph rendering; owner-operated 720p Vietnamese-card validation remains required.
- defer: Noto Sans Regular is intentionally bounded to Vietnamese/Latin Extended support; other scripts require a separately scoped fallback-font design.

## Design Notes

Use one regular-weight sans font asset with Vietnamese/Latin Extended coverage, not a system font fallback. The renderer should resolve that asset to a private local path before assembling a command and should pass only the resolved path plus already-sanitized display tokens to FFmpeg. A two-second card is deliberately a bounded readability adjustment: it borrows one additional second from the selected chapter rather than increasing runtime or inventing filler.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand src/components/__tests__/replay-selection.test.ts` -- expected: selection/card regressions pass using the repository-local Jest cache if required.
- `npm --prefix apps/mobile test -- --runInBand src/components/__tests__/replay-renderer.test.ts` -- expected: font-path, Unicode and no-padding renderer regressions pass.
- `npm --prefix apps/mobile run typecheck` -- expected: TypeScript passes.
- `npm --prefix apps/mobile run lint` -- expected: lint passes.
- `npm run check` -- expected: current foundation checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- On Android and iOS, owner watches an ordinary and Vietnamese-labelled Replay chapter at 720p and confirms card duration/readability; record only the outcome, never media or label data.
