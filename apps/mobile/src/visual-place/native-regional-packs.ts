import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { regionalPackPreviewConfig } from './regional-pack-config';
import { createRegionalPackLoader } from './regional-pack-loader';
import { VisualPlaceError } from './recovery';

export function nativeRegionalPackLoader() {
  const config = regionalPackPreviewConfig();
  if (!config || Platform.OS !== 'android') return null;
  const native = requireOptionalNativeModule<{ prepareLandmark?: unknown; readLandmark?: unknown }>('TravelLifeSignage');
  if (typeof native?.prepareLandmark !== 'function' || typeof native.readLandmark !== 'function') return null;
  return createRegionalPackLoader(config.manifestSha256, {
    async download(filename, maximumBytes, signal) {
      const { fetch } = await import('expo/fetch');
      if (signal.aborted) throw new VisualPlaceError('SKIPPED');
      let reader: ReadableStreamDefaultReader<Uint8Array>;
      try {
        const response = await fetch(`${config.origin}/${filename}`, { method: 'GET', credentials: 'omit', redirect: 'error', signal });
        if (!response.ok || response.redirected || !response.body) throw new VisualPlaceError('MEDIA_UNAVAILABLE');
        reader = response.body.getReader();
      } catch {
        throw new VisualPlaceError('MEDIA_UNAVAILABLE');
      }
      const buffer = new Uint8Array(maximumBytes);
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength > maximumBytes - length) throw new VisualPlaceError('MEDIA_VERIFY');
          buffer.set(value, length);
          length += value.byteLength;
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        if (error instanceof VisualPlaceError) throw error;
        throw new VisualPlaceError('MEDIA_UNAVAILABLE');
      } finally {
        reader.releaseLock();
      }
      return buffer.subarray(0, length);
    },
    async digest(bytes) {
      const { digest, CryptoDigestAlgorithm } = await import('expo-crypto');
      const hash = await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes).buffer);
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    },
  });
}
