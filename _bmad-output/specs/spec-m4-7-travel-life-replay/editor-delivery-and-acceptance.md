# Replay visual editor delivery and acceptance

Derived 2026-10-24. Implements CAP-5 through the existing M4.7 D4 delivery record;
this is a companion, not a second backlog or standalone implementation claim.
Read editor-experience.md before using the checks below.

## Verified source baseline and gaps

| Existing surface | Reuse / gap |
| --- | --- |
| `apps/mobile/src/components/replay-screen.tsx` | One-action entry and current soundtrack/direction controls exist. Editor iterates flat eligible media into text buttons; no recognizable tiles/trip grouping. Selection is React state and save commits a full key array; richer working/commit semantics remain required. |
| `apps/mobile/src/components/journey-media-viewer.tsx` | Local paged three-column FlatList and photo/video inspection exist. Video cells currently show a generic placeholder; add actual local posters, checkbox semantics and an independent inspect action. Do not change normal See photos tap behavior while extracting shared primitives. |
| `apps/mobile/src/photo-access/provider.tsx` | Existing Journey media-page access is a useful boundary. Replay manifest load resolves all candidate previews; using it unchanged would retain the all-library resolution bottleneck. Separate editor metadata/page access from selected-original rendering. Parsing cost is not yet measured. |
| `apps/mobile/src/reconstruction/repository.ts` | Album membership, privacy checks and durable trip-plus-evidence references exist. Replay currently enumerates all candidates and uses positional session tokens; saveReplayDraft writes committed JSON. Add working revision/CAS and page-stable token mapping without breaking legacy drafts. |
| `apps/mobile/src/replay/types.ts`, `selection.ts` | Existing candidate-versus-selected plan and owner intent can seed the editor. Add per-trip explicit/automatic mode, trip inclusion, working revision and structured outcomes. Never infer selected state from available=true. |
| `apps/mobile/src/replay/controller.ts`, `renderer.ts` | Keep native ownership, output checks and durable prepared-artifact integration. Current whole-artifact reuse does not establish affected-chapter-only reuse or lifecycle-independent service ownership. |

Baseline is source-inspected, not physical visual acceptance. Re-read these files
at implementation start because concurrent Replay cache/music changes are active.
Preserve the recent prepared-artifact navigation/restart work; do not replace it
with another screen-local cache or start overlapping builds/device work.

## Proposed boundaries, not current APIs

Keep orchestration in the existing photo-access/replay service boundary and private
queries in the repository. Suggested responsibilities below may be implemented by
equivalent names; they are not claims of installed methods.

| Operation | Input / safe result |
| --- | --- |
| Open editor | Opaque Replay scope and expected versions -> draft revisions, paged trip summaries, effective chosen identity/order, short display metadata and fixed state. Does not decode all originals. |
| Load trip media page | Editor session, opaque trip key, snapshot-bound cursor, page limit -> stable item keys, selected intent, access state, page-local thumbnail/poster handles, next cursor and honest known/unknown total. |
| Apply working operation | Expected working revision + toggle/trip inclusion/order/music/reset/bulk intent -> new revision/acknowledgment or fixed stale/conflict/failure. Convert opaque display keys to stable private references only below the UI. |
| Commit | Expected base+working revisions and all freshness guards -> atomic committed revision and preparation intent, or recoverable conflict. No decode/native task inside the DB transaction. |
| Inspect/close | Current item/session -> leased local preview; pause/release on close/background and privacy invalidation. |

Grid components may receive only the local thumbnail/inspection handle needed to
display the current item; never raw library source IDs, repository reference
arrays or render-original URIs. Handles must be scoped, revocable and excluded
from persistence/diagnostics. Shared album queries remain the sole membership
authority. UI cannot create new source associations through selection.

Additive schema work follows the discovered native schema owner and version gate;
do not reserve a schema number here. Persist private namespace/scope, base and
working revisions, per-trip inclusion/mode, stable attachment intent/order,
soundtrack reference and direction. Keep canonical source references private.
Never persist transient display tokens, thumbnail URI caches or share approval.
Legacy kept/excluded/ordered reference arrays migrate without losing existing
intent; ambiguous old evidence-only mappings do not guess across trips.

Page cursors bind album/snapshot revision and stable sort. A page failure is not
an empty album; stale responses never attach to a different trip/session. Keep
native preview work bounded and cancel/ignore obsolete requests before applying
results. Revoke handles and clear rendered pixels on privacy/access invalidation.

Initial engineering tuning values: 48 metadata items per page, at most two active
thumbnail/poster resolutions, visible rows plus one-row prefetch. These are
starting assumptions to profile, not performance claims or limits on total album
eligibility. Tune for native memory/latency while preserving complete reachability.
Bulk operations can enumerate privately in bounded pages without retaining all
decoded thumbnails/frames or copying originals to the UI. Expensive original
resolution belongs to selected render sources, not editor entry.

## Implementation sequence inside D4

1. **D4.1 Identity and working state:** extend draft mode/inclusion/revision model;
   add legacy migration, CAS, rapid-tap ordering and restart tests. Establish
   current chosen-manifest identity before changing the screen.
2. **D4.2 Bounded gallery boundary:** page shared album candidates, produce local
   thumbnails/video posters, stable keys and fixed failures; complete trip-wide
   bulk accounting without visible-page-only shortcuts. Preserve See photos.
3. **D4.3 First visual slice:** paused saved preview + trip strip + one trip grid,
   direct toggle/inspect/return and reachable Done. Connect durable working saves
   and automatic commit preparation; then extend to multi-trip state and bulk Undo.
4. **D4.4 Secondary controls and continuity:** compact Music/Order, reset, native
   Back/swipe, navigation/restart, permission changes, conflict and render retry.
   Avoid a new gesture dependency until existing capabilities are assessed.
5. **D4.5 Verification and owner review:** execute E01-E16, required checks and
   physical Android/iOS walkthrough below; record unmet gates in the same record.

Do not defer persistence/privacy until after UI completion. Do not block the first
visual slice on implementing every background/cache optimization; explicitly
retain any unmet existing M4.7 service/native gates rather than claiming them done.

## Acceptance matrix

E IDs are local to this editor companion; existing R IDs remain stable.

| ID | Scenario and required result | Evidence / existing coverage |
| --- | --- | --- |
| E01 | Open Edit on a curated trip: photo/video are recognizable, checkmarks equal effective chosen output, candidates remain reachable; no all-library original resolve. | Screen + adapter spies; physical visual; R12/R18/R21 |
| E02 | Tap an unchosen tile then a chosen tile: exactly those intents change once, count updates, no render call. Done output includes addition and omits exclusion. | Screen/selector/controller; R12/R21/R26 |
| E03 | Inspect photo/video independently; no accidental toggle, no grid autoplay. Close returns to same trip/scroll and video pauses. | Screen + native video; R18 |
| E04 | Switch A/B and return; same asset attached to both has independent choices. Trip exclude/reinclude retains choices; album/evidence unchanged. | UI + real SQLite; R12/R14/R21 |
| E05 | Album spans 3+ pages and 1,000+ synthetic items: all reachable, stable keys, bounded mounted cells and at most configured thumbnail work. Late A page cannot replace B. | Paging/adapter deferred-response tests + native memory profile; R18 |
| E06 | Select all/Clear includes unloaded pages; unknown access resolved safely, counts exact when known, cancellation/stale/read failure applies no partial selection; Undo restores prior intent. | Repository/provider tests with unavailable and undated fixtures; R14/R21 |
| E07 | Clear media for an included trip: destination-only card, no auto-backfill. Exclude every trip: retain working state, disable Done and show one useful hint. | Planner/screen; R18/R25 |
| E08 | Rapid taps, pending save then Done, Back/swipe and cold restart: ordered durable work, commit once, working/committed stay distinct; failed writes never claim saved. | Deferred UI + real SQLite reopen/CAS; R12/R14/R28 |
| E09 | No-op Done encodes nothing; changed A retains safe B; reorder preserves safe chapter bytes where supported; previously prepared valid artifact is not deleted before replacement. | Service/cache/controller + durable reopen; R13/R27 |
| E10 | Commit succeeds then encode fails: saved choices retained, fixed Retry/Edit, retry uses same revision. Edit during preparation coalesces latest Done; obsolete output never promotes. | Deferred failure/race tests; R13/R15/R28 |
| E11 | Permission loss/hidden trip/source change while grid, inspector, bulk action or render is open: immediate pixel withholding, no stale save/output/share, fixed recovery. | Provider/controller fault tests + native permission flow; R14/R16/R17 |
| E12 | Failed explicitly kept media or ambiguous remap: visible unavailable/changed state without raw data, no silent substitution or successful partial output. Concurrent commit cannot overwrite newer draft. | Repository/selector/CAS tests; R14/R21/R26 |
| E13 | Change within-trip order/direction/music, cancel invalid file, confirm reset then Back/reopen: reset stays working until Done, committed output unchanged. Mute never re-encodes; source audio stays excluded. | Soundtrack spec suite + SQLite/UI; R12/R26 |
| E14 | Resolve/bulk/compose/verify with delayed promises: bar reflects actual phase, numeric percentage only when known, accessible coarse announcements, no false ready/100% completion. | Deferred UI/controller + native observation; R11/R18 |
| E15 | Enter Share after committed/private/working edits: separate empty-first selection and new exact review; no private draft or cached approval authorizes handoff. | Share/controller regression; R17 |
| E16 | Small portrait, landscape, large text, screen reader and reduced motion: recognizable controls/media, meaningful checkbox labels/state, reachable Done/Back, retained context, no instruction dependency. | Actual Android/iOS viewport and owner walkthrough; R18/R28 |

## Verification plan and completion record

Documentation verification now: stable CAP-1..5 with intent/success, existing
companions preserved, new companions/adopted soundtrack links resolve, source
claims preserved, Markdown whitespace, and root `npm run check`.

Implementation must inspect current package scripts before running checks. Current
commands are root `npm run check`; mobile `npm --prefix apps/mobile run typecheck`,
`npm --prefix apps/mobile run lint`, `npm --prefix apps/mobile run test:sqlite` and
focused Jest using `npm --prefix apps/mobile test -- --runInBand --cacheDirectory
.jest-cache-codex --runTestsByPath <discovered-test-path>`. Discover actual test
paths; use separate Replay screen/selection invocations if the shared act harness
recurs. Add tests for behavior/invariants above, not snapshots mirroring markup.
Run relevant existing gallery/provider/privacy/renderer/controller regressions.
These commands are a plan, not results for the new editor.

Physical owner walkthrough on both platforms:

1. Replay -> Edit -> recognize one photo and one video without explanatory prose.
2. Inspect one item, return, change selection in two trips, Done -> updated playback.
3. Return via Atlas, reopen Replay/Edit, then cold restart: saved composition and
   working edits remain distinct and the prepared artifact is reused when current.
4. Observe real progress through an update; retry one failure without lost edits.
5. Repeat navigation/selection with large text and a long trip album; verify that
   selection counts and output match, with no source-media deletion/album changes.

Record platform/build, viewport/font scale, synthetic or owner-operated fixture
scope, actual E/R results, screenshots or locally held review evidence, measured
entry latency/memory and unresolved limitations. No private media enters Git.
Targets: immediate acknowledgement on tap, grid usable before full album resolves,
and bounded work independent of total decoded album size; latency/memory remain
unmeasured until profiling. Owner recognition/self-navigation acceptance is not
inferred from tests or an agent-written walkthrough.

Open technical gates: safe local video-poster path, current-player chapter identity,
working-revision migration/CAS, service-owned preparation and per-trip reuse must
be verified during implementation. There is no blocking unresolved product choice;
layout/batch/drag defaults are documented assumptions, revisable on real devices.
