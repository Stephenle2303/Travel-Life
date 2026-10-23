# Replay chapter presentation

This contract defines the private sequence and separator for each scoped Replay
trip. It complements selection-contract.md: it never changes scope, evidence
membership, curation, timing policy or sharing approval.

## Timeline direction

- The default private presentation is **Oldest first**.
- The optional Replay editor exposes **Oldest first** and **Newest first**. The
  choice is stored in the active private draft, restored on reopen and applied
  after current policy/privacy validation.
- The direction changes chapter sequence only. It does not change a Journey
  List record, a correction, a selected memory, an observation, or an exact
  export/share approval. Any export selection is separately reviewed after the
  selected direction has produced its exact sequence.

Build chronological blocks only from supported date intervals and order facts.
Within an unknown, overlapping or otherwise incomparable block, preserve the
current Journey List-relative sequence. Newest first reverses qualified blocks;
it does not create an order inside an uncertain block. A changed Journey List
scope or current correction/privacy state re-resolves blocks before reuse.

## Trip separator

Each visible trip chapter begins with a brief quiet separator before its selected
moments or its verified-empty slate. The separator contains only:

1. the current policy-visible Journey List trip label/destination; and
2. the already supported month/year, year, range or unknown-time presentation.

It does not show a route, exact unrecorded dates, a travel duration, an
itinerary, inferred presence, raw coordinates, a source/media identifier, or
new facts from automatic curation. Owner-entered labels retain their existing
provenance and are never presented as observations.

The separator is part of the chapter's frame budget. The initial implementation
allocates no more than one second from that budget, including its transition;
the timing planner owns the final frame allocation. Sparse chapters stay short
instead of extending duration or repeating media to make room for a card.

## Private render contract

The immutable chapter manifest carries a sanitized display token and coarse time
token alongside the opaque group identity and selected moments. Components see
only display-safe values; repository/native boundaries retain local private
identity references. Render text locally with a bundled or proven platform font
path and an argument-safe text/image overlay implementation. Never interpolate a
raw label into FFmpeg/native command syntax, logs, diagnostics, cache filenames,
or test fixtures containing private data.

The rendered card becomes intentional private pixels. Cache and exact-export
keys include the display/coarse-time tokens and timeline direction, so a label,
precision, order, privacy or correction change cannot reuse an old card. Native
verification covers legibility at 720p on Android and iOS, correct first-card
ordering for sparse and normal sequences, and no disclosure through diagnostics.
