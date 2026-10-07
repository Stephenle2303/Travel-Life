# Decision 0006: Separate photo membership from trip and visit evidence

Date: 2026-10-07 (Asia/Bangkok).
Status: accepted product direction from the user's request to apply the reviewed
rule set. Numeric heuristics remain provisional engineering defaults.

## Context

The revision 4 MVP spec used five-kilometre place clustering, a three-calendar-day
journey gap and a fifty-kilometre near-home band. The
[rule review](../../_bmad-output/planning-artifacts/reviews/2026-10-07-photo-trip-rules-review.md)
found that these alone can merge separate trips, split sparse trips, confuse a
trip memory with proof of owner presence, and lose corrections after updates.
The user asked to change the spec according to that proposal.

## Decision

Use the metadata-first local baseline to create evidence-linked, reviewable
drafts. Distinguish four questions: what the photo's metadata says; which
chronological visit it may support; which journey contains the photo as a
memory; and which facts the owner has reviewed. Keep geographic places reusable
across separate visit episodes and preserve A → B → A sequences.

Five kilometres remains a provisional maximum pairwise place-cluster separation
with deterministic, order-independent assignment. Three comparable calendar
days remains a provisional link signal for bounded candidate episodes, never
proof of one journey or a forced boundary. Sparse gaps may produce bounded
possible-merge relations; missing photos alone do not justify a merge. The
fifty-kilometre band labels context only within an owner-confirmed usual
area's effective period; a near-home photo is not a confirmed return.
Decision 0007 fixes the initial tie-break and bounded windows before coding;
story M2.1 implements that version.

A GPS-less photo may have tentative journey membership while its location
remains unknown. Multiple plausible journeys remain unresolved. Source
uncertainty and duplicate copies cannot be promoted to independent proof of
owner presence. Owner assignments, exclusions and confirmed trip boundaries
constrain reconstruction. A confirmed journey's later additions remain inferred.
Correction scope and identity lineage preserve edits through split/merge and
background rebuilds; ambiguous remaps stay pending.

Optional AI sees only bounded eligible alternatives and coarse structural
context. Apply server and client relationship checks and reject proposals stale
against evidence, correction, rule or consent revisions. AI cannot invent
presence, turn membership into destination support or override owner decisions.

## Consequences

The [MVP spec](../../_bmad-output/planning-artifacts/mvp-spec.md) revision 5 is
the operative behavioral contract. M2.1, M2.3, M2.4, M2.6, M3.3/M3.4, M4.1 and
M5.3 acceptance criteria and the eval roadmap reflect the distinction.
Small synthetic cases fix expected behavior inside delivery; they are no
substitute for measured product accuracy and add no research gate.

This decision supersedes the revision 4 grouping interpretation. The broader
MVP-first strategy and existing import, maintenance and sharing decisions stand.
Decision 0007 supplies the initial numeric parameters. Reconsider them after
observed corrections and device evidence, preserving algorithm versions and
owner corrections.
