# Decision 0011: Agreed prototype screens are the official product UI targets

Date: 2026-10-09 (Asia/Bangkok).  
Status: accepted from the user's explicit direction.

## Context

Decision 0010 made the Living Atlas visual and interaction language official,
but did not explicitly adopt the prototype's actual screens. The owner has now
specified that **all UI/screens agreed in the prototype**, including the
beach/lake video welcome page, are the official product UI direction.

## Decision

The agreed [prototype screen set](../../apps/prototype/src/app/) is the baseline
for product screen design. The canonical [design system](../product/design-system.md)
names every screen and its essential composition and behavior. The video-led
Welcome, access choice, import progress, private Atlas reveal, journey detail,
Replay, selected Highlight, and sparse/declined/recovery states are all in scope.
Future production UI should implement these screen designs consistently across
iOS and Android, adapting controls and layout to the platform. The interactive
browser viewer follows the same visual and interaction language where its
different purpose requires new screens.

The product Welcome uses the existing bundled portrait and wide
beach/lake/landscape montage as its initial promotional treatment. Its synthetic footage is
illustrative, never evidence of the owner's travel or the personalized Replay.
Keep the pause/play control, reduced-motion behavior, silent default, lifecycle
pausing, and poster fallback when carrying it into the product.

The prototype's simulated permission, scan, correction, replay, and sharing
mechanics are replaced by the real behavior specified in accepted decisions and
delivery stories. Production copy must describe actual capability and coverage.
No prototype-only demo route, fictional trip, or illustrative coordinate is
presented as an owner's record.

## Consequences

The current mobile Trust → Import → empty Atlas screens are an implementation
foundation, not the final UX target. Future UI delivery stories should map to
the official screen set and record deviations for platform usability or
accessibility. This decision records the target and does not claim that the
screens, welcome-video integration, replay export, or publishing are already implemented
in `apps/mobile`.

Reconsider a specific screen pattern only when owner direction changes or
target-device/browser validation establishes a concrete usability or
accessibility problem. Keep the Living Atlas identity while resolving it.
