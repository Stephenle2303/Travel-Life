# Adversarial architecture review

Reviewed 2026-10-28 after AD-10/AD-11 additions. Verdict: two remaining coordination gaps; resolve before the affected independent builds. This is a document review, not runtime or device verification. AGENTS.md and the diagnostic implementation policy were read; no runtime behavior or diagnostic events changed.

## A1 — Specify the concurrency domain of expectedRevision (high)

**Evidence:** `sync-contract.md:27-29,51-56,86-95,120-123`; AD-4 and AD-10.

AD-10 correctly separates receipt, source snapshot and aggregate revisions, but the request still carries the unqualified `expectedRevision`, status returns account generation/revision, and push returns accepted revision/watermarks. No rule binds that precondition to a particular namespace or states which unrelated writes invalidate it. A shared DTO with an integer or opaque revision field does not settle the semantic choice.

**Compliant incompatible units:** The M7.1 client serializes changes per source and supplies its last acknowledged source snapshot revision. The M6.3 server uses an account journal revision for push CAS and returns that in status, while retaining separate sourceSnapshotRevision and aggregateRevision fields. Each checks expected revisions, maintains atomic receipts and preserves all three distinct namespaces. Once another device writes, the client sends a valid source revision that the server interprets as a stale account revision. Retries cannot converge without changing an unstated protocol assumption. The reverse combination can incorrectly admit a write when unrelated counters happen to match.

**Required decision:** Name each precondition's authority and scope, including the distinction between envelope concurrency and correction target concurrency. State which revisions status/push/receipt return and which value a retry uses. Shared action-specific schemas should carry those named semantic types; test two sources changing between status, push and receipt reconciliation. This is a cross-story consistency rule, not a request to finish every DTO here.

## A2 — Assign durable migration retry ownership before M7.1 (medium)

**Evidence:** `sync-contract.md:51-69`; AD-10; `experience-and-states.md` Consent and migration restart/resume requirement.

AD-10 requires durable mutation identity before sending and a shared foreground/background lease, but the story ownership list assigns that durable queue/coordinator to M7.1. M6.3 owns the earlier resumable initial snapshot and M6.4 restores it. The document does not say whether M6.3 implements the shared outbox as a prerequisite or implements a separate bounded migration sender later adopted by M7.1.

**Compliant incompatible units:** The M6.3 builder supplies a durable migration checkpoint containing stable mutation IDs and a migration lease; it considers this the M6-specific implementation of AD-10. The M7.1 builder independently supplies the owner/source/generation outbox and lease required by its explicit ownership. Both persist before sending, reconcile receipts, keep network outside SQLite writer ownership and individually have one lease. At integration the migration sender and ongoing sync coordinator do not share claims/checkpoints, or M7.1 cannot resume M6's unknown receipt because it has no queue representation for it. Alternatively M6 waits for a queue that its own milestone does not yet provide. AD-10's intended single coordinator is not deliverable from the stated ownership without an additional allocation decision.

**Required decision:** Make the minimal shared durable sender/claim mechanism an M6.3 prerequisite and M7.1 an extension, or explicitly define the migration sender's takeover boundary, persisted compatibility and mandatory disabling of its old runner. Require a crash after server commit/before local acknowledgement in M6 followed by upgrade/takeover into M7, with exactly one receipt identity and a single claim owner.

## Successful attacks closed by the revision

AD-10 now rules out a second source replacing M6's first active history, and separates source acknowledgement from canonical aggregate activation. AD-11 now distinguishes local offline readability, observed fences and residual signed-URL/offline-byte access; immediate remote wipe is no longer a valid interpretation. Exact DTO derivation is explicitly a pre-M6.3 gate in one shared module, so missing full field listings are not independently counted as a finding. Full migrations, media verification and privacy-safe failure tests remain required delivery evidence rather than claims established by this review.
