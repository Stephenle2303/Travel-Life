# Error and improvement playbook

This is the project's durable record of mistakes and their prevention. The
mandatory workflow is defined in `AGENTS.md`. Read this index before implementation
or verification, then read entries relevant to the intended work. Search by affected
area, symptom, command, and rule when an incident occurs.

## Index

### Atlas projection review introduced a second aspect-ratio factor (2026-10-18)

- **Evidence/cause:** The previous reviewer claimed the original base/marker transform differed from boundaries/tiles. It did not: `2048*k/1280 == k*1.6`. The applied extra factor made base/markers use `k*2.56`, while paths/tiles still use `k*1.6`. Current source inspection and a numeric control confirm the discrepancy; the earlier alignment-fix claim is withdrawn.
- **Status:** Open, planned P0 correction in `visual-recovery-plan.md`; no runtime fix in this planning turn. Projection mismatch can make borders appear displaced and tile changes alter apparent geography.
- **Correction required:** Restore one normalized formula across assets/runtime, regenerate a compatible asset bundle and validate independent control points across hemispheres, latitudes and LOD transitions.
- **Prevention:** Simplify units algebraically before acting on review findings. A test comparing a shared helper to its own output is not independent projection evidence. Require golden coordinates and actual visual comparisons.
- **Planning-tool incident:** A research helper was read from assumed root `scripts/recon_kit.py` and was absent. Locate skill-owned scripts with `rg --files --hidden` before execution; the failed read changed no app source.
- **Verification environment incident:** A later `uv run` could not persist its interpreter-cache file in the sandbox and stopped before executing the logging helper. Request the approved host execution boundary rather than repeatedly retrying the same cache access. Research citation review also identified a deprecated Beta collision source; the report now explicitly limits it to historical priority semantics, not API adoption.
- **Citation validation:** The first mechanical citation pass found three appendix sources only referenced in the evidence table, classified by the checker as orphan rows. Added explicit claim-level citations for gestures, iOS and clustering before rerunning; no missing source was invented.

### Atlas cartography completeness recurrence (EP-088, 2026-10-18)

- **Owner mismatch:** Overall map accepted, but country/province borders lack contrast and geographic names are missing. This is an unmet product expectation, not a newly introduced runtime failure.
- **Verified cause:** Country lines are width-1 raster content; only seven labels are baked into the base, detail tiles contain no names, and no Admin1 display layer exists. The existing destination dataset also contains 63 Vietnam regions, unsuitable as an unquestioned current 34-unit administrative map.
- **Status / correction:** Global country readability is now implemented: generated Natural Earth Admin0 paths are rendered independently above relief in the same Winkel Tripel projection, labels use deterministic public collision layout, and real overlapping journeys form selectable count clusters. Vietnam Admin1 is deliberately still unavailable because the existing 63-region source has not passed current 34-unit provenance/topology checks.
- **Verification / prevention:** Public-asset generation and tile validation passed; 292 mobile tests, TypeScript and lint passed, and a new Android development build installed and opened. Expo Doctor remains 20/21 because the checkout retains nine pre-existing Expo SDK patch-version recommendations. Require AC-01..09 and AC-19..24, including native visual/gesture evidence and a verified Vietnam source, before declaring cartographic completeness; raster sharpness and successful bundling do not prove labels, current borders or device UX.
- **Recurrence (2026-10-18, owner-confirmed place correction):** Mobile lint remains blocked by concurrent cartography edits in `local-atlas-map.tsx` that read/write a ref during render, plus one cartography array-style warning. The place-correction files add no lint diagnostics. Do not mask this unrelated incomplete Atlas work; rerun full lint after its owner resolves the render-time ref issue.
- **Further recurrence (2026-10-18):** The full mobile suite ran 290/292 tests successfully but an existing Atlas overlap-choice assertion failed after the concurrent local-map behavior changed; the focused place correction, migration, repository, and structural-remap suites pass 67/67. Keep this map interaction regression separate from destination correction and rerun the complete suite when the concurrent map work settles.
- **Owner visual rejection (2026-10-18):** The owner finds the newly shipped borders visually unacceptable. Source inspection identifies the likely direct cause: every Admin0 polygon is drawn twice with a 3.5px dark casing plus 1.5px gold stroke, including duplicated shared country edges, creating dense dark/gold contour noise rather than the subtle coherent political borders in the approved reference. The implementation treated “more visible” as success without a calibrated visual hierarchy. **Status:** Open; do not claim the current cartographic treatment is acceptable. **Required correction:** Recompose the political layer around a single low-contrast boundary treatment, land/sea tonal separation, zoom-gated density and a small selected/visited emphasis; review on a real device before calling it fixed. **Prevention:** Numeric renderer tests and successful Android install are not visual acceptance. Capture/render an owner-visible device state and compare it against the approved reference before increasing global boundary contrast.

### Atlas cartography marker-width regression (2026-10-18)

- **Symptom/evidence:** The first focused `local-atlas-map` run after visible-cluster rendering failed one existing assertion: an ordinary dot's `width` was undefined because the new common style used `minWidth` for both clusters and dots.
- **Cause:** Cluster badge sizing was generalized without retaining the fixed-width contract for ordinary journey dots.
- **Correction:** Keep `width: 8/12` for ordinary/selected dots and reserve `minWidth: 26` only for count badges.
- **Verification / prevention:** The focused regression now asserts both the fixed ordinary marker size and a visible cluster badge. Preserve fixed 8/12 visual sizes whenever cluster layout is changed.

### Atlas cartography render-phase ref regression (2026-10-18)

- **Symptom/evidence:** `npm --prefix apps/mobile run lint` rejected the first semantic-band integration: it read and assigned `band.current` while rendering `LocalAtlasMap`.
- **Cause:** Hysteresis state was implemented as a mutable ref despite React's render-purity rule.
- **Correction:** The current band is React state; an effect commits only a changed next band after render. The render uses the pure next-band computation.
- **Verification / prevention:** Re-run lint and preserve band transitions as pure render calculations plus post-render state updates; never mutate refs to derive map layers in render.

### Atlas cartography cluster test contract update (2026-10-18)

- **Symptom/evidence:** The first full mobile suite had 291 passing tests and one failing Atlas overlap test. It pressed the old single-marker accessibility name, which now resolves to a Timeline item after two co-located journeys become one visible count cluster.
- **Cause:** The focused cluster implementation changed the intended map affordance but the integration test still exercised the old marker selector.
- **Correction:** Target the explicit `2 journeys in this map area` cluster button, then assert the existing chooser and real preview load.
- **Verification / prevention:** Full suite must verify the rendered cluster-to-chooser route, not infer it from a Timeline selection.

### Android ADB daemon unavailable (2026-10-18)

- **Symptom/evidence:** Device preflight failed before listing devices: `adb.exe` could not start/connect to its server.
- **Cause:** Unknown host Android Debug Bridge daemon state; no application code, device data or build was changed.
- **Status / next action:** Open external environment blocker. Restart/repair the host ADB daemon and reconnect a device before native rebuild, finger-gesture and memory evidence can be collected.
- **Prevention:** Treat failed ADB transport as an environment failure, not Android app validation; do not claim a device build or gesture check from Metro/unit output.
- **Recovery / recurrence:** Restarting ADB restored serial `9cb47ed9`. Expo's `--device` option accepts a display name, not the serial; `--device 9cb47ed9` failed before building. CLI help and `getprop` identify the accepted display name as `2211133G`. Use the display name and recheck ADB immediately before the build because this host's daemon can stop between commands.
- **Further recovery (2026-10-18, readable-cartography build):** `npx expo run:android --device 2211133G` completed successfully, installed the debug APK, and opened the Expo development URL on the connected device. Kotlin's incremental cache emitted an `ArrayIndexOutOfBoundsException` then fell back to non-incremental compilation; Gradle still reported `BUILD SUCCESSFUL`. This proves native `react-native-svg` compilation/install, not the owner-visible map or finger-gesture acceptance. **Prevention:** Treat a compiler cache fallback as a host/tooling warning unless a clean reproduction establishes an app defect; retain device visual checks separately.
- **Recurrence (2026-10-18, UI review):** A plain `adb devices -l` invocation failed because this shell PATH does not include platform-tools. No device operation was attempted. **Correction:** Use the known platform-tools executable path and verify it before capturing any UI evidence. **Prevention:** Resolve ADB by absolute path in this project session; do not treat a PATH lookup failure as device state.
- **Recurrence (2026-10-18, UI screenshot):** The first screenshot target assumed a `.codex` folder under the repository and failed before storing bytes because that directory does not exist. **Correction:** Use the OS temporary directory for the one-time UI review capture. **Prevention:** Verify a transient artifact's parent exists before sending binary output there; never create an arbitrary project folder merely for diagnostics.

### Atlas SVG dependency audit finding (2026-10-18)

- **Symptom/evidence:** Adding Expo-compatible `react-native-svg` reported 67 npm audit advisories (16 moderate, 51 high) in the existing dependency tree.
- **Cause:** `npm install` reports the repository's transitive audit state; this task did not run an audit remediation or use `--force`.
- **Status / next action:** Open dependency-maintenance item. The cartography task pins Expo's compatible SVG package and does not make a broad, potentially breaking dependency upgrade.
- **Prevention:** Record audit results separately from feature verification. Evaluate advisories, owners and upgrade paths in a scoped dependency-maintenance task; never run an unreviewed forced audit fix while delivering a map feature.
- **Verification recurrence:** After the SVG addition, Expo Doctor still returns 20/21: the same nine SDK patch-version recommendations remain (`expo`, router, asset, constants, linking, splash screen, dev client, Jest Expo and UI). This is an observed non-passing compatibility check, not a justification to make unrelated patch upgrades in this feature. A dedicated dependency update must rerun the complete native and map checks.

### Atlas readable-cartography workflow-path lookup (2026-10-18)

- **Symptom/evidence:** The first attempt to read the BMAD review step used an assumed `steps/step-04-review.md` path and failed because this rendered workflow stores step files at a different verified location.
- **Cause:** The earlier rendered workflow identifier was reused without enumerating its actual files.
- **Correction:** Locate the step with `rg --files` from the rendered workflow root before resuming review; no source or product artifact was changed by the failed read.
- **Prevention:** Treat a workflow root as a locator, not proof of its internal directory layout. Enumerate the next instruction file before reading it.

### Atlas boundary-transform test fixture mismatch (2026-10-18)

- **Symptom/evidence:** The first new renderer-alignment assertion read `Svg`'s nested child props directly and failed because the React Native SVG test mock does not expose that child through the assumed shape.
- **Cause:** The test relied on mocked component nesting instead of assigning an addressable test identifier to the transformed SVG group.
- **Correction:** The transformed group now has `atlas-country-boundary-transform`; the regression asserts its transform directly against the relief image plane.
- **Prevention:** For native SVG hierarchy assertions, target an explicit test ID rather than mock-specific child serialization.
- **Recurrence:** The explicit group test ID is preserved by the SVG mock, but its `transform` prop is not. The renderer now consumes a pure `boundaryTransform` helper shared with the image plane, and the regression tests that public contract. **Prevention strengthened:** When a native test mock strips a rendering prop, extract the common coordinate contract into a tested pure helper rather than asserting mock internals.

### Atlas tile regeneration and test ran concurrently (2026-10-18)

- **Symptom/evidence:** A focused Jest run failed during module resolution for `4096-6-3.webp` while the tile generator was concurrently deleting stale generated WebPs before recreating them.
- **Cause:** Verification and an in-place generated-asset rebuild were mistakenly launched in parallel against the same asset directory.
- **Correction:** Run the generator to completion, validate its manifest/files, then run all consumers sequentially.
- **Prevention:** Never parallelize a test that imports generated files with a command that removes or rewrites those files.

### Atlas deferred-work patch hunk omitted context (2026-10-18)

- **Symptom/evidence:** A first `apply_patch` intended to append a deferred delivery check contained no valid context and was rejected without changing the file.
- **Cause:** The append patch was prepared before reading the exact document tail.
- **Correction:** Read the verified tail, then append only after its final complete entry.
- **Prevention:** Every append patch needs an exact existing anchor; an empty update hunk is never a valid write operation.
- **Recurrence:** A follow-up documentation patch accidentally encoded an extra removal marker and was rejected before changing either document. The corrected hunk was prepared from `rg`'s exact current lines. **Prevention strengthened:** After a multi-file patch rejection, inspect every exact target line and retry only a syntactically valid minimal hunk.

### Atlas AppState cleanup assumed a native subscription in every test (2026-10-18)

- **Symptom/evidence:** The first complete mobile run passed 32 suites / 292 tests but failed `photo-access-provider`: its existing `AppState.addEventListener` mock returns `undefined`, and unmount attempted `subscription.remove()`.
- **Cause:** The new interruption cleanup correctly handled native subscriptions but assumed all existing test environments implemented the same return contract.
- **Correction:** Keep the AppState cancellation behavior and make teardown optional-chain the returned subscription/remove function.
- **Prevention:** When adding a native event subscription to a shared component, run the complete suite and make test-double-compatible cleanup explicit without weakening runtime behavior.

### EP-090: Trip gallery Load more replaces previously displayed media

- **Date / task / area:** 2026-10-18; owner-reported Photos and videos browsing mismatch.
- **Status:** Code fixed; physical-device scroll confirmation pending.
- **Symptom/evidence:** Owner expects scrolling back through all loaded trip photos. `JourneyMediaViewer.nextPage` clears gallery, and the loader effect replaces it with one batch. The selected-media branch also unmounts FlatList, risking offset loss on Back. Existing test checks request/retry calls without checking accumulated content.
- **Verified cause:** UI state models a replaceable page rather than one retained album. Repository batching already supplies deterministic, snapshot-bound batches; batching itself does not require page replacement.
- **Correction:** `JourneyMediaViewer` now appends snapshot-bound batches into one `FlatList`; its footer owns Load more/retry state, prior entries remain visible on failure, and selection overlays rather than replaces the grid. The viewer remounts only when its explicit journey/snapshot key changes, so a parent callback rerender cannot reset an open album.
- **Verification:** Isolated `journey-media-viewer` Jest regression passed 2/2: two batches coexist, Back retains the grid, and a failed later batch preserves earlier media and retries the same page. The existing Atlas gallery regression passed 22/22 before an unrelated concurrent Atlas-map import became incomplete. Typecheck/lint and a rerun of that suite are blocked by the missing `src/atlas/tile-assets.ts` dependency; device scroll validation remains pending.
- **Prevention:** Any Load more implementation must test that earlier and later batch IDs coexist after success and remain browsable after failure/Back; verify real scroll position on device. Keep the gallery session keyed to journey plus snapshot, not loader callback identity.

### Location correction entry point was too hidden (2026-10-18)

- **Status:** Fixed in UI; owner-visible confirmation pending.
- **Symptom/evidence:** After loading the owner-confirmed place feature, the owner could not find a correction function. The existing action was available only after selecting a journey and opening its preview sheet.
- **Cause:** The correction capability was technically wired but discoverability depended on an extra, unstated card interaction.
- **Correction:** Added a visible `Correct location` action beneath every Timeline journey, while retaining the preview-sheet action and the revision-bound correction review.
- **Verification / prevention:** Mobile TypeScript and the focused Atlas suite pass (22/22); the Android development app was cold-reloaded against Metro. For owner-triggered corrections, expose the entry point at the same level as the journey list rather than only behind a selected card.

### EP-010 recurrence: mobile typecheck invoked from the root package

- **Date / task / area:** 2026-10-18; owner-confirmed place correction verification.
- **Status:** Fixed for this run; command safeguard active.
- **Symptom/evidence:** `npm run typecheck --workspace=@travel-life/mobile` stopped immediately because the root package has no npm workspace configuration.
- **Cause:** The mobile package is an independent package under `apps/mobile`, not an npm workspace.
- **Correction / verification:** Ran its scripts from `apps/mobile` directly. A broad version replacement also changed an unrelated fixture date (`2026-01-31` to invalid `2026-01-32`); restored it before rerunning the focused tests.
- **Prevention:** Read the invoking package's scripts and workspace configuration before adding `--workspace`; use a narrow patch for schema assertions rather than broad text replacement.

### Place-confirmation keyboard and preview regression (2026-10-18)

- **Symptom/evidence:** The owner could type a place but could not reliably choose and confirm it. The correction screen used the default ScrollView keyboard-tap policy, which consumes the first result tap to dismiss the keyboard, and rendered the resulting save control far below unrelated correction panels.
- **Cause:** The local place flow was tested as an in-memory state transition but not as a keyboard-open mobile interaction with the confirmation control kept adjacent to the selected result.
- **Correction / verification:** `JourneyCorrectionScreen` now keeps taps available while the keyboard is open and renders the selected-place confirmation immediately beneath the result. The focused correction suite passes 10/10 and mobile TypeScript passes.
- **Tooling recurrence:** The first narrow-preview patch gated the generic preview from `place` but retained unreachable `place` comparison branches; TypeScript caught the impossible union comparisons. Removed those branches before rerunning the checks. **Prevention:** When narrowing a discriminated union at a JSX boundary, remove unreachable branches from that narrowed subtree in the same edit.
- **Owner correction / expanded resolution:** The initial local search exposed only one hard-coded Phú Quốc example, so other typed locations could not be selected. That was a feature-scope failure, not a valid offline search. It now indexes the already-bundled public Natural Earth worldwide Admin-1 data (4,589 named regions) and retains the reviewed Phú Quốc island result. It stays offline and derives only a coarse regional marker anchor. Focused correction/search tests pass 11/11 and the Atlas suite passes 22/22. **UX correction:** Removed the redundant `Correct location` button beneath every Timeline row; correction remains intentionally available through a selected trip's preview/detail.
- **Tooling recurrence:** The first expanded patch both retained unreachable `place` branches in the narrowed selection panel and created a test outside the configured Jest `src/components/__tests__` matcher. TypeScript exposed the former; the test runner's one-suite result exposed the latter. The branches were removed and the regression was relocated to the configured test root. **Prevention:** After a discriminant guard, remove all excluded cases, and verify a new test path against `package.json` testMatch before interpreting a passing run as coverage.
- **Owner recurrence (2026-10-18):** After the per-row action was intentionally removed, the owner still could not find a reliable way to correct a selected trip. The preview action was labelled "Review or correct journey", which obscured the primary task. The preview and detail now expose one contextual `Correct location` action only after a journey is selected; it opens the existing correction flow without cluttering every Timeline row. A regression covers its visible and callable route. **Persistence safeguard:** A repository regression now verifies a `place` correction stores the selected place ID/name/context/coarse anchor and writes the remappable journey application. **Verification note:** The first CTA assertion failed because its fixture did not supply `onCorrectJourney`, so the component correctly withheld the action. The next assertion assumed only one callback argument; the actual route contract also saves the selected Atlas context. The fixture now supplies the route callback and asserts both opaque ID and selected context. **Prevention:** UI assertions for conditional actions must provide the capability prop and exercise the complete handler contract, not only inspect rendered text.
- **Tooling recurrence:** A combined documentation patch used a stale sentence anchor in `project-state.md` and was rejected before changing any file. The exact surrounding lines were re-read and the documentation update was applied as a narrow patch. **Prevention:** Re-read nearby lines immediately before patching multi-file status records that concurrent work may have changed.
- **Device tooling interruption (2026-10-18):** The active shell no longer resolved `adb` or `adb.exe` because Android platform-tools was absent from its `PATH`; the executable still existed at the local SDK path. This was a shell-configuration problem, not evidence that the application cannot save a correction. **Correction / verification:** Used the explicit platform-tools path, confirmed device `9cb47ed9`, started the missing Metro dev server, reversed port 8081, cold-relaunched the existing app without clearing data, and inspected logs scoped to the new Travel Life process (no current bundle/module error). Source persistence, route, UI, and type regressions pass, along with the repository foundation check. **Prevention:** Resolve the local platform-tools path explicitly when the shell PATH is not trusted, then verify both Metro port availability and device listing before device acceptance work.
- **Place selection appeared saved but did not move the Atlas journey (2026-10-18):** The owner confirmed a location, then returned to Atlas with the original label and marker unchanged. **Cause:** Correction applications were written using the temporary pre-continuity journey ID. The V1.1 canonical continuity pass can generate a different final journey ID, so Atlas could not join the saved `place` revision to its committed row. **Correction:** Remap every effective correction against the final committed graph before inserting `journey_correction_application`; retain the earlier mapping only to protect reviewed support while continuity is calculated. **Verification:** The repository regression now uses a temporary journey whose canonical successor has a new ID and verifies the place correction maps to that successor; the repository suite passes 35/35, the complete focused correction/Atlas/search set passes 74/74, TypeScript and root checks pass. The existing Android app was cold-relaunched on `9cb47ed9` against Metro without clearing data; its current process has no startup/module error. **Regression-fixture incident:** The first fixture accidentally created two final canonical journeys, so the remapper correctly refused it as ambiguous. It was changed to one valid canonical successor with a different generated ID. **Prevention:** Any persisted correction application must be keyed from the final committed graph, with a regression that changes intermediate identity before the projection write; fixture data must preserve exactly one final successor when testing a successful remap.
- **Owner recurrence (2026-10-18):** After the final-identity change and another on-device confirmation, the owner still sees the original trip location. The preceding fixture and startup results therefore did not establish an end-to-end repair. The remaining cause is **unknown**; inspect the saved revision, application target, committed qualified journey and durable reveal for the same private trip before claiming success. The owner also reports that selecting a place leaves the typed query unchanged and puts the confirm CTA in a separate section. Source inspection confirms the result handler updates `preview` but not `placeQuery`, and the CTA is rendered in a second `InsetPanel`. **Status:** Open. **Prevention:** Assert a selected result fills the field, keeps its CTA adjacent, and only report `applied` after a read-back verifies that the selected trip's place and map anchor match the saved owner choice; validate the complete flow on the owner's Android app.
- **Trip Edit implementation (2026-10-18):** Replaced the competing contextual correction entry with an Edit hub and a focused Location task. The location save now treats a completed rebuild as only a candidate outcome: it rereads the final journey detail and durable Atlas projection, requiring the selected owner place, owner-confirmed label, and matching coarse anchor before returning `applied`. A first focused test attempted to press an asynchronously rendered offline result immediately and failed; the test now waits for the result before exercising the keyboard-open selection path. A sandboxed Jest run again failed before collection with the known transform-cache `EPERM`; the identical host run collected the suites. **Status:** Automated host verification is in progress; physical Android confirmation remains required. **Prevention:** keep read-back assertions at the provider boundary, wait for state-driven search results in UI tests, and run bounded Jest suites outside the sandbox when the documented cache failure recurs.
- **Trip Edit implementation continuation (2026-10-19):** The delegated implementation agent exhausted its runtime quota after completing only part of the approved flow. The remaining focused routes and route compatibility were completed in the parent task. A first verification command accidentally ran the repository's foundation `npm test` instead of the independent mobile package; it passed unrelated Node tests and did not execute the requested Jest suites. **Correction / verification:** reran the five target suites from `apps/mobile` on the host cache: 53 tests passed; mobile TypeScript and Expo lint passed. The legacy `/journey/[id]/correct` route now renders the focused Location task instead of retaining a competing monolithic correction surface. **Prevention:** check the package-local scripts before interpreting a test command, and route every legacy correction deep link through the same focused task as the approved Edit entry.
- **Test harness regression (2026-10-19):** An attempt to wrap the new Edit tests in React `act` assigned the asynchronous test renderer without awaiting it, so the test held a Promise and both Jest assertions and TypeScript failed. The first correction awaited the call at runtime but annotated the local variable as the promise instead of its resolved value, so TypeScript still failed. **Correction / verification:** use `Awaited<ReturnType<typeof render>>`, then rerun the focused Edit suite and static checks. **Prevention:** retain both the test library's async return type and its resolved type when adding `act`; run the focused test and `tsc --noEmit` immediately after changing a typed test harness.
- **Device launch lookup (2026-10-19):** The first cold-launch command inferred `mous.travellife` from a log tag; Android package lookup showed the installed app is `com.anonymous.travellife`, and `monkey` correctly aborted because no activity exists for the inferred package. No data was changed. **Correction:** resolve the package through `adb shell pm list packages` and its launcher activity before invoking force-stop or launch. **Prevention:** never derive Android package identifiers from log tags.
- **Final-success lookup gap (2026-10-19):** The initial strict place read-back only loaded the pre-save opaque display ID. A valid correction can be remapped to one final canonical successor with a new opaque ID, making that read fail even though Atlas contains the corrected successor. **Correction / verification:** the provider now resolves a unique owner-confirmed durable successor by its selected label and coarse anchor, then reads that successor's detail before reporting `applied`; multiple matching successors remain non-success. Focused provider/Edit tests, TypeScript and lint pass. **Prevention:** verification after reconstruction must accept only a unique final successor, never assume an intermediate opaque display ID survives continuity reconstruction.
- **Owner recurrence: confirmed Phú Quốc did not change Kiên Giang (2026-10-19):** Direct read-only inspection of the connected device after the reported save found no `journey_correction_revision` row with `action='place'` and no corresponding application, although reconstruction run 17 completed. Atlas therefore had no saved place to display; this is not a projection-label failure. The first database-copy attempt had an incorrectly escaped ADB command and produced an empty file; the corrected command used `Start-Process` standard-output redirection, queried only correction/projection tables, and deleted its temporary copy. **Cause:** the precise client-side reason the save callback did not persist is not yet established; the earlier development-client reload was not proven to have loaded the current bundle. **Correction in progress:** forced the verified app package and an explicit `exp+travel-life` URL to request a fresh Metro Android bundle after fixing the coarse-anchor successor comparison. **Prevention:** verify a place revision/application exists immediately after an owner save before diagnosing Atlas projection, and require a fresh `metro:bundling:done` record before asking for a device retest.
- **Edit-hub review fix lint failure (2026-10-19):** The first unavailable-state guard reset two state values synchronously inside `useEffect`, and Expo lint rejected the cascading render pattern. **Correction / verification:** represent the load outcome as an ID-keyed state written only by the asynchronous completion; focused tests, TypeScript, and lint pass. **Prevention:** for route-keyed async reads, make the loaded state carry the route key instead of synchronously clearing independent state in an effect.
- **Owner-reported native save error (2026-10-19):** After exposing the original error, Android reported `NativeDatabase.prepareAsync` rejection: `23 values for 22 columns`. The `journey_correction_revision` place-save `INSERT` had one extra placeholder, so SQLite rolled back before writing a revision or application. **Correction / verification:** replaced the manually counted SQL placeholder list with a column array that generates exactly one placeholder per column and a parallel values array. That intentional signature change invalidated two brittle test assertions that used a positional snapshot argument; they now find the snapshot by its stable serialized content. Focused repository/place/provider/Edit tests pass 49/49; mobile TypeScript and Expo lint pass; a fresh Android Metro bundle (`2l`) was cold-launched without clearing data. Physical save/read-back remains required. **Prevention:** do not hand-count positional placeholders for evolving correction tables; derive the placeholder list from the declared column list and keep values in one adjacent array; assertions for evolving SQL should identify semantic values rather than incidental argument offsets.
- **Correction-test typecheck interruption (2026-10-19):** The semantic test assertions introduced for the SQL signature change omitted an explicit `unknown` type on callback values. Mobile `tsc --noEmit` failed with TS7006 before lint could run. **Correction:** annotate the callback value as `unknown`, then narrow it with `typeof value === 'string'`. **Prevention:** run package-local typecheck immediately after changing a strict TypeScript test assertion, even where Jest itself passes.
- **Owner-reported place save remap failure (2026-10-19):** After the SQL repair, Android reported `Journey correction needs owner remap` while confirming a place for the trip currently open in Atlas. **Cause:** `place` is a presentation-only correction, but its save path forced a full membership reconstruction before creating its application. A generated-identity change during that unnecessary reconstruction caused the safety remapper to reject the save, although the selected current run/trip was still valid. **Correction:** write the immutable place revision and its application atomically against the currently displayed run and journey, without rebuilding; later evidence-driven rebuilds still remap the correction fail-closed. **Verification:** focused repository/provider/Edit tests pass 49/49; mobile typecheck, Expo lint, and root `npm run check` pass; Android was cold-launched with fresh Metro bundle `3j` without clearing data. The required physical save/read-back remains open. **Prevention:** do not run membership reconstruction for display-only owner overrides; test that they use the current visible projection and do not insert a reconstruction run.
- **Place-save regression assertion interruption (2026-10-19):** The new test inspected the fourth parameter after the SQL statement, but `target_kind` is a SQL literal and the actual bound journey parameter is third. The first test run therefore failed one assertion even though the stronger full-call assertion already proved the correct binding. **Correction:** assert the third bound parameter. **Prevention:** for SQL statements with literals, assert the entire invocation first and use parameter indices only after counting actual placeholders.
- **Private diagnostic command rejected (2026-10-19):** A requested temporary ADB copy of the private SQLite database was rejected by the execution safety boundary because it could expose sensitive travel metadata. No copy was made and no private data was read. **Prevention:** derive the fix from code and synthetic regression coverage unless the owner explicitly authorizes that exact private-data diagnostic scope.
- **Edit-flow review lookup (2026-10-18):** A read-only `Get-Content` assumed `journey/[id]/index.tsx` and failed because the route is `journey/[id].tsx`. `rg --files apps/mobile/src/app/journey` established the actual paths; the review then read the correct file. No application source changed. **Prevention:** Enumerate Expo route files before opening a guessed nested path, especially where bracketed dynamic routes can be either files or directories.
- **Tooling recurrence:** A combined status patch used a stale continuation line in `project-state.md` and was rejected before modifying any record. The target sections were re-read and updated with separate narrow hunks. **Prevention:** Do not combine long moving status paragraphs from multiple documents under one unverified exact-text anchor.
- **Device acceptance interruption (2026-10-18):** After the correction build reload, the Android development client displayed `Unable to load script` because it lost its Metro connection. The first automated attempt to press Dev Launcher's Reload button was rejected by this device's input-injection policy. **Correction / verification:** Re-established the explicit ADB reverse mapping, confirmed the Metro status endpoint, cold-relaunched the app, and verified that it rendered the Travel Life Welcome screen rather than the Dev Launcher error. No device data was cleared or inspected. **Open acceptance:** The private Atlas must be opened in the running app and the place re-confirmed before marker movement can be accepted. **Prevention:** After a device reload, inspect the actual visible screen before claiming a bundle is delivered; never rely on a running process or a successful `monkey` launch alone.
- **Device-load recurrence:** Replacing the local search file through a delete/add patch created a brief Metro module-resolution failure while the connected device requested its bundle. The replacement file was then present, Metro completed fresh Android bundle `bj` in 98 ms, and the development client resumed. **Prevention:** For a module imported by a live development client, prefer an in-place update; if a replacement is required, do not call the device reload until Metro has observed the completed file.

### EP-035 recurrence: Android bridge was not resolved before device-load verification

- **Date / task / area:** 2026-10-18; owner-confirmed place correction device load.
- **Status:** Fixed for this run; application installed and cold-launched.
- **Symptom/evidence:** The post-test `adb devices` command did not start because `adb` is not on this PowerShell session's PATH.
- **Cause:** The device tool path was assumed rather than resolved from the installed Android SDK.
- **Correction / verification:** Resolved `C:\Users\vothi\AppData\Local\Android\Sdk\platform-tools\adb.exe`, verified device `2211133G`, built an arm64 debug APK after the unused x86 CMake task raced, installed with `adb install -r` (preserving app data), and cold-launched the app. The current Metro process is the Travel Life mobile project; filtered startup logs contain no fatal exception or unable-to-load-script message.
- **Prevention:** Resolve executable locations with `Get-Command` or the SDK configuration before issuing a device command.
- **Further recurrence (2026-10-18):** `expo run:android` reached Gradle configuration but its terminal session disappeared before success/failure or installation output. Device inspection showed the previously installed APK timestamp, so installation is not claimed. Build the APK directly, verify its timestamp, then install with the resolved serial.
- **Further recurrence (2026-10-18):** A direct wrapper invocation from `apps/mobile` was not a Gradle root and failed before compilation. Inspect the generated Android directory/root configuration before retrying; do not infer the wrapper's working directory from a stale APK output path.
- **Further recurrence (2026-10-18):** The verified Gradle-root build reached native compilation but failed configuring the unused x86 worklets target because its CMake log directory changed during deletion. The connected phone is arm64-v8a. Retry the debug build constrained to that verified device ABI, then install only a newly timestamped APK.
- **Further recurrence (2026-10-18):** The owner reported the loaded app was not running. `adb` showed its process and Metro listener alive, so it was force-stopped and reopened using the explicit development-client URL with `adb reverse` for port 8081. The new process started and filtered logs contained no fatal exception or bundle-load error. Check the visible device state before claiming a prior launch was sufficient.
- **Further recurrence (2026-10-18):** The owner then reported an excessively long load. The visible Dev Launcher error was `unexpected end of stream` from `http://127.0.0.1:8081`; the active Metro server was listening only on `::1`, while the Android `adb reverse` route used IPv4. Restarted Metro in LAN mode (listener `::`), verified `http://127.0.0.1:8081/status`, restored the reverse mapping, and reopened the development client. Metro completed the fresh Android bundle in 2.6 seconds and `MainActivity` resumed; the device UI was subsequently obscured by the lock/AOD screen. **Prevention:** For Android `adb reverse` validation, test the IPv4 status endpoint before launch and require a fresh `metro:bundling:done` record before calling the client loaded.

### EP-010 recurrence: Jest transform cache is not writable in the sandbox

- **Date / task / area:** 2026-10-18; gallery regression verification.
- **Status:** Fixed for this run; environment safeguard active.
- **Symptom/evidence:** The first focused Atlas Jest invocation stopped before tests with an `EPERM` rename in the sandboxed Jest transform cache.
- **Cause:** Windows sandbox cache access, not an application failure.
- **Correction / verification:** Reran the same focused suite outside the sandbox; it passed 22/22 before later unrelated concurrent Atlas work made an import unavailable. The isolated gallery suite then passed 2/2 outside the sandbox.
- **Prevention:** Use the approved host-execution boundary for Jest in this workspace after this known cache failure, and distinguish this infrastructure failure from a test result.

### Destination-fix device load (2026-10-18)

- **Compatibility safeguard:** The isolated fix checkout predates the phone's schema-31/V1.1 app. Loading it directly could regress current behavior. Integrated only the tested resolver/data/visit-support labeling and focused regressions into the current checkout; preserved its newer qualification and Home logic. All 280 mobile tests, TypeScript, lint and foundation checks passed before/with loading.
- **CLI location probe:** An initial read assumed `node_modules/@expo/cli`; that path is absent in this dependency layout. No app/device change occurred. Resolved the installed CLI from Expo's package and used `node_modules/expo/node_modules/@expo/cli/build/src/start/server/UrlCreator.js` to generate the supported development-client URL. Prevention: resolve package locations with Node before path-specific reads.
- **Delivery evidence:** ADB reported successful cold launch; the app process runs and Metro lists the physical device's React Native Bridgeless connection. Filtered app-process logs returned no matching startup error. No app data was cleared or exported. Owner-visible destination correctness remains pending physical acceptance; delivery is not proof of metadata accuracy.

| ID | Area / search terms | Lesson | Status |
| --- | --- | --- | --- |
| EP-001 | React, journey detail, effect, lint, stale state | Associate loaded state with the selected identity; run lint after review fixes | Fixed; lint safeguard active |
| EP-002 | Jest, provider, act, deferred rejection | Observe expected rejection before releasing a deferred failure | Fixed; regression active |
| EP-003 | apply_patch, documentation, context mismatch | Read exact target context before constructing a patch | Fixed |
| EP-004 | PowerShell, rg, wildcard path | Use a real search root and let rg globs filter files | Fixed |
| EP-005 | Review tool, JavaScript wrapper, syntax | Keep batched result output syntax simple | Fixed |
| EP-006 | M4.1, correction UI, unsaved decision | Do not show confirmed or rejected outcomes before durable save | Open |
| EP-007 | PowerShell, bracketed route, literal path | Use `-LiteralPath` for Expo route names with brackets | Fixed |
| EP-008 | Parallel review, shared playbook, duplicate ID | Assign one writer to shared incident records | Fixed |
| EP-009 | Review diff, temporary directory, isolated shell | Use a verified shared path for reviewer artifacts | Fixed |
| EP-010 | Jest, Windows sandbox, EPERM, realpath Temp | Re-run blocked Jest outside the sandbox after recording the environment failure | Fixed; focused regression passed |
| EP-011 | Jest, React, act, correction screen | Do not accept focused UI tests that emit asynchronous act warnings | Fixed; regression active |
| EP-012 | Schema migration, Jest assertions, version bump | Update migration assertions whenever the schema version changes | Fixed; regression active |
| EP-013 | Task completion, handoff, M4.1 | Do not yield after a partial milestone when the user asked for story completion | Fixed; active-task safeguard |
| EP-020 | PowerShell, BMAD workflow, sprint status | Test optional workflow files before reading them | Fixed |
| EP-021 | Owner claim tests, nested rebuild, controlled inputs | Model every rebuild query and await controlled native input updates | Fixed; regression active |
| EP-022 | Playbook patch, PowerShell quoting | Anchor edits to the named incident and use single-quoted PowerShell search patterns containing backticks | Fixed; safeguard active |
| EP-023 | Tool response shape, web research | Serialize unfamiliar tool results before accessing response fields | Fixed; safeguard active |
| EP-024 | M4.1, correction contract, provider fixtures, schema | Update every typed fixture and migration assertion with an interface or schema change | Fixed; regression active |
| EP-026 | Atlas, sparse reconstruction, device guidance | Do not describe a sparse projection as an absent private record | Fixed; device regression active |
| EP-027 | Sparse diagnostics, Jest, test contract | Verify both completed and missing-run states; distinguish sandbox failure from test failure | Fixed; device check pending |
| EP-028 | Android import, legacy coordinates, sparse Atlas | Reimport current accessible metadata after adding reconstruction fields; verify aggregate support | Open; device recheck pending |
| EP-029 | Android SQLite, reload, database locked | Avoid needless startup write locks and handle concurrent DB failures without uncaught promises | Code fixed; device recheck pending |
| EP-030 | Android map, native Marker, dev client | Gate native maps on registered view managers and preserve Timeline fallback | Code fixed; rebuilt-device check pending |
| EP-031 | Android Google Maps, API key | Never mount Android Google Maps unless the build contains its configured API key | Code fixed; local key and rebuilt-device check pending |
| EP-032 | Google account recovery, device guidance | Verify recovery-account constraints before advising a locked-out owner | Fixed; guidance corrected |
| EP-033 | Tool response, Google Maps setup guidance | Inspect unfamiliar tool results before accessing nested response fields | Fixed; safeguard active |
| EP-034 | MapLibre migration, Atlas tests, mobile typecheck | Update fallback assertions and use design tokens that exist | Fixed; regression active |
| EP-035 | Expo Android device build, noninteractive Metro | Pass a device identifier and disable the duplicate bundler when Metro already runs | Fixed; device map check pending |
| EP-036 | PowerShell, validation script, interpolated colon | Delimit variable names before a colon in expandable strings | Fixed; document check passed |
| EP-037 | BMAD spec update, photos, videos, stale terminology | Sweep all spec companions after a scope decision changes nouns or actions | Fixed; terminology check passed |
| EP-038 | Expo Video, Atlas unit test, native module import | Mock a newly imported native runtime module before Atlas component tests load | Fixed; regression active |
| EP-039 | BMAD memlog, uv cache, Windows sandbox | Distinguish runtime cache denial from spec-log failure and retry within the approved boundary | Fixed; spec log created |
| EP-041 | Atlas refinement, focused Jest, compact disclosure | Update focused UI assertions when an intentional progressive-disclosure contract changes | Fixed; regression active |
| EP-058 | Trip recognition, inferred drafts, Atlas, review burden | Qualify episodes before primary publication; measure recall and review effort as well as precision | Open; improvement planned |
| EP-059 | Engine planning, readiness, score gates, incomplete contract | Do not describe a plan as complete with unresolved executable policy or conflicting fixtures | Planning corrected; engine unimplemented |
| EP-019 | BMAD context, epics anchor, fragment path | Verify a referenced Markdown anchor before extracting a context fragment | Fixed |
| EP-088 | Atlas visual fidelity, placeholder completion, browser/native evidence | A recolored schematic is not a reference-matched world map; require actual comparisons and owner acceptance | Open; replacement planned |

## EP-039: BMAD decision-log initialization hit a sandbox cache denial

- **Date / task / area:** 2026-10-15; Atlas map/list requirements; BMAD runtime.
- **Status:** Fixed; spec log created.
- **Expected / actual:** Initialize the new spec log. `uv run` emitted repeated access-denied warnings while persisting its interpreter cache in the Windows sandbox package directory and produced no initialization result.
- **Cause:** Environment cache-write denial before the BMAD script completed; no application defect identified.
- **Correction:** Reran the identical initialization outside the sandbox through the approval mechanism, then used that boundary for log appends.
- **Verification:** Initialization returned `ok: true` with zero entries; ten subsequent appends returned sequential counts 1–10.
- **Recurrence (2026-10-15, dimensional Atlas planning):** Configuration resolution through sandboxed `uv run` hit the same interpreter-cache denial. The queued read-only script commands also failed before Python ran. Configuration resolution and new spec-log initialization/appends succeeded through approved escalation. No application failure occurred. Strengthened preflight: after this environment's cache denial is known, request the approved execution boundary for subsequent BMAD script invocations in that session instead of re-probing the sandbox.
- **Recurrence (2026-10-16, Trip Detection Engine V1.1 party):** The initial three read-only BMAD party setup commands again failed at `uv` interpreter-cache persistence inside the Windows sandbox, before configuration or roster resolution. Rerunning them through the approved execution boundary resolved the workflow configuration, project core settings, and installed-party roster. No application failure occurred.
- **Prevention:** Check the script result before assuming a spec workspace exists. After a verified runtime-cache denial, retry through the approved boundary rather than repeating the unchanged sandbox call or editing upstream scripts.

## EP-041: Atlas refinement changed a focused UI contract without updating every assertion

- **Date / task / area:** 2026-10-15; Atlas map/list refinement; focused mobile Jest.
- **Status:** Fixed; regression active.
- **Expected / actual:** The focused Atlas suite should validate the refined hierarchy. Its first outside-sandbox run executed but failed seven assertions because coverage and evidence text moved behind the required About action, state text was compacted, and a list-only selection needed the same preview fallback as the map card.
- **Cause:** The initial visual refactor changed progressive-disclosure and fallback rendering before all focused behavior assertions and the list-only preview branch were aligned.
- **Correction:** Restored concise state messaging, added the list-only preview fallback, and updated assertions to open the labelled About surface before checking its disclosure.
- **Verification:** Outside-sandbox focused Atlas suite passed 14 tests after the correction; mobile TypeScript passed.
- **Prevention:** When moving existing text into an explicitly labelled disclosure, update tests to exercise that trigger and verify both map and Timeline/list-only selected-preview paths.

## Recording and maintenance

### Continuity-party tooling recurrence (2026-10-16; EP-003/EP-004)

A skill read used an unquoted path containing spaces and failed; a subsequent
search passed a Windows wildcard as a literal path and failed. Both reads were
corrected with a quoted literal path and `rg` directory plus `-g` filter.
An attempted playbook update used a nonexistent exact heading and was rejected
without changing the file. Prevention: read exact anchors before patches and
use literal quoted paths for PowerShell reads. No application command failed.
During specification, a source inventory also included nonexistent
`apps/mobile/app`; the verified route root is `apps/mobile/src/app`. Corrected
the inventory and development-plan paths. Check proposed source roots before
passing them to `rg --files`; a spec path is not proof of an existing directory.

- Add a new ID for a new failure mode; update the existing entry for recurrence.
- Capture unexpected output or a concise evidence reference, without private data.
- Distinguish verified facts, suspected causes, and unverified behavior.
- Record a specific preflight check or executable safeguard, including when to use it.
- A fixed status requires verification evidence. Use open or blocked when unresolved.
- Check this record before the final handoff. Successful fixture tests do not prove
  device behavior, production correctness, or permanent elimination of the risk.
- Keep retired lessons with the reason and evidence for retirement.

## EP-026: Sparse Atlas state was described as an absent private record

- **Date / task / area:** 2026-10-14; Android M4.1 device validation; Atlas guidance.
- **Status:** Fixed; regression active.
- **Expected / actual:** A connected private record with insufficient supported evidence should explain that no journey is revealed yet. The Atlas heading instead said `No private record yet`, causing incorrect guidance to search Settings for a create/connect action that does not exist for a connected record.
- **Evidence and impact:** The Android device showed full source access and completed local metadata import while Atlas showed the sparse-state explanation and the misleading heading.
- **Cause:** `AtlasReveal` used the same heading for the `sparse` state and absent journeys without consulting the state semantics.
- **Correction:** The sparse heading now reads `No journey revealed yet.`; restricted and waiting states have distinct headings. Owner-flow tests assert the sparse heading.
- **Verification:** Focused owner-flow and Atlas suites passed 17 tests with typecheck, lint, and diff checks. Physical Android recheck remains pending.
- **Prevention:** When a screen renders a state-machine result, derive user-facing text from the named state rather than an inferred condition such as an empty list.
- **Recurrence:** First occurrence.

## EP-027: Sparse diagnostic test run exposed an outdated assertion

- **Date / task / area:** 2026-10-14; Android sparse Atlas diagnostics.
- **Status:** Fixed in code; physical device check pending.
- **Expected / actual:** The focused Jest suites should run and reflect both completed-run and missing-run states. The first sandbox run stopped before tests because Jest could not resolve Windows TEMP. The elevated run found one pre-existing sparse test expecting the old insufficient-evidence message even when no completed diagnostic result exists.
- **Evidence and impact:** Jest reported EPERM before test execution, then 1 failed and 34 passed tests. A separate repository search used an outdated provider path and returned a file-not-found error.
- **Cause:** Sandbox TEMP access is restricted; the new missing-run message changed a UI contract without updating its existing test; the search path was guessed.
- **Correction:** Reran Jest with access to Windows TEMP, updated the test for the honest missing-run state, and located the provider with `rg --files` evidence.
- **Verification:** Focused suites passed 35 tests, full mobile Jest passed 28 suites / 228 tests, mobile typecheck and lint passed, and root `npm run check` passed. Physical Android observation remains pending.
- **Prevention:** For state-copy changes, test both the durable result and its absence; locate files before path-specific searches; treat sandbox startup errors separately from application test failures.
- **Recurrence:** First occurrence.

## EP-028: Existing Android import has no qualifying location support

- **Date / task / area:** 2026-10-14; physical Android Atlas reconstruction.
- **Status:** Fixed; physical Android refresh confirmed.
- **Expected / actual:** The imported library had 2,989 records and 1,957 location-metadata flags; Atlas should assess any valid coordinates under `reconstruction-v1`. The completed reconstruction assessed 2,989 records but reported zero supported evidence, places, and visits, with all 2,989 in the broad insufficient-location bucket.
- **Evidence and impact:** Owner-provided Android screenshot of the aggregate Local evidence check; no personal metadata or raw identifiers recorded.
- **Known / unknown cause:** Current adapter maps numeric native latitude/longitude and the repository upserts them on repeat import. The older M1.3 index stored only a location-present flag, and schema migration cannot recover coordinates without reading the library again. This is a plausible stale-index cause, not yet proven; the broad bucket also covers absent/invalid coordinates and rejected accuracy.
- **Correction / next action:** Add adapter and repeat-import regression checks, then have the owner tap Start metadata import in the current full-access scope and inspect the new aggregate Atlas result. If support stays zero, split the local diagnostic bucket into safe counts before changing reconstruction rules.
- **Verification:** The owner-operated Android refresh subsequently produced 165 inferred journeys, 67 inferred places, and 5 supported countries from the same 2,989-record accessible scope. This confirms that the refreshed local index can yield supported reconstruction; it does not establish that every historic item or journey is accurate.
- **Prevention:** When a new required reconstruction field is added after earlier imports, provide a clear refresh path and verify old-device data with aggregate-only checks before claiming the journey loop works.
- **Recurrence:** First occurrence.

## EP-029: Android reload rejected a SQLite write lock

- **Date / task / area:** 2026-10-14; Android development build reload during metadata refresh.
- **Status:** Code fixed; successful reconstruction observed, concurrency edge remains device-unverified.
- **Expected / actual:** Reload should preserve the local record and allow the import flow to continue. Metro instead showed an uncaught `NativeDatabase.execAsync` rejection caused by `database is locked`.
- **Evidence and impact:** Owner-provided Metro screenshot; no personal database contents inspected or recorded.
- **Known / unknown cause:** The import repository currently begins an immediate write transaction on every lazy open, including an already-current schema, and the reconstruction repository opens a separate connection to the same file. Multiple startup operations can overlap. The exact rejected call is not identified by the Metro stack.
- **Correction / next action:** Current-schema opens now skip the immediate write transaction; both connections set a 30-second SQLite busy timeout before database work; a failed startup reconciliation read becomes an error state. Recheck the development build on Android.
- **Verification:** Focused import/reconstruction/provider suites passed, including a simulated rejected startup read; full mobile Jest passed 28 suites / 234 tests; mobile typecheck and lint and root `npm run check` passed. The owner subsequently completed an Android reconstruction without the reported lock; an intentionally concurrent reload/import timing case remains unverified.
- **Prevention:** Treat schema inspection as read-only when already current and ensure every fire-and-forget startup database promise has an error outcome.
- **Recurrence:** First occurrence. Adding the schema preflight shifted positional repository mocks and the first focused Jest run failed five fixture assertions; updated those fixtures and added current-schema and absent-schema regression cases before the full pass.

## EP-030: Android development client lacks the native marker manager

- **Date / task / area:** 2026-10-14; Android Atlas map.
- **Status:** Marker-free map correction ready for Android reload; device confirmation pending.
- **Expected / actual:** A private Atlas map should show coarsened journey anchors when native maps is available. The development client instead raised an invariant violation because its `nativeMarker` view config was undefined.
- **Evidence and impact:** Owner-provided Metro screenshots identify `atlas-reveal.tsx` marker rendering. No private journey or coordinate data was recorded.
- **Cause:** The JavaScript package exports a Marker component. The initial safeguard then made a second mistake: it checked only the legacy `AIRMap` and `AIRMapMarker` names. This Android build has React Native new architecture enabled, and `react-native-maps` 1.27 registers the Fabric pair `RNMapsMapView` and `RNMapsMarker`, which the generated Android autolinking source includes. The corrected map-manager gate exposed a separate device defect: rendering the library's Marker component still raised the `nativeMarker` invariant even with the Fabric pair registered.
- **Correction:** Atlas now accepts either the legacy or Fabric map-surface manager, but renders no native Marker children on this runtime. The map centers on the existing coarse anchors; the already-present Timeline remains the selectable journey control. A genuinely missing map surface still selects the Timeline fallback instead of crashing.
- **Verification:** Focused Atlas tests, mobile typecheck, and lint passed. Android reload with the marker-free map and full regression remain pending.
- **Prevention:** When a native dependency has separate parent and child view managers, device-test the smallest parent-only rendering before adding each child type. Keep a usable non-native selection path while child support is unverified.
- **Recurrence:** The first fallback test still assumed one visible map marker and failed; its assertion now models the Timeline-only fallback. The device result then exposed the legacy-only manager-name check. After that correction, the owner reproduced the Marker-specific `nativeMarker` crash; Atlas now excludes only that failing child and its test asserts both legacy and Fabric parent-surface detection.

## EP-031: Android map mounted without a Google Maps API key

- **Date / task / area:** 2026-10-14; Android Atlas map surface.
- **Status:** Code fixed; local key and rebuilt-device check pending.
- **Expected / actual:** The map should either load from a configured Android key or remain on the safe Timeline path. The marker-free map surface instead crashed the development build with `IllegalStateException: API key not found` from Google Maps.
- **Evidence and impact:** Owner-provided Android development error screen. No private map, journey, or coordinate data was recorded.
- **Cause:** `react-native-maps` was linked but `app.json` supplied no `androidGoogleMapsApiKey`, leaving the required Android manifest metadata absent.
- **Correction:** Added `app.config.js`, which reads `ANDROID_GOOGLE_MAPS_API_KEY` only from ignored local environment configuration, passes it to the `react-native-maps` plugin during native build, and exposes only a boolean configured state to JavaScript. Atlas refuses to mount Google Maps on Android without that boolean.
- **Verification:** Focused Atlas suite passed 15 tests; mobile typecheck and lint passed; the no-key config check confirms no key value or undefined value is emitted. Full regression and a key-configured Android rebuild remain pending.
- **Prevention:** Treat a native service credential as a build prerequisite. Add a no-credential runtime gate and a key-free configuration check before rendering the native service.
- **Recurrence:** First occurrence.

## EP-032: Account recovery guidance assumed settings remained available while locked out

- **Date / task / area:** 2026-10-14; Google Cloud setup guidance.
- **Status:** Fixed; guidance corrected.
- **Expected / actual:** Advice to change a recovery phone should explain the access prerequisite. The initial guidance implied the owner could change recovery information after reaching Google's locked-out verification screen.
- **Evidence and impact:** Owner-provided Google verification screen and Google Account Help state that recovery information cannot be added while locked out or in the recovery process.
- **Cause:** The recovery-account constraint was not verified before giving the step.
- **Correction:** Direct owners to a device where the account is already signed in for recovery-phone changes; otherwise direct them to Google's account-recovery flow. Explain that a changed number can take up to seven days to become usable for sensitive verification.
- **Verification:** Google Account Help reviewed on 2026-10-14.
- **Prevention:** For identity, payment, or account-access guidance, verify the provider's current recovery and cooldown constraints before prescribing settings changes.
- **Recurrence:** First occurrence.

## EP-033: Tool-result assumption interrupted current Google Maps setup research

- **Date / task / area:** 2026-10-14; Google Maps Android setup guidance; web research tool.
- **Status:** Fixed; safeguard active.
- **Expected / actual:** Retrieve current official setup guidance before directing the owner through Cloud Console. The first research wrapper assumed a `content` array and failed with `TypeError: Cannot read properties of undefined (reading 'map')`.
- **Evidence and impact:** The failed tool invocation produced no user-visible setup result and did not change project files or Google Cloud resources.
- **Cause:** The wrapper accessed an unverified response shape rather than serializing the returned value first.
- **Correction:** Reran the official Google documentation search while serializing the complete result; confirmed the required SDK enablement and Android application/API restrictions.
- **Verification:** The retried search returned Google Maps SDK documentation and current billing guidance on 2026-10-14.
- **Prevention:** For any unfamiliar tool return value, serialize or inspect it before accessing nested fields; this reinforces EP-023.
- **Recurrence:** First occurrence.

## EP-034: MapLibre migration initially retained a stale fallback assertion and invalid palette token

- **Date / task / area:** 2026-10-14; Android Atlas map-provider replacement; mobile verification.
- **Status:** Fixed; regression active.
- **Expected / actual:** The MapLibre migration should render the mocked development map, preserve the explicit `mapAvailable={false}` fallback, and pass typecheck. The first focused test still expected a fallback after `mapAvailable` was restored, while the implementation correctly remounted the map. Typecheck also rejected `palette.ink`, which is not a defined design token.
- **Evidence and impact:** The approved focused run had 13 passing and 1 failing Atlas test; TypeScript reported `Property 'ink' does not exist` in the new circle-layer paint. No Android build or private data was changed.
- **Cause:** A prior native-map failure had made the test assert a permanently unavailable surface, and the new layer style used an unverified token name.
- **Correction:** Updated the assertion to require the remounted map and used the verified `palette.rainforest` stroke token. The map test also explicitly verifies that demo tiles are development-only.
- **Verification:** Rerun the focused Atlas suite, typecheck, and lint after the correction.
- **Recurrence (2026-10-18, vector basemap):** The first MapLibre v11 component used the obsolete `Camera.defaultSettings` prop and mobile typecheck rejected it before tests ran. The v11 declaration exposes `initialViewState`; the component now uses that typed prop. **Prevention:** Inspect the installed renderer declaration for component props before reusing examples from an older MapLibre API, then rerun typecheck before focused UI tests.
- **Recurrence (2026-10-18, vector basemap):** The first full mobile suite loaded the new native renderer through unrelated screen tests, and Jest could not parse its untransformed native module. Added a module-level React Native MapLibre test double in the existing Jest mapper; the focused Atlas test retains its explicit behavioral mock. **Prevention:** When adding a native-only dependency to a shared screen tree, run the complete suite and add a global test double before treating focused coverage as sufficient.
- **Prevention:** When a native-fallback condition changes, test its recovery transition; check palette exports before adding native-layer style values.
- **Recurrence:** First occurrence.

## EP-035: Noninteractive Expo Android command requested device and port input

- **Date / task / area:** 2026-10-14; MapLibre Android development build.
- **Status:** Fixed; device map check pending.
- **Expected / actual:** Build and install the MapLibre development client on the connected Android device. `expo run:android --device` stopped because it could not show its device picker; the serial-targeted retry encountered the already-running Metro server and requested permission to move to port 8082.
- **Evidence and impact:** Expo printed `Required input: Select a device/emulator`, then `Use port 8082 instead?`; the build still produced a fresh APK. No device installation is claimed from that incomplete noninteractive command.
- **Cause:** The command omitted the known Expo device serial and tried to start another bundler while the owner’s Metro server already occupied port 8081.
- **Correction:** Target serial `2211133G` and use Expo's no-bundler mode so it installs against the already-running Metro service without an interactive prompt.
- **Verification:** `npx expo run:android --device 2211133G --no-bundler` built successfully, installed `app-debug.apk`, and opened the development deep link on the device. The Atlas map surface still needs owner-visible validation.
- **Prevention:** Before invoking Expo from a noninteractive runner, pass the exact device identifier and determine whether Metro is already running; use `--no-bundler` when it is.
- **Recurrence:** First occurrence.

## EP-036: PowerShell validation command failed to parse at an interpolated colon

- **Date / task / area:** 2026-10-15; Atlas preview spec documentation check.
- **Status:** Fixed; document check passed.
- **Expected / actual:** Validate spec files and links. The first PowerShell command failed before running checks because `"$file:$line"` parsed the colon as part of a variable reference.
- **Evidence and impact:** PowerShell returned `Variable reference is not valid`; the root check and `git diff --check` independently passed. No project file was changed by the failed command.
- **Cause:** The validation script did not delimit the variable name adjacent to a colon in an expandable string.
- **Correction:** Use `${file}:$line` and rerun the same document validation.
- **Verification:** The corrected validation found all spec files and companion links with no trailing whitespace.
- **Prevention:** In PowerShell expandable diagnostic strings, use `${name}` or `$($name)` when punctuation immediately follows a variable.
- **Recurrence:** First occurrence.

## EP-037: Mixed-media spec update left one photo-only term

- **Date / task / area:** 2026-10-15; Atlas map journey preview spec update.
- **Status:** Fixed; terminology check passed.
- **Expected / actual:** After the owner included videos, every current contract file should describe a media viewer. The first update left “photo viewer” in one brownfield sentence.
- **Evidence and impact:** A targeted text search found the stale sentence in `brownfield.md`. It did not change app behavior, but could mislead implementation scope.
- **Cause:** The update covered the kernel, experience and acceptance sections but missed a companion sentence.
- **Correction:** Changed that sentence to “media viewer.”
- **Verification:** A repeat search across current spec files and project state found no obsolete photo-only viewer wording.
- **Prevention:** After a product decision changes a cross-file noun, search the kernel and every companion for the superseded terms before handing off.
- **Recurrence:** First occurrence.

## EP-003: Documentation patch used an unverified context line

- **Date / task / area:** 2026-10-13; creating this playbook; documentation editing.
- **Status:** Fixed.
- **Expected / actual:** Update project state; a patch incorrectly expected a line
  containing only `#` and failed context verification.
- **Evidence and impact:** `apply_patch` reported `Failed to find expected lines`;
  the requested project-state change was not applied by that attempt.
- **Cause:** The patch used a guessed heading instead of reading the actual header.
- **Correction:** Read the current header and patch the verified date line.
- **Verification:** Corrected patch applied successfully; final diff inspection
  checks the resulting documentation.
- **Prevention:** Read exact surrounding lines before constructing patches. After
  a failed multi-file patch, inspect affected files before retrying.
- **Recurrence:** 2026-10-13 M4.1 follow-up again used an unverified project-state context and the patch was rejected before any write. Read the exact tail, then applied the documented update against verified lines. On 2026-10-14, two combined pending-remap documentation patches used a stale final sentence from project state and were rejected before any files changed. Read the actual tail and apply the records as separate, verified patches. Later sparse Atlas diagnostics patching failed twice from guessed context; the exact files were reread and smaller hunks applied. A further combined Android map record patch missed the exact metadata-result paragraph and was rejected before changes. The exact sections were reread, then patched separately. A MapLibre project-state replacement also omitted a diff marker in a combined patch and was rejected before a write; split the verified section into separate hunks. Prevention strengthened: inspect target content immediately before every multi-file patch, then verify each changed hunk.

## EP-004: Wildcard path passed as a literal search root

- **Date / task / area:** 2026-10-13; M4.1 verification review; PowerShell search.
- **Status:** Fixed.
- **Expected / actual:** Search mobile tests for correction references; `rg` reported an invalid `apps/mobile/test*` path.
- **Evidence and impact:** The first command returned exit code 1 and an OS error 123 for that path; other search output was still available, but the test search needed repeating.
- **Cause:** A shell-style wildcard was passed as a path argument instead of using an existing directory with `rg --glob` filters.
- **Correction:** Re-ran the search under `apps/mobile/src` with `--glob '*.test.ts' --glob '*.test.tsx'`.
- **Verification:** The corrected command completed successfully and found only the journey-detail test references for this review surface.
- **Prevention:** On PowerShell, pass a verified directory to `rg` and use `--glob` to filter file names.
- **Recurrence:** 2026-10-13 M4.1 review agents also supplied guessed `apps/mobile/src/components/atlas*` and `apps/mobile/src/reveal/project.ts` paths to `rg`. Both failed before inspection; the valid module is `apps/mobile/src/reveal/projection.ts`. Verify a search root with `Test-Path` and locate modules with `rg --files` before narrowing the query.
  2026-10-14 dependency inspection repeated the same failure by passing `dist/fire-event*` as a literal Windows path. Search the containing directory with an `rg --glob` filter instead.
  2026-10-18 location-correction investigation again included a nonexistent flat M4.1 spec path and a literal `0006*` decision path. `rg` returned path errors before completing that portion of the search. Corrected by locating the nested spec and decision with `rg --files`; future searches must discover paths before adding them to a combined command.

## EP-005: Review read batch had a JavaScript syntax error

- **Date / task / area:** 2026-10-13; M4.1 acceptance audit; tool orchestration.
- **Status:** Fixed.
- **Expected / actual:** A batched read should return spec, patch, and context; the wrapper script failed parsing before any read ran.
- **Evidence and impact:** The tool reported `SyntaxError: missing ) after argument list`; no project content changed or review result was produced by that call.
- **Cause:** The `forEach` output wrapper omitted one closing parenthesis.
- **Correction:** Closed the call and reran the same read batch.
- **Verification:** The corrected batch returned all four requested read results.
- **Prevention:** Check parenthesis balance on batched tool wrappers before execution; use a simple result loop for review reads.
- **Recurrence:** A second review layer had a wrapper syntax error before reads.
  Both calls were corrected; use the same simple result loop for all layers.

## EP-006: M4.1 UI presents unsaved decisions as reviewed outcomes

- **Date / task / area:** 2026-10-13; M4.1 code review; correction flow.
- **Status:** Open.
- **Expected / actual:** Confirm/reject should save scoped owner decisions and
  survive restart/rebuild. The new buttons only update local state, while copy
  describes a recorded or rejected fact set.
- **Evidence and impact:** `journey-correction.tsx:36-45` has no save callback;
  `journey-detail.tsx:30-35` only closes a panel. Existing reconstruction code
  pauses history corrections. Owners can believe a decision was saved when it was not.
- **Cause:** The M4.1 patch implements a visual review shell without the durable
  correction contract and projection integration required by its story.
- **Correction:** Pending. Story review findings list the missing save, remap,
  editing, lifecycle, and verification work.
- **Verification:** `npm --prefix apps/mobile run typecheck` passes; lint fails on
  the new screen. No correction persistence test or device result was found.
- **Prevention:** Before presenting a correction as complete, require a successful
  repository save and reload from the committed projection. Cover restart/rescan,
  stale preview, and failure paths with tests. Keep the story in progress.
- **Recurrence:** None recorded.

## EP-007: Bracketed route path was read without literal-path semantics

- **Date / task / area:** 2026-10-13; M4.1 review; PowerShell file read.
- **Status:** Fixed.
- **Expected / actual:** Read the new `journey/[id]/correct.tsx` route; ordinary
  `Get-Content` treated `[id]` as a wildcard pattern and reported no matching path.
- **Evidence and impact:** The initial read returned exit code 1; the route was
  then read with `Get-Content -LiteralPath`.
- **Cause:** PowerShell wildcard interpretation of brackets in a path.
- **Correction:** Use `-LiteralPath` for bracketed Expo route files.
- **Verification:** The corrected read returned the route source and line numbers.
- **Prevention:** Use `-LiteralPath` by default for any file path containing `[]`.
- **Recurrence:** An independent reviewer also tried an unverified review
  reference directory and corrected it by locating the actual file under
  `.agents/skills/bmad-code-review/references/`. Before reading a skill reference,
  resolve its location from the active skill directory. On 2026-10-15, while
  planning the Atlas map journey preview, a combined `Get-Content` command again
  used ordinary paths for `journey/[id].tsx` and `journey/[id]/correct.tsx` and
  returned path-not-found errors. The corrective literal-path read succeeded.
  Prevention is strengthened: use `-LiteralPath` at command authoring time for
  every Expo route path containing brackets, including batched reads.

## EP-008: Parallel review writers duplicated a playbook ID

- **Date / task / area:** 2026-10-13; M4.1 review; shared playbook.
- **Status:** Fixed.
- **Expected / actual:** Each incident has one unique ID. The primary review and
  an independent reviewer both added `EP-005` to the index during the same task.
- **Evidence and impact:** Final index search showed two `EP-005` rows; incident
  lookup was ambiguous until corrected.
- **Cause:** Parallel agents edited the shared playbook without one assigned writer.
- **Correction:** Consolidated the same syntax failure under one EP-005 entry and
  removed the duplicate index row.
- **Verification:** Final index search checks that each ID occurs once there.
- **Prevention:** Review agents report incidents to the primary agent; only the
  primary agent assigns IDs and edits the shared playbook after reviewers finish.
- **Recurrence:** None recorded.

## EP-022: Playbook update targeted a generic recurrence line

- **Date / task / area:** 2026-10-14; M4.1b owner title and date claim audit; error playbook maintenance.
- **Status:** Fixed; safeguard active.
- **Expected / actual:** The new provider-contract recurrence needed to be appended to EP-021. A generic patch context instead replaced EP-006's recurrence, then a PowerShell search using a double-quoted backtick failed before inspection.
- **Evidence and impact:** No production code or test result was altered. The error record was briefly attached to the wrong incident and was corrected during the same task.
- **Cause:** The patch did not include the EP-021 heading as context, and PowerShell interpreted the backtick in the search text.
- **Correction:** Restored EP-006's recurrence, attached the provider-contract recurrence to EP-021, and used a single-quoted literal search pattern.
- **Verification:** Read both incident sections after the correction; the focused five-suite regression then passed 55 tests.
- **Prevention:** Patch playbook records with their heading and nearby unique text; use single quotes for PowerShell search patterns containing backticks.
- **Recurrence:** None recorded.

## EP-009: Temporary review diff was not visible in a later shell

- **Date / task / area:** 2026-10-13; M4.1 code review; diff handoff.
- **Status:** Fixed.
- **Expected / actual:** A diff written under one shell's `$env:TEMP` should be
  discoverable by the next review call; the later temp-directory lookup returned
  no matching file.
- **Evidence and impact:** Review agents could not be given a verified stable
  temp path from that lookup, delaying the parallel review.
- **Cause:** The sandbox supplied a call-specific temp path; persistence across
  tool calls was not established.
- **Correction:** Wrote the review diff to a verified workspace path, passed that
  absolute path to reviewers, and removed the file after the review.
- **Verification:** Every review layer read the shared diff and returned findings.
- **Prevention:** For multi-call review artifacts, verify the file from a second
  tool call before dispatch. Use a shared workspace path when temp isolation is
  observed, and remove only that known artifact after completion.
- **Recurrence:** 2026-10-14 during the M4.1a successor-identity audit: the required system-temp diff was again inaccessible from the next sandboxed shell. Strengthened safeguard: generate and read cross-call diff artifacts under the same approved execution boundary, then remove only the exact generated artifact after audit.

## EP-020: Optional sprint-status file was read without an existence check

- **Date / task / area:** 2026-10-13; M4.1 implementation; BMAD workflow setup.
- **Status:** Fixed.
- **Expected / actual:** Resolve the M4.1 sprint key if the workflow status file exists. A direct `Get-Content` call failed because `_bmad-output/implementation-artifacts/sprint-status.yaml` is absent.
- **Evidence and impact:** PowerShell reported that the path does not exist. No project data changed and the workflow's conditional rule means no sprint status synchronization is required.
- **Cause:** The optional-file condition was skipped before the read.
- **Correction:** Treated the story key as unavailable and continued through the explicit in-progress spec route.
- **Verification:** `Test-Path` is false for the expected status file; no synchronization command was attempted.
- **Prevention:** For optional BMAD artifacts, run `Test-Path` before `Get-Content` and only read when present.
- **Recurrence:** None recorded.

## Entry template

### EP-NNN: Short failure description

- **Date / task / area:**
- **Status:** Open, blocked, fixed, or retired.
- **Expected / actual:**
- **Evidence and impact:** Sanitized command result, file reference, or user correction.
- **Cause:** Verified cause, or explicitly unknown with investigation next step.
- **Correction:** What changed; remaining work if unresolved.
- **Verification:** Exact check and result; unverified limits.
- **Prevention:** Concrete action and trigger; executable safeguard where appropriate.
- **Recurrence:** Dates, evidence, and strengthened safeguard; none initially.

## EP-019: Spec context referenced a non-existent epics anchor

- **Date / task / area:** 2026-10-14; M4.1 successor identity repair; BMAD context loading.
- **Status:** Fixed.
- **Expected / actual:** The M4.1 spec context named `epics.md#story-m41-confirm-reject-and-edit-a-journey`, but that literal anchor is absent; the first targeted extraction stopped with `Story anchor not found`.
- **Evidence and impact:** `rg` located the authoritative section as `### Story M4.1: Confirm, reject and edit a journey` at line 282. No repository data changed and the section was then read directly.
- **Cause:** The context reference used a slug that does not match the document's rendered heading anchor.
- **Correction:** Located and loaded the named M4.1 section by its verified heading.
- **Verification:** The loaded section contains the M4.1 acceptance criteria and delivery status.
- **Prevention:** Before extracting a Markdown fragment from spec frontmatter, search and verify the literal anchor or its heading before treating it as a path.
- **Recurrence:** None recorded.

## EP-010: Sandboxed Jest could not resolve its temporary cache directory

- **Date / task / area:** 2026-10-13; M4.1 correction contract; focused mobile Jest.
- **Status:** Fixed.
- **Expected / actual:** The focused provider suite should run after type checking. In the sandbox, Jest stopped before test discovery with `EPERM` from `realpath` on the packaged temporary directory.
- **Evidence and impact:** `npm --prefix apps/mobile test -- --runInBand photo-access-provider` failed before executing tests; the code was not implicated.
- **Cause:** The sandbox denies the Windows package temporary directory that Jest uses for its cache path.
- **Correction:** Re-ran the unchanged focused command with the approved outside-sandbox execution boundary.
- **Verification:** Focused provider suite passed 7 tests.
- **Prevention:** When Jest reports this package-temp `EPERM`, record the environment failure and re-run the same narrow command outside the sandbox; do not change application code or suppress the cache behavior.
- **Recurrence:** 2026-10-13 review reran the six-suite correction command. The sandbox again failed before discovery with the same package-temp `EPERM`; the approved outside-sandbox run passed 45 tests.
  2026-10-13 M4.1 durable-reveal refresh regression again failed before discovery in the sandbox with the same package-temp `EPERM`; the unchanged approved outside-sandbox `photo-access-provider` suite passed 9 tests.
  2026-10-14 M4.1a successor-identity focused suite again failed before discovery at the same package-temp `EPERM`; rerun the identical local command outside the sandbox before evaluating the result.
  2026-10-14 M4.1b focused Jest again failed before discovery at the same package-temp `EPERM`; the approved outside-sandbox correction suite then passed.
  2026-10-14 M4.1c duplicate-family focused Jest again failed before discovery at the same package-temp `EPERM`; re-run the unchanged focused command outside the sandbox before evaluating the result.
  2026-10-14 MapLibre Atlas verification again failed before discovery at the same package-temp `EPERM`; rerun the unchanged focused command outside the sandbox before evaluating the actual test/typecheck result.
  2026-10-15 Atlas journey preview verification again failed before discovery while
  Jest renamed its transform cache under the sandbox package TEMP directory. The
  unchanged focused suite must be rerun outside the sandbox; no application-test
  conclusion may be drawn from this environment failure.
  2026-10-15 Atlas refinement focused Jest again failed before test discovery
  while renaming its transform-cache map under the sandbox package TEMP
  directory. Re-run the unchanged focused suite outside the sandbox before
  interpreting application behavior.
  2026-10-16 V1.1 trip-continuity focused Jest again failed before test discovery
  while renaming its transform-cache map under the sandbox package TEMP directory.
  Re-run the unchanged suite outside the sandbox before interpreting application
  behavior.

## EP-011: M4.1 correction tests emitted React act warnings

- **Date / task / area:** 2026-10-13; M4.1 implementation review; correction-screen Jest coverage.
- **Status:** Fixed; regression active.
- **Expected / actual:** Focused correction tests should exercise asynchronous state changes inside React `act`. The suite passed but emitted repeated `The current testing environment is not configured to support act(...)` errors from `JourneyCorrectionScreen` and the shared reduced-motion hook.
- **Evidence and impact:** The approved run of `npm --prefix apps/mobile test -- --runInBand journey-detail journey-correction-application journey-correction photo-access-provider import-repository reconciliation-repository` passed 45 tests while logging state updates at `journey-correction.tsx:20,35-39,49,52`. Those warnings can hide missing assertions or unobserved UI updates.
- **Cause:** The new test uses a renderer/runtime configuration that does not establish React's concurrent act environment and does not await every asynchronous effect/update.
- **Correction:** Added the direct, exact `test-renderer@1.2.0` development dependency required by React 19.2, then migrated correction tests to await RNTL v14's asynchronous `fireEvent` and `rerender` APIs rather than layering manual `act` calls.
- **Verification:** `npm --prefix apps/mobile test -- --runInBand journey-correction` passed 2 suites / 16 tests with no console diagnostics.
- **Prevention:** Treat console `act` errors in changed UI test suites as a review finding, even if Jest reports passing tests.
- **Recurrence:** 2026-10-13: adding `IS_REACT_ACT_ENVIRONMENT` in Jest setup did not suppress the React Native renderer warnings. The issue remains open; configure the renderer or explicitly await every transition rather than treating the global flag as a fix.
  2026-10-13 dependency inspection found `@testing-library/react-native@14.0.1` bringing `test-renderer@1.3.0`, whose nested `react-reconciler@0.34.0` declares React `^19.3.0`; the Expo SDK 57 app currently pins React 19.2.3. `npm ls` reports this invalid peer relationship. Do not change framework versions inside M4.1a; follow `docs/development/frameworks.md` for a compatible dependency update, then rerun the correction UI suite without console diagnostics.
  2026-10-14 the exact `test-renderer@1.2.0` pin and awaited v14 APIs removed the correction-suite diagnostics. Keep the renderer pin aligned with the React minor during future Expo upgrades.

## EP-023: Web research response was read as an unverified object

- **Date / task / area:** 2026-10-14; M4.1 verification tooling; dependency research.
- **Status:** Fixed; safeguard active.
- **Expected / actual:** The web-search wrapper should report research results. It assumed an object containing `content`, but the tool returned a string and the wrapper threw before exposing results.
- **Evidence and impact:** The first search output was not consumed; no project file or dependency changed.
- **Cause:** The wrapper did not inspect the tool return shape before accessing nested fields.
- **Correction:** Re-ran the same query by serializing the raw return value, then used the official RNTL migration guidance.
- **Verification:** The rerun identified the React 19.2 to `test-renderer@1.2` compatibility mapping, which the clean correction suite verified.
- **Prevention:** For unfamiliar tool results, print or serialize the raw value before reading nested properties.
- **Recurrence:** None recorded.

## EP-012: M4.1 schema-version assertions were stale after a migration

- **Date / task / area:** 2026-10-13; M4.1 correction migration; mobile Jest.
- **Status:** Fixed; regression active.
- **Expected / actual:** Adding schema v17 should keep migration tests aligned. The first focused run failed three `import-repository` assertions that still expected version 16.
- **Evidence and impact:** The suite reported `Expected ... 16; Received ... 17`; implementation typecheck and lint still passed.
- **Cause:** The migration constant changed without updating the repository's explicit version assertions.
- **Correction:** Updated the three assertions to expect schema version 17.
- **Verification:** The focused correction suite passed 43 tests after the assertion update; TypeScript and lint passed.
- **Prevention:** When adding a migration, search for the prior numeric schema version in repository tests before running the suite.
- **Recurrence:** None recorded.

## EP-013: Partial implementation was handed off as though the task could pause

- **Date / task / area:** 2026-10-13; M4.1 implementation completion; task control.
- **Status:** Fixed; active-task safeguard.
- **Expected / actual:** The user asked to complete the remaining story. After a partial correction-layer change, the task yielded with a progress update although substantial accepted work remained.
- **Evidence and impact:** User asked why work stopped. The atomic save/projection path and owner edit flows were still unfinished.
- **Cause:** I treated a passing narrow checkpoint as a natural stopping point instead of the user's completion request as the active objective.
- **Correction:** Resumed the active M4.1 implementation immediately and retain the story as in-progress until its acceptance work is complete.
- **Verification:** Before any later handoff, compare the implementation against every unchecked M4.1 task and acceptance scenario, then run the required checks.
- **Recurrence:** On 2026-10-15, the dispatched Atlas-preview implementer stopped at
  the dirty-tree gate even though the owner had explicitly approved work on that
  exact tree in the parent task. No files changed, but it delayed the requested
  implementation. When a delegated workflow inherits an already-authorized dirty
  tree, pass that authorization in the implementation handoff or continue from the
  approved parent rather than treating the tree as a new blocker.
- **Prevention:** When a user says complete/finish/continue, do not send a final response merely to report an intermediate milestone; keep working unless blocked by a required external decision.
- **Recurrence:** On 2026-10-14 sparse Atlas diagnostics, two rejected context patches were followed by a premature final answer, and the user had to ask why work stopped. Strengthened safeguard: after any patch rejection, keep the task active, inspect exact context, retry, run checks, and only then hand off.

## EP-014: Atomic projection return contract initially left test doubles stale

- **Date / task / area:** 2026-10-13; M4.1 atomic correction save; mobile typecheck.
- **Status:** Fixed.
- **Expected / actual:** Saving a correction now returns the graph written in the same transaction. Typecheck failed because provider test doubles still returned only a revision and state.
- **Evidence and impact:** `npm --prefix apps/mobile run typecheck` reported three missing `graph` properties in `photo-access-provider.test.tsx`; no application build was produced.
- **Cause:** The repository method's return contract changed without updating all typed fixture implementations.
- **Correction:** Added committed graph fixtures and changed the provider tests to assert that it publishes the committed graph without calling a second rebuild.
- **Verification:** Re-run mobile typecheck and the focused provider/repository suites.
- **Prevention:** When a typed repository result changes, search every injected repository fixture before declaring the refactor checked.
- **Recurrence:** None recorded.

## EP-015: Correction UI test attempted nested async act scopes

- **Date / task / area:** 2026-10-13; M4.1 correction UI verification.
- **Status:** Fixed.
- **Expected / actual:** Wrapping the test-library press helpers with additional async `act` calls should await state transitions. The focused test run instead reported overlapping `act` scopes and later cases could not render their preview controls.
- **Evidence and impact:** `npm --prefix apps/mobile test -- --runInBand journey-correction` failed three UI cases after React logged overlapping act calls.
- **Cause:** Testing Library already manages an act scope for its interaction and polling helpers; the nested calls conflicted with that scope.
- **Correction:** Kept the focused native-primitive mock and restored the library-managed interaction flow.
- **Verification:** Re-run the focused journey-correction suite and inspect both exit status and console output.
- **Prevention:** Do not wrap a Testing Library interaction in a second async `act` while an associated `waitFor` may still own an act scope; use one owner for each async transition.
- **Recurrence:** None recorded.

## EP-016: Focused primitive mock did not satisfy the native button type

- **Date / task / area:** 2026-10-13; M4.1 correction UI test isolation.
- **Status:** Fixed.
- **Expected / actual:** The lightweight UI primitive mock should preserve button children and props while allowing typecheck and lint. Its first type used the full `Pressable` children union, which includes a render callback and cannot always be nested in `Text`.
- **Evidence and impact:** `npm --prefix apps/mobile run typecheck` failed in `journey-correction.test.tsx:12`; lint also reported two forbidden CommonJS imports.
- **Cause:** The mock declared a production `Pressable` prop type even though the test only supplies node children, and it used raw `require` inside the Jest factory.
- **Correction:** Narrowed the mock input to node children and switched native loading to typed `jest.requireActual`.
- **Verification:** Re-run mobile typecheck, lint, and the focused correction suite.
- **Prevention:** Keep test-double prop types as small as their exercised contract, and use Jest's typed module loader inside mock factories.
- **Recurrence:** None recorded.

## EP-017: Combined repository patch targeted one file twice

- **Date / task / area:** 2026-10-13; M4.1 pre-grouping rejection constraints.
- **Status:** Fixed.
- **Expected / actual:** Apply the repository import, helper, and rebuild integration in one patch. The patch tool rejected it because two separate operations targeted the same file.
- **Evidence and impact:** `apply_patch` reported `multiple operations target ... repository.ts`; no source file changed in that failed attempt.
- **Cause:** The edit was divided into two file blocks instead of one consolidated block.
- **Correction:** Reissued the changes as a single repository patch followed by a dependent focused replacement.
- **Verification:** Run typecheck and focused reconstruction/correction suites.
- **Prevention:** For a repeated file in a patch, combine all hunks under one file header before applying.
- **Recurrence:** None recorded.

## EP-018: Lifecycle race fixture disconnected during rebuild instead of pre-commit

- **Date / task / area:** 2026-10-13; M4.1a correction lifecycle regression.
- **Status:** Fixed.
- **Expected / actual:** The new regression should disconnect the record at the final correction commit guard. Its initial lifecycle-read counter disconnected one read earlier, so the nested rebuild rejected with `Private record is not connected.` instead.
- **Evidence and impact:** Focused `reconciliation-repository` Jest run failed one test; no production behavior changed.
- **Cause:** The fixture omitted the lifecycle query performed while loading the selected journey detail.
- **Correction:** Moved the synthetic disconnect to the fifth lifecycle read, after detail load, save validation, and rebuild validation.
- **Verification:** Re-run the focused repository suite and assert rollback with no commit.
- **Prevention:** For lifecycle-race fixtures, enumerate every lifecycle read across setup, selection, save, rebuild, and commit before assigning deferred state changes.
- **Recurrence:** None recorded.

## EP-001: Synchronous state reset introduced a lint failure

- **Date / task / area:** 2026-10-13; M3.4 review fixes; journey detail.
- **Status:** Fixed; lint safeguard active.
- **Expected / actual:** Clear stale detail on selection change while passing mobile
  checks. Adding synchronous `setResult(null)` and `setError(null)` inside an effect
  failed `react-hooks/set-state-in-effect`.
- **Evidence and impact:** `npm --prefix apps/mobile run check` passed Jest and
  TypeScript, then failed lint in `apps/mobile/src/components/journey-detail.tsx`.
- **Cause:** The review patch reset render state synchronously inside an effect.
- **Correction:** Store the request's journey ID with its result/error and render
  state only when that ID matches the selected journey; retain async cancellation.
- **Verification:** Subsequent full mobile check passed 183 tests, TypeScript, and
  lint. Expo Doctor separately reported existing dependency drift (20/21).
  Physical lifecycle behavior remains unverified.
- **Prevention:** When changing async UI identity, check both stale-result handling
  and state ownership. Run lint after review patches, even when tests pass. Existing
  lint rule is the executable safeguard; do not suppress it to accept the patch.
- **Recurrence:** 2026-10-13 M4.1 durable-reveal refresh initially called a state-setting callback directly from an effect, and `expo lint` reported `react-hooks/set-state-in-effect`. The effect now keeps the guarded promise callback while the explicit save/retry path awaits the refresh. `npm --prefix apps/mobile run lint` then passed.

## EP-002: Deferred failure was rejected before its assertion observed it

- **Date / task / area:** 2026-10-13; M3.4; mounted photo-access provider test.
- **Status:** Fixed; regression active.
- **Expected / actual:** Lifecycle invalidation should reject pending detail/preview
  reads cleanly. A test revision that wrapped lifecycle operations in `act` produced
  unhandled rejection failures before the later rejection assertion ran.
- **Evidence and impact:** The intermediate provider test failed during stabilization;
  the final focused `photo-access-provider` run passed 7 tests without act warnings.
- **Cause:** The expected-rejection assertion was attached after releasing the
  deferred operation, allowing the rejection to become unhandled first.
- **Correction:** Attach `expect(pending).rejects...` before invalidation/release,
  perform lifecycle transitions inside awaited `act`, then await that assertion.
- **Verification:** Provider suite passed 7 tests; full mobile suite passed 183 tests.
- **Prevention:** For deferred rejection tests, attach the rejection observer before
  triggering failure. Keep mounted lifecycle regressions in
  `apps/mobile/src/components/__tests__/photo-access-provider.test.tsx`.
- **Recurrence:** None recorded.

## EP-021: Owner-claim test fixtures initially missed the remap projection inputs

- **Date / task / area:** 2026-10-14; M4.1b owner title and date claims; focused mobile Jest.
- **Status:** Fixed; regression active.
- **Expected / actual:** The new owner-claim repository test should reach the exact-successor application assertion. Its first fixture omitted the canonical evidence rows read during the nested rebuild, so remapping failed closed before the application write. The first UI assertions also pressed immediately after controlled-input changes, before the updated handler was committed.
- **Evidence and impact:** The approved focused run failed one repository test with `Journey correction needs owner remap.` and two correction-screen tests without rendering the owner-claim preview. No production behavior changed.
- **Cause:** The fixture did not model all rebuild queries, and the tests did not await React Native controlled-input updates before invoking the preview action.
- **Correction:** Added the canonical evidence rebuild row to the repository fixture and awaited each owner-input update and preview action through Testing Library's `act` boundary.
- **Verification:** `npm --prefix apps/mobile test -- --runInBand reconciliation-repository import-repository journey-correction-application journey-correction photo-access-provider` passed 55 tests; `npm --prefix apps/mobile run typecheck`, `npm --prefix apps/mobile run lint`, and root `npm run check` passed.
- **Prevention:** When testing a nested correction rebuild, enumerate its evidence and correction reads; after changing a controlled native input, await the rendered value before invoking a dependent action.
- **Recurrence:** 2026-10-14 audit exposed a second contract regression: the provider passed an explicit `undefined` claim argument for confirm and reject actions, changing the established five-argument adapter call. The focused provider suite caught it. Preserve the existing call shape for legacy actions and add the claim payload only for the `claim` action.

## EP-024: Membership correction interface change left focused fixtures incomplete

- **Date / task / area:** 2026-10-14; M4.1 memory membership corrections.
- **Status:** Fixed; regression active.
- **Expected / actual:** Adding `saveJourneyMemoryCorrection` and schema v21 should preserve all typed provider mocks and migration assertions. Mobile typecheck found three test repository doubles missing the new method; the first focused run also retained schema-v20 expectations and described a visit-supported but unassigned memory as having no visit support.
- **Evidence and impact:** `npm --prefix apps/mobile run typecheck` failed in `photo-access-provider.test.tsx`; the approved focused Jest run then failed four assertions. No production command or data changed.
- **Cause:** The new repository contract and schema version were not reflected in existing focused fixtures, and the memory wording conflated missing journey membership with missing visit support.
- **Correction:** Added the typed memory-save double, updated migration expectations to v21, and only use the no-visit-support text when a memory has neither membership nor visit support.
- **Verification:** Focused correction/provider/repository/migration Jest passed 5 suites / 56 tests; mobile typecheck and lint passed.
- **Prevention:** When extending a repository interface or schema version, run typecheck before Jest and update all contract mocks and version assertions; keep visit support and journey membership as separate display predicates.
- **Recurrence:** 2026-10-14 structural split added an opaque visit key to the owner-review contract; `journey-detail.test.tsx` still built a visit without that key and mobile typecheck caught the stale fixture. The added durable boundary column also shifted the claim revision test's positional SQL assertion; focused Jest caught it. The bounded merge-candidate query then exhausted a sequential repository mock and returned `undefined`; keep correction reads defensive and extend every sequential fixture for the new query. Update every typed fixture and positional persistence assertion when extending `JourneyDetail` or the correction revision schema. Pending-remap review then added two bounded SQLite reads after the existing journey-detail fixture's two sequential reads. The focused repository test failed with `TypeError: Cannot read properties of undefined (reading 'map')`. Treat repository list reads defensively as empty only in test/runtime adapters that return no list, and rerun the affected repository, provider, UI, migration, typecheck, and lint suites after extending the contract. The uncertain-memory loader then added another typed repository method and mobile typecheck found three provider doubles missing it. Add every new repository method to injected test doubles before running behavior tests.

## EP-025: Duplicate-family migration changed positional SQL fixture arguments

- **Date / task / area:** 2026-10-14; M4.1c verified duplicate-family identity; import repository fixture.
- **Status:** Fixed; regression active.
- **Expected / actual:** The schema-v27 import upsert test should include all private family tuple fields. Its assertion omitted the new `support_eligible` argument, so the focused suite failed while production SQL had the correct 16 arguments.
- **Evidence and impact:** The first focused duplicate-family run failed `import-repository.test.ts`; no production write or device data was affected.
- **Cause:** A positional mock assertion was not extended with the additive persistence column.
- **Correction:** Added the missing `null` expectation for both source-index and canonical-evidence upserts.
- **Verification:** Focused duplicate-family suite passed 5 suites / 84 tests; full mobile Jest passed 28 suites / 223 tests; typecheck and lint passed.
- **Prevention:** For each additive persisted field, count parameters in every SQL fixture assertion and run the focused migration/import suite before the full suite.
- **Recurrence:** 2026-10-14 review-fix run raised the schema to v28 and added explicit adapter null fields. The first focused run retained v26 expectations and exact candidate-object fixtures, failing six assertions before any production behavior ran. Updated the migration assertions and adapter fixtures; the two edited repository suites then passed 34 tests. Count both schema versions and normalized adapter fields when extending this contract.

## EP-038: Atlas test loaded an unmocked Expo Video native module

- **Date / task / area:** 2026-10-15; Atlas map journey preview; Jest.
- **Status:** Fixed; regression active.
- **Expected / actual:** The Atlas component test should load the new mixed-media viewer in Jest. The first outside-sandbox focused run failed during module initialization because `expo-video` accessed an unavailable native prototype.
- **Cause:** The existing Atlas suite mocked MapLibre but not the newly imported Expo Video runtime.
- **Correction:** Added a minimal `expo-video` mock with muted-player and pause/play behavior before importing Atlas.
- **Verification:** Rerun the focused Atlas and journey-detail suites after the mock.
- **Prevention:** When a UI component newly imports a native Expo module, add its test-runtime mock in every directly importing component suite before the first focused run.
- **Recurrence:** 2026-10-15: `photo-access-provider.test.tsx` imports `EmptyAtlasScreen`, which reaches the same viewer transitively. Its focused run failed with the same unavailable native prototype until it received the equivalent focused `expo-video` mock.

## EP-040: BMAD render workflow step paths were assumed incorrectly

- **Date / task / area:** 2026-10-15; Atlas map and journey-list refinement; BMAD build workflow.
- **Status:** Fixed.
- **Expected / actual:** Read the rendered review and finish guidance before implementation review. The first command assumed a nested `steps` directory and failed because this rendered workflow stores `step-04-review.md` and `step-05-present.md` at its root.
- **Evidence and impact:** PowerShell reported that both requested paths did not exist; no project source changed.
- **Cause:** The workflow layout was inferred instead of enumerated after rendering.
- **Correction:** Listed the rendered directory, then used the confirmed root-level step filenames.
- **Verification:** The directory listing shows both files at the rendered workflow root.
- **Prevention:** After rendering a BMAD workflow, enumerate its output once before addressing optional step files.

## EP-017 recurrence: Gallery replacement targeted one file twice

- **Date / task / area:** 2026-10-15; Atlas paged gallery implementation.
- **Status:** Fixed.
- **Expected / actual:** Replace the legacy inline gallery with the paged item hierarchy in one patch. The first attempt used both delete and add operations for the same path, so `apply_patch` rejected it before modifying source.
- **Evidence and impact:** `apply_patch` reported `multiple operations target ... journey-media-viewer.tsx`; no source changed.
- **Cause:** The replacement used separate delete/add operations rather than one update block.
- **Correction:** Reissued the replacement as a single update operation.
- **Verification:** Run mobile typecheck and the focused Atlas/media tests after the update.
- **Prevention:** For full-file replacement, use one update block or one add/delete pair only when the tool accepts distinct paths.

## EP-024 recurrence: Paged-media repository contract left provider fixtures incomplete

- **Date / task / area:** 2026-10-15; Atlas gallery paging; mobile typecheck.
- **Status:** Fixed.
- **Expected / actual:** Adding the current-projection `loadJourneyMediaPage` repository method should preserve typed provider test doubles. TypeScript found three injected repository fixtures without it; the preview state also omitted the newly passed snapshot token.
- **Evidence and impact:** `npm --prefix apps/mobile run typecheck` failed in `photo-access-provider.test.tsx` and `atlas-reveal.tsx`; no runtime build was produced.
- **Cause:** The additive repository API and local preview-state type were extended without updating every typed consumer.
- **Correction:** Add a harmless synthetic page reader to each repository double and retain the optional snapshot token with loaded previews.
- **Verification:** Re-run mobile typecheck, focused provider/Atlas tests, lint, and repository checks.
- **Prevention:** Apply EP-024's interface-fixture sweep and typecheck immediately whenever a repository API is extended.

## EP-001 recurrence: Gallery effect synchronously reset React state

- **Date / task / area:** 2026-10-15; Atlas paged media gallery; Expo lint.
- **Status:** Fixed.
- **Expected / actual:** Changing a gallery page should clear stale UI without violating the React effect rule. The first implementation called three state setters synchronously in its page-loading effect, and lint rejected it.
- **Evidence and impact:** `npm --prefix apps/mobile run lint` failed at `journey-media-viewer.tsx:28`; the root repository check still passed independently.
- **Cause:** The page-change reset was modeled as an effect-side state transition instead of an event or async-result transition.
- **Correction:** Move reset behavior to page navigation actions and guarded asynchronous page completion.
- **Verification:** Re-run lint, focused gallery/Atlas tests, typecheck, root check, and diff check.
- **Prevention:** Follow EP-001: never synchronously reset render state in an effect; bind resets to user events or the asynchronous request result.

## EP-042: Review diff was written to a sandbox-private temporary directory

- **Date / task / area:** 2026-10-15; Atlas refinement BMAD review.
- **Status:** Fixed.
- **Expected / actual:** Independent review agents should read the unified diff. The first review file used this session's sandbox-private Temp path, which does not exist in separate reviewer sessions.
- **Evidence and impact:** All three review layers reported the supplied diff path unreadable and performed no content analysis.
- **Cause:** The system temporary directory is isolated per agent despite being available to the parent shell.
- **Correction:** Regenerate the review-only diff beneath the shared workspace implementation-artifacts directory, then re-run every review layer.
- **Verification:** Each reviewer receives the same workspace-visible diff path before triage.
- **Prevention:** For multi-agent review, place transient review files in the shared workspace, not a sandbox-private Temp directory.
- **Recurrence (2026-10-17, Atlas Obsidian Horizon diff audit):** The workflow-required diff was created in the invoking sandbox's Temp directory and was unreadable in the next shell. No source changed and no audit conclusion was drawn from that inaccessible file. **Correction:** Regenerate the audit diff under the shared implementation-artifacts directory before reading it. **Prevention strengthened:** Treat any Temp path as single-call scoped unless a second shell has already read it; use a verified workspace path for cross-call artifacts.

## EP-043: Gallery loader identity could trigger an endless page reload

- **Date / task / area:** 2026-10-15; Atlas paged media gallery; manual review after reviewer service exhaustion.
- **Status:** Fixed.
- **Expected / actual:** A selected gallery page should read once per page transition. Atlas passed an inline loader closure, so the viewer effect treated the callback as changed after every page result and could reload the same page repeatedly.
- **Evidence and impact:** Source inspection found the effect depended on `loadPage`, while a result state update re-rendered the parent and recreated that closure. This could cause repeated local reads and UI churn on a device.
- **Cause:** Async data identity was coupled to a render-created callback instead of the explicit page state.
- **Correction:** Store the latest loader in a ref and drive the request effect only from the page index.
- **Verification:** Re-run typecheck, focused tests, lint, root check, and diff check.
- **Prevention:** For a page-fetching effect, make the request identity explicit and do not depend directly on inline callback props.

## EP-044: New Atlas overlap test used a non-existent test-instance method

- **Date / task / area:** 2026-10-15; Atlas interaction review regression.
- **Status:** Fixed.
- **Expected / actual:** The new overlap chooser test should select the first of two identically labelled choices. It used Array's `.at()` on the single `getByRole` result, so TypeScript and Jest rejected it.
- **Evidence and impact:** Mobile typecheck reported `Property 'at' does not exist on type 'TestInstance'`; the focused Atlas suite reported multiple matching buttons.
- **Cause:** The test did not request the matching instances as an array.
- **Correction:** Use `getAllByRole(...)[0]`.
- **Verification:** Re-run focused Atlas tests, mobile typecheck/lint, then broader required checks.
- **Prevention:** Use `getAllBy*` for intentionally duplicated accessible names and select by an explicit array index.

## EP-045: Full mobile check exposed stale Atlas and native-preview fixtures

- **Date / task / area:** 2026-10-15; Atlas refinement integration verification.
- **Status:** Fixed.
- **Expected / actual:** The complete mobile check should pass after the Atlas UI and mixed-media adapter changes. It found two owner-flow assertions for the retired restricted heading, one indirect Expo Video import without a mock, and an adapter fixture that lacked `getMediaType` and expected the previous preview shape.
- **Evidence and impact:** `npm --prefix apps/mobile run check` initially failed 3 suites / 3 tests while 231 tests passed; source behavior was not established as broken.
- **Cause:** Focused Atlas tests did not cover every transitive screen import or legacy native-adapter fixture.
- **Correction:** Update accepted screen assertions, add the native Video mock to the indirect suite, and model media type plus the explicit preview kind in the adapter test.
- **Verification:** Re-run the full mobile check, root check, and diff check.
- **Prevention:** After a UI component imports a native module or extends an adapter output, run the full mobile check before claiming completion.

## EP-046: Device check assumed Android Debug Bridge was on PATH

- **Date / task / area:** 2026-10-15; Atlas native rebuild and device validation.
- **Status:** Fixed.
- **Expected / actual:** Inspect the connected Android device before rebuilding. PowerShell could not resolve `adb`.
- **Evidence and impact:** `adb devices -l` returned `The term 'adb' is not recognized`; no device state was changed.
- **Cause:** Unknown; the Android SDK platform-tools directory is not available on this shell PATH.
- **Correction:** Use the installed SDK platform-tools executable at `C:\\Users\\vothi\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe`; use Expo's model-name selector only for its native build command.
- **Verification:** The executable enumerated one connected Android device and the rebuilt debug application installed and launched. No device identifier is retained here.
- **Prevention:** Discover Android tooling from the active Expo/Android SDK configuration before issuing device commands.

## EP-047: npm prefix execution did not resolve the mobile Expo installation

- **Date / task / area:** 2026-10-15; Android Atlas rebuild.
- **Status:** Fixed.
- **Expected / actual:** Build the mobile workspace through its installed Expo CLI. `npm --prefix apps/mobile exec expo` instead invoked a context that reported Expo absent.
- **Evidence and impact:** Expo returned `Cannot determine the project's Expo SDK version because the module expo is not installed`; no Android build or device install occurred.
- **Cause:** The prefix form did not establish the package workspace as Expo's project directory for this CLI invocation.
- **Correction:** Invoke the existing local Expo CLI from the `apps/mobile` working directory.
- **Verification:** The subsequent command must identify the installed SDK before Gradle begins.
- **Prevention:** For Expo native commands, set the package working directory directly rather than relying on npm prefix execution.
- **Recurrence:** The local CLI then required a device name rather than Android Debug Bridge's serial. The serial is usable for ADB installation but not Expo's `--device` selector; use the model name surfaced by the connected-device query.

## EP-048: Android background maintenance hit a nested SQLite transaction

- **Date / task / area:** 2026-10-15; rebuilt Android Atlas device validation; maintenance task.
- **Status:** Mitigated in code; scheduled-task completion observation pending.
- **Expected / actual:** The rebuilt app should load Atlas while background maintenance remains recoverable. Android Metro logs reported `travel-life-library-maintenance-v1` failed because SQLite `cannot start a transaction within a transaction`.
- **Evidence and impact:** The current native device loaded the JavaScript bundle, then the registered maintenance task emitted the database error. No raw media, coordinates, identifiers, or screenshots were retained. Atlas gesture/gallery/correction device checks are not yet a pass.
- **Cause:** Confirmed. The OS-invoked task and foreground providers create separate repository objects for the same Expo SQLite database. Expo can reuse their native connection, so two explicit `BEGIN IMMEDIATE TRANSACTION` calls interleaved and the second became a nested transaction.
- **Correction:** Added a shared JavaScript transaction gate that serializes explicit SQLite transactions across native import and reconstruction repository wrappers, including schema migration.
- **Verification:** The new two-wrapper transaction regression passed. Full mobile check passed 29 suites / 238 tests. A rebuilt debug APK installed on the connected Android device, registered the maintenance task, loaded the Atlas route and initialized MapLibre without a nested-transaction, fatal, React Native, MapLibre-marker, or bundle-load error in filtered native logs. The app-owned Android job was then forced once through JobScheduler and logged `Executing task 'travel-life-library-maintenance-v1'`; it remained active through the bounded observation window with no transaction, React Native, or fatal error. Completion was not observed, so the incident cannot close yet.
- **Prevention:** Added a regression that uses two wrappers around the same native database double and proves the second transaction waits until the first commits. Preserve that test and observe an OS-scheduled maintenance completion before closing this incident.

## EP-049: Sandbox Jest transform cache denied an atomic rename

- **Date / task / area:** 2026-10-15; Android maintenance fix verification; Jest in sandbox.
- **Status:** Fixed.
- **Expected / actual:** Focused Jest suites should execute the new transaction regression. Jest failed before loading any test because its sandbox-private Temp transform cache rejected an atomic `.map` rename with `EPERM`.
- **Evidence and impact:** Four selected suites reported zero executed tests; mobile typecheck and lint passed. No product code or device data was affected by the failed cache write.
- **Cause:** The active sandbox Temp directory blocks Jest's atomic transform-cache write; `--no-cache` did not avoid this transform-cache path.
- **Correction:** Run the same local verification outside that sandbox cache boundary, then retain the focused and full results.
- **Verification:** Outside the sandbox, the focused regression and affected repositories passed 4 suites / 41 tests; the full mobile check passed 29 suites / 238 tests.
- **Prevention:** When a sandboxed Jest run reports an atomic Temp-cache rename failure before test execution, record it and use an approved local execution context instead of interpreting it as a code-test failure.
- **Recurrence:** 2026-10-16 V1.1 focused reconstruction, repository, migration, and Atlas verification again failed before test loading with the same sandbox-private Temp transform-cache `EPERM` rename. The required retry is the identical command outside the sandbox; zero executed tests are not evidence about the implementation.

## EP-050: Android development client became unresponsive during maintenance validation

- **Date / task / area:** 2026-10-15; Android Atlas maintenance device validation; development client lifecycle.
- **Status:** Open.
- **Expected / actual:** The freshly rebuilt app should remain responsive while the forced maintenance job runs. The owner reported that the app stopped responding after the job was started.
- **Evidence and impact:** The forced Android job was still reported active during the bounded observation window. No private screen content or media was captured. Atlas interaction validation cannot continue until the client is responsive.
- **Recurrence:** The owner ran the supplied refresh script and every ADB command returned `no devices/emulators found`. The script reached the device-control phase successfully, but the physical device was disconnected, offline, or not authorized in the active ADB server.
- **Recurrence:** After the Android photo-resolver repair passed checks, the device disconnected again before the JavaScript bundle reload. Every ADB tunnel, force-stop, and launch command returned `no devices/emulators found`; no device state changed and the verified bundle has not yet reached the physical client.
- **Recurrence:** After the owner reported reconnecting, ADB still listed no devices. Restarting the local ADB daemon completed successfully but did not discover a device, confirming that the remaining blocker is USB connection mode, cable/data path, or handset authorization rather than the local ADB server.
- **Cause:** Unknown. The active maintenance job may be consuming or blocking the development runtime, but no causal device trace has been collected.
- **Correction:** Provide a recoverable development-client refresh procedure: first reconnect and authorize the physical device so `adb devices` shows it as `device`, then restore the ADB Metro tunnel, force-stop the package, and relaunch the current local bundle.
- **Verification:** Pending `adb devices` showing one authorized device and owner confirmation that the refreshed client responds; then inspect filtered logs and determine whether maintenance completion or cancellation is involved.
- **Prevention:** During device validation, avoid forcing an unrestricted full-library maintenance job while simultaneously conducting interactive Atlas checks; validate scheduler work separately with a bounded test library where possible.

## EP-051: Device screenshot shows Atlas without a visible map surface

- **Date / task / area:** 2026-10-15; Android Atlas visual validation; MapLibre presentation.
- **Status:** Mitigated in code; physical device rerun pending.
- **Expected / actual:** Atlas should lead with a generous visible MapLibre surface, with the selected journey card overlaying it. The owner-provided device photo shows the selected journey card and journey list, but no visible map surface between the header and the card.
- **Evidence and impact:** The card, media entry, correction action, and list render, so the JavaScript screen is responsive. The owner photo also contains fixed vertical panel lines; those are treated as device-display artifacts rather than application rendering until reproduced in a device screenshot. No private image data, media identifiers, or precise location data is retained in this entry.
- **Cause:** Confirmed. `projectReveal` truthfully reports `processing` while reconciliation runs, but `AtlasReveal` mounted its MapLibre surface and Map/Timeline/filter controls only for `ready`. The previous durable journey projection and selected fallback card could still render, which exactly produced the owner-visible no-map composition.
- **Correction:** Permit a non-empty durable projection to remain explorable in `processing` while retaining its not-final warning and unavailable Replay state. Use a texture-backed Android MapLibre view for overlay composition, stop feature presses from bubbling to the map-level empty press, and turn a native style-load failure into the existing Timeline fallback.
- **Verification:** Focused Atlas suite passed 18 tests, including processing-map visibility, texture-map configuration, style failure fallback, and source-press propagation. The full mobile check passed 29 suites / 240 tests; typecheck, lint, root framework/eval checks, and whitespace validation passed. A fresh debug APK installed on the connected Android device, loaded the texture-backed MapLibre manager, and opened the Atlas route without a React Native, marker, SQLite, or bundle-load error in filtered native logs. The visual composition and interaction confirmation remains owner-performed.
- **Prevention:** Keep a device-level visual check for the native map's rendered surface; mocked MapLibre component tests do not establish native layout or tile rendering. Preserve the processing-state regression so a durable map is not hidden merely because an incremental reconciliation is active.

## EP-052: Native-map investigation assumed a non-existent local wrapper path

- **Date / task / area:** 2026-10-15; Atlas processing-map diagnosis; repository inspection.
- **Status:** Fixed.
- **Expected / actual:** Inspect the local MapLibre wrapper before diagnosing the device photo. The command requested `apps/mobile/src/atlas/native-map.tsx`, but that file does not exist; MapLibre integration is directly in `components/atlas-reveal.tsx`.
- **Evidence and impact:** PowerShell returned a path-not-found error. No source or device state changed.
- **Cause:** Inferred a wrapper filename instead of listing the existing Atlas directory first.
- **Correction:** Inspected the actual `atlas-reveal.tsx`, installed MapLibre declarations, reveal projection, and native photo evidence.
- **Verification:** The exact processing-state gate was identified and covered by a focused regression.
- **Prevention:** When tracing a UI integration, enumerate its containing feature directory before assuming a wrapper filename.
- **Recurrence (2026-10-16, V1.1 implementation):** A read command guessed a new `types-v1-1.ts` file although V1.1 types were deliberately added to the existing `reconstruction/types.ts`; PowerShell reported path-not-found. No source changed. Prevention reinforced: after an additive implementation, use `rg --files` to discover the created path before a direct read.
- **Recurrence (2026-10-16, engine planning):** A repository inventory included `rg --files packages` without checking that the directory existed. It returned a path-not-found error; subsequent inspection used enumerated `apps/mobile/src` paths. No source or device state changed. Strengthen inventory preflight by using root `rg --files` or `Test-Path` before a guessed directory.
- **Recurrence (2026-10-16, complete engine contract):** A native-source read guessed `ExifExtractor.swift`, which is absent. Enumerating the installed package found the implementation in `Asset.swift` and `UriExtractor.swift`; reads then verified its network-enabled EXIF path. The earlier filename preflight was not applied. Stronger prevention: enumerate the exact source directory and copy an observed path into reads; a plausible implementation class name is never path evidence.

## EP-059: Engine proposal stopped before resolving implementation policy

- **Date / task / area:** 2026-10-16; Trip Detection V1.1 party planning/readiness.
- **Status:** Planning corrected; engine remains unimplemented and quality unmeasured.
- **Expected / actual:** The owner wanted a sound complete plan. The first proposal deferred classification, session/base/routine predicates and native fallbacks to a future spike; the handoff overstated completeness. The owner then rejected the half-finished result.
- **Cause:** Architectural direction was treated as sufficient delivery while load-bearing choices remained open. The earlier claim that source examples were internally coherent overlooked case6: one place/one session cannot satisfy independent location corroboration although its expected suggestion score is45.
- **Correction:** Derived a canonical BMAD contract with exact rules, selected score/profile policy, native fallback bridge, generation/correction/query/migration behavior, 64 acceptance cases and explicit source-policy differences. Case6 retains SUGGESTED with corroboration-pending and stays off the primary map. The earlier exploratory proposal points to the complete contract.
- **Verification:** Coherence/source-preservation pass, document link/ID/arithmetic checks and root foundation checks validate planning consistency; none proves implemented engine behavior or product precision. The official Apple documentation fetch was unavailable; installed Expo native code supplied the directly inspected network-policy evidence instead. No unresolved behavior was silently converted into a passing result.
- **Prevention:** Before calling a plan implementation-ready, require an expected output for each source fixture, exact predicates for every load-bearing adjective, explicit capability/fallback per platform, and source-difference/migration matrices. Distinguish design readiness, code verification and measured product quality in the handoff.

## EP-058: Internal inferred drafts appear as the primary travel record

- **Date / task / area:** 2026-10-16; owner-reported trip quality and review burden; reconstruction/Atlas.
- **Status:** Open; improvement planned, application behavior unchanged.
- **Expected / actual:** The owner wants recognizable automatically detected trips with rare correction. The current UI exposes many inferred journeys and does not meet that expectation.
- **Evidence / cause:** `reconstructV1` seeds journeys from unblocked eligible visits without base-distance/photo-count/routine qualification; `loadDurableReveal` reads all journeys in the completed run; `projectReveal` renders them as Inferred. Native normalization also lacks reliable source/offset/duplicate signals needed by stricter gates. These are confirmed code paths; the number and specific causes of private false trips remain unmeasured. This predates the current planning task.
- **Next action:** Follow the engine improvement proposal: establish the baseline/native metadata contract, implement temporal context and episode qualification, preserve corrections, and publish one qualified projection to Atlas/counts/replay. Compare locally in shadow before approved legacy switching.
- **Verification:** Read-only code inspection supports the described pipeline gaps. No engine fix, private-library evaluation or device quality result has occurred.
- **Prevention:** Regression-test draft exclusion at the repository boundary, eligible-trip recall, false split/merge cases and owner actions per library; high precision from an empty map must not pass the product gate.

## EP-053: Repository verification command ran from the mobile package directory

- **Date / task / area:** 2026-10-15; Atlas processing-map repair; verification.
- **Status:** Fixed.
- **Expected / actual:** Run the root foundation check after the mobile check. The combined command remained in `apps/mobile`, so its final `npm run check` repeated the mobile check instead of running the root project script.
- **Evidence and impact:** The mobile check ran successfully twice; the root framework/eval suite had not yet run. No source or device state changed.
- **Cause:** The command combined package-local and root verification without changing the working directory.
- **Correction:** Run the root `npm run check` separately from the project root.
- **Verification:** The separate root invocation passed framework integrity, 20 foundation tests, and the evaluation smoke check; whitespace validation also passed.
- **Prevention:** Keep package-local and root verification as distinct commands whenever their scripts share a name.

## EP-054: Atlas map gestures competed with the enclosing screen scroll surface

- **Date / task / area:** 2026-10-15; Android Atlas native interaction.
- **Status:** Mitigated in code; physical device rerun pending.
- **Expected / actual:** The visible Atlas map should pan, zoom, and select a coarse journey point directly. The owner confirmed the repaired map appears, but reported unsmooth zoom/pan and that journey points did not open the preview.
- **Cause:** Confirmed structural interaction risk: the native map is embedded in the app's vertical `ScrollView`, which can claim one-finger drags. The previous point source also relied on the library default hitbox, too small for dense coarse anchors.
- **Correction:** Lock the enclosing screen scroll from the native map's touch and region lifecycle, explicitly enable native pan/pinch/double-tap gestures at the device frame target, and enlarge the source hitbox without changing anchor precision or data. A first implementation attempt used `View` touch-capture props unavailable in this React Native version; TypeScript rejected it before a build and the handoff was moved to the supported map lifecycle.
- **Verification:** Focused Atlas gesture and source-selection coverage passed 19 tests. The complete mobile check passed 29 suites / 241 tests with TypeScript and lint; root framework, foundation, evaluation-smoke, and whitespace checks passed. The existing Android development client was restarted against the local bundle and Atlas opened with no filtered fatal, React Native, marker, SQLite-lock, or bundle-load error. Owner visual interaction confirmation remains required; mocked events and clean logs do not establish physical MapLibre gesture arbitration.
- **Prevention:** For a native interactive surface in a scrolling React Native screen, provide explicit gesture ownership and a device-level pan/zoom/point-selection check rather than inferring touch behavior from component tests.
- **Recurrence:** The first combined regression run exposed overlapping React test `act()` scopes after the new touch event test, which made two later asynchronous preview tests appear unable to find their initial rows. The isolated tests passed, confirming cross-test cleanup rather than an owner-flow regression; await each state-changing native touch dispatch before continuing the assertion sequence.

## EP-055: Android development client could not load after Metro stopped

- **Date / task / area:** 2026-10-15; Android Atlas interaction validation; development server lifecycle.
- **Status:** Recovered; owner launch confirmation pending.
- **Expected / actual:** The installed development client should load the current local bundle after the interaction repair. The owner reported that the app could no longer load.
- **Evidence and cause:** The connected Android device and application process were present, but the local host was not listening on Metro port 8081. This is a development-server lifecycle failure, not evidence of a native or Atlas rendering crash.
- **Correction:** Restarted Expo Metro in development-client mode, verified port 8081 was reachable, restored the ADB reverse tunnel, force-stopped the development client, and reopened the Atlas route.
- **Verification:** Android activity launch returned `Status: ok`; Metro remained reachable after relaunch, and an app-process-only log check found no fatal, React Native, bundle-load, marker, or SQLite-lock error. A broad device log initially included an unrelated Google Videos SQLite warning, so it was excluded rather than attributed to Travel Life. The owner must confirm the now-open app renders; do not infer an interactive success from activity launch alone.
- **Prevention:** Before diagnosing a development-client launch as an app regression, verify both `adb devices` and the active Metro listener; keep Metro running for the duration of physical-device validation.

## EP-056: Atlas media UI exposed labels but no visible photo previews

- **Date / task / area:** 2026-10-15; Atlas journey preview and gallery.
- **Status:** Fixed in code; device verification pending.
- **Expected / actual:** A selected journey with an accessible associated photo should show that real local photo in the map card, and the gallery should begin with bounded photo thumbnails. The owner reported that no photos were visible; source inspection confirmed the card and gallery only rendered text actions, although the local resolver had supplied preview URIs.
- **Cause:** The first media-viewer implementation wired local preview resolution to full-screen item selection but omitted the card preview and gallery-thumbnail renderers required by the approved interaction contract. The subsequent Android gallery revealed a second cause: the resolver called Expo Media Library's iOS-only `getIsInCloud()` API unconditionally. It throws on Android, and the catch converted every local asset into an unavailable slot. The next physical screenshot showed that existing Android imports also retain `unknown` availability; the gallery incorrectly replaced those safe-to-check local references with `null` before the resolver could try them.
- **Correction:** Render the first available associated local photo in the selected card and bounded local photo thumbnails in the gallery, retaining placeholders for video/unavailable items and the no-download behavior. Only query iCloud availability on iOS; Android resolves its permitted local URI directly. Let the adapter resolve a bounded `unknown` source reference under current permission; only a confirmed unavailable source is withheld.
- **Verification:** Focused Atlas and Android resolver coverage passed 51 tests, including the selected-card preview, bounded gallery thumbnail, Android iCloud-API exclusion assertion, and a repository regression proving an `unknown` source remains eligible for bounded local resolution. The full mobile suite passed 29 suites / 243 tests with TypeScript and cache-free Expo lint; root `npm run check` and `git diff --check` also passed. Expo Doctor remains 20/21 because of the pre-existing nine Expo SDK patch-version recommendations. The corrected JavaScript bundle was relaunched on the authorized Android development client, with no fatal, React Native, bundle-load, marker, or SQLite-lock error in the privacy-filtered application-process startup log. Owner visual gallery confirmation remains required; do not claim that any particular private photo is accessible until the owner verifies it on device.
- **Prevention:** Map every explicitly required visual media state in the spec to a rendered component and a UI assertion, not only to a repository resolver.
- **Recurrence:** The first patch omitted one closing parenthesis in the gallery's previous-page callback. Jest, TypeScript, and lint rejected the parse error before any application build or device load; the callback was corrected before rerunning the checks.
- **Recurrence:** Expo lint then reported the already-corrected former parse position while focused Jest and TypeScript passed. A first direct-lint probe compounded diagnosis by repeating the package path from within `apps/mobile` and placing ESLint's cache flag where npm consumed it. Use the package-local `src/...` path and invoke ESLint directly with `--no-cache` before treating this as a current source parse failure.
- **Recurrence:** The Android resolver regression initially tried to spy on `Platform.OS` as a getter, but React Native exposes it as a value property. Jest rejected the spy before executing the assertion; use a scoped, restorable property descriptor override instead.

## EP-057: Archived review patches failed the repository whitespace gate

- **Date / task / area:** 2026-10-16; all-worktree Git commit.
- **Status:** Corrected before commit.
- **Expected / actual:** The complete requested staged change set should pass `git diff --check`. Two archived review-patch artifacts faithfully contained blank added lines with trailing spaces, so Git interpreted the evidence files themselves as whitespace defects. Three text artifacts also ended with an extra blank line.
- **Cause:** Raw nested Git patches were saved as `.diff` artifacts without an attribute declaring their preserved patch whitespace intentional; the staging preflight therefore applied normal source-file whitespace policy to their contents.
- **Correction:** Preserve the review-patch bytes while marking `*.diff` as exempt from blank-line whitespace errors in `.gitattributes`; remove non-semantic final blank lines from ordinary text artifacts.
- **Verification:** Restage the full change set and require a clean `git diff --cached --check` before commit and push.
- **Prevention:** Treat archived patches as artifacts, not source: give their file type an explicit whitespace policy before adding them to a repository that enforces `git diff --check`.

## EP-060: Sandboxed Jest cannot atomically write its transform cache

- **Date / task / area:** 2026-10-16; V1.1 trip-detector focused verification.
- **Status:** Environment limitation handled; host rerun required.
- **Expected / actual:** The focused mobile Jest suite should execute in the sandbox. Jest failed before collecting tests with `EPERM` while renaming a transform-cache map below the sandbox Temp directory.
- **Cause:** Known sandbox filesystem restriction, not an application or test failure.
- **Correction:** Rerun the identical command in the approved host environment; use its test result as verification evidence.
- **Prevention:** When Jest reports this exact Temp-cache rename failure, record it as an environment limitation and immediately use the bounded host rerun rather than changing product code or treating the suite as executed.

## EP-061: Durable count test retained the legacy inferred-journey predicate

- **Date / task / area:** 2026-10-16; V1.1 qualified primary projection; reconciliation repository test.
- **Status:** Fixed in code; focused host rerun pending.
- **Expected / actual:** After moving primary counts to the qualification boundary, the durable-count test still asserted the legacy `reconstruction_journey` table. The host focused run failed exactly on that stale assertion; 96 other focused tests passed.
- **Cause:** The migration/query implementation changed the primary data invariant but the aggregate regression only checked the old table name.
- **Correction:** Updated the regression to require `reconstruction_trip_qualification` and its explicit `AUTO_CONFIRMED`/`USER_CONFIRMED` predicate.
- **Verification:** Rerun the focused host suite after this test update.
- **Prevention:** When moving a privacy or qualification boundary, assert the new table and predicate—not merely the returned mock aggregate.
- **Recurrence:** The first migration assertion included SQL quote characters that were escaped inside the stored JSON string, so the focused host suite failed one assertion despite the migration being present. Assert the stable reason token rather than its SQL literal representation.

## EP-062: Device-refresh probe assumed Android platform tools were on PATH

- **Date / task / area:** 2026-10-16; V1.1 device rebuild preparation.
- **Status:** Open; environment discovery interrupted by the owner clarification.
- **Expected / actual:** Verify a connected device before attempting a rebuild. The direct `adb devices` probe failed because `adb` is not on this shell's PATH.
- **Cause:** Assumed the Android SDK platform-tools location instead of resolving the installed executable first.
- **Correction:** The owner clarified that they want a rebuild and will perform the on-device interaction check. Next action is to use the Expo device build command, which resolves its platform tooling, or locate the configured SDK path before direct ADB use.
- **Verification:** Pending successful Expo rebuild/device selection.
- **Prevention:** Use `Get-Command adb.exe` or the Expo device command before direct ADB diagnostics; do not assume PATH configuration.
- **Recurrence (2026-10-16):** A device-log probe used PowerShell's reserved `$PID` variable and failed before reading logs. Use a task-specific variable such as `$processId`; the corrected, application-process-only probe confirmed Metro bundle startup with no filtered fatal, React Native, SQLite-lock, or bundle-load error.
- **Recurrence (2026-10-16):** A sandboxed ADB relaunch attempt could not start or connect to the ADB daemon on port 5037. This is an execution-environment limitation, not a device or application failure. Rerun the same bounded reverse/force-stop/launch sequence in the approved host environment before interpreting device state.
- **Recurrence (2026-10-16):** The approved host relaunch attempt then reported `no devices/emulators found`. The connected Android device is presently unavailable to ADB, so the new JavaScript bundle cannot be device-launched from this workstation. Reconnect/authorize the device and rerun the bounded ADB launch before treating this as an application failure.

## EP-063: Guarded V1.1 projection removed every primary journey on a real device

- **Date / task / area:** 2026-10-16; Android V1.1 device validation; Atlas primary projection.
- **Status:** Open; product regression confirmed.
- **Expected / actual:** The owner wanted far fewer false inferred trips while retaining a useful, magical automatic Atlas. After the rebuilt client opened, the supplied device image showed `2,989 records assessed`, `1,756 supported`, `67 inferred places`, `205 inferred visits`, but `Journeys • 0` and `No supported journey is available to show.`
- **Cause:** Confirmed. The temporary qualification bridge correctly excludes legacy V1 inferred rows from primary Atlas/count/replay but only exact owner confirmations can pass it. The full V1.1 base/routine/native-context classifier that would qualify genuine automatic trips has not been integrated, so the safety gate has zero automatic recall.
- **Correction:** Do not accept this bridge as the final experience. Implement and validate the complete context/episode qualification pipeline against a private labeled device sample before keeping the primary filter active; retain a reversible dry-run/rollback path.
- **Correction update:** Replaced the owner-confirmed-only bridge for future rebuilds with a deterministic local-graph V1.1 adapter: a candidate must have a distinct frequently observed non-candidate base (at least 12 dated days), conservative 50 km base distance, five eligible photos, independent day/place support, and a rare/far score path. Exact owner confirmations still bypass automatic gates. The current full native base/routine pipeline remains required before release.
- **Verification:** Physical Android image confirms the rebuilt bundle rendered and the original guarded query took effect. New pure repository regression passes for a far five-photo, two-place episode with a 12-day base; focused engine/repository suite passed 63 tests. A private device rebuild/re-import is still required to establish recall.
- **Prevention:** Any primary false-positive suppression change must include a real-library recall floor and a device assertion that qualified automatic trips remain visible; an empty map cannot pass a precision-oriented gate.
- **Follow-up inspection (2026-10-16, continuity party):** The recovery adapter calls all graph support capture-like, uses civil dates as sessions, computes rarity from photo-count ratio, selects a global 12-day base and omits uncertainty radii in distance. The prior handoff's description of a conservative V1.1 classifier overstated its conformance. Its synthetic positive case proves only that those heuristics can publish a candidate. Replace these shortcuts with the canonical normalization/context/episode pipeline; require threshold, routine, duplicate and false-split/merge coverage before claiming the automatic engine fixed.

## EP-064: Atlas preview opens outside the viewport and media remains a list

- **Date / task / area:** 2026-10-16; owner-reported Atlas and album interaction.
- **Status:** Open; final delivery plan recorded, application fix pending.
- **Expected / actual:** Map or list selection should open an immediate preview; the owner must scroll up after a list tap. The owner expects an album grid; the media action opens thumbnail/text rows.
- **Cause:** Confirmed in `atlas-reveal.tsx`: the preview is nested inside the map section or inline above the list, without viewport-level presentation. `journey-media-viewer.tsx` renders row entries inside an inline panel with explicit page buttons.
- **Correction:** Follow the continuous-trips-and-album delivery plan: one viewport-level native sheet for both triggers, then a full-screen virtualized mixed-media grid with preserved return context.
- **Verification:** Code inspection confirms the structural causes. Implementation, automated interaction tests and physical-device scroll/grid/Back acceptance remain pending.
- **Prevention:** Test selection from a row below the visible map and verify the preview in the current viewport; require the media action to render grid tiles on an album screen, with device confirmation of return position.

**Correction update (2026-10-16):** Replaced both inline preview variants with a single native viewport-level sheet, used by map-dot and Timeline selection. Replaced the media rows/page controls with a full-screen, three-column mixed-media grid and a selected-item viewer that returns to the grid; the repository page is now bounded at 60 items. Focused host UI tests and TypeScript pass. Physical Android confirmation of sheet placement, grid scrolling, and Back context remains pending.

## EP-065: Offline country display names retained dataset padding

- **Date / task / area:** 2026-10-16; coarse journey label projection.
- **Status:** Fixed in code.
- **Expected / actual:** A resolved bundled country label should be readable in the Atlas. The first regression exposed trailing NUL padding from the Natural Earth dataset (for example, a name rendered with invisible suffix bytes).
- **Cause:** The existing resolver returned only fixed-width codes, so dataset name normalization was never previously required.
- **Correction:** Strip trailing NUL padding and whitespace inside `countryDisplayName` before the reveal boundary receives the coarse label.
- **Verification:** Focused country-resolver regression passes after the normalization fix.
- **Prevention:** Any newly exposed bundled dataset display field must have a regression for its human-readable normalized form.

## EP-066: Initial continuity merge used an array-of-array journey type

- **Date / task / area:** 2026-10-16; V1.1 continuous-trip postprocessor.
- **Status:** Fixed in code.
- **Expected / actual:** The new multi-city continuity regression should compile and merge adjacent away fragments. The first focused run failed because the accumulator was typed as an array of journey arrays, producing an undefined prior span.
- **Cause:** Used `ReconstructionGraph['journeys'][]` instead of the element collection type `ReconstructionGraph['journeys']`.
- **Correction:** Corrected the accumulator type and guarded the prior span before calculating the gap.
- **Verification:** Focused continuity, Atlas and country tests pass (49 tests); TypeScript and cache-free lint pass.
- **Prevention:** For indexed collection aliases, type mutable accumulators as the collection type unless deliberately storing nested collections; compile before interpreting runtime test failures.

## EP-067: Device run retained split Taiwan fragments and entered a failed reconstruction state

- **Date / task / area:** 2026-10-16; owner device screenshot after continuous-trip implementation.
- **Status:** Code correction pending device rerun.
- **Expected / actual:** The October multi-city Taiwan holiday should become one continuous trip and the Atlas should remain ready after reconstruction. The screenshot instead shows two Taiwan October rows and the failed-local-reveal message with a stale 23-journey record.
- **Known cause:** The original continuity test covered only a three-day gap, while the owner scenario may include ordinary longer city stays. The screen is a committed prior durable record plus a failed new reconstruction; the exact device exception is not available from the screenshot.
- **Correction:** Extend the away-from-frequent-base continuity ceiling to ten days, still requiring both adjacent fragments to be far from base and never using country/month as the merge key. Preserve the previous committed record on a failure and rerun the device reconstruction to obtain the actual error if it recurs.
- **Verification:** New regression covers a seven-day city-stay gap; focused host rerun and physical rebuild remain pending.
- **Prevention:** Test continuity at the longest permitted city-stay interval and treat a screenshot failure state as a required device regression, not as a successful stale-record fallback.
- **Root-cause update (2026-10-16):** Static tracing found two additional blockers. Country display is written from one deterministic place representative only; a border/invalid/unresolved representative makes that whole place label-less even when another supported member would resolve. Separately, the continuity pass is disabled whenever *any* effective correction exists, including an unrelated historic correction (`corrections.length ? structurallyMerged : mergeContinuousAwayJourneysV11(...)`). Thus an unrelated correction can preserve all pre-V1.1 fragments. Both require targeted correction-safe changes and regressions; do not merge by country/month as a workaround.
- **Correction update (2026-10-16):** The continuity pass now receives the exact matched journey IDs protected by effective journey or memory corrections. It preserves those targets but continues adjacent, far-from-base unreviewed fragments. Country resolution now uses all supported members of each place: unresolved/border members abstain, one resolved-country consensus labels the place, and conflicting resolved countries stay unlabeled rather than fabricated. A focused host regression covers an unrelated pinned correction plus a separate seven-day multi-city episode and an unresolved representative with a resolved supported member.
- **Verification update (2026-10-16):** Focused country/reconciliation tests passed (31 tests); the complete mobile check passed 29 suites / 252 tests with TypeScript and lint. Physical rebuild, private-library recall and the original device error remain pending; this is not a device acceptance result.
- **Prevention update:** Any future graph-level postprocessor must accept an explicit protected-scope set and have regressions for both a protected target and an unrelated candidate.
- **Recurrence (2026-10-16):** The owner correctly pointed out that the ready-state screenshot contains neither `Retry local reveal` nor any equivalent rebuild action. The prior guidance assumed the failed-state button existed in the ready view. **Cause:** `Retry local reveal` renders only for `failed`, while the ready Atlas offered no full reconstruction entry point after an engine update. **Correction:** The ready state now exposes `Rebuild local journey history`, bound to the same full `onRetry` controller rebuild rather than the queue-only catch-up path, with an interaction regression. **Verification:** Focused host Atlas UI suite passes; physical rebuild remains required.
- **Recurrence (2026-10-16):** The rebuild control began an asynchronous job but did not give the owner a meaningful in-progress status beyond a generic reconciliation sentence. **Correction:** The processing projection now distinguishes a full rebuild from incremental updates, and Atlas renders a visible busy panel that explains the recalculation and automatic refresh. **Verification:** Focused host Atlas UI suite passes. **Prevention:** Every owner-started asynchronous local operation must acknowledge start, state what will refresh, and identify the completed state without inventing a percentage or duration.

## EP-069: Search command included a nonexistent source root

- **Date / task / area:** 2026-10-16; ready-state rebuild investigation.
- **Status:** Fixed.
- **Expected / actual:** Search only known repository roots. A diagnostic search included the nonexistent `app` root alongside `apps/mobile/src`, producing an avoidable path error.
- **Cause:** An unverified shorthand path was included in the command.
- **Correction:** Continued using the confirmed `apps/mobile/src` root only.
- **Verification:** Subsequent targeted source search completed without a path error.
- **Prevention:** Resolve source roots with `rg --files` or use the established package path before composing a multi-root search.

## EP-070: Atlas reconciliation test retained superseded progress copy

- **Date / task / area:** 2026-10-16; owner-visible rebuild progress.
- **Status:** Fixed before final verification.
- **Expected / actual:** The Atlas UI suite should verify the new, clear progress status. One existing reconciliation test asserted the superseded generic sentence and failed after the intentional copy upgrade.
- **Cause:** The test asserted literal presentation text instead of the persistent processing contract.
- **Correction:** Updated it to assert the incremental-update wording and automatic-refresh outcome; the full-rebuild case has its own busy-state regression.
- **Verification:** Focused host Atlas UI suite passes (20 tests).
- **Prevention:** When a processing-state message is refined, update all state-specific assertions in the same change and preserve behavior-oriented phrases in tests.
- **Recurrence (2026-10-16):** The journey-list layout correction deliberately placed label and period on separate lines, but one UI assertion required the label to be an exact standalone text node. The focused suite failed one assertion while TypeScript passed. Updated the assertion to test the visible label rather than its old node boundary and added a gallery-header close-control regression. Run the focused suite again before release.

## EP-068: V1.1 detector used a lint-disallowed generic array form

- **Date / task / area:** 2026-10-16; V1.1 pure qualification engine; mobile lint.
- **Status:** Fixed before final verification.
- **Expected / actual:** The complete mobile check should have no new lint diagnostics. The initial `reconstructV11` signature used `Array<T>`, which is disallowed by the repository TypeScript lint rule.
- **Cause:** The new public function signature did not follow the project array-type convention.
- **Correction:** Replaced the generic array form with the equivalent `T[]` form.
- **Verification:** The focused engine suite passed before and after the change; the complete mobile check is rerun after the correction.
- **Prevention:** Run the package lint/typecheck after adding exported TypeScript signatures, and use the repository's `T[]` convention by default.

## EP-071: Island lookup failure was attributed to owner metadata without evidence

- **Date / task / area:** 2026-10-16; PM/analyst investigation of missing destination and split trips.
- **Status:** Open; reproduced resolver defect, episode integration incomplete.
- **Recurrence (2026-10-16, continuity party):** The owner reports four April 2024 rows, two September 2025 rows and two February 2022 rows representing three actual holidays. Static tracing confirms precise and civil-day visits are grouped separately in V1; same-day weak visits and repeated-place stays can split, while the later continuity pass rejects overlapping spans and requires a qualifying base. The canonical candidate pass writes diagnostics only and does not drive published journeys. Which predicate blocked each private group remains unverified. **Next action:** Inspect generation-bound boundary decisions for all three groups, replace active grouping with episode construction, and verify both false-split and false-merge controls on device. **Prevention:** Trip membership uncertainty must not be equated with uncertain within-trip ordering; require evidence for every semantic boundary.
- **Recurrence (2026-10-16):** The owner could not find Private record settings on device. Static inspection showed the only Atlas entry was after the full journey content, where it could be below the viewport. **Correction:** Add a Home bases action beside About in the persistent Atlas header, while retaining the existing lower settings entry. **Verification:** Add and run an Atlas header interaction regression. **Prevention:** A primary owner control must be reachable from the initial screen without requiring a long scroll.
- **Recurrence (2026-10-16):** The owner selected a journey and tapped Save usual area, but the app appeared unresponsive. The save handler did not publish any state until its SQLite write and full rebuild both settled, and it permitted repeated taps. Application-process error logs contained no matching exception. **Correction:** Publish an immediate saving message, disable the action while active, use the consistent Home base wording, and distinguish a saved configuration from a failed rebuild. **Verification:** Run the settings/provider regression and TypeScript check, then reload the device. **Prevention:** Any owner-started operation with a rebuild must acknowledge the tap before awaiting storage or reconstruction.
- **Recurrence (2026-10-16):** The photo-backed Home setup test first mounted a custom provider adapter but never caused its durable projection to publish, so no journey candidate appeared. **Cause:** Custom-adapter test mode deliberately skips the native-only durable-load effect. **Correction:** Publish a completed synthetic graph through the reconstruction controller in the test harness, then assert review journey -> select observed area -> save passes the selected visit into the private repository. **Verification:** Focused Home/provider/engine/repository suite passed 91 tests with TypeScript and lint. **Prevention:** Provider UI tests using non-native adapters must explicitly drive the lifecycle/projection state they intend to render.
- **Recurrence (2026-10-16):** Renaming the owner setting from “Usual areas” to the user-facing “Home bases” left its focused UI test asserting the old heading. The home/continuity test run failed one assertion while the engine tests and TypeScript passed. **Correction:** Update the assertion and test description to the approved Home bases wording, then rerun the focused settings and reconstruction suite. **Prevention:** A user-facing vocabulary change must update its direct UI assertion in the same edit.
- **Planning correction (2026-10-16):** Verified that the continuity pass currently uses all twelve-day places, whereas qualification selects the highest-support non-candidate place. The earlier description of one global base for both paths was inaccurate. Candidate destinations can themselves satisfy the merge base heuristic. Also, the GPS-less representative fallback regression used a manually constructed graph; current V1 support places normally require coordinates, so that synthetic case did not establish a likely native-device cause. The private September non-join remains unknown. The delivery requirements now require generation-bound reason diagnostics before attributing another device split to a specific predicate.
- **Expected / actual:** Supported island destinations should receive familiar names and continuous trips should appear once. The owner reports persistent unlabeled/split results. The preceding response attributed the label to missing/invalid/conflicting metadata without inspecting the current run; it also incorrectly described country consensus at trip level (the code supports multi-country labels).
- **Verified cause:** The bundled 110m resolver returns border for synthetic Ubud and unresolved for synthetic Denpasar/Kuta, while Jakarta resolves IDN. Its coarse geometry and universal 5 km edge rule cannot reliably label these island samples; it has no regional naming layer. Persistence still groups V1 journeys and applies a global-base merge patch rather than constructing canonical V1.1 episodes. The exact owner-run non-join reason remains unknown.
- **Correction:** Retracted the unsupported metadata explanation; recorded source-backed engine gaps, offline geometry/region requirements, per-join diagnostics and positive/negative acceptance cases in the existing continuous-trips delivery record. Application correction and private device diagnosis remain pending.
- **Verification:** Direct local execution of the existing resolver on four public synthetic samples reproduced the three island failures. No private metadata was inspected or exported.
- **Prevention:** Test island/coastal naming coverage and expose decision reasons before diagnosing an owner-specific failure. Do not describe qualification-only functions as a complete episode engine or a synthetic positive case as private-library acceptance.
- **Recurrence (2026-10-18, September metadata inspection):** An aggregate query across every September place returned `VNM` plus unresolved places, and the response incorrectly associated that aggregate with the owner's Bali journey. The query had no journey-level grouping. **Correction:** Retract the Vietnam association. The live projection only renders country labels for qualified journeys from the offline resolver and has no city/island destination naming path. **Verification:** Repository inspection shows the projection falls back to `Private journey` unless exactly one resolved country code is attached to that qualified journey. **Prevention:** Never attribute month-wide aggregate location results to one journey; include the journey grouping in any owner-specific diagnostic.
- **Environment note:** BMAD resolver activation through uv encountered interpreter-cache access denial, including a cache-free retry. Read the installed default persona/config and confirmed there are no persona override files; no prepend/append activation steps or persistent facts are configured. This is an environment limitation, unrelated to trip detection.
- **Recurrence (2026-10-16, Atlas reference-direction intake):** The `bmad-ux` workflow resolver again failed while persisting its Python interpreter cache under the sandbox package directory (`Access is denied`). **Correction:** Used the readable installed workflow defaults and the already resolved project configuration; no UX artifact generation or product code was attempted through the failed resolver. **Verification:** The applicable workflow instructions and default customization were read directly. **Prevention:** Treat this exact `uv` interpreter-cache error as the known sandbox limitation, record it once per affected task, and do not misclassify it as an application or UX-spec failure.
- **Recurrence (2026-10-16):** Downloading the public-domain detailed Admin-1 boundary archive was blocked before execution because automatic approval review hit its account usage limit. No external file was downloaded and no owner data was involved. Continue the local episode correction; retry the vendored-boundary acquisition only when the approval service is available.
- **Recurrence (2026-10-16):** The owner reran the current bundle and the September journey was still split. Static tracing found a further generalized continuity defect: the pass used only a frequent place's deterministic representative as the home-base coordinate. A representative may legitimately be GPS-less even while its supported place has many coordinate-bearing records, making the entire continuity pass return without joining any fragments. **Correction:** Select the first coordinate-bearing support from each eligible frequent base; the stable representative remains provenance/display metadata only. **Verification:** A regression makes the home representative GPS-less and verifies the seven-day multi-city episode still becomes one journey. Device rebuild is required to verify the owner run. **Prevention:** Never use a display representative as a required measurement source without a supported-data fallback.
- **Recurrence (2026-10-16):** The owner reported the September fragments still separate after that fallback. **Confirmed design gap:** The live engine is still a pairwise postprocessor: it joins only immediately adjacent V1 journeys when both are wholly far from one global frequent base, their exact timestamps are non-overlapping, their gap is at most ten days, and neither is correction-protected. It has no episode/session layer, no bounded uncertain adjacency, no evidence-based return test, and no date-scoped multi-base model. Thus an uncertain ordering, overlapping capture windows, an intervening unresolved/local fragment, missing global base, protected target, or a gap over ten days can block a genuine continuous holiday. **Next correction:** Replace this postprocessor with the specified episode pipeline; persist sanitized per-link reason codes so an owner-specific non-join is diagnosable locally without exporting media or precise coordinates. **Verification:** The exact device predicate is intentionally still unknown because no private evidence was inspected. **Prevention:** Do not claim a patch fixes a device split without local decision diagnostics and a physical rebuild result.

## EP-072: V1.1 provenance regression asserted a known negative for unknown evidence

- **Date / task / area:** 2026-10-16; V1.1 pure qualification engine; focused host Jest.
- **Status:** Fixed before final verification.
- **Expected / actual:** The new provenance regression initially expected `NOT_TRIP` for unknown-origin media excluded from photo support. The implemented contract correctly produced `UNCONFIRMED`, because absent trustworthy capture provenance is missing evidence rather than a known negative.
- **Cause:** The test expectation collapsed the contract's distinction between insufficient known support and uncertain metadata.
- **Correction:** Updated the assertion to require `UNCONFIRMED` and retain the `photo-count-below-five` diagnostic.
- **Verification:** The focused host reconstruction-engine suite is rerun after the assertion correction.
- **Prevention:** For every qualification regression, select the expected state from the contract's known-negative versus missing-evidence rule before asserting a status.
- **Recurrence:** The same fixture initially retained two local days while asserting the AC-41 score of 55; the engine correctly awarded the five-point local-day signal. The fixture now uses one known local day so it exercises the DAY span threshold without silently testing a different score profile.

## EP-073: Qualified aggregate query left its SQL-shape test double stale

- **Date / task / area:** 2026-10-16; V1.1 durable reveal aggregate parity; focused mobile Jest.
- **Status:** Fixed before final verification.
- **Expected / actual:** The new qualified-destination aggregate query should keep counts aligned with the primary qualified set. The repository test returned null statistics because its SQL-shape mock still matched the old unqualified `COUNT(DISTINCT country_code)` expression.
- **Cause:** The test double coupled its response to an outdated SQL fragment while the production query correctly qualified destinations through journey links.
- **Correction:** Updated the mock and assertion to match `COUNT(DISTINCT place.country_code)` and retain explicit coverage that the aggregate traverses the qualified journey-link boundary.
- **Verification:** The focused V1.1 repository, engine, migration, and Atlas suites are rerun after the fixture update.
- **Prevention:** When changing a repository query's aggregation boundary, update SQL-shape mocks in the same patch and rerun the affected repository suite.

## EP-074: Configured-home schema migration initially left repository fixtures stale

- **Date / task / area:** 2026-10-16; V1.1 configured-home persistence; focused mobile verification.
- **Status:** Fixed before verification.
- **Expected / actual:** Raising the private schema to v30 for date-scoped owner home areas should preserve migration coverage. The first focused run retained v29 assertions and the typed SQLite shim lacked `getAllAsync`, causing six migration assertion failures and a TypeScript error.
- **Cause:** The additive read API and schema version were not reflected in the repository test double at the same time as production code.
- **Correction:** Added typed list-read support to the shim, updated current-version assertions to v30, and added a private multi-area save/deletion regression.
- **Verification:** Focused engine, reconciliation, and import-repository suites passed 89 tests; TypeScript and lint passed.
- **Prevention:** Every schema/API extension must update the current-schema mock, all typed database methods, and a migration/deletion regression before the focused run.

## EP-075: V1.1 inspection searched a nonexistent native-modules directory

- **Date / task / area:** 2026-10-16; V1.1 implementation verification; repository inspection.
- **Status:** Corrected.
- **Expected / actual:** The completion audit should search only existing source roots. A diagnostic command included `apps/mobile/modules`, which this checkout does not contain, and `rg` returned a path error.
- **Cause:** The spec code map was treated as proof that the proposed native-module directory had already been created.
- **Correction:** Continued the inspection against the verified `apps/mobile/src` source root and recorded the absent bridge directory as an implementation gap rather than silently assuming it exists.
- **Verification:** The subsequent targeted search completed against existing source paths and identified the configured-home implementation.
- **Prevention:** Resolve each planned source root with `Test-Path` or `rg --files` before including it in a multi-root diagnostic command.
- **Recurrence (2026-10-16, Atlas Obsidian Horizon feasibility):** A MapLibre research pass guessed the nonexistent `apps/mobile/app.config.js` and a wrong installed `GeoJSONSource` declaration path before enumerating the package. **Correction:** Confirmed `app.json` and `components/sources/geojson-source/GeoJSONSource.d.ts` from the installed package; the existing MapLibre dependency is sufficient. **Verification:** Subsequent source inspection completed against those observed paths. **Prevention:** For project configuration and installed dependency declarations, enumerate the exact package/config directory before direct reads; a conventional filename or namespace is not path evidence.
- **Recurrence (2026-10-17, Atlas review staging):** Git could not write the required unified review diff to `C:\\Windows\\Temp` because that system Temp directory is not writable in this session. **Cause:** The staging path was assumed rather than tested. **Correction:** Stage the generated review diff through the approved host boundary in the session-specific Temp location. **Verification:** Reviewers must receive a readable nonempty diff path before review starts. **Prevention:** Use the execution environment's reported Temp path or request the approved boundary; never assume `C:\\Windows\\Temp` is writable.
- **Recurrence (2026-10-18, cartography planning):** A source inventory included a nonexistent `packages` root. **Correction:** Repeated the inventory using verified `scripts`, `apps/prototype/src` and `apps/mobile/src` roots; marked proposed shared paths as new. **Verification:** The corrected search identified both actual Atlas components. **Prevention:** Verify conventional monorepo roots before multi-root searches; a proposed package layout is not existing code evidence.

## EP-076: Sandboxed Jest recurrence during C0/C1 context verification

- **Date / task / area:** 2026-10-16; V1.1 temporal-context regression; mobile Jest.
- **Status:** Environment limitation handled.
- **Expected / actual:** The focused reconstruction suite should collect the newly added C0/C1 leave-one-out regression. The sandboxed run failed before collection because Jest could not atomically rename its transform-cache map under the sandbox Temp directory.
- **Cause:** Same known sandbox filesystem limitation as EP-060, not an application or test failure.
- **Correction:** Reran the identical focused command in the approved host environment.
- **Verification:** Host run passed `reconstruction-engine`: 1 suite, 45 tests.
- **Prevention:** For this exact Jest transform-cache EPERM, record the recurrence and run the same bounded suite outside the sandbox before judging product code.

## EP-077: A single home observation was treated as a trip boundary in a V1.1 fixture

- **Date / task / area:** 2026-10-16; V1.1 canonical episode construction; focused mobile Jest.
- **Status:** Fixed before verification.
- **Expected / actual:** A true home return must be corroborated by two ordered sessions spanning at least 60 minutes or two days. An existing fixture expected one configured-home observation to split two away blocks, so it failed after the episode builder correctly stopped treating a lone point as a return.
- **Cause:** The fixture represented a location observation, not the contract's return predicate.
- **Correction:** The episode builder requires corroborated home evidence before creating a home boundary; the fixture now includes a second home capture two hours later.
- **Verification:** The focused reconstruction and reconciliation suites are rerun after this update.
- **Prevention:** Boundary fixtures must model every supporting observation required by the corresponding automatic predicate.

## EP-078: Atlas Camera mock violated the React display-name lint rule

- **Date / task / area:** 2026-10-17; Obsidian Horizon Atlas review fix; mobile lint.
- **Status:** Fixed before final verification.
- **Expected / actual:** The full mobile check should pass after adding a ref-capable MapLibre Camera test double. ESLint rejected the anonymous `forwardRef` mock with `react/display-name`.
- **Cause:** The focused Jest run did not include the repository lint rule, and the new test mock omitted an explicit component name.
- **Correction:** Bound the mock to `Camera` and assigned `MockMapLibreCamera` as its display name.
- **Verification:** Complete mobile check passed: 29 suites / 270 tests, TypeScript, and lint. Root `npm run check` and `git diff --check` also passed.
- **Prevention:** Any React `forwardRef` test double must name the component before relying on focused Jest results.

## EP-078: Canonical V1.1 rebuild still split owner-confirmed continuous holidays

- **Date / task / area:** 2026-10-16; Android device acceptance; canonical episode construction.
- **Status:** Correction in verification.
- **Expected / actual:** The owner rebuilt the private record but still saw two September 2025 trips, three April 2024 trips, and two February 2022 trips, each representing one continuous holiday.
- **Verified cause:** `buildV11Episodes` treated Android creation timestamps as precise instants even when `hasPreciseOffset` was false, then put each actual day-only observation into an isolated episode. It therefore preserved the legacy precision partition instead of using the V1.1 civil-day link contract.
- **Correction:** Use only offset-qualified timestamps as instants; assemble mixed-precision evidence into civil-day blocks; link short compatible blocks without inventing their internal order; permit a 3-10-day continuation only when both blocks have independent away-from-home context. Carry actual graph place IDs and date-scoped home distances into this decision instead of visit IDs or display representatives.
- **Verification:** Typecheck passed after the correction. Focused Jest could not collect in the sandbox because of the known transform-cache EPERM; the identical suite must run in the approved host environment, then the physical rebuild must be repeated.
- **Prevention:** Every canonical-episode regression must use Android-style `hasPreciseOffset: false` records with non-null creation timestamps and assert that mixed precision does not create a trip boundary.
- **Tooling recurrence:** A project-state patch initially targeted the wrong document heading capitalization and did not apply. The document uses `# Project state`; the follow-up patch anchored on the verified heading and recorded the correction. **Prevention:** Read the target heading before applying a context-sensitive documentation patch.

## EP-079: Device configuration inspection listed local cache filenames

- **Date / task / area:** 2026-10-16; owner-requested Home-base inspection; Android device diagnostics.
- **Status:** Corrected process; no app mutation.
- **Expected / actual:** The owner asked which configured Home bases the app can see. The diagnostic should have been restricted to aggregate configured-home state, but an initial sandboxed file-layout listing included private cache filenames.
- **Cause:** The command enumerated the app-private tree to locate the SQLite database before confirming its narrow target.
- **Correction:** Do not use recursive/private file listings for this question. The configuration schema stores opaque area identifiers, coordinates, dates and radius but no human-readable place name, so a safe direct database aggregate cannot answer the owner-readable location-name question anyway.
- **Verification:** The database location and schema were identified without copying media or modifying the device. No raw filenames, media, precise coordinates or database contents will be included in the handoff.
- **Prevention:** For device-private diagnostics, start from the exact known database path and request only a predeclared aggregate query; never enumerate caches or media directories.
- **Recurrence (2026-10-18, September 2025 destination inspection):** The app sandbox disallowed its SQLite executable, and no workstation SQLite client was installed. A proposed fallback would have streamed the exact database into an in-memory local SQLite connection to return only aggregate September counts and country codes. Execution policy rejected it before launch because the transfer necessarily included the full private database, including precise locations and identifiers. **Correction:** Do not work around this boundary. Obtain explicit owner approval for that one-time, in-memory sensitive-data transfer, or add a future app-owned redacted diagnostic that queries locally. **Verification:** The rejected command did not run; no private database bytes, metadata, media, coordinates, or identifiers were transferred or displayed. **Prevention:** Treat an aggregate-only output as insufficient authorization for an implementation that transports a complete private database; request consent for the sensitive transfer at the point of execution.
- **Recurrence (2026-10-18, approved aggregate query):** The first approved in-memory query passed its Python source through an interpolated PowerShell command, so PowerShell interpreted the SQL `<` comparison before Python started. **Correction:** Pass the query as a PowerShell literal script argument instead of an interpolated command string. **Verification:** The failed attempt produced only a PowerShell parser error; it did not invoke Python, ADB, or read database bytes. **Prevention:** For sensitive diagnostic scripts containing shell metacharacters, use a literal here-string and verify the interpreter starts before interpreting an error as database output.
- **Recurrence (2026-10-18, approved aggregate query):** The corrected in-memory reader reported `file is not a database`, indicating that the assumed app-private path did not yield the SQLite database. **Correction:** Do not enumerate private storage or inspect its contents; test only the two documented Expo SQLite path variants for existence and size, then retry the approved aggregate query against the verified path. **Verification:** Python emitted no database rows, and no raw metadata was printed or retained. **Prevention:** Before streaming an app-private SQLite database, verify its exact documented path with a metadata-only probe.
- **Recurrence (2026-10-18, path probe):** The first metadata-only two-path probe passed a shell loop through ADB with insufficient argument quoting; Android's shell rejected it before evaluating either path. **Correction:** Use a direct `stat` invocation per documented candidate path, with no shell loop or redirection. **Verification:** The output was only an Android shell syntax error; no private path metadata or database data was returned. **Prevention:** Do not send compound shell programs through ADB when one direct command per known path is sufficient.

## EP-080: New Home-base effect violated the React state-effect lint rule

- **Date / task / area:** 2026-10-17; named private Home bases; provider verification.
- **Status:** Fixed before final verification.
- **Expected / actual:** The full mobile check should lint the new Home-base list refresh. It failed because the lifecycle effect synchronously cleared component state on disconnect.
- **Cause:** The provider used a direct `setHomeBases([])` in an effect body, which this project correctly flags as a cascading-render risk.
- **Correction:** The effect now refreshes only while connected; lifecycle/deletion state remains the authority for access and Home-base mutations.
- **Verification:** Rerun the complete mobile check after this correction.
- **Prevention:** Do not synchronously mirror lifecycle state into provider state inside an effect; use the authoritative lifecycle guard or an asynchronous repository read.

## EP-081: Required Home-base implementation handoff exhausted its usage allocation

- **Date / task / area:** 2026-10-17; BMAD build dispatch; named private Home bases.
- **Status:** Process fallback applied.
- **Expected / actual:** The required implementation subagent should complete the approved spec. Its turn ended before work began because the account usage allocation was exhausted.
- **Cause:** External account limit, not a repository or application failure.
- **Correction:** The parent continued directly from the approved, in-progress spec and retained the same scope and verification gates.
- **Verification:** Parent-owned focused and full checks are recorded with this story.
- **Prevention:** When a mandated subagent cannot run for an external reason, retain its approved spec as the sole source of truth and use the workflow's direct-implementation fallback.

## EP-082: Atlas local-filter regression asserted nested text instead of its accessible control

- **Date / task / area:** 2026-10-17; Obsidian Horizon Atlas; focused UI regression.
- **Status:** Fixed before final verification.
- **Expected / actual:** The new local-search regression should prove that a filtered journey remains available and the excluded selection closes. Its first host run failed because `getByText('Harbor')` does not match that nested React Native text structure reliably, although the rendered accessible journey control was present.
- **Cause:** The test asserted implementation nesting rather than the owner-reachable button label.
- **Correction:** Assert the `Harbor, May 2023` button and absence of the excluded `North coast, April 2024` button.
- **Verification:** The corrected focused Atlas suite is rerun in the approved host environment.
- **Prevention:** Interaction regressions must prefer role and accessible-name assertions over incidental nested text nodes.
- **Tooling recurrence:** A combined UI/test patch used a test-suite anchor in the production screen file and correctly failed without changing files. The follow-up patch targeted only the verified `chooseHomeJourney` block. **Prevention:** Do not combine unrelated file contexts in a single `apply_patch` hunk.

## EP-083: Sandboxed Jest cache blocked named Home-base verification

- **Date / task / area:** 2026-10-17; named private Home bases; focused mobile Jest.
- **Status:** Environment limitation handled.
- **Expected / actual:** The focused Home-base suite should collect after review fixes. It failed before collection because Jest could not atomically rename its transform-cache map in the sandbox Temp directory.
- **Cause:** Known sandbox Temp filesystem limitation, not a product or test failure.
- **Correction:** Reran the same bounded suite with its cache located under the repository working tree.
- **Verification:** The privacy-settings suite passed; the complete focused set is rerun with that same cache location.
- **Prevention:** On this exact EPERM, keep Jest's cache in a scoped writable workspace directory and do not interpret the first failure as application behavior.

## EP-084: Android device reload was not performed after Home-base verification

- **Date / task / area:** 2026-10-17; named private Home bases; Android acceptance reload.
- **Status:** Open — physical device unavailable.
- **Expected / actual:** The completed JavaScript/SQLite changes should be reloaded on the previously connected Android device. `adb` was absent from this shell PATH; after resolving the installed platform-tools executable directly, its daemon reported that device `9cb47ed9` was not found.
- **Cause:** Shell configuration/device connection state, not an app failure. No command reached the application process.
- **Correction:** Use the verified platform-tools path for the next reload and reconnect/unlock the device with USB debugging authorized before retrying.
- **Verification:** Host checks are green; no physical app reload or owner acceptance result is claimed.
- **Prevention:** Resolve the platform-tools executable and run `adb devices` before composing a device reload command; do not claim a device refresh from a failed transport command.
- **Recurrence (2026-10-17, Atlas visibility verification):** The verified platform-tools executable again could not connect because its ADB daemon failed to start on TCP 5037. No device command reached Travel Life. **Next action:** Restore the local ADB daemon/device connection before retrying native visual acceptance; host tests remain separate evidence.
- **Recurrence (2026-10-18, September 2025 metadata inspection):** A read-only, predeclared attempt to inspect the connected device's September 2025 destination metadata used the verified platform-tools executable. Its ADB daemon again failed to start/connect on TCP 5037, so no command reached the handset and no private metadata was read. **Next action:** Restore the local ADB daemon and authorize/reconnect the handset, then run only the date-filtered aggregate destination query; do not infer the destination or its metadata availability from the split journey rows.

## EP-085: Android development build showed a black Dev Launcher screen

- **Date / task / area:** 2026-10-17; Android device acceptance; Expo development launcher.
- **Status:** Resolved for the connected development build; product-route recovery remains separately tracked in EP-086.
- **Expected / actual:** After a verified Metro reload, Travel Life should render its first screen. The device reached `DevLauncherActivity`, detected Metro, and called `loadJSBundleFromMetro`, but displayed a black screen rather than app content.
- **Verified contributing issue:** A stale Metro listener initially returned an incomplete HTTP stream. Replacing it produced a valid Android Expo manifest; however, a manually opened root URL also triggered an unrelated web bundle failure because `expo-sqlite`'s web worker WASM is absent. This is not evidence of an Android bundle failure.
- **Current evidence:** No Android runtime fatal or React Native JavaScript error was emitted in the filtered app-process logs. The exact launcher-to-bundle transition remains unresolved.
- **Correction:** Replaced the stale Metro process, retained ADB reverse mapping, attempted Expo's supported device rebuild, and used Android-specific manifest validation. No private record data was cleared or changed.
- **Prevention:** Do not use a bare manually composed Dev Launcher root URL as Android acceptance evidence; use an Expo-produced Android development URL or an installed standalone bundle, and capture only fresh app-process logs without clearing the device-wide log buffer.
- **Resolution evidence (2026-10-17):** Reloading the verified Expo development URL opened Travel Life's Welcome screen on the connected device, replacing the black launcher. This confirms bundle startup only; it does not prove private-record reconstruction.
- **Recurrence (2026-10-17, Atlas visibility browser check):** The local `/history` preview again stopped at `expo-sqlite/web/worker.ts` before the Atlas route mounted. This is the known web-runtime dependency gap, not evidence against the local Atlas canvas. **Next action:** Validate the screen through the Android/iOS development build; do not claim a browser rendering until the web SQLite worker is configured.

## EP-086: A failed local rebuild hid the last committed photo gallery

- **Date / task / area:** 2026-10-17; Android owner acceptance; Atlas recovery state.
- **Status:** Mitigated; underlying local-rebuild failure remains under device diagnosis.
- **Expected / actual:** A recoverable rebuild failure must retain access to the last committed private journeys and their associated media. The owner reported that photos could no longer be seen. The device showed seven retained journey rows together with the recovery notice, but the Atlas treated `failed` as non-explorable even though its durable record was available.
- **Cause:** `AtlasReveal` allowed exploration only in `ready` and `processing` states. A failed rebuild therefore hid the map/filter area and made recovery look like photo loss, despite the preserved durable projection.
- **Correction:** Treat `failed` as explorable when a durable journey record exists, add recovery copy explicitly saying associated photos remain browsable, and cover the journey-to-photo-grid flow under that state.
- **Verification:** Host focused Atlas suite passed: 1 suite / 22 tests. The app-process log confirms the Android bundle is running; it did not expose a JavaScript or SQLite cause for the rebuild failure. A physical reload is still required to confirm the owner can open the gallery.
- **Prevention:** Any recovery state that promises a retained committed record must exercise its primary media path in a UI regression. Controller diagnostics must not be inferred from an absent app-process log.
- **Tooling recurrence:** An initial log command assigned to PowerShell's reserved `$PID` variable, so it did not target the application process. The follow-up used `$appPid` and read only the app log. A sandboxed Jest attempt also repeated the known transform-cache EPERM before the identical bounded suite passed in the approved host environment. An initial source search also used the nonexistent conventional `apps/mobile/app` path; the app routes are under `apps/mobile/src/app`. **Prevention:** Never use `$PID` for script variables; resolve source roots before searching, and run this Jest command with an explicit repository cache directory in the host environment.

## EP-087: Broad Atlas visibility patch used an unverified JSX anchor

- **Date / task / area:** 2026-10-17; Obsidian Horizon Atlas visibility correction; code patching.
- **Status:** Corrected before verification.
- **Expected / actual:** The initial local-canvas patch should apply only to the current Atlas component. One broad hunk used an outdated map-controls block and was rejected without modifying files; a follow-up test patch also included surrounding assertions that were not present.
- **Cause:** The patch was prepared from truncated inspection output rather than the exact current blocks.
- **Correction:** Re-read both production and test regions, then applied small verified hunks.
- **Verification:** Focused Atlas suite and complete mobile check are rerun after the corrected edits.
- **Prevention:** For JSX files with evolving inline trees, never combine distant replacements in one hunk; inspect each exact block before every patch.

## EP-088: Atlas placeholder delivery was mistaken for reference fidelity

- **Date / task / area:** 2026-10-18; owner correction after Obsidian Horizon map work; visual acceptance and product delivery.
- **Status:** Open; replacement planned, not implemented or accepted.
- **Resolution recurrence (2026-10-18):** Raising the camera cap exposed the 2048px base at country scale. Replaced deep-zoom enlargement with a density-selected, viewport-culled offline 4K/8K/16K pyramid generated from original relief and vectors. 840 tiles (~3.5 MiB) passed hash/decode checks; inspected Vietnam comparison shows improved coastlines and borders. Active detail tiles are hard-capped at 48 and disable accumulating image caches. Native residency/performance remains unmeasured. Prevention: pair camera zoom changes with source-resolution and visible-tile checks, not just coordinate tests.
- **Resolution check incidents:** A new tile-count test guessed a 35-tile bound but an edge viewport selected 36; implemented an explicit 48-tile runtime cap with density/large-screen regression cases. The first mobile typecheck observed errors in a separately changing journey-media-viewer test; the file was subsequently updated independently with awaited render calls, and the following typecheck was rerun. This tile task did not edit that test.
- **Decode-fixture correction:** Expo Image's error callback requires a nativeEvent envelope; the new negative test initially omitted it and failed inside Expo's wrapper. Added the synthetic nativeEvent payload before rerunning. No real device decode failure was observed from this test.
- **Country-scale recurrence (2026-10-18):** Owner confirms pan but finds 4x insufficient for Vietnam points. Shared cap is now 64x and choices use projected 24-unit screen distance, so geographic neighbours can separate at deep zoom. Two old filter/Timeline tests tapped a map target first and now correctly triggered an overlap choice at world scale; tests explicitly select the Timeline entry for their selection assertion. A synthetic HCMC/Vung Tau case verifies grouping at world fit and separation at 64x. Raster street-level detail remains outside this patch and must not be claimed.
- **Screenshot replacement (2026-10-18):** Owner identified that complete reference UI had been shipped as a background, exposing nonfunctional search/card/compass and decorative dots. This was an agent implementation error and violated the clean-cartography requirement. Replaced the active mobile image with generated Natural Earth 50m geometry plus shaded relief; the base and overlay now use the same Winkel Tripel equation. No screenshot import remains in the verified Android route bundle. New regression checks cover selectable real overlays, fixed dot size and asset fallback (34 focused/owner-flow tests pass). Full owner visual and physical pinch acceptance remains open; the new artwork is not claimed pixel-identical to the reference.
- **Replacement verification incidents:** Natural Earth's legacy raster download link returned HTTP 500; its documented CDN source downloaded successfully. An overlay test incorrectly inspected a renderer child as a single node; corrected it to assert the dot's stable test ID. Initial Android bundle probes omitted Expo's src/app router root and did not contain any Atlas route; adding transform.routerRoot=src/app verified HTTP 200 with real-map/projection modules and no screenshot module. Never infer delivery from an entry-only bundle.
- **Source lookup recurrence:** A reload-middleware search assumed a top-level @expo/cli installation and returned a nonexistent-path error. The installed CLI is nested under expo/node_modules; the corrected search found no reload middleware to use. No reload-success claim was inferred. Pinned regeneration produced identical SHA-256 output on two runs and matching mobile/prototype assets; final 34 focused tests, mobile typecheck, focused lint and root checks pass.
- **Interaction diagnosis (2026-10-18 party):** Owner confirms buttons work but two-finger zoom does not and minimum zoom crops the world. Verified code contains no pinch scale/focal handling, uses `cover` in a portrait viewport, and couples local scale/reset to MapLibre journey framing. Earlier type-check-only fixes did not verify the reported gesture. The shipped full screenshot also contains baked decorative dots and controls. Repair contract: `_bmad-output/implementation-artifacts/atlas-map-interaction-repair-plan.md`; native multi-touch, full-world fit, clean cartographic asset and projection registration remain open. Prevention: assert actual image transforms and measured fit, then run installed-device pinch/pan before claiming interaction fixed.
- **Repair execution (2026-10-18):** Extracted measured local viewport and touch component; touch distance/midpoint now drives zoom, translation is bounded from image size, full-world fit is minimum/reset, and buttons share that state. Markers have 8/12-unit visuals and 48-unit targets. Local viewport travels separately through correction context. Five new tests verify fit, focal anchoring, actual pinch-rendered dimensions, pan/cancel and finger-count transition; 27 focused tests pass with TypeScript, focused lint and root checks. Android forwarding/deep link was delivered to the connected development app; native finger behavior remains owner-unverified. Screenshot geography/embedded decorative UI remains unresolved.
- **Repair check incidents:** Image/ImageBackground rejected the inherited pointerEvents prop; moved it to a wrapper View. The minimum-bound test exposed negative zero; explicitly return zero for centered axes. Cleanup callback ref assignment violated React refs lint; moved assignment into an effect. Old native-renderer assertions were migrated to actual local image/gesture assertions. A follow-up test command named nonexistent atlas-preview-context.test.ts; inventory confirms context is exercised via owner-flow.test.ts instead. These check failures were caught before the final handoff; use verified test paths and retain actual rendered-image assertions.
- **Broader verification blocker:** owner-flow.test.tsx cannot load because the independently modified country-resolver imports missing data/natural-earth-destinations-5.1.1.json. Only the previous 110m country JSON currently exists. The cartography gesture repair did not change that resolver or generate its data. Its generation script is scripts/build-destination-data.py; complete that separate work before treating a fresh native bundle or full owner-flow verification as passing. Focused Atlas/local-map tests still pass 27 cases.
- **Expected / actual:** The owner expected the supplied detailed world map. Earlier handoffs described the new map as delivered after recoloring fictional geography and adding a grid fallback. The owner could not see the expected map and explicitly asked whether the supplied visual was being built exactly.
- **Cause:** Implementation checked palette, controls and mocked behavior but retained nongeographic placeholder shapes/development tiles. The initial native-only interpretation and prototype/native evidence conflation left actual visual fidelity unverified.
- **Correction:** Created `spec-atlas-reference-cartography` with real geographic-source/projection feasibility, six visual acceptance categories, equal-size reference comparison, owner sign-off and separate browser/Android/iOS delivery gates. Existing placeholders are explicitly not accepted as the target.
- **Verification:** Planning validation is recorded with this spec. Actual cartographic replacement, owner visual acceptance and native delivery remain pending.
- **Prevention:** Do not close a visual-reference task from automated tests or token changes. Attach raw actual-route captures, a reference comparison and category-level owner acceptance; record each delivery surface separately. A blocked visual/device check keeps that gate open.
- **Recurrence (2026-10-18):** The replacement was created only in a separate managed worktree and never incorporated into the checkout serving the device. The owner therefore continued to see the prior local-grid canvas. Do not claim a worktree change is device-delivered: identify the active checkout/Metro instance, safely merge with its existing uncommitted Atlas changes, then refresh or reinstall the target build and capture that exact route.
- **Recurrence (2026-10-18):** After the active checkout was updated, the bundled reference was visible but its local fallback did not consume the existing camera state, so zoom/reset and drag controls had no visible effect. Correction: project the image and markers through the same local transform, use a move-threshold PanResponder that leaves dot presses available, and pass camera updates through the existing context. Verify on device; TypeScript passes but this is not a device-interaction claim yet.
- **Recurrence (2026-10-18):** The first transform still mapped an already-high MapLibre zoom directly to the local image scale and allowed the parent scroll surface to win drag recognition. Correction: remap local scale from a full-world baseline, reduce marker hit visuals to 22 logical units, and capture only move gestures after a threshold so press selection remains available. Device confirmation remains required.
- **Recurrence (2026-10-18):** The follow-up transform was applied only to the marker container, leaving the reference bitmap visually static. Correction: place both bitmap and markers inside one transformed, clipped plane. TypeScript passes; reload and direct device interaction still required before closure.

## EP-089: Spec validator treated a descriptive word as an unresolved template

- **Date / task / area:** 2026-10-18; cartography spec self-validation; document checks.
- **Status:** Fixed; corrected document validation passed.
- **Expected / actual:** The placeholder scan should find unfinished template fields. It rejected SPEC.md because the explanatory phrase `placeholder-completion assumptions` contains the word `placeholder`.
- **Cause:** The broad case-insensitive word scan confused ordinary prose describing the prior visual defect with an unresolved template marker.
- **Correction:** Check explicit TODO/TBD markers and standalone placeholder directives; retain legitimate descriptive prose. Run capability, acceptance-ID and link validation independently.
- **Verification:** Corrected validation passed four capability pairs, 20 unique acceptance cases, five delivery gates, five companion paths, local links and template-marker scan. Root `npm run check` and whitespace validation also passed.
- **Prevention:** Document validators should match the actual unfinished-template syntax rather than banning ordinary domain words.

## MapLibre vector-basemap focused-test expectation mismatch (2026-10-18)

- **Symptom/evidence:** The first focused Atlas regression run failed two assertions after the new provider configuration path was introduced. A module-level test provider URL correctly mounted MapLibre, while one test still expected recovery; conversely, `mapAvailable={false}` correctly rendered recovery while its assertion expected MapLibre.
- **Cause:** The test setup's global environment configuration and the explicit native-map availability case were conflated while migrating the prior local canvas assertions.
- **Correction:** Assert MapLibre for the configured default path and recovery only for an unavailable native surface; correct the recovery copy so it does not claim a hard-coded local map remains.
- **Verification / prevention:** Rerun the focused Atlas suite and mobile typecheck after the assertion correction. Keep provider configuration setup local to the tests that require it, and test the enabled and disabled paths explicitly.
- **Recurrence (2026-10-18, review regressions):** When isolating the provider URL per test, three older assertions still treated an empty Atlas as an interactive map, and one used the wrong accessible-name casing for the Map tab. **Cause:** They were inherited from the prior always-mounted custom canvas rather than the approved provider map contract. **Correction:** Give the native-unavailable case an anchored journey; assert no map renderer for sparse evidence; use the verified `Show Atlas map` control label. **Verification:** The focused Atlas suite passed 25 tests; full mobile suite passed 34 suites / 299 tests. **Prevention:** Test both renderer eligibility (an anchored visible journey) and the accessible interaction contract rather than incidental prior-canvas behavior.
- **Tooling recurrence (2026-10-18):** The first dependency type search used the guessed `components/source` path, which does not exist in MapLibre v11. **Cause:** The package layout was assumed rather than read from its package index. **Correction:** Resolve the exported `GeoJSONSourceProps` from the installed `components/sources/geojson-source` declaration before choosing the hitbox API. **Prevention:** For a versioned native dependency, inspect its installed export declaration before coding against a component property.
- **Configuration verification incident (2026-10-18):** The first local check of the owner-supplied MapTiler style URL failed with `No such host is known` inside the sandbox; its follow-up JSON parsing also ran against the absent response. **Cause:** Sandbox DNS/network isolation, compounded by a probe that did not stop after the request failure. **Correction:** Rerun the same read-only request through approved host networking with `-ErrorAction Stop` before parsing; no key is printed in either probe. **Verification:** The host request returned HTTP 200 with a valid style JSON, sources and layers; Metro restart and Android app open produced no filtered fatal/native/JavaScript failure. **Prevention:** Provider URL checks must fail fast and distinguish sandbox transport failure from an invalid credential or style.
- **Documentation-patch incident (2026-10-18):** A combined state/playbook patch was rejected without changing files because the project-state context assumed `This is not` began its own line. **Cause:** A stale exact-text anchor. **Correction:** Re-read the bounded block and apply the replacement with the verified line boundary. **Prevention:** For evolving Markdown, copy the exact current context before applying a multi-file patch.

## MapLibre global subdivision labels missing on device (2026-10-18)

- **Owner mismatch:** Vietnam appears acceptable, but the owner reports no province, state, city, or locality names when zooming into China, Mongolia, or other countries. **Status:** Open; no style switch or application fix is claimed in this discussion.
- **Evidence / uncertainty:** The configured native path passes the MapTiler style through MapLibre and only overlays private journey dots; the dormant local canvas has a short hard-coded country list, not global subdivision labels. Live Streets v4 Dark and Outdoor v4 style metadata both contain `state_label` and `sub_border`, but their state-label layers end at zoom 11. The exact device zoom, glyph loading, collision state, and city/town rendering have not been measured; those parts of the owner-visible symptom remain unexplained.
- **Cross-country review (2026-10-19):** The owner clarified that China eventually shows names at higher zoom, while Mongolia, Turkey, African and European countries remain poor at any tested zoom. Read-only live MapTiler Planet v4 tile probes at country-capital locations found subdivision features in 19 sample countries across six inhabited continents. The configured Streets Dark style's z7-9 `state_label` filter accepts admin level 40 (plus level 50 in AR/FR/US), excluding every subdivision feature in the sampled z7 tiles for Mongolia, Turkey, Germany, Spain, Egypt, South Africa, India, Japan and Australia; z9-11 accepts levels 50/60/61/70, and all state-label style layers end at z11 even though the tileset carries deeper data. Outdoor v4 repeats the z7-9 filter and also ends its state labels at z11, so switching styles alone is not a demonstrated fix. This confirms a style/data-schema mismatch for missing subdivision names; it does not prove all city/town labels fail on device, because those layers persist and the phone was locked during this pass. A first tile probe hit Windows console `UnicodeEncodeError` when printing non-ASCII place names; rerunning with ASCII-escaped samples yielded usable results. **Prevention:** Compare actual vector feature attributes against every style filter at representative zooms and countries, and use encoding-safe diagnostic output; do not equate tile presence with rendered labels or extrapolate from Vietnam/China.
- **Zoom-hierarchy detail:** The configured style continues subdivision borders beyond z11 while subdivision names stop there. Regular city names stop at z14, town and capital-city names stop at z16, and the app camera can reach z16. The remaining `place_label` style filter excludes the source's `village` class entirely. Thus the highest zoom can lose province/city/town context and rural village names may never appear even with data present. This is a style-contract mismatch, not proof of native glyph/tile loading health.
- **Device/data follow-up (2026-10-19):** The unlocked Android development client initially showed only Expo Dev Launcher because Metro was stopped. Metro was started on IPv4, ADB reverse retained, and the existing app opened without clearing data. A native Atlas capture shows MapLibre terrain and public town names in a Québec viewport, but no subdivision name at that high zoom; app-scoped resource logs contained 42 MapLibre/tile/style-related lines and zero matching error lines. This proves the provider map renders and some place glyphs load, not that Mongolia renders correctly: the owner's prepared viewport was Québec rather than Mongolia. Do not infer global label health from this sample; request the actual Mongolia viewport and compare the same zoom with the provider viewer.
- **Mongolia font/language evidence:** Sample Planet v4 subdivision features around Ulaanbaatar have `name:en`, while their primary `name` contains traditional Mongolian characters. The current state-label text field selects `name` first. Read-only glyph requests for that exact style fontstack returned Cyrillic glyph IDs but no U+1800–U+18AF Mongolian glyph IDs in the corresponding range. This is a plausible additional rendering defect, not yet a device-proven cause. Prefer a tested language fallback or a fontstack that covers the chosen script, and verify the rendered result.
- **Alternative-source gate:** MapTiler Countries `level=1` features were present in sampled tiles across 19 countries, but Kenya samples included old province names such as Eastern and Rift Valley. Do not replace Planet v4 with Countries as an unquestioned current administrative source; validate legal/current units and freshness first. The first ad hoc glyph parser incorrectly treated glyph entries as field 2 and reported zero for all scripts, then failed on nested wire types; reading the actual PBF field structure and parsing field 3 corrected the count. Diagnostic parsers need a known-control range (Latin/Cyrillic) before their absence results are trusted.
- **Next action / prevention:** Compare the same country viewport and zoom in the MapTiler viewer and native app, inspect native style/tile/glyph errors and representative source features, then choose a provider style or custom global label hierarchy based on cross-country acceptance. Include China, Mongolia, Vietnam, and another country; do not infer global completeness from Vietnam alone.
- **Diagnostic-tooling incidents:** A read-only Windows CIM process query returned access denied inside the sandbox, and the Windows Store `python.exe` alias could not start; no app or user data changed. The equivalent `uv run python` dependency probe succeeded and found no installed vector-tile decoder. Use verified executable paths and host approval when a native-process check is necessary; avoid repeated guessed environment commands.
- **Device diagnostic update:** ADB initially could not start its daemon inside the sandbox; approved host execution found the Android device. A private temporary screenshot showed the Welcome screen, not Atlas. An attempted ADB `input tap` was rejected by Android's `INJECT_EVENTS` permission, and a supported Atlas deep link was delivered but the next screenshot showed the phone lock screen. No map viewport was observed, so this does not verify or refute the owner's global-label report. The screenshot files are temporary and outside Git. Next diagnostic requires the owner to unlock the phone and leave Atlas open at an affected country; do not bypass the lock or infer map behavior from Welcome. Two read-only `rg` probes also included nonexistent guessed paths and emitted path errors; use `rg --files` to resolve roots before searching.
- **Metro readiness-probe incident (2026-10-18):** A post-restart status probe treated Expo's byte-array response as a string and called `.Trim()`, producing a PowerShell display error even though the Expo CLI process was running. **Cause:** Response content type was assumed. **Correction:** Decode response bytes before examining the status body. **Prevention:** Probe local HTTP endpoints by their actual response type; do not interpret presentation errors as a Metro startup failure.

## Git worktree delivery command quoting (2026-10-19)

- **Date / task / area:** 2026-10-19; all-worktree commit preparation; PowerShell credential scan.
- **Status:** Corrected before repository inspection resumed.
- **Symptom/evidence:** A combined read-only coverage and credential scan failed to parse because embedded single quotes in the regular expression prematurely terminated the PowerShell string.
- **Cause:** The command mixed shell and regular-expression quoting without using a quoting-safe pattern.
- **Correction / verification:** Record this incident, then run the coverage and credential checks as separate commands using a double-quoted pattern with no embedded quote delimiter.
- **Prevention:** Keep shell-sensitive scans small and use quote-free or separately escaped regex patterns; do not combine unrelated verification steps in one PowerShell command.

## Git worktree delivery whitespace gate (2026-10-19)

- **Date / task / area:** 2026-10-19; all-worktree commit preparation; staged whitespace validation.
- **Status:** Fixed before commit.
- **Symptom/evidence:** The first staged `git diff --cached --check` stopped on a blank line at end of `_bmad-output/implementation-artifacts/spec-place-confirmation-tap-flow.md`.
- **Cause:** The pending generated implementation artifact ended with an extra blank line.
- **Correction / verification:** Removed the extra line and reran the staged whitespace check before committing.
- **Prevention:** Run `git diff --check` against the staged set immediately before every delivery commit, including generated documentation artifacts.
