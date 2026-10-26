# Replay consolidation review and acceptance

Scope: owner-accepted Android Replay render/edit/save/update code, tests and
delivery records; preserve and retire superseded worktrees. Exclude M4.5
selected-share specification/review and concurrently edited diagnostic-policy
guidance. No push or native rebuild is part of this consolidation.

The owner reported "ok het roi do" after the edit/photo, exclude, custom audio
Done and Update/new-video test. This closes the reported normal Android flow.
It does not establish measured performance, iOS, all lifecycle cases or all
thirty canonical acceptance cases. The larger execution record remains honest
about those boundaries.

## Individual review triage

| ID / source | Verdict and checked evidence | Disposition |
| --- | --- | --- |
| B1 blind: enqueue after timeout | medium: new pending waiter can be created after the active deadline fired and lacks public settlement. | Fixed: retain latest intent but settle its public outcome immediately while ownership remains held. Regression added. |
| B2 blind: definitive reconciliation | medium: conflict/scope-invalid readback was collapsed into unknown. | Fixed: closed conflict recovery, no duplicate mutation or false acknowledgement. |
| B3 blind: fenced reconciliation | medium: Restore fenced the epoch and then recommended a Check again that could not inspect its receipt. | Fixed: durable reconciliation may settle ownership without restoring discarded intent. |
| B4 blind: selected-task deadline | medium: a never-settling native selection resolution can delay aggregate Update indefinitely. | Deferred fault-recovery work; native work must remain owned and not be silently omitted. No normal-flow failure observed. |
| B5 blind: final commit recovery | medium: production commit does not pass its optional receipt mutation and is not governed by the stage deadline. | Deferred bounded final-commit reconciliation; full AC-07–10 recovery is not accepted by this commit. |
| B6 blind: session lifecycle | medium: provider retains edit-session intent/tasks through disconnect/privacy invalidation while native provider guards prevent unauthorized writes. | Deferred explicit session fencing/disposal; no privacy-bypass claim was established. |
| B7 blind: settings versus pending selection | medium: settings can snapshot before a previously selected native task settles; that task later uses prior music refs. | Deferred selected-task/settings barrier race; normal owner flow was serial and passed. |
| B8 blind: quarantined writer | medium: failed rollback keeps the global lease and requires runtime recovery; explicit connection-health repair is absent. | Deferred fault-injection recovery. Preserve fencing rather than release an uncertain native owner. |
| B9 blind: new-connection lifetime | medium: repeated background repository creation lacks a disposal contract. | Deferred native connection-lifetime work with retained-database tests. |
| B10 blind: thumbnail admission | maybe-false: service queue overflow returns null and mounted poster does not retry. Actual grid virtualizes and pages candidates; a reachable mounted overflow was not established. | Deferred unverified medium case; reproduce with a real viewport mounting over 54 uncached posters before changing admission. |
| E1 edge: first-preview lifetime | high: provider reclaims created chapter files on failure while UI retains the first URI. | Fixed: clear reclaimed partial preview and show truthful retry failure. |
| E2 edge: Re-render prior file | high: Re-render deletes the prior video before replacement but recovery claims it remains playable. | Fixed: invalidate while preserving verified bytes; delete old file only after replacement succeeds. |
| E3 edge: Reset order | medium: sheet retains newest-first while Reset changes main state to oldest-first. | Fixed: update sheet refs/state too; Done regression added. |
| V1 verification: route retention coverage | medium: default screen mock uses fallback sessions and missed remount adoption. | Fixed coverage: shared provider session, held save, stale manifest remount, exact media/trips/music/order/status and acknowledgement. |
| V2 verification: audio destination coverage | medium: copy validation had no missing/empty/oversized/read-failure destination tests. | Fixed coverage: parameterized actual import helper tests reject and clean invalid copies. |
| A1 acceptance: owner normal Android flow | false as a consolidation blocker: direct owner evidence supports the exercised working path. | Keep accepted code; do not substitute a different historical variant. |
| A2 acceptance: complete G5/S7 | medium evidence gap: iOS, lifecycle/restart/privacy/share/accessibility and measurements remain incomplete. | Deferred release acceptance, not a reason to discard accepted Android code. |
| A3 acceptance: retained Auto on include | medium: exclusion removes the Auto flag; inclusion cannot restore it and no separate persisted retained-auto field exists. | Deferred AC-02 implementation gap; do not claim complete canonical editor acceptance. |
| A4 acceptance: overview shortcuts | low: selected count is text and trip inclusion is via gallery More rather than independent overview actions. | Deferred ordinary UX scope; current approved tested gallery flow remains usable. |
| A5 acceptance: final commit recovery | medium, same root cause as B5, independently retained here. | Deferred with B5; explicit repository receipt fixtures do not prove production commit wiring. |
| A6 acceptance: older audio/settings ACs | false: later explicit owner direction separates copy readiness from decode and keeps Done open through acknowledgement. | Reject superseded requirements as defects; final audible output still requires its own evidence. |

All four review lenses completed against the shared diff. Initial per-command
sandbox Temp paths were inaccessible to reviewers; those attempts supply no
review evidence and were superseded by the actual shared-path reviews.
No unresolved finding above establishes that the owner's accepted normal flow
is broken. Deferred items remain searchable and must not be marked completed.

## Diagnostic source map and collection

| Boundary | Existing fixed diagnostic / lifecycle | Source and next check |
| --- | --- | --- |
| Audio private copy | REPLAY_AUDIO_SELECTION / REPLAY_ACCESS, closed outcome | audio-import.ts; invalid-copy tests prove rejection/cleanup. |
| Stage scope/map/CAS | REPLAY_DRAFT_SAVE / REPLAY_STALE with REPLAY_* guard reasons | provider stage + repository guards; preserve caller revision and inspect fixed reason. |
| Working timeout/reconcile | scheduler waiting/outcome-unknown/conflict; exact receipt identity retained privately | draft-save-scheduler.ts and gated reconcileReplayMutation; held-COMMIT and late-callback tests. |
| Render/finalization | REPLAY_RENDER with closed failure stage; final-ready only after verified artifact | replay-screen.tsx, provider prepare, renderer; clear reclaimed preview on failure. |
| Re-render invalidation | same render outcome; verified file retained until successful replacement | discardPrivateReplay preserveFile and screen replacement cleanup tests. |

For a new incident, verify Metro serves primary checkout and collect only fixed
Travel Life diagnostics from the installed `com.anonymous.travellife` process
using `adb logcat -d -v raw ReactNativeJS:I '*:S'`, filtering the operation and
its locally generated correlation. Keep raw logs/screenshots in ignored
`.local/`; never commit names, paths, personal media or raw native errors.
Do not infer a source cause from a generic last-start marker. Full correlated
delivery of all deferred boundaries above remains incomplete.

## Preservation and next work

Final verification after the bounded release-review patches: 47 Jest suites /
539 tests, 93 real SQLite tests, TypeScript, lint, root `npm run check` and
whitespace validation pass. Expo Doctor passed 21/21 on the unchanged dependency
set earlier in the same delivery. Root working-tree checks also see concurrent
diagnostic-policy tests; those policy changes/tests are deliberately not staged
with the Replay snapshot. No native rebuild/install or remote push occurred.

The owner acceptance applies to the tested normal Android flow before these
small host-verified recovery/Reset corrections; no additional physical-device
acceptance, fault injection or timing measurement is invented for the review
patches.

See `../../docs/development/replay-worktree-retirement-2026-10-26.md` for exact
worktree HEAD/snapshot tags, physical retirement and archived helper.
Only the primary checkout remains active. The next-ticket spec and concurrent
policy edits stay uncommitted and unchanged by this delivery operation.
