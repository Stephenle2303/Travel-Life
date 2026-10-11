---
title: 'Bring the agreed Living Atlas video Welcome into the mobile app'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '86e38a45176c8baa27730c711b2ad5d6bc4e7ab2'
context:
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0011-prototype-screens-as-product-ui.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The production mobile app still opens on its text-led Trust foundation screen, while the owner explicitly chose the prototype's beach/lake video Welcome as an official product screen.

**Approach:** Reuse the approved local portrait/wide promotional montage and Living Atlas hero composition as the mobile entry. Its primary action leads through the existing Trust and Import flow without changing live photo access or import semantics.

## Boundaries & Constraints

**Always:** Keep the media local, silent, clearly illustrative, and separate from a personalized replay. Preserve explicit pause/play, reduced-motion behavior, inactive/offscreen pausing, poster fallback, readable CTA, keyboard/accessibility labels, and the existing functional Import and empty Atlas screens. Use Expo SDK-compatible dependencies already exercised in the prototype.

**Never:** Trigger photo permission on Welcome, suggest the montage contains owner media, upload data, claim a completed travel history, or overwrite concurrent M1.4 work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| First entry | Open app at `/` | Welcome hero and private-reveal CTA | Poster remains readable if video is unavailable |
| Start | Press CTA | Navigate to Trust, then existing Import | No photo permission before owner action |
| Motion preference | Reduced, unknown, or lookup failure | Static poster by default | Explicit Play remains possible after preference resolves |
| Visibility | Background, route change, or scrolled-off hero | Video pauses | Welcome can be resumed deliberately |

</frozen-after-approval>

## Code Map

- `apps/prototype/src/components/travel-hero.tsx`, `hero-video*.tsx`, `src/data/hero-playback.ts` — working Welcome presentation and media lifecycle; reuse with production copy.
- `apps/prototype/assets/video/`, `assets/synthetic/hero/poster.jpg` — approved local montage and poster; copy only media used at runtime.
- `apps/mobile/src/app/index.tsx`, `src/navigation/app-contract.ts`, `src/components/mobile-screens.tsx` — current Trust root and navigation; move Trust to `/trust` and insert Welcome at `/`.
- `apps/mobile/src/components/__tests__/` — update route/flow coverage and add focused playback-policy checks.
- `apps/mobile/package.json`, lockfile — add Expo-compatible video and gradient dependencies; avoid touching import modules.

## Tasks & Acceptance

**Execution:**
- [x] Add local Welcome media and the approved hero/playback components to `apps/mobile`.
- [x] Route Welcome → Trust → Import → empty Atlas without changing permission or import behavior.
- [x] Add meaningful navigation, motion, and media-fallback tests; run mobile and root checks.
- [x] Update mobile README and project state with observed verification and remaining device/browser limits.

**Acceptance Criteria:**
- Given a fresh app entry, when Welcome loads, then it presents the video-led Living Atlas hero, private CTA, and illustrative-media disclosure.
- Given the CTA, when the owner starts, then Trust and the working Import remain reachable without a permission request on Welcome.
- Given reduced motion, an inactive page, or failed playback, when Welcome is visible, then a readable poster and working CTA remain.

## Implementation Notes

- Reused the approved local portrait/wide montage and poster from the prototype;
  added the Expo SDK 57 video, gradient, and asset dependencies.
- Kept Trust at `/trust` so Welcome at `/` can remain a clear first-run entry.
  No access request occurs before the existing Import flow.
- Replaced an M1.4 test's timing guess with a page-start promise after the full
  suite exposed the race; this preserves the interruption behavior under test.

## Verification Results

- 2026-10-10: `npm --prefix apps/mobile run check` passed with 74 Jest tests,
  TypeScript, Expo lint, and Expo Doctor (21/21) when run with npm cache/registry
  access. The sandbox-only Doctor invocation cannot write its npm cache.
- 2026-10-10: root `npm run check` passed framework integrity, 20 foundation
  tests, and eval smoke. `git diff --check` passed.

## Spec Change Log

## Review Triage Log

- false — The review diff used absolute paths only for temporary `git diff --no-index` entries; repository status retains the new files as normal workspace-relative paths.
- defer — Provider startup can open/migrate a private record before the Welcome CTA; this arises in the concurrent M1.4 lifecycle feature and needs its own owner-intent decision.
- defer — Disconnect cancels imports but does not invalidate an active photo count; this is concurrent M1.4 lifecycle behavior recorded in `deferred-work.md`.
- defer — Correction overlays accept unvalidated targets and predecessor links; this is an M1.4 persistence gap recorded for a dedicated correction lifecycle change.
- defer — Correction overlays have no retrieval path for later reconstruction/UI behavior; this is an M1.4 persistence gap recorded for a dedicated correction lifecycle change.
- defer — `private_history_record.schema_version` is distinct from the migrated database version but is currently ambiguous; this is an M1.4 persistence design gap recorded for follow-up.
- defer — Existing correction markers are not mapped to correction overlays; this is an M1.4 migration decision recorded for follow-up.
- defer — Confirmed deletion leaves Settings actions active during its transaction; this is an M1.4 lifecycle race recorded for follow-up.
- patch — Not-found recovery bypassed the official Welcome entry. It now routes to `appRoutes.welcome`, with the route test updated.
- patch — The Web video adapter treated a transient `stalled` event as a permanent blocked state. It now reserves the blocked fallback for rejected `play()` requests.
- defer — Mock-only SQLite lifecycle tests cannot establish migration, constraint, rollback, or concurrent-transaction behavior; recorded for device-storage testing.
- defer — The mobile CI gate omits every app suite, a pre-existing repository workflow boundary; recorded in `deferred-work.md` for a dedicated CI change.
- patch — Rejected browser `play()` promises had no direct test. `hero-video-web.test.ts` now asserts rejected and synchronous failures invoke the local fallback.
- defer — Completed import coverage can remain visible after deletion; this is concurrent M1.4 lifecycle behavior recorded in `deferred-work.md`.
- defer — Selected-photo picker access has no disconnected-record guard; this is concurrent M1.4 lifecycle behavior recorded in `deferred-work.md`.
- defer — Disconnect during a device-visible count can allow a later page read; this is concurrent M1.4 lifecycle behavior recorded in `deferred-work.md`.
- defer — A delayed lifecycle refresh can overwrite a deleted state; this is concurrent M1.4 lifecycle behavior recorded in `deferred-work.md`.
- patch — Welcome used a fixed 616 px scroll boundary. It now measures the rendered hero before deciding that the montage is offscreen.
- defer — Import lifecycle gating changes observed by the review are part of M1.4's disconnected-record behavior; they are outside the Welcome change and recorded with lifecycle follow-up.

## Verification

**Commands:**
- `npm --prefix apps/mobile run check` — mobile tests, typecheck, lint, Expo Doctor pass.
- `npm run check` — root foundation check passes.
