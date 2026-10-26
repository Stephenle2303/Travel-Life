# Brownfield, source preservation and precedence

Source of intent: owner report and accepted 2026-10-26 review solution, followed by request for a detailed spec/implementation plan. Canonical parent checkout is `C:\Users\vothi\Desktop\Travel Life`; retired worktrees are excluded. This additive scoped spec does not renumber earlier CAP IDs; capability references here belong to `SPEC-replay-edit-save-and-responsiveness`.

## Verified current source and open runtime evidence

| Area | Current implementation / implication | Planned replacement |
| --- | --- | --- |
| replay-screen.tsx | workingSaveQueue, scheduledWorkingSave, refs and task sets scattered across handlers; Update requires idle | Session-owned complete composition, coalescer and request barrier |
| photo-access/provider.tsx | stage/commit wait import + maintenance, reload native full manifest; stage replaces screen expected revision | Owned writer safe boundary, small scope/CAS checks and explicit session recovery |
| reconstruction/repository.ts | loadReplayManifestInput rebuilds Journey projection and per-trip media; positional opaque mapping; stage/save use native revisions | Session epoch mappings, bounded native stage checks, exact commit readback and receipts |
| database/native-transaction.ts | module FIFO and intercepted explicit BEGIN/COMMIT, serialized new connections | Callback ownership/fairness while preserving global serialization |
| import-record/repository.ts | schema version36, replay_draft JSON/revisions, migration guards | Additive next-unused migration/receipt metadata, all query gates updated |
| photo-access/native-adapter.ts | six preview lanes but page returns after all complete | Incremental completion and viewport priorities, scoped cache/dedupe |
| ReplayVideoPoster | creates player for a tile poster | Service-generated/cached poster, player only for inspection/playback |
| audio/settings | picker cache copy + private copy; file-ready label already separated from SQL; Done waits global queue | Validated sheet subdraft, independent file readiness and session apply |

Existing positives to retain: durable cache first playback before optional edit hydration, 48-item metadata bound, native six-lane cap, unknown candidate retention, complete final-edit snapshot/readback guard, progressive chapter reuse, selected soundtrack and mute/fullscreen controls. Do not reimplement these as if missing.

The earlier error-playbook records immediate stale-map/self-revision failures and a delayed DATABASE_BUSY; it does not identify the current SQLite lock holder. Planning must not call that incident resolved. First-cache-open test timeout also remains an unisolated harness/performance observation, not a proven product defect.

## Scoped contract precedence

This spec controls only the following refinements when older adopted docs disagree. All other adopted content remains in force. The owner's current accepted solution/request has precedence over earlier agent-selected implementation details.

| Earlier rule | Scoped refinement | Unchanged guarantee |
| --- | --- | --- |
| Trip Done/Back awaits acknowledged draft before return | Navigate immediately with service-owned intent/save | No false durable status; acknowledged choices survive restart |
| Update disabled for pending/failed writes or unresolved selected task | Accept one request during pending save, then settle selected intent and safe persistence internally; known failure needs explicit Retry; conflict/privacy remains gated | No render before exact durable readback |
| Main Edit Back retains working music | Retains settings already applied with Done; settings-sheet Back cancels only unapplied sheet subdraft | Committed playback never changes on Back |
| Finalization constraint broadly excludes filename from UI | Permit only selected audio basename locally to identify owner choice | No source paths/identifiers/raw native error in UI; no filename/private payload in diagnostics |
| Inclusion only in row overflow | Independent overview checkbox plus existing gallery overflow | Exclusion is presentation, retains selection and does not mutate trip facts |
| Full-manifest rehydration before every stage | Rehydrate lost mapping once, use session-versioned mapping and small write-time checks | CAS, lifecycle/privacy/generation integrity remain mandatory |

No broad predecessor restatement is intended. S6 updates predecessor interaction references through BMAD derivation when implementing; until then this table is the authoritative narrow override for this delivery.

## Preservation map

| Load-bearing source item | Contract destination |
| --- | --- |
| Review F1 unbounded queue / disabled Update | CAP-2/3/6; architecture coalescer/reconciliation; AC-04–AC-10 |
| Review F2 full-transition waits / full manifest | Owned transaction/migration sections; S0/S1; AC-07–AC-10/23 |
| Review F3 page barrier / global loading flag | Thumbnail request epochs/incremental service; S4; AC-15–AC-17 |
| Review F4 video poster/decode work | Thumbnail service/no per-tile player; AC-18/28 |
| Review F5 audio copy/save coupling | Audio lifecycle and sheet subdraft; S5; AC-19–AC-23/27 |
| Review F6 Back/restore timer races | Navigation table/recovery fence; AC-11–AC-14 |
| Review F7 scattered state/silent CAS refresh | Session identity, explicit rebase, pinned snapshot; AC-04/06/14/24 |
| Review F8 render scans/instruction copy | Selector indexing, lean screen composition; S2/S6; AC-28/29 |
| Approved trip-first overview/gallery, selected jump, local long-history navigation, independent Inspect | Experience screen composition; CAP-7; AC-02/13/17/29 |
| Chapter timing/used interval/duration feedback/Unicode | Experience Inspector/footer; immutable render contract; AC-25/27/29 |
| Full eligible album, unknown/undated, explicit keep/exclude, no sampling cap | CAP-4 constraints; AC-03/17/28 |
| Automatic/manual choice modes, trip Auto, global Reset retaining music, within-trip order | Composition/session and experience; AC-01/06/24/29 |
| Current Journey List/correction month order, same-month stable ties, unknown-last | Kernel constraints; composition/order readback; AC-24/25 and existing selection/order regressions |
| Default Happy Moments1.4, custom5MB bound, decode-validation, original audio excluded | Audio architecture; AC-19–AC-23/27 |
| One-action playback/cache, partial vs final, exactly one verified AAC stream, fullscreen mute | CAP-8; immutable render/output gates; AC-25–AC-27 |
| Exact deliberate empty-first share, revalidation and sheet-dismissal honesty | Experience navigation and existing adopted sharing contracts; AC-26/27 |
| Private cached data, no consent inference, lifecycle/access invalidation | CAP-9; cache/audio/persistence constraints; AC-23/26/30 |
| Review benchmarks are targets not results, native acceptance required | CAP-10; full verification/rollout companion |

Source wrapper text such as party banter, optional keepsake and tool-call chronology is not product contract. Its omission changes no implementation decision. Operational incident evidence is preserved in the review/error-playbook, not duplicated into product UI.

## Engineering defaults and unresolved work

| Item | Chosen starting point | Review/stop condition |
| --- | --- | --- |
| Debounce and queue | 250ms trailing, 1s max age; one active/one latest | Test pressure/long writer; never weaken intent guarantee |
| Priority fairness | ≤3 ordinary foreground overtakes | Preserve background/publication correctness and privacy priority |
| Wait/recovery thresholds | 2s/8s | UX timers, never native cancellation deadlines |
| Metadata/viewport/concurrency | 48 metadata,12 initial tiles,1 viewport prefetch,6 global lanes | Measure CPU/native memory; no album/selection cap |
| Cache | 24MiB decoded memory,64MiB private disk | Bounded pins/in-flight work; tune by device evidence |
| Receipt retention | 32 settled unreferenced per private record | Never prune unresolved/session/render-owned receipt |
| Schema | Current36; allocate actual next unused at build | Re-read live schema to avoid collision |
| Native thumbnail API | Probe installed library first | Document platform support/fallback before dependency change |
| Lock attribution | Unknown | S0 trace; no device fix claim until owner evidence |
| Product questions | None blocking | Existing direct user intent supports these reversible defaults |

No development estimates are represented as commitments. Each slice has bounded scope and exit tests; native device availability determines final acceptance, not whether a planning file was written.
