# Human trace review

Use the installed error-discovery skill after actual traces are available.
Store private annotations in `private/` (ignored by Git).

Each annotation should identify case/run, reviewer, time, free-text observation,
pass/fail/unknown where defined, and any adjudication. Keep human reference labels
separate from model outputs and judge outputs. Do not manufacture labels to fill
a template. Turn repeated observed failures into evaluator candidates only after
review. Version the rubric and preserve the split used for judge calibration.
