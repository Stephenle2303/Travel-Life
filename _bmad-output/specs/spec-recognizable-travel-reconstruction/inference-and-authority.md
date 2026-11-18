# Inference and publication authority

## Preserve the meaning of each result

| Result | Authority and consumption |
| --- | --- |
| Observation | A usable source fact with provenance, date precision, and applicable permission. Photos indicate recorded metadata rather than proof of presence. |
| Observed place | Geographic support exists. It may appear on the map as an observation without becoming a trip, route, or Replay chapter. |
| Reliable trip | Qualified by the versioned engine, or explicitly kept by the owner with valid current authority. Enters the main trip projection. |
| Possible trip | A plausible bounded candidate with positive evidence and an unresolved trip or grouping distinction. It may be reviewed privately. It contributes no default trip count, map trip badge, Replay, or share selection. |
| Routine or insufficient evidence | Stays in private evidence and permitted owner review. It does not fill Possible trips by default. |

Separate classification from album membership. A known trip can have
unavailable photos. An owner-attached GPS-less photo can be a memory
without supporting its destination. Use the existing privacy and generation
checks for covers, media pages and Replay.

## Candidate local engine

Keep the active projection as baseline and build the candidate alongside it.
Produce both from the same normalized evidence and owner decisions. The
candidate's deterministic pipeline is:

1. **Normalize and deduplicate.** Reuse verified families, canonical provenance,
   original civil day, reliable exact time when available, and location quality.
   Treat unknown or incompatible time as such. Burst copies from one session
   do not count as independent support.
2. **Derive routine context.** Apply owner-defined dated Home areas first.
   Build provisional usual-place context from independent prior observations
   outside the evaluated candidate. A single concentrated holiday, current
   device location, or later evidence from a different period cannot make an
   earlier destination routine. Keep provisional context distinct from owner
   facts. Exclude explicit in-scope Home evidence from automatic trips under
   the existing Home contract. An owner-confirmed outing can retain its exact
   authorized exception.
3. **Construct local observations and episodes.** Use independent place/time
   sessions and neighboring blocks. Consider departure from routine and
   compatible away continuation as positive evidence. Home-return
   corroboration, incompatible time, owner separation and privacy boundaries
   constrain merges. Same country or similar month cannot decide a merge.
   A gap alone cannot prove a return. Preserve uncertainty if more than one
   grouping remains plausible. Do not infer the unobserved path.
4. **Qualify independently from grouping.** A reliable automatic trip needs
   a credible away or distinct-outing signal and independent corroboration,
   with no unresolved material conflict. A possible trip needs a bounded
   plausible outing and at least one positive signal that separates it from
   routine, plus a specific unresolved distinction such as sparse sessions or
   an ambiguous boundary. Routine recurrence or photo volume alone qualifies
   for neither. Distance and count are features. The existing 50 km and
   five-photo gates remain in the baseline, but are not universal candidate
   requirements. An outing with two independent observations can qualify under
   the candidate rules. An equally small ambiguous cluster can remain possible.
5. **Resolve labels and eligible media.** Use current verified geographic
   naming and independent visit support, then derive authorized media. The
   current Vietnam regional fallback remains in force. An ambiguous date-only
   association belongs in review, not the default album or Replay.

Store an explicit candidate policy identity and closed reason categories for
the classification and boundary decisions. Keep exact thresholds and feature
weights in one versioned policy, recorded with the shadow run. Freeze them
after development calibration and before scoring a held-out set. Fixture
requirements define expected distinctions. The spec does not claim a
particular score or distance is validated in production.

## Select the clarification by its effect

Evaluate at most three eligible dated usual-place candidates per first reveal
as an initial implementation budget. For each candidate, compare the no-answer
projection with simulations of **Yes** and **No** using identical snapshots and
the same qualification and owner-decision rules. Simulations read saved evidence
only. They do not write owner facts or trigger permission, source or media work.

Count distinct trip groups newly qualified in a valid answer branch. Identify
groups by exact support and scoped lineage. A split of an already reliable
episode, duplicate family, renamed trip, removed false trip, or isolated cover
change does not satisfy the trigger. Require at least three newly qualified
groups in one branch and reject candidates whose other branch violates an
owner or privacy constraint. Removals may still be reported in the verified
diff. Rank qualifying questions by distinct gains and reduce ties in favor of
fewer disruptive changes and an easier-to-recognize prompt. Use a deterministic
tie-break. Suppress questions with uncertain period or no eligible preview.
Do not reopen a question already answered by an explicit Home area or decision.
If simulation exceeds its work budget, continue the reveal.

## Durable authority

Bind a question, Possible trip, and all related actions to the current history,
source, evidence and projection versions, plus Home, privacy and correction
revisions. Revalidate these at commit and again before publication. Use a
versioned per-history first-reveal receipt with offered, answered, dismissed,
or retired state. Mark offered durably before showing it. Resume the same
eligible offer after interruption. Never substitute a different offer after
that budget was consumed.

Use the existing writer and exact command receipt patterns. Undo appends a
reversal for the exact decision and rebuilds against current authority. Reject
or send to existing review if a subsequent owner edit makes reversal
ambiguous. **Keep as a trip** and **Not a trip** preserve their reviewed support
and exact target. Automatic refresh can improve unreviewed results. Preserve
reviewed facts, exact Replay selection, order and soundtrack. Route
irreconcilable changes to private review. Share only via the existing explicit
action. Local and account remain separate unless current consented compatibility
permits the versioned equivalent projection.
