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
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-mobile-video-welcome.md`
  summary: Add a mobile-app CI gate that installs and checks apps/mobile.
  evidence: The foundation workflow runs only the root check, so mobile Welcome and lifecycle regressions can pass the repository gate without running the registered mobile suite.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-mobile-video-welcome.md`
  summary: Make disconnected and deleted private-record transitions stop every photo-source read and clear stale import coverage.
  evidence: The concurrent lifecycle work cancels imports but does not currently invalidate an active photo count or guard selected-photo picker access, and completed coverage can remain displayed after deletion.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-mobile-video-welcome.md`
  summary: Make private-record lifecycle creation and transitions atomic and owner-visible.
  evidence: Provider startup opens and migrates the database before the Welcome CTA, while delayed refreshes and rapid Settings actions can race lifecycle state; this requires a dedicated M1.4 lifecycle design and device validation.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-mobile-video-welcome.md`
  summary: Complete correction-overlay lineage, validation, retrieval, and migration from prior correction markers.
  evidence: The concurrent M1.4 store accepts overlays without validating targets or predecessor chains, exposes no read path, uses an ambiguous record schema version, and does not map legacy markers into the new model.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-mobile-video-welcome.md`
  summary: Exercise SQLite M1.4 migration, deletion, constraints, and concurrent lifecycle transitions against a real database.
  evidence: Current lifecycle tests use a permissive mock and cannot prove transactional device-storage behavior.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-4-persist-privately-and-provide-disconnect-delete.md`
  summary: Run the M1.4 migration and confirmed-deletion lifecycle against a disposable real Expo SQLite database in a development build.
  evidence: The checked-in regressions validate SQL contracts with a mock; the current story records physical-device SQLite migration and deletion as pending.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-4-persist-privately-and-provide-disconnect-delete.md`
  summary: Complete the concurrent Welcome review with a scroll-boundary pause test, target runtime media smoke checks, measured visibility, and a Welcome home-route recovery check.
  evidence: These findings concern the separate uncommitted Welcome implementation, whose current unit tests mock both platform video adapters and do not exercise its scroll caller boundary.
- source_spec: `C:/Users/vothi/Desktop/Travel Life/_bmad-output/implementation-artifacts/spec-m1-5-discover-library-changes-in-scheduled-background-work.md`
  summary: Verify the M1.5 SQLite migration and scheduled task lifecycle in physical Android and iOS development builds.
  evidence: Jest validates repository and TaskManager contracts with mocks, but does not prove Expo SQLite migration, OS registration/execution, task expiry, access revocation, or deletion cancellation on a device.
