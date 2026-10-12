---
title: 'M2.5 Bound processing cost and recover gracefully'
type: 'feature'
created: '2026-10-11'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '39af37edee8dbdfc46d4f0077052bd2f5b0082d5'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/supabase/README.md'
  - '{project-root}/evals/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The optional AI proxy currently reserves bounded quota before a provider call, but it retains no sanitized per-attempt measurement of actual usage, cost, latency, outcome, or frozen prompt/model versions. The local draft survives an AI failure by design, but owners cannot explicitly cancel a pending optional request and the recovery guarantee is not tested across restart-level state.

**Approach:** Keep AI disabled by default and preserve the local-only reconstruction as the authoritative fallback. Add a minimal private operational ledger, make optional AI requests cancellable and failure-safe, and expose an explicit local rescan/rebuild recovery path using the existing durable import checkpoints and atomic reconstruction transaction.

## Boundaries & Constraints

**Always:** Keep the 24 KB, 2,000 input-token, 800 output-token, 12-alternative, 8-candidate, ten-request/day, and USD 5 deployment-day ceilings enforced before each provider call. Persist only sanitized attempt fields: outcome, bounded token totals, calculated actual cost when usage is known, elapsed milliseconds, and contract/rule/model/prompt versions; never persist request/response content, opaque identifiers, personal evidence, headers, session tokens, or provider errors. Reserve quota atomically before invoking the provider; record a settled measurement afterwards without refunding a reservation. Treat missing provider usage/cost or a disabled path as unknown (`null`), never zero. Cancellation, timeout, stale revisions, lifecycle clear, provider/network failure, and restart must leave the latest completed local graph usable. Keep the server kill switch false and require CAPTCHA/rate protection plus a separately authorized live anonymous-session smoke test before enabling it.

**Never:** Enable the live proxy, create an anonymous session, call OpenAI, alter publishable mobile configuration, deploy a function, apply a remote migration, or claim measured provider/import performance in this story. Do not expose the private ledger through the Data API or client; do not change inferred history, corrections, sharing, or M2.6 incremental reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Bounded configured request | Valid anonymous request while the operational switch is enabled in an isolated contract test | Atomic reservation happens before the provider call; sanitized start/finish measurement has fixed version values and bounded totals | A quota refusal makes no provider request and records only a limited outcome if an attempt was opened. |
| Provider returns, refuses, or fails | Valid proxy response, refusal, timeout, malformed response, or network failure | Client receives an existing typed local-safe outcome; ledger records elapsed time and nullable actual usage/cost | No body, reference, error detail, or proposal is persisted; reservation remains conservative. |
| Owner cancels or app state changes | Pending optional request followed by cancel, stale revision, disconnect, delete, or process restart | Pending preview is discarded; prior complete graph and explicit Rebuild local draft remain usable | Abort the fetch where possible; do not apply a late proposal or fabricate a completed measurement. |
| Import/rebuild recovery | Paused/failed metadata import or failed reconstruction followed by owner action | Existing Resume metadata import and Rebuild local draft restart from durable state and retain the last committed graph | Surface a local retry message; do not erase corrections, checkpoints, or the prior graph. |

</frozen-after-approval>

## Code Map

- `supabase/functions/travel-life-ai-proxy/index.ts` -- reuse the strict parser, kill switch, pre-call RPC reservation, 20-second abort, and typed envelopes; add sanitized attempt timing/outcome settlement without body logging.
- `supabase/migrations/20261011030012_m2_2_ai_proxy_limits.sql` and `20261011030711_m2_2_lock_quota_rpc_to_service_role.sql` -- existing private quota pattern and service-role-only RPC; add a new generated migration for a private ledger and narrowly scoped service-role writer.
- `supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` -- extend contract coverage for pre-call quota, sanitized settlement, nullable unknown measurements, and no persistence of payload content.
- `apps/mobile/src/ai/{types,transport,proposal-controller}.ts` -- retain allowlisted response validation and stale-result protections; add abortable request ownership and a local cancelled state without applying proposals.
- `apps/mobile/src/photo-access/provider.tsx` and `apps/mobile/src/components/mobile-screens.tsx` -- wire the existing local import/rebuild recovery controls and a cancellable optional-AI preview; do not set endpoint or publishable configuration.
- `apps/mobile/src/{import-record,reconstruction}/{coordinator,controller}.ts` -- existing checkpoint restart and atomic prior-graph retention are the recovery implementation; extend only evidence tests if integration reveals a gap.
- `evals/README.md`, `supabase/README.md`, and `docs/project-state.md` -- define the sanitized measurement fields, record actual verification results, and state live model/import measurements as unknown until a separately authorized smoke test.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/` -- generate a private RLS-protected operational-attempt ledger and service-role-only recording boundary for sanitized reservations/settlements; no public grants or payload columns.
- [x] `supabase/functions/travel-life-ai-proxy/{index.ts,tests/contract.test.ts}` -- write one sanitized attempt lifecycle around the existing atomic reservation, including elapsed milliseconds, known actual tokens/cost, version fields, and typed cancelled/timeout/failure outcomes.
- [x] `apps/mobile/src/ai/{types,transport,proposal-controller}.ts` and focused tests -- make a pending optional request owner-cancellable, prevent late state changes, and preserve the graph across cancellation, network failure, and restart-level controller re-creation.
- [x] `apps/mobile/src/{photo-access/provider.tsx,components/mobile-screens.tsx,components/__tests__/}` -- expose the explicit retry/rebuild recovery actions with honest local-only wording, reusing import and reconstruction controllers rather than duplicating scan logic.
- [x] `evals/README.md`, `supabase/README.md`, and `docs/project-state.md` -- record the measurement contract, checked synthetic outcomes, disabled live status, and any unmeasured cost/latency/import values.

**Acceptance Criteria:**
- Given a valid bounded request, when the enabled proxy contract path reaches quota reservation, then configured ceilings and an atomic reservation are enforced before provider invocation and only sanitized attempt totals can be stored.
- Given a provider response or failure after reservation, when the attempt settles, then it records frozen contract/rule/model/prompt versions, elapsed time, and known usage/cost while unknown values remain null and no private request/response data is retained.
- Given cancellation, timeout, stale revisions, lifecycle clear, network/provider failure, or restart, when the owner returns, then the previous completed local draft remains available and an explicit foreground import/rebuild recovery action works without changing corrections.
- Given development verification runs with the kill switch disabled, when evidence is recorded, then no provider/import latency or cost is claimed as measured; the trace fields and contract tests prove representation and fail-closed behavior only.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| Transport rewrites a proxy `cancelled` response as invalid | medium | patch | `skippedReasons` excludes `cancelled` although the shared result type and proxy now emit it; the controller cannot show cancellation until it is allowlisted. |
| The disabled app transport makes the Cancel control unreachable | false | reject | The frozen approved intent keeps the proxy disabled and forbids publishable configuration or sessions. The controller/UI cancellation path is deliberately prepared for the later authorized enablement path; the app correctly shows the disabled fallback now. |
| A response can win the owner-abort race | medium | patch | The proxy records an already-aborted request but does not abort its provider controller before fetch, and does not re-check cancellation after fetch resolves. A late proposal could be returned after cancellation. |
| A response can win the timeout-abort race | medium | patch | The timeout aborts the signal but no timeout state is checked after fetch resolves, so a late provider response can settle as a proposal. |
| Reservation and attempt opening are separate operations | false | reject | If attempt opening fails, no provider call occurs and the request returns the existing unavailable fallback; there is no actual provider usage to measure. The preceding conservative reservation remains in the established daily guardrail by design. |
| A settlement RPC error can be silently ignored | medium | patch | `settle()` ignores both throws and error envelopes while returning a proposal. The handler must fail closed when the post-call operational record cannot be persisted, with one bounded retry. |
| Fixed reservation allocation is represented as actual cost | medium | patch | Token totals alone cannot establish provider billing. Cost must stay null until an approved live measurement supplies a documented pricing/invoice basis; the reservation remains a separate guardrail. |
| `limited` is an unreachable ledger outcome | low | patch | The ledger opens only after reservation succeeds, so it cannot settle as limited. Removing the unused constraint value prevents a misleading operational vocabulary. |
| Contract cases omit cancellation forwarding, abort races, RPC settlement failure, and version arguments | medium | patch | Existing mocks do not assert opening arguments and exercise only one abort rejection. Focused Deno/mobile cases can directly prove each changed boundary. |
| Migration access and service-role writes are not exercised by a real local database | medium | defer | The repository has no local Supabase/Postgres integration runner; a mocked Deno RPC cannot establish migration application, grants, or RLS. A configured local database test environment is required. |

## Design Notes

The ledger is operational evidence, not product telemetry: it is write-only from the Edge Function and contains no subject identifier, request identity, response identity, or application data. A conservative reservation controls spend before a provider call; a separate settled measurement reports observed consumption without weakening that guardrail.

## Verification

**Commands:**
- `npx --yes deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` -- expected: quotas, ledger sanitization, cancellation/failure outcomes, and no-body behavior pass.
- `npm --prefix apps/mobile test -- --runInBand ai reconstruction import` -- expected: cancellation, stale/lifecycle safety, prior-graph retention, and explicit recovery controls pass.
- `npm --prefix apps/mobile run check` -- expected: all mobile tests, typecheck, lint, and Expo Doctor pass.
- `npm run check` -- expected: foundation and evaluation smoke pass.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Inspect migration grants/RLS and function writes to confirm only service-role code can record or read the ledger and no column or log contains request/response content, evidence identifiers, or secrets.
