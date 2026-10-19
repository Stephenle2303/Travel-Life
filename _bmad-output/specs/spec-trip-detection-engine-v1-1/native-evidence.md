# Native evidence and capability contract

Verified in installed `expo-media-library` 57.0.5, not inferred from the newest SDK.
`src/types/Asset.ts` exposes creation/location/EXIF getters and iOS-only subtypes.
Android `AssetModernDelegate.kt` and `AssetLegacyDelegate.kt` use MediaStore
DATE_TAKEN for creation time. iOS `Asset.swift` maps PHAsset.creationDate.
These are native catalog capture instants, not original EXIF offsets.

## Fixed implementation choice

Retain catalog pagination and local preview infrastructure. Add a small local
Expo native metadata module; do not patch node_modules. Its only public operation
is `readCaptureMetadata(assetIds, options)` with explicit current-permission,
localOnly=true, maximum8 concurrent reads, page<=100 and cancellation token.
It returns normalized metadata, never filenames, paths, EXIF blobs or bytes.
Run no more than a 2-second batch before yielding/checkpointing. Resume from stable
IDs/revisions, not a claim that mutable offset pagination is a snapshot.

On iOS use PHAsset resource/content-editing input with network access disabled,
ImageIO for local image properties, and PHAsset subtype for screenshot exclusion.
On Android use permitted content resolver streams, MediaStore DATE_TAKEN and
AndroidX ExifInterface already used by the installed package. Read original
date/time, original offset, subsecond, camera make/model, dimensions, image unique
ID and GPS uncertainty if present. Files known to be Downloads/Screenshots via
native relative-path/source metadata become excluded support; persist only that
classification, never the path. Unknown source is explicitly unknown.

Why a bridge is necessary: installed iOS `getExif()` calls `UriExtractor`, whose
image path sets `isNetworkAccessAllowed=true`; installed Android `ExifTags.kt`
does not export OffsetTimeOriginal. Stock Location only contains latitude/longitude.
Calling stock EXIF everywhere would violate the no-download contract and would
not solve the offset requirement. Cloud-only originals return metadataUnavailable;
no download/retry loop. Platform framework failure degrades fields, not the app.

## Normalized fields and fallbacks

| Field | Authoritative source | Missing/conflicting behavior |
| --- | --- | --- |
| stable source ID, media kind, source revision | Native catalog | Missing stable ID cannot join automatic reconstruction |
| captureInstant | Valid original date+offset; else native DATE_TAKEN/PHAsset.creationDate | Record source separately; never use modification/upload time |
| originalLocalDay/time/offset | Valid original EXIF fields | Keep null; native instant alone cannot supply original local day |
| timeConflict | Original instant vs native instant difference >24h | Exclude from auto support until resolved; preserve both normalized values |
| location, accuracy | Permitted native GPS/EXIF | Missing GPS attaches conservatively; unknown accuracy gets algorithm policy margin |
| origin | Known screenshot/download, else capture-like or unknown | Capture-like requires valid original capture day/time plus nonempty camera make/model and no known unsupported flag; it is a heuristic, not verified owner presence |
| duplicate identity | Existing verified family tuple; original ID scoped to camera; otherwise conservative capture-unit grouping | No fabricated durable duplicate-family ID from similarity |
| local availability | Local-only native probe | Cloud/unavailable cannot supply new reliable auto support; preserve existing owner decisions |

Capture-like fields alone cannot prove that an image was not downloaded; preserve
that limitation. Do not claim universal source detection. EXIF-less unknown-origin
images can attach as memories when bracketed but cannot satisfy the five-photo
or geotag support gates. Owner-reviewed media may be preserved without converting
its GPS into proof. This sacrifices some coverage and must be measured explicitly.

Validate original dates by actual calendar roundtrip, offsets within +/-14h and
minutes0..59, finite instant, and no future instant >24h beyond run start. Reject
malformed dates instead of parser rollover. Offsetless original time and trustworthy
native instant may coexist; never reverse-engineer an offset from their difference.
Unknown local day means zero local-day/routine-time bonuses, not no elapsed order.

GPS-less capture-like photos may count only through algorithm.md's exact bracket;
unknown-origin images/videos do not count even if visually plausible. Media access
revocation cancels reads and invalidates unpublished metadata; no URI in React
list state, logs, shared manifests or public fixtures. Do not equate missing media
download with missing safe catalog location metadata, but location-only cloud
records cannot manufacture the independent capture/photo gate.

## Evidence for the design

- [Expo MediaLibrary documentation](https://docs.expo.dev/versions/latest/sdk/media-library/)
  documents granular metadata getters and platform-specific capabilities. Installed
  source, not latest docs, controls this integration's actual behavior.
- [Android ExifInterface](https://developer.android.com/reference/androidx/exifinterface/media/ExifInterface)
  defines original capture time and its separate UTC offset tag.
- [Android MediaStore image columns](https://developer.android.com/reference/android/provider/MediaStore.Images.ImageColumns)
  provides DATE_TAKEN. Device metadata can be edited; neither it nor EXIF is proof
  of presence.

Physical synthetic-library tests validate no-network cloud handling, timezone
preservation, Android permissions, cancellation and known screenshot flags. A
missing test device is a reported execution limitation, not a new design choice.
