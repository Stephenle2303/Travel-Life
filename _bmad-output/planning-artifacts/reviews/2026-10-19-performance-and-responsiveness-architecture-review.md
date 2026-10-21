# Performance and responsiveness architecture review

Date: 2026-10-19
Scope: native mobile startup after a development build, full/local reconstruction,
and owner actions that save or wait for a reconstruction. This is a source-level
architecture review, not a device benchmark or a claim about real-library latency.

## Outcome

The owner-reported wait is credible. The current architecture correctly preserves
the last committed private Atlas and serializes SQLite work, but a full rebuild
has one long exclusive transaction, a synchronous JavaScript inference pass, and
many individual SQLite bridge calls. Its only public state is `running`; there is
no phase, elapsed time, cancellation boundary, or no-op acknowledgement.

Do not weaken atomic publication, run two reconstruction transactions in parallel,
or show fabricated percentages. The remedy is a staged, observable local pipeline
that keeps the existing committed projection browsable and gives every action an
immediate, truthful acknowledgement.

## Evidence

| Area | Evidence | Consequence |
| --- | --- | --- |
| Rebuild serialization | `apps/mobile/src/reconstruction/controller.ts` permits only one `runningGeneration`; `apps/mobile/src/database/native-transaction.ts` holds an exclusive transaction turn until `COMMIT` or `ROLLBACK`. | A second requested rebuild/catch-up cannot start, by design. |
| Long critical section | `reconstruction/repository.ts` opens `BEGIN IMMEDIATE`, reads all `canonical_evidence`, runs reconstruction, deletes/recreates projection rows, then commits. | Readers retain the old committed projection, but foreground writes wait behind the complete run. |
| Write amplification | The same repository writes places, support links, visits, journey links, memberships, dispositions and qualifications with awaited `runAsync` calls inside nested loops. | Large libraries make bridge round trips and transaction occupancy scale with derived rows, not merely displayed journeys. |
| JS work | `reconstructV1` repeatedly searches/sorts source arrays while clustering, assembling visits and journeys; V1.1 qualification adds further graph passes. | A large reconstruction can delay interaction/rendering on the JavaScript runtime before and between native awaits. |
| Incomplete acknowledgement | `AtlasReveal` shows an updating panel, but still renders `Catch up locally` while processing. `ReconstructionController.reconcile()` returns without notification whenever a run is active. | A tap can be a deliberate no-op with no owner-visible outcome. |
| Post-build/startup contention | Root layout mounts `PhotoAccessProvider`; its effects independently refresh access, lifecycle, maintenance/reconciliation and the durable reveal. An active app also begins a catch-up after returning foreground. | Dev-client/Metro reload can race several local reads and background catch-up for the same serialized SQLite connection. |
| Current measures | The reconciliation checkpoint stores a status/message and start timestamp, but no full-rebuild phase durations, write counts, UI-ack timing, or end timestamp distribution. | The current code cannot distinguish a slow device/library from a stuck phase. |

## Priorities

### P0 — restore response certainty before chasing throughput

1. Replace the boolean-like reconstruction view with a private, non-sensitive
   operation model: `operationId`, `kind`, `phase`, `startedAt`, and a concise
   stable message. Valid phases are `preparing`, `reading`, `deriving`,
   `committing`, `refreshing`, `complete`, and `failed`. A phase is changed only
   at an observed code boundary; there is no percentage until work units are
   measured and shown to be meaningful.
2. Publish `preparing` synchronously, then yield one frame before starting heavy
   work. This gives the pressed state and busy notice an opportunity to paint.
   Keep the operation id in the controller so a late result cannot overwrite a
   cleared/replaced lifecycle state.
3. During an active run, disable/relabel rebuild and catch-up controls as
   `Updating locally…`; if a caller requests the same work, announce “already
   updating” accessibly rather than returning silently. Do not queue arbitrary
   repeated full rebuilds; coalesce them to one explicit follow-up request only
   when new source changes arrive after the current snapshot.
4. Have every owner save state say what it is waiting for (`Saving decision`,
   `Rebuilding local Atlas`, or `Verifying saved Atlas`), retain its idempotent
   command key, and expose a bounded retry/reopen outcome. Keep the existing
   correction read-back rule: saved does not mean applied until durable Atlas
   projection verification succeeds.

### P1 — observe first, then optimize the proven phase

Add a local-only rolling performance record with no evidence, media, source IDs,
coordinates, dates, free text, or device identifier. For each operation retain:

- timing for start acknowledgement, database open/migration, evidence read,
  derivation, persistence, durable-projection refresh and total;
- bounded aggregate counts: evidence rows assessed, places, visits, journeys,
  links/dispositions written, and whether a correction/maintenance queue was
  present;
- terminal status and a safe failure category.

Show an owner-facing elapsed-status line after a short threshold, not on every
tap. Retain a small bounded history locally for a diagnostics screen/export only
after the privacy contract explicitly permits it. This measurement is operational
performance evidence, not reconstruction-quality or presence telemetry.

### P2 — reduce the measured bottleneck without changing correctness

If persistence dominates, replace the repeated `runAsync` row writes with bounded
prepared/batched statements inside the same single transaction. If derivation
dominates, first index evidence and visit lookups in the pure engine; move compute
off the UI JavaScript runtime only after native/worker support can preserve the
same deterministic input/output and cancellation semantics. Do not split a run
into publishable partial graphs, and do not run a second SQLite connection to
evade the serialization guard.

For startup, introduce a single bootstrap coordinator that establishes lifecycle
and durable projection first, then coalesces access/maintenance/reconciliation
refresh requests. Development-build asset/bundle loading remains separate from
application performance; measure and report it independently.

## Acceptance checks for the delivery story

- Rebuild tap has visible and accessible busy acknowledgement within one rendered
  frame under a testable scheduler seam.
- A duplicate rebuild/catch-up tap while running produces a deterministic visible
  “already updating” outcome and no extra repository call/transaction.
- Last committed Atlas and its media remain browsable while every phase runs;
  failed work preserves that projection.
- Correction save remains exactly-once for a stable command key and has distinct
  saving/rebuilding/verifying copy.
- Phase transitions and aggregate timing records contain no forbidden private
  fields, and lifecycle clear/reconnect still rejects stale publication.
- On physical Android and iOS, capture cold-start-after-build, full rebuild,
  queued maintenance catch-up, and one correction save across agreed library
  size slices. Report distributions and failures; do not invent a universal
  time budget before these measurements exist.

## Recommended next story boundary

Create a focused **M4.x Local operation responsiveness and measurement** story.
It owns the controller phase contract, duplicate-action acknowledgement,
local-safe performance records, tests and Android/iOS evidence. It must not
change reconstruction rules, qualification, correction mapping, map provider,
or publication behavior.

## Limits

No physical device timing, memory, battery, frame-rate, startup duration, or
private-library reconstruction time was measured in this review. A passing unit
suite would validate state contracts, not responsiveness on a real library.
