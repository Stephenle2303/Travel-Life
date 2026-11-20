# Home setup (CAP-5)

Applies to the first-use Home step and the Settings Home screen
(`InitialHomeSetup` in `components/mobile-screens.tsx`). Follows the Living
Atlas design system and decision 0017 typed place search.

## Flow

1. Search and pick a place (unchanged: city, province, district, ward or
   commune; 20 km default circle).
2. The period is already set to **Forever**. The owner can save immediately.
3. Optional: tap **Choose dates** to limit the period.
4. **Add this Home base** (first use) or **Save Home base** (Settings).
   First use continues only with at least one Home; there is no skip (H-4).

## Period control

- Two choices, Forever preselected: **Forever** · **Choose dates**.
- **Choose dates** shows two optional fields, **From** and **Until**. Each
  opens a month-and-year picker (year list, then a 12-month grid) with a clear
  way back to "Any time" (From) or "Now" (Until). No typed date format.
- Valid combinations: neither (same as Forever), From only (current Home since
  a date), Until only (former Home), or both. Until before From is blocked
  inline with a short message.
- Stored values: From = first day of the chosen month; Until = last day of the
  chosen month; empty = open end. Editing a Home saved with exact days keeps
  those days until the owner changes that field.

## Labels

| Saved period | Label |
| --- | --- |
| No start, no end | Forever |
| Start only | From Mar 2020 |
| End only | Until Dec 2019 |
| Both | Mar 2015 – Dec 2019 |

## Several Homes

- Any number of Homes; periods may overlap (two homes at once is valid).
- A moving owner typically adds the old Home with **Until** and the new Home
  with **From**; nothing auto-fills either.
- With one Forever Home, every date is covered and `home-not-set` cannot occur.
  It appears only when all Homes are dated and leave a gap.

## Acceptance

- Adding a Home with only a place saves a Forever Home in one tap after search.
- Month/year pickers set From, Until, both or neither; the saved label matches
  the table; screen readers announce each picker value.
- Removing the last Home in Settings is refused; first use cannot finish
  without a Home.
