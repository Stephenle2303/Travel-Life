# Decision 0021 — Repair trip recognition: Home from the owner, clear Atlas or Possible

Date: 2026-11-19
Status: Accepted by the owner in chat on 2026-11-19. Implementation starting
with M10.1 (lifetime benchmark).

## Decision

- **Home is required and is only what the owner sets.** Because nothing
  learns Home, first-use setup cannot finish without at least one Home area,
  Settings always keeps at least one, and no reconstruction runs without a
  Home. A Home's time period is optional: it defaults to Forever, and From or
  Until can be picked by month and year when the owner wants to limit it.
  A family hometown is travel unless
  the owner sets it as Home. This supersedes the optional Home step in
  spec-home-first-journey-integrity.
- **Away from Home with clear evidence → Atlas.** A Home covers the dates, the
  destination is at least 50 km from every Home, at least 5 photos have a
  reliable location, and the evidence is corroborated. No score, novelty or
  foreign-country requirement.
- **Not sure → Possible trips, with one short reason.** For example: Home not
  set for these dates, no location data, too few located photos, close to
  Home, a place visited often. Possible trips stay out of counts and Replay
  until kept (decision 0018).
- **Nothing disappears silently.** Every hidden candidate stores a reason.
- Delivery order: synthetic lifetime benchmark and read-only phone count
  first, then the rules, then one detector for every surface, then an
  owner-approved dry run that can switch back to V1.1.

## Context

The 2026-11-19 engine review found real trips hidden with no reason because
the production adapter diverged from the V1.1 contract and its score gates
hid well-supported domestic trips. The owner chose a simpler, explainable rule.

## Consequences

Supersedes V1.1 learned bases and score/profile selection for the trip
outcome. Decisions 0006, 0007, 0017 and 0018 remain in force. Details:
[SPEC-trip-recognition-repair](../../_bmad-output/specs/spec-trip-recognition-repair/SPEC.md),
roadmap epic M10.
