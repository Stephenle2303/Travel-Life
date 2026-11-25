# Decision 0023 — trip-detector-v1.3: Atlas, then Possible trips, then Hidden

Date: 2026-11-22
Status: Accepted by the owner in chat on 2026-11-22 (BMAD party review).
Not implemented yet.

## Decision

- **One Home zone, owner-sized.** Inside a Home's radius is Home; everything
  outside it counts toward a trip. The separate 50 km "away" distance and the
  "near Home" band are removed. Each Home's radius is a free number the owner
  edits in Settings (above 0, at most 300 km; new Homes still default to 20 km).
- **The funnel is inverted.** Today anything that fails an Atlas condition
  becomes a Possible trip, so Possible trips is the default bucket (38 of 76
  episodes on the owner's phone, 32 of them "close to Home"). v1.3 makes
  Hidden the default:
  1. **Atlas** — outside Home, at least 5 reliable photos, and corroborated
     (2+ sessions or 2 separate places); Home covers the dates; no conflict
     or owner veto.
  2. **Possible trip** — only with positive evidence: outside Home and at
     least one strong trip signal (photos on 2+ consecutive days, or
     corroborated, or 5+ reliable photos), but not every Atlas condition; or
     an owner-fixable problem (Home not set for those dates, conflicting
     photo times).
  3. **Hidden** — everything else.
- **Frequent places never block Atlas.** Repeat trips (for example Dalat
  several times a year) are trips.
- **Hidden is visible on request.** A collapsed "Hidden outings" card on the
  Atlas lists hidden episodes that left Home, each with its reason and a way
  to review its photos and keep it. It is noticeable but never prominent, and
  it is not in Settings. In-Home and screenshot-only groups stay unlisted.
- **Nothing disappears silently.** Every hidden episode still stores a closed
  reason (decision 0021).
- **Measured before adoption.** New rule version `trip-detector-v1.3`,
  checked against an updated synthetic lifetime benchmark and a dry-run count
  on the owner's phone (aggregates only) before it replaces v1.2. v1.2 stays
  available as rollback (M10.8 core).

## Context

On the owner's device, Possible trips filled with errands and day outings
that are not trips, degrading the Atlas. v1.2 routed every uncertain episode
there by design ("Not sure → Possible trips"); the owner reversed that
direction on 2026-11-22.

## Consequences

Supersedes decision 0021's "Not sure → Possible trips" and "≥50 km from every
Home" rules, and its frequent-place Atlas block. Home being required and
owner-set, owner corrections and decision 0018 remain in force. Raising the
radius cap above 50 km changes the local SQLite constraint, the app's
validation, the account history contract and the server's sync guard (a
Supabase migration needing owner approval to deploy). Details:
[detector-v1-3.md](../../_bmad-output/specs/spec-trip-recognition-repair/detector-v1-3.md).
