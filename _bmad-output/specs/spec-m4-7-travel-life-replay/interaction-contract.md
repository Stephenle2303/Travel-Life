# Replay interaction, drafts and automatic preparation

Derived from the 2026-10-23 owner direction. This companion supersedes older mandatory Prepare, screen-owned cancellation, ephemeral-only draft and delete-all-output-at-startup rules. The later memory-selection-contract.md also supersedes fixed total duration, all-items rendering and whole-artifact cache budgets. Other privacy/native ownership rules remain. The existing M4.7 delivery record is the sole implementation plan.

## User path

Atlas Replay opens the player with the active opaque scope and retained Atlas context. Entry immediately subscribes to or requests the current Replay. A valid cache hit begins playback; a miss shows a quiet `Getting your Replay ready` state, then starts playback without another tap. Use citrus for the primary action, restrained Living Atlas controls and accessible status announcements. No technical checklist or private approval wizard.

Playback offers play/pause, replay, Edit and Share. Back returns to the same Atlas year/view/camera. Edit is always optional and remains reachable during loading or recoverable failure; it does not wait for encoding. Share remains separate and requires exact chosen output review; long-sequence assembly and storage admission must pass before native dispatch. Repeated taps attach to one job. If reduced-motion/system accessibility policy suppresses autoplay, show a ready static scene list and explicit Play; document this accessibility exception rather than silently promising universal autoplay.

Only actual failure, empty scope, verified missing media or resource overflow interrupts the normal path. Show one fixed reason and a useful Retry, Edit or access-recovery action. Do not ask for fresh permission/import/reconstruction unless the actual source state requires it. Trip/media count alone never forces a smaller lifetime scope: curate memories and progressively prepare every trip chapter. Genuine storage/decode failures have fixed recovery; never relabel them sparse or skip a trip. Returning to foreground resumes eligible pending intent automatically; genuine failures do not enter an infinite retry loop.

## Minimal optional editor

An inline sheet/list above the retained Replay context displays trips and their attached media. Include/exclude trips; offer Replace/Add/Remove/Reorder as primary product labels, with Keep/Exclude/Auto retained internally; move trips earlier/later and chosen media earlier/later within their trip, with accessible move buttons. Keep existing List/album order until overridden. Useful real video snippets are preferred when supported; still fallbacks and technical omissions remain labelled. No empty-first reset here: private editing starts from the current private draft, unlike sharing.

Save each editor change locally as a recoverable working revision; Done atomically promotes that revision to the active private composition and triggers automatic regeneration. Returning later restores the working revision. Playback and the artifact key continue to use the last committed composition until Done; unsaved work never leaks into export. Back from the editor keeps the working revision without another confirmation dialog. If an automatic source/privacy update makes committed output unsafe, stop it immediately even while editing. Confirm only destructive Reset edits, which creates a new default draft revision; never erase evidence.

Draft changes affect presentation only. Hiding a scene in Replay does not hide a journey from Atlas or reject its evidence. Existing journey correction remains available as a secondary link and follows its own evidence contract. No synthetic labels/dates, soundtrack, clip trimming or arbitrary timing control in this slice. These editor controls are agent-selected defaults for the owner's broad edit request.

## Persistent drafts and identity

Introduce additive versioned tables through the established native schema owner, with an idempotent migration and forward-version protection. Do not hard-code the next schema number in planning: inspect the current schema at implementation time. Gate direct Replay reads with the existing schema initializer. No reconstruction or imported availability rewrite is required.

A draft stores a local UUID, format version, private-record namespace, scope mode/filter descriptor, active revision, working revision and dirty status. Child overrides store internal journey/member references, Keep/Exclude/Auto mode, explicit order ranks and validated clip intervals. Persist selector/model versions and chosen-manifest fingerprints for stable chapter reuse. Store stable local identity references only inside the private repository; expose session display tokens to components. Never store source URI/path, raw precise location, session keys, native errors or reviewed/export-approved flags. Keep DB content out of diagnostics, tracked fixtures and Git.

Use a single default draft per private-record namespace and normalized scope descriptor. Automatic mode reconsiders newly eligible candidates using the versioned selector while retaining all scoped trips; explicit inclusion mode renders the owner-chosen items. Keep/Exclude intent wins over automatic ranking. No promise to include all album media in pixels remains. An exclusion remains excluded if that same uniquely identified item later reappears. New unranked items follow the current Journey List/album order after explicitly ranked retained items. Hidden/unavailable entries keep a bounded local tombstone for safe recovery but are never rendered. Deleted private records remove their drafts.

Before each plan, resolve overrides against the current qualified projection and effective album membership. Reuse existing authoritative unique successor mapping where available; if a journey/media split, merge or ambiguous successor cannot be mapped one-to-one, withhold that override/item and show a small unresolved-edit count. Never match labels, dates or array positions, nor auto-include an ambiguous item. Owner resolution uses the editor. Ordinary Atlas reads do not change draft identity or render generations.

Every save uses compare-and-swap on draft revision in the common local serialization boundary. Concurrent edits cannot overwrite a newer draft; retain the working changes and expose a fixed conflict recovery. Capture active draft revision, scope/privacy/correction/source/lifecycle/AI-consent versions and selector/model/renderer/format versions in the immutable render key. A changed freshness key invalidates in-flight publication and sharing review; after current-policy revalidation reuse unchanged per-trip content fingerprints instead of re-encoding every chapter for a global revision alone. See timing-contract.md. No DB transaction stays open across decode/render/player/share operations.

## Service and background ownership

Create one Replay service independent of screen hooks and usable by the provider and native maintenance entry point. It owns ensureReady(scope,draftRevision), subscriptions, committed-draft updates, job cancellation, cache leases and a closed state snapshot. Screens receive labels/counts/status and a leased player handle, never raw source references. The renderer/controller is invoked through this service; remove the provider's direct unmanaged render path.

Committed import/reconstruction/correction/privacy/draft changes atomically mark affected scopes dirty; transient display refreshes do not. Coalesce changes to the latest committed revision and prioritize the actively requested Replay, then the default current scope. Prewarm only that default scope without a viewer; do not encode every filter. One process-wide native owner spans foreground and maintenance, with a durable lease/process-recovery boundary to prevent overlapping runtimes from encoding concurrently.

Reuse existing background-maintenance consent, scheduler and lifecycle queue. After successful reconciliation, mark Replay dirty and attempt bounded preparation only when the platform task runtime can safely load the renderer and has a cancellation/expiration boundary proven by S0. Do not mount React from the task or extend an OS deadline. If the runtime cannot safely encode, checkpoint dirty intent and resume automatically when a permitted runtime is available; track this as a platform limitation, not proof of completed background rendering. Expiration cancels native work, retains ownership until settlement and never publishes partial files. Scheduled encoding on both platforms is a required verification item; blocked capability remains an explicit unmet gate.

Navigating away only detaches the player/subscriber and releases its lease; service-owned preparation may finish without a screen. Explicit Stop cancels a requested job; Back is navigation, not implicit cancellation. App background pauses playback and releases the player. Encoding continues only under an authorized, proven native task lease; otherwise cancel safely, retain dirty intent and resume automatically on foreground. Permission loss/disconnect/delete-all immediately invalidate service output, active players and review. Never release serialization just because an abort was requested. No automatic sharing, cloud fetching or extra permissions.

## Verified private cache

Persist a registry of random private chapter cache names, digests, render/selector
keys, output metrics and last-use/expiry under backup-excluded storage. Never
persist original/source paths. Keep a bounded chapter LRU, initially <=192 MiB
of ready output with24h idle expiry, each default chapter <=32 MiB. Cache reuse
is per unchanged trip chapter; no two-whole-Replay-output assumption remains.
Active job/intermediates remain <=96 MiB separately; an exact long export needs
measured admission for assembled output, staging/copies and retained leased chapters.
Before admission require >=128 MiB current free space and sufficient predicted
remaining writes plus32 MiB reserve. Do not pretend long lifetime storage is
unlimited or apply an arbitrary32MiB limit to the assembled video. Evict only
unleased chapters and regenerate safely; never evict a native/OS-owned file.

Write output to a job-owned temporary file; inspect codec/streams/metadata/duration/size, hash it, then atomically register/promote only if all captured revisions are still current. A file/DB crash between steps leaves an orphan, never a playable result. Startup sweeps orphan temporary/unknown files after native ownership recovery; known ready chapter records must pass current-record/scope/key/digest/output checks before reuse. Missing/corrupt/expired/mismatched artifacts are invalidated and automatically regenerated when safe. Never restore export selection or approval. A cache hit does not bypass current native access or privacy checks.

Keep artifacts leased while a player/native consumer owns them. Evict unleased least-recently-used entries only. Cleanup waits for settlement; retries remain explicit durable cleanup markers. Disconnect/delete-all make files inaccessible immediately and clean all drafts/cache/leases after native handles settle. Source originals and the last committed Atlas remain untouched. Reverting the feature disables new job admission, retains readable source data and requires no destructive DB downgrade.

## State transitions

| Event | Service/player result |
| --- | --- |
| Replay entry + current cache | Validate, lease, ready -> playing automatically |
| Replay entry + miss or pending job | Join/request -> preparing -> rendering -> verifying -> ready -> playing |
| Repeated Replay or ordinary Atlas read | Join current job; no duplicate render/invalidation |
| Edit changes | Persist working revision; stop autoplay while editor is open |
| Done | CAS commit -> invalidate prior draft output -> regenerate -> play on return |
| Back from player | Release player/subscription; keep service-owned work/cache |
| Explicit Stop | Request cancel; terminal state only after native settlement |
| Background/task expiration | Pause player; continue only with proven lease, else checkpoint and settle |
| Foreground/relaunch | Revalidate draft/cache/dirty intent; resume automatically without restoring sharing approval |
| Privacy/access/source/correction change | Immediately withhold player/output/review; replan eligible current data |
| Failure or scope limit | Fixed reason plus Retry/Edit/recovery; retain draft and source record |
| Share | Separate empty-first exact selection/review, then explicit native dispatch |
