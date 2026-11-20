# Eval engine and gate (CAP-8)

Extends the M10 lifetime benchmark (`lifetime-synthetic-v1`) and the existing
`evals/` runner. Follows the evals-skills loop: human-reviewed labels, objective
code checks first, calibrated judges only where interpretation is needed.

## Inputs

1. **Synthetic benchmark with clues.** Each M10 scenario gains clue variants:
   correct clues, missing clues, wrong clues (wrong country, wrong source,
   false same-trip) and conflicting clues. Wrong clues must never produce a
   wrong country, a wrong Atlas trip or a removed Atlas trip.
2. **Producer fixtures.** Existing public landmark, signage and Nano honesty
   fixtures (`evals/landmarks/`) score each producer's precision and
   abstention separately from trip outcomes.
3. **Frozen hard cases.** Each owner-reported problem is reproduced as a
   synthetic case (no owner data), reviewed by the owner, and frozen; it can
   never regress.
4. **On-device aggregates.** Counts only, computed on the phone: Possible-trip
   keep/reject rate per reason and per clue kind, owner corrections after an
   AI-driven change, removed personal rules, "updated" notes opened. No IDs,
   places or dates leave the phone; collection follows the diagnostic recipe.

## Metrics

Per version, with denominators: Atlas recall, Possible recall, false Atlas
trips, wrong-name count (must be 0), wrong-country count (must be 0), Atlas
removals by AI (must be 0), Possible-card count, keep rate, abstention rate
per producer, rebuild time and pass budget use.

## Gate

A rule version, producer version or promotion class activates only when:

- no frozen case regresses and benchmark metrics do not get worse;
- wrong-name, wrong-country and AI-removal counts are 0;
- for a promotion class: ≥95% precision on at least 40 labeled cases of that
  class across benchmark and owner-reviewed hard cases, reported with counts;
- the owner approves the report in a development build.

Activation records the version; rollback re-selects the prior version and
rebuilds. Synthetic results never claim real-library accuracy; real-library
quality stays `not_measured` until owner-labeled cases exist.

## Reports

Deterministic JSON per run under ignored `evals/runs/`, plus a committed
summary per accepted version. Reports list every metric with counts, the
versions compared and the cases that changed.
