import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Modal, ScrollView, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AtlasReveal } from '@/components/atlas-reveal';
import { LocalTripMediaCover } from '@/components/local-trip-media-cover';
import { AuthorizedTripEvidence, PossibleTripsSection, RecognizableAtlasReveal } from '@/components/recognizable-atlas-reveal';
import { ActionButton, Body, InsetPanel, useReducedMotion } from '@/components/ui';
import { createDiagnosticCorrelationId, recordAppDiagnostic } from '@/diagnostics/app-diagnostics';
import { usePhotoAccess } from '@/photo-access/provider';
import type { OwnerPreview } from '@/photo-access/types';
import type { RecognizableReveal } from '@/reconstruction/recognizable-shadow-types';
import type { DurableRevealRecord } from '@/reveal/types';

type LoadedReveal = { baseline: DurableRevealRecord; attempt: number; request: AbortController; result: RecognizableReveal | null };
type EvidenceState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; previews: OwnerPreview[] };

/** The gated overlay shares the regular Atlas navigation and committed view. */
export function RecognizableAtlasExperience(props: ComponentProps<typeof AtlasReveal>) {
  const { controller, privateRecord, snapshot, durableReveal, loadRecognizableReveal } = usePhotoAccess();
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [loaded, setLoaded] = useState<LoadedReveal | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [featuredDismissed, setFeaturedDismissed] = useState(false);
  const refresh = () => setAttempt((value) => value + 1);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => setForeground(status === 'active'));
    return () => subscription.remove();
  }, []);

  const eligible = focused && foreground && !props.preparing && !controller.isAccountRecord
    && privateRecord.state === 'connected' && privateRecord.pendingAction === null && snapshot.scope === 'full'
    && (props.model.state === 'ready' || props.model.state === 'sparse');

  useEffect(() => {
    if (!eligible || !durableReveal || !loadRecognizableReveal) return;
    const request = new AbortController();
    void loadRecognizableReveal(request.signal).then((result) => {
      if (!request.signal.aborted) setLoaded({ baseline: durableReveal, attempt, request, result });
    }).catch(() => {
      if (!request.signal.aborted) setLoaded({ baseline: durableReveal, attempt, request, result: null });
    });
    return () => {
      request.abort();
      setLoaded((current) => current?.request === request ? null : current);
    };
  }, [attempt, durableReveal, eligible, loadRecognizableReveal]);

  const result = eligible && loaded && loaded.baseline === durableReveal && loaded.attempt === attempt ? loaded.result : null;
  const showFeatured = Boolean(result?.featured && !featuredDismissed && controller.hasFirstRecognizableReveal);
  const dismissFeatured = () => {
    controller.dismissFirstRecognizableReveal();
    setFeaturedDismissed(true);
  };
  return <AtlasReveal {...props}
    onHome={props.onHome && ((context) => { dismissFeatured(); props.onHome?.(context); })}
    recognizable={result ? {
      observed: result.observed,
      featured: showFeatured ? (openTimeline) => <FeaturedRecognizableTrip result={result} onOpenTimeline={() => { dismissFeatured(); openTimeline(); }} /> : undefined,
      possibleTrips: result.possible.length ? <PossibleRecognizableTrips result={result} onRefresh={refresh} /> : undefined,
    } : undefined} />;
}

function useTripEvidence(token: object, id: string | null): EvidenceState {
  const { readRecognizableTrip } = usePhotoAccess();
  const [evidence, setEvidence] = useState<{ token: object; id: string; state: EvidenceState } | null>(null);
  useEffect(() => {
    if (!id || !readRecognizableTrip) return;
    const request = new AbortController();
    void readRecognizableTrip(token, id, request.signal).then((result) => {
      if (!request.signal.aborted) setEvidence({ token, id, state: result ? { status: 'ready', previews: result.previews } : { status: 'unavailable' } });
    }).catch(() => {
      if (!request.signal.aborted) setEvidence({ token, id, state: { status: 'unavailable' } });
    });
    return () => request.abort();
  }, [id, readRecognizableTrip, token]);
  if (!readRecognizableTrip) return { status: 'unavailable' };
  return evidence?.id === id && evidence.token === token ? evidence.state : { status: 'loading' };
}

function TripEvidence({ evidence }: { evidence: EvidenceState }) {
  if (evidence.status === 'loading') return <View accessibilityLiveRegion="polite"><Body>Checking current trip media…</Body></View>;
  if (evidence.status === 'unavailable') return <Body>Trip media is unavailable in the current Atlas.</Body>;
  const available = evidence.previews.filter((item) => item.availability === 'available' && item.uri);
  if (!available.length) return <Body>No trip media is available.</Body>;
  return <View style={{ gap: 8 }}>{available.map((item, index) => <View key={index} style={{ height: 144, borderRadius: 12, overflow: 'hidden' }}>
    <LocalTripMediaCover uri={item.uri!} kind={item.kind} />
  </View>)}</View>;
}

function FeaturedRecognizableTrip({ result, onOpenTimeline }: { result: RecognizableReveal; onOpenTimeline(): void }) {
  const { playRecognizableTrip, discardRecognizableTripPreview } = usePhotoAccess();
  const [open, setOpen] = useState(false);
  const [playback, setPlayback] = useState<{ status: 'preparing' | 'failed' } | { status: 'ready'; uri: string; correlationId: string } | null>(null);
  const action = useRef<AbortController | null>(null);
  const trip = result.featured;
  const reducedMotion = useReducedMotion();
  const evidence = useTripEvidence(result.token, open ? trip?.id ?? null : null);
  const playbackFailed = useCallback(() => setPlayback({ status: 'failed' }), []);
  useEffect(() => () => { action.current?.abort(); }, [result.token]);
  useEffect(() => {
    if (playback?.status !== 'ready') return;
    return () => { void discardRecognizableTripPreview?.(playback.uri, playback.correlationId).catch(() => {}); };
  }, [discardRecognizableTripPreview, playback]);
  if (!trip) return null;

  const close = () => {
    action.current?.abort();
    action.current = null;
    setOpen(false);
    setPlayback(null);
  };
  const play = () => {
    if (!playRecognizableTrip || action.current) return;
    const request = new AbortController();
    action.current = request;
    const correlationId = createDiagnosticCorrelationId();
    setPlayback({ status: 'preparing' });
    void playRecognizableTrip(result.token, trip.id, request.signal, correlationId).then((preview) => {
      if (request.signal.aborted) {
        if (preview) void discardRecognizableTripPreview?.(preview.uri, correlationId).catch(() => {});
        return;
      }
      setPlayback(preview ? { status: 'ready', uri: preview.uri, correlationId } : { status: 'failed' });
    }).catch(() => {
      if (!request.signal.aborted) setPlayback({ status: 'failed' });
    }).finally(() => { if (action.current === request) action.current = null; });
  };
  return <>
    <RecognizableAtlasReveal observedMap={null} featuredTrip={trip} onOpenTrip={() => setOpen(true)}
      onPlayTrip={trip.canPlay && playRecognizableTrip ? play : undefined} onOpenTimeline={onOpenTimeline} />
    {(open || playback) && <Modal transparent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={close}>
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0009' }}>
        <InsetPanel style={{ maxHeight: '88%' }}>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {open ? <><AuthorizedTripEvidence trip={trip} /><TripEvidence evidence={evidence} /></>
              : playback?.status === 'ready' ? <FeaturedTripPlayer uri={playback.uri} correlationId={playback.correlationId} onFailed={playbackFailed} />
              : <View accessibilityLiveRegion="polite"><Body>{playback?.status === 'preparing' ? 'Preparing this private trip…' : 'Trip playback is unavailable.'}</Body></View>}
          </ScrollView>
          {playback?.status === 'failed' && <ActionButton variant="secondary" onPress={() => { setPlayback(null); setOpen(true); }}>Open trip</ActionButton>}
          <ActionButton variant="secondary" onPress={close}>Close trip</ActionButton>
        </InsetPanel>
      </View>
    </Modal>}
  </>;
}

function FeaturedTripPlayer({ uri, correlationId, onFailed }: { uri: string; correlationId: string; onFailed(): void }) {
  const player = useVideoPlayer(uri, (video) => { video.staysActiveInBackground = false; video.play(); });
  useEffect(() => {
    let reported = false;
    const fail = () => {
      if (reported) return;
      reported = true;
      recordAppDiagnostic({ operation: 'REPLAY_RENDER', stage: 'REPLAY_HANDOFF', reasonCode: 'MEDIA_DECODE', retryable: true, durableOutcome: 'unchanged', correlationId });
      onFailed();
    };
    if (player.status === 'error') { fail(); return; }
    const subscription = player.addListener('statusChange', ({ status }) => { if (status === 'error') fail(); });
    return () => subscription.remove();
  }, [correlationId, onFailed, player]);
  return <VideoView player={player} nativeControls accessibilityLabel="Private trip preview" contentFit="contain" style={{ width: '100%', aspectRatio: 16 / 9 }} />;
}

const possiblePageSize = 6;
type ReviewCommand = { id: string; decision: 'keep' | 'reject'; key: string };

function PossibleRecognizableTrips({ result, onRefresh }: { result: RecognizableReveal; onRefresh(): void }) {
  const { reviewRecognizableTrip } = usePhotoAccess();
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<'ready' | 'saving' | 'stale' | 'unknown'>('ready');
  const command = useRef<ReviewCommand | null>(null);
  const action = useRef<AbortController | null>(null);
  const evidence = useTripEvidence(result.token, selectedId);
  useEffect(() => () => { action.current?.abort(); }, [result.token]);
  const check = (choice: ReviewCommand) => {
    if (action.current || !reviewRecognizableTrip) return;
    const request = new AbortController();
    action.current = request;
    command.current = choice;
    setReview('saving');
    void reviewRecognizableTrip(result.token, choice.id, choice.decision, choice.key, request.signal).then((outcome) => {
      if (request.signal.aborted) return;
      if (outcome === 'applied') {
        command.current = null;
        onRefresh();
      } else if (outcome === 'stale' || outcome === 'unsupported') {
        command.current = null;
        setReview('stale');
      } else setReview('unknown');
    }).catch(() => { if (!request.signal.aborted) setReview('unknown'); })
      .finally(() => { if (action.current === request) action.current = null; });
  };
  const close = () => {
    if (review === 'saving') return;
    if (review === 'unknown' || review === 'stale') { onRefresh(); return; }
    setSelectedId(null);
  };
  return <PossibleTripsSection trips={result.possible.slice(page, page + possiblePageSize)} selectedId={selectedId} reviewState={review}
    evidence={selectedId ? <TripEvidence evidence={evidence} /> : undefined}
    onOpen={(id) => { setSelectedId(id); setReview('ready'); }} onClose={close}
    onDecision={(id, decision) => {
      if (selectedId === id && review === 'ready') check({ id, decision, key: createDiagnosticCorrelationId() });
    }} onCheckAgain={(id) => { if (command.current?.id === id) check(command.current); }}
    onPrevious={page > 0 ? () => { setSelectedId(null); setPage(page - possiblePageSize); } : undefined}
    onLoadMore={page + possiblePageSize < result.possible.length ? () => { setSelectedId(null); setPage(page + possiblePageSize); } : undefined} />;
}
