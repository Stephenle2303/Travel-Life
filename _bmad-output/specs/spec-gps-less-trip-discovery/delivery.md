# Delivery record: GPS-less trip discovery (decision 0019)

Status: decision core delivered and unit-tested. NOT wired into the app. Nothing here runs on a device yet.

## Delivered (apps/mobile/src/travel-window/, tests in src/components/__tests__/travel-window.test.ts, 23 passing)
- window-detector: travel-looking windows from metadata only (burst + clock-offset shift or far-from-home edge fix); a burst alone, or one sign/landmark clue, stays silent.
- membership: owner camera captures only, no size cap; messaging/screenshot/download excluded; unknown provenance goes to review.
- naming: a place is named only when >=2 independent clues agree with no conflict; metadata never names a place; on-device model clues are off until Story 1 proves it answers UNKNOWN; owner answer always wins.
- story-card: facts-only copy by default, no country shown unless confirmed by agreeing clues, no "where you were not" copy, "Not a trip" always offered.
- Thresholds are provisional defaults until Story 1.

## Capture metadata reader (2026-11-19)
- Native `TravelLifeSignage.readCaptureMetadata(uri)` (Android, Kotlin): returns only `offsetTimeOriginal`, `offsetTimeDigitized` (EXIF strings, max 16 chars) and `relativeDirectory` (storage-relative folder, file name dropped; MediaStore `RELATIVE_PATH` on API 29+, path-derived for `file://`). No GPS, ids, names or timestamps cross the bridge. Rejections: `ERR_CAPTURE_INPUT`, `ERR_CAPTURE_ACCESS`, `ERR_CAPTURE_DECODE` with fixed messages.
- `src/travel-window/capture-metadata.ts` (pure): parses `±HH:MM` offsets (original, then digitized; anything else unknown), classifies provenance from the folder (screenshot > messaging > download > `DCIM/Camera` camera > unknown), rejects malformed results as `MEDIA_SCHEMA`, and `scanCaptureMetadata` builds CaptureRecords. `native-capture-metadata.ts` binds the optional native function (null on iOS/older builds).
- Scan behavior: native reader missing → `skipped/MEDIA_UNAVAILABLE`; access loss → stop, `blocked/MEDIA_ACCESS` (no partial library); one unreadable capture → kept as unknown provenance, no offset (review only, never album); cancel → `skipped/SKIPPED`; success → `COMPLETE`.
- Diagnostic map: operation `TRAVEL_WINDOW_SCAN`, stage `CAPTURE_METADATA_READ`, reasons `MEDIA_UNAVAILABLE | MEDIA_ACCESS | MEDIA_DECODE | MEDIA_SCHEMA | UNKNOWN | SKIPPED | COMPLETE`; one event per distinct reason, one local correlation ID per scan. Source boundary: `TravelLifeSignageModule.kt` `readCaptureMetadata` → `classifyCaptureMetadataError`.
- Tests: `src/components/__tests__/travel-window-capture-metadata.test.ts` (50) cover offset parsing, folder classes, schema rejection, each failure path and diagnostic redaction (no paths, ids, folder names or offsets in events).
- Unverified: the Kotlin code has not been compiled or run. No Gradle cache exists and a fresh Android build previously exhausted disk (8.6 GB free on 2026-11-19). Folder names are assumptions for HyperOS until Story 1 reads the owner's phone. iOS has no implementation (reader returns null → skipped).

## Not delivered / unverified
- Compiling and running the native capture reader on the Xiaomi 15 (see above). Wiring the scan into the app.
- Story 1 on the Xiaomi 15 (offset present? UTC-vs-local mismatch? Nano honesty).
- OCR, gazetteer and landmark-pack providers feeding Clue records; the UI card; persistence of owner answers.
- Domestic gate.

## Diagnostic map (required before wiring; fixed reason codes)
Window decisions: `travel-looking`, `no-strong-clue`, `single-provider-clue`.
Naming abstentions: `no-claims`, `model-only`, `single-clue`, `conflicting-clues`.
Membership exclusions: `messaging`, `screenshot`, `download`, `located`.
Diagnostics must carry these codes and counts only, never asset ids, places or timestamps.
