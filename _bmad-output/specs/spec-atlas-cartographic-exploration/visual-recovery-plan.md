# Reference fidelity and Google-inspired exploration recovery

Planning revision: 2026-10-18. Owner rejected the implemented border treatment.
This companion takes precedence over conflicting numeric styling, clustering and
delivery defaults in earlier companions. CAP-1..5 and AC-01..24 remain stable.
No implementation or physical-device acceptance is claimed by this revision.

## What the supplied reference actually shows

The supplied 1024×639 image is a wide composition, not a portrait screenshot.
Its geography dominates: dark navy oceans, blue-grey shaded land, soft coastal
light and a curved world silhouette. The relief creates depth before linework
does. Borders are fine, muted warm lines embedded in the land texture; coastline
edges are largely defined by tonal separation. Bright cyan/amber is concentrated
at focal nodes, not spread uniformly around every polygon. Labels are sparse and
small, with a clear distinction between geography and selected destinations.

These observations come from the attached reference, not extracted style tokens.
Exact colors, stroke widths and the printed projection name are not evidence of
the image's underlying rendering equation. Measure proposed values on rendered
crops; do not promise identical geography from an illustrative reference.

Retain previously deferred search-pill redesign, mode dock, compass, route arcs
and persistent card redesign as deferred. They are not necessary to repair the
map. Decorative luminous nodes must never be confused with actual private trips.
On phones preserve the visual hierarchy, not the literal 16:9 dimensions: a
world-fit overview may contain ocean space; country exploration uses the available
map viewport. Do not crop poles merely to fill portrait space.

## Verified source defects requiring repair

1. **Projection regression introduced by the previous review.** Let
   `k = .94 / (pi + 2)`. Boundaries/tiles use normalized vertical coordinate
   `.5 - rawY*k*1.6`. The original marker expression
   `.5 - rawY*(2048*k)/1280` is identical because `2048/1280 = 1.6`.
   The latest marker/base builder adds another `*1.6`, yielding `2.56*k`.
   Therefore base/markers and detail tiles/borders disagree. The previous review
   finding was false; its correction created a real regression. Repair this
   before assessing border placement or LOD transitions.
2. **Heavy outlines.** `boundaryStroke` specifies 1.5–2 logical-unit gold lines
   on 3.5–4-unit dark casings. On a phone this gives geography a heavy outlined
   appearance. It is not the fine warm linework seen in the reference.
3. **Wrong boundary primitives.** The generator traces entire Admin0 polygon
   rings, including coasts/islands and shared borders. Per-country simplification
   can make neighboring outlines diverge into slivers. Identical opaque strokes
   do not necessarily double brightness, so the earlier claim of automatic
   brightness accumulation was too strong; redundant drawing and mismatched
   simplified paths remain concrete risks.
4. **One simplification for every zoom.** `spaced()` drops vertices using a
   1.2-unit threshold in the 2048-wide reference plane. At phone fit width 334
   and 64× zoom, that reference spacing represents about 12.5 screen units.
   This is not a measured error bound, but explains why fixed coarse geometry
   cannot guarantee detailed curves at deep zoom. SVG alone does not solve this.
5. **Sparse hard-coded geography.** A short hand-authored country/city list
   cannot satisfy global coverage or current province names. Labels need public
   source IDs, language fields, importance, anchors and a coverage ledger.
6. **Acceptance failed.** Earlier tests checked presence and internal helper
   relationships, not independent geographic alignment or actual reference
   fidelity. A successful build did not establish the owner-visible result.

## Google patterns to adopt

See [research evidence](google-maps-experience-research.md) for sources and limits.

| Pattern | Travel Life contract |
| --- | --- |
| Direct manipulation | Drag follows the finger; pinch translates and scales around its centroid. New input interrupts camera animation immediately. |
| Familiar shortcuts | Double tap zooms in; two-finger tap zooms out; second-tap hold and drag down zooms in, up zooms out. Retain accessible +/− and Fit world. |
| Progressive detail | Change geographic geometry detail, label candidates and line hierarchy as usable screen space increases; do not enlarge a static composition. |
| Camera-aware panels | Selection pans only if needed to keep the selected point inside the unobscured map rectangle; layout/padding changes do not reset the camera. |
| Clusters | Distinct nearby anchors expand to fit on tap; identical coarse anchors or the zoom limit open the chooser. Do not silently replace expansion with a list for every cluster. |
| Quiet context | Selected journey and its label outrank optional place labels; hide lower-priority labels when they collide. |
| Recoverable exploration | Dismiss the preview to return to the same view; media/correction preserves camera, filter and selection subject to record validity. |

Gesture times, inertia constants and clustering details in this plan are our
tuning choices, not claimed Google internals. SDK behavior is documented; the
current consumer app has not been exercised side-by-side in this research run.
Google's documented Mercator camera is different from our accepted Winkel Tripel
overview. Adopt interaction semantics without substituting projection implicitly.

## Target visual grammar

Build one recommended treatment and compare it at world, Southeast Asia,
Vietnam and city-region scales. Values below are starting candidates, not a new
unvalidated acceptance specification.

| Layer | World | Country / local |
| --- | --- | --- |
| Relief | Muted steel-blue land and navy water; broad calm texture | Reduce relief contrast slightly behind names; source resolution increases with scale |
| Coast | Tonal separation, optional very fine cool line | Smooth finer geometry; no gold perimeter around every island |
| Country boundary | One muted gold stroke, roughly 0.5–0.75 dp | Roughly 0.75–1 dp, stable screen width |
| Province boundary | Hidden | Lower-emphasis slate/warm grey, roughly 0.4–0.65 dp; only verified coverage |
| Geographic text | Sparse warm ivory; ocean names quieter | Country → province → locality hierarchy; reduce density for large text |
| Journey dots | Existing small points / legible clusters | Constant visual size; selected point has a restrained distinct ring |

Remove universal dark casings. Do not enforce 3:1 on every decorative background
line: that previous rule encouraged the rejected treatment. Required controls,
selection and readable information must remain accessible; geography can be
supported by labels and a clear selected-boundary treatment. Text must retain
4.5:1 on its effective background. A subtle text halo is preferable to a dark
rectangular badge behind every place name. Verify halo and line rendering on
device pixel ratios 1/2/3, including 200% font scale.

## Geometry, labels and renderer contract

- Generate a shared-arc topology once, then extract each internal boundary once.
  Keep coast, Admin0, Admin1 and disputed-boundary categories separate. Simplify
  shared arcs jointly and retain holes, islands and junctions.
- Produce world/regional/country detail levels with measured screen-space error
  bounds, targeting <=1 dp deviation from the selected source at maximum scale
  of each level. Do not reuse the fixed vertex-distance filter as an error bound.
  If source precision cannot support local geography, replace that source before
  promising local detail. Do not smooth by inventing geographical curves.
- Use one normalized projection contract shared by generated assets and runtime.
  Include independent public control-point coordinates and golden captures so
  two equally wrong functions cannot validate each other.
- Keep labels independent of raster tile loading. Use public geographic anchors,
  stable IDs and exact measured bounds cached by font/locale/scale. Measure
  candidates invisibly before display; reserve controls, preview and touch areas.
  Keep admitted labels stable during gestures; re-layout on idle or meaningful
  thresholds without flashing. Avoid initial zero-sized collision boxes.
- Keep camera gesture updates on an appropriate native/UI-thread path; evaluate
  the already installed gesture/reanimated stack before adding another renderer.
  Heavy geometry, labels and pairwise clustering must not rebuild on every move.
  Cull by viewport; use a spatial index with bounded work and cache by generation.
- Avoid single-link clustering that chains distant points into a huge component.
  Choose bounded-radius clusters with deterministic ownership and nearest-target
  hit arbitration. Visual grouping and 48 dp hit accessibility are related but
  do not require merging every chain of overlapping hit boxes. Every eligible
  journey remains reachable; selected identity survives clustering.
- Keep the existing offline renderer as the first candidate. A native map engine
  may improve camera behavior but introduces projection/data-pack tradeoffs.
  No automatic Google/online provider change. Escalate only after a measured
  spike demonstrates the current architecture cannot meet the required behavior.

## Delivery sequence and stop conditions

| Phase | Concrete output | Exit evidence |
| --- | --- | --- |
| P0: Restore geographic correctness | Fix double vertical factor; version base, tiles, boundaries and marker transform together | Analytic projected control points agree within 2 dp across fit/4×/16×/64× and LOD transitions; world extent unclipped. Evaluate visible raster edges against the active LOD's pixel footprint, not an enlarged 2048px fallback |
| P1: Visual master | Deduplicated coastline/country mesh, multi-detail geometry, proposed fine strokes and sparse labels | Actual renderer captures of world, Europe, Vietnam and island coast at phone and wide sizes; compare against reference composition; owner can review before broad rollout |
| P2: Data and labels | Source-derived global countries/localities, verified Vietnam provincial bundle, coverage manifest and collision layout | Freshness, license, code coverage, topology, Unicode, anchor and large-text checks; no stale 63-region fallback |
| P3: Camera and selection | Shared camera controller, gestures, interrupted animations, bounded clustering, padded preview | Physical finger recordings on Android/iOS; 20 repeated interactions without accidental selection, focus jump or scroll-lock leak |
| P4: Delivery | Compatible asset bundle, offline build, performance results and visual evidence sheet | Clean-checkout packaging, required checks, owner visual acceptance and device criteria below |

P0/P1 can proceed with existing public Admin0 data and synthetic trips while
Vietnam Admin1 sourcing runs independently. The complete country/province
experience cannot be declared delivered until P2's required data is verified.
This separates useful visual repair from the unresolved data gate without hiding
missing scope. No estimated completion date before P0/P1 and source feasibility.

For raster checks record active source pixel size on screen and resampling method.
Use control-point grids generated from independently known coordinates to test
registration, then coastline comparisons at the active detail resolution. At
334 dp fit width and 64×, one 2048px base pixel spans about 10.44 dp; a 2 dp
coastline-sharpness requirement on that fallback is physically inappropriate.
The fallback must stay registered while its reduced sharpness is reported.

Keep stages reversible at the compatible map-asset bundle boundary. No deletion
or recreation of private history, media, corrections or user worktree changes.

## Acceptance additions and revisions

- **AC-01 revised:** Fine line hierarchy matches the accepted reference treatment;
  optional borders do not dominate relief or journey dots. Replace mandatory
  universal casing and decorative-line 3:1 rule with a visual comparison plus
  accessible selected/essential content. Country/Admin1 distinction remains clear.
- **AC-02 revised:** Width matches accepted P1 token values, not obsolete 1.5–2 dp
  defaults. Boundaries remain screen-space lines through every zoom band.
- **AC-03 strengthened:** Independently projected control points, coast/line
  overlays and base/detail tiles agree; check both high and low latitude, both
  hemispheres and transitions. Explicitly catches the 1.6 versus 2.56 regression.
- **AC-15 strengthened:** Input-order stability plus no long chain clusters;
  all filtered journeys counted exactly once; cluster tap expands distinct points.
- **AC-25:** Side-by-side actual-renderer captures at 390×844, 844×390 and
  1024×639 with public/synthetic content. Reference comparison covers land/ocean
  balance, contour weight, label density, hierarchy and coastline smoothness.
  The phone map viewport dimensions are recorded separately from screen size.
- **AC-26:** First render, font change, locale change and LOD swap show no
  label collision flash, detached names, ghost outlines or oversized dots.
- **AC-27:** On named Android/iOS hardware target 60 Hz interaction; record p95
  frame time (target <=20ms, investigate sustained frames >32ms), cold-start time,
  asset bytes and peak map memory. Existing <=80ms idle-layout and <=64MiB memory
  targets remain provisional until profiling. Missing measurements are untested.

Capture one reproducible walkthrough: world → Southeast Asia → Vietnam → dense
synthetic destinations → cluster expansion → journey preview → media → Back →
Fit world. Exercise pinch, one-handed zoom, abrupt reversal, touch over labels,
interruptions and offline failure. Native screenshots alone cannot prove gestures;
Jest results cannot prove cartographic beauty. Implementation status stays
awaiting visual/device acceptance until both are demonstrated.

## Remaining uncertainties

- Current redistributable Vietnam Admin1 geometry remains unresolved. The 34-unit
  baseline comes from the earlier catalog audit and must be revalidated at build
  time, not treated as newly confirmed by this Google-focused research.
- No current phone screenshot was obtained in this planning run. Source defects
  above are confirmed from code/math; exact on-device appearance and performance
  remain unmeasured. Do not infer them from a successful install.
- Full Google street/building detail and their complete global data coverage are
  outside this travel-atlas plan. Locality/province exploration must still be
  meaningful; merely increasing the camera limit is not a substitute for data.
