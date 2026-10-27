# Mandatory diagnostic delivery gate

Applies to every runtime implementation and bug fix in this repository, whether delivered through BMAD, another skill, a delegated agent or direct edits. Documentation-only work records applicability rather than inventing runtime events. This policy extends AGENTS.md's logging/privacy contract; it does not authorize raw exception logging or new telemetry providers.

## Before implementation

Put a diagnostic map in the existing story/spec delivery record. For every fallible boundary, specify fixed operation, fixed non-null failure stage, closed reason categories, durable outcome/retry policy, source module/function, and safe next diagnostic action. Reuse known codes when precise enough; add a narrow closed code/stage when existing categories conflate different failures. A generic SAVE_FAILED or UNKNOWN across an entire feature is insufficient when the actual boundary/category is known. Map codes to source in documentation, never emit private source record IDs or native stacks as a shortcut.

The map covers source/access/eligibility checks, storage/schema/map/CAS/transaction guards, local media copy/decode/encode, network/auth/upload/activation, acknowledgement/reconciliation and cleanup where applicable. Include expected cancellation, stale work, already-running, permission loss and unavailable optional APIs as explicit lifecycle outcomes. Do not log each media item or every successful loop iteration.

Define the collection recipe before owner validation: actual package/process/service, current build freshness check, precise log filter, correlation lookup and safe retention/export boundary. Missing/stale logs or disconnected ADB are collection failures, not evidence of a product cause. Use synthetic failures to demonstrate the map before asking the owner to reproduce private-data issues.

## Runtime contract

- Mobile uses `apps/mobile/src/diagnostics/app-diagnostics.ts` as its sole production console boundary. Keep its closed fields: operation, reasonCode, stage, retryable, durableOutcome and locally generated correlationId. Failure stage identifies the specific boundary; stage may remain null only where the operation itself is unambiguous or an existing lifecycle event requires it. New fallible multi-step paths require a non-null stage. Do not add ad hoc fields without an explicit privacy/contract review.
- Create one correlation per owner action/run and pass it through relevant controller/provider/repository/native boundaries. Emit classification at the boundary with the best safe information; preserve it in a typed closed error across callers instead of replacing it with a generic fallback. Avoid duplicate terminal emissions. A separate recovery action gets its own correlation; do not reuse an entity or bearer token as a correlation ID.
- Across client/server, correlation is a bounded non-identifying diagnostic value, not authorization or a persistent owner identifier. Validate untrusted incoming values and use a server-generated value if invalid. Sensitive mutation/idempotency identifiers stay separate. The backend/browser implement an equivalent closed allowlisted logger appropriate to their runtime; no unrestricted console/error serialization and no provider-wide telemetry enablement by default.
- Log start and a terminal lifecycle/failure outcome around async boundaries that can stall when necessary to locate the last completed boundary. A start without terminal acknowledgement means unresolved work, not a proven native hang. Log wait and acknowledgement/reconcile boundaries with fixed stages; do not assert that a JavaScript timeout canceled native work or rolled back a server commit.
- Keep logs content-free: no raw error message/stack, SQL, request/response body, source/media IDs, names/locations/coordinates, paths, credentials, URL capabilities, headers, correction payloads or owner content. Classify raw exceptions in memory only. Sanitize at the logging boundary and keep recovery UI separate. Generic UI copy is acceptable only when paired with a specific safe diagnostic.
- If cause is not known, emit UNKNOWN with the exact known operation/stage and truthful durable outcome. Never relabel every failure as conflict, unavailable renderer or database corruption. Improve classification after evidence; do not fabricate certainty.

## Incident workflow

1. Verify the actual current build, process and transport; collect only the relevant structured events through the approved local/read-only boundary. Keep private raw logs out of Git and shared artifacts.
2. Locate the action correlation and last start/terminal stage. Follow the map to its source function and known guard/classifier. Distinguish observed symptom, proven boundary, proven category and unproven root cause.
3. If no discriminating event exists, instrument that boundary within authorized scope and reproduce once with a synthetic fixture where possible. Do not make speculative storage/schema/render changes to find out whether they help.
4. Write a meaningful regression for the confirmed failure, apply the scoped correction, and collect matching verification evidence. Preserve unknown-outcome/idempotency semantics.
5. Update error-playbook with evidence, verified cause or explicit unknown, correction, test/result and prevention. Keep unresolved device/service evidence open.

## Required completion evidence

- Diagnostic map with source/guard lookup and a reproducible privacy-safe collection recipe in the same delivery record.
- Tests forcing representative failures at each newly introduced boundary and asserting the exact operation/stage/reason/outcome, including distinct failures that formerly shared a generic category. Include cancellation/stale lifecycle and unknown-outcome paths when relevant.
- Redaction tests inject synthetic secret/content sentinels and assert they never reach log/UI serialization. Verify one action correlation survives the exercised layers and errors are not double-counted.
- Existing lint/closed-event shape checks plus applicable platform/backend logger guards pass. A new browser/backend logger requires equivalent tests and direct-console enforcement before enablement.
- Device/backend observation is required to claim the reported physical/deployed incident fixed. Passing host mocks proves classification behavior, not the actual device cause. If collection is unavailable, report the concrete boundary and next action.

Reviewers must treat missing diagnostics or collection evidence as incomplete delivery, not optional follow-up. Automated policy-wiring checks confirm these rules are loaded; they do not prove every runtime path is instrumented. Per-feature fault tests and review supply that evidence.
