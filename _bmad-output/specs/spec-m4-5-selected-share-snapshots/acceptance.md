# Acceptance and evidence

Use synthetic fixtures and separate owner A/owner B/recipient clients. No production credentials or real evidence in Git. These checks validate software/privacy contracts, not reconstruction accuracy. No new model or judge evaluation is required.

| ID | Capability / upstream | Required observation |
| --- | --- | --- |
| AC-01 | CAP-1 / M4.5-1 | All entry points start empty; explicit Select all/Clear operate on the displayed eligible scope, including paged media, with no hidden cap. |
| AC-02 | CAP-1 / M4.5-1 | Trip/fact and media selections are independent; facts-only sharing is valid; unselected attachments never upload. |
| AC-03 | CAP-1 / M4.5-1 | Preview equals sanitized payload and derivative contents; unknown/inferred dates, corrections, selected counts and named-place precision are retained; Unicode labels remain legible. |
| AC-04 | CAP-1,6 / M4.5-1 | Missing/revoked/cloud-only media blocks its publication until explicit removal or successful retry and renewed preview; no silent drop/fallback. |
| AC-05 | CAP-2 / M4.5-1 | Entry, private draft edits, cancel-before-confirm and Replay playback/export cause no share upload; Publish authorizes only the reviewed draft. |
| AC-06 | CAP-2 / M4.5-1 | Hide/exclude/correction/access revision changes before activation invalidate confirmation; a fresh preview is required. |
| AC-07 | CAP-2,6 / M4.5-1 | Partial/failed upload, crash and cancellation never expose incomplete snapshots or media; private selection survives restart/retry. |
| AC-08 | CAP-2,6 / M4.5-1 | Lost activation response plus repeated taps reconcile one request/receipt/version and one quota reservation; changed payload cannot reuse the key. |
| AC-09 | CAP-2,4 / M4.5-2 | Owner B cannot list, mutate, upload to, activate, extend, delete or revoke owner A's share/version/object through any direct API/storage path. Test anonymous-auth subjects separately from unauthenticated requests. |
| AC-10 | CAP-3 / M4.5-2 | Invalid/unknown/revoked/expired capabilities receive indistinguishable safe recipient failure; valid token accesses only the active version. |
| AC-11 | CAP-3 / M4.5-2 | Storage direct reads and guessed/cross-version/cross-share object reads fail; snapshots contain no storage URLs or private record references. |
| AC-12 | CAP-3 / M4.5-2 | After revoke acknowledgement, fresh snapshot, media and video-range requests fail even before object cleanup; old-version media fails after republish. |
| AC-13 | CAP-3 / M4.5-2 | Expiry follows server clock, including exact boundary and skewed mobile clock; no cleanup scheduler dependency. |
| AC-14 | CAP-2 / M4.5-2 | EXIF/GPS/source names/paths/tokens/auth IDs are absent from payloads, files and fixed diagnostics; unsafe HTML/URLs, MIME spoofing and attached metadata are rejected. |
| AC-15 | CAP-2 / M4.5-2 | Each bound, concurrent quota reservation, abandoned upload and cleanup accounting is exercised; excess selection gives actionable rejection without truncation. |
| AC-16 | CAP-4 / M4.5-3 | Background import, reconstruction, new attachments and private corrections leave the published digest unchanged until explicit republish. |
| AC-17 | CAP-4 / M4.5-3 | Replacement requires new preview/confirmation and swaps atomically; failure retains old version; concurrent revoke prevents activation and URL revival. |
| AC-18 | CAP-4 / M4.5-2,3 | Owner list/reopen reflects active/expired/revoked states and confirmed expiry; expiry edits are explicit and cannot revive terminal links. |
| AC-19 | CAP-5 / M4.5-3 | Offline revoke and delete-all survive process death and evidence purge; retained credentials complete idempotent removal on reconnect, then are disposed according to lifecycle policy. |
| AC-20 | CAP-5,6 / M4.5-3 | Lost credentials never produce false remote-deletion success or control from a new anonymous session; known expiry and limitations remain visible. |
| AC-21 | CAP-3 / M4.6 boundary | Browser/function/CDN logs, analytics, referrers, cache and indexing paths contain no capability/content leakage; no service worker persists private media. Verify actual hosting configuration. |
| AC-22 | CAP-1,6 / Living Atlas | iOS/Android owner walkthrough covers bounded loading, long/Unicode text, safe areas, accessibility, media/audio preview, back/cancel, offline recovery and selected-content fidelity. |
| AC-23 | CAP-3,4 / M4.6 boundary | Copy/native-share is gated without a ready viewer; once integrated, separate mobile/desktop recipient opens without install/login and gets exact content plus invalid/expired/revoked recovery. |
| AC-24 | CAP-6 / M4.5-1,3 | Cancel before activation prevents publication. After activation begins, reconciliation truthfully reports whether it committed; a committed link remains until the owner separately selects explicit Revoke, and the app never claims remote absence from a timeout. |
| AC-25 | CAP-1–6 / diagnostic gate | Every introduced fallible boundary has a fixed operation/stage/reason-to-source map and a forced-failure test asserting its exact diagnostic category/outcome; distinct known failures do not collapse into feature-wide UNKNOWN/SAVE_FAILED. |
| AC-26 | CAP-2,5,6 / diagnostic gate | One non-identifying action correlation survives relevant UI/provider/storage/service layers; tests distinguish cancellation, lost acknowledgement, actual failure and successful reconciliation without duplicate terminal errors. |
| AC-27 | CAP-1–6 / diagnostic privacy | Nested synthetic private-error/content/token sentinels never reach diagnostic or UI serialization; each runtime enforces its allowlisted logger and direct-console guard; public recipient errors remain non-disclosing. |
| AC-28 | CAP-6 / incident triage | Actual platform/service collection recipe identifies the current build/process and precise filter; a synthetic failure is located from its event to the mapped source guard without broad speculative changes. Missing device/service evidence remains explicitly open. |

## Required evidence at implementation

- Automated deterministic payload, serializer, eligibility, operation-state and quota tests; local backend integration tests using real RLS/Storage/function boundaries, not mocked authorization only.
- Device walkthrough on both platforms for real local sanitization/thumbnail/video conversion, permission changes, cancellation/restart, selected output and network loss. Synthetic host tests do not close those gates.
- Deployment smoke with synthetic public-safe data only after deployment authorization/configuration; confirm proxy range behavior, actual log redaction, cache headers, abuse controls, cleanup jobs, quota settings and no-index. Generic social preview must not embed private facts.
- M4.6 release gate proves complete recipient flow with maps/list fallback. M4.5 can finish its API slice before that gate; the user-facing link-sharing feature cannot be called release-ready until both pass.
- Run root npm run check and the affected mobile/backend checks defined at implementation time, plus scoped whitespace/link validation. Record unavailable tooling honestly.

Planning status: criteria specified; none of these device/backend/deployment acceptance cases has been executed by this spec task. Existing Replay host results do not prove sharing correctness.
