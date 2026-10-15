import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { ActionButton, Body, InsetPanel, palette, Title } from '@/components/ui';
import { JourneyMediaViewer } from '@/components/journey-media-viewer';
import type { OwnerPreview } from '@/photo-access/types';
import type { AtlasCamera, AtlasExploration, JourneyDetail, RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';

type FeatureCollection = { type: 'FeatureCollection'; features: { type: 'Feature'; id: string; properties: { journeyId: string; selected: boolean }; geometry: { type: 'Point'; coordinates: [number, number] } }[] };
type MapPressEvent = { nativeEvent: { features: { properties?: { journeyId?: unknown } }[] }; stopPropagation?: () => void };
type MapRegionEvent = { nativeEvent: AtlasCamera };
type MapLibreComponents = {
  Map: ComponentType<{ mapStyle: string; style: unknown; androidView?: 'surface' | 'texture'; accessibilityLabel?: string; testID?: string; attribution?: boolean; logo?: boolean; compass?: boolean; preferredFramesPerSecond?: number; dragPan?: boolean; touchZoom?: boolean; doubleTapZoom?: boolean; onTouchStart?: () => void; onTouchEnd?: () => void; onTouchCancel?: () => void; onPress?: (event: MapPressEvent) => void; onDidFailLoadingMap?: () => void; onRegionWillChange?: () => void; onRegionDidChange?: (event: MapRegionEvent) => void; children?: ReactNode }>;
  Camera: ComponentType<{ initialViewState: { center: [number, number]; zoom: number }; minZoom?: number; maxZoom?: number }>;
  GeoJSONSource: ComponentType<{ id: string; data: FeatureCollection; hitbox?: { top?: number; right?: number; bottom?: number; left?: number }; testID?: string; onPress?: (event: MapPressEvent) => void; children?: ReactNode }>;
  Layer: ComponentType<{ id: string; type: 'circle'; paint: Record<string, unknown> }>;
};

let mapLibre: MapLibreComponents | null = null;
try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mapLibre = require('@maplibre/maplibre-react-native') as MapLibreComponents;
  }
} catch {
  // An older development build has no MapLibre native module. The Timeline stays usable.
}

const MAPLIBRE_DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

export function mapLibreDevelopmentStyle(isDevelopment = __DEV__) {
  return isDevelopment ? MAPLIBRE_DEMO_STYLE : null;
}

function NativeMap({ camera: savedCamera, onCameraChange, onChoose, onEmpty, onGestureChange, onUnavailable, journeys, selectedJourneyId }: { camera?: AtlasCamera; onCameraChange(camera: AtlasCamera): void; onChoose: (ids: string[]) => void; onEmpty: () => void; onGestureChange(active: boolean): void; onUnavailable: () => void; journeys: RevealJourney[]; selectedJourneyId: string | null }) {
  const style = mapLibreDevelopmentStyle();
  if (!mapLibre || !style) return <MapUnavailable onUnavailable={onUnavailable} />;
  const anchoredJourneys = journeys.filter((journey) => journey.mapAnchor !== null) as (RevealJourney & { mapAnchor: RevealMapAnchor })[];
  const camera = savedCamera ?? mapCameraFor(anchoredJourneys.map((journey) => journey.mapAnchor));
  if (!camera) return <InsetPanel><Body>No selected journey has a map anchor for this filter. Choose All years or use the Timeline.</Body></InsetPanel>;
  const points: FeatureCollection = {
    type: 'FeatureCollection',
    features: anchoredJourneys.map((journey) => ({ type: 'Feature', id: journey.id, properties: { journeyId: journey.id, selected: journey.id === selectedJourneyId }, geometry: { type: 'Point', coordinates: [journey.mapAnchor.longitude, journey.mapAnchor.latitude] } })),
  };
  const { Map, Camera, GeoJSONSource, Layer } = mapLibre;
  return <Map mapStyle={style} style={{ height: 390, borderRadius: 20, overflow: 'hidden' }} androidView="texture" accessibilityLabel="Private Atlas coarse map" testID="private-atlas-map" attribution logo compass={false} preferredFramesPerSecond={60} dragPan touchZoom doubleTapZoom onTouchStart={() => onGestureChange(true)} onTouchEnd={() => onGestureChange(false)} onTouchCancel={() => onGestureChange(false)} onPress={onEmpty} onDidFailLoadingMap={onUnavailable} onRegionWillChange={() => onGestureChange(true)} onRegionDidChange={(event) => { onGestureChange(false); const next = event.nativeEvent; if (Array.isArray(next.center) && next.center.length === 2 && Number.isFinite(next.zoom)) onCameraChange({ center: [next.center[0], next.center[1]], zoom: next.zoom }); }}>
    <Camera initialViewState={camera} minZoom={1} maxZoom={10} />
    <GeoJSONSource id="private-atlas-anchors" hitbox={{ top: 20, right: 20, bottom: 20, left: 20 }} testID="private-atlas-anchors" data={points} onPress={(event) => {
      event.stopPropagation?.();
      const journeyIds = [...new Set(event.nativeEvent.features.map((feature) => feature.properties?.journeyId).filter((id): id is string => typeof id === 'string'))];
      if (journeyIds.length) onChoose(journeyIds);
    }}>
      <Layer id="private-atlas-anchor-points" type="circle" paint={{ 'circle-radius': ['case', ['get', 'selected'], 13, 9], 'circle-color': ['case', ['get', 'selected'], palette.citrus, palette.sage], 'circle-stroke-color': palette.rainforest, 'circle-stroke-width': ['case', ['get', 'selected'], 4, 2] }} />
    </GeoJSONSource>
  </Map>;
}

export function mapCameraFor(anchors: RevealMapAnchor[]) {
  if (!anchors.length) return undefined;
  const latitudes = anchors.map((anchor) => anchor.latitude);
  const longitudes = anchors.map((anchor) => anchor.longitude);
  const minLatitude = Math.min(...latitudes); const maxLatitude = Math.max(...latitudes);
  const rawSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const unwrappedLongitudes = rawSpan > 180 ? longitudes.map((longitude) => longitude < 0 ? longitude + 360 : longitude) : longitudes;
  const minLongitude = Math.min(...unwrappedLongitudes); const maxLongitude = Math.max(...unwrappedLongitudes);
  const span = Math.max(1, maxLatitude - minLatitude, (maxLongitude - minLongitude) * 0.75);
  const midpoint = (minLongitude + maxLongitude) / 2;
  return { center: [midpoint > 180 ? midpoint - 360 : midpoint, (minLatitude + maxLatitude) / 2] as [number, number], zoom: Math.max(2, Math.min(8, Math.round(8 - Math.log2(span)))) };
}

function MapUnavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => { onUnavailable(); }, [onUnavailable]);
  return null;
}

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onOpenJourney, onCorrectJourney, loadJourneyPreview, loadJourneyMediaPage, initialExploration, mapAvailable = true, onMapGestureChange }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(): void; onReplay(): void; onOpenJourney?(id: string): void; onCorrectJourney?(id: string, context: AtlasExploration): void; loadJourneyPreview?(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number }>; loadJourneyMediaPage?(id: string, snapshotToken: number, page: number): Promise<{ page: import('@/reveal/types').JourneyMediaPage; previews: OwnerPreview[] }>; initialExploration?: AtlasExploration | null; mapAvailable?: boolean; onMapGestureChange?(active: boolean): void }) {
  const [view, setView] = useState<'map' | 'timeline'>(initialExploration?.view ?? 'map');
  const [year, setYear] = useState<number | null>(initialExploration?.year ?? null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(initialExploration?.selectedJourneyId ?? null);
  const [mapCamera, setMapCamera] = useState<AtlasCamera | undefined>(initialExploration?.camera);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [preview, setPreview] = useState<{ id: string; detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [overlapChoices, setOverlapChoices] = useState<string[] | null>(null);
  const requestId = useRef(0);
  const effectiveMapUnavailable = !mapAvailable || mapUnavailable;
  const exploration = deriveAtlasExploration(model.journeys, { view, year, selectedJourneyId });
  const cardPhoto = preview?.id === exploration.selectedJourneyId ? preview.previews.find((item) => item.kind === 'photo' && item.uri) ?? null : null;
  // A running reconciliation retains the previous durable projection. It is
  // truthful to explore that private, coarse map while its warning makes clear
  // that local updates may still change the next completed result.
  const canExplore = (model.state === 'ready' || model.state === 'processing') && model.journeys.length > 0;
  const selectYear = (nextYear: number | null) => {
    setYear(nextYear);
    setSelectedJourneyId((previous) => nextYear === null || model.journeys.some((journey) => journey.id === previous && journey.years.includes(nextYear)) ? previous : null);
  };
  const showMap = canExplore && view === 'map' && !effectiveMapUnavailable;
  const selectJourney = (id: string) => {
    setShowMedia(false);
    setPreviewError(null);
    setSelectedJourneyId(id);
    setOverlapChoices(null);
  };
  useEffect(() => {
    let active = true;
    const request = ++requestId.current;
    if (!exploration.selectedJourneyId || !loadJourneyPreview) return () => { active = false; };
    void loadJourneyPreview(exploration.selectedJourneyId).then((result) => {
      if (active && request === requestId.current && exploration.selectedJourneyId) setPreview({ id: exploration.selectedJourneyId, ...result });
    }).catch(() => { if (active && request === requestId.current) setPreviewError('This journey changed; choose it again.'); });
    return () => { active = false; };
  }, [exploration.selectedJourneyId, loadJourneyPreview]);
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Title>Your Atlas</Title><ActionButton accessibilityLabel="About your Atlas" onPress={() => setShowAbout(true)} variant="secondary">About</ActionButton></View>
    {model.state !== 'ready' && <Body>{model.message}</Body>}
    {showAbout && <InsetPanel><Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body><Body>{model.message}</Body><Body>The development map uses MapLibre demo tiles and may receive map viewport and tile requests. Travel Life does not submit journey records or media to it.</Body><ActionButton accessibilityLabel="Close About your Atlas" onPress={() => setShowAbout(false)} variant="secondary">Close</ActionButton></InsetPanel>}
    {model.state === 'sparse' && <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>No journey revealed yet.</Text>}
    {model.state === 'sparse' && <InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Local evidence check</Text>
      {model.diagnostics ? <>
        <Body>{model.diagnostics.assessed} records assessed; {model.diagnostics.supported} supported; {model.diagnostics.places} inferred places; {model.diagnostics.visits} inferred visits.</Body>
        <Body>Reasons without visit support: {model.diagnostics.insufficientLocation} insufficient location support; {model.diagnostics.missingDay} missing capture day; {model.diagnostics.invalidDay} invalid capture day; {model.diagnostics.unavailable} unavailable; {model.diagnostics.duplicateConflict} duplicate family conflict; {model.diagnostics.excluded} excluded by you.</Body>
        <Body>These are counts from the last completed local reconstruction. They do not prove where you were or that your lifetime history is complete.</Body>
      </> : <Body>No completed local evidence check is available yet. Recheck local journey history to produce one.</Body>}
    </InsetPanel>}
    {model.state === 'ready' && <View style={{ gap: 2 }}>
      <Text style={{ color: palette.sage, fontSize: 13, fontWeight: '700' }}>Inferred local record</Text>
      {model.statistics ? <>
        <Body>{model.statistics.journeyCount} inferred {model.statistics.journeyCount === 1 ? 'journey' : 'journeys'}.</Body>
        <Body>{model.statistics.placeCount} inferred {model.statistics.placeCount === 1 ? 'place' : 'places'}.</Body>
        <Body>{model.statistics.countryStatus === 'unavailable' ? 'Supported-country total is unavailable for this local record.' : model.statistics.supportedCountryCount === 0 ? 'No supported countries can be counted from this local record.' : `${model.statistics.supportedCountryCount} supported ${model.statistics.supportedCountryCount === 1 ? 'country' : 'countries'}.`}</Body>
      </> : <Body>Inferred totals are unavailable until a completed local reconstruction can be read.</Body>}
      <Body>Available private record; it may be incomplete.</Body>
    </View>}
    {canExplore && <View style={{ flexDirection: 'row', gap: 8 }}>
      <ActionButton accessibilityLabel="Show Atlas map" accessibilityState={{ selected: view === 'map' }} onPress={() => setView('map')} variant={view === 'map' ? 'primary' : 'secondary'}>Map</ActionButton>
      <ActionButton accessibilityLabel="Show chronological Timeline" accessibilityState={{ selected: view === 'timeline' }} onPress={() => setView('timeline')} variant={view === 'timeline' ? 'primary' : 'secondary'}>Timeline</ActionButton>
    </View>}
    {canExplore && <ScrollView horizontal contentContainerStyle={{ gap: 8 }} accessibilityLabel="Filter Atlas by year">
      <ActionButton accessibilityLabel="Show all years" accessibilityState={{ selected: year === null }} onPress={() => selectYear(null)} variant={year === null ? 'primary' : 'secondary'}>All years</ActionButton>
      {exploration.years.map((availableYear) => <ActionButton key={availableYear} accessibilityLabel={`Show journeys from ${availableYear}`} accessibilityState={{ selected: year === availableYear }} onPress={() => selectYear(availableYear)} variant={year === availableYear ? 'primary' : 'secondary'}>{String(availableYear)}</ActionButton>)}
    </ScrollView>}
    {showMap && <View style={{ position: 'relative' }}><NativeMap camera={mapCamera} onCameraChange={setMapCamera} journeys={exploration.visibleJourneys} selectedJourneyId={exploration.selectedJourneyId} onChoose={(ids) => ids.length === 1 ? selectJourney(ids[0]) : setOverlapChoices(ids)} onEmpty={() => { if (!overlapChoices) setSelectedJourneyId(null); }} onGestureChange={(active) => onMapGestureChange?.(active)} onUnavailable={() => setMapUnavailable(true)} />
      {exploration.selectedJourneyId && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}><InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>{preview?.id === exploration.selectedJourneyId ? preview.detail.ownerClaim?.title ?? 'Private journey' : 'Private journey'}</Text>
      {preview?.id === exploration.selectedJourneyId && <><Body>{preview.detail.ownerClaim ? 'Your title and date are shown separately from observed evidence.' : 'Observed evidence, not a claimed destination.'}</Body><Body>{preview.detail.observedSpan}</Body><Body>{preview.detail.correctionState ?? 'inferred'}</Body>{cardPhoto ? <><Image source={{ uri: cardPhoto.uri! }} style={{ height: 112, borderRadius: 12 }} accessibilityLabel="Associated photo preview" cachePolicy="memory" allowDownscaling /><Body>Associated photo.</Body></> : <Body>{preview.previews.some((item) => item.uri) ? 'Associated video available. Open photos and videos to play it.' : 'No accessible associated media yet.'}</Body>}</>}
      {previewError && <Body>{previewError}</Body>}
      {!preview && !previewError && <Body>Loading local journey preview.</Body>}
      <ActionButton accessibilityLabel="Close journey preview" onPress={() => setSelectedJourneyId(null)} variant="secondary">Close</ActionButton>
      {preview?.id === exploration.selectedJourneyId && <ActionButton accessibilityLabel="See photos and videos" onPress={() => setShowMedia(true)} disabled={!preview.detail.memories.length}>See photos and videos</ActionButton>}
      {onCorrectJourney && <ActionButton accessibilityLabel="Review or correct journey" onPress={() => onCorrectJourney(exploration.selectedJourneyId!, { view, year, selectedJourneyId: exploration.selectedJourneyId, camera: mapCamera })} variant="secondary">Review or correct journey</ActionButton>}
      {showMedia && preview?.id === exploration.selectedJourneyId && <JourneyMediaViewer detail={preview.detail} previews={preview.previews} loadPage={loadJourneyMediaPage && preview.snapshotToken !== undefined ? (page) => loadJourneyMediaPage(preview.id, preview.snapshotToken!, page) : undefined} onClose={() => setShowMedia(false)} />}
    </InsetPanel></View>}
      {overlapChoices && <InsetPanel><Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>Choose a journey</Text><Body>Several private journeys share this map area.</Body>{overlapChoices.map((id) => { const choice = exploration.visibleJourneys.find((journey) => journey.id === id); return choice ? <ActionButton key={id} accessibilityLabel={`Choose ${choice.label}`} onPress={() => selectJourney(id)} variant="secondary">{choice.label} · {choice.periodLabel} · {choice.status}</ActionButton> : null; })}<ActionButton accessibilityLabel="Cancel overlapping journey choice" onPress={() => setOverlapChoices(null)} variant="secondary">Cancel</ActionButton></InsetPanel>}
    </View>}
    {!showMap && exploration.selectedJourneyId && <InsetPanel><Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>{preview?.id === exploration.selectedJourneyId ? preview.detail.ownerClaim?.title ?? 'Private journey' : 'Private journey'}</Text>{preview?.id === exploration.selectedJourneyId ? <><Body>{preview.detail.observedSpan}</Body><Body>{preview.detail.correctionState ?? 'inferred'}</Body></> : previewError ? <Body>{previewError}</Body> : <Body>Loading local journey preview.</Body>}<ActionButton accessibilityLabel="Close journey preview" onPress={() => setSelectedJourneyId(null)} variant="secondary">Close</ActionButton>{preview?.id === exploration.selectedJourneyId && <ActionButton accessibilityLabel="See photos and videos" onPress={() => setShowMedia(true)} disabled={!preview.detail.memories.length}>See photos and videos</ActionButton>}{onCorrectJourney && <ActionButton accessibilityLabel="Review or correct journey" onPress={() => onCorrectJourney(exploration.selectedJourneyId!, { view, year, selectedJourneyId: exploration.selectedJourneyId, camera: mapCamera })} variant="secondary">Review or correct journey</ActionButton>}{showMedia && preview?.id === exploration.selectedJourneyId && <JourneyMediaViewer detail={preview.detail} previews={preview.previews} loadPage={loadJourneyMediaPage && preview.snapshotToken !== undefined ? (page) => loadJourneyMediaPage(preview.id, preview.snapshotToken!, page) : undefined} onClose={() => setShowMedia(false)} />}</InsetPanel>}
    {(effectiveMapUnavailable || !canExplore) && <InsetPanel><Body>{effectiveMapUnavailable ? 'The map is unavailable. Your local history Timeline is still available.' : 'Your local history Timeline is available below.'}</Body></InsetPanel>}
    <View style={{ gap: 2 }} accessibilityLabel="Chronological local journey Timeline">
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>Journeys · {exploration.visibleJourneys.length}</Text>
      {exploration.visibleJourneys.map((journey) => <ActionButton key={journey.id} accessibilityLabel={`${journey.label}, ${journey.periodLabel}${exploration.selectedJourneyId === journey.id ? ', selected' : ''}`} accessibilityState={{ selected: exploration.selectedJourneyId === journey.id }} onPress={() => selectJourney(journey.id)} variant="secondary"><Text style={{ color: palette.limestone, fontWeight: '700' }}>{journey.label}</Text><Text style={{ color: palette.sage }}>{journey.periodLabel} · {journey.status}{journey.ordering === 'Order uncertain' ? ' · order uncertain' : ''}{journey.hasMapSupport ? '' : ' · location unknown'}</Text></ActionButton>)}
        {year !== null && !exploration.visibleJourneys.length && <Body>No journeys have an observed visit in {year}. Choose All years to see the full available record.</Body>}
        {!model.journeys.length && <Body>No supported journey is available to show.</Body>}
    </View>
    {model.replay.eligible ? <ActionButton accessibilityLabel="Check Replay availability" onPress={onReplay}>Explore Replay availability</ActionButton> : <InsetPanel><Body>{model.replay.reason}</Body></InsetPanel>}
    {model.state === 'processing' && <ActionButton accessibilityLabel="Catch up local journey history" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton>}
    {model.state === 'failed' && <ActionButton accessibilityLabel="Retry local reveal" onPress={onRetry} variant="secondary">Retry local reveal</ActionButton>}
    {model.state === 'sparse' && <ActionButton accessibilityLabel="Recheck local journey history" onPress={onRetry} variant="secondary">Recheck local journey history</ActionButton>}
    {(model.state === 'sparse' || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Import or reconnect photos</ActionButton>}
    {(model.state === 'sparse' || model.state === 'failed') && <ActionButton accessibilityLabel="Add a journey manually" onPress={onManualEntry} variant="secondary">Add a journey manually</ActionButton>}
  </View>;
}
