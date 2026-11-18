# Delivery and diagnostics

## Implementation order

| Slice | Reuse and change | Exit evidence |
| --- | --- | --- |
| D1. Candidate local policy | Keep `reconstruction/engine-v1-1.ts` as baseline. Use `canonical-core.ts` and `canonical-projection.ts` for a shared shadow candidate. Reuse verified support maps and owner-correction fences. | Deterministic baseline/candidate output on reviewed fixtures, no visible switch, no stale shadow publication. |
| D2. First reveal and Possible trips | Reuse `reveal/projection.ts`, `components/atlas-reveal.tsx`, `components/mobile-screens.tsx`, existing entry handling and authorized preview resolution. Extend durable reads in `reconstruction/repository.ts`. Reuse `saveJourneyCorrection` semantics, validating candidate scope before Keep or rejection. | Separate consumers and reversible owner review, one featured trip where supported, and useful sparse/empty states. Existing Home entry and returning contexts still work. |
| D3. One question | Use shared shadow projection for bounded simulations. Persist a private offer/answer receipt using the existing writer, source and scope fencing. Add contextual reveal/undo and generation-scoped diff. | Positive, insufficient-benefit, skipped, stale, interrupted, exact retry and conflicting undo cases pass SQLite and consumer tests. |
| D4. Activate after evidence | Compare signed-off local fixture slices and private device cases. Verify mobile and packaged account worker consistency and explicit policy identity. Keep an independently switchable candidate rollout path until accepted. | Same held-out input comparisons, current-policy compatibility and owner continuity, isolated Android and iOS walkthroughs, documented rollback. |
| D5. Optional experiment | Test a bounded pairwise grouping proposal via the existing `ai/proposal-controller.ts` seam. Keep the production provider disabled unless separately approved. | Paired comparison against the improved local policy. Optional AI and its evaluation do not block D1–D4. |

D2 UI and test work can begin against fixtures before activation. D3 requires
D1 simulation results and the D2 reveal authority. D4 activates only the
verified compatible scope. Account restore and resumable worker checkpoints
must distinguish projection policy versions. Regenerate the shared native-free
domain using `node scripts/build-history-domain.mjs` and compare outputs.
If compatibility is unavailable, keep account history on its verified prior
policy and expose its actual status. Never switch to Local silently.

Roll back by selecting the prior supported projection and rebuilding eligible
inputs with the current owner facts and privacy. Retain exact pending decisions
for review where they cannot be projected safely. Do not restore old
permissions or deleted evidence through rollback.

## Diagnostic source map

The isolated D2 presentation components consume already-authorized card models
and invoke caller-supplied actions. They own no media read or mutation.
The integration boundary must classify preview loading under
`ATLAS_PREVIEW / PREVIEW_MEDIA` and owner review under
`POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_SAVE` or `POSSIBLE_TRIP_READBACK`.
Keep current cards visible on busy or unknown outcomes. Only a new verified
projection can remove a kept/rejected candidate from the section.

The clarification presentation also uses controlled state. Its integration
caller owns the question receipt, action correlation, scope validation and
the verified diff under `ATLAS_CLARIFY / QUESTION_OFFER_SAVE`,
`QUESTION_DECISION_COMMIT` and `QUESTION_RESULT_READ`. Pass only eligible
preview URIs and current authorized added-trip cards into the component.

The explicit development comparison entry is **Settings → Reconstruction
preview**, enabled only when both `__DEV__` and
`EXPO_PUBLIC_TRAVEL_LIFE_RECONSTRUCTION_PREVIEW=true` are present. Its route
uses `PhotoAccessProvider.loadRecognizableShadowPreview`; the provider and
repository own input, scope, candidate computation and readback diagnostics
under the mapped Atlas stages. Blurring the screen aborts its read and drops
candidate cards. The route displays fixed recovery copy, never raw errors.
It does not publish a candidate generation or expose review/Replay actions.

This is a planning delivery. Stage names below define the intended closed
runtime distinctions. Reuse current types when they express the same boundary.
Use one locally generated correlation per action through snapshot, writer,
projection and consumer readback. Keep developer boundary decisions scoped
to an explicit inspection or synthetic comparison, without per-item logging.

| Operation / stage | Fixed result or failure class | Durable handling and owner |
| --- | --- | --- |
| `ATLAS_REBUILD / CANDIDATE_INPUT_READ` | `ACCESS`, `SCHEMA`, `DATABASE_BUSY`, `HISTORY_STALE` | Canonical snapshot reader. Block invalid scope, retry a known busy read, retain current visible generation. |
| `ATLAS_REBUILD / CANDIDATE_CLASSIFY` | `COMPLETE`, `OWNER_REVIEW`, `HISTORY_STALE`, `UNKNOWN` | Shared candidate projection. Separate an owner mapping blocker from a stage-specific unknown. Never publish on stale inputs. |
| `ATLAS_REBUILD / CANDIDATE_COMMIT` | `HISTORY_STALE`, `HISTORY_FENCED`, `DATABASE_BUSY`, `TRANSACTION`, `UNKNOWN` | Scoped writer and publication compare-and-set. Preserve last eligible generation. Reconcile a lost acknowledgement before retrying. |
| `ATLAS_DURABLE_READ / FIRST_REVEAL_READ` | `COMPLETE`, `ACCESS`, `HISTORY_STALE`, `UNKNOWN` | Repository and provider readback. Discard superseded results and report completion only after verified current generation. |
| `ATLAS_PREVIEW / PREVIEW_MEDIA` | `MEDIA_UNAVAILABLE`, `MEDIA_ACCESS`, `MEDIA_VERIFY`, `HISTORY_STALE` | Current preview adapter and provider. Keep unavailable slots and discard stale results. Use neutral fallback. |
| `ATLAS_CLARIFY / QUESTION_SIMULATE` | `COMPLETE`, `SKIPPED`, `HISTORY_STALE`, `UNKNOWN` | Bounded simulation and selector. Insufficient benefit or budget is an expected skip. Atlas remains available. |
| `ATLAS_CLARIFY / QUESTION_OFFER_SAVE` | `HISTORY_CONFLICT`, `HISTORY_FENCED`, `DATABASE_BUSY`, `UNKNOWN` | Offer receipt write. Withhold question without verified current receipt. Retry only within the existing budget and authority. |
| `ATLAS_CLARIFY / QUESTION_DECISION_COMMIT` and `QUESTION_RESULT_READ` | `COMPLETE`, `SKIPPED`, `HISTORY_STALE`, `HISTORY_CONFLICT`, `OWNER_REVIEW`, `DATABASE_BUSY`, `TRANSACTION`, `UNKNOWN` | Answer, dismiss and reversal receipts plus durable rebuild/readback. Keep the exact command on unknown commit. No optimistic impact count. |
| `ATLAS_DURABLE_READ / POSSIBLE_TRIP_READ` | `ACCESS`, `HISTORY_STALE`, `DATABASE_BUSY`, `UNKNOWN` | Bounded current-generation candidate reads. Withhold private or stale cards. |
| `POSSIBLE_TRIP_REVIEW / POSSIBLE_TRIP_SAVE` and `POSSIBLE_TRIP_READBACK` | `COMPLETE`, `HISTORY_STALE`, `HISTORY_FENCED`, `JOURNEY_REMAP`, `DATABASE_BUSY`, `UNKNOWN` | Exact correction writer and verified projection read. Keep candidate or safe prior state until durable result is known. |
| `HISTORY_TRANSFER / CANDIDATE_POLICY_COMPATIBILITY` | `HISTORY_VERSION_UNSUPPORTED`, `HISTORY_REVIEW`, `HISTORY_STALE` | Account policy and checkpoint negotiation. Preserve verified compatible state. |

Keep mobile output at `app-diagnostics.ts` and worker output at its own
existing closed boundary. Verify correlation, exact stages, cancellation,
stale requests, retryability and content redaction using synthetic sentinels.
Collect only fixed operation, stage, reason, retryability, durable outcome
and correlation from the current Android `com.anonymous.travellife` process
or the resolved iOS bundle and authorized console. Verify build, active
record and policy before asking the owner to reproduce. Private comparisons
stay on-device. Keep only reviewed aggregate results and case outcomes.

The optional AI experiment must map consent, bounded request, response shape,
invalid candidate, timeout and abstention separately before runtime enablement.
Use no raw photos, thumbnails, names, identifiers, exact dates or coordinates
in a remote request. No account or media consent implies AI consent.
