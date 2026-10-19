import type { AtlasCamera, RevealJourney } from '@/reveal/types';

/** Browser Atlas retains its Timeline recovery path; MapLibre Native is native-only. */
export function atlasJourneyGeoJson(journeys: RevealJourney[], selectedJourneyId: string | null) {
  return { type: 'FeatureCollection' as const, features: journeys.flatMap((journey) => journey.mapAnchor ? [{ type: 'Feature' as const, id: journey.id, properties: { journeyId: journey.id, selected: journey.id === selectedJourneyId }, geometry: { type: 'Point' as const, coordinates: [journey.mapAnchor.longitude, journey.mapAnchor.latitude] } }] : []) };
}

export function MapLibreAtlasMap(_props: { styleUrl: string; journeys: RevealJourney[]; selectedJourneyId: string | null; camera?: AtlasCamera; onChoose(ids: string[]): void; onEmpty(): void; onStyleFailure(): void; onGestureChange(active: boolean): void; onCameraChange(camera: AtlasCamera): void }) {
  return null;
}
