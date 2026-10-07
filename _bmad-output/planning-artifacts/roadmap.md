---
title: Travel Life MLP roadmap
status: working-plan
revision: 5
updated: 2026-10-07
strategy: build-then-learn
platforms: [ios, android]
---

# Minimum Lovable Product roadmap

**Direction:** The MLP is a private whole-life map reveal, replay video and
owner-selected sharing experience; see
[decision 0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md).

The user directed us to build a working MVP using available analysis and assumptions,
then answer hypotheses through rollout. **The research-first Epic 1 and G0 demand
validation gate are removed.** Both iOS and Android are in the initial MVP.

The deliverable is a functioning **connect → reconstruct → private lifetime map
reveal → replay → explore/correct → share a selected highlight** loop, background
maintenance, and enough instrumentation to learn. Sharing is user-optional but the
replay and selected-highlight share capability are required.
Small technical checks and evals happen within delivery. Interviews, a competitor
benchmark, a recruitment quota and proof of demand are not prerequisites.

## Build order

| Epic | Delivered user value | Priority |
| --- | --- | --- |
| M1 — Connect photos and keep the record private | Import available evidence, maintain it in background and control the local record | P0 |
| M2 — Reconstruct journeys with AI assistance and small evals | Understandable, maintained drafts with bounded model suggestions and a local fallback | P0 |
| M3 — Reveal and explore travel history | Lifetime map/timeline, journey details, memories and honest facts | P0 |
| M4 — Correct history and share selected facts | Fix history, replay it and publish an interactive lifetime highlight | Corrections/links/replay P0; card P1 |
| M5 — Release and learn | Both-platform verification, beta builds, minimal feedback and usage evidence | Delivery P0; evidence review P1 after rollout |

[Epics and stories](epics.md) contain 27 delivery stories: 25 P0 MLP stories and
two P1 stories. [backlog.csv](backlog.csv) is the filterable derived view.
The [working MVP spec](mvp-spec.md) records product, UX and data rules.
[Decision 0002](../../docs/decisions/0002-mvp-first-delivery.md) records the
strategy change and selected technical defaults.

Start with **M1.1 app bootstrap**, then native-source implementation in M1.2.
Deliver an integrated vertical slice early: selected evidence → one journey draft
→ reveal/detail → correction persistence. Expand accessible library scope and
edge cases within the same implementation stories. Use fixtures for development
but verify actual permissions/assets on both devices; a fixture demo is not the MVP.

Instrumentation can be added when the first flow exists; it does not require the
entire UI to be finished. Do not wait for every long-term hypothesis to be resolved.
There are no invented dates or staffing assumptions. Use story dependencies and
actual build progress to schedule work.

## Selected defaults, not hidden questions

- Shared Expo / React Native / TypeScript mobile app for iOS and Android.
- Native photo source with platform-permitted access; local SQLite and source references.
- Local metadata reconstruction with explicit provisional rules and durable correction overlays.
- OpenAI structured-output suggestions behind a small protected Supabase proxy.
  Private photo data is not uploaded by default; AI requires processing opt-in.
- Basic map/timeline/detail and supportable counts; inferred facts remain visibly inferred.
- Required background maintenance with foreground catch-up/rescan, no email signup
  for local use, explicit deletion. Timing follows platform scheduling.
- Required interactive journey or lifetime-highlight browser links with chosen memories,
  preview and revoke, plus the private Travel Life Replay and native video export.
  Static cards are P1. See decisions 0004/0009.
- Small engineering regressions now, opt-in real-case error analysis after rollout.

These are implementation starting decisions. They are not measured claims about
accuracy, adoption, complete source access or retention. Replace a default when
an actual integration failure justifies it, keeping the user-facing promise narrow.

## Minimum Lovable Product release

Ship the P0 flow when it works on both platforms and the engineering checks pass:
permissions/limited scope, import resume, supported inference, AI failure/fallback,
exploration, background updates/catch-up, correction persistence, manual exceptions,
deletion, the private lifetime map reveal, replay generation/export, interactive
selected-highlight sharing/revocation and minimal feedback.
Signed builds and configured services are operational requirements.
Interactive lifetime-highlight sharing and replay are part of P0. Static cards can
follow without holding up the core; measure them separately from the required
reveal/replay/share funnel.

A small reviewed regression set and direct device tests are required; a large
representative holdout and a calibrated LLM judge are not required for the initial
bounded beta. Launch claims must match the evidence we actually have.
See [eval-roadmap.md](eval-roadmap.md) and
[implementation-readiness.md](implementation-readiness.md).

## Learn through rollout

| Hypothesis | Shipped signal | Next decision |
| --- | --- | --- |
| Access/trust | Permission and import completion by platform/access mode | Fix explanation/source flow or narrow supported scope |
| Reconstruction/presence | Corrections, rejects, reasons and opted-in case review | Fix common errors, tune heuristics or change model inputs |
| Emotional/exploration value | Map reveal → replay played/exported → independent navigation, usefulness feedback | Improve reveal/replay/navigation or reconsider the segment |
| Sharing | Publish/share selected highlight → browser view → optional Create Yours/connection, with attribution limits | Improve highlight presentation/conversion; compare static card later |
| Maintenance | Scheduled updates, foreground recovery, correction stability and actual new-evidence opportunities | Improve reliability/resource use from observed device behavior |
| Retention | Return opportunities and reported value, not calendar inactivity alone | Prioritize identity, replay or useful search based on observed need |
| Revenue | Not tested by map usage | Run a small pricing/value experiment when there is value to monetize |

Do not call correction events a complete accuracy benchmark: people may miss errors
or correct selectively. Obtain separate consent for reviewable cases; use human
error analysis to grow real datasets. Cohort size, denominators and uncertainty remain
visible. Evidence guides improvements after release instead of blocking the first build.

## Later options

1. Improve maintenance efficiency and optional notifications from actual update behavior.
2. Factual passport, annual summary and richer selected sharing.
3. Richer year/lifetime cinematic editing beyond the required short replay.
4. Grounded history search and history-informed recommendations if they add utility.
5. Fresh world signals / Pulse and premium or intent-based revenue if justified.
6. Collaborative/network capability only for an observed shared need.

These are options, not active delivery epics. Their order can change with usage data.
The original broad vision remains in the source analysis; the
[superseded plan](history/2026-10-06-discovery-first/README.md) preserves the prior draft.
