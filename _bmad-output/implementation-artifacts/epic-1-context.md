# Epic 1 Context: Connect photos and keep the record private

<!-- Compiled 2026-10-09 from epics.md, mvp-spec.md, roadmap.md, eval-roadmap.md,
     implementation-readiness.md, and decisions 0003, 0006, and 0009. Edit freely.
     Regenerate when those planning inputs materially change. -->

## Goal

Give an iOS or Android owner a trustworthy starting record by connecting the photo evidence their device makes available, importing useful metadata into a private local record, and maintaining it within each platform's background-work limits. This record feeds the MLP's private lifetime map reveal, replay, corrections, and owner-selected sharing, so coverage, access limits, provenance, and privacy must remain explicit from the first import.

## Stories

- Story M1.1: Create the shared mobile app
- Story M1.2: Implement native photo permissions and access
- Story M1.3: Import metadata, resume and avoid duplicates
- Story M1.4: Persist privately and provide disconnect/delete
- Story M1.5: Discover library changes in scheduled background work

## Requirements & Constraints

- Deliver one shared Expo, React Native, and TypeScript application for iOS and Android, with Trust → Import → History navigation. A local history must be explorable without email signup.
- Treat permission-based broad library access as the normal import path. Offer the supported limited or selected-photo path when broad access is declined or unavailable, respect denial and revocation, and never repeatedly pressure an owner to expand access.
- Enumerate only accessible assets. Show accessible, scanned, geotagged, and unavailable counts, and make clear that accessible evidence does not mean complete lifetime coverage. Validate required metadata permission, GPS availability, and cloud-only behavior on permitted physical-device samples for both platforms.
- Page through assets and retain available capture time with precision/timezone provenance, nullable GPS and available accuracy, source references, accessibility state, and conflicting or missing metadata. Use stable asset identities to checkpoint, cancel, resume, and deduplicate; a repeat import must neither duplicate evidence nor erase later corrections. M1.3 establishes the normalized import contract; M1.4 owns its durable SQLite lifecycle.
- Store evidence and later derived history/correction overlays locally in SQLite. Original photos remain in their source. Keep media, precise locations, raw evidence, and traces out of analytics, logs, and Git.
- Explain and implement disconnect versus delete-local-history as different operations. Deletion clears derived data and covered caches; revoked access must not silently restart. Follow the recorded platform data-protection and backup policy, documenting actual behavior rather than claiming encryption that was not enabled and tested.
- After initial import, provide an automatic-maintenance toggle and supported scheduled work on each platform. Detect added, changed, deleted, or newly accessible assets from persisted state; reconcile bounded metadata changes without repeatedly downloading or reinferring unchanged media. Absence from limited access is not proof that an asset was deleted.
- Background handling must checkpoint on expiration, serialize concurrent runs, handle permission changes, disconnect, and deletion, and catch up on foreground resume. The OS controls timing: do not promise a fixed cadence, immediate new-photo triggers, continuous GPS tracking, or force-quit execution.
- Verify empty, sparse, interrupted, and large synthetic libraries; delta/idempotency/access-scope behavior; and actual development builds on physical iOS and Android devices. Record observed limitations rather than treating simulator fixtures or handler tests as platform proof.

## Technical Decisions

- Use a shared Expo / React Native / TypeScript stack with compatible dependency versions pinned during implementation. Platform-specific media permission, metadata, and background capabilities remain explicit integration work; do not assume parity.
- SQLite is the durable local source for evidence, import state, and later history/correction overlays. Model imports around stable local IDs, source asset references, source-scope state, and persisted checkpoints so later incremental work can identify changed neighborhoods safely.
- Preserve original-media references rather than copying the library. Cache only media actually needed by the interface and clear relevant cache data on deletion.
- Automatic maintenance begins only after explained initial import and runs from persisted state without a mounted UI. Background work can update local evidence; any future cloud AI action requires separate consent and is not enabled merely by library permission.
- Record the actual build, test, and device-check evidence in the relevant delivery record. Small deterministic checks are required, but passing them does not establish complete access coverage or reconstruction accuracy.

## UX & Interaction Patterns

- Explain the private local record, photo-access choices, and source limits before asking for permission at import. Keep optional cloud-AI consent separate. A denied owner can still view an example or create a manual entry.
- Show import progress and coverage counts, with clear cancel/resume behavior. Use explicit states for empty libraries, limited access, denied/revoked access, unavailable/cloud-only media, interrupted work, and partial coverage.
- Place automatic-maintenance controls with last checked/updated and pending/restricted status in Settings. Surface foreground catch-up/manual rescan as recovery paths without implying that background processing has already run.
- Use accessible labels and touch targets, readable light/dark surfaces, and a list alternative to the later map. The isolated synthetic prototype and its proposed map/navigation design do not validate production photo access or expand this epic's feature scope.
- Avoid any claim that imported photos prove owner presence or fully represent a lifetime record.

## Cross-Story Dependencies

- M1.1 provides the shared application, navigation, and reproducible build/test base for M1.2.
- M1.2 provides the permitted accessible-asset scope required by M1.3.
- M1.3 supplies normalized, resumable imported evidence for M1.4's private persistence and lifecycle controls.
- M1.4 supplies the durable state, deletion/disconnect behavior, and privacy controls required by M1.5.
- M2.1 depends on M1.4's durable evidence model; M2.6 depends on M1.5's persisted change queue and maintenance state.
