# Acceptance and evaluation

| Case | Capability | Scenario and expected result |
| --- | --- | --- |
| AC-01 | CAP-1 | First use with multiple dated Home areas, and first use with Skip. Both reach existing photo choice before any processing. Neither requires an account. |
| AC-02 | CAP-1 | Given one reliable trip and several uncertain outings, the first reveal shows observed places and the reliable trip's permitted cover. Playback uses only that trip's current eligible media. |
| AC-03 | CAP-1 | Given observations but no reliable trips, the map remains useful and Possible trips is discoverable. Zero observations produces the existing valid empty or access recovery state. |
| AC-04 | CAP-1, CAP-5 | Restore, restart, returning Welcome and background updates preserve entry and review state. The featured preview leaves existing Replay order, soundtrack and composition unchanged. |
| AC-05 | CAP-1, CAP-5 | Cover, playback or name unavailable, or scope changes during resolution. Use the authorized fallback or discard stale work. A mislabeled Vietnam regional title never reappears. |
| AC-06 | CAP-2 | An ordinary week with repeated home captures and a high-volume birthday at home yield no automatic or possible trips from photo volume alone. |
| AC-07 | CAP-2 | A coherent nearby outing with two independent observations can qualify. A single burst of similar photos does not provide equivalent corroboration. |
| AC-08 | CAP-2 | A plausible outing with limited corroboration stays possible and recoverable. Completely missing or contradictory location alone does not create a trip or map pin. |
| AC-09 | CAP-2 | One long multi-city holiday with mixed precision and a four-day photo gap stays together when independent away continuity is present. The same gap without sufficient evidence stays uncertain. |
| AC-10 | CAP-2 | Two visits to the same country remain distinct with a corroborated return or genuine separated episodes. An unrelated home photo from weeks later cannot create a return. |
| AC-11 | CAP-2, CAP-5 | Dated Home changes, moved Home, owner-kept nearby trip, recurring work place and photo-heavy away destination. Preserve exact overrides and avoid retroactive or self-learned routine. |
| AC-12 | CAP-2, CAP-5 | Input reversal, batching, duplicate copies and two equivalent native/account snapshots yield deterministic decisions and equivalent authorized projections. |
| AC-13 | CAP-3 | A valid Yes or No branch could qualify three distinct formerly withheld trips. The dated question appears once, with recognizable permitted evidence. |
| AC-14 | CAP-3 | One recovered holiday, two new trips, rename-only, removal-only, or an apparent gain caused by splitting an existing reliable trip. No first-reveal question appears. |
| AC-15 | CAP-3 | Existing explicit Home answer, uncertain dates, missing thumbnails, or simulation budget reached. Continue reveal without a duplicate or unsupported question. |
| AC-16 | CAP-3 | Yes or No with a current offer. Commit exact authority and display the verified added/removed trip diff. No does not make the candidate evidence automatically qualify. |
| AC-17 | CAP-3 | Skip, Not sure, interruption, restart, and returning from Settings. No unauthorized write and no replacement question for a consumed offer. |
| AC-18 | CAP-3, CAP-5 | Scope or evidence changes before answer, lost acknowledgement, exact retry, and conflicting Undo. No stale write, no duplicate revision, and truthful recovery. |
| AC-19 | CAP-4 | Possible trips uses a separate surface. Open, back and paginate without adding candidates to main trip counts, primary trip map actions, default Replay or shares. |
| AC-20 | CAP-4, CAP-5 | Keep publishes one authorized reviewed trip with exact support. Replay eligibility appears after durable verification. Not a trip remains excluded across rebuild. Closing makes no correction. |
| AC-21 | CAP-5 | New evidence improves an unreviewed grouping. An owner-confirmed split, rejection, place label, album assignment or Replay order is preserved, or routed to private review when exact mapping fails. |
| AC-22 | CAP-5 | Permission revocation, Local/Account switching, stale worker checkpoint and rollback. Old work cannot publish or restore deleted evidence, outdated consent or a different owner's data. |
| AC-23 | CAP-6 | Baseline and candidate run against the same versioned holdout. Report false trips, false splits, false merges, nearby-outing recall, abstentions, and owner effort separately. |
| AC-24 | CAP-6 | Optional AI sees the same candidate pairs and permissible evidence. Measure join, separate and abstain outcomes, with missing consent, malformed output and timeout preserving local behavior. |
| AC-25 | All | Fault and sentinel tests verify closed classification, a single action correlation, no private data in diagnostics, and accurate retry/durable state. |
| AC-26 | All | Isolated Android and iOS runs verify first reveal, sparse and full sources, Skip, optional question, accessibility, Possible trips and eligible Replay. Report platform acceptance separately. |

## Measurement and activation

1. Establish reviewed development and held-out sets before tuning. Include
   ordinary home and commute days, a nearby outing, continuous travel with
   sparse days, repeat holidays, several dated homes, weak/absent GPS,
   duplicated and shared media, mixed time precision, and owner corrections.
   Label the intended episode grouping, routine cases, allowable uncertainty,
   and relevant media separately. Use synthetic fixtures for executable
   controls. Use consented owner cases on-device only and record disagreements.
2. Score baseline and candidate on identical inputs. Record policy versions,
   case counts and per-slice denominators. False trips count routine/non-trip
   results in the main list. False splits count one reviewed trip fragmented
   in that list. False merges count distinct reviewed trips pooled into one.
   Report unreliable candidates shown in Possible trips separately, with
   nearby true-trip recall, abstention and missed-trip counts. Report review
   taps, question frequency, first-use time to a recognizable result, and
   owner-observed recognizable media. Keep internal policy scores out of UX.
3. Freeze the policy and comparison plan before held-out scoring. Require no
   regression in critical privacy, owner decisions, media binding or Replay
   scope. Require fewer false trips or false splits, neither category worse,
   no increase in false merges, and no reduction in nearby-outing recall on
   the reviewed holdout. Publish counts and limitations with the decision.
   If the set is too small or ambiguous to support the comparison, keep the
   candidate in shadow mode and gather more reviewed cases.
4. Compare optional AI with the improved local policy on the same ambiguous
   pairs. Score join/separate/abstain and invalid responses. Require fewer
   incorrect decisions with no added false merges or correction burden on the
   target cases. Measure delay and owner effort before considering product
   enablement. The local engine continues on denial, failure, or abstention.
   Media curation is a separate optional experiment with its own evaluation.

Run targeted local engine, SQLite, onboarding/reveal, media, correction,
Replay and worker parity checks. Run mobile tests, TypeScript, lint, affected
schema/worker fixtures and `npm run check`. Keep synthetic results separate
from reviewed cases and device observations. Product quality remains
`not_measured` until reviewed comparison evidence exists.
