import { useEffect, useRef } from 'react';
import { Asset } from 'expo-asset';
import type { HeroVideoProps } from './hero-video';

/** Contains rejected browser autoplay locally so the Welcome can retain its poster and retry control. */
export function requestWebPlayback(video: Pick<HTMLVideoElement, 'play'>, onBlocked: () => void) {
  try {
    const attempt = video.play();
    void attempt?.catch(onBlocked);
  } catch { onBlocked(); }
}

export function HeroVideo({ source, shouldPlay, onPlaying, onBlocked, onFailed }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const uri = Asset.fromModule(source).uri;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let current = true;
    if (shouldPlay) {
      requestWebPlayback(video, () => { if (current) onBlocked(); });
    } else video.pause();
    return () => { current = false; video.pause(); };
  }, [onBlocked, shouldPlay, uri]);

  return <video ref={videoRef} src={uri} muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} onPlaying={() => onPlaying(true)} onPause={() => onPlaying(false)} onError={onFailed} disablePictureInPicture style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />;
}
