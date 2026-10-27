# Implementation plan and delivery boundary

## Readiness

Canonical contract: SPEC.md and its companions; decisions and capability IDs live in .memlog.md. This folder is the sole M4.5 product contract. The implementation-artifacts adapter links here and holds execution evidence; it does not duplicate requirements. M4.5 dependencies remain M3.4 selected count consistency and M4.3 durable visibility/exclusion. Verify their current runtime/query contracts before selecting a source; old planned epic labels alone are not evidence of missing implementation.

Replay's unresolved database-busy/device acceptance remains open. Sharing may use common private storage/auth contracts but must not broaden or overlap that investigation without need. Preserve all unrelated dirty Replay/native files. No device launch, build, installation, commit, deployment or upload is part of spec preparation.

## Ordered delivery slices

Every slice S0–S7 applies diagnostics.md and the repository diagnostic gate. S0 records the map and collection plan; subsequent slices add the precise emitters and fault/redaction tests with the behavior they introduce. S7 requires AC-25–28 evidence as well as AC-01–24. Do not defer instrumentation until after an owner encounters a failure.

| Slice | Work and verification | Gate |
| --- | --- | --- |
| S0 | Inventory current source visibility/media/count/auth/delete-all boundaries, current schema and native encoders. Use search-first for existing serialization/sanitization/encoding support. Verify current Supabase docs and migration/runtime/tooling paths. | Record feasibility and replacement-safe migration plan; no real upload. |
| S1 | Build pure allowlisted v1 snapshot/selection/precision model and exact local preview; test privacy/membership changes, selected counts, Unicode and complete paging. | AC-01–06,14 payload cases; no network dependency. |
| S2 | Add owner/session-safe server share/version/manifest/operation/quota records, private storage and real authorization integration tests. | AC-09–15 ownership/storage cases, schema upgrade/rollback and anonymous-abuse controls. |
| S3 | Deliver locally sanitized image/video derivatives, operation persistence, quota reservation, staged upload, activation receipt and reconciliation/cancel. | AC-07,08,14,15,24; measured platform codec/memory/quality bounds. |
| S4 | Connect approved mobile selection/preview/confirmation and My shared links; explicit replacement/expiry/revoke with old-version read denial. | AC-16–18 and owner UI; fixed lifecycle diagnostics. |
| S5 | Integrate delete-all/offline removal, protected credential retention, cleanup lease/jobs and bounded retention/quotas. | AC-19,20 with restart, session loss and cleanup faults. |
| S6 | Deliver token-checked snapshot/media/range API and v1 M4.6 integration fixtures, verified log/cache controls and viewer readiness gate. | AC-10–13,21,23 contract cases; no public dead links. |
| S7 | Run all affected host checks and both-platform owner walkthrough, then synthetic deployment smoke when authorized. Attach evidence and remaining M4.6 release dependency. | AC-01–24 traced to actual results; no inferred device acceptance. |

Use bmad-build with this contract for implementation. Optional bmad-party-mode or bmad-advanced-elicitation can pressure-test assumptions; neither is a prerequisite. A separate story-breakdown checkpoint discussion is optional; no stories.yaml is silently generated.

## Enablement decisions to verify during implementation

- Confirm server project/region, publishable config, anonymous-session protections, secure mobile credential store and authenticated owner privilege model. Do not enable AI or create sessions just to inspect configuration.
- Benchmark proposed derivative, upload and quota bounds; record refinements as assumptions in the memlog and rederive the contract. If a refinement materially changes owner selection/detail/sharing intent, obtain that product decision first.
- Verify decoder/sanitizer support and video/audio preview fidelity on iOS and Android. Selected video is not silently replaced by an image or muted copy.
- Specify finite operational tombstone/backup retention and privacy disclosure; configure cleanup retry/monitoring and verify no active object can be deleted.
- Confirm hosting can avoid bearer token/request-body leaks and stale media caching. If that cannot be demonstrated, block external enablement and retain local preview.
- M4.6 deployment URL and compatible v1 viewer are required before enabling public copy/share. Full browser implementation remains the next P0 story; do not add it invisibly to M4.5.

## Source preservation map

| Accepted source | Preserved contract |
| --- | --- |
| M4.5-1 exact selection/confirmation, immutable snapshot, selected derivatives | CAP-1,2,6; experience; atomic publication; AC-01–08,14 |
| M4.5-2 owner auth, unlisted URL/expiry/revoke, quotas/sanitization | CAP-2–4; access/persistence/defaults; AC-09–15,18,21 |
| M4.5-3 stable background snapshot, deliberate republish, remote removal | CAP-4–6; management/delete-all; AC-16–20,24 |
| Decision 0005 coarse location/date, anonymous owner, ≥128-bit token, 30-day default, no public bucket, no saved-copy revocation | SPEC constraints; experience; publication-contract |
| Decision 0009 selected lifetime highlight and separate Replay/export | SPEC Why/non-goals; entry and selection; M4.6 handoff |
| Decisions 0010/0011 official Selected Highlight screen and Living Atlas | Adopted design-system companion; experience; AC-22 |
| M3.4 counts and M4.3 visibility/exclusion | Readiness; public schema; AC-03,06,16 |
| M4.6 recipient viewer/browser fallback and safe social preview | Explicit handoff/gate; AC-21,23; full viewer deferred |

Wrapper-only content: retired MVP/video-duration descriptions and synthetic prototype demo copy are historical context, not new requirements. Current Replay curation/audio amendments remain owned by M4.7; this spec changes none of them.
