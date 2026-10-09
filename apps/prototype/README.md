# Travel Life Living Atlas prototype

This standalone Expo Router app is a **synthetic, local-only owner-flow prototype**. It demonstrates Welcome → simulated photo-access choice → simulated import → private reveal → exploration/correction → replay preview → selected-highlight preview in one dark, responsive Living Atlas system. The welcome screen includes a bundled, silent 15-second animated-photo montage with a poster fallback; it is promotional demo media, not an owner replay or evidence.

The visual prototype uses only three generated fictional landscapes bundled under `assets/synthetic/`. Cards, journey detail, replay, and sharing previews never request a remote image. The reveal uses a dependency-free, bundled **fictional geographic atlas**, not a real map: its land labels and anchors are visibly synthetic, it has local pan/zoom/fit controls, and it never requests tiles or a map provider. The same year and selected-journey state drives Map and Timeline. A missing fictional coordinate is never invented onto the atlas; it stays in Timeline, which is also the explicit recovery path if the atlas cannot render. Atlas / Replay / Highlight plus Home and Back navigation preserve the in-memory session; leaving replay stops it. The app switches between stacked mobile and two-zone desktop layouts and honors the operating system's reduced-motion preference. Native haptics are intentionally not bundled; the tactile adapter is silent on unsupported platforms.

It has no account, permission API, photo-library access, persistence, backend, AI call, map provider, public URL, lifetime-replay rendering, or export action. Every journey, place, date, source-coverage label, and memory is invented for the prototype. A correction only changes in-memory state for the active session.

## Windows setup and run

From PowerShell:

```powershell
cd "C:\Users\vothi\Desktop\Travel Life\apps\prototype"
npm install
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` to ask Expo to open a selected target after the server starts. `npm run ios` needs a compatible macOS/iOS development environment; it is not verified from this Windows workspace.

Run the local quality commands independently of the repository foundation package:

```powershell
npm run test
npm run typecheck
npm run lint
npm run doctor
npm run check
```

`npm run check` combines the prototype tests, TypeScript check, Expo lint, and Expo Doctor. The root `npm run check` remains a separate foundation check.

## What to test manually

1. Welcome → **Set up private reveal** → select a simulated full-library or selected-photo option → **Start simulated scan**.
2. Confirm the access screen explains that local app storage needs no operating-system permission and Google Photos is not connected. These controls do not invoke a permission API or inspect a library.
3. Filter a year, pan or zoom the bundled synthetic atlas, use **Fit demo atlas**, select a fictional demo anchor or Timeline card, and verify the detail title/status agree. The geographic illustration must never imply a real location, route, visit, or network map request.
4. Confirm or rename a journey and read the session-only notice.
5. Start replay, allow the destination transition, then cancel it. It must state that no video was rendered or exported.
6. Move among Atlas, Replay, Highlight, Home and Back. Confirm the filter, correction and selected highlight remain in the active in-memory session, replay stops when exited, and nothing publishes.
7. Open the sparse and declined-access examples and confirm that they show limited states rather than a fabricated travel story.
8. At 390×844 and 1440×900, confirm the atlas remains dominant, the dock/scrubber/list/actions remain reachable, keyboard focus is visible, and no horizontal scrolling appears.
9. Enable reduced motion and repeat year selection, card expansion, replay cancellation, and highlight selection; no task should depend on animation or vibration.
10. On Welcome, confirm the local montage is muted, pauses on command and while the screen is inactive/off-screen, honors reduced motion, and falls back to the bundled poster if video playback fails. The `public/hero-qa.html` helper can inspect all 360 frames in six browser-decoded contact sheets.

## Welcome video media

`assets/video/travel-hero-portrait.mp4` and `assets/video/travel-hero-wide.mp4` are local 15-second H.264 animated-photo montages assembled from the six clearly synthetic images in `assets/synthetic/hero/`. `scripts/render-travel-hero.py` recreates them when supplied an FFmpeg executable. This is not text-to-video scene generation: the loop uses subtle zooms and cross-dissolves over fictional still imagery. It contains no audio, real people, owner media, or travel evidence.

## Planned production handoff

The `MapCanvas` component is a replaceable dependency-free bundled illustration. Production map-provider selection and native map work belong to their own delivery story and must preserve the list fallback; no provider has been chosen by this prototype. Native photo access, SQLite persistence, corrections across restart, background maintenance, real replay rendering/export, backend/AI services, and interactive shared links are also deferred to their owned M1–M5 stories. This prototype does not validate reconstruction accuracy, device behavior, provider configuration, production privacy controls, or release readiness. Automated checks do not replace physical iOS/Android or responsive browser walkthroughs.
