# Error and improvement playbook

This is the project's durable record of mistakes and their prevention. The
mandatory workflow is defined in `AGENTS.md`. Read this index before implementation
or verification, then read entries relevant to the intended work. Search by affected
area, symptom, command, and rule when an incident occurs.

## Index

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
| EP-019 | BMAD context, epics anchor, fragment path | Verify a referenced Markdown anchor before extracting a context fragment | Fixed |

## EP-039: BMAD decision-log initialization hit a sandbox cache denial

- **Date / task / area:** 2026-10-15; Atlas map/list requirements; BMAD runtime.
- **Status:** Fixed; spec log created.
- **Expected / actual:** Initialize the new spec log. `uv run` emitted repeated access-denied warnings while persisting its interpreter cache in the Windows sandbox package directory and produced no initialization result.
- **Cause:** Environment cache-write denial before the BMAD script completed; no application defect identified.
- **Correction:** Reran the identical initialization outside the sandbox through the approval mechanism, then used that boundary for log appends.
- **Verification:** Initialization returned `ok: true` with zero entries; ten subsequent appends returned sequential counts 1–10.
- **Recurrence (2026-10-15, dimensional Atlas planning):** Configuration resolution through sandboxed `uv run` hit the same interpreter-cache denial. The queued read-only script commands also failed before Python ran. Configuration resolution and new spec-log initialization/appends succeeded through approved escalation. No application failure occurred. Strengthened preflight: after this environment's cache denial is known, request the approved execution boundary for subsequent BMAD script invocations in that session instead of re-probing the sandbox.
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

## EP-090: New-worktree Jest invocation did not transform TypeScript tests

- **Date / task / area:** 2026-10-18; reference-faithful Atlas cartography; isolated worktree verification.
- **Status:** Open; test-runner repair required.
- **Expected / actual:** Focused Atlas tests should execute after the bundled map conversion. The app-local Jest invocation instead stopped in parsing before any test ran, treating TypeScript annotations as JavaScript.
- **Cause:** Unknown. The worktree's app-local Jest/preset resolution needs investigation; this is not evidence of an application assertion failure.
- **Correction / next action:** Keep TypeScript checks as the only completed static verification. Reproduce against the established project test command, inspect preset/transform resolution, then run the focused Atlas and prototype owner-flow suites before accepting the implementation.
- **Prevention:** Distinguish a test runner boot/transform failure from failing product behavior and record the exact command context.
