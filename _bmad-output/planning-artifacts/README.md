# Travel Life MVP planning

**Current product goal: Minimum Lovable Product (MLP).** Decision
[0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md) defines its
private lifetime map reveal, replay and selected-sharing bar. Existing filenames
remain historical only.

Revision 7, 2026-10-07, records the working MLP scope for iOS and Android; the old
discovery-first plan remains retired.

- [Roadmap](roadmap.md): five delivery epics and rollout learning.
- [Working MVP spec](mvp-spec.md): product flow, data/inference rules, selected defaults.
- [Epics and stories](epics.md): 27 planned stories, 25 P0 and two P1.
- [Filterable backlog](backlog.csv): derived view of the same M-prefixed story IDs.
- [Lightweight evals](eval-roadmap.md): small pre-beta regressions, real-case learning after rollout.
- [Implementation readiness](implementation-readiness.md): scope-ready after an initial clean baseline; actual release checks pending.
- [Decision 0002](../../docs/decisions/0002-mvp-first-delivery.md): accepted strategy and agent-selected defaults.
- [Decision 0004](../../docs/decisions/0004-background-maintenance-in-mvp.md): required background maintenance.
- [Decision 0005](../../docs/decisions/0005-interactive-journey-sharing.md): safe interactive share mechanism.
- [Decision 0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md): required lifetime reveal, replay and selected-highlight sharing.
- [Decision 0006](../../docs/decisions/0006-photo-trip-assignment.md): adopted photo assignment and journey boundary rules.
- [Decision 0007](../../docs/decisions/0007-reconstruction-v1-parameters.md): fixed initial windows, cutoffs and clustering ties.
- [Continuing party discussion](../party-mode/2026-10-06-roadmap-discussion.md).
- [Superseded plan](history/2026-10-06-discovery-first/README.md): historical record only.

No research-first Epic 1, interview quota or market-validation G0 blocks development.
No app was built during this revision.

## Verification

Revision 7 retains five epics, 27 unique stories and 81 unique acceptance criteria.
The 11 changed planning/decision/instruction documents have no broken local links,
and the fixed v1 parameter table contains all required cutoffs.
Required maintenance, interactive-link and replay stories are included in release
dependencies; P1 static-card work does not block the core.

`npm run check` passed: 44 skills/four runtime trees match their pins, all 20
foundation tests passed, and trace-contract smoke checks passed. These are planning
and tooling checks; app behavior, device scheduling, hosted links and video remain unimplemented.
