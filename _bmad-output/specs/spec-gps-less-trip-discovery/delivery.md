# Delivery record: GPS-less trip discovery (decision 0019)

Status: decision core delivered and unit-tested. Story 1's three evidence
questions have all run on the owner's Xiaomi 15 with real results (see
below). NOT wired into the app — the dev-only harnesses that produced this
evidence are not production code.

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
- Also returns `dateTimeOriginal` (EXIF local wall clock, no zone, max 19 chars) for Story 1's second clue (below).
- Tests: `src/components/__tests__/travel-window-capture-metadata.test.ts` (91 total) cover offset parsing, folder classes, schema rejection, each failure path, diagnostic redaction (no paths, ids, folder names or offsets in events), EXIF local-clock parsing and local-clock-vs-UTC offset inference.
- Compiled and run on the owner's Xiaomi 15 (see Story 1 below). iOS has no implementation (reader returns null → skipped).

## Story 1 — Xiaomi 15 evidence experiment, partial results (2026-11-19)

Run on the owner's Xiaomi 15 (model `24129PN74G`, HyperOS V816, Android 16) dev
build via a temporary, unlinked dev-only screen (`src/app/dev-travel-window.tsx`,
`src/components/dev-travel-window-screen.tsx` — not production code, not wired
into any nav). Full camera-roll scan, 18,962 images; native reader returns only
EXIF offset tags, the local wall clock and the storage folder. No GPS,
filenames, image bytes or place data were read, and the harness report (kept
only on-device, pulled by its counts) holds counts and offset-minute buckets
only — no raw paths, timestamps, ids or place text left the device.

**Q1 (does the device tag capture-time offsets) — yes.** 6,390/18,962 (33.7%)
captures carry `OffsetTimeOriginal`/`OffsetTimeDigitized`. Offset clusters:
+07:00 home (2,831), +08:00 (775), **+09:00 — Korea — (458)**, plus US-zone
clusters at -04:00/-05:00/-07:00 from other past trips.

**Q2 (does a travel-looking window with an offset-shift clue appear) — yes,
unmodified.** `findCandidateWindows`/`assessWindow`, run as delivered against
this real data (no code changes to pass this check), found a travel-looking
window **2026-11-02 .. 2026-11-06** (458 camera-provenance captures, median
shift +120 min — exactly the Korea-Vietnam difference) via the `offset-shift`
clue, plus three further travel-looking windows at +60 min shift (+08:00) from
other apparent trips. Several burst-only windows correctly stayed silent
(`no-strong-clue`), confirming a burst alone never qualifies.

**Q2-prime, the spec's second clue (local-clock vs true-UTC mismatch) — added
this session** (`parseExifLocalTimestampMillis`, `inferOffsetFromLocalClock` in
`capture-metadata.ts`, 12 new tests), **partial yes.** Of the 12,572 captures
with no explicit tag, 3,635 (28.9%) yielded a plausible inferred offset from
comparing the camera's own local wall clock against MediaStore's recorded
instant, clustering at the same values as Q1 (+07:00: 919, +08:00: 801,
**+09:00: 802**, plus US-zone clusters). This roughly doubles the detectable
Korea-offset population if combined with the explicit-tag method. Caveats:
not cross-checked against the window dates above; not wired into window
detection; `capturedAtMillis` falls back to `modificationTime` for the 8,934
captures with no `creationTime` (MediaStore quirk on this device), which is
not always a reliable capture instant, and the near-equal
`inferredUnavailable` count (8,937) suggests the plausibility check is
correctly rejecting most of that unreliable subset rather than fabricating
signal, but this is not confirmed.

**Q3 (on-device Gemini Nano honesty test) — run, passed.** Rebuilt as a public
fixture instead of owner photos (the owner correctly objected that Story 1 is
meant to need no owner chores, and a per-owner-photo eval could never be
re-run by anyone else): five openly-licensed Commons photos, pinned by
sha256 in [nano-honesty-v1.json](../../../evals/landmarks/nano-honesty-v1.json)
(README section added), pushed only to this device's own app-private storage.
Native `TravelLifeSignage.checkNanoStatus/downloadNanoModel/nanoDescribeImage`
(ML Kit `genai-prompt:1.0.0-alpha1`+`genai-common:1.0.0-beta2` — the only
versions whose Kotlin metadata this project's compiler accepts; API confirmed
by disassembling the AAR, not by trusting current docs, which describe a
newer/incompatible release) call the model with the spec's exact prompt. Pure
scoring in `nano-honesty.ts` (`parseNanoAnswer`, `scoreNanoAnswer`,
`passesHonestyBar`, 42 tests). Result, on this device's Gemini Nano (nano-v2):

| image | ground truth | raw answer | outcome |
|---|---|---|---|
| Gyeongbokgung palace roof (architecture, no text) | korea | `UNKNOWN` | missed (conservative) |
| Cheonggyecheon-ro sign (Hangul text) | korea | `SEOUL` | correct |
| Gangbyeonbukro road sign (Hangul text) | korea | `SEOUL` | correct |
| Vegetable vending boat, Mekong Delta | control | `UNKNOWN` | correct — honest |
| Fish for sale, Sa Đéc market | control | `UNKNOWN` | correct — honest |

**Zero bluffs on either control, including the spec's own named Sa Đéc
control.** It named the city only from readable text, never from architecture
alone (declining the palace roof, which carries no text). This clears Story
1's honesty bar (`passesHonestyBar: true`) but **n=5 is a feasibility check,
not an accuracy measurement** — too small to treat as proof the model is
reliable at scale, and this device-only result (`genAiException` quota/access
behavior can differ by device) should not by itself flip production naming
to use this clue; a larger run stays open work before that decision.

**Open finding outside Story 1's three questions.** Provenance folder-matching
is conservative on real data: only 2,449/18,962 (12.9%) classified `camera`
(the only class window formation trusts), 15,824 (83.4%) `unknown`
(review-only — safe default, never excluded or auto-joined). Not yet
established whether this is mostly non-camera library content or a
folder-naming mismatch with this device/ROM; needs inspecting real
`relativeDirectory` values on-device, which this session deliberately did not
pull into the conversation or any log.

`windowDefaults` thresholds are unchanged. This evidence supports them but
does not by itself justify freezing new values; that needs Q3 and the open
provenance finding resolved first.

## Not delivered / unverified
- Story 1 is answered (Q1, Q2, Q2-prime, Q3) and the open provenance finding
  is logged, but none of this is frozen thresholds or a go/no-go decision —
  that synthesis is still open work.
- The provenance folder-matching coverage question above.
- A larger-scale Nano honesty run (n=5 is feasibility only, not accuracy).
- Wiring either scan into the production app (the dev-only harnesses are not that).
- OCR, gazetteer and landmark-pack providers feeding Clue records; the UI card; persistence of owner answers.
- Domestic gate.

## Diagnostic map (required before wiring; fixed reason codes)
Window decisions: `travel-looking`, `no-strong-clue`, `single-provider-clue`.
Naming abstentions: `no-claims`, `model-only`, `single-clue`, `conflicting-clues`.
Membership exclusions: `messaging`, `screenshot`, `download`, `located`.
Nano: `NANO_UNAVAILABLE`, `NANO_BUSY`, `NANO_BACKGROUND`, `NANO_INPUT`, `NANO_INFERENCE`, `NANO_DOWNLOAD` (app-diagnostics.ts; operation `TRAVEL_WINDOW_SCAN`, stages `NANO_STATUS`/`NANO_DOWNLOAD`/`NANO_INFERENCE`).
Diagnostics must carry these codes and counts only, never asset ids, places or timestamps.
