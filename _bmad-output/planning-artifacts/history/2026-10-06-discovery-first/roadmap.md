---
title: Travel Life evidence-gated roadmap
status: proposed
updated: 2026-10-06
implementation_authorized: false
---

# Travel Life roadmap

Build toward a travel record people recognize, trust, explore and want maintained.
First prove that one accessible photo source can create that value. Then deliver
a private alpha, a static-card beta and reliable maintenance. Treat identity,
replay, intelligence, Pulse, commerce and network as evidence-dependent options.

This proposal follows the source analysis's Phase 0–8 vision. The party session
changes the sequencing in three explicit ways: public web sharing becomes conditional
within Phase 1; private value and sharing are evaluated separately; later experiments
may skip replay or Pulse if the evidence supports another route. No platform,
application stack, model/provider or paid service has been chosen.

## Delivery sequence

| Stage | Outcome | Epics | Scope boundary | Evidence needed to advance |
| --- | --- | --- | --- | --- |
| Foundation — complete | BMAD + ECC + eval tools work locally | Existing setup | Infrastructure, not app quality | Existing setup report only |
| Phase 0 — next | Prove source feasibility, trust and comparative value | E01, 10 discovery stories | One candidate cohort/source, later bounded experiment; no full app | G0 |
| Phase 1A — private alpha | Connect → reconstruct → reveal → explore → correct | E02–E05, 20 stories | One native platform/source; source-linked media; honest facts; deletion/corrections | GA |
| Phase 1B — beta | Learn from real usage and optional sharing | E06, 4 stories | Static card first; linked web sharing conditional | GB |
| Phase 2 — living history | Maintain the record without lost corrections | E07, 4 stories | OS-permitted delta processing, reviewable updates, opt-in notifications | G2 |
| Phase 3 — identity | A factual representation worth revisiting | E08, 3 outlines | Patterns/passport/year summaries; test labels, avoid ranking | G3 |
| Phase 4 — replay | Extra emotional value from selected memories | E09, 2 outlines | Start with trip/year replay; expansion must justify cost | G4 |
| Phase 5 — intelligence | Useful answers and meaningful future intent | E10, 3 outlines | Compare history-informed utility against generic/filter baselines | G5 |
| Phase 6 — Pulse | Relevant, fresh world information | E11, 1 outline | One authorized-source use case before an ingestion platform | G6 |
| Phase 7 — business model | Revenue compatible with user trust | E12, 1 outline | Premium research can precede commerce; commerce requires intent evidence | G7 |
| Phase 8 — network | A demonstrated collaborative benefit | E13, 1 outline | Only after sustained product value and observed demand | G8 |

[Epics and acceptance criteria](epics.md) are the canonical backlog.
[backlog.csv](backlog.csv) provides filters by phase, priority, status and dependency.
There are 13 epics and 49 stories; 34 Phase 0–1 stories are detailed drafts.
The following 15 stories are provisional or strategic options.

## Priorities and the next work queue

P0 reduces existential uncertainty; P1 delivers the trusted core.
P2 is maintenance or conditional sharing. P3 is bounded expansion experiments.
P4 preserves strategic options. There is no numerical priority score because
reach, effort, confidence, cohort size and willingness to pay are not measured yet.

1. **1.1 — Initial study segment:** choose a narrow learning population and owner.
2. **1.2 — Source feasibility:** determine the first plausible native source/platform.
3. **1.3 — Travel semantics:** define presence, trip, transit, residence and date precision.
4. **1.4 — Consent and evaluation protocol:** references, reviewers, splits and study rules.
5. **1.5 — Bounded baseline experiment:** future execution after the necessary build/data authorization.
6. **1.6 — Comparative reveal/correction study:** test value against actual alternatives.
7. **1.7–1.9 — Brief/PRD, UX and architecture:** turn learning into implementable decisions.
8. **1.10 — G0 decision:** proceed, narrow, repeat or stop.

No sprint is committed. E01 is the next planning/discovery queue; it is not an
instruction to contact participants or upload media now. The source suggests
10–20 travellers for Phase 0. Use that as a qualitative planning range and report
the actual sample and selection limitations; it cannot establish population accuracy.

After G0, implement one vertical path through E02 → E03 → E04 → E05, keeping
a usable result and correction flow together. Subsystems may be designed against
synthetic contracts in parallel once architecture exists, but acceptance still
requires the earlier source/inference decisions and actual integration.
Then run E06, decide GB, and consider E07. Re-estimate S/M/L work after architecture
and split large stories before scheduling; no calendar or staffing assumptions exist.

## Gates and decision rights

These are proposed evidence packages, not passed gates or invented metric targets.
John owns product trade-off preparation, Mary owns research evidence, Sally owns
UX evidence, Winston owns technical/data decisions and Amelia owns verification.
The actual product owner and human reviewers must be named in E01.
The party has no authority to approve releases on the user's behalf.

| Gate | Required evidence | Decision |
| --- | --- | --- |
| G0: justify a product | Tested source scope; consented reference history; baseline/error slices; comparative study; permission/value/correction observations; scoped PRD + UX + architecture | Build one-source alpha, narrow, repeat discovery or stop |
| GA: private alpha is credible | Implemented E02–E05; evidence-derived quality rules; held-out report; correction stability; deletion/access tests; end-to-end UX and performance evidence | Admit a bounded beta or fix specific failures |
| GB: core value survives real use | Permission/completion denominators; trusted exploration; correction burden; cost; voluntary sharing reported separately | Pursue maintenance, narrow or repeat; a failed viral hypothesis need not discard private value |
| G2: maintenance is trusted | Actual new-trip opportunities; incremental/full consistency; false updates; preserved edits; accepted updates and post-trip return | Test identity, intelligence or another evidence-supported retention need |
| G3: identity adds value | Incremental identity/revisit/sharing value over the core experience | Test replay if emotional demand warrants it |
| G4: replay earns its cost | Completion/reuse/voluntary sharing and incremental benefit over simpler memory views | Expand replay or stop it; intelligence need not wait for replay |
| G5: intelligence is useful | Paired utility over generic baselines; supported answers; correctable preferences; meaningful saves/planning actions | Test Pulse and/or intent-based commerce |
| G6: Pulse adds relevant utility | Freshness, licensed/authorized sources, grounding, incremental relevance and operating cost | Expand one proven use case |
| G7: revenue preserves trust | Willingness-to-pay or incremental intent/action economics; disclosures; trust feedback; applicable payment/security checks | Choose a tested model; do not sell private travel histories |
| G8: collaboration adds value | Sustained core use, an observed shared task, visibility/isolation/removal/abuse policy | Build a bounded network capability or defer |

Record rules before confirmatory studies. Set release quality/resource budgets
using exploratory errors, user costs and calibration data; never tune them on
holdout results. A report may be inconclusive. Each decision records sample counts,
uncertainty, residual risks and a named decision-maker. See the
[evaluation roadmap](eval-roadmap.md) for task-specific evidence.

## Measures that answer the actual questions

- **Coverage and error:** owner-reviewed visit precision/false visits, recall/coverage
  on sufficiently complete references, uncertainty and unsupported-claim rate.
- **Journey structure:** split/merge errors, boundary error at agreed precision;
  do not treat observed photo spans as full trip duration.
- **Practicality:** processing completion, latency/cost distributions, relevant
  device resource use and failed asset access.
- **Control:** correction effort, confirmation/rejection rates, correction persistence,
  deletion/revocation correctness.
- **Value:** meaningful independent exploration and stated/observed desire to maintain
  the history, with actual task criteria defined in E01.
- **Sharing:** voluntary export, link conversion and subsequent connection are
  separate stages. Static cards may have incomplete downstream attribution.
- **Retention:** distinguish participants with a new travel opportunity from those
  without one; track post-trip return separately from between-trip utility.

The early north-star candidate remains **meaningful reconstructed and explored
travel histories**. Its operational definition is an E01 deliverable.
Downloads, photos scanned, map clicks and AI output counts are diagnostic metrics,
not substitutes for trusted user value.

## Scope deliberately deferred

Second native platform, desktop/cloud connectors, a guaranteed full Google Photos
scan, cinematic replay, generative trip stories, Travel DNA, recommendations,
Pulse, booking and community are outside Phase 1. Precise travelled distance,
complete trip-day counts or routes are omitted unless additional evidence supports
them. Accounts, a graph database and a server are architecture choices, not assumed
requirements. Willingness-to-pay research can be small and early; a paid system is
not a prerequisite for learning.

## Main uncertainties and reduction work

| Uncertainty | First reduction work | If evidence is weak |
| --- | --- | --- |
| Access to enough historical evidence | 1.2, 1.5 | Narrow source/promise rather than invent access |
| Owner presence and incomplete history | 1.3–1.5, E03 | Show uncertainty, abstain, improve evidence or reduce claims |
| Emotional/comparative value | 1.6 | Revisit segment or reveal; avoid adding future features |
| Correction effort and private trust | 1.6, E05, 6.2 | Fix the control flow before growth |
| Background feasibility/retention | E07 | Use truthful foreground maintenance or test a different need |
| Model benefit and cost | 1.5, 3.2–3.6 | Retain the simple baseline when it wins |
| Sharing and willingness to pay | E06, E12 | Preserve private value and test a suitable model independently |

The plan is saved for discussion. Implementation readiness is assessed separately
in [implementation-readiness.md](implementation-readiness.md).

