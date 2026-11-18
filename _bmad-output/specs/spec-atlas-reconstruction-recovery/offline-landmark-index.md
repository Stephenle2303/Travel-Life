# Offline landmark index

CAP-4 adds visual coverage beyond the single-landmark pilot. Travel Life
builds reference packs from public data. Atlas analyzes authorized private
photos locally and downloads only public artifacts. The pack builder,
benchmark and recognition runtime work without cloud billing, a payment
card, paid AI credentials or an owner-supplied destination.

## Public inputs and release artifacts

| Source | Purpose |
| --- | --- |
| [Google Landmarks Dataset v2](https://github.com/cvdfoundation/google-landmark#download-train-set) | Seed candidates from the landmark-to-category, cleaned training image IDs and attribution tables. Inspect coverage before retrieving images. |
| [Wikidata](https://www.wikidata.org/wiki/Help:Data_access) | Resolve a stable public place ID, aliases, coordinates, parent geography and the linked Commons category. Disambiguate namesakes by identity and geography. |
| [Wikimedia Commons](https://www.mediawiki.org/wiki/API:Imageinfo) | Add independent viewpoints through linked categories and retrieve canonical file, revision, attribution and license metadata. Use the documented API or public datasets with bounded requests and caching. |

The builder joins only explicit or independently verified place mappings.
Treat dataset labels, captions, category membership and AI output as candidate
evidence. Prefer distinct photographers, capture sessions and viewpoints.
Deduplicate across all sources before partitioning. Use local AI to rank
visible landmarks and surface questionable images for review. Retain
distinctive scenes and reject generic scenes, incidental subjects and images
that depict the wrong place. Review uncertain labels and rights before
admission. Each retained reference has an auditable record of its place ID,
original URL, author, source revision or hash, license and applicable reuse
restrictions. A public URL, category or model prediction alone is insufficient.

Generate a compact starter index spanning multiple countries and deeper
packs by region. Start with a Korea pack and an independent non-Korea pack
for evaluation. The starter needs real coverage in both regions to exercise
automatic routing. Each manifest records the supported geography, artifact
and descriptor versions, pinned source revisions, digest, expected byte size,
attributions and coverage. Ship descriptors and public place metadata to
devices. Store the reproducible build inputs separately. Refresh by comparing
source revisions and reusing unchanged descriptors. Propagate reviewed
removals. Generate and validate a new version before publishing it.

## On-device behavior

1. Discover candidate episodes using the existing authorized Local path.
   Choose visually diverse photos across sessions and days. Search the
   starter index and eligible installed packs. A corroborated regional clue
   from visual results, signage or existing geographic evidence can prioritize
   deeper retrieval. A model guess alone cannot establish a region or trip.
2. When a specific pack is warranted, retrieve it automatically within the
   app's connectivity and device budgets. Fetch only approved public pack
   artifacts. Send no owner image, feature vector, OCR text, dates, evidence
   reference or precise location. Treat a pack request as disclosing its
   public pack ID to the distributor. On no network, insufficient space,
   missing coverage or inconclusive results, continue within available
   local coverage or pause the unresolved candidate. The owner supplies
   no region, dates or photo selection.
3. Verify manifest authenticity, descriptor compatibility, file integrity
   and size before activation. Publish the new active version atomically.
   Preserve the previous verified compatible pack on failed or interrupted
   updates. Withhold revoked packs and ineligible evidence. Bind queries,
   checkpoints and proposals to the source, model, pack and policy versions.
   Reject late results after authority changes and revalidate pending
   proposals before display or confirmation. Owner-confirmed history keeps
   the existing correction rules.
4. Compare progressive session sampling with the current bounded sampler.
   Keep processing unresolved, diverse sessions within the frozen budget.
   Checkpoint completed work, preserve progress on eligible interruption
   and deduplicate on resume. A place hypothesis is an input to trip
   qualification. Only independently qualified continuity and album
   membership can produce a multi-stop suggestion. Preserve unknown
   capture locations and the single-confirmation Possible trips flow.

## Build and evaluation sequence

1. **Source audit and test index.** Extend the existing public landmark
   index generator or document its replacement. Produce a reference
   manifest, a coverage table per target place and disjoint public query
   fixtures. Report absent, insufficient and rejected references.
2. **Controlled benchmark.** Freeze public queries and acceptance thresholds
   before scoring. Compare current and SALAD matchers on the same
   references and queries. For each viable matcher, compare starter and
   deeper reference coverage with the same queries. Compare fixed and
   progressive sampling separately on the same episodes under equal
   budgets. Split references and queries by photographer or independent
   capture and remove reused crops and reposts. Include Ewha, Namsan,
   Nami, an independent non-Korea multi-stop trip, lookalike towers,
   generic photos, screenshots, and locations absent from the index.
   Report source coverage, region routing accuracy, landmark precision
   and recall, abstention and latency. A candidate must improve correct
   stop coverage over the baseline and meet the frozen false-match and
   resource limits. Record the minimum coverage improvement and the
   maximum false-match rate, pack bytes, scan time and peak memory in
   the benchmark manifest before scoring. SALAD is the first candidate. A local vision-language
   model may be measured as a secondary hypothesis source.
3. **Android integration and acceptance.** Integrate only after the public
   benchmark passes its frozen gates. Measure pack download size and
   storage, inference latency, peak memory, responsiveness and
   checkpoint/resume. Run the existing blind Android regression and
   independent holdout. Verify multiple supported stops, exclusion of
   unrelated photos, and exact album readback after one confirmation.
   Measure trip and album precision and recall separately. Keep iOS
   activation behind its native verification.

See [acceptance](acceptance.md) and the [diagnostic delivery record](delivery-and-diagnostics.md).
The [v1 pilot](../../../evals/landmarks/README.md) records the public source
audit, reproducible host artifacts and paired results. Android integration
remains gated on coverage, correct-stop improvement and automatic routing.
