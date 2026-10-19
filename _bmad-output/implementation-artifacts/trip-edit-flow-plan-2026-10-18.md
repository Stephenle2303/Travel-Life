# Trip Edit flow and correction reliability plan

Date: 2026-10-18

Status: five-task information architecture approved; detailed delivery plan proposed; implementation not started

Owner direction: a lean, low-copy, self-service Edit flow. The selected trip card shows `See photos & videos`, then `Edit`. `Correct location` is a separate task under Edit.

## Problem and boundary

The current correction screen is one long form mixing place search, owner name/date, trip grouping decisions, destination structure, media membership, remap recovery, and evidence explanations. Selecting a place sets an internal preview but leaves the search field unchanged; confirmation is rendered in another panel. The owner has repeatedly confirmed Phú Quốc on Android without seeing the trip label or map dot change. The last fixture-level correction is not device-accepted; the remaining cause is unknown (error playbook, place-confirmation recurrence).

This plan changes the trip editing experience and the truthfulness of correction outcomes. It does **not** change inferred evidence, assert owner presence from photos, add a network geocoder, publish private data, or treat a successful test/build as device acceptance. Keep the existing local correction revision/remap model and the Living Atlas visual system unless a work package below explicitly requires a compatible migration.

## Information architecture and navigation

```text
Atlas trip card (map or Timeline selection)
  See photos & videos
  Edit
    Location
    Name & dates
    Destinations
    Photos in this trip
    Trip accuracy
```

- The card uses a compact dismiss `×` in the header, not a full-width `Close` button above its actions. `Edit` is directly below `See photos & videos`; remove the competing card-level `Correct location` action. Journey detail, if entered by another route, exposes the same `Edit` entry rather than a different correction path.
- `Edit trip` is a dedicated, keyboard-safe screen with five tappable rows in the order above. Each row has a short label, current value/status if useful, and a chevron. No media grid, editable form, evidence paragraph, or correction preview is rendered on this hub. Use a clear Back to the selected trip.
- Each row opens an independent task screen. Back returns to Edit with its previous scroll position; closing Edit returns to the same selected Atlas trip and Map/Timeline/year context. Do not reset to an unrelated trip or reveal raw internal IDs.
- If a save changes the trip's display identity or anchor, navigate using the committed successor's opaque display ID. Recenter/focus the selected map marker only when a verified new anchor exists; do not invent coordinates. Timeline must show the same committed label and state.
- Keep trip name and location distinct. If the owner has set a custom trip name, it may remain the card title after a location change, but the chosen location must be visible as a separate compact line and the marker must move. A custom title must never hide whether the location correction applied.
- A pending-remap or pending-scope-review issue appears as one concise, contextual `Needs review` row/banner linked to the affected task, not a standing wall of warnings. The owner can inspect and discard a withheld correction with the existing guarded preview; no correction is silently reapplied to a different trip.

## Task behavior

### 1. Location

- Show the current display place and its `Inferred` or `Chosen by you` state. One brief hint where needed: the choice changes the private trip label/map marker, not photo evidence.
- Search is on-device. Results display place plus context. A result tap sets the selected place **and replaces the text in the search field** with its display name/context; results collapse. Typing, clearing, or selecting another result invalidates the prior selection. The confirmation CTA stays immediately under the field/selected result, within the same visual section.
- Enable `Confirm place` only for a valid selected result that differs from the current owner choice. A typed string alone is never treated as a selected geocoded place. Back/cancel makes no mutation. Preserve the draft across a recoverable save error or stale-snapshot reload where possible.
- Search coverage must be honest: the present offline index is Admin-1 plus one reviewed island result, not arbitrary world place search. Expand a versioned, licensed **offline** catalogue for common cities/islands before advertising broad place search. For a genuine no-result case, provide a secondary `Add a place manually` path with owner-entered label and an explicitly chosen coarse map point; do not infer a point from text or send the query to a provider. Validate name, bounds, coordinate coarsening, and provenance in the same local correction contract. If the map is unavailable, do not pretend a manual marker can be set; offer retry or continued offline text search.
- While saving, disable duplicate submits. Return `Saved` only after the committed correction application and redacted reveal for the correct successor trip both contain the selected place and expected coarsened anchor. Otherwise distinguish: not saved; saved but awaiting local update; or saved but not reflected (recoverable error). Never show `Place updated` merely because a refresh function returned.
- On verified success, return to the selected trip card/Atlas with its new label and marker in view. A quiet transient `Location updated` message is enough; no extra success page.

### 2. Name & dates

- Show the owner's current name/date claim separately from observed photo dates. Keep one concise provenance hint on this task, not the Edit hub.
- Permit changing the name without inventing a date, and changing/removing an owner date without requiring a new name. Make the owner claim a nullable `{title?, date?}` composite: each save writes the full *resulting* owner claim, carrying any unchanged owner-entered field forward, and supersedes the prior claim revision. Existing combined rows read unchanged; nullable existing `owner_title`/date columns can represent a partial claim after validation/read-path changes, so no destructive table rewrite is needed. Removing the last owner field clears the claim and restores the inferred display fallback. Partial claims must never be interpreted as observed evidence.
- Date entry offers exact day or approximate range. Validate real calendar dates and ordered ranges. Do not silently substitute observed first/last photo timestamps for travel dates. Preview only if the change has meaningful scope consequences; ordinary rename should have one Save action.

### 3. Destinations

- Show the trip's observed destinations as concise rows. A row may offer `Remove from trip`; never say the underlying photo/visit was deleted. Put `Split trip` and `Merge with another trip` behind explicit task choices, only when candidates/boundaries satisfy the current ordering rules.
- Structural actions show a compact before/after review and one confirmation, because they can change trip identity and withhold predecessor-wide claims. Explain unsupported/uncertain ordering at the point of action, with no dead CTA. After save, follow committed successor IDs and surface pending scope review without silently carrying place/name claims to ambiguous successors.

### 4. Photos in this trip

- Reuse the continuous photos-and-videos album and its retained loaded batches. Editing media membership is contextual to a selected item; do not duplicate a long media list in Edit. Provide only valid item actions (`Add to this trip`, `Move here`, `Remove from trip`, `Reject suggestion`) based on current membership and availability.
- A membership action affects association only, not trip evidence, observed visits, country counts, or owner presence. Preserve album scroll position and loaded items after save/back/failure. Uncertain or unavailable media remain explicitly labelled; a bounded local search may be offered when locating unassigned media, without exposing source IDs.

### 5. Trip accuracy

- Describe the scope as trip **grouping**, not proof of presence. Use specific choices such as `These places form one trip` and `These places should not be one trip`; do not label the existing reject action `Not my trip`.
- Confirmation/rejection is scoped to the current reviewed support. Later unseen evidence stays inferred. Show the short consequence beside the chosen action, then require explicit confirmation for rejection. Keep source photos and independently supported visits recoverable. Read back the committed state before showing a success claim.

## Save/projection contract: the P0 reliability gate

1. Reproduce the owner failure without changing or exporting the private database: capture only aggregate/local diagnostic facts for the selected trip and run (whether a place revision exists, its state, whether exactly one final journey application exists, that journey's qualification, and whether durable reveal has the chosen label/anchor). Do not put private IDs, coordinates, media, or raw traces in Git.
2. Write a failing end-to-end repository/provider test for `select → save → committed final journey → qualification → durable reveal → selected Atlas card`. Include a case where pre-continuity and final journey IDs differ; include no match, multiple matches, pending remap, stale snapshot, failed refresh, and lost-response/idempotent retry. The current tests that stub `save` as `applied` do not prove this path.
3. Make correction persistence return a typed outcome that identifies the final **opaque** target display ID and committed revision/run (without leaking raw journey/evidence IDs past the repository). Validate exactly one applied target against the final committed graph before reporting `applied`; preserve the prior complete view on failure. For location, compare place ID plus normalized/coarsened anchor through the same redacted read boundary used by Atlas. A mismatched or absent target is a visible non-success state with retry/reload, not a success banner.
4. Publish the verified durable projection and selected successor as one coherent UI transition. Guard against concurrent maintenance/rebuild/lifecycle invalidation; the returned snapshot must still be current when the UI navigates. Preserve command-key idempotency and do not create a second revision on retry.
5. Inspect and repair the actual failing branch revealed by diagnostics; the prior final-ID fix may remain necessary but must not be assumed sufficient. Add a regression for the verified cause and update the open playbook entry with correction and device evidence.

Likely implementation seams: `atlas-reveal.tsx` and `journey-detail.tsx` for entry points; a dedicated Edit route and focused task components in place of the monolithic `journey-correction.tsx`; `photo-access/provider.tsx` for truthful publication and navigation outcome; `reconstruction/repository.ts` and `reveal/types.ts` for final-target/read-back and partial owner claims; the existing correction, provider, Atlas and gallery test suites for regression coverage. Preserve current unrelated map/cartography changes in the shared worktree.

## Implementation sequence and exit checks

| Work package | Scope | Exit evidence |
| --- | --- | --- |
| A. Diagnose location save | Trace one owner-selected trip through local revision/application/qualification/reveal; build synthetic reproduction | Cause identified or explicitly still unknown; no private evidence exported |
| B. Truthful save contract | Final-target mapping, read-back, typed applied/pending/error state, idempotent retry | Automated success and adversarial failure paths; no false `applied` |
| C. Entry and Edit hub | Trip card order, shared Edit route, five concise rows, context-preserving back | Map/Timeline/detail navigation and accessibility tests |
| D. Five task screens | Progressive disclosure and the behaviors above; compatible partial name/date storage; offline search coverage/manual fallback | Focused UI/repository tests per task, migration tests, no cross-task state leakage |
| E. Device acceptance | Load current Android build without clearing owner data; manually test real Feb 2022 Phú Quốc trip, then another trip; verify map and Timeline after relaunch | Owner sees chosen place in field, adjacent CTA, changed label and marker, retained correction after reopen |

P0 order is A → B → the Location portion of C/D → E for the reported failure; finish the other four task screens and regressions before calling the full Edit redesign complete. Do not stop after only focused tests or a successful Android install.

Required verification: failing-before/fixed-after regression, focused mobile tests, full mobile typecheck/lint/tests, root `npm run check`, `git diff --check`, accessibility checks (keyboard-open tap, screen reader labels, 48px targets, large text, Android Back), and physical Android flow. Test correction isolation across subsequent rebuilds and across two distinct trips. Device startup/bundle logs alone do not satisfy product acceptance. Keep source media, precise personal locations and private diagnostic output out of Git and model calls.

## Acceptance criteria

- **AC-01** The trip card shows `See photos & videos` immediately followed by `Edit`; no competing `Correct location` CTA appears there or in Timeline rows.
- **AC-02** Edit has exactly the five approved top-level tasks. Each opens one focused flow; Back preserves the selected trip and Atlas context.
- **AC-03** Location search selection fills the input with the selected place, places `Confirm place` in the same section, and cannot save a free-typed unselected string.
- **AC-04** Saving Phú Quốc changes the same Feb 2022 trip's displayed place and coarse marker on both Atlas Map and Timeline, including after app relaunch; a second distinct trip can be corrected independently.
- **AC-05** No save reports `applied` when the final committed target or durable reveal does not match. Pending, stale and failed states have concise recoverable actions and preserve the last committed trip/media view.
- **AC-06** Name and owner dates are independently editable without rewriting observed evidence; existing combined claims migrate/read correctly.
- **AC-07** Destination structure, photo membership and trip-grouping changes affect only their documented scope, remain correct after reconstruction, and never silently transfer claims to ambiguous successors.
- **AC-08** Edit, album and map navigation remain usable with keyboard open, Android Back, screen reader and large text; album batches/scroll context survive media edits.
- **AC-09** Offline search or manual fallback lets an owner choose another supported place without a hard-coded Phú Quốc-only path; no query or private location is sent to a new provider.

No measured trip-recognition accuracy or launch-readiness claim follows from these checks.
