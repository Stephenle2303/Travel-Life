# Replay visual editor delivery and acceptance

Derived 2026-10-24. Implements CAP-5 through the existing M4.7 D4 delivery record;
this is a companion, not a second backlog or standalone implementation claim.
Read editor-experience.md and trip-first-editor-contract.md before the checks below.

## Current source baseline and owner-reported regressions

Owner reports Bali zero-selected/missing album choices, incomplete Taiwan media,
clipped buttons and ambiguous trip/global completion. The existing implementation
already has grids, working drafts/CAS, v36 storage and preview paging; earlier
flat-button-only source descriptions are historical and superseded here.

Confirmed paths: replay-screen filters available before resolving unknown preview
candidates and passes only the filtered array to later page requests; initial
preview resolution is lifetime-global 48; page errors have no visible retry;
bulkActions is a nonwrapping six-button row. Replay and See photos use different
membership queries. Prepared output stores a count without authoritative stable
rendered selection, while editor counts replan from partial availability.
The prior nested-scroll runtime repair does not establish completeness/usability.
Exact Bali/Taiwan record causes still require local owner-operated comparison.

Preserve working/committed storage, native ownership, soundtrack/order and cache
changes. The approved [trip-first contract](trip-first-editor-contract.md) supplies
the new navigation, candidate states, album reader and output identity contract.
Do not start concurrent builds/Metro or replace existing work with a new cache.

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
3. **D4.3 Trip-first UI:** overview -> trip gallery -> Done/Back -> overview,
   fixed safe-area actions, direct toggle/inspection, per-trip continuity and
   scoped overflow. Connect acknowledged working saves; no trip-level encoding.
   Overview Update Replay alone applies the aggregate revision once.
4. **D4.4 Secondary controls and continuity:** compact Music/Order, reset, native
   Back/swipe, navigation/restart, permission changes, conflict and render retry.
   Avoid a new gesture dependency until existing capabilities are assessed.
5. **D4.5 Verification and owner review:** execute E01-E40, required checks and
   physical Android/iOS walkthrough below; record unmet gates in the same record.

Do not defer persistence/privacy until after UI completion. Do not block the first
visual slice on implementing every background/cache optimization; explicitly
retain any unmet existing M4.7 service/native gates rather than claiming them done.

## Acceptance matrix

E IDs are local to this editor companion; existing R IDs remain stable.

| ID | Scenario and required result | Evidence / existing coverage |
| --- | --- | --- |
| E01 | Open Edit on a curated trip: photo/video are recognizable, checkmarks equal effective chosen output, candidates remain reachable; no all-library original resolve. | Screen + adapter spies; physical visual; R12/R18/R21 |
| E02 | Tap an unchosen tile then a chosen tile: exactly those intents change once, count updates, no render call. Update Replay output includes addition and omits exclusion. | Screen/selector/controller; R12/R21/R26 |
| E03 | Inspect photo/video independently; no accidental toggle, no grid autoplay. Close returns to same trip/scroll and video pauses. | Screen + native video; R18 |
| E04 | Switch A/B and return; same asset attached to both has independent choices. Trip exclude/reinclude retains choices; album/evidence unchanged. | UI + real SQLite; R12/R14/R21 |
| E05 | Album spans 3+ pages and 1,000+ synthetic items: all reachable, stable keys, bounded mounted cells and at most configured thumbnail work. Late A page cannot replace B. | Paging/adapter deferred-response tests + native memory profile; R18 |
| E06 | Select all/Clear includes unloaded pages; unknown access resolved safely, counts exact when known, cancellation/stale/read failure applies no partial selection; Undo restores prior intent. | Repository/provider tests with unavailable and undated fixtures; R14/R21 |
| E07 | Clear media for an included trip: destination-only card, no auto-backfill. Exclude every trip: retain working state, disable Update Replay and show one useful hint. | Planner/screen; R18/R25 |
| E08 | Rapid taps, pending save then Update Replay, Back/swipe and cold restart: ordered durable work, commit once, working/committed stay distinct; failed writes never claim saved. | Deferred UI + real SQLite reopen/CAS; R12/R14/R28 |
| E09 | No-op Update Replay encodes nothing; changed A retains safe B; reorder preserves safe chapter bytes where supported; previously prepared valid artifact is not deleted before replacement. | Service/cache/controller + durable reopen; R13/R27 |
| E10 | Commit succeeds then encode fails: saved choices retained, fixed Retry/Edit, retry uses same revision. Edit during preparation coalesces latest Update Replay; obsolete output never promotes. | Deferred failure/race tests; R13/R15/R28 |
| E11 | Permission loss/hidden trip/source change while grid, inspector, bulk action or render is open: immediate pixel withholding, no stale save/output/share, fixed recovery. | Provider/controller fault tests + native permission flow; R14/R16/R17 |
| E12 | Failed explicitly kept media or ambiguous remap: visible unavailable/changed state without raw data, no silent substitution or successful partial output. Concurrent commit cannot overwrite newer draft. | Repository/selector/CAS tests; R14/R21/R26 |
| E13 | Change within-trip order/direction/music, cancel invalid file, confirm reset then Back/reopen: reset stays working until Update Replay, committed output unchanged. Mute never re-encodes; source audio stays excluded. | Soundtrack spec suite + SQLite/UI; R12/R26 |
| E14 | Resolve/bulk/compose/verify with delayed promises: bar reflects actual phase, numeric percentage only when known, accessible coarse announcements, no false ready/100% completion. | Deferred UI/controller + native observation; R11/R18 |
| E15 | Enter Share after committed/private/working edits: separate empty-first selection and new exact review; no private draft or cached approval authorizes handoff. | Share/controller regression; R17 |
| E16 | Small portrait, landscape, large text, screen reader and reduced motion: recognizable controls/media, meaningful checkbox labels/state, reachable Update Replay/Back, retained context, no instruction dependency. | Actual Android/iOS viewport and owner walkthrough; R18/R28 |
| E17 | Enter Edit before first chosen manifest: browse/inspect work; checkmarks show pending, mutations/Update Replay wait only for valid planning snapshot, retry/stale completion never freeze empty choices. | Deferred planner/provider/screen; R11/R12/R18 |
| E18 | Selected video uses a nonzero interval; inspector plays exactly that interval and stops at its end. Original is separate; new/changed intervals remain pending until validated. | Manifest/inspector tests + native clip observation; R22/R26 |
| E19 | Selected items lie beyond initial pages; selected-count view finds them, deselect preserves focus/count and All anchor. Optional searchable Trips jump reaches a distant trip without losing edits or network access. | Large synthetic multi-trip paging + unassisted owner; R18/R21 |
| E20 | Restore Auto affects only current included trip and is reversible; excluded trip shows inactive checks and disables content mutations until reinclude. Direction, music and other trip edits survive. | UI/SQLite/selector; R12/R14/R21 |
| E21 | Ambiguous remap or conflicting revision opens Review changes. Safe unique operations reapply; Choose again/Discard edit/Use mine/Use latest resolve the rest without stale private pixels. Update Replay remains blocked until resolved, Back retains branch, discard-local confirms loss. | Concurrent/stale/privacy repository and screen tests; R14/R16/R21 |
| E22 | Add many media/Select all: visible honest chapter-length estimate or calculating state; no silent omissions. Owner independently finds trip, recognizes selected photo/video, inspects used clip, edits and finishes without coaching. | Planner timing + observed Android/iOS task; R18/R26/R28 |

## Trip-first acceptance extension

E01-E22 retain their original selection/persistence/privacy intent, with their
commit action now named Update Replay. Gallery Done is navigation plus working
acknowledgment, tested separately below. Do not count old passing tests as new
acceptance without verifying these changed boundaries.

| ID | Scenario and required result | Required evidence |
| --- | --- | --- |
| E23 | Enter Edit, open A, toggle, Done, open B, toggle, Done: overview shows both edits; Done calls working saves only, zero commit/render invocations. | Deferred screen/service + real SQLite. |
| E24 | Update two edited trips: exactly one aggregate CAS commit/job, actual output matches both; duplicate taps/restart join target operation. | Service/repository idempotency + native manifest/pixels. |
| E25 | Bali-like populated album with zero selected: All opens all permitted members, unknown placeholders resolve, selection count is not confused with album count. | Unknown-access fixture + owner Bali comparison. |
| E26 | Taiwan-like 75+ and 1,000-item albums, unknown media beyond page one/later trips: all eligible candidates reachable; selected late-page item survives reopen/output. No first-48 cap. | Paging/provider/SQLite + owner Taiwan comparison. |
| E27 | Shared-reader parity: effective corrections, all attachment variants, undated, rejected/unassigned/moved-away, hidden and excluded fixtures. Review-only membership explained, never output-eligible. | Shared album repository + privacy regression. |
| E28 | Selected identity beyond loaded All pages appears in trip Selected; pending selection plan never displays false unchecked/zero. Known album totals independent of thumbnail count. | Deferred page/manifest/UI fixtures. |
| E29 | Initial/page/thumbnail failure has Retry; loaded content persists. Retry has no skipped/duplicate page; stale cursor, late A result while B active cannot overwrite/revive media. | Deferred request/cursor/privacy tests. |
| E30 | Same trip navigation/inspection restores tab/anchor/pages; different trips retain independent state. Native Back/swipe and Done return to overview; overview Back returns saved player. | UI plus Android/iOS navigation. |
| E31 | Pending/failed working saves then Done/Back: acknowledgment before leaving, no false Saved; Retry retains latest intent; explicit discard confirms loss; restart restores acknowledged edits only. | Deferred writes + real SQLite reopen. |
| E32 | 320/360/390 widths, landscape and large text: complete buttons, long trip title, fixed safe-area header/footer, no overlay-hidden last tile, 48dp targets and one vertical scroll owner. | Actual viewport captures and bounds/focus inspection on both platforms. |
| E33 | Select all beyond loaded pages with unavailable/unknown members: complete bounded enumeration and honest progress; cancel/failure/stale/conflict applies none; successful usable selection and unavailable counts truthful. | Repository/provider/controller faults + native behavior. |
| E34 | Explicit empty included trip remains card-only and album navigable; exclude/reinclude retains choices; zero included blocks Update; no-op/reverted edits disable Update and encode nothing. | Planner/UI/SQLite/cache reuse. |
| E35 | Stored verified manifest, renderer-adjusted video intervals and rendered IDs survive reopen; resolving thumbnails changes neither committed checkmarks/counts nor valid video cache identity. | Durable manifest round-trip + provider/inspector integration. |
| E36 | Legacy exact identity recoverable vs count-only ambiguous: validate/migrate without render; ambiguous selection has Review selection and never guessed checks; previous safe video retained; adoption renders only at explicit Update. | Real SQLite upgrade/legacy fixtures + UI. |
| E37 | Update render/verify fails after commit: saved edits remain, older permitted video clearly labelled; Retry same revision, successful replacement atomically promotes, obsolete result withheld. | Service/controller crash/failure + native file/manifest checks. |
| E38 | Source/privacy change in gallery, inspector, bulk, conflict or update: immediate withholding/revalidation; safe remap or choose-again; Use mine cannot restore private targets. Reload never discards branch silently. | Lifecycle/privacy/CAS regression + native permission action. |
| E39 | Music/order change plus two trip edits: trip Done never applies soundtrack; settings Back retains it; Update uses exact aggregate values. Player mute no encode; selected-only sharing remains separate and empty-first. | Audio/order/provider/share regression + real output listening. |
| E40 | Owner without coaching opens Bali, finds photo, changes selection, Done, opens Taiwan, reaches later-page video, inspects used segment, Done, Update, watches, reopens/restarts. Record wrong turns/assistance/latency and verify both edits. | Unassisted physical Android and iOS evidence; unresolved issue leaves acceptance open. |

## D4 implementation order for this amendment

1. Re-read dirty source/schema and preserve current work. Unify policy-aware album
   reader and add parity/unknown/page-boundary regressions (E25-E29).
2. Add verified rendered-selection/interval registry with safe legacy upgrade;
   separate ready/pending selection and trip page states (E28/E35/E36).
3. Build overview/gallery using approved mock and actual responsive geometry;
   hook acknowledged working Done/Back and fixed scoped actions (E23/E30-E32).
4. Connect complete bulk actions, inclusion/Auto/Undo and recovery; aggregate
   CAS/idempotent Update and safe replacement/cache reuse (E24/E33/E34/E37/E38).
5. Regress soundtrack/order/inspection/sharing and execute E01-E40 with existing
   R gates. Obtain E40/Bali/Taiwan and viewport evidence; do not stop at host green.

## Verification plan and completion record

Documentation verification now: stable CAP-1..5 with intent/success, existing
companions preserved, new companions/adopted soundtrack links resolve, source
claims preserved, Markdown whitespace, and root `npm run check`.

Implementation must inspect current package scripts before running checks. Current
commands are root `npm run check`; mobile `npm --prefix apps/mobile run typecheck`,
`npm --prefix apps/mobile run lint`, `npm --prefix apps/mobile run test:sqlite` and
focused Jest from the apps/mobile working directory using `npx jest --runInBand
--cacheDirectory .jest-cache-codex --runTestsByPath <discovered-test-path>`. Discover actual test
paths; use separate Replay screen/selection invocations if the shared act harness
recurs. Add tests for behavior/invariants above, not snapshots mirroring markup.
Run relevant existing gallery/provider/privacy/renderer/controller regressions.
These commands are a plan, not results for the new editor.

Review-resolution coverage is E17-E40 plus E08/E13 for working music on Back.
Before marking UX accepted, run the owner task unassisted: no explanatory prompts
after the task goal. Record completion, wrong turns, accidental toggles, assistance
needed and confusion. Any needed coaching or unresolved confusion leaves self-serve
acceptance open; change the design and repeat the task. A coached walkthrough is
useful diagnosis but does not substitute for this acceptance.

Physical owner walkthrough on both platforms:

1. Replay -> Edit -> recognize one photo and one video without explanatory prose.
2. Inspect one item, return, change one trip, Done -> overview; change another,
   Done -> overview; Update Replay -> exact updated playback.
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
