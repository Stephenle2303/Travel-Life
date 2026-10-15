# M4.1 device validation

Run this checklist on a private, non-production photo library on both iOS and
Android. Do not capture or commit raw media IDs, photos, exact coordinates, or
owner-entered names. Record only pass/fail, platform, app build, and aggregate
counts.

## Preconditions

- Build from the current M4.1 worktree.
- Connect a private record and grant broad photo-library access.
- Import at least two strictly ordered destinations, one GPS-less or unsupported
  photo, and one unavailable or limited-access photo when the platform permits.

## Required checks

| Check | Expected result | iOS | Android |
| --- | --- | --- | --- |
| Confirm and add later evidence | Confirmed reviewed facts remain distinct from later inferred additions. | ☐ | ☐ |
| Reject a journey | The rejected grouping does not reappear after a relaunch or catch-up; source evidence remains. | ☐ | ☐ |
| Owner claim | Exact and approximate owner dates remain separate from observed span after relaunch. | ☐ | ☐ |
| Destination removal | The journey projection changes while supported place and country totals remain unchanged. | ☐ | ☐ |
| Memory review | The uncertain-memory list pages and date-searches locally; assign/move/reject adds no visit or place support. | ☐ | ☐ |
| Split and merge | Strictly ordered controls publish successors immediately; predecessor claims show pending scope review. | ☐ | ☐ |
| Pending remap | Interrupt a corrected successor mapping if feasible; the prior complete projection remains visible and the correction can be revised, retained, or discarded. | ☐ | ☐ |
| Lifecycle safety | Disconnect or revoke access while a preview is open; save is refused and no stale result appears. | ☐ | ☐ |

## Result record

Record platform, app build, date, pass/fail per row, and a short aggregate-only
note. A failure remains open until its reproduction, correction, and rerun are
recorded in `docs/development/error-playbook.md`.
