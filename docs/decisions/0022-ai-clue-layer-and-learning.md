# Decision 0022 — AI adds clues, rules decide, corrections teach

Date: 2026-11-19
Status: Accepted by the owner in chat (direction and three refinements).
Not implemented. Starts after M10 (decision 0021).

## Decision

- **Core first, AI second.** The rule engine builds the Atlas and Possible
  trips. Afterwards, in the background, an AI layer works on what the rules
  could not settle, mainly Possible trips and photos without location.
- **AI adds evidence, never edits results.** Every AI output is a versioned
  clue record (for example "sign text reads Seoul", "this photo was received,
  not taken", "these two Possible trips look like one holiday"). The same core
  rules re-decide with those clues, so every outcome keeps a plain reason,
  rebuilds stay repeatable, and there is still one decision-maker.
- **Quiet work, visible change.** AI runs in background maintenance windows.
  It never removes a trip from the Atlas on its own, never touches
  owner-reviewed trips, and its changes appear as a short "trips updated"
  note. A clue class may move a trip from Possible trips to the Atlas only
  after the eval shows it is reliably right and the owner approves.
- **Two kinds of learning.** Personal learning is automatic and on the phone:
  each correction becomes a personal rule the owner can see and remove.
  Product learning is gated: new rule or model versions ship only after the
  eval engine shows no regression and the owner approves activation. Nothing
  modifies itself.
- **The eval engine is the gatekeeper.** It combines the synthetic benchmark
  (which catches missing trips that corrections never reveal), Possible-trip
  keep/reject rates, and frozen hard cases. AI never grades AI without
  calibration against owner judgments.
- **Privacy.** On-device AI only for photos (decision 0019). Clues and
  personal rules stay private; the cloud metadata proposal path stays off.

## Context

The owner proposed a background AI engine that strengthens the rule result
and learns from corrections. The review kept the order and the learning goal
and changed three things: AI produces evidence rather than edits, changes are
visible, and learning is split into personal and gated product learning.

## Consequences

[SPEC-ai-clue-layer](../../_bmad-output/specs/spec-ai-clue-layer/SPEC.md),
roadmap epic M11. Existing visual-place and travel-window outputs become clue
producers instead of separate trip state. Decisions 0004, 0017, 0018, 0019,
0020 and 0021 remain in force.
