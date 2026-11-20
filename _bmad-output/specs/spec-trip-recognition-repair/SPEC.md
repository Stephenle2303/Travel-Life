---
id: SPEC-trip-recognition-repair
date: 2026-11-19
status: in-progress
baseline_commit: fbfe8b8
companions:
  - review-findings.md
  - lifetime-benchmark.md
  - v1-2-comparison.md
  - detector-v1-2.md
  - home-setup.md
  - consolidation.md
  - delivery-and-diagnostics.md
  - ../spec-trip-detection-engine-v1-1/algorithm.md
  - ../spec-trip-detection-engine-v1-1/native-evidence.md
  - ../spec-home-first-journey-integrity/SPEC.md
  - ../../../docs/decisions/0006-photo-trip-assignment.md
  - ../../../docs/decisions/0007-reconstruction-v1-parameters.md
  - ../../../docs/decisions/0017-trip-merge-review-and-home-search.md
  - ../../../docs/decisions/0018-city-level-possible-trips.md
  - ../../../docs/decisions/0021-trip-recognition-repair.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
  - ../../../evals/README.md
sources:
  - 2026-11-19 reconstruction engine review and synthetic probe (session record)
  - BMAD party discussion with the owner, 2026-11-19
  - Owner direction in chat, 2026-11-19
---

> **Canonical contract.** This SPEC and the files in `companions:` are the
> complete contract. [Decision 0021](../../../docs/decisions/0021-trip-recognition-repair.md)
> records the owner's accepted direction. Implementation is in progress, starting with M10.1.

# Trip recognition repair

## Why

The owner is unhappy with the lifetime reconstruction. The 2026-11-19 review
found real trips silently withheld from the Atlas: fully gated mid-score trips
become NOT_TRIP, the DAY/STAY profiles never fire, a learned Home does not bound
a trip, abroad travel is recognized only with a configured Home, and capture
time arrives without original offsets. All 69 engine tests pass because they
check rules, not trip quality ([review-findings.md](review-findings.md)). The
owner chose a simpler contract: Home is required and is only what the owner
sets; a trip away from
Home with clear evidence shows on Atlas; anything unsure goes to Possible trips
with a short reason. Impact on the owner's library is unmeasured. The MLP
reveal (decision 0009) depends on this record being right.

## Capabilities

- **CAP-1 Lifetime benchmark**
  - **intent:** The team can measure trip recognition on believable whole-life histories, not single rules.
  - **success:** A public synthetic benchmark ([lifetime-benchmark.md](lifetime-benchmark.md)) reports per-scenario and total Atlas recall, Possible recall, false trips, boundary agreement, silent drops and Possible-card count; the current engine's result is frozen as the baseline and reproduces every probe failure.
- **CAP-2 Owner-device baseline**
  - **intent:** The team can tell how much of the synthetic loss is present on the owner's phone.
  - **success:** A read-only aggregate on the owner's Android reports journey counts by classification and reason, including hidden journeys with empty reasons, with no IDs, places, coordinates or dates leaving the device.
- **CAP-3 No silent loss, clear reasons**
  - **intent:** The owner never loses a plausible trip without knowing why.
  - **success:** Every hidden candidate stores a closed reason; every Possible trip card shows exactly one reason sentence from the fixed table in [detector-v1-2.md](detector-v1-2.md); `home-not-set` cards offer Set Home; benchmark silent drops are zero.
- **CAP-4 Clear outcome rule**
  - **intent:** Away trips with clear location evidence appear on Atlas; unsure ones appear in Possible trips; Home-only evidence stays hidden.
  - **success:** The outcome rule in [detector-v1-2.md](detector-v1-2.md) decides every episode with no score gate; the one-day 65 km outing, both domestic weekends and both abroad cases from the probe reach Atlas when Home covers their dates and Possible trips with `home-not-set` when it does not.
- **CAP-5 Home is required**
  - **intent:** The owner tells the app where home is before the first Atlas, and can change it later.
  - **success:** First-use setup cannot finish without at least one Home area; a Home's period is optional and defaults to Forever, with optional From/Until month-and-year pickers ([home-setup.md](home-setup.md)); Settings edits Homes but always keeps at least one; a record with no Home gets the required Home step before any rebuild; reconstruction uses only owner-set areas; Home photos are never trip media; no learned Home exists in code.
- **CAP-6 Original capture time**
  - **intent:** Reconstruction uses the time the photo was taken where it was taken.
  - **success:** Import persists original local civil day, original offset when present, instant trust and capture provenance; no civil day derives from the phone's current timezone when an original value exists.
- **CAP-7 One detector**
  - **intent:** Atlas, counts, Replay eligibility and Possible trips agree because one engine decides.
  - **success:** One normalization, Home model and grouping authority feeds every surface ([consolidation.md](consolidation.md)); learned-base and divergent paths are removed; benchmark results do not regress.
- **CAP-8 Reversible adoption**
  - **intent:** The owner adopts the repaired engine without losing decisions.
  - **success:** A dry run reports gained, lost and changed Atlas and Possible trips as aggregates; activation needs owner approval; every owner correction survives; selecting V1.1 again reproduces the prior result exactly.

## Constraints

- Home is mandatory and is only the owner's Home areas (onboarding,
  Settings). Nothing learns, guesses or promotes a Home, so no reconstruction
  runs without one. This supersedes the optional-Home constraint in
  [spec-home-first-journey-integrity](../spec-home-first-journey-integrity/SPEC.md).
- V1.1 [algorithm.md](../spec-trip-detection-engine-v1-1/algorithm.md) §1, §2,
  §5 and §7 stay the reference for units, sessions, reliable location, episodes
  and destinations. The outcome rule replaces §3 learned bases and §6 score and
  profile selection. `reconstruction-v1` places and visits are unchanged.
- Measure before changing rules: CAP-1 lands before CAP-3..7.
- Atlas never shows a candidate with an unmet outcome condition; unsure goes to
  Possible trips, not Atlas. No benchmark negative control (Home life,
  screenshots, single photo) may reach Atlas.
- Preserve decisions 0006, 0017 (uncertain continuity stays two trips with a
  merge suggestion) and 0018 (Possible trips stay outside counts and Replay
  until kept), plus exact-support owner corrections.
- Reason sentences are concise, follow the Living Atlas design system, and
  never say where the owner was not.
- Deterministic and on-device; no provider, vision or LLM call. Benchmark data
  is synthetic and public; no owner evidence enters Git or a fixture.
- The diagnostic implementation policy applies to every runtime story; the map
  is in [delivery-and-diagnostics.md](delivery-and-diagnostics.md).

## Non-goals

- Naming or discovering GPS-less trips (spec-gps-less-trip-discovery, decision
  0019); its windows only feed Possible trips with `no-location`.
- Learning Home or usual places automatically.
- Visual landmark or OCR recognition changes.
- Atlas or Timeline redesign. UI changes are limited to the Possible-card
  reason line and Set Home action, removing Home "Skip for now", keeping the
  last Home area in Settings, and the Home period control.
- Changing place clustering, visit rules or correction storage formats.
- Routes, exact departure/return dates or proof of owner presence.

## Success signal

On the frozen benchmark, every labeled away trip with clear
location evidence is on Atlas, every unsure labeled episode is in Possible
trips with its expected sentence, no negative control reaches Atlas, and silent
drops are zero. On the owner's phone, the dry run shows zero hidden journeys
with empty reasons, and the owner approves activation.

## Assumptions

- Android `creationTime` is a UTC instant; its civil day is currently derived
  in the phone's present timezone (verified in code). Without an EXIF offset or
  agreeing original local clock it is treated as untrusted.
- The Story 1 native reader (offset tags, local clock, folder) is the basis for
  CAP-6; another session was editing it when this spec was written.
- Regular commutes (frequent places) go to Possible trips with their own
  sentence rather than Atlas or hidden; benchmark S2 measures how many cards
  that creates. Applied from the owner's "not sure → Possible" rule.
- When the owner's dated Home areas leave a gap, away-looking episodes in the
  gap show `home-not-set`; nothing extends a Home to cover them. A Forever Home
  covers every date.
