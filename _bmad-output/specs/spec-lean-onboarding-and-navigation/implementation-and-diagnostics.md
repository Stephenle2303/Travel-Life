# Brownfield implementation and diagnostics

Planning only. Read the kernel and companions together before implementation;
use this folder as the single scoped delivery record, not a second product plan.

## Inspected baseline and change seams

Paths are relative to the repository root.

| Current source | Observed responsibility | Required change / safeguard |
| --- | --- | --- |
| `apps/mobile/src/components/welcome-screen.tsx`, `travel-hero.tsx` | Hero opens Trust; extra intro content below it | Keep montage/accessibility; route to access, simplify prose, optional gated sign-in |
| `apps/mobile/src/app/index.tsx`, `_layout.tsx` | Index renders Welcome; root hosts record provider | Resolve startup without flash; route-independent orchestration under current authority |
| `apps/mobile/src/components/mobile-screens.tsx` | Trust, technical Import, Atlas and long settings controls | Combine purpose/access; Atlas status, labeled Settings and task-focused panels |
| `apps/mobile/src/navigation/app-contract.ts` and `src/app/trust.tsx` | Central routes; standalone Trust | Add safe replace/return policy and compatibility redirect; retain existing URLs |
| `apps/mobile/src/photo-access/controller.ts` | Request/count/picker and separately invoked import | Separate optional counting; explicit mode-to-run handoff with preserved correlation |
| `apps/mobile/src/photo-access/provider.tsx` | Import completion already rebuilds and refreshes durable reveal | Reuse existing sequence; avoid mount-triggered second rebuild or a parallel pipeline |
| `apps/mobile/src/import-record/coordinator.ts`, `repository.ts` | Paged import and durable local metadata | Reuse checkpoint and writer gate; extend persisted intent minimally if needed |
| `apps/mobile/src/reconstruction/repository.ts` | Durable graph and privacy-aware read boundary | Preserve complete-generation/readback and correction safeguards |
| `apps/mobile/src/components/atlas-reveal.tsx`, `src/atlas/preview-context.ts` | Map/Timeline state and contextual return | Keep exploration when status changes and when navigating back |
| `apps/mobile/src/maintenance/controller.ts`, `task.ts` | Explicit preference, scheduled reconciliation and account runner | Coalesce foreground work, preserve opt-in and headless guards; no new scheduler |
| `apps/mobile/src/account/root-provider.tsx`, `record-context.ts` | Active record changes remount photo provider | Fence old work and derive new startup display from current authority |
| `apps/mobile/src/components/account-screen.tsx`, `account-history-panel.tsx` | Existing optional sign-in and history actions | Add entry/return context only; no implicit enrollment or restore |
| `apps/mobile/src/diagnostics/app-diagnostics.ts` | Closed production console boundary | Add narrow orchestration codes/stages and preserve precise lower-level failures |

Before editing, inventory these paths and current tests again; the checkout
contains concurrent dirty M6/M7 work. Do not reset, stage, commit, push, enable
feature gates, alter account secrets or deploy as a side effect of this spec.
Existing tests encode the old Trust/manual-import flow and must be intentionally
updated, not weakened until both old and new behavior can appear to pass.

## Delivery increments and dependency gates

These are ordered implementation slices, not dispatched stories or permission
checkpoints. The current request authorizes specification, not runtime work.

| Slice | Deliverable | Required evidence before advancing |
| --- | --- | --- |
| I-1: durable entry and intent | Versioned presentation state, legacy migration, deep-link precedence, owner-scoped intent and unknown-outcome recovery | Bootstrap failure, skip, migration, deleted-record and process-death tests; no new implicit source reads |
| I-2: single preparation owner | Exact access-to-import handoff, no count prepass, coalescing, checkpoint resume/pause, correlation propagation | Full/limited/picker cancellation, duplicate mount, foreground race, scope/authority fences and actual SQLite checkpoint regressions |
| I-3: lean screens and navigation | Welcome/access/Atlas status, Settings task rows, old-route compatibility, contextual return | Owner-flow tests plus measured Android/iOS layout and Back checks; no callback-driven navigation on background completion |
| I-4: optional continuity | Once-only Updates invitation, existing opted-in maintenance, gated account entry/return | Preference/registration failure tests, account/local isolation and scheduler-handler regressions |
| I-5: integrated acceptance | Full scenario matrix, privacy/redaction, host checks and target-phone walkthrough | Document actual results and remaining platform blockers; no claim of intuitive UX from mocks alone |

I-1/I-2 are prerequisites to exposing the new automatic-start UI. Do not ship
lean buttons that imply processing starts while persistence/orchestration still
requires the removed manual action. No new dependency or backend migration is
assumed; justify any necessary storage migration with preservation tests.

## Diagnostic map

The policy requires this map before behavior changes. `ONBOARDING_ENTRY`,
`ONBOARDING_SETUP`, `ONBOARDING_RUN` and `ONBOARDING_UPDATES`, and their stages
below, are proposed additions to the closed union, not existing runtime events.
Reuse existing `METADATA_IMPORT`/Atlas/account operations where their boundary is
already precise. Do not add a second console boundary or replace precise child
classification with a generic outer error.

Reasons below are finite existing categories. `UNKNOWN` is permitted only at the
specified known stage when in-memory evidence cannot classify further.

| Operation / failure stage | Closed reasons / lifecycle | Source boundary | Outcome, retry and next diagnostic action |
| --- | --- | --- | --- |
| `ONBOARDING_ENTRY / ENTRY_READ` | `SCHEMA`, `NATIVE_HANDLE`, `DATABASE_BUSY`, `TRANSACTION`, `ACCESS`, `UNKNOWN` | Proposed startup resolver → existing private settings/lifecycle repository | Unreadable state remains failed/unknown; retry read, never initialize over it; inspect mapped read stage |
| `ONBOARDING_ENTRY / ENTRY_MIGRATE` | `SCHEMA`, `CONSTRAINT`, `TRANSACTION`, `DATABASE_BUSY`, `UNKNOWN` | Versioned marker migration / commit acknowledgement | Unknown commit reconciles marker first; inspect version/transaction fault tests, never log values |
| `ONBOARDING_SETUP / ACCESS_INSPECT` | `ACCESS`, `RESTRICTED`, `UNKNOWN` | Photo adapter inspect | Denial/unavailable is expected restricted state; retry only explicit/supported recovery |
| `ONBOARDING_SETUP / ACCESS_REQUEST` | `ACCESS`, `RESTRICTED`, `SKIPPED`, `UNKNOWN` | `requestBroad` / native request | User denial is restricted, cancellation skipped; no automatic re-prompt |
| `ONBOARDING_SETUP / PICKER_SELECT` | `ACCESS`, `RESTRICTED`, `SKIPPED`, `UNKNOWN` | `selectPhotos` / native select | Cancel/empty skips reads; rejected native call is classified at picker boundary |
| `ONBOARDING_SETUP / INTENT_SAVE` | `SCHEMA`, `CONSTRAINT`, `TRANSACTION`, `DATABASE_BUSY`, `NATIVE_HANDLE`, `UNKNOWN` | Proposed scoped intent storage and acknowledgement | Unknown ack reconciles intent; confirmed failure stays on access screen, no job |
| `ONBOARDING_RUN / RUN_ADMISSION` | `ALREADY_RUNNING`, `LIFECYCLE`, `BLOCKED`, `RESTRICTED`, `UNKNOWN` | Proposed preparation owner + active record/source guard | Duplicate is unchanged, obsolete work skipped, lost access blocked/restricted; inspect admission guard |
| `ONBOARDING_RUN / RUN_WAIT` | `PAUSED`, `DATABASE_BUSY`, `LIFECYCLE`, `UNKNOWN` | Existing writer/maintenance idle boundaries | Waiting is unresolved until acknowledged; safe pause/checkpoint, no timeout-to-rollback assertion |
| `METADATA_IMPORT / IMPORT_READ` | `ACCESS`, `RESTRICTED`, `NATIVE_HANDLE`, `UNKNOWN` | Import coordinator → native metadata page/selected read | Stop changed scope; bounded safe-read retries only; inspect adapter/page-read fault |
| `METADATA_IMPORT / IMPORT_COMMIT` | `SCHEMA`, `CONSTRAINT`, `TRANSACTION`, `DATABASE_BUSY`, `NATIVE_HANDLE`, `UNKNOWN` | Import repository page transaction/checkpoint ack | Unknown outcome inspects saved checkpoint; no duplicate page mutation |
| `ONBOARDING_RUN / RUN_CHECKPOINT` | `SCHEMA`, `CONSTRAINT`, `TRANSACTION`, `DATABASE_BUSY`, `UNKNOWN` | Pause/intent/checkpoint persistence | Unknown ack is unknown, not paused-success; inspect durable checkpoint before Continue |
| Existing `ATLAS_REBUILD` / precise rebuild stage | Existing narrow schema/transaction/mapping categories, `OWNER_REVIEW`, `LIFECYCLE`, `UNKNOWN` | Reconstruction controller/repository | Preserve current correction/remap handling; no automatic full rebuild loop |
| Existing `ATLAS_DURABLE_READ` / precise durable-read stage | Existing read/privacy/mapping categories, `RESTRICTED`, `UNKNOWN` | Durable authorized reveal/read projection | Retry publication read without reimport; never present pending result as ready |
| `ONBOARDING_RUN / RUN_RECONCILE` | `SCHEMA`, `CONSTRAINT`, `TRANSACTION`, `DATABASE_BUSY`, `BLOCKED`, `UNKNOWN` | Persisted intent/checkpoint/revision verification | Stay unknown/blocked until proven; **Check again** starts a new action correlation |
| `ONBOARDING_UPDATES / UPDATE_PREFERENCE` | `SCHEMA`, `TRANSACTION`, `DATABASE_BUSY`, `UNKNOWN` | Existing maintenance preference read/write ack | Verify preference before marking enabled/disabled; preserve explicit prior choice |
| `ONBOARDING_UPDATES / UPDATE_SCHEDULE` | `RESTRICTED`, `PAUSED`, `LIFECYCLE`, `UNKNOWN` | Existing scheduler register/unregister/status | Unsupported API is expected restricted; report pending/restricted truthfully, no registration-success inference |

Expected START/COMPLETE/PAUSED/SKIPPED/ALREADY_RUNNING events use fixed stage and
durable outcome and are not unexpected errors. Extend the import stages only if
no existing equivalent supplies the same specificity. Finalize exact lower-level
stage names against the owning source before code changes; a broad catch with
null stage does not satisfy this contract.

Create one locally generated correlation for the photo-choice action and pass
it through permission/picker, intent, import, rebuild and readback. Background
recovery is a new action with its own correlation, not a reused owner/source ID.
Emit the failure once at the boundary with the best information; parent UI uses
the typed closed result and emits its own lifecycle end without reserializing the
exception. Do not replace precise storage/schema categories with `UNKNOWN`.

Do not emit counts, selected handles, run/checkpoint objects, user labels,
coordinates, local paths, media URLs, raw native errors or Auth data. No new
external telemetry or performance-event fields are authorized by this spec.

## Current-build collection recipe for later implementation

1. Verify the app package from `apps/mobile/app.json` and installed metadata;
   current Android declaration is `com.anonymous.travellife`. Select the intended
   ADB device explicitly. Confirm Metro/build freshness and foreground UI before
   treating absence of events as a product failure.
2. Resolve the process with `adb -s <serial> shell pidof <verified-package>`.
   Filter that current PID's ReactNativeJS logs and retain only structured events
   prefixed **[Travel Life diagnostic]**. Some consoles print objects over multiple
   lines; use the existing closed-event collector or parse complete event blocks,
   not a prefix-only grep that loses stage/reason fields. Never dump raw logcat.
3. Trigger exactly one authorized action. Find its START correlation and follow
   its mapped fixed stages through the terminal outcome; a start without an end
   is unresolved. Inspect mapped source and synthetic tests before another retry.
4. On iOS use the current app process/development console with the same closed
   filter. If no device/log transport exists, record that collection limitation.
5. Keep any capture under ignored `data/private/`; include only sanitized fixed
   event summaries in this delivery record. Do not export logs externally or put
   raw traces/screenshots with personal evidence in Git.

## Verification applicability

For this spec-only invocation, validate artifact links, capability/acceptance
coverage and both Spec Law passes, then run root `npm run check`. No app behavior
changes, so new runtime diagnostics, mobile regression tests and device evidence
are planned obligations, not fabricated completed checks.

Implementation must use meaningful failing tests for the new boundaries, root
checks, mobile tests/SQLite/typecheck/lint and actual phone acceptance. Read the
error playbook before editing/testing. If reconstruction inputs or rules change
despite this scope, stop that scope drift and define the required eval plan under
`evals/README.md`; fixture checks do not establish reconstruction accuracy.
