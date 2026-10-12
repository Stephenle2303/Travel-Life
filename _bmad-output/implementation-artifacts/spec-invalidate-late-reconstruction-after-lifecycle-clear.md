---
title: 'Invalidate late reconstruction after lifecycle clear'
type: 'bugfix'
created: '2026-10-12'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-m2-1-build-metadata-baseline-and-local-history-model.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A reconstruction already awaiting its repository can publish a completed or failed view after disconnect or deletion clears the in-memory private graph, making stale private state visible again.

**Approach:** Invalidate active reconstruction generations when lifecycle code clears the controller, and ignore every completion or failure belonging to an invalidated generation while allowing a later owner-started rebuild.

</frozen-after-approval>

## Implementation Notes

- Added controller generation ownership so `clear()` invalidates an awaiting rebuild without allowing its result to publish.
- Independent review found that immediately releasing the controller could overlap transactions on the shared SQLite connection and reopen work before lifecycle completion. The controller now suspends rebuilds on clear, keeps repository calls serialized, and resumes only when provider lifecycle state is connected.
- Added focused regressions for late completion/failure after clear, notification silence, repository serialization, and reconnect-controlled resume.
- Verification: focused controller/provider tests passed 10 tests; the final full mobile suite passed 21 suites / 152 tests; TypeScript, Expo lint, root `npm run check`, and `git diff --check` passed. Physical lifecycle interruption and SQLite transaction behavior remain unverified.

## Review Triage Log

- `high`, patched: releasing the running guard after clear allowed overlapping rebuild transactions on the shared SQLite connection; lifecycle suspension now retains serialization until the old call settles.
- `high`, patched: clear occurred before disconnect/delete completed, so another rebuild could start while the UI still showed connected; rebuilds now remain suspended until provider lifecycle state reports connected.
- `medium`, patched: final-state-only tests could miss a transient stale notification; late success/failure tests now assert the notification count after clear.
- `false`: the compact delivery record follows the BMAD one-shot format, which intentionally omits full Code Map and acceptance sections for a small reversible change; implementation and verification evidence are recorded here and in project state.

