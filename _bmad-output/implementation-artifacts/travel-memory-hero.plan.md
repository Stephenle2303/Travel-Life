---
title: 'Your travels. Alive again. — welcome hero and video'
status: complete
created: '2026-10-07'
authorization: 'User: cool, rebuild with this, create the implementation plan, I also need video'
---

## Goal

Replace the welcome hero's shaded rainforest photograph with a vivid travel-memory loop while preserving the isolated synthetic prototype and existing owner flow. The approved direction is a calm precise Living Atlas interface carrying joyful color and human travel moments.

## Deliverables and sequence

1. **Media:** generate six local fictional editorial scenes (beach, turquoise alpine lake, heritage street, street food, welcoming adult market vendor, coastal mountains). Create silent H.264 MP4 variants for portrait and desktop, approximately 15 seconds, with gentle pans, brief dissolves and a continuous final-to-first transition. Save a vivid poster and reproducible encoder script. The available built-in generator makes still imagery; the initial playable video is an animated photo montage. True scene-motion generation requires the suggested Runway account connection and must not be claimed until executed.
2. **Hero:** add `apps/prototype/src/components/travel-hero.tsx` and integrate in `WelcomeView`. Use the headline “Your travels. Alive again.” and “Rediscover the places, people, and moments tucked inside your photos.” Give imagery breathing room, use a localized dark scrim, retain precise forest/limestone controls, move numerical sample stats out of the hero, and keep the CTA easy to reach on mobile and desktop. Clearly mark synthetic demo imagery.
3. **Playback:** use Expo's compatible video component with local assets, muted looping playback, pause/play, no audio, and poster fallback. Reduced motion starts static and never auto-plays; a deliberate play remains available. App background and page visibility pause playback. Rejected autoplay and failed media must leave a readable poster and working navigation.
4. **Verification:** test the playback policy and welcome navigation. Run prototype tests, typecheck, lint, Expo Doctor and root foundation checks. Preview at 390×844 and 1440×900; inspect every encoded frame for decode failures, inspect all shot/transition frames and loop seam visually in the browser, check portrait/desktop crops, readable copy, pause/play, reduced motion and static fallback. Record exactly what was checked, with screenshots/contact sheets.
5. **Handoff:** update README and project state with asset paths, generation prompts, actual verification, remaining physical-device limitations and any unconnected provider work.

## Files

- `apps/prototype/assets/synthetic/hero/` — source images/poster; `apps/prototype/assets/video/` — playable portrait/wide MP4s.
- `apps/prototype/scripts/render-travel-hero.py` — deterministic montage encoder, called with a local FFmpeg path.
- `apps/prototype/src/components/travel-hero.tsx` — responsive media, copy, controls, poster.
- `apps/prototype/src/components/prototype-screens.tsx` — use hero; preserve access/reveal/detail/replay/share routes.
- `apps/prototype/src/data/hero-playback.ts` and tests — pure accessibility/playback policy.
- `apps/prototype/package.json`, lockfile — Expo-compatible video dependency only.
- `apps/prototype/README.md`, `docs/project-state.md` — evidence and limits.

## Acceptance

- Given default browser settings, when Welcome opens, then a local silent video loops and its headline/CTA stay readable at both sizes.
- Given reduced motion, pause, background, rejected autoplay, or failed media, when that condition applies, then motion stops or a static poster remains and the owner flow works.
- Given the montage, when each shot, each dissolve, and the loop boundary are inspected, then framing retains key subjects, transitions contain no black frames, and the first/last frame match visually.
- Given the demo, when its text and source are inspected, then invented promotional media cannot be mistaken for reconstructed owner evidence; real library access, publication, and the separate lifetime replay remain simulated.

## Decisions

Continue in the user-approved dirty worktree. Do not commit or push. No account purchase or paid generation is authorized implicitly. Keep the actual video limitation visible in the delivery evidence, not in emotional headline copy. Python/FFmpeg is used for encoding, not image editing.

## Verification evidence

Completed on 2026-10-08:

- Prototype `npm run check`: 36 tests (12 Node + 24 Jest), TypeScript, lint and Expo Doctor (21/21) passed. Root `npm run check` passed. Static web export passed.
- Both H.264 MP4 variants strictly decoded with FFmpeg `-xerror`: 360 frames each at 24 fps. Browser `public/hero-qa.html` rendered six serialized 60-frame portrait contact sheets, covering frames 0–359; visual checks included transitions and the final-to-first seam.
- Chrome responsive browser checks passed at 390×844 and 1440×900: portrait/wide asset selection, readable copy/CTA, muted autoplay, pause control and access-flow navigation. Reduced-motion, lifecycle, navigation/off-screen and media-error behavior are covered by the playback/component tests.
- True generated scene motion remains pending an authorized connected video provider. The delivered clips are explicitly labelled animated-photo montage media.

## Review Triage Log

- medium — Welcome could remain mounted under a pushed route and continue decoding; `WelcomeView` now passes path focus to the hero, which blocks playback. Patched and covered by the inactive-screen playback test.
- low — A scrolled-off hero could keep decoding; the shared screen reports scroll position and Welcome pauses the hero after its visible region. Patched.
- low — The web adapter did not handle an HTML video `stalled` event; it now takes the same poster/retry path as blocked playback. Patched. Direct adapter unit coverage remains excluded because Jest resolves the native adapter; browser playback exercised the web adapter.
- low — An accessibility lookup failure left a disabled control; it now resolves to the safe reduced-motion state, so automatic playback remains off but explicit play is possible. Patched and tested.
- low — Decoder success could rely only on FFmpeg's default error handling; encoder validation now uses `-xerror`. Strict final decode passed.
- low — The frame-inspection helper could be started before metadata or concurrently. It now disables controls until ready, serializes operations, cancels stale jobs on reload, and exposes timeout/failure status. Patched and browser-exercised.
