# Project state

## M4.2 manual journey entry (2026-10-19)

Owners can now add a private, explicitly owner-entered journey through a local
offline route. Schema v33 keeps it in `manual_journey`, separate from
reconstruction, evidence, visit-support, and qualification tables. The durable
Atlas/Timeline/detail projection labels it owner-entered, returns no media or
fabricated support, survives rebuild reads, and does not alter recovery counts or
diagnostics. Creation validates the durable read-back before reporting success.

The form supports an offline place result or owner label plus deliberate coarse
point, exact/approximate dates, and an explicit date-range overlap decision. Keep
separate creates a distinct assertion; Edit abandons the draft and opens the
overlapping trip's existing edit route. Atlas exposes the entry from ready,
sparse, and failed states. The full mobile suite passed 37 suites / 313 tests,
TypeScript and lint. Root `npm run check` passed. Expo Doctor remains 20/21 due to the pre-existing
nine Expo SDK patch-version recommendations. Android and iOS create/cancel/
overlap/reopen/rescan/context-return checks remain required device acceptance.

## MapLibre vector-basemap integration (2026-10-18)

Atlas now has an opt-in MapLibre v11 surface backed by a configured MapTiler
vector-style URL. It renders provider-maintained political boundaries and
progressive place labels, while Travel Life supplies only the already-coarsened
private journey GeoJSON and selection state. No provider key, demo URL, public
place-label list, or second map dependency is embedded. The new
`EXPO_PUBLIC_ATLAS_MAP_STYLE_URL` is intentionally blank in `.env.example`;
without a valid HTTPS MapTiler style, or after a style-load failure, Atlas gives
an honest Timeline recovery instead of displaying the legacy hard-coded map.

Focused Atlas coverage (25 tests), full mobile tests (34 suites / 299 tests),
TypeScript, lint, root `npm run check`, and `git diff --check` pass. This is not
device or provider acceptance: an owner-controlled non-demo MapTiler style/key
must be configured and then Android/iOS must verify native pinch/pan, labels,
marker selection, failure recovery, and the provider-request disclosure. Vector
provider detail uses standard map projection rather than claiming the prior
Winkel Tripel visual plane.

**Local Android configuration update (2026-10-18):** The owner supplied a
publishable MapTiler key. It is stored only in ignored `apps/mobile/.env` with
the current `streets-v4-dark` style; the key is not committed. A host-network
style request returned HTTP 200 with a valid style JSON, sources and layers.
Metro was restarted, USB port forwarding reapplied, and the already-installed
Travel Life development client was re-opened on its Atlas route. The filtered
app log contains no new fatal/native/JavaScript failure. This proves local
configuration and startup only, not visual cartography, marker selection, or
physical pinch/pan acceptance; those remain an owner device check.

**Global label follow-up (2026-10-18):** The owner reports that province/city/locality
names remain absent when zooming into China, Mongolia, and other countries, while
Vietnam appears acceptable. Live MapTiler Streets Dark and Outdoor style metadata
both include subdivision labels but stop their state-label layers at zoom 11.
The actual device style/zoom, feature coverage, glyph loading and label collisions
are not yet distinguished. Keep this owner-visible mismatch open; compare matched
viewports across the provider viewer and native app before changing styles.
ADB can reach the owner's Android device, but the latest capture was of Welcome;
Android rejected simulated touch input and a deep link was followed by the lock
screen. Atlas itself has not yet been visually inspected in this diagnostic pass.
The owner need only unlock the phone and leave Atlas showing an affected country;
no ChatGPT image upload is required. No map code or style was changed.

**Global style/data review (2026-10-19):** Live Planet v4 vector-tile samples
at capital locations in 19 countries across six inhabited continents contain
subdivision data, but the configured Streets Dark z7–9 subdivision-label filter
rejects all sampled features in Mongolia, Turkey, Germany, Spain, Egypt, South
Africa, India, Japan, and Australia. Its state-label layers stop at z11 despite
deeper source data. Outdoor v4 repeats the z7–9 filter and also stops state
labels at z11; merely switching to Outdoor is not a verified solution. This is
a confirmed global style/data-schema mismatch for subdivision names, not proof
that city/town glyphs or rendering also fail. The device was locked during this
pass, so same-viewport native acceptance remains open. No map code/style changed.
The same Streets Dark style keeps subdivision borders after labels stop, hides
regular city names at z14 and town/capital names at z16 (the app's maximum
camera zoom), and excludes the tileset's `village` places altogether. Progressive
global naming therefore needs an explicit cross-scale style contract, not only
more zoom range or a default-style swap.

**Android follow-up (2026-10-19):** The owner unlocked the device. Its development
client was at Expo Dev Launcher because Metro was no longer running; Metro and
the ADB reverse route were restored, and Atlas now visibly renders MapLibre.
The captured public map viewport was Québec, not the requested Mongolia; town
names appeared there while subdivision names did not at that high zoom. Scoped
resource logs showed no matching tile/glyph/style errors, which does not prove
every label loads. Mongolia remains unverified on-device. Its sampled Planet v4
subdivision tiles have English names but primary local names containing Mongolian
script, while the current fontstack's requested glyph range lacks U+1800–U+18AF.
This adds a language/font fallback risk to the confirmed zoom/filter defect.
MapTiler Countries `level=1` looks structurally useful but sampled Kenya features
include obsolete province names; it must not be adopted without freshness checks.
No app code or style changed in this diagnostic pass.

**Proposed correction, not implemented:** Keep MapLibre and the configured Planet
v4 vector source. Create an owner-controlled MapTiler style variant that selects
primary subdivisions by data-backed ISO 3166-2 where present, then introduces
finer administrative labels at appropriate zooms without showing every level at
once. Keep city/town context through the app's maximum zoom, add a tested village
band, and use a script-supported language fallback (`name:en` before local `name`
where needed, with verified glyph coverage). Tune density, priority and muted
colors against the accepted Obsidian reference; do not solve omissions by making
all borders/labels heavy. Gate rollout on source/style checks across representative
countries, current administrative-unit checks (including Vietnam and Kenya), and
matched Android/iOS screenshots at world, country and local zoom. A same-viewport
Mongolia device capture remains required before the native symptom is closed.

## Readable cartography and exploration plan (2026-10-18)

Owner accepts the overall map but requests stronger country/province boundaries,
geographic names and Google Maps-inspired behavior. BMAD party/spec produced the
[cartographic exploration contract](../_bmad-output/specs/spec-atlas-cartographic-exploration/SPEC.md):
independent vector boundary and dynamic-label layers over approved Obsidian
relief, progressive detail, real visible journey clusters and familiar 2D gestures.
This is planning only; no app behavior or device result is claimed.

Code/data audit found raster-baked Admin0 borders, only seven base labels, no
Admin1 display layer, and 63 Vietnam regions in the existing destination catalog.
The official post-July-2025 catalog has 34 provincial units. Current UI geometry
freshness/licensing must be verified separately, without rewriting historical
journey/correction data. Five delivery gates and 24 acceptance cases cover source
truth, offline renderer feasibility, readability, context and Android/iOS evidence.
Next authorized build should begin with G0/G1, not another image-resolution patch
or an implicit Google SDK/provider migration.

Planning verification: five paired capabilities, 24 unique acceptance cases, five
gates and seven companion paths validated; whitespace/template checks,
`git diff --check` and root `npm run check` pass (20 foundation tests plus eval
infrastructure smoke). This does not establish native rendering or UX acceptance.

## Zoom-resolution repair (2026-10-18)

The owner reported pixelation after country-level zoom was enabled. The mobile map now overlays visible 512px geographic tiles selected by scale/display density from 4096/8192/16384 world levels. These tiles are freshly projected from the original 10800x5400 Natural Earth relief and country geometry; the 2048px world base is not upscaled to manufacture detail. The 840 WebP tiles total 3,666,258 bytes. The selector culls offscreen tiles and caps active tiles at 48; detail images disable cache accumulation and failed tile decodes retain the base beneath them. Coordinate projection, gestures and small journey overlays are unchanged.

`scripts/check-atlas-tiles.py` verified all 840 hashes/dimensions/asset registry entries and created an ignored public Vietnam before/after comparison. The comparison was visually inspected: coastline/border/relief detail is visibly improved. Root checks, focused tile/map/Atlas tests and mobile focused lint pass; native rendering/memory/frame-time measurements remain separate device gates. This adds resolution to geographic relief/borders, not roads or new location precision.

Final verification: 35 focused tests pass (including visible detail mounts and decode-failure fallback), mobile TypeScript and focused lint pass, root `npm run check` passes. The active Android route bundle returns HTTP 200 and contains `visibleAtlasTiles` plus the Vietnam 16K tile; it contains no screenshot import. ADB delivered the development-client intent to the connected Android app. Physical sharpness and performance still require owner/device observation; intent delivery alone is not that observation.

## Country-level point exploration (2026-10-18)

Owner confirmed panning works but requested deeper zoom for Vietnam journeys. Raised shared pinch/button ceiling from 4x to 64x world fit, with a faster 1.6x button step. Nearby journey choice now depends on 24 logical units of projected screen distance instead of a fixed one-degree geographic bucket, so nearby destinations separate during zoom. Existing coarse anchor precision is retained; zoom does not invent precise locations. Background remains the bundled world raster and becomes softer at deep zoom; streets, city labels and multiresolution cartographic detail are not delivered by this change.

## Continuous trip gallery scroll implementation (2026-10-18)

The owner confirms the destination fix works on device and requests planning for
Photos and videos as one scrollable album. Code inspection confirms Load more
clears/replaces `GalleryPage`, and item view conditionally unmounts the list.
The [gallery scroll contract](../_bmad-output/specs/spec-trip-gallery-continuous-scroll/SPEC.md)
now has an implementation: each 60-item repository batch appends to the same
virtualized local grid, with a Load more/retry footer instead of page replacement.
Earlier media stays available on retry; the selected-media view overlays the grid,
so Back keeps the same album instance. The session key is journey plus snapshot,
not the loader callback, so ordinary parent rerenders do not restart browsing.
Focused isolated gallery tests pass for appending, retained prior items after failure,
retrying the same page, and Back to the retained grid. The physical Android scroll
experience still needs owner confirmation. Broader mobile checks are currently
blocked by unrelated concurrent Atlas work importing a missing `atlas/tile-assets`
module; that work was not changed by this gallery repair.


## Real cartographic base replaces the screenshot (2026-10-18)

The active native Atlas now renders generated Natural Earth 50m country geometry and Natural Earth II shaded relief through Winkel Tripel. The generator never reads the supplied UI screenshot. `world-projection.ts` projects journey anchors through the same equation/scale/dimensions as the generated image. The background contains no application controls, routes, destination card or trip dots. Small selectable overlays retain their screen size; full-world fit, pinch and bounded pan use the measured viewport. Source hashes/license and pinned regeneration instructions accompany the assets. High-resolution PNG is approximately 867 KiB with a local low-resolution decode fallback.

34 focused map/Atlas/owner-flow tests pass; mobile TypeScript and focused lint pass; root checks pass. The previously missing destination-data JSON now exists in the independently updated checkout and owner-flow tests load. The verified Android route bundle (src/app router root, port 8081) contains the generated map and shared projection and no screenshot import. Device deep-link delivery was performed; owner physical pinch/selection and exact visual acceptance remain pending. The generated artwork has real land relief and a dark ocean, but reference ocean-current/detail/lighting fidelity remains unaccepted. Prototype assets were generated identically; prototype integration has not been changed in this repair.

## Destination naming integrated and Android client refreshed (2026-10-18)

The user requested loading the tested destination-label fix onto the connected
Android device. The fix was integrated narrowly into this current schema-31/V1.1
checkout rather than loading the older isolated-worktree baseline. The newer
qualification, Home settings, correction and Atlas work is preserved. A compact
bundled Natural Earth country/region resolver and committed visit-support label
query now provide names such as `Bali, Indonesia` to qualified Atlas trips and
selected trip details. Owner detail titles retain precedence. Existing trip
labels derive at read time; a metadata reimport is not required to test naming.

Current-checkout verification passed 31 mobile suites / 280 tests, TypeScript,
lint, foundation `npm run check` and whitespace checks. The connected development
client was launched successfully through the installed Expo CLI's generated URL
on port 8081. Its process is running and Metro reports an active React Native
Bridgeless connection from the physical Xiaomi device. Filtered current-process
logs showed no matching startup error. These verify delivery/startup; the owner
must still inspect the September 2025 Bali trip and other destinations. No
private database was copied, reset or reimported during this load. Persisted
country statistics can still require the normal rebuild for the new dataset
version; no automatic private rebuild was triggered here.


## Atlas interaction repair planning (2026-10-18)

Earlier broader verification blocker: the active country resolver briefly referenced the not-yet-generated `natural-earth-destinations-5.1.1.json` during destination-data integration. The destination task subsequently generated that asset, passed all 280 current mobile tests and refreshed the physical Android client's JavaScript connection. The missing-dependency blocker is resolved; map interaction and destination correctness still require owner acceptance on device.

Implementation update: the active mobile checkout now uses `local-atlas-map.tsx` and pure viewport math. Full-world fit, touch-distance pinch, drag bounds, shared button scale, fixed-size marker visuals and local viewport correction context are implemented. Focused tests pass 27 cases, mobile TypeScript/focused lint and root foundation checks pass. The verified active Metro is port 8081; ADB forwarding and the development-client deep link reached the connected Android app. Actual native pinch/pan acceptance is pending. The screenshot remains the temporary artwork with embedded decorative UI; real cartographic registration is not claimed. The implementation uses explicit React Native touch/responder math with tested finger transitions; the planned Gesture Handler/Reanimated migration and performance profiling have not been performed.

Owner confirms the reference image is visible and buttons work, but pinch zoom is absent and minimum zoom does not show the whole world. Code inspection confirms translation-only gestures, cover-cropped image fitting, and camera/reset coupling to MapLibre zoom. The [repair plan](../_bmad-output/implementation-artifacts/atlas-map-interaction-repair-plan.md) defines measured full-world fit, simultaneous focal pinch/pan, one viewport state, constant-size selectable markers and actual device gates. The full UI screenshot remains a temporary visual preview with baked decorative controls/dots; clean cartography and proper geographic registration are still required. This party task changed planning/error records only; interaction implementation remains open.

Updated: 2026-10-17 (Asia/Bangkok).

## Atlas recovery retains last committed photos

The Android development bundle is now running again. The observed recovery
screen retained seven locally committed journeys, but a failed rebuild made
their durable Atlas projection non-explorable, which looked like the owner's
photos had disappeared. The Atlas now keeps that committed map, journey list
and photo/video grid available during `failed` recovery, while clearly stating
that the next rebuild did not complete. Focused Atlas verification passed
(22 tests). The cause of the underlying local rebuild failure is not present in
the app-process log and remains under device diagnosis; no private evidence was
read, deleted or exported. Physical reload acceptance is pending.

## Android civil-day continuity correction awaiting device acceptance

The owner rebuilt the private Android record and still observed two September
2025 entries, three April 2024 entries and two February 2022 entries for three
known continuous holidays. The canonical V1.1 builder was still treating
Android creation timestamps as exact instants despite `hasPreciseOffset: false`,
then partitioning every civil-day observation into a separate episode.

The correction now groups compatible mixed-precision observations by civil day,
preserves their uncertain internal order, and uses the existing ten-day
continuation only when both blocks independently measure away from a learned or
owner-configured home context. Repository normalization now carries graph place
IDs (not visit IDs) and computed home distance into that decision. Host
verification: 265 mobile tests, TypeScript and lint pass; Expo Doctor retains
the pre-existing missing iOS icon and nine Expo SDK patch-version warnings.
Physical rebuild acceptance is still required; no private evidence was exported
or added to the repository.

## Named private Home bases implemented awaiting device acceptance

Schema v31 adds an owner-entered local label and origin to each configured Home
base. Existing v30 rows remain active with a null label and display as
`Unnamed home base`; the app does not infer a locality from their coordinates.
The Home bases screen now requires a label for a new observed-area choice and
lists independently named bases with date/radius scope, rename and confirmed
remove actions. These labels never reach reconstruction inputs; only existing
private coordinate, radius and date context affect trip handling. Focused
regressions cover v30 migration, private label CRUD and the journey-review save
flow. Independent review also corrected stale journey-preview publication,
rebuild-status messaging, malformed Home-context validation and explicit
non-capture provenance preservation. Host verification passed: 29 mobile test
suites / 270 tests, TypeScript, lint, the foundation check and whitespace
check. Physical Android acceptance is still required; no private evidence was
exported or added to the repository.

## Atlas reference-direction refinement

The owner supplied a world-map interface reference and clarified that it is the
direct UI target for Travel Life's map: full-bleed dark world geography, upper
search/navigation treatment, compact floating controls, side filter stack,
zoom/orientation control and one selected-place card. The owner then supplied the
**Obsidian Horizon / Deep Sea Glass** visual brief, which is now the authorized
Atlas-only palette, glass, typography and motion extension. Decision 0012, the
Living Atlas design system and the dimensional-Atlas contract require an original
Travel Life implementation of that interface. Its content remains private and
evidence-aware: local-only journey/place search, Map/Timeline, year/evidence
filters, correction and Replay replace public planning, routes, generic map modes
and unqualified visit claims. Implementation remains pending the delivery work,
including existing device/provider gates.

## Continuity and photo-backed Home setup specification

The requested BMAD party refinement is recorded in
[Continuous holidays and Home setup](../_bmad-output/specs/spec-trip-continuity-and-home-setup/SPEC.md),
with engine, Home experience, development-plan and acceptance companions. It
requires actual boundary diagnostics for the three reported 4/2/2 fragment
groups, canonical episodes as the active publication authority, and explicit
area selection with a scoped photo/video preview before Home save. Home
management and candidate areas are independent of qualified journeys; durable
context revisions, queued rebuilds and progress prevent false completion.
The plan preserves the canonical gap policy; if private diagnosis identifies
a longer-gap policy mismatch, a tested versioned amendment is required before
activation. New 20 km home scope and legacy-radius preservation are explicit
planning defaults. This update changes specifications only. Private diagnosis,
implementation, regional-data acquisition and device acceptance remain pending;
`product_quality: not_measured`.

The first implementation slice now makes canonical V1.1 episode grouping the
active source for unreviewed persisted/displayed journeys, rather than retaining
it as diagnostics only. It keeps mixed precise/day-only evidence deterministic,
does not turn a lone configured-home point into a return boundary, and preserves
reviewed journey projections. A focused synthetic regression covers same-day
mixed precision/revisits and a corroborated home-return split. Home setup now
opens the selected journey's local details/photos before saving, requires an
explicit observed-area choice and saves that choice at a new visible 20 km scope
instead of selecting the journey's first visit. Focused 91 mobile tests, typecheck
and lint passed. This is not private-library verification: the April/September/
February boundaries, complete C0/C1 context, native metadata, generation lineage,
offline regional naming and device acceptance remain pending.

## Home context and continuity requirements clarified

The integrated continuous-trips delivery record now specifies the current two
inconsistent home heuristics, shared temporal context, episode boundaries,
generation-bound diagnostics, naming, migration and an explicit regression/release
matrix. Qualification selects the most frequent non-candidate twelve-day place;
merging considers all twelve-day places, including holiday destinations, across
all history. This can make a trip its own base. The exact private September cause
remains unverified. The canonical 72-hour automatic-link / ten-day uncertain-link
policy must be tested explicitly; implementing it alone cannot guarantee merging
a pair with longer ambiguous gaps. This update is requirements planning only.

## PM/analyst investigation: island labels and repeated trip fragments

Direct local execution reproduced an offline resolver coverage defect: synthetic
Ubud returns border, Denpasar/Kuta unresolved, Jakarta IDN. The current country
geometry/edge rule cannot reliably label those island locations and supplies no
regional names. Prior suggestions that the owner's metadata was defective were
not verified. The exact private-run split reason is still unknown; the active
path remains V1 grouping plus a global-base continuity patch, not the canonical
episode pipeline. The existing [integrated delivery record](../_bmad-output/planning-artifacts/continuous-trips-and-album-experience-2026-10-16.md)
now includes the reproducible findings, region/country naming separation,
episode integration requirements, local decision diagnostics and an acceptance
extension. Investigation only: no new runtime changes or private-device accuracy
claim. EP-071 records the incident and outstanding verification.

The first engine correction after that investigation now treats a fragment with
GPS-less associated media as an away fragment when its known geotagged support is
far from every frequent base. It no longer treats a missing coordinate as a home
return and can join adjacent supported Bali-city fragments within the existing
ten-day continuity window. A focused repository regression and TypeScript pass;
private-device confirmation remains pending. Detailed offline Admin-1 geometry
for the visible Bali label is blocked until the public boundary archive can be
acquired through the approval service; no hardcoded location exception was added.

The owner then confirmed that the rebuilt September run still split. A further
continuity defect was fixed: a frequently observed base now uses coordinate-bearing
support from that place rather than its deterministic representative, which can be
GPS-less. This preserves a valid base measurement for automatic multi-city joining;
the added regression simulates that exact condition. It does not fabricate Bali's
regional label, and device rebuild remains the required private acceptance check.

## Continuous trips, immediate preview and album grid (2026-10-16)

The owner requires a continuous multi-city holiday to appear as one trip, concise
location/month summaries (for example Taiwan / October 2025), a preview immediately
visible from either map or list selection, and a full-screen photo/video grid.
The BMAD party's [integrated delivery plan](../_bmad-output/planning-artifacts/continuous-trips-and-album-experience-2026-10-16.md)
specifies episode-first grouping, country naming independent of boundaries,
viewport-level preview, album/viewer return context, correction-safe persistence
and 20 acceptance scenarios. Existing V1.1 exact continuity predicates remain
authoritative; matching country/month alone cannot merge distinct holidays.
Code inspection confirms inline/off-screen preview and row-based gallery causes.
The recovery qualification adapter also substitutes global base/photo-count/date
heuristics for canonical V1.1 predicates; those shortcuts remain to be replaced.
This turn records the complete recommendation; application changes and private
Taiwan-example evaluation have not been performed.

## Automatic trip recognition planning (2026-10-16)

The owner's follow-up rejected partial readiness. The party has now derived the
[canonical V1.1 implementation contract](../_bmad-output/specs/spec-trip-detection-engine-v1-1/SPEC.md)
with six capabilities, five technical companions and 64 acceptance cases. It
selects exact temporal base/routine/session and episode rules, the original score
plus two hard-gated recognition profiles, a local-only native metadata bridge,
generation-based persistence/correction/query contracts, dry-run activation and
rollback. The one-session score45 source case is explicitly a nonpublished
suggestion awaiting corroboration, resolving the source gate contradiction.
Strict automatic bases require separated residence periods; otherwise one era
setup question replaces per-trip confirmation. These are visible planning defaults
and explicit source-policy refinements, not measured quality or a live migration.
The earlier proposal below is exploratory rationale; implementation consumes the
canonical contract. No application behavior has changed in this planning task.

The owner reports too many inferred trips in the primary UI and wants trustworthy
automatic recognition with very few review/confirmation actions. The BMAD party's
[engine improvement proposal](../_bmad-output/planning-artifacts/trip-detection-engine-improvement-plan-2026-10-16.md)
identifies draft-to-Atlas publication, absent base/routine qualification and native
metadata limitations in current code. It proposes temporal bases/routines, episode
recognition, independent evidence gates, qualified queries shared by Atlas/counts/
replay, correction-safe identity and recoverable shadow migration. Automatic base
learning and evidence-profile classification are explicit proposed refinements
to the pasted V1.1 contract; the exact score policy remains a comparison baseline.
No UI implementation, legacy reprocessing or product-quality claim is produced by
this planning record. Next delivery implements the specified native normalization,
pure engine, persistence and complete automatic-reveal integration, followed by
owner-authorized local evaluation and separately approved legacy activation.

## Automatic trip recognition guarded delivery (2026-10-16)

The first guarded V1.1 delivery slice adds an additive pure qualification seam,
private schema v29 qualification rows, and one primary-query predicate shared by
durable reveal and journey counts. Existing V1 inferred rows are backfilled or
rebuilt as private suggestions; only exact owner-confirmed rows are primary-visible
until the complete V1.1 base/routine/native-context pipeline can qualify automatic
trips. This deliberately removes draft noise rather than falsely promoting it.
Focused reconstruction, repository, import-migration and Atlas suites passed
97 tests; mobile TypeScript and root `npm run check` passed. The sandboxed Jest
cache cannot write atomically; the focused suite was rerun on the host. Native
metadata bridge, temporal bases/routines, automatic profile publication, all 64
cases, device checks, and labeled quality evaluation remain unfinished;
`product_quality: not_measured`.

The first device test exposed zero automatic recall, so the owner-confirmed-only
bridge was replaced for future rebuilds by a deterministic local-graph adapter.
It requires a distinct 12-day base, conservative 50 km distance, five eligible
photos and independent support before an inferred graph journey can pass the
V1.1 score path. This is a recovery from the empty-map regression, not a claim
that the full native/context engine or device quality evaluation is complete.

The additive pure gate was further hardened to count only explicitly
capture-like evidence, require actual normalized 4-hour/24-hour spans for the
DAY/STAY profiles, and fail closed for critical conflicts, owner vetoes and
suspected routine context. Focused host reconstruction tests passed 41/41; the
complete mobile suite passed 29 suites / 254 tests with TypeScript and lint, and
the root framework/evaluation checks passed. These are synthetic contract checks:
`product_quality: not_measured`. The canonical date-scoped native normalization,
base/routine/episode pipeline, generation model, 64-case suite, dry run and
private labeled/device evidence are still outstanding.

The qualification boundary now also has a pure date-scoped owner-home-area
normalizer that accepts multiple authoritative local areas (for example, a
Sa Dec period followed by Ho Chi Minh City). It marks only evidence with a
valid local date and coordinate inside an active configured area; that evidence
cannot promote an automatic trip and remains local return context. A synthetic
regression covers both date ranges and confirms the areas are not averaged.
Durable owner-home-area storage, owner editing UI, and repository wiring into
new imports are still not implemented, so this is a tested detector seam rather
than an owner-operable feature. The focused V1.1 suite passed 4 suites / 107
tests, the complete mobile suite passed 29 suites / 256 tests with TypeScript
and lint; Expo Doctor still reports the pre-existing missing iOS icon and nine
SDK patch-version recommendations. Root checks and whitespace validation passed;
`product_quality: not_measured`.

The owner-operable slice now persists date-scoped Home bases in the private
SQLite record and applies them before automatic qualification and continuity
merging. Home-base evidence is excluded from automatic journey membership,
while still providing local return context. The persistent Atlas header opens
Home bases directly. Saving a selected journey now immediately acknowledges
the action, prevents duplicate taps while its private rebuild runs, and reports
either that Atlas is ready or that the configuration saved but the rebuild needs
attention. The focused Home bases/provider regressions (14 tests) and mobile
TypeScript check passed, and the connected Android app was reloaded. Device
confirmation of the private library result remains pending; `product_quality:
not_measured`.

## Dimensional Atlas development plan (2026-10-15)

The owner accepted vibrant, professional 3D visual polish through color,
perspective, markers, cards and responsive motion, explicitly excluding terrain
and mountains/valleys. The journey list must be simple, minimal, intuitive and
uncluttered. [Decision 0012](decisions/0012-dimensional-atlas-and-minimal-list.md)
records that direction. The [spec and development plan](../_bmad-output/specs/spec-atlas-dimensional-polish/SPEC.md)
now define the Atlas-only Obsidian Horizon / Deep Sea Glass extension, four
capabilities, five ordered work packages and 20 acceptance scenarios.
This task changes planning documents only; implementation and device evidence are
pending. Next work starts with installed MapLibre API/style feasibility, then
dimensional styling, bounded safe row summaries/list layout, camera/context
integration and verification. Production basemap selection remains unresolved.

## Atlas map/list refinement (2026-10-15)

The private Atlas now leads with a compact header, inferred-record summary,
Map/Timeline and year controls, then a larger MapLibre surface and flat journey
rows rather than a nested scroll panel. Ordinary anchors are quiet while the
current selection is citrus/ring styled; coincident map hits require an explicit
choice. The selected local preview is rendered over the map (or through the
same Timeline fallback), preserves the redacted opaque selection boundary, and
suppresses stale preview publications. Coverage and tile-request disclosure are
available through the labelled About control. The focused Atlas suite passed 14
tests and mobile TypeScript passed. Native hit-testing, camera gesture fidelity,
safe-area/large-text behavior, and full paged-gallery/correction-successor
validation remain unverified; the existing bounded preview viewer is not proof
of a complete device media flow.

## M4.1b owner title and date claims (2026-10-14)

Owners can now save a private journey title plus either an exact day or an
ordered approximate interval. Schema v20 records these as immutable `claim`
revisions, separate from the observed span and existing confirm/reject
semantics. A claim follows only an exact full-support successor during a
rebuild; a missing, split, or duplicated mapping preserves the last complete
projection and enters pending remap. The claim does not alter evidence,
membership, place/country aggregates, routes, or sharing. The focused mobile
suites passed 5 suites / 55 tests, and mobile TypeScript, Expo lint, and root
`npm run check` passed. The React 19.2-compatible test renderer and awaited
RNTL v14 test interactions resolved EP-011; the full mobile suite passed 27
suites / 213 tests with no console diagnostics. Device SQLite migration and
native owner-input behavior remain unverified.

## M4.1a successor-identity repair (2026-10-14)

M4.1 remains in progress and is now explicitly staged as an epic-sized correction
capability. The confirm/reject foundation persists immutable review revisions and
rebuilds atomically. Schema v18 distinguishes a confirmation applied to a rebuilt
successor journey from a rejection applied as a durable `grouping-constraint` with
no generated journey target. This prevents a rejection from being recorded against
the predecessor journey that the corrected projection removes. The focused mobile
suite passed 4 suites / 73 tests, including the new rejection-application and
migration assertions. TypeScript, Expo lint, and the root foundation checks also
passed; device SQLite migration remains unverified. The broader M4.1 owner-edit, split/merge,
duplicate-family, and pending-remap-resolution work remains outside M4.1a.

## Mandatory error learning (2026-10-13)

The owner requested strict recording and reuse of agent mistakes. `AGENTS.md` now
requires relevant playbook checks before work, same-task incident recording,
verified corrections, explicit unresolved status, and stronger safeguards for
recurrences. `docs/development/error-playbook.md` holds the index, template, and
observed lessons. This provides persistent procedural learning across sessions;
it does not change model weights. Future work must apply relevant lessons and
record newly discovered failures before completion.

## Current stage and user direction

On 2026-10-09 the owner made the agreed Living Atlas prototype direction the
official design system for **all Travel Life UI/UX**. Use
[the canonical system](product/design-system.md) for new mobile, browser, replay,
and sharing work; [decision 0010](decisions/0010-living-atlas-design-system.md)
records the scope. The implemented six-color prototype palette and interaction
language are accepted. The extra geographic colors in the earlier map design
proposal are not official tokens. Next UI delivery should apply this reference
within its story, then validate the specific screen on target devices/browsers;
the synthetic prototype alone does not establish production usability.
Documentation verification on 2026-10-09: changed local links resolved,
`git diff --check` passed, and root `npm run check` passed (framework integrity,
20 foundation tests, and evaluation smoke). No UI code or device behavior changed
in this decision-recording pass.

Later on 2026-10-09, the owner clarified that **all agreed prototype screens**
are the official product UI targets, including the beach/lake video Welcome.
[Decision 0011](decisions/0011-prototype-screens-as-product-ui.md) and the
[design system's screen map](product/design-system.md#official-screen-set)
record the full set and its real-product boundaries. The current `apps/mobile`
Trust → Import → empty Atlas implementation remains a foundation; these screen
targets and the Welcome montage have not yet been integrated there. Next UI
stories should use the map to carry each design into production with actual
permission, import, correction, replay, and sharing behavior.
Documentation links resolved, `git diff --check` exited successfully, and the
root `npm run check` passed (framework integrity, 20 foundation tests, eval
smoke). No production UI integration or device validation is claimed here.

MLP planning for delivery. On 2026-10-07 the user explicitly replaced Minimum
Viable Product with **Minimum Lovable Product (MLP)** as the first-release goal.
Decision 0009 defines that release as a private lifetime interactive map reveal,
replay video and owner-selected sharing experience. The user previously removed pre-launch market research/
interviews as prerequisites: build from available knowledge and collect hypothesis
evidence through rollout. The user selected **both iOS and Android** for first testers.

On 2026-10-07 the user selected permission-based broad photo-library access as
the primary import experience; selected-photo import is an alternative for users
who do not want to grant broad access. See decision 0003. The existing native
implementation default remains; no browser-only switch was requested.

This revision updated planning and recorded implementation defaults. No app code,
provider call, private data collection, remote deployment or signed build exists yet.
No remote, paid plan or credentials were configured.

Validation on 2026-10-07 after recording the import decision: `npm run check`
passed framework integrity, all 20 foundation tests and evaluation-infrastructure
smoke checks. These checks do not verify device photo access or reconstruction quality.
After the photo-rule revision, `npm run check` passed again: 44 pinned skills/four
runtime trees, 20 foundation tests and eval smoke checks. Planning consistency checks
found 27 unique stories, 81 unique acceptance criteria and no broken local links in
the seven changed planning/decision documents. Product accuracy remains unmeasured.
After fixing reconstruction v1 parameters, `npm run check` passed again (44 pinned
skills/four runtime trees, 20 foundation tests and eval smoke). Document checks found
27 unique stories, 81 unique acceptance criteria, no broken links across 11 changed
planning/decision/instruction documents, and all required parameter values present.
These checks validate planning consistency and tooling, not engine behavior or accuracy.

## Established direction

- Mobile travel-history reconstruction from existing evidence, followed by a private
  lifetime map reveal, replay, durable correction and selected-highlight sharing.
- The first product goal is MLP as specified by decision 0009; no discovery-first
  Epic 1 or G0 demand gate.
- One native photo source per platform, with honest coverage and inferred-status labels.
- Broad library access is the primary path; limited/selected-photo access remains optional.
- Background maintenance is required in the first product on both platforms, with foreground
  catch-up and preserved corrections. See decision 0004.
- AI assistance has bounded scope and explicit processing opt-in.
- Keep original media at its source; the derived local record is sensitive.
- Use small engine regressions during delivery and expand real-case evals after rollout.
- Keep photo-to-journey membership distinct from visit support and reviewed facts;
  owner trip boundaries and corrections constrain inference. See decision 0006.

## Foundation delivered

- BMAD 6.12.1 core + method, 29 project-local skills.
- Six ECC 2.2.3 skills and nine evals-skills at the recorded pins.
- Workflow, trace contracts, integrity checks, 20 foundation tests and CI definition.
  See docs/development/setup-verification.md for setup evidence.

## Active planning

- Revision 7: five delivery epics, 27 stories (25 P0, two P1), M-prefixed IDs.
- Canonical backlog: _bmad-output/planning-artifacts/epics.md.
- Working decisions: _bmad-output/planning-artifacts/mvp-spec.md and
  docs/decisions/0002-mvp-first-delivery.md through
  0009-mlp-lifetime-reveal-and-replay.md.
- Shared Expo / React Native / TypeScript, SQLite, bounded OpenAI suggestions via
  a protected Supabase proxy, native map component: agent-selected defaults.
- Interactive browser viewer/published journey or lifetime-highlight snapshots and
  the private replay video are required; selected remote media derivatives are an
  explicit publishing exception to local storage.
- MLP scope is clear. The BMAD build workflow remains paused until an initial clean
  repository baseline is recorded; beta release checks remain pending.
- The earlier 13-epic/49-story proposal is preserved under
  _bmad-output/planning-artifacts/history/2026-10-06-discovery-first/
  and is not the active plan.

## Accepted decisions versus assumptions

Accepted from the user: MLP is the current goal, including its map/replay/selected-share
first loop, no pre-launch research programme, both platforms. The earlier MVP-first
wording is superseded by decisions 0008 and 0009.
Broad library access by default, with selected-photo access as an alternative,
is also user-selected (decision 0003). Background maintenance is user-selected
(decision 0004). Interactive journey-link sharing is required (decision 0005);
decision 0009 promotes the lifetime replay and selected lifetime-highlight sharing
into the MLP core, while the static card stays optional.
The user also accepted the reviewed photo-to-trip rule changes on 2026-10-07;
decision 0006 and MVP spec revision 6 record the behavior. Exact cluster ties and
bounded episode/association windows were fixed by decision 0007 before coding;
M2.1 implements `reconstruction-v1` and M2.4 verifies its boundary examples.
The numeric values and deterministic tie-break are agent-selected starting defaults,
not observed product-performance thresholds.
Starting assumptions/defaults: frequent leisure travellers, English UI, one native
photo source, trip/place heuristics, stack/model/backend, local storage and optional AI.
These are selected to enable implementation, not validated product facts.
See decision 0002 for rationale, source references and operational limits.

## Resolve inside delivery

Native access parity, dependency pins, actual device behavior, signing accounts,
map/provider configuration, source-access distribution rules and model performance
are engineering tasks in M1–M5. Service setup and publication follow actual execution
authorization; no repeated approval is needed for an already authorized step.
Demand, correction burden, usefulness, sharing and retention are rollout hypotheses,
not prerequisites for starting the app.

## Reconstruction rule decision (2026-10-07)

The user requested a second review and then directed us to change the spec according
to its proposal. The historical critique and findings are saved under
_bmad-output/planning-artifacts/reviews/. The MVP-named spec revision 7 and decision 0006 now
separate photo membership from visit support, places from visit episodes, and reviewed
facts from new inferred additions. The spec includes a small behavior decision table;
Decision 0007 now records exact bounded window/tie parameters; the related story
criteria and eval roadmap are aligned. This adds no research gate and no app
implementation began.

## Interactive prototype delivery (2026-10-07)

An isolated `apps/prototype/` Expo Router prototype now provides a synthetic-only,
local-state walkthrough of welcome, a clearly labelled simulated broad-library or
selected-photo access choice, simulated import, private map/list reveal,
year and journey selection, session-only correction, replay preview/cancellation,
selected-highlight preview, and sparse/declined examples. It contains no real
evidence, account, permission request, network call, persistence, map provider,
backend, rendered video, export, or published link.

The access screen explains that local app storage needs no operating-system permission,
while Google Photos is not connected or scanned in the MLP flow. The access UI remains
a prototype interaction only; native permission behavior is still unimplemented.

Observed checks passed: fifteen prototype flow/model/UI tests, TypeScript, Expo lint, and
Expo Doctor (21/21). Root `npm run check` also passed with framework integrity, 20
foundation tests, and eval smoke checks. Physical iOS/Android walkthroughs remain
pending. The prototype does not validate reconstruction accuracy, production privacy
controls, native source access, map providers, video rendering/export, persistence,
or backend/share services.

## Next work

On Android, capture consented GPS and cloud/unavailable observations, then validate
M1.4's disconnect and confirmed/cancelled local-deletion controls in a rebuilt
development client. Perform the equivalent iOS verification on macOS. Record aggregate
observations only. After that device evidence, hand off to M1.5 for scheduled library
maintenance without claiming an OS timing guarantee.

## Living Atlas prototype redesign (2026-10-07)

The isolated `apps/prototype/` owner flow now uses a responsive dark Living Atlas
system across every route. The reveal keeps a dependency-free contour atlas dominant,
adds Map/Timeline and snapping year controls, synchronizes selection with an accessible
expandable list, and uses three generated fictional landscape crops stored locally under
`apps/prototype/assets/synthetic/`. Replay remains cancellable and explicitly renders or
exports nothing. Reduced-motion preference is observed; the optional tactile adapter is
silent because no native haptics dependency was added.

Observed checks passed after the redesign: 22 prototype tests, TypeScript, Expo lint,
Expo Doctor, and the root foundation `npm run check` (44 pinned skills/four runtime
trees, 20 foundation tests, and eval smoke). Jest component coverage reported 90.26%
lines, 76.33% statements, 67.95% branches, and 74.75% functions; there is no configured
aggregate coverage gate and the separate Node model tests are not included in that Jest
report. The requested browser walkthrough could not be completed in this sandbox because
Expo's web launcher could not create its DevTools directory or open the browser. Physical
iOS/Android, 390×844/1440×900 overflow/focus, and reduced-motion device walkthroughs
remain pending; no product-accuracy or production-capability claim follows from these checks.

## Welcome montage and video prototype delivery (2026-10-08)

The isolated prototype's Welcome screen now uses the completed `Your travels. Alive again.` Living Atlas hero. It selects responsive local portrait/wide H.264 clips, remains muted, has an explicit pause/play control, responds to app/background, page-visibility, navigation and scroll visibility, and keeps a bundled poster readable if playback cannot start or fails. Unknown accessibility preference prevents automatic motion; a failed preference lookup uses the safe reduced-motion default while retaining deliberate play. All promotional media is visibly labelled synthetic and is separate from the simulated lifetime replay.

The two 15-second assets in `apps/prototype/assets/video/` are animated-photo montages generated from six fictional editorial stills in `assets/synthetic/hero/`, with slow zooms and short dissolves. They are not Runway or other text-to-video scene-motion output, and they contain no owner images, travel evidence, audio, route claims, export, or publishing. `apps/prototype/scripts/render-travel-hero.py` reproduces the encoded assets when given FFmpeg; its strict decoder verification passed for each 360-frame clip.

Observed on 2026-10-08: 36 prototype tests (12 Node, 24 Jest), TypeScript, Expo lint, Expo Doctor (21/21), static web export, and root `npm run check` passed. Browser QA at 390×844 and 1440×900 confirmed readable CTA/copy, responsive portrait/wide source selection, muted playback, pause control, and the access-flow handoff. The browser frame inspector rendered all six 60-frame groups (0–359) from the portrait decoder; visual review covered the opening/transition groups and final loop boundary with no black frames. Physical iOS/Android behavior, actual device haptics, native background behavior, real scene-motion generation, and user-photo replay/rendering remain unverified/unimplemented.

## Interactive map and navigation design proposal (2026-10-08)

At the user's explicit request, BMAD UX Designer reviewed the two supplied map
screenshots and the isolated prototype's map, navigation, fixtures and local-state
flow. The current atlas is an abstract percentage-position diagram, not a geographic
map; navigation is page-specific with stack headers hidden.

A [proposed review and change plan](../_bmad-output/planning-artifacts/ux-designs/ux-Travel-Life-2026-10-08/REVIEW-PLAN.md),
with paired DESIGN.md and EXPERIENCE.md, describes a vibrant geographic atlas,
pan/zoom/fit, shared year/Timeline selection, photo-led journey exploration, and
consistent Atlas / Replay / Highlight navigation plus Home/Back. It preserves
synthetic-data labels, uncertainty, session-only corrections, simulated access,
cancelable replay and exact owner-selected highlight preview.

This is planning only, not an approved implementation contract. No application
code, dependency, provider configuration or runtime behavior changed. The new
map-only palette, geographic demo anchors and navigation arrangement await approval;
online basemap versus bundled geography also remains unresolved. A network basemap
would require an explicit change to the prototype's no-external-network contract
and map-service disclosure, with local Timeline fallback retained. No live browser
visual/usability validation or new application test run is claimed for this pass.
Next: owner review of the proposal, then amend the existing prototype delivery spec
and implement only after authorization. Production mobile delivery remains separate.

## Bundled atlas and post-import navigation prototype delivery (2026-10-08)

The approved Living Atlas navigation delta is implemented only in the isolated,
synthetic `apps/prototype/` app. Its former abstract field is now an offline,
dependency-free fictional geographic illustration with explicit synthetic-demo labels,
fictional anchors, pan/zoom/fit controls, marker-overlap grouping and an accessible
Timeline fallback. Missing fictional coordinates remain unplotted and expose an
explicit Timeline recovery action; a map-render failure does the same. It makes no map-provider, tile, network, location, route or visit
claim. The prototype now also offers compact Atlas / Replay / Highlight navigation
and contextual Home/Back. These transitions preserve the active in-memory year,
selected journey, correction, camera and highlight state; exiting replay stops it.

The production map-provider decision, native gesture/device validation, physical
mobile and browser responsive walkthroughs, real evidence handling, persistence,
replay rendering/export and publishing remain unimplemented. This bounded visual
prototype is not evidence of product accuracy, map accuracy or production readiness.

## Whole-life highlight preview control (2026-10-08)

The isolated prototype's Highlight step now begins with no chapters selected and
offers an explicit **Select all 3 chapters** control alongside individual chapter
selection and Clear selection. Selecting all shows every synthetic chapter in the
exact local preview, while the screen continues to state that it creates no URL and
publishes nothing; a separate deliberate confirmation would still be required in a
production sharing flow. This supports the whole-travel-life sharing hypothesis
without changing the owner-selection boundary.

Observed on 2026-10-08: 27 prototype tests, TypeScript, and Expo lint passed.
Browser verification at 1440×900 and 390×844 confirmed the empty initial state,
whole-life selection, selected chapter indicators, clear control, and exact preview.
This remains synthetic/local-only; it does not validate live publishing, real media,
or native-device behavior.

## M1.1 shared mobile app foundation (2026-10-08)

`apps/mobile/` now contains the separate Expo SDK 57 shared iOS/Android application.
It introduces the production Trust → Import → empty Atlas flow in the established
Living Atlas visual language, with a recoverable unknown-route screen and typed
local navigation. The empty Atlas makes no map, journey, evidence or inferred-history
claim. Import explains that photo-library access will be requested only in M1.2.
There is no account, permission request, photo enumeration, persistence, network
service, AI processing, map provider, replay or sharing behavior in this story.

Observed on 2026-10-08: the mobile package check passed (8 Jest tests, TypeScript,
Expo lint and Expo Doctor) and the root `npm run check` passed (framework integrity,
20 foundation tests and eval smoke). Browser verification confirmed Trust → Import →
Atlas, explicit Back behavior, and unknown-route recovery at desktop and 390×844 widths.
The review removed destructive template reset behavior, corrected local setup guidance,
and deferred a default-dependency audit before M1.2. Metro started despite a Windows DevTools cache
ACL fallback warning. Android and iOS physical development-build smoke checks remain
pending; no device behavior is claimed.

## M1.2 native photo access implementation (2026-10-08)

The production `apps/mobile/` Import screen now offers owner-initiated broad device-library access and an explicit selected-photo/video picker. A narrow Expo SDK 57 adapter inspects or requests photo/video permission, counts accessible image/video entries in pages using the class-based media query, and opens limited-scope management only on owner action. Screen state holds scope and counts, not raw assets, media URIs, filenames, or coordinates. The app rechecks permission on foreground return and before enumeration; a completed count is recounted on foreground return, while revoked access clears its count and interrupted work remains incomplete. Denial does not trigger repeated permission prompts. Atlas remains empty until evidence import in M1.3.

The configuration declares iOS photo-use text, Android photo/video and media-location read permissions, and blocks unrelated camera, microphone, and write-storage permissions. Expo config introspection confirmed the iOS purpose text. A generated Android manifest showed intended read permissions and removal directives for the blocked permissions; the generated project was removed after inspection. An installed Android merged manifest has not been verified.

Observed checks after independent review: mobile `npm run check` passed 28 Jest tests, TypeScript, lint, and Expo Doctor 21/21; root `npm run check` passed 20 foundation tests and eval-infrastructure smoke. `git diff --check` found no whitespace errors. A desktop and 390px browser smoke check showed the web-unavailable state and empty Atlas, but cannot validate native permissions. Review fixes covered interrupted prompts, permission loss during counting, limited-selection races, selected-count preservation, and scoped-count wording. Earlier prototype/CI findings are recorded in `_bmad-output/implementation-artifacts/deferred-work.md`.

On 2026-10-09, an owner-operated physical Android development build completed the M1.2 permission checks: explicit system picker cancellation/selection, full device-library permission, a completed scoped count of 298 device-visible photos/videos, permission revocation/foreground recovery, and limited selected-photo access. The picker returned one selected item without a stable library ID, which the UI labelled as uncertain. No media, identifiers, filenames, URIs, or location data were recorded. This is device behavior evidence only, not proof of lifetime coverage or reconstruction accuracy. Physical iOS behavior, GPS availability, cloud-only asset behavior, installed merged-manifest inspection, and distribution acceptance of broad media access remain pending. M1.3 must add normalized, durable, resumable metadata import and coverage measurements before any reconstruction claim.

## M1.3 metadata import, resume, and deduplication (2026-10-09)

`apps/mobile` now includes an Expo SDK 57 `expo-sqlite` local-only import index. It pages only the current full or limited device scope, normalizes opaque asset IDs with image/video type, nullable capture and modification times, nullable location availability, and cloud/unavailable status, and commits every page with a resumable checkpoint. The importer uses parameterized SQLite upserts, checks permission before and after every page, discards late pages after cancellation or a permission change, and leaves a separate correction-marker table untouched. Selected results with no stable ID are explicitly unavailable and never substituted with a path or new identity.

The Import screen has Start/Resume/Cancel actions and labels accessible, scanned, geotagged, and unavailable counts as current accessible scope rather than lifetime coverage. The implementation does not upload, decode, copy, expose, or log media, filenames, URIs, coordinates, raw EXIF, journeys, visits, or travel conclusions. M1.4 remains responsible for canonical evidence/history, correction lifecycle, disconnect, and deletion.

On 2026-10-09, the final M1.3 mobile check passed 47 synthetic Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed 20 foundation tests plus the evaluation-infrastructure smoke check, and `git diff --check` found no whitespace errors. Those checks cover empty, sparse, large, interrupted/restarted, revoked, picker-only/missing-ID, missing metadata, cloud/unavailable, repeat/deduplication, SQLite migration and commit rollback, and Import-screen coverage states. They do not validate physical SQLite behavior, real metadata availability, iOS behavior, or reconstruction accuracy.

Synthetic unit coverage exercises empty/sparse, large/repeat/deduplicated, cancelled/resumed, permission-revoked, selected missing-ID, cloud/unavailable, and correction-marker-preservation paths. On 2026-10-09, the owner-operated Android development build completed the consented full-library start, pause, resume, and repeat observations. After a paused, committed 1,000-item checkpoint, resume completed the current scope with aggregate coverage of 2,989 scanned, 1,957 with location metadata available, and 0 unavailable. The owner confirmed a repeat import retained those aggregate totals, and **Recheck accessible photos** independently returned 2,989. The owner also selected one item through the system picker; it had no stable library ID, and selected import completed with 0 scanned, 0 location metadata available, and 1 unavailable, without substituting an identity. While a full-library import was active, the owner backgrounded the app to revoke access in Android Settings; the app paused and did not resume automatically on return. After full access was restored, **Recheck accessible photos** again returned 2,989. No media, IDs, filenames, URIs, timestamps, coordinates, or raw metadata were recorded. Physical iOS validation, cloud-only behavior, and GPS availability remain pending; passing synthetic checks and this device observation do not establish lifetime coverage or reconstruction accuracy.

On 2026-10-09, the Android development build passed `:app:assembleDebug` for the connected phone's arm64 architecture and installed with `adb install -r`. CMake 3.31.6 resolved the earlier NDK linker incompatibility; running Gradle with the installed Java 17 resolved the Prefab configuration failure caused by Java 25's restricted-method warning. Metro bundled 1,464 Android modules and Android reported `com.anonymous.travellife/.MainActivity` in the foreground. Those observations verify build, installation, and JavaScript delivery; the separate owner-operated M1.3 observation above verifies the consented Android import cases. No real photo metadata or location was inspected or recorded here.

## M1.4 private record lifecycle, disconnect, and deletion (2026-10-09)

`apps/mobile` now migrates the existing `travel-life-import-v1.db` in place to hold normalized canonical evidence, empty-ready inferred-history storage, revisioned correction overlays, lifecycle state, and an explicit cache registry. It retains only the established opaque local source reference, media type, nullable timestamps, location availability, and availability state; it does not add original media, paths, filenames, raw EXIF, precise locations, analytics, or logging. The migration preserves M1.3 source/index data and repeat-import deduplication.

The owner chose normal OS/device backup restoration for the local private record. The app documents that the platform and backup account control this behavior and does not claim SQLite encryption. A new private Settings screen makes **Disconnect photo source** distinct from **Delete local history**: disconnect preserves the local record, source references, and checkpoints while blocking further source reads until the owner reconnects; deletion requires confirmation and clears the covered local tables and registered caches without claiming to delete original media or remote copies. No background scheduler exists until M1.5.

On 2026-10-10, mobile `npm run check` passed 83 Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed framework integrity, 20 foundation tests, and the eval-infrastructure smoke check. The mobile coverage command reported 82.13% statements, 74.37% branches, 80.92% functions, and 86.41% lines; no E2E runner is configured. The targeted M1.4 lifecycle, migration, correction target/lineage, disconnected-import and disconnected-count, cancelled lifecycle prechecks, confirmed/cancelled/failed deletion, late-write, stale-UI cleanup, and Settings tests passed. These synthetic checks do not prove physical SQLite migration/deletion, OS backup restoration, iOS behavior, or that a deleted local record cannot later be restored from the owner-selected device backup.

## M2.1 local metadata baseline and history model (2026-10-10)

`apps/mobile` now contains a local-only `reconstruction-v1` baseline. The private SQLite record stores the device-recorded civil capture date, an explicit timestamp-precision marker, and approved coordinate/accuracy values alongside opaque source references. The adapter marks its presently available MediaLibrary time as offset-unknown, so the reconstruction engine uses civil-day comparisons unless a future source can prove a trustworthy capture offset. No coordinate, source ID, media, filename, raw EXIF, trace, or reconstruction result is uploaded, logged, or shown in UI.

The deterministic rebuild persists places, visits, journey drafts, structured uncertainty/dispositions, membership links, possible merges, rule version, and a local evidence revision. It applies the effective inclusion correction, blocks disconnected writes, retains the prior committed database result on failure, and clears the in-memory draft on disconnect/delete. Full, limited, and completed selected imports request this local rebuild; Atlas only reports aggregate local-draft state. Same-place evidence with only a civil date may form an uncertain visit and cannot create an elapsed-time journey.

Observed on 2026-10-10: 19 mobile Jest suites / 100 tests and TypeScript passed. These synthetic checks cover deterministic input ordering, complete-link/date-line handling, exclusions, duplicate-conflict semantics, visit/journey boundaries, GPS-less precise-time bracketing, lifecycle retention, repository migrations, and imported private fields. Physical Android/iOS SQLite migration/rebuild, real capture-offset fidelity, GPS availability/accuracy, duplicate detection, reconstruction quality against owner-reviewed history, and owner boundary controls remain unverified.

## Production video Welcome (2026-10-09)

`apps/mobile` now opens at `/` on the agreed Living Atlas beach/lake video Welcome; Trust moved to `/trust`, followed by the existing Import and empty Atlas screens. The app bundles only the approved portrait/wide promotional montage and poster. They are illustrative and silent, never owner media or a personalized Replay. The Welcome requests no photo permission or network data. It waits for a motion preference before native autoplay, starts still for reduced motion or lookup failure, offers explicit Play/Pause, pauses when inactive or scrolled offscreen, and retains a readable poster and CTA if playback fails.

Observed on 2026-10-10: 74 mobile Jest tests, TypeScript, Expo lint, Expo Doctor 21/21, and root `npm run check` passed. The tests cover Welcome → Trust → Import → empty Atlas, no permission on Welcome, motion preference and lifecycle policy, browser autoplay rejection, failed playback, and CTA survival. Physical iOS/Android video playback, native background behavior, and current desktop/mobile browser layout remain to be checked on target surfaces; synthetic component checks do not establish those behaviors.

## M1.5 scheduled library maintenance (2026-10-10)

`apps/mobile` now adds an owner-controlled, initially disabled automatic-maintenance setting. The SQLite migration advances the existing private record to schema v5 with maintenance preference/status, per-run checkpoint, source presence, a durable renewable lease, and a deduplicated normalized change queue for M2.6. A UI-independent reconciler pages only the currently permitted full or limited photo scope, serializes runs, persists pauses before expiry/read interruption, upserts changed normalized metadata, and queues missing identities as deletion candidates only after two completed full-scope scans. It does not add media copying, paths, filenames, EXIF, coordinates, raw evidence logging, route inference, automatic publishing, cloud work, or permission expansion.

The app registers `travel-life-library-maintenance-v1` through Expo BackgroundTask/TaskManager after the owner enables it following a completed import. iOS processing background mode is configured. Settings states that timing is device-controlled and shows pending, restricted, paused, and completed outcomes; disconnect, delete, disable, and access loss unregister future work. Foreground activation asks an enabled maintenance controller to catch up against the permitted scope. This is handler and local-state implementation only: physical Android/iOS development-build registration, developer-trigger behavior, expiry, revocation, disconnect/delete cancellation, and normal OS cadence are unverified and must be recorded separately. No claim is made for force-quit behavior or scheduled execution.

## M2.2 protected optional AI proxy (2026-10-11)

The repository now contains a disabled-by-default `travel-life-ai-proxy` Supabase Edge Function and a matching mobile contract boundary. The function requires platform JWT verification and an anonymous user, rejects bodies with anything other than allowlisted opaque alternatives, binds request consent/rule/evidence/correction revisions, uses the configured `gpt-5.4-mini-2026-03-17` Responses snapshot with `store:false`, and returns typed skips for disabled, unauthenticated, limited, unavailable, timed-out, refused, and invalid-result paths. It never logs request/response bodies. Private RLS-enabled tables reserve ten requests per anonymous subject/day and a USD 5 deployment-day budget atomically; the public quota RPC is callable only by the Edge Function service context, so a client cannot consume shared budget directly.

The mobile module creates request-scoped opaque references from local candidates, holds the opaque-to-local map only in memory on-device, creates or refreshes an anonymous Supabase session using only a publishable project key, rejects stale revisions and unbounded responses, and does not apply a proposal. Local reconstruction has no dependency on this module. The public mobile configuration leaves the proxy endpoint unset until anonymous-auth abuse controls are verified; server-only secrets and dashboard prerequisites are documented under `supabase/`.

Observed on 2026-10-11: 20 mobile Jest suites / 107 tests, mobile TypeScript/lint/Expo Doctor, and root `npm run check` passed; ten synthetic Deno Edge Function contract tests passed; `git diff --check` passed. The linked `fgmcnzxhbrtvjhtafort` project has both M2.2 migrations applied, `travel-life-ai-proxy` deployed and active with JWT verification enabled, and no linked-project security-advisor warnings. The deployment set `TRAVEL_LIFE_AI_ENABLED=false`, so the endpoint is safe but intentionally inactive. Anonymous-auth/CAPTCHA configuration, a real anonymous mobile session, real provider call, provider cost/latency, physical-device session behavior, reconstruction-quality evaluation, and provider-retention behavior remain unverified.

## M2.3 optional inferred grouping review (2026-10-11)

M2.3 adds a transient local review controller that derives only bounded `possibleMerges` from the deterministic reconstruction graph, minimizes them through the existing opaque M2.2 boundary, and maps validated opaque identifiers back to existing local journey IDs in memory. It never applies a result or changes visit support, presence, corrections, confirmed history, publishing, or the deterministic graph. The Atlas displays inferred proposals and local-safe no-eligibility, declined, stale, and skipped outcomes. Disconnect and deletion clear this review state.

The proxy and mobile validators now require a fixed `labelCode` paired with each structural result (`possible-grouping`, `needs-more-evidence`, or `no-suggestion`); the app supplies the approved local wording and accepts no model-written label text. The production kill switch remains `TRAVEL_LIFE_AI_ENABLED=false`, so the review control shows the disabled/skipped fallback without creating a session or network call. Enabling remains deferred until CAPTCHA/rate protection, publishable configuration, and owner-operated anonymous-session validation are complete.

Observed on 2026-10-11: mobile `npm run check` passed 118 Jest tests, TypeScript, Expo lint, and Expo Doctor; root `npm run check` passed framework integrity, 20 foundation tests, and the evaluation-infrastructure smoke check; `npx --yes deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` passed 10 synthetic protected-proxy contract tests; `git diff --check` passed. Focused reconstruction and AI-controller suites passed 15 synthetic tests, and the review-fix mobile suites passed 21. No real provider call, device flow, anonymous session, or reconstruction-quality result is claimed.

## M2.4 small engine regression suite (2026-10-11)

`reconstruction-v1` now has 35 synthetic developer-reviewed regression cases for
the 5 km place boundary, 48-hour/one-day visits, 72-hour/two-day journeys,
30-day caps, 240-hour/ten-day possible merges, date-line and input-order
determinism, GPS-less membership/suggestions, duplicate and missing-date handling,
owner boundaries, usual-area context, A → B → A, and repeated final rebuilds.
The cases explicitly keep trip-memory membership separate from place and visit
support; they retain unresolved alternatives rather than choosing one silently.

Observed on 2026-10-11: the focused engine suite passed 35/35 synthetic cases; the
unrestricted mobile check passed 21 suites / 144 tests, TypeScript, Expo lint, and
Expo Doctor 21/21. Root `npm run check` passed framework integrity, 20 foundation
tests, and evaluation smoke. `product_quality` remains `not_measured`. The optional AI sample is untested
because `TRAVEL_LIFE_AI_ENABLED=false`; no session, network request, provider
output, latency, cost, or quality claim occurred. M2.6 still owns device-backed
incremental/background reconciliation, so these final-input permutations do not
establish scheduler or physical SQLite behavior.

## M2.5 bounded processing and recovery (2026-10-11)

The disabled optional-AI proxy now opens and settles a private, RLS-protected,
service-role-only operational attempt after its atomic quota reservation. The ledger
contains only a typed outcome, bounded nullable token totals, null cost while no provider
invoice or pricing measurement exists, elapsed milliseconds, and frozen contract/rule/model/prompt
versions. It holds no subject, request or response data, opaque references, evidence,
provider errors, headers, or session material; reservations remain conservative and are
never refunded. Owner cancellation aborts the mobile fetch where supported, clears the
pending preview, rejects late proposals, and keeps the latest local graph usable. The
existing durable import resume and atomic local rebuild controls are surfaced as explicit
local recovery actions.

Verification is synthetic only: proxy contract checks exercise reservation-before-provider,
sanitized settlement, nullable unknowns, typed cancellation and failure; mobile tests cover
cancellation, stale/lifecycle safety, prior-graph retention, and recovery controls. The
server kill switch remains false. No anonymous session, provider call, provider cost or
latency, import timing, physical-device behavior, or reconstruction-quality measurement is
claimed; all remain unknown until a separately authorized smoke test or device evaluation.

## Reconstruction lifecycle race fix (2026-10-12)

The local reconstruction controller now invalidates an awaiting rebuild when disconnect
or deletion clears the in-memory graph. A late completion or failure cannot republish
state after that clear. Rebuilds remain serialized on the shared SQLite connection and
stay suspended until the private record is connected again. Focused controller regressions
cover late success, late failure, notification silence, serialization and lifecycle resume;
the full mobile Jest suite passed 152 tests, with TypeScript,
lint, and the root foundation check also passing. Physical lifecycle interruption and
SQLite transaction behavior remain unverified on devices.

## M2.6 incremental journey reconciliation (2026-10-12)

The mobile foundation now records aggregate local reconciliation state alongside
the existing durable M1.5 queue. A completed permitted maintenance pass invokes
a local `reconstruction-v1` rebuild; the rebuild replaces the inferred projection
and clears queued invalidations in one SQLite transaction. The prior projection
remains readable if the transaction, permission, lifecycle, or worker does not
finish. Atlas and Settings now state pending/caught-up outcomes, provide connected
local catch-up and rescan controls, and explicitly say these changes stay private
and unpublished. The headless task uses the same local boundary and does not call
the optional AI path.

Observed on 2026-10-12: 22 mobile Jest suites / 159 tests, TypeScript, Expo lint,
and Expo Doctor 21/21 passed. This is synthetic/runtime validation only. Physical
SQLite migration, iOS/Android interruption, background scheduling, source changes,
and reconstruction accuracy remain unverified. History-target corrections without
a safe lineage mapper remain pending for owner review; they are never discarded or
applied to a partial rebuilt graph.

## M3.1 private Atlas reveal (2026-10-12)

`/history` now projects the committed local reconstruction graph into a bounded
owner-facing reveal model before it reaches UI. The Living Atlas screen leads with
a native map canvas when local inferred journeys are available, states its normal
viewport/tile-request boundary, and always retains a readable
local list. Sparse, pending reconciliation, restricted access, recoverable failure,
and no-journey states present truthful recovery actions. The Replay handoff is
typed and appears only for eligible revealed journeys; it is an availability screen,
not a renderer, export, publish, or share action. Reveal telemetry is opt-in,
allowlisted to coarse state/count events, and safely ignored when consent or a
sink is unavailable.

The native reconstruction repository now has a committed-run read boundary for
Atlas restoration after restart. Its only map output is journey state plus a
coarsened anchor rounded to one decimal degree; source/evidence identifiers,
capture data, and precise coordinates remain inside the SQLite query and never
reach reveal props or telemetry.

Focused mobile tests passed 6 suites / 58 tests, with TypeScript and Expo lint.
These are synthetic checks. Native iOS/Android map rendering, Apple/Google map
provider requests, native configuration, accessibility, device lifecycle states,
and telemetry delivery are not yet verified. No product-quality or engagement
claim is made from this work.

## M3.2 connected Atlas map and Timeline (2026-10-12)

The private Atlas now derives one redacted local exploration state for Map and
Timeline. The durable read boundary produces only local display ordinals,
coarse observed years, a `Date unknown` label when no year is usable, ordering
uncertainty, and already-coarsened map anchors. Raw journey IDs, evidence,
timestamps, civil days, source references, and precise coordinates remain in
SQLite. A selected year retains every journey with an observed visit in that
year; an excluded selection is cleared. Unknown-coordinate journeys remain in
the chronological Timeline and are never plotted.

Map and Timeline controls, year controls, marker/card selection, selected
accessibility state, empty-year recovery, and a scrollable Timeline fallback
all consume that same projection. The map fits only filtered coarse anchors;
unavailable map service and dense views leave Timeline available. No detail,
route, export, publishing, AI, or source-data change was added.

Observed on 2026-10-12: focused Atlas/repository/provider/owner-flow tests
passed 4 suites / 26 tests; the mobile check passed 23 suites / 170 tests,
TypeScript, Expo lint, and Expo Doctor. This does not validate physical
iOS/Android map rendering, provider tile behavior, real dense-map usability,
target-device screen readers, lifecycle interruption, or reconstruction
accuracy.

## M3.3 private journey detail and source-linked memories (2026-10-13)

Atlas now opens a private journey detail only from an opaque local display ID.
SQLite resolves that ID inside the connected-record boundary, then returns
chronological observed visits, date precision, uncertainty, and separately
worded visit-support versus journey-membership reasons. The Atlas projection,
route parameters, telemetry, and detail text contain no source identifiers,
filenames, precise coordinates, raw timestamps, or media URIs. A bounded
four-item preview resolver receives source references only inside the native
adapter after it rechecks permission and cloud availability; the rendered
preview state has no source identifier. Cloud-only, removed, inaccessible, and
failed previews remain readable unavailable-memory states without a replacement
asset or download. The new detail surface follows the Living Atlas photo-led
composition, returns contextually to Atlas, and links only to the later
non-mutating correction handoff.

Observed on 2026-10-13: focused detail/Atlas/repository/adapter/owner-flow
checks passed 6 suites / 37 tests. Mobile Jest passed 24 suites / 176 tests,
with TypeScript and Expo lint also passing. Expo Doctor reported 20/21 checks:
six pre-existing Expo SDK 57 patch-version mismatches (`@expo/ui`, `expo`,
`expo-router`, `expo-splash-screen`, `expo-dev-client`, and `jest-expo`) need a
separate dependency-maintenance decision; M3.3 did not change dependencies.
This is synthetic and runtime validation only. Physical iOS/Android photo
permission, URI rendering, cloud-only behavior, cache behavior, and lifecycle
interruption remain unverified; no reconstruction-accuracy or owner-presence
claim follows.

## M3.4 supportable travel statistics (2026-10-13)

Atlas now receives a read-only inferred-statistics projection from one captured
completed reconstruction run. The local schema stores a resolved country code
and Natural Earth Admin 0 Countries 1:110m dataset version 5.1.1 only on each
reconstructed place during its atomic rebuild. The bundled resolver uses no map,
AI, geocoding, or network path, and invalid, border-ambiguous, and unresolved
coordinates do not receive a country. The display boundary receives only journey,
place, and supported-country counts; it cannot receive country labels/codes,
coordinates, evidence/source identifiers, dates, routes, distance, duration, or
media. Processing, restricted, failed, and sparse reveal states suppress totals.

Observed on 2026-10-13: focused repository/Atlas/resolver/import/lifecycle-provider
/journey-detail tests passed 6 suites / 44 tests. Mobile Jest passed 25 suites / 183
tests, with TypeScript and Expo lint also passing. Expo Doctor reported 20/21 checks
because six existing Expo SDK 57 patch versions are behind its expected versions; this
feature did not change dependencies. Root `npm run check` passed framework integrity,
20 foundation tests, and evaluation smoke checks; `git diff --check` found no whitespace
errors. This is synthetic validation only. Physical iOS/Android SQLite migration,
resolver performance, screen-reader behavior, lifecycle interruption, and
reconstruction/country-resolution accuracy remain unverified.

## M4.1 journey correction planning (2026-10-13)

The [M4.1 delivery spec](../_bmad-output/implementation-artifacts/spec-m4-1-confirm-reject-and-edit-a-journey.md)
now plans scoped confirm/reject, title and date edits, destination and memory
membership changes, basic split/merge, and pending correction-remap review. It
keeps observed evidence separate from owner-entered claims, preserves the
official Journey detail composition, and requires corrections to survive
restart, rescan, and foreground/background reconstruction without silently
remapping ambiguous identities. The current correction schema and M2.6
history-correction pause are identified as implementation prerequisites.
This is planning only: no correction behavior, migration, UI, test result, or
device validation is claimed. Next work is the durable correction contract,
reconciliation mapper, owner review UI, and their acceptance checks within M4.1.
The plan now defines exact successor mapping from reviewed evidence/visit support
sets, strict split/merge ordering for weak dates, an uncertain-memory assignment
entry, one effective owner-visible journey count alongside evidence-based
place/country counts, and a common validator for deterministic, AI-suggested,
and owner-initiated longer-gap merges. Ambiguous lineage and unknown order remain
pending for owner review.
Owner-initiated split/merge now has a distinct publication rule: validated
successors and counts appear in one atomic save, while predecessor-wide title,
date bounds and confirmation await scope review. Only a later ambiguous
automatic remap holds the last complete view. A rejected single-visit journey
cannot automatically re-enter a journey when new evidence arrives; its source
visit remains available and the owner can explicitly resolve or reverse it.
The M4.1 spec now fixes partial-overlap and duplicate-family remap outcomes,
separates `pending_scope_review` from `pending_remap` as durable correction
states, scopes negative constraints to reviewed support units and visit links,
and defines the save token, shared write guard, rollback and rebuild race rules.
An uncertain-memory state matrix keeps availability, trip membership and visit
support independent. These are planning contracts; the current schema and
adapter do not yet implement their lifecycle-generation or duplicate-family
requirements.
The follow-up planning pass adds ordered remap gates with no partial-match
fallback, a rejection invariant anchored to support-unit sets and pairwise
visit incompatibility, an editor state machine for stale previews and save
races, and a legal/forbidden transition table for uncertain memories. These
are acceptance contracts for M4.1, not implemented behavior.
The latest remap clarification gives explicit first-failure outcomes for partial
and mixed support matches. The memory contract now models suggestion targets,
owner-rejected targets, and the one accepted primary separately; choosing a
different primary requires an explicit atomic transfer when one already exists.
The remap plan now includes a normative typed-key resolver and whole-set
containment algorithm. A mixed exact/ambiguous/conflicting correction is
pending in full; no portion of its candidate graph publishes. Existing
media-only choices map by their canonical photo ID without requiring visit
support, while visit and journey corrections require exact support-unit and
successor-visit mappings.

## M4.1 BMAD spec validation (2026-10-13)

The [BMAD M4.1 kernel](../_bmad-output/specs/spec-m4-1-journey-corrections/SPEC.md)
now adopts the existing delivery record and the accepted design/evidence
decisions as its complete planning contract. Its append-only memlog records a
two-pass coherence and preservation review. The remap rules are conservative
and explicit for keys that can be verified, but family-key remapping is not
implementation-ready: the current adapter passes no duplicate-family ID and
the local schema lacks a durable family identity and explicit source-origin
support field. The BMAD spec leaves the source of those signals as an open
question and the delivery spec marks it as a prerequisite. No correction code,
runtime behavior, device result or accuracy measurement changed in this pass.
The follow-up check found a state-model conflict: a newer `pending_remap`
candidate had been described as replacing an `effective` correction even while
the old completed projection remained visible. The M4.1 contract now keeps
owner decisions, committed applications and candidate evaluations separate.
An ambiguous candidate leaves the prior application effective and publishes no
partial result; a valid owner split/merge instead commits its successors and
`pending_scope_review` claims together. Exact matching, partial overlap,
family/source conflicts and both rejection scopes have an explicit case table
in the delivery spec. Durable family identity remains an open dependency.

The M4.1 implementation has now advanced beyond the initial preview-only panel.
On mobile, Confirm/Reject first show the current visible scope, then persist a
local evidence-support revision and the exact owner-visible snapshot, tied to the
loaded reconstruction run. A successful save immediately attempts a local rebuild;
confirmed/rejected outcomes are shown as applied only after that rebuild succeeds.
Stale runs are refused. A failed exact remap is tracked as a separate durable
candidate evaluation, preserving the last committed application and complete
projection. Focused correction UI/provider/reconstruction/migration tests, mobile
typecheck, and mobile lint passed. The migration is now at schema v16. This is a
partial implementation, not full M4.1: title/date edits, destination and memory
membership, split/merge, uncertain-memory review, family identity, owner resolution
of pending remaps, atomic save-plus-projection, device validation and the complete
acceptance matrix remain outstanding.

Final checks on 2026-10-13: mobile Jest passed 27 suites / 198 tests, TypeScript
and Expo lint passed, and root `npm run check` passed framework integrity, all 20
foundation tests, and evaluation smoke. Mobile `npm run check` stopped at Expo
Doctor (20/21): six existing SDK 57 patch versions are behind the expected
versions; no dependencies were changed for this correction work. No iOS/Android
device run or reconstruction-accuracy result is claimed.

## M4.1 implementation start (2026-10-13)

The owner-facing correction entry point is now wired into the private Journey
screen flow within `apps/mobile`: the details screen exposes a review/correct
action, and a dedicated correction route renders a private, read-only review
panel with explicit Confirm / Reject / Review uncertain memories choices. The UI
keeps source evidence local, preserves no-upload semantics, and uses the
existing private journey data contract rather than publishing a remote correction.
This is a bounded implementation step aligned with the M4.1 direction; it is not
an end-to-end correction engine or a final family-identity remap implementation.
The remaining implementation dependency is the durable duplicate-family/support-unit
identity and exact remap precedence for partial and ambiguous successor cases.
The mobile app and repository tests were re-run after the route and local preview
changes; the reconciliation and photo-access suites both passed.

The 2026-10-13 M4.1 code review found that this remains a UI shell: the
Confirm/Reject controls do not save owner decisions, and the story's durable
correction, reconstruction remap, editing, uncertain-memory, and preview/save
safeguards are not implemented in the reviewed diff. The new screen also fails
mobile lint at `journey-correction.tsx:32` (`react/no-unescaped-entities`), though
mobile TypeScript checking passes. Review findings are tracked in the M4.1 story;
the story remains in progress. No device behavior or durable correction is claimed.

Follow-up implementation added schema v13 for immutable local confirm/reject
revisions, with canonical evidence support snapshots, lifecycle/run freshness
checks, replacement lineage, and delete-all cleanup. The correction route now
uses a durable provider save path and returns to the existing detail route; it
shows a save failure instead of presenting an unsaved selection as completed.
This is only the canonical-evidence slice. The native adapter still has no
verified duplicate-family source, so family-key remapping and automatic
projection reconciliation remain unavailable rather than guessed. Focused import
repository/provider tests passed (19 tests), as did mobile TypeScript and lint.
Physical devices, split/merge, membership editing, negative-constraint grouping,
and exact remap publication are still unimplemented and must remain in progress.

Follow-up M4.1 implementation review on 2026-10-13 retained the story as
in-progress. The confirm/reject slice has focused fixture coverage, but its
revision write and projection rebuild still commit separately; a failed or
interrupted rebuild can leave a durable decision without the required updated
projection. The current remapper flattens support to a journey-level match and
rejection removes candidates after grouping, so it cannot enforce per-visit exact
lineage or negative grouping constraints. Owner edits, uncertain-memory actions,
split/merge, duplicate-family identity, idempotent save commands, and owner
pending-remap resolution remain absent. Six focused suites passed (45 tests),
TypeScript and lint passed, and `git diff --check` passed; the correction UI tests
still emit React `act` warnings. The sandbox blocked Jest cache resolution with the
known Windows temporary-directory EPERM; the approved outside-sandbox run supplied
the passing test result. No device behavior or full M4.1 acceptance is claimed.

The next M4.1 correction increment moved the confirm/reject write and its
successor reconstruction into one SQLite immediate transaction. The repository
now records reviewed visit support sets, so a split or ambiguous successor fails
closed instead of flattening every decision to one journey-level support set.
The command key has a unique durable index: a response-loss retry reads the
already committed decision and does not append a revision or a second projection
run. The provider publishes the graph returned by the committing transaction,
then refreshes the redacted Atlas cache, instead of opening another rebuild.
Focused correction/provider/repository suites passed 32 tests; TypeScript and
Expo lint passed, and `git diff --check` found no whitespace errors. The
journey-correction renderer still emits React `act` diagnostics despite the
tests passing; this remains open in the error playbook. M4.1 remains incomplete:
the pre-grouping negative-constraint engine, typed title/date/destination/memory
claims, split/merge, duplicate-family identity, pending-remap resolution, full
acceptance matrix, and device checks are not claimed.

The correction engine now also consumes effective rejection support sets before
automatic journey grouping. A rejected single visit remains a source-supported
visit but is withheld from automatic journey membership; a rejected reviewed
pair becomes separate automatic journeys and is not offered as a possible merge.
The repository validates exact lineage on the unconstrained graph before it
creates this constrained successor graph, so a split or ambiguous remap rolls
back instead of publishing a constraint that guessed at a successor. Focused
engine, correction, provider, and repository suites passed 64 tests. This does
not complete M4.1's structural editing or typed owner-claim requirements.

M4.1a regression coverage now also proves the correction transaction rolls back
when the projection write fails after a revision is staged, when the selected
run becomes stale before save, and when the connected private record is lost at
the final pre-commit lifecycle guard. In each case no commit is issued. The
focused reconciliation repository suite passed 15 tests; mobile TypeScript and
Expo lint passed. This remains synthetic coverage, not a physical-device result.

The focused M4.1a correction regression set now passes 67 tests across engine,
correction-application, provider, and reconciliation repository suites. The
React `act` diagnostics are traced to an installed incompatible nested test
renderer peer range (`^19.3.0` against the app's React 19.2.3), recorded in the
error playbook, and intentionally left for the framework-version workflow rather
than changing dependencies during this story.

The root `npm run check` also passed: framework integrity matched 44 skills and
four BMAD runtime trees, all 20 foundation tests passed, and eval smoke checks
retained their explicit non-quality result. This does not replace the pending
native device validation for M4.1a.

## M4.1 memory membership corrections (2026-10-14)

The local correction path now stores immutable v21 memory-membership revisions
for assign, move, reject, and unassign decisions. Each revision carries the
selected canonical evidence key and the complete target-journey support set;
the rebuild accepts the target only through the same exact successor mapping
used for other corrections. An assign or move atomically replaces any earlier
owner primary for that evidence, while reject and unassign remove only the
selected membership. The overlay changes neither visit support nor place or
country counts. Journey correction shows opaque memory IDs only and requires a
preview before the local save; inaccessible memories cannot newly assign or
move. Lifecycle and stale-run guards protect the save and the provider only
publishes the committed graph after the redacted Atlas refresh.

Focused correction/provider/repository/migration tests passed 5 suites / 56
tests, and mobile TypeScript and Expo lint passed. This is synthetic coverage.
The bounded uncertain-memory list, competing-target display, durable pending
remap candidates for memory corrections, duplicate-family identity, split/merge,
and device validation remain incomplete.

## M4.1 structural split and merge (2026-10-14)

The local correction schema now migrates through v23 and stores immutable split
and merge revisions with a typed structural payload. A split records the complete
reviewed support for one strictly ordered left visit and rebuilds with an
owner-boundary marker. A merge records two adjacent, strictly ordered single-visit
journeys and rebuilds them as one owner-visible successor. Both writes use the
existing immediate transaction, lifecycle/stale guards, idempotency key, and
redacted Atlas refresh. The owner correction screen previews both operations and
uses only opaque local visit and journey IDs. Save-time validation rejects weak,
same-day/unknown ordering, nonadjacent targets, missing support, and generated-ID
targets. Structural revisions are applied as grouping constraints rather than
being mapped to a generated journey target.

Focused structural, correction UI, provider, migration, and repository suites
passed 6 suites / 60 tests; the complete mobile suite passed 28 suites / 218
tests; mobile TypeScript and Expo lint passed; and root `npm run check` passed.
This is synthetic verification only. M4.1 remains in progress: merge currently
covers adjacent single-visit journeys, predecessor-wide claims still need durable
pending-scope records and owner resolution, the bounded uncertain-memory list and
competing-target view are incomplete, duplicate-family support identity is not
available from the adapter, destination removal and owner remap resolution remain
unimplemented, and physical iOS/Android validation has not been run.

## M4.1 pending scope review (2026-10-14)

Schema v24 adds durable `pending_scope_review` records. A structural split or
merge supersedes only predecessor-wide confirmation and owner title/date
revisions, publishes the structural successor in the same transaction, then
records each affected successor for owner scope review. A successor does not
show the predecessor claim as accepted. Saving a fresh scoped confirmation or
owner claim resolves that successor's pending-scope record. This is distinct
from `pending_remap`, which holds a later ambiguous automatic rebuild.

The complete mobile suite passed 28 suites / 219 tests, and root `npm run
check` passed. Remaining M4.1 work includes destination removal, broad memory
review, duplicate-family identity, remap resolution, integration coverage of
titled predecessors and successor scope records, and device acceptance checks.

## M4.1 destination removal (2026-10-14)

Schema v25 adds a typed `remove-visit` correction revision. The owner selects
one opaque reviewed visit, previews the change, and saves an exact support-set
revision. Rebuild removes that visit only from the selected journey projection;
the visit, canonical evidence, place support, and country support remain in the
underlying reconstruction. The correction is stale/lifecycle guarded and uses
the existing atomic projection transaction. Full mobile verification passed 28
suites / 220 tests, TypeScript, Expo lint, root `npm run check`, and diff
whitespace validation. Remaining M4.1 work is the durable remap-resolution UI
and candidate records, bounded uncertain-memory review with competing targets,
duplicate-family identity, acceptance-matrix integration coverage, and device
checks.

## M4.1 pending-remap owner resolution (2026-10-14)

An ambiguous correction remains withheld from the published projection and is now
visible only on a successor that overlaps its private reviewed support. The
journey review surface explains the bounded remap reason and offers two owner
paths: save a fresh scoped correction for the rebuilt journey, or preview and
discard the old withheld correction. Discarding supersedes only the pending
revision and candidate, then rebuilds and publishes the resulting complete graph
inside one SQLite transaction. It does not delete evidence, visits, places,
memories, or silently accept a successor. Candidate identifiers remain inside
the local repository and never enter the owner-readable detail contract.

Focused UI, provider, reconstruction-repository, and migration suites passed 4
suites / 47 tests, with mobile typecheck and Expo lint passing. This is
synthetic coverage. Remaining M4.1 work is bounded uncertain-memory review and
competing-target display, durable pending-remap handling for memory corrections,
duplicate-family identity when an adapter source is available, broader
acceptance-matrix integration coverage, and physical iOS/Android checks.

## M4.1 uncertain-memory review (2026-10-14)

The journey correction screen now opens a bounded, local page of photos that
lack visit support. Owners may search by observed date, page through at most 12
rows at a time, see availability and coarse location-metadata state, and see how
many journey suggestions exist without exposing other journey identifiers. Each
row retains the existing preview-before-save assign, move, reject, and unassign
flow. A memory-only assignment remains separate from visit, place, country, and
owner-presence support. The database query and all opaque memory mappings remain
on device.

Focused UI, provider, and reconstruction repository suites passed 3 suites / 36
tests, with mobile typecheck and Expo lint passing. This is synthetic coverage.
Remaining M4.1 work includes durable pending-remap handling for memory
corrections, integration coverage for the full acceptance matrix, and physical
iOS/Android checks. Duplicate-family scoped correction remains unavailable until
the import adapter supplies a durable verified family identity and normalized
support tuple.

## M4.1 code-level closure (2026-10-14)

Schema v26 gives memory corrections their own durable pending-remap queue. An
automatic ambiguous memory remap is now retained for owner review and can be
discarded without affecting source evidence or unrelated corrections. The full
M4.1 implementation is ready for physical validation; use
`docs/development/m4-1-device-validation.md` for the private iOS and Android
checks. Duplicate-family scoped correction remains a deliberate unsupported
case until import exposes a durable verified family identity and normalized
support tuple; current independent canonical evidence corrections remain
supported.

## M4.1c verified duplicate-family identity (2026-10-14)

- **Decision implemented:** only an explicit stable identifier provided by a platform integration may form a duplicate family. Expo Media Library currently provides no documented identifier, so normal imports persist `null` and remain independent evidence.
- **Durable behavior:** schema v27 stores private family identity plus a versioned normalized support tuple; schema v28 stores the reviewed family membership and tuple snapshot with each journey or memory correction. A family is usable only when all available members agree exactly. A changed, missing, or conflicting reviewed family fails closed to pending remap and never supplies duplicate visit support.
- **Evidence:** focused family/import/reconstruction tests passed 5 suites / 84 tests; full mobile Jest passed 28 suites / 223 tests; `npm --prefix apps/mobile run typecheck` and `npm --prefix apps/mobile run lint` passed.
- **Remaining device check:** on iOS and Android, determine whether a selected native provider exposes a documented stable family relationship. Record only aggregate capability. If no provider does, the implemented independent-copy path is the intended result.

## Android Atlas sparse-state clarification (2026-10-14)

Android device validation showed a connected local import with 2,989 accessible records and 1,957 available geotag metadata, while Atlas was sparse. The prior sparse heading incorrectly said `No private record yet`; it now says `No journey revealed yet.` so it does not direct an owner to nonexistent Settings controls. Focused owner-flow and Atlas reveal suites (17 tests), typecheck, lint, and `git diff --check` passed. This does not establish why the current private library produces no supported journey; it remains an Android reconstruction/device observation to investigate without recording personal metadata.

## Android sparse Atlas aggregate diagnostics (2026-10-14)

The sparse Atlas now displays aggregate counts from the last completed local reconstruction: evidence assessed and supported, inferred places and visits, and fixed reason buckets for evidence without visit support. The read uses the completed run in SQLite, so the counts survive an app reload, and the UI includes a local recheck action when no completed run is available. It does not expose evidence IDs, precise locations, or media metadata. Focused suites passed 35 tests; full mobile Jest passed 28 suites / 228 tests; mobile typecheck, Expo lint, and root `npm run check` passed. The physical Android result remains unverified: reload the running development build, open the sparse Atlas, and share only the aggregate numbers from **Local evidence check**. Those numbers will determine the next reconstruction fix, if any.

The owner subsequently observed 2,989 assessed, zero supported, zero places, zero visits, and all 2,989 in the broad insufficient-location bucket on Android. The current adapter and repeat-import path can fill coordinates, but the pre-reconstruction M1.3 import retained only a location-present flag. An existing index may therefore need an explicit metadata refresh; the cause remains unverified until the owner reruns Start metadata import and checks the new aggregate. Do not infer that the 1,957 location-present flags are valid coordinates or supported visits.

## Android reload SQLite lock repair (2026-10-14)

The owner saw an uncaught `database is locked` rejection from native SQLite during an Android development reload. The exact call is unknown. The import repository previously began an immediate write transaction on every lazy open, even at the current schema version, while reconstruction used another connection to the same database. Current-schema opens now only read the version, both connections wait up to 30 seconds for an active SQLite writer, and the startup reconciliation read has a handled error state. Fresh installs and older schemas still run the migration transaction. Full mobile Jest passed 28 suites / 234 tests; mobile typecheck and lint and root `npm run check` passed. The device reload and metadata refresh still need physical recheck; this synthetic result does not prove the lock is gone in every OS scheduling case.

## Android Atlas native map manager compatibility (2026-10-14)

The Android development client then reported that the native `Marker` view manager
was undefined. Atlas initially prevented a repeat crash by falling back to Timeline,
but that safeguard recognized only legacy `AIRMap` and `AIRMapMarker` managers.
This app has React Native new architecture enabled; the linked `react-native-maps`
1.27 package uses the Fabric names `RNMapsMapView` and `RNMapsMarker`. The
Fabric-aware gate then exposed a Marker-only Android runtime failure, so Atlas now
uses the native map surface without native Marker children. It centers on the
already-coarsened anchors and retains Timeline as the journey-selection control.
Focused Atlas coverage, mobile typecheck, and lint passed. Reload the JavaScript
bundle to verify this marker-free map; the separate SQLite reload repair still
needs its deliberate concurrent device check.

## Android metadata-refresh result (2026-10-14)

The owner refreshed the current Android accessible scope and Atlas then reported
165 inferred journeys, 67 inferred places, and 5 supported countries from 2,989
device-visible records. This resolves the earlier zero-support result as a stale
local-index outcome for this device. These aggregate counts do not prove exact
journey boundaries, complete coverage, or owner presence. The installed client
also displayed the tested Timeline fallback without a marker crash. The device
then exposed the legacy-only manager-name gate; the Fabric-compatible correction
is ready for a JavaScript reload. An intentionally concurrent reload/import timing
case is still required to fully close the SQLite-lock check.

## Android Atlas MapLibre provider replacement (2026-10-14)

The prior marker-free Google map could not be enabled because Google Maps Platform
reported that this billing profile is in a prohibited territory. The app now removes
`react-native-maps`, the Android Google-key dynamic configuration, and every
Google API-key prerequisite. It uses `@maplibre/maplibre-react-native` 11.5 with
its Expo config plugin and the existing React Native new architecture. The Android
development build uses MapLibre demo tiles solely for device verification; the
native source receives only coarsened local anchor points and contains no evidence,
media, or source identifiers. Its disclosure says that the tile service may receive
viewport and tile requests. A production tile/style provider remains deliberately
unconfigured because MapLibre documents its demo tiles as development-only.

The view renders map points as a local GeoJSON source, supports selection by a
coarsened anchor, and keeps the Timeline fallback if an old development client
lacks the native module. Focused Atlas coverage passed 14 tests with TypeScript
and Expo lint; full mobile Jest passed 28 suites / 235 tests, and root `npm run
check` passed. The fresh debug APK includes `libmaplibre.so` and no Google Maps
package. `npx expo run:android --device 2211133G --no-bundler` built successfully,
installed it, and opened the development deep link on the connected device. The
owner must still validate the visible MapLibre surface. This is not a production
map-service decision or a proof of external-provider privacy behavior.

## Atlas map journey preview specification (2026-10-15)

The owner requested a map-first exploration loop: tapping a journey point should
open a dismissible card over the map with trustworthy date/title context and a
local media preview. “See photos and videos” should open a private gallery and
return to the same map camera, selected point and year filter; X or an empty-map
tap should close the card without taking the owner to Timeline. A secondary
“Review or correct journey” action opens the existing correction flow and must
restore valid map context on return. The planning
contract is [the Atlas journey preview spec](../_bmad-output/specs/spec-atlas-map-journey-preview/SPEC.md)
with interaction, acceptance, and brownfield companions. It distinguishes
owner-provided titles/dates from observed evidence, prohibits invented place
names from coarse anchors, and requires bounded media loading and a Timeline
fallback. The present Journey detail exposes only four preview memories, so a
full associated-media viewer still requires implementation. The owner confirmed
that videos belong in the same gallery and that correction belongs on the card;
those choices are now recorded as acceptance cases. No app code was changed for
this specification.

## Atlas map journey preview implementation (2026-10-15)

Atlas now keeps selected journey context in place, loads the current private
journey projection behind the opaque display ID, and presents a dismissible
Living Atlas preview card rather than requiring the detail route. The card
separates owner claims from observed evidence, has a photos-and-videos entry,
and offers correction directly. A private in-memory return context restores the
Map/Timeline choice, year, and selected opaque ID after backing out of a
map-origin correction. It never holds media source IDs or media data.

The viewer renders only device-local available media returned by the existing
bounded preview resolver. Videos are muted and require an explicit Play action;
they pause on background or viewer close. The current local detail resolver is
still bounded to four associated entries, so this does not establish an
unbounded associated-media album. Focused Atlas/detail tests (19 tests), mobile
TypeScript, Expo lint, root `npm run check`, and `git diff --check` passed.
Physical iOS/Android map hit testing, safe areas, background playback, and
correction return remain unverified.

## Atlas map and journey-list refinement requirements (2026-10-15)

The owner requested detailed requirements for a lean, minimalist, professional
Atlas while retaining MapLibre. The new
[refinement contract](../_bmad-output/specs/spec-atlas-map-and-list-refinement/SPEC.md)
defines compact header/summary/filter controls, a generous quiet map, restrained
selected points, and flat year-grouped journey rows below. Visual, interaction,
brownfield and Given/When/Then acceptance companions capture the detailed work.
The existing journey-preview contract remains mandatory, including paged local
photos/videos, overlap choice, camera preservation and safe correction return.
The current partial viewer and return context are not treated as completed
evidence for those requirements. Basemap styling is separate from MapLibre's
renderer; a production source/provider remains unselected. Portrait sizing and
latest-first comparable ordering are explicit working defaults. This turn changes
requirements only; no app code or device results are added.
Document checks passed for five stable capabilities, 23 acceptance cases and
all companion paths; root `npm run check` and `git diff --check` passed.

## Atlas map and journey-list refinement implementation (2026-10-15)

Atlas now leads with a compact private header, reachable map disclosure, shared
year filter, larger MapLibre surface, muted ordinary anchors, a distinct citrus
selected anchor, explicit overlap choice, an in-place preview, and concise local
journey rows. The redacted fallback title is `Private journey`, not an ordinal or
invented place. The selected gallery now reads stable pages of at most 12 mixed
local associations from the current completed projection; source references are
resolved only by the local photo adapter after explicit entry, and videos remain
muted and stopped until Play. Page reads and preview reads are lifecycle and
generation guarded, so stale or revoked content does not publish.

Focused Atlas, provider, and reconstruction-repository suites passed 47 tests;
mobile typecheck and Expo lint passed; root `npm run check` and `git diff --check`
passed. The Jest sandbox cannot rename its cache files, so focused Jest ran
outside that sandbox after the documented EP-010 retry. Native iOS/Android
validation remains required for actual MapLibre overlap/empty-map hit testing,
the actual MapLibre pan/zoom event and correction-return behavior, safe-area/
large-text layout, gallery Back and video background pause. A production map
provider remains deliberately unselected. The implementation now stores only a
coarse `[longitude, latitude]` plus zoom in ephemeral Atlas context when
MapLibre reports a region change; this is never persisted or sent to the tile
service.

Independent review then added source-press/overlap and gallery page/retry
coverage, corrected latest-first durable ordering, antimeridian framing,
filtered-anchor recovery, Timeline preview errors and gallery retry behavior.
The focused mobile suites now pass 49 tests alongside typecheck, lint, root
checks and whitespace validation. Device interaction remains unverified; it is
not implied by the mocked MapLibre or Expo Video suites.

The final full mobile check passed all 28 suites / 237 tests with TypeScript and
lint. Expo Doctor remains 20/21 because nine Expo SDK packages are one patch
version behind its current recommendation; this pre-existing dependency drift is
recorded separately and was not changed as part of Atlas.

## Android Atlas rebuild and smoke validation (2026-10-15)

The fresh debug Android build installed successfully and loaded the current
Atlas route on the connected physical device. The MapLibre surface initialized
without the prior marker crash. During the first native smoke run, the
OS-invoked maintenance task exposed a real nested SQLite transaction error:
foreground and maintenance repository wrappers can share Expo SQLite's native
connection. A shared transaction gate now serializes every explicit transaction
across import and reconstruction wrappers, including migration. The regression
uses two repository wrappers around one database double; it proves that the
second transaction waits for the first to commit.

Focused device-fix coverage passed 4 suites / 41 tests; the complete mobile
check passed 29 suites / 238 tests, plus typecheck and lint. Expo Doctor remains
20/21 due to the existing nine SDK patch-version recommendations. The rebuilt
device registered the maintenance task and opened Atlas/MapLibre without a
nested-transaction, fatal, React Native, marker, or bundle-load error in
filtered native logs. Android did not execute a new scheduled maintenance
callback during the observed smoke window, so this repair remains a
code-level/device-startup mitigation until that callback is observed. The
registered job was subsequently forced once through Android JobScheduler; it
logged that it was executing and remained active during a bounded observation
window without an error, but its completion was not observed. No
screenshots, raw media, coordinates, or device
identifiers were retained. Direct private UI interaction—point overlap choice,
empty-map dismissal, gallery Back/video pause, and correction return—still
needs owner-performed visual validation because this check deliberately did not
read or capture private screen content.

## Android Atlas processing-map repair (2026-10-15)

The owner photo showed a responsive selected journey card and list but no map.
That was not a MapLibre native-module failure: reconciliation correctly marked
the current record as processing, while Atlas incorrectly hid its existing
durable map projection unless the record was ready. Atlas now keeps a non-empty
durable map/list/filter projection available during processing, with the
not-final warning retained and Replay still unavailable. It also uses MapLibre's
texture-backed Android view so the map composes beneath the React preview card,
stops source presses from bubbling into the empty-map dismiss action, and
switches to the Timeline fallback if style loading fails.

Focused Atlas coverage passed 18 tests with mobile typecheck, Expo lint and
whitespace validation. A physical device rerun remains required to confirm the
visible map beneath the card and its touch/overlay behavior; mocked MapLibre
tests are not proof of native composition or tile rendering.

The follow-up debug APK rebuilt and installed on Android. Filtered native logs
confirmed the texture-backed MapLibre manager loaded and Atlas opened without a
React Native, SQLite, marker, or bundle-load error. The owner still needs to
confirm the rendered map/card composition and touch behavior visually; no
private screen capture was collected for that check.

## Android Atlas gesture and point-selection repair (2026-10-15)

The owner confirmed the texture-backed map is visible, then reported that its
pan/zoom felt unsmooth and that journey-point taps did not open a preview. Atlas
now disables the enclosing screen scroll while the native map owns a touch or a
region gesture, then restores normal page scrolling at gesture end. MapLibre's
pan, pinch, and double-tap zoom are explicit at its 60 FPS target, and the local
coarsened-source hitbox is enlarged for reliable point selection. No map anchor
precision, media reference, or provider configuration changed.

Focused Atlas interaction coverage passed 19 tests; the complete mobile check
passed 29 suites / 241 tests with TypeScript and Expo lint. Expo Doctor remains
20/21 solely due to the existing nine Expo SDK patch-version recommendations.
Physical Android verification is still required: pan/zoom should feel direct,
point taps should open the preview, and scrolling should resume immediately
after leaving the map gesture.

The JavaScript-only repair was then loaded into the connected Android
development client without a native rebuild. Atlas opened with no filtered
fatal, React Native, marker, SQLite-lock, or bundle-load error. The remaining
acceptance evidence is owner-performed touch confirmation; no private screen
capture was taken.

During the follow-up device validation Metro had stopped, leaving the connected
development client with no local bundle to load. Metro was restarted in
development-client mode, port 8081 and the ADB reverse tunnel were restored,
and Android accepted a fresh Atlas launch. This is a recovered development
server lifecycle issue, not evidence of a native Atlas crash; owner visual
confirmation remains required.

## Atlas visible associated-photo repair (2026-10-15)

The owner correctly observed that Atlas did not visibly show photos. The local
media resolver and full-screen viewer existed, but the map card and gallery
rendered only text labels. Atlas now renders the first accessible associated
local photo in the selected journey card and photo thumbnails for the bounded
gallery page; unavailable and video entries retain explicit non-fictional
placeholders and do not trigger a download. Focused Atlas coverage passed 19
tests and the complete mobile suite passed 29 suites / 241 tests with
TypeScript and cache-free lint. A physical Android confirmation is still
required; no private photo was inspected or captured during implementation.

The first Android gallery recheck showed every association as unavailable. The
cause was confirmed: Expo Media Library's `getIsInCloud()` is iOS-only, but the
preview resolver called it on Android; its thrown unsupported-platform error was
mistaken for an unavailable image. The resolver now performs the cloud check on
iOS only and reads permitted Android local URIs directly. Focused Atlas/native
adapter coverage passed 27 tests and the full mobile suite passed 29 suites /
242 tests. The updated bundle still requires an owner device check.

After Android was reauthorized for ADB, the repaired local bundle loaded and
Atlas opened without a filtered app startup error. The owner must now confirm
that selecting a journey and opening its gallery displays local photos; no
private photo content was collected during this validation.

The next owner screenshot showed that previously imported Android media remained
labelled unavailable. Those records carry an `unknown` persisted availability
when their original Android import could not perform the iOS-only cloud probe;
the repository had incorrectly removed their bounded local references before
the current-permission resolver could check them. Atlas now withholds only
confirmed-unavailable sources and attempts the bounded `unknown` set locally.
The gallery distinguishes that transitional state from a confirmed unavailable
asset. A new repository regression proves the source is retained; focused
coverage passed 51 tests and the full mobile suite passed 29 suites / 243
tests, with TypeScript and cache-free Expo lint. Expo Doctor remains 20/21
solely due to the pre-existing nine Expo SDK patch-version recommendations.
The JavaScript-only bundle still needs a physical owner check; no private media
or device identifier is recorded here.

The connected Android development client has now been relaunched with this
unknown-reference correction. The Metro tunnel was restored and a
privacy-filtered, application-process-only startup check found no fatal, React
Native, bundle-load, marker, or SQLite-lock error. This confirms only that the
bundle starts; the owner must still confirm visible photo thumbnails in the
gallery.

## Continuous trips and album interaction implementation (2026-10-16)

Implemented the first V1.1 continuity pass before persistence for unreviewed
graphs: it merges only adjacent fragments that are both at least 50 km from a
frequently observed (12 distinct local days) base and separated by no more
than ten days. It does not use city or country as a grouping key, and it skips
owner-corrected graphs rather than silently remapping corrections. This enables
a continuous multi-city trip while retaining an interruption-safe base check;
the wider canonical base/routine pipeline remains the outstanding release
hardening work in the V1.1 spec.

Atlas durable projection now derives offline coarse country labels and month
ranges entirely on-device. A map-dot or Timeline selection opens one
viewport-level native preview sheet, preserving the underlying Atlas state.
The media action opens a full-screen three-column local album grid with
mixed-media placeholders and returns to the selected journey preview. Gallery
reads are bounded to 60 items per page. Focused host verification passed 49
tests plus TypeScript and cache-free lint; root `npm run check` and
`git diff --check` pass. Android physical confirmation of the sheet position,
grid scrolling, return path, and the owner library's actual continuity result
is still required; no private media or precise location was collected.

The first post-change owner screenshot still showed split October Taiwan rows
and a failed reconstruction state over the prior durable record. The continuity
limit was expanded from 72 hours to ten days while retaining the frequent-base
and far-away gates; a seven-day multi-city regression now passes. The connected
Android client was relaunched against Metro after this correction, and a
privacy-filtered application-process startup check found no fatal, React Native,
SQLite-lock, or bundle-load error. The owner must now invoke the local rebuild
and confirm its actual result; startup success does not prove reconstruction
recall or quality.

The next correction removed the two generic root causes exposed by the device
examples: effective corrections now pin only their exact matched journeys, so
unrelated unreviewed episodes still receive the bounded away-from-base
continuity pass; and a place country label is now a consensus over all of its
supported members rather than a single deterministic representative. Border,
invalid, and conflicting-country evidence abstains rather than inventing a
location. Synthetic regressions and the complete mobile check (29 suites / 252
tests, typecheck and lint) pass. This remains unverified against the private
library until the next local rebuild.

The ready Atlas now also exposes **Rebuild local journey history**. It invokes
the full reconstruction controller rebuild (not the incremental catch-up
queue), so an owner can apply an updated local engine to the already imported
library without waiting for a failure state. Its UI interaction regression and
physical Android rebuild remain required before this is considered device
accepted.

While that rebuild runs, Atlas now presents an explicit busy notice: it says
that saved evidence and trips are being recalculated, retains the last map for
reference, and tells the owner that the map and journey list refresh
automatically when the notice disappears. It intentionally reports no invented
percentage or estimated time because the current local transaction does not
produce reliable phase counts. The focused Atlas UI suite passes 20 tests and
TypeScript passes; the connected Android device must be reauthorized to ADB
before physical confirmation can resume.

## Obsidian Horizon Atlas presentation implementation (2026-10-17)

The private native Atlas now uses its approved Atlas-only Obsidian Horizon /
Deep Sea Glass presentation: a deep-navy map surface, glass local-search and
filter region, labelled local zoom/reset controls, and cyan/amber/gold map
affordances. Search operates exclusively on the currently visible redacted
journey projection and clears a filtered-out card selection without a network
or telemetry path. Existing guarded media, correction return, overlap selection,
coarse MapLibre payload and Timeline fallback remain intact; no provider,
dependency, schema, reconstruction, route, or browser-map capability changed.

Focused Atlas verification passed 22 tests outside the known sandbox Jest cache
boundary. The complete mobile check passed 29 suites / 270 tests, TypeScript and
lint; root `npm run check` and `git diff --check` passed. Expo Doctor remains
20/21 due to the pre-existing nine Expo SDK patch-version recommendations. Native
Android/iOS portrait and wide/tablet visual checks, large text, provider-request
inspection, 1,000-row stress, and production map-provider selection remain
unverified and are not implied by mocked MapLibre tests.

## Obsidian Horizon Atlas visibility correction (2026-10-18)

The new map treatment is now visibly available in the browser-delivered
synthetic prototype at `/reveal`: its bundled local geography uses the approved
Deep Sea Glass palette, cyan/amber selected anchors, gold cartography labels,
glass controls, and the “EXPLORE THE WORLD” map hierarchy. The native Atlas
also retains a provider-free local visual canvas whenever web, production, an
older client, sparse evidence, or a MapLibre style failure makes the optional
native map unavailable. That canvas plots only existing coarse anchors; it
does not request tiles or invent locations. Nonfunctional zoom controls are
hidden on that fallback.

Prototype owner-flow tests (18) and its complete check (27 total Jest tests,
typecheck, lint) pass. Mobile focused Atlas tests (22), mobile typecheck, and
whitespace validation also pass. The browser-native mobile app cannot yet be
visually checked because its existing Expo SQLite worker bundle fails before
the route mounts; Android confirmation remains blocked because the local ADB
daemon cannot start. Neither limitation is presented as proof of product UI.

## Reference-faithful map specification (2026-10-18)

The owner clarified that the map visual must match `World Map.jpg`; they
temporarily deferred the search/utility treatment, left mode dock,
compass/slider, route arcs and polished persistent card. The existing blue
fictional geography/grid canvas remains a visual mismatch, despite earlier
visibility and automated-check claims. It is not an accepted reproduction.

The canonical delivery plan is
[`spec-atlas-reference-cartography`](../_bmad-output/specs/spec-atlas-reference-cartography/SPEC.md),
with visual acceptance, cartography architecture and development-plan
companions. Decision 0013 records scope precedence and permits flat baked
geographic shading while excluding runtime 3D terrain. The proposed approach
uses a licensed bundled world base and a common projection for browser/native
markers; source/renderer suitability remains a measured feasibility gate.

Five gates cover baseline/reference freeze, geographic/rendering proof,
owner-accepted visual master, browser/native integration and actual platform
delivery. Twenty acceptance cases cover visual fidelity, geographic alignment,
state/privacy, offline/release reachability and resources. This turn creates
planning records only; no new cartography is implemented or visually accepted.
Planning validation passed capability/acceptance uniqueness, companion/local
links and template-marker checks. Root `npm run check` passed framework
integrity, 20 foundation tests and eval smoke; whitespace validation passed.

## Owner-confirmed destination anchor (2026-10-18)

Journey correction now supports a private, offline place search and an explicit
owner-confirmed destination anchor. The first bundled result supports `Phú
Quốc, Kiên Giang, Vietnam` (including the unaccented query `Phu Quoc`). Saving
it preserves inferred Kiên Giang and all observed evidence, while the qualified
Atlas projection uses the selected place label and a deliberately coarse marker
anchor. The correction is schema-versioned, remaps only through the existing
stable-support correction contract, and becomes pending review rather than
silently moving after an ambiguous rebuild or split/merge.

Focused correction and migration regressions pass (67 tests), and mobile
TypeScript passes. A fresh arm64 Android debug build was installed over the
existing development app without clearing local data and cold-launched against
the current Travel Life Metro process; no filtered fatal-startup error appeared.
Owner-visible confirmation of the selected marker still remains a manual check.
Full mobile lint is currently blocked by unrelated concurrent cartography
ref-in-render errors.

**Interaction follow-up:** The correction screen now keeps place-result taps
available while the search keyboard is open, and shows the selected place's
confirmation action directly beneath the result. This fixes the owner-reported
inability to choose and confirm a place. Focused correction regression passes
(10/10), mobile TypeScript passes, and the Android development client was
reloaded against a fresh Android bundle. The owner still needs to complete the
real-device choice and save interaction.

**Owner UX correction:** The one-place demonstration catalogue was replaced by
an offline worldwide search over the already-bundled Natural Earth Admin-1
gazetteer, plus the reviewed Phú Quốc island result. Results such as Bali,
Tokyo, Hanoi, and Bangkok are now selectable without sending the query or any
trip data off-device; the marker remains deliberately coarse. The place-save
outcome now appears directly beside confirmation with a direct return to Atlas.
The noisy `Correct location` control was removed from every Timeline row;
owners reach correction through the selected trip preview/detail instead.
Focused correction/search regressions pass (11/11), Atlas regression passes
(22/22), and mobile TypeScript passes. Android reload remains the next device
acceptance check. The Android development client has now received fresh Metro
bundle `bj` (98 ms) and resumed; owner confirmation of the real save and marker
movement remains required.

**Correction entry and persistence follow-up:** The selected journey preview
and detail now name the single contextual action `Correct location`; it saves
the selected Atlas context before navigating to the correction screen. The
action remains absent from every Timeline row. A repository-level regression
now verifies that selecting Phú Quốc persists its offline place ID, display
name, context, and coarse anchor and writes the remappable correction
application; the route regression verifies the selected opaque journey and
Atlas context reach the correction handler. Focused location regressions pass
(71 tests) and mobile TypeScript passes. The Android development app was then
cold-relaunched on device `9cb47ed9` against a fresh local Metro server without
clearing data; its current-process logs contain no bundle or module-loading
error. Owner confirmation of the tap, private save, and marker movement remains
the acceptance check rather than claimed from startup alone.

**Final-identity correction:** A real owner save exposed that a `place`
revision had been applied to a pre-continuity journey ID instead of the final
canonical journey committed for Atlas. The correction is now remapped again
after continuity construction and that final mapping drives both correction
application and owner-confirmed qualification. A regression covers an
intermediate ID replaced by one final canonical successor. Focused
correction/Atlas/search/repository checks pass (74 tests), TypeScript and root
`npm run check` pass, and the existing Android development app was reloaded on
`9cb47ed9` without clearing data; no current-process startup/module error was
observed. The owner must confirm the re-saved place visibly moves the marker
and changes the label; no device data claim is inferred from process startup.

**Owner rejection of final-identity repair (2026-10-18):** The owner re-confirmed
the selected place on Android and reports that the trip still does not change.
The prior correction therefore remains unaccepted; the unresolved cause is
unknown. The correction screen also leaves the old search text after a result
is chosen and separates confirmation into a second panel. BMAD Party is
revisiting the one-task UX and the save-to-projection contract. Next work is to
trace this specific journey through saved revision, application, committed
qualification and durable reveal; a successful build or fixture alone is not
evidence of the visible correction.

**Owner Edit-flow direction (2026-10-18):** The selected trip card should show
`Edit` immediately below `See photos & videos`. `Correct location` is one
independent task inside that common Edit flow, not a competing top-level CTA.
The owner asks for a review of all current Edit UI/UX: lean, low-copy,
intuitive, and self-service. The current all-in-one correction screen remains
under review; no UI implementation or save repair is claimed by this decision.

**Edit-flow plan:** The owner approved five Edit tasks: Location, Name & dates,
Destinations, Photos in this trip, and Trip accuracy. The delivery sequence,
UX states, correction read-back gate, migration needs, tests and
device acceptance are in
`_bmad-output/implementation-artifacts/trip-edit-flow-plan-2026-10-18.md`.
Planning only: the Phú Quốc save failure is still open, and no redesigned
screen or corrected runtime behavior is claimed yet.

**Trip Edit implementation (2026-10-19):** The approved compact Edit hub is
implemented: Location, Name & dates, Destinations, Photos in this trip, and
Trip accuracy open independently from a selected journey. Atlas presents
`Edit` directly below `See photos & videos`; the legacy correction deep link
now uses the same focused Location screen. Selecting an offline place writes
its label back into the field and keeps `Confirm place` in that same panel.
A place correction returns `applied` only after both the final journey detail
and durable Atlas projection match its owner-confirmed place, label, and coarse
anchor. If continuity gives that trip a new opaque ID, the provider accepts
only one durable successor with the exact selected label/anchor and verifies
its detail before reporting success. The focused mobile suite passes 53 tests,
TypeScript and lint pass.
**Android owner acceptance (2026-10-19):** The owner confirmed that the
journey Edit → Location flow works on the physical device: a saved choice moves
the intended marker and persists after reopening. This closes the outstanding
Android acceptance gate for this focused correction flow. It does not establish
iOS behavior, unrelated edit tasks, reconstruction accuracy, or general map
cartography acceptance.

**Device delivery follow-up:** The first post-reload device view revealed a
Dev Launcher `Unable to load script` screen, so earlier process-only evidence
was insufficient. The local Metro status endpoint and ADB reverse mapping were
re-established; cold-launch then visibly rendered Travel Life's Welcome screen
without clearing device data. The device policy rejects automated touch input,
so opening the existing private Atlas and completing the re-save was an
owner-operated acceptance check; the owner subsequently confirmed it works.

## Atlas readable cartography implementation (2026-10-18)

**Owner acceptance supersession:** The owner rejected the border appearance.
The earlier implementation is not visually accepted. Renewed reference review
and official Google gesture/style/camera research are recorded in
`_bmad-output/specs/spec-atlas-cartographic-exploration/visual-recovery-plan.md`
and `google-maps-experience-research.md`. The new plan preserves CAP-1..5 and
adds AC-25..27, replaces heavy global casing, requires shared topology and
scale-specific geometry, and makes native visual evidence a delivery gate.
Source reinspection also disproves the previous projection review: adding a
second 1.6 factor introduced base/marker versus tile/border misalignment. P0
must correct and independently validate it before visual tuning. This turn is
research/planning only; no new application fix or live Google-app test is claimed.

The native offline Atlas now separates cartography from the raster relief:
Natural Earth Admin0 country paths render as a projection-aligned SVG overlay,
with screen-stable gold/cyan boundary casing; public country/locality labels
use deterministic zoom bands, collision avoidance and halos; and co-located
real journey anchors become a visible count cluster that opens the existing
chooser. The relief and deep-zoom tile pyramid no longer bake labels or country
borders, so the overlays remain sharp as camera scale changes. No provider,
network request, road/POI/routing layer, precise location or reconstruction
contract was added.

Vietnam's current provincial layer is explicitly unavailable: its existing
63-region data cannot be presented as the current 34-unit administrative map.
The map instead shows country/locality context and tells the owner that
provincial boundaries are being verified. A current layer remains blocked on
pinned redistributable provenance and topology checks.

Public boundary/relief/tile generators and verifier passed. Focused map tests
(10) and the complete mobile check (33 suites / 293 tests), TypeScript, lint,
root `npm run check`, and whitespace validation passed. A fresh Android dev
build compiled `react-native-svg`, installed the debug APK, and opened on the
connected `2211133G` device. Expo Doctor remains 20/21 due to nine existing
Expo patch-version recommendations; `npm install` also reported 67 existing
dependency audit advisories, deliberately not force-remediated in this visual
feature. Device visual fidelity, real finger gestures, large text, iOS, and
the verified Vietnam Admin1 data gate remain open acceptance checks.

## M4.2 manual journey rerun (2026-10-19)

The private SQLite record now has an additive v33 `manual_journey` store for a
separate owner-entered journey assertion. It stores a one-decimal coarse anchor
and exact or ordered approximate date claim, is deleted with local history, is
read back before reporting success, and is unioned into the redacted Atlas and
detail projection without evidence, visit support, media, inferred totals, or
recovery metrics. The Atlas offers the entry flow from ready, sparse, and
failed states, preserves its context, labels owner-entered records separately,
excludes them from Home-base and correction Edit, and requires overlap review
again inside the write transaction. The full mobile suite passes 37 suites / 313
tests, TypeScript and lint pass, and root `npm run check` passes. Expo Doctor
remains 20/21 because of the existing nine Expo SDK patch-version
recommendations. Android/iOS manual-flow acceptance remains unrun.

## Performance and responsiveness architecture review (2026-10-19)

An architecture review of post-build startup, reconstruction, catch-up, and
owner-save paths finds credible responsiveness risk but no measured device
latency yet. One serialized SQLite transaction reads all evidence, runs
synchronous JavaScript derivation, and persists a complete derived graph through
many awaited writes. This correctly preserves the last committed private Atlas
and prevents overlapping transactions, but it can make a rebuild feel frozen.
The current UI has only a generic running state; in particular, a visible
`Catch up locally` action can be tapped during a running operation even though
the controller intentionally returns without acknowledgement.

The approved architecture direction is a dedicated local-operation
responsiveness story: phase-aware truthful busy state, one-frame acknowledgement,
duplicate-action feedback/coalescing, correction save phases, and local-safe
aggregate timing records. It must retain atomic publication, durable correction
read-back, the stale-result lifecycle guard, and last-committed Atlas/media
browsing. No private-library/device timing, frame-rate, battery, or reconstruction
accuracy was measured. The full rationale and acceptance checks are in
`_bmad-output/planning-artifacts/reviews/2026-10-19-performance-and-responsiveness-architecture-review.md`.

## Private-record manual-entry recovery (2026-10-19)

Atlas now checks private-record availability before opening the manual-journey
form. A deleted record offers an explicit local-storage creation path; a
disconnected record offers reconnect. Both retain the Atlas navigation context,
show in-place progress, disable duplicate lifecycle actions, and show only a
safe retry message on failure. Creating a record is explicitly described as
local storage only: it does not scan, import, or alter photos. The existing
provider and repository save boundary remains the final lifecycle-race guard.

The native repository already cleared a rejected open promise; a regression now
proves a later successful open is not poisoned by the first failed attempt.
Focused host verification passed 7 suites / 80 tests, including lifecycle
pending/failure/retry and the disconnected Atlas preflight. Full mobile
verification passed 37 suites / 320 tests, TypeScript, and lint; Expo Doctor
remains 20/21 due to the existing nine Expo SDK patch-version recommendations.
Root `npm run check` also passed. Android/iOS device confirmation of the
create/reconnect-to-manual-entry flow, including visual pending/error feedback,
remains required.
