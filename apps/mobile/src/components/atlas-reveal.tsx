import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, Body, InsetPanel, palette, Title } from '@/components/ui';
import type { RevealMapAnchor, RevealModel } from '@/reveal/types';

type MapComponent = ComponentType<{ style: unknown; accessibilityLabel?: string; initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }; children?: ReactNode }>;
type MarkerComponent = ComponentType<{ coordinate: RevealMapAnchor; accessibilityLabel?: string }>;

let nativeMapView: MapComponent | null = null;
let nativeMarker: MarkerComponent | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require('react-native-maps') as { default: MapComponent; Marker: MarkerComponent };
  nativeMapView = maps.default;
  nativeMarker = maps.Marker;
} catch {
  // The web/Jest shell retains the readable local list when native maps is absent.
}

function NativeMap({ onUnavailable, anchors }: { onUnavailable: () => void; anchors: RevealMapAnchor[] }) {
  // This provider receives no journey, source, coordinate, or evidence props;
  // it may only make normal native map viewport and tile requests.
  if (!nativeMapView || !nativeMarker) return <MapUnavailable onUnavailable={onUnavailable} />;
  const MapView = nativeMapView;
  const Marker = nativeMarker;
  const region = mapRegionFor(anchors);
  return <MapView style={{ height: 270, borderRadius: 20, overflow: 'hidden' }} accessibilityLabel="Private Atlas map" initialRegion={region}>
    {anchors.map((anchor, index) => <Marker key={`${anchor.latitude}:${anchor.longitude}:${index}`} coordinate={anchor} accessibilityLabel={`Available destination ${index + 1}`} />)}
  </MapView>;
}

export function mapRegionFor(anchors: RevealMapAnchor[]) {
  if (!anchors.length) return undefined;
  const latitudes = anchors.map((anchor) => anchor.latitude);
  const longitudes = anchors.map((anchor) => anchor.longitude);
  const minLatitude = Math.min(...latitudes); const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes); const maxLongitude = Math.max(...longitudes);
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(1, (maxLatitude - minLatitude) * 1.3),
    longitudeDelta: Math.max(1, (maxLongitude - minLongitude) * 1.3),
  };
}

function MapUnavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => { onUnavailable(); }, [onUnavailable]);
  return null;
}

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, mapAvailable = true }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(): void; onReplay(): void; mapAvailable?: boolean }) {
  const [listOnly, setListOnly] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const effectiveMapUnavailable = !mapAvailable || mapUnavailable;
  const showMap = model.state === 'ready' && !listOnly && !effectiveMapUnavailable;
  const anchors = model.journeys.flatMap((journey) => journey.mapAnchor ? [journey.mapAnchor] : []);
  return <View style={{ gap: 18 }}>
    <Title>{model.state === 'ready' ? 'Your private Atlas' : (model.state === 'sparse' || !model.journeys.length) ? 'No private record yet.' : 'Private Atlas is waiting'}</Title>
    <InsetPanel>
      <Text style={{ color: palette.citrus, fontWeight: '900' }}>{model.state === 'ready' ? 'AVAILABLE RECORD' : model.state.toUpperCase()}</Text>
      <Body>{model.message}</Body>
      <Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body>
      <Body>The native map provider may receive map viewport and tile requests. Travel Life does not submit your journey records to it.</Body>
    </InsetPanel>
    {showMap && <NativeMap anchors={anchors} onUnavailable={() => setMapUnavailable(true)} />}
    {(listOnly || effectiveMapUnavailable || model.state !== 'ready') && <InsetPanel><Body>{effectiveMapUnavailable ? 'The map is unavailable. Your local history list is still available.' : 'Your local history list is available below.'}</Body></InsetPanel>}
    {model.state === 'ready' && <ActionButton accessibilityLabel={listOnly ? 'Show private Atlas map' : 'Use history list fallback'} onPress={() => setListOnly(!listOnly)} variant="secondary">{listOnly ? 'Show map' : 'Use history list'}</ActionButton>}
    <InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Local history</Text>
      {model.journeys.map((journey) => <Body key={journey.id}>{journey.label} · {journey.status}{journey.hasMapSupport ? ' · map-supported' : ' · location remains in this list'}</Body>)}
      {!model.journeys.length && <Body>No supported journey is available to show.</Body>}
    </InsetPanel>
    {model.replay.eligible ? <ActionButton accessibilityLabel="Check Replay availability" onPress={onReplay}>Explore Replay availability</ActionButton> : <InsetPanel><Body>{model.replay.reason}</Body></InsetPanel>}
    {model.state === 'processing' && <ActionButton accessibilityLabel="Catch up local journey history" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton>}
    {model.state === 'failed' && <ActionButton accessibilityLabel="Retry local reveal" onPress={onRetry} variant="secondary">Retry local reveal</ActionButton>}
    {(model.state === 'sparse' || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Import or reconnect photos</ActionButton>}
    {(model.state === 'sparse' || model.state === 'failed') && <ActionButton accessibilityLabel="Add a journey manually" onPress={onManualEntry} variant="secondary">Add a journey manually</ActionButton>}
  </View>;
}
