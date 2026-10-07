# Project state

Updated: 2026-10-06 (Asia/Bangkok).

## Current stage

Foundation and discovery with a proposed roadmap. The user requested ECC + BMAD +
evals-skills setup, then BMAD party planning with prioritized epics and stories.
The product itself has not been built. No GitHub remote, deployment, production
dataset, AI provider, or paid service has been configured.

## Established direction

- Mobile product: reconstruct history from existing travel evidence.
- Journey and lifetime record are the central objects.
- Prioritize trustworthy reconstruction, exploration, and minimal maintenance.
- Validate the emotional experience and comparative value before expanding scope.
- Keep original media at its source where feasible; derived history is sensitive too.

## Foundation delivered

- BMAD 6.12.1, core + method, official Codex installation (29 skills).
- Six ECC 2.2.3 skills installed at project scope.
- Nine evals-skills from commit 80d5f7b0127c7572ed9e9339937adbfd7240ffeb.
- Integrated workflow, source/version records, trace contracts, offline fixture
  checks, and a CI definition. See `docs/development/setup-verification.md` for
  actual validation evidence.

## Planning delivered

- Proposed Phase 0–8 roadmap, 13 epics and 49 stories saved in
  `_bmad-output/planning-artifacts/`. The canonical backlog is `epics.md`;
  `backlog.csv` is a derived filterable view.
- Detailed drafts for Phase 0–1, provisional maintenance stories and conditional
  expansion options. No sprint or delivery dates are committed.
- Evaluation roadmap covering reference labels, baseline, error discovery,
  evaluator validity, held-out comparisons and correction persistence.
- Party discussion recorded in
  `_bmad-output/party-mode/2026-10-06-roadmap-discussion.md`. Proposals are not user approvals.
- Implementation readiness is FAIL pending source, semantics, scoped PRD, UX,
  architecture and evaluation evidence. No approved implementation specification exists.

## Open decisions

1. Initial traveller segment, geography, and native photo source/platform.
2. Definitions: visit, trip, transit, residence, duration, destination and route.
3. Supported evidence, abstention behavior, correction semantics and provenance.
4. On-device/server split, media retention, sharing defaults and deletion behavior.
5. AI tasks that need models versus deterministic processing; provider/model choice.
6. Evaluation unit, representative data, reviewer, and evidence-based release gates.
7. Application architecture and stack.

## Next work

Follow the proposed roadmap queue: 1.1 initial study segment, 1.2 native-source
feasibility, 1.3 travel/evidence semantics and 1.4 consent/reference/evaluation
protocol. Execute only the subsequently authorized scope; this turn saved planning
artifacts and did not recruit participants, collect private data or build a prototype.
Then run a bounded baseline/comparative study, create the scoped brief/PRD, UX and
architecture, and record the G0 decision before starting application delivery.
See `_bmad-output/planning-artifacts/README.md` for links and readiness findings.
