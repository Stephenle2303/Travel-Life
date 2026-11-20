# Review findings (2026-11-19)

Evidence behind SPEC-trip-recognition-repair. Baseline commit `fbfe8b8`.
Synthetic only; no owner data was read.

## Probe

Synthetic home: 40 days across 2025, two spots 1 km apart. All rows day-only
(`has_precise_offset = 0`), accuracy 10 m, as the Android importer produces.
Run through `projectCanonicalHistory` and `qualifyGraphJourneyV11`, the path the
repository uses. Atlas shows only AUTO_CONFIRMED and USER_CONFIRMED.

| Case | Trip | Configured Home | Learned Home |
| --- | --- | --- | --- |
| A | 1 day, 65 km, 12 photos, 2 spots 3 km apart | NOT_TRIP, 30, corroboration missing | UNCONFIRMED (home absorbed) |
| B | 2 days, 65 km, 2 spots 3 km apart | **NOT_TRIP, 50, no reason** | UNCONFIRMED (home absorbed) |
| C | 2 days, 230 km, 2 spots 3 km apart | **NOT_TRIP, 60, no reason** | UNCONFIRMED (home absorbed) |
| D | 14 days abroad, one city | AUTO 100 | UNCONFIRMED (home absorbed) |
| E | 4 days abroad, 2 spots | AUTO 100 | UNCONFIRMED (home absorbed) |
| F/I | 2 days, 230 km, spots 20 km apart, no home within 3 days | AUTO 70 | AUTO 85 |
| G | 14 days abroad, no home within 3 days | — | **NOT_TRIP, 60, no reason** |
| H | 1 day, 65 km, no home within 3 days | — | SUGGESTED (hidden) |

The probe file is scratch-only; CAP-1 turns these cases into the benchmark.

## Divergence ledger: code versus V1.1

| # | V1.1 contract | Production behavior | Source |
| --- | --- | --- | --- |
| F1 | §6: all gates + score 45-69 ⇒ SUGGESTED | Corroborated 45-69 falls through to NOT_TRIP with empty reasons | `engine-v1-1.ts` `qualifyTripV11` classification (≈L184) |
| F2 | §1: sessions by 60 min / 1 km / 4 h; day-only = one session per day and support place | `sessionId = capturedDay` in both adapters | `canonical-core.ts` L61, L216 |
| F3 | §6 DAY/STAY need trustworthy episode span | `episodeSpanMillis` and `supportPlaceSeparationMeters` never populated: DAY/STAY dead | `engine-v1-1.ts` ≈L177; types only |
| F4 | §3/§5: home-proximate observations are return boundaries; Home and routine support removed before grouping | Only configured Home splits episodes; learned Home joins the trip, then `qualifyGraphJourneyV11` excludes candidate places from base selection ⇒ base-context-missing | `engine-v1-1.ts` `buildV11Episodes` ≈L267; `canonical-core.ts` L40 |
| F5 | §6 Foreign: destination country differs from every applicable base country | Country compared only to configured Homes; `constructCanonicalV11Graph` sets `foreignToEveryBase = distance ≥ 50 km` | `canonical-core.ts` L47-56, L220 |
| F6 | §6 New/rare: ≤1 prior corroborated episode in 365 days | `rareDestination = trip photos < half of base photos` | `canonical-core.ts` L64 |
| F7 | §3 learned base: date-scoped, ≥12 days, ≥4 months, ≥90-day span, ≥3 excursions, ≥50% outside excursions | Three rules: any place ≥12 days (episodes), single busiest place ≥12 days excluding candidate (qualification), 3 separated days over 28 days (candidate projection); none date-scoped | `canonical-core.ts` L39-44, L191; `candidate-projection.ts` L234 |
| F8 | §1 macro areas 20 km for destinations/bases | 5 km v1 places used as destinations and bases | `canonical-core.ts` adapters |
| F9 | §4 routine veto from 90 prior days | `deriveRoutineVetoV11(normalized, null)` evaluates no prior rows: veto inactive | `engine-v1-1.ts` L202 |
| F10 | native-evidence: original offset, original civil day, provenance | `hasPreciseOffset: false`, current-timezone civil day, `sourceOrigin: null` | `photo-access/native-adapter.ts` L126-137 |
| F11 | §2: a supporting unit needs capture-like provenance | `qualifyGraphJourneyV11`'s detector-evidence mapper hardcodes `captureLike: true, origin: 'capture-like'` for every candidate unit, ignoring `item.sourceOrigin`; screenshot/download photos with GPS still qualify Atlas trips through this path (found by the M10.1 benchmark, 2026-11-19) | `canonical-core.ts` ≈L58-60 |

## M10.1 frozen baseline (2026-11-19)

See [baseline-fbfe8b8.md](baseline-fbfe8b8.md) for the full scenario table.
`npm run benchmark:lifetime` (from `apps/mobile/`) regenerates
`evals/runs/lifetime-benchmark-fbfe8b8-baseline.json` (ignored by Git; the
committed summary is the frozen record). 21/50 scenario+Home-mode
combinations matched their label; 5 hit Finding F1 exactly (a corroborated,
all-gates-passing trip scoring under 70 silently becomes `NOT_TRIP` with an
empty reasons list); 0 false Atlas trips; 0 empty-reason hidden candidates
outside the F1 pattern. The benchmark also surfaced Finding F11 above.

## Structural findings

- A rebuild runs `reconstructV1` up to three times (`canonical-projection.ts`
  L56, L68, L138), then `constructCanonicalV11Graph` replaces its journeys.
- Possible trips come from `projectCandidateTrips`, a separate grouping policy
  (`recognizable-travel-shadow-v1`), not from the detector classification.
  SUGGESTED is stored but never read.
- Unused in production: `mergeContinuousAwayJourneysV11`,
  `deriveTemporalContextV11`, `joinReasonV11`; `deriveRoutineVetoV11` is a no-op.
- V1.1 `persistence.md` staged generations (`trip_generation` and related
  tables) do not exist; rebuilds rewrite `reconstruction_*` under
  `reconstruction_run` in one transaction, so V1.1 dry-run/rollback is unbuilt.
- Engine tests (69) pass; `evals/README.md` records product quality as not measured.
