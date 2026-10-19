# Delivery sequence and gates

Planning only, 2026-10-18. One user-facing goal: reproduce the supplied map visual and deliver it to the real Atlas. Work packages below are ordered engineering slices, not claims that implementation has started. No `stories.yaml` is authored in this run; story checkpoint choices are a later interactive breakdown.

## G0 — Freeze the reference, scope and current routes

Read this contract and adopted companions; retain unrelated worktree changes. Verify the local image dimensions/hash and establish ignored reference storage. Capture the current prototype `/reveal` and mobile `/history` with synthetic fixtures. Label existing green/blue fictional geography and grid fallback as baseline mismatches.

Create a reference comparison manifest with map bounds, at least eight visible landmark anchors, explicit masks for deferred UI/route/point overlays, source dimensions and six visual categories. Keep source context available so masks cannot hide poor geography. Inspect whether the reference's named projection fits its visible silhouette.

Inventory existing gestures, zoom extent, year/selection and media/correction return. Confirm route reachability, current Metro/shared-module configuration, current ADB state, iOS build access and mobile-web SQLite issue. Known failures are evidence to recheck, not permanent assumptions.

**Exit:** reproducible baseline, source manifest, test-fixture plan and route/platform evidence register. A broken device tool does not block document/source work but remains an explicit gate for that platform.

## G1 — Prove cartography and renderer feasibility

Build a map-only technical proof after implementation is authorized. Evaluate the recommended licensed source + offline projected raster/overlay approach in `cartography-architecture.md`.

1. Pin geographic data and tool versions/licenses/checksums. Verify outlines/boundaries and shaded raster share geographic registration.
2. Fit Winkel Tripel to the reference; report landmark residuals before detailed artwork. If the stylized reference cannot satisfy AC-V01, show the comparison and propose the smallest calibration change. Do not independently warp continents.
3. Reproject/crop raster textures through the same manifest; prove borders/coastlines and independently projected test points align at 1× and maximum zoom.
4. Prove native Android/iOS and browser decoding, gestures, clipping, DPR behavior and release bundling. Verify both Metro projects can consume the shared module/assets.
5. Measure asset size, decoded residency including buffers, warm readiness and a gesture profile with 1,000 synthetic anchors. Try 1×–4× first; record existing-zoom compatibility and required resolution.
6. Write the renderer decision with measured evidence, chosen resolution ladder, runtime dependencies and asset fallback behavior. Update this spec's log before deriving any changed budgets/assumptions.

**Exit:** a functioning geographic proof and source/renderer decision. If quality or platform budgets fail, revise the candidate and repeat G1; do not replace the target with generic map tiles or abstract shapes. No app-wide integration before this gate.

## G2 — Produce the visual master and obtain acceptance

Apply the reference's blue land grade, flat relief texture, coastal highlights, dark ocean/bathymetric shading, fine muted gold borders, sparse labels, subtle current contours and vignette. Keep personal markers hidden for the base comparison. Do not generate the deferred chrome. Retain the reference framing/negative space without adding the search/card/docks.

Render 1024 × 639 comparison plus responsive views from the actual component. Present raw captures, side-by-side and overlay; list each visible mismatch against the six categories. Iterate until every category is accepted by the owner; record exact asset/recipe/projection checksums and approved views. G2 approval locks the visual master, not an unreviewed substitute on another platform.

**Exit:** accepted visual master with AC-V01–V06 evidence. Owner acceptance happens here with a concrete working image; routine coding/tool choices do not require extra approval rituals.

## G3 — Integrate the same approved map into both surfaces

Integrate first with synthetic fixtures, then through the existing redacted production model. Replace prototype fictional geometry/formulas and the mobile abstract/development-style base with the approved cartography. Confirm parity of manifest/asset checksums in both apps. Reconcile 640-width and fixed-height constraints for an appropriate Atlas viewport without a global shell redesign.

Implement shared projection and viewport transforms; adapt old camera context safely. Preserve meaningful current gestures, grouping, selection, filters, preview/media/correction return and stale-record invalidation. Use the approved low-resolution base for local rendering fallback, with explicit recovery if both asset levels fail. No fake movement, personal glows baked into geography or fictional location assignment.

Do not add the deferred search/utility dock/card/route features. Retain existing functional equivalents outside the visual comparison; the new polished persistent card is not a dependency.

**Exit:** browser prototype and native production-route implementations show the accepted map; AC-G and AC-S cases pass; no development-only/provider gate determines appearance.

## G4 — Verify the delivered product and hand off evidence

Run meaningful projection/registration, state/privacy and context-restoration tests; inspect network activity on cold offline/release launch. Validate the shared asset checksum/repeatability pipeline. Run relevant app tests/typecheck/lint, root `npm run check`, and `git diff --check`. Run both app `check` commands and report Expo Doctor separately when pre-existing environment/package checks fail.

Capture actual browser prototype, Android and iOS routes at the specified viewports/DPR, including sparse/no-evidence and offline release states. Test large text, reduced motion and Timeline access. Measure resource/gesture budgets. Use synthetic capture evidence; keep owner media/location evidence private.

Refresh/install the actual target build without clearing private data, open Atlas, and demonstrate it is the accepted asset/version. Record who verified each platform and when. Mobile-web SQLite remediation is separate unless it prevents testing a selected browser deliverable; the prototype is the selected browser visual surface, not proof that mobile-web works.

**Exit:** every required AC has passed evidence, G2 owner visual acceptance is recorded and native delivery is observed on both platforms. If device/build access is unavailable, report that platform as blocked and keep delivery incomplete. Automated passes or an open browser tab alone cannot close the task.

## Risks and prevention

| Risk | Detection | Required response |
| --- | --- | --- |
| Reference is stylized/partly occluded | G1 control-point fit and mask review | Show measurable mismatch; obtain decision on material compromise before artwork/integration |
| Nice artwork but misplaced points | Independent geographic control fixtures | Fix shared projection/registration before personal markers |
| Bitmap looks good only at 1× | Maximum-zoom/DPR comparison and memory measurement | Adjust optimized resolution ladder within budget; re-run G1 if renderer changes |
| Browser/native drift | Asset/manifest parity plus actual screenshots | Fix packaging/adapter; never approve one screenshot for both |
| Hidden release/empty-state gate | Release/offline/sparse route cases | Make approved base independent of imported evidence/native tile module |
| Duplicate/overlapping points inaccessible | Dense coincident fixture | Group and expose every journey through safe choice/Timeline |
| Earlier visual claims repeated without evidence | G2 sign-off and per-platform AC register | Keep failed/pending status; attach actual comparison before calling complete |

## Completion artifact

Handoff includes the accepted master version, source/license manifest, generation instructions, comparison bundle, AC register, test/resource results, actual entry routes/builds and remaining blockers. No invented completion percentage, delivery date or physical-device success.
