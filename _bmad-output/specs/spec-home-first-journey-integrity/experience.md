# Home setup and trip inspection

## Entry and navigation

| Starting state | Behavior |
| --- | --- |
| Untouched install, Welcome primary action | Open Home setup, then the existing photo choice. Home setup makes zero native photo calls. The Welcome action acknowledges immediately. |
| Untouched install, Home skipped | Persist the explicit skip, then show photo choice. If the user also chooses its existing **Not now**, open Atlas without creating source intent. |
| Restart after Home save or skip | Resolve the committed Home decision and resume photo choice unless an existing intent or completed setup leads to Atlas. Resume an unfinished Home step without assuming a save. |
| Existing installed history, existing import intent or valid restore | Keep the current entry target and authorized resume behavior. Reach Home management through Settings. Existing Home rows stay independently manageable. |
| Welcome reopened from Atlas | Keep **View my Atlas** and its existing return context. Do not replay first-run setup. |
| Denied access, canceled picker or unreadable startup state | Preserve the saved Home choice. Use the existing scoped access/recovery state. A failed read is distinct from a fresh install. |

Deep links still follow their existing authorization rules. A direct entry cannot
implicitly save a Home decision or start a first import. An explicitly initiated
first build must resolve the Home step or an explicit skip. Existing account
restore and returning history paths do not require a new setup prompt.

## First-use screen

Use the current Living Atlas palette, typography, safe areas and access-choice
composition. The Welcome video stays the entry. The Home step adds one screen
with an inline area editor or sheet and returns to the same screen after each
area. Do not add a separate tutorial or a mandatory account action.

| Element | Default copy and behavior |
| --- | --- |
| Heading | **Where do you live?** |
| Explanation | “Photos taken near your Home bases are left out of automatic trips. You can add more than one. Your photos stay in your library.” |
| Scope | **Local history on this device** for first use. Settings names the active **Local history** or **Account history** before editing. |
| Area choice | **Add Home base** opens a private offline area picker. A pin or confirmed point defines the center. Show the actual boundary and **Within 20 km** for new areas. |
| Name | Required owner label, editable. A bundled search result can prefill a label after the owner chooses a point. Text entry alone cannot save. |
| Time scope | Require an explicit **All available history** or **Choose dates**. Date range uses inclusive months with optional From or Until. A displayed scope remains visible on the Home card. |
| Primary action | With one or more valid area drafts, **Continue** saves the set atomically and advances only after acknowledgement. With an empty list, **Add Home base** is primary. |
| Secondary action | **Skip for now** advances with zero saved drafts. If there are unsaved drafts, show an inline choice to keep editing or discard them and skip. |

Each saved card shows the label, radius and period. Two overlapping periods
are allowed and areas are evaluated independently. Preserve legacy radii and
existing exact-day bounds. Month input maps to the first or last valid day of
that month as appropriate. Reject reversed or invalid ranges before saving.
An owner-entered label never determines spatial membership.

Use bundled public geography for the default picker. Reuse an existing offline
map mode if it can center and render the chosen scope without provider requests.
Otherwise use a bundled overview and local point selection. Provide an equivalent
accessible point entry with explicit latitude and longitude plus confirmation of
the scope. Bundled place hints may center the picker. Do not invent a place or
its center when the bundle has no match. No device GPS permission, photo access,
remote geocoding or tile request based on the chosen center in this step. An
unavailable map keeps offline point entry and Skip usable.

## Settings and progress

- Keep **Settings → Home bases**. Owners can add a point directly even with
  an empty Atlas. Keep existing photo-backed area selection as a convenience
  when available and within the current photo scope.
- Edit name, area or dates and remove a Home from its own card. A removal
  confirmation explains that previously excluded media may reappear in inferred
  trips after rebuild. Existing media and owner decisions stay at their source.
- Acknowledge Save immediately. During rebuild show **Home saved. Updating your
  Atlas…** after the write is verified. A busy queue shows existing activity
  treatment. Use measured percentages only when a real denominator exists.
- If the save has not been verified, offer **Check again**. If the save succeeded
  and reconstruction failed, offer **Retry update** with the last eligible Atlas
  accessible. Never show an older cover or Replay as current for the new Home
  context. If review is needed for an owner decision, preserve the pending
  decision and direct the owner to the existing review flow.
- An incompatible Account history edit shows a fixed account-specific
  unavailable state with **Back** or an explicit **Switch to Local history**
  through the existing context switch. Never interpret a tap in one history as
  permission to mutate the other.
- Verify Android Back, iOS navigation, safe-area controls, large text, screen
  reader order, focus after validation, disabled duplicate submissions and
  resumed selection after backgrounding.

## Atlas and wrong-image recovery

Trip rows, map selection and gallery use the same committed trip generation.
If a photo cannot resolve or its identity fails verification, use the current
neutral unavailable treatment and keep other correctly resolved slots in place.
No image from a different slot or source replaces it. A changed generation or
scope invalidates in-flight covers and gallery pages. The owner can reopen the
trip under the current generation through existing navigation.

Time-only suggestions remain discoverable in private **Review memories** via
the existing uncertain-memory controls. They never serve as the default cover.
Keep the diagnosis opt-in and scoped to the selected item in the development
build. Ordinary trip surfaces show no debug metadata or asset identifiers.
