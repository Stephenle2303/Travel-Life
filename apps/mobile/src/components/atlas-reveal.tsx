import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ActionButton, Body, InsetPanel, palette, Title } from '@/components/ui';
import type { RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';

type MapComponent = ComponentType<{ style: unknown; accessibilityLabel?: string; initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }; children?: ReactNode }>;
type MarkerComponent = ComponentType<{ coordinate: RevealMapAnchor; accessibilityLabel?: string; accessibilityState?: { selected?: boolean }; onPress?(): void }>;

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

function NativeMap({ onUnavailable, journeys, selectedJourneyId, onSelect }: { onUnavailable: () => void; journeys: RevealJourney[]; selectedJourneyId: string | null; onSelect(id: string): void }) {
  // This provider receives only already-coarsened anchors and no source,
  // evidence, raw coordinate, or reconstruction identifiers.
  if (!nativeMapView || !nativeMarker) return <MapUnavailable onUnavailable={onUnavailable} />;
  const MapView = nativeMapView;
  const Marker = nativeMarker;
  const anchoredJourneys = journeys.filter((journey) => journey.mapAnchor !== null) as (RevealJourney & { mapAnchor: RevealMapAnchor })[];
  const region = mapRegionFor(anchoredJourneys.map((journey) => journey.mapAnchor));
  return <MapView key={anchoredJourneys.map((journey) => `${journey.id}:${journey.mapAnchor.latitude}:${journey.mapAnchor.longitude}`).join(':')} style={{ height: 270, borderRadius: 20, overflow: 'hidden' }} accessibilityLabel="Private Atlas map" initialRegion={region}>
    {anchoredJourneys.map((journey) => <Marker key={journey.id} coordinate={journey.mapAnchor} onPress={() => onSelect(journey.id)} accessibilityState={{ selected: selectedJourneyId === journey.id }} accessibilityLabel={`${journey.label}, ${journey.periodLabel}${selectedJourneyId === journey.id ? ', selected' : ''}`} />)}
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

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onOpenJourney, mapAvailable = true }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(): void; onReplay(): void; onOpenJourney?(id: string): void; mapAvailable?: boolean }) {
  const [view, setView] = useState<'map' | 'timeline'>('map');
  const [year, setYear] = useState<number | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const effectiveMapUnavailable = !mapAvailable || mapUnavailable;
  const exploration = deriveAtlasExploration(model.journeys, { view, year, selectedJourneyId });
  const selectYear = (nextYear: number | null) => {
    setYear(nextYear);
    setSelectedJourneyId((previous) => nextYear === null || model.journeys.some((journey) => journey.id === previous && journey.years.includes(nextYear)) ? previous : null);
  };
  const showMap = model.state === 'ready' && view === 'map' && !effectiveMapUnavailable;
  const selectJourney = (id: string) => setSelectedJourneyId(exploration.selectedJourneyId === id ? null : id);
  return <View style={{ gap: 18 }}>
    <Title>{model.state === 'ready' ? 'Your private Atlas' : (model.state === 'sparse' || !model.journeys.length) ? 'No private record yet.' : 'Private Atlas is waiting'}</Title>
    <InsetPanel>
      <Text style={{ color: palette.citrus, fontWeight: '900' }}>{model.state === 'ready' ? 'AVAILABLE RECORD' : model.state.toUpperCase()}</Text>
      <Body>{model.message}</Body>
      <Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body>
      <Body>The native map provider may receive map viewport and tile requests. Travel Life does not submit your journey records to it.</Body>
    </InsetPanel>
    {model.state === 'ready' && <InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Inferred local record</Text>
      {model.statistics ? <>
        <Body>{model.statistics.journeyCount} inferred {model.statistics.journeyCount === 1 ? 'journey' : 'journeys'}.</Body>
        <Body>{model.statistics.placeCount} inferred {model.statistics.placeCount === 1 ? 'place' : 'places'}.</Body>
        <Body>{model.statistics.countryStatus === 'unavailable' ? 'Supported-country total is unavailable for this local record.' : model.statistics.supportedCountryCount === 0 ? 'No supported countries can be counted from this local record.' : `${model.statistics.supportedCountryCount} supported ${model.statistics.supportedCountryCount === 1 ? 'country' : 'countries'}.`}</Body>
      </> : <Body>Inferred totals are unavailable until a completed local reconstruction can be read.</Body>}
      <Body>These totals reflect the available private record and may be incomplete.</Body>
    </InsetPanel>}
    {exploration.selectedJourneyId && onOpenJourney && <ActionButton accessibilityLabel="Open selected private journey" onPress={() => onOpenJourney(exploration.selectedJourneyId!)}>Open journey</ActionButton>}
    {model.state === 'ready' && <View style={{ flexDirection: 'row', gap: 8 }}>
      <ActionButton accessibilityLabel="Show Atlas map" accessibilityState={{ selected: view === 'map' }} onPress={() => setView('map')} variant={view === 'map' ? 'primary' : 'secondary'}>Map</ActionButton>
      <ActionButton accessibilityLabel="Show chronological Timeline" accessibilityState={{ selected: view === 'timeline' }} onPress={() => setView('timeline')} variant={view === 'timeline' ? 'primary' : 'secondary'}>Timeline</ActionButton>
    </View>}
    {model.state === 'ready' && <ScrollView horizontal contentContainerStyle={{ gap: 8 }} accessibilityLabel="Filter Atlas by year">
      <ActionButton accessibilityLabel="Show all years" accessibilityState={{ selected: year === null }} onPress={() => selectYear(null)} variant={year === null ? 'primary' : 'secondary'}>All years</ActionButton>
      {exploration.years.map((availableYear) => <ActionButton key={availableYear} accessibilityLabel={`Show journeys from ${availableYear}`} accessibilityState={{ selected: year === availableYear }} onPress={() => selectYear(availableYear)} variant={year === availableYear ? 'primary' : 'secondary'}>{String(availableYear)}</ActionButton>)}
    </ScrollView>}
    {showMap && <NativeMap journeys={exploration.visibleJourneys} selectedJourneyId={exploration.selectedJourneyId} onSelect={selectJourney} onUnavailable={() => setMapUnavailable(true)} />}
    {(effectiveMapUnavailable || model.state !== 'ready') && <InsetPanel><Body>{effectiveMapUnavailable ? 'The map is unavailable. Your local history Timeline is still available.' : 'Your local history Timeline is available below.'}</Body></InsetPanel>}
    {model.state === 'ready' && view === 'map' && <ActionButton accessibilityLabel="Use chronological Timeline fallback" onPress={() => setView('timeline')} variant="secondary">Use Timeline</ActionButton>}
    <InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Chronological Timeline</Text>
      <ScrollView style={{ maxHeight: 320 }} accessibilityLabel="Chronological local journey Timeline">
        {exploration.visibleJourneys.map((journey) => <ActionButton key={journey.id} accessibilityLabel={`${journey.label}, ${journey.periodLabel}${exploration.selectedJourneyId === journey.id ? ', selected' : ''}`} accessibilityState={{ selected: exploration.selectedJourneyId === journey.id }} onPress={() => selectJourney(journey.id)} variant={exploration.selectedJourneyId === journey.id ? 'primary' : 'secondary'}>{journey.label} · {journey.periodLabel} · {journey.ordering} · {journey.status}{journey.hasMapSupport ? '' : ' · location unknown'}</ActionButton>)}
        {year !== null && !exploration.visibleJourneys.length && <Body>No journeys have an observed visit in {year}. Choose All years to see the full available record.</Body>}
        {!model.journeys.length && <Body>No supported journey is available to show.</Body>}
      </ScrollView>
    </InsetPanel>
    {model.replay.eligible ? <ActionButton accessibilityLabel="Check Replay availability" onPress={onReplay}>Explore Replay availability</ActionButton> : <InsetPanel><Body>{model.replay.reason}</Body></InsetPanel>}
    {model.state === 'processing' && <ActionButton accessibilityLabel="Catch up local journey history" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton>}
    {model.state === 'failed' && <ActionButton accessibilityLabel="Retry local reveal" onPress={onRetry} variant="secondary">Retry local reveal</ActionButton>}
    {(model.state === 'sparse' || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Import or reconnect photos</ActionButton>}
    {(model.state === 'sparse' || model.state === 'failed') && <ActionButton accessibilityLabel="Add a journey manually" onPress={onManualEntry} variant="secondary">Add a journey manually</ActionButton>}
  </View>;
}
