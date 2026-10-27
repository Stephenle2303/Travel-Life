---
title: 'Welcome details simplification'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Welcome page repeats explanatory footage and permission copy below the video hero, making its lower section feel crowded.

**Approach:** Keep the existing animated hero, its concise footage disclosure, and the complete Private by Design block. Remove only the duplicated lower InsetPanel that explains illustrative footage and later photo access.

</frozen-after-approval>

## Implementation Notes

- Diagnostic delivery map: not applicable. This is a static presentation-only removal with no fallible runtime boundary, new owner action, storage, network, diagnostic event, or collection recipe.
- Removed the duplicate lower InsetPanel and its unused styling/import while retaining the existing video hero and Private by Design block.
- Added first-run UI assertions for the retained Private by Design copy and removed duplicate strings.
- Review added an exact assertion for the retained Private by Design eyebrow.

## Review Triage Log

- low — The initial regression covered the retained title and body but not the privacy eyebrow; added its exact visible-text assertion.

