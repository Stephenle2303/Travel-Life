---
id: SPEC-m4-5-selected-share-snapshots
companions:
  - experience.md
  - publication-contract.md
  - acceptance.md
  - implementation-plan.md
  - diagnostics.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources:
  - ../../../docs/decisions/0005-interactive-journey-sharing.md
  - ../../../docs/decisions/0009-mlp-lifetime-reveal-and-replay.md
  - ../../../docs/decisions/0011-prototype-screens-as-product-ui.md
  - ../../planning-artifacts/epics.md
---

# M4.5 — Publish and manage selected share snapshots

## Why

The MLP's private Atlas and Replay need a deliberate selected-sharing loop. Owners must control exactly which facts and memories leave the device, see the recipient content before publication, and stop future link access without exposing their private library. M4.5 delivers publication and management; M4.6 consumes the contract in a browser viewer.

## Capabilities

- **CAP-1**
  - **intent:** Owners choose and preview a journey or lifetime highlight's facts and memories.
  - **success:** Selection starts empty; the preview shows exactly the selected sanitized content, precision, inference labels and media, including explicit Select all and Clear controls.
- **CAP-2**
  - **intent:** Owners publish only the exact content they explicitly confirm.
  - **success:** One confirmed request produces one complete immutable version; partial uploads and unacknowledged outcomes cannot appear as published success.
- **CAP-3**
  - **intent:** Anyone with an active unlisted link can access only its published content.
  - **success:** Snapshot and media reads verify the link and expiry; invalid, revoked and expired links disclose no private content or storage reference.
- **CAP-4**
  - **intent:** Owners manage, replace, expire and revoke their own published shares.
  - **success:** Another owner cannot operate the share; private updates leave it stable, republish requires a fresh preview, and acknowledged revoke blocks subsequent server reads.
- **CAP-5**
  - **intent:** Owners can request removal even while offline or deleting their local record.
  - **success:** A durable removal queue and required credentials survive until acknowledgement; the app accurately distinguishes pending removal, completed removal and lost control credentials.
- **CAP-6**
  - **intent:** Owners recover from unavailable media, interruptions and uncertain publication outcomes.
  - **success:** Recovery retains selection, reconciles the original request, and never silently omits selected content, duplicates publication or falsely claims success.

## Constraints

- Apply current visibility/exclusion, membership, correction and access rules before preview and again before activation. Photo location is not owner-presence proof; source date precision and inferred labels survive publication.
- Only explicit Publish authorizes selected remote snapshot/derivative uploads. Library access, Replay playback, video export and AI consent do not supply publication consent.
- Use owner-protected anonymous sessions, at least 128 random token bits, private derivative storage and checked reads. No originals, source IDs, EXIF, local paths, raw photo GPS, private history or service credentials enter the public schema.
- Default expiry is 30 days, displayed and adjustable. Revoke blocks future server access, including media; saved copies and screenshots cannot be revoked.
- Follow Living Atlas and its accepted Selected Highlight composition. Sharing never changes the private Replay composition or uploads background changes automatically.
- M4.6 owns browser interaction, map/list fallback and Create Yours. Public copy/native-share is gated on a configured reachable compatible viewer; M4.5 API tests alone do not establish a working recipient experience.
- Spec preparation authorizes no live deployment, anonymous-session creation or real-media upload. Replay device acceptance remains open separately.
- Every runtime delivery must satisfy diagnostics.md and the adopted diagnostic delivery gate: exact boundary/category logs, correlation, source lookup, safe collection and failure/redaction tests are required acceptance evidence, including mobile/backend/viewer handoffs.

## Non-goals

- Public profiles, feeds, recipient accounts, whole-library backup, cross-device owner recovery and new AI processing.
- Static-card M4.4 implementation, full M4.6 viewer implementation, Replay rendering/audio changes and revocation of exported files.

## Success signal

An owner on each mobile platform previews and publishes a selected synthetic highlight; a separate client retrieves exactly that version, private changes do not alter it, a second owner cannot modify it, and revocation denies subsequent snapshot and media reads. The M4.6 integration gate separately proves that the shared URL works without installation or recipient login.

## Assumptions

- Proposed engineering defaults, quotas, derivative formats, URL replacement and retention behavior are enumerated in publication-contract.md; they are configurable implementation assumptions, not measured limits or new user decisions.
- Existing anonymous-session storage can be reused only after checking its lifecycle against delete-all and remote-removal requirements.

## Open Questions

- No product decision blocks implementation. Deployment configuration, quota feasibility, protected credential retention and supported native derivative encoding require the implementation evidence listed in implementation-plan.md before production enablement.
