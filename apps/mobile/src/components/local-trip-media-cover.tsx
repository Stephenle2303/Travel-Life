import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image, type ImageRef } from 'expo-image';
import { type VideoThumbnail } from 'expo-video';

import { replayThumbnails } from '@/replay/thumbnail-service';
import { palette } from '@/components/ui';

/**
 * Displays only an already-authorized local URI. Video files use the same
 * bounded poster path as Share Replay rather than asking an image view to
 * decode a video URI directly.
 */
export function LocalTripMediaCover({ uri, kind }: { uri: string; kind: 'photo' | 'video' }) {
  const [poster, setPoster] = useState<ImageRef | VideoThumbnail | null>(null);
  useEffect(() => {
    let active = true;
    let heldHandle: ImageRef | VideoThumbnail | undefined;
    const unsubscribe = replayThumbnails.subscribeInvalidation(() => { active = false; setPoster(null); });
    void replayThumbnails.request(uri, uri, kind === 'video').then((handle) => { if (!active || !handle) return; heldHandle = handle; replayThumbnails.pin(uri); setPoster(handle); });
    return () => { active = false; unsubscribe(); if (heldHandle) replayThumbnails.unpin(uri, heldHandle); };
  }, [kind, uri]);
  return poster ? <Image source={poster} style={styles.image} contentFit="cover" accessibilityLabel={kind === 'video' ? 'video poster' : 'photo thumbnail'} /> : <View style={styles.fallback}><Text style={styles.fallbackText}>{kind === 'video' ? 'VIDEO' : 'PHOTO'}</Text></View>;
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: palette.sage, fontSize: 11, fontWeight: '900' },
});
