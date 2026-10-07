---
title: Travel Life MLP delivery backlog
status: working-plan
revision: 7
updated: 2026-10-07
strategy: build-then-learn
---

# MLP delivery epics and stories

**Current direction:** The MLP first loop is the private lifetime map reveal,
replay video and owner-selected sharing experience in
[decision 0009](../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md).
Story IDs and the historical filename stay stable. This backlog supersedes the
discovery-first 13-epic/49-story proposal.
The [working MLP spec](mvp-spec.md) records the decisions; the
[roadmap](roadmap.md) owns release scope. Background maintenance is required P0 on both platforms; see [decision 0004](../../docs/decisions/0004-background-maintenance-in-mvp.md).
No pre-launch interviews, competitor
study, participant recruitment or G0 market-validation decision blocks this backlog.

IDs use the M prefix to avoid confusing these stories with the retired draft.
There are five delivery epics and 27 stories. The CSV is a derived view, not a
second backlog. All stories are planned; none has been implemented by this document.

P0 = Minimum Lovable Product core. P1 = extensions that do not delay release.
The interactive lifetime reveal, replay video, selected-highlight links and
background maintenance are P0. Static cards are P1. Story M5.5 is post-rollout
learning, not a release prerequisite.

## Common delivery contract

Read the [MLP spec](mvp-spec.md) and
[decision 0002](../../docs/decisions/0002-mvp-first-delivery.md).
Build on both iOS and Android. ECC search-first means targeted existing-tool/doc
checks inside implementation, not a new product research programme.
BMAD handles coherent scope/UX/architecture decisions in the story; detailed artifacts
may evolve when useful without recreating a discovery gate.

For each delivered story, record actual changed files, acceptance evidence, meaningful
tests, applicable ECC verification, and task-level eval results if inference changed,
using the [story template](../../docs/development/story-template.md). Small internal
regressions are required; interview recruitment and a large labeled benchmark are not.
No model call on private user evidence occurs without the defined processing consent.
Service deployment/spend/publication remains within actual execution authorization.

## Epic overview

| Epic | Deliverable | Stories |
| --- | --- | --- |
| M1: Connect photos and keep the record private | An iOS or Android user can import available photo evidence into a durable local record with background maintenance. | 5 |
| M2: Reconstruct journeys with AI assistance and small evals | Users receive explainable journey drafts with a usable local fallback, bounded AI suggestions and maintained history. | 6 |
| M3: Reveal and explore the travel history | Users can see a meaningful lifetime record and open journeys and memories. | 4 |
| M4: Correct history and share selected facts | Users can repair history, replay it and share an interactive lifetime highlight by browser link or video. | 7 |
| M5: Release the MLP and learn from real use | Both platforms have a lovable release and feedback informs the next iteration. | 5 |

## Epic M1: Connect photos and keep the record private

An iOS or Android user can import available photo evidence into a durable local record.

### Story M1.1: Create the shared mobile app

**Status:** planned · **Priority:** P0 · **Dependencies:** None

**Acceptance criteria:**

- **AC-M1.1-1:** Use Expo, React Native and TypeScript with one shared navigation/data contract; pin compatible dependencies during implementation.
- **AC-M1.1-2:** Run a real device development build on both iOS and Android; simulator fixtures do not close the platform check.
- **AC-M1.1-3:** Provide Trust → Import → History navigation and reproducible build/test commands; do not require an email account to explore local history.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M1.2: Implement native photo permissions and access

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.1

**Acceptance criteria:**

- **AC-M1.2-1:** Make permission-based broad library access the primary import path and enumerate accessible assets without individual selection. Offer each platform's supported limited/selected-photo mode for users who decline broad access; respect that choice without repeated expansion prompts. Implement required metadata permission and handle denial and revocation. See [decision 0003](../../docs/decisions/0003-library-access-default.md).
- **AC-M1.2-2:** Include the source-access technical check in this story using a real permitted sample on each platform; record GPS availability and cloud-only asset behavior.
- **AC-M1.2-3:** If broad access is unavailable or distribution rules require selection, use an explicit selection flow and show its reduced coverage; never claim a complete cloud scan.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M1.3: Import metadata, resume and avoid duplicates

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.2

**Acceptance criteria:**

- **AC-M1.3-1:** Page through accessible assets, normalize available timestamp/GPS/source fields, retain missing/conflicting metadata and original-media references.
- **AC-M1.3-2:** Checkpoint import, cancel/resume and deduplicate stable asset identities; repeat import must not duplicate evidence or erase corrections.
- **AC-M1.3-3:** Show accessible/scanned/geotagged/unavailable counts and test empty, sparse, interrupted and large synthetic libraries.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M1.4: Persist privately and provide disconnect/delete

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.3

**Acceptance criteria:**

- **AC-M1.4-1:** Store evidence, inferred history and correction overlays in local SQLite under the recorded backup/data-protection policy; originals stay in the photo source.
- **AC-M1.4-2:** Implement disconnect and delete-local-history as different actions with clear consequences; clear covered derived data and caches on deletion.
- **AC-M1.4-3:** Keep media, precise locations and raw evidence out of analytics/logs and Git; revocation must not silently restart access.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M1.5: Discover library changes in scheduled background work

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.4

**Acceptance criteria:**

- **AC-M1.5-1:** Register supported background work on iOS/Android after the explained initial import; run from persisted state without a mounted UI and offer an automatic-maintenance toggle.
- **AC-M1.5-2:** Discover added/changed/deleted or newly accessible assets with checkpoints, stable identities and bounded metadata reconciliation; avoid redownloading or reinferring unchanged media, and distinguish limited access from deletion.
- **AC-M1.5-3:** Handle task expiration, concurrent runs, permissions/revocation, disconnect and delete; cancel future scheduling where appropriate and reconcile missed changes on foreground resume without promising an exact background cadence.

**AI/eval impact:** Deterministic delta/idempotency/access-scope checks; scheduler triggers and handler correctness are separate evidence.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

## Epic M2: Reconstruct journeys with AI assistance and small evals

Users receive explainable journey drafts with a usable local fallback and bounded AI suggestions.

### Story M2.1: Build the metadata baseline and local history model

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.4

**Acceptance criteria:**

- **AC-M2.1-1:** Implement `reconstruction-v1` exactly as fixed in the MLP spec and decision 0007: 5 km complete-link place assignment with canonical sort/ties; 48-hour/one-civil-day visit gaps, 72-hour/two-civil-day inferred journey links, 30-day automatic visit and journey spans, 240-hour/ten-civil-day possible merge and 50 km date-scoped usual-area context. A short-gap link remains inferred, never proof or a hard boundary.
- **AC-M2.1-2:** Preserve evidence/provenance and independent journey-membership versus visit-support links. Keep duplicate copies from multiplying support, date/timezone and GPS uncertainty explicit, usual areas date-scoped, and inferred facts separate from reviewed confirmation.
- **AC-M2.1-3:** Produce deterministic baseline traces for decision 0007's cutoff/tie examples, A → B → A visits, short-gap separate trips, sparse travel, local-photo chains and 24-hour GPS-less bracketing versus one-day/three-day suggestion; unknown evidence may remain unassigned and metadata does not prove physical presence.

**AI/eval impact:** Versioned baseline/candidate traces, objective support/schema checks and small reviewed regression cases. Do not claim population accuracy; no uncalibrated subjective judge is required.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M2.2: Build a protected AI proxy

**Status:** planned · **Priority:** P0 · **Dependencies:** M2.1

**Acceptance criteria:**

- **AC-M2.2-1:** Use a TypeScript Supabase Edge Function and protected anonymous session for optional AI; provider credentials remain server-side.
- **AC-M2.2-2:** Accept only allowlisted minimized eligible alternatives and locally derived coarse relationship/boundary flags after in-app processing consent; no originals, thumbnails, filenames, exact coordinates or absolute travel dates.
- **AC-M2.2-3:** Apply request/token/rate/global budget limits, disable body logging, validate schemas, handle refusals/timeouts and call the configured OpenAI snapshot with store:false.

**AI/eval impact:** Versioned baseline/candidate traces, objective support/schema checks and small reviewed regression cases. Do not claim population accuracy; no uncalibrated subjective judge is required.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M2.3: Use AI to propose ambiguous grouping and labels

**Status:** planned · **Priority:** P0 · **Dependencies:** M2.2

**Acceptance criteria:**

- **AC-M2.3-1:** Call the initial model only for bounded eligible alternatives whose minimized summary contains enough distinguishing context; propose grouping/labels/reasons referencing existing opaque-mapped evidence IDs, or retain ambiguity locally.
- **AC-M2.3-2:** Reject invented places, evidence, dates, unsupported relationships and boundary/correction violations; bind proposals to evidence, correction, rule and consent revisions, discarding or revalidating stale responses. AI cannot establish owner presence or turn trip membership into visit support.
- **AC-M2.3-3:** Show suggestions as inferred/reviewable; when AI is declined, unavailable, uninformative or invalid, preserve the functioning local baseline and disclose that the AI step was skipped.

**AI/eval impact:** Versioned baseline/candidate traces, objective support/schema checks and small reviewed regression cases. Do not claim population accuracy; no uncalibrated subjective judge is required.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M2.4: Add the small engine regression suite

**Status:** planned · **Priority:** P0 · **Dependencies:** M2.3

**Acceptance criteria:**

- **AC-M2.4-1:** Cover decision 0007's 5 km, 48-hour/one-day visit, 72-hour/two-day journey, 30-day visit/journey cap and 240-hour/ten-day possible-merge boundaries; 24-hour GPS-less bracket, one-day/three-day suggestion limits, clustering ties/date line/import order, one/two/no compatible trips, shared memories versus unsupported downloads, duplicate copies, imprecise dates/timezones, sparse travel, local-photo chains, A → B → A revisits, owner boundaries, date-scoped residences, delayed assets and correction stability through background updates.
- **AC-M2.4-2:** Write explicit expected membership, visit support, episode boundary, allowed ambiguity and prohibited assertions for each synthetic case; check support/correction/confirmation invariants, input-order stability and full-versus-incremental equivalence on matching final inputs.
- **AC-M2.4-3:** Run a small model sample on synthetic or authorized internal data when the integration is configured; record actual results and failures, with no population-accuracy or calibrated-confidence claim.

**AI/eval impact:** Versioned baseline/candidate traces, objective support/schema checks and small reviewed regression cases. Do not claim population accuracy; no uncalibrated subjective judge is required.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M2.5: Bound processing cost and recover gracefully

**Status:** planned · **Priority:** P0 · **Dependencies:** M2.4

**Acceptance criteria:**

- **AC-M2.5-1:** Enforce configured input/output ceilings and atomic server quotas before provider calls; expose an operational kill switch and record sanitized usage totals.
- **AC-M2.5-2:** Persist usable partial/baseline history through network/provider failure, cancellation and restart; allow explicit foreground rescan.
- **AC-M2.5-3:** Measure actual import/model latency and cost during development; keep unknown results unknown and keep frozen prompt/model versions in traces.

**AI/eval impact:** Versioned baseline/candidate traces, objective support/schema checks and small reviewed regression cases. Do not claim population accuracy; no uncalibrated subjective judge is required.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M2.6: Maintain journey history from incremental updates

**Status:** planned · **Priority:** P0 · **Dependencies:** M1.5, M2.5

**Acceptance criteria:**

- **AC-M2.6-1:** Consume the persisted change queue and update affected dependency neighborhoods, including late historical photos; preserve identity lineage, photo associations, owner boundaries/corrections, manual journeys, rejected evidence and exclusions. New additions to confirmed journeys remain inferred.
- **AC-M2.6-2:** Expand reconciliation to convergence or checkpoint it as pending without presenting a partial result as final; do not duplicate journeys or corrupt the last consistent history. Match full reconstruction on identical final evidence/rules/corrections, keep a local result when AI/network/quota is unavailable and require automatic-processing consent before background cloud AI requests.
- **AC-M2.6-3:** Show last checked/updated, pending/restricted and new/updated-journey states with foreground catch-up/manual rescan; do not automatically publish/share changes, and verify correction stability across background update sequences.

**AI/eval impact:** Longitudinal baseline/candidate cases, correction persistence and incremental/full consistency where inputs match; observed update delay is measured separately from correctness.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

## Epic M3: Reveal and explore the travel history

Users can see a meaningful lifetime record and open journeys and memories.

### Story M3.1: Deliver the Travel Life reveal

**Status:** planned · **Priority:** P0 · **Dependencies:** M2.5

**Acceptance criteria:**

- **AC-M3.1-1:** Make the private Travel Life Reveal map-first: show all visible reconstructed journeys across the available lifetime with source coverage and clear inferred/confirmed status, then let users explore without mandatory research or registration.
- **AC-M3.1-2:** Offer the Travel Life Replay from the reveal when eligible evidence exists; for processing, empty, sparse or failed imports, state the limitation and offer import, correction or manual-entry next actions without fabricating a lifetime story.
- **AC-M3.1-3:** Record minimal reveal/replay/exploration events under the telemetry policy without claiming an inferred record is verified.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M3.2: Connect the lifetime map and timeline

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.1

**Acceptance criteria:**

- **AC-M3.2-1:** Use a shared journey or year selection for map, chronological list and year filter on both platforms; the unfiltered map represents the owner's visible lifetime record.
- **AC-M3.2-2:** Show observed destinations and approximate dates; provide a list alternative to map interaction and no fabricated route lines.
- **AC-M3.2-3:** Handle offline/unavailable map services and dense results without blocking timeline/history access.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M3.3: Open journeys and source-linked memories

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.2

**Acceptance criteria:**

- **AC-M3.3-1:** Display chronological visits, observed date span, available trip media and separate reasons for journey membership versus destination support, with uncertain/unassigned photos reviewable without copying the entire library.
- **AC-M3.3-2:** Handle revoked access, missing originals and cloud-only media explicitly; avoid unbounded image decoding.
- **AC-M3.3-3:** Link to confirm/edit/remove actions and preserve navigation between map, timeline and journey detail.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M3.4: Display supportable travel statistics

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.3

**Acceptance criteria:**

- **AC-M3.4-1:** Calculate journey/place/country counts consistently using recorded status/counting rules; duplicate copies and unresolved photo memberships cannot inflate counts, unresolved countries are omitted and inferred totals are labeled.
- **AC-M3.4-2:** Keep exact travel duration, travelled distance and actual routes out of the MLP when evidence does not support them.
- **AC-M3.4-3:** Recalculate after corrections and verify that all screens and share previews agree.

**AI/eval impact:** Software and evidence-reference checks; no new subjective AI evaluator needed.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

## Epic M4: Correct history and share selected facts

Users can repair history and deliberately share a journey or selected lifetime highlight.

### Story M4.1: Confirm, reject and edit a journey

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.3

**Acceptance criteria:**

- **AC-M4.1-1:** Provide confirm/reject, rename, date precision/bounds, destination removal, photo assign/remove and explicit trip-boundary correction with visible state and provenance; confirmation covers only reviewed facts and memberships.
- **AC-M4.1-2:** Allow basic split/merge and uncertain-photo assignment without reviewing every photo; preserve source evidence and prevent duplicate accepted primary journey membership or visit support from trip-only media.
- **AC-M4.1-3:** Apply owner corrections by stable evidence/association/boundary scope and identity lineage across restart, same-evidence rescan and incremental/background split/merge; remapping conflicts stay pending rather than silently losing or misapplying edits, and rejected claims cannot simply reappear.

**AI/eval impact:** Correction/visibility/share-content invariants; manual corrections must not inflate automated recovery metrics.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.2: Add a missing journey manually

**Status:** planned · **Priority:** P0 · **Dependencies:** M4.1

**Acceptance criteria:**

- **AC-M4.2-1:** Allow a minimal manual journey with destinations and exact/approximate dates, marked owner-entered.
- **AC-M4.2-2:** Resolve overlap through an explicit merge/edit choice and preserve manual records across rescans.
- **AC-M4.2-3:** Exclude manual additions/corrections from automated recovery scores rather than inflating engine accuracy.

**AI/eval impact:** Correction/visibility/share-content invariants; manual corrections must not inflate automated recovery metrics.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.3: Control private visibility and exclusion

**Status:** planned · **Priority:** P0 · **Dependencies:** M4.1

**Acceptance criteria:**

- **AC-M4.3-1:** Define hide, exclude from reconstruction and delete actions distinctly; explain which affects local views, counts and sharing.
- **AC-M4.3-2:** Apply exclusion/correction precedence consistently through rescans, background updates and visible history updates.
- **AC-M4.3-3:** Default sharing to off and verify that hidden/excluded content cannot enter a share preview accidentally.

**AI/eval impact:** Correction/visibility/share-content invariants; manual corrections must not inflate automated recovery metrics.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.4: Preview and export a static Travel Life card

**Status:** planned · **Priority:** P1 · **Dependencies:** M3.4, M4.3

**Acceptance criteria:**

- **AC-M4.4-1:** Let users select and preview confirmed/owner-entered facts before a native image share; inferred facts require explicit review/confirmation for the shared card.
- **AC-M4.4-2:** Remove source metadata, precise hidden locations and private media; opening/cancelling a preview does not upload or publish anything.
- **AC-M4.4-3:** Measure share intent and completed export separately where the OS permits; disclose that recipients' exported copies cannot be revoked.

**AI/eval impact:** Correction/visibility/share-content invariants; manual corrections must not inflate automated recovery metrics.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.5: Publish and manage selected share snapshots

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.4, M4.3

**Acceptance criteria:**

- **AC-M4.5-1:** Provide an explicit journey or lifetime-highlight selection/content preview and publish confirmation, then persist an owner-protected versioned snapshot and only selected sanitized media derivatives; do not upload the full library or expose hidden places/source IDs.
- **AC-M4.5-2:** Issue an unlisted high-entropy URL with displayed expiry and owner republish/revoke controls; protect snapshot/media reads and cross-owner writes, enforce upload quotas and strip metadata/unsafe content.
- **AC-M4.5-3:** Keep published content stable through private/background updates; require deliberate republish, block future content/media access after revoke/expiry, and handle delete-all/offline revocation honestly without claiming recipients' saved copies were erased.

**AI/eval impact:** No new generative inference task. Verify selected-content provenance, visibility, snapshot/media isolation and revocation; exported video is a deliberate, non-revocable copy.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.6: Share an interactive journey or lifetime highlight in a browser

**Status:** planned · **Priority:** P0 · **Dependencies:** M4.5

**Acceptance criteria:**

- **AC-M4.6-1:** Open the shared URL without app installation or recipient login and provide a responsive selectable map, chronological destination timeline and selected-memory browsing for the published journey or lifetime highlight, with a usable list fallback when maps fail.
- **AC-M4.6-2:** Offer copy-link/native share, an explicitly chosen safe social preview and optional Create Yours path; preserve inferred/date-precision labels and do not reveal private source references or access tokens in analytics.
- **AC-M4.6-3:** Verify mobile/desktop browsers, invalid/expired/revoked links, missing media, unsafe input, cross-owner denial and no-index/cache policy; distinguish new server access revocation from previously saved copies.

**AI/eval impact:** No new generative inference task. Verify selected-content provenance, visibility, snapshot/media isolation and revocation; exported video is a deliberate, non-revocable copy.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M4.7: Preview and export the Travel Life Replay

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.3, M4.3

**Acceptance criteria:**

- **AC-M4.7-1:** Render a 30–60 second (target 45-second) 720p silent MP4 from chronological observed destinations and owner-visible eligible memories across the selected lifetime scope, with preview, cancel and unavailable-media handling.
- **AC-M4.7-2:** Validate the selected renderer, playback and export on iOS and Android; preserve visibility/metadata rules, bound memory/render work and use destination transitions rather than invented travelled routes, narration or music.
- **AC-M4.7-3:** Support explicit native video export/share and optional deliberate publication to the selected shared highlight; no automatic upload occurs and previously exported copies cannot be revoked.

**AI/eval impact:** No new generative inference task. Verify selected-content provenance, visibility, snapshot/media isolation and revocation; exported video is a deliberate, non-revocable copy.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

## Epic M5: Release the MLP and learn from real use

Both platforms have a usable release and feedback informs the next iteration.

### Story M5.1: Instrument a minimal product funnel

**Status:** planned · **Priority:** P0 · **Dependencies:** M3.1

**Acceptance criteria:**

- **AC-M5.1-1:** Implement allowlisted permission/import/reveal/replay-played/replay-exported/explore/correction/share-published/link-open/Create-Yours events with build/platform, coarse background check/update states and coarse counts only; no URL access tokens or journey contents.
- **AC-M5.1-2:** Keep local diagnostic export available; remote product analytics follow the selected consent/retention policy and do not collect history coordinates or media.
- **AC-M5.1-3:** Measure denominators and failures; distinguish missing telemetry, skipped AI and no new-trip opportunity from user disinterest.

**AI/eval impact:** Coarse usage signals are not gold labels. Raw cases require separate opt-in; human error analysis grows after release.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M5.2: Capture optional feedback and error reports

**Status:** planned · **Priority:** P0 · **Dependencies:** M4.2, M5.1

**Acceptance criteria:**

- **AC-M5.2-1:** Offer lightweight Was this useful?/Report a wrong trip flows inside the product; no pre-launch interviews or panels are required.
- **AC-M5.2-2:** Send raw examples only after separate explicit case-sharing consent; default feedback carries categories and anonymous coarse metrics.
- **AC-M5.2-3:** Version reports and protect access/retention; confirmation/rejection events are useful signals but not a complete unbiased benchmark.

**AI/eval impact:** Coarse usage signals are not gold labels. Raw cases require separate opt-in; human error analysis grows after release.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M5.3: Verify both-platform launch behavior

**Status:** planned · **Priority:** P0 · **Dependencies:** M4.3, M5.2, M2.6, M4.6, M4.7

**Acceptance criteria:**

- **AC-M5.3-1:** Run the installed ECC verification checks applicable to the actual app and a real-device core journey on both iOS and Android.
- **AC-M5.3-2:** Exercise limited/denied/revoked access, GPS-less photo association, ambiguous and corrected trip boundaries, interrupted import, background task expiration/restriction, force-quit/relaunch catch-up, offline/stale-AI failure, confirmation scope and edit persistence during incremental updates, deletion, hosted snapshot/media revocation, interactive highlight behavior and lifetime replay generation/export.
- **AC-M5.3-3:** Resolve crashes, data-loss, secret leakage and unsupported-evidence violations; record measured limitations without requiring a market study or large labeled holdout.

**AI/eval impact:** Coarse usage signals are not gold labels. Raw cases require separate opt-in; human error analysis grows after release.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M5.4: Package and roll out an instrumented beta

**Status:** planned · **Priority:** P0 · **Dependencies:** M5.3

**Acceptance criteria:**

- **AC-M5.4-1:** Create signed iOS/Android builds and deploy the read-only browser viewer plus protected snapshot/media services; handle actual accounts, provisioning, map keys, hosting/storage quotas and source-access distribution rules inside delivery.
- **AC-M5.4-2:** Use TestFlight and an appropriate Android test/distribution channel; publishing/provider spend occur only within actual user authorization.
- **AC-M5.4-3:** Configure backend/model/map/storage quotas, hosted-link revocation/expiry, feedback access, privacy disclosures and version/disable controls; release P0 including background maintenance, interactive lifetime highlights and replay video without waiting for P1 static-card polish.

**AI/eval impact:** Coarse usage signals are not gold labels. Raw cases require separate opt-in; human error analysis grows after release.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

### Story M5.5: Use rollout evidence to choose the next iteration

**Status:** planned · **Priority:** P1 · **Dependencies:** M5.4

**Acceptance criteria:**

- **AC-M5.5-1:** Review permission/completion, independent exploration, correction burden, usefulness feedback, voluntary sharing and observed return opportunities after release.
- **AC-M5.5-2:** Perform human error-discovery on opt-in cases and grow versioned person/library-separated eval sets; add validated subjective judges only if needed.
- **AC-M5.5-3:** Record fix/narrow/expand priorities from real findings; do not make a pre-launch research programme the default again.

**AI/eval impact:** Coarse usage signals are not gold labels. Raw cases require separate opt-in; human error analysis grows after release.

**Delivery evidence:** Not executed. Record actual implementation, tests and limitations here or link a single delivery record.

## Retired proposal and traceability

The original ten-story Epic 1 is retired as a launch prerequisite. Segment selection,
travel semantics and engineering defaults are now recorded in the working spec;
source feasibility is checked while implementing M1.2. Model/error checks are delivered
in M2. Feedback replaces research recruitment in M5. The old E02–E06 implementation
intent is condensed into M1–M5; E07–E13 become options in the roadmap, not active
implementation epics. Original story IDs are preserved only in the
[superseded snapshot](history/2026-10-06-discovery-first/README.md).
