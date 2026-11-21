# trip-detector-v1.2 rules (CAP-3..6)

Policy `trip-detector-v1.2`, normalization `capture-evidence-v1.2`. Reference:
V1.1 `algorithm.md` §1, §2, §5 and §7 (units, sessions, reliable location,
episodes, destinations). Owner direction of 2026-11-19 **replaces** V1.1 §3
learned bases and §6 score/profile selection with the outcome rule below.

## Home (CAP-5)

- **H-1** Home is only what the owner sets: Home areas (Forever or dated) from first-use
  setup and Settings (existing typed-search flow, decision 0017; default 20 km
  circle; multiple areas). No learned Home, learned base or frequent-place
  promotion to Home.
- **H-2** A Home's period is optional and defaults to Forever (no start, no
  end), which applies to every date. From and Until are each optional and set
  by month and year ([home-setup.md](home-setup.md)). A dated Home applies only
  inside its period: moving house is an old Home with Until and a new Home with
  From; the old Home after the move is a travel destination.
- **H-3** Photos inside an active Home area are never trip support, cover or
  album media. Corroborated Home observations end an episode (V1.1 §5 return
  rule); one isolated Home photo does not.
- **H-4** Home is required, because nothing learns it. First-use setup cannot
  finish without at least one Home area ("Skip for now" is removed). Settings
  cannot remove the last Home area unless another is added. An existing or
  restored record with no Home area gets the required Home step before its next
  rebuild; reconstruction never runs without a Home.
- **H-5** Only dated Homes can leave gaps; a Forever Home leaves none. An episode on dates no Home covers
  cannot reach Atlas; it goes to Possible trips with `home-not-set`, and that
  card offers **Set Home** (opens the existing Settings Home flow).

## Outcome rule (CAP-4)

Episodes are built per V1.1 §5 with Home boundaries (H-3) and owner boundaries.
Each gets exactly one outcome.

**Atlas** (`AUTO_CONFIRMED`) when all hold:

1. A Home area covers every episode day.
2. The main destination is ≥50 km from every active Home.
3. ≥5 independent photo units with reliable location (accuracy ≤1 km or
   unknown with V1.1 §2 margin), capture-like provenance.
4. Corroborated: ≥2 sessions, or ≥2 support places ≥1 km apart (V1.1 §1).
5. No time/location conflict, not a frequent place (F-1), no owner veto.

No score, novelty, foreign-country or profile requirement. The V1.1 score is
still computed and stored as a diagnostic only.

**Possible trips** (`SUGGESTED`) when the episode has away-looking evidence (any
located support outside every active Home area, or a GPS-less travel window
from spec-gps-less-trip-discovery) but fails an Atlas condition. Stays outside
counts and Replay until kept (decision 0018).

**Hidden** (`NOT_TRIP`, or `REJECTED` for owner rejection) when all support is
inside Home areas, support is only screenshots/downloads, or there is no away
evidence. Hidden candidates still store a closed reason; none shows in the UI.

## Possible-trip reasons (CAP-3)

All failing reasons are stored. The card shows **one** sentence: the first in
this priority order. Copy follows the Living Atlas design system; never say
where the owner was not.

| Priority | Code | Trigger | Card sentence |
| ---: | --- | --- | --- |
| 1 | `home-not-set` | Home areas exist, but none covers these dates | Your Home isn't set for this time. |
| 2 | `time-conflict` | Dates or locations contradict (V1.1 §2) | Photo dates and locations don't line up. |
| 3 | `no-location` | Most photos have no location data | These photos have no location data. |
| 4 | `weak-location` | Located photos all exceed 1 km accuracy | Photo locations are too imprecise to confirm. |
| 5 | `near-home` | Outside Home areas but <50 km away | It's close to your Home, so it may be an everyday outing. |
| 6 | `frequent-place` | F-1 holds | You come here often, so it may be everyday life. |
| 7 | `few-photos` | <5 reliable located photos | Only {n} photos have a location. |
| 8 | `single-moment` | Not corroborated | All photos are from one place and moment. |

Keeping a Possible trip records `USER_CONFIRMED` (existing review path);
rejecting it records the existing exact-support rejection.

- **F-1 Frequent place:** a destination macro area with ≥8 separate away
  episodes in the 90 days before the candidate (V1.1 §4 counts, owner-set Home
  as base). It is never Home and never hidden; it only blocks Atlas.

## Evidence fixes (unchanged from the review)

- **C-3** Sessions per V1.1 §1; day-only units form one session per (original
  day, support place). Removes `sessionId = capturedDay`.
- **C-4** Corroborated places and separation computed from raw unit
  coordinates, not support-place representatives: `reconstruction-v1`'s 5 km
  place clustering already merges two points 3 km apart into one place, so a
  check keyed on place id can never see them as separated (found by the
  M10.1 benchmark; see the error playbook, 2026-11-19).
- **C-6** Destinations use 20 km macro areas; 5 km places remain support places.
- **C-12** Import stores original local civil day (EXIF `DateTimeOriginal`),
  original offset (`OffsetTimeOriginal`/`Digitized`) and instant trust:
  `trusted` with an offset or an original local clock agreeing with the instant
  within 15 minutes of a whole offset, else `untrusted`.
- **C-13** Provenance from the Story 1 folder classifier: camera and
  `imported` (Google Takeout, decision 0020) supply support; screenshots and
  downloads supply no support; messaging and unknown are review-only.
- **D-7** Without an original local value, the civil day keeps the current
  derivation, marked `day-source: device-zone`; it cannot create a cross-offset
  boundary.

Two closed codes exist only for hidden (unshown) outcomes, never for a
Possible card: `non-capture-source` (all support is screenshots/downloads)
and `no-away-evidence` (fewer than 2 own-capture away units, or all support
is inside a Home area).

## Unchanged

Decision 0007 places and visits; decision 0017 (uncertain continuity stays two
trips with a merge suggestion); GPS-less 24-hour bracket for album membership;
manual trips and owner corrections.

## Implementation status (2026-11-19)

Shipped in [outcome-v1-2.ts](../../../apps/mobile/src/reconstruction/outcome-v1-2.ts)
(`qualifyTripOutcomeV12`/`qualifyGraphJourneyV12`), wired into the production
rebuild (`reconstruction/repository.ts`, replacing the `qualifyGraphJourneyV11`
call): H-1..H-5 and the Home/outcome/reason logic, C-3/C-4/C-6, F-1, and
Finding F11's fix (real provenance check, not a hardcoded `captureLike`).
Verified: 25 unit tests, 54/54 on the lifetime benchmark
([v1-2-comparison.md](v1-2-comparison.md)).

A `/code-review high` pass before declaring this done found and fixed 9
real bugs in the first draft: frequent-place (F-1) could count a journey as
its own prior visit (timestamp-based self-exclusion instead of identity-based),
`homeCoversAllDays` was vacuously true with no checkable day,
`graphJourneyEpisodeMarkers` only indexed a journey's first-visit place
(F-1 could never fire for a consistent second stop), the duplicate-family
tie-break disagreed with V1.1's, `candidate-projection.ts`/
`local-recovery-projection.ts` still read the retired V1.1 qualifier, an
empty-Home case stored a self-contradicting `near-home` reason alongside
`home-not-set`, and the per-journey qualification scaled as
O(journeys × library size) instead of O(library size). See the error
playbook (2026-11-19) for the full list. One finding was real but not fixed
this session — see "CAP-7's remaining half" below.

Status update (2026-11-20), after the concurrent travel-window session's
work landed:

**Done:**
- **C-12/C-13 on Android**: `apps/mobile/src/photo-access/native-adapter.ts`'s
  `candidateFromMetadata` now calls the same native EXIF/offset reader and
  `toCaptureRecord` mapper travel-window's GPS-less detector uses (one
  detector, not a second disagreeing EXIF path) — real `hasPreciseOffset`
  (an `OffsetTimeOriginal`/`Digitized` tag was present) and real `sourceOrigin`
  (camera/imported/messaging/screenshot/download/unknown from the folder
  classifier) now flow into every imported photo on Android; iOS/Expo
  Go/older builds keep today's conservative defaults (`false`/`null`), same
  as before. `outcome-v1-2.ts` needed no further change to consume them, as
  predicted — except one real gap the real wiring exposed: `NON_CAPTURE_ORIGINS`
  was missing `'messaging'`, so a messaging-sourced photo would have counted
  as full capture-like support, contradicting C-13's "messaging... review-only"
  (fixed, one line). One asset's unreadable EXIF never blocks its own import
  or any other asset's (caught, falls back to the conservative defaults).
  Verified: new `native-photo-adapter-capture-metadata.test.ts` (4 tests:
  real offset+provenance, screenshot folder, native-read failure, no-date
  skip), full mobile `npm run check`, benchmark still 54/54.
- **D-7**: unchanged by design — the civil-day derivation this wiring did not
  touch already keeps the device-zone fallback the spec asks for.
- **M10.5's UI** (onboarding "Skip for now" removal, Settings keep-one-Home,
  the Forever/From/Until period picker): done, see
  [home-setup.md](home-setup.md)'s own implementation-status note.

**Not yet done:**
- **Diagnostic map** (`delivery-and-diagnostics.md`'s new stages/reasons):
  `app-diagnostics.ts` is free now, but this still needs its own pass —
  not started this session.
- **CAP-7's remaining half** (Possible-trips UI reading `SUGGESTED` instead
  of the separate shadow policy): investigated 2026-11-20 and **deliberately
  deferred**, not blocked — see [consolidation.md](consolidation.md)'s status
  note for why replacing it is higher-risk than its real (preview-only)
  impact justifies right now.
- **H-3's graph-level half (closed 2026-11-20):** `canonical-projection.ts`
  already rebuilds an unreviewed journey's visits from Home-filtered
  evidence (the `travelGraph`/`travelEvidence` pass), but a **protected**
  (owner-confirmed or corrected) journey's visits are taken verbatim from
  the graph as it stood before that filter, via `retainProtectedJourneys` —
  by design, so a reviewed journey's structure doesn't silently change. If
  the owner then configures a Home covering a photo that was already part
  of that confirmed visit, the visit's own identity (and, before this fix,
  every `visit-support` row generated from it) kept including that photo
  forever, even though `qualifyTripOutcomeV12` correctly excludes it from
  classification on every later rebuild. Fixed at the one place
  `visit-support` rows are generated each rebuild
  (`reconstruction/repository.ts`'s main write loop, fully rewritten every
  rebuild, never accumulated): an evidence id with `configuredHomeAreaId`
  set (the exact field the classifier's own exclusion already keys on) is
  no longer written, for every visit regardless of its journey's protection
  state. An owner's own explicit manual addition is unaffected (separate
  `membership:owner:%` link kind). Verified two ways: (1) a direct
  `reconstructV1` call confirms Home-tagged evidence enters a visit's
  `evidenceIds` at the base engine level — the underlying gap is real, not
  hypothetical; (2) a new SQLite regression
  (`scripts/atlas-sqlite.test.cjs`, "a confirmed journey never writes a
  later-configured Home photo into visit-support") confirms to fail without
  the fix (the Home photo appears in `visit-support`) and pass with it.
  Full mobile `npm run check` (1608 Jest + 129 SQLite) and `npx tsc
  --noEmit` clean, zero regressions across the correction/replay/
  visual-place/travel-window suites that depend on `visit-support`'s other
  (unchanged) semantics.
- **M10.2** (read-only device count): needs the owner's phone connected.
