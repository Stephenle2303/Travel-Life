import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

import { ActionButton as SharedActionButton, Body, InsetPanel, palette, Title, useReducedMotion } from '@/components/ui';
import { JourneyMediaViewer } from '@/components/journey-media-viewer';
import { TripCoverFallback, TripListCard, tripListCardStyles } from '@/components/trip-list-card';
import { LocalTripMediaCover } from '@/components/local-trip-media-cover';
import { TimelineMergeCue, TimelineMergeReview, type ConfirmTimelineMerge } from '@/components/timeline-merge-review';
import type { OwnerPreview } from '@/photo-access/types';
import type { AtlasCamera, AtlasExploration, JourneyDetail, JourneyMergePair, RevealJourney, RevealMapAnchor, RevealModel } from '@/reveal/types';
import { deriveAtlasExploration } from '@/reveal/projection';
import { MapLibreAtlasMap } from '@/components/maplibre-atlas-map';
import { atlasBasemapConfig } from '@/atlas/basemap-config';
import { classifyAppDiagnosticError, createDiagnosticCorrelationId, JourneyPreviewBoundaryError, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';



// This is deliberately local to Atlas. It is an approved map-surface extension,
// not a replacement for the Living Atlas palette used by the rest of the app.
const ignoreMapGesture = () => {};

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

export function AtlasActionButton({ children, variant = 'primary', accessibilityState, accessibilityLabel, onPress, disabled }: ComponentProps<typeof SharedActionButton>) {
  const selected = accessibilityState?.selected;
  const prominent = variant === 'primary' && selected === undefined;
  return <Pressable
    accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ ...accessibilityState, disabled }}
    onPress={onPress} disabled={disabled}
    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: prominent ? atlas.cyan : selected ? atlas.luminous : atlas.glass, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 })}>
    <Text style={{ color: prominent ? atlas.void : palette.limestone, fontWeight: '700', textDecorationLine: selected ? 'underline' : 'none' }}>{children}</Text>
  </Pressable>;
}

const ActionButton = AtlasActionButton;

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
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const cardPhoto = preview && preview.id === journey?.id ? preview.previews.find((item) => item.kind === 'photo' && item.uri) ?? null : null;
  if (!journey) return null;
  return <Modal visible transparent animationType={atlasMotionPolicy(reducedMotion).cardAnimation} onRequestClose={onClose}><View testID="journey-preview-sheet" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)', padding: 12 }}><ScrollView style={{ flexGrow: 0, maxHeight: '85%' }}><InsetPanel style={{ backgroundColor: atlas.midnight }}>
    {cardPhoto && <Image source={{ uri: cardPhoto.uri! }} style={{ height: 144, borderRadius: 12 }} accessibilityLabel="Associated photo preview" cachePolicy="memory" allowDownscaling />}
    <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>{preview?.id === journey.id ? preview.detail.ownerClaim?.title ?? preview.detail.ownerPlace?.name ?? journey.label : journey.label}</Text>
    {journey.status === 'Needs review' && <Body>Needs review</Body>}
    <Body>{journey.periodLabel}</Body>
    {preview?.id === journey.id ? <>
      <ActionButton onPress={() => setEvidenceOpen(!evidenceOpen)} variant="secondary">{evidenceOpen ? 'Hide evidence details' : 'Evidence details'}</ActionButton>
      {evidenceOpen && <>
        {preview.detail.ownerClaim?.date && <Body>Your dates: {preview.detail.ownerClaim.date.kind === 'exact' ? preview.detail.ownerClaim.date.day : [preview.detail.ownerClaim.date.startDay, preview.detail.ownerClaim.date.endDay].join(' – ')}</Body>}
        <Body>Photo dates: {preview.detail.observedSpan}</Body>
        {!!preview.detail.destinationNames?.length && <Body>{preview.detail.destinationNames.join(' · ')}</Body>}
        <Body>{preview.detail.ownerEntered
          ? preview.detail.memories.length ? 'Added by you with album photos. Capture locations are unknown.' : 'Added by you. No observed evidence.'
          : preview.detail.ownerPlace ? 'Your selected place controls the Atlas marker.' : 'Photo locations do not prove presence.'}</Body>
      </>}
      {preview.detail.memories.length > 0 ? <ActionButton accessibilityLabel="See photos and videos" onPress={onMedia}>See photos</ActionButton> : !cardPhoto && <Body>No photos available</Body>}
    </> : <Body>{previewError ?? 'Loading local journey preview.'}</Body>}
    {onEdit && !preview?.detail.ownerEntered && <ActionButton accessibilityLabel="Edit trip" onPress={onEdit} variant="secondary">Edit</ActionButton>}
    <ActionButton accessibilityLabel="Close journey preview" onPress={onClose} variant="secondary">Close</ActionButton>
    {children}
  </InsetPanel></ScrollView></View></Modal>;
}

type RecognizableAtlasSlots = {
  observed: readonly RevealMapAnchor[];
  featured?: (openTimeline: () => void) => ReactNode;
  possibleTrips?: ReactNode;
};

export function AtlasReveal({ preparing = false, preparationStatus, sourceControls, visualRecovery, model, onImport, onRetry, onCatchUp, onManualEntry, onReplay, onSettings, onHome, onOpenJourney, onEditJourney, loadJourneyPreview, loadJourneyMediaPage, inspectJourneyMedia, initialExploration, onExplorationChange, externalReplay = false, mapAvailable = true, onMapGestureChange, confirmTimelineMerge, recognizable, possibleTrips }: { preparing?: boolean; preparationStatus?: ReactNode; sourceControls?: ReactNode; visualRecovery?: ReactNode; model: RevealModel; onImport(): void; onRetry(): void; onCatchUp(): void; onManualEntry(context: AtlasExploration): void; onReplay(context: AtlasExploration): void; onSettings?(context: AtlasExploration): void; onHome?(context: AtlasExploration): void; onOpenJourney?(id: string): void; onEditJourney?(id: string, context: AtlasExploration): void; loadJourneyPreview?(id: string): Promise<{ detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number }>; loadJourneyMediaPage?(id: string, snapshotToken: number, page: number): Promise<{ page: import('@/reveal/types').JourneyMediaPage; previews: OwnerPreview[] }>; inspectJourneyMedia?(id: string, run: number, itemId: string, uri: string | null): Promise<string>; initialExploration?: AtlasExploration | null; onExplorationChange?(context: AtlasExploration): void; externalReplay?: boolean; mapAvailable?: boolean; onMapGestureChange?(active: boolean): void; confirmTimelineMerge?: ConfirmTimelineMerge; recognizable?: RecognizableAtlasSlots;
  /** CAP-3 (detector-v1-2.md): the real Possible-trips card section. Independent of `recognizable`'s dev-preview overlay (consolidation.md) — always rendered when the model has content. */
  possibleTrips?: ReactNode }) {
  const [view, setView] = useState<'map' | 'timeline'>(initialExploration?.view ?? 'map');
  const [year, setYear] = useState<number | null>(initialExploration?.year ?? null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(initialExploration?.selectedJourneyId ?? null);
  const [mapCamera, setMapCamera] = useState<AtlasCamera | undefined>(initialExploration?.camera);
  const [observedCamera, setObservedCamera] = useState<{ points: readonly RevealMapAnchor[]; camera: AtlasCamera }>();
  const [localViewport] = useState(initialExploration?.localViewport);
  const [preview, setPreview] = useState<{ id: string; detail: JourneyDetail; previews: OwnerPreview[]; snapshotToken?: number } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [timelineCovers, setTimelineCovers] = useState<Record<string, OwnerPreview | null>>({});
  const [showMedia, setShowMedia] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [mergeReview, setMergeReview] = useState<{ pair: JourneyMergePair; left: RevealJourney; right: RevealJourney } | null>(null);
  const [mapStyleFailed, setMapStyleFailed] = useState(false);
  const [overlapChoices, setOverlapChoices] = useState<string[] | null>(null);
  const [showYears, setShowYears] = useState(false);
  const [timelineAnchor, setTimelineAnchor] = useState(initialExploration?.timelineAnchor);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [search, setSearch] = useState(initialExploration?.query ?? '');
  const editJourney = (id: string) => onEditJourney?.(id, { ...context, selectedJourneyId: id });
  const requestId = useRef(0);
  const timelineCoverRequests = useRef(new Set<string>());
  const reducedMotion = useReducedMotion();
  const { height, width, fontScale } = useWindowDimensions();
  const wide = width >= 768 && width / Math.max(1, fontScale) >= 768;
  const unfilteredExploration = deriveAtlasExploration(model.journeys, { view, year, selectedJourneyId });
  const visibleJourneys = reviewOnly ? model.journeys.filter((journey) => journey.status === 'Needs review') : unfilteredExploration.visibleJourneys.filter((journey) => matchesLocalSearch(journey, search));
  const exploration = { ...unfilteredExploration, visibleJourneys, selectedJourneyId: visibleJourneys.some((journey) => journey.id === selectedJourneyId) ? selectedJourneyId : null };
  const pageSize = 24;
  const anchorIndex = timelineAnchor ? visibleJourneys.findIndex((journey) => journey.id === timelineAnchor.id) : 0;
  const lastIndex = Math.max(0, visibleJourneys.length - 1);
  const targetIndex = anchorIndex >= 0 ? anchorIndex : Math.min(timelineAnchor?.index ?? 0, lastIndex);
  const pageStart = Math.floor(targetIndex / pageSize) * pageSize;
  const showTimeline = view === 'timeline' || (wide && visibleJourneys.length > 0);
  const rows = showTimeline ? visibleJourneys.slice(pageStart, pageStart + pageSize) : [];
  const rowPositions = new Map(rows.map(({ id }, index) => [id, index]));
  const journeysById = new Map(model.journeys.map((journey) => [journey.id, journey]));
  const mergeCues = new Map<string, { pair: JourneyMergePair; left: RevealJourney; right: RevealJourney; connected: boolean }[]>();
  if (confirmTimelineMerge && loadJourneyPreview && model.state === 'ready' && !reviewOnly) {
    for (const pair of model.mergePairs ?? []) {
      const left = journeysById.get(pair.leftId);
      const right = journeysById.get(pair.rightId);
      if (!left || !right) continue;
      const leftPosition = rowPositions.get(left.id) ?? Infinity;
      const rightPosition = rowPositions.get(right.id) ?? Infinity;
      const anchor = rows[Math.min(leftPosition, rightPosition)];
      if (!anchor) continue;
      const cues = mergeCues.get(anchor.id) ?? [];
      cues.push({ pair, left, right, connected: Math.abs(leftPosition - rightPosition) === 1 });
      mergeCues.set(anchor.id, cues);
    }
  }
  const anchorId = visibleJourneys[targetIndex]?.id;
  const changePage = (index: number) => {
    const journey = visibleJourneys[index];
    if (journey) setTimelineAnchor({ id: journey.id, index });
  };
  const context = { view, year, selectedJourneyId: exploration.selectedJourneyId, camera: mapCamera, localViewport, query: search, timelineAnchor: anchorId ? { id: anchorId, index: targetIndex } : undefined };
  useEffect(() => {
    onExplorationChange?.({ view, year, selectedJourneyId: exploration.selectedJourneyId, camera: mapCamera, localViewport, query: search, timelineAnchor: anchorId ? { id: anchorId, index: targetIndex } : undefined });
  }, [onExplorationChange, view, year, exploration.selectedJourneyId, mapCamera, localViewport, search, anchorId, targetIndex]);
  const visibleJourneyIds = rows.map((journey) => journey.id).join('|');
  // A running reconciliation or a failed retry retains the previous durable
  // projection. It remains safe to browse that already-committed local record;
  // the notice makes clear that it is not the result of the failed rebuild.
  // Do not turn a rebuild failure into a loss of access to the owner's photos.
  const canExplore = (model.state === 'ready' || model.state === 'processing' || model.state === 'failed') && model.journeys.length > 0;
  const selectYear = (nextYear: number | null) => {
    setYear(nextYear); setTimelineAnchor(undefined); setShowYears(false); setOverlapChoices(null);
    setSelectedJourneyId((previous) => nextYear === null || model.journeys.some((journey) => journey.id === previous && journey.years.includes(nextYear)) ? previous : null);
  };
  const changeSearch = (value: string) => {
    const nextSearch = normalizeLocalSearch(value);
    setSearch(nextSearch); setTimelineAnchor(undefined);
    setSelectedJourneyId((previous) => model.journeys.some((journey) => journey.id === previous && (year === null || journey.years.includes(year)) && matchesLocalSearch(journey, nextSearch)) ? previous : null);
    setOverlapChoices(null);
  };
  const observations = year === null && !search && !reviewOnly ? recognizable?.observed : undefined;
  const hasObservations = Boolean(observations?.length);
  const showMap = (view === 'map' || (wide && !reviewOnly)) && (canExplore || hasObservations);
  const basemap = atlasBasemapConfig();
  const hasAnchoredJourney = exploration.visibleJourneys.some((journey) => journey.mapAnchor);
  const useProviderMap = Platform.OS !== 'web' && mapAvailable && basemap.enabled && !mapStyleFailed && (hasAnchoredJourney || hasObservations);
  const providerCamera = (observedCamera && observedCamera.points === observations ? observedCamera.camera : undefined) ?? mapCamera ?? mapCameraFor([
    ...exploration.visibleJourneys.flatMap((journey) => journey.mapAnchor ? [journey.mapAnchor] : []),
    ...(observations ?? []),
  ]);
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
    const correlationId = createDiagnosticCorrelationId();
    const event = { operation: 'ATLAS_PREVIEW' as const, correlationId };
    let settled = false;
    recordAppDiagnostic({ ...event, stage: 'PREVIEW_READ', reasonCode: 'START', retryable: false, durableOutcome: 'unchanged' });
    void loadJourneyPreview(exploration.selectedJourneyId).then((result) => {
      if (!active || request !== requestId.current || !exploration.selectedJourneyId) return;
      settled = true;
      recordAppDiagnostic({ ...event, stage: 'PREVIEW_READ', reasonCode: 'COMPLETE', retryable: false, durableOutcome: 'unchanged' });
      const id = exploration.selectedJourneyId;
      setPreview({ id, ...result });
      const cover = result.previews.find((item) => item.uri);
      // Preserve an already resolved Timeline cover when detail has no preview.
      if (cover) setTimelineCovers((current) => ({ ...current, [id]: cover }));
    }).catch((error: unknown) => {
      if (!active || request !== requestId.current) return;
      settled = true;
      const reasonCode = classifyAppDiagnosticError(error);
      recordAppDiagnostic({ ...event, stage: error instanceof JourneyPreviewBoundaryError ? error.stage : 'PREVIEW_READ',
        reasonCode, retryable: reasonCode !== 'HISTORY_STALE', durableOutcome: reasonCode === 'HISTORY_STALE' ? 'skipped' : 'unchanged' });
      setPreviewError('Could not open this journey. Close and try again.');
    });
    return () => {
      active = false;
      if (!settled) recordAppDiagnostic({ ...event, stage: 'PREVIEW_LIFECYCLE', reasonCode: 'SKIPPED', retryable: false, durableOutcome: 'skipped' });
    };
  }, [exploration.selectedJourneyId, loadJourneyPreview]);
  useEffect(() => {
    if (!loadJourneyPreview) return;
    const pageIds = visibleJourneyIds.split('|').filter(Boolean);
    const pageIdSet = new Set(pageIds);
    for (const id of timelineCoverRequests.current) if (!pageIdSet.has(id)) timelineCoverRequests.current.delete(id);
    const pendingIds = pageIds.filter((id) => !timelineCoverRequests.current.has(id));
    if (!pendingIds.length) return;

    let active = true;
    const load = async () => {
      const correlationId = createDiagnosticCorrelationId();
      let reported = false;
      let nextIndex = 0;
      const worker = async () => {
        while (active && nextIndex < pendingIds.length) {
          const id = pendingIds[nextIndex++];
          try {
          const result = await loadJourneyPreview(id);
          let cover = result.previews.find((item) => item.uri) ?? null;
          // Detail previews are intentionally small and can be empty even when
          // the journey's first local gallery page has an authorized cover.
          // Reuse that existing bounded page before falling back to TRIP.
          if (active && !cover && loadJourneyMediaPage && result.snapshotToken !== undefined && result.detail.memories.length) {
            const media = await loadJourneyMediaPage(id, result.snapshotToken, 0);
            cover = media.previews.find((item) => item.uri) ?? null;
          }
          if (active) {
            timelineCoverRequests.current.add(id);
            setTimelineCovers((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([key]) => pageIdSet.has(key))), [id]: cover }));
          }
          } catch (error: unknown) {
            if (active && !reported && !(error instanceof JourneyPreviewBoundaryError && error.reported)) {
              reported = true;
              const reasonCode = classifyAppDiagnosticError(error);
              recordAppDiagnostic({ operation: 'ATLAS_PREVIEW', stage: error instanceof JourneyPreviewBoundaryError ? error.stage : 'PREVIEW_MEDIA',
                reasonCode, retryable: reasonCode !== 'HISTORY_STALE', durableOutcome: reasonCode === 'HISTORY_STALE' ? 'skipped' : 'unchanged', correlationId });
            }
            // A card remains usable without a cover. Selecting it retains the
            // existing retry and fixed owner-facing recovery message.
          }
        }
      };
      // Bound simultaneous native reads, but do not cap or omit any visible
      // journey: every Timeline card gets a cover attempt.
      await Promise.all(Array.from({ length: Math.min(4, pendingIds.length) }, worker));
    };
    void load();
    return () => { active = false; };
  }, [loadJourneyMediaPage, loadJourneyPreview, visibleJourneyIds]);
  return <View style={{ gap: 8, backgroundColor: atlas.void, marginHorizontal: -20, paddingHorizontal: 16, paddingVertical: 8 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {onHome && <ActionButton accessibilityLabel="Home" onPress={() => onHome(context)} variant="secondary">Home</ActionButton>}
      <Text accessibilityRole="header" style={{ color: palette.limestone, fontSize: 24, fontWeight: '800' }}>Your Atlas</Text>
      {onSettings && <ActionButton accessibilityLabel="Open Settings" onPress={() => onSettings(context)} variant="secondary">Settings</ActionButton>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      {canExplore && <Body>{visibleJourneys.length} {visibleJourneys.length === 1 ? 'journey' : 'journeys'} in this view</Body>}
      <ActionButton accessibilityLabel="Atlas details" onPress={() => setShowAbout(true)} variant="secondary">Details</ActionButton>
    </View>
    {sourceControls}
    {visualRecovery}
    {model.state !== 'restricted' && preparationStatus}
    {(!preparing || model.state === 'restricted') && (model.state === 'processing' && !model.reviewRequired ? <InsetPanel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="Local journey rebuild in progress" accessibilityState={{ busy: true }}>
        <ActivityIndicator color={palette.citrus} />
        <Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>Updating your Atlas</Text>
      </View>
      <Body>{model.message}</Body>
      <Body>You can keep this screen open. Check the map and journeys again when this notice disappears.</Body>
    </InsetPanel> : model.state === 'failed' && !model.pendingUpdates ? <InsetPanel><Body>{model.message}</Body><Body>You can still browse the last committed journeys and their associated photos below while recovery is retried.</Body></InsetPanel> : !model.reviewRequired && !model.pendingUpdates && model.state !== 'ready' && model.state !== 'processing' && <Body>{model.message}</Body>)}
    {!preparing && !model.reviewRequired && model.state !== 'processing' && model.pendingUpdates && <InsetPanel><Body>{model.journeys.length ? 'Local changes are waiting. Your last completed Atlas remains available while you choose when to catch up.' : 'Local changes are waiting. Catch up to check whether any journeys can be revealed.'}</Body><ActionButton accessibilityLabel="Catch up waiting local journey changes" onPress={onCatchUp} variant="secondary">Catch up locally</ActionButton></InsetPanel>}
    {!preparing && model.reviewRequired && <InsetPanel><Body>Some journeys need review.</Body>{model.journeys.some((journey) => journey.status === 'Needs review') && <ActionButton variant="secondary" onPress={() => { setTimelineAnchor(undefined); setReviewOnly(true); setView('timeline'); }}>Review journeys</ActionButton>}</InsetPanel>}
    {showAbout && <Modal transparent animationType={atlasMotionPolicy(reducedMotion).cardAnimation} onRequestClose={() => setShowAbout(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008', padding: 16 }}>
        <View accessibilityViewIsModal style={{ maxHeight: '85%', backgroundColor: atlas.midnight, padding: 16, borderRadius: 16 }}>
          <ActionButton accessibilityLabel="Close Atlas details" onPress={() => setShowAbout(false)} variant="secondary">Close</ActionButton>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Title>Atlas details</Title>
            <Body>{model.coverage} This record may be incomplete.</Body>
            <Body>Photo locations do not prove presence. Journey search stays on this device.</Body>
            <Body>Map style and tile requests can reveal the viewed area and ordinary network metadata.</Body>
            {!model.replay.eligible && <Body>{model.replay.reason}</Body>}
    {model.state === 'sparse' && showAbout && <InsetPanel>
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '900' }}>Local evidence check</Text>
      {model.diagnostics ? <>
        <Body>{model.diagnostics.assessed} records assessed; {model.diagnostics.supported} supported; {model.diagnostics.places} inferred places; {model.diagnostics.visits} inferred visits.</Body>
        <Body>Reasons without visit support: {model.diagnostics.insufficientLocation} insufficient location support; {model.diagnostics.missingDay} missing capture day; {model.diagnostics.invalidDay} invalid capture day; {model.diagnostics.unavailable} unavailable; {model.diagnostics.duplicateConflict} duplicate family conflict; {model.diagnostics.excluded} excluded by you.</Body>
        <Body>These are counts from the last completed local reconstruction. They do not prove where you were or that your lifetime history is complete.</Body>
      </> : <Body>{model.pendingUpdates ? 'No completed local evidence check is available yet. Catch up locally to check the waiting changes.' : 'No completed local evidence check is available yet. Recheck local journey history to produce one.'}</Body>}
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
          </ScrollView>
        </View>
      </View>
    </Modal>}
    {!preparing && !model.pendingUpdates && !model.reviewRequired && (model.state === 'ready' || model.state === 'sparse' || model.state === 'failed') &&
      <ActionButton onPress={onRetry} variant="secondary">{model.state === 'ready' ? 'Rebuild local journey history' : 'Recheck local journey history'}</ActionButton>}
    <View style={{ gap: 8, padding: 12, borderRadius: 18, backgroundColor: atlas.glass, borderWidth: 1, borderColor: 'rgba(78,168,222,0.35)' }}>
      <TextInput value={search} onChangeText={changeSearch} accessibilityLabel="Search visible Atlas journeys locally" placeholder="Search journeys" placeholderTextColor={atlas.secondary} autoCorrect={false} autoCapitalize="none" style={{ minHeight: 48, color: palette.limestone, borderWidth: 1, borderColor: 'rgba(78,168,222,0.5)', borderRadius: 12, paddingHorizontal: 14, backgroundColor: atlas.midnight }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
      <ActionButton accessibilityLabel="Show Atlas map" accessibilityState={{ selected: view === 'map' }} onPress={() => { setReviewOnly(false); setView('map'); }} variant={view === 'map' ? 'primary' : 'secondary'}>Map</ActionButton>
      <ActionButton accessibilityLabel="Show chronological Timeline" accessibilityState={{ selected: view === 'timeline' }} onPress={() => setView('timeline')} variant={view === 'timeline' ? 'primary' : 'secondary'}>Timeline</ActionButton>
      </View>
    </View>
    {search.length > 0 && <ActionButton variant="secondary" onPress={() => changeSearch('')}>Clear search</ActionButton>}
    {canExplore && <ActionButton accessibilityLabel="Filter Atlas by year" variant="secondary" onPress={() => setShowYears(true)}>{year ?? 'All years'}</ActionButton>}
    {showYears && <Modal transparent animationType={atlasMotionPolicy(reducedMotion).cardAnimation} onRequestClose={() => setShowYears(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: '#0008' }}>
        <View accessibilityViewIsModal style={{ maxHeight: '85%', backgroundColor: atlas.midnight, padding: 16, borderRadius: 16 }}>
          <ActionButton variant="secondary" onPress={() => setShowYears(false)}>Close</ActionButton>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
      <ActionButton accessibilityLabel="Show all years" accessibilityState={{ selected: year === null }} onPress={() => selectYear(null)} variant={year === null ? 'primary' : 'secondary'}>All years</ActionButton>
      {[...exploration.years].sort((a, b) => b - a).map((availableYear) => <ActionButton key={availableYear} accessibilityLabel={`Show journeys from ${availableYear}`} accessibilityState={{ selected: year === availableYear }} onPress={() => selectYear(availableYear)} variant={year === availableYear ? 'primary' : 'secondary'}>{String(availableYear)}</ActionButton>)}
          </ScrollView></View></View></Modal>}
    {!externalReplay && model.replay.eligible && <ActionButton accessibilityLabel="Replay" onPress={() => onReplay(context)}>Replay</ActionButton>}
    <View style={{ flexDirection: wide && showMap && showTimeline ? 'row' : 'column', gap: 12 }}>
    {showMap && <View style={{ flex: wide && showTimeline ? 1 : undefined, position: 'relative' }}>{useProviderMap ? <MapLibreAtlasMap key={hasObservations ? 'observed-map' : 'journey-map'} styleUrl={basemap.styleUrl} height={Math.max(210, Math.min(560, Math.round(height * 0.46)))} journeys={exploration.visibleJourneys} observations={observations} selectedJourneyId={exploration.selectedJourneyId} camera={providerCamera} onChoose={(ids) => ids.length === 1 ? selectJourney(ids[0]) : setOverlapChoices(ids)} onEmpty={() => { if (!overlapChoices) setSelectedJourneyId(null); }} onStyleFailure={() => { if (mapStyleFailed) return; onMapGestureChange?.(false); setMapStyleFailed(true); recordAppDiagnostic({ operation: 'ATLAS_MAP', stage: 'MAP_STYLE', reasonCode: 'MAP_STYLE_UNAVAILABLE', retryable: true, durableOutcome: 'unchanged', correlationId: createDiagnosticCorrelationId() }); }} onGestureChange={onMapGestureChange ?? ignoreMapGesture} onCameraChange={observations?.length ? (camera) => setObservedCamera({ points: observations, camera }) : setMapCamera} /> : <InsetPanel><Text testID="atlas-map-recovery" style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>{hasAnchoredJourney || hasObservations ? 'Map data unavailable' : 'No map location for this filter'}</Text><Body>{hasObservations ? 'Observed photo locations will appear when the map is available.' : !hasAnchoredJourney ? 'No selected journey has a map anchor. Choose All years or use the Timeline.' : mapStyleFailed ? 'The configured map could not load. Use the Timeline while it is recovered.' : 'Your journeys are in Timeline.'}</Body>{mapStyleFailed && basemap.enabled && <ActionButton accessibilityLabel="Retry configured Atlas map" onPress={() => setMapStyleFailed(false)} variant="secondary">Retry map</ActionButton>}<ActionButton accessibilityLabel="Show chronological Timeline from map recovery" onPress={() => setView('timeline')} variant="secondary">Open Timeline</ActionButton></InsetPanel>}
    {hasObservations && useProviderMap && <Body>Small dots mark observed photo locations.</Body>}
      {overlapChoices && <Modal transparent animationType={atlasMotionPolicy(reducedMotion).cardAnimation} onRequestClose={() => setOverlapChoices(null)}><View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: '#0008' }}><View accessibilityViewIsModal style={{ maxHeight: '80%', padding: 16, borderRadius: 16, backgroundColor: atlas.midnight }}><ScrollView contentContainerStyle={{ gap: 8 }}><Text style={{ color: palette.limestone, fontSize: 18, fontWeight: '800' }}>Choose a journey</Text><Body>Several private journeys share this map area.</Body>{overlapChoices.map((id) => { const choice = exploration.visibleJourneys.find((journey) => journey.id === id); return choice ? <ActionButton key={id} accessibilityLabel={`Choose ${choice.label}`} onPress={() => selectJourney(id)} variant="secondary">{choice.label} · {choice.periodLabel} · {choice.status}</ActionButton> : null; })}<ActionButton accessibilityLabel="Cancel overlapping journey choice" onPress={() => setOverlapChoices(null)} variant="secondary">Cancel</ActionButton></ScrollView></View></View></Modal>}
    {showMap && useProviderMap && visibleJourneys.some((journey) => !journey.mapAnchor) && <ActionButton variant="secondary" onPress={() => setView('timeline')}>{visibleJourneys.filter((journey) => !journey.mapAnchor).length} without map locations · View in Timeline</ActionButton>}
    </View>}
    <JourneyPreviewSheet key={exploration.selectedJourneyId ?? 'none'} journey={!showMedia ? exploration.visibleJourneys.find((journey) => journey.id === exploration.selectedJourneyId) ?? null : null} preview={preview} previewError={previewError} onClose={() => { setShowMedia(false); setSelectedJourneyId(null); }} onMedia={() => setShowMedia(true)} onEdit={onEditJourney && exploration.selectedJourneyId ? () => editJourney(exploration.selectedJourneyId!) : undefined} reducedMotion={reducedMotion} />
    {showMedia && preview?.id === exploration.selectedJourneyId && <JourneyMediaViewer detail={preview.detail} previews={preview.previews} sessionKey={`${preview.id}:${preview.snapshotToken ?? 'preview'}`} loadPage={loadJourneyMediaPage && preview.snapshotToken !== undefined ? (page) => loadJourneyMediaPage(preview.id, preview.snapshotToken!, page) : undefined} inspect={inspectJourneyMedia && preview.snapshotToken !== undefined ? (id, uri) => inspectJourneyMedia(preview.id, preview.snapshotToken!, id, uri) : undefined} onClose={() => setShowMedia(false)} />}
    {showTimeline && <View style={{ gap: 2, flex: wide && showMap ? 1 : undefined, minWidth: 0 }} accessibilityLabel="Chronological local journey Timeline">
      {reviewOnly && <ActionButton variant="secondary" onPress={() => setReviewOnly(false)}>Show all journeys</ActionButton>}
      <Text style={{ color: palette.limestone, fontSize: 20, fontWeight: '800' }}>
        {canExplore || model.state === 'sparse' ? `Journeys · ${exploration.visibleJourneys.length}` : 'Journeys'}
      </Text>
      {rows.map((journey) => {
        const cover = timelineCovers[journey.id];
        return <View key={journey.id}>
          <TripListCard accessibilityRole="button" accessibilityLabel={`${journey.label}, ${journey.periodLabel}${exploration.selectedJourneyId === journey.id ? ', selected' : ''}`} accessibilityState={{ selected: exploration.selectedJourneyId === journey.id }} onPress={() => selectJourney(journey.id)} selected={exploration.selectedJourneyId === journey.id} title={journey.label} detail={`${journey.periodLabel} · ${journey.status}${journey.ordering === 'Order uncertain' ? ' · order uncertain' : ''}${journey.hasMapSupport ? '' : ' · location unknown'}`} cover={cover?.uri ? <LocalTripMediaCover uri={cover.uri} kind={cover.kind} /> : <TripCoverFallback />} trailing={<Text style={tripListCardStyles.arrow}>›</Text>} />
          {mergeCues.get(journey.id)?.map(({ pair, left, right, connected }) =>
            <TimelineMergeCue key={`${pair.leftId}:${pair.rightId}`} left={left} right={right} connected={connected} onPress={() => setMergeReview({ pair, left, right })} />)}
        </View>;
      })}
      {visibleJourneys.length > pageSize && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <ActionButton variant="secondary" disabled={pageStart === 0} onPress={() => changePage(pageStart - pageSize)}>Previous journeys</ActionButton>
        <Body>{pageStart + 1}–{Math.min(pageStart + pageSize, visibleJourneys.length)} of {visibleJourneys.length}</Body>
        <ActionButton variant="secondary" disabled={pageStart + pageSize >= visibleJourneys.length} onPress={() => changePage(pageStart + pageSize)}>Next journeys</ActionButton>
      </View>}
        {canExplore && !exploration.visibleJourneys.length && search.length > 0 && <Body>No visible local journeys match “{search}”. Clear or change the local search.</Body>}
        {canExplore && year !== null && !exploration.visibleJourneys.length && !search.length && <Body>No journeys have an observed visit in {year}. Choose All years to see the full available record.</Body>}
        {model.state === 'sparse' && !model.journeys.length && <Body>No supported journey is available to show.</Body>}
    </View>}
    </View>
    {view === 'map' && recognizable?.featured?.(() => setView('timeline'))}
    {mergeReview && confirmTimelineMerge && loadJourneyPreview && <TimelineMergeReview {...mergeReview}
      current={model.state === 'ready' && (model.mergePairs ?? []).some((pair) => pair.leftId === mergeReview.pair.leftId
        && pair.rightId === mergeReview.pair.rightId && pair.generation === mergeReview.pair.generation && pair.privacyRevision === mergeReview.pair.privacyRevision)}
      load={loadJourneyPreview} confirm={confirmTimelineMerge} close={() => setMergeReview(null)} />}
    {(showTimeline || model.state === 'sparse') && recognizable?.possibleTrips}
    {(model.state === 'ready' || model.state === 'sparse') && possibleTrips}
    {!preparing && !model.reviewRequired && model.state === 'processing' && <ActionButton accessibilityLabel="Local journey history is updating" onPress={onCatchUp} disabled variant="secondary">Updating locally…</ActionButton>}
    {((!preparing && model.state === 'sparse') || model.state === 'restricted') && <ActionButton accessibilityLabel="Import or reconnect photos" onPress={onImport}>Add photos</ActionButton>}
    {(model.state === 'ready' || model.state === 'sparse' || model.state === 'failed' || model.state === 'restricted') && <ActionButton accessibilityLabel="Add a journey manually" onPress={() => onManualEntry(context)} variant="secondary">Add journey</ActionButton>}
  </View>;
}
