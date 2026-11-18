# Acceptance, preservation and evidence

These are required future checks, not reported test passes. This specification
has 11 stable capabilities. Host tests establish software contracts; physical
Android and iOS evidence establishes viewport/native interaction, not aggregate
reconstruction accuracy or guaranteed OS scheduling.

## Scenario matrix

| ID | Capability | Setup and action | Required observable outcome | Evidence layer |
| --- | --- | --- | --- | --- |
| AC-01 | CAP-1, CAP-10 | Fresh isolated profile opens app | Welcome montage/poster, one primary, no photo request/read/upload/render; controls work with reduced motion | Startup test + both phones |
| AC-02 | CAP-1, CAP-2 | Welcome primary, library action, full OS grant | Atlas opens automatically, import/rebuild/readback runs once, no Trust/Start import/View Atlas tap | Owner-flow + coordinator + both phones |
| AC-03 | CAP-2, CAP-8 | Same path with limited grant | Only accessible scope processed, useful result or honest sparse state, no pressure to broaden | Adapter integration + both phones |
| AC-04 | CAP-2 | Full OS grant already exists; user chooses exact picker subset | Only returned supported subset imported; no broad enumeration | Adapter spy + SQLite + native selection |
| AC-05 | CAP-2, CAP-8 | Cancel picker or return zero items | No import/rebuild/run created; stay on access, retain prior record; cancellation has no error alert | Owner-flow + lifecycle test |
| AC-06 | CAP-1, CAP-2 | Grant denied / cannot ask again; choose Not now | Supported picker/settings recovery, no repeated prompt; empty Atlas usable and skip survives relaunch | Permission branches + both phones |
| AC-07 | CAP-1 | Legacy local record has no new marker | Open existing Atlas, migrate display state idempotently, no consent/enrollment/new import | Actual SQLite + startup test |
| AC-08 | CAP-1, CAP-11 | Marker/authority/history read fails | Recoverable startup error, no fresh DB/init/reset or private-content flash; precise stage | Fault + redaction test |
| AC-09 | CAP-1, CAP-5 | Cold open after skip, completed import or saved pause; use valid deep link separately | Default Atlas/pending state, no Welcome or auto-playing Replay; valid authorized link wins | Navigation resolver test + both phones |
| AC-10 | CAP-2, CAP-3, CAP-11 | Permission succeeds, intent save fails or acknowledgement is lost | No unsupported job; classified failure or intent reconciliation; retry uses actual current grant without another unnecessary prompt | Fault/SQLite acknowledgement test |
| AC-11 | CAP-3 | Rapid double tap, provider remount, two foreground callbacks and existing maintenance work race | One admitted generation/run, existing writer gate respected; no duplicate scan/rebuild | Controlled interleaving + actual SQLite |
| AC-12 | CAP-3, CAP-4 | Navigate to Settings during preparation, let run finish | Work continues independently; Settings/focus preserved; result appears on return | Mounted navigation integration + both phones |
| AC-13 | CAP-3 | Background/terminate after an acknowledged metadata page, then relaunch | Compatible checkpoint verified and resumed once; no copied-source broadening, corrections or duplicates | Actual SQLite checkpoint + both phones |
| AC-14 | CAP-3 | Press Pause, background, relaunch, then Continue | Pause persists and blocks automatic continuation; explicit Continue reinspects and resumes safely | State tests + both phones |
| AC-15 | CAP-2, CAP-3, CAP-8 | Restart picker run with unavailable reusable handles / unsupported selected items | Explicit repick or partial/zero supported result; never scan library to compensate | Selection/persistence tests + native behavior |
| AC-16 | CAP-3, CAP-11 | Revoke access or change limited scope between pages and before publication | No next unauthorized page or stale publication; old committed data handled by existing policy | Race/adapter/privacy integration + both phones |
| AC-17 | CAP-3, CAP-6 | Sign out, switch owner/replica, disconnect or delete while native work settles | Late callbacks cannot activate wrong history, reattach source or undo deletion; no new-owner content flash | Existing account/record fences + controlled race |
| AC-18 | CAP-3, CAP-8, CAP-11 | Two transient safe read failures, then success; also nonretryable failure | Bounded foreground retries only; no duplicate mutations, no retry storm; correct recovery when exhausted | Fake clock + failure classification |
| AC-19 | CAP-3, CAP-8, CAP-11 | Lose native write/rebuild/checkpoint ack; read still pending | Inspect durable state before retry, show Checking/Check again, never claim rollback or successful pause | Lost-ack SQLite/native boundary tests |
| AC-20 | CAP-4 | Import with exact total, unknown total and changing scope | Measured phase percent only for valid denominator; honest indeterminate fallback; import100 is not Atlas ready | Progress projection + phone capture |
| AC-21 | CAP-4, CAP-8 | Metadata/rebuild complete, durable read fails; prior record exists in second case | No new ready result before authorized readback; still-authorized previous result survives; retry read without reimport | Fault + durable read regression |
| AC-22 | CAP-4, CAP-5 | First result arrives after user changed map camera/year/view or opened a journey | User exploration and screen retained; auto-fit happens only on untouched initial Atlas | State integration + both phones |
| AC-23 | CAP-4, CAP-8 | Zero photos, evidence without journeys, useful partial record, missing media | Distinct honest states, recognizable fallback; one contextual primary, no fabricated map or full-life claim | Projection tests + synthetic viewport cases |
| AC-24 | CAP-5 | Atlas → preview/detail → album/edit → Back | Valid camera/year/view/selection/scroll retained and existing edit acknowledgement preserved | Navigation integration + Android Back/iOS gesture |
| AC-25 | CAP-5, CAP-8 | Selected journey removed or selected year becomes empty on return | Clear invalid selection only, retain valid context, honest empty year with All years recovery | Context regression + viewport case |
| AC-26 | CAP-5 | Open legacy Trust/import, unknown route, Settings and each task row | Correct compatibility/Back behavior; no stale setup stack; Settings then task controls within two navigation actions | Route tests + both phones |
| AC-27 | CAP-6 | Account feature disabled, provider unavailable and enabled sign-in variants | Local path always usable; entry visibility truthful; failure never blocks local setup | Gated account screen integration |
| AC-28 | CAP-6 | Existing owner enters from Welcome; sign-in succeeds; then independently chooses restore | Login alone starts no local upload/restore/sync; explicit verified restore opens correct account Atlas and preserves local record | Existing account consent/activation tests + live acceptance when available |
| AC-29 | CAP-7 | Fresh eligible import, Later, relaunch, previous explicit preference and one-shot picker | One nonblocking offer; dismissal/preferences persist; picker does not receive broad-update opt-in | Preference/UI integration |
| AC-30 | CAP-7, CAP-11 | Opt in, scheduler restricted/register fails, later foreground catch-up | Correct preference vs actual scheduling state; no guarantee of cadence; foreground recovery coalesces | Scheduler faults + actual Android/iOS observation |
| AC-31 | CAP-9 | Ready Atlas, tap Replay, edit/return, then choose Share | Existing one-action prepare/play; no eager first-run render; exact committed order/music/media retained; empty-first subset preview before deliberate OS sheet | Existing Replay/share regressions + phone walkthrough |
| AC-32 | CAP-8 | Map unavailable but durable journeys exist | Timeline remains accessible; no reimport required or fabricated cartography | Map recovery regression + phone |
| AC-33 | CAP-10 | Small supported viewport, largest supported font setting, keyboard, screen reader and reduced motion | No clipped essential controls, meaningful focus/state labels, accessible primary targets, usable Timeline fallback | Actual Android/iOS accessibility evidence |
| AC-34 | CAP-11 | Force each new diagnostic boundary and inject synthetic secret/location/path sentinels | Exact operation/stage/reason/outcome; one action correlation across exercised layers; no raw sentinel in logs/UI or duplicate failure emissions | Fault/redaction/correlation tests |
| AC-35 | CAP-3, CAP-4, CAP-9 | Existing corrected/excluded/manual journeys and committed Replay, then repeated scope import/relaunch | Durable edits/privacy retained, one valid published generation, no reset/truncation or composition substitution | SQLite integration + existing regression suite |
| AC-36 | CAP-2, CAP-6 | Active account Atlas opens Add photos without prior native-source enrollment | Enter existing consent/enrollment or explicit local switch; no direct import into account replica, no upload under local-only copy | Account/source routing and authority integration |

## Human usability walkthrough

Use synthetic or explicitly authorized owner data; keep personal screenshots and
logs in ignored private storage. Use an isolated test profile/build for clean
install cases; never clear the owner's active app data to obtain a first-run test.

Ask the owner to perform these tasks without naming the control to tap:

1. Create an Atlas from the photos they choose; observe whether any technical
   explanation or extra import/rebuild action is needed.
2. Leave while preparation continues, then find the result again. Observe screen
   stability, progress comprehension and whether any tap appears unacknowledged.
3. Open a trip, inspect its photos and return to the previous map/year/list place.
4. Find photo access, Home bases, update controls and account entry from Atlas.
5. Pause preparation and continue later. Change permission and recover once.
6. Open Replay and locate sharing without accidentally publishing or losing edits.

Acceptance requires the tasks completed with the visible UI and no coaching about
internal stages. Record mis-taps, confusing labels, required help and the exact
viewport/state; revise the owning spec/implementation before claiming intuitive
navigation. This is owner acceptance evidence, not an invented population success
rate or a prerequisite market research program.

Measure tap acknowledgement on target phones against the 100 ms target. Record
actual measurements and conditions; there is no total import-duration guarantee.
For large libraries record library/scope size privately, time-to-usable-Atlas,
interruption/resume and memory responsiveness. Do not invent a throughput target
or progress denominator before measuring the implementation.

## Platform and regression gates

- Run repository root `npm run check` for foundation integrity/tests/eval smoke.
- During implementation run the current mobile package checks from
  `apps/mobile/package.json`: Jest, actual SQLite, TypeScript and lint; use the
  existing writable Jest cache setup and discovered test filenames.
- Update the existing `owner-flow.test.tsx` route-export/Trust assertions to the
  new contract and preserve no-implicit-import/no-private-upload checks. Add
  meaningful boundary/interleaving tests rather than snapshots of button text only.
- Exercise both Android hardware/system Back and iOS gesture return. Validate
  full/limited/denied/revoked native access on supported OS versions. If a device
  or API variant is unavailable, list that exact unverified cell.
- Test existing headless maintenance handlers separately from observing actual
  OS scheduling. A forced task does not prove recurring execution or force-quit
  completion. Foreground resumability remains required regardless.
- Account email delivery, authenticated restore and service acceptance retain
  their existing external prerequisites. This UI spec does not close them or
  authorize enabling disabled services, uploading owner media or public sharing.
- No reconstruction rules change here. If implementation changes those rules or
  evidence handling, attach the required eval plan/results; software fixtures
  alone never establish reconstruction accuracy.

## Source preservation matrix

| Load-bearing input | Contract location |
| --- | --- |
| Owner: easy, convenient, intuitive navigation, automatic work and minimal text | CAP-1 through CAP-10; experience screen/return/copy tables |
| Party: Welcome → access → Atlas, combine Trust, remove manual import/View Atlas | CAP-1/CAP-2; experience W/A/H; automation admission |
| Party: work continues without stealing navigation, resume safely, no OS promise | CAP-3/CAP-4; state machine, resume table and publication guards |
| Party: signup optional, returning account entry, no implicit uploads | CAP-6; experience W/navigation; account boundaries; AC-27/28 |
| Party: recurring updates explained after value and explicitly enabled | CAP-7; experience U; updates boundaries; AC-29/30 |
| Party: short recovery, Details for counts, no empty-map dead end | CAP-8; experience state table; AC-23/32 |
| Party: one-action Replay, keep editing/sharing rules | CAP-9; experience navigation; AC-31/35 |
| Decisions 0003/0004: broad default, selected alternative, correction-preserving background maintenance | Kernel constraints; scope invariants and opt-in scheduling contract |
| Decisions 0009/0011/0014: private reveal, cinematic Welcome, lean UI and truthful progress | Experience reference/W/H/accessibility; progress/publication; AC-01/20/33 |
| Decision 0015 and current sharing correction: local/account isolation; no hosted publication | CAP-6/CAP-9; kernel constraints; implementation baseline and account boundaries |
| Diagnostic policy: actionable stages, one correlation, redaction, collection | CAP-11; complete diagnostic map/recipe; AC-34 |
| Project: preserve dirty work, error lessons and honest completion evidence | Implementation scope/slices/checks; this acceptance/evidence matrix |

Wrapper-only content omitted: party greetings, persona banter and offers to
continue. No product requirement is intentionally dropped with those wrappers.

## Specification validation and implementation evidence

The spec requires two distinct self-validation passes: coherence against Spec
Law and preservation of source claims. Record their final verdicts in this
folder's canonical memlog after artifact checks. Validate companion/source links,
unique capability IDs and scenario coverage. These checks do not execute AC-01
through AC-36 and do not establish that the implementation is complete.

Specification checks on 2026-10-29: root `npm run check` passed 130 tests,
framework integrity (44 skills / four runtime trees) and eval infrastructure smoke
(two valid fixtures accepted, one invalid reference rejected). Final artifact
validation passed five authored documents, 12 resolved companions, 11 unique
capabilities, 36 ordered scenarios with full capability coverage and 14
implementation-source references. Scoped `git diff --check` passed. Both Spec
Law self-validation passes passed; no independent review is claimed.
No runtime code, native acceptance case or physical usability task was executed
by this planning invocation. The pending runtime matrix remains AC-01–AC-36.

At implementation closeout, append evidence here under each completed slice:
changed sources, exact commands/results, forced failure categories, current-build
collection result, phone/OS/viewport and owner feedback. Mark unavailable evidence
explicitly pending. No host-only or synthetic pass closes physical acceptance.

## Review-fix host evidence — 2026-10-30

Focused correction pass: 6 Jest suites / 141 tests passed, mobile lint passed,
and scoped diff whitespace passed. Exact command and review triage live in the
existing implementation adapter. Parent integrated verification is separate.

| Scenarios | Executed correction evidence | Remaining boundary |
| --- | --- | --- |
| AC-01/07/08/09/26 | Mounted EntryScreen fresh/started/Atlas/error cases; existing direct-route tests preserve route-owned entry | Cold native routing, hardware Back and iOS gestures |
| AC-04/05/10/11/15/19 | Exact selected scope; cancellation; durable intent acknowledgement; equal-count/different-set commit rejection cannot publish; missing handles require repick | Native picker IDs, physical process death and unknown native acknowledgement |
| AC-12/16/17/21/22 | Real provider delayed durable-read publication is withheld on interruption while another task remains open; lifecycle suspension/disposal and retry-scope tests | Actual native permission change, owner switch and viewport/camera behavior |
| AC-13/14/18 | Persisted Continue transition before a deferred read; pause retains publication phase; lost pause ack reconciles without resuming; bounded retries revalidate authority | OS interruption/checkpoint scheduling on both phones |
| AC-20/29/30/33 | Unknown progress has no numeric completion; accessible indicator and secondary post-Atlas invitation; Later survives remount and Turn on alone registers; selected-only broad checks blocked | Physical large text, screen reader, reduced-motion appearance and real OS scheduling |
| AC-34 | Exact intent/access/update/presentation stages, canceled-read SKIPPED, single correlation and synthetic sentinel redaction tests | Current installed-build diagnostic collection |

Other preservation scenarios retain their applicable existing regression suites;
this focused correction pass does not independently execute every AC-01–AC-36
layer or close live account/restore, Android/iOS owner acceptance, or media sharing.

## Integrated host closeout — 2026-10-30

Implemented in the existing dirty checkout with no commit/push or data reset.
Final full mobile Jest99 suites/913 tests, actual SQLite105 cases, TypeScript and
lint passed. Root check passed136 tests plus framework integrity and eval smoke.
Expo Doctor passed21/21; Android Expo export compiled the routed bundle to Hermes
bytecode successfully. Both required environment retries are recorded in the
playbook; neither changed app behavior to bypass a check.

All three independent review layers returned and each finding was triaged in the
implementation adapter. Correction audits confirmed the lifecycle/source guards
and actual mounted entry/publication/invitation cases. Final mapped UI failure
checks cover OS Settings launch and update-offer marker read without exposing
native content. Runtime console collection on the owner build remains a device
acceptance obligation; host synthetic events prove classification/redaction only.

Physical Android/iOS portions of AC-01–AC-36 remain pending, including permission
UI, actual source handles, process interruption, Back/gesture, viewport, large
text, screen-reader, latency and real scheduling. No fresh owner-data scan/reset,
private-media upload or actual OS share was performed by this implementation.
