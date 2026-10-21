---
id: SPEC-legacy-atlas-continuity
companions:
  - ../spec-trip-detection-engine-v1-1/SPEC.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Legacy Atlas Continuity

## Why

This is a continuity repair for an owner whose previously visible private trips were correct. V1.1 qualification began treating every legacy V1 journey as a withheld suggestion, so reconnecting or catching up could turn a familiar Atlas into an empty screen. Travel Life must retain the owner’s trusted private history while it raises the automatic-quality bar for future detection, without turning the Atlas into a diagnostic dashboard.

## Capabilities

- **CAP-1**
  - **intent:** The owner can reopen a connected private Atlas and see previously committed legacy journeys as ordinary Atlas map and Timeline journeys.
  - **success:** A migrated record with legacy committed journeys renders the same redacted journeys, valid map anchors, Timeline access, and existing media/detail paths after reconnect and local catch-up.

- **CAP-2**
  - **intent:** The owner can catch up local changes knowing that the visible Atlas is the durable committed result.
  - **success:** Catch-up/rebuild does not announce success until its durable projection has been read back; a failed read preserves the prior committed Atlas and exposes one safe recovery action.

- **CAP-3**
  - **intent:** The owner experiences a clean Atlas rather than migration or confidence bookkeeping.
  - **success:** Legacy journeys carry no permanent migration, suggestion, confidence, or qualification label in map, Timeline, cards, details, counts, or Replay; a concise recovery message appears only for an actual unavailable/failed projection.

- **CAP-4**
  - **intent:** The system can apply the stricter V1.1 standard without retroactively erasing trusted history.
  - **success:** Newly detected or explicitly re-evaluated automatic journeys still require V1.1 automatic qualification before entering the primary Atlas, counts, Replay, or sharing inputs; preserved legacy journeys are not represented as newly auto-qualified.

## Constraints

- Preserve the last committed private Atlas/media while reconstruction, catch-up, migration, or a durable-read retry is in progress.
- Retain existing opaque IDs, correction/remap lineage, owner-entered journeys, private/local processing, and the redacted projection boundary.
- Keep legacy-continuity state separate from V1.1 automatic qualification so future re-evaluation cannot silently reinterpret a legacy journey as newly confirmed.
- Surface only fixed, non-sensitive local failure categories or plain owner-facing recovery copy; never expose raw evidence, source IDs, SQL errors, exact locations, or qualification reasons.
- Follow the Living Atlas map-first pattern; Timeline remains the equivalent fallback when no map anchor is supportable.

## Non-goals

- Re-lowering V1.1 gates or publishing `SUGGESTED`, `UNCONFIRMED`, `NOT_TRIP`, or rejected newly detected journeys.
- Requiring the owner to review or relabel every legacy trip, adding a review queue, or adding persistent diagnostic UI.
- Altering shared/public publishing, correcting legacy data automatically, deleting/rebuilding private history solely to restore visibility, or claiming device confirmation from automated checks.

## Success signal

After reconnecting and catching up, the owner returns to a familiar, calm Atlas with their existing journeys and map points intact. New trip detection remains conservative, and a genuine local failure is understandable without cluttering ordinary travel memories.

## Assumptions

- “Previously committed legacy journeys” means the owner-trusted V1 private journey projection that was visible before the V1.1 migration; it does not mean an unreviewed newly generated candidate.
