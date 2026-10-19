import type { RevealJourney } from '@/reveal/types';
import { projectWorldPoint } from '@/atlas/world-projection';
import { fittedSize, type MapSize } from '@/atlas/viewport';

/** A fixed geographic radius wrongly kept nearby places grouped even after zooming. */
export function nearbyJourneyIds(journeys: RevealJourney[], id: string, size: MapSize, scale: number) {
  const chosen = journeys.find((journey) => journey.id === id)?.mapAnchor;
  const origin = chosen && projectWorldPoint(chosen.longitude, chosen.latitude);
  if (!origin) return [];
  const fitted = fittedSize(size);
  return journeys.filter((journey) => {
    const point = journey.mapAnchor && projectWorldPoint(journey.mapAnchor.longitude, journey.mapAnchor.latitude);
    return point && Math.hypot((point.x - origin.x) * fitted.width * scale, (point.y - origin.y) * fitted.height * scale) <= 24;
  }).map((journey) => journey.id);
}
