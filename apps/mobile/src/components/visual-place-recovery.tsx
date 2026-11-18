import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { ActionButton, Body, InsetPanel, Title } from '@/components/ui';
import { visualDiscoveryPauseMillis } from '@/visual-place/discovery';
import type { AutomaticVisualDiscovery, AutomaticVisualProposal } from '@/visual-place/recovery';

export function VisualDiscoverySetting({ discovery }: { discovery: AutomaticVisualDiscovery }) {
  return <InsetPanel>
    <Title>Find missing trips</Title>
    <Body>Atlas can check a small sample of photos without GPS from your Local library for recognizable places. Photo analysis runs on this device. You choose which suggestions to add.</Body>
    {Platform.OS === 'android' && <Body>Google ML Kit may send app, device and performance metrics to Google. Photos and recognized text stay on your device.</Body>}
    {discovery.settingFailed && <Body>Atlas could not verify the setting. Try again.</Body>}
    <ActionButton disabled={discovery.settingBusy} variant="secondary"
      onPress={() => void discovery.setEnabled(!discovery.enabled)}>
      {discovery.settingBusy ? 'Saving…' : discovery.enabled ? 'Turn off trip discovery' : 'Allow on-device trip discovery'}
    </ActionButton>
    {discovery.settingFailed && !discovery.enabled && <ActionButton variant="secondary"
      onPress={() => void discovery.setEnabled(false)}>Turn off trip discovery</ActionButton>}
  </InsetPanel>;
}

export function VisualPlaceRecovery({ discovery, version }: { discovery: AutomaticVisualDiscovery; version: object }) {
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [offer, setOffer] = useState<{ proposal: AutomaticVisualProposal; version: object; restart: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [album, setAlbum] = useState<{
    page: number; photos: AutomaticVisualProposal['covers']; hasMore: boolean;
  } | null>(null);
  const [failedAlbumPage, setFailedAlbumPage] = useState<number | null>(null);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [restart, setRestart] = useState(0);
  const session = useRef<AbortController | null>(null);
  const decisionInProgress = useRef(false);
  const albumRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') session.current?.abort();
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    if (!foreground || !discovery.enabled) return;
    const abort = new AbortController();
    session.current = abort;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scan = async () => {
      const result = await discovery.discover(abort.signal);
      if (abort.signal.aborted) return;
      if (result.proposal) setOffer({ proposal: result.proposal, version, restart });
      else if (result.more) timer = setTimeout(() => { void scan(); }, visualDiscoveryPauseMillis);
    };
    void scan();
    return () => {
      abort.abort();
      if (timer !== undefined) clearTimeout(timer);
      if (session.current === abort) session.current = null;
      decisionInProgress.current = false;
      albumRequest.current?.abort();
      albumRequest.current = null;
      setOffer(null);
      setOpen(false);
      setBusy(false);
      setFailed(false);
      setAlbum(null);
      setFailedAlbumPage(null);
      setAlbumBusy(false);
    };
  }, [discovery, foreground, restart, version]));

  const proposal = foreground && discovery.enabled && offer?.version === version && offer.restart === restart ? offer.proposal : null;
  if (!proposal) return null;
  const loadAlbum = async (page: number) => {
    if (!session.current || session.current.signal.aborted || albumRequest.current) return;
    const request = new AbortController();
    albumRequest.current = request;
    setAlbumBusy(true);
    setFailedAlbumPage(null);
    const result = await discovery.loadAlbum(proposal.token, page, request.signal);
    if (request.signal.aborted) return;
    albumRequest.current = null;
    setAlbumBusy(false);
    if (result) setAlbum({ page, ...result });
    else setFailedAlbumPage(page);
  };
  const decide = async (decision: 'confirm' | 'dismiss') => {
    const active = session.current;
    if (!active || active.signal.aborted || decisionInProgress.current
      || (decision === 'confirm' && (!open || !album || albumBusy || failedAlbumPage !== null))) return;
    decisionInProgress.current = true;
    setBusy(true);
    setFailed(false);
    const saved = await discovery.review(proposal.token, decision, active.signal);
    if (active.signal.aborted) return;
    decisionInProgress.current = false;
    setBusy(false);
    if (!saved) { setFailed(true); return; }
    setOffer(null);
    setOpen(false);
    setRestart((value) => value + 1);
  };

  return <InsetPanel>
    <Title>Possible trips</Title>
    <Body>{proposal.correction ? 'Review an update to your saved trip' : 'You may be missing a trip'}</Body>
    <Title>{proposal.place.label === proposal.place.locality ? proposal.place.label : `${proposal.place.label} · ${proposal.place.locality}`}</Title>
    <Body>{proposal.observedPeriod}</Body>
    {open && <Body>{proposal.stops.map((stop) => stop.label).join(' · ')}</Body>}
    {open && proposal.pendingPlace && <Body>Possible stop · {proposal.pendingPlace.label}</Body>}
    {open && <Body>{proposal.count} photos. Capture locations are unknown.</Body>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(open ? album?.photos ?? [] : proposal.covers).map((photo, index) => <Image key={photo.id} source={{ uri: photo.uri }}
        accessibilityLabel={`Suggested trip photo ${index + 1}`} cachePolicy="memory" contentFit="cover"
        style={{ width: 88, height: 88, borderRadius: 8 }} />)}
    </View>
    {open && albumBusy && <Body>Opening trip photos…</Body>}
    {open && failedAlbumPage !== null && <View accessibilityLiveRegion="polite"><Body>Atlas could not verify these photos.</Body>
      <ActionButton variant="secondary" onPress={() => void loadAlbum(failedAlbumPage)}>Try again</ActionButton></View>}
    {open && album && (album.page > 0 || album.hasMore) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {album.page > 0 && <ActionButton disabled={albumBusy || busy} variant="secondary" onPress={() => void loadAlbum(album.page - 1)}>Previous photos</ActionButton>}
      {album.hasMore && <ActionButton disabled={albumBusy || busy} variant="secondary" onPress={() => void loadAlbum(album.page + 1)}>Next photos</ActionButton>}
    </View>}
    {failed && <View accessibilityLiveRegion="polite"><Body>The decision could not be verified. Try again or return to Atlas.</Body></View>}
    {open ? <ActionButton disabled={busy || !album || albumBusy || failedAlbumPage !== null} onPress={() => void decide('confirm')}>{proposal.correction ? 'Confirm trip update' : 'Confirm trip'}</ActionButton>
      : <ActionButton disabled={busy} onPress={() => { setOpen(true); if (!album) void loadAlbum(0); }}>Review trip photos</ActionButton>}
    {open && <ActionButton disabled={busy} variant="secondary" onPress={() => setOpen(false)}>Hide trip details</ActionButton>}
    <ActionButton disabled={busy} variant="secondary" onPress={() => void decide('dismiss')}>Dismiss suggestion</ActionButton>
  </InsetPanel>;
}
