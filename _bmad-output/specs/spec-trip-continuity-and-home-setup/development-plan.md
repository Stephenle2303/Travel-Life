# Development and verification plan

Status: planning complete for the specified baseline and Home flow; private
boundary diagnosis, any required policy amendment, regional data acquisition,
implementation and device acceptance remain pending. This is the delivery plan
for this refinement, not evidence that parent V1.1 is complete.

## Work packages and dependencies

| Package | Deliverable | Depends on | Exit evidence |
| --- | --- | --- | --- |
| W0 | Current-run diagnostics and owner-example classification | Existing completed record | All three groups explained locally; reproducible synthetic defect classes; canonical-policy fit or documented amendment requirement |
| W1 | Native normalization and shared temporal context | Parent native contract; W0 findings | Normalized precision/provenance and C0/C1 context fixtures; multiple historical homes; candidate cannot become its own base |
| W2 | Authoritative episode construction and shadow generation | W1; resolved required gap amendment | New episodes actually feed repository shadow outputs; mixed-precision/revisit/overlap and negative-return controls; original 64 cases |
| W3 | Home storage, management and candidate APIs | Current schema inventory | Migration preserves current homes; explicit selected-area save; independent candidates; atomic revision/request; stale/idempotent commands |
| W4 | Photo-backed Home setup and map selection | W3 | Grid/viewer/area selection/date confirmation/edit/remove work without primary journeys |
| W5 | Revision-aware rebuild scheduling and progress | W2, W3; parent generation store | Busy/save/restart/revoke handled; newest context revision governs completion; UI responsive |
| W6 | Supported naming and shared Atlas integration | W2, W5; offline geometry | Qualified generation drives every consumer, supported island names, coherent albums and contextual return |
| W7 | Comparative validation, dry run and activation | W0-W6 | Automated checks, three owner examples, false-merge controls, reviewed manifest, device evidence and rollback |

W3/W4 can progress while W1/W2 are developed. Enable the new Save flow only with
W5 durability/progress semantics; no temporary silent rebuild path. A blocked
regional-data source does not prevent diagnostics, pure grouping or Home UI work,
but does prevent claiming the full title acceptance complete.

## W0: Explain before changing predicates

- `apps/mobile/src/reconstruction/{types,repository}.ts`: add revision-bound edge
  decision records around existing grouping/merge and expose sanitized inspection.
- `apps/mobile/src/reconstruction/controller.ts`: bind diagnostics to the actual
  completed run and distinguish skipped/stale/failed attempts.
- `apps/mobile/src/components/atlas-reveal.tsx`: developer/About entry with
  redacted boundary reasons, away from normal list rows.
- `apps/mobile/src/components/__tests__/reconciliation-repository.test.ts`: cases
  reproducing each verified blocker, including multiple simultaneous blockers.
- Locally compare the owner's 4/2/2 reported fragments. Do not infer their exact
  locations or gaps from screenshot labels. Store private findings only in ignored
  local data; record aggregate diagnosis in the delivery notes/playbook.

If the examples fit parent rules, proceed. If not, specify and validate the exact
policy amendment before W2 acceptance/activation. Completing canonical W2 while
leaving those examples unresolved is not task completion.

## W1-W2: Complete the actual episode authority

- `apps/mobile/src/photo-access/native-adapter.ts`, import types and the new local
  native bridge specified by the parent: implement real timestamp/provenance
  capabilities, bounded local reads and permission fallback. Proposed module
  directories must be created explicitly; they are not present by assumption.
- `apps/mobile/src/reconstruction/types.ts`: typed normalized time, context,
  away-block, edge, episode and qualified projection outputs. Do not continue
  marking every imported record capture-like without verified provenance.
- New pure `apps/mobile/src/reconstruction/{normalization,temporal-context,episodes}.ts`
  and existing `engine-v1-1.ts`: implement parent session/context/episode gates;
  isolate deterministic functions, maintain baseline `engine.ts`.
- `apps/mobile/src/reconstruction/repository.ts`: replace production dependence on
  V1 grouping/merger with completed canonical episode output; persist shadow
  generations first. Existing diagnostic-only candidate execution is insufficient.
- `apps/mobile/src/import-record/repository.ts`: generation/context/link decisions,
  lineage, publication pointer and manifests; allocate next unused schema versions.
  Apply parent exact-support correction/remap and rollback semantics.
- Engine/repository/import tests: mixed precision, same-day compatible blocks,
  repeats, home context, boundaries, order permutations, incremental equivalence,
  unsafe ambiguous pooling and all parent gate/profile cases.

## W3-W4: Home data and understandable setup

- Import repository/types: extend `configured_home_area`, stable entry identifiers,
  labels/origin/revision, migration/deletion and durable rebuild request state.
- Reconstruction repository: independent observed-area candidate/detail/media
  paging, opaque revision tokens, explicit area validation, idempotent command API.
- `apps/mobile/src/photo-access/provider.tsx`: expose typed candidate/management
  APIs, operation state and permission-aware media resolution.
- New `apps/mobile/src/components/{home-base-settings,home-base-preview}.tsx`:
  management, journey-to-area preview, scoped grid, map pin, period confirmation,
  edit/remove and return stack. Reuse UI primitives/media viewer and existing
  MapLibre boundary; avoid further growing the monolithic `mobile-screens.tsx`.
- `apps/mobile/src/components/mobile-screens.tsx` and
  `apps/mobile/src/app/settings.tsx`: route the persistent Homes entry into the
  new management flow. Keep existing private-record settings accessible.
- `journey-media-viewer.tsx`: reuse scoped viewer return state; verify Close safe
  area and no stale preview across candidate switches.
- Add focused Home setup interaction tests plus provider/repository contract tests.
  Test actual selection payload and resulting geographic scope, not only labels.

## W5-W6: Progress, names and publication

- Controller/provider: durable pending revision scheduler, bounded work progress,
  coalescing, restart/resume, source/correction/context CAS and typed save outcomes.
  `rebuild(): skipped` must neither lose a Home update nor acknowledge completion.
- `apps/mobile/src/reconstruction/country-resolver.ts` and versioned local data:
  offline region/country names with island/coast fixtures, provenance/attribution
  and unknown fallback. No hardcoded owner-specific coordinates or label override.
- `apps/mobile/src/reveal/{types,projection}.ts`, Atlas, journey detail/media and
  existing Replay eligibility: one qualified active-generation boundary, consistent
  episode identity, count, destination selection and combined albums.
- Restore existing Atlas filters/camera/scroll after settings and album return;
  clear stale selection or follow a unique validated successor. Do not invent an
  ordered map path for unordered destinations.

## W7: Required evidence and rollout

1. Run focused tests during each package. At integration, run parent 64 cases and
   this acceptance matrix; `npm run check` at repository root and in `apps/mobile`,
   then `git diff --check`. Missing/native-unavailable checks are not passes.
2. Build the Android development client if native bridge code changed; JS reload
   alone cannot validate a new native module. Repeat relevant platform checks on
   iOS. Record device/build/engine versions without private payloads.
3. Run legacy/new against one frozen private normalized snapshot. Inspect changes
   for all three labeled holidays, other affected history, homes and corrections.
   Review false merges and newly missing trips, not only the requested count drop.
4. Present the revision-bound manifest required by the parent for legacy activation.
   Once that activation is authorized, publish atomically and rebuild on device.
5. Verify April 4->1, September 2->1, February 2->1 automatically, supported titles,
   album contents, map/list/count parity, Home preview selection and excluded home
   media. Manual merges cannot be used as evidence of automatic success.
6. Test interruption, retry, background refresh and rollback with latest owner
   edits. Save aggregate results, actual commands and unresolved failures.

Quality comparison measures false splits per labeled holiday, false merges per
predicted trip, omissions, precision, evidence-eligible recall, trip-action rate
and home-setup actions separately. The three examples are regression cases, not
a representative accuracy score. Retain parent quality targets and report real
denominators or `not_measured`; do not invent labels/holdout agreement.

## Completion record

Use the existing V1.1 implementation artifact as the parent delivery record; link
this refinement and record package outcomes there without rewriting its frozen
intent. Update `docs/project-state.md`, `docs/development/error-playbook.md` and
evaluation results as work proceeds. Runtime implementation is not authorized by
this planning request alone. No commit/push or private evidence publication is
part of this plan.
