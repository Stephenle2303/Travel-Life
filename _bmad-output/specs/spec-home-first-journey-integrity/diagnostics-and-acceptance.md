# Diagnostics and acceptance

## Diagnostic contract

This is a planning delivery. Runtime stages below are the implementation
contract. Reuse existing fixed names where available. Introduce only the
listed narrow distinctions when absent. Carry one local correlation from the
action through controller, repository, adapter and applicable worker stages.
An independently resumed update gets a new action correlation and uses the
existing private command receipt for continuity. Log start and terminal
outcomes at stalled boundaries. Do not log per-photo or per-edge loops.

| Operation and stage | Closed reason and durable handling | Owning boundary and next check |
| --- | --- | --- |
| `ONBOARDING_ENTRY / ENTRY_READ` or `HOME_SETUP_READ` | `SCHEMA`, `DATABASE_BUSY` or `UNKNOWN`. Keep presentation unchanged and retry the read. | `resolveEntry`. Use `ENTRY_READ` for the existing presentation store and `HOME_SETUP_READ` for the private SQLite decision. |
| `ONBOARDING_SETUP / HOME_AREA_SELECT` | `SKIPPED` for cancel, `MAP_STYLE_UNAVAILABLE` for unusable map, `CONSTRAINT` for invalid area/date. Unchanged or skipped. | Offline picker and form. Open the coordinate alternative or show field validation. |
| `ONBOARDING_SETUP` or proposed `HOME_BASE_SAVE / HOME_SCOPE` | `LIFECYCLE`, `HISTORY_FENCED` or proposed `HISTORY_VERSION_UNSUPPORTED`. Blocked. | Home command validation and `record-context.ts`. Verify bound history, current owner and peer capability. |
| Same operation / `HOME_COMMAND_VALIDATE` | `CONSTRAINT` or `HISTORY_CONFLICT`. Unchanged. | Repository area validation or expected row/command mismatch. Re-read current values before retry. |
| Same operation / `HOME_COMMAND_COMMIT` | `DATABASE_BUSY`, `TRANSACTION`, `SCHEMA` or `UNKNOWN`. Preserve known transaction outcome. Reconcile ambiguous writes. | Native writer and Home receipt transaction. Verify exact receipt before another attempt. |
| Same operation / `HOME_COMMAND_READBACK` | `COMPLETE`, `HISTORY_CONFLICT`, `HISTORY_FENCED` or `UNKNOWN`. Complete only on exact receipt, unknown if unavailable. | Command reconciliation and presentation resume. Keep Check again when unresolved. |
| `ATLAS_REBUILD / HOME_REBUILD_QUEUE` | `ALREADY_RUNNING`, `PAUSED`, `LIFECYCLE` or `DATABASE_BUSY`. Keep latest pending revision when authorized. | Reconstruction controller and maintenance writer admission. Check admitted/pending status, then read snapshot tuple. |
| `ATLAS_REBUILD / HOME_CONTEXT_READ` | `ACCESS`, `SCHEMA`, `DATABASE_BUSY` or `UNKNOWN`. Keep current eligible projection and pending intent. | Snapshot of evidence and effective Home context in repository. Distinguish absent valid homes from read failure. |
| `ATLAS_REBUILD / REBUILD_CONTINUITY` and `REBUILD_MEMBERSHIP` | `JOURNEY_REMAP`, `OWNER_REVIEW` or `UNKNOWN` at the exact stage. Preserve reviewed state. | Shared projection, continuity, association and correction guards. Use one debug edge inspection for a selected boundary. |
| `ATLAS_REBUILD / HOME_PROJECTION_COMMIT` | `HISTORY_STALE`, `HISTORY_FENCED`, `TRANSACTION`, `DATABASE_BUSY` or `UNKNOWN`. Stale skips. Reconcile unknown acknowledgement. | Generation publication CAS and current request. Check durable revision after settle. |
| `ATLAS_DURABLE_READ / HOME_PROJECTION_READBACK` | `COMPLETE`, `HISTORY_STALE`, `ACCESS` or `UNKNOWN`. Keep previous eligible result until verified. | `loadPublishedRun` / durable reveal and provider publication. Validate generation and eligibility again. |
| `ATLAS_PREVIEW / PREVIEW_READ` | `HISTORY_STALE`, `ACCESS`, `DATABASE_BUSY` or `UNKNOWN`. Discard a stale request. | `loadJourneyDetail` and `loadJourneyMediaPage`. Compare run, privacy and active scope. |
| `ATLAS_PREVIEW / PREVIEW_MEDIA` | `MEDIA_UNAVAILABLE`, `MEDIA_ACCESS`, `MEDIA_VERIFY` or `HISTORY_STALE`. Withhold failed slots. | Provider and native/account adapters. Verify exact slot and asset binding. Preserve valid neighbors. |
| Proposed `JOURNEY_MEDIA_INSPECT / MEDIA_ASSOCIATION_CHECK` | `COMPLETE`, proposed `MEDIA_ASSOCIATION_MISMATCH`, `HISTORY_STALE` or `UNKNOWN`. Read only. | Selected slot against committed journey graph and privacy revision. |
| Same operation / `MEDIA_ORIGINAL_CHECK` | `COMPLETE`, proposed `MEDIA_METADATA_MISMATCH`, `MEDIA_ACCESS`, `MEDIA_UNAVAILABLE` or `UNKNOWN`. Read only. | Exact on-device source handle/current metadata, or verified account derivative mapping. |
| Same operation / `MEDIA_SLOT_CHECK` | `COMPLETE`, proposed `MEDIA_ASSET_MISMATCH`, `MEDIA_VERIFY`, `HISTORY_STALE` or `UNKNOWN`. Read only. | Adapter-to-slot and renderer/cache identity check. An unobservable identity remains unknown. |
| `HISTORY_TRANSFER / HOME_POLICY_COMPATIBILITY` and existing merge/restore fences | `HISTORY_VERSION_UNSUPPORTED`, `HISTORY_STALE`, `HISTORY_REVIEW` or precise existing stage failure. Block or keep previous compatible replica. | Client negotiation, worker wire validation, domain/checkpoint compatibility and replica activation. Verify before sync or apply. |

For an explicit development-only continuity inspection, compare one chosen
boundary in the active committed generation and its candidate recomputation.
Use proposed `JOURNEY_BOUNDARY_INSPECT / EPISODE_EDGE_CHECK`. Emit a single
closed outcome from `EDGE_LINK_EXACT`, `EDGE_LINK_CIVIL`,
`EDGE_LINK_KNOWN_AWAY`, `EDGE_HOME_RETURN`, `EDGE_GAP`,
`EDGE_OWNER_BOUNDARY`, `EDGE_CONFLICT`, `EDGE_UNCERTAIN`,
`HISTORY_STALE` or `UNKNOWN`. The inspection reads current evidence and
does not change history. A legacy generation without a decision trace yields
a comparison against the executable baseline. Do not claim historical
branch evidence that was never persisted.

Use only `app-diagnostics.ts` as mobile console boundary. Keep fixed
operation, stage, reason, retryability, durable outcome and local correlation.
At the worker use its own equivalent closed logger. No content, raw
exceptions, IDs, coordinates, private dates, paths, hashes or media leave
the on-device checks. A telemetry-only trace does not authorize source reads.

### Collection recipe

1. Verify the current Android build and package `com.anonymous.travellife`,
   foreground process and current provider/consumer history scope. On iOS
   resolve the current bundle/process from app configuration and current
   runtime. Verify the build includes the intended diagnostic gates.
2. Use a test history and reproduce failures before touching the owner case.
   Use filtered process logs or the authorized device console. Select only
   the closed fields for the operations above and correlate the run. Do not
   export raw logs, databases, photos or per-asset references.
3. On the affected phone use the same history and generation. For continuity,
   compare the reported adjacent fragments through a private read-only
   candidate run with the owner-identified holiday and distinct-trip controls.
   For media, have the owner open the exact affected image in the cover or
   album, opt into the scoped development inspection, then compare the exact
   association, original and rendered slot locally. Compare both surfaces
   when available. Retain only redacted classifications and aggregate
   acceptance evidence in this delivery record.
4. Treat a disconnected device, missing original or unavailable metadata as
   the specific collection limit. Keep the incident open where evidence
   cannot distinguish causes. A test fixture cannot close a physical case.

## Acceptance matrix

| ID | Capability | Case and expected result |
| --- | --- | --- |
| AC-01 | CAP-1 | Fresh install can choose two independent circles with the same or different periods. No photo or location permission, scan, rebuild or Home picker network call occurs before the existing photo choice. |
| AC-02 | CAP-1 | Skip Home, then choose photos. Exactly one authorized initial run starts. Skip both steps and Atlas opens without source intent. |
| AC-03 | CAP-1 | Terminate before save, after SQLite commit, after presentation acknowledgement loss and after skip. Resume the appropriate step, with one exact receipt and no duplicate Home or source action. |
| AC-04 | CAP-1 | Returning use, deep link, restore, Welcome from Atlas and legacy started setup follow existing authorization and routing rules. Existing pending import resumes. |
| AC-05 | CAP-1 | Permission denial, limited permission, picker cancel and unavailable map retain the Home decision. Offline area entry and Skip are usable. |
| AC-06 | CAP-1, CAP-2 | No trip exists. Settings can add, name, edit and remove an area. Invalid coordinates, reverse dates, and unsaved draft discard follow the specified UX. |
| AC-07 | CAP-2 | Legacy unnamed areas, nondefault radii and exact-day endpoints survive migration. Names and scope display correctly. Rename keeps geometry and existing eligibility. |
| AC-08 | CAP-2 | Double tap, busy writer, late commit acknowledgement and two scope edits during a rebuild preserve exact receipts and coalesce to the newest effective revision. |
| AC-09 | CAP-2 | Restart with pending update, revoked access, deletion or scope change. Only an authorized current job resumes. A stale job cannot publish or clear a successor. |
| AC-10 | CAP-2 | Failed rebuild and valid empty rebuild take different paths. Failure keeps eligible prior Atlas and a truthful retry. Empty current generation clears its request after readback. |
| AC-11 | CAP-2, CAP-6 | Local has no areas and Account has two. Home reads, writes, gallery and rebuild use the displayed authority. Incompatible Account edits expose their actual state. |
| AC-12 | CAP-3 | Definite in-scope photos from two bases are excluded from automatic trip count, facts, map, cover, album and new Replay. Away photos in the same day/window remain eligible. |
| AC-13 | CAP-3 | Test radius boundary, accuracy interval crossing, missing GPS, invalid dates, weak GPS and an eligible photo before/after the active period. No unsupported Home or away claim is introduced. |
| AC-14 | CAP-3 | Test photos and video, duplicate family copies, explicit memory assignment and privacy exclusion. No auto re-entry through a second projection path, and exact authorized owner choices remain available. |
| AC-15 | CAP-3 | A first build with explicit active homes and sufficient away evidence needs no separately learned base. Only one applicable Home context governs filtering, grouping and qualification. |
| AC-16 | CAP-3, CAP-6 | Time-only suggestion appears in review and stays out of default gallery, cover and fresh automatic Replay. Existing exact committed selection and soundtrack survive or receive a truthful review/unavailable state. |
| AC-17 | CAP-4 | Fifteen consecutive day-only days, several places and both known/missing away-context fixtures. One compatible episode rather than fragments due to episode age. Compare support and visible qualified output where prerequisites are met. |
| AC-18 | CAP-4 | Test exact 72 hours, civil two days and known-away ten days at and just beyond each boundary. Isolate alternative paths so the fixture proves the intended predicate. |
| AC-19 | CAP-4 | One Home observation and another weeks later leave the local away link without a proven return. Two independent same-area observations in a qualifying intervening run split it. Different homes, duplicates and mixed unordered days do not manufacture corroboration. |
| AC-20 | CAP-4 | Distinct holidays with a true gap/return and retained owner split, rejected merge or manual grouping remain separate as required. Same country and month never force a join. |
| AC-21 | CAP-4 | Reverse input order, mixed exact/civil time, same-day city changes, month/year crossing and incompatible overlap. IDs, membership and qualification are deterministic. Uncertain order stays uncertain. |
| AC-22 | CAP-4 | Rebuild a consented controlled copy of the reported Canada evidence. Compare one owner-identified continuous holiday with distinct-trip controls and the prior eligible generation. Verify Timeline, map, album and Replay reference the same result. |
| AC-23 | CAP-5 | Stale cover callback, switched trip, switched history and newer generation while paginating. No stale asset renders. An unavailable item retains its slot and correct neighbors. |
| AC-24 | CAP-5 | Inject wrong association, differing original metadata, wrong resolved asset, and an unavailable original separately. The diagnostic selects the correct stage and leaves ambiguous cases unknown. |
| AC-25 | CAP-5 | Reopen the reported image under a known scope and generation. Compare the exact original and both surfaces locally. Any case-specific fix must pass this reproduction after correction. |
| AC-26 | CAP-6 | Same input and policy across native projection and packaged worker produces equivalent trips, facts, album eligibility and correction mappings. Resume an old policy checkpoint and verify it cannot publish the new result. |
| AC-27 | CAP-6 | Exercise reader/writer compatibility for legacy and manual-pin Home records, cross-device restore, obsolete peer and stale source removal. Preserve verified history and prevent resurrection before enabling account mutations. |
| AC-28 | CAP-6 | Inject pending correction and ambiguous Replay mapping after changed grouping. Retain the prior eligible record or use existing review without fuzzy retargeting or implicit share. |
| AC-29 | All | Inject write/read, permission and identity failures with synthetic secret/coordinate/URI sentinels. Assert exact stage, reason, durable outcome, single action correlation and redaction across logger/UI. |
| AC-30 | All | Android and iOS fresh-use/skip/restart, accessibility, Settings and affected Atlas interactions on an isolated fixture. Distinguish host results from actual device acceptance. |

## Verification and eval

Use existing mobile suites for reconstruction, reconciliation, onboarding,
privacy Settings, Atlas/gallery, Replay and account convergence. Add a failing
test for each demonstrated regression and a real SQLite test for Home schema,
receipt and publication races. Run mobile tests, SQLite tests, TypeScript and
lint, plus `npm run check` at the root. For wire/schema changes run affected
worker and PostgreSQL compatibility fixtures and the generated-domain freshness
check. Confirm the two native platforms with isolated test histories.

Attach an evidence-policy comparison following `evals/README.md`. Record
baseline/candidate policy versions, synthetic fixture provenance and before/after
counts for false splits, false merges, Home leakage, incorrect default album
association and remap ambiguity. Include positive and negative controls, time
precision variants and a deterministic replay. Keep any consented owner cases
on the device and report only approved aggregates. Product quality stays
`not_measured` without a reviewed labeled sample. A fixture result does not
establish population accuracy or physical acceptance.
