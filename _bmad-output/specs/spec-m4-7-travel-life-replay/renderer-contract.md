# Replay renderer contract

## S0: native feasibility before adoption

Evaluate the installed candidate munim-ffmpeg behind a Travel Life-owned adapter, with its required Nitro version and SDK-57-compatible Expo modules. Before production adoption, record exact package versions, lockfile integrity, upstream commit, binary checksums/provenance, platform minimums, build-size delta and distribution requirements. Use development builds; package documentation is not app compatibility evidence. Do not reinstall or upgrade as a substitute for missing S0 evidence.

S0 uses public synthetic inputs only. Prove physical iOS and Android render/playback/share, orientation/HEIC/content-URI behavior, metadata inspection, memory/disk limits and cancellation/cleanup using verification-contract.md. Check native/OS logs for seeded synthetic path/location canaries. No bridge callback may forward FFmpeg logs/session payloads to console/UI/telemetry. Construct argument arrays from a closed allowlist, accept only local inputs, and never interpolate labels/source names into executable filter syntax.

Discover and verify a platform H.264 encoder; prefer hardware. Fail closed if the required profile fails; no unreviewed software-codec fallback. Record codec/native distribution obligations before release; debug success is not distribution clearance. Candidate failure retains the owned interface and tests native AVFoundation/Android alternatives against the same gate. If no candidate passes, record renderer-unavailable and the specific platform blocker; do not adopt a full renderer or claim story completion. Independent host selection/controller work may continue.

Prior Android synthetic native encode evidence is recorded in project state, while current real-media product acceptance, export and iOS evidence remain incomplete. Reuse valid evidence with matching build/version scope; collect missing S0 measurements rather than calling the entire spike unrun. No new product permission is required for synthetic S0 during authorized implementation. Shared media-access work may proceed independently; production encoder integration waits for the relevant platform S0 evidence, and full M4.7 acceptance requires both platforms.

## Interfaces and private inputs

Source under apps/mobile/src/replay/: types.ts defines job tokens, private manifest, renderer handle, artifact handle and fixed outcome unions; selection.ts plans; controller.ts coordinates; renderer.ts owns native calls/file leases. The repository owns source references/observed intervals; the provider owns current access/lifecycle generations. Components receive coarse labels/counts, fixed status and an ephemeral player handle, never evidence IDs, raw timestamps, source references or native errors.

Bind the manifest to completed run, privacy revision, correction/access generations, selected groups/memories and coarsened fields. Bind output digest to the manifest; keep the private verified manifest binding in the local cache registry; export approval remains in-memory only. Random output filenames contain no place/date/source names. Revalidate after materialization, native completion and at dispatch. Changed labels, associations, corrections or permissions invalidate approval even without a new reconstruction run.

Decode currently local JPEG/PNG/HEIC with orientation applied, fit into 1280×720 with neutral letterboxing, strip source metadata. A video can contribute a validated selected 3-5 second clip; decode the chosen interval only under bounded native work. A labelled chosen still is the fallback when motion is unsupported, never a claimed clip. No output audio or new visit support. Unsupported, cloud-only, oversized and undecodable inputs produce omission counts/reasons. Do not download cloud media. Private scenes may remain destination-only; changed reviewed export content requires another exact preview/acknowledgement.

Create panels using existing local cartography/coarse anchors when available, otherwise labelled media/text. Fade between panels without route arcs or moving travel traces. Burn current corrected Journey List labels, month/year precision, inferred/confirmed/manual state and coverage into pixels; never promote owner-entered values to observations. Never screenshot the live Atlas with unrelated markers. Reduced motion suppresses autoplay when required by the accessibility policy and offers a static scene list with play/pause; disclose exported transitions before export. Follow curated chapter timing and selection in memory-selection-contract.md; do not use the retired all-media contact-sheet algorithm.

## Quantitative ceilings

Agent-selected ceilings must be measured in S0, not described as achieved. Do not silently raise them or reduce mandatory output requirements.

| Item | Required bound |
| --- | --- |
| Work | One process-wide job and native decode at a time; at most two full 720p frame buffers; no JS frame/base64 transfer |
| Plan | Every scoped trip retained, all candidate outcomes accounted for; curated adaptive sparse/normal chapters with no global25-panel cap |
| Output | 1280×720, 24 fps, H.264/yuv420p MP4; no audio/data/subtitle track or personal metadata |
| Timing | One still about4-6s, two about6-10s, normally15-20s with enough moments; titles/transitions included; exact24fps allocation; owner Keep overrides may extend a chapter visibly; total duration=sum(chapter durations) |
| Files | Derivative/frame <=2 MiB; staged still source <=32 MiB; chapter output <=32 MiB and job/intermediates <=96 MiB initially. Video sources may exceed32MiB: use bounded local reads/seeked segments, never stage a whole long original. Full export size follows measured storage admission, not a global32MiB cap |
| Storage | ≥128 MiB free at start; recheck remaining headroom before writes and during encoding; handle ENOSPC despite preflight |
| Memory | Incremental native working-memory peak ≤192 MiB over idle; check dimensions before raster allocation |
| Deadlines | Initial180s foreground per-chapter preparation/render ceiling; shorter native background deadline wins. No180s lifetime deadline. Cancel immediately; check native settlement within30s |

Count budgets before originals load; use native bounded decode/subsampling. Inputs which cannot fit are omitted before a full decode. Stream output inspection/digest. No guessed ETA or evidence-completeness percentage; progress may use actual frame work.

On timeout retain the slot/file ownership until native work settles. If cancellation has not settled within 30 s, expose fixed failure, ignore late results and reject new jobs until native termination or a new process; never release serialization or unlink a file still being written.

Before playback inspect actual codec, dimensions, fps, decodability, admitted size and duration within one frame of the exact chapter/assembled plan (adaptive sparse/normal chapters; no whole-Replay duration cap), zero audio/data/subtitle streams and allowlisted technical metadata only. Strip capture/location/source identifiers, absolute source dates and filenames; container timestamps are zeroed/non-personal. Failed inspection disposes output.

## Lifecycle transitions

| State/event | Required behavior |
| --- | --- |
| Replay entry + current cache/miss | Validate and play a ready artifact, or automatically capture generations and prepare |
| Preparing + valid inputs | Rendering; hold the one job slot |
| Rendering + verified current output | Preview-ready with playable local artifact |
| Preparing/rendering + explicit Stop or task expiration | Request cancellation, await native settlement; preserve resumable dirty intent where appropriate |
| Back/unmount/background | Detach/pause player; service work follows the proven native-lease policy in interaction-contract.md |
| Any pre-handoff state + privacy/access/correction/run/source/selection change | Stop/unload player, invalidate approval, cancel work and dispose; stale/private with recovery |
| Preview-ready + background | Pause/unload and invalidate export approval; retain verified private cache; foreground revalidates before playback |
| Private preview-ready + Share | Open separate empty-first selection; create/reuse exact selected bytes and require review before explicit Export |
| Reviewed export preview + explicit Export | Revalidate exact selected manifest under common privacy/lifecycle dispatch queue; lease copy and invoke share; exporting |
| Exporting + return/error | If still current, preview-ready with returned/failed guidance and retry; otherwise stale/private |
| Preview-ready + Export again | Revalidate and dispatch only on a new explicit action; no duplicate in-flight share |
| Cancelled/failed/stale + Retry | New capture/plan; never resurrect approval |

Cancel before session ID records intent and cancels that session as soon as its ID arrives. Do not globally cancel unrelated native work. Generation guards discard late results; clean files after handles settle. Missing native module yields renderer-unavailable with Atlas return.

The common provider queue covers final check plus dispatch, not waiting for the share sheet. Privacy changes winning before dispatch prevent it. After dispatch the OS may have copied the file: disclose that irreversible boundary, allow subsequent privacy actions without blocking behind the sheet and immediately stop the app player/approval. Never promise recall of an in-flight or saved copy.

## Storage and native export

Use verified app-private backup-excluded job/export cache directories. Delete failed/cancelled job files after handles settle; retain verified private output under the bounded cache policy rather than deleting it on preview dismissal. Startup recovers native ownership, wipes orphan jobs and validates registered private cache before reuse; never restore export selection/approval. Private drafts persist per interaction-contract.md. Disconnect/delete-all invalidates immediately and cleans files/leases when handles release, without claiming to erase OS/recipient copies. Cleanup failure leaves a fixed retry marker for next foreground/startup; do not claim deletion completed.

Native sharing uses SDK57 expo-sharing.isAvailableAsync() then shareAsync(localUri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' }); provide an iPad anchor when applicable. Unavailable API retains current preview and Atlas/retry with no network fallback. A void result means the sheet returned; say “Share sheet closed,” never “Video delivered.” Distinguish cancellation only when observable.

Do not add a direct Save-to-library button in this slice; the native sheet may offer Files/Photos. Verify a usable save/export destination on each platform. Keep existing read permissions and savePhotosPermission:false; a share sheet does not authorize broader media-write access. If no usable destination exists, AC-M4.7-3 fails until the adapter is corrected.

Create a separate private export copy with a lease before dispatch. Retain while the share promise is active, then until the next foreground cleanup opportunity after handoff; hard expiry 24 h and startup sweep prevent indefinite copies. Never delete merely because the Replay screen closes. S0 must prove delayed recipient reads under this boundary. If the SDK cannot guarantee that, stage an OS-owned copy through the native adapter before its promise resolves; acceptance stays failing until verified. Hard expiry/startup never overrides an active native handle in the same process; stop/cancel that owner first, then unlink. Already handed-off OS copies are outside local cleanup guarantees.

## Optional selected-highlight handoff

CAP-4 is a separate “Attach to selected highlight” action, available only with M4.5 service and M4.6 video playback capability. The export selection must equal the highlight's approved coarse fields/media subset; otherwise offer a new selection/preview. Never widen the highlight or auto-upload a private Replay. Revalidate and require a fresh publish confirmation.

M4.7 supplies a short-lived artifact lease, sanitized manifest/digest and current eligibility. M4.5 takes durable ownership of the sanitized derivative/pending operation, authentication, size/metadata policy, snapshot version/expiry/revoke and offline deletion. M4.6 verifies authorized playback. If absent, report publishing unavailable without blocking native export. Fake publisher tests do not complete hosted acceptance.

## Sources

[Expo SDK 57 Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) specifies native local-file handoff. [Candidate upstream](https://github.com/munimtechnologies/munim-ffmpeg) is evidence to verify at the exact locked revision during S0, not a platform result.

## Interaction amendment precedence (2026-10-23)

Read interaction-contract.md for durable drafts/cache, task ownership and automatic playback. The foreground180s ceiling now applies per chapter; background task deadlines may be shorter and must expire safely. Long chosen export has separately measured progress, storage and cancellation deadlines. Reuse existing codecs only after provenance/output gates; new UI behavior never waives native acceptance. Cache retention does not retain export approval.

## Chapter sequence and exact long export (2026-10-23)

memory-selection-contract.md is authoritative for adaptively timed curated trip
chapters, conditional real-motion video and optional visual AI. Render/verify
chapters serially and progressively play every scoped trip; buffer rather than
skip unfinished chapters. Inspect/lease each file and check the immutable chapter
key on transition. Chapter caching is bounded and source/privacy-safe.

Whole chosen export must stream/remux or boundedly encode the exact reviewed
chapter sequence into one verified silent720p file. This is a separate native
gate from sequence playback. Measure whole-file storage/headroom/OS share limits;
never truncate, secretly split or force scope narrowing just because total
playback exceeds60s. Explain genuine storage failures and retain owner selection.
Keep native argument allowlists, numeric interval validation, metadata stripping,
no raw logs, single-owner settlement and explicit export review throughout.
