---
title: 'Remove deferred hosted sharing from the MLP mobile navigation'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The MLP build still exposes `Publish highlight link` and `Share selected highlight`, despite the approved deferral of M4.5/M4.6 hosted publication and browser viewing.

**Approach:** Remove every owner-facing hosted-sharing navigation entry and its Expo route from the MLP bundle, while preserving the existing local Replay video preview and operating-system `Share video` handoff.

</frozen-after-approval>

## Implementation Notes

- Diagnostic delivery gate: this change removes UI routes only and introduces no fallible runtime boundary or diagnostic event. The existing local `REPLAY_EXPORT` share-sheet diagnostics remain unchanged. Collection recipe for acceptance: start Metro, keep `adb reverse tcp:8081 tcp:8081`, open Replay on the installed debug client, and verify the final Replay/share-review/share-preview states contain no hosted-link action.
- Code map: `apps/mobile/src/components/replay-screen.tsx` owns the local selected-trip Replay flow and contains the hosted-link button at the share-review state; preserve `Share selected Replay video`. `apps/mobile/src/components/mobile-screens.tsx` owns Atlas navigation and currently passes a hosted-share callback plus a standalone hosted-share action. `apps/mobile/src/app/share.tsx` makes the hosted SelectedShare screen an Expo route; removing it keeps its deferred implementation out of the app route graph. `apps/mobile/src/components/__tests__/replay-screen.test.tsx` already exercises the local video share flow and receives the regression that hosted actions are absent.
- Scope is intentionally limited to public navigation and the routed bundle entry. Deferred M4.5/M4.6 source and tests are retained as post-MLP work and are not re-enabled, deleted, or deployed.
- Removed the `/share` Expo route; deleted hosted-link actions from Replay and Atlas; and removed the Atlas preview-sheet hosted-sharing callback rather than leaving an unused public component API. Focused Replay and Atlas suites pass 110 tests, and mobile TypeScript passes.
- The root MLP route regression, repository `npm run check` (49 tests), and mobile lint pass. The first root-lint invocation was inapplicable because the root package defines no lint script; mobile lint was run from its owning package.
- Independent review found the provider still dynamically imported the deferred owner service at startup and before local-history deletion. Replaced those callbacks with the local-complete MLP lifecycle result; no hosted service was ever deployed or published, so no legacy remote cleanup is required. The root regression now asserts the provider has no deferred-service import. The focused lifecycle/Atlas/Replay suites pass 117 tests, and the final root check remains required after this correction.

## Review Triage Log

- medium, patched — provider startup/deletion invoked deferred owner-service reconciliation; removed both imports and asserted their absence.
- medium, patched — Atlas regression only removed the positive hosted-share test; root regression now checks `AtlasReveal` no longer exposes the callback or action.
- low, rejected — source-text route check is intentionally bounded to the Expo route tree and every current MLP entry surface; root inspection separately searches the app/components tree, while a production Expo bundle is not required to establish an absent file route.
- false — `in-progress` was accurate during implementation and project state explicitly retains device acceptance as unresolved; spec is now finalized as done without claiming installed-build acceptance.
- false — the approved intent requires removing the `/share` route, so generic Expo not-found for an old deep link is the safe outcome; retaining a redirect/explanation route would violate the no-route requirement.
- false — root check and mobile typecheck/lint/focused Jest are distinct, documented commands with actual passing results; they need not be merged to establish this scoped source change.
- maybe-false, deferred — Android/iOS owner acceptance remains open in project state; iOS physical validation needs an available connected iOS device and does not block the source-route correction.
