# Home first and journey integrity — BMAD discussion and diagnosis

Status: investigation, not a design decision or a runtime change.

The current Home bases flow depends on already published journeys. The earlier
[continuity and home setup specification](../specs/spec-trip-continuity-and-home-setup/SPEC.md)
already calls for Home selection without journey eligibility. The proposal is
to expose that independent selection before the first automatic trip build,
with multiple areas, an explicit effective period, and Skip for now. A name
alone does not define the geographic scope. Keep original media and owner
decisions, and do not send Home locations to an online lookup by default.

## Diagnostic map and collection

| Operation / boundary | Evidence to distinguish | Source |
| --- | --- | --- |
| Active history / local vs. account | Closed provider and consumer binding events from the current Android package and process | `account/record-context.ts`, provider binding |
| Journey reconstruction / continuity | Gap from previous observed day vs. first day of episode; time precision; corroborated Home context; protected owner decisions | `reconstruction/engine-v1-1.ts`, `canonical-core.ts` |
| Journey media / committed association | Destination evidence vs. inferred membership vs. explicit owner membership, and effective configured-home match | `reconstruction/engine.ts`, `canonical-projection.ts`, `reconstruction/repository.ts` |
| Journey media / preview resolution | Correct committed evidence but wrong rendered asset, or an unavailable asset | `photo-access/native-adapter.ts`, `account/media-adapter.ts` |

Inspect only the fixed app operation/stage/reason values for the current
`com.anonymous.travellife` process. That logger has no per-trip reason for an
otherwise successful reconstruction. For a read-only on-device check, keep the
SQLite database, coordinates, labels, dates, and identities on the phone; return
only fixed result codes and integer aggregates for the two reported cases. No
photo bytes, remote requests, history rebuild, or write to the owner's record.

## Synthetic reproduction on current checkout

- Fifteen consecutive civil days with three away photos per day split into
  groups of 11 and 4 days even with known away context, and into five three-day
  groups without it. The loop compares the new civil day with the first day of
  the entire previous group instead of its last block. The 2/10-day thresholds
  consequently act as episode length limits for day-only observations.
- One configured-home observation between away days does not split the sample
  alone, but adding another observation in that area weeks later produces a
  split. The corroboration is calculated across all dates by area instead of
  around the boundary under evaluation.
- In the shared canonical projection, a colocated in-scope Home photo can still
  share an automatic candidate with away visit support. With usable GPS the
  Home photo remained visit support. Missing GPS or GPS that failed the V1
  support threshold produced a time-only suggestion in separate controls.
  Gallery queries admit both visit support and membership; only visit support
  feeds automatic destination naming. These are possible pathways, not proof of
  the association or label used by the reported saved trip.

## Android findings

- The foreground app recorded Local history binding. The checked local
  snapshot had no configured homes. The separately checked saved account copy
  had two configured homes and no matching trip candidates. Do not infer
  that a saved account home is active in a local history view.
- The local snapshot has 13 boundaries between nearby Canada-supported trip
  candidates, with day-only evidence at both edges of all 13. Nine fall
  within two observed days of the prior trip's last day but more than two
  days after its first. Three of those even exceed ten days from the first
  day. This matches the reproduced continuity defect; the snapshot does not
  retain branch decisions or prove that every nearby trip was one holiday.
- The two candidates for the reported domestic destination/month contain
  25 media rows across the candidates. All are committed visit support with
  recorded GPS inside the destination region. No location-free or
  inferred-membership-only rows were found, and none matched the other
  reported region. The owner sees the unexpected image in both cover and
  album. The original photo's location was unavailable for comparison; the
  response did not distinguish missing metadata from not locating the file.
  Compare that exact asset with the committed metadata and resolved asset
  before changing the engine or viewer for this case.

Foundation check passed: 199 tests, pinned-framework integrity and eval
smoke. No application behavior or owner data changed.

Product quality and exact owner-case acceptance remain unmeasured.
