# 0013 — Reference-faithful Atlas cartography before deferred chrome

Date: 2026-10-18 (Asia/Bangkok).
Status: accepted user visual scope; implementation approach proposed pending feasibility and visual proof.

## Context

The owner rejected the gap between the supplied `World Map.jpg` and the recolored fictional/grid Atlas. They explicitly deferred the top search pill and utility icons, full left mode dock, compass/zoom slider, route arcs and polished persistent destination card, while requiring the map visual to look the same. They requested a careful plan/spec before further implementation.

## Decision

Use the supplied map as the visual acceptance target for real world geometry, curved silhouette, textured blue land, shaded navy oceans, muted gold boundaries, coastal light, restrained labels and subtle currents. Palette substitution and abstract geography do not satisfy the target. Require an actual equal-size map-only comparison and owner visual acceptance before full integration.

Flat baked geographic shading/relief is permitted to match the image. This narrowly supersedes decision 0012 and design-system wording that prohibited terrain data when read as excluding static 2D textures. Runtime 3D terrain, elevation APIs and globe behavior remain out of scope. The listed chrome/features are deferred, not required dependencies of map-visual delivery. Existing exploration/media/correction behavior remains required.

The [cartography spec](../../_bmad-output/specs/spec-atlas-reference-cartography/SPEC.md) supersedes conflicting earlier Atlas map-fidelity/scope defaults; prior implementation records stay historical. The recommended bundled offline base with a common geographic transform is an engineering candidate, not an already proven implementation or an accepted library migration.

## Consequences and reconsideration

Browser prototype and installed Android/iOS Atlas must consume the same accepted cartographic base. Default demo tiles and fictional geography cannot silently replace it. Data sources must permit intended redistribution; reference artwork remains local comparison material. Preserve privacy, uncertainty and unknown-location behavior.

The plan has separate source/renderer feasibility, owner visual acceptance, integration and actual platform verification gates. Missing source rights, an unacceptable projection fit or measured resource/interaction failure requires a concrete alternative and spec update before integration. This planning decision authorizes no app implementation, provider purchase, personal-data upload or deployment.
