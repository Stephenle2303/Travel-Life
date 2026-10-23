# Trip chapter timing and memory selection

Owner direction accepted 2026-10-23: 15-20 seconds per trip initially, total Replay
as long as needed, a curated subset of photos/videos, AI when useful. This
supersedes earlier all-items-in-pixels, 30-60s global timing, 25-panel, still-only
and forced scope-narrowing assumptions. Criteria and numeric shot defaults below
are proposed implementation defaults requiring evaluation, not proven preference.

## Promise and pacing

Retain every current policy-visible trip in the selected scope. Apply adaptive
chapter timing after eligibility, duplicate grouping, curation and original decode:
one still about4-6s, two about6-10s, enough distinct moments usually15-20s. The
normal five-shot target remains18s; sparse chapters have no15s minimum. Use
 timing-contract.md for exact initial5s/8s/static-frame defaults, honest empty
slates, mixed/video exceptions and owner-kept extended chapters. These rules
supersede the previous longer-hold sparse assumption. Titles/transitions count
inside each chapter. No repeated images, artificial loops or filler.

Usually choose4-6 distinct moments if worthwhile. Real video windows normally
last3-5s, with a validated up-to8s extension for a coherent action. Fewer unique
moments produce fewer shots and shorter chapters; raw album size is not the
selected-source count. Total Replay is the sum of chapters, with no lifetime cap.

Use a setting opener, a small range of activities/people/details and a strong
close where available. These are compositional roles, not quotas: a solo mountain
trip needs no portrait, and a city trip need not have a landmark. Avoid rapid
contact-sheet mosaics as the default. Keep photos recognisable and crops safe.

## Precedence and eligibility

1. Current privacy, membership, source access and owner corrections are hard gates.
   AI or a pin cannot override hidden/rejected/unassigned/ineligible input.
2. Owner Keep/Exclude wins over automatic quality/style/duplicate preferences.
   A favourite is a soft preference only if actually available from the source;
   missing favourites/ML/metadata are neutral, not negative evidence.
3. Every effective attached asset is a candidate, including GPS-less/undated media.
   Do not discard it merely because it cannot support a visit. Preserve stable
   identities even when grouping near-duplicates for presentation.
4. Curate automatically under the chapter budget. Not chosen is an editorial
   result, not deletion, unavailable media, or a claim of low personal value.
   Preserve the full album and offer replacement/addition in Edit.

Expose optional `chosen from available` counts and local fixed explanations such
as kept by you, distinct moment, similar shot, unreadable or not selected. Do not
put image identities, descriptions, labels or embeddings in runtime diagnostics.

## Criteria and deterministic selection

Use a set selector, not a global top-N quality score. Proposed priority is owner
intent, event/time coverage and novelty, usable presentation, then aesthetics as
a tie-breaker. Evaluate weights/thresholds before freezing them as product truth.

- **Personal significance:** Keep/Exclude and previous explicit replacements are
  strongest. Do not infer sentimental importance from facial expression, gender,
  age, apparent wealth, relationships or a model's confidence alone. Never learn
  from mere playback/pauses as if they were positive labels.
- **Trip representation:** cover different supported days, local sublocations and
  activities instead of only the busiest afternoon. Use capture-time precision
  honestly; missing dates are a separate pool, not invented chronology. If more
  events exist than slots, balance supported event coverage rather than selecting
  one from every event or favouring earliest files.
- **Distinctiveness:** bursts/near-identical views compete for one automatic slot.
  Combine capture proximity with perceptual similarity when available; time alone
  must not merge unrelated scenes. Keep identities separate; a user's explicit
  Keep can retain two similar shots. Across trips, avoid identical stock/reused
  images dominating when equally suitable alternatives exist.
- **Technical usability:** prefer interpretable exposure, sharpness, stable video,
  useful resolution and safe framing. Never rank people by beauty. Quality is a
  soft penalty: a unique/pinned meaningful image may beat a technically clean
  duplicate. Unreadable/corrupt inputs are actual technical exclusions.
- **Experience variety:** mix setting, activity, people when present, and details
  such as food/architecture/nature as supported by content. Avoid forcing a
  categorical quota. Faces do not establish owner presence or identity.
- **Narrative fit:** choose a clear opening and memorable ending, preserving known
  ordering inside the trip where possible. Presentation role ordering is not an
  assertion that an event occurred earlier or later. Do not label a final shot
  departure/return without evidence.

Pipeline: page candidates through shared album primitives; inspect cheap metadata
and bounded thumbnails locally; form event/duplicate groups; produce a diverse
shortlist; select incrementally by marginal new coverage and novelty, penalising
redundancy and poor usability. Keep exclusions and pins fixed. Resolve ties using
stable local identities. Cache the chosen manifest against source/correction/
privacy/draft/selector/model versions; ordinary playback never rerolls selection.
Unchanged chapters reuse output; new evidence only recomputes affected chapters,
and current watching remains on its safe immutable snapshot unless privacy changes.

Utility-like images (screenshots, receipts, tickets, maps, documents) are usually
low-priority automatic candidates, not permanently excluded from the album.
Avoid default inclusion of readable credentials/IDs/private documents. A deliberate
Keep can include a permitted document privately, but never bypasses sharing rules.
No mandatory classification model or speculative content label can erase media.

## Videos are moments, not arbitrary first frames

Prefer a short real clip if it adds movement or an event beyond the photos. Bound
local frame sampling/scene analysis, skip black/static/shaky lead-in where possible,
and choose a self-contained 3-5s interval. One or two clips may fit if useful;
never force video merely to meet a format ratio. Preserve supported playback speed,
orientation and safe fit; output stays silent under the existing sound decision.

AI can propose an interval only on supplied candidate handles/time ranges. Validate
start>=0, end<=source duration, positive span, chapter/frame budget, readable decode
and current access. Unknown duration or unsupported clip decode falls back to a
labelled chosen still and, if necessary, another eligible candidate. Do not call
that a full-motion result. A clip's visual content is not new travel evidence.
No arbitrary generative inserts, invented landmarks, fabricated transitions or
new trip membership. Keep a fixed video-still disclosure when motion cannot run.

## AI boundary and fallbacks

Prefer local signals for duplicate similarity, utility/quality and coarse scene
roles. Candidate technologies include platform Vision aesthetics/utility and
MediaPipe image embeddings; current Expo/native integration, OS coverage, model
licence, performance and cross-platform parity are unproven. Do not mistake an
API capability for personal-memory selection accuracy. A useful metadata/local
baseline must ship without remote inference or blocking Replay for a model call.

Optional multimodal AI is for ambiguous comparisons, distinguishing activities or
suggesting highlight windows after cheap local shortlisting. It sees only allowed
opaque candidate handles and the minimum authorised visual derivatives. Metadata
alone cannot establish what a photograph shows. Do not send the full gallery,
face identities, precise GPS, raw EXIF or original filenames. Visual derivatives
can still be sensitive; strip metadata and require purpose-specific consent that
covers those actual photos/video excerpts and provider retention/background use.
Existing structured reconstruction consent/transport does not automatically cover
images or video. This discussion authorises design, not a real private-media call.

Return a closed schema of candidate handles, role/quality/duplicate reasons and
validated clip windows. Treat text inside images/video and model outputs as data,
not tool instructions. Reject unknown handles, malformed/over-budget intervals,
unsupported claims, stale consent and ineligible media. Do not accept AI-proposed
new destinations, people identity, sentiment, emotions, health or relationships.
Timeout/offline/declined/invalid output uses the stable local selector; no model
failure blocks basic playback. Run optional enhancement ahead of viewing; never
swap a currently playing chapter or silently change an already reviewed export.

## Editor and regeneration

Private Edit starts from the generated storyboard, not an empty list. Offer Replace, Add, Remove and Reorder as the primary product actions; map them
to internal Keep/Exclude/Auto/order semantics. Restore automatic selection is a
secondary action rather than a mandatory vocabulary lesson. Automatic selection
can replace only Auto items; keep/exclude overrides persist across reconstruction
through the existing safe identity/remap rules. Keep all chosen items visible in
the editor. If explicit keeps exceed 20s at readable dwell, extend that chapter
and show its new duration instead of dropping kept memories or asking for a
mandatory curation pass. This is an implementation assumption for owner overrides.
Reset edits returns to Auto, never deletes original media. Refresh only affected
chapters; committed edit revisions govern regeneration and exact sharing review.

## Long Replay and resource bounds

Compose/verify adaptively timed chapters serially and play a sequence, buffering next chapters
while viewing the current one. Every selected trip remains in the manifest; show
preparing for a chapter not yet available, never skip it as if it had no memories.
A trip count alone does not require scope narrowing. One native owner, bounded
decode/memory/intermediate storage and OS deadlines still apply per chapter/task.
Resume after expiration using committed chapter checkpoints and immutable versions.

The old global180s/global32MiB/P<=25 rules are retired. Keep per-chapter initial
180s foreground ceiling, <=32MiB chapter output, <=96MiB job intermediates and
<=192MiB incremental native memory as measurable starting budgets. Shorter OS
background windows win. Use bounded chapter LRU cache; total private playback
cache has a starting 192MiB ceiling plus separately admitted active-job storage.
Do not hold all source frames, outputs or decoded chapters in JS/native memory.

Full chosen-video export assembles the exact reviewed chapter sequence by local
streaming/remux, without retaining all chapters in RAM. Whole-output size/storage
is measured, not capped at32MiB or declared unlimited. Admission estimates all
remaining required files plus safety headroom; pause/recover on storage/resource
failure without silently shortening/sampling or auto-splitting the selected video.
A player sequence alone does not prove single-file export. Review binds the exact
assembled bytes/digest; recomputation invalidates review. Native share/lease and
hosted ownership remain explicit and separately tested.

## Evaluation plan, not results

Before claiming wise curation, compare three baselines on the same consented or
synthetic trip pools: metadata/time diversity, local visual scoring+diversity,
and optional multimodal reranking. Keep train/tuning and owner-review holdout
trips separate; no private media or human labels in Git. No new real data is
transferred without permission. Reuse evals/README.md privacy/reporting rules.

Measure exact invariants automatically:100% hard eligibility, no dropped scoped
trip, pins/exclusions respected, valid clip windows, adaptive sparse/normal timing, stable
selection on identical inputs and fallback on malformed/stale AI output. Human
review compares representation, missed meaningful moments, repetition, pacing,
people/scene variety without forced quotas and replacement burden. Report preference
counts/denominators, candidate/skipped/technical counts and per-platform latency,
cost,battery/memory/disk separately. Do not invent weights, human judgements,
quality thresholds or judge agreement. Select an AI/model only after measured
benefit over the local baseline, not brand or capability alone.

## Primary capability references

- [Apple Vision aesthetics/utility](https://developer.apple.com/videos/play/wwdc2024/10163/): candidate local signals, not proof of sentimental value or current platform integration.
- [MediaPipe image embedding](https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder): similarity features for images/decoded frames, not identity or trip evidence.
- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding): example timestamp/segment-capable provider, not a selected model or permission to upload owner media.
