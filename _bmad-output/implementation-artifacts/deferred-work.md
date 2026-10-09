# Deferred work

- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-2-native-photo-permissions-and-access.md`
  summary: Run mobile and prototype app checks in CI as well as the root foundation check.
  evidence: The existing foundation workflow only installs root dependencies and runs root `npm run check`; app tests added in earlier M1.1/prototype work and M1.2 are not exercised there.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-2-native-photo-permissions-and-access.md`
  summary: Test rejected HTML video autoplay in the earlier prototype hero.
  evidence: The prototype web adapter handles a rejected `video.play()` promise, but current hero tests only cover mocked native playback failure, so a browser-only regression could pass.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-2-native-photo-permissions-and-access.md`
  summary: Reset prototype hero failure state when the portrait/wide video source changes.
  evidence: `mediaFailed` survives source switches in the earlier prototype implementation and can disable the alternate source until remount.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-3-import-metadata-resume-and-deduplicate.md`
  summary: Make nested fictional atlas markers win over the map pan responder.
  evidence: The earlier synthetic-prototype map claims its pan responder for every touch, which can consume marker presses. It is unrelated to M1.3's production import boundary and needs a separately scoped prototype interaction change.
