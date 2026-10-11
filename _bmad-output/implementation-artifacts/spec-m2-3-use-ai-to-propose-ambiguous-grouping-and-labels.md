---
title: 'M2.3 Use AI to propose ambiguous grouping and labels'
type: 'feature'
created: '2026-10-11'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '40602c0bea8af1e529ed1ea24decfeaad1378a38'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/product/design-system.md'
  - '{project-root}/docs/decisions/0006-photo-trip-assignment.md'
  - '{project-root}/evals/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M2.1 can retain uncertain local journey links, but the owner cannot yet ask for an optional, bounded AI proposal or inspect it as a clearly inferred suggestion. M2.2 supplies the protected transport but deliberately does not connect it to reconstruction or the Atlas.

**Approach:** Derive a small set of eligible ambiguous alternatives from the authoritative local reconstruction graph, send only minimized opaque structural context through M2.2 after current owner consent, and present the returned proposal in the private Atlas as reviewable inference. Revalidate every result against rule, evidence, correction, and consent revisions; preserve the local graph whenever AI is skipped, stale, unavailable, invalid, or declined.

**Decision:** M2.3 is preview-only. It shows a transient, revision-bound suggestion and does not create durable accept/reject/edit records or mutate the local reconstruction; a later correction story owns durable owner decisions.

**Decision:** AI may return only fixed opaque label codes. The app maps them to approved local wording; M2.3 does not send or receive model-written free text and does not offer editable labels.

**Decision:** Keep `TRAVEL_LIFE_AI_ENABLED=false` during M2.3. The review experience and synthetic contract checks ship disabled; enabling it later requires configured CAPTCHA/rate protection, client publishable configuration, and an owner-operated anonymous-session smoke test.

## Boundaries & Constraints

**Always:** Reuse `reconstructV1` results as the sole candidate source; retain opaque-to-local mappings in memory only; keep AI output separate from visit support, presence, confirmed facts, owner corrections, sharing, and publishing. Offer accessible inferred/uncertain/skipped states using the accepted Living Atlas visual language. Persist only the smallest local, revision-bound review metadata required by the approved owner-action choice, and clear it for disconnected/deleted records.

**Never:** Send original media, source IDs, coordinates, accuracy, absolute dates/times, correction text, arbitrary free text, or private diagnostics. Do not let AI create places/evidence/dates/relationships, override a boundary or correction, automatically apply a proposal, claim travel or presence, enable the server feature flag without the approved production controls, or claim model quality from synthetic tests.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Eligible ambiguity | Current local graph has bounded possible merge, suggested membership, or unresolved alternative; current consent | Send only its opaque coarse alternative set and show a validated proposal as inferred/reviewable | No proposal mutates the local graph automatically. |
| No eligible ambiguity or declined consent | No bounded candidate, owner declines, or consent revision is absent | Keep local graph and explain that optional AI was not used | Do not create a session or make a network call. |
| Stale response | Evidence, correction, rule, or consent revision changes during a request | Discard result and retain local draft | Show an actionable stale/skipped state. |
| Invalid or constrained service | Unsupported references, invalid label/category, quota/refusal/timeout/disabled result | Reject proposal and preserve the local draft | Display a concise local-safe reason without body content. |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/reconstruction/{engine,types,repository,controller}.ts` -- authoritative deterministic graph, revisions, and local-first fallback; derive alternatives here rather than from raw evidence.
- `apps/mobile/src/ai/{types,minimizer,session,transport,validation}.ts` -- M2.2 opaque request/response boundary; extend only with strict versioned structural fields needed for the approved label option.
- `apps/mobile/src/photo-access/provider.tsx` -- composition point for reconstruction and a revision-bound optional-AI controller; lifecycle clear/delete must clear proposal state too.
- `apps/mobile/src/components/{mobile-screens,ui}.tsx` -- existing Atlas scaffold and Living Atlas primitives; retain accessible evidence/uncertainty wording and useful skipped-state actions.
- `apps/mobile/src/import-record/repository.ts` and `apps/mobile/src/history-record/types.ts` -- local migration/lifecycle/correction precedence. Do not overwrite rebuilt reconstruction tables or write direct AI conclusions.
- `supabase/functions/travel-life-ai-proxy/` -- protected function contract; request/proposal schema must reject unsupported labels and stale structural references.
- `evals/README.md` -- contract/provenance checks only; no reconstruction-quality claim.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/reconstruction/` and `apps/mobile/src/ai/` -- derive bounded ambiguity candidates from the local graph, bind revisions, and add a controller that maps valid opaque results back only while current.
- [x] `supabase/functions/travel-life-ai-proxy/` and mobile AI types -- make the minimal strict contract extension needed for the approved label form; preserve M2.2 privacy, quota, JWT, and `store:false` guarantees.
- [x] `apps/mobile/src/photo-access/provider.tsx` and `apps/mobile/src/components/mobile-screens.tsx` -- expose the optional review state and render inferred proposal, no-eligibility, declined, stale, and skipped outcomes without automatic application.
- [x] `apps/mobile/src/**/__tests__/` and `supabase/functions/**/tests/` -- add synthetic cases for eligibility, minimization, stale invalidation, correction/boundary precedence, unsupported output, skip fallback, and no automatic graph mutation.
- [x] `docs/project-state.md` and this spec -- record the selected owner-action/label/live-availability decisions and actual verification without claiming model quality or a provider call.

**Acceptance Criteria:**
- Given a current consented local ambiguity, when the owner requests optional AI, then the service receives only an allowlisted opaque alternative and the Atlas renders a bounded inferred proposal referencing existing local candidates.
- Given an invented, stale, boundary/correction-conflicting, unsupported, uninformative, or failed result, when M2.3 handles it, then it is discarded or shown as skipped and cannot alter visit support, presence, confirmed history, or the local draft.
- Given no ambiguity, declined consent, or unavailable AI, when the owner views Atlas, then the deterministic local reconstruction remains usable with clear evidence and uncertainty wording.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
| --- | --- | --- | --- |
| In-flight revision changes can render a stale proposal | medium | patch | `request` awaits transport using only its initial revisions; the frozen intent requires a current-result revalidation. |
| Lifecycle clear can be overwritten by an in-flight completion | medium | patch | `clear()` resets the view but does not invalidate an outstanding `request` continuation. |
| Older concurrent requests can overwrite newer review state | medium | patch | No request sequence currently limits authoritative completions to the latest request. |
| Derived merge metadata fabricates offsets and categories | medium | patch | `possibleMerges` does not contain those values, so the controller must exclude a candidate until it has truthful structural metadata. |
| A grouping response can select only one candidate | medium | patch | The current grouping label denotes a relationship but validation permits a partial pair; require the bounded pair. |
| Empty proposal envelopes render as inferred results | medium | patch | `Array.prototype.every` accepts an empty array and the controller sets `proposal` with no items. |
| Controller maps an injected transport result without an independent request-bound check | low | patch | A malformed internal transport result can map an opaque candidate from another alternative through the global opaque map. |
| Disabled Atlas action does not wire the live request path | false | reject | The frozen decision requires the kill switch to remain off during M2.3; the intentional disabled preview must not create a session or call the network. |
| Edge-case review: revisions can change during request | medium | carried patch | Same verified stale-result defect as the first row; it requires current-state revalidation after awaiting transport. |
| Edge-case review: empty proposals are uninformative | medium | carried patch | Same verified empty-envelope defect as the sixth row. |
| Proxy label-code pairing lacks negative contract cases | medium | patch | Existing Deno tests exercise only an accepted label pairing and would not detect missing, unsupported, or mismatched labels. |
| Mobile label contract lacks negative coverage | medium | patch | Existing mobile tests reject candidates but not malformed label-code pairings. |
| Connected Atlas disabled fallback lacks a rendered interaction test | low | patch | The controller unit test does not prove the connected screen button renders its explanatory skipped state. |
| Lifecycle clearing lacks provider-boundary coverage | low | patch | Existing lifecycle tests do not establish and observe AI review state through disconnect/delete. |
| Verification review: in-flight stale invalidation has no direct test | medium | carried patch | Same verified stale-result defect as the first row; a delayed transport test must cover it. |
| Blind review: suggested memberships and unresolved dispositions are absent from AI eligibility | false | reject | The controller accepts only graph entries that have a bounded, allowlisted alternative shape. Current memberships and dispositions lack that safe relationship shape, so they are correctly not eligible under the matrix's bounded-candidate condition. |
| Blind review: provider never invokes the live transport | false | reject | The frozen decision requires the kill switch to remain off and forbids a session or network call in M2.3; `showDisabledPreview()` is the required active behavior. |
| Blind review: provider does not supply current revisions | false | reject | No live request is reachable while the kill switch is off. The controller accepts a current-revision reader for the future enabled path, so no current owner can receive an unrevalidated proposal. |
| Blind review: proxy accepts partial ambiguous groupings | medium | patch | The proxy could reserve quota for a result the mobile validator rejects. It now requires the complete supplied candidate set and the contract test covers the rejection. |
| Blind review: proxy accepts an empty proposal envelope | medium | patch | An empty envelope is uninformative and reached a later client fallback after a provider call. The proxy now rejects it and the contract test covers it. |
| Blind review: fixed no-suggestion labels become skipped state | false | reject | A zero-candidate no-suggestion or needs-more-evidence result is intentionally uninformative, and the frozen matrix requires uninformative results to be shown as skipped rather than inferred. |
| Blind review: transport rejection leaves requesting state | medium | patch | An unhandled rejection was possible during an active request. The controller now catches it, respects the generation guard, and emits the local-safe skipped state. |
| Blind review: mobile response validator accepts extra fields | medium | patch | Extra fields could violate the fixed-code-only response contract. Exact runtime keys are now required and a focused regression test covers the case. |
| Blind review: Atlas proposal gives only a reference count | low | reject | A richer private journey projection needs new review data and interaction design; while the server is intentionally disabled, the existing inferred wording and references are sufficient for this bounded preview surface. |
| Verification review: no reverse-resolution test for two in-flight requests | medium | patch | The generation guard is now covered by two concurrent requests that resolve in reverse order, proving an older result cannot overwrite the newer state. |
| Edge review: transport rejection has no local-safe recovery | medium | carried patch | Same verified transport-rejection defect as above; the controller now catches it and preserves the newest generation. |
| Edge review: zero-candidate label result is rendered as inferred | false | reject | The controller converts all zero-candidate outcomes to skipped before rendering, which is the required treatment for an uninformative result. |

## Design Notes

The review surface is an Atlas panel rather than a second history model: it makes the local draft primary, uses a Citrus action only for the owner’s optional request, and labels every response as inferred. It must retain a readable list-style path alongside future map/timeline work, never turn a structural proposal into proof of a place visit or owner presence.

## Verification

**Commands:**
- `npm --prefix apps/mobile run check` -- expected: mobile contract, UI, TypeScript, lint, and Expo checks pass.
- `npm run check` -- expected: foundation and evaluation-infrastructure checks pass.
- `npx --yes deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` -- expected: protected proxy contract passes with synthetic opaque input.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**
- Inspect a local inferred proposal and skipped state for clear evidence/uncertainty language, no automatic local-graph change, and no private identifiers in UI diagnostics.

Actual verification (2026-10-11): `npm --prefix apps/mobile run check` passed 118 Jest tests, TypeScript, lint, and Expo Doctor. `npm run check` passed 20 foundation tests and the evaluation-infrastructure smoke check. `npx --yes deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/travel-life-ai-proxy/tests/contract.test.ts` passed 10 synthetic protected-proxy contract tests. `git diff --check` passed. Focused reconstruction and AI-controller suites passed 15 tests, and the review-fix mobile suites passed 21 tests. No provider call or model-quality claim was made.
