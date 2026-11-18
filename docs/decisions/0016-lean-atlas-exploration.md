# 0016 — Lean Atlas exploration and explicit Home

Date: 2026-10-30 (Asia/Bangkok).
Status: accepted product direction; detailed spec authored, implementation pending.

## Context and evidence

The owner reported clutter below Settings and scattered journey information,
requested a BMAD whole-page review, corrected the omission of the existing Home
button, then agreed with the revised proposal and requested an implementation spec.
Source review confirms verbose pre-map statistics, a full list in Map mode,
Replay after the list, verbose preview and mixed Atlas/global controls. Native
viewport acceptance has not been established.

## Decision

Keep visible Home, Your Atlas and Settings. Home remains explicit landing access,
separate from automatic returning-user entry, with View my Atlas returning to
existing context. Replace header About and the paragraph dashboard with concise
scope information and a quiet Details sheet. Make map/media the primary content,
Replay reachable independent of list length, Add journey secondary, and preview
photo-led with concise honest evidence status. Use the existing Atlas-only visual
extension consistently and retain privacy/correction/Replay authority.

The implementation contract is
[Lean Atlas exploration](../../_bmad-output/specs/spec-atlas-lean-exploration/SPEC.md).
Its compact Map/Timeline separation, dimensions, responsive breakpoint and exact
copy are explicit engineering defaults derived from the accepted direction, not
separate owner-validated prototypes. Wide map/list co-presence remains allowed.

## Options and consequences

Keeping all statistics inline preserves visibility but sustains the reported
clutter. Removing all qualification would obscure evidence semantics. Progressive
disclosure keeps useful summary and actionable status visible while preserving
details. Distinct compact views avoid a duplicate long feed; Timeline stays
visible for unlocated journeys. Context and accessible controls must survive the
new layout. Atlas variants must not recolor shared screens.

This amends the compact composition of0012 and older prototype controls where
they conflict;0013 cartography,0014 lean principles and existing evidence/privacy
decisions remain. No engine, provider, consent, sync, sharing or feature-gate change
is authorized. Revisit detailed defaults when native walkthrough identifies a
reachability, accessibility or recognition issue; do not call host mocks visual
acceptance.
