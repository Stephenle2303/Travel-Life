# Travel Life mobile app

This is the shared Expo / React Native / TypeScript application for iOS and Android. M1.3 adds an owner-initiated, device-local metadata import: it pages the current permitted photo/video scope, stores opaque source IDs with nullable capture and location-availability fields in SQLite, and checkpoints committed pages for resume. It never uploads, decodes, copies, or displays media, paths, filenames, IDs, coordinates, or a travel conclusion. The Atlas stays non-reconstructive.

## Windows setup

From PowerShell:

```powershell
cd "C:\Users\vothi\Desktop\Travel Life\apps\mobile"
npm ci
npm run start
```

Use the target controls from the running Expo development server (or scan its QR code) to open a client. Alternatively, run exactly one of `npm run android`, `npm run ios`, or `npm run web` instead of `npm run start`; each starts its own Expo development server. The project has its own lockfile and dependencies; the root foundation package remains separate. Photo permission changes require a fresh native development build; a web preview reports native access unavailable.

## Checks

Each command is independent:

```powershell
npm run test
npm run typecheck
npm run lint
npm run doctor
npm run check
```

`npm run check` runs Jest, TypeScript, Expo lint, and Expo Doctor in sequence. The repository-level `npm run check` is a separate foundation check.

## Android development build

Install Android Studio plus a supported Android SDK/device driver, connect an Android device with USB debugging enabled, then run:

```powershell
npm run android:device
```

This invokes `expo run:android --device`, creating and installing a local development build when the Android toolchain is available. On Import, confirm no prompt appears before tapping **Allow full photo library**. Then test full access, Android 14+ limited access where available, denial, revocation in Settings, foreground return, and explicit picker cancellation/selection. Verify the count is labelled for the current access scope and that Atlas remains empty.

## iOS development build

Physical iOS development builds require macOS with Xcode. On that machine, run:

```bash
npm run ios:device
```

This Windows workspace cannot prove iOS device behavior. An EAS build profile has not been configured for this repository. After a macOS build, perform the same manual Trust → Import → Atlas checks. Test iOS limited access and **Manage limited selection** as well as full access, denial, revocation, and picker cancellation/selection.

## Private device sample procedure and status

Use a consented small sample on each physical platform with a local photo, a local video, a geotagged item, an item with no GPS, and a cloud-only item if the owner has one. Observe the OS access prompt, whether each item contributes to the device-visible count, whether GPS is available to the media API after granting the configured Android media-location permission, and whether cloud-only media is represented without downloading it. Record only aggregate observations in the M1.2 delivery record; keep images, IDs, filenames, URIs, coordinates, and raw traces out of Git. Also inspect the generated iOS usage description and Android merged permission manifest in each development build.

An owner-operated Android development build completed the M1.2 full/limited/selected permission and revocation checks on 2026-10-09; its scoped full-library count was 298 device-visible items. No M1.3 SQLite import was run on that device. Physical iOS behavior, GPS/cloud-only behavior, installed Android manifest inspection, and M1.3 start/cancel/resume/repeat-import checks remain pending. Expo config introspection showed the intended iOS photo-use text. A generated Android manifest included read photo/video, selected visual media, and media-location permissions, with camera, microphone, and write-storage marked for removal during manifest merge.

## Local import boundary

The local `expo-sqlite` index (`~57.0.4`) has only a resumable checkpoint and opaque source metadata index. Its records contain an opaque device-local asset ID, image/video type, nullable capture and modification timestamps, nullable location availability, and availability state. It stores no filename, URI, coordinates, EXIF, image/video bytes, journey, visit, or correction data. Stable IDs are upserted; correction markers are a separate table untouched by import rescans. M1.4 owns canonical evidence/history, correction lifecycle, disconnect, and deletion.

Rebuild an Android development client after adding SQLite, then use a consented small sample to start, cancel, resume, and repeat an import. Record only aggregate accessible/scanned/geotagged/unavailable counts plus permission/GPS/cloud/resume observations. The same physical iOS check remains pending. Current-scope counts are never lifetime coverage.

## Automatic maintenance

M1.5 adds an owner-controlled, initially off maintenance toggle after a completed full or limited import. It uses `expo-background-task` and `expo-task-manager` to register the named `travel-life-library-maintenance-v1` task, with iOS processing support configured through Expo CNG. The OS controls if and when scheduled work runs; the app never promises an exact cadence, immediate photo trigger, force-quit execution, or continuous location tracking. The headless task loads only persisted normalized metadata state, checkpoints each page, serializes overlapping runs with a renewable recovery lease, and queues aggregate-safe additions, changes, newly available items, and deletions after two completed full scans for M2.6. Limited-scope absence is always an access limit, never a deletion.

Rebuild both native development clients before trying the control. On physical iOS and Android, complete an import, enable maintenance, invoke the development-only task trigger, inspect Settings, revoke photo access, then disconnect and delete history. Record only aggregate outcomes. Jest verifies handler and persistence behavior; it does not prove OS scheduling, physical-device task expiry, SQLite migration/deletion, iOS background processing, or production cadence.
