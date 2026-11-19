import { requireOptionalNativeModule } from 'expo';
import type { ReadCaptureMetadata } from './capture-metadata';

type CaptureMetadataNativeModule = { readCaptureMetadata?(uri: string): Promise<unknown> };

/** Android-only native reader. Null on iOS, Expo Go or older native builds. */
export function nativeCaptureMetadataReader(): ReadCaptureMetadata | null {
  const module = requireOptionalNativeModule<CaptureMetadataNativeModule>('TravelLifeSignage');
  return module?.readCaptureMetadata ? module.readCaptureMetadata.bind(module) : null;
}
