# Acceptance and source preservation

Every row is required for the implementation; none is claimed passed by this
specification. H = host behavioral/integration checks, D = native observation.
Use synthetic fixtures unless owner authorization covers the specific evidence.

| ID | Capability | Given / action / expected result | Evidence |
| --- | --- | --- | --- |
| AC-01 | CAP-1 | Ready Atlas: one title, Home and Settings visible; no separate About button | H,D |
| AC-02 | CAP-1,7 | Home → /welcome → View my Atlas and native Back: prior context, no onboarding writes/import/prompt/duplicate stack | H,D |
| AC-03 | CAP-1 | Fresh and returning automatic entry retain their existing routes | H |
| AC-04 | CAP-2 | Mixed inferred/manual/unlocated filtered fixture: count equals visible list; not inferred statistics | H |
| AC-05 | CAP-2 | Details: separate full-record metrics/manual count; unavailable country count is not0 or visited | H,D |
| AC-06 | CAP-2 | Details opens/closes without map displacement or source activity; focus restored | H,D |
| AC-07 | CAP-2 | Account/local fixtures: coverage copy matches current record; neither falsely claims device-only storage | H |
| AC-08 | CAP-3 | Compact Map has no full appended list; Timeline is one tap away with same filters | H,D |
| AC-09 | CAP-3 | Year/search/view changes retain applicable selection and camera, issue no source or render work | H |
| AC-10 | CAP-3 | Unknown-location journeys remain in count/Timeline with usable map-context link | H,D |
| AC-11 | CAP-3 | Many overlapping journeys: chooser scrolls, closes and selects correct preview without clipped actions | H,D |
| AC-12 | CAP-3,8 | Long history (synthetic1000 rows): bounded mounted rows and media requests; no eager full-history decoding | H,D |
| AC-13 | CAP-4 | Short and long histories: eligible Replay reachable without scrolling through journeys | H,D |
| AC-14 | CAP-4 | Filter Atlas then Replay: original authorized composition/order/music preserved; no silent filter-scoped render | H |
| AC-15 | CAP-4 | Add journey remains quiet/reachable; current disconnected/account recovery enforced | H,D |
| AC-16 | CAP-5 | Photo/video-only/missing-media/owner-only journeys: honest recognizable cover or fallback and valid actions | H,D |
| AC-17 | CAP-5 | Owner dates differ from observed dates: both labeled separately in expanded evidence | H,D |
| AC-18 | CAP-5 | Needs review / order uncertain / location unknown survive concise row presentation | H,D |
| AC-19 | CAP-5,7 | Preview → gallery → Back → Edit/detail → Back: context and selected journey preserved where valid | H,D |
| AC-20 | CAP-6 | Concurrent pending/review/update flags: one prioritized strip, no duplicated task primaries | H |
| AC-21 | CAP-6 | Known/unknown progress: measured bar or indeterminate state; no100% before durable verification | H,D |
| AC-22 | CAP-6 | Explicit pause stays paused; uncertain acknowledgement reconciles without blind rerun | H |
| AC-23 | CAP-6 | Update failure retains safe history; bootstrap failure never fabricates empty/new install | H |
| AC-24 | CAP-6 | Review action reaches actual affected items then correction; read failure has useful classified recovery | H,D |
| AC-25 | CAP-6 | Empty source, complete-no-journey and empty search/year show distinct copy/actions | H,D |
| AC-26 | CAP-6 | Missing map style/offline map: Timeline works, no developer configuration prose or fabricated basemap | H,D |
| AC-27 | CAP-6 | Optional updates invitation remains secondary and dismissible; no consent change from viewing Atlas | H,D |
| AC-28 | CAP-7 | Settings/Home/Replay roundtrips tested with retained and remounted Atlas: view/year/query/camera/list anchor survive | H,D |
| AC-29 | CAP-7 | Selected/anchor item removed: clear invalid selection, keep filters and nearest valid list position | H |
| AC-30 | CAP-7 | Sign-out/account switch/revocation during delayed media read: no old content/cache/context flash | H,D |
| AC-31 | CAP-8 |320/360/390/430 logical px plus landscape and wide layout: usable controls; ready360x800 map >=40% safe content height at100% text | D |
| AC-32 | CAP-8 |200% text, long titles, keyboard: no clipped essential text/actions;48px targets; footer restores after keyboard dismissal | D |
| AC-33 | CAP-8 | Screen reader, focus/selected semantics, modal dismissal and reduced motion work without color/motion dependency | H,D |
| AC-34 | CAP-8 | Map drag/pinch/cancel/unmount releases gesture ownership; list scroll and attribution remain usable | D |
| AC-35 | CAP-8 | Atlas variants match accepted theme; existing Replay/Share/Settings components retain defaults | H,D |
| AC-36 | CAP-5,6,8 | Synthetic boundary failures/stale completions: exact closed diagnostics, correlation continuity, sentinel redaction | H |

## Native task script

With a synthetic varied history, open returning Atlas, select a year, search a
journey, inspect photos, close preview, switch Timeline and scroll. Visit Settings,
Home and Replay in turn; return to the same exploration. Trigger empty filter,
offline map and failed preview fixtures. Repeat critical controls at200% text and
with screen reader/reduced motion. Run on Android and iOS; record device/viewport,
build, observations and artifact locations. Missing iOS/device evidence stays
pending. Do not clear the owner's current record to create a first-run fixture.

## Source claim preservation

| Source claim | Owning contract |
| --- | --- |
| Clutter below Settings; unnecessary totals | CAP-2; experience Details; AC-04–07 |
| Home correction and explicit landing return | CAP-1,7; navigation table; AC-01–03,28 |
| Whole-page buttons/layout/flow | CAP-3–8; all authored companions |
| Map dominant, compact view separation, unknown coordinates | CAP-3; AC-08–12 |
| Buried Replay; quiet Add journey; existing composition authority | CAP-4; AC-13–15 |
| Media-first preview, concise status, distinct evidence/owner dates | CAP-5; AC-16–19 |
| Navy/glass consistency, no global recolor or revived cartography scope | CAP-8; experience visual rules; AC-31–35 |
| Prioritized notices, actionable review, user-facing recovery | CAP-6; AC-20–27 |
| Continuity, large text, bounded work and honest acceptance limits | CAP-7,8; AC-28–36 |
| Diagnostic gate and privacy/correction/account preservation | Constraints; implementation map; AC-30,36 |

Wrapper-only party staging, repeated dialogue and offers to continue are excluded.
No production layout, device acceptance or reconstruction-quality claim is derived
from this document or root foundation checks.
