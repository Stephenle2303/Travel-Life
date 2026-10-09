# Project state

Updated: 2026-10-07 (Asia/Bangkok).

## Current stage and user direction

MLP planning for delivery. On 2026-10-07 the user explicitly replaced Minimum
Viable Product with **Minimum Lovable Product (MLP)** as the first-release goal.
Decision 0009 defines that release as a private lifetime interactive map reveal,
replay video and owner-selected sharing experience. The user previously removed pre-launch market research/
interviews as prerequisites: build from available knowledge and collect hypothesis
evidence through rollout. The user selected **both iOS and Android** for first testers.

On 2026-10-07 the user selected permission-based broad photo-library access as
the primary import experience; selected-photo import is an alternative for users
who do not want to grant broad access. See decision 0003. The existing native
implementation default remains; no browser-only switch was requested.

This revision updated planning and recorded implementation defaults. No app code,
provider call, private data collection, remote deployment or signed build exists yet.
No remote, paid plan or credentials were configured.

Validation on 2026-10-07 after recording the import decision: `npm run check`
passed framework integrity, all 20 foundation tests and evaluation-infrastructure
smoke checks. These checks do not verify device photo access or reconstruction quality.
After the photo-rule revision, `npm run check` passed again: 44 pinned skills/four
runtime trees, 20 foundation tests and eval smoke checks. Planning consistency checks
found 27 unique stories, 81 unique acceptance criteria and no broken local links in
the seven changed planning/decision documents. Product accuracy remains unmeasured.
After fixing reconstruction v1 parameters, `npm run check` passed again (44 pinned
skills/four runtime trees, 20 foundation tests and eval smoke). Document checks found
27 unique stories, 81 unique acceptance criteria, no broken links across 11 changed
planning/decision/instruction documents, and all required parameter values present.
These checks validate planning consistency and tooling, not engine behavior or accuracy.

## Established direction

- Mobile travel-history reconstruction from existing evidence, followed by a private
  lifetime map reveal, replay, durable correction and selected-highlight sharing.
- The first product goal is MLP as specified by decision 0009; no discovery-first
  Epic 1 or G0 demand gate.
- One native photo source per platform, with honest coverage and inferred-status labels.
- Broad library access is the primary path; limited/selected-photo access remains optional.
- Background maintenance is required in the first product on both platforms, with foreground
  catch-up and preserved corrections. See decision 0004.
- AI assistance has bounded scope and explicit processing opt-in.
- Keep original media at its source; the derived local record is sensitive.
- Use small engine regressions during delivery and expand real-case evals after rollout.
- Keep photo-to-journey membership distinct from visit support and reviewed facts;
  owner trip boundaries and corrections constrain inference. See decision 0006.

## Foundation delivered

- BMAD 6.12.1 core + method, 29 project-local skills.
- Six ECC 2.2.3 skills and nine evals-skills at the recorded pins.
- Workflow, trace contracts, integrity checks, 20 foundation tests and CI definition.
  See docs/development/setup-verification.md for setup evidence.

## Active planning

- Revision 7: five delivery epics, 27 stories (25 P0, two P1), M-prefixed IDs.
- Canonical backlog: _bmad-output/planning-artifacts/epics.md.
- Working decisions: _bmad-output/planning-artifacts/mvp-spec.md and
  docs/decisions/0002-mvp-first-delivery.md through
  0009-mlp-lifetime-reveal-and-replay.md.
- Shared Expo / React Native / TypeScript, SQLite, bounded OpenAI suggestions via
  a protected Supabase proxy, native map component: agent-selected defaults.
- Interactive browser viewer/published journey or lifetime-highlight snapshots and
  the private replay video are required; selected remote media derivatives are an
  explicit publishing exception to local storage.
- MLP scope is clear. The BMAD build workflow remains paused until an initial clean
  repository baseline is recorded; beta release checks remain pending.
- The earlier 13-epic/49-story proposal is preserved under
  _bmad-output/planning-artifacts/history/2026-10-06-discovery-first/
  and is not the active plan.

## Accepted decisions versus assumptions

Accepted from the user: MLP is the current goal, including its map/replay/selected-share
first loop, no pre-launch research programme, both platforms. The earlier MVP-first
wording is superseded by decisions 0008 and 0009.
Broad library access by default, with selected-photo access as an alternative,
is also user-selected (decision 0003). Background maintenance is user-selected
(decision 0004). Interactive journey-link sharing is required (decision 0005);
decision 0009 promotes the lifetime replay and selected lifetime-highlight sharing
into the MLP core, while the static card stays optional.
The user also accepted the reviewed photo-to-trip rule changes on 2026-10-07;
decision 0006 and MVP spec revision 6 record the behavior. Exact cluster ties and
bounded episode/association windows were fixed by decision 0007 before coding;
M2.1 implements `reconstruction-v1` and M2.4 verifies its boundary examples.
The numeric values and deterministic tie-break are agent-selected starting defaults,
not observed product-performance thresholds.
Starting assumptions/defaults: frequent leisure travellers, English UI, one native
photo source, trip/place heuristics, stack/model/backend, local storage and optional AI.
These are selected to enable implementation, not validated product facts.
See decision 0002 for rationale, source references and operational limits.

## Resolve inside delivery

Native access parity, dependency pins, actual device behavior, signing accounts,
map/provider configuration, source-access distribution rules and model performance
are engineering tasks in M1–M5. Service setup and publication follow actual execution
authorization; no repeated approval is needed for an already authorized step.
Demand, correction burden, usefulness, sharing and retention are rollout hypotheses,
not prerequisites for starting the app.

## Reconstruction rule decision (2026-10-07)

The user requested a second review and then directed us to change the spec according
to its proposal. The historical critique and findings are saved under
_bmad-output/planning-artifacts/reviews/. The MVP-named spec revision 7 and decision 0006 now
separate photo membership from visit support, places from visit episodes, and reviewed
facts from new inferred additions. The spec includes a small behavior decision table;
Decision 0007 now records exact bounded window/tie parameters; the related story
criteria and eval roadmap are aligned. This adds no research gate and no app
implementation began.

## Interactive prototype delivery (2026-10-07)

An isolated `apps/prototype/` Expo Router prototype now provides a synthetic-only,
local-state walkthrough of welcome, a clearly labelled simulated broad-library or
selected-photo access choice, simulated import, private map/list reveal,
year and journey selection, session-only correction, replay preview/cancellation,
selected-highlight preview, and sparse/declined examples. It contains no real
evidence, account, permission request, network call, persistence, map provider,
backend, rendered video, export, or published link.

The access screen explains that local app storage needs no operating-system permission,
while Google Photos is not connected or scanned in the MLP flow. The access UI remains
a prototype interaction only; native permission behavior is still unimplemented.

Observed checks passed: fifteen prototype flow/model/UI tests, TypeScript, Expo lint, and
Expo Doctor (21/21). Root `npm run check` also passed with framework integrity, 20
foundation tests, and eval smoke checks. Physical iOS/Android walkthroughs remain
pending. The prototype does not validate reconstruction accuracy, production privacy
controls, native source access, map providers, video rendering/export, persistence,
or backend/share services.

## Next work

On Android, capture consented GPS and cloud/unavailable observations. Perform the
equivalent iOS verification on macOS. Record aggregate observations only. After those
platform checks, hand off to M1.4 for canonical evidence/history, correction lifecycle,
disconnect, and deletion.

## Living Atlas prototype redesign (2026-10-07)

The isolated `apps/prototype/` owner flow now uses a responsive dark Living Atlas
system across every route. The reveal keeps a dependency-free contour atlas dominant,
adds Map/Timeline and snapping year controls, synchronizes selection with an accessible
expandable list, and uses three generated fictional landscape crops stored locally under
`apps/prototype/assets/synthetic/`. Replay remains cancellable and explicitly renders or
exports nothing. Reduced-motion preference is observed; the optional tactile adapter is
silent because no native haptics dependency was added.

Observed checks passed after the redesign: 22 prototype tests, TypeScript, Expo lint,
Expo Doctor, and the root foundation `npm run check` (44 pinned skills/four runtime
trees, 20 foundation tests, and eval smoke). Jest component coverage reported 90.26%
lines, 76.33% statements, 67.95% branches, and 74.75% functions; there is no configured
aggregate coverage gate and the separate Node model tests are not included in that Jest
report. The requested browser walkthrough could not be completed in this sandbox because
Expo's web launcher could not create its DevTools directory or open the browser. Physical
iOS/Android, 390×844/1440×900 overflow/focus, and reduced-motion device walkthroughs
remain pending; no product-accuracy or production-capability claim follows from these checks.

## Welcome montage and video prototype delivery (2026-10-08)

The isolated prototype's Welcome screen now uses the completed `Your travels. Alive again.` Living Atlas hero. It selects responsive local portrait/wide H.264 clips, remains muted, has an explicit pause/play control, responds to app/background, page-visibility, navigation and scroll visibility, and keeps a bundled poster readable if playback cannot start or fails. Unknown accessibility preference prevents automatic motion; a failed preference lookup uses the safe reduced-motion default while retaining deliberate play. All promotional media is visibly labelled synthetic and is separate from the simulated lifetime replay.

The two 15-second assets in `apps/prototype/assets/video/` are animated-photo montages generated from six fictional editorial stills in `assets/synthetic/hero/`, with slow zooms and short dissolves. They are not Runway or other text-to-video scene-motion output, and they contain no owner images, travel evidence, audio, route claims, export, or publishing. `apps/prototype/scripts/render-travel-hero.py` reproduces the encoded assets when given FFmpeg; its strict decoder verification passed for each 360-frame clip.

Observed on 2026-10-08: 36 prototype tests (12 Node, 24 Jest), TypeScript, Expo lint, Expo Doctor (21/21), static web export, and root `npm run check` passed. Browser QA at 390×844 and 1440×900 confirmed readable CTA/copy, responsive portrait/wide source selection, muted playback, pause control, and the access-flow handoff. The browser frame inspector rendered all six 60-frame groups (0–359) from the portrait decoder; visual review covered the opening/transition groups and final loop boundary with no black frames. Physical iOS/Android behavior, actual device haptics, native background behavior, real scene-motion generation, and user-photo replay/rendering remain unverified/unimplemented.

## Interactive map and navigation design proposal (2026-10-08)

At the user's explicit request, BMAD UX Designer reviewed the two supplied map
screenshots and the isolated prototype's map, navigation, fixtures and local-state
flow. The current atlas is an abstract percentage-position diagram, not a geographic
map; navigation is page-specific with stack headers hidden.

A [proposed review and change plan](../_bmad-output/planning-artifacts/ux-designs/ux-Travel-Life-2026-10-08/REVIEW-PLAN.md),
with paired DESIGN.md and EXPERIENCE.md, describes a vibrant geographic atlas,
pan/zoom/fit, shared year/Timeline selection, photo-led journey exploration, and
consistent Atlas / Replay / Highlight navigation plus Home/Back. It preserves
synthetic-data labels, uncertainty, session-only corrections, simulated access,
cancelable replay and exact owner-selected highlight preview.

This is planning only, not an approved implementation contract. No application
code, dependency, provider configuration or runtime behavior changed. The new
map-only palette, geographic demo anchors and navigation arrangement await approval;
online basemap versus bundled geography also remains unresolved. A network basemap
would require an explicit change to the prototype's no-external-network contract
and map-service disclosure, with local Timeline fallback retained. No live browser
visual/usability validation or new application test run is claimed for this pass.
Next: owner review of the proposal, then amend the existing prototype delivery spec
and implement only after authorization. Production mobile delivery remains separate.

## Bundled atlas and post-import navigation prototype delivery (2026-10-08)

The approved Living Atlas navigation delta is implemented only in the isolated,
synthetic `apps/prototype/` app. Its former abstract field is now an offline,
dependency-free fictional geographic illustration with explicit synthetic-demo labels,
fictional anchors, pan/zoom/fit controls, marker-overlap grouping and an accessible
Timeline fallback. Missing fictional coordinates remain unplotted and expose an
explicit Timeline recovery action; a map-render failure does the same. It makes no map-provider, tile, network, location, route or visit
claim. The prototype now also offers compact Atlas / Replay / Highlight navigation
and contextual Home/Back. These transitions preserve the active in-memory year,
selected journey, correction, camera and highlight state; exiting replay stops it.

The production map-provider decision, native gesture/device validation, physical
mobile and browser responsive walkthroughs, real evidence handling, persistence,
replay rendering/export and publishing remain unimplemented. This bounded visual
prototype is not evidence of product accuracy, map accuracy or production readiness.

## Whole-life highlight preview control (2026-10-08)

The isolated prototype's Highlight step now begins with no chapters selected and
offers an explicit **Select all 3 chapters** control alongside individual chapter
selection and Clear selection. Selecting all shows every synthetic chapter in the
exact local preview, while the screen continues to state that it creates no URL and
publishes nothing; a separate deliberate confirmation would still be required in a
production sharing flow. This supports the whole-travel-life sharing hypothesis
without changing the owner-selection boundary.

Observed on 2026-10-08: 27 prototype tests, TypeScript, and Expo lint passed.
Browser verification at 1440×900 and 390×844 confirmed the empty initial state,
whole-life selection, selected chapter indicators, clear control, and exact preview.
This remains synthetic/local-only; it does not validate live publishing, real media,
or native-device behavior.

## M1.1 shared mobile app foundation (2026-10-08)

`apps/mobile/` now contains the separate Expo SDK 57 shared iOS/Android application.
It introduces the production Trust → Import → empty Atlas flow in the established
Living Atlas visual language, with a recoverable unknown-route screen and typed
local navigation. The empty Atlas makes no map, journey, evidence or inferred-history
claim. Import explains that photo-library access will be requested only in M1.2.
There is no account, permission request, photo enumeration, persistence, network
service, AI processing, map provider, replay or sharing behavior in this story.

Observed on 2026-10-08: the mobile package check passed (8 Jest tests, TypeScript,
Expo lint and Expo Doctor) and the root `npm run check` passed (framework integrity,
20 foundation tests and eval smoke). Browser verification confirmed Trust → Import →
Atlas, explicit Back behavior, and unknown-route recovery at desktop and 390×844 widths.
The review removed destructive template reset behavior, corrected local setup guidance,
and deferred a default-dependency audit before M1.2. Metro started despite a Windows DevTools cache
ACL fallback warning. Android and iOS physical development-build smoke checks remain
pending; no device behavior is claimed.

## M1.2 native photo access implementation (2026-10-08)

The production `apps/mobile/` Import screen now offers owner-initiated broad device-library access and an explicit selected-photo/video picker. A narrow Expo SDK 57 adapter inspects or requests photo/video permission, counts accessible image/video entries in pages using the class-based media query, and opens limited-scope management only on owner action. Screen state holds scope and counts, not raw assets, media URIs, filenames, or coordinates. The app rechecks permission on foreground return and before enumeration; a completed count is recounted on foreground return, while revoked access clears its count and interrupted work remains incomplete. Denial does not trigger repeated permission prompts. Atlas remains empty until evidence import in M1.3.

The configuration declares iOS photo-use text, Android photo/video and media-location read permissions, and blocks unrelated camera, microphone, and write-storage permissions. Expo config introspection confirmed the iOS purpose text. A generated Android manifest showed intended read permissions and removal directives for the blocked permissions; the generated project was removed after inspection. An installed Android merged manifest has not been verified.

Observed checks after independent review: mobile `npm run check` passed 28 Jest tests, TypeScript, lint, and Expo Doctor 21/21; root `npm run check` passed 20 foundation tests and eval-infrastructure smoke. `git diff --check` found no whitespace errors. A desktop and 390px browser smoke check showed the web-unavailable state and empty Atlas, but cannot validate native permissions. Review fixes covered interrupted prompts, permission loss during counting, limited-selection races, selected-count preservation, and scoped-count wording. Earlier prototype/CI findings are recorded in `_bmad-output/implementation-artifacts/deferred-work.md`.

On 2026-10-09, an owner-operated physical Android development build completed the M1.2 permission checks: explicit system picker cancellation/selection, full device-library permission, a completed scoped count of 298 device-visible photos/videos, permission revocation/foreground recovery, and limited selected-photo access. The picker returned one selected item without a stable library ID, which the UI labelled as uncertain. No media, identifiers, filenames, URIs, or location data were recorded. This is device behavior evidence only, not proof of lifetime coverage or reconstruction accuracy. Physical iOS behavior, GPS availability, cloud-only asset behavior, installed merged-manifest inspection, and distribution acceptance of broad media access remain pending. M1.3 must add normalized, durable, resumable metadata import and coverage measurements before any reconstruction claim.

## M1.3 metadata import, resume, and deduplication (2026-10-09)

`apps/mobile` now includes an Expo SDK 57 `expo-sqlite` local-only import index. It pages only the current full or limited device scope, normalizes opaque asset IDs with image/video type, nullable capture and modification times, nullable location availability, and cloud/unavailable status, and commits every page with a resumable checkpoint. The importer uses parameterized SQLite upserts, checks permission before and after every page, discards late pages after cancellation or a permission change, and leaves a separate correction-marker table untouched. Selected results with no stable ID are explicitly unavailable and never substituted with a path or new identity.

The Import screen has Start/Resume/Cancel actions and labels accessible, scanned, geotagged, and unavailable counts as current accessible scope rather than lifetime coverage. The implementation does not upload, decode, copy, expose, or log media, filenames, URIs, coordinates, raw EXIF, journeys, visits, or travel conclusions. M1.4 remains responsible for canonical evidence/history, correction lifecycle, disconnect, and deletion.

On 2026-10-09, the final M1.3 mobile check passed 47 synthetic Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed 20 foundation tests plus the evaluation-infrastructure smoke check, and `git diff --check` found no whitespace errors. Those checks cover empty, sparse, large, interrupted/restarted, revoked, picker-only/missing-ID, missing metadata, cloud/unavailable, repeat/deduplication, SQLite migration and commit rollback, and Import-screen coverage states. They do not validate physical SQLite behavior, real metadata availability, iOS behavior, or reconstruction accuracy.

Synthetic unit coverage exercises empty/sparse, large/repeat/deduplicated, cancelled/resumed, permission-revoked, selected missing-ID, cloud/unavailable, and correction-marker-preservation paths. On 2026-10-09, the owner-operated Android development build completed the consented full-library start, pause, resume, and repeat observations. After a paused, committed 1,000-item checkpoint, resume completed the current scope with aggregate coverage of 2,989 scanned, 1,957 with location metadata available, and 0 unavailable. The owner confirmed a repeat import retained those aggregate totals, and **Recheck accessible photos** independently returned 2,989. The owner also selected one item through the system picker; it had no stable library ID, and selected import completed with 0 scanned, 0 location metadata available, and 1 unavailable, without substituting an identity. While a full-library import was active, the owner backgrounded the app to revoke access in Android Settings; the app paused and did not resume automatically on return. After full access was restored, **Recheck accessible photos** again returned 2,989. No media, IDs, filenames, URIs, timestamps, coordinates, or raw metadata were recorded. Physical iOS validation, cloud-only behavior, and GPS availability remain pending; passing synthetic checks and this device observation do not establish lifetime coverage or reconstruction accuracy.

On 2026-10-09, the Android development build passed `:app:assembleDebug` for the connected phone's arm64 architecture and installed with `adb install -r`. CMake 3.31.6 resolved the earlier NDK linker incompatibility; running Gradle with the installed Java 17 resolved the Prefab configuration failure caused by Java 25's restricted-method warning. Metro bundled 1,464 Android modules and Android reported `com.anonymous.travellife/.MainActivity` in the foreground. Those observations verify build, installation, and JavaScript delivery; the separate owner-operated M1.3 observation above verifies the consented Android import cases. No real photo metadata or location was inspected or recorded here.
