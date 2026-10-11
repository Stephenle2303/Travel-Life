---
title: 'M2.2 Build a protected AI proxy'
type: 'feature'
created: '2026-10-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5fc4af0e1af82e7c1f24c4d679b99c4a006b0b3f'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/decisions/0002-mvp-first-delivery.md'
  - '{project-root}/evals/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The local reconstruction baseline cannot safely use optional model assistance because there is no authenticated server boundary, no minimized request contract, and no server-side resource control.

**Approach:** Add a TypeScript Supabase Edge Function and mobile transport foundation for bounded optional AI. The function accepts only a schema-validated, minimized alternative set after an explicit consent revision and protected anonymous session, retains provider credentials on the server, and returns a typed skipped state whenever the service is unavailable or constrained.

**Decision:** Target the supplied Supabase project URL, `https://fgmcnzxhbrtvjhtafort.supabase.co`. The repository contains no Supabase CLI, authenticated deployment session, publishable project key, or OpenAI secret; the implementation must keep the service disabled until those server-side settings are provisioned.

**Decision:** Provision and deploy against the linked `fgmcnzxhbrtvjhtafort` Travel-Life project. The CLI is authenticated and linked; the server-side OpenAI secret is configured. Enable anonymous sign-in in the dashboard as confirmed by the owner, while keeping the eventual function JWT-protected and the local reconstruction usable if online AI is unavailable.

## Boundaries & Constraints

**Always:** Require a valid anonymous user JWT; use the configured `gpt-5.4-mini-2026-03-17` snapshot through OpenAI Responses with `store:false`; keep input/output caps at 2,000/800 tokens, ten requests per anonymous installation/day, and a USD 5 deployment-wide daily reservation. Validate strict schemas and opaque references, atomic quota reservation, a kill switch, timeout/refusal handling, sanitized usage totals, and no request/response-body logging. Bind a request to rule, evidence, correction, and consent revisions. Keep the local M2.1 graph usable when AI is skipped, declined, invalid, stale, unavailable, or limited.

**Never:** Send originals, thumbnails, URIs, filenames, source/asset IDs, exact coordinates or accuracy, absolute dates/timestamps/time zones, correction text, free text, credentials, or arbitrary nested payloads. Do not add AI grouping/label application, public sharing, provider secrets in the app, durable raw traces, or a claim of zero provider retention or reconstruction accuracy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Eligible consented request | Anonymous session, current revisions, allowlisted opaque alternatives | Function reserves quota, calls the configured snapshot with `store:false`, and returns a schema-bound proposal envelope | Client remains responsible for applying no proposal in this story. |
| Missing/expired consent or session | No valid JWT, consent revision, or current local binding | Reject before provider invocation | Client reports typed AI-skipped state and keeps local draft. |
| Disallowed/private body field | Extra key, private datum, free text, or unsupported ID | Reject body and do not log it | Return a sanitized validation failure. |
| Limit/refusal/timeout/kill switch | Budget/rate cap, provider refusal, timeout, disabled service | Do not retain a body or partial proposal | Return typed skipped reason with sanitized usage if known. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/{types,repository,controller}.ts` -- authoritative local evidence/revision vocabulary and local-first fallback to preserve; do not expose its private records to a remote call.
- `apps/mobile/src/photo-access/provider.tsx` -- application composition point for a future optional-AI controller; M2.2 should add contracts only, not M2.3 proposal application.
- `apps/mobile/src/import-record/repository.ts` -- local lifecycle, correction, and canonical evidence revisions; use only derived revisions and locally mapped opaque IDs.
- `evals/README.md` and `evals/schemas/trace.schema.json` -- sanitized version/cost/latency contract conventions; no product-quality claim or real trace storage.
- `supabase/` -- new Edge Function, database migration, configuration/docs, and function tests; no backend foundation exists today.
- `apps/mobile/src/ai/` -- new consent/session/transport/minimizer and response validation boundary, tested only with synthetic opaque fixtures.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/functions/travel-life-ai-proxy/` -- implement the JWT-protected TypeScript Edge Function, strict request/proposal schemas, OpenAI `store:false` call, no-body logging, timeout/refusal mapping, and kill switch.
- [ ] `supabase/migrations/` -- add private quota/usage tables and RLS-scoped atomic reservation helpers for anonymous users; rate-limit request/session abuse without exposing a public service role path.
- [ ] `apps/mobile/src/ai/` -- add explicit revisioned consent state, anonymous-session transport, allowlisted payload builder, typed skipped results, and client-side proposal/reference validation; retain opaque-to-local mapping exclusively on device.
- [ ] `apps/mobile/.env.example` and deployment documentation -- define non-secret publishable configuration and server-only secret names, anonymous-auth/CAPTCHA setup, retention disclosure, and disabled-by-default behavior.
- [ ] synthetic Edge/mobile contract tests -- prove private-field rejection, auth/consent/revision gates, quota/budget reservation, `store:false`, refusal/timeout/kill fallback, no body logging, and local-baseline preservation.
- [ ] `docs/project-state.md` and this spec -- record actual configuration, validation, and unmeasured model/deployment behavior without claiming a provider call succeeded.

**Acceptance Criteria:**
- Given an opted-in anonymous session and a minimized current candidate set, when optional AI is requested, then only allowlisted opaque/coarse fields can reach the protected function and provider credentials remain server-side.
- Given an unauthenticated, stale, private-field-bearing, over-budget, refused, timed-out, or disabled request, when the function or client handles it, then no proposal is applied or raw body recorded and the local reconstruction remains usable.
- Given a valid configured provider response, when it is returned, then it is strict-schema validated, bounded to existing supplied opaque references, versioned, and stored only as sanitized usage/proposal metadata needed for later M2.3 review.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Anonymous authentication protects the online boundary without putting an email/login wall in front of local history. It remains an abuse surface: production enablement must configure anonymous-auth protections such as CAPTCHA/rate controls. `store:false` disables Responses application-state retention; it does not justify a zero-retention claim for provider abuse monitoring or infrastructure logs.

## Verification

**Commands:**
- `npm --prefix apps/mobile run check` -- expected: mobile contracts, TypeScript, lint, and Expo checks pass.
- `npm run check` -- expected: existing foundation/eval smoke checks pass.
- Supabase function/migration test command chosen from the installed CLI's `--help` output -- expected: schema/function contract tests pass without real private inputs.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Inspect the deployed configuration only if provisioned: anonymous auth is enabled, JWT verification remains enabled for the function, secrets are absent from mobile artifacts, and logging does not include request/response bodies.
