---
title: 'Separate destination-label phase costs'
type: 'chore'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent">

## Intent

The completed Android profile attributes 11.276 seconds to the combined
destination-support query and label calculation. Split this developer-only
measurement into fixed retrieval and computation phases so the next optimization
targets evidence rather than a guess. Preserve every SQL statement, transaction,
destination label, duplicate-family rule, privacy boundary and owner-visible flow.
No schema change, index, dependency, commit, push, storage reset or install is
part of this work. Collect one fresh owner-operated recheck after verification.

</frozen-after-approval>

## Implementation Notes

- No intent gap or irreversible operation. This is a small extension of the
  existing opt-in phase profiler; it is disabled in ordinary development and
  production.
- Footprint: repository phase transitions and privacy-focused phase/profile
  regressions. Reuse the existing fixed diagnostic boundary and correlation.
- Measure only the query separately from duplicate-family resolution, grouping
  and `destinationLabel`; do not treat either wall interval as isolated native
  SQL or CPU time. Verify labels, calls, parameters, returns and failures are
  identical with profiling enabled and disabled.

- Implementation: `readDestinationLabels` now emits `DURABLE_DESTINATION_QUERY`
  around its existing support query and `DURABLE_DESTINATION_COMPUTATION` around
  unchanged family validation, grouping and label computation. The durable-read
  error stage stays `DURABLE_DESTINATION_READ`; detailed native errors remain
  in memory only.

## Owner-operated Android result

The owner confirmed the recheck completed. A fresh parent retry has one rebuild
and one paired durable profile correlation. Query took 1.096 s and computation
took 10.422 s, totaling 11.518 s; other durable phases remain below 0.067 s.
The earlier startup durable profile is a separate correlation and is excluded.
This identifies offline destination computation as the dominant part of the
durable-read tail. It does not establish the exact cost of family validation,
grouping, polygon lookup, or label assembly inside that computation interval.
It is one Android run, not a before/after speed claim.

## Verification

- RED: the real-SQLite profile assertion failed until both new fixed stages
  existed.
- GREEN: 51 real-SQLite tests, focused destination/profile Jest tests (10),
  TypeScript, lint, root `npm run check` and whitespace validation pass.
- A complete mobile Jest run was launched directly but the terminal invocation
  returned after its 30-second host limit without a terminal summary. Two hidden
  Windows reruns produced no child output, so they are not counted as checks.
  This does not affect the focused or real-SQLite results.
- Two blind-review workers did not return findings before interruption. Direct
  diff review confirmed the split only inserts fixed profile transitions and
  passes no records, SQL or result values to diagnostics. No commit or push.

## Review Triage Log

- No returned blind-review findings: reviewer workers were interrupted after no
  response. Direct review covered fixed event order, error-stage preservation,
  optional helper use in the journey-detail path, and the closed diagnostic
  shape. No additional issue was found.
