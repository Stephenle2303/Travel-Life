# Acceptance and evidence

All implementation cases are pending. These are targets, not claimed test results.

| ID / capability | Scenario and required outcome | Evidence |
| --- | --- | --- |
| D1 / CAP-1 | Populated map has rich geography, readable labels and restrained depth; no terrain, buildings, satellite imagery or routes | Synthetic screenshots; source/layer inspection |
| D2 / CAP-1 | Ordinary markers remain quiet; selection is Citrus plus distinct ring; underlay adds subtle depth without constant glow | Visual comparison; selected-state test |
| D3 / CAP-1 | Flat/depth toggle preserves center/zoom; reset fits supported filtered points; finite pitch/bearing round-trip correctly; old context defaults safely | Native test and context unit tests |
| D4 / CAP-1 | Small viewport/large text does not hide Close, provider attribution or map controls behind preview | iOS/Android visual and interactive checks |
| D5 / CAP-2 | 0, 1 and many journeys show count and flat rows with safe title, observed period and worded state; no per-row toolbar or thumbnail reads | Rendered tests and local loader spies |
| D6 / CAP-2 | Multi-year journey appears once in All years, matches only supported years and groups by observed dates; owner date does not reorder evidence | Projection/grouping tests |
| D7 / CAP-2 | Missing title/date/location and uncertain ordering remain truthful; long title wraps; exceptional review state is discoverable without About | Synthetic UI tests and large-text capture |
| D8 / CAP-2 | Tap row selects matching point/card; selection indicated without relying only on color; no direct detail navigation | Interaction tests and screen-reader check |
| D9 / CAP-3 | Visible marker selection does not move camera; offscreen row may center once; unknown-location row causes no flight; no empty-anchor math | Camera adapter tests and native checks |
| D10 / CAP-3 | Manual pan/pinch interrupts centering; drag keeps selection; empty tap/Close dismisses only preview; source press cannot also dismiss | Native gesture evidence and event tests |
| D11 / CAP-3 | Overlapping points require an explicit choice; cancellation changes neither selection nor camera | Existing overlap regression plus device test |
| D12 / CAP-3 | Map/Timeline, media and valid correction return preserve camera including pitch/bearing, filter, selection and clamped list offset; filter change resets list intentionally | Context/integration tests and native return walkthrough |
| D13 / CAP-3 | A-to-B race, access loss, backgrounding, removed/ambiguous corrected target or rebuild cannot publish stale preview/error/media; retain valid viewport and close stale selection | Deferred-load and lifecycle/correction regressions |
| D14 / CAP-4 | Reduced motion disables decorative/camera transitions; preference unknown starts motion-free; actions have accessible labels, focus and 48-unit targets | Accessibility tests plus device screen reader |
| D15 / CAP-4 | Portrait/wide-native layout and rotation preserve selection; large text stacks when needed; one vertical scroll owner, no nested competing list | Device layout/scroll checks |
| D16 / CAP-4 | 1,000 synthetic journeys use bounded row work; no per-row detail/thumbnail lookup; list selection/filtering remains responsive with observations recorded | Profiler/request counts and real-device stress |
| D17 / CAP-4 | Missing native module/style/offline leaves same local list and preview/media/correction actions usable; no fabricated empty history | Recovery tests and native failure exercise |
| D18 / CAP-4 | Map payload stays coarse and opaque; source requests retain correct attribution/disclosure; demo style remains development-only and release fails closed without approved source | Payload tests and synthetic request/config inspection |

## Planning validation

Coherence: four unique stable CAP IDs, each with intent and success, explicit constraints and non-goals, and concrete demonstration targets. Defaults and unresolved provider dependency are labelled.

Preservation: owner's vibrant/professional/lively 3D effect, explicit no-terrain clarification, minimal intuitive list, reference composition and inherited privacy/context/accessibility requirements are represented in this spec and development plan. Party staging and superseded terrain/globe suggestions are intentionally excluded.

Documentation checks and foundation command results are recorded in the decision log after execution. Application code, mobile behavior, rendering quality and native performance are not verified by this planning task.
