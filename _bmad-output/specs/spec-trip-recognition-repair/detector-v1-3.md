# trip-detector-v1.3 rules (decision 0023)

Status: owner-accepted direction (2026-11-22), not implemented. Replaces the
outcome rule and reason table in [detector-v1-2.md](detector-v1-2.md); Home
setup (H-1, H-2, H-4, H-5), evidence fixes and correction handling there stay
in force.

## Why

On the owner's phone, v1.2 produced 76 episodes: 24 Atlas, 38 Possible trips,
14 Hidden. 32 of the 38 Possible trips were `near-home` (outside the 20 km
Home radius, under 50 km) — errands and day outings, not trips. v1.2 made
Possible trips the default for anything that missed an Atlas condition. v1.3
makes Hidden the default and requires positive evidence for Possible trips.

## Home zone

- Inside an active Home's radius is Home; photos there are never trip support
  (H-3, unchanged). **Everything outside every active Home radius counts.**
  There is no separate away distance and no "near Home" band.
- The radius is per Home, a free number the owner edits in Settings:
  `> 0` and `≤ 300 km`. New Homes still default to 20 km.

## Outcome rule

Each episode (built as today) gets exactly one outcome, checked in order.
"Support" means own-capture photo units outside every active Home, as in v1.2.

1. **Owner decisions first** (unchanged): kept → `USER_CONFIRMED`; rejected →
   `REJECTED`.
2. **Atlas** (`AUTO_CONFIRMED`) when all hold:
   - a Home covers every episode day;
   - ≥5 support units with reliable location (≤1 km accuracy or unknown);
   - corroborated (below);
   - no time/location conflict, no owner veto.
   Frequent place is **not** a condition.
3. **Possible trip** (`SUGGESTED`) when it is not Atlas and either:
   - **owner-fixable:** ≥2 support units and (`home-not-set` or `time-conflict`); or
   - **strong trip signal:** ≥1 located support unit and at least one of:
     - **overnight:** support photos on ≥2 consecutive calendar days (no
       photo-free day between them — so two errands days apart that the
       episode builder merged do not qualify);
     - corroborated (below);
     - ≥5 reliable support units.
4. **Hidden** (`NOT_TRIP`) otherwise, with a stored reason.

**Corroborated** means ≥2 support places ≥1 km apart, ≥2 independently
*timed* sessions (precise-offset captures split by the existing >1 h
gap/>4 h span/displacement rule), or ≥2 distinct support places touched on
one and the same calendar day. It deliberately does **not** count merely
having support on 2+ *different* calendar days by itself — that would let
two single-place errands days or weeks apart, once the episode builder
merges them into one episode, corroborate each other and reintroduce the
exact noise this version exists to remove. (The `overnight` signal above is
the intended, narrower path for genuine multi-day stays: *consecutive* days,
not merely 2+ days somewhere in the episode.) Implemented as
`outcome-v1-3.ts`'s `corroborated`/`hasSameDayMultiPlace`; found by the
M10.9 benchmark while writing the "two errands a week apart stay hidden"
case — see the error playbook.

## Reasons

All failing reasons are stored; each card shows the first in priority order.

**Possible trips card**

| Priority | Code | Trigger | Sentence |
| ---: | --- | --- | --- |
| 1 | `home-not-set` | no Home covers these dates | Your Home isn't set for this time. |
| 2 | `time-conflict` | dates or locations contradict | Photo dates and locations don't line up. |
| 3 | `weak-location` | located support all >1 km accuracy | Photo locations are too imprecise to confirm. |
| 4 | `few-photos` | <5 reliable support units | Only {n} photos have a location. |
| 5 | `single-moment` | not corroborated | All photos are from one place and moment. |

`near-home` and `frequent-place` are retired.

**Hidden outings card** (lists only hidden episodes with ≥2 located support
units, i.e. ones that actually left Home)

| Code | Trigger | Sentence |
| --- | --- | --- |
| `brief-outing` | left Home, no strong trip signal | A short outing with only a few photos. |

Hidden but never listed: `no-away-evidence` (all inside Home),
`non-capture-source` (screenshots/downloads/messaging only), `no-location`
(no located photo, so leaving Home is unknown — GPS-less discovery,
decision 0019, covers these).

## UI

- **Hidden outings card (Atlas):** below Possible trips; collapsed by default
  to one muted line, "{n} hidden outings", with a chevron; no badge or accent
  colour. Expanded rows show period and reason, with "Review" opening the
  journey detail page (photos first). Keeping one records `USER_CONFIRMED`
  through the existing accuracy flow. Hidden when the count is 0.
- **Home radius (Settings → Home bases):** each Home shows its radius with
  an edit field in km. Before saving, a dry run shows the result, e.g.
  "24 trips on Atlas · 6 to review · 40 hidden". Out-of-range values are
  refused with a short message.

## Cross-cutting changes

- **Radius cap 50 km → 300 km** in: `configured_home_area` SQLite CHECK
  (two table definitions; needs a table-rebuild migration), the repository's
  save validation, `applyOwnerConfiguredHomeAreas`' own filter, the account
  history contract (`history-contract.ts`), and the Supabase sync guard
  (`20261028065628_m7_private_history_review_guards.sql`; a new migration,
  deployed only with owner approval).
- **CAP-6 same-trip** pairs only `SUGGESTED` (not `NOT_TRIP`) with Atlas trips.
- **CAP-7 "Everyday place" mapping** is superseded by the owner-set radius.
- `buildFrequentPlaceContext` is no longer an outcome input (it may stay a
  diagnostic).

## Open owner question

The episode builder (`buildV11Episodes`) still merges two blocks up to 10
days apart only when both are ≥50 km from Home (`allKnownPointsAreAway`).
Recommendation: switch it to "outside the Home radius" for one consistent
Home model, relying on the consecutive-days rule above so merged errands
don't become trips; measure with the benchmark. Alternative: keep 50 km as an
internal grouping constant.

## Diagnostic map

| Operation / stage | Boundary | Reasons |
| --- | --- | --- |
| `ATLAS_REBUILD` / `TRIP_QUALIFY` | v1.3 classification | existing codes plus `BRIEF_OUTING` for the new hidden path |
| `POSSIBLE_TRIP_REVIEW` / `HIDDEN_OUTINGS_LIST_READ` (new) | Hidden outings card read | `START`, `COMPLETE`, `DATABASE_BUSY`, `UNKNOWN` |
| Home save (`HOME_COMMAND_COMMIT`) | radius edit commit | adds `CONSTRAINT` for out-of-range radius |
| `HOME_RADIUS_PREVIEW` (new) | dry-run counts before save | `START`, `COMPLETE`, `DATABASE_BUSY`, `UNKNOWN` |

Exact operation names are confirmed against `app-diagnostics.ts` before code.
All events stay closed: no coordinates, radii values, place names or counts
finer than the existing buckets.

## Stories

| Story | Scope | Done when |
| --- | --- | --- |
| M10.9 | v1.3 outcome rule (pure), retired/new reasons, benchmark expectations | **Done** (2026-11-22): `outcome-v1-3.ts`, shared `outcome-geometry.ts`/`outcome-reasons.ts` (also refactored into v1.2 unchanged), 20 benchmark cases green, mobile `check` (jest + typecheck + lint) green. Not wired into `qualifyGraphJourneyWithClues` yet — that is M10.12. |
| M10.11 | Hidden outings card + repository read | **Done** (2026-11-22): collapsed card on Atlas below Possible trips, Review opens photos, Keep goes through the existing accuracy flow; `loadHiddenOutings`, `HiddenOutingsV13Section`, diagnostics, 11 tests. Returns empty until v1.3 is activated (M10.12). |
| M10.10 | Editable Home radius ≤300 km with dry-run preview | **Done** (2026-11-23): all five cap locations updated (SQLite migration 55 + real-SQLite tests, `homeAreaLabel` validation, `engine-v1-1.ts`, account history contract); Supabase migration prepared at `20261123120000_m10_home_radius_cap_raise.sql`, not deployed. Settings → Home bases gained a radius field and the "N on Atlas · N to review · N hidden" dry-run preview (debounced, privacy-filtered). `saveDirectHome`'s own hardcoded radius-preserving override (the real reason no owner-facing control existed before) is removed. |
| M10.12 | Adopt on device | **Built** (2026-11-23): `detector_policy` widened to allow v1.3; `compareDetectorPolicy` (aggregates-only v1.2-vs-v1.3 dry run, symmetric for a later rollback too) and a Settings → Trip detection screen that shows it and switches/rolls back, triggering an immediate rebuild. `rebuild()` branches on the stored policy; v1.2 stays the default until the owner switches. Found and fixed in review: CAP-3's clue pass kept gating against v1.2 after v1.3 went active (now skips while v1.3 is active, decision 0023's clue-free design); `setDetectorPolicy` now reverts on a failed rebuild. **Still needed before this counts as "done":** the owner's own on-device review of the real comparison numbers and explicit go-ahead to switch — this device dry run has not happened yet. |

Order: M10.9 → M10.11 → M10.12; M10.10 in parallel. v1.3 is not activated
before the Hidden outings card ships, so nothing is hidden without a way to
see it.

## Expected impact (unmeasured)

Possible trips should fall from 38 to roughly the few-photos, single-moment
and owner-fixable cases plus any overnight outings outside Home. Some former
`near-home` episodes may reach Atlas once the 50 km rule is gone; the owner's
radius is the lever. Only the device dry run (M10.12) establishes the real
numbers.
