# 0015 - Private multi-source travel history

Status: accepted product direction, 2026-10-28. Implementation: planned.

## Context and decision

The owner has travel evidence across phones, Google Drive and Google Photos, and
does not want users to copy/download everything onto one local device. After the
party recommendation, the owner agreed and requested epics/stories for the next scope.

Adopt one private Travel Life account with multiple device/provider sources.
Keep local-only use without signup. Use email OTP first, following the existing
Supabase direction. Separate account login, source OAuth, history sync, retained
media and optional AI consent. An account can connect multiple provider accounts.

Devices extract local evidence; authorized cloud connectors fetch directly into
bounded backend jobs. A server-authoritative versioned history is built from
combined evidence and durable corrections, with SQLite offline replicas. Do not
merge whole databases or merely concatenate independently inferred trips. Preserve
uncertainty, duplicate families, owner-reviewed facts and correction lineage.

Retain explicitly authorized private viewing/Replay derivatives so a second phone
can use them when the source phone is offline. Originals remain at source; this is
not an original-media backup service. Server-readable processing must not be
marketed as end-to-end encryption. Public publication remains separately deferred.

Deliver account/restore and the two-device milestone first; then selected Drive
files; then selected Photos memories with batch handling of missing GPS. Preserve
the native exact-preview/share-sheet route. Do not re-enable M4.5/M4.6 hosted sharing.

## Alternatives and consequences

- Requiring manual consolidation onto one phone fails the owner's stated need.
- Synchronizing only trip lists loses joint evidence, deduplication and correction
  semantics; metadata-only sync also cannot provide dependable remote Replay media.
- Uploading entire original libraries by default adds unnecessary storage/privacy
  scope. Selected derivatives and explicit retention are the chosen first step.
- Peer-only synchronization makes access depend on source devices being reachable;
  private server retention supports the agreed offline-source scenario.

This supersedes the single-source/no-account/no-cloud-history defaults in decision
0002 only for the next scope. The local MLP remains valid. Existing correction,
privacy, evidence and platform rules remain in force. The 2026-10-27 hosted-sharing
deferral is unchanged. Deletion fences, account isolation, quotas, retention and
operational diagnostics are requirements from the first enabled service.

## Provider evidence and limits

Official sources consulted in the preceding discussion on 2026-10-28:

- [Google Photos overview](https://developers.google.com/photos/overview/about):
  Picker is user-selected; Library API manages app-created content.
- [Photos retrieval](https://developers.google.com/photos/picker/guides/media-items):
  temporary authenticated content URLs and image downloads excluding location metadata.
- [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth):
  prefer selected-file grants; broad access has restricted-scope obligations.
- [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless):
  managed passwordless account entry.

Revalidate API policy/retention/scopes during connector delivery. No full-library
Google Photos scan, inherited folder grants, reliable Photos GPS recovery or
measured performance is assumed.

## Delivery and reconsideration

[M6-M9 epics/stories](../../_bmad-output/planning-artifacts/epics-multi-source.md)
are the canonical next-scope contract. The backlog contains engineering defaults,
dependencies and acceptance criteria, not claims of implementation readiness for
all provider/operational details. Specify exact schemas/APIs in the owning story.

Reconsider storage mode if provider terms disallow intended retention, measured
cost is unsustainable or the owner requests E2EE. Broader Drive access and original
backup require a new scope decision. No service deployment, private upload or
public publication occurred or is implied by this planning decision.
