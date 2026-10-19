import { useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { ActionButton, Body, InsetPanel, palette, Title } from '@/components/ui';
import { JourneyMediaViewer } from '@/components/journey-media-viewer';
import type { OwnerPreview } from '@/photo-access/types';
import type { AtlasCamera, AtlasExploration, JourneyDetail, RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';
import { projectAtlasAnchor } from '../../../../shared/atlas-cartography/projection';

/** Retained as a migration guard: the visual base has no MapLibre style URL in any build. */
export function mapLibreDevelopmentStyle(_isDevelopment?: boolean) { return null; }

/** A provider-free visual master. The source image was supplied by the owner and is bundled with the app. */
function OfflineAtlasMap({ onChoose, onEmpty, onGestureChange, journeys, selectedJourneyId }: { onChoose: (ids: string[]) => void; onEmpty: () => void; onGestureChange(active: boolean): void; journeys: RevealJourney[]; selectedJourneyId: string | null }) {
  const anchored = journeys.filter((journey): journey is RevealJourney & { mapAnchor: RevealMapAnchor } => journey.mapAnchor !== null);
  const grouped = new Map<string, (RevealJourney & { mapAnchor: RevealMapAnchor })[]>();
  for (const journey of anchored) {
    const point = projectAtlasAnchor(journey.mapAnchor);
    if (!point) continue;
    const key = `${Math.round(point.x / 4)}-${Math.round(point.y / 4)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), journey]);
  }
  return <ImageBackground source={require('../../assets/atlas/world-map-reference.jpg')} imageStyle={styles.mapImage} style={styles.map} accessibilityLabel="Offline private world map" testID="private-atlas-map">
    <Pressable accessibilityRole="button" accessibilityLabel="Clear selected Atlas journey" onPress={onEmpty} onPressIn={() => onGestureChange(true)} onPressOut={() => onGestureChange(false)} style={StyleSheet.absoluteFill} />
    {[...grouped.values()].map((journeysAtPoint) => {
      const point = projectAtlasAnchor(journeysAtPoint[0].mapAnchor)!;
      const selected = journeysAtPoint.some((journey) => journey.id === selectedJourneyId);
      const names = journeysAtPoint.map((journey) => journey.id);
      return <Pressable key={names.join(':')} accessibilityRole="button" accessibilityLabel={names.length === 1 ? `Select ${journeysAtPoint[0].label}` : `Select ${names.length} overlapping private journeys`} accessibilityState={{ selected }} onPress={() => onChoose(names)} style={[styles.anchor, { left: `${point.x}%`, top: `${point.y}%` }, selected && styles.anchorSelected]} testID="private-atlas-anchors"><View style={styles.anchorCore}><Text style={styles.anchorText}>{names.length > 1 ? names.length : '•'}</Text></View></Pressable>;
    })}
  </ImageBackground>;
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

export function AtlasReveal({ model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onOpenJourney, onCorrectJourney, loadJourneyPreview, loadJourneyMediaPage, initialExploration, mapAvailable: _mapAvailable = true, onMapGestureChange }: { model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(): void; onReplay(): void; onOpenJourney?(id: string): void; onCorrectJourney?(id: string, context: AtlasExploration): void; loadJourneyPreview?(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number }>; loadJourneyMediaPage?(id: string, snapshotToken: number, page: number): Promise<{ page: import('@/reveal/types').JourneyMediaPage; previews: OwnerPreview[] }>; initialExploration?: AtlasExploration | null; mapAvailable?: boolean; onMapGestureChange?(active: boolean): void }) {
  const [view, setView] = useState<'map' | 'timeline'>(initialExploration?.view ?? 'map');
  const [year, setYear] = useState<number | null>(initialExploration?.year ?? null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(initialExploration?.selectedJourneyId ?? null);
  const [mapCamera, setMapCamera] = useState<AtlasCamera | undefined>(initialExploration?.camera);
  const [preview, setPreview] = useState<{ id: string; detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [overlapChoices, setOverlapChoices] = useState<string[] | null>(null);
  const requestId = useRef(0);
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
  // The bundled public base deliberately remains visible before a local journey exists.
  const showMap = view === 'map';
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
    {showAbout && <InsetPanel><Body>{model.coverage} It may be incomplete and is not a lifetime claim.</Body><Body>{model.message}</Body><Body>This Atlas base is bundled in the app. It does not request map tiles or submit journey records or media.</Body><ActionButton accessibilityLabel="Close About your Atlas" onPress={() => setShowAbout(false)} variant="secondary">Close</ActionButton></InsetPanel>}
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
    {showMap && <View style={{ position: 'relative' }}><OfflineAtlasMap journeys={exploration.visibleJourneys} selectedJourneyId={exploration.selectedJourneyId} onChoose={(ids) => ids.length === 1 ? selectJourney(ids[0]) : setOverlapChoices(ids)} onEmpty={() => { if (!overlapChoices) setSelectedJourneyId(null); }} onGestureChange={(active) => onMapGestureChange?.(active)} />
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
    {!canExplore && <InsetPanel><Body>Your local history Timeline is available below.</Body></InsetPanel>}
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

const styles = StyleSheet.create({
  map: { height: 390, borderRadius: 20, overflow: 'hidden', backgroundColor: '#071726', position: 'relative' },
  mapImage: { resizeMode: 'cover', opacity: 0.98 },
  anchor: { position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(6, 24, 42, 0.72)', borderWidth: 1, borderColor: '#00b4d8' },
  anchorSelected: { borderColor: '#f8961e', borderWidth: 3, backgroundColor: 'rgba(243, 114, 44, 0.78)' },
  anchorCore: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#e9c46a', alignItems: 'center', justifyContent: 'center' },
  anchorText: { color: '#0b132b', fontSize: 12, fontWeight: '900' },
});
