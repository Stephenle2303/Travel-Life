---
title: M4.5 selected share snapshot delivery
type: implementation-spec
created: 2026-10-26
status: in-review
route: dispatch
baseline_commit: 113e5c89feae737dc0facb68569b93f6cf452501
context:
  - AGENTS.md
  - docs/development/diagnostic-implementation-policy.md
  - docs/product/design-system.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/SPEC.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/experience.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/publication-contract.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/acceptance.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/implementation-plan.md
  - _bmad-output/specs/spec-m4-5-selected-share-snapshots/diagnostics.md
---

# M4.5 selected share snapshot delivery

## Authorized continuation (2026-10-27)

## Approved MLP scope correction (2026-10-27)

The owner approved the batch sprint change proposal at
[`../planning-artifacts/sprint-change-proposal-2026-10-27.md`](../planning-artifacts/sprint-change-proposal-2026-10-27.md).
M4.5/M4.6 hosted snapshot/media publication and the recipient viewer are
deferred after MLP. Preserve the existing hard remote-media denial and do not
deploy or configure a validator, bucket, link, viewer, or cleanup schedule for
this MLP. The MLP owner-sharing route is M4.7's exact local Replay MP4 through
the operating-system share sheet; external recipient availability and delivery
remain device acceptance, not an app guarantee. Re-entry requires a separately
approved hosting/budget/privacy proposal.

The owner confirmed the preceding trip-cover and selected Replay share device
checks complete and explicitly requested finishing M4.5 through M4.6 together.
This additive scope supersedes the older viewer exclusion below for this run;
preserve the historical frozen block. Continue in the existing dirty primary
checkout, preserving unrelated work. Do not stage, commit, push, reset, or upload
private evidence. Implementation, local synthetic integration verification and
preparation of a reviewable deployment are authorized. Inspect available remote
configuration read-only; live enablement requires verified compatible hosting,
logging, auth and storage configuration. Do all preparatory work before asking
for any genuinely missing deployment decision.

### M4.6 tasks and acceptance

- Deliver a real browser application under `apps/` consuming only checked v1
  recipient endpoints, responsive to mobile and desktop, matching Living Atlas.
- Given an active link opened without installation/login, show its selected
  destinations on a selectable map, chronological timeline, and selected media
  browser. Map failure leaves a usable selectable list. Preserve date precision
  and inference labels; render untrusted strings as text.
- Given invalid, expired, revoked or incompatible content, show the same safe
  unavailable state; deny snapshot and every media/range request. Never expose
  storage URLs or service keys. Test cross-owner and cross-version denial.
- Read the capability from a fragment, clear it from history, and transmit it
  only through a redacted body/header. Apply no-store/no-index/no-referrer/CSP,
  no service worker or analytics, safe generic social preview, deliberate
  copy/native share and an optional configured Create Yours path.
- Wire the mobile owner selection, exact preview, explicit publication and
  management surfaces to the implemented protocol. Copy/share is gated on a
  configured compatible reachable viewer. Retain durable recovery and removal
  intent through restart/delete-all. No automatic publication or original upload.
- Verify browser build and actual browser interaction with synthetic fixtures,
  backend runtime and real SQL/RLS/storage integration where available, focused
  mobile tests/typecheck/lint and root `npm run check`. Missing services are
  blockers to deployed claims, never passing checks; finish independent work.

### Diagnostic extension before implementation

Retain the canonical diagnostics companion for owner eligibility, derivative,
storage, auth, upload, activation, reconciliation, management and cleanup stages.
For M4.6 add a closed browser `SHARE_READ` operation with `SHARE_TOKEN`,
`SHARE_SNAPSHOT`, `SHARE_MEDIA` and `SHARE_MAP` stages, bounded locally random
correlation, fixed START/COMPLETE/SKIPPED/INVALID_REQUEST/UNAVAILABLE/UNKNOWN
categories and truthful unchanged/failed/skipped/complete outcomes. Backend read
checks distinguish token validation, envelope lookup and media membership/storage
failure in memory and fixed stage/reason only; public unavailable responses stay
indistinguishable. Map fallback is an expected lifecycle, not raw-error logging.
Instrument actual modules introduced by this continuation and update this map
with their source paths before behavior lands. Inject synthetic private sentinels
in fault tests and prove no logs/UI expose raw errors, capability, paths or
payloads. Collection: local synthetic browser console and function stderr filtered
to the closed diagnostic prefix/correlation; never export raw requests, browser
history, auth headers or real recipient links. Verify actual deployed log/cache
configuration before external enablement.

<frozen-after-approval>

## Intent

An owner explicitly selects policy-visible journey facts and media, previews a
sanitized immutable snapshot, and may publish, replace, expire, revoke, or
durably remove it. A recipient can read only an active, unexpired version via
an opaque capability; direct storage is never a reader surface.

## Boundaries

This delivery adds the mobile share domain, private derivative contract,
Supabase migration and JWT-protected Edge Functions. It does not deliver the
M4.6 browser viewer, public buckets, raw source-media upload, automatic
publishing, recovery of a lost raw capability, or deployment/device acceptance.

## I/O and race matrix

| Boundary | Required outcome |
| --- | --- |
| Selection | Call `loadJourneyEligibility(..., 'share')` again immediately before activation; privacy/revision drift invalidates preview. |
| Create/retry | Client persists opaque request ID and raw capability before network work; server stores only its digest and returns the same receipt for identical request/content. |
| Upload/activate | Private staged objects are verified, write-once and complete before one transaction activates an immutable version. |
| Replace/cancel | Cancel is effective only before activation starts. Once receipt reconciliation proves activation, the link remains and Revoke is a separate explicit action. |
| Expiry | Immutable content version is separate from the mutable active envelope expiry; expiry changes cannot revive terminal records. |
| Delete all | Server first applies an owner delete fence, blocks new work/activation, then queues idempotent removal; clients reconcile an in-flight operation against that fence. |
| Read | Function checks capability digest, active pointer, expiry and exact media membership for every snapshot/range request. |
| Diagnostics | Each branch emits only the closed redacted `app-diagnostics` event with local correlation; native/service detail remains in memory. |

</frozen-after-approval>

## Approval and source map

The owner approved implementation on 2026-10-26 after the spec review. The
canonical product contract is
[`SPEC.md`](../specs/spec-m4-5-selected-share-snapshots/SPEC.md); its review
record is [the M4.5 review](review-m4-5-selected-share-snapshots-2026-10-26.md).

| Area | Existing source to extend |
| --- | --- |
| Eligibility | `apps/mobile/src/reconstruction/repository.ts` `loadJourneyEligibility` |
| Session/transport | `apps/mobile/src/ai/session.ts`, `apps/mobile/src/ai/transport.ts` |
| Closed diagnostics | `apps/mobile/src/diagnostics/app-diagnostics.ts` |
| Derivative renderer | `apps/mobile/src/replay/renderer.ts` |
| Supabase style | `supabase/functions/travel-life-ai-proxy/index.ts`, existing private-schema migrations |

## Tasks and acceptance mapping

1. **Domain and diagnostics:** add closed snapshot request/manifest/state types,
   deterministic request/content binding, and share diagnostic vocabulary.
   Unit RED/GREEN coverage maps AC-01–08 and AC-25–27.
2. **Mobile service:** build preview from rechecked eligible selections, retain
   the local recovery state without source identifiers, and use the existing
   anonymous session provider only on owner action. Map AC-01–08, 16–20.
3. **Derivative boundary:** re-encode selected assets to private bounded
   derivatives, remove container metadata, validate result, and reject rather
   than silently drop/fallback. Map AC-03–04, 14–15, 22.
4. **Server enforcement:** add private schema/RLS, quota/fence/receipt RPCs,
   staging verification and token-checked read proxy. Map AC-07–21 and 24.
5. **Management/recovery:** model immutable versions, expiry envelope, replace,
   revoke and delete-all reconciliation. Map AC-16–20, 24.
6. **Evidence:** run focused RED/GREEN, mobile typecheck/lint, migration/function
   static checks, root check, then document runtime/device/deployment gates that
   remain open. Map AC-21–28.

## Test-first evidence

The first production slice must begin with a failing Jest contract test. The
test binds a request ID to one immutable content digest, rejects a changed retry,
and demonstrates that a delete fence prevents activation. No production share
logic is added before its intended RED result is captured. Root check is
necessary but does not replace mobile/backend tests.

## Security and diagnostics constraints

Use exact-key/bounded validators, parameterized SQL, RLS and safe function
search paths. Do not log capability, storage path, source/media identifiers,
raw errors, coordinates, or payloads. Edge responses are fixed envelopes with
`no-store`; public storage URLs and direct object reads are prohibited. This
spec adopts `docs/development/diagnostic-implementation-policy.md`.

## Change log

### Parent verification and review handoff (2026-10-27)

Cleanup source now separates `_shared/share-cleanup.ts` stages
`SHARE_CLEANUP_LEASE`, `SHARE_OBJECT_DELETE` and `SHARE_CLEANUP_ACK` under
`SHARE_CLEANUP`, fixed START/COMPLETE/UNAVAILABLE/UNKNOWN/INVALID_REQUEST and
truthful outcomes. The function entrypoint only supplies protected configuration.
Two runtime tests force each failure, assert no acknowledgement before storage
removal and preserve one redacted action correlation. Deno check passes.

Parent verification: actual synthetic JPEG and H.264/AAC outputs pass structural
validation and complete local FFmpeg decode after metadata scrub. Four media
regressions cover metadata, external references, timestamps, offsets and malformed
layouts. Eight HTTP runtime tests cover token digests, exact payload, per-range
revocation, owner authentication, CORS, hard media gate and precise diagnostics.
Three viewer tests cover token/history, unsafe payloads and strict CSP shell.
The generic HTML now uses a per-response nonce in `apps/share-viewer/api/viewer.mjs`
to permit Google Maps strict-dynamic loading without unsafe-inline/eval. Google
auth failure and a bounded map-load wait retain the list fallback. Provider-map
and hosted nonce behavior require deployed browser acceptance.

The local browser initially verified desktop and 390×844 list layout, date order,
inference, selection and copy feedback. Later browser use was disabled in Work
settings, so the hashchange correction could not be visually retested. Supabase
connector access also disappeared; earlier rollback-only SQL evidence remains,
but later cleanup SQL has not run on actual Postgres. No deployed success claim.

Automatic approval review rejected the remote validator transfer adapter because
private derivative bytes/manifests and the specific compute destination were not
authorized. That adapter was not written. The app-owned validator package is
reviewable; server media remains hard-disabled. Full completion requires choosing
and authorizing the exact validator host/derivative processing, restoring Supabase
and hosting access, deployment/log/cache/abuse configuration, and current native
walkthroughs. Continue independent review and verification before requesting that
specific approval. Do not mark full M4.5/M4.6 acceptance complete.

### Implementation and evidence (2026-10-27 continuation, not release acceptance)

Owner reports the preceding trip-cover and selected Replay video steps complete.
This is owner-reported acceptance; it does not fabricate platform/build logs.

The active path is `apps/mobile/src/components/selected-share-screen.tsx` at
`/share`, reached from Atlas, scoped journey selection and Replay's separate
highlight-link action. It starts empty, keeps trip facts/media independent,
loads album pages explicitly without omission caps, previews the actual local
sanitized JPEG/MP4, retains date precision/inference and uses public gazetteer
centroids rather than photo/cluster GPS. Explicit confirmation persists a
protected chunked recovery job/capability before publication. Protected sharing
session is independent from AI and created only on explicit publication.

`owner-service.ts` implements request-bound receipts, single-flight publication,
unknown acknowledgement reconciliation, exact eligibility recheck, replacement,
expiry/revoke management, viewer reachability/compatibility and retained removal
intent. History deletion invokes durable removal preparation before evidence
purge, retains credentials for pending work, and retries on startup. A device
with no remote publication intent does not create a fictitious removal queue.
New confirmation cannot overwrite an unresolved operation; cancellation after
activation retains the published link for a separate Revoke.

The backend has private owner-serialized SQL reservation/activation/fence,
ownership checks, selected snapshot reads and per-request media/range membership,
write-once staging verification/retry and cleanup lease/ack functions. The
cleanup Edge function requires a separate scheduler secret. The unpublished
scaffold's unsupported PostgreSQL regex bound was corrected. Migration file
`20261027082206_m4_5_checked_share_protocol.sql` was created with the installed CLI.

The browser application is `apps/share-viewer` (React/TypeScript/Vite). It clears
fragment/history before reading content, uses body/header capability requests,
chronological precision-aware timeline, selectable configured Google map with
complete list fallback, media blobs, generic social metadata and no persistence
or analytics. Vercel header configuration and build-generated readiness descriptor
are reviewable. Parent Chrome QA observed desktop and 390×844 list fallback,
selection, chronology, inference and invalid initial link states; screenshots are
ignored `.review-artifacts/m45-viewer-{desktop,mobile}.png`. Same-document fragment
navigation exposed a stale-content bug; parent fixed and host-tested it, but
browser tooling became unavailable before physical reconfirmation. Copy success
UI was observed; external clipboard delivery was not established. Configured
Google map runtime has not been accepted.

Verification observed so far:

- Focused mobile selection/owner/lifecycle/legacy-share/provider/Replay suites:
  13 suites, 167 tests pass; subsequent never-published recovery adds one passing
  owner regression (owner suite now 7), and derivative stage/redaction 4/4 pass.
- Root `npm run check` passes (39 tests at implementation run; parent reports
  later 43 with additional structural media regressions), framework integrity and
  eval plumbing smoke. This makes no reconstruction-quality claim.
- Viewer TypeScript/Vite production build passes (18 modules). Mobile typecheck
  and lint passed after shared-contract resolver/type fixes; final rerun follows
  the parent's MP4 scrub integration. Scoped whitespace check passes.
- Parent real Postgres rollback-only run applied both migrations and synthetic
  lifecycle assertions: staging unreadable, same-request retry, digest conflict,
  owner B denial, replacement old/new version behavior, expiry CAS/exact boundary,
  revoke/fence and service-only grants, private bucket and direct storage metadata
  denial under anon and authenticated anonymous roles. Transaction rolled back;
  no durable remote schema/bucket/function was deployed. Reusable synthetic SQL is
  `supabase/tests/selected-share-lifecycle.sql`. Later cleanup additions still
  require equivalent real SQL execution; no actual concurrent HTTP/Storage run
  is claimed.
- Parent Deno 2.9.6 check passes owner/read entrypoints; HTTP/runtime synthetic
  contracts and structural parser tests pass. Parent's synthetic FFmpeg/ffprobe
  JPEG/H264+AAC validation passes structural/full decode after metadata scrubbing;
  this is synthetic host evidence, not native-device acceptance.

### Concrete remaining enablement/acceptance gates

Media publication is **hard-disabled in the Edge runtime**, because structural
MP4 parsing cannot establish full trusted decoded-media sanitization alone.
`apps/share-validator` is a reviewable app-owned Node/FFmpeg package with bounded
input, secret authentication, metadata/track rejection, full decode and hash-bound
attestation, plus synthetic fault tests. It is not deployed or connected.
Automatic approval review rejected wiring selected private media to a configurable
HTTPS validator: the specific payload/destination was not authorized. The owner
must choose and authorize the app-owned host and selected derivative processing
before the adapter can be completed; no egress workaround was attempted. The
README gives the required pinned package/image, resource, ingress logging and
verification recipe. Therefore AC-04/07/14/15 real remote media delivery remains
open and the full M4.5/M4.6 feature is not complete or release-ready.

Other remaining real-world gates: Vercel connection/hosting origin, restricted
Google browser key/map ID, Supabase live deployment configuration and log/cache
redaction, anonymous abuse protections, configured cleanup schedule, finite
operational tombstone/backup retention disclosure, HTTP Storage-byte/RLS/range
smoke and Android/iOS native codec/permission/restart/accessibility walkthrough.
No private evidence was uploaded, no source was staged/committed/pushed, and
unrelated dirty work was preserved. Only the previously existing AI proxy is
known deployed in project `fgmcnzxhbrtvjhtafort`.

The final focused mobile command passes 15 suites / 210 tests across selected
share selection, owner recovery, private derivative boundaries, removal fencing
and adjacent Atlas/Replay lifecycle behavior. Its expected closed diagnostics
are test output, not device evidence. The three required independent reviewers
all hit the shared account usage limit before inspecting any source, so no
independent-review result exists; preserve the review bundle for fresh sessions.

Review handoff still needs cleanup diagnostic refinement/fault tests separating
lease RPC, storage deletion and acknowledgement RPC (current worker uses a
single SHARE_OBJECT_DELETE stage), final AC-by-AC audit and mandated independent
review. Parent reports actual Deno check of all three Edge entrypoints passes;
HTTP contracts now 8/8 including media-deny zero-RPC and management/delete
diagnostic categories. No `done` status is set. Later cleanup SQL additions and
validator container still need their stated integration evidence.

### Continuation source diagnostic map (2026-10-27, before implementation)

| Runtime/source boundary | Operation/stage | Closed reasons and outcome |
| --- | --- | --- |
| `supabase/functions/_shared/share-protocol.ts` snapshot/date/reference validator | SHARE_PUBLISH / SHARE_SERIALIZE | INVALID_REQUEST failed; COMPLETE complete |
| `supabase/functions/_shared/share-runtime.ts` owner authentication and dispatch | SHARE_PUBLISH / SHARE_AUTH | ACCESS failed; UNAVAILABLE failed |
| same, RPC reserve/activation/reconciliation/management | SHARE_PUBLISH / SHARE_QUOTA, SHARE_ACTIVATE, SHARE_RECONCILE; SHARE_MANAGE / SHARE_REVOKE, SHARE_EXPIRY_UPDATE; SHARE_DELETE_ALL / SHARE_DELETE_FENCE | QUOTA, CONFLICT, FENCED, TERMINAL, UNAVAILABLE failed; COMPLETE complete |
| same, recipient token/envelope/media guards | SHARE_READ / SHARE_TOKEN, SHARE_SNAPSHOT, SHARE_MEDIA | INVALID_REQUEST, UNAVAILABLE failed; COMPLETE complete; public failure always unavailable |
| `apps/share-viewer/src/recipient.ts` fetch/schema/media/map | SHARE_READ / SHARE_TOKEN, SHARE_SNAPSHOT, SHARE_MEDIA, SHARE_MAP | START unchanged; INVALID_REQUEST/UNAVAILABLE/UNKNOWN failed; COMPLETE complete; SKIPPED skipped |
| `apps/mobile/src/share/owner-service.ts` recovery/readiness/auth/owner requests | SHARE_PUBLISH / SHARE_AUTH, SHARE_UPLOAD, SHARE_ACTIVATE, SHARE_ACK, SHARE_RECONCILE; SHARE_MANAGE / SHARE_REVOKE, SHARE_EXPIRY; SHARE_DELETE_ALL / SHARE_REMOVAL_QUEUE | closed existing mobile registry plus narrowly added stage reasons; no raw exception serialization |

Collection uses synthetic fixtures only: browser DevTools console filter `[Travel Life share diagnostic]` and generated local correlation; function stderr filter the same prefix. Keep headers, bodies, URLs/history, capabilities and provider errors out of collection. Current remote service has no deployed share function/bucket/migration; deployed logging/cache/abuse and phone codec evidence remain open. Android/iOS collection cannot be claimed until current package/build and transport are observed.

Research reused installed Expo image-manipulator, FFmpeg and secure-store; current Supabase official functions/auth documentation confirms server wrapper and service-role RPC boundaries. Browser uses React/TypeScript with Vite, retaining a list fallback when Google Maps is unconfigured/unavailable.

- 2026-10-26: created from the reviewed canonical M4.5 spec; resolves the
  documented delete-fence, write-once, capability-recovery, expiry and
  cancel-after-activation decisions before code begins.
