# Combined development workflow

## Responsibility boundaries

| Layer | Owns | Produces |
| --- | --- | --- |
| BMAD | Problem, scope, UX, architecture, stories and course correction | Brief/PRD, architecture decisions, acceptance criteria, delivery record |
| ECC | Research, small changes, tests, code quality, security, verification | Implementation evidence and concise handoff within that delivery record |
| evals-skills | AI behavior diagnosis and evaluator validity | Reviewed failure modes, datasets, objective checks or calibrated judges, comparison reports |

We use one product backlog and one delivery record per change. Frameworks are
tools for the work; installing a skill does not authorize executing its workflow,
starting the app build, publishing, or uploading personal data.

## Planning for the current MLP

The current goal is Minimum Lovable Product (decision 0009): private lifetime map
reveal, replay video and owner-selected sharing. The user selected both iOS and
Android. The working MLP spec and decision 0002 record the starting scope and
technical defaults. The active
backlog uses M-prefixed IDs. Its retired discovery-first Epic 1 and G0 gate are not
prerequisites. Do not start interviews, recruitment or a competitor study by default.

1. Read project state, the working MLP spec and the selected defaults.
2. Use a scoped delivery story; refine BMAD requirements/UX/architecture only where
   implementation needs a concrete decision. Document count is not a gate.
3. Put bounded source/device feasibility checks inside import implementation.
4. Put small reviewed regression/evidence checks inside engine implementation.
5. Ship the verified core, then use consent-aware feedback and error discovery to
   grow eval data and decide the next iteration. Formal planning workflows may be
   useful later; they must not recreate the explicitly removed research prerequisite.

## Deliver a scoped change

1. Establish the story/spec and acceptance criteria. Research existing solutions
   with ECC `search-first`; keep technology selection proportionate.
2. For behavior changes, identify meaningful failing tests and edge cases. ECC
   `tdd-workflow` guides red/green/refactor. Documentation-only edits need review,
   not contrived tests. Use the repository's actual commands.
3. If model, prompt, inference, evidence handling, or orchestration behavior
   changes, follow the evaluation loop below as well as software tests.
4. Implement the smallest coherent change. Record decisions and migrations.
5. Use BMAD code review for delivery review, with ECC coding/security guidance
   where relevant. Resolve findings and run applicable verification checks.
6. Attach results, known limitations, and evaluation dataset/version identifiers
   to the existing delivery record. Update project state and decisions.

Do not create an extra approval ritual for routine choices already authorized by
the user. Escalate unresolved product choices that materially alter their intent.
Do not impose a fixed coverage percentage as evidence of AI accuracy.

## AI evaluation loop

1. **Define the experiment:** task, baseline, dataset unit, anticipated failure,
   privacy boundary and measurable outcome. Use the experiment template.
2. **Collect evidence:** consenting real examples when available. With no traces,
   propose synthetic dimensions using `generate-synthetic-data` and obtain domain
   review before treating generated cases as representative.
3. **Run the engine:** preserve inputs, intermediate evidence decisions, output,
   configuration versions, latency/cost and run identity. No engine exists yet.
4. **Review traces:** `error-discovery` with a human reviewer; use free-text notes
   before freezing a failure taxonomy. Do not substitute AI-created labels.
5. **Choose checks:** `write-code-eval` for objective rules; `write-judge-prompt`
   only for criteria needing interpretation. Use `validate-evaluator` to test
   judge decisions against human labels before relying on them.
6. **Compare:** keep tuning and holdout data separate at person/library/trip level
   as appropriate. Compare baseline/candidate on the same cases, show counts and
   slices, handle abstentions explicitly, and record repeat runs for stochastic tasks.
7. **Decide:** use thresholds chosen from evidence and user costs. A metric without
   labels or a credible denominator is unmeasured. Retain regressions as reviewed
   fixtures. Audit the pipeline with `eval-audit` as it becomes substantive.

`evaluate-rag` remains installed for future retrieval features; it is not a reason
to add RAG now. The initial local runner checks only trace contracts/provenance.

## Completion evidence

A delivery record links the request, criteria, changed artifacts, software checks,
AI comparisons when applicable, and unresolved limits. A fixture smoke pass means
the development infrastructure works; it never substitutes for product validation.
