# Implementation boundaries and diagnostic contract

## Delivery ownership

This folder is the single spec/delivery authority. Add implementation evidence to
its delivery record when build starts; do not generate a competing product plan.
No runtime implementation is performed by authoring this spec. Current dirty
account/onboarding work must be inspected again and preserved before editing.

| Source | Work |
| --- | --- |
| components/atlas-reveal.tsx | Separate shell, toolbar, summary/Details, view content, status and preview responsibilities; derive one display state |
| components/mobile-screens.tsx | Wire context for Home/Settings/Replay/edit; retain provider authority and account Add photos path |
| components/ui.tsx, trip-list-card.tsx | Add opt-in Atlas styling or wrappers; preserve global defaults |
| components/maplibre-atlas-map.native.tsx | Available-height layout and gesture release, existing cartography/provider restrictions |
| atlas/preview-context.ts, reveal/types.ts | Scoped in-memory query/list-anchor roundtrip and invalidation |
| photo-access/provider.tsx, reveal projection | Reuse authorized media/coverage; bounded affected-item read if needed |
| app/welcome.tsx, welcome-screen.tsx, navigation/app-contract.ts | Preserve explicit landing route and return; no onboarding changes |

Paths in this table are relative to apps/mobile/src. Reuse existing gallery,
sheet/list primitives and media loaders. Inspect installed capabilities before
adding a dependency; a new navigation/state framework is not required. A bespoke
Atlas shell may replace generic Screen's centered all-page ScrollView for this
screen only. Reserve footer space; never nest an unbounded list in that ScrollView.
Use lazy visible cover requests with bounded concurrency, cancellation and stable
keys. Permission/record changes fence all pending results. Theme variants must
not change shared cards in Replay/Share. Keep technical details out of UI copy.

## Ordered implementation slices

1. Shell and information hierarchy (CAP-1,2,8): Home/title/Settings, concise count,
   Details sheet, Atlas-scoped variants. Test semantic totals and explicit landing.
2. Exploration and actions (CAP-3,4,8): view-specific content, year selector,
   search, bounded Timeline, reachable Replay/Add journey, map recovery.
3. Preview and continuity (CAP-5,7): media-first preview, bounded overlap chooser,
   date/evidence details, context extension and all return routes/invalidation.
4. State arbitration and diagnostics (CAP-6 plus all fallible new boundaries):
   concise progress/recovery, affected review path, correlation/redaction tests.
5. Integration and native acceptance: long histories, text scaling, gestures,
   keyboard/safe-area behavior, failure fixtures and owner task walkthrough.

Slices are sequencing, not permission to ship an incomplete scope. Define the
diagnostic contract before behavioral edits, even for earlier slices.

## Diagnostic map

This documentation task adds no runtime event. The following new operation/stage
names are **proposed closed enum additions**, not claims they already exist.
Prefer an existing precisely matching boundary event when its semantics match;
record the final exact map before coding. Do not collapse known failures to UNKNOWN.

| Boundary / owner | Operation / stage | Closed reasons | Outcome and recovery |
| --- | --- | --- | --- |
| Native map load/style callback in MapLibreAtlasMap | ATLAS_MAP / MAP_STYLE | START, COMPLETE, MAP_STYLE_UNAVAILABLE, UNKNOWN | unchanged on load failure; Retry map once per action, Timeline always available |
| Selected preview → provider.loadJourneyDetail | ATLAS_PREVIEW / PREVIEW_READ | START, COMPLETE, ACCESS, SCHEMA, DATABASE_BUSY, NATIVE_HANDLE, UNKNOWN | unchanged; typed access denial restricts content, transient read allows Try again |
| Cover/poster load via existing authorized loader | ATLAS_PREVIEW / PREVIEW_MEDIA | MEDIA_ACCESS, MEDIA_UNAVAILABLE, MEDIA_DECODE, UNKNOWN | unchanged/restricted; fallback row, no bulk retry storm |
| Request invalidated by selection/authority/disposal | ATLAS_PREVIEW / PREVIEW_LIFECYCLE | LIFECYCLE, SKIPPED, RESTRICTED | skipped/restricted; no unexpected-error label or obsolete publication |
| Affected correction items read | ATLAS_REVIEW / REVIEW_READ | START, COMPLETE, ACCESS, SCHEMA, DATABASE_BUSY, UNKNOWN | unchanged/restricted; retry safe read or return to Atlas |
| Existing preparation and durable history reads | Existing ONBOARDING_RUN / ATLAS_DURABLE_READ / ATLAS_CATCH_UP and their precise existing stages | Existing typed categories | retain paused/unknown acknowledgement semantics; only presentation changes |
| Home/Settings/view/filter/Details local state | No new async diagnostic boundary | Not applicable | synchronous navigation; no private interaction telemetry |

If new async context persistence is proposed, stop that expansion and use the
in-memory contract; persistence is not required here. Gallery/Replay failures
remain with their existing owning boundary; forward the action correlation if a
new wrapper crosses it, do not emit duplicate generic terminal failures.

Create a local correlation for each owner preview/retry or map-load attempt and
carry it through loader/provider/native boundaries. Bounded background cover
batches use an ephemeral batch correlation without IDs, titles or coordinates;
deduplicate repeated identical failures within a batch. No per-item success logs.
Use reason/stage metadata on a typed closed error, never raw exception messages
in UI. UNKNOWN states the exact known boundary without asserting its cause.

## Collection and failure verification

Before native validation discover the currently installed package from app config
and selected device; record build/commit/bundle identity, platform and time window.
Verify current Metro bundle freshness when using the development client. Obtain
the current app PID, then collect only [Travel Life diagnostic] structured records
from that PID/time window, using a parser that outputs only the six allowed fields.
Do not dump raw logcat to the chat. Missing ADB, stale PID or incomplete records are
collection failures. Keep any necessary private raw diagnostic capture in ignored
.local paths; only synthetic/redacted fixed events enter the delivery record.
Use the failed correlation to locate the last stage and owning source above.
On iOS apply equivalent current-process filtering; unavailable device stays open.

Inject synthetic style failure, denied media, decode failure, busy/schema reads,
unknown error and stale completion. Assert operation/stage/reason/outcome and
same correlation across exercised layers; one terminal error, expected cancellation
not unexpected failure. Sentinel secret/URI/location/message/stack/ID values must
never appear in console payloads, accessibility labels or recovery text. Do not
send owner photos or records to model providers for validation.

## Required verification

- Root npm run check; mobile npm run typecheck, npm run lint and npm test -- --watch=false.
- Relevant actual SQLite tests if persistence/projection reads change; run existing
  mobile test:sqlite when that boundary is touched. No engine change is intended;
  if it becomes necessary, stop scope expansion and define evals per evals/README.md.
- Meaningful behavior tests and bounded-list instrumentation, not style snapshots
  alone. Read the error-playbook index and relevant recurrence lessons before work.
- Native acceptance matrix in acceptance.md, including screenshot/layout evidence
  with synthetic/authorized data and explicit owner walkthrough. Host pass is not
  native acceptance; no unavailable platform may be reported as passed.
