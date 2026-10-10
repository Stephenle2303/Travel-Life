# Epic 2 Context: Reconstruct journeys with AI assistance and small evals

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Create a deterministic, privacy-preserving local reconstruction baseline that turns imported evidence into explainable, reviewable places, visits, journey drafts and photo associations. Optional AI may only improve bounded ambiguities after the baseline works; it must never replace local history, owner decisions, evidence provenance, or uncertainty. The epic also establishes the small objective regression evidence needed to maintain this behavior without claiming population-level reconstruction accuracy.

## Stories

- Story M2.1: Build the metadata baseline and local history model
- Story M2.2: Build a protected AI proxy
- Story M2.3: Use AI to propose ambiguous grouping and labels
- Story M2.4: Add the small engine regression suite
- Story M2.5: Bound processing cost and recover gracefully
- Story M2.6: Maintain journey history from incremental updates

## Requirements & Constraints

- Implement the fixed, versioned `reconstruction-v1` rules deterministically for initial imports, foreground rescans and reconciliation. Equivalent final evidence must produce equivalent output regardless of enumeration order; record the rule version and final evidence/correction revision in each run.
- Preserve metadata provenance, timestamp precision and timezone information. Do not substitute import time for capture time or fabricate an offset, ordering, location, duration, route, country or proof of owner presence when the evidence cannot support it.
- Model places separately from chronological visits, and preserve returns such as A → B → A. Preserve independent photo-to-journey membership and photo-to-visit support; trip-only media and GPS-less memories must not create visit support. One accepted primary journey per photo and one duplicate-family support unit prevent count inflation.
- Apply owner exclusions, assignments, confirmed boundaries and corrections before new inferred support or links. Corrections and manual records survive rescan, restart and late evidence; unresolved remapping conflicts remain pending. Later additions to reviewed facts stay inferred.
- Keep inferred results reviewable and explicitly labeled. Missing, imprecise, conflicting, unsupported or ambiguous evidence may remain suggested, unresolved or unassigned.
- AI is optional, bounded and consent-gated. Send only allowlisted minimized alternatives through a protected server proxy; no originals, thumbnails, filenames, exact coordinates, absolute travel dates, credentials or private request bodies. Reject unsupported or stale outputs, enforce budgets and retain a usable local fallback when AI is declined, unavailable or fails.
- Add small synthetic or authorized internal regression cases with explicit expected memberships, support, boundaries, uncertainty and prohibited assertions. Report actual results and failures; deterministic cases do not demonstrate market accuracy or calibrated confidence.
- Incremental maintenance must reconcile to the same result as a full run on matching final inputs, preserve the last consistent history when incomplete, and never auto-publish updates.

## Technical Decisions

- Persist the canonical Personal Travel Graph locally in SQLite with migrations: evidence, reusable places, visits, journeys, associations, support links, corrections, usual areas, manual journeys and versioned import/run state. Original media stays in the photo source; raw evidence/traces, precise locations and media stay out of Git, analytics and logs.
- Use deterministic complete-link clustering for eligible geotagged support units: finite valid coordinates, known accuracy no worse than 5 km, Haversine radius 6,371,000 m, normalized date-line longitude, millimetre-rounded comparisons and 5,000 m maximum pairwise separation. Sort latitude, normalized longitude and stable evidence ID; choose qualifying clusters by minimum resulting maximum distance, then lexicographically smallest existing member ID. Use an observed minimax member as the representative coordinate.
- Build visits from comparable observations at the same reusable place: allow at most 48 elapsed hours with precise instants and offsets, otherwise one recorded civil day, cap the observed span at 30 calendar-date difference, and never cross a reliably ordered different-place visit or owner boundary. Preserve uncertain ordering rather than ordering by asset ID.
- Form inferred journey drafts from adjacent nonlocal visits at most 72 elapsed hours apart with precise offsets or two recorded civil days otherwise, limited to a 30-day observed span. Longer-but-adjacent segments may receive a non-transitive possible-merge relation only within 240 elapsed hours or ten civil days. These relations are reviewable signals, not travel continuity or forced boundaries.
- Apply date-scoped, owner-confirmed usual areas only as 50 km local context. A home-proximate eligible observation blocks automatic joining across nonlocal segments but does not prove a return or exclude a local trip; owner-confirmed return/split remains the binding boundary.
- Automatically associate GPS-less memories only under the narrow 24-hour, ordered, independent-anchor bracket for one journey; otherwise allow a one-day-padded, nearest-visit-within-three-days suggestion when exactly one compatible candidate exists. Keep competing candidates unresolved and no-date evidence unassigned.
- The optional AI path uses a TypeScript Supabase Edge Function with protected anonymous sessions, server-side provider credentials, schema validation, `store:false`, no request-body logging, atomic request/token/rate/global limits, sanitized usage totals and a kill switch. Bind proposals to evidence, correction, rule and consent revisions.

## UX & Interaction Patterns

- Present local reconstruction as an inferred draft with evidence-linked reasons, clear uncertainty and review actions; never represent photo metadata, a candidate link or AI output as confirmed owner presence.
- Keep the local history usable when AI is skipped or unavailable and disclose that state. Show pending or restricted reconciliation honestly rather than presenting partial results as final.
- Surface separate reasons for destination/visit support and journey membership. Make unresolved alternatives and missing evidence reviewable without requiring the owner to classify every photo.

## Cross-Story Dependencies

- M2.1 depends on M1.4's durable private evidence record. It supplies the local baseline and history model for all later Epic 2 work.
- M2.2 and M2.3 build on M2.1; M2.4 validates their contract; M2.5 adds cost and recovery controls; M2.6 depends on M1.5 and M2.5 for incremental reconciliation.
- Epic 3 consumes the reconstructed local history for the reveal, map, timeline and source-linked memories. Epic 4 corrections and visibility rules must feed back into reconstruction precedence and identity lineage.
