---
title: 'Publish Atlas when journey correction remap needs review'
type: 'bugfix'
created: '2026-10-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '36458951cb11ca8b384053400e15841b240dccf3'
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An ambiguous saved journey correction currently throws during reconciliation, rolls back the newly derived Atlas, and leaves the owner without an actionable journey in an empty prior Atlas. This converts a reviewable correction into a global reconstruction outage.

**Approach:** Commit and reveal the newly derived Atlas and Timeline even when a correction cannot be mapped uniquely. Preserve the correction unchanged as pending review, associate its review state with every current journey supported by its reviewed evidence, and label those journeys so the owner can open Edit and decide what to do.

## Boundaries & Constraints

**Always:** retain private evidence, preserve correction provenance and reviewed support, never auto-remap or auto-discard a correction, use one atomic reconstruction transaction, keep owner-visible diagnostics fixed and non-private, and show a clear text label in both Atlas preview and Timeline.

**Never:** block or roll back a valid Atlas solely due to a remap-review state; fabricate a single target when reviewed support now spans journeys; create a manual journey as recovery; weaken history-correction gates; send correction/evidence data outside the device; or commit/push Git changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Exact remap | Effective correction maps to one final journey | Commit graph and effective application; no review label | Existing correction behavior remains |
| Ambiguous final remap | Effective correction support maps to multiple final journeys | Commit graph; retain correction as pending; mark each related journey `Needs review` | No generic reconstruction failure and queue is acknowledged |
| No current support | Pending correction has no current supporting journey | Commit graph; retain pending correction but do not invent a journey label | Atlas remains available; later evidence may make it reviewable |
| Structural/invalid remap | A correction cannot be safely applied before final graph construction | Do not silently apply it; retain review protection and preserve the last valid behavior until a separately designed safe mapping exists | No auto-remap or correction deletion |
| Owner review | Owner opens labelled journey | Existing Trip accuracy review exposes reason and preview-before-discard/new correction paths | Stale/private-record saves refuse safely |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/repository.ts` -- builds and commits graph, maps corrections to final journeys, persists remap candidates and applications; must retain only final-map ambiguity as non-blocking without changing structural correction semantics.
- `apps/mobile/src/reveal/types.ts` -- journey projection contract; needs a review marker safe for map and Timeline surfaces.
- `apps/mobile/src/reconstruction/repository.ts` `loadDurableReveal` / `loadJourneyDetail` -- emits opaque display journeys and already resolves pending candidates using reviewed support; adapt to expose related review labels after a successful commit.
- `apps/mobile/src/components/atlas-reveal.tsx` -- selected preview and Timeline rows; render compact textual `Needs review` label with no private reason on the list.
- `apps/mobile/src/components/journey-correction.tsx` -- existing protected review/preview-discard UI; reuse rather than creating a parallel correction surface.
- `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts` and `atlas-reveal.test.tsx` -- synthetic regression coverage for atomic commit and label visibility.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reconstruction/repository.ts` -- distinguish final committed-map ambiguity from reconstruction failure; persist it as pending while committing the graph and queue acknowledgement atomically.
- [x] `apps/mobile/src/reveal/types.ts` and projection readers -- carry an aggregate, opaque review marker to every related displayed journey without exposing correction IDs or support details.
- [x] `apps/mobile/src/components/atlas-reveal.tsx` -- render a small accessible Needs review label on affected rows/cards and keep Edit reachable.
- [x] `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts` and `atlas-reveal.test.tsx` -- prove ambiguous final map still commits/reveals, marks related journeys, and does not present catch-up failure.
- [x] `docs/development/error-playbook.md` and `docs/project-state.md` -- record the user-reported failure, correction, and verification scope.

**Acceptance Criteria:**
- Given one correction's reviewed support maps to multiple final journeys, when local reconciliation runs, then Atlas and Timeline publish those journeys and each related journey is visibly marked Needs review.
- Given that state, when the owner opens an affected journey and selects Edit then Trip accuracy, then the pending correction reason and existing owner-controlled actions are reachable.
- Given an ambiguous correction, when reconciliation commits, then neither the correction nor source evidence is deleted or silently applied to a guessed journey.
- Given unrelated reconstruction, access, SQLite, or history-correction failures, when they occur, then their existing recovery semantics remain unchanged.

## Implementation Notes

- Final-map matching evaluates each non-structural journey correction independently. Only a `JourneyCorrectionRemapRequiredError` encountered after pre-final validation succeeded becomes a pending candidate; structural and pre-final mapping still abort their transaction.
- The durable reader derives `needsReview` from a pending candidate's verified support intersection with the completed graph. It returns only the Boolean marker, never correction IDs, evidence IDs, or reasons.
- Verification: targeted mobile Jest 88/88, mobile TypeScript, Expo lint, root `npm run check`, and `git diff --check` pass. A full mobile Jest attempt exceeded this shell's 30-second output window after multiple suites passed, so it is not claimed as a completed full-suite result.

## Spec Change Log

## Review Triage Log

- `patch` — Verification-gap review identified no single test that drives final ambiguity through both durable candidate persistence and durable reveal loading. The code path is covered by the focused mapping regression, existing candidate-persistence regression, and durable reader/Atlas UI regression separately; a monolithic SQLite mock would add broad fixture coupling without changing the executable invariants. Device acceptance remains required.
- `false` — Blind review claimed reconciliation must show global `reviewRequired` for journey correction candidates. The approved contract intentionally moves that state onto related journeys and requires Atlas to be caught up; global review gating would reintroduce the blocked-rebuild flow.
- `false` — Blind review claimed a direct review CTA is required for candidates with no current support. The accepted matrix explicitly forbids inventing a journey target in that case; there is no honest journey route to offer.
- `defer` — Blind-review concerns about schema gates and SQLite batch byte accounting concern pre-existing performance/schema work outside this user-facing remap change. They remain in the existing performance recovery record.
- `false` — Blind review claimed the final-map catch silently downgrades malformed/pre-final corrections. Those corrections are evaluated by `applyStructuralBoundaries`, `applyJourneyCorrections`, and owner merge processing before final mapping; they still throw and roll back before `mapFinalCorrectionApplications` runs.

## Design Notes

The label is deliberately compact and descriptive, not a failure banner: `Needs review`. The owner learns details only after opening the journey, keeping Atlas map/list calm while preserving an explicit action path.

## Verification

**Commands:**
- `npm.cmd --prefix apps/mobile test -- --runInBand --cacheDirectory .jest-cache-codex reconciliation-repository.test.ts atlas-reveal.test.tsx journey-correction.test.tsx` -- expected: all targeted synthetic remap and UI tests pass.
- `npm.cmd --prefix apps/mobile run typecheck` -- expected: no TypeScript errors.
- `npm.cmd --prefix apps/mobile run lint` -- expected: no lint errors.
- `npm.cmd run check` -- expected: repository framework, foundation, and eval smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.
