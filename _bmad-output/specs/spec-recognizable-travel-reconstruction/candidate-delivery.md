# Shadow candidate implementation

The shadow candidate is a synchronous, deterministic calculation over the
already-authorized canonical projection. It introduces no I/O or telemetry
boundary. Closed candidate classifications and edge reasons stay in memory.
When a caller integrates the candidate into a runtime action, map failures
to `ATLAS_REBUILD / CANDIDATE_CLASSIFY` with the existing action correlation.
An unknown exception remains `UNKNOWN` and leaves the visible generation
unchanged. Scope reads, writes and fault/redaction tests belong to the owning
runtime integration. The collection recipe is in delivery-and-diagnostics.md.

The versioned initial policy treats recurrent observations as separate visits
spread over at least 28 days. It separates distinct sessions by 90 minutes,
looks for positive evidence of an outing at least 2 km from dated routine
context, and bounds supported away continuation to 10 observed days. These
are development parameters. Sparse day-only evidence does not claim an exact
order. An incomparable same-day owner boundary withholds automatic
qualification. Keep the paired evaluation before deciding activation.

The canonical test for two independent sessions around 22 km from a
configured Home yields no automatic trip on the baseline and one reliable
candidate in shadow. The tests also cover ordinary Home volume, duplicate
support, a four-day holiday gap with and without away evidence, corroborated
return, same-day owner separation, time conflicts, a dated usual-place
answer, exact owner-kept Home support, and excluded evidence.

The explicit shadow repository read uses three closed stages. In
`CANDIDATE_INPUT_READ`, verify source permission, current complete run,
and database snapshot. Access denial blocks, a missing or oversized snapshot
skips, and transient SQLite read failures preserve the active state. In
`CANDIDATE_CLASSIFY`, run the local candidate and build bounded cards
without holding a SQLite write turn. Known owner remap uncertainty blocks
the comparison. In `CANDIDATE_READBACK`, recheck permission and the captured
revisions before returning a repository-scoped token. A stale result is
discarded. The provider must recheck this token after resolving any covers.
All stages use `ATLAS_REBUILD` and one caller-supplied or locally generated
correlation. No evidence identifiers, SQL, paths or raw errors enter logs.
