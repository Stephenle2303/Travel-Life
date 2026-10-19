---
title: 'Make the Obsidian Horizon Atlas visible on every supported surface'
type: 'bugfix'
created: '2026-10-17'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - 'docs/product/design-system.md'
  - 'docs/development/error-playbook.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The newly styled Atlas appears only through the native MapLibre development branch. Web, an older native client, production builds, and an empty/sparse record fall back directly to Timeline, so the owner cannot see the requested map interface.

**Approach:** Render a responsive, local Obsidian Horizon Atlas canvas whenever the optional native map cannot mount or no supported journey is available. It must visibly carry the requested dark-world, glass-controls, search, and selected-card composition on phone portrait and browser without loading map tiles, inventing owner locations, or changing reconstruction data. Native MapLibre remains an optional enhancement when it is available.

</frozen-after-approval>

## Implementation Notes

- Investigation confirmed the map is intentionally unreachable on web, production-style builds, old native clients, and empty Atlas states. The local canvas is the smallest reversible delivery correction; it adds no provider, schema, permission, route, or reconstruction change.
- Added a local Deep Sea Glass canvas that presents the Atlas composition without tiles and plots only existing coarse anchors. MapLibre remains available as the native development enhancement; a native style failure replaces it with the local canvas.
- Added visibility coverage for unavailable native maps, style-load failure, and sparse records. Browser visual verification is blocked by the pre-existing Expo SQLite worker bundle failure; native verification is blocked by the local ADB daemon, so neither is claimed as completed.
- The initially overlooked browser-visible prototype now uses the same Obsidian palette and hierarchy on its bundled synthetic canvas. A live `/reveal` browser check confirmed the visible Atlas composition without calling a map service.

## Review Triage Log

- `prototype surface remained green` — **medium, patch:** the browser-visible prototype still used the earlier green map, which explained why the owner could not see the new design. Reworked its bundled canvas to Obsidian Horizon and added a regression assertion for its visible heading.
- `fallback lacked a visible map surface` — **medium, patch:** web, production-style, old-client, sparse, and style-failure paths previously omitted the map completely. Added the local Deep Sea Glass canvas and tests for unavailable/sparse visibility.
- `fallback zoom controls were inert` — **medium, patch:** local canvas does not apply native camera state. Hide those controls unless the native map can receive the command; the prototype canvas retains its functional local controls.
- `development tiles differ from the local fallback` — **medium, defer:** development-only MapLibre tiles are an existing, explicitly disclosed diagnostic surface. Replacing them needs a deliberate production-map/provider decision, not a visibility fix.
- `native wide destination drawer and desktop controls are incomplete` — **medium, defer:** the prototype already has a two-zone wide composition, but translating all desktop controls/card behavior to the private native screen needs a dedicated responsive Atlas story.
- `browser visual verification was absent` — **medium, patch:** opened `/reveal` in the local prototype and confirmed the visible rendered canvas. The browser-native mobile route remains separately blocked by the existing SQLite worker bundle error.
