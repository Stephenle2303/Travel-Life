---
title: 'Preview and export the Travel Life Replay'
type: 'feature'
created: '2026-10-21'
updated: '2026-10-23'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'bc3c536842d9989ad05687a26645f742ba542528'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/development/error-playbook.md'
  - '{project-root}/_bmad-output/specs/spec-m4-7-travel-life-replay/SPEC.md'
---

## Owner UX amendment: visual Replay Edit (2026-10-24)

Detailed CAP-5/D4 contract is now registered in the canonical SPEC through
`editor-experience.md` and `editor-delivery-and-acceptance.md`. D4.1-D4.5 cover
working revision/identity, bounded local gallery, first visual slice, secondary
controls/recovery and actual platform review. E01-E16 map to existing R gates.
New editor APIs/schema remain proposals; physical acceptance and implementation
are pending. Use these details over earlier generic Add/Remove/Replace labels.

Specification checks (2026-10-24): coherence/preservation self-validation passes;
CAP-1..5 retained, 15 companion paths resolve, E01-E16 are unique/complete, and
local links/Markdown whitespace pass. Root `npm run check` passes pinned framework
integrity, 20 foundation tests and eval smoke. One over-specific exact-word check
was corrected and recorded in the error playbook. These are documentation and
foundation results, not E01-E16 runtime or owner UX acceptance.

Apply decision 0014, the mandatory experience principles in
`docs/product/design-system.md`, and the visual editor amendment/acceptance in
`interaction-contract.md` to D4. They supersede the older flat per-media
Add/Remove/Replace/Move button presentation in this record. Retain preview context,
select a trip in a compact strip, and toggle recognizable photo/video tiles in an
inline grid patterned after Journey List's See photos. Secondary music/order
settings remain compact. Selection reflects the actual chosen composition;
explicit additions/removals survive replan and Done triggers automatic regeneration
with truthful progress. Keep working/committed draft, privacy and sharing gates.

Source review: the current `replay-screen.tsx` maps the whole eligible list to
text buttons without thumbnails or trip grouping; `journey-media-viewer.tsx`
provides a paged gallery reference but lacks video posters. This is a confirmed
design mismatch, not a measured parsing-performance diagnosis. D4 remains open:
implement the contract, run meaningful host/persistence/paging checks, and obtain
physical Android/iOS visual and owner usability evidence. No runtime changes in
this amendment. This remains the sole M4.7 delivery record.

## Replay rendering performance implementation plan (2026-10-23)

Status: planned; no measured speedup or visual acceptance yet. This amendment
implements the owner's request for significantly faster rendering with preserved
quality inside M4.7. It refines D0/D1/D3/D5/D6 below; it does not replace their
product acceptance or introduce another backlog. Execute P0-P5 in order, with
bounded experiments inside each phase. Existing chapter-card legibility work is
an integration dependency: record its exact source snapshot and preserve its
accepted composition rather than overwriting overlapping renderer edits.

### Baseline and boundaries

Source inspection establishes these candidates, not their timing contribution:
`photo-access/provider.tsx` resolves all candidate previews before selection;
`replay/renderer.ts` stages every selected source and converts stills into PNGs
before scene rendering; each card/memory has a serial native encode call; the
controller returns playback only after complete assembly/verification. Final
assembly already uses `-c copy`. The controller has same-manifest in-memory
artifact reuse, but no durable independent chapter cache. Its key includes a
global generation. A whole-output 32MiB rejection also remains in the renderer;
resolve that existing conflict with the accepted long-Replay storage contract
in P4, rather than treating the limit as a performance optimization.

Keep current selection, owner overrides, all scoped trips, direction, card
legibility, sparse timing, short real-video behavior, evidence uncertainty,
local privacy and separate exact selected sharing. Preserve 1280x720/24fps silent
H.264 output. Codec, bitrate, intermediate format or filter changes additionally
require visual validation; dimensions/frame rate alone do not establish quality.
No model/selector redesign, cloud processing, unrelated reconstruction/schema
optimization or unbounded parallel encoding belongs in this performance slice.

### Measurement and acceptance

Initial engineering targets below are provisional planning assumptions, not
owner-approved preferences or achieved results. Freeze the fixture matrix and
targets before comparing candidates; retain a missed target explicitly rather
than lowering it after measurement.

| Measure | Definition and initial target |
| --- | --- |
| Cold render completion | Tap Replay to every scoped chapter verified and ready; at least 50% lower median than baseline for the matched normal/many-trip fixtures on each platform. |
| Cold first playback | Tap to first actually displayed video frame, including source resolution and player startup; at least 50% lower median for multi-trip fixtures, with no regression on the one-trip sparse case. |
| Unchanged reopen | Fresh eligibility validation then valid cached playback, including after app restart; zero native chapter re-encodes. Record absolute latency and validation cost. |
| One-trip edit | Done to affected chapter verified; re-encode only that changed chapter and reuse every still-valid unaffected chapter. Record latency and bytes rewritten. |
| Continuous watch | Report stall count and total/max stall duration; no new stalls against matched baseline on the acceptance matrix. Faster startup cannot conceal buffering regressions. |
| Quality and resources | Same intended memories/order/cards/timing; owner visual acceptance and strict output checks. No crash, resource-limit breach, leaked files or non-settling cancellation. Record peak memory/disk and thermal limitations. |

Use synthetic fixtures: one still; two stills; a normal 4-6-moment chapter;
mixed still/video including a sub-second clip; high-resolution/rotated photos;
multiple trips and a long many-trip sequence; large candidate pool with few
selected moments; unavailable/denied sources and a visible empty-media trip.
Record exact fixture hash, source snapshot plus dirty diff identity, build type,
device/OS, native/library version, selected encoder/configuration, cache state,
output duration and thermal/power conditions. Compare baseline and candidate on
the same physical device and fixed render manifest. Compare release/profile
builds without Metro overhead for performance acceptance; keep development
results separately labelled. Run at least five paired trials per normal case,
alternate baseline/candidate order, and report median/range and every failure.
Do not describe a five-run maximum as a reliable p95. Cold means disposable
benchmark cache misses; never clear the owner's library, database or edits.

Development-only local measurements cover manifest load, access resolution,
selection, staging, still conversion, native startup, per-scene encode,
assembly, verification, player startup and first frame. Also record aggregate
native-call count, copied bytes, cache hits/misses and resource peaks. Account
for overlapping spans without double-counting. Production console diagnostics
retain their closed schema; no new timing fields, raw native logs, source IDs,
paths, labels or personal metadata. Keep private benchmark material in existing
ignored local directories; committed reports use synthetic aggregates only.

### Executable work packages

| Phase | Implementation and files (relative to apps/mobile/) | Exit evidence |
| --- | --- | --- |
| P0 Baseline | Add injectable development measurement hooks around provider/controller/renderer and actual player first-frame observation in `components/replay-screen.tsx`. Reuse existing S0/native harness and native mocks. Freeze baseline manifests/output and collect the matrix above. Reconcile overlapping card work before capturing the baseline. | Stage timings identify the dominant cold cost; baseline actually renders and plays on each measured platform. An unavailable renderer is a functional prerequisite failure, not a slow timing sample. |
| P1 Cold path | In `replay/renderer.ts` and the existing native adapter, benchmark output-sized still preparation once versus current full-size PNG conversion/repeated scaling; bound local video reads/staging to actual clip work where platform access permits. If measurements show resolution dominates, page/coalesce shared local resolution while preserving complete candidate accounting, selection equivalence and current access checks. If native-call overhead dominates, compare bounded per-chapter composition against per-scene calls. Adopt only individually measured improvements; keep one native encode owner. | Identical fixed-manifest content/timing; actual decode/playback, visual gate and lower dominant-stage/cold-completion times. Record rejected experiments and resource tradeoffs. Do not assume a filter or decoder handles HEIC, orientation or HDR correctly. |
| P2 Chapter reuse | Extend `replay/types.ts`, `controller.ts` and renderer boundary to independently verified chapter artifacts. Add durable cache records through the existing import-record schema owner only if needed; add real SQLite upgrade/reopen coverage. Fingerprint source content/version or validated local revision, chosen windows/order, timing, card text/time, renderer/filter/font/encoder configuration and format versions. Separate sequence direction/global revision from unchanged chapter content. | Unchanged reopen encodes zero chapters; editing one trip encodes only its changed chapter. Label/card/media/config changes invalidate their chapter; global-only sequence changes can reuse safe bytes. Missing source freshness proof causes conservative regeneration. |
| P3 Progressive playback | Extend the provider-owned job/controller with ordered pending/rendering/verified/failed chapter states and a playlist contract. Resolve complete selection semantics, then prioritize first chapter materialization/encode and bounded next buffering. Publish only verified chapters after fresh eligibility checks; prefetch within measured memory/disk limits. Wire player chapter completion, previous/next and buffering/retry in the existing Replay screen. | Actual first-frame target plus full cold-completion target; no skipped pending/failed trips, lost ordering, chapter boundary glitches or new stalls. Navigating/back/backgrounding respects existing ownership and platform lifecycle. |
| P4 Recovery and exact export | Add dirty/coalesced maintenance integration, restart checkpoints, cancellation settlement, orphan cleanup and bounded chapter LRU/leases using existing scheduler patterns. Replace the remaining whole-output 32MiB gate with measured storage admission per the accepted contract. Remux compatible exact selected chapters; render newly selected subsets separately. Verify compatible codec parameters/time bases, timestamps, exact selection/duration and output metadata before review/share. | Privacy hide/exclude/access-revoke races stop stale playback/export; eviction cannot delete active leased files. Low disk/OS expiration/restart recover honestly. Long exact export passes admission, decode and native share tests on both platforms. No automatic publication. |
| P5 Acceptance | Execute software checks, fixed-manifest visual comparisons and physical Android/iOS owner tap-and-wait, repeat/restart, edit and selected-share flows. Update this delivery record with baseline/candidate table, quality decisions, outstanding incidents and platform evidence. | All targets and quality gates have evidence, or delivery remains explicitly partial with the precise missed target/blocker. Host tests cannot close physical playback or iOS gates. |

P1 must improve actual cold completion before cache/progressive results are
reported as the speedup. P2 precedes P3 so playback consumes the same validated
chapter ownership model. P4 durability work can build on P2 while P3 playback
is verified, but there is only one native render owner and one delivery record.
Do not require completion of unrelated visual-AI selection experiments to start
these fixed-manifest performance improvements.

### Quality, regression and rollout gates

Compare baseline/candidate frames at card boundaries, representative stills,
video start/middle/end and chapter joins. Check text legibility, framing,
orientation, color/HDR conversion, gradients, fine detail and compression
artifacts through actual playback as well as extracted frames. Automated
frame/perceptual differences are supporting evidence; unexplained differences
need review and no arbitrary score alone establishes equivalent quality.
Any existing baseline defect is identified separately; do not preserve a defect
merely to match a frame. Reuse existing fixtures and assert invariant behavior.

Required regressions: source-permission changes during resolution and cache
reuse; same attachment in two trips; stale job completing after replacement;
hidden/excluded media while playback/share is queued; label/font/order change;
edited short video without freeze/loop; failed kept media; corrupt/missing cache;
restart after partial render; cancellation during an active native call; storage
exhaustion, LRU eviction with playback/export leases and OS task expiration.
Verify native cancellation/settlement explicitly: an aborted JS signal alone
does not prove that FFmpeg has stopped before another job starts.

Use a versioned internal renderer strategy and cache namespace for incremental
rollout. Keep a known working strategy available until physical comparison
passes, retaining current privacy checks on either path. Fallback must use the
same approved manifest/selection and never mask an encode failure as success.
Retire incompatible derived cache entries safely; preserve originals and drafts.

For implementation, run focused Replay renderer/controller/provider/screen tests
(screen suite separately), then mobile Jest with an explicit quoted absolute
repository-local cache, `npm --prefix apps/mobile run test:sqlite`, `typecheck`,
`lint` and `doctor`; root `npm run check`; and `git diff --check`. Review actual
package scripts first and record unrun/blocked checks. No native dependency
change is assumed: research exact installed capabilities before changing native
arguments or choosing a new integration. Obtain physical iOS evidence when an
iOS environment is available; continue independent host/Android work meanwhile.

Planning verification: root `npm run check` passes framework integrity, 20
foundation tests and eval infrastructure smoke; `git diff --check` passes.
Source/plan coherence was checked against the existing provider, controller,
renderer, D0-D6 boundaries and package scripts. Application/native checks are
inapplicable to this documentation-only change. All P0-P5 implementation and
performance results remain pending.

## Active implementation plan: adaptive curated Replay (2026-10-23)

Accepted experience: **tap Replay -> watch -> optional edit.** Each trip uses
curated memories, with one still about4-6s, two about6-10s and enough distinct
moments normally15-20s. Titles/transitions are included; useful video may justify
longer and explicitly kept additions may extend a chapter. No filler, repeated
photos or total-lifetime duration cap. Read SPEC.md and its companions, especially
timing-contract.md and memory-selection-contract.md. Sparse ranges are accepted;
exact5s/8s static values and3s verified-empty slate are initial engineering defaults.
This supersedes strict timing/full-media/contact-sheet wording in older plans below.
The detailed M4.7 program remains in progress. The direction/card slice below
is now implemented and host-verified; remaining source/native acceptance gates
continue to be tracked explicitly in the phases and review status.

**Chapter presentation amendment:** Oldest first is the default private Replay
direction; the optional editor can persist a newest-first choice. Each visible
trip chapter opens with a brief in-video card containing its current private
Journey List label/destination and existing time precision. Direction/cards are
presentation only: they neither alter evidence nor imply routes, exact dates,
presence or itinerary. Read chapter-presentation-contract.md before implementing
the manifest, persistence or renderer changes.

**Plan validation:** Companion registration and the canonical memlog decisions
were checked on 2026-10-23. `git diff --check` and root `npm run check` pass.
That evidence validates this plan's repository structure and foundation suite;
it does not prove runtime behavior, native title rendering, or Android/iOS
product acceptance.

**2026-10-23 implementation evidence:** The current private Replay path now
persists the editor's direction (oldest-first by default), includes direction
in the render-manifest identity, renders bounded local chapter cards, and uses
the selected order for private playback and exact selected sharing. Focused
Replay Jest tests (31), the 86-case real-SQLite suite, mobile TypeScript/lint,
the full mobile Jest suite, root `npm run check`, and `git diff --check` pass.
The Android development APK built, installed, and launched against the current
development server. Owner-operated card legibility, restart persistence, exact
share output, and iOS behavior remain acceptance work; an independent review is
pending because both assigned reviewers reached their service usage limits
before inspecting the workspace review artifact.

### Selection product rule

Use adaptive timing after chosen original-readable memory count is known;
18s is the normal five-shot target, not a sparse minimum. Usually choose4-6
distinct moments when worthwhile. Prefer story coverage and
owner intent over top-N aesthetics: context, different supported moments, people
or activity when present, distinctive detail and a strong close. Group bursts,
rank technical usability softly, downrank utility shots and avoid duplicates.
No portrait quota, identity/emotion/relationship inference or model-generated
history. Owner Keep/Exclude beats automatic ranking; hard privacy always wins.
All album candidates remain available in optional Replace/Add/Remove/Reorder
editing; Keep/Exclude/Auto remain internal persistence semantics.
Specific ranking weights, thresholds and personal-value claims need evaluation.

### Updated work order

All source paths below are relative to apps/mobile/. Reuse existing modules;
proposed files are responsibilities, not a mandate to create abstractions.

| Phase | Deliverable | Completion gate |
| --- | --- | --- |
| D0 Baseline and feasibility | Inventory current album/provider/native evidence; add RED one-tap, sparse/normal frame-budget and selection cases under discovered src/components/__tests__/. Run a small approved local-visual feasibility comparison early; inspect exact existing Android/iOS S0 evidence. | Real missing-behavior assertions, synthetic native gate delta and usable baseline experiment; no private-media transfer. Source-aware visual selection is assessed before polishing the full UI. |
| D1 First complete slice | Implement minimal additive draft/override persistence and service ownership for one trip, including the default oldest-first direction and its private trip card, adaptive planning, actual native render/play, Replace -> Done -> regenerate -> durable reopen. Keep the existing album and evidence unchanged. Use current native schema owner and exact-version S0 prerequisites. | R25/R28 plus direction/card SQLite read-back and physical Android+iOS card-legibility/order evidence. Host implementation can proceed independently, but mocked playback cannot close this gate. Do not build every cache/task feature before this slice. |
| D2 Scalable local curation | Extend candidate paging/accounting, duplicate/event diversity, owner-intent constraints and deterministic subset selection. Apply timing-contract.md after decode loss. Add measured local vision or optional consented visual AI behind a useful deterministic fallback. | R1-R8/R19-R23/R25-R26; compare selected sequences, meaningful misses and replacement burden across metadata/local-visual/optional-AI on approved trip holdouts. Quality remains unmeasured until actual review. |
| D3 Automatic multi-trip service | Extend first-slice ownership to serial chapters/checkpoints, progressive playlist/next buffering, chapter LRU and dirty/coalesced maintenance resume. Resolve only supported chronological blocks; preserve Journey List-relative order inside uncertain blocks. Reuse safe per-trip fingerprints after current scope/privacy/access checks, without re-encoding for a global revision alone. Add previous/next trip and buffering/retry that never silently skips pending chapters. | R6/R11/R14-R16/R19/R22/R24/R27 plus direction/block and platform task/long-playback S0 delta. Every scoped trip stays; unaffected chapters reuse verified bytes. |
| D4 Complete optional editor | Product actions Replace/Add/Remove/Reorder and Oldest first/Newest first, mapped to durable internal intent. Working/committed saves, Done regenerates affected chapters, reset and unique remap/conflict recovery. Failed kept media remains visibly unavailable instead of silently replaced. | R12-R14/R18/R21/R26-R28 plus direction reopen/reset coverage; restart retains replacements and direction, removals do not reappear automatically, kept additions extend duration visibly and no source facts change. |
| D5 Exact long export | Separate empty-first chapter/media selection, assemble exact chosen sequence into a verified local silent720p MP4 via bounded streaming/remux, exact review/digest/current eligibility and deliberate OS handoff. Never export the unreviewed private preview directly. | R10/R17/R24 plus measured storage, format/metadata and both-platform native save/share/lease tests. CAP-4 remains separately confirmed M4.5/M4.6 integration. |
| D6 Full acceptance | Required root/mobile checks, incident closure, Android+iOS owner click-and-wait for adaptive sparse/normal timing, all-trip playback, edit/restart, task recovery and exact long export. | R1-R28 and AC-M4.7-1/2/3; native/AI/preference evidence is recorded separately, with pending gates never described as passed. |

Dependencies: D0 -> D1 -> D2 -> D3 -> D4 -> D5 -> D6; synthetic native S0 and
local selector experiments can proceed alongside host persistence work. Do not
reinstall native dependencies or rerun unrelated builds without a concrete need.
No application source or model invocation is part of this planning request.

### Implementation files and first regressions

- replay/types.ts and selection.ts: chosen-source ledger, timing policy/version,
  supported chronological blocks, persisted direction, sanitized trip-card tokens,
  exact frame plans, deterministic diversity, per-trip fingerprints and sequence
  manifest. First cover0/1/2/3-6 stills, duplicates-to-one, post-decode shrink,
  unknown/overlap order stability and newest-first block reversal.
- replay/controller.ts, proposed service.ts/repository.ts and current native schema
  owner: single job/lease, committed and working edits, CAS/remap, current-policy
  validation and same-content cache reuse. Real SQL tests for persistence/migration.
- replay/renderer.ts: bounded title-card/transition timing, safe local text overlay
  with proven font availability, actual clip windows, inspected chapter output and
  long single-file assembly; retain metadata/argument/log guards.
- photo-access/provider.tsx and shared native-adapter.ts: one effective read/access
  pipeline; no duplicate unmanaged render or UI generation used as source identity.
- components/replay-screen.tsx and proposed replay-editor.tsx: automatic play,
  optional simple editor, no screen-owned job cancellation, retained Atlas context.
- maintenance/task.ts and existing scheduler/reconciliation hooks: durable dirty
  intent after commits, native task ownership/expiration and safe automatic resume.
- components/__tests__/ and scripts/atlas-sqlite.test.cjs: timing, one-tap/edit
  read-back, privacy races, per-trip reuse and S0/device evidence. New tests must
  match the configured Jest discovery; doubles never prove video playback.

### Native, storage and AI gates

Retire old globalP<=25/60s/32MiB/180s checks. Keep adaptive sparse/normal chapters at
720p/24fps, one native owner, bounded decode/frame/intermediate memory and per-job
settlement. Initial per-chapter180s foreground/output32MiB/intermediate96MiB and
incremental-native-memory192MiB budgets need measurement, not blanket adoption.
Video originals may exceed32MiB: use bounded local seeked reads, not whole-source
staging. Background expiration may be much shorter; checkpoint and automatically
resume safely. Ready chapter LRU starts at192MiB, plus separately admitted active
jobs/export files. Do not materialise the entire lifetime sequence in RAM.

A player playlist does not prove a single-file long export. Export admission must
estimate the exact output, staging/lease-copy peak and safety reserve on actual
disk; no unlimited-storage promise or silently shorter/split export. Reuse proven
platform evidence only for matching build/version conditions. Native video-window,
long assembly, scheduled task, privacy and share/cleanup cases need both platforms.

Local ML feasibility and visual consent are new evidence gates. Existing AI
minimizer/transport accepts structured reconstruction alternatives, not images or
video. Do not reuse it as proof of consent or visual-model support. Optional
multimodal AI can suggest only known eligible handles/validated intervals; invalid,
stale, offline or declined results use the useful stable local selector. No AI
failure blocks basic Replay and no model reranks current playback/reviewed bytes.

Compare metadata-only, local visual and optional AI selectors using approved
trip-level holdouts and actual owner preferences/replacement burden. Record
coverage, repetition, meaningful misses, timing/cost/device load with denominators.
Weights and thresholds stay provisional; product-quality/model advantage remains
not_measured. Real media and labels remain ignored/local with purpose-specific
processing authorisation. Primary capability sources are in the memory companion.

### Active checklist and verification

- [ ] D0 Current evidence, discovered RED cases and selection experiment plan.
- [ ] D1 One-trip watch/replace/reopen slice with minimal durable schema and real native output.
- [ ] D2 Local curated selector plus measured optional AI/consent adapter.
- [ ] D3 One-tap progressive chapter playback/native/background gate.
- [ ] D4 Persistent optional Swap/Keep/Exclude/Auto editor.
- [ ] D5 Exact reviewed long single-file export and optional hosted boundary.
- [ ] D6 R1-R28/native acceptance and incident/evidence records.

During implementation verify Jest discovery, use the existing native mocks and
quoted absolute repository-local cache, run mobile `npm run check` (Jest, real
SQLite, TypeScript, lint, Doctor), root `npm run check` and `git diff --check`.
Record actual outcomes; root/fixtures do not prove selection quality, video clips,
background tasks, long playback or export. Owner acceptance is tap Replay ->
watch all trips; optional Swap/Keep/Exclude -> Done -> only affected chapter
regenerates; restart -> overrides retained; selected share -> exact review ->
native save/share. Include source/privacy changes, actual many-trip playback,
cache eviction, storage failure, clip fallback and OS expiration/resume.

## Earlier one-action plan (2026-10-23, before curated chapters)

**Replay -> watch <-> optional edit.** This plan supersedes the historical
D1-D6 plan and frozen baseline below where they conflict. Use canonical
SPEC.md/CAP-1..5 and all five companions, especially interaction-contract.md.
Keep this as the sole M4.7 delivery record. All tasks below are pending
implementation; this revision changes planning documents only.

### Required behavior

One Replay tap opens the player, validates/reuses a current cached artifact or
automatically prepares and starts playback. No separate Prepare, configuration,
private fact confirmation or export-review step precedes watching. Back preserves
Atlas scope/camera/year. Loading is quiet; genuine failures have fixed recovery.
Edit remains optional and reachable during loading or recoverable failure.

The first editor includes/excludes trips/media and moves trips or media within a
trip earlier/later with accessible buttons. Changes persist as a working revision;
Done activates it and regenerates automatically. Back retains working changes.
Playback uses the last committed revision until Done. Source corrections use the
existing correction flow. Inclusion/order controls are agent-selected defaults,
not an inferred promise of a full editing suite. No new music, clip trimming,
cropping, title editor or timing controls are assumed.

### Current code and evidence baseline

Source inspection finds an implemented native/provider render path. Retain and
audit it, rather than following historical renderer-stub descriptions. The screen
still opens idle with Prepare, its video setup does not request play, and it has
no editor. It first resolves a manifest, then provider preparation reads/resolves
again. provider.tsx calls the renderer with an unmanaged AbortController; the
standalone ReplayController does not own that path. Close only resets screen
state. Export currently directly shares the private artifact and lacks the
specified empty-first exact selected export. An in-memory URI map is not a durable
cache. Correct these integration gaps without rebuilding completed album work.

Recent Android synthetic encode is partial evidence, not real-media, sharing,
background execution or iOS acceptance. Inventory exact build/version evidence
before choosing remaining S0 checks; do not restart all device work blindly.

### Work order and acceptance gates

Paths in this table are relative to apps/mobile/. Add proposed files only where
existing modules cannot hold the responsibility clearly.

| Phase | Implementation work | Depends on | Acceptance |
| --- | --- | --- | --- |
| D0 Baseline and feasibility | Inventory current album/provider/native evidence; add RED one-tap, sparse/normal frame-budget and selection cases under discovered src/components/__tests__/. Run a small approved local-visual feasibility comparison early; inspect exact existing Android/iOS S0 evidence. | Real missing-behavior assertions, synthetic native gate delta and usable baseline experiment; no private-media transfer. Source-aware visual selection is assessed before polishing the full UI. |
| D1 First complete slice | Implement minimal additive draft/override persistence and service ownership for one trip, adaptive planning, actual native render/play, Replace -> Done -> regenerate -> durable reopen. Keep the existing album and evidence unchanged. Use current native schema owner and exact-version S0 prerequisites. | R25/R28 on physical Android+iOS plus real-SQLite migration/read-back/CAS tests. Host implementation can proceed independently, but mocked playback cannot close this gate. Do not build every cache/task feature before this slice. |
| D2 Shared service | Refactor controller.ts; add service.ts/cache/scheduler helpers as needed. Replace provider direct unmanaged rendering/duplicate reads with one immutable scoped job. Share album materialization and full candidate accounting. Wire committed import/reconstruction/correction/privacy/draft changes and maintenance/task.ts to dirty marking and coalesced automatic preparation. | D1; S0 before native execution on each platform | One native owner across foreground/task runtimes, settlement-safe cancellation, generation validation and no invalidation from ordinary Atlas reads. R1-R8/R14-R16. |
| D3 One-action player | Refactor replay-screen.tsx, replay route and Atlas handoff. Entry joins/requests current service output; ready completion or cache hit triggers play once. Add leased player/subscription, optional Edit/Share, explicit Stop, fixed recovery and retained Atlas context. Back detaches the player without cancelling service-owned work. | D2 and proven renderer | Isolated screen/provider tests for cache hit/miss, double entry, actual play intent, unmount and foreground recovery. R6/R11/R18; physical first-frame proof still required. |
| D4 Complete optional editor | Product actions Replace/Add/Remove/Reorder, mapped to durable internal intent. Working/committed saves, Done regenerates affected chapters, reset and unique remap/conflict recovery. Failed kept media remains visibly unavailable instead of silently replaced. | R12-R14/R18/R21/R26-R28; restart retains replacements, removals do not reappear automatically, kept additions extend duration visibly and no source facts change. |
| D5 Deliberate sharing | Complete separate empty-first export selection/review. Reuse bytes only when exact selected manifest/digest/eligibility match; otherwise automatically render chosen output. Explicit review and current eligibility precede OS dispatch. CAP-4 stays separately gated to M4.5/M4.6. | D3-D4 | R10/R17 plus dispatch races/lease tests and physical native save/share. Private editing/watching never seeds or approves export. |
| D6 Acceptance | Run required checks, resolve findings/incidents, and record owner-operated Android+iOS tap/watch/edit/reopen/share and scheduled/expired/resumed preparation. | D1-D5 and platform S0 | R1-R18, AC-M4.7-1/2/3, quantitative budgets and device interactions. Missing platform evidence remains pending. |

### S0 evidence delta and automatic background preparation

S0 can proceed alongside host-only D0/D1 with synthetic data. Reuse valid recent
Android evidence; collect remaining codec/output/metadata/memory/disk/cancellation/
cleanup/share results on each platform. Keep installed versions unless a proven
failure requires a scoped change. No provider processing/private evidence upload.

Add a platform task gate: renderer initialization without React, current native
access, cross-runtime single-owner exclusion, expiration/settlement and relaunch.
Enable scheduled encoding only when those cases pass. Existing maintenance can
mark durable dirty intent before that gate. If the task runtime cannot encode
safely, checkpoint and resume automatically at the next permitted runtime;
record scheduled rendering as unmet, not passing. Foreground catch-up alone
does not prove background acceptance. Respect disabled maintenance and OS limits.

Prepare the default scope after committed changes and any active requested scope;
do not pre-render every filter. Coalesce revisions and prioritize active viewing.
App background pauses playback; encoding continues only under a proven native
execution lease. Otherwise cancel/settle, preserve dirty intent and automatically
resume later. Back/unmount merely detaches the player. Explicit Stop cancels its
requested job. Keep serialization until native work actually settles.

### Storage, identity and recovery

Read interaction-contract.md for concrete table contents, all-items versus explicit
selection behavior, rank ordering and fail-closed remap. Inspect the current schema
version before choosing the next migration number. Migrate idempotently with
retained-record/forward-version tests. Never persist session tokens, source URIs,
native errors or export approval. Draft data stays private in the local repository.

A render key binds private-record namespace, scope, committed draft revision,
projection/privacy/correction/access/source/lifecycle versions and format/renderer
versions. CAS prevents lost edits. Resolve unique stable successors only; withhold
ambiguous split/merge edits rather than guessing by label/date. Revalidate every
async boundary and publish/cache-reuse/export dispatch. Working editor revisions
never silently replace committed playback or sharing selection.

Retain at most two <=32 MiB verified private outputs with 24-hour idle expiry.
Job <=96 MiB, export copy <=32 MiB, total Replay cache <=192 MiB. Also enforce
>=128 MiB current free space, predicted remaining writes and a 32 MiB reserve.
Promote output atomically after inspection/digest/current-key validation. Startup
recovers native ownership and sweeps orphans; known registered output must pass
file/digest/key/current-eligibility checks before playback. No restored export
selection/approval. Evict only unleased files and clean after native settlement.

Failure preserves the committed Atlas, album and draft revisions. Privacy/access
loss immediately stops/withholds unsafe output; disconnect/delete-all also removes
drafts/cache after settlement. Rollback disables new admissions and disposes owned
derivatives; additive tables may remain inert, with no destructive DB downgrade,
reconstruction rerun or source deletion. Never substitute demo playback.

### Limits and completion checks

Feasible scopes must complete with one tap. Preserve full accounting, four
media/panel, P=sum(max(1,ceil(itemsPerTrip/4))), P<=25 and T=max(45,9+2*P).
P=26 remains scope-too-large with Edit scope. This plan does not promise
arbitrary-volume full-library success; longer/multiple videos or automatic
highlight sampling needs a later owner decision. No silent omission is inferred.

Measure acknowledgement, cache-hit first-frame, cache-miss first-frame,
edit-Done-to-first-frame and scheduled completion/expiration separately on real
devices. No invented ETA, completeness percentage or latency SLA. Record actual
build/device, safe aggregate counts, timings and pass/pending/fail evidence.

During implementation list tests using `npm --prefix apps/mobile test -- --listTests`.
New suites belong under src/components/__tests__/. Reuse established native video
mocks and asynchronous render helpers; isolate Replay screen tests if the shared
act harness remains unreliable. Use a quoted absolute repository-local Jest cache
for targeted verification. Verify persistence/remap/CAS with real SQL.

Run `npm --prefix apps/mobile run check` (Jest, real SQLite, TypeScript, lint,
Doctor), root `npm run check` and `git diff --check`; report each actual result
and pre-existing network/Doctor limitations. No reinstall to hide failures.
After S0, require owner click-and-wait on Android+iOS: Replay -> watch; Edit ->
Done -> regenerated watch; Back/reopen/restart -> edits retained; source/privacy
change -> safe refresh; Share -> separate choose/review -> deliberate native
handoff. Add native scheduled/expiration cases. Host checks cannot prove them.

### Active task checklist

- [ ] D0 Source/evidence baseline and discovered RED regressions.
- [ ] D1 Durable drafts/cache migration and real-SQLite safeguards.
- [ ] D2 Shared service, single-owner cancellation, dirty triggers and scheduling.
- [ ] S0 Missing native/platform evidence including scheduled preparation.
- [ ] D3 One-action player and retained Atlas context.
- [ ] D4 Optional persistent editor and safe remap.
- [ ] D5 Separate exact reviewed export and CAP-4 boundary.
- [ ] D6 Required checks, incidents and Android+iOS product evidence.

<frozen-after-approval reason="human-owned intent — draft revision requested 2026-10-22">

Historical baseline: the accepted owner amendments below and decision 0009 take
precedence over conflicting chronology, media sampling and preparation wording.

## Intent

Complete M4.7's private lifetime Replay and deliberate video export: chronological observed destinations and eligible memories, 30–60 seconds (target 45), silent 720p MP4, local preview/cancel, then exact selected native share. Preserve the optional separately confirmed selected-highlight handoff.

## Boundaries & Constraints

- Consume the canonical SPEC and all companions: selection-contract.md, renderer-contract.md and verification-contract.md define behavior and acceptance. Read the adopted decision/design documents too.
- Private Replay may use inferred facts with disclosure. Export selection starts empty and requires existing owner confirmation, per-memory eligibility and a freshly reviewed exact artifact.
- Keep qualified privacy, lifecycle, observed chronology and memory membership as independent gates; owner claims/manual entries never become observations.
- Respect measured resource ceilings, native settlement, file ownership and stale-generation disposal. No routes/duration/presence claims, audio, narration or synthetic history.
- Use fixed structured diagnostics only. Originals and private evidence stay local; native export does not publish. Hosting belongs to M4.5/M4.6 with the explicit CAP-4 handoff.
- Preserve installed data and dirty work; no source deletion, reset, Git publication or provider processing is part of this spec change.

</frozen-after-approval>

## Owner amendment (2026-10-22)

This newer direct owner instruction supersedes the frozen two-observed-destination
eligibility rule for CAP-1 implementation. Prepare Replay must source the current
policy-visible Journey List and include every currently available photo/video with
an effective confirmed, inferred, or owner membership of each selected trip. It
must not demand a new access confirmation, import, or reconstruction when those
trips are already visible. One visible trip with usable attached media is enough
to prepare a private Replay. Hidden/excluded/stale journeys and rejected,
unassigned, ambiguous, or unavailable media remain withheld. Journey List order
and date precision are presentation metadata, not an observed-chronology,
route, or presence claim. Read the updated canonical selection contract before
implementing; it supersedes conflicting frozen wording.

## Historical media-pipeline plan (2026-10-22)

Retained for provenance. The active 2026-10-23 plan above supersedes conflicting
D1-D6 sequencing, mandatory Prepare and ephemeral-only/no-schema assumptions.

**Planning complete; implementation and physical acceptance remain open.**
Decision 0009 now defines Journey List/album parity, automatic private preparation
and separate selected export. Read all four canonical companions, including
media-pipeline-contract.md. This is the single delivery record; D1–D6 below
supersede the older coarse task list, not its remaining acceptance obligations.

### Current evidence and gap

- Owner reports nine visible trips and zero usable attached memories. The exact
  device cause is unverified; do not infer private item counts from fixtures.
- Repository Replay SQL differs from the album, drops null capture days, and
  accepts only stored `available`. The provider does not run local access
  resolution for Replay, although the album resolves unknown items.
- `ReplayScreen.prepare` plans then opens export selection. It does not render
  a private preview. The production renderer deliberately throws unavailable;
  a truthy media-information result is not output validation.
- Android native module build/load response exists. Synthetic encoding, strict
  MP4 inspection, playback/export and physical iOS evidence remain pending.

### Dependency order and completion gates

| Slice | Concrete work | Exit evidence / dependency |
| --- | --- | --- |
| D1 Shared attachments | Extract correction/privacy-safe effective media pages in repository.ts; album and Replay both consume them. Preserve missing dates, kind and stable order; remove Replay's independent membership predicate and sentinel intervals. Add immutable scope snapshot, not mutable displayed-journey-map authority. | Real SQLite R1–R4, privacy/correction fixtures and unchanged album behavior. No reconstruction/migration required. First implementation slice. |
| D2 Local access | Extract platform-aware resolver from native-adapter.ts; use from album and Replay provider. Return one fixed result per candidate; validate original readability independently of thumbnail. Add opaque session handle/lease mapping, full page accounting and Replay operation guards. | Adapter/provider R4/R5/R8; Android no iOS-only API; unknown local items resolve; stale callbacks/handles withheld. Depends D1. |
| D3 Private preparation | Pass current Atlas filter/scope into Replay via opaque tokens; preserve Atlas context. Replace boolean availability-only planning with pending/resolved/fixed outcomes; auto-plan all scoped media. Implement 1–4 tile panel accounting and measured-budget preflight; explicit scope-too-large, no silent sampling. Add visible checking/composing/rendering/cancel/terminal states. | Selection/controller R3/R6/R7; isolated screen test proves Prepare does not enter export selection. Host fixtures may use renderer double, never claim playable device video. Depends D2. |
| S0 Native gate | Complete installed-candidate provenance and actual synthetic encode/inspect/play/share on each platform, including 1/25 panels and 26-panel refusal, layout readability, cancellation and limits. Keep existing versions unless evidence requires an approved scope change. | All native S0 fields in verification-contract.md; each platform's production integration waits for its passing gate. Can proceed independently of D1–D3 with synthetic data. |
| D4 Preview end to end | Wire materialized native handles, bounded compositor/encoder, strict stream/metadata/codec/duration/size inspection and digest to controller/player. Implement handle settlement, output/job leases, cancellation, invalidation and orphan cleanup. No fake success or getMediaInformation truthiness check. | Discovered renderer/controller tests plus physical R9 with real owner action; S0 platform pass prerequisite. Depends D3. |
| D5 Deliberate export | Separate empty-first journey/media/select-all controls after private preview; existing share eligibility, exact chosen render, review invalidation, fresh dispatch check and native share lease. Preserve optional CAP-4 interface with no automatic publisher invocation. | R10, exact artifact tests, physical native save/share and copy warning. Local export acceptance separate from M4.5/M4.6 integration. Depends D4. |
| D6 Delivery acceptance | Run required checks, close review findings and incidents, then owner click-and-wait on Android and iOS: album → scoped Prepare → wait → play/pause → cancel/retry → export select/review → native handoff → Atlas return. | R1–R10 and existing lifecycle/S0 matrix recorded; no completion with unrun iOS/native gates. Depends D1–D5. |

### File-level changes and test-first execution

1. `src/reconstruction/repository.ts`, `src/reveal/types.ts` as needed and
   `scripts/atlas-sqlite.test.cjs`: first add a fixture matching nine visible trips
   with unknown local assets and corrected/undated/mixed memberships. Demonstrate
   current failure; extract one effective query and paginated read. Assert album
   parity by internal identities in synthetic tests, not matching counts alone.
2. `src/photo-access/native-adapter.ts`, `types.ts`, `provider.tsx`: first cover
   aligned result slots, local URI versus original decode and access/generation
   races. Extract shared local resolution, then introduce per-job handles without
   putting source references into components or diagnostic payloads. Preserve
   repository/privacy serialization without holding it across OS work.
3. `src/replay/types.ts`, `selection.ts`, `controller.ts`: test full accounting,
   null precision, filter scope, limits and transitions; implement the companion
   contracts. Extend manifest binding from run-only to run/privacy/correction/
   access/source/lifecycle, exact media/fields and output digest. In-memory maps
   die with session cancellation/reconnect; startup never restores approval.
4. `src/components/replay-screen.tsx`, `atlas-reveal.tsx`, route/screen handoff:
   isolated async tests for immediate acknowledgement, no double-start, private
   playback, resource/access recovery and retained Atlas context. Use official
   Living Atlas composition and reduced-motion/large-text controls.
5. `src/replay/renderer.ts` and bounded native helpers: implement only after S0;
   test allowed native arguments, output inspection and cleanup faults. Enforce
   local-only inputs, one native owner, bounded decoding and fixed diagnostics.
6. Extend the four discovered replay suites and provider/media suites; add new
   tests only under `src/components/__tests__/`. Run Replay screen tests isolated
   with an absolute repository-local Jest cache until the act harness is repaired.

### Scope, data and rollback

This repair consumes existing reconstruction/membership rules; it changes no
recognition threshold or AI task. No model call, cloud download, broad permission
prompt, import, rebuild, availability backfill or schema migration is planned.
Keep existing committed journeys browseable while preparing. Preserve dirty
work and installed sources. If a schema change proves necessary, document its
specific need and add an idempotent migration plus retained-record tests first.

On runtime failure, dispose only job-owned derivatives after native settlement,
retain the committed Atlas/album, report the fixed reason and allow retry/return.
Unavailable native capability stays explicitly unavailable; do not fall back to
demo playback. Existing sharing/privacy controls remain enforced. Reverting the
new UI/adapter must not require deleting the private database or originals.

### Acceptance limits and unresolved technical evidence

The full-scope 30–60 second contract cannot promise arbitrary media volume.
The initial default allows four tiles/panel, at least two seconds/panel and at
most 25 panels, as derived in media-pipeline-contract.md; over-limit input keeps
its scope and offers explicit narrowing. This is an engineering assumption to
measure for readability, not owner approval of silent highlight sampling.
Video first-frame stills remain labelled; full-motion clips are not claimed.

No product decision is required to start D1–D3. Native provenance, encoder/output
behavior, maximum-layout readability and an available physical iOS environment
are technical evidence still to collect. A failing S0 retains the interface and
requires a proven native fallback or a specific recorded blocker. These are
implementation gates, not assertions of readiness.

## Historical first implementation gate

**S0 is defined but unrun.** The earlier unbounded renderer assumption is retired. Before integrating the production renderer, prove candidate versions/binaries, privacy-safe native logs, codec/output, limits, cleanup and file-sharing behavior on physical Android and iOS using synthetic inputs. See renderer-contract.md §S0.

A missing iOS environment or failing candidate is recorded as an unmet technical gate, with a native-adapter fallback or specific blocker. Host-only selection/controller work may proceed independently. Do not equate completed planning with successful native feasibility or full M4.7 acceptance.

## Code Map

Paths below are relative to apps/mobile/; new files are explicitly identified.

- src/reconstruction/repository.ts: share effective album attachment pages with Replay and current policy-visible scope; reuse privacy/correction helpers. The album's effective membership is authoritative; original decode/access is checked separately.
- src/photo-access/provider.tsx, src/photo-access/native-adapter.ts: materialization, access/correction/run generations, and the common privacy/lifecycle dispatch queue. Do not hold a DB lock while the OS share sheet is open.
- src/replay/types.ts, selection.ts, controller.ts, renderer.ts (new): private manifest, deterministic plan, fixed states, native adapter, exact output binding and export leases.
- src/reveal/types.ts, src/reveal/projection.ts: presentation-only coarse state; preserve honest restricted/processing/sparse paths.
- src/components/replay-screen.tsx (new), src/components/mobile-screens.tsx, src/components/atlas-reveal.tsx, src/app/replay.tsx: replace availability-only Replay and retain Atlas context.
- src/diagnostics/app-diagnostics.ts: fixed Replay operations/stages/outcomes, with no native or selection payload.
- package.json, package-lock.json, app.json: exact spike dependencies/config, then validated renderer integration; SDK57 expo-sharing for file handoff, current media-read permission posture retained.
- src/components/__tests__/replay-selection.test.ts, replay-controller.test.ts, replay-renderer.test.ts, replay-screen.test.tsx (new): discoverable tests. Extend existing reconciliation-repository.test.ts, photo-access-provider.test.tsx, owner-flow.test.tsx and atlas-reveal.test.tsx as needed.
- scripts/atlas-sqlite.test.cjs: actual SQL/current-run/privacy/order/membership tests. A mocked repository is insufficient.

## Tasks & Acceptance

Historical coarse checklist retained for traceability. Execute D1–D6 and S0 above
in dependency order; these replace conflicting old task descriptions.

- [ ] S0: in package.json/package-lock.json/app.json and this record, pin/inspect candidate inputs and create a synthetic native smoke path under src/replay/; record both-platform gate evidence before production adoption.
- [ ] src/replay/types.ts and selection.ts: implement Journey List scope, all eligible attached-media inclusion, presentation-only ordering, empty-first export and exact manifest; test one-trip, multi-trip, attachment and privacy boundaries first.
- [ ] src/reconstruction/repository.ts and provider/native adapter: read the policy-visible Journey List and effective confirmed/inferred/owner memberships without a new import/rebuild gate; cover real SQLite and asynchronous races.
- [ ] src/replay/renderer.ts and controller.ts: bounded native job, cancellation-before-ID, output inspection/digest, preview, export lease/startup cleanup and the documented transitions; implement candidate or proven native fallback only after S0.
- [ ] src/components/replay-screen.tsx and existing route/screen/Atlas files: Living Atlas private preview, subset/media choices, counts/omissions, correction recovery, reduced-motion/accessibility, explicit review/share and safe Atlas return.
- [ ] src/replay/types.ts and controller.ts: CAP-4 optional publisher interface gated on availability, exact highlight selection and fresh confirmation; preserve M4.5/M4.6 integrated acceptance.
- [ ] src/diagnostics/app-diagnostics.ts and discovered tests: closed diagnostic regressions and every Given/When/Then row in verification-contract.md.
- [ ] This record, docs/project-state.md and error-playbook: checks, actual owner/device evidence, pending gates and same-task incidents.

The Given/When/Then matrix and AC-M4.7-1/2/3 mapping in verification-contract.md are mandatory acceptance, not examples. Local export and optional hosted integration require separate evidence. Story completion still requires both-platform native acceptance.

## Implementation Notes

2026-10-22: Owner requested revision after review. No application/dependency/native changes in this revision. Candidate adoption, installed behaviors and budgets are unmeasured. Agent-selected policy defaults are recorded in the canonical spec/selection contract; no engine threshold changes.

## Spec Change Log

2026-10-22: Re-derived canonical CAP-1..3, added CAP-4 for the omitted publication handoff, and added selection/verification companions. Replaced generic eligibility/limits/export language with exact selection, ordering/membership, file-lifecycle, test-discovery and S0 contracts. Keep private inferred preview, privacy/correction gates, observed destination transitions and explicit separate sharing.

2026-10-22: Owner amended CAP-1 source scope from two strictly ordered observed destinations to the current policy-visible Journey List. One visible trip with usable attached media can prepare Replay; all eligible attached photos/videos enter the selected scope. Existing privacy and correction withholding remains, while Journey List order is explicitly presentation-only.

2026-10-22 media gap: updated accepted decision 0009 and re-derived CAP-1..4
contracts with shared album access, null-date retention, automatic private
preview, explicit full-scope fit limits and separate export. Added D1–D6 dependency
plan and R1–R10 acceptance; no application source/native changes in this task.

## Review Triage Log

Original review: review-m4-7-replay-spec-2026-10-22.md, retained as historical evidence. A1–A10/E1–E9 and structure findings map individually to the revised clauses in verification-contract.md. Resolution means specified, not implemented or independently re-reviewed.

## Verification

2026-10-23 adaptive sparse timing revision: root `npm run check` passes pinned
framework integrity, all 20 foundation tests and eval smoke. Direct documentation
checks pass nine companion paths, local links, stable CAP-1..5 intent/success,
R1-R28, Markdown-aware whitespace and six static24fps timing allocations;
`git diff --check` passes. First-slice/native/clip/background/curation acceptance
is still pending. No application code, dependencies, provider processing or
device work was changed/run in this planning task; quality stays not_measured.

2026-10-23 curated-chapter planning: root `npm run check` passes framework
integrity (44 skills/four runtime trees), all 20 foundation tests and eval smoke.
Document validation passes eight companion paths, local links, stable CAP-1..5
intent/success, R1-R24, direct generated-file whitespace and `git diff --check`.
Existing all-media/fixed-duration evidence is historical and does not verify the
new selector, chapter timing, real clips, long export or AI benefit. No application
source, dependencies, native runtime or private evidence processing changed in
this planning update. Product curation quality remains not_measured.

2026-10-23 one-action implementation planning: root `npm run check` passes
framework integrity (44 skills/four runtime trees), all 20 foundation tests and
eval infrastructure smoke. Direct document validation passes seven companion
paths, CAP-1..5 intent/success and stable IDs, D0-D6, R1-R18 and local Markdown
links. `git diff --check` passes; existing application files emit only line-ending
normalization warnings. Generated/untracked planning files are additionally
checked directly for whitespace. All application code/dependencies remain
unchanged by this planning task; mobile/native checks and physical product
acceptance are inapplicable to the documentation change and still pending for
implementation. No reconstruction-accuracy measurement is claimed.

2026-10-22 media-gap planning validation: root `npm run check` passes framework
integrity, 20 foundation tests and eval smoke; `git diff --check` passes. Direct
document validation passes all six canonical companion paths, local Markdown
links, CAP-1..4 intent/success, D1–D6 and R1–R10 coverage, source AC references,
retired-cap removal, exact frame budgets for P=1..25 and P=26 refusal. Mobile
runtime checks and device runs are inapplicable to this documentation-only task;
all implementation/device acceptance above stays pending. Recorded the uv-cache
recurrence/workspace-cache recovery and an atomic patch-context correction in
the error playbook.

During implementation: confirm all four new tests with npm --prefix apps/mobile test -- --listTests, run npm --prefix apps/mobile run check (Jest, real SQLite, typecheck, lint, Doctor), root npm run check and git diff --check. Record failures/limitations independently. Follow physical S0 and owner click-and-wait acceptance in verification-contract.md; missing iOS validation remains pending.

For this documentation revision: validate companion/context links, stable capability IDs, review/AC coverage and whitespace; run root npm run check. Runtime/native checks do not apply to unchanged application code.

2026-10-22 revision evidence: root framework integrity, 20 foundation tests and eval smoke pass. Companion links, CAP-1..4 intent/success shape, A1..A10/source-AC mapping, 2..12-scene timing bounds and whitespace checks pass. E1..E9 are traced in the verification companion. No runtime/device acceptance is inferred.
