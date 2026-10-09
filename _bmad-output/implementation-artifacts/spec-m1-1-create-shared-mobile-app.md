---
title: 'M1.1 Create the shared mobile app'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9fa506fe0b960211cd50b42ae83166c2557600d7'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/docs/decisions/0009-mlp-lifetime-reveal-and-replay.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Travel Life has planning, evaluation infrastructure, and an accepted
MLP contract but no mobile runtime. M1.2 through M5 need a shared iOS/Android
application where a person can understand the private product, begin an import,
and later view their travel history without an account.

**Approach:** Add an isolated Expo/React Native/TypeScript app at `apps/mobile`
using Expo Router. Deliver the first navigable Trust → Import → History flow and
the repeatable local development, test, type-check, lint, and diagnostic commands
that later stories will use.

## Boundaries & Constraints

**Always:** Keep the app shared across iOS and Android; use the Expo-supported
dependency versions for the generated SDK; explain local/private-first intent on
the Trust screen; make History accessible without email, authentication, remote
services, AI processing, or photo permission; retain the existing root planning
and evaluation package unchanged; record physical-device evidence honestly.

**Never:** Request, simulate, or store photo-library data in M1.1; add SQLite,
media-library, image-picker, background-task, map, backend, analytics, or video
dependencies before their owning stories; claim that a simulator or build command
proves physical iOS/Android behavior; turn the empty History state into an inferred
travel record.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| First launch | New app with no imported record | Trust screen explains private local history and offers Continue | No permission or network request occurs |
| Continue | Owner selects Continue on Trust | Import introduction opens and explains that access will be requested later | No photo enumeration occurs |
| Explore empty history | Owner selects View history before import | History opens with an honest empty state and a way back to Import | No account or fabricated journey is required |
| Invalid deep route | Unmatched Expo Router path | Router displays a recoverable not-found screen with navigation home | App remains usable |

</frozen-after-approval>

## Code Map

- `package.json` -- existing root-only framework/eval scripts; do not merge mobile
  runtime dependencies into this package.
- `AGENTS.md` -- MLP, privacy, evidence, and platform constraints for every change.
- `_bmad-output/implementation-artifacts/epic-1-context.md` -- compiled M1 rules
  for the mobile foundation and later import stories.
- `apps/mobile/` -- new standalone Expo application package and lockfile.
- `apps/mobile/src/app/` -- Expo Router routes. SDK 57's standard `src/app` root
  keeps all route files separate from test files and matches the accepted prototype.
- `apps/mobile/src/components/` -- production-owned Living Atlas primitives and
  the Trust, Import and empty-Atlas screens; reuse the prototype's visual system,
  never its synthetic data, state or media.
- `apps/mobile/src/navigation/app-contract.ts` -- typed route names and local
  navigation helpers, keeping screen components free of route-string duplication.
- `apps/prototype/src/components/ui.tsx` -- visual reference only: copy palette,
  tactile pressed/focus and reduced-motion patterns into production-owned code;
  do not import across packages.
- `apps/prototype/package.json` -- proven SDK 57 family and Jest setup reference;
  omit its video, imagery, maps and prototype-only dependencies.

## Tasks & Acceptance

**Execution:**

- [x] `apps/mobile/` -- generate the official Expo SDK 57 default TypeScript/Expo
  Router app using `--no-agents-md`; retain its separate lockfile and keep the root
  foundation package independent.
- [x] `apps/mobile/src/app/`, `src/components/`, and `src/navigation/` -- replace
  generated examples with a small stack flow: Trust, Import, user-facing empty
  Atlas, and a recoverable not-found route. Keep state local and route names typed.
- [x] `apps/mobile/src/components/ui.tsx` -- establish production-owned Living
  Atlas primitives: the accepted palette, matte panels, inset borders, type scale,
  visible focus/disabled/pressed states and reduced-motion-safe feedback. Decorative
  texture may not imply a map, evidence or a journey.
- [x] `apps/mobile/package.json`, TypeScript, and ESLint configuration -- add
  Expo-compatible dev-client, Jest/React Native Testing Library, type-check, lint,
  test, Expo doctor, Android development-build, and documented iOS development-build
  commands. Install native Expo packages with `expo install`.
- [x] `apps/mobile/src/components/__tests__/` -- prove Trust → Import → empty Atlas,
  direct empty-Atlas entry, typed navigation and the no-permission/no-account/no-fetch
  boundary. Keep tests outside the route directory.
- [x] `apps/mobile/README.md` -- document Windows setup, start/test/check commands,
  Android device development-build steps, and that an iOS physical build requires
  EAS or macOS/Xcode access rather than being claimed from this workspace.

**Acceptance Criteria:**

- Given a fresh checkout, when a developer follows the documented mobile setup,
  then the Expo app starts and its type-check, lint, Jest, and Expo diagnostic
  commands can be run independently of the root framework checks.
- Given the Trust screen, when an owner continues, then Import is shown; when they
  choose Atlas, then an honest empty Atlas state is shown without login,
  permission prompt, network call, or travel claim.
- Given Android and iOS device access, when a development build is installed,
  then the same Trust → Import → Atlas flow is manually smoke-tested on both;
  unavailable device evidence is recorded as pending rather than passed.
- Given the established root repository, when mobile dependencies are added, then
  the root `npm run check` continues to pass and no sensitive data, secrets, or
  personal media is added to source control.

## Implementation Notes

Planning decision: adopt Expo's SDK 57 default TypeScript/Router template with its
standard `src/app` route root. The production app may borrow the established Living
Atlas visual system but has no prototype dependency. Native photo access, persistence,
background scheduling, real maps, replay, and sharing stay with M1.2+.

Research found that the SDK 57 default template includes Expo Router and TypeScript;
Expo Router tests require test files outside the route directory and React Native
Testing Library 14+. `expo-dev-client`, `jest-expo` and test dependencies are added
with `expo install` so versions remain SDK-compatible. The default template is chosen
over blank (no Router) and bare-minimum (premature native directories).

Implementation created `apps/mobile` with Expo SDK 57, `src/app` routes and a
separate lockfile. The user-facing Atlas route remains `/history` internally to
retain the original history contract while all visible copy says Atlas. Mobile
checks passed: 5 Jest tests, TypeScript, Expo lint and Expo Doctor; the root
foundation check also passed. Metro reached its local waiting state during web
verification. Windows DevTools fell back after its cache directory ACL warning,
but the Metro server and browser flow remained usable. No Android/iOS device or
toolchain was available, so physical development-build smoke evidence is pending.

## Spec Change Log

## Review Triage Log

| Review source | Finding | Severity | Disposition | Reason |
| --- | --- | --- | --- | --- |
| Blind hunter | README instructed developers to start a second Metro server after `npm run start`. | medium | patch | Document one start path and use the running server's target controls. |
| Blind hunter | Fresh-checkout setup used `npm install` despite the committed lockfile. | low | patch | Use `npm ci` for reproducible installation. |
| Blind hunter | App config has no explicit package or bundle identifier. | false | reject | M1.1 documents local development builds, not a configured EAS or store handoff; Expo's default development identity is sufficient while device evidence remains pending. An owned identifier needs a later release decision. |
| Blind hunter | README implied an EAS iOS path without EAS configuration. | medium | patch | Restrict the documented path to macOS/Xcode and explicitly say EAS is not configured. |
| Blind hunter | Template icons and splash artwork are not bespoke Travel Life branding. | low | reject | M1.1 requires the in-app Living Atlas foundation, not a new bitmap brand-asset project; no physical build is presented as completed. |
| Blind hunter | Template LICENSE misattributes project-owned code to Expo. | low | patch | Remove the template-only package license pending a repository-level licensing decision. |
| Blind hunter | Default-template dependencies include unused Expo packages. | low | defer | They are SDK-template dependencies, not feature additions, and package pruning needs a dedicated dependency audit before M1.2. |
| Blind hunter | Template reset utility can delete the new app source. | medium | patch | Remove the unused destructive template script. |
| Blind hunter | All navigation used `push`, including Back controls. | medium | patch | Use `replace` for Back and `dismissTo` after a not-found recovery. |
| Blind hunter | Direct screen tests did not exercise real Expo Router transitions or unknown-route resolution. | high | patch | Add a route-tree registration test and verify the full production flow plus an unknown route in the browser. |
| Blind hunter | Reduced-motion preference initially allowed motion before the asynchronous query resolved. | medium | patch | Default the unknown preference to reduced motion and add focused coverage. |
| Verification-gap reviewer | The production file router was not covered by the owner-flow tests. | high | patch | Same route-tree registration test and browser verification as the blind-hunter finding. |
| Verification-gap reviewer | The not-found return action was not asserted. | medium | patch | Press it and assert recovery uses the Trust route. |
| Verification-gap reviewer | Reduced-motion behavior lacked observable test coverage. | medium | patch | Add a focused test for the preference-safe default and pressed feedback. |
| Edge-case reviewer | A reduced-motion owner could press before the preference lookup resolved. | medium | patch | Same safe reduced-motion default as above. |
| Edge-case reviewer | System Back could revisit an invalid route after recovery. | medium | patch | Use `dismissTo` for not-found recovery. |

## Design Notes

Trust, Import and Atlas should feel like one private product, even before data exists.
Trust explains the on-device-first record. Import states that photo access is the
next story. Atlas uses a clearly empty in-flow panel, not a decorative or map-shaped
placeholder that could be read as evidence. The future map-first reveal is preserved
as an expectation without fabricating a travel record.

## Verification

**Commands:**

- `npm run check` -- expected: existing foundation checks remain green.
- `npm --prefix apps/mobile run check` -- expected: test, type-check, lint, and Expo
  diagnostic commands pass after the mobile package is installed.
- `npm --prefix apps/mobile run android:device` -- expected: a development build can
  be launched on an attached Android device when the local Android toolchain exists.

**Manual checks:**

- On each physical platform, open a development build, navigate Trust → Import →
  Atlas, enter Atlas directly, and verify no account or photo permission prompt
  appears in M1.1. Record platform/build evidence or its absence in the delivery record.
