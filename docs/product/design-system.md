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

## Mandatory experience principles (owner direction, 2026-10-24)

Design from the owner's task and what they can see, recognize and do. Every new
screen, build or rebuild must reference this system and its closest approved
screen pattern before implementation. This amendment governs interaction where
an older prototype or agent-selected control layout conflicts with it.

- **Lean and self-serve:** one obvious primary action per state; familiar controls,
  simple navigation and short contextual labels. Prefer recognizable content and
  visible state to instructions. Keep necessary privacy/error explanations close
  to their action; do not replace clarity with unexplained icons.
- **Few steps:** expose the task in its existing context. Avoid setup wizards,
  confirmation chains and separate technical preparation screens. Use progressive
  disclosure for secondary options without hiding the core task.
- **Visual decisions:** show the actual photo, video poster or relevant preview
  beside a choice. A date, item number, media type or source ID cannot substitute
  for recognizable media. Selected state must be visible and accessible.
- **Responsive work:** acknowledge taps immediately. Resolve, prepare, render and
  verify automatically behind the user's task. Long operations show an updating
  progress bar and measured percentage when total work is known; use an
  indeterminate bar with a brief activity label while the total is unknown.
  Never invent progress or show completion before verification finishes.
- **Safe continuity:** retain trip, scroll and working selection on contextual
  returns. Make ordinary edits reversible; reserve confirmation for genuinely
  destructive actions. Editing a Replay never deletes source media or trip facts.
- **User review is the bar:** verify the actual phone layout, media recognition,
  selection state, return navigation, large text and loading/recovery behavior.
  Source review, host tests and mockups alone do not establish intuitive UX.

For each UI delivery, record the reference used, the short user action path and
the actual viewport evidence in its existing story/spec. More explanatory text
is not a remedy for controls whose purpose or target cannot be recognized.

### Replay Edit: a visual trip editor

Keep the Replay preview and a compact trip strip in context. Selecting a trip
reveals its photo/video grid directly in the editor, following Journey List's
`See photos` gallery language. Show recognizable thumbnails, video posters,
selection checkmarks and a concise selected count. Tap a tile to include/exclude;
provide a distinct accessible expand control to inspect the item without changing
selection. Keep Done reachable. Secondary order and soundtrack settings must not
push media below a wall of text or per-item action buttons.

The grid starts from the current effective private composition, not an empty
selection or every eligible candidate. Selected means included in the committed
Replay after Done; explicit choices must not be silently dropped by automatic
curation. Browse all currently eligible attached candidates for the selected trip
without mounting or decoding the entire lifetime library. Album membership and
Replay inclusion remain separate. Reuse gallery patterns, extending video posters
and selection behavior where existing production components lack them.

See [decision 0014](../decisions/0014-lean-self-serve-replay-editor.md) and the
[Replay interaction contract](../../_bmad-output/specs/spec-m4-7-travel-life-replay/interaction-contract.md)
for behavior and acceptance. This is accepted direction, not a shipped editor.

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
| Replay | [`/replay`](../../apps/prototype/src/app/replay.tsx) | One Replay action automatically prepares and plays a private cinematic destination presentation; optional persistent Edit and separate Share controls. Quiet loading, fixed recovery, retained Atlas context and accessible playback; never imply traveled routes. Decision 0009's interaction amendment supersedes mandatory Prepare. |
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

### Atlas world-map reference target

The owner's 2026-10-18 clarification prioritizes **reference-faithful map
cartography**. The search pill/utility icons, full left mode dock, compass/zoom
slider, route arcs and polished persistent destination card are temporarily
deferred. Real coastline geometry, the curved world silhouette, blue shaded
land, layered navy oceans, gold borders, restrained labels and coastal light
must match the supplied image closely; the recolored fictional geography and
grid fallback do not meet this visual bar. Existing functional exploration
actions remain available. This refinement takes precedence over the broader
interface composition below for the current delivery.

Follow [decision 0013](../decisions/0013-reference-faithful-atlas-cartography.md)
and the [cartography contract](../../_bmad-output/specs/spec-atlas-reference-cartography/SPEC.md).
Static, pre-rendered 2D relief/bathymetric texture is permitted for this visual
match; earlier prohibitions of terrain data do not forbid that texture.
Runtime terrain meshes, elevation APIs and globe mode remain excluded.
Reference screenshots stay comparison material rather than shipped map assets.
An equal-size visual comparison and explicit owner acceptance are required;
automated tests or a restyled placeholder cannot establish visual completion.

The world-map UI supplied by the owner on 2026-10-16 is the direct visual and
composition target for the private Atlas map. Recreate its dominant full-bleed,
dark cinematic world canvas; upper navigation/search region; compact floating
map controls; map-side filter stack; zoom/orientation controls; and a single
right-side selected-place card. On phone portrait layouts, retain the same visual
hierarchy by stacking the selected card below the map and collapsing controls
into reachable compact groups. Recreate the treatment with Travel Life's own
components, labels, map source and authorized media—never the reference image,
its destination photo, or its public-trip claims.

Translate the visible controls to Travel Life's actual private capabilities:
the search field is local-only search for an owner-visible journey or supported
place; the filter stack provides Map/Timeline, years, and evidence-status views;
the selected card shows an owner title when present, separately-labelled observed
period, local authorized cover media, and evidence/review state. It offers
open-media and review/correct actions instead of Save/Plan Trip. Replace generic
"countries visited" copy with the existing qualified-record coverage wording.
No query, selected marker, journey title, date, media URI, source identifier, or
precise personal coordinate may be submitted to a map provider or telemetry.

#### Obsidian Horizon / Deep Sea Glass

This is the authorized **Atlas-only** visual extension. It supersedes the
Rainforest/Fern map-surface treatment for this interface; the core Living Atlas
system continues to govern the rest of the product.

| Token | Value | Atlas use |
| --- | --- | --- |
| Deep Navy Void | `#0B132B` | Canvas and deepest ocean |
| Midnight Blue | `#1C2541` → `#0B132B` | Canvas gradient and depth field |
| Deep Sea Glass | `#131B31` at 75% | Floating cards and docks, with a 1px inner border |
| Luminous Blue | `#1F3159` | Active/hover glass state |
| Cyber Cyan | `#4EA8DE` / `#00B4D8` | Search glow, active controls, primary actions and focus |
| Sunset Amber | `#F3722C` / `#F8961E` | Selected journey waypoint and high-attention action accent |
| Cartography Gold | `#E9C46A` | Supported boundaries and regional map labels only |
| Secondary text | `#8D99AE` | Muted data and contextual copy |

Use Inter or the platform's SF Pro Display equivalent. Map headings are uppercase,
700 weight, with 1.5px tracking; data text is regular-weight white or Secondary
text. Glass cards use a 16px radius, 20px backdrop blur where supported, a subtle
inner border and one restrained shadow. Cyan glow is reserved for active search,
focus and active controls; amber is reserved for selected destinations or an
owner-initiated primary action. Do not use colour alone to communicate evidence,
uncertainty or selection.

The map may use dark cartography, gold boundaries, readable labels and faint
non-personal ocean-current contours as decorative geographic context. It must not
use terrain data, simulate owner routes, or animate destination nodes as if they
are verified movement. A selected Travel Life journey appears as a cyan/amber
waypoint with a strong non-colour selected state; no path is drawn between
journeys. The card's image is only an authorized local cover; its metrics are
owner-relevant period/evidence/review information, never invented "quick facts."

On pointer-capable surfaces, glass components may scale up to `1.02` with a
restrained intensified shadow on hover. Pressed native controls use the equivalent
short feedback. Camera and card transitions are interruptible; reduced motion
removes shimmer, pulsing and camera animation. A shimmer may run once on a newly
revealed static glass surface, never as constant decoration.

Decision [0012](../decisions/0012-dimensional-atlas-and-minimal-list.md) extends
the Atlas direction with richer map color, subtle perspective, dimensional
markers, restrained preview-card depth and responsive motion. The owner explicitly
does not require terrain, mountains, valleys or a globe. Keep journey rows simple,
minimal, intuitive and uncluttered. Core palette and matte interface remain in
force; exact geographic colors and motion values are implementation candidates
in the [development plan](../../_bmad-output/specs/spec-atlas-dimensional-polish/development-plan.md),
not newly accepted global tokens. This records direction, not implemented behavior.

For each UI story, consult this document and the relevant accepted product
decisions. Reuse the Living Atlas palette, visual hierarchy, navigation language,
state patterns, and evidence wording. Adapt dimensions and native controls to the
surface without introducing a competing visual identity. Record a deliberate
extension or changed owner preference here and in a decision record before it
becomes a new project-wide convention. The separate [mobile UI primitives](../../apps/mobile/src/components/ui.tsx)
currently express the same core palette; a shared code package is optional and
has not been established by this decision.
