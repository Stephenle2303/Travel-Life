import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { ActionButton, Body, InsetPanel, palette, Title, useReducedMotion } from '@/components/ui';
import { JourneyMediaViewer } from '@/components/journey-media-viewer';
import type { OwnerPreview } from '@/photo-access/types';
import type { AtlasCamera, AtlasExploration, JourneyDetail, RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';
import { MapLibreAtlasMap } from '@/components/maplibre-atlas-map';
import { atlasBasemapConfig } from '@/atlas/basemap-config';



// This is deliberately local to Atlas. It is an approved map-surface extension,
// not a replacement for the Living Atlas palette used by the rest of the app.
const atlas = {
  void: '#0B132B',
  midnight: '#1C2541',
  glass: 'rgba(19,27,49,0.75)',
  luminous: '#1F3159',
  cyan: '#4EA8DE',
  cyanBright: '#00B4D8',
  amber: '#F3722C',
  gold: '#E9C46A',
  secondary: '#8D99AE',
} as const;

function normalizeLocalSearch(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function matchesLocalSearch(journey: RevealJourney, query: string) {
  if (!query) return true;
  const searchable = `${journey.label} ${journey.periodLabel} ${journey.status}`.toLocaleLowerCase();
  return searchable.includes(query.toLocaleLowerCase());
}

/** Atlas never animates map state automatically. Reduced motion also removes the card fade. */
export function atlasMotionPolicy(reducedMotion: boolean) {
  return { cardAnimation: reducedMotion ? 'none' as const : 'fade' as const, hasDecorativeMotion: false };
}

export function mapLibreDevelopmentStyle(_isDevelopment?: boolean) {
  return null;
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

function JourneyPreviewSheet({ journey, preview, previewError, onClose, onMedia, onEdit, reducedMotion, children }: { journey: RevealJourney | null; preview: { id: string; detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number } | null; previewError: string | null; onClose(): void; onMedia(): void; onEdit?(): void; reducedMotion: boolean; children?: ReactNode }) {
  const cardPhoto = preview && preview.id === journey?.id ? preview.previews.find((item) => item.kind === 'photo' && item.uri) ?? null : null;
  if (!journey) return null;
  return <Modal visible transparent animationType={atlasMotionPolicy(reducedMotion).cardAnimation} onRequestClose={onClose}><View testID="journey-preview-sheet" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)', padding: 12 }}><InsetPanel>
    <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>{preview?.id === journey.id ? preview.detail.ownerClaim?.title ?? preview.detail.ownerPlace?.name ?? journey.label : journey.label}</Text>
    {preview?.id === journey.id ? <><Body>{preview.detail.ownerEntered ? 'Owner-entered broad area and date claim. It has no observed evidence or associated media.' : preview.detail.ownerPlace ? `Confirmed place: ${preview.detail.ownerPlace.name}, ${preview.detail.ownerPlace.context}. This local selection controls the Atlas marker.` : preview.detail.ownerClaim ? 'Your title and date are shown separately from observed evidence.' : 'Observed evidence, not a claimed destination.'}</Body><Body>{journey.periodLabel}</Body><Body>{preview.detail.observedSpan}</Body>{!preview.detail.ownerEntered && <Body>{preview.detail.correctionState ?? 'inferred'}</Body>}{cardPhoto ? <><Image source={{ uri: cardPhoto.uri! }} style={{ height: 112, borderRadius: 12 }} accessibilityLabel="Associated photo preview" cachePolicy="memory" allowDownscaling /><Body>Associated photo.</Body></> : <Body>{preview.detail.ownerEntered ? 'No media is attached to this owner-entered journey.' : preview.previews.some((item) => item.uri) ? 'Associated video available. Open photos and videos to play it.' : 'No accessible associated media yet.'}</Body>}</> : previewError ? <Body>{previewError}</Body> : <Body>Loading local journey preview.</Body>}
    <ActionButton accessibilityLabel="Close journey preview" onPress={onClose} variant="secondary">Close</ActionButton>
    {preview?.id === journey.id && <ActionButton accessibilityLabel="See photos and videos" onPress={onMedia} disabled={!preview.detail.memories.length}>See photos and videos</ActionButton>}
    {onEdit && !preview?.detail.ownerEntered && <ActionButton accessibilityLabel="Edit trip" onPress={onEdit} variant="secondary">Edit</ActionButton>}
    {children}
  </InsetPanel></View></Modal>;
}

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onSettings, onOpenJourney, onEditJourney, loadJourneyPreview, loadJourneyMediaPage, initialExploration, mapAvailable = true, onMapGestureChange }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(context: AtlasExploration): void; onReplay(): void; onSettings?(): void; onOpenJourney?(id: string): void; onEditJourney?(id: string, context: AtlasExploration): void; loadJourneyPreview?(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number }>; loadJourneyMediaPage?(id: string, snapshotToken: number, page: number): Promise<{ page: import('@/reveal/types').JourneyMediaPage; previews: OwnerPreview[] }>; initialExploration?: AtlasExploration | null; mapAvailable?: boolean; onMapGestureChange?(active: boolean): void }) {
  const [view, setView] = useState<'map' | 'timeline'>(initialExploration?.view ?? 'map');
  const [year, setYear] = useState<number | null>(initialExploration?.year ?? null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(initialExploration?.selectedJourneyId ?? null);
  const [mapCamera, setMapCamera] = useState<AtlasCamera | undefined>(initialExploration?.camera);
  const [localViewport] = useState(initialExploration?.localViewport);
  const [preview, setPreview] = useState<{ id: string; detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [mapStyleFailed, setMapStyleFailed] = useState(false);
  const [overlapChoices, setOverlapChoices] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const editJourney = (id: string) => onEditJourney?.(id, { view, year, selectedJourneyId: id, camera: mapCamera, localViewport });
  const requestId = useRef(0);
  const reducedMotion = useReducedMotion();
  const unfilteredExploration = deriveAtlasExploration(model.journeys, { view, year, selectedJourneyId });
  const visibleJourneys = unfilteredExploration.visibleJourneys.filter((journey) => matchesLocalSearch(journey, search));
  const exploration = { ...unfilteredExploration, visibleJourneys, selectedJourneyId: visibleJourneys.some((journey) => journey.id === selectedJourneyId) ? selectedJourneyId : null };
  // A running reconciliation or a failed retry retains the previous durable
  // projection. It remains safe to browse that already-committed local record;
  // the notice makes clear that it is not the result of the failed rebuild.
  // Do not turn a rebuild failure into a loss of access to the owner's photos.
  const canExplore = (model.state === 'ready' || model.state === 'processing' || model.state === 'failed') && model.journeys.length > 0;
  const selectYear = (nextYear: number | null) => {
    setYear(nextYear);
    setSelectedJourneyId((previous) => nextYear === null || model.journeys.some((journey) => journey.id === previous && journey.years.includes(nextYear)) ? previous : null);
  };
  const changeSearch = (value: string) => {
    const nextSearch = normalizeLocalSearch(value);
    setSearch(nextSearch);
    setSelectedJourneyId((previous) => model.journeys.some((journey) => journey.id === previous && (year === null || journey.years.includes(year)) && matchesLocalSearch(journey, nextSearch)) ? previous : null);
    setOverlapChoices(null);
  };
  const showMap = view === 'map' && canExplore;
  const basemap = atlasBasemapConfig();
  const hasAnchoredJourney = exploration.visibleJourneys.some((journey) => journey.mapAnchor);
  const useProviderMap = Platform.OS !== 'web' && mapAvailable && basemap.enabled && !mapStyleFailed && hasAnchoredJourney;
  const providerCamera = mapCamera ?? mapCameraFor(exploration.visibleJourneys.flatMap((journey) => journey.mapAnchor ? [journey.mapAnchor] : []));
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
  return <View style={{ gap: 14, backgroundColor: atlas.void, marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><View><Text style={{ color: atlas.cyan, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 }}>PRIVATE ATLAS</Text><Title>Your Atlas</Title></View><View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>{onSettings && <ActionButton accessibilityLabel="Open Home bases" onPress={onSettings} variant="secondary">Homes</ActionButton>}<ActionButton accessibilityLabel="About your Atlas" onPress={() => setShowAbout(true)} variant="secondary">About</ActionButton></View></View>
    {model.state === 'processing' ? <InsetPanel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="Local journey rebuild in progress" accessibilityState={{ busy: true }}>
        <ActivityIndicator color={palette.citrus} />
        <Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>Updating your Atlas</Text>
      </View>
      <Body>{model.message}</Body>
      <Body>You can keep this screen open. Check the map and journeys again when this notice disappears.</Body>
    </InsetPanel> : model.state === 'failed' ? <InsetPanel><Body>{model.message}</Body><Body>You can still browse the last committed journeys and their associated photos below while recovery is retried.</Body></InsetPanel> : model.state !== 'ready' && <Body>{model.message}</Body>}
    {showAbout && <InsetPanel><Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body><Body>{model.message}</Body><Body>{useProviderMap ? 'The configured map provider receives style and tile requests, which disclose the viewed map area and ordinary network metadata. Travel Life does not send private journeys, media, source IDs, or precise locations with those requests.' : 'Map data is unavailable, so Atlas remains in its Timeline recovery state. Your local journeys remain available.'}</Body><ActionButton accessibilityLabel="Close About your Atlas" onPress={() => setShowAbout(false)} variant="secondary">Close</ActionButton></InsetPanel>}
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
      <Body>{model.journeys.filter((journey) => journey.status === 'Owner-entered').length} owner-entered {model.journeys.filter((journey) => journey.status === 'Owner-entered').length === 1 ? 'journey' : 'journeys'} kept separately from inferred totals.</Body>
      <Body>Available private record; it may be incomplete.</Body>
    </View>}
    <View style={{ gap: 8, padding: 12, borderRadius: 18, backgroundColor: atlas.glass, borderWidth: 1, borderColor: 'rgba(78,168,222,0.35)' }}>
      <TextInput value={search} onChangeText={changeSearch} accessibilityLabel="Search visible Atlas journeys locally" placeholder="Search this private Atlas" placeholderTextColor={atlas.secondary} autoCorrect={false} autoCapitalize="none" style={{ minHeight: 48, color: palette.limestone, borderWidth: 1, borderColor: 'rgba(78,168,222,0.5)', borderRadius: 12, paddingHorizontal: 14, backgroundColor: atlas.midnight }} />
      {canExplore && <Body style={{ color: atlas.secondary }}>Search stays on this device and only filters the journeys already visible here.</Body>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
      <ActionButton accessibilityLabel="Show Atlas map" accessibilityState={{ selected: view === 'map' }} onPress={() => setView('map')} variant={view === 'map' ? 'primary' : 'secondary'}>Map</ActionButton>
      <ActionButton accessibilityLabel="Show chronological Timeline" accessibilityState={{ selected: view === 'timeline' }} onPress={() => setView('timeline')} variant={view === 'timeline' ? 'primary' : 'secondary'}>Timeline</ActionButton>
      </View>
    </View>
    {canExplore && <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 2 }} accessibilityLabel="Filter Atlas by year">
      <ActionButton accessibilityLabel="Show all years" accessibilityState={{ selected: year === null }} onPress={() => selectYear(null)} variant={year === null ? 'primary' : 'secondary'}>All years</ActionButton>
      {exploration.years.map((availableYear) => <ActionButton key={availableYear} accessibilityLabel={`Show journeys from ${availableYear}`} accessibilityState={{ selected: year === availableYear }} onPress={() => selectYear(availableYear)} variant={year === availableYear ? 'primary' : 'secondary'}>{String(availableYear)}</ActionButton>)}
    </ScrollView>}
    {showMap && <View style={{ position: 'relative' }}>{useProviderMap ? <MapLibreAtlasMap styleUrl={basemap.styleUrl} journeys={exploration.visibleJourneys} selectedJourneyId={exploration.selectedJourneyId} camera={providerCamera} onChoose={(ids) => ids.length === 1 ? selectJourney(ids[0]) : setOverlapChoices(ids)} onEmpty={() => { if (!overlapChoices) setSelectedJourneyId(null); }} onStyleFailure={() => { onMapGestureChange?.(false); setMapStyleFailed(true); }} onGestureChange={(active) => onMapGestureChange?.(active)} onCameraChange={setMapCamera} /> : <InsetPanel><Text testID="atlas-map-recovery" style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>{hasAnchoredJourney ? 'Map data unavailable' : 'No map location for this filter'}</Text><Body>{!hasAnchoredJourney ? 'No selected journey has a map anchor. Choose All years or use the Timeline.' : mapStyleFailed ? 'The configured map could not load. Use the Timeline while it is recovered.' : 'Configure a valid map style to show provider cartography. Your local journeys remain in the Timeline.'}</Body>{mapStyleFailed && basemap.enabled && <ActionButton accessibilityLabel="Retry configured Atlas map" onPress={() => setMapStyleFailed(false)} variant="secondary">Retry map</ActionButton>}<ActionButton accessibilityLabel="Show chronological Timeline from map recovery" onPress={() => setView('timeline')} variant="secondary">Open Timeline</ActionButton></InsetPanel>}
      {overlapChoices && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, borderRadius: 18, backgroundColor: atlas.glass, borderWidth: 1, borderColor: 'rgba(78,168,222,0.35)' }}><Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>Choose a journey</Text><Body>Several private journeys share this map area.</Body>{overlapChoices.map((id) => { const choice = exploration.visibleJourneys.find((journey) => journey.id === id); return choice ? <ActionButton key={id} accessibilityLabel={`Choose ${choice.label}`} onPress={() => selectJourney(id)} variant="secondary">{choice.label} · {choice.periodLabel} · {choice.status}</ActionButton> : null; })}<ActionButton accessibilityLabel="Cancel overlapping journey choice" onPress={() => setOverlapChoices(null)} variant="secondary">Cancel</ActionButton></View>}
    </View>}
    <JourneyPreviewSheet journey={exploration.visibleJourneys.find((journey) => journey.id === exploration.selectedJourneyId) ?? null} preview={preview} previewError={previewError} onClose={() => { setShowMedia(false); setSelectedJourneyId(null); }} onMedia={() => setShowMedia(true)} onEdit={onEditJourney && exploration.selectedJourneyId ? () => editJourney(exploration.selectedJourneyId!) : undefined} reducedMotion={reducedMotion} />
    {showMedia && preview?.id === exploration.selectedJourneyId && <JourneyMediaViewer detail={preview.detail} previews={preview.previews} sessionKey={`${preview.id}:${preview.snapshotToken ?? 'preview'}`} loadPage={loadJourneyMediaPage && preview.snapshotToken !== undefined ? (page) => loadJourneyMediaPage(preview.id, preview.snapshotToken!, page) : undefined} onClose={() => setShowMedia(false)} />}
    {!canExplore && <InsetPanel><Body>Your local journey Timeline will appear below after a supported journey is available.</Body></InsetPanel>}
    <View style={{ gap: 2 }} accessibilityLabel="Chronological local journey Timeline">
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>Journeys · {exploration.visibleJourneys.length}</Text>
      {exploration.visibleJourneys.map((journey) => <View key={journey.id} style={{ gap: 4 }}><ActionButton accessibilityLabel={`${journey.label}, ${journey.periodLabel}${exploration.selectedJourneyId === journey.id ? ', selected' : ''}`} accessibilityState={{ selected: exploration.selectedJourneyId === journey.id }} onPress={() => selectJourney(journey.id)} variant="secondary"><Text style={{ color: palette.limestone, fontWeight: '700' }}>{journey.label}{'\n'}<Text style={{ color: palette.sage }}>{journey.periodLabel} · {journey.status}{journey.ordering === 'Order uncertain' ? ' · order uncertain' : ''}{journey.hasMapSupport ? '' : ' · location unknown'}</Text></Text></ActionButton></View>)}
        {!exploration.visibleJourneys.length && search.length > 0 && <Body>No visible local journeys match “{search}”. Clear or change the local search.</Body>}
        {year !== null && !exploration.visibleJourneys.length && !search.length && <Body>No journeys have an observed visit in {year}. Choose All years to see the full available record.</Body>}
        {!model.journeys.length && <Body>No supported journey is available to show.</Body>}
    </View>
    {model.replay.eligible ? <ActionButton accessibilityLabel="Check Replay availability" onPress={onReplay}>Explore Replay availability</ActionButton> : <InsetPanel><Body>{model.replay.reason}</Body></InsetPanel>}
    {model.state === 'ready' && <ActionButton accessibilityLabel="Rebuild local journey history" onPress={onRetry} variant="secondary">Rebuild local journey history</ActionButton>}
    {model.state === 'processing' && <ActionButton accessibilityLabel="Catch up local journey history" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton>}
    {model.state === 'failed' && <ActionButton accessibilityLabel="Retry local reveal" onPress={onRetry} variant="secondary">Retry local reveal</ActionButton>}
    {model.state === 'sparse' && <ActionButton accessibilityLabel="Recheck local journey history" onPress={onRetry} variant="secondary">Recheck local journey history</ActionButton>}
    {(model.state === 'sparse' || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Import or reconnect photos</ActionButton>}
    {(model.state === 'ready' || model.state === 'sparse' || model.state === 'failed' || model.state === 'restricted') && <ActionButton accessibilityLabel="Add a journey manually" onPress={() => onManualEntry({ view, year, selectedJourneyId, camera: mapCamera, localViewport })} variant="secondary">Add a journey manually</ActionButton>}
  </View>;
}
