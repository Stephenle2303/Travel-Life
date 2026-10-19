import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';

import type { AtlasCamera, RevealJourney } from '@/reveal/types';

type FeaturePress = { nativeEvent?: { features?: { properties?: { journeyId?: unknown } }[] }; stopPropagation?: () => void };

export function atlasJourneyGeoJson(journeys: RevealJourney[], selectedJourneyId: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: journeys.flatMap((journey) => journey.mapAnchor ? [{ type: 'Feature' as const, id: journey.id, properties: { journeyId: journey.id, selected: journey.id === selectedJourneyId }, geometry: { type: 'Point' as const, coordinates: [journey.mapAnchor.longitude, journey.mapAnchor.latitude] } }] : []),
  };
}

export function MapLibreAtlasMap({ styleUrl, journeys, selectedJourneyId, camera, onChoose, onEmpty, onStyleFailure, onGestureChange, onCameraChange }: { styleUrl: string; journeys: RevealJourney[]; selectedJourneyId: string | null; camera?: AtlasCamera; onChoose(ids: string[]): void; onEmpty(): void; onStyleFailure(): void; onGestureChange(active: boolean): void; onCameraChange(camera: AtlasCamera): void }) {
  const data = atlasJourneyGeoJson(journeys, selectedJourneyId);
  const visibleJourneyIds = new Set(data.features.map((feature) => feature.properties.journeyId));
  const initial = camera?.center ?? data.features[0]?.geometry.coordinates ?? [0, 15];
  const chooseFeature = (event: FeaturePress) => {
    event.stopPropagation?.();
    const ids = (event.nativeEvent?.features ?? []).map((feature) => feature.properties?.journeyId).filter((id): id is string => typeof id === 'string' && visibleJourneyIds.has(id));
    if (ids.length) onChoose([...new Set(ids)]);
  };
  return <Map testID="maplibre-atlas-map" mapStyle={styleUrl} androidView="texture" dragPan touchZoom doubleTapZoom touchRotate={false} touchPitch={false} onPress={(event) => { if (!(event.nativeEvent as FeaturePress['nativeEvent'])?.features?.length) onEmpty(); }} onDidFailLoadingMap={onStyleFailure} onRegionWillChange={() => onGestureChange(true)} onRegionDidChange={(event) => { onGestureChange(false); const state = event.nativeEvent; if (Array.isArray(state.center) && state.center.length === 2 && typeof state.center[0] === 'number' && typeof state.center[1] === 'number' && typeof state.zoom === 'number') onCameraChange({ center: [state.center[0], state.center[1]], zoom: state.zoom }); }} style={{ height: 430, borderRadius: 18, overflow: 'hidden' }}>
    <Camera testID="private-atlas-camera" initialViewState={{ center: initial as [number, number], zoom: camera?.zoom ?? (data.features.length > 1 ? 2 : 5) }} minZoom={1} maxZoom={16} />
    <GeoJSONSource testID="private-atlas-journeys" id="private-atlas-journeys" data={data} hitbox={{ top: 20, right: 20, bottom: 20, left: 20 }} onPress={(event) => chooseFeature(event as unknown as FeaturePress)}>
      <Layer id="private-atlas-journey-markers" type="circle" paint={{ 'circle-radius': ['case', ['get', 'selected'], 10, 8], 'circle-color': ['case', ['get', 'selected'], '#F3722C', '#00B4D8'], 'circle-stroke-width': 2, 'circle-stroke-color': '#0B132B' }} />
    </GeoJSONSource>
  </Map>;
}
