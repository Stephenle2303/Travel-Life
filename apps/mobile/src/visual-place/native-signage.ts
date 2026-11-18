import { requireOptionalNativeModule } from 'expo';
import { createVisualRecognition, VisualPlaceError } from './recovery';

type SignageNativeModule = {
  readText(uri: string): Promise<unknown>;
  prepareLandmark?(uri: string): Promise<void>;
  readLandmark?(uri: string): Promise<unknown>;
};

export function nativeVisualRecognition() {
  if (!__DEV__ || process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW !== 'true') return null;
  const signage = requireOptionalNativeModule<SignageNativeModule>('TravelLifeSignage');
  if (!signage) return null;
  const prepare = signage.prepareLandmark?.bind(signage);
  const read = signage.readLandmark?.bind(signage);
  return createVisualRecognition(async (uri) => {
    try {
      return await signage.readText(uri);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (code === 'ERR_SIGNAGE_DECODE') throw new VisualPlaceError('MEDIA_DECODE');
      throw error;
    }
  }, undefined, prepare && read ? async (uri, signal, regional) => {
    const { readNativeLandmark } = await import('./native-landmark');
    return readNativeLandmark(read, uri, signal, regional);
  } : undefined, prepare && read ? async (signal, regional) => {
    try {
      const { prepareNativeLandmark } = await import('./native-landmark');
      if (signal.aborted) throw new VisualPlaceError('SKIPPED');
      await prepareNativeLandmark(prepare, signal, regional);
    } catch (error) {
      if (error instanceof VisualPlaceError) throw error;
      throw new VisualPlaceError('MEDIA_UNAVAILABLE');
    }
  } : undefined);
}
