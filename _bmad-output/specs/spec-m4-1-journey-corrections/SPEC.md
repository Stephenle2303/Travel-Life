---
id: SPEC-m4-1-journey-corrections
companions:
  - ../../implementation-artifacts/spec-m4-1-confirm-reject-and-edit-a-journey.md
  - brownfield.md
  - ../../../docs/product/design-system.md
  - ../../../docs/decisions/0006-photo-trip-assignment.md
  - ../../../docs/decisions/0007-reconstruction-v1-parameters.md
sources: []
---

> **Canonical contract.** This SPEC and its companions define M4.1. The implementation artifact remains the single delivery record.

# M4.1 journey corrections

## Why

The owner can inspect inferred journeys but cannot yet save a review or rely on an edit surviving a rescan. M4.1 must make the private history correctable without converting photo metadata into proof of presence or silently moving an owner decision to the wrong journey.

## Capabilities

- **CAP-1**
  - **intent:** The owner can confirm, reject and edit the reviewed facts of a private journey.
  - **success:** Title, date precision, destination and status changes show their owner or inferred provenance; confirmation covers only reviewed facts and source evidence remains intact.
- **CAP-2**
  - **intent:** Owner corrections remain attached to their intended evidence and associations as history changes.
  - **success:** Restart, same-evidence rescan and incremental/background rebuild either remap every correction exactly or preserve the last complete view and its effective applications while a newer candidate is typed `pending_remap`; no partial candidate run publishes.
- **CAP-3**
  - **intent:** The owner can split or merge a strictly ordered journey and review the resulting claims.
  - **success:** A valid save publishes successors and counts atomically while predecessor-wide title, bounds and confirmation await scope review.
- **CAP-4**
  - **intent:** The owner can resolve one uncertain photo without reviewing the whole library.
  - **success:** One explicitly selected primary journey membership persists per known support unit, and a trip-only photo gains no visit support.
- **CAP-5**
  - **intent:** The owner sees one coherent corrected history in Journey detail, Timeline and Atlas.
  - **success:** Those surfaces use one committed owner-visible journey projection; place and country counts remain based on eligible source support.

## Constraints

- Evidence provenance, uncertainty and owner decisions outrank deterministic inference and optional AI. Photo GPS does not prove owner presence; journey membership never creates visit support.
- A remap must resolve every saved typed key, every complete reviewed visit set, one eligible successor per set and the correction's scope relationship. Any failed step makes the entire candidate run pending; percentages and generated IDs cannot rescue a partial match.
- An active owner decision, its application in the last committed projection, and a newer candidate evaluation are separate records. A `pending_remap` evaluation cannot replace an `effective` committed application; an owner split/merge may commit successors with predecessor-wide claims in `pending_scope_review`.
- A rejection remains binding until explicit owner reversal. Rebuilds must enforce its saved support-unit and visit incompatibility constraints before grouping, regardless of generated IDs or later evidence.
- Correction writes, successor projection, counts and queue acknowledgement share one local atomic boundary with rebuilds and lifecycle checks. A stale preview cannot commit.
- Family-scoped remapping requires a durable verified family identity and support provenance. The current adapter has neither; no implementation may infer a family from similar media or claim family correction stability before that dependency is delivered.
- Use the official Living Atlas Journey detail composition. Keep correction data on device; M4.1 has no publication or model upload path.
- Owner corrections and manual associations cannot count as automated reconstruction recovery; synthetic regression cases do not measure product accuracy.

## Non-goals

- Publishing, sharing, deleting originals, adding a missing journey manually, and M4.3 hide/exclude/delete controls.
- Treating synthetic regression cases as measured reconstruction accuracy or verified device behavior.

## Success signal

An owner corrects a journey, sees the saved local result across Atlas and detail, and a same-evidence rescan keeps that decision. A rebuild with split or conflicting reviewed support instead retains the last complete view and shows a resolvable pending remap, with no wrong successor accepted.

## Assumptions

- The existing M4.1 implementation artifact is the delivery record; this kernel and its companions supply the planning contract.

## Open Questions

- Which durable local signal establishes duplicate-family identity and source-origin/support eligibility? Family-key remapping and the duplicate-family acceptance cases remain implementation dependencies until that signal and its migration are specified.
