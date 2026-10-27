# M4.5 diagnostic contract

Owner direction, 2026-10-26: failure logs must identify the actionable operation, exact failing boundary and safe category, so investigation follows evidence directly. This companion applies the repository-wide diagnostic gate to CAP-1–6. It does not resolve the separate behavioral review findings or authorize feature implementation.

## Closed map to implement

Names below are proposed closed diagnostic vocabulary; register them in runtime types/loggers during implementation, not ad hoc string output. Before coding each slice, replace the logical source lookup with actual file/function/guard paths in the existing delivery record. Mobile uses app-diagnostics.ts; server/browser use equivalent allowlisted runtime boundaries. Existing reasons such as ACCESS, DATABASE_BUSY, SCHEMA, CONSTRAINT, LIFECYCLE and UNKNOWN may be reused when accurate. Never label the entire sharing flow merely SAVE_FAILED.

| Operation | Fixed failure/wait stage | Discriminating reason categories | Logical source lookup / next check |
| --- | --- | --- | --- |
| SHARE_PREVIEW | SHARE_ELIGIBILITY | access denied, scope stale, membership invalid | Current-policy/selection validator; check which fixed guard failed without logging its inputs |
| SHARE_PREVIEW | SHARE_SERIALIZE | unsupported schema, invalid public field, dangling reference, payload bound | Public schema serializer/validator; inspect matching synthetic fixture |
| SHARE_DERIVATIVE | SHARE_COPY / SHARE_DECODE / SHARE_ENCODE / SHARE_VERIFY | unavailable source, storage limit, unsupported codec, decode rejected, checksum/metadata mismatch | Sanitizer/encoder/verifier at the reported phase; do not classify copy failure as encoder failure |
| SHARE_PUBLISH | SHARE_AUTH | session unavailable, owner denied, session expired | Protected session/owner authorizer; no JWT/user ID in logs |
| SHARE_PUBLISH | SHARE_QUOTA | quota exceeded, reservation conflict | Atomic quota reservation guard; no selection/body serialized |
| SHARE_PUBLISH | SHARE_UPLOAD | connection unavailable, upload rejected, staging expired | Staged upload adapter and lease validator |
| SHARE_PUBLISH | SHARE_ACTIVATE | manifest incomplete, version conflict, privacy fence invalid, deletion fence active | Exact activation/CAS/fence guard and transaction boundary |
| SHARE_PUBLISH | SHARE_ACK / SHARE_RECONCILE | acknowledgement unknown, receipt found, receipt conflict, request expired | Receipt reconciliation; unknown response does not mean activation failed |
| SHARE_READ | SHARE_TOKEN / SHARE_EXPIRY / SHARE_MEDIA_READ | unavailable capability, access expired, object not active, range invalid | Token/status gate, active manifest/media proxy; no token or object key in log |
| SHARE_MANAGE | SHARE_REPLACE / SHARE_EXPIRY_UPDATE / SHARE_REVOKE | version conflict, terminal link, owner denied, acknowledgement unknown | Owner management transition/receipt; map replacement separately from revoke |
| SHARE_DELETE_ALL | SHARE_DELETE_FENCE / SHARE_REMOVAL_QUEUE / SHARE_REMOVAL_ACK | activation fenced, removal pending, credentials unavailable, acknowledgement unknown | Owner deletion fence, durable queue and reconciler; no false removed outcome |
| SHARE_CLEANUP | SHARE_LEASE / SHARE_OBJECT_DELETE / SHARE_QUOTA_RELEASE | lease expired, active object protected, removal pending, storage removal failed | Cleanup ownership/fencing/object removal and quota settlement |

These category descriptions must become fixed code tokens before runtime use. Typed errors retain category and phase through caller layers. Stages distinguish stalls in copy/upload/native write/server activation/acknowledgement. Expected cancellation and stale work get fixed lifecycle outcomes. UNKNOWN always retains the known operation/stage and remains a diagnosis gap; it does not justify a guessed root cause.

One locally generated non-identifying correlation follows a single action through UI/controller/native/service boundaries. Validate server input correlation and reject/replace malformed values; do not reuse the private publish operation/idempotency key, owner identity or public capability. Internal diagnostic distinctions remain server-local: recipient errors retain the safe indistinguishable unavailable response required by the public contract.

## Fault evidence and collection

Before owner validation, exercise at least one fault per added stage with synthetic inputs and assert operation/stage/reason/outcome/correlation. Include two distinct causes that would previously share a generic error, expected cancel/stale, lost response with successful commit and pending delete-all acknowledgement. Test secret/content sentinels in nested native/provider errors and reject raw serialization. Check no duplicate terminal failure is emitted by wrapper catches.

Record Android's actual package/process and build freshness, the exact structured-event filter and correlation lookup; record iOS subsystem/process/filter equivalent. For functions/viewer, record deployment/version and approved structured logger filter without bodies, headers, URL token or owner content. Run platform-specific collection checks at implementation; do not invent currently deployed logger commands. If logs are absent, repair collection or add the smallest discriminating event before requesting another private reproduction or changing unrelated code.

Tests and review must verify this map against actual emitters, not only check that this document exists. Root foundation/policy-wiring checks cannot prove sharing diagnostics are implemented. Acceptance remains open until the implementation evidence is attached.
