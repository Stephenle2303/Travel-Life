---
title: 'Resolve every visible Atlas and Replay Edit trip card cover'
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

**Problem:** Edit Replay and Atlas Timeline reuse the Share Replay card shell,
but cards still lack the per-trip cover that lets the owner recognize a journey.

**Approach:** Reuse the existing private, paged local-preview boundaries to
resolve one authorized cover for every visible card. Retain the truthful fallback
when no cover can be resolved, without changing trip membership or media scope.

</frozen-after-approval>

## Implementation Notes

Diagnostic map: this is presentation over existing local preview boundaries.
Replay Edit uses `loadReplayEditorPreviewPage` and inherits its fixed
`REPLAY_ACCESS`/`REPLAY_STALE` classification; Atlas uses the existing
`loadJourneyDetail` then `loadJourneyMediaPage` boundary and preserves its
current safe recovery behavior. Optional cover failure leaves the card usable
with the `TRIP` fallback; it creates no new terminal diagnostic. Collection
recipe: use a fresh mobile build with synthetic-safe media, inspect only the
existing closed `Travel Life diagnostic` events for the owner action correlation,
and never collect media URIs or raw errors.

Code map: `replay-screen.tsx` already resolves Share-card covers in 48-item
batches but Edit overview never invokes that resolver; `atlas-reveal.tsx` calls
detail preview reads but needs the existing first gallery page as a fallback
when a detail preview does not yield a usable cover. `trip-list-card.tsx` stays
presentational and must not access source media itself.

Implementation: extracted `LocalTripMediaCover` so every list surface uses the
same private thumbnail/poster lifecycle as Share Replay. Edit overview requests
one unresolved candidate per eligible trip through the existing 48-item paged
boundary and reads the resulting local override. Atlas falls back from an empty
detail preview to its first media page, under its existing four-worker bound.
The changes retain every card's current fallback, selection, privacy, and media
membership behavior.

Verification: focused `replay-screen` and `atlas-reveal` Jest suites pass 111
tests; mobile `npm run typecheck`, `npm run lint`, and root `npm run check`
pass. An owner-operated Android/iOS build still needs to visually confirm real
photo and video covers on every visible trip card.

## Review Triage Log

Blind Hunter identified one medium finding: a selected Atlas detail with no
preview could complete after the Timeline media-page fallback and overwrite a
resolved cover with `null`. Corrected by retaining the existing Timeline cover
when the selected detail has no URI. Added a deferred-order regression for that
race. One low test-gap finding was addressed by the same regression. No findings
were declined; no other review layers are configured for this oneshot route.

