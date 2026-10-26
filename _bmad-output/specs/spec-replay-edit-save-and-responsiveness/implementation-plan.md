# Implementation plan

Status: ready for implementation; no mobile work completed by creating this plan. Execute slices in order. S4/S5 are logically independent after S3 but should share one coordinator owner; this plan does not request concurrent agents or device work. One delivery record is this spec; update evidence here rather than creating competing product plans.

## Delivery sequence

| Slice | Priority | Depends on | Outcome | Capabilities | Acceptance cases |
| --- | --- | --- | --- | --- | --- |
| S0 | P0 | none | Baseline and attributed writer trace | CAP-10 | AC-30, measurements |
| S1 | P0 | S0 | Owned writer, additive receipt migration and reconciliation | CAP-2, CAP-6, CAP-9 | AC-07–AC-10, AC-21–AC-23 |
| S2 | P0 | S1 | Unified session and bounded coalescer | CAP-1, CAP-2, CAP-6 | AC-01–AC-06, AC-11–AC-12 |
| S3 | P0 | S2 | Atomic Update and safe recovery | CAP-3, CAP-6, CAP-8 | AC-04, AC-07–AC-14, AC-24–AC-26 |
| S4 | P1 | S3 | Incremental viewport thumbnails | CAP-4 | AC-15–AC-18, AC-28 |
| S5 | P1 | S3 | Audio readiness and settings subdraft | CAP-5, CAP-9 | AC-19–AC-23, AC-27 |
| S6 | P1 | S4, S5 | Lean UI and consistent Back | CAP-7, CAP-8 | AC-01–AC-03, AC-12–AC-14, AC-26, AC-29 |
| S7 | P0 release gate | S6 | Android/iOS evidence and safe rollout | CAP-1–CAP-10 | AC-01–AC-30 and performance matrix |

S0–S3 form the first coherent correctness increment. Do not ship only an enabled Update button or faster Done while the old write/recovery races remain. S7 is required to call the experience delivered; it does not change the implementation order.

## S0 — Baseline, ownership inventory and test harness

1. Discover current files, package scripts, schema version and dirty work read-only. Preserve existing changes; do not reset/stage/commit/push. If Git status remains unavailable, record that limitation and use an explicit touched-file manifest rather than assuming clean.
2. Inventory explicit transactions, autocommit writes, connection lifetimes, import/maintenance/reconstruction and privacy/lifecycle writers. Identify any await to external/native media while holding a writer.
3. Add development-only monotonic profiler with fixed stage/owner categories through the diagnostics policy boundary. Production output remains the closed event shape.
4. Build synthetic deferred writer/media/audio fixtures and a controllable clock. Collect baseline counts/latencies for the repeated owner flow, with real-device private measurements only under owner operation.
5. Isolate the existing five-second first-cache-open test timeout before changing its production behavior or declaring the harness reliable. A larger test budget may permit diagnosis but is not a performance fix.

Files: existing `src/diagnostics/app-diagnostics.ts`, `src/database/native-transaction.ts`, `src/photo-access/provider.tsx`, import/reconstruction/maintenance controllers; proposed `src/diagnostics/replay-phase-profile.ts`, test deferred fixtures. All mobile paths below are relative to `apps/mobile`.

Done evidence: writer inventory, synthetic contention reproducer, benchmark template with actual baseline or explicit unmeasured fields. If the owner's lock cannot be reproduced, retain that incident open and use synthetic ownership evidence to proceed with bounded architecture fixes; do not invent lock attribution.

## S1 — Owned transactions, native receipts and migration

1. Implement callback-owned transaction API sharing the current global gate, with connection ownership and priority/fairness. Keep compatibility wrapper until all related callers are migrated.
2. Migrate Replay/import/maintenance/privacy writer paths before removing broad provider waits. Bound SQL work; document long atomic publication exceptions and keep their latency risk open.
3. Add next-unused schema migration for `working_session_id`, `working_edit_version` and local mutation receipts through all current schema entry gates. Preserve legacy JSON, revision, custom audio and artifacts.
4. Implement idempotent stage/commit/restore receipts atomically; reject operation digest mismatch. Add typed definitely-not-started, known-failed, conflict, scope-invalid and outcome-unknown results.
5. Implement readback reconciliation and settled-only receipt cleanup. Test COMMIT failure vs rollback settlement, missing receipt while active and runtime reload recovery.
6. Replace ordinary per-stage full-manifest rebuild with small native scope/CAS checks and session token mapping. Rehydrate once on lost mapping; never silently change expected revision to a competing current branch.

Files: `src/database/native-transaction.ts`, `src/reconstruction/repository.ts`, `src/import-record/repository.ts`, `src/photo-access/provider.tsx`; proposed `src/replay/draft-repository-contract.ts` if shared types improve clarity. Tests: existing native-transaction/provider suites and `scripts/atlas-sqlite.test.cjs`.

Done evidence: AC-07–AC-10/AC-21–AC-23, migration from schema 36 and current latest schema, no nested transaction/forced release, diagnostic closure test. Every writer affected by removing whole-transition waits must be accounted for. Do not remove protection before this passes.

## S2 — Edit session and latest-snapshot scheduling

1. Add pure session reducer/controller with W/A/C/R identities, versioned composition, selector indexes and per-trip context. Mount above route lifetime under the private-record provider.
2. Move selection/include/auto/order/settings application into typed actions. Keep stable repository mapping below screen boundary; cache metadata and thumbnail availability stay out of composition identity.
3. Replace component promise-chain/debounce refs with one-in-flight/one-latest scheduler, 250 ms trailing debounce/1 s max age, version-aware waiters and typed outcomes.
4. Move selected/bulk task ownership into the session; instant toggles preserve unresolved intent, retries do not double-toggle it, and trip switch cannot affect another trip's automatic/manual flags.
5. Subscribe screen to selectors and retain scroll/filter/Undo context. Route unmount does not cancel unsaved state accidentally; lifecycle invalidation fences it explicitly.
6. Verify provider compatibility wrappers cannot become a second concurrent writer. Remove obsolete screen refs only after the new path owns all editing actions.

Files: proposed `src/replay/edit-session.ts`, `src/replay/edit-state.ts`, `src/replay/draft-save-scheduler.ts`, `src/replay/edit-selectors.ts`; existing `src/replay/types.ts`, provider and `src/components/replay-screen.tsx`. Keep modules small and collapse redundant wrappers; proposed filenames are not a requirement to create one abstraction per row.

Done evidence: AC-01–AC-06/AC-11, 100 edits while first write held, no leaked waiter, correct retained exclude/manual/order/music state and bounded queue memory. New controller tests must exercise behavior rather than mirror reducer implementation.

## S3 — Atomic Update, Back and recovery

1. Implement synchronous single-request Update acceptance, selected-intent barrier, immutable capture, exact stage acknowledgement/commit/readback and one renderer handoff.
2. Remove pending-autosave disabled gating only when request/coordinator safety is wired. Preserve explicit no-change/all-excluded/conflict/privacy gates.
3. Add waiting/recovery thresholds, Check again for unknown outcome and explicit Retry only for safe non-commit. Typed failures must not become generic renderer-unavailable copy.
4. Implement Restore fence before clearing timers/tasks; reconcile active writes, reset native working branch, readback then publish. Keep explicit same-scope CAS rebase separate from scope refresh.
5. Route all Back paths through one action. Navigation is independent of draft acknowledgement; service retains state. Do not keep stale screen closures/listeners.
6. Preserve C after render failure; Retry render reuses C without another commit. Bind final artifact publication and share availability to the verified current identity; retain eligible Previous Replay separately.

Files: session/coalescer, `src/components/replay-screen.tsx`, `src/photo-access/provider.tsx`, `src/replay/controller.ts`, `src/replay/renderer.ts`, `src/replay/draft-error.ts`. Extend existing screen/controller/provider tests; no new renderer stack.

Done evidence: AC-04/AC-07–AC-14/AC-24–AC-26. A held writer never produces a false saved state or unresponsive Back. Exact owner sequence is verified through repository and screen together using synthetic media.

## S4 — Visible-first media pipeline

1. Split metadata readiness from thumbnails at session entry; overview loads one cover per visible trip before offscreen assets, gallery loads visible tiles first.
2. Implement bounded global-six-lane scheduler, dedupe and incremental batches (six completions or 50 ms); preserve a 48-item metadata page and one viewport of prefetch.
3. Probe installed Android/iOS thumbnail/poster APIs. Implement bounded fallback generation if needed, with no per-tile video player. Record actual API choice before adding dependencies.
4. Add size/revision/scope-aware cache, decoded-byte budgets, LRU, bounded visible pins and permission/lifecycle invalidation. Cache eviction must never mutate selected IDs.
5. Handle partial results, timeout retry, rapid A→B navigation and cancellation with trip/request epochs. Selected view can load selected identities beyond the currently loaded All page.
6. Use indexed selectors to eliminate repeated whole-library scans and per-insert array copying in overview renders; measure render/frame effect before optimizing further.

Files: native adapter/provider, proposed `src/replay/thumbnail-service.ts`, media tile/poster components, edit selectors. Tests: native-photo-adapter, screen and new thumbnail service suite; device decode/scroll evidence in S7.

Done evidence: AC-15–AC-18/AC-28, first visible results before delayed final asset, bounded concurrency/memory and unchanged complete candidate/selection scope.

## S5 — Audio readiness and reversible settings

1. Add sheet subdraft for soundtrack/order; Done applies once, Back/system dismissal cancels only the current sheet generation.
2. Move local audio import/copy/validation to a service with bounded-size preflight, finite positive decode validation, generation guards and progress/status independent from SQL.
3. Show selected basename promptly, ready state after validation and no repeated instructional blocks. Missing retained file supports explicit choose/default recovery.
4. Track file reference ownership across sheet/session/draft/commit/render and cleanup after settlement. Validate same-name replacement content identity; do not delete applied working audio on overview Back.
5. Preserve selected soundtrack through commit/readback/mux and export; reuse compatible visual chapters for music-only changes. Keep current compatible cache copy until measurements justify change.

Files: proposed `src/replay/audio-import.ts`, settings view/session, provider/native repository audio translation and renderer soundtrack inputs. Tests: screen, provider, renderer/audio service and SQLite migration.

Done evidence: AC-19–AC-23/AC-27, local ready UI while SQL is held, actual audio acceptance deferred to owner-device S7. Exactly-5,000,000-byte input must be tested along with rejected sizes/formats.

## S6 — Lean surface integration

1. Compose overview, gallery and music sheet as small selector-driven views. Preserve approved Living Atlas hierarchy and one scroll owner.
2. Add independent include/open targets, selected-count navigation and brief save/update/recovery copy. Keep context and scoped Auto/Undo.
3. Verify Inspector selection independence and exact used-video interval; source inspection remains paused/muted. Preserve speaker/fullscreen row and no-rerender mute.
4. Reconcile current design-system/decision/interaction texts using BMAD spec derivation so future builders do not follow obsolete pending-save gating or pre-subdraft Back rules. Log the scoped overrides first; do not hand-edit predecessor SPEC kernels outside bmad-spec.
5. Capture phone layouts and accessible navigation at required widths/text scales; fix clipping/targets before usability review.

Done evidence: AC-01–AC-03/AC-12–AC-14/AC-26/AC-29, no extra technical wizard, clear one-action progression and owner-recognizable real media on device. Synthetic mock is a design aid only.

## S7 — Acceptance and rollout

1. Run package-correct software checks and production diagnostic shape validation. Close source-level races before device claims.
2. Run the full owner flow with real local albums/audio on Android and iOS under current approved build process. Separate development transport/build failures from Replay defects; preserve data and unrelated processes.
3. Record baseline/candidate p50/p95, sample sizes, warm/cold conditions, queue/SQL/media/audio/render stages and correctness comparison against the same composition.
4. Reopen/restart, background/resume, privacy revocation and selected-share regression on final artifact; listen to audio and inspect encoded Vietnamese text.
5. Update incident and delivery evidence. If owner/device unavailable, mark native acceptance pending and stop any claim of completed smooth experience. Continue independent source/doc work; do not substitute synthetic media for acceptance.

Rollout unit: complete session/save/recovery path, followed by complete media/audio/UI path; one active implementation per session. Additive database migration remains compatible with previous fields. Roll back UI dispatch only after active mutation/render settlement; never revert schema destructively or let an old build overwrite a newer active session. If legacy code does not honor new ownership metadata, rollback is blocked until no active session is owned and durable compatibility has been validated.

## Verification commands and working directories

From `apps/mobile`, run focused suites separately where the existing shared-act harness requires it:

```powershell
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/native-transaction.test.ts
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/replay-screen.test.tsx
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/photo-access-provider.test.tsx
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/native-photo-adapter.test.ts
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/replay-controller.test.ts
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/replay-renderer.test.ts
npm test -- --runInBand --cacheDirectory .jest-cache-codex src/components/__tests__/replay-selection.test.ts
npm run test:sqlite
npm run typecheck
npm run lint
```

Run newly created session/scheduler/thumbnail/audio suites by their discovered paths too. After shared writer/schema changes, broaden to import/maintenance/privacy/reconstruction affected suites and full mobile tests. Run Expo Doctor for native dependency changes/final platform validation; diagnose existing environment failures instead of calling missing checks pass. Run root `npm run check` separately from repository root. Whitespace/diff and touched-file review complete verification; report Git availability honestly.

These commands are implementation acceptance instructions. No mobile change or future test result is implied by including them in this plan. Formal dispatcher `stories.yaml` is deliberately absent: no per-story human checkpoints or dispatch settings have been invented.
