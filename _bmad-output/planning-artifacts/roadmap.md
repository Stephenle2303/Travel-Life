---
title: Travel Life MLP roadmap
status: working-plan
revision: 7
updated: 2026-11-19
strategy: build-then-learn
platforms: [ios, android]
---

# Minimum Lovable Product roadmap

## Active quality repair: trip recognition (M10, accepted 2026-11-19)

The 2026-11-19 engine review found that real trips are silently withheld from
the Atlas. The production adapter diverges from the V1.1 contract: a fully gated
45-69 score becomes NOT_TRIP instead of SUGGESTED, the DAY/STAY paths and
independent sessions are never populated, a learned Home is not a boundary,
and capture time arrives without original offsets. Findings are synthetic;
owner-library impact is unmeasured.

Owner direction (2026-11-19): Home is mandatory in onboarding and is only
what the owner sets there or in Settings; a trip away from Home with clear location evidence shows on
Atlas; anything unsure goes to Possible trips with one short reason.

[SPEC-trip-recognition-repair](../specs/spec-trip-recognition-repair/SPEC.md)
governs the repair. [Decision 0021](../../docs/decisions/0021-trip-recognition-repair.md)
is accepted. M10 runs ahead of M8/M9 because it decides what every source's
trips look like.

| Order | Stage | Stories | Exit value |
| --- | --- | --- | --- |
| 1 | Measure | M10.1, M10.2 | Public synthetic lifetime benchmark red on the current engine; read-only owner-device count of trips hidden without a reason |
| 2 | Clear outcome rules (`trip-detector-v1.2`) | M10.3-M10.6 | No silent loss; away trips with clear evidence on Atlas, unsure ones in Possible trips with a reason; Home mandatory, only from onboarding/Settings; original capture time input |
| 3 | Consolidate | M10.7 | One normalization, Home model and grouping authority feeding Atlas and Possible trips; dead paths removed |
| 4 | Adopt | M10.8 | Correction preservation and rollback on the owner's phone (done); owner-facing dry-run/activation UI closed, not built — see status note |

Decision 0021 is accepted. Status (2026-11-21): M10.1/M10.2/M10.3/M10.4/
M10.5/M10.6 done — engine rules implemented, benchmark 54/54 (see
[v1-2-comparison.md](../specs/spec-trip-recognition-repair/v1-2-comparison.md)),
Home-required UI shipped, real EXIF offset/provenance now flow into import
on Android, and the owner's real-device classification mix is recorded
(see [project-state.md](../../docs/project-state.md)). **M10.8 closed
2026-11-20**: its pure dry-run/rollback core and correction preservation
are done and proven; the owner-facing dry-run/activation screen is
descoped, not deferred — v1.2 was already adopted directly (no feature
flag, no stored policy selector) at the M10.3/M10.4 call-site switch, so
there is no pending activation decision left for such a screen to gate.
Revisit only if a future rule version (v1.3+) needs a real approval gate;
see [sprint-change-proposal-2026-11-20.md](sprint-change-proposal-2026-11-20.md).
M10.7 is half done — the Atlas surface is consolidated on one detector, but
the Possible-trips **preview**'s own card-grouping policy is investigated
and deliberately deferred (dev-preview-only consumer, no equivalent
benchmark safety net for a rewrite), not blocked. **M10.3's Possible-trips
card UI done 2026-11-21** (reason sentence + Set Home action, real
production data — see delivery-and-diagnostics.md), prioritized after
M10.2's real-device data showed `near-home` alone accounts for 42% of
every detected episode. See
[delivery-and-diagnostics.md](../specs/spec-trip-recognition-repair/delivery-and-diagnostics.md)
for the full per-story accounting.

**v1.3 funnel (decision 0023, accepted 2026-11-22; M10.9–M10.12 all built;
v1.2 stays the live default until the owner reviews the on-device
comparison in Settings → Trip detection and switches):** device
review showed Possible trips filled with errands (32 of 38 were `near-home`).
v1.3 keeps one owner-sized Home zone (free radius ≤300 km, edited in
Settings), inverts the funnel to Atlas → evidence-based Possible trips →
Hidden by default, stops frequent places blocking Atlas, and adds a collapsed
Hidden outings card on the Atlas. Stories M10.9–M10.12 in
[detector-v1-3.md](../specs/spec-trip-recognition-repair/detector-v1-3.md);
not activated before the Hidden outings card ships and an owner-reviewed
device dry run.

## Next: AI clue layer and learning (M11, accepted 2026-11-19)

[Decision 0022](../../docs/decisions/0022-ai-clue-layer-and-learning.md):
after the rule engine, background on-device AI adds versioned clues; the same
rules re-decide; changes show as a short note; corrections become visible
personal rules; the eval engine gates every new rule or model version.
[SPEC-ai-clue-layer](../specs/spec-ai-clue-layer/SPEC.md) governs it.
M11 starts after M10.7 (one detector) and uses the M10.1 benchmark.
Status (2026-11-20): **M11.1 is done**, including SQLite persistence and
production wiring — the clue record contract, validity rules, rule
consumption and the `travel_clue` table (`apps/mobile/src/clues/`:
`types.ts`, `store.ts`, `consumption.ts`; `import-record/repository.ts`'s
`migrationV49`) are implemented, tested, and the production rebuild
(`reconstruction/repository.ts`) now reads clues on every rebuild: a clue
can lower a trip or name a destination for display, never raise one onto
Atlas (promotion classes stay off), and zero clues reproduces M10 exactly —
verified against real SQLite, not just mocks. M11.2-M11.8 are not started:
no clue producer exists yet to feed this (so `travel_clue` stays empty in
production), and the background pass/personal learning/eval engine need new
infrastructure.

| Order | Stage | Stories | Exit value |
| --- | --- | --- | --- |
| 1 | Foundation | M11.1, M11.2 | Clue store the rules consume; background clue pass with budgets and an "updated" note |
| 2 | Clue producers | M11.3-M11.5 | Place, photo-source and same-trip clues from existing on-device models |
| 3 | Learning | M11.6 | Corrections become personal rules listed in Settings |
| 4 | Gate | M11.7, M11.8 | Eval engine with hard cases and keep/reject signals; owner-approved version and promotion gate |

## Approved next scope: one account, multiple sources

The owner approved [decision 0015](../../docs/decisions/0015-private-multi-source-travel-history.md)
on 2026-10-28. [M6-M9 epics/stories](epics-multi-source.md) are the canonical
20-story extension; the combined CSV contains 47 baseline/next-scope stories.

| Order | Epic | Exit value |
| --- | --- | --- |
| 1 | M6 - Account and private restore (5 stories) | Email OTP, explicit sync consent, preserved local history and account controls |
| 2 | M7 - Unified devices and Replay (7 stories) | Combined evidence/corrections and private media usable away from the source phone |
| 3 | M8 - Selected Google Drive files (4 stories) | Direct cloud import and authorized-file maintenance |
| 4 | M9 - Selected Google Photos memories (4 stories) | Picker import, GPS-less batch assignment and cross-device media |

M6 + M7 is the first complete multi-device milestone. M8/M9 are next-scope
requirements, not prerequisites for validating that milestone. No promised dates
or completed implementation are implied. Local-only use stays account-free;
original-library backup and broad folder/Photos scans are excluded.

The existing M1-M5 plan below remains the local baseline. The approved
[2026-10-27 sharing correction](sprint-change-proposal-2026-10-27.md) supersedes
its older hosted-link requirements: M4.5/M4.6 remain deferred. Private account
sync is not public publication and does not unlock that gate.

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
