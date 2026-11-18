# Experience and state boundaries

Reference: Living Atlas Settings/Trust panels and lean self-serve controls; one
primary action per state, real media context for choices, retained Back/scroll state.

## Account

Settings -> Account and sources -> email -> code -> account status. Local Atlas
continues without login. Account success means signed in, not uploaded or synchronized.
Email/code stay only in the current UI operation and credential adapter, never logs.
Use accessible email/one-time-code inputs, keyboard-safe scroll layout, disabled
busy actions, retryable fixed status and a clearly reachable return action.

States: disabled/config-unavailable, restoring, signed-out, requesting-code,
awaiting-code, verifying, signed-in, signing-out, blocked-local-session, error.
Changing email or leaving invalidates pending request/verification results; server
timeouts and SecureStore failures remain distinct safe diagnostics. Code request
cooldown is display assistance only; provider limits enforce abuse controls.

## Consent and migration

Account screen -> Enable history sync -> actual scope preview -> consent and transfer.
Show history/corrections (sensitive) separately from selected media. Existing local
record stays available and no cloud transfer starts just because OTP succeeded.
Transfer shows acknowledged counts, indeterminate discovery and partial/failure
states. Restart resumes acknowledged pages. Second-device restore stages its own
replica; a local record is not replaced or attached to another owner implicitly.

## Source and history selection

Sources lists this device, other contributed devices and later provider connections.
Each card shows observed dates, scanned/accepted/media counts, last success,
pending/error/paused/offline/reconnect state. No percentage of the owner's lifetime.
Local record and account record are explicit contexts; activating one never silently
changes the other. Account context is unavailable while signed out or session blocked.
Previously accepted locally unlocked account replicas remain readable offline;
network expiry alone does not erase them. Observed revocation, explicit signout or
account switching locks them. Already issued download URLs can remain usable up to
five minutes; offline copied bytes cannot be revoked remotely. Explain those limits
at removal and revalidate current scope before committing/exporting a new render.

## Conflict and removal

Conflicts show the actual trip/media and competing owner changes; keep the last
accepted result until owner resolution. Batch assignment has an exact visible set
and undo. Inference cannot dismiss the conflict or restore hidden/excluded items.

Pause/disconnect stops source reads and keeps imported content with explained policy.
Remove imported contributions previews affected history/media then confirms once;
account deletion requires fresh verification and explains delayed backup expiry and
offline-device limitations. Pending purge is not completed deletion. Original photos
at their providers/devices are untouched by these actions.

## Replay

Load committed manifest and recognizable trip cards first; fetch media lazily, retain
order and soundtrack. Report unsynchronized/missing media before rendering; no silent
soundtrack or photo substitution. Account cache supports source-phone-offline playback
when the service is reachable; airplane-mode playback requires local cache. Explicit
preview and native share sheet remain the only MLP export flow.
