# Sprint Change Proposal — M10.8 adoption gate: premise invalidated, CAP-3 reprioritized

## 1. Issue summary

CAP-8's acceptance criterion ("activation needs owner approval... selecting
V1.1 again reproduces the prior result exactly") assumes v1.2 is still
*pending* an owner-approved switch from v1.1. It isn't. M10.3/M10.4 switched
`reconstruction/repository.ts`'s rebuild call site directly from
`qualifyGraphJourneyV11` to `qualifyGraphJourneyV12`, with no feature flag,
no stored policy selector, no gate in front of it. v1.2 has been the sole,
unconditionally active production rule since that commit — confirmed in
[delivery-and-diagnostics.md](../specs/spec-trip-recognition-repair/delivery-and-diagnostics.md)'s
own 2026-11-20 re-examination note. There is no pending "activate v1.2"
decision left for a dry-run/activation screen to gate.

Separately, M10.2's first real device data (76 journeys read from the
owner's own phone, 2026-11-20) shows CAP-3's still-unbuilt Possible-trips
card UI is not a minor gap: `near-home` alone accounts for 42% of every
detected episode (84% of all Possible trips). That's the single biggest
piece of unrealized M10 value sitting idle right now.

## 2. Impact analysis

- **M10.8 / roadmap Stage 4 ("Adopt")**: the originally-scoped "dry run →
  owner approves → activation" gate was never built as architected; a
  direct, ungated code switch replaced it. Building the dry-run/activation
  screen today would compare v1.2 against v1.2 — nothing to gate. It's also
  absent from SPEC.md's own Non-goals allowlist ("UI changes are limited to
  the Possible-card reason line and Set Home action... removing Home 'Skip
  for now'... Home period control" — no dry-run screen listed).
- **Rollback is real and unaffected**: v1.1 (`qualifyGraphJourneyV11`) stays
  exported and byte-unchanged; selecting it again at the one call site
  reproduces the exact v1.1 benchmark column. CAP-8's rollback intent is
  satisfied today — just not through an owner-facing UI gate, because that
  gate was never the actual mechanism adoption went through.
- **CAP-3** (Possible-trips card: reason sentence + Set Home button) is
  explicitly in SPEC.md's Non-goals allowlist, was blocked only on
  `mobile-screens.tsx` being free (resolved 2026-11-20), and its
  diagnostics (`HOME_NOT_SET` and the other 10 closed reason codes,
  `REBUILD_QUALIFY_PROFILE`) are already built and sitting idle per
  delivery-and-diagnostics.md. M10.2's aggregate (24 `AUTO_CONFIRMED` / 38
  `SUGGESTED` / 14 `NOT_TRIP` of 76) makes the priority concrete: half the
  owner's library resolves to a state with no UI today to see why, or to
  act on it.

## 3. Recommended approach

**Scope reduction, not rollback.** Close M10.8's owner-facing UI item on
paper: adoption already happened (direct code switch), rollback stays
provably intact, and a dry-run gate is deferred until an actual future rule
change (v1.3+) needs one to compare against — consistent with
delivery-and-diagnostics.md's existing 2026-11-20 note on this exact point.
Redirect the next engineering slice to CAP-3's Possible-trips card UI,
ahead of M10.7's deferred remainder.

This is a **minor change**: no shipped engine behavior changes, no rollback
required, no private evidence or architecture affected. It reclassifies one
roadmap line and redirects the next slice of work.

## 4. Detailed changes (pending approval below)

### Roadmap — Stage 4 "Adopt" (M10.8)

**OLD:** "Revision-bound dry run, owner-approved activation, correction
preservation and rollback on the owner's phone" — owner-facing UI unblocked
but not yet started.

**NEW:** Pure dry-run/rollback core and correction preservation stay done
and proven (`summarizeOutcomeDelta`, byte-unchanged v1.1 rollback path). The
owner-facing dry-run/activation screen is **closed, not built** — v1.2 was
already adopted directly with no gate to present; revisit only if a future
rule version (v1.3+) needs a real approval gate.

**Rationale:** Building UI for a decision that already happened
unconditionally in code is speculative work with no real user need today.

### Backlog (CSV) — M10.8

**OLD:** status `in-progress`.

**NEW:** status `done` (core + rollback proven); owner-facing UI descoped
per this proposal, not left pending.

### SPEC.md — CAP-8 success criterion

**OLD:** "...activation needs owner approval... selecting V1.1 again
reproduces the prior result exactly."

**NEW (if accepted):** annotate that activation already occurred via direct
call-site switch (no owner-facing gate was built); accept this as
satisfying CAP-8's rollback half, and formally descope the approval-gate
half unless a future rule change needs it.

### Next engineering slice

**NEW:** CAP-3's Possible-trips card (reason sentence + Set Home button),
built on the already-shipped `AppDiagnosticReasonCode` 11-code set and
`REBUILD_QUALIFY_PROFILE` diagnostics, becomes the next story — ahead of
M10.7's deferred remainder and M10.8's now-closed item.

## 5. Decision needed from the owner

1. Close M10.8's UI item on paper as scoped above (no code to write), and
2. Start CAP-3's Possible-trips card UI next —

or direct otherwise (e.g., build the dry-run screen anyway now, as
future-proofing ahead of a v1.3 that doesn't exist yet).
