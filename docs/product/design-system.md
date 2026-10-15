# Travel Life design system: Living Atlas

Status: official project UI/UX direction, accepted 2026-10-09 (Asia/Bangkok).

The owner's 2026-10-09 clarification in [decision 0011](../decisions/0011-prototype-screens-as-product-ui.md)
also makes **the agreed prototype screens themselves** the official product UI
targets. This document governs both their visual language and screen patterns.

This is the design reference for **all Travel Life surfaces**: the iOS and Android
app, the interactive browser viewer, shared highlights, replay presentation, and
future UI. It formalizes the Living Atlas direction selected by the owner and used
in the finalized synthetic prototype. Apply the system when building new screens or
revising existing ones. Product scope, evidence, privacy, consent, and sharing
rules remain governed by the accepted [decisions](../decisions/README.md),
especially [decision 0009](../decisions/0009-mlp-lifetime-reveal-and-replay.md).

The approved prototype [delivery spec](../../_bmad-output/implementation-artifacts/spec-living-atlas-prototype.md)
and its [implemented UI](../../apps/prototype/src/components/ui.tsx) are the
visual reference. The [prototype](../../apps/prototype/README.md) illustrates the
experience with fictional local data. Its demo atlas, simulated permissions,
in-memory corrections, preview-only replay and sharing, and generated imagery
are **not** production capabilities or required implementation technologies.

## Official screen set

The following prototype screens define the product's intended composition,
navigation, and interaction. Adapt layout for native safe areas, device sizes,
browser use, accessibility, and real data. Preserve the recognizable experience
and sequence. The current production mobile Trust → Import → empty Atlas flow is
an implementation foundation, not the completed screen set.

| Product screen or state | Agreed prototype reference | Product UI contract |
| --- | --- | --- |
| Welcome | [Video hero](../../apps/prototype/src/components/travel-hero.tsx), [Welcome view](../../apps/prototype/src/components/prototype-screens.tsx) | Video-led first-run entry with Living Atlas brand, “Your travels. Alive again.”, clear private-reveal action and concise privacy framing. |
| Photo access | [`/access`](../../apps/prototype/src/app/access.tsx) | Broad device-library access is primary; selected photos are a clear alternative; explain the choice before the native prompt. |
| Import | [`/import`](../../apps/prototype/src/app/import.tsx) | Give import status, coverage limits, and a way to pause, resume, or change accessible scope when supported. |
| Private Atlas reveal | [`/reveal`](../../apps/prototype/src/app/reveal.tsx) | Dominant interactive map, Map/Timeline switch, year controls, synchronized selection, honest coverage, and a usable list fallback. |
| Journey detail and correction | [`/journey/[id]`](../../apps/prototype/src/app/journey/[id].tsx) | Photo-led detail, evidence and uncertainty, memories, owner review/correction, contextual return to Atlas. |
| Replay | [`/replay`](../../apps/prototype/src/app/replay.tsx) | Cinematic chronological destination presentation with clear preview/cancel/export actions when the real renderer exists; never imply traveled routes. |
| Selected Highlight | [`/share`](../../apps/prototype/src/app/share.tsx) | Start with nothing selected, allow chapter/media selection including select-all, show the exact preview, then require deliberate publish or export. |
| Sparse evidence | [`/sparse`](../../apps/prototype/src/app/sparse.tsx) | Show the available partial record, its uncertainty, and a useful next action without fabricating a lifetime story. |
| Declined or limited access | [`/declined`](../../apps/prototype/src/app/declined.tsx) | Explain the current access boundary and offer a respectful recovery path. |
| Unknown route or unavailable state | [Recovery screen](../../apps/prototype/src/app/+not-found.tsx) | Explain what failed and provide a safe return; preserve private state where possible. |

The Welcome's bundled [portrait and wide montages](../../apps/prototype/assets/video/)
show fictional beaches, lakes, and other landscapes. Use these as the initial
promotional Welcome treatment in the product. They
are **not** owner media or the generated Travel Life Replay. Keep them silent,
provide a labeled pause/play control, pause when the page or app is inactive,
respect reduced motion, and show the bundled poster if playback fails. Avoid
autoplay until the motion preference is known. Replace prototype-only “synthetic
demo” instructions and counts with truthful production copy and real states.

The prototype's [bundled fictional atlas](../../apps/prototype/src/components/map-canvas.tsx)
is a layout and interaction reference, not a production map source. Likewise,
its in-memory corrections, simulated scan, preview-only Replay, and unpublishable
Highlight are reference flows whose real capabilities are delivered under the
accepted product decisions and owned stories. New product surfaces, including
the browser viewer, extend this screen language without inventing evidence or
publishing private data by default.

## Visual foundation

Living Atlas is a private, precise, cinematic personal atlas. The map and memories
carry the emotion; controls stay clear and quiet. Use rich geography, lush editorial
photo crops, dark architectural surfaces, strong sans typography, matte depth,
and crisp selection. Keep the experience grounded rather than cartoon-like.

| Token | Value | Role |
| --- | --- | --- |
| Rainforest | `#102C26` | Main canvas, dark text on citrus |
| Fern | `#21483B` | Panels, secondary surfaces |
| Limestone | `#F3EEDD` | Primary text, light surfaces |
| Sage | `#B4C6B5` | Supporting text, quiet boundaries |
| Citrus | `#D8EF69` | Primary actions, active selection, focus |
| Clay | `#D98763` | Occasional uncertainty or warm accent |

These are the accepted core colors. Use citrus sparingly so action and selection
remain obvious. Status must include words or icons as well as color. Derive
transparent borders and overlays from these colors, and check contrast over every
background, image, and map layer. New semantic, geographic, or platform-specific
colors require a documented extension; the turquoise/green `map-*` values in the
2026-10-08 [design proposal](../../_bmad-output/planning-artifacts/ux-designs/ux-Travel-Life-2026-10-08/DESIGN.md)
were not implemented and are not official tokens.

Use a strong sans stack. Large, weighty headings establish place and moment;
readable body text explains evidence and choices; small uppercase labels are for
brief nonessential metadata. Let text wrap and panels grow at larger font sizes.
Prototype type sizes and spacing are examples, not a frozen cross-platform scale.
Use a compact spacing rhythm around controls, generous separation between major
moments, softly rounded panels and controls, and circular markers. Keep touch
targets reachable (aim for at least 48 px / platform-equivalent for primary
interactive controls) and visible focus states.

Use matte fills and fine borders for hierarchy. One restrained shadow may lift a
selected sheet. Contours or static grain belong only in open canvas areas, away
from labels and small text. Avoid gray gradients, glossy plastic, decorative
knobs, exaggerated shadows, constant glow, literal skeuomorphism, and ornamental
nature motifs.

Photography provides color and memory, with calm crops and clear provenance.
The prototype's generated landscapes are fictional examples. Production imagery
must follow the owner's access, consent, privacy, and sharing choices.

## Experience patterns

The MLP first loop is private lifetime **Atlas reveal → Replay → owner-selected
Highlight/share**. Make the Atlas map dominant when evidence supports it, with a
chronological Timeline or list that gives equivalent access. Keep year, selection,
status, and correction context understandable across views. A map marker is a
navigation aid, not proof of owner presence or a traveled route. Unknown locations
remain in the list rather than being plotted at invented coordinates.

Use a consistent navigation shell and contextual Back/Home behavior. Atlas,
Replay, and Highlight are clear destinations after the owner reaches the reveal;
Map/Timeline is an Atlas view choice. Preserve meaningful context when moving
between them. The prototype's exact tab placement is a reference, to be adapted
for safe areas, screen size, browser behavior, and platform conventions.

Primary actions use citrus; secondary actions use a quiet outlined or fern
treatment. Selected markers, years, tabs, and media have a clear visual and
semantic state. Journey previews show place, time, image when permitted, and
inferred/confirmed or owner-reviewed status before opening detail. Corrections
and share choices stay editable and reviewable. Sharing begins with no private
history selected by default and shows the exact selected preview before an
explicit publish or export action.

Every state needs a useful next action: loading, sparse evidence, denied or
limited access, unknown coordinates, empty filter, map failure, offline, and
failed media. Explain available-source coverage without implying complete life
coverage. Keep correction and manual-entry paths available where the product
contract calls for them. Do not use synthetic visuals or cinematic transitions to
fill an evidence gap.

## Motion, sound, and accessibility

Everyday controls respond promptly with restrained, interruptible feedback.
Reserve longer cinematic treatment for reveal and replay. Respect reduced-motion
preferences; no task may depend on animation. Sound is off by default. Haptics
may add feedback when supported and permitted, but cannot carry information alone.

Provide semantic labels, focus and selected states, keyboard alternatives for
map interactions, readable contrast, scalable text, logical screen-reader order,
and a reachable Timeline/list fallback. Do not rely on color alone for evidence
status or uncertainty. Validate these on actual target devices and browser
layouts; the prototype is a reference, not proof of production accessibility.

## Applying and extending the system

For each UI story, consult this document and the relevant accepted product
decisions. Reuse the Living Atlas palette, visual hierarchy, navigation language,
state patterns, and evidence wording. Adapt dimensions and native controls to the
surface without introducing a competing visual identity. Record a deliberate
extension or changed owner preference here and in a decision record before it
becomes a new project-wide convention. The separate [mobile UI primitives](../../apps/mobile/src/components/ui.tsx)
currently express the same core palette; a shared code package is optional and
has not been established by this decision.

## Dimensional Atlas extension (2026-10-15)

The private Atlas may offer a small owner-controlled 2D/3D presentation toggle.
Depth is limited to a restrained native-map camera pitch, layered circular local
markers, and a matte map frame; it never adds terrain, routes, buildings,
satellite imagery, or a globe. Citrus identifies the current selected marker
and journey row, with the selected word and accessibility state carrying the
same meaning. Reduce Motion keeps the camera flat and no camera change animates
automatically.

Keep the map visually dominant, while its privacy/tile disclosure stays compact
and reachable. Journey lists are flat, two-line recognition rows: safe title,
observed period, and only necessary owner-readable uncertainty/status words.
Rows wrap at larger text and retain the same selection state as the map.
