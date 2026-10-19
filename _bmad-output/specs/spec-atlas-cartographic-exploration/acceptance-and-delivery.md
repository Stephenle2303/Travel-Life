# Acceptance and gated delivery

## Acceptance cases

Run visual cases using public geography and synthetic journeys only. Capture
viewport size, logical scale, pixel ratio, locale, font scale and asset versions.

| ID | Given / when | Required evidence |
| --- | --- | --- |
| AC-01 | World, country and local views | Country/Admin1 hierarchy readable; measured essential stroke/backing contrast >= 3:1 on representative relief crops |
| AC-02 | Scale 1, 4, 16, 64; pixel ratio 1 and 3 | Stroke widths match band values within 0.25 logical units, not camera-scaled widths |
| AC-03 | Tile LOD changes and edge clips | Line/label/point anchor alignment within 2 logical units of the common projected fixture; no doubled seams |
| AC-04 | New background tiles fail decoding | Unlabelled relief persists; no old border/text ghosting; required overlays/Timeline remain accessible |
| AC-05 | Zoom world -> Vietnam -> local | Country, Admin1 and locality names appear in specified bands; stable 10% hysteresis, no flood of all names |
| AC-06 | Dense labels, selected dot and preview | No geographic-label rectangle overlaps another or reserved touch/control space; deterministic priority/budgets |
| AC-07 | Concave regions, holes, islands, small states | Region anchors on appropriate land component; labels do not imply locality points are province polygons |
| AC-08 | Vietnamese and fallback locale | Diacritics correct, approved names/codes used, missing translations use documented fallback; no fabricated translation |
| AC-09 | Font scale 100% and 200%, dark relief | Text/backing contrast >= 4.5:1; no font shrinking; density reduced without breaking selected journey access |
| AC-10 | Physical pinch and one-to-two-to-one transition | Focal point stays within 4 logical units except world clamping; no camera jump or parent scroll capture leak |
| AC-11 | Double tap, two-finger tap, quick zoom, +/− | Correct direction/focal behavior and shared 1–64 clamp; Fit world reveals the entire map |
| AC-12 | Drag release, new touch, cancel/background/unmount | Inertia stops on new input; cancellation unlocks page; no accidental journey selection; reduced motion suppresses inertia |
| AC-13 | Region-label tap near a journey | Journey hit wins; region tap fits/highlights without changing year/filter; empty tap dismisses preview first |
| AC-14 | Preview -> mixed media -> correction -> Back | Camera/year/search/view/selection retained; changed/deleted/remapped record safely refreshed or closed |
| AC-15 | 1,000 qualified synthetic journeys at multiple scales | Counts match filtered journeys, clustering stable under input reordering; individual dots separate as zoom allows |
| AC-16 | Identical/coarse coordinates or max zoom | Cluster opens correct chooser; all member journeys accessible; no fabricated positional spreading |
| AC-17 | Dot and cluster taps in dense regions | 8/12-unit dots, usable 48-unit targets, nearest-hit arbitration and accessible counts; real selected record opens |
| AC-18 | Ordinary rerender or committed import refresh | No spontaneous world reset or lost eligible journeys; existing Map/Timeline/local-search semantics retained |
| AC-19 | Vietnam data bundle | Current catalog and geometry provenance verified; expected 34 codes at planning baseline, topology/crosswalk/islands checked; no silent old-63 current layer |
| AC-20 | Current basemap and older corrected journey | Basemap vintage explicit; historical owner labels, corrections and evidence untouched |
| AC-21 | Global coverage/source audit | Per-country availability, dated sources, licenses/hashes/attribution recorded; missing regions handled explicitly |
| AC-22 | Airplane-mode cold start and local navigation | Bundled geography/names/journeys available; no private evidence/network requests or fabricated geography fallback |
| AC-23 | G1 synthetic load scene on named Android/iOS devices | Frame/layout/asset/working-set budget measurements attached, or explicit failing gate; startup log is not a benchmark |
| AC-24 | Release candidate | Required checks plus real Android/iOS visual/gesture evidence, privacy/context regression, and owner review; browser parity separately proven if delivered |

## Delivery gates and dependencies

| Gate | Work package and expected artifacts | Exit condition |
| --- | --- | --- |
| G0 — Data truth | Audit current Admin0/Admin1/locality inputs; verify Vietnam catalog + geometry freshness/license; pin source manifest, coverage, topology tests and public synthetic baselines | Required Vietnam data defensible and redistributable. No source chosen merely because its filename says current |
| G1 — Rendering proof | Offline layered spike over Vietnam, Europe and islands; candidate renderer/dependency analysis, line/Unicode/collision/seam checks and measured Android/iOS budgets | Evidence supports chosen renderer, gesture ownership and asset budget; otherwise explicit decision needed before full build |
| G2 — Readable geography | Implement versioned overlays, anchors, locale naming, collision layout, semantic bands and atomic raster-label/border cleanup | AC-01..09 and data cases pass; comparative crops retain approved Obsidian composition |
| G3 — Exploration integration | One camera controller, familiar gestures, actual clusters, hit priority and retained preview/media/correction context | AC-10..18 regressions pass, with physical gesture verification started on both platforms |
| G4 — Delivery acceptance | Offline native builds, performance/large-text/privacy/device review and owner walkthrough; browser only if included in delivery | AC-19..24 and remaining native acceptance pass; honest per-platform evidence ledger |

G2 depends on G0/G1; G3 may develop against synthetic fixtures after G1 but cannot
release over stale data. Do not bypass source or renderer gates with a screenshot.
No fixed estimate is credible before G0/G1 evidence. These are work packages, not
silently approved implementation stories or an instruction to start coding now.

## Test and evidence contract

- Unit: semantic bands/hysteresis, projection, simplification/shared edges,
  anchors, text-rectangle collisions, deterministic cluster counts/hits, camera
  clamp/focal transforms and gesture state transitions.
- Component/integration: tile failure without ghost layers, label lifecycle,
  filtered journeys, preview dismissal, media/correction return and stale record
  guards. Existing root `npm run check`, mobile TypeScript, lint and focused/full
  relevant tests are required during implementation; missing tools are not passes.
- Build/data: reproducible hashes, legal manifest, expected public administrative
  codes, coverage, geometry validity, asset size and no private data in Git.
- Device: physical Android and iOS pinch/quick zoom/drag, dense selection, large
  text, reduced motion, offline cold start, frame time and working-set memory.
  Browser wheel/trackpad/keyboard checks cannot stand in for native gestures.
- Store only public/synthetic visual evidence in versioned artifacts; private
  owner device captures remain in ignored private locations. Record tested build,
  source versions, device/OS and pass/fail/untested separately.

## Planning verdict

The contract has five capabilities, 24 acceptance cases and five dependency gates.
Ready to delegate G0/G1 investigation after implementation is requested; NOT
release-ready or unconditional full-build-ready. Data freshness/license and native
renderer performance remain unresolved engineering gates. No map code was changed
by this planning task.
