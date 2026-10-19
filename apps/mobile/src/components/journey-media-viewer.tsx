import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, Body, palette } from '@/components/ui';
import type { OwnerPreview } from '@/photo-access/types';
import type { JourneyDetail, JourneyMediaPage } from '@/reveal/types';

type GalleryPage = { page: JourneyMediaPage; previews: OwnerPreview[] };
type GalleryEntry = { entry: JourneyMediaPage['items'][number]; preview?: OwnerPreview };

function entriesFor(page: GalleryPage): GalleryEntry[] {
  return page.page.items.map((entry, index) => ({ entry, preview: page.previews[index] }));
}

function LocalVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = true; video.volume = 0; video.loop = false; });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => { subscription.remove(); player.pause(); };
  }, [player]);
  return <View style={{ gap: 10 }}><VideoView player={player} style={{ height: 360, borderRadius: 14 }} nativeControls allowsPictureInPicture={false} /><ActionButton accessibilityLabel="Play associated video" onPress={() => player.play()}>Play video</ActionButton><Body>Sound is off initially. Playback pauses when this viewer closes or the app backgrounds.</Body></View>;
}

function Tile({ entry, preview, size, onPress }: { entry: JourneyMediaPage['items'][number]; preview?: OwnerPreview; size: number; onPress(): void }) {
  const available = preview?.availability === 'available' && Boolean(preview.uri);
  return <Pressable testID={`journey-media-tile-${entry.id}`} accessibilityLabel={`Open associated ${entry.kind}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ width: size, height: size, borderRadius: 8, overflow: 'hidden', backgroundColor: palette.rainforest, opacity: pressed ? 0.78 : 1 })}>
    {entry.kind === 'photo' && preview?.uri ? <Image source={{ uri: preview.uri }} style={{ width: size, height: size }} accessibilityLabel="Associated photo thumbnail" cachePolicy="memory" allowDownscaling /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}><Text style={{ color: palette.sage, fontWeight: '900', fontSize: 12 }}>{entry.kind === 'video' ? 'VIDEO' : 'PHOTO'}</Text><Text style={{ color: palette.limestone, fontSize: 11 }}>{available ? 'Local' : entry.availability === 'unknown' ? 'Checking' : 'Unavailable'}</Text></View>}
    {entry.kind === 'video' && <View style={{ position: 'absolute', right: 6, bottom: 6, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(4,38,35,0.82)' }}><Text style={{ color: palette.limestone, fontSize: 10, fontWeight: '900' }}>▶</Text></View>}
  </Pressable>;
}

type JourneyMediaViewerProps = { detail: JourneyDetail; previews: OwnerPreview[]; loadPage?: (page: number) => Promise<GalleryPage>; sessionKey?: string; onClose(): void };

/** Full-screen local-only album. A snapshot key remounts only when the journey snapshot changes. */
export function JourneyMediaViewer({ sessionKey, ...props }: JourneyMediaViewerProps) {
  return <JourneyMediaViewerSession key={sessionKey ?? props.detail.id} {...props} />;
}

function JourneyMediaViewerSession({ detail, previews, loadPage, onClose }: Omit<JourneyMediaViewerProps, 'sessionKey'>) {
  const fallback = detail.memories.map((memory, index) => ({ entry: { id: memory.id, availability: memory.availability, association: memory.association, kind: previews[index]?.kind ?? 'photo' }, preview: previews[index] }));
  const [album, setAlbum] = useState<GalleryEntry[]>(() => loadPage ? [] : fallback);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(loadPage));
  const [initialError, setInitialError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const loadPageRef = useRef(loadPage);
  const nextPageRef = useRef(1);
  const inFlightPageRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { loadPageRef.current = loadPage; }, [loadPage]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    let active = true;
    const loader = loadPageRef.current;
    nextPageRef.current = 1;
    if (!loader) return () => { active = false; };
    inFlightPageRef.current = 0;
    void loader(0).then((first) => {
      if (!active) return;
      setAlbum(entriesFor(first)); setHasMore(first.page.hasMore); nextPageRef.current = 1;
      setInitialLoading(false); inFlightPageRef.current = null;
    }).catch(() => {
      if (!active) return;
      setInitialError(true); setInitialLoading(false); inFlightPageRef.current = null;
    });
    return () => { active = false; };
  }, []);

  const requestInitialPage = () => {
    const loader = loadPageRef.current;
    if (!loader || inFlightPageRef.current !== null) return;
    inFlightPageRef.current = 0;
    setInitialError(false); setInitialLoading(true);
    void loader(0).then((first) => {
      if (!mountedRef.current) return;
      setAlbum(entriesFor(first)); setHasMore(first.page.hasMore); nextPageRef.current = 1;
      setInitialLoading(false); inFlightPageRef.current = null;
    }).catch(() => {
      if (!mountedRef.current) return;
      setInitialError(true); setInitialLoading(false); inFlightPageRef.current = null;
    });
  };

  const requestMore = () => {
    const loader = loadPageRef.current;
    const page = nextPageRef.current;
    if (!loader || !hasMore || initialLoading || inFlightPageRef.current !== null) return;
    inFlightPageRef.current = page;
    setLoadMoreError(false); setLoadingMore(true);
    void loader(page).then((next) => {
      if (!mountedRef.current) return;
      const batch = entriesFor(next);
      const knownIds = new Set(album.map(({ entry }) => entry.id));
      const unique = batch.filter(({ entry }) => !knownIds.has(entry.id));
      if (unique.length) setAlbum((previous) => [...previous, ...unique]);
      if (!unique.length && next.page.hasMore) setLoadMoreError(true);
      setHasMore(next.page.hasMore);
      if (unique.length || !next.page.hasMore) nextPageRef.current = page + 1;
      setLoadingMore(false); inFlightPageRef.current = null;
    }).catch(() => {
      if (!mountedRef.current) return;
      setLoadMoreError(true); setLoadingMore(false); inFlightPageRef.current = null;
    });
  };

  const selected = selectedId === null ? null : album.find(({ entry }) => entry.id === selectedId) ?? null;
  const tileSize = Math.max(92, Math.floor((width - 48) / 3));
  const header = (title: string, label: string, onPress: () => void, action: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text numberOfLines={2} style={{ flex: 1, flexShrink: 1, color: palette.limestone, fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8 }}>{title}</Text><View style={{ flexShrink: 0, minWidth: 92 }}><ActionButton accessibilityLabel={label} onPress={onPress} variant="secondary">{action}</ActionButton></View></View>;
  const footer = loadingMore ? <View style={{ paddingVertical: 16 }}><ActivityIndicator color={palette.limestone} accessibilityLabel="Loading more associated media" /></View> : loadMoreError ? <View style={{ gap: 8, paddingVertical: 12 }}><Body>Could not load more media. The photos already shown are still available.</Body><ActionButton accessibilityLabel="Retry media page" onPress={requestMore} variant="secondary">Retry</ActionButton></View> : hasMore ? <View style={{ paddingVertical: 12 }}><ActionButton accessibilityLabel="Load more media" onPress={requestMore} variant="secondary">Load more</ActionButton></View> : null;

  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}><SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.rainforest }}><View testID="journey-media-album" style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
    {header('Photos and videos', 'Close photos and videos', onClose, 'Close')}<Body>Only accessible local media associated with this private journey appears here.</Body>
    {initialLoading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={palette.limestone} accessibilityLabel="Loading associated media" /></View> : initialError ? <View style={{ gap: 10 }}><Body>This gallery changed. Return to the journey and try again.</Body><ActionButton accessibilityLabel="Retry media page" onPress={requestInitialPage} variant="secondary">Retry</ActionButton></View> : <FlatList testID="journey-media-grid" style={{ flex: 1 }} data={album} keyExtractor={({ entry }) => entry.id} numColumns={3} columnWrapperStyle={{ gap: 8 }} contentContainerStyle={{ gap: 8, paddingBottom: 16 }} renderItem={({ item }) => <Tile entry={item.entry} preview={item.preview} size={tileSize} onPress={() => setSelectedId(item.entry.id)} />} ListEmptyComponent={<Body>No associated media is available yet.</Body>} ListFooterComponent={footer} />}
    {selected && <View style={{ position: 'absolute', inset: 0, paddingHorizontal: 16, paddingVertical: 12, gap: 12, backgroundColor: palette.rainforest }}>
      {header(selected.entry.kind === 'video' ? 'Associated video' : 'Associated photo', 'Back to gallery', () => setSelectedId(null), 'Back')}
      {selected.preview?.uri ? selected.preview.kind === 'video' ? <LocalVideo uri={selected.preview.uri} /> : <Image source={{ uri: selected.preview.uri }} style={{ flex: 1, borderRadius: 14 }} contentFit="contain" accessibilityLabel="Associated local photo" cachePolicy="memory" /> : <Body>{selected.entry.kind === 'video' ? 'Associated video unavailable.' : 'Associated photo unavailable.'}</Body>}
      <Body>{selected.entry.association}</Body>
    </View>}
  </View></SafeAreaView></Modal>;
}
