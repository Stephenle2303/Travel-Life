# Foundation setup verification

Date: 2026-10-06 (Asia/Bangkok).

## Installed state

- BMAD official installer 6.12.1: core + bmm; Codex target; 29 skills; no legacy shims.
- ECC 2.2.3: six selected engineering skills, unchanged upstream copies.
- evals-skills commit 80d5f7b0127c7572ed9e9339937adbfd7240ffeb: nine skills.
- Total: 44 project skills. framework.lock.json records their sources and digests,
  plus four BMAD runtime trees.
- Git initialized on main. No commit, remote, push or deployment was created.
- Original product analysis copied without modification; SHA-256:
  72ecb2c8ac8e0f9bafa2f994dd1ec825ea9491c40692ddb56a5d0781beb4b08a.

## Validation evidence

- Node 24.21.0; uv 0.12.13; tooling virtual environment uses Python 3.12.14.
- Test-first check failed as expected before the eval runner existed.
- Harness tests cover valid/invalid traces, missing run metadata, nonexistent or
  duplicate evidence, duplicate claims, abstention, confidence bounds, costs,
  consent references, split labelling, empty/malformed JSONL, duplicate observations,
  and CLI success/failure exit codes.
- Integrity tests cover cross-platform line endings, ignored bytecode caches,
  unreviewed extra files and binary asset drift.
- Eval smoke uses two valid synthetic plumbing examples and one intentionally
  invalid evidence reference. No model is involved.
- BMAD config resolver successfully returned the merged Travel Life settings.
- BMAD renderer successfully produced a local workflow snapshot for bmad-build;
  the workflow was not executed. Generated snapshots remain ignored.
- Git ignore checks confirmed private data, evaluation reports, personal BMAD
  config, caches and source downloads are excluded.
- Ajv upgraded to 8.20.0 after a dependency advisory was discovered; npm reported
  zero vulnerabilities across the six audited packages after that update.

Final `npm run check`: 20 tests passed, 44 skill digests and four runtime trees
verified, and both positive/negative smoke controls behaved as expected. An actual
local JSON report was written to `evals/runs/setup-smoke.json`. CI is defined but
has not run remotely. The dependency audit covers the root npm tooling dependency
tree, not every upstream script or the discarded installer cache.

## Limits

No application build, reconstruction model, real-user dataset, human quality labels,
LLM judge, calibrated quality threshold, or AI-quality evaluation has been run.
Passing these checks establishes the foundation's behavior only. Runtime stack and
model choices remain open. Installed skills are available to Codex on the next turn;
a fresh project chat may be needed if its skill catalog is cached.
