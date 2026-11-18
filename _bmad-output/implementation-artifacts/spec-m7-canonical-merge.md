---
title: M7.2-M7.3 canonical multi-source merge domain
status: in-review
route: dispatch
created: 2026-10-28
context:
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-private-multi-source-history/sync-contract.md'
  - '{project-root}/docs/development/diagnostic-implementation-policy.md'
  - '{project-root}/evals/README.md'
---

<frozen-after-approval>
## Intent

Combine source semantic snapshots into one canonical account projection using the
exact extracted native rules, preserving owner corrections, privacy and committed
Replay intent. This is the pure domain portion of M7, not HTTP/deployment or UI.
The owner approved M6-M7 implementation. No new reconstruction parameters or model calls.

## Boundaries and constraints

Work in new `apps/mobile/src/account/history-merge.ts`, its focused test files,
and only necessary changes to the existing new `reconstruction/canonical-core.ts`
and `canonical-projection.ts`. Do not modify native repository, history-contract,
history-service, root provider, SQL migrations or auth files; other work owns those.
Use shared HistoryRow DTO, projectCanonicalHistory and canonical-core functions.
No simplified alternate engine. Migration remaps complete typed identity occurrences:
evidence, family E:/F:/P: support, member snapshots, reviewed visits/boundaries,
revision/command/manual/home identifiers and Replay reference pairs. Never replace
arbitrary text or owner values. Stable account IDs come from a caller-provided
mapping function `(sourceId,kind,localId)=>accountId`, making persistent server
mapping authoritative; no source IDs enter diagnostics. Explicit source provenance
and old-to-new mappings remain available to persistence, not screen data.

Conservative dedup: only caller-provided verified exact-byte digest/family evidence
may consolidate cross-source support; preserve source copies and uncertain candidates.
Metadata equality is insufficient. Unknown origin stays unknown. New sources must
not overwrite first accepted Replay choices. Preserve exact selected media order,
group inclusion and soundtrack identity through remapping; local URIs/artifact files
are unavailable portable handles. If a committed group cannot map uniquely, return
an explicit review requirement without silently discarding it or activating a bad
composition. Legacy unsupported history overlays remain visible fail-closed review.

## I/O matrix

| Given | When | Then |
| --- | --- | --- |
| Two sources with colliding local IDs | Merge | Stable distinct account IDs and one canonical combined projection |
| Identical verified copies | Dedup | One independent support family, all source copies retained |
| Same timestamps/names but no byte proof | Merge | Keep independent evidence and uncertainty |
| Nested correction/family/structural/privacy scopes | Normalize | Every identity remapped structurally, owner prose unchanged |
| Inferred addition affects reviewed trip | Reconstruct | Existing final-remap Needs review/fail-closed policy preserved |
| Two source order permutations/retry | Merge | Same normalized result for same mapping/input versions |
| Missing referenced identity or unsupported scope | Merge | Typed fixed review/schema outcome, previous aggregate can be retained |

</frozen-after-approval>

## Code map

- `src/account/history-contract.ts`: explicit eight semantic row layouts and validator.
- `src/reconstruction/canonical-core.ts`: extracted unchanged graph/family/correction helpers.
- `src/reconstruction/canonical-projection.ts`: async common projection with optional
  memory-candidate checkpoint; native repository uses it already. No native imports.
- `src/history-record/privacy.ts`: policy scope validation and E/F/P semantics.
- `src/replay/types.ts`, native repository loadReplayManifestInput: committed preference
  uses JSON `[journeyId,evidenceId]` refs, excludedGroupJourneyIds, autoGroupJourneyIds.

## Tasks and acceptance

- [x] Implement explicit input/output types suitable for a server worker and replica.
- [x] Normalize all approved row kinds with total typed identity traversal and stable maps.
- [x] Reuse canonical projection, correction/home/privacy behavior and preserve Replay choices.
- [x] Cover every matrix row with meaningful synthetic tests; run existing structural,
  correction and engine suites if domain helpers change.
- [x] Record test evidence, engine/eval parity and any concrete unresolved integration needs here.

## Diagnostic map

Pure function has no logging/network/native boundary. Return fixed typed
HISTORY_SCHEMA/HISTORY_REVIEW failures with no raw payload/identity in messages.
Caller maps source normalization to HISTORY_SYNC/HISTORY_SCHEMA and reconstruction
to HISTORY_SYNC/HISTORY_REBUILD under one action correlation. No raw exception
serialization. Tests inject private prose and assert errors do not expose it.

## Implementation notes

`account/history-merge.ts` exports `collectAccountIdentityKeys` and
`mergeAccountHistory`. The same typed traversal enumerates server-allocated keys
and normalizes eight semantic kinds. Source order/row order are canonicalized;
allocator collisions, missing evidence/family references and incompatible nested
scopes return fixed `HistoryMergeError` codes without raw content. Unknown origin
remains explicitly unknown. Owner prose and timestamps are never string-replaced.

Merged output includes canonical rows, the exact shared canonical projection,
private source copies/mappings, privacy scopes, accepted Replay and pending Replay
proposals, plus fixed review reasons. Privacy replica numbers preserve original
revision order within each source policy; they are not original server mutation
revisions. Local run numbers normalize to zero rather than becoming portable IDs.

Only caller-supplied verified SHA-256 exact-byte identities consolidate cross-source
support. Every source copy remains retained; available-copy union feeds projection,
metadata contradictions abstain, and reviewed restrictions cover verified copies.
The canonical engine and its thresholds were not changed. Typed E/F/P support,
family-member, boundary and visit scopes are remapped structurally. Legacy history
overlays fail closed for owner review instead of being silently omitted.

Committed Replay references are mapped through source and merged canonical graphs;
group ambiguity returns a pending composition rather than dropping selected media.
The server supplies `preferredReplaySourceId` from the first accepted composition.
Other source compositions stay pending; local custom-audio URI/prepared artifact
handles are stripped while soundtrack identity and exact media order remain.

Caller obligations: allocate stable mappings before merge; validate verified-byte
proofs within the owner boundary; atomically retain the previous aggregate on
HISTORY_SCHEMA/HISTORY_REVIEW; apply returned privacy scopes to Atlas/media read
projections; do not activate an unresolved pending committed composition. Durable
CAS, HTTP/auth, media download and device UI remain integration work outside this
pure-domain record. No production events originate from this module.

## Verification

2026-10-28 package-local command:
`npx jest src/components/__tests__/account-history-merge.test.ts src/components/__tests__/structural-corrections.test.ts src/components/__tests__/journey-correction-application.test.ts src/components/__tests__/reconstruction-engine.test.ts --runInBand --cacheDirectory .jest-cache-codex`
passes four suites / 75 tests (13 new merge cases). Mobile `npm run typecheck` and
focused ESLint pass. Tests cover input permutations, key preallocation, allocator
collision, duplicate byte proof/contradiction/availability, exact nested remapping,
privacy ordering/duplicate restrictions, unsupported legacy overlays, correction
Needs review versus structural fail-closed, valid Replay order/soundtrack and
unmappable group retention, first accepted Replay and private-sentinel redaction.

TDD evidence: initial missing implementation fails module resolution as expected;
the initial typecheck found four local unknown-pair/definite-assignment issues,
then corrected narrowing and awaited projection returned a clean typecheck. This
check incident was reported to the parent for its central playbook entry. Root
foundation/HTTP/Postgres/device checks remain integration-owned. Synthetic tests
prove contracts and existing engine regressions; population accuracy, live sync,
device performance and actual provider acceptance remain unmeasured.
