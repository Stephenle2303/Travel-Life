# Atlas states, actions and continuity

## Presentation arbitration (CAP-4, CAP-6)

One primary status strip at a time. Priority: authority/access invalidation;
unknown write acknowledgement; actionable failure; required correction review;
explicit pause; active work; pending changes; optional update invitation. Details
can list other actionable state without duplicating banners. Derive from real
controller/model state; never fabricate work progress or treat a timeout as rollback.
If only a subsection is affected, scope its error there instead of blocking Atlas.

| State | Visible treatment | Actions and retained content |
| --- | --- | --- |
| Loading record, no authorized snapshot | Neutral frame, Opening your Atlas… | No fake0 or journeys; preserve Home/Settings where authorized |
| Ready | Summary, selected view, no routine success banner | Replay when eligible; Add journey secondary |
| Active import/build with no history | Finding your journeys… / Building your Atlas… + progress | Details exposes Pause; no placeholder trips or premature Replay |
| Updating with usable history | Compact Updating your Atlas… | Keep safe history explorable; Replay only if existing authority/eligibility permits |
| Unknown acknowledgement | Checking your saved progress… | Existing reconciliation; Check again only when supported, no blind mutation retry |
| Paused | Preparation paused | Continue; Details can change supported access choices |
| Pending local changes | Updates ready | Existing catch-up action labeled Update Atlas; no fresh consent inferred |
| Correction review | Some journeys need review | Review opens affected items; choose one → existing Edit / Trip accuracy |
| Retryable update failure with prior history | Could not update. Your saved Atlas is available. | Try again as compact recovery; keep last authorized record |
| Bootstrap failure/no safe record | Could not open your Atlas | Try again is page primary; never reset storage or show false fresh setup |
| No source/skipped | Add photos to discover your journeys | Add photos primary, Add journey secondary |
| Complete but no supported journeys | No journeys found from these photos yet | Add photos; Add journey; evidence reasons in Details |
| Source revoked/restricted | Photo access changed | Review photo access using current authorization path; immediately remove invalid media |
| Map unavailable | Map unavailable. Your journeys are in Timeline. | Open Timeline primary within map recovery; Retry map secondary where supported |
| Filter contains no map locations | No map locations in this view | Open Timeline; do not imply map-provider failure |
| Search/year matches nothing | No journeys match this view | Clear search or All years, scoped to the active cause; no Add photos bait |
| Missing thumbnail | Neutral recognizable fallback | Row remains actionable; media unavailable differs from absent journey |
| Optional update invitation | Secondary dismissible prompt after usable reveal | Turn on / Later; never precedes or blocks main content, follows existing consent |

In a usable page, a scoped recovery control may coexist with Replay; style recovery
as contextual, not a second dominant full-width page primary. With no usable
history, recovery replaces Replay. Changes to evidence never silently widen source
access, restart paused work or re-enroll background maintenance.

Review action uses actual affected correction IDs/authority. If current model only
exposes a boolean, extend the existing read projection or provide a bounded
read-only affected-item query; do not send the owner to an unfiltered list with
instructions to guess. If affected items cannot be read, show classified recovery;
do not invent a review count or make unaffected journeys appear problematic.

## Navigation contract (CAP-1, CAP-7)

| Action | Destination and return |
| --- | --- |
| Automatic fresh/returning entry | Existing resolver unchanged: first use Welcome, returning Atlas |
| Atlas Home | Save current valid context, push /welcome; no permission/setup/presentation write |
| Landing View my Atlas or native Back | Return existing /history instance when possible; no duplicate Atlas stack |
| Settings | Save context; task Back → Settings; Settings Back → Atlas |
| Replay | Save context explicitly before handoff; existing playback/edit guards; Back restores Atlas |
| Add journey | Save context; use current local/account eligibility/recovery; return via existing flow |
| Marker/row | Select bounded preview; gallery Back → preview; preview Close → prior map/list focus |
| Edit/detail | Save context; existing detail/correction flow; restore valid exploration on return |
| Details/year/overlap sheet | Back closes top sheet first; page context remains intact |
| Root Back | Existing root behavior; never reveal onboarding accidentally |

Context includes view, year, normalized query, selected journey, provider camera,
local viewport where applicable, list anchor and offset. Store only in the scoped
in-memory owner/record session; no media URLs or sensitive route serialization.
Current AtlasExploration lacks query/list anchor: extend it rather than assuming
existing context already guarantees them. Avoid one-shot consume losing context
when the original route stays mounted; test both retained and remounted routes.

On publication retain user-controlled view/query/camera; do not steal focus or
reset to fit all after a gesture. A disappeared selection is cleared, not silently
reassigned. Retain an empty year filter with All years recovery. A removed list
anchor falls back to the nearest surviving chronological neighbor without jumping
to a different filter. Sign-out/account/record changes invalidate private context,
preview caches and pending loads before showing the next authority's content.
Cold launch restores only existing allowed entry/task state, not a gallery/modal.

Replay operates on its existing policy-visible committed input. Year/search are
Atlas exploration filters only; never substitute visible rows for composition
authority. Do not add a new filter-confirmation step or auto-render on entry.
