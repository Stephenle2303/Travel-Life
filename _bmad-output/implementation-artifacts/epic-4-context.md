# Epic 4 Context: Correct history and share selected facts

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let the owner make their private travel record trustworthy through durable corrections and manual additions, then deliberately turn only chosen facts and memories into a replay or shareable highlight. This completes the MLP's correction-to-sharing loop while preserving evidence uncertainty, preventing accidental publication, and making the limits of revocation and source coverage clear.

## Stories

- Story M4.1: Confirm, reject and edit a journey
- Story M4.2: Add a missing journey manually
- Story M4.3: Control private visibility and exclusion
- Story M4.4: Preview and export a static Travel Life card
- Story M4.5: Publish and manage selected share snapshots
- Story M4.6: Share an interactive journey or lifetime highlight in a browser
- Story M4.7: Preview and export the Travel Life Replay

## Requirements & Constraints

- Keep inferred facts, owner-entered facts, reviewed facts, evidence support, and photo membership distinct. A correction must be durable through restart, rescan, incremental/background updates, and reconstruction changes; ambiguous remaps stay visible for owner resolution rather than being dropped or applied to the wrong successor.
- Let the owner repair history without requiring review of every photo. Manual journeys remain explicitly owner-entered, survive rescans, and never improve automated-recovery metrics. Overlaps require an explicit owner choice rather than a silent merge.
- Treat hiding, exclusion from reconstruction, and deletion as different actions. Explain their effects on local history, counts, Replay, and sharing; hidden or excluded material must never leak into a preview or published content.
- Sharing starts empty and is always deliberate. Before export or publication, show the exact selected journey or lifetime-highlight fields and media. Inferred material requires review before it is shareable; previews and cancellation must not upload or publish anything.
- Publish only a versioned, owner-protected snapshot and selected sanitized media derivatives. Never upload the full library, source metadata, hidden places, precise private locations, or source IDs. Snapshot content remains stable despite later private/background changes until the owner explicitly republishes.
- Published links are unlisted, high-entropy, expiry-aware, revocable, and protected against cross-owner reads and writes. Enforce media/upload limits, strip metadata and unsafe content, prevent indexing/caching where applicable, and distinguish revoking future access from deleting copies recipients already saved.
- The browser viewer must work without app installation or recipient login, offer responsive map, chronological timeline, and selected-memory browsing, and retain a usable list fallback when maps fail. Do not expose source references, access tokens, or private content through telemetry or analytics.
- Replay is a 30–60 second, target-45-second, silent 720p MP4 using chronological observed destinations and owner-visible eligible memories. It must be previewable, cancelable, bounded in resource use, resilient to unavailable media, and use destination transitions rather than invented routes, duration, narration, or music. Native video export and link publication are separate explicit actions.
- Validate correction, visibility, selected-content provenance, snapshot/media isolation, expiry/revocation, and Replay fidelity with objective regressions and real iOS/Android plus browser checks. Record unrun provider/model checks as untested; do not equate synthetic coverage with population accuracy.

## Technical Decisions

- The local SQLite travel graph remains canonical. Retain stable evidence, association, boundary, correction, identity-lineage, visibility, and provenance data so correction replay is deterministic and conflicts can be surfaced honestly.
- Original media remains in the device source. Do not put raw evidence, precise locations, media, private traces, credentials, or source identifiers in Git, logs, or analytics. Share only deliberately selected sanitized derivatives.
- Apply correction and visibility precedence before reconstruction-derived display, counts, Replay selection, and share-preview construction. Private maintenance can reconcile the local record but must never automatically alter a published snapshot.
- Preserve the local baseline and useful failure states when optional AI, media availability, network, renderer, or map services fail. AI consent and private-media processing remain separate from library permission.
- Use minimal allowlisted telemetry only, with coarse operational states and counts. Never record journey contents, exact locations, trip dates, filenames, tokens, or raw evidence.

## UX & Interaction Patterns

- Use the Living Atlas language across native and browser surfaces: quiet dark architectural panels, clear editable choices, explicit inferred/owner-reviewed status, and non-colour status cues. Keep touch targets, scalable text, semantic labels, focus states, screen-reader order, and a list alternative available.
- Preserve context between Atlas, journey detail, correction, Replay, and Highlight. Corrections remain secondary to browsing until the owner chooses them, then return the owner to the relevant updated private record.
- Present a photo-led journey detail and clear owner-review controls without claiming that a location proves presence. For loading, sparse evidence, unavailable media, map failure, offline, expired/revoked links, and export failure, state the limitation plainly and provide a useful next action.
- Make the selected Highlight preview the final truth before a publish or export action. Clarify expiry/revoke controls and the non-revocability of recipients' already exported or saved copies.

## Cross-Story Dependencies

- Epic 4 consumes Epic 3's owner-visible Atlas, journey detail, eligible media, shared selection/filter state, truthful availability states, and consistent counts. Changes made here must return to those private views and later share previews.
- M4.1 establishes correction persistence for M4.2 and M4.3. Visibility/exclusion controls in M4.3 gate the static card, versioned snapshots, browser viewer, and Replay. M4.4 depends on M3.4 and M4.3; M4.5 depends on M3.4 and M4.3; M4.6 depends on M4.5; M4.7 depends on M3.3 and M4.3.
- Epic 1 and Epic 2 supply permission/lifecycle handling, local evidence, reconstruction, and correction-preserving reconciliation. Epic 5 consumes Epic 4's privacy-safe funnel events and validates device, browser, background, and revocation behavior for release.
