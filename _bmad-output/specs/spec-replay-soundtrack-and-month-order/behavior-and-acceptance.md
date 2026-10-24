# Behavior and acceptance

## Soundtrack versus listening

Replace Meadow Thoughts with Happy Moments version 1.4, creator
Centurion_of_war. Source: https://opengameart.org/content/happy-moments . Selected
recording: https://opengameart.org/sites/default/files/piano1.4_0.ogg . Preserve
the source's CC0 provenance notice with the bundled recording.

Remove the separate Music on/off action that currently calls preparation.
Provide an accessible speaker overlay within the player, labeled Mute Replay
audio / Unmute Replay audio with visible state. Keep the useful native playback
controls; avoid a second competing mute control where the platform permits it.
The speaker button controls player mute only. It never strips soundtrack from
an export, invalidates an artifact, starts encoding or resets playback position.

Render exactly one background audio stream from the selected soundtrack. Drop
personal-video audio. Loop short music, trim long music to the actual rendered
video duration, and fade in/out without extending video or freezing clips.
Verify audio codec/stream count and duration, but also listen to an actual output;
mocked stream metadata does not establish audible sound. Do not silently export
a silent fallback when soundtrack preparation fails.

## Edit Replay and local audio lifecycle

Show Background music, the current track name, Choose audio file and Use default
music in Edit Replay. Explain the 5 MB limit before opening the system picker.
Here, upload means local file selection; no server upload occurs.

Check actual file size before accepting/copying an unbounded source. Refuse
unknown size, zero length and files larger than 5,000,000 bytes. Validate that
the selected file decodes to a finite positive-duration audio track; MIME or
extension alone is insufficient. Stage only the selected file in private storage
under an opaque filename. Picker cancellation, inaccessible/cloud-unavailable
input, copy failure or decode failure preserves the previous valid selection.
Display fixed error text without native errors or private paths.

Selecting a track changes an editor draft. Done commits the validated selection
and causes the next render to use it; Back cancels draft music changes. Restoring
default follows the same Done/Back behavior. Keep committed imported music across
Replay reopening and app restarts. A missing retained file offers reselection or
restore-default, without pretending it is still used. Remove abandoned/replaced
copies safely after active rendering no longer needs them. Disconnect/reset of
the private record must clear retained custom audio as well.

Artifact identity includes default-track version or custom-content revision,
not merely bundled/off or the display filename. Replacing a file with another
having the same name must invalidate the artifact. Async picker/render completion
after cancellation, unmount or a newer choice cannot overwrite current state.
Selected sharing revalidates private media and uses the committed soundtrack.

## Month/year ordering

Use the trip's available start year/month, ignoring day-of-month for presentation
sorting. A multi-month trip uses its start month. Valid known months sort ascending
by default; same-month ties retain stable Journey List-relative order. Missing or
invalid months remain in a stable final unknown-time bucket without fabricated
dates. Overlapping intervals and orderCertain flags do not prevent this sort.
Explicit newest-first reverses known month buckets but preserves stable ties and
keeps unknown times last. Preserve intentional saved direction; migrate legacy
defaults to oldest-first without altering evidence dates or corrections.

The planned chapters, rendered panel concatenation, editor direction, cache key
and selected export must agree. Neither SQL row order nor the order of a selected
memory array may override chapter order. Within-chapter editorial choices remain
unchanged by the trip sorting fix.

## Acceptance cases

- Given a new Replay, when rendered, then Happy Moments 1.4 is audible in preview and exported MP4 without original personal-video audio.
- Given playback midway through a video, when the speaker is clicked twice, then mute/unmute is immediate, position is retained, and no renderer call occurs.
- Given valid local audio of exactly 5,000,000 bytes, when Done is saved, then subsequent preview/export use that track and a reopened Replay retains it.
- Given a larger, zero-byte, unknown-size, inaccessible or undecodable file, when selected, then a fixed error is shown and the previous music remains usable.
- Given a pending choice, when the picker is cancelled or Edit Back is pressed, then committed music and preview are unchanged.
- Given an imported track, when Use default music and Done are selected, then Happy Moments replaces it on the next render.
- Given a replacement file with the same display name, when saved, then an old cached artifact is not reused.
- Given reversed input spanning 2023-12, 2024-01 and 2024-02 with overlaps/uncertain-order flags, when rendered by default, then chapters follow those months ascending.
- Given same-month trips and unknown times, when rendered repeatedly, then ties stay stable and unknown times remain last.
- Given an explicit newest-first edit, when saved, then known-month buckets descend in preview and selected export; Reset restores oldest-first.

## Implementation map and verification

Current source touchpoints: `apps/mobile/src/components/replay-screen.tsx`
(player/editor), `src/photo-access/provider.tsx` (preparation/export boundary),
`src/replay/types.ts`, `controller.ts` (artifact identity), `renderer.ts`
(asset resolution/audio mux/verification), `selection.ts` (chapter order), and
`src/reconstruction/repository.ts` (draft direction). Paths after the first are
relative to `apps/mobile/`. Inspect available system-file picker support before
adding a dependency; declare any native rebuild requirement in the delivery record.

Write meaningful failing tests for mute without render, edit commit/cancel,
5 MB boundaries, decode failure, stale completion, changed soundtrack cache and
month ordering. Cover provider-to-manifest and concat order, not only UI labels.
Run focused Replay/provider tests, typecheck, lint, Android offline asset export
and root `npm run check`. Require owner-operated audio/export evidence on Android
and iOS separately. Use the owner's established Windows PowerShell Expo workflow
for any later authorized device build; no port experiments as part of this spec.
