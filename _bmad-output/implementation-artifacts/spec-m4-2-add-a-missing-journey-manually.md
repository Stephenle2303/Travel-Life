---
title: 'Add a missing journey manually'
type: 'feature'
created: '2026-10-19'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '4bf25eee20180180670c0af4384674f138f0d02c'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md#story-m42-add-a-missing-journey-manually'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An owner with a sparse or incomplete reconstructed history cannot add a real missing trip, and the current Atlas CTA incorrectly opens Settings. A manual record must survive reconstruction without becoming false evidence or an automatic-recovery success.

**Approach:** Add one private, owner-entered journey flow with a minimal destination and exact/approximate date claim, explicit treatment of any overlap, and a stable redacted Atlas/Timeline/detail projection.

## Boundaries & Constraints

**Always:** Store manual journeys separately from generated reconstruction rows, evidence, visit support, and qualification metrics; label them owner-entered; preserve them across restart, rescan, maintenance, and reconstruction failure; keep the creation form local/offline; offer the approved fallback of an owner-entered label plus deliberately chosen coarse map point when the versioned offline place index has no result; offer Add a journey from a ready Atlas as well as sparse/failed recovery states; preserve Atlas Map/Timeline/year/camera context on cancel or successful return; validate and read back the durable manual record before reporting success.

**Overlap decision:** When a proposed manual journey overlaps an owner-visible inferred or manual trip, default to **Keep separate / edit existing trip**. The manual record remains a separate owner-entered assertion. Choosing Edit abandons the unsaved manual draft and opens the existing trip's Edit flow; it does not merge records or transfer inference, evidence, media, dates, or provenance.

**Manual-overlap edit decision (owner, 2026-10-19):** If more than one inferred trip overlaps, show each inferred trip and require the owner to choose one before opening Edit. Existing owner-entered trips remain read-only in this story: they can be kept as separate assertions, but they never enter the evidence-based Edit flow or Home-base picker.

**Never:** Infer presence, coordinates, media membership, routes, dates, or visit support from a manual entry; silently merge an overlap; upload a query or private record; use a transient reconstruction/display ID as manual identity; mutate an existing inferred journey without the selected explicit overlap action; count manual records as recovered journeys or engine/evaluation evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Create | Selected supported destination, or a validated owner label plus coarse point, and a valid exact day or ordered approximate range | One durable owner-entered journey appears in Atlas, Timeline, and detail after read-back | No media/evidence/support is created |
| Cancel | Any incomplete draft | Return to the preserved Atlas context | No row or projection change |
| Invalid date | Malformed day or reversed approximate range | Explain the field error and disable save | Preserve draft; no write |
| Overlap | Manual range intersects an owner-visible inferred/manual trip | Present the selected explicit resolution before persistence | No silent merge or partial save |
| Rebuild | Rescan, maintenance, or reconstruction replacement | Same stable manual record remains visible | Generated rebuild rows may change independently |
| Stale/restricted write | Disconnect, deletion, lifecycle change, or failed transaction | Keep the prior reveal and show a retry/reconnect outcome | Roll back the manual command atomically |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/import-record/repository.ts` -- schema version, atomic migrations, and local-history deletion; add an additive manual-record migration and remove manual rows when the owner deletes local history, never place manual data in rebuild-cleared reconstruction tables.
- `apps/mobile/src/reconstruction/repository.ts` -- durable private API, detail loading, qualified reveal loading, rebuild lifecycle; union a redacted manual projection at this boundary.
- `apps/mobile/src/reconstruction/types.ts` and `apps/mobile/src/reveal/types.ts` -- distinguish owner-entered manual journeys from inferred/possible-merge rows and keep statistics/recovery semantics explicit.
- `apps/mobile/src/photo-access/provider.tsx` -- typed create/read-back command and durable-reveal refresh; no raw IDs beyond this boundary.
- `apps/mobile/src/components/mobile-screens.tsx`, `apps/mobile/src/navigation/app-contract.ts`, `apps/mobile/src/app/` -- dedicated creation route and Atlas-context-preserving return; replace the current Settings redirect and exclude manual records from observed-area Home-base selection.
- `apps/mobile/src/components/atlas-reveal.tsx`, `journey-detail.tsx`, `journey-edit.tsx` -- entry affordance and owner-entered presentation using existing Living Atlas controls; do not reuse existing-ID correction saves as a manual store or expose generic Edit for a manual record.
- `apps/mobile/src/components/__tests__/import-repository.test.ts`, `reconciliation-repository.test.ts`, `photo-access-provider.test.tsx`, `atlas-reveal.test.tsx`, `journey-detail.test.tsx` -- migration, persistence/rebuild, projection/privacy, entry, and label regressions; add a focused manual-entry UI suite.

## Tasks & Acceptance

**Execution:**
- [x] Implement a schema-v33-style additive manual journey/overlap-resolution store with strict local validation, command idempotency, rollback, and migration coverage.
- [x] Add manual create/read APIs and union the redacted stable-ID manual projection into Atlas, Timeline, detail, counts, and later Replay selection without changing inference or recovery metrics.
- [x] Build the dedicated manual-entry route/form and overlap review selected above; reuse offline search, Atlas context, accessible controls, and truthful unavailable states.
- [x] Add focused repository/provider/UI regressions, then run the mobile and root checks and record device acceptance separately.

**Acceptance Criteria:**
- Given a valid owner-entered destination and date claim, when saved, then the same labelled owner-entered journey is durably visible after restart and reconstruction.
- Given manual and inferred journeys overlap, when the owner has not selected a resolution, then no manual record or inferred-trip mutation is committed.
- Given a manual create, rescan, or maintenance run, when diagnostics and recovery/evaluation data are read, then the manual record is absent from automated-recovery metrics and evidence/visit support.
- Given a failed/stale/restricted write, when the owner returns to Atlas, then the prior complete private projection and context remain usable.

## Implementation Notes

## Spec Change Log

- **2026-10-19 — review loop 1:** Independent review found deletion, Home-base, detail-copy, stale-overlap, and manual-edit seams that the first code derivation missed. The owner clarified that multiple inferred overlaps require an explicit target choice and owner-entered rows are read-only. Preserve: separate `manual_journey` storage; one-decimal coarse anchors; stable `manual:` display IDs; Map/Timeline context return; retry-stable command keys; separate owner-entered count; no inference/recovery-metric changes. Avoid: evidence-based Edit/Home-base flows for manual rows, arbitrary overlap target selection, and surviving manual data after local-history deletion.

## Review Triage Log

- **Blind hunter — local-history deletion leaves `manual_journey` rows behind:** **high / bad_spec.** `deleteLocalHistory` clears the private evidence and reconstruction stores but not the new owner-entered table, so deleting the local record can leave an owner label, date, and coarse anchor available after a new record is created. The deletion boundary was omitted from the code map and acceptance matrix.
- **Blind hunter — generic Edit is offered for an owner-entered detail:** **medium / intent_gap.** The detail always shows Edit, but the correction repository requires a reconstruction-backed display mapping that manual IDs do not have. The frozen overlap decision says Edit opens the existing trip flow, yet does not define whether an existing manual entry is editable, read-only, or hidden from that option.
- **Blind hunter — manual fallback is rendered as a confirmed place:** **medium / patch.** Manual detail supplies `ownerPlace`, and `JourneyDetailScreen` calls it Confirmed place despite the approved fallback being an owner label plus deliberately broad area. The owner-entered copy can render that same coarse label as an owner assertion instead.
- **Blind hunter / edge-case hunter — a late overlap is not revalidated inside the write transaction:** **medium / bad_spec.** A new manual row or completed reconstruction can appear after review and before `createManualJourney` commits, so the new overlap has no explicit owner resolution. The spec requires one before persistence but does not define a durable reviewed-overlap token or the stale-review outcome.
- **Blind hunter / edge-case hunter — multiple overlapping trips are edited arbitrarily:** **medium / intent_gap.** The form routes `overlaps[0]` without letting the owner choose which trip to edit. The frozen choice names the resolution but does not settle the target-selection behavior when more than one candidate overlaps.
- **Blind hunter — a changed search query leaves stale overlap review state:** **low / patch.** Query changes clear the selected place but do not reset the review result, so the screen may still display an earlier overlap result. Save remains protected by `draft()` validation, but the stale review is misleading; reset review state for any query change.
- **Blind hunter — inferred overlap dates do not include owner-edited dates:** **maybe-false / defer.** The overlap query uses inferred evidence days. The current completed projection does not expose a distinct owner date for an inferred trip, so it is not established that Atlas displays a corrected conflicting date. A future owner-date correction implementation should add an overlap regression.
- **Blind hunter — recorded verification counts disagree:** **low / patch.** The spec’s previous 18/311 counts and project-state count no longer match the current focused 65 and full 314 command output. Update the verification evidence to the executed results.
- **Blind hunter — migration test does not isolate v32-to-v33 manual-table upgrade:** **medium / patch.** Existing schema tests assert the final version but do not explicitly assert `manual_journey` creation on a v32 input. Add the focused migration assertion.
- **Blind hunter — malformed exact dates, deletion, stale-write race, and manual-detail edit lack coverage:** **medium / bad_spec.** The missing tests expose the uncontracted manual-edit/race behavior above; malformed date and deletion coverage follow the required boundary. Re-derive after the overlap/manual-edit decisions are clarified.
- **Verification-gap — owner-entered record is offered as evidence for Home base:** **medium / patch.** The Home-base picker filters only on a coarse anchor, but it describes and saves an observed area. Manual entries have no observed visit and cannot complete the save; filter owner-entered journeys and assert they are absent.
- **Verification-gap — manual overlap Edit has no usable end-to-end path:** **medium / intent_gap.** The overlap lookup can return `manual:*`, which is routed to the ordinary correction flow even though that flow cannot persist changes for manual IDs. This is the same unresolved manual-edit policy recorded above.
- **Final review — hard-coded fallback areas bypass the approved local-place path:** **high / bad_spec.** The first re-derivation supplied only three fixed anchors, allowing an unrelated broad marker to be attached to a typed supported destination. The approved contract requires the versioned offline index first and the coarse fallback only when it has no result. Re-derive the form path and tests without changing inference or privacy boundaries.
- **Final review — stale overlap error cannot be reviewed again:** **medium / patch.** The error tells the owner to review again but leaves the form in a non-null reviewed state, hiding its review action. Reset that state after rejection.
- **Final review — repository, Replay, Home-base, and Atlas-context regressions are incomplete:** **medium / patch.** The new UI mocks do not prove transaction behavior; owner-entered-only Replay and context restoration lack assertions; the Home-base fixture never reaches provider state. Add targeted executable coverage.
- **Final review — owner-entered detail retains empty evidence headings:** **low / patch.** Hide the empty observed-visit and memory panels for an explicit no-evidence assertion.

## Verification

**Commands:**
- `npm --prefix apps/mobile test -- --runInBand <focused-manual-suites>` -- expected: migration, persistence, privacy, overlap, and UI scenarios pass without warnings.
- `npm --prefix apps/mobile run check` -- expected: mobile tests, TypeScript, lint, and Expo Doctor complete; existing dependency drift is reported separately.
- `npm run check` -- expected: framework, foundation, and evaluation smoke checks pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Android and iOS: create, cancel, overlap, reopen, rescan, and Timeline/Map context return; verify owner-entered copy and no fabricated media/location evidence.

**Results (2026-10-19):** Focused M4.2 form, repository, Home-base, Atlas, and detail suites passed (44 tests) without warnings. The full mobile suite passed 37 suites / 313 tests; TypeScript and lint passed. Expo Doctor completed 20/21 checks, retaining the existing nine Expo SDK patch-version recommendations. Root `npm run check` and both whitespace gates passed. Android/iOS manual-flow acceptance remains unrun. The existing `journey-edit.test.tsx` renderer-environment `act(...)` warning remains outside this manual-entry flow.
