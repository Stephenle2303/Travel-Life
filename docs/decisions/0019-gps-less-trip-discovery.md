# Decision 0019 — Find GPS-less trips first, name them only on agreeing clues

Date: 2026-11-18
Status: Accepted by the owner in a BMAD party discussion. Not implemented.

## Decision

- For GPS-less media, detect a travel-looking window from metadata first,
  build membership from capture provenance, and name the place last.
- Always tell the factual story of a travel-looking window and let the owner
  finish it with one tap or a typed name (option B). Stay quiet when the
  evidence does not look like travel.
- A wrong country must never appear. A name requires at least two
  independent agreeing clues; a clock shift alone never names a country.
  When unsure, ask "Where were you?" and save the owner's answer.
- Use only free, on-device methods. No paid APIs and no cloud AI on private
  photos. On-device Gemini Nano may serve as an optional bonus clue.
- Country landmark packs may download once per country over Wi-Fi after the
  country is established.
- Ship abroad trips first; domestic GPS-less trips follow behind a separate
  quality gate.

## Context

The owner's Korea trip lacks GPS. The landmark-first approach produced a
four-photo album on the owner's Android (AC-13). The owner reported that
Google Lens identified the photo correctly and asked for a free solution that
names popular places such as Seoul confidently.

## Consequences

See [the spec](../../_bmad-output/specs/spec-gps-less-trip-discovery/SPEC.md).
Story 1 is an evidence experiment on the owner's Xiaomi 15. Reconsider if the
experiment shows the metadata clues are absent on common devices.
