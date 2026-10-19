---
title: 'Trip Detection Engine V1.1: qualified automatic travel'
type: 'feature'
created: '2026-10-16'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '00211bdeae7519281c31087e822a5439a08bcd8b'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/evals/README.md'
  - '{project-root}/_bmad-output/specs/spec-trip-detection-engine-v1-1/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current engine turns virtually every eligible visit sequence into an inferred journey and the durable reveal publishes every such draft. This creates a high owner-review burden and makes the private Atlas feel untrustworthy.

**Approach:** Add a deterministic V1.1 qualification pipeline beside the legacy graph, normalize only local metadata needed by its rules, persist a correction-safe qualified generation, and make Atlas, counts, and replay consume only automatically confirmed or owner-confirmed/manual journeys. The complete rule contract is frozen in `specs/spec-trip-detection-engine-v1-1/`.

## Boundaries & Constraints

**Always:** Keep all evidence, metadata, diagnostics, and media local; use synthetic public fixtures; retain exact support-based correction/remap semantics and atomic generation replacement; use V1.1's date-scoped bases/routines, 50-km away lower bound, independent five-photo units, independent location corroboration, contradiction gates, score and DAY/STAY profiles identically for first and incremental rebuilds. Publish the same qualified set to Atlas, statistics, and replay. Keep uncertainty and unsupported drafts private/review-only, with no invented route, return, presence, city name, or precise UI exposure.

**Never:** Silently reinterpret persisted `reconstruction-v1` runs, download originals or send evidence to a provider for detection, treat a duplicate family as multiple photo units, infer base/routine from the candidate under test, auto-publish sharing, or activate/rewrite legacy history without a separately approved revision-bound dry run and rollback record.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Supported automatic trip | Normalized independent units form a time-valid away episode, pass every hard gate and score a qualifying profile | One `AUTO_CONFIRMED` V1.1 trip is committed and appears in Atlas/counts/replay with redacted anchors | No per-trip confirmation is requested. |
| Weak or contradictory candidate | Missing base/routine evidence, insufficient units/location, routine match, impossible chronology, conflict, or score below profile | Persist private `SUGGESTED`/`REJECTED` diagnostic; exclude it from primary reveal and aggregates | Expose at most the approved high-value review prompt, never an inferred map card. |
| Owner and rebuild evolution | Existing correction, manual/confirmed journey, reordered or incremental evidence, stale lifecycle, or remap ambiguity | Exact reviewed support wins; accepted generation replaces atomically only after complete correction application | Preserve last complete projection and mark remap needed on ambiguity; never publish a partial generation. |
| Native metadata unavailable | Platform cannot provide original capture-zone/duplicate information or source permission changes | Use specified capability flag/fallback; conservative rules do not manufacture precision or independent units | Keep item eligible only where contract permits; record aggregate limitation without raw metadata. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/photo-access/native-adapter.ts` and `apps/mobile/src/import-record/types.ts` -- normalize present Expo metadata and V1.1 capability fields without media transfer.
- `apps/mobile/modules/` plus `ios`/`android` native sources -- small local bridge for permitted capture-zone, source-origin, and duplicate metadata with explicit platform fallback.
- `apps/mobile/src/reconstruction/{types,engine}.ts` -- additive V1.1 evidence, temporal context, candidate decision, score/profile and destination-support pipeline; preserve V1 graph compatibility.
- `apps/mobile/src/reconstruction/repository.ts` -- versioned rebuild, correction-safe atomic persistence, durable qualification filter and aggregate parity.
- `apps/mobile/src/import-record/repository.ts` -- schema v29 migration and private qualified-generation/diagnostic storage and deletion coverage.
- `apps/mobile/src/reveal/{types,projection}.ts` and `apps/mobile/src/components/atlas-reveal.tsx` -- redacted primary/review projection with no draft leakage and existing Atlas interaction contracts.
- `apps/mobile/src/components/__tests__/{reconstruction-engine,reconciliation-repository,import-repository,atlas-reveal}.test.tsx` -- synthetic rule, migration, persistence/redaction, and UI regressions.
- `evals/README.md`, `docs/project-state.md`, `docs/development/error-playbook.md` -- evaluation limits/results, delivery evidence, and any incident learned during this work.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/mobile/src/photo-access/*`, `apps/mobile/modules/*`, platform sources, and import types -- implement the V1.1 local metadata capability contract and bounded adapter fallback; add native unit/contract coverage without exposing raw media data.
- [ ] `apps/mobile/src/reconstruction/{types,engine}.ts` -- add a versioned pure V1.1 decision output, deterministic normalization, base/routine leave-one-out context, episode construction, hard gates, scoring/profiles, destination gates and diagnostic reasons; do not replace `reconstructV1` in place.
- [ ] `apps/mobile/src/import-record/repository.ts` and migration tests -- add v29 private schema/migration, generation cleanup and all version assertions per EP-012.
- [ ] `apps/mobile/src/reconstruction/repository.ts` -- persist V1.1 qualification and profile diagnostics atomically with graph/corrections; filter the durable primary query, journey count and replay eligibility from one qualified-set predicate while retaining a separate review projection.
- [ ] `apps/mobile/src/reveal/*` and Atlas tests -- consume the repository's redacted qualified/review projections; keep cards, map, timeline, media and correction-return behavior intact and never reveal support IDs/reasons/precise coordinates.
- [ ] `apps/mobile/src/components/__tests__/*` -- implement all 64 canonical synthetic cases, import-order/rebuild determinism, native fallback, schema upgrade/deletion, durable hidden-draft and empty-qualified-set regressions.
- [ ] `evals/README.md`, `docs/project-state.md`, and this spec -- attach commands/results and label contract tests as `product_quality: not_measured`; record the private labeled-evaluation/dry-run procedure without inventing results.

**Acceptance Criteria:**
- Given every canonical V1.1 fixture and a permutation/repeated rebuild, when pure V1.1 reconstruction runs, then its qualified state, reason codes, score/profile, destination-support state and stable support identities exactly match the contract.
- Given a candidate that fails any automatic gate or only reaches an uncorroborated suggestion, when it is persisted, then it cannot appear in Atlas, Timeline primary rows, counts, replay eligibility or shared-preview input.
- Given a qualifying automatic, owner-confirmed, or manual journey, when durable reveal data is loaded, then all primary consumers receive the same redacted qualified set and aggregate counts; an all-unqualified run is sparse rather than an empty "ready" history.
- Given correction/remap ambiguity, interrupted lifecycle, migration upgrade, deletion/disconnect, or a native capability fallback, when a rebuild/import occurs, then no partial/stale publication or broadened correction is possible and existing valid history remains recoverable.
- Given root and mobile verification plus the V1.1 synthetic suite, when results are recorded, then every command outcome is factual, no real evidence enters Git/output, and no product-accuracy or device-success claim is made without the required private evidence.

## Implementation Notes

- 2026-10-16: Added the first durable safety boundary: schema v29 stores a private per-run qualification result and primary durable reveal/count queries select only automatic or owner-confirmed rows. Legacy V1 graph rows are persisted as private suggestions until the full V1.1 context pipeline can classify them; this prevents their automatic Atlas/replay publication but is not a substitute for the remaining native/context implementation.
- 2026-10-16: The continuity refinement in `../specs/spec-trip-continuity-and-home-setup/` is now partially implemented. `constructCanonicalV11Graph` supplies unreviewed persisted journeys from V1.1 episode grouping while exact correction-protected journeys remain pinned. A Home save requires a reviewed `visitId`, so it stores the explicitly selected observed area at 20 km rather than the first journey visit. Native normalization, full C0/C1 context, generation lineage and device evidence remain incomplete.

## Spec Change Log

## Review Triage Log

## Design Notes

The durable repository boundary is the safety valve: algorithm drafts may be useful for an optional review queue, but only the explicitly qualified projection reaches the joyful primary experience. The new pipeline is additive because legacy graph IDs and correction lineage cannot safely be repurposed by a threshold change.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand reconstruction-engine reconciliation-repository import-repository atlas-reveal` -- expected: every V1.1 synthetic, persistence, redaction and migration regression passes.
- `npm --prefix apps/mobile run check` -- expected: mobile tests, TypeScript, lint and Expo checks complete successfully; report environment limitations exactly.
- `npm run check` -- expected: root framework, foundation and evaluation-smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Inspect the generated local dry-run manifest and owner-visible Atlas/review states with synthetic data only; confirm primary map/replay/counts omit drafts and review has no raw evidence or location disclosure.
