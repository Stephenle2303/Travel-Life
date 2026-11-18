---
title: 'Refresh the generated history-domain bundle'
type: 'bugfix'
created: '2026-11-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The foundation check fails because the checked-in backend history-domain bundle no longer matches its TypeScript source graph.

**Approach:** Regenerate the bundle with the repository-owned generator so the stale-artifact guard and complete foundation check pass.

</frozen-after-approval>

## Implementation Notes

- This refresh changes generated output only. The existing M7 delivery record already maps the runtime history diagnostics; no new runtime boundary, diagnostic category, collection path, or deployment is introduced.
- `node scripts/build-history-domain.mjs` refreshed only the generated source digest and matching exported digest in `supabase/functions/_shared/history-domain.js`; the generator's `--check` mode then passed.
- `npm run check` passed: framework integrity, all 281 foundation tests including the generated-graph guard, and the eval smoke check.
- Reproduce the artifact guard with `node scripts/build-history-domain.mjs --check`. The regenerated bundle matches the prior bundle byte-for-byte after normalizing its two source-digest values, so the refresh does not change worker behavior.

## Review Triage Log

- false — the stale guard is exercised directly by the foundation test; the failed pre-fix run proved it rejects an out-of-date bundle without a separate corruption fixture.
- defer / medium — the generator's raw stale error has no remediation text, and direct writes could leave a partial bundle if interrupted. Both predate this digest refresh; improve diagnostic text and use atomic output in a separate generator-hardening task.
- false — the source-root guard includes a trailing path separator, so a sibling `src-shadow` path does not pass it.
- false — direct comparison proved the generated body is identical to `HEAD` after source-digest normalization; only the two digest metadata values changed.
- false — the exact prior source input that produced the stale committed digest is not recorded and cannot be truthfully named after the fact; the incident record states the established cause and correction.
- low rejected — duplicating the generated digest in project state would add volatile metadata; the checked-in artifact and reproducibility command are the source of truth.
- patch — the delivery record now includes the exact `--check` command.
