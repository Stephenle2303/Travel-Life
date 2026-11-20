# Clue producers (CAP-4..6)

Each producer is versioned, runs on the phone, emits only clue records, and
must abstain (emit nothing) when unsure. Existing code becomes producers; its
separate trip state is retired once clues reproduce its accepted results.

## Place (CAP-4)

| Producer | Existing code | Emits | Notes |
| --- | --- | --- | --- |
| Sign reader | `visual-place/native-signage.ts` (ML Kit text recognition, incl. Korean) + `place-catalog.ts` gazetteer | `sign-place` (gazetteer ID), `sign-script` (country set) | Text matched offline; text never stored |
| Landmark matcher | `visual-place/landmark-embedding.ts`, `native-landmark.ts`, regional packs | `landmark` (place ID) | Pack download rules of decision 0019 unchanged |
| Capture offset | `travel-window/capture-metadata.ts` | `capture-offset` (minutes) | Never names a place alone |
| Gemini Nano (optional) | `travel-window/native-nano.ts` | `place` (country/city) or nothing | Must be able to answer UNKNOWN; bonus clue only |
| Place combiner | new, deterministic | `place` (strong) | Two independent agreeing clues (decision 0019); conflict ⇒ nothing |

Targets, in order: `no-location` Possible trips and travel windows, then
`few-photos`/`single-moment` Possible trips, then Atlas trips lacking a
named destination.

## Photo source (CAP-5)

- **Metadata stage (deterministic):** folder category from the Story 1
  classifier (camera, imported per decision 0020, messaging, screenshot,
  download, unknown), plus device make/model and original dimensions.
- **Content stage (optional, later version):** an on-device image classifier
  for screenshots and forwarded images when metadata is `unknown`.
- Emits `photo-source` with `strong` only when metadata is unambiguous.

## Same trip (CAP-6)

- Pairs: two Possible trips, or a Possible trip and an adjacent Atlas trip,
  within 10 days, with no corroborated Home return between them.
- Signals: same place clue, landmark-embedding similarity between their
  photos, matching capture offset, matching camera.
- Emits `same-trip` for the pair; the rules turn it into a merge suggestion.

## Producer rules

- Abstention is the default; every producer reports its abstention rate to
  the eval.
- No producer reads another producer's free text; the combiner reads clue
  records only.
- Producers process sampled photos within the pass budget; sampling policy is
  versioned with the producer (existing visual discovery sampling is reused).
