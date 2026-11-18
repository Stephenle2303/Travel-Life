# Persistence, compatibility and development sequence

## Record contract

Reuse `configured_home_area` for stable area IDs, labels, centers, radii and
effective bounds. Migrate at the actual current schema version. Preserve every
existing row, its ID, name, radius, dates and origin. New direct picks use
`manual-pin` provenance. Existing photo-backed selections keep `observed-area`.
Accept legacy rows with no name and let the owner name them in Settings.

| Private state | Meaning |
| --- | --- |
| Home setup disposition | Untouched, saved, or skipped for the current first-run Local record. Stores no photo grant or source-processing intent. |
| Home projection revision | Monotonic per-history revision of geometry and effective periods. Rename-only changes update display metadata without making unchanged geometry stale. |
| Pending projection request | Latest committed required Home revision with scoped lifecycle and a durable mutation receipt. Retain until verified compatible publication or explicit authority invalidation. |
| Run identity | Active scope, evidence checkpoint, Home revision, privacy/correction revisions and versioned shared projection policy. |

API names are implementation targets. Follow existing repository interfaces.

| Boundary | Contract |
| --- | --- |
| `readHomeSetup` | Read the committed scope and disposition independently of photo access and trip eligibility. A read failure produces recoverable setup state. |
| `saveInitialHomes(command, expectedScope, drafts)` | Validate all areas before writing. One short serialized transaction saves rows, the completed setup disposition and matching mutation receipt. A retry of the exact command reads the same receipt. Reuse of a command for different inputs conflicts. |
| `skipInitialHomes(command, expectedScope)` | Record the explicit skip without writing drafts or altering previously committed homes. Use the same idempotency and authority rules. |
| `saveHomeEdit` / `removeHome` | Require current authority and expected Home row/version. Preserve the stable ID on edit. Save change and pending projection revision atomically. No photo permission is required for a private direct point edit. |
| `reconcileHomeCommand` | Verify exact receipt and current scope before advancing setup or reporting saved. When the write cannot be verified, keep the command and show Check again. |
| `readCurrentProjection` | Return the current authorized committed projection or a typed pending/review state. A previous same-scope Atlas may remain browseable while the requested update is pending, subject to current eligibility. |

Place the first-run decision in the same owner-private SQLite transaction as the
Home writes. The existing SecureStore presentation marker remains separate.
Read and repair that marker idempotently from the verified setup receipt.
Choose the resume route using both stores and established-history checks.
A committed setup save with a missing presentation acknowledgement resumes
photo choice without a duplicate write. A failed DB read cannot authorize
processing. A disconnected or deleted lifecycle stays under existing explicit
reconnect/create behavior. Initial setup does not create an account, reactivate
a deleted record, grant permission, start a rebuild before source intent, or
enroll recurring updates.

## Rebuild and publication

1. Queue one current update through the existing foreground writer and
   background maintenance coordination. An initial Home save records context
   only until an explicit source choice admits the first preparation run.
   Subsequent Home scope edits coalesce to the latest committed revision.
2. Read the Home revision and all existing evidence, lifecycle, privacy and
   correction fences before computing. The worker uses the authorized source
   snapshot/aggregate plus its equivalent versioned policy identity.
3. Before making output visible, compare the full snapshot tuple again
   through the existing commit gate. A stale run cannot publish, clear the
   pending request, or overwrite an existing correction or Replay selection.
   Retain exact retry tokens and distinguish storage failure from a lost
   acknowledgement. Only durable readback proves completion, including an
   intentionally empty, eligible result.
4. Invalidate affected media/Replay publication immediately on a saved
   eligibility change. An older Atlas may show only still-eligible content
   with update status. If current eligibility cannot be proven for its
   media or selection, withhold those results until verification. A running
   native task remains owned until it settles. A timeout does not clear the
   writer guard or prove rollback.
5. Resume pending work after process restart and only while its source and
   authority remain usable. Access revocation, account switch, disconnect,
   deletion and explicit privacy exclusion take precedence over queued work.

Use existing exact-support/lineage rules to protect reviewed trip and memory
decisions. Recompute provisional candidates against new Home context, while
retaining complete reviewed support for legitimate owner overrides. If a new
generation would make a correction or committed Replay remap ambiguous, keep
the unresolved owner decision and the safe prior result where eligible, or
use the existing review outcome. The spec does not authorize deletion,
fuzzy target reassignment or overwriting a current committed composition.

## Local and Account compatibility

- First-run edits target Local history. Account history continues to use the
  explicitly bound owner and current authorized replica. Home records do not
  cross those boundaries merely because both histories exist on one device.
- Existing private history sync can transfer compatible Home rows under its
  existing authority and consent. The current Home wire validators admit
  only legacy and observed-area origins. Inventory the actual SQLite,
  client, worker, SQL and restore consumers before allocating the new version.
  Introduce compatible readers before writers advertise manual-pin rows.
  Use an explicit capability/version guard at export, merge and restore.
  An incompatible peer receives an actionable update state and retains its
  verified prior history. Never silently drop or relabel Home rows to pass a
  validator, and never upload private Home coordinates without existing
  history authorization.
- Account Home edits require a verified owner-authoritative create/edit/remove
  path. Confirm whether current replication handles same-ID replacement and
  durable removal across sources. If it does not, keep the new Account edit
  controls gated until that protocol converges, including a stale source that
  must not resurrect a removed Home. The Local workflow remains usable.
- Carry a projection policy identity independently of unchanged V1 evidence
  rules. Use the existing generation/domain compatibility mechanism if it
  can distinguish the changed rules and stale resumable checkpoints.
  Regenerate the native-free history domain via
  `node scripts/build-history-domain.mjs`. Verify worker and mobile outputs on
  the same canonical fixture. No mixed-policy publication or silent rewrite
  of an existing owner record during enablement.

## Development sequence

| Slice | Implementation surface | Exit gate |
| --- | --- | --- |
| D1. Closed diagnostics and shared projection | `reconstruction/engine-v1-1.ts`, `canonical-core.ts`, `canonical-projection.ts`, repository, diagnostics and history worker domain. | Failing daily-chain and remote-Home fixtures reproduce the current defects, then pass through the committed projection. Default album and qualification share Home authority. |
| D2. Home persistence and entry | Existing import/reconstruction repository and transaction gate, `onboarding/presentation.ts`, `photo-access/controller.ts`, provider, Welcome/import routing and Home Settings. | Fresh, skipped, returning, restart, denied and busy flows pass real SQLite and normal-entry tests. No extra source read, permission prompt or rebuild. |
| D3. Exact selected-item investigation | `reconstruction/repository.ts`, Atlas preview/gallery, native and account adapters, closed diagnostics. | Synthetic controls isolate association, metadata and resolution; the owner case stays open until a matched device reproduction. Any incident fix follows the demonstrated cause. |
| D4. Convergence and activation evidence | Mobile replica hydration, history wire/domain/worker, current access and Replay fences. | Matched canonical inputs converge across runtimes, compatibility and correction controls pass, and platform acceptance is attached. Release checks below apply by scope. |

D1 and the D2 persistence/UI design may progress independently. Enable first-run
Home only after the corresponding filtering, scope and publication protections
pass. D3 can proceed without waiting for onboarding. A missing owner-selected
original blocks only the image incident claim. Use controlled local and account
test histories to verify changed generation semantics before exposing them to
owner histories. Record rollout or schema decisions in this delivery record.
