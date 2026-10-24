# Epic M4 Context: Correct history and share selected facts

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Let an owner correct and control their private travel record, then deliberately preview, export, or publish only selected facts and memories. This epic makes the Atlas-to-Replay-to-selected-Highlight loop trustworthy: corrections survive maintenance, visibility governs every downstream presentation, and sharing never turns private history into public content by default.

## Stories

- Story M4.1: Confirm, reject and edit a journey
- Story M4.2: Add a missing journey manually
- Story M4.3: Control private visibility and exclusion
- Story M4.4: Preview and export a static Travel Life card
- Story M4.5: Publish and manage selected share snapshots
- Story M4.6: Share an interactive journey or lifetime highlight in a browser
- Story M4.7: Preview and export the Travel Life Replay

## Requirements & Constraints

- Preserve the distinction between inferred, confirmed, owner-entered, and reviewed facts; photo-to-journey membership is distinct from evidence that supports a visit. Confirmation covers only the facts and memberships actually reviewed.
- Support practical correction without requiring review of every photo: confirm or reject, rename, date precision and bounds, destination and media changes, journey boundaries, split/merge, and uncertain-media assignment. Corrections must persist through restart, rescan, incremental and background updates. When a split or merge makes a correction ambiguous, keep it pending instead of dropping it or applying it to the wrong successor.
- Manual journeys need minimal destinations and exact or approximate dates, must remain explicitly owner-entered and durable through rescans, and require an explicit owner choice for overlap. Manual changes and corrections must not inflate automated-recovery evaluation.
- Treat hide, reconstruction exclusion, and deletion as distinct actions with clear effects on local views, counts, Replay, and sharing. Apply visibility and correction precedence consistently; sharing is off by default and hidden or excluded content cannot enter a preview.
- Begin all sharing with explicit selection and an exact content preview. Only selected sanitized facts and media may be exported or published; opening or cancelling a preview must not upload or publish. Explain that exported or recipient-saved copies cannot be revoked.
- A published journey or lifetime-highlight snapshot is versioned and stable despite later private/background updates. Publishing and republishing are deliberate; links need expiry, owner revoke controls, protected reads and cross-owner-write denial. Do not upload the full library or expose hidden places, source IDs, private metadata, or unsafe media content.
- The browser experience works without app installation or recipient login, with a responsive selectable map, chronological destination timeline, selected-memory browsing, and a usable list fallback. It must handle invalid, expired, revoked, missing-media, and unsafe-input states while preventing indexing or inappropriate caching.
- A single Replay action automatically prepares and plays each policy-visible scoped trip as an adaptively timed curated chapter. Use a meaningful subset of effective attached photos and videos according to owner intent, supported variety, redundancy, and usable quality; retain every scoped trip and the complete album. Do not add filler or impose a fixed total duration solely because of trip count.
- Replay stays silent and local at 720p, gives honest still/clip/technical and date-precision states, handles unavailable media and progressive long playback, and bounds memory, cache, and background expiry. It may show destination transitions but must never imply routes, presence, travel duration, narration, or music. Video export/share and publication to a selected Highlight are separate, explicit owner actions.
- Verify correction and visibility invariants, selected-content provenance, snapshot/media isolation, expiry/revocation, and Replay behavior. Validate native rendering and export on both iOS and Android, and browser behavior on mobile and desktop; never represent fixture, contract, or synthetic checks as product acceptance.

## Technical Decisions

- Keep the private local travel graph canonical in SQLite with stable evidence, association, boundary, correction, visibility, provenance, and identity-lineage records. Originals remain in the source library; cache only what the product actually needs and clear covered caches on deletion.
- Preserve uncertainty and source limitations end-to-end. A photo location is not proof of owner presence, a trip memory is not necessarily visit support, and corrections take precedence over reconstructed output before private display, counts, Replay curation, or share-preview assembly.
- Optional AI may assist replay curation but must be local-first; any provider visual processing requires purpose-specific consent. Measure optional AI benefit separately from native correctness and retain an honest functioning state when optional AI or media rendering is unavailable.
- Keep media, precise locations, raw evidence, source references, access tokens, and private journey content out of analytics, logs, and published payloads. Snapshot and media access require owner-isolated authorization, while recipients can use a valid unlisted link without an app account.

## UX & Interaction Patterns

- Follow the Living Atlas system across mobile and browser surfaces: preserve context among Atlas, journey detail, correction, Replay, and Highlight; use readable, scalable text, accessible labels and controls, non-colour status cues, and list alternatives for map failure or accessibility needs.
- Journey detail is photo-led and makes evidence, uncertainty, and owner-review state clear. Sparse evidence, unavailable media, loading, export failure, offline operation, and revoked/expired shares must state the real limitation and offer a useful next action rather than inventing a story.
- Replay is a private cinematic destination presentation with quiet loading, accessible playback, optional persistent edit controls, and separate Share controls. The Highlight starts with nothing selected and exposes the exact selected preview before any deliberate publish or export.

## Cross-Story Dependencies

- M4.1 establishes durable correction behavior for M4.2 and M4.3. M4.3's visibility and exclusion rules gate the static card, selected snapshots, browser viewer, and Replay; M4.4 and M4.5 require M3.4, M4.6 requires M4.5, and M4.7 requires M3.3 plus M4.3.
- Epic M4 consumes Epic M3's private Atlas, journey detail, eligible media, selection/filter state, and counts. Epic M1 and M2 supply private evidence, permission/lifecycle handling, reconstruction, and correction-preserving maintenance. Epic M5 validates release behavior across devices, browsers, background operation, and revocation.
