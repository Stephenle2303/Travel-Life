# Delivery record: GPS-less trip discovery (decision 0019)

Status: decision core delivered and unit-tested. NOT wired into the app. Nothing here runs on a device yet.

## Delivered (apps/mobile/src/travel-window/, tests in src/components/__tests__/travel-window.test.ts, 23 passing)
- window-detector: travel-looking windows from metadata only (burst + clock-offset shift or far-from-home edge fix); a burst alone, or one sign/landmark clue, stays silent.
- membership: owner camera captures only, no size cap; messaging/screenshot/download excluded; unknown provenance goes to review.
- naming: a place is named only when >=2 independent clues agree with no conflict; metadata never names a place; on-device model clues are off until Story 1 proves it answers UNKNOWN; owner answer always wins.
- story-card: facts-only copy by default, no country shown unless confirmed by agreeing clues, no "where you were not" copy, "Not a trip" always offered.
- Thresholds are provisional defaults until Story 1.

## Not delivered / unverified
- Native Android reader for capture offset (OffsetTimeOriginal) and provenance (folder/app origin). Expo MediaLibrary exposes neither.
- Story 1 on the Xiaomi 15 (offset present? UTC-vs-local mismatch? Nano honesty).
- OCR, gazetteer and landmark-pack providers feeding Clue records; the UI card; persistence of owner answers.
- Domestic gate.

## Diagnostic map (required before wiring; fixed reason codes)
Window decisions: `travel-looking`, `no-strong-clue`, `single-provider-clue`.
Naming abstentions: `no-claims`, `model-only`, `single-clue`, `conflicting-clues`.
Membership exclusions: `messaging`, `screenshot`, `download`, `located`.
Diagnostics must carry these codes and counts only, never asset ids, places or timestamps.
