---
title: Travel Life roadmap party discussion
status: continuing
date: 2026-10-06
mode: session
cast: [Mary, John, Sally, Winston, Amelia]
user_decisions_recorded: []
---

# Roadmap planning discussion

The user requested a BMAD party discussion, prioritized roadmap, epics and stories,
saved in the project. This record captures the planning conversation and proposals.
The personas' proposals are not user approvals. Party mode remains available for
further discussion; no application implementation was requested or performed.

## The product promise

📋 **John:** Start with one promise: “Show me a travel history I recognize and trust.”
The roadmap should earn each expansion through evidence.

📊 **Mary:** A beautiful map already exists in competing products. Phase 0 needs to
measure coverage, false visits, correction effort, and preference against alternatives.

🎨 **Sally:** The reveal matters, but the next scene matters too: someone spots a
wrong trip. Understanding and fixing it should feel easy.

🏗️ **Winston:** We need source access and evidence rules before choosing the app
stack. Photo timestamps cannot silently become trip dates.

💻 **Amelia:** I’ll order the backlog around those dependencies. Discovery stories
can start first; implementation stories will carry explicit readiness conditions.

## Sharing, private value and sequencing

📋 **John:** I’d put sharing in the MVP. It tests whether the reveal creates value
people want to pass on.

🎨 **Sally:** Include a previewed static card first. A public travel page adds
exposure and another experience to maintain before we know whether people will share.

📊 **Mary:** Keep private value separate from sharing. Someone who explores their
history and wants it maintained may be a good customer without posting it.

🏗️ **Winston:** The engine needs a simple baseline before more AI. We can then
identify which failures actually benefit from a model.

💻 **Amelia:** That gives us a sequence: discovery, a private alpha, a share-card
beta, then automatic maintenance. Public web sharing stays conditional.

## Expansion and unresolved choices

📋 **John:** The long-term vision stays in the plan. It does not become a promise
to deliver every phase.

🏗️ **Winston:** Nor does the Travel Graph choose a graph database. Record evidence,
inference and corrections consistently, then choose the storage technology.

🎨 **Sally:** Replay is an emotional experiment. If users need useful history search
first, let the evidence change the order.

📊 **Mary:** We still need a cohort, native source and operational meaning of a trip.
And our competitor findings are desk research until someone actually compares outputs.

💻 **Amelia:** Thirteen epics, forty-nine stories. Detailed drafts through Phase 1,
provisional maintenance next, then options. No sprint dates and no ready-for-build label.

## Proposal saved for the user

- Phase 0 first: source feasibility, semantics, consent/reference data, bounded baseline
  and comparative reveal/correction study.
- Private alpha combines source control, measured reconstruction, exploration and durable corrections.
- Beta includes a previewed static card. Public web sharing is a conditional P2 story.
- Maintenance must preserve edits and prove usefulness on actual new-trip opportunities.
- Identity, replay, intelligence, Pulse, commerce and network remain conditional.
- Quantitative quality/resource gates come from error evidence and calibration data,
  not arbitrary percentages or foundation smoke tests.

The unresolved trade-off is how strongly sharing should influence expansion.
John wants distribution evidence early; Sally and Mary want private value protected
from a failed sharing hypothesis. The roadmap measures both separately and presents
future decisions to the product owner rather than claiming unanimous authority.

Artifacts: ../planning-artifacts/roadmap.md, epics.md, backlog.csv, eval-roadmap.md
and implementation-readiness.md.


## User-directed revision: working MVP first

The user rejected the pre-launch research/interview programme and research-first Epic 1.
They want decisions from available knowledge and hypothesis learning through rollout.
They explicitly selected both iOS and Android. This supersedes the initial proposal above.

📋 **John:** Remove the demand-validation gate. Deliver the product and test demand in use.

📊 **Mary:** Keep the hypotheses, but collect their signals from the shipped flow and optional feedback.

🏗️ **Winston:** Source access still needs a real device test; put it inside implementation, not a research programme.

💻 **Amelia:** Five delivery epics, twenty-two stories. Small regressions before beta; grow real-case evals after rollout.

🎨 **Sally:** A useful reveal must include an easy correction path from the first market build.

Active outputs: five M-prefixed epics; twenty P0 stories and two P1 stories.
Working stack/model/data defaults are recorded in decision 0002 and the MVP spec.
No app was built in this planning revision; actual implementation/release checks are pending.

## MVP scope review — 2026-10-07

The user required background maintenance, then clarified that an interactive journey
shared by link is essential and recalled possible video capability. Decisions 0004
and 0005 supersede the earlier foreground-only/deferred-hosted-sharing defaults.
The working plan now has five epics and 27 stories (24 P0, three P1): M1.5/M2.6
cover background discovery/reconciliation; M4.5/M4.6 cover hosted journey publishing
and the browser viewer; M4.7 is a P1 short-video replay/export interpretation.
Static cards remain P1. No app implementation, hosting or media upload occurred.
