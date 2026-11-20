# Lifetime benchmark (CAP-1)

Dataset `lifetime-synthetic-v1`. Public, synthetic, versioned. Measures what the
owner experiences: which trips appear, where, and what is silently lost.

## Unit and labels

- **Unit:** one synthetic person-library: dated Home eras plus routine places,
  trips and noise, generated deterministically from a seeded scenario script.
- **Labels (author-written, reviewed by the owner before freezing):** for each
  labeled episode, `expected` ∈ {`atlas`, `possible`, `hidden-ok`}, the expected
  Possible reason code when `possible`, and its supporting media IDs. Negative
  controls are `hidden-ok`. Labels are design intent; they do not become human
  ground truth for real libraries.
- **Home:** each library has at least one owner-set Home area as onboarding
  and Settings save them, Forever by default. A "partial dates" variant uses
  only dated Homes that leave a gap in the library's history. A library with no Home asserts that
  reconstruction is blocked and nothing is shown.
- **Evidence shape mirrors the Android importer:** day-only by default; variants
  with trusted instants and offsets; accuracy null/10 m/1 km/6 km; GPS-less
  share; screenshot and download provenance.

## Required scenarios

Expectations assume Home covers the trip dates; in the "partial dates"
variant every `atlas` row on uncovered dates becomes `possible` / `home-not-set`.

| ID | Scenario | Expected |
| --- | --- | --- |
| S1 | Home life only, two spots inside the Home area | hidden |
| S2 | Weekday commute 60 km, 3×/week for 6 months | possible / `frequent-place`; report card count |
| S3 | One-day outing 65 km, 12 photos, 2 places 3 km apart, day-only | atlas |
| S4 | One-day outing 65 km, 12 photos at one spot within 20 minutes | possible / `single-moment` |
| S5 | Weekends at 65 km and 230 km, 2 places 3 km apart | atlas |
| S6 | Outing 30 km away, outside the 20 km Home area | possible / `near-home` |
| S7 | 4-day and 14-day abroad trips | atlas |
| S8 | S7 with Home photos the day before and after | atlas; Home media not in album |
| S9 | Multi-city abroad trip with a 5-day photo-silent gap | atlas as one trip, or two with a merge suggestion (decision 0017) |
| S10 | Two separate trips 3 days apart with a corroborated Home return | two atlas trips |
| S11 | Moving house: Home A with Until, Home B with From | trips relative to each date's Home; Home A after the move is travel |
| S12 | Family hometown 200 km away, visited 5×/year, not set as Home | atlas each visit |
| S13 | 3-week stay abroad in one city | atlas; never treated as Home |
| S14 | 3 photos 150 km away | possible / `few-photos` |
| S15 | GPS-less travel window (spec-gps-less-trip-discovery input) | possible / `no-location` |
| S16 | Away photos with accuracy 3-6 km only | possible / `weak-location` |
| S17 | Away photos whose dates contradict their locations | possible / `time-conflict` |
| S18 | One far photo with nothing else, or screenshots/downloads with foreign GPS | hidden |
| S19 | Trip dates outside every dated Home area | possible / `home-not-set` |
| S20 | Owner corrections (reject, split, merge, confirm, keep Possible) over S5-S10 | corrections survive rebuild |

Probe cases A-I from [review-findings.md](review-findings.md) are included verbatim.

## Metrics

Per scenario and in total, with counts and denominators, never a lone percentage:

- **Atlas recall:** `atlas` labels shown on Atlas.
- **Possible recall:** `possible` labels shown in Possible trips or Atlas.
- **False trips:** `hidden-ok` episodes shown on Atlas (precision proxy) and in Possible trips (review burden).
- **Boundary agreement:** shown trips whose supporting media set equals the label's set; report splits and joins separately.
- **Silent drops:** candidates not shown whose reasons list is empty. Target 0.
- **Reason accuracy:** Possible cards whose shown sentence matches the label.
- **Possible-card count:** total and per scenario (review burden).

## Harness

- `apps/mobile/scripts/benchmark-lifetime.cjs` (`npm run benchmark:lifetime`
  from `apps/mobile/`), a plain Node script transpiling the pure
  `reconstruction/*.ts` modules in place (same pattern as
  `scripts/benchmark-reconstruction.cjs`), so it runs the real
  `projectCanonicalCandidateHistory` pipeline (Atlas via `qualifyGraphJourneyV11`,
  Possible trips via the candidate-projection shadow engine) with no SQLite,
  Jest or device.
- Output: a deterministic JSON report at ignored
  `evals/runs/lifetime-benchmark-fbfe8b8-baseline.json`, plus the committed
  summary [baseline-fbfe8b8.md](baseline-fbfe8b8.md). The `fbfe8b8` run is
  frozen before any rule change (M10.1, 2026-11-19: 21/50 matched, 5 silent
  drops, 0 false Atlas trips). Reports state `product_quality: not_measured`
  for real libraries.
- Current coverage: scenarios S1-S14, S16, S18-S19 and probe cases A-H, each
  in `configured` and `learned` Home modes (S7 split into S7a/S7b). S15
  (pure GPS-less, no visit/journey under the unchanged v1 engine), S17 (no
  GPS-jump contradiction detector exists yet) and S20 (correction survival is
  unchanged by construction, not a new code path to benchmark) are proven at
  the unit level only (`reconstruction-outcome-v1-2.test.ts`), not end to end;
  see [v1-2-comparison.md](v1-2-comparison.md)'s closing notes.
- **v1.2 result (2026-11-19):** 54/54 matched, 0 silent drops, 0 false Atlas
  trips, versus the frozen baseline's 22/54. See
  [v1-2-comparison.md](v1-2-comparison.md) for the full table and what each
  fix changed.
- A dev split (seeds 1-3) tunes; a holdout (new seeds plus 3 unseen scenario
  variants written before v1.2 coding) is scored only at release.
- `npm run benchmark:lifetime` now exits non-zero if v1.2 mismatches, silently
  drops, or shows a false Atlas trip on any scenario (v1.1's own known
  mismatches, the frozen baseline, never fail the script). Current result:
  PASS, 54/54. Not yet called from `npm run check` itself — a one-line
  addition once it is adopted as a required step, deferred so a future
  scenario addition cannot silently fail CI on a label the team hasn't reviewed.
