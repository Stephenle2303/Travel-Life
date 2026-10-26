# Acceptance, measurements and release evidence

Every case links to an implementation slice. Use synthetic inputs in committed tests; private real media stays on owner devices. Keep rejected/error cases explicit rather than conflating unavailable, timeout, conflict, privacy-invalid and renderer failure.

## Deterministic acceptance matrix

| ID | Scenario and required result | Slices |
| --- | --- | --- |
| AC-01 | Exclude A → Done → edit B → Done → Update: A absent, B exact manual selection/order, one coherent render snapshot | S2,S3,S6,S7 |
| AC-02 | Include excluded A again restores retained choices; excluded trip is browseable/inspectable but checks inactive until included | S2,S6 |
| AC-03 | Zero chosen media retains populated album and valid trip card; all excluded disables Update with Choose a trip | S2,S6 |
| AC-04 | Pending autosave + Update accepts exactly once; repeated taps join; all pre-acceptance selected tasks settle into one pinned snapshot | S2,S3 |
| AC-05 | Hold first stage and send 100 edits: one active/one latest pending, latest intent preserved, intermediate waiters settle, bounded retained memory | S2 |
| AC-06 | Late acknowledgement of V1 while V2 pending cannot show fully saved, clear V2 or overwrite newer manual/order flags | S2 |
| AC-07 | Never-settling native writer yields waiting/recovery at thresholds, working intent and Back remain; Check again never writes again | S1,S3 |
| AC-08 | Pre-start queued cancellation vs running timeout vs definite rollback have different outcomes; no forced gate release/double-BEGIN | S1,S3 |
| AC-09 | Same operation ID/digest returns one receipt without new revision; same ID/different payload rejected; missing receipt while active remains unknown | S1 |
| AC-10 | COMMIT acknowledgement failure and later receipt/readback reconcile once; newer competing commit fails current-version check before render | S1,S3 |
| AC-11 | Route unmount with debounce, background/resume and restart retain session/last acknowledged draft; unacknowledged RAM is never falsely promised durable | S2,S7 |
| AC-12 | Restore during 250ms timer, selected resolve and running write fences late work; discarded branch cannot reappear | S2,S3 |
| AC-13 | Header Back, hardware Back and swipe/gesture close the same topmost subflow and retain/cancel the same intent without duplicate callback | S3,S6 |
| AC-14 | Keep my choices rebases explicitly at same scope; privacy/generation changes require refresh/review; automatic current-revision substitution cannot hide conflict | S1,S3,S6 |
| AC-15 | First visible tile appears before held final asset in page; six-lane global cap and 48-item metadata bound hold | S4 |
| AC-16 | A loads → open B → late A completes: B stays correct, A scroll/filter/selection preserved; page/tap/bulk requests dedupe | S4 |
| AC-17 | Unknown/undated asset beyond page one remains candidate; selected view resolves chosen IDs outside loaded All pages; timeout is retryable | S4 |
| AC-18 | Thumbnail/poster cache respects byte budgets/eviction/visible pins; no per-tile player, autoplay or selection loss on eviction | S4 |
| AC-19 | Audio chosen while SQL held: basename/validated local-ready state arrives independently; Done applies/returns without SQL wait | S5 |
| AC-20 | Settings Back cancels track/order not Done; previous applied music and trip edits remain; late copied candidate cannot replace newer/default choice | S5,S6 |
| AC-21 | 5,000,000-byte valid audio accepted; bigger/zero/unknown-size/inaccessible/undecodable candidates rejected before acceptance, prior track intact | S1,S5 |
| AC-22 | Same-name different-content audio invalidates old identity; missing retained file asks reselect/default; cleanup never deletes active references | S5 |
| AC-23 | Schema36/current/latest migration preserves draft, custom track, order, exclusions and cache; runtime reload adopts/reconciles owner without blind competing write | S1,S5 |
| AC-24 | Readback mismatch in any group/media/order/auto flag/music/scope prevents renderer call; capture cannot mix earlier media with later exclusion | S3 |
| AC-25 | Render failure after commit retains exact C; Retry render does not commit again; cached chapters unchanged are reused, music-only update preserves picture quality | S3,S5 |
| AC-26 | Previous/partial/final versions labelled distinctly; only verified current final is shareable; scope invalidation hides prior output; mute/fullscreen do not render | S3,S6 |
| AC-27 | Real final MP4 has selected audible soundtrack, one AAC stream, no original clip audio; selected export matches previewed composition | S5,S7 |
| AC-28 | Large synthetic albums retain full membership/manual keep/exclude and stable ordering with incremental thumbnails; no hidden selection cap or full-library decode | S4,S7 |
| AC-29 | 320/360/390/430px + large text + screen reader: actions reachable, recognizable tiles and distinct Inspect; correct intervals/duration, one scroll owner | S6,S7 |
| AC-30 | Diagnostics serialize only closed fixed events; profiling contains no private payload; baseline/candidate evidence and unresolved incidents recorded | S0,S7 |

Native transaction tests additionally interleave import, maintenance, reconstruction, privacy and Replay; assert three-overtake fairness and no external/media await inside writer closures. SQL integration uses real SQLite where the repository harness supports it. Deferred native stubs demonstrate queue behavior but cannot prove OS lock cancellation or decoder performance.

## Performance matrix

Targets are acceptance goals, not current measurements. Use release-like builds; separate Android/iOS, cold/warm, local/provider-backed, no-contention/background-contention and small/large albums. Minimum 20 repeated runs per platform/scenario; disclose samples and empirical p95 limitations instead of presenting a population guarantee.

| Metric | Initial target | Start / end boundary |
| --- | --- | --- |
| Selection/include/Done/Back acknowledgement | p95 ≤150 ms | User action → visible selected/navigation state |
| First recognizable local gallery tile warm | p95 ≤500 ms | Gallery open → usable recognizable tile |
| First recognizable local gallery tile cold | p95 ≤1.5 s | Same, cold app/cache category documented |
| Idle draft durable acknowledgement | p95 ≤1 s | Edit accepted → matching receipt/ack, no contention |
| Save waiting/recovery | 2 s waiting; 8 s recovery state | Request accepted → threshold render; no claim of cancellation |
| Audio filename acknowledgement | p95 ≤150 ms after picker result | Picker callback → displayed selected basename |
| Audio ready | Baseline and improve measured dominant stage | Picker return → bounded copy + positive decode validation; report provider time separately |
| Update commit/first frame/final artifact | Baseline each stage; no regression at equivalent composition | Update accepted → receipt/readback / first chapter / verified final |
| Warm unchanged Replay reopen | Zero unnecessary re-encode | Verified current artifact reused; access validation still required |
| Changed trip/music-only update | Re-encode only changed visual chapters | Compare chapter input identities and actual encoder invocations |

Synthetic device fixture sets: small 3 trips/30 attachments; large 50 trips/5,000 candidate attachments with mixed images/videos; single large trip with 1,000 attachments; delayed/unavailable sources; unknown dates; same-name custom tracks and exact size boundaries. These are test sizes, never product limits. Real owner libraries may exceed them; oversize work gets truthful progress/narrowing choices, not silent caps.

Record per run: build/device/OS, fixture category, cold/warm, phase durations, queue/transaction wait category, first visible media, selected/included counts, frame stalls/memory where measurable and final correctness. Do not store private labels/media IDs/URIs in the benchmark. Compare baseline/candidate with identical composition inputs; inspect orientation, crop, text/diacritics, color, timing, motion, selected intervals and audible music. Metadata-only 720p/24fps checks are insufficient visual equivalence evidence.

## Release gates and limits

G1: S1 ownership/receipt/migration tests pass before provider waits are removed. G2: S2/S3 complete snapshot, Restore, late-callback and unknown-outcome tests pass before enabling Update during autosave. G3: S4/S5 memory/audio/identity checks pass before lean loading labels imply readiness. G4: S6 UI accessibility/viewport checks pass before unassisted owner task. G5: Android and iOS owner-operated correctness/performance/audio evidence closes the experience incident.

No missing native device/owner/build permission can be labelled pass. Host-passed slices may be implementation-complete with native acceptance explicitly pending; overall delivery remains incomplete. No automated reinstall, app storage clear, Metro replacement, private-media upload or sharing is needed to make source checks pass. Follow existing build authorization when device validation is separately delegated.

Rollback: preserve additive schema and legacy fields. Drain/reconcile active mutations before switching coordinator paths; retain final verified artifact and compatible prior draft. If an older app cannot honor ownership metadata, do not activate old write logic over an owned session. Fail closed on privacy/version mismatch rather than offering an older file as newly updated output.

## Evidence at spec creation

Prior review reran existing Replay screen tests: 49/49 passed with 15-second per-test budget after one initial five-second timeout; root check passed. These are historical source/harness observations, not this plan's future implementation results or evidence of native smoothness. Current planning validation checks document links/IDs/coverage, not new product behavior. Native lock attribution and all performance measurements remain open.
