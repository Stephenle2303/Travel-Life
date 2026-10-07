# 0001: Integrate BMAD, ECC and evals-skills

Date: 2026-10-06
Status: adopted for foundation setup under the user's request

## Context

The product is in discovery. The user requested these three repositories as the
development foundation before application implementation. Multiple frameworks
overlap in planning, agents, testing and review.

## Decision

Use BMAD 6.12.1 for planning/delivery, a focused ECC 2.2.3 skill set for engineering,
and commit-pinned evals-skills for AI quality work. Install locally to the project
and keep upstream files unchanged. Put integration policy in AGENTS.md and docs.

Use Node's test runner and Ajv for a small offline evaluation contract harness.
This does not decide the application stack. Keep model/provider selection open.
Begin with trace/provenance checks and honest smoke evidence. Add behavioral
evaluators after reviewing traces and validating expected outcomes.

## Alternatives and consequences

- A full global ECC plugin offers more runtime features, but broadens setup beyond
  this project and overlaps with BMAD. It can be considered separately later.
- BMAD main includes a newer install layout; stable pinning makes this foundation
  reproducible while avoiding an implicit prerelease migration.
- A hosted eval platform could later supply tracing, datasets and dashboards.
  No provider is selected until the engine, data boundary and needs are known.
- Copied skills require deliberate upgrades. The integrity lock and retained
  licenses make the installed scope and changes inspectable.

Revisit after the first real AI experiment or when an upstream change is needed.
