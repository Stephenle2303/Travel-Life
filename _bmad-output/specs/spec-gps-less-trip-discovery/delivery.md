# Delivery record: GPS-less trip discovery (decision 0019)

Status: decision core delivered and unit-tested. Story 1's three evidence
questions have all run on the owner's Xiaomi 15 with real results (see
below). NOT wired into the app — the dev-only harnesses that produced this
evidence are not production code.

## Delivered (apps/mobile/src/travel-window/, tests in src/components/__tests__/travel-window.test.ts, 23 passing)
- window-detector: travel-looking windows from metadata only (burst + clock-offset shift or far-from-home edge fix); a burst alone, or one sign/landmark clue, stays silent.
- membership: owner camera captures and Google Takeout photo imports (decision 0020, 2026-11-19), no size cap; messaging/screenshot/download excluded; unknown provenance goes to review.
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

**Open finding outside Story 1's three questions — resolved.** Provenance
folder-matching was conservative on real data (12.9% `camera`, 83.4%
`unknown`). Investigated with a research-only, privacy-safe folder-category
breakdown (fixed categories, then a distinct-*count* only, never raw folder
text): 99% of the unknown population came from one or two distinct
top-level folders. With the owner's explicit permission to read those two
names (and one named exception honored — one folder was deliberately not
looked into further at the owner's request), the dominant one was a bulk
Google Photos Takeout import (2012–2023, travel-named albums). Asked
directly, the owner decided to trust it for trip detection, not only
review — see [decision 0020](../../../docs/decisions/0020-trusted-takeout-provenance.md).
Verified on-device: camera-trusted coverage 13%→89%, candidate windows
12→32, including seven new consecutive travel-looking windows
(2022-03-26..2022-05-31, offset-shift evidence only) invisible before.

`windowDefaults` thresholds are unchanged. This evidence supports them but
does not by itself justify freezing new values; that still needs Q3's
larger-scale run and real-world review of the newly-revealed windows.

## Not delivered / unverified
- Story 1 is answered (Q1, Q2, Q2-prime, Q3) and the provenance finding is
  resolved (decision 0020), but none of this is frozen thresholds or a
  go/no-go decision — that synthesis is still open work.
- The 32 candidate windows (including the newly-revealed 2022 trip) have not
  been reviewed against what the owner actually remembers.
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

## Production wiring (2026-11-19) — verified on-device

The owner asked for the "facts only" story card (CAP-4, no naming providers
needed yet) to appear for real, surfaced the same way visual-place's weak
evidence already does: a quiet entry in the existing Possible Trips list
(`recognizable-atlas-reveal.tsx`'s `PossibleTripCard`/`PossibleTripsSection`).

**Deliberately independent of the GPS reconstruction engine another session
is concurrently repairing (decision 0021).** Never reads or writes
`canonical_evidence`, any `reconstruction_*` table, or
`reconstruction/repository.ts`'s candidate-shadow/V1.1 code. New schema
(`travel_window_capture`, `travel_window_state`, `travel_window_trip`,
`travel_window_disposition`; `migrationV46`,
`import-record/repository.ts`) and a new, separate repository file
(`travel-window/storage.ts`) own all of it.

**Scope cut, stated honestly:** this pass wires a foreground-focus trigger
only (mirrors `visual-place-recovery.tsx`'s `useFocusEffect` + paced-batch
pattern — a proven, already-shipped precedent) — not decision 0004's required
background-task path. The scan step itself is a plain, reusable async
function with no UI dependency, so adding a background-task call site later
is additive, not a rewrite; it is not done in this pass and must not be
reported as decision-0004-complete.

**Diagnostic map**, operation `TRAVEL_WINDOW_SCAN` (existing), new stages,
reusing the project's existing closed SQLite reason-code vocabulary
(`classifyAppDiagnosticError`: `SCHEMA`, `DATABASE_BUSY`, `TRANSACTION`,
`NATIVE_HANDLE`, `ACCESS`, `CONSTRAINT`, `UNKNOWN`) plus `COMPLETE`:
- `TRAVEL_WINDOW_CACHE_READ`: reading the capture cache + scan cursor.
- `TRAVEL_WINDOW_CACHE_WRITE`: persisting a scan batch and advancing the cursor.
- `TRAVEL_WINDOW_REVIEW`: confirm/dismiss write (membership computed by the
  already-tested pure `selectMembers`, never a new membership rule).
All writes serialized through the existing `runOwnedTransaction`
(`database/native-transaction.ts`, `kind: 'background'`) — the same proven
SQLite-concurrency guard every other repository in this app uses; no new
locking logic. A window's reviewable identity (`command`) is
`travel-window-v1:${startMillis}:${endMillis}` — stable across re-scans that
add more evidence inside the same dates, so a dismissal or confirmation
never flaps as the library grows.

**UI integration:** `TravelWindowRecovery` (`components/travel-window-recovery.tsx`,
new) renders inside the existing `visualRecovery` slot in `mobile-screens.tsx`,
alongside `VisualPlaceRecovery` — the same "Possible trips" surface, no new
screen. `photo-access/provider.tsx` constructs `travelWindowDiscovery` (gated
on `!isAccountRecord && privateRecord.state === 'connected'`, matching every
other on-device-only discovery feature) and exposes it through the existing
context.

**On-device verification (owner's Xiaomi 15, this pass):** two real bugs
surfaced only on-device (neither reproducible in Jest against a fresh
database) and were fixed; see the error-playbook entry "Travel-window
production wiring: stale schema marker and missing busy_timeout (2026-11-19)"
for full root causes. In order: a stale `import_schema_version` marker from
earlier iteration of this same migration number left the four new tables
never created on this device (fixed with an idempotent `ensureTravelWindowLayout`
repair, mirroring the file's existing pattern for exactly this); then a
missing `PRAGMA busy_timeout` on this module's own connection caused the
first write to fail `DATABASE_BUSY` at cold start (fixed by adding it,
matching every other independently-opened connection to this file). After
both fixes: `TRAVEL_WINDOW_CACHE_READ`/`_WRITE` diagnostics report `COMPLETE`
across repeated backfill batches, and the "Possible trips" card rendered live
with a real detected window — "You were away for 3 days in August... Your
clock moved 2 hours back" (a 2-hour shift from Vietnam matches Korea's
UTC+9 offset) — confirmed via a text-only `uiautomator dump` (never
`screencap`, since this screen can show real personal evidence).

**Owner photo review (2026-11-19):** the owner asked, while reviewing the
live card, to be able to check the window's own photos before typing a place
name — the original "facts only" card had deliberately shown no thumbnails.
Added `loadPhotos` to `AutomaticTravelWindowDiscovery`
(`production-discovery.ts`): paginated (12/page, matching visual-place's own
`visualProposalPageSize`) over `windowPhotoIds` (`membership.ts`, new — the
same member/review selection `selectMembers` already uses, flattened into one
chronological id list), resolved to displayable URIs through the existing
`PhotoAccessAdapter.resolveOwnerPreviews` (the same owner-preview mechanism
`visual-place-recovery.tsx`'s `loadAlbum` already uses — no new native
resolution path). `TravelWindowRecovery` gained an optional "Review photos"
toggle with the same Previous/Next pagination UI as `VisualPlaceRecovery`'s
album view; unlike that component, reviewing is never required to confirm or
dismiss — the owner can still type a name or dismiss without opening it.
Covered by new tests in `travel-window-production-discovery.test.ts`
(`loadPhotos`, 6 cases) and `travel-window.test.ts` (`windowPhotoIds`, 2
cases); not yet re-verified on-device after this addition (the on-device
check above predates it) — full `npm run check` is green (1,520 Jest + 141
SQLite + typecheck + lint + Expo Doctor 21/21).

**Owner-reported correctness bug, fixed (2026-11-19):** after using the live
card, the owner reported already-recognized GPS trips (Bali, Taiwan 2025)
were also being offered for naming. Root cause: `located` — the field
`window-detector.ts`/`membership.ts` already use to exclude GPS-evidenced
captures from this module — was hardcoded `false` by every real caller
(`production-discovery.ts`, the dev harness); it was never actually wired to
a GPS check. Fixed by extending the existing native EXIF reader
(`TravelLifeSignageModule.kt`) to also report `hasLocation` (presence only,
via `ExifInterface.getLatLong()` on the same already-open file read — no new
native round-trip or permission; `ACCESS_MEDIA_LOCATION` was already
declared for the main engine). `capture-metadata.ts`'s `toCaptureRecord` now
sets `located` from either signal. Because the owner's device already
completed a backfill with the wrong value cached, added `migrationV47`
(clears only `travel_window_capture` and the scan cursor; preserves
`travel_window_trip`/`travel_window_disposition`, i.e. every decision the
owner already made) so the next launch re-backfills cleanly. Full root cause
and native-rebuild notes in the error-playbook entry "GPS-less trip
discovery re-offered already-recognized GPS trips (2026-11-19)". Also added
the year to the story-card headline per the same report ("in August 2026" /
"starting 28 June 2026", `story-card.ts`). `npm run check` green (1,522
Jest); native rebuild via `cd android && ./gradlew assembleDebug` +
`adb install -r` succeeded. On-device re-verification (confirming Bali/Taiwan
no longer surface, and the Korea card now shows a year) is pending the next
time the owner is in the app — they stepped away mid-verification.

**On-device re-verification, completed (2026-11-19):** the owner confirmed
they are in fact confirming each proposal via the live card as it appears —
`travel_window_trip` now holds four owner-confirmed windows: Huế - Đà Nẵng,
Seoul - Korea, Taiwan, and Bali - Indonesia. "No possible trips showing" and
"journeys dropped to 9" were both investigated and ruled out as bugs (see
`docs/project-state.md`'s "'9 journeys' and 'no possible trips' both
resolved as non-bugs" entry): the main Atlas's journey count is unchanged
from before (21), and the card is correctly empty only because every
travel-looking window found so far is already decided; backfill is still
progressing toward the rest of the library after the `migrationV47` reset.

**Full Atlas/Replay-gate integration, closing the spec's own acceptance line
(2026-11-20):** "After confirmation, the whole trip (all member photos) is
available immediately, including Replay eligibility through the existing
gates" (this file's own experience-and-acceptance.md) was never actually
implemented — confirming only wrote `travel_window_trip`/
`travel_window_disposition`, with no display path anywhere. Closed by
mirroring visual-place's own precedent for the identical problem exactly:
`migrationV48` adds `travel_window_album` (manual_id, slot, evidence_id,
source_ref — no slot cap, since this module's own membership rule is
"deliberately no size cap," unlike visual's 512); `storage.ts`'s
`confirmWindow` now also creates a real `manual_journey` row and resolves
member photos (never `reviewIds`) against `canonical_evidence` by
source_ref, atomically; three new `manual:travel-` branches in
`reconstruction/repository.ts` (`loadJourneyDetail`,
`verifyJourneyMediaSnapshot`, `loadJourneyMediaPage`) plus a new
`travelAlbumRows` helper mirror the existing `manual:visual-` ones.
Confirming now requires picking a real place (search over
`reconstruction/owner-place-search.ts`'s offline gazetteer, or a broad-
continent fallback) instead of free text, since a real anchor is required.
Replay stays withheld for these journeys, matching visual's own
owner-entered gate, not a new gap. New tests: `travel-window-storage.test.ts`
(album attachment) and a new describe block in
`reconciliation-repository.test.ts` (the three repository branches). Full
`npm run check` green except one typecheck error in a different,
concurrently-edited file, unrelated. **Known gap:** the four already-
confirmed trips (Huế - Đà Nẵng, Seoul - Korea, Taiwan, Bali - Indonesia)
predate real coordinate capture and were not retroactively migrated;
automatic geocoding of their free-text labels was judged too unreliable to
guess. On-device verification of this pass is pending (device disconnected
mid-session).

**Still not done:** decision 0004's background-task path (stated above as a
scope cut, unchanged by this pass).
