# Replay acceptance and review resolution

## Source acceptance mapping

| Source | Required evidence |
| --- | --- |
| AC-M4.7-1 / CAP-1, CAP-2 | Policy-visible Journey List plan, all eligible attached photo/video inclusion, presentation-order disclosure, honest empty handling, local adaptively timed curated chapters with unlimited total duration, silent720p progressive playback/cancel |
| AC-M4.7-2 / CAP-2 | Physical Android and iOS renderer/playback/export, bounded work/memory/disk, visibility/metadata/diagnostics and destination transitions |
| AC-M4.7-3 / CAP-3 | Empty-first export selection, exact reviewed artifact, current dispatch eligibility, native sharing and copy warning |
| AC-M4.7-3 / CAP-4 | Optional separately confirmed attachment: M4.7 manifest/eligibility handoff, M4.5 protected upload/snapshot/revoke and M4.6 authorized playback |

Local export acceptance and optional hosted acceptance are recorded separately. Disabled publishing or fake adapters cannot establish hosted acceptance. M4.5/M4.6 still owe their MLP publishing/viewer requirements; this allocation preserves the source clause without creating hosting in M4.7.

## Discovery and automated cases

Put new tests in apps/mobile/src/components/__tests__/replay-selection.test.ts, replay-controller.test.ts, replay-renderer.test.ts and replay-screen.test.tsx. These match current Jest testMatch; keep implementation source under src/replay/. Before running suites, execute npm --prefix apps/mobile test -- --listTests and confirm all four exact paths. Do not place tests under the undiscovered src/replay/__tests__/ directory.

Extend the existing real-SQLite harness for the dedicated Replay read. Follow provider/native mocks so unrelated UI tests do not initialize native encoding. Mocked tests complement S0; they cannot establish native behavior.

| Given | When | Then |
| --- | --- | --- |
| Inferred/confirmed/manual, hidden, excluded and stale Journey List records | Plan/read executes | Every policy-visible trip is selectable; saved correction/statistics rules unchanged |
| Missing/coarse days and owner-entered dates | Presentation order derived | Existing Journey List order and precision disclose uncertainty; no observed-order, route or presence claim |
| Confirmed/inferred/owner, suggested/rejected/unassigned/moved/GPS-less memories | Media selected | Every available effective attachment enters its trip; withheld membership/correction rules remain enforced |
| 0,1 and many visible trips; date/journey filters | Preview/export selection changes | One trip with renderable media prepares; empty/read/access/limit states distinct; no hidden/remembered export selection |
| URI resolution pending or output ready | Privacy/run/correction/access/selection changes | Late work/player/approval invalidated, no stale handoff, cleanup after settlement |
| Cancel before/after session ID, hung job, native failure or missing module | Deadline/settlement occurs | Fixed outcome; retain serialization and file ownership until settlement |
| HEIC rotation, video, cloud-only, unsupported/oversized assets | Materialize | Fitted still or fixed omission; no cloud fetch, audio or silent substitute |
| Low disk, ENOSPC, byte/memory/deadline limit, corrupt output, metadata canary | Render/inspect | No bad output playable/exportable; cleanup failure retains retry evidence |
| Exact current preview, edited selection or unconfirmed facts | Export pressed | Reviewed manifest and fresh share eligibility required |
| Sharing unavailable, void return, rejection, double press or delayed recipient | Native handoff runs | No delivery claim/duplicate handoff/early unlink; safe retry if current |
| Background, Back, unmount, delete-all, disconnect, crash/relaunch, lease expiry | Lifecycle changes | Player stops, export approval clears; jobs/leases/cache/drafts follow interaction-contract.md; no restored export selection |
| Publisher absent, mismatched or equal selection | Attach requested | No upload before separate confirmation/current eligibility; hosted acceptance separately pending |

During implementation run mobile Jest, real SQLite, typecheck, lint and Expo Doctor via npm --prefix apps/mobile run check; also root npm run check and git diff --check. Record each outcome independently, including existing Doctor issues. Root checks do not establish native compatibility. Read evals/README.md before any engine/evidence-rule change; this feature should consume existing rules. Fixture success does not measure reconstruction accuracy.

## Physical S0 gate and product acceptance

Keep S0 evidence in the single implementation delivery record: exact packages/runtime/native build, device/OS, synthetic fixture, codec, dimensions/duration/fps/streams/metadata/bytes, incremental memory peak, disk high-water mark, elapsed time and cleanup. Use public synthetic photo/video and log canaries; private evidence remains local/ignored.

For each physical platform prove short and many-trip progressive chapter playback, buffering, exact long export and no rejected26-trip scope; HEIC/rotation/video still; cloud-only/denied/revoked sources; cancellation during preparation/render/before ID; background/foreground; low-space and crash/startup cleanup; preview-ready privacy/correction changes; delayed recipient read/save; native-sheet failure/return/retry and suppressed raw native logs. Verify actual MP4 metadata/streams and every numerical ceiling. Use controlled fault injection for conditions the OS cannot safely reproduce, recording it as simulated rather than physical evidence. Any unexercised device condition stays explicitly pending.

After S0, owner click-and-wait acceptance on Android and iOS covers one Replay tap, automatic preparation/playback, optional persisted edits and regeneration, reopen/restart, scheduled preparation/expiration/resume, separate exact export selection/review, cancel/retry and OS share/save. Check readable crops/text/coverage, large text/screen reader/reduced motion and Atlas return context. Metro/startup success is not interaction acceptance. Missing physical iOS/build access is an unrun gate with a specific environment dependency, never a successful M4.7 result.

## Media gap acceptance additions (2026-10-22)

| ID | Given / When | Required result and evidence |
| --- | --- | --- |
| R1 | Nine synthetic visible trips with unknown-but-locally-readable media; tap Replay | Same effective album media across every page enters resolution; nonzero renderable count; no import/rebuild/confirmation. SQL + native adapter/provider tests |
| R2 | Album and Replay read inferred/owner/support, rejected/unassigned/moved/suggested and ambiguous memberships | Shared query returns identical effective attached identities; no support-union resurrection after correction. Real SQLite before/after each correction/privacy change |
| R3 | Known and missing dates/GPS, owner labels/manual trips | Null preserved; unfiltered attached media retained; exact-date exclusions disclosed; no sentinel dates or observed-order promotion. SQL + selection tests |
| R4 | 0,1,59,60,61,120,121 attachments with mixed photos/videos and repeated SQL rows | Complete stable pagination; one slot/token per effective item; no duplicate rows/shifted assets; every candidate accounted for. SQL + provider tests |
| R5 | Unknown local asset, thumbnail-only URI, denied/deleted/cloud-only/unsupported source and resolver failure | Resolve local asset; verify original separately; fixed differentiated results; no cloud fetch, blind flag promotion or failure-as-empty. Adapter + materializer tests |
| R6 | Tap Replay from carried Atlas scope | Visible acknowledgement and automatic preparation/playback without a Prepare button or export choices; pause/cancel/retry/Atlas return; one safe in-flight action. Isolated screen + controller tests |
| R7 | 1,25,26 and many trips, diverse media pools and odd frame division | Every scoped trip gets a curated15-20s default chapter, exact frame sum, no global25-panel/60s rejection. Candidate/chosen/editorial/technical counts are distinct. Planning tests + S0 chapter readability |
| R8 | Privacy/correction/access/run change on page two, after decode, before publish/export; album navigation alone | Stale output blocked and cleaned after settlement; ordinary browsing does not cancel Replay. Provider/controller race tests |
| R9 | Mixed media on device through album then Replay | Same accessible originals resolve or specific render-only limits explain differences; meaningful labelled composition, not just nonzero count. Owner click-and-wait |
| R10 | Export entry, select-all, single removal, edit after review, deliberate native handoff | Empty-first separate scope, exact bytes/manifest, new preview after edit; no upload or recipient-delivery claim. Screen/controller + physical platform evidence |

For the owner-reported case record only aggregate journey/candidate/resolved/rendered/
omission counts and fixed reasons in the delivery record. Keep private identity
comparisons locally ignored. Do not put diagnostic payloads or raw evidence in Git.
Passing R1 does not close R9 or prove that nine private trips contain the synthetic
fixture's media counts. Full completion requires R1–R28 and existing S0/lifecycle cases.

## Historical review resolution trace (before owner amendment)

| Findings | Document resolution |
| --- | --- |
| A1 / E1 | Separate private and empty-first export selection; exact reviewed artifact |
| A2 / E2 | Observed intervals, same-place grouping, overlap-component omission and dedicated read |
| A3 / E3 | Individual membership/correction/association and family checks |
| A4 / E4 | Measurable plan/native/file/time ceilings; explicit sampling/omissions |
| A5 | Media format/orientation verification, local video still and cloud omissions |
| A6 / E9 | Native share API; direct gallery-write UI explicitly excluded; actual save destination acceptance |
| A7 / E5–E7 | Preview/export transitions, invalidation, native settlement, export lease and startup/expiry cleanup |
| A8 / E8 | Discovered component test paths, listTests evidence and real-SQLite harness |
| A9 | S0 before adoption, exact evidence, native fallback or recorded blocker |
| A10 | CAP-4 plus explicit M4.5/M4.6 handoff/acceptance |
| Structure 1–4 | Visible S0, parallel constraints, one acceptance matrix and a consistent path base |

This table preserves the earlier review disposition, not current superseded behavior. The owner amendment replaces A2/E2's strict observed-order gate with Journey List presentation, A3/E3's family replacement with effective album-item accounting, and A4/E4's sampling cap with bounded complete composition or explicit actual resource failure. Other lifecycle/privacy/native protections remain. These are document resolutions only; device measurements remain pending.

## One-action playback and durable editing additions (2026-10-23)

These rows and interaction-contract.md supersede old mandatory Prepare and screen-owned/ephemeral-only lifecycle expectations. Preserve R1-R10 source/media/privacy coverage; add CAP-5 to AC-M4.7-1 and AC-M4.7-2.

| ID | Given / When | Required result and evidence |
| --- | --- | --- |
| R11 | Replay entry with valid cache, cache miss and pending same-key job; double tap | One user action; cache validation or automatic preparation followed by actual play, one native job, no Prepare/configuration/review gate. Screen/provider/service tests plus physical tap-to-playing measurement |
| R12 | Open Edit before/during/after preparation; change trip/media inclusion and order; Done/Back/reset | Working revisions survive; Done commits and regenerates once; Back preserves working changes; reset only resets presentation. Accessible move controls and no evidence mutation. Screen + real-SQLite tests |
| R13 | Navigate/restart, source addition/deletion, stable successor, ambiguous split/merge, privacy hide | Durable exclusion/order retained; defined all/explicit selection behavior; fail-closed remap with count; no hidden resurrection or matching by labels. Real-SQLite remap fixtures + physical restart |
| R14 | Two editors, revision conflict, late render, privacy during completion, ordinary Atlas reads | CAS conflict retains work, stale output cannot publish, browsing does not invalidate, newest committed draft wins. Repository/service race tests |
| R15 | Reconciliation commits while no player exists; maintenance disabled/restricted, OS expiration, kill/relaunch | Durable dirty marking and coalescing, no disabled-consent bypass, safe native ownership/settlement, automatic permitted resumption; no partial ready artifact. Service/task tests + both-platform scheduled-task evidence |
| R16 | Missing/corrupt/digest-mismatched output, crash at promote/register, LRU/expiry, low storage, active leases, delete-all | No invalid cache playback; bounded regeneration/eviction, deferred cleanup under active native owner, complete namespace cleanup without source loss. SQL/filesystem fault tests + physical disk/cleanup checks |
| R17 | Private edits/cache ready followed by Share; edit/revoke after exact share preview | Separate empty-first selection; no private draft auto-export; exact-byte review/eligibility invalidated on change; no auto-upload or duplicate handoff. Controller/screen + physical export |
| R18 | Reduced motion/large text/screen reader, many-trip scope beyond the retired25-panel cap, zero scope, renderer/access failure, Back to Atlas | Documented autoplay accessibility policy, fixed differentiated recovery, optional Edit reachable, retained Atlas context; all media accounted for. Automated edge cases + physical usability |

Measure cache-hit entry-to-first-frame, cache-miss entry-to-acknowledgement and entry-to-first-frame, edit-Done-to-first-frame and scheduled-job completion/expiration separately. Record actual build/device/scope counts and repeat samples; no latency SLA or device-success claim from mocks. Required host checks remain unchanged. All R11-R18 and scheduled native behavior are pending implementation and device evidence.

## Curated chapter and AI acceptance additions (2026-10-23)

This supersedes historical all-media-in-pixels, still-only, 30-60s lifetime and
P=26-refusal expectations. R1-R18 retain eligibility/album/draft/service/export
coverage with these new timing/selection semantics; no old global cap survives.

| ID | Given / When | Required result and evidence |
| --- | --- | --- |
| R19 | 1,10,26 and many scoped trips with large per-trip pools | All trips represented, adaptive sparse/normal chapters and sum duration grows; bounded progressive render/playback/cache, no global60s/25-panel refusal. Host timing/accounting plus physical long sequence |
| R20 | Bursts, utility images, sharp duplicates, unique blurry moments, unknown dates/GPS and no faces | Diverse supported event/scene coverage; quality not sole ranking; missing signals neutral; no forced portraits, invented chronology or lost album items. Synthetic invariants and human preference comparison |
| R21 | Keep/Exclude/Auto/Swap, similar kept images and too many explicit keeps | Hard privacy first; owner intent preserved, affected chapters only, over-budget keeps visibly extend instead of disappear. Persistent SQL/draft/selector tests plus owner editing |
| R22 | Valid/invalid video windows, long source, black lead-in, unreadable motion or missing duration | Bounded local sampling, validated real3-5s clip or labelled still/replacement; no out-of-range interval, source-wide staging, output audio or fabricated video success. Native frame/decode evidence |
| R23 | No consent, metadata-only consent, revoked/stale image consent, offline/timeout/malformed AI/unknown handles or injected image text | No unauthorised visual transfer; useful deterministic local fallback; no model-invented membership/identity/emotion; no swap of playing/reviewed output. Contract/fault tests; approved provider experiment separately pending |
| R24 | Full chosen sequence larger than32MiB/60s, low disk, paused task, cache eviction or share return | Exact streamed single-file assembly, measured storage and metadata/digest checks, stable chapters/leases, no truncation/auto-split/false delivery. Both-platform long export and OS-task evidence |

Evaluate proposed curation against metadata-only and local-visual baselines before
model selection. Follow memory-selection-contract.md evaluation plan and
 evals/README.md; report human preference/replace burden with denominators,
latency/cost/battery and unavailable signals. Product quality, native clip quality
and AI advantage remain not_measured. No provider experiment was run by this
planning update, and no personal media/labels enter Git.

## Adaptive timing and first-slice acceptance (2026-10-23)

Later owner-approved sparse timing supersedes every strict15-20s chapter minimum.
Read timing-contract.md before interpreting R7/R19/frame budgets. Product actions
are Replace/Add/Remove/Reorder; Keep/Exclude/Auto remain internal intent semantics.

| ID | Given / When | Required evidence |
| --- | --- | --- |
| R25 |0,1,2,3-6 distinct chosen stills; burst-to-one; decode loss; title/transitions |Verified-empty slate3s initial assumption, one5s/two8s initial defaults inside4-6s/6-10s, normal15-20s; exact24fps timeline and no filler. Read/access failure never becomes empty; privacy-hidden trip has no revealing slate. Pure planner + native output inspection |
| R26 |Short video, mixed media,8s coherent extension, invalid intervals, explicit keeps beyond20s |Actual clip lengths, >=2.5s still dwell, <=20s automatic chapter; kept additions extend visibly; no stretching/freezing/loops and no dropped pins. Planner/renderer tests + physical video |
| R27 |Global history/draft revision changes while only trip A content changes; reorder; privacy change |Current-policy checks always run; only A encodes, safe unchanged B reuses fingerprint, reorder reuses bytes/new sequence, affected privacy output immediately stops and export review invalidates. Service/cache regression |
| R28 |One-trip automatic Replay -> actual watch -> Replace -> Done -> reopen/restart |One-action playable output, replacement survives durable read-back and regenerated playback, album/evidence unchanged. Early vertical-slice gate on physical Android and iOS, not mocked success |

Measure first-frame and replacement-to-first-frame on that first slice before
scaling the whole history. Previous module-only passes cannot close R28 or prove
wise curation. Primary-image content and human preference comparisons remain local
or separately authorised; no new private-media/model run occurs in this spec task.
