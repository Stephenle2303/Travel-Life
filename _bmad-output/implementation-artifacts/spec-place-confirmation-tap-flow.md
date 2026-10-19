---
title: 'Make owner place confirmation immediately tappable'
type: 'bugfix'
created: '2026-10-18'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An owner who searches for Phu Quoc cannot reliably select and confirm it because the keyboard intercepts the first result tap and the confirmation control is rendered far away from the selected result.

**Approach:** Keep touches available to place-result buttons while the keyboard is open, and render the place-specific preview and save action directly under the local search results.

</frozen-after-approval>

## Implementation Notes

- Existing ActionButton behavior is valid; the correction screen ScrollView must preserve result presses while a TextInput owns the keyboard.
- `JourneyCorrectionScreen` now preserves keyboard-open result taps and places the selected-place confirmation directly under the search result. Focused correction regression: 10/10; mobile TypeScript: passed. Android development client was reloaded and Metro completed fresh Android bundle `b1` in 973 ms.
- Expanded after owner review: replace the one-result example catalogue with the bundled worldwide Admin-1 gazetteer, retain Phú Quốc as a reviewed island result, show success/error beside confirmation, and remove per-row Atlas correction buttons. Focused correction/search tests: 11/11; Atlas suite: 22/22; TypeScript: passed.
- Follow-up after owner still could not find the correction task: the selected journey preview and detail now use the explicit `Correct location` action. It remains contextual to the selected trip, preserves Atlas context for the return route, and is not repeated in Timeline rows. Added repository persistence coverage for the place ID/name/context/coarse anchor and correction application, plus a preview-route regression. Focused location regressions: 71/71; TypeScript: passed. The existing Android app was cold-relaunched against the current Metro server without clearing data and has no current-process bundle/module error; the owner still must accept the actual tap, save, and marker movement.
- Owner device evidence found a persistence/projection defect: place corrections were saved against a temporary pre-continuity journey ID, while Atlas reads the final canonical ID. The remapper now resolves the effective revision against the final committed graph. A generated-ID replacement regression passes, along with the focused correction/Atlas/search/repository set (74 tests), TypeScript, and root checks. The Android app was reloaded without clearing data; reconfirming the selected location supersedes the old incorrect revision and applies it to the visible journey.
