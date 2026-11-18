# Travel Life mobile app

The agreed prototype screens, including the video Welcome, are the official UI
targets for this app. Follow the [Living Atlas design system](../../docs/product/design-system.md)
and [decision 0011](../../docs/decisions/0011-prototype-screens-as-product-ui.md)
as production screens are delivered. The app opens on the video Welcome, whose
**Explore my travel life** action leads to Trust → Import → empty Atlas. The
bundled portrait/wide montage and poster are silent illustrative media, not
owner photos or a personal Replay. Welcome requests no photo permission, sends
no data, pauses when inactive or scrolled out of view, and offers a labeled
pause/play control. Reduced motion starts with a still poster; a failed video
also leaves the poster and action available.

This is the shared Expo / React Native / TypeScript application for iOS and Android. M1.3 adds an owner-initiated, device-local metadata import: it pages the current permitted photo/video scope, stores opaque source IDs with nullable capture and location-availability fields in SQLite, and checkpoints committed pages for resume. It never uploads, decodes, copies, or displays media, paths, filenames, IDs, coordinates, or a travel conclusion. The Atlas stays non-reconstructive.

## Windows setup

From PowerShell:

```powershell
cd "C:\Users\vothi\Desktop\Travel Life\apps\mobile"
npm ci
npm run start
```

Use the target controls from the running Expo development server (or scan its QR code) to open a client. Alternatively, run exactly one of `npm run android`, `npm run ios`, or `npm run web` instead of `npm run start`; each starts its own Expo development server. The project has its own lockfile and dependencies; the root foundation package remains separate. Photo permission changes require a fresh native development build; a web preview reports native access unavailable.

For an installed development client over USB/localhost, start interactive Metro
from this directory with `CI` unset. Expo disables watch mode and reloads when
`CI=true`, so later source edits may leave the phone running an older bundle.
The following changes only this shell's environment and clears Metro's transform
cache; it does not clear app history or credentials:

```powershell
Remove-Item Env:CI -ErrorAction SilentlyContinue
node --dns-result-order=ipv4first ./node_modules/expo/bin/cli start --dev-client --localhost --port 8081 --clear
```

Confirm startup has no CI/reloads-disabled warning, keep the existing USB reverse
mapping for port 8081, and reload the development client. Verify the current routed
Android bundle and matching structured diagnostics before claiming a fix reached
the phone; an incremental bundling line alone does not establish freshness.

For the partial Seoul development preview, set these variables before starting
Metro with the same localhost command. `EXPO_OFFLINE=1` keeps Expo CLI startup
offline. The installed development client must include the `TravelLifeSignage`
native module. Open the Local Atlas Timeline with on-device trip discovery
enabled by the owner. Atlas supplies the date range and album from evidence.

```powershell
$env:EXPO_OFFLINE = '1'
$env:EXPO_PUBLIC_TRAVEL_LIFE_LOCAL_RECOVERY = 'true'
$env:EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW = 'true'
$env:EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW = 'true'
```

The regional development preview additionally requires a qualified public
artifact from the [regional benchmark](../../evals/landmarks/README.md#automatic-regional-retrieval).
Use the report's `releaseManifestSha256` value. Serve only the public release
directory on a loopback-only port and reverse that port over the Android USB
connection alongside Metro. Leave the regional variables unset when the
report has no release digest. The example below assumes a verified release
served at port 8091.

```powershell
$env:EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW = 'true'
$env:EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_ORIGIN = 'http://127.0.0.1:8091'
$env:EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_MANIFEST_SHA256 = $releaseManifestSha256
adb reverse tcp:8091 tcp:8091
```

## Checks

Each command is independent:

```powershell
npm run test
npm run test:sqlite
npm run typecheck
npm run lint
npm run doctor
npm run check
```

`npm run check` runs Jest, SQLite fixtures, TypeScript, Expo lint, and Expo Doctor in sequence. The repository-level `npm run check` is a separate foundation check. The full synthetic account SQL suite runs separately from the checkout root with `./scripts/test-private-history-postgres.ps1 -FullSuite`.

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

This Windows workspace cannot prove iOS device behavior. An EAS build profile has not been configured for this repository. After a macOS build, perform the Welcome → Trust → Import → Atlas flow, including reduced motion, backgrounding, and video fallback. Test iOS limited access and **Manage limited selection** as well as full access, denial, revocation, and picker cancellation/selection.

## Private device sample procedure and status

Use a consented small sample on each physical platform with a local photo, a local video, a geotagged item, an item with no GPS, and a cloud-only item if the owner has one. Observe the OS access prompt, whether each item contributes to the device-visible count, whether GPS is available to the media API after granting the configured Android media-location permission, and whether cloud-only media is represented without downloading it. Record only aggregate observations in the M1.2 delivery record; keep images, IDs, filenames, URIs, coordinates, and raw traces out of Git. Also inspect the generated iOS usage description and Android merged permission manifest in each development build.

An owner-operated Android development build completed the M1.2 full/limited/selected permission and revocation checks on 2026-10-09; its scoped full-library count was 298 device-visible items. Subsequent M1.3 import observations are recorded in `docs/project-state.md`. Physical iOS behavior, GPS/cloud-only behavior, and installed Android manifest inspection remain pending. Expo config introspection showed the intended iOS photo-use text. A generated Android manifest included read photo/video, selected visual media, and media-location permissions, with camera, microphone, and write-storage marked for removal during manifest merge.

## Local import boundary

The local `expo-sqlite` index (`~57.0.4`) has only a resumable checkpoint and opaque source metadata index. Its records contain an opaque device-local asset ID, image/video type, nullable capture and modification timestamps, nullable location availability, and availability state. It stores no filename, URI, coordinates, EXIF, image/video bytes, journey, visit, or correction data. Stable IDs are upserted; correction markers are a separate table untouched by import rescans. M1.4 owns canonical evidence/history, correction lifecycle, disconnect, and deletion.

Rebuild an Android development client after adding SQLite, then use a consented small sample to start, cancel, resume, and repeat an import. Record only aggregate accessible/scanned/geotagged/unavailable counts plus permission/GPS/cloud/resume observations. The same physical iOS check remains pending. Current-scope counts are never lifetime coverage.

## Private record lifecycle

M1.4 migrates the same `travel-life-import-v1.db` in place. It adds normalized canonical evidence, empty-ready inferred-history storage, revisioned local correction overlays, lifecycle state, and an explicit cache registry. It retains no original media, filename, URI, raw EXIF, precise coordinate, or source path. The M1.3 source index and opaque references remain so an owner can deliberately reconnect and repeat a deduplicated import.

The owner selected normal OS/device backups for the local private record. A restore is therefore governed by the platform and backup-account protections; this project does not claim SQLite encryption. **Disconnect photo source** stops future reads and maintenance while retaining the private record, source references, and checkpoints. **Delete local history** requires confirmation and clears the covered local evidence, history, corrections, checkpoints, lifecycle state, and registered caches. It never deletes original media or claims to delete remote copies.

## Automatic maintenance

M1.5 adds an owner-controlled, initially off maintenance toggle after a completed full or limited import. It uses `expo-background-task` and `expo-task-manager` to register the named `travel-life-library-maintenance-v1` task, with iOS processing support configured through Expo CNG. The OS controls if and when scheduled work runs; the app never promises an exact cadence, immediate photo trigger, force-quit execution, or continuous location tracking. The headless task loads only persisted normalized metadata state, checkpoints each page, serializes overlapping runs with a renewable recovery lease, and queues aggregate-safe additions, changes, newly available items, and deletions after two completed full scans for M2.6. Limited-scope absence is always an access limit, never a deletion.

Rebuild both native development clients before trying the control. On physical iOS and Android, complete an import, enable maintenance, invoke the development-only task trigger, inspect Settings, revoke photo access, then disconnect and delete history. Record only aggregate outcomes. Jest verifies handler and persistence behavior; it does not prove OS scheduling, physical-device task expiry, SQLite migration/deletion, iOS background processing, or production cadence.

## Optional account entry (M6.1, in development)

Settings -> Account and sources uses an isolated email OTP session. Set
EXPO_PUBLIC_TRAVEL_LIFE_ACCOUNT_ENABLED=true only with the intended Supabase URL
and publishable key. Configure the Auth email template with {{ .Token }}, actual
OTP length/expiry and server rate limits. Custom SMTP/Send Email hook is required
for general production delivery; default hosted email restrictions are not app bugs.
Account login alone never uploads history/media or enables AI/publication.

Native credentials use a separate generation/chunk SecureStore namespace with a
persistent local signout fence. Web account sessions are memory-only. Verify actual
email delivery, app restart/refresh, local signout and keyboard/large-text layout on
Android and iOS before claiming physical acceptance. Never use personal email/media
in automated tests. The current milestone remains in progress.
### Private reconstruction preview

In a development build, set
`EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW=true` and restart Metro.
Open connected **Local history** with full photo access, then go to
**Settings → Reconstruction preview**. The comparison uses saved evidence
from a current committed reconstruction. It can show reliable candidates and
Possible trips with authorized covers. It does not publish candidate trips,
save answers, or alter Replay.

For verification, use the current development process and filter only the
closed `ATLAS_REBUILD` candidate stages and `ATLAS_PREVIEW / PREVIEW_MEDIA`
for one action correlation. Keep photo content and raw identifiers on the
device. The preview remains disabled by default and in release builds.
