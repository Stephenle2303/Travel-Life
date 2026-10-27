# M4.5 — Publish and manage selected share snapshots

Date: 2026-10-26 (Asia/Bangkok). Status: implementation in progress; the formal delivery record is [spec-m4-5-selected-share-snapshot-delivery.md](spec-m4-5-selected-share-snapshot-delivery.md).

Canonical contract: [SPEC.md](../specs/spec-m4-5-selected-share-snapshots/SPEC.md) and its declared companions. This record is the execution adapter, not a competing specification. Story: M4.5, P0, dependencies M3.4/M4.3. M4.6 consumes its v1 recipient contract and owns the complete browser viewer.

Scope: exact owner selection/preview; explicit immutable publication; private sanitized derivatives; protected owner/session management; unlisted checked access; expiry, republish and revoke; durable offline/delete-all removal; reconciliation without duplicate publication. Six capabilities and 24 acceptance cases define the contract.

Owner diagnostic direction applied on 2026-10-26: diagnostics.md plus the adopted repository diagnostic policy are mandatory companions. AC-25–28 extend the original 24 cases (28 total) with exact failure-category/source mapping, cross-layer action correlation, redaction/logger enforcement and current-runtime collection/triage evidence. No sharing logger implementation is claimed yet. Behavioral review findings remain open independently.

Implementation begins with S0 source/auth/schema/native-derivative feasibility, then S1 pure selection/serialization tests. The reviewed race decisions are now frozen in the formal delivery record: delete-all creates a server fence before cleanup, verified derivatives are write-once, a client retains the raw capability before its first request while the server keeps only a digest, expiry is a mutable envelope outside immutable content, and cancellation after activation is not an implicit revoke. Existing Replay device/save acceptance stays open and unrelated dirty work must be preserved.

## Planning verification

- Coherence and preservation self-validation pass: six unique capabilities each have intent/success; all three upstream M4.5 acceptance groups and the M4.6 boundary map to explicit requirements. Engineering defaults and enablement investigations are labeled.
- Structural validation passes for all kernel sections, source/companion/adapter links, 24 ordered acceptance cases and eight implementation slices.
- Root `npm run check` passes: pinned framework integrity, 20 foundation tests and eval infrastructure smoke. Scoped `git diff --check` passes; Git reports only existing CRLF normalization warnings for the two updated shared documents.
- No application implementation, deployment, account/session, private upload or device acceptance is established by this preparation. Source-discovery/fetch corrections are recorded in the error playbook.

## Execution evidence

First implementation evidence: focused mobile share-operation/transport/diagnostic Jest suites pass (15 tests), with mobile TypeScript and lint passing. A private schema/RPC and JWT-protected Edge Function scaffold are present but Deno is unavailable on this host, so Edge Function execution, Storage/RLS integration, derivative processing, deployment and device evidence remain open.

## Owner-requested review

The [2026-10-26 review](review-m4-5-selected-share-snapshots-2026-10-26.md) found behavioral specification gaps despite the earlier structural checks. Its implementation-relevant resolutions are now frozen in the formal delivery record; the full protocol/derivative and backend/device evidence work remains in progress.
