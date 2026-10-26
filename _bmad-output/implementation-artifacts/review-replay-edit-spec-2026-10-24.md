# Replay Edit detailed specification review — 2026-10-24

## Resolution update — owner agreed, 2026-10-24

The verdict below records the original review snapshot. Owner-approved solutions
have now been incorporated into the canonical editor companions and synchronized
soundtrack lifecycle. A01-A10/H01-H03 are addressed at contract level: versioned
selection readiness, exact used-clip inspection, per-trip Restore Auto, explicit
remap/CAS recovery, inactive excluded-trip checks, Trips jump, Selected view,
required extension-duration feedback and unassisted owner acceptance. Interaction
details now link to one editor owner instead of repeating the full UI contract;
optional drag is consistent. Acceptance E17-E22 covers the additions.

This is a specification resolution, not a second independent-review pass or an
implementation/device result. Actual layout, tap accuracy, large-album latency,
native posters/clip playback, persistence and unassisted Android/iOS usability
remain open delivery gates. Historical findings below are preserved as evidence.

Verdict: the main owner requirements are represented, but the specification is
not yet unambiguous enough to dispatch unchanged. Review only; no product contract
or application behavior was corrected in this pass.

Reviewed the canonical M4.7 SPEC, editor experience/delivery companions,
interaction/selection/timing contracts, adopted soundtrack behavior, decision 0014
and design system. Three independent lenses: adversarial, edge-case and structure.
Verification-gap lens did not apply to this docs-only review; prose copy-editing
was not requested. Source snapshot is held in ignored `.review-artifacts/`.

## Requirement coverage

| Owner requirement | Present in spec | Remaining issue |
| --- | --- | --- |
| Lean, intuitive self-serve navigation with short copy/few steps | Normal Edit -> trip -> tile -> Done, secondary disclosures, concise recovery | Many-trip navigation and finding current selections in a large album need stronger affordances; unassisted acceptance should be explicit. |
| Recognize media while editing | Actual photo thumbnail/video poster, separate inspect control | Inspector does not identify/play the actual selected video interval. |
| Grid grouped by trip like See photos | Trip strip, inline responsive grid, stable paging/return | Excluded-trip checks need a clear inactive state so checked does not falsely imply output. |
| See selected/unselected and control inclusion | Effective-manifest checkmarks, explicit trip intent, no silent backfill | First-preparation manifest readiness and trip-scoped restore-Auto behavior need definition. |
| Technical work behind task with progress bar/percentage | Per-tap no encode; automatic Done preparation; measured phase progress | Unknown work correctly uses indeterminate progress; extended duration feedback cannot remain optional. |
| Safe continuous editing | Durable working/committed separation, CAS, remap, Back/restart | Soundtrack Back conflicts with editor Back; conflict/remap recovery lacks concrete owner actions. |

## Findings by lens

Adversarial findings A01-A10 are retained individually. Edge-case findings H01-H03
independently overlap A01/A04 and the soundtrack ownership finding; overlap is
corroboration, not additional distinct defects. These are specification findings,
not claims that the proposed editor has already been implemented or failed on-device.

| ID | Location / trigger | Concrete guard | Consequence / disposition |
| --- | --- | --- | --- |
| A01 | Editor selection initialization when Edit opens before the first chosen manifest exists | Browse immediately; obtain one versioned lightweight chosen manifest before enabling content mutations | Arbitrary/empty checks can freeze incorrect explicit choices. Confirmed contract gap; corroborated by H02. |
| A02 | Inspector opens a source video while Replay uses a short chosen interval | Identify the used interval and play that segment without introducing trim controls | User cannot predict the video moment being included. Accepted UX refinement. |
| A03 | One edit freezes a trip into explicit mode; only broad Reset is concretely specified | Add trip-scoped Restore automatic selection, preserving other trips/music/direction, with working save and Undo semantics | Owner must sacrifice unrelated edits to return one trip to Auto. Clarify scope; existing selection contract mentions restore-Auto but does not resolve the UI. |
| A04 | Ambiguous journey/media successor needs owner resolution | Define compact recovery entry, allowed reselect/discard actions and Done gating | An unresolved count alone cannot complete the task. Confirmed recovery contract gap; corroborated by H03. |
| A05 | CAS conflict offers Reload/reapply without specifying destructive boundaries | Retain local branch; define reload/discard/rebase and conflict resolution actions | Implementers may lose local intent or override newer intent. Confirmed recovery contract gap. |
| A06 | Owner toggles media within an excluded trip | Show excluded/inactive selection state; define whether edits remain enabled and prohibit implicit re-inclusion | Checked media may never render despite selected-means-output language. Confirmed state ambiguity. |
| A07 | Target trip is far away in a lifetime horizontal strip | Add optional compact trip-jump/search access without adding a required picker step | Long swipe hunt undermines simple navigation. Scalability refinement; exact control is a design default to settle. |
| A08 | Current selected memories are scattered over hundreds of album tiles | Make Selected count a direct selected-media view/jump preserving the album anchor | Visual grid still makes existing Replay content difficult to find. Accepted UX refinement. |
| A09 | Explicit additions/Select all lengthen a chapter while duration feedback is optional | Require a visible honest duration estimate/pending state when choices extend output | Surprise long output; timing contract already requires visibly extended chapters. Confirmed cross-companion ambiguity. |
| A10 | Functional tests and coached walkthrough are treated as self-serve evidence | Require an unassisted owner task and record assistance/wrong turns | UI may still require coaching. Verification refinement: existing E16/no-instruction language is directionally present, but pass evidence needs specificity. |
| H01 | Change soundtrack -> Back -> reopen | Acknowledged working music survives Back; only Done commits, if this is retained as the intended policy | Soundtrack companion says Back cancels; editor says Back retains. Confirmed conflict, also identified by structure. |
| H02 | First preparation has no chosen manifest | Explicit selection-pending readiness state | Overlaps A01. |
| H03 | Ambiguous successor prevents safely applying saved intent | Explicit recovery actions and whether Done is blocked | Overlaps A04. |

### Editorial structure

Audience: human product owner and implementing agent. Model: behavior contract
with separate delivery/evidence companion. Keep the two-layer editor structure.

| Pass | Original Text | Revised Text | Changes |
| --- | --- | --- | --- |
| structure | Editor delegates music to soundtrack; interaction delegates working-state behavior to editor; soundtrack Back cancels while editor Back retains | QUESTION / MERGE: name a single owner for working/committed lifecycle and reconcile the soundtrack paragraph/acceptance | Circular ownership prevents a deterministic reading. Approximately word-neutral; affected soundtrack section is 242 words. |
| structure | Interaction visual editor amendment and acceptance duplicate the new detailed editor companions | CONDENSE: retain approximately 180-word summary and direct companion links; keep service/draft/cache rules here | Existing repeated sections total approximately 916 words (762 + 154). Approximately 736 words / 30.3% of the 2,427-word interaction contract can be removed; also resolve mandatory-versus-optional drag wording. |
| structure | Separate editor experience and editor delivery/acceptance companions; existing M4.7 record | PRESERVE this separation, flowchart and action table | Useful navigation for different readers; 0-word change. |

Three structural recommendations including preservation; estimated reduction is
approximately 736 words if condensation is accepted. No length target was set.
Preserve a short local flow summary so readers need not chase links for orientation.

## Remaining doubts to validate during implementation

- Whether saved preview + trip strip + grid + footer leaves enough usable phone
  space. Use actual small-screen/large-text layouts, not composition tables alone.
- Whether independent toggle and inspect targets are recognizable and reachable
  without accidental taps. Video poster identity/native extraction remains a gate.
- Whether paging and thumbnail bounds deliver prompt entry on large albums. The
  48-item/two-job values are initial assumptions, not measured performance.
- Native service lifecycle, background execution, durable working state and
  chapter reuse remain implementation gates; this review does not certify them.

No new product choice is required to recognize these gaps. Proposed fixes follow
the approved direction and can be specified without adding mandatory wizard steps.
Do not close D4 until contract conflicts/recovery paths are resolved and actual
Android/iOS owner-operated visual/self-serve evidence is recorded.

## Machine-readable behavioral findings

```json
[
  {"lens":"adversarial","location":"editor-experience.md / Selection means output; interaction-contract.md / User path","trigger_condition":"Edit opens before an effective chosen manifest exists.","guard_snippet":"Browse immediately, but establish one versioned chosen set before enabling selection mutations.","potential_consequence":"First-edit freezing can remove memories the owner never intended to remove."},
  {"lens":"adversarial","location":"editor-experience.md / Inspect, order and soundtrack","trigger_condition":"Inspector shows a source video but Replay uses a short selected interval.","guard_snippet":"Identify and play the exact selected interval without adding trimming controls.","potential_consequence":"The selected source is recognizable but its Replay moment remains unpredictable."},
  {"lens":"adversarial","location":"editor-experience.md / Selection means output; Direct actions and bulk scope","trigger_condition":"A trip becomes explicit and only Replay-wide reset is concretely specified.","guard_snippet":"Define reversible trip-scoped Restore automatic selection preserving other trips, direction and music.","potential_consequence":"Returning one trip to Auto can sacrifice unrelated edits."},
  {"lens":"adversarial","location":"editor-experience.md / Working save, commit and return; interaction-contract.md / Persistent drafts and identity","trigger_condition":"Saved intent encounters an ambiguous journey/media successor.","guard_snippet":"Define compact unresolved-edit entry, safe reselect/discard actions and Done gating.","potential_consequence":"Owner can be stuck or an implementation can silently discard intent."},
  {"lens":"adversarial","location":"editor-experience.md / Working save, commit and return","trigger_condition":"CAS conflict offers Reload/reapply with unspecified retained/discarded revisions.","guard_snippet":"Preserve local branch and specify non-destructive rebase and explicit conflicting-intent resolution.","potential_consequence":"Local or newer changes can be lost despite a durable-intent claim."},
  {"lens":"adversarial","location":"editor-experience.md / Screen composition; Direct actions and bulk scope","trigger_condition":"Owner edits media in an excluded trip.","guard_snippet":"Display inactive trip selections and define editing without implicit re-inclusion.","potential_consequence":"Checked media can misleadingly appear promised in output."},
  {"lens":"adversarial","location":"editor-experience.md / Screen composition; editor-delivery-and-acceptance.md / E05","trigger_condition":"A lifetime strip contains many trips and the target is distant.","guard_snippet":"Provide optional compact trip-jump/search and verify many-trip navigation.","potential_consequence":"Repeated horizontal swipes undermine simple self-serve navigation."},
  {"lens":"adversarial","location":"editor-experience.md / Media grid and Within-trip ordering","trigger_condition":"A few chosen memories are scattered throughout a large album.","guard_snippet":"Expose Selected view/jump and retain the original album anchor.","potential_consequence":"Owner must scan hundreds of unchosen items to edit current content."},
  {"lens":"adversarial","location":"editor-experience.md / Screen composition and Progress and concise recovery","trigger_condition":"Explicit selections extend duration but duration feedback remains optional.","guard_snippet":"Require updated estimated chapter duration or honest pending state when output grows.","potential_consequence":"Owner can create a surprisingly long Replay without seeing the effect."},
  {"lens":"adversarial","location":"editor-delivery-and-acceptance.md / E16 and Physical owner walkthrough","trigger_condition":"A coached walkthrough is treated as evidence of self-serve usability.","guard_snippet":"Require unassisted find/inspect/select/Done task and record assistance and wrong turns.","potential_consequence":"Functionally correct UI can remain confusing without coaching."},
  {"lens":"edge-case-hunter","location":"soundtrack behavior-and-acceptance.md:38-40","trigger_condition":"Owner changes music, presses Back, then reopens Edit.","guard_snippet":"Back retains acknowledged working soundtrack; only Done changes committed soundtrack.","potential_consequence":"Music changes may be discarded while other edits survive."},
  {"lens":"edge-case-hunter","location":"editor-experience.md / Selection means output","trigger_condition":"First preparation has not produced an effective chosen manifest.","guard_snippet":"Expose selection-pending state before accepting content mutations.","potential_consequence":"Initial checkmarks and explicit freezing can misrepresent actual output."},
  {"lens":"edge-case-hunter","location":"interaction-contract.md / Persistent drafts and identity","trigger_condition":"An explicit selection encounters an ambiguous successor.","guard_snippet":"Specify safe resolution actions and whether unresolved intent blocks Done.","potential_consequence":"Owner gets an unresolved count without a completion path."}
]
```

Review process: sandbox Temp staging was inaccessible to reviewers and later to
the parent shell. Re-staged the source snapshot in the ignored shared workspace
directory and reviewed source files directly; no private media was used. No app,
build, server, device or version-control publication changed. Findings remain open.
