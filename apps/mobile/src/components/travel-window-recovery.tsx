import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';

import { ActionButton, Body, InsetPanel, Title, palette } from '@/components/ui';
import { nameWindow } from '@/travel-window/naming';
import { buildStoryCard } from '@/travel-window/story-card';
import { travelWindowDiscoveryPauseMillis, type AutomaticTravelWindowDiscovery, type TravelWindowPhoto, type TravelWindowProposal } from '@/travel-window/production-discovery';
import { searchOwnerPlaces, type OwnerPlace } from '@/reconstruction/owner-place-search';
import type { ConfirmedPlace } from '@/travel-window/storage';

// Same broad-continent fallback as manual-journey.tsx, for the same reason:
// a coarse anchor the owner picks, never one implied by metadata. Unlike a
// real search match, picking one of these never overwrites the owner's own
// typed name — only the area/coordinates are "East Asia" etc, the name stays theirs.
const broadRegions: readonly { label: string; latitude: number; longitude: number }[] = [
  { label: 'East Asia', latitude: 35.7, longitude: 139.7 },
  { label: 'Southeast Asia', latitude: 13.8, longitude: 100.5 },
  { label: 'Western Europe', latitude: 48.9, longitude: 2.3 },
];

/**
 * GPS-less trip discovery (decision 0019/0020), facts-only story card — the
 * spec's option B: "You were away for N days in <month>. <X> photos. Your
 * clock moved <H> ahead." No place is ever shown unless the owner types one;
 * metadata alone never names a place (types.ts `canClaimPlace`). Mirrors
 * `VisualPlaceRecovery`'s foreground-focus pacing loop, simplified: no album
 * pagination, since a facts-only card needs only the counts already in the
 * proposal, never photo thumbnails.
 *
 * Confirming requires picking a real place (own search result or a broad
 * region), not just typing free text: decision 0019/0020's own acceptance
 * line requires the confirmed trip to become a real, visible journey
 * (`manual_journey`), which needs real coordinates — never one the owner
 * didn't choose.
 */
export function TravelWindowRecovery({ discovery }: { discovery: AutomaticTravelWindowDiscovery }) {
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [offer, setOffer] = useState<TravelWindowProposal | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [resolvedPlace, setResolvedPlace] = useState<ConfirmedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [restart, setRestart] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [album, setAlbum] = useState<{ page: number; photos: TravelWindowPhoto[]; hasMore: boolean } | null>(null);
  const [albumBusy, setAlbumBusy] = useState(false);
  const [failedAlbumPage, setFailedAlbumPage] = useState<number | null>(null);
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
      if (result.proposal) setOffer(result.proposal);
      else if (result.more) timer = setTimeout(() => { void scan(); }, travelWindowDiscoveryPauseMillis);
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
      setPlaceQuery('');
      setResolvedPlace(null);
      setBusy(false);
      setFailed(false);
      setReviewOpen(false);
      setAlbum(null);
      setAlbumBusy(false);
      setFailedAlbumPage(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart is a deliberate retrigger after a decision, not read in the body.
  }, [discovery, foreground, restart]));

  if (!foreground || !discovery.enabled || !offer) return null;

  const card = buildStoryCard({
    window: { startMillis: offer.token.startMillis, endMillis: offer.token.endMillis, cameraCount: offer.cameraCount, shiftMinutes: offer.shiftMinutes, clues: [] },
    memberCount: offer.cameraCount, homeOffsetMinutes: null, naming: nameWindow([]),
  });

  const loadPhotos = async (page: number) => {
    if (!session.current || session.current.signal.aborted || albumRequest.current) return;
    const request = new AbortController();
    albumRequest.current = request;
    setAlbumBusy(true);
    setFailedAlbumPage(null);
    const result = await discovery.loadPhotos(offer.token, page, request.signal);
    if (request.signal.aborted) return;
    albumRequest.current = null;
    setAlbumBusy(false);
    if (result) setAlbum({ page, ...result });
    else setFailedAlbumPage(page);
  };

  const decide = async (decision: 'confirm' | 'dismiss') => {
    const active = session.current;
    if (!active || active.signal.aborted || decisionInProgress.current || (decision === 'confirm' && !resolvedPlace)) return;
    decisionInProgress.current = true;
    setBusy(true);
    setFailed(false);
    const saved = decision === 'confirm' && resolvedPlace
      ? await discovery.confirm(offer.token, resolvedPlace, active.signal)
      : await discovery.dismiss(offer.token, active.signal);
    if (active.signal.aborted) return;
    decisionInProgress.current = false;
    setBusy(false);
    if (!saved) { setFailed(true); return; }
    setOffer(null);
    setPlaceQuery('');
    setResolvedPlace(null);
    setRestart((value) => value + 1);
  };
  // A real search match overwrites the typed query with the match's own
  // name (same as manual-journey.tsx). A broad-region fallback never does:
  // the owner's own typed text stays the name, only the area/anchor is coarse.
  //
  // Setting the TextInput's value programmatically (choosePlace, below)
  // while it still has focus can echo back through onChangeText on Android
  // with that same new value. Only clear a prior selection on a genuine
  // edit (a different value), not that echo — otherwise tapping a
  // suggestion immediately un-selects it and Save never enables.
  const changeQuery = (value: string) => {
    setPlaceQuery(value);
    setResolvedPlace((current) => current && current.name === value ? current : null);
  };
  const choosePlace = (place: OwnerPlace) => { setPlaceQuery(place.name); setResolvedPlace({ name: place.name, context: place.context, latitude: place.latitude, longitude: place.longitude }); };
  const chooseBroadRegion = (region: { label: string; latitude: number; longitude: number }) => {
    const name = placeQuery.trim();
    if (!name) return;
    setResolvedPlace({ name, context: region.label, latitude: region.latitude, longitude: region.longitude });
  };
  const localResults = resolvedPlace ? [] : searchOwnerPlaces(placeQuery);

  return <InsetPanel>
    <Title>Possible trips</Title>
    <Body>{card.headline}</Body>
    {card.detail.map((line) => <Body key={line}>{line}</Body>)}
    {failed && <View accessibilityLiveRegion="polite"><Body>The decision could not be verified. Try again.</Body></View>}
    {reviewOpen ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(album?.photos ?? []).map((photo) => <Image key={photo.id} source={{ uri: photo.uri }}
          style={{ width: 72, height: 72, borderRadius: 8 }} />)}
      </View>
      {albumBusy && <Body>Opening photos…</Body>}
      {failedAlbumPage !== null && <Body>These photos could not be opened. Try again.</Body>}
      {album && (album.page > 0 || album.hasMore) && <View style={{ flexDirection: 'row', gap: 8 }}>
        {album.page > 0 && <ActionButton disabled={albumBusy} variant="secondary" onPress={() => void loadPhotos(album.page - 1)}>Previous photos</ActionButton>}
        {album.hasMore && <ActionButton disabled={albumBusy} variant="secondary" onPress={() => void loadPhotos(album.page + 1)}>Next photos</ActionButton>}
      </View>}
    </> : <ActionButton variant="secondary" onPress={() => { setReviewOpen(true); if (!album) void loadPhotos(0); }}>Review photos</ActionButton>}
    <TextInput value={placeQuery} onChangeText={changeQuery} editable={!busy} accessibilityLabel="Where were you?"
      placeholder="Where were you?" placeholderTextColor={palette.sage} autoCorrect={false}
      style={{ minHeight: 48, color: palette.limestone, borderWidth: 1, borderColor: palette.sage, borderRadius: 12, paddingHorizontal: 14, backgroundColor: palette.fern }} />
    {localResults.map((place) => <ActionButton key={place.id} variant="secondary" disabled={busy} onPress={() => choosePlace(place)}>{place.name} · {place.context}</ActionButton>)}
    {placeQuery.trim().length > 0 && !resolvedPlace && !localResults.length && <>
      <Body>No offline place matched. Choose a deliberately broad area; it is not a confirmed place.</Body>
      {broadRegions.map((region) => <ActionButton key={region.label} variant="secondary" disabled={busy} onPress={() => chooseBroadRegion(region)}>{region.label}</ActionButton>)}
    </>}
    <ActionButton disabled={busy || !resolvedPlace} onPress={() => void decide('confirm')}>Save</ActionButton>
    <ActionButton disabled={busy} variant="secondary" onPress={() => void decide('dismiss')}>Not a trip</ActionButton>
  </InsetPanel>;
}
