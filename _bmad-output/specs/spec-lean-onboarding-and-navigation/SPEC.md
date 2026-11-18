---
id: SPEC-lean-onboarding-and-navigation
companions:
  - experience.md
  - automation-and-state.md
  - implementation-and-diagnostics.md
  - acceptance.md
  - ../../../docs/product/design-system.md
  - ../../../docs/decisions/0003-library-access-default.md
  - ../../../docs/decisions/0004-background-maintenance-in-mvp.md
  - ../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
  - ../../../docs/decisions/0011-prototype-screens-as-product-ui.md
  - ../../../docs/decisions/0014-lean-self-serve-replay-editor.md
  - ../../../docs/decisions/0015-private-multi-source-travel-history.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources: []
---

# Lean onboarding and intuitive navigation

Date: 2026-10-29 (Asia/Bangkok). Detailed specification; runtime implementation
and physical-device acceptance remain pending. Derived from the owner's request,
the preceding BMAD party discussion and current source inspection. This spec and
its companions are the scoped delivery contract; they do not establish that the
proposed behavior exists. Later explicit decisions override historical wording
in adopted documents, including the hosted-sharing deferral.

## Why

New users currently navigate Welcome, Trust, photo access, manual metadata import
and a separate Atlas action before seeing their journeys. They must interpret
technical controls that the app can coordinate. Replace that friction with a
clear choice of photos followed by autonomous, recoverable processing inside
Atlas. Returning users should immediately recognize where they are, find their
history and return from a task without losing their place.

## Capabilities

- **CAP-1**
  - **intent:** Users enter the appropriate fresh or returning experience without repeated setup.
  - **success:** Fresh local use follows Welcome → photo choice → Atlas; returning, skipped and migrated users open Atlas, while safe explicit destinations retain precedence. A failed bootstrap never presents a false new-install state.
- **CAP-2**
  - **intent:** Users choose the photos used to create their Atlas in one understandable action.
  - **success:** A successful authorized choice starts processing without Start import, a separate counting step or View Atlas; cancellation, denial and empty selection start no source work. Picker selection never expands into library access.
- **CAP-3**
  - **intent:** Users can leave a screen and recover interrupted work without managing technical stages.
  - **success:** One scoped run survives screen navigation, resumes only compatible authorized checkpoints, honors explicit pause and fences changed authority/access. Repeated taps and app resumes do not create duplicate writers.
- **CAP-4**
  - **intent:** Users understand preparation and recognize an honest first result.
  - **success:** Atlas shows nonblocking measured or indeterminate progress, then a verified durable result or useful sparse state. Completion neither steals navigation nor resets an existing camera, filter or selection.
- **CAP-5**
  - **intent:** Users navigate Atlas, journey details, Replay and settings with predictable returns.
  - **success:** Atlas is home; Map/Timeline are views. Contextual Back retains valid exploration and edit context, and root Back never reopens onboarding. Labeled Settings and Replay entries are visible in their relevant states.
- **CAP-6**
  - **intent:** Existing account owners can find sign-in and recover history without blocking local use.
  - **success:** When account capability is enabled, Welcome exposes sign-in and Settings exposes Account and sources. Login, consent, restore and local-source enrollment retain separate existing boundaries; none silently uploads or replaces local history.
- **CAP-7**
  - **intent:** Users can opt into continued updates after seeing value.
  - **success:** A dismissible post-import invitation or Settings control enables eligible recurring checks explicitly. Previous choices persist, exact picker scope is not widened, and scheduler restrictions are shown without blocking Atlas.
- **CAP-8**
  - **intent:** Users recover from unavailable access, sparse evidence or processing failure with little explanation.
  - **success:** Each state in the experience matrix has one task primary action and concise copy. Counts, provenance and detailed controls remain reachable without occupying the default onboarding surface.
- **CAP-9**
  - **intent:** Users reach private Replay and deliberate sharing without technical preparation steps.
  - **success:** One explicit Replay action uses the existing prepare/play flow; onboarding does not eagerly render video. Committed choices, soundtrack and order persist, and sharing retains empty-first selection, exact preview and explicit OS sharing.
- **CAP-10**
  - **intent:** Users operate the lean interface with large text, screen readers and reduced motion.
  - **success:** Essential controls have visible labels, accessible states and reachable targets, and loading/recovery never depends on animation or color. Welcome retains its silent montage, pause control and poster fallback.
- **CAP-11**
  - **intent:** Support can identify the failing source boundary without exposing personal evidence.
  - **success:** New orchestration paths follow the closed diagnostic map, preserve one action correlation across layers and pass forced-failure/redaction checks before device validation.

## Constraints

- Apply Living Atlas and its lean UX amendment. Replace the standalone Trust and technical progress steps with contextual access explanation and Atlas status; retain their privacy and recovery purposes.
- Use the existing native permission, import, reconstruction, persistence and maintenance boundaries. A navigation marker cannot authorize a scan; an OS grant cannot imply sync, AI processing, publication or recurring-update enrollment.
- Preserve active local/account authority, durable corrections, exclusions, manual journeys, source boundaries and committed Replay semantics. No automatic reconnect, restore, delete, permission expansion or local-to-account upload.
- Background execution is bounded and scheduled by the OS. Persist safe progress and recover on foreground; never promise completion after force-quit or a fixed update cadence.
- Show only currently authorized, durable history. No fabricated journeys, route geometry, inferred full-life coverage, fake percentages or successful completion before readback.
- Keep hosted sharing deferred. Preserve the local exact-preview/native-share route and current account feature gates.
- Produce privacy-safe diagnostics at the existing mobile console boundary. Never log media references, paths, labels, coordinates, tokens, raw exceptions or onboarding payloads.
- Preserve the dirty checkout and unrelated M6/M7 work. This task creates a spec and documentation evidence; app code, deployment and account configuration are outside this invocation.

## Non-goals

- Changing trip detection, evidence membership, home-learning algorithms or reconstruction accuracy claims.
- Building a new account protocol, cloud connector, background execution service, video renderer, analytics service or push-notification channel.
- Redesigning the map, gallery, Replay editor or share composer beyond entry points and context preservation required here.
- Adding a tab bar, tutorial carousel, mandatory signup, Home-base wizard or another approval chain.
- Shipping Vietnamese localization; Vietnamese discussion and English product copy remain separate.

## Success signal

On fresh Android and iOS installations, a user reaches their first verified Atlas
after tapping the Welcome action and choosing access, with no further app-level
confirmation or technical task. On return, the user reaches Atlas, can open and
leave a journey without losing context, and can recover a paused/restricted run.
Account restore is independently reachable without requiring photo access.
The scenario and device matrix in acceptance.md must pass before calling the
improvement delivered; this spec's self-validation establishes document quality only.

## Assumptions

- **A-1:** Keep English as the shipped UI language for this increment; the copy table is the implementation baseline.
- **A-2:** Use a labeled Settings entry in the Atlas header and a contextual Replay action; no new global tab bar.
- **A-3:** Default safe transient read retries to two attempts at 1 and 3 seconds in foreground; unknown writes always reconcile first.
- **A-4:** Target visible tap acknowledgement within 100 ms and before the first awaited native/storage boundary; measure on target phones rather than claim it now.
- **A-5:** Persist a versioned first-run marker separately from owner history; cold startup restores Atlas and pending task state, not an automatically playing previous Replay.

These are explicit engineering defaults derived from the requested direction,
not claims of separate owner approval. No blocking product question remains for
specification; source feasibility, timings and physical usability remain to be
verified in implementation.
