---
id: SPEC-gps-less-trip-discovery
date: 2026-11-18
status: draft
baseline_commit: d1b795091abba28f2d1ef3dcc1ccff9231ee226a
companions:
  - experience-and-acceptance.md
  - ../spec-atlas-reconstruction-recovery/SPEC.md
  - ../../../docs/decisions/0018-city-level-possible-trips.md
  - ../../../docs/decisions/0019-gps-less-trip-discovery.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources:
  - BMAD party discussion with the owner, 2026-11-18
---

# GPS-less trip discovery: find the trip first, name it second

[Decision 0019](../../../docs/decisions/0019-gps-less-trip-discovery.md)
records the owner choices behind this spec.

## Why

The owner's Korea trip has no GPS in its photos. The current approach starts
from per-photo landmark recognition and grows a trip outward from each match.
On the owner's Android it produced one proposal with a four-photo album that
missed other stops and included unrelated media (AC-13 in the recovery spec).
The owner wants the app to catch such a trip and form the *full* trip.

This spec reverses the order: decide **that** a trip happened from metadata,
decide **which photos** belong from provenance, and only then decide **where**
it was, naming a place only when independent clues agree.

## Capabilities

- **CAP-1 Travel-looking window detection (metadata only)**
  - **intent:** Detect a GPS-less period that looks like travel without opening any image.
  - **success:** A window qualifies only with at least one strong clue (capture time-offset shift, foreign-script or far-from-home sign text, country-pack landmark match, or a located capture at the window edge) plus a burst of owner-camera captures. A burst alone never qualifies. Non-travel windows stay silent.
- **CAP-2 Full-trip membership**
  - **intent:** Put the owner's own captures from the window into the trip.
  - **success:** Membership uses provenance (camera folder, device make/model, original dimensions), not visual similarity. Received, messaging-app, downloaded and screenshot media are excluded by default. The review preview size never limits album membership (fixes the AC-13 defect). The owner reviews the exact album once.
- **CAP-3 Place naming by agreeing clues**
  - **intent:** Name a country or city only when it is safe.
  - **success:** A name appears only when at least two independent clues agree. A clock shift alone never names a country (one offset spans several countries). No wrong country is ever displayed.
- **CAP-4 Story card (owner option B)**
  - **intent:** Always tell the factual story of a travel-looking window; let the owner finish it with one tap or one typed name.
  - **success:** See [experience-and-acceptance.md](experience-and-acceptance.md).
- **CAP-5 Owner-taught references**
  - **intent:** Learn from the owner's confirmation.
  - **success:** Confirmed photos become private, on-device references for the confirmed place, so later visits can be recognized without asking.
- **CAP-6 Country landmark packs**
  - **intent:** Recognize famous places of one country without a whole-world index.
  - **success:** A pack for a country downloads only after the country is established by agreeing clues, over Wi-Fi, once per country (owner approved). Packs are built from openly licensed references.

## Clue sources (all free, on the phone)

| Clue | Availability | Can name a place? |
|---|---|---|
| Capture time-offset shift (EXIF offset tag) | Unverified on Xiaomi 15 | Never alone |
| UTC capture time vs local wall-clock mismatch | Unverified; experimental | Never alone |
| Located capture at window edge (e.g. airport) | When present | Yes, as one clue |
| Script on signage (on-device OCR) | All supported devices | Country, as one clue |
| Sign text matched to offline gazetteer | All supported devices | City, as one clue |
| Country landmark pack match | After country established | Yes, as one clue |
| On-device Gemini Nano (ML Kit Prompt API) | Some devices, incl. Xiaomi 15 (nano-v2); beta | Bonus clue only; must be able to answer UNKNOWN; never alone |
| Owner answer | Always | Yes |

## Constraints

- **No cost, no cloud AI on private photos.** Paid APIs are excluded by owner
  choice. Free cloud tiers are excluded because their terms allow the
  provider to use submitted content to improve its products.
- Everything runs on the phone. Existing consent gates, the diagnostic
  implementation policy and the Possible trips flow (decision 0018) apply.
- Screenshots may be read only on the phone, only for place and airport
  names, and the text is never stored or sent. If that cannot hold,
  screenshots are excluded.
- Copy never mentions where the owner was *not* ("You weren't in Sa Đéc").
- Gemini Nano is optional; the full experience must work without it.
- Do not call any result "confident" until the experiment and acceptance
  measurements exist.

## Release order

**Abroad trips first.** Domestic GPS-less trips (no clock shift, same script)
reuse the same funnel but ship only after passing their own separate quality
gate.

## Story 1 — Xiaomi 15 evidence experiment (before any build)

Read directly from the owner's phone in the development build; no owner chores.

1. Do the Korea captures carry a +09:00 capture time-offset tag?
2. Does the UTC-vs-local capture-time mismatch reveal the shift on HyperOS?
3. Given about 5 Korea "postcard" photos and Sa Đéc controls, with the prompt
   *"Name the city only if visible text or a famous landmark proves it;
   otherwise answer UNKNOWN"*, does on-device Gemini Nano answer correctly or
   bluff? Any named city for a Sa Đéc control disqualifies it as a clue.

Blocked until the development machine has enough free disk space for the
local tooling.

## Non-goals

- Domestic GPS-less trips in the first release (separate gate).
- Cloud vision or cloud AI APIs, paid or free tier.
- Inferring routes or exact departure/return dates.

## Open questions

- Thresholds for "burst", window boundaries and clue agreement (freeze after Story 1).
- Selection rule for the ~20 "postcard" photos sent to OCR, packs and Nano.
- Target size of a country pack.
- Multi-city trips (e.g. Seoul and Busan) as one trip with stops or separate trips.

## Diagnostic map

Required before implementation by the diagnostic implementation policy:
define operation, stage and reason codes for window detection, membership,
OCR, gazetteer lookup, pack acquisition, Nano availability/quota (`BUSY`) and
owner confirmation.
