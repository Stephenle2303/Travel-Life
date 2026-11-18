---
title: Preserve legacy M6 owner edits in M7
type: feature
created: 2026-10-29
status: done
route: dispatch
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
review_loop_iteration: 0
context:
  - ../specs/spec-private-multi-source-history/SPEC.md
  - ../specs/spec-private-multi-source-history/sync-contract.md
  - ../../../docs/development/diagnostic-implementation-policy.md
---

<frozen-after-approval reason="Owner approved the proposed legacy migration implementation in this chat">

## Intent

Dirty M6 account replicas currently stop at HISTORY_REVIEW because their source-local
IDs cannot enter the canonical owner journal safely. Add a verified legacy proposal
adapter so provable edits migrate through the existing canonical correction CAS and
conflict flow. Keep the edited replica until its exact accepted version is pulled.

## Boundaries & Constraints

Always retain baseline authority, owner/account/source generation, original owner
revision, immutable operation and edited-row digest. Verify authority on the server;
unknown kind is never guessed from UUID shape. Reuse typed source normalization and
Replay remapping, then persist canonical deltas in the existing journal so later
source uploads cannot undo them. Preserve privacy action order, lineage, independent
owner facts, committed Replay selection/order/soundtrack and source-removal guards.
Concurrent canonical edits remain explicit retained conflicts; never substitute the
latest owner revision for the original expected revision. Ambiguity stays reviewable.

Never clear the local record, replace unsent edits, upload evidence/media implicitly,
change reconstruction policy, enable gates, deploy SQL/functions, or commit/push.
Use synthetic fixtures only. Existing recovered WIP is authorized input; preserve it.

## I/O & Edge-Case Matrix

| Scenario | Input / state | Required behavior | Recovery |
| --- | --- | --- | --- |
| Initial migration | Verified M6 baseline plus edits | Canonical IDs preserve exact owner changes | Pull only after accepted revision |
| Unknown kind | Persisted authority proves initial or aggregate | Classify without re-normalizing canonical IDs | Missing authority retains branch/review |
| Replay/privacy | Selected manifest, Hide/Exclude and lineage | Exact choices and reviewed scope survive translation | Ambiguous groups/support remain reviewable |
| Concurrent edit | Original owner revision is stale | Retain accepted/proposed canonical branches | Existing fresh-CAS owner resolution |
| Unknown ACK | Retry after stage/translation/proposal failure | Same mutation/payload and checkpoint | Reconcile receipt, no duplicate mutation |
| Lifecycle | Owner switch, removed source, deletion or later edit | Fence stale work and preserve unsent branch | Refresh/review, no resurrection |
| Future inputs | Source upload or removal after migration | Accepted edits remain journal authority | Existing retained-fact review rules |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/account/correction-sync.ts`, `correction-journal.ts`: checkpoint/diff/CAS; false canonical marker currently refuses dirty legacy.
- `history-merge.ts`: typed ID normalization and exact Replay group remapping; reuse rather than mapping strings heuristically.
- `history-store.ts`, `history-service.ts`: semantic baseline/kind, immutable jobs, replacement digest, resolved marker and selected-context rebind.
- `supabase/functions/_shared/history-runtime.ts`: authenticated worker, stable mappings, bounded source reads and exact activation fences.
- `m7-correction-journal-draft.sql`: owner journal/proposals, original expected revision and explicit conflict resolution.
- `scripts/test-private-history-postgres.ps1`: FullSuite ordered drafts; add local adapter fixture here.

## Tasks & Acceptance

- [x] Add bounded legacy authority/proposal/receipt SQL in a new local draft; retain owner isolation and deletion/source fences.
- [x] Extract reusable normalization/Replay translation and connect worker to canonical journal CAS without a second inference engine.
- [x] Connect native durable migration/retry/pull to the existing sync action; keep exact local branch until verified canonical pull.
- [x] Add meaningful failing regressions for matrix rows, then fix and run focused tests, actual SQLite and PostgreSQL.
- [x] Regenerate portable bundle, run root check, full affected mobile checks, backend typing and delivery review; update project state/playbook.

Given a provable legacy baseline, when its owner syncs edited facts, then supported
corrections, privacy and exact Replay survive canonical migration and later rebuild.
Given a newer canonical edit, when migration arrives, then the older expected owner
revision produces reviewable conflict rather than silent rebase. Given missing
authority or ambiguous mapping, then no unsafe activation or edited-replica loss occurs.

## Diagnostic map before implementation

| Boundary / source | Operation/stage | Fixed categories and outcome |
| --- | --- | --- |
| native baseline/job | HISTORY_TRANSFER/HISTORY_READ or HISTORY_STAGE | schema/storage failure; durable job retained |
| owner authority lookup | HISTORY_SYNC/HISTORY_AUTHORITY | ACCOUNT_SESSION/FENCED/REVIEW; blocked/skipped, no guessing |
| typed identity mapping | HISTORY_SYNC/HISTORY_SCHEMA | HISTORY_SCHEMA/REVIEW; unchanged, inspect admitted authority |
| Replay and reviewed support | HISTORY_SYNC/HISTORY_REBUILD | HISTORY_REVIEW; retain branch and previous authority |
| proposal CAS/receipt | HISTORY_SYNC/HISTORY_CORRECTION or HISTORY_ACK | CONFLICT retained, NETWORK unknown; same operation |
| pull/local activation | existing HISTORY_PULL/READ/POINTER | dirty/stale/storage guards; previous replica retained |

Carry one local action correlation across native, Auth and worker; IDs and payloads
never enter logs. Collection: current com.anonymous.travellife process/build plus
matching worker version; filter closed HISTORY_TRANSFER/HISTORY_SYNC events by
correlation, keep raw/private data only in ignored storage. Force failure/redaction
tests before physical validation. Actual two-device and service acceptance stay open.

## Implementation Notes

The adapter is bounded to the existing 100-owner-row delta, 460 KB request and
64 MiB/10,000-page combined baseline/canonical reads. No evidence bytes or baseline
rows are uploaded. Native freezes semantic baseline/current SHA-256 digests with
the original owner revision, mutation, build operation and edited rows. SQL proves
initial versus aggregate authority; UUID shape is never a semantic discriminator.
Initial normalization reuses the shared typed mapper and actual Replay traversal;
Replay resolves against the final canonical account graph. Privacy append identities
start above 1,000,000,000 (normalized source rows are bounded to 1,000,000 per build)
and preserve the original action order above any existing canonical privacy revision.
The canonical owner journal remains authoritative after subsequent source growth.

`m7-legacy-owner-migration-draft.sql` is local-only and ordered after the existing
drafts. Its private proposal persists authority, source plan, immutable request,
translation and result. The verified worker delegates to the existing journal CAS
under its verified subject/session and restores prior claims. Accepted legacy jobs
retain their original baseline and exact branch until a different canonical replica
with at least their acknowledged owner revision activates transactionally. Later
local edits fail the existing replacement digest guard and remain unsent.

### Diagnostic source lookup and collection evidence

The diagnostic gate above was the pre-change map. Exact implementation lookup:

| Operation/stage | Reason/outcome | Source boundary and safe next action |
| --- | --- | --- |
| HISTORY_TRANSFER/HISTORY_READ | HISTORY_STORAGE/failed; HISTORY_SCHEMA/failed | correction-sync.ts baseline/row reads and history-store.ts validated baseline/job; inspect the current schema version with synthetic fixture |
| HISTORY_TRANSFER/HISTORY_STAGE | HISTORY_STORAGE/failed; HISTORY_FENCED/skipped | correction-sync.ts save/accept and history-store.ts owned transaction; retain job and retry same action |
| HISTORY_TRANSFER/HISTORY_REBUILD | typed failure or HISTORY_NETWORK/unknown | history-service.ts migration build request; check matching worker correlation and immutable build receipt |
| HISTORY_SYNC/HISTORY_AUTHORITY | ACCOUNT_SESSION/blocked, HISTORY_FENCED/blocked, HISTORY_REVIEW/blocked | legacy-history-runtime.ts legacy-plan and SQL worker_action authority lookup; inspect persisted baseline kind/generation with synthetic authority fixture |
| HISTORY_SYNC/HISTORY_READ | HISTORY_NETWORK/unknown, HISTORY_INCOMPLETE/blocked, HISTORY_QUOTA/blocked | legacy-history-runtime.ts bounded legacy-page reads; reconcile same mutation, no inferred rollback |
| HISTORY_SYNC/HISTORY_SCHEMA | HISTORY_REVIEW/blocked baseline digest; HISTORY_SCHEMA/blocked edited digest or typed mappings | legacy-history-runtime.ts digest and legacy-map; verify the immutable admitted baseline/schema without exporting content |
| HISTORY_SYNC/HISTORY_REBUILD | HISTORY_REVIEW/blocked, HISTORY_SCHEMA/blocked | history-merge.ts translateLegacyOwnerChanges shared scope/Replay traversal; preserve local branch for owner review |
| HISTORY_SYNC/HISTORY_STAGE | HISTORY_NETWORK/unknown, HISTORY_CONFLICT/blocked | SQL legacy-translate immutable checkpoint; retry/reconcile same mutation |
| HISTORY_SYNC/HISTORY_CORRECTION | HISTORY_NETWORK/unknown, HISTORY_CONFLICT/blocked, HISTORY_FENCED/blocked | SQL legacy-commit and existing correction-propose CAS; inspect the retained canonical conflict through owner UI |
| HISTORY_SYNC/current boundary | HISTORY_CANCELLED/skipped | history-runtime.ts rpc signal fence; retain durable operation for resumed action |

Collection uses the current `com.anonymous.travellife` PID/build and its matching
Metro revision; filter `[Travel Life diagnostic]` for HISTORY_TRANSFER and the
locally generated action correlation. On the matching deployed worker version,
filter `[Travel Life share diagnostic]` closed HISTORY_SYNC events by that same
validated correlation. Worker stages above locate the source guard, not private row
IDs. Keep raw logs in ignored private storage; export only the six allowlisted event
fields. Missing PID/build/service logs are collection gaps, never product causes.
No worker was deployed and no device incident was reproduced for this change.

Implementation verification so far: focused native/domain Jest 29/29, real account
SQLite 10/10, worker runtime 31/31 including forced authority/page/map/translation/
commit transport failures, unknown ACK checkpoint retry, cancellation, unknown kind,
baseline mismatch, canonical bypass, shared correlation and synthetic secret/content
redaction. Parent's actual PostgreSQL FullSuite passed all 12 rollback fixture files.
Final independent review and broader checks are recorded below by the parent.

Investigation found no product decision required for provable mappings. Research
reuse: existing domain mapper, canonical journal, conflict UI and immutable receipt
protocol are the substrate; no new package/SDK or provider is needed.

## Verification

Final post-review checks: root check 116 tests and eval smoke; mobile 95 suites,
807 tests; SQLite 103 cases; PostgreSQL FullSuite 12 synthetic rollback fixtures;
mobile typecheck and lint; shared backend TypeScript; git diff --check. Three
independent review lenses completed and their corrections are recorded below.
These host results do not establish hosted or physical-device acceptance.

Use focused Jest with the existing cache and 15-second test budget; account SQLite;
FullSuite local PostgreSQL; root `npm run check`; mobile typecheck/lint; shared backend
TypeScript; regenerated bundle freshness. Engine equivalence/provenance cases follow
evals/README.md; accuracy remains unmeasured. Record every incident in the playbook.

## Spec Change Log

## Review Triage Log

| ID | Verdict / route | Evidence and required correction |
| --- | --- | --- |
| B1 | high / patch | Accepted legacy job has acceptedRevision without resolved; replacementGuard rejects it before digest checks. Admit guarded automatic pull, retain explicit restore and later-edit protection; add composed service regression. |
| B2 | high / patch | Concurrent translations choose the same numeric privacy row key; proposed conflict resolution combines by key and can overwrite an unrelated policy. On fresh-CAS privacy conflict resolution append above current canonical/journal maximum, preserving order; prove two policies survive. |
| B3 | medium / patch | New cross-runtime semantic digest uses localeCompare for arbitrary row IDs. Use code-unit ordering and test locale independence. |
| B4 | medium / patch | Math.max spreads admitted canonical privacy rows and can exceed engine argument limits. Use iterative maximum. |
| B5 | medium / patch | Unfinished migration is fenced by any aggregate replacement even with unchanged source plan; retry retains same operation forever. Allow unchanged-source-plan receipt/translation reconciliation against current readable aggregate while preserving original owner revision and immutable request/translation; source changes/removal remain fenced. |
| B6 | medium / patch | applyOwnerChanges errors expose reason, worker reads code only; known malformed changes become UNKNOWN. Adapt closed typed domain reasons and test classification/redaction. |
| B7 | medium / patch | Invalid legacy RPC receipts can log COMPLETE before native rejects them. Validate accepted/conflict status and safe revision before success diagnostic. |
| B8 | medium / patch | Runtime console/import safeguard selects history-* filenames and omits the new legacy helper. Include it. |
| B9 | medium / patch | Test identity allocator restarts per batch and cannot prove >100 mappings. Persist fake mapping allocation and exercise a multi-batch migration. |
| B10 | high / patch | No-Replay-delta path accepts a manual deletion that leaves canonical Replay group dangling. Validate resulting Replay against final canonical graph before staging; retain branch on ambiguity. |
| E1 | high / patch | Same demonstrated acceptedRevision guard failure as B1; one correction and composed regression covers both. |
| E2 | medium / patch | New legacy_proposal retains bounded individual payloads but admits unlimited distinct operations. Apply per-owner admission quota under existing account lock, preserving existing receipt reconciliation; test quota and retry. |
| V1 | medium / patch | Verified regression gap: privacy accepted-context enrichment has no SQL behavioral assertion. Add stale proposal test with journal-only latest accepted policy and inspect conflict payload. |
| V2 | medium / patch | Verified regression gap: real mobile .legacy transport method has no serialization/receipt tests. Exercise accepted/conflict and malformed revision replies. |
| V3 | high / patch | Same acceptedRevision guard failure as B1; existing composed test always returns null job. Retain actual accepted checkpoint through service restore in regression. |

All layers completed before triage. These are direct corrections to demonstrated
states in the implementation; no public API or owner intent changes are needed.
Review diff uses the captured before-task dirty source snapshot rather than
attributing all existing M6/M7 WIP to this change. Generated bundle is verified by
the source digest; standalone SQLite harness was included in full.

### Review patch evidence

B1/E1/V3: automatic canonical pull admits retained acceptedRevision jobs while
explicit restore, later unsent edits, selection intent and final pointer checks
remain guarded. The composed service regression keeps the actual checkpoint
through fetch and clears it only at pointer activation.

B2: canonical proposed resolution remains a fresh owner CAS and re-appends privacy
actions above the current journal/aggregate maximum, preserving action order and
unrelated policies. The SQL fixture proves two colliding policies, later worker
ownerChanges, and ordered Hide/Restore/Hide. B3/B4 use code-unit stable serialization
and iterative privacy maximum; tests include an admitted 140,000-row history.

B5: an unchanged exact source plan keeps immutable baseline/translation reads
usable across aggregate replacement; commit selects the current readable aggregate
with the original expected owner revision. Source/deletion fences remain intact.
B6/B7 adapt only closed typed reasons and validate accepted/conflict status and
safe revision before completion on cached plan, cached translation and fresh commit.
B8/B9 extend console/import enforcement and persist typed test mappings across
multiple batches. B10 checks canonical Replay after no-Replay deltas and proves
group remapping after a verified duplicate changes its canonical representative.
E2 admits at most 20 new owner proposals under the account lock (same count as the
existing aggregate admission limit), preserving old receipt reconciliation first.
V1/V2 add journal-only accepted privacy context and real mobile legacy-envelope/
correlation/receipt tests.

Only affected tests were run for this patch: four mobile suites / 42 tests and
worker runtime / 48 tests pass. A subsequent composed guard test rerun passes 2/2
after adding explicit later-edit retention. Portable bundle regenerated with
approved host access. Parent owns final SQL and integrated verification; no device,
hosted deployment, gate enablement or product-accuracy claim follows these checks.
