# Acceptance matrix and preservation ledger

All fixtures synthetic. Distances below mean effective lower-bound distance;
base context, original capture-like photo metadata, corroboration, complete prior
scope and no routine/conflict are supplied unless the case says otherwise.
AC06 explicitly has no independent corroboration: its one-place/one-session
input cannot satisfy that auto gate, but may remain a nonpublished suggestion.
Tests must specify capture-unit/session facts, not count arbitrary source rows.

## Original fifteen cases

| ID | Fixture | Expected production decision |
| --- | --- | --- |
| AC-01 | 5 photos,90km,2 sessions,2 new corroborated places | score70; AUTO_CONFIRMED/SCORE |
| AC-02 | 20 photos,20km | NOT_TRIP/distance; no map/count/replay contribution |
| AC-03 | 8 eligible Japan photos,foreign to all known bases,independent corroboration | score>=75; AUTO_CONFIRMED/SCORE |
| AC-04 | 4 Singapore photos,otherwise high score | NOT_TRIP/photo-count; no profile override |
| AC-05 | 30 workplace photos55km; configured routine or eight qualifying prior weekday excursions | NOT_TRIP/routine |
| AC-06 | 10 photos60km,1 session,1 new place,1 day,no other bonus | score45; SUGGESTED/corroboration-pending; no primary Atlas |
| AC-07 | 100 photos at applicable secondary base | NOT_TRIP/distance |
| AC-08 | 150 routine café photos,configured/qualified routine | NOT_TRIP/routine |
| AC-09 | Exactly5 distinct eligible same-day photos | photo gate passes; other gates/score/profile determine outcome |
| AC-10 | Tokyo/Kyoto/Osaka regions over one far-away episode; each region corroborated,links satisfy<=72h rule | 1 trip,3 destinations; no invented routes |
| AC-11 | GPS-less capture-like photo strictly bracketed within24h each side,unique episode | attaches; can count photo; contributes zero location |
| AC-12 | No trustworthy geolocation | UNCONFIRMED/location; never AUTO_CONFIRMED |
| AC-13 | User rejection followed by more photos/reprocessing/new detector | negative grouping survives; rejected grouping not recreated |
| AC-14 | Identical final accessible library imported twice,enumeration reversed | same decisions/support/memberships; no duplicate episodes/questions |
| AC-15 | Manual trip3 photos | unchanged USER_CONFIRMED; no auto gate downgrade |

Original wording sometimes used NOT_TRIP for missing evidence. This contract keeps
unknown evidence as UNCONFIRMED so absence is not asserted as a negative fact;
both remain off the primary map. All numeric score examples remain unchanged.

## Extended deterministic cases

| ID | Boundary/failure | Required result |
| --- | --- | --- |
| AC-16 | Lower-bound exactly50km /49,999.999m | distance pass/fail |
| AC-17 | Center50km with unknown accuracy | fail automatic distance; policy margin applied |
| AC-18 | Five rows but one verified duplicate family | one photo unit; fail five-photo gate |
| AC-19 | Twenty burst copies30s,one location | no independent corroboration even if count differs |
| AC-20 | Five photos+two videos vs four photos+twenty videos | five-photo gate pass vs fail |
| AC-21 | One isolated far geotag among home photos | no auto trip; home photos excluded from count |
| AC-22 | Original EXIF vs native timestamp differs>24h /invalid date | conflict/unusable-time; no convenient timestamp selection |
| AC-23 | Original local time missing but native capture instant reliable | elapsed order usable; no local-day/routine-time bonus |
| AC-24 | Device timezone changes after import | decisions/observed local days invariant |
| AC-25 | Two support sessions across midnight | independent of session split; local-day bonus only if original days known |
| AC-26 | No base in era /only unknown country | UNCONFIRMED/base /zero foreign bonus respectively |
| AC-27 | Move A to B with explicit intervals | era-specific nearest applicable bases; currentB not retroactive |
| AC-28 | Two qualifying active bases | nearest lower-bound distance to either controls |
| AC-29 | One continuous90-day holiday,even withthree short excursions | cannot auto-establish a base withouttwo separated residence runs |
| AC-30 | Annual same-region holidays | not routine by recurrence alone |
| AC-31 | 60km commute without sufficient local-time/bracket data | suspected-routine UNCONFIRMED; high score cannot auto-promote |
| AC-32 | Routine stop inside otherwise qualifying holiday | routine support not counted; other destinations can qualify |
| AC-33 | Two silent days between far/foreign corroborated blocks | one episode if<=72h; no claimed return |
| AC-34 | Tokyo day1,Kyoto day6,no boundary evidence | uncertain relation; independently qualified blocks may remain separate; one optional merge question |
| AC-35 | Corroborated base-return between trips | separate even if gap short/country same |
| AC-36 | Isolated conflicting home geotag during holiday | uncertain link; no hard split or fabricated continuous pooling |
| AC-37 | Same-day multi-place observations with unknown order | one unordered episode if compatible; no asset-ID ordering |
| AC-38 | 45-day continuously supported far episode | one episode across work chunks; no30-day semantic split |
| AC-39 | 1000km in5min | conflict quarantine; no fabricated flight |
| AC-40 | Main supported destination30km plus one2000km outlier | fail main-away gate; no cherry-picked far destination |
| AC-41 | All gates,repeat domestic90km,2 sessions,2 places,span5h,novelty0 | score55; AUTO_CONFIRMED/DAY; explicit source-policy extension |
| AC-42 | All gates,repeat domestic90km,3 sessions,2 local days,span30h,one place | score50; AUTO_CONFIRMED/STAY; no overnight mandate for other paths |
| AC-43 | Source screenshot/download /unknown EXIF-less origin | excluded support /memory-only eligibility respectively |
| AC-44 | Source EXIF offset absent on Android | bridge retains null; no fabricated offset; native instant remains sourced |
| AC-45 | iOS cloud-only original | no network fetch; unavailable capture metadata excluded from auto counts |
| AC-46 | Country borders/islands/coastline resolver samples disagree | unknown country; no foreign bonus |
| AC-47 | GPS-less photo exactlyat anchor /competing episodes | no strict bracket inclusion /no automatic membership |
| AC-48 | Photo available after permissions revoked | no preview publication from stale async result |
| AC-49 | Same final inputs full vs incremental import | identical decisions/memberships/context,stable lineage |
| AC-50 | Owner edited support extends80%overlap butnot exactscope | preserve edit; pending scope review; no broadened automatic edit |
| AC-51 | Identity overlap tie/split/merge | new identity+lineage; no correction guessing |
| AC-52 | One affected component pending remap | pinned owner projection once; unrelated qualified trips publish |
| AC-53 | Crash/cancellation duringbuild/commit | previous orcomplete new generation; never partial |
| AC-54 | Evidence/correction/base revision changes after dry run | approval stale; no activation |
| AC-55 | Rollback after new owner edit | new edit survives; rollback publishes reconciled generation |
| AC-56 | Manual/confirmed trip unknown coordinates | Timeline retained; no map point at invented coordinate |
| AC-57 | Trip qualifies but one destination has isolated support | trip retained; that destination not plotted/countable/replayable |
| AC-58 | Suggested/unconfirmed rows exist in DB | absent from Atlas/Timeline primary/counts/replay query; optional review separate |
| AC-59 | Dismissed question on identical reimport | remains dismissed; no re-ask |
| AC-60 | Large unresolved backlog | <=3 priority questions visible; total workload still reported,not hidden in quality metric |
| AC-61 | Limited/selected library | configured bases usable; auto-base learning disabled; coverage truthful |
| AC-62 | Empty/near-empty result | sparse truthful state; cannot pass recall gate by showing nothing |
| AC-63 | Candidate exclusion changes C0 base/episode boundaries on C1 | UNCONFIRMED/context-unstable; no iterative self-promotion |
| AC-64 | AC01 explicit5photos:A09:00/09:02/09:03,B11:00/11:02;two new well-separated places | two sessions,two coherently corroborated places,score70; no4-hour DAY override needed |

## Explicit source-policy differences

| Source requirement | Selected contract and rationale |
| --- | --- |
| Unknown base requests setup | Unknown remains unconfirmed; strongly qualified date-scoped learned bases are usable, otherwise one optional era setup question |
| >=50km Haversine distance | Threshold uses observed medoid Haversine lower bound with explicit uncertainty margins; uncertain central50km does not qualify |
| >=70 required for AUTO_CONFIRMED | Exact score retained; DAY/STAY predicates add two named below70 paths after identical hard gates to recover repeat travel |
| Case6 SUGGESTED despite one-place/one-session evidence | Suggestion can await corroboration; automatic classification still requires it. The source's suggested eligibility and location gate otherwise conflict |
| <=44/disqualified => NOT_TRIP | Known negatives use NOT_TRIP; missing/contradictory evidence uses UNCONFIRMED |
| True return separates trips | Corroborated returns split; >10day sparse gaps form separate observed episodes without asserting return |
| Native screenshots/downloads/duplicates excluded | Known flags and conservative capture units exclude support; universal origin/pixel-duplicate recognition is not falsely promised |
| Countries/cities | Trusted local country resolution supported; Tokyo/Kyoto/Osaka fixture names are synthetic/owner labels; no production invented city service |
| Implement now/deliver code in pasted text | Current explicit request is finish planning; application implementation follows this contract as a separate delegated task |

These are recommended policy choices, exposed for review rather than silently
relabeling the original fixture outcomes. They do not authorize a live migration.

## Source preservation map

Source1 investigate/flow/pure rules -> delivery-plan.md and algorithm1-7.
Source2 gates/manual bypass -> algorithm2,4,6; AC01-09,12,15-21.
Source3 capture/session/multicity/routine reuse -> native-evidence.md; algorithm1-5,7.
Source4 exact score/status/store/query -> algorithm6; persistence.md; AC41-46,58.
Source5 all correction/reimport/dryrun/rollback -> persistence.md; AC13-15,49-55.
Source6 original15/boundaries -> AC01-64.
Source7 privacy/batching/verification/metrics/report -> native-evidence.md,
delivery-plan.md and persistence.md.
Latest owner direction low effort/complete plan -> CAP5,AC59-64,release measurements.
Wrapper-only content: role labels and implement-now wording superseded by the
current planning request; all substantive behavior retained or explicitly revised.

## Quality evaluation contract

Unit = labeled observed trip episode, with destinations and owner-action record.
Match predictions to labels one-to-one by labeler-approved episode/time/place
overlap, fixed before scoring. A false split creates extra predicted FP and a
false merge is a boundary error; also report boundary error separately rather
than allowing either to inflate recall. Unmatched true episode is FN.
Precision=TP/(TP+FP); recall=TP/(TP+FN). Zero denominator => not_measured.
Report all-trip recall separately from evidence-eligible recall; eligibility is
annotated from raw available evidence BEFORE running the candidate and cannot
exclude a trip merely because the new detector abstained.

Trip-action rate = eligible labeled trips needing any per-trip owner action to reach their
correct episode record / all eligible labeled trips. Count actions outside visible
review queue as well; report base questions and total actual actions per library
separately; base setup is measured separately and does not disappear from total
effort. Targets: precision>=95%,eligible-recall>=90%,trip-action-rate<=5%.
Report n,TP,FP,FN,confidence intervals,library/person slices,false split/merge and
unsupported destination counts. Targets are engineering acceptance goals; small
samples cannot establish population guarantees. No automated or invented human
labels. Owner-approved local private samples only; no raw trace/GPS/media in Git.

Sample existing predictions, new predictions, withheld candidates and no-detection
periods. Keep tune/holdout separated by library/person where available. This is
bounded delivery evidence, not a reinstated interview/market-research prerequisite.
