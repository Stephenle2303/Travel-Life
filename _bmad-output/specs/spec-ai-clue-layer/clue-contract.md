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

**M11.1 persistence and production wiring (2026-11-20):** done, once
`import-record/repository.ts` was free. `migrationV49` adds the `travel_clue`
table (one row per clue, `subject_json`/`value_json` holding the closed
per-kind shapes unchanged — this repository never interprets them);
`loadClues`/`saveClues`/`updateClueStates` on `ImportRepository` are pure
persistence, and `deleteLocalHistory` now clears `travel_clue` too (clues
never outlive the private record, per clue-contract.md). A new
`qualifyGraphJourneyWithClues` (`clues/consumption.ts`) mirrors
`qualifyGraphJourneyV12`'s own parameter shape with `clues`/`correctedKeys`
inserted after `homeAreas`, and is now the production rebuild's sole
qualifier (`reconstruction/repository.ts`, replacing the direct
`qualifyGraphJourneyV12` call) — reading `travel_clue` and every effective
correction's `reviewed_support_json` once per rebuild. `namedPlace` is not
persisted or displayed yet (no UI reads it; CAP-4 has no place-clue producer
to populate it). Verified end-to-end against a real SQLite database (not
just mocks): a hand-inserted `photo-source` clue genuinely takes a journey
off `AUTO_CONFIRMED` on rebuild, and `deleteLocalHistory` clears it
(`scripts/atlas-sqlite.test.cjs`). No production behavior change today —
`travel_clue` is always empty until a producer exists.

Not yet done: `same-trip`/`capture-offset` consumption; every clue producer
(CAP-4/5/6) — nothing yet emits a real clue, so this wiring has no live data
to consume in production; the background pass (CAP-3); personal learning
(CAP-7); the eval engine (CAP-8). These need either a new on-device model or
new scheduling/eval infrastructure not yet started.

**Closed same day:** `candidate-projection.ts`'s `reliableReviewedJourneyIds`
check and `local-recovery-projection.ts`'s `confirmed()` now call the
clue-aware `qualifyGraphJourneyWithClues` (both default to zero clues when a
caller passes none, so the deferred preview path at
`projectCanonicalCandidateHistory`'s own default call is unaffected).
`reconstruction/repository.ts`'s `rebuild()` now loads `clues`/`correctedKeys`
once, before its local-recovery block, and passes them into both
`projectCandidateFromCanonical` and `projectLocalRecoveryGraph` as well as
the main per-journey loop — one clue read, three consumers, instead of the
main loop being clue-aware alone. Full mobile + root checks green; benchmark
unaffected (zero clues in production either way).

**Closed (2026-11-20):** `correctedKeys` (`reconstruction/repository.ts`) no
longer does raw string matching alone on a correction's
`reviewed_support_json` keys. An `F:` family key's own
`reviewed_family_snapshot_json` names the exact evidence member ids the
owner reviewed; `addCorrectedKey` now re-derives each member's *current*
key through the rebuild's own `baseline.families.keyForEvidence` and adds
that too, so a clue on evidence the owner already corrected is still
ignored after the evidence's duplicate-family grouping changes (an `E:` key
is similarly re-derived in case the unit has since joined a family). This
does not need the stricter, remap-throwing `resolveReviewedSupportKey`:
`correctedKeys` only ever makes a clue *less* usable, so a best-effort
expansion is the safe direction, unlike re-applying a correction itself,
which must fail closed. The raw key stays in the set too, for a legacy row
with no snapshot or malformed JSON (both fall back to today's behavior,
never throwing out of the rebuild). Verified with a new SQLite regression
(`scripts/atlas-sqlite.test.cjs`, "a correction keeps protecting its
reviewed evidence through family drift"): confirmed to fail (classification
drops from `AUTO_CONFIRMED` to `NOT_TRIP`) with the fix reverted, and to
pass with it in place. Full mobile `npm run check` and `npx tsc --noEmit`
clean.


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
