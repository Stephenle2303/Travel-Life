---
title: 'Verified platform duplicate-family identity for journey corrections'
type: 'feature'
created: '2026-10-14'
status: 'in-review'
route: 'dispatch'
baseline_commit: '0041c0098e0956bb72aebb711e48249ac411bef0'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/decisions/0007-reconstruction-v1-parameters.md'
  - '{project-root}/_bmad-output/specs/spec-m4-1-journey-corrections/SPEC.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m4-1-confirm-reject-and-edit-a-journey.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M4.1 can persist correction support keys, but its import adapter supplies no verified duplicate-family identity. It therefore cannot safely apply a family-scoped correction when an imported library presents multiple copies of the same item.

**Approach:** Accept only an explicit stable family identifier supplied by the platform adapter. Persist enough private support identity to verify every copy, represent a verified family as one support unit, and make remapping reject any missing, changed, or conflicting family rather than guessing.

## Boundaries & Constraints

**Always:** Treat an absent platform identifier as independent canonical evidence (`E:<id>`). Verify a family only when every available member has the same normalized support tuple: captured civil day, capture instant, offset-precision flag, latitude, longitude, reported accuracy, source origin, and support eligibility; `null` is a comparable value. Persist the family id, tuple version/fingerprint, reviewed member ids, and correction keys only in local SQLite. A family conflict cannot provide visit support, primary membership, or an `F:<family-id>` correction key. Existing accepted corrections must enter `pending_remap` if their saved family identity or reviewed tuple no longer resolves exactly.

**Never:** Infer family identity from filename, media type, timestamps, metadata proximity, coordinates, visual similarity, content bytes, hashes, a majority of copies, generated reconstruction ids, or owner-visible display data. Do not claim device support for a signal Expo Media Library does not expose. Do not publish, upload, log, or display raw platform identifiers, coordinates, member lists, or fingerprints.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No platform family signal | Candidate has no valid platform id | Persisted and reconstructed as independent `E:` evidence | No inferred family |
| Consistent platform family | All current members share one id and exact tuple | One verified `F:` support unit; correction saves reviewed members and tuple version | Extra later member may join only if its tuple matches |
| Conflicting family | Same id, differing tuple or invalid identity | Every member is unresolved duplicate conflict and provides no visit support | Existing family correction becomes pending remap |
| Rescan after a family correction | Saved members/id/tuple map exactly to one verified current family | Apply correction to successor projection | Missing member, changed tuple, key-type transition, or collapsed keys queues pending remap |
| Native API lacks family capability | Expo adapter metadata has no documented identity | Normalize to `null` | Contract stays dormant until a native provider supplies the documented signal |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/types.ts` -- `SourceCandidate` is the normalized private import boundary; add optional platform family/source/support fields without media or EXIF data.
- `apps/mobile/src/photo-access/native-adapter.ts` -- `candidateFromMetadata` is the only Expo metadata conversion; normalize a documented supplied family string conservatively, otherwise `null`.
- `apps/mobile/src/import-record/repository.ts` -- schema version 26, migrations, `commitPage`, and maintenance reconciliation persist canonical evidence. Add an additive migration and private tuple/family fields to both source and canonical rows.
- `apps/mobile/src/reconstruction/types.ts` and `engine.ts` -- engine already consumes `duplicateFamilyId`/`duplicateConflict`; reuse those inputs and do not change reconstruction-v1 grouping rules.
- `apps/mobile/src/reconstruction/repository.ts` -- turns canonical rows into reconstruction evidence and saves/applies typed correction keys. Build the verified-family resolver here, serialize family review snapshots, and use it for journey and memory correction remaps.
- `apps/mobile/src/components/__tests__/import-repository.test.ts`, `native-photo-adapter.test.ts`, `reconstruction-engine.test.ts`, `reconciliation-repository.test.ts`, and `journey-correction-application.test.ts` -- extend synthetic coverage; do not use real media, ids, or locations.
- `docs/project-state.md` and `docs/development/error-playbook.md` -- record implementation evidence, remaining device validation, and any actual agent-caused regression.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/import-record/{types,repository}.ts` -- add versioned local family and support-tuple persistence plus migration assertions; retain ordinary candidates as independent evidence.
- [x] `apps/mobile/src/photo-access/native-adapter.ts` -- expose only a platform-provided family id through the normalized adapter contract, with strict null fallback.
- [x] `apps/mobile/src/reconstruction/{repository,types}.ts` -- verify complete families from persisted data, emit conflict state, use `F:` keys only for verified families, and store/revalidate member and tuple snapshots during correction save/rebuild.
- [x] `apps/mobile/src/components/__tests__/*` -- prove absent, valid, conflicting, added, missing, and changed-copy cases; prove no identity inference and pending-remap retention.
- [x] `docs/project-state.md` -- record code evidence and the exact physical-device question: whether a platform integration can supply a documented stable family relationship.

**Acceptance Criteria:**
- Given the same evidence without a platform family id, when reconstructed and corrected, then each canonical item remains an `E:` support unit.
- Given a platform-provided family with equal tuples, when a correction is saved and the evidence rescans unchanged, then it remaps through exactly one `F:` unit.
- Given any differing tuple, missing reviewed member, changed family id, or `E:`/`F:` identity transition, when rebuilding, then no correction is applied to a successor and the previous effective projection is retained with pending remap.
- Given unsupported Expo metadata, when importing, then the adapter provides no synthetic family identity.
- Given family copies, when Atlas and detail are projected, then they do not add duplicate visit support or accepted primary memberships.

## Implementation Notes

- 2026-10-14: schema v27 persists private platform-family and normalized tuple fields; v28 persists reviewed family snapshots. The adapter supplies explicit `null` because Expo Media Library exposes no documented family relationship. The resolver verifies full member agreement before producing `F:` keys and makes changed, missing, or conflicting family state remap-required.
- 2026-10-14: focused verification passed 5 suites / 84 tests; full mobile Jest passed 28 suites / 223 tests; typecheck and lint passed.

## Spec Change Log

## Review Triage Log

## Design Notes

Family verification stays at the local repository boundary because it depends on the complete canonical evidence set. The native adapter can only carry an explicit signal; it cannot determine whether it is safe to use. A saved family correction stores its observed membership and tuple version so a later rescan can distinguish a compatible added copy from a changed reviewed identity.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand` -- expected: all mobile suites pass without real media data.
- `npm --prefix apps/mobile run typecheck` -- expected: no TypeScript errors.
- `npm --prefix apps/mobile run lint` -- expected: no lint errors.
- `npm run check` -- expected: foundation checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- On each supported device, verify whether the selected native provider exposes a documented stable duplicate-family signal. Record only aggregate capability and result; absence must retain independent-copy behavior.
