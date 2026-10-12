# Epic 3 Context: Reveal and explore the travel history

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the reconstructed private record into a meaningful, honest Travel Life Atlas: a map-first lifetime reveal, a synchronized timeline, useful journey and memory detail, and facts that the available evidence can support. This is the first emotional exploration moment in the MLP loop and leads naturally to Replay, correction, and deliberate owner-selected sharing, without overstating source coverage, presence, routes, or certainty.

## Stories

- Story M3.1: Deliver the Travel Life reveal
- Story M3.2: Connect the lifetime map and timeline
- Story M3.3: Open journeys and source-linked memories
- Story M3.4: Display supportable travel statistics

## Requirements & Constraints

- Reveal the owner's available reconstructed lifetime on a private, interactive map. Identify inferred, confirmed, and owner-reviewed information, and state the accessible-source coverage honestly; photo access never proves complete lifetime coverage or owner presence.
- Make the private Atlas map-first when usable evidence exists, then offer Replay. For processing, empty, sparse, failed, limited-access, unknown-location, unavailable-media, offline, and map-service failure states, show the limitation and a useful next action such as import, correction, manual entry, retry, or list exploration. Never fabricate a lifetime story to make a state feel complete.
- Keep map, chronological Timeline/list, year filter, and selected journey synchronized on both iOS and Android. The unfiltered map represents the owner's visible lifetime record. A map interaction must have a usable list alternative; unavailable map services and dense data cannot block access to history.
- Display observed destinations and approximate date information only. Do not draw or imply travelled routes, exact travel duration, travelled distance, or unsupported countries. Unknown coordinates remain reviewable in the list and are never plotted at invented locations.
- Journey detail presents chronological visits, observed date span, eligible trip media, evidence-linked reasons, and uncertain or unassigned photos without duplicating the entire library. Keep a photo's journey membership distinct from its support for a destination or visit.
- Handle revoked library access, missing originals, cloud-only media, and bounded image decoding explicitly. Preserve navigation between Atlas, timeline, and journey detail, and expose paths to the correction actions in Epic 4.
- Compute journey, place, and country counts from recorded status and counting rules. Duplicate copies and unresolved memberships cannot inflate totals; omit unresolved countries and label inferred totals. Recalculate after corrections so Atlas, detail, statistics, and later share previews agree.
- Record minimal reveal, replay, and exploration telemetry only under the telemetry policy. It may use permitted coarse status/count data but must not claim inferred history is verified or include private media, precise locations, trip dates, filenames, or raw record contents.

## Technical Decisions

- Consume the local, durable reconstructed history from Epic 2 and retain its evidence provenance, timestamp precision, timezone uncertainty, support links, owner corrections, exclusions, manual records, and inferred-versus-reviewed status. The Atlas must continue to work from the local baseline when optional AI is unavailable.
- Keep original media in the device photo source. Do not place raw evidence, precise locations, source identifiers, media, or private traces in Git, analytics, or logs. Any journey/media access must respect current permission and record-lifecycle state.
- Use one shared selection/filter state as the contract between map, timeline, detail, and counts. Apply correction and visibility rules before display and calculation; private background reconciliation can update the local record but does not publish anything.
- The P0 Replay uses chronological observed destinations and owner-visible eligible memories; it uses destination transitions rather than a route. Replay generation/export belongs to Epic 4, but Epic 3 must provide the eligible revealed history and truthful unavailable/sparse states it needs.

## UX & Interaction Patterns

- Follow the official Living Atlas screen language: a dominant interactive map, Map/Timeline view choice, year controls, photo-led journey detail, a consistent navigation shell, and contextual Back/Home behavior. Atlas, Replay, and Highlight become clear destinations after the reveal; Map/Timeline remains a view choice within Atlas.
- Use the Living Atlas palette and visual hierarchy: rainforest canvas, fern surfaces, limestone primary text, sage supporting text, restrained citrus for primary actions and selected states, and clay only as an occasional uncertainty accent. Status and uncertainty always use words or icons as well as color.
- Journey previews should make place, time, permitted imagery, and status clear before detail opens. Keep selections, years, filters, and correction context understandable across views. Share selection starts empty and remains editable/reviewable; it is not a default action in this epic.
- Support accessible labels, focus/selected states, scalable text, readable contrast, logical screen-reader order, keyboard alternatives for map interaction, and reachable touch controls. Reserve cinematic motion for reveal and Replay, respect reduced motion, and keep sound off by default.

## Cross-Story Dependencies

- Epic 3 depends on Epic 2's usable local reconstruction, including M2.5 recovery behavior. M3.1 supplies the reveal before the synchronized map/timeline in M3.2; M3.3 consumes that navigation state; M3.4 relies on detail and the same visibility/counting rules.
- Epic 4 consumes M3 detail, correction entry points, consistent statistics, and the revealed owner-visible history for Replay and selected sharing. Corrections, exclusions, manual entries, and incremental updates from Epics 1, 2, and 4 must return to Epic 3 as updated private local state.
