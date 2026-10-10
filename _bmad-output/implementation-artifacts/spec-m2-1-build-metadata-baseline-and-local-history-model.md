---
title: 'M2.1 Build the metadata baseline and local history model'
type: 'feature'
created: '2026-10-10'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a3a6ca4d5ab017b3ad792fcc80402b599b0f50c7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Imported local evidence currently has no deterministic way to become reviewable places, visits, journey drafts, or independent memory associations. The result must preserve uncertainty and owner corrections rather than turning photo metadata into proof of travel or presence.

**Approach:** Add the versioned, on-device `reconstruction-v1` baseline and its durable SQLite history model. Rebuild from the final local evidence set in canonical order, persist explainable inferred output and run provenance, and expose only an honest Atlas-ready summary rather than a map, route, or public result.

**Decision:** Store latitude, longitude, and optional reported accuracy only in the device-local private record. A deliberate foreground re-import/rebuild collects these fields for the current permitted scope; exact coordinates remain excluded from cloud processing, Git, logs, and public claims.

**Decision:** Store the device-recorded civil capture date and a timestamp-precision marker only in the private record. Use conservative civil-day comparisons unless the source provides a trustworthy capture offset; do not manufacture an offset from import time.

## Boundaries & Constraints

**Always:** Apply decision 0007 exactly: 5 km complete-link clustering with its sort/ties/date-line math; bounded visit and journey rules; non-transitive possible merges; date-scoped usual-area context; and narrow GPS-less membership or suggestion rules. Preserve timestamp precision/timezone uncertainty, source provenance, duplicate-family support semantics, correction/exclusion precedence, stable identity lineage, and independent visit-support versus journey-membership links. A same final evidence/correction set must yield the same durable result regardless of input order. Keep all processing local, lifecycle-gated, parameterized, and resumable; record rule and evidence/correction revisions without raw traces.

**Never:** Upload or log media, filenames, paths, raw EXIF, coordinates, owner identifiers, or reconstruction traces. Do not infer routes, country/city labels, travel continuity, owner presence, exact duration, or confidence that evidence cannot support. Do not build cloud AI, sharing, automatic publishing, M2.6 incremental reconciliation, or owner correction UI in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Canonical rebuild | Connected private record with supported, dated evidence | Persist deterministic places, visits, inferred drafts, links, reasons, and run revision | Keep prior consistent history if the rebuild cannot commit. |
| Boundary/tie input | Date-line coordinates, 5 km cutoffs, A → B → A, 48/72-hour boundaries | Apply millimetre/tie/window rules and preserve separate returns or possible merges | Mark incompatible precision/order unresolved. |
| Uncertain or excluded evidence | Missing date/GPS, poor accuracy, unavailable/downloaded/duplicate-conflict, or owner exclusion | Keep evidence unresolved, unassigned, or suggestion-only; never inflate support | Record a reviewable reason, without a travel claim. |
| Lifecycle change | Disconnect, deletion, or import changes while rebuilding | Block late writes and retain only the last fully committed result | Report a recoverable pending/restricted result. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/photo-access/native-adapter.ts` and `types.ts` -- currently obtain location only to set availability; extend the local-only normalized candidate boundary only if approved.
- `apps/mobile/src/import-record/{types,repository,coordinator}.ts` -- versioned SQLite migration, canonical evidence, lifecycle transaction barrier, stable source references, and maintenance-compatible pages to reuse.
- `apps/mobile/src/history-record/{types,controller}.ts` -- lifecycle and correction-overlay boundary; preserve its deletion/disconnect behavior.
- `apps/mobile/src/reconstruction/` -- new pure deterministic engine, reason/uncertainty types, repository adapter, and rebuild coordinator.
- `apps/mobile/src/components/mobile-screens.tsx` and `photo-access/provider.tsx` -- surface an aggregate local draft/pending state without claiming a map or confirmed travel.
- `apps/mobile/src/components/__tests__/` -- Jest conventions for synthetic adapter/repository/UI contracts; add decision-0007 boundary and input-order regressions.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/photo-access/{types,native-adapter}.ts` and `import-record/{types,repository,coordinator}.ts` -- after the location-storage decision, migrate normalized local evidence and import/rebuild behavior without changing permission scope or leaking fields.
- [x] `apps/mobile/src/reconstruction/{types,engine,repository,controller}.ts` -- add a pure `reconstruction-v1` engine plus lifecycle-gated durable Personal Travel Graph tables, canonical rebuild transaction, provenance/reason records, and last-consistent-run protection.
- [x] `apps/mobile/src/history-record/` -- apply existing owner exclusions before inference and retain correction lineage; reserve new owner-boundary controls for the later correction story.
- [x] `apps/mobile/src/photo-access/provider.tsx` and `components/mobile-screens.tsx` -- trigger/recover local rebuilds and show an accessible inferred-draft, pending, restricted, or empty state.
- [x] `apps/mobile/src/components/__tests__/` -- add synthetic deterministic tests for decision 0007 cutoffs/ties, order invariance, A → B → A, sparse/local chains, GPS-less bracket/suggestion/unassigned paths, correction precedence, lifecycle late-write rejection, and no private-field logging.
- [x] `docs/project-state.md` and this spec -- record actual rule version, validation, and any unmeasured device/reconstruction limits.

**Acceptance Criteria:**
- Given the same final permitted evidence and corrections in different orders, when the local baseline rebuilds, then it produces the same versioned places, visits, drafts, associations, reasons, and unresolved states.
- Given the fixed boundary examples in decision 0007, when the engine evaluates them, then it follows the exact cutoff, tie, span, possible-merge, and uncertainty rules without claiming owner presence.
- Given unavailable, imprecise, excluded, duplicate, GPS-less, or lifecycle-blocked evidence, when a rebuild runs, then unsupported data cannot create visit support or unsafe writes and the prior consistent history remains available.

## Implementation Notes

- Added schema versions 6–8 to retain local-only coordinates, a device-recorded civil capture date, a precision marker, reconstruction tables, and a canonical-evidence revision. The source adapter always marks the presently available MediaLibrary timestamp as offset-unknown, so it cannot establish elapsed-time order.
- Added the deterministic `reconstruction-v1` engine and local transactional repository. Place, visit, and journey IDs derive from retained opaque evidence references rather than enumeration order. Civil-date-only evidence may form an uncertain same-place/day visit but never an elapsed-time journey.
- Rebuild runs only while the private record is connected. It applies the effective latest inclusion correction, retains the prior committed graph on failure, clears the in-memory graph on disconnect/delete, and records rule/evidence provenance locally.
- A completed full, limited, or selected import triggers a local rebuild. The Atlas screen exposes only aggregate draft status and a manual retry; it exposes no coordinates, source IDs, or travel claim.
- Known limits: physical SQLite migration/rebuild, actual GPS/accuracy metadata, iOS behavior, duplicate-family detection, owner boundary controls, and reconstruction quality against human labels remain unmeasured. This story supports duplicate-family conflict semantics when a future local deduplicator supplies them; it does not invent duplicate families from raw media.

## Spec Change Log

## Review Triage Log

| Finding | Resolution |
| --- | --- |
| UTC derivation and hardcoded timestamp precision could fabricate ordering | Persisted the device-recorded civil date and explicit precision marker; repository consumes them directly. |
| Selected imports did not trigger a rebuild | Trigger rebuild after a completed selected import. |
| Reconnect/disconnect could leave an in-memory draft visible | Clear the controller’s graph during lifecycle stop/delete. |
| A historical remove correction could override a later replacement | Query only the effective latest inclusion overlay per evidence target. |
| Maintenance dropped newly approved private fields | Maintenance upserts now retain date, precision, coordinates, and accuracy locally. |
| Positional graph IDs changed with enumeration | Derive graph IDs from stable opaque evidence references. |
| GPS-less membership could use weak timestamps | Require precise timestamps for the narrow bracket/suggestion path; date-only evidence remains uncertain. |
| SQLite open could remain poisoned after an error | Reset the cached open promise after rejection. |

## Design Notes

Use a pure evidence-to-graph engine so M2.4 can replay synthetic cases and M2.6 can later reconcile to the same final graph. Persist reasons and uncertainty as structured local fields; UI copy remains a summary, never a reconstruction trace.

## Verification

**Commands:**
- `npm --prefix apps/mobile run check` -- expected: synthetic engine, repository, UI, TypeScript, lint, and Expo checks pass.
- `npm run check` -- expected: foundation and evaluation smoke checks stay green.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Rebuild a consented device-local sample after the approved migration; inspect only aggregate draft/pending states and keep source media, IDs, coordinates, and raw traces out of Git.

**Observed 2026-10-10:** `npm --prefix apps/mobile test -- --runInBand` passed 19 suites / 100 tests and `npm --prefix apps/mobile run typecheck` passed. Physical-device reconstruction and local database migration are not yet verified.
