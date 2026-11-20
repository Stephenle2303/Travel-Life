# One detector (CAP-7)

Starts after CAP-3..6 pass the benchmark. Behavior-preserving except where a
benchmark case documents the change.

## Status (2026-11-19)

**Done:** steps 3 ("places and visits", unchanged by design) and 5 ("decide
once") for the Atlas surface — `reconstruction/repository.ts`'s rebuild now
calls `qualifyGraphJourneyV12` exclusively, sharing one prebuilt
`V12CandidateLookups` across the whole rebuild loop (added by the 2026-11-19
code review to keep this O(library size), not O(journeys × library size)).
`qualifyGraphJourneyV11` is no longer called from any production path —
confirmed by grep, it is now only defined (`canonical-core.ts`) and
re-exported (`repository.ts`), kept for CAP-8 rollback. The code review also
found and fixed two narrower instances of the same "two disagreeing
classifiers" problem outside the main rebuild: `candidate-projection.ts`'s
`reliableReviewedJourneyIds` check and `local-recovery-projection.ts`'s
`confirmed` check both still called v1.1; both now call `qualifyGraphJourneyV12`.
Step 2's frequent-place half is done (`buildFrequentPlaceContext`, now
keyed by journey identity rather than timestamp so a candidate can never
count itself, and indexing every place a journey touches rather than only
its first visit); its "owner's Home areas" half was already true
(`qualifyGraphJourneyV12` reads `homeAreas` directly, no separate
normalization pass needed).

**Not done:** step 6 for the Possible-trips surface's primary card-grouping
policy. `candidate-projection.ts`'s `projectCandidateTrips`/
`recognizable-travel-shadow-v1` policy still decides what the owner sees as
a Possible-trip card's grouping/boundaries; it does not read v1.2's
`SUGGESTED` classification (the two narrow "reliable" checks fixed above sit
beside this policy, not inside it). v1.2 is authoritative in
`reconstruction_trip_qualification` (what M10.3's "no silent loss" guarantee
covers), but the UI-facing Possible-trips feed has not been re-pointed at it.
This is the single largest remaining piece of CAP-7 and the right next
slice: replace `projectCandidateFromCanonical`'s default (non-`'recovery'`)
card source with v1.2's `SUGGESTED` journeys, reasons and `supportIds`,
keeping `'recovery'` mode on the old policy as a named legacy
path pending its own audit. The removals table below assumes that slice is
done; today only the rows marked (done) are complete.

## Target pipeline

1. **Normalize once** (`capture-evidence-v1.2`): families, provenance, instant
   trust, original day, configured Homes. One `TripDetectorEvidence` per unit.
2. **Context once**: the owner's Home areas (Forever or dated) and the frequent-place index
   (F-1). Immutable for the run. No learned bases, rarity index or C0/C1 passes.
3. **Places and visits**: `reconstructV1` runs once on travel evidence for
   stable place/visit IDs and correction anchors; its journey grouping is not
   used for unreviewed journeys. Rejection constraints apply during grouping.
4. **Episodes once**: one episode builder applies Home boundaries, owner
   boundaries and §5 links.
5. **Decide once**: the outcome rule produces AUTO_CONFIRMED (Atlas),
   SUGGESTED (Possible, with reasons) or NOT_TRIP (hidden, with reason);
   USER_CONFIRMED/REJECTED come from corrections. UNCONFIRMED is no longer
   produced; legacy rows read as SUGGESTED.
6. **Project**: Atlas, counts and Replay read AUTO/USER; Possible trips reads
   SUGGESTED with its shown sentence.

## Removals and replacements

| Current | Disposition |
| --- | --- |
| `qualifyGraphJourneyV11` re-normalization | (done) Unused in production; `qualifyGraphJourneyV12` is the only call site |
| Score-based selection (SCORE/DAY/STAY paths) | (done) Score kept as a stored diagnostic; outcome rule decides |
| Finding F11 (hardcoded `captureLike`/`origin`) | (done) `qualifyGraphJourneyV12` reads real provenance |
| `constructCanonicalV11Graph` `normalize` | Not removed; still used by the unused-in-production `mergeContinuousAwayJourneysV11` path. Low priority: dead code, not a behavior risk |
| Three learned-base definitions, `usualAreaContext` from learned places, `deriveTemporalContextV11` | Not deleted; `qualifyGraphJourneyV11`/`constructCanonicalV11Graph` still contain them but are unused in production. Deleting the code is a follow-up once rollback (CAP-8) is no longer needed |
| `projectCandidateTrips` grouping for Possible trips | **Not done** — see Status above |
| `mergeContinuousAwayJourneysV11`, `joinReasonV11` | Not deleted; confirmed still unused in production |
| `deriveRoutineVetoV11` (inactive) | Replaced for Atlas qualification by F-1; still present (unused) in `engine-v1-1.ts` |
| Second/third `reconstructV1` passes | Not changed; these build `graph`/`travelGraph` for places/visits/corrections, independent of which qualifier reads the result |
| `candidateTripPolicy` thresholds duplicated in detector | Not done; depends on the Possible-trips consolidation above |

## Guards

- Correction remapping (`applyJourneyCorrections`, `mapFinalCorrectionApplications`)
  keeps exact-support semantics and fail-closed errors unchanged.
- Journey IDs may change; correction applications bind to the final graph as today.
- Rebuild time on `scripts/benchmark-reconstruction.cjs` at its 3,000-evidence
  maximum, and on a 20,000-row lifetime benchmark variant, must not exceed the
  baseline by more than 10%. (The owner library holds about 19,000 captures.)
