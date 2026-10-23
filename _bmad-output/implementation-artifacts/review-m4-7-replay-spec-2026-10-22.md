# M4.7 specification review

Date: 2026-10-22 (Asia/Bangkok).

## Verdict

The draft is not ready for development. Its broad product direction is consistent with the MLP, but the contracts below must be resolved before implementation. No implementation or spec revision was performed in this review.

Reviewed the implementation spec, canonical SPEC and renderer companion. Read source decision 0009, M4.7 acceptance criteria, current repository eligibility/media methods, Reveal types, package/Jest configuration and Expo configuration. Ran independent adversarial, edge-case and structure lenses; adversarial findings were completed by the parent. Prose was not selected because this is a behavioral readiness review rather than copy-editing. Verification-gap is configured for code and did not apply.

## Adversarial findings

Locations marked “implementation spec” refer to spec-m4-7-preview-and-export-the-travel-life-replay.md. Renderer locations refer to ../specs/spec-m4-7-travel-life-replay/renderer-contract.md.

### A1: The selected lifetime scope has no selection or review contract.

- Location: implementation spec:22,26,58; renderer-contract.md:11
- Required resolution: Define private-preview defaults, date/place/journey/media selection, exact export review, and the rule requiring deliberate export selection.
- Consequence: Implementers can export the whole visible lifetime when the owner intended only a subset.

### A2: Chronology and uncertainty are undefined beyond reusing journey eligibility.

- Location: implementation spec:45,65; renderer-contract.md:17
- Required resolution: Define evidence-derived ordering, overlap/tie handling, coarse-date treatment and omission rules; do not order from owner date claims or labels. Add an explicit ordering check because loadJourneyEligibility does not check it.
- Consequence: The replay can imply unsupported sequencing, or reject all inferred history under the broad uncertain-input exclusion.

### A3: A journey passes eligibility but contains suggested or unassigned memories.

- Location: implementation spec:45,58; renderer-contract.md:11
- Required resolution: Define eligible membership states per memory, honor owner rejection/move/unassign corrections, deduplicate selected media and validate membership in the captured run.
- Consequence: The general gallery loader can contribute memories whose association is unreviewed or which do not belong in the selected destination.

### A4: A large lifetime must fit the fixed duration and undefined resource budget.

- Location: renderer-contract.md:13,17; implementation spec:57
- Required resolution: Specify maximum scenes/media/decoded pixels/bytes, minimum scene duration, deterministic representative selection, omission disclosure and a render deadline.
- Consequence: Arbitrary truncation, unreadable scenes or unbounded decoding can undermine the lifetime story or crash the app.

### A5: Existing source media includes videos, HEIC images and differently oriented or cloud-backed assets.

- Location: renderer-contract.md:5,13; implementation spec:58
- Required resolution: Define supported source types, video omission or still-extraction policy, orientation/crop/downscaling, local materialization, metadata stripping and availability recheck behavior.
- Consequence: The photo-only derivative pipeline can silently drop video memories or mishandle inputs that pass general gallery eligibility.

### A6: The companion selects expo-media-library for a native-share acceptance criterion.

- Location: renderer-contract.md:5,23; implementation spec:38,67
- Required resolution: Define library save and native sharing separately; name the SDK-compatible APIs, permissions, unavailable/cancelled outcomes, file handoff lifetime and observable completion semantics.
- Consequence: A gallery save can be reported as native sharing, while the requested share sheet is never implemented.

### A7: A preview is ready when privacy changes, the app backgrounds, crashes or restarts.

- Location: implementation spec:36; renderer-contract.md:11,13,21
- Required resolution: Cover preview-ready/exporting invalidation, pause/release on background, job-scoped private cache and backup policy, startup orphan cleanup and bounded retention.
- Consequence: A stale private replay can remain playable or cached after its source journeys are hidden or deleted.

### A8: New tests follow the proposed src/replay/__tests__ location.

- Location: implementation spec:51,60,83; apps/mobile/package.json:jest.testMatch
- Required resolution: Use the existing discovered test directory or explicitly extend jest.testMatch; verify discovery before treating the suite as coverage.
- Consequence: The verification command can pass without running the new controller, renderer or cancellation tests.

### A9: The native renderer is selected while compatibility and platform feasibility remain unanswered.

- Location: implementation spec:56,68; canonical SPEC:Open Questions; renderer-contract.md:5,28
- Required resolution: Make a bounded technical spike the first task with pinned package/build inputs, codec/output inspection, diagnostic-suppression checks, license/binary provenance review, both-platform evidence and a fallback decision on failure.
- Consequence: Full implementation can depend on an unproven native stack and still be described as ready for development.

### A10: The spec prohibits hosted publication while the source story includes optional deliberate attachment.

- Location: implementation spec:28; canonical SPEC:Non-goals; epics.md:AC-M4.7-3
- Required resolution: Explicitly assign the replay-to-highlight publication handoff and acceptance to M4.5/M4.6, or preserve an explicit optional integration contract; do not claim full M4.7 preservation without accounting for it.
- Consequence: A source acceptance clause disappears from the delivery record without a declared dependency or disposition.

## Edge-case findings

These overlap with the adversarial findings by design; they are retained as independent path-tracing evidence.

- E1 — implementation spec:22: The owner enters Replay without a defined lifetime or media selection. Resolve: Define private-preview defaults, selection controls and exact reviewed export scope; require deliberate export selection. Consequence: Export includes memories the owner never deliberately selected.
- E2 — renderer-contract.md:17: Selected observations have overlapping dates, coarse dates, or uncertain visit ordering. Resolve: Define chronology keys, stable tie handling, and omission or grouping for incomparable observations. Consequence: Replay asserts an unsupported sequence.
- E3 — renderer-contract.md:11: An eligible journey contains suggested, rejected, unassigned, or ambiguously associated memories. Resolve: Define membership eligibility per memory state and validate each selected memory independently. Consequence: Journey eligibility admits memories lacking established journey membership.
- E4 — renderer-contract.md:13: The selected lifetime exceeds undefined input, output, scene, or render-work budgets. Resolve: Specify measurable limits, deterministic sampling, minimum scene duration and omission counts. Consequence: Rendering exhausts resources or silently drops coverage.
- E5 — renderer-contract.md:13: The OS kills the app while private derivatives or completed artifacts remain. Resolve: Use job-scoped cache directories and startup orphan cleanup with a retention limit. Consequence: Private replay copies survive indefinitely.
- E6 — renderer-contract.md:13: Preview closes while a native share recipient is still reading the file. Resolve: Retain an export lease until a documented platform handoff cleanup boundary. Consequence: Premature deletion breaks recipient exports.
- E7 — renderer-contract.md:21: The share sheet is cancelled, export fails, or the owner exports again. Resolve: Define export cancellation/failure return, retry, preview retention and final disposal transitions. Consequence: The controller stays exporting or loses its retryable preview.
- E8 — implementation spec:51: Renderer tests are created under the specified src/replay/__tests__ directory. Resolve: Move tests into the discovered directory or extend jest.testMatch. Consequence: The test command skips new regressions.
- E9 — renderer-contract.md:5: The owner chooses sharing but implementation only saves through expo-media-library. Resolve: Specify separate native-share and save APIs, permissions and observable outcomes. Consequence: Gallery saving substitutes for the promised native share flow.

## Structure findings

The document helps the owner approve M4.7 and an implementation agent build and verify it. Closest model: Prompt/Task Definition (Functional). Exact word-metrics counts: implementation spec 1,005; canonical SPEC 440; renderer companion 428; combined 1,873. These are word counts, not token counts; the previous 1,080-word report used a different counter and did not establish the workflow's token target.

| Pass | Original text | Revised text | Changes |
| --- | --- | --- | --- |
| structure | Canonical SPEC Open Questions, 22 words | MOVE feasibility dependency before implementation tasks | Makes the unresolved prerequisite visible; estimated word impact 0. |
| structure | Boundaries & Constraints, 132 words | CONDENSE into parallel eligibility, output, cleanup, diagnostics and exclusion rules | Preserve every rule; estimated word impact 0. |
| structure | Matrix and Tasks & Acceptance, 433 words combined | MERGE duplicated outcomes into Given/When/Then matrix rows | Estimated saving 70–90 words while preserving device acceptance separately. |
| structure | Code Map, 152 words | PRESERVE annotations; standardize path-base convention | Supports reliable lookup; estimated word impact 0. |

Four structure recommendations save an estimated 70–90 words (7.0–9.0% of the implementation spec). They preserve behavioral detail. Word metrics cannot establish compliance with a token limit.

## Source checks and limits

- Current Jest testMatch discovers only src/components/__tests__/**/*.test.ts?(x). Tests under src/replay/__tests__ are not included.
- Current loadJourneyEligibility checks lifecycle/run/privacy and pending remap, but does not establish chronological order or each memory's membership suitability. Gallery pages expose association state and support photo/video media.
- Current app.json sets savePhotosPermission to false. expo-media-library save and native file sharing need separate contracts.
- The candidate renderer's upstream README describes H.264 capability discovery and hardware encoders with a software fallback; Expo support alone does not prove this app's render pipeline. Its native log callbacks require explicit suppression/redaction checks. Its README also documents bundled FFmpeg licensing requirements, so the generic dependency-verification task is insufficient evidence of adoption readiness.
- Expo Sharing documents sharing a local file via an action sheet and returns Promise<void>; the UI must not infer recipient delivery from that return value.
- Neither runtime tests nor native build/device checks were run: this is a document review. No renderer compatibility, output quality or device export result is claimed.

Sources: [munim-ffmpeg upstream README](https://github.com/munimtechnologies/munim-ffmpeg), [Expo Sharing API](https://docs.expo.dev/versions/latest/sdk/sharing/).

## Canonical behavioral findings JSON

```json
[
  {
    "lens": "adversarial",
    "location": "implementation spec:22,26,58; renderer-contract.md:11",
    "trigger_condition": "The selected lifetime scope has no selection or review contract.",
    "guard_snippet": "Define private-preview defaults, date/place/journey/media selection, exact export review, and the rule requiring deliberate export selection.",
    "potential_consequence": "Implementers can export the whole visible lifetime when the owner intended only a subset."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:45,65; renderer-contract.md:17",
    "trigger_condition": "Chronology and uncertainty are undefined beyond reusing journey eligibility.",
    "guard_snippet": "Define evidence-derived ordering, overlap/tie handling, coarse-date treatment and omission rules; do not order from owner date claims or labels. Add an explicit ordering check because loadJourneyEligibility does not check it.",
    "potential_consequence": "The replay can imply unsupported sequencing, or reject all inferred history under the broad uncertain-input exclusion."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:45,58; renderer-contract.md:11",
    "trigger_condition": "A journey passes eligibility but contains suggested or unassigned memories.",
    "guard_snippet": "Define eligible membership states per memory, honor owner rejection/move/unassign corrections, deduplicate selected media and validate membership in the captured run.",
    "potential_consequence": "The general gallery loader can contribute memories whose association is unreviewed or which do not belong in the selected destination."
  },
  {
    "lens": "adversarial",
    "location": "renderer-contract.md:13,17; implementation spec:57",
    "trigger_condition": "A large lifetime must fit the fixed duration and undefined resource budget.",
    "guard_snippet": "Specify maximum scenes/media/decoded pixels/bytes, minimum scene duration, deterministic representative selection, omission disclosure and a render deadline.",
    "potential_consequence": "Arbitrary truncation, unreadable scenes or unbounded decoding can undermine the lifetime story or crash the app."
  },
  {
    "lens": "adversarial",
    "location": "renderer-contract.md:5,13; implementation spec:58",
    "trigger_condition": "Existing source media includes videos, HEIC images and differently oriented or cloud-backed assets.",
    "guard_snippet": "Define supported source types, video omission or still-extraction policy, orientation/crop/downscaling, local materialization, metadata stripping and availability recheck behavior.",
    "potential_consequence": "The photo-only derivative pipeline can silently drop video memories or mishandle inputs that pass general gallery eligibility."
  },
  {
    "lens": "adversarial",
    "location": "renderer-contract.md:5,23; implementation spec:38,67",
    "trigger_condition": "The companion selects expo-media-library for a native-share acceptance criterion.",
    "guard_snippet": "Define library save and native sharing separately; name the SDK-compatible APIs, permissions, unavailable/cancelled outcomes, file handoff lifetime and observable completion semantics.",
    "potential_consequence": "A gallery save can be reported as native sharing, while the requested share sheet is never implemented."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:36; renderer-contract.md:11,13,21",
    "trigger_condition": "A preview is ready when privacy changes, the app backgrounds, crashes or restarts.",
    "guard_snippet": "Cover preview-ready/exporting invalidation, pause/release on background, job-scoped private cache and backup policy, startup orphan cleanup and bounded retention.",
    "potential_consequence": "A stale private replay can remain playable or cached after its source journeys are hidden or deleted."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:51,60,83; apps/mobile/package.json:jest.testMatch",
    "trigger_condition": "New tests follow the proposed src/replay/__tests__ location.",
    "guard_snippet": "Use the existing discovered test directory or explicitly extend jest.testMatch; verify discovery before treating the suite as coverage.",
    "potential_consequence": "The verification command can pass without running the new controller, renderer or cancellation tests."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:56,68; canonical SPEC:Open Questions; renderer-contract.md:5,28",
    "trigger_condition": "The native renderer is selected while compatibility and platform feasibility remain unanswered.",
    "guard_snippet": "Make a bounded technical spike the first task with pinned package/build inputs, codec/output inspection, diagnostic-suppression checks, license/binary provenance review, both-platform evidence and a fallback decision on failure.",
    "potential_consequence": "Full implementation can depend on an unproven native stack and still be described as ready for development."
  },
  {
    "lens": "adversarial",
    "location": "implementation spec:28; canonical SPEC:Non-goals; epics.md:AC-M4.7-3",
    "trigger_condition": "The spec prohibits hosted publication while the source story includes optional deliberate attachment.",
    "guard_snippet": "Explicitly assign the replay-to-highlight publication handoff and acceptance to M4.5/M4.6, or preserve an explicit optional integration contract; do not claim full M4.7 preservation without accounting for it.",
    "potential_consequence": "A source acceptance clause disappears from the delivery record without a declared dependency or disposition."
  },
  {
    "lens": "edge-case-hunter",
    "location": "implementation spec:22",
    "trigger_condition": "The owner enters Replay without a defined lifetime or media selection.",
    "guard_snippet": "Define private-preview defaults, selection controls and exact reviewed export scope; require deliberate export selection.",
    "potential_consequence": "Export includes memories the owner never deliberately selected."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:17",
    "trigger_condition": "Selected observations have overlapping dates, coarse dates, or uncertain visit ordering.",
    "guard_snippet": "Define chronology keys, stable tie handling, and omission or grouping for incomparable observations.",
    "potential_consequence": "Replay asserts an unsupported sequence."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:11",
    "trigger_condition": "An eligible journey contains suggested, rejected, unassigned, or ambiguously associated memories.",
    "guard_snippet": "Define membership eligibility per memory state and validate each selected memory independently.",
    "potential_consequence": "Journey eligibility admits memories lacking established journey membership."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:13",
    "trigger_condition": "The selected lifetime exceeds undefined input, output, scene, or render-work budgets.",
    "guard_snippet": "Specify measurable limits, deterministic sampling, minimum scene duration and omission counts.",
    "potential_consequence": "Rendering exhausts resources or silently drops coverage."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:13",
    "trigger_condition": "The OS kills the app while private derivatives or completed artifacts remain.",
    "guard_snippet": "Use job-scoped cache directories and startup orphan cleanup with a retention limit.",
    "potential_consequence": "Private replay copies survive indefinitely."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:13",
    "trigger_condition": "Preview closes while a native share recipient is still reading the file.",
    "guard_snippet": "Retain an export lease until a documented platform handoff cleanup boundary.",
    "potential_consequence": "Premature deletion breaks recipient exports."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:21",
    "trigger_condition": "The share sheet is cancelled, export fails, or the owner exports again.",
    "guard_snippet": "Define export cancellation/failure return, retry, preview retention and final disposal transitions.",
    "potential_consequence": "The controller stays exporting or loses its retryable preview."
  },
  {
    "lens": "edge-case-hunter",
    "location": "implementation spec:51",
    "trigger_condition": "Renderer tests are created under the specified src/replay/__tests__ directory.",
    "guard_snippet": "Move tests into the discovered directory or extend jest.testMatch.",
    "potential_consequence": "The test command skips new regressions."
  },
  {
    "lens": "edge-case-hunter",
    "location": "renderer-contract.md:5",
    "trigger_condition": "The owner chooses sharing but implementation only saves through expo-media-library.",
    "guard_snippet": "Specify separate native-share and save APIs, permissions and observable outcomes.",
    "potential_consequence": "Gallery saving substitutes for the promised native share flow."
  }
]
```
