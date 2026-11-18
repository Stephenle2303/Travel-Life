# Recognizable travel implementation

Status: in progress. Baseline commit 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66.

## D2 host implementation plan (2026-11-10)

The owner authorized continuing D2 on the current checkout without physical
devices. Use a separate off-by-default development reveal gate. Preserve the
Settings comparison as read-only. Limit the initial binding to connected Local
history with full current permission, as in the existing comparison. Account,
limited/selected and stale scopes use their existing Atlas.

- `photo-access/controller.ts` and `components/mobile-screens.tsx`: tie the
  featured experience to the first admitted photo preparation in the current
  session. Returning/restarted history retains normal navigation. Use
  `components/atlas-reveal.tsx` for the normal map and Timeline, with gated
  feature slots and a separate paged Possible trips section.
- `reconstruction/repository.ts` and `photo-access/provider.tsx`: reuse the
  bounded captured candidate, the stamp and current permission, and the
  existing thumbnail resolver. Return coarse authorized observation points in a
  passive map layer. Rank deterministically and keep candidate IDs transient.
  Preserve baseline qualified Timeline, trip map pins and Replay until D4.
- Featured preview uses one candidate's authorized exact media, resolved at
  action time and rechecked after playback preparation. Use a private bounded
  preview or a local evidence detail fallback. Lifetime Replay and sharing
  remain on their existing committed path.
- A review writer must bind to the exact current visit partition and support,
  check the live source and full stamp in the transaction, and verify the
  committed result before removing the card. An exact compatible baseline
  journey may use an existing canonical confirm revision. Never approximate a
  regrouping, silently keep an owner-entered journey without media, or use a
  shadow display ordinal as durable authority. Preserve any unsupported card
  as review-only until its exact grouping can be published.
- Use a separate Local rejection receipt for an exact candidate support
  partition. It can suppress the same candidate after a rebuild without
  applying the legacy structural rejection to unrelated trips. Do not allow
  it to stand in for rejection of an overlapping published journey. Delete
  the receipt with the Local record and fence portable account export until
  its receiving policy can represent it.

### D2 diagnostic boundaries and checks

| Boundary | Operation and stage | Outcome and next check |
| --- | --- | --- |
| Repository candidate input, classification and token | `ATLAS_REBUILD / CANDIDATE_INPUT_READ`, `CANDIDATE_CLASSIFY`, `CANDIDATE_READBACK` | Reuse `ACCESS`, `SCHEMA`, `DATABASE_BUSY`, `OWNER_REVIEW`, `HISTORY_STALE`, `SKIPPED`, `UNKNOWN`. Compare the committed record/evidence/Home/privacy and owner stamp. Retain the baseline on failure. |
| Provider evidence lookup and thumbnail readback | `ATLAS_PREVIEW / PREVIEW_READ`, `PREVIEW_MEDIA` in `PhotoAccessProvider` | `ACCESS`, `SKIPPED` or `HISTORY_STALE` withhold results. `MEDIA_UNAVAILABLE` uses a neutral cover and `MEDIA_VERIFY` withholds mismatched slots. Closed error classification, no raw preview data. |
| Featured temporary playback and screen handoff | `REPLAY_RENDER` with existing eligibility, manifest, preview, render and verify stages, then `REPLAY_HANDOFF` and `REPLAY_OUTPUT_CLEANUP` in the feature screen | Use one action correlation. Stale scope discards output. `MEDIA_DECODE` reports native player error with fixed recovery. Cleanup failures use the closed classifier with an unknown cleanup outcome. |
| Possible trip exact decision and verification | `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_SAVE`, `POSSIBLE_TRIP_REBUILD`, `POSSIBLE_TRIP_ACK`, `POSSIBLE_TRIP_READBACK` in the reconstruction repository and provider | Stale scope and incompatible grouping block. Database/transaction faults distinguish unknown commit from verified rollback. Retry the same command and verify its committed result in an owned read before updating Atlas. |
| Local rejection export compatibility | `HISTORY_TRANSFER / HISTORY_EXPORT_CANDIDATE_COMPATIBILITY` at `exportLocalHistory` | `HISTORY_VERSION_UNSUPPORTED` blocks transfer before reading portable rows. A failed compatibility read preserves the established SQLite classification. Existing account replica readback remains scoped separately. |

#### D2 runtime source map

| Operation and stage | Source and boundary | Closed result and next check |
| --- | --- | --- |
| `ATLAS_REBUILD / CANDIDATE_INPUT_READ` | `reconstruction/repository.ts` `loadCandidateShadowSnapshot` checks source and captures committed evidence, Home, privacy and owner revisions in one read | `ACCESS` blocks restricted scope. `SKIPPED` covers unavailable input or budget. `HISTORY_STALE` withdraws superseded input. `SCHEMA`, `NATIVE_HANDLE`, `DATABASE_BUSY`, `TRANSACTION` and stage-specific `UNKNOWN` leave Atlas unchanged. Verify source first, then the captured run and revisions. |
| `ATLAS_REBUILD / CANDIDATE_CLASSIFY`, `CANDIDATE_READBACK` | `loadCandidateShadowSnapshot` projects the same captured input, builds coarse passive points, binds exact trip support, and calls `verifyCandidateShadowSnapshot` | `OWNER_REVIEW` withholds an ambiguous correction. `HISTORY_STALE` discards the candidate. `COMPLETE` means the read was verified and durable facts are unchanged. Check the final stamp and current access. |
| `ATLAS_PREVIEW / PREVIEW_MEDIA`, `PREVIEW_READ` | `photo-access/provider.tsx` `loadRecognizableReveal`, `readRecognizableTrip` and `resolveRecognizableMedia` verify source, exact slots and final stamp | `MEDIA_UNAVAILABLE` gives neutral media. `ACCESS` restricts, `MEDIA_VERIFY` discards a malformed slot list, `HISTORY_STALE` or `SKIPPED` withdraws work. Check native permission and slot count before checking the final stamp. Classified storage faults and `UNKNOWN` remain fixed and content-free. |
| `REPLAY_RENDER / REPLAY_ELIGIBILITY`, `REPLAY_MANIFEST`, `REPLAY_PREVIEWS`, `REPLAY_ENCODE`, `REPLAY_OUTPUT_VERIFY`, `REPLAY_OUTPUT_CLEANUP` | `playRecognizableTrip` creates an isolated bounded manifest from exact authorized slots, calls `munimReplayRenderer`, checks the output and revalidates the candidate before returning | `ACCESS`, renderer `MEDIA_DECODE`/`MEDIA_ENCODE`/`MEDIA_VERIFY`, `MEDIA_UNAVAILABLE`, `SKIPPED` and boundary-specific `UNKNOWN`. Stale scope discards the temporary output. Verify source, manifest scope and local file settlement. No committed Replay state is written. |
| `REPLAY_EXPORT / REPLAY_HANDOFF` | `exportPrivateReplay` rejects tracked private D2 preview files at the existing native sharing entry | `ACCESS` blocks handoff without exposing the path. D2 output remains a private preview and cleanup retains ownership until verified deletion. |
| `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_SAVE`, `POSSIBLE_TRIP_REBUILD`, `POSSIBLE_TRIP_ACK` | `reconstruction/repository.ts` `saveCandidateShadowDecision` validates command, source, full stamp and exact canonical support in the writer, then rebuilds with the canonical correction and verifies its application before COMMIT | `HISTORY_CONFLICT` fences command reuse. `JOURNEY_REMAP` leaves an incompatible or unverifiable target review-only. `HISTORY_STALE`/`ACCESS` fence changed scope. Classified SQLite faults distinguish no write or verified rollback from `unknown` acknowledgement. Retry only the same command. |
| `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_READBACK` | `saveCandidateShadowDecision` reconciles the exact command and reads its verified application after COMMIT. `reviewRecognizableTrip` refreshes the durable Atlas only after that result | `COMPLETE` publishes verified correction state. Missing acknowledgement, failed readback or a superseded result keeps the choice pending. Check the same command before reporting a new visible generation. |
| `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_PUBLISH` | `reviewRecognizableTrip` reads the owner-visible baseline after exact Keep verification and checks current Local access before handing it to Atlas | `COMPLETE` publishes the current read. `HISTORY_STALE` withdraws switched or revoked work. Classified read failure leaves the card pending so the same command can be verified again. |

The synthetic rejection fixture found that the baseline continuity pass can
re-admit an orphaned rejected visit. Restricting the pass alone makes the final
canonical remap reject the intentional absence. The Local D2 sidecar preserves
the owner's exact reviewed visit partition, verified support keys and family
snapshot under the candidate policy. `POSSIBLE_TRIP_SAVE` rechecks that exact
scope and blocks any candidate overlapping already qualified baseline support.
`POSSIBLE_TRIP_ACK` and `POSSIBLE_TRIP_READBACK` reconcile only the same command
and exact shape after native settlement. The gated candidate reveal filters
the exact shape after rebuild. A changed shape needs review again. The active
baseline and account projections stay on their existing policy.

At `POSSIBLE_TRIP_ACK`, `database/native-transaction.ts` retains a quarantined
turn when native rollback also fails. If SQLite specifically reports that no
transaction is active after a lost COMMIT acknowledgement, release the turn
with the outcome still unknown and read the exact command before success.

Collect the mapped fixed fields from the current development app process and
one correlation per action, as specified in `delivery-and-diagnostics.md`.
Use synthetic mounted tests and SQLite fixtures for gated navigation, empty
and sparse cases, exact support, scope changes, transactional retry, replay
isolation and sentinel redaction. Product quality remains `not_measured`.
The device matrix and the reviewed baseline/candidate holdout remain open.

### D2 host verification and remaining scope

Android album incident. A committed rebuild completed, while Atlas reported
`ATLAS_PREVIEW / PREVIEW_READ / UNKNOWN`. Narrow that event at the owning
boundaries. `PREVIEW_SCOPE` covers repository privacy and run selection,
`PREVIEW_READ` covers the selected journey SQL, `PREVIEW_SUPPORT_READ` covers
its evidence-family read, `PREVIEW_MEDIA` covers native media resolution,
and `PREVIEW_VERIFY` covers post-read authority. Preserve the Atlas request
correlation and the unchanged durable state. Read only closed stage/reason
fields from the current app process after opening one journey.

Android comparison follow-up maps the committed snapshot check in
`loadCandidateShadowSnapshot` to `ATLAS_REBUILD / CANDIDATE_INPUT_READ`.
`ROW_LIMIT` means the bounded read exceeded its capacity, `HISTORY_INCOMPLETE`
means there is no complete input snapshot, and `SKIPPED` covers withdrawal.
All leave Atlas unchanged and reuse the existing comparison action correlation.
Read only those closed fields from the current app PID after opening the
Settings comparison. Do not retrieve the underlying photo rows.
On `ROW_LIMIT`, the Settings provider passes a typed, content-free result to
the preview screen. It explains the comparison limit without prompting a
retry or suggesting deletion. The current Android process confirmed `ROW_LIMIT`.

The Android development bundle exported with the reveal gate enabled after
rerunning Metro with one worker. The mobile suites ran in eight batches, with
the corrected schema fixture and affected screens rerun. The resulting inventory
is 111 suites and 1,180 tests. All 120 SQLite cases passed, with a final targeted
rerun covering withdrawal during COMMIT and exact retry. Mobile TypeScript,
lint, generated-domain freshness, diff checks and the 199-test foundation check
passed. Host evidence covers authorization, sparse reveal, separate Possible
trips, isolated playback, Keep publication, rejection, redaction and recovery.

Independent review sessions reached usage limits before completing all layers.
Their surfaced findings led to a dedicated SQLite writer connection, accurate
post-commit cancellation diagnostics and observation-scoped map position.
Keep for candidate-only groupings and rejection restoration remain open. Native
interaction and playback, reviewed reconstruction quality, and account policy
compatibility require separate acceptance.

The approved spec and [diagnostic map](delivery-and-diagnostics.md) govern
implementation. The initial clarification selector is pure. Ineligible,
unsafe, or insufficient simulations return no offer. A later runtime caller
will map this expected outcome to ATLAS_CLARIFY / QUESTION_SIMULATE / SKIPPED.
No photo, permission, writer, or diagnostic transport is called by the selector.

Implemented a callable shadow local policy and a paired canonical synthetic
test. Two independent sessions on a nearby outing yield zero automatic trips
in the baseline and one reliable trip in the candidate. Other candidate
controls cover routine activity, owner decisions, continuity and ordering.
The active Atlas and account worker continue to use the existing policy.

The controlled first-reveal, clarification and Possible trips components
have fixture coverage. They receive authorized view data and callbacks.
The clarification selector caps work at three candidates, rejects unsafe
branches and double-counting, and withdraws on cancellation or stale scope.
The native v41 receipt and command journal persist one offer per record,
reject command reuse, and delete with the private record. The original offer
snapshot stays fixed while the caller verifies current action authority in
the writer. This supports later retirement or undo after a generation change.
Receipt diagnostics use ATLAS_CLARIFY / QUESTION_OFFER_SAVE or
QUESTION_DECISION_COMMIT. An answer receipt does not by itself alter trip facts.

Open work includes release activation, D3 question answer and undo, Keep for
candidate-only regroupings, a way to restore a rejected candidate, scoped
account parity, held-out calibration, and Android/iOS acceptance. AI remains
outside the default path. Do not activate the shadow output before these gates.

Verification passed 40 focused mobile tests, 116 real SQLite tests, mobile
TypeScript and lint, generated-domain freshness, and the 199-test foundation
check. Focused review found command-reuse, ordering and cancellation gaps.
The journal now rejects reuse, eligible inputs are ordered and deduplicated,
and an aborted branch cannot publish an offer.

Development preview integration uses CANDIDATE_INPUT_READ, CANDIDATE_CLASSIFY
and candidate readback at the repository boundary. The provider uses
ATLAS_PREVIEW / PREVIEW_MEDIA for bounded native thumbnail resolution and
checks current scope before publishing. The initial preview requires Local
history with full photo access and makes no new permission request. Revoked,
limited, switched and superseded requests withhold their results.

The opt-in Settings route now reads the current committed SQLite evidence,
computes shadow candidates outside the read transaction, and checks the
same committed scope again after resolving covers. It aborts on blur and
background, displays up to 12 cards and skips histories above 4,000 evidence
rows. The preview is read-only and has no answer, Keep or Replay actions.
Android inventory found no connected device. Host coverage includes the
real SQLite paired case, which shows a reliable candidate while the live
Atlas remains empty, then proves the token expires after a Home change.
Thirty-six focused mobile tests, 117 real SQLite tests, TypeScript and the
199-test foundation check passed during preview integration.

### D2 Local authority and media evidence (2026-11-10)

Real SQLite covers a qualified shadow candidate with an unchanged baseline,
exact Keep into the baseline Timeline and Replay, and an exact Local
candidate rejection that survives a fresh repository and rebuild. An
unrelated outing remains available. The writer tests inject busy, permission
loss before COMMIT, a lost acknowledgement after COMMIT, and overlapping
retries of the same command. They verify one durable write, no published
receipt before settlement, exact command conflict handling, and fixed stage,
correlation and outcome fields with synthetic private values omitted.

Mounted Provider coverage exercises the off gate, exact video-only preview,
malformed native slot count, busy media read, loss of full permission after
render, temporary output disposal and the blocked native sharing handoff.
The featured renderer takes one bounded candidate manifest and does not
load or mutate the lifetime Replay composition. Candidate-only rejections
apply to the exact current shadow policy shape. Later evidence or a baseline
qualification can create a different result and requires review. Portable
history export is fenced while the Local-only rejection format is unsupported.

For device collection, verify the current development bundle was built with
`EXPO_PUBLIC_TRAVEL_LIFE_RECOGNIZABLE_REVEAL=true`, confirm the installed Android
package with `adb shell dumpsys package com.anonymous.travellife`, resolve its
current PID with `adb shell pidof com.anonymous.travellife`, and confirm the
foreground app is showing Local history with full access. Use
`adb logcat --pid <pid> -v raw ReactNativeJS:I '*:S'` for the current process.
In an iOS development build, select the active Travel Life process by its
installed bundle identity in the Xcode or paired-device console. On either
platform, filter to `[Travel Life diagnostic]` in that session. Reproduce one
action and follow its `correlationId` across the mapped stages. If the console
wraps the structured payload, reconstruct the six closed fields locally before
retention. Retain only `operation`, `stage`, `reasonCode`, `retryable`,
`durableOutcome`, and `correlationId`. Keep private media and raw console
streams on the device or approved local host. Physical playback, map, access
and accessibility acceptance remain open. Product quality is `not_measured`.
