# Decision 0017 — Keep uncertain joins separate and search for Home bases

Date: 2026-11-10
Status: owner-selected behavior. Implementation and native acceptance pending.

## Trip continuity

When two adjacent groups each qualify independently and their continuity is
plausible but unsupported, retain the two trips in the main Timeline and offer
an optional merge for that exact pair. Show a visible relationship cue on the
Timeline beside the two trips. Open a separate review for the exact pair before
confirmation. The offer has no effect on the main trip count or Replay.
Confirmed owner boundaries and hard evidence conflicts suppress the offer.
The decision does not require a split merely because the country changes.
Continue to test genuine continuous travel and separate holidays together.
Positive continuity evidence and thresholds remain open.

## Home base selection

The owner rejected pin-first setup and requires searching by place name.
Use typed place search as the primary selection flow in first-use Home setup
and Settings. Show distinguishing locality and region context. The owner can
choose a result and review the area and applicable dates before saving. The
map can preview the chosen area without requiring a pin or coordinates from
the owner. Preserve existing Home areas and their effective periods.

Search coverage should include provinces, cities, districts, wards, and
communes as applicable. Street addresses and individual points of interest are
outside the required Home search coverage.

The current offline place search includes broad Admin-1 results and uses the
midpoints of their bounds. A result that only identifies a broad administrative
area cannot silently set a Home center. Verify search coverage and point quality
before deciding what dataset to bundle. The existing offline constraint remains
in force. An external search provider would require a separate decision covering
query disclosure and fallback.

## GPS-less trip discovery

The owner originally chose a quiet hint with per-cluster media selection and
processing approval. On 2026-11-11 the owner superseded that interaction:
Atlas must find candidate groups, choose representative photos and use AI to
suggest a place automatically. The owner reviews the resulting trip proposal
without entering dates or selecting input photos. The owner still confirms
before the trip is added. Processing authorization, provider choice and
rollout remain separate from confirmation of a trip. This UX decision does
not authorize transmission of private media to a provider.

## Related contracts

- [Atlas reconstruction recovery](../../_bmad-output/specs/spec-atlas-reconstruction-recovery/SPEC.md)
- [Recognizable reconstruction](../../_bmad-output/specs/spec-recognizable-travel-reconstruction/SPEC.md)
- [Home-first journey integrity](../../_bmad-output/specs/spec-home-first-journey-integrity/SPEC.md)
