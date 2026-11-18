---
id: SPEC-atlas-reconstruction-recovery
date: 2026-11-10
status: in-progress
baseline_commit: 8a16c1d10337d1f4cd4b78c1b4b1f341712d5d66
companions:
  - engine-and-evidence.md
  - experience.md
  - delivery-and-diagnostics.md
  - acceptance.md
  - automatic-visual-recovery.md
  - offline-landmark-index.md
  - ../../../docs/decisions/0017-trip-merge-review-and-home-search.md
  - ../../../docs/decisions/0018-city-level-possible-trips.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources: []
---

# Atlas reconstruction recovery

## Why

An owner should recognize their journeys and open their photos before trusting
an Atlas rebuild. Android inspection found out-of-order trips, repeated country
labels, cross-border joins that need review, and unreliable GPS-less recovery.
The visual pilot found one landmark but returned an incomplete album with
unrelated media. Pin-first Home setup and a comparison that stops at 4,000
records make those problems harder to correct and verify.

## Capabilities

- **CAP-1**
  - **intent:** Preserve genuine continuity without grouping separate outings on weak evidence.
  - **success:** An independently qualified pair stays separate when its connection is uncertain. A verified continuous cross-border trip stays whole and an owner-confirmed boundary is respected.
- **CAP-2**
  - **intent:** Make a possible merge easy to see and review in Timeline.
  - **success:** A cue identifies the exact pair even when its cards are separated. The pair remains two trips until a confirmed, durable merge is read back.
- **CAP-3**
  - **intent:** Set or change Home by searching for a locality.
  - **success:** First use and Settings accept a disambiguated province, city, district, ward or commune result as applicable. A user can confirm a supported area and dates without touching the map.
- **CAP-4**
  - **intent:** Recover recognizable trips when photos have dates but lack GPS.
  - **success:** Within the authorized scope, Atlas recognizes supported stops across candidate sessions and independently qualifies trip continuity and album membership. One private proposal shows the supported destination, observed period, representative covers and the eligible album. The owner can confirm the reviewed trip once, without entering dates, places or photo selections.
  - **City-level review:** Surface the proposal as soon as independent capture sessions establish both the city and trip continuity, even if just one named stop has been verified.
  - **Visual coverage:** Atlas searches versioned offline public references across regions and can acquire a deeper pack automatically when evidence supports it. Public benchmark and device gates apply before activation.
  - **Regression:** On the reported Android library, automatic discovery proposes the multi-stop trip with correct photos beyond the first recognized stop and omits the unrelated images. The album read back from Timeline matches the reviewed proposal.
- **CAP-5**
  - **intent:** Read Timeline in meaningful chronological order and distinguish similar cards.
  - **success:** Same-year trips sort by supported observed dates. Matching years do not alone show Order uncertain. Closely labeled trips show a readable observed period.
- **CAP-6**
  - **intent:** Recognize Vietnamese destinations at the best verified level.
  - **success:** Vietnamese trips show supported city or province names across regions, including Huế, Sa Đéc and Cần Thơ controls. Multi-stop trips keep their supported destination names visible. When support reaches only the country level, show the country. Unresolved country evidence uses the neutral fallback.
- **CAP-7**
  - **intent:** Browse trips and their photos safely through an Atlas rebuild.
  - **success:** Rebuilding a nonempty record never renders a false empty state. A successful transition exposes one verified generation across Timeline, trip detail, albums and Replay eligibility.
- **CAP-8**
  - **intent:** Compare reconstruction policies privately at the scale of the reported library.
  - **success:** The read-only comparison runs baseline and candidate on the same authorized Local input of more than 19,000 records and discards stale results without altering the committed record.

## Constraints

- Treat observed locations, visual hypotheses, owner assertions and album membership as distinct facts. Preserve owner corrections, consent, source authority and saved Replay choices.
- Keep merge and recovery proposals outside published trip totals, map anchors and Replay until verified confirmation. Existing qualified trips remain independently available.
- Home search is offline. Automated visual discovery runs within an authorized processing scope, on a bounded set of candidate photos. Any external processing requires separate disclosure and consent. No raw private evidence enters logs or repository fixtures.
- The offline landmark slice uses public reference downloads and local inference. It requires neither paid AI credentials nor billing. Owner photos and derived recognition inputs stay on the device.
- Keep Local and Account authority distinct. Gate incompatible account and worker policies. Require the diagnostic, privacy, scale and device acceptance in the companions.

## Non-goals

- Street-address or point-of-interest search for Home, automatic location inference from date alone, or a claim about actual travel routes.
- Automatic library-wide AI analysis, uploading the entire library, or automatic AI-derived trip publication.
- A wholesale Atlas redesign, new sync or sharing scope, or redesign of the previously approved optional first-reveal question.

## Success signal

On the same Android library, an owner can browse a chronological Timeline and
open its albums through rebuild, identify a reviewable cross-border pair, and
set Home from search. The comparison measures which false joins, false splits
and missed trips change. The owner can recognize the GPS-less multi-stop
journey and its reviewed album, and distinguish Vietnamese trips by verified
destination names.

## Assumptions

- Newest observed start first, unknown dates last, with a deterministic tie-break.
- The fine dotted Timeline connector and a dismissible in-Atlas AI hint are working designs for native review.
- Ship the Local repairs independently of the AI experiment. Inherit the existing Local rollout gate and device acceptance until the new release gates pass.
- Reuse Possible trips and a compact cover strip with a paged album. Preserve confirmed facts and offer an explicit correction when a repaired candidate would replace an earlier confirmation.

## Open questions

- Which versioned offline boundary and name data cover Vietnamese cities and provinces, including historical observations?
- Which recognizer, starter coverage, regional pack sizes and delivery mechanism pass the [offline benchmark and device gates](offline-landmark-index.md)?
- Which evidence thresholds and resource budgets pass the reviewed holdout and real-library scale gates? Freeze them before acceptance scoring.

## Partial Seoul proposal development slice

Exercise the normal automatic Possible trips flow locally using the accepted
partial Seoul result. The [delivery contract and diagnostic map](delivery-and-diagnostics.md#partial-seoul-proposal-in-possible-trips)
define the opt-in, review-only Nami clue, unchanged album and confirmation
authority, and the development acceptance checks.

## City-level Possible trips implementation

Implement Decision 0018 and AC-34 on the normal automatic visual discovery
path. The [delivery and diagnostic contract](delivery-and-diagnostics.md#city-level-possible-trips)
defines the evidence rule, compatible persistence and verification.
The city policy is implemented and host-verified. Android owner-library
acceptance remains open under CAP-4.

## On-device visual sampling audit

Continue the owner-device incident by locating the first evidence boundary
that excludes photos in the reported travel window. Use the read-only
[coverage audit contract](delivery-and-diagnostics.md#on-device-visual-sampling-audit).
Verify the normal sampler and recognizer on device before changing either.

## Automatic regional landmark retrieval

The owner approved replacing per-landmark fixes with reusable automatic
retrieval. Implement the [regional build contract and diagnostic map](delivery-and-diagnostics.md#automatic-regional-landmark-retrieval).
Seoul and an independent Hanoi GPS-less episode must exercise the same
runtime and the normal Possible trips path. Keep the physical Android
acceptance and public-pack publication gates explicit.

## Review Triage Log

| Finding | Verdict | Route and evidence |
| --- | --- | --- |
| A pending match outside the qualified period can appear in the review | Medium | Patched. Only a match inside the support interval can supply the place clue. The outlier-only fixture stays quiet. |
| An unnamed duplicate can re-enter through scene association | Medium | Patched. The duplicate-family regression keeps it out even when the scene rule would otherwise qualify. |
| Seoul dismissal can resurface across modes | Medium | Patched. SQLite generates a three-stop dismissal and proves the two-stop replay remains suppressed. |
| Immediate readback can attach to another checkpoint | Medium | Patched. Bind the read to the exact acknowledged scope, stamp and state and test a competing write. |
| Missing readback has no provider regression | Medium | Patched. Assert one correlated stale diagnostic and no card after a staged read returns done. |
| The off, parent-off and release readers were unverified with a staged partial row | Medium | Patched. All three reopen in the ordinary scan scope and decline the preview token. |
| Non-Seoul behavior was untested when a stray Nami clue is present | Medium | Patched. A Taipei episode still qualifies with exact members and no island clue. The catalog has no non-Seoul destination in continuity range of Nami. |
| Recognition can inject a representative that failed native photo resolution | Low | Patched. Qualification only accepts IDs actually supplied to the recognizer. |
| Preview scope resets ordinary scan progress when a new checkpoint is written | Low | Accepted development behavior. There is one resumable scan variant at a time. Verified owner decisions remain durable under both variants. |
| Pre-read errors use PROPOSAL_READBACK on the immediate second read | False | That token-bound call performs committed proposal verification. Initial scanning retains HINT_ELIGIBILITY through the read callback boundary. |
| Unverified Nami observation could prove a conflicting route | False | The clue has no verified capture location or stop authority. The unchanged continuity check uses only accepted stops. |
| Readback reports stale when another action changes the checkpoint | Low | Accepted lifecycle behavior. A changed durable generation triggers a fresh scan. A stale token cannot generate a card on the old generation. |
| Confirm trip text does not use the destination name | Low | The heading, separate Possible stop row, and exact reviewed photo count make the scopes visible. Keep the agreed existing confirmation control. |

### City-level review

| Finding | Verdict | Route and evidence |
| --- | --- | --- |
| Reopened proposal has a smaller chronology than staging | False | A reopened card requires the stage that checked representatives against the current source generation. Readback checks its stored member groups, exact current source identities and times. The synthetic bypass requires replacing the staged database payload with fabricated support. |
| Two names can bypass verification of the claimed city | Medium | Patch. Derive the destination from the validated stops. SQLite substitutes Hà Nội for two supported Seoul landmarks and expects `MEDIA_SCHEMA`. |
| Persisted short image-only support can bypass the origin safeguard | Medium | Patch. Share the eligibility predicate with the qualifier. |
| A late named group in the same session can mask a viable civic group | Medium | Patch. Choose capture groups with a valid transition and cover the closer independent civic pair. |
| Coarse Home check uses the city's public anchor | Low | Deferred pending a city-versus-district Home policy. Conservative Home suppression remains in force. |
| A photographed municipal decision can count as civic signage | Medium | Patch. Add fixed document context exclusions and verify a decision-heading control. |
| The Hà Nội provider test injects its named match | Medium | Deferred native quality coverage. The local image index has Ewha references. The qualified regional artifact is still unavailable. The test verifies engine and app flow with a synthetic landmark match. |
| Committed album verification did not reopen after confirmation, exercise revoked access or resume a pre-marker state | Medium | Patch. Exercise all three through real SQLite. |
| Sampling can omit captures that connect two inferred sessions | Medium | Deferred existing representative sampler limitation. Measure inferred session precision against full capture chronology before changing the scan budget. |
| A multi-stop result can proceed despite competing civic support | Medium | Deferred existing named-route arbitration. The mixed-location fallback veto applies to city-level qualification. The independently supported named route takes priority in this slice, and conflicting civic captures stay out of the album. |
| The storage validator misses the same short-image case as the qualifier | Medium | Patch. Apply the shared stop predicate to stored membership and its original timestamps. |
| An administrative document duplicates the accepted Hanoi civic heading | Medium | Patch. Check the complete OCR context for administrative-document evidence. |
| Same-action stage and immediate readback are tested only through a provider stub | Medium | Patch. Read the exact stored city proposal with the original stage token under the base scope. |
| Hanoi dismissal could return when an unchanged episode gains a different proposal shape | Medium | Patch. SQLite dismisses the named variant and suppresses the city variant of the same episode. |
| A completed pre-marker scope was absent from compatibility tests | Medium | Patch. Seed the completed old scope and verify normal rescanning under existing consent. |

### Regional retrieval review

| Finding | Verdict | Route and evidence |
| --- | --- | --- |
| A starter outage can overwrite a persisted regional checkpoint with a legacy scan | Medium | Patched. A configured release with no verified starter leaves the scan row untouched. Provider failure tests assert no scan or checkpoint write. |
| A retryable deep outage can advance past an unresolved episode | Medium | Patched. Stage an independently qualified result or leave the checkpoint pending for the next authorized scan. |
| Deep ambiguity can flow into OCR or scene association | Medium | Patched. Propagate the ambiguous hit and omit that photo from visual observations. |
| A missing preview can artificially divide a source session | Medium | Patched. Retain representative timing during routing and supply embeddings only for opened photos. |
| A failed HTTP response can continue sending bytes beyond the action | Medium | Patched. Abort the transport on rejection as well as timeout, and assert the signal during a failed pack response. |
| A stalled digest can keep the scan running after cancellation | Medium | Patched. Transport and digest both use the existing pack step deadline and action authorization fence. |
| The pack could accept a different local model with identical tensor shape | Medium | Patched. Validate exact model size and SHA-256 before regional inference and exercise failure followed by verified preparation. |
| Individual pack sizes understated the retained working set | Medium | Patched. Gate on starter plus largest deep pack plus release manifest. |
| Matcher-only time understated preparation and inference | Medium | Patched. Keep matcher time separately and measure the host pipeline from decoding and native inference to report scoring. |
| Intake-excluded screenshots diluted the false-match denominator | Medium | Patched. Count actual matched camera attempts, including their scenario repetitions. |
| A wrong label on a positive photo could be hidden by exact album scoring | Medium | Patched. Compare every attempted camera photo with its frozen expected place. |
| Maximum synchronous matching cost on Android is unmeasured | Medium | Open device gate. The host score and test clocks do not permit a claim about Android responsiveness. |
| Screen reproductions with capture-like metadata remain unscored | Medium | Open quality gate. The current fixture exercises screenshot intake and genuine camera negatives. |
| Regional provider and durable release behavior lacked acceptance evidence | Medium | Patched. Synthetic provider tests stage both regions. SQLite covers a stale release and reopening the same confirmed album. |
| The dev procedure did not link the public artifact release and USB setup | Low | Patched in the mobile README. The benchmark currently emits no activation digest. |
