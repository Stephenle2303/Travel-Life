# Architecture, ownership and persistence

Decision basis: D-04–D-26, D-28; implement within existing mobile/provider/native boundaries. The API names below are proposed internal interfaces, not claims that these functions already exist.

## Responsibility map

| Layer | Owns | Must not own |
| --- | --- | --- |
| ReplayScreen and small view components | Render selector state, semantic actions, accessible navigation | SQLite scheduling, ad hoc flush/retry chains, source references |
| ReplayEditSession service | W/A/C/R, intent versions, subdrafts, selected-task barrier, coalescer, restore fences, route lifetime | Native IDs, raw source URIs, SQL |
| PhotoAccessProvider adapter | Current scope/access boundary, session repository ports, audio/thumbnail handles, renderer orchestration | Silent expected-revision replacement or repeated full-manifest stage hydration |
| Reconstruction repository | Native stable refs, validated token map, CAS and mutation receipts, metadata/commit readback | React state, preview URI persistence |
| Owned transaction coordinator | Safe connection use, queue ownership, fairness, pre-start withdrawal, settlement | Forced active transaction release at UI timeout |
| Thumbnail service | Bounded prioritized/deduplicated local previews and posters, cache invalidation | Composition membership, original render-source ownership |
| Existing ReplayController/renderer | Verified chapters/artifacts, exact version render/reuse/mux | Reinterpreting latest mutable UI refs mid-render |

## Session identity and state

Use opaque local `sessionId`, monotonic `editVersion`, `sessionEpoch`, `acknowledgedVersion`, `baseCompositionRevision`, `workingRevision` and optional `updateRequest`. These are local state, never diagnostic IDs. Persisted session/operation IDs are random coordination identifiers, not access capabilities, credentials or authorization tokens. A freshly created random diagnostic correlation ID is separate.

Composition includes included trips, retained choices per trip (even excluded trips), automatic/manual group flags, media order, timeline direction and validated soundtrack content revision. Store deterministic canonical order when comparing; selection set equality must not erase intentional within-trip ordering. Excluding a trip retains its choice/automatic state for Include; only included automatic groups participate in rendering. Persist retained automatic preferences separately from the existing render-facing automatic group list: derive `autoGroupKeys` as included trips intersect retained automatic preferences. This preserves the native invariant that render automatic groups are included, without losing excluded-trip editing mode.

Repository translates screen tokens into stable native refs using an epoch-scoped mapping; existing positional `replay-memory-groupIndex-itemIndex` tokens must not become durable keys. Scope epoch includes current generation/privacy and composition mapping revision. Runtime reload rehydrates mapping once. If membership/order changed under an apparently equal epoch, refresh the mapping rather than applying stale positions.

All actions pass through one reducer. Selectors cache Set membership, per-group ordered keys/counts/cover and changed flags so row rendering does not repeatedly scan or copy the whole album. Pure thumbnail/scroll state cannot increment composition versions.

Suggested ports:

```ts
interface ReplayEditSession {
  dispatch(action: EditAction): void;
  subscribe(listener: () => void): () => void;
  requestUpdate(): Promise<UpdateOutcome>;
  reconcile(): Promise<ReconciliationOutcome>;
  retryLatest(): Promise<SaveOutcome>;
  restoreCommitted(): Promise<SaveOutcome>;
}
interface ReplayDraftPort {
  openSession(): Promise<SessionMetadata>;
  stage(request: VersionedMutation): Promise<MutationReceipt>;
  commit(request: VersionedMutation): Promise<VerifiedComposition>;
  restore(request: VersionedMutation): Promise<VerifiedComposition>;
  reconcile(operationId: string): Promise<ReconciliationOutcome>;
}
```

`VersionedMutation` carries complete native-resolvable composition intent, session/edit version, operation ID, expected working and composition revisions, and scope epoch. No URI/loggable private value is put into diagnostics. Keep wrappers around existing public provider methods during migration; switch one caller path at a time, never two independent writers for the same session.

## Coalescer and waiter rules

1. An edit increments W.version, publishes UI immediately and replaces pending snapshot. Trailing debounce is 250 ms, maximum unscheduled age 1 s. Explicit Update/needed flush starts the current pending snapshot immediately.
2. At most one native stage is active. While it runs, replace only the not-started pending snapshot. Do not append another expensive full-manifest job per edit.
3. Successful stage acknowledges its version/receipt. Start the newest pending snapshot using the acknowledged working revision, not a revision copied from another session.
4. A waiter for version V resolves when A.version ≥ V within the same epoch and its action was preserved by legitimate sequential edits; superseded intermediate values need not each hit disk. Barrier operations cannot be coalesced away.
5. Definite stage failure retains newest W and marks failed. All public save/update waiters settle with a typed outcome; after the 8-second recovery threshold an unresolved native operation yields `outcome-unknown` to callers while its separately owned internal handle remains active. No hanging scheduled promise on unmount/reset and no false native settlement. Retry explicitly stages newest W with a new mutation ID only after non-commit is established.
6. Commit/Restore are ordering barriers, never replaceable stage snapshots. A snapshot for Update is pinned until commit success or safe recovery; newer edits cannot enter that commit.
7. Late completion can acknowledge historical V but cannot set a newer pending state to saved. Session epoch prevents discarded/restored/previous-scope results from publishing.

Use bounded completion records for joined callers rather than keeping every historical Promise/large composition indefinitely. Tests must hold V1, send 100 edits and prove only latest V101 remains pending.

## Transaction ownership and scheduling

Current `native-transaction.ts` intercepts BEGIN/COMMIT with a module-level FIFO and per-proxy release callback. Evolve toward a closure-owned API, for example `runOwnedTransaction(db, {kind, signal}, fn)`, sharing the existing gate during migration. Acquisition covers BEGIN through COMMIT/ROLLBACK settlement, not the entire media/import/reconstruction job.

Priority classes: lifecycle/privacy, foreground owner mutation, background. At most three ordinary foreground transactions may overtake a waiting background transaction. Privacy/lifecycle fences may preempt queued lower-priority work, never a running transaction. Preserve single-writer serialization across repository instances using `useNewConnection: true`. Inventory explicit BEGIN and autocommit writer paths; reads/writes on one connection cannot accidentally join another owner's active transaction.

Put only bounded SQL/CAS work inside transaction closures. No await of Media Library, DocumentPicker, file copy, renderer, network, whole import transition or thumbnail task while holding a writer. Existing long import/reconstruction transactions require explicit safe chunk/publication boundaries; do not split atomic projection publication casually. If a long atomic writer cannot yet be shortened safely, retain truthful waiting/recovery and keep S1 latency acceptance open.

Before eliminating provider `whenImportIdle/whenIdle`, prove all affected writers use ownership and test reconstruction/import/privacy interleavings. After acquiring the writer turn, check lifecycle, published generation, privacy and expected revisions inside the transaction. A preflight read alone is not sufficient.

On exception, await rollback when transaction began; release only after native COMMIT/ROLLBACK settles. A rejected COMMIT is not automatically proof no write happened: reconcile. If BEGIN never ran, withdraw queue safely. If native call never settles, quarantine its connection and fence subsequent mutations; do not manually release global ownership to make tests green. New-runtime recovery must verify transaction settlement/connection health before writes; SQLite busy-timeout is not ownership proof.

## Additive durable receipts and migration

Current inspected schema is version 36 with `replay_draft` composition/working JSON and revisions. At implementation time allocate the next unused schema version; do not hardcode 37 if concurrent schema work advanced it.

Add Replay ownership metadata and a local mutation receipt table through the existing `ensureNativeImportSchema` and import schema gate, before any query referencing the new schema. Suggested shape:

| Storage | Fields / meaning |
| --- | --- |
| replay_draft additions | `working_session_id` nullable, `working_edit_version` default 0; preserve existing composition/working revisions; additive JSON field for retained automatic preferences including excluded trips |
| replay_mutation_receipt | opaque `operation_id` primary key, `session_id`, `edit_version`, kind stage/commit/restore, deterministic private payload digest, scope epoch/revisions, resulting composition/working revision and timestamp |

Operation result receipt is inserted in the same transaction as the mutation. A same-ID same-digest retry returns the receipt without repeating mutation; same-ID different-digest request fails closed. Digest is not an anonymization technique and cannot be emitted to diagnostics. No preview/source URI or sharing approval is added.

Retain up to 32 settled unreferenced receipts per private record as a starting bound; preserve entries referenced by active reconciliation, draft or render. Prune only after settlement and never before the owner of an uncertain operation can reconcile. The active-plus-pending bound limits unresolved receipt growth. Lifecycle reset/disconnect cleanup follows existing private-record semantics.

Legacy unowned drafts remain recoverable. Adopt a valid visible legacy branch once through a validated CAS assignment, not by resetting it. Preserve legacy custom app-private audio handles during migration; opaque audio file-key normalization is allowed only with readback/file validation and unchanged content revision. Do not recompute a valid artifact identity solely because a receipt/schema column was added.

### Outcome reconciliation

| Evidence | Action |
| --- | --- |
| Receipt exists with matching operation/digest/scope | Acknowledge result; for commit re-read current composition before render |
| Receipt missing, operation definitely not started | Safe withdraw or explicit Retry latest |
| Receipt missing, native operation running/unknown | Remain unknown; no new conflicting write |
| Native settled with verified rollback/non-commit | Mark definitely failed; explicit Retry may create a new operation |
| Receipt exists but another session/version superseded committed data | Conflict/review; never render stale snapshot as current |
| Privacy/generation/lifecycle changed | Invalidate output and review safely; no automatic blind rebase |

First waiting UI threshold is 2 s; 8 s exposes recovery. These are not driver cancellation settings. Internal retry of a busy mutation is permitted only through idempotent operation identity and evidence that the previous attempt is not active; do not add generic retry loops.

## Commit and rendering boundary

Accept Update synchronously and set one request identity. Capture intent boundary including pending selected-media/bulk tasks; cap waiting with per-task outcomes and leave unresolved intent visible on failure. Freeze content mutations until acknowledgement/commit/readback settles. Full preview-page completion is irrelevant.

Repository commit revalidates complete included-trip set, automatic/manual flags, exact selected identities and within-trip order, direction, soundtrack revision and scope epoch. Readback returns a verified immutable native composition with renderer-owned resolution handles. Existing `replayDraftMatchesCommittedManifest` may be reused/extended, but do not compare transient thumbnail `available` flags or only selected counts.

Render receives that immutable composition, never latest React refs or a later mutable manifest. Cache publication CAS binds the artifact to the committed composition identity. Verify final file metadata, frame/timing/media accounting and exactly one valid AAC stream before promotion. Chapter identity retains exact visual inputs and format; track-only changes reuse compatible video chapters and remux. Unknown provider access is resolved without silently omitting explicit choices.

If render fails after commit, keep C and A and retry rendering C without another commit/revision increment. Old R stays playable only when current privacy/source gate permits; sharing of the new version remains unavailable. Progressive first-trip files retain existing partial labels and cannot become durable/shareable final records. Export remains a separate empty-first review of the current verified composition with current access revalidation.

## Incremental thumbnail service

Maintain the 48-item metadata page boundary. Initial viewport budget 12 tiles, prefetch one viewport. Service has at most six native resolution lanes globally per session, emits completions in batches of six or every 50 ms, and prioritizes visible gallery → visible overview covers → adjacent viewport → offscreen warming. Native jobs already started may finish, but offscreen jobs cannot occupy an unbounded pending queue; retain at most current+next viewport requests plus the bounded metadata page.

Request key: repository-private stable asset identity/content revision + scope epoch + target size + poster time. Dedupe page/tap/bulk requests. Selected count/order come from composition metadata, independent from decoded previews. Cache starts at 24 MiB decoded memory + 64 MiB private disk; enforce decoded byte accounting, LRU and eviction-safe visible pins. Pin count is bounded by viewport, not lifetime selection. If pinned/in-flight work approaches budget, drop prefetch and reduce decode size before exceeding the cap.

Use installed native thumbnail/poster support only after platform probe. Fallback may use one bounded service-owned poster generator with cache, never a mounted player per tile or full-resolution video decode per render. Do not add a dependency until installed API feasibility is documented. Preserve original render quality; thumbnail resizing affects only gallery previews.

Trip switch cancels/deprioritizes not-started requests and uses per-request epoch; late completions may warm a still-authorized cache but cannot replace B with A or modify selection. Partial successes survive page error. Timeout remains unresolved/retryable, not permanent unavailable. Privacy/lifecycle revocation blanks current images and invalidates corresponding handles/cache immediately.

## Audio pipeline and lifetime

Keep default Happy Moments 1.4, 5,000,000-byte inclusive maximum, supported decode-validated MP3/M4A/AAC/WAV/OGG and no clip audio. If picker size is absent, stat a readable source before private copy; unresolved/zero/over-limit size is rejected. Picker provider may internally copy first; measure that separately and do not claim a pre-provider size guard.

After known bounded source, copy to opaque app-private candidate file, validate finite positive audio duration with bounded decoder work, then expose ready subdraft. Retain current compatible picker cache copy until Android/iOS URI-lifetime evidence justifies removing it. Validation/copy never holds SQL ownership. Track revision comes from actual file/content identity, not displayed filename; same-name replacement changes revision. Store source reference only below native boundary; chosen display basename is transient screen data unless an approved private metadata field is needed.

Reference ownership: sheet candidate → applied session → acknowledged draft → committed composition → active render/artifact. Back from sheet releases only its candidate; background task result is fenced and cleaned after native handle settlement. Replaced/abandoned files are deleted only when no owner references them. A missing retained custom file requires explicit reselection/default, not silent fallback. Disconnect invalidates access immediately and completes private cleanup safely.

## Diagnostics and measurement

Use `app-diagnostics.ts` exclusively; extend the closed stage union with fixed Replay lifecycle stages for queue wait, transaction begin, draft write, composition commit, readback, audio copy/validation, thumbnail request and artifact promotion. Distinguish stage vs commit operations if necessary with fixed operation enums. Do not emit numeric profile payloads through production events.

Development-only profiler records monotonic durations and fixed categories: import/background/Replay/lifecycle writer, queue wait, transaction duration, manifest queries, first recognizable tile, poster/decode, picker return/private copy/audio validate, update capture/commit/render. No record/media/source IDs, labels, filenames, SQL, errors or private token digests. Synthetic operation categories and local durations are enough to attribute stalls; profiling stays disabled by default.
