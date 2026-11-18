---
id: SPEC-private-multi-source-history
status: implementation-authorized
updated: 2026-10-28
companions:
  - ARCHITECTURE-SPINE.md
  - sync-contract.md
  - experience-and-states.md
  - verification-and-operations.md
  - ../../planning-artifacts/epics-multi-source.md
  - ../../../docs/decisions/0015-private-multi-source-travel-history.md
sources: []
---

# Private multi-source travel history

## Why

Travel evidence is spread across phones and cloud accounts. The owner approved
one account bringing that evidence into a correctable history, without requiring
manual consolidation on a phone. Implement M6-M7 first; selected Drive and Google
Photos imports follow. The existing local record must survive account adoption.

## Capabilities

- **CAP-1**
  - **intent:** Enter and recover an account without a password or local-use signup wall.
  - **success:** OTP verification, restart, refresh and local signout work with isolated credentials; wrong/expired codes and account isolation are tested (M6.1, M6.5).
- **CAP-2**
  - **intent:** Choose private synchronization and preserve existing reviewed history on a new phone.
  - **success:** A consented, acknowledged semantic snapshot restores without losing corrections, Hide/Exclude, manual journeys or committed Replay choices (M6.2-M6.4).
- **CAP-3**
  - **intent:** Combine evidence from devices into one supported record.
  - **success:** Complementary inputs converge across input order/retry permutations and exact duplicates contribute one support unit while retaining source references (M7.1-M7.3).
- **CAP-4**
  - **intent:** Preserve edits and removal decisions across concurrent and offline devices.
  - **success:** Version conflicts remain reviewable and stale jobs cannot overwrite corrections or resurrect removed/account-deleted content (M6.5, M7.4).
- **CAP-5**
  - **intent:** See and replay selected memories away from the source phone.
  - **success:** A second phone resolves acknowledged private derivatives and the committed soundtrack/order; source-offline playback succeeds and unsynchronized items remain explicit (M7.5-M7.6).
- **CAP-6**
  - **intent:** Understand source coverage and control retention and access.
  - **success:** Sources shows actual observed ranges/status, and pause/disconnect/removal/account deletion have distinct tested effects (M7.7).
- **CAP-7**
  - **intent:** Add selected Drive files without manual local downloads.
  - **success:** Authorized selected-file jobs import/recheck and contribute to the same history/media contract; unrestricted folder traversal is unavailable (M8).
- **CAP-8**
  - **intent:** Add selected Photos memories and place them in history when GPS is absent.
  - **success:** Picker import, expiry/reselection, batch association and cross-device retained playback pass without inventing GPS or whole-library access (M9).

## Constraints

- All 20 stories and their 76 ACs remain binding; this spec concretizes interfaces,
  not a scope reduction. Account/server acceptance is separate from host tests.
- Local-only data is never implicitly uploaded, reassigned on login or deleted on
  signout. Private history/media sync consent is separate from library and AI consent.
- Server-readable storage is private but not E2EE. No AI processing or publication
  is enabled by login or sync. Preserve the disabled hosted-sharing gate.
- Existing reconstruction versions, correction lineage, provenance and platform
  scheduling remain authoritative; missing GPS is unknown and media is not proof of presence.
- Session/account/source generations, idempotent receipts and atomic activation
  fence retries, deletion and stale results. Never use timeout as proof of rollback.
- Every fallible boundary has a closed diagnostic map, correlation, failure/redaction
  tests and collection instructions before device validation.

## Non-goals

- Original-library backup, broad Drive/folder crawling, autonomous historical Photos
  scan, social login, shared accounts, hosted public links and new AI photo analysis.
- Deploying to an unspecified destination or uploading the owner's private library
  merely to prove host tests. Service enablement requires the operational recipe.

## Success signal

Two physical phones with complementary and duplicate synthetic evidence show the
same aggregate, preserve an edit across offline concurrency, and play an exact
synchronized Replay while the source phone is offline. Reconnection after source
removal/account deletion cannot resurrect content. Report Android/iOS gaps honestly.

## Assumptions

- Retain the installed Expo/SQLite/Supabase versions and existing project direction.
  Engineering limits in sync-contract.md are conservative beta defaults, not measured
  capacity or a paid-plan promise. Real deployment destination/retention/SMTP evidence
  is an enablement gate; local implementation and synthetic verification can proceed.
