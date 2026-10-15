import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ActionButton, Body, InsetPanel, palette, Title, useReducedMotion } from '@/components/ui';
import type { RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';

type MapCamera = { center: RevealMapAnchor; pitch: number; heading: number; altitude: number };
type MapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
type MapComponent = ComponentType<{ style: unknown; accessibilityLabel?: string; initialRegion?: MapRegion; initialCamera?: MapCamera; onRegionChangeComplete?(region: MapRegion): void; children?: ReactNode }>;
type MarkerComponent = ComponentType<{ coordinate: RevealMapAnchor; accessibilityLabel?: string; accessibilityState?: { selected?: boolean }; onPress?(): void; children?: ReactNode }>;

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

function NativeMap({ onUnavailable, journeys, selectedJourneyId, onSelect, depth, reducedMotion, viewport, onViewportChange }: { onUnavailable: () => void; journeys: RevealJourney[]; selectedJourneyId: string | null; onSelect(id: string): void; depth: AtlasDepth; reducedMotion: boolean; viewport: MapRegion | null; onViewportChange(region: MapRegion): void }) {
  // This provider receives only already-coarsened anchors and no source,
  // evidence, raw coordinate, or reconstruction identifiers.
  if (!nativeMapView || !nativeMarker) return <MapUnavailable onUnavailable={onUnavailable} />;
  const MapView = nativeMapView;
  const Marker = nativeMarker;
  const anchoredJourneys = journeys.filter((journey) => journey.mapAnchor !== null) as (RevealJourney & { mapAnchor: RevealMapAnchor })[];
  if (!anchoredJourneys.length) return <MapAreaFallback />;
  const region = mapRegionFor(anchoredJourneys.map((journey) => journey.mapAnchor));
  const camera = mapCameraFor(viewport ?? region, depth, reducedMotion);
  return <MapView key={`${depth}:${anchoredJourneys.map((journey) => `${journey.id}:${journey.mapAnchor.latitude}:${journey.mapAnchor.longitude}`).join(':')}`} style={{ height: 336, borderRadius: 22, overflow: 'hidden', backgroundColor: palette.fern }} accessibilityLabel="Private Atlas map" onRegionChangeComplete={(nextRegion) => onViewportChange(coarsenMapViewport(nextRegion))} {...(camera ? { initialCamera: camera } : { initialRegion: region })}>
    {anchoredJourneys.map((journey) => {
      const selected = selectedJourneyId === journey.id;
      return <Marker key={journey.id} coordinate={journey.mapAnchor} onPress={() => onSelect(journey.id)} accessibilityState={{ selected }} accessibilityLabel={journeyAccessibleLabel(journey, selected, journeys.indexOf(journey) + 1)}>
        <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'center', width: selected ? 38 : 28, height: selected ? 38 : 28, borderRadius: 19, backgroundColor: selected ? palette.citrus : 'rgba(16,44,38,0.86)', borderWidth: selected ? 3 : 1, borderColor: selected ? palette.limestone : 'rgba(243,238,221,0.78)', shadowColor: '#000', shadowOpacity: selected ? 0.25 : 0.12, shadowRadius: selected ? 6 : 3, elevation: selected ? 4 : 2 }}>
          <View style={{ width: selected ? 10 : 7, height: selected ? 10 : 7, borderRadius: 5, backgroundColor: selected ? palette.rainforest : palette.citrus }} />
        </View>
      </Marker>;
    })}
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

/** Stores only a coarse, ephemeral owner viewport for a presentation remount. */
export function coarsenMapViewport(region: MapRegion): MapRegion {
  const coarsen = (value: number) => Math.round(value * 10) / 10;
  return {
    latitude: coarsen(region.latitude),
    longitude: coarsen(region.longitude),
    latitudeDelta: Math.max(0.1, coarsen(region.latitudeDelta)),
    longitudeDelta: Math.max(0.1, coarsen(region.longitudeDelta)),
  };
}

export type AtlasDepth = 'flat' | 'perspective';

/** A camera remount gives the owner an immediate, non-animated depth change. */
export function mapCameraFor(region: ReturnType<typeof mapRegionFor>, depth: AtlasDepth, reducedMotion: boolean): MapCamera | undefined {
  if (!region) return undefined;
  return {
    center: { latitude: region.latitude, longitude: region.longitude },
    pitch: depth === 'perspective' && !reducedMotion ? 28 : 0,
    heading: 0,
    altitude: Math.max(region.latitudeDelta, region.longitudeDelta) * 110_000,
  };
}

function MapUnavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => { onUnavailable(); }, [onUnavailable]);
  return null;
}

function MapAreaFallback() {
  return <InsetPanel><Body>No visible journey has a map-supported location. These private journeys remain available in the Timeline.</Body></InsetPanel>;
}

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onOpenJourney, mapAvailable = true }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(): void; onReplay(): void; onOpenJourney?(id: string): void; mapAvailable?: boolean }) {
  const [view, setView] = useState<'map' | 'timeline'>('map');
  const [depth, setDepth] = useState<AtlasDepth>('flat');
  const [year, setYear] = useState<number | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapViewport, setMapViewport] = useState<MapRegion | null>(null);
  const reducedMotion = useReducedMotion();
  const effectiveMapUnavailable = !mapAvailable || mapUnavailable;
  const exploration = deriveAtlasExploration(model.journeys, { view, year, selectedJourneyId });
  useEffect(() => {
    if (selectedJourneyId === null || exploration.selectedJourneyId !== null) return;
    const resetSelection = setTimeout(() => setSelectedJourneyId(null), 0);
    return () => clearTimeout(resetSelection);
  }, [exploration.selectedJourneyId, selectedJourneyId]);
  const selectYear = (nextYear: number | null) => {
    setYear(nextYear);
    setSelectedJourneyId((previous) => nextYear === null || model.journeys.some((journey) => journey.id === previous && journey.years.includes(nextYear)) ? previous : null);
  };
  const hasVisibleMapAnchors = exploration.visibleJourneys.some((journey) => journey.mapAnchor !== null);
  const showMap = model.state === 'ready' && view === 'map' && !effectiveMapUnavailable && hasVisibleMapAnchors;
  const showMapAreaFallback = model.state === 'ready' && view === 'map' && !effectiveMapUnavailable && !hasVisibleMapAnchors;
  const selectJourney = (id: string) => setSelectedJourneyId(exploration.selectedJourneyId === id ? null : id);
  const effectiveDepth: AtlasDepth = reducedMotion ? 'flat' : depth;
  return <View style={{ gap: 14 }}>
    <Title>{model.state === 'ready' ? 'Your private Atlas' : (model.state === 'sparse' || !model.journeys.length) ? 'No private record yet.' : 'Private Atlas is waiting'}</Title>
    <InsetPanel style={{ gap: 8, padding: 16 }}>
      <Text style={{ color: palette.citrus, fontWeight: '900' }}>{model.state === 'ready' ? 'AVAILABLE RECORD' : model.state.toUpperCase()}</Text>
      <Body>{model.message}</Body>
      <Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body>
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
    {showMap && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <ActionButton accessibilityLabel="Show flat 2D Atlas map" accessibilityState={{ selected: effectiveDepth === 'flat' }} onPress={() => setDepth('flat')} variant={effectiveDepth === 'flat' ? 'primary' : 'secondary'}>2D</ActionButton>
      <ActionButton accessibilityLabel={reducedMotion ? 'Map perspective is unavailable while Reduce Motion is on' : 'Show Atlas map in 3D'} accessibilityState={{ selected: effectiveDepth === 'perspective' }} onPress={() => setDepth('perspective')} variant={effectiveDepth === 'perspective' ? 'primary' : 'secondary'} disabled={reducedMotion}>3D</ActionButton>
    </View>}
    {showMap && <InsetPanel style={{ gap: 6, padding: 14 }}><Body>The native map provider may receive map viewport and tile requests. Travel Life does not submit your journey records to it.</Body></InsetPanel>}
    {showMap && <NativeMap journeys={exploration.visibleJourneys} selectedJourneyId={exploration.selectedJourneyId} onSelect={selectJourney} onUnavailable={() => setMapUnavailable(true)} depth={effectiveDepth} reducedMotion={reducedMotion} viewport={mapViewport} onViewportChange={setMapViewport} />}
    {showMapAreaFallback && <MapAreaFallback />}
    {(effectiveMapUnavailable || model.state !== 'ready') && <InsetPanel><Body>{effectiveMapUnavailable ? 'The map is unavailable. Your local history Timeline is still available.' : 'Your local history Timeline is available below.'}</Body></InsetPanel>}
    {model.state === 'ready' && view === 'map' && <ActionButton accessibilityLabel="Use chronological Timeline fallback" onPress={() => setView('timeline')} variant="secondary">Use Timeline</ActionButton>}
    <View style={{ gap: 4 }}>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Journeys</Text>
      <ScrollView style={{ maxHeight: 320 }} accessibilityLabel="Chronological local journey Timeline">
        {exploration.visibleJourneys.map((journey, index) => <JourneyRow key={journey.id} journey={journey} ordinal={index + 1} selected={exploration.selectedJourneyId === journey.id} onPress={() => selectJourney(journey.id)} />)}
        {year !== null && !exploration.visibleJourneys.length && <Body>No journeys have an observed visit in {year}. Choose All years to see the full available record.</Body>}
        {!model.journeys.length && <Body>No supported journey is available to show.</Body>}
      </ScrollView>
    </View>
    {model.replay.eligible ? <ActionButton accessibilityLabel="Check Replay availability" onPress={onReplay}>Explore Replay availability</ActionButton> : <InsetPanel><Body>{model.replay.reason}</Body></InsetPanel>}
    {model.state === 'processing' && <ActionButton accessibilityLabel="Catch up local journey history" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton>}
    {model.state === 'failed' && <ActionButton accessibilityLabel="Retry local reveal" onPress={onRetry} variant="secondary">Retry local reveal</ActionButton>}
    {(model.state === 'sparse' || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Import or reconnect photos</ActionButton>}
    {(model.state === 'sparse' || model.state === 'failed') && <ActionButton accessibilityLabel="Add a journey manually" onPress={onManualEntry} variant="secondary">Add a journey manually</ActionButton>}
  </View>;
}

function journeyAccessibleLabel(journey: RevealJourney, selected: boolean, ordinal: number) {
  return `${journey.label}, ${journey.periodLabel}, Atlas item ${ordinal}${selected ? ', selected' : ''}`;
}

function JourneyRow({ journey, selected, ordinal, onPress }: { journey: RevealJourney; selected: boolean; ordinal: number; onPress(): void }) {
  const qualifiers = [journey.status, journey.ordering === 'Order uncertain' ? journey.ordering : null, journey.hasMapSupport ? null : 'Location unknown'].filter((value): value is string => value !== null);
  return <Pressable accessibilityRole="button" accessibilityLabel={journeyAccessibleLabel(journey, selected, ordinal)} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 68, paddingVertical: 12, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(180,198,181,0.3)', borderLeftWidth: selected ? 3 : 0, borderLeftColor: palette.citrus, opacity: pressed ? 0.76 : 1 })}>
    <Text style={{ color: palette.limestone, fontSize: 17, lineHeight: 23, fontWeight: '800', paddingLeft: selected ? 10 : 0 }}>{journey.label}{selected ? ' · Selected' : ''}</Text>
    <Text style={{ color: palette.sage, fontSize: 14, lineHeight: 20, paddingLeft: selected ? 10 : 0 }}>{[journey.periodLabel, ...qualifiers].join(' · ')}</Text>
  </Pressable>;
}
