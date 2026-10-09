# Reference reconciliation and mechanical coverage audit

Status: proposed design delta only, 2026-10-08. No application implementation, interactive mock, browser test, or approval is implied.

| Input / requested change | Reconciliation |
|---|---|
| Reference 1: Travellerspoint screenshot | Adopt recognizable world geography, map dominance and obvious zoom controls. Do not copy repeated world instances, pale palette, unrelated branding or hidden primary navigation. |
| Reference 2: current prototype screenshot | Preserve Living Atlas colors, selected-marker treatment and fictional-data honesty. Replace the abstract percentage-position field with a proposed geographic experience; reduce heavy framing and improve labels. |
| Vibrant, attractive interactive map | DESIGN defines proposed turquoise/green geography, photo preview and consistent controls. EXPERIENCE defines pan/pinch/zoom, overlap clusters, fit, shared filters and accessible Timeline fallback. Palette extension remains an assumption. |
| Easier navigation between pages | Proposed Atlas / Replay / Highlight after eligible import; contextual Back/Home on setup and secondary pages. Timeline stays inside Atlas; preserve session and selection instead of silently restarting. |
| Do not implement yet | Files are design proposals only. Provider/dependencies, code changes, map network traffic and production architecture are not approved. |

## Pass 1 — coverage

- Every scoped component appears in both DESIGN and EXPERIENCE component tables: map, marker/cluster, dock, switch, scrubber, preview sheet, detail, header, primary navigation, state/disclosure, Replay/Highlight.
- Visual spine covers all required sections and token groups. New geography colors are marked assumptions; typography inherits the current stack; contrast is a target, not a measured result.
- Behavior spine covers setup gates, state preservation, browser/deep-link return, failure/empty/sparse/unknown-coordinate/denied-access paths, accessible non-map interaction, motion/sound and responsive constraints.
- Evidence boundaries retain synthetic-only data, IDs/years/corrections, owner-selected sharing, no routes or presence claims, no GPS request and unchanged network guardrail pending a separate decision.
- Source links are relative to this folder and point to current prototype files, canonical record, reference register and decision 0009.

## Open decisions before implementation

1. Approve or adjust the proposed turquoise/green map palette and three-item navigation.
2. Choose a geographic rendering/provider approach, attribution, network disclosure and local fallback without silently changing `NO_EXTERNAL_EFFECTS.network=false`.
3. Agree the synthetic geographic anchor scheme and labels while preserving existing fixture identity and uncertainty semantics.
4. Validate map/sheet balance, touch reachability, keyboard navigation, contrast and 200% text at desktop/mobile sizes during later implementation. No browser verification was performed for this proposal.

No contradictory reference instructions were adopted. User instructions govern; screenshots provide visual evidence only. [DESIGN.md](DESIGN.md) and [EXPERIENCE.md](EXPERIENCE.md) remain the paired proposed spines; [REVIEW-PLAN.md](REVIEW-PLAN.md) records the scoped review and staged work.

## Documentation checks

On 2026-10-08, 29 local Markdown links and 29 design-token references resolved.
`git diff --check` reported no whitespace errors; existing LF/CRLF conversion
warnings are not application test results. Token groups and typography shapes were
corrected to the canonical DESIGN schema; both spines carry proposed status.

Independent BMAD editorial passes covered the plan and both spines:

| Pass | Finding | Disposition |
|---|---|---|
| Structure | Surface owner approval items before detailed implementation planning | Moved Approval items immediately after Recommendation |
| Prose | Moving approval items made a directional reference stale | Replaced positional wording with the section name |

No browser, measured contrast, application build/test, physical-device or provider
verification was performed in this documentation-only turn. The acceptance matrix
in REVIEW-PLAN is for the later authorized build, not a claim of completed checks.
