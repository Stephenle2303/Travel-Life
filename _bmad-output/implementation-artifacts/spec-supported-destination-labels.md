---
title: 'Show metadata-supported trip destinations'
type: 'bugfix'
created: '2026-10-18'
status: 'done'
route: 'oneshot'
---

<frozen-after-approval>
## Intent

Show familiar destinations on existing trips whenever their local metadata supports a reliable name. Resolve countries and administrative regions offline using versioned public geometry, including Bali, Indonesia. Carry supported labels into Atlas and selected trip details. Keep owner titles authoritative and retain neutral labels for unsupported evidence. The user authorized implementation through verification in a separate clean worktree.
</frozen-after-approval>

## Implementation Notes

- The clean checkout is based on 00211bd; later uncommitted V1.1 qualification and Atlas changes in the original workspace are not part of this worktree. Preserve its existing reconstruction and correction behavior; do not transplant unrelated dirty changes.
- Upgrade the local lookup to global Natural Earth 5.1.1 10m countries and administrative regions, simplified with topology preservation and a conservative edge margin. No runtime network lookup, private evidence export, schema migration, or owner-data mutation is needed.
- Derive names only from committed visit-support links, not month-wide places, photo membership, or a display anchor. Distinct evidence families must corroborate a place name. Mixed regions fall back to the supported country; multi-country journeys retain their supported countries.
- Code map: scripts/build-destination-data.py generates versioned public geometry; country-resolver.ts resolves coordinates; destination-label.ts aggregates support; repository.ts reads committed support and projects labels; reveal/types.ts and projection.ts carry labels; regression suites cover islands, ambiguity, accuracy, support, owner titles and Atlas projection.
- Verification plan: synthetic public-coordinate resolver and support tests, repository and reveal regressions, complete mobile tests/typecheck/lint, foundation npm run check, and diff whitespace. Device acceptance and measured reconstruction accuracy remain separate; product_quality: not_measured.
- No commit, push or merge is authorized. Original workspace and phone data remain unchanged.

### Completed implementation and verification

- Version-pinned public country/region geometry now resolves public inland Bali points to `Bali, Indonesia`, as well as other worldwide regions. A single source, conflicting countries, offshore points and invalid/overly uncertain coordinates cannot establish a name.
- `readDestinationLabels` joins only committed journey visits and their visit-support evidence. It filters unavailable, ineligible and conflicting duplicate families and derives names without exposing identifiers or raw coordinates. The same lookup feeds Atlas and selected details; details preserve effective owner titles. Read-time derivation refreshes old records without reimport or rebuild. Old country statistics need the normal rebuild to acquire the new dataset version.
- Generated geometry uses topology-preserving 0.001-degree simplification, four-place coordinate quantization, packed base-36 deltas and bounds. Final size 11,197,388 bytes; only candidate rings decode and the retained cache is capped at 50,000 points. A 1,000-public-coordinate host probe took 56 ms and retained about 15 MB heap including the resolver. Physical-device memory/speed remains unmeasured.
- Complete mobile suite: 30 suites / 249 tests pass. Mobile TypeScript and lint pass. Android export passes (1,485 modules; 14 MB Hermes bundle). Foundation `npm run check` passes (20 tests, framework integrity, eval smoke). Whitespace check passes. Expo Doctor 20/21: nine pre-existing SDK patch-version mismatches, outside this fix.
- No private evidence was read during this implementation. No live AI evaluation was required; `product_quality: not_measured`. Device acceptance of this isolated worktree remains pending. Original dirty checkout and phone were not changed.

## Review Triage Log

- High / patched: eagerly allocating 1.54 million coordinate pairs from the first 28.6 MB asset would impose excessive startup memory. Packed strings, candidate-only decoding, bounded retained cache and a host heap probe correct the source of that allocation.
- Medium / patched: persisted country lookup dropped the source accuracy value despite the new resolver's uncertainty guard. It now forwards `reported_accuracy_meters`.
- Low / patched: the existing Jest rootDir glob expands incorrectly under `.codex` on Windows. A package-scoped relative glob restores collection; all 30 suites collect and run.
- Review limitation: the independent reviewer hit an account usage limit after reporting its first two findings. No complete independent-review pass is claimed. Main-agent inspection verified the fixes, privacy boundaries, duplicate handling, multi-country summary, owner-title precedence and generated-data packaging.
