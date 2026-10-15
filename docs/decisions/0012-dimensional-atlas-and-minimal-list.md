# Decision 0012: Dimensional Atlas and minimal journey list

Date: 2026-10-15 (Asia/Bangkok).
Status: accepted from the owner's approved implementation scope.

## Context

The private Atlas needs more visual energy without changing its evidence,
privacy, or native-map boundaries. The existing button-heavy Timeline also makes
the local journey record harder to scan.

## Decision

Use a restrained owner-controlled 2D/3D camera presentation, layered circular
markers, matte map hierarchy, and a compact map-provider disclosure. The camera
uses no routes, terrain, imagery change, building layer, globe, location tracking,
or new provider configuration. Selection uses Citrus sparingly and always also
uses readable selected/accessibility state.

Render the synchronized journey list as flat two-line rows rather than nested
action cards. Each row exposes only the redacted safe title, observed period,
and required uncertainty/status wording. Unknown-coordinate journeys remain
Timeline-only; filtering continues to clear a no-longer-visible selection.

## Consequences

This is a presentation extension over the existing local redacted projection.
It adds no schema, migration, reconstruction behavior, map credential, external
write, or provider payload. Device validation remains necessary for native marker
hit testing, camera fidelity, provider rendering, large text, and accessibility.
