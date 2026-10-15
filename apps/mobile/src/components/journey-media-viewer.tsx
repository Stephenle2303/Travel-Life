import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

import { ActionButton, Body, InsetPanel, palette, Title } from '@/components/ui';
import type { OwnerPreview } from '@/photo-access/types';
import type { JourneyDetail, JourneyMediaPage } from '@/reveal/types';

type GalleryPage = { page: JourneyMediaPage; previews: OwnerPreview[] };

function LocalVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (video) => { video.muted = true; video.volume = 0; video.loop = false; });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => { subscription.remove(); player.pause(); };
  }, [player]);
  return <View style={{ gap: 10 }}><VideoView player={player} style={{ height: 220, borderRadius: 14 }} nativeControls allowsPictureInPicture={false} /><ActionButton accessibilityLabel="Play associated video" onPress={() => player.play()}>Play video</ActionButton><Body>Sound is off initially. Playback pauses when this viewer closes or the app backgrounds.</Body></View>;
}

function GalleryEntry({ entry, preview, onPress }: { entry: JourneyMediaPage['items'][number]; preview?: OwnerPreview; onPress(): void }) {
  const photoUri = entry.kind === 'photo' ? preview?.uri : null;
  const available = preview?.availability === 'available' && Boolean(preview.uri);
  return <Pressable accessibilityLabel={`Open associated ${entry.kind}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(243,238,221,0.42)', opacity: pressed ? 0.78 : 1 })}>
    {photoUri ? <Image source={{ uri: photoUri }} style={{ width: 72, height: 60, borderRadius: 8 }} accessibilityLabel="Associated photo thumbnail" cachePolicy="memory" allowDownscaling /> : <View style={{ width: 72, height: 60, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.rainforest }}><Text style={{ color: palette.sage, fontWeight: '800' }}>{entry.kind === 'video' ? 'VIDEO' : 'PHOTO'}</Text></View>}
    <View style={{ flex: 1, gap: 2 }}><Text style={{ color: palette.limestone, fontWeight: '800' }}>{entry.kind === 'video' ? 'Video' : 'Photo'}</Text><Text style={{ color: palette.sage }}>{available ? 'Available locally' : entry.availability === 'unknown' ? 'Checking local availability' : 'Unavailable'}</Text></View>
  </Pressable>;
}

export function JourneyMediaViewer({ detail, previews, loadPage, onClose }: { detail: JourneyDetail; previews: OwnerPreview[]; loadPage?: (page: number) => Promise<GalleryPage>; onClose(): void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [gallery, setGallery] = useState<GalleryPage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const loadPageRef = useRef(loadPage);
  useEffect(() => { loadPageRef.current = loadPage; }, [loadPage]);
  useEffect(() => {
    let active = true;
    const loader = loadPageRef.current;
    if (!loader) return () => { active = false; };
    void loader(pageIndex).then((next) => { if (active) { setGallery(next); setError(null); setSelectedIndex(null); } }).catch(() => { if (active) setError('This gallery changed. Return to the journey and try again.'); });
    return () => { active = false; };
  }, [pageIndex, retry]);
  const fallback: GalleryPage = { page: { items: detail.memories.map((memory, index) => ({ id: memory.id, availability: memory.availability, association: memory.association, kind: previews[index]?.kind ?? 'photo' })), hasMore: false }, previews };
  const activePage = gallery ?? fallback;
  const item = selectedIndex === null ? null : activePage.page.items[selectedIndex];
  const preview = selectedIndex === null ? null : activePage.previews[selectedIndex];
  if (item && preview) return <InsetPanel><Title>{item.kind === 'video' ? 'Associated video' : 'Associated photo'}</Title>{preview.uri ? preview.kind === 'video' ? <LocalVideo uri={preview.uri} /> : <Image source={{ uri: preview.uri }} style={{ height: 320, borderRadius: 14 }} accessibilityLabel="Associated local photo" cachePolicy="memory" allowDownscaling /> : <Body>{item.kind === 'video' ? 'Associated video unavailable.' : 'Associated photo unavailable.'}</Body>}<Body>{item.association}</Body><ActionButton accessibilityLabel="Back to gallery" onPress={() => setSelectedIndex(null)} variant="secondary">Back to gallery</ActionButton></InsetPanel>;
  const changePage = (next: number) => { setGallery(null); setError(null); setSelectedIndex(null); setPageIndex(next); };
  return <InsetPanel><Title>Photos and videos</Title><Body>Only accessible local media associated with this private journey appears here.</Body>{error ? <><Body>{error}</Body><ActionButton accessibilityLabel="Retry media page" onPress={() => setRetry((value) => value + 1)} variant="secondary">Retry</ActionButton></> : <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>{activePage.page.items.map((entry, index) => <GalleryEntry key={entry.id} entry={entry} preview={activePage.previews[index]} onPress={() => setSelectedIndex(index)} />)}{!activePage.page.items.length && <Body>No associated media is available yet.</Body>}</ScrollView>}<View style={{ flexDirection: 'row', gap: 8 }}><ActionButton accessibilityLabel="Previous media page" onPress={() => changePage(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0} variant="secondary">Previous</ActionButton>{activePage.page.hasMore && <ActionButton accessibilityLabel="Next media page" onPress={() => changePage(pageIndex + 1)} variant="secondary">Next</ActionButton>}</View><ActionButton accessibilityLabel="Close photos and videos" onPress={onClose} variant="secondary">Back to journey preview</ActionButton></InsetPanel>;
}
