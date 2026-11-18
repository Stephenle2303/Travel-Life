# Delivery and diagnostics

Timeline chronology uses the existing `ATLAS_DURABLE_READ` stages.
`DURABLE_JOURNEY_READ` owns observed-date SQL and `DURABLE_PROJECTION` owns
local period presentation. The date formatting is deterministic and adds no
I/O boundary. Existing provider classification and correlation cover failures.

The initial Atlas projection treats a connected source whose durable privacy
read has not resolved as processing. The connected provider effect owns
`ATLAS_DURABLE_READ` failure classification at the repository's exact read
stage. A verified empty record may render sparse, while access withdrawal and
read failure retain their existing restricted and recovery states.

Album, journey and Replay eligibility use the same published-run selector as
Timeline. `ATLAS_PREVIEW / PREVIEW_SCOPE` rejects a missing or superseded
selection and `PREVIEW_VERIFY` rechecks authority after query and native media
resolution. An incomplete Home transition withholds media from the old Home
projection.

Ordinary rebuild uses the existing isolated projection writer, so a reader
can see the last committed generation while SQLite replaces its rows.
`ATLAS_DURABLE_READ / DURABLE_PROJECTION` checks the committed run before
replacing the displayed journey lookup. A changed run yields `HISTORY_STALE`
and retains the previous lookup until the next successful read.

## Ordered delivery

Timeline merge review reads exact persisted proposal links in
`ATLAS_DURABLE_READ / DURABLE_JOURNEY_READ`. It projects only pairs that the
current structural writer can apply. The Local provider rechecks access,
record generation and the displayed pair before dispatching the correction.
`POSSIBLE_TRIP_REVIEW` uses `POSSIBLE_TRIP_SAVE` for guarded confirmation and
`POSSIBLE_TRIP_READBACK` for verification. Failed or stale reads keep the
previous Atlas. An exact correction receipt supports retry after acknowledgement
loss.

The Local development projection is separately opt-in. It consumes the
already-computed canonical snapshot, checks a completed full import and
excludes protected or ambiguous support. Only exact pairs that the current
correction writer can review are eligible for native publication. The
`reconstruction_run.rule_version` marker preserves projection selection on
subsequent rebuilds and fences current Account export at
`HISTORY_EXPORT_CANDIDATE_COMPATIBILITY`. With a saved Replay draft and an
existing recovery run, rebuild retains the prior run if the automatic
partition would change. The existing `ATLAS_REBUILD` action classifies
owner-review conflicts and `REBUILD_PROCESSING` profiles the bounded
candidate phase. Activation is development-only and defaults off.

1. **CAP-7 and CAP-5.** Fix observable rebuild/readback and chronology risks
   through existing Atlas, repository and media entry points. Keep sorting a
   read-model change where possible. Capture exact cause or explicit unknown
   for the transient empty view and earlier photo-opening failure.
2. **CAP-8 and CAP-1.** Make the comparison work on a full Local snapshot,
   then measure a versioned engine candidate against the same baseline. A
   bounded or isolated fixture can test behavior before the full-scale gate.
3. **CAP-2.** Bind exact merge suggestions and review to the gated candidate
   results. Reuse existing correction receipts and privacy guards where they
   preserve exact pair authority. Activation requires verified commit and
   readback, including Replay and edit races.
4. **CAP-3 and CAP-6.** Verify locality coverage, source versions and separate
   search-point and reverse-label controls. Home search can ship once its own
   controls pass. Restore regional labels only after their acceptance.
5. **CAP-4.** Implement automatic discovery using the
   [automatic visual recovery contract](automatic-visual-recovery.md).
   Validate candidate scheduling, on-device recognition and verified review
   in that order. AI failure or deferral leaves Local reconstruction usable.

Steps 1, 4 and the offline work for step 5 can be developed independently of
engine policy calibration. Before enabling changes that affect Account or a
resumable worker, negotiate policy and checkpoint compatibility. Roll back to
the prior compatible policy with current consent and owner facts. Preserve
unresolved decisions for review. No reset, forced reimport or silent migration
of incompatible owner decisions is a recovery path.

## Runtime boundaries

- **Projection and comparison.** Reuse `reconstruction/engine-v1-1.ts`,
  `canonical-projection.ts`, `candidate-projection.ts` and the scoped
  repository/provider. Use bounded, version-fenced reads and an interruptible
  workload. Preserve whole-history context across pages for Home/routine and
  cross-page boundaries. Baseline and candidate consume identical normalized
  evidence, permissions and owner decisions. Do not substitute an arbitrary
  sample for the requested full comparison. Record both policy versions and
  stable input identity. Defer activation if scale or quality is unverified.
- **Published readback.** `reconstruction/repository.ts` and
  `photo-access/provider.tsx` own generation selection. Atlas and gallery can
  read the old generation during rebuild only if it remains physically
  readable and authorized. Preserve or pin it accordingly. Never combine an
  old list with new visit or media rows. Verify source, privacy, Home,
  correction and generation fences at reads and publication. Release retired
  data through the existing retention policy once no authorized read needs it.
- **Home and labels.** Reuse the `owner-place-search.ts` interface where it fits.
  Replace or extend the index when it lacks approved coverage. Reuse Home's
  writer and existing date semantics. Use `destination-label.ts` and the
  country resolver for geographic labels. Keep dataset provenance, version,
  redistribution terms and fixture controls reviewable.
- **Visual recognition.** Add a bounded proposal interface at the existing
  consent and local evidence boundaries. Keep media handles in the authorized
  adapter. Treat all provider output as untrusted. Validate result shape,
  place identity, scope and consent before exposing a proposal or using it in
  engine evaluation. The initial automatic slice runs on-device. Recognizer
  selection and the measured resource envelope remain open.

### CAP-4 automatic discovery source map

The implementation extends this map with `CONSENT_WRITE` in
`repository.ts/setVisualDiscoveryEnabled` (privacy-priority SQLite transaction and
readback), `PROPOSAL_STAGE` in `repository.ts/checkpointVisualDiscovery` (cursor
CAS, private proposal write and exact acknowledgement), and `PROPOSAL_READBACK`
in `repository.ts/loadVisualDiscoveryPage` and the provider (scope, stored
place/representative validation and preview availability). A stale CAS uses
`HISTORY_STALE`; a locked transaction uses `DATABASE_BUSY`; a malformed private
record uses `MEDIA_SCHEMA`; a queued withdrawal uses `SKIPPED`. After a commit
has been requested, an unresolved acknowledgement carries outcome `unknown`
until the same checkpoint or review receipt is read. A disabled feature is
`HISTORY_CONSENT` at `CONSENT_CHECK`; permission loss is `ACCESS`; a work slot
held by a prior native recognition is `ALREADY_RUNNING` at `RECOGNITION`.
Unclassified failures retain their exact stage and `UNKNOWN`. To diagnose
retries, match START and terminal events at the affected stage before inspecting
the current Local read or the private transaction receipt. No media handle,
candidate identity, dates, recognized text or place label enters diagnostics.

Use one `VISUAL_PLACE_REVIEW` correlation per discovery attempt through the
proposal write. Use a new correlation for the confirmation action and its
readback.

| Stage | Source and guard | Closed reason and durable outcome |
| --- | --- | --- |
| `CONSENT_CHECK` | `photo-access/provider.tsx`, feature enablement and current Local authority | `HISTORY_CONSENT` blocked, `ACCESS` restricted, `SKIPPED` skipped |
| `CONSENT_WRITE` | `repository.ts/setVisualDiscoveryEnabled`, privacy-priority write and exact revision readback | `ACCESS` on scope withdrawal, native classification at the write/readback boundary, uncertain acknowledgement stays unknown |
| `HINT_ELIGIBILITY` | `repository.ts/loadVisualDiscoveryPage` and `visual-place/discovery.ts/advanceVisualDiscovery`, metadata keyset and saved checkpoint | `HISTORY_STALE` skipped, `DATABASE_BUSY` retryable and unchanged, `SKIPPED` on cancellation |
| `MEDIA_SCOPE` | Provider `resolvePhotos` and Local `native-adapter.ts/resolveOwnerPreviews`, single-reference reads with verified scope | `ACCESS` restricted, `MEDIA_UNAVAILABLE` skipped, exact-stage `UNKNOWN` when unclassified |
| `RECOGNITION`, `RESULT_VALIDATE` | `visual-place/native-signage.ts` and `visual-place/recovery.ts/createVisualRecognition`, decode, native deadline, output shape, text presence, place authority and ambiguity | `MEDIA_DECODE` and `HISTORY_READ_TIMEOUT` retryable and unchanged, `MEDIA_SCHEMA` unchanged, `VISUAL_NO_READABLE_TEXT`, `VISUAL_NO_PLACE_MATCH`, `VISUAL_PLACE_CONFLICT` or `VISUAL_EPISODE_SUPPORT` skipped for classified abstention |
| `PROPOSAL_STAGE`, `PROPOSAL_READBACK` | Local repository, atomic checkpoint and private proposal write with verified readback | `HISTORY_STALE` skipped before write, `DATABASE_BUSY` retryable and unchanged before write, unknown outcome on lost acknowledgement pending state verification |
| `REVIEW_COMMIT`, `REVIEW_READBACK` | Local owned transaction and provider refresh, exact group and receipt verification | `HISTORY_STALE` skipped before commit, `COMPLETE` after verified readback, unknown outcome on lost acknowledgement pending receipt check |

Dense-episode sampling widens the existing media and recognition boundaries.
The Local repository validates both bounded checkpoint samples under
`HINT_ELIGIBILITY / MEDIA_SCHEMA` before resuming. The provider continues to
fence each additional media read at `MEDIA_SCOPE`. The recognizer uses the
same single correlated batch lifecycle, timeout, redaction and abstention
rules. Reproduce with a synthetic dense episode whose only matching clue is
outside the original sample, then measure the expanded batch on Android
with no dates or image selections passed to the detector.

Sampling v3 retains the existing 12 session-based representatives. Episodes
with at least 72 eligible records add a time-stratified sample, up to 32 total
recognition inputs. The additional checkpoint retains at most one record per
hour within the existing 14-day limit. Previous episode receipt keys keep
their format so dismissals for unchanged evidence stay effective. The
threshold and budget are development defaults pending device calibration.
The synthetic dense-episode test recovered a clue beyond the original
sample. The Android v3 run completed the incident-window batch in about
35 seconds including media resolution and returned VISUAL_NO_PLACE_MATCH.
Checkpoint readback showed no proposal after the interval, and the Local
Atlas showed no Possible trips card. Device quality acceptance is open.
The Android OCR debug rerun used recognizer v4 to distinguish a wholly empty
OCR batch from unmatched OCR. The checkpoint was observed inside the target
interval before recognition and beyond it after the terminal batch with no
proposal. The terminal reason was VISUAL_NO_PLACE_MATCH, which requires
some alphanumeric OCR output and no accepted place match. Exact text,
photo references and place labels were not collected.

[MediaPipe Image Embedder](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder)
can provide an on-device similarity runtime for a future image-only evaluation
against verified public reference photos. Its generic embeddings require
landmark-level holdout calibration before use as a place signal. Apple's
published [MobileCLIP model terms](https://github.com/apple-aiml-research/ml-mobileclip/blob/main/LICENSE_MODELS)
exclude product development. No image-only model was added in this change.

Use the current Android dev package `com.anonymous.travellife` and verify the
active bundle before collecting PID-filtered `ReactNativeJS` events. For iOS
use the active dev app process log. Match operation, stage and correlation,
then reproduce at the mapped guard with synthetic inputs. Inject sentinel
photo references, raw model text and place labels to verify redaction. For
stalls record start and terminal outcomes. A missing terminal event means
the outcome is unresolved. Retain only closed events and aggregate timings.

The first automatic recognition adapter uses existing native OCR and a
closed, versioned public signage catalog. `RESULT_VALIDATE` owns OCR
shape validation and the catalog match. Unknown text, travel documents,
directions, ambiguous site names and conflicting locations abstain. An
unknown stored place ID withholds the proposal as `MEDIA_SCHEMA` at repository
readback. These checks prove catalog behavior. Image-only recognition and
the real-library benchmark have separate acceptance.

In the first authorized Android session, the consent write completed, two
candidate recognitions reached RESULT_VALIDATE / SKIPPED and the durable
cursor advanced beyond the incident interval without a proposal. A read-only
aggregate verified the incident episode's size, elapsed span, 11 usable
sessions and absence of confirmed overlap. No output tied either historical
abstention to the specific episode. The v3 recognizer version changes
diagnostic classification only and invalidates the prior scan checkpoint so
that the same authorization permits one fresh automatic evaluation.

### CAP-4 host verification and measurement plan

The development gate is `EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW=true`
in a native dev build with the signage module. The Local Settings permission
starts disabled and independently authorizes processing. Atlas uses the
latest committed reconstruction and full current gallery access. A foreground
Atlas session scans at most 256 metadata rows per page, with a 250 ms pause
between work units. The policy keeps a time-stratified carry across pages,
tries up to 12 distinct local images per episode with a 4 s deadline per
recognition call, and retains up to four verified album representatives.
These values are development budgets pending device measurement.

The `visual-episodes-v2` synthetic controls include a 471-image, six-day
episode that spans pages without a geotag, date hint or owner input. They
exercise independent capture sessions, deterministic representatives,
duplicate suppression, and abstention for a single burst or a long routine
sequence. The separate `local-signage-v2` controls cover multiple catalog
places, namesakes, conflicting clues and incidental text. They use synthetic
OCR output. Native text recognition accuracy and recovery recall remain
unmeasured.

The SQLite suite verifies the default-off preference, permission loss and
reopen, a staged proposal that adds no Timeline trip, dated Home suppression,
durable dismissal and repeat suppression, and rollback followed by an exact
retry after acknowledgement loss. The verified owner trip exposes its exact
representative album while canonical capture coordinates remain null.

The focused mobile command
`npm run test -- --cacheDirectory .jest-cache-codex --silent visual-place-automatic.test.tsx visual-place-recovery.test.ts visual-discovery.test.ts visual-place-catalog.test.ts photo-access-provider.test.tsx`
passed five suites and 108 tests. The provider controls force metadata
contention, media failure, loss of gallery access during a media read,
invalid recognizer output, checkpoint failure before and after acknowledgement,
invalid stored proposal, and review failure before and after acknowledgement.
Each test verifies the exact stage, reason and durable outcome, a single
correlation, one failure emission and private sentinel redaction. The UI
controls exercise the feature-level setting and the first visible proposal's
destination, period, cover and direct confirmation.
Two additional recognition tests passed in the six-test focused recognizer
suite. They verify that a timed-out native slot stays fenced until settlement,
late output stays private, and a decode fallback still needs independently
timed usable photos.

For the authorized blind Android validation, verify the latest Metro bundle
and installed PID with `adb shell pidof com.anonymous.travellife`, then open
**Settings → Privacy & data** and enable discovery. Return to Atlas with
the authorized Local source and full gallery access. Use the current PID's
`adb logcat --pid <pid> -v raw ReactNativeJS:I '*:S'` and retain only closed
`VISUAL_PLACE_REVIEW` events keyed by correlation. On iOS, confirm the current
bundle in the dev app and collect the same operation from that process in
Xcode's device console. Keep the freeze, reviewed place, period, album and
owner decision in approved private evaluation records. Record aggregate
scan/recognition time, peak memory, abstentions, false proposals, and the
count of owner actions. Score place precision and episode/album correctness
independently against the repaired Local baseline. Freeze holdout criteria
and resource budgets before rollout. Host controls do not establish the
blind Seoul result, image-only recognition, or physical iOS acceptance.

Signage catalog v2 covers Ewha, Gyeongbokgung Palace, Taipei 101 and Tokyo
Skytree. Use rounded map anchors only for a reviewed suggestion. The
locality and labels were checked against [Seoul Metropolitan Government](https://english.seoul.go.kr/gyeongbokgung-palace/),
[Taiwan Tourism Administration](https://eng.taiwan.net.tw/m1.aspx?id=3469&sNo=0002090)
and [GO TOKYO](https://www.gotokyo.org/en/spot/6/index.html). The existing Ewha
public anchor is retained. Separate supported Seoul landmarks can agree on a
city-level proposal, using a rounded [Seoul City Hall](https://english.seoul.go.kr/city-hall/directions/1-seoul-city-hall-main-building/)
anchor. Synthetic OCR controls passed for all four landmarks, city precision,
ambiguous signs, indirect references and generic scenes.

For image-only recognition, [Google's landmark recognition benchmark](https://research.google/pubs/google-landmarks-dataset-v2-a-large-scale-benchmark-for-instance-level-recognition-and-retrieval/)
and [MediaPipe's on-device classifier runtime](https://developers.google.com/edge/mediapipe/solutions/vision/image_classifier)
are candidate evaluation inputs. The runtime requires a compatible model.
The public legacy Asia classifier and its label-map endpoints were
unavailable during this probe. No weights, license or model performance were
verified. A generic object classifier does not establish landmark identity.

The development candidate uses descending 256-row metadata pages and
keeps up to two distinct representatives per four-hour bucket for a
14-day episode. A gap over 28 hours starts a new episode. Up to 12
representatives from separate capture sessions are considered. These
starting limits are uncalibrated. The synthetic six-day, 471-row control
produces the same candidate across different page splits. Duplicate-only
and extended routine controls abstain. Sampling can miss the only
diagnostic photo in a group, so the control does not establish device recall.

## Diagnostic source map

### CAP-1 continuity candidate

The Local comparison and separately gated Local development writer use the
same versioned recovery candidate.
`candidate-projection.ts/projectCandidateTrips` receives the same full
evidence and reviewed constraints as the baseline. Its boundary classifier
returns fixed in-memory decisions for corroborated continuity, unresolved
continuity, time conflict, owner boundary and corroborated Home return.
An unresolved boundary is an expected comparison result. Any unclassified
calculation failure reaches `ATLAS_REBUILD / CANDIDATE_CLASSIFY / UNKNOWN`
under the existing action correlation. A failed protected remap returns
`OWNER_REVIEW`; cancellation uses `SKIPPED`. These outcomes preserve the
committed record. Inspect only the closed comparison stage and the synthetic
continuity controls, with the CAP-8 collection recipe below.

`atlas-recovery-shadow-v1` evaluates independent support for each resulting
group. It accepts short overnight continuity with precise observations at the
same away place (up to 18 hours), or a timed three-place progression (up to
36 hours, plausible movement on both legs, an intermediate point at least
15 percent of the direct distance from either end, and no more than 1.35
times the direct distance). These are development thresholds pending holdout
calibration. Unresolved adjacent groups stay separate. A suggestion requires
two reliable, noncompeting groups with exact evidence and visit identities.
A corroborated Home return, an owner boundary or conflicting time suppresses
the suggestion. Candidates may divide support held in a single committed visit
or journey. An exact-pair review of committed trips requires two distinct
verified committed partitions.

The read-only Settings surface matches each displayed pair to the baseline
using exact authorized support sets. It can report one matching baseline
group, two separately matching baseline groups, or an unresolved match.
The presentation boundary resolves the two support-scoped destination labels
and observed day ranges inside `repository.ts/loadCandidateShadowSnapshot`.
The provider carries only the labels, periods, a local presentation key and
the closed baseline grouping outcome. Resolver and support matching failures
use `ATLAS_REBUILD / CANDIDATE_PRESENTATION / UNKNOWN` when unclassified
and preserve the committed record. Inspect the preceding classification start
and exact presentation stage under the same action correlation.

The focused host controls cover Vietnam–Taiwan, Vietnam–Thailand and close
same-place repeat outings, corroborated cross-border and Taiwan multi-city
continuity, same-day transitions, dated Home, owner boundaries, contradictory
movement, insufficient independent support, competing suggestions and input
reversal. The canonical baseline remains identical for the same input. The
existing D2 candidate and its receipts still use
`recognizable-travel-shadow-v1`. Real-library outcomes, false merges, false
splits, nearby recall and other product-quality measures remain unmeasured.

The Local projection experiment is a pure eligibility and proposal step in
`local-recovery-projection.ts/projectLocalRecoveryGraph`. It expects a current
canonical result, the recovery candidate, native media type map, and the
caller's current protected Journey and evidence sets. It returns either the
canonical graph or an in-memory graph with exact visit-aligned replacements
and eligible pairs. Unexpected projection faults are processing-stage failures
under the calling action. Protected scope and ambiguous album membership are
expected abstentions, with the canonical graph retained.

The Local writer persists eligible pairs with the distinct
`atlas-recovery-local-v1` run marker. The opt-in path checks full Local
access, including immediately before commit. The exact action retries its
existing receipt and verifies the successor partition before publishing.
The writer protects saved Replay references and abstains on ambiguous album
memberships. Existing recovery runs retain their policy marker across later
rebuilds. The Account export fence rejects that marker until compatible
checkpoint and worker behavior can be verified.

The canonical fixture produced one committed-policy journey from two distant,
five-photo, two-day outings. The in-memory Local experiment produced two
independently `AUTO_CONFIRMED` visit-aligned groups and one exact pair,
preserving every supported album member on its side. The same test proves
abstention when Replay scope protects the parent, either side is withheld or
an album-only photo has no exact successor. A separate-pair fixture added the
link with both original IDs intact.

The Settings presentation control used real synthetic SQLite and confirmed a
joined baseline, two distinct dates, presentation-only fields, and immediate
pair withdrawal after privacy changed. Fault injection verified
`CANDIDATE_PRESENTATION / UNKNOWN` and redaction with the same action
correlation. The focused Settings screen test verified both pair rows,
baseline status copy, and the absence of write controls.

The SQLite writer fixture starts from one canonical trip, rebuilds to two
eligible trips and one exact proposal, verifies the Account fence, then
confirms the proposal and verifies the merged support. Separate fixtures
exercise protected Replay, revoked access before acknowledgement, and retry
after a lost commit response. The mobile Timeline test verifies the dotted
cue only between adjacent visible cards and retains the exact review action
when a filter hides one card.

### CAP-8 comparison stages

| Operation and stage | Source, classification and response |
| --- | --- |
| `ATLAS_REBUILD / CANDIDATE_INPUT_READ` | `repository.ts/loadCandidateShadowSnapshot` checks Local scope and permission, acquires a read-only SQLite snapshot, then reads the stamp, evidence keyset pages, privacy, dated Homes and effective corrections. `ACCESS` blocks unavailable scope, `HISTORY_INCOMPLETE` skips a missing committed run, `ROW_LIMIT` skips an oversized snapshot, and `SKIPPED` represents cancellation. Native read failures retain `DATABASE_BUSY`, `NATIVE_HANDLE`, `SCHEMA` or exact-stage `UNKNOWN`; verify the current Local record and retry transient failures. |
| `ATLAS_REBUILD / CANDIDATE_CLASSIFY` | `candidate-projection.ts/projectCanonicalCandidateHistory` projects the full normalized snapshot and yields at phase boundaries. `OWNER_REVIEW` blocks a protected correction remap; `SKIPPED` discards withdrawn work and `UNKNOWN` identifies an unclassified processing fault. Verify the correction state or inspect the last started phase using the same correlation. |
| `ATLAS_REBUILD / CANDIDATE_READBACK` | `repository.ts/verifyCandidateShadowSnapshot` rechecks authority and exact stored stamp after computation. `HISTORY_STALE` skips changed input, and `SKIPPED` discards withdrawal; read faults retain their native category. `COMPLETE` acknowledges a verified read-only result. The committed record is unchanged for every outcome. |

Settings uses 512-row indexed keyset pages with a 24,000-row development
guard and one-row overflow check. The existing first-reveal path retains its
4,000-row development guard. These guards bound input, independent of the
native performance budgets required for acceptance. The evidence, Home,
privacy, correction and committed-run stamp stays in process; the comparison
result carries policy versions, full input count and elapsed time.

CAP-8 host verification (2026-11-11) used a real SQLite fixture with 20,002
synthetic evidence rows, including 5,000 dated Home geotags and one trip with
support in the first and last keyset pages. Reads returned the same cards and
policy versions at 512 and 127 rows per page. The 512-row run took 1,382 ms
on the development host. The fixture verified no mutation SQL, the overflow
outcome, cancellation during paging, stale Home revision at readback, and
exact input/readback/processing failure events under one correlation per
action. Injected private sentinels stayed out of diagnostics.

For the CAP-8 device run, open Settings in the current Local development
build with the comparison gate on and full photo access. Confirm current
Metro bundle delivery and the installed `com.anonymous.travellife` process
with `adb shell pidof com.anonymous.travellife`. Inspect the current PID's
`adb logcat --pid <pid> -v raw ReactNativeJS:I '*:S'` locally and retain only
`ATLAS_REBUILD` events at the four `CANDIDATE_*` stages, keyed by the new
action correlation. Measure full comparison elapsed time, peak resource use,
foreground responsiveness and cancellation on Android and iOS. Capture only
approved aggregate evidence. The authorized real-library run, device budgets
and held-out quality remain unmeasured. Cancellation is cooperative at page
and phase boundaries, and synchronous engine passes must finish before the
next checkpoint.

Reuse the closed mobile event envelope. Stage names for new boundaries below
are working names to be implemented in `app-diagnostics.ts`. Use one local
correlation per action across the relevant stages. Fixed outcomes report the
durable result independently of whether a screen stayed open.

| Operation and stage | Owner and classification |
| --- | --- |
| `ATLAS_DURABLE_READ / DURABLE_RUN_READ`, `DURABLE_JOURNEY_READ`, `DURABLE_PROJECTION` and `ATLAS_PREVIEW / PREVIEW_SCOPE`, `PREVIEW_READ`, `PREVIEW_SUPPORT_READ`, `PREVIEW_MEDIA`, `PREVIEW_VERIFY` | Repository and provider generation, query and media boundaries. Use `ACCESS`, `HISTORY_STALE`, `SCHEMA`, `DATABASE_BUSY`, `ROW_LIMIT`, `MEDIA_UNAVAILABLE` or exact-stage `UNKNOWN`. Withhold stale media and retain authorized results. Trace the last completed stage of the exact selected journey without reporting its identity. |
| `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_SAVE`, `POSSIBLE_TRIP_REBUILD`, `POSSIBLE_TRIP_ACK`, `POSSIBLE_TRIP_READBACK`, `POSSIBLE_TRIP_PUBLISH` | Exact-pair review writer and readback. Use `HISTORY_CONFLICT`, `HISTORY_STALE`, `JOURNEY_REMAP`, `ACCESS` or the native transaction classification. Verified rollback leaves the old trips. Unknown acknowledgement requires exact command reconciliation. |
| `ONBOARDING_SETUP / HOME_SEARCH_INDEX`, `HOME_SCOPE`, `HOME_COMMAND_COMMIT`, `HOME_COMMAND_READBACK` | Local search and Home writer. Empty matches are expected, a missing or incompatible index uses a fixed availability/schema outcome, stale selection is rejected, and failed commit or readback retains verified Home state. Check dataset and scope before retry. |
| `ATLAS_DURABLE_READ / DURABLE_DESTINATION_QUERY`, `DURABLE_DESTINATION_COMPUTATION` | Verified locality support query and resolver. Dataset or query faults are classified at the owning stage. Geographic ambiguity yields a country/neutral fallback. |
| `VISUAL_PLACE_REVIEW / HINT_ELIGIBILITY`, `MEDIA_SCOPE`, `CONSENT_CHECK`, `RECOGNITION`, `RESULT_VALIDATE`, `REVIEW_COMMIT`, `REVIEW_READBACK` | Local hint, selected media, model adapter and review writer. `SKIPPED` for insufficient signal, withdrawal or abstention, `ACCESS` for revoked media, `HISTORY_CONSENT` for missing approval, `HISTORY_STALE` for changed scope. Distinguish unavailable recognition, timeout and invalid output with closed reasons. No owner-visible fact is changed before verified review. |

For native acceptance, verify the current gated Android bundle and
`com.anonymous.travellife` PID. On iOS use the resolved bundle/process and
authorized console. Collect only the listed operation, stage, reason,
retryability, outcome and correlation fields. Reproduce the exact action once
and follow its last completed stage. Keep query strings, place labels, media,
GPS, owner IDs, raw errors and capture dates out of logs and artifacts. Fault
injection uses synthetic sentinel data. Report device or backend limitations
explicitly.

## First build verification

- CAP-5 real SQLite regression covers same-year chronology and matching
  name/month card periods. Device layout and mixed manual/inferred ordering
  remain unverified.
- CAP-7 regression covers pending initial readback and an SQLite generation
  change after the published run is selected. The staged stale error leaves
  the prior lookup intact. The original device incident's cause remains
  unknown. Native browsing during rebuild, gallery paging, and Replay
  generation acceptance remain open.
- The comparison covers the current baseline and candidate on synthetic
  inputs. Evaluate false joins, false splits and missed trips on a reviewed
  holdout after the next continuity policy is frozen. Product quality is
  unmeasured.
- Foundation check passed 199 tests and evaluation smoke. Mobile typecheck,
  124 real SQLite cases and 109 focused Jest tests passed.
- The installed Android SDK reported no attached devices on the host. Native
  acceptance was unavailable for this build.

## CAP-3 and CAP-6 implementation boundaries

The searchable Home picker uses a versioned offline GeoNames index. Build
validation owns missing or malformed public source data. The native picker
reports one fixed `ONBOARDING_SETUP / HOME_SEARCH_INDEX / SCHEMA` event if the
runtime asset is incompatible. Empty or ambiguous matches are expected.
The existing Home command and readback contracts still own scope and durable
save failures. Saved point-and-radius areas retain their existing storage
shape and account eligibility.

Settings uses `photo-access/provider.tsx/saveDirectHome`. `HOME_SCOPE`
classifies disconnected, changed and missing Home authority. The exact commit
and readback stages distinguish a known save from an unverified outcome.
An exact matching saved area is reused after a readback failure, with the same
selected point, ID, radius and dates. Atlas publication reuses
`ATLAS_DURABLE_READ` with the same action correlation and owner-safe recovery.
Native collection uses the current app PID and the closed fields at
`ONBOARDING_SETUP` and `ATLAS_DURABLE_READ`. Retain only those events and
discard all query, place and photo data.

Vietnam names use a separate compact layer derived from OCHA ROAP and
Government of Viet Nam district geometry. The existing destination-query
and destination-computation stages own read and computation failures.
Boundary ambiguity and uncovered places use country fallback.

Host verification covers accent-insensitive Sa Đéc search with province
context, namesakes, province, district, ward, commune and worldwide city
results, search-first onboarding and Settings without pins or coordinates,
exact legacy dates and radius, staged Settings readback retry without a
duplicate write, index fault/skip and diagnostic redaction, corroborated
public Sa Đéc and Cần Thơ controls, a polygon edge and unaffected country
controls. The compact country layer is only for the independently reviewed
Vietnamese footprints. Native usability and geographic accuracy outside
these reviewed controls remain unmeasured.

Domestic coverage remains an open AC-18 gap. A host comparison using the
public Huế city and historical province points returned Thừa Thiên Huế in
the prior committed resolver and country-only in the current resolver. The
known Sa Đéc mislabel still warrants a verified replacement for the withheld
Vietnam Admin-1 geometry. Require independent positive controls outside the
two reviewed footprints, including Huế, alongside boundary abstention.

## CAP-4 and CAP-6 follow-up delivery

### Offline landmark index follow-up after the Android v5 miss

The host SALAD extractor is a public-fixture tool. Its terminal error is
one fixed category for manifest admission, upstream/model integrity, model
load, JPEG digest/decode, descriptor inference or output write. Match
`SALAD_INPUT_INVALID`, `SALAD_MODEL_INTEGRITY`, `SALAD_MODEL_LOAD`,
`SALAD_IMAGE_INTEGRITY`, `SALAD_INFERENCE` and `SALAD_OUTPUT` to
`evals/landmarks/extract-salad.py`. Inspect the closed
`LANDMARK_SALAD_EXTRACT` terminal event on stderr and aggregate timing on
stdout. Failed integrity checks with synthetic path sentinels emitted the
correct stage and unchanged outcome without echoing the sentinels or
replacing the existing descriptors. The positive reruns had identical
descriptor SHA-256 values. Image paths, metadata and dependency exceptions
are excluded from the event.

The owner declined Google Cloud Vision due to billing setup and payment
holds. The [offline landmark index](offline-landmark-index.md) is the active
implementation contract. Its first deliverable is the public source audit,
index fixture and comparative benchmark. The hosted investigation below is
historical.

Before runtime changes, map public source and pack boundaries to the same
delivery record. Use a closed build report for fetch, parse, place mapping,
reference admission, descriptor generation and artifact verification. For
mobile, map manifest read, download, integrity/compatibility verification,
atomic activation and resume to closed stages and outcomes. Correlate these
with discovery authority and readback, preserving an eligible previous
artifact. A missing eligible pack is an expected availability outcome.
Fault invalid metadata, interruptions, tampering and authority withdrawal
with synthetic inputs. Assert no private values in diagnostics or network
requests. Use the existing device PID and closed-event collection recipe.

#### Public build and benchmark source map

The offline CLI consumes a reviewed snapshot and pinned public JPEGs. It has
no network transport. Source acquisition stays in the documented public
metadata workflow before this entry point. Use one locally generated
`LANDMARK_PUBLIC_EVAL` correlation per invocation. Status events use the
same six fields as the app diagnostic contract. The aggregate benchmark
report is a separate file.

| Stage | Source and guard | Reasons and durable outcomes |
| --- | --- | --- |
| `SOURCE_READ` | `benchmark-offline-landmarks.cjs/runBenchmark`, then `offline-landmark-input.cjs/readSnapshot` and `readPinned`, validate arguments and verify bounded public inputs and SHA-256 values. | `INPUT_SCHEMA` unchanged for invalid arguments, `INPUT_UNAVAILABLE` retryable unchanged for missing input, `INPUT_INTEGRITY` unchanged for changed bytes, `INPUT_LIMIT` unchanged for oversize inputs. Reacquire the pinned public snapshot. |
| `SOURCE_PARSE` | `offline-landmark-input.cjs/parseManifest` validates schema, roles and frozen gate ranges. | `INPUT_SCHEMA` unchanged. Correct the public snapshot schema before retrying. |
| `PLACE_MAPPING` | `offline-landmark-input.cjs/auditSnapshot` checks explicit place joins and stable geographic identity. | `PLACE_MAPPING` unchanged for inconsistent or ambiguous joins. Verify the Wikidata and source identities. |
| `REFERENCE_ADMISSION` | `offline-landmark-input.cjs/auditSnapshot` checks the public source, approval, rights, original identity and independence across splits. | `COVERAGE_INCOMPLETE` skipped when reviewed controls are missing or inadequate. `INPUT_INTEGRITY` unchanged for same content assigned conflicting labels or partitions. Resolve public rows and coverage before scoring. |
| `IMAGE_DECODE`, `MODEL_LOAD`, `DESCRIPTOR_GENERATE` | `offline-landmark-model.cjs` decodes bounded JPEGs, runs the pinned DINOv2 model and validates the pinned SALAD descriptor set. | `IMAGE_DECODE` unchanged for invalid JPEG, `MODEL_UNAVAILABLE` retryable unchanged for missing model or dependency and skipped when optional SALAD input is omitted, `MODEL_INFERENCE` retryable unchanged for native inference failure, `MODEL_CLEANUP` retryable unchanged for standalone release failure, `DESCRIPTOR_SCHEMA` unchanged for malformed output. Pinned input reads retain their exact input failure category. |
| `BENCHMARK_SCORE` | `offline-landmark-benchmark.cjs` validates episode rows, scores identical frozen rows, routes from corroborated evidence, and replays the fixed and progressive schedules. | `INPUT_SCHEMA` unchanged for malformed episodes, `GATE_NOT_MET` skipped for a scored quality gate miss, `COVERAGE_INCOMPLETE` skipped for insufficient controls. Unclassified failures use `UNKNOWN` at the exact stage. |
| `ARTIFACT_VERIFY`, `ARTIFACT_WRITE` | `offline-landmark-benchmark.cjs/verifyArtifacts` verifies canonical pack digests and size. `publishArtifacts` writes complete output in a sibling staging directory and renames it into a new destination. | `ARTIFACT_INTEGRITY` unchanged for size/digest mismatch, `ARTIFACT_WRITE` retryable unchanged before publication, `ARTIFACT_CLEANUP` retryable unchanged when staging remains unpublished, `OUTPUT_EXISTS` unchanged to preserve existing output. Inspect only the closed status and use a fresh ignored destination. |

Any observed cancellation stops before publication and emits `CANCELLED`
with skipped durability at the current stage. An unclassified exception
retains that stage and emits `UNKNOWN` once.

Run the Node CLI from the primary checkout using public inputs from an
ignored directory. Keep its stdout as JSON lines and filter operation
`LANDMARK_PUBLIC_EVAL`. Join events by the generated correlation ID and
inspect the last started stage if no terminal event arrives. Verify the
checked-out script and manifest/model digests before attributing a failure
to a current run. Retain only closed events and reviewed aggregate results.
No photo names, paths, URLs, descriptor values, or raw exceptions go into
status output. Public provenance is kept in the approved input manifest and
pack attribution records. Inject changed bytes, split leakage, invalid
image/model output and interrupted publication in host tests before using
the tool for a scored snapshot.

The focused Node suite passed 25 tests. It forced input read, digest, schema,
place mapping, split leakage, image decode, model load/inference/release,
descriptor validation, artifact integrity and interrupted publication faults.
It verified exact closed fields, one action correlation, one classified
failure, cancellation, sentinel redaction and preservation of existing
artifacts. The public rerun preserved the original per-image results and
reported `COVERAGE_INCOMPLETE`. Review corrections require wrong-route
controls, per-image stop credit, independent sessions and authors, and
correct-stop improvement with routed packs. The unknown-episode failure control and paired
pipeline have synthetic coverage. The frozen v1 public fixture lacks a
wholly unindexed episode and has no rights-cleared Namsan views.

#### Public pilot review disposition

| Finding | Correction or evidence |
| --- | --- |
| Positive queries could satisfy negative-control coverage. | Only null-place queries can carry and count a negative control. |
| Episode scoring could credit a match on a wrong image and routing could pass on country alone. | Credit correct matches per image. Count false accepts and require stop gain on routed packs, with a wholly out-of-index episode to expose false routes. |
| A tuple could treat repeated clues from the same session or author as independent. | Routing requires a second clue from a different session and photographer in the frozen public fixture. |
| Pack bytes excluded the installed starter and scoring used different float precision. | Measure the starter plus the largest regional pack and preserve scored float values in the serialized artifacts. |
| The extractor could admit rows the runner would exclude and reuse stale descriptors. | Reuse the same admission code and bind the descriptor file to the pinned input manifest and model. |
| Sampler tests proved equal effort without exercising rescheduling, and the paired runner lacked a success assertion. | Assert the order in which an unresolved session receives another attempt and publish both matchers on shared synthetic inputs. |

The independent review passes were interrupted after sending findings.
The host rerun covered the implemented corrections. The
[frozen public pilot](../../../evals/landmarks/README.md) remains incomplete
for rollout. Its measured host artifacts do not close AC-31, AC-32 or the
owner-device and quality portions of AC-33. The next public fixture needs
independent Namsan views and an unindexed episode. Keep calibration separate
from an untouched holdout.

#### Landmark verification pilot

Reuse the offline build and diagnostics before any device rollout. Freeze
public positive references, labeled counterexamples and independent scored
photos in a new manifest. Evaluate the current DINOv2 candidate rule and the
same rule with a competing-reference margin. A counterexample can suppress
an image-level hypothesis. It cannot propose a place or enter an album.
Keep capture membership separate from aggregate stop coverage.

| Stage | Source | Reasons and outcomes |
| --- | --- | --- |
| `SOURCE_PARSE` | `offline-landmark-input.cjs/parseManifest` validates verifier configuration and counterexample rows. | `INPUT_SCHEMA`, unchanged. Inspect the frozen manifest schema. |
| `REFERENCE_ADMISSION` | `offline-landmark-input.cjs/auditSnapshot` checks approved, distinct positive references, counterexamples and query splits. | `INPUT_INTEGRITY`, unchanged for leakage, missing verifier inputs or conflicting claims. Verify public image digests and original capture groups. |
| `DESCRIPTOR_GENERATE` | Existing pinned image decoding and DINOv2 inference also cover counterexample views. | Existing fixed classification, unchanged on failure. |
| `BENCHMARK_SCORE` | `offline-landmark-model.cjs/dinoVerifiedMatcher` compares per-photo evidence and abstains at a fixed margin. `offline-landmark-benchmark.cjs/assessGate` evaluates the designated candidate. | Normal abstention in aggregate results. `GATE_NOT_MET` or `COVERAGE_INCOMPLETE` remains skipped for rollout. |

Collect the same `LANDMARK_PUBLIC_EVAL` event stream and public aggregate
report. Test split leakage, competing negatives and unchanged unguarded
predictions. No owner inputs enter the host comparison.

#### Landmark detail pilot

Evaluate local DINOv2 patch layout using the pinned host model. Freeze
reference-only regions and hard negatives before scoring. Search each
whole query without supplying a crop, date or place hint. Run the known
winter Damyang case as a separate regression. Keep the pilot host-only
until it qualifies on independent reference sources and public controls.

| Stage | Source | Reasons and outcomes |
| --- | --- | --- |
| `SOURCE_READ`, `SOURCE_PARSE` | `benchmark-landmark-details.cjs/runDetailBenchmark` uses `readPinned` and `readPublicImages`. `parseDetailFixture` checks the pinned public manifest's thresholds, separate regression set, and reference-only grid regions. | `INPUT_UNAVAILABLE` retryable unchanged, `INPUT_LIMIT`, `INPUT_INTEGRITY` or `INPUT_SCHEMA` unchanged. Check public digests and schema. |
| `PLACE_MAPPING`, `REFERENCE_ADMISSION` | `mapPlaces`, `auditSnapshot` and `prepareDetailInputs` check public identity, licenses, capture splits, and coverage of admitted references by region annotations. | `PLACE_MAPPING` or `INPUT_INTEGRITY` unchanged. Check source attribution and compare approved image and region roles. |
| `IMAGE_DECODE`, `MODEL_LOAD`, `DESCRIPTOR_GENERATE` | Existing `decodeImages`, `loadDino` and `extractDino` use the pinned full-view tensors. The host's `normalizeDinoPatches` validates finite, nonzero patch vectors. | Existing decode, model, cleanup and input outcomes. `DESCRIPTOR_SCHEMA` unchanged for invalid patch tokens. Reproduce with pinned public JPEGs and model or a synthetic tensor. |
| `BENCHMARK_SCORE` | `offline-landmark-details.cjs/compareDetailMatchers` scores the full query with spatially aligned reference regions across scales, compares both scene baselines and evaluates the target-only host gate. | Abstention is a normal scored outcome. `GATE_NOT_MET` or `COVERAGE_INCOMPLETE` skipped for the host gate. Verify source diversity, sample roles, and aggregate counts. |
| `ARTIFACT_WRITE` | `publishArtifacts` writes and verifies an aggregate report in a sibling staging directory before publishing to a fresh destination. | `ARTIFACT_INTEGRITY`, `OUTPUT_EXISTS` unchanged, or retryable unchanged `ARTIFACT_WRITE` and `ARTIFACT_CLEANUP`. Inspect the requested output and use a fresh ignored directory. |

Run Node from the primary checkout with the frozen manifest and public
image directory. Verify the manifest and pinned model digest. Capture
stdout, filter `LANDMARK_PUBLIC_EVAL`, and join on the invocation's local
correlation ID. Retain only the closed events and reviewed aggregate
`report.json` from a fresh directory under `evals/runs/`. A cancellation
uses the active stage and `CANCELLED` with skipped durability, and an
unclassified failure uses that stage and `UNKNOWN` once. Inspect the last
start if the host process ends without a terminal outcome. No native
collection, pack publication or owner input is part of this pilot.

Partial independent review identified missing positive tensor and
decision-boundary checks. The focused suite now verifies normalized
full-view patches without the class token, no patch payload in the crop,
near-tie abstention, a separately failing known regression, insufficient
coverage, a host resource failure and the CLI's invalid-argument exit.
Independent final reviews did not complete. The frozen public score
was repeated independently of the synthetic checks.

#### Multi-stop public host experiment

The [public experiment record](../../../evals/landmarks/README.md#seoul-multi-stop-host-experiment)
covers a one- and two-day replay of the production sampler, observation
merge, trip qualification and album association with local host OCR
and the detail matcher. The test starts from synthetic capture times
on public photos and deep references. The calibrated tile/phrase rule
and one-photo follow-up produce one Seoul proposal with three stops
and six exact album members. Full-image OCR and the same-bucket sample
loss each independently reproduce a missing Nami stop.

The ignored probe reuses the `LANDMARK_PUBLIC_EVAL` correlation. Its
`SOURCE_READ`, `REFERENCE_ADMISSION`, `IMAGE_DECODE`, `MODEL_LOAD`
and `DESCRIPTOR_GENERATE` events retain the existing source map.
`BENCHMARK_SCORE` covers host OCR replay, sampler, recognition and exact
membership comparison. The missed stop is recorded as a scored outcome.
`ARTIFACT_WRITE` writes only public fixture results. Collect the ignored
`episode-probe.stderr.log` and `episode-report.json`; join the closed
benchmark events by local correlation. The public probe additionally
captures the existing closed `VISUAL_PLACE_REVIEW` events on stdout.
The pilot used no owner media and made no runtime diagnostic changes.

The independent synthetic SQLite confirmation case passed. The exact
six-photo result was scored before persistence. Leave AC-13, AC-31
and AC-33 open for owner-library acceptance, automatic region routing,
untouched comparison and Android scan resource checks. The two ferry
captures share a banner, so expand holdout coverage across signage and
viewpoints before using the calibrated tolerance in the app.

The [independent Nami evaluation](../../../evals/landmarks/README.md#nami-independent-host-evaluation)
returned `LANDMARK_PUBLIC_EVAL / BENCHMARK_SCORE / GATE_NOT_MET`
under the same closed host diagnostic map. The frozen candidate missed
four distinct-site views and produced a false Nami stop and album
contamination on two synthetic prints. The crowded episode also
missed a target before recognition. Inspect per-image labels, unscanned
targets, complete stop lists and exact album membership in the ignored
`nami-holdout-report.json`. The exposed-set corroboration experiment
blocked the false album and lost the known ferry stop. This is host
evaluation only. AC-13, AC-31 and AC-33 remain open.

#### Nami visual corroboration host slice

Compare scoped landmark details with whole-scene similarity under the
same pinned model. A text clue can nominate a candidate. It cannot
qualify a Nami observation on its own. Use the previous holdout as
regression evidence. Preserve reference/query source identity and use
new captures and known photo reproductions to measure the revised rule.
Check both accepted stops and exact album IDs with the production
sampler and assembler. A reproduced view, generic lookalike or printed
place name must not become a stop or album member. Report separate
counts for fresh views, known regressions and simulated reproductions.

Reuse `LANDMARK_PUBLIC_EVAL` with one local correlation. `SOURCE_READ`
checks pinned manifests, image inputs and model bytes. `REFERENCE_ADMISSION`
uses `INPUT_INTEGRITY` for source overlap or missing references.
`IMAGE_DECODE` and `DESCRIPTOR_GENERATE` retain the existing model and
image categories. `BENCHMARK_SCORE` covers detail, competing views,
reproduction checks and album equality. Quality failure is scored as
`GATE_NOT_MET`. Missing independent coverage uses `COVERAGE_INCOMPLETE`.
`ARTIFACT_WRITE` publishes a local public-fixture report. Collect closed
events and aggregate results under the ignored evaluation directory.
The slice does not exercise native capture context, Android latency or
automatic region routing.

| Stage | Source boundary and fixed classification | Outcome and next check |
| --- | --- | --- |
| `SOURCE_READ`, `SOURCE_PARSE` | The host Nami benchmark reads pinned public inputs with `offline-landmark-input.cjs/readPinned` and parses its versioned configuration. Read failures retain `INPUT_UNAVAILABLE`, `INPUT_LIMIT` or `INPUT_INTEGRITY`. Invalid schema uses `INPUT_SCHEMA`. | Unchanged. Retry an unavailable input after restoring the pinned artifact. Check the manifest hash, revision and schema when bytes or structure differ. |
| `REFERENCE_ADMISSION` | The host benchmark checks public rights, distinct source identity across splits, and explicit provenance for simulated reproductions. Missing approved templates or leaked original identity use `INPUT_INTEGRITY`. Insufficient independent coverage is recorded as `COVERAGE_INCOMPLETE`. | Integrity faults leave the destination unchanged. Incomplete coverage is skipped for quality-gate credit. Inspect the reviewed reference, query and reproduction provenance. |
| `MODEL_LOAD`, `IMAGE_DECODE`, `DESCRIPTOR_GENERATE` | `offline-landmark-model.cjs/loadDino`, `decodeImages` and `extractDino` reuse the pinned DINOv2 model and JPEG, inference, output-shape and native-release guards. | Unchanged. Use the existing public benchmark categories and retry only after restoring a missing dependency or investigating a retryable native failure. |
| `BENCHMARK_SCORE` | `offline-nami-corroboration.cjs/createNamiCorroborator` checks bounded template regions, score thresholds, split IDs and returned patch vectors. Invalid thresholds or regions use `INPUT_SCHEMA`, overlapping or missing templates use `INPUT_INTEGRITY`, malformed or missing vectors use `DESCRIPTOR_SCHEMA`. Reproduced-source similarity, a competing-detail tie and insufficient independent visual support are scored abstentions. The benchmark compares ordered stops and exact album IDs after the production sampler and assembler. | Schema, integrity and descriptor faults leave the destination unchanged. The scored report separates abstentions from missing coverage and uses `GATE_NOT_MET` for a quality-gate miss. Check the relevant public fixture or score cohort. |
| `ARTIFACT_WRITE` | `offline-landmark-benchmark.cjs/publishArtifacts` writes a report-only artifact through staging and rename. Its existing write, cleanup and output-exists reasons apply. | Unchanged on failure. Verify the prior destination and use a fresh ignored output directory. |

The shared stage wrapper emits one local `LANDMARK_PUBLIC_EVAL` action
correlation, exact-stage `UNKNOWN` for an unclassified exception, and
`CANCELLED` with skipped outcome for observed cancellation. Matchers return
per-query decisions only to the public report. They emit no diagnostics
per photo and never treat text as an accepted Nami observation.

The matcher and existing offline landmark suites passed 56 host tests.
The new cases exercise a displaced independent detail, printed names,
a competing detail tie and a downscaled known-source reproduction. Faults
exercise malformed policy and regions, missing and overlapping templates,
descriptor shape and numeric values, cancellation and exact-stage unknowns.
Assertions verify the six closed fields, one local correlation across
admission and scoring, one terminal failure, truthful outcomes and sentinel
redaction. The foundation check passed 255 tests and the evaluation smoke
before benchmark integration. Four focused mobile Jest suites covering
discovery sampling, recognition orchestration, embeddings and trip assembly
passed 15 tests.

The [host fixture result](../../../evals/landmarks/README.md#nami-visual-detail-and-copied-images)
returned `BENCHMARK_SCORE / GATE_NOT_MET`. The frozen rule withheld all
controls and missed the fresh test view. The 0.50 exploratory rule
recovered the ferry and zipline episode and admitted the borderless
copy when mixed with a genuine landmark. Machine checks score ordered
stop IDs and exact album IDs. Independent coverage remains incomplete.
The local geometry check recognizes two indexed copies and misses the
copy with an unindexed original. The benchmark map covers
`evals/landmarks/measure-nami-image-copies.py` and
`evals/landmarks/benchmark-nami-visual.cjs` with pinned inputs.
Collect `LANDMARK_PUBLIC_EVAL` stderr events and the atomic report
from the given output directory. AC-13, AC-31 and AC-33 remain open.

Independent review identified mutable policy inputs, a sparse list
that could bypass the copy check, and missing threshold and album
regressions. The matcher now owns snapshots of validated inputs.
Tests assert fractional margins, later copy sources, typed failures
and exact scene exclusion. The repository runner and reproduction
scripts replay the public cases, with provenance and pinned inputs.
Foundation passed 264 tests under workspace-local temp. The
scoped mobile checks and exact SQLite confirmation fixture passed.
Quality remains deliberately separate from software verification.

#### Capture evidence host comparison

Compare visual-only promotion with a separate evidence decision in
the public Nami benchmark. Keep model matches as private place clues.
Use separately supplied capture coordinates from the fixture to
measure an eligibility policy. Give each coordinate an evidence ID,
capture family, observed time, accuracy and coordinate pair. Use
coordinates only for original capture-like assets and verify their
distance to the proposed place and attach the qualifying evidence
to its own asset. A nearby coordinate or asset timestamp cannot by
itself attach a visually matched GPS-less photo. Known reproductions
stay excluded even with a matching coordinate. Leave other visual
stops as the existing comparison anchors.

Replay the previously successful pair, the full-bleed copy pair,
each with and without fixture coordinates, and an unmatched visual
photo next to independently located photos. Measure all private
clues, qualified stops and exact ordered album IDs separately.
Conflicting or missing capture evidence must leave the clue pending.
Ensure that a known copy cannot enter through scene association.
Compare genuine and copied inputs that expose the same GPS-less
signals and report the unresolved trade-off. Fixture coordinates
exercise the policy and do not measure native source trust.

Under `LANDMARK_PUBLIC_EVAL / BENCHMARK_SCORE`,
`evals/landmarks/offline-capture-evidence.cjs/assessCaptureEvidence` checks
configuration, sampled assets, matcher rows and independent capture records.
`INPUT_SCHEMA` is nonretryable and unchanged for malformed records, invalid
coordinates or invalid accuracy and distance limits. Inspect the pinned public
fixture's types and ranges before rerunning.
`INPUT_INTEGRITY` is nonretryable and unchanged for duplicate evidence or
asset IDs, missing matcher rows, and mismatched asset, family or time bindings.
Check those relationships against the sampled episode before rerunning.
An unexpected exception uses `UNKNOWN` with that same stage and unchanged
outcome. `CANCELLED` skips publication between host stages. These outcomes
use the existing benchmark action correlation. Invalid inputs leave the
report destination unchanged. Missing or conflicting coordinates, insufficient
accuracy and identifiable copies are measured abstentions within a completed
score. Require distance plus reported uncertainty to fit the frozen radius.
The target's located observations omit scene embeddings to prevent neighboring
GPS-less photos from inheriting capture eligibility. Reuse the pinned
benchmark's `SOURCE_READ`, model stages and atomic `ARTIFACT_WRITE`.

For collection, run the current repository checkout's Node entry point
`evals/landmarks/benchmark-nami-visual.cjs` with the pinned public inputs and
a fresh ignored output directory. Check that the report records the current
policy and input versions. Retain stderr JSON lines whose `operation` equals
`LANDMARK_PUBLIC_EVAL`. Match `BENCHMARK_SCORE` START and terminal events by
`correlationId`. Collect only closed event fields and public-fixture results.
No coordinate reader, mobile dependency, persistence or release is
part of this comparison. Keep AC-13, AC-14, AC-26 and AC-33 open
for native capture evidence and the real Local library.

The focused `node --test tests/offline-capture-evidence.test.mjs` suite
initially confirmed that the policy module was absent. All six tests then
passed with the policy in place. Node measured 100% line, branch and function
coverage for the policy module. Fault tests exercised malformed coordinates,
invalid limits, duplicate or unbound records, unknown failure and cancellation.
They confirmed one action correlation through source read and scoring, one
terminal score event, no capture IDs or sentinel content in diagnostics, and no
attempt to publish after a fault. The remaining controls cover independent
location, accepted anchors, GPS-less clues, known copies and conflicting location.

The end-to-end host result retained the expected private clues in all
ten cases and assigned the expected promotion eligibility in nine.
Visual-only matched five exact ordered stop and album results.
Capture evidence matched six. It excluded copies whose
original was known or whose own location was absent or conflicting.
It could not recover three genuine missing or coarse coordinate cases.
The uncaught copy with an eligible location remained a false album
member. These are policy outcomes with simulated GPS and origin
claims. Treat the overall quality result as `GATE_NOT_MET`.
[Runs and controls](../../../evals/landmarks/README.md#nami-capture-evidence-comparison).

Review strengthened the comparison to score per-photo promotion,
support assignment and provenance. Both policies use the same
sample, combining located rows after the GPS-less sampler. Tests
cover repeated families, conflicting visual candidates, unlocated
scene neighbors and a capture-only gate failure. The final foundation
check passed 273 tests and the evaluation smoke. The four focused
mobile suites passed 22 tests and the synthetic SQLite check passed
exact-album confirmation. The simulated provenance is still
unverified on mobile.

#### GPS-less multi-view host comparison

Use a pinned set of public JPEG pairs and synthetic geometric controls.
One visual match identifies a candidate place. To test corroboration, compare
mutually matched features across an image pair. A dominant planar transform
can flag a known-source copy. Require broad epipolar agreement with a
second, spatially supported displacement that the planar transform cannot
explain before calling the pair consistent with distinct viewpoints.
Weak, disjoint, planar or conflicting pairs leave the place as a clue.
Keep a reproduction and a withheld match out of album scene association.

Compare the same GPS-less genuine and mixed-copy cases through the existing
sampler, trip qualifier and album assembler. Score exact ordered stops and
album IDs. Validate the geometry rule on deterministic nonplanar, planar and
unrelated controls. A result based on an online reference comparison or a
synthetic control does not establish independently captured owner media.

The host geometry extractor uses `LANDMARK_PUBLIC_EVAL`, with
`SOURCE_READ` for pinned JPEG bytes, `IMAGE_DECODE` for image validity,
`DESCRIPTOR_GENERATE` for local SIFT extraction, `BENCHMARK_SCORE` for
geometric scoring, and `ARTIFACT_WRITE` for an atomic measurements file.
These boundaries emit fixed failure reasons and one correlation. The
Node benchmark reads the measurements under `SOURCE_READ`, verifies the
fixture and pair data under `BENCHMARK_SCORE`, and publishes the comparison
through the existing atomic report helper. A quality miss emits
`GATE_NOT_MET`. Keep AC-13, AC-14 and AC-33 open pending independent
coverage and Android acceptance. No mobile source or library is changed.

The geometry measurement script publishes to a fresh sibling path. Its
verified failures include a missing pinned input
(`SOURCE_READ / INPUT_UNAVAILABLE`) and a pre-existing output
(`ARTIFACT_WRITE / OUTPUT_EXISTS`). Keep the six closed fields on
stderr, grouped by local correlation, and preserve the aggregate
report only for public fixtures. The Node scorer rejects invalid
geometry counts with `BENCHMARK_SCORE / INPUT_SCHEMA` and mismatched
pair identity with `INPUT_INTEGRITY`. The public run ended with
`BENCHMARK_SCORE / GATE_NOT_MET`.

All three copied-image pairs with their originals returned planar
agreement. None of the three same-subject public positive pairs
supplied enough independent-view evidence. The mixed-copy episode
was rejected, and the genuine GPS-less trip lost its Nami stop and
two photos. Synthetic nonplanar evidence showed that the integration
can add the expected stop and album members when the pair qualifies.
The Windows extractor repeated identical measurement bytes. Foundation
passed 277 tests and the evaluation smoke. This reproduces the quality
miss with the existing sampler and album assembly.
[Multi-view runs](../../../evals/landmarks/README.md#nami-multi-view-geometry-comparison).

#### Seoul proposal and independent photo membership host comparison

Use the prior public Nami pair cases. Qualify Seoul using the same
Ewha and Namsan observations. Keep unqualified Nami matches in a
pending clue list outside stops, cover candidates and album. Reuse
the existing album scene association for an unnamed photo with
independent matching captures before and after it. Withhold known
reproductions before the assembler. An unqualified place clue may
enter the album only if it has independently qualifying evidence.
This host comparison exercises the existing unnamed-scene branch
and does not broaden it to unresolved named clues.

Score destination, ordered stop support and cover and album
identities separately. Replay the genuine Nami pair, the pair
with an unindexed copy, and known reproductions. Use a controlled
synthetic scene sequence with an unnamed image, a known copy,
an unrelated image, and a screenshot. Keep the evidence basis
as `scene` and leave the input capture location absent. Include
a near-time case with no independent scene evidence.

The existing `LANDMARK_PUBLIC_EVAL` action uses `SOURCE_READ`
for pinned pair measurements and `BENCHMARK_SCORE` for the
proposal and exact result comparisons. Score-stage
`INPUT_INTEGRITY` covers missing observations or mismatched
pairs, and malformed measurements use `INPUT_SCHEMA`. Reuse
the existing atomic report and safe collection recipe. This is
host proposal evidence. AC-13, AC-14 and AC-26 stay open for
owner-library and on-device acceptance.

All five public cases matched exact partial destination, supports,
cover, album and place-clue expectations. The synthetic scene check
admitted an unnamed GPS-less asset with the scene basis and excluded
same-time adversarial assets. The public Ewha panorama did not meet
the scene threshold, even when explicitly supplied to the follow-up
seam. Foundation passed 281 tests. The synthetic SQLite check passed
exact-album confirmation. The broader benchmark returned
`BENCHMARK_SCORE / GATE_NOT_MET` for the unresolved trip quality
miss. [Public and synthetic evidence](../../../evals/landmarks/README.md#partial-seoul-proposal-and-photo-membership).

#### City-level Possible trips

Qualify a proposed city and observed range with positive evidence across
independent capture sessions even when the episode has one verified named
stop. Reuse the visual place catalog, observation validation, same-city
transition bounds, and existing photo membership criteria. Represent coarse
city support with its catalog locality ID in the existing support structure.
It must never appear as a second named stop in proposal or confirmed trip
detail. The card title is the city. Keep existing multi-stop behavior and
continue to use the already authorized visual-discovery flow and flags.

Conservative implementation defaults for AC-34: use distinct source families
and two independently supported sessions with at least two eligible captures
each. A named stop must qualify in its own session. The other session can
contribute verified same-city evidence at locality precision or the same
verified named stop. Preserve the existing gap bounds and chronology. Define
capture-session independence from the chronology of capture-like episode
representatives, including unresolved previews, while recognizing only
resolved selected photos. A conflict with a different accepted locality,
isolated name detection, or unlabeled nearby photos cannot supply this fallback.
Use the existing exact municipal OCR patterns for Seoul and add a bounded,
exact civic identification pattern for Hà Nội. Do not promote a bare city
word, a regional pack guess, a poster, or an ambiguous OCR/image match.
Use canonical city IDs to compare and reconcile compatible photo clues.

Preserve proposal/storage shape and all Home, overlap, privacy, authorization
and exact confirmation guards. Revalidate supported location groups and their
times at staging/readback for city-backed proposals. Use a base scan scope marker
to reevaluate old discovery checkpoints. Do not change old receipt IDs or
reopen unchanged dismissed episodes. Filter locality IDs from named-stop
presentation in both review and saved Atlas detail. Persist confirmed history
through reopen, with each photo's capture location still unknown.

| Operation / stage | Source and action | Failure and verification |
| --- | --- | --- |
| `VISUAL_PLACE_REVIEW / RESULT_VALIDATE` | `place-catalog.ts` and `recovery.ts` classify city-place recognition and resolve compatible observations | Existing `MEDIA_SCHEMA`, ambiguity and abstention outcomes. Verify civic-only, bare-name, document and competing-label cases. |
| `VISUAL_PLACE_REVIEW / TRIP_QUALIFY` | `trip-recovery.ts` validates exact observation membership and qualifies independent, positively linked sessions | `MEDIA_SCHEMA` leaves state unchanged. `VISUAL_EPISODE_SUPPORT` skips insufficient, conflicting, same-session or duplicate evidence. |
| `VISUAL_PLACE_REVIEW / ALBUM_ASSOCIATE` | `trip-recovery.ts` associates only qualified place or scene evidence | `VISUAL_ALBUM_SUPPORT` skips insufficient exact album support. Verify exclusions and unknown capture location. |
| `VISUAL_PLACE_REVIEW / PROPOSAL_STAGE`, `PROPOSAL_READBACK`, `REVIEW_COMMIT`, `REVIEW_READBACK` | `reconstruction/repository.ts` and provider validate city support, the same source generation, and the exact album | Existing `MEDIA_SCHEMA`, `HISTORY_STALE`, `HISTORY_CONSENT` and `ACCESS`. Verify malformed city support, stale decisions, new scope and old receipts, exact album readback and closed diagnostics. |

Use the existing closed `visualDiagnostic` and `visualLifecycle` in the
provider and recognizer with the discover action's local correlation. A review
uses its own correlation. A malformed payload or recognized observation reports
`MEDIA_SCHEMA` at its validation boundary. Insufficient support reports a
non-retryable skip. Access and consent failures prevent publication. A stage
or review failure after writer acknowledgement retains the existing unknown
durable outcome until exact readback verifies the result. Locate the rejecting
guard with the operation/stage and retry only through the normal action once
the source is again current and authorized.

Run engine, catalog, provider, and SQLite tests with synthetic Seoul and Hà Nội
observations plus an unrelated camera image and duplicate or screen controls.
Rerun the frozen public regional holdout as a negative regression. Keep model
recall, Android library acceptance and pack qualification separate.

For Android collection, verify that the currently served development bundle
contains `visual-city-support-v1` and reload that bundle in Travel Life's
development client. Get the active PID with `adb shell pidof com.anonymous.travellife`.
Before reproducing, watch `adb logcat --pid <pid> -v raw ReactNativeJS:I '*:S'`
locally. Retain only `[Travel Life diagnostic]` records for `VISUAL_PLACE_REVIEW`
and the six closed fields in the policy. Read the stages for the same discover
correlation and the separate confirm correlation. An absent terminal event
leaves its outcome unresolved. Retain aggregate results only. Keep names,
asset IDs, OCR, dates, paths, coordinates and raw logs on the owner device or
local console. Record an unavailable device or stale bundle as a collection
boundary. On iOS apply the same event filter to the current Travel Life process
in Xcode's device console.

The focused Jest run passed 129 cases across the provider, catalog and trip
qualification suites. Seoul and Hà Nội reached exact checkpoint readback with
one named stop displayed and four expected album members. Cases also covered
unavailable previews bridging timing, unrelated images, duplicate and screen
exclusions, malformed recognition, and stale readback. The stale action emitted
one closed `PROPOSAL_READBACK / HISTORY_STALE` skip with no photo, date or OCR
sentinels, and all events in each discovery shared its local correlation.
Mobile TypeScript passed.

The frozen crop/detail comparison retained both previously exact positive
albums. Its Hanoi holdout still had no eligible album because the recognized
views belonged to one capture session. The expected `GATE_NOT_MET` outcome
emitted no release manifest. This is a control for the city qualification
policy. Its result leaves recognition recall and the production pack gate open.

After review, SQLite exercised immediate readback of the exact stored city
proposal, a forged destination, revoked access, a reopened confirmed album,
and an unchanged Hanoi dismissal after a pre-city checkpoint. Qualification
now selects compatible capture groups before preferring named evidence, and
the catalog abstains on bounded Hanoi administrative-document cues. Final
verification passed 1,314 mobile Jest cases, 141 SQLite cases, TypeScript,
Expo lint and 281 foundation cases. Metro produced the Android development
bundle with the ordinary city path and regional retrieval disabled. ADB
reported no connected device for acceptance of the owner's library.

The later owner-connected USB session verified the current city policy via
the localhost Metro route and the current Android JS process. Three actions
reached native landmark matching, returned no place and committed progress.
Android pause and resume events coincided with canceled and resumed
eligibility actions. USB loss removed the reverse route. Restoring the route
and reloading the same bundle recovered the real Timeline. A new scan
settled with 13 acknowledged checkpoints and no proposal. Six groups
reached native matching and returned `VISUAL_NO_LANDMARK_MATCH`. Five had
readable text with `VISUAL_NO_PLACE_MATCH` and one returned
`VISUAL_NO_READABLE_TEXT`. No action reached `TRIP_QUALIFY` or
`PROPOSAL_READBACK`. Timeline stayed active across repeated final checks.
The closed events provide no episode identity, so target photo sampling,
exact album verification, and owner acceptance remain open.

#### On-device visual sampling audit

The current incident is unresolved. The normal Android scan attempted six
groups and recognized no place. Closed production diagnostics cannot tell
whether the reported window reached selection. Add a bounded, read-only
Android development tool that follows the same intake and sampler and runs
the same local recognizer for relevant candidates. Only numeric totals come
back through the existing Settings visual discovery panel. Start the check
through one secondary button in that panel. The panel appears only in an
Android dev build when the existing visual-preview flag and both privately
provided `EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_AUDIT_START` and
`EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_AUDIT_END` pass the existing visual date-range
validation. Do not put the real dates in Git or ask the owner to enter them in
Atlas. Use the baseline local recognizer, with partial/deep/regional modes
disabled for this audit. There is no new photo permission or service.

1. Reuse `visualDiscoveryPageSql`, `advanceVisualDiscovery`, the published
   Local source/privacy stamp and the same overlap and dismissal test in
   `reconstruction/repository.ts`. Replay from an independent in-memory
   checkpoint; never load or write the normal discovery checkpoint or stage
   a proposal. Scan the same descending pages without prefiltering the date
   range since surrounding captures can affect grouping. Count in-range
   eligible rows only as the cursor consumes them, including the last page
   and the early-return case where the next candidate leaves a page tail.
   Count photos in eligible representatives, excluding out-of-window photos
   from the totals alone. Maintain a bounded metadata page budget, and label a
   report limited if the replay does not reach its end. Reuse the production
   page/episode helper if a split keeps both callers simple.
2. Wire the existing `photo-access/provider.tsx` access and preview resolver
   into relevant candidate inspection. Use the same Android representatives,
   minimum four readable previews, OCR/photo budgets and local recognizer as
   the normal baseline. Run the recognizer on the full candidate, then count
   in-window opened previews, in-window opened previews submitted for analysis
   and in-window observations with a usable place. These are counts of inputs
   and matches, not verified labels or per-photo OCR success. No recognition
   for unrelated candidates with zero in-window representatives. Share the
   existing running guard. Revalidate current evidence, permissions, source
   authority and foreground before each page or media access boundary and
   before returning. A cancellation or failed recognition/authority check
   must leave no published report or owner mutation. Allow ordinary matcher
   abstention to count as zero usable matches.
3. Expose only discrete counts and whether the run reached the end, plus
   checking and retry states. Clear counts on close, loss of foreground or
   invalidated source authority. Reuse the Settings `InsetPanel`, `Body`,
   `ActionButton` and existing discovery consent. No raw result, OCR, window,
   asset identifier, or source data on screen, console, network, or on disk.
   Consent remains owner-controlled. Keep the normal discovery and proposal
   policies available when the dev opt-in is absent.

| Operation / stage | Source and action | Closed failure or outcome |
| --- | --- | --- |
| `VISUAL_PLACE_REVIEW / DATE_SEARCH` | Provider/repository establish audit config, consent, scope and the source stamp | `ALREADY_RUNNING`, `ACCESS`, `HISTORY_CONSENT`, `HISTORY_STALE`, `SKIPPED`. No report on failure. |
| `VISUAL_PLACE_REVIEW / HINT_ELIGIBILITY` | Repository reads exact discovery pages, applies sampler and overlap guard | Existing classified storage failure or `MEDIA_SCHEMA` for invalid replay progress. Mark a bounded replay incomplete. |
| `VISUAL_PLACE_REVIEW / MEDIA_SCOPE` | Shared provider preview resolver validates the source before opening representative images | Existing `MEDIA_UNAVAILABLE`, `ACCESS`, `HISTORY_STALE`, `SKIPPED`. Below-minimum previews remain counted and do not trigger recognition. |
| `VISUAL_PLACE_REVIEW / RECOGNITION`, `RESULT_VALIDATE` | Existing local recognizer classifies OCR/landmark/shape, and provider retains only aggregate totals | Existing decode, model, timeout, invalid-result, conflict and no-match events. Report meaningful counts on abstention and withhold stale or failed reports. Reuse one local action correlation. |

Verify with tests for an interval that is eligible but sampled out, a page
tail emitted on another iteration, overlap suppression, an opened sample
with no match and an opened sample with a usable match, normal gating,
correlation/redaction, and canceled or stale authority. SQLite should prove
that complete production checkpoints do not affect the audit and that the
audit leaves scan/review state byte-for-byte unchanged. Use synthetic dates
and sentinels only on the host. Do not change the quality gate, matcher,
trip rules or album association. The final owner evidence consists of the
five on-device integers and the limited/complete indicator. Load a fresh
loopback Metro bundle, verify the audit code is included, identify the
current Android process, collect only closed `VISUAL_PLACE_REVIEW` events
by correlation, and read only these five numeric labels from the Settings
panel. Consult the diagnostic map and report the first measured boundary.

#### Automatic regional landmark retrieval

Build one region-neutral on-device retrieval path for GPS-less Local episodes.
Use the `offline-landmark-index.md` contract and the existing recognition,
sampling, stop, and album path. Keep all owner photo bytes, OCR, embeddings,
dates, and IDs on-device. A public corpus change is data, never a source-code
branch for one incident. Preserve canonical recognition, authority, album
review, and confirmed trips when the development experiment is disabled.

**Implementation.** In `apps/mobile/src/visual-place`, implement a shared,
pure TypeScript starter/region retrieval engine which takes the existing DINOv2
embedding and validated public reference packs. Reuse the v1 DINO descriptor
format and matcher thresholds. Read the JSON shape from
`offline-landmark-benchmark.cjs/buildArtifacts`. `starter` may cover many
countries, each deep artifact is country-scoped. Bind pack IDs, compatible
descriptor and model versions, allowlisted catalog place IDs, strict finite
384-dimensional vectors with 16 regions, counts and byte limits. Reuse
parsed immutable snapshots during one run. Rank visual hits across all starter
references, preserve the existing ambiguity fence for distinct catalog
matches, and corroborate one region using distinct source families and separate
capture sessions before deeper retrieval. A competing country blocks the
route. Retain initial observations, stay within the existing representative
budget, and rescore cached embeddings after acquiring deep references instead
of reopening photos or rerunning native inference. Only accept additional deep
hits in that region. Restart routing at each episode and keep authority fences
after asynchronous loads. Dates and geographic metadata may organize samples,
never create a place match. Preserve unchanged qualified results when access to
optional deep references fails. Use a generic catalog locality lookup for the
published destination of a supported city. Maintain existing Seoul identity
and corrected/legacy rows. Add Hanoi's stable city and landmark IDs from the
reviewed corpus. No fabricated fallback for generic scenes.

**Runtime boundary.** Integrate at `createVisualRecognition` and the normal
provider entry. Keep it behind the existing visual feature gate plus a separate
development opt-in and a verified starter corpus. Use a fixture-injectable
pack loader so host tests exercise the same path. Real developer packs can be
loaded from a pinned public-artifact manifest and an explicitly configured
localhost HTTP origin over the Android USB development tunnel. Keep preview
inputs limited to a fixed public starter URL and one bounded region URL built
from a verified pack entry. No endpoint receives owner data in its request.
Enforce exact size, SHA-256, compatible schema, and catalog allowlist before
activation. Never auto-activate unpinned, incompatible or unqualified packs.
Scope a dev scan to the artifact release identity only when all dev inputs are
configured. Retain receipt identity for unchanged reviewed results. A missing
or unqualified corpus must leave the pilot off. Ship public references only
with provenance and verified reuse terms. General public hosting and release
activation stay gated by the broader spec.

**Verification.** Run synthetic tests for same-route independent sessions,
competing regions, duplicates, outside-index albums, interrupted/invalid packs,
old policy behavior and authorization withdrawal. Use Seoul plus an independent
Hanoi episode with never-trained-on public query captures, a mixed-country run,
and negative meter/screenshot/out-of-index controls. Score exact destination,
ordered stops, covers and album IDs after running the same matcher, sampler
and assembler. Freeze labels and acceptance before running. Both positive
episodes must route without dates, photo choices, or region inputs from the
owner, recover at least two separately supported stops and exact album
membership. A broad release claim additionally requires independent real Android
holdout, latency, memory and pack-integrity evidence. Existing Seoul tests are
regressions, never used as the fresh Hanoi evaluation. The root will handle
actual public sample selection, frozen scorer runs and device validation after
implementation. Use an ignored directory for public descriptor pilot artifacts;
no reference artifact from an unsuccessful benchmark becomes active.

The follow-up host comparison uses the same frozen fixture and references.
Compare the existing whole image with five fixed overlapping 65% views. A
crop-derived hit needs two agreeing views with no competing accepted place.
Use the same cross-session routing and exact album scorer. The experiment is
diagnostic and cannot activate a pack. `IMAGE_DECODE`, `DESCRIPTOR_GENERATE`
and `BENCHMARK_SCORE` retain the existing closed host failure categories.
As a second diagnostic comparison, use the already frozen v3 template geometry
and competing reference margin as a data-driven fallback inside a verified
route. Apply the fallback only to still-inconclusive photos. No template is
handed the query's expected place and the template cannot choose a region.

| Operation / stage | Source and action | Safe failure/outcome and evidence |
| --- | --- | --- |
| `VISUAL_PLACE_REVIEW / PACK_LOAD` | `regional-pack-loader.ts` reads the pinned preview manifest, starter and at most one routed artifact per episode using the same correlation. `native-regional-packs.ts` streams a public GET with redirects disabled. | `MEDIA_UNAVAILABLE` for an unavailable artifact and `HISTORY_READ_TIMEOUT` for a bounded request deadline. Both retryable, with unchanged durable state. `SKIPPED` on cancellation, `HISTORY_STALE` on changed authority, `ACCESS` restricted, and `HISTORY_CONSENT` blocked. Missing deep pack keeps the eligible starter observations. Check transport separately from device behavior. |
| `VISUAL_PLACE_REVIEW / PACK_VALIDATE` | `regional-pack-loader.ts` verifies manifest pin and exact artifact bytes before JSON parse and calls `regional-landmarks.ts/parseRegionalLandmarkPack` for descriptor and catalog compatibility. | `MEDIA_VERIFY` retryable and unchanged for integrity failure. `MEDIA_SCHEMA` unchanged for malformed or incompatible data. Unknown failures retain the stage. A rejected pack cannot replace a verified snapshot. Inject truncated, corrupt and sentinel inputs. |
| `VISUAL_PLACE_REVIEW / LANDMARK_MODEL` | `native-landmark.ts/prepareNativeLandmark` verifies the regional model asset's exact size and digest before passing its local URI to the existing native loader | `MEDIA_VERIFY` for integrity and `MEDIA_UNAVAILABLE` for unavailable file or native reads. Verify corrupt file rejection, ordinary preparation, and a verified retry. |
| `VISUAL_PLACE_REVIEW / REGION_ROUTE` | `regional-landmarks.ts/searchRegionalLandmarks` gathers unambiguous starter hits from separate capture sessions and distinct families. `recovery.ts` keeps signage conflicts as competing evidence and calls the optional loader with a fresh authority check. | `VISUAL_PLACE_CONFLICT` or `VISUAL_EPISODE_SUPPORT` skipped. Match results and candidate country remain local. Verify one correlation and bounded public fetches. |
| `VISUAL_PLACE_REVIEW / LANDMARK_MATCH`, `TRIP_QUALIFY`, `ALBUM_ASSOCIATE`, `PROPOSAL_STAGE`, `PROPOSAL_READBACK` | Existing native embedding, local album/stop inference, and exact checkpoint verification | Preserve current closed outcomes, same action correlation, consent and write guards. Record no raw evidence. |
| `LANDMARK_PUBLIC_EVAL / SOURCE_READ`, `SOURCE_PARSE`, `DESCRIPTOR_GENERATE`, `BENCHMARK_SCORE`, `ARTIFACT_WRITE` | Frozen public run reuses the existing host ingestion, DINO and atomic reporting helpers | Classify missing/incompatible pinned artifacts, schema and budget failure. A scored quality miss uses `GATE_NOT_MET` with report. No owner data. |

Use a fixture loader that records public request IDs in test memory only.
On Android, check the fresh dev bundle and collect only closed ReactNativeJS
fields scoped to the `com.anonymous.travellife` process and its correlation.
Confirm an actual proposal and album with the owner on the normal Timeline
screen. Root validates the CLI report, resource counters and transport before
asking the owner for device action.

**Verification outcome.** Host provider controls staged and read back the
expected Seoul and Hanoi albums using synthetic descriptors. SQLite rejected
an old regional release token and reopened the same owner-confirmed Hanoi
album after preview was disabled. Fault tests cover closed classification,
correlation, redaction, withdrawal, bounded download and verification timeouts,
and retry after invalid model bytes. Final verification passed 1,295 Jest
tests in 121 suites, 139 SQLite tests, TypeScript, Expo lint and 281 foundation
tests, plus the `expo export:embed` Android bundle and regional route markers.
No public manifest passed activation, so
the real Android regional data path and its resource gates remain unverified.

The frozen whole-image benchmark found no exact positive proposal. The
experimental crops plus local-detail matcher produced two of three exact
positive episodes. It left the mixed and outside-index controls unproposed
and made zero incorrect place matches across 24 recognition attempts. The
separately frozen second Hanoi episode still lacked both Tháp Rùa observations
even with the country and whole deep pack supplied to the scorer. The report
records 4,360,143 bytes for the starter, largest deep pack and release manifest
against the 3 MiB host gate. The exploratory host pipeline took about 13 seconds.
The candidate still requires Android measurements and capture-like screen or
poster controls. A scored failure emits `GATE_NOT_MET` with no release digest.

#### Partial Seoul proposal in Possible trips

Behind the existing on-device visual preview and a separate development-only
`EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PARTIAL_PREVIEW` opt-in, use the existing local
recognizer, independent capture qualification, and scene membership rules.
Treat eligible Nami observations as pending only in this preview. Validate the
whole observation set first, then exclude those observations entirely from
stop qualification, scene matching, date bounds, covers, and album membership.
Ignore clues from excluded media or duplicate families shared with independently
qualified captures. An otherwise unsupported member of a pending clue's duplicate
family cannot enter through scene association. Keep at most one catalog ID for
Nami, only on an independently qualified Seoul proposal and within the observed
time bounds of its supported stops. A Nami-only episode still cannot produce a Seoul offer.
Keep the runtime recognizer and thresholds in place. Test the expected output
using synthetic Ewha, Namsan, and Nami observations through the mobile path.

Stage the optional `pendingPlaceIds` field in the existing proposal JSON.
An old proposal without the field remains valid. Reject invalid combinations
before using the data. Add a dev preview variant to the scan scope so cached
checkpoint and proposal rows are recalculated on opt-in. Preserve the original
off scope and existing disposition command format. A dismissal of the same Seoul
episode and policy stays in force across preview settings even when its proposed
stops and album differ. Keep hints out of the confirmed trip and
all derived records. Show `Possible stop · Nami Island` only in the opened
review. The existing exact album and owner confirmation remain authoritative.

All stages use `VISUAL_PLACE_REVIEW` and the current discovery action's
correlation. In the opt-in flow the provider reads a newly staged proposal
immediately under the same action, using a local token bound to the exact
verified checkpoint. The
owner decision uses its own action correlation and the existing receipt.

| Stage | Source boundary | Fixed reasons and outcome |
| --- | --- | --- |
| `TRIP_QUALIFY` | `photo-access/provider.tsx/discover` verifies current access and invokes `visual-place/trip-recovery.ts/qualifyVisualTrip` to validate all observations, split pending matches and qualify the remaining stops | `MEDIA_SCHEMA` unchanged for invalid observations, `VISUAL_EPISODE_SUPPORT` skipped when independent stops cannot qualify. Reproduce with malformed recognition output or a Nami-only episode. |
| `ALBUM_ASSOCIATE` | `trip-recovery.ts/associateVisualAlbum` calculates album candidates and optional clue IDs from separate evidence | `VISUAL_ALBUM_SUPPORT` skipped if verified media support is insufficient. Compare proposed membership and duplicate families with the synthetic scene control. |
| `PROPOSAL_STAGE` | `reconstruction/repository.ts/checkpointVisualDiscovery` checks the preview scope and validates the optional catalog field in the existing owned checkpoint | `MEDIA_SCHEMA` unchanged for invalid shape, destination or overlap. Existing SQLite classification before commit. Keep the acknowledgement outcome unknown until the same checkpoint is verified. |
| `PROPOSAL_READBACK` | `repository.ts/loadVisualDiscoveryPage` revalidates the stored proposal and `provider.tsx/discover` resolves its catalog display label | `MEDIA_SCHEMA` unchanged for invalid data, `HISTORY_STALE` skipped for lost scope or an absent expected proposal, `ACCESS` restricted for lost source access, `HISTORY_CONSENT` blocked after consent withdrawal. Inspect the scoped checkpoint after a failed read, without exporting its contents. |
| `MEDIA_SCOPE`, `REVIEW_COMMIT`, `REVIEW_READBACK` | Existing exact photo resolution, transaction and receipt with pending places excluded from writes | `MEDIA_UNAVAILABLE`, `HISTORY_STALE`, `ACCESS` or `HISTORY_CONSENT` retain the existing outcomes. `COMPLETE` requires existing committed readback |

Run the local recognition/album and Possible trips interaction tests. Use the
SQLite suite to stage and reopen the proposal, reject a malformed clue, and
confirm exact album and stops with no pending data in durable trip facts.
Cover legacy rows, flag off, duplicate/low-support inputs, and redacted
classification. For Android, filter the app PID's ReactNativeJS buffer for
`VISUAL_PLACE_REVIEW` as documented above and correlate `TRIP_QUALIFY`,
`ALBUM_ASSOCIATE`, `PROPOSAL_STAGE`, and `PROPOSAL_READBACK` before the owner
reviews the proposed album. No location label, hints, photo ID, or source
reference enters the diagnostic. AC-13, AC-31, and AC-33 remain open pending
device evidence and the broader recognizer gates.

Use the existing signage and landmark recognizer with synthetic Ewha, Namsan
and Nami observations to compare flag off against flag on through the mobile
provider. Check exact ordered stop support, observed period, cover and album
membership, and the single review-only catalog label. Check a two-sided
unnamed scene, excluded origins and duplicate families. Keep the previous
public-holdout measurements separate from this integration exercise.

The final mobile checks passed 1,267 Jest tests in 120 suites and 138 SQLite
tests, plus TypeScript and lint. SQLite exercises off, opt-in, release and
parent-flag gates, exact checkpoint readback, a changed stored proposal,
cross-mode dismissal, and exact confirmed photos reopened from Timeline.
Provider fault tests check the stage, redaction and correlation of stale,
malformed and canceled actions. Foundation passed 281 tests and the eval
infrastructure smoke. The repeat public scorer matched all five partial
proposals and returned the existing `GATE_NOT_MET` for overall Nami recall.
Expo Doctor passed 20 of 21 checks and flagged SDK patch drift already present
before the change.

The owner reopened the refreshed Android dev client over USB and navigated to
Timeline. Verify the live scan separately from the host album contract. The
initial correlated action stopped at `HINT_ELIGIBILITY / HISTORY_STALE`.
Catch-up reported `ALREADY_RUNNING` and then `DATABASE_BUSY` at `LEASE_OPEN`.
A later action reached `MEDIA_SCOPE`, loaded the landmark model and ran the
existing matcher. Ten observed model batches reported `VISUAL_NO_LANDMARK_MATCH`.
Nine ended with `VISUAL_NO_PLACE_MATCH` and one with `VISUAL_NO_READABLE_TEXT`.
The final checkpoint completed. More than one minute later, the foreground
Timeline still showed no Possible trips card and no newer visual action.
The device diagnostics carry no episode identifiers or terminal cursor, so
these results cannot verify that the target trip's exact sample was processed.
The Seoul review and exact rendered album on the owner library remain open.

The frozen v3 host comparison passed its Namsan-only gate. Six positive
references span two sources and two campaigns. The patch matcher returned
three correct Namsan matches from three held-out images across two
campaigns, compared with one each for the two scene baselines. It made no
Namsan claims on ten other independently scored images. Both scene
baselines still label the known winter Damyang regression as Nami. The
Namsan-only matcher abstained on that image, which leaves Nami accuracy
open. The first run took 6.84 s before publication, with 0.45 s in scoring
and 417,624,064 bytes peak process RSS on the Windows host. A second run
reproduced the coverage and comparison counts with 6.28 s total, 0.45 s
scoring and 419.0 MB peak process RSS.

The synthetic tests verify displaced detail recognition, rejection of
scrambled detail, split and source admission, frozen gain and false-match
thresholds, and report-only publication. Faults cover a query-side region,
missing approved reference, invalid patch tensor, failed cleanup following
an invalid tensor, cancelled scoring and a publication exception. The
terminal events preserved the stage, closed outcome and invocation
correlation, with no synthetic sentinel or duplicate terminal failure.
`npm run check` passed 238 tests and the evaluation smoke check after
the review follow-up. The three focused mobile landmark, discovery and
trip recovery suites also passed 12 host tests.
The benchmark makes no episode routing, trip continuity, album membership,
native resource, or owner-device claims. CAP-4 activation still requires
the broader frozen holdout and platform gates.

- Benchmark a licensed offline landmark index with [DINOv2 SALAD](https://openaccess.thecvf.com/content/CVPR2024/html/Izquierdo_Optimal_Transport_Aggregation_for_Visual_Place_Recognition_CVPR_2024_paper.html)
  against the current image matcher. Generate regional packs from public
  photos with checked per-file provenance and licenses. Search across installed
  packs when no region is known. GPS or corroborated signage can prioritize a
  region, while unsupported matches abstain.
- Compare [Qwen3-VL-2B GGUF](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/tree/main)
  using [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md)
  locally on the same public controls as a secondary source of candidates.
  Resolve and corroborate proposed names before accepting them. Its Q4 model
  and Q8 image projector total about 1.56 GB on disk, so Android memory,
  latency and package delivery gate phone integration.
- Compare progressive sampling independently of the model. Require
  held-out views and an independent multi-stop trip, including negatives
  that resemble an indexed landmark. Record precision, stop coverage,
  album accuracy and device resource use before selecting a policy.

### Earlier recognizer candidates and hosted investigation

Freeze public positive and negative controls before integration. Use independent
views of a city landmark, an excursion, a second trip outside Korea, and
landmarks absent from the current index. Include generic scenes, lookalike
towers, a landmark screenshot or poster and unrelated camera photos. Separate
reference and query images by photographer or original capture. Compare the
current OCR and DINOv2 baseline with these candidates on identical queries.

1. **Hosted candidate considered.** Google Cloud Vision Landmark Detection and
   Web Detection on public photos. Prefer validated landmark results. Run web
   matching on inconclusive inputs and require independent geographic support
   before promoting a web entity into a place hypothesis. Measure response
   latency and usage per feature. This is a provider evaluation and confers
   no authority to transmit owner media.
2. **Offline candidate.** Compare place-specific retrieval with a versioned,
   licensed public index. Use a coarse image geolocation model only to propose
   a region to search. Verify named landmarks by reference retrieval or
   independent corroboration. Measure index size, native memory and latency
   on Android before selecting an offline package.
3. **Sampler comparison.** Compare the fixed 96-image policy with progressive,
   checkpointed sampling across distinct capture sessions. Start with
   visually diverse representatives and continue only where plausible sessions
   remain unresolved. Reuse evaluated references within the same authority
   and policy. Compare the policies under the same device resource envelope.

The historical hosted proposal would require separate feature-level authorization before
processing owner media. Keep episode selection, deduplication, album
association and confirmation local. Submit only automatically chosen,
bounded images with metadata removed. Use a server-held credential, no
storage of request media, closed diagnostics, a per-run budget and a release
switch. Define the exact disclosure, access and retention terms before
authorization. Preserve the Local discovery path when hosted processing is
disabled, unavailable or inconclusive.

Run the blind trip comparison after the recognizer comparison. The model
supplies place clues. The engine qualifies independent sessions, trip
continuity and album membership. Require evidence for multiple actual
stops, correct exclusion of unrelated captures and the same album after
one confirmation and Timeline reopen. Record place, trip and album
precision and recall separately. Provider quality on these controls is
unmeasured.

Provider contracts: [Landmark Detection](https://docs.cloud.google.com/vision/docs/detecting-landmarks),
[Web Detection](https://docs.cloud.google.com/vision/docs/detecting-web),
[data usage](https://docs.cloud.google.com/vision/docs/data-usage), and
[pricing](https://cloud.google.com/vision/pricing). Offline comparison
references: [GeoCLIP](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b57aaddf85ab01a2445a79c9edc1f4b-Abstract-Conference.html)
and [Google Landmarks v2](https://github.com/cvdfoundation/google-landmark).

### Existing reconstruction delivery slices

1. **Domestic destination coverage.** Reproduce the public Huế regression
   through the trip title projection. Select a dated, licensed geographic
   source and validate regional positives, historical names and boundary
   abstention. Add multi-stop projection and verify title precedence,
   stable grouping and album/Replay references. This slice can ship
   independently under its Local acceptance gates.
2. **Multi-stop visual discovery.** Compare a versioned recognizer and
   reference index on independent views and destinations. Feed validated
   per-session hypotheses to trip qualification. Start with a reproducible
   mixed-session fixture that fails under the current decodable-photo rule.
   Verify continuity and qualified membership with the same input and
   budget, including photos beyond the cover sample.
3. **Exact review and device validation.** Show the qualified paged album,
   commit and read it back with its ordered stops and current scope. Test
   obsolete proposals and corrections to already confirmed trips. Run the
   normal bounded Android regression and the independent holdout before
   enabling the new recovery policy. Physical iOS evidence is required
   for its platform gate.

### Planned diagnostic additions

The domestic locality expansion uses the existing pinned district geometry.
The build generator rejects unknown digests, missing or ambiguous shape names
and invalid coordinates before packing the asset. The pure resolver keeps
uncovered and ambiguous coordinates on the existing fallback. The durable
destination query and computation stages retain their current classifications
and action correlation. Verify the published title at a public point before
using any owner-library evidence.

These are build contracts. Reuse the existing operation and stage map for
consent, authority, media access, native deadlines and acknowledgement.
Register proposed new closed stages and reasons with the app diagnostic
boundary when implemented. Emit one summary per affected stage or action
with the existing correlation. Exact-stage `UNKNOWN` remains available for
unclassified failures.

| Operation and stage | Source boundary | Reason, durable outcome and safe follow-up |
| --- | --- | --- |
| `VISUAL_PLACE_REVIEW / LANDMARK_MODEL`, `LANDMARK_MATCH`, `RESULT_VALIDATE` | Visual recognizer and versioned reference loader in `visual-place/` | `MEDIA_UNAVAILABLE` or `MEDIA_SCHEMA` leaves the proposal unchanged. `HISTORY_READ_TIMEOUT` is retryable within the budget. `VISUAL_NO_LANDMARK_MATCH` and unresolved `VISUAL_PLACE_CONFLICT` skip unsupported recognition. Reproduce on a public view or fault the asset loader. |
| `VISUAL_PLACE_REVIEW / TRIP_QUALIFY` (planned) | Discovery policy and provider before proposal staging | `VISUAL_EPISODE_SUPPORT` skips insufficient continuity. `HISTORY_STALE` skips changed authority. Verify the deterministic join against a positive and conflicting fixture. |
| `VISUAL_PLACE_REVIEW / ALBUM_ASSOCIATE` (planned) | Membership policy before staging and album page resolution at the provider boundary | `VISUAL_ALBUM_SUPPORT` (planned) skips a candidate without adequate qualified membership. `MEDIA_SCHEMA` leaves it unchanged on malformed references. Existing `MEDIA_SCOPE` owns source or preview access. Compare fixture associations and resolved media locally. |
| `VISUAL_PLACE_REVIEW / PROPOSAL_STAGE`, `PROPOSAL_READBACK`, `REVIEW_COMMIT`, `REVIEW_READBACK` | Local repository, exact versioned trip, stops and album plus provider refresh | Preserve existing stale, lock and acknowledgement classification. A lost acknowledgement remains unknown until the same checkpoint or receipt is verified. Exercise the owned transaction and reopen the exact album in a disposable SQLite fixture. |
| `ATLAS_DURABLE_READ / DURABLE_DESTINATION_QUERY`, `DURABLE_DESTINATION_COMPUTATION` | `repository.ts/readDestinationLabels`, resolver and label projection | Dataset validation belongs to the build. Runtime schema or read failures retain the exact query or computation stage. A legitimate ambiguous or uncovered location uses supported fallback without an error. Reproduce at a public control and verify the active dataset version. |

Collect from the verified current device build and PID using the existing
Android logcat recipe above or the corresponding iOS process. Filter to
these operations and closed fields. Use private, authorized readback to
compare proposal membership, stored membership and the rendered album.
Keep identifiers, location, labels and media out of retained diagnostics.
Fault each boundary with synthetic inputs and verify exact stage, outcome,
correlation, sentinel redaction and retry semantics before owner validation.

The acceptance plan measures the pre-change and candidate policies on the
same frozen inputs. Record coverage, precision and recall separately for
location, trip and album. Freeze model, data, policy and numerical gates
before scoring the held-out cases. Foundation smoke verifies the eval
plumbing. Recognition quality, device recovery and national label coverage
remain open for this follow-up.

#### Multi-stop implementation boundaries

| Operation and stage | Source, classification and safe follow-up |
| --- | --- |
| `VISUAL_PLACE_REVIEW / RESULT_VALIDATE` | `recovery.ts/createVisualRecognition` validates each catalog identity, collapses compatible same-photo clues and excludes conflicting photo clues. Malformed output is `MEDIA_SCHEMA`, unchanged. No accepted clue or a conflict yields the existing fixed abstention. Compare public fixture views using the frozen catalog. |
| `VISUAL_PLACE_REVIEW / TRIP_QUALIFY` | `trip-recovery.ts/qualifyVisualTrip` joins independently supported sessions. `repository.ts/validateVisualDiscoveryProposal` checks competing trips, owner boundaries and dated Home. `VISUAL_EPISODE_SUPPORT` skips insufficient continuity. `HISTORY_STALE` skips changed authority. Validate on separated, corroborated and Home-return fixtures. |
| `VISUAL_PLACE_REVIEW / ALBUM_ASSOCIATE` | `trip-recovery.ts/associateVisualAlbum` checks family, origin and positive membership. `provider.ts/loadAlbum` checks the exact proposal and resolves one bounded media page. `VISUAL_ALBUM_SUPPORT` skips insufficient qualified media. `MEDIA_SCHEMA` leaves invalid shape unchanged, `MEDIA_UNAVAILABLE` withholds an incomplete page and `ACCESS` withdraws it. Compare exact proposed references and verified album slots locally. |
| `VISUAL_PLACE_REVIEW / PROPOSAL_STAGE`, `PROPOSAL_READBACK`, `REVIEW_COMMIT`, `REVIEW_READBACK` | `repository.ts/checkpointVisualDiscovery` and `reviewVisualDiscovery` verify the versioned ordered stops, membership and command receipt against current scope. Database lock and unknown-acknowledgement policy stays in effect. A stale proposal skips and cannot overwrite a current decision. Fault the owned writer and verify the durable receipt and slot order. |
| `ATLAS_PREVIEW / PREVIEW_SCOPE`, `PREVIEW_READ`, `PREVIEW_VERIFY` | `repository.ts/loadJourneyDetail`, `loadJourneyMediaPage` and `verifyJourneyMediaSnapshot` scope the confirmed Local album and verify the same revision through native resolution. `HISTORY_STALE` skips outdated selections, `ACCESS` withdraws revoked media and native read failures keep their classified stage. Check the generation/revision fence using a disposable SQLite record. |

Collect from the current Local dev client as specified above. Filter
`ReactNativeJS` to the diagnostic logger prefix, operation and local
correlation. On iOS use Xcode's Devices and Simulators console for the
connected current Travel Life development process with the same filter.
Only closed diagnostic fields leave the process. Use the synthetic fixture
and authorized on-device proposal/Timeline review to compare private album
references, covers and rendered media without exporting identifiers.

### 2026-11-13 implementation evidence

Android schema v45 was verified after the device reconnected. A first
consent read returned an unclassified failure and completed after relaunch.
The opt-in Atlas phase profiler then observed a completed destination query
and an outstanding destination computation. The resolver's existing
computation stage owns the cache change below. Repeated coordinates may
reuse a result only within one generation's label read and with the same
accuracy and province-date eligibility. Host tests check cache identity
and bounded reuse. Recollect the same Android computation and publication
stages after reloading the current bundle.

- Visual discovery v5 combines per-photo OCR and Android image results.
  The trip policy requires corroborated stops and validates plausible
  transitions. Album association admits direct clues and strongly similar
  intervening scenes with corroborating matches on both sides. Covers are
  a subset. The proposed and committed galleries page the exact membership.
  SQLite v45 stores stop and member evidence, correction disposition and
  idempotent receipt. The existing Account compatibility fence stays active.
- The delivered diagnostics use the mapped `TRIP_QUALIFY` and
  `ALBUM_ASSOCIATE` stages. Provider tests verify insufficient trip
  evidence, malformed album access, stale permission, exact correlation
  and sentinel redaction. Real SQLite controls verify a 14-photo proposal,
  exact order over page boundaries, lost acknowledgement, dismissal and
  correction of an older album under the same trip ID.
- The domestic resolver covers 42 source footprints for 14 cities and
  the 63 historical COD provinces on validated dates in 2020–2024.
  Verified Vietnamese stop names survive a country-only stop. Timeline
  summarizes long destination lists and detail retains the full title.
  Public city, province, historical cutoff and uncertainty tests passed.
- The current native image index still has only validated Ewha references.
  Two independent public tower views abstained under the attempted tower
  reference set. Namsan and Nami catalog entries supply signage hypotheses
  only. Measured multi-destination image coverage, default Android library
  recovery and native iOS acceptance remain open. No threshold was lowered
  after these controls. Android Hermes export succeeded. ADB subsequently
  found no attached phone on the first pass. The owner reconnected it and
  the host Metro on IPv4 port 8086 built and served the new development
  bundle. The app process started but the phone was dozing. This verifies
  transport only. A foreground library run is still pending.
- Foundation passed 199 tests and eval smoke. Mobile passed 120 suites and
  1,254 tests, 137 SQLite cases, TypeScript and lint. The subsequent album
  retry fix has a passing focused UI regression for retrying the failed
  page, with confirmation disabled until the readback succeeds.

## CAP-4 image matching fallback

On the v5 Android continuation, the optimized resolver completed and
published the durable view. The default discovery checkpoint was observed
inside the incident window and then beyond it. The correlated batch
completed model load, returned no landmark or place match and committed
no proposal. AC-13 remains unmet.

Android reached recognition on the reported episode with the wider sample.
The OCR result contained readable text but yielded no catalog place. Preserve
the automatic episode and confirmation flow. When OCR has no place or conflict,
compare bounded local image features against licensed public landmark references.

| Stage under `VISUAL_PLACE_REVIEW` | Source and safe outcome |
| --- | --- |
| `MEDIA_SCOPE` | Recheck authority before and after each image read in `visual-place/recovery.ts`. A withdrawn or changed scope discards the result. |
| `LANDMARK_MATCH` | `visual-place/native-landmark.ts` resizes and decodes a local image and `landmark-features.ts` verifies geometry. Use `MEDIA_DECODE` for image processing, `MEDIA_SCHEMA` for invalid recognition output, `HISTORY_READ_TIMEOUT` for the deadline, `VISUAL_NO_LANDMARK_MATCH` for no image match and `COMPLETE` for an accepted match. Temporary derivative cleanup failures use `MEDIA_CLEANUP`. |
| `RESULT_VALIDATE` | Existing episode support and place-conflict checks govern staging. A miss keeps the existing classified abstention. |

Collect only closed diagnostic fields from the current Metro client, joined
by the existing visual action correlation. Check the checkpoint for a full
automatic pass and the proposal on Atlas before reporting recovery. Compare
public independent views, out-of-catalog images and geometric negatives,
then check the opted-in Android flow without date or photo selection.

The pilot uses ORB feature descriptors and a geometric fit across a bounded
set of public views of one campus complex. The [reference record](../../../apps/mobile/src/visual-place/data/LANDMARKS.md)
lists the inputs and licenses. The host matched one cropped and recompressed
reference control. Both independent campus-complex views abstained, and a
campus scene outside the complex also abstained. The positive control and
synthetic geometry tests establish the code path. Generalization, false-positive
rate, physical-device latency and blind recovery remain unmeasured or open.

The first focused check caught a duplicate `RECOGNITION / START` on a retry
while the expired operation held the worker slot. Moving the start into the
admitted callback restored the lifecycle contract. The rerun passed 118 mobile
tests. The two automatic SQLite controls, TypeScript, lint and 199 foundation
tests with evaluation smoke also passed. The later USB run reached the episode
after the local Atlas finished catching up to the current evidence revision.
The correlated batch took 467 seconds from recognition start through its
image abstention. The committed checkpoint advanced without a proposal.

### Native image embeddings follow-up

The reconnected Android scan passed the episode with
`LANDMARK_MATCH / VISUAL_NO_LANDMARK_MATCH` and no staged proposal. The
geometric matcher took almost eight minutes including the OCR pass. Replace
it with a quantized, versioned local embedding model. Screen embeddings against
public references and require consistent global and regional scores. Preserve
the existing episode authority and confirmation checks.

| Stage under `VISUAL_PLACE_REVIEW` | Source and safe outcome |
| --- | --- |
| `LANDMARK_MODEL` | `visual-place/native-landmark.ts` loads the bundled ONNX asset and creates the native session. An unavailable module or model is `MEDIA_UNAVAILABLE`, and a missed initialization deadline is `HISTORY_READ_TIMEOUT`. |
| `LANDMARK_MATCH` | Same adapter prepares a bounded local image and runs native inference. Invalid tensor shape or non-finite features are `MEDIA_SCHEMA`, inference or decode failures use their closed media categories, and absent evidence is `VISUAL_NO_LANDMARK_MATCH`. |

On the host compare the independent campus views, the unrelated campus scene
and similar architecture using the exact exported model and scoring path.
On Android confirm the new policy reads through the target episode and reports
the matching outcome and proposal state with no media payload in logs.

The quantized DINOv2 Small checkpoint recognized both held-back public views
with the final preprocessing, and rejected the different campus scene and
three architectural controls. The model and thresholds are versioned together.
These six comparisons are a limited pilot and do not measure library-wide
precision, recall, latency or geographic coverage.

The first embedding APK reached the target episode but returned
`LANDMARK_MODEL / MEDIA_UNAVAILABLE`. The built package omitted the React
Native ONNX registration and resolved a dynamic Android AAR whose telemetry
initializer logged a missing JNI function. Use Atlas's existing Expo module
with an explicitly pinned Android inference library. Verify that the APK
has no ONNX telemetry initializer. This Android pilot leaves iOS OCR
available through its existing native module.

| Stage under `VISUAL_PLACE_REVIEW` | Direct Android adapter source and outcome |
| --- | --- |
| `LANDMARK_MODEL` | `native-landmark.ts` resolves the bundled public asset and the Android Expo module opens its local model path. Reject unavailable assets or runtime as `MEDIA_UNAVAILABLE`. |
| `LANDMARK_MATCH` | `TravelLifeSignageModule.kt` reads bounded media. `LocalLandmarkRecognizer.kt` prepares the tensor and runs pinned ONNX. The JS adapter validates returned fixed-size features. Use `MEDIA_DECODE`, `MEDIA_VERIFY`, `MEDIA_SCHEMA` and the existing match or abstention lifecycle outcomes. |

The direct Android adapter opened the model in about two seconds and
completed image comparison in 11 seconds on the reported episode. The
batch abstained and advanced without a proposal. In a dense episode keep
the existing OCR sample and provide up to 96 representatives for the image
fallback, drawing additional photos across shorter capture intervals.

| Stage under `VISUAL_PLACE_REVIEW` | Expanded sample source and outcome |
| --- | --- |
| `HINT_ELIGIBILITY` | `discovery.ts` selects the wider, deduplicated sample across a bounded checkpoint. Repository validation keeps `MEDIA_SCHEMA` for malformed checkpoints and `HISTORY_STALE` for changed authority. |
| `RECOGNITION`, `LANDMARK_MATCH` | `recovery.ts` keeps the existing OCR limit and permits additional image comparisons after OCR abstains. Preserve the existing per-photo deadline, cancellation and closed outcomes. |

The wider Android sample took 35 seconds for image comparison and also
abstained. Add portrait reference views and the separately evaluated
Pfeiffer Hall reference. Add exact Seoul municipal names to the OCR catalog.
These clues use the existing `LANDMARK_MATCH` and `RESULT_VALIDATE` outcomes
for accepted, conflicting or absent evidence. Record the campus name on a
visual match and use city precision for compatible municipal clues. The
reference policy version permits one fresh automatic pass.

The final public control set recognized two independent ECC views and one
independent Pfeiffer Hall view. It abstained on two other campus views,
two Paris architecture scenes, and a similar stone building at Yonsei.
This small set was used for development and does not establish general
recognition accuracy. Keep the proposal owner-reviewed.

The extended reference version also abstained on Android. For the device
incident only, compare the same recognition policy against the rest of
the automatically selected dense episode, capped at 512 representatives.
This is an opted-in local development check. Reuse the existing
`HINT_ELIGIBILITY`, `MEDIA_SCOPE`, and `LANDMARK_MATCH` boundaries and collect
only the outcome and redacted cursor. The normal sampling limit remains 96.

When a device update invalidates the evidence revision, keep the closed
`HISTORY_STALE` result at the known discovery stage. Android verified that
the committed-view refresh after `MAINTENANCE_RECONCILIATION / COMPLETE`
restarts discovery with a fresh correlation and authorization check. An
earlier manual refocus ran before this refresh and was withdrawn when the
new view published. A later switch away from Atlas withdrew the restarted
foreground check as designed.

The new reference policy's bounded Android pass took 36 seconds for image
comparison and stored no proposal. The development-only expanded sampler
covered every family in a paged synthetic 471-image episode. Android's
metadata aggregate counted 471 available capture-like images with no GPS in
the incident window. An authorized Android foreground session completed the
expanded comparison, validated its visual result, and staged an image-backed
proposal overlapping the incident window. The durable readback and Atlas UI
both showed the proposal under Possible trips with Confirm trip available.
Owner confirmation is pending. The 96-image default still has no verified
recovery for this episode. The rest of the library scan was still in progress.

Owner album review subsequently failed AC-13. The proposed album showed only
one valid stop and included unrelated media. In the current provider, session
qualification uses readable photos, the selection fills from those readable
photos, and `maximumVisualPhotos` limits both review and saved membership to
four. The repository validates and persists the exact proposed membership.
Exact offending source classification and thumbnail identity are unverified.
Track place recognition, episode continuity, album precision and album
coverage separately. Require recognizable coverage of supported sessions and
exclude unrelated lookalikes or other-origin media before accepting recovery.

## Historical CAP-4 on-device signage experiment

The development gate uses Apple Vision or bundled Android ML Kit text
recognition on exact locally selected photos. No photo transfer, standalone
model claim, or inferred publication is authorized. A catalog match concerns
what the photo depicts. Build and review the first Seoul signage control
before adding more place aliases.

| Stage under `VISUAL_PLACE_REVIEW` | Source and safe outcome |
| --- | --- |
| `HINT_ELIGIBILITY` | Local repository checks a committed run, source and privacy state and queries bounded unassigned groups near separately supported travel. No group, a withdrawn view, or an unchanged dismissed group is `SKIPPED`. Stale revisions yield `HISTORY_STALE`; native failures keep their classified category. |
| `MEDIA_SCOPE` | The photo provider checks authority around local preview resolution and disallows unavailable images or foreign URIs. Revocation is `ACCESS`, unavailable media is `MEDIA_UNAVAILABLE`, and closed scopes are `SKIPPED`. |
| `CONSENT_CHECK` | Review controller requires an exact nonempty subset and explicit per-attempt approval. Malformed or missing selection is `HISTORY_CONSENT`. |
| `RECOGNITION` | On-device adapter receives one selected local preview at a time. Missing optional module is `MEDIA_UNAVAILABLE`; deadline is `HISTORY_READ_TIMEOUT`; decode errors use `MEDIA_DECODE`. Cancellation discards the late result, even if native work is already running. |
| `RESULT_VALIDATE` | Bounded OCR strings map through known aliases. No result or conflicting places yields `SKIPPED`. Invalid native payload is `MEDIA_SCHEMA`. Neither raw OCR text nor private media appears in logs. |
| `REVIEW_COMMIT`, `REVIEW_READBACK` | A confirmed owner fact must revalidate the reviewed cluster and exact reviewed selection. Durable publication requires a verified receipt and permitted album readback. Decline and dismiss are presentation decisions. |

Collect only the fixed stage, reason and correlation for this operation from
the current Atlas dev process with the native module present. Compare public
or authorized Seoul examples against signage, duplicates, posters, conflicting
text, screenshots and unrelated indoor photos. Record matched place and review
decisions in the private evaluation dataset, not logs. Native accuracy, latency
and Seoul-library recoverability remain unmeasured until a reviewed run.

## Integrated verification

- Foundation check passed 199 tests and the evaluation infrastructure smoke.
  Mobile TypeScript and lint passed. All 113 Jest suites passed, covering
  1,206 tests. All 133 real SQLite cases passed.
- The two-connection SQLite test verifies the old Timeline, detail, album
  and Replay while a writer has deleted the old rows in its uncommitted
  transaction. After commit, an old gallery token is rejected and the
  genuinely empty replacement is visible.
- Android autolinking found the signage module and the current Kotlin module
  has compiled class output. The full arm64 debug build failed while
  extracting the React Android archive due to insufficient disk space. No
  fresh APK was produced or installed. Host ADB listed no attached device.
  iOS requires an Apple build host.
- The subsequent connected-device build recovered disk space using verified
  unused-ABI caches and completed NitroModules with one C++ job. Gradle then
  built the 153.9 MiB arm64-only APK successfully. The update install found
  that ADB had restarted and the device was absent. Native acceptance is
  pending reconnection and successful installation.
- Metro offline mode with one worker served an Android manifest with HTTP 200
  and built a fresh 1,799-module, 24,348,188-byte development bundle.
  This host delivery check does not establish installation or device render.
- After USB reconnection, the update install succeeded and the native UI
  rendered on Android. The Settings comparison displayed 19,429 Local records
  in 161.7 seconds, baseline `reconstruction-v1 / trip-detector-v1.1` and
  candidate `atlas-recovery-shadow-v1`. The final correlated
  `CANDIDATE_READBACK / COMPLETE` reported unchanged durability. Classification
  took about 56 seconds on that completed attempt; an earlier attempt was
  skipped on leaving the app. A point sample during comparison was 437,312
  KiB RSS and 1,631,347 KiB swap PSS. Peak use and sustained responsiveness
  were not measured.
- The Android Home picker displayed Sa Đéc with province context for the
  unaccented query `Sa Dec`. The check stopped before saving a Home area.
- Android Atlas displayed `Checking your saved journeys…` when Timeline
  was selected. Keyguard became active before cards and an album could be
  checked. The original device USB wake setting was restored after the run.
- After the owner unlocked the phone, the Timeline control responded to
  touch. USB disconnected before a journey card could be opened. Windows
  and ADB both stopped listing the device, so album verification remains
  pending. USB stay-awake was temporarily enabled for this attempt and
  could not be restored after disconnection.
- After USB reconnection, Android Timeline rendered 49 trips. A sampled
  journey preview logged `PREVIEW_READ / COMPLETE` about 27 seconds after
  start. The album displayed 18 visible photo tiles and rendered a selected
  local photo in the viewer. USB stay-awake was restored to its original
  value and the temporary UI dump was removed.
- Enable `EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW` for the read-only
  Settings comparison. The separate `EXPO_PUBLIC_TRAVEL_LIFE_LOCAL_RECOVERY`
  and `EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW` flags are for native
  development acceptance and remain off by default. The visual flag requires
  a new native development client. Measure on a permitted Local library
  before release or account rollout.

### Historical date-scoped missing trip recovery

This section records the shipped development prototype and its verification.
Use the automatic discovery contract and source map for the next build.

Use Atlas Timeline's visual review panel and the existing selectable gallery
tiles. The date search opens one page of up to 12 photos, with up to four
attachments selected from that page. Typed date ranges are inclusive and
limited to 31 days. The owner selects photos and requests local recognition.
Atlas then presents the suggestion for confirmation. The recovery UI has
no manual place entry. Dates alone do not infer a trip.

| Operation | Stage | Guard and source | Reason and outcome |
| --- | --- | --- | --- |
| VISUAL_PLACE_REVIEW | DATE_SEARCH | Provider access, then repository date validation, published run, privacy and page query | ACCESS restricted, HISTORY_CONSENT blocked, HISTORY_STALE or SKIPPED skipped, classified SQLite failure unchanged |
| VISUAL_PLACE_REVIEW | MEDIA_SCOPE | Provider verifies page token and resolves native photo references | HISTORY_STALE or MEDIA_UNAVAILABLE skipped, ACCESS restricted, classified native failure unchanged |
| VISUAL_PLACE_REVIEW | CONSENT_CHECK, RECOGNITION, RESULT_VALIDATE | Local recognizer validates the selected IDs and consent, reads signage and validates the proposal | HISTORY_CONSENT blocked, HISTORY_STALE or SKIPPED skipped, MEDIA_SCHEMA unchanged. For an inconclusive result the user can choose other photos |
| VISUAL_PLACE_REVIEW | REVIEW_COMMIT | Provider verifies selection and repository revalidates page, place, privacy and write authority in the owned transaction | HISTORY_CONSENT blocked, HISTORY_STALE skipped, classified transaction failure unchanged or unknown per transaction boundary |
| VISUAL_PLACE_REVIEW | REVIEW_READBACK | Repository checks saved receipt and album before provider reload | COMPLETE complete, unverified result unknown |

Collect current dev client process events using the existing VISUAL_PLACE_REVIEW
filter below the app log boundary. Match the local correlation to the search,
media, or save action. Inspect the identified guard with synthetic date and
media data. The date strings and media references do not enter logs. Contract
checks use synthetic date ranges, withheld media, and stale authority. OCR
quality remains unmeasured pending consented device review.

Android development acceptance reached a correlated DATE_SEARCH / START,
MEDIA_SCOPE / START and MEDIA_SCOPE / COMPLETE. The foreground hierarchy
contained 12 selectable tiles for the owner-provided interval. The app stayed
on that review screen. The owner has yet to select and save the actual trip.
The real SQLite test verified inclusive paging, unavailable and non-capture
exclusions, rejected access and selection, the exact owner-entered period,
idempotent receipt and album readback without inferred visit support.
The updated interaction test covers inconclusive analysis followed by a
proposal and explicit confirmation. Use synthetic OCR strings for the
contract test and the owner-selected Android photos for recognition acceptance.
Foundation checks, the full mobile Jest and SQLite suites, TypeScript and lint
passed. General landmark recognition and iOS device acceptance remain open.
