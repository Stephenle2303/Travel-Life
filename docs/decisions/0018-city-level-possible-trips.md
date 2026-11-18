# Decision 0018 — Show qualified trips at city level

Date: 2026-11-16
Status: Implemented and host-verified in the Android development preview. Owner-device acceptance is pending.

## Decision

Show a trip in **Possible trips** as soon as independent capture sessions
provide enough evidence for both the city and the continuity of the trip.
One verified named stop is sufficient when those conditions are met. Use
the supported city as the title and list verified stops in the detail view.
Continue to look for other stops within the existing processing budget.

Album membership requires its own positive evidence for each photo. A photo
may belong to the trip with its capture location still unknown. A single
recognized stop surrounded by nearby dates or unrelated photos supplies
insufficient trip evidence. The owner reviews and confirms the exact
proposal once through the existing Possible trips flow.

## Context and verification

The owner chose immediate city-level review over waiting for a second named
stop. In the regional holdout, the recognizer found two photographs of the
same pavilion in one Hanoi session and missed both views from the other
session. That result identifies a stop and leaves trip continuity unresolved.
Use it as a negative case alongside a city-level proposal with independent
session evidence. Verify album precision, exact readback, and real-device
recall alongside the multi-stop controls in [CAP-4 acceptance](../../_bmad-output/specs/spec-atlas-reconstruction-recovery/acceptance.md).
