---
title: 'Welcome hero copy'
type: 'feature'
created: '2026-10-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Welcome hero’s current supporting copy and CTA do not reflect Travel Life’s agreed positioning as a private view of a person’s travel life.

**Approach:** Keep the approved headline and existing private, factual montage disclosure. Replace the hero supporting line with “The places you’ve been. The life you’ve lived.” and label the primary action “Explore my travel life.”

</frozen-after-approval>

## Implementation Notes

- Replaced the supporting line and accessible CTA label in `travel-hero.tsx`; retained the factual footage disclosure, Trust-route callback, and playback controls.
- Updated hero and first-run navigation tests to use the visible CTA text and accessible label.
- Review corrected the mobile README's first-run flow label and added a direct assertion for the approved supporting line.

## Review Triage Log

- low — The mobile README still named the former CTA; updated the documented Welcome → Trust → Import flow to “Explore my travel life.”
- low — The hero test did not assert the approved supporting line; added a direct assertion so the copy is protected alongside CTA behavior.

