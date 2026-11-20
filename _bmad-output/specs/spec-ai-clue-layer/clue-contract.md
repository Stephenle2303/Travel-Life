# Clue contract (CAP-1, CAP-2)

## Implementation status (2026-11-19)

The record type and validity rules below are implemented as pure functions
in [`apps/mobile/src/clues/types.ts`](../../../apps/mobile/src/clues/types.ts)
and [`store.ts`](../../../apps/mobile/src/clues/store.ts): `ClueRecord`
(closed, discriminated by `kind`), `retractCluesForUnavailableEvidence`,
`supersedeCluesForProducerVersion`, `activeClues`, `ignoredByOwnerCorrection`,
`usableClues`, `independentClues`. 13 unit tests, `tsc --noEmit` clean.

**CAP-2 (2026-11-19, same day):** implemented in
[`apps/mobile/src/clues/consumption.ts`](../../../apps/mobile/src/clues/consumption.ts):
`applyPhotoSourceClues` (a `photo-source` clue can only lower support,
overriding `sourceOrigin` so the existing own-capture exclusion in
`qualifyTripOutcomeV12` applies unchanged — a `camera`/`imported` value is a
no-op since the engine already assumes that by default), `namedPlaceForSubject`
(attaches a `place` clue's name for display, never changes classification),
and `qualifyTripOutcomeWithClues` (the single entry point: filters to
`usableClues`, applies photo-source overrides, calls the unmodified
`qualifyTripOutcomeV12`, attaches `namedPlace`). `reconstruction/outcome-v1-2.ts`
itself was not touched — the integration lives entirely in `clues/`, so M10's
benchmark (54/54) is provably unaffected. 13 tests cover: zero-clue
determinism (result equals the clue-free rule exactly), a clue lowering a
trip off Atlas, a clue never promoting one onto Atlas (promotion classes
stay off by default, per the table below), owner-correction override, and
retraction.

Not yet done: SQLite persistence (the migration belongs in
`import-record/repository.ts`, being edited by a concurrent session when
this was built — see M10's delivery-and-diagnostics.md for the same
constraint); wiring `qualifyTripOutcomeWithClues` into the production
rebuild (`reconstruction/repository.ts`) and the `same-trip`/`capture-offset`
consumption rows below; every clue producer (CAP-4/5/6) — nothing yet emits
a real clue, so `qualifyTripOutcomeWithClues` has no live data to consume
in production; the background pass (CAP-3); personal learning (CAP-7); the
eval engine (CAP-8). These need either the same blocked files, a new
on-device model, or new scheduling/eval infrastructure not yet started.


## Clue record

| Field | Meaning |
| --- | --- |
| `clue_id` | Local opaque ID |
| `kind` | Closed: `place`, `photo-source`, `same-trip`, `capture-offset`, `landmark`, `sign-place`, `sign-script` |
| `subject` | Exact support signature: one evidence unit (`E:`/`F:` key) or a sorted set of units; never a generated journey ID |
| `value` | Closed code or offline gazetteer ID (country, Admin-1, city); never OCR text or model prose |
| `strength` | Closed: `weak`, `strong` (provider-defined, eval-calibrated) |
| `independence_key` | Provider + session/region key; two clues are independent only when keys differ |
| `producer` | Producer ID, model ID/hash, policy version |
| `inputs_revision` | Evidence revision, Home revision and correction revision the clue was computed from |
| `state` | `active`, `superseded`, `retracted` |
| `created_at` | Local time |

Storage: a private local table under the active record (schema migration in
M11.1). Never synced, exported, logged or shared. Deleting the record or
photo access deletes clues.

## Validity

- A clue is **retracted** when any subject unit is deleted, excluded by privacy,
  becomes unavailable, or its source access is withdrawn.
- A clue is **superseded** when its producer version changes or the subject's
  evidence changes; the producer recomputes lazily in the next pass.
- Home and correction revisions do not invalidate clues; they change how the
  rules use them.
- A clue whose value contradicts an owner correction on the same subject is
  ignored by the rules and stays stored for eval.

## Consumption by the rules

The M10 detector reads active clues at rebuild. Clues never bypass Home or
owner rules.

| Clue | Rule effect | Can raise to Atlas? | Can lower an Atlas trip? |
| --- | --- | --- | --- |
| `photo-source` = received/screenshot/download | Unit stops counting as support | — | No: review card "Some photos here may not be yours" |
| `photo-source` = camera/imported | Unit counts as own capture | Only via a promotion class | — |
| `place` (two independent agreeing) | Names the destination; `no-location` card shows the name and asks to confirm | Only via a promotion class | No |
| `place` (single or conflicting) | Stored; not shown | No | No |
| `capture-offset` | Adds a time-zone clue for naming (never names alone) | No | No |
| `same-trip` | Merge suggestion between the two subjects (decision 0017) | No | No |

**Promotion classes** (e.g. `no-location+two-place-clues`,
`single-moment+same-trip-with-atlas`) are named in policy, default off, and
enabled only through the gate in [eval-engine.md](eval-engine.md).

## Reasons and wording

Outcome reasons gain clue citations in plain words, from a closed list:
"Named from sign text and a landmark", "Some photos here may not be yours",
"Looks like part of your trip on 12 Mar". Copy follows the design system and
never states where the owner was not.

## Determinism

Rebuild input = evidence + Home + corrections + personal rules + active clues.
The same input yields the same output; rebuilds never run AI. With no clues
the output equals M10.
