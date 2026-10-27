---
title: 'Allow Atlas Timeline cards to resolve covers concurrently'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/diagnostic-implementation-policy.md'
  - '{project-root}/docs/product/design-system.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Atlas Timeline cards do not reliably load their representative
photo, even though Share Replay can resolve the same private local media.

**Approach:** Permit independent, concurrent read-only journey cover requests
to finish under the current privacy lifecycle, while retaining the existing
truthful card fallback when local media is unavailable.

</frozen-after-approval>

## Implementation Notes

Diagnostic map: the provider's Atlas cover reads remain presentation-only local
reads. The existing lifecycle gate is the fallible boundary: a privacy mutation
or disconnected private record rejects publication and retains the card's
`TRIP` fallback; concurrent reads must not invalidate each other. No new
diagnostic operation is introduced because this correction removes a false
stale classification rather than adding a new failure boundary. Collection
recipe: use a fresh Android/iOS build, reload Atlas Timeline with at least two
synthetic-safe eligible trips, and inspect only fixed `Travel Life diagnostic`
events for the owner action correlation—never media URIs or raw errors.

Code map: `photo-access/provider.tsx` currently calls `durableRevealGate.next()`
in both `loadJourneyDetail` and `loadJourneyMediaPage`; Atlas intentionally
calls these independent reads concurrently in `atlas-reveal.tsx`. Capture the
existing gate generation instead so lifecycle invalidation remains protected
without cancelling sibling reads. `atlas-reveal.tsx` and the shared cover
renderer remain presentation-only. Extend `photo-access-provider.test.tsx` with
two deferred concurrent reads that both resolve their authorized previews.

Implementation: changed only the provider's read-generation capture from
`next()` to `current()` in the two concurrent-safe local media paths. Both now
also reject before native access when the private record is already disconnected.
The existing post-read lifecycle checks, privacy mutation protection, fallback
UI, and card renderer remain unchanged. Added separate deferred regressions for
two simultaneous detail reads, two simultaneous first-page media reads, and a
media-page read invalidated by a lifecycle change.

Verification: focused provider and Atlas suites pass 97 tests; mobile
typecheck/lint and root `npm run check` pass. Device confirmation remains open:
the local Android SDK `adb` executable is unavailable and no Travel Life device
surface is connected for inspection.

## Review Triage Log

- medium — Provider reads now guard the private lifecycle before native access;
  the repository remains authoritative, but this prevents needless local reads
  after the caller already knows the record is disconnected.
- medium — Added a deferred gallery-page invalidation regression. The existing
  two-read regression proves sibling reads share a lifecycle snapshot; a
  four-request variant would duplicate the same invariant without adding a
  distinct behavioral branch.
- low — Recorded the shared-generation invariant and negative lifecycle case in
  the delivery record.
