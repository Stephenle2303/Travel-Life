- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: V1.1 base-distance qualification does not yet deduct retained location or Home-area uncertainty radii.
  evidence: The current threshold compares point distance only; a detector-policy change needs bounded uncertainty inputs and dedicated evaluation before changing automatic trip decisions.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: V1.1 persists unqualified internal journey candidates although the Atlas reveal hides them.
  evidence: `reconstruction_journey` stores candidate projections while `loadDurableReveal` filters to confirmed qualification rows; separating detector candidates requires a migration and correction/remap review.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-named-private-home-bases.md`
  summary: Persisted source-provenance qualification needs a full reconciliation-loop fixture.
  evidence: The adapter now preserves explicit non-capture origins and focused tests pass, but the database-loop test double needs a dedicated durable-write assertion before treating this as measured end-to-end coverage.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Add a SQLite-to-Atlas regression for committed country labels and month-range periods.
  evidence: The concurrent continuity change derives those summaries in `loadDurableReveal`, but current tests inject the display record directly and can miss a broken repository association or SQL day projection.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Exercise Home-base rename and confirmed removal from the settings screen through provider rebuild paths.
  evidence: The concurrent Home-base UI renders both actions, but its focused screen test currently covers only creation and direct repository tests do not prove button wiring or confirmation.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Specify and implement a distinct Timeline surface or explicitly retain the map-plus-list behavior.
  evidence: The pre-existing Map/Timeline toggle hides the map but leaves the list continuously mounted; changing that interaction requires a dedicated UX decision.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Fail country labels closed when supported place evidence includes border or invalid resolver results.
  evidence: `resolvePlaceCountryCode` currently ignores abstaining members despite its documented abstention rule.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Complete V1.1 qualification provenance, media-type, session, configured-Home and coordinate-bearing-base integration.
  evidence: The concurrent qualification adapter still promotes source origins, treats episode evidence as images, derives sessions from days, ignores configured Homes at final qualification, and uses a possibly GPS-less representative as a base coordinate.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-obsidian-horizon-map.md`
  summary: Make Home-base mutation refresh/error handling and video review behavior truthful.
  evidence: A failed rebuild can leave the Home-base list stale, stale UPDATE/DELETE commands report success, and a video preview is currently rendered through an image component.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-map-visibility.md`
  summary: Replace the development-only MapLibre demonstration tiles with an approved production map-source decision.
  evidence: The visible local fallback is provider-free, but the optional native development enhancement intentionally still uses disclosed MapLibre demo tiles.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-map-visibility.md`
  summary: Deliver the complete wide native Atlas composition with persistent destination drawer, compact utility controls, and orientation tools.
  evidence: The browser prototype has the two-zone map/list composition, while the native screen remains a mobile-first vertical stack.
- source_spec: `C:\Users\vothi\Desktop\Travel Life\_bmad-output\implementation-artifacts\spec-atlas-readable-cartography.md`
  summary: Prove that all generated offline atlas assets are included by the eventual delivery commit/clean checkout.
  evidence: The active renderer and focused test resolve the generated registry/assets in this explicitly preserved dirty worktree, but this implementation task is not authorized to stage or commit concurrent untracked work; a delivery review must check the complete generated asset set in a clean checkout.
