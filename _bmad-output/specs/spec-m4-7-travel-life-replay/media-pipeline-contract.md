# Shared journey media and Replay preparation

Derived from the 2026-10-22 owner amendment. This companion defines the pipeline;
the existing M4.7 delivery record owns tasks and evidence.

## Current source baseline and remaining work (2026-10-23)

Source inspection finds an implemented provider/native render path, local artifact map and fixed failure mapping; renderer unavailability is no longer a permanent deliberate stub. The screen still first reads/resolves a manifest, then calls a provider method that reads/resolves again, owns preparation in local state and displays a Prepare button. The provider directly invokes the renderer with an unmanaged AbortController; the separate ReplayController is not its owner. Export currently shares that private artifact directly and is not the specified empty-first exact selected export. No Replay editor, durable draft or reusable verified-cache registry is present.

Earlier gap descriptions are historical, not instructions to reimplement already repaired reads. Audit shared-query parity, paging and access boundaries before changing them. Recent Android synthetic encode evidence does not establish current real-media playback, export or iOS acceptance. Report private device outcomes only as safe aggregates.

## Shared read and resolution boundaries

1. Capture a scope snapshot: completed run, privacy revision, correction revision,
   access/source/lifecycle generations and active Journey List filter. Represent
   untimed intervals as null/precision metadata, never year-0001/9999 fake dates.
2. Extract a repository-internal effective-attachment query used by album and
   Replay. Include primary inferred/owner membership and visit support only after
   effective reject/unassign/move-away resolution. Suggested items remain in
   their separate review surface. Stable order matches the album, including null
   dates. Deduplicate repeated rows for the same evidence within a journey, not
   distinct duplicate-family assets. Ambiguous cross-journey associations are
   withheld with a count until corrected; never arbitrarily choose an owner.
3. A page contains at most 60 candidates, stable internal identities, media kind,
   nullable capture precision and source references below the provider boundary.
   Check snapshot/privacy before and after every page. Do not rely on the mutable
   UI `displayedJourneys` map to hold a long-running render's authority.
4. Extract the existing platform-aware local resolver into a shared service.
   Preserve iOS-only cloud checking and Android local URI fallback. Preserve a
   result slot for every candidate; failures never shift another asset into its
   place. Distinguish readable, cloud-only, denied, missing, unresolved,
   unsupported, oversized and decode-failed outcomes through fixed codes.
5. Keep preview resolution separate from verified original materialization.
   Album thumbnails can resolve while full decode is unsupported. Recheck native
   reads and normalize only local media; do not simply set unknown DB flags to
   available or treat every native exception as a deleted source.
6. Allocate opaque session media tokens mapped to exact internal identity and
   job-owned native handles. The JS screen receives counts/coarse labels/fixed
   state; native inputs and source paths stay inside the provider/renderer
   service. Leases release after native settlement; stale tokens cannot resolve
   in another run/session. Revalidate after each await and before publishing.

Use a Replay-owned operation generation within the common privacy/lifecycle
queue. Gallery browsing must not accidentally invalidate a Replay merely by
incrementing its view request counter; actual policy/source/correction changes
must invalidate both. Never hold the queue or a DB transaction through native
decode/render or the OS share sheet. Guard final publication and dispatch.

## Accounting, persistence and recovery

For a scope snapshot, keep candidate identities in one mutually exclusive ledger:
rendered, editorially not chosen, deliberate deselection, effective membership/privacy
withholding, exact-date-filter exclusion, or technical omission with a fixed
reason. While resolving, show pending separately. Ready means pending=0 and
every eligible candidate is accounted for; no lost row between pages and no
truthy-preview shortcut. UI reports only coarse totals/reasons.

The 2026-10-23 interaction contract introduces a justified additive schema migration for persistent private drafts and a verified-cache registry. Imported evidence and reconstruction rules are unchanged. Session media handles/URIs and export selections/approval remain ephemeral; do not persist them in the draft or cache registry. Do not rewrite availability flags to make Replay pass.

Service ownership, Back/background behavior, dirty intent, retained cache and cancellation follow interaction-contract.md. It supersedes the earlier cancel-on-unmount/background and ephemeral-only private-plan rules. All native handles remain leased until settlement. Fixed failures offer automatic safe resumption or explicit Retry/Edit; scope overflow retains the proposed scope and never silently samples.

## Curated trip chapter composition (2026-10-23)

memory-selection-contract.md supersedes the old all-items-in-pixels/contact-sheet
formula. Every effective attachment remains a candidate; every scoped trip gets
an adaptively timed chapter, but only selected memories render. Editorial not-chosen,
owner exclusions and technical omissions are distinct accounting states. Duplicate
grouping changes presentation, not album membership or stored originals.

Read interaction-contract.md for durable edits and service/native ownership. Render
and verify chapters serially, buffer next chapters for continuous playback and
checkpoint each completed current-version chapter. Do not admit full-original
materialization for every candidate before ranking: use bounded derivatives and
original-decode validation on chosen assets, replacing failed automatic picks with
another eligible candidate. Never replace a failed owner Keep silently.

Full chosen-video export is a distinct streamed assembly/native gate; no old
P<=25/global60s/global32MiB formula applies. Chapter limits remain measurable and
resource failures remain honest. Source evidence/privacy/correction and no-cloud-
download rules are unchanged. Candidate visual features/embeddings stay private,
versioned and invalidated on source/privacy/consent changes. Provider processing
requires purpose-specific visual-media consent, not existing metadata-only AI consent.
