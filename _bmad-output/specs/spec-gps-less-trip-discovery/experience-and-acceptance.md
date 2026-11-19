# Experience and acceptance — GPS-less trip discovery

## Story card (owner option B)

The story is always told for a travel-looking window. Only the place name
waits for agreeing clues.

**Facts only (no agreeing clues yet):**

> You were away for 6 days in June. 312 photos.
> Your clock moved 2 hours ahead.
>
> **Where were you?** [search]   ·   Not a trip

- The clock line appears only when that clue exists.
- The search is empty, quietly ranked by evidence. No country chips are shown,
  so a wrong country is never displayed.
- The owner's typed answer is saved and names the trip.

**Named (two clues agree):**

> Looks like **Seoul**.
> The sign at the ferry gave it away.
>
> **Yes**   ·   Not quite   ·   Not a trip

- Show the evidence that led to the name ("show your work").
- Stops found later appear as enrichment ("Day 3 looks like Nami Island").

**Weak evidence:** a quiet entry in Possible trips, not a full-screen reveal.

**Rules:**
- "Not a trip" removes the card permanently with no follow-up questions.
- Never mention where the owner was not.
- After confirmation, the whole trip (all member photos) is available
  immediately, including Replay eligibility through the existing gates.

## Acceptance — abroad gate (owner's Korea trip)

Measured on the owner's real library; thresholds frozen after Story 1.

1. The Korea window is detected and its story card appears.
2. The confirmed album contains the owner's own camera captures from the
   window; recall and precision come from the owner's single review pass.
3. Received, messaging-app and screenshot media are not in the proposed album.
4. Zero wrong-country names across the owner's library, including Sa Đéc
   controls.
5. No story card appears for non-travel GPS-less windows in the control set.
6. The full experience works with Gemini Nano unavailable.
7. Diagnostic and redaction tests pass for every mapped boundary.

## Domestic gate (later)

Same funnel without clock and script clues. Requires its own measured pass on
a real domestic GPS-less trip before release.
