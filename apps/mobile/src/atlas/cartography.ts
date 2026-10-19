import type { RevealJourney } from '@/reveal/types';
import { projectWorldPoint } from '@/atlas/world-projection';
import { fittedSize, type MapSize, type Viewport } from '@/atlas/viewport';
import type { AtlasCountryBoundary } from '@/atlas/country-boundaries';

export type CartographicBand = 'world' | 'regional' | 'country' | 'local';
export type PublicLabel = {
  id: string;
  text: string;
  longitude: number;
  latitude: number;
  level: 'country' | 'admin1' | 'locality';
  rank: number;
};
export type ScreenPoint = { x: number; y: number };
export type ScreenLabel = PublicLabel & { point: ScreenPoint; width: number; height: number };
export type JourneyCluster = { id: string; journeyIds: string[]; point: ScreenPoint; selected: boolean };

const BAND_LIMITS: Record<CartographicBand, { min: number; max: number; budget: number }> = {
  world: { min: 0, max: 1000, budget: 12 },
  regional: { min: 1000, max: 3000, budget: 24 },
  country: { min: 3000, max: 9000, budget: 40 },
  local: { min: 9000, max: Number.POSITIVE_INFINITY, budget: 60 },
};

/** Keeps semantic detail stable within a ten-percent margin at each boundary. */
export function cartographicBand(projectedWorldWidth: number, previous?: CartographicBand): CartographicBand {
  if (previous) {
    const range = BAND_LIMITS[previous];
    const low = range.min === 0 ? 0 : range.min * .9;
    const high = Number.isFinite(range.max) ? range.max * 1.1 : Number.POSITIVE_INFINITY;
    if (projectedWorldWidth >= low && projectedWorldWidth < high) return previous;
  }
  if (projectedWorldWidth < BAND_LIMITS.regional.min) return 'world';
  if (projectedWorldWidth < BAND_LIMITS.country.min) return 'regional';
  if (projectedWorldWidth < BAND_LIMITS.local.min) return 'country';
  return 'local';
}

export function screenPoint(longitude: number, latitude: number, size: MapSize, viewport: Viewport): ScreenPoint | null {
  const projected = projectWorldPoint(longitude, latitude);
  if (!projected) return null;
  const fit = fittedSize(size);
  return {
    x: size.width / 2 + (projected.x - .5) * fit.width * viewport.scale + viewport.x,
    y: size.height / 2 + (projected.y - .5) * fit.height * viewport.scale + viewport.y,
  };
}

function overlaps(a: ScreenLabel, b: ScreenLabel, padding = 6) {
  return Math.abs(a.point.x - b.point.x) < (a.width + b.width) / 2 + padding && Math.abs(a.point.y - b.point.y) < (a.height + b.height) / 2 + padding;
}

/**
 * Picks bounded, public labels by stable priority.  `measure` is supplied by the
 * renderer. It supplies a conservative font-scale-aware estimate until the first
 * native text measurement arrives, then exact measurements win on the next pass.
 */
export function layoutLabels(labels: PublicLabel[], size: MapSize, viewport: Viewport, band: CartographicBand, measure: (text: string, level: PublicLabel['level']) => { width: number; height: number }, excluded: { x: number; y: number; width: number; height: number }[] = []): ScreenLabel[] {
  const budget = BAND_LIMITS[band].budget;
  const levels = band === 'world' ? new Set(['country']) : band === 'regional' ? new Set(['country', 'locality']) : new Set(['country', 'admin1', 'locality']);
  const taken: ScreenLabel[] = [];
  const blockers = excluded.map((box, index) => ({ id: `reserved-${index}`, text: '', longitude: 0, latitude: 0, level: 'country' as const, rank: Number.NEGATIVE_INFINITY, point: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, width: box.width, height: box.height }));
  for (const label of [...labels].filter((candidate) => levels.has(candidate.level)).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))) {
    if (taken.length >= budget) break;
    const point = screenPoint(label.longitude, label.latitude, size, viewport);
    if (!point || point.x < 0 || point.y < 0 || point.x > size.width || point.y > size.height) continue;
    const bounds = measure(label.text, label.level);
    const candidate = { ...label, point, ...bounds };
    if (![...blockers, ...taken].some((other) => overlaps(candidate, other))) taken.push(candidate);
  }
  return taken;
}

/** Groups only the already-qualified visible journeys by current screen distance. */
export function clusterJourneys(journeys: RevealJourney[], size: MapSize, viewport: Viewport, selectedJourneyId: string | null, radius = 48): JourneyCluster[] {
  const points = journeys.flatMap((journey) => {
    if (!journey.mapAnchor) return [];
    const point = screenPoint(journey.mapAnchor.longitude, journey.mapAnchor.latitude, size, viewport);
    return point ? [{ id: journey.id, point }] : [];
  }).sort((a, b) => a.id.localeCompare(b.id));
  // Use connected components rather than a greedy first-cluster match. Any two
  // 48px press targets that overlap remain reachable through one explicit badge.
  const visited = new Set<string>();
  return points.flatMap((first) => {
    if (visited.has(first.id)) return [];
    const component = [first];
    visited.add(first.id);
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      for (const candidate of points) {
        if (!visited.has(candidate.id) && Math.hypot(component[cursor].point.x - candidate.point.x, component[cursor].point.y - candidate.point.y) <= radius) {
          visited.add(candidate.id);
          component.push(candidate);
        }
      }
    }
    const point = component.reduce((sum, candidate) => ({ x: sum.x + candidate.point.x, y: sum.y + candidate.point.y }), { x: 0, y: 0 });
    return [{ id: `cluster:${component[0].id}`, journeyIds: component.map((candidate) => candidate.id), point: { x: point.x / component.length, y: point.y / component.length }, selected: component.some((candidate) => candidate.id === selectedJourneyId) }];
  });
}

export function boundaryStroke(band: CartographicBand) {
  const width = band === 'local' ? 2 : band === 'country' ? 1.75 : 1.5;
  return { color: '#E9C46A', width, casingColor: '#081527', casingWidth: width + 2 };
}

/** Shared image/SVG transform: public paths must track the relief plane exactly. */
export function boundaryTransform(size: MapSize, viewport: Viewport) {
  const fitted = fittedSize(size);
  const width = fitted.width * viewport.scale;
  const height = fitted.height * viewport.scale;
  const left = (size.width - width) / 2 + viewport.x;
  const top = (size.height - height) / 2 + viewport.y;
  return { width, height, left, top, scale: width / 2048, transform: `translate(${left} ${top}) scale(${width / 2048})` };
}

/** Culls public vector features before React creates native SVG nodes. */
export function visibleCountryBoundaries(boundaries: readonly AtlasCountryBoundary[], size: MapSize, viewport: Viewport) {
  const fitted = fittedSize(size);
  if (!fitted.width || !fitted.height) return [];
  const scale = viewport.scale;
  const left = (size.width - fitted.width * scale) / 2 + viewport.x;
  const top = (size.height - fitted.height * scale) / 2 + viewport.y;
  const minX = Math.max(0, (0 - left) / (fitted.width * scale) * 2048);
  const maxX = Math.min(2048, (size.width - left) / (fitted.width * scale) * 2048);
  const minY = Math.max(0, (0 - top) / (fitted.height * scale) * 1280);
  const maxY = Math.min(1280, (size.height - top) / (fitted.height * scale) * 1280);
  return boundaries.filter((boundary) => boundary.maxX >= minX && boundary.minX <= maxX && boundary.maxY >= minY && boundary.minY <= maxY);
}
