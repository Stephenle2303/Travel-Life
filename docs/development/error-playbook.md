# Error and improvement playbook

## Android bundle missing shared share-protocol module report (2026-10-27)

- **Owner symptom:** The freshly built Android client reports missing shared
  modules such as the Supabase share protocol at runtime.
- **Status:** Cause not yet established. Treat this as a Metro/native bundle
  packaging regression until the current build's import graph and resolver are
  verified; do not attribute it to the CMake failure or claim the build usable.
- **Next action:** Inspect the committed cross-package imports, Metro resolver,
  generated Android bundle and current device error boundary before changing
  behavior. Add a regression that exercises the production bundle path.
- **Bundle evidence:** A clean Android Metro export fails earlier in
  `src/replay/renderer.ts` while resolving the tracked
  `meadow-thoughts.ogg` asset. The file is present in the committed checkout;
  Metro simply does not register OGG as an asset by default. This is a proven
  packaging defect, separate from the reported shared-protocol resolution
  concern. Register the intended offline asset extension and rerun a clean
  export before retrying native installation.
- **Correction:** `apps/mobile/metro.config.js` now explicitly registers
  `ogg`, with a regression test that asserts both that registration and the
  shared-protocol source is present. Repository checks pass; Android export
  evidence remains pending because this session's Expo process ended after
  Metro startup without producing an exit code or generated artifacts.
- **Verification-command incident:** A follow-up attempted to route the Expo
  command through `cmd.exe` with nested quoted output paths. Windows rejected
  the command before Expo started and no export log was created. This is not
  bundle evidence. **Prevention:** use one shell's native argument and log
  handling; do not compose `cmd.exe` quoting inside PowerShell for this check.

## Android device preflight PATH failure (2026-10-27)

- **Symptom/evidence:** `adb devices -l` could not run because `adb` was not on
  the current PowerShell PATH; no build or device operation started.
- **Prevention:** Resolve the Android SDK's installed `platform-tools/adb` path
  before device work and use that verified executable for both preflight and
  post-install checks.
- **Follow-up evidence:** The resolved SDK `adb.exe` could not start/connect to
  its daemon (`cannot connect to daemon`), so Expo stopped before Gradle or
  installation. This is a device-transport collection failure, not build or
  app evidence. Inspect ownership of the ADB port/process before one controlled
  restart; do not claim a rebuild from this attempt.
- **Follow-up evidence:** Once ADB was healthy, `expo run:android --device`
  stopped before build because non-interactive mode cannot show its device
  picker. Pass the already verified ADB serial explicitly on retry.
- **Correction:** The installed Expo CLI does not resolve the ADB serial through
  its `--device` value; that retry also stopped before compilation. Consult the
  installed CLI help and use its supported selector instead of repeating the
  serial form.
- **Runtime evidence:** The successful `installDebug` result installs an Expo
  development client, not a self-contained production bundle. Device logs show
  it launching normally and repeatedly failing to reach
  `ws://localhost:8081/message`; there is no native crash or
  share-protocol-resolution error in that launch. **Correction:** start Metro
  for the development client and create the USB `tcp:8081` reverse before
  evaluating the app. **Prevention:** distinguish an installed debug client
  from an app whose JavaScript development server is available; record the
  launch log before treating an installation result as device acceptance.

## Review workflow uv-cache permission failure (2026-10-27)

- **Symptom/evidence:** The code-review workflow resolver could not inspect the
  project virtual environment because its sandbox-local `uv` interpreter cache
  returned access denied. No review or source mutation ran.
- **Prevention:** When a required `uv` workflow command fails solely on its
  sandbox cache path, retry that exact read-only resolver with approved elevated
  filesystem access; do not treat the workflow as initialized or skip review.

## Commit index-lock permission failure (2026-10-27)

- **Symptom/evidence:** The authorized `git add`/`git commit` could not create
  `.git/index.lock` in the sandbox and therefore staged or committed nothing.
- **Prevention:** Retry the same authorized Git write with elevated filesystem
  access, then verify the commit identity and a clean primary checkout before
  reporting completion.

## M4.5 review bundle temporary-path isolation (2026-10-27)

- **Symptom/evidence:** A review diff written through the sandbox-provided
  per-command `$env:TEMP` path disappeared before the next command could read
  it. No product or private data changed; reviewers could not begin from that
  path.
- **Cause:** The sandbox assigns an isolated temporary directory per command,
  so that path is not a durable cross-command review artifact location.
- **Correction/prevention:** Use one verified host-shared temporary path for
  review bundles, check its existence and size before dispatching reviewers,
  and remove it after the review run. Do not treat a missing bundle as a clean
  review result.
- **Recurrence:** A validator inventory assumed a `package.json` despite the
  package using only its Dockerfile and Node entrypoints; the read failed before
  any change. Resolve a package's manifest with `rg --files` before targeting it.
- **Authorization boundary:** A proposed Edge adapter that would send selected
  derivative bytes to a configurable HTTPS validator was rejected because the
  owner approved Cloud Run in principle but did not identify the exact endpoint.
  No adapter was applied and no media left the device. Obtain the exact approved
  Cloud Run HTTPS URL before adding any egress path; never use a generic
  environment-configured destination as a substitute.
- **Browser setup:** The first Cloud Console tab request used an unsupported
  visibility option and made no browser change; reopening without that option
  succeeded. Use the browser capability's documented Chrome creation options
  rather than assuming in-app-browser visibility settings apply.

## M4.5/M4.6 continuation verification (2026-10-27)

- The mandated three independent reviewers could not start because each agent
  hit the shared account usage limit before it inspected a file. This is a
  review-availability blocker, not a clean review result. Preserve the
  review bundle and obtain independent review in fresh sessions; do not claim
  the requirement passed from parent inspection or local tests.
- The final focused mobile rerun passed 15 suites / 210 tests, including share
  selection, owner recovery, local derivatives, deletion fencing and the
  surrounding Atlas/Replay lifecycle boundaries. Expected closed diagnostics
  are printed by those tests. Keep test diagnostics distinct from production
  evidence and do not treat the result as Android/iOS acceptance.

- Cleanup refinement initially combined delete/add operations for one path in a
  single patch; the patch parser rejected it before changing files. Separate
  exact operations corrected the edit. Runtime cleanup now identifies lease,
  object deletion and acknowledgement failures separately with tests; Deno passes.
- A new media-gate diagnostic test found verifier unavailability reported at
  serialization stage. The guard now emits the known SHARE_VERIFY boundary;
  the regression passes without enabling media or changing transfer permissions.

- Hosting source review found the static CSP would block configured Google Maps.
  The generic viewer shell now receives per-response script/style nonces from
  its app-owned Vercel function, with strict-dynamic and no unsafe-inline/eval.
  The loader copies that nonce and sends only an origin referrer for restricted
  browser keys. Host tests verify the shell, but deployment/provider behavior
  remains unaccepted. An initial viewer-test invocation used a root test path
  from the viewer package directory and found no test; the root rerun is the
  actual test evidence. Prevention: use the package `npm test` or root-relative
  test command from its documented working directory.

- Actual synthetic codec execution found FFmpeg still emits `moov/udta/meta`
  and compressor fields despite metadata-removal flags. The terminal-moov
  scrubber now removes those fields without changing encoded sample offsets,
  zeros container timestamps, and rejects unsupported layouts. Structural
  checks reject external data references. Sanitized synthetic JPEG and H.264/AAC
  outputs pass both structural verification and real complete FFmpeg decode.
  Native phone encoders and the deployed validator remain unverified. The first
  idempotency test compared Buffer with Uint8Array prototypes; converting both
  to Buffer fixes the assertion without weakening byte equality. The initial
  shared helper typecheck also required an explicit Uint8Array annotation and
  mobile's TypeScript-extension import setting.

- Real rollback-only Postgres execution exposed `2201B`: PostgreSQL rejects
  the unpublished scaffold regex repetition `{1,256}`. Replaced the unsupported
  repetition; actual synthetic lifecycle, ownership, expiry, replacement,
  revocation, fence and privilege assertions then passed. Direct table/RPC and
  Storage metadata reads were also denied under anon/authenticated roles.
  These checks do not prove deployed HTTP or concurrent-connection behavior.
- Initial Deno typecheck found invalid optional-undefined CORS header unions
  and a Promise interface incompatible with the SDK's RPC thenable. Explicit
  header types and PromiseLike corrected both; actual Deno checks pass.
- Browser QA exposed same-tab fragment navigation retaining the old recipient
  surface. The viewer now clears the root synchronously and reloads to consume
  the new capability. Contract tests pass; follow-up browser verification is
  open because browser use was disabled in Work settings during this task.
- Tooling: sandbox registry DNS failed; an approved npm fetch supplied pinned
  Deno 2.9.6 locally. Sandbox localhost servers listened but browser requests
  timed out; an initial duplicate start hit EADDRINUSE. After checking exact
  process command lines, only task-owned servers were stopped and restarted
  with approved networking. Desktop/390px browser QA then worked. Full-page
  screenshot timed out; normal viewport screenshots succeeded.
- Inspection recurrence: parent guessed missing share-highlight-screen and
  privacy/history controller paths despite the existing lesson. No source was
  changed by these reads. Prevention: resolve import paths or `rg --files`
  inventory before each unfamiliar file read, not guessed folder names.
- Runtime access: Supabase connector and browser use became unavailable after
  earlier successful checks. Preserve that earlier bounded evidence, but do
  not claim a deployed service, browser retest or device acceptance.

## M4.5 continuation tooling preflight (2026-10-27)

- Review found protected recovery chunks were bounded by JavaScript code units, exceeding SecureStore byte limits for Vietnamese/CJK and splitting astral characters. Chunk by UTF-8 codepoint byte length, validate old generation headers, and treat obsolete-chunk cleanup after header commit as best effort. Unicode roundtrip/bounds regression passes; owner suite now 8/8. Prevention: keychain limits are bytes, not string length.

- Parent forced hard media-verifier failure and found it reported SHARE_SERIALIZE instead of the known SHARE_VERIFY boundary. The gate now uses SHARE_VERIFY; HTTP failure/regression tests pass. Prevention: assert exact operation/stage as well as deny status for unavailable service gates.

- Never-published local deletion initially queued remote work without an owner session, producing permanent false pending removal. A durable minimal ever-remote-intent marker now precedes the first publication network boundary; absent marker/queue permits purely local deletion without creating credentials. A lost prior owner's credentials retain pending removal. Both paths have passing owner-service regressions.
- Derivative fault tests initially left mocked async cleanup returning undefined, so fixture cleanup masked the intended classified failures. Make async FileSystem mocks return promises and rerun; copy/decode/encode/verify fault and private sentinel checks now pass 4/4.

- Scoped whitespace check found extra EOF blank lines from PowerShell Set-Content round trips. Trim only task-touched file endings and rerun whitespace validation. Line-ending normalization warnings alone are not product failures.

- The first native screen tests called React Native Testing Library v14 render synchronously, leaving `screen` unset. Await render and user events; current selected screen/owner/lifecycle checks pass 15 tests. Prevention: follow the installed runner's async API.
- Typed upload bytes became `Uint8Array<ArrayBufferLike>` after splitting the local copy boundary; fetch accepts the concrete backing ArrayBuffer. Typecheck caught it before delivery; use an explicitly typed ArrayBuffer body and rerun typecheck.
- Auto-review rejected wiring selected private derivative bytes to a configurable remote validator because the specific payload/destination was not authorized. No transfer adapter was written or executed. Keep media publication hard-disabled. App-owned Node validator package is reviewable; completing its HTTPS integration requires the chosen host and explicit authorization for selected derivative processing, followed by runtime verification. Do not route around this denial.

- Shared pure protocol tests exposed Babel helper lookup outside the mobile package when importing the cross-runtime contract. Add the package node_modules to Jest `modulePaths` and Metro's workspace resolver; rerun the real owner tests. Owner/lifecycle suites pass 12/12 after correction.

- Native derivative inspected result uses both the pinned SDK's `returnCode` and `success` fields; the current renderer uses `success`. Both are declared by munim-ffmpeg. No observed native defect is established by the different valid property; align the derivative guard with `success` and verify synthetic return behavior.
- New Jest owner fixture initially referenced hoisted `auth`/`values` outside the mock factory allowlist. Rename lazily accessed stores to `mockAuth`/`mockValues`; rerun actual suite rather than treating collection failure as a behavioral result.
- Path discovery guessed absent mobile metro config/app/private-record paths and one Get-Content repeated positional/LiteralPath arguments; later guessed share-highlight-screen/privacy-controller paths also failed. No source changed from these reads. Use `rg --files` then literal existing paths; avoid reading compact single-line geometry JSON into tool output.
- Two broad patches failed because a partial JSX line did not match the exact live source, including one diagnostic-stage patch. Re-read live context and use exact independent mutations; failed patches are not source evidence.
- Browser synthetic QA found same-document hash changes retained previous recipient content. Parent now clears old UI and reloads after consuming changes; subsequent browser verification became unavailable when browser tooling was disabled. Initial desktop/mobile interaction evidence remains valid; changed-fragment regression stays host-tested until browser reconfirmation.
- Browser harness sandbox sockets caused localhost timeouts; duplicate approved launch found occupied ports. Only inspected owned processes were stopped and the harness was restarted with approved networking. A full-page screenshot timeout recovered with viewport captures. These are collection/tool boundaries, not product-runtime evidence.
- Automatic approval review temporarily rejected a mutation/check batch because the account usage limit prevented review. Neither action ran. Following continuation, native mobile typecheck passed; reapply only missing edits.
- Security audit found bounded MP4 structural checks cannot prove decoded content/metadata safety (opaque sample/data-reference boxes). Added a hard runtime deny for all media publication/upload until a trusted bounded decoder integration passes acceptance. Local exact derivative preview remains available. Media delivery is explicitly incomplete; documentation alone must never enable sensitive upload.

- Initial native Deno typecheck found SDK RPC returns a thenable rather than a full Promise and the conditional CORS object inferred undefined header values. Corrected to `PromiseLike` and explicit string header records. Prevention: typecheck Edge modules with actual cached SDK declarations, not only Node runtime tests.
- The parent loaded a later Build review step before implementation acceptance was complete; no source behavior changed. Keep later-step reads until current-step acceptance audit completes.
- Registry discovery initially failed under sandbox network restrictions; approved fetch obtained pinned Deno 2.9.6 in the ignored local tool cache. Tool transport failures do not establish a dependency/product defect.

- Real Postgres rollback validation found the unpublished scaffold used a regex repetition bound `{1,256}`, which PostgreSQL rejects (maximum repetition bound 255). Changed that unpublished digest regex to its safe unbounded character allowlist; new v1 runtime requires exactly 64 hex digest bytes. Prevention: execute migration and inserts on real Postgres, since static source checks do not compile regex constraints.

- The installed Supabase CLI exited before migration creation because its telemetry startup attempted to write outside the sandbox at the user profile. No migration or remote schema changed. This is a tool filesystem failure, not database evidence. Next action: use a supported isolated CLI profile or obtain approved CLI execution; preserve the existing untracked migration while preparing changes.
- An initial large context read exceeded the output budget, so individual spec companions were read again with bounded output. Prevention: inspect document sizes and batch only bounded useful reads.
- Parent discovery included a nonexistent root `.env.example` and `rg` returned 1; use `rg --files` to identify existing paths before searching explicit optional files.

## M4.5/M4.6 documentation fetch boundary (2026-10-27)

- Evidence: the web reader rejected the Supabase changelog Markdown endpoint
  with unsupported `text/markdown` content type. This is a documentation-tool
  limitation, not a Supabase runtime failure.
- Next action: fetch the index through a supported HTTP client or the HTML
  changelog and use official documentation/MCP search for relevant APIs.
- Prevention: do not infer service availability from a documentation renderer
  failure; verify docs through another supported reader before implementation.

## Share Replay loses later-trip media after card selection (2026-10-27)

- **Owner evidence:** The Share trip list contains later trips, but the
  selected video renders media only for the first trip and title cards for the
  rest.
- **Verified source cause:** The Share screen derives `selectedMemoryKeys` from
  its bounded editor-preview manifest. `preparePrivateReplay` then treated that
  partial screen list as the exact export media composition even after it had
  freshly resolved the full local manifest.
- **Verified correction:** For a selected trip set, the provider now ignores
  bounded screen-preview media as composition authority and derives media from
  its freshly resolved committed plan. It still rejects unknown, unavailable,
  excluded, or unselected-group media when a caller supplies it. The focused
  provider and screen suites pass 129 tests; mobile typecheck and lint pass.
- **Status/next action:** Host correction complete; reload the owner Android
  client and verify that choosing multiple trips shows their media in the exact
  subset preview before opening the share sheet.
- **Prevention:** A selected-trip API must treat selected group keys as scope
  authority and calculate media composition at the provider boundary, not from
  screen preview availability.
- **Verification recurrence (2026-10-27):** A follow-up focused Jest command
  attempted to select a local cache through `JEST_CACHE_DIRECTORY`, but this
  configuration is not consumed by this Jest setup; it still used the sandbox
  Temp cache and stopped with `EPERM` before collecting tests. Use the explicit
  `--cacheDirectory .jest-cache-codex` (or another ignored repository-local
  cache directory) argument on every mobile Jest invocation.
- **Documentation recurrence (2026-10-27):** A project-state evidence patch
  used stale surrounding text and was rejected before it changed a file.
  Re-read the live header and apply only against exact current context; never
  treat a rejected documentation patch as delivery evidence.
- **Test-patch recurrence (2026-10-27):** An initial regression insertion used
  a stale neighboring test name and was rejected before changing the suite.
  Read the immediate live test block before anchoring a narrow patch.
- **Cover-test and path recurrence (2026-10-27):** The first green-path cover
  assertion read the tree before React committed the asynchronous preview, and
  an accompanying source search repeated the repository prefix from the mobile
  package directory. The former is a test timing issue, not a cover regression;
  await the rendered poster, and use `src/...` paths from `apps/mobile`.
- **Cover-fixture recurrence (2026-10-27):** The same cover test omitted the
  parent prepared Replay fixture, so the Share-review card panel had no parent
  preview to render even after the cover page arrived. Fixtures that inspect
  Share cards must provide the private parent artifact as well as the paged
  cover response.
- **Package-root recurrence (2026-10-27):** A provider-suite command was run
  from the repository root, where `npm test` invokes the foundation runner and
  ignores mobile Jest paths. It did not execute provider assertions. Run mobile
  Jest only from `apps/mobile` with its explicit local cache argument.
- **Owner re-report (2026-10-27):** The first Share-card cover correction
  passed its synthetic case but the owner still sees a cover only for the first
  trip. The test modeled a later committed item with `available: true` and only
  a missing URI; it did not model the bounded-manifest state where later media
  is initially unavailable until its preview page is resolved. Investigation is
  open; do not describe the device UI as fixed.
- **Follow-up cause (2026-10-27):** After correcting the page request, the
  screen obtained the later trip's URI but `shareableCommittedTrips` still
  selected card covers from the opening-page-derived export-memory list. The
  renderer/export boundary was correctly separate, but the visual cover reader
  was not. Card covers must use the dedicated local cover-candidate scope while
  the selected-video manifest remains committed-media-only.
- **UI migration patch recurrence (2026-10-27):** An Atlas list-card patch was
  rejected because its state-hook context was stale. No source changed. Re-read
  the current component block and split wide cross-file patches into exact,
  independently verifiable edits before retrying.
- **Timeline-cover test recurrence (2026-10-27):** A pre-existing Atlas detail
  assertion assumed its photo preview label was unique. The new Timeline cover
  deliberately uses the same owner-safe label, so the focused suite failed on
  the test query rather than application behavior. Assertions shared by a list
  and detail surface must select the intended instance or assert the count.
- **Build-workflow path recurrence (2026-10-27):** A workflow inspection
  command guessed obsolete `step-01-intake.md` and `step-02-context.md` paths
  after rendering the current Build workflow. The reads failed before source
  changes. Follow the rendered workflow's exact first-step path rather than
  inferring historical step names.
- **Edit-cover preload test recurrence (2026-10-27):** After adding the
  expected overview-cover read, two gallery tests assumed their first mocked
  preview call would begin only after a tile tap. The new valid overview read
  consumed that response, so the test no longer represented the intended
  unresolved-tile state. Keep one mocked empty overview read, one empty gallery
  read, then the held tile-tap read whenever a test exercises that sequence.
- **Trip-list cover migration correction (2026-10-27):** The owner reported
  that the Share-equivalent card shell in Edit Replay and Atlas had no image
  covers. Source inspection verified three separate omissions: Edit overview
  never called its existing paged preview resolver and ignored resolved
  overrides when choosing a cover; Atlas stopped after an empty detail preview
  instead of asking its first local media page; and Atlas passed video URIs
  straight to an image view rather than Share Replay's poster path. The
  correction resolves optional covers only through the existing private
  boundaries and uses one shared local thumbnail/poster component. Focused
  Atlas/Replay tests (111), mobile typecheck and lint, and root `npm run check`
  pass. Fresh owner Android/iOS visual confirmation remains open.
- **Prevention:** Every migration of a trip-card surface must test an opening
  manifest/detail without a URI, a later paged cover response, and a video
  poster. Do not declare visual parity merely because the card shell is shared.
- **Documentation patch recurrence (2026-10-27):** Two initial
  project-state/error-playbook/spec patch attempts used an incomplete
  first-header anchor and were rejected before changing any file. Re-read the
  complete exact paragraph, then keep documentation patches narrowly scoped to
  the live text.
- **Review-regression typing recurrence (2026-10-27):** The first deferred
  race test counted calls by referring to its `jest.fn` variable inside that
  variable's initializer. Jest executed it, but TypeScript rejected the
  self-referential inference and nullable resolver narrowing. Use an independent
  request counter and initialize the resolver to a typed no-op in
  deferred-promise tests; run `npm run typecheck` after every test-only patch.
- **Patch-format recurrence (2026-10-27):** A combined two-file patch was
  rejected by the patch tool as malformed before changing files. Apply the
  source correction and its playbook record as independently valid patches when
  the patch parser rejects a combined edit.
- **Atlas concurrent-cover correction (2026-10-27):** The owner reported that
  Atlas still showed no representative photos. The verified cause was
  `loadJourneyDetail` and `loadJourneyMediaPage` each calling
  `durableRevealGate.next()` for a read-only request. Atlas deliberately
  requests up to four covers concurrently; each later request therefore made
  sibling reads fail the generation check as falsely stale. Reads now snapshot
  the current generation and continue to reject only after a real lifecycle or
  privacy invalidation. The provider also now rejects both reads before native
  access when the private record is already disconnected. Focused provider/Atlas tests (97), mobile typecheck and
  lint, and root `npm run check` pass.
- **Prevention:** Do not use a replacement/cancellation generation to serialize
  independent read-only card loads. Concurrent UI lists need a shared lifecycle
  snapshot, plus a regression that resolves at least two reads together.
- **Device-collection limitation (2026-10-27):** The local Android SDK `adb`
  executable was unavailable, and no Travel Life device window was open for
  inspection. This is not evidence that the owner-reported physical UI is
  fixed. Rebuild/reload the owner client and verify multiple Atlas Timeline
  cards with real local photos before closing device acceptance.
- **Workflow-read recurrence (2026-10-27):** A Build workflow inspection read
  the one-shot step before the required first routing step. The source files
  were unchanged, but future workflow runs must read and execute one step at a
  time in the stated order.

## Share Replay re-review: card-only guard, native Back and working audio (2026-10-27)

- **Verified cause and correction:** The implementation had a card-only preview guard tied to selected media, native-return paths without a late-render fence, working-draft audio at the subset boundary, stale-error collapse, and no refreshed permission/artifact-scope check immediately before native handoff. The correction gates on committed trips, fences every exit, reads the saved Replay soundtrack, retains the closed stale reason, and reloads permission plus exact registered-artifact membership before sharing.
- **Status:** Host-code correction complete. Screen 72/72, provider 56/56 and renderer 12/12 pass, as do mobile typecheck/lint, root `npm run check`, and whitespace validation. Android/iOS owner acceptance remains open: host mocks cannot establish a physical card, a playable subset file after permission change, or target-system chooser behavior.
- **Prevention:** Exercise card-only choice through Preview, every navigation entry with a deferred render, Edit audio Done/Back without Update, revoked permission before dispatch, and changed media/group membership. Assert the actual provider manifest and closed diagnostic rather than only a screen mock.
- **Verification incident:** The review's initial three-suite run passed 130 tests but the durable-cache-open screen test timed out at 5 seconds. The final combined rerun passed all 140 tests using the repository-local Jest cache and unchanged timeout. Keep the first timeout distinct from the final green run when diagnosing future harness flakiness.
- **Inspection recurrence:** A delegated review guessed nonexistent `replay/manifest.ts` and a storage glob before using actual source paths. These were read-only inspection failures, not runtime defects; reuse the existing path-inventory lesson and resolve files with `rg --files` first.

## Facebook or Messenger absent from Android Replay share targets (2026-10-27)

- **Owner evidence:** The verified Share Replay sheet did not show Facebook or
  Messenger as an option.
- **Verified device evidence:** Replay passes a verified `video/mp4` handoff to
  Android's native chooser without target filtering. The connected Android
  device has no installed `com.facebook.katana`, `com.facebook.orca`, or
  `com.facebook.lite` package, so the OS cannot advertise either target.
- **Status/next action:** This is device availability, not an app routing
  failure. Install and sign in to the desired Facebook or Messenger app, then
  reopen `Share video`; Android resolves the chooser targets at that moment.
- **Prevention:** Check installed target packages before adding app-specific
  routing or blaming the share handoff. Keep the generic verified MP4 chooser so
  every installed compatible target remains eligible.

## Share Replay hides committed chapter-only trips (2026-10-27)

- **Owner evidence:** In Share Replay, only the Taiwan trip appears even though
  the private Replay contains additional trips.
- **Verified source cause:** `shareableCommittedTrips` derives cards solely from
  `shareableCommittedMemories`, which removes any committed group with no
  currently `available` selected media. `planPrivateReplay` still produces a
  private chapter for every eligible included group, including a truthful local
  chapter card when its selected media set is empty. The selection UI therefore
  narrows the committed Replay's trip scope incorrectly.
- **Verified correction:** Share candidates now derive from ordered committed
  Replay groups, with an optional cover from committed eligible media. The
  selected-group boundary is carried to `preparePrivateReplay`, so a selected
  chapter-only trip remains in the preview manifest while only committed
  eligible media becomes renderer input. Focused screen and provider suites
  pass (66 + 53 tests), as do mobile typecheck and lint.
- **Status/next action:** Host correction complete; owner Android validation is
  still required to confirm the current private Replay lists every expected
  trip and that a chapter-only choice stays in the exact preview.
- **Prevention:** Derive share choices from committed Replay chapters/groups, not
  from the nonempty media subset. A missing local media item must not erase an
  otherwise committed trip card or silently change the selected-video scope.

## Mobile test path typo during chapter-only replay verification (2026-10-27)

- **Symptom/evidence:** A provider-test inspection from the `apps/mobile`
  working directory repeated the `apps/mobile` path segment and PowerShell
  reported that the file did not exist. No source or runtime state changed.
- **Cause/correction:** The command mixed repository-root and package-root
  paths. Retried with the package-relative test path and completed the focused
  119-test suite.
- **Prevention:** Once a command changes to `apps/mobile`, use `src/...` paths
  there; reserve `apps/mobile/src/...` for the repository root.

## Android reload blocked by unavailable local ADB daemon (2026-10-27)

- **Symptom/evidence:** A read-only device check with the configured Android SDK
  `adb.exe` could not start or connect to its daemon at `tcp:5037`; no device
  command, application reload, storage mutation, or private-data inspection ran.
- **Cause/status:** The host ADB daemon is unavailable. The cause is not yet
  established; do not attribute it to the Replay change or the connected device.
- **Next action/prevention:** Restore the host daemon or reconnect/unlock the
  owner device, then verify `adb devices -l` before issuing one normal app reload.
  Treat a failed transport preflight as a tooling boundary, never as Android
  runtime evidence.

- **Verification-command incident:** The package identity check succeeded, but a
  follow-on PowerShell `Select-String -First` option was unsupported on this
  host, so package version metadata was not read. No device state changed.
  Prevention: use `Select-Object -First` after `Select-String` on this PowerShell
  version; do not interpret a formatting-pipeline failure as an ADB/package error.

- **Verified launch correction:** The first restart launched Expo Dev Launcher
  rather than the Travel Life JS runtime because the device had no restored
  `tcp:8081` reverse mapping and received only the package launch intent.
  Restoring `adb reverse tcp:8081 tcp:8081` and opening the installed
  `exp+travel-life` development-client URL reached `MainActivity`; the filtered
  log then recorded React Native `Running "main"`. No storage was cleared or
  modified. Prevention: verify the reverse mapping and target the configured
  development-client URL when reloading a local Expo development build.

## Thread-inspection argument limit (2026-10-27)

- **Symptom/evidence:** The first inspection of the paused Share Replay thread used
  `read_thread` with `turnLimit: 20`; the Codex thread API rejected it because the
  supported maximum is 10. No repository or runtime behavior changed.
- **Cause/correction:** The caller assumed a larger page size. Retried with the
  documented maximum of 10 and obtained the thread history.
- **Prevention:** Respect the tool's bounded pagination contract; request older
  thread content through its cursor rather than increasing `turnLimit`.

## Share Replay asks for media reselection instead of trips (2026-10-26)

- **Symptom/evidence:** Owner reports that Share Replay asks for photos again. Source review confirms `replay-screen.tsx` flattens committed Replay media into individual numbered photo/video buttons and tracks `shareMemoryKeys`, rather than offering the trips used in Replay.
- **Verified cause:** The share selection unit is media instead of the owner's intended trip unit. The export handler also renders the selected subset and opens the OS sheet without a separate exact-subset preview.
- **Status/next action:** Open runtime mismatch. Review and acceptance cases are recorded in `_bmad-output/implementation-artifacts/review-share-replay-trip-selection-2026-10-26.md`; this discussion does not implement or verify the correction.
- **Prevention:** Trace the owner's selection unit through UI, committed Replay composition and exported manifest. Verify that choosing a trip inherits only its committed media, preserves order/music, and previews the exact subset before explicit export; do not substitute album reselection for sharing an existing Replay.

## Replay native share delivered an empty Gmail attachment (2026-10-26)

- **Owner evidence:** Gmail accepted a Replay attachment created by the native share sheet, but the received file was empty. This is a P0 export/share integrity failure; a closed share-sheet result proves only that Android closed the sheet, not that the recipient received usable bytes.
- **Source evidence after owner retest:** Gemini can open the same Replay video, so a renderer-wide empty file is disproven. Source review also found the initial guard reconstructed a persistent Replay as silent even when its committed soundtrack is AAC; that can incorrectly block sharing before Gmail opens. The exact Gmail import cause remains unproven because ADB diagnostics cannot currently start.
- **Correction:** Recover the current committed soundtrack for persistent artifacts. Copy every verified source MP4 to a fresh app-private cache handoff file, reopen and stream-verify that handoff, then dispatch only that immutable copy through Android's native Sharesheet. A handoff failure retains the private preview and records the fixed `REPLAY_EXPORT / SAVE_FAILED / REPLAY_HANDOFF` event; no recipient, path, raw native message or private media data is logged. The UI explains that Gmail, Messenger and Facebook appear only if their installed app accepts the system video target.
- **Verification/next action:** Renderer RED/GREEN regressions cover immutable handoff dispatch and its closed failure. Build a fresh Android client, send a synthetic-safe Replay through Gmail, and confirm the received attachment plays. Confirm Messenger/Facebook target availability only on a device where each is installed; host tests cannot prove either physical target.
- **Prevention:** Native share success requires local source existence, positive byte size, valid stream structure, and an independently verified handoff copy at the last possible boundary. Treat recipient-visible empty attachments as failed export evidence, never as a successful share.
- **Verification incident:** The first closed-handoff regression saw a `shareAsync` call retained from the preceding success test, so it falsely appeared to dispatch after the failing handoff. The product branch already returned `handoff-failed`; clearing the target mock at the test boundary isolates the assertion. Prevention: tests that assert a boundary was not invoked must reset that mocked boundary before exercising the negative path.

## Replay release consolidation tooling and review boundaries (2026-10-26)

- **Commit boundary incident:** The first approved stage command was not executed because automatic approval review reached an account usage limit. This was a tool-review availability failure, not a finding that the scoped Git action was unsafe. After the owner explicitly requested continuation, read-only inspection confirmed the index remained empty and the same reviewed stage action succeeded through the approved boundary. No alternative tool was used to bypass the rejected approval.
- **Staged whitespace incident:** The final cached-diff check also examines newly staged files, unlike the earlier tracked-only check, and found a trailing blank line in the new Replay execution record. Removed the extra blank line and repeated the cached check before commit. Prevention: include new files in the final index-level whitespace check.

- **Owner evidence:** Owner confirmed the normal Android edit/exclude/custom-audio Done/Update/new-video flow, then authorized a review/commit of accepted Replay work and retirement of superseded worktrees. This does not establish every canonical acceptance case or iOS/performance evidence.
- **Inspection incidents:** Sandboxed Git commands against external worktrees reported that they were not worktrees, including an explicit work-tree attempt. Approved host Git reads established their actual tracked WIP before preservation. One workflow read assumed `step-03-present.md`; the actual next files are `step-03-triage.md` and `step-04-present.md`. Initial reviewer prompts used per-command sandbox Temp paths inaccessible to other agents; their missing-input results were incomplete, not clean reviews. Shared ignored `.local` copies allowed all four actual review lenses to finish. Prevention: inventory exact step files, use the approved host boundary for external Git state, and publish review inputs to a shared workspace path as well as the required Temp artifact.
- **Verification incidents:** A scheduler reviewer first used the default Jest Temp cache and encountered the known EPERM atomic-rename boundary before tests. Rerun used a repository-local cache. A new test's untyped zero-argument Jest mock also failed TypeScript when inspecting a mutation argument; the explicit mock tuple corrected it. Focused scheduler tests and typecheck then passed. A follow-up task dispatch hit the four-agent runtime limit; no task or source mutation occurred, and dispatch resumed once a slot was available.
- **Corrections/preservation:** Fresh post-timeout pending callers now settle publicly; definitive receipt conflicts remain conflicts; fenced operations may reconcile without reviving discarded intent. Three old worktree HEADs and tracked WIP are preserved by annotated local tags before pointer retirement. No old source was blindly merged and no checkout data/dependencies were deleted. An obsolete untracked legacy-architecture build helper was moved intact into a non-executable documentation archive.
- **Open boundaries:** The consolidation review records remaining fault-recovery, retained-Auto and overview-shortcut gaps rather than claiming the entire canonical spec done. Concurrent M4.5 and diagnostic-policy edits are excluded from staging. Final checks and commit identity belong in the release review record.

## Specific diagnostics existed but were not a universal delivery gate (2026-10-26)

- **Owner requirement:** Every implementation must emit specific actionable diagnostics so a failure is located from actual logs rather than broad speculative inspection. Existing AGENTS.md and mobile logger/lint/tests already required closed privacy-safe events, and prior lessons required specific categories; workflow/BMAD lacked an explicit per-feature source map, collection recipe and completion evidence gate.
- **Correction:** Added diagnostic-implementation-policy.md, strengthened AGENTS/workflow and wired supported team overrides for Build, Build Auto and developer agent, including context-free implementation handoffs. Added M4.5 diagnostics companion and AC-25–28. Runtime instrumentation itself remains a required implementation deliverable, not established by these policy changes.
- **Prevention/verification:** Root policy-wiring regression checks retain entry-point loading and handoff/spec requirements; resolver validation checks actual merged customization. Per-feature fault/redaction/correlation tests and real-runtime evidence remain necessary. No rule can guarantee every root cause is immediately known; UNKNOWN must retain the exact observed boundary and never justify a guessed cause.
- **Tooling recurrence:** The audit itself repeated an unexpanded `_bmad/custom/*` rg path and tried a guessed integrity test filename; both reads failed without source mutation. Inventory confirmed tests/integrity.test.mjs and actual custom files; continue with actual directory operands and rg --files, including for audit commands. Do not infer absent policy from a failed search.
- **Verified governance evidence:** Build, Build Auto and developer-agent resolvers load the new policy; root check passes pinned framework integrity, 23 tests (three policy-wiring checks) and eval smoke. M4.5 companion links/IDs/28 acceptance cases and scoped whitespace pass. This confirms rule propagation, not that unimplemented sharing paths already emit runtime diagnostics.

## Replay review: failure preview lifetime and settings Reset order (2026-10-26)

- **Evidence/cause:** Release review traced three uncovered boundaries: failed finalization deletes newly created chapter files while the screen retained the first chapter player; explicit Re-render deleted the prior verified video before replacement while recovery retained its URI; Reset changed the editor order but left Music & order's independent order snapshot unchanged, allowing Done to restore newest-first.
- **Correction:** Failed preparation now clears its progressive preview and shows the fixed failure/retry state. Re-render invalidates the renderer while preserving the verified file until replacement succeeds. Reset updates both editor and sheet order to oldest-first, retaining the committed soundtrack.
- **Verification:** Replay-screen/provider focused suites pass 109 tests, including reclaimed-first-preview failure, preserved prior-video failure recovery, cleanup after successful replacement, provider preserve-file versus normal discard, and Reset followed by Done. Mobile TypeScript passes. These are host regressions; they do not replace owner device playback evidence.
- **Prevention:** Cover derivative-file lifetime alongside UI recovery states, assert normal cleanup separately from invalidation, and exercise sheet Done after commands that change the main editor snapshot.

## M4.5 specification readiness overstated after structural validation (2026-10-26)

- **Symptom/evidence:** The spec-preparation handoff said ready for implementation after structural/source checks and root foundation checks. Subsequent owner-requested independent review found missing delete-all/activation fencing, derivative immutability, raw-token recovery, expiry semantics and replacement-cancel behavior. Full evidence is in `_bmad-output/implementation-artifacts/review-m4-5-selected-share-snapshots-2026-10-26.md`.
- **Cause:** Structural preservation and passing foundation checks were treated as stronger evidence of behavioral completeness than they provide. Overlapping reviewers corroborated six distinct lifecycle/protocol concerns.
- **Status/correction:** Open specification gaps; readiness claim superseded in project state and execution adapter. No sharing runtime exists to claim fixed, and this review does not silently choose new cancellation behavior. Next action: resolve via bmad-spec, rederive companions and add controlled race acceptance cases before another behavioral review.
- **Prevention:** Trace activation, cancellation, delete-all, object writes, token acknowledgement and retention expiry through interleavings; distinguish document shape checks from protocol/state-machine completeness in handoffs.

## M4.5 spec source-discovery path and documentation fetch assumptions (2026-10-26)

- **Symptom/evidence:** Spec preparation attempted an absent planning-artifacts/architecture.md and a PowerShell rg directory argument containing an unexpanded wildcard; those reads failed. The web reader also rejected Supabase changelog.md's text/markdown content type. No application mutation or verification success was inferred from these failures.
- **Cause/correction:** Assumed source paths and tool content-type support. Used rg --files to inventory actual planning/service sources, removed the wildcard path assumption, and read the official HTML changelog instead. Existing decision 0005 and source inventory ground the spec; no nonexistent architecture is cited.
- **Prevention:** Inventory candidate paths before targeted reads; pass actual directories to rg on Windows; use the official HTML documentation fallback when a Markdown response is unsupported. Root checks and local spec-link validation are recorded in the M4.5 execution adapter, independently of source-discovery results.
- **Review recurrence:** An independent reviewer repeated the unexpanded `spec-m4-5-selected-share-snapshots/*.md` rg path and received OS error 123; all required files were already read. Strengthened check: pass the existing directory and `-g '*.md'` separately rather than a wildcard path, including delegated review instructions.

## M4.5 implementation source-path assumption (2026-10-26)

- **Symptom/evidence:** During the first M4.5 code-map pass, a read targeted `apps/mobile/src/reveal/provider.tsx`, which does not exist, so PowerShell returned a path-not-found error. No source, service, account, or private data changed.
- **Cause/correction:** The implementation assumed a conventional provider location instead of using the repository inventory. The actual eligibility boundary is `reconstruction/repository.ts` and the visible owner surface is composed through the app/components layer. The delivery spec now records verified source paths before edits.
- **Prevention:** For every new M4.5 integration point, run `rg --files` and then target the resolved file. A failed path inspection is not evidence that an implementation boundary is absent.

## M4.5 Edge Function runtime check unavailable on this host (2026-10-26)

- **Symptom/evidence:** The M4.5 verification command could run the focused mobile Jest suites and Expo lint, but `deno --version` failed because no Deno executable is installed or available on PATH. This is a host-tooling absence, not a successful Edge Function typecheck and not evidence of a service failure.
- **Status/next action:** The function follows the checked existing Supabase function envelope and is covered by source/diff review only in this checkout. Run `supabase functions serve travel-life-share` or a pinned Deno typecheck in an environment that supplies the project Supabase/Deno tooling before deployment or backend acceptance.
- **Prevention:** Probe required backend executables before presenting a combined mobile/backend verification command. Report unavailable tooling as inapplicable; do not infer backend validity from mobile TypeScript or Jest.

## M4.5 image derivative dependency was only declared in offline mode (2026-10-26)

- **Symptom/evidence:** The offline Expo install added `expo-image-manipulator` to `apps/mobile/package.json` using the local SDK map, but the first derivative Jest test could not resolve the package because it was not present in `node_modules`. No derivative code or owner media ran.
- **Cause/correction:** Offline compatibility selection does not download a missing native module. The approved host Expo install then added the SDK-57 package; its audit reported nine existing dependency advisories and two pre-existing postinstall scripts awaiting the repository's allow-scripts policy. Neither advisory count nor script warning is a claim about the new feature's security.
- **Prevention:** After an offline managed-module install, verify package resolution before starting RED/GREEN. Treat audit findings and denied postinstall scripts as separate dependency-governance items; do not run force fixes or approve scripts without explicit scope.
- **Recurrence:** The approved online install of `expo-crypto` and `expo-secure-store` reported the same nine repository dependency advisories and unchanged two unapproved postinstall scripts. The modules installed successfully; no audit fix, script approval, dependency upgrade, or security conclusion was made. Continue to keep package additions SDK-scoped and record advisories without broadening into an unauthorised dependency-repair task.

## M4.5 publish-controller optional-signal contract mismatch (2026-10-26)

- **Symptom/evidence:** The new controller's success regression failed although the result was staged: it invoked the injected transport with a second `undefined` argument, while the established optional-signal call shape uses one argument when no signal exists.
- **Cause/correction:** The controller forwarded an optional parameter unconditionally. It now calls the one-argument transport form without a signal and only passes the second argument for a real cancellation signal.
- **Prevention:** Test injected-boundary call shape as well as return value whenever optional cancellation/metadata arguments affect retry or logging semantics.

## M4.5 draft test object syntax correction (2026-10-26)

- **Symptom/evidence:** The first draft-creation RED test had a misplaced object/array delimiter, so Jest stopped at parsing rather than exercising the intentionally missing draft module.
- **Cause/correction:** A one-line nested fixture obscured the mismatched delimiter. The fixture is now multiline and parsed before continuing to the intended module-missing RED state.
- **Prevention:** Keep nested privacy/selection fixtures multiline and validate that a RED test reaches its intended missing behavior rather than only parser/setup failure.

## M4.5 project-state patch context mismatch (2026-10-26)

- **Symptom/evidence:** A project-state update patch used a stale wrapped paragraph and `apply_patch` rejected it before modifying any file.
- **Cause/correction:** The expected context split a sentence at a different line boundary than the actual document. Read the current local excerpt and reapplied the update with exact context.
- **Prevention:** For long evolving status paragraphs, read the immediately current target before patching and use a short unique context window rather than reconstructing prior wrapping.

## M4.5 environment discovery repeated Windows wildcard/path assumptions (2026-10-26)

- **Symptom/evidence:** A repository search passed `.env*` to `rg` on PowerShell and guessed a root `app.json`; Windows rejected the wildcard filename and the root file was absent. The resolved mobile `.env.example` still established the actual Supabase environment names.
- **Cause/correction:** The search mixed shell-glob and guessed-root conventions rather than inventorying concrete files.
- **Prevention:** On Windows, pass actual paths or use `rg --files -g '.env*'`; inspect app configuration only after resolving its path from the repository inventory.

## M4.5 full mobile check reused blocked Jest Temp cache (2026-10-26)

- **Symptom/evidence:** `apps/mobile` full check reached Jest after typecheck/lint, then 53 suites failed before execution because Jest could not atomically rename transform-cache files in the sandbox Temp directory (`EPERM`). This is the known host cache boundary, not 53 product regressions.
- **Cause/correction:** The package script does not carry the repository-local cache argument that focused runs use. Rerun the full mobile Jest suite explicitly with `--cacheDirectory .jest-cache-codex`, then run the remaining checks separately.
- **Prevention:** In this Windows sandbox, never interpret default Temp-cache EPERM output as a feature failure. Use the repository-local quoted Jest cache for full and focused suites, and report the package-script limitation until it is deliberately changed.

## BMAD config resolver Temp-cache boundary (2026-10-26)

- **Symptom/evidence:** A read-only `uv run` configuration resolution for BMAD Help failed before returning merged JSON because `uv` could not persist Python interpreter metadata under the sandbox Temp directory (`Access is denied`). Catalog and artifact reads still completed.
- **Status/correction:** Treat merged config/output-location inference as unavailable for this run; do not report a resolved sprint configuration. Recommendation instead uses the verified local catalog, implementation artifacts, and current story status.
- **Prevention:** Set a writable repository-local `UV_CACHE_DIR` before BMAD helper execution when the host Temp cache is denied, then rerun only the resolver. Do not mistake cache retries for product/build evidence.

## M4.5 preview immutable-array type syntax (2026-10-26)

- **Symptom/evidence:** The first share-preview implementation used `readonly Readonly<T>` for object-array fields. Babel and TypeScript both rejected it before the intended preview assertions could execute.
- **Cause/correction:** `readonly` applies to array/tuple literal syntax, not a generic object type. Replaced it with `ReadonlyArray<Readonly<T>>` and reran the RED/GREEN target.
- **Prevention:** Use `ReadonlyArray` for immutable generic collections in mobile domain types; run typecheck after adding public result shapes, not only focused Jest.

## Replay trip exclusion followed by another edit regressed saving (2026-10-26)

- **Owner evidence:** Excluding a trip, then opening another trip and editing a photo, now produces a Replay Saving failure/state. This is a P0 regression because normal consecutive owner edits must coalesce into one acknowledged local draft.
- **Status:** Cause is not yet established. Do not attribute it to audio retry or claim the previous queue repair still works; inspect the exact exclusion-to-photo sequence and the device's closed diagnostics before changing queue semantics again.
- **Device evidence / confirmed cause:** The current process emitted immediate `REPLAY_STALE` draft failures, then a later `DATABASE_BUSY` after the SQLite busy timeout. Source inspection confirms a JS/dev-runtime reload can preserve the visible editor while recreating the reconstruction repository, which loses its in-memory opaque Replay-key map. The same preflight also exposed a second self-conflict: the visible editor can retain an earlier working-draft revision even though the durable local draft is current, so the stage CAS rejects the owner's own next exclude edit. The writer lock holder remains unidentified, but it is a separate delayed failure and not evidence that the owner selection was invalid.
- **Correction:** Before each one owner-authorized Replay stage/commit, the provider now rehydrates the native manifest/key map, verifies snapshot/privacy tokens, and supplies the revision from that exact current durable draft to the one CAS-protected write. This is not an automatic replay of a rejected mutation. Restart the development app without clearing data to release any already-hung native writer.
- **Verification:** Provider regressions prove staging reloads the native Replay map and replaces a stale screen revision with the current durable revision before its one mutation. Replay-screen regression proves that excluding trip A, returning to the overview, then removing media from trip B stages only B as included and does not restore A. Mobile TypeScript and lint pass. The development client was cold-restarted against Metro 8081 without clearing data; owner-device confirmation remains required, and the database-busy writer has not yet been attributed or eliminated.
- **Verification incident:** The first typecheck for the revision-reconciliation regression failed because its test-only `workingDraft` mock omitted required fields. No product source ran or shipped from that result. **Correction/prevention:** make test doubles satisfy the complete repository return type before treating a focused Jest run as sufficient validation.

## Replay Music Done could not retry a failed background save (2026-10-26)

- **Owner evidence:** After choosing new background music, Music & order > Done did not save the choice.
- **Confirmed cause:** The first audio draft write runs in the background. When it failed, Music Done only flushed the already-rejected queue promise; it never queued a fresh owner-authorized retry, so every press repeated the failure path.
- **Correction:** Music Done now first waits for the current save tail, then enqueues and awaits one explicit retry using the visible media, trip scope, order and soundtrack before closing the settings sheet. It remains open with fixed recovery copy if that retry also fails.
- **Verification:** Replay-screen regression makes the background custom-audio save fail once, taps Done, and proves the second stage succeeds, settings closes, and Update Replay becomes available.
- **Prevention:** A UI affordance that says “Tap Done to retry” must create a new operation after a rejected queue tail; awaiting the same rejected promise is not a retry.

## Replay large-trip editor preview loading was serial (2026-10-26)

- **Owner evidence:** Opening a trip with a large photo album remained slow before the owner could select media.
- **Confirmed cause:** Each bounded Replay gallery page asked the native Media Library for `getMediaType`, cloud state, and URI one asset at a time. The 48-item page cap prevented an unbounded read but turned normal native latency into a long serial wait.
- **Correction:** A page now resolves through at most six ordered local lanes. This keeps the 48-item privacy/memory bound, preserves every tile's source order and unavailable placeholder, and avoids treating a partial page as a full album.
- **Verification:** Native-adapter regression proves a 12-item page resolves concurrently, retains its original tile order, and never exceeds the six-lane cap. Device timing remains to be measured.
- **Prevention:** A bounded page must also bound latency: use capped concurrency for independent local-media handles, not unbounded parallelism or sequential per-item waits.
- **Device-diagnostic incident:** The first read-only ADB device/reverse query could not start the local ADB daemon, so it produced no device evidence about the exclusion report. This is a host transport failure, not evidence that the Replay draft or renderer failed. **Prevention:** recover the local ADB service through the approved host boundary before interpreting device diagnostics.
- **Host-inspection incident:** A repository search used a PowerShell-incompatible wildcard filename (`app.config.*`), so it did not inspect the optional config file. The explicit `app.json` read still established the installed development-client scheme. **Prevention:** enumerate or name exact PowerShell paths instead of passing shell globs to `rg`.

## Replay Update could commit a mixed owner-edit snapshot (2026-10-26)

- **Owner evidence:** After changing video/media and excluding two trips, Update Replay could render an earlier composition in which the excluded trips still appeared. This is an integrity failure: the final video must reflect the complete owner edit, not merely a successful render.
- **Cause:** Update captured media keys before waiting for the queued working-draft tail, then read the other edit refs later. That allowed a final commit request to combine values from different moments. The provider also treated a native write return as sufficient and started rendering without re-reading the committed Replay manifest.
- **Correction:** Update now captures media, trip scope, auto/manual state, order and soundtrack together only after the working-save tail is acknowledged. The provider then re-reads the committed manifest and fails closed unless snapshot/privacy scope, soundtrack/order, included/automatic trips, and every included manual trip's exact media selection round-trip. Rendering starts only after that verification.
- **Owner recovery copy:** A failed verification now says the Replay needs a refresh and that the latest choices were not rendered. It no longer asserts that another person or the Journey List changed when the local saved-draft readback is the only known fact.
- **Verification:** Provider regression covers a retained video/manual choice plus an excluded trip, then proves readback rejects both reintroduced trip scope and a missing manual exclusion. Device confirmation remains required; no host test is presented as proof of the owner's rendered Replay.
- **Prevention:** Treat every Update Replay as a verified durable snapshot boundary. Never render from a UI ref set or native write acknowledgement alone when the renderer consumes a persisted composition.
- **Verification incident:** The first combined validation command ran the mobile-only `typecheck`, `lint`, and `test:sqlite` scripts from the workspace root, where those scripts do not exist; only the root foundation check then ran. No product source changed and no mobile assertion was collected by those missing-script commands. **Prevention:** run package-scoped validation from `apps/mobile`, then run the root `npm run check` separately.

## Replay custom-audio success was coupled to slow durable saving (2026-10-26)

- **Owner evidence/cause:** Selecting a bounded custom audio file still appeared slow whether it ultimately succeeded or failed. Source inspection confirmed the screen waited for the serialized SQLite working-draft write before it changed from `Saving audio` to `Loaded audio`; that write can wait behind other Replay edits.
- **Correction:** The UI now reports `Loaded audio` immediately after the local private copy passes its bounded-file check. The existing durable draft write proceeds in the background. If it fails, the UI says the audio is loaded but its Replay setting was not saved and offers the existing Done retry route. Update Replay still flushes the durable write before render, so an unacknowledged track cannot silently become a final Replay soundtrack.
- **Verification:** Replay-screen audio regression passes, including immediate loaded-state plus background save failure; mobile TypeScript and lint pass. A fresh Android Metro bundle was requested on the existing localhost-only 8081 route. Owner device timing remains unmeasured.
- **Prevention:** Separate local-file readiness from durable-composition acknowledgement in the UI, while retaining the latter as the final render gate.

## Replay device app could not load because the development transport was absent (2026-10-26)

- **Owner evidence:** The owner reported that the development app could no longer load.
- **Read-only host evidence:** The prior 8081 Metro log was stale, process `6572` was no longer running, no host listener owned port 8081, and the connected Android device had no USB reverse mappings. This is a development transport failure, not evidence of a new Replay runtime failure.
- **Correction/verification:** Restored one localhost-only Metro process on `127.0.0.1:8081`, restored only `tcp:8081` USB reverse, and delivered a fresh Android `expo-router/entry.js` bundle after opening the configured `travel-life` development-client deep link. A web-only manifest request also exposed a missing Expo SQLite WASM asset; Android bundling still completed, so it is not used as an Android app-cause. No build, install, storage clear, or LAN listener was used. Owner must confirm the visible surface is no longer blank.
- **Prevention:** Before device testing, verify the current Metro process, IPv4 loopback listener, and exact ADB reverse mapping; a prior successful bundle log is historical evidence only.

## Replay finalization implementation patch and test-harness corrections (2026-10-25)

- **Evidence/cause:** The first attempt to mark the finalized Replay implementation record used stale frontmatter context, so `apply_patch` rejected it before changing a file. The first focused Replay test run also exposed React `act(...)` warnings because the test invoked asynchronous render progress and completion callbacks outside an act boundary.
- **Correction/verification:** Re-read the live implementation-record header before applying the narrow status patch. Wrapped the test-owned progress and completion callbacks in `act`, then reran the focused Replay suites using the repository-local Jest cache.
- **Prevention:** Patch documentation against the live exact context, especially after parallel work. Every test double that invokes a state-changing asynchronous callback must do so inside `act`; a passing suite with React act warnings is not clean verification.
- **Regression-fixture correction:** The new prior-Replay recovery test reached the existing Re-render path, but its provider double returned `undefined` from an async `discardPrivateReplay` contract. The test stopped before behavior assertions. The double now resolves a promise, matching production; the focused Replay suites then passed 96 tests. **Prevention:** When adding a test that reaches an existing async boundary, make every mocked method match the declared return contract rather than relying on a previously unexercised default.

## Replay finalization state check path mistake (2026-10-25)

- **Evidence/cause:** A stale-state search was launched from `apps/mobile` with
  a repository-relative `apps/mobile/...` path, so the read-only command found
  no file. No source was changed by that command.
- **Correction/verification:** Re-ran the required focused suites from the
  mobile package with the repository-local Jest cache; 94 tests passed.
- **Prevention:** When working from a package directory, use package-relative
  paths for source checks and retain the workspace root only for root commands.

## Replay chapter handoff was not wired to the player (2026-10-25)

- **Evidence/cause:** The first integration of the chapter renderer added the
  provider callback but omitted it at the `ReplayScreen` call site. The new
  immediate-first-trip regression therefore remained in the fixed failure UI
  while the full render promise was pending.
- **Correction/verification:** The screen now adopts the verified first
  chapter preview immediately and replaces it with the completed, durable
  Replay when buffering finishes. The focused screen suite passes 43 tests;
  TypeScript, lint, and the root foundation check pass. This is host evidence
  only; Android timing and visual continuity remain owner validation work.
- **Prevention:** When an async provider API gains a readiness callback, add a
  regression that holds its final promise and proves the consuming screen has
  already changed state. Do not treat provider/renderer tests as UI wiring
  evidence.

## Replay trip-editor investigation BMAD launcher boundary (2026-10-24)

- **Owner report:** Opening a trip shows “This Replay changed somewhere else”; after photo selection Back/Done are disabled, and the editor does not match the agreed mock. Existing source still contains the overview conflict wording and disables trip navigation while `workingSaveState` is saving. The device's pending-save cause is not established by this inspection.
- **Tooling recurrence:** The required bmad-build launcher failed inspecting the virtual-environment Python interpreter because Windows denied its sandbox temporary interpreter-cache write, despite a repository-local `UV_CACHE_DIR`. No product edits or checks were performed in this investigation. The skill explicitly requires halting on launcher failure.
- **Status/next action:** Open. Unblock the supported launcher execution boundary, then trace working-save completion/conflicts and compare the actual trip editor with the approved mock. Preserve the existing uncommitted work; do not infer device acceptance from its earlier host-check records.
- **Prevention:** `uv run --no-cache` still uses a temporary interpreter cache; a writable `UV_CACHE_DIR` alone does not establish that the launcher can execute under this Windows sandbox.
- **Resumed:** Owner requested continuation. The supported launcher succeeded through approved host execution. No workflow source bypass was needed.
- **Spec-planning recurrence (2026-10-25):** `uv run` for the shared memlog helper again failed before it could inspect the workspace interpreter because the sandbox Temp `uv` interpreter cache was denied. The spec operation used the repository virtualenv to invoke the same shared `memlog.py` script instead; no product source, device, build or private data was touched. Treat this as the known execution-boundary recurrence, not a spec/content validation failure.

## Replay cache write invalidated working choices and mislabeled storage failures (2026-10-24)

- **Confirmed cause:** `saveReplayPreparedArtifact` advanced the composition revision for cache-only metadata, leaving an existing working branch based on the prior revision. Reload then hid that branch and the next stage rejected it. The provider also mapped every stage/save rejection, including native storage failures, to a stale/conflict stage. Screen navigation was disabled during saving, and an earlier queued completion could incorrectly clear the pending indicator for later writes.
- **Correction underway:** Preserve the composition revision on artifact-only writes; type explicit freshness guards separately from native failures; acknowledge the complete save queue while keeping header navigation reachable. Existing ambiguous stale branches still require an explicit owner choice and are not automatically overwritten.
- **Prevention/evidence:** SQLite continuity regression was RED before the correction; source-level UI and provider reproductions also failed on the intended behavior before correction. Add queue-tail and fixed-header/footer regressions; complete verification and owner-device confirmation remain required.
- **Tooling incidents:** Two multi-file patches used an assumed provider import/describe line and were rejected atomically before writes. Read the exact target first and keep unrelated file patches separate. A delegated tool script also had malformed JavaScript quoting and failed before any tool ran; corrected using a template literal. Neither failed operation changed product files.
- **Review findings/correction:** Cache metadata also needed revision-and-source-JSON compare-and-swap to prevent overwriting a concurrent composition; SQLite interleaving regressions now cover existing and absent rows. Recovery now drains pending selection/save work, restores with current scope and confirms intentional draft loss. Done awaits photo resolution as well as queued writes. Excluding a trip filters automatic groups to the included subset; Select all consults prior preview overrides; entering a different trip clears Undo; Reset retains custom music. The overview uses fixed navigation/actions and visual rows matching the approved hierarchy.
- **Verification incidents:** A new deferred-save screen test and two adjusted settings tests initially raced asynchronous `fireEvent.press` calls; awaiting events corrected the harness and the complete screen suite passes 33 tests. A source-block replacement matched an indented inner return and retained the old overview, producing TS1128; removed that exact duplicate block and reran TypeScript successfully. Future source-block replacements must anchor complete lines and verify one expected match before writing.
- **Review availability:** The first independent-review attempt hit the account usage limit. A later resumed attempt returned ten concrete findings, which were investigated and corrected; neither the failed attempt nor self-review is claimed as a clean independent pass.
- **Final follow-up (2026-10-25):** Independent review then found five narrower races/gaps: selection work could begin during navigation's save wait, failed-save retry bypassed that wait, settings could mutate during recovery, snapshot-only restore retained an incompatible video, and Auto planning retained committed exclusion flags. The acknowledgement loop now waits for both task sets until stable; retry uses that same loop; all competing recovery mutations are guarded; either scope-token change withholds the old preview; Auto uses current inclusion and resolved preview availability. Combined normal/retry deferred regressions pass. Final scoped source review reports no actionable findings in those five corrections.
- **Final evidence/limit:** Replay screen 35, provider 39, SQLite 90, mobile TypeScript/lint, root check and whitespace pass. Broad mobile run: 44 suites / 474 tests, 79.51% line coverage before final two focused screen cases. Owner-device navigation/layout remains unverified, and no genuinely hung native write is claimed resolved. A reviewer assumed a nonexistent `replay/manifest.ts`; corrected discovery to `selection.ts` without writes. Discover filenames with `rg --files` before opening them.
- **Final lint correction:** The grouped dirty detector's in-place `push` on an intermediate array triggered React's immutability rule when called with state-derived keys. Replaced it with a new immutable group array on every insertion; rerun lint and focused checks before retaining the passing-check record above. Do not suppress immutability lint for state-derived collection helpers.

## Trip-first spec derivation patch-context mismatch (2026-10-24)

- **Evidence/cause:** Three combined derivation patches contained final context lines that did not match the live design-system/editor/project-state paragraphs. The patch operation rejected each atomically; no partial contract update landed. The third recurrence included an unnecessary empty project-state hunk; it was removed before the exact retry.
- **Correction:** Checked target existence/live text and applied smaller exact patches. For whole-companion derivation, read the current complete source once and generated a full replace hunk through apply_patch. Stable CAP/E IDs and predecessor invariants are validated after derivation.
- **Prevention:** Separate new-companion creation from existing cross-document context edits; never assume prose fragments are whole matching lines. Verify final action naming across all companion owners after an accepted navigation change.

## Replay Edit hidden album candidates and clipped actions (2026-10-24)

- **Owner evidence:** Bali shows zero selected despite media in Review; Taiwan does not expose its full album. Multiple controls are clipped, and the all-in-one editor does not provide trip-level Done/return followed by an aggregate update.
- **Confirmed source causes:** The editor filters `available` before resolving previews and passes only that filtered array to paging; unknown candidates cannot become visible. Global first-48 resolution is not a trip album page. Resolution failures have no visible retry. Six non-wrapping full-width actions overflow a phone row. Cached editor counts are recomputed without authoritative rendered-media metadata. Replay and See photos use distinct membership queries; exact Bali record cause is unverified.
- **Status/next action:** Open. Party proposal and interactive mock define trip overview -> trip gallery -> Done trip -> aggregate Update Replay. Await owner design review; implementation must establish effective-album parity, independent candidate/preview/selection states, durable rendered selection, visible paging recovery and real viewport acceptance.
- **Prevention:** Test unknown media beyond page one, zero-selected populated albums and multiple trip returns; verify button bounds at phone widths. Count passing host checks as source evidence only.
- **Mock verification:** Inline mock JavaScript syntax and five flow-state checks pass (including all 75 synthetic Taiwan items and a zero-selected gallery). Visual browser verification could not run because local browser use is disabled in Work settings. The HTML is supplied for owner review; no visual acceptance is claimed.

## Replay Edit virtualized-container regression (2026-10-24)

- **Owner evidence/cause:** Metro reported that the Replay Edit `FlatList` was nested inside the design-system vertical `ScrollView`. That breaks native windowing and can leave the media grid blank or unstable. The first repair changed the list's accessibility label, causing two focused tests to fail even though the list was present.
- **Correction/status:** Edit now owns one vertical `FlatList`: trip/actions live in its header and music/navigation actions in its footer; only the horizontal trip strip remains nested. Restored the stable grid accessibility label and reran the focused suite. Device confirmation remains required.
- **Prevention:** A virtualized grid must be the only vertical scroll owner. Preserve stable accessibility labels while changing the layout container, and run the focused screen suite immediately after.

## Replay prepared-video cache identity regression (2026-10-24)

- **Owner report/cause:** A prepared Replay encoded again after reopening. The Edit performance change deliberately resolves only the first 48 local previews, but cache lookup compared the saved render's fully resolved-media manifest against that transient/bounded preview state. The identities differed despite unchanged committed Replay scope.
- **Correction/status:** Prepared artifacts now use a composition-v2 identity derived from the committed trip/media scope, direction, soundtrack and snapshot rather than local preview availability. Legacy artifacts retain a one-time local compatibility check that never invokes the renderer. Typecheck, lint and the focused provider suite (37 tests) pass; owner-operated Android/iOS confirmation remains pending.
- **Prevention:** A cache identity must be based only on durable composition inputs. Any bounded/lazy preview state is UI transport data and may not participate in cache invalidation. Add a regression assertion whenever editor preview paging changes.

## Replay focused-test invocation from the wrong package root (2026-10-24)

- **Evidence/cause:** The first focused Jest command was launched through `npm --prefix` from the repository root. Jest then treated the repository-level cache fixture directory as test input and used the wrong Babel configuration, producing parser and protected-Temp-cache failures before the target suite ran.
- **Correction/status:** Reran Jest from `apps/mobile` with the repository-local cache and cache-directory ignore; the provider suite passed (37 tests). This was a command invocation error, not a product regression.
- **Prevention:** Run mobile Jest from `apps/mobile`; retain `--cacheDirectory .jest-cache-codex` and ignore that directory when a focused path is supplied.

## Development Build Metro launch redirection error (2026-10-24)

- **Evidence/cause:** The first recovery command passed the same log path to PowerShell's `RedirectStandardOutput` and `RedirectStandardError`, which PowerShell rejects. Metro did not start; USB reverse and relaunch still ran but cannot restore a bundle without Metro.
- **Correction/status:** Use separate stdout/stderr files for the hidden Metro helper, then verify the packager status before reopening the development client.
- **Prevention:** When starting a hidden Windows helper, allocate distinct stdout and stderr paths; do not assume later commands imply the helper launched.

## Android build-script false stale-APK failure (2026-10-24)

- **Evidence/cause:** The owner-run build completed successfully with `:app:assembleDebug UP-TO-DATE`, but the new script required the APK timestamp to advance and therefore threw a false failure. Gradle correctly reused the valid debug output.
- **Correction/status:** The script now requires a successful Gradle exit and a nonempty APK; it reports reuse when Gradle intentionally keeps an up-to-date artifact, then proceeds to optional install.
- **Prevention:** Treat Gradle's `UP-TO-DATE` output as valid only after checking the artifact exists and is nonempty. Do not use timestamp movement as the sole success criterion.

## Project-state update write retry (2026-10-24)

- **Evidence/cause:** The first scoped project-state patch failed at the file-write boundary despite the target being present and not read-only. The exact cause is unknown; no project-state content was changed by that failed patch.
- **Correction/status:** Rechecked target metadata before a narrowly scoped retry; the second patch wrote the build-script record successfully. No content recovery was needed.
- **Prevention:** After a write-boundary failure, inspect target existence/attributes before retrying; do not infer a content-hunk mismatch from a write error.

## Replay empty-Auto persistence patch typecheck failure (2026-10-24)

- **Evidence/cause:** The review-driven empty-Auto persistence fix correctly added a runtime array guard, but reused the `unknown` parsed field after storing the boolean result; TypeScript did not retain that narrowing and rejected the working-draft assignments.
- **Correction/status:** Bind the validated string-array value itself before constructing the working draft and rerun typecheck, lint, and SQLite regression.
- **Prevention:** For JSON-derived fields, preserve the narrowed value rather than relying on a separately stored boolean guard across later assignments.

## Replay Android build CMake lock (2026-10-24)

- **Evidence/cause:** The compact Android debug build reached native configuration but failed because the x86_64 CMake `.ninja_log` was held by another process. It did not produce a fresh APK or install an app.
- **Correction/status:** Inspect active Gradle/CMake processes and retry only after the owning build is no longer using the project output; do not delete build state or kill an unknown owner blindly. Android owner walkthrough remains pending a refreshed APK.
- **Prevention:** After a build command returns inconclusively, verify the APK timestamp and active build ownership before starting another native build against the same `.cxx` output.

- **Follow-up evidence:** The exact stuck Ninja command was confirmed to own this repository's `.cxx` directory and was stopped. The subsequent cleanly-started build reached `:app:buildCMakeDebug[x86_64]` but Ninja itself crashed repeatedly (`0xC0000005`, then `0xC00000FD`) before APK output. This is an unresolved native-toolchain failure, not a successful Android build or walkthrough.

- **ABI follow-up:** The connected owner phone is arm64, so an arm64-only assembly was attempted to avoid the unrelated emulator ABI. It again ended before a fresh APK timestamp or installed package appeared. Treat the build gate as unresolved rather than inferring success from Gradle configuration output.

## Replay Android owner-walkthrough transport boundary (2026-10-24)

- **Evidence/cause:** The read-only Android preflight could not start or connect to the local ADB daemon from the sandbox (`failed to start daemon` / cannot connect). No device, app, or private data was changed, and no owner walkthrough result was observed.
- **Correction/status:** Retry the same read-only device inventory through the approved host boundary before any install, launch, or UI interaction. Android owner acceptance remains unverified; iOS has not been available from this Windows host.
- **Prevention:** Treat a sandbox ADB daemon failure as an execution-boundary issue, not a disconnected-device or product diagnosis. Do not claim device acceptance from build or host tests.

## Replay Android device-selector invocation mismatch (2026-10-24)

- **Evidence/cause:** Expo's `--device` option resolves its own display-name selector and did not accept the connected ADB serial `9cb47ed9`; it stopped before Gradle build or installation.
- **Correction/status:** Use the single connected-device path without this incompatible selector (or Expo's listed display name when multiple devices exist). No APK or app state changed from the failed command.
- **Prevention:** Confirm the CLI's device selector semantics before passing an ADB serial; do not interpret a selector error as a build or device failure.

## Mobile aggregate-check cache invocation recurrence (2026-10-24)

- **Evidence/cause:** Running the mobile aggregate `npm run check` used its package-script Jest command without the repository-local cache override. The sandbox Temp transform cache again failed with EPERM before any test executed; this is not a product test failure.
- **Correction/status:** Focused and complete-suite coverage is run with `--cacheDirectory .jest-cache-codex`; root `npm run check` is run from the repository root as required. The mobile package script remains unsuitable inside this sandbox until its cache configuration is made repository-local.
- **Prevention:** Do not substitute a nested package aggregate command for root `npm run check`; when mobile Jest is invoked in this sandbox, always pass the repository-local cache path.

## Replay v36 schema test-contract regression (2026-10-24)

- **Evidence/cause:** The full mobile suite exposed stale unit-test mocks and assertions hard-coded to schema v35 after the Replay working-draft layout advanced the marker to v36. The old current-schema mock also omitted the three required replay columns, so it represented an incomplete physical v36 layout.
- **Correction/status:** Updated the current-layout test double to expose the v36 columns, retained a true forward-marker test at v37, and updated migration assertions to v36. A second focused pass exposed two fixtures that incorrectly expected a current database to recreate a historical table or supplied owner-home rows to the new layout probe; those were corrected before another full run.
- **Prevention:** Every schema marker bump must update the current, fresh, upgrade and forward-marker contract fixtures together; a marker alone is not a valid current-schema fixture.

## Replay editor interval label typecheck failure (2026-10-24)

- **Evidence/cause:** The first interval-inspector patch passed an accessibility prop through the project Body component, whose public props intentionally expose only text styling. Mobile TypeScript rejected it before tests ran.
- **Correction/status:** Moved the accessibility label to a native View wrapper and rerun typecheck before continuing. This is an agent-authored compile failure; no runtime/device behavior was changed by the failed check.
- **Prevention:** Inspect local component prop contracts before adding native accessibility props; use native wrappers when the design-system text primitive deliberately has a smaller surface.

## Replay Edit detailed-spec review gaps (2026-10-24)

- **Evidence/cause:** Independent review of the agent-authored editor specs found
  a conflicting Back policy for soundtrack versus other working edits, missing
  first-manifest selection readiness and incomplete owner recovery actions for
  ambiguous remaps/CAS conflicts. Excluded-trip checkmarks and optional duration
  also weaken the selected-means-output contract. Earlier structural checks did
  not verify these cross-companion behavior paths.
- **Correction/status:** Owner agreed to the solutions. Editor experience now owns
  working lifecycle, soundtrack Back retains drafts, versioned planning gates
  mutations, and concrete remap/CAS recovery, inactive excluded checks, clip
  inspection, scoped Auto and duration feedback are specified. E17-E22 add the
  relevant acceptance. Interaction details are deduplicated. Specification gaps
  addressed; runtime fixes and owner UX acceptance remain open. See
  `review-replay-edit-spec-2026-10-24.md` for the historical findings and resolution.
- **Prevention:** Read adopted companions end-to-end for shared actions; trace
  first entry before prerequisites exist, parent-excluded child selection,
  stale/conflicting intent and recovery through concrete user controls. Do not
  call capability/link checks a complete behavioral review.
- **Review staging incident:** The shared temp path could not be read by reviewers
  or copied by the later parent shell. Recreated the snapshot in the ignored
  `.review-artifacts/` workspace path and verified it exists. Use shared workspace
  staging for delegated reviews; treat sandbox Temp paths as potentially isolated.

## Replay editor specification validator wording mismatch (2026-10-24)

- **Evidence/cause:** The first document validator required the literal word
  `unloaded` in the experience companion, although it specified the complete
  current album versus loaded/visible cells and E06 used `unloaded` in the
  acceptance companion. This was an over-specific validator, not missing scope.
- **Correction/prevention:** Check complete-album semantics in the experience
  and unloaded-page coverage in E06 separately. Re-run capability/companion,
  acceptance/link/whitespace checks; do not rewrite correct product requirements
  just to satisfy an arbitrary exact-word assertion. Corrected validation passes
  all five capabilities, 15 companion paths, E01-E16, links and whitespace.
- **Patch follow-up:** A diagram insertion used an inaccurate context line and
  failed without changing files. Read the exact paragraph and apply the matching
  hunk; keep optional diagram edits separate from validation/result recording.

## Replay cached-artifact persistence mismatch (2026-10-24)

- **Owner evidence:** After rendering and returning to Atlas, reopening Replay rendered again; closing and reopening the app also lost the prepared video. The prior change only reused the in-memory provider artifact.
- **Cause/status:** The accepted requirement needs a verified persistent private artifact and manifest identity, not a React/provider-session cache. This is open; do not claim Replay reuse survives navigation or app restart until durable cache lookup, freshness gates, and device evidence pass.
- **Prevention:** Distinguish an in-memory controller reuse test from navigation/restart acceptance. Exercise Atlas-to-Replay return and cold app restart before describing prepared Replay as persisted.
- **Verification environment:** The first focused Jest run could not rename its sandbox Temp transform cache (`EPERM`) and therefore ran zero tests. Re-run it with the repository-local `--cacheDirectory .jest-cache-codex`; keep this cache ignored and report the sandbox failure separately from product test results.
- **Control placement correction:** Owner device evidence found the mute overlay occupying the same bottom-right space as the native fullscreen control. The player now hides that native fullscreen button and renders a single bottom-right control row with speaker and fullscreen buttons. The speaker action remains player-only and does not prepare or replace a Replay. Device visual confirmation remains required.

## Replay Edit recognition and navigation mismatch (2026-10-24)

- **Owner evidence:** Editing media feels confusing; users cannot see the media
  they are adding/removing/replacing. Source review of `replay-screen.tsx` confirms
  an ungrouped eligible-media `.map()` with date/type buttons, per-item move/replace
  controls and no thumbnails. This is an existing product mismatch, not evidence
  that parsing alone is the measured performance bottleneck.
- **Cause:** The earlier agent-selected editor exposed operations and metadata
  instead of recognizable media in trip context. The design lacked an explicit
  recognition/self-serve acceptance gate. Exact original authorship is unaudited.
- **Correction/status:** Decision 0014, design-system principles and the M4.7
  interaction contract now require retained preview, trip-based selectable grid,
  video posters, compact secondary settings and truthful progress. Documentation
  corrected; runtime UI defect remains open pending implementation and owner review.
- **Prevention:** Every UI build/rebuild cites its approved reference and tests the
  user's task. D4 must assert thumbnails/posters, actual-manifest checkmarks,
  per-trip intent, bounded paging and return context; require actual Android/iOS
  visual evidence. Passing button-action tests cannot establish usable editing.

## Replay specification party-review tooling recurrence (2026-10-24)

- **Evidence:** Party activation through `uv run` repeatedly encountered sandbox interpreter-cache access denial. The wrapper was stopped; no build, server or device was changed. A subsequent assumed `_bmad/_config/agent-manifest.csv` read also failed because that file is absent.
- **Cause/correction:** The uv sandbox-cache restriction recurs from the 2026-10-23 entry; the missing manifest was an incorrect path assumption. Read the skill's documented fallback customization/configuration and installed persona sources instead. Resolver execution was not claimed successful; the review continued using session-mode personas.
- **Prevention/status:** For read-only reviews under this boundary, use the documented fallback after the first cache denial rather than retrying unchanged uv commands. Discover manifest paths with `rg --files` before reading them. Review tooling bypassed; sandbox uv-cache restriction remains unresolved.

## Replay soundtrack/order owner mismatch specification (2026-10-23)

- **Owner evidence:** Rendered Replay is still inaudible and newest-first. Existing host tests and successful asset export did not establish audible native playback or real chapter order. External Music on/off re-rendering did not match the requested player speaker behavior.
- **Status:** Open implementation defects, specified in `spec-replay-soundtrack-and-month-order`; no fix/device acceptance claimed. Month/year ordering supersedes the interval-comparability sorting policy for presentation. Track selection is now Happy Moments 1.4 and local replacement files are limited to 5 MB.
- **Prevention:** Test the renderer's chapter/concat order and actual output audio, separate player mute from soundtrack selection, and include size/decode/cancel/cache cases. Spec tooling again encountered sandbox uv-cache denial; approved-host resolver/logging succeeded. This tooling failure did not affect app source or device.

## Bundled Replay music verification (2026-10-23)

- **Asset correction:** Initial OGG import failed Jest parsing and was absent from Metro's default asset extension list. Add OGG to the composed Expo Metro config and map OGG to a numeric test asset. Android export then included the 2.4 MB recording successfully.
- **Host boundary:** Initial Hermes export could not write bytecode in sandbox Temp. The same export through the approved host boundary completed with 1,535 modules; no device or dev server was changed.
- **Test correction:** The new music-off UI regression initially pressed the sharing selection before React committed that screen. Await the selection and enabled share action before pressing. Existing act-environment warnings remain a harness limitation.
- **Editing/tooling:** Two multi-file patches failed because their final context did not match; reapply exact scoped hunks. A dependency-doc search used an absent Jest path; rely on discovered paths. No production code changed from failed patches.
- **Review status:** Independent reviewer exhausted its usage limit before producing findings. No independent-review pass is claimed; owner listening/native AAC export acceptance remains pending. Keep review evidence distinct from host tests and bundle compilation.

## Android incident causal and isolation audit (2026-10-23)

- **Evidence:** See `android-startup-trace-2026-10-23.md`. Metro timestamps establish a conflict-marker compilation failure at 14:50:57, preceding the 15:15 Expo patch update. Its writer remains unknown. Recovery later installed a shared-package arm64 debug APK with default endpoint 8084, then removed its 8083/8084 servers/routes. Closing the activity did not restore app launchability.
- **Correction:** Retract the proven-cache explanation for continued 8083 loading, the inference that a generic 8081 error required a native-port rebuild, and claims that source changes were exonerated by host compilation. The original post-conflict device failure remains unresolved. An idle wrapper was also insufficient reason to terminate the first build. The BMAD resolver initially hit sandbox uv-cache access warnings in this audit; the approved-host resolver succeeded.
- **Prevention:** Port separation alone is not isolation. Assign ownership of checkout, cache, build outputs, package, and phone; preserve the previous binary/endpoint and a restoration path before reinstalling. Establish a complete manifest-to-bundle response before diagnosing the device lifecycle or rebuilding for a port. Retain transient-write authorship as unknown unless tool history proves it.

## GitHub Expo dependency validation failure (2026-10-23)

- **Evidence/cause:** Owner reports GitHub CI failing with nine outdated packages. Online `expo install --check` reproduces SDK 57 patch drift in UI, Expo, asset, constants, linking, router, splash screen, dev client and jest-expo. This was a previously recorded unresolved check, not a new Replay regression. Publishing the feature did not close it.
- **Correction verified:** Applied Expo's recommended SDK 57 patch versions and regenerated the lockfile. Online `expo install --check` passes and Doctor passes 21/21. All 44 mobile Jest suites (439 tests), 86 SQLite tests, TypeScript, lint and root checks pass. No dependency-check exclusion was added. Native rebuild/device acceptance after the patch update remains separate. npm still reports existing dependency advisories; no forced audit fix was applied.
- **Invocation correction:** A framework-guidance read incorrectly used the mobile working directory for a root-relative docs path; reread the actual root path. The sandboxed version check fell back to an explicitly unreliable offline map and reported success. Only the online reproduction establishes the mismatch; never use offline fallback to declare the CI gate fixed.
- **Prevention:** Require an online terminal Doctor result for dependency-maintenance delivery and preserve unresolved CI gates explicitly until their actual check passes.

## Runtime audit transport and archive enumeration (2026-10-23)

- **Evidence:** Sandboxed TCP/process inspection was denied CIM access. A local Metro source-map request was denied socket access; its dependent file read then failed because no map existed. The elevated full-map request did not finish and was interrupted. Source-map equality is unverified; APK hash equality and the current source diff were verified independently.
- **Correction/prevention:** Use the approved host boundary for local process/network inspection, stop dependent reads after failed downloads, and bound map requests with a timeout. Never equate a running server or matching native APK with byte equality of already-loaded development JavaScript.
- **Archive enumeration:** Git's prefix pattern did not enumerate the five preservation heads on the first archive pass; only the consolidation branch was retired. Enumerating all heads and filtering their exact names completed the archive. Verify the final branch/worktree inventories rather than assuming a wildcard selector matched.

## GitHub comparison fetch sandbox boundary (2026-10-23)

- **Evidence/cause:** The requested `git fetch origin --prune` could not create `.git/FETCH_HEAD` inside the filesystem sandbox and stopped before refreshing remote tracking data.
- **Correction/status:** Rerun the same read-only remote comparison fetch through the approved host boundary, then compare the refreshed `origin/main` ref before any staging or commit.
- **Prevention:** Git fetch updates repository metadata even when it does not change project files. On this workspace, use the approved host boundary after the known sandbox metadata-write denial rather than treating stale tracking refs as current GitHub evidence.

- **Recurrence (2026-10-24):** The same sandbox denial occurred while preparing the owner-authorized Replay commit. The approved host-boundary fetch completed and confirmed local `main` and `origin/main` have no divergence before the new commit. Do not retry the sandboxed form for this workspace.

- **Worktree inventory correction:** A status command relied on an external-worktree execution directory that the sandbox did not enter, so Git reported it was not in a worktree. Run each external inspection from the primary checkout with `git -C <exact-discovered-worktree-path>` and retain only those direct results for the comparison.

- **Staged-review formatting correction:** The first staged whitespace audit found a blank line at EOF in the generated M4.7 review artifact. Remove only that final blank line, restage the artifact and rerun `git diff --cached --check` before committing. Generated review records are part of the delivery surface and need the same staged audit as source.

- **Historical-worktree integration correction:** Cherry-picking the clean dimensional Atlas commit produced conflicts with newer Atlas components and shared decision/project records. The preserved responsiveness history also has fourteen simulated conflicts with the later accepted performance/privacy delivery. Abort the conflicting cherry-pick and preserve those commits rather than resolving in favor of obsolete code. Compare semantic scope and current delivery ancestry before treating a clean, unique historical commit as an integration candidate.

- **Remote-publication approval boundary:** The automatic approval service rejected the attempted `git push origin main`: the request was interpreted as authorization to commit locally, but not to publish private changes to GitHub's default branch. No remote change occurred. Keep the verified local commits ready and obtain explicit push confirmation before retrying; do not bypass the rejection through another transport.

## Replay delivery-record lookup correction (2026-10-23)

- **Evidence/cause:** A verification read targeted the correct M4.7 delivery-record path but `rg` returned no match and exited 1, so it did not supply the intended evidence.
- **Correction/status:** Enumerated the workspace with `rg --files`, read the exact discovered literal path, then updated the record with the current implementation, validation, device-build, and pending-review facts.
- **Prevention:** For a generated or untracked delivery artifact, enumerate first and use a direct content read for evidence; treat an empty search result as a failed lookup rather than as proof that the artifact is missing.

## Replay Android ADB path correction (2026-10-23)

- **Evidence/cause:** The final relaunch check invoked `adb.exe` through PATH even though this Windows workspace has no ADB PATH entry; PowerShell stopped before any device operation.
- **Correction/status:** Use the verified absolute Android SDK platform-tools `adb.exe` path already established for this task, then enumerate the named device before addressing it.
- **Prevention:** On this host, never rediscover ADB through PATH after a known successful absolute SDK path; keep device claims tied to the explicit command result.

- **Sandbox-boundary recurrence:** The absolute ADB invocation then could not start its daemon inside the filesystem sandbox, so it could not enumerate or relaunch the connected device. Retry the same narrow read/force-stop/deep-link command through the approved host boundary; this transport limitation is not Android build or Replay evidence.

## Replay chapter-card type contract omission (2026-10-23)

- **Evidence/cause:** Adding the private chapter-card field as required broke TypeScript in existing legacy renderer fixtures and in the fallback manifest path, which intentionally do not contain a card.
- **Correction/status:** The field is optional for legacy manifests and required by the current planner. The renderer types its fallback chapter shape explicitly and renders a card only when the manifest carries one. Typecheck is rerun after this correction.
- **Prevention:** When extending an immutable manifest, search both fixture literals and fallback construction paths before making a field required; retain a documented compatibility boundary where old persisted or test manifests are valid.
- **Test follow-up:** The first card assertion searched the first `-vf` call, but shared mocked native calls include earlier slate renders. It now selects the command containing the expected sanitized draw-text token. Focused Replay tests pass after the correction.

## Replay preparation feedback gap (2026-10-23)

- **Evidence/cause:** On the installed Android build, the owner reported that Replay stayed on the static `Your Replay is starting` copy while local media resolution and rendering could take a noticeable time. The screen did not expose active work or distinguish resolving from video composition, unlike the accepted Atlas update state.
- **Correction/status:** Replay now uses the same accessible activity pattern as Atlas: a citrus spinner, busy semantics, explicit local `Finding your Replay moments` then `Rendering your private Replay` phases, concrete non-identifying source/scene counts, final verification, and a determinate accessible percentage bar during rendering. A deferred screen regression proves both phases and the 50% rendering state before playback. Focused Replay tests, renderer/controller tests, TypeScript, and lint pass; install/owner validation remains next.
- **Prevention:** Any user-visible local operation that can exceed immediate feedback must show an active accessible progress state and a truthful phase label. Reuse the Atlas activity pattern where it fits rather than leaving a static status sentence.

## Replay video-timing and verification-search correction (2026-10-23)

- **Evidence/cause:** The initial moving-video panel padded a short source with a cloned final frame to fill its still-image chapter budget. That contradicted the accepted sparse-video rule and could make a half-second clip appear as five seconds of frozen filler. During the follow-up test search, a literal Windows wildcard path also produced OS error 123 rather than limiting the search with an rg glob.
- **Correction/status:** The renderer now probes the staged local video duration, uses only its bounded available frames, verifies the resulting duration, and returns the measured manifest duration. The first slate regression exposed a second empty-media guard after the intended slate branch; it was changed to reject only an actually empty group scope. A visible qualified trip with no usable attachment now renders its neutral local slate instead of being reclassified as an empty scope. Renderer and selection regressions cover both cases. Use `rg ... <directory> -g '<pattern>'` on Windows rather than embedding `*` in a path operand.
- **Prevention:** Never pad, loop, freeze, or slow an owner video to satisfy a photo timing target. Any timeline change must assert the rendered duration and inspect the exact filter arguments; keep Windows searches directory-based with explicit rg globs.

- **Verification limitation:** `npm --prefix apps/mobile run doctor` again emitted only its `npx expo-doctor` start line before the bounded command window elapsed. No active Doctor process remained afterward, but there is no terminal result to classify as passing or failing. Retain Doctor as unverified; do not replace it with an assumed network or dependency diagnosis.

- **Device-build invocation correction:** `npm --prefix apps/mobile run android:device` invokes Expo's interactive device picker, which exits in this non-interactive command session before compiling. A connected device was established separately through the absolute ADB path. Pass its serial directly to `npx expo run:android --device <serial>` for unattended development installation; do not interpret the picker failure as a Gradle or application build failure.

## Replay draft ordering parser correction (2026-10-23)

- **Evidence/cause:** The first persisted-order parser declared its map with `var` inside a `try` block, then read it after the block. TypeScript correctly reported that the value could be unassigned and lint rejected `var`.
- **Correction/status:** Initialize a typed empty map before parsing and replace it only after validated JSON input. The fallback retains an empty map. Typecheck and lint must pass before the editor order flow is considered verified.
- **Prevention:** For optional persisted state, initialize the typed safe default outside parsing or I/O boundaries; never rely on a declaration inside a `try` being definitely assigned afterward.

- **Test-fixture recurrence:** Expanding the Replay screen fixture to two usable memories invalidated assertions that removing one makes the private selection empty, and a replacement target has to be an unselected candidate. Remove both memories for the empty-selection case and remove the replacement candidate before asserting the replacement action. Keep interaction fixtures aligned with the selection state they are intended to prove.

- **Regression-suite recurrence:** The schema bump left one manual-journey migration expectation at 34, and the new renderer import exposed `munim-ffmpeg` ESM to the router-tree test. Update every migration-version assertion and map the native-only renderer dependency to the shared Jest stub so route discovery never executes native module code.

- **Replay cleanup ownership correction:** Adding provider-unmount cleanup read mutable replay refs directly from a React effect cleanup, producing exhaustive-deps warnings because those refs could point elsewhere at cleanup time. Capture the controller and artifact map inside the effect before registering cleanup, then dispose only that captured session.

- **Replay duplicate-attachment persistence correction:** The first draft format keyed choices only by evidence ID. The real SQLite replay fixture showed that one evidence item can attach to two visible journeys, which made its saved ordering ambiguous. Persist an internal JSON journey-plus-evidence reference for each draft item, retain legacy evidence-ID drafts as a compatible fallback, and require a real SQLite save/reopen assertion for duplicate attachments.

- **Replay share-test timing correction:** The duplicate-share regression pressed a Share option immediately after navigation, before React committed the share-review surface. Await the option's accessibility label before interacting with it; screen-state transitions are asynchronous in this harness.

- **Replay stale-draft contract follow-up:** Adding snapshot and privacy revision arguments to draft writes left one screen import and one ordered-edit assertion on the old API shape. Update all call sites and expectations together, then run typecheck before relying on focused test results.

## Replay schema verification command correction (2026-10-23)

- **Evidence/cause:** After adding the additive Replay-draft migration, a verification command guessed `npm --prefix apps/mobile run sqlite:test`. The package exposes the real SQLite harness as `test:sqlite`, so npm stopped before running any test.
- **Correction/status:** Read `apps/mobile/package.json`; use `npm --prefix apps/mobile run test:sqlite` for this repository. TypeScript and diff checks that followed passed; the correct SQLite harness remains to be run.
- **Prevention:** Inspect the package scripts before invoking a named verification target. Do not invent a script name from its purpose.

- **Migration recurrence:** Raising `CURRENT_SCHEMA_VERSION` from 34 to 35 made a real-SQLite fixture's hard-coded forward marker (`34`) equal the current version. The schema fast path correctly skipped recovery, but the fixture then failed expecting a repair. Update the fixture marker to 35 whenever the current schema advances, and run the full real-SQLite suite after every migration-version change.

- **Editor-test recurrence:** The new Replay editor test asserted the option immediately after `fireEvent.press`, before React committed the `editing` state. The implementation had not rerendered yet. Use `waitFor` for post-press asynchronous screen assertions; do not interpret a pre-commit tree as a missing control.

- **Verification recurrence:** A full `npm --prefix apps/mobile run check` used Jest's protected default Temp cache and failed every suite before test execution with the known sandbox `EPERM` transform-cache rename. This was an agent invocation error: the Replay playbook already requires the quoted repository-local `.jest-cache` path. Rerun Jest directly with that cache, then run the remaining SQLite/type/lint/Doctor checks individually; do not claim the package-script failure is an application regression.

## Replay plan generation and Windows search corrections (2026-10-23)

- **Evidence/cause:** A read-only rg search used the shell-style literal `apps/mobile/src/maintenance/*`, rejected with Windows OS error 123. A planning-generation Python script then failed parsing because a replacement string crossed a newline without triple quotes; Python parsed before execution, so that failed script made no writes.
- **Validator correction (2026-10-23):** A direct whitespace probe over the existing decision document misclassified its intentional two-space Markdown hard break as invalid trailing whitespace. The first probe did not append validation events. Reran a Markdown-aware check that permits exactly two trailing spaces; eight companion paths, links, CAP-1..5 and R1-R24 then passed. Classify existing Markdown syntax before treating it as a generated-file defect.
- **Correction/verification:** Discovered concrete paths with `rg --files`, read task.ts/reconcile-runner.ts, generated the delivery plan using one triple-quoted payload, and applied other document alignment as structured patches. No application source changed. Document/root verification is recorded in the delivery record.
- **Recurrence (2026-10-23, curated Replay planning):** A later search repeated the same literal-wildcard mistake with `docs/decisions/*ai*`. Corrected to `rg ... docs/decisions -g '*.md'`; no source changed. Apple documentation Markdown retrieval also returned an unsupported content-type; retained official capability references without claiming the unread response established details.
- **Prevention:** Before external Windows searches, inspect the exact path argument and reject shell-style `*` path operands; use an actual directory plus rg glob flags; keep multiline document payloads triple-quoted or use apply_patch, and validate resulting links/contracts before declaring planning complete.

## Replay preparation interaction mismatch (2026-10-23)

- **Evidence/cause:** The owner rejected the required preparation steps and requested tap-to-play with optional editing. The current Replay screen opens idle with a Prepare Replay action and does not call playback automatically or expose editing. Engineering preparation stages became mandatory product interactions.
- **Status/correction:** Open implementation gap. Recorded the owner's accepted interaction direction in decision 0009 and project state; no runtime fix or device result is claimed.
- **Planning correction (2026-10-23):** Re-derived CAP-1..5 and five companions, updated the single delivery record with D0-D6, specified durable editor/schema/cache and task ownership, and added R11-R18. Runtime mismatch remains open until implementation and physical acceptance.
- **Later planning refinement (2026-10-23):** Owner-approved sparse timing removes mandatory15-20s holds for one/two memories; timing-contract.md and R25-R28 now require no filler, simple product editor labels, an early one-trip watch/replace/reopen proof and unchanged per-trip cache reuse after global revision changes. Earlier automatic curation/long-Replay acceptance R19-R24 remains. These are plan corrections, not runtime fixes; verify the actual user path before closing the mismatch.
- **Next action/prevention:** Execute D0-D6. Acceptance must exercise one-tap playback, restart-persistent edits and scheduled preparation rather than treating successful encoding as sufficient.

## BMAD party activation UV cache recurrence (2026-10-23)

- **Evidence/cause:** Party activation encountered the previously documented Windows sandbox UV interpreter-cache access denial before resolver execution. A batched invocation also began the next resolver against the same cache boundary; it was interrupted. No application code executed through these commands.
- **Correction/status:** Read shipped party customization and core configuration directly and use the inline session fallback. Sandbox execution remains an environment limitation.
- **Inventory correction:** A guessed `_bmad/_config/agent-manifest.csv` read found no file. Use the available installed skill roster for this discussion; discover actual manifest paths before future reads.
- **Prevention:** Consult the existing UV-cache lesson before activation; stop dependent resolver commands after the first failure and read configuration inputs directly when sufficient for discussion.

- **Spec-workflow recurrence (2026-10-23):** Initial bmad-spec configuration
  resolution hit the same sandbox-local UV interpreter/cache access denial. The
  elevated local `uv run` retry completed and did not run application code. Use
  the approved local UV execution path for BMAD resolver/memlog work after this
  environment-specific failure; do not classify it as a Replay application or
  specification defect.

- **Specification validation correction (2026-10-23):** The first static
  contract probe searched for the simplified phrase `chapter budget`, while the
  authored contract correctly says `chapter's frame budget`; it stopped before
  `git diff --check` and the required foundation check. Correct the probe to
  validate the authored wording, then rerun the complete validation chain. Keep
  validation terms aligned with the contract instead of treating a wording alias
  as a missing requirement.

- **Replay direction save correction (2026-10-23):** The first editor
  regression pressed Newest first and Done in the same React turn, exposing that
  the save handler could capture the previous direction state. Keep the current
  private direction in a ref updated by the control handler, and save that ref
  while the rendered state catches up. The original test failed only in the
  host harness; the failure identified a real rapid-interaction correctness
  risk. Re-run the focused screen suite, TypeScript and lint after the fix.

- **Android build target correction (2026-10-23):** The first post-change
  `expo run:android --device 9cb47ed9` command rejected the valid ADB serial as
  an Expo device *name*, so no build or installation started. Query ADB first,
  then pass the reported model name (`2211133G`) to Expo's device selector.
  Treat command acceptance as a build prerequisite, not evidence of a device
  install or Replay rendering result.

- **Review-diff generation correction (2026-10-23):** The first full-diff
  review command attempted to inline every untracked file, including generated
  local-cache material, and exceeded its command window before producing the
  review path. Build the review diff from tracked changes plus the relevant
  source, test, documentation, and delivery artifacts; exclude generated local
  caches that cannot be reviewed or shipped. Keep the actual product diff under
  review without staging or altering unrelated work.

- **Review-diff PowerShell correction (2026-10-23):** The narrowed review-diff
  script put `-and` inside a `Test-Path` argument list, so PowerShell reported
  an unknown parameter and wrote only tracked changes. Parenthesize each command
  expression before combining it with logical operators, then regenerate the
  review artifact before dispatching reviewers. Do not review a diff that omits
  the untracked Replay implementation files.

- **Review-worker artifact-path correction (2026-10-23):** Review workers cannot
  read this session's sandbox-temporary diff path, so two mandatory review layers
  returned unreadable-content responses and the third was interrupted. Regenerate
  the non-staged review artifact under the workspace before dispatching reviewers,
  then discard the unusable responses and rerun every layer. A missing review
  artifact is not a clean review result.

- **Independent-review capacity limitation (2026-10-23):** After the review
  artifact was rebuilt inside the workspace, both independent reviewers stopped
  with an account usage-limit response before inspecting it. Their earlier
  unreadable-diff responses were discarded. This is an external review-capacity
  blocker, not a review pass; the delivery remains subject to later independent
  review. The local diff audit and executable checks continue, with no claim
  that they substitute for those lenses.

## M4.7 Replay manifest was erased by unrelated Atlas reads (2026-10-22)

- **Evidence/cause:** After Atlas visibly restored nine journeys and its Replay control, the owner saw `found 0 visible trips and 0 attached memories`. Replay used the global durable-reveal generation gate after reading its manifest. Atlas detail reads and routine maintenance refreshes advance that UI-publication gate without changing the private Journey List scope, so the provider replaced an otherwise valid manifest with an empty one.
- **Correction/verification:** Replay now invalidates its manifest only on a privacy mutation or private-record lifecycle loss. The repository remains responsible for the snapshot token and current privacy read; routine Atlas refreshes no longer empty its result.
- **Prevention:** Do not reuse a display-publication generation counter as a data-scope token. Regression coverage must exercise an unrelated Atlas read during Replay preparation and require the current Journey List scope to survive.

## M4.7 Replay access failure was reported as renderer unavailable (2026-10-22)

- **Evidence/cause:** The owner again received `The local Replay renderer is unavailable on this device`. Fixed Android diagnostics showed a Replay start followed immediately by `REPLAY_UNAVAILABLE`, while the native FFmpeg hybrid object had loaded and the synthetic encode had already passed. Source tracing showed that a rejection while resolving current native media handles escaped the provider as an untyped error; the screen's fail-closed fallback labeled it as renderer unavailability.
- **Correction/verification:** The provider now maps manifest-read and native-handle-resolution failures to the closed `REPLAY_ACCESS` stage, retaining native messages in memory and keeping them out of UI, diagnostics, and records. A focused provider regression covers that boundary; mobile TypeScript, lint, provider, and Replay screen tests pass. Physical confirmation of the corrected message and subsequent render result remains pending.
- **Prevention:** Every Replay boundary must map its own failure to a fixed stage before crossing into screen state. Do not use the renderer-unavailable message for an untyped access or manifest error.
- **Recurrence (2026-10-22):** After the first correction, the owner still saw the renderer-unavailable copy while the current development process had a Replay start event and the device's synthetic renderer completed. The only remaining catch-all was `instanceof ReplayPreparationError`; a Fast Refresh/native realm boundary can retain an earlier error prototype and fail that identity check. The classifier now accepts only the closed, fixed Replay-stage vocabulary from such an error object, while unknown values still fail closed to renderer-unavailable. Provider prerequisites now classify privacy/lifecycle loss as stale and missing manifest/media resolution as access. Renderer, screen, provider, lint, and TypeScript checks pass; physical preparation is pending.
- **Recurrence (2026-10-22):** The current-device event still emitted an actual `REPLAY_UNAVAILABLE` before private media access, so it was not only a stale screen classifier. Munim documents `libopenh264` as the bundled cross-platform fallback, but its dynamic codec-discovery report can be absent or delayed. Replay now treats discovery as advisory, attempts `libopenh264` when it returns no candidate, and uses Android's required `nv12` output format when `h264_mediacodec` is selected. An actual FFmpeg failure now reaches the encode stage instead of being rejected before composition. Mobile lint, TypeScript, and focused tests pass; device confirmation remains open.
- **Recurrence (2026-10-22):** The exact current Android build then passed both synthetic S0 checks, including a verified local MP4, proving cache access, native response, and encoder availability. The Replay screen nevertheless still had a generic unavailable path before `preparePrivateReplay`: its initial `loadReplayManifestInput` call let native manifest and preview-resolution failures escape as untyped errors. That boundary now maps both failures to `REPLAY_ACCESS`; a provider regression covers the screen-first call. The next device result must be the actual access outcome or render result, never renderer availability for that path.

## M4.7 Atlas recovery hid the Replay entry (2026-10-22)

- **Evidence:** The owner reported that Replay disappeared from Atlas. The Android accessibility tree showed Atlas in recovery with `Journeys · 0`, the retained-journey message, and the fixed reason `Replay is unavailable while the local record needs recovery.` The database inventory still showed the private SQLite record; no private rows, media, locations, or raw errors were inspected or emitted.
- **Cause:** The durable reveal selected only the newest completed reconstruction run. A transient native-source failure may write a same-revision completed pass with no qualified journeys, leaving the UI with no retained projection even though an earlier qualified projection remains durable.
- **Correction/verification:** Durable Atlas and Replay reads now select the latest qualified completed run for the newest evidence revision, then apply the current privacy filter. This cannot resurrect a hidden journey, and a later authoritative projection still replaces the retained one. Mobile TypeScript, lint, and the 52-case reconciliation repository suite pass; physical recheck is pending.
- **Prevention:** A recovery-state test must prove the Replay entry remains reachable from a retained qualified projection and a new empty pass cannot erase it without a new evidence revision or current privacy exclusion.

## M4.7 Android development-server IPv4 recovery (2026-10-22)

- **Evidence/cause:** The connected Android development build remained on a
  reload/error surface because it retained an unreachable LAN packager address.
  A replacement Expo server started with `--localhost` listened only on IPv6
  loopback, while the device's ADB-reversed connection reached IPv4 loopback;
  the launcher therefore received no complete bundle response. A diagnostic
  filter also initially used PowerShell's reserved `$PID` variable, so it
  inspected the shell process instead of the application process.
- **Correction/verification:** Restarted Expo with its localhost host type and
  `NODE_OPTIONS=--dns-result-order=ipv4first`, which listens on
  `127.0.0.1:8081` without exposing the private server to the LAN. Re-applied
  `adb reverse`, cold-launched the development build at that loopback endpoint,
  and observed Metro bundle `node_modules/expo-router/entry.js` successfully.
  The device displays the Travel Life Welcome screen with no fresh loader or
  application crash entry.
- **Prevention:** For physical Android checks on this host, use the private
  IPv4-loopback Metro start plus ADB reverse; preflight both the listener address
  and an HTTP status response before opening the dev client. Use `$appPid`, not
  PowerShell's reserved `$PID`, in device-log commands. Do not broaden to a LAN
  server unless its data-exposure boundary is explicitly approved.
- **Recurrence (2026-10-22):** A later device reload command assumed `adb` was
  still on the active shell's `PATH`, so every requested device action stopped
  before execution. The Android SDK binary is present at the standard local SDK
  location. Invoke that absolute executable or establish the session PATH before
  a device check; do not report a reload as having occurred until the command
  returns its device result. The corrected command then assumed the obsolete
  `com.travellife.app` package, so its cold launch aborted. A process/package
  query established the active development package as `com.anonymous.travellife`;
  the subsequent reverse, force-stop, launch, and Atlas deep link completed.
  Query the active package before replaying a device lifecycle command instead
  of carrying a package identifier across builds.
- **Recurrence (2026-10-22):** A later fixed-diagnostic command again used the
  case-insensitive PowerShell `$pid` name and stopped before reading the current
  process. The immediate retry used `$appPid` and returned the current closed
  `REPLAY_UNAVAILABLE` event. Keep the preflight variable name in the command
  template; do not use `$PID` in any casing.
- **Tooling correction:** An initial broad `rg` invocation included generated
  dependencies and emitted megabytes of irrelevant map data while locating the
  S0 route. No source or device state changed. Restrict route and component
  lookups to `apps/mobile/src` with explicit TypeScript globs.
- **S0 route correction:** Treating `/replay-s0` as part of the Expo development
  manifest URL opened the Dev Launcher error surface because that URL is a
  manifest endpoint, not a Router navigation endpoint. No renderer probe ran.
  Restored the private root manifest URL and observed the app's Welcome screen
  with a successful Android bundle. Keep the physical S0 status unpassed until
  the probe is reached through a supported in-app route and the owner taps it.
- **Device-input limitation:** Android denied the host's synthetic scroll event
  because this device does not grant `INJECT_EVENTS`. The development-only S0
  entry was initially placed on Welcome, which was the wrong product surface.
  It now appears only in the fail-closed Replay state after Prepare Replay;
  the owner navigates there and taps it. This is an environment permission
  boundary, not a renderer result.
- **Owner-confirmed S0 availability:** The owner observed both terminal messages:
  `Renderer responded on this phone` and `Check complete`. This passes only the
  synthetic native-module response gate. No encode command, MP4 output,
  FFprobe validation, preview, or sharing was part of that probe, so no Replay
  video is expected yet. The next synthetic encode/output-validation gate is
  implemented and awaits a physical-device result. **Update:** the owner
  confirmed the synthetic-video terminal success. This proves only synthetic
  cached MP4 encoding and FFprobe validation; it does not authorize a claim
  that private Replay composition, preview, or sharing works. Keep production
  rendering fail-closed while attachment materialization is built.

## M4.7 Replay preview test native-module boundary (2026-10-22)

- **Evidence/cause:** The first screen test after adding the real Replay preview
  imported `expo-video` through Jest's native-less shell and failed before any
  assertion because its native player class is unavailable there. This was a
  test harness boundary, not an Android/iOS playback result.
- **Correction/verification:** Mock the player hook and view in the Replay
  screen test, then assert the sanitized local-artifact preview state. Native
  playback remains a required physical-device acceptance check.
- **Prevention:** Every component that directly imports a native view/player
  needs a narrow test adapter or module mock before it is added to an existing
  Jest-only screen harness.
- **Recurrence:** Provider tests import the renderer indirectly. Its native
  FFmpeg package publishes an ESM entry that this Jest configuration does not
  transform, so the suite failed during module loading. Mock that closed native
  boundary in provider tests as well; this does not constitute renderer proof.
- **Type correction:** The export acknowledgement initially introduced a
  non-existent diagnostic reason code, which TypeScript rejected. Use the
  closed `RESTRICTED` code for an unavailable share API. Typecheck must run
  after every diagnostics change, even when the screen test passes.

## M4.7 Android screenshot capture command correction (2026-10-22)

- **Evidence/cause:** A device-screen capture piped the PNG stream to
  PowerShell `Set-Content -Encoding Byte`; this PowerShell version does not
  support that encoding value, so no screenshot was written. The app and
  device state were unchanged.
- **Correction/prevention:** Use `Set-Content -AsByteStream` for binary ADB
  output and inspect the resulting local file. Keep screenshot output ignored
  and use it only to confirm current UI state.
- **Recurrence/cause:** Native command output is surfaced as strings by this
  PowerShell host, so `-AsByteStream` also cannot preserve it. Redirect
  `adb exec-out` directly through one `cmd.exe` process for a binary-safe
  local capture; do not pipe that stream through PowerShell.
- **Invocation correction:** Escaping the nested command directly in the tool
  command string introduced literal backslashes for `cmd.exe`. Launch cmd with
  its arguments as a PowerShell argument array so the quoted ADB executable and
  output path reach its own parser intact.
- **Fallback:** The host still rejected the nested redirection path and created
  a zero-byte ignored file. Stop retrying screenshot redirection. Use Android's
  XML UI dump for text-only current-screen verification; it avoids binary
  transport and does not inject input.

## M4.7 Android private-store inventory command correction (2026-10-22)

- **Evidence/cause:** The app-private SQLite directory listing succeeded and
  confirmed the local database, but a follow-up `find -printf` format was
  malformed by PowerShell escaping and failed after that useful result.
- **Correction/prevention:** Use the successful bounded directory listing for
  inventory evidence. Do not add an unnecessary second formatting command when
  filenames and byte sizes are already present; never read private rows merely
  to prove file existence.

## M4.7 Android XML label extraction quoting correction (2026-10-22)

- **Evidence/cause:** A shell `grep` expression for parsing the Android XML
  accessibility dump was interpreted by PowerShell before reaching Android and
  failed without affecting the device or app.
- **Correction/prevention:** Read the local S0 component source for its known
  navigation controls rather than sending regex-heavy nested shell syntax
  through PowerShell. Keep XML inspection to plain dumps when needed.

## M4.7 synthetic S0 navigation trap (2026-10-22)

- **Evidence/cause:** The owner reached the development-only S0 screen and
  completed both synthetic checks, but that route rendered no Replay or Atlas
  return action. It stranded the owner in a diagnostic path instead of letting
  them continue to the actual private Replay flow.
- **Correction/verification:** Add explicit replace-navigation controls for
  private Replay and Atlas to the S0 screen. The controls do not expose media,
  change private data, or imply that S0 is product acceptance.
- **Prevention:** Every development-only diagnostic route must include a clear
  return to its product entry point and must never become the terminal owner
  path after a successful probe.

## M4.7 Replay fixed-failure test boundary (2026-10-22)

- **Evidence/cause:** Adding the closed failure-stage mapper made the screen
  test import `renderer.ts` directly, exposing the native FFmpeg package's ESM
  entry to Jest. A separate assertion still expected the retired raw renderer
  failure name. These were test-only failures; no Android behavior changed.
- **Correction/prevention:** Mock the native module at the screen test boundary
  and assert the new fixed `REPLAY_UNAVAILABLE` stage. Add a visible fixed-stage
  screen assertion so generic failure copy cannot return unnoticed.

## M4.7 Replay production encoder allowlist mismatch (2026-10-22)

- **Evidence/cause:** Owner replay preparation reached the fixed
  `REPLAY_UNAVAILABLE` state. The synthetic Android S0 had successfully
  encoded a local MP4 using the ordered candidate set that includes
  `libopenh264`, while production preparation omitted that candidate and could
  therefore find no encoder on this phone. No private media was rendered.
- **Correction:** Use the same closed ordered local encoder allowlist for
  production composition. Real private output remains subject to strict stream,
  size and duration verification; if it fails, the next fixed stage will be
  recorded without native logs or source data.
- **Prevention:** Synthetic S0 and production candidate allowlists must be
  compared before declaring a renderer unavailable. A synthetic encode does not
  complete the full platform S0 or acceptance matrix.

## M4.7 Replay manifest RED/typing correction (2026-10-22)

- **Evidence/cause:** The first real-SQLite reproducer asserted every manifest
  memory would become unknown after changing one shared synthetic source; the
  fixture also contained independent available attachments. The first provider
  implementation passed a readonly source-ref array to the mutable native-adapter
  interface, so TypeScript rejected it.
- **Correction/verification:** The regression now asserts that at least one
  unknown, undated effective attachment survives. Provider passes a copied array
  and strips source references before returning to a screen. The focused SQLite,
  provider and TypeScript checks pass.
- **Prevention:** Test the targeted fixture identity/property, not a broad shared
  set; preserve adapter parameter mutability at the provider boundary.
- **Tooling recurrence:** A combined source-inspection command passed multiple
  paths to one `Get-Content -LiteralPath` invocation and PowerShell rejected its
  positional arguments before reading the final files. No source changed.
  Prevention: use one `Get-Content` invocation per literal path or a loop when
  inspecting independent files.

## M4.7 Replay and journey album scope mismatch (2026-10-22)

- **Evidence/status:** Owner reports Prepare Replay finds nine visible trips and zero usable attached memories. Open: the precise device-data cause is unverified. Source inspection shows Replay requires stored `availability === 'available'`, while the album passes unknown items to the owner-preview resolver. Replay also uses a separate membership query and omits media without a captured day; equivalence with the album is not established.
- **Required correction:** Consume the same effective journey-media membership and access-resolution behavior as the album, preserving owner corrections and privacy. Resolve unknown access before reporting unavailable media; an absent capture day must not alone remove an attached memory from private replay scope. Do not merely relabel unknown as available.
- **Verification/next action:** Add parity cases for unknown-but-resolvable media, mixed photos/videos, undated attachments and membership corrections, then verify the owner-reported flow on device. No application fix or device acceptance is claimed by this discussion.
- **Investigation tooling:** An initial search assumed root `src`/`app` directories and reported missing paths. File discovery located the implementation under `apps/mobile/src`; the corrected search succeeded. Prevention: discover repository paths with `rg --files` before scoped searches.


## M4.7 Android development-launcher crash recovery (2026-10-22)

- **Evidence/cause:** After repeated deep-link reload attempts, the device showed the development launcher's error screen. Android's crash buffer attributes the failure to Expo Dev Launcher rejecting a second React-context creation during activity startup. There was no fresh Replay JavaScript error, renderer error, or application-process crash tied to the Journey List change.
- **Correction/verification:** Rebuilt and reinstalled the Android development build. Gradle completed successfully, installed the APK, opened the development URL, and `MainActivity` is the current resumed activity with no new crash entry. This does not establish the owner-visible Replay behavior.
- **Prevention:** Use one stable Metro endpoint and one normal launcher start for physical acceptance; do not repeatedly deep-link a running Dev Launcher instance. Distinguish its lifecycle crash from app-feature failures before changing product code.

## M4.7 Journey List verification fixture and invocation correction (2026-10-22)

- **Evidence/cause:** The initial Journey List real-SQLite assertion expected media to remain after hiding one synthetic trip, but its surviving trip intentionally reused the same supporting evidence. Privacy correctly withheld it. A compound Jest command also exposed the existing asynchronous Replay screen-harness timeout when that screen suite ran beside another suite.
- **Correction/verification:** The SQLite expectation now reflects shared-evidence withholding; its positive assertion remains before hide. Run the Replay screen suite in its existing isolated invocation with its repository-local cache, and run the selection suite separately.
- **Prevention:** Fixtures that reuse media across journeys must assert privacy propagation, not independence. Keep this React Native screen suite isolated until the shared act configuration is repaired.

## M4.7 BMAD workflow sandbox retry (2026-10-22)

- **Evidence/cause:** The required `bmad-build` workflow renderer first failed before reading project state because Windows denied its `uv` interpreter-inspection temporary-file write. No source or delivery artifact changed in that failed attempt.
- **Correction/verification:** Re-ran the exact renderer through the approved host boundary; it produced the workflow path successfully. The owner amendment is now being implemented through that workflow.
- **Prevention:** Treat this as a host sandbox temporary-file limitation, preserve the failed output, and use one approved host retry for the same required BMAD renderer rather than substituting an unrendered workflow.
- **Recurrence (Replay planning):** Spec activation using uv's default cache hit
  the same interpreter-cache persistence denial. Setting `UV_CACHE_DIR` to the
  writable workspace `.local/uv-cache` allowed the exact config/customization and
  memlog commands to succeed without escalation. Prefer a writable local cache
  before host escalation for these Python workflow helpers.

## M4.7 planning patch context correction (2026-10-22)

- **Evidence/cause:** One renderer-document patch expected a sentence to be a
  standalone line, although it was part of a longer paragraph. The patch tool
  rejected it before any writes.
- **Correction/verification:** Reissued the patch with the exact paragraph
  context; it applied. Validate the resulting canonical companion links, limits
  and whitespace before handing off the plan.
- **Prevention:** Match actual complete Markdown lines when patching paragraphs;
  do not treat wrapped display text as source line boundaries.

## M4.7 Android S0 launch corrections (2026-10-22)

- **Evidence/cause:** The first device lookup selected the literal `adb` command before proving it existed; the next PowerShell collection indexed a string as a character. After resolving the SDK executable, the sandbox could not start its ADB server. Expo then rejected the ADB serial as a `--device` name.
- **Correction/status:** Use the confirmed SDK `adb.exe` with host access and Expo's detected model name (`2211133G`). The Android development build succeeds and installs with the native renderer module; a development-only synthetic S0 route is open for the owner to tap. No renderer result is recorded until that interaction completes.
- **Prevention:** Resolve executable paths before invocation, preserve array shape in PowerShell, use host ADB for device actions, and pass Expo its device name rather than its serial.

## M4.7 Android S0 terminal-feedback correction (2026-10-22)

- **Evidence/cause:** The owner tapped the synthetic renderer control and perceived no response. Fixed Android diagnostics prove the action entered and completed the synthetic native query, and Android's loader recorded `libmunimffmpeg.so` loading successfully. The original terminal text was too visually subtle to constitute reliable owner acknowledgement.
- **Correction/status:** The S0 screen now changes its heading, adds a `Check complete` panel, and disables/relabels the action after a successful response. This is a synthetic module-response pass only; it does not prove encoding, MP4 validation, cleanup, or share handoff. The owner must reload the updated JavaScript and confirm the visible state.
- **Prevention:** A physical probe must have both a closed diagnostic outcome and a distinct visible terminal state before it can be counted as click-and-wait evidence.

## M4.7 Replay sparse-state test interaction correction (2026-10-22)

- **Evidence/cause:** Adding a second asynchronous screen interaction after the existing cancellation flow produced overlapping React `act` scopes in this repository's React Native test harness. A follow-up attempt treated the project's asynchronous `render` helper as synchronous, so the result no longer exposed query methods. Neither failure exercised device rendering or altered product state.
- **Correction/verification:** Removed the unstable duplicate interaction from the screen-flow test and retained the qualified-group threshold in selection and SQLite repository tests. The established screen test, TypeScript, and lint pass. The app's sparse message now reports the exact qualified group count and offers photo-access recovery.
- **Prevention:** Keep one asynchronous Replay screen flow per harness render until the shared React Native test setup is made act-safe; cover a second branch in a separate isolated suite only after that setup is repaired.

## M4.7 device verification environment limitation (2026-10-22)

- **Evidence/cause:** The local Android-device inventory command could not start because `adb` is not installed or not on this host's PATH. No emulator, device, native development build, renderer encode, or share handoff was attempted.
- **Correction/status:** Keep Android and iOS S0 acceptance open. Local automated checks remain separate from physical-device evidence.
- **Prevention:** Verify the available Android/iOS toolchain before scheduling owner click-and-wait validation; do not infer device reachability from Expo JavaScript checks.

## M4.7 Expo permission diagnosis correction (2026-10-22)

- **Evidence/cause:** A first reading of resolved Expo config attributed `android.permission.WRITE_EXTERNAL_STORAGE` to the newly added renderer plugin. Comparison with the committed pre-Replay `app.json` and inspection of the plugin show the app already blocked that permission and the renderer plugin only configures packaging and iOS simulator settings.
- **Correction/verification:** Preserve the existing explicit blocked-permission and `savePhotosPermission: false` policy. The Replay change adds no Android permission declaration; resolved-config output is not treated as proof that a renderer plugin introduced one.
- **Prevention:** Before attributing a generated manifest/config permission to a new dependency, compare the prior source configuration and inspect the plugin implementation.

## M4.7 Expo Doctor verification limitation (2026-10-22)

- **Evidence/cause:** After installing the Replay-native dependencies, sandboxed Expo Doctor could not resolve the npm registry. The approved host retry reached the registry and completed 20/21 checks; its only failure is the already-recorded nine Expo SDK patch-version mismatches (`@expo/ui`, Expo, asset, constants, linking, router, splash-screen, dev-client and jest-expo).
- **Correction/status:** The new `expo-sharing`, `munim-ffmpeg`, and Nitro bridge packages were not listed as mismatches. No SDK patch upgrade is included in this Replay change because it would broaden the native acceptance scope.
- **Prevention:** Distinguish a sandbox DNS failure from an Expo compatibility result, then rerun the same read-only diagnostic with the required registry access before reporting its outcome.

## M4.7 Replay SQLite fixture correction (2026-10-22)

- **Evidence/cause:** The first Replay manifest-input SQLite fixture reused a confirmed journey that intentionally retained an uncertain visit. The Replay chronology gate correctly returned no group; adding one chronological visit to that journey did not make all its support certain.
- **Correction/verification:** The fixture now creates a separate current-run journey with exclusively chronological observed support and `membership:primary` media. The full real-SQLite suite passes 86/86, including its privacy-hide assertion.
- **Prevention:** Fixture data for a strict all-support ordering gate must isolate the positive case from intentionally uncertain source data instead of mutating a broad generic journey.

## M4.7 Replay UI test correction (2026-10-22)

- **Evidence/cause:** The first Replay screen test treated the asynchronous React Native render helper as synchronous and referenced a non-prefixed mock from a Jest factory, so typecheck and Jest stopped before product assertions.
- **Correction/verification:** Await rendering and use the allowed `mock`-prefixed factory binding. Rerun the focused screen suite and typecheck before accepting the UI test.
- **Prevention:** Follow the established async render/mocking pattern from the provider tests before adding discoverable React Native cases.

## M4.7 Replay renderer mock correction (2026-10-22)

- **Evidence/cause:** The first renderer/share test supplied a hoisted Jest mock factory that did not expose `isAvailableAsync` to the namespace import at runtime, so the adapter test stopped with a type error before its assertions. This is a test-double wiring failure, not native share or renderer evidence.
- **Correction/verification:** The factory now creates functions directly and the test configures the imported module mock. With an explicit repository-local Jest cache, `replay-renderer.test.ts` passes 2/2.
- **Prevention:** For hoisted module mocks, configure the imported mocked function after the mock declaration rather than closing over test-local factories.

## M4.7 sandboxed Jest cache verification limitation (2026-10-22)

- **Evidence/cause:** The parent replay-suite verification could not initialize any suite because sandboxed Jest was denied an atomic rename in its temporary transform cache (`EPERM`). This is a host sandbox limitation, not evidence of a product-test failure.
- **Correction/status:** Keep the subagent's host test result separate from this failed parent rerun. Parent verification remains blocked until the same command is executed with a repository-local writable cache or approved host execution.
- **Prevention:** For Windows sandbox runs, set an explicit repository-local Jest cache directory or obtain host execution before treating a rerun as verification.
- **Recurrence (selection amendment):** A focused Replay Jest command again used
  the sandbox default cache and failed before test discovery with the same
  atomic-rename `EPERM`; TypeScript still passed. Re-run focused suites with
  `--cacheDirectory=./.jest-cache-codex` and do not count the failed sandbox
  invocation as product-test evidence.

## M4.7 Replay implementation test-harness corrections (2026-10-22)

- **Evidence/cause:** The first new Replay screen test failed before rendering because the existing Jest environment did not provide `expo-video`; after adding that mock it incorrectly treated the asynchronous React Native `render` helper as synchronous. These were test-harness mistakes, not product-renderer behavior.
- **Correction/verification:** The test supplies the narrow native-video double and awaits render. The four required discovered Replay suites then pass on the host boundary: 7 tests across selection, controller, renderer gate and screen.
- **Prevention:** Reuse the established native-module mocks when a shared screen imports a native viewer, and inspect the test helper's async signature before writing assertions.

## M4.7 specification readiness correction (2026-10-22)

- **Revision tooling:** A document regeneration patch combined delete/add for the
  same path; the patch tool rejected the operation atomically before writes.
  Reissued as explicit update operations and separate new companion additions.
  Prevention: replace an existing document using Update File, not delete/add.

- **Evidence/cause:** Review of the agent-authored draft found undefined selected
  export scope, chronology, per-memory eligibility and resource limits; ambiguous
  library-save versus native-share behavior; incomplete artifact/export lifecycle;
  an unresolved renderer spike; and proposed Replay tests outside Jest's configured
  discovery. The earlier coherence/preservation verdict overstated readiness and
  did not account for the source story's optional hosted-publication handoff.
- **Correction/status:** Recorded the concrete gaps and resolutions in
  `_bmad-output/implementation-artifacts/review-m4-7-replay-spec-2026-10-22.md`.
  Draft remains unapproved; spec corrections and renderer validation are open.
  No application fix or device result is claimed by this review.
- **Prevention:** Before a ready-for-development verdict, trace each source AC
  into the delivery contract, check actual test discovery, define state transitions
  through preview/export/disposal, and distinguish unresolved feasibility from
  measured evidence. Validate selection, chronology and memory eligibility separately.
- **Review tooling recurrence:** Combined parallel result output exceeded the
  response budget. Re-read the complete lens instructions and targeted callee/spec
  slices before concluding. Bound the aggregate output, not only each subprocess.
- **Measurement correction:** The earlier word count used a different counter;
  the editorial script measures 1,005 words in the implementation spec. Neither
  measurement establishes the workflow's token target. Report units explicitly.
- **Revision verification:** Owner-authorized spec revision now maps all A1–A10
  and E1–E9 into concrete selection, renderer and verification contracts, including
  test discovery and the optional hosted handoff. Document links, capability
  IDs/shape, source mappings, timing bounds and whitespace checks pass; root
  `npm run check` passes 20 tests and eval smoke. Document omissions are corrected;
  native feasibility, implementation and both-platform acceptance remain open.

## M4.7 replay specification tooling (2026-10-21)

- **Evidence/cause:** The initial BMad customization/configuration commands used
  the sandboxed `uv` runtime and could not persist its interpreter-cache probe,
  ending with access denied before either resolver returned data. A combined
  context read also exceeded the tool output limit, so it did not prove every
  requested source was read.
- **Correction:** Applied the documented direct-TOML fallback for customization
  and configuration, then switched to bounded source reads. Use an approved
  unrestricted `uv` invocation only where the BMad workflow requires its
  atomic memlog writer or rendered build workflow.
- **Prevention:** Do not batch whole project-state/playbook files with planning
  sources. Keep `uv` cache-sensitive BMad commands isolated and request the
  least privilege needed before treating their output as workflow evidence.
- **Recurrence:** A subsequent broad `rg` crossed generated world-geometry data
  and again exceeded the output budget. It made no source change. Prevention:
  search known application roots with explicit file globs and filenames before
  widening any repository search.
- **Second recurrence:** A scoped capability lookup still named the nonexistent
  `apps/mobile/app` directory and returned an error, while an unbounded match
  emitted oversized test/source context. No code or check ran against that
  missing path. Prevention: discover route roots before searching, then inspect
  named replay files one at a time with a match cap.
- **Third recurrence:** A combined error-playbook/config/provider inspection
  exceeded the response limit before the provider context could be consumed as
  a complete read. No source changed. Prevention: read one provider slice or
  symbol window per command, never concatenate it with a large lessons search.

## Accepted-work publication verification (2026-10-21)

- **Next-step lookup recurrence:** A roadmap lookup passed a literal directory
  wildcard to `rg` and returned Windows error 123. Reissued it against the
  directory with `-g` file filters; roadmap and deferred-work evidence were read.
  No application change occurred. Prevention: always pass directory roots and
  `-g` filters to `rg` on PowerShell, including short read-only planning lookups.

- **External/pre-existing check limitation:** Fresh Expo Doctor ran successfully
  against the registry but exited 1 with 20/21 checks: the same nine Expo SDK
  patch-version recommendations recorded earlier. No dependency changed during
  publication. This remains an open compatibility check; a separate dependency
  update must include native/map validation. Root checks, mobile Jest 402/402,
  SQLite 85/85, TypeScript and lint passed independently.
- **Output-sizing recurrence:** Initial context and large repository-diff reads
  exceeded the response limit. No source was changed by those reads. Continued
  with bounded file/section inspection, explicit suite summaries and path-only
  delivery audits. Prevention: inspect diff hunk ranges before requesting a
  large repository file; keep each output within its allocated budget.

## M4.3 parent review verification and tooling (2026-10-21)

- **Evidence/cause:** Initial implementation passed its checks but independent
  review exposed stale cached memory/Home-base writes, cross-policy fallback
  scope contamination, incomplete policy-table/row validation, misleading list
  loading copy, missing read diagnostics and untested refresh/overlap paths.
  Exclusion with effective memory or persisted split corrections also reproduced
  a remap failure blocking rebuild. These are implementation gaps, not acceptance.
- **Correction:** Revalidate transaction inputs against current privacy; isolate
  fallback cache per policy; validate canonical physical constraints and complete
  rows; distinguish pending/failed/empty UI and provide reload; disclose reviewed
  Hide scope; index rows once. Suspend only applications depending on explicitly
  excluded evidence, retain immutable revisions, and reactivate after restoration.
- **Verification:** Parent all 85 real-SQLite cases pass, with stale-write,
  overlap, refresh-failure, malformed-storage and correction-reactivation cases.
  UI loading/scope tests executed RED before their fix and all six then passed.
  Final full mobile/review/device outcomes are in the delivery record: mobile
  402/402 and SQLite 85/85 pass, and the owner confirmed Android Hide/Restore and
  Exclude/Recheck/Restore completed correctly. iOS remains untested.
- **Parent tooling incident:** A nested `node -e` edit was misquoted by
  PowerShell and stopped before any write. Replaced with explicit apply_patch;
  import/manual fixture suites then passed 26 tests. A parent schema hardening
  edit preceded its new targeted regression; its later passing compatibility
  test is GREEN evidence only, not a valid RED claim. Prevention: write regression
  first and prefer patch tools or saved scripts over nested inline quoting.
- **Reviewer tooling:** One literal Windows wildcard search and assumed
  instruction-reference paths failed without code/test execution. Corrected
  searches and read embedded instructions. Two reviewers hit account limits;
  resumed reviews returned findings, never treat interrupted workers as clean.
- **Prevention:** For privacy work cover every cached read/write boundary,
  multi-policy restore, failed publication, retained storage constraints, explicit
  exclusion precedence and reactivation. Preserve existing unrelated remap guards.
- **Final review recurrence:** A cancelled provider policy-list read still returned
  an empty array, bypassing the new UI failed state. The overlapping-command
  regression reproduced this RED; cancellation now rejects with fixed safe copy,
  retaining the skipped LIFECYCLE diagnostic. Provider/UI tests pass 35/35.
  Prevention: cancellation must never impersonate a successful empty domain read.
  A parent lookup guessed `docs/deferred-work.md` and omitted ignored rendered
  workflow files; discovered the actual paths with bounded `rg --files` before
  continuing. A later optional sprint-status read also found no file at the
  conventional path; there is no sprint tracking file to synchronize for this
  standalone spec. Check existence before optional reads. No source changes
  resulted from those failed lookups.

## M4.3 privacy review fixes: independent policies and stale write gates (2026-10-21)

- **Evidence/cause:** Independent review found each fallback policy cache retained
  the union of all blocked journeys, preventing an unrelated restore from showing
  its prior record. Cached memory and Home-base selections also lacked fresh
  privacy checks inside their writer transaction. Review scope used repeated
  linear lookups and provider review/list failures had no fixed diagnostic.
  Effective memory corrections could then abort every rebuild after their
  supporting evidence was deliberately excluded.
- **Correction:** Resolve each policy's own cached protection; verify current
  lifecycle/run/privacy and selected memory scope before insert. Index reviewed
  evidence once. Privacy-read diagnostics use fixed review/list stages, classify
  native failures only in memory, and represent invalidated reads as skipped
  lifecycle outcomes. Temporarily omit activation only for immutable memory
  corrections whose source or reviewed support demonstrably intersects current
  privacy-excluded inputs; restoration reactivates the original revision.
  Consume persisted policies only after full closed-row validation.
- **Verification:** Regression RED reproduced fallback restore loss, stale Home
  save, and all four effective memory actions aborting exclusion rebuild. Focused
  privacy SQLite tests now pass 21/21, including support-only dependency, restored
  activation, protected cross-journey cached memory, overlapping fallback,
  visible overlap/create/restore and malformed row/constraint preservation.
  Provider tests cover native failure redaction, invalidated reads and post-save
  fallback refresh/filter failure. Parent runs final broad checks and review.
- **Prevention:** Pair each independent policy with its own fallback state; every
  cached source/target mutation revalidates inside the writer lock. Include
  existing owner overlays in exclusion tests and preserve unrelated fail-closed
  guards. A search during this fix used the root-relative path from mobile CWD;
  it made no change and was corrected to the root CWD. Use verified absolute
  paths for cross-directory commands.
- **Status:** Targeted defects corrected; final parent acceptance still pending.
- **Structural follow-up:** A seeded persisted split revision rebuilt normally
  before exclusion but failed its remap afterward. The same exact reviewed-support
  predicate now suspends only dependent split/merge/remove-visit/reject activation,
  retaining immutable revisions for restoration. Privacy SQLite **22/22** passes;
  provider/repository/diagnostic focused Jest **3 suites / 88 tests** passed before
  this final helper extraction. Parent reruns final checks.
- **Deferred pre-existing adapter finding:** Native split fixture setup first
  used one visit, then multiple actual ordered visits exposed that persisted
  `reconstruction_visit.ordering` is `ordered` while the detail cache passes it
  into a split check expecting `chronological`. No native adapter change was
  made in M4.3. The seeded split fixture proves exclusion precedence and restore
  parity only; its continuity output does not prove a successful native split or
  multiple published successors. Parent owns the separate deferred follow-up.

## M4.3 implementation discovery and output sizing (2026-10-21)

- **Evidence/cause:** A context batch exceeded the tool output limit; subsequent
  reads use bounded sections and the playbook index. A route read guessed
  `journey/[id]/edit/index.tsx`; actual route is `journey/[id]/edit.tsx`.
- **Correction/prevention:** Discover routes with `rg --files` before reading,
  and size reads per file rather than concatenating the entire large playbook.
  No check or source change ran against the missing route.
- **Status:** Discovery corrected. Expected privacy TDD RED is recorded in the
  delivery spec rather than as a product incident.
- **Implementation tooling recurrence:** One edit used a root-relative path
  from the mobile working directory and made no change; a guarded replacement
  then stopped on CRLF before writing. A broad `return {` patch placed methods
  in the batch inserter; moved them to the repository before GREEN. A UI patch
  used a partial JSX line and was rejected atomically. First typecheck found
  the guessed `whenIdle` method; corrected to existing `whenImportIdle`.
  Prevention: use absolute paths, normalize line endings in guarded scripts,
  anchor repository methods by adjacent method names, and discover coordination
  interfaces before invoking them. Core SQLite privacy tests pass 4/4.
- **Verification fixture recurrence:** First broad verification passed the new
  privacy cases but found three positional repository mocks consuming the new
  policy query as journey rows, and three retained-v33 snapshot tests expecting
  version markers not to advance. Corrected fixtures to include the policy read,
  current run identity, and legitimate v34 marker transition, preserving all
  owner-data expectations. Prefer SQL-dispatched mocks and explicit migration
  expectations whenever introducing an additive schema/read boundary.
- **Broader fixture follow-up:** Full Jest exposed remaining v33 assertions,
  an overlap mock returning manual rows for every query, and a lifecycle-race
  fixture keyed to the fifth read. Update schema expectations to v34, dispatch
  overlap rows by SQL, and trigger disconnection on projection insertion rather
  than on the read count. A later guessed context-helper path was corrected to
  the actual import `atlas/preview-context.ts`. Prevention: use call-purpose
  triggers for races; read current imports before guessing helper locations.
- **Verified result:** Corrected broad run passes 40 Jest suites / 392 tests,
  70 real-SQLite cases, typecheck/lint. Further focused UI/provider 26 tests and
  eight privacy SQLite cases pass, including cross-target idempotency rejection.
  Final root/review/device acceptance is still owned by the parent workflow.

## M4.3 audit path discovery recurrence (2026-10-21)

- **Evidence/cause:** Read-only audit searches used guessed route/provider paths
  (`navigation/routes.ts`, `apps/mobile/app`, `photo-access-provider.tsx`) and a
  shell-style component wildcard. Actual paths are discoverable under `src/app`,
  `navigation/app-contract.ts` and `photo-access/provider.tsx`. Searches against
  missing paths returned errors; no application check or source edit ran there.
- **Correction:** Used `rg --files` to resolve the current routes/provider and
  inspected those exact files. Recorded the actual paths in the M4.3 draft.
- **Prevention:** Treat filenames from memory as hints. Discover exact paths
  first; use `rg -g` for globs instead of passing a Windows wildcard as a path.
- **Status:** Audit corrected; product decisions remain open in the draft spec.

## Empty-constraint graph reuse verification fixtures (2026-10-21)

- **Evidence/cause:** A test discovery command guessed the nonexistent
  `reconstruction-repository.test.ts` filename. No test ran at that path.
  A reviewer also supplied a literal Windows `*.ts` path, then corrected the
  search to `rg -g`; no source changed from the failed discovery attempt.
  An initial parity fixture expected a separated, same-place owner merge to
  survive canonical continuity; the unchanged reference instead rejected its
  final reviewed-support mapping with the existing fixed remap error.
- **Correction:** Locate tests with `rg --files`. Keep that merge fixture as a
  fail-closed parity case, comparing its reference/candidate error, rollback,
  stored graph and durable reveal. Do not weaken production remap validation
  or alter synthetic review metadata to manufacture a successful merge.
- **Verification:** Eleven real-SQLite reuse parity slices pass, including
  successful split, nonempty rejection constraints and memory-write failure.
  This harness does not establish successful owner-merge acceptance.
- **Prevention:** Verify reference fixture outcomes before declaring a new
  expected success. Compare the one changed branch against a reference built
  from the same working source, preserving unrelated uncommitted changes.
- **Status:** Tooling and fixture expectation corrected; no production defect
  was attributed to the graph reuse optimization from these failures.
- **Final acceptance:** Parent ran all 63 real-SQLite tests, full mobile Jest
  39 suites / 387 tests and static/root checks. Owner confirmed the optimized
  recheck completes with unchanged journeys/labels. Paired fixed timings show
  the second-pass phase at 0.001 s versus 16.832 s before reuse; retry 35.890 s
  versus 54.068 s. Preserve the one-pair measurement limit and keep rejection
  constraints on the two-pass path. Profiling disabled after capture.

## Rebuild processing profile patch envelope (2026-10-21)

- **Evidence/cause:** The first combined patch omitted its required terminal
  `End Patch` marker. The tool rejected it before writing any file or running
  a check.
- **Correction/prevention:** Resubmitted the exact scoped changes with a complete
  patch envelope; verify patch closure before execution. No source loss or
  runtime incident. Expected regression RED is recorded in the delivery spec.
- **Status:** Resolved: patch applied; 52 real-SQLite tests, full mobile Jest
  39 suites / 386 tests, typecheck/lint, root check and whitespace checks pass.
- **Capture tooling:** One long inline host capture returned exit 1 without
  output; its cause is unknown and no device result can be inferred. PID and
  transport checks passed afterward. Moved the parser into an ignored local
  PowerShell file, retained raw logs only in memory, and successfully returned
  fully paired fixed events for the owner-confirmed completed recheck. Prefer
  inspectable local scripts over long inline capture commands.
- **Reuse-test fixture:** The first post-change branch test seeded a rejection
  against absent support; correct baseline mapping rejected it before the second
  engine pass. Replaced the isolated call-count branch fixture with a graph whose
  support actually matches. Focused test now passes for one unconstrained pass
  and two constrained passes; real SQLite correction parity is independently
  required. Never weaken remap validation to satisfy a malformed fixture.

## Destination computation test cache path (2026-10-21)

- **Evidence/cause:** The first focused Jest invocation selected a cache outside
  the authorized workspace and failed with mkdir `EPERM` before test collection.
  No assertion or production behavior was evaluated.
- **Correction:** Use the existing ignored repository-local `.jest-cache-codex`
  path with the complete absolute path quoted for its space.
- **Prevention:** Resolve cache paths within workspace write roots before running
  Jest; this tooling failure is not valid TDD RED evidence.
- **Status:** Resolved: repository-local cache ran the intended regression RED
  (4,758 cosine calls exceeded the 291-area bound), then GREEN after hoisting.
  Full mobile Jest also completed with 39 suites / 385 tests passing.
- **Verification follow-up:** A repository grouping fixture guessed a wider
  region name for the Paris point; the bundled public dataset resolves it to
  `Paris, France`. Corrected the fixture expectation, preserving the production
  label/dataset. Verify exact bundled labels before authoring golden assertions;
  this setup failure is not a production regression or intended TDD RED.
- **Metro preflight recurrence:** Sandboxed netstat did not show the host Metro
  listener. A new server attempt therefore failed on occupied port 8085 before
  starting. Host inspection identified the existing Travel Life Expo process.
  Use host listener/process/status preflight before starting or replacing Metro;
  do not assume an empty sandbox network inventory means the port is free.
- **Verified follow-up:** Corrected grouping fixture passes in its 50-test
  repository suite; typecheck/lint also pass. Host Metro restart succeeded after
  process identity was checked, and the served resolver/probe were verified.
- **Reviewer tooling recurrence:** Blind reviewer first searched an assumed
  nonexistent test directory, then located the file with `rg --files`. No source
  changed or check ran at the bad path. Prevention: discover actual paths before
  narrowing searches, including during review.
- **Capture-parser correction:** The first safe epoch-event parser assumed
  timestamps start in column one and returned no events despite available
  diagnostic markers. Android logcat prefixes them with whitespace. Accept
  leading whitespace, retain only closed operation/reason/stage/correlation
  fields and timestamps, then pair phases in correlation/occurrence order.
  Corrected capture found the completed retry and fully paired profile events;
  owner independently confirmed completion and unchanged labels. Raw logs stay
  in memory and are never persisted.

## Atlas phase profiling implementation checks (2026-10-21)

- **Evidence/cause:** The profiling workflow read step 2 before step 1; returned
  to step 1 before writing source. The first TDD run imported a nonexistent helper
  and collected zero tests; added its no-op interface and captured two real RED
  assertions before implementation. An edit command invoked the unavailable
  Windows Store Python alias; no repository edit ran. Used the verified bundled
  interpreter instead. A sandbox CIM process read was denied; it supplied no
  process evidence. No private data was accessed by these failures.
- **Correction:** A stage-transition closure initially defeated TypeScript control
  flow narrowing in the durable-read catch. Preserve explicit stage assignments
  and add profiling calls beside them, leaving error classification intact.
- **Prevention:** Follow rendered workflow order; establish an importable TDD
  interface before RED; resolve runtime executables first; use host process
  inspection only when needed. Keep diagnostic stage assignments visible to
  TypeScript and verify both early-return and error branches.
- **Status:** Tooling/typing incidents resolved; owner-operated profiling complete.
- **Verified correction:** Full mobile Jest 39 suites / 383 tests, helper coverage
  100%, real SQLite 51 tests, TypeScript/lint, root check and diff checks pass.
  Review coverage additions also pass. Owner confirmed recheck completion and
  paired fixed events localize destination work to 11.276 s of an 11.478 s durable
  read. This is phase attribution, not evidence of a speed improvement.
- **Review/tooling follow-up:** Reviewer tried a nonexistent root SQLite-script
  path before locating `apps/mobile/scripts/atlas-sqlite.test.cjs`; no check ran
  at the wrong path. A lazy entry-bundle scan omitted probe and recovery module
  bodies; direct module requests verified code presence. Expo rewrites public
  environment references through its virtual environment, so a literal inlining
  regex is not proof the flag is disabled. Require actual fixed profile events
  from the fresh device process before interpreting durations.
- **Phase-split result:** Fresh owner recheck completed. Fixed paired events put
  1.096 s in the unchanged support query and 10.422 s in unchanged destination
  computation. This prevents an unproven SQLite-index change; profile the
  computation substeps before altering evidence or label semantics. One review
  worker was interrupted without a result; replacement review is pending.
- **Verification harness incident:** A first hidden full-Jest launch reused one
  file for stdout and stderr and PowerShell rejected it before the runner began.
  Two corrected hidden launches then exited without a child process or any output
  under this host. The direct full-Jest invocation reached passing suites but the
  host returned at its 30-second limit without a final summary. **Correction:**
  Do not count these as full-suite passes; retain focused Jest, real-SQLite,
  typecheck, lint and root-check evidence. **Prevention:** Use the configured
  interactive runner or an approved host process boundary that returns an exit
  code before claiming a long Windows Jest run passed.
- **Review-worker incident:** Two blind reviewers were interrupted after no
  response. **Correction:** Performed direct diff review and recorded the lack
  of independent findings honestly. **Prevention:** Keep reviewer scope short
  and time-bound; never infer a clean review from a worker that did not report.

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

- **Recurrence (2026-10-21, destination computation):** Sandboxed device preflight
  again failed to start the host ADB daemon before reaching a device. This is an
  external transport failure, not application failure or device validation.
  Retry at the approved host boundary; do not repeat the unchanged sandbox call.
  Host retry found the connected device and restored USB routing; transport is
  available for this run. This is not owner-operated application acceptance.

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

**2026-10-20 recurrence:** The focused manual-journey Jest command stopped before loading tests because its sandbox Temp transform-cache rename returned `EPERM`; zero tests ran. Retry the unchanged focused command through the approved host boundary with a repository-local cache. A package typecheck also exposed an unrelated concurrent uncommitted test in `import-repository.test.ts` that invokes the optional `loadReconciliation` method without narrowing it. Leave that change to its owner and report the complete typecheck as blocked rather than masking it.

**2026-10-20 command recurrence:** The first host full-suite retry supplied an absolute cache path containing spaces without preserving it as one argument; Jest interpreted the trailing path fragment as a test pattern and ran zero tests. Quote the entire `--cacheDirectory` value on PowerShell host retries and accept only the subsequent completed suite result.

**2026-10-20 Atlas-continuity recurrence:** A PowerShell read-only search used Bash brace expansion and stopped before execution; a first continuity SQL patch then failed context verification because the repository query had changed concurrently. Neither failure changed product data. **Correction / verification:** reran the search with explicit Windows paths, reread the precise SQL blocks, and applied narrow patches. The first sandboxed focused Jest run again stopped before collection with the documented transform-cache `EPERM`; the quoted repository-local host retry passed 5 suites / 121 tests. **Prevention:** never use shell brace expansion in PowerShell; inspect exact current SQL before a multi-hunk patch; treat zero-test cache failures as environment-only and rerun on the approved host boundary.

**2026-10-20 Atlas-continuity verification correction:** The later host rerun of the same five suites executed 121 tests but failed one provider assertion: it expected one durable-reveal read even though the provider correctly reads once on initial connected-state publication and once after the correction's required read-back. No product data changed and the durable boundary was not bypassed. **Correction:** wait for and assert the initial publication, then assert the second read caused by the completed correction. **Prevention:** lifecycle tests must count initialization reads separately from explicit read-backs; accept a host suite only after its final summary, not a prior delegated report.

**2026-10-20 Atlas-continuity lint correction:** Mobile lint then found that the reconstruction completion callback captured `refreshDurableReveal` before its `useCallback` declaration, which React Compiler rejects because that earlier callback would retain a stale binding. **Correction:** declare the durable-refresh callback before constructing the reconstruction and maintenance controllers that use it. **Verification:** rerun lint, focused regression, and the complete mobile check after the hook-order change. **Prevention:** when a controller constructor receives a hook callback, declare the callback first and let lint validate hook capture order; TypeScript compilation alone is insufficient.

**2026-10-20 Atlas-continuity duplicate read-back correction:** The first hook-order repair left the controller's optional external-commit callback active. A provider regression then measured three reads: initial connection publication, the callback, and the explicit correction read-back. **Cause:** correction flows already await their authoritative durable read; a controller-side second publication is redundant and can race its gate. **Correction:** remove the controller callback and leave direct owner operations responsible for their one awaited read-back; catch-up retains its own awaited read. **Prevention:** one operation has one publication owner; tests must assert an exact lifecycle read count after adding a cross-layer hook.

**2026-10-20 Atlas-continuity review correction:** Independent review found that V34 initially snapshot every `SUGGESTED` row and the durable predicate let continuity override every later classification. **Correction:** snapshot only the latest completed V29 backfill signature (null path and fixed legacy reason), preserve its run provenance, and allow continuity only while the current row remains `SUGGESTED`; explicit non-primary outcomes stay withheld. The Atlas screen also catches the provider's already-rendered durable-read failure so the tap cannot cause an unhandled rejection, and recovery copy no longer promises an existing Atlas where none was read. **Prevention:** migration review must prove the exact historical marker and current-run boundary; continuity predicates must enumerate the allowed state rather than use an unconditional alternative.

**2026-10-20 owner-reported inert retry:** After reload, the owner saw only `Retry local reveal`; tapping it showed no visible response. Source tracing found that Atlas called `reconstructionController.rebuild()` directly, then discarded its result without the required durable Atlas read-back. A successful rebuild could therefore leave the screen on the previous failed projection. **Correction:** wire the action through `retryJourneyCorrectionProjection`, which awaits rebuild and `refreshDurableReveal` before returning. **Prevention:** every owner-visible Atlas recovery action must use a provider operation that has a durable publication contract; a controller-only rebuild is not a reveal retry.

**2026-10-20 device retry lifecycle failure:** Filtered Android JS log recorded `Uncaught (in promise) Error: Private record is unavailable` immediately after the owner tapped Retry following a reload. The retry handler used the React lifecycle snapshot before its asynchronous refresh had completed, then the screen discarded the rejected promise. **Correction:** retry now reads the durable lifecycle directly, resumes the reconstruction controller when connected, otherwise publishes a restricted recovery state; the screen catches any remaining rejection. **Prevention:** a retry available immediately after reload must obtain lifecycle authority from the durable repository, not an initial React snapshot. The initial ADB log command also mistakenly used PowerShell's read-only `$PID`; subsequent diagnostics use a task-specific variable name.

**2026-10-20 retry rebuild failure:** After the lifecycle fix, the owner tapped Recheck and the button returned to Retry, proving the rebuild path started but failed. The generic controller state intentionally did not expose the native error, and current filtered logs had no retry-specific code. **Correction:** provider now emits only one fixed retry category (`SCHEMA`, `NATIVE_HANDLE`, `DATABASE_BUSY`, `TRANSACTION`, `OWNER_REVIEW`, `ACCESS`, or `UNKNOWN`) when that rebuild returns failed; raw exception text stays private. Focused retry coverage passed 47 tests, complete mobile Jest passed 343 tests, TypeScript, lint, root check, and diff check passed. **Next action:** reload the diagnostic bundle, owner taps Retry once, then inspect only the fixed code before selecting a repair.

**2026-10-20 ADB/Metro preflight recurrence:** The follow-up device preflight could neither query the Metro status endpoint (`socket ... forbidden by its access permissions`) nor start/connect the host ADB daemon (`failed to check server version`). No app code, Android private record, or device input changed. **Status:** Open external environment blocker; this does not alter the established rebuild-failure evidence. **Prevention:** a host-side connectivity failure must be recorded separately from Atlas behavior; do not claim the owner retry was observed or fixed until an authorized device/Metro session can reload and provide the coarse diagnostic.

**2026-10-20 retry lifecycle containment correction:** The owner subsequently tapped Retry, but filtered app logs contained only the earlier reload-time `Private record is unavailable` errors and no fixed retry diagnostic. Source review found the retry's own `getPrivateRecordLifecycle()` call could reject before it reached either the rebuild branch or its diagnostic. **Correction:** contain that lifecycle read, publish the existing restricted recovery state, and emit the fixed `ACCESS` category; the classifier now recognizes the unavailable message without recording it or private details. **Verification:** added a regression proving no rebuild starts and only `ACCESS` is emitted; focused Atlas/provider tests passed 48 tests and the full mobile suite passed 37 suites / 344 tests, with TypeScript, lint, root check, and diff check passing. **Prevention:** every external lifecycle read at an owner-triggered recovery boundary must have an explicit rejected-read path and a regression that asserts both no unsafe work and the coarse diagnostic.

**2026-10-20 retry fixture type correction:** The first lifecycle-rejection regression used `graph: null` in `reconcileQueued`, violating its non-null reconstruction contract; mobile typecheck failed before an app build. **Correction:** use the minimal valid graph in that fixture. **Verification:** focused tests, TypeScript, lint, and the full 344-test suite passed after the fix. **Prevention:** typed test doubles must preserve non-null production return contracts even when the exercised branch does not consume that field.

**2026-10-20 retry bundle/gesture observability gap:** After the owner reloaded and tapped, the filtered process log still had neither the existing failure category nor any new retry entry; it retained only earlier reload-time lifecycle errors. This does not prove whether the active bundle reached the retry handler. **Correction:** add a fixed `START` marker at the first executable line of the provider retry operation. **Verification:** the lifecycle regression asserts `START` followed by `ACCESS`; focused tests passed 48 tests and the full mobile suite passed 37 suites / 344 tests with TypeScript, lint, root check, and diff check passing. **Next action:** reload the current bundle, tap Retry once, and inspect `START` plus its terminal category before changing runtime behavior. **Prevention:** a device-only recovery diagnosis needs both an entry marker and a terminal marker; do not infer a tap or code-push outcome from stale process logs.

**2026-10-20 Android reload transport repair:** The owner could not reload after the latest diagnostic bundle. Preflight found Android device `9cb47ed9` connected and ADB reverse intact, but no Metro listener on 8085. The first local restart bound Metro only to IPv6 `::1`, so `127.0.0.1:8085/status` was refused and the Android localhost reverse could not receive the bundle. A same-port IPv4 bridge cannot coexist with that Windows listener and was not retained. **Correction:** stop only the Metro process started in this session (verified by its exact command line) and restart it on 8085 with LAN binding; it now listens on `::`/IPv4 and returns `packager-status:running`, with `tcp:8085 tcp:8085` reverse confirmed. **Prevention:** before asking an Android owner to reload, verify both the device reverse mapping and an IPv4 localhost status request; an IPv6-only Metro listener is not sufficient.

**2026-10-20 Atlas recovery-flow wording mismatch:** The owner correctly read `Recheck local journey history` followed by `Retry local reveal` as two required steps. In fact the latter is only the failed terminal state of the same recheck operation. **Correction:** use the single owner-facing action label `Recheck local journey history` for both sparse and failed states; the recovery state/error remains distinct internally and the coarse diagnostics continue to identify failure. **Verification:** focused Atlas reveal tests passed 32 tests, with mobile TypeScript and lint passing. **Prevention:** recovery labels must name the owner's task, not internal phase terminology; do not create a second apparent step after a failed attempt.

**2026-10-20 shared lifecycle handle regression:** The owner reported metadata import could no longer start while Atlas reconstruction/reveal also failed after reload. Android system app-ops still reported `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO` allowed, so system media permission was not the blocker. Source tracing showed both flows must first read the same private-record lifecycle through the import repository; unlike reconstruction's prior Android reload repair, that repository still requested Expo SQLite's cached native handle. **Likely cause:** the cached handle belongs to the previous React runtime and fails lifecycle reads after a reload, which makes import/reveal report unavailable despite granted permission. **Correction:** open the import repository with `useNewConnection: true`, while retaining the process-wide transaction serializer and busy timeout. This does not migrate, reset, or delete the private record. **Verification:** add a repository assertion for the fresh connection; import/lifecycle/Atlas focused suites passed 88 tests; full mobile Jest passed 37 suites / 344 tests, and TypeScript, lint, root check, and diff check pass. **Next action:** owner reloads and confirms the metadata-import action and one Atlas recheck on the existing local record. **Prevention:** every repository which gates a private lifecycle read after Android React reload must use a fresh native SQLite connection, not only reconstruction.

**2026-10-20 import/recheck write contention:** After the fresh-handle reload, the retry marker reached `START` but ended in the fixed `DATABASE_BUSY` category. This proves the lifecycle path ran; metadata import and Atlas recheck then contended for SQLite writes. **Cause:** the owner can tap recheck while an owner-initiated import, including its automatic completed-import rebuild, is still active; Atlas waited for background maintenance but not the foreground import. **Correction:** PhotoAccessController now exposes an import-idle promise covering both broad and selected metadata imports, including the completed-import rebuild. Atlas retry awaits it and the maintenance queue before rebuilding. **Verification:** add a regression that holds a metadata page and proves the idle promise does not settle early; focused coordination suites passed 85 tests and full mobile Jest passed 37 suites / 345 tests with TypeScript, lint, root check, and diff check passing. **Prevention:** every competing owner-triggered writer must participate in the same pre-rebuild wait boundary; a busy Boolean alone is not a completion contract.

**2026-10-20 import-idle type correction:** The first import-idle implementation passed `this.current.scope` into an async closure after its type narrowing expired, so TypeScript rejected potentially unavailable/revoked scopes. **Correction:** capture the validated `full`/`limited` scope before creating the async task. **Verification:** focused suites, TypeScript, lint, and the full 345-test run pass. **Prevention:** capture narrowed mutable state in an immutable local before an async closure; do not rely on a property narrowing across awaits.

**2026-10-20 owner-reported inert metadata import:** After the contention repair, the owner tapped metadata import but saw no response and filtered logs contained no import operation marker. Source review found `startImport()` only used `finally`: an error from its completed-import rebuild could reject through a fire-and-forget screen handler with no owner-visible state. **Correction:** log fixed `START` and terminal categories only, catch the complete operation, and publish existing safe recovery copy in the Import screen rather than an unhandled rejection. **Verification:** a regression makes the completed-import rebuild throw `database is locked` and asserts the fixed recovery state plus only `START`/`DATABASE_BUSY`; focused suites passed 86 tests and full mobile Jest passed 37 suites / 346 tests with TypeScript, lint, root check, and diff check passing. **Next action:** reload, tap metadata import once, then inspect its fixed terminal marker. **Prevention:** every fire-and-forget owner action must catch its whole asynchronous transaction, including post-success callbacks, and leave a safe status rather than relying on the UI caller to catch it.

**2026-10-20 retry regression-fixture correction:** The first new Retry local reveal test triggered reconstruction after private lifecycle became connected but before its separate permission snapshot had reached `full`. Atlas correctly rendered the restricted state, so the expected retry button was absent. **Correction:** wait for both lifecycle and permission readiness before inducing the recoverable reconstruction failure. **Prevention:** provider screen tests must establish every independently refreshed readiness state before asserting an owner-facing branch.

**2026-10-20 retry fixture lifecycle recurrence:** Permission readiness alone was not enough: the provider's initial deleted-state effect can still clear/suspend the controller after a test observes connected state. **Correction:** explicitly resume the controller in the fixture before inducing the failed rebuild, matching the connected-state effect that has already completed on the owner's failed screen. **Prevention:** test controller lifecycle readiness, not only rendered permission/lifecycle values, before invoking a controller directly.

**2026-10-20 retry screen-fixture scope correction:** Rendering the full Atlas screen in the provider contract test still selected its independently initialized restricted projection, obscuring the targeted recovery contract. **Correction:** exercise the provider method directly after a simulated failure; Atlas component tests already verify the `onRetry` button invocation and TypeScript verifies the screen wiring. **Prevention:** test the provider's durable-publication guarantee at its own boundary; do not make it depend on unrelated screen initialization branches.

**2026-10-20 patch-attempt incident:** One multi-file `apply_patch` was rejected before writing because a hunk boundary was malformed. **Correction:** split the independent test/doc patches and apply each against its exact current context. **Prevention:** when a patch updates multiple files, verify that every file boundary starts a new patch section rather than continuing the preceding hunk.

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

## M4.2 planning glob lookup (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 build workflow; prior-story discovery.
- **Status:** Corrected before planning.
- **Symptom/evidence:** A PowerShell `rg` invocation passed `spec-m4-*.md` as a literal path, and ripgrep returned Windows error 123 before reading any files.
- **Cause:** The wildcard was supplied as a path argument instead of using file enumeration or an `rg --glob` filter.
- **Correction / verification:** Use `rg --files _bmad-output/implementation-artifacts` to enumerate actual M4 specs, then read exact literal paths.
- **Prevention:** On Windows, enumerate the search root before opening grouped files; do not pass wildcard patterns as literal path operands.

## M4.2 planning test-root lookup (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 build workflow; repository test discovery.
- **Status:** Corrected before code inspection.
- **Symptom/evidence:** A read-only reconnaissance search included nonexistent `apps/mobile/__tests__` and `apps/mobile/test` roots, producing path errors without reading tests.
- **Cause:** The test layout was guessed instead of enumerated.
- **Correction / verification:** Resolve test files under `apps/mobile/src/components/__tests__` with `rg --files` before targeted reads.
- **Prevention:** Never include presumed test roots in a multi-root search; enumerate the mobile source tree first.

## M4.2 planning PowerShell discovery syntax (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 build workflow; UI reconnaissance.
- **Status:** Corrected before source inspection.
- **Symptom/evidence:** Two read-only searches failed before opening source: an `apps/mobile/src/reconstruction/*.ts` wildcard was treated as a literal Windows path, and a Bash-style brace-expanded path list was invalid in PowerShell.
- **Cause:** POSIX shell shorthand was used in PowerShell path arguments.
- **Correction / verification:** Enumerate candidate files with `rg --files`, then pass explicit literal paths to the follow-up search.
- **Prevention:** Use PowerShell arrays or `rg --glob` for grouped paths; never rely on Bash brace expansion or literal wildcard path operands.

## M4.2 workflow frontmatter patch (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 build workflow; spec state transition.
- **Status:** Corrected before dispatch.
- **Symptom/evidence:** An `apply_patch` request attempted two separate updates to the same specification file and was rejected as an invalid patch before modifying files.
- **Cause:** The status and baseline-frontmatter updates were unnecessarily split.
- **Correction / verification:** Apply both frontmatter changes in one verified hunk, then reread the specification before implementation dispatch.
- **Prevention:** Combine same-file state transitions into one patch operation; use separate operations only for distinct files.

## M4.2 baseline revision capture (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 build workflow; post-implementation diff audit.
- **Status:** Corrected before audit.
- **Symptom/evidence:** The workflow specification recorded an unverified expanded SHA for baseline `4bf25ee`; `git diff --cached --binary <baseline>` failed with `bad object` and left the required temporary diff empty.
- **Cause:** A short revision was expanded by assumption instead of obtaining its canonical identifier from Git.
- **Correction / verification:** Read `git rev-parse 4bf25ee`, store its exact result in the spec, then regenerate and read the staged diff.
- **Prevention:** Whenever a workflow requires a full revision, use `git rev-parse` directly; never manually expand an abbreviated hash.

## M4.2 manual-entry audit gaps (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 post-implementation diff audit; manual route and form.
- **Status:** Open; correction dispatched before review.
- **Symptom/evidence:** The initial implementation routed back to `/history` without saving/restoring the current Atlas exploration context, generated a new command key per submit rather than retaining it for a retry, and exposed raw latitude/longitude fields where the approved manual fallback requires an owner-chosen coarse map point.
- **Cause:** Focused tests asserted a successful form save but did not exercise the required context return, retry identity, or human-usable coarse-point interaction.
- **Correction / next action:** Preserve the Atlas context before entering manual creation and restore it after cancel/success; retain one draft-scoped command key across retry; use a constrained coarse-point picker/selection flow that stores only coarsened coordinates.
- **Prevention:** Audit every matrix row against the rendered route and form, not only repository/provider success cases; require tests for navigation context, retry idempotency, and the owner-facing fallback interaction.
- **Recurrence (2026-10-19, final acceptance audit):** The repaired flow still showed Add a journey manually while the private record was restricted, even though the command cannot save there; it also lacked an explicit owner-entered count beside the inferred counts. **Cause:** the affordance condition was broadened without preserving the record-availability boundary, and the union projection was not traced through the Atlas aggregate copy. **Correction / verification:** limit the entry point to ready, sparse, and failed projections; add a separately labelled owner-entered count that never changes inferred totals, with Atlas regressions for both. **Prevention:** For every unioned owner record, audit the action availability and each user-visible aggregate separately from recovery/engine metrics.

## M4.2 focused Jest sandbox cache EPERM (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 manual-entry focused Jest verification.
- **Status:** Open environment blocker; host retry required.
- **Symptom/evidence:** `npm --prefix apps/mobile test -- --runInBand manual-journey.test.tsx` stopped before executing tests because Jest could not atomically rename its transform-cache map file in the sandbox temporary directory (`EPERM`).
- **Cause:** Sandboxed Windows temporary-cache permissions, not a test or application assertion failure.
- **Correction / next action:** Rerun the same focused command through approved host execution, retaining the repository-local test command and reporting its actual result.
- **Prevention:** Treat Jest transform-cache `EPERM` as an environment failure; do not call an unexecuted suite passing or retry the identical sandbox path.
- **Recurrence (2026-10-19, audit-fix focused run):** The same sandbox cache rename failure again stopped all three focused suites before test execution. TypeScript passed independently. Use the approved host boundary directly for all subsequent Jest verification in this task; do not interpret this as an assertion failure.

## M4.2 manual-entry test render contract (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 focused UI regression.
- **Status:** Corrected; verification pending rerun.
- **Symptom/evidence:** The first host-focused run reached the test but failed before assertions because this repository's test renderer returns an awaitable render result and the new test used it synchronously, leaving query helpers undefined.
- **Cause:** The new suite did not follow the existing async-render convention.
- **Correction / next action:** Await `render(...)` in both cases, then rerun the focused suite.
- **Prevention:** Copy the established async render shape from neighboring mobile component tests before using screen queries.

## M4.2 repository test mock-factory scope (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 manual repository regressions.
- **Status:** Corrected and rerun.
- **Symptom/evidence:** The initial new SQLite regression suite failed before execution because its `jest.mock` factory captured a variable not prefixed `mock`, which Jest disallows as potentially uninitialized.
- **Cause:** The test did not follow Jest factory scope naming rules.
- **Correction / verification:** Renamed the factory-captured doubles to `mock*`; the manual repository, form, and provider suites passed 18 tests.
- **Prevention:** In a hoisted Jest factory, only capture names prefixed `mock` or create the double inside the factory.

## M4.2 PowerShell test-file glob lookup (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 implementation review; test discovery.
- **Status:** Corrected before reading test results.
- **Symptom/evidence:** A read-only `rg` invocation passed `apps/mobile/src/components/__tests__/*.tsx` and `*.ts` as literal Windows path operands, and returned error 123 without reading those test files.
- **Cause:** POSIX-style globs were used as path arguments in PowerShell.
- **Correction / verification:** Use `rg --files apps/mobile/src/components/__tests__` to enumerate the test files, then pass explicit paths or `--glob` filters.
- **Prevention:** On Windows, do not pass shell globs as literal path operands; enumerate first or use ripgrep's own glob option.

## M4.2 coarse-picker label regression (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 audit-fix manual entry.
- **Status:** Corrected before full verification.
- **Symptom/evidence:** The first focused host run showed that choosing a broad map area overwrote the owner's typed destination label and context with the area's generic copy.
- **Cause:** The fallback picker object was incorrectly reused as both the coarse anchor and the owner-entered destination fields.
- **Correction / verification:** Keep the typed label/context while taking only latitude/longitude from the selected coarse area; rerun the focused manual-entry suite.
- **Prevention:** Tests for fallback location selection must assert both deliberately coarsened coordinates and preservation of the owner-entered place claim.

## M4.2 provider create test act warning (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 focused provider verification.
- **Status:** Corrected and verified in the focused suite.
- **Symptom/evidence:** The focused host run passed all assertions but printed React's `act(...)` warning when the manual-create test refreshed the durable Atlas projection.
- **Cause:** The test invoked the state-changing provider command outside the renderer's async `act` boundary.
- **Correction / verification:** Wrap the command and result capture in `act`; the focused manual suites reran with 65 tests passing and no warnings. The full suite still has a separate pre-existing `journey-edit.test.tsx` renderer-environment warning, which this manual-flow test does not trigger.
- **Prevention:** Every provider command that can refresh React state must be awaited inside `act`, even when assertions use a captured context value.

## M4.2 review-state redundant patch (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 review workflow transition.
- **Status:** Corrected before review launch.
- **Symptom/evidence:** An `apply_patch` request to change the specification status from `in-progress` to `in-review` failed because the implementing agent had already correctly made that transition.
- **Cause:** The current frontmatter was not reread immediately before repeating the workflow transition.
- **Correction / verification:** Read the specification frontmatter and confirmed `status: 'in-review'` with `review_loop_iteration: 0`; no content change was needed.
- **Prevention:** Before repeating an idempotent workflow-state patch after delegated work, read the exact frontmatter block first.

## M4.2 independent review findings (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 independent review; owner-entered journey boundaries.
- **Status:** Open; product clarification required before re-derivation.
- **Symptom/evidence:** Three required review lenses found that local-history deletion omits `manual_journey`, owner-entered details expose generic correction Edit, Home-base selection accepts owner-entered coarse anchors as though they were observed areas, and multiple overlaps route Edit to the first result with no owner selection. A late overlap can also appear between review and persistence without a specified durable-review protocol.
- **Cause:** The initial story contract established separation from evidence but did not specify deletion, manual-edit policy, multi-overlap target choice, or a stale-overlap write protocol; implementation then reused inferred-journey affordances at those seams.
- **Correction / next action:** Preserve the verified review triage in the M4.2 spec; obtain the owner’s manual-edit/multiple-overlap decision, then re-derive the affected flow and deletion/observed-area safeguards with regressions.
- **Prevention:** For a new durable owner-record type, explicitly trace every existing consumer (deletion, correction, Home-base, and aggregate UI) before calling the story implementation-ready.

## M4.2 audit staging scope (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 baseline-diff audit.
- **Status:** Corrected before the M4.2 whitespace result was used.
- **Symptom/evidence:** Staging the entire worktree for the required all-files diff also staged an unrelated untracked planning review containing pre-existing trailing whitespace.
- **Cause:** The audit command was broader than the M4.2 file set in a shared worktree.
- **Correction / verification:** Restore only that file’s index entry, preserving its untracked working-tree content; rerun the staged whitespace gate on the M4.2 set.
- **Prevention:** In a shared worktree, use an explicit story file list for Git staging even when an audit requires untracked coverage.

## M4.2 final review coverage and fallback defects (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 final independent review.
- **Status:** Open; correction dispatched before acceptance.
- **Symptom/evidence:** Final review showed that the re-derived form used only three hard-coded anchors instead of local place search plus a no-result coarse fallback; stale-overlap recovery could not reopen review; and regression tests did not execute the repository transaction, owner-entered-only Replay, actual Home-base publication, or Atlas-context restoration.
- **Cause:** The re-derivation focused on review-time safety seams but did not trace the accepted offline-search fallback through the rendered form and provider lifecycle.
- **Correction / next action:** Reuse the existing local place index, expose coarse fallback only on no-result state, make stale reviews retryable, and add executable boundary regressions before full verification.
- **Prevention:** For a frozen UX fallback, assert both the normal path and the fallback activation condition in rendered tests; never count a mocked provider call as coverage for a database or publication boundary.

## M4.2 diff staging sandbox index lock (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 final diff audit.
- **Status:** Open environment limitation; a read-only diff was still generated for tracked files.
- **Symptom/evidence:** `git add -N` could not create `.git/index.lock` in the sandbox (`Permission denied`) before the audit diff, so the requested intent-to-add staging of untracked M4.2 files did not occur.
- **Cause:** The sandbox disallows the Git index write for this checkout; application source was not changed by the failed command.
- **Correction / next action:** Audit tracked changes from the baseline and inspect untracked files directly; use an approved host Git boundary if an index-backed all-files diff is required.
- **Prevention:** Distinguish an index-lock sandbox refusal from a content or whitespace failure, and do not claim untracked files were staged when the lock could not be created.

## Architect performance review UV cache inspection failure (2026-10-19)

- **Date / task / area:** 2026-10-19; performance/responsiveness architecture review; BMAD customization/config resolver.
- **Status:** Open sandbox environment limitation; manual configuration fallback used.
- **Symptom/evidence:** Both `uv run _bmad/scripts/resolve_customization.py` and `resolve_config.py` stopped before invoking their project scripts because the sandbox could not persist `uv`'s interpreter-cache message pack under the Windows package cache (`Access is denied`).
- **Cause:** Sandbox cache permissions; this did not read or change application source.
- **Correction / verification:** Read the architect skill customization and project config directly. The resolved identity is Winston, System Architect, with English communication; no persistent facts or activation steps were configured.
- **Prevention:** For this known `uv` cache boundary, use an approved host execution boundary if script execution is required; otherwise read the small TOML inputs directly and state the fallback. Do not repeatedly retry the same sandbox cache path.

## M4.2 rerun repository-contract regressions (2026-10-19)

- **Date / task / area:** 2026-10-19; M4.2 implementation rerun; manual projection and UI command identity.
- **Status:** Corrected; complete-suite rerun pending.
- **Symptom/evidence:** The first lint rejected a render-time command-key generator, and the first host suite found manual projection reads shifted existing SQL-mock ordering and stale schema-v32 assertions.
- **Cause:** A retry key was created during render instead of in the owner action, and the additive repository query was inserted before established read contracts without updating migration expectations.
- **Correction / verification:** Generate and retain the command key only from the review action; move the manual projection query after the committed journey read, fail closed on incomplete rows, and update migration assertions to v33. TypeScript, lint, and the affected repository suites pass (54 tests).
- **Prevention:** Treat command identity as event state, never render state; when adding an additive repository query, run all existing repository suites and update explicit schema-version assertions together.
- **Recurrence:** A documentation patch that combined the spec result and project-state update was rejected because the project-state anchor had changed. No file changed; the corrected patch used the exact current tail. **Prevention strengthened:** Before a multi-file documentation patch, reread every target anchor and retry only the minimal verified hunk.
- **Further recurrence:** The first focused-test typecheck inferred zero-argument Jest mocks, so indexed mock-call assertions failed static typing despite passing at runtime. The mocks now declare their `ManualJourneyInput` argument tuple; the focused suites, TypeScript, and lint pass. **Prevention strengthened:** Type every Jest mock whose call arguments are inspected before relying on `mock.calls`.

## Private-record recovery focused Jest sandbox cache failure (2026-10-19)

- **Date / task / area:** 2026-10-19; private-record manual-entry recovery verification.
- **Status:** Verified with approved host execution; sandbox limitation remains.
- **Symptom/evidence:** The required focused Jest command stopped before loading all five selected suites when Jest could not atomically rename its transform-cache map under the sandbox Windows package Temp directory (`EPERM`). Zero tests executed.
- **Cause:** Known sandbox cache permission limitation; no application assertion or source behavior was evaluated by this run.
- **Correction:** Re-ran the exact focused command in the approved host execution context.
- **Verification:** The first host rerun executed 44 tests: 43 passed and one existing lifecycle snapshot-count assertion failed because the new visible pending snapshots correctly add one notification for each lifecycle operation. The assertion now expects the seven observable transitions. A subsequent preflight regression revealed that the existing Atlas CTA was hidden in the restricted state, so the owner could not reach the required recovery path; the CTA now hands its context to the preflight in that state. Review then found stale-refresh, cancellation, direct-route, and Settings-feedback gaps; focused coverage now passes 7 suites / 80 tests and the full mobile suite passes 37 suites / 320 tests with TypeScript and lint. Expo Doctor remains 20/21 due to the existing nine Expo SDK patch-version recommendations.
- **Prevention:** Treat pre-discovery Jest cache `EPERM` as an environment failure and rerun unchanged outside the sandbox rather than modifying product code or interpreting it as a test result.

## Private-record recovery diff-audit index lock (2026-10-19)

- **Date / task / area:** 2026-10-19; private-record manual-entry recovery audit.
- **Status:** Open sandbox environment limitation; no source or index content was changed.
- **Symptom/evidence:** The required explicit-file `git add` stopped before staging because Git could not create `.git/index.lock` in the sandbox (`Permission denied`); the temporary unified diff file was consequently not created.
- **Cause:** The shared checkout's Git index is not writable from this sandbox boundary, rather than a source or whitespace failure.
- **Correction / next action:** Record the incident, then use an approved host Git boundary to stage only the known task files and generate/read the baseline diff; preserve the unrelated untracked performance review outside that file list.
- **Prevention:** When an audit needs the index, request the approved host boundary after one sandbox refusal and never broaden staging to every untracked file in a shared worktree.

## Private-record recovery isolated-review diff path (2026-10-19)

- **Date / task / area:** 2026-10-19; private-record manual-entry recovery review orchestration.
- **Status:** Corrected before review triage; no product files changed by this failure.
- **Symptom/evidence:** All three required review workers reported that the system-temp diff path generated by the parent sandbox was absent or unreadable in their isolated sandbox sessions.
- **Cause:** The temporary directory is sandbox-session scoped even though the repository workspace is shared.
- **Correction / verification:** Regenerate the identical baseline diff under a project-owned temporary review path that every worker can read, then rerun every review layer before evaluating findings.
- **Prevention:** For cross-agent review, keep ephemeral diff artifacts in a verified shared workspace location rather than the parent session's system temp directory.

## Private-record recovery full-check session interruption (2026-10-19)

- **Date / task / area:** 2026-10-19; private-record manual-entry recovery verification.
- **Status:** Open verification-tooling interruption; no result was accepted from either partial full-check run.
- **Symptom/evidence:** Two host full-check sessions printed the Jest startup line, then their continuation handles disappeared (`exec cell 23 not found` and `exec cell 25 not found`) before any suite result, type check, lint, Doctor, or root check outcome was available. A first documentation patch for this recurrence also failed before changing a file because it omitted the list-marker context.
- **Cause:** Unknown execution-session interruption; it is not an application test failure or passing result.
- **Correction / next action:** Run static checks separately and use a direct Windows process invocation for the complete Jest suite; use only completed results.
- **Prevention:** When a long-running verification handle vanishes, mark the result indeterminate and change the process-invocation shape rather than inferring success from startup output. Prepare documentation patches from exact marked lines.

## Atlas speed verification cache and test corrections (2026-10-19)

- **Date / task / area:** 2026-10-19; private Atlas reconstruction speed; host verification.
- **Status:** Corrected and verified; device timing remains open.
- **Symptom/evidence:** The first focused Jest attempt stopped before tests with a sandbox Temp cache-rename `EPERM`. A relative repository-cache argument then resolved under Jest's mobile working directory and created an unintended `apps/mobile/apps/mobile/.jest-cache-codex`. The first full mobile check ran all 325 Jest tests successfully but TypeScript rejected newly added numeric `reduce` callbacks over mixed SQL values. A focused batching assertion later failed because its guessed fewer-than-10 write count was 19 with the required payload cap.
- **Cause:** Sandbox cache permissions; an incorrectly relative cache path; missing numeric TypeScript annotations; and a test threshold that ignored character-bounded batching.
- **Correction / verification:** Use a repository-local cache with an absolute path, verify the generated cache's exact absolute path and remove only that directory, add numeric generics/annotations, and assert a tenfold-or-better statement reduction instead of an arbitrary count. Focused tests pass (112), full Jest passes (37 suites / 325 tests), and mobile TypeScript and lint pass.
- **Prevention:** Resolve cache paths against the actual test process working directory before use; type arithmetic over mixed SQL values explicitly; set batching test bounds from the algorithm's documented parameter/payload limits.
- **Further recurrence:** A new queued-action test used a shared `onCatchUp` mock without resetting it, so a later absolute call-count assertion saw two calls rather than one. Active, sparse-waiting, and ready-waiting cases now use separate spies; their call-count assertions measure each scenario independently. **Prevention strengthened:** Isolate mocks per case before asserting exact action counts.

## Atlas speed Expo Doctor network lookup (2026-10-19)

- **Date / task / area:** 2026-10-19; private Atlas reconstruction speed; mobile full check.
- **Status:** Open external verification limitation.
- **Symptom/evidence:** `npm --prefix apps/mobile run doctor` exited while resolving `registry.npmjs.org` with `ENOTFOUND`; the combined mobile `check` therefore cannot be reported as passing.
- **Cause:** Registry DNS/network access was unavailable in this environment, not an observed application failure.
- **Correction / next action:** Jest, TypeScript, and lint were run separately and completed; rerun Doctor when registry access returns. Do not infer Doctor success from the earlier 20/21 result.
- **Prevention:** Report network-blocked dependency diagnostics separately from completed local gates, without repeatedly retrying an unchanged DNS failure.
- **Recurrence (2026-10-20):** A single next-day retry again failed at `getaddrinfo ENOTFOUND registry.npmjs.org`, before Doctor could inspect the project. The limitation remains open; no further retry was made without changed network evidence.

## Atlas speed independent-review edge cases (2026-10-20)

- **Date / task / area:** 2026-10-20; private Atlas reconstruction speed; batching and waiting-state review.
- **Status:** Corrected in code and host verification; physical device behavior remains unverified.
- **Symptom/evidence:** Independent review found that link rows were accumulated in memory despite bounded write calls, a single oversized row could bypass the payload cap, and mock tests checked statement counts without validating inserted values. The waiting banner also treated unresolved correction remaps as catch-up-able queue rows because `pendingCount` sums both sources, and competing rebuild/retry actions could leave a real queue unacknowledged.
- **Cause:** The first implementation optimized bridge call count but did not bound accumulator memory or trace all aggregate queue-status consumers through the owner action.
- **Correction / verification:** The link/disposition writer now streams bounded batches and rejects a single oversized tuple before the native bridge, preserving transaction rollback. Tests compare inserted tuples with the graph, including order and values. Reconciliation exposes separate aggregate queue/remap counts; a remap requires review, while queued failure catches up through the queue-consuming path. Affected suites passed (97 tests); the full host mobile suite passed 37 suites / 332 tests, TypeScript, lint and `git diff --check` passed. Device confirmation is still pending.
- **Prevention:** For a new batch writer, test memory/bridge limits and complete inserted values; for an aggregate status, trace the underlying SQL counts and each visible action before assigning owner-facing copy.
- **Verification recurrence:** A root `--no-cache` Jest run still attempted a sandbox Temp transform-cache rename and failed with `EPERM` before any test executed. The exact suite was rerun through the approved host boundary and passed 37 suites / 332 tests. Do not treat `--no-cache` as a reliable workaround for this sandbox limitation.

## M4.2 reconstruction entry skipped the shared schema upgrade (2026-10-20)

- **Date / task / area:** 2026-10-20; Android Manual Journey entry; shared private SQLite schema.
- **Status:** Code corrected and regression active; device confirmation pending.
- **Symptom/evidence:** The owner-provided Android error reported `NativeDatabase.prepareAsync` rejecting a query for missing `date_start`. The Manual Journey query reads `manual_journey.date_start`, introduced by v33.
- **Cause:** `createNativeReconstructionRepository` opened `travel-life-import-v1.db` directly. Schema migration existed only in `createNativeImportRepository`, so a v32 device reaching Atlas or Manual Journey through reconstruction could query v33 columns before migration.
- **Correction / verification:** Extracted the migration gate for reuse and invoke it before manual-overlap/create/detail reads and durable Atlas projection reads. Focused manual-migration/reconciliation tests pass (42); the full mobile suite passes (37 suites / 332 tests). Typecheck is separately blocked by an unrelated uncommitted optional-method test; lint passes.
- **Prevention:** Every independent SQLite repository entry point must either own the shared schema gate or call it before accessing a versioned table. Add a direct-open regression whenever a migration-backed table gains a new consumer.

## M4.2 Android SQLite cached-handle failure (2026-10-20)

- **Date / task / area:** 2026-10-20; Android Manual Journey overlap review; Expo SQLite runtime connection.
- **Status:** Code corrected and host regression active; device confirmation pending.
- **Symptom/evidence:** After the v33 `date_start` migration repair, the owner reported `NativeDatabase.prepareAsync` rejecting with a bare Java `NullPointerException` on the next Manual Journey overlap review. This is a different error from the missing-column failure. A filtered ADB log read returned no matching native stack frames, so no private database content was accessed.
- **Cause:** The exact Android/SDK 57 failure signature matches Expo SQLite's active cached-handle issue after Android recreates the React runtime while the process survives. Travel Life independently opened the same database for import and reconstruction, allowing reconstruction to reuse a released cached native handle. This is an evidence-backed inference; physical reproduction remains pending.
- **Correction / verification:** Reconstruction now opens `travel-life-import-v1.db` with `useNewConnection: true`, while the existing shared transaction gate keeps import/reconstruction writers serialized. The new regression was RED against the old one-argument open, then focused Manual Journey/reconciliation tests passed (43). The first bounded batch passed (18 suites / 279 tests). The second batch passed 18 of 19 suites / 54 of 55 tests; the sole failure is an unrelated uncommitted `reconstruction-controller.test.ts` assertion for a diagnostic logging change whose production implementation is absent.
- **Prevention:** When separate long-lived repositories require the same Expo SQLite file, use a fresh native connection for the secondary repository and serialize explicit write transactions. Never classify a bare native-handle NPE as an SQL/schema error without inspecting the signature and native version.

## Atlas catch-up device failure and diagnostic handoff (2026-10-20)

- **Date / task / area:** 2026-10-20; private Atlas speed acceptance; Android catch-up and development transport.
- **Status:** Open device failure; cause unknown. No full-device speed improvement is claimed.
- **Symptom/evidence:** The owner tapped `Catch up locally` once on the current Atlas bundle. Device UI changed from waiting to updating, then returned to waiting with a failed-reveal message within roughly 20 seconds. App-process logs exposed no underlying exception. The local private record was not cleared, exported, or changed by diagnostics.
- **Correction in progress:** A controller regression first failed because no failure category was logged, then passed after a fixed-code-only diagnostic (`SCHEMA`, `NATIVE_HANDLE`, `DATABASE_BUSY`, `TRANSACTION`, `ROW_LIMIT`, `OWNER_REVIEW`, `ACCESS`, `CONSTRAINT`, or `UNKNOWN`) was added. The raw exception is never logged. Full mobile Jest passed 37 suites / 334 tests; mobile TypeScript and lint and root `npm run check` passed. A physical retry and root-cause fix still require a connected phone and the refreshed bundle.
- **Diagnostic/transport incidents:** ADB's sandbox daemon failed and approved-host ADB was used. A first `rg` query included a nonexistent `apps/mobile/app` path; later searches used actual paths. The phone has no `sqlite3` executable; `python` and `py` were unavailable on PATH, so the bundled Python path was located. An attempted aggregate-only in-memory query was rejected because it would transfer the entire private database to the host; do not route around that rejection. The earlier Metro process handle disappeared. Two sandbox-started Metro attempts showed a listener on 8085 but timed out at the host `/status` endpoint, even after a bounded cache-clear restart. The same exact checkout/port started through approved host networking returned `packager-status:running`; this was a host-network isolation problem, not a proven app bundle error. ADB then listed no device, so the development client still cannot load through its USB mapping.
- **Agent test incident:** The first diagnostic test used an excess-property object literal and failed TypeScript after its intended RED Jest result. Binding the repository first corrected the type error; TypeScript and the full test suite then passed. This RED test was subsequently made GREEN, resolving the concurrent M4.2 entry's interim note about the missing implementation.
- **Diagnostic log hygiene:** A raw Expo startup-log tail printed an `EXPO_PUBLIC` map-provider key into the local tool output. It is client-visible configuration, but printing it was unnecessary. Subsequent log inspection selected only event type and timestamp after parsing; future diagnostics should filter fields before displaying any startup log, and must never echo environment values.
- **Next action/prevention:** Reconnect/authorize the phone, verify ADB and the exact host-reachable Metro listener before reloading, capture only the fixed diagnostic code from the retry, then investigate the classified path. Keep app-private evidence on-device; do not infer a cause from a generic failed UI or a disappearing dev-server session. For controller test doubles, use a separately typed/bound repository when the constructor intentionally exposes only the minimal rebuild interface. A local port listener alone is insufficient readiness evidence when the server was started inside a restricted network sandbox.
- **Device retry recurrence:** After reconnect, ADB listed the authorized phone and the host Metro `/status` returned running. A cold launch landed in Expo Dev Launcher, where the green current-checkout server was visible. `adb shell input tap` again failed with this device's `INJECT_EVENTS` security restriction before interacting with the app. The owner was asked to tap the visible 8085 server card; automated input injection must not be treated as a viable acceptance method on this phone.
- **Catch-up recurrence:** The owner loaded the fresh Android bundle, then tapped catch-up once. The fixed-only log reported `OWNER_REVIEW`; UI returned from updating to a failed state with queued changes still waiting. The initial code grouped protected history corrections and journey-remap failures into one diagnostic category, so its exact branch remained unknown. Two focused RED cases established the ambiguity; the classifier now emits distinct fixed `HISTORY_REVIEW` and `JOURNEY_REMAP` codes, with GREEN focused tests. A single owner-operated retry on that refreshed module is pending. Do not bypass either owner-protection gate merely to obtain a speed measurement.
- **Cold-restart discrimination (2026-10-20):** After repeated owner-operated attempts produced only `DATABASE_BUSY LEASE_WRITE`, an approved Android force-stop and relaunch of the same private record, without clearing app data, changed the fixed result to `JOURNEY_REMAP REBUILD`. The committed Atlas remained browsable. This proves a fresh process can open the database and reach reconstruction; it does not prove an automatic recovery for the stale in-process native SQLite writer. The observed remap is an intended owner-protection gate, not a reason to alter or discard a reviewed correction. **Next action:** keep the busy-lock diagnosis open as a dev-runtime/process-lifecycle issue until a safe recovery mechanism has evidence; guide the owner to review the remap separately if they choose. Do not retry the map action merely to seek a timing sample.
- **Second device retry:** The refreshed module was delivered and the owner tapped once more. This time the fixed log reported `DATABASE_BUSY`; UI returned to failed/waiting. The exact SQLite stage and competing writer are unknown. `reconcileQueued` begins a write lease before its own catch block; foreground automatic maintenance and an OS-invoked task can also write this database, but concurrency is not yet proven as the cause. Do not call the owner-review issue resolved because a later attempt hit a different lock failure. The attempted Expo `r` reload failed because this process session had closed stdin; an explicit development-client URL caused a fresh one-module Android bundle instead. The owner is checking the current maintenance status without changing its setting.
- **Stage-diagnostic correction (2026-10-20):** The owner confirmed automatic maintenance had completed, then an additional owner-operated catch-up again reported `DATABASE_BUSY`; this rules out treating a currently running foreground maintenance check as the established cause, but does not identify the competing writer. `reconcileQueued` now wraps only fixed internal stages (`LEASE`, `QUEUE_READ`, `REBUILD`, `OUTCOME_READ`, `OUTCOME_SAVE`, `LEASE_RELEASE`) and the controller logs the fixed error code plus stage only. The raw native error stays in memory for safe classification and is never logged. Lease acquisition is now inside the reconciliation catch boundary, and a failure persisting best-effort outcome state cannot mask the original stage.
- **Verification:** New RED/GREEN regressions cover a locked lease becoming `DATABASE_BUSY LEASE` with no private error detail in logs. Focused repository/controller tests passed 51 tests; the full mobile suite passed 37 suites / 338 tests, TypeScript and lint passed, and root `npm run check` passed. A first test patch was rejected before writing because it used a stale controller import anchor; the retry used the exact current header. The first lint run exposed an unused test import and a runtime constant used only as a type; both were removed before the clean lint rerun. One complete-suite process returned only a partial log without a summary, so it was treated as indeterminate and rerun to completion. A combined documentation patch was also rejected before writing because its project-state anchor was stale; the updates were then applied with exact independent anchors.
- **Next action:** Reload this exact bundle on the connected Android development client and have the owner tap `Catch up locally` once. Read only the fixed `(code, stage)` pair. Do not add retries, relax the lease, or alter private reconstruction data until that pair identifies a real contention path.
- **Review limitation:** The required BMAD Blind Hunter was launched after the implementation but its worker hit the account usage limit before returning findings. That layer is indeterminate, not a passed review. A direct diff/whitespace audit and the executable checks remain completed; rerun the independent review when worker capacity is available before treating the diagnostic refinement as review-complete.
- **LEASE-stage correction (2026-10-20):** The device emitted `DATABASE_BUSY LEASE`, proving contention occurs before reconstruction begins. The concrete foreground race is AppState activation: it enqueues automatic metadata maintenance, while the visible Atlas action previously requested the reconstruction lease immediately. Atlas catch-up now waits for the already queued same-runtime maintenance transition before requesting its own lease. This does not relax the SQLite lease, retry blindly, change a journey rule, or treat an OS-background writer as synchronized; a future `DATABASE_BUSY LEASE` after this coordination would remain evidence of an external/native writer.
- **Verification:** A new maintenance-controller regression was RED because the coordination boundary did not exist, then GREEN after `whenIdle()` was added. Focused maintenance/provider/controller/repository tests passed 67 tests. Mobile TypeScript and lint passed; an initial full-suite output stopped before its summary and was rerun to a complete 37 suites / 339 tests passing result. Root `npm run check` passed. The pre-reload independent-review worker remains unavailable as documented above. The owner must still validate the refreshed device bundle with one catch-up tap.
- **Reload preflight correction:** The first reload preflight incorrectly compared `Invoke-WebRequest.Content` directly with a string; on this host it is a byte array, so a healthy Metro endpoint was misclassified as down and no ADB launch action ran. The corrected preflight decodes the bytes before comparison, then delivered the same verified 8085 development URL. **Prevention:** Normalize HTTP response content to text before branching on a status sentinel; a type-mismatched equality check is not a transport diagnosis.
- **Cross-runtime lease correction (2026-10-20):** The refreshed bundle still emitted `DATABASE_BUSY LEASE` after same-runtime maintenance coordination, confirming an external/OS writer remains possible. The reconstruction repository now reads the durable `maintenance_lease` before starting its own immediate transaction. A fresh maintenance lease returns the existing safe `already running` result, so Atlas preserves the last committed state and does not create an outcome write or a second writer. This protects the demonstrated background-maintenance path without assuming it explains every native lock. A regression was RED (the existing run reached reconstruction) then exposed that moving lease acquisition inside the broader catch had changed the prior no-write deferral behavior; the repository now explicitly rethrows a fresh-lease result without saving an error outcome. **Verification:** focused reconciliation/controller tests passed 52 tests; TypeScript and lint passed; full mobile Jest passed 37 suites / 340 tests; root `npm run check` passed. The owner-device retry remains the only proof that this exact OS contention is handled.
- **Precise-stage follow-up:** The maintenance-lease change still yielded a delayed `DATABASE_BUSY` result, so a generic `LEASE` label was not sufficient to decide the next SQLite change. Diagnostics now distinguish opening the reconstruction connection, reading the maintenance lease, and starting the reconciliation write transaction (`LEASE_OPEN`, `MAINTENANCE_LEASE_READ`, `LEASE_WRITE`). RED/GREEN focused tests verify a `BEGIN IMMEDIATE` failure is reported as `LEASE_WRITE`, without emitting the native message. TypeScript, lint, full mobile Jest (37 suites / 340 tests), and root `npm run check` passed. The next device result must identify this finer fixed stage before any native-connection or transaction-mechanism change. A combined documentation patch was rejected before writing because the project-state anchor was stale; the replacement used the current document tail.
- **Post-lock lease recheck (2026-10-20):** The device reported `DATABASE_BUSY LEASE_WRITE`: it can read no active maintenance owner, then lose the immediate-transaction race to a task that starts in the gap. On that specific write-lock failure, reconstruction now performs one read-only maintenance-lease recheck. If a fresh maintenance lease appeared, it returns the existing safe no-write deferral result; otherwise it preserves `DATABASE_BUSY LEASE_WRITE`. It does not retry the transaction, mask a non-maintenance writer, or relax either lease. RED/GREEN regression covers the initial no-lease read followed by busy write and a fresh second lease read. Focused tests passed 53 tests; TypeScript and lint passed; full mobile Jest passed 37 suites / 341 tests; root `npm run check` passed. Device confirmation is required.

## Worktree inventory sandbox boundary (2026-10-20)

- **Date / task / area:** 2026-10-20; all-worktree release-source inventory.
- **Status:** Resolved with repository-level Git references; no product source was changed.
- **Symptom/evidence:** A read-only inventory attempted `git status` inside managed worktrees under `C:\\Users\\vothi\\.codex\\worktrees` and received `Permission denied` for each external checkout.
- **Cause:** The active sandbox can read the primary checkout's Git metadata but cannot enter those worktree directories.
- **Correction / verification:** Queried each registered `HEAD` and branch from the primary repository's worktree metadata and compared its commit range against `main`; this identified the branch-only commits without accessing external checkout files.
- **Prevention:** For release inventory, start from `git worktree list --porcelain` and repository-level `git log main..REF`; request an approved host boundary only when uncommitted-file details from an external worktree are necessary.
- **Recurrence (2026-10-21, cleanup planning):** Direct status reads again hit the external-checkout permission boundary. A single approved host read then verified all four secondary worktrees clean, resolving the unknown uncommitted state without mutations. **Stronger prevention:** When the external boundary is already known, go directly from repository metadata to the approved read-only host inventory if file status is needed; do not repeat sandbox directory probes. Clean status still requires a separate unique-commit and ignored-file audit before retirement.

## PowerShell glob passed literally to ripgrep (2026-10-21)

- **Date / task / area:** 2026-10-21; consolidation workflow artifact status scan.
- **Status:** Corrected before any repository mutation.
- **Symptom/evidence:** `rg` received `spec-*.md` as a literal Windows path and returned error 123 while inspecting implementation-artifact frontmatter.
- **Cause:** PowerShell did not expand the glob for this command form.
- **Correction / verification:** Use `Get-ChildItem -Filter 'spec-*.md'` and pass explicit discovered paths to reads/searches.
- **Prevention:** On Windows, enumerate file globs before passing them to a command that does not provide its own glob expansion.

## Consolidation spec frontmatter patch used stale context (2026-10-21)

- **Date / task / area:** 2026-10-21; worktree-consolidation workflow state transition.
- **Status:** Corrected before implementation dispatch.
- **Symptom/evidence:** An `apply_patch` seeking the expected `ready-for-dev` frontmatter line was rejected even though the live spec had already changed during the preceding workflow transition.
- **Cause:** The multi-hunk patch used a stale assumed file ordering rather than the exact current frontmatter.
- **Correction / verification:** Re-read the live frontmatter and prepare a minimal patch anchored to its observed lines.
- **Prevention:** Before every workflow-state write, re-read the exact frontmatter and patch only the current status/baseline context.
- **Recurrence:** A final `in-review` to `done` patch was rejected because the completed implementation worker had already set `done` and committed it. **Correction:** Re-read the live frontmatter; no state change was required. **Prevention strengthened:** After an interrupted/delegated workflow returns, inspect the current committed frontmatter before applying any terminal-state transition.

## Consolidation review-worker quota exhaustion (2026-10-21)

- **Date / task / area:** 2026-10-21; independent review of the worktree-consolidation candidate.
- **Status:** External review capacity unavailable; candidate review evidence is limited accordingly.
- **Symptom/evidence:** Blind-hunter, edge-case, and verification-gap workers each stopped before returning findings because the account reported a usage limit.
- **Cause:** External model usage quota; no candidate source failure was reported.
- **Correction / verification:** Ran the complete automated suite and a direct full-diff audit for cache/private paths, direct production console calls, and whitespace. This does not substitute for independent review.
- **Prevention:** Start review layers before consuming extensive implementation capacity when possible; if quota prevents their return, preserve the exact candidate diff and state the weaker evidence plainly.

## Atlas visibility device preflight ADB recurrence (2026-10-20)

- **Date / task / area:** 2026-10-20; Atlas/journey visibility diagnosis; Android device preflight.
- **Status:** Transport restored; owner acceptance pending.
- **Symptom/evidence:** The known absolute platform-tools executable failed before listing devices: `adb.exe` could not read the daemon response and could not start/connect to the server on TCP 5037. No application command, database query, app-data mutation, or private evidence transfer ran.
- **Cause:** Unknown host ADB daemon state; this is separate from Atlas reconstruction, qualification, or UI behavior.
- **Recovery / next action:** Approved-host read-only preflight now lists authorized Android device `9cb47ed9` and Metro `8085/status` returns `packager-status:running`. The next step is one owner-operated Atlas catch-up; do not inject input or infer the UI outcome from this transport result.

## Performance work crossed import and reconstruction safety boundaries (2026-10-20)

- **Date / task / area:** 2026-10-20; Atlas/import/general responsiveness work; shared SQLite and reconstruction delivery scope.
- **Status:** Open product regression investigation. The owner reports metadata import and Atlas/journey reconstruction no longer complete. Private source data was not read or exported during this review.
- **Evidence:** The uncommitted change set spans 23 files and 1,210 insertions, including schema v34, a `legacy_atlas_continuity` migration, changed journey-publication qualification, new SQLite connection behavior, reconciliation lease logic, and metadata-import error handling. The owner-operated Android result reached `JOURNEY_REMAP REBUILD`. Focused synthetic import/reconciliation/controller suites pass 95 tests, but they do not exercise the owner's existing correction and database state. `PhotoAccessController.startImport()` now catches a completed-import/rebuild failure, logs only a fixed code, and replaces it with a generic retry message.
- **Cause:** A request to improve responsiveness was combined with unrelated V1.1 continuity/migration and correction-remapping work. The resulting reconstruction path intentionally refuses to publish when a saved correction cannot map to the rebuilt graph, while the import path can conceal the actual boundary failure from the owner. The exact on-device import failure category is not yet observed, so its direct cause remains unknown.
- **Correction / next action:** Freeze additional performance and schema changes. First reproduce each owner action on the current bundle with safe fixed-code diagnostics; then restore a narrow, independently verified import/reconstruction baseline or implement a separately approved, correction-safe migration. Do not clear private history, delete corrections, weaken remap protection, or claim the synthetic tests prove the private-record flow.
- **Prevention:** Performance tickets must declare immutable functional seams (import completion, schema/version behavior, durable projection, correction remapping) and reject unrelated migration/recognition changes. Test the actual pre-existing-state upgrade path and one owner-visible import/rebuild action before delivery; generic error copy is not evidence or sufficient recovery UX.
- **Recovery (2026-10-20):** Removed the unapproved v34 legacy-continuity migration and its reveal qualification bypass. A database already marked v34 is now treated as forward-compatible/read-only by the v33 schema gate, so it is not downgraded or forced through a startup migration; the additive abandoned table is ignored. Restored the import repository's normal cached connection while retaining the reconstruction repository's targeted fresh connection for the Android released-handle repair. Completed metadata import is now reported separately from a failed protected Atlas rebuild: the metadata remains complete and the existing Atlas is retained. Focused recovery tests (111) plus typecheck, lint, and whitespace pass. The first full-suite recovery run failed only because one manual-journey test still asserted the removed v34 schema marker; the assertion was corrected before the final rerun. Device proof remains required: one owner-operated metadata import and one Atlas open/rebuild, with no private data export.
- **Owner retry recurrence (2026-10-20):** The owner tapped Import and received no visible acknowledgement or progress. Source tracing found `PhotoAccessController.startImport()` first awaited lifecycle/SQLite reads before `ImportCoordinator` published `running`, so a delayed database read made the tap look inert. **Correction:** publish `Starting local metadata import…` synchronously, disable the duplicate start control, and show a preparing state before the first await; selected import receives equivalent acknowledgement. A focused delayed-lifecycle regression, owner flow, provider tests (42), typecheck, lint, and whitespace pass. Reload the new bundle before asking the owner to retry; an old bundle cannot validate this correction.
- **Paused-terminal correction (2026-10-20):** The owner’s next retry rendered the safe generic failure. Investigation found a second controller defect: `ImportCoordinator` converts lifecycle/database-read failures into its durable `paused` coverage state and resolves normally, while `PhotoAccessController` previously left the optimistic `Starting…` message in place. A first regression incorrectly expected that internal pause to reject and failed; the failure established the actual coordinator contract. **Correction:** after either full or selected import resolves without `complete`, the controller emits only fixed `PAUSED` or `BLOCKED` diagnostic codes and replaces the optimistic acknowledgement with a safe retry/access message. The regression now simulates a connected first read followed by a locked lifecycle read and confirms no native/private error text reaches the owner. Focused controller/owner/provider checks pass (43 tests). Typecheck, lint, whitespace, and a refreshed Android owner retry remain required.
- **ADB diagnostic recurrence (2026-10-20):** A read-only attempt to capture the fixed Android import code could not start/connect to the local ADB daemon on TCP 5037 (`could not read ok from ADB Server`). No device command, app-data mutation, log extraction, database access, or private evidence transfer occurred. **Cause:** unknown host ADB daemon state, not an application result. **Next action:** use the owner-visible fixed terminal message after reloading the bundle, or restore an authorized ADB daemon before reading only the fixed diagnostic code.
- **Import `DATABASE_BUSY` owner recurrence (2026-10-20):** The refreshed owner retry reported `database busy`. This is evidence of an SQLite writer race, not a metadata, permission, or reconstruction-data failure. App activation independently queues `maintenanceController.catchUp()`, while the Import control previously began its lifecycle and page writes immediately. **Correction:** both full and selected owner imports now wait behind the already queued in-runtime maintenance transition before the first import repository read/write, while retaining the immediate `Starting…` acknowledgement and the existing 30-second native busy timeout for a separate/native writer. No lease is weakened, no database is cleared, and no retry loop is added. A new regression proves Import does not read a metadata page until the queued maintenance promise settles. The first run exposed a stale test-harness assumption that a delayed lifecycle mock is installed synchronously; it was corrected by yielding one event turn while preserving the immediate acknowledgement assertion. Focused maintenance/import/provider tests pass (46), plus typecheck, lint, and whitespace. Full-suite and Android owner confirmation remain required.
- **Verification update:** The complete mobile Jest command exited successfully after the correction, as did root `npm run check` and `git diff --check`. The suite output includes the existing React test-environment `act(...)` warning in `journey-edit.test.tsx`; it is non-failing and unrelated to the import writer ordering. Android owner confirmation remains the only unresolved proof for this specific contention path.
- **Repeated owner `DATABASE_BUSY` (2026-10-20):** The owner still observed `database busy` after the maintenance-ordering correction, so that known in-runtime writer is not sufficient to explain the live lock. Inspection found an error-recovery defect: `ImportCoordinator.runPages()` caught a failed page commit, then immediately attempted a second `commitPage(paused, [])` write to persist a pause marker. A busy first write therefore issued another write against the same locked SQLite database and could escape as the generic busy failure. **Correction:** track the last durably committed checkpoint; on a busy commit, make no second write, discard the uncommitted page from UI accounting, expose a safe paused/retry state, and retain the prior durable checkpoint. Non-busy read failures still attempt to persist a paused marker; if that write fails, they also remain safely paused without propagating. RED/GREEN regression proves one busy page write causes exactly one repository write, commits no source, and resolves to a safe paused state. Focused coordinator/controller/provider tests pass (63). The underlying external/native writer remains open until an owner retry after a fully stopped/relaunched app provides new evidence.
- **Atlas catch-up failure after completed metadata import (2026-10-20):** The owner confirmed metadata import now runs, then reported that `Catch up locally` built failed. That is a separate reconstruction/reconciliation operation; the last committed Atlas remains the intended browse surface. A read-only ADB attempt again could not start/connect the host daemon on TCP 5037, so no fixed diagnostic code was captured and no device/private record was accessed. The previous Atlas failure UI was generic despite the controller having fixed, privacy-safe diagnostic categories/stages. **Correction:** catch-up now presents fixed owner guidance for busy storage, pending journey-remap review, pending history-review, schema recovery, or access; native error detail remains excluded. Focused reconstruction/Atlas/provider tests pass (60), plus typecheck, lint, and whitespace. Reloading the updated bundle and reporting this fixed guidance is required before changing reconstruction behavior.
- **Silent Catch-up acknowledgement recurrence (2026-10-20):** The owner reloaded and tapped `Catch up locally`, but received no visible response or message. The provider intentionally awaited `maintenanceController.whenIdle()` before calling reconstruction, so the Atlas controller had not yet entered `running`; any queued maintenance operation made the button appear inert. **Correction:** `ReconstructionController.acknowledgeQueuedMaintenanceWait()` now immediately publishes a `running` notice that an existing local update is finishing while retaining the last completed Atlas. It does not acquire a reconstruction lease or claim a rebuild has started; after maintenance settles, normal reconciliation reports its fixed terminal outcome. A regression verifies the acknowledgement does not call rebuild. Focused reconstruction/provider/Atlas/maintenance suites pass (63), with typecheck, lint, and whitespace. The refreshed owner test must first show the waiting notice, then either complete or display the safe fixed failure guidance.
- **Projection swallowed controller guidance (2026-10-20):** Follow-up source tracing found the prior acknowledgement and fixed failure text were still discarded by `projectReveal`: it received only reconstruction status and substituted generic processing/failure copy. **Correction:** `RevealInput` now carries the fixed controller message, and the Atlas/replay projections pass it through only for running/error reconstruction states. A UI regression proves the queued-maintenance waiting text renders. This change does not permit a native error, source ID, SQL fragment, or private coordinate to cross the projection boundary. Focused Atlas/controller/provider tests pass (62), plus typecheck, lint, and whitespace. A new-bundle owner tap must show the message before further database diagnosis.
- **Post-rebuild durable Atlas read masked catch-up cause (2026-10-20):** The owner now sees `Updating your Atlas`, then the generic `Your local Atlas could not be read`. This proves the action reaches the catch-up path. `catchUpHistory()` previously ran `refreshDurableReveal()` after every reconciliation result; that follow-up read could overwrite a detailed reconciliation failure with a generic Atlas-read message. **Correction:** skip the durable refresh when reconciliation already has a non-complete state; on a completed reconciliation whose durable read fails, log only a fixed `Atlas durable read` category and show fixed owner guidance without throwing or replacing private data. Reconciliation-status refresh is isolated so its read failure also cannot mask the Atlas result. Focused provider/controller/Atlas tests pass (62), plus typecheck, lint, and whitespace. The precise on-device category still requires one refreshed-bundle retry; no reconstruction rule, correction, or history data has been changed.
- **Unreachable remap-review recurrence (2026-10-20):** The owner reported that Atlas contains no journey to open after being instructed to review a withheld correction through Timeline Edit. This exposed a recovery-UI contradiction: `reviewRequired` is derived from pending-remap count, while the correction review route requires a displayed, committed journey ID. When the last committed Atlas has no journeys, the owner has no route to the protected correction. **Status:** Open. Do not ask the owner to discard data, add a manual journey, or retry reconstruction until a direct owner-controlled pending-correction review surface exists. **Prevention:** Every recovery notice must be tested in both non-empty and empty last-committed Atlas states, and every owner-required gate must expose an actionable route independent of the failed projection.
- **Correction-remap product-contract correction (2026-10-21):** The owner clarified that a journey correction requiring review must not stop Atlas/Timeline reconstruction. The prior fail-closed implementation protected against an implicit remap but used rollback as its mechanism, incorrectly turning one withheld correction into a global reveal outage. **Required correction:** commit the evidence-derived graph, retain the unresolved correction untouched, mark every current journey related to its reviewed support as needing review, and keep owner review/edit reachable from that label. Structural/invalid correction semantics remain separately protected until explicitly designed. **Prevention:** model correction remap as a journey-level review state, not a global reconstruction status; acceptance must include an initially empty prior Atlas.

## Runtime diagnostic logging implementation checks (2026-10-20)

- **Date / task / area:** 2026-10-20; privacy-safe mobile runtime diagnostics.
- **Symptom/evidence:** The first shared diagnostic typecheck rejected `catchUpFailureCode` because it was left typed as a broad `string`, which could not prove that a serialized reason code stayed within the closed event union. The same focused Jest run could not collect tests because the sandbox transform cache failed its atomic rename with `EPERM`; zero tests ran.
- **Cause:** The migration reused a pre-existing broad helper signature, and the known sandbox Jest cache boundary applies before test execution.
- **Correction / verification:** Narrow the helper to `AppDiagnosticReasonCode`; rerun TypeScript and lint after the correction. Rerun the unchanged Jest command through the approved host boundary with a quoted repository-local cache before interpreting test behavior.
- **Prevention:** Keep diagnostic helper return types closed at the boundary; treat a transform-cache failure before collection as an environment incident, not a passing or failing application test.
- **Focused-host correction:** The first host run collected 54 tests but retained two assertions for the retired positional console labels. The implementation emitted the expected fixed event objects; the stale assertions failed. Update those tests to assert operation, reason, null stage, retryability, and durable outcome, then rerun the same focused suites. Existing `act(...)` console warnings in `journey-edit` remain the separately recorded renderer limitation and are not diagnostic payloads.

## Runtime diagnostic boundary verification correction (2026-10-21)

- **Date / task / area:** 2026-10-21; privacy-safe mobile runtime diagnostics and owner import/Atlas recovery.
- **Status:** Code and automated verification complete; Android owner acceptance remains pending.
- **Symptom/evidence:** A broad documentation patch assumed an earlier project-state block and was rejected before any file changed. The live source had already moved to the structured diagnostic boundary, while the retained project-state wording still described positional markers.
- **Cause:** Concurrent work changed the documentation between inspection and patch preparation.
- **Correction / verification:** Re-read the exact live targets, made only this minimal update, and verified the sole production console call is the diagnostics sink. Full mobile Jest passed 38 suites / 356 tests; mobile TypeScript, lint, root `npm run check`, and `git diff --check` passed. The event regression asserts the fixed shape and redacts a private sentinel.
- **Prevention:** Before a multi-file runtime-diagnostics patch, reread each target and scan production source for direct console calls. Treat a rejected no-op patch as an incident, not evidence that the assumed source state still exists.
- **Continuation (2026-10-21):** The delegated implementation worker exhausted its usage quota before it could report a handoff. The parent inspected the live worktree rather than assuming no work existed; it found an incomplete migration, added fixed diagnostics for startup reconciliation/durable-read and maintenance-controller catch paths, and added redaction regressions. Journey Edit's focused suite also still emitted a React `act(...)` warning despite passing assertions; its shared motion lookup is now deliberately unresolved in that suite because motion behavior is not under test. Importing `jest` from `@jest/globals` while making that test deterministic then broke TypeScript's mock inference, although its runtime Jest assertion passed. **Correction:** restore the configured global Jest symbols and retain only the React Native import. Focused Journey Edit, full mobile Jest (38 suites / 357 tests), TypeScript, lint, root `npm run check`, and `git diff --check` now pass. **Prevention:** After an interrupted delegation, inspect the diff and resume only verified remaining work; run TypeScript immediately after changing a test framework import, because a passing Jest runtime suite alone does not validate test types.

## Nonblocking correction-remap implementation checks (2026-10-21)

- **Date / task / area:** 2026-10-21; final-graph journey-correction remap and Atlas review label.
- **Symptom/evidence:** An initial multi-file patch used an outdated `JourneyPreviewSheet` signature and was rejected without changes. The first typecheck then rejected an `accessibilityLabel` passed to the shared `Body` primitive, which does not expose React Native accessibility props.
- **Cause:** Concurrent source changes made the assumed component signature stale, and the primitive interface was not checked before adding the accessible label.
- **Correction / verification:** Re-read the live component, applied the smallest valid label change, then removed the unsupported prop. Focused reconciliation, Atlas, and correction tests passed before the typecheck correction; typecheck is rerun after it.
- **Prevention:** Re-read exact component signatures before a cross-file patch, and inspect shared UI primitive props before adding native accessibility attributes.
- **Regression-test correction:** The first label assertion searched for an isolated native `Text` node, but Timeline nests the status alongside the period and location. It failed despite the rendered tree visibly containing the label. The assertion now checks the rendered tree for the compact text before exercising the existing Edit path. **Prevention:** When testing nested React Native text, assert the rendered composition rather than assuming child-text flattening behavior.
- **Diff-audit tooling recurrence:** The first BMAD diff audit attempted `git add -N` in order to include untracked files and was denied creating `.git/index.lock`. No index, source, private data, or commit changed; the review diff was regenerated without staging and stored as a workspace artifact for reviewers. A later documentation patch was rejected because an implementation worker had already checked off the same tasks; again, no file changed. **Prevention:** Review a dirty shared worktree with a read-only `git diff BASE -- paths` artifact, and re-read live documentation immediately before writing status/checklist updates.

## Android development bundle unavailable after Metro stopped (2026-10-21)

- **Date / task / area:** 2026-10-21; Android development startup; Metro transport.
- **Status:** Transport restored; owner reload acceptance pending.
- **Symptom/evidence:** The owner reported that the app could not load. Read-only preflight found no listener on the configured Android Metro port `8085`. A first sandbox restart listened only on IPv6 and the host status request timed out, so it was not treated as a valid recovery.
- **Cause:** The prior Metro process had stopped. The sandbox listener was additionally unreachable from the host/device transport boundary; this is not evidence of a JavaScript or private-database failure.
- **Correction / verification:** Stopped only the newly created sandbox Metro process, started Metro from the host on `8085` with LAN mode, and verified `http://127.0.0.1:8085/status` returns `packager-status:running`. The authorized Android device `9cb47ed9` is connected and its `tcp:8085` USB reverse mapping has been restored. No app data, database, import state, or correction was changed.
- **Prevention / next action:** A Metro listener alone is insufficient: verify the IPv4 status endpoint and device reverse mapping before asking for an Android reload. The owner must now reload the development client and report whether the Welcome/Atlas screen renders; investigate bundle/runtime failures only if this verified transport still fails.

## Atlas `DATABASE_BUSY` after verified reload (2026-10-21)

- **Date / task / area:** 2026-10-21; Android Atlas catch-up; native SQLite lifecycle.
- **Status:** Process-lifecycle recovery applied; one owner catch-up result pending.
- **Symptom/evidence:** After the verified current bundle loaded, the owner reported `local storage is busy while Atlas updates`. Existing same-runtime maintenance/import coordination and durable maintenance-lease checks do not prove that a stale native SQLite writer has released after a development reload.
- **Cause:** The precise competing writer remains unknown. Prior device evidence established that a clean Android process can move past `DATABASE_BUSY LEASE_WRITE`; therefore this result is treated as a stale in-process native-handle/lifecycle recurrence, not as grounds to clear local data or weaken reconstruction protection.
- **Correction / verification:** Force-stopped and relaunched only package `com.anonymous.travellife` on the connected device. This changes no local storage, import rows, correction, or Atlas record. The next catch-up must be a single owner action on this fresh process; its outcome determines whether a remaining writer still exists.
- **Prevention:** Do not loop Atlas retries against a live busy process. Maintain in-runtime serialization, preserve fixed-stage diagnostics, and use a clean-process discrimination step before modifying schema, correction, or reconstruction behavior.

## Reviewable journey correction still blocked Atlas at an intermediate map (2026-10-21)

- **Date / task / area:** 2026-10-21; Atlas reconstruction; journey-correction remap.
- **Status:** Corrected and awaiting one owner Atlas rebuild.
- **Symptom/evidence:** After the fresh app process, the owner received `A saved journey correction needs review before waiting local changes can rebuild`. This contradicted the required product flow: reviewable corrections must label the rebuilt journeys rather than block Atlas publication.
- **Cause:** The nonblocking implementation handled ambiguity only when mapping the final continuity graph. Earlier baseline and confirmed-graph mapping still called the fail-closed mapper directly, so an ambiguous `confirm`, `claim`, or `place` correction threw before the final nonblocking path was reached.
- **Correction / verification:** Baseline and confirmed mapping now use the same per-correction pending-review path as the final graph. `confirm`, `claim`, and `place` ambiguities are retained as pending candidates and the committed journeys are labeled `Needs review`; `reject`, `split`, `merge`, and `remove-visit` remain fail-closed because they alter grouping/structure. Added regressions for ambiguous confirmation pending and structural removal protection. Focused reconciliation/controller tests passed 59 tests; mobile TypeScript, lint, and root `npm run check` pass.
- **Prevention:** Test the entire reconstruction sequence, not only the final mapper: every intermediate correction mapping must uphold the owner-visible nonblocking contract for reviewable journey corrections.

## Direct Atlas rebuild skipped the local schema gate (2026-10-21)

- **Date / task / area:** 2026-10-21; Android Atlas catch-up; local schema lifecycle.
- **Status:** Corrected and awaiting one owner catch-up.
- **Symptom/evidence:** After the nonblocking-correction bundle loaded, the owner saw `Local Atlas storage needs a safe schema recovery`. The Atlas durable-read path already gated schema, but the queued catch-up path can enter `reconcileQueued → rebuild` before that read.
- **Cause:** `rebuild()` opened its immediate write transaction without `ensureNativeImportSchema`, so an older retained local record could reach versioned correction/projection tables before its additive schema migration had run.
- **Correction / verification:** Direct rebuild now calls `ensureNativeImportSchema` before beginning its own transaction; caller-owned correction transactions are intentionally excluded so a migration is never attempted inside them. Added a regression proving the gate runs before `BEGIN IMMEDIATE TRANSACTION`. Focused reconciliation/controller tests passed 60 tests; mobile TypeScript, lint, and root `npm run check` pass.
- **Prevention:** Every independent native writer that references versioned local tables must gate schema before its first transaction. A read-path gate is not coverage for a separate catch-up writer.

## Queued Atlas reconciliation read versioned leases before its schema gate (2026-10-21)

- **Date / task / area:** 2026-10-21; Android Atlas catch-up; local schema lifecycle.
- **Status:** Corrected and awaiting one owner catch-up.
- **Symptom/evidence:** The owner repeated the same fixed schema-recovery message after the direct-rebuild gate was added. Fixed-only diagnostics did not expose a fresh Atlas event, but source ordering showed `reconcileQueued` acquires its maintenance/reconciliation lease before it delegates to `rebuild`.
- **Cause:** The first correction placed the gate in `rebuild`, which is too late for an older retained schema: `reconcileQueued` can fail while reading the versioned lease tables before it invokes rebuild.
- **Correction / verification:** `reconcileQueued` now ensures the additive import schema immediately after opening its native connection and before any lease read/write; the later direct-rebuild gate remains for other direct writers. Added a regression asserting the queued schema gate precedes the first lease transaction. Focused reconciliation/controller tests passed 61 tests; mobile TypeScript, lint, and root `npm run check` pass.
- **Prevention:** For every writer path, trace from its public entry through its first versioned query, not only to its eventual rebuild function. A downstream schema gate cannot repair an upstream versioned read.
- **Owner-reported recurrence / party audit (2026-10-21):** The owner again reports the schema-recovery message and challenges scope isolation during performance work. Reopen runtime acceptance: the latest installed bundle, failing stage, and missing schema object are not established by this report. Both schema gates exist in current source; their presence and prior call-order tests do not establish successful migration of the retained device database. The fixed `SCHEMA` classifier covers both missing tables and missing columns and does not establish corruption or data loss. Current tracked WIP spans 31 files across several delivery records; do not attribute all of it to the performance request. That request explicitly preserves graph/correction rules. **Status:** Open; source corrections remain present, device recovery unverified. **Next action / stronger prevention:** Establish bundle identity and fixed operation/stage diagnostics, trace the failing public entry through migration and its first versioned query, and validate retained-schema upgrades using synthetic real-SQLite cases before another proposed repair or owner retry. Preserve unrelated WIP and private data; isolate the recovery patch from performance and correction changes. No app, device, or schema changes were made during this audit.

## Durable Atlas read failure remained unlocalized after rebuild completion (2026-10-21)

- **Status:** Resolved for the confirmed empty-manual-layout failure; owner accepted the repaired Android flow. The malformed layout's original creation cause remains unknown. Delivery record: `_bmad-output/implementation-artifacts/spec-atlas-schema-recovery.md`.
- **Evidence:** Read-only fixed device diagnostics show `ATLAS_REBUILD COMPLETE` followed by `ATLAS_REVEAL_RETRY SCHEMA`, with a separate `ATLAS_DURABLE_READ SCHEMA`. These read events used `stage: null`; earlier queued-writer gate tests did not reproduce this read path. Source v33 and an abandoned v34 continuity proposal differ, but current queries do not reference the removed continuity table. That mismatch alone is not the device cause.
- **Cause:** Device schema/query mismatch remains unknown. A real SQLite audit executed 33 migrations and prepared 136 repository statements without missing-object errors. Eleven full-repository synthetic SQLite tests also pass for healthy retained shapes, rebuild/read, correction/manual preservation, and rollback. Do not convert those passes into a device recovery claim.
- **Correction in progress:** Add fixed durable-read stages and preserve only the stage/category at the existing diagnostic boundary. No raw native message, SQL, private rows, or schema dump leaves the app. No speculative schema bump or shape repair.
- **Investigation tooling incidents:** Sandboxed ADB could not start its daemon; approved host ADB enumerated the connected device. Two investigator searches and one audit search used Windows literal path globs and failed with error 123; use directory plus `-g` filters. Reads assumed nonexistent `duplicate-families.ts`, `metro-inspector-proxy`, and top-level `@expo/cli` paths; resolve installed module locations before reading. Debugger probes initially lacked React Native's required local Origin (HTTP 401), then connected but timed out without CDP replies. Adding `Runtime.enable`, restoring missing USB reverse, and reopening the process did not establish an evaluation result; these are diagnostic transport limitations, not schema evidence. A PID check immediately after starting the app returned no process because startup was still in progress; later enumeration confirmed the process. `sqlite3` was unavailable on the device. A lazy Metro bundle response omitted application module bodies; its absence of application symbols is not proof of an old bundle.
- **Prevention / next evidence:** Stop retrying unchanged debugger probes. Verify the specific application module in the served bundle, collect a fresh fixed read stage, and reproduce that retained-shape/query failure before changing schema. Keep current task diffs separate from pre-existing WIP. Expected negative regression tests are not incidents.
- **Verified device narrowing:** Metro served the exact staged module and an app-identified reload produced `ATLAS_DURABLE_READ SCHEMA DURABLE_MANUAL_START_FIELD`. This proves the live manual read lacks required `date_start`; it does not prove other columns or owner-entered rows are absent. Both earlier version gates can succeed without validating physical shape. Check row-presence with an aggregate-only probe before designing compatibility recovery.
- **Implementation/tooling corrections:** Initial stage insertion matched a nested manual query twice and omitted the completed-run branch. Source inspection caught it before handoff; corrected placement and real-SQLite tests now cover both branches. A manual-signature refinement was initially drafted before its failing test; the behavior was reverted, RED captured (four expected failures), then reapplied and GREEN verified. Metro peer metadata initially was treated as an object although it is query-string data, yielding no matching peer and no reload; decoded it first and targeted the unique app peer. Other connected Metro clients were never reloaded. **Prevention:** Keep stage placement line-anchored, test both early-return and completed-run paths, require RED before production refinement, and normalize protocol metadata before selecting a mutation target.
- **Recovery decision evidence:** A clean process running the aggregate-only probe emitted `ATLAS_DURABLE_READ SCHEMA DURABLE_MANUAL_EMPTY_LAYOUT`. The incompatible manual table contains no owner-entered rows. Targeted recovery may therefore retain that empty original table and recreate the canonical manual table transactionally, preserving every other record and both version markers. Recheck shape and zero rows under the writer lock; refuse populated layouts or archive conflicts. The origin of the incorrect physical schema remains unknown and must not be attributed wholesale to the performance request.
- **Implemented safeguard / verification:** The shared gate now prepares a zero-row canonical manual query even for current/newer markers. Healthy shapes remain read-only. Empty incompatible shapes are rechecked under the serialized writer, retained as `manual_journey_retained_schema` with their indexes, and replaced by canonical empty storage with a distinct working date index; absent manual storage is created. Populated/unknown-presence layouts and archive conflicts are refused unchanged. Both markers are preserved. Forty-nine real-SQLite cases pass, including direct retained entry points, effective correction/evidence preservation, current/newer marker recovery, post-lock data races, atomic rollback/retry, and native failure-category preservation. Independent final review found no blockers; device acceptance remains separate.
- **Recovery review incident:** Initial blanket catches converted native busy/handle failures into schema failures. Root review caught this; native errors now retain identity and category while explicit unsafe-layout decisions use the fixed recovery error. Injected busy/handle layout/count tests and a primary-DDL-error rollback regression pass. **Prevention:** An expected recovery refusal and an operational native failure must not share an unconditional catch replacement.
- **Runtime isolation lesson:** The connected development client can Hot Reload saved schema-changing code before an explicit final launch. The app was stopped for final verification/review; no claim is made about whether earlier saved helper code had already run. **Prevention:** Stop the connected app before editing schema-changing code, verify synthetic migrations and review first, then explicitly load the reviewed bundle. Final acceptance must use a clean process rather than repeated Hot Reloads with stale handles.
- **Review-tooling recurrence:** The independent reviewer repeated a literal Windows wildcard search (error 123) and assumed a nonexistent `import-record/sqlite-transaction-gate.ts`. Directory search and the discovered `src/database/native-transaction.ts` corrected both; no source changed. **Prevention strengthened:** Pass discovered file paths in review briefs and require reviewers to resolve a module path before reading it.
- **Owner acceptance:** After all final checks and the explicit clean-process repair-bundle launch, the owner confirmed `Atlas loads and the recheck completes`. The final fixed-log read returned no matching fresh event; do not invent a diagnostic completion or device timing. Recovery acceptance is the owner's actual click-and-wait report, supported by the tested durable-read completion contract. No private database was copied, and no reset/reinstall/commit/push occurred. Populated incompatible schemas remain deliberately unsupported rather than guessed into a migration.

## Worktree consolidation command-boundary incidents (2026-10-21)

The first attempt to create required preservation refs failed before writing a
ref because the sandbox could not create a `.git` lock. The same narrow Git
branch operation succeeded through the approved host boundary and the refs were
read back. A later PowerShell command used an unquoted `stash@{0}` expression,
which PowerShell rendered as `stash@`; the stash operation had already completed
and its full commit plus untracked-file parent were verified via `refs/stash`
before restore. No application source, private data, or existing ref was lost.
**Prevention:** for Git metadata writes that are blocked by sandbox policy, use
the approved host boundary once rather than retrying; quote reflog expressions
in PowerShell and verify checkpoint object IDs through `refs/stash` before a
candidate restore.

## Consolidation Expo Doctor network blocker (2026-10-21)

The required candidate-tree `npm --prefix apps/mobile run doctor` check reached
`npx expo-doctor` but could not resolve `registry.npmjs.org` and exited with
`ENOTFOUND`. No package install, source mutation, or app/device operation was
attempted. This is an external network-resolution blocker, not a passing Doctor
result or a product failure. **Prevention:** report the exact failed external
check separately; do not substitute cached startup, Jest, lint, or typecheck
results for Expo Doctor and do not retry unchanged registry access repeatedly.

## Consolidation staged whitespace regression (2026-10-21)

**Publication recurrence:** The final staged audit found an extra blank line at
EOF in the previously untracked M4.3 delivery spec. Removed only the trailing
blank line and reran the complete staged whitespace audit before committing.
Strengthen prevention: include newly tracked specs in the final staged audit;
tracked-only working-tree checks cannot cover them.

The first complete staged-diff whitespace audit found trailing spaces on the
date line of the retained performance architecture review. This is a delivery
artifact formatting defect introduced into the consolidated candidate, not an
application failure. **Correction:** remove the trailing spaces, restage the
review artifact, and rerun `git diff --cached --check` before commit.
**Prevention:** run the required whitespace audit after staging every generated
or previously untracked delivery artifact, not only against tracked source.

## Consolidation audit path invocation mistake (2026-10-21)

The first audit command attempted to read an assumed placeholder path and failed
before reading or changing project content. A later attempt used a host-session
temporary diff location that is not visible from the sandbox session. **Correction:**
use the discovered skill path and create a fresh, uniquely named staged diff in
the current session's system Temp directory before reviewing it. **Prevention:**
never invent an instruction-file path; use the configured skill location, and
keep temporary review artifacts in the execution session that must read them.

## Consolidation review-fix verification boundary recurrence (2026-10-21)

The first focused Jest invocation for the review fixes could not collect tests
because the sandboxed transform cache returned `EPERM`; the approved host-boundary
rerun passed all 73 focused tests. A PowerShell wrapper for the benchmark
negative check then treated stderr as a nonmatching error record even though the
script correctly rejected a missing revision. Direct invocation confirmed the
expected fixed validation. **Correction:** use the documented host boundary for
Jest's transform cache and inspect negative CLI output directly when PowerShell
coerces stderr. **Prevention:** do not infer an implementation failure from a
sandbox cache denial or PowerShell error-record conversion; preserve the command
evidence and use the smallest platform-appropriate rerun.

**Fixture typing follow-up:** review caught a TypeScript error after the owner-screen
test added `loadMaintenance` to an `ImportRepository` fixture. The first repair
removed contextual typing and widened its literal import scope. **Correction:**
declare only the three maintenance methods used by each affected fixture through
an `ImportRepository & Pick<MaintenanceRepository, ...>` intersection. A
single-file TypeScript project check and the 20-test provider suite pass.
**Prevention:** when a test needs an optional runtime capability, retain the base
fixture's contextual contract and extend it narrowly instead of removing its type.

## Inventory used the untracked-only preservation tree as a full-source baseline (2026-10-21)

- **Symptom/evidence:** A post-consolidation comparison against `codex/preserve-main-wip-untracked-2026-10-21` produced an oversized diff that appeared to add the whole mobile application. No application change or Git mutation occurred.
- **Cause:** A stash's untracked-only parent contains captured untracked files, not the tracked working-tree snapshot. Treating it as the full baseline gives a false scope.
- **Correction / verification:** Inspected the named tracked snapshot and its tree, compared tracked source against `codex/preserve-main-wip-2026-10-21`, and compared only captured untracked files against the complementary ref. Confirmed the actual production deltas and documented the integrated scopes. Current HEAD and clean audit-start status were read directly; root checks pass.
- **Prevention:** Before a snapshot comparison, verify its parent/tree role and the presence of the target paths. Use the tracked and untracked preservation trees for their respective file sets; never infer implementation scope from a truncated, oversized diff.

## Final consolidated device acceptance has no connected Android device (2026-10-21)

- **Status / ownership:** Resolved: owner reconnected the device and confirmed consolidated Android import/Atlas completion. This was an external availability blocker, not an application regression.
- **Evidence:** Host ADB lists no devices; querying the previously known reverse mapping returns device unavailable. Metro is running and mobile source matches consolidation HEAD `cd889c98946b067cefd8af303a36b09d8fdeedd7`.
- **Action / prevention:** Requested owner reconnection/unlock. No device operation or source repair was attempted. Check enumeration before addressing a specific device, and keep final-bundle acceptance pending rather than reusing earlier recovery acceptance for later source changes.
- **Reconnection verification:** Enumeration now succeeds. Restored USB Metro routing and reopened only the app process on the verified consolidated modules; no storage reset or reinstall. Owner import/Atlas result is the remaining evidence.
- **Diagnostic-format limitation:** `logcat -v monotonic` produced `dmesg: klogctl: Permission denied` on this device. Switched to supported epoch formatting without changing permissions; fixed-event reads returned no matching fresh events yet. Do not infer a completed operation, duration, or application defect from that empty capture. Prefer supported timestamp formats and preserve the owner's actual click-and-wait result separately.
- **Final acceptance evidence:** Owner confirmed `Import and Atlas check both complete`; fresh epoch-format events now corroborate `METADATA_IMPORT COMPLETE`, `ATLAS_UPDATED`, and `ATLAS_REVEAL_RETRY COMPLETE` with matching parent correlations. This closes the connection/acceptance blocker for those Android flows. The observed 41.6 s import, 104.6 s import-through-Atlas and 65.7 s recheck are one-run baselines, not a speed improvement or proof of a particular bottleneck. Profile the post-rebuild read/publication interval before choosing another performance patch.

## Replay legibility spec frontmatter patch mismatch (2026-10-23)

- **Status:** Corrected before implementation.
- **Symptom/evidence:** The first approved-spec frontmatter patch attempted to change the same `status` line twice, so `apply_patch` rejected it without modifying the file.
- **Cause:** The patch was composed against an impossible duplicate context rather than the verified single current frontmatter block.
- **Correction / verification:** Re-read the current spec, then applied separate baseline and status patches using exact context. The spec now records baseline `7d3f44257d8f8510f2aabb323388fab112f6150f` and status `in-progress`.
- **Prevention:** For sequential frontmatter mutations, re-read the current block and make each replacement against one existing line; do not combine a transition with its own pre-transition context.

## Replay legibility staged-diff sandbox boundary (2026-10-23)

- **Status:** Environment rerun required.
- **Symptom/evidence:** The required `git add -A` audit could not create `.git/index.lock` inside the filesystem sandbox, so staging did not occur and the attempted temporary cached diff was empty.
- **Cause:** The sandbox does not permit the Git index lock write for this repository; no source, asset, or Git index change was made by the failed attempt.
- **Correction / next action:** Rerun the same narrow staging and cached-diff audit through the approved host boundary, then inspect its uniquely named temporary diff before relying on it.
- **Prevention:** Treat a pre-staging index-lock denial as an environment boundary, not source evidence; do not inspect or report an empty post-failure diff as an implementation audit.
- **Implementation recurrence:** A combined source/test/contract patch used an imprecise line wrap for the chapter contract and was rejected atomically; no file changed. Re-read the exact contract lines and split the patch by file. A later font-header probe used an unsupported PowerShell `Get-Content -Encoding Byte` value after the asset hash had already verified the downloaded TTF. Use `Get-Content -AsByteStream` when a binary header is actually needed; do not retry a failed multi-file patch without exact context.
- **Verification recurrence:** The first focused Replay Jest command again hit the known sandbox transform-cache `EPERM` before test collection. It was rerun with the repository-local `.jest-cache-codex` cache and passed. The first renderer assertion overfit a generated panel URI and failed despite the expected frame allocation; it now asserts the card and remaining-media frame values directly. Keep cache configuration explicit and test the command contract rather than nondeterministic output paths.

## Replay Android launcher URL scheme mismatch (2026-10-23)

- **Status:** Investigating the installed development-client route.
- **Symptom/evidence:** After confirming the device was displaying the Expo development-launcher home screen and Metro was available through the existing USB reverse mapping, an attempted automated `VIEW` intent using `exp+com.anonymous.travellife://expo-development-client/?url=...` was rejected because no activity resolved that scheme.
- **Cause:** The connection URL was inferred from the Android package identifier instead of first verifying the custom scheme registered by the installed build.
- **Correction / next action:** Inspect the app manifest and installed package intent filters, then send at most one connection intent using the verified scheme. No storage reset, reinstall, app-data mutation, or application source mutation occurred.
- **Prevention:** Before automating an Expo development-client handoff, derive the URL scheme from the built manifest or package metadata; do not guess it from the package name or repeat an unresolved intent.
- **Investigation recurrence:** The first manifest search had an incorrectly escaped regular expression; its replacement also named two optional app-config files that do not exist. Both commands were read-only and made no application change. Use fixed-string `rg -e` patterns and enumerate candidate paths with `rg --files` before passing optional files explicitly.
- **Host-diagnostic recurrence:** A combined listener/process inspection relied on `Get-NetTCPConnection` and `Get-CimInstance`; this host denies their CIM access, terminating the pipeline before later observations. A sandbox-local HTTP probe also could not reach the host-bound Metro listener, while Expo's own start command confirmed the port was occupied. **Correction:** read Metro's project log and use the device connection/bundle events as the authoritative local-server evidence. **Prevention:** do not infer a stopped Metro server from a sandbox-local loopback probe or protected CIM API; use a command that succeeds in this host context before attempting a replacement server.
- **Temporary-log recurrence:** An isolated Metro process deliberately wrote its logs to the host Temp directory, but the next sandboxed read expanded `$env:TEMP` to the sandbox-specific directory and could not find the file. **Correction:** use the explicit host Temp path for files created by a host-launched process. **Prevention:** do not carry environment-derived temporary paths across host and sandbox command boundaries without resolving and preserving the absolute path.
- **Temporary-log follow-up:** The assumed host Temp path was also absent because the server inherited the sandbox Temp value when it was launched. This second read was diagnostic-only. **Correction:** verify server readiness through its bound TCP port rather than attempting to infer the child process environment. **Prevention:** preserve a process's explicit redirected paths only when they are accessible in the same execution boundary; otherwise choose a boundary-independent readiness signal.
- **Metro transport recurrence:** The first isolated Metro invocation used `--localhost`, which bound to IPv6 loopback. Android USB reverse requested IPv4 loopback, producing an incomplete response; a host-bound retry then correctly failed with the occupied-port diagnostic. **Correction / next action:** identify the exact port listener, replace only that temporary server, and start Metro with a host reachable through ADB reverse. **Prevention:** when pairing Expo with `adb reverse`, verify the listener address family before choosing `--localhost`; do not diagnose it as an application bundle failure.
- **Port-owner inspection recurrence:** The `netstat` and `tasklist` combination did not reveal a listener in this restricted host context; `tasklist` returned a credential error and no process was stopped. **Correction:** use the accessible Node process list and launch timestamps to identify only the temporary server created in this task. **Prevention:** confirm that a Windows process-inspection command can return a result in the current permission boundary before using it to select a process target.
- **Replay device-recovery network-boundary escalation (2026-10-23):** A proposed clean Expo server with the normal LAN listener was rejected before execution because it could expose the private development bundle beyond the existing USB-reverse scope. No listener was started and no source, dependency, device-data, or network configuration changed. **Status:** blocked pending explicit owner approval for this broader, temporary development-server exposure, or an alternative local-network recovery route. **Prevention:** do not try to circumvent a rejected network-scope safeguard through indirect binding, port forwarding, or a substitute launcher; explain the exposure and obtain a scoped decision first.
- **Resolution:** The owner authorized a temporary LAN listener. An isolated Metro server on port 8083 was started only for this recovery, and Android USB reverse maps that port to the connected device. It is an active temporary diagnostic server and must not be treated as a product-networking configuration.
- **Device HTTP-probe utility mismatch:** The device's `toybox` provides `nc` but not `wget`; the attempted diagnostic exited 127 without changing the app, route, or server. **Correction:** use the already verified `nc` utility for the narrow HTTP response probe. **Prevention:** check `toybox --help` or use a previously confirmed device utility before choosing a shell HTTP client.
- **Device raw-HTTP probe formatting mistake:** The first `nc` request used a shell string whose escaped CRLF delimiters did not yield a usable HTTP response. It was read-only and did not alter the process, server, or application. **Correction:** inspect the app process's socket table instead of repeating a manually composed raw request. **Prevention:** when exact wire framing is not essential, prefer an OS-visible connection-state check over shell-escaped protocol construction.

## Replay Android development-client React context remains unready (2026-10-23)

- **Party audit correction:** The preceding recovery narrative repeatedly promoted hypotheses to confirmed root causes. Historical Metro errors do not establish the cause of the current screen; no evidence identifies who introduced the earlier conflict markers or who removed them. A context-not-ready soft exception identifies an incomplete lifecycle state, not a defective installed binary. Successful host bundle compilation does not prove the device received or executed that same bundle. The bare-URL `index.bundle` 404 is insufficient to condemn the standard Expo manifest launch route without inspecting its manifest response. Retract claims that the native binary is proven faulty, that Replay changes are exonerated, or that a reinstall is established as necessary. The exact current startup cause and authorship remain unknown. **Prevention:** label each observation, hypothesis, and causal test explicitly; correlate fresh device PID/time, manifest/bundle requests, and first JS execution on one stable endpoint before choosing another recovery action.

- **Status:** Unresolved Android recovery blocker; the current debug client was not replaced.
- **Symptom/evidence:** The original white/blank page corresponded first to an unresolved `atlas-reveal.tsx` conflict marker and an expired USB reverse route. After the conflict was removed externally, USB reverse was restored, and a clean isolated Metro server delivered `node_modules/expo-router/entry.js` successfully. A bare launcher URL was also shown to resolve to `index.bundle` (404); the verified Router entry URL returns and Metro reports a successful Android bundle. Yet the installed development client remains on its launcher shell and logs `ReactHost` context-not-ready soft exceptions without a JS error or native crash.
- **Cause:** The application source and Metro bundle path are no longer failing; the installed native development client is not completing React-host initialization after bundle delivery. The precise native lifecycle cause is not yet established.
- **Recovery attempt (2026-10-23):** The owner approved one normal `:app:installDebug` recovery install. Gradle entered the Expo native C/C++ compile, then ceased writing its daemon log while its wrapper remained idle for several minutes. It produced neither an APK nor a changed package `lastUpdateTime`; the wrapper was stopped without touching the installed app or device data. This does not establish whether a fresh binary would solve the React-host state.
- **Verified build failure (2026-10-23):** A subsequent tracked `:app:installDebug --no-daemon --stacktrace` completed its native C/C++ steps but failed in `:app:packageDebug` with `java.lang.OutOfMemoryError: Java heap space`. The project currently packages four ABI variants into the debug APK. **Correction:** target the connected arm64 device with `-PreactNativeArchitectures=arm64-v8a` for this recovery install instead of increasing heap or repeating the all-ABI package. **Prevention:** preserve final Gradle output for a long-running build; do not infer a native-build failure from an idle wrapper or CMake warnings.
- **Recovery verification errors (2026-10-23):** Two PowerShell screenshot writes used an unsupported encoding and invalid `cmd` quoting, and a diagnostic used reserved `$PID`; none changed the app or device data. The subsequent binary-safe capture succeeded. It initially appeared to show the app blank, but Android accessibility and policy dumps establish that the device is currently locked and displaying System UI keyguard, while Travel Life remains the resumed activity behind it. **Correction:** use a dedicated process variable and a binary stream for ADB screenshots; confirm foreground/keyguard state before interpreting a capture. **Prevention:** never infer an app-rendering result from a locked-device screenshot.
- **Metro exposure safeguard recurrence (2026-10-23):** Starting a replacement Metro with `--host lan` was blocked before execution because it would expose the project bundle to the local network. **Correction:** use a localhost-only Metro endpoint with USB `adb reverse`, leaving the shared port 8081 untouched. **Prevention:** when a private development bundle needs a replacement endpoint, choose the narrowest listener first; do not treat a prior, time-bounded network authorization as blanket approval.
- **Android development-client transport remains unresolved (2026-10-23):** The all-ABI debug package initially failed with heap exhaustion; an arm64-only debug install succeeded. The USB-local Metro path then exposed three distinct conditions: IPv4-to-IPv6 localhost mismatch produced EOF, Expo's manifest rewrote the bundle URL to port 8083, and a temporary USB mapping of device 8083 to the loopback bridge still left the launcher indefinitely loading without an Android bundle request reaching Metro. The temporary localhost Metro/proxy and only their 8083/8084 reverse routes were removed; shared 8081/8082 routes, app data, and concurrent work were not touched. **Status:** unresolved dev-client transport blocker; do not claim the app render is fixed. **Prevention:** verify a device-originated Android bundle request reaches Metro before changing native ports or source code. Separately, user-supplied screen photos show vertical colored display lines, a device-display hardware issue outside the app's control; do not attribute those lines to software.
- **Next action / owner decision:** Do not repeat the install blindly. Diagnose the stalled native build from a bounded, reproducible Gradle invocation before requesting another binary replacement, then correlate one stable development endpoint with fresh device process, manifest/bundle requests, and first JS execution.
- **Prevention:** Separate source-bundle evidence from native-client lifecycle evidence. Do not call a blank screen fixed merely because Metro compiles, TCP connects, or the launcher accepts a URL; require the actual React surface to appear.

## Replay soundtrack selection test cache recurrence (2026-10-24)

- **Status:** Environment rerun required.
- **Symptom/evidence:** The first focused Replay selection Jest command failed before collecting tests because its default sandbox transform cache returned `EPERM` while renaming a cache map.
- **Cause/correction:** The command omitted the repository-local Jest cache required by the established Windows sandbox workaround. No source or test result was produced by that failed run.
- **Prevention:** Pass a writable repository-local `--cacheDirectory` for sandboxed Jest invocations, then assess source behavior only from the successful rerun.

## Replay editor implementation patch-context correction (2026-10-24)

## Replay trip-first screen test migration (2026-10-24)

- **Symptom/evidence:** The first focused Replay-screen run after replacing the inline trip strip with the approved overview-to-gallery flow failed ten legacy assertions that expected a media grid or aggregate Save action immediately after Edit.
- **Cause/correction:** The assertions encoded the superseded editor navigation, not a product runtime failure. Update the screen tests to enter a specific trip before asserting gallery controls and to use overview-level Update Replay for aggregate rendering.
- **Prevention:** When an approved navigation boundary changes, migrate focused tests in the same patch and include a direct Done-trip-no-render regression before treating the new screen flow as verified.
- **Follow-up:** The migrated test exposed React Native's `FlatList` invariant when overview (one column) became gallery (three columns) without a new key. The screen now keys the two list modes separately; this is a real navigation-rendering defect, not a test-only discrepancy.
- **Typecheck follow-up:** The first test helper annotated the asynchronous `render` return rather than its awaited screen result, which TypeScript rejected. Use `Awaited<ReturnType<typeof render>>` for React Native Testing Library helpers and rerun typecheck immediately after test helper changes.
- **Full-suite correction:** The later six-of-twenty-one failure was not merely a generic harness issue. A detached Replay preparation could continue after unmount and invoke shared provider mocks during a later test. Preparation now carries a mounted generation guard, ignores late progress/results/errors, and disposes a detached newly created artifact. The complete screen suite must pass before this incident is closed.
- **Harness API follow-up:** A proposed async press helper was unavailable in the pinned React Native Testing Library version and made typecheck fail. Use its supported `act` API or await a real screen transition; do not assume newer testing-library exports.
- **Resolution:** The direction test was incorrectly performing a second aggregate update while only asserting direction persistence, leaving an unobserved async render at teardown. It now verifies the durable working direction without rendering; the separate final aggregate-update test covers one commit/re-render end-to-end. Teardown unmounts inside `act`, and the complete 21-test screen suite now passes with the repository-local cache. Keep aggregate render assertions in one explicitly settled scenario rather than starting duplicate background work in adjacent tests.

## Replay gallery unknown-candidate paging recovery (2026-10-24)

- **Symptom/evidence:** The active gallery filtered candidates by `available` before display and passed the displayed list to preview paging. Unknown local media could disappear before resolution, and a page failure had no owner-visible retry. The first retry regression accidentally reused an all-preview fixture, so it could not trigger the Load more control.
- **Correction:** The gallery now keeps every eligible trip candidate visible, resolves from the unfiltered trip candidate set, retains authoritative album/selected counts separately, and offers Load more plus fixed Retry recovery without clearing rendered cells. Tests use an actual unknown candidate for both resolution and failure/retry paths.
- **Prevention:** Page and retry tests must include at least one unresolved eligible candidate; do not use thumbnail-ready fixtures to test unknown-media recovery. Treat candidate membership, preview availability and selected intent as separate domains.

## Replay dead-editor cleanup command-path slip (2026-10-24)

- **Evidence/cause:** After removing the unreachable fallback editor, an audit `rg` command was accidentally run from `apps/mobile` with an `apps/mobile/...`-prefixed path and failed before inspection.
- **Correction/prevention:** Typecheck and the complete cached screen suite still ran and passed. Use paths relative to the active package directory when invoking package-local checks; command-path failures are not product evidence.

- **Symptom/evidence:** A memory lookup initially used an incorrect local path, and two combined Replay editor `apply_patch` attempts failed because their source context no longer matched after the first visual-editor change. Neither failed patch changed application files.
- **Cause/correction:** The path was transcribed from the wrong memory directory and the patch combined stale multi-line context. The correct memory path was used, then the editor was re-read and amended through smaller exact hunks.
- **Prevention:** Resolve configured memory paths literally and, after every source mutation, re-read the exact target lines before applying a follow-up patch. Keep large JSX changes and cleanup changes separate.

## Replay editor committed-share test raced the Save transition (2026-10-24)

- **Status:** Corrected; regression rerun pending.
- **Symptom/evidence:** The new committed-composition Share test pressed Save and immediately asserted the Share selector. It could observe the prior preview's Share action before the asynchronous save/reprepare transition had committed, then failed to find the expected selected-only candidate.
- **Cause/correction:** The test treated the visible pre-transition button as proof that the new composition was ready. It now waits for the exact draft write and second preparation invocation before entering Share.
- **Prevention:** For a UI action that starts asynchronous persistence or rendering, wait for the identifying side effect and the resulting state before asserting controls derived from the new revision.
- **Lint recurrence:** The first rapid-intent repair read the selection ref through JSX closures, which the React refs rule correctly rejects as a possible render-time read. The event work now lives in named handlers and a leaf media-tile component; lint, typecheck and the screen suite pass. Keep ref-backed intent reads out of JSX expressions even when the immediate intention is an event callback.

## Replay Edit review found stale render and committed-selection gaps (2026-10-24)

- **Status:** Corrected in the visual-editor slice; regression checks pass.
- **Symptom/evidence:** The post-implementation review found that Done persisted the edited selection but invoked the renderer with its automatic-selection argument. It also found that a `REPLAY_STALE` error after manifest load could leave the current editor entry point enabled with prior local media context.
- **Cause/correction:** The preparation wrapper accepted the committed keys but did not forward them to the provider; stale failure handling only changed the failure view. It now passes the exact committed override to the renderer and clears editor input, selection, inspection and preview on a stale scope. Tests assert exact renderer keys and no Edit/media entry after stale failure.
- **Prevention:** Review both durable write and immediate re-render call arguments for every editor commit. Treat a stale/privacy scope outcome as a pixel-withholding event, not merely an error message.
- **Documentation patch recurrence:** A project-state patch used a paraphrased line rather than the exact current wording and was rejected before changing a file. Re-read the heading block and applied the narrow update. Use exact verified context for project-state edits after adjacent documentation changes.

## Replay working-draft delegated build renderer cache denied (2026-10-24)

- **Status:** Environment limitation; no source change from the delegated attempt.
- **Symptom/evidence:** The delegated BMAD build renderer could not inspect its `.venv` interpreter because its sandbox Temp cache returned `Access is denied` (error 5), then halted before implementation or tests.
- **Prevention:** Treat a build-workflow interpreter-cache denial as an execution-environment issue, not feature evidence. Reuse a verified renderer boundary or continue with the already-rendered workflow only after confirming its instructions still apply; never report the blocked delegated attempt as implementation progress.

## Replay Edit continuation was prematurely reported as complete (2026-10-24)

- **Status:** Open; implementation and acceptance remain in progress.
- **Symptom/evidence:** The Replay Edit task was repeatedly handed off after partial visual and draft-storage changes, while required bounded paging, conflict recovery, correct durable working semantics, verified video posters/interval inspection, and owner platform acceptance were still incomplete. A later draft-storage patch also initially introduced a non-idempotent schema migration and incomplete test doubles before source inspection corrected the immediate failures.
- **Cause:** Partial host checks and delegation progress were treated as delivery milestones instead of verifying the full approved D4/E01-E22 contract and its end-to-end state transitions.
- **Correction / next action:** Continue from the existing working tree, make durable working state transactional and testable, finish the editor behavior against the approved contract, then run the complete relevant host checks before requesting only the unavoidable owner device acceptance.
- **Prevention:** Do not end an implementation turn or mark a Replay task complete until the sole delivery record's task matrix is checked against the actual diff and tests. A passing narrow check proves only that narrow check; report partial scope explicitly and continue unless a concrete external decision or owner action is required.

- **Implementation check recurrence:** The first cached-preview hydration patch placed an `await` inside a non-async Promise callback, and mobile TypeScript rejected it before tests. The callback is now async. **Prevention:** run TypeScript immediately after changing an effect's Promise chain; a visual state-path edit is still ordinary TypeScript control flow.
- **Test-double recurrence:** Adding acknowledged working saves made four Replay-screen cases fail because their provider mock omitted `stageReplayWorkingDraft`, turning a successful persistence path into a synthetic save failure. The mock now supplies an explicit resolved stage operation. **Prevention:** whenever a context contract gains a required operation, update every focused mock in the same patch and assert the new operation separately.
- **Bounded-preview test typing recurrence:** The first 49-item editor-entry regression typed the adapter preview argument as non-null strings, while the production adapter deliberately accepts null source slots. TypeScript rejected the test fixture; it now matches `(string | null)[]`. **Prevention:** test doubles at a privacy/source boundary must retain nullable input shapes rather than narrowing them for a convenient synthetic fixture.
- **Owner-commit artifact routing correction:** Screen inspection found Done passed its committed media keys to `preparePrivateReplay`, whose existing non-empty-key route intentionally creates a temporary selected-share artifact. The committed owner draft itself was correct, but the replacement preview was not eligible for durable owner storage. Done now reloads the just-saved draft through the owner preparation route; sharing retains the explicit-key transient route. **Prevention:** distinguish owner replay preparation from selected sharing by lifecycle semantics, not only by the identical media-key argument shape; test durable- and share-path calls separately.
- **Virtualized-grid patch-context recurrence:** A combined grid replacement patch used one stale context hunk and was rejected atomically before changing source. Re-read the current anchors and applied the same change as an exact patch. **Prevention:** for a multi-region JSX/style refactor, verify every hunk against the live file after concurrent editor changes; a rejected patch is never evidence that the intended refactor landed.
- **Virtualized-list assertion recurrence:** The first grid configuration test inspected the accessibility-matched host scroll node, which React Native Testing Library exposes after `FlatList` flattens its composite props; it therefore could not observe `numColumns`. The failing assertion was removed rather than pretending it verified virtualization. **Prevention:** assert virtual-list behavior through a large-data render/load scenario or a preserved testable wrapper, not host-node props after React Native composite flattening.
- **Trip-scope contract test recurrence:** Adding included-trip persistence correctly added the explicit scope argument to stage/commit calls, but four older UI expectations still asserted the prior five/six-argument contract. The source compiled and SQLite tests passed; the screen assertions were updated to verify the full durable scope instead. **Prevention:** when a persistence call gains a semantic field, update direct argument assertions and include both default and changed values rather than treating the extra parameter as incidental.

- **Focused-screen suite recurrence:** The complete Replay screen suite still had one order-sensitive failure after the mock update: `saves a direct visual selection...` timed out waiting for `saveReplayDraft`, while the same test passed in isolation with the repository-local cache. Real SQLite working-draft migration/recovery tests pass. **Status:** unresolved harness/order interaction; do not present the full screen suite as passing. **Prevention:** keep the isolated result distinct and rerun the complete suite after stabilizing queued React state between tests.

## Replay gallery verification path typo (2026-10-24)

- **Evidence/cause:** An inspection command ran from `apps/mobile` but used repository-root-prefixed `apps/mobile/src/...` paths. The search failed before inspecting source; it did not alter code or test results.
- **Correction/prevention:** Reran the read-only search using `src/...` paths relative to the mobile package. Resolve command paths against the active working directory before combining a source audit with verification commands.

## Replay gallery resolved-preview render ref lint failure (2026-10-24)

- **Evidence/cause:** A post-implementation mobile lint run found the new Load more visibility check reading `editorPreviewResolvedKeys.current` while rendering. The focused screen suite and TypeScript passed, but React's refs rule correctly rejects render-time ref reads because the UI may not update when the set changes.
- **Correction:** Kept the ref for serialized paging work and added a mirrored immutable resolved-key state for render decisions. Page resolution now replaces or adds through helpers that update both values.
- **Prevention:** Run lint, not only TypeScript and focused Jest, after any UI-state patch. A ref used to coordinate asynchronous work needs a state projection whenever it controls visible UI.

## Replay lint-fix combined patch context mismatch (2026-10-24)

- **Evidence/cause:** The first combined patch for the render-safe preview state and this incident entry used stale error-playbook context and was rejected atomically; no source or documentation mutation landed.
- **Correction/prevention:** Re-read the actual tail of the playbook and applied the source and incident updates as separate exact patches. Keep code and append-only incident-record hunks separate when either target changes concurrently.

## Replay unknown-tile selection readiness gap (2026-10-24)

- **Evidence/cause:** After the gallery stopped hiding unknown candidates, source review found an unknown tile could still be selected immediately, before local availability resolved. That conflicts with the approved contract: the tap must check locally and adopt the selection only after usable access.
- **Correction:** An unresolved tile now shows Checking while one bounded local preview read runs. It joins selection only when that result is available; a known unavailable tile becomes inactive, and a read failure keeps the tile unselected with the existing Retry recovery.
- **Prevention:** When separating candidate membership from preview availability, review both enumeration and every mutation entry point. Visibility alone does not make an unknown source eligible for output.

## Background maintenance TaskManager native failure leak (2026-10-24)

- **Owner evidence:** The current Metro log showed `travel-life-library-maintenance-v1` rejecting `NativeDatabase.prepareAsync` with a native null-pointer error. The preceding Replay virtualized-list error was from an older bundle; the current bundle had already loaded the repaired screen.
- **Cause:** The task handler caught reconstruction failures but not a failure escaping the reconciliation runner (including its final lease release), so TaskManager printed the raw native error.
- **Correction:** The complete OS-task body now has one fixed diagnostic boundary and returns Expo's failed result for every native/reconciliation failure. A regression asserts a runner rejection never exposes its private error string.
- **Prevention:** Every OS-invoked handler needs a top-level redaction boundary in addition to operation-level recovery; never rely on a helper's internal catch to protect TaskManager logging.

## Android metadata import blocked by released private-record handle (2026-10-24)

- **Owner/device evidence:** Android permission inspection confirms photo/video/media-location access is granted. The live Import screen nevertheless says `Private record status could not be read`, shows a paused zero-item import, and offers Resume. This is why metadata import is not recognized; it is not a denied permission.
- **Cause:** The initial private-record lifecycle read reused a released Expo SQLite native handle and failed inside `prepareAsync`. The import repository cleared a rejected open promise but did not replace a handle that became invalid after an otherwise successful open.
- **Correction:** A lifecycle read that specifically identifies a released native handle discards only that cached connection and retries the read once with Expo's fresh-connection option. No metadata write, history reset, permission change, or retry of an interrupted mutation occurs.
- **Prevention:** Test the lifecycle gate against a handle that fails after startup, not only a rejected open. A cached native connection is not proof that its later prepared statements remain valid.

- **Device follow-up:** Reload evidence showed the narrow retry did not restore import because foreground startup launches multiple repository readers before the lifecycle retry; one can still poison the default cached Expo handle. The import repository now opens each instance on a fresh native connection from the outset, while the existing process-wide transaction serializer preserves writer ordering. No storage reset is authorized.
- **Verification:** After the development client reload, navigating to Import showed the existing private record as completed: 2,995 scanned, 1,957 geotagged metadata available, and 0 unavailable. The device did not request access again and no new import was started. Focused import/photo-access tests (46), TypeScript, and lint pass. The issue is resolved for the owner-visible import gate; background maintenance's independent native-handle failure remains tracked separately.

## Replay trip Done/Back gave no owner feedback (2026-10-24)

- **Owner evidence/cause:** A trip-level Done or Back waits for a durable working-draft save before returning to overview. The gallery showed neither saving nor save/conflict failure state, so a pending SQLite operation or rejected save looked like an unresponsive button even though the screen correctly withheld navigation to avoid claiming an unsaved edit.
- **Correction:** The trip gallery now exposes a busy progress state, disables duplicate Done/Back presses while the acknowledged save is running, and keeps the gallery open with fixed retry/conflict guidance when persistence does not complete. The same Done/Back action retries after a recoverable failure.
- **Verification/prevention:** A Replay-screen regression forces the durable save to fail, asserts visible recovery and retained gallery, and verifies Done remains retryable. The complete focused suite passes 24 tests with TypeScript and lint. Every navigation transition that depends on a background durable write must present its pending and fixed-recovery state at the same interaction location.
- **Conflict recovery follow-up:** Device UI inspection then exposed an actual working-draft conflict. The initial gallery guidance said to return to overview, but both navigation actions retried the conflicting save first, making that instruction unreachable. Recovery controls now live in the gallery: Use mine clears only the conflicting working branch, stages the owner's current local intent, then returns to overview; Use latest reloads the current Replay. A first regression attempt incorrectly forced every retry to fail and named its event handler with a `use` prefix, which lint treated as a Hook. The correction rejects only the initial save and uses a normal handler name; screen suite (24), TypeScript, and lint pass. Never put a conflict-resolution action behind a navigation transition that itself depends on resolving that conflict.

## Replay trip gallery did not match the approved editor and deferred active-trip previews (2026-10-24)

- **Owner evidence/cause:** The supplied device image showed a repeated placeholder grid and per-tile `Inspect` buttons, rather than the approved visual trip editor. Candidate membership was present in the Replay manifest, but the initial bounded preview pass was allocated across the whole Replay; opening a later trip could therefore show its eligible media as unresolved placeholders. The gallery also placed every secondary action before the grid, causing cramped or clipped controls on a phone.
- **Correction:** Opening a trip immediately requests its own bounded preview page. The gallery now keeps every candidate visible, exposes `All n` and `Selected n`, places Load more with its resolved/total count after the grid, makes inspection an icon overlay, and moves trip-wide actions into More. Done trip returns to the overview; the single Update Replay action remains the only replacement/render action.
- **Verification/prevention:** The Replay screen suite passes 24 tests, including active-trip unknown-media resolution, selected filtering, trip inclusion, conflict recovery, and Done/Back behavior; mobile TypeScript, lint, and whitespace checks pass. Review approved mock composition whenever adding controls to a media grid: secondary actions must not displace the visual selection task, and bounded preview work must be scoped to the trip the owner actually opened.
- **Build invocation follow-up:** The first run of the existing device-build script was blocked by the sandbox's CIM-process restriction before Gradle started. It was rerun with the narrowly scoped host permission and completed using the existing valid arm64 debug APK; no app data was cleared or APK installed. Run this script with its required host process-inspection permission rather than treating a sandbox CIM denial as an Android build failure.

## Replay Done/Back duplicated the working-draft write (2026-10-24)

- **Owner evidence/cause:** The owner again reported that Done trip and Back did not save or return to the overview. Every direct edit had already queued a working-draft write, but Done/Back always queued a second identical write after that queue settled. This creates unnecessary transaction/revision work and can surface a conflict. Its saving or recovery copy was also placed in the list header, out of view beside the footer buttons that triggered it.
- **Correction:** Done/Back now wait for the existing working-save queue and return immediately after its acknowledged completion; they do not write a duplicate draft. A failed write has an explicit retry path, and save/conflict feedback plus recovery controls are rendered next to Done/Back.
- **Verification/prevention:** A new screen regression removes a media item, waits for the one staged draft, invokes Done, asserts return to the overview, and asserts no second stage call. The first existing failure test assumed Done itself initiated the failing write; it was corrected to create an edit first, which matches the real lifecycle. Focused Replay tests pass 25. For every asynchronous edit flow, distinguish “await the existing save” from “create a new save,” and render recovery at the initiating control, not only elsewhere in a scroll view.

## Replay gallery mock-composition mismatch (2026-10-24)

- **Owner evidence/cause:** The owner provided the approved Bali gallery mock and correctly identified that the implementation was not that composition: it placed Done/Back in a scroll footer instead of the fixed `Back · trip · Done` header, and included extra content before the visual grid. The prior patch reused parts of the mock without making its navigation structure authoritative.
- **Correction:** The active trip gallery now has a fixed native header with contextual Back, centered trip name, and Done; its scroll content begins with All/Selected/More and then the media grid. Conflict state uses clear `Keep` and `Discard` actions rather than claiming another actor changed the Replay.
- **Prevention:** When a mock has been approved, compare the resulting screen hierarchy—not merely individual controls—against it before calling the implementation complete. Header placement and which surface owns navigation are acceptance criteria, not styling details.

## Replay custom audio acknowledged copy versus durable draft (2026-10-25)

- **Owner evidence/cause:** An audio file larger than 5 MB could be selected without a visible failure. The size guard threw before the selected name was set, leaving no contextual feedback. A valid copied file also switched to `Loaded` before its working-draft write ran; Settings Done then appeared to save for a long time, while the owner could not tell whether Update Replay would use it.
- **Correction:** The selected name is now retained before the size boundary. Over-5-MB files show a specific inline failure and are neither copied nor staged. Valid audio moves through Loading → Saving audio → Loaded, and becomes the active soundtrack only after its exact working-draft write succeeds. A failed stage keeps the prior soundtrack and shows an actionable save failure.
- **Related contract correction:** The screen already supplied a first-trip-ready callback to private Replay preparation, but the provider interface accepted only three arguments and silently dropped it. The provider now accepts and invokes that callback after its first verified chapter, keeping early playback behavior consistent with the screen contract.
- **Verification/prevention:** Added screen regressions for oversized files and failed soundtrack staging; replay-screen plus provider checks pass 84 tests, along with TypeScript, lint, and whitespace checks. Treat a local file copy as transient transport, never proof that an owner setting is durable; every visible Loaded state must follow the corresponding acknowledged write.
- **Follow-up owner report/cause:** A sub-5-MB file could still look as though it loaded yet render without sound. The picker admitted every `audio/*` container, including types that were never part of the Replay contract, and the Update handler could pass the render-frame's stale soundtrack state instead of the just-acknowledged custom track.
- **Correction/verification:** Selection now accepts only MP3, M4A, AAC, WAV, or OGG (up to 5 MB) and names an unsupported format before any copy or draft write. Update Replay reads the acknowledged soundtrack ref, and the renderer regression proves that a saved custom local track is mapped and re-encoded as the verified AAC stream in the final MP4. Focused Replay screen/renderer/provider tests pass 93; TypeScript and lint pass. The aggregate mobile script remains blocked only by the known sandbox Jest Temp-cache EPERM, before tests collect; it is not a product-test failure.
- **Prevention:** Do not equate an Android picker MIME wildcard with supported renderer input. Every accepted editor format must be listed in UI copy and have a renderer mux regression. Any immediately-following commit must take its setting from the acknowledged intent, not a potentially stale React render closure.

## Replay partial-first-trip handoff is presented as a completed Replay (2026-10-25)

- **Owner evidence:** After Update Replay, the player can initially show only newly edited photos or a subset of selected photos, with no soundtrack; after waiting, it can become a correct full Replay with sound. The speaker control also disappears when native fullscreen opens.
- **Confirmed cause:** The provider intentionally renders each chapter with `music: undefined`, then calls `onFirstTripReady` after the first verified chapter. The screen immediately changes to `preview-ready` and labels that partial, necessarily silent MP4 as “Playing your private Replay,” while the remaining chapters and final soundtrack mux continue in the unresolved promise. That preview-ready surface hides its existing render progress. The speaker is a React overlay outside `VideoView`; native fullscreen contains only the native player/control surface and therefore cannot include it.
- **Status / required correction:** Open; no product-code change was made during this investigation. The UX must either retain a clear "first trip ready, finishing full Replay" state/progress until the verified full artifact replaces it, or make partial playback a deliberately labelled optional experience. Fullscreen must expose a player-native or fullscreen-owned mute control. Preserve the one full-render artifact as the share/update source and never let a partial chapter be described as final.
- **Prevention:** A first-byte/first-chapter optimization needs distinct model states and acceptance tests for partial media count, render progress visibility, audio availability, final artifact replacement, and fullscreen controls. A host test that asserts early playback is not evidence that the owner sees a completed Replay.

## Replay device refresh Metro boundary (2026-10-24)

- **Evidence/cause:** The local Metro status endpoint was unavailable after host checks, so a connected development client could not receive the JavaScript correction through reload. The first sandbox-side attempt to read the hidden helper's host Temp log also failed because sandbox and host Temp locations differ.
- **Correction/prevention:** Started Metro hidden with separate host stdout/stderr logs, then verified its host status endpoint and restored USB reverse on port 8085 for device `9cb47ed9`. Verify a server through its status endpoint rather than assuming a spawned helper or sandbox Temp path proves availability. No app data was changed.

## Replay trip controls appeared untappable or slow (2026-10-25)

- **Owner evidence:** The owner reported that trip-level Done/next could not be tapped, or responded so slowly it appeared not to respond. Host verification found a local Metro server and USB reverse available, but that does not prove an owner-visible interaction completed.
- **Cause/status:** The gallery correctly waited for outstanding local-media resolution and durable draft work before navigation, but its fixed header had no immediate acknowledgement while that wait ran. The exact device-side latency remains unmeasured pending the owner's reload and repeat.
- **Correction/prevention:** Done now changes to Saving and the fixed trip summary announces that acknowledgement immediately; repeated presses remain safely ignored without presenting a disabled control. The overview also explains why Update Replay is unavailable when no edit exists. Test the owner flow after each bundle refresh and treat host/ADB readiness only as delivery-path evidence, never as proof of a responsive device interaction.
- **Verification incident:** The first focused Jest command omitted this repository's required local cache argument and stopped before collecting tests with the known sandbox Temp-cache permission error. A follow-up search also used a PowerShell-incompatible wildcard path. Neither command changed product code or executed assertions. Rerun only with the ignored root `.jest-cache-codex` cache and use repository searches without shell glob assumptions.
- **Device correction:** The owner then reproduced a completed-looking save that stayed in the gallery. The initial feedback patch still coupled the visual transition to acknowledgement, which is correct for durable state but wrong for trip navigation. Done/Back now enter the overview first, whose fixed footer owns saving/retry/conflict status while the write completes. Regression coverage requires the overview before an intentionally held queue resolves; never use a host-only passing save queue to infer this interaction is responsive.
- **Regression-fixture correction:** The first full Replay suite after that navigation change still encoded the old gallery-only concurrency route. Two cases were updated to finish the pending selection from the overview; a retry fixture then expected its intermediate stage call rather than the final serialized call. The corrected assertion verifies the final selection is staged with the acknowledged revision. **Prevention:** when an async UI transition changes ownership of a pending task, update every fixture to follow the new surface and assert its eventual durable result rather than a transient queue position.

## Replay excluded-trip scope and custom-audio selection gaps (2026-10-25)

- **Owner evidence:** The owner excluded Da Nang and Lâm Đồng, committed Update Replay, and still saw them in the result. They also could not complete the local-audio selection flow.
- **Cause/correction:** Renderer/cache composition trusted a group eligibility projection instead of applying the separately persisted included-trip list as the final owner scope. The provider now derives one authoritative scoped group list for identity checks and replay rendering. Local-audio selection also allowed picker/read errors to escape before its fixed recovery UI, and copied tracks to a generic extension. The flow now catches the complete picker/copy/probe path, accepts the platform audio picker, copies a bounded file with its playable format suffix, validates the local copy, and visibly confirms custom audio before staging it.
- **Verification incident/prevention:** The first new screen test used eager Jest module-factory values, so its picker/media doubles were undefined before test initialization. The factory now delegates lazily; the focused audio test passes. When testing hoisted module factories, wrap mutable doubles in functions rather than exposing their initial binding directly.
- **Lint correction:** The first audio-file revision used `Date.now()` inside the component handler; mobile lint rejects that impure call under the React purity rule. The revision now uses a deterministic token derived from the private local URI plus the in-session counter. **Prevention:** use existing state/ref inputs or a pure local derivation for React-side identifiers; do not introduce clock/random calls merely to avoid a filename collision.
- **Patch-context incident:** The first combined source-and-playbook patch used an outdated helper signature and was rejected before any file changed. Re-read the live source and applied separate exact patches. **Prevention:** after a lint failure, use the reported live line context rather than reusing an earlier source snapshot.

## Replay working-draft save remains retryable on owner device (2026-10-25)

- **Owner evidence:** After a Replay edit, the overview displayed `Couldn’t save changes. Retry`; using Retry did not yet establish a durable working draft.
- **Status / investigation:** The UI correctly retained the owner's edits and did not claim an Update, but the provider intentionally collapsed the native write failure to the fixed `REPLAY_UNAVAILABLE` stage, so the exact device-side cause is not exposed in the product UI. A read-only host-authorized Android log query found no matching entry. Host inspection confirmed the reconstruction repository uses a fresh SQLite connection at initial open, but it still caches that handle for later writes.
- **Correction / next action:** Replay draft writes now discard only a recognized released SQLite handle after the failed write returns. They never repeat a mutation automatically; the owner's explicit Retry opens a fresh connection. Focused Replay/provider tests (76), TypeScript, lint, root check, and whitespace validation pass. Reload the owner device and confirm one Retry/save path before treating this as resolved. **Prevention:** never reveal raw storage errors to the owner or convert every write failure into a conflict; a native-handle recovery may prepare an explicit retry but must not replay an owner mutation itself.
- **Verification incident:** A focused Jest command again omitted the repository-local cache argument and stopped before test collection with the known sandbox cache permission failure. TypeScript and lint passed before that failure. **Prevention:** pass the ignored root `.jest-cache-codex` directory explicitly for every sandboxed focused Jest command; only the rerun can establish test behavior.

## Replay draft save queue produced visible latency (2026-10-25)

- **Owner evidence:** Small Replay edits such as adding media or excluding a trip showed Saving for too long, and a trip save could still fail.
- **Log result / cause:** A read-only Android log query found no Travel Life Replay or SQLite failure record; JavaScript diagnostics are not reaching that Logcat surface. Source tracing found every mutation immediately opened a full durable working-draft write, so successive taps could serialize behind prior writes and expose the queue as prolonged Saving.
- **Correction:** A short local coalescing window now retains only the latest edit intent and performs one durable write. Done, Update, Back, reset, and Retry flush that pending intent immediately, so no user navigation or commit loses a change. A failed initial write still has no acknowledged revision, so its coalesced Retry writes the latest intent without inventing a revision precondition.
- **Verification incident / prevention:** The first focused screen regression retained the former third-write expectation after coalescing and failed one assertion; it now verifies the one latest write and includes a rapid toggle + Done regression. Always distinguish an acknowledged working revision from a rejected write; optimize rapid edits by coalescing them, never by skipping the final durable save.

## Replay owner save still fails after queued-write repair (2026-10-25)

- **Owner evidence:** After the coalesced-write update, Replay changes still would not save and Update Replay remained unavailable.
- **Device-log evidence:** A process-scoped read-only log captured React runtime teardown/restart soft exceptions and unrelated media-player connection cleanup, but no Replay draft or SQLite write failure. The first probe incorrectly used PowerShell's read-only `$PID` variable and did not run the log filter; the corrected probe used `$appPid`. **Prevention:** use `$appPid` for Android process IDs and do not infer a Replay storage root cause from lifecycle warnings or unrelated native resources.
- **Correction in progress:** Replay working and committed draft writes now emit a closed, redacted `REPLAY_DRAFT_SAVE` diagnostic at start, completion, or failure. Failure classification preserves only a fixed reason category and Replay stage; it never writes the native error, SQL, IDs, locations, or media data. The provider regression verifies that a synthetic native detail cannot leak into the diagnostic. Reloaded-device reproduction is required to identify the actual category before changing storage semantics again.
- **Device collection boundary:** Immediately after the owner completed the requested fresh reproduction, ADB reported that device `9cb47ed9` was no longer attached, so the process-scoped replay diagnostic could not be read. No device data was accessed or changed. **Next action:** reconnect the device, then read the existing ring buffer before asking for another reproduction; do not infer a save cause from a transport disconnect.

## Replay draft writes raced another local SQLite writer (2026-10-25)

- **Owner/device evidence:** After reconnecting, a process-scoped, read-only Android diagnostic query captured two Replay working-draft writes that each waited the database busy timeout (30 seconds) and then reported the fixed `DATABASE_BUSY` category. This rules out media selection, local-audio choice, and Replay rendering as the immediate save failure. The exact lock holder is not identified from the redacted diagnostic.
- **Cause:** Unlike the existing Atlas and privacy routes, Replay working and committed draft writes did not wait for the foreground import or maintenance writer barriers before issuing their own SQLite mutation. React development-runtime reloads can also leave an earlier native connection alive until the application is fully closed, making the collision more likely during device testing.
- **Correction:** Both Replay draft-write entry points now wait for `whenImportIdle()` and `whenIdle()` before entering the native repository mutation. They retain the existing explicit-retry policy: a failed owner mutation is never repeated automatically.
- **Verification / next action:** Run focused provider/Replay tests, TypeScript, lint, root checks, and whitespace validation. The already-running development process may still hold a stale native connection, so owner validation requires fully closing and reopening the development app (without clearing storage), then changing one trip and selecting Done. Do not call this resolved until that owner-visible flow returns to the overview and permits Update Replay.
- **Verification incident:** The first typecheck after adding the writer-barrier regression failed because its delayed `inspect` test double resolved `void`, which violates the `PhotoAccessAdapter` permission contract. The test passed at runtime only because it did not consume the result. The fixture now resolves a valid permission snapshot. **Prevention:** keep deferred test doubles at the exact declared async return type; successful execution does not replace TypeScript validation.

## Replay Music and order had no explicit completion control (2026-10-25)

- **Owner evidence/cause:** Opening Music & order exposed only Back. Music/order changes were queued in the background, so the owner had no visible completion point and could reasonably conclude their choice was not saved.
- **Correction:** The settings header now follows `Back · Music & order · Done`. Done flushes the latest working-draft save before closing; it shows Saving while active and keeps the panel open with fixed recovery copy if persistence fails.
- **Verification/prevention:** A Replay-screen regression first asserted the missing Done control (red), then verifies it saves newest-first order, closes the settings panel, and leaves the trip overview visible (green). Every Replay subflow that changes durable working state needs an explicit completion action at the navigation level, not only a deferred background queue.
- **Patch incident:** The first combined code-and-documentation patch used stale project-state context and was rejected atomically; no file changed. The incident record was applied in a subsequent exact patch. **Prevention:** keep source and documentation updates separate after a task has multiple concurrent edits.

## Replay custom-audio choice was not visibly confirmed (2026-10-25)

- **Owner evidence:** After choosing local audio, the Music & order screen did not visibly identify the selected file. After Done, the overview showed a disabled Update Replay action, making the state look unsaved.
- **Log/source result:** Android initialized the selected AAC media path and no closed Replay draft failure was emitted for this attempt. The process log also contains a native activity-result null-pointer warning from platform picker delivery, so missing picker assets are treated as a rejected selection. The confirmed defect is UI-state ambiguity, not proof that the selected AAC file failed decoding.
- **Correction:** The settings panel now shows the selected audio filename after local validation, its overview row displays soundtrack plus oldest/newest order, and picker assets are null-safe before copy/probe.
- **Verification/prevention:** The custom-audio regression asserts filename confirmation, Done, acknowledged custom working-draft persistence, and an enabled Update Replay button. Review every media-picker flow for a human-visible selected state, explicit completion, and fixed failure state.

## Replay audio UI was edited but Android ran an old Metro bundle (2026-10-25)

- **Owner evidence:** After the audio-status correction, the owner still saw the former Music & order UI immediately after choosing a file.
- **Cause/evidence:** The development client used `localhost:8081`, whose USB reverse mapping was absent while the investigation initially inspected 8085. The 8081 endpoint had a stale transform. The first IPv4 bridge start failed because PowerShell split the Node `-e` payload, and a content probe incorrectly decoded an already-string HTTP body; neither affected product data.
- **Correction:** Replaced only the stale 8081 Metro server from this checkout with a cache-cleared localhost instance, restored the USB-only `tcp:8081` reverse, and supplied a localhost-only IPv4-to-IPv6 bridge because Metro bound `::1`. Force-stop/relaunch did not clear storage. Metro then recorded a fresh Android full bundle build (1,384 modules) from the current `src/app` root.
- **Prevention / next action:** Before UI acceptance, identify the client port, verify its reverse mapping and checkout, then require a fresh Android full-bundle record. The owner must now operate Music & order and see `Loading audio: filename` then `Loaded audio: filename`; server evidence is not visual acceptance.
- **Verification incident:** A follow-up source-map URL appended `.bundle.map` to the entry path, which Metro interpreted as a missing module and rejected. It did not modify the served bundle or device. **Prevention:** use the exact Metro source-map endpoint syntax or rely on the confirmed fresh Android bundle plus owner-visible UI; never treat a malformed diagnostic URL as evidence about the app module.

## Replay custom-audio metadata preflight rejected valid local choices (2026-10-25)

- **Owner evidence / closed diagnostic:** The owner still reported that choosing custom audio did not visibly load the file. Three new selection attempts each emitted `REPLAY_AUDIO_SELECTION START` followed by the fixed `UNKNOWN/REPLAY_ACCESS` failure, so the JavaScript runtime returned from the picker but rejected the choice before setting its UI state.
- **Confirmed cause:** The selection path required `munim-ffmpeg` to extract duration from the copied audio-only file before it could set `Loaded audio`. That metadata preflight is not required to establish that a bounded private copy exists, and it can fail for an otherwise usable local audio file.
- **Correction:** Selection now accepts a nonempty bounded private copy and immediately stages/shows it as loaded. Audio decode/encode validation stays in the only place that can prove the actual output—the Replay renderer. Closed, redacted `REPLAY_AUDIO_SELECTION` and `REPLAY_RENDER` completion/failure signals remain so a later renderer issue is distinguishable without paths, filenames, native errors, or media identifiers.
- **Verification incidents:** The first typecheck after adding the failure classification omitted its diagnostic import; it was corrected before validation. A companion source-inspection command addressed `apps/mobile` from inside that package and found no path; it changed no source. The first regression expectation assumed an initial working draft had a revision; the real first-draft precondition is `undefined`, so the assertion was corrected. Two initial Jest invocations did not use `--runTestsByPath`, so package test matching ran unrelated suites before the exact test was rerun. **Prevention:** typecheck immediately after adding a diagnostic dependency, resolve paths from the active package root, model first-write revision semantics exactly in tests, and use `--runTestsByPath` for a focused Jest path.
- **Verification / next action:** The regression makes the audio-only metadata probe fail and still requires the selected private copy to display and stage. The focused Replay screen suite passes 40 tests; mobile TypeScript and lint pass. The connected Android app was force-stopped and relaunched after restoring its USB-only Metro mapping, without clearing data. Require one owner selection -> Done -> Update Replay attempt before claiming device acceptance.
- **Host verification incident:** A sandboxed request to the localhost-only Metro route was denied at the socket boundary and could not inspect the bundle. The same read-only request was then run through the approved host boundary and confirmed the Replay route contains the audio-selection, loaded-state, and render diagnostics. **Prevention:** treat a sandbox localhost socket denial as an environment boundary, not a Metro or application failure; verify the exact route only through the authorized host read.
- **ADB recovery incident:** A first direct ADB query could not start its local daemon. It was restarted through the approved host boundary; the existing owner device was then listed, the USB `8081` reverse restored, and the development app force-stopped/relaunched without touching app data. **Prevention:** record a local ADB-daemon failure as transport recovery, not product evidence; reacquire the same device and restore the confirmed port before testing UI.
- **Port cleanup:** An earlier temporary Metro server on 8085 and its USB reverse remained after the app had moved back to 8081, creating avoidable ambiguity. The 8085 reverse and its confirmed `expo start --dev-client --port 8085` process were removed; only localhost Metro plus its localhost IPv4 bridge remain on 8081, and device reverse now lists only `tcp:8081`. **Prevention:** after a transport investigation, retire every non-current Metro port and verify both host listeners and device reverse mappings before asking for owner testing.

## Replay end-to-end save/loading review recurrence (2026-10-26)

- **Owner evidence/status:** Repeated trip edit/exclude/Done leaves saving awkward and Update Replay disabled; gallery and audio still feel slow. Open recurrence of the earlier Replay exclusion/database-busy incident. Current source confirms an unbounded promise queue and Update requiring idle, stage/commit waiting for whole import/maintenance transitions, and full native manifest rehydration per save. Native preview resolution now has six lanes but settles the page only after all lanes finish. The real device lock holder and current stage timings remain unknown.
- **Review outcome:** Proposed one edit session, bounded latest-snapshot scheduling, short owned transactions with foreground scheduling at safe boundaries, and reconciliation before retrying an unknown native write. Never treat a JS timeout as SQLite cancellation, release a live writer gate, or render unacknowledged edits. Full analysis and acceptance matrix: `_bmad-output/implementation-artifacts/replay-edit-flow-review-2026-10-26.md`. No production fix or device acceptance is claimed.
- **Verification incident:** Initial screen suite had 48 passes and one cache-open test exceeding the default five-second timeout. Rerun with warm cache and 15-second limit passes 49/49 (8.947 seconds suite duration); timeout cause remains unisolated. Root check passes. Report both runs and do not call increasing a test timeout a product fix.
- **Read-only tooling incidents:** Reading `.git` as a file, passing a wildcard file path to Windows rg, and assuming `.git/config.worktree` and `database/native-schema.ts` existed caused lookup errors. Correct by discovering names/types first and passing directories to rg. Git status also failed with explicit git-dir/work-tree; cause unestablished, so checkout cleanliness is not claimed. No reset/stage/commit/push was attempted. Mock authoring briefly duplicated class attributes in its button helper; corrected before syntax/state verification, with no mobile source change.
- **Prevention/next action:** Capture fixed, privacy-safe operation stages for writer queue, transaction acquisition, commit and readback; separately measure first visible thumbnail and audio copy. Test held writer, late commit, rapid cross-trip edits and Restore during debounce. Close only after the exact owner flow completes on device. Keep documentation/source-test evidence separate from native timing and UX acceptance.

### Replay save/loading recurrence — detailed planning follow-up (2026-10-26)

The open owner-reported save/Update and loading incident now has an executable-scope planning contract at `_bmad-output/specs/spec-replay-edit-save-and-responsiveness/SPEC.md`. It explicitly distinguishes public outcome-unknown settlement from actual native transaction ownership, retains excluded-trip automatic preferences separately from included render automatic groups, and adds Restore timer/callback fencing and operation receipt reconciliation. Thirty acceptance cases cover the recurrence and adjacent boundaries. Planning checks and root check pass; no mobile fix, current lock attribution or device acceptance is claimed. Prevention is to complete owned-writer/session/readback safeguards before changing Update gating and to preserve both initial timeout and later passing test evidence.

### Replay build Git inspection boundary (2026-10-26)

During authorized implementation startup, sandbox git status again returned must be run in a work tree, while rev-parse identified the correct checkout. Approved read-only host execution succeeded and exposed the pre-existing dirty Replay/import/maintenance work. No checkout cleanliness is assumed. The full canonical baseline is 790a1fda7695ecd917a890d18d742aa11edd5313; an exact source/docs snapshot and dirty diff were saved in the task workspace before implementation. Prevention: use the verified host boundary for Git status/diffs here, preserve unrelated dirty changes, and review task changes against the saved file snapshot as well as HEAD. No reset, stage, commit or push is authorized.

## Replay implementation tooling and verification corrections (2026-10-26)

- **Evidence/cause:** One read-only search used Bash brace expansion in PowerShell and failed during parsing. A separate read-only API probe assumed an absent expo-media-library next/Asset.ts file. Neither changed product data. Discover files with rg --files and pass explicit directories in PowerShell.
- **Patch incident:** An exact-text transaction conversion missed CRLF line endings in two Replay methods, leaving unmatched try blocks. Immediate TypeScript validation rejected the intermediate source. The correction used a CRLF-aware anchored replacement; no build/device execution occurred from the rejected source. Prevention: assert every replacement anchor and run syntax/type validation directly after structural patches.
- **Test compatibility:** New transaction mocks inferred zero-argument signatures, and the new reconciliation method initially became required for legacy provider mocks; commit return inference narrowed void to undefined. Typecheck exposed these before acceptance. Corrected explicit mock signatures, optional repository-port compatibility and explicit Promise<void>. TypeScript passes after correction; broader checks remain pending until recorded below.
- **Status:** Source-level corrections verified by TypeScript. The native save/lock incident and physical acceptance remain open; these host corrections do not establish device behavior.

## Replay receipt-schema validation fixture correction (2026-10-26)

- **Symptom/evidence:** The first full mobile run after adding schema v37 failed eight stale assertions expecting v36, then one checkpoint fixture returned an empty row because its positional mock no longer matched the added receipt-layout read. No production path failed; SQLite contract checks remained green.
- **Cause/correction:** Receipt layout verification adds `working_session_id`, `working_edit_version`, and a receipt-table probe to the current-schema open path. Tests now model the complete v37 layout and select mocked rows by query rather than fragile call order.
- **Verification/prevention:** The focused import repository suite, full mobile suite, TypeScript, SQLite contract suite, and root check must pass before this is closed. When a migration adds an open-time schema guard, update current-schema fixtures and use query-aware mocks for unrelated read assertions.

- **Documentation lookup incident:** A final BMAD-review read assumed a `steps/` child path that was absent from the rendered artifact and failed before modifying files. A subsequent `rg --files` confirmed no files at that stale rendered location. **Prevention:** rediscover ephemeral rendered-skill paths before reading follow-on steps; this does not affect implementation or validation evidence.

## Replay Android launch opened Expo Go instead of the installed development build (2026-10-26)

- **Owner evidence:** The owner reported that Travel Life could not be opened after the Replay implementation work.
- **Cause/evidence:** The device launch target was `host.exp.exponent` (Expo Go), which does not contain Travel Life's compiled native modules. Its runtime log reported missing NitroModules and the MapLibre camera native module; downstream router errors were cascading failures, not route-export defects.
- **Correction/verification:** Restored the USB-only Metro reverse on port 8081 and launched the already-installed `com.anonymous.travellife` development build. The focused activity is now its `MainActivity`; its process initializes native image/video components and starts the Welcome video without the prior missing-native-module errors. No app data was cleared or changed.
- **Prevention:** For device validation, confirm both the foreground package and the required native build before interpreting JavaScript errors. Never open a native-dependent Travel Life checkout in Expo Go; launch the installed development client through its application package.
- **Recurrence (2026-10-26):** The owner could not reopen Travel Life because the device's `tcp:8081` USB reverse was absent and the development client was sitting on its prior error activity. Metro was healthy on host loopback. Restored only the USB reverse, force-stopped/relaunched the installed development package without clearing data, and confirmed the native app activity resumed with MapLibre loading and no fresh missing-native-module or JavaScript fatal record. Keep the USB reverse check as the first launch diagnostic before changing application code.

## Replay settings acknowledgement follow-up (2026-10-26)

- **Owner evidence:** A copied song could still make the next `Done` look complete while its working-draft save remained pending; Update Replay then appeared disabled. Replay staging also waited for whole import/maintenance lifecycles even though its native foreground transaction turn can safely queue behind only the actual writer.
- **Correction:** Local-audio selection now acknowledges a validated bounded private copy without a metadata decoder preflight. Music/order `Done` stays open as `Saving audio` until its exact staged draft succeeds, or shows an inline retry without applying/closing. Replay draft writes now enter the existing foreground owned-transaction gate directly rather than waiting for unrelated lifecycle completion.
- **Verification incident:** The first focused screen run retained assertions for the removed decoder probe and assumed Update was not mounted behind the open modal; the provider regression still expected the obsolete maintenance-lifecycle wait. All were corrected to assert the new acknowledged-save contract. A source search was also run from the mobile package with an already-prefixed path and found no files. **Prevention:** run paths relative to the current package root and update assertions whenever a foreground scheduling contract replaces a broad lifecycle wait.
- **Verification:** Replay screen and provider suites pass 95 tests; mobile lint and TypeScript pass. Owner device validation remains required for actual save/render latency and new-video playback.

## Replay full mobile validation cache boundary (2026-10-26)

- **Evidence/cause:** The first `apps/mobile npm run check` run attempted Jest's sandboxed temporary transform cache and failed before executing every suite with Windows `EPERM` rename errors. This was a host cache permission boundary, not a source or test regression.
- **Correction/prevention:** Rerun Jest using the repository-local `.jest-cache-codex` cache, then retain the normal SQLite, typecheck, lint and Doctor checks. Always pass the local cache directory for full Jest validation in this Windows sandbox; do not interpret a transform-cache failure as failed product behavior.

## Replay Update navigation escape (2026-10-26)

- **Owner evidence:** Tapping Update Replay returned the owner to Audit before a replacement video appeared.
- **Initial correction disproved:** Route-retention protection was added for Update rendering, but the owner reproduced the issue again. Clean device log then showed no renderer start or crash; it recorded `REPLAY_DRAFT_SAVE` failing with fixed stage `REPLAY_STALE`.
- **Verified cause/correction:** A visible working draft can survive a JS/dev-runtime reload while its durable native working revision is newer. Commit used the older in-memory revision and rejected an otherwise identical owner draft, so rendering never started. Commit now accepts only an exactly matching durable working composition and uses that durable revision as its CAS baseline; a content mismatch remains a closed conflict and cannot be overwritten.
- **Implementation incident/prevention:** The first patch tried to modify the same source file twice and was rejected before changing it; retry with one operation per file. Keep native-navigation protection active for every in-flight owner-visible render, require log evidence before attributing an Audit return to navigation, and retain the runtime-reload commit-revision regression. Physical owner confirmation remains required.

## Replay custom-audio Done stale draft recurrence (2026-10-26)

- **Owner/log evidence:** A new audio file copied and reached `REPLAY_AUDIO_SELECTION COMPLETE`, but tapping Done started one or more Replay draft saves that each returned fixed stage `REPLAY_STALE`. The audio sheet therefore could not acknowledge its settings.
- **Cause/correction:** Staged draft writes rehydrated the durable working revision only when the native opaque mapping was absent. A JS/runtime revision can be stale even when that mapping remains, so an otherwise valid audio or ordering edit repeatedly failed CAS. Staging now always reads the current durable working revision when it has an expected revision; the later Update commit still accepts it only when the working composition exactly matches the visible owner choice.
- **Verification/prevention:** Provider regression covers both retained mapping and stale JS revision; focused provider suite passes 47 tests with mobile TypeScript/lint. Audio copy success is distinct from draft-save acknowledgement; always inspect both fixed diagnostic operations before diagnosing audio import.

## Replay stale working-branch recovery (2026-10-26)

- **Recurrence/evidence:** The retained-mapping revision rebase alone did not unblock the owner: clean log again showed audio selection complete followed by repeated staged `REPLAY_STALE` outcomes. This establishes a stale native working branch beyond the JS revision mismatch; the renderer is not involved.
- **Correction:** On one stale stage failure only, the provider rereads scope. If and only if snapshot/privacy revision are unchanged, it clears the disposable working branch and stages the exact currently visible owner composition once with no old CAS revision. A changed scope, missing repository port, reset failure, or second stage failure remains a normal closed failure. No journey, committed Replay, prepared video, or copied audio file is cleared.
- **Verification/prevention:** Focused provider suite now passes 48 tests with the stale-working-branch recovery regression, plus mobile TypeScript/lint. Require device confirmation before considering the audio Done flow fixed.

## Replay audio-save explanation test correction (2026-10-26)

- **Evidence/correction:** The first screen-test mock for the closed stale-save reason used a TypeScript parameter property inside a Jest module factory. Jest rejected it during transform as an out-of-scope factory reference; no application code ran from that failed suite. The mock now assigns the reason from a permitted mock-prefixed constructor argument.
- **Prevention:** Keep Jest factory mock classes plain and avoid parameter-property transforms inside the factory; rerun the screen suite before claiming the new error explanation verified.

## Replay stale recovery across Fast Refresh (2026-10-26)

- **Evidence/cause:** The same device stale-save recurrence persisted after recovery code was added. The native error can cross a Fast Refresh/runtime boundary, making `instanceof ReplayDraftStaleError` false; the save layer then wrapped it before working-branch recovery ran.
- **Correction:** Classify stale draft failures by the fixed `REPLAY_DRAFT_STALE` code as well as same-realm class identity. The recovery still receives no raw native error. The Music sheet now explains a scope change as “Journey List changed; reopen Edit,” distinguishes a reconciling draft, and otherwise tells the owner that the copied audio is ready but its settings have not saved.
- **Verification/prevention:** Replay screen and provider suites pass 100 tests, with mobile TypeScript/lint. Treat cross-runtime domain errors as closed-code values at public layer boundaries, never as message strings or stack data.

## Replay custom-audio stale diagnosis and owner copy (2026-10-26)

- **Owner/log evidence:** The latest device attempt again recorded audio selection complete followed by a single draft-save stale failure; no renderer start, audio import failure, or application crash occurred. This is a local Replay draft persistence issue, not an unsupported audio file.

## Root test runner received mobile Jest flags (2026-10-26)

- **Symptom/evidence:** While validating the Replay stale-recovery diagnostics, `npm test -- --runInBand --cacheDirectory .jest-cache-codex ...` was invoked from the repository root. The root Node test runner treated `.jest-cache-codex` as a test file and failed with `MODULE_NOT_FOUND`.
- **Cause:** Mobile Jest arguments were applied to the root foundation test script instead of the `apps/mobile` Jest script.
- **Correction/verification:** Re-ran the focused provider suite from `apps/mobile`; all 48 tests passed, followed by mobile TypeScript and lint checks.
- **Prevention:** Read the owning package's test script before forwarding framework-specific flags; root and mobile test runners use different CLIs.
- **Recurrence (M4.5):** A combined root command again forwarded the mobile Jest cache flag to root `npm test`, producing the same false test-file `MODULE_NOT_FOUND`; it also attempted root `typecheck`/`lint` scripts that do not exist. The already completed root `npm run check` remained valid, while the affected mobile checks were rerun from `apps/mobile` without forwarding those flags to root. **Strengthened prevention:** run root `npm run check` alone; run `npm test`, `npm run typecheck` and `npm run lint` only from `apps/mobile` when validating mobile code. Never chain commands across package roots unless every command has been confirmed in that package's `package.json`.

## Replay stale recovery reused an obsolete receipt identity (2026-10-26)

- **Owner/log evidence:** After audio copy completed, recovery reached manifest read, working-branch reset, and replacement-stage start twice, but never stage completion. The owner-facing sheet correctly retained the audio selection and reported that it was not saved.
- **Evidence correction:** Receipt reuse was a source hypothesis, not a verified device cause. The next device run failed again after reset with a fresh receipt identity. `REPLAY_RECOVERY_STAGE` followed by `REPLAY_STALE` does not distinguish receipt rejection from an earlier mapping guard; do not cite this entry as proof that receipts caused or resolved the owner incident.
- **Correction:** The recovery replacement now creates a fresh operation ID while retaining the same editor session and edit version, so it is still one owner-visible edit and cannot overwrite a different session.
- **Verification/prevention:** A regression test proves the recovery write receives a different receipt ID and preserves session/version; focused provider suite now passes 49 tests, with mobile TypeScript and lint passing. Treat a changed recovery payload as a new idempotent operation, never a retry under an old receipt key.
- **Correction:** The bounded stale recovery now recognizes the stale code even when the native error has a prior runtime identity. The Music sheet explains scope change, draft reconciliation, or an out-of-date local edit state and explicitly says that the audio was copied but not yet saved; it does not claim a generic audio failure.
- **Verification:** Focused Replay/provider tests pass 100, mobile typecheck/lint pass. Full mobile check was invoked with the repository-local cache policy; physical confirmation of the updated recovery remains required.

## Android Replay retest launch boundary (2026-10-26)

- **Evidence:** After the source checks, the local ADB client could not reconnect to its server (`cannot connect to daemon`) before listing devices, checking the USB reverse, or restarting the development client. No app process or device data was changed by that failed command.
- **Recovery/recurrence:** An approved host-side retry reconnected to device `9cb47ed9`, confirmed `tcp:8081` USB reverse, and launched `com.anonymous.travellife` without clearing storage. A later sandboxed read immediately hit the same daemon-connect boundary, so the foreground UI was not independently re-read. Treat the launch as dispatched, not behavioral acceptance.
- **Next action/prevention:** Re-establish the ADB server/device connection, confirm `tcp:8081` reverse, then relaunch only the installed development package without clearing app storage before owner retest. Do not infer the device result from host checks.

## Replay scene-only Journey List groups were missing from the writer map (2026-10-26)

- **Symptom/evidence:** Custom music Done and consecutive edits continued failing after fresh-receipt recovery. A new real SQLite regression using the actual reconstruction repository reproduced `REPLAY_DRAFT_STALE` on a valid complete draft containing one reconstructed journey and one visible owner-entered scene, before any stage SQL ran.
- **Verified cause:** Manifest generation emitted the owner-entered group but populated `displayedReplayGroups` only after finding a reconstructed support/date row. Manual scenes have no such row. Inclusion validation rejected their emitted key; exclusion could not persist their identity, so reload could restore them. Provider-only mocks did not exercise that native mapping invariant. This is a confirmed host reproducer; matching the original device failure still requires refreshed native evidence.
- **Correction:** Register each visible manual scene using its stable namespaced manual identity before the media-only path. Reconstructed groups use the canonical Journey List mapping even without a support/date interval row. Preserve all visible scenes, media, soundtrack and exact inclusion; do not fabricate evidence for manual scenes. Writer guards now carry closed fixed categories for scope, map, memory, group, automatic subset, receipt, revision and working branch, translated into fixed diagnostic reason codes without private values.
- **Verification:** The new SQLite regression failed before the fix and passed after it. It stages custom music with the manual scene included, excludes it, recreates the repository, edits another trip, commits, verifies exact readback, then commits that scene alone. The complete synthetic SQLite suite passes 91/91; mobile TypeScript and lint pass. A provider diagnostic regression also fails before its fixed-category addition and passes afterward; broader checks/device evidence are recorded in the delivery record.
- **Prevention:** Every group emitted by a manifest must have a stable persistence identity regardless of whether it has media or observed reconstruction rows. Exercise actual repository stage/commit/readback with mixed manual/reconstructed journeys and repository restart; mocks alone cannot establish persistence. Attribute a device failure to a specific guard only from fixed guard evidence or a matching repository reproduction, never from the last recovery checkpoint alone.
- **Device/verification boundaries:** Source edits during an active development render caused Fast Refresh and a transient empty Replay view; its cause is not yet established. A clean runtime opened through the development-client Metro URL, followed by Atlas hydration, restored the existing Journey List and playable Replay without clearing data. Direct cold app-route intents may open the development launcher; connect the development client before navigating. ADB screenshots are available but touch injection was rejected with `INJECT_EVENTS`, so owner-operated Done/Update validation is required. Do not bypass the device permission or treat automatic initial playback as update acceptance.
- **Host-check incidents:** Additional read-only searches assumed missing screen/test paths before the actual `src/app` inventory was consulted. Expo Doctor initially failed on sandbox registry DNS and passed 21/21 through the approved host network boundary. One independent edge review failed at model capacity and was retried; that failed attempt supplies no review evidence.
- **Read-only inspection incidents:** Two initial searches assumed an absent reconstruction-repository test filename or passed a wildcard path to `rg` in PowerShell; neither inspected the intended tests. Corrected by listing actual test paths and searching the directory directly. An initial playbook patch also targeted a heading from the project-state recap instead of the actual playbook and applied no change; reread the exact playbook tail before updating it. Prevention: inventory test files first, pass actual directories rather than wildcard paths, and verify the target document heading before an exact patch.

### Review correction: preserve CAS conflicts and bound receipts (2026-10-26)

Review found that generic stale recovery could reset a competing working branch and that stage preflight silently substituted its durable revision. Removed both behaviors: hydrate only a missing mapping, preserve the requested expected revision, and surface a stale outcome after exactly one mutation attempt without automatic reset/retry. Provider regressions now assert these boundaries. The manual-scene mapping repair remains intact.

The same review found current-session receipts were exempt from pruning and grew without bound. Receipts are now capped at 32 settled entries, explicitly retaining the just-written receipt independently of timestamp ties. A real SQLite regression failed on the old count and passes with the cap; it also proves identical stage/commit operation retries do not change durable state, changed payload/session/version reuse fails with unchanged rows, and the latest operation reconciles after 100 edits. This is synthetic persistence evidence, not device acceptance.

### Review correction: Check again must read a settled durable receipt (2026-10-26)

Review found `checkAgain` returned the same unknown status without repository reconciliation, while the repository read could inspect its shared connection inside an uncommitted writer. The session now retains only its active mutation identity and passes that exact operation to bounded Check again reconciliation. The repository reads the receipt and current revisions within the owned transaction gate, after the preceding writer settles. Only its committed acknowledged result releases the logical active scheduler entry and starts the latest pending snapshot. Identity/epoch checks ignore late callbacks from the old write; an unknown or held read keeps ownership blocked, and repeated checks do not enqueue duplicate reads or mutations. Fenced epochs remain conservative until original native settlement.

Verification: new scheduler/session tests were RED before the integration and GREEN afterward; the focused provider/scheduler suites pass 58 tests. A real SQLite test holds COMMIT before settlement and proves receipt SELECT does not run until that writer completes; that case plus receipt retention/idempotency pass 2 targeted SQLite tests. These checks establish synthetic ownership/reconciliation behavior, not native-device recovery acceptance.

## Replay thumbnail ownership and invalidation review correction (2026-10-26)

- **Evidence/cause:** Review found the decoded thumbnail cache capped each entry at one pin and any unmount cleared that pin. Two mounted consumers could therefore share a handle that became evictable after only one unmounted. Privacy/lifecycle boundaries also did not invalidate decoded thumbnails, and invalidation retained old active jobs by URI. A focused regression reproduced premature shared-handle eviction before the correction.
- **Correction:** Pins now count mounted consumers, optional handle identity fences stale cleanup, and invalidation notifies mounted subscribers, clears deduplication records and releases cached handles while native calls retain their lanes until settlement. Provider lifecycle stop, disconnected/deleted state, teardown and privacy mutation invalidate the cache. Mounted-poster clearing is implemented with the screen integration.
- **Verification:** Injected-decoder tests cover six decode lanes, one queued page, deduplication, memory budget/LRU, shared pins, active/queued invalidation and new-scope requests. Thumbnail plus provider suites pass 54 tests; mobile TypeScript passes. Device behavior remains unverified.
- **Prevention:** Exercise the actual cache with held decoder promises and multiple mounted owners; screen mocks cannot verify native scheduling, memory ownership or privacy invalidation.
- **Review command incident:** A Windows `rg` search passed a wildcard filename argument and failed before inspecting that path. Repeated the search with actual directories; no absence claim relied on the failed search. Use `rg` directory paths plus glob options on PowerShell.

## Replay settings acknowledgement and delayed-selection review defects (2026-10-26)

- **Evidence/cause:** Review found Music Done staged mutable sheet refs, then reread them after awaiting acknowledgement while Back/default/order/file controls remained active. Sheet cancellation could delete the candidate already referenced by that native write. Delayed single-media and Select all resolution also lacked the restore task-epoch check. Changed-scope session hydration threw directly from a React effect when an old save was queued.
- **Correction:** Music Done captures one immutable track/order pair, transfers candidate ownership to the session before enqueue, and guards/disables sheet changes and Back during acknowledgement. Both selected-media paths check task epoch after native awaits and before staging. Scope hydration fences old selected work and exposes recovery instead of throwing. Thumbnail consumers subscribe to authorization invalidation, blank their image and unpin only their exact held handle.
- **Verification:** Replay screen suite passes 54 tests, including disabled/mutation-resistant settings while a save is held and delayed single/Select all completions after a restore fence. Scheduler/session scope regression passes with the existing scheduler suite (6 tests); mobile TypeScript passes. Device behavior and decoder/audio output remain unverified; no metadata decode was added to the import readiness path because the later owner direction prioritizes bounded copy readiness.
- **Prevention:** Ownership transfers at enqueue, not acknowledgement; asynchronous UI continuations must capture immutable values and verify their session epoch after external awaits. Test Restore and settings changes while native work is deliberately held.
- **Review-command incident:** A read-only search passed wildcard filename suffixes directly to rg on PowerShell, which rejected them; the follow-up searched the real spec directory and established the contract. No result was inferred from the failed search. Enumerate paths or search a concrete directory on Windows.

### Thumbnail delivery lease follow-up (2026-10-26)

- **Reproduced:** Two native decodes settling in one turn with a one-handle budget evicted the first decoded handle before its immediate promise consumer could pin it. A queued decode could similarly evict a cache hit before its delivery callback. Both new regression assertions failed against the first cache correction.
- **Cause/correction:** Entries were inserted with zero pins while promise delivery was still pending. New decodes and cache hits now hold a temporary delivery lease for two microtasks, allowing immediate consumers to pin while keeping unclaimed leases finite. Eviction respects both mounted pins and delivery leases; rejected incoming handles are released without exceeding the configured budget.
- **Verification/prevention:** All six injected-decoder tests and mobile TypeScript pass. The new tests resolve decoders in the same turn, exercise cache-hit delivery, assert no released handle reaches its consumer, and confirm later unpin permits eviction. Keep same-turn promise ordering in cache ownership regressions.
- **Follow-up error-copy correction:** Scheduler outcomes intentionally discard native error objects, so the Music error mapper must classify its closed failed/conflict/unknown outcomes instead of describing every failure as stale. Added fixed distinct storage-failure, local-draft-mismatch and still-confirming copy with direct outcome tests.
- **Follow-up verification incident:** A PowerShell string replacement containing a typographic apostrophe failed parsing, leaving test imports and old copy expectations unchanged. The immediately launched suite consequently failed three test-only assertions (missing outcome-error import and two old copy strings). Applied exact patches for the import and expected copy; rerun result recorded separately. Prevention: use exact patch edits for Unicode prose and await successful test-edit completion before validation.
- **Follow-up verified result:** Corrected outcome-copy tests and full Replay screen suite pass 54/54. Trip failure copy now directs retry to the overview, whose Retry control actually enqueues a new save; trip Done remains immediate navigation and makes no false retry promise.

### Thumbnail provider bootstrap coupling (2026-10-26)

- **Full-suite incident:** The mobile aggregate test run exposed router-tree registration failing because the newly imported thumbnail service statically initialized `expo-video` through the provider; the router harness had no native VideoPlayer prototype. The previous focused provider/thumbnail tests did not expose this coupling.
- **Correction:** Keep the VideoThumbnail import type-only and load `expo-video` inside the actual video decode branch with dynamic import. Photo decoding and provider bootstrap no longer initialize the native video player module.
- **Verification/prevention:** Router-tree and thumbnail suites pass seven tests; mobile TypeScript passes. Include router-tree registration when adding shared native modules to the application provider. Full-suite success remains a separate aggregate result.

## Share Replay trip-selection validation path mistake (2026-10-27)

- **Evidence:** Two read-only commands were run from `apps/mobile` using repository-root `apps/mobile/...` and `docs/...` paths. Both reported missing paths before they inspected source or the playbook; no application file or device state changed.
- **Correction:** Re-ran source and policy reads using paths relative to the mobile package (`src/...`, `../../docs/...`). The focused screen suite then exposed only duplicate test labels in the synthetic two-trip fixture, which was corrected by making each trip card's accessible label include its visible position.
- **Prevention:** Before a package-scoped command, resolve every relative path from that package's working directory. For multiple visually similar trip cards, include a stable visible position in the accessibility label and test it.
- **Validation recurrence:** A later combined mobile command used `npm run check`, whose package script runs Jest without the mandatory local cache argument. The aggregate suite failed at the known sandbox `EPERM` transform-cache rename before collecting tests. The focused screen and renderer suites were already green with `.jest-cache-codex`; root foundation validation must be run separately from the repository root. **Strengthened prevention:** never use the mobile aggregate `check` script in this sandbox; invoke focused/mobile Jest with `--cacheDirectory .jest-cache-codex`, and invoke only the root `npm run check` from the repository root.
- **Race-regression test correction:** The first late-subset cancellation assertion searched broad private-Replay copy and matched both the screen title and panel title. It did not indicate a runtime regression. The test now waits for the unique Share Replay action before asserting the late temporary artifact was discarded. **Prevention:** use a unique accessible action or role when asserting a state return; broad repeated presentation copy cannot establish lifecycle state.
- **Audit recurrence:** A post-implementation screen-test command again combined a repository-root package path with an `apps/mobile` working directory and omitted `--cacheDirectory`; its package read failed and Jest stopped at the known sandbox `EPERM` before collecting tests. The command was rerun from `apps/mobile` with `--cacheDirectory .jest-cache-codex`; all 62 screen tests passed. **Strengthened prevention:** after changing package-local code, use package-relative paths and make the local Jest cache flag part of the first command, not a recovery step.
- **Provider-test audit recurrence:** A combined verification command named nonexistent `src/photo-access/__tests__/provider.test.tsx`; Jest therefore collected only the Replay screen suite and could not establish the provider regression. Inventory identified `src/components/__tests__/photo-access-provider.test.tsx`; its explicit cached rerun passed 52 tests. **Strengthened prevention:** inspect the runner's matched-suite summary and inventory actual test paths before treating a multi-suite command as evidence.

## Share Replay review test label mismatch (2026-10-27)

- **Evidence:** The first new card-only screen regression failed because its expected accessibility label omitted the existing generated trip suffix (`Card-only trip trip 1`). The rendered control and implementation were present; no product/runtime failure was observed.
- **Correction/prevention:** Updated the assertion to the exact accessible label and reran the focused cached screen suite successfully (69/69). Inspect a failed rendered accessibility tree before changing production behavior for a test-only selector mismatch.

## Share Replay provider test permission typing (2026-10-27)

- **Evidence:** The first provider permission-revalidation regression inferred its mocked `inspect` result as only the initial `full` literal, so the later synthetic `denied` result failed mobile TypeScript before validation.
- **Correction/prevention:** Replaced the narrow inferred mock with an explicitly `Promise<PermissionSnapshot>`-typed inspector; rerun TypeScript before describing the provider regression as complete. Keep permission mocks typed to the complete closed scope union when a test changes access state.
