# Decision 0010: Living Atlas is the official Travel Life design system

Date: 2026-10-09 (Asia/Bangkok).  
Status: accepted from the user's explicit direction.

## Context

The owner selected the Living Atlas / Tropical Modernism direction for the
synthetic prototype. The approved prototype delivery spec fixed the six-color
palette and visual, interaction, accessibility, and privacy boundaries. The
prototype and the initial mobile app use that language, but no project-wide
design authority had been declared. A later map/navigation DESIGN and EXPERIENCE
pair was written as a proposal; some of its map colors were not implemented.

The alternatives were to keep the prototype as an isolated visual experiment,
adopt every detail of the later proposal, or make the agreed implemented direction
the shared reference. The owner explicitly chose the shared reference.

## Decision

The Living Atlas direction used to finalize the agreed prototype is the
**official design system for all Travel Life UI and UX**. The canonical reference
is [the Living Atlas design system](../product/design-system.md). Future iOS,
Android, browser, replay, and sharing work follows its palette, visual hierarchy,
interaction patterns, accessibility floor, and honest evidence language.
[Decision 0011](0011-prototype-screens-as-product-ui.md) extends this decision to
the agreed prototype screen set, including the video Welcome.

This adopts the agreed and implemented baseline, not every unbuilt suggestion in
the later map/navigation proposal. It does not copy the prototype's synthetic
data, simulated access, illustrative map implementation, or preview-only
capabilities into production. Accepted product, privacy, consent, evidence,
platform, and MLP decisions continue to define what the UI may claim and do.

## Evidence and consequences

The approved [prototype spec](../../_bmad-output/implementation-artifacts/spec-living-atlas-prototype.md),
[prototype UI](../../apps/prototype/src/components/ui.tsx), and
[project state](../project-state.md) record the selected direction and delivered
example. [Mobile UI primitives](../../apps/mobile/src/components/ui.tsx) already
use the core palette.

New UI stories should cite the canonical design system. Design extensions are
recorded explicitly; a proposed token or interaction does not become official
solely because it appears in a mock or historical proposal. A shared code package
is a future implementation choice, not a condition of this decision.

Reconsider when the owner changes the brand/UX direction or target-platform
validation shows a specific pattern must change for usability or accessibility.
