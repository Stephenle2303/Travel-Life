import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export interface HeroVideoProps {
  source: number;
  shouldPlay: boolean;
  onPlaying: (playing: boolean) => void;
  onBlocked: () => void;
  onFailed: () => void;
}

/** Native player; the web adapter also catches the browser's play() promise. */
export function HeroVideo({ source, shouldPlay, onPlaying, onBlocked, onFailed }: HeroVideoProps) {
  const player = useVideoPlayer(source, (video) => {
    video.muted = true;
    video.volume = 0;
    video.loop = true;
    video.staysActiveInBackground = false;
  });

  useEffect(() => {
    const status = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') onFailed();
    });
    const playback = player.addListener('playingChange', ({ isPlaying }) => onPlaying(isPlaying));
    return () => { status.remove(); playback.remove(); };
  }, [onFailed, onPlaying, player]);

  useEffect(() => {
    try {
      if (shouldPlay) player.play();
      else player.pause();
    } catch { onBlocked(); }
    return () => { try { player.pause(); } catch { /* The player may already be released. */ } };
  }, [onBlocked, player, shouldPlay]);

  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} accessible={false} pointerEvents="none" surfaceType="textureView" />;
}
