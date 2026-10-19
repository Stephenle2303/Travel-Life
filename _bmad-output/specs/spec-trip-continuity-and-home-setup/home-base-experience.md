# Home base experience and data contract

## Entry and management

Atlas header `Homes` remains reachable without scrolling through journeys. It
opens a management screen listing every saved home independently of qualified
trips, with owner/detected label, effective period, area preview, Edit and Remove.
Multiple homes are separate areas; never average Sa Dec and Ho Chi Minh City.
Overlapping periods are allowed. Selecting an entry opens its own area/media
preview even if its originating journey no longer exists. Remove requires a
clear confirmation, preserves original media and schedules reconstruction.

`Add home base` offers `Choose from my photos` and `Choose on map`. Photo candidates
come from canonical observed macro areas, not only visible/qualified journeys.
Journey selection is a convenient entry into those areas, not the stored entity.
Paginate candidates and label their observed dates without asserting residence.
No candidate or existing home may disappear solely because home filtering removed
the source journey. Empty/limited/no-location states retain map selection.

## Journey-led selection

1. Tap a candidate journey: open a viewport-level preview or dedicated full-screen
   Home setup screen immediately. Preserve candidate-list offset and Atlas context.
2. Show supported destination, observed dates, map with observed areas, media count
   and a paged three-column photo/video grid. Use the existing bounded media reader
   (12 per page initially), permission checks and video badges.
3. Display selectable observed areas with thumbnails and supported names/fallbacks.
   The owner explicitly selects one, including when only one area exists. Never
   precommit the first coordinate, first visit or highest photo count as home.
4. Highlight the chosen area and switch the grid to geographically associated
   media. Other journey areas remain accessible for comparison. A separate
   `Location unavailable` group can be viewed but cannot establish the home center.
5. Opening a thumbnail enters the existing photo/video viewer; Back/Close restores
   the chosen area, grid scroll, loaded page and setup form. Safe-area Close must
   be fully visible; Android Back follows the same stack.
6. Continue to a confirmation screen showing the chosen area circle, label, scope,
   optional dates and a few representative associated thumbnails. Only Save writes.

Before an area is chosen, show the journey's permitted media; after selection,
state `Photos in this area` so the scope is clear. Counts never imply those photos
prove residence. Failure/revocation gives a visible media state and retry where
permitted; don't fall back to unrelated cached thumbnails or auto-select an area.
The owner may still save an explicitly chosen map area after viewing its scope;
missing media is not an implicit confirmation.

## Direct map selection

Provide a dedicated owner-facing map selector using the existing provider and
disclosure. A tap/movable pin chooses the center; draw the actual scope circle.
Offer center-on-an-observed-area as an offline starting point. Do not require
live device location permission or introduce address search. Offline tile failure
keeps observed-area choices usable; if neither geographic context nor a usable
map is available, explain the limitation and offer retry, not a blank-map save.
Map actions are accessible through equivalent observed-area controls where
possible. Manual pin is identified as owner-selected, not detected residence.

## Scope and effective dates

New entries default to 20,000 m radius, visibly described as `Within 20 km of this
area`. This is a chosen context radius, not an administrative border or GPS error
estimate. No radius editing control is required in this slice. Existing entries
keep their persisted radius and show it truthfully, including 50 km; show a quiet
review notice for legacy broad entries. An explicit edit can replace the area
with the new default after showing the changed scope. Never silently resize.

Form defaults to all available history, but the final confirmation requires a
visible explicit choice accepting that scope. Optional `From` and `Until` dates
are inclusive original civil dates; blank endpoints are open. A `Current home`
shortcut requires a chosen start date rather than applying today's location to
all history. Source journey dates are observations and cannot prefill residence
dates silently. Validate real YYYY-MM-DD dates and start <= end inline. Save is
disabled for invalid dates, no selected area, unacknowledged scope or active save.
Explain: `Photos in this area during this period will be left out of automatic
trips. Your originals stay in your library.` Explicit owner trip decisions remain
preserved, as required by the engine contract.

## Storage and repository boundary

Extend the existing configured-home storage, using a stable home UUID independent
of any generated journey ID. Store center (chosen observed medoid or manual pin),
radius, effective dates, optional owner label, origin (`observed-area`/`manual-pin`/
`legacy`), context revision and update metadata. Existing rows migrate unchanged;
legacy first-point selection is flagged for owner inspection, never retargeted.
The context revision changes on add/edit/remove in the same transaction as the
durable pending rebuild request. Record-specific deletion clears these records.

Repository responsibilities (names are implementation targets):

| API | Contract |
| --- | --- |
| `listHomeCandidates(cursor)` | Observed-area and journey summaries independent of primary qualification; opaque stable paging |
| `loadHomeCandidate(token)` | Revision-bound areas, dates and coarse map summaries, no raw support identifiers |
| `loadHomeAreaMedia(token, cursor)` | Local paged area-specific media, current permission and stale-result guards |
| `loadHomeBases()` | Persisted homes plus opaque edit tokens, including homes with no remaining source journey |
| `saveHomeBase(command)` | Idempotency key, selected area token OR explicit manual pin, acknowledged radius/period; typed persisted/context-revision result |
| `removeHomeBase(command)` | Valid current entry/version; atomic removal and rebuild request |

An observed-area token binds source/evidence revision, area support digest and
selection epoch. Revalidate it with lifecycle/permission inside the write gate.
Stale or missing selection returns `selection-stale`, reloads the preview, and
requires reselection; never choose a new representative silently. A label lookup
update alone need not invalidate unchanged geographic support. A manual pin is
validated for finite/range values in the isolated selector/repository boundary.

Existing `saveConfiguredHomeAreaFromJourney(displayId, ...)` must be removed from
the new UI path or become a compatibility adapter requiring an explicit area token.
Its current `ORDER BY visit.visit_id LIMIT 1` and fixed 50 km selection cannot
remain a production choice mechanism. Precise map selection state is transient
inside this owner control; other UI receives coarse anchors and opaque tokens.

## Save and progress states

| State | User-visible behavior |
| --- | --- |
| Preview loading | Skeleton/spinner, usable Back, no premature Save |
| Ready/invalid | Explicit area and scope; inline validation; nothing written |
| Persisting | Immediate `Saving home base...`; disabled duplicate action; accessibility announcement |
| Saved/queued | `Home base saved. Your history update is queued.` if another rebuild owns the guard |
| Updating | Phase text: preparing, organizing trips, updating Atlas; real processed/total counts only where available |
| Complete | `Home base saved. Your updated Atlas is ready.` and `View Atlas` after matching context revision is active |
| Save failure | Form/selection retained where valid; safe retry with same idempotency key |
| Rebuild failure | `Home base saved. Atlas could not update yet.` with `Retry update`; do not resave or claim completion |
| Interrupted/revoked | Prior committed Atlas retained; durable pending update resumes after valid reconnect; no stale completion |

Do not invent percentages or completion times. Leaving the screen does not cancel
a committed home save; show progress from the shared provider on return/Atlas.
Back before Save changes nothing. During save, navigation remains responsive;
operation state outlives the component. Rapid edits coalesce rebuilds while every
committed Home change is retained; completion refers to the newest revision.
