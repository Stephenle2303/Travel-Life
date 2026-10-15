# Development plan

## Delivery boundary and current evidence

This is the next Atlas visual change, scoped on 2026-10-15. Keep the earlier completed refinement delivery record historical. Its checkboxes do not replace current source inspection or missing device evidence. Use this folder as the next change's delivery contract; attach implementation results here when work is authorized.

| Current source | Observed baseline | Planned change |
| --- | --- | --- |
| `apps/mobile/src/components/atlas-reveal.tsx` | Native map and list live in one component; fixed 390-unit map; development-only demo style; circle points; inline preview and overlap chooser; list maps generic ActionButtons | Extract scoped presentation components, use explicit map styling and layered markers, replace button-like rows with flat accessible rows and adaptive layout |
| `apps/mobile/src/reveal/types.ts` | AtlasCamera stores center/zoom only; AtlasExploration has view/year/selection/camera; redacted row model lacks owner title | Add validated presentation camera/context fields and minimal local row summary without widening map feature payload |
| `apps/mobile/src/reveal/projection.ts` | Shared year/selection projection | Preserve observed-year filtering and identity; derive deterministic grouping and safe fallback labels |
| `apps/mobile/src/reconstruction/repository.ts` | Owns local committed journey/claim access | Supply bounded safe summary data if needed; never load full JourneyDetail per row |
| `apps/mobile/src/atlas/preview-context.ts`, `components/mobile-screens.tsx` | Ephemeral return context and screen composition | Preserve pitch/bearing/mode and list offset through valid return; establish one vertical scroll owner |
| `components/ui.tsx` | Shared product primitives | Prefer Atlas-scoped row/control tokens; avoid globally restyling unrelated screens |
| `components/journey-media-viewer.tsx`, `app/journey/[id]/correct.tsx` | Existing private media and correction flow | Integration regressions only; retain lifecycle, paging and identity contracts |

Installed package declaration is `@maplibre/maplibre-react-native` `^11.5.0`; resolve the installed version and exported types before using camera/style APIs. No native capability or provider-source schema has been verified by this planning task.

## Visual and interaction contract

### Map: polished depth without terrain

- Keep the Rainforest interface, Limestone text and Fern panels. Candidate geographic extension: deep teal water with slightly lighter land, subtle boundaries and zoom-appropriate labels. Start by deriving shades from existing tokens; if extra hues are needed, name and document them before implementation. Do not bake an untested color into global UI tokens.
- Inspect the actual basemap's vector/raster sources, layer IDs, glyphs, sprites, licenses and attribution first. Recolor supported vector layers through a local style adapter; never invent layer IDs or claim raster tiles were recolored. Avoid remote style mutation.
- Suppress distracting POIs and minor-road detail at broad zoom. Keep enough labels for orientation. No satellite textures, relief shading, terrain data source, extrusion or route overlay.
- Draw ordinary points with a crisp light face, dark outline and a subtle offset underlay. Draw selection in Citrus with a distinct outer ring. One restrained underlay creates depth; no glossy spheres, blinking, pulsation or constant glow. Start near existing 9/13-unit radii; touch targets remain independently generous.
- Preview card: matte Fern surface, fine border, one soft shadow, approximately 16-unit corner radius. Keep attribution and map controls unobstructed. On small screens or large text, place the preview in normal flow rather than cropping it over the map.
- Proposed depth mode is a north-up pitch around 20 degrees, capped at 30; flat mode is zero. Preserve center and zoom when toggling. A compact labelled `2D / 3D` control and `Reset view` action provide a non-gesture path. Avoid a toolbar of zoom/rotate/layer buttons.
- Initial framing uses visible supported anchors, including safe dateline handling. Filter changes preserve a user-moved camera. Selecting a visible point does not move the camera; selecting an offscreen anchored row may gently center it once, preserving zoom/pitch and allowing card padding. No camera motion for an unknown location. Reset explicitly fits the current filtered supported set, north-up, retaining chosen flat/depth mode.
- Suggested transitions: 180-300ms, interruptible. New selection supersedes old animation; manual gesture cancels automatic movement. Reduced motion makes transitions immediate. No idle animation or automatic rotation. Default to flat/no animation while motion preference is unknown; apply no surprise camera transition when it resolves.

### Journey list: simple, minimal, intuitive, visually clear

- Heading: `Journeys` plus filtered count. Quiet year separators, latest comparable observed periods first. A multi-year journey appears once under its latest observed year in All years; year filters still match actual observed years. Unknown dates have their own group; overlapping/uncertain periods retain explicit uncertainty rather than fabricated ordering.
- Each row has two primary lines: safe owner title or `Private journey`; then observed date/period plus a compact worded state. Use only additional exception text needed for `Location unknown`, `Order uncertain`, or review/remap attention. Allow extra wrapping; two lines are a hierarchy, not a clipping rule.
- Do not expose source IDs or ordinals as meaningful titles. If showing an owner title, retain the observed date label and distinguish owner dates inside preview. Status must be backed by committed local state; no invented confirmed status.
- Row surface remains flat. Use whitespace and a fine separator, not nested cards. Selection uses a slim Citrus edge/quiet tint plus accessible selected state; no large Citrus-filled row. Starting size: 72-unit minimum height, 16-18 title, 13-14 metadata, at least 48-unit hit target. Respect platform font scaling.
- The whole row is one selection target. It opens the same in-place preview as a marker; it does not navigate directly to detail. No per-row edit/share/delete buttons, thumbnail grid, chevron forest, badges for every attribute or new search/sort controls.
- Keep routine status readable but compact. Put full explanation and correction in the selected preview; never hide exceptional uncertainty solely behind About. About retains record coverage and actual provider disclosure.
- No media resolution while scrolling. The selected preview can show one already-authorized local image or a video placeholder through the existing guarded loader. Video remains stopped until explicit Play.
- Map selection highlights the row but does not yank list scroll. Row selection preserves its scroll offset. On filter change, deliberately reset list position to the new group start; on Map/Timeline/media return restore the prior valid offset, clamped if content shrinks.

### Responsive composition

- Portrait: compact header and summary, Map/Timeline and year controls, map occupying roughly 45-55% of usable height where practical, then journey rows. Use one page-owned virtualized list with header content; coordinate native map gestures with parent scrolling. No nested same-axis list and no bottom sheet in this scope.
- Wide native window: candidate breakpoint around 900 logical units; 280-340-unit journey column beside flexible map. Keep list and map selection shared. If large text leaves either panel unusable, stack. Preserve state during rotation/resizing; do not remount the map because the selected journey changed.
- In Timeline mode or map failure, list and preview actions remain complete. Web retains its existing fallback; this plan does not add a browser map.

## Ordered work packages

### P0 — Baseline and feasibility (CAP-1, CAP-4)

1. Recheck dirty worktree, error-playbook lessons and current Atlas tests; preserve other work.
2. Capture synthetic current screens and inventory available native camera/style APIs from installed types and official documentation. Inspect configured style/source resources without sending private evidence.
3. Prove pitch, camera event shape, imperative camera control, layer ordering and attribution behavior in a bounded native experiment. Establish real center/zoom/pitch/bearing mappings; do not rely on handwritten component casts to prove API compatibility.
4. Record source-style restrictions and development/release configurations. If source capability blocks styling, identify the exact gap and complete independent list work; production service choice remains unresolved.

Exit: concrete supported API/style approach and baseline evidence; no provider purchase or replacement engine.

### P1 — Dimensional map presentation (CAP-1)

1. Extract `AtlasMap` and Atlas-only visual tokens/style adapter under `src/atlas/` or existing component conventions. Keep loading/failure state owned by Atlas, not module globals that leak between sessions.
2. Apply supported geography colors, label hierarchy, layered markers and selected ring. Keep feature properties limited to opaque journey ID and selected state.
3. Add flat/depth and reset controls using verified APIs; preserve source attribution and safe touch areas.
4. Add reduced-motion handling and interrupted camera transitions. Keep native map fallback if style/module fails.

Exit: synthetic before/after comparison meets D1-D4 and no unsupported native props remain.

### P2 — Minimal journey summaries and list (CAP-2, CAP-4)

1. Define the smallest local summary needed for safe title, observed period, committed state and uncertainty. Reuse existing committed claim reads; add a bounded summary query only if necessary. Keep summary data out of GeoJSON and telemetry.
2. Add grouping/presentation helpers and an Atlas-specific row; update every typed fixture if the contract changes (EP-024). Do not change reconstruction or claim semantics.
3. Replace generic button rows and repeated summary blocks with flat rows and compact header. Choose one vertical scroll owner compatible with virtualization; do not simply nest a FlatList inside existing Screen ScrollView.
4. Apply portrait/wide-native layouts and scalable text. No new row thumbnails, map provider or dependency is assumed.

Exit: D5-D8 and D14-D16 pass with 0, 1, mixed-date and 1,000 synthetic journeys; no full-detail/media read per row.

### P3 — Camera, selection and return continuity (CAP-3)

1. Extend AtlasCamera with validated optional pitch/bearing, and exploration context with depth mode and list position as needed. Old center/zoom-only context defaults safely. Reject non-finite coordinates/zoom/angles; clamp native supported limits.
2. Preserve view/year/selection/camera/offset across mode changes, media and correction. Revalidate selected identity against the refreshed committed projection before displaying any preview.
3. Define explicit event handling for row select, marker select, overlap choice, empty tap, drag/pinch, reset, year change and module/style failure. A drag must not be treated as dismissal; a marker press must not bubble into empty-map dismissal.
4. Retain current gallery paging, video lifecycle and correction contracts. Test stale preview/error and camera callbacks during rapid A-to-B selection, backgrounding, access loss and changed correction successors.

Exit: D9-D13 pass; no regression masked by CSS or snapshot-only assertions.

### P4 — Integrated verification and handoff (all capabilities)

1. Run focused behavioral tests during each package; after integration run `npm --prefix apps/mobile run check`, `npm run check`, and `git diff --check`. Report Expo Doctor/dependency issues separately; missing tools are not passes.
2. Capture synthetic iOS/Android portrait, landscape/wide, selected, dense, empty, map-unavailable and large-text views. Evaluate contrast, marker clarity, card obstruction, row scanning and layout rhythm.
3. On physical target devices verify gesture hit testing, animation interruption, scroll coordination, correction/media return and accessibility. Run map/list stress with 1,000 synthetic rows; record device, build, observations and measured frame/memory data when available. Do not invent performance numbers or imply smoothness from Jest.
4. Inspect synthetic map requests and logs: no titles, dates, URIs, raw IDs or personal coordinates beyond the already accepted coarse viewport boundary. Verify provider copy and release fail-closed behavior.
5. Update this folder's acceptance evidence, project state and error playbook. Keep unresolved device/provider gates explicit. No new AI evaluator is required because reconstruction behavior is unchanged; foundation eval smoke remains required.

Exit: each D case has evidence or an explicit unresolved gate. Feature completion requires native/visual evidence; local implementation, visual acceptance and production provider readiness must be reported separately.

## Dependencies, risk and scope control

P0 precedes native P1; P2 can progress independently of style feasibility. P3 integrates P1/P2; P4 follows integration. Treat these as work packages, not separately authorized development runs or an automatically dispatched stories file.

Highest risks: mismatched native API casts; opaque row IDs becoming private payloads; a pitched map moving under selection; native map swallowing list gestures; large preview obscuring attribution; N+1 title/media reads; restoring obsolete correction identity. Each has a specific acceptance case below rather than a generic visual snapshot.

If a new dependency, schema migration or provider change appears necessary, reassess against this scope before proceeding. Do not expand a presentation change into a reconstruction or backend project. Estimates should follow P0 findings; this plan makes no unsupported calendar promise.
