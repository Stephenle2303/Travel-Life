# Travel Life evaluation mechanism

This directory separates infrastructure validation from product-quality evaluation.
The current executable runner checks a trace envelope and evidence references.
It does not invoke a model, reconstruct trips, grade factual accuracy, or decide
release readiness. Every report explicitly marks product quality as not measured.

## M2.4 engine regression evidence

The local `reconstruction-v1` suite contains 35 synthetic deterministic cases for
the approved spatial, visit, journey, possible-merge, GPS-less, duplicate,
uncertain-evidence, owner-boundary, usual-area, and input-order rules. On
2026-10-11, the focused suite passed 35/35 cases; the unrestricted mobile check
passed 21 suites / 144 tests, TypeScript, lint, and Expo Doctor 21/21; the
foundation check passed 20 tests and evaluation smoke. These are code-contract checks only:
`product_quality: not_measured`.

The optional AI sample was not run. The production kill switch remains disabled,
so no session, network request, provider result, cost, latency, or model-quality
claim was produced. M2.6 still owns actual incremental/background reconciliation;
the M2.4 final-input permutations exercise the pure local rebuild only.

## Run the current checks

```powershell
npm run evals:smoke
npm run evals:run -- --input evals/fixtures/passing.jsonl
npm run evals:run -- --input evals/fixtures/failing.jsonl
npm run evals:run -- --input evals/data/private/traces.jsonl --output evals/runs/experiment.json
```

The failing fixture is an intentional negative control and returns exit code 1.
The smoke command succeeds only when valid fixtures pass AND that control fails.
The runner exits 2 for malformed/empty input or invocation errors, and 0 only when
all contract checks pass. Reports go to ignored `evals/runs/` by default. The runner
performs no network requests and prints summaries, not trace contents.

## Trace contract

See `schemas/trace.schema.json` and the two JSONL fixture files. This is a provisional
evaluation adapter format, not the app's production data model.

- Identify case, dataset version, split, data origin, and run/repetition.
- Record pipeline, provider, model, prompt versions and measured latency/cost.
  Use null for unknown measurements, never an invented zero.
- Carry evidence IDs, evidence kinds/payloads, output claims, and references.
- Optional `steps` preserves intermediate trace events for later error discovery.
- `consented-real` requires a consent record ID. Its presence is not verification
  of consent; people and access controls govern that boundary.
- `synthetic-plumbing` is restricted to the smoke split.
- Supported claims need evidence references. References must exist, IDs must be
  unique, confidence must be bounded, and abstentions cannot assert a value.
- These rules cannot determine whether cited evidence actually proves presence.

Raw payloads may contain personal data. Keep real datasets, annotations and reports
in ignored private directories; review and redact before sharing any artifact.

## Transition to meaningful AI evals

1. Define the first engine task and the human decision it supports.
2. Use the proposal in `design/reconstruction-plan.md` to discuss sampling and
   expected failures. These are hypotheses, not a discovered taxonomy.
3. Follow `generate-synthetic-data` if there are no traces: agree on realistic
   dimensions/tuples before generating a representative synthetic dataset.
4. Run actual pipeline inputs and capture outputs/intermediate steps.
5. Use `error-discovery` for human review and open-ended notes, then summarize
   observed failure modes. Keep a record of reviewer disagreements.
6. Add objective rules with `write-code-eval`. Use `write-judge-prompt` only where
   interpretation is needed, followed by `validate-evaluator` against human labels.
7. Compare a baseline and candidate on the same versioned cases and report slices,
   denominators, abstentions, uncertainty and repeat runs. Tune on development data;
   preserve holdout independence. Use `eval-audit` before relying on the process.

We have installed the skills for these steps; we have not run a product-quality
evaluation or calibrated any judge. `evaluate-rag` is available if a future
retrieval feature warrants it.

## Releases and CI

CI runs installation integrity, harness unit/CLI tests and synthetic plumbing
controls. No API credentials, private datasets or paid model calls are required.
Later, AI behavior changes should attach a separately reviewed quality comparison
to the story/PR. Choose quality thresholds after measuring a baseline and deciding
the cost of false visits, omissions and correction burden. No thresholds have
been invented for this foundation.

A human-approved holdout and a calibrated evaluator are prerequisites for credible
quality claims. A 100% contract pass rate is not a reconstruction accuracy score.
