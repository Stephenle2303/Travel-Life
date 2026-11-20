# Personal learning (CAP-7)

Corrections are already stored as exact-support revisions. Personal rules are
derived from them, stored as owner decisions, applied on the next rebuild, and
listed in **Settings → What Travel Life learned**, each with **Remove**.

## Correction → personal rule

| Owner action | Personal rule | Effect |
| --- | --- | --- |
| Reject a Possible trip | Suppress that support signature (exists today) | Never resurfaces |
| Reject a `frequent-place` card with "Don't suggest this place again" | Everyday place: macro area | Future episodes there are hidden with reason `owner-everyday` |
| Reject a suggested place name | Suppress that place clue for that subject and its trip window | Name not offered again for those photos |
| Correct a place name | Place alias for that macro area | Future trips there use the owner's name |
| Confirm a trip without location | Personal landmark references from its photos (decision 0019 CAP-5) | Later visits match on the phone |
| Remove photos from trips: same source-folder category in 3 different trips | Ask once: "Leave out photos from this folder in future?" | If yes, that folder category stops supporting trips |
| Keep or reject a merge suggestion | Pair preference by support signature | Same pair not suggested again |

## Rules

- A personal rule never adds a trip to the Atlas by itself; it only names,
  hides by owner choice, or removes support.
- Rules are scoped (subject, macro area or folder category), never global
  thresholds.
- Removing a rule restores prior behaviour on the next rebuild.
- Rules contain no coordinates beyond the existing macro-area representation,
  no text from photos and no file names; folder categories are stored as
  closed buckets.
- Rules sync with private history like corrections (decision 0015) and are
  deleted with the record.

## Product learning (not automatic)

Aggregate rule and correction counts feed the eval engine locally. Nothing
leaves the phone without separate opt-in consent for case review. Patterns
found in synthetic benchmarks, owner-reported hard cases and opted-in reviews
become proposed rule or model versions that pass the gate in
[eval-engine.md](eval-engine.md).
