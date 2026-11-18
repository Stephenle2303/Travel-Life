---
id: SPEC-home-first-journey-integrity
date: 2026-11-09
status: ready-for-development
companions:
  - experience.md
  - reconstruction-and-media.md
  - persistence-and-rollout.md
  - diagnostics-and-acceptance.md
  - ../spec-lean-onboarding-and-navigation/SPEC.md
  - ../../../docs/product/design-system.md
  - ../../../docs/development/diagnostic-implementation-policy.md
sources:
  - ../../implementation-artifacts/home-first-journey-diagnosis-2026-11-09.md
---

# Home-first onboarding and journey integrity

[Decision 0017](../../../docs/decisions/0017-trip-merge-review-and-home-search.md)
supersedes pin-first Home selection. First-use setup and Settings need typed
place search and selection of a verified result before reviewing area and dates.
Coverage includes province, city, district, ward, and commune as applicable.

## Why

Travel Life currently asks owners to build a trip before they can describe where
they live. The first Atlas can therefore contain routine media. The second
Android also exposed nearby travel fragments consistent with a reproduced
civil-day grouping bug and an album whose visible images surprised the owner.
This change makes the first build aware of explicit Home areas and makes
continuity and media associations verifiable.

## Capabilities

- **CAP-1**
  - **intent:** Set Home bases during first-use setup.
  - **success:** A new user adds two independently dated Home areas or skips the step, then reaches the existing photo choice before the first automatic build.
- **CAP-2**
  - **intent:** Manage Home areas in the history they affect.
  - **success:** Owners can reopen, edit and remove Home areas independently of trip eligibility. Restart and overlapping rebuilds retain the latest saved intent and produce one verified current projection.
- **CAP-3**
  - **intent:** Keep routine media out of automatically inferred travel.
  - **success:** In-scope Home media contributes no automatic trip facts, cover, album rows or new automatic Replay selection. Authorized owner choices and source originals remain available.
- **CAP-4**
  - **intent:** Keep continuous travel together without merging separate holidays.
  - **success:** The daily multi-city fixture yields one episode. Corroborated Home returns, incompatible time, true gaps and protected owner boundaries retain their required distinctions.
- **CAP-5**
  - **intent:** Show the media committed to the trip and diagnose unexpected images.
  - **success:** Cover and album resolve verified evidence from the same active history and generation. A selected-item check distinguishes wrong association, metadata divergence and a wrong or unavailable asset.
- **CAP-6**
  - **intent:** Keep local and account Atlas and Replay coherent when reconstruction changes.
  - **success:** Matching canonical inputs produce equivalent qualified trips and media across both runtimes. Stale publication, ambiguous correction or Replay remaps, and incompatible clients fail safely.

## Constraints

- Home setup precedes first source processing and remains optional. Local use stays account-free. Preserve established-user entry, source choice and permission contracts.
- Home requires an explicit geographic area and effective period. Keep points, dates, labels and asset identities private under the active record. Home selection works without an online lookup.
- Compute Home filtering, episode membership and trip facts in the shared projection. Respect owner decisions, privacy, authorization and committed Replay selection.
- Reuse the current writer, checkpoint and scope fences. Attach classified, content-free diagnostics and verify exact durability before reporting success.

## Non-goals

- City-name-only exclusion, image-content location inference, inferred travel routes, automatic merge by country/month, and new location services.
- Broad threshold tuning, optional AI changes, original-media migration, new sources, and public sharing.
- A speculative fix for the reported wrong-image case before exact-item evidence identifies its failing boundary.

## Success signal

A fresh device can create two Home areas and open a first Atlas that omits their
automatic Home media. On a verified generation, a continuous multi-city episode
appears once across Timeline, map, album and Replay eligibility, while separate
holiday and owner-correction controls hold. The wrong-image incident has its own
exact-item reproduction and physical acceptance gate.

## Assumptions

- New Home areas default to a visible 20 km circle and accept month/year bounds. Existing Home geometry and exact saved dates retain their meaning.
- The continuity repair uses current runtime window sizes on adjacent observations. The older proposal's threshold differences are outside this repair.
- Time-only suggestions remain private review items and stay outside the default cover, album and automatic Replay.
- Account support for new manual-pin rows follows the compatibility gate in the persistence companion.

## Open Questions

- Which exact original asset corresponds to the unexpected image, and do its current metadata, saved evidence and resolved preview agree? This gates incident closure and any case-specific fix.
