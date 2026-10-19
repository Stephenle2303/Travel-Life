# Visual target and acceptance

## Reference and comparison protocol

Authority: owner-supplied `C:/Users/vothi/Desktop/World Map.jpg`, displayed at 1024 × 639; SHA-256 `CD096372AFCE7204CEEF851FE85B013BFBE17F7357EC25830367457385195E97`. Recheck dimensions/hash at G0. Keep the reference outside Git unless publication rights are established. Any test copy must remain ignored and local.

The reference calls its projection Winkel Tripel. Begin with that projection, but calibrate against the visible stylized silhouette rather than assuming the label proves an exact mathematical fit. Hidden geography behind cards/docks cannot be recovered pixel-for-pixel from this screenshot; fill it consistently from the same licensed geographic source. Record those areas as unobservable, not verified matches.

For each comparison save: raw app capture, unaltered reference, a side-by-side at identical dimensions, and a half-opacity overlay. Mask only the reference's deferred UI, routes, point halos and unverified travel totals; record mask rectangles/polygons in a versioned manifest. Retain unmasked context alongside masked comparisons. Do not blur, recolor, stretch, crop away geographic errors or add candidate-specific masks to improve apparent similarity.

Use the exact 1024 × 639 reference frame first; the source is not literally 16:9. Separately capture 1440 × 900 and 1280 × 720 landscape, 768 × 1024 tablet and 390 × 844 portrait. Record map viewport bounds, DPR, app route, platform, build identifier, asset version and camera transform. Assess map-only fidelity without surrounding old green shell controls entering the comparison.

## Required appearance

| Category | Reference target | Reject |
| --- | --- | --- |
| Geometry/composition | Recognizable real coastlines, curved world outline, North America left, Europe/Africa center, Asia right, Antarctica lower edge; reference-like proportions and framing | Rounded invented continents, rectangular equirectangular world, default Mercator silhouette, distorted phone crop |
| Land | Teal/slate-blue tonal variation, fine shaded relief and restrained coastal light | Flat polygon fill, saturated green, noisy satellite photography, raised 3D mountains |
| Oceans | Near-black navy with layered depth, shelf/coastal shading, subdued broad current contours | Flat empty rectangle, bright grid, dominant decorative swirls |
| Boundaries | Thin subdued gold geographic borders; readable coastline hierarchy | Neon country outlines, thick glowing borders, invented geopolitical divisions |
| Labels | Sparse gold regional/country labels and muted blue-grey ocean labels, same quiet hierarchy | Fictional geography labels, unreadable dense labels, journey names baked into base |
| Finish | Soft vignette, coherent light direction, textured richness without glare | Visible tiled seams, blurry enlarged bitmap, heavy glow, palette-only approximation |

The existing Atlas tokens guide the palette; final land/ocean shades are calibrated against the reference. Preserve a dark navy foundation around `#0B132B`, with muted cartographic gold derived from `#E9C46A`. Do not flood the base with cyan/amber: those remain personal-selection accents. Reference glows that could imply visits are omitted from the base. Public geographic labels do not imply owner presence. Currents are decorative, static cartography rather than live oceanographic data.

## Acceptance cases

### Visual

- **AC-V01 — recognizable geography:** Given the reference frame and candidate at reset, when compared with deferred overlays masked, then real continent shapes, arrangement and outer silhouette align in the visible geography. At G0 mark at least eight visible landmarks across North America, Greenland, South America, Europe, Africa, India, Australia and Antarctica. At G1 fit one shared projection without per-continent warping; maximum landmark displacement is 2% of the map viewport diagonal. If a stylized reference prevents this, disclose measured residuals for an owner decision before G2; do not silently relax the criterion.
- **AC-V02 — land texture:** Given the map at 1× and approved maximum zoom, when continental interiors and coasts are examined, then relief, blue tone variation and coastline detail are visible without fake geography, pixelation or 3D elevation.
- **AC-V03 — ocean depth:** Given marker-free output, when Atlantic, Pacific and Indian Ocean regions are compared, then the deep navy shading, shelf falloff and faint current treatment meet the reference's hierarchy without dominating land or labels.
- **AC-V04 — border and label hierarchy:** Given all-world and regional views, when borders and labels render, then geography is legible, muted gold borders stay thinner than selection affordances, labels avoid obvious collisions, and font size stays readable as the map is transformed. Hide low-priority labels at compact scale rather than squashing them.
- **AC-V05 — visual sign-off:** Given the comparison package, when the owner reviews it, then every category above has an explicit accepted result or a named revision. No weighted average, unit-test pass or claimed percentage can override an unaccepted category. A re-creation cannot promise identical hidden pixels; visible deviations must be shown.
- **AC-V06 — responsive fidelity:** Given each specified viewport, when the map resets, then the full world fits without horizontal/vertical stretching. Compact layouts allow pan/zoom for detail; map labels do not become the sole way to access journeys. No arbitrary crop hides Australia, the Americas or Antarctica at reset.

### Geographic correctness

- **AC-G01 — common projection:** Given public synthetic anchors in all populated continents and both hemispheres, when map size, pan and zoom change, then marker centers use the same projection, fit bounds and transforms as the base. Registration residual is at most 2 logical pixels against independently generated projection control points at reset and maximum zoom; AC-V01 independently checks reference composition.
- **AC-G02 — seam/range handling:** Given points near ±180°, poles, missing/non-finite coordinates and out-of-range values, when rendered, then valid points are placed/clipped consistently, invalid points are excluded and no spurious edge-to-edge path or crash occurs.
- **AC-G03 — overlap:** Given coincident/nearby journey anchors, when selected, then grouping/choice preserves access to every journey. Never spread markers to invented geographic locations.
- **AC-G04 — camera migration:** Given a previous MapLibre longitude/latitude-plus-zoom context, when the renderer changes, then center is reprojected and scale mapped through an explicit adapter or safely reset with selection/year preserved. Do not interpret Mercator zoom as canvas scale. New pan/zoom state survives media/correction return when its record identity remains valid.

### State and privacy

- **AC-S01:** Given a year/search filter, when visible journeys change, then map/list agree and an excluded selection closes, preserving current stale-result guards.
- **AC-S02:** Given media/correction navigation and a refreshed, removed or ambiguously remapped journey, when returning, then existing committed-record rules safely restore, close or remap selection; never display stale private media.
- **AC-S03:** Given empty, sparse, loading, denied/revoked or disconnected state, when Atlas opens, then the same geographic base appears, with honest state copy and no unauthorized personal points/media. Invalid location data stays in Timeline.
- **AC-S04:** Given keyboard/screen reader, reduced motion or 200% font scale, when exploring, then Timeline and existing actions remain reachable, markers have selected text/state and minimum 48 logical-unit hit areas, and no task depends on shimmer or motion.

### Delivery and resources

- **AC-D01:** Given production Android/iOS release builds in airplane mode, when `/history` opens, then the accepted bundled base loads without `__DEV__`, MapLibre style URLs, credentials or a native-map-module requirement. Observe actual network requests with a cold launch as well as code inspection.
- **AC-D02:** Given browser prototype `/reveal`, when opened on a clean local session, then the same approved asset/projection version renders. Synthetic demo markers use explicit public-coordinate fixtures for the real world; never reuse fictional-region coordinates as if the fictional regions were real places.
- **AC-D03:** Given `/history` integration, when the owner opens the refreshed installed app, then the actual target route shows the new map. Record refresh/install result separately from prototype proof. Mobile-web `/history` is separately blocked until SQLite web support works; it cannot stand in for native delivery.
- **AC-P01:** Given checked-in generation scripts, pinned inputs/config and supported toolchain, when regenerated twice, then geometry/projection/asset versions agree and deterministic outputs match checksums. Record intentional encoder/platform exceptions explicitly.
- **AC-P02:** Given representative Android and iOS devices, when loading and exploring 1,000 synthetic coarse anchors, then grouping/culling bounds interactive nodes, incremental packaged assets are at most 12 MiB, decoded map working set is at most 64 MiB, warm offline readiness is within 2 seconds, and p95 gesture frame time is at most 32 ms over a recorded 10-second gesture run. Measure decoded residency including temporary/swap buffers. These are proposed budgets to prove at G1, not measured performance; changes require a reasoned spec update.
- **AC-P03:** Given missing/corrupt high-resolution artwork, when loading fails, then a verified bundled lower-resolution version can render; if both fail, an explicit recovery state retains Timeline and retry. Never silently substitute abstract blobs or generic tiles and label the visual criterion passed.

## Evidence record

For every AC store `pass | fail | blocked | pending`, artifact path/build, observation, tester and date. All start pending in this plan. G2 requires owner visual acceptance; G4 requires separate Android and iOS evidence. Keep any owner-device screenshots private; use synthetic fixture captures for shareable review artifacts.
