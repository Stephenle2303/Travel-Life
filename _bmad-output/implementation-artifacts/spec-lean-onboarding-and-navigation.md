---
title: Lean onboarding and intuitive navigation
type: feature
created: 2026-10-29
status: in-review
route: dispatch
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-lean-onboarding-and-navigation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-lean-onboarding-and-navigation/experience.md'
  - '{project-root}/_bmad-output/specs/spec-lean-onboarding-and-navigation/automation-and-state.md'
  - '{project-root}/_bmad-output/specs/spec-lean-onboarding-and-navigation/implementation-and-diagnostics.md'
  - '{project-root}/_bmad-output/specs/spec-lean-onboarding-and-navigation/acceptance.md'
---

<frozen-after-approval reason="Owner approved the detailed spec and explicitly requested implementation in the existing dirty checkout">

## Intent

**Problem:** First-use asks users to manage permission, counting, import and Atlas navigation. Returning users need predictable navigation and recoverable automatic work.

**Approach:** Implement the approved [canonical spec](../specs/spec-lean-onboarding-and-navigation/SPEC.md) and every companion as one cohesive onboarding/navigation improvement: Welcome → photo choice → autonomous preparation inside Atlas. This execution adapter tracks Build work; it does not replace or reduce the canonical contract.

## Boundaries & Constraints

**Always:** Preserve dirty main and all concurrent M6/M7 changes. Reuse existing persistence, transaction gates, correction/privacy rules and account isolation. Scope reads explicitly, retain pause/checkpoints and context, provide truthful progress and closed correlated diagnostics. Follow all 36 scenarios and declared engineering defaults.

**Never:** Reset/stage/commit/push/deploy, enable gates, upload owner media, silently attach local evidence to accounts, regenerate corrections, change reconstruction rules or claim device acceptance from host tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| First import | Fresh local user chooses full/limited access | One scoped run, automatic Atlas, no count/import/build confirmation | Exact boundary diagnostic and retryable recovery |
| Selected set | User picks subset despite existing full grant | Only exact supported selected set read | Cancel/empty does not import; lost handles require repick |
| Resume | Persisted compatible interrupted run | Resume once after authority/permission checks | Explicit pause survives; unknown acknowledgement reconciles first |
| Navigation | User leaves Atlas while preparing | Work continues, completion preserves destination/focus/context | Invalid selection clears only invalid context |
| Source fence | Permission loss, owner switch, deletion or disconnect | No stale publication or source resurrection | Existing privacy and account fences apply |
| Optional services | Account or scheduler unavailable | Local use remains usable; explicit opt-in retained | Fixed concise restricted state, no implicit enrollment |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/photo-access/controller.ts`: requestBroad currently counts; startImport/importSelected already rebuild via provider callback. Refactor handoff, not a duplicate engine.
- `apps/mobile/src/photo-access/provider.tsx`: route-independent orchestration and lifecycle; active account remounts under `account/root-provider.tsx` and `record-context.ts`.
- `apps/mobile/src/import-record/{coordinator,repository}.ts`: existing paged metadata/checkpoints and writer gate; preserve unknown-outcome semantics.
- `apps/mobile/src/components/{welcome-screen,mobile-screens,atlas-reveal}.tsx`: Welcome, access, Atlas and settings presentation; preserve map/Replay and context behavior.
- `apps/mobile/src/navigation/app-contract.ts`, `src/app/{index,trust,_layout}.tsx`: route contracts, compatibility and bootstrapping.
- `apps/mobile/src/maintenance/{controller,task}.ts`: existing opted-in scheduling and coalescing.
- `apps/mobile/src/diagnostics/app-diagnostics.ts`: sole closed console boundary; proposed exact diagnostic map and collection recipe live in the canonical implementation companion and must be finalized before behavior changes.

## Tasks & Acceptance

**Execution:**
- [x] Persist versioned entry/run intent and safe legacy/bootstrap resolution using owner-private storage; test corruption, deletion and lost acknowledgement.
- [x] Implement single-owner permission/import/rebuild/read handoff, exact picker scope, resume/pause, retries, fences and correlation; test controlled races and actual SQLite where applicable.
- [x] Implement approved lean Welcome/access/Atlas progress and contextual navigation, compatibility route and task-focused Settings.
- [x] Implement optional update invitation and account entry without changing enrollment, restore or feature gates.
- [x] Run meaningful red/green tests, mobile Jest/SQLite/typecheck/lint and root check; independently review scoped changes and resolve findings.
- [x] Record actual viewport/device evidence or exact unavailable acceptance cells; update project-state, canonical acceptance evidence and error playbook.

**Acceptance Criteria:**
- Given fresh local use, when access is chosen, then scoped preparation and verified Atlas require no additional technical action.
- Given cancellation, changed scope/authority or unknown acknowledgement, when work settles, then no unauthorized read, duplicate mutation or false completed state occurs.
- Given interrupted or explicitly paused work, when the app returns, then only authorized interrupted work resumes and explicit pause remains respected.
- Given contextual navigation and background completion, when returning, then valid exploration/edit context is retained without a forced screen change.
- Given account/maintenance choices, when entering the new UI, then existing consent, source enrollment and scheduling restrictions remain independent.
- Given any new fallible boundary, when it fails, then exact closed diagnostics and redaction/correlation tests establish the mapped category without private payloads.

## Implementation Notes

### Final diagnostic source map before runtime edits

The canonical diagnostic map and collection recipe apply. Concrete new owners:
`onboarding/presentation.ts` reads/migrates the independent SecureStore marker
(`ONBOARDING_ENTRY/ENTRY_READ`, `ENTRY_MIGRATE`); controller startup reads lifecycle,
checkpoints and private run intent at `ENTRY_READ`. `PhotoAccessController.choosePhotos`
owns `ONBOARDING_SETUP/ACCESS_INSPECT`, `ACCESS_REQUEST`, `PICKER_SELECT`,
`INTENT_SAVE`. Its provider-owned run uses `ONBOARDING_RUN/RUN_ADMISSION`,
`RUN_WAIT`, `RUN_CHECKPOINT`, `RUN_RECONCILE`; private intent persistence uses
the existing serialized import repository, with no parallel connection manager.
ImportCoordinator owns `METADATA_IMPORT/IMPORT_READ`, `IMPORT_COMMIT` and
`IMPORT_CHECKPOINT`; existing reconstruction/read stages remain their precise
owners. Errors use the existing closed classifier, unknown writes retain unknown
outcome until durable readback. START/COMPLETE/SKIPPED/ALREADY_RUNNING/PAUSED and
restricted source/authority outcomes are lifecycle events. No native exception,
intent, handle, count or owner value enters diagnostics. Choice correlation is
passed into coordinator and rebuild/read callback. Recovery is a new action.

Owner's latest instruction approves the existing detailed spec and dirty checkout. No repeated dirty-tree or specification approval is required. Freeform cohesive goal, no sprint key. Main HEAD baseline recorded verbatim; concurrent uncommitted changes predate this task and must be separated from scoped review via an initial patch/untracked snapshot without staging.

## Spec Change Log

## Review Triage Log

## Verification

- Root `npm run check`.
- Mobile Jest, actual SQLite, TypeScript and lint using current package scripts and writable cache.
- Canonical AC-01–AC-36 matrix, mapped to actual executed evidence; device limitations remain honest.


### Independent review triage (2026-10-30)

| Finding | Verdict | Evidence / action |
| --- | --- | --- |
| Blind-1 background guard | high | interrupt does not change foreground/generation; queued/rebuild callbacks remain current. Fence interruption and test delayed publication. |
| Blind-2 stop restarts | high | stopImport increments generation while finally auto-resumes before durable disconnect. Add suspension fence. |
| Blind-3 false checkpoint ack | high | commitVerified compares count-only checkpoint; equal-sized different selected sets collide. Remove false success or use exact durable commit proof. |
| Blind-4 pause loses phase | medium | paused replaces imported/publishing and Continue reimports. Retain recoverable phase independently. |
| Blind-5 stale deleted intent | medium | clearDeletedRecord does not clear intent/preparation. Clear and fence on deletion; missing durable intent must clear memory. |
| Blind-6 selected Check now broadens | high | selected scope explanation does not guard rescan; old full checkpoint can allow broad scan. Guard UI and maintenance authority. |
| Blind-7 unregister first | high | stopForLifecycle unregisters before persisting disable. Persist disabled preference before cleanup. Pre-existing wrapper exposed by updated preference behavior; direct correction. |
| Blind-8 unavailable recovery | medium | unavailable hides all source choices, including transient inspect failure. Add explicit recheck/retry and supported independent picker path. |
| Blind-9 canceled read diagnostic | medium | read catch logs failure before stale check. Emit fixed skipped/paused cancellation lifecycle. |
| Blind-10 wrong diagnostic stages | medium | intent load/permission inspect use unrelated reconciliation/wait stage. Add precise typed stages and tests. |
| Edge-1 interrupt | high | Same source evidence as Blind-1; group lifecycle fence. |
| Edge-2 retry permission | high | retry timer checks token only, then reads without lifecycle/permission inspection. Revalidate before retry. |
| Edge-3 blocked recovery | medium | preparing hides Add photos while Try again repeats blocked intent. Offer explicit Choose photos. |
| Edge-4 empty intent | medium | resume null return leaves stale memory. Group with Blind-5. |
| Edge-5 stage attribution | medium | Verified permission await executes at RUN_WAIT. Group with Blind-10. |
| Verification-1 entry route | medium | Tests mount Welcome directly and typeof-check route. Render EntryScreen destination/error cases. |
| Verification-2 publication fence | high | Controller tests mock full completion callback; no delayed provider publication test. Add mounted provider race. |
| Verification-3 invitation consent | medium | Tests call presentation save directly, not invitation Later/Turn on. Add interaction tests. |
| Parent UI-1 invitation prominence | medium | Invitation preceded Atlas and used a large competing primary. Move after Atlas; use secondary Turn on, preserve exploration primary. |
| Parent UI-2 unknown progress | medium | Full-width static fill resembled completion. Replace unknown progress with labeled indeterminate indicator and stable reduced-motion presentation. |
| Parent lifecycle native activity | high | Installed RN AppState documents background for an app-opened Android Activity. Keep native-choice authority through activity background/return, defer processing until foreground, and separately dispose old provider authority on unmount. |

All layers returned before triage. Existing intent settles fixes; no human product
question. Keep automatic handoff, exact picker selection, existing corrections,
account gates, lean screens and SQLite migration. Re-derive affected orchestration
and tests in place: reverting the dirty checkout would destroy concurrent work.
No unrelated account code is to be reset. Review evidence requires focused new
regressions and rerunning applicable integrated checks after corrections.

Review-fix diagnostic map (before edits): `ONBOARDING_RUN/INTENT_READ` owns
`resumePreparation`'s durable intent load; `RUN_ACCESS_INSPECT` owns its run and
prepublication permission inspection; intent-save failures remain
`RUN_CHECKPOINT`. `METADATA_IMPORT/IMPORT_ACCESS` owns permission revalidation
before each safe-read retry; `IMPORT_READ` owns metadata reads and
`IMPORT_COMMIT` owns write acknowledgements. A canceled stale read emits
`SKIPPED/skipped` at the known stage rather than an unexpected failure.
`ONBOARDING_UPDATES/UPDATE_SOURCE` owns exact-selected intent authority,
`UPDATE_ACCESS` owns permission inspection, `UPDATE_COVERAGE` owns saved library
coverage, `UPDATE_PREFERENCE` owns preference acknowledgement, and
`UPDATE_SCHEDULE` owns native availability/register/unregister only. All use the
same closed fields/classifier, no raw payloads, and the canonical collection
recipe. Unknown metadata commit acknowledgements remain unresolved; aggregate
checkpoint equality cannot prove an exact selected set was committed.

### Review corrections and focused evidence (2026-10-30)

- Blind-1/2, Edge-1: foreground generation and lifecycle suspension fence queued,
  reading and delayed publication work. Provider disposal additionally invalidates
  pending native choices; an OS-opened picker/permission Activity may return its
  authorized result while work waits for foreground. Lifecycle-pending state
  blocks new choices during disconnect/delete. Tests force maintenance wait,
  delayed native read, native choice background/return, disposal and real provider
  publication while another task remains visible.
- Blind-3: rejected metadata commit acknowledgement never becomes success from
  aggregate checkpoint equality. An equal-sized different selected set regression
  remains unresolved and cannot trigger rebuild/publication. Stable-ID restart
  stays bounded by the exact persisted intent; no count-only receipt is invented.
- Blind-4/5, Edge-4: explicit pause retains `resumePhase`; Continue persists its
  resumed phase before native work. Lost pause acknowledgement is reconciled to
  paused on Check again without starting work. Deletion and missing durable
  intent clear private in-memory authority and status.
- Blind-6/7: selected intent blocks manual, enabled and headless broad checks even
  with a previous full checkpoint. Existing preference is retained independently;
  an ineligible new enable does not enroll. Disabled worker authority is saved
  before unregister. New source/access/coverage stages identify the actual await.
- Blind-8/9/10, Edge-2/3/5: unavailable inspection retains recheck and independent
  picker recovery; blocked preparation offers Choose photos. Every safe-read
  retry reinspects lifecycle/scope. Late rejected reads emit SKIPPED, and new
  intent/access/update/presentation failure tests assert exact stages, correlation
  and synthetic-sentinel redaction without duplicate outer marker diagnostics.
- Verification-1/2/3 and parent UI findings: mounted EntryScreen exercises fresh,
  started, entered-Atlas and failed bootstrap. Mounted provider tests withhold
  delayed publication after interruption and preserve another task. Actual Later
  and Turn on interactions prove dismissal/remount and explicit-only scheduling.
  Invitation follows Atlas with a secondary enable action; unknown progress uses
  an accessible indeterminate indicator and a stable reduced-motion state.

Executed command (mobile cwd): `npm test -- --runTestsByPath
src/components/__tests__/onboarding.test.ts
src/components/__tests__/onboarding-integration.test.tsx
src/components/__tests__/import-coordinator.test.ts
src/components/__tests__/maintenance-controller.test.ts
src/components/__tests__/maintenance-reconcile.test.ts
src/components/__tests__/photo-access-provider.test.tsx
--cacheDirectory=.jest-cache --silent` — **6 suites, 141 tests passed**.
`npm run lint` passed after the test-capture hook correction; scoped
`git diff --check` passed. The first meaningful review RED run demonstrated five
defects before fixes. Parent owns fresh integrated root/Jest/SQLite/typecheck/
Doctor checks; earlier integrated results do not verify these later corrections.

This correction pass performed no device operation or external data transfer.
Android isolated-profile/native permission/Activity/Back/viewport and iOS physical
acceptance remain pending. Synthetic mounted UI tests do not establish phone
usability, latency, OS scheduling or the current installed app's behavior. The
canonical current-build collection recipe remains required before owner validation.

Parent-review native-choice lifecycle: high. Installed React Native AppState
source documents that Android background includes a native Activity launched by
the app. Invalidating the same generation used by an outstanding picker/request
would discard its successful result. Separate source/disposal choice authority
from background preparation suspension; test pending native choice across
background/active, including source deletion/unmount rejection. Also move Updates
invitation after Atlas and keep it secondary; unknown progress must not look100%
complete. These are direct corrections within the existing intent.

Final diagnostic audit before closeout (2026-10-30): the newly exposed device
Settings action and invitation-preference read also need closed boundary events.
`ONBOARDING_SETUP/ACCESS_SETTINGS` maps Linking.openSettings rejection;
`ONBOARDING_UPDATES/UPDATE_OFFER_READ` maps invitation marker read/schema failure.
Both classify in memory with fresh local correlation and fixed UI recovery;
synthetic rejection/redaction regressions must pass before completion.

## Parent integrated verification — 2026-10-30

Code and host verification complete in the owner's existing dirty main checkout;
status remains in-review solely for physical acceptance, not unfinished host fixes.
No staging, commit, push, data reset or deployment was performed. The existing
concurrent account/engine changes remain intact; test counts reflect the whole
current checkout, not only this feature's added tests.

| Check | Executed result |
| --- | --- |
| Mobile full Jest |99 suites /913 tests passed; `npm test -- --cacheDirectory=.jest-cache-codex` |
| Actual SQLite |105 tests passed; `npm run test:sqlite` |
| Mobile TypeScript |`npm run typecheck` passed |
| Mobile lint |`npm run lint` passed after final diagnostic/test changes |
| Root foundation |`npm run check` passed136 tests, pinned framework integrity and eval smoke |
| Expo Doctor |21/21 passed with approved host network after sandbox DNS failure |
| Android bundle |`npx expo export --platform android --output-dir ../../.local/onboarding-build/android-export` passed with Hermes bytecode; approved host retry after sandbox Temp permission failure |
| New UI failure tests |10 mounted integration tests passed, including ACCESS_SETTINGS/UPDATE_OFFER_READ redaction; included in full913 |
| Scoped source/diff audit |Onboarding before-file inventory plus known additions reviewed; no new raw console/error payload or credential pattern; scoped whitespace check passed |
| Independent correction audit |Edge reviewer confirmed five filed paths/native-Activity handling corrected; verification reviewer confirmed all three integration gaps covered |

Ignored `.local/onboarding-build/` retains baseline patch, before-file copies,
scoped diff, bundle and exact check logs. No private photos/locations were read.
No new dependencies or native module were introduced. The bundle is build
verification, not a signed package, installation or device walkthrough.

Physical acceptance still open: Android clean isolated-profile first permission,
limited/selected picker behavior, process death/resume, system Back, actual
viewport/large text/screen reader, measured tap response and OS scheduling. A
connected Android was inventoried read-only; its attachment does not establish
these cases. No isolated dataset/profile was exercised and no iOS device was
available. Live account restore and native sharing retain their previous service/
device prerequisites. Do not clear the owner's active app data to test first use.

All implementation tasks and hosted matrix branches are mapped to the executed
controller/provider/entry/maintenance/SQLite tests; canonical acceptance.md
retains AC-01–AC-36's physical/live boundaries. The implementation is available
for owner/device review. Mark fully accepted only after those cells are exercised.
