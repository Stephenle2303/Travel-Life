---
title: 'Measure Atlas rebuild and durable read phases'
type: 'chore'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent">

## Intent

Measure the working Android Atlas rebuild and durable read separately to locate
the observed 11.5–11.7 second post-rebuild interval. Add opt-in development-only
fixed phase events through the existing six-field diagnostic boundary. Preserve
all SQL, transactions, schema, graph/qualification rules, corrections, return
values, error behavior and owner-visible flow. Derive timings from local log
timestamps; export no private records or raw errors. Collect one owner-operated
recheck before proposing an optimization. No commit, push, storage reset or
reinstallation is part of this work.

</frozen-after-approval>

## Implementation Notes

- No unresolved intent gaps or irreversible changes. Existing four dirty docs
  are authorized follow-up records and remain preserved on `cd889c9`.
- Small footprint: diagnostic phase helper/types, repository phase transitions,
  focused privacy/lifecycle tests and synthetic SQLite parity checks. Reuse
  existing durable stages and diagnostic sink; no dependency is needed.
- Development flag `EXPO_PUBLIC_ATLAS_PHASE_PROFILE=1` enables probes only with
  `__DEV__`. Phase boundaries include mixed JS/native work, not isolated SQL or
  rendered paint. Every phase remains `durableOutcome: unchanged`; existing
  controller events remain authority for committed completion.
- Verification: TDD helper tests, enabled/disabled real-SQLite call/result parity,
  full mobile Jest/SQLite/typecheck/lint, root check, independent review, then
  fresh-process owner click-and-wait measurement. Release probes remain disabled.
- Review: blind code review used; broader product/UX review layers skipped for
  measurement-only scope. Review found missing queue/caller-owned and durable
  failure coverage; added real-SQLite parity for both, including revoked access
  and the optional manual-layout probe. Failed phase intervals include rollback
  and diagnostic cleanup; only successful phases locate normal-path cost.
- Capture procedure: start the existing mobile Metro command with PowerShell
  `$env:EXPO_PUBLIC_ATLAS_PHASE_PROFILE='1'` then `node node_modules/expo/bin/cli
  start --port 8085 --lan`. Verify the specific served probe module, USB reverse
  and a fresh app process. Owner opens Atlas and runs one recheck to completion.
  Read `adb logcat -d -v epoch --pid=<verified app PID>` into memory, retaining
  only closed diagnostic fields and timestamps. Do not save raw logs.
  Pair START/COMPLETE by operation + correlation + ordered phase occurrence
  (DURABLE_PROJECTION occurs twice); UNKNOWN is interrupted, never completed.
  Account separately for rebuild end to durable-read start and durable-read end
  to parent retry COMPLETE. These are instrumented wall times, not CPU/SQL/paint
  benchmarks or a speed comparison. Delete the shell flag or restart Metro
  without it to disable the opt-in probe after measurement.

## Review Triage Log

- Queue/caller-owned coverage: medium, patch. Added enabled/disabled parity for
  queue acknowledgement, revoked access and externally owned transactions.
- Durable failure coverage: medium, patch. Added matching stage/original-error
  assertions and SQL call parity for run-read and manual-layout failures.
- Rollback attribution: low, patch documentation. Failed phase intervals include
  cleanup and are excluded from normal-path bottleneck attribution.
- Reproducible capture: medium, patch. Recorded flag, launch, timestamped closed
  event capture, repeated-stage pairing and parent/child gap accounting.

## Verification

- Helper TDD: two expected RED assertions, then six GREEN tests; full mobile
  Jest 39 suites / 383 tests; helper coverage 100% in all four categories.
- Real SQLite: 51 pass, including phase-enabled/disabled semantic parity.
- Mobile TypeScript/lint, root `npm run check`, `git diff --check`: pass.
- Native build/Doctor not repeated for JS-only dependency-free instrumentation;
  prior SDK patch mismatches remain. No commit/push.

## Owner-operated Android result

Owner confirmed `Recheck completes`. Fresh-process fixed events corroborate one
complete parent retry, one rebuild and one subsequent durable read. Each phase
has ordered START/COMPLETE pairs within its local operation correlation. No
interrupted phase was used. Only aggregate epoch-log intervals are retained here.

| Interval | Seconds |
| --- | ---: |
| Parent retry START to COMPLETE | 69.292 |
| Rebuild OPEN start to COMMIT completion | 57.749 |
| Rebuild input phase | 0.285 |
| Graph/correction processing, including its existing SQL | 40.326 |
| Projection persistence, including country/qualification CPU | 16.916 |
| Commit | 0.167 |
| Rebuild controller COMPLETE to durable OPEN start | 0.003 |
| Durable OPEN start to final PROJECTION completion | 11.478 |
| Durable destination query and label calculation | 11.276 |
| Durable completion to parent COMPLETE | 0.000 at log precision |

Destination work accounts for 98.2% of this durable-read interval. Other measured
durable phases each completed in at most 0.066 seconds; the two PROJECTION
occurrences took 0.001 and 0.010 seconds. This localizes the earlier post-rebuild
tail to `readDestinationLabels`, not a demonstrated render or schema delay.
That helper combines one query, duplicate-family resolution, grouping and
`destinationLabel` calculations: these measurements do not separate those costs.

This is one instrumented Android run, not a controlled before/after comparison,
representative distribution, iOS result or speed-improvement claim. Next bounded
work is to distinguish destination query from JavaScript computation and validate
any proposed optimization against unchanged labels and evidence semantics.
Graph/correction processing remains the largest overall phase and is separately
measured; do not merge reconstruction-rule changes into destination profiling.

After capture, restarted the verified Metro server without the opt-in flag and
reopened Travel Life in a fresh process. The probe code remains available for
scoped follow-up; normal development mode does not emit phase events.
