---
title: 'Deliver lean trip Edit flow and verified location corrections'
type: 'feature'
created: '2026-10-18'
status: 'in-review'
route: 'dispatch'
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
review_loop_iteration: 0
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
  - '_bmad-output/implementation-artifacts/trip-edit-flow-plan-2026-10-18.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trip editing is an overwhelming all-in-one correction page. The selected Atlas card exposes a competing `Correct location` action, while an owner-selected location can be reported as saved without visibly changing the target trip.

**Approach:** Replace the entry with a compact shared Edit flow containing the five approved tasks: Location, Name & dates, Destinations, Photos in this trip, and Trip accuracy. Make Location a focused self-service task whose success is verified against the committed trip before Atlas reports it as applied.

## Boundaries & Constraints

**Always:** Keep editing private/on-device; preserve inferred evidence, uncertainty, opaque IDs, existing correction remap and idempotency guarantees. Keep Map/Timeline selection context across Edit. Place selection fills the search field and places `Confirm place` in its same visual section. Preserve keyboard-open result taps and accessible 48px actions.

**Never:** Upload place queries/media, create a hard-coded Phú Quốc-only search path, treat photo location as proof of owner presence, falsely report a save as applied, or modify concurrent map/cartography work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Select location | Owner taps an offline result | Field becomes the selected label/context; one adjacent Confirm CTA uses that result | Editing/clearing query invalidates selection |
| Apply location | Final projection maps choice to the selected trip | Atlas/Timeline show its committed label and coarse marker | Return verified success and preserve selected context |
| Projection mismatch | Save/rebuild completes but read-back lacks selected place | No success state or misleading marker claim | Keep prior view; concise retry/reload state |
| Stale/remap | Snapshot changed or mapping is non-unique | Existing save guards/refusal remain | Explain/reload without silent reassignment |
| Other Edit tasks | Owner opens a task | Each task is isolated from the hub and from other drafts | Back/cancel does not mutate data |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/atlas-reveal.tsx` — selected-card order and Atlas-context callback; replace contextual location CTA with Edit.
- `apps/mobile/src/components/journey-detail.tsx`, `apps/mobile/src/app/journey/[id].tsx` — expose the same Edit entry for direct detail navigation.
- `apps/mobile/src/app/journey/[id]/correct.tsx`, `apps/mobile/src/components/journey-correction.tsx` — replace monolithic UI with the focused Location task; reuse current local search and correction payload validation.
- `apps/mobile/src/app/journey/[id]/edit*`, `apps/mobile/src/components/*` — new lean hub and dedicated task routes/screens.
- `apps/mobile/src/photo-access/provider.tsx` — correction publication/read-back outcome; do not infer applied from a refresh completing.
- `apps/mobile/src/reconstruction/repository.ts`, `apps/mobile/src/reveal/types.ts` — existing revision/application/final-graph mapping and redacted owner-place projection; extend only if a typed final-target outcome requires it.
- `apps/mobile/src/components/__tests__/journey-correction.test.tsx`, `journey-detail.test.tsx`, `atlas-reveal.test.tsx`, `photo-access-provider.test.tsx` — update entry assertions and add UI/read-back regressions.

## Tasks & Acceptance

**Execution:**

- [x] Atlas card/detail/routes — replace `Correct location` entry with `Edit` below `See photos & videos`; introduce an Edit hub and preserve selected Atlas context.
- [x] Edit task screens — split the current monolith into the five approved focused tasks, reusing existing action primitives: place; owner claim; destination remove/split/merge; media membership; grouping confirm/reject. Keep structural/review warnings only in their relevant task.
- [x] Location screen — retain offline search and keyboard behavior; model selected place explicitly, fill field on result choice, colocate confirmation, and avoid a generic preview panel.
- [x] Provider/repository boundary — after a place save, verify final committed target and redacted durable record/detail match selected place/anchor before returning `applied`; surface a recoverable non-success otherwise. Preserve command-key retries and structural successor safety.
- [x] Name & dates — permit independent owner title and owner-date changes/removal while keeping them distinct from observed evidence; migrate/read existing combined claims compatibly.
- [x] Tests and state records — add/adjust focused regressions, update the open error-playbook incident with verified cause/evidence, and record implementation status without claiming physical acceptance early.

**Acceptance Criteria:**

- Given a selected trip card, when it loads, then `See photos & videos` is followed by `Edit` and no competing location CTA appears in the card or Timeline rows.
- Given Edit opens, when the owner chooses a task, then exactly one focused flow opens and Back preserves the selected trip/Atlas context.
- Given an owner chooses Phú Quốc or another indexed place, when the result is tapped, then the search field reflects that selection and its only Confirm CTA is adjacent.
- Given a location save returns, when its final committed target/detail/reveal matches the selected place, then that trip alone shows the owner-confirmed label and coarse marker across Map and Timeline; otherwise it is never labelled applied.
- Given a custom title exists, when location changes, then the confirmed location remains visible separately and its map anchor is updated.
- Given name/date, destination, photo-membership or grouping edits, when an owner saves/cancels them, then only documented scope changes and observed evidence/source media remain intact.
- Given an app relaunch after a verified location correction, when the same trip is opened, then its confirmed place remains visible.

## Implementation Notes

- Existing place data persistence, final-graph remapping and durable reveal queries are reusable; the provider success condition is the known false-success seam.
- The current owner-claim validator requires both name and date, so independent editing needs a compatible claim contract/read path rather than UI-only changes.

## Spec Change Log

- 2026-10-19: Implemented the approved Edit hub and all five focused task routes. Location has its own selected-place state and strict durable read-back gate, including the unique final successor when a rebuild rotates its opaque display ID. Android owner acceptance remains outstanding.

## Review Triage Log

- 2026-10-19: Scoped source review found one release-blocking success-gate edge: continuity may rotate the corrected journey's opaque display ID. Resolved by accepting only a unique final durable successor with the selected label/anchor and reading its detail before returning `applied`. No other newly introduced high/medium findings in the Edit-flow paths. Device visual acceptance remains open.
- 2026-10-19: edge-case-hunter / `provider.tsx` — **high, patch**: the successor lookup compared a coarse durable marker with raw selected coordinates. Rounded both sides to the product's one-decimal coarse-marker precision; regression now uses raw selection coordinates and coarse durable coordinates.
- 2026-10-19: blind-hunter / `journey-edit.tsx` retry — **low, patch**: retry treated a false rebuild result as finished. It now retains a non-success status.
- 2026-10-19: blind-hunter / `edit/[task].tsx` rejection route — **medium, patch**: applied rejection's Atlas action was a no-op. It now returns to Atlas.
- 2026-10-19: blind-hunter / `JourneyEditHub` load failure — **medium, patch**: the hub could render editable actions after an unavailable detail read. It now has opening and unavailable states and only renders task actions with a loaded detail.
- 2026-10-19: blind-hunter / broad correction component — **false**: each task mounts a fresh correction screen and all unrelated panels are conditionally excluded by its `task` prop; no cross-task action is exposed.
- 2026-10-19: blind-hunter / country abstention, source provenance, home-area qualification, video/session normalization, and inferred anchor selection — **defer**: these are pre-existing or concurrent V1.1 engine changes outside the approved Trip Edit goal. They must be triaged under the V1.1 engine work without mixing them into this correction regression.
- 2026-10-19: verification-gap / source-provenance reconciliation fixture — **defer**: valid verification gap for concurrent V1.1 qualification persistence, not caused by this Trip Edit change.
- 2026-10-19: verification-gap / Home-base rename-removal UI checks — **defer**: valid verification gap for concurrent Home-base controls, not caused by this Trip Edit change.
- 2026-10-19: verification-gap / mixed country resolution — **defer**: valid concern in concurrent country resolution; not needed to determine a user-confirmed place label.

## Design Notes

The hub is deliberately a menu, not a form. It shows only task labels and compact current status. High-impact grouping and structural actions retain scoped confirmation; routine location/name edits use one explicit Save once their selection is valid.

## Verification

**Commands:**

- `npm --prefix apps/mobile test -- --runInBand` — expected: relevant and full mobile suites pass after concurrent-map baseline is accounted for.
- `npm --prefix apps/mobile run typecheck` — expected: no TypeScript errors.
- `npm --prefix apps/mobile run lint` — expected: no new diagnostics in changed files.
- `npm run check` — expected: foundation, contracts and smoke checks pass.
- `git diff --check` — expected: no whitespace errors.

**Manual checks:**

- On Android, use the Feb 2022 trip to choose Phú Quốc and confirm it; verify the field, adjacent CTA, visible label and map marker immediately and after reopening. Repeat on a different trip.
