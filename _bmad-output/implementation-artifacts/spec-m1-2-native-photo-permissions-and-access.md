---
title: 'M1.2 Implement native photo permissions and access'
type: 'feature'
created: '2026-10-08'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9fa506fe0b960211cd50b42ae83166c2557600d7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/decisions/0003-library-access-default.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The production Import screen cannot yet access device photos. An owner needs a clear, private way to see the scope their device permits before travel reconstruction can begin.

**Approach:** Make broad photo-library access the primary import choice, enumerate only accessible media, and offer the system's limited or explicit selected-photo path. Show source scope and restrictions honestly on Import and the empty Atlas.

## Boundaries & Constraints

**Always:** Ask at the point of import; keep selection voluntary; recheck access on foreground return and before reading; distinguish full, limited, selected, denied, revoked, unavailable and incomplete scans. Show accessible counts as device-visible scope only. Keep photo access separate from optional cloud AI consent. Verify Android and iOS behavior on permitted physical-device samples when available.

**Never:** Treat a photo as proof of owner presence, claim complete lifetime coverage, upload or log media or precise location, scan a cloud account, silently widen permission, or persist evidence in this story. Do not replace the isolated synthetic prototype.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Broad choice | Owner taps full-library action | OS permission prompt, then paged accessible-media enumeration | Unsupported or blocked state offers selection |
| Limited grant | OS grants selected scope | Enumerate only that scope and label it limited | Manage selection only on explicit tap where supported |
| Selected choice | Owner opens system picker | Count only returned items as owner-selected scope | Cancel leaves prior state intact; missing asset IDs remain uncertain |
| Denial/revocation | Permission denied or changes in Settings | No further library query and no stale full-access count | Explain recovery without repeat prompts |
| Interruption/error | Query fails or app backgrounds | Partial count remains labelled incomplete | Recheck and restart safely on user action |
| Web or no media API | Unsupported runtime | Informative unavailable state | No simulated native access |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/components/mobile-screens.tsx` -- Trust, placeholder Import, and empty Atlas; replace Import with access choices and scope while retaining route flow.
- `apps/mobile/src/components/ui.tsx` -- production Living Atlas primitives and accessibility behavior to reuse.
- `apps/mobile/src/navigation/app-contract.ts` -- typed `/import` and `/history` routes; preserve these paths.
- `apps/mobile/src/app/_layout.tsx` -- app-level state owner if access scope must survive route changes.
- `apps/mobile/package.json`, `package-lock.json`, `app.json` -- install SDK-compatible native packages and declare only necessary photo/video and media-location permissions; native rebuild required.
- `apps/mobile/src/components/__tests__/` -- Jest/RNTL discovery location; use synthetic native-module mocks.
- `apps/mobile/README.md` -- device smoke procedure and pending evidence. `apps/prototype/` remains independent.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/package.json`, `package-lock.json`, `app.json` -- add Expo SDK 57 media library and image picker with matched photo/video, iOS purpose and Android media-location configuration; audit unrelated template permissions.
- [x] `apps/mobile/src/photo-access/` -- implement a narrow native adapter for permission inspection/request, paged accessible enumeration, limited-scope management, and explicit picker selection; do not use deprecated SDK 57 asset calls.
- [x] `apps/mobile/src/photo-access/` -- model transient scope, incomplete counts, denial, revocation, unavailable media and safe foreground refresh without retaining raw assets in UI state.
- [x] `apps/mobile/src/components/mobile-screens.tsx`, `src/app/_layout.tsx` -- deliver access choices, progress/coverage and recovery in Living Atlas; keep Atlas honest before evidence import.
- [x] `apps/mobile/src/components/__tests__/` -- cover every matrix row with synthetic mocks, especially no query without access, no duplicate prompt, revocation, picker cancellation and partial enumeration.
- [x] `apps/mobile/README.md`, `docs/project-state.md` -- document physical iOS/Android checks, observed results or pending status, GPS and cloud-only sample method, and M1.3 handoff.

**Acceptance Criteria:**

- Given a native development build and owner action, when broad read access is granted, then accessible photos/videos are enumerated without per-item selection and only a scoped count is shown.
- Given limited or selected access, when the owner continues, then the UI labels that restricted scope and never implies a whole-library scan.
- Given denial, revocation or an interrupted query, when the app resumes or the owner retries, then it checks current permission before reading and keeps unavailable or incomplete counts explicit.
- Given device access on each platform, when a permitted sample is tested, then the delivery record states actual permission, GPS and cloud-only observations; absent device access remains pending.

## Implementation Notes

Research basis: Expo SDK 57 `expo-media-library` uses `Query` and `Asset` accessors; root `getAssetsAsync` is deprecated and throws. Use `expo-image-picker` for deliberate selection, not broad enumeration. Android photo/video read scope and media-location permission require native configuration and a development build. Selected picker references may be temporary or lack a stable asset ID. Google Play acceptance of broad media permission requires a later distribution check.

## Spec Change Log

## Review Triage Log

| Finding | Verdict and evidence | Route |
| --- | --- | --- |
| E1: count may shift during offset paging | medium — Each page is a fresh query; an insertion or deletion can shift offsets, so a finished scan is not a stable snapshot. | patch: label the count as observed, not exact lifetime coverage |
| E2: limited picker failure marks an unstarted scan incomplete | low — `manageLimited` catch overwrites a prior completed count even when the picker fails before recount. | patch: preserve count status and recheck scope on failure |
| E3: library recount erases selected set | medium — `countAccessible` clears `selectedCount` on every recheck, including after an owner picker selection. | patch: retain selected-set observation across a same-scope recount |
| V1: app tests absent from CI | medium — `.github/workflows/foundation.yml` runs root checks only; this was already true for the M1.1 mobile and prototype apps before M1.2. | defer: pre-existing workflow gap |
| V2: provider foreground event untested | medium — Controller recount has a direct test, but no test emits `AppState` active through the provider. | patch: add provider-to-Import lifecycle test |
| V3: prototype web autoplay rejection untested | medium — Hero web playback is not covered by its existing tests, but belongs to the earlier prototype delivery, not M1.2. | defer: pre-existing prototype gap |
| B1: revoked becomes denied after restart | false — Session state intentionally has no durable permission history in M1.2; after restart there is no stale count, and denial recovery is the same. | reject |
| B2: permission request can finish after interruption | medium — `requestBroad` does not check its serial after async inspection or OS request, so it can apply a stale result. | patch: honor interruption token before applying/counting |
| B3: manage limited during count | medium — The management control remains available while counting and can race the old scan. | patch: disable or guard management during enumeration |
| B4: selected references discarded | false — M1.2 intentionally records only a session count; metadata import and durable references begin in M1.3, whose UI must make a new selection if necessary. | reject |
| B5: selected set lacks a `LibraryScope` variant | false — The UI separately states the owner-selected item count and explicitly says it is not a library count; `scope` describes library permission only. | reject |
| B6: picker shown on unsupported web | medium — The web adapter cannot open a native picker, yet Import renders its active button. | patch: suppress the native choice when unavailable |
| B7: unasked but cannot ask again | low — The controller skips a prompt for this representable state while Import still shows an action promising one. | patch: hide that action and explain Settings recovery |
| B8: granted plus `accessPrivileges:none` maps to full | medium — The mapping treats every granted response except limited as full, including an inconsistent `none`. | patch: fail closed on `none` |
| B9: equal timestamps and offset shifts | medium — Creation time is not a unique snapshot key, reinforcing E1's observed-count uncertainty. | patch: grouped with E1 wording |
| B10: query failure may mask revocation | medium — The query catch leaves the old full/limited scope until another refresh. | patch: reinspect permission on query failure |
| B11: prototype hero failure sticks across source change | medium — `mediaFailed` is not reset on source change, but the hero is prior prototype work outside M1.2. | defer: pre-existing prototype issue |
| B12: execution checkboxes remain open | low — The delivery record checklist has not yet been reconciled. The proposed fix edits this build's spec, so this review layer rejects it; completion bookkeeping follows presentation. | reject |

## Design Notes

The Import screen should show the decision first, then the device-visible scope and progress. A selected-photo result is a session observation until M1.3 builds resumable metadata import; count it without exposing thumbnails, filenames, URIs or coordinates in logs. Atlas remains empty until a later story creates evidence-backed history.

## Verification

**Commands:**

- `npm --prefix apps/mobile run check` -- mobile tests, typecheck, lint and Expo diagnostics pass.
- `npm run check` -- root foundation and eval smoke remain green.
- `git diff --check` -- no malformed patch whitespace.

**Manual checks:**

- Rebuild a development client and test full, limited/selected, denial and revocation on physical iOS and Android. Record sample GPS availability and cloud-only behavior privately; commit only aggregate findings. Inspect generated permission manifests. If devices are unavailable, mark those acceptance checks pending.

**Observed on 2026-10-08:** Mobile `npm run check` passed 28 Jest tests, TypeScript, lint and Expo Doctor 21/21. Root `npm run check` passed 20 foundation tests and eval-infrastructure smoke. `git diff --check` passed. Browser smoke at desktop and 390px phone width showed the web-unavailable state and empty Atlas. Independent review found and patched permission/interruption/coverage-copy issues; three pre-existing prototype/CI findings were deferred in `deferred-work.md`.

**Observed on 2026-10-09:** An owner-operated Android development build validated explicit picker selection, full device-library access, a finished scoped count of 298 device-visible items, permission revocation/foreground recovery, and limited selected-photo access. One picker-selected item lacked a stable library ID and was labelled as uncertain. No raw media or identifying asset data was recorded. Physical iOS behavior, GPS/cloud-only behavior, and installed Android merged-manifest checks remain pending.
