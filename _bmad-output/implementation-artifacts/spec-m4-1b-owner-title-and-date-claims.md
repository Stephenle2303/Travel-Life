---
title: 'M4.1b owner title and date claims'
type: 'feature'
created: '2026-10-14'
status: 'complete'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m4-1-confirm-reject-and-edit-a-journey.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An owner can confirm or reject an inferred journey but cannot correct its label or describe the timeframe they remember. The detail view therefore presents an inferred, generic title and observed evidence span as the only usable journey description.

**Approach:** Let the owner save a private journey title and either an exact day or an approximate date interval, then show those claims beside the unchanged observed span with clear provenance.

## Boundaries & Constraints

**Always:** Persist title and date claims as immutable local correction revisions bound to the selected completed reconstruction. Validate title and date formats before saving; retain observed dates separately; label owner-entered values as owner claims; reject stale, unavailable, or invalid saves without publishing a partial claim; keep the durable application tied to one exactly mapped successor journey.

**Never:** Infer dates, routes, or owner presence from the claim; change visit membership, source evidence, place/country totals, confirmations, rejection constraints, split/merge structure, duplicate-family identity, or sharing behavior. Do not upload media or correction data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Save title and exact date | Nonempty title and `YYYY-MM-DD` | The corrected detail shows the owner title and `Owner date: YYYY-MM-DD`; observed span stays visible | N/A |
| Save title and approximate interval | Nonempty title and ordered `YYYY-MM-DD` bounds | The detail shows an owner approximate interval and unchanged observed span | Reject an inverted or malformed interval before saving |
| Rescan maps exactly | Same reviewed support in one successor | The title/date claim remains attached to that successor | N/A |
| Rescan maps ambiguously | Missing, split, or duplicated reviewed support | Retain the prior complete projection and record pending remap | Do not copy a claim by generated ID or majority overlap |
| Stale or disconnected editor | Selected run/lifecycle changes before save | No new revision or visible claim | Prompt the owner to reload or reconnect |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- owns local SQLite migrations and delete-all cleanup; extend the correction revision contract without altering existing revision semantics.
- `apps/mobile/src/reconstruction/repository.ts` -- reads selected detail, validates stale saves, persists revisions, remaps corrections, and projects durable application state.
- `apps/mobile/src/reveal/types.ts` -- defines the owner-readable detail shape; distinguish observed span from optional owner claims.
- `apps/mobile/src/photo-access/provider.tsx` -- protects lifecycle-gated detail reads and saves; extend the typed correction command only.
- `apps/mobile/src/components/journey-correction.tsx` -- existing private correction flow; add accessible title/date controls and explicit preview language using the Living Atlas primitives.
- `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts` and `journey-correction.test.tsx` -- cover migration/write/read and owner-visible controls without raw private identifiers.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/import-record/repository.ts` and `apps/mobile/src/reconstruction/repository.ts` -- add a typed title/date claim revision and exact-successor application/read model -- preserves immutable local history and remapping safety.
- [x] `apps/mobile/src/reveal/types.ts` and `apps/mobile/src/photo-access/provider.tsx` -- expose owner claims separately from observed evidence and save them through the current lifecycle gate -- prevents a claim from being presented as an observation.
- [x] `apps/mobile/src/components/journey-correction.tsx` -- add restrained accessible title and date-bound inputs plus a save preview -- gives the owner a reviewable, private correction path.
- [x] `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts` and `apps/mobile/src/components/__tests__/journey-correction.test.tsx` -- cover all matrix rows and error states -- protects validation, stale-write, and provenance behavior.
- [x] `docs/project-state.md` -- record result and verification boundary -- keeps the active delivery evidence honest.

**Acceptance Criteria:**
- Given a selected inferred journey, when the owner saves valid title/date claims, then the updated detail distinguishes them from the observed span and keeps source evidence unchanged.
- Given invalid dates, an inverted interval, a stale token, or unavailable private record, when Save is attempted, then no claim revision is committed or displayed.
- Given a later exact successor, when reconstruction reruns, then the claim maps only to that successor; ambiguous mapping enters pending remap without a partial publication.
- Given an owner title/date edit, when Atlas statistics are read, then journey/place/country totals follow the committed reconstruction and remain evidence-support based.

## Implementation Notes

- 2026-10-14: Created after the owner accepted the PM/architecture split of M4.1 and directed implementation of the next slice. Existing M4.1a correction revisions, atomic save, lifecycle checks, and successor application rules are the required foundation.

## Spec Change Log

## Review Triage Log

## Design Notes

Use the agreed Living Atlas correction composition: one bounded section, owner-claim labels, and calm private-language copy. Place observed evidence and owner claims in separate panels; an owner-entered interval is not a trip route or observed departure/return time.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand reconciliation-repository journey-correction` -- matrix tests pass with no changed-suite console errors.
- `npm --prefix apps/mobile run typecheck` -- no TypeScript errors.
- `npm --prefix apps/mobile run lint` -- no Expo lint errors.
- `npm run check` -- foundation integrity, tests, and eval smoke pass.
- `git diff --check` -- no whitespace errors.

**2026-10-14 execution evidence:** The focused five-suite command passed 55
tests; after pinning the React-19.2-compatible `test-renderer@1.2.0` and using
RNTL v14's awaited event APIs, the full mobile suite passed 27 suites / 213
tests without console diagnostics. Mobile typecheck, Expo lint, the root
`npm run check`, and `git diff --check` passed. Device SQLite migration and
native input behavior are not yet verified.
