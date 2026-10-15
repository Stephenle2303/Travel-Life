# Current implementation and delivery boundary

Inspection date: 2026-10-15. These are repository observations, not device verification. Preserve unrelated uncommitted changes; the owner already authorized work on this working tree earlier in this chat. This turn produces requirements only.

| Location | Observed behavior | Required change |
| --- | --- | --- |
| `apps/mobile/src/components/atlas-reveal.tsx` | Several full panels precede the map; map is 270 high; all points citrus; source handler picks first feature; map key contains anchor identities; preview card renders below map; list uses large ActionButtons and nested scroll. | Recompose header/summary/info, style the map and selected point, overlay card, implement empty-tap/overlap behavior and camera continuity; replace list with quiet scalable rows and coordinated scrolling. |
| `apps/mobile/src/components/mobile-screens.tsx` and `ui.tsx` | Generic centered scrolling Screen and 38-unit Title; Atlas passes an inline detail-loader wrapper. | Scope Atlas layout/typography without restyling every screen; stabilize selection-loader dependencies and choose a single scroll owner compatible with virtualization. |
| `apps/mobile/src/reveal/types.ts` and `projection.ts` | List uses “Available journey N”; status has only Inferred/Needs review; no effective owner title in list; observed years and coarse anchors already exist. | Add minimal owner-readable list summaries and correct committed statuses without invoking full detail for every row or weakening map/telemetry redaction. |
| `apps/mobile/src/reconstruction/repository.ts` | Detail reads at most four memories and resolves selected opaque identity locally; correction data carries owner claims/status. | Supply safe bounded row summaries; establish a separate full associated-media paging query with eligibility/dedup/stable order and committed-run binding. |
| `apps/mobile/src/photo-access/provider.tsx` and `native-adapter.ts` | Existing lifecycle/detail guard and local media resolver; preview set remains four; media kind recently added. | Reuse guards, recheck after native resolution, invalidate already rendered content on lifecycle/projection changes; keep thumbnails/source IDs within local boundaries. |
| `apps/mobile/src/components/journey-media-viewer.tsx` | Inline scroll of four detail memories with images/video players; no full paging or gallery/item Back hierarchy. | Complete adopted bounded gallery/item contract; explicit Play/mute/pause/unavailable states. |
| `apps/mobile/src/atlas/preview-context.ts` and `src/app/journey/[id]/correct.tsx` | Ephemeral view/year/selected ID plus map-origin flag; no camera/list position or robust successor restoration. | Preserve complete valid context and refresh/resolve committed identities before reopening a card. |
| `apps/mobile/src/components/__tests__/` | Narrow Atlas/detail tests previously passed; mocked map/player and current tests do not prove full adopted acceptance. | Add behavior/visual/native evidence for this contract and inherited A1–A17; retain privacy and correction regressions. |

## Style implementation investigation

Keep MapLibre and inspect the installed version's documented style/source APIs before implementing. Identify whether the currently configured source is vector or raster, available layer/source names, required attribution and supported zoom range. Create a local style contract and synthetic screenshot comparison where possible. No new remote provider is selected in this spec. If source capabilities prevent the required restyling, record the concrete gap before claiming visual completion; do not fabricate a style that references absent layers.

## Suggested delivery order

1. Establish safe list summaries and UI context state contracts; keep the existing preview spec as the sole media/correction behavior authority.
2. Recompose Atlas hierarchy and list; introduce a supported quiet map style and selected-state styling with preserved camera.
3. Complete the adopted preview/gallery/correction gaps in the same integrated exploration flow.
4. Run required automation and visual/native checks; update one implementation delivery record with findings and remaining device/provider gates.

There is no database migration or runtime package change authorized by this planning turn. Future implementation may choose normal compatible local mechanisms within the approved feature scope. Production provider credentials, purchases, deployment and private evidence uploads require separate authorization.
