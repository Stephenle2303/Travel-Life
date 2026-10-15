---
title: 'Display supportable travel statistics'
type: 'feature'
created: '2026-10-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '0e8fffd27135b7c231de6d6da4a85a56ffb06351'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0002-mvp-first-delivery.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m3-3-open-journeys-and-source-linked-memories.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The private Atlas reveals journeys and places but provides no concise, trustworthy summary of what the currently reconstructed local record supports. Owners need counts that agree with Atlas, exclude duplicate or unresolved evidence, and do not turn approximate evidence into unsupported travel claims.

**Approach:** Add a read-only inferred-statistics projection to the committed local reconstruction run and render it on Atlas. Count journeys and places directly from durable reconstruction entities. Resolve country totals locally with a bundled, versioned Natural Earth Admin 0 country dataset, omitting invalid, border-ambiguous, and unresolved coordinates.

## Boundaries & Constraints

**Always:** Read one completed run after the private-record lifecycle confirms it is connected. Count durable journeys and places only; never derive totals from memberships, visit-support links, media, or raw evidence rows. Use an offline Natural Earth 1:110m Admin 0 Countries 5.1.1 dataset inside the app, record its version, and keep coordinates, country codes/names, source references, dates, and resolver internals inside the local boundary. Label every displayed total as inferred and scoped to the available private record. Recompute statistics from each newly completed reconstruction run so they naturally reflect completed eligible correction/rebuild changes. Preserve an accessible text state when country resolution is unavailable or yields no supported country.

**Never:** Upload or geocode coordinates; call a map, AI, or network service; expose a country list, country codes, raw coordinates, evidence IDs, dates, durations, routes, travelled distance, media, or source references in Atlas, telemetry, navigation, or logs; mutate history; claim owner presence, complete lifetime coverage, or correction behavior that M4.1 has not implemented.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed local record | Connected record with one completed reconstruction run | Atlas shows inferred journey, place, and supported-country totals from that same run | No source or geographic detail leaves the repository |
| Duplicate or unresolved evidence | Repeated support/membership rows, unresolved disposition, or invalid coordinate | Count each durable journey/place once; omit unresolved country assignments | Do not substitute a country or inflate a total |
| Border or absent country result | Point falls on/near a boundary or the bundled resolver cannot classify it | Keep journey/place counts and show country count as unavailable or zero supported countries with an explanation | Do not fall back to network geocoding |
| Restricted, pending, or stale record | Disconnected lifecycle, processing run, failed reveal, or invalidated read | Do not publish a newer statistics result; Atlas keeps its existing truthful recovery state | Return no stale aggregate result after lifecycle invalidation |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- advance the local schema from v11 for a resolved country value and dataset version on reconstructed places; retain deletion/lifecycle cleanup and do not touch canonical source records.
- `apps/mobile/src/reconstruction/country-resolver.ts` plus a bundled Natural Earth data asset -- provide a deterministic offline point-in-polygon boundary that returns only a private country code or unresolved result; isolate dataset attribution/version and border ambiguity handling.
- `apps/mobile/src/reconstruction/repository.ts` -- resolve country data during atomic rebuild, then read a single completed run into a redacted aggregate statistics projection; count `reconstruction_journey` and `reconstruction_place`, not links or evidence.
- `apps/mobile/src/reveal/{types,projection}.ts` -- add the minimal inferred aggregate model, preserve the redaction guard with a narrow validated aggregate exception, and make processing/restricted/failed states unavailable rather than stale.
- `apps/mobile/src/components/{mobile-screens,atlas-reveal}.tsx` -- pass and render an accessible, read-only Living Atlas statistics panel without adding a route or map dependency.
- `apps/mobile/src/components/__tests__/{reconciliation-repository,atlas-reveal}.test.tsx` and a new resolver test -- cover run consistency, duplicate/membership exclusion, country omission, privacy, and readable UI states using synthetic coordinates only.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reconstruction/country-resolver.ts` and bundled dataset files -- add a compact, documented Natural Earth 1:110m Admin 0 Countries 5.1.1 offline resolver with explicit invalid/border/unresolved outcomes and no runtime network path.
- [x] `apps/mobile/src/import-record/repository.ts` and `apps/mobile/src/reconstruction/repository.ts` -- migrate reconstructed-place country metadata, resolve it only during local rebuild, and load redacted journey/place/country totals from the one latest complete run.
- [x] `apps/mobile/src/reveal/{types,projection}.ts` -- carry validated aggregate-only inferred totals to Atlas while rejecting country labels/codes and every other private field.
- [x] `apps/mobile/src/components/{mobile-screens,atlas-reveal}.tsx` -- render the aggregate panel in logical screen-reader order, with explicit incomplete-record and country-unavailable wording independent of map availability.
- [x] `apps/mobile/src/components/__tests__/` -- add deterministic resolver, repository, projection, and Atlas tests for the matrix, including no country detail in payloads and no duration/distance/route text.
- [x] `docs/project-state.md` and this spec -- record the selected dataset/version, checks, and unverified device/reconstruction limits.

**Acceptance Criteria:**
- Given a connected completed local reconstruction, when Atlas opens, then it shows inferred journey, place, and supportable country totals derived from the same committed run without exposing private records.
- Given duplicate copies, repeated memberships, unavailable evidence, unresolved countries, or border ambiguity, when totals are calculated, then each durable journey/place is counted once and unsupported countries are omitted without replacement.
- Given a completed rebuild after an eligible correction, when the new run becomes visible, then Atlas statistics come from that new run; pending, restricted, and failed states do not claim a refreshed total.

## Implementation Notes

## Spec Change Log

## Review Triage Log

- blind-hunter — medium / patch — `countryStatus` always reported supported and unresolved results lacked dataset provenance, so older or incompletely resolved runs could be shown as zero countries; persist the resolver dataset version for every reconstructed place and derive status/counts only for the current dataset.
- blind-hunter — medium / patch — the aggregate read accepted country codes from any resolver version, allowing stale or partial rows to affect the current total; scope country counts to the current bundled dataset version.
- blind-hunter — medium / patch — the resolver scanned every geometry edge for every place while an atomic rebuild holds SQLite; precompute local bounding boxes and skip non-candidate countries before ring checks.
- blind-hunter — low / patch — the fixed angular border margin varies in physical distance by latitude; use a bounded meter-based local comparison so the ambiguity rule is applied consistently.
- blind-hunter — medium / patch — the resolver test called an ocean coordinate rather than a dataset boundary; add a deterministic bundled-ring border fixture that must remain unresolved.
- blind-hunter — medium / patch — JourneyDetailScreen retained an old result or error when its opaque route ID changed; clear both before beginning the replacement read.
- blind-hunter — low / patch — provider rerenders recreated the journey-detail loader and could repeat bounded preview reads for the same detail screen; memoize it against its actual lifecycle dependencies.
- blind-hunter — medium / patch — visit precision used the least-conservative supporting value, which could overstate a mixed-precision visit; require all support to have precise offsets before displaying time precision.
- blind-hunter — medium / patch — memory evidence with both membership and visit support was rendered twice and could consume the bounded preview limit; combine its associations into one memory model with both owner-readable reasons.
- edge-case-hunter — medium / patch — antimeridian-crossing country rings were not unwrapped before containment and boundary checks, so interior points could be omitted; normalize longitude segments around the tested point.
- verification-gap — medium / patch — no rebuild behavior test asserted resolved and unresolved country metadata written to reconstructed places; add deterministic repository coverage for both writes.
- verification-gap — high / patch — no v11 migration test asserted both new reconstructed-place columns before schema version advancement; add a direct upgrade-path test.
- verification-gap — medium / patch — border ambiguity was untested; add an actual bundled geometry edge assertion.
- verification-gap — medium / patch — provider lifecycle coverage invoked only a helper rather than the guarded detail flow; mount a provider harness with deferred detail/preview reads and assert lifecycle invalidation rejects them.

## Design Notes

Keep the panel calm and secondary to map/timeline exploration: one `InsetPanel`, a plain “Inferred local record” heading, three readable count lines, and short support/coverage language. Treat “country unavailable” as an honest text state, never a zero shown as complete travel coverage.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand reconciliation-repository atlas-reveal country-resolver` -- expected: aggregate, resolver, redaction, and Atlas states pass with synthetic fixtures.
- `npm --prefix apps/mobile run check` -- expected: Jest, TypeScript, Expo lint, and Expo Doctor pass; report the known dependency drift separately if it remains.
- `npm run check` -- expected: repository framework and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Actual (2026-10-13):** Focused repository, Atlas, resolver, import, lifecycle-provider, and journey-detail checks passed 6 suites / 44 tests. Mobile Jest passed 25 suites / 183 tests, with TypeScript and Expo lint also passing. Expo Doctor reported 20/21 checks because six existing Expo SDK 57 patch versions are behind its expected versions; this feature did not change dependencies. Root `npm run check` passed framework integrity, 20 foundation tests, and evaluation smoke checks; `git diff --check` found no whitespace errors. The bundled `natural-earth-110m-admin-0-countries-5.1.1.json` is derived from Natural Earth Admin 0 Countries 1:110m 5.1.1 and is resolved only on device. Physical SQLite migration, iOS/Android resolver performance, screen-reader behavior, lifecycle interruption, and reconstruction accuracy remain unverified.
