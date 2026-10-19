---
id: SPEC-trip-continuity-and-home-setup
date: 2026-10-16
status: specified-execution-gates-pending
companions:
  - engine-contract.md
  - home-base-experience.md
  - development-plan.md
  - acceptance.md
  - ../spec-trip-detection-engine-v1-1/SPEC.md
  - ../spec-trip-detection-engine-v1-1/algorithm.md
  - ../spec-trip-detection-engine-v1-1/native-evidence.md
  - ../spec-trip-detection-engine-v1-1/persistence.md
  - ../spec-trip-detection-engine-v1-1/acceptance.md
  - ../../../docs/product/design-system.md
sources: []
---

# Continuous holidays and photo-backed Home base setup

## Why

Travel Life currently fragments recognizable holidays and offers too little
context for choosing a home. The owner reports four April 2024 journeys, two
September 2025 journeys and two February 2022 journeys representing three actual
holidays. The core experience must recognize continuous travel automatically,
exclude ordinary home life, and let the owner inspect photos and select a specific
home area with confidence. Repeated per-trip repair is a product failure.

## Capabilities

- **CAP-1**
  - **intent:** The team can explain why the current app separates an actual holiday.
  - **success:** Every boundary in the three reported groups has a same-generation local decision record identifying time precision, applicable context, rule and blockers; hypotheses are distinguished from verified private outcomes.
- **CAP-2**
  - **intent:** The owner receives one recognizable trip for one continuous holiday.
  - **success:** Qualified continuous episodes appear once across list, map selection, counts and album, including mixed metadata precision, repeated places and compatible same-day observations; genuine separate holidays remain separate.
- **CAP-3**
  - **intent:** The owner can inspect memories before choosing and managing the correct home area.
  - **success:** Journey selection opens a photo/video preview, a specific area is explicitly selected and reviewed before saving, and homes remain independently accessible for edit/removal after home photos disappear from trips.
- **CAP-4**
  - **intent:** The owner can trust saving and rebuilding to finish visibly and preserve the record.
  - **success:** Immediate acknowledgement and truthful progress lead to an atomically published generation containing the saved home revision, or an actionable retry state retaining the prior Atlas; busy, interrupted and stale operations cannot report false completion.

## Constraints

- This is an additive refinement of the canonical V1.1 contract, not a replacement
  score policy. Parent capability IDs and the frozen implementation intent remain
  unchanged. This spec's capability IDs are local to this spec namespace.
- One active episode pipeline governs publication. V1 and the pairwise merge may
  remain comparison baselines but cannot determine new primary trip boundaries.
- Use one date-scoped home/routine authority for grouping and qualification.
  Owner-configured homes are authoritative within their periods; no future home
  or candidate holiday may become evidence against that historical holiday.
- Retain canonical automatic-link thresholds, qualification and correction rules.
  If actual examples require a different gap rule, W0 must produce a versioned
  amendment and positive/negative evidence before engine activation. Do not
  silently pool uncertain fragments to satisfy these examples.
- All evidence, media, selections and diagnostics remain local. Public fixtures
  are synthetic; source IDs and precise coordinates do not enter Git, ordinary
  screen state, logs or model/provider requests. The isolated owner map selector
  may hold its chosen pin transiently; it never exports it.
- Never select a journey's first location as home implicitly. Saving applies to
  one explicitly selected geographic area and inclusive date interval.
- Preserve exact-scope owner decisions, media associations, lifecycle guards,
  shared SQLite serialization and previous complete generations. Legacy activation
  retains the existing concrete dry-run/approval/rollback contract.
- Apply Living Atlas layout, safe areas, accessible controls, paged local albums
  and contextual return. Home setup cannot depend on primary journey eligibility.

## Non-goals

- Hand-merging these three examples, destination/month deduplication, image-content
  location recognition, assumed travel routes or departure/return dates.
- New online address search, map-provider replacement, cloud processing or public
  sharing; Replay rendering remains outside this change.

## Success signal

After a verified rebuild, the three owner-labeled holidays appear as exactly three
automatic trips, with supported titles, combined eligible albums and consistent
map/list/counts. Selecting a home shows enough actual media and geographic context
to make the correct choice; its applicable home photos no longer seed automatic
trips. Negative repeated-holiday controls and preservation checks also pass.
The original 64 cases plus this acceptance matrix and device checks are required.
Product-quality metrics remain `not_measured` until labeled comparisons exist.

## Assumptions

- New homes default to a visible 20 km radius using the canonical macro-area
  scale; existing 50 km rows retain their radius and receive a review notice.
- Direct map selection supplies manual setup without requiring an online search
  service or an existing eligible trip. Typed labels are owner labels only.
- Unrestricted historical coverage is an explicit owner choice in confirmation;
  a journey's photo dates do not imply residence dates.

## Execution gates

The rules and work packages are specified. The actual blocker for each private
group remains unverified. W0 must establish whether the current canonical gap
policy can satisfy all three; if not, a policy amendment is a release dependency.
Offline regional geometry availability and target-device access are additional
execution dependencies. Neither fixture success nor completing this document
closes those gates. No application code or device state changes in this planning
delivery.
