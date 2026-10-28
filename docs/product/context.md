# Travel Life working context

Next-scope direction (2026-10-28): the owner approved one private account across
devices and selected cloud sources, preserving local-only use without signup.
[Decision 0015](../decisions/0015-private-multi-source-travel-history.md) and
[M6-M9](../../_bmad-output/planning-artifacts/epics-multi-source.md) govern account
restore, unified history/Replay, selected Drive files and selected Photos memories.
This supersedes the identity-as-hypothesis wording below for this bounded scope.
The 2026-10-27 sharing correction defers hosted links; native Replay video sharing
remains the local MLP route. Private sync does not authorize public publication.

Current direction update (2026-10-07): the Minimum Lovable Product is a private
lifetime map reveal, replay video and owner-selected share; see
[decision 0009](../decisions/0009-mlp-lifetime-reveal-and-replay.md).

UI/UX direction update (2026-10-09): the agreed prototype's Living Atlas language
is the [official design system](design-system.md) for all Travel Life surfaces;
see [decision 0010](../decisions/0010-living-atlas-design-system.md). The owner
also adopted the agreed prototype screens, including video Welcome, as official
product UI targets in [decision 0011](../decisions/0011-prototype-screens-as-product-ui.md).

Status: discovery input, not an approved PRD. Source: `source-analysis.txt`, copied
unchanged from the user's Travel Life App Analysis.txt on 2026-10-06.

## Product thesis

Turn fragmented travel evidence into an understandable, persistent travel record.
Initial loop: connect a photo source, reconstruct, reveal the available whole-life
record on an interactive map, replay it, explore/correct it, then optionally share
a selected interactive highlight. Maintain the record in background as new accessible
evidence appears. These capabilities are required MLP scope (decisions 0004/0009).

The Personal Travel Graph should preserve evidence, inferred presence, visits,
journeys, memories and corrections. The term does not select a graph database.
Future identity, richer replay editing, recommendations, commerce and community are hypotheses.

## Findings from our analysis

- Accuracy and coverage differ. A correct result can still omit years of history.
- Photos can belong to someone else's travel; shared photos can also be legitimate
  evidence of the user's trip. Presence requires uncertainty and correction.
- Observed photo dates do not establish departure/return dates. Map connections
  do not establish actual routes or exact distance travelled.
- New evidence can change old history. Incremental updates must respect corrections.
- Private exploration has value even when a user never shares.
- Local photo processing does not make a derived travel record non-sensitive.

## Market context (desk research, 2026-10-06)

These are published claims, not hands-on accuracy or retention measurements.

- [Pastport](https://www.getpastport.app/): photo-derived trips/globe/day views,
  local processing, recap cards, and an explicit missing-GPS limitation.
- [Viamem](https://viamem.app/): trip drafts, rename/merge/delete, map/photo reels.
- [Pino](https://pinoai.app/): local photo search, travel maps and grouping.
- [PixelTravel](https://apps.apple.com/ca/app/pixel-travel/id6768037970): photo-derived
  history, identity/statistics and questions about personal travel data.
- [Polarsteps AI](https://news.polarsteps.com/releases/ai-itineraries): advertises
  planning informed by previous trips. Future personalization is already contested.
- [FindPenguins](https://findpenguins.com/), [Journi](https://www.journiapp.com/blog),
  and [been](https://been.app/) provide tracking/memory/identity alternatives.
- [Google Photos API](https://developers.google.com/photos/overview/about): Picker
  access is user-selected; Library API access centers on app-created content.
  Do not assume a connect-once historical cloud scan.

Current user direction (2026-10-06, updated 2026-10-07): build an iOS/Android MLP from available
knowledge and assumptions, then learn from rollout. Pre-launch market research,
interviews and comparative studies are not prerequisites. The active working scope
is _bmad-output/planning-artifacts/mvp-spec.md; decision 0002 records defaults.
Published competitor claims remain desk research. Actual usage and optional case
review will address remaining hypotheses after release.
