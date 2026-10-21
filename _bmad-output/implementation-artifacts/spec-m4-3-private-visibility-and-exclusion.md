---
title: 'Control private visibility and exclusion'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: 'cd889c98946b067cefd8af303a36b09d8fdeedd7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent">

## Intent

Deliver durable private visibility and reconstruction exclusion, distinct from
rejecting an inference or deleting source photos. The owner has already completed
the correction/manual-entry device walkthroughs; do not repeat that prerequisite.

## Boundaries & Constraints

Preserve provenance, corrections, stable manual identity, serialization, atomic
publication, stale-write checks and Atlas context. Apply policy at repository
reads, counts and eligibility, including alternate detail/media routes. Sharing
starts empty and requires fresh eligibility checks. Private updates never silently
rewrite published snapshots; exported copies cannot be erased locally.

No uploads, source-original deletion, hosted sharing/Replay implementation,
threshold changes, reset, staging, commit or push. Preserve dirty work.

**Owner-approved decisions (2026-10-21):** Whole journeys, including manual
entries, are the control unit. Hide removes the journey from ordinary Atlas,
Timeline, visible totals, Replay and new share selections while retaining
evidence/corrections; restore through Privacy Settings. Exclusion reversibly
omits the journey's reviewed supporting evidence, with explicitly reviewed
duplicate-family scope, from inference and inferred membership. Explain this as
"Don't use these photos as evidence of my travels", and show the affected scope
before confirmation. Manual records support Hide rather than evidence exclusion.
Keep the existing confirmed Delete local history action; no per-item deletion.
Hidden/excluded scope must not leak through ambiguous successors; retain a
review/restore path. Existing snapshots are not silently republished or erased.

## I/O & Edge-Case Matrix

| Scenario | Required result |
| --- | --- |
| Hide/restore | Durable reviewed visibility; evidence/corrections retained; private restore entry |
| Exclude/restore | Reviewed input scope applied before inference/membership, retained through rescan |
| Stale target or ambiguous split/merge | No implicit reassignment or privacy leak; review/restore remains reachable |
| Failed/lifecycle write | Fixed diagnostic, no partial save, prior committed history privacy-filtered |
| Delete-all | Existing confirmation clears new policies too; originals unchanged |
| Preview selection | Empty initially; hidden/excluded/stale items withheld |

</frozen-after-approval>

## Code Map

Paths below are relative to `apps/mobile/src/` unless stated otherwise.

- `history-record/types.ts`, `import-record/repository.ts`: evidence inclusion
  revisions exist; imports retain them. History overlays currently block queued
  reconciliation; use separate policy storage rather than that unsupported path.
- `reconstruction/repository.ts`: currently unfiltered detail, media, uncertain
  memory, durable projection and independently calculated statistics.
- `reveal/types.ts`, `reveal/projection.ts`: centralize typed eligibility for
  current browsing/counts and future preview/Replay selection.
- `photo-access/provider.tsx`: serialized policy commands, read-back, filtered
  refresh and invalidation of stale in-flight reads.
- `components/journey-edit.tsx`, `components/journey-detail.tsx`,
  `components/privacy-settings-screen.tsx`, `components/mobile-screens.tsx`,
  `navigation/app-contract.ts`, `app/journey/[id]/edit/[task].tsx`: controls,
  manual-safe entry, restore management and contextual return.

## Tasks & Acceptance

- [x] Types/import repository: validated revisioned reviewed-scope storage in
  next additive migration; lifecycle/idempotency/deletion coverage; verify actual
  policy-table layout even with retained current/newer schema markers.
- [x] Reconstruction/reveal files: apply policy across input, reads and visible
  statistics; remap through support/family lineage, never generated ID alone.
- [x] Provider: durable read-back, privacy-safe refresh and stale async guards.
- [x] Components/routes: explain consequences, accessible confirmation/restore,
  preserve Atlas camera/year/view using Living Atlas controls.
- [x] `apps/mobile/scripts/atlas-sqlite.test.cjs` and focused suites in
  `apps/mobile/src/components/__tests__/`: schema, rollback, remap, rescan,
  maintenance, alternate access and stale-preview privacy regressions.

Given a reviewed scope, when a policy command succeeds, then read-back and every
count/detail/media/eligibility path agree. Given restart/rescan/background or
graph replacement, when history refreshes, then policy persists without silently
broadening reviewed scope. Given hidden/excluded/stale selection, when eligibility
is requested, then content is withheld. Given delete-all or failed/stale writes,
when settled, then originals, prior committed data and policy lifecycle remain
consistent with the stated action.

## Implementation Notes

Owner approved John's recommended defaults and authorized continuation. Epic
context refreshed. This single record owns implementation and verification.
No live share-preview exists: implement local eligibility contracts; live sharing
acceptance belongs to M4.5. Read relevant error lessons before changes/checks;
record each unexpected command/test failure in the playbook during this task.
Use existing search-first/TDD/verification practices with project-local test
commands. No checkpoint commits or staging; record RED/GREEN evidence here.

## Verification

Review-fix follow-up (2026-10-21): policy fallback caches now retain only each
policy's own resolved scope; restore of another policy no longer remains hidden
by the later cache. Memory and Home-base commands recheck current privacy/run/
lifecycle inside their transaction before inserting. Reviewed scope indexes
evidence once and returns actual protected media/overlap counts. Persisted policy
rows are fully validated before consumption; malformed data/constraints fail
closed without rewrite. Privacy review/list failures emit fixed classified
diagnostics and stale/cancelled reads emit skipped lifecycle outcomes.

Exclusion temporarily suspends only activation of immutable memory corrections
whose selected source or reviewed support demonstrably intersects the exact
privacy-excluded scope. Revisions remain unchanged; restoring the policy and
rechecking reactivates their original semantics. Unrelated correction/structural
remap guards remain in force. Targeted SQLite privacy regression run: **21/21**,
including assign/move/reject/unassign, support-only dependency, overlap filtering
and restore, cached cross-journey memory rejection and incompatible schema/row
preservation. Parent owns final broad verification/review/device acceptance.

Final review-fix follow-up: exact privacy-excluded reviewed support also temporarily
suspends dependent split/merge/remove-visit/reject activation, retaining revisions
unchanged. A seeded persisted split rebuild succeeds before exclusion, reproduced
the exclusion remap failure, and now passes exclusion/restore parity. Latest privacy
SQLite run **22/22** passed; focused provider/repository/diagnostic Jest **88/88**
passed before the final shared predicate extraction. Native split acceptance is
not established: its pre-existing ordered/chronological detail-adapter mismatch
is deferred without a source change; the fixture does not claim multiple published
split successors. Other malformed/unrelated remap guards remain authoritative.

Focused UI/policy tests, real SQLite, full mobile Jest, typecheck/lint, root
`npm run check`, diff check and independent review. Owner Android hide/restore/
exclude/recheck acceptance; explicitly record unavailable iOS validation. Read
`evals/README.md` before changing input policy; fixtures are not accuracy evidence.

### Implementation evidence (2026-10-21)

- Repository-specific search reused the transaction serializer, reviewed support
  and duplicate-family resolver, durable reveal, Atlas context store, and Living
  Atlas controls. No dependency, network service or hosted feature was added.
- Additive schema v34 stores immutable, validated JSON reviewed scopes in
  `journey_privacy_revision`. Current/newer retained markers still validate the
  physical policy columns; incompatible layouts fail closed without dropping
  retained data. Delete-all clears policies inside its existing transaction.
- Hide covers supporting evidence plus associated memories and their reviewed
  duplicate families. Exclusion freezes exactly the reviewed supporting inputs
  and verified duplicate members; later family additions never broaden excluded
  input IDs. All overlapping/ambiguous successors remain withheld and the original
  policy remains reachable for restore. Manual identity supports Hide only.
- Detail, media, uncertain-memory and overlap reads, visible inferred statistics,
  native Atlas/Replay projection and fresh selection eligibility enforce policy.
  New selection starts empty; inferred sharing requires confirmation. Eligibility
  includes a privacy revision so a previously eligible selection becomes stale.
- Provider commands serialize, wait for active import/maintenance, invalidate
  in-flight projections/details/media/uncertain pages and read back durable state.
  Failed refresh keeps a privacy-filtered prior projection where it can be safely
  resolved; if filtering itself fails, withhold it until a successful read.
- Journey Edit and owner-entered detail expose the privacy task; separate Hide
  and reviewed-scope Exclude require confirmation. Privacy Settings retains
  confirmation/restore management even without a unique successor. Atlas return
  retains saved year/view/camera context. Originals, corrections and published
  snapshots are retained. Input exclusion is used on the next local recheck;
  ordinary reads and new eligibility withhold the scope immediately after save.

RED: `node --test --test-name-pattern="reviewed privacy" scripts/atlas-sqlite.test.cjs`
executed the initial missing-command assertion (0/1). GREEN progressed to eight
passing privacy integration cases, including rollback, lifecycle/read-back failure,
idempotency target binding, stale review, rescan/queued reconciliation, duplicate
growth, alternate reads, visible totals and synthetic ambiguous successor graphs.

Completed broad run: mobile Jest **40 suites / 392 tests**, real SQLite **70/70**,
mobile typecheck and lint passed. Subsequent hardening added one provider uncertain
page regression: focused UI/provider **2 suites / 26 tests** passed with typecheck
and lint. Latest focused SQLite privacy run **8/8** passed (one case added after
the broad 70-test run). These are synthetic contract checks, not reconstruction
accuracy or launch evidence; `product_quality: not_measured`.

Parent acceptance audit still owns the final root `npm run check`, final diff and
independent review, any focused reruns required by review, and owner Android
hide/restore/exclude/recheck acceptance. iOS device validation is unavailable and
has not been run. No model/provider processing, photo upload, original deletion,
install, data reset, staging, commit or push occurred.

## Review Triage Log

- Blind 1, medium/patch: fallback snapshot cached all policies' blocked journeys
  under each new policy; per-policy cache required so restoring A cannot leave
  A accidentally cached under B. Regression includes failed durable refresh.
- Blind 2, high/patch: cached memory correction inputs bypass newly protected
  evidence; validate current target and evidence privacy inside transaction.
- Blind 3, high/patch: cached Home-base selection bypasses changed visibility;
  validate lifecycle, run identity and policy inside writer before mutation.
- Blind 4, high/patch: column-only policy-table probe misses missing immutable
  revision/command constraints; validate actual retained DDL, fail closed without
  rewriting uncertain tables, and test same-column incompatible storage.
- Blind 5, high/patch: persisted policy discriminants trusted beyond array shape;
  validate complete rows at read/restore boundaries before interpreting scopes.
- Blind 6, medium/patch: Settings prematurely announces no policies during load
  or failure; distinct loading/failed/ready-empty states now tested RED/GREEN.
  Follow-up caught provider cancellation returning an empty success; overlapping
  command regression ran RED, then GREEN after fixed safe rejection. It retains
  the expected skipped lifecycle diagnostic and reaches the retry UI state.
- Blind 7, medium/patch: no retry for transient policy-list failure; explicit
  reload with successful recovery regression added.
- Blind 8, medium/patch: Hide copy omitted shared-media/duplicate overlap scope;
  disclose full reviewed media count and overlapping-journey protection before
  confirmation. Current-journey cancellation/confirmation regression added.
- Blind 9, medium/patch: repeated evidence rows.find causes quadratic review work
  under writer; replace lookup with one index while preserving scope ordering.
- Blind 10, medium/patch: review/list failures lack fixed privacy diagnostic;
  use the existing sole boundary, fixed lifecycle for stale/cancelled outcomes.
- Blind 11, medium/patch: Hide/cancel/restore/loading/scope-switch UI coverage
  incomplete; add behavioral regressions, device acceptance remains pending.
- Edge 1, high/patch: effective memory corrections depending on newly excluded
  evidence can block all rebuilds; privacy precedence must suspend only affected
  application while preserving revisions for reactivation after restore.
- Verification 1, high/patch: post-commit filter/refresh-failure fallback untested;
  assert related scope withheld, unrelated projection retained, filter failure
  clears the unsafe projection and visible totals are not stale.
- Verification 2, medium/patch: overlap discovery/creation with protected manual
  and inferred journeys untested; assert visible-only overlap review and restore.
- Two review workers initially hit account usage limits; resumed workers returned
  the edge and verification findings above. Their interrupted attempts are not
  counted as clean reviews. Every returned finding is retained in this log.

Final parent verification: mobile **40 suites / 402 tests**, real SQLite **85/85**,
typecheck, lint, foundation `npm run check` and whitespace checks pass. After the
last cancellation fix, provider/UI **35/35**, full mobile **402/402**, typecheck
and lint reruns also pass. Edge and verification follow-up reviews
confirmed their findings addressed; blind follow-up's final cancellation case is
corrected with the regression above. Android owner acceptance remains pending.
Blind reviewer inspected that final fix and confirmed no remaining blocker;
reviewers did not rerun tests. Parent executed the checks reported above.
The pre-existing native split-order adapter is recorded separately in deferred
work. No source originals, installed data or version-control state were reset.
Android: existing Metro PID 22504 serves the checked privacy component bundle
(HTTP 200 with reload and scope disclosure); ADB reverse restored and installed
Travel Life reopened. Owner walkthrough requested, not yet confirmed. iOS not run.

- [x] Owner Android Hide/Restore and Exclude/Recheck/Restore acceptance.

## Owner acceptance (2026-10-21)

The owner confirmed “Both flows completed correctly” after testing Hide/Restore
and Exclude/Recheck/Restore on the reopened Android app. This closes the pending
M4.3 Android walkthrough. Earlier pending-device statements above are historical.
iOS validation remains unrun; automated fixtures do not establish reconstruction
accuracy. The separate pre-existing split-order adapter remains deferred.
No staging, commit or push was performed, consistent with the approved scope.
