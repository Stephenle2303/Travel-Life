# Decision 0004: Background maintenance belongs in the MVP

Date: 2026-10-07 (Asia/Bangkok).
Status: accepted from the user's explicit instruction during epic/story review.

## Decision

Include automatic background photo-library maintenance on both iOS and Android
as required P0 MVP behavior. This supersedes decision 0002's foreground-only
update default and the earlier roadmap's deferred background maintenance.

After the initial import, process newly accessible and changed evidence in bounded
background work, update affected journey drafts, and preserve owner corrections,
manual journeys, exclusions and privacy settings. Keep foreground catch-up and
manual rescan as recovery paths.

This is photo-library maintenance, not continuous GPS tracking. No always-on
location permission or live route capture is introduced.

## Platform execution contract

Use the selected Expo stack's background-task API as the initial implementation
route, backed by the supported iOS/Android scheduling mechanisms. The operating
system decides when work runs; no immediate-photo trigger, fixed cadence or
force-quit execution guarantee is promised.

Register after an explained initial import, expose an automatic-maintenance control,
and report last successful check/update and restricted/pending states. Stop scheduling
when disabled, disconnected, permission is revoked or history is deleted. On app
resume, reconcile permitted evidence to recover missed background work.

Workers must operate from persisted state without a mounted UI, checkpoint before
expiration/interruption, avoid duplicate concurrent runs and defer unavailable
assets without repeatedly downloading originals.

## Data and inference

- Discover additions/changes using supported change signals and persisted asset
  identity/revision data. Where necessary, perform bounded paged metadata
  reconciliation; do not download/re-infer unchanged media.
- Include late historical additions, changed/deleted assets and permission-scope
  changes. Absence from a limited scope is not proof of source deletion.
- Recompute affected history neighborhoods and merge correction overlays with
  stable identity. Never silently replace confirmed/manual history.
- Local updates may proceed in background. Cloud AI requires consent explicitly
  covering automatic/background requests and the existing rate/budget controls.
  Otherwise queue AI enrichment for foreground use and retain the local result.
- Show an in-app new/updated-journey indicator. Push notifications are a separate
  optional preference, not a prerequisite for maintenance or added by this decision.
- No user-controlled public share artifact is updated or published automatically.

## Stories and verification

M1.5 handles scheduled incremental discovery; M2.6 handles history reconciliation
and update state. Existing correction, telemetry, regression and release stories
gain background-update checks. Verify real devices on both platforms, including
worker expiration, restricted scheduling, force-quit/relaunch recovery, changed
access, duplicate events and correction persistence.

A developer-triggered task verifies handler behavior, not guaranteed production
scheduling. Record both handler tests and observed scheduling behavior honestly.

## Sharing clarification

An exported card/image is sent through other apps. A shared web page is a hosted
browser-accessible snapshot addressed by a URL, usable without installing Travel Life.
The previous card story was P1, so sharing was not guaranteed in the P0 core.
This decision adds background maintenance only; the user's choice of journey-card
versus hosted-link MVP sharing is still pending.

## Sources checked

[Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)
documents platform-dependent deferred scheduling, force-quit limitations and
physical-device testing for iOS.
[Apple background maintenance](https://developer.apple.com/documentation/BackgroundTasks/refreshing-and-maintaining-your-app-using-background-tasks)
and [Android WorkManager](https://developer.android.com/reference/androidx/work/WorkManager)
describe the native execution routes.

No background worker or app implementation was built by this planning change.


## Sharing choice resolved — 2026-10-07

The user subsequently required interactive journey sharing by link and mentioned
possible video capability. Decision 0005 resolves the earlier pending choice.
Background maintenance never auto-updates these deliberately published snapshots.
